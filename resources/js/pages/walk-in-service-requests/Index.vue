<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AuditTimelineList from '@/components/audit/AuditTimelineList.vue';
import AppIcon from '@/components/AppIcon.vue';
import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import ClinicalContextBanner from '@/components/domain/clinical/ClinicalContextBanner.vue';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGet, apiGetBlob, apiPatch, apiPost, isApiClientError } from '@/lib/apiClient';
import type { AuditActorSummary } from '@/lib/audit';
import type { AppIconName } from '@/lib/icons';
import { walkInServiceRequestStripeClass } from '@/lib/listRows';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { patientChartHref } from '@/lib/patientChart';
import type { BreadcrumbItem } from '@/types';

type DepartmentOptionRow = {
    value: string;
    label: string;
    code?: string | null;
    serviceType?: string | null;
};

type ServiceRequestDepartmentSummary = {
    id?: string | null;
    name?: string | null;
    code?: string | null;
    serviceType?: string | null;
    label?: string | null;
};

type ServiceRequestRow = {
    id: string;
    requestNumber: string | null;
    patientId: string | null;
    appointmentId?: string | null;
    departmentId?: string | null;
    department?: ServiceRequestDepartmentSummary | null;
    departmentLabel?: string | null;
    requestedByUserId?: string | number | null;
    serviceType: string | null;
    priority: string | null;
    status: string | null;
    notes: string | null;
    requestedAt?: string | null;
    acknowledgedAt?: string | null;
    acknowledgedByUserId?: string | number | null;
    completedAt?: string | null;
    statusReason?: string | null;
    linkedOrderType?: string | null;
    linkedOrderId?: string | null;
    linkedOrderNumber?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

type PatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
};

type ListMeta = {
    currentPage?: number;
    perPage?: number;
    total?: number;
    lastPage?: number;
};

type AuditEventRow = {
    id: string;
    action?: string | null;
    actionLabel?: string | null;
    actorId?: number | null;
    actorType?: string | null;
    actor?: AuditActorSummary | null;
    actorUserId?: string | number | null;
    fromStatus?: string | null;
    toStatus?: string | null;
    changes?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    createdAt?: string | null;
};

type StatusCounts = {
    pending: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    total: number;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Direct service queue', href: '/walk-in-service-requests' },
];

const { hasPermission, scope } = usePlatformAccess();

const canExport = () => hasPermission('service.requests.export');
const canViewAudit = () => hasPermission('service.requests.audit-logs.read');
const canCreate = () => hasPermission('service.requests.create');
const canUpdateStatus = () => hasPermission('service.requests.update-status');

const compactRows = useLocalStorageBoolean('walk-in-compact-rows', false);
const filtersSheetOpen = ref(false);

const routeSearchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

const serviceTypeOptions = [
    { value: '_all', label: 'All desks' },
    { value: 'laboratory', label: formatEnumLabel('laboratory') },
    { value: 'pharmacy', label: formatEnumLabel('pharmacy') },
    { value: 'radiology', label: formatEnumLabel('radiology') },
    { value: 'theatre_procedure', label: 'Procedure' },
];

const serviceTypeCreateOptions = [
    { value: 'laboratory', label: formatEnumLabel('laboratory') },
    { value: 'pharmacy', label: formatEnumLabel('pharmacy') },
    { value: 'radiology', label: formatEnumLabel('radiology') },
    { value: 'theatre_procedure', label: 'Procedure' },
];

const priorityFilterOptions = [
    { value: '_all', label: 'Any priority' },
    { value: 'routine', label: formatEnumLabel('routine') },
    { value: 'urgent', label: formatEnumLabel('urgent') },
];

const STATUS_TABS: { value: string; label: string; icon: AppIconName }[] = [
    { value: 'all', label: 'All', icon: 'layout-list' },
    { value: 'pending', label: 'Waiting', icon: 'calendar-clock' },
    { value: 'in_progress', label: 'Accepted', icon: 'log-in' },
    { value: 'completed', label: 'Closed', icon: 'check-circle' },
    { value: 'cancelled', label: 'Cancelled', icon: 'circle-x' },
];

// ─── Filters ─────────────────────────────────────────────────────────────────

const filters = reactive({
    q: '',
    serviceType: routeSearchParams.get('serviceType') ?? '_all',
    status: routeSearchParams.get('status') ?? '',
    priority: routeSearchParams.get('priority') ?? '_all',
    patientId: '',
    from: '',
    to: '',
    page: 1,
    perPage: 25,
});

const activeTab = ref<string>(filters.status !== '' ? filters.status : 'all');

watch(activeTab, (newTab) => {
    filters.status = newTab === 'all' ? '' : newTab;
    filters.page = 1;
    void loadList();
});

const activeFilterCount = computed(() => {
    let count = 0;
    if (filters.serviceType && filters.serviceType !== '_all') count++;
    if (filters.priority && filters.priority !== '_all') count++;
    if (filters.patientId) count++;
    if (filters.from || filters.to) count++;
    return count;
});

// ─── List state ───────────────────────────────────────────────────────────────

const loading = ref(false);
const exportLoading = ref(false);
const loadError = ref<string | null>(null);
const rows = ref<ServiceRequestRow[]>([]);
const meta = ref<ListMeta | null>(null);

// ─── Status counts ────────────────────────────────────────────────────────────

const statusCounts = ref<StatusCounts>({ pending: 0, in_progress: 0, completed: 0, cancelled: 0, total: 0 });

async function loadStatusCounts(): Promise<void> {
    try {
        const result = await apiGet<{ data: StatusCounts }>('/service-requests/status-counts', undefined, {
            entitlementContext: 'Direct service queue',
        });
        statusCounts.value = result.data ?? { pending: 0, in_progress: 0, completed: 0, cancelled: 0, total: 0 };
    } catch {
        // non-critical; ignore silently
    }
}

// ─── Pagination helper ────────────────────────────────────────────────────────

function buildPageList(current: number, last: number): (number | '...')[] {
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
    const result: (number | '...')[] = [1];
    if (current > 3) result.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(last - 1, current + 1); i++) {
        result.push(i);
    }
    if (current < last - 2) result.push('...');
    result.push(last);
    return result;
}

const pageList = computed(() => buildPageList(meta.value?.currentPage ?? 1, meta.value?.lastPage ?? 1));

// ─── Patient name hydration ────────────────────────────────────────────────────

const patientNames = ref<Record<string, string>>({});
const pendingLookups = new Set<string>();

function displayNameFromPatient(p: PatientSummary): string {
    const name = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ').trim();
    return name !== '' ? name : (p.patientNumber?.trim() || p.id);
}

async function hydratePatientName(patientId: string): Promise<void> {
    const id = patientId.trim();
    if (!id || patientNames.value[id] || pendingLookups.has(id)) return;
    pendingLookups.add(id);
    try {
        const response = await apiGet<{ data: PatientSummary }>(`/patients/${encodeURIComponent(id)}`);
        patientNames.value = { ...patientNames.value, [id]: displayNameFromPatient(response.data) };
    } catch {
        patientNames.value = { ...patientNames.value, [id]: id };
    } finally {
        pendingLookups.delete(id);
    }
}

function resolvedPatientName(patientId: string | null): string | null {
    if (!patientId) return null;
    return patientNames.value[patientId] ?? null;
}

// ─── Audit trail ──────────────────────────────────────────────────────────────

const auditLoading = ref(false);
const auditError = ref<string | null>(null);
const auditEvents = ref<AuditEventRow[]>([]);

// ─── Details sheet ─────────────────────────────────────────────────────────────

const detailsOpen = ref(false);
const detailsRow = ref<ServiceRequestRow | null>(null);
const detailsTab = ref<'details' | 'audit'>('details');

function openDetails(row: ServiceRequestRow): void {
    detailsRow.value = row;
    detailsTab.value = 'details';
    detailsOpen.value = true;
}

// ─── Status update ─────────────────────────────────────────────────────────────

type WorkflowAction = 'start' | 'complete' | 'cancel';
type WorkflowCheckKey = 'patientConfirmed' | 'destinationConfirmed' | 'requestReviewed';
type WorkflowStepState = 'done' | 'active' | 'pending' | 'blocked';
type WorkflowChecklistItem = {
    key: WorkflowCheckKey;
    label: string;
    description: string;
};
type WorkflowStep = {
    label: string;
    description: string;
    state: WorkflowStepState;
    timestamp?: string | null;
    icon: AppIconName;
};

const serviceWorkspaceRoutes: Record<string, string> = {
    laboratory: '/laboratory-orders',
    pharmacy: '/pharmacy-orders',
    radiology: '/radiology-orders',
    theatre_procedure: '/theatre-procedures',
};

const workflowOpen = ref(false);
const workflowAction = ref<WorkflowAction>('start');
const workflowRow = ref<ServiceRequestRow | null>(null);
const workflowReason = ref('');
const workflowError = ref<string | null>(null);
const workflowChecks = reactive<Record<WorkflowCheckKey, boolean>>({
    patientConfirmed: false,
    destinationConfirmed: false,
    requestReviewed: false,
});

const workflowTargetStatus = computed(() => {
    if (workflowAction.value === 'start') return 'in_progress';
    if (workflowAction.value === 'complete') return 'completed';
    return 'cancelled';
});

const workflowRequiresReason = computed(() => workflowAction.value === 'complete' || workflowAction.value === 'cancel');

const workflowTitle = computed(() => {
    if (workflowAction.value === 'start') return 'Accept direct service handoff';
    if (workflowAction.value === 'complete') return 'Close direct service handoff';
    return 'Cancel direct service ticket';
});

const workflowDescription = computed(() => {
    if (workflowAction.value === 'start') {
        return 'Confirm the patient, destination, and request context before the receiving desk accepts this work.';
    }
    if (workflowAction.value === 'complete') {
        return 'Use this only when the linked clinical order already exists but the handoff ticket still needs closure.';
    }

    return 'Cancel only when the patient will not proceed through this direct service desk.';
});

const workflowSubmitLabel = computed(() => {
    if (workflowAction.value === 'start') return 'Accept handoff';
    if (workflowAction.value === 'complete') return 'Close handoff';
    return 'Cancel ticket';
});

const workflowSubmitIcon = computed<AppIconName>(() => {
    if (workflowAction.value === 'complete') return 'check-circle';
    if (workflowAction.value === 'start') return 'log-in';
    return 'x';
});

const workflowChecklistItems = computed<WorkflowChecklistItem[]>(() => {
    if (workflowAction.value === 'complete') {
        return [
            {
                key: 'patientConfirmed',
                label: 'Patient and request confirmed',
                description: 'This ticket belongs to the patient being closed.',
            },
            {
                key: 'destinationConfirmed',
                label: 'Linked work record confirmed',
                description: 'The destination order or service record is present.',
            },
            {
                key: 'requestReviewed',
                label: 'Closure reason ready',
                description: 'The reason explains why this handoff needs manual closure.',
            },
        ];
    }

    if (workflowAction.value === 'cancel') {
        return [
            {
                key: 'patientConfirmed',
                label: 'Patient/request confirmed',
                description: 'The correct patient and ticket are selected.',
            },
            {
                key: 'destinationConfirmed',
                label: 'No active desk work remains',
                description: 'No linked order will be left waiting for this ticket.',
            },
            {
                key: 'requestReviewed',
                label: 'Cancellation reason ready',
                description: 'The reason is clear enough for audit review.',
            },
        ];
    }

    return [
        {
            key: 'patientConfirmed',
            label: 'Patient confirmed',
            description: 'The patient identity matches this direct service ticket.',
        },
        {
            key: 'destinationConfirmed',
            label: 'Destination confirmed',
            description: 'The patient is being sent to the right desk or department.',
        },
        {
            key: 'requestReviewed',
            label: 'Request reviewed',
            description: 'Priority, notes, and service context have been checked.',
        },
    ];
});

const workflowMissingLinkedRecord = computed(() => {
    if (workflowAction.value !== 'complete') return false;
    const row = workflowRow.value;
    return Boolean(row) && !row.linkedOrderId && !row.linkedOrderNumber;
});

const workflowCanSubmit = computed(() => {
    if (!workflowRow.value || statusUpdating.value) return false;
    if (workflowMissingLinkedRecord.value) return false;
    if (workflowChecklistItems.value.some((item) => !workflowChecks[item.key])) return false;
    if (workflowRequiresReason.value && workflowReason.value.trim() === '') return false;

    return true;
});

function resetWorkflow(): void {
    workflowError.value = null;
    workflowReason.value = '';
    workflowChecks.patientConfirmed = false;
    workflowChecks.destinationConfirmed = false;
    workflowChecks.requestReviewed = false;
    workflowRow.value = null;
    workflowAction.value = 'start';
}

function serviceTypeLabel(serviceType: string | null | undefined): string {
    return serviceType ? formatEnumLabel(serviceType) : 'No desk';
}

function requestNumberDisplay(row: ServiceRequestRow | null | undefined): string {
    if (!row) return '-';
    return row.requestNumber ?? row.id.slice(0, 8);
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString();
}

function departmentDisplay(row: ServiceRequestRow | null | undefined): string {
    if (!row?.departmentId && !row?.department) return 'No department selected';
    return departmentLabelForRow(row) ?? 'Resolving department...';
}

function linkedOrderDisplay(row: ServiceRequestRow | null | undefined): string {
    if (!row) return 'No linked work record';
    if (row.linkedOrderNumber) return row.linkedOrderNumber;
    if (row.linkedOrderId) return row.linkedOrderId;

    return 'No linked work record';
}

function serviceWorkspaceHref(row: ServiceRequestRow | null | undefined): string | null {
    if (!row?.serviceType) return null;

    const base = serviceWorkspaceRoutes[row.serviceType];
    if (!base) return null;

    const params = new URLSearchParams();
    params.set('tab', 'new');
    params.set('serviceRequestId', row.id);
    if (row.patientId) params.set('patientId', row.patientId);
    if (row.appointmentId) params.set('appointmentId', row.appointmentId);

    return `${base}?${params.toString()}`;
}

function serviceWorkspaceLabel(row: ServiceRequestRow | null | undefined): string {
    switch (row?.serviceType) {
        case 'laboratory':
            return 'Create lab order';
        case 'pharmacy':
            return 'Create pharmacy order';
        case 'radiology':
            return 'Create imaging order';
        case 'theatre_procedure':
            return 'Create procedure record';
        default:
            return 'Open service workspace';
    }
}

function canOpenServiceWorkspace(row: ServiceRequestRow | null | undefined): boolean {
    return row?.status === 'in_progress' && serviceWorkspaceHref(row) !== null;
}

function hasLinkedWorkRecord(row: ServiceRequestRow | null | undefined): boolean {
    return Boolean(row?.linkedOrderId || row?.linkedOrderNumber);
}

function canManuallyCloseHandoff(row: ServiceRequestRow | null | undefined): boolean {
    return row?.status === 'in_progress' && hasLinkedWorkRecord(row);
}

function workflowCurrentLabel(row: ServiceRequestRow): string {
    if (row.status === 'pending') return 'Waiting for desk acceptance';
    if (row.status === 'in_progress') {
        return row.linkedOrderId || row.linkedOrderNumber ? 'Work record linked' : 'Accepted by service desk';
    }
    if (row.status === 'completed') return 'Closed';
    if (row.status === 'cancelled') return 'Cancelled';

    return 'Unknown status';
}

function workflowCurrentDescription(row: ServiceRequestRow): string {
    if (row.status === 'pending') return 'Accept the handoff after confirming the patient and destination.';
    if (row.status === 'in_progress' && (row.linkedOrderId || row.linkedOrderNumber)) {
        return 'The linked order is available. Close the ticket after documenting the reason.';
    }
    if (row.status === 'in_progress') {
        return 'Create the linked order or work record in the destination workspace. The ticket closes automatically when the order is saved.';
    }
    if (row.status === 'completed') return row.statusReason || 'The service handoff was closed.';
    if (row.status === 'cancelled') return row.statusReason || 'The ticket was cancelled.';

    return 'Review this request before taking action.';
}

function workflowSteps(row: ServiceRequestRow): WorkflowStep[] {
    const status = row.status ?? '';
    const closed = status === 'completed' || status === 'cancelled';
    const started = status === 'in_progress' || closed || Boolean(row.acknowledgedAt);
    const linked = Boolean(row.linkedOrderId || row.linkedOrderNumber);

    return [
        {
            label: 'Requested',
            description: 'Ticket created for a direct service desk.',
            state: 'done',
            timestamp: row.requestedAt ?? row.createdAt,
            icon: 'clipboard-list',
        },
        {
            label: 'Accepted',
            description: started ? 'Receiving desk accepted the patient.' : 'Receiving desk has not accepted this ticket yet.',
            state: started ? 'done' : 'active',
            timestamp: row.acknowledgedAt,
            icon: 'log-in',
        },
        {
            label: 'Work record',
            description: linked ? `Linked to ${linkedOrderDisplay(row)}.` : 'Create the linked order or work record.',
            state: linked ? 'done' : (status === 'in_progress' ? 'active' : (closed ? 'blocked' : 'pending')),
            timestamp: null,
            icon: 'file-text',
        },
        {
            label: status === 'cancelled' ? 'Cancelled' : 'Closed',
            description: closed ? (row.statusReason || 'Ticket closed.') : 'Create the destination work record to close the handoff.',
            state: closed ? 'done' : (status === 'in_progress' ? 'active' : 'pending'),
            timestamp: row.completedAt,
            icon: status === 'cancelled' ? 'circle-x' : 'check-circle',
        },
    ];
}

function workflowStepCircleClass(state: WorkflowStepState): string {
    switch (state) {
        case 'done':
            return 'border-emerald-500 bg-emerald-500 text-white';
        case 'active':
            return 'border-primary bg-primary text-primary-foreground';
        case 'blocked':
            return 'border-destructive bg-destructive text-destructive-foreground';
        default:
            return 'border-border bg-background text-muted-foreground';
    }
}

function openWorkflow(row: ServiceRequestRow, action: WorkflowAction): void {
    resetWorkflow();
    workflowRow.value = row;
    workflowAction.value = action;
    workflowOpen.value = true;
}

function handleWorkflowOpenChange(open: boolean): void {
    workflowOpen.value = open;
    if (!open) resetWorkflow();
}

async function submitWorkflow(): Promise<void> {
    const row = workflowRow.value;
    if (!row || !canUpdateStatus() || statusUpdating.value) return;

    workflowError.value = null;

    if (workflowMissingLinkedRecord.value) {
        workflowError.value = 'Create or link the destination work record before closing this ticket.';
        return;
    }

    if (workflowChecklistItems.value.some((item) => !workflowChecks[item.key])) {
        workflowError.value = 'Confirm all checklist items before continuing.';
        return;
    }

    if (workflowRequiresReason.value && workflowReason.value.trim() === '') {
        workflowError.value = 'A reason is required for this status change.';
        return;
    }

    const ok = await updateRowStatus(
        row,
        workflowTargetStatus.value,
        workflowReason.value.trim() || null,
    );

    if (ok) {
        handleWorkflowOpenChange(false);
    }
}

const statusUpdating = ref<string | null>(null);

async function updateRowStatus(row: ServiceRequestRow, newStatus: string, statusReason: string | null = null): Promise<boolean> {
    if (!canUpdateStatus() || statusUpdating.value) return false;
    statusUpdating.value = row.id;
    try {
        const body: { status: string; statusReason?: string } = { status: newStatus };
        if (statusReason) {
            body.statusReason = statusReason;
        }

        const response = await apiPatch<{ data: ServiceRequestRow }>(`/service-requests/${encodeURIComponent(row.id)}/status`, {
            body,
            entitlementContext: 'Direct service status',
        });
        notifySuccess('Status updated successfully.');
        mergeDepartmentOptionsFromRows([response.data]);
        if (detailsRow.value?.id === row.id) {
            detailsRow.value = response.data;
            if (canViewAudit() && detailsTab.value === 'audit') void loadAuditForDetails();
        }
        void loadList();
        void loadStatusCounts();
        return true;
    } catch (error) {
        notifyError(messageFromUnknown(error));
        return false;
    } finally {
        statusUpdating.value = null;
    }
}

// ─── Create request ────────────────────────────────────────────────────────────

const createOpen = ref(false);
const createLoading = ref(false);
const createErrors = ref<Record<string, string>>({});
const createForm = reactive({
    patientId: '',
    departmentId: '',
    serviceType: '',
    priority: 'routine',
    notes: '',
});

const departmentOptions = ref<DepartmentOptionRow[]>([]);
const createDepartmentOptions = ref<DepartmentOptionRow[]>([]);
const departmentOptionsLoading = ref(false);

function resetCreateForm(): void {
    createForm.patientId = '';
    createForm.departmentId = '';
    createForm.serviceType = '';
    createForm.priority = 'routine';
    createForm.notes = '';
    createDepartmentOptions.value = [];
    createErrors.value = {};
}

function departmentSummaryLabel(department: ServiceRequestDepartmentSummary | null | undefined): string | null {
    const label = department?.label?.trim();
    if (label) return label;

    const name = department?.name?.trim();
    const code = department?.code?.trim();

    if (code && name) return `${code} - ${name}`;
    if (name) return name;

    return null;
}

function departmentOptionFromRow(row: ServiceRequestRow): DepartmentOptionRow | null {
    const id = row.departmentId?.trim() || row.department?.id?.trim() || '';
    const label = departmentSummaryLabel(row.department) ?? row.departmentLabel?.trim() ?? '';

    if (!id || !label) return null;

    return {
        value: id,
        label,
        code: row.department?.code ?? null,
        serviceType: row.department?.serviceType ?? null,
    };
}

function mergeDepartmentOptions(options: DepartmentOptionRow[]): void {
    if (options.length === 0) return;

    const byId = new Map<string, DepartmentOptionRow>();
    for (const option of departmentOptions.value) {
        if (option.value) byId.set(option.value, option);
    }

    for (const option of options) {
        const value = option.value?.trim();
        const label = option.label?.trim();
        if (!value || !label) continue;

        const existing = byId.get(value) ?? {};
        byId.set(value, {
            ...existing,
            ...option,
            value,
            label,
        });
    }

    departmentOptions.value = Array.from(byId.values());
}

function mergeDepartmentOptionsFromRows(serviceRows: ServiceRequestRow[]): void {
    mergeDepartmentOptions(
        serviceRows
            .map(departmentOptionFromRow)
            .filter((option): option is DepartmentOptionRow => option !== null),
    );
}

function departmentLabel(id: string | null | undefined): string | null {
    if (!id) return null;
    return departmentOptions.value.find((o) => o.value === id)?.label ?? null;
}

function departmentLabelForRow(row: ServiceRequestRow | null | undefined): string | null {
    if (!row) return null;

    return departmentSummaryLabel(row.department)
        ?? row.departmentLabel?.trim()
        ?? departmentLabel(row.departmentId);
}

function selectedCreateDepartmentOption(): DepartmentOptionRow | null {
    const departmentId = createForm.departmentId.trim();
    if (!departmentId) return null;

    return createDepartmentOptions.value.find((option) => option.value === departmentId)
        ?? departmentOptions.value.find((option) => option.value === departmentId)
        ?? null;
}

const selectedCreateServiceTypeOption = computed(() =>
    serviceTypeCreateOptions.find((option) => option.value === createForm.serviceType) ?? null,
);

const createPatientContextLabel = computed(() => {
    const patientId = createForm.patientId.trim();
    if (!patientId) return null;
    return resolvedPatientName(patientId) ?? 'Selected patient';
});

const createPatientContextMeta = computed(() => {
    if (!createForm.patientId.trim()) return null;
    return 'Selected from registered patients';
});

const createRequestWorkflowContextLabel = computed(() =>
    selectedCreateServiceTypeOption.value?.label ?? 'Direct service request',
);

const createRequestWorkflowContextMeta = computed(() => {
    const details = [
        selectedCreateDepartmentOption.value?.label
            ? `Destination: ${selectedCreateDepartmentOption.value.label}`
            : null,
        createForm.priority ? `Priority: ${formatEnumLabel(createForm.priority)}` : null,
    ].filter((value): value is string => Boolean(value));

    if (details.length > 0) {
        return details.join(' | ');
    }

    if (createForm.serviceType) {
        return 'Choose the matching destination department before sending the patient.';
    }

    return 'Select the patient and destination desk before creating the handoff.';
});

const createRequestContextStatusLabel = computed(() => {
    if (!createForm.patientId.trim()) return 'Patient required';
    if (!createForm.serviceType) return 'Destination desk required';
    if (!createForm.departmentId.trim()) return 'Destination pending';
    return 'Ready to create';
});

const createRequestContextStatusVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    if (!createForm.patientId.trim()) return 'secondary';
    if (!createForm.serviceType) return 'secondary';
    if (!createForm.departmentId.trim()) return 'outline';
    return 'default';
});

function handleCreateDepartmentChange(value: unknown): void {
    const departmentId = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    const selected = departmentId
        ? createDepartmentOptions.value.find((option) => option.value === departmentId)
        : null;

    createForm.departmentId = selected?.value ?? departmentId;
    createErrors.value.departmentId = '';
}

async function loadDepartmentOptions(): Promise<void> {
    if (departmentOptionsLoading.value) return;
    departmentOptionsLoading.value = true;
    try {
        const result = await apiGet<{ data: DepartmentOptionRow[] }>('/service-requests/department-options', undefined, {
            entitlementContext: 'Direct service queue',
        });
        mergeDepartmentOptions(result.data ?? []);
    } catch {
        // Keep already-resolved labels from the queue/details response.
    } finally {
        departmentOptionsLoading.value = false;
    }
}

async function loadCreateDepartmentOptions(): Promise<void> {
    createForm.departmentId = '';
    createErrors.value.departmentId = '';
    if (!createForm.serviceType) {
        createDepartmentOptions.value = [];
        return;
    }

    departmentOptionsLoading.value = true;
    try {
        const result = await apiGet<{ data: DepartmentOptionRow[] }>(
            '/service-requests/department-options',
            { serviceType: createForm.serviceType },
            { entitlementContext: 'Direct service queue' },
        );
        createDepartmentOptions.value = result.data ?? [];
        mergeDepartmentOptions(createDepartmentOptions.value);
    } catch {
        createDepartmentOptions.value = [];
    } finally {
        departmentOptionsLoading.value = false;
    }
}

async function submitCreate(): Promise<void> {
    if (createLoading.value) return;
    createErrors.value = {};
    const selectedDepartment = selectedCreateDepartmentOption();
    const departmentId = selectedDepartment?.value ?? createForm.departmentId.trim();

    if (!createForm.patientId) {
        createErrors.value.patientId = 'Patient is required.';
        return;
    }
    if (!createForm.serviceType) {
        createErrors.value.serviceType = 'Service desk is required.';
        return;
    }
    if (createDepartmentOptions.value.length > 0 && departmentId === '') {
        createErrors.value.departmentId = 'Select the destination department.';
        return;
    }

    createLoading.value = true;
    try {
        const payload = {
            patientId: createForm.patientId,
            departmentId: departmentId || null,
            serviceType: createForm.serviceType,
            priority: createForm.priority || null,
            notes: createForm.notes.trim() || null,
        };

        const response = await apiPost<{ data: ServiceRequestRow }>('/service-requests', {
            body: payload,
            entitlementContext: 'Direct service create',
        });
        mergeDepartmentOptionsFromRows([response.data]);
        if (payload.departmentId && response.data.departmentId !== payload.departmentId) {
            notifyError('The request was created, but the destination department was not saved.');
            void loadList();
            void loadStatusCounts();
            return;
        }
        notifySuccess('Direct service request created.');
        createOpen.value = false;
        resetCreateForm();
        void loadList();
        void loadStatusCounts();
    } catch (error) {
        if (isApiClientError(error)) {
            const payload = error.payload as Record<string, unknown> | null;
            const errors = payload?.errors;
            if (errors && typeof errors === 'object') {
                const errMap = errors as Record<string, string[]>;
                for (const [field, msgs] of Object.entries(errMap)) {
                    if (Array.isArray(msgs) && msgs.length > 0) {
                        createErrors.value[field] = msgs[0];
                    }
                }
                return;
            }
            notifyError(error.message);
        } else {
            notifyError(messageFromUnknown(error));
        }
    } finally {
        createLoading.value = false;
    }
}

// ─── Status badge helpers ──────────────────────────────────────────────────────

function statusBadgeClass(status: string | null): string {
    switch (status) {
        case 'pending':
            return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
        case 'in_progress':
            return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
        case 'completed':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
        case 'cancelled':
            return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300';
        default:
            return '';
    }
}

function statusDisplayLabel(status: string | null | undefined): string {
    switch (status) {
        case 'pending':
            return 'Waiting';
        case 'in_progress':
            return 'Accepted';
        case 'completed':
            return 'Closed';
        case 'cancelled':
            return 'Cancelled';
        default:
            return status ? formatEnumLabel(status) : '-';
    }
}

// ─── Load list ─────────────────────────────────────────────────────────────────

async function loadList(): Promise<void> {
    if (loading.value) return;

    loading.value = true;
    loadError.value = null;

    try {
        const query: Record<string, string | number> = {
            page: filters.page,
            perPage: filters.perPage,
            sortDir: 'desc',
        };
        if (filters.q.trim()) query.q = filters.q.trim();
        if (filters.serviceType && filters.serviceType !== '_all') query.serviceType = filters.serviceType;
        if (filters.status) query.status = filters.status;
        if (filters.priority && filters.priority !== '_all') query.priority = filters.priority;
        if (filters.patientId) query.patientId = filters.patientId;
        if (filters.from) query.from = filters.from;
        if (filters.to) query.to = filters.to;

        const result = await apiGet<{ data: ServiceRequestRow[]; meta: ListMeta }>('/service-requests', query, {
            entitlementContext: 'Direct service queue',
        });

        rows.value = result.data ?? [];
        mergeDepartmentOptionsFromRows(rows.value);
        meta.value = result.meta ?? null;

        for (const row of rows.value) {
            if (row.patientId) void hydratePatientName(row.patientId);
        }
    } catch (error) {
        rows.value = [];
        meta.value = null;
        loadError.value = isApiClientError(error) ? error.message : messageFromUnknown(error);
    } finally {
        loading.value = false;
    }
}

function goToPage(next: number): void {
    const last = meta.value?.lastPage ?? 1;
    const clamped = Math.min(Math.max(next, 1), Math.max(last, 1));
    if (clamped === filters.page) return;
    filters.page = clamped;
    void loadList();
}

function changePerPage(value: string): void {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    filters.perPage = Math.min(parsed, 100);
    filters.page = 1;
    void loadList();
}

function applyFilters(): void {
    filters.page = 1;
    void loadList();
}

function resetFilters(): void {
    filters.serviceType = '_all';
    filters.priority = '_all';
    filters.patientId = '';
    filters.from = '';
    filters.to = '';
    filters.page = 1;
    filtersSheetOpen.value = false;
    void loadList();
}

async function downloadExport(): Promise<void> {
    if (!canExport() || exportLoading.value) return;

    exportLoading.value = true;

    try {
        const query: Record<string, string> = {};
        if (filters.q.trim()) query.q = filters.q.trim();
        if (filters.serviceType && filters.serviceType !== '_all') query.serviceType = filters.serviceType;
        if (filters.status) query.status = filters.status;
        if (filters.priority && filters.priority !== '_all') query.priority = filters.priority;
        if (filters.patientId) query.patientId = filters.patientId;
        if (filters.from) query.from = filters.from;
        if (filters.to) query.to = filters.to;

        const { blob, filename } = await apiGetBlob('/service-requests/export/csv', {
            query,
            entitlementContext: 'Direct service export',
        });

        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename?.trim() !== '' ? filename : 'service-requests.csv';
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
    } catch (error) {
        notifyError(messageFromUnknown(error));
    } finally {
        exportLoading.value = false;
    }
}

async function loadAuditForDetails(): Promise<void> {
    if (!detailsRow.value || !canViewAudit()) return;

    auditEvents.value = [];
    auditError.value = null;
    auditLoading.value = true;

    try {
        const response = await apiGet<{ data: AuditEventRow[] }>(
            `/service-requests/${encodeURIComponent(detailsRow.value.id)}/audit-events`,
            undefined,
            { entitlementContext: 'Direct service audit' },
        );
        auditEvents.value = (response.data ?? []).map((event) => {
            const legacyActorId = typeof event.actorUserId === 'number'
                ? event.actorUserId
                : Number.parseInt(String(event.actorUserId ?? ''), 10);

            return {
                ...event,
                actorId: event.actorId ?? (Number.isFinite(legacyActorId) ? legacyActorId : undefined),
            };
        });
    } catch (error) {
        auditError.value = messageFromUnknown(error);
    } finally {
        auditLoading.value = false;
    }
}

watch(detailsTab, (tab) => {
    if (tab === 'audit') void loadAuditForDetails();
});

watch(() => createForm.serviceType, () => {
    if (createOpen.value) void loadCreateDepartmentOptions();
});

watch(
    () => createForm.patientId,
    (value) => {
        const patientId = value.trim();
        if (patientId) void hydratePatientName(patientId);
    },
);

onMounted(() => {
    void loadList();
    void loadStatusCounts();
    void loadDepartmentOptions();
});
</script>

<template>
    <Head title="Direct service queue" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-3 md:p-5 lg:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20" aria-hidden="true">
                            <AppIcon name="clipboard-list" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">Direct Service Queue</h1>
                                <Badge variant="secondary" class="h-5 px-1.5 text-[11px]">{{ statusCounts.total }} total</Badge>
                            </div>
                            <p class="truncate text-xs text-muted-foreground">
                                Manage patients sent straight to laboratory, pharmacy, imaging, and procedure desks.
                            </p>
                            <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground">
                                <span class="inline-flex items-center gap-1">
                                    <AppIcon name="building-2" class="size-3 opacity-75" aria-hidden="true" />
                                    <span class="font-medium text-foreground">{{ scope?.facility?.name || 'No facility' }}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5"
                            :disabled="loading"
                            @click="void loadList(); void loadStatusCounts()"
                        >
                            <AppIcon name="refresh-cw" class="size-3.5" :class="{ 'animate-spin': loading }" />
                            Refresh
                        </Button>
                        <Button
                            v-if="canExport()"
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5"
                            :disabled="exportLoading"
                            @click="downloadExport()"
                        >
                            <AppIcon v-if="exportLoading" name="refresh-cw" class="size-3.5 animate-spin" />
                            <AppIcon v-else name="file-text" class="size-3.5" />
                            Export CSV
                        </Button>
                        <Button v-if="canCreate()" size="sm" class="h-8 gap-1.5" @click="createOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            New request
                        </Button>
                    </div>
                </div>
            </section>

            <!-- Status count bar -->
            <div class="flex min-h-9 flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2">
                <span class="text-xs font-medium text-muted-foreground">Queue overview:</span>
                <button
                    type="button"
                    class="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted/60"
                    :class="activeTab === 'pending' ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : 'border-border'"
                    @click="activeTab = 'pending'"
                >
                    <span class="font-medium text-foreground">{{ statusCounts.pending }}</span>
                    <span class="text-muted-foreground">Waiting</span>
                </button>
                <button
                    type="button"
                    class="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted/60"
                    :class="activeTab === 'in_progress' ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30' : 'border-border'"
                    @click="activeTab = 'in_progress'"
                >
                    <span class="font-medium text-foreground">{{ statusCounts.in_progress }}</span>
                    <span class="text-muted-foreground">Accepted</span>
                </button>
                <button
                    type="button"
                    class="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted/60"
                    :class="activeTab === 'completed' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-border'"
                    @click="activeTab = 'completed'"
                >
                    <span class="font-medium text-foreground">{{ statusCounts.completed }}</span>
                    <span class="text-muted-foreground">Closed</span>
                </button>
                <button
                    type="button"
                    class="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted/60"
                    :class="activeTab === 'cancelled' ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30' : 'border-border'"
                    @click="activeTab = 'cancelled'"
                >
                    <span class="font-medium text-foreground">{{ statusCounts.cancelled }}</span>
                    <span class="text-muted-foreground">Cancelled</span>
                </button>
                <span class="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <span class="font-medium text-foreground">{{ statusCounts.total }}</span> total
                </span>
            </div>

            <!-- Error alert -->
            <Alert v-if="loadError" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="circle-x" class="size-4" />
                    Failed to load requests
                </AlertTitle>
                <AlertDescription>{{ loadError }}</AlertDescription>
            </Alert>

            <!-- Status tabs + queue card -->
            <Tabs :model-value="activeTab" class="flex min-h-0 flex-1 flex-col gap-4" @update:model-value="activeTab = $event as string">
                <TabsList class="w-full justify-start">
                    <TabsTrigger v-for="tab in STATUS_TABS" :key="tab.value" :value="tab.value" class="gap-1.5">
                        <AppIcon :name="tab.icon" class="size-3.5" />
                        {{ tab.label }}
                    </TabsTrigger>
                </TabsList>

                <Card class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                    <!-- Card title row -->
                    <div class="flex items-center gap-4 border-b px-4 py-3.5">
                        <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                            <AppIcon name="clipboard-list" class="size-4 text-muted-foreground" />
                            Service Requests
                            <span v-if="meta?.total !== undefined" class="ml-1 text-xs font-normal text-muted-foreground">
                                &middot; {{ meta.total }} result{{ meta.total !== 1 ? 's' : '' }}
                            </span>
                        </h3>
                    </div>

                    <!-- Filter toolbar (compact: search + filters sheet + compact toggle) -->
                    <div class="flex items-center gap-2 border-b px-4 py-3">
                        <SearchInput
                            id="walk-in-q"
                            v-model="filters.q"
                            placeholder="Search ticket, notes..."
                            class="min-w-0 flex-1 text-xs"
                            @keyup.enter="applyFilters()"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            class="h-9 gap-1.5 rounded-lg text-xs"
                            @click="filtersSheetOpen = true"
                        >
                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                            Filters
                            <Badge
                                v-if="activeFilterCount > 0"
                                variant="secondary"
                                class="ml-1 h-5 px-1.5 text-[10px]"
                            >
                                {{ activeFilterCount }}
                            </Badge>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            class="hidden h-9 rounded-lg text-xs sm:inline-flex"
                            @click="compactRows = !compactRows"
                        >
                            {{ compactRows ? 'Comfortable' : 'Compact' }}
                        </Button>
                    </div>

                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="min-h-[12rem] p-4" :class="compactRows ? 'space-y-2' : 'space-y-3'">
                                <!-- Loading skeleton -->
                                <div v-if="loading" class="space-y-2">
                                    <WorkflowQueueSkeleton :count="3" :show-trailing="false" />
                                </div>

                                <!-- Empty state -->
                                <div v-else-if="rows.length === 0" class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                                    <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                        <AppIcon name="clipboard-list" class="size-5 text-muted-foreground/40" />
                                    </div>
                                    <div class="space-y-1">
                                        <p class="text-sm font-semibold">No requests found</p>
                                        <p class="max-w-xs text-xs text-muted-foreground">No direct service requests match the current filters.</p>
                                    </div>
                                </div>

                                <!-- Request rows -->
                                <div v-else :class="compactRows ? 'space-y-2' : 'space-y-3'">
                                    <WorkflowQueueRow
                                        v-for="row in rows"
                                        :key="row.id"
                                        variant="card"
                                        :compact="compactRows"
                                        interactive
                                        :stripe-class="walkInServiceRequestStripeClass(row.status)"
                                        @activate="openDetails(row)"
                                    >
                                        <!-- Header: ticket # + desk + timestamps + badges -->
                                        <div class="flex flex-wrap items-start justify-between gap-2">
                                            <div class="min-w-0">
                                                <p class="text-sm font-semibold">{{ row.requestNumber ?? row.id }}</p>
                                                <p class="text-xs text-muted-foreground">
                                                    {{ row.serviceType ? formatEnumLabel(row.serviceType) : '—' }}
                                                    &middot;
                                                    {{ row.requestedAt ? new Date(row.requestedAt).toLocaleString() : '—' }}
                                                </p>
                                            </div>
                                            <div class="flex flex-wrap items-center gap-1.5">
                                                <span
                                                    v-if="row.priority === 'urgent'"
                                                    class="inline-flex rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-200"
                                                >
                                                    Urgent
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    class="font-normal capitalize"
                                                    :class="statusBadgeClass(row.status)"
                                                >
                                                    {{ statusDisplayLabel(row.status) }}
                                                </Badge>
                                            </div>
                                        </div>

                                        <!-- Patient row -->
                                        <div class="mt-1.5 text-xs text-muted-foreground">
                                            <template v-if="row.patientId">
                                                Patient:
                                                <span
                                                    v-if="resolvedPatientName(row.patientId)"
                                                    class="font-medium text-foreground"
                                                >
                                                    {{ resolvedPatientName(row.patientId) }}
                                                </span>
                                                <span v-else class="italic text-muted-foreground/60">Loading…</span>
                                                &nbsp;&middot;&nbsp;
                                                <a
                                                    class="text-primary underline-offset-4 hover:underline"
                                                    :href="patientChartHref(row.patientId)"
                                                    @click.stop
                                                >Open chart</a>
                                            </template>
                                            <span v-else>No patient linked</span>
                                        </div>

                                        <div class="mt-1 text-xs text-muted-foreground">
                                            Department:
                                            <span class="font-medium text-foreground">
                                                {{ departmentDisplay(row) }}
                                            </span>
                                        </div>

                                        <template #actions>
                                            <Button
                                                v-if="canUpdateStatus() && row.status === 'pending'"
                                                size="sm"
                                                variant="default"
                                                class="h-8 gap-1.5 rounded-lg text-xs"
                                                :disabled="statusUpdating === row.id"
                                                @click="openWorkflow(row, 'start')"
                                            >
                                                <AppIcon name="log-in" class="size-3.5" />
                                                Accept
                                            </Button>
                                            <Button
                                                v-else-if="canOpenServiceWorkspace(row)"
                                                as="a"
                                                :href="serviceWorkspaceHref(row) ?? undefined"
                                                size="sm"
                                                variant="default"
                                                class="h-8 gap-1.5 rounded-lg text-xs"
                                            >
                                                <AppIcon name="arrow-up-right" class="size-3.5" />
                                                {{ serviceWorkspaceLabel(row) }}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                class="h-8 gap-1.5 rounded-lg text-xs"
                                                @click="openDetails(row)"
                                            >
                                                <AppIcon name="layout-grid" class="size-3.5" />
                                                Review
                                            </Button>
                                        </template>
                                    </WorkflowQueueRow>
                                </div>
                            </div>
                        </ScrollArea>

                        <!-- Pagination footer -->
                        <footer
                            v-if="!loading && meta && (meta.lastPage ?? 1) > 1"
                            class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2"
                        >
                            <p class="text-xs text-muted-foreground">
                                Showing {{ rows.length }} of {{ meta.total ?? rows.length }} &middot;
                                Page {{ meta.currentPage ?? 1 }} of {{ meta.lastPage ?? 1 }}
                            </p>
                            <div class="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="(meta.currentPage ?? 1) <= 1 || loading"
                                    @click="goToPage((meta.currentPage ?? 1) - 1)"
                                >
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Previous
                                </Button>
                                <template v-for="pg in pageList" :key="typeof pg === 'number' ? `p-${pg}` : `e-${Math.random()}`">
                                    <span v-if="pg === '...'" class="px-1 text-xs text-muted-foreground">&hellip;</span>
                                    <Button
                                        v-else
                                        size="sm"
                                        :variant="pg === (meta?.currentPage ?? 1) ? 'default' : 'outline'"
                                        class="h-8 w-8 p-0"
                                        :disabled="loading"
                                        @click="goToPage(pg as number)"
                                    >
                                        {{ pg }}
                                    </Button>
                                </template>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="(meta.currentPage ?? 1) >= (meta.lastPage ?? 1) || loading"
                                    @click="goToPage((meta.currentPage ?? 1) + 1)"
                                >
                                    Next
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>
            </Tabs>
        </div>

        <!-- ── Details sheet ──────────────────────────────────────────────────── -->
        <Sheet v-model:open="detailsOpen">
            <SheetContent side="right" variant="workspace" size="5xl" class="flex h-full min-h-0 flex-col">
                <SheetHeader class="shrink-0 border-b bg-background px-4 py-3 text-left pr-12">
                    <SheetTitle class="flex min-w-0 flex-wrap items-center gap-2">
                        <AppIcon name="clipboard-list" class="size-4 text-muted-foreground" />
                        {{ detailsRow?.requestNumber ?? detailsRow?.id?.slice(0, 8) ?? '—' }}
                        <Badge
                            v-if="detailsRow?.status"
                            variant="outline"
                            class="font-normal capitalize"
                            :class="statusBadgeClass(detailsRow.status)"
                        >
                            {{ statusDisplayLabel(detailsRow.status) }}
                        </Badge>
                        <span
                            v-if="detailsRow?.priority === 'urgent'"
                            class="inline-flex rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-200"
                        >
                            Urgent
                        </span>
                    </SheetTitle>
                    <SheetDescription v-if="detailsRow" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span class="flex items-center gap-1">
                            <AppIcon name="stethoscope" class="size-3 opacity-50" />
                            <span>{{ serviceTypeLabel(detailsRow.serviceType) }}</span>
                        </span>
                        <span class="text-muted-foreground/40">&middot;</span>
                        <span class="flex items-center gap-1">
                            <AppIcon name="building-2" class="size-3 opacity-50" />
                            <span>{{ departmentDisplay(detailsRow) }}</span>
                        </span>
                        <span class="text-muted-foreground/40">&middot;</span>
                        <span class="flex items-center gap-1">
                            <AppIcon name="calendar-clock" class="size-3 opacity-50" />
                            <span>{{ formatDateTime(detailsRow.requestedAt ?? detailsRow.createdAt) }}</span>
                        </span>
                    </SheetDescription>
                </SheetHeader>

                <div v-if="detailsRow" class="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <!-- Info cards -->
                    <div class="shrink-0 border-b bg-muted/5 px-4 py-3">
                        <div class="grid gap-2 md:grid-cols-3">
                            <div class="rounded-lg border bg-background/70 px-3 py-2">
                                <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Request</p>
                                <p class="mt-0.5 truncate text-sm font-semibold leading-4">
                                    {{ detailsRow.requestNumber ?? detailsRow.id.slice(0, 8) }}
                                </p>
                                <p class="truncate text-xs leading-4 text-muted-foreground">
                                    {{ detailsRow.serviceType ? formatEnumLabel(detailsRow.serviceType) : 'No desk' }}
                                </p>
                            </div>
                            <div class="rounded-lg border bg-background/70 px-3 py-2">
                                <div class="flex items-center justify-between gap-2">
                                    <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Patient</p>
                                    <a
                                        v-if="detailsRow.patientId"
                                        class="text-xs text-primary underline-offset-4 hover:underline"
                                        :href="patientChartHref(detailsRow.patientId)"
                                    >Open chart</a>
                                </div>
                                <p class="mt-0.5 truncate text-sm font-semibold leading-4">
                                    <span v-if="detailsRow.patientId && resolvedPatientName(detailsRow.patientId)">
                                        {{ resolvedPatientName(detailsRow.patientId) }}
                                    </span>
                                    <span v-else-if="detailsRow.patientId" class="italic text-muted-foreground/60">Loading…</span>
                                    <span v-else class="text-muted-foreground">—</span>
                                </p>
                                <p class="truncate text-xs leading-4 capitalize text-muted-foreground">
                                    {{ detailsRow.priority ? formatEnumLabel(detailsRow.priority) : 'No priority' }} priority
                                </p>
                            </div>
                            <div class="rounded-lg border bg-background/70 px-3 py-2">
                                <div class="flex items-center justify-between gap-2">
                                    <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Workflow</p>
                                    <Badge variant="secondary" class="capitalize">{{ detailsRow.priority || 'routine' }}</Badge>
                                </div>
                                <p class="mt-0.5 truncate text-sm font-semibold leading-4">
                                    {{ workflowCurrentLabel(detailsRow) }}
                                </p>
                                <p class="truncate text-xs leading-4 text-muted-foreground">
                                    {{ linkedOrderDisplay(detailsRow) }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Tabs: Details / Audit -->
                    <Tabs v-model="detailsTab" class="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div class="shrink-0 border-b px-4 py-3">
                            <TabsList class="flex h-auto w-full flex-wrap justify-start gap-2 rounded-lg bg-transparent p-0">
                                <TabsTrigger
                                    value="details"
                                    class="gap-1.5 rounded-md border px-3 py-1.5 text-xs data-[state=active]:border-primary/40 data-[state=active]:bg-background"
                                >
                                    <AppIcon name="layout-grid" class="size-3.5" />
                                    Details
                                </TabsTrigger>
                                <TabsTrigger
                                    v-if="canViewAudit()"
                                    value="audit"
                                    class="gap-1.5 rounded-md border px-3 py-1.5 text-xs data-[state=active]:border-primary/40 data-[state=active]:bg-background"
                                >
                                    <AppIcon name="file-text" class="size-3.5" />
                                    Audit
                                    <Badge v-if="auditEvents.length > 0" variant="secondary" class="h-4 min-w-4 px-1 text-xs">
                                        {{ auditEvents.length }}
                                    </Badge>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                            <!-- Details tab -->
                            <TabsContent value="details" class="m-0 space-y-3 px-6 py-4">
                                <Alert v-if="detailsRow.status === 'in_progress' && !detailsRow.linkedOrderId && !detailsRow.linkedOrderNumber">
                                    <AppIcon name="alert-triangle" class="size-4" />
                                    <AlertTitle>Create the destination work record</AlertTitle>
                                    <AlertDescription>
                                        Use the destination workspace to create the clinical order. The direct service ticket closes automatically after that record is saved.
                                    </AlertDescription>
                                </Alert>

                                <Card class="rounded-lg !gap-0 overflow-hidden">
                                    <CardHeader class="bg-muted/40 px-4 py-2.5">
                                        <CardTitle class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            <AppIcon name="activity" class="size-3.5" />
                                            Service Flow
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent class="px-4 py-3">
                                        <div class="space-y-3">
                                            <div
                                                v-for="(step, index) in workflowSteps(detailsRow)"
                                                :key="`${step.label}-${index}`"
                                                class="flex gap-3"
                                            >
                                                <div class="flex flex-col items-center">
                                                    <div
                                                        class="flex size-8 items-center justify-center rounded-full border text-xs"
                                                        :class="workflowStepCircleClass(step.state)"
                                                    >
                                                        <AppIcon :name="step.icon" class="size-3.5" />
                                                    </div>
                                                    <div v-if="index < workflowSteps(detailsRow).length - 1" class="mt-1 h-8 w-px bg-border" />
                                                </div>
                                                <div class="min-w-0 flex-1 pb-2">
                                                    <div class="flex flex-wrap items-center justify-between gap-2">
                                                        <p class="text-sm font-semibold">{{ step.label }}</p>
                                                        <span v-if="step.timestamp" class="text-xs text-muted-foreground">
                                                            {{ formatDateTime(step.timestamp) }}
                                                        </span>
                                                    </div>
                                                    <p class="text-xs text-muted-foreground">{{ step.description }}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <dl class="grid grid-cols-2 gap-x-4 gap-y-4 rounded-lg border bg-card p-4 text-sm">
                                    <div>
                                        <dt class="text-xs font-medium text-muted-foreground">Desk</dt>
                                        <dd class="mt-0.5 capitalize text-foreground">
                                            {{ detailsRow.serviceType ? formatEnumLabel(detailsRow.serviceType) : '—' }}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs font-medium text-muted-foreground">Priority</dt>
                                        <dd class="mt-0.5 capitalize text-foreground">
                                            {{ detailsRow.priority ? formatEnumLabel(detailsRow.priority) : '—' }}
                                        </dd>
                                    </div>
                                    <div class="col-span-2">
                                        <dt class="text-xs font-medium text-muted-foreground">Department (patient destination)</dt>
                                        <dd class="mt-0.5 text-foreground">
                                            {{ departmentDisplay(detailsRow) }}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs font-medium text-muted-foreground">Requested</dt>
                                        <dd class="mt-0.5 text-foreground">
                                            {{ formatDateTime(detailsRow.requestedAt) }}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs font-medium text-muted-foreground">Acknowledged</dt>
                                        <dd class="mt-0.5 text-foreground">
                                            {{ formatDateTime(detailsRow.acknowledgedAt) }}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs font-medium text-muted-foreground">Closed</dt>
                                        <dd class="mt-0.5 text-foreground">
                                            {{ formatDateTime(detailsRow.completedAt) }}
                                        </dd>
                                    </div>
                                    <div v-if="detailsRow.linkedOrderNumber">
                                        <dt class="text-xs font-medium text-muted-foreground">Linked order</dt>
                                        <dd class="mt-0.5 font-medium text-foreground">{{ detailsRow.linkedOrderNumber }}</dd>
                                    </div>
                                    <div v-if="detailsRow.statusReason" class="col-span-2">
                                        <dt class="text-xs font-medium text-muted-foreground">Status reason</dt>
                                        <dd class="mt-0.5 text-foreground">{{ detailsRow.statusReason }}</dd>
                                    </div>
                                    <div v-if="detailsRow.notes" class="col-span-2">
                                        <dt class="text-xs font-medium text-muted-foreground">Notes</dt>
                                        <dd class="mt-0.5 text-foreground">{{ detailsRow.notes }}</dd>
                                    </div>
                                </dl>

                                <Card class="rounded-lg !gap-0 overflow-hidden">
                                    <CardHeader class="bg-muted/40 px-4 py-2.5">
                                        <CardTitle class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            <AppIcon name="file-text" class="size-3.5" />
                                            Linked Work
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent class="divide-y px-4 pb-3 pt-0 text-sm">
                                        <div class="flex items-center justify-between gap-4 py-2">
                                            <span class="text-muted-foreground">Work record</span>
                                            <span class="text-right font-medium">{{ linkedOrderDisplay(detailsRow) }}</span>
                                        </div>
                                        <div class="flex items-center justify-between gap-4 py-2">
                                            <span class="text-muted-foreground">Status reason</span>
                                            <span class="max-w-[18rem] truncate text-right font-medium">{{ detailsRow.statusReason || 'Not recorded' }}</span>
                                        </div>
                                        <div class="flex items-start justify-between gap-4 py-2">
                                            <span class="shrink-0 text-muted-foreground">Notes</span>
                                            <span class="text-right font-medium">{{ detailsRow.notes || 'No notes recorded' }}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <!-- Audit tab -->
                            <TabsContent v-if="canViewAudit()" value="audit" class="m-0 px-6 py-4">
                                <div v-if="auditLoading" class="space-y-2">
                                    <div class="h-10 w-full animate-pulse rounded-lg bg-muted" />
                                    <div class="h-10 w-4/5 animate-pulse rounded-lg bg-muted" />
                                    <div class="h-10 w-3/5 animate-pulse rounded-lg bg-muted" />
                                </div>
                                <div
                                    v-else-if="auditError"
                                    class="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                                >
                                    {{ auditError }}
                                </div>
                                <AuditTimelineList
                                    v-else
                                    :logs="auditEvents"
                                    :format-date-time="formatDateTime"
                                    empty-message="No audit events recorded for this direct service ticket."
                                    actor-fallback-label="User"
                                    :metadata-preview-limit="4"
                                />
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                </div>

                <!-- Footer: status actions + close -->
                <SheetFooter class="shrink-0 flex-col-reverse gap-2 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div class="flex flex-wrap items-center gap-2">
                        <Button
                            v-if="detailsRow && canOpenServiceWorkspace(detailsRow)"
                            as="a"
                            :href="serviceWorkspaceHref(detailsRow) ?? undefined"
                            variant="default"
                            size="sm"
                            class="gap-1.5"
                        >
                            <AppIcon name="arrow-up-right" class="size-3.5" />
                            {{ serviceWorkspaceLabel(detailsRow) }}
                        </Button>
                    </div>
                    <div class="flex flex-wrap justify-end gap-2">
                        <template v-if="detailsRow && canUpdateStatus() && (detailsRow.status === 'pending' || detailsRow.status === 'in_progress')">
                            <Button
                                v-if="detailsRow.status === 'pending'"
                                size="sm"
                                class="gap-1.5"
                                :disabled="statusUpdating === detailsRow.id"
                                @click="openWorkflow(detailsRow, 'start')"
                            >
                                <AppIcon name="log-in" class="size-3.5" />
                                Accept handoff
                            </Button>
                            <Button
                                v-if="canManuallyCloseHandoff(detailsRow)"
                                size="sm"
                                variant="outline"
                                class="gap-1.5"
                                :disabled="statusUpdating === detailsRow.id"
                                @click="openWorkflow(detailsRow, 'complete')"
                            >
                                <AppIcon name="check-circle" class="size-3.5" />
                                Close handoff
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                class="gap-1.5 text-destructive hover:text-destructive"
                                :disabled="statusUpdating === detailsRow.id"
                                @click="openWorkflow(detailsRow, 'cancel')"
                            >
                                <AppIcon name="x" class="size-3.5" />
                                Cancel ticket
                            </Button>
                        </template>
                        <Button variant="outline" size="sm" @click="detailsOpen = false">Close</Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>

        <!-- Workflow action dialog -->
        <Dialog :open="workflowOpen" @update:open="handleWorkflowOpenChange">
            <DialogContent class="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{{ workflowTitle }}</DialogTitle>
                    <DialogDescription>{{ workflowDescription }}</DialogDescription>
                </DialogHeader>

                <div v-if="workflowRow" class="space-y-4 py-2">
                    <div class="grid gap-2 rounded-lg border bg-muted/20 p-3 text-sm md:grid-cols-3">
                        <div>
                            <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Ticket</p>
                            <p class="mt-1 font-semibold">{{ requestNumberDisplay(workflowRow) }}</p>
                        </div>
                        <div>
                            <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Destination</p>
                            <p class="mt-1 font-semibold">{{ serviceTypeLabel(workflowRow.serviceType) }}</p>
                        </div>
                        <div>
                            <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Current status</p>
                            <p class="mt-1 font-semibold">{{ statusDisplayLabel(workflowRow.status) }}</p>
                        </div>
                    </div>

                    <Alert v-if="workflowMissingLinkedRecord" variant="destructive">
                        <AppIcon name="alert-triangle" class="size-4" />
                        <AlertTitle>Cannot close yet</AlertTitle>
                        <AlertDescription>
                            A linked clinical order or work record is required before this direct service ticket can be closed.
                        </AlertDescription>
                    </Alert>

                    <div class="grid gap-2">
                        <label
                            v-for="item in workflowChecklistItems"
                            :key="item.key"
                            class="flex cursor-pointer gap-3 rounded-lg border bg-background p-3 text-sm transition-colors hover:bg-muted/30"
                        >
                            <Checkbox
                                :model-value="workflowChecks[item.key]"
                                class="mt-0.5"
                                @update:model-value="workflowChecks[item.key] = $event === true"
                            />
                            <span class="min-w-0">
                                <span class="block font-medium">{{ item.label }}</span>
                                <span class="block text-xs text-muted-foreground">{{ item.description }}</span>
                            </span>
                        </label>
                    </div>

                    <div v-if="workflowRequiresReason" class="grid gap-2">
                        <Label for="workflow-reason">
                            Reason <span class="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="workflow-reason"
                            v-model="workflowReason"
                            :placeholder="workflowAction === 'complete' ? 'Why is this handoff being closed manually?' : 'Why is this ticket cancelled?'"
                            class="resize-none"
                            :rows="3"
                        />
                    </div>

                    <p v-if="workflowError" class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {{ workflowError }}
                    </p>
                </div>

                <DialogFooter>
                    <Button variant="outline" :disabled="statusUpdating === workflowRow?.id" @click="handleWorkflowOpenChange(false)">
                        Close
                    </Button>
                    <Button
                        class="gap-1.5"
                        :variant="workflowAction === 'cancel' ? 'destructive' : 'default'"
                        :disabled="!workflowCanSubmit"
                        @click="submitWorkflow()"
                    >
                        <AppIcon v-if="statusUpdating === workflowRow?.id" name="refresh-cw" class="size-3.5 animate-spin" />
                        <AppIcon v-else :name="workflowSubmitIcon" class="size-3.5" />
                        {{ workflowSubmitLabel }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- Create request dialog -->
        <Dialog v-model:open="createOpen" @update:open="(v) => !v && resetCreateForm()">
            <DialogContent class="max-w-md">
                <DialogHeader>
                    <DialogTitle>New direct service request</DialogTitle>
                    <DialogDescription>
                        Send a registered patient directly to a service desk.
                    </DialogDescription>
                </DialogHeader>
                <div class="flex flex-col gap-4 py-2">
                    <ClinicalContextBanner
                        title="Direct service request context"
                        description="Confirm the patient, facility, and destination desk before routing the patient to the receiving team."
                        :patient-name="createPatientContextLabel"
                        :patient-meta="createPatientContextMeta"
                        :facility-name="scope?.facility?.name || 'No facility selected'"
                        :tenant-name="null"
                        :context-label="createRequestWorkflowContextLabel"
                        :context-meta="createRequestWorkflowContextMeta"
                        :status-label="createRequestContextStatusLabel"
                        :status-variant="createRequestContextStatusVariant"
                        tone="muted"
                    />

                    <!-- Patient -->
                    <div class="flex flex-col gap-1.5">
                        <PatientLookupField
                            :model-value="createForm.patientId"
                            input-id="create-patient"
                            label="Patient"
                            required
                            helper-text=""
                            placeholder="Search patient…"
                            :error-message="createErrors.patientId ?? null"
                            @update:model-value="createForm.patientId = $event"
                        />
                    </div>

                    <!-- Service desk -->
                    <div class="flex w-full flex-col gap-1.5">
                        <Label>Service desk <span class="text-destructive">*</span></Label>
                        <Select
                            :model-value="createForm.serviceType || undefined"
                            @update:model-value="createForm.serviceType = $event ? String($event) : ''"
                        >
                            <SelectTrigger
                                class="w-full"
                                :class="createErrors.serviceType ? 'border-destructive' : ''"
                            >
                                <SelectValue placeholder="Select desk…" />
                            </SelectTrigger>
                            <SelectContent class="z-[80]">
                                <SelectItem v-for="opt in serviceTypeCreateOptions" :key="opt.value" :value="opt.value">
                                    {{ opt.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="createErrors.serviceType" class="text-xs text-destructive">{{ createErrors.serviceType }}</p>
                    </div>

                    <!-- Department (patient destination) -->
                    <div class="flex w-full flex-col gap-1.5">
                        <Label>Department patient is sent to <span class="text-xs text-muted-foreground">(optional)</span></Label>
                        <Select
                            :model-value="createForm.departmentId || undefined"
                            :disabled="!createForm.serviceType || departmentOptionsLoading"
                            @update:model-value="handleCreateDepartmentChange"
                        >
                            <SelectTrigger
                                class="w-full"
                                :class="createErrors.departmentId ? 'border-destructive' : ''"
                            >
                                <SelectValue :placeholder="createForm.serviceType ? 'Select matching department…' : 'Select service desk first…'" />
                            </SelectTrigger>
                            <SelectContent class="z-[80]">
                                <SelectItem
                                    v-for="opt in createDepartmentOptions"
                                    :key="opt.value"
                                    :value="opt.value"
                                >
                                    {{ opt.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="createForm.serviceType && !departmentOptionsLoading && createDepartmentOptions.length === 0" class="text-xs text-muted-foreground">
                            No matching departments found for this desk.
                        </p>
                        <p v-if="createErrors.departmentId" class="text-xs text-destructive">{{ createErrors.departmentId }}</p>
                    </div>

                    <!-- Priority -->
                    <div class="flex w-full flex-col gap-1.5">
                        <Label>Priority</Label>
                        <Select
                            :model-value="createForm.priority"
                            @update:model-value="createForm.priority = $event ? String($event) : 'routine'"
                        >
                            <SelectTrigger class="w-full">
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent class="z-[80]">
                                <SelectItem value="routine">Routine</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <!-- Notes -->
                    <div class="flex flex-col gap-1.5">
                        <Label for="create-notes">
                            Notes <span class="text-xs text-muted-foreground">(optional)</span>
                        </Label>
                        <Textarea
                            id="create-notes"
                            v-model="createForm.notes"
                            placeholder="Any additional context…"
                            class="resize-none"
                            :rows="3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" :disabled="createLoading" @click="createOpen = false">Cancel</Button>
                    <Button :disabled="createLoading" class="gap-2" @click="submitCreate()">
                        <AppIcon v-if="createLoading" name="refresh-cw" class="size-4 animate-spin" />
                        Create request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- ── Filter sheet ────────────────────────────────────────────────────── -->
        <Sheet :open="filtersSheetOpen" @update:open="filtersSheetOpen = $event">
            <SheetContent side="right" variant="form" size="md" class="flex h-full min-h-0 flex-col">
                <SheetHeader class="shrink-0 border-b px-4 py-3 text-left">
                    <SheetTitle class="flex items-center gap-2">
                        <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                        Filter Requests
                    </SheetTitle>
                    <SheetDescription>Filter and sort direct service requests.</SheetDescription>
                </SheetHeader>
                <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <div class="rounded-lg border p-3">
                        <div class="grid gap-3">
                            <div class="grid gap-2">
                                <Label for="filter-sheet-patient">Patient</Label>
                                <PatientLookupField
                                    :model-value="filters.patientId"
                                    input-id="filter-sheet-patient"
                                    label="Patient"
                                    placeholder="Search patient…"
                                    mode="filter"
                                    :per-page="8"
                                    @update:model-value="filters.patientId = $event"
                                />
                            </div>
                            <div class="grid gap-2">
                                <Label>Service desk</Label>
                                <Select :model-value="filters.serviceType" @update:model-value="filters.serviceType = $event">
                                    <SelectTrigger class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="opt in serviceTypeOptions" :key="opt.value" :value="opt.value">
                                            {{ opt.label }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-2">
                                <Label>Priority</Label>
                                <Select :model-value="filters.priority" @update:model-value="filters.priority = $event">
                                    <SelectTrigger class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="opt in priorityFilterOptions" :key="opt.value" :value="opt.value">
                                            {{ opt.label }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Separator />
                            <div class="grid gap-2">
                                <Label>Date range</Label>
                                <DateRangeFilterPopover
                                    input-base-id="filter-sheet-date"
                                    title="Requested date"
                                    :from="filters.from"
                                    :to="filters.to"
                                    @update:from="filters.from = $event"
                                    @update:to="filters.to = $event"
                                />
                            </div>
                            <Separator />
                            <div class="grid gap-2">
                                <Label>Results per page</Label>
                                <Select :model-value="String(filters.perPage)" @update:model-value="filters.perPage = Number($event)">
                                    <SelectTrigger class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>
                <SheetFooter class="gap-2 border-t px-4 py-3">
                    <Button
                        class="gap-1.5"
                        :disabled="loading"
                        @click="applyFilters(); filtersSheetOpen = false"
                    >
                        <AppIcon name="search" class="size-3.5" />
                        Apply Filters
                    </Button>
                    <Button variant="outline" @click="resetFilters()">
                        Reset Filters
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    </AppLayout>
</template>

