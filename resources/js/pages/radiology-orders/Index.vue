<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import LinkedContextLookupField from '@/components/context/LinkedContextLookupField.vue';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
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
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import ConfirmationDialog from '@/components/workflow/ConfirmationDialog.vue';
import LeaveWorkflowDialog from '@/components/workflow/LeaveWorkflowDialog.vue';
import { useConfirmationDialog } from '@/composables/useConfirmationDialog';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePendingWorkflowLeaveGuard } from '@/composables/usePendingWorkflowLeaveGuard';
import { useWorkflowDraftPersistence } from '@/composables/useWorkflowDraftPersistence';
import AppLayout from '@/layouts/AppLayout.vue';
import { csrfRequestHeaders, refreshCsrfToken } from '@/lib/csrf';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { patientChartHref } from '@/lib/patientChart';
import { type SearchableSelectOption } from '@/lib/patientLocations';
import {
    clinicalStockPrecheckTitle,
    formatClinicalStockQuantity,
    type ClinicalStockPrecheck,
} from '@/types/clinicalStockPrecheck';
import { type BreadcrumbItem } from '@/types';

type ScopeData = {
    resolvedFrom: string;
    tenant: { code: string; name: string } | null;
    facility: { code: string; name: string } | null;
};

type RadiologyOrder = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
    admissionId: string | null;
    appointmentId: string | null;
    orderSessionId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    orderedByUserId: number | null;
    orderedAt: string | null;
    radiologyProcedureCatalogItemId: string | null;
    procedureCode: string | null;
    modality: string | null;
    studyDescription: string | null;
    clinicalIndication: string | null;
    scheduledFor: string | null;
    reportSummary: string | null;
    completedAt: string | null;
    entryState: 'draft' | 'active' | string | null;
    signedAt: string | null;
    signedByUserId: number | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    enteredInErrorByUserId: number | null;
    lifecycleLockedAt: string | null;
    stockPrecheck: ClinicalStockPrecheck | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type RadiologyOrderListResponse = {
    data: RadiologyOrder[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

type RadiologyOrderStatusCountsResponse = {
    data: { ordered: number; scheduled: number; in_progress: number; completed: number; cancelled: number; other: number; total: number };
};

type DuplicateCheckResponse<T> = {
    data: {
        severity: 'none' | 'warning' | 'critical' | string;
        messages: string[];
        sameEncounterDuplicates: T[];
        recentPatientDuplicates: T[];
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

type ClinicalCatalogItemListResponse = {
    data: ClinicalCatalogItem[];
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
    department: string | null;
    scheduledAt: string | null;
    durationMinutes: number | null;
    reason: string | null;
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

type LinkedContextListResponse<T> = {
    data: T[];
    meta?: {
        currentPage?: number;
        perPage?: number;
        total?: number;
        lastPage?: number;
    };
};

type AuditActor = {
    id: number | null;
    name: string | null;
    email: string | null;
    displayName: string | null;
};

type RadiologyOrderAuditLog = {
    id: string;
    radiologyOrderId?: string | null;
    actorId: number | null;
    actorType?: string | null;
    actor?: AuditActor | null;
    action: string | null;
    actionLabel?: string | null;
    changes: Record<string, unknown> | unknown[] | null;
    metadata: Record<string, unknown> | unknown[] | null;
    createdAt: string | null;
};

type RadiologyOrderAuditLogListResponse = {
    data: RadiologyOrderAuditLog[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

type AuthPermissionsResponse = { data?: Array<{ name?: string | null }> };
type ValidationErrorResponse = { message?: string; errors?: Record<string, string[]> };
type ApiError = Error & { status?: number; payload?: ValidationErrorResponse };
type CreateForm = {
    patientId: string;
    appointmentId: string;
    admissionId: string;
    radiologyProcedureCatalogItemId: string;
    procedureCode: string;
    modality: string;
    studyDescription: string;
    clinicalIndication: string;
    scheduledFor: string;
};
type RadiologyOrderBasketItem = {
    clientKey: string;
    patientId: string;
    appointmentId: string;
    admissionId: string;
    radiologyProcedureCatalogItemId: string;
    procedureCode: string;
    modality: string;
    studyDescription: string;
    clinicalIndication: string;
    scheduledFor: string;
};
type RadiologyCreateWorkflowDraft = CreateForm & {
    basketItems: RadiologyOrderBasketItem[];
    serverDraftId: string;
};
type RadiologyWorkspaceView = 'queue' | 'create';
type CreateContextLinkSource = 'none' | 'route' | 'auto' | 'manual';
type CreateContextEditorTab = 'patient' | 'appointment' | 'admission';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Radiology Orders', href: '/radiology-orders' }];

const modalityOptions = [
    { value: 'xray', label: 'X-Ray' },
    { value: 'ultrasound', label: 'Ultrasound' },
    { value: 'ct', label: 'CT' },
    { value: 'mri', label: 'MRI' },
    { value: 'other', label: 'Other' },
] as const;

const statusOptions = [
    { value: 'ordered', label: 'Ordered' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
] as const;

const auditActorTypeOptions = [
    { value: '', label: 'All actors' },
    { value: 'user', label: 'User only' },
    { value: 'system', label: 'System only' },
];

const today = new Date().toISOString().slice(0, 10);

const canRead = ref(false);
const canCreate = ref(false);
const canUpdateStatus = ref(false);
const canViewAudit = ref(false);
const canReadAppointments = ref(false);
const canReadAdmissions = ref(false);
const canReadMedicalRecords = ref(false);
const canReadLaboratoryOrders = ref(false);
const canReadTheatreProcedures = ref(false);
const canCreateTheatreProcedures = ref(false);
const canReadBillingInvoices = ref(false);
const canReadRadiologyProcedureCatalog = ref(false);
const isRadiologyCreatePermissionResolved = ref(false);
const isRadiologyProcedureCatalogReadPermissionResolved = ref(false);
const canUpdateServiceRequestStatus = ref(false);

const radiologyWalkInPanelRef = ref<InstanceType<
    typeof WalkInServiceRequestsPanel
> | null>(null);

const isRadiologyOperator = computed(() => canUpdateStatus.value);
const showRadiologyOperatorDashboard = computed(() => canUpdateStatus.value);

const pageLoading = ref(true);
const listLoading = ref(false);
const listErrors = ref<string[]>([]);
const actionLoadingId = ref<string | null>(null);
const orders = ref<RadiologyOrder[]>([]);
const pagination = ref<RadiologyOrderListResponse['meta'] | null>(null);
const counts = ref({ ordered: 0, scheduled: 0, in_progress: 0, completed: 0, cancelled: 0, other: 0, total: 0 });
const scope = ref<ScopeData | null>(null);

const compactQueueRows = useLocalStorageBoolean('opd.queueRows.compact', false);
const mobileFiltersDrawerOpen = ref(false);
const advancedFiltersSheetOpen = ref(false);
const radiologyWorkspaceView = ref<RadiologyWorkspaceView>('queue');
const radiologyQueueSearchInput = ref<HTMLInputElement | null>(null);
const radiologyProcedureCatalogLoading = ref(false);
const radiologyProcedureCatalogError = ref<string | null>(null);
const radiologyProcedureCatalogItems = ref<ClinicalCatalogItem[]>([]);
const patientDirectory = ref<Record<string, PatientSummary>>({});
const pendingPatientLookupIds = new Set<string>();

const createMessage = ref<string | null>(null);
const createServerDraftId = ref('');
const createErrors = ref<Record<string, string[]>>({});
const createSubmitting = ref(false);
const createOrderBasket = ref<RadiologyOrderBasketItem[]>([]);

const statusDialogOpen = ref(false);
const statusDialogOrder = ref<RadiologyOrder | null>(null);
const statusDialogAction = ref<'scheduled' | 'in_progress' | 'completed' | 'cancelled' | null>(null);
const statusDialogReason = ref('');
const statusDialogReportSummary = ref('');
const statusDialogError = ref<string | null>(null);
const statusDialogStockCheckLoading = ref(false);
const statusDialogStockCheckError = ref<string | null>(null);
const statusDialogStockCheckRequestKey = ref(0);
const lifecycleDialogOpen = ref(false);
const lifecycleDialogOrder = ref<RadiologyOrder | null>(null);
const lifecycleDialogAction = ref<'cancel' | 'entered_in_error' | null>(null);
const lifecycleDialogReason = ref('');
const lifecycleDialogError = ref<string | null>(null);

const detailsOpen = ref(false);
const detailsOrder = ref<RadiologyOrder | null>(null);
const detailsOrderLoading = ref(false);
const detailsOrderError = ref<string | null>(null);
const detailsSheetTab = ref<'overview' | 'workflows' | 'audit'>('overview');
const detailsOverviewTab = ref<'summary' | 'study' | 'reporting'>('summary');
const detailsAuditLoading = ref(false);
const detailsAuditError = ref<string | null>(null);
const detailsAuditLogs = ref<RadiologyOrderAuditLog[]>([]);
const detailsAuditMeta = ref<RadiologyOrderAuditLogListResponse['meta'] | null>(null);
const detailsAuditExporting = ref(false);
const detailsAuditFiltersOpen = ref(false);
const detailsAuditExpandedLogIds = ref<Record<string, boolean>>({});
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

let searchDebounceTimer: number | null = null;

function queryParam(name: string): string {
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

function queryDateParam(name: string, fallback = ''): string {
    const value = queryParam(name);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function queryIntParam(name: string, fallback: number): number {
    const parsed = Number.parseInt(queryParam(name), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const searchForm = reactive({
    q: queryParam('q'),
    patientId: queryParam('patientId'),
    status: queryParam('status'),
    modality: queryParam('modality'),
    from: queryDateParam('from', today),
    to: queryDateParam('to'),
    perPage: queryIntParam('perPage', 25),
    page: queryIntParam('page', 1),
});

const createForm = reactive<CreateForm>({
    patientId: queryParam('patientId'),
    appointmentId: queryParam('appointmentId'),
    admissionId: queryParam('admissionId'),
    radiologyProcedureCatalogItemId: '',
    procedureCode: '',
    modality: 'xray',
    studyDescription: '',
    clinicalIndication: '',
    scheduledFor: '',
});
const initialCreateRouteContext = Object.freeze({
    patientId: queryParam('patientId'),
    appointmentId: queryParam('appointmentId'),
    admissionId: queryParam('admissionId'),
});
const createLifecycleReplaceOrderId = ref(queryParam('reorderOfId'));
const createLifecycleAddOnOrderId = ref(queryParam('addOnToOrderId'));
const hasInitialCreateLifecycleQuery = Boolean(
    createLifecycleReplaceOrderId.value.trim() ||
    createLifecycleAddOnOrderId.value.trim(),
);
const createLifecycleSourceOrder = ref<RadiologyOrder | null>(null);
const createLifecycleSourceLoading = ref(false);
const createLifecycleSourceError = ref<string | null>(null);
const RADIOLOGY_CREATE_DRAFT_STORAGE_KEY =
    'ahs.radiology-orders.create-draft.v3';

function radiologyCreateDraftMatchesInitialContext(
    draft: RadiologyCreateWorkflowDraft,
): boolean {
    if (
        initialCreateRouteContext.patientId
        && draft.patientId.trim() !== initialCreateRouteContext.patientId
    ) {
        return false;
    }

    if (
        initialCreateRouteContext.appointmentId
        && draft.appointmentId.trim() !== initialCreateRouteContext.appointmentId
    ) {
        return false;
    }

    if (
        initialCreateRouteContext.admissionId
        && draft.admissionId.trim() !== initialCreateRouteContext.admissionId
    ) {
        return false;
    }

    return true;
}

const RADIOLOGY_CREATE_LEAVE_TITLE = 'Leave radiology order?';
const RADIOLOGY_CREATE_LEAVE_DESCRIPTION = 'Radiology order entry is still in progress. Stay here to finish the request, or leave this page and restart it later.';
const hasPendingCreateWorkflow = computed(() => Boolean(
    createServerDraftId.value.trim()
    || createOrderBasket.value.length > 0
    || createForm.radiologyProcedureCatalogItemId.trim()
    || createForm.procedureCode.trim()
    || createForm.studyDescription.trim()
    || createForm.clinicalIndication.trim()
    || createForm.scheduledFor.trim()
    || createForm.modality !== 'xray',
));
const {
    confirmOpen: createLeaveConfirmOpen,
    confirmLeave: confirmPendingCreateWorkflowLeave,
    cancelLeave: cancelPendingCreateWorkflowLeave,
} = usePendingWorkflowLeaveGuard({
    shouldBlock: hasPendingCreateWorkflow,
    isSubmitting: createSubmitting,
});
const {
    confirmationDialogState: duplicateConfirmDialogState,
    requestConfirmation: requestDuplicateConfirmation,
    updateConfirmationDialogOpen: updateDuplicateConfirmationDialogOpen,
    confirmDialogAction: confirmDuplicateDialogAction,
} = useConfirmationDialog();

const openedFromPatientChart = queryParam('from') === 'patient-chart';
const patientChartQueueRouteContext = Object.freeze({
    patientId: initialCreateRouteContext.patientId.trim(),
    appointmentId: initialCreateRouteContext.appointmentId.trim(),
    admissionId: initialCreateRouteContext.admissionId.trim(),
});
const patientChartQueueFocusLocked = ref(
    openedFromPatientChart && patientChartQueueRouteContext.patientId !== '',
);
const createPatientChartHref = computed(() => patientChartHref(createForm.patientId.trim(), {
    tab: 'orders',
    appointmentId: createForm.appointmentId.trim() || null,
    admissionId: createForm.admissionId.trim() || null,
}));
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

const openedFromClinicalContext = computed(
    () =>
        createForm.patientId.trim() !== '' &&
        (createForm.appointmentId.trim() !== '' ||
            createForm.admissionId.trim() !== ''),
);
const createPatientContextLocked = ref(openedFromClinicalContext.value);
const createContextDialogOpen = ref(false);
const createContextDialogInitialSelection = reactive({
    patientId: createForm.patientId.trim(),
    appointmentId: createForm.appointmentId.trim(),
    admissionId: createForm.admissionId.trim(),
});
const {
    clearPersistedDraft: clearPersistedRadiologyCreateDraft,
} = useWorkflowDraftPersistence<RadiologyCreateWorkflowDraft>({
    key: RADIOLOGY_CREATE_DRAFT_STORAGE_KEY,
    shouldPersist: hasPendingCreateWorkflow,
    capture: () => ({
        patientId: createForm.patientId,
        appointmentId: createForm.appointmentId,
        admissionId: createForm.admissionId,
        serverDraftId: createServerDraftId.value,
        radiologyProcedureCatalogItemId:
            createForm.radiologyProcedureCatalogItemId,
        procedureCode: createForm.procedureCode,
        modality: createForm.modality,
        studyDescription: createForm.studyDescription,
        clinicalIndication: createForm.clinicalIndication,
        scheduledFor: createForm.scheduledFor,
        basketItems: createOrderBasket.value.map((item) => ({ ...item })),
    }),
    restore: (draft) => {
        createForm.patientId = draft.patientId;
        createForm.appointmentId = draft.appointmentId;
        createForm.admissionId = draft.admissionId;
        createServerDraftId.value = draft.serverDraftId?.trim?.() ?? '';
        createForm.radiologyProcedureCatalogItemId =
            draft.radiologyProcedureCatalogItemId;
        createForm.procedureCode = draft.procedureCode;
        createForm.modality = draft.modality;
        createForm.studyDescription = draft.studyDescription;
        createForm.clinicalIndication = draft.clinicalIndication;
        createForm.scheduledFor = draft.scheduledFor;
        createOrderBasket.value = Array.isArray(draft.basketItems)
            ? draft.basketItems.map((item) => ({ ...item }))
            : [];
    },
    canRestore: (draft) =>
        !hasInitialCreateLifecycleQuery &&
        radiologyCreateDraftMatchesInitialContext(draft),
    onRestored: () => {
        const basketCount = createOrderBasket.value.length;
        if (createServerDraftId.value) {
            createMessage.value =
                'Restored your saved radiology draft on this device.';
        } else {
            createMessage.value = basketCount > 0
                ? `Restored your in-progress imaging basket (${basketCount} ${basketCount === 1 ? 'study' : 'studies'}) on this device.`
                : 'Restored your in-progress radiology order draft on this device.';
        }
        setRadiologyWorkspaceView('create');
    },
});
const createContextEditorTab = ref<CreateContextEditorTab>(
    !createForm.patientId.trim()
        ? 'patient'
        : createForm.admissionId.trim()
          ? 'admission'
          : createForm.appointmentId.trim()
            ? 'appointment'
            : 'patient',
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
let createOrderBasketItemCounter = 0;

if (queryParam('tab') === 'new') {
    radiologyWorkspaceView.value = 'create';
}

function formatDateTime(value: string | null): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatDateOnly(value: string | null): string {
    if (!value) return 'N/A';
    const date = parseDateTimeValue(value);
    if (!date) return value;
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(date);
}

function formatQueueDateTime(value: string | null): string {
    if (!value) return 'N/A';
    const date = parseDateTimeValue(value);
    if (!date) return value;

    const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
    };

    if (date.getFullYear() !== new Date().getFullYear()) {
        options.year = 'numeric';
    }

    return new Intl.DateTimeFormat(undefined, options).format(date);
}

function parseDateTimeValue(value: string | null): Date | null {
    const normalized = (value ?? '').trim();
    if (!normalized) return null;

    const candidate = normalized.includes('T')
        ? normalized
        : normalized.replace(' ', 'T');
    const parsed = new Date(candidate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function minutesBetween(start: string | null, end: string | null): number | null {
    const startDate = parseDateTimeValue(start);
    const endDate = parseDateTimeValue(end);
    if (!startDate || !endDate) return null;

    const delta = endDate.getTime() - startDate.getTime();
    if (delta < 0) return null;

    return Math.round(delta / 60000);
}

function formatDurationMinutes(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return 'N/A';
    if (value < 60) return `${value} min`;

    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
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
        const response = await apiRequest<PatientResponse>(
            'GET',
            `/patients/${normalizedId}`,
        );
        patientDirectory.value = {
            ...patientDirectory.value,
            [normalizedId]: response.data,
        };
    } catch {
        // Keep the create flow usable even if hydration fails.
    } finally {
        pendingPatientLookupIds.delete(normalizedId);
    }
}

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: { query?: Record<string, string | number | null | undefined>; body?: Record<string, unknown> },
    retryOnCsrfMismatch = true,
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
        Object.assign(headers, csrfRequestHeaders());
        body = JSON.stringify(options?.body ?? {});
    }
    const response = await fetch(url.toString(), { method, credentials: 'same-origin', headers, body });
    if (response.status === 419 && method !== 'GET' && retryOnCsrfMismatch) {
        await refreshCsrfToken();
        return apiRequest<T>(method, path, options, false);
    }
    const payload = (await response.json().catch(() => ({}))) as ValidationErrorResponse;
    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as ApiError;
        error.status = response.status;
        error.payload = payload;
        throw error;
    }
    return payload as T;
}

function createFieldError(key: string): string | null {
    return createErrors.value[key]?.[0] ?? null;
}

const hasCreateFeedback = computed(
    () =>
        Boolean(createMessage.value) ||
        Object.keys(createErrors.value).length > 0,
);

function resetCreateMessages() {
    createMessage.value = null;
    createErrors.value = {};
}

function statusVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'completed') return 'default';
    if (normalized === 'in_progress' || normalized === 'scheduled') return 'secondary';
    if (normalized === 'cancelled') return 'destructive';
    return 'outline';
}

function orderAccentClass(status: string | null): string {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'ordered') return 'border-l-4 border-l-sky-500/80 dark:border-l-sky-400/80';
    if (normalized === 'scheduled') return 'border-l-4 border-l-violet-500/80 dark:border-l-violet-400/80';
    if (normalized === 'in_progress') return 'border-l-4 border-l-amber-500/80 dark:border-l-amber-400/80';
    if (normalized === 'completed') return 'border-l-4 border-l-emerald-500/80 dark:border-l-emerald-400/80';
    if (normalized === 'cancelled') return 'border-l-4 border-l-rose-500/80 dark:border-l-rose-400/80';
    return '';
}

function shortId(value: string | null): string {
    if (!value) return 'N/A';
    return value.length > 10 ? `${value.slice(0, 8)}...` : value;
}

function queueCountLabel(value: number): string {
    return value > 99 ? '99+' : String(value);
}

const summaryQueueCounts = computed(() => ({
    ordered: counts.value.ordered,
    scheduled: counts.value.scheduled,
    inProgress: counts.value.in_progress,
    completed: counts.value.completed,
    cancelled: counts.value.cancelled,
    total: counts.value.total,
}));

const radiologyTurnaroundDashboard = computed(() => {
    const now = new Date();
    const completedTurnaroundMinutes = orders.value
        .filter((order) => (order.status ?? '').toLowerCase() === 'completed')
        .map((order) => minutesBetween(order.orderedAt, order.completedAt))
        .filter((value): value is number => value !== null);

    const completedToday = orders.value.filter(
        (order) => (order.status ?? '').toLowerCase() === 'completed',
    ).length;
    const waitingToSchedule = orders.value.filter(
        (order) => (order.status ?? '').toLowerCase() === 'ordered',
    ).length;
    const activeStudies = orders.value.filter(
        (order) => (order.status ?? '').toLowerCase() === 'in_progress',
    ).length;
    const scheduledReady = orders.value.filter(
        (order) => (order.status ?? '').toLowerCase() === 'scheduled',
    ).length;
    const overdueScheduled = orders.value.filter((order) => {
        if ((order.status ?? '').toLowerCase() !== 'scheduled') return false;
        const scheduledFor = parseDateTimeValue(order.scheduledFor);
        return scheduledFor ? scheduledFor.getTime() < now.getTime() : false;
    }).length;
    const averageTurnaroundMinutes =
        completedTurnaroundMinutes.length > 0
            ? Math.round(
                  completedTurnaroundMinutes.reduce(
                      (sum, value) => sum + value,
                      0,
                  ) / completedTurnaroundMinutes.length,
              )
            : null;

    return {
        waitingToSchedule,
        activeStudies,
        scheduledReady,
        overdueScheduled,
        completedToday,
        averageTurnaroundMinutes,
    };
});

const radiologyWorklistByModality = computed(() =>
    modalityOptions
        .map((modality) => {
            const laneOrders = orders.value.filter(
                (order) =>
                    (order.modality ?? '').trim().toLowerCase() === modality.value,
            );
            if (laneOrders.length === 0) return null;

            const ordered = laneOrders.filter(
                (order) => (order.status ?? '').toLowerCase() === 'ordered',
            ).length;
            const scheduled = laneOrders.filter(
                (order) => (order.status ?? '').toLowerCase() === 'scheduled',
            ).length;
            const inProgress = laneOrders.filter(
                (order) => (order.status ?? '').toLowerCase() === 'in_progress',
            ).length;
            const completed = laneOrders.filter(
                (order) => (order.status ?? '').toLowerCase() === 'completed',
            ).length;

            let nextAction = 'Queue clear for this modality.';
            if (ordered > 0) {
                nextAction =
                    ordered === 1
                        ? '1 study waiting for scheduling.'
                        : `${ordered} studies waiting for scheduling.`;
            } else if (scheduled > 0) {
                nextAction =
                    scheduled === 1
                        ? '1 scheduled study ready for modality handoff.'
                        : `${scheduled} scheduled studies ready for modality handoff.`;
            } else if (inProgress > 0) {
                nextAction =
                    inProgress === 1
                        ? '1 active study currently in imaging.'
                        : `${inProgress} active studies currently in imaging.`;
            } else if (completed > 0) {
                nextAction =
                    completed === 1
                        ? '1 completed study awaiting downstream review.'
                        : `${completed} completed studies awaiting downstream review.`;
            }

            return {
                value: modality.value,
                label: modality.label,
                total: laneOrders.length,
                ordered,
                scheduled,
                inProgress,
                completed,
                nextAction,
            };
        })
        .filter(
            (
                lane,
            ): lane is {
                value: string;
                label: string;
                total: number;
                ordered: number;
                scheduled: number;
                inProgress: number;
                completed: number;
                nextAction: string;
            } => lane !== null,
        )
        .sort((left, right) => {
            if (right.inProgress !== left.inProgress) {
                return right.inProgress - left.inProgress;
            }
            if (right.ordered !== left.ordered) {
                return right.ordered - left.ordered;
            }
            if (right.scheduled !== left.scheduled) {
                return right.scheduled - left.scheduled;
            }
            return right.total - left.total;
        }),
);

const scopeStatusLabel = computed(() => {
    if (!scope.value) return 'Scope Unavailable';
    return scope.value.resolvedFrom === 'none'
        ? 'Scope Unresolved'
        : 'Scope Ready';
});

const scopeWarning = computed(() => {
    if (pageLoading.value) return null;
    if (!scope.value) {
        return 'Platform access scope could not be loaded.';
    }
    if (scope.value.resolvedFrom === 'none') {
        return 'No tenant/facility scope is resolved. Radiology order actions may be blocked by tenant isolation controls.';
    }
    return null;
});

const statusSelectValue = computed({
    get: () => searchForm.status || 'all',
    set: (v: string) => {
        searchForm.status = v === 'all' ? '' : v;
        searchForm.page = 1;
        void loadQueue();
    },
});

const hasActiveFilters = computed(() =>
    Boolean(
        searchForm.q.trim() ||
            searchForm.patientId.trim() ||
            searchForm.status ||
            searchForm.modality ||
            searchForm.to ||
            searchForm.from !== today,
    ),
);

const activeRadiologyQueuePresetLabel = computed(() => {
    if (radiologyQueuePresetState.value.queueToday) return 'Queue Today';
    if (radiologyQueuePresetState.value.ordered) return 'Ordered';
    if (radiologyQueuePresetState.value.inProgress) return 'In Progress';
    if (radiologyQueuePresetState.value.completed) return 'Completed';
    return null;
});

const activeRadiologySearchBadgeLabel = computed(() => {
    const query = searchForm.q.trim();
    return query ? `Search: ${query}` : null;
});

const activeRadiologyStatusBadgeLabel = computed(() => {
    if (!searchForm.status) return null;

    if (
        (searchForm.status === 'ordered' && radiologyQueuePresetState.value.ordered) ||
        (searchForm.status === 'in_progress' && radiologyQueuePresetState.value.inProgress) ||
        (searchForm.status === 'completed' && radiologyQueuePresetState.value.completed)
    ) {
        return null;
    }

    return `Status: ${formatEnumLabel(searchForm.status)}`;
});

const activeRadiologyPatientSummary = computed<PatientSummary | null>(() => {
    const id = searchForm.patientId.trim();
    if (!id) return null;
    return patientDirectory.value[id] ?? null;
});

const activeRadiologyPatientBadgeLabel = computed(() => {
    const id = searchForm.patientId.trim();
    if (!id) return null;

    const summary = activeRadiologyPatientSummary.value;
    if (summary) return `Patient: ${patientName(summary)}`;
    return `Patient: ${shortId(id)}`;
});

const activeRadiologyOrderDateFilterBadgeLabel = computed(() => {
    if (!searchForm.to && searchForm.from === today) return null;
    if (activeRadiologyQueuePresetLabel.value) return null;

    const from = searchForm.from.trim();
    const to = searchForm.to.trim();

    if (from && to) {
        if (from === to) return `Ordered: ${formatDateOnly(from)}`;
        return `Ordered: ${formatDateOnly(from)} - ${formatDateOnly(to)}`;
    }

    if (from) return `Ordered from ${formatDateOnly(from)}`;
    if (to) return `Ordered until ${formatDateOnly(to)}`;
    return null;
});

const activeRadiologyAdvancedFilterCount = computed(() =>
    Number(Boolean(activeRadiologyPatientBadgeLabel.value))
    + Number(Boolean(searchForm.modality))
    + Number(Boolean(activeRadiologyOrderDateFilterBadgeLabel.value)),
);

const activeRadiologyFilterBadgeLabels = computed(() =>
    [
        activeRadiologySearchBadgeLabel.value,
        activeRadiologyStatusBadgeLabel.value,
        searchForm.modality ? `Modality: ${formatEnumLabel(searchForm.modality)}` : null,
        activeRadiologyPatientBadgeLabel.value,
        activeRadiologyOrderDateFilterBadgeLabel.value,
    ].filter((value): value is string => Boolean(value)),
);


function matchesRadiologyPreset(options: { status?: string }): boolean {
    if (searchForm.q.trim()) return false;
    if (searchForm.patientId.trim()) return false;
    if (searchForm.modality) return false;
    if (searchForm.to) return false;
    if (searchForm.from !== today) return false;
    return (options.status ?? '') === searchForm.status;
}

const radiologyQueuePresetState = computed(() => ({
    queueToday: matchesRadiologyPreset({ status: '' }),
    ordered: matchesRadiologyPreset({ status: 'ordered' }),
    inProgress: matchesRadiologyPreset({ status: 'in_progress' }),
    completed: matchesRadiologyPreset({ status: 'completed' }),
}));

const radiologyQueueStateLabel = computed(() => {
    if (radiologyQueuePresetState.value.queueToday) return 'Queue Today';
    if (radiologyQueuePresetState.value.ordered) return 'Ordered';
    if (radiologyQueuePresetState.value.inProgress) return 'In Progress';
    if (radiologyQueuePresetState.value.completed) return 'Completed';
    if (hasActiveFilters.value) return 'Custom filters';
    return 'Queue';
});

const radiologyToolbarStateLabel = computed(() => {
    if (searchForm.q.trim()) return 'Search active';
    if (searchForm.modality) return formatEnumLabel(searchForm.modality);
    if (searchForm.patientId.trim()) return 'Patient filter';
    if (searchForm.to || searchForm.from !== today) return 'Date range';
    if (searchForm.status) return formatEnumLabel(searchForm.status);
    return null;
});

function clinicalCatalogMetadataText(
    item: ClinicalCatalogItem | null | undefined,
    key: string,
): string {
    const value = item?.metadata?.[key];
    return typeof value === 'string' ? value.trim() : '';
}

function radiologyContrastLabel(value: string | null | undefined): string {
    const normalized = (value ?? '').trim().toLowerCase();
    if (!normalized) return 'Not specified';
    if (normalized === 'none') return 'No contrast';
    if (normalized === 'with') return 'With contrast';
    if (normalized === 'without') return 'Without contrast';
    if (normalized === 'with_or_without') return 'With or without contrast';
    return formatEnumLabel(normalized);
}

const selectedCreateRadiologyProcedureCatalogItem = computed<ClinicalCatalogItem | null>(
    () => {
        const catalogItemId = createForm.radiologyProcedureCatalogItemId.trim();
        if (!catalogItemId) return null;

        return (
            radiologyProcedureCatalogItems.value.find(
                (item) => item.id === catalogItemId,
            ) ?? null
        );
    },
);

const createRadiologyProcedureCatalogOptions = computed<
    SearchableSelectOption[]
>(() =>
    radiologyProcedureCatalogItems.value.map((item) => {
        const categoryLabel = item.category?.trim()
            ? formatEnumLabel(item.category)
            : 'Imaging';
        const bodyRegion = clinicalCatalogMetadataText(item, 'bodyRegion');
        const contrast = clinicalCatalogMetadataText(item, 'contrast');
        const bodyRegionLabel = bodyRegion ? formatEnumLabel(bodyRegion) : '';
        const contrastLabel = contrast ? radiologyContrastLabel(contrast) : '';
        const code = item.code?.trim() ?? '';
        const name = item.name?.trim() || code || 'Radiology procedure';
        const descriptionParts = [
            code,
            categoryLabel,
            bodyRegionLabel,
            contrastLabel,
        ].filter(Boolean);

        return {
            value: item.id,
            label: name,
            description: descriptionParts.join(' | ') || null,
            keywords: [
                code,
                name,
                item.category?.trim() ?? '',
                categoryLabel,
                bodyRegion,
                bodyRegionLabel,
                contrast,
                contrastLabel,
                item.description?.trim() ?? '',
            ].filter(Boolean),
            group: categoryLabel,
        };
    }),
);

const createRadiologyProcedureCategorySummary = computed(() => {
    const counts = new Map<string, number>();

    radiologyProcedureCatalogItems.value.forEach((item) => {
        const label = item.category?.trim()
            ? formatEnumLabel(item.category)
            : 'Other';
        counts.set(label, (counts.get(label) ?? 0) + 1);
    });

    return Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((left, right) => left.label.localeCompare(right.label));
});

const selectedCreateRadiologyProcedureModalityLabel = computed(() => {
    const category = selectedCreateRadiologyProcedureCatalogItem.value?.category?.trim();
    return category ? formatEnumLabel(category) : 'Will sync from selection';
});

const selectedCreateRadiologyProcedureBodyRegionLabel = computed(() => {
    const bodyRegion = clinicalCatalogMetadataText(
        selectedCreateRadiologyProcedureCatalogItem.value,
        'bodyRegion',
    );
    return bodyRegion ? formatEnumLabel(bodyRegion) : 'Will sync from selection';
});

const selectedCreateRadiologyProcedureContrastLabel = computed(() => {
    const contrast = clinicalCatalogMetadataText(
        selectedCreateRadiologyProcedureCatalogItem.value,
        'contrast',
    );
    return contrast ? radiologyContrastLabel(contrast) : 'Will sync from selection';
});

const statusDialogSelectedRadiologyProcedureCatalogItem = computed<
    ClinicalCatalogItem | null
>(() => {
    const catalogItemId =
        statusDialogOrder.value?.radiologyProcedureCatalogItemId?.trim() ?? '';
    if (!catalogItemId) return null;

    return (
        radiologyProcedureCatalogItems.value.find(
            (item) => item.id === catalogItemId,
        ) ?? null
    );
});

const radiologyReportTemplateSuggestions = computed(() => {
    if (
        statusDialogAction.value !== 'completed' ||
        statusDialogOrder.value === null
    ) {
        return [];
    }

    const order = statusDialogOrder.value;
    const studyLabel = order.studyDescription?.trim() || 'Imaging study';
    const modalityLabel = order.modality
        ? formatEnumLabel(order.modality)
        : 'Imaging';
    const bodyRegion = clinicalCatalogMetadataText(
        statusDialogSelectedRadiologyProcedureCatalogItem.value,
        'bodyRegion',
    );
    const bodyRegionLabel = bodyRegion ? formatEnumLabel(bodyRegion) : 'study area';

    return [
        {
            key: 'normal',
            label: 'Normal study',
            description: 'Short structured summary when no acute finding is seen.',
            content: `Findings: ${studyLabel} completed. No acute abnormality identified in the ${bodyRegionLabel.toLowerCase()}.\nImpression: No acute ${modalityLabel.toLowerCase()} abnormality.`,
        },
        {
            key: 'abnormal',
            label: 'Abnormal finding',
            description: 'Working template for a positive imaging finding and next clinical step.',
            content: `Findings: ${studyLabel} demonstrates [key imaging finding] involving the ${bodyRegionLabel.toLowerCase()}.\nImpression: Imaging features are most consistent with [working impression].\nRecommendation: Correlate clinically and continue with the requested specialty review.`,
        },
        {
            key: 'urgent',
            label: 'Urgent escalation',
            description: 'Use when the imaging result needs immediate clinical handoff.',
            content: `Findings: ${studyLabel} shows [critical finding] requiring urgent review.\nImpression: Critical ${modalityLabel.toLowerCase()} result communicated for immediate clinical action.\nRecommendation: Escalate to the responsible clinician now and document the handoff.`,
        },
    ];
});

const statusDialogConfig = computed(() => {
    switch (statusDialogAction.value) {
        case 'scheduled':
            return {
                title: 'Schedule Radiology Order',
                description:
                    'Confirm the study slot and move this order into the scheduled imaging queue.',
                confirmLabel: 'Schedule imaging',
                nextStateLabel: 'Scheduled',
                focusLabel: 'Ready to schedule',
                badgeVariant: 'secondary' as const,
                afterStep:
                    'Once the patient and modality are ready, move the study into active imaging.',
            };
        case 'in_progress':
            return {
                title: 'Start Imaging',
                description:
                    'Use this when the patient is ready and the study is actively moving into modality work.',
                confirmLabel: 'Start imaging',
                nextStateLabel: 'In Progress',
                focusLabel: 'Begin active imaging',
                badgeVariant: 'secondary' as const,
                afterStep:
                    'Complete the study with a report summary so the result can be handed downstream.',
            };
        case 'completed':
            return {
                title: 'Complete + Report',
                description:
                    'Capture a concise report summary and close the imaging workflow for downstream review.',
                confirmLabel: 'Save report',
                nextStateLabel: 'Completed',
                focusLabel: 'Report required',
                badgeVariant: 'default' as const,
                afterStep:
                    'The reported result becomes available for consultation, follow-up orders, and billing workflows.',
            };
        case 'cancelled':
            return {
                title: 'Cancel Radiology Order',
                description:
                    'Document why this study is stopping so downstream teams understand the interruption.',
                confirmLabel: 'Cancel order',
                nextStateLabel: 'Cancelled',
                focusLabel: 'Workflow stopping',
                badgeVariant: 'destructive' as const,
                afterStep:
                    'This workflow closes. A new radiology order will be required if imaging still needs to happen.',
            };
        default:
            return {
                title: 'Update Status',
                description: 'Review this radiology workflow step before saving.',
                confirmLabel: 'Save update',
                nextStateLabel: 'Updated',
                focusLabel: 'Workflow update',
                badgeVariant: 'outline' as const,
                afterStep: 'Continue the imaging workflow from the selected state.',
            };
    }
});

const statusDialogCurrentStepLabel = computed(() =>
    statusDialogOrder.value ? formatEnumLabel(statusDialogOrder.value.status) : 'Not set',
);

const statusDialogEncounterLabel = computed(() =>
    statusDialogOrder.value
        ? radiologyOrderEncounterLabel(statusDialogOrder.value)
        : 'No encounter link recorded',
);

const statusDialogReportGuidance = computed(() => {
    if (statusDialogAction.value !== 'completed') return null;

    return 'Keep the summary short: findings, impression, and recommendation only when it changes the next clinical step.';
});

const createRadiologyProcedureCatalogHelperText = computed(() => {
    if (radiologyProcedureCatalogLoading.value) {
        return 'Loading active radiology procedures...';
    }
    if (!canReadRadiologyProcedureCatalog.value) {
        return 'Radiology orders now use the active imaging procedure catalog.';
    }

    return 'Search by study name, code, modality, or body region.';
});

const createRadiologyProcedurePickerError = computed(() => {
    return (
        createFieldError('radiologyProcedureCatalogItemId') ??
        createFieldError('procedureCode')
    );
});

const canSubmitCreateRadiologyOrder = computed(() => {
    return (
        canCreate.value &&
        canReadRadiologyProcedureCatalog.value &&
        !radiologyProcedureCatalogLoading.value &&
        radiologyProcedureCatalogItems.value.length > 0 &&
        Boolean(createForm.radiologyProcedureCatalogItemId.trim())
    );
});

const hasCreateOrderBasketItems = computed(
    () => createOrderBasket.value.length > 0,
);
const hasSavedCreateDraft = computed(
    () => createServerDraftId.value.trim() !== '',
);
const showSaveCreateDraftAction = computed(
    () => !hasCreateOrderBasketItems.value && (
        hasSavedCreateDraft.value || hasPendingCreateWorkflow.value
    ),
);

const createOrderBasketCountLabel = computed(() => {
    const count = createOrderBasket.value.length;
    return `${count} ${count === 1 ? 'study' : 'studies'}`;
});

const hasPendingCurrentCreateOrderDraft = computed(() => Boolean(
    hasSavedCreateDraft.value ||
    createForm.radiologyProcedureCatalogItemId.trim()
    || createForm.procedureCode.trim()
    || createForm.studyDescription.trim()
    || createForm.clinicalIndication.trim()
    || createForm.scheduledFor.trim()
    || createForm.modality !== 'xray',
));

const createOrderActionDisabled = computed(
    () =>
        createSubmitting.value ||
        (
            hasCreateLifecycleMode.value &&
            (
                createLifecycleSourceLoading.value ||
                createLifecycleSourceOrder.value === null
            )
        ) ||
        !canSubmitCreateRadiologyOrder.value,
);

const submitCreateOrderBasketDisabled = computed(
    () =>
        createSubmitting.value
        || !canUseCreateOrderBasket.value
        || createOrderBasket.value.length === 0
        || hasPendingCurrentCreateOrderDraft.value,
);
const useSingleCreateOrderAction = computed(
    () => hasCreateLifecycleMode.value || !hasCreateOrderBasketItems.value,
);
const createOrderPrimaryActionLabel = computed(() => {
    if (createSubmitting.value) {
        return hasSavedCreateDraft.value
            ? 'Signing...'
            : 'Preparing signature...';
    }

    if (hasCreateOrderBasketItems.value) {
        return `Submit basket (${createOrderBasketCountLabel.value})`;
    }

    if (createLifecycleMode.value === 'reorder') {
        return 'Sign and submit replacement order';
    }

    if (createLifecycleMode.value === 'add_on') {
        return 'Sign and submit linked follow-up order';
    }

    return 'Sign and submit imaging order';
});

const saveCreateDraftLabel = computed(() =>
    createSubmitting.value
        ? 'Saving draft...'
        : hasSavedCreateDraft.value
          ? 'Update saved draft'
          : 'Save draft',
);

const createPatientSummary = computed(() => {
    const patientId = createForm.patientId.trim();
    return patientId ? patientDirectory.value[patientId] ?? null : null;
});

const hasCreateAppointmentContext = computed(() =>
    Boolean(createForm.appointmentId.trim()),
);
const hasCreateAdmissionContext = computed(() =>
    Boolean(createForm.admissionId.trim()),
);

const showClinicalHandoffBanner = computed(
    () =>
        createPatientContextLocked.value ||
        createAppointmentLinkSource.value === 'route' ||
        createAdmissionLinkSource.value === 'route',
);

const createOrderContextSummary = computed(() => {
    if (!createForm.patientId.trim()) {
        return 'Select the patient and optional visit context before entering imaging details.';
    }

    const linkedContexts: string[] = [];
    if (hasCreateAppointmentContext.value) linkedContexts.push('appointment');
    if (hasCreateAdmissionContext.value) linkedContexts.push('admission');

    const linkedSummary =
        linkedContexts.length === 2
            ? 'appointment and admission'
            : linkedContexts[0] ?? null;

    if (showClinicalHandoffBanner.value) {
        return linkedSummary
            ? `Clinical handoff locked this order to the selected patient with ${linkedSummary} context.`
            : 'Clinical handoff locked this order to the selected patient.';
    }

    return linkedSummary
        ? `This order will stay linked to the selected patient and ${linkedSummary} context.`
        : 'This order will stay linked to the selected patient.';
});

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
    if (!summary) {
        return 'Search and confirm the patient before entering imaging details.';
    }

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
    if (createAppointmentSummaryLoading.value) {
        return 'Loading appointment context...';
    }
    if (createAppointmentSummaryError.value) {
        return createAppointmentSummaryError.value;
    }

    if (!createAppointmentSummary.value) {
        return hasCreateAppointmentContext.value
            ? 'Appointment summary will appear once the link is resolved.'
            : createForm.patientId.trim()
              ? 'Link the checked-in appointment when this imaging order belongs to the current outpatient visit.'
              : 'Select a patient first, then optionally link the appointment.';
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
        parts.push('Linked from clinical handoff');
    }

    return parts.length > 0 ? parts.join(' | ') : 'Linked appointment ready';
});

const createAppointmentContextReason = computed(() => {
    const value = createAppointmentSummary.value?.reason?.trim();
    return value ? `Reason: ${value}` : null;
});

const createAppointmentContextStatusLabel = computed(() => {
    if (createAppointmentSummaryLoading.value) return 'Loading';
    const status = createAppointmentSummary.value?.status?.trim();
    if (!status) {
        return hasCreateAppointmentContext.value ? 'Linked' : null;
    }

    if (status.toLowerCase() === 'checked_in') return 'Checked In';
    return formatEnumLabel(status);
});

const createAppointmentContextStatusVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    const normalizedStatus =
        createAppointmentSummary.value?.status?.trim().toLowerCase() ?? '';

    if (normalizedStatus === 'checked_in') return 'default';
    if (normalizedStatus === 'scheduled') return 'secondary';
    if (normalizedStatus === 'cancelled' || normalizedStatus === 'no_show') {
        return 'destructive';
    }

    return 'outline';
});

const createAdmissionContextLabel = computed(() => {
    const admissionNumber = createAdmissionSummary.value?.admissionNumber?.trim();
    if (admissionNumber) return admissionNumber;
    if (hasCreateAdmissionContext.value) return 'Linked admission';
    return 'No linked admission';
});

const createAdmissionContextMeta = computed(() => {
    if (createAdmissionSummaryLoading.value) {
        return 'Loading admission context...';
    }
    if (createAdmissionSummaryError.value) {
        return createAdmissionSummaryError.value;
    }

    if (!createAdmissionSummary.value) {
        return hasCreateAdmissionContext.value
            ? 'Admission summary will appear once the link is resolved.'
            : createForm.patientId.trim()
              ? 'Link an active admission when this imaging request belongs to an inpatient stay.'
              : 'Select a patient first, then optionally link the admission.';
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
    } else if (createAdmissionLinkSource.value === 'route') {
        parts.push('Linked from clinical handoff');
    }

    return parts.length > 0 ? parts.join(' | ') : 'Linked admission ready';
});

const createAdmissionContextReason = computed(() => {
    const value = createAdmissionSummary.value?.statusReason?.trim();
    return value ? `Status note: ${value}` : null;
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

const createAdmissionContextSourceLabel = computed(() => {
    if (!hasCreateAdmissionContext.value) return null;
    if (createAdmissionLinkSource.value === 'auto') return 'Auto-linked';
    if (createAdmissionLinkSource.value === 'route') return 'Route context';
    if (createAdmissionLinkSource.value === 'manual') return 'Chosen';
    return null;
});

const createContextEditorDescription = computed(() => {
    switch (createContextEditorTab.value) {
        case 'appointment':
            return createForm.patientId.trim()
                ? 'Review the checked-in appointment or search manually for a different outpatient handoff.'
                : 'Select a patient first, then optionally link the checked-in appointment.';
        case 'admission':
            return createForm.patientId.trim()
                ? 'Review the active admission or search manually for a different inpatient stay.'
                : 'Select a patient first, then optionally link the admission.';
        default:
            return createPatientContextLocked.value
                ? 'Patient is locked from the selected clinical handoff until you choose a different patient.'
                : 'Search and confirm the patient before entering imaging details.';
    }
});

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

const hasCreateMedicalRecordContext = computed(
    () => queryParam('recordId') !== '',
);

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

function radiologyOrderContextHref(
    path: string,
    order: RadiologyOrder,
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

    if (order.patientId) params.set('patientId', order.patientId);
    if (order.appointmentId) params.set('appointmentId', order.appointmentId);
    if (order.admissionId) params.set('admissionId', order.admissionId);
    if (options?.reorderOfId?.trim()) {
        params.set('reorderOfId', options.reorderOfId.trim());
    }
    if (options?.addOnToOrderId?.trim()) {
        params.set('addOnToOrderId', options.addOnToOrderId.trim());
    }
    if (path === '/billing-invoices') {
        params.set('sourceWorkflowKind', 'radiology_order');
        params.set('sourceWorkflowId', order.id);
        const label =
            order.orderNumber?.trim()
            || order.studyDescription?.trim()
            || order.procedureCode?.trim()
            || 'Radiology order';
        params.set('sourceWorkflowLabel', label);
    }
    if (recordId && path !== '/medical-records') params.set('recordId', recordId);
    if (openedFromPatientChart) params.set('from', 'patient-chart');

    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
}

function radiologyOrderPatientLabel(order: RadiologyOrder): string {
    return order.patientId ? shortId(order.patientId) : 'Patient not linked';
}

function radiologyOrderEncounterLabel(order: RadiologyOrder): string {
    if (order.admissionId) {
        return `Admission ${shortId(order.admissionId)}`;
    }
    if (order.appointmentId) {
        return `Appointment ${shortId(order.appointmentId)}`;
    }
    return 'Direct order';
}

function isRadiologyOrderEnteredInError(order: RadiologyOrder | null): boolean {
    if (!order) return false;

    return Boolean(
        order.enteredInErrorAt
        || order.lifecycleReasonCode === 'entered_in_error',
    );
}

function canApplyRadiologyLifecycleAction(
    order: RadiologyOrder | null,
    action: 'cancel' | 'entered_in_error',
): boolean {
    if (!order || !canCreate.value || isRadiologyOrderEnteredInError(order)) {
        return false;
    }

    if (action === 'cancel') {
        return order.status !== 'cancelled' && order.status !== 'completed';
    }

    return true;
}

function canCreateRadiologyFollowOnOrder(order: RadiologyOrder | null): boolean {
    return Boolean(
        order
        && canCreate.value
        && order.patientId?.trim()
        && !isRadiologyOrderEnteredInError(order),
    );
}

function openRadiologyLifecycleDialog(
    order: RadiologyOrder,
    action: 'cancel' | 'entered_in_error',
): void {
    lifecycleDialogOrder.value = order;
    lifecycleDialogAction.value = action;
    lifecycleDialogReason.value =
        action === 'cancel' ? (order.statusReason ?? '') : '';
    lifecycleDialogError.value = null;
    lifecycleDialogOpen.value = true;
}

function closeRadiologyLifecycleDialog(): void {
    lifecycleDialogOpen.value = false;
    lifecycleDialogOrder.value = null;
    lifecycleDialogAction.value = null;
    lifecycleDialogReason.value = '';
    lifecycleDialogError.value = null;
}

async function submitRadiologyLifecycleDialog(): Promise<void> {
    if (!lifecycleDialogOrder.value || !lifecycleDialogAction.value) return;

    const reason = lifecycleDialogReason.value.trim();
    if (!reason) {
        lifecycleDialogError.value = 'Clinical reason is required.';
        return;
    }

    lifecycleDialogError.value = null;
    actionLoadingId.value = lifecycleDialogOrder.value.id;

    try {
        const response = await apiRequest<{ data: RadiologyOrder }>(
            'POST',
            `/radiology-orders/${lifecycleDialogOrder.value.id}/lifecycle`,
            {
                body: {
                    action: lifecycleDialogAction.value,
                    reason,
                },
            },
        );

        if (detailsOrder.value?.id === response.data.id) {
            detailsOrder.value = response.data;
        }
        if (statusDialogOrder.value?.id === response.data.id) {
            statusDialogOrder.value = response.data;
        }

        notifySuccess(
            lifecycleDialogAction.value === 'cancel'
                ? 'Radiology order cancelled.'
                : 'Radiology order marked entered in error.',
        );
        closeRadiologyLifecycleDialog();
    } catch (error) {
        lifecycleDialogError.value = messageFromUnknown(
            error,
            'Unable to apply the lifecycle action.',
        );
        notifyError(lifecycleDialogError.value);
    } finally {
        actionLoadingId.value = null;
    }
}

function setCreateAppointmentLink(
    value: string,
    source: CreateContextLinkSource,
) {
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
        createContextEditorTab.value = 'appointment';
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

function openCreateContextDialog(
    tab: CreateContextEditorTab = 'patient',
    options?: { unlockPatient?: boolean },
) {
    if (options?.unlockPatient) {
        unlockCreatePatientContext();
    }

    createContextEditorTab.value = tab;
    createContextDialogOpen.value = true;
}

function openCreateContextDialogForValidationErrors(
    errors: Record<string, string[]>,
) {
    if (errors.patientId?.length) {
        openCreateContextDialog('patient');
        return;
    }

    if (errors.appointmentId?.length) {
        openCreateContextDialog('appointment');
        return;
    }

    if (errors.admissionId?.length) {
        openCreateContextDialog('admission');
    }
}

function closeCreateContextDialogAfterSelection(
    kind: 'patientId' | 'appointmentId' | 'admissionId',
    selected: { id: string } | null,
) {
    if (!createContextDialogOpen.value || !selected) return;

    const nextId = selected.id?.trim?.() ?? '';
    if (!nextId) return;

    if (createContextDialogInitialSelection[kind] === nextId) return;

    createContextDialogOpen.value = false;
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

    if (options?.source === 'auto') {
        createContextAutoLinkSuppressed.appointment = false;
    }

    if (options?.focusEditor) {
        createContextEditorTab.value = 'appointment';
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
                    status: 'checked_in',
                    perPage: 3,
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
                (appointment.status?.trim().toLowerCase() ?? '') ===
                    'checked_in',
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

function radiologyWorkflowStageVariant(
    state: 'completed' | 'current' | 'pending',
): 'default' | 'secondary' | 'outline' {
    if (state === 'completed') return 'default';
    if (state === 'current') return 'secondary';
    return 'outline';
}

function radiologyWorkflowStageLabel(
    state: 'completed' | 'current' | 'pending',
): string {
    if (state === 'completed') return 'Complete';
    if (state === 'current') return 'Current';
    return 'Pending';
}

function radiologyWorkflowStageToneClass(
    state: 'completed' | 'current' | 'pending',
): string {
    if (state === 'completed') {
        return 'border-emerald-500/25 bg-emerald-500/5';
    }
    if (state === 'current') {
        return 'border-primary/25 bg-primary/5';
    }
    return 'border-border bg-muted/20';
}

function radiologyWorkflowStageDotClass(
    state: 'completed' | 'current' | 'pending',
): string {
    if (state === 'completed') return 'bg-primary';
    if (state === 'current') return 'bg-amber-500';
    return 'bg-muted-foreground/50';
}

function variantSurfaceClass(
    variant: 'default' | 'secondary' | 'outline' | 'destructive',
): string {
    if (variant === 'default') return 'border-emerald-500/30 bg-emerald-500/5';
    if (variant === 'secondary') return 'border-primary/25 bg-primary/5';
    if (variant === 'destructive') return 'border-rose-500/30 bg-rose-500/5';
    return 'border-border bg-background';
}

function isForbiddenError(error: unknown): boolean {
    return Boolean((error as { status?: number } | null)?.status === 403);
}

function syncCreateRadiologyProcedureCatalogSelection() {
    const catalogItemId = createForm.radiologyProcedureCatalogItemId.trim();
    if (!catalogItemId) {
        createForm.procedureCode = '';
        createForm.studyDescription = '';
        return;
    }

    const catalogItem =
        radiologyProcedureCatalogItems.value.find((item) => item.id === catalogItemId) ??
        null;
    if (catalogItem === null) return;

    createForm.procedureCode = catalogItem.code?.trim() ?? '';
    createForm.studyDescription = catalogItem.name?.trim() ?? '';

    const modality = catalogItem.category?.trim().toLowerCase() ?? '';
    if (modalityOptions.some((option) => option.value === modality)) {
        createForm.modality = modality;
    }
}

function radiologyWorkflowActionForOrder(order: RadiologyOrder | null) {
    if (!order) return null;

    const status = (order.status ?? '').toLowerCase();
    if (status === 'ordered') {
        return {
            action: 'scheduled' as const,
            label: 'Schedule imaging',
            description:
                'Confirm the requested imaging time and move the order into the scheduled queue.',
        };
    }
    if (status === 'scheduled') {
        return {
            action: 'in_progress' as const,
            label: 'Start imaging',
            description:
                'Move this study into active imaging work when the patient is ready.',
        };
    }
    if (status === 'in_progress') {
        return {
            action: 'completed' as const,
            label: 'Complete + report',
            description:
                'Capture the report summary and close the imaging workflow for downstream review.',
        };
    }
    return null;
}

function radiologyWorkflowSummaryForOrder(order: RadiologyOrder | null) {
    if (!order) return null;

    const status = (order.status ?? '').toLowerCase();
    if (status === 'completed') {
        return {
            title: 'Reported and ready for follow-up',
            description:
                'Imaging and report capture are complete. Hand the result back into the requesting workflow.',
            badge: 'Reported',
            variant: 'default' as const,
        };
    }
    if (status === 'cancelled') {
        return {
            title: 'Workflow stopped',
            description:
                'This radiology order was cancelled and will not continue through scheduling or imaging.',
            badge: 'Cancelled',
            variant: 'destructive' as const,
        };
    }
    if (status === 'in_progress') {
        return {
            title: 'Imaging in progress',
            description:
                'The study is actively being performed. The next required step is report completion.',
            badge: 'Active',
            variant: 'secondary' as const,
        };
    }
    if (status === 'scheduled') {
        return {
            title: 'Ready for imaging',
            description:
                'The order is scheduled. Start imaging when the patient and modality are ready.',
            badge: 'Scheduled',
            variant: 'secondary' as const,
        };
    }
    return {
        title: 'Awaiting scheduling',
        description:
            'The order has been placed but still needs a confirmed imaging slot or direct handoff into modality workflow.',
        badge: 'Ordered',
        variant: 'outline' as const,
    };
}

function radiologyWorkflowAfterStepForOrder(order: RadiologyOrder | null): string {
    if (!order) return 'No radiology order selected.';

    const status = (order.status ?? '').toLowerCase();
    if (status === 'ordered') {
        return 'After scheduling, the study moves into active imaging when the patient is ready.';
    }
    if (status === 'scheduled') {
        return 'After imaging starts, complete the study with a report summary for downstream review.';
    }
    if (status === 'in_progress') {
        return 'After report completion, return the result to the requesting clinical or billing workflow.';
    }
    if (status === 'completed') {
        return 'Use related workflows to continue consultation, follow-up orders, or billing if needed.';
    }
    if (status === 'cancelled') {
        return 'No additional imaging action remains unless a new order is placed.';
    }
    return 'Continue the imaging workflow from the current step.';
}

function radiologyQueueMetaItems(order: RadiologyOrder): string[] {
    const items: string[] = [];

    if (order.orderedAt) {
        items.push(`Ordered ${formatQueueDateTime(order.orderedAt)}`);
    }
    if (order.scheduledFor) {
        items.push(`Scheduled ${formatQueueDateTime(order.scheduledFor)}`);
    }
    if (order.completedAt) {
        items.push(`Completed ${formatQueueDateTime(order.completedAt)}`);
    }
    if (order.appointmentId) {
        items.push(`Appt ${shortId(order.appointmentId)}`);
    }

    return items;
}

function radiologyQueuePreviewForOrder(order: RadiologyOrder) {
    const status = (order.status ?? '').toLowerCase();
    const reportSummary = order.reportSummary?.trim();
    if (reportSummary && status !== 'completed') {
        return {
            label: 'Report',
            text: reportSummary,
        };
    }

    const clinicalIndication = order.clinicalIndication?.trim();
    if (clinicalIndication) {
        return {
            label: 'Reason',
            text: clinicalIndication,
        };
    }

    const statusReason = order.statusReason?.trim();
    if (statusReason) {
        return {
            label: 'Note',
            text: statusReason,
        };
    }

    return null;
}

function radiologyQueueWorkflowHintForOrder(order: RadiologyOrder): string | null {
    const action = radiologyWorkflowActionForOrder(order);
    if (action) {
        return `Next: ${action.label}`;
    }

    const status = (order.status ?? '').toLowerCase();
    if (status === 'completed' || status === 'cancelled') {
        return null;
    }

    return null;
}

const detailsWorkflowAction = computed(() =>
    radiologyWorkflowActionForOrder(detailsOrder.value),
);

const detailsWorkflowSummary = computed(() =>
    radiologyWorkflowSummaryForOrder(detailsOrder.value),
);

const detailsWorkflowAfterStep = computed(() =>
    radiologyWorkflowAfterStepForOrder(detailsOrder.value),
);

const detailsWorkflowSteps = computed(() => {
    const order = detailsOrder.value;
    if (!order) return [];

    const status = (order.status ?? '').toLowerCase();
    const scheduledReached =
        Boolean(order.scheduledFor) ||
        status === 'scheduled' ||
        status === 'in_progress' ||
        status === 'completed';

    return [
        {
            key: 'ordered',
            title: 'Ordered',
            description:
                'The imaging request is recorded and linked to the clinical encounter.',
            timestamp: order.orderedAt,
            state: 'completed' as const,
        },
        {
            key: 'scheduled',
            title: 'Scheduled',
            description: scheduledReached
                ? order.scheduledFor
                    ? 'Requested imaging time has been recorded.'
                    : 'The order has moved beyond ordering even though no schedule timestamp was stored.'
                : 'Awaiting scheduling or direct move into active imaging.',
            timestamp: order.scheduledFor,
            state:
                status === 'ordered'
                    ? ('pending' as const)
                    : status === 'scheduled'
                      ? ('current' as const)
                      : ('completed' as const),
        },
        {
            key: 'in_progress',
            title: 'Imaging',
            description:
                status === 'completed'
                    ? 'Imaging activity is complete.'
                    : status === 'in_progress'
                      ? 'The study is currently active in the modality queue.'
                      : 'Imaging has not started yet.',
            timestamp:
                status === 'completed'
                    ? order.completedAt
                    : status === 'in_progress'
                      ? order.scheduledFor
                      : null,
            state:
                status === 'completed'
                    ? ('completed' as const)
                    : status === 'in_progress'
                      ? ('current' as const)
                      : ('pending' as const),
        },
        {
            key: 'reported',
            title: 'Report complete',
            description: order.reportSummary?.trim()
                ? 'A report summary is recorded and ready for downstream handoff.'
                : 'Awaiting final report summary.',
            timestamp: order.completedAt,
            state:
                status === 'completed'
                    ? ('completed' as const)
                    : ('pending' as const),
        },
    ];
});

const detailsOverviewCards = computed<
    Array<{
        id: string;
        title: string;
        helper: string;
        value: string;
        badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
    }>
>(() => {
    const order = detailsOrder.value;
    if (!order) return [];

    return [
        {
            id: 'status',
            title: 'Order status',
            helper: 'Current lifecycle state for this study.',
            value: formatEnumLabel(order.status),
            badgeVariant: statusVariant(order.status),
        },
        {
            id: 'modality',
            title: 'Modality',
            helper: 'Imaging modality assigned to this study.',
            value: formatEnumLabel(order.modality),
            badgeVariant: 'outline',
        },
        {
            id: 'scheduled',
            title: 'Schedule',
            helper: 'Requested study time or active work handoff.',
            value: order.scheduledFor
                ? formatDateTime(order.scheduledFor)
                : 'Pending schedule',
            badgeVariant: order.scheduledFor ? 'secondary' : 'outline',
        },
        {
            id: 'report',
            title: 'Report',
            helper: 'Report capture state for downstream handoff.',
            value: order.reportSummary?.trim() ? 'Summary recorded' : 'Awaiting report',
            badgeVariant: order.reportSummary?.trim() ? 'default' : 'outline',
        },
    ];
});

const detailsAuditSummary = computed(() => {
    const logs = detailsAuditLogs.value;
    return {
        total: detailsAuditMeta.value?.total ?? logs.length,
        changedEntries: logs.filter(
            (log) => auditObjectEntries(log.changes).length > 0,
        ).length,
        userEntries: logs.filter(
            (log) => auditLogActorTypeLabel(log) === 'User',
        ).length,
        systemEntries: logs.filter(
            (log) => auditLogActorTypeLabel(log) === 'System',
        ).length,
    };
});

const detailsAuditHasActiveFilters = computed(
    () => detailsAuditActiveFilters.value.length > 0,
);

const showRadiologyCareWorkflowFooter = computed(
    () =>
        canCreate.value ||
        canReadMedicalRecords.value ||
        canReadLaboratoryOrders.value ||
        canCreateTheatreProcedures.value ||
        canReadBillingInvoices.value,
);

const radiologyDetailsSheetHasRelatedWorkflows = computed(() => {
    const order = detailsOrder.value;
    if (!order) return false;

    return Boolean(
        (canReadAppointments.value && order.appointmentId) ||
            (canReadAdmissions.value && order.admissionId) ||
            (canReadMedicalRecords.value && order.patientId) ||
            (canReadLaboratoryOrders.value && order.patientId) ||
            (canCreateTheatreProcedures.value && order.patientId) ||
            (canReadBillingInvoices.value && order.patientId),
    );
});

const detailsAuditActiveFilters = computed(() => {
    const filters: Array<{ key: string; label: string }> = [];
    const query = detailsAuditFilters.q.trim();
    const action = detailsAuditFilters.action.trim();
    const actorId = detailsAuditFilters.actorId.trim();

    if (query) filters.push({ key: 'q', label: `Search: ${query}` });
    if (action) filters.push({ key: 'action', label: `Action: ${action}` });
    if (detailsAuditFilters.actorType) {
        filters.push({
            key: 'actorType',
            label: `Actor type: ${
                auditActorTypeOptions.find(
                    (option) => option.value === detailsAuditFilters.actorType,
                )?.label ?? detailsAuditFilters.actorType
            }`,
        });
    }
    if (actorId) filters.push({ key: 'actorId', label: `Actor user ID: ${actorId}` });
    if (detailsAuditFilters.from) {
        filters.push({
            key: 'from',
            label: `From: ${formatDateTime(detailsAuditFilters.from)}`,
        });
    }
    if (detailsAuditFilters.to) {
        filters.push({
            key: 'to',
            label: `To: ${formatDateTime(detailsAuditFilters.to)}`,
        });
    }

    return filters;
});

async function loadPermissions() {
    isRadiologyCreatePermissionResolved.value = false;
    try {
        const response = await apiRequest<AuthPermissionsResponse>('GET', '/auth/me/permissions');
        const names = new Set((response.data ?? []).map((permission) => permission.name?.trim()).filter((name): name is string => Boolean(name)));
        canRead.value = names.has('radiology.orders.read');
        canCreate.value = names.has('radiology.orders.create');
        canUpdateStatus.value = names.has('radiology.orders.update-status');
        canViewAudit.value = names.has('radiology.orders.view-audit-logs') || names.has('radiology-orders.view-audit-logs');
        canReadAppointments.value = names.has('appointments.read');
        canReadAdmissions.value = names.has('admissions.read');
        canReadMedicalRecords.value = names.has('medical.records.read');
        canReadLaboratoryOrders.value = names.has('laboratory.orders.read');
        canReadTheatreProcedures.value = names.has('theatre.procedures.read');
        canCreateTheatreProcedures.value = names.has('theatre.procedures.create');
        canReadBillingInvoices.value = names.has('billing.invoices.read');
        canReadRadiologyProcedureCatalog.value = names.has(
            'platform.clinical-catalog.read',
        );
        canUpdateServiceRequestStatus.value = names.has('service.requests.update-status');
        isRadiologyCreatePermissionResolved.value = true;
        isRadiologyProcedureCatalogReadPermissionResolved.value = true;
    } catch {
        canRead.value = false;
        canCreate.value = false;
        canUpdateStatus.value = false;
        canViewAudit.value = false;
        canReadAppointments.value = false;
        canReadAdmissions.value = false;
        canReadMedicalRecords.value = false;
        canReadLaboratoryOrders.value = false;
        canReadTheatreProcedures.value = false;
        canCreateTheatreProcedures.value = false;
        canReadBillingInvoices.value = false;
        canReadRadiologyProcedureCatalog.value = false;
        canUpdateServiceRequestStatus.value = false;
        isRadiologyCreatePermissionResolved.value = true;
        isRadiologyProcedureCatalogReadPermissionResolved.value = true;
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

async function loadRadiologyProcedureCatalog(force = false) {
    if (!canReadRadiologyProcedureCatalog.value) {
        radiologyProcedureCatalogItems.value = [];
        radiologyProcedureCatalogError.value = null;
        radiologyProcedureCatalogLoading.value = false;
        syncCreateRadiologyProcedureCatalogSelection();
        return;
    }

    if (radiologyProcedureCatalogLoading.value) return;
    if (!force && radiologyProcedureCatalogItems.value.length > 0) return;

    radiologyProcedureCatalogLoading.value = true;
    radiologyProcedureCatalogError.value = null;

    try {
        const response = await apiRequest<ClinicalCatalogItemListResponse>(
            'GET',
            '/platform/admin/clinical-catalogs/radiology-procedures',
            {
                query: {
                    status: 'active',
                    sortBy: 'name',
                    sortDir: 'asc',
                    perPage: 100,
                    page: 1,
                },
            },
        );
        radiologyProcedureCatalogItems.value = response.data ?? [];
    } catch (error) {
        radiologyProcedureCatalogItems.value = [];
        radiologyProcedureCatalogError.value = isForbiddenError(error)
            ? 'Active radiology procedures are catalog-governed. Request `platform.clinical-catalog.read` to use the picker.'
            : messageFromUnknown(
                  error,
                  'Unable to load active radiology procedures.',
              );
    } finally {
        radiologyProcedureCatalogLoading.value = false;
        syncCreateRadiologyProcedureCatalogSelection();
    }
}

async function loadQueue() {
    if (!canRead.value) {
        orders.value = [];
        pagination.value = null;
        listLoading.value = false;
        pageLoading.value = false;
        return;
    }

    listLoading.value = true;
    listErrors.value = [];

    try {
        const [listResponse, countsResponse] = await Promise.all([
            apiRequest<RadiologyOrderListResponse>('GET', '/radiology-orders', {
                query: {
                    q: searchForm.q.trim() || null,
                    patientId: searchForm.patientId.trim() || null,
                    status: searchForm.status || null,
                    modality: searchForm.modality || null,
                    from: searchForm.from ? `${searchForm.from} 00:00:00` : null,
                    to: searchForm.to ? `${searchForm.to} 23:59:59` : null,
                    page: searchForm.page,
                    perPage: searchForm.perPage,
                    sortBy: 'orderedAt',
                    sortDir: 'desc',
                },
            }),
            apiRequest<RadiologyOrderStatusCountsResponse>('GET', '/radiology-orders/status-counts', {
                query: {
                    q: searchForm.q.trim() || null,
                    patientId: searchForm.patientId.trim() || null,
                    modality: searchForm.modality || null,
                },
            }),
        ]);

        orders.value = listResponse.data;
        pagination.value = listResponse.meta;
        counts.value = countsResponse.data;
    } catch (error) {
        orders.value = [];
        pagination.value = null;
        listErrors.value.push(messageFromUnknown(error, 'Unable to load radiology queue.'));
    } finally {
        listLoading.value = false;
        pageLoading.value = false;
    }
}

function clearSearchDebounce() {
    if (searchDebounceTimer !== null) {
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
    }
}

function submitSearch() {
    clearSearchDebounce();
    searchForm.patientId = patientChartQueueFocusLocked.value
        ? patientChartQueueRouteContext.patientId
        : searchForm.patientId.trim();
    searchForm.page = 1;
    void loadQueue();
}

function submitSearchFromMobileDrawer() {
    submitSearch();
    mobileFiltersDrawerOpen.value = false;
}
function submitSearchFromFiltersSheet() {
    submitSearch();
    advancedFiltersSheetOpen.value = false;
}

function resetFiltersFromFiltersSheet() {
    resetFilters();
    advancedFiltersSheetOpen.value = false;
}


function resetFilters() {
    clearSearchDebounce();
    searchForm.q = '';
    searchForm.patientId = patientChartQueueFocusLocked.value
        ? patientChartQueueRouteContext.patientId
        : '';
    searchForm.status = '';
    searchForm.modality = '';
    searchForm.from = today;
    searchForm.to = '';
    searchForm.perPage = 25;
    searchForm.page = 1;
    void loadQueue();
}

function openFullRadiologyQueue() {
    clearSearchDebounce();
    patientChartQueueFocusLocked.value = false;
    searchForm.patientId = '';
    searchForm.page = 1;
    void loadQueue();
}

function refocusRadiologyPatientQueue() {
    if (!patientChartQueueRouteContext.patientId) return;

    clearSearchDebounce();
    patientChartQueueFocusLocked.value = true;
    searchForm.patientId = patientChartQueueRouteContext.patientId;
    searchForm.page = 1;
    void loadQueue();
}

function resetFiltersFromMobileDrawer() {
    resetFilters();
    mobileFiltersDrawerOpen.value = false;
}

function prevPage() {
    if (!pagination.value || pagination.value.currentPage <= 1) return;
    clearSearchDebounce();
    searchForm.page = pagination.value.currentPage - 1;
    void loadQueue();
}

function nextPage() {
    if (!pagination.value || pagination.value.currentPage >= pagination.value.lastPage) return;
    clearSearchDebounce();
    searchForm.page = pagination.value.currentPage + 1;
    void loadQueue();
}

function onRadiologyWalkInAcknowledged(payload: { patientId: string }): void {
    if (payload.patientId) {
        createForm.patientId = payload.patientId;
        createPatientContextLocked.value = false;
        void hydratePatientSummary(payload.patientId);
    }
    setRadiologyWorkspaceView('create');
    void loadRadiologyProcedureCatalog();
}

async function refreshPage() {
    clearSearchDebounce();
    await loadPermissions();
    await Promise.all([
        loadQueue(),
        loadRadiologyProcedureCatalog(),
        radiologyWalkInPanelRef.value?.reload() ?? Promise.resolve(),
    ]);
    await loadCreateLifecycleSourceOrder();
}

function focusRadiologyQueueSearch() {
    nextTick(() => {
        radiologyQueueSearchInput.value?.focus();
        radiologyQueueSearchInput.value?.select();
    });
}

function scrollToRadiologyQueue() {
    document.getElementById('radiology-queue-card')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
    });
}

function setRadiologyWorkspaceView(
    view: RadiologyWorkspaceView,
    options?: { focusSearch?: boolean; scroll?: boolean },
) {
    radiologyWorkspaceView.value = view;
    syncRadiologyWorkspaceViewToUrl(view);

    if (view === 'queue') {
        if (options?.scroll) {
            nextTick(() => scrollToRadiologyQueue());
        }
        if (options?.focusSearch) {
            focusRadiologyQueueSearch();
        }
    }
}

function syncRadiologyWorkspaceViewToUrl(
    view: RadiologyWorkspaceView,
): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    url.searchParams.set('tab', view === 'create' ? 'new' : 'queue');
    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
}

function applyRadiologyQueuePreset(
    preset: 'queue_today' | 'ordered' | 'in_progress' | 'completed',
    options?: { focusSearch?: boolean },
) {
    searchForm.q = '';
    searchForm.patientId = patientChartQueueFocusLocked.value
        ? patientChartQueueRouteContext.patientId
        : '';
    searchForm.modality = '';
    searchForm.from = today;
    searchForm.to = '';
    searchForm.page = 1;
    searchForm.status =
        preset === 'queue_today'
            ? ''
            : preset === 'ordered'
              ? 'ordered'
              : preset === 'in_progress'
                ? 'in_progress'
                : 'completed';
    setRadiologyWorkspaceView('queue', {
        focusSearch: options?.focusSearch,
        scroll: true,
    });
    void loadQueue();
}

function applyRadiologyModalityLaneFilter(modality: string) {
    clearSearchDebounce();
    searchForm.modality = modality;
    searchForm.page = 1;
    setRadiologyWorkspaceView('queue', { scroll: true });
    void loadQueue();
}

function applyRadiologySummaryFilter(status: string) {
    clearSearchDebounce();
    searchForm.status = status;
    searchForm.page = 1;
    void loadQueue();
}

function isRadiologySummaryFilterActive(status: string): boolean {
    return (searchForm.status || '') === status;
}

function openCreateRadiologyWorkspace() {
    setRadiologyWorkspaceView('create');
    void loadRadiologyProcedureCatalog();
}

function nextCreateOrderBasketItemKey(): string {
    createOrderBasketItemCounter += 1;
    return `radiology-create-basket-${createOrderBasketItemCounter}`;
}

function buildCreateRadiologyOrderPayload(
    item: RadiologyOrderBasketItem,
    options?: {
        orderSessionId?: string | null;
        replacesOrderId?: string | null;
        addOnToOrderId?: string | null;
        entryMode?: 'draft' | 'active';
    },
) {
    return {
        patientId: item.patientId.trim(),
        appointmentId: item.appointmentId.trim() || null,
        admissionId: item.admissionId.trim() || null,
        orderSessionId: options?.orderSessionId?.trim() || null,
        replacesOrderId: options?.replacesOrderId?.trim() || null,
        addOnToOrderId: options?.addOnToOrderId?.trim() || null,
        entryMode: options?.entryMode ?? 'active',
        orderedByUserId: null,
        radiologyProcedureCatalogItemId:
            item.radiologyProcedureCatalogItemId.trim() || null,
        procedureCode: item.procedureCode.trim() || null,
        modality: item.modality,
        studyDescription: item.studyDescription.trim() || null,
        clinicalIndication: item.clinicalIndication.trim() || null,
        scheduledFor: item.scheduledFor
            ? item.scheduledFor.replace('T', ' ') + ':00'
            : null,
    };
}

function generateClinicalOrderSessionId(prefix: string): string {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function confirmRadiologyDuplicateOrdering(
    item: Pick<
        RadiologyOrderBasketItem,
        | 'patientId'
        | 'appointmentId'
        | 'admissionId'
        | 'radiologyProcedureCatalogItemId'
        | 'procedureCode'
        | 'studyDescription'
    >,
): Promise<boolean> {
    const response = await apiRequest<DuplicateCheckResponse<RadiologyOrder>>(
        'GET',
        '/radiology-orders/duplicate-check',
        {
            query: {
                patientId: item.patientId.trim(),
                appointmentId: item.appointmentId.trim() || null,
                admissionId: item.admissionId.trim() || null,
                radiologyProcedureCatalogItemId:
                    item.radiologyProcedureCatalogItemId.trim() || null,
                procedureCode: item.procedureCode.trim() || null,
            },
        },
    );

    if (!response.data.messages.length) {
        return true;
    }

    const title =
        item.studyDescription.trim()
        || item.procedureCode.trim()
        || 'this imaging study';

    return requestDuplicateConfirmation({
        title: `Duplicate advisory for ${title}`,
        description:
            'An active imaging order for this study already exists in the current encounter.',
        details: response.data.messages,
        cancelLabel: 'Review existing orders',
        confirmLabel: 'Continue ordering',
    });
}

function validateCurrentCreateOrderDraft(): RadiologyOrderBasketItem | null {
    resetCreateMessages();

    if (!createForm.patientId.trim()) {
        createErrors.value = {
            patientId: [
                'Select a patient before creating or queueing an imaging order.',
            ],
        };
        openCreateContextDialog('patient');
        return null;
    }

    if (!canReadRadiologyProcedureCatalog.value) {
        createErrors.value = {
            radiologyProcedureCatalogItemId: [
                'Clinical catalog access is required to create an imaging order from this workspace.',
            ],
        };
        return null;
    }

    if (!selectedCreateRadiologyProcedureCatalogItem.value) {
        createErrors.value = {
            radiologyProcedureCatalogItemId: [
                'Select an active imaging procedure from the clinical catalog.',
            ],
        };
        return null;
    }

    syncCreateRadiologyProcedureCatalogSelection();

    return {
        clientKey: nextCreateOrderBasketItemKey(),
        patientId: createForm.patientId.trim(),
        appointmentId: createForm.appointmentId.trim(),
        admissionId: createForm.admissionId.trim(),
        radiologyProcedureCatalogItemId:
            createForm.radiologyProcedureCatalogItemId.trim(),
        procedureCode: createForm.procedureCode.trim(),
        modality: createForm.modality,
        studyDescription: createForm.studyDescription.trim(),
        clinicalIndication: createForm.clinicalIndication.trim(),
        scheduledFor: createForm.scheduledFor,
    };
}

function resetCreateOrderDraftFields(): void {
    createForm.radiologyProcedureCatalogItemId = '';
    createForm.procedureCode = '';
    createForm.modality = 'xray';
    createForm.studyDescription = '';
    createForm.clinicalIndication = '';
    createForm.scheduledFor = '';
}

function restoreCreateOrderDraftFromBasketItem(
    item: RadiologyOrderBasketItem,
): void {
    createForm.radiologyProcedureCatalogItemId =
        item.radiologyProcedureCatalogItemId;
    createForm.procedureCode = item.procedureCode;
    createForm.modality = item.modality;
    createForm.studyDescription = item.studyDescription;
    createForm.clinicalIndication = item.clinicalIndication;
    createForm.scheduledFor = item.scheduledFor;
}

function formatCreateLifecycleSourceOrderLabel(
    order: RadiologyOrder | null,
): string {
    if (!order) return 'the selected imaging order';

    const orderNumber = order.orderNumber?.trim();
    const studyLabel =
        order.studyDescription?.trim() || order.procedureCode?.trim();

    if (orderNumber && studyLabel) {
        return `${orderNumber} (${studyLabel})`;
    }

    return orderNumber || studyLabel || 'the selected imaging order';
}

const createLifecycleSourceOrderId = computed(() =>
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
const canUseCreateOrderBasket = computed(
    () => !hasCreateLifecycleMode.value,
);
const createLifecycleSourceOrderLabel = computed(() =>
    formatCreateLifecycleSourceOrderLabel(createLifecycleSourceOrder.value),
);
const createLifecycleAlertTitle = computed(() => {
    if (createLifecycleMode.value === 'reorder') {
        return 'Replacement imaging order in progress';
    }

    if (createLifecycleMode.value === 'add_on') {
        return 'Linked imaging follow-up in progress';
    }

    return 'Imaging follow-up in progress';
});
const createLifecycleAlertDescription = computed(() => {
    if (createLifecycleMode.value === 'reorder') {
        return `This new imaging order will replace ${createLifecycleSourceOrderLabel.value}. The original order remains in the chart history for audit.`;
    }

    if (createLifecycleMode.value === 'add_on') {
        return `This new imaging order will be recorded as a linked follow-up to ${createLifecycleSourceOrderLabel.value}.`;
    }

    return '';
});
const createLifecycleClearActionLabel = computed(() => {
    if (createLifecycleMode.value === 'reorder') {
        return 'Start a new imaging order';
    }

    if (createLifecycleMode.value === 'add_on') {
        return 'Start a new independent study';
    }

    return 'Clear follow-up mode';
});

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
    createLifecycleSourceOrder.value = null;
    createLifecycleSourceError.value = null;
    createLifecycleSourceLoading.value = false;
    syncCreateLifecycleRouteState();
}

function applyCreateLifecycleSourceOrder(order: RadiologyOrder): void {
    createOrderBasket.value = [];
    clearPersistedRadiologyCreateDraft();
    resetCreateMessages();
    createServerDraftId.value = '';

    createForm.patientId = order.patientId?.trim() ?? '';
    createForm.appointmentId = order.appointmentId?.trim() ?? '';
    createForm.admissionId = order.admissionId?.trim() ?? '';
    createForm.radiologyProcedureCatalogItemId =
        order.radiologyProcedureCatalogItemId?.trim() ?? '';
    createForm.procedureCode = order.procedureCode?.trim() ?? '';
    createForm.modality = order.modality?.trim() || 'xray';
    createForm.studyDescription = order.studyDescription?.trim() ?? '';
    createForm.clinicalIndication = order.clinicalIndication?.trim() ?? '';
    createForm.scheduledFor = '';
    createPatientContextLocked.value = Boolean(
        createForm.patientId.trim() &&
        (
            createForm.appointmentId.trim() ||
            createForm.admissionId.trim()
        ),
    );

    if (createForm.radiologyProcedureCatalogItemId.trim()) {
        syncCreateRadiologyProcedureCatalogSelection();
    }

    setRadiologyWorkspaceView('create');
}

async function loadCreateLifecycleSourceOrder(): Promise<void> {
    const sourceOrderId = createLifecycleSourceOrderId.value.trim();

    if (!sourceOrderId) {
        createLifecycleSourceOrder.value = null;
        createLifecycleSourceError.value = null;
        createLifecycleSourceLoading.value = false;
        return;
    }

    createLifecycleSourceLoading.value = true;
    createLifecycleSourceError.value = null;
    createOrderBasket.value = [];
    clearPersistedRadiologyCreateDraft();
    setRadiologyWorkspaceView('create');

    try {
        await loadRadiologyProcedureCatalog();

        const response = await apiRequest<{ data: RadiologyOrder }>(
            'GET',
            `/radiology-orders/${sourceOrderId}`,
        );
        createLifecycleSourceOrder.value = response.data;
        applyCreateLifecycleSourceOrder(response.data);
    } catch (error) {
        createLifecycleSourceOrder.value = null;
        createLifecycleSourceError.value = messageFromUnknown(
            error,
            'Unable to load the source imaging order for this follow-up action.',
        );
    } finally {
        createLifecycleSourceLoading.value = false;
    }
}

function discardCurrentCreateOrderDraft(): void {
    resetCreateMessages();
    resetCreateOrderDraftFields();

    if (!hasPendingCreateWorkflow.value) {
        clearPersistedRadiologyCreateDraft();
    }
}

async function addCurrentCreateOrderToBasket(): Promise<void> {
    if (createSubmitting.value || !canUseCreateOrderBasket.value) return;

    resetCreateMessages();

    if (hasSavedCreateDraft.value) {
        notifyError(
            'Discard or sign the saved radiology draft before adding another study to the basket.',
        );
        return;
    }

    const draftItem = validateCurrentCreateOrderDraft();
    if (!draftItem) return;

    if (!(await confirmRadiologyDuplicateOrdering(draftItem))) {
        return;
    }

    const duplicateItem = createOrderBasket.value.find((item) =>
        item.patientId === draftItem.patientId
        && item.appointmentId === draftItem.appointmentId
        && item.admissionId === draftItem.admissionId
        && item.radiologyProcedureCatalogItemId === draftItem.radiologyProcedureCatalogItemId
        && item.clinicalIndication === draftItem.clinicalIndication
        && item.scheduledFor === draftItem.scheduledFor,
    );

    if (duplicateItem) {
        createErrors.value = {
            radiologyProcedureCatalogItemId: [
                'This imaging study is already in the basket with the same details.',
            ],
        };
        return;
    }

    createOrderBasket.value = [...createOrderBasket.value, draftItem];
    createMessage.value = `Added ${draftItem.studyDescription || draftItem.procedureCode || 'imaging study'} to the basket.`;
    resetCreateOrderDraftFields();
}

function removeCreateOrderBasketItem(clientKey: string): void {
    createOrderBasket.value = createOrderBasket.value.filter(
        (item) => item.clientKey !== clientKey,
    );

    if (!hasPendingCreateWorkflow.value) {
        clearPersistedRadiologyCreateDraft();
    }
}

function clearCreateOrderBasket(): void {
    createOrderBasket.value = [];

    if (!hasPendingCreateWorkflow.value) {
        clearPersistedRadiologyCreateDraft();
    }
}

async function saveCreateDraftRequest(options?: {
    silent?: boolean;
}): Promise<RadiologyOrder | null> {
    const draftItem = validateCurrentCreateOrderDraft();
    if (!draftItem) return null;
    if (!(await confirmRadiologyDuplicateOrdering(draftItem))) return null;

    const wasSavedDraft = hasSavedCreateDraft.value;
    try {
        const response = wasSavedDraft
            ? await apiRequest<{ data?: RadiologyOrder }>(
                'PATCH',
                `/radiology-orders/${createServerDraftId.value.trim()}`,
                {
                    body: {
                        radiologyProcedureCatalogItemId:
                            draftItem.radiologyProcedureCatalogItemId,
                        procedureCode: draftItem.procedureCode,
                        modality: draftItem.modality,
                        studyDescription: draftItem.studyDescription,
                        clinicalIndication: draftItem.clinicalIndication,
                        scheduledFor: draftItem.scheduledFor
                            ? draftItem.scheduledFor.replace('T', ' ') + ':00'
                            : null,
                    },
                },
            )
            : await apiRequest<{ data?: RadiologyOrder }>(
                'POST',
                '/radiology-orders',
                {
                    body: buildCreateRadiologyOrderPayload(draftItem, {
                        replacesOrderId: createLifecycleReplaceOrderId.value || null,
                        addOnToOrderId: createLifecycleAddOnOrderId.value || null,
                        entryMode: 'draft',
                    }),
                },
            );

        const draft = response.data ?? null;
        createServerDraftId.value = draft?.id?.trim?.() ?? '';

        if (!options?.silent) {
            createMessage.value = wasSavedDraft
                ? 'Saved your radiology draft on this device. Sign it when you are ready.'
                : 'Radiology draft saved on this device. Sign it when you are ready.';
            notifySuccess('Radiology draft saved.');
        }

        return draft;
    } catch (error) {
        const apiError = error as ApiError;
        createErrors.value = apiError.payload?.errors ?? {};
        openCreateContextDialogForValidationErrors(createErrors.value);
        notifyError(messageFromUnknown(error, 'Unable to save radiology draft.'));
        return null;
    }
}

async function createOrder() {
    if (createSubmitting.value) return;

    createSubmitting.value = true;
    resetCreateMessages();

    try {
        const draft = await saveCreateDraftRequest({ silent: true });
        if (!draft?.id) return;

        const patientId = draft.patientId?.trim() ?? createForm.patientId.trim();
        const response = await apiRequest<{ data?: RadiologyOrder }>(
            'POST',
            `/radiology-orders/${draft.id}/sign`,
        );
        const signedOrder = response.data ?? draft;

        createMessage.value = `Signed ${signedOrder.orderNumber ?? 'radiology order'} successfully.`;
        if (createMessage.value) notifySuccess(createMessage.value);
        resetCreateOrderDraftFields();
        createServerDraftId.value = '';
        clearPersistedRadiologyCreateDraft();
        clearCreateLifecycleMode();
        searchForm.q =
            signedOrder.orderNumber?.trim()
            || signedOrder.id
            || '';
        searchForm.patientId = signedOrder.patientId?.trim() || patientId;
        searchForm.status = 'ordered';
        searchForm.from = today;
        searchForm.to = '';
        searchForm.page = 1;
        setRadiologyWorkspaceView('queue');
        await loadQueue();
        await nextTick();
        focusRadiologyQueueSearch();
    } catch (error) {
        const apiError = error as ApiError;
        createErrors.value = apiError.payload?.errors ?? {};
        openCreateContextDialogForValidationErrors(createErrors.value);
        notifyError(messageFromUnknown(error, 'Unable to create radiology order.'));
    } finally {
        createSubmitting.value = false;
    }
}

async function saveCreateDraft(): Promise<void> {
    if (
        createSubmitting.value ||
        !canCreate.value ||
        (
            hasCreateLifecycleMode.value &&
            (
                createLifecycleSourceLoading.value ||
                createLifecycleSourceOrder.value === null
            )
        )
    ) {
        return;
    }

    createSubmitting.value = true;
    resetCreateMessages();

    try {
        await saveCreateDraftRequest();
    } finally {
        createSubmitting.value = false;
    }
}

async function discardSavedCreateDraft(): Promise<void> {
    if (!hasSavedCreateDraft.value || createSubmitting.value) {
        return;
    }

    createSubmitting.value = true;
    resetCreateMessages();

    try {
        await apiRequest(
            'DELETE',
            `/radiology-orders/${createServerDraftId.value.trim()}/draft`,
        );
        createServerDraftId.value = '';
        resetCreateOrderDraftFields();
        clearPersistedRadiologyCreateDraft();
        clearCreateLifecycleMode();
        createMessage.value = 'Discarded the saved radiology draft from this device.';
        notifySuccess('Radiology draft discarded.');
    } catch (error) {
        const apiError = error as ApiError;
        createErrors.value = apiError.payload?.errors ?? {};
        openCreateContextDialogForValidationErrors(createErrors.value);
        notifyError(messageFromUnknown(error, 'Unable to discard radiology draft.'));
    } finally {
        createSubmitting.value = false;
    }
}

async function submitCreateOrderBasket() {
    if (
        createSubmitting.value ||
        !canUseCreateOrderBasket.value ||
        createOrderBasket.value.length === 0
    ) {
        return;
    }

    createSubmitting.value = true;
    resetCreateMessages();

    const queuedItems = [...createOrderBasket.value];
    const createdOrders: RadiologyOrder[] = [];
    const orderSessionId = generateClinicalOrderSessionId('radiology-session');

    try {
        for (const item of queuedItems) {
            const response = await apiRequest<{ data: RadiologyOrder }>(
                'POST',
                '/radiology-orders',
                {
                    body: buildCreateRadiologyOrderPayload(item, {
                        orderSessionId,
                    }),
                },
            );

            createdOrders.push(response.data);
        }

        createOrderBasket.value = [];
        resetCreateOrderDraftFields();
        clearPersistedRadiologyCreateDraft();
        createMessage.value = `Created ${createdOrders.length} imaging ${createdOrders.length === 1 ? 'order' : 'orders'} successfully.`;
        if (createMessage.value) notifySuccess(createMessage.value);
        searchForm.q =
            createdOrders.length === 1
                ? createdOrders[0]?.orderNumber?.trim()
                    || createdOrders[0]?.id
                    || ''
                : '';
        searchForm.patientId = createdOrders[0]?.patientId?.trim() || '';
        searchForm.status = 'ordered';
        searchForm.from = today;
        searchForm.to = '';
        searchForm.page = 1;
        setRadiologyWorkspaceView('queue');
        await loadQueue();
        await nextTick();
        focusRadiologyQueueSearch();
    } catch (error) {
        const createdCount = createdOrders.length;
        const failedItem = queuedItems[createdCount] ?? null;
        const remainingItems = queuedItems.slice(createdCount + 1);
        createOrderBasket.value = remainingItems;

        if (failedItem) {
            restoreCreateOrderDraftFromBasketItem(failedItem);
        }

        const apiError = error as ApiError;
        createErrors.value = apiError.payload?.errors ?? {};
        openCreateContextDialogForValidationErrors(createErrors.value);

        if (createdCount > 0) {
            createMessage.value = `Created ${createdCount} imaging ${createdCount === 1 ? 'order' : 'orders'} before the basket paused.`;
        }

        notifyError(
            createdCount > 0
                ? 'Imaging basket paused before all studies were submitted.'
                : messageFromUnknown(error, 'Unable to submit the imaging basket.'),
        );

        if (!hasPendingCreateWorkflow.value) {
            clearPersistedRadiologyCreateDraft();
        }
    } finally {
        createSubmitting.value = false;
    }
}

function openStatusDialog(order: RadiologyOrder, action: 'scheduled' | 'in_progress' | 'completed' | 'cancelled') {
    statusDialogOrder.value = order;
    statusDialogAction.value = action;
    statusDialogReason.value = action === 'cancelled' ? (order.statusReason ?? '') : '';
    statusDialogReportSummary.value = action === 'completed' ? (order.reportSummary ?? '') : '';
    statusDialogError.value = null;
    statusDialogOpen.value = true;

    if (action === 'completed') {
        void refreshRadiologyStatusDialogOrder(order.id);
    }
}

function closeStatusDialog() {
    statusDialogOpen.value = false;
    statusDialogOrder.value = null;
    statusDialogAction.value = null;
    statusDialogReason.value = '';
    statusDialogReportSummary.value = '';
    statusDialogError.value = null;
    statusDialogStockCheckRequestKey.value += 1;
    statusDialogStockCheckLoading.value = false;
    statusDialogStockCheckError.value = null;
}

function applyRadiologyReportTemplate(template: string) {
    statusDialogReportSummary.value = template;
}

const statusDialogStockPrecheck = computed<ClinicalStockPrecheck | null>(
    () =>
        statusDialogAction.value === 'completed'
            ? (statusDialogOrder.value?.stockPrecheck ?? null)
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

async function refreshRadiologyStatusDialogOrder(orderId: string): Promise<void> {
    const requestKey = statusDialogStockCheckRequestKey.value + 1;
    statusDialogStockCheckRequestKey.value = requestKey;
    statusDialogStockCheckLoading.value = true;
    statusDialogStockCheckError.value = null;

    const freshOrder = await fetchRadiologyOrderById(orderId);
    if (statusDialogStockCheckRequestKey.value !== requestKey) {
        return;
    }

    if (freshOrder === null) {
        statusDialogStockCheckError.value =
            'Live stock readiness could not be refreshed. Saving still runs backend stock validation.';
        statusDialogStockCheckLoading.value = false;

        return;
    }

    if (
        statusDialogOpen.value
        && statusDialogAction.value === 'completed'
        && statusDialogOrder.value?.id === orderId
    ) {
        statusDialogOrder.value = freshOrder;

        if (detailsOrder.value?.id === freshOrder.id) {
            detailsOrder.value = freshOrder;
        }
    }

    statusDialogStockCheckLoading.value = false;
}

async function submitStatusDialog() {
    if (!statusDialogOrder.value || !statusDialogAction.value) return;

    if (statusDialogAction.value === 'cancelled' && statusDialogReason.value.trim() === '') {
        statusDialogError.value = 'Cancellation reason is required.';
        return;
    }
    if (statusDialogAction.value === 'completed' && statusDialogReportSummary.value.trim() === '') {
        statusDialogError.value = 'Report summary is required to complete.';
        return;
    }

    statusDialogError.value = null;
    actionLoadingId.value = statusDialogOrder.value.id;

    try {
        const response = await apiRequest<{ data: RadiologyOrder }>('PATCH', `/radiology-orders/${statusDialogOrder.value.id}/status`, {
            body: {
                status: statusDialogAction.value,
                reason: statusDialogReason.value.trim() || null,
                reportSummary: statusDialogReportSummary.value.trim() || null,
            },
        });
        if (detailsOrder.value?.id === response.data.id) {
            detailsOrder.value = response.data;
            void loadDetailsOrder(response.data.id);
            void loadDetailsAuditLogs(response.data.id);
        }
        closeStatusDialog();
        notifySuccess('Radiology status updated.');
        await loadQueue();
    } catch (error) {
        statusDialogError.value = messageFromUnknown(error, 'Unable to update status.');
        notifyError(statusDialogError.value);
    } finally {
        actionLoadingId.value = null;
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

function auditActorLabel(log: RadiologyOrderAuditLog): string {
    const displayName = log.actor?.displayName?.trim();
    if (displayName) return displayName;
    return log.actorId === null || log.actorId === undefined
        ? 'System'
        : `User ID ${log.actorId}`;
}

function auditFieldLabel(value: string): string {
    return value
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function auditValuePreview(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return null;
        return trimmed.length > 48 ? `${trimmed.slice(0, 45)}...` : trimmed;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value.length === 0 ? null : `${value.length} items`;
    }

    return null;
}

function auditObjectEntries(
    value: Record<string, unknown> | unknown[] | null | undefined,
): Array<[string, unknown]> {
    if (!value || Array.isArray(value)) return [];

    return Object.entries(value).filter(([, entryValue]) => {
        if (entryValue === null || entryValue === undefined) return false;
        if (typeof entryValue === 'string' && entryValue.trim() === '') {
            return false;
        }
        if (Array.isArray(entryValue) && entryValue.length === 0) return false;
        return true;
    });
}

function auditLogChangeKeys(log: RadiologyOrderAuditLog): string[] {
    return auditObjectEntries(log.changes)
        .map(([key]) => auditFieldLabel(key))
        .slice(0, 4);
}

function auditLogMetadataPreview(log: RadiologyOrderAuditLog): Array<{
    key: string;
    value: string;
}> {
    return auditObjectEntries(log.metadata)
        .map(([key, value]) => ({
            key: auditFieldLabel(key),
            value: auditValuePreview(value),
        }))
        .filter(
            (entry): entry is { key: string; value: string } =>
                entry.value !== null,
        )
        .slice(0, 3);
}

function auditLogActorTypeLabel(log: RadiologyOrderAuditLog): string {
    if (log.actorType === 'system') return 'System';
    if (log.actorType === 'user') return 'User';
    return log.actorId === null || log.actorId === undefined ? 'System' : 'User';
}

function auditChangeSummary(log: RadiologyOrderAuditLog): string | null {
    const changeCount = auditObjectEntries(log.changes).length;
    if (changeCount > 0) {
        return changeCount === 1
            ? '1 field changed'
            : `${changeCount} fields changed`;
    }

    const action = (log.actionLabel ?? log.action ?? '').trim();
    return action !== '' ? action : null;
}

function auditJsonPreview(value: unknown): string {
    if (value === null || value === undefined) return 'No details recorded.';
    if (typeof value === 'string') return value;

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function isDetailsAuditLogExpanded(logId: string): boolean {
    return Boolean(detailsAuditExpandedLogIds.value[logId]);
}

function toggleDetailsAuditLogExpanded(logId: string) {
    detailsAuditExpandedLogIds.value = {
        ...detailsAuditExpandedLogIds.value,
        [logId]: !detailsAuditExpandedLogIds.value[logId],
    };
}

async function loadDetailsOrder(orderId: string) {
    detailsOrderLoading.value = true;
    detailsOrderError.value = null;

    try {
        const response = await apiRequest<{ data: RadiologyOrder }>(
            'GET',
            `/radiology-orders/${orderId}`,
        );
        detailsOrder.value = response.data;
    } catch (error) {
        detailsOrderError.value = messageFromUnknown(
            error,
            'Unable to refresh radiology order details.',
        );
    } finally {
        detailsOrderLoading.value = false;
    }
}

async function fetchRadiologyOrderById(
    orderId: string,
): Promise<RadiologyOrder | null> {
    try {
        const response = await apiRequest<{ data: RadiologyOrder }>(
            'GET',
            `/radiology-orders/${orderId}`,
        );
        return response.data;
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

async function applyFocusedOrderFromQuery() {
    const orderId = queryParam('focusOrderId').trim();
    const workflowActionKey = queryParam('focusWorkflowActionKey').trim();
    if (!orderId) return;

    let targetOrder = orders.value.find((order) => order.id === orderId) ?? null;
    if (!targetOrder) {
        targetOrder = await fetchRadiologyOrderById(orderId);
    }

    if (targetOrder) {
        openDetails(targetOrder, {
            focusWorkflowActionKey: workflowActionKey,
        });
    } else {
        notifyError('Unable to open the requested imaging order from the patient chart.');
    }

    clearQueryParamFromUrl('focusOrderId');
    clearQueryParamFromUrl('focusWorkflowActionKey');
}

async function loadDetailsAuditLogs(orderId: string) {
    if (!canViewAudit.value) {
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
        detailsAuditLoading.value = false;
        detailsAuditError.value = null;
        return;
    }

    detailsAuditLoading.value = true;
    detailsAuditError.value = null;

    try {
        const response = await apiRequest<RadiologyOrderAuditLogListResponse>('GET', `/radiology-orders/${orderId}/audit-logs`, {
            query: detailsAuditQuery(),
        });
        detailsAuditLogs.value = response.data;
        detailsAuditMeta.value = response.meta;
    } catch (error) {
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
        detailsAuditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
    } finally {
        detailsAuditLoading.value = false;
    }
}

function applyDetailsAuditFilters() {
    if (!detailsOrder.value) return;
    detailsAuditFilters.page = 1;
    void loadDetailsAuditLogs(detailsOrder.value.id);
}

function resetDetailsAuditFilters() {
    if (!detailsOrder.value) return;
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    void loadDetailsAuditLogs(detailsOrder.value.id);
}

function goToDetailsAuditPage(page: number) {
    if (!detailsOrder.value) return;
    detailsAuditFilters.page = Math.max(page, 1);
    void loadDetailsAuditLogs(detailsOrder.value.id);
}

async function exportDetailsAuditLogsCsv() {
    if (!detailsOrder.value || !canViewAudit.value || detailsAuditExporting.value) return;

    detailsAuditExporting.value = true;
    try {
        const url = new URL(`/api/v1/radiology-orders/${detailsOrder.value.id}/audit-logs/export`, window.location.origin);
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

function radiologyDetailsFocusForWorkflowAction(
    actionKey: string | null | undefined,
): {
    sheetTab: 'overview' | 'workflows' | 'audit';
    overviewTab: 'summary' | 'study' | 'reporting';
} {
    const normalizedAction = String(actionKey ?? '').trim();

    if (normalizedAction === 'review_report') {
        return { sheetTab: 'overview', overviewTab: 'reporting' };
    }

    if (normalizedAction === 'review_order') {
        return { sheetTab: 'workflows', overviewTab: 'summary' };
    }

    return { sheetTab: 'overview', overviewTab: 'summary' };
}

function openDetails(
    order: RadiologyOrder,
    options?: { focusWorkflowActionKey?: string | null },
) {
    const focus = radiologyDetailsFocusForWorkflowAction(
        options?.focusWorkflowActionKey,
    );

    detailsOrder.value = order;
    detailsOpen.value = true;
    detailsOrderError.value = null;
    detailsSheetTab.value = focus.sheetTab;
    detailsOverviewTab.value = focus.overviewTab;
    detailsAuditFiltersOpen.value = false;
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    detailsAuditExpandedLogIds.value = {};
    void loadDetailsOrder(order.id);
    void loadDetailsAuditLogs(order.id);
}

function closeDetails() {
    detailsOpen.value = false;
    detailsOrder.value = null;
    detailsOrderLoading.value = false;
    detailsOrderError.value = null;
    detailsSheetTab.value = 'overview';
    detailsOverviewTab.value = 'summary';
    detailsAuditFiltersOpen.value = false;
    detailsAuditLogs.value = [];
    detailsAuditMeta.value = null;
    detailsAuditError.value = null;
    detailsAuditExpandedLogIds.value = {};
}

watch(
    () => searchForm.q,
    (value, previousValue) => {
        const currentQuery = value.trim();
        const previousQuery = (previousValue ?? '').trim();
        if (currentQuery === previousQuery) return;
        clearSearchDebounce();
        searchDebounceTimer = window.setTimeout(() => {
            searchForm.page = 1;
            void loadQueue();
            searchDebounceTimer = null;
        }, 350);
    },
);

watch(
    [() => createForm.radiologyProcedureCatalogItemId, radiologyProcedureCatalogItems],
    () => {
        syncCreateRadiologyProcedureCatalogSelection();
    },
    { immediate: true },
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
            clearCreateAppointmentLink({
                suppressAuto: false,
                focusEditor: false,
            });
            clearCreateAdmissionLink({
                suppressAuto: false,
                focusEditor: false,
            });
            resetCreateContextSuggestions();
            createContextEditorTab.value = 'patient';
            return;
        }

        if (previousPatientId && previousPatientId !== patientId) {
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
        void loadCreateContextSuggestions(patientId);
    },
    { immediate: true },
);

watch(
    () => createForm.appointmentId,
    (value, previousValue) => {
        const appointmentId = value.trim();
        if (appointmentId === (previousValue ?? '').trim()) return;

        if (pendingCreateAppointmentLinkSource !== null) {
            createAppointmentLinkSource.value =
                pendingCreateAppointmentLinkSource;
            pendingCreateAppointmentLinkSource = null;
        } else if (!appointmentId) {
            createAppointmentLinkSource.value = 'none';
        } else if (createAppointmentLinkSource.value !== 'route') {
            createAppointmentLinkSource.value = 'manual';
        }

        void loadCreateAppointmentSummary(appointmentId);
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

        void loadCreateAdmissionSummary(admissionId);
    },
    { immediate: true },
);

watch(createContextDialogOpen, (isOpen) => {
    if (!isOpen) return;

    createContextDialogInitialSelection.patientId = createForm.patientId.trim();
    createContextDialogInitialSelection.appointmentId =
        createForm.appointmentId.trim();
    createContextDialogInitialSelection.admissionId =
        createForm.admissionId.trim();
});

onBeforeUnmount(clearSearchDebounce);

onMounted(async () => {
    await loadScope();
    await refreshPage();
    if (queryParam('tab') === 'new' && canCreate.value) {
        radiologyWorkspaceView.value = 'create';
    }
    await applyFocusedOrderFromQuery();
});
</script>
<template>
    <Head title="Radiology Orders" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">

            <!-- Page header -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="scan-line" class="size-7 text-primary" />
                        Radiology Orders
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Create and track radiology orders across imaging modalities.
                    </p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Badge :variant="scopeWarning ? 'destructive' : 'outline'">
                        {{ scopeStatusLabel }}
                    </Badge>
                    <Button variant="outline" size="sm" :disabled="listLoading" class="gap-1.5" @click="refreshPage">
                        <AppIcon name="activity" class="size-3.5" />
                        {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                    <Button
                        v-if="canCreate && radiologyWorkspaceView === 'queue'"
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="openCreateRadiologyWorkspace"
                    >
                        <AppIcon name="plus" class="size-3.5" />
                        Create order
                    </Button>
                    <Button
                        v-else-if="radiologyWorkspaceView === 'create'"
                        variant="outline"
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="setRadiologyWorkspaceView('queue', { focusSearch: true, scroll: true })"
                    >
                        <AppIcon name="layout-list" class="size-3.5" />
                        Radiology Queue
                    </Button>
                </div>
            </div>

            <Alert v-if="scopeWarning" variant="destructive">
                <AlertTitle>Scope warning</AlertTitle>
                <AlertDescription>{{ scopeWarning }}</AlertDescription>
            </Alert>

            <WalkInServiceRequestsPanel
                ref="radiologyWalkInPanelRef"
                service-type="radiology"
                :enabled="canUpdateServiceRequestStatus"
                panel-title="Walk-in patients awaiting imaging"
                @acknowledged="onRadiologyWalkInAcknowledged"
            />

            <!-- Queue bar -->
            <div
                v-if="canRead && radiologyWorkspaceView === 'queue'"
                class="rounded-lg border bg-muted/30 px-3 py-2"
            >
                <div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                    <div class="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            :class="isRadiologySummaryFilterActive('ordered') ? 'border-primary bg-primary/10' : ''"
                            @click="applyRadiologySummaryFilter('ordered')"
                        >
                            <span class="font-medium text-foreground">{{ queueCountLabel(summaryQueueCounts.ordered) }}</span>
                            <span class="text-muted-foreground">Ordered</span>
                        </button>
                        <button
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            :class="isRadiologySummaryFilterActive('scheduled') ? 'border-primary bg-primary/10' : ''"
                            @click="applyRadiologySummaryFilter('scheduled')"
                        >
                            <span class="font-medium text-foreground">{{ queueCountLabel(summaryQueueCounts.scheduled) }}</span>
                            <span class="text-muted-foreground">Scheduled</span>
                        </button>
                        <button
                            v-if="isRadiologyOperator"
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            :class="isRadiologySummaryFilterActive('in_progress') ? 'border-primary bg-primary/10' : ''"
                            @click="applyRadiologySummaryFilter('in_progress')"
                        >
                            <span class="font-medium text-foreground">{{ queueCountLabel(summaryQueueCounts.inProgress) }}</span>
                            <span class="text-muted-foreground">In Progress</span>
                        </button>
                        <button
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            :class="isRadiologySummaryFilterActive('completed') ? 'border-primary bg-primary/10' : ''"
                            @click="applyRadiologySummaryFilter('completed')"
                        >
                            <span class="font-medium text-foreground">{{ queueCountLabel(summaryQueueCounts.completed) }}</span>
                            <span class="text-muted-foreground">Completed</span>
                        </button>
                        <button
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            :class="isRadiologySummaryFilterActive('cancelled') ? 'border-primary bg-primary/10' : ''"
                            @click="applyRadiologySummaryFilter('cancelled')"
                        >
                            <span class="font-medium text-foreground">{{ queueCountLabel(summaryQueueCounts.cancelled) }}</span>
                            <span class="text-muted-foreground">Cancelled</span>
                        </button>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                        <Select v-model="statusSelectValue">
                            <SelectTrigger class="h-8 w-40 shrink-0 bg-background" size="sm">
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="ordered">Ordered</SelectItem>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem v-if="isRadiologyOperator" value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            v-if="isRadiologyOperator"
                            size="sm"
                            class="h-8 gap-1.5"
                            :variant="radiologyQueuePresetState.queueToday ? 'default' : 'outline'"
                            @click="applyRadiologyQueuePreset('queue_today', { focusSearch: true })"
                        >
                            <AppIcon name="layout-list" class="size-3.5" />
                            Queue Today
                        </Button>
                        <Button
                            size="sm"
                            class="h-8 gap-1.5"
                            :variant="radiologyQueuePresetState.ordered ? 'default' : 'outline'"
                            @click="applyRadiologyQueuePreset('ordered', { focusSearch: true })"
                        >
                            <AppIcon name="clipboard-list" class="size-3.5" />
                            Ordered
                        </Button>
                        <Button
                            v-if="isRadiologyOperator"
                            size="sm"
                            class="h-8 gap-1.5"
                            :variant="radiologyQueuePresetState.inProgress ? 'default' : 'outline'"
                            @click="applyRadiologyQueuePreset('in_progress', { focusSearch: true })"
                        >
                            <AppIcon name="activity" class="size-3.5" />
                            In Progress
                        </Button>
                        <Button
                            size="sm"
                            class="h-8 gap-1.5"
                            :variant="radiologyQueuePresetState.completed ? 'default' : 'outline'"
                            @click="applyRadiologyQueuePreset('completed', { focusSearch: true })"
                        >
                            <AppIcon name="badge-check" class="size-3.5" />
                            Completed
                        </Button>
                    </div>
                </div>
            </div>

            <!-- Errors -->
            <Alert v-if="radiologyWorkspaceView === 'queue' && listErrors.length" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="circle-x" class="size-4" />
                    Request error
                </AlertTitle>
                <AlertDescription>
                    <div class="space-y-1">
                        <p v-for="errorMessage in listErrors" :key="errorMessage" class="text-xs">
                            {{ errorMessage }}
                        </p>
                    </div>
                </AlertDescription>
            </Alert>

            <!-- Radiology queue card -->
            <Card
                v-if="canRead && radiologyWorkspaceView === 'queue'"
                id="radiology-queue-card"
                class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col"
            >
                <CardHeader class="shrink-0 gap-3 pb-3">
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div class="min-w-0 flex-1 space-y-1">
                            <CardTitle class="flex items-center gap-2">
                                <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                                Radiology Orders Queue
                            </CardTitle>
                            <CardDescription>
                                {{ orders.length }} orders on this page &middot; Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                            </CardDescription>
                            <div class="mt-2 flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">
                                    {{ radiologyQueueStateLabel }}
                                </Badge>
                                <Badge v-if="isPatientChartQueueFocusApplied" variant="outline">
                                    Patient chart handoff
                                </Badge>
                                <Badge v-if="radiologyToolbarStateLabel" variant="outline">
                                    {{ radiologyToolbarStateLabel }}
                                </Badge>
                            </div>
                            <p
                                v-if="activeRadiologyPatientSummary"
                                class="text-xs text-muted-foreground"
                            >
                                Patient in focus:
                                {{ patientName(activeRadiologyPatientSummary) }} |
                                No.
                                {{
                                    activeRadiologyPatientSummary.patientNumber ||
                                    shortId(activeRadiologyPatientSummary.id)
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
                                @click="openFullRadiologyQueue"
                            >
                                Open Full Queue
                            </Button>
                            <Button
                                v-else-if="openedFromPatientChart && patientChartQueueRouteContext.patientId"
                                variant="outline"
                                size="sm"
                                @click="refocusRadiologyPatientQueue"
                            >
                                Refocus This Patient
                            </Button>
                        </div>
                    </div>
                    <div class="flex w-full flex-col gap-2 xl:flex-row xl:items-center">
                        <div class="relative min-w-0 flex-1">
                            <AppIcon
                                name="search"
                                class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                            />
                            <Input
                                id="rad-q"
                                ref="radiologyQueueSearchInput"
                                v-model="searchForm.q"
                                placeholder="Search order number, study name, or procedure code"
                                class="h-9 pl-9"
                                @keyup.enter="submitSearch"
                            />
                        </div>
                        <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap">
                            <Select v-model="statusSelectValue">
                                <SelectTrigger
                                    class="h-9 w-full bg-background sm:w-44"
                                    aria-label="Filter radiology orders by status"
                                >
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All statuses</SelectItem>
                                    <SelectItem value="ordered">Ordered</SelectItem>
                                    <SelectItem value="scheduled">Scheduled</SelectItem>
                                    <SelectItem v-if="isRadiologyOperator" value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="sm"
                                class="hidden h-9 gap-1.5 md:inline-flex"
                                @click="advancedFiltersSheetOpen = true"
                            >
                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                All filters
                                <Badge
                                    v-if="activeRadiologyAdvancedFilterCount"
                                    variant="secondary"
                                    class="ml-1 text-[10px]"
                                >
                                    {{ activeRadiologyAdvancedFilterCount }}
                                </Badge>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                class="h-9 gap-1.5 md:hidden"
                                @click="mobileFiltersDrawerOpen = true"
                            >
                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                All filters
                                <Badge
                                    v-if="activeRadiologyAdvancedFilterCount"
                                    variant="secondary"
                                    class="ml-1 text-[10px]"
                                >
                                    {{ activeRadiologyAdvancedFilterCount }}
                                </Badge>
                            </Button>
                            <Popover>
                                <PopoverTrigger as-child>
                                    <Button variant="outline" size="sm" class="h-9 gap-1.5">
                                        <AppIcon name="eye" class="size-3.5" />
                                        View
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" class="w-72 space-y-4">
                                    <div class="grid gap-2">
                                        <Label for="rad-per-page-view">Results per page</Label>
                                        <Select :model-value="searchForm.perPage" @update:model-value="val => { searchForm.perPage = val; submitSearch }">
                                            <SelectTrigger class="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label>Row density</Label>
                                        <div class="grid grid-cols-2 gap-2">
                                            <Button
                                                size="sm"
                                                :variant="compactQueueRows ? 'outline' : 'default'"
                                                @click="compactQueueRows = false"
                                            >
                                                Comfortable
                                            </Button>
                                            <Button
                                                size="sm"
                                                :variant="compactQueueRows ? 'default' : 'outline'"
                                                @click="compactQueueRows = true"
                                            >
                                                Compact
                                            </Button>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                            <Button
                                v-if="hasActiveFilters"
                                variant="ghost"
                                size="sm"
                                class="h-9 gap-1.5"
                                @click="resetFilters"
                            >
                                Reset
                            </Button>
                        </div>
                    </div>
                    <div
                        v-if="activeRadiologyFilterBadgeLabels.length"
                        class="flex flex-wrap items-center gap-1.5 pt-1"
                    >
                        <Badge
                            v-for="label in activeRadiologyFilterBadgeLabels"
                            :key="label"
                            variant="outline"
                            class="h-6 rounded-full px-2.5 text-[10px] font-medium"
                        >
                            {{ label }}
                        </Badge>
                        <Button
                            variant="ghost"
                            size="sm"
                            class="h-6 px-2 text-[11px]"
                            :disabled="listLoading"
                            @click="resetFilters"
                        >
                            Reset
                        </Button>
                    </div>
                </CardHeader>
                <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <div v-if="showRadiologyOperatorDashboard" class="border-y bg-muted/20 px-4 py-3">
                            <div class="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                                <div class="rounded-lg border bg-background p-3">
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="space-y-1">
                                            <p class="text-sm font-medium">
                                                Turnaround dashboard
                                            </p>
                                            <p class="text-xs text-muted-foreground">
                                                Watch the current scheduling load, active imaging work, and average completion time.
                                            </p>
                                        </div>
                                        <Badge variant="outline">
                                            {{ summaryQueueCounts.total }} in scope
                                        </Badge>
                                    </div>
                                    <div class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                        <div class="rounded-md border bg-muted/20 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                Waiting to schedule
                                            </p>
                                            <p class="mt-1 text-sm font-semibold text-foreground">
                                                {{ radiologyTurnaroundDashboard.waitingToSchedule }}
                                            </p>
                                        </div>
                                        <div class="rounded-md border bg-muted/20 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                Scheduled / overdue
                                            </p>
                                            <p class="mt-1 text-sm font-semibold text-foreground">
                                                {{ radiologyTurnaroundDashboard.scheduledReady }}
                                                <span class="text-xs font-medium text-amber-600">
                                                    ({{ radiologyTurnaroundDashboard.overdueScheduled }} overdue)
                                                </span>
                                            </p>
                                        </div>
                                        <div class="rounded-md border bg-muted/20 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                Active imaging
                                            </p>
                                            <p class="mt-1 text-sm font-semibold text-foreground">
                                                {{ radiologyTurnaroundDashboard.activeStudies }}
                                            </p>
                                        </div>
                                        <div class="rounded-md border bg-muted/20 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                Avg turnaround
                                            </p>
                                            <p class="mt-1 text-sm font-semibold text-foreground">
                                                {{
                                                    formatDurationMinutes(
                                                        radiologyTurnaroundDashboard.averageTurnaroundMinutes,
                                                    )
                                                }}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div class="rounded-lg border bg-background p-3">
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="space-y-1">
                                            <p class="text-sm font-medium">
                                                Imaging worklist by modality
                                            </p>
                                            <p class="text-xs text-muted-foreground">
                                                Focus the queue by X-Ray, ultrasound, CT, or MRI without leaving the page.
                                            </p>
                                        </div>
                                        <Badge variant="secondary">
                                            {{ radiologyWorklistByModality.length }} lanes
                                        </Badge>
                                    </div>
                                    <div
                                        v-if="radiologyWorklistByModality.length"
                                        class="mt-3 grid gap-2 sm:grid-cols-2"
                                    >
                                        <button
                                            v-for="lane in radiologyWorklistByModality"
                                            :key="`radiology-modality-lane-${lane.value}`"
                                            type="button"
                                            class="rounded-lg border px-3 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                                            :class="
                                                searchForm.modality === lane.value
                                                    ? 'border-primary bg-primary/5'
                                                    : 'bg-muted/20'
                                            "
                                            @click="applyRadiologyModalityLaneFilter(lane.value)"
                                        >
                                            <div class="flex items-center justify-between gap-2">
                                                <p class="text-sm font-semibold text-foreground">
                                                    {{ lane.label }}
                                                </p>
                                                <Badge variant="outline">
                                                    {{ lane.total }}
                                                </Badge>
                                            </div>
                                            <div class="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                                <span>Ordered {{ lane.ordered }}</span>
                                                <span>Scheduled {{ lane.scheduled }}</span>
                                                <span>Active {{ lane.inProgress }}</span>
                                                <span>Completed {{ lane.completed }}</span>
                                            </div>
                                            <p class="mt-2 text-xs font-medium text-foreground">
                                                {{ lane.nextAction }}
                                            </p>
                                        </button>
                                    </div>
                                    <div
                                        v-else
                                        class="mt-3 rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground"
                                    >
                                        No modality lanes are visible for the current queue scope yet.
                                    </div>
                                </div>
                            </div>
                        </div>
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="min-h-[12rem] p-4" :class="compactQueueRows ? 'space-y-2' : 'space-y-3'">
                                <div v-if="pageLoading || listLoading" class="space-y-2">
                                    <Skeleton class="h-24 w-full" />
                                    <Skeleton class="h-24 w-full" />
                                    <Skeleton class="h-24 w-full" />
                                </div>
                                <div
                                    v-else-if="orders.length === 0"
                                    class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
                                >
                                    No radiology orders found for the current filters.
                                </div>
                                <div v-else :class="compactQueueRows ? 'space-y-2' : 'space-y-3'">
                                    <div
                                        v-for="order in orders"
                                        :key="order.id"
                                        class="rounded-lg border transition-colors"
                                        :class="[compactQueueRows ? 'p-2.5' : 'p-3', orderAccentClass(order.status)]"
                                    >
                                        <div
                                            :class="
                                                compactQueueRows
                                                    ? 'flex flex-col gap-2 md:flex-row md:items-start md:justify-between'
                                                    : 'flex flex-col gap-3 md:flex-row md:items-start md:justify-between'
                                            "
                                        >
                                            <div :class="compactQueueRows ? 'space-y-1.5' : 'space-y-2'">
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <p class="text-sm font-semibold">
                                                        {{ order.orderNumber || 'Radiology Order' }}
                                                    </p>
                                                    <Badge :variant="statusVariant(order.status)">
                                                        {{ formatEnumLabel(order.status) }}
                                                    </Badge>
                                                    <Badge variant="outline">
                                                        {{ formatEnumLabel(order.modality) }}
                                                    </Badge>
                                                </div>
                                                <p class="text-sm font-medium text-foreground">
                                                    {{ order.studyDescription || 'Study not recorded' }}
                                                </p>
                                                <div
                                                    v-if="radiologyQueueMetaItems(order).length"
                                                    class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
                                                >
                                                    <span
                                                        v-for="item in radiologyQueueMetaItems(order)"
                                                        :key="`${order.id}-${item}`"
                                                        class="inline-flex items-center gap-1"
                                                    >
                                                        <span class="inline-flex size-1 rounded-full bg-muted-foreground/40"></span>
                                                        {{ item }}
                                                    </span>
                                                </div>
                                                <p
                                                    v-if="radiologyQueuePreviewForOrder(order)"
                                                    class="line-clamp-1 text-xs text-muted-foreground"
                                                >
                                                    <span class="font-medium text-foreground">
                                                        {{ radiologyQueuePreviewForOrder(order)?.label }}:
                                                    </span>
                                                    {{ radiologyQueuePreviewForOrder(order)?.text }}
                                                </p>
                                                <div
                                                    v-if="radiologyWorkflowSummaryForOrder(order)"
                                                    class="flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                                                    :class="variantSurfaceClass(radiologyWorkflowSummaryForOrder(order)!.variant)"
                                                >
                                                    <Badge
                                                        :variant="radiologyWorkflowSummaryForOrder(order)!.variant"
                                                        class="h-5 px-1.5 text-[10px]"
                                                    >
                                                        {{ radiologyWorkflowSummaryForOrder(order)?.badge }}
                                                    </Badge>
                                                    <span class="font-medium text-foreground">
                                                        {{ radiologyWorkflowSummaryForOrder(order)?.title }}
                                                    </span>
                                                    <span
                                                        v-if="radiologyQueueWorkflowHintForOrder(order)"
                                                        class="text-muted-foreground"
                                                    >
                                                        {{ radiologyQueueWorkflowHintForOrder(order) }}
                                                    </span>
                                                </div>
                                            </div>
                                            <div
                                                :class="
                                                    compactQueueRows
                                                        ? 'flex flex-col items-stretch gap-1.5 md:flex-row md:flex-wrap md:items-start md:max-w-[360px] md:justify-end'
                                                        : 'flex flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-start md:max-w-[360px] md:justify-end'
                                                "
                                            >
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    class="w-full sm:w-auto"
                                                    :disabled="actionLoadingId === order.id"
                                                    @click="openDetails(order)"
                                                >
                                                    {{ canUpdateStatus ? 'Open order' : 'Review' }}
                                                </Button>
                                                <Button
                                                    v-if="canUpdateStatus && order.status === 'ordered'"
                                                    size="sm"
                                                    variant="outline"
                                                    class="w-full sm:w-auto"
                                                    :disabled="actionLoadingId === order.id"
                                                    @click="openStatusDialog(order, 'scheduled')"
                                                >
                                                    {{ actionLoadingId === order.id ? 'Updating...' : 'Schedule' }}
                                                </Button>
                                                <Button
                                                    v-if="canUpdateStatus && order.status === 'scheduled'"
                                                    size="sm"
                                                    class="w-full sm:w-auto"
                                                    :disabled="actionLoadingId === order.id"
                                                    @click="openStatusDialog(order, 'in_progress')"
                                                >
                                                    {{ actionLoadingId === order.id ? 'Updating...' : 'Start Imaging' }}
                                                </Button>
                                                <Button
                                                    v-if="canUpdateStatus && order.status === 'in_progress'"
                                                    size="sm"
                                                    class="w-full sm:w-auto"
                                                    :disabled="actionLoadingId === order.id"
                                                    @click="openStatusDialog(order, 'completed')"
                                                >
                                                    {{ actionLoadingId === order.id ? 'Updating...' : 'Complete + Report' }}
                                                </Button>
                                                <DropdownMenu
                                                    v-if="canUpdateStatus && order.status !== 'completed' && order.status !== 'cancelled'"
                                                >
                                                    <DropdownMenuTrigger :as-child="true">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            class="w-full sm:w-auto"
                                                            :disabled="actionLoadingId === order.id"
                                                        >
                                                            Exceptions
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" class="w-44">
                                                        <DropdownMenuItem
                                                            class="text-destructive focus:text-destructive"
                                                            :disabled="actionLoadingId === order.id"
                                                            @select.prevent="openStatusDialog(order, 'cancelled')"
                                                        >
                                                            Cancel Order
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                        <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
                            <p class="text-xs text-muted-foreground">
                                Showing {{ orders.length }} of {{ pagination?.total ?? 0 }} results &middot; Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                            </p>
                            <div class="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="!pagination || pagination.currentPage <= 1 || listLoading"
                                    @click="prevPage"
                                >
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="!pagination || pagination.currentPage >= pagination.lastPage || listLoading"
                                    @click="nextPage"
                                >
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                    Next
                                </Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>

                <!-- No read permission -->
                <Card
                    v-else-if="!pageLoading && radiologyWorkspaceView === 'queue'"
                    class="rounded-lg border-sidebar-border/70"
                >
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="shield-check" class="size-4 text-muted-foreground" />
                            Radiology Queue
                        </CardTitle>
                        <CardDescription>You do not have permission to view radiology queues.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle class="flex items-center gap-2">
                                <AppIcon name="shield-check" class="size-4" />
                                Read access restricted
                            </AlertTitle>
                            <AlertDescription>
                                Request <code>radiology.orders.read</code> permission to open radiology list and queue filters.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                <!-- Create Radiology Order card -->
                <Card
                    v-if="canCreate && radiologyWorkspaceView === 'create'"
                    id="create-radiology-order"
                    class="rounded-lg border-sidebar-border/70"
                >
                    <CardHeader>
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div class="space-y-1.5">
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="plus" class="size-5 text-muted-foreground" />
                                    Create Radiology Order
                                </CardTitle>
                                <CardDescription>
                                    Use consultation or inpatient context when available, then submit the imaging request.
                                </CardDescription>
                            </div>

                        </div>
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
                                            ? 'Loading the original imaging order so we can prefill this follow-up request safely.'
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
                        <div
                            v-if="showClinicalHandoffBanner"
                            class="rounded-lg border bg-muted/10 p-4"
                        >
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Clinical handoff</p>
                                    <p class="text-xs text-muted-foreground">
                                        {{
                                            createPatientContextLocked
                                                ? 'This order opened from a clinical workflow. Patient stays locked until you choose a different patient.'
                                                : 'Review or remove the carried-forward appointment or admission context before ordering imaging.'
                                        }}
                                    </p>
                                </div>
                                <div class="flex flex-wrap gap-2">
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
                                        <Link
                                            :href="`/appointments?focusAppointmentId=${encodeURIComponent(createForm.appointmentId)}`"
                                        >
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
                                    <Button
                                        v-if="createPatientContextLocked"
                                        variant="outline"
                                        size="sm"
                                        :disabled="hasCreateOrderBasketItems"
                                        @click="unlockCreatePatientContext"
                                    >
                                        Change Patient
                                    </Button>
                                    <Button
                                        v-else-if="createForm.appointmentId || createForm.admissionId"
                                        variant="outline"
                                        size="sm"
                                        :disabled="hasCreateOrderBasketItems"
                                        @click="clearCreateClinicalLinks"
                                    >
                                        Unlink Clinical Context
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-lg border bg-muted/20 p-3">
                            <div class="flex flex-col gap-3">
                                <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="min-w-0 space-y-1.5">
                                        <p class="text-sm font-medium">Patient & order context</p>
                                        <p class="text-xs text-muted-foreground">
                                            {{ createOrderContextSummary }}
                                        </p>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Button
                                            id="rad-open-context-dialog"
                                            variant="outline"
                                            size="sm"
                                            class="gap-1.5"
                                            :disabled="hasCreateOrderBasketItems"
                                            @click="
                                                openCreateContextDialog(
                                                    createPatientContextLocked
                                                        ? 'patient'
                                                        : hasCreateAppointmentContext
                                                          ? 'appointment'
                                                          : hasCreateAdmissionContext
                                                            ? 'admission'
                                                            : 'patient',
                                                    {
                                                        unlockPatient:
                                                            createPatientContextLocked,
                                                    },
                                                )
                                            "
                                        >
                                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                                            {{
                                                createPatientContextLocked
                                                    ? 'Change patient'
                                                    : 'Review or change context'
                                            }}
                                        </Button>
                                    </div>
                                </div>
                                <div class="grid gap-2 lg:grid-cols-3">
                                    <div
                                        class="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2"
                                        :class="
                                            createForm.patientId
                                                ? 'border-primary/30 bg-primary/5'
                                                : 'bg-background/80'
                                        "
                                    >
                                        <AppIcon name="user" class="size-3.5 shrink-0 text-muted-foreground" />
                                        <div class="min-w-0 flex-1">
                                            <div class="flex min-w-0 items-center gap-2">
                                                <span class="shrink-0 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
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
                                        <Badge
                                            v-if="createPatientContextLocked"
                                            variant="secondary"
                                            class="shrink-0 text-[10px]"
                                        >
                                            Locked
                                        </Badge>
                                    </div>
                                    <div
                                        class="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2"
                                        :class="
                                            hasCreateAppointmentContext
                                                ? 'border-primary/30 bg-primary/5'
                                                : 'bg-background/80'
                                        "
                                    >
                                        <AppIcon name="calendar-clock" class="size-3.5 shrink-0 text-muted-foreground" />
                                        <div class="min-w-0 flex-1">
                                            <div class="flex min-w-0 items-center gap-2">
                                                <span class="shrink-0 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                                                    Appointment
                                                </span>
                                                <span
                                                    class="truncate text-sm font-medium"
                                                    :title="[createAppointmentContextLabel, createAppointmentContextMeta, createAppointmentContextReason].filter(Boolean).join(' | ')"
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
                                    <div
                                        class="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2"
                                        :class="
                                            hasCreateAdmissionContext
                                                ? 'border-primary/30 bg-primary/5'
                                                : 'bg-background/80'
                                        "
                                    >
                                        <AppIcon name="bed-double" class="size-3.5 shrink-0 text-muted-foreground" />
                                        <div class="min-w-0 flex-1">
                                            <div class="flex min-w-0 items-center gap-2">
                                                <span class="shrink-0 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                                                    Admission
                                                </span>
                                                <span
                                                    class="truncate text-sm font-medium"
                                                    :title="[createAdmissionContextLabel, createAdmissionContextMeta, createAdmissionContextReason].filter(Boolean).join(' | ')"
                                                >
                                                    {{ createAdmissionContextLabel }}
                                                </span>
                                            </div>
                                        </div>
                                        <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                                            <Badge
                                                v-if="createAdmissionContextStatusLabel"
                                                :variant="createAdmissionContextStatusVariant"
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
                                </div>
                            </div>
                        </div>

                        <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
                            <div class="rounded-lg border bg-background p-4">
                                <div class="space-y-4">
                                    <div class="space-y-1">
                                        <p class="text-sm font-medium">
                                            Requested study
                                        </p>
                                        <p class="text-xs text-muted-foreground">
                                            Use the governed imaging procedure catalog so the modality, body region, contrast guidance, study name, and procedure code stay canonical.
                                        </p>
                                        <div
                                            v-if="radiologyProcedureCatalogItems.length"
                                            class="flex flex-wrap gap-2 pt-1"
                                        >
                                            <Badge
                                                v-for="category in createRadiologyProcedureCategorySummary"
                                                :key="`rad-create-catalog-category-${category.label}`"
                                                variant="secondary"
                                                class="rounded-full px-2.5 py-0.5 text-[11px]"
                                            >
                                                {{ category.label }}
                                                {{ category.count }}
                                            </Badge>
                                        </div>
                                    </div>

                                    <SearchableSelectField
                                        input-id="rad-create-procedure-catalog"
                                        v-model="createForm.radiologyProcedureCatalogItemId"
                                        label="Imaging procedure"
                                        :options="createRadiologyProcedureCatalogOptions"
                                        placeholder="Select a catalog radiology procedure"
                                        search-placeholder="Search by study name, code, modality, or body region"
                                        :helper-text="createRadiologyProcedureCatalogHelperText"
                                        :error-message="createRadiologyProcedurePickerError"
                                        empty-text="No active radiology procedure matched that search."
                                        :required="true"
                                        :disabled="
                                            radiologyProcedureCatalogLoading ||
                                            !canReadRadiologyProcedureCatalog
                                        "
                                    />

                                    <div
                                        v-if="radiologyProcedureCatalogLoading"
                                        class="rounded-lg border bg-muted/20 p-3"
                                    >
                                        <div class="space-y-2">
                                            <Skeleton class="h-4 w-32" />
                                            <Skeleton class="h-9 w-full" />
                                            <Skeleton class="h-4 w-2/3" />
                                        </div>
                                    </div>

                                    <Alert
                                        v-else-if="radiologyProcedureCatalogError"
                                        variant="destructive"
                                        class="border-destructive/40 bg-destructive/5"
                                    >
                                        <AppIcon
                                            name="triangle-alert"
                                            class="size-4"
                                        />
                                        <AlertTitle
                                            >Procedure catalog unavailable</AlertTitle
                                        >
                                        <AlertDescription
                                            class="space-y-3"
                                        >
                                            <p>
                                                {{ radiologyProcedureCatalogError }}
                                            </p>
                                            <div
                                                class="flex flex-wrap items-center gap-2"
                                            >
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    @click="
                                                        void loadRadiologyProcedureCatalog(
                                                            true,
                                                        )
                                                    "
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

                                    <Alert
                                        v-else-if="
                                            isRadiologyProcedureCatalogReadPermissionResolved &&
                                            !canReadRadiologyProcedureCatalog
                                        "
                                        class="border-amber-500/40 bg-amber-500/5 px-3 py-2"
                                    >
                                        <AppIcon
                                            name="shield-alert"
                                            class="size-3.5 shrink-0"
                                        />
                                        <AlertDescription class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs sm:text-sm">
                                            <span class="font-medium text-foreground">Catalog access required.</span>
                                            <span>Grant</span>
                                            <code class="rounded bg-background/80 px-1.5 py-0.5 text-[11px] sm:text-xs">platform.clinical-catalog.read</code>
                                            <span>to use this workspace.</span>
                                        </AlertDescription>
                                    </Alert>

                                    <Alert
                                        v-else-if="
                                            !radiologyProcedureCatalogItems.length
                                        "
                                        class="border-border bg-muted/20"
                                    >
                                        <AppIcon
                                            name="book-open-text"
                                            class="size-4"
                                        />
                                        <AlertTitle
                                            >No active radiology procedures found</AlertTitle
                                        >
                                        <AlertDescription
                                            class="space-y-2"
                                        >
                                            <p>
                                                Add or reactivate imaging procedures before creating orders from this workspace.
                                            </p>
                                            <Link
                                                href="/platform/admin/clinical-catalogs"
                                                class="text-xs font-medium text-foreground underline underline-offset-4"
                                            >
                                                Open Clinical Catalogs
                                            </Link>
                                        </AlertDescription>
                                    </Alert>

                                    <div class="grid gap-2">
                                        <Label for="rad-create-indication"
                                            >Clinical indication</Label
                                        >
                                        <Textarea
                                            id="rad-create-indication"
                                            v-model="createForm.clinicalIndication"
                                            placeholder="Symptoms, urgency context, suspected diagnosis, or what the imaging team should focus on..."
                                            class="min-h-28"
                                        />
                                        <p
                                            v-if="
                                                createFieldError(
                                                    'clinicalIndication',
                                                )
                                            "
                                            class="text-xs text-destructive"
                                        >
                                            {{
                                                createFieldError(
                                                    'clinicalIndication',
                                                )
                                            }}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div class="rounded-lg border bg-muted/20 p-4">
                                <div
                                    class="flex items-start justify-between gap-3"
                                >
                                    <div class="space-y-1">
                                        <p
                                            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                                        >
                                            Selection sync
                                        </p>
                                        <p class="text-sm font-semibold">
                                            {{
                                                selectedCreateRadiologyProcedureCatalogItem?.name ||
                                                'Select a radiology procedure'
                                            }}
                                        </p>
                                    </div>
                                    <Badge variant="outline">
                                        {{
                                            selectedCreateRadiologyProcedureCatalogItem
                                                ? 'Catalog linked'
                                                : 'Required'
                                        }}
                                    </Badge>
                                </div>

                                <div class="mt-4 space-y-3 text-xs">
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <div
                                            class="rounded-md border bg-background px-3 py-2"
                                        >
                                            <p
                                                class="text-[11px] uppercase tracking-wide text-muted-foreground"
                                            >
                                                Procedure code
                                            </p>
                                            <p
                                                class="mt-1 break-words font-medium text-foreground"
                                            >
                                                {{
                                                    createForm.procedureCode ||
                                                    'Will sync from selection'
                                                }}
                                            </p>
                                        </div>
                                        <div
                                            class="rounded-md border bg-background px-3 py-2"
                                        >
                                            <p
                                                class="text-[11px] uppercase tracking-wide text-muted-foreground"
                                            >
                                                Modality
                                            </p>
                                            <p class="mt-1 font-medium text-foreground">
                                                {{
                                                    selectedCreateRadiologyProcedureModalityLabel
                                                }}
                                            </p>
                                        </div>
                                        <div
                                            class="rounded-md border bg-background px-3 py-2"
                                        >
                                            <p
                                                class="text-[11px] uppercase tracking-wide text-muted-foreground"
                                            >
                                                Body region
                                            </p>
                                            <p class="mt-1 font-medium text-foreground">
                                                {{
                                                    selectedCreateRadiologyProcedureBodyRegionLabel
                                                }}
                                            </p>
                                        </div>
                                        <div
                                            class="rounded-md border bg-background px-3 py-2"
                                        >
                                            <p
                                                class="text-[11px] uppercase tracking-wide text-muted-foreground"
                                            >
                                                Contrast
                                            </p>
                                            <p class="mt-1 font-medium text-foreground">
                                                {{
                                                    selectedCreateRadiologyProcedureContrastLabel
                                                }}
                                            </p>
                                        </div>
                                    </div>

                                    <div
                                        class="rounded-md border bg-background px-3 py-2 text-muted-foreground"
                                    >
                                        {{
                                            selectedCreateRadiologyProcedureCatalogItem?.description ||
                                            'The selected procedure keeps radiology orders aligned to the governed study code, study name, modality, body region, and contrast expectations.'
                                        }}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div
                            v-if="!hasCreateLifecycleMode"
                            class="rounded-lg border bg-background p-4"
                        >
                            <div class="space-y-4">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">
                                        Scheduling
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        Add a requested imaging time only when it is already known. The system stamps the actual order time when you submit.
                                    </p>
                                </div>
                                <div class="grid gap-3">
                                    <div class="grid gap-2">
                                        <Label for="rad-create-scheduled-for"
                                            >Requested schedule</Label
                                        >
                                        <Input
                                            id="rad-create-scheduled-for"
                                            v-model="createForm.scheduledFor"
                                            type="datetime-local"
                                        />
                                        <p
                                            v-if="
                                                createFieldError(
                                                    'scheduledFor',
                                                )
                                            "
                                            class="text-xs text-destructive"
                                        >
                                            {{
                                                createFieldError(
                                                    'scheduledFor',
                                                )
                                            }}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="rounded-lg border bg-background p-4">
                            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Imaging basket</p>
                                    <p class="text-xs text-muted-foreground">
                                        Queue several studies for the same patient, then submit them together without rebuilding the encounter context.
                                    </p>
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    <Badge
                                        v-if="hasCreateOrderBasketItems"
                                        variant="secondary"
                                        class="text-[10px]"
                                    >
                                        {{ createOrderBasketCountLabel }}
                                    </Badge>
                                    <Button
                                        v-if="hasCreateOrderBasketItems"
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        class="gap-1.5"
                                        :disabled="createSubmitting"
                                        @click="clearCreateOrderBasket"
                                    >
                                        <AppIcon name="circle-x" class="size-3.5" />
                                        Clear basket
                                    </Button>
                                </div>
                            </div>

                            <div
                                v-if="hasCreateOrderBasketItems"
                                class="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3"
                            >
                                <div
                                    v-for="item in createOrderBasket"
                                    :key="item.clientKey"
                                    class="flex h-full flex-col rounded-lg border bg-muted/10 px-2.5 py-2"
                                >
                                    <div class="flex h-full flex-col gap-1.5">
                                        <div class="flex items-start justify-between gap-2">
                                            <div class="min-w-0 space-y-0.5">
                                                <p
                                                    class="truncate text-sm font-medium leading-5 text-foreground"
                                                    :title="item.studyDescription || item.procedureCode"
                                                >
                                                    {{ item.studyDescription || item.procedureCode }}
                                                </p>
                                                <div class="flex flex-wrap gap-1 text-[11px]">
                                                    <Badge
                                                        variant="secondary"
                                                        class="px-1.5 py-0 text-[10px]"
                                                    >
                                                        Code {{ item.procedureCode || 'Pending' }}
                                                    </Badge>
                                                    <Badge
                                                        variant="outline"
                                                        class="px-1.5 py-0 text-[10px]"
                                                    >
                                                        {{ formatEnumLabel(item.modality || 'other') }}
                                                    </Badge>
                                                    <Badge
                                                        v-if="item.scheduledFor"
                                                        variant="outline"
                                                        class="px-1.5 py-0 text-[10px]"
                                                    >
                                                        {{ formatDateTime(item.scheduledFor) }}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                class="h-6 px-1.5 text-[10px]"
                                                :disabled="createSubmitting"
                                                @click="
                                                    removeCreateOrderBasketItem(
                                                        item.clientKey,
                                                    )
                                                "
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                        <div
                                            v-if="item.clinicalIndication"
                                            class="rounded-md bg-background/70 px-2 py-1.5"
                                        >
                                            <p
                                                class="text-[11px] leading-4 text-muted-foreground"
                                                :title="item.clinicalIndication"
                                            >
                                                <span class="font-medium">Indication:</span>
                                                {{ item.clinicalIndication }}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p
                                v-if="hasCreateLifecycleMode"
                                class="mt-3 text-xs text-muted-foreground"
                            >
                                Replacement and linked follow-up imaging orders are submitted one at a time, so basket mode is unavailable while this follow-up request is active.
                            </p>
                            <p
                                v-else-if="
                                    hasCreateOrderBasketItems &&
                                    hasPendingCurrentCreateOrderDraft
                                "
                                class="mt-3 text-xs text-muted-foreground"
                            >
                                {{
                                    hasSavedCreateDraft
                                        ? 'A saved draft is not in the basket. Sign it or discard it before submitting.'
                                        : 'The current draft is not in the basket yet. Add it first, or discard it before submitting.'
                                }}
                            </p>
                            <p
                                v-else-if="!hasCreateOrderBasketItems"
                                class="mt-3 text-xs text-muted-foreground"
                            >
                                Basket is empty. Add one or more studies, then submit them together.
                            </p>
                        </div>
                        <Separator />
                        <div class="flex flex-wrap items-center justify-end gap-2">
                            <Alert v-if="createMessage" class="w-full">
                                <AlertTitle>Created</AlertTitle>
                                <AlertDescription>{{ createMessage }}</AlertDescription>
                            </Alert>
                            <Button
                                v-if="hasCreateFeedback"
                                variant="outline"
                                size="sm"
                                class="gap-1.5"
                                :disabled="createSubmitting"
                                @click="resetCreateMessages"
                            >
                                <AppIcon name="circle-x" class="size-3.5" />
                                Dismiss alerts
                            </Button>
                            <Button
                                v-if="showSaveCreateDraftAction"
                                type="button"
                                variant="outline"
                                class="gap-1.5"
                                :disabled="
                                    createSubmitting ||
                                    (
                                        hasCreateLifecycleMode &&
                                        (
                                            createLifecycleSourceLoading ||
                                            createLifecycleSourceOrder === null
                                        )
                                    )
                                "
                                @click="saveCreateDraft"
                            >
                                <AppIcon name="save" class="size-3.5" />
                                {{ saveCreateDraftLabel }}
                            </Button>
                            <Button
                                v-if="hasSavedCreateDraft"
                                type="button"
                                variant="outline"
                                class="gap-1.5"
                                :disabled="createSubmitting"
                                @click="discardSavedCreateDraft"
                            >
                                <AppIcon name="trash" class="size-3.5" />
                                Discard saved draft
                            </Button>
                            <Button
                                v-if="canUseCreateOrderBasket"
                                type="button"
                                variant="outline"
                                class="gap-1.5"
                                :disabled="createOrderActionDisabled || hasSavedCreateDraft"
                                @click="addCurrentCreateOrderToBasket"
                            >
                                <AppIcon name="plus" class="size-3.5" />
                                {{
                                    hasCreateOrderBasketItems
                                        ? 'Add current study'
                                        : 'Add to basket'
                                }}
                            </Button>
                            <Button
                                v-if="
                                    !hasCreateLifecycleMode &&
                                    hasCreateOrderBasketItems &&
                                    hasPendingCurrentCreateOrderDraft &&
                                    !hasSavedCreateDraft
                                "
                                type="button"
                                variant="ghost"
                                class="gap-1.5"
                                :disabled="createSubmitting"
                                @click="discardCurrentCreateOrderDraft"
                            >
                                <AppIcon name="circle-x" class="size-3.5" />
                                Discard current draft
                            </Button>
                            <Button
                                :disabled="
                                    useSingleCreateOrderAction
                                        ? createOrderActionDisabled
                                        : submitCreateOrderBasketDisabled
                                "
                                class="gap-1.5"
                                @click="
                                    useSingleCreateOrderAction
                                        ? createOrder()
                                        : submitCreateOrderBasket()
                                "
                            >
                                <AppIcon name="plus" class="size-3.5" />
                                {{ createOrderPrimaryActionLabel }}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                <Card
                    v-else-if="
                        radiologyWorkspaceView === 'create' &&
                        !isRadiologyCreatePermissionResolved
                    "
                    class="rounded-lg border-sidebar-border/70"
                >
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="activity" class="size-4 text-muted-foreground" />
                            Checking Radiology Access
                        </CardTitle>
                        <CardDescription>
                            Loading the radiology ordering workspace permissions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div class="space-y-2">
                            <div class="h-4 w-40 rounded bg-muted/70" />
                            <div class="h-4 w-full rounded bg-muted/50" />
                            <div class="h-4 w-2/3 rounded bg-muted/50" />
                        </div>
                    </CardContent>
                </Card>
                <Card
                    v-else-if="
                        radiologyWorkspaceView === 'create' &&
                        isRadiologyCreatePermissionResolved
                    "
                    class="rounded-lg border-sidebar-border/70"
                >
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="shield-check" class="size-4 text-muted-foreground" />
                            Create Radiology Order
                        </CardTitle>
                        <CardDescription>You do not have permission to create radiology orders.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle class="flex items-center gap-2">
                                <AppIcon name="shield-check" class="size-4" />
                                Create access restricted
                            </AlertTitle>
                            <AlertDescription>
                                Request <code>radiology.orders.create</code> permission to open the radiology ordering workspace.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

            <!-- Care workflow footer -->
            <div
                v-if="
                    canRead &&
                    radiologyWorkspaceView === 'queue' &&
                    showRadiologyCareWorkflowFooter
                "
                class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-2.5"
            >
                <span class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <AppIcon name="activity" class="size-3.5" />
                    Related workflows
                </span>
                <Button
                    v-if="canReadMedicalRecords && createForm.patientId.trim()"
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
                    v-if="canReadLaboratoryOrders && createForm.patientId.trim()"
                    size="sm"
                    variant="outline"
                    as-child
                    class="gap-1.5"
                >
                    <Link :href="contextCreateHref('/laboratory-orders', { includeTabNew: true })">
                        <AppIcon name="flask-conical" class="size-3.5" />
                        New Lab Order
                    </Link>
                </Button>
                <Button
                    v-if="canCreateTheatreProcedures && createForm.patientId.trim()"
                    size="sm"
                    variant="outline"
                    as-child
                    class="gap-1.5"
                >
                    <Link :href="contextCreateHref('/theatre-procedures', { includeTabNew: true })">
                        <AppIcon name="scissors" class="size-3.5" />
                        Schedule Procedure
                    </Link>
                </Button>
                <Button
                    v-if="canReadBillingInvoices && createForm.patientId.trim()"
                    size="sm"
                    variant="outline"
                    as-child
                    class="gap-1.5"
                >
                    <Link :href="contextCreateHref('/billing-invoices', { includeTabNew: true })">
                        <AppIcon name="receipt" class="size-3.5" />
                        New Billing Invoice
                    </Link>
                </Button>
            </div>

            <Sheet
                v-if="canRead && radiologyWorkspaceView === 'queue'"
                :open="advancedFiltersSheetOpen"
                @update:open="advancedFiltersSheetOpen = $event"
            >
                <SheetContent side="right" variant="action" size="lg">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            All filters
                        </SheetTitle>
                        <SheetDescription>
                            Refine the radiology queue by patient, modality, and ordered date range.
                        </SheetDescription>
                    </SheetHeader>
                    <div class="grid gap-4 px-4 py-4">
                        <PatientLookupField
                            input-id="rad-filter-patient-id-sheet"
                            v-model="searchForm.patientId"
                            label="Patient filter"
                            mode="filter"
                            placeholder="Patient name or number"
                            :helper-text="patientChartQueueFocusLocked ? 'Patient scope is locked from the patient chart. Use Open Full Queue to review other patients.' : 'Optional exact patient filter.'"
                            :disabled="patientChartQueueFocusLocked"
                        />
                        <div class="grid gap-2">
                            <Label for="rad-modality-sheet">Modality</Label>
                            <Select v-model="searchForm.modality">
                                <SelectTrigger class="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem value="">All</SelectItem>
                                <SelectItem v-for="option in modalityOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DateRangeFilterPopover
                            input-base-id="rad-ordered-date-range-sheet"
                            title="Ordered date range"
                            helper-text="From / to for radiology queue review."
                            from-label="From"
                            to-label="To"
                            inline
                            :number-of-months="1"
                            v-model:from="searchForm.from"
                            v-model:to="searchForm.to"
                        />
                    </div>
                    <SheetFooter class="gap-2">
                        <Button variant="outline" @click="resetFiltersFromFiltersSheet">
                            Reset
                        </Button>
                        <Button :disabled="listLoading" @click="submitSearchFromFiltersSheet">
                            Apply filters
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Mobile filters Drawer -->
            <Drawer
                v-if="canRead && radiologyWorkspaceView === 'queue'"
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
                            Search, filter, and adjust queue view settings without leaving the radiology list.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div class="space-y-4 overflow-y-auto px-4 pb-2">
                        <div class="rounded-lg border p-3">
                            <div class="mb-3">
                                <p class="text-sm font-medium">Search & status</p>
                                <p class="text-xs text-muted-foreground">
                                    Search by order number or study, then narrow by current queue stage.
                                </p>
                            </div>
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="rad-q-mobile">Order search</Label>
                                    <Input
                                        id="rad-q-mobile"
                                        v-model="searchForm.q"
                                        placeholder="Order number, study description, or code"
                                        @keyup.enter="submitSearchFromMobileDrawer"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="rad-status-mobile">Status</Label>
                                    <Select v-model="searchForm.status">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">All</SelectItem>
                                        <SelectItem value="ordered">Ordered</SelectItem>
                                        <SelectItem value="scheduled">Scheduled</SelectItem>
                                        <SelectItem v-if="isRadiologyOperator" value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-lg border p-3">
                            <div class="mb-3">
                                <p class="text-sm font-medium">Advanced filters</p>
                                <p class="text-xs text-muted-foreground">
                                    Filter by patient, modality, and ordered date range.
                                </p>
                            </div>
                            <div class="grid gap-3">
                                <PatientLookupField
                                    input-id="rad-filter-patient-id-mobile"
                                    v-model="searchForm.patientId"
                                    label="Patient filter"
                                    placeholder="Search patient by name or patient number"
                                    mode="filter"
                                    :helper-text="patientChartQueueFocusLocked ? 'Patient scope is locked from the patient chart. Use Open Full Queue to review other patients.' : 'Optional exact patient filter.'"
                                    :disabled="patientChartQueueFocusLocked"
                                />
                                <div class="grid gap-2">
                                    <Label for="rad-modality-mobile">Modality</Label>
                                    <Select v-model="searchForm.modality">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">All</SelectItem>
                                        <SelectItem v-for="option in modalityOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <DateRangeFilterPopover
                                    input-base-id="rad-ordered-date-range-mobile"
                                    title="Ordered date range"
                                    from-label="From"
                                    to-label="To"
                                    v-model:from="searchForm.from"
                                    v-model:to="searchForm.to"
                                />
                            </div>
                        </div>

                        <div class="rounded-lg border p-3">
                            <div class="mb-2">
                                <p class="text-sm font-medium">Results & view</p>
                                <p class="text-xs text-muted-foreground">
                                    Adjust result count and row density for busy radiology queues.
                                </p>
                            </div>
                            <div class="grid gap-2">
                                <Label for="rad-per-page-mobile">Results per page</Label>
                                <Select v-model="searchForm.perPage">
                                    <SelectTrigger class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="mt-3 grid gap-2">
                                <Label>Row density</Label>
                                <div class="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        :variant="compactQueueRows ? 'outline' : 'default'"
                                        @click="compactQueueRows = false"
                                    >
                                        Comfortable
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        :variant="compactQueueRows ? 'default' : 'outline'"
                                        @click="compactQueueRows = true"
                                    >
                                        Compact
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DrawerFooter class="gap-2">
                        <Button class="gap-1.5" :disabled="listLoading" @click="submitSearchFromMobileDrawer">
                            <AppIcon name="search" class="size-3.5" />
                            Apply filters
                        </Button>
                        <Button
                            variant="outline"
                            :disabled="listLoading && !hasActiveFilters"
                            @click="resetFiltersFromMobileDrawer"
                        >
                            Reset filters
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            <!-- Details Sheet -->
            <Sheet :open="detailsOpen" @update:open="(open) => (open ? (detailsOpen = true) : closeDetails())">
                <SheetContent side="right" variant="workspace">
                    <div class="flex h-full flex-col overflow-hidden">
                        <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                            <template v-if="detailsOrder">
                                <div class="space-y-4 text-left">
                                    <div class="flex flex-wrap items-start justify-between gap-3">
                                        <div class="min-w-0">
                                            <SheetTitle class="text-left">
                                                {{ detailsOrder.orderNumber || 'Radiology Order' }}
                                            </SheetTitle>
                                            <SheetDescription class="mt-1 text-left">
                                                {{ detailsOrder.studyDescription || 'No study description recorded yet.' }}
                                            </SheetDescription>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Badge v-if="detailsOrderLoading" variant="secondary">Refreshing...</Badge>
                                            <Badge :variant="statusVariant(detailsOrder.status)">
                                                {{ formatEnumLabel(detailsOrder.status) }}
                                            </Badge>
                                            <Badge variant="outline">
                                                {{ formatEnumLabel(detailsOrder.modality) }}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div class="grid gap-3 sm:grid-cols-3">
                                        <div class="rounded-lg border bg-muted/20 p-3">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ordered</p>
                                            <p class="mt-2 text-sm font-medium text-foreground">
                                                {{ formatDateTime(detailsOrder.orderedAt) }}
                                            </p>
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 p-3">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requested schedule</p>
                                            <p class="mt-2 text-sm font-medium text-foreground">
                                                {{ formatDateTime(detailsOrder.scheduledFor) }}
                                            </p>
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 p-3">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Encounter handoff</p>
                                            <p class="mt-2 text-sm font-medium text-foreground">
                                                {{ radiologyOrderEncounterLabel(detailsOrder) }}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </template>
                            <template v-else>
                                <SheetTitle>Radiology Order Details</SheetTitle>
                                <SheetDescription>Order details and audit trail.</SheetDescription>
                            </template>
                        </SheetHeader>
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="space-y-4 p-6">
                                <Alert v-if="detailsOrderError" variant="destructive">
                                    <AlertTitle>Details unavailable</AlertTitle>
                                    <AlertDescription>{{ detailsOrderError }}</AlertDescription>
                                </Alert>
                                <div v-if="!detailsOrder" class="space-y-3">
                                    <Skeleton class="h-24 w-full" />
                                    <Skeleton class="h-24 w-full" />
                                    <Skeleton class="h-24 w-full" />
                                </div>
                                <Tabs v-else v-model="detailsSheetTab" class="w-full space-y-4">
                                    <TabsList class="grid h-auto w-full grid-cols-3">
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
                                    <TabsContent value="overview" class="mt-0">
                                        <div class="space-y-4">
                                            <div class="grid gap-1 sm:grid-cols-3">
                                                <Button
                                                    size="sm"
                                                    :variant="detailsOverviewTab === 'summary' ? 'default' : 'ghost'"
                                                    class="h-8 justify-start gap-1.5 rounded-md px-2.5 text-xs sm:text-sm"
                                                    @click="detailsOverviewTab = 'summary'"
                                                >
                                                    <AppIcon name="layout-grid" class="size-3.5" />
                                                    Summary
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    :variant="detailsOverviewTab === 'study' ? 'default' : 'ghost'"
                                                    class="h-8 justify-start gap-1.5 rounded-md px-2.5 text-xs sm:text-sm"
                                                    @click="detailsOverviewTab = 'study'"
                                                >
                                                    <AppIcon name="users" class="size-3.5" />
                                                    Study Context
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    :variant="detailsOverviewTab === 'reporting' ? 'default' : 'ghost'"
                                                    class="h-8 justify-start gap-1.5 rounded-md px-2.5 text-xs sm:text-sm"
                                                    @click="detailsOverviewTab = 'reporting'"
                                                >
                                                    <AppIcon name="file-text" class="size-3.5" />
                                                    Reporting
                                                </Button>
                                            </div>

                                            <div class="space-y-4">
                                            <div class="space-y-4">
                                                <Card v-if="detailsOverviewTab === 'summary'" class="rounded-lg !gap-4 !py-4">
                                                    <CardHeader class="px-4 pb-1 pt-0">
                                                        <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                            <AppIcon name="activity" class="size-4 text-muted-foreground" />
                                                            Imaging handoff
                                                        </CardTitle>
                                                        <CardDescription class="mt-0.5 text-xs">
                                                            Keep scheduling, modality, and encounter context visible above the study detail.
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent class="grid gap-3 px-4 pt-0 sm:grid-cols-2">
                                                        <div class="rounded-lg border bg-muted/20 p-3">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Order status</p>
                                                            <div class="mt-2 flex flex-wrap items-center gap-2">
                                                                <Badge :variant="statusVariant(detailsOrder.status)">
                                                                    {{ formatEnumLabel(detailsOrder.status) }}
                                                                </Badge>
                                                                <Badge variant="outline">
                                                                    {{ formatEnumLabel(detailsOrder.modality) }}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <div class="rounded-lg border bg-muted/20 p-3">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Encounter handoff</p>
                                                            <p class="mt-2 text-sm font-medium text-foreground">
                                                                {{ radiologyOrderEncounterLabel(detailsOrder) }}
                                                            </p>
                                                        </div>
                                                        <div class="rounded-lg border bg-background p-3">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ordered</p>
                                                            <p class="mt-2 text-sm font-medium text-foreground">
                                                                {{ formatDateTime(detailsOrder.orderedAt) }}
                                                            </p>
                                                        </div>
                                                        <div class="rounded-lg border bg-background p-3">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requested schedule</p>
                                                            <p class="mt-2 text-sm font-medium text-foreground">
                                                                {{ formatDateTime(detailsOrder.scheduledFor) }}
                                                            </p>
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                                <Card v-if="detailsOverviewTab === 'study'" class="rounded-lg !gap-4 !py-4">
                                                    <CardHeader class="px-4 pb-1 pt-0">
                                                        <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                            <AppIcon name="users" class="size-4 text-muted-foreground" />
                                                            Patient & study context
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent class="grid gap-3 px-4 pt-0 sm:grid-cols-2">
                                                        <div class="rounded-lg border bg-background p-3">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Patient reference</p>
                                                            <p class="mt-2 text-sm font-medium text-foreground">
                                                                {{ radiologyOrderPatientLabel(detailsOrder) }}
                                                            </p>
                                                        </div>
                                                        <div class="rounded-lg border bg-background p-3">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Procedure code</p>
                                                            <p class="mt-2 text-sm font-medium text-foreground">
                                                                {{ detailsOrder.procedureCode || 'No procedure code recorded' }}
                                                            </p>
                                                        </div>
                                                        <div class="rounded-lg border bg-background p-3">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Appointment link</p>
                                                            <p class="mt-2 text-sm font-medium text-foreground">
                                                                {{ detailsOrder.appointmentId ? shortId(detailsOrder.appointmentId) : 'No appointment link' }}
                                                            </p>
                                                        </div>
                                                        <div class="rounded-lg border bg-background p-3">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admission link</p>
                                                            <p class="mt-2 text-sm font-medium text-foreground">
                                                                {{ detailsOrder.admissionId ? shortId(detailsOrder.admissionId) : 'No admission link' }}
                                                            </p>
                                                        </div>
                                                        <div class="rounded-lg border bg-background p-3 sm:col-span-2">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Catalog governance</p>
                                                            <p class="mt-2 text-sm font-medium text-foreground">
                                                                {{
                                                                    detailsOrder.radiologyProcedureCatalogItemId
                                                                        ? 'Catalog-governed study'
                                                                        : 'Manual study code'
                                                                }}
                                                            </p>
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                            </div>

                                            <div v-if="detailsOverviewTab === 'summary'" class="space-y-4">
                                                <div
                                                    class="rounded-lg border p-4"
                                                    :class="
                                                        detailsWorkflowSummary
                                                            ? variantSurfaceClass(detailsWorkflowSummary.variant)
                                                            : 'border-border bg-background'
                                                    "
                                                >
                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                        {{ canUpdateStatus ? 'Workflow focus' : 'Order summary' }}
                                                    </p>
                                                    <p class="mt-2 text-base font-semibold text-foreground">
                                                        {{ detailsWorkflowSummary?.title }}
                                                    </p>
                                                    <p class="mt-2 text-sm text-muted-foreground">
                                                        {{ detailsWorkflowSummary?.description }}
                                                    </p>
                                                    <div v-if="detailsWorkflowAction && canUpdateStatus" class="mt-4 flex flex-wrap gap-2">
                                                        <Button
                                                            size="sm"
                                                            class="gap-1.5"
                                                            :disabled="actionLoadingId === detailsOrder.id"
                                                            @click="openStatusDialog(detailsOrder, detailsWorkflowAction.action)"
                                                        >
                                                            <AppIcon name="activity" class="size-3.5" />
                                                            {{ detailsWorkflowAction.label }}
                                                        </Button>
                                                    </div>
                                                    <p
                                                        v-else
                                                        class="mt-4 text-xs text-muted-foreground"
                                                    >
                                                        Execution controls are limited to radiology operators. Use related workflows once the study is reported or ready for downstream follow-up.
                                                    </p>
                                                </div>

                                                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                    <div
                                                        v-for="card in detailsOverviewCards"
                                                        :key="`rad-overview-card-${card.id}`"
                                                        class="rounded-lg border p-4"
                                                    >
                                                        <div class="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p class="text-sm font-medium text-foreground">
                                                                    {{ card.title }}
                                                                </p>
                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                    {{ card.helper }}
                                                                </p>
                                                            </div>
                                                            <Badge :variant="card.badgeVariant">
                                                                {{ card.value }}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <Card v-if="detailsOverviewTab === 'reporting'" class="rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                    <AppIcon name="file-text" class="size-4 text-muted-foreground" />
                                                    Clinical indication & reporting
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="grid gap-3 px-4 pt-0 sm:grid-cols-2">
                                                <div class="rounded-lg border bg-muted/20 p-3">
                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Clinical indication</p>
                                                    <p class="mt-2 text-sm text-foreground">
                                                        {{ detailsOrder.clinicalIndication || 'No clinical indication was recorded for this study.' }}
                                                    </p>
                                                </div>
                                                <div class="rounded-lg border bg-muted/20 p-3">
                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Report summary</p>
                                                    <p class="mt-2 text-sm text-foreground">
                                                        {{ detailsOrder.reportSummary || 'Report summary will appear here once the study is completed.' }}
                                                    </p>
                                                    <p class="mt-3 text-xs text-muted-foreground">
                                                        Completed: {{ formatDateTime(detailsOrder.completedAt) }}
                                                    </p>
                                                </div>
                                                <div
                                                    v-if="detailsOrder.statusReason"
                                                    class="rounded-lg border bg-background p-3 sm:col-span-2"
                                                >
                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status note</p>
                                                    <p class="mt-2 text-sm text-foreground">{{ detailsOrder.statusReason }}</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="workflows" class="mt-0 space-y-4">
                                        <Card class="rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <div class="flex flex-wrap items-start justify-between gap-2">
                                                    <div>
                                                        <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                            <AppIcon name="activity" class="size-4 text-muted-foreground" />
                                                            {{ canUpdateStatus ? 'Workflow focus' : 'Order summary' }}
                                                        </CardTitle>
                                                        <CardDescription class="mt-0.5 text-xs">
                                                            {{
                                                                canUpdateStatus
                                                                    ? 'Drive the imaging workflow with one clear next step, then hand the result downstream.'
                                                                    : 'Review the imaging state and downstream handoff without exposing execution-only controls.'
                                                            }}
                                                        </CardDescription>
                                                    </div>
                                                    <Badge
                                                        v-if="detailsWorkflowSummary"
                                                        :variant="detailsWorkflowSummary.variant"
                                                    >
                                                        {{ detailsWorkflowSummary.badge }}
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-4 px-4 pt-0">
                                                <div
                                                    class="rounded-lg border p-4"
                                                    :class="
                                                        detailsWorkflowSummary
                                                            ? variantSurfaceClass(detailsWorkflowSummary.variant)
                                                            : 'border-border bg-background'
                                                    "
                                                >
                                                    <div class="flex flex-col gap-4">
                                                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                            <div class="min-w-0 space-y-2">
                                                                <div class="flex flex-wrap items-center gap-2">
                                                                    <Badge
                                                                        v-if="detailsWorkflowSummary"
                                                                        :variant="detailsWorkflowSummary.variant"
                                                                        class="h-5 px-1.5 text-[10px]"
                                                                    >
                                                                        {{ detailsWorkflowSummary.badge }}
                                                                    </Badge>
                                                                    <Badge
                                                                        v-if="detailsWorkflowAction && canUpdateStatus"
                                                                        variant="outline"
                                                                        class="h-5 px-1.5 text-[10px]"
                                                                    >
                                                                        Next: {{ detailsWorkflowAction.label }}
                                                                    </Badge>
                                                                </div>
                                                                <p class="text-lg font-semibold text-foreground">
                                                                    {{ detailsWorkflowAction && canUpdateStatus ? detailsWorkflowAction.label : detailsWorkflowSummary?.title }}
                                                                </p>
                                                                <p class="text-sm text-muted-foreground">
                                                                    {{ detailsWorkflowAction && canUpdateStatus ? detailsWorkflowAction.description : detailsWorkflowSummary?.description }}
                                                                </p>
                                                            </div>
                                                            <Button
                                                                v-if="detailsWorkflowAction && canUpdateStatus"
                                                                size="sm"
                                                                class="gap-1.5 sm:self-start"
                                                                :disabled="actionLoadingId === detailsOrder.id"
                                                                @click="openStatusDialog(detailsOrder, detailsWorkflowAction.action)"
                                                            >
                                                                <AppIcon name="arrow-right" class="size-3.5" />
                                                                {{ detailsWorkflowAction.label }}
                                                            </Button>
                                                        </div>
                                                        <div class="grid gap-3 sm:grid-cols-3">
                                                            <div class="rounded-lg border bg-background/80 p-3">
                                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                                    Current step
                                                                </p>
                                                                <p class="mt-2 text-sm font-medium text-foreground">
                                                                    {{ formatEnumLabel(detailsOrder.status) }}
                                                                </p>
                                                            </div>
                                                            <div class="rounded-lg border bg-background/80 p-3">
                                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                                    {{ detailsWorkflowAction && canUpdateStatus ? 'Move to' : 'Access scope' }}
                                                                </p>
                                                                <p class="mt-2 text-sm font-medium text-foreground">
                                                                    {{ detailsWorkflowAction && canUpdateStatus ? formatEnumLabel(detailsWorkflowAction.action) : 'Review access' }}
                                                                </p>
                                                            </div>
                                                            <div class="rounded-lg border bg-background/80 p-3">
                                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                                    After this step
                                                                </p>
                                                                <p class="mt-2 text-sm font-medium text-foreground">
                                                                    {{ detailsWorkflowAfterStep }}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <p
                                                            v-if="!canUpdateStatus"
                                                            class="text-xs text-muted-foreground"
                                                        >
                                                            Execution controls are available only to radiology operators. Use related workflows once reporting is complete.
                                                        </p>
                                                    </div>
                                                </div>
                                                <div
                                                    v-if="
                                                        canCreateRadiologyFollowOnOrder(detailsOrder)
                                                        || canApplyRadiologyLifecycleAction(detailsOrder, 'cancel')
                                                        || canApplyRadiologyLifecycleAction(detailsOrder, 'entered_in_error')
                                                    "
                                                    class="rounded-lg border p-4"
                                                >
                                                    <div class="flex flex-col gap-1">
                                                        <p class="text-sm font-medium">Clinical lifecycle</p>
                                                        <p class="text-xs text-muted-foreground">
                                                            Reorder, add a linked follow-up study, or stop this request without overwriting the original record.
                                                        </p>
                                                    </div>
                                                    <div class="mt-4 flex flex-wrap gap-2">
                                                        <Button
                                                            v-if="canCreateRadiologyFollowOnOrder(detailsOrder)"
                                                            size="sm"
                                                            variant="outline"
                                                            as-child
                                                            class="gap-1.5"
                                                        >
                                                            <Link
                                                                :href="
                                                                    radiologyOrderContextHref('/radiology-orders', detailsOrder, {
                                                                        includeTabNew: true,
                                                                        reorderOfId: detailsOrder.id,
                                                                    })
                                                                "
                                                            >
                                                                <AppIcon name="rotate-cw" class="size-3.5" />
                                                                Reorder
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            v-if="canCreateRadiologyFollowOnOrder(detailsOrder)"
                                                            size="sm"
                                                            variant="outline"
                                                            as-child
                                                            class="gap-1.5"
                                                        >
                                                            <Link
                                                                :href="
                                                                    radiologyOrderContextHref('/radiology-orders', detailsOrder, {
                                                                        includeTabNew: true,
                                                                        addOnToOrderId: detailsOrder.id,
                                                                    })
                                                                "
                                                            >
                                                                <AppIcon name="plus" class="size-3.5" />
                                                                Add Linked Study
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            v-if="canApplyRadiologyLifecycleAction(detailsOrder, 'cancel')"
                                                            size="sm"
                                                            variant="outline"
                                                            class="gap-1.5"
                                                            :disabled="actionLoadingId === detailsOrder.id"
                                                            @click="openRadiologyLifecycleDialog(detailsOrder, 'cancel')"
                                                        >
                                                            <AppIcon name="circle-slash-2" class="size-3.5" />
                                                            Cancel Order
                                                        </Button>
                                                        <Button
                                                            v-if="canApplyRadiologyLifecycleAction(detailsOrder, 'entered_in_error')"
                                                            size="sm"
                                                            variant="destructive"
                                                            class="gap-1.5"
                                                            :disabled="actionLoadingId === detailsOrder.id"
                                                            @click="openRadiologyLifecycleDialog(detailsOrder, 'entered_in_error')"
                                                        >
                                                            <AppIcon name="triangle-alert" class="size-3.5" />
                                                            Entered in Error
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div
                                                    v-if="radiologyDetailsSheetHasRelatedWorkflows"
                                                    class="rounded-lg border p-4"
                                                >
                                                    <div class="flex flex-col gap-1">
                                                        <p class="text-sm font-medium">Related workflows</p>
                                                        <p class="text-xs text-muted-foreground">
                                                            Open the next connected module only when your role can actually continue that work.
                                                        </p>
                                                    </div>
                                                    <div class="mt-4 flex flex-wrap gap-2">
                                                        <Button
                                                            v-if="canReadAppointments && detailsOrder.appointmentId"
                                                            size="sm"
                                                            variant="outline"
                                                            as-child
                                                            class="gap-1.5"
                                                        >
                                                            <Link :href="radiologyOrderContextHref('/appointments', detailsOrder)">
                                                                <AppIcon name="calendar-check-2" class="size-3.5" />
                                                                Back to Appointments
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            v-if="canReadAdmissions && detailsOrder.admissionId"
                                                            size="sm"
                                                            variant="outline"
                                                            as-child
                                                            class="gap-1.5"
                                                        >
                                                            <Link :href="radiologyOrderContextHref('/admissions', detailsOrder)">
                                                                <AppIcon name="bed-double" class="size-3.5" />
                                                                Back to Admissions
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            v-if="canReadMedicalRecords && detailsOrder.patientId"
                                                            size="sm"
                                                            variant="outline"
                                                            as-child
                                                            class="gap-1.5"
                                                        >
                                                            <Link :href="radiologyOrderContextHref('/medical-records', detailsOrder, { includeTabNew: true })">
                                                                <AppIcon name="stethoscope" class="size-3.5" />
                                                                {{ consultationReturnLabel }}
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            v-if="canReadLaboratoryOrders && detailsOrder.patientId"
                                                            size="sm"
                                                            variant="outline"
                                                            as-child
                                                            class="gap-1.5"
                                                        >
                                                            <Link :href="radiologyOrderContextHref('/laboratory-orders', detailsOrder, { includeTabNew: true })">
                                                                <AppIcon name="flask-conical" class="size-3.5" />
                                                                New Lab Order
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            v-if="canCreateTheatreProcedures && detailsOrder.patientId"
                                                            size="sm"
                                                            variant="outline"
                                                            as-child
                                                            class="gap-1.5"
                                                        >
                                                            <Link :href="radiologyOrderContextHref('/theatre-procedures', detailsOrder, { includeTabNew: true })">
                                                                <AppIcon name="scissors" class="size-3.5" />
                                                                Schedule Procedure
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            v-if="canReadBillingInvoices && detailsOrder.patientId"
                                                            size="sm"
                                                            variant="outline"
                                                            as-child
                                                            class="gap-1.5"
                                                        >
                                                            <Link :href="radiologyOrderContextHref('/billing-invoices', detailsOrder, { includeTabNew: true })">
                                                                <AppIcon name="receipt" class="size-3.5" />
                                                                Create Invoice
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div class="rounded-lg border p-4">
                                                    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p class="text-sm font-medium">Imaging timeline</p>
                                                            <p class="text-xs text-muted-foreground">
                                                                Ordered, scheduled, imaged, and reported in one vertical chronology.
                                                            </p>
                                                        </div>
                                                        <Badge variant="outline">
                                                            {{ detailsWorkflowSteps.length }} steps
                                                        </Badge>
                                                    </div>

                                                    <div class="mt-4 space-y-0">
                                                        <div
                                                            v-for="(step, index) in detailsWorkflowSteps"
                                                            :key="step.key"
                                                            class="flex gap-3"
                                                        >
                                                            <div class="flex w-5 flex-col items-center">
                                                                <span
                                                                    class="mt-1 size-2.5 rounded-full"
                                                                    :class="radiologyWorkflowStageDotClass(step.state)"
                                                                />
                                                                <span
                                                                    v-if="index < detailsWorkflowSteps.length - 1"
                                                                    class="mt-1 w-px flex-1 bg-border"
                                                                />
                                                            </div>
                                                            <div class="min-w-0 flex-1 pb-4">
                                                                <div class="flex flex-wrap items-center gap-2">
                                                                    <p class="text-sm font-medium text-foreground">
                                                                        {{ step.title }}
                                                                    </p>
                                                                    <Badge :variant="radiologyWorkflowStageVariant(step.state)">
                                                                        {{
                                                                            step.timestamp
                                                                                ? formatDateTime(step.timestamp)
                                                                                : radiologyWorkflowStageLabel(step.state)
                                                                        }}
                                                                    </Badge>
                                                                </div>
                                                                <p class="mt-1 text-sm text-muted-foreground">
                                                                    {{ step.description }}
                                                                </p>
                                                                <p
                                                                    v-if="!step.timestamp"
                                                                    class="mt-1 text-xs text-muted-foreground"
                                                                >
                                                                    No timestamp recorded yet.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="audit" class="mt-0 space-y-4">
                                        <div class="rounded-lg border p-4">
                                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p class="text-sm font-medium">Audit trail</p>
                                                    <p class="text-xs text-muted-foreground">
                                                        Immutable lifecycle events and report actions for this radiology order.
                                                    </p>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <Badge v-if="canViewAudit" variant="outline">
                                                        {{ detailsAuditSummary.total }} entries
                                                    </Badge>
                                                    <Badge v-else variant="secondary">Audit Restricted</Badge>
                                                    <Button
                                                        v-if="canViewAudit && detailsOrder"
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        :disabled="detailsAuditLoading"
                                                        @click="loadDetailsAuditLogs(detailsOrder.id)"
                                                    >
                                                        {{ detailsAuditLoading ? 'Refreshing...' : 'Refresh Audit' }}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <Alert v-if="!canViewAudit" variant="destructive">
                                            <AlertTitle>Audit access restricted</AlertTitle>
                                            <AlertDescription>Request <code>radiology.orders.view-audit-logs</code> permission.</AlertDescription>
                                        </Alert>

                                        <template v-else>
                                            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                                <Card class="rounded-lg !gap-3 !py-3">
                                                    <CardContent class="px-4 pt-0">
                                                        <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total entries</p>
                                                        <p class="mt-2 text-2xl font-semibold">{{ detailsAuditSummary.total }}</p>
                                                    </CardContent>
                                                </Card>
                                                <Card class="rounded-lg !gap-3 !py-3">
                                                    <CardContent class="px-4 pt-0">
                                                        <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Changed events</p>
                                                        <p class="mt-2 text-2xl font-semibold">{{ detailsAuditSummary.changedEntries }}</p>
                                                    </CardContent>
                                                </Card>
                                                <Card class="rounded-lg !gap-3 !py-3">
                                                    <CardContent class="px-4 pt-0">
                                                        <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">User actions</p>
                                                        <p class="mt-2 text-2xl font-semibold">{{ detailsAuditSummary.userEntries }}</p>
                                                    </CardContent>
                                                </Card>
                                                <Card class="rounded-lg !gap-3 !py-3">
                                                    <CardContent class="px-4 pt-0">
                                                        <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current view</p>
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
                                                                    {{ detailsAuditSummary.total }} entries | Search by action, actor, or date range
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
                                                                <div class="grid gap-2 sm:col-span-2">
                                                                    <Label for="rad-audit-q" class="text-xs">Search</Label>
                                                                    <Input
                                                                        id="rad-audit-q"
                                                                        v-model="detailsAuditFilters.q"
                                                                        placeholder="e.g. status.updated, completed, created..."
                                                                        @keyup.enter="applyDetailsAuditFilters"
                                                                    />
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <Label for="rad-audit-action" class="text-xs">Action</Label>
                                                                    <Input id="rad-audit-action" v-model="detailsAuditFilters.action" placeholder="Optional exact action key" />
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <Label for="rad-audit-actor-type" class="text-xs">Actor type</Label>
                                                                    <Select v-model="detailsAuditFilters.actorType">
                                                                        <SelectTrigger class="w-full">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                        <SelectItem
                                                                            v-for="option in auditActorTypeOptions"
                                                                            :key="`rad-audit-actor-type-${option.value || 'all'}`"
                                                                            :value="option.value"
                                                                        >
                                                                            {{ option.label }}
                                                                        </SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <Label for="rad-audit-actor-id" class="text-xs">Actor user ID</Label>
                                                                    <Input id="rad-audit-actor-id" v-model="detailsAuditFilters.actorId" inputmode="numeric" placeholder="Optional user ID" />
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <Label for="rad-audit-from" class="text-xs">From</Label>
                                                                    <Input id="rad-audit-from" v-model="detailsAuditFilters.from" type="datetime-local" />
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <Label for="rad-audit-to" class="text-xs">To</Label>
                                                                    <Input id="rad-audit-to" v-model="detailsAuditFilters.to" type="datetime-local" />
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <Label for="rad-audit-per-page" class="text-xs">Rows per page</Label>
                                                                    <Select :model-value="String(detailsAuditFilters.perPage)" @update:model-value="detailsAuditFilters.perPage = Number($event)">
                                                                        <SelectTrigger class="w-full">
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
                                                                    <Button size="sm" :disabled="detailsAuditLoading" @click="applyDetailsAuditFilters">
                                                                        {{ detailsAuditLoading ? 'Applying...' : 'Apply filters' }}
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" :disabled="detailsAuditLoading" @click="resetDetailsAuditFilters">Reset</Button>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </CollapsibleContent>
                                                </Card>
                                            </Collapsible>

                                            <div v-if="detailsAuditActiveFilters.length" class="flex flex-wrap gap-2">
                                                <Badge
                                                    v-for="filter in detailsAuditActiveFilters"
                                                    :key="`rad-audit-filter-${filter.key}`"
                                                    variant="outline"
                                                >
                                                    {{ filter.label }}
                                                </Badge>
                                            </div>

                                            <Alert v-if="detailsAuditError" variant="destructive">
                                                <AlertTitle>Audit load issue</AlertTitle>
                                                <AlertDescription>{{ detailsAuditError }}</AlertDescription>
                                            </Alert>

                                            <div v-if="detailsAuditLoading" class="space-y-2">
                                                <Skeleton class="h-20 w-full" />
                                                <Skeleton class="h-20 w-full" />
                                            </div>
                                            <div v-else-if="detailsAuditLogs.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                                No audit log entries.
                                            </div>
                                            <div v-else class="space-y-3">
                                                <div v-for="log in detailsAuditLogs" :key="log.id" class="rounded-lg border bg-background px-3 py-3 text-sm">
                                                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                        <div class="min-w-0 space-y-2">
                                                            <div class="flex flex-wrap items-center gap-2">
                                                                <p class="font-medium">{{ log.actionLabel || log.action || 'Audit event' }}</p>
                                                                <Badge variant="secondary">{{ auditLogActorTypeLabel(log) }}</Badge>
                                                                <Badge v-if="auditChangeSummary(log)" variant="outline">
                                                                    {{ auditChangeSummary(log) }}
                                                                </Badge>
                                                            </div>
                                                            <p class="text-xs text-muted-foreground">Actor: {{ auditActorLabel(log) }}</p>
                                                            <div v-if="auditLogChangeKeys(log).length" class="flex flex-wrap gap-1.5">
                                                                <Badge
                                                                    v-for="changeKey in auditLogChangeKeys(log)"
                                                                    :key="`rad-audit-change-${log.id}-${changeKey}`"
                                                                    variant="outline"
                                                                    class="text-[10px]"
                                                                >
                                                                    {{ changeKey }}
                                                                </Badge>
                                                            </div>
                                                            <div v-if="auditLogMetadataPreview(log).length" class="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                                <span
                                                                    v-for="item in auditLogMetadataPreview(log)"
                                                                    :key="`rad-audit-metadata-${log.id}-${item.key}`"
                                                                >
                                                                    {{ item.key }}: {{ item.value }}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div class="flex items-center gap-2 self-start">
                                                            <p class="text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }}</p>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                class="h-8 px-2"
                                                                @click="toggleDetailsAuditLogExpanded(log.id)"
                                                            >
                                                                {{ isDetailsAuditLogExpanded(log.id) ? 'Hide details' : 'Show details' }}
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div v-if="isDetailsAuditLogExpanded(log.id)" class="mt-3 grid gap-3 md:grid-cols-2">
                                                        <div v-if="auditObjectEntries(log.changes).length" class="space-y-1">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Changes</p>
                                                            <pre class="overflow-x-auto rounded-md border bg-muted/30 p-3 text-[11px] leading-5 text-foreground">{{ auditJsonPreview(log.changes) }}</pre>
                                                        </div>
                                                        <div v-if="auditObjectEntries(log.metadata).length" class="space-y-1">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Metadata</p>
                                                            <pre class="overflow-x-auto rounded-md border bg-muted/30 p-3 text-[11px] leading-5 text-foreground">{{ auditJsonPreview(log.metadata) }}</pre>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="flex items-center justify-between border-t pt-2">
                                                <Button size="sm" variant="outline" :disabled="!detailsAuditMeta || detailsAuditMeta.currentPage <= 1 || detailsAuditLoading" @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 2) - 1)">Previous</Button>
                                                <p class="text-xs text-muted-foreground">
                                                    Page {{ detailsAuditMeta?.currentPage ?? 1 }} of {{ detailsAuditMeta?.lastPage ?? 1 }} | {{ detailsAuditMeta?.total ?? detailsAuditLogs.length }} logs
                                                </p>
                                                <Button size="sm" variant="outline" :disabled="!detailsAuditMeta || detailsAuditMeta.currentPage >= detailsAuditMeta.lastPage || detailsAuditLoading" @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 0) + 1)">Next</Button>
                                            </div>
                                        </template>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </ScrollArea>
                        <SheetFooter class="shrink-0 border-t px-6 py-4">
                            <Button variant="outline" @click="closeDetails">Close</Button>
                        </SheetFooter>
                    </div>
                </SheetContent>
            </Sheet>

            <ClinicalLifecycleActionDialog
                :open="lifecycleDialogOpen"
                :action="lifecycleDialogAction"
                :order-label="lifecycleDialogOrder?.orderNumber || lifecycleDialogOrder?.studyDescription || 'Radiology order'"
                subject-label="radiology order"
                :reason="lifecycleDialogReason"
                :loading="actionLoadingId === lifecycleDialogOrder?.id"
                :error="lifecycleDialogError"
                @update:open="(open) => (open ? (lifecycleDialogOpen = true) : closeRadiologyLifecycleDialog())"
                @update:reason="lifecycleDialogReason = $event"
                @submit="submitRadiologyLifecycleDialog"
            />

            <Dialog :open="createContextDialogOpen" @update:open="createContextDialogOpen = $event">
                <DialogContent variant="form" size="4xl" class="overflow-visible">
                    <DialogHeader class="sticky top-0 z-10 shrink-0 border-b bg-background px-6 py-4">
                        <DialogTitle class="flex items-center gap-2">
                            <AppIcon name="search" class="size-4 text-muted-foreground" />
                            Review or change context
                        </DialogTitle>
                        <DialogDescription>
                            Select the patient and linked visit context for this radiology order.
                        </DialogDescription>
                    </DialogHeader>

                    <div class="max-h-[calc(90vh-6rem)] space-y-4 overflow-y-auto px-6 py-4">
                        <div class="flex flex-wrap gap-2">
                            <Button
                                v-if="createPatientContextLocked"
                                type="button"
                                variant="outline"
                                size="sm"
                                class="gap-1.5"
                                @click="unlockCreatePatientContext()"
                            >
                                Unlock patient
                            </Button>
                            <Button
                                v-if="!createPatientContextLocked && (createForm.appointmentId || createForm.admissionId)"
                                type="button"
                                variant="outline"
                                size="sm"
                                class="gap-1.5"
                                @click="clearCreateClinicalLinks"
                            >
                                Unlink clinical context
                            </Button>
                        </div>

                        <Tabs v-model="createContextEditorTab" class="w-full">
                            <TabsList class="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
                                <TabsTrigger value="patient" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"><AppIcon name="user" class="size-3.5" />Patient</TabsTrigger>
                                <TabsTrigger value="appointment" :disabled="!createForm.patientId.trim()" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"><AppIcon name="calendar-clock" class="size-3.5" />Appointment</TabsTrigger>
                                <TabsTrigger value="admission" :disabled="!createForm.patientId.trim()" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"><AppIcon name="bed-double" class="size-3.5" />Admission</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div class="rounded-lg border bg-muted/20 p-4">
                            <div v-show="createContextEditorTab === 'patient'" class="grid gap-3">
                                <PatientLookupField
                                    input-id="rad-create-patient-id"
                                    v-model="createForm.patientId"
                                    label="Patient"
                                    placeholder="Search patient by name, patient number, phone, email, or national ID"
                                    :helper-text="createPatientContextLocked ? 'Patient is locked from the clinical handoff. Use Unlock patient to change it.' : 'Select the patient for this radiology order.'"
                                    :error-message="createFieldError('patientId')"
                                    patient-status="active"
                                    :disabled="createPatientContextLocked"
                                    @selected="closeCreateContextDialogAfterSelection('patientId', $event)"
                                />
                            </div>
                            <div v-show="createContextEditorTab === 'appointment'" class="grid gap-3">
                                <LinkedContextLookupField
                                    input-id="rad-create-appointment-id"
                                    v-model="createForm.appointmentId"
                                    :patient-id="createForm.patientId"
                                    label="Appointment Link"
                                    resource="appointments"
                                    placeholder="Search linked appointment by number or department"
                                    helper-text="Optional. Link the checked-in appointment that started this imaging request."
                                    :error-message="createFieldError('appointmentId')"
                                    :disabled="createPatientContextLocked"
                                    status="checked_in"
                                    @selected="closeCreateContextDialogAfterSelection('appointmentId', $event)"
                                />
                            </div>
                            <div v-show="createContextEditorTab === 'admission'" class="grid gap-3">
                                <LinkedContextLookupField
                                    input-id="rad-create-admission-id"
                                    v-model="createForm.admissionId"
                                    :patient-id="createForm.patientId"
                                    label="Admission Link"
                                    resource="admissions"
                                    placeholder="Search linked admission by number or ward"
                                    helper-text="Optional. Link an admission when this imaging order belongs to an inpatient stay."
                                    :error-message="createFieldError('admissionId')"
                                    :disabled="createPatientContextLocked"
                                    @selected="closeCreateContextDialogAfterSelection('admissionId', $event)"
                                />
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <!-- Status Dialog -->
            <Dialog :open="statusDialogOpen" @update:open="(open) => (open ? (statusDialogOpen = true) : closeStatusDialog())">
                <DialogContent variant="workspace" size="2xl" class="max-h-[85vh]">
                    <DialogHeader class="shrink-0 border-b px-6 py-5 text-left">
                        <DialogTitle>{{ statusDialogConfig.title }}</DialogTitle>
                        <DialogDescription>{{ statusDialogConfig.description }}</DialogDescription>
                    </DialogHeader>
                    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                        <div class="space-y-4">
                            <div
                                v-if="statusDialogOrder"
                                class="rounded-lg border p-4"
                                :class="statusDialogAction === 'cancelled' ? variantSurfaceClass('destructive') : 'bg-muted/20'"
                            >
                                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div class="min-w-0 space-y-1">
                                        <p class="text-sm font-semibold text-foreground">
                                            {{ statusDialogOrder.orderNumber || 'Radiology Order' }}
                                        </p>
                                        <p class="text-sm text-muted-foreground">
                                            {{ statusDialogOrder.studyDescription || 'No study description recorded.' }}
                                        </p>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Badge :variant="statusVariant(statusDialogOrder.status)">
                                            {{ statusDialogCurrentStepLabel }}
                                        </Badge>
                                        <Badge :variant="statusDialogConfig.badgeVariant">
                                            {{ statusDialogConfig.nextStateLabel }}
                                        </Badge>
                                    </div>
                                </div>
                                <div class="mt-4 grid gap-3 sm:grid-cols-3">
                                    <div class="rounded-lg border bg-background/80 p-3">
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Current step
                                        </p>
                                        <p class="mt-2 text-sm font-medium text-foreground">
                                            {{ statusDialogCurrentStepLabel }}
                                        </p>
                                    </div>
                                    <div class="rounded-lg border bg-background/80 p-3">
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Move to
                                        </p>
                                        <p class="mt-2 text-sm font-medium text-foreground">
                                            {{ statusDialogConfig.nextStateLabel }}
                                        </p>
                                    </div>
                                    <div class="rounded-lg border bg-background/80 p-3">
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            After this step
                                        </p>
                                        <p class="mt-2 text-sm font-medium text-foreground">
                                            {{ statusDialogConfig.afterStep }}
                                        </p>
                                    </div>
                                </div>
                                <div class="mt-3 rounded-lg border bg-background/80 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Encounter handoff
                                    </p>
                                    <p class="mt-2 text-sm font-medium text-foreground">
                                        {{ statusDialogEncounterLabel }}
                                    </p>
                                </div>
                            </div>

                            <div
                                v-if="statusDialogAction === 'scheduled'"
                                class="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground"
                            >
                                Keep the requested slot aligned with the patient handoff, then save to move this study into the scheduled queue.
                            </div>

                            <div
                                v-if="statusDialogAction === 'in_progress'"
                                class="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground"
                            >
                                Use this step only when the patient, room, and modality team are ready and imaging work is actively starting.
                            </div>

                            <div v-if="statusDialogAction === 'cancelled'" class="grid gap-2">
                                <Label for="rad-status-reason">Cancellation reason</Label>
                                <Textarea
                                    id="rad-status-reason"
                                    v-model="statusDialogReason"
                                    rows="3"
                                    placeholder="Why is this radiology study being cancelled?"
                                />
                            </div>

                            <div v-if="statusDialogAction === 'completed'" class="grid gap-3">
                                <Alert
                                    v-if="statusDialogStockCheckLoading"
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
                                    v-else-if="statusDialogStockCheckError"
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
                                <div class="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                                    {{ statusDialogReportGuidance }}
                                </div>
                                <div
                                    v-if="radiologyReportTemplateSuggestions.length"
                                    class="rounded-lg border bg-muted/20 p-3"
                                >
                                    <div class="space-y-1">
                                        <p class="text-sm font-medium">
                                            Report-template assist
                                        </p>
                                        <p class="text-xs text-muted-foreground">
                                            Load a structured starting point for the selected modality, then edit the summary before saving.
                                        </p>
                                    </div>
                                    <div class="mt-3 grid gap-2">
                                        <button
                                            v-for="template in radiologyReportTemplateSuggestions"
                                            :key="`radiology-report-template-${template.key}`"
                                            type="button"
                                            class="rounded-lg border bg-background px-3 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                                            @click="applyRadiologyReportTemplate(template.content)"
                                        >
                                            <div class="flex items-start justify-between gap-3">
                                                <div class="space-y-1">
                                                    <p class="text-sm font-medium text-foreground">
                                                        {{ template.label }}
                                                    </p>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{ template.description }}
                                                    </p>
                                                </div>
                                                <Badge variant="outline">
                                                    Use
                                                </Badge>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="rad-status-report">Report summary</Label>
                                    <Textarea
                                        id="rad-status-report"
                                        v-model="statusDialogReportSummary"
                                        rows="6"
                                        placeholder="Summarize the key findings, impression, and any recommendation that changes the next step."
                                    />
                                </div>
                            </div>

                            <Alert v-if="statusDialogError" variant="destructive">
                                <AlertTitle>Action validation</AlertTitle>
                                <AlertDescription>{{ statusDialogError }}</AlertDescription>
                            </Alert>
                        </div>
                    </div>
                    <DialogFooter class="shrink-0 border-t px-6 py-4 gap-2">
                        <Button variant="outline" @click="closeStatusDialog">Close</Button>
                        <Button
                            :variant="statusDialogAction === 'cancelled' ? 'destructive' : 'default'"
                            :disabled="actionLoadingId === statusDialogOrder?.id || statusDialogStockCheckLoading"
                            @click="submitStatusDialog"
                        >
                            {{
                                actionLoadingId === statusDialogOrder?.id
                                    ? 'Saving...'
                                    : statusDialogStockCheckLoading
                                      ? 'Checking stock...'
                                      : statusDialogConfig.confirmLabel
                            }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
            <LeaveWorkflowDialog
                :open="createLeaveConfirmOpen"
                :title="RADIOLOGY_CREATE_LEAVE_TITLE"
                :description="RADIOLOGY_CREATE_LEAVE_DESCRIPTION"
                stay-label="Stay on order"
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
    </AppLayout>
</template>



















