
<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
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
type PlatformUser = { id: number | null; name: string | null; email: string | null; status: string | null; roles?: Array<{ code: string | null; name: string | null }> };
type PlatformUserListResponse = { data: PlatformUser[] };
type PlatformUserResponse = { data: PlatformUser };
type RolloutListResponse = { data: RolloutPlan[]; meta: Pagination };
type RolloutResponse = { data: RolloutPlan };
type RolloutAuditListResponse = { data: RolloutAuditLog[]; meta: Pagination };

type CheckpointDraft = { key: string; checkpointCode: string; checkpointName: string; status: CheckpointStatus; decisionNotes: string };
type FilterChip = { key: string; label: string };
type OwnerLookupState = { query: string; candidates: PlatformUser[]; loading: boolean; error: string | null; requestId: number; timer: number | null };

const ALL_STATUSES_VALUE = '__all_statuses__';
const ALL_FACILITIES_VALUE = '__all_facilities__';
const ALL_ACTORS_VALUE = '__all_actors__';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Platform Admin', href: '/platform/admin/facility-rollouts' },
    { title: 'Facility Rollouts', href: '/platform/admin/facility-rollouts' },
];

const rolloutStatuses: RolloutStatus[] = ['draft', 'ready', 'active', 'completed', 'rolled_back'];
const createRolloutStatuses: RolloutStatus[] = ['draft', 'ready'];
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
const canReadUsers = computed(() => permissionState('platform.users.read') === 'allowed');

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
const filtersSheetOpen = ref(false);

const createLoading = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const createForm = reactive({ facilityId: '', rolloutCode: '', status: 'draft' as RolloutStatus, targetGoLiveAt: '', ownerUserId: '' });
const createSheetOpen = ref(false);
const selectedCreateOwnerUser = ref<PlatformUser | null>(null);
const createOwnerLookup = reactive<OwnerLookupState>({ query: '', candidates: [], loading: false, error: null, requestId: 0, timer: null });

const detailsOpen = ref(false);
const detailsLoading = ref(false);
const detailsError = ref<string | null>(null);
const detailsTab = ref('overview');
const selectedPlan = ref<RolloutPlan | null>(null);

const planSaveLoading = ref(false);
const planErrors = ref<Record<string, string[]>>({});
const planForm = reactive({ rolloutCode: '', status: 'draft' as RolloutStatus, targetGoLiveAt: '', actualGoLiveAt: '', ownerUserId: '', metadataText: '{}' });
const selectedOwnerUser = ref<PlatformUser | null>(null);
const ownerLookup = reactive<OwnerLookupState>({ query: '', candidates: [], loading: false, error: null, requestId: 0, timer: null });

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

function datePartFromDateTimeInput(value: string): string {
    const normalized = value.trim();
    if (!normalized) return '';
    const splitIndex = normalized.indexOf('T');

    return splitIndex >= 0 ? normalized.slice(0, splitIndex) : normalized.slice(0, 10);
}

function timePartFromDateTimeInput(value: string): string {
    const normalized = value.trim();
    if (!normalized) return '';
    const splitIndex = normalized.indexOf('T');
    if (splitIndex < 0) return '';

    return normalized.slice(splitIndex + 1, splitIndex + 6);
}

function mergeDateAndTimeInput(datePart: string, timePart: string, fallbackTime: string): string {
    const normalizedDate = datePart.trim();
    if (!normalizedDate) return '';

    const normalizedTime = timePart.trim() || fallbackTime;

    return `${normalizedDate}T${normalizedTime}`;
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

function userRoleLabel(user: PlatformUser | null): string {
    const roles = user?.roles ?? [];
    const labels = roles
        .map((role) => String(role.name ?? role.code ?? '').trim())
        .filter(Boolean);

    return labels.length > 0 ? labels.join(', ') : 'No role assigned';
}

function ownerDisplayName(): string {
    if (selectedOwnerUser.value) return selectedOwnerUser.value.name || selectedOwnerUser.value.email || 'Unnamed owner';
    if (planForm.ownerUserId.trim()) return `User #${planForm.ownerUserId.trim()}`;

    return 'No rollout owner selected';
}

function ownerDisplayMeta(): string {
    if (selectedOwnerUser.value) {
        return `${selectedOwnerUser.value.email || 'No email'} | ${userRoleLabel(selectedOwnerUser.value)}`;
    }

    if (planForm.ownerUserId.trim()) {
        return canReadUsers.value ? 'Profile is loading or unavailable.' : 'User profile hidden by permission.';
    }

    return 'Assign an accountable platform or facility lead before go-live.';
}

function createOwnerDisplayName(): string {
    if (selectedCreateOwnerUser.value) return selectedCreateOwnerUser.value.name || selectedCreateOwnerUser.value.email || 'Unnamed owner';
    if (createForm.ownerUserId.trim()) return `User #${createForm.ownerUserId.trim()}`;

    return 'No rollout owner selected';
}

function createOwnerDisplayMeta(): string {
    if (selectedCreateOwnerUser.value) {
        return `${selectedCreateOwnerUser.value.email || 'No email'} | ${userRoleLabel(selectedCreateOwnerUser.value)}`;
    }

    if (createForm.ownerUserId.trim()) {
        return canReadUsers.value ? 'Profile is loading or unavailable.' : 'User profile hidden by permission.';
    }

    return 'Required before a rollout can move to ready.';
}

function resetOwnerLookup(): void {
    if (ownerLookup.timer !== null) {
        window.clearTimeout(ownerLookup.timer);
        ownerLookup.timer = null;
    }

    ownerLookup.query = '';
    ownerLookup.candidates = [];
    ownerLookup.loading = false;
    ownerLookup.error = null;
    ownerLookup.requestId += 1;
}

function resetCreateOwnerLookup(): void {
    if (createOwnerLookup.timer !== null) {
        window.clearTimeout(createOwnerLookup.timer);
        createOwnerLookup.timer = null;
    }

    createOwnerLookup.query = '';
    createOwnerLookup.candidates = [];
    createOwnerLookup.loading = false;
    createOwnerLookup.error = null;
    createOwnerLookup.requestId += 1;
}

async function loadOwnerSummary(): Promise<void> {
    selectedOwnerUser.value = null;
    const ownerId = planForm.ownerUserId.trim();

    if (!ownerId || !canReadUsers.value) return;

    try {
        const response = await apiRequest<PlatformUserResponse>('GET', `/platform/admin/users/${ownerId}`);
        selectedOwnerUser.value = response.data ?? null;
    } catch {
        selectedOwnerUser.value = null;
    }
}

async function loadCreateOwnerCandidates(): Promise<void> {
    const query = createOwnerLookup.query.trim();

    if (!canReadUsers.value) {
        createOwnerLookup.candidates = [];
        createOwnerLookup.error = 'Owner lookup needs platform.users.read.';
        createOwnerLookup.loading = false;
        return;
    }

    if (query.length < 2) {
        createOwnerLookup.candidates = [];
        createOwnerLookup.error = null;
        createOwnerLookup.loading = false;
        return;
    }

    createOwnerLookup.loading = true;
    createOwnerLookup.error = null;
    const requestId = ++createOwnerLookup.requestId;

    try {
        const response = await apiRequest<PlatformUserListResponse>('GET', '/platform/admin/users', {
            query: {
                q: query,
                status: 'active',
                perPage: 8,
                page: 1,
            },
        });

        if (requestId !== createOwnerLookup.requestId) return;
        createOwnerLookup.candidates = response.data ?? [];
    } catch (error) {
        if (requestId !== createOwnerLookup.requestId) return;
        createOwnerLookup.candidates = [];
        createOwnerLookup.error = messageFromUnknown(error, 'Unable to load owner candidates.');
    } finally {
        if (requestId === createOwnerLookup.requestId) createOwnerLookup.loading = false;
    }
}

async function loadOwnerCandidates(): Promise<void> {
    const query = ownerLookup.query.trim();

    if (!canReadUsers.value) {
        ownerLookup.candidates = [];
        ownerLookup.error = 'Owner lookup needs platform.users.read.';
        ownerLookup.loading = false;
        return;
    }

    if (query.length < 2) {
        ownerLookup.candidates = [];
        ownerLookup.error = null;
        ownerLookup.loading = false;
        return;
    }

    ownerLookup.loading = true;
    ownerLookup.error = null;
    const requestId = ++ownerLookup.requestId;

    try {
        const response = await apiRequest<PlatformUserListResponse>('GET', '/platform/admin/users', {
            query: {
                q: query,
                status: 'active',
                perPage: 8,
                page: 1,
            },
        });

        if (requestId !== ownerLookup.requestId) return;
        ownerLookup.candidates = response.data ?? [];
    } catch (error) {
        if (requestId !== ownerLookup.requestId) return;
        ownerLookup.candidates = [];
        ownerLookup.error = messageFromUnknown(error, 'Unable to load owner candidates.');
    } finally {
        if (requestId === ownerLookup.requestId) ownerLookup.loading = false;
    }
}

function scheduleOwnerSearch(): void {
    if (ownerLookup.timer !== null) {
        window.clearTimeout(ownerLookup.timer);
        ownerLookup.timer = null;
    }

    if (ownerLookup.query.trim().length < 2) {
        ownerLookup.candidates = [];
        ownerLookup.error = null;
        ownerLookup.loading = false;
        return;
    }

    ownerLookup.timer = window.setTimeout(() => {
        ownerLookup.timer = null;
        void loadOwnerCandidates();
    }, 250);
}

function scheduleCreateOwnerSearch(): void {
    if (createOwnerLookup.timer !== null) {
        window.clearTimeout(createOwnerLookup.timer);
        createOwnerLookup.timer = null;
    }

    if (createOwnerLookup.query.trim().length < 2) {
        createOwnerLookup.candidates = [];
        createOwnerLookup.error = null;
        createOwnerLookup.loading = false;
        return;
    }

    createOwnerLookup.timer = window.setTimeout(() => {
        createOwnerLookup.timer = null;
        void loadCreateOwnerCandidates();
    }, 250);
}

function selectCreateOwner(user: PlatformUser): void {
    if (!user.id) return;

    selectedCreateOwnerUser.value = user;
    createForm.ownerUserId = String(user.id);
    resetCreateOwnerLookup();
    createErrors.value.ownerUserId = [];
}

function clearCreateOwner(): void {
    selectedCreateOwnerUser.value = null;
    createForm.ownerUserId = '';
    resetCreateOwnerLookup();
}

function selectOwner(user: PlatformUser): void {
    if (!user.id) return;

    selectedOwnerUser.value = user;
    planForm.ownerUserId = String(user.id);
    resetOwnerLookup();
    planErrors.value.ownerUserId = [];
}

function clearOwner(): void {
    selectedOwnerUser.value = null;
    planForm.ownerUserId = '';
    resetOwnerLookup();
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

const operationalCounts = computed(() => {
    const total = plans.value.length;
    const blockedCheckpoints = plans.value.reduce(
        (sum, plan) => sum + plan.checkpoints.filter((checkpoint) => checkpoint.status === 'blocked' || checkpoint.status === 'failed').length,
        0,
    );
    const openIncidents = plans.value.reduce(
        (sum, plan) => sum + plan.incidents.filter((incident) => incident.status !== 'resolved').length,
        0,
    );
    const pendingAcceptance = plans.value.filter((plan) => plan.acceptance?.acceptanceStatus !== 'accepted').length;

    return { total, blockedCheckpoints, openIncidents, pendingAcceptance };
});

const filterStatusSelectValue = computed({
    get: () => filters.status || ALL_STATUSES_VALUE,
    set: (value: string | number | null | undefined) => {
        const normalized = String(value ?? '');
        filters.status = normalized === ALL_STATUSES_VALUE ? '' : normalized;
    },
});

const filterFacilitySelectValue = computed({
    get: () => filters.facilityId || ALL_FACILITIES_VALUE,
    set: (value: string | number | null | undefined) => {
        const normalized = String(value ?? '');
        filters.facilityId = normalized === ALL_FACILITIES_VALUE ? '' : normalized;
    },
});

const auditActorTypeSelectValue = computed({
    get: () => auditFilters.actorType || ALL_ACTORS_VALUE,
    set: (value: string | number | null | undefined) => {
        const normalized = String(value ?? '');
        auditFilters.actorType = normalized === ALL_ACTORS_VALUE ? '' : normalized;
    },
});

const createTargetGoLiveDate = computed({
    get: () => datePartFromDateTimeInput(createForm.targetGoLiveAt),
    set: (value: string) => {
        createForm.targetGoLiveAt = mergeDateAndTimeInput(value, timePartFromDateTimeInput(createForm.targetGoLiveAt), '08:00');
        createErrors.value.targetGoLiveAt = [];
    },
});

const createTargetGoLiveTime = computed({
    get: () => timePartFromDateTimeInput(createForm.targetGoLiveAt),
    set: (value: string) => {
        createForm.targetGoLiveAt = mergeDateAndTimeInput(datePartFromDateTimeInput(createForm.targetGoLiveAt), value, '08:00');
        createErrors.value.targetGoLiveAt = [];
    },
});

const activeFilterChips = computed<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    const search = filters.q.trim();
    if (search) chips.push({ key: 'q', label: `Search: ${search}` });
    if (filters.status) chips.push({ key: 'status', label: `Status: ${formatEnumLabel(filters.status)}` });
    if (filters.facilityId) chips.push({ key: 'facility', label: `Facility: ${facilityLabel(filters.facilityId)}` });
    if (filters.perPage !== 20) chips.push({ key: 'perPage', label: `Rows: ${filters.perPage}` });

    return chips;
});

const activeFilterLabel = computed(() => {
    const count = activeFilterChips.value.length;
    if (count === 0) return 'No filters';
    return count === 1 ? '1 filter' : `${count} filters`;
});

const canPrev = computed(() => (pagination.value?.currentPage ?? 1) > 1);
const canNext = computed(() => Boolean(pagination.value && pagination.value.currentPage < pagination.value.lastPage));

const rolloutStatusPresetLabel = computed(() => {
    if (!filters.status) return 'All statuses';
    return formatEnumLabel(filters.status);
});

function setRolloutStatusFilter(status: RolloutStatus | ''): void {
    filters.status = status;
    filters.page = 1;
    filtersSheetOpen.value = false;
    void loadPlans();
}

function planBlockedCheckpointCount(plan: RolloutPlan): number {
    return plan.checkpoints.filter((checkpoint) => checkpoint.status === 'blocked' || checkpoint.status === 'failed').length;
}

function planPassedCheckpointCount(plan: RolloutPlan): number {
    return plan.checkpoints.filter((checkpoint) => checkpoint.status === 'passed').length;
}

function planOpenIncidentCount(plan: RolloutPlan): number {
    return plan.incidents.filter((incident) => incident.status !== 'resolved').length;
}

function planAcceptanceStatus(plan: RolloutPlan): AcceptanceStatus {
    return (plan.acceptance?.acceptanceStatus ?? 'pending') as AcceptanceStatus;
}

function planRiskLabel(plan: RolloutPlan): string {
    if (plan.rollbackRequired) return 'Rollback flagged';
    if (planOpenIncidentCount(plan) > 0) return `${planOpenIncidentCount(plan)} open incident${planOpenIncidentCount(plan) === 1 ? '' : 's'}`;
    if (planBlockedCheckpointCount(plan) > 0) return `${planBlockedCheckpointCount(plan)} blocked checkpoint${planBlockedCheckpointCount(plan) === 1 ? '' : 's'}`;
    if (planAcceptanceStatus(plan) === 'accepted') return 'Accepted';
    return 'In readiness';
}

function planRiskVariant(plan: RolloutPlan): 'outline' | 'secondary' | 'destructive' {
    if (plan.rollbackRequired || planOpenIncidentCount(plan) > 0 || planBlockedCheckpointCount(plan) > 0) return 'destructive';
    if (planAcceptanceStatus(plan) === 'accepted') return 'secondary';
    return 'outline';
}

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
    filtersSheetOpen.value = false;
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

function suggestedRolloutCode(): string {
    const facility = availableFacilities.value.find((entry) => String(entry.id ?? '') === createForm.facilityId);
    const code = String(facility?.code ?? 'FAC').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    return `ROL-${code || 'FAC'}-${stamp}`;
}

function resetCreateForm(): void {
    createForm.facilityId = availableFacilities.value.length > 0 ? String(availableFacilities.value[0]?.id ?? '') : '';
    createForm.status = 'draft';
    createForm.targetGoLiveAt = '';
    createForm.ownerUserId = '';
    createForm.rolloutCode = suggestedRolloutCode();
    selectedCreateOwnerUser.value = null;
    resetCreateOwnerLookup();
}

function openCreateSheet(): void {
    resetCreateForm();
    createErrors.value = {};
    createSheetOpen.value = true;
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

    if (createForm.status === 'ready' && !createForm.targetGoLiveAt.trim()) {
        createLoading.value = false;
        createErrors.value = { targetGoLiveAt: ['Target go-live is required before a rollout can be marked ready.'] };
        return;
    }

    if (createForm.status === 'ready' && ownerUserId === null) {
        createLoading.value = false;
        createErrors.value = { ownerUserId: ['Rollout owner is required before a rollout can be marked ready.'] };
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
        selectedCreateOwnerUser.value = null;
        resetCreateOwnerLookup();
        createSheetOpen.value = false;
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
        await loadOwnerSummary();
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
    selectedOwnerUser.value = null;
    resetOwnerLookup();
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
    selectedOwnerUser.value = null;
    resetOwnerLookup();
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
        await loadOwnerSummary();
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

onBeforeUnmount(() => {
    resetCreateOwnerLookup();
    resetOwnerLookup();
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
                    <Button v-if="canManageRollouts" size="sm" class="gap-1.5" @click="openCreateSheet">
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

            <div v-if="canRead" class="grid gap-2 md:grid-cols-4">
                <div class="rounded-lg border bg-background px-3 py-2">
                    <p class="text-xs font-medium text-muted-foreground">Plans on page</p>
                    <p class="mt-1 text-xl font-semibold">{{ operationalCounts.total }}</p>
                </div>
                <div class="rounded-lg border bg-background px-3 py-2">
                    <p class="text-xs font-medium text-muted-foreground">Active / ready</p>
                    <p class="mt-1 text-xl font-semibold">{{ queueCounts.active + queueCounts.ready }}</p>
                </div>
                <div class="rounded-lg border bg-background px-3 py-2">
                    <p class="text-xs font-medium text-muted-foreground">Open incidents</p>
                    <p class="mt-1 text-xl font-semibold">{{ operationalCounts.openIncidents }}</p>
                </div>
                <div class="rounded-lg border bg-background px-3 py-2">
                    <p class="text-xs font-medium text-muted-foreground">Pending acceptance</p>
                    <p class="mt-1 text-xl font-semibold">{{ operationalCounts.pendingAcceptance }}</p>
                </div>
            </div>

            <Alert v-if="listErrors.length" variant="destructive">
                <AlertTitle>Request error</AlertTitle>
                <AlertDescription>
                    <p v-for="message in listErrors" :key="message" class="text-xs">{{ message }}</p>
                </AlertDescription>
            </Alert>

            <div v-if="canRead" class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-3">
                <button
                    type="button"
                    class="group flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                    :class="{ 'border-primary bg-primary/5': filters.status === '' }"
                    @click="setRolloutStatusFilter('')"
                >
                    <span class="inline-block h-2 w-2 rounded-full bg-slate-400" />
                    <span class="text-muted-foreground">All</span>
                    <Badge variant="outline" class="ml-1">{{ plans.length }}</Badge>
                </button>
                <button
                    type="button"
                    class="group flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                    :class="{ 'border-primary bg-primary/5': filters.status === 'ready' }"
                    @click="setRolloutStatusFilter('ready')"
                >
                    <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    <span class="text-muted-foreground">Ready</span>
                    <Badge variant="outline" class="ml-1">{{ queueCounts.ready }}</Badge>
                </button>
                <button
                    type="button"
                    class="group flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                    :class="{ 'border-primary bg-primary/5': filters.status === 'active' }"
                    @click="setRolloutStatusFilter('active')"
                >
                    <span class="inline-block h-2 w-2 rounded-full bg-sky-500" />
                    <span class="text-muted-foreground">Active</span>
                    <Badge variant="outline" class="ml-1">{{ queueCounts.active }}</Badge>
                </button>
                <button
                    type="button"
                    class="group flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                    :class="{ 'border-primary bg-primary/5': filters.status === 'rolled_back' }"
                    @click="setRolloutStatusFilter('rolled_back')"
                >
                    <span class="inline-block h-2 w-2 rounded-full bg-rose-500" />
                    <span class="text-muted-foreground">Rolled back</span>
                    <Badge variant="outline" class="ml-1">{{ queueCounts.rolled_back }}</Badge>
                </button>

                <div class="ml-auto flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{{ rolloutStatusPresetLabel }}</Badge>
                    <Button
                        v-if="activeFilterChips.length > 0"
                        variant="ghost"
                        size="sm"
                        class="h-7 gap-1.5 text-xs"
                        :disabled="listLoading"
                        @click="resetFilters"
                    >
                        <AppIcon name="sliders-horizontal" class="size-3" />
                        Reset
                    </Button>
                </div>
            </div>

            <Card v-if="canRead" class="rounded-lg border-sidebar-border/70">
                <CardHeader class="gap-4">
                    <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div class="min-w-0 space-y-2">
                            <div>
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                                    Rollout Queue
                                </CardTitle>
                                <CardDescription>Go-live readiness, incidents, acceptance, and rollback posture.</CardDescription>
                            </div>
                            <div class="flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary">{{ pagination?.total ?? plans.length }} plans</Badge>
                                <Badge variant="outline">Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}</Badge>
                                <Badge v-if="filters.facilityId" variant="outline">{{ facilityLabel(filters.facilityId) }}</Badge>
                                <Badge v-if="filters.perPage !== 20" variant="outline">{{ filters.perPage }} rows</Badge>
                            </div>
                        </div>

                        <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:max-w-2xl">
                            <Input v-model="filters.q" class="h-9 min-w-0 flex-1" placeholder="Search rollout code or rollback reason" @keyup.enter="submitSearch" />
                            <Button size="sm" class="h-9 gap-1.5" :disabled="listLoading" @click="submitSearch">
                                <AppIcon name="search" class="size-3.5" />
                                Search
                            </Button>
                            <Button size="sm" variant="outline" class="h-9 gap-1.5 rounded-lg text-xs" :disabled="listLoading" @click="filtersSheetOpen = true">
                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                Filters
                                <Badge v-if="activeFilterChips.length > 0" variant="secondary" class="ml-1 h-5 px-1.5 text-[10px]">
                                    {{ activeFilterChips.length }}
                                </Badge>
                            </Button>
                        </div>
                    </div>
                    <div v-if="activeFilterChips.length > 0" class="flex flex-wrap gap-1.5">
                        <Badge v-for="chip in activeFilterChips" :key="chip.key" variant="outline">{{ chip.label }}</Badge>
                    </div>
                </CardHeader>
                <CardContent class="space-y-3">
                    <div v-if="pageLoading || listLoading" class="space-y-2">
                        <Skeleton class="h-14 w-full" />
                        <Skeleton class="h-14 w-full" />
                    </div>
                    <div v-else-if="plans.length === 0" class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        No rollout plans found.
                    </div>
                    <div v-else class="space-y-2">
                        <div
                            v-for="plan in plans"
                            :key="String(plan.id ?? plan.rolloutCode ?? Math.random())"
                            class="rounded-lg border bg-background transition-colors hover:bg-muted/30"
                            :class="compactQueueRows ? 'p-2' : 'p-3'"
                        >
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div class="min-w-0 space-y-2">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <p class="min-w-0 truncate text-sm font-semibold">{{ plan.rolloutCode || plan.id || 'Rollout' }}</p>
                                        <Badge :variant="statusVariant(plan.status)">{{ formatEnumLabel(plan.status) }}</Badge>
                                        <Badge :variant="planRiskVariant(plan)">{{ planRiskLabel(plan) }}</Badge>
                                    </div>
                                    <p class="text-xs text-muted-foreground">{{ facilityLabel(plan.facilityId) }} | Target {{ formatDateTime(plan.targetGoLiveAt) }}</p>
                                    <div class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                        <Badge variant="outline">Readiness {{ planPassedCheckpointCount(plan) }}/{{ plan.checkpoints.length }}</Badge>
                                        <span>Blocked {{ planBlockedCheckpointCount(plan) }}</span>
                                        <span class="hidden text-muted-foreground/50 sm:inline">|</span>
                                        <span>Open incidents {{ planOpenIncidentCount(plan) }}</span>
                                        <span class="hidden text-muted-foreground/50 sm:inline">|</span>
                                        <span>Acceptance {{ formatEnumLabel(planAcceptanceStatus(plan)) }}</span>
                                    </div>
                                    <p v-if="plan.rollbackRequired && plan.rollbackReason" class="line-clamp-1 text-xs text-destructive">
                                        Rollback: {{ plan.rollbackReason }}
                                    </p>
                                </div>
                                <div class="flex items-center justify-end gap-2">
                                    <Button size="sm" variant="outline" class="h-8 gap-1.5" @click="openDetails(plan)">
                                        <AppIcon name="eye" class="size-3.5" />
                                        Open
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <footer class="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <p class="text-xs text-muted-foreground">Showing {{ plans.length }} of {{ pagination?.total ?? 0 }}</p>
                        <div class="flex items-center gap-2">
                            <Button variant="outline" size="sm" class="gap-1.5" @click="compactQueueRows = !compactQueueRows">
                                <AppIcon name="layout-list" class="size-3.5" />
                                {{ compactQueueRows ? 'Comfortable' : 'Compact' }}
                            </Button>
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

            <Sheet :open="filtersSheetOpen" @update:open="(open) => (filtersSheetOpen = open)">
                <SheetContent side="right" variant="form" size="md" class="flex h-full min-h-0 flex-col">
                    <SheetHeader class="shrink-0 border-b bg-background px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            Rollout Filters
                        </SheetTitle>
                        <SheetDescription>Refine the queue by operational status and facility.</SheetDescription>
                    </SheetHeader>
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="space-y-4 px-4 py-4">
                            <div class="rounded-lg border p-3">
                                <div class="grid gap-3">
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="rollout-filter-q">Search</Label>
                                        <Input
                                            id="rollout-filter-q"
                                            v-model="filters.q"
                                            placeholder="Rollout code or rollback reason"
                                            :disabled="listLoading"
                                            @keyup.enter="submitSearch"
                                        />
                                    </div>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="rollout-filter-status">Status</Label>
                                        <Select v-model="filterStatusSelectValue">
                                            <SelectTrigger id="rollout-filter-status" class="w-full">
                                                <SelectValue placeholder="All statuses" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem :value="ALL_STATUSES_VALUE">All statuses</SelectItem>
                                                <SelectItem v-for="status in rolloutStatuses" :key="status" :value="status">{{ formatEnumLabel(status) }}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="rollout-filter-facility">Facility</Label>
                                        <Select v-model="filterFacilitySelectValue">
                                            <SelectTrigger id="rollout-filter-facility" class="w-full">
                                                <SelectValue placeholder="All facilities" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem :value="ALL_FACILITIES_VALUE">All facilities</SelectItem>
                                                <SelectItem v-for="facility in availableFacilities" :key="String(facility.id ?? '')" :value="String(facility.id ?? '')">
                                                    {{ (facility.code || 'FAC') + ' - ' + (facility.name || 'Facility') }}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div class="rounded-lg border p-3">
                                <div class="grid gap-3">
                                    <div class="grid gap-2">
                                        <Label for="rollout-filter-per-page">Rows per page</Label>
                                        <Select :model-value="String(filters.perPage)" @update:model-value="filters.perPage = Number($event)">
                                            <SelectTrigger id="rollout-filter-per-page" class="w-full">
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
                            </div>

                            <div v-if="activeFilterChips.length > 0" class="rounded-lg border bg-muted/20 p-3">
                                <p class="text-sm font-medium">Active filters</p>
                                <div class="mt-2 flex flex-wrap gap-1.5">
                                    <Badge v-for="chip in activeFilterChips" :key="chip.key" variant="outline">{{ chip.label }}</Badge>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    <SheetFooter class="shrink-0 gap-2 border-t bg-background px-4 py-3">
                        <Button variant="outline" :disabled="listLoading && activeFilterChips.length === 0" @click="resetFilters">Reset Filters</Button>
                        <Button :disabled="listLoading" class="gap-1.5" @click="submitSearch">
                            <AppIcon name="search" class="size-3.5" />
                            Apply Filters
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Sheet :open="createSheetOpen" @update:open="(open) => (createSheetOpen = open)">
                <SheetContent side="right" variant="form" size="4xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader class="shrink-0 border-b bg-background px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="plus" class="size-5 text-muted-foreground" />
                            Create Rollout Plan
                        </SheetTitle>
                        <SheetDescription>Start a controlled facility rollout wave with target go-live and readiness tracking.</SheetDescription>
                    </SheetHeader>

                    <ScrollArea class="min-h-0 flex-1">
                        <div class="grid gap-4 px-6 py-4">
                            <Alert v-if="!canManageRollouts" variant="destructive">
                                <AlertTitle>Create access restricted</AlertTitle>
                                <AlertDescription>Request <code>platform.multi-facility.manage-rollouts</code> permission.</AlertDescription>
                            </Alert>

                            <template v-else>
                                <div class="flex flex-col gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                                    <div class="min-w-0">
                                        <p class="font-medium">{{ createForm.rolloutCode || 'New rollout wave' }}</p>
                                        <p class="text-muted-foreground">{{ facilityLabel(createForm.facilityId) }} | Target {{ createForm.targetGoLiveAt ? formatDateTime(createForm.targetGoLiveAt) : 'Not scheduled' }}</p>
                                    </div>
                                    <div class="flex flex-wrap gap-1.5">
                                        <Badge variant="outline">{{ formatEnumLabel(createForm.status) }}</Badge>
                                        <Badge variant="outline">{{ createOwnerDisplayName() }}</Badge>
                                        <Badge variant="outline">Readiness plan</Badge>
                                    </div>
                                </div>

                                <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Facility and rollout identity</legend>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="rollout-facility">Facility</Label>
                                        <Select v-model="createForm.facilityId">
                                            <SelectTrigger id="rollout-facility" class="w-full">
                                                <SelectValue placeholder="Select facility" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem v-for="facility in availableFacilities" :key="String(facility.id ?? '')" :value="String(facility.id ?? '')">
                                                    {{ (facility.code || 'FAC') + ' - ' + (facility.name || 'Facility') }}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input v-if="availableFacilities.length === 0" v-model="createForm.facilityId" placeholder="Facility UUID" />
                                        <p v-if="firstError(createErrors, 'facilityId')" class="text-xs text-destructive">{{ firstError(createErrors, 'facilityId') }}</p>
                                    </div>

                                    <div class="grid gap-2">
                                        <Label for="rollout-code">Rollout code</Label>
                                        <Input id="rollout-code" v-model="createForm.rolloutCode" placeholder="ROL-DSK-DISP-20260430" />
                                        <p v-if="firstError(createErrors, 'rolloutCode')" class="text-xs text-destructive">{{ firstError(createErrors, 'rolloutCode') }}</p>
                                    </div>

                                    <div class="grid gap-2">
                                        <Label>Code pattern</Label>
                                        <Button variant="outline" type="button" class="w-full justify-start gap-1.5" @click="createForm.rolloutCode = suggestedRolloutCode()">
                                            <AppIcon name="activity" class="size-3.5" />
                                            Use suggested pattern
                                        </Button>
                                    </div>
                                </fieldset>

                                <fieldset class="grid gap-3 rounded-lg border p-3">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Accountable owner</legend>
                                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div class="min-w-0">
                                            <p class="text-sm font-medium">Rollout owner</p>
                                            <p class="text-xs text-muted-foreground">The person accountable for readiness, escalations, go-live, and follow-up.</p>
                                        </div>
                                        <Button v-if="createForm.ownerUserId" type="button" size="sm" variant="outline" :disabled="createLoading" @click="clearCreateOwner">
                                            Clear owner
                                        </Button>
                                    </div>
                                    <div class="rounded-md border bg-muted/20 p-3">
                                        <p class="truncate text-sm font-medium">{{ createOwnerDisplayName() }}</p>
                                        <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{{ createOwnerDisplayMeta() }}</p>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label>Find active user</Label>
                                        <div class="relative">
                                            <Input
                                                v-model="createOwnerLookup.query"
                                                placeholder="Search by name or email"
                                                class="pr-10"
                                                :disabled="!canReadUsers || createLoading"
                                                @input="scheduleCreateOwnerSearch"
                                            />
                                            <AppIcon v-if="createOwnerLookup.loading" name="refresh-cw" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                                            <AppIcon v-else name="search" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        </div>
                                        <p v-if="firstError(createErrors, 'ownerUserId')" class="text-xs text-destructive">{{ firstError(createErrors, 'ownerUserId') }}</p>
                                        <p v-else-if="createOwnerLookup.error" class="text-xs text-destructive">{{ createOwnerLookup.error }}</p>
                                        <p v-else-if="!canReadUsers" class="text-xs text-muted-foreground">Owner lookup needs platform.users.read.</p>
                                    </div>
                                    <div class="space-y-2">
                                        <div v-if="createOwnerLookup.loading" class="space-y-2">
                                            <Skeleton class="h-11 w-full" />
                                            <Skeleton class="h-11 w-full" />
                                        </div>
                                        <div v-else-if="createOwnerLookup.query.trim().length >= 2 && createOwnerLookup.candidates.length === 0" class="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
                                            No active user matched this search.
                                        </div>
                                        <button
                                            v-for="user in createOwnerLookup.candidates"
                                            :key="`create-rollout-owner-${user.id}`"
                                            type="button"
                                            class="flex w-full items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                                            :disabled="createLoading"
                                            @click="selectCreateOwner(user)"
                                        >
                                            <span class="min-w-0">
                                                <span class="block truncate font-medium">{{ user.name || 'Unnamed user' }}</span>
                                                <span class="block truncate text-xs text-muted-foreground">{{ user.email || 'No email' }} | {{ userRoleLabel(user) }}</span>
                                            </span>
                                            <Badge :variant="statusVariant(user.status)">{{ formatEnumLabel(user.status) }}</Badge>
                                        </button>
                                    </div>
                                </fieldset>

                                <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Go-live control</legend>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="rollout-status">Status</Label>
                                        <Select v-model="createForm.status">
                                            <SelectTrigger id="rollout-status" class="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem v-for="status in createRolloutStatuses" :key="status" :value="status">{{ formatEnumLabel(status) }}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p v-if="firstError(createErrors, 'status')" class="text-xs text-destructive">{{ firstError(createErrors, 'status') }}</p>
                                    </div>
                                    <div class="grid gap-3 sm:col-span-2 md:grid-cols-2">
                                        <SingleDatePopoverField
                                            input-id="rollout-target-date"
                                            label="Target go-live date"
                                            v-model="createTargetGoLiveDate"
                                            helper-text="Choose the planned go-live date."
                                            :error-message="firstError(createErrors, 'targetGoLiveAt')"
                                            :disabled="createLoading"
                                        />
                                        <TimePopoverField
                                            input-id="rollout-target-time"
                                            label="Target time"
                                            v-model="createTargetGoLiveTime"
                                            helper-text="Set the local go-live time."
                                            :disabled="createLoading || !createTargetGoLiveDate"
                                        />
                                    </div>
                                </fieldset>
                            </template>
                        </div>
                    </ScrollArea>

                    <SheetFooter class="shrink-0 gap-2 border-t bg-background px-4 py-3">
                        <Button variant="outline" :disabled="createLoading" @click="createSheetOpen = false">Cancel</Button>
                        <Button v-if="canManageRollouts" class="gap-1.5" :disabled="createLoading" @click="createRollout">
                            <AppIcon name="plus" class="size-3.5" />
                            {{ createLoading ? 'Creating...' : 'Create rollout' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

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
                                <TabsList class="grid w-full grid-cols-4">
                                    <TabsTrigger value="overview">Overview</TabsTrigger>
                                    <TabsTrigger value="readiness">Readiness</TabsTrigger>
                                    <TabsTrigger value="incidents">Incidents</TabsTrigger>
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
                                            <div class="grid gap-3 rounded-lg border bg-muted/20 p-3 md:col-span-2">
                                                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <p class="text-sm font-medium">Rollout owner</p>
                                                        <p class="text-xs text-muted-foreground">Accountable person for readiness, escalation, and go-live follow-up.</p>
                                                    </div>
                                                    <Button v-if="planForm.ownerUserId && canManageRollouts" type="button" size="sm" variant="outline" :disabled="planSaveLoading" @click="clearOwner">
                                                        Clear owner
                                                    </Button>
                                                </div>
                                                <div class="rounded-md border bg-background p-3">
                                                    <p class="truncate text-sm font-medium">{{ ownerDisplayName() }}</p>
                                                    <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{{ ownerDisplayMeta() }}</p>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label>Find active user</Label>
                                                    <div class="relative">
                                                        <Input
                                                            v-model="ownerLookup.query"
                                                            placeholder="Search by name or email"
                                                            class="pr-10"
                                                            :disabled="!canManageRollouts || !canReadUsers || planSaveLoading"
                                                            @input="scheduleOwnerSearch"
                                                        />
                                                        <AppIcon v-if="ownerLookup.loading" name="refresh-cw" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                                                        <AppIcon v-else name="search" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                                    </div>
                                                    <p v-if="firstError(planErrors, 'ownerUserId')" class="text-xs text-destructive">{{ firstError(planErrors, 'ownerUserId') }}</p>
                                                    <p v-else-if="ownerLookup.error" class="text-xs text-destructive">{{ ownerLookup.error }}</p>
                                                    <p v-else-if="!canReadUsers" class="text-xs text-muted-foreground">Owner lookup needs platform.users.read.</p>
                                                </div>
                                                <div class="space-y-2">
                                                    <div v-if="ownerLookup.loading" class="space-y-2">
                                                        <Skeleton class="h-11 w-full" />
                                                        <Skeleton class="h-11 w-full" />
                                                    </div>
                                                    <div v-else-if="ownerLookup.query.trim().length >= 2 && ownerLookup.candidates.length === 0" class="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
                                                        No active user matched this search.
                                                    </div>
                                                    <button
                                                        v-for="user in ownerLookup.candidates"
                                                        :key="`rollout-owner-${user.id}`"
                                                        type="button"
                                                        class="flex w-full items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                                                        :disabled="planSaveLoading"
                                                        @click="selectOwner(user)"
                                                    >
                                                        <span class="min-w-0">
                                                            <span class="block truncate font-medium">{{ user.name || 'Unnamed user' }}</span>
                                                            <span class="block truncate text-xs text-muted-foreground">{{ user.email || 'No email' }} | {{ userRoleLabel(user) }}</span>
                                                        </span>
                                                        <Badge :variant="statusVariant(user.status)">{{ formatEnumLabel(user.status) }}</Badge>
                                                    </button>
                                                </div>
                                            </div>
                                            <div class="grid gap-2 md:col-span-2">
                                                <Label>Advanced metadata (JSON)</Label>
                                                <Textarea v-model="planForm.metadataText" class="min-h-24 font-mono text-xs" :disabled="!canManageRollouts" />
                                                <p v-if="firstError(planErrors, 'metadata')" class="text-xs text-destructive">{{ firstError(planErrors, 'metadata') }}</p>
                                            </div>
                                        </div>
                                        <div class="flex justify-end"><Button v-if="canManageRollouts" :disabled="planSaveLoading" @click="savePlan">{{ planSaveLoading ? 'Saving...' : 'Save Plan' }}</Button></div>
                                    </TabsContent>

                                    <TabsContent value="readiness" class="space-y-4">
                                        <Alert v-if="firstError(checkpointErrors, 'checkpoints')" variant="destructive"><AlertTitle>Checkpoint issue</AlertTitle><AlertDescription>{{ firstError(checkpointErrors, 'checkpoints') }}</AlertDescription></Alert>
                                        <div class="rounded-lg border bg-muted/20 p-3">
                                            <div class="flex items-center justify-between gap-3">
                                                <div>
                                                    <p class="text-sm font-semibold">Readiness checkpoints</p>
                                                    <p class="text-xs text-muted-foreground">Track operational controls before go-live.</p>
                                                </div>
                                                <Badge variant="outline">{{ checkpointProgress(selectedPlan) }} passed</Badge>
                                            </div>
                                        </div>
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
                                        <Separator />
                                        <div class="rounded-lg border p-3">
                                            <div class="mb-3 flex items-start justify-between gap-3">
                                                <div>
                                                    <p class="text-sm font-semibold">Facility acceptance</p>
                                                    <p class="text-xs text-muted-foreground">Confirm training and acceptance evidence after readiness checks.</p>
                                                </div>
                                                <Badge :variant="statusVariant(acceptanceForm.acceptanceStatus)">{{ formatEnumLabel(acceptanceForm.acceptanceStatus) }}</Badge>
                                            </div>
                                            <div class="grid gap-3 md:grid-cols-2">
                                                <div class="grid gap-2"><Label>Acceptance status</Label><Select v-model="acceptanceForm.acceptanceStatus"><SelectTrigger :disabled="!canApproveAcceptance"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="status in acceptanceStatuses" :key="status" :value="status">{{ formatEnumLabel(status) }}</SelectItem></SelectContent></Select></div>
                                                <div class="grid gap-2"><Label>Training completed at</Label><Input v-model="acceptanceForm.trainingCompletedAt" type="datetime-local" :disabled="!canApproveAcceptance" /></div>
                                                <div class="grid gap-2 md:col-span-2"><Label>Case reference</Label><Input v-model="acceptanceForm.acceptanceCaseReference" :disabled="!canApproveAcceptance" /></div>
                                            </div>
                                            <div class="mt-3 flex justify-end"><Button v-if="canApproveAcceptance" :disabled="acceptanceSaveLoading" @click="saveAcceptance">{{ acceptanceSaveLoading ? 'Saving...' : 'Save Acceptance' }}</Button></div>
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

                                    <TabsContent value="audit" class="space-y-3">
                                        <div class="grid gap-2 md:grid-cols-4">
                                            <Input v-model="auditFilters.q" placeholder="Search" class="md:col-span-2" />
                                            <Input v-model="auditFilters.action" placeholder="Action" />
                                            <Select v-model="auditActorTypeSelectValue">
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent><SelectItem :value="ALL_ACTORS_VALUE">All actors</SelectItem><SelectItem value="user">User</SelectItem><SelectItem value="system">System</SelectItem></SelectContent></Select>
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
