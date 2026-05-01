<script setup lang='ts'>
import { Head, Link, usePage } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AdmissionLookupField from '@/components/admissions/AdmissionLookupField.vue';
import AppIcon from '@/components/AppIcon.vue';
import AuditTimelineList from '@/components/audit/AuditTimelineList.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { type BreadcrumbItem } from '@/types';

type WorkspaceView = 'queue' | 'board' | 'documentation';
type BoardTab = 'shift' | 'discharge';
type DocumentationFlow = 'task' | 'round_note' | 'care_plan' | 'discharge_checklist';
type ValidationErrorResponse = {
    message?: string;
    errors?: Record<string, string[]>;
};
type ApiError = Error & {
    status?: number;
    payload?: ValidationErrorResponse;
};
type ApiListMeta = {
    currentPage?: number;
    perPage?: number;
    total?: number;
    lastPage?: number;
};
type ApiListResponse<T> = {
    data: T[];
    meta?: ApiListMeta;
};
type CountBucket = { total: number; other: number; [key: string]: number };
type CensusRow = {
    id: string;
    admissionNumber?: string | null;
    patientId?: string | null;
    patientNumber?: string | null;
    patientName?: string | null;
    ward?: string | null;
    bed?: string | null;
    admittedAt?: string | null;
    admissionReason?: string | null;
    status?: string | null;
};
type WardBedResource = {
    id: string;
    code?: string | null;
    name?: string | null;
    wardName?: string | null;
    bedNumber?: string | null;
    location?: string | null;
    status?: string | null;
};
type WardTask = {
    id: string;
    taskNumber?: string | null;
    admissionId?: string | null;
    patientId?: string | null;
    taskType?: string | null;
    title?: string | null;
    priority?: string | null;
    status?: string | null;
    statusReason?: string | null;
    assignedToUserId?: number | null;
    dueAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    escalatedAt?: string | null;
    notes?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};
type RoundNote = {
    id: string;
    admissionId?: string | null;
    patientId?: string | null;
    authorUserId?: number | null;
    roundedAt?: string | null;
    shiftLabel?: string | null;
    roundNote?: string | null;
    carePlan?: string | null;
    handoffNotes?: string | null;
    acknowledgedByUserId?: number | null;
    acknowledgedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};
type CarePlan = {
    id: string;
    carePlanNumber?: string | null;
    admissionId?: string | null;
    patientId?: string | null;
    title?: string | null;
    planText?: string | null;
    goals?: string[] | null;
    interventions?: string[] | null;
    targetDischargeAt?: string | null;
    reviewDueAt?: string | null;
    status?: string | null;
    statusReason?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};
type DischargeChecklist = {
    id: string;
    admissionId?: string | null;
    patientId?: string | null;
    status?: string | null;
    statusReason?: string | null;
    clinicalSummaryCompleted: boolean;
    medicationReconciliationCompleted: boolean;
    followUpPlanCompleted: boolean;
    patientEducationCompleted: boolean;
    transportArranged: boolean;
    billingCleared: boolean;
    documentationCompleted: boolean;
    isReadyForDischarge: boolean;
    reviewedAt?: string | null;
    notes?: string | null;
    updatedAt?: string | null;
};
type DischargeChecklistAuditLog = {
    id: string;
    actorId?: number | null;
    actorType?: 'system' | 'user' | string | null;
    actor?: { id?: number | null; name?: string | null } | null;
    action?: string | null;
    actionLabel?: string | null;
    changes?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    createdAt?: string | null;
};
type StaffProfileSummary = {
    id: string;
    userId: number | null;
    userName: string | null;
    employeeNumber: string | null;
    department: string | null;
    jobTitle: string | null;
    status: string | null;
};
type BedSlot = { resource: WardBedResource; admission: CensusRow | null };
type FollowUpRailModuleKey = 'laboratory' | 'pharmacy' | 'radiology' | 'billing';
type FollowUpRailItem = {
    id: string;
    number?: string | null;
    title?: string | null;
    status?: string | null;
    timestamp?: string | null;
    detail?: string | null;
};
type FollowUpRailModule = {
    followUpCount: number;
    statusCounts: Record<string, number>;
    items: FollowUpRailItem[];
};
type FollowUpRail = {
    admissionId: string | null;
    patientId: string | null;
    generatedAt?: string | null;
    modules: Record<FollowUpRailModuleKey, FollowUpRailModule>;
};
type ContinuityTimelineEvent = {
    id: string;
    kind: 'task' | 'round_note' | 'care_plan' | 'discharge_checklist' | 'follow_up';
    icon: string;
    title: string;
    summary: string;
    timestamp?: string | null;
    status?: string | null;
    actionLabel?: string | null;
    action?: (() => void) | null;
};
const breadcrumbs: BreadcrumbItem[] = [{ title: 'Inpatient Ward', href: '/inpatient-ward' }];
const taskTypeOptions = ['medication', 'vitals', 'lab_follow_up', 'imaging_follow_up', 'wound_care', 'physiotherapy', 'nursing_review', 'discharge_prep', 'other'] as const;
const taskPriorityOptions = ['routine', 'urgent', 'critical'] as const;
const taskStatusOptions = ['pending', 'in_progress', 'completed', 'escalated', 'cancelled'] as const;
const carePlanStatusOptions = ['active', 'completed', 'cancelled'] as const;
const dischargeChecklistStatusOptions = ['draft', 'ready', 'blocked', 'completed'] as const;
const shiftLabelOptions = ['day', 'evening', 'night'] as const;
const checklistAuditActorTypeOptions = [
    { value: '', label: 'All actors' },
    { value: 'user', label: 'User only' },
    { value: 'system', label: 'System only' },
] as const;
const checklistAuditActionOptions = [
    { value: '', label: 'All actions' },
    { value: 'inpatient-ward-discharge-checklist.created', label: 'Checklist Created' },
    { value: 'inpatient-ward-discharge-checklist.updated', label: 'Checklist Updated' },
    { value: 'inpatient-ward-discharge-checklist.status.updated', label: 'Status Updated' },
    { value: 'inpatient-ward-discharge-checklist.document.pdf.downloaded', label: 'PDF Downloaded' },
] as const;

const page = usePage<{ auth?: { user?: { id?: number | string | null; name?: string | null } } }>();
const { permissionState, isFacilitySuperAdmin, scope, effectiveFacilityCode, effectiveTenantCode } = usePlatformAccess();
const compactQueueRows = useLocalStorageBoolean('inpatient.ward.queue.compact', false);

function hasAccess(name: string): boolean {
    return permissionState(name) === 'allowed' || isFacilitySuperAdmin.value;
}

const canRead = computed(() => hasAccess('inpatient.ward.read'));
const canCreateTask = computed(() => hasAccess('inpatient.ward.create-task'));
const canUpdateTaskStatus = computed(() => hasAccess('inpatient.ward.update-task-status'));
const canCreateRoundNote = computed(() => hasAccess('inpatient.ward.create-round-note'));
const canCreateCarePlan = computed(() => hasAccess('inpatient.ward.create-care-plan'));
const canUpdateCarePlan = computed(() => hasAccess('inpatient.ward.update-care-plan'));
const canUpdateCarePlanStatus = computed(() => hasAccess('inpatient.ward.update-care-plan-status'));
const canManageDischargeChecklist = computed(() => hasAccess('inpatient.ward.manage-discharge-checklist'));
const canViewInpatientWardAudit = computed(() => hasAccess('inpatient.ward.view-audit-logs'));
const canReadMedicalRecords = computed(() => hasAccess('medical.records.read'));
const canCreateMedicalRecords = computed(() =>
    canReadMedicalRecords.value && hasAccess('medical.records.create'),
);
const canReadLaboratoryOrders = computed(() => hasAccess('laboratory.orders.read'));
const canReadPharmacyOrders = computed(() => hasAccess('pharmacy.orders.read'));
const canReadRadiologyOrders = computed(() => hasAccess('radiology.orders.read'));
const canReadBillingInvoices = computed(() => hasAccess('billing.invoices.read'));
const canReadAssigneeDirectory = computed(() => isFacilitySuperAdmin.value || hasAccess('staff.clinical-directory.read'));
const currentUserId = computed<number | null>(() => {
    const raw = page.props.auth?.user?.id;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
});
const currentUserName = computed(() => String(page.props.auth?.user?.name ?? '').trim());
const workspaceView = ref<WorkspaceView>('documentation');
const boardTab = ref<BoardTab>('shift');
const documentationFlow = ref<DocumentationFlow>('task');

const pageLoading = ref(true);
const queueLoading = ref(false);
const boardLoading = ref(false);
const documentationSubmitting = ref(false);
const selectedDocumentationLoading = ref(false);
const refreshingPage = ref(false);
const pageError = ref<string | null>(null);
const queueError = ref<string | null>(null);
const boardError = ref<string | null>(null);
const documentationError = ref<string | null>(null);
const documentationSuccess = ref<string | null>(null);

const filterSheetOpen = ref(false);
const statusDialogOpen = ref(false);
const statusDialogError = ref<string | null>(null);
const statusDialogTarget = ref<WardTask | CarePlan | DischargeChecklist | null>(null);
const statusDialogKind = ref<'task' | 'care_plan' | 'discharge_checklist'>('task');
const statusDialogStatus = ref('');
const statusDialogReason = ref('');
const actionLoadingId = ref<string | null>(null);
const taskDetailsOpen = ref(false);
const taskDetailsTask = ref<WardTask | null>(null);
const roundNoteDetailsOpen = ref(false);
const roundNoteDetailsNote = ref<RoundNote | null>(null);
const roundNoteAcknowledgeLoadingId = ref<string | null>(null);
const carePlanDetailsOpen = ref(false);
const carePlanDetailsPlan = ref<CarePlan | null>(null);
const checklistDetailsOpen = ref(false);
const checklistDetailsRecord = ref<DischargeChecklist | null>(null);
const checklistAuditFiltersOpen = ref(false);
const checklistAuditLoading = ref(false);
const checklistAuditError = ref<string | null>(null);
const checklistAuditExporting = ref(false);
const checklistAuditLogs = ref<DischargeChecklistAuditLog[]>([]);
const checklistAuditMeta = ref<ApiListMeta | null>(null);
const checklistAuditRequestChecklistId = ref<string | null>(null);
const checklistAuditFilters = reactive({
    q: '',
    action: '',
    actorType: '',
    actorId: '',
    from: '',
    to: '',
    page: 1,
    perPage: 20,
});
const documentationSheetOpen = ref(false);
const taskAssignmentSheetOpen = ref(false);
const taskAssignmentTarget = ref<WardTask | null>(null);
const taskAssignmentUserId = ref('');
const taskAssignmentError = ref<string | null>(null);
const taskAssignmentSubmitting = ref(false);
const censusRows = ref<CensusRow[]>([]);
const wardBeds = ref<WardBedResource[]>([]);
const tasks = ref<WardTask[]>([]);
const boardTasks = ref<WardTask[]>([]);
const roundNotes = ref<RoundNote[]>([]);
const carePlans = ref<CarePlan[]>([]);
const checklists = ref<DischargeChecklist[]>([]);
const selectedAdmissionTasks = ref<WardTask[]>([]);
const selectedAdmissionRoundNoteRecords = ref<RoundNote[]>([]);
const selectedAdmissionCarePlanRecords = ref<CarePlan[]>([]);
const selectedAdmissionChecklistRecord = ref<DischargeChecklist | null>(null);
const selectedAdmissionFollowUpRail = ref<FollowUpRail | null>(null);
const assigneeDirectoryLoading = ref(false);
const assigneeDirectoryError = ref<string | null>(null);
const assigneeDirectoryAccessRestricted = ref(false);
const assigneeDirectory = ref<StaffProfileSummary[]>([]);
const taskCounts = ref<CountBucket>({ pending: 0, in_progress: 0, completed: 0, escalated: 0, cancelled: 0, other: 0, total: 0 });
const taskPagination = ref<ApiListMeta | null>(null);
const followUpRailLoading = ref(false);
const followUpRailError = ref<string | null>(null);
const taskFilters = reactive({ q: '', status: '', priority: '', admissionId: '', page: 1, perPage: 25 });
const taskFilterDraft = reactive({ priority: '', admissionId: '' });

const selectedAdmission = ref<CensusRow | null>(null);
const selectedAdmissionId = ref('');
const taskDetailsAdmission = computed(() => (taskDetailsTask.value ? admissionFor(taskDetailsTask.value) : null));
const carePlanDetailsAdmission = computed(() => (carePlanDetailsPlan.value ? admissionFor(carePlanDetailsPlan.value) : null));
const checklistDetailsAdmission = computed(() => (checklistDetailsRecord.value ? admissionFor(checklistDetailsRecord.value) : null));
const formErrors = ref<Record<string, string[]>>({});

const taskForm = reactive({ taskType: 'vitals', title: '', priority: 'routine', assignedToUserId: '', dueAt: '', notes: '' });
const roundNoteForm = reactive({ roundedAt: '', shiftLabel: defaultShiftLabelForNow(), roundNote: '', carePlan: '', handoffNotes: '' });
const carePlanForm = reactive({ title: '', planText: '', goalsText: '', interventionsText: '', reviewDueAt: '', targetDischargeAt: '' });
const checklistForm = reactive({
    status: 'draft',
    statusReason: '',
    clinicalSummaryCompleted: false,
    medicationReconciliationCompleted: false,
    followUpPlanCompleted: false,
    patientEducationCompleted: false,
    transportArranged: false,
    billingCleared: false,
    documentationCompleted: false,
    notes: '',
});

const selfAssigneeOption = computed<SearchableSelectOption | null>(() => {
    if (currentUserId.value === null) return null;

    return {
        value: String(currentUserId.value),
        label: currentUserName.value || 'You',
        description: `Current signed-in user | User ID ${currentUserId.value}`,
        keywords: [currentUserName.value, 'you', 'current user', String(currentUserId.value)].filter(Boolean),
        group: 'Current shift',
    } satisfies SearchableSelectOption;
});

const assigneeOptions = computed<SearchableSelectOption[]>(() => {
    const mapped = assigneeDirectory.value
        .filter((profile) => profile.userId !== null && String(profile.status ?? '').trim().toLowerCase() !== 'inactive')
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
        });

    const selfOption = selfAssigneeOption.value;
    if (!selfOption) return mapped;

    return mapped.some((option) => option.value === selfOption.value) ? mapped : [selfOption, ...mapped];
});

const assigneeDirectoryAvailable = computed(() => assigneeOptions.value.length > 0);
const assigneeFieldHelperText = computed(() => {
    if (assigneeDirectoryLoading.value) {
        return 'Loading active ward staff directory.';
    }
    if (assigneeDirectoryAccessRestricted.value) {
        return 'Staff directory access is unavailable. Leave the task unassigned, or assign it to yourself if you are taking it now.';
    }
    if (assigneeDirectoryError.value) {
        return assigneeDirectoryError.value;
    }
    if (assigneeDirectoryAvailable.value) {
        return 'Assign the task to the responsible ward staff member, or leave it unassigned for shift pickup.';
    }
    return 'No active ward staff with linked user IDs are available right now. Leave the task unassigned or assign it to yourself.';
});

function documentationFlowUsesSheet(flow: DocumentationFlow): boolean {
    return flow !== 'round_note';
}

function setDocumentationFlow(flow: DocumentationFlow): void {
    documentationFlow.value = flow;
    documentationSheetOpen.value = documentationFlowUsesSheet(flow) && Boolean(selectedAdmission.value);
}

function closeDocumentationSheet(): void {
    documentationSheetOpen.value = false;
}

function csrfToken(): string | null {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
}

async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, options?: { query?: Record<string, string | number | null | undefined>; body?: Record<string, unknown> }): Promise<T> {
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
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as ApiError;
        error.status = response.status;
        error.payload = payload;
        throw error;
    }
    return payload as T;
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

function formatDateTimeLocalInputValue(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value.slice(0, 16).replace(' ', 'T');
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}
function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function resetChecklistAuditFilters(): void {
    checklistAuditFilters.q = '';
    checklistAuditFilters.action = '';
    checklistAuditFilters.actorType = '';
    checklistAuditFilters.actorId = '';
    checklistAuditFilters.from = '';
    checklistAuditFilters.to = '';
    checklistAuditFilters.page = 1;
    checklistAuditFilters.perPage = 20;
}

function resetChecklistAuditState(options?: { preserveFilters?: boolean }): void {
    checklistAuditFiltersOpen.value = false;
    checklistAuditLoading.value = false;
    checklistAuditError.value = null;
    checklistAuditExporting.value = false;
    checklistAuditLogs.value = [];
    checklistAuditMeta.value = null;
    checklistAuditRequestChecklistId.value = null;

    if (!options?.preserveFilters) {
        resetChecklistAuditFilters();
    }
}

function checklistAuditQuery(): Record<string, string | number | null> {
    return {
        q: checklistAuditFilters.q.trim() || null,
        action: checklistAuditFilters.action || null,
        actorType: checklistAuditFilters.actorType || null,
        actorId: checklistAuditFilters.actorId.trim() || null,
        from: checklistAuditFilters.from || null,
        to: checklistAuditFilters.to || null,
        page: checklistAuditFilters.page,
        perPage: checklistAuditFilters.perPage,
    };
}

async function loadChecklistAuditLogs(checklistId: string): Promise<void> {
    if (!canViewInpatientWardAudit.value || !checklistId) return;

    checklistAuditLoading.value = true;
    checklistAuditError.value = null;
    checklistAuditRequestChecklistId.value = checklistId;

    try {
        const response = await apiRequest<ApiListResponse<DischargeChecklistAuditLog>>(
            'GET',
            `/inpatient-ward/discharge-checklists/${checklistId}/audit-logs`,
            { query: checklistAuditQuery() },
        );

        if (checklistAuditRequestChecklistId.value !== checklistId) {
            return;
        }

        checklistAuditLogs.value = response.data ?? [];
        checklistAuditMeta.value = {
            currentPage: response.meta?.currentPage ?? checklistAuditFilters.page,
            perPage: response.meta?.perPage ?? checklistAuditFilters.perPage,
            total: response.meta?.total ?? checklistAuditLogs.value.length,
            lastPage: response.meta?.lastPage ?? 1,
        };
    } catch (error) {
        if (checklistAuditRequestChecklistId.value !== checklistId) {
            return;
        }

        checklistAuditError.value = messageFromUnknown(error, 'Unable to load discharge checklist audit logs.');
        checklistAuditLogs.value = [];
        checklistAuditMeta.value = null;
    } finally {
        if (checklistAuditRequestChecklistId.value === checklistId) {
            checklistAuditLoading.value = false;
        }
    }
}

function applyChecklistAuditFilters(): void {
    if (!checklistDetailsRecord.value?.id) return;

    checklistAuditFilters.page = 1;
    void loadChecklistAuditLogs(checklistDetailsRecord.value.id);
}

function resetChecklistAuditFiltersAndReload(): void {
    if (!checklistDetailsRecord.value?.id) return;

    resetChecklistAuditFilters();
    void loadChecklistAuditLogs(checklistDetailsRecord.value.id);
}

function goToChecklistAuditPage(page: number): void {
    if (!checklistDetailsRecord.value?.id) return;

    checklistAuditFilters.page = Math.max(page, 1);
    void loadChecklistAuditLogs(checklistDetailsRecord.value.id);
}

function exportChecklistAuditLogsCsv(): void {
    if (!checklistDetailsRecord.value?.id || !canViewInpatientWardAudit.value || checklistAuditExporting.value) {
        return;
    }

    checklistAuditExporting.value = true;

    try {
        const url = new URL(
            `/api/v1/inpatient-ward/discharge-checklists/${checklistDetailsRecord.value.id}/audit-logs/export`,
            window.location.origin,
        );

        Object.entries(checklistAuditQuery()).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') return;
            url.searchParams.set(key, String(value));
        });

        window.open(url.toString(), '_blank', 'noopener');
    } finally {
        checklistAuditExporting.value = false;
    }
}

function defaultShiftLabelForNow(date = new Date()): 'day' | 'evening' | 'night' {
    const hour = date.getHours();
    if (hour >= 6 && hour < 15) return 'day';
    if (hour >= 15 && hour < 22) return 'evening';
    return 'night';
}

function parseLines(value: string): string[] {
    return value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
}

function formatStatusVariant(status: string | null | undefined): 'default' | 'secondary' | 'outline' | 'destructive' {
    const normalized = String(status ?? '').trim().toLowerCase();
    if (['escalated', 'cancelled', 'blocked'].includes(normalized)) return 'destructive';
    if (['completed', 'ready'].includes(normalized)) return 'default';
    if (['active', 'in_progress', 'transferred'].includes(normalized)) return 'secondary';
    return 'outline';
}

function taskStatusToneClass(status: string | null | undefined): string {
    const normalized = String(status ?? '').trim().toLowerCase();
    if (normalized === 'escalated') return 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20';
    if (normalized === 'in_progress') return 'border-sky-200 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/20';
    if (normalized === 'completed') return 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20';
    if (normalized === 'cancelled') return 'border-border bg-muted/30 dark:bg-muted/10';
    return 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20';
}

function normalizeTaskStatusValue(task: Pick<WardTask, 'status'> | null | undefined): string {
    return String(task?.status ?? '').trim().toLowerCase();
}

function taskAssignedToCurrentUser(task: WardTask): boolean {
    return currentUserId.value !== null && Number(task.assignedToUserId ?? 0) === currentUserId.value;
}

function taskCanTake(task: WardTask): boolean {
    return canUpdateTaskStatus.value
        && currentUserId.value !== null
        && !task.assignedToUserId
        && !['completed', 'cancelled'].includes(normalizeTaskStatusValue(task));
}

function taskCanStartNow(task: WardTask): boolean {
    return canUpdateTaskStatus.value
        && currentUserId.value !== null
        && ['pending', 'escalated'].includes(normalizeTaskStatusValue(task))
        && (!task.assignedToUserId || taskAssignedToCurrentUser(task));
}

function taskCanCompleteNow(task: WardTask): boolean {
    return canUpdateTaskStatus.value
        && currentUserId.value !== null
        && ['pending', 'in_progress', 'escalated'].includes(normalizeTaskStatusValue(task))
        && (!task.assignedToUserId || taskAssignedToCurrentUser(task));
}

function staffProfileByUserId(userId: number | string | null | undefined): StaffProfileSummary | null {
    const normalized = Number(userId ?? 0);
    if (!Number.isFinite(normalized) || normalized <= 0) return null;
    return assigneeDirectory.value.find((profile) => Number(profile.userId) === normalized) ?? null;
}

function assigneeDisplayLabel(userId: number | string | null | undefined): string | null {
    const normalized = Number(userId ?? 0);
    if (!Number.isFinite(normalized) || normalized <= 0) return null;
    if (currentUserId.value !== null && normalized === currentUserId.value) {
        return currentUserName.value || 'You';
    }

    const profile = staffProfileByUserId(normalized);
    if (!profile) return `User ID ${normalized}`;

    const userName = String(profile.userName ?? '').trim();
    const employeeNumber = String(profile.employeeNumber ?? '').trim();
    return userName || employeeNumber || `User ID ${normalized}`;
}

function taskAssignmentSummary(task: WardTask): string {
    if (taskAssignedToCurrentUser(task)) return 'Assigned to you';
    if (task.assignedToUserId) return `Assigned to ${assigneeDisplayLabel(task.assignedToUserId)}`;
    return 'Unowned';
}

function taskOwnerDetail(task: WardTask): string {
    if (taskAssignedToCurrentUser(task)) return 'Current owner: you';
    if (task.assignedToUserId) return `Current owner: ${assigneeDisplayLabel(task.assignedToUserId)}`;
    return 'Current owner: unowned';
}

function taskCanReassign(task: WardTask): boolean {
    return canUpdateTaskStatus.value;
}

function taskIsOpen(task: WardTask): boolean {
    return ['pending', 'in_progress', 'escalated'].includes(normalizeTaskStatusValue(task));
}

function taskIsOverdue(task: WardTask): boolean {
    if (!taskIsOpen(task) || !task.dueAt) return false;
    const dueAt = new Date(task.dueAt);
    return !Number.isNaN(dueAt.getTime()) && dueAt.getTime() < Date.now();
}

function taskNeedsActionNow(task: WardTask): boolean {
    return taskIsOpen(task) && (
        normalizeTaskStatusValue(task) === 'escalated'
        || taskIsOverdue(task)
        || !task.assignedToUserId
    );
}

function taskActionReasons(task: WardTask): string[] {
    const reasons: string[] = [];
    if (normalizeTaskStatusValue(task) === 'escalated') reasons.push('Escalated');
    if (taskIsOverdue(task)) reasons.push('Overdue');
    if (!task.assignedToUserId) reasons.push('Unassigned');
    return reasons;
}

function boardTaskToneClass(task: WardTask): string {
    const normalized = normalizeTaskStatusValue(task);
    if (normalized === 'escalated') return 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/25';
    if (taskIsOverdue(task)) return 'border-amber-300 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/25';
    if (!task.assignedToUserId && taskIsOpen(task)) return 'border-orange-200 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-950/20';
    if (normalized === 'in_progress') return 'border-sky-200 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/20';
    if (normalized === 'completed') return 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20';
    return 'border-border/70 bg-background/70 dark:bg-background/40';
}

function summaryToneClass(tone: string | null | undefined): string {
    if (tone === 'danger') return 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20';
    if (tone === 'warning') return 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20';
    if (tone === 'success') return 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20';
    return 'border-border/70 bg-background/70 dark:bg-background/40';
}

function taskTimelineAnchor(task: WardTask): string | null {
    return task.dueAt || task.escalatedAt || task.startedAt || task.completedAt || task.updatedAt || task.createdAt || null;
}

function admissionFor(record: { admissionId?: string | null; patientId?: string | null }): CensusRow | null {
    const byAdmission = censusRows.value.find((row) => row.id === record.admissionId);
    if (byAdmission) return byAdmission;
    return censusRows.value.find((row) => row.patientId === record.patientId) ?? null;
}

function admissionLabel(record: { admissionId?: string | null; patientId?: string | null }): string {
    const admission = admissionFor(record);
    return admission?.admissionNumber?.trim() || (record.admissionId?.slice(0, 8).toUpperCase() ?? 'Admission');
}

function patientLabel(record: { admissionId?: string | null; patientId?: string | null }): string {
    const admission = admissionFor(record);
    return admission?.patientName?.trim() || admission?.patientNumber?.trim() || (record.patientId?.slice(0, 8).toUpperCase() ?? 'Patient');
}

function patientMeta(record: { admissionId?: string | null; patientId?: string | null }): string {
    const admission = admissionFor(record);
    const parts = [admission?.patientNumber?.trim() ?? null, admission?.ward?.trim() ?? null, admission?.bed?.trim() ? `Bed ${admission.bed.trim()}` : null].filter((value): value is string => Boolean(value));
    return parts.length > 0 ? parts.join(' | ') : 'Context unavailable';
}

function placementLabel(admission: CensusRow | null): string {
    if (!admission) return 'No ward or bed assigned';
    const parts = [admission.ward?.trim() ?? null, admission.bed?.trim() ? `Bed ${admission.bed.trim()}` : null].filter((value): value is string => Boolean(value));
    return parts.length > 0 ? parts.join(' / ') : 'No ward or bed assigned';
}

function checklistCompletionCount(checklist: DischargeChecklist): number {
    return [
        checklist.clinicalSummaryCompleted,
        checklist.medicationReconciliationCompleted,
        checklist.followUpPlanCompleted,
        checklist.patientEducationCompleted,
        checklist.transportArranged,
        checklist.billingCleared,
        checklist.documentationCompleted,
    ].filter(Boolean).length;
}

function fieldError(key: string): string | null {
    return formErrors.value[key]?.[0]
        ?? Object.entries(formErrors.value).find(([errorKey]) => errorKey.startsWith(`${key}.`))?.[1]?.[0]
        ?? null;
}

function setFieldError(key: string, message: string): void {
    formErrors.value = { ...formErrors.value, [key]: [message] };
}

function clearFieldError(key: string): void {
    if (!(key in formErrors.value)) return;
    const nextErrors = { ...formErrors.value };
    delete nextErrors[key];
    formErrors.value = nextErrors;
}

function resetErrors(): void {
    formErrors.value = {};
    documentationError.value = null;
    documentationSuccess.value = null;
    statusDialogError.value = null;
}

function ensureSelectedAdmission(): boolean {
    resetErrors();
    if (selectedAdmissionId.value) return true;
    setFieldError('admissionId', 'Select an inpatient admission first.');
    return false;
}

function applyDocumentationApiError(error: unknown, fallbackMessage: string): void {
    const apiError = error as ApiError;
    const errors = apiError.payload?.errors ?? {};
    const hasFieldErrors = Object.keys(errors).length > 0;
    formErrors.value = errors;
    documentationSuccess.value = null;
    documentationError.value = hasFieldErrors ? null : (apiError.payload?.message ?? fallbackMessage);
    if (!hasFieldErrors) {
        notifyError(messageFromUnknown(error, fallbackMessage));
    }
}

function syncFilterDraft(): void {
    taskFilterDraft.priority = taskFilters.priority;
    taskFilterDraft.admissionId = taskFilters.admissionId;
}

function resetTaskForm(): void {
    taskForm.taskType = 'vitals';
    taskForm.title = '';
    taskForm.priority = 'routine';
    taskForm.assignedToUserId = '';
    taskForm.dueAt = '';
    taskForm.notes = '';
}

function assignTaskFormToCurrentUser(): void {
    if (currentUserId.value === null) return;
    taskForm.assignedToUserId = String(currentUserId.value);
    clearFieldError('assignedToUserId');
}

function resetRoundNoteForm(): void {
    roundNoteForm.roundedAt = '';
    roundNoteForm.shiftLabel = defaultShiftLabelForNow();
    roundNoteForm.roundNote = '';
    roundNoteForm.carePlan = '';
    roundNoteForm.handoffNotes = '';
}

function resetCarePlanForm(): void {
    carePlanForm.title = '';
    carePlanForm.planText = '';
    carePlanForm.goalsText = '';
    carePlanForm.interventionsText = '';
    carePlanForm.reviewDueAt = '';
    carePlanForm.targetDischargeAt = '';
}

function resetChecklistForm(): void {
    checklistForm.status = 'draft';
    checklistForm.statusReason = '';
    checklistForm.clinicalSummaryCompleted = false;
    checklistForm.medicationReconciliationCompleted = false;
    checklistForm.followUpPlanCompleted = false;
    checklistForm.patientEducationCompleted = false;
    checklistForm.transportArranged = false;
    checklistForm.billingCleared = false;
    checklistForm.documentationCompleted = false;
    checklistForm.notes = '';
}

const editableCarePlan = computed(() =>
    selectedAdmissionCarePlanRecords.value.find((plan) => String(plan.status ?? '').trim().toLowerCase() === 'active')
    ?? selectedAdmissionCarePlanRecords.value[0]
    ?? null,
);

const editableChecklist = computed(() => selectedAdmissionChecklistRecord.value);

const selectedAdmissionRoundNotes = computed(() =>
    selectedAdmissionRoundNoteRecords.value
        .slice()
        .sort((left, right) => new Date(right.roundedAt || right.createdAt || 0).getTime() - new Date(left.roundedAt || left.createdAt || 0).getTime()),
);

const latestSelectedAdmissionRoundNote = computed(() => selectedAdmissionRoundNotes.value[0] ?? null);

const latestSelectedAdmissionHandoff = computed(() =>
    selectedAdmissionRoundNotes.value.find((note) => String(note.handoffNotes ?? '').trim() !== '') ?? null,
);

const selectedAdmissionCarePlans = computed(() =>
    selectedAdmissionCarePlanRecords.value
        .slice()
        .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime()),
);

const selectedAdmissionOpenTasks = computed(() =>
    selectedAdmissionTasks.value.filter((task) => !['completed', 'cancelled'].includes(String(task.status ?? '').trim().toLowerCase())),
);

const selectedAdmissionOverdueTasks = computed(() => {
    const now = Date.now();

    return selectedAdmissionOpenTasks.value.filter((task) => {
        if (!task.dueAt) return false;
        const dueAt = new Date(task.dueAt).getTime();
        return !Number.isNaN(dueAt) && dueAt < now;
    });
});

const selectedAdmissionEscalatedTasks = computed(() =>
    selectedAdmissionOpenTasks.value.filter((task) => String(task.status ?? '').trim().toLowerCase() === 'escalated'),
);

const selectedAdmissionUnassignedTasks = computed(() =>
    selectedAdmissionOpenTasks.value.filter((task) => !task.assignedToUserId),
);

const selectedAdmissionReviewOverdue = computed(() => {
    const reviewDueAt = editableCarePlan.value?.reviewDueAt;
    const status = String(editableCarePlan.value?.status ?? '').trim().toLowerCase();
    if (!reviewDueAt || ['completed', 'cancelled'].includes(status)) {
        return false;
    }

    const reviewTime = new Date(reviewDueAt).getTime();
    return !Number.isNaN(reviewTime) && reviewTime < Date.now();
});

const selectedAdmissionHandoffStatusLabel = computed(() => {
    if (!latestSelectedAdmissionRoundNote.value) return 'Not recorded';
    if (!latestSelectedAdmissionHandoff.value) return 'No handoff note';
    return latestSelectedAdmissionHandoff.value.acknowledgedAt ? 'Acknowledged' : 'Pending acknowledgement';
});

const selectedAdmissionHandoffStatusVariant = computed<'default' | 'secondary' | 'outline' | 'destructive'>(() => {
    if (!latestSelectedAdmissionRoundNote.value) return 'outline';
    if (!latestSelectedAdmissionHandoff.value) return 'outline';
    return latestSelectedAdmissionHandoff.value.acknowledgedAt ? 'secondary' : 'destructive';
});

const selectedAdmissionHandoffMessage = computed(() => {
    if (!latestSelectedAdmissionRoundNote.value) {
        return 'No round note or handoff has been recorded for this admission yet.';
    }

    if (!latestSelectedAdmissionHandoff.value) {
        return `The latest round note from ${formatDateTime(latestSelectedAdmissionRoundNote.value.roundedAt || latestSelectedAdmissionRoundNote.value.createdAt)} did not include a dedicated handoff note.`;
    }

    const shiftLabel = latestSelectedAdmissionHandoff.value.shiftLabel
        ? `${formatEnumLabel(latestSelectedAdmissionHandoff.value.shiftLabel)} shift`
        : 'Latest shift';

    if (latestSelectedAdmissionHandoff.value.acknowledgedAt) {
        return `${shiftLabel} handoff was acknowledged at ${formatDateTime(latestSelectedAdmissionHandoff.value.acknowledgedAt)}.`;
    }

    return `${shiftLabel} handoff is waiting for acknowledgement.`;
});

const selectedAdmissionHasRecordedData = computed(() =>
    selectedAdmissionRoundNotes.value.length > 0 || selectedAdmissionCarePlans.value.length > 0 || Boolean(editableChecklist.value),
);

const checklistReadyForSubmit = computed(() => [
    checklistForm.clinicalSummaryCompleted,
    checklistForm.medicationReconciliationCompleted,
    checklistForm.followUpPlanCompleted,
    checklistForm.patientEducationCompleted,
    checklistForm.transportArranged,
    checklistForm.billingCleared,
    checklistForm.documentationCompleted,
].every(Boolean));

function emptyFollowUpRailModule(): FollowUpRailModule {
    return { followUpCount: 0, statusCounts: {}, items: [] };
}

function followUpModule(key: FollowUpRailModuleKey): FollowUpRailModule {
    return selectedAdmissionFollowUpRail.value?.modules?.[key] ?? emptyFollowUpRailModule();
}

function followUpStatusCount(module: FollowUpRailModule, statuses: string[]): number {
    return statuses.reduce((total, status) => total + Number(module.statusCounts[status] ?? 0), 0);
}

function followUpSummaryText(key: FollowUpRailModuleKey, module: FollowUpRailModule): string {
    if (module.followUpCount <= 0) {
        if (key === 'laboratory') return 'No active laboratory follow-up is linked to this admission.';
        if (key === 'pharmacy') return 'No active medication follow-up is linked to this admission.';
        if (key === 'radiology') return 'No active imaging follow-up is linked to this admission.';
        return 'No active billing follow-up is linked to this admission.';
    }

    const parts: string[] = [];
    if (key === 'laboratory') {
        const ordered = followUpStatusCount(module, ['ordered']);
        const collected = followUpStatusCount(module, ['collected']);
        const inProgress = followUpStatusCount(module, ['in_progress']);
        if (ordered) parts.push(`Ordered ${ordered}`);
        if (collected) parts.push(`Collected ${collected}`);
        if (inProgress) parts.push(`In progress ${inProgress}`);
    } else if (key === 'pharmacy') {
        const pending = followUpStatusCount(module, ['pending']);
        const preparing = followUpStatusCount(module, ['in_preparation']);
        const partial = followUpStatusCount(module, ['partially_dispensed']);
        const reconciliation = followUpStatusCount(module, ['reconciliation_pending', 'reconciliation_exception']);
        if (pending) parts.push(`Pending ${pending}`);
        if (preparing) parts.push(`Preparing ${preparing}`);
        if (partial) parts.push(`Partial ${partial}`);
        if (reconciliation) parts.push(`Reconciliation ${reconciliation}`);
    } else if (key === 'radiology') {
        const ordered = followUpStatusCount(module, ['ordered']);
        const scheduled = followUpStatusCount(module, ['scheduled']);
        const inProgress = followUpStatusCount(module, ['in_progress']);
        if (ordered) parts.push(`Ordered ${ordered}`);
        if (scheduled) parts.push(`Scheduled ${scheduled}`);
        if (inProgress) parts.push(`In progress ${inProgress}`);
    } else {
        const draft = followUpStatusCount(module, ['draft']);
        const issued = followUpStatusCount(module, ['issued']);
        const partial = followUpStatusCount(module, ['partially_paid']);
        if (draft) parts.push(`Draft ${draft}`);
        if (issued) parts.push(`Issued ${issued}`);
        if (partial) parts.push(`Partial ${partial}`);
    }

    return parts.length > 0 ? parts.join(' | ') : `${module.followUpCount} linked items still need downstream follow-up.`;
}

function buildFollowUpModuleHref(key: FollowUpRailModuleKey): string | null {
    const admissionId = selectedAdmissionId.value.trim();
    const patientId = selectedAdmission.value?.patientId?.trim() ?? '';
    const params = new URLSearchParams();

    if (patientId) params.set('patientId', patientId);
    if (admissionId) params.set('admissionId', admissionId);

    const basePath = key === 'laboratory'
        ? '/laboratory-orders'
        : key === 'pharmacy'
            ? '/pharmacy-orders'
            : key === 'radiology'
                ? '/radiology-orders'
                : '/billing-invoices';

    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
}

function openFollowUpModule(key: FollowUpRailModuleKey): void {
    const href = buildFollowUpModuleHref(key);
    if (!href) return;
    window.location.assign(href);
}

function selectedAdmissionMedicalRecordCreateHref(recordType: string): string | null {
    const admissionId = selectedAdmissionId.value.trim();
    const patientId = selectedAdmission.value?.patientId?.trim() ?? '';
    if (!patientId || !admissionId) return null;

    const params = new URLSearchParams({
        patientId,
        admissionId,
        tab: 'new',
        createRecordType: recordType,
        from: 'inpatient-ward',
    });

    return `/medical-records?${params.toString()}`;
}

function selectedAdmissionMedicalRecordBrowseHref(recordType?: string | null): string | null {
    const admissionId = selectedAdmissionId.value.trim();
    const patientId = selectedAdmission.value?.patientId?.trim() ?? '';
    if (!patientId) return null;

    const params = new URLSearchParams({
        patientId,
        tab: 'list',
    });

    if (admissionId) {
        params.set('admissionId', admissionId);
    }

    const normalizedRecordType = (recordType ?? '').trim();
    if (normalizedRecordType) {
        params.set('recordType', normalizedRecordType);
    }

    return `/medical-records?${params.toString()}`;
}

const selectedAdmissionFollowUpCount = computed(() =>
    followUpModule('laboratory').followUpCount
    + followUpModule('pharmacy').followUpCount
    + followUpModule('radiology').followUpCount
    + followUpModule('billing').followUpCount,
);

const followUpModuleCards = computed(() => {
    const laboratory = followUpModule('laboratory');
    const pharmacy = followUpModule('pharmacy');
    const radiology = followUpModule('radiology');
    const billing = followUpModule('billing');

    return [
        {
            key: 'laboratory' as const,
            title: 'Laboratory',
            openLabel: 'Open lab',
            icon: 'flask-conical' as const,
            module: laboratory,
            summary: followUpSummaryText('laboratory', laboratory),
            canOpen: canReadLaboratoryOrders.value,
        },
        {
            key: 'pharmacy' as const,
            title: 'Pharmacy',
            openLabel: 'Open pharmacy',
            icon: 'pill' as const,
            module: pharmacy,
            summary: followUpSummaryText('pharmacy', pharmacy),
            canOpen: canReadPharmacyOrders.value,
        },
        {
            key: 'radiology' as const,
            title: 'Radiology',
            openLabel: 'Open imaging',
            icon: 'scan-line' as const,
            module: radiology,
            summary: followUpSummaryText('radiology', radiology),
            canOpen: canReadRadiologyOrders.value,
        },
        {
            key: 'billing' as const,
            title: 'Billing',
            openLabel: 'Open billing',
            icon: 'receipt' as const,
            module: billing,
            summary: followUpSummaryText('billing', billing),
            canOpen: canReadBillingInvoices.value,
        },
    ];
});

function continuityTimestampValue(value: string | null | undefined): number {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

const selectedAdmissionContinuityEvents = computed<ContinuityTimelineEvent[]>(() => {
    if (!selectedAdmission.value) return [];

    const events: ContinuityTimelineEvent[] = [];

    selectedAdmissionTasks.value
        .slice()
        .sort((left, right) => continuityTimestampValue(right.updatedAt || right.createdAt || right.dueAt) - continuityTimestampValue(left.updatedAt || left.createdAt || left.dueAt))
        .slice(0, 3)
        .forEach((task) => {
            const parts = [
                task.taskType ? formatEnumLabel(task.taskType) : null,
                task.priority ? `${formatEnumLabel(task.priority)} priority` : null,
                task.notes?.trim() || null,
            ].filter((value): value is string => Boolean(value));

            events.push({
                id: `task-${task.id}`,
                kind: 'task',
                icon: 'clipboard-list',
                title: task.title?.trim() || task.taskNumber?.trim() || 'Ward task updated',
                summary: parts.length > 0 ? parts.join(' | ') : 'Ward task updated for this admission.',
                timestamp: task.updatedAt || task.createdAt || task.dueAt || null,
                status: task.status ?? null,
                actionLabel: 'Open task',
                action: () => openTaskDetails(task),
            });
        });

    selectedAdmissionRoundNotes.value
        .slice(0, 3)
        .forEach((note) => {
            const title = note.shiftLabel ? `${formatEnumLabel(note.shiftLabel)} shift round note` : 'Round note recorded';
            const summary = note.handoffNotes?.trim() || note.roundNote?.trim() || note.carePlan?.trim() || 'Ward round updated for this admission.';
            const status = note.handoffNotes ? (note.acknowledgedAt ? 'completed' : 'pending') : null;

            events.push({
                id: `round-note-${note.id}`,
                kind: 'round_note',
                icon: 'stethoscope',
                title,
                summary,
                timestamp: note.roundedAt || note.createdAt || note.updatedAt || null,
                status,
                actionLabel: 'Open note',
                action: () => openRoundNoteDetails(note),
            });
        });

    selectedAdmissionCarePlans.value
        .slice(0, 2)
        .forEach((plan) => {
            const summary = plan.planText?.trim() || plan.goals?.[0] || plan.interventions?.[0] || 'Care plan updated for this admission.';
            events.push({
                id: `care-plan-${plan.id}`,
                kind: 'care_plan',
                icon: 'file-text',
                title: plan.title?.trim() || plan.carePlanNumber?.trim() || 'Care plan updated',
                summary,
                timestamp: plan.updatedAt || plan.createdAt || plan.reviewDueAt || null,
                status: plan.status ?? null,
                actionLabel: 'Open plan',
                action: () => openCarePlanDetails(plan),
            });
        });

    if (editableChecklist.value) {
        const checklist = editableChecklist.value;
        const summaryParts = [`${checklistCompletionCount(checklist)}/7 bedside discharge items complete`];
        if (checklist.statusReason?.trim()) {
            summaryParts.push(checklist.statusReason.trim());
        } else if (checklist.isReadyForDischarge) {
            summaryParts.push('Ready for discharge.');
        }

        events.push({
            id: `checklist-${checklist.id}`,
            kind: 'discharge_checklist',
            icon: 'check-check',
            title: 'Discharge readiness updated',
            summary: summaryParts.join(' | '),
            timestamp: checklist.reviewedAt || checklist.updatedAt || null,
            status: checklist.status ?? null,
            actionLabel: 'Open checklist',
            action: () => openChecklistDetails(checklist),
        });
    }

    followUpModuleCards.value
        .filter((card) => card.module.followUpCount > 0)
        .forEach((card) => {
            events.push({
                id: `follow-up-${card.key}`,
                kind: 'follow_up',
                icon: card.icon,
                title: `${card.title} follow-up pending`,
                summary: card.summary,
                timestamp: selectedAdmissionFollowUpRail.value?.generatedAt || null,
                status: 'in_progress',
                actionLabel: card.canOpen ? card.openLabel : null,
                action: card.canOpen ? () => openFollowUpModule(card.key) : null,
            });
        });

    return events
        .sort((left, right) => continuityTimestampValue(right.timestamp) - continuityTimestampValue(left.timestamp))
        .slice(0, 8);
});

async function loadAssigneeDirectory(): Promise<void> {
    assigneeDirectoryLoading.value = true;
    assigneeDirectoryError.value = null;
    assigneeDirectoryAccessRestricted.value = false;

    if (!canReadAssigneeDirectory.value) {
        assigneeDirectory.value = [];
        assigneeDirectoryAccessRestricted.value = true;
        assigneeDirectoryLoading.value = false;
        return;
    }

    try {
        const response = await apiRequest<ApiListResponse<StaffProfileSummary>>('GET', '/staff/clinical-directory', {
            query: {
                status: 'active',
                clinicalOnly: 'true',
                page: 1,
                perPage: 200,
            },
        });
        assigneeDirectory.value = response.data ?? [];
    } catch (error) {
        assigneeDirectory.value = [];
        if ((error as { status?: number } | null)?.status === 403) {
            assigneeDirectoryAccessRestricted.value = true;
            assigneeDirectoryError.value = null;
        } else {
            assigneeDirectoryError.value = messageFromUnknown(error, 'Unable to load active ward staff directory.');
        }
    } finally {
        assigneeDirectoryLoading.value = false;
    }
}

async function loadCensus(): Promise<void> {
    const response = await apiRequest<ApiListResponse<CensusRow>>('GET', '/inpatient-ward/census', { query: { perPage: 250 } });
    censusRows.value = response.data;
}

async function loadWardBeds(): Promise<void> {
    const response = await apiRequest<ApiListResponse<WardBedResource>>('GET', '/inpatient-ward/ward-beds', { query: { perPage: 500 } });
    wardBeds.value = response.data;
}

async function loadTasks(): Promise<void> {
    queueLoading.value = true;
    queueError.value = null;
    try {
        const response = await apiRequest<ApiListResponse<WardTask>>('GET', '/inpatient-ward/tasks', {
            query: {
                q: taskFilters.q.trim() || undefined,
                status: taskFilters.status || undefined,
                priority: taskFilters.priority || undefined,
                admissionId: taskFilters.admissionId || undefined,
                page: taskFilters.page,
                perPage: taskFilters.perPage,
            },
        });
        tasks.value = response.data;
        taskPagination.value = response.meta ?? null;
    } catch (error) {
        queueError.value = messageFromUnknown(error, 'Unable to load ward task queue.');
    } finally {
        queueLoading.value = false;
    }
}

async function loadBoardTasks(): Promise<void> {
    boardError.value = null;
    try {
        const response = await apiRequest<ApiListResponse<WardTask>>('GET', '/inpatient-ward/tasks', {
            query: {
                page: 1,
                perPage: 250,
            },
        });
        boardTasks.value = response.data ?? [];
    } catch (error) {
        boardTasks.value = [];
        boardError.value = messageFromUnknown(error, 'Unable to load board task pressure.');
    }
}

async function loadTaskCounts(): Promise<void> {
    const response = await apiRequest<{ data: CountBucket }>('GET', '/inpatient-ward/task-status-counts', {
        query: {
            q: taskFilters.q.trim() || undefined,
            priority: taskFilters.priority || undefined,
            admissionId: taskFilters.admissionId || undefined,
        },
    });
    taskCounts.value = { pending: 0, in_progress: 0, completed: 0, escalated: 0, cancelled: 0, other: 0, total: 0, ...response.data };
}

async function loadCarePlans(): Promise<void> {
    const response = await apiRequest<ApiListResponse<CarePlan>>('GET', '/inpatient-ward/care-plans', { query: { perPage: 100 } });
    carePlans.value = response.data;
}

async function loadRoundNotes(): Promise<void> {
    const response = await apiRequest<ApiListResponse<RoundNote>>('GET', '/inpatient-ward/round-notes', { query: { perPage: 100 } });
    roundNotes.value = response.data;
}

async function loadChecklists(): Promise<void> {
    const response = await apiRequest<ApiListResponse<DischargeChecklist>>('GET', '/inpatient-ward/discharge-checklists', { query: { perPage: 100 } });
    checklists.value = response.data;
}

async function loadSelectedAdmissionDocumentation(admissionId: string, options?: { preserveFeedback?: boolean }): Promise<void> {
    selectedDocumentationLoading.value = true;
    documentationError.value = null;

    try {
        const [taskResponse, roundNoteResponse, carePlanResponse, checklistResponse] = await Promise.all([
            apiRequest<ApiListResponse<WardTask>>('GET', '/inpatient-ward/tasks', { query: { admissionId, perPage: 100 } }),
            apiRequest<ApiListResponse<RoundNote>>('GET', '/inpatient-ward/round-notes', { query: { admissionId, perPage: 50, sortBy: 'roundedAt', sortDir: 'desc' } }),
            apiRequest<ApiListResponse<CarePlan>>('GET', '/inpatient-ward/care-plans', { query: { admissionId, perPage: 25, sortBy: 'updatedAt', sortDir: 'desc' } }),
            apiRequest<ApiListResponse<DischargeChecklist>>('GET', '/inpatient-ward/discharge-checklists', { query: { admissionId, perPage: 10, sortBy: 'updatedAt', sortDir: 'desc' } }),
        ]);

        if (selectedAdmissionId.value !== admissionId) {
            return;
        }

        selectedAdmissionTasks.value = taskResponse.data ?? [];
        selectedAdmissionRoundNoteRecords.value = roundNoteResponse.data ?? [];
        selectedAdmissionCarePlanRecords.value = carePlanResponse.data ?? [];
        selectedAdmissionChecklistRecord.value = (checklistResponse.data ?? [])[0] ?? null;

        if (!options?.preserveFeedback) {
            documentationSuccess.value = null;
        }

        if (editableCarePlan.value) {
            carePlanForm.title = editableCarePlan.value.title ?? '';
            carePlanForm.planText = editableCarePlan.value.planText ?? '';
            carePlanForm.goalsText = (editableCarePlan.value.goals ?? []).join('\n');
            carePlanForm.interventionsText = (editableCarePlan.value.interventions ?? []).join('\n');
            carePlanForm.reviewDueAt = formatDateTimeLocalInputValue(editableCarePlan.value.reviewDueAt);
            carePlanForm.targetDischargeAt = formatDateTimeLocalInputValue(editableCarePlan.value.targetDischargeAt);
        } else {
            resetCarePlanForm();
        }

        if (editableChecklist.value) {
            checklistForm.status = editableChecklist.value.status ?? 'draft';
            checklistForm.statusReason = editableChecklist.value.statusReason ?? '';
            checklistForm.clinicalSummaryCompleted = editableChecklist.value.clinicalSummaryCompleted;
            checklistForm.medicationReconciliationCompleted = editableChecklist.value.medicationReconciliationCompleted;
            checklistForm.followUpPlanCompleted = editableChecklist.value.followUpPlanCompleted;
            checklistForm.patientEducationCompleted = editableChecklist.value.patientEducationCompleted;
            checklistForm.transportArranged = editableChecklist.value.transportArranged;
            checklistForm.billingCleared = editableChecklist.value.billingCleared;
            checklistForm.documentationCompleted = editableChecklist.value.documentationCompleted;
            checklistForm.notes = editableChecklist.value.notes ?? '';
        } else {
            resetChecklistForm();
        }
    } catch (error) {
        if (selectedAdmissionId.value !== admissionId) {
            return;
        }

        selectedAdmissionTasks.value = [];
        selectedAdmissionRoundNoteRecords.value = [];
        selectedAdmissionCarePlanRecords.value = [];
        selectedAdmissionChecklistRecord.value = null;
        resetCarePlanForm();
        resetChecklistForm();
        documentationError.value = messageFromUnknown(error, 'Unable to load recorded documentation for this inpatient admission.');
    } finally {
        if (selectedAdmissionId.value === admissionId) {
            selectedDocumentationLoading.value = false;
        }
    }
}

async function loadSelectedAdmissionFollowUpRail(admissionId: string): Promise<void> {
    followUpRailLoading.value = true;
    followUpRailError.value = null;

    try {
        const response = await apiRequest<{ data: FollowUpRail }>('GET', '/inpatient-ward/follow-up-rail', {
            query: { admissionId, itemLimit: 2 },
        });

        if (selectedAdmissionId.value !== admissionId) {
            return;
        }

        selectedAdmissionFollowUpRail.value = response.data ?? null;
    } catch (error) {
        if (selectedAdmissionId.value !== admissionId) {
            return;
        }

        selectedAdmissionFollowUpRail.value = null;
        followUpRailError.value = messageFromUnknown(error, 'Unable to load cross-module follow-up for this admission.');
    } finally {
        if (selectedAdmissionId.value === admissionId) {
            followUpRailLoading.value = false;
        }
    }
}
async function reloadQueue(): Promise<void> {
    await Promise.all([loadTasks(), loadTaskCounts()]);
}

function replaceTask(updated: WardTask): void {
    tasks.value = tasks.value.map((task) => (task.id === updated.id ? updated : task));
    selectedAdmissionTasks.value = selectedAdmissionTasks.value.map((task) => (task.id === updated.id ? updated : task));
    if (taskDetailsTask.value?.id === updated.id) {
        taskDetailsTask.value = updated;
    }
}

function replaceRoundNote(updated: RoundNote): void {
    selectedAdmissionRoundNoteRecords.value = selectedAdmissionRoundNoteRecords.value.some((note) => note.id === updated.id)
        ? selectedAdmissionRoundNoteRecords.value.map((note) => (note.id === updated.id ? updated : note))
        : updated.admissionId === selectedAdmissionId.value
            ? [updated, ...selectedAdmissionRoundNoteRecords.value]
            : selectedAdmissionRoundNoteRecords.value;

    if (roundNoteDetailsNote.value?.id === updated.id) {
        roundNoteDetailsNote.value = updated;
    }
}

function canAcknowledgeRoundNote(note: RoundNote | null | undefined): boolean {
    if (!note) return false;
    if (note.acknowledgedAt) return false;
    return String(note.handoffNotes ?? '').trim() !== '';
}

function openTaskDetails(task: WardTask): void {
    taskDetailsTask.value = task;
    taskDetailsOpen.value = true;
}

function closeTaskDetails(): void {
    taskDetailsOpen.value = false;
    taskDetailsTask.value = null;
}

function openTaskStatusFromDetails(): void {
    if (!taskDetailsTask.value) return;
    const task = taskDetailsTask.value;
    closeTaskDetails();
    openStatusDialogFor('task', task);
}

function openRoundNoteDetails(note: RoundNote): void {
    roundNoteDetailsNote.value = note;
    roundNoteDetailsOpen.value = true;
}

function closeRoundNoteDetails(): void {
    roundNoteDetailsOpen.value = false;
    roundNoteDetailsNote.value = null;
}

function openCarePlanDetails(plan: CarePlan): void {
    carePlanDetailsPlan.value = plan;
    carePlanDetailsOpen.value = true;
}

function closeCarePlanDetails(): void {
    carePlanDetailsOpen.value = false;
    carePlanDetailsPlan.value = null;
}

function openCarePlanStatusFromDetails(): void {
    if (!carePlanDetailsPlan.value) return;
    const plan = carePlanDetailsPlan.value;
    closeCarePlanDetails();
    openStatusDialogFor('care_plan', plan);
}

function openChecklistDetails(checklist: DischargeChecklist): void {
    checklistDetailsRecord.value = checklist;
    checklistDetailsOpen.value = true;
    resetChecklistAuditState();

    if (canViewInpatientWardAudit.value) {
        void loadChecklistAuditLogs(checklist.id);
    }
}

function openChecklistPrintPreview(checklist: DischargeChecklist | null): void {
    if (!checklist?.id) return;

    window.open(`/inpatient-ward/discharge-checklists/${checklist.id}/print`, '_blank', 'noopener');
}

function closeChecklistDetails(): void {
    checklistDetailsOpen.value = false;
    checklistDetailsRecord.value = null;
    resetChecklistAuditState({ preserveFilters: true });
}

function openChecklistStatusFromDetails(): void {
    if (!checklistDetailsRecord.value) return;
    const checklist = checklistDetailsRecord.value;
    closeChecklistDetails();
    openStatusDialogFor('discharge_checklist', checklist);
}

function replaceCarePlan(updated: CarePlan): void {
    const existing = carePlans.value.find((plan) => plan.id === updated.id);
    carePlans.value = existing ? carePlans.value.map((plan) => (plan.id === updated.id ? updated : plan)) : [updated, ...carePlans.value];
    selectedAdmissionCarePlanRecords.value = selectedAdmissionCarePlanRecords.value.some((plan) => plan.id === updated.id)
        ? selectedAdmissionCarePlanRecords.value.map((plan) => (plan.id === updated.id ? updated : plan))
        : updated.admissionId === selectedAdmissionId.value
            ? [updated, ...selectedAdmissionCarePlanRecords.value]
            : selectedAdmissionCarePlanRecords.value;
    if (carePlanDetailsPlan.value?.id === updated.id) {
        carePlanDetailsPlan.value = updated;
    }
}

function replaceChecklist(updated: DischargeChecklist): void {
    const existing = checklists.value.find((checklist) => checklist.id === updated.id);
    checklists.value = existing ? checklists.value.map((checklist) => (checklist.id === updated.id ? updated : checklist)) : [updated, ...checklists.value];
    if (updated.admissionId === selectedAdmissionId.value) {
        selectedAdmissionChecklistRecord.value = updated;
    }
    if (checklistDetailsRecord.value?.id === updated.id) {
        checklistDetailsRecord.value = updated;

        if (checklistDetailsOpen.value && canViewInpatientWardAudit.value) {
            void loadChecklistAuditLogs(updated.id);
        }
    }
}

function openSelectedAdmission(admission: CensusRow | null, options?: { preserveFeedback?: boolean }): void {
    selectedAdmission.value = admission;
    selectedAdmissionId.value = admission?.id ?? '';
    clearFieldError('admissionId');
    selectedAdmissionTasks.value = [];
    selectedAdmissionRoundNoteRecords.value = [];
    selectedAdmissionCarePlanRecords.value = [];
    selectedAdmissionChecklistRecord.value = null;
    selectedAdmissionFollowUpRail.value = null;
    followUpRailError.value = null;
    documentationError.value = null;

    if (!selectedAdmissionId.value) {
        if (!options?.preserveFeedback) {
            documentationSuccess.value = null;
        }
        resetRoundNoteForm();
        resetCarePlanForm();
        resetChecklistForm();
        selectedDocumentationLoading.value = false;
        followUpRailLoading.value = false;
        return;
    }

    if (!options?.preserveFeedback) {
        documentationSuccess.value = null;
    }

    resetRoundNoteForm();
    resetCarePlanForm();
    resetChecklistForm();
    void loadSelectedAdmissionDocumentation(selectedAdmissionId.value, options);
    void loadSelectedAdmissionFollowUpRail(selectedAdmissionId.value);
}

function applyFilters(): void {
    taskFilters.priority = taskFilterDraft.priority;
    taskFilters.admissionId = taskFilterDraft.admissionId;
    taskFilters.page = 1;
    filterSheetOpen.value = false;
    void reloadQueue();
}

function resetFilters(): void {
    taskFilters.priority = '';
    taskFilters.admissionId = '';
    taskFilters.perPage = 25;
    taskFilters.page = 1;
    syncFilterDraft();
    filterSheetOpen.value = false;
    void reloadQueue();
}

async function submitTask(): Promise<void> {
    if (!ensureSelectedAdmission()) {
        return;
    }
    documentationSubmitting.value = true;
    try {
        const response = await apiRequest<{ data: WardTask }>('POST', '/inpatient-ward/tasks', {
            body: {
                admissionId: selectedAdmissionId.value,
                taskType: taskForm.taskType,
                title: taskForm.title.trim() || null,
                priority: taskForm.priority,
                assignedToUserId: taskForm.assignedToUserId.trim() ? Number.parseInt(taskForm.assignedToUserId.trim(), 10) : null,
                dueAt: taskForm.dueAt ? normalizeLocalDateTimeForApi(taskForm.dueAt) : null,
                notes: taskForm.notes.trim() || null,
            },
        });
        tasks.value = [response.data, ...tasks.value];
        selectedAdmissionTasks.value = [response.data, ...selectedAdmissionTasks.value];
        resetTaskForm();
        documentationSuccess.value = 'Ward task created.';
        documentationSheetOpen.value = false;
        notifySuccess('Ward task created.');
        await Promise.all([
            loadTaskCounts(),
            loadTasks(),
            loadBoardTasks(),
            loadSelectedAdmissionDocumentation(selectedAdmissionId.value, { preserveFeedback: true }),
        ]);
    } catch (error) {
        applyDocumentationApiError(error, 'Unable to create ward task.');
    } finally {
        documentationSubmitting.value = false;
    }
}

async function submitRoundNote(): Promise<void> {
    if (!ensureSelectedAdmission()) {
        return;
    }
    documentationSubmitting.value = true;
    try {
        await apiRequest('POST', '/inpatient-ward/round-notes', {
            body: {
                admissionId: selectedAdmissionId.value,
                roundedAt: roundNoteForm.roundedAt ? normalizeLocalDateTimeForApi(roundNoteForm.roundedAt) : null,
                shiftLabel: roundNoteForm.shiftLabel,
                roundNote: roundNoteForm.roundNote.trim(),
                carePlan: roundNoteForm.carePlan.trim() || null,
                handoffNotes: roundNoteForm.handoffNotes.trim() || null,
            },
        });
        resetRoundNoteForm();
        documentationSuccess.value = 'Round note recorded.';
        notifySuccess('Round note recorded.');
        await Promise.all([
            loadRoundNotes(),
            loadSelectedAdmissionDocumentation(selectedAdmissionId.value, { preserveFeedback: true }),
        ]);
    } catch (error) {
        applyDocumentationApiError(error, 'Unable to save round note.');
    } finally {
        documentationSubmitting.value = false;
    }
}

async function acknowledgeRoundNote(note: RoundNote): Promise<void> {
    if (!canAcknowledgeRoundNote(note)) {
        return;
    }

    roundNoteAcknowledgeLoadingId.value = note.id;
    documentationError.value = null;

    try {
        const response = await apiRequest<{ data: RoundNote }>('PATCH', `/inpatient-ward/round-notes/${note.id}/acknowledge`);
        replaceRoundNote(response.data);
        documentationSuccess.value = 'Shift handoff acknowledged.';
        notifySuccess('Shift handoff acknowledged.');
    } catch (error) {
        const message = messageFromUnknown(error, 'Unable to acknowledge the shift handoff.');
        documentationError.value = message;
        notifyError(message);
    } finally {
        roundNoteAcknowledgeLoadingId.value = null;
    }
}

async function submitCarePlan(): Promise<void> {
    if (!ensureSelectedAdmission()) {
        return;
    }
    documentationSubmitting.value = true;
    const body = {
        admissionId: selectedAdmissionId.value,
        title: carePlanForm.title.trim(),
        planText: carePlanForm.planText.trim() || null,
        goals: parseLines(carePlanForm.goalsText),
        interventions: parseLines(carePlanForm.interventionsText),
        reviewDueAt: carePlanForm.reviewDueAt ? normalizeLocalDateTimeForApi(carePlanForm.reviewDueAt) : null,
        targetDischargeAt: carePlanForm.targetDischargeAt ? normalizeLocalDateTimeForApi(carePlanForm.targetDischargeAt) : null,
    };
    try {
        const response = editableCarePlan.value && canUpdateCarePlan.value
            ? await apiRequest<{ data: CarePlan }>('PATCH', `/inpatient-ward/care-plans/${editableCarePlan.value.id}`, { body })
            : await apiRequest<{ data: CarePlan }>('POST', '/inpatient-ward/care-plans', { body });
        replaceCarePlan(response.data);
        documentationSuccess.value = editableCarePlan.value && canUpdateCarePlan.value ? 'Care plan updated.' : 'Care plan created.';
        documentationSheetOpen.value = false;
        notifySuccess(editableCarePlan.value && canUpdateCarePlan.value ? 'Care plan updated.' : 'Care plan created.');
        await loadSelectedAdmissionDocumentation(selectedAdmissionId.value, { preserveFeedback: true });
    } catch (error) {
        applyDocumentationApiError(error, 'Unable to save care plan.');
    } finally {
        documentationSubmitting.value = false;
    }
}

async function submitChecklist(): Promise<void> {
    if (!ensureSelectedAdmission()) {
        return;
    }
    if (['ready', 'completed'].includes(checklistForm.status) && !checklistReadyForSubmit.value) {
        setFieldError('status', 'Complete all seven items before moving the checklist to ready or completed.');
        return;
    }
    if (checklistForm.status === 'blocked' && !checklistForm.statusReason.trim()) {
        setFieldError('statusReason', 'Blocker note is required when the checklist is blocked.');
        return;
    }
    documentationSubmitting.value = true;
    const body = {
        admissionId: selectedAdmissionId.value,
        status: checklistForm.status,
        statusReason: checklistForm.statusReason.trim() || null,
        clinicalSummaryCompleted: checklistForm.clinicalSummaryCompleted,
        medicationReconciliationCompleted: checklistForm.medicationReconciliationCompleted,
        followUpPlanCompleted: checklistForm.followUpPlanCompleted,
        patientEducationCompleted: checklistForm.patientEducationCompleted,
        transportArranged: checklistForm.transportArranged,
        billingCleared: checklistForm.billingCleared,
        documentationCompleted: checklistForm.documentationCompleted,
        notes: checklistForm.notes.trim() || null,
    };
    try {
        const response = editableChecklist.value
            ? await apiRequest<{ data: DischargeChecklist }>('PATCH', `/inpatient-ward/discharge-checklists/${editableChecklist.value.id}`, { body })
            : await apiRequest<{ data: DischargeChecklist }>('POST', '/inpatient-ward/discharge-checklists', { body });
        replaceChecklist(response.data);
        documentationSuccess.value = editableChecklist.value ? 'Discharge checklist updated.' : 'Discharge checklist created.';
        documentationSheetOpen.value = false;
        notifySuccess(editableChecklist.value ? 'Discharge checklist updated.' : 'Discharge checklist created.');
        await loadSelectedAdmissionDocumentation(selectedAdmissionId.value, { preserveFeedback: true });
    } catch (error) {
        applyDocumentationApiError(error, 'Unable to save discharge checklist.');
    } finally {
        documentationSubmitting.value = false;
    }
}

function openStatusDialogFor(kind: 'task' | 'care_plan' | 'discharge_checklist', record: WardTask | CarePlan | DischargeChecklist): void {
    statusDialogKind.value = kind;
    statusDialogTarget.value = record;
    statusDialogStatus.value = String(record.status ?? '').trim().toLowerCase();
    statusDialogReason.value = String(record.statusReason ?? '').trim();
    statusDialogError.value = null;
    statusDialogOpen.value = true;
}

function closeStatusDialog(): void {
    statusDialogOpen.value = false;
    statusDialogTarget.value = null;
    statusDialogStatus.value = '';
    statusDialogReason.value = '';
    statusDialogError.value = null;
}

function openTaskAssignmentSheet(task: WardTask): void {
    taskAssignmentTarget.value = task;
    taskAssignmentUserId.value = task.assignedToUserId ? String(task.assignedToUserId) : '';
    taskAssignmentError.value = null;
    taskAssignmentSheetOpen.value = true;
}

function closeTaskAssignmentSheet(): void {
    taskAssignmentSheetOpen.value = false;
    taskAssignmentTarget.value = null;
    taskAssignmentUserId.value = '';
    taskAssignmentError.value = null;
}

const statusDialogOptions = computed(() => {
    if (statusDialogKind.value === 'task') return [...taskStatusOptions];
    if (statusDialogKind.value === 'care_plan') return [...carePlanStatusOptions];
    return [...dischargeChecklistStatusOptions];
});

const statusDialogReasonLabel = computed(() => {
    if (statusDialogKind.value === 'task') {
        if (statusDialogStatus.value === 'escalated') return 'Escalation note';
        if (statusDialogStatus.value === 'cancelled') return 'Cancellation note';
        return 'Status note';
    }
    if (statusDialogKind.value === 'care_plan') {
        return statusDialogStatus.value === 'cancelled' ? 'Cancellation note' : 'Status note';
    }
    return statusDialogStatus.value === 'blocked' ? 'Blocker note' : 'Status note';
});

const statusDialogBlockedReason = computed(() => {
    if (statusDialogKind.value !== 'discharge_checklist') return '';
    if (!['ready', 'completed'].includes(statusDialogStatus.value)) return '';
    return checklistReadyForSubmit.value ? '' : 'Complete all seven items before moving the checklist to ready or completed.';
});

async function submitStatusDialog(): Promise<void> {
    if (!statusDialogTarget.value) return;
    const reason = statusDialogReason.value.trim();
    if (statusDialogKind.value === 'task' && ['escalated', 'cancelled'].includes(statusDialogStatus.value) && !reason) {
        statusDialogError.value = `${statusDialogReasonLabel.value} is required.`;
        return;
    }
    if (statusDialogKind.value === 'care_plan' && statusDialogStatus.value === 'cancelled' && !reason) {
        statusDialogError.value = 'Cancellation note is required.';
        return;
    }
    if (statusDialogKind.value === 'discharge_checklist' && statusDialogStatus.value === 'blocked' && !reason) {
        statusDialogError.value = 'Blocker note is required.';
        return;
    }
    if (statusDialogBlockedReason.value) {
        statusDialogError.value = statusDialogBlockedReason.value;
        return;
    }
    actionLoadingId.value = statusDialogTarget.value.id;
    statusDialogError.value = null;
    try {
        if (statusDialogKind.value === 'task') {
            const response = await apiRequest<{ data: WardTask }>('PATCH', `/inpatient-ward/tasks/${statusDialogTarget.value.id}/status`, { body: { status: statusDialogStatus.value, reason: reason || null } });
            replaceTask(response.data);
            await loadTaskCounts();
        } else if (statusDialogKind.value === 'care_plan') {
            const response = await apiRequest<{ data: CarePlan }>('PATCH', `/inpatient-ward/care-plans/${statusDialogTarget.value.id}/status`, { body: { status: statusDialogStatus.value, reason: reason || null } });
            replaceCarePlan(response.data);
        } else {
            const response = await apiRequest<{ data: DischargeChecklist }>('PATCH', `/inpatient-ward/discharge-checklists/${statusDialogTarget.value.id}/status`, { body: { status: statusDialogStatus.value, reason: reason || null } });
            replaceChecklist(response.data);
            openSelectedAdmission(selectedAdmission.value);
        }
        notifySuccess('Ward workflow status updated.');
        closeStatusDialog();
    } catch (error) {
        const apiError = error as ApiError;
        statusDialogError.value = apiError.payload?.message ?? 'Unable to update status.';
    } finally {
        actionLoadingId.value = null;
    }
}

async function patchWardTask(task: WardTask, body: Record<string, unknown>): Promise<WardTask> {
    const response = await apiRequest<{ data: WardTask }>('PATCH', `/inpatient-ward/tasks/${task.id}`, { body });
    replaceTask(response.data);
    return response.data;
}

async function submitTaskAssignment(): Promise<void> {
    if (!taskAssignmentTarget.value) return;

    taskAssignmentSubmitting.value = true;
    taskAssignmentError.value = null;

    try {
        await patchWardTask(taskAssignmentTarget.value, {
            assignedToUserId: taskAssignmentUserId.value.trim() ? Number.parseInt(taskAssignmentUserId.value.trim(), 10) : null,
        });
        notifySuccess(taskAssignmentUserId.value.trim() ? 'Ward task assignment updated.' : 'Ward task assignment cleared.');
        closeTaskAssignmentSheet();
    } catch (error) {
        taskAssignmentError.value = messageFromUnknown(error, 'Unable to update ward task assignment.');
    } finally {
        taskAssignmentSubmitting.value = false;
    }
}

async function ensureTaskAssignedToCurrentUser(task: WardTask): Promise<WardTask> {
    if (currentUserId.value === null || taskAssignedToCurrentUser(task)) {
        return task;
    }

    return await patchWardTask(task, { assignedToUserId: currentUserId.value });
}

async function quickTakeTask(task: WardTask): Promise<void> {
    if (!taskCanTake(task)) return;

    actionLoadingId.value = task.id;
    try {
        await ensureTaskAssignedToCurrentUser(task);
        notifySuccess('Ward task assigned to you.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to assign this ward task to you.'));
    } finally {
        actionLoadingId.value = null;
    }
}

async function quickStartTask(task: WardTask): Promise<void> {
    if (!taskCanStartNow(task)) return;

    actionLoadingId.value = task.id;
    try {
        await ensureTaskAssignedToCurrentUser(task);
        const response = await apiRequest<{ data: WardTask }>('PATCH', `/inpatient-ward/tasks/${task.id}/status`, { body: { status: 'in_progress', reason: null } });
        replaceTask(response.data);
        await loadTaskCounts();
        notifySuccess('Ward task started.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to start this ward task.'));
    } finally {
        actionLoadingId.value = null;
    }
}

async function quickCompleteTask(task: WardTask): Promise<void> {
    if (!taskCanCompleteNow(task)) return;

    actionLoadingId.value = task.id;
    try {
        await ensureTaskAssignedToCurrentUser(task);
        const response = await apiRequest<{ data: WardTask }>('PATCH', `/inpatient-ward/tasks/${task.id}/status`, { body: { status: 'completed', reason: null } });
        replaceTask(response.data);
        await loadTaskCounts();
        notifySuccess('Ward task completed.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to complete this ward task.'));
    } finally {
        actionLoadingId.value = null;
    }
}

const queueStatusChips = computed(() => [
    { key: 'all', label: 'All tasks', count: taskCounts.value.total ?? 0 },
    { key: 'pending', label: 'Pending', count: taskCounts.value.pending ?? 0 },
    { key: 'in_progress', label: 'In progress', count: taskCounts.value.in_progress ?? 0 },
    { key: 'escalated', label: 'Escalated', count: taskCounts.value.escalated ?? 0 },
    { key: 'completed', label: 'Completed', count: taskCounts.value.completed ?? 0 },
]);

const taskAdvancedFilterCount = computed(() =>
    Number(Boolean(taskFilters.priority)) + Number(Boolean(taskFilters.admissionId)),
);

const taskQueueStateLabel = computed(() => {
    if (taskFilters.q.trim()) return 'Search active';
    if (taskAdvancedFilterCount.value > 0) return 'Filters active';
    return 'All ward tasks';
});

const taskQueueFilterChips = computed(() => {
    const chips: string[] = [];
    if (taskFilters.q.trim()) chips.push(`Search: ${taskFilters.q.trim()}`);
    if (taskFilters.status) chips.push(`Status: ${formatEnumLabel(taskFilters.status)}`);
    if (taskFilters.priority) chips.push(`Priority: ${formatEnumLabel(taskFilters.priority)}`);
    if (taskFilters.admissionId) chips.push(`Admission: ${taskFilters.admissionId}`);
    if (taskFilters.perPage !== 25) chips.push(`${taskFilters.perPage} rows`);
    if (compactQueueRows.value) chips.push('Compact view');
    return chips;
});

const scopeWarning = computed(() => {
    if (scope.value?.resolvedFrom === 'none') {
        return 'No tenant or facility scope is resolved. Ward requests may be limited until a valid scope is selected.';
    }

    if (!scope.value && !effectiveTenantCode.value && !effectiveFacilityCode.value) {
        return 'Current tenant and facility scope could not be loaded.';
    }

    return '';
});

const scopeStatusLabel = computed(() =>
    scopeWarning.value ? 'Scope Unresolved' : 'Scope Ready',
);
const boardOpenTasks = computed(() => boardTasks.value.filter((task) => taskIsOpen(task)));

const shiftCoordinationCards = computed(() => {
    const myTasks = boardOpenTasks.value.filter((task) => taskAssignedToCurrentUser(task));
    const myOverdueTasks = myTasks.filter((task) => taskIsOverdue(task));
    const unownedTasks = boardOpenTasks.value.filter((task) => !task.assignedToUserId);
    const ownedByOthers = boardOpenTasks.value.filter((task) => task.assignedToUserId && !taskAssignedToCurrentUser(task));

    return [
        { id: 'mine', title: 'My tasks', value: myTasks.length, helper: 'Open bedside work currently owned by you.', tone: myTasks.length > 0 ? 'default' : 'neutral' },
        { id: 'my-overdue', title: 'My overdue', value: myOverdueTasks.length, helper: 'Tasks you own that are already past due.', tone: myOverdueTasks.length > 0 ? 'danger' : 'neutral' },
        { id: 'unowned', title: 'Unowned', value: unownedTasks.length, helper: 'Open work still waiting for a named owner.', tone: unownedTasks.length > 0 ? 'warning' : 'neutral' },
        { id: 'owned-elsewhere', title: 'Assigned elsewhere', value: ownedByOthers.length, helper: 'Open work currently owned by another ward staff member.', tone: ownedByOthers.length > 0 ? 'default' : 'neutral' },
    ];
});

const shiftSummaryMessage = computed(() => {
    const myOverdue = shiftCoordinationCards.value.find((card) => card.id === 'my-overdue')?.value ?? 0;
    const unowned = shiftCoordinationCards.value.find((card) => card.id === 'unowned')?.value ?? 0;
    const ownedElsewhere = shiftCoordinationCards.value.find((card) => card.id === 'owned-elsewhere')?.value ?? 0;

    if (myOverdue > 0) return `You have ${myOverdue} overdue bedside ${myOverdue === 1 ? 'task' : 'tasks'} that need completion or escalation.`;
    if (unowned > 0) return `${unowned} open bedside ${unowned === 1 ? 'task is' : 'tasks are'} still waiting for ownership.`;
    if (ownedElsewhere > 0) return `${ownedElsewhere} open bedside ${ownedElsewhere === 1 ? 'task is' : 'tasks are'} already assigned to other ward staff in the current scope.`;
    return 'Shift ownership is balanced across the current active bedside workload.';
});

const shiftColumns = computed(() => {
    const openTasks = boardOpenTasks.value;
    const sortByUrgency = (items: WardTask[]) => items
        .slice()
        .sort((a, b) => {
            const aEscalated = normalizeTaskStatusValue(a) === 'escalated' ? 1 : 0;
            const bEscalated = normalizeTaskStatusValue(b) === 'escalated' ? 1 : 0;
            if (aEscalated !== bEscalated) return bEscalated - aEscalated;
            const aOverdue = taskIsOverdue(a) ? 1 : 0;
            const bOverdue = taskIsOverdue(b) ? 1 : 0;
            if (aOverdue !== bOverdue) return bOverdue - aOverdue;
            const aUnassigned = !a.assignedToUserId ? 1 : 0;
            const bUnassigned = !b.assignedToUserId ? 1 : 0;
            if (aUnassigned !== bUnassigned) return bUnassigned - aUnassigned;
            return new Date(taskTimelineAnchor(a) ?? 0).getTime() - new Date(taskTimelineAnchor(b) ?? 0).getTime();
        })
        .slice(0, 6);

    return [
        {
            key: 'action_now',
            title: 'Needs action now',
            helper: 'Escalated, overdue, or unassigned bedside work that should be touched first.',
            emptyLabel: 'No bedside tasks currently need immediate ward action.',
            tasks: sortByUrgency(openTasks.filter((task) => taskNeedsActionNow(task))),
        },
        {
            key: 'in_progress',
            title: 'Monitoring in progress',
            helper: 'Assigned bedside work already underway and not currently overdue or escalated.',
            emptyLabel: 'No active in-progress tasks are currently stable in scope.',
            tasks: sortByUrgency(openTasks.filter((task) => normalizeTaskStatusValue(task) === 'in_progress' && !taskNeedsActionNow(task))),
        },
        {
            key: 'pending',
            title: 'Pending routine',
            helper: 'Queued bedside work that is assigned or not yet urgent.',
            emptyLabel: 'No routine pending ward tasks are waiting in scope.',
            tasks: sortByUrgency(openTasks.filter((task) => normalizeTaskStatusValue(task) === 'pending' && !taskNeedsActionNow(task))),
        },
    ];
});

const bedsideTimeline = computed(() =>
    tasks.value
        .filter((task) => ['pending', 'in_progress', 'escalated'].includes(String(task.status ?? '').trim().toLowerCase()))
        .sort((a, b) => new Date(taskTimelineAnchor(a) ?? 0).getTime() - new Date(taskTimelineAnchor(b) ?? 0).getTime())
        .slice(0, 8),
);

const wardBedGroups = computed(() => {
    const occupantByPlacement = new Map<string, CensusRow>();
    censusRows.value.forEach((row) => {
        occupantByPlacement.set(`${String(row.ward ?? '').trim().toLowerCase()}::${String(row.bed ?? '').trim().toLowerCase()}`, row);
    });
    const wards = new Map<string, BedSlot[]>();
    wardBeds.value
        .slice()
        .sort((a, b) => `${a.wardName ?? ''}${a.bedNumber ?? a.name ?? ''}`.localeCompare(`${b.wardName ?? ''}${b.bedNumber ?? b.name ?? ''}`, undefined, { numeric: true, sensitivity: 'base' }))
        .forEach((resource) => {
            const wardName = resource.wardName?.trim() || 'Unassigned ward';
            const key = `${String(resource.wardName ?? '').trim().toLowerCase()}::${String(resource.bedNumber ?? resource.name ?? resource.code ?? '').trim().toLowerCase()}`;
            if (!wards.has(wardName)) wards.set(wardName, []);
            wards.get(wardName)?.push({ resource, admission: occupantByPlacement.get(key) ?? null });
        });
    return Array.from(wards.entries()).map(([wardName, slots]) => ({ wardName, slots }));
});

const boardSummaryCards = computed(() => {
    const openTasks = tasks.value.filter((task) => taskIsOpen(task));
    const overdueCount = openTasks.filter((task) => taskIsOverdue(task)).length;
    const escalatedCount = openTasks.filter((task) => normalizeTaskStatusValue(task) === 'escalated').length;
    const unassignedCount = openTasks.filter((task) => !task.assignedToUserId).length;
    const blockedCount = checklists.value.filter((checklist) => String(checklist.status ?? '').trim().toLowerCase() === 'blocked').length;
    const readyCount = checklists.value.filter((checklist) => checklist.isReadyForDischarge).length;

    return [
        { id: 'open', title: 'Open tasks', helper: 'Bedside work still active in the current ward scope.', value: openTasks.length, icon: 'clipboard-list', tone: 'default' },
        { id: 'overdue', title: 'Overdue', helper: 'Open tasks past due and needing immediate follow-through.', value: overdueCount, icon: 'clock-3', tone: overdueCount > 0 ? 'warning' : 'neutral' },
        { id: 'escalated', title: 'Escalated', helper: 'Items needing ward leadership or urgent clinical attention.', value: escalatedCount, icon: 'triangle-alert', tone: escalatedCount > 0 ? 'danger' : 'neutral' },
        { id: 'unassigned', title: 'Unassigned', helper: 'Open tasks without a responsible ward owner.', value: unassignedCount, icon: 'user-round-minus', tone: unassignedCount > 0 ? 'warning' : 'neutral' },
        { id: 'blocked', title: 'Blocked discharge', helper: 'Checklist records actively blocked from discharge progression.', value: blockedCount, icon: 'ban', tone: blockedCount > 0 ? 'danger' : 'neutral' },
        { id: 'ready', title: 'Ready for discharge', helper: 'Admissions with discharge readiness completed.', value: readyCount, icon: 'check-check', tone: readyCount > 0 ? 'success' : 'neutral' },
    ];
});

watch(() => taskFilters.page, () => { void loadTasks(); });
watch(() => selectedAdmissionId.value, (nextValue, previousValue) => {
    if (!nextValue && previousValue) {
        openSelectedAdmission(null, { preserveFeedback: true });
    }

    if (!nextValue) {
        documentationSheetOpen.value = false;
        return;
    }

    if (documentationFlowUsesSheet(documentationFlow.value)) {
        documentationSheetOpen.value = true;
    }
});

onMounted(async () => {
    if (!canRead.value) {
        pageLoading.value = false;
        return;
    }
    try {
        boardLoading.value = true;
        await Promise.all([loadCensus(), loadWardBeds(), loadTasks(), loadBoardTasks(), loadTaskCounts(), loadRoundNotes(), loadCarePlans(), loadChecklists(), loadAssigneeDirectory()]);
        if (selectedAdmissionId.value) {
            await Promise.all([
                loadSelectedAdmissionDocumentation(selectedAdmissionId.value, { preserveFeedback: true }),
                loadSelectedAdmissionFollowUpRail(selectedAdmissionId.value),
            ]);
        }
        syncFilterDraft();
    } catch (error) {
        pageError.value = messageFromUnknown(error, 'Unable to load Inpatient Ward.');
    } finally {
        boardLoading.value = false;
        pageLoading.value = false;
    }
});
async function refreshWardPage(): Promise<void> {
    if (!canRead.value || refreshingPage.value) return;

    refreshingPage.value = true;
    pageError.value = null;
    queueError.value = null;
    boardError.value = null;

    try {
        boardLoading.value = true;
        await Promise.all([loadCensus(), loadWardBeds(), loadTasks(), loadBoardTasks(), loadTaskCounts(), loadRoundNotes(), loadCarePlans(), loadChecklists(), loadAssigneeDirectory()]);
        if (selectedAdmissionId.value) {
            await Promise.all([
                loadSelectedAdmissionDocumentation(selectedAdmissionId.value, { preserveFeedback: true }),
                loadSelectedAdmissionFollowUpRail(selectedAdmissionId.value),
            ]);
        }
        syncFilterDraft();
    } catch (error) {
        pageError.value = messageFromUnknown(error, 'Unable to refresh Inpatient Ward.');
    } finally {
        boardLoading.value = false;
        refreshingPage.value = false;
    }
}
</script>
<template>
    <Head title='Inpatient Ward' />

    <AppLayout :breadcrumbs='breadcrumbs'>
        <div class='flex flex-col gap-6 px-4 py-4 md:px-6 md:py-6'>
            <section class='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                <div class='min-w-0'>
                    <h1 class='flex items-center gap-2 text-2xl font-semibold tracking-tight'>
                        <AppIcon name='bed-double' class='size-7 text-primary' />
                        Inpatient Ward Operations
                    </h1>
                    <p class='mt-1 text-sm text-muted-foreground'>Coordinate ward tasks, bed occupancy, care plans, discharge readiness, and bedside documentation from one operational surface.</p>
                </div>

                <div class='flex flex-wrap items-center gap-2'>
                    <Popover>
                        <PopoverTrigger as-child>
                            <Button variant='outline' size='sm' class='h-9 px-2.5'>
                                <Badge :variant='scopeWarning ? "destructive" : "secondary"'>
                                    {{ scopeStatusLabel }}
                                </Badge>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align='end' class='w-72 space-y-1 text-xs'>
                            <p v-if='scope?.tenant'>
                                Tenant: {{ scope.tenant.name || 'Tenant' }} ({{ scope.tenant.code || effectiveTenantCode || 'n/a' }})
                            </p>
                            <p v-else-if='effectiveTenantCode'>
                                Tenant code: {{ effectiveTenantCode }}
                            </p>
                            <p v-if='scope?.facility'>
                                Facility: {{ scope.facility.name || 'Facility' }} ({{ scope.facility.code || effectiveFacilityCode || 'n/a' }})
                            </p>
                            <p v-else-if='effectiveFacilityCode'>
                                Facility code: {{ effectiveFacilityCode }}
                            </p>
                            <p class='text-muted-foreground'>
                                Resolved from: {{ scope?.resolvedFrom || 'shared context unavailable' }}
                            </p>
                            <p v-if='isFacilitySuperAdmin' class='text-muted-foreground'>
                                Access: Facility super admin
                            </p>
                            <p v-if='scopeWarning' class='text-destructive'>
                                {{ scopeWarning }}
                            </p>
                        </PopoverContent>
                    </Popover>
                    <Button variant='outline' size='sm' class='h-9 gap-1.5' :disabled='refreshingPage || pageLoading' @click='refreshWardPage'>
                        <AppIcon name='refresh-cw' class='size-3.5' />
                        {{ refreshingPage ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                    <Button :variant='workspaceView === "queue" ? "default" : "outline"' size='sm' class='h-9 gap-1.5' :aria-pressed='workspaceView === "queue"' @click='workspaceView = "queue"'>
                        <AppIcon name='clipboard-list' class='size-4' />
                        Ward Queue
                    </Button>
                    <Button :variant='workspaceView === "board" ? "default" : "outline"' size='sm' class='h-9 gap-1.5' :aria-pressed='workspaceView === "board"' @click='workspaceView = "board"'>
                        <AppIcon name='layout-dashboard' class='size-4' />
                        Ward Board
                    </Button>
                    <Button :variant='workspaceView === "documentation" ? "default" : "outline"' size='sm' class='h-9 gap-1.5' :aria-pressed='workspaceView === "documentation"' @click='workspaceView = "documentation"'>
                        <AppIcon name='file-pen-line' class='size-4' />
                        Ward Documentation
                    </Button>
                </div>
            </section>

            <Alert v-if='scopeWarning' variant='destructive'>
                <AppIcon name='triangle-alert' class='size-4' />
                <AlertTitle>Scope warning</AlertTitle>
                <AlertDescription>{{ scopeWarning }}</AlertDescription>
            </Alert>

            <Alert v-if='pageError' variant='destructive'>
                <AppIcon name='triangle-alert' class='size-4' />
                <AlertTitle>Ward page load issue</AlertTitle>
                <AlertDescription>{{ pageError }}</AlertDescription>
            </Alert>

            <template v-if='canRead'>
                <section v-if='workspaceView === "queue"' class='space-y-4'>
                    <div class='space-y-3 rounded-lg border bg-muted/30 px-3 py-2 dark:bg-muted/10'>
                        <div class='grid gap-2 md:grid-cols-2 xl:grid-cols-4'>
                            <div v-for='card in shiftCoordinationCards' :key='`queue-${card.id}`' :class='["rounded-lg border px-3 py-2.5", summaryToneClass(card.tone)]'>
                                <div class='flex items-start justify-between gap-3'>
                                    <div class='min-w-0'>
                                        <p class='text-sm font-medium text-foreground'>{{ card.title }}</p>
                                        <p class='mt-1 text-xs text-muted-foreground'>{{ card.helper }}</p>
                                    </div>
                                    <p class='text-xl font-semibold text-foreground'>{{ card.value }}</p>
                                </div>
                            </div>
                        </div>
                        <div class='flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between'>
                            <div class='flex flex-wrap gap-2'>
                                <Button
                                    v-for='chip in queueStatusChips'
                                    :key='chip.key'
                                    size='sm'
                                    :variant='taskFilters.status === (chip.key === "all" ? "" : chip.key) ? "default" : "outline"'
                                    class='h-9 gap-1.5'
                                    @click='taskFilters.status = chip.key === "all" ? "" : chip.key; taskFilters.page = 1; void reloadQueue()'
                                >
                                    <span>{{ chip.label }}</span>
                                    <Badge variant='secondary' class='rounded-full px-1.5 py-0 text-xs'>{{ chip.count }}</Badge>
                                </Button>
                            </div>
                            <div class='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                                <Badge variant='secondary'>{{ taskQueueStateLabel }}</Badge>
                                <Badge variant='outline'>{{ shiftSummaryMessage }}</Badge>
                                <Badge v-if='taskAdvancedFilterCount' variant='outline'>{{ taskAdvancedFilterCount }} filters</Badge>
                            </div>
                        </div>
                    </div>

                    <Card class='rounded-lg border-sidebar-border/70'>
                        <CardHeader class='gap-4 border-b pb-4'>
                            <div class='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                                <div class='min-w-0'>
                                    <CardTitle class='flex items-center gap-2'>
                                        <AppIcon name='clipboard-list' class='size-5 text-muted-foreground' />
                                        Ward Task Queue
                                    </CardTitle>
                                    <CardDescription>Search active ward work, review priority, and update bedside task status without leaving the queue.</CardDescription>
                                </div>
                                <div class='flex w-full flex-col gap-2'>
                                    <div class='flex w-full flex-col gap-2 xl:flex-row xl:items-center'>
                                        <div class='relative min-w-0 flex-1'>
                                            <AppIcon
                                                name='search'
                                                class='pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground'
                                            />
                                            <Input
                                                v-model='taskFilters.q'
                                                class='h-9 pl-9'
                                                placeholder='Search task number, patient, admission, ward, or notes'
                                                @keydown.enter.prevent='taskFilters.page = 1; void reloadQueue()'
                                            />
                                        </div>
                                        <div class='flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap'>
                                            <Button variant='outline' size='sm' class='h-9 gap-1.5' @click='syncFilterDraft(); filterSheetOpen = true'>
                                                <AppIcon name='sliders-horizontal' class='size-3.5' />
                                                All filters
                                                <Badge v-if='taskAdvancedFilterCount' variant='secondary' class='ml-1 text-xs'>
                                                    {{ taskAdvancedFilterCount }}
                                                </Badge>
                                            </Button>
                                            <Popover>
                                                <PopoverTrigger as-child>
                                                    <Button variant='outline' size='sm' class='h-9 gap-1.5'>
                                                        <AppIcon name='eye' class='size-3.5' />
                                                        View
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent align='end' class='w-72 space-y-4'>
                                                    <div class='grid gap-2'>
                                                        <Label for='ward-task-per-page'>Results per page</Label>
                                                        <Select :model-value='String(taskFilters.perPage)' @update:model-value='(value) => { taskFilters.perPage = Number(value); taskFilters.page = 1; void reloadQueue(); }'>
                                                            <SelectTrigger id='ward-task-per-page' class='w-full min-w-0 justify-between bg-background dark:bg-background'>
                                                                <SelectValue placeholder='Results per page' />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value='10'>10</SelectItem>
                                                                <SelectItem value='25'>25</SelectItem>
                                                                <SelectItem value='50'>50</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div class='grid gap-2'>
                                                        <Label>Row density</Label>
                                                        <div class='grid grid-cols-2 gap-2'>
                                                            <Button
                                                                variant='outline'
                                                                size='sm'
                                                                :class='compactQueueRows ? "" : "border-primary bg-primary/5 text-foreground dark:border-primary/40 dark:bg-primary/15"'
                                                                @click='compactQueueRows = false'
                                                            >
                                                                Comfortable
                                                            </Button>
                                                            <Button
                                                                variant='outline'
                                                                size='sm'
                                                                :class='compactQueueRows ? "border-primary bg-primary/5 text-foreground dark:border-primary/40 dark:bg-primary/15" : ""'
                                                                @click='compactQueueRows = true'
                                                            >
                                                                Compact
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                                <Badge variant='secondary'>{{ taskQueueStateLabel }}</Badge>
                                <Badge v-for='chip in taskQueueFilterChips' :key='chip' variant='outline'>{{ chip }}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent class='p-0'>
                            <template v-if='queueError'>
                                <div class='p-4'>
                                    <Alert variant='destructive'>
                                        <AppIcon name='triangle-alert' class='size-4' />
                                        <AlertDescription>{{ queueError }}</AlertDescription>
                                    </Alert>
                                </div>
                            </template>
                            <template v-else-if='pageLoading || (queueLoading && tasks.length === 0)'>
                                <div class='space-y-2 p-4'>
                                    <Skeleton class='h-20 w-full rounded-lg' />
                                    <Skeleton class='h-20 w-full rounded-lg' />
                                    <Skeleton class='h-20 w-full rounded-lg' />
                                </div>
                            </template>
                            <template v-else-if='tasks.length > 0'>
                                <div class='divide-y'>
                                    <div v-for='task in tasks' :key='task.id' :class='["grid gap-3 px-4", compactQueueRows ? "py-3" : "py-4"]'>
                                        <div class='flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between'>
                                            <div class='min-w-0 space-y-1.5'>
                                                <div class='flex flex-wrap items-center gap-2'>
                                                    <p class='font-medium text-foreground'>{{ task.taskNumber || 'Ward task' }}</p>
                                                    <Badge :variant='formatStatusVariant(task.status)'>{{ formatEnumLabel(task.status) }}</Badge>
                                                    <Badge variant='outline'>{{ formatEnumLabel(task.priority) }}</Badge>
                                                    <Badge variant='outline'>{{ formatEnumLabel(task.taskType) }}</Badge>
                                                </div>
                                                <p class='text-sm text-foreground'>{{ task.title || 'Untitled bedside task' }}</p>
                                                <p class='text-xs text-muted-foreground'>{{ patientLabel(task) }} | {{ patientMeta(task) }}</p>
                                            </div>
                                            <div class='flex flex-wrap items-center gap-2'>
                                                <Badge variant='outline'>Due {{ formatDateTime(task.dueAt) }}</Badge>
                                                <Badge v-if='taskAssignedToCurrentUser(task)' variant='secondary'>Assigned to you</Badge>
                                                <Badge v-else-if='task.assignedToUserId' variant='outline'>{{ assigneeDisplayLabel(task.assignedToUserId) }}</Badge>
                                                <Badge v-else variant='outline'>Unowned</Badge>
                                                <Button v-if='taskCanTake(task)' size='sm' variant='outline' class='gap-1.5' :disabled='actionLoadingId === task.id' @click='quickTakeTask(task)'>
                                                    <AppIcon name='user-plus' class='size-3.5' />
                                                    Take task
                                                </Button>
                                                <Button v-if='taskCanStartNow(task)' size='sm' variant='outline' class='gap-1.5' :disabled='actionLoadingId === task.id' @click='quickStartTask(task)'>
                                                    <AppIcon name='play' class='size-3.5' />
                                                    Start now
                                                </Button>
                                                <Button v-if='taskCanCompleteNow(task)' size='sm' variant='outline' class='gap-1.5' :disabled='actionLoadingId === task.id' @click='quickCompleteTask(task)'>
                                                    <AppIcon name='check-check' class='size-3.5' />
                                                    Complete
                                                </Button>
                                                <Button v-if='taskCanReassign(task)' size='sm' variant='outline' class='gap-1.5' :disabled='actionLoadingId === task.id' @click='openTaskAssignmentSheet(task)'>
                                                    <AppIcon name='users' class='size-3.5' />
                                                    Reassign
                                                </Button>
                                                <Button size='sm' variant='outline' class='gap-1.5' @click='openTaskDetails(task)'>
                                                    <AppIcon name='eye' class='size-3.5' />
                                                    Open task
                                                </Button>
                                                <Button v-if='canUpdateTaskStatus' size='sm' class='gap-1.5' :disabled='actionLoadingId === task.id' @click='openStatusDialogFor("task", task)'>
                                                    <AppIcon name='refresh-cw' class='size-3.5' />
                                                    Update status
                                                </Button>
                                            </div>
                                        </div>
                                        <div class='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
                                            <span>Admission {{ admissionLabel(task) }}</span>
                                            <span>{{ taskOwnerDetail(task) }}</span>
                                            <span>Started {{ formatDateTime(task.startedAt) }}</span>
                                            <span>Completed {{ formatDateTime(task.completedAt) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </template>
                            <div v-else class='p-6 text-center text-sm text-muted-foreground'>No ward tasks match the current queue scope.</div>
                        </CardContent>
                        <div class='flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between'>
                            <p>Showing {{ tasks.length }} of {{ taskPagination?.total ?? tasks.length }} ward tasks</p>
                            <div class='flex items-center gap-2'>
                                <Button variant='outline' size='sm' :disabled='(taskPagination?.currentPage ?? 1) <= 1 || queueLoading' @click='taskFilters.page = Math.max((taskPagination?.currentPage ?? 1) - 1, 1)'>Previous</Button>
                                <span>Page {{ taskPagination?.currentPage ?? 1 }} of {{ taskPagination?.lastPage ?? 1 }}</span>
                                <Button variant='outline' size='sm' :disabled='(taskPagination?.currentPage ?? 1) >= (taskPagination?.lastPage ?? 1) || queueLoading' @click='taskFilters.page = Math.min((taskPagination?.currentPage ?? 1) + 1, taskPagination?.lastPage ?? 1)'>Next</Button>
                            </div>
                        </div>
                    </Card>
                </section>

                <section v-else-if='workspaceView === "board"' class='space-y-4'>
                    <Card class='rounded-lg border-sidebar-border/70'>
                        <CardHeader class='pb-3'>
                            <div class='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                                <div class='min-w-0'>
                                    <CardTitle class='flex items-center gap-2'>
                                        <AppIcon name='layout-dashboard' class='size-5 text-muted-foreground' />
                                        Ward Board
                                    </CardTitle>
                                    <CardDescription>{{ boardTab === 'shift' ? 'Monitor active ward workload, escalations, and the bedside task timeline.' : 'Review care-plan progress, discharge readiness, and current inpatient placement below.' }}</CardDescription>
                                </div>
                                <div class='flex items-center gap-2 text-xs text-muted-foreground'>
                                    <Badge variant='outline'>{{ wardBeds.length }} beds configured</Badge>
                                    <Badge variant='outline'>{{ censusRows.length }} active inpatients</Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent class='space-y-4'>
                            <div class='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                                <div v-for='card in boardSummaryCards' :key='card.id' :class="[
                                    'rounded-lg border px-4 py-3',
                                    card.tone === 'danger'
                                        ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20'
                                        : card.tone === 'warning'
                                            ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20'
                                            : card.tone === 'success'
                                                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                                                : 'border-border/70 bg-background/70 dark:bg-background/40'
                                ]">
                                    <div class='flex items-start justify-between gap-3'>
                                        <div class='min-w-0'>
                                            <div class='flex items-center gap-2'>
                                                <AppIcon :name='card.icon' class='size-4 text-muted-foreground' />
                                                <p class='text-sm font-medium text-foreground'>{{ card.title }}</p>
                                            </div>
                                            <p class='mt-1 text-xs text-muted-foreground'>{{ card.helper }}</p>
                                        </div>
                                        <p class='text-2xl font-semibold text-foreground'>{{ card.value }}</p>
                                    </div>
                                </div>
                            </div>
                            <div class='grid gap-2 md:grid-cols-2 xl:grid-cols-4'>
                                <div v-for='card in shiftCoordinationCards' :key='`board-${card.id}`' :class='["rounded-lg border px-3 py-2.5", summaryToneClass(card.tone)]'>
                                    <div class='flex items-start justify-between gap-3'>
                                        <div class='min-w-0'>
                                            <p class='text-sm font-medium text-foreground'>{{ card.title }}</p>
                                            <p class='mt-1 text-xs text-muted-foreground'>{{ card.helper }}</p>
                                        </div>
                                        <p class='text-xl font-semibold text-foreground'>{{ card.value }}</p>
                                    </div>
                                </div>
                            </div>
                            <div class='rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm dark:bg-muted/10'>
                                <div class='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
                                    <p class='font-medium text-foreground'>Shift summary</p>
                                    <p class='text-muted-foreground'>{{ shiftSummaryMessage }}</p>
                                </div>
                            </div>
                            <Tabs v-model='boardTab' class='w-full'>
                                <div class='space-y-2'>
                                    <TabsList class='grid h-auto w-full grid-cols-2 gap-1 rounded-lg bg-muted/70 dark:bg-muted/20 sm:w-auto'>
                                        <TabsTrigger value='shift' class='inline-flex min-h-10 items-center justify-center gap-1.5 px-2 text-xs sm:text-sm data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-border/50 dark:data-[state=active]:bg-background/80 dark:data-[state=active]:text-foreground'>
                                            <AppIcon name='activity' class='size-3.5' />
                                            Shift pressure
                                        </TabsTrigger>
                                        <TabsTrigger value='discharge' class='inline-flex min-h-10 items-center justify-center gap-1.5 px-2 text-xs sm:text-sm data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-border/50 dark:data-[state=active]:bg-background/80 dark:data-[state=active]:text-foreground'>
                                            <AppIcon name='check-check' class='size-3.5' />
                                            Discharge planning
                                        </TabsTrigger>
                                    </TabsList>
                                    <p class='text-xs text-muted-foreground'>
                                        {{ boardTab === 'shift' ? 'Monitor active task pressure, escalations, and bedside work here.' : 'Review care plans, discharge blockers, and readiness here.' }}
                                    </p>
                                </div>
                                <TabsContent value='shift' class='mt-3 space-y-3'>
                                    <div class='grid gap-3 xl:grid-cols-3'>
                                        <Card v-for='column in shiftColumns' :key='column.key' class='rounded-lg border-border/70'>
                                            <CardHeader class='pb-2'>
                                                <CardTitle class='text-sm'>{{ column.title }}</CardTitle>
                                                <CardDescription class='text-xs'>{{ column.helper }}</CardDescription>
                                            </CardHeader>
                                            <CardContent class='space-y-2'>
                                                <template v-if='column.tasks.length > 0'>
                                                    <div v-for='task in column.tasks' :key='`${column.key}-${task.id}`' :class='["rounded-lg border p-3 text-sm transition hover:border-primary/40 cursor-pointer", boardTaskToneClass(task)]' role='button' tabindex='0' @click='openTaskDetails(task)' @keydown.enter.prevent='openTaskDetails(task)' @keydown.space.prevent='openTaskDetails(task)'>
                                                        <div class='flex items-start justify-between gap-2'>
                                                            <div class='min-w-0'>
                                                                <p class='truncate font-medium'>{{ task.taskNumber }}</p>
                                                                <p class='text-xs text-muted-foreground'>{{ formatEnumLabel(task.taskType) }} | {{ task.title || 'Untitled task' }}</p>
                                                            </div>
                                                            <Badge variant='outline'>{{ formatEnumLabel(task.priority) }}</Badge>
                                                        </div>
                                                        <p class='mt-2 text-xs text-muted-foreground'>{{ admissionLabel(task) }} | {{ formatDateTime(taskTimelineAnchor(task)) }}</p>
                                                        <div v-if='taskActionReasons(task).length > 0' class='mt-2 flex flex-wrap gap-1.5 text-xs'>
                                                            <Badge v-for='reason in taskActionReasons(task)' :key='`${task.id}-${reason}`' :variant='reason === "Escalated" ? "destructive" : "outline"'>{{ reason }}</Badge>
                                                        </div>
                                                        <div class='mt-3 flex flex-wrap items-center gap-2 text-xs'>
                                                            <Badge v-if='taskAssignedToCurrentUser(task)' variant='secondary'>Assigned to you</Badge>
                                                            <Badge v-else-if='task.assignedToUserId' variant='outline'>{{ assigneeDisplayLabel(task.assignedToUserId) }}</Badge>
                                                            <Badge v-else variant='outline'>Unowned</Badge>
                                                            <Button v-if='taskCanTake(task)' size='sm' variant='outline' class='h-7 gap-1 px-2 text-xs' :disabled='actionLoadingId === task.id' @click.stop='quickTakeTask(task)'>Take</Button>
                                                            <Button v-if='column.key === "action_now" && taskCanReassign(task)' size='sm' variant='outline' class='h-7 gap-1 px-2 text-xs' :disabled='actionLoadingId === task.id' @click.stop='openTaskAssignmentSheet(task)'>Reassign</Button>
                                                            <Button v-if='taskCanStartNow(task)' size='sm' variant='outline' class='h-7 gap-1 px-2 text-xs' :disabled='actionLoadingId === task.id' @click.stop='quickStartTask(task)'>Start</Button>
                                                            <Button v-if='taskCanCompleteNow(task)' size='sm' variant='outline' class='h-7 gap-1 px-2 text-xs' :disabled='actionLoadingId === task.id' @click.stop='quickCompleteTask(task)'>Complete</Button>
                                                        </div>
                                                    </div>
                                                </template>
                                                <p v-else class='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>{{ column.emptyLabel }}</p>
                                            </CardContent>
                                        </Card>
                                    </div>
                                    <Card class='rounded-lg border-border/70'>
                                        <CardHeader class='pb-2'>
                                            <CardTitle class='text-sm'>Bedside Task Timeline</CardTitle>
                                            <CardDescription class='text-xs'>Next due and most recent active ward tasks across the current queue scope.</CardDescription>
                                        </CardHeader>
                                        <CardContent class='space-y-3'>
                                            <template v-if='bedsideTimeline.length > 0'>
                                                <div v-for='(task, index) in bedsideTimeline' :key='`timeline-${task.id}`' class='relative pl-6'>
                                                    <span class='absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-primary/80' />
                                                    <span v-if='index < bedsideTimeline.length - 1' class='absolute left-[4px] top-4 h-[calc(100%+0.25rem)] w-px bg-border' />
                                                    <div class='rounded-lg border border-border/70 bg-background/70 p-3 transition hover:border-primary/40 cursor-pointer' role='button' tabindex='0' @click='openTaskDetails(task)' @keydown.enter.prevent='openTaskDetails(task)' @keydown.space.prevent='openTaskDetails(task)'>
                                                        <div class='flex items-start justify-between gap-2'>
                                                            <div class='min-w-0'>
                                                                <p class='truncate text-sm font-medium'>{{ task.taskNumber }}</p>
                                                                <p class='text-xs text-muted-foreground'>{{ formatEnumLabel(task.taskType) }} | {{ task.title || 'Untitled task' }}</p>
                                                            </div>
                                                            <Badge :variant='formatStatusVariant(task.status)'>{{ formatEnumLabel(task.status) }}</Badge>
                                                        </div>
                                                        <p class='mt-2 text-xs text-muted-foreground'>{{ admissionLabel(task) }} | {{ formatDateTime(taskTimelineAnchor(task)) }}</p>
                                                    </div>
                                                </div>
                                            </template>
                                            <p v-else class='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>No bedside timeline anchors are available in the current task scope.</p>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                                <TabsContent value='discharge' class='mt-3 space-y-3'>
                                    <div class='grid gap-3 md:grid-cols-3'>
                                        <div class='rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/20'>
                                            <p class='text-sm font-medium text-foreground'>Blocked discharges</p>
                                            <p class='mt-1 text-2xl font-semibold text-foreground'>{{ checklists.filter((checklist) => String(checklist.status ?? '').trim().toLowerCase() === 'blocked').length }}</p>
                                            <p class='mt-1 text-xs text-muted-foreground'>Admissions that cannot progress until blockers are cleared.</p>
                                        </div>
                                        <div class='rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/20'>
                                            <p class='text-sm font-medium text-foreground'>Ready for discharge</p>
                                            <p class='mt-1 text-2xl font-semibold text-foreground'>{{ checklists.filter((checklist) => checklist.isReadyForDischarge).length }}</p>
                                            <p class='mt-1 text-xs text-muted-foreground'>Admissions that can move forward once discharge is confirmed.</p>
                                        </div>
                                        <div class='rounded-lg border border-border/70 bg-background/70 px-4 py-3 dark:bg-background/40'>
                                            <p class='text-sm font-medium text-foreground'>Care-plan reviews due</p>
                                            <p class='mt-1 text-2xl font-semibold text-foreground'>{{ carePlans.filter((plan) => String(plan.status ?? '').trim().toLowerCase() === 'active' && plan.reviewDueAt && new Date(plan.reviewDueAt).getTime() < Date.now()).length }}</p>
                                            <p class='mt-1 text-xs text-muted-foreground'>Active plans that need clinician or nursing review attention.</p>
                                        </div>
                                    </div>
                                    <div class='grid gap-3 xl:grid-cols-2'>
                                        <Card class='rounded-lg border-border/70'>
                                            <CardHeader class='pb-2'>
                                                <CardTitle class='text-sm'>Inpatient Care Plans</CardTitle>
                                                <CardDescription class='text-xs'>Active and recently updated ward plans that drive next clinical steps.</CardDescription>
                                            </CardHeader>
                                            <CardContent class='space-y-2'>
                                                <template v-if='carePlans.length > 0'>
                                                    <div v-for='plan in carePlans.slice(0, 8)' :key='plan.id' class='rounded-lg border p-3'>
                                                        <div class='flex items-start justify-between gap-2'>
                                                            <div class='min-w-0'>
                                                                <p class='truncate text-sm font-medium'>{{ plan.title || plan.carePlanNumber || 'Care plan' }}</p>
                                                                <p class='text-xs text-muted-foreground'>{{ patientLabel(plan) }} | {{ admissionLabel(plan) }}</p>
                                                            </div>
                                                            <Badge :variant='formatStatusVariant(plan.status)'>{{ formatEnumLabel(plan.status) }}</Badge>
                                                        </div>
                                                        <p class='mt-2 text-xs text-muted-foreground'>Review due {{ formatDateTime(plan.reviewDueAt) }} | Target discharge {{ formatDateTime(plan.targetDischargeAt) }}</p>
                                                        <div class='mt-3 flex justify-end gap-2'>
                                                            <Button size='sm' variant='outline' class='gap-1.5' @click='openCarePlanDetails(plan)'>
                                                                <AppIcon name='eye' class='size-3.5' />
                                                                Open care plan
                                                            </Button>
                                                            <Button v-if='canUpdateCarePlanStatus' size='sm' variant='outline' class='gap-1.5' @click='openStatusDialogFor("care_plan", plan)'>
                                                                <AppIcon name='refresh-cw' class='size-3.5' />
                                                                Update status
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </template>
                                                <p v-else class='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>No care plans are currently in scope for discharge planning.</p>
                                            </CardContent>
                                        </Card>
                                        <Card class='rounded-lg border-border/70'>
                                            <CardHeader class='pb-2'>
                                                <CardTitle class='text-sm'>Discharge Checklists</CardTitle>
                                                <CardDescription class='text-xs'>Track readiness, blockers, and completion on active inpatient discharges.</CardDescription>
                                            </CardHeader>
                                            <CardContent class='space-y-2'>
                                                <template v-if='checklists.length > 0'>
                                                    <div v-for='checklist in checklists.slice(0, 8)' :key='checklist.id' class='rounded-lg border p-3'>
                                                        <div class='flex items-start justify-between gap-2'>
                                                            <div class='min-w-0'>
                                                                <p class='truncate text-sm font-medium'>{{ patientLabel(checklist) }}</p>
                                                                <p class='text-xs text-muted-foreground'>{{ admissionLabel(checklist) }} | {{ checklistCompletionCount(checklist) }}/7 items complete</p>
                                                            </div>
                                                            <Badge :variant='formatStatusVariant(checklist.status)'>{{ formatEnumLabel(checklist.status) }}</Badge>
                                                        </div>
                                                        <p class='mt-2 text-xs text-muted-foreground'>Ready for discharge {{ checklist.isReadyForDischarge ? 'Yes' : 'No' }} | Reviewed {{ formatDateTime(checklist.reviewedAt) }}</p>
                                                        <div class='mt-3 flex justify-end gap-2'>
                                                            <Button size='sm' variant='outline' @click='openChecklistPrintPreview(checklist)'>
                                                                Print summary
                                                            </Button>
                                                            <Button size='sm' variant='outline' class='gap-1.5' @click='openChecklistDetails(checklist)'>
                                                                <AppIcon name='eye' class='size-3.5' />
                                                                Open checklist
                                                            </Button>
                                                            <Button v-if='canManageDischargeChecklist' size='sm' variant='outline' class='gap-1.5' @click='openStatusDialogFor("discharge_checklist", checklist)'>
                                                                <AppIcon name='refresh-cw' class='size-3.5' />
                                                                Update status
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </template>
                                                <p v-else class='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>No discharge checklists are currently in scope.</p>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <Card class='rounded-lg border-sidebar-border/70'>
                        <CardHeader class='pb-2'>
                            <div class='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                                <div class='min-w-0'>
                                    <CardTitle class='flex items-center gap-2'>
                                        <AppIcon name='bed-double' class='size-5 text-muted-foreground' />
                                        Current Inpatient Census
                                    </CardTitle>
                                    <CardDescription>Placement and occupancy view for active inpatient beds and receiving-unit coverage.</CardDescription>
                                </div>
                                <div class='flex items-center gap-2 text-xs text-muted-foreground'>
                                    <Badge variant='outline'>Active inpatients {{ censusRows.length }}</Badge>
                                    <Badge variant='outline'>Configured beds {{ wardBeds.length }}</Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent class='space-y-4'>
                            <template v-if='boardError'>
                                <Alert variant='destructive'>
                                    <AppIcon name='triangle-alert' class='size-4' />
                                    <AlertDescription>{{ boardError }}</AlertDescription>
                                </Alert>
                            </template>
                            <template v-else-if='pageLoading || (boardLoading && wardBedGroups.length === 0)'>
                                <div class='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                                    <Skeleton class='h-36 w-full rounded-lg' />
                                    <Skeleton class='h-36 w-full rounded-lg' />
                                    <Skeleton class='h-36 w-full rounded-lg' />
                                    <Skeleton class='h-36 w-full rounded-lg' />
                                    <Skeleton class='h-36 w-full rounded-lg' />
                                    <Skeleton class='h-36 w-full rounded-lg' />
                                </div>
                            </template>
                            <template v-else-if='wardBedGroups.length > 0'>
                                <div class='space-y-4'>
                                    <div v-for='ward in wardBedGroups' :key='ward.wardName' class='space-y-3'>
                                        <div>
                                            <h3 class='text-sm font-semibold'>{{ ward.wardName }}</h3>
                                            <p class='text-xs text-muted-foreground'>{{ ward.slots.filter((slot) => slot.admission).length }} occupied | {{ ward.slots.length }} configured beds</p>
                                        </div>
                                        <div class='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                                            <div v-for='slot in ward.slots' :key='slot.resource.id' :class='["rounded-lg border p-3", slot.admission ? "border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/10" : String(slot.resource.status ?? "").trim().toLowerCase() === "maintenance" ? "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20" : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20"]'>
                                                <div class='flex items-start justify-between gap-3'>
                                                    <div class='min-w-0'>
                                                        <div class='flex items-center gap-2'>
                                                            <AppIcon name='bed-double' class='size-4 text-muted-foreground' />
                                                            <p class='font-medium'>{{ slot.resource.bedNumber || slot.resource.name || slot.resource.code || 'Bed' }}</p>
                                                        </div>
                                                        <div class='mt-2 flex flex-wrap gap-1.5'>
                                                            <Badge variant='outline'>{{ slot.resource.wardName || 'Ward' }}</Badge>
                                                            <Badge v-if='slot.resource.location' variant='outline'>{{ slot.resource.location }}</Badge>
                                                        </div>
                                                    </div>
                                                    <Badge :variant='slot.admission ? "default" : formatStatusVariant(slot.resource.status)'>{{ slot.admission ? String(slot.admission.status ?? '').trim().toLowerCase() === 'transferred' ? 'Transferred in' : 'Occupied' : String(slot.resource.status ?? '').trim().toLowerCase() === 'maintenance' ? 'Maintenance' : 'Available' }}</Badge>
                                                </div>
                                                <div v-if='slot.admission' class='mt-3 space-y-1'>
                                                    <p class='truncate text-sm font-medium'>{{ slot.admission.patientName || 'Patient not loaded' }}</p>
                                                    <p class='text-xs text-muted-foreground'>{{ slot.admission.patientNumber || slot.admission.admissionNumber || 'No patient number' }}</p>
                                                    <div class='mt-2 flex items-center justify-between gap-2'>
                                                        <p class='text-xs text-muted-foreground'>{{ formatDateTime(slot.admission.admittedAt) }}</p>
                                                        <Popover>
                                                            <PopoverTrigger as-child>
                                                                <Button size='sm' variant='outline' class='h-7 px-2 text-xs'>More</Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent class='w-72 space-y-3'>
                                                                <div>
                                                                    <p class='font-medium'>{{ slot.admission.patientName || 'Patient not loaded' }}</p>
                                                                    <p class='text-xs text-muted-foreground'>{{ slot.admission.patientNumber || 'No patient number' }}</p>
                                                                </div>
                                                                <div class='space-y-1 text-xs text-muted-foreground'>
                                                                    <p><span class='font-medium text-foreground'>Admission</span> {{ slot.admission.admissionNumber || slot.admission.id.slice(0, 8).toUpperCase() }}</p>
                                                                    <p><span class='font-medium text-foreground'>Status</span> {{ formatEnumLabel(slot.admission.status) }}</p>
                                                                    <p><span class='font-medium text-foreground'>Placement</span> {{ placementLabel(slot.admission) }}</p>
                                                                    <p><span class='font-medium text-foreground'>Admitted</span> {{ formatDateTime(slot.admission.admittedAt) }}</p>
                                                                    <p v-if='slot.admission.admissionReason'><span class='font-medium text-foreground'>Reason</span> {{ slot.admission.admissionReason }}</p>
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                </div>
                                                <div v-else class='mt-3 text-xs text-muted-foreground'>{{ String(slot.resource.status ?? '').trim().toLowerCase() === 'maintenance' ? 'Not assignable' : 'Ready for new admission' }}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </template>
                            <div v-else class='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>No ward-bed registry is available yet for the current facility scope.</div>
                        </CardContent>
                    </Card>
                </section>

                <section v-else class='space-y-4'>
                    <Card class='rounded-lg border-sidebar-border/70'>
                        <CardHeader class='space-y-4'>
                            <div class='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                                <div class='min-w-0'>
                                    <CardTitle class='flex items-center gap-2'>
                                        <AppIcon name='file-pen-line' class='size-5 text-muted-foreground' />
                                        Patient workspace
                                    </CardTitle>
                                    <CardDescription>Select one active inpatient admission, then record bedside work, round notes, progress notes, care plans, or discharge readiness from the current patient workspace.</CardDescription>
                                </div>
                            </div>
                            <div class='grid gap-2 md:grid-cols-2 xl:grid-cols-4'>
                                <button type='button' :class='["rounded-lg border px-4 py-3 text-left transition", documentationFlow === "task" ? "border-primary bg-primary/5 dark:border-primary/40 dark:bg-primary/15" : "bg-background/70 dark:bg-background/40 hover:border-primary/40 hover:bg-muted/20 dark:hover:bg-muted/10"]' @click='setDocumentationFlow("task")'>
                                    <div class='flex items-center gap-2'><AppIcon name='clipboard-list' class='size-4 text-muted-foreground' /><span class='font-medium'>Ward task</span></div>
                                    <p class='mt-1 text-xs text-muted-foreground'>Create a bedside nursing task linked to the current admission.</p>
                                </button>
                                <button type='button' :class='["rounded-lg border px-4 py-3 text-left transition", documentationFlow === "round_note" ? "border-primary bg-primary/5 dark:border-primary/40 dark:bg-primary/15" : "bg-background/70 dark:bg-background/40 hover:border-primary/40 hover:bg-muted/20 dark:hover:bg-muted/10"]' @click='setDocumentationFlow("round_note")'>
                                    <div class='flex items-center gap-2'><AppIcon name='stethoscope' class='size-4 text-muted-foreground' /><span class='font-medium'>Round note</span></div>
                                    <p class='mt-1 text-xs text-muted-foreground'>Capture the clinical round, updated care plan, and handoff notes.</p>
                                </button>
                                <button type='button' :class='["rounded-lg border px-4 py-3 text-left transition", documentationFlow === "care_plan" ? "border-primary bg-primary/5 dark:border-primary/40 dark:bg-primary/15" : "bg-background/70 dark:bg-background/40 hover:border-primary/40 hover:bg-muted/20 dark:hover:bg-muted/10"]' @click='setDocumentationFlow("care_plan")'>
                                    <div class='flex items-center gap-2'><AppIcon name='file-text' class='size-4 text-muted-foreground' /><span class='font-medium'>Care plan</span></div>
                                    <p class='mt-1 text-xs text-muted-foreground'>Create or update the active inpatient care plan for this admission.</p>
                                </button>
                                <button type='button' :class='["rounded-lg border px-4 py-3 text-left transition", documentationFlow === "discharge_checklist" ? "border-primary bg-primary/5 dark:border-primary/40 dark:bg-primary/15" : "bg-background/70 dark:bg-background/40 hover:border-primary/40 hover:bg-muted/20 dark:hover:bg-muted/10"]' @click='setDocumentationFlow("discharge_checklist")'>
                                    <div class='flex items-center gap-2'><AppIcon name='check-check' class='size-4 text-muted-foreground' /><span class='font-medium'>Discharge checklist</span></div>
                                    <p class='mt-1 text-xs text-muted-foreground'>Track readiness, blockers, and bedside discharge completion items.</p>
                                </button>
                            </div>
                        </CardHeader>
                        <CardContent class='space-y-5'>
                            <template v-if='pageLoading'>
                                <div class='space-y-4'>
                                    <Skeleton class='h-20 w-full rounded-lg' />
                                    <Skeleton class='h-64 w-full rounded-lg' />
                                </div>
                            </template>
                            <template v-else>
                                <div class='rounded-lg border border-border/70 bg-muted/20 p-4 dark:bg-muted/10'>
                                <AdmissionLookupField v-model='selectedAdmissionId' input-id='ward-documentation-admission' label='Current inpatient' helper-text='Search by patient name, patient number, or admission number from active inpatient admissions.' :error-message='fieldError("admissionId")' @selected='openSelectedAdmission' />
                                <div v-if='selectedAdmission' class='mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                                    <Badge variant='outline'>{{ selectedAdmission.admissionNumber || 'Admission' }}</Badge>
                                    <Badge variant='outline'>{{ selectedAdmission.patientName || 'Patient not loaded' }}</Badge>
                                    <Badge variant='outline'>{{ placementLabel(selectedAdmission) }}</Badge>
                                    <Badge variant='outline'>{{ formatEnumLabel(selectedAdmission.status) }}</Badge>
                                </div>
                                <div v-if='selectedAdmission && (canCreateMedicalRecords || canReadMedicalRecords)' class='mt-3 flex flex-wrap items-center gap-2'>
                                    <Button v-if='canCreateMedicalRecords && selectedAdmissionMedicalRecordCreateHref("progress_note")' size='sm' class='gap-1.5' as-child>
                                        <Link :href='selectedAdmissionMedicalRecordCreateHref("progress_note") || "/medical-records"'>
                                            <AppIcon name='file-text' class='size-3.5' />
                                            New progress note
                                        </Link>
                                    </Button>
                                    <Button v-if='canCreateMedicalRecords && selectedAdmissionMedicalRecordCreateHref("nursing_note")' size='sm' class='gap-1.5' as-child>
                                        <Link :href='selectedAdmissionMedicalRecordCreateHref("nursing_note") || "/medical-records"'>
                                            <AppIcon name='file-text' class='size-3.5' />
                                            New nursing note
                                        </Link>
                                    </Button>
                                    <Button v-if='canReadMedicalRecords && selectedAdmissionMedicalRecordBrowseHref("progress_note")' size='sm' variant='outline' class='gap-1.5' as-child>
                                        <Link :href='selectedAdmissionMedicalRecordBrowseHref("progress_note") || "/medical-records"'>
                                            <AppIcon name='folder-open' class='size-3.5' />
                                            Open progress notes
                                        </Link>
                                    </Button>
                                </div>
                                <div v-if='selectedAdmission' class='mt-3 rounded-lg border border-border/70 bg-background/80 px-4 py-3 dark:bg-background/40'>
                                    <div class='flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between'>
                                        <div class='min-w-0'>
                                            <div class='flex flex-wrap items-center gap-2'>
                                                <p class='font-medium text-foreground'>Shift handoff</p>
                                                <Badge :variant='selectedAdmissionHandoffStatusVariant'>{{ selectedAdmissionHandoffStatusLabel }}</Badge>
                                                <Badge v-if='latestSelectedAdmissionHandoff?.shiftLabel' variant='outline'>{{ formatEnumLabel(latestSelectedAdmissionHandoff.shiftLabel) }} shift</Badge>
                                            </div>
                                            <p class='mt-1 text-sm text-muted-foreground'>{{ selectedAdmissionHandoffMessage }}</p>
                                            <p v-if='latestSelectedAdmissionHandoff?.handoffNotes' class='mt-2 text-sm text-foreground line-clamp-2' :title='latestSelectedAdmissionHandoff.handoffNotes'>{{ latestSelectedAdmissionHandoff.handoffNotes }}</p>
                                        </div>
                                        <div class='flex flex-wrap items-center gap-2'>
                                            <Button v-if='latestSelectedAdmissionHandoff' size='sm' variant='outline' class='gap-1.5' @click='openRoundNoteDetails(latestSelectedAdmissionHandoff)'>
                                                <AppIcon name='eye' class='size-3.5' />
                                                Open handoff
                                            </Button>
                                            <Button v-if='canAcknowledgeRoundNote(latestSelectedAdmissionHandoff)' size='sm' class='gap-1.5' :disabled='roundNoteAcknowledgeLoadingId === latestSelectedAdmissionHandoff?.id' @click='latestSelectedAdmissionHandoff && acknowledgeRoundNote(latestSelectedAdmissionHandoff)'>
                                                <AppIcon name='check-check' class='size-3.5' />
                                                {{ roundNoteAcknowledgeLoadingId === latestSelectedAdmissionHandoff?.id ? 'Acknowledging...' : 'Acknowledge handoff' }}
                                            </Button>
                                            <Badge v-else-if='latestSelectedAdmissionHandoff?.acknowledgedAt' variant='secondary'>Acknowledged {{ formatDateTime(latestSelectedAdmissionHandoff.acknowledgedAt) }}</Badge>
                                        </div>
                                    </div>
                                    <div class='mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground'>
                                        <Badge variant='outline'>Open tasks {{ selectedAdmissionOpenTasks.length }}</Badge>
                                        <Badge v-if='selectedAdmissionOverdueTasks.length > 0' variant='destructive'>Overdue {{ selectedAdmissionOverdueTasks.length }}</Badge>
                                        <Badge v-if='selectedAdmissionEscalatedTasks.length > 0' variant='destructive'>Escalated {{ selectedAdmissionEscalatedTasks.length }}</Badge>
                                        <Badge v-if='selectedAdmissionUnassignedTasks.length > 0' variant='outline'>Unassigned {{ selectedAdmissionUnassignedTasks.length }}</Badge>
                                        <Badge v-if='selectedAdmissionOpenTasks.filter((task) => taskAssignedToCurrentUser(task)).length > 0' variant='secondary'>Assigned to you {{ selectedAdmissionOpenTasks.filter((task) => taskAssignedToCurrentUser(task)).length }}</Badge>
                                        <Badge v-if='selectedAdmissionReviewOverdue' variant='outline'>Care-plan review overdue</Badge>
                                        <Badge v-if='editableChecklist?.status === "blocked"' variant='destructive'>Discharge blocked</Badge>
                                        <Badge v-else-if='editableChecklist?.isReadyForDischarge' variant='secondary'>Ready for discharge</Badge>
                                    </div>
                                </div>
                                <div v-if='selectedAdmission' class='mt-3 rounded-lg border border-border/70 bg-background/80 px-4 py-3 dark:bg-background/40'>
                                    <div class='flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between'>
                                        <div class='min-w-0'>
                                            <div class='flex flex-wrap items-center gap-2'>
                                                <p class='font-medium text-foreground'>Cross-module follow-up</p>
                                                <Badge :variant='selectedAdmissionFollowUpCount > 0 ? "secondary" : "outline"'>{{ selectedAdmissionFollowUpCount > 0 ? `${selectedAdmissionFollowUpCount} active` : 'Clear' }}</Badge>
                                            </div>
                                            <p class='mt-1 text-sm text-muted-foreground'>Review linked lab, pharmacy, radiology, and billing work that still needs downstream follow-up for this admission.</p>
                                        </div>
                                        <Badge v-if='selectedAdmissionFollowUpRail?.generatedAt' variant='outline'>Updated {{ formatDateTime(selectedAdmissionFollowUpRail.generatedAt) }}</Badge>
                                    </div>
                                    <Alert v-if='followUpRailError' variant='destructive' class='mt-3'>
                                        <AppIcon name='triangle-alert' class='size-4' />
                                        <AlertDescription>{{ followUpRailError }}</AlertDescription>
                                    </Alert>
                                    <div v-else-if='followUpRailLoading' class='mt-3 grid gap-3 lg:grid-cols-2'>
                                        <Skeleton class='h-32 w-full rounded-lg' />
                                        <Skeleton class='h-32 w-full rounded-lg' />
                                        <Skeleton class='h-32 w-full rounded-lg' />
                                        <Skeleton class='h-32 w-full rounded-lg' />
                                    </div>
                                    <div v-else class='mt-3 grid gap-3 lg:grid-cols-2'>
                                        <div v-for='card in followUpModuleCards' :key='card.key' class='rounded-lg border border-border/70 bg-muted/20 p-3 dark:bg-muted/10'>
                                            <div class='flex items-start justify-between gap-3'>
                                                <div class='min-w-0'>
                                                    <div class='flex items-center gap-2'>
                                                        <AppIcon :name='card.icon' class='size-4 text-muted-foreground' />
                                                        <p class='font-medium text-foreground'>{{ card.title }}</p>
                                                    </div>
                                                    <p class='mt-1 text-sm text-muted-foreground'>{{ card.summary }}</p>
                                                </div>
                                                <Badge :variant='card.module.followUpCount > 0 ? "secondary" : "outline"'>{{ card.module.followUpCount > 0 ? `${card.module.followUpCount} active` : 'Clear' }}</Badge>
                                            </div>
                                            <div v-if='card.module.items.length > 0' class='mt-3 space-y-2'>
                                                <div v-for='item in card.module.items' :key='`${card.key}-${item.id}`' class='rounded-md border border-border/70 bg-background/80 px-3 py-2 dark:bg-background/50'>
                                                    <div class='flex items-start justify-between gap-2'>
                                                        <div class='min-w-0'>
                                                            <p class='truncate text-sm font-medium text-foreground'>{{ item.title || item.number || `${card.title} item` }}</p>
                                                            <p class='truncate text-xs text-muted-foreground'>{{ item.number || 'Linked record' }}</p>
                                                        </div>
                                                        <Badge :variant='formatStatusVariant(item.status)'>{{ formatEnumLabel(item.status) }}</Badge>
                                                    </div>
                                                    <div class='mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground'>
                                                        <span v-if='item.timestamp'>{{ formatDateTime(item.timestamp) }}</span>
                                                        <span v-if='item.detail'>{{ item.detail }}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <p v-else class='mt-3 text-sm text-muted-foreground'>No active downstream blocker is recorded in this module.</p>
                                            <div class='mt-3 flex items-center justify-between gap-2'>
                                                <p class='text-xs text-muted-foreground'>{{ card.canOpen ? 'Open the downstream module for full workflow details.' : 'Summary only. Downstream module access is restricted for this role.' }}</p>
                                                <Button v-if='card.canOpen' size='sm' variant='outline' class='gap-1.5' @click='openFollowUpModule(card.key)'>
                                                    <AppIcon name='eye' class='size-3.5' />
                                                    {{ card.openLabel }}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Alert v-if='documentationSuccess' class='border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100'>
                                <AppIcon name='check' class='size-4' />
                                <AlertDescription>{{ documentationSuccess }}</AlertDescription>
                            </Alert>
                            <Alert v-if='documentationError' variant='destructive'>
                                <AppIcon name='triangle-alert' class='size-4' />
                                <AlertDescription>{{ documentationError }}</AlertDescription>
                            </Alert>
                            <Card v-if='selectedAdmission && documentationFlow === "round_note"' class='rounded-lg border'>
                                <CardHeader class='pb-3'>
                                    <CardTitle class='text-base'>Record round note</CardTitle>
                                    <CardDescription>Capture the current clinical review and handoff guidance.</CardDescription>
                                </CardHeader>
                                <CardContent class='space-y-4'>
                                    <div class='grid gap-4 md:grid-cols-3'>
                                        <div class='grid gap-2'>
                                            <Label for='round-note-shift'>Shift</Label>
                                            <Select v-model='roundNoteForm.shiftLabel'>
                                                <SelectTrigger id='round-note-shift' class='w-full min-w-0 justify-between bg-background dark:bg-background'>
                                                    <SelectValue placeholder='Select shift' />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem v-for='option in shiftLabelOptions' :key='option' :value='option'>{{ formatEnumLabel(option) }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p v-if='fieldError("shiftLabel")' class='text-xs text-destructive'>{{ fieldError('shiftLabel') }}</p>
                                        </div>
                                        <div class='grid gap-2'><Label for='round-note-rounded-at'>Rounded at</Label><Input id='round-note-rounded-at' v-model='roundNoteForm.roundedAt' type='datetime-local' /><p v-if='fieldError("roundedAt")' class='text-xs text-destructive'>{{ fieldError('roundedAt') }}</p></div>
                                        <div class='grid gap-2'><Label for='round-note-care-plan'>Updated care plan summary</Label><Input id='round-note-care-plan' v-model='roundNoteForm.carePlan' placeholder='Continue monitoring, reassess tomorrow.' /><p v-if='fieldError("carePlan")' class='text-xs text-destructive'>{{ fieldError('carePlan') }}</p></div>
                                    </div>
                                    <div class='grid gap-2'>
                                        <Label for='round-note-note'>Round note</Label>
                                        <Textarea id='round-note-note' v-model='roundNoteForm.roundNote' rows='5' placeholder='Patient reviewed on ward round. Stable, tolerating oral intake.' />
                                        <p v-if='fieldError("roundNote")' class='text-xs text-destructive'>{{ fieldError('roundNote') }}</p>
                                    </div>
                                    <div class='grid gap-2'><Label for='round-note-handoff'>Handoff notes</Label><Textarea id='round-note-handoff' v-model='roundNoteForm.handoffNotes' rows='4' placeholder='Night shift to watch pain score and temperature trend.' /><p v-if='fieldError("handoffNotes")' class='text-xs text-destructive'>{{ fieldError('handoffNotes') }}</p></div>
                                    <div class='flex justify-end'><Button :disabled='documentationSubmitting || !canCreateRoundNote' class='gap-1.5' @click='submitRoundNote'><AppIcon name='plus' class='size-4' />{{ documentationSubmitting ? 'Saving...' : 'Record round note' }}</Button></div>
                                </CardContent>
                            </Card>
                            <div v-else-if='selectedAdmission' class='rounded-lg border border-border/70 bg-muted/20 px-4 py-3 dark:bg-muted/10'>
                                <div class='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                                    <div class='min-w-0'>
                                        <p class='font-medium text-foreground'>{{ documentationFlow === 'task' ? 'Ward task form' : documentationFlow === 'care_plan' ? (editableCarePlan ? 'Care plan editor' : 'Care plan form') : (editableChecklist ? 'Discharge checklist editor' : 'Discharge checklist form') }}</p>
                                        <p class='mt-1 text-sm text-muted-foreground'>{{ documentationFlow === 'task' ? 'Use the sheet for bedside task assignment, due timing, and notes.' : documentationFlow === 'care_plan' ? 'Use the sheet for the active inpatient plan, goals, interventions, and review timing.' : 'Use the sheet for readiness items, blocker notes, and discharge workflow status.' }}</p>
                                    </div>
                                    <Button class='gap-1.5 self-start sm:self-auto' @click='documentationSheetOpen = true'>
                                        <AppIcon name='square-pen' class='size-4' />
                                        {{ documentationFlow === 'task' ? 'Open ward task form' : documentationFlow === 'care_plan' ? (editableCarePlan ? 'Open care plan editor' : 'Open care plan form') : (editableChecklist ? 'Open checklist editor' : 'Open checklist form') }}
                                    </Button>
                                </div>
                            </div>
                            <div v-if='!selectedAdmission' class='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>Search and select a current inpatient admission to continue with bedside documentation and downstream follow-up.</div>
                            <div v-if='selectedAdmission && selectedAdmissionHasRecordedData' class='grid gap-3 lg:grid-cols-3'>
                                <div class='rounded-lg border border-border/70 px-4 py-3'>
                                    <div class='flex items-start justify-between gap-2'>
                                        <div class='min-w-0'>
                                            <p class='font-medium text-foreground'>Latest round note</p>
                                            <p class='text-sm text-muted-foreground'>{{ selectedAdmissionRoundNotes.length > 0 ? formatDateTime(selectedAdmissionRoundNotes[0].roundedAt || selectedAdmissionRoundNotes[0].createdAt) : 'Nothing recorded yet' }}</p>
                                        </div>
                                        <Badge variant='outline'>{{ selectedAdmissionRoundNotes.length }} notes</Badge>
                                    </div>
                                    <template v-if='selectedAdmissionRoundNotes.length > 0'>
                                        <p class='mt-2 text-sm text-foreground line-clamp-2' :title='selectedAdmissionRoundNotes[0].roundNote || "No round note text was recorded."'>{{ selectedAdmissionRoundNotes[0].roundNote || 'No round note text was recorded.' }}</p>
                                        <div class='mt-2 space-y-1.5 text-sm'>
                                            <p v-if='selectedAdmissionRoundNotes[0].carePlan' class='text-muted-foreground line-clamp-1' :title='selectedAdmissionRoundNotes[0].carePlan'><span class='font-medium text-foreground'>Care plan:</span> {{ selectedAdmissionRoundNotes[0].carePlan }}</p>
                                            <p v-if='selectedAdmissionRoundNotes[0].handoffNotes' class='text-muted-foreground line-clamp-1' :title='selectedAdmissionRoundNotes[0].handoffNotes'><span class='font-medium text-foreground'>Handoff:</span> {{ selectedAdmissionRoundNotes[0].handoffNotes }}</p>
                                        </div>
                                        <div class='mt-3 flex justify-end'>
                                            <Button size='sm' variant='outline' class='gap-1.5' @click='openRoundNoteDetails(selectedAdmissionRoundNotes[0])'>
                                                <AppIcon name='eye' class='size-3.5' />
                                                Open round note
                                            </Button>
                                        </div>
                                    </template>
                                    <p v-else class='mt-2 text-sm text-muted-foreground'>No round notes have been recorded for this admission yet.</p>
                                </div>
                                <div class='rounded-lg border border-border/70 px-4 py-3'>
                                    <div class='flex items-start justify-between gap-2'>
                                        <div class='min-w-0'>
                                            <p class='font-medium text-foreground'>Current care plan</p>
                                            <p class='text-sm text-muted-foreground'>{{ selectedAdmissionCarePlans.length > 0 ? (selectedAdmissionCarePlans[0].title || selectedAdmissionCarePlans[0].carePlanNumber || 'Care plan') : 'Nothing recorded yet' }}</p>
                                        </div>
                                        <Badge :variant='selectedAdmissionCarePlans.length > 0 ? formatStatusVariant(selectedAdmissionCarePlans[0].status) : "outline"'>{{ selectedAdmissionCarePlans.length > 0 ? formatEnumLabel(selectedAdmissionCarePlans[0].status) : 'Not started' }}</Badge>
                                    </div>
                                    <template v-if='selectedAdmissionCarePlans.length > 0'>
                                        <p class='mt-2 text-sm text-foreground line-clamp-2' :title='selectedAdmissionCarePlans[0].planText || "No care-plan text was recorded for this admission."'>{{ selectedAdmissionCarePlans[0].planText || 'No care-plan text was recorded for this admission.' }}</p>
                                        <div class='mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground'>
                                            <Badge v-if='selectedAdmissionCarePlans[0].reviewDueAt' variant='outline'>Review due {{ formatDateTime(selectedAdmissionCarePlans[0].reviewDueAt) }}</Badge>
                                            <Badge v-if='selectedAdmissionCarePlans[0].targetDischargeAt' variant='outline'>Target discharge {{ formatDateTime(selectedAdmissionCarePlans[0].targetDischargeAt) }}</Badge>
                                        </div>
                                        <div class='mt-3 flex justify-end'>
                                            <Button size='sm' variant='outline' class='gap-1.5' @click='openCarePlanDetails(selectedAdmissionCarePlans[0])'>
                                                <AppIcon name='eye' class='size-3.5' />
                                                Open care plan
                                            </Button>
                                        </div>
                                    </template>
                                    <p v-else class='mt-2 text-sm text-muted-foreground'>No care plan has been recorded for this admission yet.</p>
                                </div>
                                <div class='rounded-lg border border-border/70 px-4 py-3'>
                                    <div class='flex items-start justify-between gap-2'>
                                        <div class='min-w-0'>
                                            <p class='font-medium text-foreground'>Discharge readiness</p>
                                            <p class='text-sm text-muted-foreground'>Most recent readiness for this admission</p>
                                        </div>
                                        <Badge :variant='editableChecklist ? formatStatusVariant(editableChecklist.status) : "outline"'>{{ editableChecklist ? formatEnumLabel(editableChecklist.status) : 'Not started' }}</Badge>
                                    </div>
                                    <template v-if='editableChecklist'>
                                        <div class='mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground'>
                                            <Badge variant='outline'>{{ checklistCompletionCount(editableChecklist) }}/7 complete</Badge>
                                            <Badge v-if='editableChecklist.isReadyForDischarge' variant='secondary'>Ready for discharge</Badge>
                                        </div>
                                        <p class='mt-2 text-sm text-foreground'>{{ checklistReadyForSubmit ? 'All required bedside discharge items are complete.' : 'Some discharge items are still pending or blocked.' }}</p>
                                        <p v-if='editableChecklist.statusReason' class='mt-1.5 text-sm text-muted-foreground line-clamp-2' :title='editableChecklist.statusReason'>{{ editableChecklist.statusReason }}</p>
                                        <div class='mt-3 flex justify-end gap-2'>
                                            <Button size='sm' variant='outline' @click='openChecklistPrintPreview(editableChecklist)'>
                                                Print summary
                                            </Button>
                                            <Button size='sm' variant='outline' class='gap-1.5' @click='openChecklistDetails(editableChecklist)'>
                                                <AppIcon name='eye' class='size-3.5' />
                                                Open checklist
                                            </Button>
                                        </div>
                                    </template>
                                    <p v-else class='mt-2 text-sm text-muted-foreground'>No discharge readiness record has been saved for this admission yet.</p>
                                </div>
                            </div>
                            <div v-if='selectedAdmission && selectedAdmissionContinuityEvents.length > 0' class='rounded-lg border border-border/70 px-4 py-3'>
                                <div class='flex flex-wrap items-start justify-between gap-3'>
                                    <div class='min-w-0'>
                                        <p class='font-medium text-foreground'>Continuity timeline</p>
                                        <p class='text-sm text-muted-foreground'>Latest ward actions, readiness changes, and downstream blockers for this admission.</p>
                                    </div>
                                    <Badge variant='outline'>{{ selectedAdmissionContinuityEvents.length }} recent events</Badge>
                                </div>
                                <div class='mt-3 space-y-2'>
                                    <div v-for='event in selectedAdmissionContinuityEvents' :key='event.id' class='flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2.5 dark:bg-background/40'>
                                        <div class='min-w-0 flex items-start gap-3'>
                                            <div class='mt-0.5 rounded-full bg-muted/40 p-2 text-muted-foreground dark:bg-muted/20'>
                                                <AppIcon :name='event.icon' class='size-4' />
                                            </div>
                                            <div class='min-w-0'>
                                                <div class='flex flex-wrap items-center gap-2'>
                                                    <p class='text-sm font-medium text-foreground'>{{ event.title }}</p>
                                                    <Badge v-if='event.status' :variant='formatStatusVariant(event.status)'>{{ formatEnumLabel(event.status) }}</Badge>
                                                </div>
                                                <p class='mt-1 text-sm text-muted-foreground line-clamp-2' :title='event.summary'>{{ event.summary }}</p>
                                                <p v-if='event.timestamp' class='mt-1 text-xs text-muted-foreground'>{{ formatDateTime(event.timestamp) }}</p>
                                            </div>
                                        </div>
                                        <Button v-if='event.actionLabel && event.action' size='sm' variant='outline' class='gap-1.5 shrink-0' @click='event.action()'>
                                            <AppIcon name='arrow-up-right' class='size-3.5' />
                                            {{ event.actionLabel }}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            </template>
                        </CardContent>
                    </Card>
                </section>
            </template>

            <Alert v-else variant='destructive'>
                <AppIcon name='shield-x' class='size-4' />
                <AlertTitle>Ward access restricted</AlertTitle>
                <AlertDescription>This user cannot open inpatient ward operations for the current facility scope.</AlertDescription>
            </Alert>
        </div>

        <Sheet :open='documentationSheetOpen' @update:open='(open) => (documentationSheetOpen = open)'>
            <SheetContent side='right' variant='form' size='2xl'>
                <SheetHeader class='shrink-0 border-b px-4 py-3 text-left pr-12'>
                    <SheetTitle class='flex items-center gap-2'>
                        <AppIcon :name='documentationFlow === "task" ? "clipboard-list" : documentationFlow === "care_plan" ? "file-text" : "check-check"' class='size-5 text-muted-foreground' />
                        {{ documentationFlow === 'task' ? 'Ward task' : documentationFlow === 'care_plan' ? (editableCarePlan ? 'Care plan editor' : 'Care plan') : (editableChecklist ? 'Discharge checklist editor' : 'Discharge checklist') }}
                    </SheetTitle>
                    <SheetDescription>{{ documentationFlow === 'task' ? 'Assign bedside work, due timing, and a clear nursing note.' : documentationFlow === 'care_plan' ? 'Document the plan, goals, interventions, and next review date.' : 'Track discharge readiness, blockers, and bedside completion items.' }}</SheetDescription>
                </SheetHeader>
                <div v-if='selectedAdmission && documentationFlow !== "round_note"' class='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-3'>
                    <div class='rounded-lg border border-border/70 bg-muted/20 p-4 dark:bg-muted/10'>
                        <div class='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                            <Badge variant='outline'>{{ selectedAdmission.admissionNumber || 'Admission' }}</Badge>
                            <Badge variant='outline'>{{ selectedAdmission.patientName || 'Patient not loaded' }}</Badge>
                            <Badge variant='outline'>{{ placementLabel(selectedAdmission) }}</Badge>
                            <Badge variant='outline'>{{ formatEnumLabel(selectedAdmission.status) }}</Badge>
                        </div>
                    </div>
                    <div v-if='documentationFlow === "task"' class='space-y-4'>
                        <div class='grid gap-4 md:grid-cols-2'>
                            <div class='grid gap-2'>
                                <Label for='ward-task-type-sheet'>Task type</Label>
                                <Select v-model='taskForm.taskType'>
                                    <SelectTrigger id='ward-task-type-sheet' class='w-full min-w-0 justify-between bg-background dark:bg-background'>
                                        <SelectValue placeholder='Select task type' />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for='option in taskTypeOptions' :key='option' :value='option'>{{ formatEnumLabel(option) }}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p v-if='fieldError("taskType")' class='text-xs text-destructive'>{{ fieldError('taskType') }}</p>
                            </div>
                            <div class='grid gap-2'>
                                <Label for='ward-task-priority-sheet'>Priority</Label>
                                <Select v-model='taskForm.priority'>
                                    <SelectTrigger id='ward-task-priority-sheet' class='w-full min-w-0 justify-between bg-background dark:bg-background'>
                                        <SelectValue placeholder='Select priority' />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for='option in taskPriorityOptions' :key='option' :value='option'>{{ formatEnumLabel(option) }}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p v-if='fieldError("priority")' class='text-xs text-destructive'>{{ fieldError('priority') }}</p>
                            </div>
                        </div>
                        <div class='grid gap-2'>
                            <Label for='ward-task-title-sheet'>Task title</Label>
                            <Input id='ward-task-title-sheet' v-model='taskForm.title' placeholder='Evening vitals review' />
                            <p v-if='fieldError("title")' class='text-xs text-destructive'>{{ fieldError('title') }}</p>
                        </div>
                        <div class='grid gap-4 md:grid-cols-2'>
                            <div class='grid gap-2'>
                                <div class='flex items-center justify-end gap-2'>
                                    <Button v-if='currentUserId' type='button' size='sm' variant='outline' class='h-7 gap-1 px-2 text-xs' @click='assignTaskFormToCurrentUser'>Assign to me</Button>
                                </div>
                                <SearchableSelectField
                                    input-id='ward-task-assigned-user-sheet'
                                    v-model='taskForm.assignedToUserId'
                                    label='Assigned owner'
                                    :options='assigneeOptions'
                                    placeholder='Leave unassigned or select staff'
                                    search-placeholder='Search by name, employee number, department, role, or user ID'
                                    :helper-text='assigneeFieldHelperText'
                                    :error-message='fieldError("assignedToUserId")'
                                    empty-text='No active ward staff are available right now.'
                                    :disabled='documentationSubmitting || assigneeDirectoryLoading'
                                />
                            </div>
                            <div class='grid gap-2'>
                                <Label for='ward-task-due-at-sheet'>Due at</Label>
                                <Input id='ward-task-due-at-sheet' v-model='taskForm.dueAt' type='datetime-local' />
                                <p v-if='fieldError("dueAt")' class='text-xs text-destructive'>{{ fieldError('dueAt') }}</p>
                            </div>
                        </div>
                        <div class='grid gap-2'>
                            <Label for='ward-task-notes-sheet'>Notes</Label>
                            <Textarea id='ward-task-notes-sheet' v-model='taskForm.notes' rows='4' placeholder='Repeat BP, pulse, temperature and update bedside chart.' />
                            <p v-if='fieldError("notes")' class='text-xs text-destructive'>{{ fieldError('notes') }}</p>
                        </div>
                        <div class='flex items-center justify-end gap-2 border-t pt-4'>
                            <Button variant='outline' @click='closeDocumentationSheet'>Close</Button>
                            <Button :disabled='documentationSubmitting || !canCreateTask' class='gap-1.5' @click='submitTask'><AppIcon name='plus' class='size-4' />{{ documentationSubmitting ? 'Saving...' : 'Create ward task' }}</Button>
                        </div>
                    </div>
                    <div v-else-if='documentationFlow === "care_plan"' class='space-y-4'>
                        <div class='grid gap-2'><Label for='care-plan-title-sheet'>Care plan title</Label><Input id='care-plan-title-sheet' v-model='carePlanForm.title' placeholder='Inpatient monitoring plan' /><p v-if='fieldError("title")' class='text-xs text-destructive'>{{ fieldError('title') }}</p></div>
                        <div class='grid gap-2'><Label for='care-plan-text-sheet'>Plan text</Label><Textarea id='care-plan-text-sheet' v-model='carePlanForm.planText' rows='5' placeholder='Monitor recovery progress and prepare for safe discharge.' /><p v-if='fieldError("planText")' class='text-xs text-destructive'>{{ fieldError('planText') }}</p></div>
                        <div class='grid gap-4 md:grid-cols-2'>
                            <div class='grid gap-2'><Label for='care-plan-goals-sheet'>Goals</Label><Textarea id='care-plan-goals-sheet' v-model='carePlanForm.goalsText' rows='5' placeholder='Stable vitals&#10;Pain controlled' /><p v-if='fieldError("goals")' class='text-xs text-destructive'>{{ fieldError('goals') }}</p></div>
                            <div class='grid gap-2'><Label for='care-plan-interventions-sheet'>Interventions</Label><Textarea id='care-plan-interventions-sheet' v-model='carePlanForm.interventionsText' rows='5' placeholder='Ward observations every shift&#10;Medication review' /><p v-if='fieldError("interventions")' class='text-xs text-destructive'>{{ fieldError('interventions') }}</p></div>
                        </div>
                        <div class='grid gap-4 md:grid-cols-2'>
                            <div class='grid gap-2'><Label for='care-plan-review-due-sheet'>Review due</Label><Input id='care-plan-review-due-sheet' v-model='carePlanForm.reviewDueAt' type='datetime-local' /><p v-if='fieldError("reviewDueAt")' class='text-xs text-destructive'>{{ fieldError('reviewDueAt') }}</p></div>
                            <div class='grid gap-2'><Label for='care-plan-target-discharge-sheet'>Target discharge</Label><Input id='care-plan-target-discharge-sheet' v-model='carePlanForm.targetDischargeAt' type='datetime-local' /><p v-if='fieldError("targetDischargeAt")' class='text-xs text-destructive'>{{ fieldError('targetDischargeAt') }}</p></div>
                        </div>
                        <div class='flex items-center justify-end gap-2 border-t pt-4'>
                            <Button variant='outline' @click='closeDocumentationSheet'>Close</Button>
                            <Button :disabled='documentationSubmitting || !(editableCarePlan ? canUpdateCarePlan : canCreateCarePlan)' class='gap-1.5' @click='submitCarePlan'><AppIcon name='plus' class='size-4' />{{ documentationSubmitting ? 'Saving...' : editableCarePlan ? 'Update care plan' : 'Create care plan' }}</Button>
                        </div>
                    </div>
                    <div v-else class='space-y-4'>
                        <div class='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                            <label class='flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3 text-sm dark:bg-background/40'><Checkbox :checked='checklistForm.clinicalSummaryCompleted' @update:checked='checklistForm.clinicalSummaryCompleted = Boolean($event)' /><span>Clinical summary complete</span></label>
                            <label class='flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3 text-sm dark:bg-background/40'><Checkbox :checked='checklistForm.medicationReconciliationCompleted' @update:checked='checklistForm.medicationReconciliationCompleted = Boolean($event)' /><span>Medication reconciliation complete</span></label>
                            <label class='flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3 text-sm dark:bg-background/40'><Checkbox :checked='checklistForm.followUpPlanCompleted' @update:checked='checklistForm.followUpPlanCompleted = Boolean($event)' /><span>Follow-up plan complete</span></label>
                            <label class='flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3 text-sm dark:bg-background/40'><Checkbox :checked='checklistForm.patientEducationCompleted' @update:checked='checklistForm.patientEducationCompleted = Boolean($event)' /><span>Patient education complete</span></label>
                            <label class='flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3 text-sm dark:bg-background/40'><Checkbox :checked='checklistForm.transportArranged' @update:checked='checklistForm.transportArranged = Boolean($event)' /><span>Transport arranged</span></label>
                            <label class='flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3 text-sm dark:bg-background/40'><Checkbox :checked='checklistForm.billingCleared' @update:checked='checklistForm.billingCleared = Boolean($event)' /><span>Billing cleared</span></label>
                            <label class='flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3 text-sm dark:bg-background/40 md:col-span-2 xl:col-span-3'><Checkbox :checked='checklistForm.documentationCompleted' @update:checked='checklistForm.documentationCompleted = Boolean($event)' /><span>Documentation complete</span></label>
                        </div>
                        <div class='grid gap-4 md:grid-cols-2'>
                            <div class='grid gap-2'><Label for='checklist-status-sheet'>Checklist status</Label><Select v-model='checklistForm.status'><SelectTrigger id='checklist-status-sheet' class='w-full min-w-0 justify-between bg-background dark:bg-background'><SelectValue placeholder='Select checklist status' /></SelectTrigger><SelectContent><SelectItem v-for='option in dischargeChecklistStatusOptions' :key='option' :value='option'>{{ formatEnumLabel(option) }}</SelectItem></SelectContent></Select><p v-if='fieldError("status")' class='text-xs text-destructive'>{{ fieldError('status') }}</p></div>
                            <div class='grid gap-2'><Label for='checklist-status-reason-sheet'>Blocker note</Label><Input id='checklist-status-reason-sheet' v-model='checklistForm.statusReason' :placeholder='checklistForm.status === "blocked" ? "Required blocker note" : "Optional status note"' /><p v-if='fieldError("statusReason")' class='text-xs text-destructive'>{{ fieldError('statusReason') }}</p></div>
                        </div>
                        <div class='rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground dark:bg-muted/10'>{{ checklistReadyForSubmit ? 'All required discharge items are complete.' : 'Complete all seven items before moving the checklist to ready or completed.' }}</div>
                        <div class='grid gap-2'><Label for='checklist-notes-sheet'>Notes</Label><Textarea id='checklist-notes-sheet' v-model='checklistForm.notes' rows='4' placeholder='Waiting for discharge medicines and final documentation.' /><p v-if='fieldError("notes")' class='text-xs text-destructive'>{{ fieldError('notes') }}</p></div>
                        <div class='flex items-center justify-end gap-2 border-t pt-4'>
                            <Button variant='outline' @click='closeDocumentationSheet'>Close</Button>
                            <Button :disabled='documentationSubmitting || !canManageDischargeChecklist' class='gap-1.5' @click='submitChecklist'><AppIcon name='plus' class='size-4' />{{ documentationSubmitting ? 'Saving...' : editableChecklist ? 'Update checklist' : 'Create checklist' }}</Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>

        <Sheet :open='taskAssignmentSheetOpen' @update:open='(open) => (open ? (taskAssignmentSheetOpen = true) : closeTaskAssignmentSheet())'>
            <SheetContent side='right' variant='form' size='xl'>
                <SheetHeader class='shrink-0 border-b px-4 py-3 text-left pr-12'>
                    <SheetTitle class='flex items-center gap-2'><AppIcon name='users' class='size-5 text-muted-foreground' />Task assignment</SheetTitle>
                    <SheetDescription>Update the current owner so the bedside team can see clear responsibility during the shift.</SheetDescription>
                </SheetHeader>
                <div v-if='taskAssignmentTarget' class='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-3'>
                    <div class='rounded-lg border border-border/70 bg-muted/20 p-4 dark:bg-muted/10'>
                        <div class='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                            <Badge variant='outline'>{{ taskAssignmentTarget.taskNumber || 'Ward task' }}</Badge>
                            <Badge variant='outline'>{{ patientLabel(taskAssignmentTarget) }}</Badge>
                            <Badge variant='outline'>{{ admissionLabel(taskAssignmentTarget) }}</Badge>
                            <Badge variant='outline'>{{ taskOwnerDetail(taskAssignmentTarget) }}</Badge>
                        </div>
                    </div>
                    <SearchableSelectField
                        input-id='task-assignment-owner-sheet'
                        v-model='taskAssignmentUserId'
                        label='Assigned owner'
                        :options='assigneeOptions'
                        placeholder='Leave unassigned or select staff'
                        search-placeholder='Search by name, employee number, department, role, or user ID'
                        :helper-text='assigneeFieldHelperText'
                        :error-message='taskAssignmentError'
                        empty-text='No active ward staff are available right now.'
                        :disabled='taskAssignmentSubmitting || assigneeDirectoryLoading'
                    />
                    <div class='flex flex-wrap items-center justify-end gap-2 border-t pt-4'>
                        <Button variant='outline' @click='closeTaskAssignmentSheet'>Close</Button>
                        <Button v-if='currentUserId' type='button' variant='outline' class='gap-1.5' :disabled='taskAssignmentSubmitting' @click='taskAssignmentUserId = String(currentUserId)'><AppIcon name='user-plus' class='size-4' />Assign to me</Button>
                        <Button type='button' variant='outline' class='gap-1.5' :disabled='taskAssignmentSubmitting' @click='taskAssignmentUserId = ""'>Clear owner</Button>
                        <Button class='gap-1.5' :disabled='taskAssignmentSubmitting' @click='submitTaskAssignment'><AppIcon name='save' class='size-4' />{{ taskAssignmentSubmitting ? 'Saving...' : 'Save assignment' }}</Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>

        <Sheet :open='taskDetailsOpen' @update:open='(open) => (open ? (taskDetailsOpen = true) : closeTaskDetails())'>
            <SheetContent side='right' variant='workspace' size='2xl'>
                <SheetHeader class='shrink-0 border-b px-4 py-3 text-left pr-12'>
                    <SheetTitle class='flex items-center gap-2'><AppIcon name='clipboard-list' class='size-5 text-muted-foreground' />Ward Task Details</SheetTitle>
                    <SheetDescription>Review bedside task context, workflow timing, and the current bedside note.</SheetDescription>
                </SheetHeader>
                <div v-if='taskDetailsTask' class='flex-1 space-y-4 overflow-y-auto px-4 py-4'>
                    <div class='rounded-lg border border-border/70 bg-muted/20 p-4 dark:bg-muted/10'>
                        <div class='flex flex-wrap items-start justify-between gap-3'>
                            <div class='min-w-0 space-y-1'>
                                <div class='flex flex-wrap items-center gap-2'>
                                    <p class='text-sm font-semibold text-foreground'>{{ taskDetailsTask.taskNumber || 'Ward task' }}</p>
                                    <Badge :variant='formatStatusVariant(taskDetailsTask.status)'>{{ formatEnumLabel(taskDetailsTask.status) }}</Badge>
                                    <Badge variant='outline'>{{ formatEnumLabel(taskDetailsTask.priority) }}</Badge>
                                    <Badge variant='outline'>{{ formatEnumLabel(taskDetailsTask.taskType) }}</Badge>
                                </div>
                                <p class='text-sm text-foreground'>{{ taskDetailsTask.title || 'Untitled bedside task' }}</p>
                                <p class='text-xs text-muted-foreground'>{{ patientLabel(taskDetailsTask) }} | {{ patientMeta(taskDetailsTask) }}</p>
                            </div>
                            <div class='flex flex-wrap gap-2'><Badge variant='outline'>Due {{ formatDateTime(taskDetailsTask.dueAt) }}</Badge><Badge v-if='taskDetailsTask.assignedToUserId' variant='outline'>{{ taskAssignmentSummary(taskDetailsTask) }}</Badge><Badge v-else variant='outline'>Unowned</Badge></div>
                        </div>
                    </div>
                    <div class='grid gap-4 md:grid-cols-2'>
                        <div class='rounded-lg border border-border/70 p-4'>
                            <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Task context</p>
                            <dl class='mt-3 space-y-3 text-sm'>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Patient</dt><dd class='text-right font-medium text-foreground'>{{ patientLabel(taskDetailsTask) }}</dd></div>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Admission</dt><dd class='text-right font-medium text-foreground'>{{ admissionLabel(taskDetailsTask) }}</dd></div>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Placement</dt><dd class='text-right font-medium text-foreground'>{{ placementLabel(taskDetailsAdmission) }}</dd></div>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Assigned owner</dt><dd class='text-right font-medium text-foreground'>{{ assigneeDisplayLabel(taskDetailsTask.assignedToUserId) || 'Unowned' }}</dd></div>
                            </dl>
                        </div>
                        <div class='rounded-lg border border-border/70 p-4'>
                            <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Workflow timing</p>
                            <dl class='mt-3 space-y-3 text-sm'>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Due at</dt><dd class='text-right font-medium text-foreground'>{{ formatDateTime(taskDetailsTask.dueAt) }}</dd></div>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Started</dt><dd class='text-right font-medium text-foreground'>{{ formatDateTime(taskDetailsTask.startedAt) }}</dd></div>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Completed</dt><dd class='text-right font-medium text-foreground'>{{ formatDateTime(taskDetailsTask.completedAt) }}</dd></div>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Escalated</dt><dd class='text-right font-medium text-foreground'>{{ formatDateTime(taskDetailsTask.escalatedAt) }}</dd></div>
                            </dl>
                        </div>
                    </div>
                    <div class='grid gap-4 md:grid-cols-2'>
                        <div class='rounded-lg border border-border/70 p-4'>
                            <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Bedside notes</p>
                            <p class='mt-3 text-sm leading-6 text-foreground'>{{ taskDetailsTask.notes || 'No bedside notes were recorded for this ward task.' }}</p>
                        </div>
                        <div class='rounded-lg border border-border/70 p-4'>
                            <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Workflow note</p>
                            <p class='mt-3 text-sm leading-6 text-foreground'>{{ taskDetailsTask.statusReason || 'No workflow note was recorded for the current task status.' }}</p>
                        </div>
                    </div>
                    <div class='flex items-center justify-end gap-2 border-t pt-4'>
                        <Button variant='outline' @click='closeTaskDetails'>Close</Button>
                        <Button v-if='taskCanTake(taskDetailsTask)' variant='outline' class='gap-1.5' :disabled='actionLoadingId === taskDetailsTask.id' @click='quickTakeTask(taskDetailsTask)'><AppIcon name='user-plus' class='size-4' />Take task</Button>
                        <Button v-if='taskCanReassign(taskDetailsTask)' variant='outline' class='gap-1.5' :disabled='actionLoadingId === taskDetailsTask.id' @click='openTaskAssignmentSheet(taskDetailsTask); closeTaskDetails()'><AppIcon name='users' class='size-4' />Reassign</Button>
                        <Button v-if='taskCanStartNow(taskDetailsTask)' variant='outline' class='gap-1.5' :disabled='actionLoadingId === taskDetailsTask.id' @click='quickStartTask(taskDetailsTask)'><AppIcon name='play' class='size-4' />Start now</Button>
                        <Button v-if='taskCanCompleteNow(taskDetailsTask)' variant='outline' class='gap-1.5' :disabled='actionLoadingId === taskDetailsTask.id' @click='quickCompleteTask(taskDetailsTask)'><AppIcon name='check-check' class='size-4' />Complete</Button>
                        <Button v-if='canUpdateTaskStatus' class='gap-1.5' :disabled='actionLoadingId === taskDetailsTask.id' @click='openTaskStatusFromDetails'><AppIcon name='refresh-cw' class='size-4' />Update status</Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>

        <Sheet :open='roundNoteDetailsOpen' @update:open='(open) => (open ? (roundNoteDetailsOpen = true) : closeRoundNoteDetails())'>
            <SheetContent side='right' variant='workspace' size='2xl'>
                <SheetHeader class='shrink-0 border-b px-4 py-3 text-left pr-12'>
                    <SheetTitle class='flex items-center gap-2'><AppIcon name='stethoscope' class='size-5 text-muted-foreground' />Round Note Details</SheetTitle>
                    <SheetDescription>Review the documented ward round, updated care-plan summary, and handoff guidance.</SheetDescription>
                </SheetHeader>
                <div v-if='roundNoteDetailsNote' class='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-3'>
                    <div class='rounded-lg border border-border/70 bg-muted/20 p-4 dark:bg-muted/10'>
                        <div class='flex flex-wrap items-start justify-between gap-3'>
                            <div class='min-w-0 space-y-1'>
                                <p class='text-sm font-semibold text-foreground'>{{ patientLabel(roundNoteDetailsNote) }}</p>
                                <p class='text-xs text-muted-foreground'>{{ admissionLabel(roundNoteDetailsNote) }} | {{ placementLabel(admissionFor(roundNoteDetailsNote)) }}</p>
                            </div>
                            <div class='flex flex-wrap gap-2'>
                                <Badge variant='outline'>Rounded {{ formatDateTime(roundNoteDetailsNote.roundedAt || roundNoteDetailsNote.createdAt) }}</Badge>
                                <Badge v-if='roundNoteDetailsNote.shiftLabel' variant='outline'>{{ formatEnumLabel(roundNoteDetailsNote.shiftLabel) }} shift</Badge>
                                <Badge v-if='roundNoteDetailsNote.acknowledgedAt' variant='secondary'>Acknowledged {{ formatDateTime(roundNoteDetailsNote.acknowledgedAt) }}</Badge>
                                <Badge v-else-if='roundNoteDetailsNote.handoffNotes' variant='destructive'>Pending acknowledgement</Badge>
                            </div>
                        </div>
                    </div>
                    <div class='grid gap-4 md:grid-cols-2'>
                        <div class='rounded-lg border border-border/70 p-4'>
                            <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Round note</p>
                            <p class='mt-3 text-sm leading-6 text-foreground'>{{ roundNoteDetailsNote.roundNote || 'No round note text was recorded.' }}</p>
                        </div>
                        <div class='rounded-lg border border-border/70 p-4'>
                            <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Updated care plan summary</p>
                            <p class='mt-3 text-sm leading-6 text-foreground'>{{ roundNoteDetailsNote.carePlan || 'No updated care-plan summary was recorded for this round note.' }}</p>
                        </div>
                    </div>
                    <div class='rounded-lg border border-border/70 p-4'>
                        <div class='flex flex-wrap items-start justify-between gap-3'>
                            <div class='min-w-0'>
                                <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Handoff</p>
                                <p class='mt-3 text-sm leading-6 text-foreground'>{{ roundNoteDetailsNote.handoffNotes || 'No handoff notes were recorded for this round note.' }}</p>
                            </div>
                            <Button v-if='canAcknowledgeRoundNote(roundNoteDetailsNote)' size='sm' class='gap-1.5' :disabled='roundNoteAcknowledgeLoadingId === roundNoteDetailsNote.id' @click='acknowledgeRoundNote(roundNoteDetailsNote)'>
                                <AppIcon name='check-check' class='size-3.5' />
                                {{ roundNoteAcknowledgeLoadingId === roundNoteDetailsNote.id ? 'Acknowledging...' : 'Acknowledge handoff' }}
                            </Button>
                        </div>
                    </div>
                    <div v-if='selectedAdmissionRoundNotes.filter((note) => note.id !== roundNoteDetailsNote.id).length > 0' class='rounded-lg border border-border/70 p-4'>
                        <div class='flex flex-wrap items-start justify-between gap-2'>
                            <div class='min-w-0'>
                                <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Round-note history</p>
                                <p class='mt-1 text-sm text-muted-foreground'>Earlier ward-round entries for this admission.</p>
                            </div>
                            <Badge variant='outline'>{{ selectedAdmissionRoundNotes.filter((note) => note.id !== roundNoteDetailsNote.id).length }} more</Badge>
                        </div>
                        <div class='mt-3 space-y-2'>
                            <button v-for='note in selectedAdmissionRoundNotes.filter((entry) => entry.id !== roundNoteDetailsNote.id).slice(0, 5)' :key='note.id || `${note.createdAt || note.roundedAt}-round-note`' type='button' class='flex w-full items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-left transition hover:border-primary/40 hover:bg-muted/20 dark:hover:bg-muted/10' @click='openRoundNoteDetails(note)'>
                                <div class='min-w-0'>
                                    <p class='text-sm font-medium text-foreground'>{{ formatDateTime(note.roundedAt || note.createdAt) }}</p>
                                    <p class='mt-1 text-sm text-muted-foreground line-clamp-2'>{{ note.roundNote || 'No round note text was recorded.' }}</p>
                                </div>
                                <AppIcon name='chevron-right' class='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                            </button>
                        </div>
                    </div>
                    <div class='flex items-center justify-end gap-2 border-t pt-4'>
                        <Button variant='outline' @click='closeRoundNoteDetails'>Close</Button>
                        <Button v-if='canAcknowledgeRoundNote(roundNoteDetailsNote)' class='gap-1.5' :disabled='roundNoteAcknowledgeLoadingId === roundNoteDetailsNote?.id' @click='roundNoteDetailsNote && acknowledgeRoundNote(roundNoteDetailsNote)'>
                            <AppIcon name='check-check' class='size-4' />
                            {{ roundNoteAcknowledgeLoadingId === roundNoteDetailsNote?.id ? 'Acknowledging...' : 'Acknowledge handoff' }}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>

        <Sheet :open='carePlanDetailsOpen' @update:open='(open) => (open ? (carePlanDetailsOpen = true) : closeCarePlanDetails())'>
            <SheetContent side='right' variant='workspace' size='2xl'>
                <SheetHeader class='shrink-0 border-b px-4 py-3 text-left pr-12'>
                    <SheetTitle class='flex items-center gap-2'><AppIcon name='file-text' class='size-5 text-muted-foreground' />Care Plan Details</SheetTitle>
                    <SheetDescription>Review the active inpatient plan, goals, interventions, and review timing.</SheetDescription>
                </SheetHeader>
                <div v-if='carePlanDetailsPlan' class='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-3'>
                    <div class='rounded-lg border border-border/70 bg-muted/20 p-4 dark:bg-muted/10'>
                        <div class='flex flex-wrap items-start justify-between gap-3'>
                            <div class='min-w-0'>
                                <div class='flex flex-wrap items-center gap-2'>
                                    <p class='text-sm font-semibold text-foreground'>{{ carePlanDetailsPlan.title || carePlanDetailsPlan.carePlanNumber || 'Care plan' }}</p>
                                    <Badge :variant='formatStatusVariant(carePlanDetailsPlan.status)'>{{ formatEnumLabel(carePlanDetailsPlan.status) }}</Badge>
                                </div>
                                <p class='mt-1 text-xs text-muted-foreground'>{{ patientLabel(carePlanDetailsPlan) }} | {{ admissionLabel(carePlanDetailsPlan) }} | {{ placementLabel(carePlanDetailsAdmission) }}</p>
                            </div>
                            <div class='flex flex-wrap gap-2'>
                                <Badge v-if='carePlanDetailsPlan.reviewDueAt' variant='outline'>Review due {{ formatDateTime(carePlanDetailsPlan.reviewDueAt) }}</Badge>
                                <Badge v-if='carePlanDetailsPlan.targetDischargeAt' variant='outline'>Target discharge {{ formatDateTime(carePlanDetailsPlan.targetDischargeAt) }}</Badge>
                            </div>
                        </div>
                    </div>
                    <div class='grid gap-4 md:grid-cols-2'>
                        <div class='rounded-lg border border-border/70 p-4'>
                            <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Plan context</p>
                            <dl class='mt-3 space-y-3 text-sm'>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Patient</dt><dd class='text-right font-medium text-foreground'>{{ patientLabel(carePlanDetailsPlan) }}</dd></div>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Admission</dt><dd class='text-right font-medium text-foreground'>{{ admissionLabel(carePlanDetailsPlan) }}</dd></div>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Placement</dt><dd class='text-right font-medium text-foreground'>{{ placementLabel(carePlanDetailsAdmission) }}</dd></div>
                            </dl>
                        </div>
                        <div class='rounded-lg border border-border/70 p-4'>
                            <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Workflow timing</p>
                            <dl class='mt-3 space-y-3 text-sm'>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Created</dt><dd class='text-right font-medium text-foreground'>{{ formatDateTime(carePlanDetailsPlan.createdAt) }}</dd></div>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Updated</dt><dd class='text-right font-medium text-foreground'>{{ formatDateTime(carePlanDetailsPlan.updatedAt) }}</dd></div>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Review due</dt><dd class='text-right font-medium text-foreground'>{{ formatDateTime(carePlanDetailsPlan.reviewDueAt) }}</dd></div>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Target discharge</dt><dd class='text-right font-medium text-foreground'>{{ formatDateTime(carePlanDetailsPlan.targetDischargeAt) }}</dd></div>
                            </dl>
                        </div>
                    </div>
                    <div class='rounded-lg border border-border/70 p-4'>
                        <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Plan text</p>
                        <p class='mt-3 text-sm leading-6 text-foreground'>{{ carePlanDetailsPlan.planText || 'No care-plan text was recorded for this admission.' }}</p>
                    </div>
                    <div class='grid gap-4 md:grid-cols-2'>
                        <div class='rounded-lg border border-border/70 p-4'>
                            <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Goals</p>
                            <ul v-if='(carePlanDetailsPlan.goals ?? []).length > 0' class='mt-3 space-y-2 text-sm text-foreground'>
                                <li v-for='goal in carePlanDetailsPlan.goals ?? []' :key='goal' class='rounded-md bg-muted/20 px-3 py-2 dark:bg-muted/10'>{{ goal }}</li>
                            </ul>
                            <p v-else class='mt-3 text-sm text-muted-foreground'>No goals were recorded for this care plan.</p>
                        </div>
                        <div class='rounded-lg border border-border/70 p-4'>
                            <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Interventions</p>
                            <ul v-if='(carePlanDetailsPlan.interventions ?? []).length > 0' class='mt-3 space-y-2 text-sm text-foreground'>
                                <li v-for='intervention in carePlanDetailsPlan.interventions ?? []' :key='intervention' class='rounded-md bg-muted/20 px-3 py-2 dark:bg-muted/10'>{{ intervention }}</li>
                            </ul>
                            <p v-else class='mt-3 text-sm text-muted-foreground'>No interventions were recorded for this care plan.</p>
                        </div>
                    </div>
                    <div class='rounded-lg border border-border/70 p-4'>
                        <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Workflow note</p>
                        <p class='mt-3 text-sm leading-6 text-foreground'>{{ carePlanDetailsPlan.statusReason || 'No workflow note was recorded for the current care-plan status.' }}</p>
                    </div>
                    <div class='flex items-center justify-end gap-2 border-t pt-4'>
                        <Button variant='outline' @click='closeCarePlanDetails'>Close</Button>
                        <Button v-if='canUpdateCarePlanStatus' class='gap-1.5' :disabled='actionLoadingId === carePlanDetailsPlan.id' @click='openCarePlanStatusFromDetails'><AppIcon name='refresh-cw' class='size-4' />Update status</Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>

        <Sheet :open='checklistDetailsOpen' @update:open='(open) => (open ? (checklistDetailsOpen = true) : closeChecklistDetails())'>
            <SheetContent side='right' variant='workspace' size='2xl'>
                <SheetHeader class='shrink-0 border-b px-4 py-3 text-left pr-12'>
                    <SheetTitle class='flex items-center gap-2'><AppIcon name='check-check' class='size-5 text-muted-foreground' />Discharge Readiness Details</SheetTitle>
                    <SheetDescription>Review bedside readiness completion, blockers, and the current discharge workflow status.</SheetDescription>
                </SheetHeader>
                <div v-if='checklistDetailsRecord' class='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-3'>
                    <div class='rounded-lg border border-border/70 bg-muted/20 p-4 dark:bg-muted/10'>
                        <div class='flex flex-wrap items-start justify-between gap-3'>
                            <div class='min-w-0'>
                                <div class='flex flex-wrap items-center gap-2'>
                                    <p class='text-sm font-semibold text-foreground'>{{ patientLabel(checklistDetailsRecord) }}</p>
                                    <Badge :variant='formatStatusVariant(checklistDetailsRecord.status)'>{{ formatEnumLabel(checklistDetailsRecord.status) }}</Badge>
                                    <Badge v-if='checklistDetailsRecord.isReadyForDischarge' variant='secondary'>Ready for discharge</Badge>
                                </div>
                                <p class='mt-1 text-xs text-muted-foreground'>{{ admissionLabel(checklistDetailsRecord) }} | {{ placementLabel(checklistDetailsAdmission) }}</p>
                            </div>
                            <Badge variant='outline'>{{ checklistCompletionCount(checklistDetailsRecord) }}/7 complete</Badge>
                        </div>
                    </div>
                    <div class='grid gap-4 md:grid-cols-2'>
                        <div class='rounded-lg border border-border/70 p-4'>
                            <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Workflow timing</p>
                            <dl class='mt-3 space-y-3 text-sm'>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Reviewed</dt><dd class='text-right font-medium text-foreground'>{{ formatDateTime(checklistDetailsRecord.reviewedAt) }}</dd></div>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Updated</dt><dd class='text-right font-medium text-foreground'>{{ formatDateTime(checklistDetailsRecord.updatedAt) }}</dd></div>
                                <div class='flex justify-between gap-4'><dt class='text-muted-foreground'>Status</dt><dd class='text-right font-medium text-foreground'>{{ formatEnumLabel(checklistDetailsRecord.status) }}</dd></div>
                            </dl>
                        </div>
                        <div class='rounded-lg border border-border/70 p-4'>
                            <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Readiness summary</p>
                            <p class='mt-3 text-sm leading-6 text-foreground'>{{ checklistDetailsRecord.isReadyForDischarge ? 'All required bedside discharge items are complete.' : 'Some discharge items are still pending or blocked.' }}</p>
                            <p v-if='checklistDetailsRecord.statusReason' class='mt-3 text-sm leading-6 text-muted-foreground'>{{ checklistDetailsRecord.statusReason }}</p>
                        </div>
                    </div>
                    <div class='grid gap-3 md:grid-cols-2'>
                        <div class='rounded-lg border border-border/70 px-3 py-3 text-sm'><span class='font-medium text-foreground'>Clinical summary</span><span class='ml-2 text-muted-foreground'>{{ checklistDetailsRecord.clinicalSummaryCompleted ? 'Complete' : 'Pending' }}</span></div>
                        <div class='rounded-lg border border-border/70 px-3 py-3 text-sm'><span class='font-medium text-foreground'>Medication reconciliation</span><span class='ml-2 text-muted-foreground'>{{ checklistDetailsRecord.medicationReconciliationCompleted ? 'Complete' : 'Pending' }}</span></div>
                        <div class='rounded-lg border border-border/70 px-3 py-3 text-sm'><span class='font-medium text-foreground'>Follow-up plan</span><span class='ml-2 text-muted-foreground'>{{ checklistDetailsRecord.followUpPlanCompleted ? 'Complete' : 'Pending' }}</span></div>
                        <div class='rounded-lg border border-border/70 px-3 py-3 text-sm'><span class='font-medium text-foreground'>Patient education</span><span class='ml-2 text-muted-foreground'>{{ checklistDetailsRecord.patientEducationCompleted ? 'Complete' : 'Pending' }}</span></div>
                        <div class='rounded-lg border border-border/70 px-3 py-3 text-sm'><span class='font-medium text-foreground'>Transport</span><span class='ml-2 text-muted-foreground'>{{ checklistDetailsRecord.transportArranged ? 'Arranged' : 'Pending' }}</span></div>
                        <div class='rounded-lg border border-border/70 px-3 py-3 text-sm'><span class='font-medium text-foreground'>Billing</span><span class='ml-2 text-muted-foreground'>{{ checklistDetailsRecord.billingCleared ? 'Cleared' : 'Pending' }}</span></div>
                        <div class='rounded-lg border border-border/70 px-3 py-3 text-sm md:col-span-2'><span class='font-medium text-foreground'>Documentation</span><span class='ml-2 text-muted-foreground'>{{ checklistDetailsRecord.documentationCompleted ? 'Complete' : 'Pending' }}</span></div>
                    </div>
                    <div class='rounded-lg border border-border/70 p-4'>
                        <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Notes</p>
                        <p class='mt-3 text-sm leading-6 text-foreground'>{{ checklistDetailsRecord.notes || 'No discharge readiness notes were recorded for this admission.' }}</p>
                    </div>
                    <div class='rounded-lg border border-border/70 p-4'>
                        <div class='flex flex-wrap items-start justify-between gap-3'>
                            <div>
                                <p class='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Audit trail</p>
                                <p class='mt-1 text-sm text-muted-foreground'>{{ checklistAuditMeta?.total ?? checklistAuditLogs.length }} audit event{{ (checklistAuditMeta?.total ?? checklistAuditLogs.length) === 1 ? '' : 's' }} captured for this discharge checklist.</p>
                            </div>
                            <div v-if='canViewInpatientWardAudit' class='flex flex-wrap gap-2'>
                                <Button size='sm' variant='outline' @click='checklistAuditFiltersOpen = !checklistAuditFiltersOpen'>
                                    {{ checklistAuditFiltersOpen ? 'Hide filters' : 'Show filters' }}
                                </Button>
                                <Button size='sm' variant='outline' :disabled='checklistAuditLoading' @click='loadChecklistAuditLogs(checklistDetailsRecord.id)'>
                                    {{ checklistAuditLoading ? 'Refreshing...' : 'Refresh' }}
                                </Button>
                                <Button size='sm' variant='outline' :disabled='checklistAuditLoading || checklistAuditExporting' @click='exportChecklistAuditLogsCsv'>
                                    {{ checklistAuditExporting ? 'Preparing...' : 'Export CSV' }}
                                </Button>
                            </div>
                        </div>
                        <Alert v-if='!canViewInpatientWardAudit' variant='destructive' class='mt-4'>
                            <AlertTitle>Audit access restricted</AlertTitle>
                            <AlertDescription>Request <code>inpatient.ward.view-audit-logs</code> permission.</AlertDescription>
                        </Alert>
                        <div v-else class='mt-4 space-y-3'>
                            <div v-if='checklistAuditFiltersOpen' class='grid gap-3 rounded-lg border border-border/70 bg-muted/10 p-4 md:grid-cols-2 xl:grid-cols-3'>
                                <div class='grid gap-2'>
                                    <Label for='checklist-audit-q'>Action text search</Label>
                                    <Input id='checklist-audit-q' v-model='checklistAuditFilters.q' placeholder='status.updated, pdf, blocked...' />
                                </div>
                                <div class='grid gap-2'>
                                    <Label for='checklist-audit-action'>Action</Label>
                                    <Select :model-value='checklistAuditFilters.action || "all"' @update:model-value='(value) => { checklistAuditFilters.action = value === "all" ? "" : String(value); }'>
                                        <SelectTrigger id='checklist-audit-action' class='w-full min-w-0 justify-between bg-background dark:bg-background'>
                                            <SelectValue placeholder='All actions' />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for='option in checklistAuditActionOptions' :key='`checklist-audit-action-${option.value || "all"}`' :value='option.value || "all"'>
                                                {{ option.label }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class='grid gap-2'>
                                    <Label for='checklist-audit-actor-type'>Actor type</Label>
                                    <Select :model-value='checklistAuditFilters.actorType || "all"' @update:model-value='(value) => { checklistAuditFilters.actorType = value === "all" ? "" : String(value); }'>
                                        <SelectTrigger id='checklist-audit-actor-type' class='w-full min-w-0 justify-between bg-background dark:bg-background'>
                                            <SelectValue placeholder='All actors' />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for='option in checklistAuditActorTypeOptions' :key='`checklist-audit-actor-type-${option.value || "all"}`' :value='option.value || "all"'>
                                                {{ option.label }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class='grid gap-2'>
                                    <Label for='checklist-audit-actor-id'>Actor user ID</Label>
                                    <Input id='checklist-audit-actor-id' v-model='checklistAuditFilters.actorId' inputmode='numeric' placeholder='Optional user ID' />
                                </div>
                                <div class='grid gap-2'>
                                    <Label for='checklist-audit-from'>From</Label>
                                    <Input id='checklist-audit-from' v-model='checklistAuditFilters.from' type='datetime-local' />
                                </div>
                                <div class='grid gap-2'>
                                    <Label for='checklist-audit-to'>To</Label>
                                    <Input id='checklist-audit-to' v-model='checklistAuditFilters.to' type='datetime-local' />
                                </div>
                                <div class='grid gap-2'>
                                    <Label for='checklist-audit-per-page'>Rows per page</Label>
                                    <Select :model-value='String(checklistAuditFilters.perPage)' @update:model-value='(value) => { checklistAuditFilters.perPage = Number(value); }'>
                                        <SelectTrigger id='checklist-audit-per-page' class='w-full min-w-0 justify-between bg-background dark:bg-background'>
                                            <SelectValue placeholder='20' />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value='10'>10</SelectItem>
                                            <SelectItem value='20'>20</SelectItem>
                                            <SelectItem value='50'>50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class='flex flex-wrap items-end gap-2 xl:col-span-2'>
                                    <Button size='sm' :disabled='checklistAuditLoading' @click='applyChecklistAuditFilters'>
                                        {{ checklistAuditLoading ? 'Applying...' : 'Apply Filters' }}
                                    </Button>
                                    <Button size='sm' variant='outline' :disabled='checklistAuditLoading' @click='resetChecklistAuditFiltersAndReload'>
                                        Reset
                                    </Button>
                                </div>
                            </div>
                            <p v-if='checklistAuditLoading' class='text-sm text-muted-foreground'>Loading audit logs...</p>
                            <p v-else-if='checklistAuditError' class='text-sm text-destructive'>{{ checklistAuditError }}</p>
                            <AuditTimelineList
                                v-else
                                :logs='checklistAuditLogs'
                                :format-date-time='formatDateTime'
                            />
                            <div class='flex items-center justify-between border-t pt-2 text-xs text-muted-foreground'>
                                <Button size='sm' variant='outline' :disabled='checklistAuditLoading || !checklistAuditMeta || (checklistAuditMeta.currentPage ?? 1) <= 1' @click='goToChecklistAuditPage((checklistAuditMeta?.currentPage ?? 2) - 1)'>
                                    Previous
                                </Button>
                                <p>Page {{ checklistAuditMeta?.currentPage ?? 1 }} of {{ checklistAuditMeta?.lastPage ?? 1 }} | {{ checklistAuditMeta?.total ?? checklistAuditLogs.length }} logs</p>
                                <Button size='sm' variant='outline' :disabled='checklistAuditLoading || !checklistAuditMeta || (checklistAuditMeta.currentPage ?? 1) >= (checklistAuditMeta.lastPage ?? 1)' @click='goToChecklistAuditPage((checklistAuditMeta?.currentPage ?? 0) + 1)'>
                                    Next
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div class='flex items-center justify-end gap-2 border-t pt-4'>
                        <Button variant='outline' @click='closeChecklistDetails'>Close</Button>
                        <Button variant='outline' @click='openChecklistPrintPreview(checklistDetailsRecord)'>Print summary</Button>
                        <Button v-if='canManageDischargeChecklist' class='gap-1.5' :disabled='actionLoadingId === checklistDetailsRecord.id' @click='openChecklistStatusFromDetails'><AppIcon name='refresh-cw' class='size-4' />Update status</Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>

        <Sheet :open='filterSheetOpen' @update:open='(open) => (filterSheetOpen = open)'>
            <SheetContent side='right' variant='action' size='lg'>
                <SheetHeader class='shrink-0 border-b px-4 py-3 text-left pr-12'>
                    <SheetTitle>All filters</SheetTitle>
                    <SheetDescription>Refine the ward task queue by priority and admission context.</SheetDescription>
                </SheetHeader>
                <div class='grid gap-4 px-4 py-4'>
                    <div class='grid gap-2'><Label for='filter-priority'>Priority</Label><Select :model-value='taskFilterDraft.priority || "all"' @update:model-value='(value) => { taskFilterDraft.priority = value === "all" ? "" : value; }'><SelectTrigger id='filter-priority' class='w-full min-w-0 justify-between bg-background dark:bg-background'><SelectValue placeholder='All priorities' /></SelectTrigger><SelectContent><SelectItem value='all'>All priorities</SelectItem><SelectItem v-for='option in taskPriorityOptions' :key='option' :value='option'>{{ formatEnumLabel(option) }}</SelectItem></SelectContent></Select></div>
                    <div class='grid gap-2'><Label for='filter-admission'>Admission</Label><Input id='filter-admission' v-model='taskFilterDraft.admissionId' placeholder='Admission number or ID' /></div>
                </div>
                <SheetFooter class='gap-2'><Button variant='outline' @click='resetFilters'>Reset</Button><Button @click='applyFilters'>Apply filters</Button></SheetFooter>
            </SheetContent>
        </Sheet>

        <Dialog :open='statusDialogOpen' @update:open='(open) => (open ? (statusDialogOpen = true) : closeStatusDialog())'>
            <DialogContent size='2xl' class='rounded-lg'>
                <DialogHeader>
                    <DialogTitle class='flex items-center gap-2'><AppIcon name='refresh-cw' class='size-5 text-muted-foreground' />Update status</DialogTitle>
                    <DialogDescription>Update the current workflow state for this inpatient ward record.</DialogDescription>
                </DialogHeader>
                <div class='space-y-4'>
                    <div class='grid gap-2'><Label for='status-dialog-status'>New status</Label><Select v-model='statusDialogStatus'><SelectTrigger id='status-dialog-status' class='w-full min-w-0 justify-between bg-background dark:bg-background'><SelectValue placeholder='Select new status' /></SelectTrigger><SelectContent><SelectItem v-for='option in statusDialogOptions' :key='option' :value='option'>{{ formatEnumLabel(option) }}</SelectItem></SelectContent></Select></div>
                    <div class='grid gap-2'><Label for='status-dialog-reason'>{{ statusDialogReasonLabel }}</Label><Textarea id='status-dialog-reason' v-model='statusDialogReason' rows='4' :placeholder='statusDialogReasonLabel' /></div>
                    <p v-if='statusDialogError && statusDialogError !== statusDialogBlockedReason' class='text-xs text-destructive'>{{ statusDialogError }}</p>
                    <Alert v-if='statusDialogBlockedReason' variant='destructive'><AppIcon name='triangle-alert' class='size-4' /><AlertDescription>{{ statusDialogBlockedReason }}</AlertDescription></Alert>
                </div>
                <DialogFooter class='gap-2'><Button variant='outline' @click='closeStatusDialog'>Close</Button><Button :disabled='Boolean(actionLoadingId) || Boolean(statusDialogBlockedReason)' @click='submitStatusDialog'>{{ actionLoadingId ? 'Saving...' : 'Save status' }}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>




























