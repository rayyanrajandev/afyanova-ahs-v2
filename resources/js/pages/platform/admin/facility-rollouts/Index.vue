
<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type RolloutStatus = 'draft' | 'ready' | 'active' | 'completed' | 'rolled_back';
type CheckpointStatus = 'not_started' | 'in_progress' | 'blocked' | 'passed' | 'failed';
type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
type IncidentStatus = 'open' | 'mitigating' | 'resolved';
type AcceptanceStatus = 'pending' | 'accepted' | 'rejected';

type Facility = { id?: string | null; code?: string | null; name?: string | null };
type ScopeData = { resolvedFrom: string; userAccess?: { facilities?: Facility[] } };
type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };

type RolloutCheckpoint = {
    id: string | null;
    checkpointCode: string | null;
    checkpointName: string | null;
    status: CheckpointStatus | null;
    decisionNotes: string | null;
};

type RolloutIncident = {
    id: string | null;
    incidentCode: string | null;
    severity: IncidentSeverity | null;
    status: IncidentStatus | null;
    summary: string | null;
    details: string | null;
    escalatedTo: string | null;
    openedAt: string | null;
    resolvedAt: string | null;
};

type RolloutAcceptance = {
    acceptanceStatus: AcceptanceStatus | null;
    trainingCompletedAt: string | null;
    acceptanceCaseReference: string | null;
    acceptedAt: string | null;
} | null;

type RolloutPlan = {
    id: string | null;
    facilityId: string | null;
    rolloutCode: string | null;
    status: RolloutStatus | null;
    targetGoLiveAt: string | null;
    actualGoLiveAt: string | null;
    ownerUserId: number | null;
    rollbackRequired: boolean;
    rollbackReason: string | null;
    metadata: Record<string, unknown>;
    checkpoints: RolloutCheckpoint[];
    incidents: RolloutIncident[];
    acceptance: RolloutAcceptance;
    createdAt: string | null;
    updatedAt: string | null;
};

type RolloutAuditLog = {
    id: string;
    actorId: number | null;
    actorType?: 'system' | 'user' | null;
    actor?: { displayName?: string | null } | null;
    action: string | null;
    actionLabel?: string | null;
    createdAt: string | null;
};

type ValidationErrorResponse = { message?: string; errors?: Record<string, string[]> };
type RolloutListResponse = { data: RolloutPlan[]; meta: Pagination };
type RolloutResponse = { data: RolloutPlan };
type RolloutAuditListResponse = { data: RolloutAuditLog[]; meta: Pagination };

type CheckpointDraft = { key: string; checkpointCode: string; checkpointName: string; status: CheckpointStatus; decisionNotes: string };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Platform Admin', href: '/platform/admin/facility-rollouts' },
    { title: 'Facility Rollouts', href: '/platform/admin/facility-rollouts' },
];

const rolloutStatuses: RolloutStatus[] = ['draft', 'ready', 'active', 'completed', 'rolled_back'];
const checkpointStatuses: CheckpointStatus[] = ['not_started', 'in_progress', 'blocked', 'passed', 'failed'];
const incidentSeverities: IncidentSeverity[] = ['low', 'medium', 'high', 'critical'];
const incidentStatuses: IncidentStatus[] = ['open', 'mitigating', 'resolved'];
const acceptanceStatuses: AcceptanceStatus[] = ['pending', 'accepted', 'rejected'];

const { permissionNames, permissionState, scope: sharedScope, multiTenantIsolationEnabled } = usePlatformAccess();
const permissionsResolved = computed(() => permissionNames.value !== null);
const canRead = computed(() => permissionState('platform.multi-facility.read') === 'allowed');
const canManageRollouts = computed(() => permissionState('platform.multi-facility.manage-rollouts') === 'allowed');
const canManageIncidents = computed(() => permissionState('platform.multi-facility.manage-incidents') === 'allowed');
const canExecuteRollback = computed(() => permissionState('platform.multi-facility.execute-rollback') === 'allowed');
const canApproveAcceptance = computed(() => permissionState('platform.multi-facility.approve-acceptance') === 'allowed');
const canViewAudit = computed(() => permissionState('platform.multi-facility.view-audit-logs') === 'allowed');

const scope = computed<ScopeData | null>(() => (sharedScope.value as ScopeData | null) ?? null);
const availableFacilities = computed(() => scope.value?.userAccess?.facilities ?? []);
const scopeUnresolved = computed(() => multiTenantIsolationEnabled.value && (scope.value?.resolvedFrom ?? 'none') === 'none');

const compactQueueRows = useLocalStorageBoolean('platform.multi-facility.queueRows.compact', false);

const pageLoading = ref(true);
const listLoading = ref(false);
const listErrors = ref<string[]>([]);
const plans = ref<RolloutPlan[]>([]);
const pagination = ref<Pagination | null>(null);

const filters = reactive({ q: '', status: '', facilityId: '', page: 1, perPage: 20 });

const createLoading = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const createForm = reactive({ facilityId: '', rolloutCode: '', status: 'draft' as RolloutStatus, targetGoLiveAt: '', ownerUserId: '' });

const detailsOpen = ref(false);
const detailsLoading = ref(false);
const detailsError = ref<string | null>(null);
const detailsTab = ref('overview');
const selectedPlan = ref<RolloutPlan | null>(null);

const planSaveLoading = ref(false);
const planErrors = ref<Record<string, string[]>>({});
const planForm = reactive({ rolloutCode: '', status: 'draft' as RolloutStatus, targetGoLiveAt: '', actualGoLiveAt: '', ownerUserId: '', metadataText: '{}' });

const checkpointDrafts = ref<CheckpointDraft[]>([]);
const checkpointErrors = ref<Record<string, string[]>>({});
const checkpointSaveLoading = ref(false);

const incidentDialogOpen = ref(false);
const incidentDialogMode = ref<'create' | 'edit'>('create');
const incidentTargetId = ref<string | null>(null);
const incidentSaveLoading = ref(false);
const incidentErrors = ref<Record<string, string[]>>({});
const incidentForm = reactive({ incidentCode: '', severity: 'medium' as IncidentSeverity, status: 'open' as IncidentStatus, summary: '', details: '', escalatedTo: '', openedAt: '', resolvedAt: '' });

const rollbackDialogOpen = ref(false);
const rollbackLoading = ref(false);
const rollbackError = ref<string | null>(null);
const rollbackForm = reactive({ reason: '', approvalCaseReference: '' });

const acceptanceSaveLoading = ref(false);
const acceptanceErrors = ref<Record<string, string[]>>({});
const acceptanceForm = reactive({ acceptanceStatus: 'pending' as AcceptanceStatus, trainingCompletedAt: '', acceptanceCaseReference: '' });

const auditLoading = ref(false);
const auditError = ref<string | null>(null);
const auditLogs = ref<RolloutAuditLog[]>([]);
const auditMeta = ref<Pagination | null>(null);
const auditExporting = ref(false);
const auditFilters = reactive({ q: '', action: '', actorType: '', actorId: '', from: '', to: '', page: 1, perPage: 20 });

function csrfToken(): string | null {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
}

function firstError(errors: Record<string, string[]> | null | undefined, key: string): string | null {
    return errors?.[key]?.[0] ?? null;
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
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active' || normalized === 'ready' || normalized === 'completed') return 'secondary';
    if (normalized === 'rolled_back' || normalized === 'rejected') return 'destructive';
    return 'outline';
}

function severityVariant(severity: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (severity ?? '').toLowerCase();
    if (normalized === 'high' || normalized === 'critical') return 'destructive';
    if (normalized === 'medium') return 'secondary';
    return 'outline';
}

function facilityLabel(facilityId: string | null): string {
    const id = String(facilityId ?? '').trim();
    if (!id) return 'No facility';
    const facility = availableFacilities.value.find((entry) => String(entry.id ?? '') === id);
    if (!facility) return id;
    return `${facility.code || 'FAC'} - ${facility.name || 'Facility'}`;
}

function checkpointProgress(plan: RolloutPlan): string {
    const total = plan.checkpoints.length;
    if (total === 0) return '0/0';
    const passed = plan.checkpoints.filter((checkpoint) => checkpoint.status === 'passed').length;
    return `${passed}/${total}`;
}

async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> }): Promise<T> {
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
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as Error & { status?: number; payload?: ValidationErrorResponse };
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload as T;
}

const queueCounts = computed(() => {
    const counts = { draft: 0, ready: 0, active: 0, completed: 0, rolled_back: 0 };
    for (const plan of plans.value) {
        const status = String(plan.status ?? '') as keyof typeof counts;
        if (status in counts) counts[status] += 1;
    }
    return counts;
});

const canPrev = computed(() => (pagination.value?.currentPage ?? 1) > 1);
const canNext = computed(() => Boolean(pagination.value && pagination.value.currentPage < pagination.value.lastPage));

function syncPlan(plan: RolloutPlan): void {
    const index = plans.value.findIndex((entry) => entry.id === plan.id);
    if (index >= 0) plans.value[index] = plan;
}

function hydrateDetails(plan: RolloutPlan): void {
    planForm.rolloutCode = plan.rolloutCode ?? '';
    planForm.status = (plan.status ?? 'draft') as RolloutStatus;
    planForm.targetGoLiveAt = toDateTimeInput(plan.targetGoLiveAt);
    planForm.actualGoLiveAt = toDateTimeInput(plan.actualGoLiveAt);
    planForm.ownerUserId = plan.ownerUserId === null ? '' : String(plan.ownerUserId);
    planForm.metadataText = JSON.stringify(plan.metadata ?? {}, null, 2);

    checkpointDrafts.value = plan.checkpoints.map((checkpoint, index) => ({
        key: checkpoint.id ?? `checkpoint-${index}`,
        checkpointCode: checkpoint.checkpointCode ?? '',
        checkpointName: checkpoint.checkpointName ?? '',
        status: (checkpoint.status ?? 'not_started') as CheckpointStatus,
        decisionNotes: checkpoint.decisionNotes ?? '',
    }));

    acceptanceForm.acceptanceStatus = (plan.acceptance?.acceptanceStatus ?? 'pending') as AcceptanceStatus;
    acceptanceForm.trainingCompletedAt = toDateTimeInput(plan.acceptance?.trainingCompletedAt ?? null);
    acceptanceForm.acceptanceCaseReference = plan.acceptance?.acceptanceCaseReference ?? '';
}

function parseOwnerUserId(value: string): number | null | 'invalid' {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 'invalid';
    return parsed;
}

function parseMetadataText(value: string): Record<string, unknown> | null | 'invalid' {
    const normalized = value.trim();
    if (!normalized) return null;

    try {
        const parsed = JSON.parse(normalized) as unknown;
        if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') return 'invalid';
        return parsed as Record<string, unknown>;
    } catch {
        return 'invalid';
    }
}

async function loadPlans(): Promise<void> {
    if (!canRead.value) {
        plans.value = [];
        pagination.value = null;
        pageLoading.value = false;
        listLoading.value = false;
        return;
    }

    listLoading.value = true;
    listErrors.value = [];

    try {
        const response = await apiRequest<RolloutListResponse>('GET', '/platform/admin/facility-rollouts', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status || null,
                facilityId: filters.facilityId || null,
                perPage: filters.perPage,
                page: filters.page,
            },
        });

        plans.value = response.data ?? [];
        pagination.value = response.meta ?? null;
    } catch (error) {
        listErrors.value = [messageFromUnknown(error, 'Unable to load rollout plans.')];
        plans.value = [];
        pagination.value = null;
    } finally {
        listLoading.value = false;
        pageLoading.value = false;
    }
}

async function refreshPage(): Promise<void> {
    await loadPlans();
}

function submitSearch(): void {
    filters.page = 1;
    void loadPlans();
}

function resetFilters(): void {
    filters.q = '';
    filters.status = '';
    filters.facilityId = '';
    filters.page = 1;
    filters.perPage = 20;
    void loadPlans();
}

function prevPage(): void {
    if (!canPrev.value) return;
    filters.page -= 1;
    void loadPlans();
}

function nextPage(): void {
    if (!canNext.value) return;
    filters.page += 1;
    void loadPlans();
}

function scrollToCreate(): void {
    document.getElementById('create-facility-rollout')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function createRollout(): Promise<void> {
    if (!canManageRollouts.value || createLoading.value) return;

    createLoading.value = true;
    createErrors.value = {};

    const ownerUserId = parseOwnerUserId(createForm.ownerUserId);
    if (ownerUserId === 'invalid') {
        createLoading.value = false;
        createErrors.value = { ownerUserId: ['Owner user ID must be a positive integer.'] };
        return;
    }

    try {
        await apiRequest<RolloutResponse>('POST', '/platform/admin/facility-rollouts', {
            body: {
                facilityId: createForm.facilityId.trim(),
                rolloutCode: createForm.rolloutCode.trim().toUpperCase(),
                status: createForm.status,
                targetGoLiveAt: toApiDateTime(createForm.targetGoLiveAt),
                ownerUserId,
            },
        });

        createForm.rolloutCode = '';
        createForm.targetGoLiveAt = '';
        createForm.ownerUserId = '';
        notifySuccess('Rollout created.');
        await loadPlans();
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) createErrors.value = apiError.payload.errors;
        else notifyError(messageFromUnknown(error, 'Unable to create rollout.'));
    } finally {
        createLoading.value = false;
    }
}

async function loadDetails(planId: string): Promise<void> {
    detailsLoading.value = true;
    detailsError.value = null;

    try {
        const response = await apiRequest<RolloutResponse>('GET', `/platform/admin/facility-rollouts/${planId}`);
        selectedPlan.value = response.data;
        hydrateDetails(response.data);
        if (canViewAudit.value) await loadAuditLogs(1);
    } catch (error) {
        detailsError.value = messageFromUnknown(error, 'Unable to load rollout details.');
        selectedPlan.value = null;
    } finally {
        detailsLoading.value = false;
    }
}

function openDetails(plan: RolloutPlan): void {
    const planId = String(plan.id ?? '').trim();
    if (!planId) return;

    detailsOpen.value = true;
    detailsTab.value = 'overview';
    selectedPlan.value = null;
    detailsError.value = null;
    planErrors.value = {};
    checkpointErrors.value = {};
    incidentErrors.value = {};
    acceptanceErrors.value = {};
    auditError.value = null;
    auditLogs.value = [];
    auditMeta.value = null;
    auditFilters.q = '';
    auditFilters.action = '';
    auditFilters.actorType = '';
    auditFilters.actorId = '';
    auditFilters.from = '';
    auditFilters.to = '';
    auditFilters.page = 1;
    auditFilters.perPage = 20;

    void loadDetails(planId);
}

function closeDetails(): void {
    detailsOpen.value = false;
    selectedPlan.value = null;
}

async function savePlan(): Promise<void> {
    const planId = String(selectedPlan.value?.id ?? '').trim();
    if (!planId || !canManageRollouts.value || planSaveLoading.value) return;

    planSaveLoading.value = true;
    planErrors.value = {};

    const ownerUserId = parseOwnerUserId(planForm.ownerUserId);
    if (ownerUserId === 'invalid') {
        planSaveLoading.value = false;
        planErrors.value = { ownerUserId: ['Owner user ID must be a positive integer.'] };
        return;
    }

    const metadata = parseMetadataText(planForm.metadataText);
    if (metadata === 'invalid') {
        planSaveLoading.value = false;
        planErrors.value = { metadata: ['Metadata must be a valid JSON object.'] };
        return;
    }

    try {
        const response = await apiRequest<RolloutResponse>('PATCH', `/platform/admin/facility-rollouts/${planId}`, {
            body: {
                rolloutCode: planForm.rolloutCode.trim().toUpperCase(),
                status: planForm.status,
                targetGoLiveAt: toApiDateTime(planForm.targetGoLiveAt),
                actualGoLiveAt: toApiDateTime(planForm.actualGoLiveAt),
                ownerUserId,
                metadata,
            },
        });

        selectedPlan.value = response.data;
        hydrateDetails(response.data);
        syncPlan(response.data);
        notifySuccess('Rollout plan updated.');
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) planErrors.value = apiError.payload.errors;
        else notifyError(messageFromUnknown(error, 'Unable to update rollout plan.'));
    } finally {
        planSaveLoading.value = false;
    }
}

function addCheckpoint(): void {
    checkpointDrafts.value = [
        ...checkpointDrafts.value,
        { key: `new-${Date.now()}`, checkpointCode: '', checkpointName: '', status: 'not_started', decisionNotes: '' },
    ];
}

function removeCheckpoint(index: number): void {
    checkpointDrafts.value = checkpointDrafts.value.filter((_, currentIndex) => currentIndex !== index);
}

async function saveCheckpoints(): Promise<void> {
    const planId = String(selectedPlan.value?.id ?? '').trim();
    if (!planId || !canManageRollouts.value || checkpointSaveLoading.value) return;

    checkpointErrors.value = {};
    if (checkpointDrafts.value.length === 0) {
        checkpointErrors.value = { checkpoints: ['Add at least one checkpoint.'] };
        return;
    }

    checkpointSaveLoading.value = true;

    try {
        const response = await apiRequest<RolloutResponse>('PATCH', `/platform/admin/facility-rollouts/${planId}/checkpoints`, {
            body: {
                checkpoints: checkpointDrafts.value.map((checkpoint) => ({
                    checkpointCode: checkpoint.checkpointCode.trim().toUpperCase(),
                    checkpointName: checkpoint.checkpointName.trim(),
                    status: checkpoint.status,
                    decisionNotes: checkpoint.decisionNotes.trim() || null,
                })),
            },
        });

        selectedPlan.value = response.data;
        hydrateDetails(response.data);
        syncPlan(response.data);
        notifySuccess('Checkpoints saved.');
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) checkpointErrors.value = apiError.payload.errors;
        else notifyError(messageFromUnknown(error, 'Unable to save checkpoints.'));
    } finally {
        checkpointSaveLoading.value = false;
    }
}

function openIncidentCreate(): void {
    incidentDialogMode.value = 'create';
    incidentTargetId.value = null;
    incidentErrors.value = {};
    incidentForm.incidentCode = '';
    incidentForm.severity = 'medium';
    incidentForm.status = 'open';
    incidentForm.summary = '';
    incidentForm.details = '';
    incidentForm.escalatedTo = '';
    incidentForm.openedAt = '';
    incidentForm.resolvedAt = '';
    incidentDialogOpen.value = true;
}

function openIncidentEdit(incident: RolloutIncident): void {
    incidentDialogMode.value = 'edit';
    incidentTargetId.value = String(incident.id ?? '');
    incidentErrors.value = {};
    incidentForm.incidentCode = incident.incidentCode ?? '';
    incidentForm.severity = (incident.severity ?? 'medium') as IncidentSeverity;
    incidentForm.status = (incident.status ?? 'open') as IncidentStatus;
    incidentForm.summary = incident.summary ?? '';
    incidentForm.details = incident.details ?? '';
    incidentForm.escalatedTo = incident.escalatedTo ?? '';
    incidentForm.openedAt = toDateTimeInput(incident.openedAt);
    incidentForm.resolvedAt = toDateTimeInput(incident.resolvedAt);
    incidentDialogOpen.value = true;
}

function closeIncidentDialog(): void {
    incidentDialogOpen.value = false;
    incidentTargetId.value = null;
}

async function saveIncident(): Promise<void> {
    const planId = String(selectedPlan.value?.id ?? '').trim();
    if (!planId || !canManageIncidents.value || incidentSaveLoading.value) return;

    incidentSaveLoading.value = true;
    incidentErrors.value = {};

    try {
        let response: RolloutResponse;
        if (incidentDialogMode.value === 'create') {
            response = await apiRequest<RolloutResponse>('POST', `/platform/admin/facility-rollouts/${planId}/incidents`, {
                body: {
                    incidentCode: incidentForm.incidentCode.trim().toUpperCase(),
                    severity: incidentForm.severity,
                    status: incidentForm.status,
                    summary: incidentForm.summary.trim(),
                    details: incidentForm.details.trim() || null,
                    escalatedTo: incidentForm.escalatedTo.trim() || null,
                    openedAt: toApiDateTime(incidentForm.openedAt),
                },
            });
        } else {
            const incidentId = String(incidentTargetId.value ?? '').trim();
            response = await apiRequest<RolloutResponse>('PATCH', `/platform/admin/facility-rollouts/${planId}/incidents/${incidentId}`, {
                body: {
                    severity: incidentForm.severity,
                    status: incidentForm.status,
                    summary: incidentForm.summary.trim(),
                    details: incidentForm.details.trim() || null,
                    escalatedTo: incidentForm.escalatedTo.trim() || null,
                    resolvedAt: toApiDateTime(incidentForm.resolvedAt),
                },
            });
        }

        selectedPlan.value = response.data;
        hydrateDetails(response.data);
        syncPlan(response.data);
        incidentDialogOpen.value = false;
        notifySuccess('Incident saved.');
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) incidentErrors.value = apiError.payload.errors;
        else notifyError(messageFromUnknown(error, 'Unable to save incident.'));
    } finally {
        incidentSaveLoading.value = false;
    }
}

function openRollbackDialog(): void {
    rollbackDialogOpen.value = true;
    rollbackError.value = null;
    rollbackForm.reason = '';
    rollbackForm.approvalCaseReference = '';
}

function closeRollbackDialog(): void {
    rollbackDialogOpen.value = false;
    rollbackError.value = null;
}

async function executeRollback(): Promise<void> {
    const planId = String(selectedPlan.value?.id ?? '').trim();
    if (!planId || !canExecuteRollback.value || rollbackLoading.value) return;

    rollbackLoading.value = true;
    rollbackError.value = null;

    try {
        const response = await apiRequest<RolloutResponse>('POST', `/platform/admin/facility-rollouts/${planId}/rollback`, {
            body: {
                reason: rollbackForm.reason.trim(),
                approvalCaseReference: rollbackForm.approvalCaseReference.trim(),
            },
        });

        selectedPlan.value = response.data;
        hydrateDetails(response.data);
        syncPlan(response.data);
        rollbackDialogOpen.value = false;
        notifySuccess('Rollback executed.');
    } catch (error) {
        rollbackError.value = messageFromUnknown(error, 'Unable to execute rollback.');
    } finally {
        rollbackLoading.value = false;
    }
}

async function saveAcceptance(): Promise<void> {
    const planId = String(selectedPlan.value?.id ?? '').trim();
    if (!planId || !canApproveAcceptance.value || acceptanceSaveLoading.value) return;

    acceptanceSaveLoading.value = true;
    acceptanceErrors.value = {};

    try {
        const response = await apiRequest<RolloutResponse>('PATCH', `/platform/admin/facility-rollouts/${planId}/acceptance`, {
            body: {
                acceptanceStatus: acceptanceForm.acceptanceStatus,
                trainingCompletedAt: toApiDateTime(acceptanceForm.trainingCompletedAt),
                acceptanceCaseReference: acceptanceForm.acceptanceCaseReference.trim() || null,
            },
        });

        selectedPlan.value = response.data;
        hydrateDetails(response.data);
        syncPlan(response.data);
        notifySuccess('Acceptance updated.');
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) acceptanceErrors.value = apiError.payload.errors;
        else notifyError(messageFromUnknown(error, 'Unable to save acceptance.'));
    } finally {
        acceptanceSaveLoading.value = false;
    }
}

async function loadAuditLogs(page?: number): Promise<void> {
    const planId = String(selectedPlan.value?.id ?? '').trim();
    if (!planId || !canViewAudit.value) return;

    if (typeof page === 'number') auditFilters.page = page;

    auditLoading.value = true;
    auditError.value = null;

    try {
        const response = await apiRequest<RolloutAuditListResponse>('GET', `/platform/admin/facility-rollouts/${planId}/audit-logs`, {
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
        auditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
        auditLogs.value = [];
        auditMeta.value = null;
    } finally {
        auditLoading.value = false;
    }
}

function exportAuditLogs(): void {
    const planId = String(selectedPlan.value?.id ?? '').trim();
    if (!planId || !canViewAudit.value || auditExporting.value) return;

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
            ? `/api/v1/platform/admin/facility-rollouts/${planId}/audit-logs/export?${query}`
            : `/api/v1/platform/admin/facility-rollouts/${planId}/audit-logs/export`;

        window.open(href, '_blank', 'noopener');
    } finally {
        auditExporting.value = false;
    }
}

onMounted(async () => {
    if (availableFacilities.value.length > 0) createForm.facilityId = String(availableFacilities.value[0]?.id ?? '');
    await loadPlans();
});
</script>

<template>
    <Head title="Facility Rollouts" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="clipboard-list" class="size-7 text-primary" />
                        Multi-Facility Rollout Operations
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">Queue, details, incidents, rollback, and acceptance controls.</p>
                </div>
                <div class="flex items-center gap-2">
                    <Button variant="outline" size="sm" class="gap-1.5" :disabled="listLoading" @click="refreshPage">
                        <AppIcon name="activity" class="size-3.5" />
                        {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                    <Button v-if="canManageRollouts" size="sm" class="gap-1.5" @click="scrollToCreate">
                        <AppIcon name="plus" class="size-3.5" />
                        Create Rollout
                    </Button>
                </div>
            </div>

            <Alert v-if="scopeUnresolved" variant="destructive">
                <AlertTitle>Scope unresolved</AlertTitle>
                <AlertDescription>Scope could not be resolved. Apply tenant/facility scope before rollout updates.</AlertDescription>
            </Alert>

            <Alert v-if="!permissionsResolved" variant="destructive">
                <AlertTitle>Permission context pending</AlertTitle>
                <AlertDescription>Wait for permission context before taking rollout actions.</AlertDescription>
            </Alert>

            <div v-if="canRead" class="flex min-h-9 flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2">
                <span class="text-xs font-medium text-muted-foreground">Queue:</span>
                <span class="rounded-md border bg-background px-2.5 py-1 text-xs">Draft {{ queueCounts.draft }}</span>
                <span class="rounded-md border bg-background px-2.5 py-1 text-xs">Ready {{ queueCounts.ready }}</span>
                <span class="rounded-md border bg-background px-2.5 py-1 text-xs">Active {{ queueCounts.active }}</span>
                <span class="rounded-md border bg-background px-2.5 py-1 text-xs">Completed {{ queueCounts.completed }}</span>
                <span class="rounded-md border bg-background px-2.5 py-1 text-xs">Rolled Back {{ queueCounts.rolled_back }}</span>
            </div>

            <Alert v-if="listErrors.length" variant="destructive">
                <AlertTitle>Request error</AlertTitle>
                <AlertDescription>
                    <p v-for="message in listErrors" :key="message" class="text-xs">{{ message }}</p>
                </AlertDescription>
            </Alert>

            <Card v-if="canRead" class="rounded-lg border-sidebar-border/70">
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                        Rollout Queue
                    </CardTitle>
                    <CardDescription>{{ plans.length }} on this page | Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}</CardDescription>
                </CardHeader>
                <CardContent class="space-y-3">
                    <div class="grid gap-2 md:grid-cols-5">
                        <Input v-model="filters.q" class="md:col-span-2" placeholder="Rollout code" @keyup.enter="submitSearch" />
                        <Select v-model="filters.status">
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="">All statuses</SelectItem>
                            <SelectItem v-for="status in rolloutStatuses" :key="status" :value="status">{{ formatEnumLabel(status) }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select v-model="filters.facilityId">
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="">All facilities</SelectItem>
                            <SelectItem v-for="facility in availableFacilities" :key="String(facility.id ?? '')" :value="String(facility.id ?? '')">
                                {{ (facility.code || 'FAC') + ' - ' + (facility.name || 'Facility') }}
                            </SelectItem>
                            </SelectContent>
                        </Select>
                        <div class="flex items-center gap-2">
                            <Button size="sm" class="gap-1.5" :disabled="listLoading" @click="submitSearch">
                                <AppIcon name="search" class="size-3.5" />
                                Search
                            </Button>
                            <Button size="sm" variant="outline" :disabled="listLoading" @click="resetFilters">Reset</Button>
                        </div>
                    </div>

                    <Button variant="outline" size="sm" class="gap-1.5" @click="compactQueueRows = !compactQueueRows">
                        <AppIcon name="layout-list" class="size-3.5" />
                        {{ compactQueueRows ? 'Comfortable rows' : 'Compact rows' }}
                    </Button>

                    <div v-if="pageLoading || listLoading" class="space-y-2">
                        <Skeleton class="h-14 w-full" />
                        <Skeleton class="h-14 w-full" />
                    </div>
                    <div v-else-if="plans.length === 0" class="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                        No rollout plans found.
                    </div>
                    <div v-else class="space-y-2">
                        <div
                            v-for="plan in plans"
                            :key="String(plan.id ?? plan.rolloutCode ?? Math.random())"
                            class="rounded-lg border"
                            :class="compactQueueRows ? 'px-2 py-1.5' : 'px-3 py-2.5'"
                        >
                            <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <p class="text-sm font-semibold">{{ plan.rolloutCode || plan.id || 'Rollout' }}</p>
                                    <p class="text-xs text-muted-foreground">{{ facilityLabel(plan.facilityId) }} | Target {{ formatDateTime(plan.targetGoLiveAt) }}</p>
                                    <p class="text-xs text-muted-foreground">Checkpoints {{ checkpointProgress(plan) }} | Incidents {{ plan.incidents.length }}</p>
                                    <p v-if="plan.rollbackRequired && plan.rollbackReason" class="text-xs text-destructive">Rollback: {{ plan.rollbackReason }}</p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <Badge :variant="statusVariant(plan.status)">{{ formatEnumLabel(plan.status) }}</Badge>
                                    <Button size="sm" variant="outline" class="gap-1.5" @click="openDetails(plan)">
                                        <AppIcon name="eye" class="size-3.5" />
                                        Details
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <footer class="flex items-center justify-between border-t pt-3">
                        <p class="text-xs text-muted-foreground">Showing {{ plans.length }} of {{ pagination?.total ?? 0 }}</p>
                        <div class="flex items-center gap-2">
                            <Button variant="outline" size="sm" :disabled="listLoading || !canPrev" @click="prevPage">Previous</Button>
                            <Button variant="outline" size="sm" :disabled="listLoading || !canNext" @click="nextPage">Next</Button>
                        </div>
                    </footer>
                </CardContent>
            </Card>

            <Card v-else class="rounded-lg border-sidebar-border/70">
                <CardHeader>
                    <CardTitle>Rollout Queue</CardTitle>
                    <CardDescription>Rollout access is permission restricted.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertTitle>Access restricted</AlertTitle>
                        <AlertDescription>Request <code>platform.multi-facility.read</code> permission.</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>

            <Card id="create-facility-rollout" class="rounded-lg border-sidebar-border/70">
                <CardHeader>
                    <CardTitle>Create Rollout Plan</CardTitle>
                    <CardDescription>Create plan entries for facility waves.</CardDescription>
                </CardHeader>
                <CardContent class="space-y-3">
                    <Alert v-if="!canManageRollouts" variant="destructive">
                        <AlertTitle>Create access restricted</AlertTitle>
                        <AlertDescription>Request <code>platform.multi-facility.manage-rollouts</code> permission.</AlertDescription>
                    </Alert>
                    <template v-else>
                        <div class="grid gap-3 md:grid-cols-2">
                            <div class="grid gap-2">
                                <Label for="rollout-facility">Facility</Label>
                                <Select v-model="createForm.facilityId">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="">Select facility</SelectItem>
                                    <SelectItem v-for="facility in availableFacilities" :key="String(facility.id ?? '')" :value="String(facility.id ?? '')">
                                        {{ (facility.code || 'FAC') + ' - ' + (facility.name || 'Facility') }}
                                    </SelectItem>
                                    </SelectContent>
                                </Select>
                                <Input v-if="availableFacilities.length === 0" v-model="createForm.facilityId" placeholder="Facility UUID" />
                            </div>
                            <div class="grid gap-2">
                                <Label for="rollout-code">Rollout code</Label>
                                <Input id="rollout-code" v-model="createForm.rolloutCode" placeholder="ROL-WAVE-001" />
                            </div>
                            <div class="grid gap-2">
                                <Label for="rollout-status">Status</Label>
                                <Select v-model="createForm.status">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem v-for="status in rolloutStatuses" :key="status" :value="status">{{ formatEnumLabel(status) }}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-2">
                                <Label for="rollout-target">Target go-live</Label>
                                <Input id="rollout-target" v-model="createForm.targetGoLiveAt" type="datetime-local" />
                            </div>
                            <div class="grid gap-2">
                                <Label for="rollout-owner">Owner user ID</Label>
                                <Input id="rollout-owner" v-model="createForm.ownerUserId" inputmode="numeric" />
                                <p v-if="firstError(createErrors, 'ownerUserId')" class="text-xs text-destructive">{{ firstError(createErrors, 'ownerUserId') }}</p>
                            </div>
                        </div>
                        <div class="flex justify-end border-t pt-3">
                            <Button class="gap-1.5" :disabled="createLoading" @click="createRollout">
                                <AppIcon name="plus" class="size-3.5" />
                                {{ createLoading ? 'Creating...' : 'Create Rollout' }}
                            </Button>
                        </div>
                    </template>
                </CardContent>
            </Card>

            <Sheet :open="detailsOpen" @update:open="(open) => (open ? (detailsOpen = true) : closeDetails())">
                <SheetContent side="right" variant="workspace" size="4xl">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle>{{ selectedPlan?.rolloutCode || selectedPlan?.id || 'Rollout details' }}</SheetTitle>
                        <SheetDescription>{{ facilityLabel(selectedPlan?.facilityId ?? null) }} | Status {{ formatEnumLabel(selectedPlan?.status) }}</SheetDescription>
                    </SheetHeader>

                    <div class="min-h-0 flex-1 overflow-hidden">
                        <div v-if="detailsLoading" class="space-y-2 p-4">
                            <Skeleton class="h-14 w-full" />
                            <Skeleton class="h-14 w-full" />
                        </div>
                        <Alert v-else-if="detailsError" variant="destructive" class="m-4">
                            <AlertTitle>Details load failed</AlertTitle>
                            <AlertDescription>{{ detailsError }}</AlertDescription>
                        </Alert>

                        <Tabs v-else-if="selectedPlan" v-model="detailsTab" class="flex h-full min-h-0 flex-col">
                            <div class="border-b px-4 py-2">
                                <TabsList class="w-full justify-start overflow-x-auto">
                                    <TabsTrigger value="overview">Overview</TabsTrigger>
                                    <TabsTrigger value="checkpoints">Checkpoints</TabsTrigger>
                                    <TabsTrigger value="incidents">Incidents</TabsTrigger>
                                    <TabsTrigger value="acceptance">Acceptance</TabsTrigger>
                                    <TabsTrigger value="audit">Audit</TabsTrigger>
                                </TabsList>
                            </div>

                            <ScrollArea class="min-h-0 flex-1">
                                <div class="space-y-4 p-4">
                                    <TabsContent value="overview" class="space-y-3">
                                        <div class="grid gap-3 md:grid-cols-2">
                                            <div class="grid gap-2"><Label>Rollout code</Label><Input v-model="planForm.rolloutCode" :disabled="!canManageRollouts" /></div>
                                            <div class="grid gap-2"><Label>Status</Label><Select v-model="planForm.status"><SelectTrigger :disabled="!canManageRollouts"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="status in rolloutStatuses" :key="status" :value="status">{{ formatEnumLabel(status) }}</SelectItem></SelectContent></Select></div>
                                            <div class="grid gap-2"><Label>Target go-live</Label><Input v-model="planForm.targetGoLiveAt" type="datetime-local" :disabled="!canManageRollouts" /></div>
                                            <div class="grid gap-2"><Label>Actual go-live</Label><Input v-model="planForm.actualGoLiveAt" type="datetime-local" :disabled="!canManageRollouts" /></div>
                                            <div class="grid gap-2"><Label>Owner user ID</Label><Input v-model="planForm.ownerUserId" inputmode="numeric" :disabled="!canManageRollouts" /></div>
                                            <div class="grid gap-2 md:col-span-2"><Label>Metadata (JSON)</Label><Textarea v-model="planForm.metadataText" class="min-h-24 font-mono text-xs" :disabled="!canManageRollouts" /></div>
                                        </div>
                                        <div class="flex justify-end"><Button v-if="canManageRollouts" :disabled="planSaveLoading" @click="savePlan">{{ planSaveLoading ? 'Saving...' : 'Save Plan' }}</Button></div>
                                    </TabsContent>

                                    <TabsContent value="checkpoints" class="space-y-3">
                                        <Alert v-if="firstError(checkpointErrors, 'checkpoints')" variant="destructive"><AlertTitle>Checkpoint issue</AlertTitle><AlertDescription>{{ firstError(checkpointErrors, 'checkpoints') }}</AlertDescription></Alert>
                                        <div class="space-y-2">
                                            <div v-for="(checkpoint, index) in checkpointDrafts" :key="checkpoint.key" class="rounded-md border p-3">
                                                <div class="grid gap-2 md:grid-cols-2">
                                                    <Input v-model="checkpoint.checkpointCode" placeholder="Code" :disabled="!canManageRollouts" />
                                                    <Input v-model="checkpoint.checkpointName" placeholder="Name" :disabled="!canManageRollouts" />
                                                    <Select v-model="checkpoint.status">
                                                        <SelectTrigger :disabled="!canManageRollouts">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent><SelectItem v-for="status in checkpointStatuses" :key="status" :value="status">{{ formatEnumLabel(status) }}</SelectItem></SelectContent></Select>
                                                    <Textarea v-model="checkpoint.decisionNotes" class="min-h-20 md:col-span-2" placeholder="Decision notes" :disabled="!canManageRollouts" />
                                                </div>
                                                <div class="mt-2 flex justify-end"><Button v-if="canManageRollouts" variant="outline" size="sm" @click="removeCheckpoint(index)">Remove</Button></div>
                                            </div>
                                        </div>
                                        <div class="flex justify-between border-t pt-3">
                                            <Button v-if="canManageRollouts" variant="outline" size="sm" @click="addCheckpoint">Add Checkpoint</Button>
                                            <Button v-if="canManageRollouts" size="sm" :disabled="checkpointSaveLoading" @click="saveCheckpoints">{{ checkpointSaveLoading ? 'Saving...' : 'Save Checkpoints' }}</Button>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="incidents" class="space-y-3">
                                        <div class="flex items-center justify-between"><p class="text-xs text-muted-foreground">{{ selectedPlan.incidents.length }} incidents</p><Button v-if="canManageIncidents" size="sm" @click="openIncidentCreate">New Incident</Button></div>
                                        <div v-if="selectedPlan.incidents.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No incidents recorded.</div>
                                        <div v-else class="space-y-2">
                                            <div v-for="incident in selectedPlan.incidents" :key="String(incident.id ?? incident.incidentCode ?? Math.random())" class="rounded-md border p-3">
                                                <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <p class="text-sm font-medium">{{ incident.incidentCode || incident.id || 'Incident' }}</p>
                                                        <p class="text-xs text-muted-foreground">{{ incident.summary || 'No summary provided.' }}</p>
                                                        <p class="text-xs text-muted-foreground">Opened {{ formatDateTime(incident.openedAt) }} | Resolved {{ formatDateTime(incident.resolvedAt) }}</p>
                                                    </div>
                                                    <div class="flex items-center gap-2"><Badge :variant="severityVariant(incident.severity)">{{ formatEnumLabel(incident.severity) }}</Badge><Badge :variant="statusVariant(incident.status)">{{ formatEnumLabel(incident.status) }}</Badge><Button v-if="canManageIncidents" size="sm" variant="outline" @click="openIncidentEdit(incident)">Edit</Button></div>
                                                </div>
                                            </div>
                                        </div>
                                        <Card>
                                            <CardHeader><CardTitle class="text-base">Rollback control</CardTitle><CardDescription>Execute rollback with mandatory reason and approval reference.</CardDescription></CardHeader>
                                            <CardContent class="flex justify-end"><Button v-if="canExecuteRollback" variant="destructive" size="sm" @click="openRollbackDialog">Execute Rollback</Button></CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="acceptance" class="space-y-3">
                                        <div class="grid gap-3 md:grid-cols-2">
                                            <div class="grid gap-2"><Label>Acceptance status</Label><Select v-model="acceptanceForm.acceptanceStatus"><SelectTrigger :disabled="!canApproveAcceptance"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="status in acceptanceStatuses" :key="status" :value="status">{{ formatEnumLabel(status) }}</SelectItem></SelectContent></Select></div>
                                            <div class="grid gap-2"><Label>Training completed at</Label><Input v-model="acceptanceForm.trainingCompletedAt" type="datetime-local" :disabled="!canApproveAcceptance" /></div>
                                            <div class="grid gap-2 md:col-span-2"><Label>Case reference</Label><Input v-model="acceptanceForm.acceptanceCaseReference" :disabled="!canApproveAcceptance" /></div>
                                        </div>
                                        <div class="flex justify-end"><Button v-if="canApproveAcceptance" :disabled="acceptanceSaveLoading" @click="saveAcceptance">{{ acceptanceSaveLoading ? 'Saving...' : 'Save Acceptance' }}</Button></div>
                                    </TabsContent>

                                    <TabsContent value="audit" class="space-y-3">
                                        <div class="grid gap-2 md:grid-cols-4">
                                            <Input v-model="auditFilters.q" placeholder="Search" class="md:col-span-2" />
                                            <Input v-model="auditFilters.action" placeholder="Action" />
                                            <Select v-model="auditFilters.actorType">
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent><SelectItem value="">All actors</SelectItem><SelectItem value="user">User</SelectItem><SelectItem value="system">System</SelectItem></SelectContent></Select>
                                            <Input v-model="auditFilters.actorId" placeholder="Actor ID" />
                                            <Input v-model="auditFilters.from" type="datetime-local" />
                                            <Input v-model="auditFilters.to" type="datetime-local" />
                                            <Select :model-value="String(auditFilters.perPage)" @update:model-value="auditFilters.perPage = Number($event)">
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select>
                                            <Button :disabled="auditLoading" @click="loadAuditLogs(1)">{{ auditLoading ? 'Loading...' : 'Apply' }}</Button>
                                        </div>
                                        <div class="flex justify-end"><Button variant="outline" size="sm" :disabled="auditExporting" @click="exportAuditLogs">{{ auditExporting ? 'Preparing...' : 'Export CSV' }}</Button></div>
                                        <Alert v-if="auditError" variant="destructive"><AlertTitle>Audit load issue</AlertTitle><AlertDescription>{{ auditError }}</AlertDescription></Alert>
                                        <div v-else-if="auditLoading" class="space-y-2"><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /></div>
                                        <div v-else-if="auditLogs.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No audit logs found.</div>
                                        <div v-else class="space-y-2"><div v-for="log in auditLogs" :key="log.id" class="rounded border p-2 text-sm"><p class="font-medium">{{ log.actionLabel || log.action || 'event' }}</p><p class="text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }}</p></div></div>
                                        <div class="flex items-center justify-between border-t pt-2">
                                            <Button variant="outline" size="sm" :disabled="auditLoading || !auditMeta || auditMeta.currentPage <= 1" @click="loadAuditLogs((auditMeta?.currentPage ?? 1) - 1)">Previous</Button>
                                            <p class="text-xs text-muted-foreground">Page {{ auditMeta?.currentPage ?? 1 }} of {{ auditMeta?.lastPage ?? 1 }}</p>
                                            <Button variant="outline" size="sm" :disabled="auditLoading || !auditMeta || auditMeta.currentPage >= auditMeta.lastPage" @click="loadAuditLogs((auditMeta?.currentPage ?? 1) + 1)">Next</Button>
                                        </div>
                                    </TabsContent>
                                </div>
                            </ScrollArea>
                        </Tabs>
                    </div>

                    <SheetFooter class="border-t px-4 py-3">
                        <Button variant="outline" @click="closeDetails">Close</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Dialog :open="incidentDialogOpen" @update:open="(open) => (open ? (incidentDialogOpen = true) : closeIncidentDialog())">
                <DialogContent size="2xl">
                    <DialogHeader>
                        <DialogTitle>{{ incidentDialogMode === 'create' ? 'Create Incident' : 'Update Incident' }}</DialogTitle>
                        <DialogDescription>{{ incidentDialogMode === 'create' ? 'Record a rollout incident.' : 'Update incident lifecycle details.' }}</DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-3 md:grid-cols-2">
                        <div v-if="incidentDialogMode === 'create'" class="grid gap-2"><Label>Incident code</Label><Input v-model="incidentForm.incidentCode" /></div>
                        <div class="grid gap-2"><Label>Severity</Label><Select v-model="incidentForm.severity"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="severity in incidentSeverities" :key="severity" :value="severity">{{ formatEnumLabel(severity) }}</SelectItem></SelectContent></Select></div>
                        <div class="grid gap-2"><Label>Status</Label><Select v-model="incidentForm.status"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="status in incidentStatuses" :key="status" :value="status">{{ formatEnumLabel(status) }}</SelectItem></SelectContent></Select></div>
                        <div v-if="incidentDialogMode === 'create'" class="grid gap-2"><Label>Opened at</Label><Input v-model="incidentForm.openedAt" type="datetime-local" /></div>
                        <div v-else class="grid gap-2"><Label>Resolved at</Label><Input v-model="incidentForm.resolvedAt" type="datetime-local" /></div>
                        <div class="grid gap-2 md:col-span-2"><Label>Summary</Label><Input v-model="incidentForm.summary" /></div>
                        <div class="grid gap-2 md:col-span-2"><Label>Details</Label><Textarea v-model="incidentForm.details" class="min-h-24" /></div>
                        <div class="grid gap-2 md:col-span-2"><Label>Escalated to</Label><Input v-model="incidentForm.escalatedTo" /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" :disabled="incidentSaveLoading" @click="closeIncidentDialog">Cancel</Button>
                        <Button :disabled="incidentSaveLoading" @click="saveIncident">{{ incidentSaveLoading ? 'Saving...' : 'Save Incident' }}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog :open="rollbackDialogOpen" @update:open="(open) => (open ? (rollbackDialogOpen = true) : closeRollbackDialog())">
                <DialogContent variant="action" size="lg">
                    <DialogHeader>
                        <DialogTitle>Execute Rollback</DialogTitle>
                        <DialogDescription>This action changes rollout status to rolled back.</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <Alert v-if="rollbackError" variant="destructive"><AlertTitle>Rollback failed</AlertTitle><AlertDescription>{{ rollbackError }}</AlertDescription></Alert>
                        <div class="grid gap-2"><Label>Reason</Label><Textarea v-model="rollbackForm.reason" class="min-h-24" /></div>
                        <div class="grid gap-2"><Label>Approval case reference</Label><Input v-model="rollbackForm.approvalCaseReference" /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" :disabled="rollbackLoading" @click="closeRollbackDialog">Cancel</Button>
                        <Button variant="destructive" :disabled="rollbackLoading" @click="executeRollback">{{ rollbackLoading ? 'Executing...' : 'Confirm Rollback' }}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>
