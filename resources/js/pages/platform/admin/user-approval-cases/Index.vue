<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { hasRouteAccess } from '@/lib/routeAccess';
import { type BreadcrumbItem } from '@/types';

type ApprovalCaseStatus = 'draft' | 'submitted' | 'cancelled' | 'approved' | 'rejected';
type ApprovalCaseActionType = 'status_change' | 'role_change' | 'facility_change' | 'bulk_change';
type DecisionStatus = 'approved' | 'rejected';
type TransitionStatus = 'draft' | 'submitted' | 'cancelled';

type Facility = { id?: string | null; code?: string | null; name?: string | null };
type ScopeData = { resolvedFrom: string; userAccess?: { facilities?: Facility[] } };
type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };

type ApprovalCaseComment = {
    id: string | null;
    approvalCaseId: string | null;
    authorUserId: number | null;
    commentText: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type ApprovalCase = {
    id: string | null;
    tenantId: string | null;
    facilityId: string | null;
    targetUserId: number | null;
    requesterUserId: number | null;
    reviewerUserId: number | null;
    caseReference: string | null;
    actionType: ApprovalCaseActionType | null;
    actionPayload: Record<string, unknown>;
    status: ApprovalCaseStatus | null;
    decisionReason: string | null;
    submittedAt: string | null;
    decidedAt: string | null;
    comments: ApprovalCaseComment[];
    createdAt: string | null;
    updatedAt: string | null;
};

type ApprovalCaseAuditLog = {
    id: string;
    approvalCaseId: string | null;
    actorId: number | null;
    actorType?: 'system' | 'user' | null;
    actor?: { displayName?: string | null } | null;
    action: string | null;
    actionLabel?: string | null;
    changes: Record<string, unknown> | unknown[];
    metadata: Record<string, unknown> | unknown[];
    createdAt: string | null;
};

type ValidationErrorResponse = { message?: string; errors?: Record<string, string[]> };
type ApprovalCaseListResponse = { data: ApprovalCase[]; meta: Pagination };
type ApprovalCaseResponse = { data: ApprovalCase };
type ApprovalCaseCommentListResponse = { data: ApprovalCaseComment[] };
type ApprovalCaseCommentResponse = { data: ApprovalCaseComment };
type ApprovalCaseAuditLogListResponse = { data: ApprovalCaseAuditLog[]; meta: Pagination };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Platform Admin', href: '/platform/admin/user-approval-cases' },
    { title: 'User Approval Cases', href: '/platform/admin/user-approval-cases' },
];

const statusOptions: ApprovalCaseStatus[] = ['draft', 'submitted', 'cancelled', 'approved', 'rejected'];
const actionTypeOptions: ApprovalCaseActionType[] = ['status_change', 'role_change', 'facility_change', 'bulk_change'];
const transitionStatuses: TransitionStatus[] = ['draft', 'submitted', 'cancelled'];
const decisionStatuses: DecisionStatus[] = ['approved', 'rejected'];

const { permissionNames, permissionState, scope: sharedScope, multiTenantIsolationEnabled } = usePlatformAccess();
const permissionsResolved = computed(() => permissionNames.value !== null);
const canRead = computed(() => permissionState('platform.users.approval-cases.read') === 'allowed');
const canCreate = computed(() => permissionState('platform.users.approval-cases.create') === 'allowed');
const canManage = computed(() => permissionState('platform.users.approval-cases.manage') === 'allowed');
const canReview = computed(() => permissionState('platform.users.approval-cases.review') === 'allowed');
const canViewAudit = computed(() => permissionState('platform.users.approval-cases.view-audit-logs') === 'allowed');
const canOpenPlatformUsersPage = computed(() => hasRouteAccess('/platform/admin/users', permissionNames.value));

const scope = computed<ScopeData | null>(() => (sharedScope.value as ScopeData | null) ?? null);
const availableFacilities = computed(() => scope.value?.userAccess?.facilities ?? []);
const scopeUnresolved = computed(() => multiTenantIsolationEnabled.value && (scope.value?.resolvedFrom ?? 'none') === 'none');

const initialDetailId = queryParam('id');
const initialFromDate = queryParam('fromDate') || queryParam('from');
const initialToDate = queryParam('toDate') || queryParam('to');

const compactQueueRows = useLocalStorageBoolean('platform.users.approval-cases.queueRows.compact', false);

const pageLoading = ref(true);
const listLoading = ref(false);
const listErrors = ref<string[]>([]);
const approvalCases = ref<ApprovalCase[]>([]);
const pagination = ref<Pagination | null>(null);

const filters = reactive({
    q: queryParam('q'),
    status: queryParam('status'),
    actionType: queryParam('actionType'),
    targetUserId: queryParam('targetUserId'),
    requesterUserId: queryParam('requesterUserId'),
    reviewerUserId: queryParam('reviewerUserId'),
    fromDate: toDateTimeInput(initialFromDate),
    toDate: toDateTimeInput(initialToDate),
    sortBy: queryParam('sortBy') || 'createdAt',
    sortDir: queryParam('sortDir') === 'asc' ? 'asc' : 'desc',
    perPage: queryNumberParam('perPage', 20, [10, 20, 50, 100]),
    page: Math.max(Number.parseInt(queryParam('page') || '1', 10) || 1, 1),
});

const createLoading = ref(false);
const createDialogOpen = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const createForm = reactive({
    facilityId: '',
    targetUserId: queryParam('targetUserId'),
    requesterUserId: '',
    reviewerUserId: '',
    caseReference: '',
    actionType: 'status_change' as ApprovalCaseActionType,
    actionPayloadText: '{\n  "status": "inactive"\n}',
    status: 'draft' as TransitionStatus,
});

const detailsOpen = ref(false);
const detailsLoading = ref(false);
const detailsError = ref<string | null>(null);
const detailsTab = ref('overview');
const selectedCase = ref<ApprovalCase | null>(null);

const statusSaveLoading = ref(false);
const statusErrors = ref<Record<string, string[]>>({});
const statusForm = reactive({ status: 'draft' as TransitionStatus, reason: '' });

const decisionSaveLoading = ref(false);
const decisionErrors = ref<Record<string, string[]>>({});
const decisionForm = reactive({ decision: 'approved' as DecisionStatus, reason: '' });

const commentsLoading = ref(false);
const commentSaveLoading = ref(false);
const commentError = ref<string | null>(null);
const comments = ref<ApprovalCaseComment[]>([]);
const commentForm = reactive({ comment: '' });

const auditLoading = ref(false);
const auditError = ref<string | null>(null);
const auditLogs = ref<ApprovalCaseAuditLog[]>([]);
const auditMeta = ref<Pagination | null>(null);
const auditExporting = ref(false);
const auditFilters = reactive({
    q: '',
    action: '',
    actorType: '',
    actorId: '',
    from: '',
    to: '',
    page: 1,
    perPage: 20,
});

const hasFilters = computed(() =>
    Boolean(
        filters.q.trim() ||
        filters.status ||
        filters.actionType ||
        filters.targetUserId.trim() ||
        filters.requesterUserId.trim() ||
        filters.reviewerUserId.trim() ||
        filters.fromDate ||
        filters.toDate ||
        filters.sortBy !== 'createdAt' ||
        filters.sortDir !== 'desc' ||
        filters.perPage !== 20,
    ),
);

const canPrev = computed(() => (pagination.value?.currentPage ?? 1) > 1);
const canNext = computed(() => (pagination.value ? pagination.value.currentPage < pagination.value.lastPage : false));
const filterBadgeCount = computed(() => {
    let count = 0;
    if (filters.status) count += 1;
    if (filters.actionType) count += 1;
    if (filters.targetUserId.trim()) count += 1;
    if (filters.requesterUserId.trim()) count += 1;
    if (filters.reviewerUserId.trim()) count += 1;
    if (filters.fromDate) count += 1;
    if (filters.toDate) count += 1;
    if (filters.sortBy !== 'createdAt') count += 1;
    if (filters.sortDir !== 'desc') count += 1;
    if (filters.perPage !== 20) count += 1;
    return count;
});
const summary = computed(() => {
    const counts = { draft: 0, submitted: 0, cancelled: 0, approved: 0, rejected: 0 };

    for (const item of approvalCases.value) {
        const status = (item.status ?? '').toLowerCase() as ApprovalCaseStatus;
        if (status in counts) counts[status] += 1;
    }

    return counts;
});

const currentCaseId = computed(() => String(selectedCase.value?.id ?? '').trim());
const canTransitionStatus = computed(() => {
    const normalized = (selectedCase.value?.status ?? '').toLowerCase();
    return normalized === 'draft' || normalized === 'submitted';
});
const canDecide = computed(() => (selectedCase.value?.status ?? '').toLowerCase() === 'submitted');
const approvalCaseSummaryText = computed(() => {
    if (pageLoading.value) return 'Loading approval cases...';
    const total = pagination.value?.total ?? approvalCases.value.length;
    return `${total} approval cases in scope`;
});
const approvalCaseStatusBreakdownText = computed(() => {
    if (pageLoading.value) return 'Loading queue status...';
    return `Submitted ${summary.value.submitted} · Draft ${summary.value.draft} · Approved ${summary.value.approved} · Rejected ${summary.value.rejected} · Cancelled ${summary.value.cancelled}`;
});

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

function queryNumberParam(name: string, fallback: number, allowed: number[]): number {
    const parsed = Number.parseInt(queryParam(name), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return allowed.includes(parsed) ? parsed : fallback;
}

function resetCreateForm(): void {
    createErrors.value = {};
    createForm.targetUserId = queryParam('targetUserId');
    createForm.requesterUserId = '';
    createForm.reviewerUserId = '';
    createForm.caseReference = '';
    createForm.actionType = 'status_change';
    createForm.actionPayloadText = '{\n  "status": "inactive"\n}';
    createForm.status = 'draft';
}

function openCreateDialog(): void {
    if (!canCreate.value) return;
    resetCreateForm();
    createDialogOpen.value = true;
}

function closeCreateDialog(): void {
    createDialogOpen.value = false;
    createErrors.value = {};
}

function applyStatusPreset(status: ApprovalCaseStatus | ''): void {
    filters.status = status;
    filters.page = 1;
    void loadApprovalCases();
}

function csrfToken(): string | null {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
}

function firstError(errors: Record<string, string[]> | null | undefined, key: string): string | null {
    return errors?.[key]?.[0] ?? null;
}

function parseOptionalInteger(value: string): number | null {
    const normalized = value.trim();
    if (normalized === '') return null;
    if (!/^\d+$/.test(normalized)) return null;
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toDateTimeInput(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

function toApiDateTime(value: string): string | null {
    const normalized = value.trim();
    if (!normalized) return null;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function formatDateTime(value: string | null): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function formatStatusLabel(status: string | null): string {
    return formatEnumLabel(status ?? 'unknown') || 'Unknown';
}

function formatActionTypeLabel(actionType: string | null): string {
    return formatEnumLabel(actionType ?? 'unknown') || 'Unknown';
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'submitted' || normalized === 'approved') return 'secondary';
    if (normalized === 'cancelled' || normalized === 'rejected') return 'destructive';
    return 'outline';
}

function facilityLabel(facilityId: string | null): string {
    const id = String(facilityId ?? '').trim();
    if (!id) return 'No facility';
    const facility = availableFacilities.value.find((entry) => String(entry.id ?? '') === id);
    if (!facility) return id;
    return `${facility.code || 'FAC'} - ${facility.name || 'Facility'}`;
}

function actorLabel(log: ApprovalCaseAuditLog): string {
    const actorType = (log.actorType ?? '').toLowerCase();
    if (actorType === 'system') return 'System';
    if (actorType === 'user') {
        if (log.actor?.displayName) return log.actor.displayName;
        if (log.actorId !== null) return `User #${log.actorId}`;
    }
    if (log.actorId !== null) return `User #${log.actorId}`;
    return 'System';
}

function jsonPreview(value: unknown): string {
    try {
        return JSON.stringify(value ?? {}, null, 2);
    } catch {
        return '{}';
    }
}

function parsePayloadJson(payloadText: string): Record<string, unknown> {
    const normalized = payloadText.trim();
    if (!normalized) return {};

    const parsed = JSON.parse(normalized) as unknown;
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('Action payload must be a JSON object.');
    }

    return parsed as Record<string, unknown>;
}

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> },
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === '') return;
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

function syncApprovalCaseInList(item: ApprovalCase): void {
    const index = approvalCases.value.findIndex((entry) => entry.id === item.id);
    if (index >= 0) approvalCases.value[index] = item;
}

function resetDetailsPanels(): void {
    comments.value = [];
    commentForm.comment = '';
    commentError.value = null;
    auditLogs.value = [];
    auditMeta.value = null;
    auditError.value = null;
    auditFilters.q = '';
    auditFilters.action = '';
    auditFilters.actorType = '';
    auditFilters.actorId = '';
    auditFilters.from = '';
    auditFilters.to = '';
    auditFilters.page = 1;
    auditFilters.perPage = 20;
}

function hydrateDetails(item: ApprovalCase): void {
    selectedCase.value = item;
    comments.value = item.comments ?? [];

    const normalizedStatus = (item.status ?? '').toLowerCase();
    statusForm.status = normalizedStatus === 'draft' || normalizedStatus === 'submitted' || normalizedStatus === 'cancelled'
        ? normalizedStatus
        : 'draft';
    statusForm.reason = '';
    statusErrors.value = {};

    decisionForm.decision = 'approved';
    decisionForm.reason = '';
    decisionErrors.value = {};
}

async function loadApprovalCases(page?: number): Promise<void> {
    if (!canRead.value) {
        approvalCases.value = [];
        pagination.value = null;
        pageLoading.value = false;
        listLoading.value = false;
        return;
    }

    if (typeof page === 'number') filters.page = page;

    listLoading.value = true;
    listErrors.value = [];

    try {
        const response = await apiRequest<ApprovalCaseListResponse>('GET', '/platform/admin/user-approval-cases', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status || null,
                actionType: filters.actionType || null,
                targetUserId: filters.targetUserId.trim() || null,
                requesterUserId: filters.requesterUserId.trim() || null,
                reviewerUserId: filters.reviewerUserId.trim() || null,
                fromDate: toApiDateTime(filters.fromDate),
                toDate: toApiDateTime(filters.toDate),
                sortBy: filters.sortBy,
                sortDir: filters.sortDir,
                page: filters.page,
                perPage: filters.perPage,
            },
        });

        approvalCases.value = response.data ?? [];
        pagination.value = response.meta ?? null;
    } catch (error) {
        approvalCases.value = [];
        pagination.value = null;
        listErrors.value = [messageFromUnknown(error, 'Unable to load approval cases.')];
    } finally {
        listLoading.value = false;
        pageLoading.value = false;
    }
}

function refreshPage(): void {
    void loadApprovalCases();
}

function submitSearch(): void {
    filters.page = 1;
    void loadApprovalCases();
}

function resetFilters(): void {
    filters.q = '';
    filters.status = '';
    filters.actionType = '';
    filters.targetUserId = '';
    filters.requesterUserId = '';
    filters.reviewerUserId = '';
    filters.fromDate = '';
    filters.toDate = '';
    filters.sortBy = 'createdAt';
    filters.sortDir = 'desc';
    filters.page = 1;
    filters.perPage = 20;
    void loadApprovalCases();
}

function prevPage(): void {
    if (!canPrev.value) return;
    filters.page -= 1;
    void loadApprovalCases();
}

function nextPage(): void {
    if (!canNext.value) return;
    filters.page += 1;
    void loadApprovalCases();
}

async function createApprovalCase(): Promise<void> {
    if (!canCreate.value || createLoading.value) return;

    const targetUserId = parseOptionalInteger(createForm.targetUserId);
    if (targetUserId === null) {
        createErrors.value = { targetUserId: ['Target user id must be a positive integer.'] };
        return;
    }

    let actionPayload: Record<string, unknown>;
    try {
        actionPayload = parsePayloadJson(createForm.actionPayloadText);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Action payload must be valid JSON.'));
        return;
    }

    createLoading.value = true;
    createErrors.value = {};

    try {
        const response = await apiRequest<ApprovalCaseResponse>('POST', '/platform/admin/user-approval-cases', {
            body: {
                facilityId: createForm.facilityId || null,
                targetUserId,
                requesterUserId: parseOptionalInteger(createForm.requesterUserId),
                reviewerUserId: parseOptionalInteger(createForm.reviewerUserId),
                caseReference: createForm.caseReference.trim(),
                actionType: createForm.actionType,
                actionPayload,
                status: createForm.status,
            },
        });

        const created = response.data;
        notifySuccess('Approval case created.');

        closeCreateDialog();
        resetCreateForm();

        await loadApprovalCases(1);
        await openDetailsById(String(created.id ?? ''));
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) createErrors.value = apiError.payload.errors;
        else notifyError(messageFromUnknown(error, 'Unable to create approval case.'));
    } finally {
        createLoading.value = false;
    }
}

async function loadComments(): Promise<void> {
    const caseId = currentCaseId.value;
    if (!caseId) return;

    commentsLoading.value = true;
    commentError.value = null;

    try {
        const response = await apiRequest<ApprovalCaseCommentListResponse>('GET', `/platform/admin/user-approval-cases/${caseId}/comments`);
        comments.value = response.data ?? [];
    } catch (error) {
        comments.value = [];
        commentError.value = messageFromUnknown(error, 'Unable to load comments.');
    } finally {
        commentsLoading.value = false;
    }
}

async function loadAuditLogs(page?: number): Promise<void> {
    const caseId = currentCaseId.value;
    if (!caseId || !canViewAudit.value) return;

    if (typeof page === 'number') auditFilters.page = page;

    auditLoading.value = true;
    auditError.value = null;

    try {
        const response = await apiRequest<ApprovalCaseAuditLogListResponse>('GET', `/platform/admin/user-approval-cases/${caseId}/audit-logs`, {
            query: {
                q: auditFilters.q.trim() || null,
                action: auditFilters.action.trim() || null,
                actorType: auditFilters.actorType || null,
                actorId: auditFilters.actorId.trim() || null,
                from: toApiDateTime(auditFilters.from),
                to: toApiDateTime(auditFilters.to),
                page: auditFilters.page,
                perPage: auditFilters.perPage,
            },
        });

        auditLogs.value = response.data ?? [];
        auditMeta.value = response.meta ?? null;
    } catch (error) {
        auditLogs.value = [];
        auditMeta.value = null;
        auditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
    } finally {
        auditLoading.value = false;
    }
}

function exportAuditLogs(): void {
    const caseId = currentCaseId.value;
    if (!caseId || !canViewAudit.value || auditExporting.value) return;

    auditExporting.value = true;
    try {
        const params = new URLSearchParams();
        if (auditFilters.q.trim()) params.set('q', auditFilters.q.trim());
        if (auditFilters.action.trim()) params.set('action', auditFilters.action.trim());
        if (auditFilters.actorType) params.set('actorType', auditFilters.actorType);
        if (auditFilters.actorId.trim()) params.set('actorId', auditFilters.actorId.trim());
        const from = toApiDateTime(auditFilters.from);
        const to = toApiDateTime(auditFilters.to);
        if (from) params.set('from', from);
        if (to) params.set('to', to);

        const query = params.toString();
        const href = query
            ? `/api/v1/platform/admin/user-approval-cases/${caseId}/audit-logs/export?${query}`
            : `/api/v1/platform/admin/user-approval-cases/${caseId}/audit-logs/export`;

        window.open(href, '_blank', 'noopener');
    } finally {
        auditExporting.value = false;
    }
}

async function loadDetails(caseId: string): Promise<void> {
    detailsLoading.value = true;
    detailsError.value = null;
    resetDetailsPanels();

    try {
        const response = await apiRequest<ApprovalCaseResponse>('GET', `/platform/admin/user-approval-cases/${caseId}`);
        hydrateDetails(response.data);
        await loadComments();
        if (canViewAudit.value) await loadAuditLogs(1);
    } catch (error) {
        selectedCase.value = null;
        detailsError.value = messageFromUnknown(error, 'Unable to load approval case.');
    } finally {
        detailsLoading.value = false;
    }
}

async function openDetails(item: ApprovalCase): Promise<void> {
    const caseId = String(item.id ?? '').trim();
    if (!caseId) return;

    detailsOpen.value = true;
    detailsTab.value = 'overview';
    await loadDetails(caseId);
}

async function openDetailsById(caseId: string): Promise<void> {
    const normalized = caseId.trim();
    if (!normalized) return;

    detailsOpen.value = true;
    detailsTab.value = 'overview';
    await loadDetails(normalized);
}

function closeDetails(): void {
    detailsOpen.value = false;
    detailsTab.value = 'overview';
    detailsError.value = null;
    selectedCase.value = null;
    resetDetailsPanels();
}

async function saveStatusTransition(): Promise<void> {
    const caseId = currentCaseId.value;
    if (!caseId || !canManage.value || statusSaveLoading.value) return;

    statusSaveLoading.value = true;
    statusErrors.value = {};

    try {
        const response = await apiRequest<ApprovalCaseResponse>('PATCH', `/platform/admin/user-approval-cases/${caseId}/status`, {
            body: {
                status: statusForm.status,
                reason: statusForm.reason.trim() || null,
            },
        });

        hydrateDetails(response.data);
        syncApprovalCaseInList(response.data);
        notifySuccess('Approval case status updated.');
        if (canViewAudit.value) await loadAuditLogs(1);
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) statusErrors.value = apiError.payload.errors;
        else notifyError(messageFromUnknown(error, 'Unable to update status.'));
    } finally {
        statusSaveLoading.value = false;
    }
}

async function saveDecision(): Promise<void> {
    const caseId = currentCaseId.value;
    if (!caseId || !canReview.value || decisionSaveLoading.value) return;

    decisionSaveLoading.value = true;
    decisionErrors.value = {};

    try {
        const response = await apiRequest<ApprovalCaseResponse>('PATCH', `/platform/admin/user-approval-cases/${caseId}/decision`, {
            body: {
                decision: decisionForm.decision,
                reason: decisionForm.reason.trim() || null,
            },
        });

        hydrateDetails(response.data);
        syncApprovalCaseInList(response.data);
        notifySuccess('Approval case decision recorded.');
        if (canViewAudit.value) await loadAuditLogs(1);
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) decisionErrors.value = apiError.payload.errors;
        else notifyError(messageFromUnknown(error, 'Unable to record decision.'));
    } finally {
        decisionSaveLoading.value = false;
    }
}

async function addComment(): Promise<void> {
    const caseId = currentCaseId.value;
    if (!caseId || !canManage.value || commentSaveLoading.value) return;

    const comment = commentForm.comment.trim();
    if (!comment) {
        commentError.value = 'Comment is required.';
        return;
    }

    commentSaveLoading.value = true;
    commentError.value = null;

    try {
        await apiRequest<ApprovalCaseCommentResponse>('POST', `/platform/admin/user-approval-cases/${caseId}/comments`, {
            body: { comment },
        });

        commentForm.comment = '';
        notifySuccess('Comment added.');
        await loadComments();
        if (canViewAudit.value) await loadAuditLogs(1);
    } catch (error) {
        commentError.value = messageFromUnknown(error, 'Unable to add comment.');
    } finally {
        commentSaveLoading.value = false;
    }
}

onMounted(async () => {
    if (availableFacilities.value.length > 0) {
        createForm.facilityId = String(availableFacilities.value[0]?.id ?? '');
    }

    await loadApprovalCases();
    if (initialDetailId) await openDetailsById(initialDetailId);
});
</script>
<template>
    <Head title="User Approval Cases" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <div class="min-w-0">
                <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                    <AppIcon name="clipboard-list" class="size-7 text-primary" />
                    User Approval Cases
                </h1>
                <p class="mt-1 text-sm text-muted-foreground">
                    Case queue, workflow decisions, comments, and audit evidence for privileged user changes.
                </p>
            </div>

            <Alert v-if="scopeUnresolved" variant="destructive">
                <AlertTitle>Scope unresolved</AlertTitle>
                <AlertDescription>
                    Tenant or facility scope is unresolved. Approval-case create/review actions may be blocked by isolation controls.
                </AlertDescription>
            </Alert>

            <template v-if="!permissionsResolved">
                <Card class="border-sidebar-border/70">
                    <CardContent class="space-y-2 py-4">
                        <Skeleton class="h-5 w-56" />
                        <Skeleton class="h-10 w-full" />
                        <Skeleton class="h-10 w-full" />
                    </CardContent>
                </Card>
            </template>
            <Alert v-else-if="!canRead" variant="destructive">
                <AlertTitle>Approval-case access restricted</AlertTitle>
                <AlertDescription>Request <code>platform.users.approval-cases.read</code> permission.</AlertDescription>
            </Alert>

            <template v-else>
                <div class="flex flex-col gap-3 rounded-lg border border-sidebar-border/70 bg-muted/20 p-3 md:flex-row md:items-center md:justify-between">
                    <div class="flex flex-wrap items-center gap-2">
                        <Button size="sm" :variant="filters.status === '' ? 'default' : 'outline'" @click="applyStatusPreset('')">
                            All cases
                        </Button>
                        <Button size="sm" :variant="filters.status === 'submitted' ? 'default' : 'outline'" @click="applyStatusPreset('submitted')">
                            Submitted
                        </Button>
                        <Button size="sm" :variant="filters.status === 'draft' ? 'default' : 'outline'" @click="applyStatusPreset('draft')">
                            Draft
                        </Button>
                        <Button size="sm" :variant="filters.status === 'approved' ? 'default' : 'outline'" @click="applyStatusPreset('approved')">
                            Approved
                        </Button>
                        <Button size="sm" :variant="filters.status === 'rejected' ? 'default' : 'outline'" @click="applyStatusPreset('rejected')">
                            Rejected
                        </Button>
                        <Button size="sm" :variant="filters.status === 'cancelled' ? 'default' : 'outline'" @click="applyStatusPreset('cancelled')">
                            Cancelled
                        </Button>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:justify-end">
                        <span>{{ approvalCaseSummaryText }}</span>
                        <span class="hidden xl:inline">{{ approvalCaseStatusBreakdownText }}</span>
                        <Button v-if="hasFilters" variant="outline" size="sm" @click="resetFilters">Reset</Button>
                        <Button variant="outline" size="sm" class="gap-1.5" :disabled="listLoading" @click="refreshPage">
                            <AppIcon name="activity" class="size-3.5" />
                            {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                        </Button>
                        <Button v-if="canOpenPlatformUsersPage" variant="outline" size="sm" as-child>
                            <Link href="/platform/admin/users">Open Users</Link>
                        </Button>
                        <Button v-if="canCreate" size="sm" class="gap-1.5" @click="openCreateDialog">
                            <AppIcon name="plus" class="size-3.5" />
                            Create Case
                        </Button>
                    </div>
                </div>

                <Alert v-if="listErrors.length" variant="destructive">
                    <AlertTitle>Request error</AlertTitle>
                    <AlertDescription>{{ listErrors[0] }}</AlertDescription>
                </Alert>

                <div class="flex min-w-0 flex-col gap-4">
                    <Card class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col">
                        <CardHeader class="shrink-0 gap-3 border-b pb-3 pt-4">
                            <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                <div class="min-w-0 space-y-1">
                                    <CardTitle class="flex items-center gap-2 text-base">
                                        <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                                        Approval Case Queue
                                    </CardTitle>
                                    <CardDescription>Select a case to review workflow, comments, and audit evidence.</CardDescription>
                                </div>
                                <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:max-w-2xl">
                                    <div class="relative min-w-0 flex-1">
                                        <AppIcon name="search" class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            v-model="filters.q"
                                            placeholder="Search case reference, reason, or target user"
                                            class="h-9 pl-9"
                                            @keyup.enter="submitSearch"
                                        />
                                    </div>
                                    <Popover>
                                        <PopoverTrigger as-child>
                                            <Button variant="outline" size="sm" class="gap-1.5">
                                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                Queue options
                                                <Badge v-if="filterBadgeCount > 0" variant="secondary" class="ml-1 text-[10px]">
                                                    {{ filterBadgeCount }}
                                                </Badge>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent align="end" class="flex max-h-[30rem] w-[22rem] flex-col overflow-hidden rounded-lg border bg-popover p-0 shadow-md">
                                            <div class="space-y-3 border-b px-4 py-3">
                                                <p class="flex items-center gap-2 text-sm font-medium">
                                                    <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                                    Queue options
                                                </p>
                                                <div class="grid gap-2">
                                                    <Label for="approval-cases-status">Status</Label>
                                                    <Select v-model="filters.status">
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                        <SelectItem value="">All statuses</SelectItem>
                                                        <SelectItem v-for="status in statusOptions" :key="`status-${status}`" :value="status">
                                                            {{ formatStatusLabel(status) }}
                                                        </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label for="approval-cases-action-type">Action type</Label>
                                                    <Select v-model="filters.actionType">
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                        <SelectItem value="">All action types</SelectItem>
                                                        <SelectItem v-for="type in actionTypeOptions" :key="`action-${type}`" :value="type">
                                                            {{ formatActionTypeLabel(type) }}
                                                        </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="grid gap-2 sm:grid-cols-2">
                                                    <div class="grid gap-2">
                                                        <Label for="approval-cases-target-user">Target user ID</Label>
                                                        <Input id="approval-cases-target-user" v-model="filters.targetUserId" placeholder="123" />
                                                    </div>
                                                    <div class="grid gap-2">
                                                        <Label for="approval-cases-requester-user">Requester user ID</Label>
                                                        <Input id="approval-cases-requester-user" v-model="filters.requesterUserId" placeholder="123" />
                                                    </div>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label for="approval-cases-reviewer-user">Reviewer user ID</Label>
                                                    <Input id="approval-cases-reviewer-user" v-model="filters.reviewerUserId" placeholder="456" />
                                                </div>
                                                <div class="grid gap-2 sm:grid-cols-2">
                                                    <div class="grid gap-2">
                                                        <Label for="approval-cases-from-date">From</Label>
                                                        <Input id="approval-cases-from-date" v-model="filters.fromDate" type="datetime-local" />
                                                    </div>
                                                    <div class="grid gap-2">
                                                        <Label for="approval-cases-to-date">To</Label>
                                                        <Input id="approval-cases-to-date" v-model="filters.toDate" type="datetime-local" />
                                                    </div>
                                                </div>
                                                <div class="grid gap-2 sm:grid-cols-2">
                                                    <div class="grid gap-2">
                                                        <Label for="approval-cases-sort-by">Sort by</Label>
                                                        <Select v-model="filters.sortBy">
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                            <SelectItem value="createdAt">Created</SelectItem>
                                                            <SelectItem value="updatedAt">Updated</SelectItem>
                                                            <SelectItem value="submittedAt">Submitted</SelectItem>
                                                            <SelectItem value="decidedAt">Decided</SelectItem>
                                                            <SelectItem value="caseReference">Case reference</SelectItem>
                                                            <SelectItem value="status">Status</SelectItem>
                                                            <SelectItem value="actionType">Action type</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div class="grid gap-2">
                                                        <Label for="approval-cases-sort-dir">Sort direction</Label>
                                                        <Select v-model="filters.sortDir">
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                            <SelectItem value="desc">Newest first</SelectItem>
                                                            <SelectItem value="asc">Oldest first</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div class="grid gap-2 sm:grid-cols-2">
                                                    <div class="grid gap-2">
                                                        <Label for="approval-cases-per-page">Per page</Label>
                                                        <Select :model-value="String(filters.perPage)" @update:model-value="filters.perPage = Number($event)">
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                            <SelectItem value="10">10 rows</SelectItem>
                                                            <SelectItem value="20">20 rows</SelectItem>
                                                            <SelectItem value="50">50 rows</SelectItem>
                                                            <SelectItem value="100">100 rows</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div class="grid gap-2">
                                                        <Label for="approval-cases-density">Row density</Label>
                                                        <Select>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent> (compactQueueRows = value === 'compact')"
                                                        >
                                                            <SelectItem value="comfortable">Comfortable</SelectItem>
                                                            <SelectItem value="compact">Compact</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3">
                                                <Button variant="outline" size="sm" class="gap-1.5" @click="resetFilters">Reset</Button>
                                                <Button size="sm" class="gap-1.5" :disabled="listLoading" @click="submitSearch">
                                                    <AppIcon name="search" class="size-3.5" />
                                                    Search
                                                </Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>{{ approvalCases.length }} cases on this page</span>
                                <span v-if="filterBadgeCount > 0">{{ filterBadgeCount }} queue filters active</span>
                                <span>Row density: {{ compactQueueRows ? 'Compact' : 'Comfortable' }}</span>
                            </div>
                        </CardHeader>

                        <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                            <ScrollArea class="min-h-0 flex-1">
                                <div class="min-h-[12rem] p-4" :class="compactQueueRows ? 'space-y-2' : 'space-y-3'">
                                    <template v-if="listLoading || pageLoading">
                                        <Skeleton class="h-16 w-full" />
                                        <Skeleton class="h-16 w-full" />
                                        <Skeleton class="h-16 w-full" />
                                    </template>
                                    <div v-else-if="approvalCases.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                        No approval cases found for current filters.
                                    </div>
                                    <div v-else :class="compactQueueRows ? 'space-y-2' : 'space-y-3'">
                                        <div
                                            v-for="item in approvalCases"
                                            :key="String(item.id ?? item.caseReference)"
                                            class="rounded-lg border bg-card transition hover:border-primary/40"
                                            :class="compactQueueRows ? 'p-2.5' : 'p-3'"
                                        >
                                            <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                                <div class="min-w-0 flex-1">
                                                    <p class="truncate font-medium">{{ item.caseReference || 'No reference' }}</p>
                                                    <p class="truncate text-xs text-muted-foreground">
                                                        {{ formatActionTypeLabel(item.actionType) }} · Target #{{ item.targetUserId ?? 'N/A' }} ·
                                                        {{ facilityLabel(item.facilityId) }} · Updated {{ formatDateTime(item.updatedAt) }}
                                                    </p>
                                                </div>
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <Badge :variant="statusVariant(item.status)">{{ formatStatusLabel(item.status) }}</Badge>
                                                    <Button size="sm" variant="outline" @click="openDetails(item)">Details</Button>
                                                    <Button
                                                        v-if="canOpenPlatformUsersPage && item.targetUserId !== null"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                    >
                                                        <Link :href="`/platform/admin/users?q=${item.targetUserId}`">Target User</Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>

                            <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
                                <p class="text-xs text-muted-foreground">
                                    Showing {{ approvalCases.length }} of {{ pagination?.total ?? approvalCases.length }} results ·
                                    Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                                </p>
                                <div class="flex items-center gap-2">
                                    <Button variant="outline" size="sm" class="gap-1.5" :disabled="!canPrev || listLoading" @click="prevPage">
                                        <AppIcon name="chevron-left" class="size-3.5" />
                                        Previous
                                    </Button>
                                    <Button variant="outline" size="sm" class="gap-1.5" :disabled="!canNext || listLoading" @click="nextPage">
                                        Next
                                        <AppIcon name="chevron-right" class="size-3.5" />
                                    </Button>
                                </div>
                            </footer>
                        </CardContent>
                    </Card>

                </div>

                <Dialog v-if="canCreate" :open="createDialogOpen" @update:open="(open) => (open ? (createDialogOpen = true) : closeCreateDialog())">
                    <DialogContent size="2xl">
                        <DialogHeader>
                            <DialogTitle class="flex items-center gap-2">
                                <AppIcon name="plus" class="size-4 text-primary" />
                                Create Approval Case
                            </DialogTitle>
                            <DialogDescription>Create a governance case for status, role, facility, or bulk user changes.</DialogDescription>
                        </DialogHeader>
                        <div class="space-y-4">
                            <div class="grid gap-3 md:grid-cols-2">
                                <div class="grid gap-2">
                                    <Label for="create-case-reference">Case reference</Label>
                                    <Input id="create-case-reference" v-model="createForm.caseReference" placeholder="CASE-2026-0001" />
                                    <p v-if="createErrors.caseReference?.length" class="text-xs text-destructive">{{ createErrors.caseReference[0] }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="create-action-type">Action type</Label>
                                    <Select v-model="createForm.actionType">
                                        <SelectTrigger id="create-action-type" class="w-full">
                                            <SelectValue placeholder="Select action type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="type in actionTypeOptions" :key="`create-action-${type}`" :value="type">
                                                {{ formatActionTypeLabel(type) }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p v-if="createErrors.actionType?.length" class="text-xs text-destructive">{{ createErrors.actionType[0] }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="create-target-user-id">Target user ID</Label>
                                    <Input id="create-target-user-id" v-model="createForm.targetUserId" inputmode="numeric" placeholder="123" />
                                    <p class="text-xs text-muted-foreground">Searchable user pickers are the next pass. This dialog still uses numeric IDs today.</p>
                                    <p v-if="createErrors.targetUserId?.length" class="text-xs text-destructive">{{ createErrors.targetUserId[0] }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="create-facility-id">Facility</Label>
                                    <Select
                                        :model-value="createForm.facilityId || '__none__'"
                                        @update:model-value="(value) => (createForm.facilityId = value === '__none__' ? '' : value)"
                                    >
                                        <SelectTrigger id="create-facility-id" class="w-full">
                                            <SelectValue placeholder="Select facility" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">No facility</SelectItem>
                                            <SelectItem
                                                v-for="facility in availableFacilities"
                                                :key="`create-facility-${String(facility.id)}`"
                                                :value="String(facility.id ?? '')"
                                            >
                                                {{ facility.code || 'FAC' }} - {{ facility.name || 'Facility' }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p v-if="createErrors.facilityId?.length" class="text-xs text-destructive">{{ createErrors.facilityId[0] }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="create-requester-user-id">Requester user ID (optional)</Label>
                                    <Input id="create-requester-user-id" v-model="createForm.requesterUserId" inputmode="numeric" placeholder="123" />
                                    <p v-if="createErrors.requesterUserId?.length" class="text-xs text-destructive">{{ createErrors.requesterUserId[0] }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="create-reviewer-user-id">Reviewer user ID (optional)</Label>
                                    <Input id="create-reviewer-user-id" v-model="createForm.reviewerUserId" inputmode="numeric" placeholder="456" />
                                    <p v-if="createErrors.reviewerUserId?.length" class="text-xs text-destructive">{{ createErrors.reviewerUserId[0] }}</p>
                                </div>
                                <div class="grid gap-2 md:col-span-2">
                                    <Label for="create-case-status">Initial status</Label>
                                    <Select v-model="createForm.status">
                                        <SelectTrigger id="create-case-status" class="w-full">
                                            <SelectValue placeholder="Select initial status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="draft">Draft</SelectItem>
                                            <SelectItem value="submitted">Submitted</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p v-if="createErrors.status?.length" class="text-xs text-destructive">{{ createErrors.status[0] }}</p>
                                </div>
                            </div>
                            <div class="grid gap-2">
                                <Label for="create-action-payload">Action payload (JSON object)</Label>
                                <Textarea id="create-action-payload" v-model="createForm.actionPayloadText" rows="8" spellcheck="false" />
                                <p v-if="createErrors.actionPayload?.length" class="text-xs text-destructive">{{ createErrors.actionPayload[0] }}</p>
                            </div>
                        </div>
                        <DialogFooter class="gap-2">
                            <Button variant="outline" :disabled="createLoading" @click="closeCreateDialog">Cancel</Button>
                            <Button :disabled="createLoading" class="gap-1.5" @click="createApprovalCase">
                                <AppIcon name="plus" class="size-3.5" />
                                {{ createLoading ? 'Creating...' : 'Create Case' }}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </template>
            <Sheet :open="detailsOpen" @update:open="(open) => (open ? (detailsOpen = true) : closeDetails())">
                <SheetContent side="right" variant="workspace" size="3xl">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2 text-lg">
                            <AppIcon name="clipboard-list" class="size-5 text-primary" />
                            Approval Case Details
                        </SheetTitle>
                        <SheetDescription>
                            Review lifecycle status, record decisions, add comments, and inspect audit evidence.
                        </SheetDescription>
                    </SheetHeader>

                    <div v-if="detailsLoading" class="space-y-3 p-4">
                        <Skeleton class="h-16 w-full" />
                        <Skeleton class="h-10 w-full" />
                        <Skeleton class="h-52 w-full" />
                    </div>
                    <div v-else-if="detailsError" class="p-4">
                        <Alert variant="destructive">
                            <AlertTitle>Unable to load case details</AlertTitle>
                            <AlertDescription>{{ detailsError }}</AlertDescription>
                        </Alert>
                    </div>
                    <ScrollArea v-else-if="selectedCase" class="min-h-0 flex-1">
                        <div class="space-y-4 p-4">
                            <div class="rounded-lg border bg-muted/20 p-3">
                                <div class="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <p class="text-base font-semibold">{{ selectedCase.caseReference || 'No reference' }}</p>
                                        <p class="text-xs text-muted-foreground">
                                            {{ formatActionTypeLabel(selectedCase.actionType) }} · Target #{{ selectedCase.targetUserId ?? 'N/A' }}
                                        </p>
                                    </div>
                                    <Badge :variant="statusVariant(selectedCase.status)">{{ formatStatusLabel(selectedCase.status) }}</Badge>
                                </div>
                            </div>

                            <Tabs v-model="detailsTab" class="space-y-3">
                                <TabsList class="w-full justify-start overflow-x-auto">
                                    <TabsTrigger value="overview">Overview</TabsTrigger>
                                    <TabsTrigger value="workflow">Workflow</TabsTrigger>
                                    <TabsTrigger value="comments">Comments</TabsTrigger>
                                    <TabsTrigger value="audit">Audit</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" class="space-y-3">
                                    <Card class="rounded-lg !gap-4 !py-4">
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <CardTitle class="text-sm font-medium">Case fields</CardTitle>
                                        </CardHeader>
                                        <CardContent class="space-y-2 px-4 pt-0 text-sm">
                                            <div class="flex justify-between gap-4"><span class="text-muted-foreground">Case id</span><span class="font-medium">{{ selectedCase.id || 'N/A' }}</span></div>
                                            <div class="flex justify-between gap-4"><span class="text-muted-foreground">Tenant</span><span class="font-medium">{{ selectedCase.tenantId || 'N/A' }}</span></div>
                                            <div class="flex justify-between gap-4"><span class="text-muted-foreground">Facility</span><span class="font-medium">{{ facilityLabel(selectedCase.facilityId) }}</span></div>
                                            <div class="flex justify-between gap-4"><span class="text-muted-foreground">Requester user</span><span class="font-medium">{{ selectedCase.requesterUserId ?? 'N/A' }}</span></div>
                                            <div class="flex justify-between gap-4"><span class="text-muted-foreground">Reviewer user</span><span class="font-medium">{{ selectedCase.reviewerUserId ?? 'N/A' }}</span></div>
                                            <div class="flex justify-between gap-4"><span class="text-muted-foreground">Submitted at</span><span class="font-medium">{{ formatDateTime(selectedCase.submittedAt) }}</span></div>
                                            <div class="flex justify-between gap-4"><span class="text-muted-foreground">Decided at</span><span class="font-medium">{{ formatDateTime(selectedCase.decidedAt) }}</span></div>
                                            <div class="flex justify-between gap-4"><span class="text-muted-foreground">Created at</span><span class="font-medium">{{ formatDateTime(selectedCase.createdAt) }}</span></div>
                                            <div class="flex justify-between gap-4"><span class="text-muted-foreground">Updated at</span><span class="font-medium">{{ formatDateTime(selectedCase.updatedAt) }}</span></div>
                                        </CardContent>
                                    </Card>

                                    <Card class="rounded-lg !gap-4 !py-4">
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <CardTitle class="text-sm font-medium">Decision reason</CardTitle>
                                        </CardHeader>
                                        <CardContent class="px-4 pt-0">
                                            <p class="text-sm text-muted-foreground">{{ selectedCase.decisionReason || 'No decision reason recorded.' }}</p>
                                        </CardContent>
                                    </Card>

                                    <Card class="rounded-lg !gap-4 !py-4">
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <CardTitle class="text-sm font-medium">Action payload</CardTitle>
                                        </CardHeader>
                                        <CardContent class="px-4 pt-0">
                                            <pre class="max-h-80 overflow-auto rounded-md border bg-muted/20 p-3 text-xs">{{ jsonPreview(selectedCase.actionPayload) }}</pre>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="workflow" class="space-y-3">
                                    <Card class="rounded-lg !gap-4 !py-4">
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <CardTitle class="text-sm font-medium">Status transition</CardTitle>
                                            <CardDescription class="text-xs">Allowed values: draft, submitted, cancelled.</CardDescription>
                                        </CardHeader>
                                        <CardContent class="space-y-3 px-4 pt-0">
                                            <Alert v-if="!canManage" variant="destructive">
                                                <AlertTitle>Status transition restricted</AlertTitle>
                                                <AlertDescription>Request <code>platform.users.approval-cases.manage</code> permission.</AlertDescription>
                                            </Alert>
                                            <Alert v-else-if="!canTransitionStatus" variant="destructive">
                                                <AlertTitle>Status transition blocked</AlertTitle>
                                                <AlertDescription>Case is already finalized and cannot transition status.</AlertDescription>
                                            </Alert>
                                            <template v-else>
                                                <div class="grid gap-2 md:grid-cols-2">
                                                    <div class="grid gap-1.5">
                                                        <Label for="details-status">Status</Label>
                                                        <Select v-model="statusForm.status">
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                            <SelectItem v-for="status in transitionStatuses" :key="`transition-${status}`" :value="status">
                                                                {{ formatStatusLabel(status) }}
                                                            </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <p v-if="firstError(statusErrors, 'status')" class="text-xs text-destructive">{{ firstError(statusErrors, 'status') }}</p>
                                                    </div>
                                                    <div class="grid gap-1.5 md:col-span-2">
                                                        <Label for="details-status-reason">Reason (optional)</Label>
                                                        <Textarea id="details-status-reason" v-model="statusForm.reason" rows="3" />
                                                        <p v-if="firstError(statusErrors, 'reason')" class="text-xs text-destructive">{{ firstError(statusErrors, 'reason') }}</p>
                                                    </div>
                                                </div>
                                                <div class="flex justify-end">
                                                    <Button size="sm" :disabled="statusSaveLoading" @click="saveStatusTransition">
                                                        {{ statusSaveLoading ? 'Saving...' : 'Save Status' }}
                                                    </Button>
                                                </div>
                                            </template>
                                        </CardContent>
                                    </Card>

                                    <Card class="rounded-lg !gap-4 !py-4">
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <CardTitle class="text-sm font-medium">Case decision</CardTitle>
                                            <CardDescription class="text-xs">Decision is allowed only when case status is submitted.</CardDescription>
                                        </CardHeader>
                                        <CardContent class="space-y-3 px-4 pt-0">
                                            <Alert v-if="!canReview" variant="destructive">
                                                <AlertTitle>Decision restricted</AlertTitle>
                                                <AlertDescription>Request <code>platform.users.approval-cases.review</code> permission.</AlertDescription>
                                            </Alert>
                                            <Alert v-else-if="!canDecide" variant="destructive">
                                                <AlertTitle>Decision blocked</AlertTitle>
                                                <AlertDescription>Submit the case first before recording approve/reject decision.</AlertDescription>
                                            </Alert>
                                            <template v-else>
                                                <div class="grid gap-2 md:grid-cols-2">
                                                    <div class="grid gap-1.5">
                                                        <Label for="details-decision">Decision</Label>
                                                        <Select v-model="decisionForm.decision">
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                            <SelectItem v-for="decision in decisionStatuses" :key="`decision-${decision}`" :value="decision">
                                                                {{ formatStatusLabel(decision) }}
                                                            </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <p v-if="firstError(decisionErrors, 'decision')" class="text-xs text-destructive">{{ firstError(decisionErrors, 'decision') }}</p>
                                                    </div>
                                                    <div class="grid gap-1.5 md:col-span-2">
                                                        <Label for="details-decision-reason">Reason</Label>
                                                        <Textarea id="details-decision-reason" v-model="decisionForm.reason" rows="3" />
                                                        <p class="text-xs text-muted-foreground">Reason is required for rejected decisions.</p>
                                                        <p v-if="firstError(decisionErrors, 'reason')" class="text-xs text-destructive">{{ firstError(decisionErrors, 'reason') }}</p>
                                                    </div>
                                                </div>
                                                <div class="flex justify-end">
                                                    <Button size="sm" :disabled="decisionSaveLoading" @click="saveDecision">
                                                        {{ decisionSaveLoading ? 'Saving...' : 'Save Decision' }}
                                                    </Button>
                                                </div>
                                            </template>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="comments" class="space-y-3">
                                    <Card class="rounded-lg !gap-4 !py-4">
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <CardTitle class="text-sm font-medium">Comments</CardTitle>
                                            <CardDescription class="text-xs">Case-level notes and review evidence.</CardDescription>
                                        </CardHeader>
                                        <CardContent class="space-y-3 px-4 pt-0">
                                            <Alert v-if="commentError" variant="destructive">
                                                <AlertTitle>Comment issue</AlertTitle>
                                                <AlertDescription>{{ commentError }}</AlertDescription>
                                            </Alert>

                                            <div v-if="commentsLoading" class="space-y-2">
                                                <Skeleton class="h-12 w-full" />
                                                <Skeleton class="h-12 w-full" />
                                            </div>
                                            <div v-else-if="comments.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                                No comments recorded yet.
                                            </div>
                                            <div v-else class="space-y-2">
                                                <div v-for="entry in comments" :key="String(entry.id)" class="rounded-md border p-3">
                                                    <div class="flex items-center justify-between gap-2">
                                                        <p class="text-xs text-muted-foreground">Author #{{ entry.authorUserId ?? 'N/A' }}</p>
                                                        <p class="text-xs text-muted-foreground">{{ formatDateTime(entry.createdAt) }}</p>
                                                    </div>
                                                    <p class="mt-2 text-sm">{{ entry.commentText || '—' }}</p>
                                                </div>
                                            </div>

                                            <Separator />
                                            <div class="grid gap-2">
                                                <Label for="details-comment">Add comment</Label>
                                                <Textarea
                                                    id="details-comment"
                                                    v-model="commentForm.comment"
                                                    rows="4"
                                                    :disabled="!canManage || commentSaveLoading"
                                                    placeholder="Add review evidence or implementation note."
                                                />
                                                <div class="flex justify-end">
                                                    <Button size="sm" :disabled="!canManage || commentSaveLoading" @click="addComment">
                                                        {{ commentSaveLoading ? 'Saving...' : 'Add Comment' }}
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="audit" class="space-y-3">
                                    <Alert v-if="!canViewAudit" variant="destructive">
                                        <AlertTitle>Audit access restricted</AlertTitle>
                                        <AlertDescription>Request <code>platform.users.approval-cases.view-audit-logs</code> permission.</AlertDescription>
                                    </Alert>

                                    <template v-else>
                                        <Card class="rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <CardTitle class="text-sm font-medium">Audit filters</CardTitle>
                                                <CardDescription class="text-xs">
                                                    {{ auditMeta?.total ?? 0 }} entries · filter by action, actor, or datetime window.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent class="space-y-3 px-4 pt-0">
                                                <div class="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                                    <Input v-model="auditFilters.q" placeholder="Search action" class="md:col-span-2" />
                                                    <Input v-model="auditFilters.action" placeholder="Action exact match" />
                                                    <Select v-model="auditFilters.actorType">
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                        <SelectItem value="">All actor types</SelectItem>
                                                        <SelectItem value="user">User</SelectItem>
                                                        <SelectItem value="system">System</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Input v-model="auditFilters.actorId" placeholder="Actor id" />
                                                    <Input v-model="auditFilters.from" type="datetime-local" />
                                                    <Input v-model="auditFilters.to" type="datetime-local" />
                                                    <Select :model-value="String(auditFilters.perPage)" @update:model-value="auditFilters.perPage = Number($event)">
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                        <SelectItem value="10">10 rows</SelectItem>
                                                        <SelectItem value="20">20 rows</SelectItem>
                                                        <SelectItem value="50">50 rows</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="flex flex-wrap items-center justify-end gap-2">
                                                    <Button variant="outline" size="sm" :disabled="auditExporting || auditLoading" @click="exportAuditLogs">
                                                        {{ auditExporting ? 'Preparing...' : 'Export CSV' }}
                                                    </Button>
                                                    <Button size="sm" :disabled="auditLoading" @click="loadAuditLogs(1)">
                                                        {{ auditLoading ? 'Loading...' : 'Apply' }}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Alert v-if="auditError" variant="destructive">
                                            <AlertTitle>Audit load issue</AlertTitle>
                                            <AlertDescription>{{ auditError }}</AlertDescription>
                                        </Alert>
                                        <div v-else-if="auditLoading" class="space-y-2">
                                            <Skeleton class="h-10 w-full" />
                                            <Skeleton class="h-10 w-full" />
                                        </div>
                                        <div v-else-if="auditLogs.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                            No audit logs found.
                                        </div>
                                        <div v-else class="space-y-2">
                                            <div v-for="log in auditLogs" :key="log.id" class="rounded-md border p-3">
                                                <div class="flex flex-wrap items-center justify-between gap-2">
                                                    <p class="text-sm font-medium">{{ log.actionLabel || log.action || 'event' }}</p>
                                                    <p class="text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }}</p>
                                                </div>
                                                <p class="mt-1 text-xs text-muted-foreground">Actor: {{ actorLabel(log) }}</p>
                                                <div class="mt-2 grid gap-2 lg:grid-cols-2">
                                                    <div>
                                                        <p class="mb-1 text-xs font-medium text-muted-foreground">Changes</p>
                                                        <pre class="max-h-40 overflow-auto rounded-md border bg-muted/20 p-2 text-[11px]">{{ jsonPreview(log.changes) }}</pre>
                                                    </div>
                                                    <div>
                                                        <p class="mb-1 text-xs font-medium text-muted-foreground">Metadata</p>
                                                        <pre class="max-h-40 overflow-auto rounded-md border bg-muted/20 p-2 text-[11px]">{{ jsonPreview(log.metadata) }}</pre>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex items-center justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                :disabled="auditLoading || !auditMeta || auditMeta.currentPage <= 1"
                                                @click="loadAuditLogs((auditMeta?.currentPage ?? 1) - 1)"
                                            >
                                                Previous
                                            </Button>
                                            <p class="text-xs text-muted-foreground">Page {{ auditMeta?.currentPage ?? 1 }} of {{ auditMeta?.lastPage ?? 1 }}</p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                :disabled="auditLoading || !auditMeta || auditMeta.currentPage >= auditMeta.lastPage"
                                                @click="loadAuditLogs((auditMeta?.currentPage ?? 1) + 1)"
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </template>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </div>
    </AppLayout>
</template>
