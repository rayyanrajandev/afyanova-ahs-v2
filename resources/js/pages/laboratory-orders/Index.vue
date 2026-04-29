<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
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
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import ClinicalLifecycleActionDialog from '@/components/orders/ClinicalLifecycleActionDialog.vue';
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
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
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
import ConfirmationDialog from '@/components/workflow/ConfirmationDialog.vue';
import LeaveWorkflowDialog from '@/components/workflow/LeaveWorkflowDialog.vue';
import { useConfirmationDialog } from '@/composables/useConfirmationDialog';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePendingWorkflowLeaveGuard } from '@/composables/usePendingWorkflowLeaveGuard';
import {
    usePlatformAccess,
    type PermissionState,
} from '@/composables/usePlatformAccess';
import { useWorkflowDraftPersistence } from '@/composables/useWorkflowDraftPersistence';
import AppLayout from '@/layouts/AppLayout.vue';
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

type LaboratoryOrder = {
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
    labTestCatalogItemId: string | null;
    testCode: string | null;
    testName: string | null;
    priority: 'routine' | 'urgent' | 'stat' | string | null;
    specimenType: string | null;
    clinicalNotes: string | null;
    resultSummary: string | null;
    resultedAt: string | null;
    verifiedAt: string | null;
    verifiedByUserId: number | null;
    verificationNote: string | null;
    entryState: 'draft' | 'active' | string | null;
    signedAt: string | null;
    signedByUserId: number | null;
    status:
        | 'ordered'
        | 'collected'
        | 'in_progress'
        | 'completed'
        | 'cancelled'
        | string
        | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    enteredInErrorByUserId: number | null;
    lifecycleLockedAt: string | null;
    stockPrecheck: ClinicalStockPrecheck | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type LaboratoryOrderListResponse = {
    data: LaboratoryOrder[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type LaboratoryOrderAuditLog = {
    id: string;
    laboratoryOrderId: string | null;
    actorId: number | null;
    action: string | null;
    changes: Record<string, unknown> | unknown[] | null;
    metadata: Record<string, unknown> | unknown[] | null;
    createdAt: string | null;
};

type LaboratoryOrderAuditLogListResponse = {
    data: LaboratoryOrderAuditLog[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type LaboratoryOrderAuditExportJob = {
    id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed' | string;
    rowCount: number | null;
    schemaVersion: string | null;
    errorMessage: string | null;
    createdAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    downloadUrl: string | null;
};

type LaboratoryOrderAuditExportJobResponse = {
    data: LaboratoryOrderAuditExportJob;
};

type LaboratoryOrderAuditExportJobListResponse = {
    data: LaboratoryOrderAuditExportJob[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type AuditExportJobStatusSummary = {
    total: number;
    completed: number;
    failed: number;
    queued: number;
    processing: number;
    backlog: number;
    other: number;
};

type AuditExportStatusGroup = 'all' | 'failed' | 'backlog' | 'completed';

type LaboratoryOrderStatusCounts = {
    ordered: number;
    collected: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    other: number;
    total: number;
};

type LaboratoryOrderStatusCountsResponse = {
    data: LaboratoryOrderStatusCounts;
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

type ValidationErrorResponse = {
    message?: string;
    errors?: Record<string, string[]>;
    code?: string;
};

type DuplicateCheckResponse<T> = {
    data: {
        severity: 'none' | 'warning' | 'critical' | string;
        messages: string[];
        sameEncounterDuplicates: T[];
        recentPatientDuplicates: T[];
    };
};

type AuthPermissionsResponse = {
    data?: Array<{ name?: string | null }>;
    meta?: { total?: number | null };
};

type LaboratoryOrderStatusAction =
    | 'collected'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'verify';

type LaboratoryWorkspaceView = 'queue' | 'new';

type LaboratoryDetailsTab = 'overview' | 'journey' | 'audit';
type CreateContextLinkSource = 'none' | 'route' | 'auto' | 'manual';
type CreateContextEditorTab = 'patient' | 'appointment' | 'admission';

type LaboratoryJourneyEvent = {
    id: string;
    title: string;
    description: string;
    occurredAt: string | null;
    state: 'done' | 'active' | 'pending';
    tone: 'default' | 'warning' | 'critical' | 'success';
    note?: string | null;
};

type LaboratoryExceptionSeverity = 'critical' | 'warning' | 'info';

type LaboratoryExceptionItem = {
    id: string;
    order: LaboratoryOrder;
    severity: LaboratoryExceptionSeverity;
    title: string;
    description: string;
    occurredAt: string | null;
    elapsedLabel: string | null;
    nextAction: {
        action: LaboratoryOrderStatusAction;
        label: string;
        description: string;
    } | null;
};

type LaboratoryDownstreamAction = {
    id: string;
    label: string;
    description: string;
    href: string;
    icon: string;
    buttonLabel: string;
    readiness: 'ready' | 'after_release' | 'reference';
};

type ParsedLaboratoryResultSummary = {
    flag: string | null;
    measuredValue: string | null;
    measuredValueNumeric: number | null;
    unit: string | null;
    referenceRange: string | null;
    interpretation: string | null;
    recommendation: string | null;
};

type LaboratoryTrendPoint = {
    id: string;
    order: LaboratoryOrder;
    occurredAt: string | null;
    measuredValue: string | null;
    measuredValueNumeric: number | null;
    unit: string | null;
    flag: string | null;
    referenceRange: string | null;
};

type SearchForm = {
    q: string;
    patientId: string;
    status: string;
    priority: string;
    from: string;
    to: string;
    perPage: number;
    page: number;
};

type CreateForm = {
    patientId: string;
    appointmentId: string;
    admissionId: string;
    labTestCatalogItemId: string;
    testCode: string;
    testName: string;
    priority: 'routine' | 'urgent' | 'stat';
    specimenType: string;
    clinicalNotes: string;
};

type LaboratoryOrderBasketItem = {
    clientKey: string;
    patientId: string;
    appointmentId: string;
    admissionId: string;
    labTestCatalogItemId: string;
    testCode: string;
    testName: string;
    priority: 'routine' | 'urgent' | 'stat';
    specimenType: string;
    clinicalNotes: string;
};

type LaboratoryCreateDraft = CreateForm & {
    basketItems: LaboratoryOrderBasketItem[];
    serverDraftId: string;
};

type DetailsAuditLogsFilterForm = {
    q: string;
    action: string;
    actorType: string;
    actorId: string;
    from: string;
    to: string;
    perPage: number;
    page: number;
};

type DetailsAuditExportJobsFilterForm = {
    statusGroup: AuditExportStatusGroup;
    perPage: number;
    page: number;
};

type LaboratoryAuditExportRetryHandoffContext = {
    targetOrderId: string;
    jobId: string;
    statusGroup: AuditExportStatusGroup;
    page: number;
    perPage: number;
    savedAt: string;
};

type LaboratoryAuditExportRetryResumeTelemetry = {
    attempts: number;
    successes: number;
    failures: number;
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastFailureReason: string | null;
};

type LaboratoryAuditExportRetryResumeTelemetryEventContext = {
    targetResourceId: string;
    exportJobId: string;
    handoffStatusGroup: AuditExportStatusGroup;
    handoffPage: number;
    handoffPerPage: number;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Laboratory Orders', href: '/laboratory-orders' },
];

const laboratoryAuditActionOptions = [
    { value: 'laboratory-order.created', label: 'Order Created' },
    { value: 'laboratory-order.updated', label: 'Order Updated' },
    { value: 'laboratory-order.status.updated', label: 'Status Updated' },
    { value: 'laboratory-order.result.verified', label: 'Result Verified' },
] as const;

const laboratoryAuditActorTypeOptions = [
    { value: '', label: 'All' },
    { value: 'user', label: 'User' },
    { value: 'system', label: 'System' },
] as const;

const auditExportStatusGroupOptions: Array<{
    value: AuditExportStatusGroup;
    label: string;
}> = [
    { value: 'all', label: 'All Jobs' },
    { value: 'failed', label: 'Failed Only' },
    { value: 'backlog', label: 'Backlog (Queued/Processing)' },
    { value: 'completed', label: 'Completed Only' },
];

const pageLoading = ref(true);
const listLoading = ref(false);
const createLoading = ref(false);
const actionLoadingId = ref<string | null>(null);
const listErrors = ref<string[]>([]);
const actionMessage = ref<string | null>(null);
const createMessage = ref<string | null>(null);
const createServerDraftId = ref('');
const createErrors = ref<Record<string, string[]>>({});
const {
    isFacilitySuperAdmin,
    permissionState,
    scope: sharedScope,
    multiTenantIsolationEnabled,
} = usePlatformAccess();
const scope = ref<ScopeData | null>(
    (sharedScope.value as ScopeData | null) ?? null,
);
const orders = ref<LaboratoryOrder[]>([]);
const laboratoryExceptionOrders = ref<LaboratoryOrder[]>([]);
const pagination = ref<LaboratoryOrderListResponse['meta'] | null>(null);
const laboratoryOrderStatusCounts = ref<LaboratoryOrderStatusCounts | null>(
    null,
);
const laboratoryExceptionLoading = ref(false);
const laboratoryExceptionError = ref<string | null>(null);
const patientDirectory = ref<Record<string, PatientSummary>>({});
const laboratoryReadPermissionState = ref<PermissionState>(
    permissionState('laboratory.orders.read'),
);
const laboratoryCreatePermissionState = ref<PermissionState>(
    permissionState('laboratory.orders.create'),
);
const laboratoryUpdateStatusPermissionState = ref<PermissionState>(
    permissionState('laboratory.orders.update-status'),
);
const laboratoryVerifyResultPermissionState = ref<PermissionState>(
    permissionState('laboratory.orders.verify-result'),
);
const medicalRecordsReadPermissionState = ref<PermissionState>(
    permissionState('medical.records.read'),
);
const appointmentsReadPermissionState = ref<PermissionState>(
    permissionState('appointments.read'),
);
const admissionsReadPermissionState = ref<PermissionState>(
    permissionState('admissions.read'),
);
const pharmacyReadPermissionState = ref<PermissionState>(
    permissionState('pharmacy.orders.read'),
);
const pharmacyCreatePermissionState = ref<PermissionState>(
    permissionState('pharmacy.orders.create'),
);
const billingReadPermissionState = ref<PermissionState>(
    permissionState('billing.invoices.read'),
);
const billingCreatePermissionState = ref<PermissionState>(
    permissionState('billing.invoices.create'),
);
const theatreReadPermissionState = ref<PermissionState>(
    permissionState('theatre.procedures.read'),
);
const theatreCreatePermissionState = ref<PermissionState>(
    permissionState('theatre.procedures.create'),
);
const canReadLaboratoryOrders = computed(
    () => laboratoryReadPermissionState.value === 'allowed',
);
const canCreateLaboratoryOrders = computed(
    () => laboratoryCreatePermissionState.value === 'allowed',
);
const canUpdateLaboratoryOrderStatus = computed(
    () => laboratoryUpdateStatusPermissionState.value === 'allowed',
);
const canVerifyLaboratoryOrderResult = computed(
    () => laboratoryVerifyResultPermissionState.value === 'allowed',
);
const canReadMedicalRecords = computed(
    () => medicalRecordsReadPermissionState.value === 'allowed',
);
const canReadAppointments = computed(
    () => appointmentsReadPermissionState.value === 'allowed',
);
const canReadAdmissions = computed(
    () => admissionsReadPermissionState.value === 'allowed',
);
const canAccessPharmacyOrders = computed(
    () =>
        pharmacyReadPermissionState.value === 'allowed' ||
        pharmacyCreatePermissionState.value === 'allowed',
);
const canAccessBillingInvoices = computed(
    () =>
        billingReadPermissionState.value === 'allowed' ||
        billingCreatePermissionState.value === 'allowed',
);
const canCreateTheatreProcedures = computed(
    () => theatreCreatePermissionState.value === 'allowed',
);
const isLaboratoryWorkflowOperator = computed(
    () =>
        canUpdateLaboratoryOrderStatus.value ||
        canVerifyLaboratoryOrderResult.value,
);
const showLaboratoryOperationalQueueControls = computed(
    () => isLaboratoryWorkflowOperator.value,
);
const isLaboratoryReadPermissionResolved = computed(
    () => laboratoryReadPermissionState.value !== 'unknown',
);
const labTestCatalogReadPermissionState = ref<PermissionState>(
    permissionState('platform.clinical-catalog.read'),
);
const canReadLabTestCatalog = computed(
    () => labTestCatalogReadPermissionState.value === 'allowed',
);
const isLabTestCatalogReadPermissionResolved = computed(
    () => labTestCatalogReadPermissionState.value !== 'unknown',
);
const labTestCatalogLoading = ref(false);
const labTestCatalogError = ref<string | null>(null);
const labTestCatalogItems = ref<ClinicalCatalogItem[]>([]);
const lastAppliedCreateLabTestCatalogSpecimenType = ref('');
const tenantIsolationEnabled = ref(multiTenantIsolationEnabled.value);
const advancedFiltersSheetOpen = ref(false);
const mobileFiltersDrawerOpen = ref(false);
const compactQueueRows = useLocalStorageBoolean('opd.queueRows.compact', false);
const statusDialogOpen = ref(false);
const statusDialogTab = ref<'overview' | 'results' | 'verification'>('overview');
const completeResultSheetOpen = ref(false);
const statusDialogOrder = ref<LaboratoryOrder | null>(null);
const statusDialogAction = ref<LaboratoryOrderStatusAction | null>(null);
const statusDialogReason = ref('');
const statusDialogResultSummary = ref('');
const statusDialogVerificationNote = ref('');
const statusDialogError = ref<string | null>(null);
const statusDialogStockCheckLoading = ref(false);
const statusDialogStockCheckError = ref<string | null>(null);
const statusDialogStockCheckRequestKey = ref(0);
const statusDialogResultFlag = ref('');
const statusDialogResultValue = ref('');
const statusDialogResultUnit = ref('');
const statusDialogReferenceRange = ref('');
const statusDialogInterpretation = ref('');
const statusDialogRecommendation = ref('');
const lifecycleDialogOpen = ref(false);
const lifecycleDialogOrder = ref<LaboratoryOrder | null>(null);
const lifecycleDialogAction = ref<'cancel' | 'entered_in_error' | null>(null);
const lifecycleDialogReason = ref('');
const lifecycleDialogError = ref<string | null>(null);
const detailsSheetOpen = ref(false);
const detailsSheetOrder = ref<LaboratoryOrder | null>(null);
const detailsSheetTrendOrders = ref<LaboratoryOrder[]>([]);
const detailsSheetTrendLoading = ref(false);
const detailsSheetTrendError = ref<string | null>(null);
const detailsSheetAuditLogs = ref<LaboratoryOrderAuditLog[]>([]);
const detailsSheetAuditLogsMeta = ref<
    LaboratoryOrderAuditLogListResponse['meta'] | null
>(null);
const detailsSheetAuditExportJobs = ref<LaboratoryOrderAuditExportJob[]>([]);
const detailsSheetAuditExportJobsMeta = ref<
    LaboratoryOrderAuditExportJobListResponse['meta'] | null
>(null);
const detailsSheetAuditLogsLoading = ref(false);
const detailsSheetAuditLogsExporting = ref(false);
const detailsSheetAuditLogsError = ref<string | null>(null);
const detailsSheetAuditExportJobsLoading = ref(false);
const detailsSheetAuditExportJobsError = ref<string | null>(null);
const detailsSheetAuditExportRetryingJobId = ref<string | null>(null);
const detailsSheetAuditExportFocusJobId = ref<string | null>(null);
const detailsSheetAuditExportPinnedHandoffJob =
    ref<LaboratoryOrderAuditExportJob | null>(null);
const detailsSheetAuditExportHandoffMessage = ref<string | null>(null);
const detailsSheetAuditExportHandoffError = ref(false);
const detailsSheetAuditLogsFilters = reactive<DetailsAuditLogsFilterForm>({
    q: '',
    action: '',
    actorType: '',
    actorId: '',
    from: '',
    to: '',
    perPage: 20,
    page: 1,
});
const detailsSheetAuditExportJobsFilters =
    reactive<DetailsAuditExportJobsFilterForm>({
        statusGroup: 'all',
        perPage: 8,
        page: 1,
    });
const canViewLaboratoryOrderAuditLogs = ref(false);

const pendingPatientLookupIds = new Set<string>();
let searchDebounceTimer: number | null = null;

const today = new Date().toISOString().slice(0, 10);

const searchForm = reactive<SearchForm>({
    q: queryParam('q'),
    patientId: queryParam('patientId'),
    status: queryParam('status'),
    priority: queryParam('priority'),
    from: queryDateParam('from'),
    to: queryDateParam('to'),
    perPage: 10,
    page: 1,
});
const advancedFiltersDraft = reactive({
    patientId: searchForm.patientId,
    from: searchForm.from,
    to: searchForm.to,
});

watch(advancedFiltersSheetOpen, (open) => {
    if (open) syncAdvancedFiltersDraftFromSearch();
});

watch(mobileFiltersDrawerOpen, (open) => {
    if (open) syncAdvancedFiltersDraftFromSearch();
});
const auditExportRetryHandoffJobId = queryParam('auditExportJobId');
const auditExportRetryHandoffAction = queryParam('auditAction').toLowerCase();
const auditExportRetryHandoffStatusGroup = parseAuditExportStatusGroup(
    queryParam('auditExportStatusGroup'),
);
const auditExportRetryHandoffPage = queryPositiveIntParam('auditExportPage', 1);
const auditExportRetryHandoffPerPage = queryPositiveIntParam(
    'auditExportPerPage',
    8,
    1,
    50,
);
const auditExportRetryHandoffPending = ref(
    auditExportRetryHandoffAction === 'retry' &&
        auditExportRetryHandoffJobId !== '',
);
const auditExportRetryHandoffCompletedMessage = ref<string | null>(null);
const laboratoryAuditExportRetryHandoffSessionKey =
    'opd.laboratory.auditExportRetry.lastHandoff';
const laboratoryAuditExportRetryTelemetrySessionKey =
    'opd.laboratory.auditExportRetry.resumeTelemetry';
const lastLaboratoryAuditExportRetryHandoff =
    ref<LaboratoryAuditExportRetryHandoffContext | null>(null);
const resumingLaboratoryAuditExportRetryHandoff = ref(false);
const laboratoryAuditExportRetryResumeTelemetry =
    ref<LaboratoryAuditExportRetryResumeTelemetry>({
        attempts: 0,
        successes: 0,
        failures: 0,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
    });

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

function queryDateParam(name: string, fallback = ''): string {
    const value = queryParam(name);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function queryPositiveIntParam(
    name: string,
    fallback: number,
    min = 1,
    max = Number.POSITIVE_INFINITY,
): number {
    const raw = queryParam(name);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < min) return fallback;
    return Math.min(parsed, max);
}

function parseAuditExportStatusGroup(value: string): AuditExportStatusGroup {
    const normalized = value.toLowerCase();
    if (
        normalized === 'failed' ||
        normalized === 'backlog' ||
        normalized === 'completed'
    ) {
        return normalized;
    }
    return 'all';
}

function parseLaboratoryWorkspaceView(value: string): LaboratoryWorkspaceView {
    return value.toLowerCase() === 'new' ? 'new' : 'queue';
}

function readLaboratoryAuditExportRetryHandoffFromSession(): LaboratoryAuditExportRetryHandoffContext | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.sessionStorage.getItem(
            laboratoryAuditExportRetryHandoffSessionKey,
        );
        if (!raw) return null;

        const parsed = JSON.parse(
            raw,
        ) as Partial<LaboratoryAuditExportRetryHandoffContext>;
        if (!parsed || typeof parsed !== 'object') return null;
        if (!parsed.targetOrderId || !parsed.jobId) return null;

        return {
            targetOrderId: String(parsed.targetOrderId),
            jobId: String(parsed.jobId),
            statusGroup: parseAuditExportStatusGroup(
                String(parsed.statusGroup ?? 'all'),
            ),
            page: Math.max(Number(parsed.page) || 1, 1),
            perPage: Math.max(Math.min(Number(parsed.perPage) || 8, 50), 1),
            savedAt:
                typeof parsed.savedAt === 'string' &&
                parsed.savedAt.trim() !== ''
                    ? parsed.savedAt
                    : new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

function persistLaboratoryAuditExportRetryHandoff(
    context: LaboratoryAuditExportRetryHandoffContext,
) {
    if (typeof window === 'undefined') return;

    lastLaboratoryAuditExportRetryHandoff.value = context;
    try {
        window.sessionStorage.setItem(
            laboratoryAuditExportRetryHandoffSessionKey,
            JSON.stringify(context),
        );
    } catch {
        // Ignore storage write failures and keep in-memory state.
    }
}

function clearLastLaboratoryAuditExportRetryHandoff() {
    lastLaboratoryAuditExportRetryHandoff.value = null;
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.removeItem(
            laboratoryAuditExportRetryHandoffSessionKey,
        );
    } catch {
        // Ignore storage cleanup failures.
    }
}

function readLaboratoryAuditExportRetryResumeTelemetryFromSession(): LaboratoryAuditExportRetryResumeTelemetry {
    if (typeof window === 'undefined') {
        return {
            attempts: 0,
            successes: 0,
            failures: 0,
            lastAttemptAt: null,
            lastSuccessAt: null,
            lastFailureAt: null,
            lastFailureReason: null,
        };
    }

    try {
        const raw = window.sessionStorage.getItem(
            laboratoryAuditExportRetryTelemetrySessionKey,
        );
        if (!raw) {
            return {
                attempts: 0,
                successes: 0,
                failures: 0,
                lastAttemptAt: null,
                lastSuccessAt: null,
                lastFailureAt: null,
                lastFailureReason: null,
            };
        }

        const parsed = JSON.parse(
            raw,
        ) as Partial<LaboratoryAuditExportRetryResumeTelemetry>;
        if (!parsed || typeof parsed !== 'object') {
            return {
                attempts: 0,
                successes: 0,
                failures: 0,
                lastAttemptAt: null,
                lastSuccessAt: null,
                lastFailureAt: null,
                lastFailureReason: null,
            };
        }

        return {
            attempts: Math.max(Number(parsed.attempts) || 0, 0),
            successes: Math.max(Number(parsed.successes) || 0, 0),
            failures: Math.max(Number(parsed.failures) || 0, 0),
            lastAttemptAt:
                typeof parsed.lastAttemptAt === 'string'
                    ? parsed.lastAttemptAt
                    : null,
            lastSuccessAt:
                typeof parsed.lastSuccessAt === 'string'
                    ? parsed.lastSuccessAt
                    : null,
            lastFailureAt:
                typeof parsed.lastFailureAt === 'string'
                    ? parsed.lastFailureAt
                    : null,
            lastFailureReason:
                typeof parsed.lastFailureReason === 'string'
                    ? parsed.lastFailureReason
                    : null,
        };
    } catch {
        return {
            attempts: 0,
            successes: 0,
            failures: 0,
            lastAttemptAt: null,
            lastSuccessAt: null,
            lastFailureAt: null,
            lastFailureReason: null,
        };
    }
}

function persistLaboratoryAuditExportRetryResumeTelemetry() {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(
            laboratoryAuditExportRetryTelemetrySessionKey,
            JSON.stringify(laboratoryAuditExportRetryResumeTelemetry.value),
        );
    } catch {
        // Ignore storage write failures and keep in-memory state.
    }
}

function publishLaboratoryAuditExportRetryResumeTelemetryEvent(
    event: 'attempt' | 'success' | 'failure' | 'reset',
    failureReason?: string | null,
    context?: LaboratoryAuditExportRetryResumeTelemetryEventContext | null,
) {
    void apiRequest(
        'POST',
        '/platform/audit-export-jobs/retry-resume-telemetry/events',
        {
            body: {
                module: 'laboratory',
                event,
                failureReason: failureReason ?? null,
                targetResourceId: context?.targetResourceId ?? null,
                exportJobId: context?.exportJobId ?? null,
                handoffStatusGroup: context?.handoffStatusGroup ?? null,
                handoffPage: context?.handoffPage ?? null,
                handoffPerPage: context?.handoffPerPage ?? null,
            },
        },
    ).catch(() => {
        // Keep queue resume UX resilient if telemetry API is unavailable.
    });
}

function recordLaboratoryAuditExportRetryResumeAttempt(
    context?: LaboratoryAuditExportRetryResumeTelemetryEventContext | null,
) {
    laboratoryAuditExportRetryResumeTelemetry.value = {
        ...laboratoryAuditExportRetryResumeTelemetry.value,
        attempts: laboratoryAuditExportRetryResumeTelemetry.value.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
    };
    persistLaboratoryAuditExportRetryResumeTelemetry();
    publishLaboratoryAuditExportRetryResumeTelemetryEvent(
        'attempt',
        null,
        context,
    );
}

function recordLaboratoryAuditExportRetryResumeSuccess(
    context?: LaboratoryAuditExportRetryResumeTelemetryEventContext | null,
) {
    laboratoryAuditExportRetryResumeTelemetry.value = {
        ...laboratoryAuditExportRetryResumeTelemetry.value,
        successes:
            laboratoryAuditExportRetryResumeTelemetry.value.successes + 1,
        lastSuccessAt: new Date().toISOString(),
        lastFailureReason: null,
    };
    persistLaboratoryAuditExportRetryResumeTelemetry();
    publishLaboratoryAuditExportRetryResumeTelemetryEvent(
        'success',
        null,
        context,
    );
}

function recordLaboratoryAuditExportRetryResumeFailure(
    reason: string,
    context?: LaboratoryAuditExportRetryResumeTelemetryEventContext | null,
) {
    laboratoryAuditExportRetryResumeTelemetry.value = {
        ...laboratoryAuditExportRetryResumeTelemetry.value,
        failures: laboratoryAuditExportRetryResumeTelemetry.value.failures + 1,
        lastFailureAt: new Date().toISOString(),
        lastFailureReason: reason,
    };
    persistLaboratoryAuditExportRetryResumeTelemetry();
    publishLaboratoryAuditExportRetryResumeTelemetryEvent(
        'failure',
        reason,
        context,
    );
}

function resetLaboratoryAuditExportRetryResumeTelemetry() {
    laboratoryAuditExportRetryResumeTelemetry.value = {
        attempts: 0,
        successes: 0,
        failures: 0,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
    };
    persistLaboratoryAuditExportRetryResumeTelemetry();
    publishLaboratoryAuditExportRetryResumeTelemetryEvent('reset');
}

lastLaboratoryAuditExportRetryHandoff.value =
    readLaboratoryAuditExportRetryHandoffFromSession();
laboratoryAuditExportRetryResumeTelemetry.value =
    readLaboratoryAuditExportRetryResumeTelemetryFromSession();

const createForm = reactive<CreateForm>({
    patientId: queryParam('patientId'),
    appointmentId: queryParam('appointmentId'),
    admissionId: queryParam('admissionId'),
    labTestCatalogItemId: '',
    testCode: '',
    testName: '',
    priority: 'routine',
    specimenType: '',
    clinicalNotes: '',
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
const createLifecycleSourceOrder = ref<LaboratoryOrder | null>(null);
const createLifecycleSourceLoading = ref(false);
const createLifecycleSourceError = ref<string | null>(null);
const LABORATORY_CREATE_DRAFT_STORAGE_KEY =
    'ahs.laboratory-orders.create-draft.v2';
const createOrderBasket = ref<LaboratoryOrderBasketItem[]>([]);
let createOrderBasketItemCounter = 0;

function laboratoryCreateDraftMatchesInitialContext(
    draft: Pick<LaboratoryCreateDraft, 'patientId' | 'appointmentId' | 'admissionId'>,
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

const LABORATORY_CREATE_LEAVE_TITLE = 'Leave laboratory order?';
const LABORATORY_CREATE_LEAVE_DESCRIPTION = 'Laboratory order entry is still in progress. Stay here to finish the request, or leave this page and restart it later.';
const hasPendingCreateWorkflow = computed(() => Boolean(
    createServerDraftId.value.trim() ||
    createOrderBasket.value.length > 0 ||
    createForm.labTestCatalogItemId.trim()
    || createForm.testCode.trim()
    || createForm.testName.trim()
    || createForm.specimenType.trim()
    || createForm.clinicalNotes.trim()
    || createForm.priority !== 'routine',
));
const {
    confirmOpen: createLeaveConfirmOpen,
    confirmLeave: confirmPendingCreateWorkflowLeave,
    cancelLeave: cancelPendingCreateWorkflowLeave,
} = usePendingWorkflowLeaveGuard({
    shouldBlock: hasPendingCreateWorkflow,
    isSubmitting: createLoading,
    blockBrowserUnload: false,
});
const {
    confirmationDialogState: duplicateConfirmDialogState,
    requestConfirmation: requestDuplicateConfirmation,
    updateConfirmationDialogOpen: updateDuplicateConfirmationDialogOpen,
    confirmDialogAction: confirmDuplicateDialogAction,
} = useConfirmationDialog();

function contextCreateHref(
    path: string,
    options?: { includeTabNew?: boolean },
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

const consultationWorkflowLabel = computed(() =>
    hasCreateMedicalRecordContext.value
        ? 'Back to Current Consultation'
        : 'New Consultation',
);

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
const initialLaboratoryWorkspaceView =
    queryParam('tab').toLowerCase() === 'new'
        ? 'new'
        : 'queue';
const laboratoryWorkspaceView = ref<LaboratoryWorkspaceView>(
    parseLaboratoryWorkspaceView(initialLaboratoryWorkspaceView),
);
const createPatientContextLocked = ref(openedFromClinicalContext.value);
const createContextDialogOpen = ref(false);
const createContextDialogInitialSelection = reactive({
    patientId: createForm.patientId.trim(),
    appointmentId: createForm.appointmentId.trim(),
    admissionId: createForm.admissionId.trim(),
});
const {
    clearPersistedDraft: clearPersistedLaboratoryCreateDraft,
} = useWorkflowDraftPersistence<LaboratoryCreateDraft>({
    key: LABORATORY_CREATE_DRAFT_STORAGE_KEY,
    shouldPersist: hasPendingCreateWorkflow,
    capture: () => ({
        patientId: createForm.patientId,
        appointmentId: createForm.appointmentId,
        admissionId: createForm.admissionId,
        serverDraftId: createServerDraftId.value,
        labTestCatalogItemId: createForm.labTestCatalogItemId,
        testCode: createForm.testCode,
        testName: createForm.testName,
        priority: createForm.priority,
        specimenType: createForm.specimenType,
        clinicalNotes: createForm.clinicalNotes,
        basketItems: createOrderBasket.value.map((item) => ({ ...item })),
    }),
    restore: (draft) => {
        createForm.patientId = draft.patientId;
        createForm.appointmentId = draft.appointmentId;
        createForm.admissionId = draft.admissionId;
        createServerDraftId.value = draft.serverDraftId?.trim?.() ?? '';
        createForm.labTestCatalogItemId = draft.labTestCatalogItemId;
        createForm.testCode = draft.testCode;
        createForm.testName = draft.testName;
        createForm.priority = draft.priority;
        createForm.specimenType = draft.specimenType;
        createForm.clinicalNotes = draft.clinicalNotes;
        createOrderBasket.value = Array.isArray(draft.basketItems)
            ? draft.basketItems.map((item) => ({ ...item }))
            : [];
        createOrderBasketItemCounter = createOrderBasket.value.length;
    },
    canRestore: (draft) =>
        !hasInitialCreateLifecycleQuery &&
        laboratoryCreateDraftMatchesInitialContext(draft),
    onRestored: () => {
        const basketCount = createOrderBasket.value.length;
        if (createServerDraftId.value) {
            createMessage.value =
                'Restored your saved laboratory draft on this device.';
        } else {
            createMessage.value = basketCount > 0
                ? `Restored your in-progress laboratory basket (${basketCount} ${basketCount === 1 ? 'test' : 'tests'}) on this device.`
                : 'Restored your in-progress laboratory order draft on this device.';
        }
        setLaboratoryWorkspaceView('new', { scroll: false });
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
const detailsSheetTab = ref<LaboratoryDetailsTab>('overview');

let createAppointmentSummaryRequestId = 0;
let createAdmissionSummaryRequestId = 0;
let createContextSuggestionsRequestId = 0;
let pendingCreateAppointmentLinkSource: CreateContextLinkSource | null = null;
let pendingCreateAdmissionLinkSource: CreateContextLinkSource | null = null;

if (createForm.patientId.trim()) {
    searchForm.patientId = createForm.patientId.trim();
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

function clearSearchDebounce() {
    if (searchDebounceTimer !== null) {
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
    }
}

function createFieldError(key: string): string | null {
    return createErrors.value[key]?.[0] ?? null;
}

const hasCreateErrorFeedback = computed(
    () => Object.keys(createErrors.value).length > 0,
);

const hasCreateFeedback = computed(
    () => Boolean(createMessage.value) || hasCreateErrorFeedback.value,
);

const createErrorSummary = computed(() => {
    for (const messages of Object.values(createErrors.value)) {
        const firstMessage = messages?.[0]?.trim();
        if (firstMessage) return firstMessage;
    }

    return null;
});

function resetCreateMessages() {
    createMessage.value = null;
    createErrors.value = {};
}

function nextCreateOrderBasketItemKey(): string {
    createOrderBasketItemCounter += 1;
    return `lab-create-basket-${createOrderBasketItemCounter}`;
}

function resetCreateOrderDraftFields(options?: {
    preservePriority?: boolean;
    preserveClinicalNotes?: boolean;
}) {
    createForm.labTestCatalogItemId = '';
    clearCreateLabTestCatalogDerivedFields();
    createForm.specimenType = '';

    if (!options?.preservePriority) {
        createForm.priority = 'routine';
    }

    if (!options?.preserveClinicalNotes) {
        createForm.clinicalNotes = '';
    }
}

function discardCurrentCreateOrderDraft() {
    resetCreateMessages();
    resetCreateOrderDraftFields();
}

function restoreCreateOrderDraftFromBasketItem(
    item: LaboratoryOrderBasketItem,
): void {
    createForm.patientId = item.patientId;
    createForm.appointmentId = item.appointmentId;
    createForm.admissionId = item.admissionId;
    createForm.labTestCatalogItemId = item.labTestCatalogItemId;
    createForm.testCode = item.testCode;
    createForm.testName = item.testName;
    createForm.priority = item.priority;
    createForm.specimenType = item.specimenType;
    createForm.clinicalNotes = item.clinicalNotes;
}

function formatCreateLifecycleSourceOrderLabel(
    order: LaboratoryOrder | null,
): string {
    if (!order) return 'the selected laboratory order';

    const orderNumber = order.orderNumber?.trim();
    const testLabel = order.testName?.trim() || order.testCode?.trim();

    if (orderNumber && testLabel) {
        return `${orderNumber} (${testLabel})`;
    }

    return orderNumber || testLabel || 'the selected laboratory order';
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
        return 'Replacement order in progress';
    }

    if (createLifecycleMode.value === 'add_on') {
        return 'Linked follow-up order in progress';
    }

    return 'Order follow-up in progress';
});
const createLifecycleAlertDescription = computed(() => {
    if (createLifecycleMode.value === 'reorder') {
        return `This new laboratory order will replace ${createLifecycleSourceOrderLabel.value}. The original order remains in the chart history for audit.`;
    }

    if (createLifecycleMode.value === 'add_on') {
        return `This new laboratory order will be recorded as a linked follow-up to ${createLifecycleSourceOrderLabel.value}.`;
    }

    return '';
});
const createLifecycleClearActionLabel = computed(() => {
    if (createLifecycleMode.value === 'reorder') {
        return 'Start a new laboratory order';
    }

    if (createLifecycleMode.value === 'add_on') {
        return 'Start a new independent order';
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

function applyCreateLifecycleSourceOrder(order: LaboratoryOrder): void {
    createOrderBasket.value = [];
    clearPersistedLaboratoryCreateDraft();
    resetCreateMessages();
    createServerDraftId.value = '';

    createForm.patientId = order.patientId?.trim() ?? '';
    createForm.appointmentId = order.appointmentId?.trim() ?? '';
    createForm.admissionId = order.admissionId?.trim() ?? '';
    createForm.labTestCatalogItemId = order.labTestCatalogItemId?.trim() ?? '';
    createForm.testCode = order.testCode?.trim() ?? '';
    createForm.testName = order.testName?.trim() ?? '';
    createForm.priority = order.priority?.trim() || 'routine';
    createForm.specimenType = order.specimenType?.trim() ?? '';
    createForm.clinicalNotes = order.clinicalNotes?.trim() ?? '';
    createPatientContextLocked.value = Boolean(
        createForm.patientId.trim() &&
        (
            createForm.appointmentId.trim() ||
            createForm.admissionId.trim()
        ),
    );

    if (createForm.labTestCatalogItemId.trim()) {
        syncCreateLabTestCatalogSelection();
    }

    setLaboratoryWorkspaceView('new', { scroll: false });
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
    clearPersistedLaboratoryCreateDraft();
    setLaboratoryWorkspaceView('new', { scroll: false });

    try {
        await loadLabTestCatalog();

        const response = await apiRequest<{ data: LaboratoryOrder }>(
            'GET',
            `/laboratory-orders/${sourceOrderId}`,
        );
        createLifecycleSourceOrder.value = response.data;
        applyCreateLifecycleSourceOrder(response.data);
    } catch (error) {
        createLifecycleSourceOrder.value = null;
        createLifecycleSourceError.value = messageFromUnknown(
            error,
            'Unable to load the source laboratory order for this follow-up action.',
        );
    } finally {
        createLifecycleSourceLoading.value = false;
    }
}

function clinicalCatalogMetadataText(
    catalogItem: ClinicalCatalogItem | null,
    keys: string[],
): string | null {
    const metadata = catalogItem?.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return null;
    }

    for (const key of keys) {
        const value = metadata[key];
        if (typeof value === 'string' && value.trim() !== '') {
            return value.trim();
        }
    }

    return null;
}

function labTestCatalogSpecimenType(
    catalogItem: ClinicalCatalogItem | null,
): string | null {
    return clinicalCatalogMetadataText(catalogItem, [
        'sampleType',
        'specimenType',
        'specimen_type',
    ]);
}

function clearCreateLabTestCatalogDerivedFields() {
    createForm.testCode = '';
    createForm.testName = '';

    const previousSpecimenType =
        lastAppliedCreateLabTestCatalogSpecimenType.value.trim();
    if (
        previousSpecimenType &&
        normalizeLaboratoryToken(createForm.specimenType) ===
            normalizeLaboratoryToken(previousSpecimenType)
    ) {
        createForm.specimenType = '';
    }

    lastAppliedCreateLabTestCatalogSpecimenType.value = '';
}

function syncCreateLabTestCatalogSelection() {
    const catalogItemId = createForm.labTestCatalogItemId.trim();
    if (!catalogItemId) {
        clearCreateLabTestCatalogDerivedFields();
        return;
    }

    const catalogItem =
        labTestCatalogItems.value.find((item) => item.id === catalogItemId) ??
        null;
    if (catalogItem === null) return;

    createForm.testCode = catalogItem.code?.trim() ?? '';
    createForm.testName = catalogItem.name?.trim() ?? '';

    const catalogSpecimenType = labTestCatalogSpecimenType(catalogItem);
    const previousSpecimenType =
        lastAppliedCreateLabTestCatalogSpecimenType.value.trim();
    const currentSpecimenType = createForm.specimenType.trim();

    if (catalogSpecimenType) {
        if (
            !currentSpecimenType ||
            (previousSpecimenType &&
                normalizeLaboratoryToken(currentSpecimenType) ===
                    normalizeLaboratoryToken(previousSpecimenType))
        ) {
            createForm.specimenType = catalogSpecimenType;
        }

        lastAppliedCreateLabTestCatalogSpecimenType.value = catalogSpecimenType;
        return;
    }

    if (
        previousSpecimenType &&
        normalizeLaboratoryToken(currentSpecimenType) ===
            normalizeLaboratoryToken(previousSpecimenType)
    ) {
        createForm.specimenType = '';
    }

    lastAppliedCreateLabTestCatalogSpecimenType.value = '';
}

function isForbiddenError(error: unknown): boolean {
    return Boolean((error as { status?: number } | null)?.status === 403);
}

async function loadLabTestCatalog(force = false) {
    if (!canReadLabTestCatalog.value) {
        labTestCatalogItems.value = [];
        labTestCatalogError.value = null;
        labTestCatalogLoading.value = false;
        return;
    }

    if (labTestCatalogLoading.value) return;
    if (!force && labTestCatalogItems.value.length > 0) return;

    labTestCatalogLoading.value = true;
    labTestCatalogError.value = null;

    try {
        const response = await apiRequest<ClinicalCatalogItemListResponse>(
            'GET',
            '/platform/admin/clinical-catalogs/lab-tests',
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
        labTestCatalogItems.value = response.data ?? [];
    } catch (error) {
        labTestCatalogItems.value = [];
        labTestCatalogError.value = isForbiddenError(error)
            ? 'Active laboratory tests are catalog-governed. Request `platform.clinical-catalog.read` to use the picker.'
            : messageFromUnknown(
                  error,
                  'Unable to load active laboratory tests.',
              );
    } finally {
        labTestCatalogLoading.value = false;
        syncCreateLabTestCatalogSelection();
    }
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
        // Non-blocking. The form should still work if summary hydration fails.
    } finally {
        pendingPatientLookupIds.delete(normalizedId);
    }
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

function clearCreateClinicalLinks() {
    clearCreateAppointmentLink({ suppressAuto: false, focusEditor: false });
    clearCreateAdmissionLink({ suppressAuto: false, focusEditor: false });
}

function clearCreateAppointmentLink(options?: {
    suppressAuto?: boolean;
    focusEditor?: boolean;
}) {
    const shouldSuppress =
        (options?.suppressAuto ?? false) || createAppointmentLinkSource.value === 'auto';
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
        (options?.suppressAuto ?? false) || createAdmissionLinkSource.value === 'auto';
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
                (appointment.status?.trim()?.toLowerCase() ?? '') ===
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
                (admission.status?.trim()?.toLowerCase() ?? '') === 'admitted',
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

async function loadLaboratoryPermissions() {
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
        const hasSuperAdminAccess = isFacilitySuperAdmin.value;
        laboratoryReadPermissionState.value =
            hasSuperAdminAccess || names.has('laboratory.orders.read')
                ? 'allowed'
                : 'denied';
        laboratoryCreatePermissionState.value =
            hasSuperAdminAccess || names.has('laboratory.orders.create')
                ? 'allowed'
                : 'denied';
        laboratoryUpdateStatusPermissionState.value =
            hasSuperAdminAccess || names.has('laboratory.orders.update-status')
                ? 'allowed'
                : 'denied';
        laboratoryVerifyResultPermissionState.value =
            hasSuperAdminAccess || names.has('laboratory.orders.verify-result')
                ? 'allowed'
                : 'denied';
        medicalRecordsReadPermissionState.value =
            hasSuperAdminAccess || names.has('medical.records.read')
                ? 'allowed'
                : 'denied';
        appointmentsReadPermissionState.value =
            hasSuperAdminAccess || names.has('appointments.read')
                ? 'allowed'
                : 'denied';
        admissionsReadPermissionState.value =
            hasSuperAdminAccess || names.has('admissions.read')
                ? 'allowed'
                : 'denied';
        pharmacyReadPermissionState.value =
            hasSuperAdminAccess || names.has('pharmacy.orders.read')
                ? 'allowed'
                : 'denied';
        pharmacyCreatePermissionState.value =
            hasSuperAdminAccess || names.has('pharmacy.orders.create')
                ? 'allowed'
                : 'denied';
        billingReadPermissionState.value =
            hasSuperAdminAccess || names.has('billing.invoices.read')
                ? 'allowed'
                : 'denied';
        billingCreatePermissionState.value =
            hasSuperAdminAccess || names.has('billing.invoices.create')
                ? 'allowed'
                : 'denied';
        theatreReadPermissionState.value =
            hasSuperAdminAccess || names.has('theatre.procedures.read')
                ? 'allowed'
                : 'denied';
        theatreCreatePermissionState.value =
            hasSuperAdminAccess || names.has('theatre.procedures.create')
                ? 'allowed'
                : 'denied';
        labTestCatalogReadPermissionState.value =
            hasSuperAdminAccess || names.has('platform.clinical-catalog.read')
                ? 'allowed'
                : 'denied';
        canViewLaboratoryOrderAuditLogs.value =
            hasSuperAdminAccess ||
            names.has('laboratory-orders.view-audit-logs') ||
            names.has('laboratory.orders.view-audit-logs');

        if (!(hasSuperAdminAccess || names.has('laboratory.orders.create')) && laboratoryWorkspaceView.value === 'new') {
            laboratoryWorkspaceView.value = 'queue';
            syncLaboratoryWorkspaceViewToUrl('queue');
        }
    } catch {
        laboratoryReadPermissionState.value = 'denied';
        laboratoryCreatePermissionState.value = 'denied';
        laboratoryUpdateStatusPermissionState.value = 'denied';
        laboratoryVerifyResultPermissionState.value = 'denied';
        medicalRecordsReadPermissionState.value = 'denied';
        appointmentsReadPermissionState.value = 'denied';
        admissionsReadPermissionState.value = 'denied';
        pharmacyReadPermissionState.value = 'denied';
        pharmacyCreatePermissionState.value = 'denied';
        billingReadPermissionState.value = 'denied';
        billingCreatePermissionState.value = 'denied';
        theatreReadPermissionState.value = 'denied';
        theatreCreatePermissionState.value = 'denied';
        labTestCatalogReadPermissionState.value = 'denied';
        canViewLaboratoryOrderAuditLogs.value = false;
    }
}

async function hydrateVisiblePatients(rows: LaboratoryOrder[]) {
    const ids = [
        ...new Set(
            rows
                .map((row) => row.patientId)
                .filter((id): id is string => Boolean(id)),
        ),
    ];
    await Promise.all(ids.map((id) => hydratePatientSummary(id)));
}

async function loadOrders() {
    if (!canReadLaboratoryOrders.value) {
        orders.value = [];
        pagination.value = null;
        listLoading.value = false;
        pageLoading.value = false;
        return;
    }

    listLoading.value = true;
    listErrors.value = [];

    try {
        const response = await apiRequest<LaboratoryOrderListResponse>(
            'GET',
            '/laboratory-orders',
            {
                query: {
                    q: searchForm.q.trim() || null,
                    patientId: searchForm.patientId.trim() || null,
                    status: searchForm.status || null,
                    priority: searchForm.priority || null,
                    from: searchForm.from
                        ? `${searchForm.from} 00:00:00`
                        : null,
                    to: searchForm.to ? `${searchForm.to} 23:59:59` : null,
                    page: searchForm.page,
                    perPage: searchForm.perPage,
                    sortBy: 'orderedAt',
                    sortDir: 'desc',
                },
            },
        );

        orders.value = response.data;
        pagination.value = response.meta;
        void hydrateVisiblePatients(response.data);
    } catch (error) {
        orders.value = [];
        pagination.value = null;
        listErrors.value.push(
            error instanceof Error
                ? error.message
                : 'Unable to load laboratory orders.',
        );
    } finally {
        listLoading.value = false;
        pageLoading.value = false;
    }
}

async function loadOrderStatusCounts() {
    if (!canReadLaboratoryOrders.value) {
        laboratoryOrderStatusCounts.value = null;
        return;
    }

    try {
        const response = await apiRequest<LaboratoryOrderStatusCountsResponse>(
            'GET',
            '/laboratory-orders/status-counts',
            {
                query: {
                    q: searchForm.q.trim() || null,
                    patientId: searchForm.patientId.trim() || null,
                    priority: searchForm.priority || null,
                    from: searchForm.from
                        ? `${searchForm.from} 00:00:00`
                        : null,
                    to: searchForm.to ? `${searchForm.to} 23:59:59` : null,
                },
            },
        );
        laboratoryOrderStatusCounts.value = response.data;
    } catch {
        laboratoryOrderStatusCounts.value = null;
    }
}

async function loadLaboratoryExceptionOrders() {
    if (!canReadLaboratoryOrders.value) {
        laboratoryExceptionOrders.value = [];
        laboratoryExceptionLoading.value = false;
        laboratoryExceptionError.value = null;
        return;
    }

    laboratoryExceptionLoading.value = true;
    laboratoryExceptionError.value = null;

    try {
        const response = await apiRequest<LaboratoryOrderListResponse>(
            'GET',
            '/laboratory-orders',
            {
                query: {
                    q: searchForm.q.trim() || null,
                    patientId: searchForm.patientId.trim() || null,
                    priority: searchForm.priority || null,
                    from: searchForm.from
                        ? `${searchForm.from} 00:00:00`
                        : null,
                    to: searchForm.to ? `${searchForm.to} 23:59:59` : null,
                    page: 1,
                    perPage: 50,
                    sortBy: 'orderedAt',
                    sortDir: 'desc',
                },
            },
        );

        laboratoryExceptionOrders.value = response.data;
        void hydrateVisiblePatients(response.data);
    } catch (error) {
        laboratoryExceptionOrders.value = [];
        laboratoryExceptionError.value =
            error instanceof Error
                ? error.message
                : 'Unable to load laboratory exception queue.';
    } finally {
        laboratoryExceptionLoading.value = false;
    }
}

async function loadDetailsTrendOrders(order: LaboratoryOrder) {
    const patientId = order.patientId?.trim() ?? '';
    if (!patientId || !laboratoryOrdersMatchTrend(order, order)) {
        detailsSheetTrendOrders.value = [];
        detailsSheetTrendLoading.value = false;
        detailsSheetTrendError.value = null;
        return;
    }

    detailsSheetTrendLoading.value = true;
    detailsSheetTrendError.value = null;

    try {
        const response = await apiRequest<LaboratoryOrderListResponse>(
            'GET',
            '/laboratory-orders',
            {
                query: {
                    patientId,
                    page: 1,
                    perPage: 25,
                    sortBy: 'orderedAt',
                    sortDir: 'desc',
                },
            },
        );

        const comparableOrders = response.data.filter((candidateOrder) =>
            candidateOrder.id === order.id
                ? true
                : laboratoryOrdersMatchTrend(order, candidateOrder),
        );

        if (
            !comparableOrders.some(
                (candidateOrder) => candidateOrder.id === order.id,
            )
        ) {
            comparableOrders.unshift(order);
        }

        detailsSheetTrendOrders.value = comparableOrders;
    } catch (error) {
        detailsSheetTrendOrders.value = [];
        detailsSheetTrendError.value = messageFromUnknown(
            error,
            'Unable to load laboratory result history.',
        );
    } finally {
        detailsSheetTrendLoading.value = false;
    }
}

async function refreshPage() {
    clearSearchDebounce();
    await Promise.all([loadScope(), loadLaboratoryPermissions()]);
    await Promise.all([
        loadOrders(),
        loadOrderStatusCounts(),
        loadLaboratoryExceptionOrders(),
        loadLabTestCatalog(),
    ]);
    await applyLaboratoryAuditExportRetryHandoff();
    await loadCreateLifecycleSourceOrder();
}

async function initialPageLoad() {
    clearSearchDebounce();
    if (!scope.value || !isLaboratoryReadPermissionResolved.value) {
        await refreshPage();
        return;
    }

    await Promise.all([
        loadOrders(),
        loadOrderStatusCounts(),
        loadLaboratoryExceptionOrders(),
        loadLabTestCatalog(),
    ]);
    await applyLaboratoryAuditExportRetryHandoff();
    await loadCreateLifecycleSourceOrder();
}

function buildCreateLaboratoryOrderPayload(
    item: Pick<
        LaboratoryOrderBasketItem,
        | 'patientId'
        | 'appointmentId'
        | 'admissionId'
        | 'labTestCatalogItemId'
        | 'testCode'
        | 'testName'
        | 'priority'
        | 'specimenType'
        | 'clinicalNotes'
    >,
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
        labTestCatalogItemId: item.labTestCatalogItemId.trim() || null,
        testCode: item.testCode.trim() || null,
        testName: item.testName.trim() || null,
        priority: item.priority,
        specimenType: item.specimenType.trim() || null,
        clinicalNotes: item.clinicalNotes.trim() || null,
    };
}

function generateClinicalOrderSessionId(prefix: string): string {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function confirmLaboratoryDuplicateOrdering(
    item: Pick<
        LaboratoryOrderBasketItem,
        | 'patientId'
        | 'appointmentId'
        | 'admissionId'
        | 'labTestCatalogItemId'
        | 'testCode'
        | 'testName'
    >,
): Promise<boolean> {
    const response = await apiRequest<DuplicateCheckResponse<LaboratoryOrder>>(
        'GET',
        '/laboratory-orders/duplicate-check',
        {
            query: {
                patientId: item.patientId.trim(),
                appointmentId: item.appointmentId.trim() || null,
                admissionId: item.admissionId.trim() || null,
                labTestCatalogItemId: item.labTestCatalogItemId.trim() || null,
                testCode: item.testCode.trim() || null,
            },
        },
    );

    if (!response.data.messages.length) {
        return true;
    }

    const title = item.testName.trim() || item.testCode.trim() || 'this laboratory test';

    return requestDuplicateConfirmation({
        title: `Duplicate advisory for ${title}`,
        description:
            'An active laboratory order for this test already exists in the current encounter.',
        details: response.data.messages,
        cancelLabel: 'Review existing orders',
        confirmLabel: 'Continue ordering',
    });
}

function validateCurrentCreateOrderDraft(): LaboratoryOrderBasketItem | null {
    resetCreateMessages();

    if (!createForm.patientId.trim()) {
        createErrors.value = {
            patientId: [
                'Select a patient before creating or queueing a laboratory order.',
            ],
        };
        openCreateContextDialog('patient');
        return null;
    }

    if (!canReadLabTestCatalog.value) {
        createErrors.value = {
            labTestCatalogItemId: [
                'Clinical catalog access is required to create a laboratory order from this workspace.',
            ],
        };
        return null;
    }

    if (!selectedCreateLabTestCatalogItem.value) {
        createErrors.value = {
            labTestCatalogItemId: [
                'Select an active laboratory test from the clinical catalog.',
            ],
        };
        return null;
    }

    syncCreateLabTestCatalogSelection();

    return {
        clientKey: nextCreateOrderBasketItemKey(),
        patientId: createForm.patientId.trim(),
        appointmentId: createForm.appointmentId.trim(),
        admissionId: createForm.admissionId.trim(),
        labTestCatalogItemId: createForm.labTestCatalogItemId.trim(),
        testCode: createForm.testCode.trim(),
        testName: createForm.testName.trim(),
        priority: createForm.priority,
        specimenType: createForm.specimenType.trim(),
        clinicalNotes: createForm.clinicalNotes.trim(),
    };
}

async function addCurrentCreateOrderToBasket(): Promise<void> {
    if (createLoading.value || !canUseCreateOrderBasket.value) return;

    resetCreateMessages();

    if (hasSavedCreateDraft.value) {
        notifyError(
            'Discard or sign the saved laboratory draft before adding another test to the basket.',
        );
        return;
    }

    const draftItem = validateCurrentCreateOrderDraft();
    if (!draftItem) return;

    if (!(await confirmLaboratoryDuplicateOrdering(draftItem))) {
        return;
    }

    const duplicateItem = createOrderBasket.value.find((item) =>
        item.patientId === draftItem.patientId &&
        item.appointmentId === draftItem.appointmentId &&
        item.admissionId === draftItem.admissionId &&
        item.labTestCatalogItemId === draftItem.labTestCatalogItemId &&
        item.priority === draftItem.priority &&
        item.specimenType === draftItem.specimenType &&
        item.clinicalNotes === draftItem.clinicalNotes,
    );

    if (duplicateItem) {
        createErrors.value = {
            labTestCatalogItemId: [
                'This laboratory test is already in the basket with the same details.',
            ],
        };
        return;
    }

    createOrderBasket.value = [...createOrderBasket.value, draftItem];
    createMessage.value = `Added ${draftItem.testName || draftItem.testCode || 'laboratory test'} to the basket.`;
    resetCreateOrderDraftFields();
}

function removeCreateOrderBasketItem(clientKey: string): void {
    createOrderBasket.value = createOrderBasket.value.filter(
        (item) => item.clientKey !== clientKey,
    );

    if (!hasPendingCreateWorkflow.value) {
        clearPersistedLaboratoryCreateDraft();
    }
}

function clearCreateOrderBasket(): void {
    createOrderBasket.value = [];

    if (!hasPendingCreateWorkflow.value) {
        clearPersistedLaboratoryCreateDraft();
    }
}

async function saveCreateDraftRequest(options?: {
    silent?: boolean;
}): Promise<LaboratoryOrder | null> {
    const draftItem = validateCurrentCreateOrderDraft();
    if (!draftItem) return null;
    if (!(await confirmLaboratoryDuplicateOrdering(draftItem))) return null;

    const wasSavedDraft = hasSavedCreateDraft.value;
    try {
        const response = wasSavedDraft
            ? await apiRequest<{ data?: LaboratoryOrder }>(
                'PATCH',
                `/laboratory-orders/${createServerDraftId.value.trim()}`,
                {
                    body: {
                        labTestCatalogItemId: draftItem.labTestCatalogItemId,
                        testCode: draftItem.testCode,
                        testName: draftItem.testName,
                        priority: draftItem.priority,
                        specimenType: draftItem.specimenType,
                        clinicalNotes: draftItem.clinicalNotes,
                    },
                },
            )
            : await apiRequest<{ data?: LaboratoryOrder }>(
                'POST',
                '/laboratory-orders',
                {
                    body: buildCreateLaboratoryOrderPayload(draftItem, {
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
                ? 'Saved your laboratory draft on this device. Sign it when you are ready.'
                : 'Laboratory draft saved on this device. Sign it when you are ready.';
            notifySuccess('Laboratory draft saved.');
        }

        return draft;
    } catch (error) {
        const apiError = error as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
            openCreateContextDialogForValidationErrors(apiError.payload.errors);
        }
        notifyError(
            messageFromUnknown(error, 'Unable to save laboratory draft.'),
        );
        return null;
    }
}

async function createOrder() {
    if (createLoading.value) return;

    createLoading.value = true;
    resetCreateMessages();
    listErrors.value = [];

    try {
        const draft = await saveCreateDraftRequest({ silent: true });
        if (!draft?.id) return;

        const patientId = draft.patientId?.trim() ?? createForm.patientId.trim();
        const response = await apiRequest<{ data?: LaboratoryOrder }>(
            'POST',
            `/laboratory-orders/${draft.id}/sign`,
        );
        const signedOrder = response.data ?? draft;

        createMessage.value = `Signed ${signedOrder.orderNumber ?? 'laboratory order'} successfully.`;
        if (createMessage.value) notifySuccess(createMessage.value);
        resetCreateOrderDraftFields();
        createServerDraftId.value = '';
        clearPersistedLaboratoryCreateDraft();
        clearCreateLifecycleMode();
        searchForm.q =
            signedOrder.orderNumber?.trim() ||
            signedOrder.id ||
            '';
        searchForm.patientId = signedOrder.patientId?.trim() || patientId;
        searchForm.status = 'ordered';
        searchForm.from = today;
        searchForm.to = '';
        searchForm.page = 1;
        setLaboratoryWorkspaceView('queue', { scroll: false });
        await Promise.all([
            loadOrders(),
            loadOrderStatusCounts(),
            loadLaboratoryExceptionOrders(),
        ]);
        await nextTick();
        scrollToLaboratoryQueue({ focusSearch: true });
    } catch (error) {
        const apiError = error as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
            openCreateContextDialogForValidationErrors(apiError.payload.errors);
        } else {
            notifyError(
                apiError.message ?? 'Unable to create laboratory order.',
            );
        }
    } finally {
        createLoading.value = false;
    }
}

async function saveCreateDraft(): Promise<void> {
    if (
        createLoading.value ||
        !canCreateLaboratoryOrders.value ||
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

    createLoading.value = true;
    resetCreateMessages();
    listErrors.value = [];

    try {
        await saveCreateDraftRequest();
    } finally {
        createLoading.value = false;
    }
}

async function discardSavedCreateDraft(): Promise<void> {
    if (!hasSavedCreateDraft.value || createLoading.value) {
        return;
    }

    createLoading.value = true;
    resetCreateMessages();
    listErrors.value = [];

    try {
        await apiRequest(
            'DELETE',
            `/laboratory-orders/${createServerDraftId.value.trim()}/draft`,
        );
        createServerDraftId.value = '';
        resetCreateOrderDraftFields();
        clearPersistedLaboratoryCreateDraft();
        clearCreateLifecycleMode();
        createMessage.value = 'Discarded the saved laboratory draft from this device.';
        notifySuccess('Laboratory draft discarded.');
    } catch (error) {
        const apiError = error as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
            openCreateContextDialogForValidationErrors(apiError.payload.errors);
        }
        notifyError(
            messageFromUnknown(error, 'Unable to discard laboratory draft.'),
        );
    } finally {
        createLoading.value = false;
    }
}

async function submitCreateOrderBasket() {
    if (
        createLoading.value ||
        !canUseCreateOrderBasket.value ||
        createOrderBasket.value.length === 0
    ) {
        return;
    }

    createLoading.value = true;
    resetCreateMessages();
    listErrors.value = [];

    const queuedItems = [...createOrderBasket.value];
    const createdOrders: LaboratoryOrder[] = [];
    const orderSessionId = generateClinicalOrderSessionId('lab-session');

    try {
        for (const item of queuedItems) {
            const response = await apiRequest<{ data: LaboratoryOrder }>(
                'POST',
                '/laboratory-orders',
                {
                    body: buildCreateLaboratoryOrderPayload(item, {
                        orderSessionId,
                    }),
                },
            );

            createdOrders.push(response.data);
        }

        createOrderBasket.value = [];
        clearPersistedLaboratoryCreateDraft();
        createMessage.value = `Created ${createdOrders.length} laboratory ${createdOrders.length === 1 ? 'order' : 'orders'} successfully.`;
        if (createMessage.value) notifySuccess(createMessage.value);
        searchForm.q =
            createdOrders.length === 1
                ? createdOrders[0]?.orderNumber?.trim() ||
                  createdOrders[0]?.id ||
                  ''
                : '';
        searchForm.patientId = createdOrders[0]?.patientId?.trim() || '';
        searchForm.status = 'ordered';
        searchForm.from = today;
        searchForm.to = '';
        searchForm.page = 1;
        setLaboratoryWorkspaceView('queue', { scroll: false });
        await Promise.all([
            loadOrders(),
            loadOrderStatusCounts(),
            loadLaboratoryExceptionOrders(),
        ]);
        await nextTick();
        scrollToLaboratoryQueue({ focusSearch: true });
    } catch (error) {
        const createdCount = createdOrders.length;
        const failedItem = queuedItems[createdCount] ?? null;
        const remainingItems = queuedItems.slice(createdCount + 1);
        createOrderBasket.value = remainingItems;

        if (failedItem) {
            restoreCreateOrderDraftFromBasketItem(failedItem);
        }

        const apiError = error as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
            openCreateContextDialogForValidationErrors(apiError.payload.errors);
        }

        if (createdCount > 0) {
            createMessage.value = `Created ${createdCount} laboratory ${createdCount === 1 ? 'order' : 'orders'} before the basket paused.`;
        }

        notifyError(
            createdCount > 0
                ? 'Laboratory basket paused before all tests were submitted.'
                : apiError.message ?? 'Unable to submit the laboratory basket.',
        );

        if (!hasPendingCreateWorkflow.value) {
            clearPersistedLaboratoryCreateDraft();
        }
    } finally {
        createLoading.value = false;
    }
}

function canExecuteLaboratoryWorkflowAction(
    action: LaboratoryOrderStatusAction,
): boolean {
    if (action === 'verify') return canVerifyLaboratoryOrderResult.value;
    return canUpdateLaboratoryOrderStatus.value;
}
function openOrderStatusDialog(
    order: LaboratoryOrder,
    status: LaboratoryOrderStatusAction,
) {
    if (!canExecuteLaboratoryWorkflowAction(status)) return;
    statusDialogOrder.value = order;
    statusDialogAction.value = status;
    statusDialogError.value = null;
    statusDialogReason.value =
        status === 'cancelled' ? (order.statusReason ?? '') : '';
    statusDialogResultSummary.value =
        status === 'completed' ? (order.resultSummary ?? '') : '';
    statusDialogVerificationNote.value =
        status === 'verify' ? (order.verificationNote ?? '') : '';
    statusDialogResultFlag.value = '';
    statusDialogResultValue.value = '';
    statusDialogResultUnit.value = '';
    statusDialogReferenceRange.value = '';
    statusDialogInterpretation.value = '';
    statusDialogRecommendation.value = '';
    statusDialogTab.value =
        status === 'completed'
            ? 'results'
            : status === 'verify'
              ? 'verification'
              : 'overview';
    statusDialogOpen.value = true;
    completeResultSheetOpen.value = false;

    if (status === 'completed') {
        void refreshLaboratoryStatusDialogOrder(order.id);
    }
}

function closeOrderStatusDialog() {
    statusDialogOpen.value = false;
    completeResultSheetOpen.value = false;
    statusDialogError.value = null;
    statusDialogStockCheckRequestKey.value += 1;
    statusDialogStockCheckLoading.value = false;
    statusDialogStockCheckError.value = null;
    statusDialogTab.value = 'overview';
}

async function openOrderDetailsSheet(
    order: LaboratoryOrder,
    options?: {
        focusWorkflowActionKey?: string | null;
        retryHandoffContext?: Pick<
            LaboratoryAuditExportRetryHandoffContext,
            'statusGroup' | 'page' | 'perPage'
        >;
    },
) {
    resetDetailsAuditLogsFilters({ autoLoad: false });
    resetDetailsAuditExportJobsFilters({ autoLoad: false });
    if (options?.retryHandoffContext) {
        applyLaboratoryAuditExportRetryHandoffFilters(
            options.retryHandoffContext,
        );
    }
    detailsSheetTab.value = options?.retryHandoffContext
        ? 'audit'
        : laboratoryDetailsTabForWorkflowAction(options?.focusWorkflowActionKey);
    detailsSheetOrder.value = order;
    detailsSheetOpen.value = true;
    detailsSheetTrendOrders.value = [];
    detailsSheetTrendError.value = null;
    detailsSheetAuditLogs.value = [];
    detailsSheetAuditLogsMeta.value = null;
    detailsSheetAuditLogsError.value = null;
    detailsSheetAuditExportJobs.value = [];
    detailsSheetAuditExportJobsMeta.value = null;
    detailsSheetAuditExportJobsError.value = null;
    detailsSheetAuditExportFocusJobId.value = null;
    detailsSheetAuditExportPinnedHandoffJob.value = null;
    detailsSheetAuditExportHandoffMessage.value = null;
    detailsSheetAuditExportHandoffError.value = false;

    const detailLoads: Promise<unknown>[] = [];
    detailLoads.push(loadDetailsTrendOrders(order));
    if (canViewLaboratoryOrderAuditLogs.value) {
        detailLoads.push(loadOrderAuditLogs(order.id));
        detailLoads.push(loadOrderAuditExportJobs(order.id));
    }
    if (detailLoads.length > 0) {
        await Promise.allSettled(detailLoads);
    }
}

function closeOrderDetailsSheet() {
    detailsSheetOpen.value = false;
    detailsSheetOrder.value = null;
    detailsSheetTab.value = 'overview';
    detailsSheetTrendOrders.value = [];
    detailsSheetTrendLoading.value = false;
    detailsSheetTrendError.value = null;
    detailsSheetAuditLogs.value = [];
    detailsSheetAuditLogsMeta.value = null;
    detailsSheetAuditLogsError.value = null;
    detailsSheetAuditExportJobs.value = [];
    detailsSheetAuditExportJobsMeta.value = null;
    detailsSheetAuditExportJobsError.value = null;
    detailsSheetAuditExportRetryingJobId.value = null;
    detailsSheetAuditExportFocusJobId.value = null;
    detailsSheetAuditExportPinnedHandoffJob.value = null;
    detailsSheetAuditExportHandoffMessage.value = null;
    detailsSheetAuditExportHandoffError.value = false;
}

function detailsSheetAuditLogsQuery(page: number, perPage: number) {
    return {
        page,
        perPage,
        q: detailsSheetAuditLogsFilters.q.trim() || null,
        action: detailsSheetAuditLogsFilters.action.trim() || null,
        actorType: detailsSheetAuditLogsFilters.actorType || null,
        actorId: detailsSheetAuditLogsFilters.actorId.trim() || null,
        from: detailsSheetAuditLogsFilters.from
            ? `${detailsSheetAuditLogsFilters.from} 00:00:00`
            : null,
        to: detailsSheetAuditLogsFilters.to
            ? `${detailsSheetAuditLogsFilters.to} 23:59:59`
            : null,
    };
}

function detailsSheetAuditLogsExportQuery() {
    return {
        q: detailsSheetAuditLogsFilters.q.trim() || null,
        action: detailsSheetAuditLogsFilters.action.trim() || null,
        actorType: detailsSheetAuditLogsFilters.actorType || null,
        actorId: detailsSheetAuditLogsFilters.actorId.trim() || null,
        from: detailsSheetAuditLogsFilters.from
            ? `${detailsSheetAuditLogsFilters.from} 00:00:00`
            : null,
        to: detailsSheetAuditLogsFilters.to
            ? `${detailsSheetAuditLogsFilters.to} 23:59:59`
            : null,
    };
}

function detailsSheetAuditExportJobsQuery(page: number, perPage: number) {
    return {
        page,
        perPage,
        statusGroup: detailsSheetAuditExportJobsFilters.statusGroup,
    };
}

async function loadOrderAuditLogs(orderId: string) {
    if (!canViewLaboratoryOrderAuditLogs.value) {
        detailsSheetAuditLogsLoading.value = false;
        detailsSheetAuditLogsError.value = null;
        detailsSheetAuditLogs.value = [];
        detailsSheetAuditLogsMeta.value = null;
        return;
    }

    detailsSheetAuditLogsLoading.value = true;
    detailsSheetAuditLogsError.value = null;

    try {
        const response = await apiRequest<LaboratoryOrderAuditLogListResponse>(
            'GET',
            `/laboratory-orders/${orderId}/audit-logs`,
            {
                query: detailsSheetAuditLogsQuery(
                    detailsSheetAuditLogsFilters.page,
                    detailsSheetAuditLogsFilters.perPage,
                ),
            },
        );

        detailsSheetAuditLogs.value = response.data;
        detailsSheetAuditLogsMeta.value = response.meta;
    } catch (error) {
        detailsSheetAuditLogs.value = [];
        detailsSheetAuditLogsMeta.value = null;
        detailsSheetAuditLogsError.value = messageFromUnknown(
            error,
            'Unable to load laboratory audit trail.',
        );
    } finally {
        detailsSheetAuditLogsLoading.value = false;
    }
}

async function loadOrderAuditExportJobs(orderId: string) {
    if (!canViewLaboratoryOrderAuditLogs.value) {
        detailsSheetAuditExportJobsLoading.value = false;
        detailsSheetAuditExportJobsError.value = null;
        detailsSheetAuditExportJobs.value = [];
        detailsSheetAuditExportJobsMeta.value = null;
        return;
    }

    detailsSheetAuditExportJobsLoading.value = true;
    detailsSheetAuditExportJobsError.value = null;

    try {
        const response =
            await apiRequest<LaboratoryOrderAuditExportJobListResponse>(
                'GET',
                `/laboratory-orders/${orderId}/audit-logs/export-jobs`,
                {
                    query: detailsSheetAuditExportJobsQuery(
                        detailsSheetAuditExportJobsFilters.page,
                        detailsSheetAuditExportJobsFilters.perPage,
                    ),
                },
            );

        detailsSheetAuditExportJobs.value = response.data;
        detailsSheetAuditExportJobsMeta.value = response.meta;
        if (
            detailsSheetAuditExportPinnedHandoffJob.value &&
            response.data.some(
                (job) =>
                    job.id ===
                    detailsSheetAuditExportPinnedHandoffJob.value?.id,
            )
        ) {
            detailsSheetAuditExportPinnedHandoffJob.value = null;
        }
    } catch (error) {
        detailsSheetAuditExportJobs.value = [];
        detailsSheetAuditExportJobsMeta.value = null;
        detailsSheetAuditExportJobsError.value = messageFromUnknown(
            error,
            'Unable to load audit export jobs.',
        );
    } finally {
        detailsSheetAuditExportJobsLoading.value = false;
    }
}

async function fetchLaboratoryAuditExportJobById(
    orderId: string,
    jobId: string,
): Promise<LaboratoryOrderAuditExportJob | null> {
    try {
        const response =
            await apiRequest<LaboratoryOrderAuditExportJobResponse>(
                'GET',
                `/laboratory-orders/${orderId}/audit-logs/export-jobs/${jobId}`,
            );
        return response.data;
    } catch {
        return null;
    }
}

function clearLaboratoryAuditExportRetryHandoffQueryParams() {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const keys = [
        'auditExportJobId',
        'auditAction',
        'auditExportStatusGroup',
        'auditExportPage',
        'auditExportPerPage',
    ];

    let changed = false;
    for (const key of keys) {
        if (!url.searchParams.has(key)) continue;
        url.searchParams.delete(key);
        changed = true;
    }

    if (!changed) return;

    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
}

async function focusLaboratoryAuditExportRetryHandoff(
    jobId: string,
): Promise<boolean> {
    if (!jobId || !detailsSheetOrder.value) return false;

    const focusJob = detailsSheetAuditExportJobs.value.find(
        (job) => job.id === jobId,
    );
    if (focusJob) {
        detailsSheetAuditExportFocusJobId.value = focusJob.id;
        detailsSheetAuditExportPinnedHandoffJob.value = null;
        detailsSheetAuditExportHandoffError.value = false;
        detailsSheetAuditExportHandoffMessage.value =
            'Retry handoff active. Use the highlighted export job retry action.';

        await nextTick();
        const row = document.getElementById(
            `lab-audit-export-job-${focusJob.id}`,
        );
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const retryButton = row?.querySelector<HTMLButtonElement>(
            `[data-audit-export-retry-job-id="${focusJob.id}"]`,
        );
        retryButton?.focus();
        return true;
    }

    const resolvedJob = await fetchLaboratoryAuditExportJobById(
        detailsSheetOrder.value.id,
        jobId,
    );
    if (!resolvedJob) {
        detailsSheetAuditExportFocusJobId.value = null;
        detailsSheetAuditExportPinnedHandoffJob.value = null;
        detailsSheetAuditExportHandoffError.value = true;
        detailsSheetAuditExportHandoffMessage.value =
            'Retry handoff loaded this order, but the target export job could not be resolved. Refresh jobs and retry from this order details sheet.';
        return false;
    }

    detailsSheetAuditExportPinnedHandoffJob.value = resolvedJob;
    detailsSheetAuditExportFocusJobId.value = resolvedJob.id;
    detailsSheetAuditExportHandoffError.value = false;
    detailsSheetAuditExportHandoffMessage.value =
        'Retry handoff resolved a job outside the current page. Use the pinned handoff row below.';

    await nextTick();
    const row = document.getElementById(
        `lab-audit-export-job-handoff-${resolvedJob.id}`,
    );
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const retryButton = row?.querySelector<HTMLButtonElement>(
        `[data-audit-export-retry-job-id="${resolvedJob.id}"]`,
    );
    retryButton?.focus();
    return true;
}

function applyLaboratoryAuditExportRetryHandoffFilters(
    context: Pick<
        LaboratoryAuditExportRetryHandoffContext,
        'statusGroup' | 'page' | 'perPage'
    >,
) {
    detailsSheetAuditExportJobsFilters.statusGroup = context.statusGroup;
    detailsSheetAuditExportJobsFilters.page = context.page;
    detailsSheetAuditExportJobsFilters.perPage = context.perPage;
}

async function fetchLaboratoryOrderById(
    orderId: string,
): Promise<LaboratoryOrder | null> {
    try {
        const response = await apiRequest<{ data: LaboratoryOrder }>(
            'GET',
            `/laboratory-orders/${orderId}`,
        );
        return response.data;
    } catch {
        return null;
    }
}

function laboratoryDetailsTabForWorkflowAction(
    actionKey: string | null | undefined,
): LaboratoryDetailsTab {
    const normalizedAction = String(actionKey ?? '').trim();

    if (normalizedAction === 'review_order') {
        return 'journey';
    }

    return 'overview';
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
        targetOrder = await fetchLaboratoryOrderById(orderId);
    }

    if (targetOrder) {
        await openOrderDetailsSheet(targetOrder, {
            focusWorkflowActionKey: workflowActionKey,
        });
    } else {
        listErrors.value.push('Unable to open the requested laboratory order from the patient chart.');
    }

    clearQueryParamFromUrl('focusOrderId');
    clearQueryParamFromUrl('focusWorkflowActionKey');
}

async function applyLaboratoryAuditExportRetryHandoff() {
    if (!auditExportRetryHandoffPending.value) return;
    auditExportRetryHandoffPending.value = false;
    auditExportRetryHandoffCompletedMessage.value = null;

    const targetOrderId = searchForm.q.trim();
    if (!targetOrderId) {
        listErrors.value.push(
            'Audit export retry handoff skipped: target laboratory order was not provided.',
        );
        return;
    }

    let targetOrder = orders.value.find((order) => order.id === targetOrderId);
    if (!targetOrder) {
        targetOrder = await fetchLaboratoryOrderById(targetOrderId);
        if (!targetOrder) {
            listErrors.value.push(
                'Audit export retry handoff target is not visible in current laboratory queue results, and direct order lookup failed.',
            );
            return;
        }
    }

    const handoffContext: LaboratoryAuditExportRetryHandoffContext = {
        targetOrderId,
        jobId: auditExportRetryHandoffJobId,
        statusGroup: auditExportRetryHandoffStatusGroup,
        page: auditExportRetryHandoffPage,
        perPage: auditExportRetryHandoffPerPage,
        savedAt: new Date().toISOString(),
    };

    await openOrderDetailsSheet(targetOrder, {
        retryHandoffContext: handoffContext,
    });
    const focused = await focusLaboratoryAuditExportRetryHandoff(
        handoffContext.jobId,
    );
    if (focused) {
        clearLaboratoryAuditExportRetryHandoffQueryParams();
        persistLaboratoryAuditExportRetryHandoff(handoffContext);
        auditExportRetryHandoffCompletedMessage.value = `Retry handoff ready for laboratory order ${targetOrder.id} (export job ${auditExportRetryHandoffJobId}).`;
    }
}

async function resumeLastLaboratoryAuditExportRetryHandoff() {
    const context = lastLaboratoryAuditExportRetryHandoff.value;
    if (!context || resumingLaboratoryAuditExportRetryHandoff.value) return;

    const telemetryContext: LaboratoryAuditExportRetryResumeTelemetryEventContext =
        {
            targetResourceId: context.targetOrderId,
            exportJobId: context.jobId,
            handoffStatusGroup: context.statusGroup,
            handoffPage: context.page,
            handoffPerPage: context.perPage,
        };

    resumingLaboratoryAuditExportRetryHandoff.value = true;
    auditExportRetryHandoffCompletedMessage.value = null;
    recordLaboratoryAuditExportRetryResumeAttempt(telemetryContext);

    try {
        let targetOrder = orders.value.find(
            (order) => order.id === context.targetOrderId,
        );
        if (!targetOrder) {
            targetOrder = await fetchLaboratoryOrderById(context.targetOrderId);
            if (!targetOrder) {
                recordLaboratoryAuditExportRetryResumeFailure(
                    'target_order_lookup_failed',
                    telemetryContext,
                );
                listErrors.value.push(
                    'Unable to resume last laboratory retry handoff target. The order could not be loaded.',
                );
                return;
            }
        }

        const resumeContext: LaboratoryAuditExportRetryHandoffContext = {
            ...context,
            savedAt: new Date().toISOString(),
        };

        await openOrderDetailsSheet(targetOrder, {
            retryHandoffContext: resumeContext,
        });
        const focused = await focusLaboratoryAuditExportRetryHandoff(
            resumeContext.jobId,
        );
        if (!focused) {
            recordLaboratoryAuditExportRetryResumeFailure(
                'target_export_job_focus_failed',
                telemetryContext,
            );
            listErrors.value.push(
                'Unable to resume last laboratory retry handoff focus. The export job could not be resolved.',
            );
            return;
        }

        recordLaboratoryAuditExportRetryResumeSuccess(telemetryContext);
        persistLaboratoryAuditExportRetryHandoff(resumeContext);
        auditExportRetryHandoffCompletedMessage.value = `Resumed retry handoff for laboratory order ${resumeContext.targetOrderId} (export job ${resumeContext.jobId}).`;
    } finally {
        resumingLaboratoryAuditExportRetryHandoff.value = false;
    }
}

function resetDetailsAuditLogsFilters(options?: { autoLoad?: boolean }) {
    detailsSheetAuditLogsFilters.q = '';
    detailsSheetAuditLogsFilters.action = '';
    detailsSheetAuditLogsFilters.actorType = '';
    detailsSheetAuditLogsFilters.actorId = '';
    detailsSheetAuditLogsFilters.from = '';
    detailsSheetAuditLogsFilters.to = '';
    detailsSheetAuditLogsFilters.perPage = 20;
    detailsSheetAuditLogsFilters.page = 1;

    if (options?.autoLoad !== false && detailsSheetOrder.value) {
        void loadOrderAuditLogs(detailsSheetOrder.value.id);
    }
}

function submitDetailsAuditLogsFilters() {
    if (!detailsSheetOrder.value) return;
    detailsSheetAuditLogsFilters.page = 1;
    void loadOrderAuditLogs(detailsSheetOrder.value.id);
}

function resetDetailsAuditExportJobsFilters(options?: { autoLoad?: boolean }) {
    detailsSheetAuditExportJobsFilters.statusGroup = 'all';
    detailsSheetAuditExportJobsFilters.perPage = 8;
    detailsSheetAuditExportJobsFilters.page = 1;

    if (options?.autoLoad !== false && detailsSheetOrder.value) {
        void loadOrderAuditExportJobs(detailsSheetOrder.value.id);
    }
}

function submitDetailsAuditExportJobsFilters() {
    if (!detailsSheetOrder.value) return;
    detailsSheetAuditExportJobsFilters.page = 1;
    void loadOrderAuditExportJobs(detailsSheetOrder.value.id);
}

function prevDetailsAuditExportJobsPage() {
    if (!detailsSheetOrder.value || !detailsSheetAuditExportJobsMeta.value)
        return;
    if (detailsSheetAuditExportJobsMeta.value.currentPage <= 1) return;
    detailsSheetAuditExportJobsFilters.page = Math.max(
        detailsSheetAuditExportJobsMeta.value.currentPage - 1,
        1,
    );
    void loadOrderAuditExportJobs(detailsSheetOrder.value.id);
}

function nextDetailsAuditExportJobsPage() {
    if (!detailsSheetOrder.value || !detailsSheetAuditExportJobsMeta.value)
        return;
    if (
        detailsSheetAuditExportJobsMeta.value.currentPage >=
        detailsSheetAuditExportJobsMeta.value.lastPage
    ) {
        return;
    }

    detailsSheetAuditExportJobsFilters.page = Math.min(
        detailsSheetAuditExportJobsMeta.value.currentPage + 1,
        detailsSheetAuditExportJobsMeta.value.lastPage,
    );
    void loadOrderAuditExportJobs(detailsSheetOrder.value.id);
}

function prevDetailsAuditLogsPage() {
    if (!detailsSheetOrder.value || !detailsSheetAuditLogsMeta.value) return;
    if (detailsSheetAuditLogsMeta.value.currentPage <= 1) return;
    detailsSheetAuditLogsFilters.page = Math.max(
        detailsSheetAuditLogsMeta.value.currentPage - 1,
        1,
    );
    void loadOrderAuditLogs(detailsSheetOrder.value.id);
}

function nextDetailsAuditLogsPage() {
    if (!detailsSheetOrder.value || !detailsSheetAuditLogsMeta.value) return;
    if (
        detailsSheetAuditLogsMeta.value.currentPage >=
        detailsSheetAuditLogsMeta.value.lastPage
    ) {
        return;
    }

    detailsSheetAuditLogsFilters.page = Math.min(
        detailsSheetAuditLogsMeta.value.currentPage + 1,
        detailsSheetAuditLogsMeta.value.lastPage,
    );
    void loadOrderAuditLogs(detailsSheetOrder.value.id);
}

function buildStructuredLabResultSummary(): string {
    const lines: string[] = [];

    const resultLineParts = [
        statusDialogResultValue.value.trim(),
        statusDialogResultUnit.value.trim(),
    ].filter(Boolean);
    const resultLine = resultLineParts.join(' ');

    if (statusDialogResultFlag.value.trim()) {
        lines.push(`Result Flag: ${statusDialogResultFlag.value.trim()}`);
    }
    if (resultLine) {
        lines.push(`Measured Result: ${resultLine}`);
    }
    if (statusDialogReferenceRange.value.trim()) {
        lines.push(
            `Reference Range: ${statusDialogReferenceRange.value.trim()}`,
        );
    }
    if (statusDialogInterpretation.value.trim()) {
        lines.push(
            `Interpretation: ${statusDialogInterpretation.value.trim()}`,
        );
    }
    if (statusDialogRecommendation.value.trim()) {
        lines.push(
            `Recommendation: ${statusDialogRecommendation.value.trim()}`,
        );
    }

    return lines.join('\n');
}

const structuredLabResultPreview = computed(() =>
    buildStructuredLabResultSummary(),
);

function applyStructuredLabResultToSummary(
    mode: 'replace' | 'append' = 'replace',
) {
    const generated = buildStructuredLabResultSummary().trim();
    if (!generated) {
        statusDialogError.value =
            'Enter at least one structured result detail before generating a summary.';
        return;
    }

    statusDialogError.value = null;

    if (mode === 'append' && statusDialogResultSummary.value.trim()) {
        statusDialogResultSummary.value = `${statusDialogResultSummary.value.trim()}\n\n${generated}`;
        return;
    }

    statusDialogResultSummary.value = generated;
}

const statusDialogTitle = computed(() => {
    const action = statusDialogAction.value;
    if (!action) return 'Update Laboratory Order';
    if (action === 'collected') return 'Mark Specimen Collected';
    if (action === 'in_progress') return 'Start Processing';
    if (action === 'completed') return 'Complete Laboratory Order';
    if (action === 'verify') return 'Verify and Release Result';
    return 'Cancel Laboratory Order';
});

const statusDialogDescription = computed(() => {
    const order = statusDialogOrder.value;
    const action = statusDialogAction.value;
    const label = order?.orderNumber ?? 'laboratory order';
    if (!action) return 'Update laboratory order status.';
    if (action === 'collected') return `Mark ${label} as specimen collected.`;
    if (action === 'in_progress') return `Move ${label} into processing.`;
    if (action === 'completed')
        return `Enter a result summary to complete ${label}.`;
    if (action === 'verify')
        return `Review, record the release note, and verify the completed result for ${label}.`;
    return `Cancellation reason is required before cancelling ${label}.`;
});

const statusDialogNeedsReason = computed(
    () => statusDialogAction.value === 'cancelled',
);

const statusDialogNeedsResultSummary = computed(
    () => statusDialogAction.value === 'completed',
);
const statusDialogNeedsVerificationNote = computed(
    () => statusDialogAction.value === 'verify',
);
const statusDialogCriticalVerificationNoteRequired = computed(() => {
    if (!statusDialogNeedsVerificationNote.value) return false;
    const summary = statusDialogOrder.value?.resultSummary ?? '';
    return summary.toLowerCase().includes('result flag: critical');
});
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

async function refreshLaboratoryStatusDialogOrder(
    orderId: string,
): Promise<void> {
    const requestKey = statusDialogStockCheckRequestKey.value + 1;
    statusDialogStockCheckRequestKey.value = requestKey;
    statusDialogStockCheckLoading.value = true;
    statusDialogStockCheckError.value = null;

    const freshOrder = await fetchLaboratoryOrderById(orderId);
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

        if (detailsSheetOrder.value?.id === freshOrder.id) {
            detailsSheetOrder.value = freshOrder;
        }
    }

    statusDialogStockCheckLoading.value = false;
}

async function submitOrderStatusDialog() {
    if (!statusDialogOrder.value || !statusDialogAction.value) return;

    let reason: string | null = null;
    let resultSummary: string | null = null;
    let verificationNote: string | null = null;

    if (statusDialogNeedsReason.value) {
        reason = statusDialogReason.value.trim();
        if (!reason) {
            statusDialogError.value = 'Cancellation reason is required.';
            return;
        }
    }

    if (statusDialogNeedsResultSummary.value) {
        resultSummary = statusDialogResultSummary.value.trim();
        if (!resultSummary) {
            statusDialogError.value =
                'Result summary is required to complete an order.';
            return;
        }
    }

    if (statusDialogNeedsVerificationNote.value) {
        verificationNote = statusDialogVerificationNote.value.trim() || null;
        if (
            statusDialogCriticalVerificationNoteRequired.value &&
            !verificationNote
        ) {
            statusDialogError.value =
                'Verification note is required for critical laboratory results.';
            return;
        }
        const success = await verifyLaboratoryResult(
            statusDialogOrder.value,
            verificationNote,
        );
        if (success) {
            closeOrderStatusDialog();
        }
        return;
    }

    statusDialogError.value = null;
    const success = await updateOrderStatus(
        statusDialogOrder.value,
        statusDialogAction.value,
        { reason, resultSummary },
    );
    if (success) {
        closeOrderStatusDialog();
    }
}

async function updateOrderStatus(
    order: LaboratoryOrder,
    status: LaboratoryOrderStatusAction,
    payload?: { reason?: string | null; resultSummary?: string | null },
) {
    if (actionLoadingId.value) return;

    const reason = payload?.reason ?? null;
    const resultSummary = payload?.resultSummary ?? null;

    actionLoadingId.value = order.id;
    listErrors.value = [];
    actionMessage.value = null;

    try {
        const response = await apiRequest<{ data: LaboratoryOrder }>(
            'PATCH',
            `/laboratory-orders/${order.id}/status`,
            {
                body: { status, reason, resultSummary },
            },
        );

        statusDialogError.value = null;
        actionMessage.value = `Updated ${response.data.orderNumber ?? 'laboratory order'} to ${formatEnumLabel(status)}.`;
        if (actionMessage.value) notifySuccess(actionMessage.value);
        if (statusDialogOrder.value?.id === response.data.id) {
            statusDialogOrder.value = response.data;
        }
        if (detailsSheetOrder.value?.id === response.data.id) {
            detailsSheetOrder.value = response.data;
            await loadDetailsTrendOrders(response.data);
            if (canViewLaboratoryOrderAuditLogs.value) {
                void loadOrderAuditLogs(response.data.id);
            }
        }
        orders.value = orders.value.map((candidate) =>
            candidate.id === response.data.id ? response.data : candidate,
        );
        await Promise.allSettled([
            loadOrders(),
            loadOrderStatusCounts(),
            loadLaboratoryExceptionOrders(),
        ]);
        return true;
    } catch (error) {
        statusDialogError.value = messageFromUnknown(
            error,
            'Unable to update laboratory order status.',
        );
        notifyError(statusDialogError.value);
        return false;
    } finally {
        actionLoadingId.value = null;
    }
}

function submitSearch() {
    clearSearchDebounce();
    searchForm.page = 1;
    void Promise.all([
        loadOrders(),
        loadOrderStatusCounts(),
        loadLaboratoryExceptionOrders(),
    ]);
}

function syncAdvancedFiltersDraftFromSearch() {
    advancedFiltersDraft.patientId = searchForm.patientId;
    advancedFiltersDraft.from = searchForm.from;
    advancedFiltersDraft.to = searchForm.to;
}

function applyAdvancedFilters() {
    clearSearchDebounce();
    searchForm.patientId = patientChartQueueFocusLocked.value
        ? patientChartQueueRouteContext.patientId
        : advancedFiltersDraft.patientId.trim();
    searchForm.from = advancedFiltersDraft.from.trim();
    searchForm.to = advancedFiltersDraft.to.trim();
    searchForm.page = 1;
    void Promise.all([
        loadOrders(),
        loadOrderStatusCounts(),
        loadLaboratoryExceptionOrders(),
    ]);
}

function submitSearchFromFiltersSheet() {
    applyAdvancedFilters();
    advancedFiltersSheetOpen.value = false;
}

function submitSearchFromMobileDrawer() {
    applyAdvancedFilters();
    mobileFiltersDrawerOpen.value = false;
}

function resetFilters() {
    clearSearchDebounce();
    searchForm.q = '';
    searchForm.patientId = patientChartQueueFocusLocked.value
        ? patientChartQueueRouteContext.patientId
        : '';
    searchForm.status = '';
    searchForm.priority = '';
    searchForm.from = '';
    searchForm.to = '';
    searchForm.page = 1;
    syncAdvancedFiltersDraftFromSearch();
    void Promise.all([
        loadOrders(),
        loadOrderStatusCounts(),
        loadLaboratoryExceptionOrders(),
    ]);
}

function openFullLaboratoryQueue() {
    clearSearchDebounce();
    patientChartQueueFocusLocked.value = false;
    searchForm.patientId = '';
    searchForm.page = 1;
    syncAdvancedFiltersDraftFromSearch();
    void Promise.all([
        loadOrders(),
        loadOrderStatusCounts(),
        loadLaboratoryExceptionOrders(),
    ]);
}

function refocusLaboratoryPatientQueue() {
    if (!patientChartQueueRouteContext.patientId) return;

    clearSearchDebounce();
    patientChartQueueFocusLocked.value = true;
    searchForm.patientId = patientChartQueueRouteContext.patientId;
    searchForm.page = 1;
    syncAdvancedFiltersDraftFromSearch();
    void Promise.all([
        loadOrders(),
        loadOrderStatusCounts(),
        loadLaboratoryExceptionOrders(),
    ]);
}

function resetFiltersFromFiltersSheet() {
    resetFilters();
    advancedFiltersSheetOpen.value = false;
}

function resetFiltersFromMobileDrawer() {
    resetFilters();
    mobileFiltersDrawerOpen.value = false;
}

function prevPage() {
    if ((pagination.value?.currentPage ?? 1) <= 1) return;
    clearSearchDebounce();
    searchForm.page -= 1;
    void Promise.all([loadOrders(), loadOrderStatusCounts()]);
}

function nextPage() {
    if (
        !pagination.value ||
        pagination.value.currentPage >= pagination.value.lastPage
    ) {
        return;
    }
    clearSearchDebounce();
    searchForm.page += 1;
    void Promise.all([loadOrders(), loadOrderStatusCounts()]);
}

function syncLaboratoryWorkspaceViewToUrl(view: LaboratoryWorkspaceView) {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    url.searchParams.set('tab', view);
    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
}

function focusElementById(id: string) {
    window.setTimeout(() => {
        const element = document.getElementById(id);
        if (!(element instanceof HTMLElement)) return;
        element.focus({ preventScroll: true });
    }, 120);
}

function scrollToLaboratoryQueue(options?: { focusSearch?: boolean }) {
    document
        .getElementById('laboratory-order-queue')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (options?.focusSearch) {
        focusElementById('lab-q');
    }
}

function scrollToLaboratoryExceptionQueue() {
    document
        .getElementById('laboratory-exception-queue')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToCreateLabOrder(options?: { focusPatient?: boolean }) {
    document
        .getElementById('create-lab-order')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (options?.focusPatient) {
        focusElementById('lab-open-context-dialog');
    }
}

function setLaboratoryWorkspaceView(
    view: LaboratoryWorkspaceView,
    options?: {
        scroll?: boolean;
        focusSearch?: boolean;
        focusCreate?: boolean;
    },
) {
    if (view === 'new' && !canCreateLaboratoryOrders.value) {
        laboratoryWorkspaceView.value = 'queue';
        syncLaboratoryWorkspaceViewToUrl('queue');

        if (options?.scroll === false) return;

        void nextTick(() => {
            scrollToLaboratoryQueue({ focusSearch: true });
        });

        return;
    }

    laboratoryWorkspaceView.value = view;
    syncLaboratoryWorkspaceViewToUrl(view);

    if (options?.scroll === false) return;

    void nextTick(() => {
        if (view === 'new') {
            if (options?.focusCreate) {
                focusElementById('lab-open-context-dialog');
            }
            return;
        }
        scrollToLaboratoryQueue({ focusSearch: options?.focusSearch });
    });
}

function shortId(value: string | null): string {
    if (!value) return 'N/A';
    return value.length > 10 ? `${value.slice(0, 8)}...` : value;
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

function formatDateOnly(value: string | null): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

function statusVariant(status: string | null) {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'ordered') return 'outline';
    if (normalized === 'collected' || normalized === 'in_progress')
        return 'secondary';
    if (normalized === 'completed') return 'default';
    if (normalized === 'cancelled') return 'destructive';
    return 'outline';
}

function orderAccentClass(status: string | null): string {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'ordered') {
        return 'border-l-4 border-l-sky-500/80 dark:border-l-sky-400/80';
    }
    if (normalized === 'collected' || normalized === 'in_progress') {
        return 'border-l-4 border-l-amber-500/80 dark:border-l-amber-400/80';
    }
    if (normalized === 'completed') {
        return 'border-l-4 border-l-emerald-500/80 dark:border-l-emerald-400/80';
    }
    if (normalized === 'cancelled') {
        return 'border-l-4 border-l-rose-500/80 dark:border-l-rose-400/80';
    }
    return '';
}

function laboratoryOrderReleaseBadgeLabel(order: LaboratoryOrder): string | null {
    const status = (order.status ?? '').toLowerCase();
    if (status !== 'completed') return null;
    if (order.verifiedAt) return 'Released';
    return isCriticalLabResultSummary(order.resultSummary)
        ? 'Release blocked'
        : 'Release pending';
}

function laboratoryOrderReleaseBadgeVariant(order: LaboratoryOrder) {
    const label = laboratoryOrderReleaseBadgeLabel(order);
    if (label === 'Released') return 'secondary';
    if (label === 'Release blocked') return 'destructive';
    return 'outline';
}

function laboratoryOrderQueueWorkflowHint(order: LaboratoryOrder): string | null {
    const status = (order.status ?? '').toLowerCase();
    if (status !== 'completed') return null;
    if (order.verifiedAt) {
        return 'Released for clinical follow-up.';
    }
    if (isCriticalLabResultSummary(order.resultSummary)) {
        return 'Critical result needs a verification note before release.';
    }
    return 'Verify the completed result to release it downstream.';
}

function laboratoryOrderQueueWorkflowHintClass(order: LaboratoryOrder): string {
    const status = (order.status ?? '').toLowerCase();
    if (status !== 'completed') return 'text-muted-foreground';
    if (order.verifiedAt) return 'alert-success-text';
    if (isCriticalLabResultSummary(order.resultSummary)) return 'text-destructive';
    return 'alert-warning-text';
}

function laboratoryOrderQueueSurfaceClass(order: LaboratoryOrder): string {
    const status = (order.status ?? '').toLowerCase();
    if (status === 'completed') {
        if (order.verifiedAt) {
            return 'border-l-4 alert-success-surface alert-success-border';
        }
        if (isCriticalLabResultSummary(order.resultSummary)) {
            return 'border-l-4 alert-critical-surface';
        }
        return 'border-l-4 alert-warning-surface alert-warning-border';
    }
    return orderAccentClass(order.status);
}

function priorityVariant(priority: string | null) {
    const normalized = (priority ?? '').toLowerCase();
    if (normalized === 'stat') return 'destructive';
    if (normalized === 'urgent') return 'secondary';
    return 'outline';
}

function exceptionSeverityVariant(severity: LaboratoryExceptionSeverity) {
    if (severity === 'critical') return 'destructive';
    if (severity === 'warning') return 'secondary';
    return 'outline';
}

function exceptionSeverityRank(severity: LaboratoryExceptionSeverity): number {
    if (severity === 'critical') return 3;
    if (severity === 'warning') return 2;
    return 1;
}

function minutesSince(value: string | null): number | null {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return null;
    const diff = Date.now() - timestamp;
    if (diff < 0) return 0;
    return Math.round(diff / 60000);
}

function formatElapsedMinutes(minutes: number | null): string | null {
    if (minutes === null) return null;
    if (minutes < 60) return `${minutes}m open`;

    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours < 24) {
        return remainder > 0
            ? `${hours}h ${remainder}m open`
            : `${hours}h open`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0
        ? `${days}d ${remainingHours}h open`
        : `${days}d open`;
}

function resultFlagVariant(flag: string | null) {
    const normalized = (flag ?? '').trim().toLowerCase();
    if (normalized === 'critical') return 'destructive';
    if (normalized === 'abnormal' || normalized === 'inconclusive') {
        return 'secondary';
    }
    return 'outline';
}

function normalizeLaboratoryToken(value: string | null): string {
    return (value ?? '').trim().toLowerCase();
}

function laboratoryOrdersMatchTrend(
    currentOrder: Pick<LaboratoryOrder, 'testCode' | 'testName'>,
    candidateOrder: Pick<LaboratoryOrder, 'testCode' | 'testName'>,
): boolean {
    const currentCode = normalizeLaboratoryToken(currentOrder.testCode);
    const candidateCode = normalizeLaboratoryToken(candidateOrder.testCode);
    if (currentCode && candidateCode) {
        return currentCode === candidateCode;
    }

    const currentName = normalizeLaboratoryToken(currentOrder.testName);
    const candidateName = normalizeLaboratoryToken(candidateOrder.testName);
    if (currentName && candidateName) {
        return currentName === candidateName;
    }

    return false;
}

function parseStructuredLaboratoryResultSummary(
    summary: string | null,
): ParsedLaboratoryResultSummary {
    const parsed: ParsedLaboratoryResultSummary = {
        flag: null,
        measuredValue: null,
        measuredValueNumeric: null,
        unit: null,
        referenceRange: null,
        interpretation: null,
        recommendation: null,
    };

    for (const rawLine of (summary ?? '').split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;

        const separatorIndex = line.indexOf(':');
        if (separatorIndex < 0) continue;

        const label = line.slice(0, separatorIndex).trim().toLowerCase();
        const value = line.slice(separatorIndex + 1).trim();
        if (!value) continue;

        if (label === 'result flag') {
            parsed.flag = value;
            continue;
        }
        if (label === 'reference range') {
            parsed.referenceRange = value;
            continue;
        }
        if (label === 'interpretation') {
            parsed.interpretation = value;
            continue;
        }
        if (label === 'recommendation') {
            parsed.recommendation = value;
            continue;
        }
        if (label === 'measured result') {
            parsed.measuredValue = value;
            const match = value.match(/^([-+]?\d+(?:\.\d+)?)(?:\s+(.+))?$/u);
            if (match) {
                parsed.measuredValueNumeric = Number.parseFloat(match[1]);
                parsed.unit = match[2]?.trim() || null;
            }
        }
    }

    return parsed;
}

function nextWorkflowActionForLaboratoryOrder(order: LaboratoryOrder): {
    action: LaboratoryOrderStatusAction;
    label: string;
    description: string;
} | null {
    const status = (order.status ?? '').toLowerCase();
    if (status === 'ordered') {
        return {
            action: 'collected',
            label: 'Mark collected',
            description:
                'Confirm handoff from the clinical area before the specimen moves into laboratory processing.',
        };
    }
    if (status === 'collected') {
        return {
            action: 'in_progress',
            label: 'Start processing',
            description:
                'Move the specimen into analyzer or bench workflow so result work can begin.',
        };
    }
    if (status === 'in_progress') {
        return {
            action: 'completed',
            label: 'Complete + result',
            description:
                'Capture the structured result details and publish the laboratory summary.',
        };
    }
    if (status === 'completed' && !order.verifiedAt) {
        return {
            action: 'verify',
            label: isCriticalLabResultSummary(order.resultSummary)
                ? 'Verify critical result'
                : 'Verify + release',
            description: isCriticalLabResultSummary(order.resultSummary)
                ? 'Critical results require a verification note before release to downstream workflows.'
                : 'Review and verify the completed result so downstream handoff can continue.',
        };
    }

    return null;
}

function deriveLaboratoryExceptionItem(
    order: LaboratoryOrder,
): LaboratoryExceptionItem | null {
    const status = (order.status ?? '').toLowerCase();
    const priority = (order.priority ?? '').toLowerCase();
    const criticalResult = isCriticalLabResultSummary(order.resultSummary);

    if (status === 'completed' && !order.verifiedAt) {
        const occurredAt =
            order.resultedAt ?? order.updatedAt ?? order.orderedAt;
        return {
            id: `${order.id}:verification`,
            order,
            severity: criticalResult ? 'critical' : 'warning',
            title: criticalResult
                ? 'Critical result awaiting verification'
                : 'Completed result awaiting verification',
            description: criticalResult
                ? 'Critical result is complete but still needs reviewer verification and a release note.'
                : 'Completed result is waiting for reviewer verification before downstream handoff.',
            occurredAt,
            elapsedLabel: formatElapsedMinutes(minutesSince(occurredAt)),
            nextAction: nextWorkflowActionForLaboratoryOrder(order),
        };
    }

    if (status === 'in_progress') {
        const occurredAt = order.updatedAt ?? order.orderedAt;
        const elapsedMinutes = minutesSince(occurredAt);
        if (elapsedMinutes !== null && elapsedMinutes >= 120) {
            return {
                id: `${order.id}:processing-delay`,
                order,
                severity: priority === 'stat' ? 'critical' : 'warning',
                title:
                    priority === 'stat'
                        ? 'STAT processing delay'
                        : 'Processing delay',
                description:
                    priority === 'stat'
                        ? 'STAT specimen is still in progress and should be reviewed before turnaround slips further.'
                        : 'Specimen has stayed in processing longer than the normal queue threshold.',
                occurredAt,
                elapsedLabel: formatElapsedMinutes(elapsedMinutes),
                nextAction: nextWorkflowActionForLaboratoryOrder(order),
            };
        }
    }

    if (status === 'collected') {
        const occurredAt = order.updatedAt ?? order.orderedAt;
        const elapsedMinutes = minutesSince(occurredAt);
        if (elapsedMinutes !== null && elapsedMinutes >= 45) {
            return {
                id: `${order.id}:collection-stall`,
                order,
                severity: priority === 'stat' ? 'warning' : 'info',
                title:
                    priority === 'stat'
                        ? 'STAT specimen waiting to start'
                        : 'Collected specimen not started',
                description:
                    priority === 'stat'
                        ? 'Collected STAT specimen has not moved into processing yet.'
                        : 'Specimen is collected but still not marked as in progress.',
                occurredAt,
                elapsedLabel: formatElapsedMinutes(elapsedMinutes),
                nextAction: nextWorkflowActionForLaboratoryOrder(order),
            };
        }
    }

    if (status === 'cancelled') {
        const occurredAt = order.updatedAt ?? order.orderedAt;
        return {
            id: `${order.id}:cancelled`,
            order,
            severity: 'info',
            title: 'Cancelled order follow-up',
            description:
                order.statusReason?.trim() ||
                'Cancelled order should be reviewed so the clinical team can confirm the replacement or closure plan.',
            occurredAt,
            elapsedLabel: formatElapsedMinutes(minutesSince(occurredAt)),
            nextAction: null,
        };
    }

    return null;
}

function journeyEventVariant(event: LaboratoryJourneyEvent) {
    if (event.tone === 'critical') return 'destructive';
    if (event.tone === 'success' || event.state === 'done') return 'secondary';
    if (event.state === 'active') return 'default';
    return 'outline';
}

function journeyEventStateLabel(event: LaboratoryJourneyEvent): string {
    if (event.state === 'done') return 'Completed';
    if (event.state === 'active') return 'Current';
    return 'Pending';
}

function journeyEventSurfaceClass(event: LaboratoryJourneyEvent): string {
    if (event.state === 'pending') return 'border-border bg-background';
    if (event.tone === 'critical') return 'alert-critical-surface';
    if (event.tone === 'success') return 'alert-success-surface';
    if (event.state === 'active' && event.tone === 'warning') {
        return 'alert-warning-surface';
    }
    if (event.state === 'active') return 'alert-info-surface';
    if (event.state === 'done') return 'border-border bg-muted/20';
    return 'border-border bg-background';
}

function journeyEventMarkerClass(event: LaboratoryJourneyEvent): string {
    if (event.state === 'pending') return 'border border-border bg-background text-muted-foreground';
    if (event.id === 'cancelled') return 'bg-destructive text-destructive-foreground';
    if (event.tone === 'critical') return 'bg-destructive text-destructive-foreground';
    if (event.state === 'active' && event.tone === 'warning') return 'bg-amber-500 text-white';
    if (event.state === 'active') return 'bg-primary text-primary-foreground';
    if (event.tone === 'success') return 'bg-emerald-600 text-white';
    if (event.state === 'done') return 'bg-muted-foreground/70 text-background';
    return 'border border-border bg-background text-muted-foreground';
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

function orderPatientSummary(order: LaboratoryOrder): PatientSummary | null {
    if (!order.patientId) return null;
    return patientDirectory.value[order.patientId] ?? null;
}

function orderPatientLabel(order: LaboratoryOrder): string {
    const summary = orderPatientSummary(order);
    if (!summary) return shortId(order.patientId);
    return patientName(summary);
}

function orderPatientNumber(order: LaboratoryOrder): string | null {
    return orderPatientSummary(order)?.patientNumber ?? null;
}

function laboratoryOrderTestLabel(order: LaboratoryOrder): string {
    const code = order.testCode?.trim() ?? '';
    const name = order.testName?.trim() ?? '';

    if (code && name) return `${code} - ${name}`;
    if (name) return name;
    if (code) return code;
    return 'Laboratory test';
}

function laboratoryOrderResultPreview(order: LaboratoryOrder): string | null {
    const result = order.resultSummary?.trim();
    if (result) return `Result: ${result}`;

    const statusNote = order.statusReason?.trim();
    if (statusNote) return `Status note: ${statusNote}`;

    return null;
}

function orderDetailsWorkflowHref(
    path: string,
    order: LaboratoryOrder,
    options?: {
        includeTabNew?: boolean;
        focusAppointmentOnReturn?: boolean;
        reorderOfId?: string | null;
        addOnToOrderId?: string | null;
    },
): string {
    const params = new URLSearchParams();

    if (options?.includeTabNew) {
        params.set('tab', 'new');
    }

    if (order.patientId) {
        params.set('patientId', order.patientId);
    }
    if (order.appointmentId) {
        params.set('appointmentId', order.appointmentId);
        if (options?.focusAppointmentOnReturn) {
            params.set('focusAppointmentId', order.appointmentId);
        }
    }
    if (order.admissionId) {
        params.set('admissionId', order.admissionId);
    }
    if (options?.reorderOfId?.trim()) {
        params.set('reorderOfId', options.reorderOfId.trim());
    }
    if (options?.addOnToOrderId?.trim()) {
        params.set('addOnToOrderId', options.addOnToOrderId.trim());
    }
    if (path === '/billing-invoices') {
        params.set('sourceWorkflowKind', 'laboratory_order');
        params.set('sourceWorkflowId', order.id);
        const label =
            order.orderNumber?.trim()
            || order.testName?.trim()
            || order.testCode?.trim()
            || 'Laboratory order';
        params.set('sourceWorkflowLabel', label);
    }

    const query = params.toString();

    return query ? `${path}?${query}` : path;
}

function laboratoryOrderClinicalFollowupHref(order: LaboratoryOrder): string {
    return orderDetailsWorkflowHref('/medical-records', order, {
        includeTabNew: true,
    });
}

function laboratoryOrderClinicalFollowupLabel(order: LaboratoryOrder): string {
    return order.appointmentId || order.admissionId
        ? 'Open consultation'
        : 'Open medical records';
}

function laboratoryOrderClinicalFollowupDescription(
    order: LaboratoryOrder,
): string {
    return order.appointmentId || order.admissionId
        ? 'Released result is ready to carry back into consultation follow-up.'
        : 'Released result is ready for medical-record follow-up.';
}

function canOpenLaboratoryClinicalFollowup(order: LaboratoryOrder): boolean {
    return canReadMedicalRecords.value && Boolean(order.patientId?.trim());
}

function isCriticalLabResultSummary(value: string | null): boolean {
    return (value ?? '').toLowerCase().includes('result flag: critical');
}

function isLaboratoryOrderEnteredInError(order: LaboratoryOrder | null): boolean {
    if (!order) return false;

    return Boolean(
        order.enteredInErrorAt
        || order.lifecycleReasonCode === 'entered_in_error',
    );
}

function canApplyLaboratoryLifecycleAction(
    order: LaboratoryOrder | null,
    action: 'cancel' | 'entered_in_error',
): boolean {
    if (!order || !canCreateLaboratoryOrders.value || isLaboratoryOrderEnteredInError(order)) {
        return false;
    }

    if (action === 'cancel') {
        return order.status !== 'cancelled' && order.status !== 'completed';
    }

    return true;
}

function canCreateLaboratoryFollowOnOrder(order: LaboratoryOrder | null): boolean {
    return Boolean(
        order
        && canCreateLaboratoryOrders.value
        && order.patientId?.trim()
        && !isLaboratoryOrderEnteredInError(order),
    );
}

function openLaboratoryLifecycleDialog(
    order: LaboratoryOrder,
    action: 'cancel' | 'entered_in_error',
): void {
    lifecycleDialogOrder.value = order;
    lifecycleDialogAction.value = action;
    lifecycleDialogReason.value =
        action === 'cancel' ? (order.statusReason ?? '') : '';
    lifecycleDialogError.value = null;
    lifecycleDialogOpen.value = true;
}

function closeLaboratoryLifecycleDialog(): void {
    lifecycleDialogOpen.value = false;
    lifecycleDialogOrder.value = null;
    lifecycleDialogAction.value = null;
    lifecycleDialogReason.value = '';
    lifecycleDialogError.value = null;
}

async function submitLaboratoryLifecycleDialog(): Promise<void> {
    if (!lifecycleDialogOrder.value || !lifecycleDialogAction.value) return;

    const reason = lifecycleDialogReason.value.trim();
    if (!reason) {
        lifecycleDialogError.value = 'Clinical reason is required.';
        return;
    }

    lifecycleDialogError.value = null;
    actionLoadingId.value = lifecycleDialogOrder.value.id;

    try {
        const response = await apiRequest<{ data: LaboratoryOrder }>(
            'POST',
            `/laboratory-orders/${lifecycleDialogOrder.value.id}/lifecycle`,
            {
                body: {
                    action: lifecycleDialogAction.value,
                    reason,
                },
            },
        );

        if (detailsSheetOrder.value?.id === response.data.id) {
            detailsSheetOrder.value = response.data;
        }
        if (statusDialogOrder.value?.id === response.data.id) {
            statusDialogOrder.value = response.data;
        }

        notifySuccess(
            lifecycleDialogAction.value === 'cancel'
                ? 'Laboratory order cancelled.'
                : 'Laboratory order marked entered in error.',
        );
        closeLaboratoryLifecycleDialog();
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

function auditLogChangeAfterValue(
    log: LaboratoryOrderAuditLog,
    key: string,
): string | null {
    if (!isAuditLogObject(log.changes)) return null;
    const rawChange = log.changes[key];
    if (
        !rawChange ||
        typeof rawChange !== 'object' ||
        Array.isArray(rawChange)
    ) {
        return null;
    }

    const after = (rawChange as Record<string, unknown>).after;
    if (after === null || after === undefined) return null;

    const normalized = String(after).trim();
    return normalized === '' ? null : normalized;
}

function latestLaboratoryAuditLogMatch(
    predicate: (log: LaboratoryOrderAuditLog) => boolean,
): LaboratoryOrderAuditLog | null {
    const sorted = [...detailsSheetAuditLogs.value].sort((left, right) => {
        const leftTime = left.createdAt
            ? new Date(left.createdAt).getTime()
            : 0;
        const rightTime = right.createdAt
            ? new Date(right.createdAt).getTime()
            : 0;
        return rightTime - leftTime;
    });

    return sorted.find(predicate) ?? null;
}

function lifecycleStatusTimestamp(status: string): string | null {
    return (
        latestLaboratoryAuditLogMatch(
            (log) =>
                (log.action ?? '') === 'laboratory-order.status.updated' &&
                auditLogChangeAfterValue(log, 'status') === status,
        )?.createdAt ?? null
    );
}

function isAuditLogObject(
    value: Record<string, unknown> | unknown[] | null,
): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function auditLogEntries(
    value: Record<string, unknown> | unknown[] | null,
): Array<[string, unknown]> {
    if (!isAuditLogObject(value)) return [];
    return Object.entries(value);
}

function auditLogActorLabel(log: LaboratoryOrderAuditLog): string {
    if (log.actorId === null || log.actorId === undefined) return 'System';
    return `User ID ${log.actorId}`;
}

function auditLogActionLabel(log: LaboratoryOrderAuditLog): string {
    return formatEnumLabel(log.action || 'unknown');
}

function auditLogStatusBadgeLabel(log: LaboratoryOrderAuditLog): string | null {
    const action = (log.action ?? '').toLowerCase();
    if (action === 'laboratory-order.status.updated') {
        const nextStatus = auditLogChangeAfterValue(log, 'status');
        return nextStatus ? formatEnumLabel(nextStatus) : 'Updated';
    }
    if (action === 'laboratory-order.result.verified') {
        return 'Verified';
    }
    return null;
}

function auditLogStatusBadgeVariant(
    log: LaboratoryOrderAuditLog,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    const action = (log.action ?? '').toLowerCase();
    if (action === 'laboratory-order.result.verified') return 'secondary';
    const nextStatus = (auditLogChangeAfterValue(log, 'status') ?? '').toLowerCase();
    if (nextStatus === 'cancelled') return 'destructive';
    if (nextStatus === 'completed') return 'secondary';
    if (nextStatus === 'collected' || nextStatus === 'in_progress') {
        return 'default';
    }
    return 'outline';
}

function auditLogSummary(log: LaboratoryOrderAuditLog): string {
    const action = (log.action ?? '').toLowerCase();
    if (action === 'laboratory-order.status.updated') {
        const nextStatus = auditLogChangeAfterValue(log, 'status');
        const reason = auditLogChangeAfterValue(log, 'statusReason');
        if (nextStatus && reason) {
            return `Status changed to ${formatEnumLabel(nextStatus)}. Reason: ${reason}`;
        }
        if (nextStatus) {
            return `Status changed to ${formatEnumLabel(nextStatus)}.`;
        }
    }
    if (action === 'laboratory-order.result.verified') {
        const note = formatAuditLogValue(log.metadata || log.changes || null);
        return note === 'N/A'
            ? 'Reviewer verification was recorded for this result.'
            : note;
    }
    if (action.includes('audit') && action.includes('export')) {
        return formatAuditLogValue(
            log.metadata || log.changes || 'Audit export activity recorded.',
        );
    }
    return formatAuditLogValue(log.metadata || log.changes || log.action || 'Event recorded');
}

function formatAuditLogValue(value: unknown): string {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return 'N/A';
        return trimmed.length > 220 ? `${trimmed.slice(0, 217)}...` : trimmed;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    try {
        const json = JSON.stringify(value);
        if (!json) return 'N/A';
        return json.length > 220 ? `${json.slice(0, 217)}...` : json;
    } catch {
        return String(value);
    }
}

const laboratoryAuditExportPollAttempts = 20;
const laboratoryAuditExportPollDelayMs = 1500;

function triggerLaboratoryAuditCsvDownload(downloadUrl: string) {
    const link = document.createElement('a');
    link.href = new URL(downloadUrl, window.location.origin).toString();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function waitMs(ms: number) {
    return new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

async function waitForLaboratoryAuditExportJob(
    orderId: string,
    jobId: string,
): Promise<LaboratoryOrderAuditExportJob> {
    let latest: LaboratoryOrderAuditExportJob | null = null;

    for (
        let attempt = 0;
        attempt < laboratoryAuditExportPollAttempts;
        attempt += 1
    ) {
        const response =
            await apiRequest<LaboratoryOrderAuditExportJobResponse>(
                'GET',
                `/laboratory-orders/${orderId}/audit-logs/export-jobs/${jobId}`,
            );
        latest = response.data;
        if (latest.status === 'completed' || latest.status === 'failed') {
            return latest;
        }
        await waitMs(laboratoryAuditExportPollDelayMs);
    }

    return (
        latest ??
        (
            await apiRequest<LaboratoryOrderAuditExportJobResponse>(
                'GET',
                `/laboratory-orders/${orderId}/audit-logs/export-jobs/${jobId}`,
            )
        ).data
    );
}

function downloadLaboratoryAuditExportJob(job: LaboratoryOrderAuditExportJob) {
    if (!job.downloadUrl) return;
    triggerLaboratoryAuditCsvDownload(job.downloadUrl);
}

async function retryLaboratoryAuditExportJob(
    job: LaboratoryOrderAuditExportJob,
) {
    if (!detailsSheetOrder.value) return;
    if (detailsSheetAuditExportRetryingJobId.value) return;
    const orderId = detailsSheetOrder.value.id;

    detailsSheetAuditExportRetryingJobId.value = job.id;
    try {
        const response =
            await apiRequest<LaboratoryOrderAuditExportJobResponse>(
                'POST',
                `/laboratory-orders/${orderId}/audit-logs/export-jobs/${job.id}/retry`,
            );
        notifySuccess('Audit export retry queued.');
        const createdJobId = response.data?.id ?? null;
        if (createdJobId) {
            const finalJob = await waitForLaboratoryAuditExportJob(
                orderId,
                createdJobId,
            );
            if (finalJob.status === 'completed' && finalJob.downloadUrl) {
                triggerLaboratoryAuditCsvDownload(finalJob.downloadUrl);
                notifySuccess('Audit CSV export ready. Download started.');
            } else if (finalJob.status === 'failed') {
                throw new Error(
                    finalJob.errorMessage || 'Audit export retry failed.',
                );
            } else {
                notifySuccess('Audit export retry is processing.');
            }
        }
    } catch (error) {
        notifyError(
            messageFromUnknown(error, 'Unable to retry audit export job.'),
        );
    } finally {
        detailsSheetAuditExportRetryingJobId.value = null;
        if (detailsSheetOrder.value) {
            void loadOrderAuditExportJobs(detailsSheetOrder.value.id);
        }
    }
}

async function exportLaboratoryAuditLogsCsv() {
    if (!detailsSheetOrder.value) return;
    if (detailsSheetAuditLogsExporting.value) return;

    detailsSheetAuditLogsExporting.value = true;

    try {
        const orderId = detailsSheetOrder.value.id;
        const createResponse =
            await apiRequest<LaboratoryOrderAuditExportJobResponse>(
                'POST',
                `/laboratory-orders/${orderId}/audit-logs/export-jobs`,
                {
                    body: detailsSheetAuditLogsExportQuery(),
                },
            );
        const jobId = createResponse.data?.id;
        if (!jobId) {
            throw new Error('Unable to start audit export job.');
        }

        const finalJob = await waitForLaboratoryAuditExportJob(orderId, jobId);
        if (finalJob.status === 'failed') {
            throw new Error(
                finalJob.errorMessage || 'Audit export job failed.',
            );
        }
        if (finalJob.status !== 'completed' || !finalJob.downloadUrl) {
            notifySuccess(
                'Audit CSV export queued. Retry in a moment if needed.',
            );
            return;
        }

        triggerLaboratoryAuditCsvDownload(finalJob.downloadUrl);
        notifySuccess('Audit CSV export ready. Download started.');
    } catch (error) {
        notifyError(
            messageFromUnknown(error, 'Unable to export audit entries.'),
        );
    } finally {
        detailsSheetAuditLogsExporting.value = false;
        if (detailsSheetOrder.value) {
            void loadOrderAuditExportJobs(detailsSheetOrder.value.id);
        }
    }
}

function summarizeAuditExportJobs(
    jobs: Array<{ status: string | null | undefined }>,
): AuditExportJobStatusSummary {
    const summary: AuditExportJobStatusSummary = {
        total: 0,
        completed: 0,
        failed: 0,
        queued: 0,
        processing: 0,
        backlog: 0,
        other: 0,
    };

    for (const job of jobs) {
        summary.total += 1;
        const status = (job.status ?? '').toLowerCase();

        if (status === 'completed') {
            summary.completed += 1;
            continue;
        }
        if (status === 'failed') {
            summary.failed += 1;
            continue;
        }
        if (status === 'queued') {
            summary.queued += 1;
            continue;
        }
        if (status === 'processing') {
            summary.processing += 1;
            continue;
        }

        summary.other += 1;
    }

    summary.backlog = summary.queued + summary.processing;

    return summary;
}

const detailsSheetAuditExportJobSummary = computed(() =>
    summarizeAuditExportJobs(detailsSheetAuditExportJobs.value),
);

const detailsSheetAuditExportOpsHint = computed(() => {
    const summary = detailsSheetAuditExportJobSummary.value;

    if (summary.total === 0) return null;

    if (summary.failed > 0 && summary.backlog > 0) {
        return `${summary.failed} failed and ${summary.backlog} queued/processing export jobs. Retry failed jobs once, and check queue workers if backlog persists.`;
    }
    if (summary.failed > 0) {
        return `${summary.failed} failed export jobs detected. Retry failed jobs once after confirming the current audit filters are correct.`;
    }
    if (summary.backlog > 0) {
        return `${summary.backlog} export jobs are still queued/processing. Avoid repeated retries while active jobs are still running.`;
    }

    return 'Export jobs look healthy. Use Download for completed jobs and Retry only for failed jobs.';
});

const scopeWarning = computed(() => {
    if (pageLoading.value) return null;
    if (!tenantIsolationEnabled.value) return null;
    if (!scope.value) return 'Platform access scope could not be loaded.';
    if (scope.value.resolvedFrom === 'none') {
        return 'No tenant/facility scope is resolved. Laboratory order actions may be blocked by tenant isolation controls.';
    }
    return null;
});

const visibleQueueCounts = computed(() => ({
    ordered: orders.value.filter((order) => order.status === 'ordered').length,
    collected: orders.value.filter((order) => order.status === 'collected')
        .length,
    inProgress: orders.value.filter((order) => order.status === 'in_progress')
        .length,
    completed: orders.value.filter((order) => order.status === 'completed')
        .length,
    cancelled: orders.value.filter((order) => order.status === 'cancelled')
        .length,
    other: orders.value.filter(
        (order) =>
            order.status !== 'ordered' &&
            order.status !== 'collected' &&
            order.status !== 'in_progress' &&
            order.status !== 'completed' &&
            order.status !== 'cancelled',
    ).length,
}));

const summaryQueueCounts = computed(() => {
    const fallbackTotal = Math.max(
        visibleQueueCounts.value.ordered +
            visibleQueueCounts.value.collected +
            visibleQueueCounts.value.inProgress +
            visibleQueueCounts.value.completed +
            visibleQueueCounts.value.cancelled +
            visibleQueueCounts.value.other,
        pagination.value?.total ?? 0,
    );

    if (!laboratoryOrderStatusCounts.value) {
        return {
            ordered: visibleQueueCounts.value.ordered,
            collected: visibleQueueCounts.value.collected,
            inProgress: visibleQueueCounts.value.inProgress,
            completed: visibleQueueCounts.value.completed,
            cancelled: visibleQueueCounts.value.cancelled,
            total: fallbackTotal,
        };
    }

    return {
        ordered: laboratoryOrderStatusCounts.value.ordered,
        collected: laboratoryOrderStatusCounts.value.collected,
        inProgress: laboratoryOrderStatusCounts.value.in_progress,
        completed: laboratoryOrderStatusCounts.value.completed,
        cancelled: laboratoryOrderStatusCounts.value.cancelled,
        total: laboratoryOrderStatusCounts.value.total,
    };
});

function queueCountLabel(value: number): string {
    return value > 99 ? '99+' : String(value);
}

function isLaboratorySummaryFilterActive(
    statusKey:
        | 'ordered'
        | 'collected'
        | 'in_progress'
        | 'completed'
        | 'cancelled',
): boolean {
    return searchForm.status === statusKey;
}

function applyLaboratorySummaryFilter(
    statusKey:
        | 'ordered'
        | 'collected'
        | 'in_progress'
        | 'completed'
        | 'cancelled',
) {
    clearSearchDebounce();
    searchForm.page = 1;
    searchForm.status = searchForm.status === statusKey ? '' : statusKey;
    void Promise.all([loadOrders(), loadOrderStatusCounts()]);
}

const statusSelectValue = computed({
    get: () => searchForm.status || 'all',
    set: (v: string) => {
        searchForm.status = v === 'all' ? '' : v;
        searchForm.page = 1;
        void Promise.all([
            loadOrders(),
            loadOrderStatusCounts(),
            loadLaboratoryExceptionOrders(),
        ]);
    },
});

const prioritySelectValue = computed({
    get: () => searchForm.priority || 'all',
    set: (v: string) => {
        searchForm.priority = v === 'all' ? '' : v;
        searchForm.page = 1;
        void Promise.all([
            loadOrders(),
            loadOrderStatusCounts(),
            loadLaboratoryExceptionOrders(),
        ]);
    },
});

const resultsPerPageValue = computed({
    get: () => String(searchForm.perPage),
    set: (v: string) => {
        searchForm.perPage = Number(v) || 10;
        searchForm.page = 1;
        void loadOrders();
    },
});

const queueDensityValue = computed({
    get: () => (compactQueueRows.value ? 'compact' : 'comfortable'),
    set: (value: string) => {
        compactQueueRows.value = value === 'compact';
    },
});

const hasActiveFilters = computed(() =>
    Boolean(
        searchForm.q.trim()
        || searchForm.patientId.trim()
        || searchForm.status
        || searchForm.priority
        || searchForm.to
        || Boolean(searchForm.from),
    ),
);


function matchesLabPreset(options: { status?: string }): boolean {
    if (searchForm.q.trim()) return false;
    if (searchForm.patientId.trim()) return false;
    if (searchForm.priority) return false;
    if (searchForm.to) return false;
    if (searchForm.from !== today) return false;
    return (options.status ?? '') === searchForm.status;
}

async function verifyLaboratoryResult(
    order: LaboratoryOrder,
    verificationNote: string | null,
) {
    if (actionLoadingId.value) return false;

    actionLoadingId.value = order.id;
    listErrors.value = [];
    actionMessage.value = null;

    try {
        const response = await apiRequest<{ data: LaboratoryOrder }>(
            'PATCH',
            `/laboratory-orders/${order.id}/verify`,
            {
                body: { verificationNote },
            },
        );

        statusDialogError.value = null;
        actionMessage.value = `Verified ${response.data.orderNumber ?? 'laboratory order'} result.`;
        if (actionMessage.value) notifySuccess(actionMessage.value);
        if (statusDialogOrder.value?.id === response.data.id) {
            statusDialogOrder.value = response.data;
        }
        if (detailsSheetOrder.value?.id === response.data.id) {
            detailsSheetOrder.value = response.data;
            await loadDetailsTrendOrders(response.data);
            if (canViewLaboratoryOrderAuditLogs.value) {
                void loadOrderAuditLogs(response.data.id);
            }
        }
        orders.value = orders.value.map((candidate) =>
            candidate.id === response.data.id ? response.data : candidate,
        );
        await Promise.allSettled([
            loadOrders(),
            loadOrderStatusCounts(),
            loadLaboratoryExceptionOrders(),
        ]);
        return true;
    } catch (error) {
        statusDialogError.value = messageFromUnknown(
            error,
            'Unable to verify laboratory result.',
        );
        notifyError(statusDialogError.value);
        return false;
    } finally {
        actionLoadingId.value = null;
    }
}

const laboratoryQueuePresetState = computed(() => ({
    queueToday: matchesLabPreset({ status: '' }),
    inProgress: matchesLabPreset({ status: 'in_progress' }),
    completed: matchesLabPreset({ status: 'completed' }),
}));

const activeLaboratoryQueuePresetLabel = computed(() => {
    if (laboratoryQueuePresetState.value.queueToday) return 'Queue Today';
    if (laboratoryQueuePresetState.value.inProgress) return 'In Progress';
    if (laboratoryQueuePresetState.value.completed) return 'Completed';
    return null;
});

const activePatientSummary = computed<PatientSummary | null>(() => {
    const id = searchForm.patientId.trim();
    if (!id) return null;
    return patientDirectory.value[id] ?? null;
});

const activeLaboratorySearchBadgeLabel = computed(() => {
    const query = searchForm.q.trim();
    return query ? `Search: ${query}` : null;
});

const activeLaboratoryStatusBadgeLabel = computed(() => {
    if (!searchForm.status) return null;
    if (activeLaboratoryQueuePresetLabel.value) return null;
    return `Status: ${formatEnumLabel(searchForm.status)}`;
});

const activeLaboratoryPriorityBadgeLabel = computed(() => {
    if (!searchForm.priority) return null;
    return `Priority: ${formatEnumLabel(searchForm.priority)}`;
});

const activeLaboratoryPatientBadgeLabel = computed(() => {
    const id = searchForm.patientId.trim();
    if (!id) return null;
    if (activePatientSummary.value) {
        return `Patient: ${patientName(activePatientSummary.value)}`;
    }
    return `Patient: ${shortId(id)}`;
});

const activeLaboratoryOrderDateFilterBadgeLabel = computed(() => {
    if (!searchForm.to && !searchForm.from) return null;
    if (activeLaboratoryQueuePresetLabel.value) return null;

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

const activeLaboratoryAdvancedFilterCount = computed(
    () =>
        Number(Boolean(searchForm.patientId.trim()))
        + Number(Boolean(!activeLaboratoryQueuePresetLabel.value && (searchForm.to || searchForm.from))),
);

const activeLaboratoryFilterBadgeLabels = computed(() =>
    [
        activeLaboratorySearchBadgeLabel.value,
        activeLaboratoryStatusBadgeLabel.value,
        activeLaboratoryPriorityBadgeLabel.value,
        activeLaboratoryPatientBadgeLabel.value,
        activeLaboratoryOrderDateFilterBadgeLabel.value,
    ].filter((value): value is string => Boolean(value)),
);

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

const showClinicalHandoffBanner = computed(
    () =>
        createPatientContextLocked.value ||
        createAppointmentLinkSource.value === 'route' ||
        createAdmissionLinkSource.value === 'route',
);

const hasCreateLinkedContext = computed(
    () => hasCreateAppointmentContext.value || hasCreateAdmissionContext.value,
);

const createOrderContextModeLabel = computed(() => {
    if (showClinicalHandoffBanner.value) return 'Clinical handoff';
    if (hasCreateAppointmentContext.value || hasCreateAdmissionContext.value) {
        return 'Linked context';
    }
    return 'Manual order';
});

const createOrderContextModeVariant = computed<
    'default' | 'secondary' | 'outline'
>(() => {
    if (showClinicalHandoffBanner.value) return 'default';
    if (hasCreateLinkedContext.value) {
        return 'secondary';
    }
    return 'outline';
});

const createContextActionLabel = computed(() => {
    if (!createForm.patientId.trim()) return 'Set context';
    if (showClinicalHandoffBanner.value || hasCreateLinkedContext.value) {
        return 'Review context';
    }
    return 'Change context';
});

const createOrderContextSummary = computed(() => {
    if (!createForm.patientId.trim()) {
        return 'Set the patient and any visit context before choosing the test.';
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
            ? `Ordering for this patient with ${linkedSummary} context.`
            : 'Ordering for this patient from the current clinical handoff.';
    }

    return linkedSummary
        ? `This order stays linked to this patient and ${linkedSummary}.`
        : 'This order stays linked to this patient.';
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
        return 'Search and select the patient before entering the laboratory order details.';
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
            : 'Link the checked-in appointment when this laboratory order starts from the queue handoff.';
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

const createAdmissionContextLabel = computed(() => {
    const admissionNumber =
        createAdmissionSummary.value?.admissionNumber?.trim();
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
              ? 'Link an active admission when this order belongs to an inpatient stay.'
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
    } else if (createAdmissionLinkSource.value === 'route') {
        parts.push('Linked from clinical handoff');
    }

    return parts.length > 0 ? parts.join(' | ') : 'Linked admission ready';
});

const createAdmissionContextReason = computed(() => {
    const value = createAdmissionSummary.value?.statusReason?.trim();
    return value ? `Status note: ${value}` : null;
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
        createAppointmentSummary.value?.status?.trim()?.toLowerCase() ?? '';

    if (normalizedStatus === 'checked_in') return 'default';
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
        createAdmissionSummary.value?.status?.trim()?.toLowerCase() ?? '';

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
                ? 'Review suggested checked-in appointments or search manually for a different one.'
                : 'Select a patient first, then optionally link the checked-in appointment.';
        case 'admission':
            return createForm.patientId.trim()
                ? 'Review suggested active admissions or search manually for a different inpatient stay.'
                : 'Select a patient first, then optionally link the admission.';
        default:
            return createPatientContextLocked.value
                ? 'Patient is locked from the clinical handoff until you choose a different patient.'
                : 'Search and confirm the patient before entering the laboratory order details.';
    }
});

const createPriorityHelperText = computed(() => {
    switch (createForm.priority) {
        case 'stat':
            return 'Use for immediate processing when the result is needed urgently now.';
        case 'urgent':
            return 'Use when the laboratory team should prioritize this request ahead of routine work.';
        default:
            return 'Routine orders follow the normal laboratory queue.';
    }
});

const createLabTestCatalogOptions = computed<SearchableSelectOption[]>(() => {
    return labTestCatalogItems.value.map((item) => {
        const specimenType = labTestCatalogSpecimenType(item);
        const unitLabel = item.unit?.trim() ? formatEnumLabel(item.unit) : null;
        const categoryLabel = item.category?.trim()
            ? formatEnumLabel(item.category)
            : null;
        const descriptionParts = [
            item.code?.trim() || null,
            unitLabel,
            specimenType ? `Specimen: ${specimenType}` : null,
        ].filter((part): part is string => Boolean(part));

        return {
            value: item.id,
            label: item.name?.trim() || item.code?.trim() || 'Unnamed lab test',
            description:
                descriptionParts.join(' | ') ||
                item.description?.trim() ||
                null,
            keywords: [
                item.name?.trim() || null,
                item.code?.trim() || null,
                item.category?.trim() || null,
                item.unit?.trim() || null,
                specimenType,
            ].filter((keyword): keyword is string => Boolean(keyword)),
            group: categoryLabel,
        };
    });
});

const createLabTestCatalogCategorySummary = computed(() => {
    const counts = new Map<string, number>();

    labTestCatalogItems.value.forEach((item) => {
        const categoryLabel = item.category?.trim()
            ? formatEnumLabel(item.category)
            : 'Other';
        counts.set(categoryLabel, (counts.get(categoryLabel) ?? 0) + 1);
    });

    return [...counts.entries()]
        .sort((left, right) => {
            if (right[1] !== left[1]) return right[1] - left[1];
            return left[0].localeCompare(right[0]);
        })
        .map(([label, count]) => ({ label, count }));
});

const selectedCreateLabTestCatalogItem = computed<ClinicalCatalogItem | null>(
    () => {
        const selectedId = createForm.labTestCatalogItemId.trim();
        if (!selectedId) return null;

        return (
            labTestCatalogItems.value.find((item) => item.id === selectedId) ??
            null
        );
    },
);

const createLabTestPickerError = computed(() => {
    return (
        createFieldError('labTestCatalogItemId') ||
        createFieldError('testCode') ||
        createFieldError('testName')
    );
});

const createLabTestCatalogHelperText = computed(() => {
    if (
        selectedCreateLabTestCatalogItem.value?.unit?.trim().toLowerCase() ===
        'panel'
    ) {
        return 'Search by test name, code, or category. Panels stay as one laboratory order, and you can queue several tests in the basket before submitting.';
    }

    return 'Search by test name, code, or category. Add one or more active laboratory tests to the basket and the canonical code and display name sync automatically.';
});

const selectedCreateLabTestCatalogUnitLabel = computed(() => {
    const unit = selectedCreateLabTestCatalogItem.value?.unit?.trim();
    return unit ? formatEnumLabel(unit) : null;
});

const selectedCreateLabTestCatalogCategoryLabel = computed(() => {
    const category = selectedCreateLabTestCatalogItem.value?.category?.trim();
    return category ? formatEnumLabel(category) : null;
});

const selectedCreateLabTestCatalogSpecimenType = computed(() => {
    return labTestCatalogSpecimenType(selectedCreateLabTestCatalogItem.value);
});

const isCreateSpecimenUsingCatalogDefault = computed(() => {
    const catalogSpecimenType = selectedCreateLabTestCatalogSpecimenType.value?.trim();
    const currentSpecimenType = createForm.specimenType.trim();

    if (!catalogSpecimenType || !currentSpecimenType) return false;

    return (
        normalizeLaboratoryToken(catalogSpecimenType) ===
        normalizeLaboratoryToken(currentSpecimenType)
    );
});

const createSpecimenHelperText = computed(() => {
    const catalogSpecimenType = selectedCreateLabTestCatalogSpecimenType.value?.trim();

    if (!catalogSpecimenType) {
        return 'Enter the expected collection specimen for the requested test.';
    }

    if (isCreateSpecimenUsingCatalogDefault.value) {
        return `Using catalog default specimen: ${catalogSpecimenType}.`;
    }

    return `Catalog default specimen: ${catalogSpecimenType}.`;
});

const createOrderActionDisabled = computed(() => {
    return (
        createLoading.value ||
        labTestCatalogLoading.value ||
        (
            hasCreateLifecycleMode.value &&
            (
                createLifecycleSourceLoading.value ||
                createLifecycleSourceOrder.value === null
            )
        ) ||
        !canReadLabTestCatalog.value ||
        selectedCreateLabTestCatalogItem.value === null
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

const hasPendingCurrentCreateOrderDraft = computed(() => {
    return (
        hasSavedCreateDraft.value ||
        createForm.labTestCatalogItemId.trim() !== '' ||
        createForm.testCode.trim() !== '' ||
        createForm.testName.trim() !== '' ||
        createForm.specimenType.trim() !== '' ||
        createForm.clinicalNotes.trim() !== '' ||
        createForm.priority !== 'routine'
    );
});

const submitCreateOrderBasketDisabled = computed(() => {
    return (
        createLoading.value ||
        !canUseCreateOrderBasket.value ||
        createOrderBasket.value.length === 0 ||
        hasPendingCurrentCreateOrderDraft.value
    );
});
const useSingleCreateOrderAction = computed(
    () => hasCreateLifecycleMode.value || !hasCreateOrderBasketItems.value,
);

const createOrderBasketCountLabel = computed(() => {
    const count = createOrderBasket.value.length;
    return `${count} ${count === 1 ? 'test' : 'tests'}`;
});
const createOrderPrimaryActionLabel = computed(() => {
    if (createLoading.value) {
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

    return 'Sign and submit order';
});

const saveCreateDraftLabel = computed(() =>
    createLoading.value
        ? 'Saving draft...'
        : hasSavedCreateDraft.value
          ? 'Update saved draft'
          : 'Save draft',
);

function applyCreateCatalogSpecimenDefault() {
    const catalogSpecimenType = selectedCreateLabTestCatalogSpecimenType.value?.trim();
    if (!catalogSpecimenType) return;

    createForm.specimenType = catalogSpecimenType;
    lastAppliedCreateLabTestCatalogSpecimenType.value = catalogSpecimenType;
}

const laboratoryListBadgeLabel = computed(() => {
    return (
        activeLaboratoryQueuePresetLabel.value ||
        activeLaboratoryStatusBadgeLabel.value ||
        activeLaboratoryOrderDateFilterBadgeLabel.value ||
        'Queue Today'
    );
});

const laboratoryExceptionItems = computed<LaboratoryExceptionItem[]>(() => {
    return laboratoryExceptionOrders.value
        .map((order) => deriveLaboratoryExceptionItem(order))
        .filter((item): item is LaboratoryExceptionItem => item !== null)
        .sort((left, right) => {
            const severityDiff =
                exceptionSeverityRank(right.severity) -
                exceptionSeverityRank(left.severity);
            if (severityDiff !== 0) return severityDiff;

            const leftTime = left.occurredAt
                ? new Date(left.occurredAt).getTime()
                : 0;
            const rightTime = right.occurredAt
                ? new Date(right.occurredAt).getTime()
                : 0;
            return rightTime - leftTime;
        });
});

const visibleLaboratoryExceptionItems = computed(() =>
    laboratoryExceptionItems.value.slice(0, 5),
);

const laboratoryExceptionSummary = computed(() => {
    return laboratoryExceptionItems.value.reduce(
        (summary, item) => {
            summary.total += 1;
            if (item.severity === 'critical') {
                summary.critical += 1;
            } else if (item.severity === 'warning') {
                summary.warning += 1;
            } else {
                summary.info += 1;
            }
            return summary;
        },
        { total: 0, critical: 0, warning: 0, info: 0 },
    );
});

const showLaboratoryExceptionQueue = computed(
    () =>
        isLaboratoryWorkflowOperator.value &&
        (laboratoryExceptionLoading.value ||
            laboratoryExceptionError.value !== null ||
            laboratoryExceptionSummary.value.total > 0),
);

const laboratoryExceptionPanelClass = computed(() => {
    if (laboratoryExceptionSummary.value.critical > 0) {
        return 'alert-critical-surface';
    }
    if (laboratoryExceptionSummary.value.warning > 0) {
        return 'alert-warning-surface';
    }
    if (laboratoryExceptionSummary.value.info > 0) {
        return 'alert-info-surface';
    }
    return 'border-border bg-background/95';
});

const laboratoryExceptionIconClass = computed(() => {
    if (laboratoryExceptionSummary.value.critical > 0) {
        return 'text-destructive';
    }
    if (laboratoryExceptionSummary.value.warning > 0) {
        return 'alert-warning-text';
    }
    if (laboratoryExceptionSummary.value.info > 0) {
        return 'alert-info-text';
    }
    return 'text-muted-foreground';
});

function exceptionSurfaceClass(severity: LaboratoryExceptionSeverity) {
    if (severity === 'critical') {
        return 'alert-critical-surface';
    }
    if (severity === 'warning') {
        return 'alert-warning-surface';
    }
    return 'alert-info-surface';
}

const detailsSheetTrendPoints = computed<LaboratoryTrendPoint[]>(() => {
    return [...detailsSheetTrendOrders.value]
        .sort((left, right) => {
            const leftTime = new Date(
                left.resultedAt ?? left.orderedAt ?? left.createdAt ?? 0,
            ).getTime();
            const rightTime = new Date(
                right.resultedAt ?? right.orderedAt ?? right.createdAt ?? 0,
            ).getTime();
            return leftTime - rightTime;
        })
        .map((order) => {
            const parsed = parseStructuredLaboratoryResultSummary(
                order.resultSummary,
            );
            return {
                id: order.id,
                order,
                occurredAt:
                    order.resultedAt ??
                    order.verifiedAt ??
                    order.orderedAt ??
                    null,
                measuredValue: parsed.measuredValue,
                measuredValueNumeric: parsed.measuredValueNumeric,
                unit: parsed.unit,
                flag: parsed.flag,
                referenceRange: parsed.referenceRange,
            };
        });
});

const detailsSheetTrendNumericPoints = computed(() =>
    detailsSheetTrendPoints.value.filter(
        (point) => point.measuredValueNumeric !== null && point.occurredAt,
    ),
);

const detailsSheetTrendRecentPoints = computed(() =>
    [...detailsSheetTrendPoints.value].reverse().slice(0, 5),
);

const detailsSheetTrendCurrentPoint = computed(
    () =>
        detailsSheetTrendPoints.value.find(
            (point) => point.order.id === detailsSheetOrder.value?.id,
        ) ?? null,
);

const detailsSheetTrendLatestNumericPoint = computed(() => {
    const points = detailsSheetTrendNumericPoints.value;
    return points.length > 0 ? points[points.length - 1] : null;
});

const detailsSheetTrendPreviousNumericPoint = computed(() => {
    const points = detailsSheetTrendNumericPoints.value;
    return points.length > 1 ? points[points.length - 2] : null;
});

const detailsSheetTrendDeltaLabel = computed(() => {
    const latest = detailsSheetTrendLatestNumericPoint.value;
    const previous = detailsSheetTrendPreviousNumericPoint.value;
    if (!latest || !previous) return null;
    if (
        normalizeLaboratoryToken(latest.unit) !==
        normalizeLaboratoryToken(previous.unit)
    ) {
        return null;
    }

    const delta =
        (latest.measuredValueNumeric ?? 0) -
        (previous.measuredValueNumeric ?? 0);
    const prefix = delta > 0 ? '+' : '';
    return `${prefix}${delta.toFixed(2)} ${latest.unit ?? ''}`.trim();
});

const detailsSheetTrendChartPoints = computed(() => {
    const points = detailsSheetTrendNumericPoints.value;
    if (points.length === 0) return [];

    const width = 100;
    const height = 44;
    const paddingX = 8;
    const paddingY = 6;
    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingY * 2;
    const values = points.map((point) => point.measuredValueNumeric ?? 0);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    return points.map((point, index) => {
        const value = point.measuredValueNumeric ?? 0;
        const x =
            points.length === 1
                ? width / 2
                : paddingX + (usableWidth * index) / (points.length - 1);
        const normalized = range === 0 ? 0.5 : (value - minValue) / range;
        const y = paddingY + (1 - normalized) * usableHeight;
        return {
            ...point,
            x,
            y,
        };
    });
});

const detailsSheetTrendChartPath = computed(() => {
    const points = detailsSheetTrendChartPoints.value;
    if (points.length === 0) return '';

    return points
        .map(
            (point, index) =>
                `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
        )
        .join(' ');
});

const detailsSheetAuditCount = computed(
    () =>
        detailsSheetAuditLogsMeta.value?.total ??
        detailsSheetAuditLogs.value.length,
);

const detailsSheetCriticalEscalation = computed(() => {
    const order = detailsSheetOrder.value;
    if (!order || !isCriticalLabResultSummary(order.resultSummary)) return null;

    if (order.verifiedAt) {
        return {
            title: 'Critical result verified',
            description:
                order.verificationNote?.trim() ||
                'Critical-result review is complete and the verification step is recorded.',
            tone: 'success' as const,
        };
    }

    return {
        title: 'Critical result escalation required',
        description:
            'This result is flagged critical. Verification note is required before release to the next clinical step.',
        tone: 'critical' as const,
    };
});

const detailsSheetNextWorkflowAction = computed<{
    action: LaboratoryOrderStatusAction;
    label: string;
    description: string;
} | null>(() => {
    const order = detailsSheetOrder.value;
    if (!order) return null;
    return nextWorkflowActionForLaboratoryOrder(order);
});

const detailsSheetWorkflowHeading = computed(() =>
    isLaboratoryWorkflowOperator.value ? 'Workflow focus' : 'Order summary',
);

const detailsSheetWorkflowDescription = computed(() => {
    const nextAction = detailsSheetNextWorkflowAction.value;
    if (isLaboratoryWorkflowOperator.value) {
        return nextAction?.description ?? 'No additional workflow step is pending for this order.';
    }

    return 'Review the laboratory state, result summary, and release context without exposing execution-only controls.';
});


const detailsSheetResultReleased = computed(() => {
    const order = detailsSheetOrder.value;
    if (!order) return false;
    return (order.status ?? '').toLowerCase() === 'completed' && Boolean(order.verifiedAt);
});

const detailsSheetWorkflowSignals = computed(() => {
    const order = detailsSheetOrder.value;
    if (!order) return [];

    const status = (order.status ?? '').toLowerCase();
    const criticalResult = isCriticalLabResultSummary(order.resultSummary);
    const released = detailsSheetResultReleased.value;

    const statusNote =
        status === 'ordered'
            ? 'Specimen collection has not started yet.'
            : status === 'collected'
              ? 'Specimen has been collected and is waiting for processing.'
              : status === 'in_progress'
                ? 'Analyzer or bench work is still active.'
                : status === 'completed'
                  ? criticalResult
                    ? 'Result is complete and marked critical.'
                    : 'Result is complete and ready for reviewer release.'
                  : status === 'cancelled'
                    ? 'Order was cancelled before release.'
                    : 'Order state is available in the lifecycle history.';

    return [
        {
            label: 'Current status',
            value: formatEnumLabel(order.status ?? 'unknown'),
            note: statusNote,
            variant: statusVariant(order.status),
        },
        {
            label: 'Verification',
            value: released
                ? 'Verified'
                : status === 'completed'
                  ? criticalResult
                    ? 'Critical note required'
                    : 'Awaiting verification'
                  : status === 'cancelled'
                    ? 'Stopped'
                    : 'Not ready',
            note: released
                ? `Verified ${formatDateTime(order.verifiedAt)}`
                : status === 'completed'
                  ? criticalResult
                    ? 'Verification note must be recorded before release.'
                    : 'Reviewer verification is the last release step.'
                  : status === 'cancelled'
                    ? 'Cancelled orders do not move to verification.'
                    : 'Verification opens after result completion.',
            variant: released
                ? 'secondary'
                : status === 'completed' && criticalResult
                  ? 'destructive'
                  : 'outline',
        },
        {
            label: 'Downstream handoff',
            value: released
                ? 'Ready to hand off'
                : status === 'cancelled'
                  ? 'Stopped'
                  : status === 'completed'
                    ? criticalResult
                      ? 'Release blocked'
                      : 'Release pending'
                    : 'Not ready',
            note: released
                ? 'Consultation and downstream services can continue with released result context.'
                : status === 'cancelled'
                  ? 'Use related workflows only for context review.'
                  : status === 'completed' && criticalResult
                    ? 'Critical verification must be completed before handoff.'
                    : status === 'completed'
                      ? 'Verify the result before using downstream handoff actions.'
                      : 'Complete the result first, then verify for handoff.',
            variant: released
                ? 'secondary'
                : status === 'cancelled' || (status === 'completed' && criticalResult)
                  ? 'destructive'
                  : 'outline',
        },
    ];
});

const detailsSheetDownstreamState = computed(() => {
    const order = detailsSheetOrder.value;
    if (!order) return null;

    const status = (order.status ?? '').toLowerCase();
    const criticalResult = isCriticalLabResultSummary(order.resultSummary);
    const released = detailsSheetResultReleased.value;

    if (status === 'cancelled') {
        return {
            title: 'Workflow stopped',
            description: 'The laboratory order was cancelled. Use the related workflows only for context review.',
            variant: 'destructive',
        };
    }

    if (released) {
        return {
            title: 'Ready for downstream handoff',
            description: 'Result verification is recorded. Continue clinical, pharmacy, or billing follow-up with released result context.',
            variant: 'default',
        };
    }

    if (status === 'completed' && criticalResult) {
        return {
            title: 'Critical result blocks release',
            description: 'Record the verification note and verify the result before handing it off downstream.',
            variant: 'destructive',
        };
    }

    if (status === 'completed') {
        return {
            title: 'Release pending verification',
            description: 'Verify the completed result before using downstream handoff actions for active follow-up.',
            variant: 'default',
        };
    }

    return {
        title: 'Downstream handoff not ready',
        description: 'Finish laboratory processing and complete the result first.',
        variant: 'default',
    };
});

const detailsSheetDownstreamActions = computed<LaboratoryDownstreamAction[]>(() => {
    const order = detailsSheetOrder.value;
    if (!order) return [];

    const released = detailsSheetResultReleased.value;
    const actions: LaboratoryDownstreamAction[] = [];

    if (order.patientId && canReadMedicalRecords.value) {
        actions.push({
            id: 'medical-records',
            label: order.appointmentId || order.admissionId
                ? 'Open consultation workspace'
                : 'Open medical records',
            description: released
                ? 'Carry this released result back into clinical review with the same patient context.'
                : 'Best after verification so the released result is visible in follow-up.',
            href: orderDetailsWorkflowHref('/medical-records', order, {
                includeTabNew: true,
            }),
            icon: 'clipboard-list',
            buttonLabel: order.appointmentId || order.admissionId
                ? 'Open consultation'
                : 'Open records',
            readiness: released ? 'ready' : 'after_release',
        });
    }

    if (order.appointmentId && canReadAppointments.value) {
        actions.push({
            id: 'appointments',
            label: 'Back to appointments',
            description: 'Return to the originating appointment queue context for this order.',
            href: orderDetailsWorkflowHref('/appointments', order, {
                focusAppointmentOnReturn: true,
            }),
            icon: 'calendar-clock',
            buttonLabel: 'Open appointment',
            readiness: 'reference',
        });
    }

    if (order.admissionId && canReadAdmissions.value) {
        actions.push({
            id: 'admissions',
            label: 'Open admissions',
            description: 'Return to the linked admission context for inpatient follow-up.',
            href: orderDetailsWorkflowHref('/admissions', order),
            icon: 'bed-double',
            buttonLabel: 'Open admission',
            readiness: 'reference',
        });
    }

    if (order.patientId && canAccessPharmacyOrders.value) {
        actions.push({
            id: 'pharmacy-orders',
            label: 'New pharmacy order',
            description: released
                ? 'Continue medication workflow with the same patient context.'
                : 'Use after release when medication changes depend on this result.',
            href: orderDetailsWorkflowHref('/pharmacy-orders', order, {
                includeTabNew: true,
            }),
            icon: 'pill',
            buttonLabel: 'Open pharmacy',
            readiness: released ? 'ready' : 'after_release',
        });
    }

    if (order.patientId && canAccessBillingInvoices.value) {
        actions.push({
            id: 'billing-invoices',
            label: 'New billing invoice',
            description: 'Create a billing invoice with the same patient and encounter context when needed.',
            href: orderDetailsWorkflowHref('/billing-invoices', order, {
                includeTabNew: true,
            }),
            icon: 'receipt',
            buttonLabel: 'Create invoice',
            readiness: 'reference',
        });
    }

    return actions;
});

const showLaboratoryDownstreamHandoff = computed(
    () => detailsSheetDownstreamActions.value.length > 0,
);

const detailsSheetBlockedDownstreamButtonLabel = computed(() => {
    const nextAction = detailsSheetNextWorkflowAction.value;
    if (!nextAction) return 'Resolve release step';
    if (nextAction.action === 'verify') return 'Verify + Release first';
    if (nextAction.action === 'completed') return 'Complete result first';
    if (nextAction.action === 'in_progress') return 'Start processing first';
    if (nextAction.action === 'collected') return 'Mark collected first';
    return nextAction.label;
});

const statusDialogCriticalReleaseChecklist = computed(() => {
    const order = statusDialogOrder.value;
    if (!order || !statusDialogCriticalVerificationNoteRequired.value) return [];

    return [
        'Review ' + (order.testCode || order.testName || 'the result') + ' before release.',
        'Record the verification note for the critical-result release.',
        laboratoryOrderClinicalFollowupDescription(order),
    ];
});

const detailsSheetJourneyEvents = computed<LaboratoryJourneyEvent[]>(() => {
    const order = detailsSheetOrder.value;
    if (!order) return [];

    const status = (order.status ?? '').toLowerCase();
    const collectedAt = lifecycleStatusTimestamp('collected');
    const inProgressAt = lifecycleStatusTimestamp('in_progress');
    const completedAt =
        lifecycleStatusTimestamp('completed') ?? order.resultedAt ?? null;
    const verifiedAt =
        latestLaboratoryAuditLogMatch(
            (log) => (log.action ?? '') === 'laboratory-order.result.verified',
        )?.createdAt ??
        order.verifiedAt ??
        null;
    const cancelledAt = lifecycleStatusTimestamp('cancelled');
    const criticalResult = isCriticalLabResultSummary(order.resultSummary);

    const events: LaboratoryJourneyEvent[] = [
        {
            id: 'ordered',
            title: 'Order placed',
            description:
                order.testName?.trim() ||
                order.testCode?.trim() ||
                'Laboratory request captured from the clinical workflow.',
            occurredAt: order.orderedAt,
            state: 'done',
            tone: 'default',
            note: order.orderNumber ? `Order ${order.orderNumber}` : null,
        },
        {
            id: 'collected',
            title: 'Specimen collected',
            description: collectedAt
                ? 'Specimen receipt was recorded in the lab queue.'
                : status === 'ordered'
                  ? 'Awaiting specimen collection.'
                  : 'Collection step is implied by current status, but no dedicated timestamp is available.',
            occurredAt: collectedAt,
            state:
                collectedAt || ['in_progress', 'completed'].includes(status)
                    ? 'done'
                    : status === 'collected'
                      ? 'active'
                      : 'pending',
            tone: 'warning',
            note: order.specimenType?.trim()
                ? `Specimen: ${order.specimenType.trim()}`
                : null,
        },
        {
            id: 'processing',
            title: 'Processing in laboratory',
            description: inProgressAt
                ? 'Analyzer or bench workflow started.'
                : status === 'collected'
                  ? 'Ready for analyzer or bench work.'
                  : status === 'in_progress'
                    ? 'Work is currently in progress.'
                    : 'Processing has not started yet.',
            occurredAt: inProgressAt,
            state:
                inProgressAt || status === 'completed'
                    ? 'done'
                    : status === 'in_progress'
                      ? 'active'
                      : 'pending',
            tone: 'warning',
            note: null,
        },
        {
            id: 'completed',
            title: 'Result completed',
            description: completedAt
                ? criticalResult
                    ? 'Critical result captured and ready for review.'
                    : 'Result summary captured and ready for review.'
                : 'Result details have not been completed yet.',
            occurredAt: completedAt,
            state:
                completedAt && order.verifiedAt
                    ? 'done'
                    : status === 'completed'
                      ? 'active'
                      : 'pending',
            tone: criticalResult ? 'critical' : 'success',
            note: criticalResult ? 'Critical result flag detected.' : null,
        },
        {
            id: 'verified',
            title: 'Result verified',
            description: verifiedAt
                ? 'Reviewer attestation is recorded for release.'
                : criticalResult
                  ? 'Verification note is still required before release.'
                  : 'Awaiting final reviewer verification.',
            occurredAt: verifiedAt,
            state: verifiedAt
                ? 'done'
                : status === 'completed'
                  ? 'active'
                  : 'pending',
            tone: verifiedAt
                ? 'success'
                : criticalResult
                  ? 'critical'
                  : 'default',
            note: order.verificationNote?.trim() || null,
        },
    ];

    if (status === 'cancelled') {
        events.push({
            id: 'cancelled',
            title: 'Order cancelled',
            description:
                order.statusReason?.trim() ||
                'The laboratory order was cancelled before release.',
            occurredAt: cancelledAt ?? order.updatedAt ?? null,
            state: 'done',
            tone: 'critical',
            note: null,
        });
    }

    return events;
});

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

watch(
    [() => createForm.labTestCatalogItemId, labTestCatalogItems],
    () => {
        syncCreateLabTestCatalogSelection();
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

watch(
    () => searchForm.q,
    (value, previousValue) => {
        const currentQuery = value.trim();
        const previousQuery = (previousValue ?? '').trim();
        if (currentQuery === previousQuery) return;

        clearSearchDebounce();
        searchDebounceTimer = window.setTimeout(() => {
            searchForm.page = 1;
            void Promise.all([loadOrders(), loadOrderStatusCounts()]);
            searchDebounceTimer = null;
        }, 350);
    },
);

onBeforeUnmount(clearSearchDebounce);
onMounted(async () => {
    await initialPageLoad();
    await applyFocusedOrderFromQuery();
});
</script>

<template>
    <Head title="Laboratory Orders" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6"
        >
            <!-- Page header -->
            <div
                class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
                <div class="min-w-0">
                    <h1
                        class="flex items-center gap-2 text-2xl font-semibold tracking-tight"
                    >
                        <AppIcon
                            name="flask-conical"
                            class="size-7 text-primary"
                        />
                        Laboratory Orders
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Create and track lab orders from outpatient and
                        consultation workflows.
                    </p>
                </div>
                <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                    <Badge variant="outline">
                        {{
                            !scope
                                ? 'Scope Unavailable'
                                : scope.resolvedFrom === 'none'
                                  ? 'Scope Unresolved'
                                  : 'Scope Ready'
                        }}
                    </Badge>
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
                        v-if="
                            laboratoryWorkspaceView === 'new' ||
                            canCreateLaboratoryOrders
                        "
                        :variant="
                            laboratoryWorkspaceView === 'new'
                                ? 'outline'
                                : 'default'
                        "
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="
                            laboratoryWorkspaceView === 'new'
                                ? setLaboratoryWorkspaceView('queue', {
                                      focusSearch: true,
                                  })
                                : setLaboratoryWorkspaceView('new', {
                                      focusCreate: true,
                                  })
                        "
                    >
                        <AppIcon
                            :name="
                                laboratoryWorkspaceView === 'new'
                                    ? 'layout-list'
                                    : 'plus'
                            "
                            class="size-3.5"
                        />
                        {{
                            laboratoryWorkspaceView === 'new'
                                ? 'Laboratory Queue'
                                : 'Create order'
                        }}
                    </Button>
            </div>
            </div>


            <!-- Queue bar -->
            <div
                v-if="
                    canReadLaboratoryOrders &&
                    laboratoryWorkspaceView === 'queue'
                "
                class="rounded-lg border bg-muted/30 px-3 py-2"
            >
                <div
                    class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between"
                >
                    <div class="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            :class="
                                isLaboratorySummaryFilterActive('ordered')
                                    ? 'border-primary bg-primary/10'
                                    : ''
                            "
                            @click="applyLaboratorySummaryFilter('ordered')"
                        >
                            <span class="font-medium text-foreground">{{
                                queueCountLabel(summaryQueueCounts.ordered)
                            }}</span>
                            <span class="text-muted-foreground">Ordered</span>
                        </button>
                        <button
                            v-if="showLaboratoryOperationalQueueControls"
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            :class="
                                isLaboratorySummaryFilterActive('collected')
                                    ? 'border-primary bg-primary/10'
                                    : ''
                            "
                            @click="applyLaboratorySummaryFilter('collected')"
                        >
                            <span class="font-medium text-foreground">{{
                                queueCountLabel(summaryQueueCounts.collected)
                            }}</span>
                            <span class="text-muted-foreground">Collected</span>
                        </button>
                        <button
                            v-if="showLaboratoryOperationalQueueControls"
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            :class="
                                isLaboratorySummaryFilterActive('in_progress')
                                    ? 'border-primary bg-primary/10'
                                    : ''
                            "
                            @click="applyLaboratorySummaryFilter('in_progress')"
                        >
                            <span class="font-medium text-foreground">{{
                                queueCountLabel(summaryQueueCounts.inProgress)
                            }}</span>
                            <span class="text-muted-foreground"
                                >In Progress</span
                            >
                        </button>
                        <button
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            :class="
                                isLaboratorySummaryFilterActive('completed')
                                    ? 'border-primary bg-primary/10'
                                    : ''
                            "
                            @click="applyLaboratorySummaryFilter('completed')"
                        >
                            <span class="font-medium text-foreground">{{
                                queueCountLabel(summaryQueueCounts.completed)
                            }}</span>
                            <span class="text-muted-foreground">Completed</span>
                        </button>
                        <button
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            :class="
                                isLaboratorySummaryFilterActive('cancelled')
                                    ? 'border-primary bg-primary/10'
                                    : ''
                            "
                            @click="applyLaboratorySummaryFilter('cancelled')"
                        >
                            <span class="font-medium text-foreground">{{
                                queueCountLabel(summaryQueueCounts.cancelled)
                            }}</span>
                            <span class="text-muted-foreground">Cancelled</span>
                        </button>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">

                        <Button
                            size="sm"
                            class="h-8 gap-1.5"
                            :variant="
                                laboratoryQueuePresetState.queueToday
                                    ? 'default'
                                    : 'outline'
                            "
                            as-child
                        >
                            <Link
                                :href="`/laboratory-orders?tab=queue&from=${today}`"
                            >
                                <AppIcon name="layout-list" class="size-3.5" />
                                Queue Today
                            </Link>
                        </Button>
                        <Button
                            v-if="showLaboratoryOperationalQueueControls"
                            size="sm"
                            class="h-8 gap-1.5"
                            :variant="
                                laboratoryQueuePresetState.inProgress
                                    ? 'default'
                                    : 'outline'
                            "
                            as-child
                        >
                            <Link
                                :href="`/laboratory-orders?tab=queue&status=in_progress&from=${today}`"
                            >
                                <AppIcon name="activity" class="size-3.5" />
                                In Progress
                            </Link>
                        </Button>
                        <Button
                            size="sm"
                            class="h-8 gap-1.5"
                            :variant="
                                laboratoryQueuePresetState.completed
                                    ? 'default'
                                    : 'outline'
                            "
                            as-child
                        >
                            <Link
                                :href="`/laboratory-orders?tab=queue&status=completed&from=${today}`"
                            >
                                <AppIcon name="check-check" class="size-3.5" />
                                Completed
                            </Link>
                        </Button>
                        <Button
                            v-if="showLaboratoryExceptionQueue"
                            size="sm"
                            variant="outline"
                            class="h-8 gap-1.5"
                            @click="scrollToLaboratoryExceptionQueue"
                        >
                            <AppIcon name="alert-triangle" class="size-3.5" />
                            Exceptions
                            <Badge
                                v-if="laboratoryExceptionSummary.total > 0"
                                variant="secondary"
                                class="ml-1"
                            >
                                {{ laboratoryExceptionSummary.total }}
                            </Badge>
                        </Button>
                    </div>
                </div>
            </div>

            <Alert v-if="scopeWarning" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="alert-triangle" class="size-4" />
                    Scope warning
                </AlertTitle>
                <AlertDescription>{{ scopeWarning }}</AlertDescription>
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
            <Alert v-if="lastLaboratoryAuditExportRetryHandoff">
                <AlertTitle>Resume last handoff target</AlertTitle>
                <AlertDescription>
                    <div class="space-y-2">
                        <p class="text-xs">
                            Last laboratory handoff: order
                            {{
                                lastLaboratoryAuditExportRetryHandoff.targetOrderId
                            }}
                            | export job
                            {{ lastLaboratoryAuditExportRetryHandoff.jobId }}
                            | saved
                            {{
                                formatDateTime(
                                    lastLaboratoryAuditExportRetryHandoff.savedAt,
                                )
                            }}
                        </p>
                        <p class="text-[11px] text-muted-foreground">
                            Resume telemetry: attempts
                            {{
                                laboratoryAuditExportRetryResumeTelemetry.attempts
                            }}
                            | success
                            {{
                                laboratoryAuditExportRetryResumeTelemetry.successes
                            }}
                            | failure
                            {{
                                laboratoryAuditExportRetryResumeTelemetry.failures
                            }}
                        </p>
                        <p
                            v-if="
                                laboratoryAuditExportRetryResumeTelemetry.lastFailureReason
                            "
                            class="text-[11px] text-muted-foreground"
                        >
                            Last failure:
                            {{
                                laboratoryAuditExportRetryResumeTelemetry.lastFailureReason
                            }}
                        </p>
                        <div class="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                :disabled="
                                    resumingLaboratoryAuditExportRetryHandoff
                                "
                                @click="
                                    resumeLastLaboratoryAuditExportRetryHandoff
                                "
                            >
                                {{
                                    resumingLaboratoryAuditExportRetryHandoff
                                        ? 'Resuming...'
                                        : 'Resume Last Handoff'
                                }}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                @click="
                                    clearLastLaboratoryAuditExportRetryHandoff
                                "
                            >
                                Clear
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                @click="
                                    resetLaboratoryAuditExportRetryResumeTelemetry
                                "
                            >
                                Reset Telemetry
                            </Button>
                        </div>
                    </div>
                </AlertDescription>
            </Alert>
            <Alert v-if="auditExportRetryHandoffCompletedMessage">
                <AlertTitle>Retry handoff ready</AlertTitle>
                <AlertDescription>
                    <div
                        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <p class="text-xs">
                            {{ auditExportRetryHandoffCompletedMessage }}
                        </p>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            @click="
                                auditExportRetryHandoffCompletedMessage = null
                            "
                        >
                            Dismiss
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>

            <!-- Single column: queue card then create form -->
            <div class="flex min-w-0 flex-col gap-4">
                <template v-if="laboratoryWorkspaceView === 'queue'">
                    <!-- Laboratory queue card -->
                    <Card
                        v-if="canReadLaboratoryOrders"
                        id="laboratory-order-queue"
                        class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70"
                    >
                        <CardHeader class="shrink-0 gap-2 pb-2">
                            <div class="space-y-2">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="text-xs text-muted-foreground">{{ laboratoryListBadgeLabel }}</span>
                                        <Badge v-if="isPatientChartQueueFocusApplied" variant="outline" class="text-[10px]">
                                            Patient chart handoff
                                        </Badge>
                                        <span v-if="activePatientSummary" class="text-xs text-muted-foreground">
                                            {{ patientName(activePatientSummary) }} · {{ activePatientSummary.patientNumber || shortId(activePatientSummary.id) }}
                                        </span>
                                    </div>
                                    <div v-if="patientChartQueueReturnHref || patientChartQueueRouteContext.patientId" class="flex flex-wrap items-center gap-2">
                                        <Button v-if="patientChartQueueReturnHref" variant="outline" size="sm" as-child>
                                            <Link :href="patientChartQueueReturnHref">Back to chart</Link>
                                        </Button>
                                        <Button v-if="isPatientChartQueueFocusApplied" variant="outline" size="sm" @click="openFullLaboratoryQueue">
                                            Full queue
                                        </Button>
                                        <Button v-else-if="openedFromPatientChart && patientChartQueueRouteContext.patientId" variant="outline" size="sm" @click="refocusLaboratoryPatientQueue">
                                            Refocus patient
                                        </Button>
                                    </div>
                                </div>
                                <div class="flex w-full flex-col gap-2">
                                    <div
                                        class="flex w-full flex-col gap-2 xl:flex-row xl:items-center"
                                    >
                                        <div class="relative min-w-0 flex-1">
                                            <AppIcon
                                                name="search"
                                                class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                                            />
                                            <Input
                                                id="lab-q"
                                                v-model="searchForm.q"
                                                placeholder="Search order number, test code, or test name"
                                                class="h-9 pl-9"
                                                @keyup.enter="submitSearch"
                                            />
                                        </div>
                                        <div
                                            class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap"
                                        >
                                            <Select v-model="statusSelectValue">
                                                <SelectTrigger
                                                    class="h-9 w-full bg-background sm:w-[11rem]"
                                                    size="sm"
                                                    aria-label="Filter laboratory orders by status"
                                                >
                                                    <SelectValue placeholder="All statuses" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all"
                                                        >All statuses</SelectItem
                                                    >
                                                    <SelectItem value="ordered"
                                                        >Ordered</SelectItem
                                                    >
                                                    <SelectItem value="collected"
                                                        >Collected</SelectItem
                                                    >
                                                    <SelectItem value="in_progress"
                                                        >In Progress</SelectItem
                                                    >
                                                    <SelectItem value="completed"
                                                        >Completed</SelectItem
                                                    >
                                                    <SelectItem value="cancelled"
                                                        >Cancelled</SelectItem
                                                    >
                                                </SelectContent>
                                            </Select>

                                            <Select v-model="prioritySelectValue">
                                                <SelectTrigger
                                                    class="h-9 w-full bg-background sm:w-[11rem]"
                                                    size="sm"
                                                    aria-label="Filter laboratory orders by priority"
                                                >
                                                    <SelectValue placeholder="All priorities" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all"
                                                        >All priorities</SelectItem
                                                    >
                                                    <SelectItem value="routine"
                                                        >Routine</SelectItem
                                                    >
                                                    <SelectItem value="urgent"
                                                        >Urgent</SelectItem
                                                    >
                                                    <SelectItem value="stat"
                                                        >STAT</SelectItem
                                                    >
                                                </SelectContent>
                                            </Select>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                class="h-9 gap-1.5"
                                                @click="advancedFiltersSheetOpen = true"
                                            >
                                                <AppIcon
                                                    name="sliders-horizontal"
                                                    class="size-3.5"
                                                />
                                                All filters
                                                <Badge
                                                    v-if="activeLaboratoryAdvancedFilterCount"
                                                    variant="secondary"
                                                    class="ml-1 text-[10px]"
                                                >
                                                    {{ activeLaboratoryAdvancedFilterCount }}
                                                </Badge>
                                            </Button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger as-child>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        class="h-9 gap-1.5"
                                                    >
                                                        <AppIcon
                                                            name="eye"
                                                            class="size-3.5"
                                                        />
                                                        View
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="end"
                                                    class="w-56"
                                                >
                                                    <DropdownMenuLabel class="text-xs text-muted-foreground">
                                                        Results per page
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuRadioGroup
                                                        v-model="resultsPerPageValue"
                                                    >
                                                        <DropdownMenuRadioItem value="10"
                                                            >10</DropdownMenuRadioItem
                                                        >
                                                        <DropdownMenuRadioItem value="25"
                                                            >25</DropdownMenuRadioItem
                                                        >
                                                        <DropdownMenuRadioItem value="50"
                                                            >50</DropdownMenuRadioItem
                                                        >
                                                    </DropdownMenuRadioGroup>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuLabel class="text-xs text-muted-foreground">
                                                        Row density
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuRadioGroup
                                                        v-model="queueDensityValue"
                                                    >
                                                        <DropdownMenuRadioItem value="comfortable"
                                                            >Comfortable</DropdownMenuRadioItem
                                                        >
                                                        <DropdownMenuRadioItem value="compact"
                                                            >Compact</DropdownMenuRadioItem
                                                        >
                                                    </DropdownMenuRadioGroup>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>

                                    <div
                                        v-if="activeLaboratoryFilterBadgeLabels.length"
                                        class="flex flex-wrap items-center gap-1.5 pt-1"
                                    >
                                        <Badge
                                            v-for="label in activeLaboratoryFilterBadgeLabels"
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
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent
                            class="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
                        >
                            <div
                                v-if="showLaboratoryExceptionQueue"
                                id="laboratory-exception-queue"
                                class="border-b bg-muted/20 px-4 py-3"
                            >
                                <div
                                    class="rounded-lg border p-3"
                                    :class="laboratoryExceptionPanelClass"
                                >
                                    <div
                                        class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
                                    >
                                        <div class="min-w-0">
                                            <p
                                                class="flex items-center gap-2 text-sm font-medium"
                                            >
                                                <AppIcon
                                                    name="alert-triangle"
                                                    class="size-4"
                                                    :class="laboratoryExceptionIconClass"
                                                />
                                                Laboratory exception queue
                                            </p>
                                            <p
                                                class="mt-1 text-xs text-muted-foreground"
                                            >
                                                Orders needing follow-up across
                                                the current queue scope so
                                                critical, delayed, and unresolved
                                                work stays visible.
                                            </p>
                                        </div>
                                        <div
                                            class="flex flex-wrap items-center gap-1.5"
                                        >
                                            <Badge
                                                v-if="
                                                    laboratoryExceptionSummary.critical >
                                                    0
                                                "
                                                variant="destructive"
                                            >
                                                {{
                                                    laboratoryExceptionSummary.critical
                                                }}
                                                critical
                                            </Badge>
                                            <Badge
                                                v-if="
                                                    laboratoryExceptionSummary.warning >
                                                    0
                                                "
                                                variant="secondary"
                                            >
                                                {{
                                                    laboratoryExceptionSummary.warning
                                                }}
                                                delayed
                                            </Badge>
                                            <Badge
                                                v-if="
                                                    laboratoryExceptionSummary.info >
                                                    0
                                                "
                                                variant="outline"
                                            >
                                                {{
                                                    laboratoryExceptionSummary.info
                                                }}
                                                follow-up
                                            </Badge>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                class="h-8 gap-1.5"
                                                :disabled="
                                                    laboratoryExceptionLoading
                                                "
                                                @click="
                                                    void loadLaboratoryExceptionOrders()
                                                "
                                            >
                                                <AppIcon
                                                    name="activity"
                                                    class="size-3.5"
                                                />
                                                {{
                                                    laboratoryExceptionLoading
                                                        ? 'Refreshing...'
                                                        : 'Refresh'
                                                }}
                                            </Button>
                                        </div>
                                    </div>
                                    <div
                                        v-if="laboratoryExceptionLoading"
                                        class="mt-3 space-y-2"
                                    >
                                        <Skeleton class="h-20 w-full" />
                                        <Skeleton class="h-20 w-full" />
                                    </div>
                                    <Alert
                                        v-else-if="laboratoryExceptionError"
                                        variant="destructive"
                                        class="mt-3"
                                    >
                                        <AlertTitle
                                            class="flex items-center gap-2"
                                        >
                                            <AppIcon
                                                name="circle-x"
                                                class="size-4"
                                            />
                                            Exception queue unavailable
                                        </AlertTitle>
                                        <AlertDescription>
                                            {{ laboratoryExceptionError }}
                                        </AlertDescription>
                                    </Alert>
                                    <div v-else class="mt-3 space-y-2">
                                        <div
                                            v-for="item in visibleLaboratoryExceptionItems"
                                            :key="item.id"
                                            class="flex flex-col gap-2 rounded-md border p-2.5 lg:flex-row lg:items-start lg:justify-between"
                                            :class="exceptionSurfaceClass(item.severity)"
                                        >
                                            <div class="min-w-0 space-y-1">
                                                <div
                                                    class="flex flex-wrap items-center gap-2"
                                                >
                                                    <Badge
                                                        :variant="
                                                            exceptionSeverityVariant(
                                                                item.severity,
                                                            )
                                                        "
                                                    >
                                                        {{ item.title }}
                                                    </Badge>
                                                    <Badge
                                                        :variant="
                                                            statusVariant(
                                                                item.order
                                                                    .status,
                                                            )
                                                        "
                                                    >
                                                        {{
                                                            formatEnumLabel(
                                                                item.order
                                                                    .status ||
                                                                    'unknown',
                                                            )
                                                        }}
                                                    </Badge>
                                                    <Badge
                                                        v-if="
                                                            item.order.priority
                                                        "
                                                        :variant="
                                                            priorityVariant(
                                                                item.order
                                                                    .priority,
                                                            )
                                                        "
                                                    >
                                                        {{
                                                            item.order.priority
                                                        }}
                                                    </Badge>
                                                </div>
                                                <p class="text-sm font-medium">
                                                    {{
                                                        item.order
                                                            .orderNumber ||
                                                        'Laboratory Order'
                                                    }}
                                                    |
                                                    {{
                                                        item.order.testName ||
                                                        item.order.testCode ||
                                                        'Pending test'
                                                    }}
                                                </p>
                                                <p
                                                    class="text-xs text-muted-foreground"
                                                >
                                                    Patient:
                                                    {{
                                                        orderPatientLabel(
                                                            item.order,
                                                        )
                                                    }}
                                                    <span
                                                        v-if="
                                                            orderPatientNumber(
                                                                item.order,
                                                            )
                                                        "
                                                        class="ml-1"
                                                    >
                                                        ({{
                                                            orderPatientNumber(
                                                                item.order,
                                                            )
                                                        }})
                                                    </span>
                                                    <span
                                                        v-if="item.elapsedLabel"
                                                        class="ml-1"
                                                    >
                                                        |
                                                        {{ item.elapsedLabel }}
                                                    </span>
                                                </p>
                                                <p
                                                    class="text-xs text-muted-foreground"
                                                >
                                                    <span class="font-medium text-foreground">Current blocker:</span>
                                                    {{ item.description }}
                                                </p>
                                                <p
                                                    v-if="item.nextAction && canExecuteLaboratoryWorkflowAction(item.nextAction.action)"
                                                    class="text-[11px] text-muted-foreground"
                                                >
                                                    <span class="font-medium text-foreground">Next action:</span>
                                                    {{ item.nextAction.description }}
                                                </p>
                                            </div>
                                            <div
                                                class="flex flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:justify-end"
                                            >
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    class="w-full sm:w-auto"
                                                    :disabled="
                                                        actionLoadingId ===
                                                        item.order.id
                                                    "
                                                    @click="
                                                        openOrderDetailsSheet(
                                                            item.order,
                                                        )
                                                    "
                                                >
                                                    Open order
                                                </Button>
                                                <Button
                                                    v-if="item.nextAction"
                                                    size="sm"
                                                    class="w-full sm:w-auto"
                                                    :variant="
                                                        item.severity ===
                                                        'critical'
                                                            ? 'default'
                                                            : 'outline'
                                                    "
                                                    :disabled="
                                                        actionLoadingId ===
                                                        item.order.id
                                                    "
                                                    @click="
                                                        openOrderStatusDialog(
                                                            item.order,
                                                            item.nextAction
                                                                .action,
                                                        )
                                                    "
                                                >
                                                    {{ item.nextAction.label }}
                                                </Button>
                                            </div>
                                        </div>
                                        <p
                                            v-if="
                                                laboratoryExceptionItems.length >
                                                visibleLaboratoryExceptionItems.length
                                            "
                                            class="text-xs text-muted-foreground"
                                        >
                                            Showing
                                            {{
                                                visibleLaboratoryExceptionItems.length
                                            }}
                                            of
                                            {{
                                                laboratoryExceptionItems.length
                                            }}
                                            active exceptions.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <ScrollArea class="min-h-0 flex-1">
                                <div
                                    class="min-h-[12rem] p-4"
                                    :class="
                                        compactQueueRows
                                            ? 'space-y-2'
                                            : 'space-y-3'
                                    "
                                >
                                    <div
                                        v-if="pageLoading || listLoading"
                                        class="space-y-2"
                                    >
                                        <div
                                            v-for="row in 3"
                                            :key="`lab-queue-skeleton-${row}`"
                                            class="rounded-lg border px-3 py-2.5"
                                        >
                                            <div
                                                class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"
                                            >
                                                <div class="min-w-0 flex-1 space-y-2">
                                                    <div
                                                        class="flex flex-wrap items-center gap-2"
                                                    >
                                                        <Skeleton class="h-4 w-56" />
                                                        <Skeleton class="h-4 w-16 rounded-full" />
                                                        <Skeleton class="h-4 w-14 rounded-full" />
                                                    </div>
                                                    <Skeleton class="h-3 w-64" />
                                                    <Skeleton class="h-3 w-80" />
                                                </div>
                                                <div
                                                    class="flex flex-wrap gap-2 md:justify-end"
                                                >
                                                    <Skeleton class="h-8 w-20" />
                                                    <Skeleton class="h-8 w-28" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        v-else-if="orders.length === 0"
                                        class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
                                    >
                                        No laboratory orders found for the
                                        current filters.
                                    </div>
                                    <div
                                        v-else
                                        :class="
                                            compactQueueRows
                                                ? 'space-y-2'
                                                : 'space-y-2.5'
                                        "
                                    >
                                        <div
                                            v-for="order in orders"
                                            :key="order.id"
                                            class="rounded-lg border transition-colors"
                                            :class="[
                                                compactQueueRows
                                                    ? 'px-3 py-2'
                                                    : 'px-3.5 py-2.5',
                                                laboratoryOrderQueueSurfaceClass(order),
                                            ]"
                                        >
                                            <div
                                                class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"
                                            >
                                                <div class="min-w-0 flex-1 space-y-1.5">
                                                    <div
                                                        class="flex flex-wrap items-center gap-2"
                                                    >
                                                        <p
                                                            class="truncate text-sm font-medium"
                                                        >
                                                            {{
                                                                laboratoryOrderTestLabel(
                                                                    order,
                                                                )
                                                            }}
                                                        </p>
                                                        <Badge
                                                            :variant="
                                                                statusVariant(
                                                                    order.status,
                                                                )
                                                            "
                                                            class="text-[10px] leading-none"
                                                        >
                                                            {{
                                                                formatEnumLabel(
                                                                    order.status,
                                                                )
                                                            }}
                                                        </Badge>
                                                        <Badge
                                                            :variant="
                                                                priorityVariant(
                                                                    order.priority,
                                                                )
                                                            "
                                                            class="text-[10px] leading-none"
                                                        >
                                                            {{
                                                                formatEnumLabel(
                                                                    order.priority ||
                                                                        'routine',
                                                                )
                                                            }}
                                                        </Badge>
                                                        <Badge
                                                            v-if="
                                                                isCriticalLabResultSummary(
                                                                    order.resultSummary,
                                                                )
                                                            "
                                                            variant="destructive"
                                                            class="text-[10px] leading-none"
                                                        >
                                                            Critical
                                                        </Badge>
                                                        <Badge
                                                            v-if="laboratoryOrderReleaseBadgeLabel(order)"
                                                            :variant="laboratoryOrderReleaseBadgeVariant(order)"
                                                            class="text-[10px] leading-none"
                                                        >
                                                            {{ laboratoryOrderReleaseBadgeLabel(order) }}
                                                        </Badge>
                                                    </div>
                                                    <p
                                                        class="truncate text-xs text-muted-foreground"
                                                    >
                                                        {{
                                                            order.orderNumber ||
                                                            'Laboratory order'
                                                        }}
                                                        |
                                                        {{ orderPatientLabel(order) }}
                                                        <span
                                                            v-if="
                                                                orderPatientNumber(
                                                                    order,
                                                                )
                                                            "
                                                        >
                                                            ({{
                                                                orderPatientNumber(
                                                                    order,
                                                                )
                                                            }})
                                                        </span>
                                                    </p>
                                                    <div
                                                        class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
                                                    >
                                                        <span>
                                                            Ordered
                                                            {{
                                                                formatDateTime(
                                                                    order.orderedAt,
                                                                )
                                                            }}
                                                        </span>
                                                        <span v-if="order.specimenType">
                                                            {{ order.specimenType }}
                                                        </span>
                                                        <span v-if="order.appointmentId">
                                                            Appt
                                                            {{
                                                                shortId(
                                                                    order.appointmentId,
                                                                )
                                                            }}
                                                        </span>
                                                        <span
                                                            v-else-if="order.admissionId"
                                                        >
                                                            Admission
                                                            {{
                                                                shortId(
                                                                    order.admissionId,
                                                                )
                                                            }}
                                                        </span>
                                                        <span v-if="order.verifiedAt">
                                                            Verified
                                                            {{
                                                                formatDateTime(
                                                                    order.verifiedAt,
                                                                )
                                                            }}
                                                        </span>
                                                        <span
                                                            v-else-if="order.resultedAt"
                                                        >
                                                            Resulted
                                                            {{
                                                                formatDateTime(
                                                                    order.resultedAt,
                                                                )
                                                            }}
                                                        </span>
                                                    </div>
                                                    <p
                                                        v-if="laboratoryOrderQueueWorkflowHint(order)"
                                                        class="truncate text-[11px] font-medium"
                                                        :class="laboratoryOrderQueueWorkflowHintClass(order)"
                                                    >
                                                        {{ laboratoryOrderQueueWorkflowHint(order) }}
                                                    </p>
                                                    <p
                                                        v-if="
                                                            laboratoryOrderResultPreview(
                                                                order,
                                                            )
                                                        "
                                                        class="truncate text-xs text-muted-foreground"
                                                    >
                                                        {{
                                                            laboratoryOrderResultPreview(
                                                                order,
                                                            )
                                                        }}
                                                    </p>
                                                </div>
                                                <div class="flex items-center gap-1.5 md:justify-end">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        class="gap-1.5"
                                                        :disabled="actionLoadingId === order.id"
                                                        @click="openOrderDetailsSheet(order)"
                                                    >
                                                        <AppIcon name="panel-right-open" class="size-3.5" />
                                                        Open
                                                    </Button>
                                                    <!-- Primary workflow action -->
                                                    <Button
                                                        v-if="canUpdateLaboratoryOrderStatus && order.status === 'ordered'"
                                                        size="sm"
                                                        variant="outline"
                                                        class="gap-1.5"
                                                        :disabled="actionLoadingId === order.id"
                                                        @click="openOrderStatusDialog(order, 'collected')"
                                                    >
                                                        <AppIcon name="test-tube" class="size-3.5" />
                                                        {{ actionLoadingId === order.id ? 'Updating...' : 'Collect' }}
                                                    </Button>
                                                    <Button
                                                        v-else-if="canUpdateLaboratoryOrderStatus && order.status === 'collected'"
                                                        size="sm"
                                                        class="gap-1.5"
                                                        :disabled="actionLoadingId === order.id"
                                                        @click="openOrderStatusDialog(order, 'in_progress')"
                                                    >
                                                        <AppIcon name="activity" class="size-3.5" />
                                                        {{ actionLoadingId === order.id ? 'Updating...' : 'Process' }}
                                                    </Button>
                                                    <Button
                                                        v-else-if="canUpdateLaboratoryOrderStatus && order.status === 'in_progress'"
                                                        size="sm"
                                                        class="gap-1.5"
                                                        :disabled="actionLoadingId === order.id"
                                                        @click="openOrderStatusDialog(order, 'completed')"
                                                    >
                                                        <AppIcon name="circle-check" class="size-3.5" />
                                                        {{ actionLoadingId === order.id ? 'Updating...' : 'Complete' }}
                                                    </Button>
                                                    <Button
                                                        v-else-if="canVerifyLaboratoryOrderResult && order.status === 'completed' && !order.verifiedAt"
                                                        size="sm"
                                                        class="gap-1.5"
                                                        :variant="isCriticalLabResultSummary(order.resultSummary) ? 'destructive' : 'default'"
                                                        :disabled="actionLoadingId === order.id"
                                                        @click="openOrderStatusDialog(order, 'verify')"
                                                    >
                                                        <AppIcon :name="isCriticalLabResultSummary(order.resultSummary) ? 'triangle-alert' : 'shield-check'" class="size-3.5" />
                                                        {{ actionLoadingId === order.id ? 'Updating...' : isCriticalLabResultSummary(order.resultSummary) ? 'Verify Critical' : 'Verify' }}
                                                    </Button>
                                                    <Button
                                                        v-else-if="canOpenLaboratoryClinicalFollowup(order) && order.verifiedAt"
                                                        size="sm"
                                                        class="gap-1.5"
                                                        as-child
                                                    >
                                                        <Link :href="laboratoryOrderClinicalFollowupHref(order)">
                                                            <AppIcon name="arrow-right" class="size-3.5" />
                                                            {{ laboratoryOrderClinicalFollowupLabel(order) }}
                                                        </Link>
                                                    </Button>
                                                    <!-- More dropdown -->
                                                    <DropdownMenu v-if="canUpdateLaboratoryOrderStatus && !['completed', 'cancelled'].includes(order.status || '')">
                                                        <DropdownMenuTrigger as-child>
                                                            <Button size="sm" variant="outline" :disabled="actionLoadingId === order.id" class="gap-1">
                                                                More
                                                                <AppIcon name="chevron-down" class="size-3.5" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" class="w-44">
                                                            <DropdownMenuItem
                                                                v-if="order.status === 'ordered'"
                                                                :disabled="actionLoadingId === order.id"
                                                                @select.prevent="openOrderStatusDialog(order, 'collected')"
                                                            >
                                                                Mark Collected
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                v-if="order.status === 'collected'"
                                                                :disabled="actionLoadingId === order.id"
                                                                @select.prevent="openOrderStatusDialog(order, 'in_progress')"
                                                            >
                                                                Start Processing
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                v-if="order.status === 'in_progress'"
                                                                :disabled="actionLoadingId === order.id"
                                                                @select.prevent="openOrderStatusDialog(order, 'completed')"
                                                            >
                                                                Complete + Result
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                class="text-destructive focus:text-destructive"
                                                                :disabled="actionLoadingId === order.id"
                                                                @select.prevent="openOrderStatusDialog(order, 'cancelled')"
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
                            <footer class="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-2">
                                <span class="text-xs text-muted-foreground">{{ pagination?.total ?? 0 }} orders</span>
                                <div class="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        class="size-7 p-0"
                                        :disabled="!pagination || pagination.currentPage <= 1 || listLoading"
                                        @click="prevPage"
                                    >
                                        <AppIcon name="chevron-left" class="size-3.5" />
                                    </Button>
                                    <span class="min-w-[3rem] text-center text-xs tabular-nums text-muted-foreground">
                                        {{ pagination?.currentPage ?? 1 }}/{{ pagination?.lastPage ?? 1 }}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        class="size-7 p-0"
                                        :disabled="!pagination || pagination.currentPage >= pagination.lastPage || listLoading"
                                        @click="nextPage"
                                    >
                                        <AppIcon name="chevron-right" class="size-3.5" />
                                    </Button>
                                </div>
                            </footer>
                        </CardContent>
                    </Card>
                    <Card
                        v-else-if="isLaboratoryReadPermissionResolved"
                        class="rounded-lg border-sidebar-border/70"
                    >
                        <CardHeader>
                            <CardTitle class="flex items-center gap-2">
                                <AppIcon
                                    name="shield-check"
                                    class="size-4 text-muted-foreground"
                                />
                                Laboratory Orders
                            </CardTitle>
                            <CardDescription>
                                You do not have permission to view laboratory
                                queues.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Alert variant="destructive">
                                <AlertTitle class="flex items-center gap-2">
                                    <AppIcon
                                        name="shield-check"
                                        class="size-4"
                                    />
                                    Read access restricted
                                </AlertTitle>
                                <AlertDescription>
                                    Request
                                    <code>laboratory.orders.read</code>
                                    permission to open laboratory list and queue
                                    filters.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                    <Card v-else class="rounded-lg border-sidebar-border/70">
                        <CardHeader>
                            <CardTitle>Laboratory Orders</CardTitle>
                            <CardDescription
                                >Loading access context...</CardDescription
                            >
                        </CardHeader>
                        <CardContent class="space-y-3">
                            <Skeleton class="h-4 w-1/3" />
                            <Skeleton class="h-4 w-2/3" />
                            <Skeleton class="h-16 w-full" />
                        </CardContent>
                    </Card>
                </template>
                <!-- Create Laboratory Order card -->
                <Card
                    v-else
                    id="create-lab-order"
                    class="rounded-lg border-sidebar-border/70"
                >
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon
                                name="plus"
                                class="size-5 text-muted-foreground"
                            />
                            Create Laboratory Order
                        </CardTitle>
                        <CardDescription
                            >Use patient context from consultation when
                            available, then submit a test
                            order.</CardDescription
                        >
                    </CardHeader>
                    <CardContent class="space-y-6">
                        <div class="space-y-3">
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
                                                ? 'Loading the original laboratory order so we can prefill this follow-up request safely.'
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
                                v-if="createMessage"
                                class="border-primary/30 bg-primary/5"
                            >
                                <AlertTitle>Laboratory draft updated</AlertTitle>
                                <AlertDescription>
                                    {{ createMessage }}
                                </AlertDescription>
                            </Alert>
                            <Alert
                                v-if="
                                    hasCreateErrorFeedback &&
                                    createErrorSummary
                                "
                                variant="destructive"
                                class="border-destructive/40 bg-destructive/5"
                            >
                                <AlertTitle>Check this order draft</AlertTitle>
                                <AlertDescription>
                                    {{ createErrorSummary }}
                                </AlertDescription>
                            </Alert>
                        <div class="rounded-lg border bg-muted/20 p-3">
                            <div class="flex flex-col gap-3">
                                <div
                                    class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between"
                                >
                                    <div class="min-w-0 space-y-2">
                                        <div
                                            class="flex flex-wrap items-center gap-1.5"
                                        >
                                            <Badge
                                                :variant="createOrderContextModeVariant"
                                            >
                                                {{ createOrderContextModeLabel }}
                                            </Badge>
                                            <Badge
                                                v-if="createPatientContextLocked"
                                                variant="secondary"
                                                class="text-[10px]"
                                            >
                                                Locked patient
                                            </Badge>
                                            <Badge
                                                v-if="
                                                    hasCreateAppointmentContext &&
                                                    createAppointmentContextStatusLabel
                                                "
                                                :variant="createAppointmentContextStatusVariant"
                                                class="text-[10px]"
                                            >
                                                {{ createAppointmentContextStatusLabel }}
                                            </Badge>
                                            <Badge
                                                v-if="
                                                    hasCreateAdmissionContext &&
                                                    createAdmissionContextStatusLabel
                                                "
                                                :variant="createAdmissionContextStatusVariant"
                                                class="text-[10px]"
                                            >
                                                {{ createAdmissionContextStatusLabel }}
                                            </Badge>
                                        </div>
                                        <div
                                            class="flex min-w-0 flex-wrap items-center gap-2"
                                        >
                                            <div
                                                class="flex min-w-0 items-center gap-2"
                                            >
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
                                                Patient No.
                                                {{ createPatientSummary?.patientNumber }}
                                            </Badge>
                                        </div>
                                        <p class="text-xs text-muted-foreground">
                                            {{ createOrderContextSummary }}
                                        </p>
                                    </div>
                                    <div
                                        class="flex flex-wrap gap-2 xl:justify-end"
                                    >
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
                                            v-if="createForm.appointmentId"
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
                                            v-if="createForm.admissionId"
                                            variant="outline"
                                            size="sm"
                                            as-child
                                        >
                                            <Link
                                                :href="
                                                    contextCreateHref(
                                                        '/admissions',
                                                    )
                                                "
                                            >
                                                Back to Admissions
                                            </Link>
                                        </Button>
                                        <Button
                                            id="lab-open-context-dialog"
                                            variant="outline"
                                            size="sm"
                                            class="gap-1.5"
                                            :disabled="
                                                hasCreateOrderBasketItems
                                            "
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
                                            <AppIcon
                                                name="sliders-horizontal"
                                                class="size-3.5"
                                            />
                                            {{ createContextActionLabel }}
                                        </Button>
                                    </div>
                                </div>
                                <div
                                    v-if="
                                        hasCreateAppointmentContext ||
                                        hasCreateAdmissionContext
                                    "
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
                        </div>
                        <div class="space-y-2">
                            <p
                                class="text-xs font-medium tracking-wider text-muted-foreground uppercase"
                            >
                                Order details
                            </p>
                            <div class="rounded-lg border bg-muted/20 p-3">
                                <div class="space-y-3">
                                    <div
                                        class="flex flex-col gap-2 rounded-lg border bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div class="min-w-0 space-y-1">
                                            <div
                                                class="flex flex-wrap items-center gap-2"
                                            >
                                                <Label for="lab-create-priority"
                                                    >Priority</Label
                                                >
                                                <Badge
                                                    :variant="
                                                        priorityVariant(
                                                            createForm.priority,
                                                        )
                                                    "
                                                    class="capitalize"
                                                >
                                                    {{
                                                        formatEnumLabel(
                                                            createForm.priority,
                                                        )
                                                    }}
                                                </Badge>
                                            </div>
                                            <p
                                                class="text-xs text-muted-foreground"
                                            >
                                                {{ createPriorityHelperText }}
                                            </p>
                                        </div>
                                        <div class="w-full sm:w-[220px]">
                                            <Select v-model="createForm.priority">
                                                <SelectTrigger
                                                    id="lab-create-priority"
                                                    class="w-full min-w-0 justify-between bg-background"
                                                >
                                                    <SelectValue
                                                        placeholder="Select priority"
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="routine"
                                                        >Routine</SelectItem
                                                    >
                                                    <SelectItem value="urgent"
                                                        >Urgent</SelectItem
                                                    >
                                                    <SelectItem value="stat"
                                                        >STAT</SelectItem
                                                    >
                                                </SelectContent>
                                            </Select>
                                            <p
                                                v-if="
                                                    createFieldError('priority')
                                                "
                                                class="mt-2 text-xs text-destructive"
                                            >
                                                {{
                                                    createFieldError('priority')
                                                }}
                                            </p>
                                        </div>
                                    </div>

                                    <div
                                        class="grid gap-3 lg:grid-cols-2 lg:items-stretch"
                                    >
                                        <div
                                            class="flex h-full flex-col rounded-lg border bg-background p-3"
                                        >
                                            <div class="flex h-full flex-col gap-3">
                                            <div
                                                class="flex flex-wrap items-start justify-between gap-2"
                                            >
                                                <div class="space-y-1">
                                                    <p class="text-sm font-medium">
                                                        Requested test
                                                    </p>
                                                    <p
                                                        class="text-xs text-muted-foreground"
                                                    >
                                                        Choose the governed lab
                                                        test for this order.
                                                    </p>
                                                </div>
                                                <Badge
                                                    v-if="labTestCatalogItems.length"
                                                    variant="outline"
                                                    class="text-[10px]"
                                                >
                                                    {{ labTestCatalogItems.length }}
                                                    active tests
                                                </Badge>
                                            </div>

                                            <SearchableSelectField
                                                input-id="lab-create-catalog-test"
                                                v-model="
                                                    createForm.labTestCatalogItemId
                                                "
                                                label="Laboratory test"
                                                :options="
                                                    createLabTestCatalogOptions
                                                "
                                                placeholder="Select a catalog lab test"
                                                search-placeholder="Search by test name, code, or category"
                                                :helper-text="
                                                    createLabTestCatalogHelperText
                                                "
                                                :error-message="
                                                    createLabTestPickerError
                                                "
                                                empty-text="No active laboratory test matched that search."
                                                :required="true"
                                                :disabled="
                                                    labTestCatalogLoading ||
                                                    !canReadLabTestCatalog
                                                "
                                            />

                                            <div
                                                v-if="labTestCatalogLoading"
                                                class="rounded-lg border bg-muted/20 p-3"
                                            >
                                                <div class="space-y-2">
                                                    <Skeleton class="h-4 w-28" />
                                                    <Skeleton class="h-9 w-full" />
                                                    <Skeleton class="h-4 w-3/4" />
                                                </div>
                                            </div>

                                            <Alert
                                                v-else-if="labTestCatalogError"
                                                variant="destructive"
                                                class="border-destructive/40 bg-destructive/5"
                                            >
                                                <AppIcon
                                                    name="triangle-alert"
                                                    class="size-4"
                                                />
                                                <AlertTitle
                                                    >Catalog lookup unavailable</AlertTitle
                                                >
                                                <AlertDescription
                                                    class="space-y-3"
                                                >
                                                    <p>{{ labTestCatalogError }}</p>
                                                    <div
                                                        class="flex flex-wrap items-center gap-2"
                                                    >
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            @click="
                                                                void loadLabTestCatalog(
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
                                                    isLabTestCatalogReadPermissionResolved &&
                                                    !canReadLabTestCatalog
                                                "
                                                class="alert-warning-surface py-2"
                                            >
                                                <AppIcon
                                                    name="shield-alert"
                                                    class="mt-0 size-3.5"
                                                />
                                                <AlertDescription
                                                    class="mt-0 flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap text-xs leading-none"
                                                >
                                                    <span class="font-medium text-foreground"
                                                        >Catalog access required.</span
                                                    >
                                                    <code
                                                        class="rounded bg-background/80 px-1.5 py-0.5 font-medium text-foreground"
                                                        >platform.clinical-catalog.read</code
                                                    >
                                                    <span>needed for this picker.</span>
                                                </AlertDescription>
                                            </Alert>

                                            <Alert
                                                v-else-if="
                                                    !labTestCatalogItems.length
                                                "
                                                class="border-border bg-muted/20"
                                            >
                                                <AppIcon
                                                    name="book-open-text"
                                                    class="size-4"
                                                />
                                                <AlertTitle
                                                    >No active lab tests found</AlertTitle
                                                >
                                                <AlertDescription
                                                    class="space-y-2"
                                                >
                                                    <p>
                                                        Add or reactivate
                                                        laboratory test catalog
                                                        items before creating
                                                        orders from this
                                                        workspace.
                                                    </p>
                                                    <Link
                                                        href="/platform/admin/clinical-catalogs"
                                                        class="text-xs font-medium text-foreground underline underline-offset-4"
                                                    >
                                                        Open Clinical Catalogs
                                                    </Link>
                                                </AlertDescription>
                                            </Alert>

                                            <div
                                                class="rounded-lg border bg-muted/20 px-3 py-2.5"
                                            >
                                                <div
                                                    class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                                                >
                                                    <div
                                                        class="min-w-0 space-y-0.5"
                                                    >
                                                        <p
                                                            class="truncate text-sm font-semibold"
                                                        >
                                                            {{
                                                                selectedCreateLabTestCatalogItem?.name ||
                                                                'No test selected yet'
                                                            }}
                                                        </p>
                                                        <p
                                                            class="text-xs text-muted-foreground"
                                                        >
                                                            {{
                                                                selectedCreateLabTestCatalogItem?.description ||
                                                                'Choose a test to load its governed code and specimen default.'
                                                            }}
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline">
                                                        {{
                                                            selectedCreateLabTestCatalogItem
                                                                ? 'Ready'
                                                                : 'Required'
                                                        }}
                                                    </Badge>
                                                </div>
                                                <div
                                                    class="mt-2 flex flex-wrap gap-1.5 text-xs"
                                                >
                                                    <Badge variant="secondary">
                                                        Code
                                                        {{
                                                            createForm.testCode ||
                                                            'Pending'
                                                        }}
                                                    </Badge>
                                                    <Badge
                                                        v-if="selectedCreateLabTestCatalogCategoryLabel"
                                                        variant="outline"
                                                    >
                                                        {{ selectedCreateLabTestCatalogCategoryLabel }}
                                                    </Badge>
                                                    <Badge
                                                        v-if="selectedCreateLabTestCatalogUnitLabel"
                                                        variant="outline"
                                                    >
                                                        {{ selectedCreateLabTestCatalogUnitLabel }}
                                                    </Badge>
                                                    <Badge
                                                        v-if="selectedCreateLabTestCatalogSpecimenType"
                                                        variant="outline"
                                                    >
                                                        Specimen
                                                        {{ selectedCreateLabTestCatalogSpecimenType }}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                        <div
                                            class="flex h-full flex-col rounded-lg border bg-background p-3"
                                        >
                                            <div class="flex h-full flex-col gap-3">
                                            <div class="space-y-3">
                                                <div class="grid min-w-0 gap-2">
                                                    <div
                                                        class="flex items-center justify-between gap-2"
                                                    >
                                                        <Label
                                                            for="lab-create-specimen-type"
                                                            >Specimen type</Label
                                                        >
                                                        <Button
                                                            v-if="
                                                                selectedCreateLabTestCatalogSpecimenType &&
                                                                !isCreateSpecimenUsingCatalogDefault
                                                            "
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            class="h-7 px-2 text-xs"
                                                            @click="applyCreateCatalogSpecimenDefault"
                                                        >
                                                            Use default
                                                        </Button>
                                                    </div>
                                                    <Input
                                                        id="lab-create-specimen-type"
                                                        v-model="
                                                            createForm.specimenType
                                                        "
                                                        placeholder="Blood, urine, stool, swab..."
                                                        class="w-full min-w-0"
                                                    />
                                                    <div
                                                        class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                                                    >
                                                        <Badge
                                                            v-if="isCreateSpecimenUsingCatalogDefault"
                                                            variant="secondary"
                                                            class="text-[10px]"
                                                        >
                                                            Synced from catalog
                                                        </Badge>
                                                        <span>{{
                                                            createSpecimenHelperText
                                                        }}</span>
                                                    </div>
                                                    <p
                                                        v-if="
                                                            createFieldError(
                                                                'specimenType',
                                                            )
                                                        "
                                                        class="text-xs text-destructive"
                                                    >
                                                        {{
                                                            createFieldError(
                                                                'specimenType',
                                                            )
                                                        }}
                                                    </p>
                                                </div>
                                                <div class="grid min-w-0 gap-2">
                                                    <Label
                                                        for="lab-create-clinical-notes"
                                                        >Clinical
                                                        indication</Label
                                                    >
                                                    <Textarea
                                                        id="lab-create-clinical-notes"
                                                        v-model="
                                                            createForm.clinicalNotes
                                                        "
                                                        placeholder="Reason for test, symptoms, urgency context, or treatment question..."
                                                        class="min-h-20 w-full"
                                                    />
                                                    <p
                                                        class="text-xs text-muted-foreground"
                                                    >
                                                        Add the main clinical
                                                        question, especially for
                                                        urgent or STAT orders.
                                                    </p>
                                                    <p
                                                        v-if="
                                                            createFieldError(
                                                                'clinicalNotes',
                                                            )
                                                        "
                                                        class="text-xs text-destructive"
                                                    >
                                                        {{
                                                            createFieldError(
                                                                'clinicalNotes',
                                                            )
                                                        }}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        v-if="!hasCreateLifecycleMode"
                                        class="rounded-lg border bg-muted/10 p-3 lg:col-span-2"
                                    >
                                        <div
                                            class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                                        >
                                            <div class="space-y-1">
                                                <div
                                                    class="flex flex-wrap items-center gap-2"
                                                >
                                                    <p
                                                        class="text-sm font-medium"
                                                    >
                                                        Order basket
                                                    </p>
                                                    <Badge
                                                        variant="secondary"
                                                        class="text-[10px]"
                                                    >
                                                        {{
                                                            createOrderBasketCountLabel
                                                        }}
                                                    </Badge>
                                                </div>
                                                <p
                                                    class="text-xs text-muted-foreground"
                                                >
                                                    Add several tests for the
                                                    same patient, then submit
                                                    them together.
                                                </p>
                                            </div>
                                            <Button
                                                v-if="hasCreateOrderBasketItems"
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                class="gap-1.5"
                                                :disabled="createLoading"
                                                @click="clearCreateOrderBasket"
                                            >
                                                <AppIcon
                                                    name="circle-x"
                                                    class="size-3.5"
                                                />
                                                Clear basket
                                            </Button>
                                        </div>

                                        <div
                                            v-if="hasCreateOrderBasketItems"
                                            class="mt-3 grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3"
                                        >
                                            <div
                                                v-for="item in createOrderBasket"
                                                :key="item.clientKey"
                                                class="flex h-full flex-col rounded-lg border bg-background p-2.5"
                                            >
                                                <div
                                                    class="flex h-full flex-col gap-2"
                                                >
                                                    <div
                                                        class="flex items-start justify-between gap-2"
                                                    >
                                                        <div
                                                            class="min-w-0 space-y-1"
                                                        >
                                                            <p
                                                                class="truncate text-sm font-medium leading-5 text-foreground"
                                                            >
                                                                {{
                                                                    item.testName ||
                                                                    item.testCode
                                                                }}
                                                            </p>
                                                            <div
                                                                class="flex flex-wrap gap-1 text-[11px]"
                                                            >
                                                                <Badge
                                                                    variant="secondary"
                                                                    class="px-1.5 py-0 text-[10px]"
                                                                >
                                                                    Code
                                                                    {{
                                                                        item.testCode ||
                                                                        'Pending'
                                                                    }}
                                                                </Badge>
                                                                <Badge
                                                                    v-if="
                                                                        item.specimenType
                                                                    "
                                                                    variant="outline"
                                                                    class="px-1.5 py-0 text-[10px]"
                                                                >
                                                                    Specimen
                                                                    {{
                                                                        item.specimenType
                                                                    }}
                                                                </Badge>
                                                                <Badge
                                                                    :variant="
                                                                        priorityVariant(
                                                                            item.priority,
                                                                        )
                                                                    "
                                                                    class="capitalize px-1.5 py-0 text-[10px]"
                                                                >
                                                                    {{
                                                                        formatEnumLabel(
                                                                            item.priority,
                                                                        )
                                                                    }}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            class="h-7 px-2 text-[11px]"
                                                            :disabled="
                                                                createLoading
                                                            "
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
                                                        v-if="
                                                            item.clinicalNotes
                                                        "
                                                        class="rounded-md bg-muted/40 px-2 py-1.5"
                                                    >
                                                        <p
                                                            class="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                                                        >
                                                            Clinical indication
                                                        </p>
                                                        <p
                                                            class="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground"
                                                        >
                                                            {{
                                                                item.clinicalNotes
                                                            }}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <p
                                            v-if="hasCreateLifecycleMode"
                                            class="mt-3 text-xs text-muted-foreground"
                                        >
                                            Replacement and linked follow-up laboratory orders are submitted one at a time, so basket mode is unavailable while this follow-up request is active.
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
                                            Basket is empty. Add one or more
                                            tests, then submit them together.
                                        </p>
                                    </div>
                                    </div>
                                </div>
                                <Separator class="mt-2" />

                                <div
                                    class="flex flex-wrap items-center justify-end gap-2 pt-1"
                                >
                                    <Button
                                        v-if="hasCreateFeedback"
                                        variant="outline"
                                        class="gap-1.5"
                                        :disabled="createLoading"
                                        @click="resetCreateMessages"
                                    >
                                        <AppIcon
                                            name="circle-x"
                                            class="size-3.5"
                                        />
                                        Dismiss alerts
                                    </Button>
                                    <Button
                                        v-if="showSaveCreateDraftAction"
                                        type="button"
                                        variant="outline"
                                        class="gap-1.5"
                                        :disabled="
                                            createLoading ||
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
                                        <AppIcon
                                            name="save"
                                            class="size-3.5"
                                        />
                                        {{ saveCreateDraftLabel }}
                                    </Button>
                                    <Button
                                        v-if="hasSavedCreateDraft"
                                        type="button"
                                        variant="outline"
                                        class="gap-1.5"
                                        :disabled="createLoading"
                                        @click="discardSavedCreateDraft"
                                    >
                                        <AppIcon
                                            name="trash"
                                            class="size-3.5"
                                        />
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
                                        <AppIcon
                                            name="plus"
                                            class="size-3.5"
                                        />
                                        {{
                                            hasCreateOrderBasketItems
                                                ? 'Add current test'
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
                                        :disabled="createLoading"
                                        @click="discardCurrentCreateOrderDraft"
                                    >
                                        <AppIcon
                                            name="circle-x"
                                            class="size-3.5"
                                        />
                                        Discard current draft
                                    </Button>
                                    <Button
                                        class="gap-1.5"
                                        :disabled="
                                            useSingleCreateOrderAction
                                                ? createOrderActionDisabled
                                                : submitCreateOrderBasketDisabled
                                        "
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
                            </div>
                        </div>
                    </div>
                    </CardContent>
                </Card>
            </div>

            <!-- Care workflow (footer bar, same as other pages) -->
            <div
                v-if="canReadLaboratoryOrders"
                class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-2.5"
            >
                <span
                    class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                >
                    <AppIcon name="activity" class="size-3.5" />
                    Related workflows
                </span>
                <Button size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="consultationContextHref"
                        ><AppIcon name="stethoscope" class="size-3.5" />{{
                            consultationWorkflowLabel
                        }}</Link
                    >
                </Button>
                <Button size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="contextCreateHref('/pharmacy-orders', { includeTabNew: true })"
                        ><AppIcon name="pill" class="size-3.5" />New Pharmacy
                        Order</Link
                    >
                </Button>
                <Button size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="contextCreateHref('/billing-invoices', { includeTabNew: true })"
                        ><AppIcon name="receipt" class="size-3.5" />New Billing
                        Invoice</Link
                    >
                </Button>
                <Button
                    v-if="canCreateTheatreProcedures"
                    size="sm"
                    variant="outline"
                    as-child
                    class="gap-1.5"
                >
                    <Link :href="contextCreateHref('/theatre-procedures', { includeTabNew: true })"
                        ><AppIcon name="scissors" class="size-3.5" />Schedule
                        Procedure</Link
                    >
                </Button>
            </div>

            <Sheet
                v-if="
                    canReadLaboratoryOrders &&
                    laboratoryWorkspaceView === 'queue'
                "
                :open="advancedFiltersSheetOpen"
                @update:open="advancedFiltersSheetOpen = $event"
            >
                <SheetContent
                    side="right"
                    variant="action"
                    size="lg"
                >
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon
                                name="sliders-horizontal"
                                class="size-4 text-muted-foreground"
                            />
                            All filters
                        </SheetTitle>
                        <SheetDescription>
                            Refine the queue by patient and ordered date without
                            mixing in view settings.
                        </SheetDescription>
                    </SheetHeader>

                    <div class="grid gap-4 px-4 py-4">
                        <div class="rounded-lg border p-3">
                            <PatientLookupField
                                input-id="lab-filter-patient-id-sheet"
                                v-model="advancedFiltersDraft.patientId"
                                label="Patient filter"
                                placeholder="Patient name or number"
                                :helper-text="patientChartQueueFocusLocked ? 'Patient scope is locked from the patient chart. Use Open Full Queue to review other patients.' : 'Optional exact patient filter.'"
                                :disabled="patientChartQueueFocusLocked"
                                mode="filter"
                            />
                        </div>

                        <div class="rounded-lg border p-3">
                            <DateRangeFilterPopover
                                inline
                                :number-of-months="1"
                                input-base-id="lab-ordered-date-range-sheet"
                                title="Ordered Date Range"
                                helper-text="Default starts from today. Add an end date to review previous orders."
                                from-label="From"
                                to-label="To"
                                v-model:from="advancedFiltersDraft.from"
                                v-model:to="advancedFiltersDraft.to"
                            />
                        </div>
                    </div>

                    <SheetFooter class="gap-2">
                        <Button
                            variant="outline"
                            :disabled="listLoading && !hasActiveFilters"
                            @click="resetFiltersFromFiltersSheet"
                        >
                            Reset all
                        </Button>
                        <Button
                            class="gap-1.5"
                            :disabled="listLoading"
                            @click="submitSearchFromFiltersSheet"
                        >
                            <AppIcon name="search" class="size-3.5" />
                            Apply filters
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Sheet
                :open="detailsSheetOpen"
                @update:open="(open) => (open ? (detailsSheetOpen = true) : closeOrderDetailsSheet())"
            >
                <SheetContent
                    side="right"
                    variant="workspace"
                >
                    <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                        <div class="flex items-start gap-3">
                            <div class="min-w-0 space-y-1">
                                <p class="text-[11px] font-medium text-muted-foreground">
                                    {{ detailsSheetOrder?.orderNumber || 'Laboratory order' }}
                                </p>
                                <SheetTitle class="text-base leading-tight">
                                    {{ detailsSheetOrder?.testName || detailsSheetOrder?.testCode || 'Laboratory Order Details' }}
                                </SheetTitle>
                                <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    <Badge v-if="detailsSheetOrder?.status" :variant="statusVariant(detailsSheetOrder.status)" class="text-[11px]">
                                        {{ formatEnumLabel(detailsSheetOrder.status) }}
                                    </Badge>
                                    <Badge v-if="detailsSheetOrder?.priority" :variant="priorityVariant(detailsSheetOrder.priority)" class="text-[11px]">
                                        {{ formatEnumLabel(detailsSheetOrder.priority) }}
                                    </Badge>
                                    <span v-if="detailsSheetOrder" class="text-[11px] text-muted-foreground">
                                        {{ orderPatientLabel(detailsSheetOrder) }}<template v-if="detailsSheetOrder.orderedAt"> · {{ formatDateTime(detailsSheetOrder.orderedAt) }}</template>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </SheetHeader>

                    <ScrollArea v-if="detailsSheetOrder" class="min-h-0 flex-1">
                        <Tabs v-model="detailsSheetTab" class="space-y-4 p-4">
                            <div class="overflow-x-auto">
                                <TabsList class="!inline-flex !h-auto min-h-9 flex-nowrap gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
                                    <TabsTrigger value="overview" class="!h-8 shrink-0 px-3">Overview</TabsTrigger>
                                    <TabsTrigger value="journey" class="!h-8 shrink-0 px-3">Journey</TabsTrigger>
                                    <TabsTrigger value="audit" class="!h-8 shrink-0 px-3">
                                        Audit
                                        <Badge v-if="canViewLaboratoryOrderAuditLogs" variant="secondary" class="ml-1 h-4 min-w-4 px-1 text-[10px]">
                                            {{ detailsSheetAuditCount }}
                                        </Badge>
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="overview" class="mt-0 space-y-4">
                            <div class="rounded-lg border p-3">
                                <div class="grid gap-2 text-sm sm:grid-cols-2">
                                    <p><span class="text-muted-foreground">Patient:</span> <span class="font-medium text-foreground">{{ orderPatientLabel(detailsSheetOrder) }}</span></p>
                                    <p><span class="text-muted-foreground">Ordered:</span> <span class="font-medium text-foreground">{{ formatDateTime(detailsSheetOrder.orderedAt) }}</span></p>
                                    <p><span class="text-muted-foreground">Test:</span> <span class="font-medium text-foreground">{{ detailsSheetOrder.testCode || 'N/A' }} - {{ detailsSheetOrder.testName || 'N/A' }}</span></p>
                                    <p><span class="text-muted-foreground">Specimen:</span> <span class="font-medium text-foreground">{{ detailsSheetOrder.specimenType || 'N/A' }}</span></p>
                                    <p><span class="text-muted-foreground">Resulted:</span> <span class="font-medium text-foreground">{{ formatDateTime(detailsSheetOrder.resultedAt) }}</span></p>
                                    <p><span class="text-muted-foreground">Verified:</span> <span class="font-medium text-foreground">{{ formatDateTime(detailsSheetOrder.verifiedAt) }}</span></p>
                                </div>
                                <p v-if="detailsSheetOrder.resultSummary" class="mt-3 rounded-md border bg-muted/40 p-2 text-xs whitespace-pre-wrap">{{ detailsSheetOrder.resultSummary }}</p>
                                <p v-if="detailsSheetOrder.verificationNote" class="mt-2 text-xs text-muted-foreground">Verification note: {{ detailsSheetOrder.verificationNote }}</p>
                                <Alert v-if="detailsSheetResultReleased && canOpenLaboratoryClinicalFollowup(detailsSheetOrder)" class="mt-3">
                                    <AlertTitle>Released for clinical follow-up</AlertTitle>
                                    <AlertDescription>
                                        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <p class="text-xs">
                                                {{ laboratoryOrderClinicalFollowupDescription(detailsSheetOrder) }}
                                            </p>
                                            <Button as-child size="sm" class="gap-1.5">
                                                <Link :href="laboratoryOrderClinicalFollowupHref(detailsSheetOrder)">
                                                    {{ laboratoryOrderClinicalFollowupLabel(detailsSheetOrder) }}
                                                </Link>
                                            </Button>
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            </div>

                            <div class="rounded-lg border p-3">
                                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div class="space-y-1">
                                        <p class="text-sm font-medium">{{ detailsSheetWorkflowHeading }}</p>
                                        <p class="text-xs text-muted-foreground">{{ detailsSheetWorkflowDescription }}</p>
                                    </div>
                                    <Button
                                        v-if="detailsSheetNextWorkflowAction && canExecuteLaboratoryWorkflowAction(detailsSheetNextWorkflowAction.action)"
                                        size="sm"
                                        class="gap-1.5"
                                        @click="openOrderStatusDialog(detailsSheetOrder, detailsSheetNextWorkflowAction.action)"
                                    >
                                        <AppIcon name="play" class="size-3.5" />
                                        {{ detailsSheetNextWorkflowAction.label }}
                                    </Button>
                                </div>
                                <Alert v-if="detailsSheetCriticalEscalation" class="mt-3" :variant="detailsSheetCriticalEscalation.tone === 'critical' ? 'destructive' : 'default'">
                                    <AlertTitle>{{ detailsSheetCriticalEscalation.title }}</AlertTitle>
                                    <AlertDescription>{{ detailsSheetCriticalEscalation.description }}</AlertDescription>
                                </Alert>
                                <dl class="mt-3 divide-y">
                                    <div v-for="signal in detailsSheetWorkflowSignals" :key="signal.label" class="flex items-start justify-between gap-3 py-2 first:pt-1 last:pb-0">
                                        <div class="min-w-0">
                                            <dt class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ signal.label }}</dt>
                                            <dd v-if="signal.note" class="mt-0.5 text-[11px] text-muted-foreground">{{ signal.note }}</dd>
                                        </div>
                                        <Badge :variant="signal.variant" class="shrink-0 text-[11px]">{{ signal.value }}</Badge>
                                    </div>
                                </dl>
                            </div>

                            <div
                                v-if="
                                    canCreateLaboratoryFollowOnOrder(detailsSheetOrder)
                                    || canApplyLaboratoryLifecycleAction(detailsSheetOrder, 'cancel')
                                    || canApplyLaboratoryLifecycleAction(detailsSheetOrder, 'entered_in_error')
                                "
                                class="rounded-lg border p-3"
                            >
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Clinical lifecycle</p>
                                    <p class="text-xs text-muted-foreground">
                                        Reorder, add a linked follow-up test, or stop this request without editing the original clinical record.
                                    </p>
                                </div>
                                <div class="mt-3 flex flex-wrap gap-2">
                                    <Button
                                        v-if="canCreateLaboratoryFollowOnOrder(detailsSheetOrder)"
                                        size="sm"
                                        variant="outline"
                                        as-child
                                        class="gap-1.5"
                                    >
                                        <Link
                                            :href="
                                                orderDetailsWorkflowHref('/laboratory-orders', detailsSheetOrder, {
                                                    includeTabNew: true,
                                                    reorderOfId: detailsSheetOrder.id,
                                                })
                                            "
                                        >
                                            <AppIcon name="rotate-cw" class="size-3.5" />
                                            Reorder
                                        </Link>
                                    </Button>
                                    <Button
                                        v-if="canCreateLaboratoryFollowOnOrder(detailsSheetOrder)"
                                        size="sm"
                                        variant="outline"
                                        as-child
                                        class="gap-1.5"
                                    >
                                        <Link
                                            :href="
                                                orderDetailsWorkflowHref('/laboratory-orders', detailsSheetOrder, {
                                                    includeTabNew: true,
                                                    addOnToOrderId: detailsSheetOrder.id,
                                                })
                                            "
                                        >
                                            <AppIcon name="plus" class="size-3.5" />
                                            Add Linked Test
                                        </Link>
                                    </Button>
                                    <Button
                                        v-if="canApplyLaboratoryLifecycleAction(detailsSheetOrder, 'cancel')"
                                        size="sm"
                                        variant="outline"
                                        class="gap-1.5"
                                        :disabled="actionLoadingId === detailsSheetOrder.id"
                                        @click="openLaboratoryLifecycleDialog(detailsSheetOrder, 'cancel')"
                                    >
                                        <AppIcon name="circle-slash-2" class="size-3.5" />
                                        Cancel Order
                                    </Button>
                                    <Button
                                        v-if="canApplyLaboratoryLifecycleAction(detailsSheetOrder, 'entered_in_error')"
                                        size="sm"
                                        variant="destructive"
                                        class="gap-1.5"
                                        :disabled="actionLoadingId === detailsSheetOrder.id"
                                        @click="openLaboratoryLifecycleDialog(detailsSheetOrder, 'entered_in_error')"
                                    >
                                        <AppIcon name="triangle-alert" class="size-3.5" />
                                        Entered in Error
                                    </Button>
                                </div>
                            </div>

                            </TabsContent>

                            <TabsContent value="journey" class="mt-0 space-y-4">
                            <div>
                                <div class="flex items-center justify-between gap-3 pb-3">
                                    <p class="text-sm font-medium">Specimen journey</p>
                                    <Button variant="outline" size="sm" class="gap-1.5" :disabled="detailsSheetTrendLoading" @click="loadDetailsTrendOrders(detailsSheetOrder)">
                                        <AppIcon name="refresh-cw" class="size-3.5" />
                                        {{ detailsSheetTrendLoading ? 'Refreshing...' : 'Refresh' }}
                                    </Button>
                                </div>
                                <Alert v-if="detailsSheetTrendError" class="mb-3" variant="destructive">
                                    <AlertTitle>Journey unavailable</AlertTitle>
                                    <AlertDescription>{{ detailsSheetTrendError }}</AlertDescription>
                                </Alert>
                                <ol class="relative ml-3.5 border-l border-border">
                                    <li
                                        v-for="(event, eventIndex) in detailsSheetJourneyEvents"
                                        :key="event.id"
                                        class="pb-6 pl-6 last:pb-0"
                                    >
                                        <!-- Marker dot -->
                                        <span
                                            class="absolute -left-3 flex size-6 items-center justify-center rounded-full ring-4 ring-background"
                                            :class="journeyEventMarkerClass(event)"
                                        >
                                            <AppIcon
                                                v-if="event.state === 'done' && event.id !== 'cancelled'"
                                                name="check"
                                                class="size-3"
                                            />
                                            <AppIcon
                                                v-else-if="event.id === 'cancelled'"
                                                name="x"
                                                class="size-3"
                                            />
                                            <span v-else class="text-[10px] font-semibold">{{ eventIndex + 1 }}</span>
                                        </span>
                                        <!-- Content -->
                                        <div class="flex flex-col gap-1">
                                            <div class="flex flex-wrap items-center gap-2">
                                                <p class="text-sm font-medium leading-none">{{ event.title }}</p>
                                                <Badge :variant="journeyEventVariant(event)" class="text-[10px]">{{ journeyEventStateLabel(event) }}</Badge>
                                                <Badge v-if="event.tone === 'critical'" variant="destructive" class="text-[10px]">Critical</Badge>
                                            </div>
                                            <p class="text-xs text-muted-foreground">{{ event.description }}</p>
                                            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                <p v-if="event.occurredAt" class="text-[11px] text-muted-foreground">{{ formatDateTime(event.occurredAt) }}</p>
                                                <p v-if="event.note" class="text-[11px] text-muted-foreground">{{ event.note }}</p>
                                            </div>
                                        </div>
                                    </li>
                                </ol>
                            </div>

                            </TabsContent>

                            <TabsContent value="audit" class="mt-0 space-y-4">
                            <div class="space-y-3">
                                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p class="text-sm font-medium">Audit trail</p>
                                        <p class="text-xs text-muted-foreground">Lifecycle events recorded for this order.</p>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <Badge v-if="canViewLaboratoryOrderAuditLogs" variant="outline">{{ detailsSheetAuditCount }} entries</Badge>
                                        <Badge v-else variant="secondary">Audit Restricted</Badge>
                                        <Button v-if="canViewLaboratoryOrderAuditLogs" type="button" size="sm" variant="outline" class="gap-1.5" :disabled="detailsSheetAuditLogsLoading" @click="detailsSheetOrder && loadOrderAuditLogs(detailsSheetOrder.id)">
                                            <AppIcon name="refresh-cw" class="size-3.5" />
                                            {{ detailsSheetAuditLogsLoading ? 'Refreshing...' : 'Refresh' }}
                                        </Button>
                                    </div>
                                </div>
                                <Alert v-if="!canViewLaboratoryOrderAuditLogs">
                                    <AlertTitle>Audit trail restricted</AlertTitle>
                                    <AlertDescription>You do not have permission to view laboratory order audit logs.</AlertDescription>
                                </Alert>
                                <Alert v-else-if="detailsSheetAuditLogsError" variant="destructive">
                                    <AlertTitle>Audit unavailable</AlertTitle>
                                    <AlertDescription>{{ detailsSheetAuditLogsError }}</AlertDescription>
                                </Alert>
                                <div v-else-if="detailsSheetAuditLogs.length === 0" class="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No audit entries loaded for this order yet.</div>
                                <div v-else class="space-y-2">
                                    <div v-for="log in detailsSheetAuditLogs" :key="log.id" class="rounded-md border bg-background px-3 py-2.5">
                                        <div class="flex flex-col gap-1.5">
                                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div class="flex min-w-0 flex-wrap items-center gap-2">
                                                    <p class="text-sm font-medium">{{ auditLogActionLabel(log) }}</p>
                                                    <Badge variant="outline">{{ auditLogActorLabel(log) }}</Badge>
                                                    <Badge v-if="auditLogStatusBadgeLabel(log)" :variant="auditLogStatusBadgeVariant(log)">{{ auditLogStatusBadgeLabel(log) }}</Badge>
                                                </div>
                                                <p class="shrink-0 text-[11px] text-muted-foreground">{{ formatDateTime(log.createdAt) }}</p>
                                            </div>
                                            <p class="text-xs text-muted-foreground">{{ auditLogSummary(log) }}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div v-if="showLaboratoryDownstreamHandoff" class="rounded-lg border p-3">
                                <div class="mb-3">
                                    <p class="text-sm font-medium">Downstream handoff</p>
                                    <p class="text-xs text-muted-foreground">Move this order into follow-up workflows.</p>
                                </div>
                                <Alert v-if="detailsSheetDownstreamState" class="mb-3" :variant="detailsSheetDownstreamState.variant === 'destructive' ? 'destructive' : 'default'">
                                    <AlertTitle>{{ detailsSheetDownstreamState.title }}</AlertTitle>
                                    <AlertDescription>{{ detailsSheetDownstreamState.description }}</AlertDescription>
                                </Alert>
                                <div class="divide-y">
                                    <div v-for="action in detailsSheetDownstreamActions" :key="action.id" class="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                                        <AppIcon :name="action.icon" class="size-3.5 shrink-0 text-muted-foreground" />
                                        <p class="min-w-0 flex-1 text-sm font-medium">{{ action.label }}</p>
                                        <Badge :variant="action.readiness === 'ready' ? 'secondary' : 'outline'" class="shrink-0 text-[11px]">
                                            {{ action.readiness === 'ready' ? 'Ready' : action.readiness === 'after_release' ? 'After release' : 'Reference' }}
                                        </Badge>
                                        <Button
                                            v-if="action.readiness === 'after_release' && detailsSheetOrder && detailsSheetNextWorkflowAction && canExecuteLaboratoryWorkflowAction(detailsSheetNextWorkflowAction.action)"
                                            size="sm"
                                            class="shrink-0 gap-1.5"
                                            @click="openOrderStatusDialog(detailsSheetOrder, detailsSheetNextWorkflowAction.action)"
                                        >
                                            <span>{{ detailsSheetBlockedDownstreamButtonLabel }}</span>
                                            <AppIcon name="chevron-right" class="size-3.5" />
                                        </Button>
                                        <Button v-else as-child variant="outline" size="sm" class="shrink-0 gap-1.5">
                                            <Link :href="action.href">
                                                <span>{{ action.buttonLabel }}</span>
                                                <AppIcon name="arrow-right" class="size-3.5" />
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            </TabsContent>
                        </Tabs>
                    </ScrollArea>
                    <div v-else class="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">No laboratory order selected.</div>

                    <SheetFooter class="shrink-0 flex-row items-center justify-between border-t px-4 py-3">
                        <Button variant="ghost" size="sm" @click="closeOrderDetailsSheet">Close</Button>
                        <Button v-if="detailsSheetOrder?.patientId" size="sm" as-child>
                            <Link :href="patientChartHref(detailsSheetOrder.patientId, { labOrderId: detailsSheetOrder.id, from: 'laboratory-orders' })">
                                Open patient chart
                            </Link>
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <ClinicalLifecycleActionDialog
                :open="lifecycleDialogOpen"
                :action="lifecycleDialogAction"
                :order-label="lifecycleDialogOrder?.orderNumber || lifecycleDialogOrder?.testName || 'Laboratory order'"
                subject-label="laboratory order"
                :reason="lifecycleDialogReason"
                :loading="actionLoadingId === lifecycleDialogOrder?.id"
                :error="lifecycleDialogError"
                @update:open="(open) => (open ? (lifecycleDialogOpen = true) : closeLaboratoryLifecycleDialog())"
                @update:reason="lifecycleDialogReason = $event"
                @submit="submitLaboratoryLifecycleDialog"
            />

            <Dialog :open="createContextDialogOpen" @update:open="createContextDialogOpen = $event">
                <DialogContent variant="form" size="4xl" class="overflow-visible">
                    <DialogHeader class="border-b px-6 py-4">
                        <DialogTitle class="flex items-center gap-2">
                            <AppIcon name="search" class="size-4 text-muted-foreground" />
                            Review or change context
                        </DialogTitle>
                        <DialogDescription>Select the patient and linked visit context for this laboratory order.</DialogDescription>
                    </DialogHeader>

                    <div class="max-h-[calc(90vh-6rem)] space-y-4 overflow-y-auto px-6 py-4">
                        <div class="flex flex-wrap gap-2">
                            <Button v-if="createPatientContextLocked" type="button" variant="outline" size="sm" class="gap-1.5" @click="unlockCreatePatientContext()">Unlock patient</Button>
                            <Button v-if="!createPatientContextLocked && (createForm.appointmentId || createForm.admissionId)" type="button" variant="outline" size="sm" class="gap-1.5" @click="clearCreateClinicalLinks">Unlink clinical context</Button>
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
                                    input-id="lab-create-patient-id"
                                    v-model="createForm.patientId"
                                    label="Patient"
                                    placeholder="Search patient by name, patient number, phone, email, or national ID"
                                    :helper-text="createPatientContextLocked ? 'Patient is locked from the clinical handoff. Use Unlock patient to change it.' : 'Select the patient for this laboratory order.'"
                                    :error-message="createFieldError('patientId')"
                                    patient-status="active"
                                    :disabled="createPatientContextLocked"
                                    @selected="closeCreateContextDialogAfterSelection('patientId', $event)"
                                />
                            </div>
                            <div v-show="createContextEditorTab === 'appointment'" class="grid gap-3">
                                <LinkedContextLookupField
                                    input-id="lab-create-appointment-id"
                                    v-model="createForm.appointmentId"
                                    :patient-id="createForm.patientId"
                                    label="Appointment Link"
                                    resource="appointments"
                                    placeholder="Search linked appointment by number or department"
                                    helper-text="Optional. Link the checked-in appointment that led to this laboratory order."
                                    :error-message="createFieldError('appointmentId')"
                                    :disabled="createPatientContextLocked"
                                    status="checked_in"
                                    @selected="closeCreateContextDialogAfterSelection('appointmentId', $event)"
                                />
                            </div>
                            <div v-show="createContextEditorTab === 'admission'" class="grid gap-3">
                                <LinkedContextLookupField
                                    input-id="lab-create-admission-id"
                                    v-model="createForm.admissionId"
                                    :patient-id="createForm.patientId"
                                    label="Admission Link"
                                    resource="admissions"
                                    placeholder="Search linked admission by number or ward"
                                    helper-text="Optional. Link an admission when this laboratory order belongs to an inpatient stay."
                                    :error-message="createFieldError('admissionId')"
                                    :disabled="createPatientContextLocked"
                                    @selected="closeCreateContextDialogAfterSelection('admissionId', $event)"
                                />
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

<Dialog
                :open="statusDialogOpen"
                @update:open="
                    (open) =>
                        open
                            ? (statusDialogOpen = true)
                            : closeOrderStatusDialog()
                "
            >
                <DialogContent variant="workspace" size="3xl">
                    <DialogHeader class="shrink-0 border-b px-6 py-4">
                        <DialogTitle>{{ statusDialogTitle }}</DialogTitle>
                        <DialogDescription>{{
                            statusDialogDescription
                        }}</DialogDescription>
                        <p v-if="statusDialogOrder" class="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                            <Badge variant="outline" class="text-[11px]">{{ statusDialogOrder.orderNumber || 'Lab order' }}</Badge>
                            <span>{{ statusDialogOrder.testName || statusDialogOrder.testCode || '' }}</span>
                            <span v-if="statusDialogOrder.patientId">· {{ orderPatientLabel(statusDialogOrder) }}</span>
                        </p>
                    </DialogHeader>

                    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    <div class="space-y-4">
                        <Tabs v-model="statusDialogTab" class="space-y-4">
                            <div class="overflow-x-auto">
                                <TabsList class="!inline-flex !h-auto min-h-9 flex-nowrap gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
                                    <TabsTrigger value="overview" class="!h-8 shrink-0 px-3">Overview</TabsTrigger>
                                    <TabsTrigger v-if="statusDialogNeedsResultSummary" value="results" class="!h-8 shrink-0 px-3">Result Entry</TabsTrigger>
                                    <TabsTrigger v-if="statusDialogNeedsVerificationNote" value="verification" class="!h-8 shrink-0 px-3">Verification</TabsTrigger>
                                </TabsList>
                            </div>

                            <Alert
                                v-if="statusDialogAction === 'completed' && statusDialogStockCheckLoading"
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
                                v-else-if="statusDialogAction === 'completed' && statusDialogStockCheckError"
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

                            <TabsContent value="overview" class="mt-0 space-y-4">
                        <dl v-if="statusDialogOrder" class="divide-y rounded-lg border">
                            <div class="flex items-center justify-between gap-3 px-3 py-2">
                                <dt class="text-xs text-muted-foreground">Order</dt>
                                <dd class="text-right text-xs font-medium text-foreground">{{ statusDialogOrder.orderNumber || 'Laboratory Order' }}</dd>
                            </div>
                            <div class="flex items-center justify-between gap-3 px-3 py-2">
                                <dt class="text-xs text-muted-foreground">Test</dt>
                                <dd class="text-right text-xs font-medium text-foreground">{{ statusDialogOrder.testCode || 'N/A' }} - {{ statusDialogOrder.testName || 'N/A' }}</dd>
                            </div>
                            <div class="flex items-center justify-between gap-3 px-3 py-2">
                                <dt class="text-xs text-muted-foreground">Specimen</dt>
                                <dd class="text-right text-xs font-medium text-foreground">{{ statusDialogOrder.specimenType || 'N/A' }}</dd>
                            </div>
                            <div class="flex items-center justify-between gap-3 px-3 py-2">
                                <dt class="text-xs text-muted-foreground">Resulted</dt>
                                <dd class="text-right text-xs font-medium text-foreground">{{ formatDateTime(statusDialogOrder.resultedAt) }}</dd>
                            </div>
                            <div class="flex items-center justify-between gap-3 px-3 py-2">
                                <dt class="text-xs text-muted-foreground">Verified</dt>
                                <dd class="text-right text-xs font-medium text-foreground">{{ formatDateTime(statusDialogOrder.verifiedAt) }}</dd>
                            </div>
                        </dl>

                        <div v-if="statusDialogNeedsReason" class="grid gap-2">
                            <Label for="lab-status-reason">Cancellation reason</Label>
                            <Textarea
                                id="lab-status-reason"
                                v-model="statusDialogReason"
                                class="min-h-24"
                                placeholder="Required cancellation reason"
                            />
                        </div>
                            </TabsContent>

                        <TabsContent
                            v-if="statusDialogNeedsResultSummary"
                            value="results"
                            class="mt-0 space-y-4"
                        >
                            <div class="grid gap-3 sm:grid-cols-2">
                                <div class="grid gap-2">
                                    <Label for="lab-status-result-value">Measured result</Label>
                                    <Input
                                        id="lab-status-result-value"
                                        v-model="statusDialogResultValue"
                                        placeholder="e.g. Non-reactive or 6.2"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="lab-status-result-unit">Unit</Label>
                                    <Input
                                        id="lab-status-result-unit"
                                        v-model="statusDialogResultUnit"
                                        placeholder="Optional unit"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="lab-status-result-flag">Result flag</Label>
                                    <Input
                                        id="lab-status-result-flag"
                                        v-model="statusDialogResultFlag"
                                        placeholder="Normal, Abnormal, Critical"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="lab-status-reference-range">Reference range</Label>
                                    <Input
                                        id="lab-status-reference-range"
                                        v-model="statusDialogReferenceRange"
                                        placeholder="Optional reference range"
                                    />
                                </div>
                            </div>

                            <div class="grid gap-3 sm:grid-cols-2">
                                <div class="grid gap-2">
                                    <Label for="lab-status-interpretation">Interpretation</Label>
                                    <Textarea
                                        id="lab-status-interpretation"
                                        v-model="statusDialogInterpretation"
                                        class="min-h-20"
                                        placeholder="Optional interpretation"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="lab-status-recommendation">Recommendation</Label>
                                    <Textarea
                                        id="lab-status-recommendation"
                                        v-model="statusDialogRecommendation"
                                        class="min-h-20"
                                        placeholder="Optional recommendation or follow-up"
                                    />
                                </div>
                            </div>

                            <div class="flex items-center gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger as-child>
                                        <Button type="button" variant="outline" size="sm" class="gap-1.5">
                                            <AppIcon name="sparkles" class="size-3.5" />
                                            Generate summary
                                            <AppIcon name="chevron-down" class="size-3" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" class="w-48">
                                        <DropdownMenuItem @select.prevent="applyStructuredLabResultToSummary('replace')">
                                            Replace summary
                                        </DropdownMenuItem>
                                        <DropdownMenuItem @select.prevent="applyStructuredLabResultToSummary('append')">
                                            Append to summary
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div class="grid gap-2">
                                <div class="flex items-center justify-between gap-2">
                                    <Label for="lab-status-result-summary">Result summary</Label>
                                    <span class="text-[11px] text-muted-foreground">Required to complete order</span>
                                </div>
                                <p
                                    v-if="structuredLabResultPreview"
                                    class="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap"
                                >
                                    {{ structuredLabResultPreview }}
                                </p>
                                <Textarea
                                    id="lab-status-result-summary"
                                    v-model="statusDialogResultSummary"
                                    class="min-h-32"
                                    placeholder="Enter or generate the final laboratory result summary"
                                />
                            </div>
                        </TabsContent>

                        <TabsContent
                            v-if="statusDialogNeedsVerificationNote"
                            value="verification"
                            class="mt-0 space-y-4"
                        >
                        <Alert
                            v-if="statusDialogCriticalVerificationNoteRequired"
                            variant="destructive"
                        >
                            <AlertTitle>Critical result verification</AlertTitle>
                            <AlertDescription>Verification note is required before releasing a critical result.</AlertDescription>
                        </Alert>
                        <div v-if="statusDialogCriticalVerificationNoteRequired" class="space-y-2">
                            <p class="text-xs font-medium text-foreground">Release checklist</p>
                            <div
                                v-for="item in statusDialogCriticalReleaseChecklist"
                                :key="item"
                                class="flex items-start gap-2 text-xs text-muted-foreground"
                            >
                                <AppIcon name="circle-check" class="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
                                <span>{{ item }}</span>
                            </div>
                        </div>
                        <div class="grid gap-2">
                            <Label for="lab-status-verification-note">
                                {{ statusDialogCriticalVerificationNoteRequired ? 'Verification note (required)' : 'Verification note (optional)' }}
                            </Label>
                            <Textarea
                                id="lab-status-verification-note"
                                v-model="statusDialogVerificationNote"
                                class="min-h-24"
                                placeholder="Reviewer comments, release note, or verification remarks"
                            />
                            <p class="text-xs text-muted-foreground">
                                Verification records reviewer release for downstream handoff.
                            </p>
                        </div>
                        </TabsContent>

                        </Tabs>

                        <Alert v-if="statusDialogError" variant="destructive">
                            <AlertTitle>Action validation</AlertTitle>
                            <AlertDescription>{{
                                statusDialogError
                            }}</AlertDescription>
                        </Alert>
                    </div>
                    </div>

                    <DialogFooter class="shrink-0 border-t bg-background px-6 py-4">
                        <Button
                            variant="outline"
                            :disabled="Boolean(actionLoadingId)"
                            @click="closeOrderStatusDialog"
                        >
                            Cancel
                        </Button>
                        <Button
                            :variant="statusDialogAction === 'cancelled' ? 'destructive' : 'default'"
                            class="gap-1.5"
                            :disabled="Boolean(actionLoadingId) || statusDialogStockCheckLoading"
                            @click="submitOrderStatusDialog"
                        >
                            <AppIcon
                                v-if="!actionLoadingId"
                                :name="statusDialogAction === 'collected' ? 'test-tube' : statusDialogAction === 'in_progress' ? 'activity' : statusDialogAction === 'completed' ? 'circle-check' : statusDialogAction === 'verify' ? 'shield-check' : 'circle-slash-2'"
                                class="size-3.5"
                            />
                            {{
                                actionLoadingId
                                    ? 'Updating...'
                                    : statusDialogStockCheckLoading
                                      ? 'Checking stock...'
                                    : statusDialogAction === 'collected'
                                      ? 'Mark Collected'
                                      : statusDialogAction === 'in_progress'
                                        ? 'Start Processing'
                                        : statusDialogAction === 'completed'
                                          ? 'Complete Order'
                                          : statusDialogAction === 'verify'
                                            ? statusDialogCriticalVerificationNoteRequired
                                                ? 'Verify Critical Result'
                                                : 'Verify + Release'
                                            : 'Cancel Order'
                            }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
            <LeaveWorkflowDialog
                :open="createLeaveConfirmOpen"
                :title="LABORATORY_CREATE_LEAVE_TITLE"
                :description="LABORATORY_CREATE_LEAVE_DESCRIPTION"
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


















<style scoped>
.alert-critical-surface {
  border-color: color-mix(in srgb, var(--color-destructive) 28%, transparent);
  background-color: color-mix(in srgb, var(--color-destructive) 8%, var(--color-card));
}

.alert-warning-surface {
  border-color: color-mix(in srgb, var(--color-warning) 28%, transparent);
  background-color: color-mix(in srgb, var(--color-warning) 8%, var(--color-card));
}

.alert-info-surface {
  border-color: color-mix(in srgb, var(--color-info) 24%, transparent);
  background-color: color-mix(in srgb, var(--color-info) 8%, var(--color-card));
}

.alert-warning-text {
  color: var(--color-warning);
}

.alert-info-text {
  color: var(--color-info);
}

.alert-success-surface {
  border-color: color-mix(in srgb, var(--color-success) 28%, transparent);
  background-color: color-mix(in srgb, var(--color-success) 8%, var(--color-card));
}

.alert-success-text {
  color: var(--color-success);
}

.alert-success-border {
  border-color: color-mix(in srgb, var(--color-success) 28%, transparent);
}

.alert-warning-border {
  border-color: color-mix(in srgb, var(--color-warning) 28%, transparent);
}

.alert-info-border {
  border-color: color-mix(in srgb, var(--color-info) 24%, transparent);
}
</style>
