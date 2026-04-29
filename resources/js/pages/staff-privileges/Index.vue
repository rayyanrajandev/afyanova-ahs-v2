<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import StaffProfileEditDialog from '@/components/staff/StaffProfileEditDialog.vue';
import StaffProfileStatusDialog from '@/components/staff/StaffProfileStatusDialog.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { csrfRequestHeaders } from '@/lib/csrf';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';
import type { SharedPlatformAccessibleFacility } from '@/types/platform';

type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type StaffQueuePosition = { page: number; position: number };
type FacilityOption = { id: string; label: string; facilityType: string | null };
type StaffProfile = {
    id: string;
    userId: number | null;
    userName: string | null;
    userEmail?: string | null;
    userEmailVerifiedAt?: string | null;
    userEmailVerified?: boolean;
    employeeNumber: string | null;
    jobTitle: string | null;
    department: string | null;
    professionalLicenseNumber: string | null;
    licenseType: string | null;
    phoneExtension: string | null;
    employmentType: string | null;
    status: string | null;
    statusReason?: string | null;
};
type ActorSummary = { id?: number | null; displayName?: string | null; name?: string | null; email?: string | null };
type StaffPrivilegeGrant = {
    id: string;
    facilityId: string | null;
    specialtyId: string | null;
    privilegeCatalogId: string | null;
    privilegeCode: string | null;
    privilegeName: string | null;
    scopeNotes: string | null;
    grantedAt: string | null;
    reviewDueAt: string | null;
    requestedAt: string | null;
    reviewStartedAt: string | null;
    approvedAt: string | null;
    activatedAt: string | null;
    status: string | null;
    statusReason: string | null;
    reviewerUserId: number | null;
    reviewNote: string | null;
    reviewerUser: ActorSummary | null;
    approverUserId: number | null;
    approvalNote: string | null;
    approverUser: ActorSummary | null;
    createdAt: string | null;
    updatedAt: string | null;
};
type Specialty = { id: string | null; code: string | null; name: string | null };
type PrivilegeCatalog = {
    id: string | null;
    specialtyId: string | null;
    code: string | null;
    name: string | null;
    description: string | null;
    cadreCode: string | null;
    facilityType: string | null;
    status: string | null;
};
type AuditLog = {
    id: string;
    action: string | null;
    actionLabel?: string | null;
    actorId: number | null;
    actor?: { displayName?: string | null } | null;
    createdAt: string | null;
};
type ValidationErrorResponse = { message?: string; errors?: Record<string, string[]> };
type PrivilegeStatus = 'requested' | 'under_review' | 'approved' | 'active' | 'suspended' | 'retired';
type StaffPrivilegeWorkspaceView = 'queue' | 'board' | 'grant';
type WorkflowActionMeta = {
    label: string;
    title: string;
    description: string;
    submitLabel: string;
    buttonVariant: 'outline' | 'secondary' | 'destructive';
};
type PrivilegingGuidanceAction = 'credentialing' | 'grant' | 'review' | 'approve' | 'activate' | 'board' | null;
type PrivilegingWorkflowGuidance = {
    title: string;
    description: string;
    variant: 'default' | 'destructive';
    action: PrivilegingGuidanceAction;
    actionLabel?: string | null;
};
type StaffDocumentSummary = {
    id: string;
    title: string | null;
    documentType: string | null;
    expiresAt: string | null;
    verificationStatus: string | null;
    status: string | null;
};
type CoverageBoardStaff = StaffProfile & {
    privileges: StaffPrivilegeGrant[];
    documents: StaffDocumentSummary[];
    credentialingSummary: StaffCredentialingSummary | null;
};
type CoverageBoardResponse = {
    data: CoverageBoardStaff[];
    meta?: {
        totalMatchingStaff?: number;
        includedDocuments?: boolean;
        includedCredentialing?: boolean;
    } | null;
};
type StaffCredentialingSummary = {
    credentialingState: string | null;
    blockingReasons: string[];
    nextExpiryAt: string | null;
    regulatoryProfile?: {
        cadreCode?: string | null;
        professionalTitle?: string | null;
    } | null;
    activeRegistration?: {
        regulatorCode?: string | null;
        registrationCategory?: string | null;
        verificationStatus?: string | null;
        expiresAt?: string | null;
    } | null;
    registrationSummary: {
        total: number;
        verified: number;
        pendingVerification: number;
        expired: number;
    };
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Staff', href: '/staff' },
    { title: 'Staff Privileging', href: '/staff-privileges' },
];

const { permissionState, scope } = usePlatformAccess();
const staffReadPermission = computed(() => permissionState('staff.read'));
const staffUpdatePermission = computed(() => permissionState('staff.update'));
const staffUpdateStatusPermission = computed(() => permissionState('staff.update-status'));
const privilegeReadPermission = computed(() => permissionState('staff.privileges.read'));
const privilegeCreatePermission = computed(() => permissionState('staff.privileges.create'));
const privilegeUpdatePermission = computed(() => permissionState('staff.privileges.update'));
const privilegeReviewPermission = computed(() => permissionState('staff.privileges.review'));
const privilegeApprovePermission = computed(() => permissionState('staff.privileges.approve'));
const privilegeUpdateStatusPermission = computed(() => permissionState('staff.privileges.update-status'));
const privilegeAuditPermission = computed(() => permissionState('staff.privileges.view-audit-logs'));
const specialtyReadPermission = computed(() => permissionState('specialties.read'));
const documentReadPermission = computed(() => permissionState('staff.documents.read'));
const credentialingReadPermission = computed(() => permissionState('staff.credentialing.read'));
const canReadStaff = computed(() => staffReadPermission.value === 'allowed');
const canUpdateStaff = computed(() => staffUpdatePermission.value === 'allowed');
const canUpdateStaffStatus = computed(() => staffUpdateStatusPermission.value === 'allowed');
const canRead = computed(() => privilegeReadPermission.value === 'allowed');
const canCreate = computed(() => privilegeCreatePermission.value === 'allowed');
const canUpdate = computed(() => privilegeUpdatePermission.value === 'allowed');
const canReviewPrivileges = computed(() => privilegeReviewPermission.value === 'allowed');
const canApprovePrivileges = computed(() => privilegeApprovePermission.value === 'allowed');
const canUpdateStatus = computed(() => privilegeUpdateStatusPermission.value === 'allowed');
const canManageWorkflow = computed(() => canReviewPrivileges.value || canApprovePrivileges.value || canUpdateStatus.value);
const canAudit = computed(() => privilegeAuditPermission.value === 'allowed');
const canReadSpecialties = computed(() => specialtyReadPermission.value === 'allowed');
const canReadDocuments = computed(() => documentReadPermission.value === 'allowed');
const canReadCredentialing = computed(() => credentialingReadPermission.value === 'allowed');
const staffReadDenied = computed(() => staffReadPermission.value === 'denied');
const privilegeReadDenied = computed(() => privilegeReadPermission.value === 'denied');
const privilegeAuditDenied = computed(() => privilegeAuditPermission.value === 'denied');
const documentReadDenied = computed(() => documentReadPermission.value === 'denied');
const credentialingReadDenied = computed(() => credentialingReadPermission.value === 'denied');

const staffQueueReady = ref(false);
const staffLoading = ref(true);
const grantLoading = ref(false);
const specialtyLoading = ref(false);
const catalogLoading = ref(false);
const auditLoading = ref(false);
const auditExporting = ref(false);
const boardLoading = ref(false);
const selectedStaffCredentialingLoading = ref(false);
const initialPageLoading = ref(true);

const staffError = ref<string | null>(null);
const grantError = ref<string | null>(null);
const specialtyError = ref<string | null>(null);
const catalogError = ref<string | null>(null);
const auditError = ref<string | null>(null);
const boardError = ref<string | null>(null);
const selectedStaffCredentialingError = ref<string | null>(null);

const staffRows = ref<StaffProfile[]>([]);
const staffMeta = ref<Pagination | null>(null);
const grantRows = ref<StaffPrivilegeGrant[]>([]);
const grantMeta = ref<Pagination | null>(null);
const specialties = ref<Specialty[]>([]);
const privilegeCatalogs = ref<PrivilegeCatalog[]>([]);
const auditRows = ref<AuditLog[]>([]);
const auditMeta = ref<Pagination | null>(null);
const selectedStaffCredentialingSummary = ref<StaffCredentialingSummary | null>(null);

const staffFilters = reactive({ q: '', status: 'active', page: 1, perPage: 12 });
const grantFilters = reactive({ q: '', status: '', facilityId: '', specialtyId: '', page: 1, perPage: 12 });
const auditFilters = reactive({ q: '', action: '', actorType: '', actorId: '', from: '', to: '', page: 1, perPage: 20 });

const selectedStaff = ref<StaffProfile | null>(null);
const selectedGrant = ref<StaffPrivilegeGrant | null>(null);
const workspaceView = ref<StaffPrivilegeWorkspaceView>(
    queryParam('tab') === 'board'
        ? 'board'
        : queryParam('tab') === 'new'
          ? 'grant'
          : 'queue',
);
const boardStaffRows = ref<CoverageBoardStaff[]>([]);
const compactQueueRows = useLocalStorageBoolean('staff.privileges.queueRows.compact', false);
let staffSearchDebounceTimer: number | null = null;
const staffEditDialogOpen = ref(false);
const staffEditDialogProfile = ref<StaffProfile | null>(null);
const staffStatusDialogOpen = ref(false);
const staffStatusDialogProfile = ref<StaffProfile | null>(null);

const editOpen = ref(false);
const statusOpen = ref(false);
const detailsOpen = ref(false);
const detailsTab = ref<'overview' | 'workflows' | 'audit'>('overview');

const createLoading = ref(false);
const editLoading = ref(false);
const statusLoading = ref(false);
const statusError = ref<string | null>(null);
const createErrorMessage = ref<string | null>(null);
const createErrors = ref<Record<string, string[]>>({});
const editErrors = ref<Record<string, string[]>>({});
const workspaceActionMessage = ref<string | null>(null);
let workspaceActionMessageTimer: number | null = null;

const editId = ref<string | null>(null);
const statusId = ref<string | null>(null);
const statusTarget = ref<PrivilegeStatus>('requested');
const statusReason = ref('');

const createForm = reactive({
    facilityId: '',
    privilegeCatalogId: '',
    specialtyId: '',
    privilegeCode: '',
    privilegeName: '',
    scopeNotes: '',
    grantedAt: '',
    reviewDueAt: '',
});
const editForm = reactive({
    facilityId: '',
    specialtyId: '',
    privilegeCode: '',
    privilegeName: '',
    scopeNotes: '',
    grantedAt: '',
    reviewDueAt: '',
});

const selectedStatusGrant = computed(() => grantRows.value.find((row) => row.id === statusId.value) ?? null);
const availableStatusOptions = computed(() => statusOptionsFor(selectedStatusGrant.value?.status ?? null));
const statusActionChoices = computed(() => workflowActionChoicesFor(selectedStatusGrant.value?.status ?? null));
const selectedWorkflowActionMeta = computed(() => workflowActionMetaForStatus(statusTarget.value, selectedStatusGrant.value?.status ?? null));
const statusReasonRequired = computed(() => ['under_review', 'approved', 'suspended', 'retired'].includes(statusTarget.value));
const statusReasonLabel = computed(() => {
    if (statusTarget.value === 'under_review') return 'Review Note';
    if (statusTarget.value === 'approved') return 'Approval Note';
    if (statusTarget.value === 'suspended') return 'Suspension Reason';
    if (statusTarget.value === 'retired') return 'Retirement Note';
    return 'Reason';
});
const statusDialogTitle = computed(() => selectedWorkflowActionMeta.value.title);
const statusDialogDescription = computed(() => {
    const current = formatStatusLabel(selectedStatusGrant.value?.status ?? null) || 'Current';
    if (!selectedStatusGrant.value) {
        return 'Choose the next workflow action for this privilege request.';
    }

    return `Current stage: ${current}. ${selectedWorkflowActionMeta.value.description}`;
});
const statusSubmitLabel = computed(() => {
    if (statusLoading.value) return 'Saving...';
    return selectedWorkflowActionMeta.value.submitLabel;
});

const facilityOptions = computed(() => {
    const rows = (scope.value?.userAccess?.facilities ?? []) as SharedPlatformAccessibleFacility[];
    return rows
        .map((row) => {
            const id = String(row.id ?? '').trim();
            if (!id) return null;
            const code = String(row.code ?? '').trim();
            const name = String(row.name ?? '').trim();
            const facilityType = String(row.facilityType ?? '').trim();
            return { id, label: code && name ? `${code} - ${name}` : name || code || id, facilityType: facilityType || null };
        })
        .filter((row): row is FacilityOption => row !== null);
});
const specialtyOptions = computed(() =>
    specialties.value
        .map((row) => {
            const id = String(row.id ?? '').trim();
            if (!id) return null;
            const code = String(row.code ?? '').trim();
            const name = String(row.name ?? '').trim();
            return { id, label: code && name ? `${code} - ${name}` : name || code || id };
        })
        .filter((row): row is { id: string; label: string } => row !== null),
);
const facilityMap = computed(() => new Map(facilityOptions.value.map((row) => [row.id, row.label])));
const specialtyMap = computed(() => new Map(specialtyOptions.value.map((row) => [row.id, row.label])));
const privilegeCatalogMap = computed(() =>
    new Map(
        privilegeCatalogs.value
            .map((row) => {
                const id = String(row.id ?? '').trim();
                if (!id) return null;

                const code = String(row.code ?? '').trim();
                const name = String(row.name ?? '').trim();

                return [id, code && name ? `${code} - ${name}` : name || code || id] as const;
            })
            .filter((row): row is readonly [string, string] => row !== null),
    ),
);
let selectedStaffCredentialingRequestId = 0;
const selectedStaffHasVerifiedLinkedUser = computed(() => Boolean(selectedStaff.value?.userId) && Boolean(selectedStaff.value?.userEmailVerifiedAt));
const selectedStaffGovernanceBlockerMessage = computed(() => {
    if (!selectedStaff.value) return null;
    if (!selectedStaff.value.userId) {
        return 'Sensitive privileging actions remain blocked until this staff profile is linked to a user account.';
    }
    if (selectedStaff.value.userEmailVerifiedAt) {
        return null;
    }

    const email = String(selectedStaff.value.userEmail ?? '').trim();
    if (email !== '') {
        return `Linked user email ${email} has not completed the invite or reset flow yet. Finish that first before submitting or updating privileging decisions.`;
    }

    return 'Linked user email is still unverified. Finish the invite or reset flow before continuing with privileging actions.';
});
const showWorkspaceBootstrapSkeleton = computed(() => initialPageLoading.value && canReadStaff.value);

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

const requestedStaffId = queryParam('staffId');

function syncWorkspaceToUrl(): void {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (workspaceView.value === 'board') params.set('tab', 'board');
    else if (workspaceView.value === 'grant') params.set('tab', 'new');
    else params.delete('tab');
    if (selectedStaff.value?.id) params.set('staffId', selectedStaff.value.id);
    else params.delete('staffId');

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
        window.history.replaceState(window.history.state, '', nextUrl);
    }
}

async function setWorkspaceView(view: StaffPrivilegeWorkspaceView) {
    workspaceView.value = view;
    syncWorkspaceToUrl();

    if (view === 'board' && boardStaffRows.value.length === 0 && !boardLoading.value) {
        await loadCoverageBoard();
    }
}

function workspaceStaffHref(path: string, staff: StaffProfile | null): string {
    const staffId = String(staff?.id ?? '').trim();
    if (staffId === '') return path;

    return `${path}?staffId=${encodeURIComponent(staffId)}`;
}

function normalizeStaffQueueStatus(status: string | null | undefined): string {
    const normalized = String(status ?? '').trim().toLowerCase();
    return ['active', 'suspended', 'inactive'].includes(normalized) ? normalized : '';
}

async function api<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: { query?: Record<string, string | number | null | undefined>; body?: Record<string, unknown> },
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(options?.query ?? {}).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '') return;
        url.searchParams.set(k, String(v));
    });

    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    let body: string | undefined;
    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        Object.assign(headers, csrfRequestHeaders());
        body = JSON.stringify(options?.body ?? {});
    }

    const response = await fetch(url.toString(), { method, credentials: 'same-origin', headers, body });
    const payload = (await response.json().catch(() => ({}))) as ValidationErrorResponse;
    if (!response.ok) {
        const err = new Error(payload.message ?? `${response.status} ${response.statusText}`) as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        err.status = response.status;
        err.payload = payload;
        throw err;
    }

    return payload as T;
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const s = (status ?? '').toLowerCase();
    if (s === 'active') return 'secondary';
    if (s === 'approved') return 'secondary';
    if (s === 'suspended' || s === 'retired' || s === 'inactive') return 'destructive';
    return 'outline';
}

function workflowStatusOrder(status: string | null): number {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'requested') return 1;
    if (normalized === 'under_review') return 2;
    if (normalized === 'approved') return 3;
    if (normalized === 'active') return 4;
    if (normalized === 'suspended') return 5;
    if (normalized === 'retired') return 6;
    return 0;
}

function statusOptionsFor(status: string | null): PrivilegeStatus[] {
    const normalized = (status ?? '').toLowerCase();
    const baseOptions: PrivilegeStatus[] =
        normalized === 'requested'
            ? ['under_review', 'retired']
            : normalized === 'under_review'
              ? ['requested', 'approved', 'retired']
              : normalized === 'approved'
                ? ['under_review', 'active', 'retired']
                : normalized === 'active'
                  ? ['suspended', 'retired']
                  : normalized === 'suspended'
                    ? ['active', 'retired']
                    : [];

    return baseOptions.filter((option) => canTransitionToStatus(option));
}

function workflowActionMetaForStatus(nextStatus: PrivilegeStatus, currentStatus: string | null): WorkflowActionMeta {
    const current = (currentStatus ?? '').toLowerCase();

    if (nextStatus === 'under_review') {
        return {
            label: 'Start review',
            title: 'Start review',
            description: 'Move this request into review and capture the reviewer note.',
            submitLabel: 'Start Review',
            buttonVariant: 'secondary',
        };
    }

    if (nextStatus === 'approved') {
        return {
            label: 'Record approval',
            title: 'Record approval',
            description: 'Capture the approval decision. The privilege will still need activation before it counts for coverage.',
            submitLabel: 'Record Approval',
            buttonVariant: 'secondary',
        };
    }

    if (nextStatus === 'active') {
        return {
            label: current === 'suspended' ? 'Reactivate privilege' : 'Activate privilege',
            title: current === 'suspended' ? 'Reactivate privilege' : 'Activate privilege',
            description:
                current === 'suspended'
                    ? 'Restore this suspended privilege to active clinical coverage.'
                    : 'Make this approved privilege live for operational coverage.',
            submitLabel: current === 'suspended' ? 'Reactivate Privilege' : 'Activate Privilege',
            buttonVariant: 'secondary',
        };
    }

    if (nextStatus === 'suspended') {
        return {
            label: 'Suspend privilege',
            title: 'Suspend privilege',
            description: 'Temporarily remove this privilege from active clinical coverage.',
            submitLabel: 'Suspend Privilege',
            buttonVariant: 'destructive',
        };
    }

    if (nextStatus === 'retired') {
        return {
            label: 'Retire privilege',
            title: 'Retire privilege',
            description: 'Close this privilege and remove it from future workflow.',
            submitLabel: 'Retire Privilege',
            buttonVariant: 'destructive',
        };
    }

    return {
        label: 'Return to requested',
        title: 'Return to requested',
        description: 'Send this request back to the queue before approval.',
        submitLabel: 'Return to Requested',
        buttonVariant: 'outline',
    };
}

function primaryWorkflowTargetFor(status: string | null): PrivilegeStatus | null {
    return statusOptionsFor(status)[0] ?? null;
}

function workflowActionChoicesFor(status: string | null): Array<{ value: PrivilegeStatus; meta: WorkflowActionMeta }> {
    return statusOptionsFor(status).map((value) => ({ value, meta: workflowActionMetaForStatus(value, status) }));
}

function workflowActionHint(status: string | null): string | null {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'requested') return 'Awaiting review';
    if (normalized === 'under_review') return 'Awaiting approval';
    if (normalized === 'approved') return 'Ready for activation';
    if (normalized === 'active') return 'Live for coverage';
    if (normalized === 'suspended') return 'Currently on hold';
    return null;
}

function credentialingStateVariant(state: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (state ?? '').toLowerCase();
    if (normalized === 'ready') return 'secondary';
    if (normalized === 'blocked') return 'destructive';
    return 'outline';
}

function loadLabel(map: Map<string, string>, key: string | null): string {
    if (!key) return 'N/A';
    return map.get(key) || key;
}

function formatStatusLabel(value: string | null): string {
    return String(value ?? '')
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

function staffDisplayName(profile: StaffProfile | null): string {
    if (!profile) return 'N/A';

    const userName = (profile.userName ?? '').trim();
    if (userName) return userName;

    const employeeNumber = (profile.employeeNumber ?? '').trim();
    if (employeeNumber) return employeeNumber;

    const jobTitle = (profile.jobTitle ?? '').trim();
    return jobTitle || profile.id;
}

function actorDisplayName(actor: ActorSummary | null | undefined, actorId: number | null | undefined): string {
    const displayName = (actor?.displayName ?? actor?.name ?? '').trim();
    if (displayName) return displayName;
    if (typeof actorId === 'number') return `User #${actorId}`;
    return 'Not recorded';
}

function canTransitionToStatus(status: PrivilegeStatus): boolean {
    if (status === 'requested' || status === 'under_review') {
        return canReviewPrivileges.value;
    }
    if (status === 'approved') {
        return canApprovePrivileges.value;
    }

    return canUpdateStatus.value;
}

function canOpenStatus(row: StaffPrivilegeGrant): boolean {
    return statusOptionsFor(row.status).length > 0;
}

function workflowButtonLabel(row: StaffPrivilegeGrant): string {
    const target = primaryWorkflowTargetFor(row.status);
    if (!target) return 'Workflow';

    return workflowActionMetaForStatus(target, row.status).label;
}

function workflowButtonVariant(row: StaffPrivilegeGrant): 'outline' | 'secondary' | 'destructive' {
    const target = primaryWorkflowTargetFor(row.status);
    if (!target) return 'outline';

    return workflowActionMetaForStatus(target, row.status).buttonVariant;
}

function stageNoteForStatus(grant: StaffPrivilegeGrant, status: string | null): string | null {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'under_review') return grant.reviewNote ?? grant.statusReason;
    if (normalized === 'approved') return grant.approvalNote ?? grant.statusReason;
    return grant.statusReason;
}

function reviewTimelineDescription(grant: StaffPrivilegeGrant): string {
    const reviewer = actorDisplayName(grant.reviewerUser, grant.reviewerUserId);
    const facility = loadLabel(facilityMap.value, grant.facilityId);
    const specialty = grant.specialtyId ? ` | ${loadLabel(specialtyMap.value, grant.specialtyId)}` : '';
    const note = grant.reviewNote ? ` Note: ${grant.reviewNote}` : '';

    return `Review started by ${reviewer} for ${facility}${specialty}.${note}`.trim();
}

function approvalTimelineDescription(grant: StaffPrivilegeGrant): string {
    const approver = actorDisplayName(grant.approverUser, grant.approverUserId);
    const note = grant.approvalNote ? ` Note: ${grant.approvalNote}` : '';

    return `Approval recorded by ${approver} before activation.${note}`.trim();
}

function createPayloadFromForm(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        facilityId: createForm.facilityId.trim(),
        scopeNotes: createForm.scopeNotes.trim() || null,
        grantedAt: createForm.grantedAt || null,
        reviewDueAt: createForm.reviewDueAt || null,
    };

    if (privilegeCatalogOptions.value.length > 0 && createForm.privilegeCatalogId.trim()) {
        payload.privilegeCatalogId = createForm.privilegeCatalogId.trim();

        return payload;
    }

    payload.specialtyId = createForm.specialtyId.trim();
    payload.privilegeCode = createForm.privilegeCode.trim();
    payload.privilegeName = createForm.privilegeName.trim();

    return payload;
}

function editPayloadFromForm(): Record<string, unknown> {
    return {
        facilityId: editForm.facilityId.trim(),
        specialtyId: editForm.specialtyId.trim(),
        privilegeCode: editForm.privilegeCode.trim(),
        privilegeName: editForm.privilegeName.trim(),
        scopeNotes: editForm.scopeNotes.trim() || null,
        grantedAt: editForm.grantedAt || null,
        reviewDueAt: editForm.reviewDueAt || null,
    };
}

function formatDateLabel(value: string | null): string {
    if (!value) return 'N/A';
    return String(value).slice(0, 10);
}

function clearWorkspaceActionMessage(): void {
    if (workspaceActionMessageTimer !== null) {
        window.clearTimeout(workspaceActionMessageTimer);
        workspaceActionMessageTimer = null;
    }

    workspaceActionMessage.value = null;
}

function showWorkspaceActionMessage(message: string): void {
    clearWorkspaceActionMessage();
    workspaceActionMessage.value = message;
    workspaceActionMessageTimer = window.setTimeout(() => {
        workspaceActionMessage.value = null;
        workspaceActionMessageTimer = null;
    }, 4000);
}

function daysUntil(value: string | null): number | null {
    if (!value) return null;
    const target = new Date(value);
    if (Number.isNaN(target.getTime())) return null;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    return Math.round((startOfTarget - startOfToday) / 86400000);
}

function toDateValue(value: string | null): string {
    return value ? String(value).slice(0, 10) : '';
}

async function loadSpecialties() {
    if (!canReadSpecialties.value) return;
    specialtyLoading.value = true;
    specialtyError.value = null;
    try {
        const response = await api<{ data: Specialty[] }>('GET', '/specialties', {
            query: { status: 'active', page: 1, perPage: 100, sortBy: 'name', sortDir: 'asc' },
        });
        specialties.value = response.data ?? [];
    } catch (error) {
        specialtyError.value = messageFromUnknown(error, 'Unable to load specialty catalog.');
    } finally {
        specialtyLoading.value = false;
    }
}

async function loadPrivilegeCatalogs() {
    if (!canRead.value) return;
    catalogLoading.value = true;
    catalogError.value = null;
    try {
        const response = await api<{ data: PrivilegeCatalog[] }>('GET', '/privilege-catalogs', {
            query: { status: 'active', page: 1, perPage: 200, sortBy: 'name', sortDir: 'asc' },
        });
        privilegeCatalogs.value = response.data ?? [];
    } catch (error) {
        catalogError.value = messageFromUnknown(error, 'Unable to load privilege template catalog.');
        privilegeCatalogs.value = [];
    } finally {
        catalogLoading.value = false;
    }
}

async function loadStaff(targetId?: string | null) {
    if (!canReadStaff.value) {
        staffLoading.value = false;
        staffQueueReady.value = true;
        return;
    }
    clearStaffSearchDebounce();
    staffLoading.value = true;
    staffError.value = null;
    try {
        const response = await api<{ data: StaffProfile[]; meta: Pagination }>('GET', '/staff', {
            query: {
                q: staffFilters.q.trim() || null,
                status: staffFilters.status || null,
                page: staffFilters.page,
                perPage: staffFilters.perPage,
                sortBy: 'updatedAt',
                sortDir: 'desc',
            },
        });
        staffRows.value = response.data ?? [];
        staffMeta.value = response.meta ?? null;
        selectedStaff.value =
            (targetId ? staffRows.value.find((row) => row.id === targetId) : null)
            ?? (
                selectedStaff.value && staffRows.value.some((row) => row.id === selectedStaff.value?.id)
                    ? staffRows.value.find((row) => row.id === selectedStaff.value?.id) ?? null
                    : null
            )
            ?? staffRows.value[0]
            ?? null;
        syncWorkspaceToUrl();
        await Promise.all([loadGrants(), loadSelectedStaffCredentialing()]);
    } catch (error) {
        staffError.value = messageFromUnknown(error, 'Unable to load staff queue.');
        staffRows.value = [];
        staffMeta.value = null;
        selectedStaff.value = null;
        grantRows.value = [];
        grantMeta.value = null;
        selectedStaffCredentialingSummary.value = null;
    } finally {
        staffLoading.value = false;
        staffQueueReady.value = true;
    }
}

async function fetchStaffProfileById(id: string): Promise<StaffProfile | null> {
    try {
        const response = await api<{ data: StaffProfile }>('GET', `/staff/${id}`);

        return response.data ?? null;
    } catch {
        return null;
    }
}

async function fetchStaffQueuePosition(targetId: string): Promise<StaffQueuePosition | null> {
    try {
        const response = await api<{ data: StaffQueuePosition }>('GET', `/staff/${targetId}/queue-position`, {
            query: {
                q: staffFilters.q.trim() || null,
                status: staffFilters.status || null,
                perPage: staffFilters.perPage,
                sortBy: 'updatedAt',
                sortDir: 'desc',
            },
        });

        return response.data ?? null;
    } catch {
        return null;
    }
}

async function openStaffInQueue(targetId: string, options?: { preserveSearch?: boolean }) {
    const normalizedId = String(targetId).trim();
    if (!normalizedId) {
        await loadStaff();
        return;
    }

    const targetProfile = staffRows.value.find((row) => row.id === normalizedId) ?? (await fetchStaffProfileById(normalizedId));
    if (!targetProfile) {
        await loadStaff();
        return;
    }

    if (!options?.preserveSearch) {
        staffFilters.q = '';
    }

    staffFilters.status = normalizeStaffQueueStatus(targetProfile.status);
    const queuePosition = await fetchStaffQueuePosition(normalizedId);
    staffFilters.page = queuePosition?.page ?? 1;
    await loadStaff(normalizedId);
}

async function loadGrants() {
    if (!canRead.value || !selectedStaff.value?.id) return;
    grantLoading.value = true;
    grantError.value = null;
    try {
        const response = await api<{ data: StaffPrivilegeGrant[]; meta: Pagination }>('GET', `/staff/${selectedStaff.value.id}/privileges`, {
            query: {
                q: grantFilters.q.trim() || null,
                status: grantFilters.status || null,
                facilityId: grantFilters.facilityId || null,
                specialtyId: grantFilters.specialtyId || null,
                page: grantFilters.page,
                perPage: grantFilters.perPage,
                sortBy: 'grantedAt',
                sortDir: 'desc',
            },
        });
        grantRows.value = response.data ?? [];
        grantMeta.value = response.meta ?? null;
        if (selectedGrant.value && !grantRows.value.some((row) => row.id === selectedGrant.value?.id)) {
            selectedGrant.value = null;
            detailsOpen.value = false;
        }
    } catch (error) {
        grantError.value = messageFromUnknown(error, 'Unable to load privilege queue.');
        grantRows.value = [];
        grantMeta.value = null;
    } finally {
        grantLoading.value = false;
    }
}

async function loadAudit() {
    if (!canAudit.value || !selectedStaff.value?.id || !selectedGrant.value?.id) return;
    auditLoading.value = true;
    auditError.value = null;
    try {
        const response = await api<{ data: AuditLog[]; meta: Pagination }>('GET', `/staff/${selectedStaff.value.id}/privileges/${selectedGrant.value.id}/audit-logs`, {
            query: {
                q: auditFilters.q.trim() || null,
                action: auditFilters.action.trim() || null,
                actorType: auditFilters.actorType || null,
                actorId: auditFilters.actorId.trim() || null,
                from: auditFilters.from || null,
                to: auditFilters.to || null,
                page: auditFilters.page,
                perPage: auditFilters.perPage,
            },
        });
        auditRows.value = response.data ?? [];
        auditMeta.value = response.meta ?? null;
    } catch (error) {
        auditError.value = messageFromUnknown(error, 'Unable to load audit timeline.');
    } finally {
        auditLoading.value = false;
    }
}

async function loadCoverageBoard() {
    if (!canReadStaff.value || !canRead.value) {
        boardStaffRows.value = [];
        return;
    }

    boardLoading.value = true;
    boardError.value = null;
    try {
        const response = await api<CoverageBoardResponse>('GET', '/staff/privileges/coverage-board', {
            query: {
                q: staffFilters.q.trim() || null,
                status: staffFilters.status || null,
                maxStaff: 500,
            },
        });

        boardStaffRows.value = response.data ?? [];
    } catch (error) {
        boardError.value = messageFromUnknown(error, 'Unable to load staff coverage board.');
        boardStaffRows.value = [];
    } finally {
        boardLoading.value = false;
    }
}

async function refreshPage() {
    const targetId = selectedStaff.value?.id ?? requestedStaffId ?? null;
    await Promise.all([
        loadSpecialties(),
        loadPrivilegeCatalogs(),
        targetId ? openStaffInQueue(targetId, { preserveSearch: true }) : loadStaff(),
    ]);
    if (workspaceView.value === 'board') {
        await loadCoverageBoard();
    }
}

async function bootstrapWorkspace() {
    initialPageLoading.value = true;
    try {
        await Promise.all([
            loadSpecialties(),
            loadPrivilegeCatalogs(),
            requestedStaffId ? openStaffInQueue(requestedStaffId) : loadStaff(),
            workspaceView.value === 'board' ? loadCoverageBoard() : Promise.resolve(),
        ]);
    } finally {
        initialPageLoading.value = false;
    }
}

function resetStaffQueueFilters() {
    clearStaffSearchDebounce();
    staffFilters.q = '';
    staffFilters.status = 'active';
    staffFilters.perPage = 12;
    staffFilters.page = 1;
    void loadStaff();
}

function resetGrantFilters(): void {
    grantFilters.q = '';
    grantFilters.status = '';
    grantFilters.facilityId = '';
    grantFilters.specialtyId = '';
    grantFilters.page = 1;
    void loadGrants();
}

function clearStaffSearchDebounce(): void {
    if (staffSearchDebounceTimer !== null) {
        window.clearTimeout(staffSearchDebounceTimer);
        staffSearchDebounceTimer = null;
    }
}

function selectStaff(row: StaffProfile) {
    selectedStaff.value = row;
    clearWorkspaceActionMessage();
    syncWorkspaceToUrl();
    grantFilters.page = 1;
    selectedGrant.value = null;
    detailsOpen.value = false;
    void Promise.all([loadGrants(), loadSelectedStaffCredentialing()]);
}

function openStaffEditDialog(profile: StaffProfile) {
    staffEditDialogProfile.value = profile;
    staffEditDialogOpen.value = true;
}

async function handleStaffProfileSaved(updated: StaffProfile) {
    if (selectedStaff.value?.id === updated.id) {
        selectedStaff.value = updated;
    }

    showWorkspaceActionMessage(`Updated ${staffDisplayName(updated)}.`);
    notifySuccess(`Updated ${staffDisplayName(updated)}.`);
    await refreshPage();
}

function openStaffStatusDialog(profile: StaffProfile) {
    staffStatusDialogProfile.value = profile;
    staffStatusDialogOpen.value = true;
}

async function handleStaffStatusSaved(updated: StaffProfile) {
    if (selectedStaff.value?.id === updated.id) {
        selectedStaff.value = updated;
    }

    showWorkspaceActionMessage(`Updated ${staffDisplayName(updated)} to ${formatStatusLabel(updated.status)}.`);
    notifySuccess(`Updated ${staffDisplayName(updated)} to ${formatStatusLabel(updated.status)}.`);
    await refreshPage();
}

function openCreate() {
    createErrorMessage.value = null;
    createErrors.value = {};
    createForm.facilityId = facilityOptions.value[0]?.id ?? '';
    createForm.privilegeCatalogId = '';
    createForm.specialtyId = privilegeCatalogOptions.value.length === 0 ? (specialtyOptions.value[0]?.id ?? '') : '';
    createForm.privilegeCode = '';
    createForm.privilegeName = '';
    createForm.scopeNotes = '';
    createForm.grantedAt = '';
    createForm.reviewDueAt = '';
    void setWorkspaceView('grant');
}

async function saveCreate() {
    if (!selectedStaff.value?.id || !canCreate.value || !selectedStaffHasVerifiedLinkedUser.value || createLoading.value) return;
    if (privilegeCatalogOptions.value.length > 0 && !createForm.privilegeCatalogId.trim()) {
        createErrorMessage.value = 'Choose a privilege template before submitting a privilege request.';
        createErrors.value = { privilegeCatalogId: ['Choose a privilege template before submitting a privilege request.'] };

        return;
    }

    createLoading.value = true;
    clearWorkspaceActionMessage();
    createErrorMessage.value = null;
    createErrors.value = {};
    try {
        await api('POST', `/staff/${selectedStaff.value.id}/privileges`, { body: createPayloadFromForm() });
        showWorkspaceActionMessage('Privilege request submitted.');
        notifySuccess('Privilege request submitted.');
        grantFilters.page = 1;
        await loadGrants();
        await setWorkspaceView('queue');
    } catch (error) {
        const e = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (e.status === 422) {
            createErrorMessage.value = e.payload?.message ?? 'Unable to submit privilege request.';
            createErrors.value = e.payload?.errors ?? {};
        } else notifyError(messageFromUnknown(error, 'Unable to submit privilege request.'));
    } finally {
        createLoading.value = false;
    }
}

function openEdit(row: StaffPrivilegeGrant) {
    if (!selectedStaffHasVerifiedLinkedUser.value) return;
    editErrors.value = {};
    editId.value = row.id;
    editForm.facilityId = row.facilityId ?? '';
    editForm.specialtyId = row.specialtyId ?? '';
    editForm.privilegeCode = row.privilegeCode ?? '';
    editForm.privilegeName = row.privilegeName ?? '';
    editForm.scopeNotes = row.scopeNotes ?? '';
    editForm.grantedAt = toDateValue(row.grantedAt);
    editForm.reviewDueAt = toDateValue(row.reviewDueAt);
    editOpen.value = true;
}

async function saveEdit() {
    if (!selectedStaff.value?.id || !editId.value || !canUpdate.value || !selectedStaffHasVerifiedLinkedUser.value || editLoading.value) return;
    editLoading.value = true;
    clearWorkspaceActionMessage();
    editErrors.value = {};
    try {
        await api('PATCH', `/staff/${selectedStaff.value.id}/privileges/${editId.value}`, { body: editPayloadFromForm() });
        editOpen.value = false;
        showWorkspaceActionMessage('Privilege grant updated.');
        notifySuccess('Privilege grant updated.');
        await loadGrants();
    } catch (error) {
        const e = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (e.status === 422 && e.payload?.errors) editErrors.value = e.payload.errors;
        else notifyError(messageFromUnknown(error, 'Unable to update privilege grant.'));
    } finally {
        editLoading.value = false;
    }
}

function openStatus(row: StaffPrivilegeGrant, preferredTarget?: PrivilegeStatus | null) {
    if (!selectedStaffHasVerifiedLinkedUser.value) return;
    const options = statusOptionsFor(row.status);
    if (options.length === 0) return;

    statusId.value = row.id;
    statusTarget.value = preferredTarget && options.includes(preferredTarget) ? preferredTarget : options[0];
    statusReason.value = '';
    statusError.value = null;
    statusOpen.value = true;
}

function firstGrantForStatus(status: PrivilegeStatus): StaffPrivilegeGrant | null {
    return grantRows.value.find((row) => String(row.status ?? '').trim().toLowerCase() === status) ?? null;
}

function runSelectedStaffWorkflowGuidance(): void {
    switch (selectedStaffWorkflowGuidance.value?.action) {
        case 'credentialing':
            if (selectedStaff.value) {
                window.location.href = workspaceStaffHref('/staff-credentialing', selectedStaff.value);
            }
            break;
        case 'grant':
            openCreate();
            break;
        case 'review': {
            const target = firstGrantForStatus('requested');
            if (target) openStatus(target, 'under_review');
            break;
        }
        case 'approve': {
            const target = firstGrantForStatus('under_review');
            if (target) openStatus(target, 'approved');
            break;
        }
        case 'activate': {
            const target = firstGrantForStatus('approved');
            if (target) openStatus(target, 'active');
            break;
        }
        case 'board':
            void setWorkspaceView('board');
            break;
        default:
            break;
    }
}

async function saveStatus() {
    if (!selectedStaff.value?.id || !statusId.value || !canManageWorkflow.value || !selectedStaffHasVerifiedLinkedUser.value || statusLoading.value) return;
    if (!availableStatusOptions.value.includes(statusTarget.value)) {
        statusError.value = 'You do not have access to perform the selected workflow action.';
        return;
    }
    if (statusReasonRequired.value && !statusReason.value.trim()) {
        statusError.value = `${statusReasonLabel.value} is required for this workflow action.`;
        return;
    }
    statusLoading.value = true;
    clearWorkspaceActionMessage();
    statusError.value = null;
    try {
        await api('PATCH', `/staff/${selectedStaff.value.id}/privileges/${statusId.value}/status`, {
            body: { status: statusTarget.value, reason: statusReason.value.trim() || null },
        });
        statusOpen.value = false;
        const successMessage =
            statusTarget.value === 'under_review'
                ? 'Review started.'
                : statusTarget.value === 'approved'
                  ? 'Approval recorded.'
                  : statusTarget.value === 'active'
                    ? 'Privilege activated.'
                    : statusTarget.value === 'suspended'
                      ? 'Privilege suspended.'
                      : statusTarget.value === 'retired'
                        ? 'Privilege retired.'
                        : 'Privilege returned to requested.';
        showWorkspaceActionMessage(successMessage);
        notifySuccess(successMessage);
        await loadGrants();
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update privilege status.');
    } finally {
        statusLoading.value = false;
    }
}

async function openDetails(row: StaffPrivilegeGrant) {
    selectedGrant.value = row;
    detailsTab.value = 'overview';
    detailsOpen.value = true;
    if (canAudit.value) {
        auditFilters.page = 1;
        await loadAudit();
    }
}

async function loadSelectedStaffCredentialing() {
    selectedStaffCredentialingRequestId += 1;

    if (!canReadCredentialing.value || !selectedStaff.value?.id) {
        selectedStaffCredentialingLoading.value = false;
        selectedStaffCredentialingError.value = null;
        selectedStaffCredentialingSummary.value = null;
        return;
    }

    const requestId = selectedStaffCredentialingRequestId;
    selectedStaffCredentialingLoading.value = true;
    selectedStaffCredentialingError.value = null;

    try {
        const response = await api<{ data: StaffCredentialingSummary }>('GET', `/staff/${selectedStaff.value.id}/credentialing/summary`);
        if (requestId !== selectedStaffCredentialingRequestId) return;
        selectedStaffCredentialingSummary.value = response.data ?? null;
    } catch (error) {
        if (requestId !== selectedStaffCredentialingRequestId) return;
        selectedStaffCredentialingError.value = messageFromUnknown(error, 'Unable to load credentialing summary.');
        selectedStaffCredentialingSummary.value = null;
    } finally {
        if (requestId === selectedStaffCredentialingRequestId) {
            selectedStaffCredentialingLoading.value = false;
        }
    }
}

const workspaceDescription = computed(() => {
    if (workspaceView.value === 'board') return 'Monitor credential expiry, credentialing readiness, shift skill coverage, and active privileging pressure.';
    if (workspaceView.value === 'grant') return 'Submit a privilege request for the selected staff profile and move it into review.';
    return 'Privilege queue, status controls, and audit evidence per staff profile.';
});

const scopeLabel = computed(() => {
    if (!scope.value) return 'Scope Unavailable';
    return scope.value.resolvedFrom === 'none' ? 'Scope Unresolved' : 'Scope Ready';
});

const selectedStaffContextLabel = computed(() => {
    if (!selectedStaff.value) {
        return 'Choose a staff profile from the queue to load privileging data.';
    }

    return [
        selectedStaff.value.employeeNumber || 'No employee number',
        selectedStaff.value.jobTitle || 'No title',
        selectedStaff.value.department || 'No department',
    ].join(' / ');
});

const workspaceViewMeta = computed(() => {
    switch (workspaceView.value) {
        case 'board':
            return {
                label: 'Coverage Board',
                description: 'Coverage risk, credential expiry pressure, and live privilege mix across the current roster.',
            };
        case 'grant':
            return {
                label: 'New Request',
                description: 'Create or submit a governed privilege request for the selected staff member.',
            };
        default:
            return {
                label: 'Privilege Queue',
                description: 'Review privilege grants, workflow state, and governance actions for the selected staff member.',
            };
    }
});

const staffFilterBadgeCount = computed(
    () =>
        Number(Boolean(staffFilters.q.trim()))
        + Number(Boolean(staffFilters.status && staffFilters.status !== 'active'))
        + Number(Boolean(staffFilters.perPage !== 12)),
);
const queueStatusCounts = computed(() => ({
    active: staffRows.value.filter((row) => String(row.status ?? '').toLowerCase() === 'active').length,
    suspended: staffRows.value.filter((row) => String(row.status ?? '').toLowerCase() === 'suspended').length,
    inactive: staffRows.value.filter((row) => String(row.status ?? '').toLowerCase() === 'inactive').length,
}));
const staffQueueTotalCount = computed(() => staffMeta.value?.total ?? staffRows.value.length);
const privilegingQueueSnapshotText = computed(
    () => `${queueStatusCounts.value.active} active | ${queueStatusCounts.value.suspended} suspended | ${queueStatusCounts.value.inactive} inactive`,
);
const privilegingStaffQueueSummaryText = computed(() => {
    const status = staffFilters.status ? formatStatusLabel(staffFilters.status).toLowerCase() : 'all';
    const filterText = staffFilterBadgeCount.value > 0 ? ` | ${staffFilterBadgeCount.value} active filters` : '';
    return `Showing ${staffQueueTotalCount.value} ${status} staff${filterText}`;
});
const hasActiveStaffQueueFilters = computed(() => staffFilterBadgeCount.value > 0);
const queueDensityValue = computed({
    get: () => (compactQueueRows.value ? 'compact' : 'comfortable'),
    set: (value: string) => {
        compactQueueRows.value = value === 'compact';
    },
});

const grantQueueSummaryText = computed(() => {
    const total = grantMeta.value?.total ?? grantRows.value.length;
    const state = grantFilters.status ? formatStatusLabel(grantFilters.status).toLowerCase() : 'all';
    const filterText = grantFilterBadgeCount.value > 0 ? ` | ${grantFilterBadgeCount.value} active filters` : '';
    return `Showing ${total} ${state} privilege requests${filterText}`;
});

const grantFilterBadgeCount = computed(
    () =>
        Number(Boolean(grantFilters.q.trim()))
        + Number(Boolean(grantFilters.status))
        + Number(Boolean(grantFilters.facilityId))
        + Number(Boolean(grantFilters.specialtyId)),
);

const credentialExpiryRows = computed(() => {
    return boardStaffRows.value
        .flatMap((staff) =>
            staff.documents
                .filter((document) => document.status === 'active' && document.expiresAt)
                .map((document) => ({
                    staffId: staff.id,
                    staffLabel: staffDisplayName(staff),
                    department: staff.department || 'Unassigned department',
                    title: document.title || document.documentType || 'Untitled document',
                    expiresAt: document.expiresAt,
                    verificationStatus: document.verificationStatus || 'pending',
                    dayDelta: daysUntil(document.expiresAt),
                })),
        )
        .filter((row) => row.dayDelta !== null)
        .sort((a, b) => (a.dayDelta ?? 0) - (b.dayDelta ?? 0));
});

const credentialExpirySummary = computed(() => {
    const rows = credentialExpiryRows.value;
    const overdue = rows.filter((row) => (row.dayDelta ?? 1) < 0).length;
    const dueSoon = rows.filter((row) => (row.dayDelta ?? 999) >= 0 && (row.dayDelta ?? 999) <= 30).length;
    return {
        overdue,
        dueSoon,
        totalTracked: rows.length,
    };
});

const selectedStaffCredentialingPreview = computed(() => {
    const summary = selectedStaffCredentialingSummary.value;
    if (!summary) return null;

    const state = (summary.credentialingState ?? '').toLowerCase();
    if (state === 'ready') {
        const activeRegistration = summary.activeRegistration;
        const expiry = activeRegistration?.expiresAt ?? summary.nextExpiryAt;
        return expiry
            ? `Credentialing is ready. Current verified practice authority expires ${formatDateLabel(expiry)}.`
            : 'Credentialing is ready with no upcoming expiry recorded.';
    }

    const reason = summary.blockingReasons.find((value) => value?.trim());
    return reason?.trim() || 'Credentialing is not ready for privileging.';
});

const selectedCreateFacilityOption = computed(() => {
    return facilityOptions.value.find((row) => row.id === createForm.facilityId) ?? null;
});

const privilegeCatalogOptions = computed(() =>
    privilegeCatalogs.value
        .filter((row) => {
            const id = String(row.id ?? '').trim();
            if (!id) return false;

            const facilityType = String(row.facilityType ?? '').trim().toLowerCase();
            const selectedFacilityType = String(selectedCreateFacilityOption.value?.facilityType ?? '').trim().toLowerCase();

            return facilityType === '' || selectedFacilityType === '' || facilityType === selectedFacilityType;
        })
        .map((row) => {
            const id = String(row.id ?? '').trim();
            const code = String(row.code ?? '').trim();
            const name = String(row.name ?? '').trim();
            const specialtyLabel = loadLabel(specialtyMap.value, row.specialtyId ?? null);
            const restriction = [row.cadreCode, row.facilityType]
                .map((value) => formatStatusLabel(value))
                .filter((value) => value !== '')
                .join(' | ');

            return {
                id,
                label: code && name ? `${code} - ${name}` : name || code || id,
                specialtyLabel,
                restriction,
            };
        }),
);

const selectedCreateCatalog = computed(() => {
    return privilegeCatalogs.value.find((row) => row.id === createForm.privilegeCatalogId) ?? null;
});

const selectedCreateCatalogEligibilityIssue = computed(() => {
    const catalog = selectedCreateCatalog.value;
    if (!catalog) return null;

    const reasons: string[] = [];
    const requiredFacilityType = String(catalog.facilityType ?? '').trim().toLowerCase();
    const selectedFacilityType = String(selectedCreateFacilityOption.value?.facilityType ?? '').trim().toLowerCase();
    if (requiredFacilityType !== '' && selectedFacilityType !== '' && requiredFacilityType !== selectedFacilityType) {
        reasons.push(
            `Template requires ${formatStatusLabel(requiredFacilityType)} facilities, but the selected facility is ${formatStatusLabel(selectedFacilityType)}.`,
        );
    }

    const requiredCadreCode = String(catalog.cadreCode ?? '').trim().toLowerCase();
    const selectedCadreCode = String(selectedStaffCredentialingSummary.value?.regulatoryProfile?.cadreCode ?? '').trim().toLowerCase();
    if (requiredCadreCode !== '' && canReadCredentialing.value && selectedStaffCredentialingSummary.value) {
        if (selectedCadreCode === '') {
            reasons.push(
                `Template requires staff cadre ${formatStatusLabel(requiredCadreCode)}, but no regulatory cadre is recorded for this staff member.`,
            );
        } else if (requiredCadreCode !== selectedCadreCode) {
            reasons.push(
                `Template requires staff cadre ${formatStatusLabel(requiredCadreCode)}, but this staff member is recorded as ${formatStatusLabel(selectedCadreCode)}.`,
            );
        }
    }

    return reasons[0] ?? null;
});

const canGrantSelectedStaff = computed(() => {
    if (!selectedStaff.value) return false;
    if (!canReadCredentialing.value) return true;
    if (selectedStaffCredentialingLoading.value) return false;
    if (selectedStaffCredentialingError.value) return true;
    return (selectedStaffCredentialingSummary.value?.credentialingState ?? '').toLowerCase() === 'ready';
});

const canSubmitCreateGrant = computed(() => {
    if (!selectedStaffHasVerifiedLinkedUser.value) return false;
    if (!canGrantSelectedStaff.value) return false;
    if (privilegeCatalogOptions.value.length > 0) {
        return createForm.privilegeCatalogId.trim() !== '' && !selectedCreateCatalogEligibilityIssue.value;
    }

    return true;
});

const selectedStaffPrivilegeSummary = computed(() => {
    const total = grantRows.value.length;
    const requested = grantRows.value.filter((grant) => (grant.status ?? '').toLowerCase() === 'requested').length;
    const underReview = grantRows.value.filter((grant) => (grant.status ?? '').toLowerCase() === 'under_review').length;
    const approved = grantRows.value.filter((grant) => (grant.status ?? '').toLowerCase() === 'approved').length;
    const active = grantRows.value.filter((grant) => (grant.status ?? '').toLowerCase() === 'active').length;
    const suspended = grantRows.value.filter((grant) => (grant.status ?? '').toLowerCase() === 'suspended').length;
    const retired = grantRows.value.filter((grant) => (grant.status ?? '').toLowerCase() === 'retired').length;
    const nextReviewDueAt = grantRows.value
        .map((grant) => String(grant.reviewDueAt ?? '').slice(0, 10))
        .filter((value) => value !== '')
        .sort((left, right) => left.localeCompare(right))[0] ?? null;

    return {
        total,
        requested,
        underReview,
        approved,
        active,
        suspended,
        retired,
        nextReviewDueAt,
    };
});

const selectedStaffWorkflowQueueCount = computed(
    () => selectedStaffPrivilegeSummary.value.requested + selectedStaffPrivilegeSummary.value.underReview + selectedStaffPrivilegeSummary.value.approved,
);
const selectedStaffWorkflowGuidance = computed<PrivilegingWorkflowGuidance | null>(() => {
    if (!selectedStaff.value) return null;

    if (!selectedStaffHasVerifiedLinkedUser.value) {
        return {
            title: 'Resolve linked user verification',
            description:
                selectedStaffGovernanceBlockerMessage.value
                || 'Finish the invite or password setup flow before requesting or changing privileging data.',
            variant: 'destructive',
            action: null,
        };
    }

    if (canReadCredentialing.value) {
        if (selectedStaffCredentialingLoading.value) {
            return {
                title: 'Checking credentialing readiness',
                description: 'The workspace is still loading credentialing evidence before privileging decisions are shown.',
                variant: 'default',
                action: null,
            };
        }

        if (selectedStaffCredentialingError.value) {
            return {
                title: 'Credentialing summary unavailable',
                description: selectedStaffCredentialingError.value,
                variant: 'destructive',
                action: null,
            };
        }

        const credentialingState = String(selectedStaffCredentialingSummary.value?.credentialingState ?? '').trim().toLowerCase();
        if (credentialingState === 'not_required') {
            return {
                title: 'Privileging not required',
                description: 'This staff role is currently treated as non-clinical in the credentialing rules, so local clinical privileging is not expected.',
                variant: 'default',
                action: null,
            };
        }

        if (credentialingState !== '' && credentialingState !== 'ready') {
            return {
                title: 'Resolve credentialing before privileging',
                description: selectedStaffCredentialingPreview.value || 'Credentialing must be ready before a privilege can be requested or activated.',
                variant: 'destructive',
                action: canReadCredentialing.value ? 'credentialing' : null,
                actionLabel: canReadCredentialing.value ? 'Open Credentialing' : null,
            };
        }
    }

    if (selectedStaffPrivilegeSummary.value.total === 0) {
        return canCreate.value
            ? {
                title: 'Submit the first privilege request',
                description: 'This staff member is credentialing-ready, but no privilege requests exist yet. Start with a governed template request.',
                variant: 'default',
                action: 'grant',
                actionLabel: 'New Request',
            }
            : {
                title: 'No privilege requests yet',
                description: 'A privileging user with create access must submit the first request for this staff member.',
                variant: 'default',
                action: null,
            };
    }

    if (selectedStaffPrivilegeSummary.value.requested > 0) {
        return canReviewPrivileges.value
            ? {
                title: 'Start review',
                description: `${selectedStaffPrivilegeSummary.value.requested} request${selectedStaffPrivilegeSummary.value.requested === 1 ? '' : 's'} are waiting for reviewer action.`,
                variant: 'default',
                action: 'review',
                actionLabel: 'Start Review',
            }
            : {
                title: 'Awaiting reviewer action',
                description: `${selectedStaffPrivilegeSummary.value.requested} request${selectedStaffPrivilegeSummary.value.requested === 1 ? '' : 's'} are still in the requested state.`,
                variant: 'default',
                action: null,
            };
    }

    if (selectedStaffPrivilegeSummary.value.underReview > 0) {
        return canApprovePrivileges.value
            ? {
                title: 'Record approval',
                description: `${selectedStaffPrivilegeSummary.value.underReview} request${selectedStaffPrivilegeSummary.value.underReview === 1 ? '' : 's'} are ready for approval once governance review is complete.`,
                variant: 'default',
                action: 'approve',
                actionLabel: 'Record Approval',
            }
            : {
                title: 'Awaiting approval',
                description: `${selectedStaffPrivilegeSummary.value.underReview} request${selectedStaffPrivilegeSummary.value.underReview === 1 ? '' : 's'} remain under review and need an approver.`,
                variant: 'default',
                action: null,
            };
    }

    if (selectedStaffPrivilegeSummary.value.approved > 0) {
        return canUpdateStatus.value
            ? {
                title: 'Activate approved privileges',
                description: `${selectedStaffPrivilegeSummary.value.approved} approved request${selectedStaffPrivilegeSummary.value.approved === 1 ? '' : 's'} still need activation before they count for coverage.`,
                variant: 'default',
                action: 'activate',
                actionLabel: 'Activate Privilege',
            }
            : {
                title: 'Awaiting activation',
                description: `${selectedStaffPrivilegeSummary.value.approved} approved request${selectedStaffPrivilegeSummary.value.approved === 1 ? '' : 's'} are waiting for activation.`,
                variant: 'default',
                action: null,
            };
    }

    if (selectedStaffPrivilegeSummary.value.active > 0) {
        return {
            title: 'Coverage is live',
            description: `${selectedStaffPrivilegeSummary.value.active} privilege${selectedStaffPrivilegeSummary.value.active === 1 ? '' : 's'} are active for this staff member. Monitor review due dates and department coverage from the board.`,
            variant: 'default',
            action: 'board',
            actionLabel: 'Open Coverage Board',
        };
    }

    if (selectedStaffPrivilegeSummary.value.suspended > 0) {
        return {
            title: 'Suspended privilege on file',
            description: `${selectedStaffPrivilegeSummary.value.suspended} privilege${selectedStaffPrivilegeSummary.value.suspended === 1 ? '' : 's'} are suspended. Review whether reactivation or retirement is appropriate.`,
            variant: 'default',
            action: null,
        };
    }

    return null;
});

const coverageRows = computed(() => {
    const byDepartment = new Map<string, { staffIds: Set<string>; activePrivilegeCount: number; specialties: Set<string>; excludedActiveStaffCount: number }>();
    for (const staff of boardStaffRows.value) {
        const department = staff.department || 'Unassigned department';
        const entry = byDepartment.get(department) ?? {
            staffIds: new Set<string>(),
            activePrivilegeCount: 0,
            specialties: new Set<string>(),
            excludedActiveStaffCount: 0,
        };

        const activeGrants = staff.privileges.filter((grant) => (grant.status ?? '').toLowerCase() === 'active');
        const isCredentialingReady = (staff.credentialingSummary?.credentialingState ?? '').toLowerCase() === 'ready';
        const countInCoverage = !canReadCredentialing.value || isCredentialingReady;
        if (activeGrants.length > 0 && countInCoverage) {
            entry.staffIds.add(staff.id);
            entry.activePrivilegeCount += activeGrants.length;
            for (const grant of activeGrants) {
                entry.specialties.add(loadLabel(specialtyMap.value, grant.specialtyId));
            }
        } else if (activeGrants.length > 0) {
            entry.excludedActiveStaffCount += 1;
        }

        byDepartment.set(department, entry);
    }

    return Array.from(byDepartment.entries())
        .map(([department, entry]) => ({
            department,
            activeStaffCount: entry.staffIds.size,
            activePrivilegeCount: entry.activePrivilegeCount,
            excludedActiveStaffCount: entry.excludedActiveStaffCount,
            specialties: Array.from(entry.specialties).slice(0, 3),
        }))
        .sort((a, b) => b.activePrivilegeCount - a.activePrivilegeCount);
});

const privilegingTimelineRows = computed(() => {
    return boardStaffRows.value
        .flatMap((staff) =>
            staff.privileges.map((grant) => ({
                id: grant.id,
                staffLabel: staffDisplayName(staff),
                privilegeLabel: grant.privilegeName || grant.privilegeCode || 'Privilege grant',
                status: grant.status || 'unknown',
                at: grant.updatedAt || grant.createdAt || grant.grantedAt,
                detail: stageNoteForStatus(grant, grant.status) || loadLabel(specialtyMap.value, grant.specialtyId),
            })),
        )
        .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
        .slice(0, 8);
});

const selectedGrantTimelineItems = computed(() => {
    if (!selectedGrant.value) return [];

    const currentOrder = workflowStatusOrder(selectedGrant.value.status);

    return [
        {
            id: 'requested',
            title: 'Privilege request submitted',
            at: selectedGrant.value.requestedAt || selectedGrant.value.createdAt,
            complete: Boolean(selectedGrant.value.requestedAt || selectedGrant.value.createdAt),
            description: 'The request is now in the privileging governance queue and awaits review.',
        },
        {
            id: 'review',
            title: 'Under review',
            at: selectedGrant.value.reviewStartedAt,
            complete: currentOrder >= workflowStatusOrder('under_review'),
            description: reviewTimelineDescription(selectedGrant.value),
        },
        {
            id: 'approved',
            title: 'Approval recorded',
            at: selectedGrant.value.approvedAt,
            complete: currentOrder >= workflowStatusOrder('approved'),
            description: approvalTimelineDescription(selectedGrant.value),
        },
        {
            id: 'active',
            title: 'Active for coverage',
            at: selectedGrant.value.activatedAt || selectedGrant.value.grantedAt,
            complete: currentOrder >= workflowStatusOrder('active'),
            description: selectedGrant.value.grantedAt
                ? `Effective privilege date ${formatDateLabel(selectedGrant.value.grantedAt)}.`
                : 'No effective privilege date recorded yet.',
        },
        {
            id: 'review_due',
            title: 'Review checkpoint',
            at: selectedGrant.value.reviewDueAt,
            complete: Boolean(selectedGrant.value.reviewDueAt),
            description: selectedGrant.value.reviewDueAt
                ? `Review due on ${formatDateLabel(selectedGrant.value.reviewDueAt)}.`
                : 'No review due date recorded yet.',
        },
        {
            id: 'status',
            title: `Current status: ${selectedGrant.value.status || 'unknown'}`,
            at: selectedGrant.value.updatedAt || selectedGrant.value.createdAt,
            complete: Boolean(selectedGrant.value.updatedAt || selectedGrant.value.createdAt),
            description: stageNoteForStatus(selectedGrant.value, selectedGrant.value.status) || 'No status note recorded.',
        },
    ];
});

async function exportAudit() {
    if (!selectedStaff.value?.id || !selectedGrant.value?.id || !canAudit.value || auditExporting.value) return;
    auditExporting.value = true;
    try {
        const url = new URL(`/api/v1/staff/${selectedStaff.value.id}/privileges/${selectedGrant.value.id}/audit-logs/export`, window.location.origin);
        Object.entries({
            q: auditFilters.q.trim() || null,
            action: auditFilters.action.trim() || null,
            actorType: auditFilters.actorType || null,
            actorId: auditFilters.actorId.trim() || null,
            from: auditFilters.from || null,
            to: auditFilters.to || null,
        }).forEach(([k, v]) => {
            if (!v) return;
            url.searchParams.set(k, String(v));
        });
        const response = await fetch(url.toString(), { credentials: 'same-origin', headers: { Accept: 'text/csv' } });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const blob = await response.blob();
        const disposition = response.headers.get('content-disposition') ?? '';
        const filename = disposition.match(/filename="?([^"]+)"?/i)?.[1] || `staff_privilege_audit_${selectedGrant.value.id}.csv`;
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
        notifySuccess('Audit CSV export started.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to export audit logs.'));
    } finally {
        auditExporting.value = false;
    }
}

watch(privilegeCatalogOptions, (options) => {
    if (!createForm.privilegeCatalogId) return;

    const selectedStillVisible = options.some((row) => row.id === createForm.privilegeCatalogId);
    if (!selectedStillVisible) {
        createForm.privilegeCatalogId = '';
    }
});

watch(
    () => staffFilters.q,
    () => {
        if (!canReadStaff.value) return;
        clearStaffSearchDebounce();
        staffSearchDebounceTimer = window.setTimeout(() => {
            staffFilters.page = 1;
            staffSearchDebounceTimer = null;
            void loadStaff();
        }, 250);
    },
);

onMounted(async () => {
    await bootstrapWorkspace();
});

onBeforeUnmount(() => {
    clearWorkspaceActionMessage();
});
</script>

<template>
    <Head title="Staff Privileging" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{{ scopeLabel }}</Badge>
                        <Badge v-if="selectedStaff?.status" :variant="statusVariant(selectedStaff.status)">
                            {{ formatStatusLabel(selectedStaff.status) || 'Unknown' }}
                        </Badge>
                        <Badge
                            v-if="canReadCredentialing && selectedStaffCredentialingSummary?.credentialingState"
                            :variant="credentialingStateVariant(selectedStaffCredentialingSummary.credentialingState)"
                            class="capitalize"
                        >
                            {{ formatStatusLabel(selectedStaffCredentialingSummary.credentialingState) || 'Unknown' }}
                        </Badge>
                    </div>
                    <h1 class="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="shield-check" class="size-7 text-primary" />
                        Staff Privileging & Coverage
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">{{ workspaceDescription }}</p>
                </div>
            </div>

            <Alert v-if="scope?.resolvedFrom === 'none'" variant="destructive">
                <AlertTitle>Scope Warning</AlertTitle>
                <AlertDescription>Select a valid tenant or facility scope before making privileging changes.</AlertDescription>
            </Alert>
            <Alert v-if="specialtyError" variant="destructive"><AlertTitle>Specialty Catalog Issue</AlertTitle><AlertDescription>{{ specialtyError }}</AlertDescription></Alert>
            <Alert v-if="catalogError" variant="default"><AlertTitle>Privilege Template Catalog Issue</AlertTitle><AlertDescription>{{ catalogError }} Manual grant entry fallback is still available.</AlertDescription></Alert>

            <div
                v-if="canReadStaff"
                class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-3"
            >
                <Button
                    variant="outline"
                    size="sm"
                    class="gap-2 bg-background"
                    :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': staffFilters.status === 'active' }"
                    @click="staffFilters.status = 'active'; staffFilters.page = 1; loadStaff()"
                >
                    <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    <span class="font-medium">{{ queueStatusCounts.active }}</span>
                    <span class="text-muted-foreground">Active</span>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    class="gap-2 bg-background"
                    :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': staffFilters.status === 'suspended' }"
                    @click="staffFilters.status = 'suspended'; staffFilters.page = 1; loadStaff()"
                >
                    <span class="inline-block h-2 w-2 rounded-full bg-amber-500" />
                    <span class="font-medium">{{ queueStatusCounts.suspended }}</span>
                    <span class="text-muted-foreground">Suspended</span>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    class="gap-2 bg-background"
                    :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': staffFilters.status === 'inactive' }"
                    @click="staffFilters.status = 'inactive'; staffFilters.page = 1; loadStaff()"
                >
                    <span class="inline-block h-2 w-2 rounded-full bg-rose-500" />
                    <span class="font-medium">{{ queueStatusCounts.inactive }}</span>
                    <span class="text-muted-foreground">Inactive</span>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    class="gap-2 bg-background"
                    :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': !staffFilters.status }"
                    @click="staffFilters.status = ''; staffFilters.page = 1; loadStaff()"
                >
                    <span class="inline-block h-2 w-2 rounded-full bg-slate-400" />
                    <span class="font-medium">{{ staffQueueTotalCount }}</span>
                    <span class="text-muted-foreground">All</span>
                </Button>
                <div class="ml-auto flex items-center gap-2">
                    <p class="hidden text-xs text-muted-foreground sm:block">{{ privilegingStaffQueueSummaryText }} | {{ privilegingQueueSnapshotText }}</p>
                    <Badge v-if="queueDensityValue === 'compact'" variant="outline" class="text-[10px] leading-none">Compact rows</Badge>
                    <Button
                        v-if="hasActiveStaffQueueFilters"
                        variant="ghost"
                        size="sm"
                        class="text-xs"
                        @click="resetStaffQueueFilters"
                    >
                        <AppIcon name="sliders-horizontal" class="size-3" />
                        Reset
                    </Button>
                </div>
            </div>

            <div class="grid gap-4 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-stretch">
                <Card class="flex h-full min-h-0 flex-col gap-0 rounded-lg border-sidebar-border/70 py-0 lg:self-stretch">
                    <CardHeader class="shrink-0 border-b bg-muted/10 px-4 py-3">
                        <div class="flex flex-col gap-3">
                            <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                <div class="min-w-0 space-y-1">
                                    <CardTitle class="flex items-center gap-2 text-sm">
                                        <AppIcon name="users" class="size-4 text-muted-foreground" />
                                        Select staff
                                    </CardTitle>
                                    <p class="text-xs text-muted-foreground">
                                        {{ privilegingStaffQueueSummaryText }}
                                    </p>
                                </div>
                                <p class="text-xs text-muted-foreground sm:max-w-[12rem] sm:text-right">
                                    Pick a staff profile to review privilege queue, workflow actions, and coverage readiness.
                                </p>
                            </div>

                            <div v-if="canReadStaff" class="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <div class="relative min-w-0 flex-1">
                                    <AppIcon
                                        name="search"
                                        class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        id="staff-q"
                                        v-model="staffFilters.q"
                                        placeholder="Search staff by name, employee number, title, or department"
                                        class="h-9 pl-9"
                                        @keyup.enter="staffFilters.page = 1; loadStaff()"
                                    />
                                </div>
                                <div class="flex items-center gap-2">
                                    <Popover>
                                        <PopoverTrigger as-child>
                                            <Button variant="outline" size="sm">
                                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                Queue options
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent align="end" class="w-72">
                                            <div class="grid gap-3">
                                                <p class="flex items-center gap-2 text-sm font-medium">
                                                    <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                                    Queue options
                                                </p>
                                                <p class="text-xs text-muted-foreground">
                                                    Adjust the staff selector density and page size for privileging review.
                                                </p>
                                                <div class="grid gap-2">
                                                    <Label for="staff-queue-per-page">Rows per page</Label>
                                                    <Select v-model="staffFilters.perPage">
                                                        <SelectTrigger class="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                        <SelectItem value="12">12</SelectItem>
                                                        <SelectItem value="24">24</SelectItem>
                                                        <SelectItem value="48">48</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label for="staff-queue-density">Row density</Label>
                                                    <Select v-model="queueDensityValue">
                                                        <SelectTrigger class="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                        <SelectItem value="comfortable">Comfortable</SelectItem>
                                                        <SelectItem value="compact">Compact</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="flex items-center justify-between gap-2">
                                                    <Button size="sm" variant="outline" @click="resetStaffQueueFilters">Reset</Button>
                                                    <Button size="sm" :disabled="staffLoading || !canReadStaff" @click="staffFilters.page = 1; loadStaff()">Apply</Button>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    <Button
                                        v-if="staffFilterBadgeCount > 0"
                                        variant="ghost"
                                        size="sm"
                                        class="text-xs"
                                        @click="resetStaffQueueFilters"
                                    >
                                        Reset
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="flex flex-1 flex-col px-3 pb-0 pt-3">
                        <Alert v-if="staffReadDenied" variant="destructive">
                            <AlertTitle>Access restricted</AlertTitle>
                            <AlertDescription>Request <code>staff.read</code> permission.</AlertDescription>
                        </Alert>
                        <template v-else>
                            <Alert v-if="staffError" variant="destructive">
                                <AlertTitle>Queue issue</AlertTitle>
                                <AlertDescription>{{ staffError }}</AlertDescription>
                            </Alert>
                            <div v-else-if="staffLoading || !staffQueueReady" class="space-y-1.5 pb-3">
                                <div
                                    v-for="index in 6"
                                    :key="'privileging-staff-skeleton-' + index"
                                    class="rounded-lg border border-border/70 bg-background/80"
                                    :class="compactQueueRows ? 'p-2' : 'p-2.5'"
                                >
                                    <div class="flex items-center gap-2.5">
                                        <Skeleton class="h-7 w-7 shrink-0 rounded-full" />
                                        <div class="min-w-0 flex-1 space-y-1">
                                            <Skeleton class="h-3.5 w-36 max-w-[75%]" />
                                            <Skeleton class="h-3 w-full max-w-[15rem]" />
                                        </div>
                                        <Skeleton class="h-7 w-7 shrink-0 rounded-md" />
                                    </div>
                                </div>
                            </div>
                            <div v-else-if="staffRows.length === 0" class="flex min-h-[12rem] flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                                <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                    <AppIcon name="users" class="size-6 text-muted-foreground" />
                                </div>
                                <p class="text-sm font-medium">No staff profiles found</p>
                                <p class="mt-1 max-w-sm text-xs text-muted-foreground">
                                    Try adjusting your search or queue options to find a staff profile for privileging review.
                                </p>
                            </div>
                            <div v-else class="space-y-1.5 pb-3">
                                <button
                                    v-for="row in staffRows"
                                    :key="row.id"
                                    type="button"
                                    class="group w-full rounded-lg border text-left transition-colors"
                                    :class="[
                                        selectedStaff?.id === row.id
                                            ? 'border-primary bg-primary/5 shadow-sm'
                                            : 'border-border/70 bg-background hover:bg-muted/30',
                                        compactQueueRows ? 'p-2' : 'p-2.5',
                                    ]"
                                    @click="selectStaff(row)"
                                >
                                    <div class="flex items-center gap-2.5">
                                        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                            {{ (staffDisplayName(row).match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || 'ST' }}
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <div class="flex min-w-0 items-center gap-2">
                                                <p class="truncate text-sm font-medium text-foreground group-hover:text-primary">
                                                    {{ staffDisplayName(row) }}
                                                </p>
                                                <Badge :variant="statusVariant(row.status)" class="shrink-0 text-[10px] leading-none">
                                                    {{ formatStatusLabel(row.status) || 'Unknown' }}
                                                </Badge>
                                                <Badge v-if="selectedStaff?.id === row.id" variant="secondary" class="hidden shrink-0 text-[10px] leading-none sm:inline-flex">
                                                    Selected
                                                </Badge>
                                            </div>
                                            <p class="truncate text-[11px] text-muted-foreground">
                                                {{ row.employeeNumber || 'No employee number' }} / {{ row.jobTitle || 'No title' }} / {{ row.department || 'No department' }}
                                            </p>
                                        </div>
                                        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background/80 text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                                            <AppIcon name="chevron-right" class="size-3.5" />
                                        </span>
                                    </div>
                                </button>
                            </div>
                        </template>

                        <footer v-if="staffMeta" class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-3 py-3">
                            <p class="text-xs text-muted-foreground">
                                Showing {{ staffRows.length }} of {{ staffQueueTotalCount }} results &middot; Page {{ staffMeta.currentPage }} of {{ staffMeta.lastPage }}
                            </p>
                            <div v-if="staffMeta.lastPage > 1" class="flex items-center gap-2">
                                <Button size="sm" variant="outline" :disabled="staffLoading || staffMeta.currentPage <= 1" @click="staffFilters.page -= 1; loadStaff()">Previous</Button>
                                <Button size="sm" variant="outline" :disabled="staffLoading || staffMeta.currentPage >= staffMeta.lastPage" @click="staffFilters.page += 1; loadStaff()">Next</Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>

                <div class="flex min-h-0 flex-col gap-4 lg:h-full">
                    <template v-if="showWorkspaceBootstrapSkeleton">
                        <Card class="overflow-hidden rounded-lg border-sidebar-border/70">
                            <CardHeader class="gap-4 pb-4 pt-4">
                                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="min-w-0 space-y-2">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Skeleton class="h-5 w-24 rounded-full" />
                                            <Skeleton class="h-5 w-16 rounded-full" />
                                            <Skeleton class="h-5 w-24 rounded-full" />
                                        </div>
                                        <Skeleton class="h-7 w-64 max-w-full" />
                                        <Skeleton class="h-4 w-80 max-w-full" />
                                        <Skeleton class="h-4 w-52 max-w-[80%]" />
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Skeleton class="h-8 w-24 rounded-md" />
                                        <Skeleton class="h-8 w-28 rounded-md" />
                                        <Skeleton class="h-8 w-24 rounded-md" />
                                    </div>
                                </div>
                                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div
                                        v-for="index in 4"
                                        :key="`privileging-summary-skeleton-${index}`"
                                        class="space-y-2 rounded-lg border bg-muted/20 p-3"
                                    >
                                        <Skeleton class="h-3 w-24" />
                                        <Skeleton class="h-5 w-20" />
                                    </div>
                                </div>
                                <div class="flex flex-wrap items-center gap-2 border-t pt-3">
                                    <Skeleton class="h-8 w-28 rounded-md" />
                                    <Skeleton class="h-8 w-28 rounded-md" />
                                    <Skeleton class="h-8 w-28 rounded-md" />
                                </div>
                            </CardHeader>
                        </Card>

                        <Card v-if="workspaceView === 'queue'" class="rounded-lg border-sidebar-border/70">
                            <CardHeader class="gap-4 border-b bg-muted/20 pb-4">
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                    <div class="min-w-0 space-y-2">
                                        <Skeleton class="h-5 w-36" />
                                        <Skeleton class="h-4 w-64 max-w-full" />
                                    </div>
                                    <Skeleton class="h-8 w-28 rounded-md" />
                                </div>
                                <Skeleton class="h-4 w-56 max-w-full" />
                                <div class="flex flex-col gap-2 lg:flex-row lg:items-center">
                                    <Skeleton class="h-9 flex-1 rounded-lg" />
                                    <Skeleton class="h-8 w-28 rounded-md" />
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
                                    <Skeleton class="h-8 w-16 rounded-md" />
                                    <Skeleton class="h-8 w-24 rounded-md" />
                                    <Skeleton class="h-8 w-28 rounded-md" />
                                    <Skeleton class="h-8 w-24 rounded-md" />
                                </div>
                            </CardHeader>
                            <CardContent class="space-y-3 p-6">
                                <div
                                    v-for="index in 4"
                                    :key="`privileging-grant-skeleton-${index}`"
                                    class="rounded-lg border p-3"
                                >
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="min-w-0 flex-1 space-y-2">
                                            <Skeleton class="h-4 w-56 max-w-full" />
                                            <Skeleton class="h-3 w-48 max-w-[80%]" />
                                            <Skeleton class="h-3 w-40 max-w-[70%]" />
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <Skeleton class="h-6 w-20 rounded-full" />
                                            <Skeleton class="h-8 w-16 rounded-md" />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div v-else-if="workspaceView === 'board'" class="grid gap-4 xl:grid-cols-12">
                            <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70 xl:col-span-5">
                                <CardHeader class="gap-2 pb-2">
                                    <Skeleton class="h-5 w-52 max-w-full" />
                                    <Skeleton class="h-4 w-72 max-w-full" />
                                </CardHeader>
                                <CardContent class="space-y-3">
                                    <div class="flex flex-wrap gap-2">
                                        <Skeleton class="h-14 w-28 rounded-lg" />
                                        <Skeleton class="h-14 w-28 rounded-lg" />
                                        <Skeleton class="h-14 w-28 rounded-lg" />
                                    </div>
                                    <Skeleton class="h-16 w-full rounded-lg" />
                                    <Skeleton class="h-16 w-full rounded-lg" />
                                </CardContent>
                            </Card>
                            <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70 xl:col-span-4">
                                <CardHeader class="gap-2 pb-2">
                                    <Skeleton class="h-5 w-40 max-w-full" />
                                    <Skeleton class="h-4 w-64 max-w-full" />
                                </CardHeader>
                                <CardContent class="space-y-2">
                                    <Skeleton class="h-16 w-full rounded-lg" />
                                    <Skeleton class="h-16 w-full rounded-lg" />
                                    <Skeleton class="h-16 w-full rounded-lg" />
                                </CardContent>
                            </Card>
                            <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70 xl:col-span-3">
                                <CardHeader class="gap-2 pb-2">
                                    <Skeleton class="h-5 w-48 max-w-full" />
                                    <Skeleton class="h-4 w-56 max-w-full" />
                                </CardHeader>
                                <CardContent class="space-y-2">
                                    <Skeleton class="h-16 w-full rounded-lg" />
                                    <Skeleton class="h-16 w-full rounded-lg" />
                                </CardContent>
                            </Card>
                        </div>

                        <Card v-else class="rounded-lg border-sidebar-border/70">
                            <CardHeader class="gap-2">
                                <Skeleton class="h-5 w-52 max-w-full" />
                                <Skeleton class="h-4 w-64 max-w-full" />
                            </CardHeader>
                            <CardContent class="space-y-4">
                                <Skeleton class="h-16 w-full rounded-lg" />
                                <div class="grid gap-3 md:grid-cols-2">
                                    <Skeleton class="h-20 w-full rounded-lg" />
                                    <Skeleton class="h-20 w-full rounded-lg" />
                                    <Skeleton class="h-20 w-full rounded-lg md:col-span-2" />
                                    <Skeleton class="h-10 w-full rounded-lg" />
                                    <Skeleton class="h-10 w-full rounded-lg" />
                                    <Skeleton class="h-24 w-full rounded-lg md:col-span-2" />
                                </div>
                                <div class="flex justify-end gap-2">
                                    <Skeleton class="h-9 w-24 rounded-md" />
                                    <Skeleton class="h-9 w-32 rounded-md" />
                                </div>
                            </CardContent>
                        </Card>
                    </template>

                    <template v-else>
                    <Card class="overflow-hidden rounded-lg border-sidebar-border/70">
                        <CardHeader class="gap-4 pb-4">
                            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div class="min-w-0 space-y-2">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline">Selected staff</Badge>
                                        <Badge v-if="selectedStaff?.status" :variant="statusVariant(selectedStaff.status)">
                                            {{ formatStatusLabel(selectedStaff.status) || 'Unknown' }}
                                        </Badge>
                                        <Badge
                                            v-if="canReadCredentialing && selectedStaffCredentialingSummary?.credentialingState"
                                            :variant="credentialingStateVariant(selectedStaffCredentialingSummary.credentialingState)"
                                            class="capitalize"
                                        >
                                            {{ formatStatusLabel(selectedStaffCredentialingSummary.credentialingState) || 'Unknown' }}
                                        </Badge>
                                        <Badge v-else-if="canReadCredentialing && selectedStaffCredentialingLoading" variant="outline">Checking credentialing</Badge>
                                        <Badge v-else-if="canReadCredentialing && selectedStaffCredentialingError" variant="outline">Credentialing unavailable</Badge>
                                        <Badge v-if="selectedStaff" :variant="selectedStaffHasVerifiedLinkedUser ? 'secondary' : 'destructive'">
                                            {{ selectedStaffHasVerifiedLinkedUser ? 'Email verified' : 'Email unverified' }}
                                        </Badge>
                                    </div>
                                    <CardTitle class="text-xl">{{ staffDisplayName(selectedStaff) }}</CardTitle>
                                    <CardDescription>{{ selectedStaffContextLabel }}</CardDescription>
                                    <p v-if="selectedStaff" class="text-xs text-muted-foreground">
                                        {{ selectedStaff.userEmail || 'No linked user email recorded' }}
                                    </p>
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
                                    <Button variant="outline" size="sm" as-child>
                                        <Link href="/staff">Open Staff</Link>
                                    </Button>
                                    <Button v-if="canReadCredentialing" variant="outline" size="sm" as-child>
                                        <Link :href="workspaceStaffHref('/staff-credentialing', selectedStaff)">Open Credentialing</Link>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        class="gap-1.5"
                                        :disabled="staffLoading || grantLoading || specialtyLoading || boardLoading"
                                        @click="refreshPage"
                                    >
                                        <AppIcon name="activity" class="size-3.5" />
                                        Refresh
                                    </Button>
                                    <Button v-if="selectedStaff && canUpdateStaff" variant="outline" size="sm" @click="openStaffEditDialog(selectedStaff)">
                                        Edit Staff
                                    </Button>
                                    <Button v-if="selectedStaff && canUpdateStaffStatus" size="sm" @click="openStaffStatusDialog(selectedStaff)">
                                        Change Status
                                    </Button>
                                </div>
                            </div>
                            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div class="rounded-lg border bg-muted/20 p-3">
                                    <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Privileges</p>
                                    <p class="mt-2 text-sm font-medium">{{ selectedStaffPrivilegeSummary.total }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 p-3">
                                    <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Workflow queue</p>
                                    <p class="mt-2 text-sm font-medium">{{ selectedStaffWorkflowQueueCount }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 p-3">
                                    <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Active coverage</p>
                                    <p class="mt-2 text-sm font-medium">{{ selectedStaffPrivilegeSummary.active }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 p-3">
                                    <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Next review</p>
                                    <p class="mt-2 text-sm font-medium">{{ formatDateLabel(selectedStaffPrivilegeSummary.nextReviewDueAt) }}</p>
                                </div>
                            </div>
                            <div class="flex flex-col gap-3 border-t pt-3 lg:flex-row lg:items-center lg:justify-between">
                                <div class="flex flex-wrap items-center gap-2">
                                    <Button size="sm" class="h-8 gap-1.5" :variant="workspaceView === 'queue' ? 'default' : 'outline'" @click="setWorkspaceView('queue')">
                                        <AppIcon name="layout-list" class="size-3.5" />
                                        Privilege Queue
                                    </Button>
                                    <Button size="sm" class="h-8 gap-1.5" :variant="workspaceView === 'board' ? 'default' : 'outline'" @click="setWorkspaceView('board')">
                                        <AppIcon name="layout-dashboard" class="size-3.5" />
                                        Coverage Board
                                    </Button>
                                    <Button
                                        v-if="canCreate"
                                        size="sm"
                                        class="h-8 gap-1.5"
                                        :variant="workspaceView === 'grant' ? 'default' : 'outline'"
                                        :disabled="!selectedStaff || !selectedStaffHasVerifiedLinkedUser"
                                        @click="openCreate"
                                    >
                                        <AppIcon name="plus" class="size-3.5" />
                                        New Request
                                    </Button>
                                </div>
                                <p class="text-xs text-muted-foreground">{{ workspaceViewMeta.description }}</p>
                            </div>
                        </CardHeader>
                    </Card>

            <Alert v-if="workspaceActionMessage">
                <AlertTitle>Recent action</AlertTitle>
                <AlertDescription>{{ workspaceActionMessage }}</AlertDescription>
            </Alert>

            <Alert v-if="selectedStaffWorkflowGuidance" :variant="selectedStaffWorkflowGuidance.variant">
                <AlertTitle>{{ selectedStaffWorkflowGuidance.title }}</AlertTitle>
                <AlertDescription class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <span>{{ selectedStaffWorkflowGuidance.description }}</span>
                    <Button
                        v-if="selectedStaffWorkflowGuidance.actionLabel"
                        size="sm"
                        variant="outline"
                        class="gap-1.5 self-start lg:self-center"
                        @click="runSelectedStaffWorkflowGuidance"
                    >
                        <AppIcon name="chevron-right" class="size-3.5" />
                        {{ selectedStaffWorkflowGuidance.actionLabel }}
                    </Button>
                </AlertDescription>
            </Alert>

            <div v-if="workspaceView === 'queue'">
                <Card class="min-w-0 rounded-lg border-sidebar-border/70">
                    <CardHeader class="gap-4 border-b bg-muted/20 pb-4">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                            <div class="min-w-0 space-y-1">
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="shield-check" class="size-5 text-muted-foreground" />
                                    Privilege Queue
                                </CardTitle>
                                <CardDescription>
                                    {{ selectedStaff ? `${staffDisplayName(selectedStaff)} / ${selectedStaff.employeeNumber || selectedStaff.id}` : 'Select a staff profile to load privileges.' }}
                                </CardDescription>
                            </div>
                        </div>
                        <p class="text-xs text-muted-foreground">{{ grantQueueSummaryText }}</p>
                        <div v-if="selectedStaff" class="flex w-full flex-col gap-2 lg:flex-row lg:items-center">
                            <SearchInput
                                id="grant-q"
                                v-model="grantFilters.q"
                                placeholder="Search privilege code, name, facility, or specialty"
                                class="min-w-0 flex-1"
                                @keyup.enter="grantFilters.page=1; loadGrants()"
                            />
                            <Popover>
                                <PopoverTrigger as-child>
                                    <Button variant="outline" size="sm" class="gap-1.5 rounded-lg">
                                        <AppIcon name="sliders-horizontal" class="size-3.5" />
                                        Filters
                                        <Badge v-if="grantFilterBadgeCount > 0" variant="secondary" class="ml-1">
                                            {{ grantFilterBadgeCount }}
                                        </Badge>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" class="flex max-h-[28rem] w-[20rem] flex-col overflow-hidden rounded-lg border bg-popover p-0 shadow-md">
                                    <div class="space-y-3 overflow-y-auto border-b px-4 py-3">
                                        <p class="flex items-center gap-2 text-sm font-medium">
                                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                            Filters &amp; view
                                        </p>
                                        <div class="grid gap-2">
                                            <Label for="grant-status-popover">Status</Label>
                                            <Select v-model="grantFilters.status">
                                                <SelectTrigger class="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                <SelectItem value="">All statuses</SelectItem>
                                                <SelectItem value="requested">Requested</SelectItem>
                                                <SelectItem value="under_review">Under Review</SelectItem>
                                                <SelectItem value="approved">Approved</SelectItem>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="suspended">Suspended</SelectItem>
                                                <SelectItem value="retired">Retired</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="grant-facility-popover">Facility</Label>
                                            <Select v-model="grantFilters.facilityId">
                                                <SelectTrigger class="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                <SelectItem value="">All facilities</SelectItem>
                                                <SelectItem v-for="row in facilityOptions" :key="`f-pop-${row.id}`" :value="row.id">{{ row.label }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="grant-specialty-popover">Specialty</Label>
                                            <Select v-model="grantFilters.specialtyId">
                                                <SelectTrigger class="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                <SelectItem value="">All specialties</SelectItem>
                                                <SelectItem v-for="row in specialtyOptions" :key="`s-pop-${row.id}`" :value="row.id">{{ row.label }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div class="flex items-center justify-end gap-2 px-4 py-3">
                                        <Button variant="outline" size="sm" :disabled="grantLoading" @click="resetGrantFilters">
                                            Reset
                                        </Button>
                                        <Button size="sm" :disabled="grantLoading" @click="grantFilters.page=1; loadGrants()">Apply</Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div v-if="selectedStaff" class="flex flex-wrap items-center gap-2">
                            <Button size="sm" class="h-8 gap-2 rounded-lg" :variant="!grantFilters.status ? 'default' : 'outline'" @click="grantFilters.status=''; grantFilters.page=1; loadGrants()">
                                All
                            </Button>
                            <Button size="sm" class="h-8 gap-2 rounded-lg" :variant="grantFilters.status === 'requested' ? 'default' : 'outline'" @click="grantFilters.status='requested'; grantFilters.page=1; loadGrants()">
                                Requested
                            </Button>
                            <Button size="sm" class="h-8 gap-2 rounded-lg" :variant="grantFilters.status === 'under_review' ? 'default' : 'outline'" @click="grantFilters.status='under_review'; grantFilters.page=1; loadGrants()">
                                Under review
                            </Button>
                            <Button size="sm" class="h-8 gap-2 rounded-lg" :variant="grantFilters.status === 'approved' ? 'default' : 'outline'" @click="grantFilters.status='approved'; grantFilters.page=1; loadGrants()">
                                Approved
                            </Button>
                            <Button size="sm" class="h-8 gap-2 rounded-lg" :variant="grantFilters.status === 'active' ? 'default' : 'outline'" @click="grantFilters.status='active'; grantFilters.page=1; loadGrants()">
                                Active
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent class="space-y-3">
                        <Alert v-if="privilegeReadDenied" variant="destructive"><AlertTitle>Access restricted</AlertTitle><AlertDescription>Request <code>staff.privileges.read</code> permission.</AlertDescription></Alert>
                        <template v-else-if="!selectedStaff"><div class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Select a staff profile to load privileges.</div></template>
                        <template v-else>
                            <Alert v-if="canReadCredentialing && selectedStaffCredentialingError" variant="destructive">
                                <AlertTitle>Credentialing summary issue</AlertTitle>
                                <AlertDescription>{{ selectedStaffCredentialingError }}</AlertDescription>
                            </Alert>
                            <Alert v-else-if="canReadCredentialing && selectedStaffCredentialingSummary" :variant="(selectedStaffCredentialingSummary.credentialingState ?? '').toLowerCase() === 'blocked' ? 'destructive' : 'default'">
                                <AlertTitle class="flex flex-wrap items-center gap-2">
                                    Credentialing status
                                    <Badge :variant="credentialingStateVariant(selectedStaffCredentialingSummary.credentialingState)" class="capitalize">
                                        {{ formatStatusLabel(selectedStaffCredentialingSummary.credentialingState) || 'Unknown' }}
                                    </Badge>
                                </AlertTitle>
                                <AlertDescription class="space-y-2">
                                    <p>{{ selectedStaffCredentialingPreview }}</p>
                                    <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                        <span>Verified registrations: {{ selectedStaffCredentialingSummary.registrationSummary.verified }}</span>
                                        <span>Pending: {{ selectedStaffCredentialingSummary.registrationSummary.pendingVerification }}</span>
                                        <span>Expired: {{ selectedStaffCredentialingSummary.registrationSummary.expired }}</span>
                                        <span>Next expiry: {{ formatDateLabel(selectedStaffCredentialingSummary.nextExpiryAt) }}</span>
                                    </div>
                                </AlertDescription>
                            </Alert>
                            <Alert v-else-if="canReadCredentialing && selectedStaffCredentialingLoading">
                                <AlertTitle>Credentialing status</AlertTitle>
                                <AlertDescription>Checking the current regulatory and registration state for this staff profile.</AlertDescription>
                            </Alert>
                            <Alert v-if="grantError" variant="destructive"><AlertTitle>Queue issue</AlertTitle><AlertDescription>{{ grantError }}</AlertDescription></Alert>
                            <div v-if="grantLoading" class="space-y-2"><Skeleton class="h-14 w-full" /><Skeleton class="h-14 w-full" /></div>
                            <div v-else-if="grantRows.length === 0" class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No privilege grants found.</div>
                                <ScrollArea v-else class="max-h-[60vh] rounded-lg border p-2">
                                    <div class="space-y-2">
                                        <div v-for="row in grantRows" :key="row.id" class="rounded-lg border p-3">
                                        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div><p class="text-sm font-semibold">{{ row.privilegeCode || 'NO-CODE' }} - {{ row.privilegeName || 'Unnamed' }}</p><p class="text-xs text-muted-foreground">Facility: {{ loadLabel(facilityMap, row.facilityId) }} | Specialty: {{ loadLabel(specialtyMap, row.specialtyId) }}</p><p v-if="row.privilegeCatalogId" class="text-xs text-muted-foreground">Template: {{ loadLabel(privilegeCatalogMap, row.privilegeCatalogId) }}</p><p class="text-xs text-muted-foreground">Granted: {{ formatDateLabel(row.grantedAt) }} | Review: {{ formatDateLabel(row.reviewDueAt) }}</p></div>
                                            <div class="flex flex-wrap items-center gap-1.5">
                                                <Badge :variant="statusVariant(row.status)" class="capitalize">{{ row.status || 'unknown' }}</Badge>
                                                <Badge v-if="workflowActionHint(row.status)" variant="outline">{{ workflowActionHint(row.status) }}</Badge>
                                                <Button size="sm" variant="outline" @click="openDetails(row)">Details</Button>
                                                <Button v-if="canUpdate" size="sm" variant="outline" :disabled="!selectedStaffHasVerifiedLinkedUser" @click="openEdit(row)">Edit</Button>
                                                <Button
                                                    v-if="canOpenStatus(row)"
                                                    size="sm"
                                                    :variant="workflowButtonVariant(row)"
                                                    :disabled="!selectedStaffHasVerifiedLinkedUser"
                                                    @click="openStatus(row, primaryWorkflowTargetFor(row.status))"
                                                >
                                                    {{ workflowButtonLabel(row) }}
                                                </Button>
                                            </div>
                                        </div>
                                        </div>
                                    </div>
                                </ScrollArea>
                                <div v-if="grantMeta" class="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Page {{ grantMeta.currentPage }} of {{ grantMeta.lastPage }}</span>
                                    <div class="flex items-center gap-2">
                                        <Button size="sm" variant="outline" :disabled="grantLoading || grantMeta.currentPage <= 1" @click="grantFilters.page -= 1; loadGrants()">Prev</Button>
                                        <Button size="sm" variant="outline" :disabled="grantLoading || grantMeta.currentPage >= grantMeta.lastPage" @click="grantFilters.page += 1; loadGrants()">Next</Button>
                                    </div>
                                </div>
                            </template>
                        </CardContent>
                    </Card>
            </div>

            <div v-else-if="workspaceView === 'board'" class="grid gap-3 xl:grid-cols-12">
                <Alert v-if="staffReadDenied || privilegeReadDenied" variant="destructive" class="xl:col-span-12">
                    <AlertTitle>Board access restricted</AlertTitle>
                    <AlertDescription>Request <code>staff.read</code> and <code>staff.privileges.read</code> permissions to open the coverage board.</AlertDescription>
                </Alert>
                <template v-else>
                    <Alert v-if="boardError" variant="destructive" class="xl:col-span-12"><AlertTitle>Board issue</AlertTitle><AlertDescription>{{ boardError }}</AlertDescription></Alert>
                    <Alert v-if="credentialingReadDenied" class="xl:col-span-12">
                        <AlertTitle>Coverage is running without credentialing filters</AlertTitle>
                        <AlertDescription>Grant status is visible, but effective coverage cannot exclude non-ready credentialing without <code>staff.credentialing.read</code>.</AlertDescription>
                    </Alert>

                    <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70 xl:col-span-5">
                        <CardHeader class="gap-1.5 pb-2">
                            <CardTitle>Credential Expiry Command Center</CardTitle>
                            <CardDescription>Track expiring staff documents across the current board roster.</CardDescription>
                        </CardHeader>
                        <CardContent class="flex min-h-0 flex-1 flex-col gap-3">
                            <div class="flex flex-wrap gap-2">
                                <div class="min-w-[7rem] rounded-lg border px-3 py-2">
                                    <p class="text-[11px] text-muted-foreground">Overdue</p>
                                    <p class="text-sm font-semibold">{{ credentialExpirySummary.overdue }}</p>
                                </div>
                                <div class="min-w-[7rem] rounded-lg border px-3 py-2">
                                    <p class="text-[11px] text-muted-foreground">Due in 30 days</p>
                                    <p class="text-sm font-semibold">{{ credentialExpirySummary.dueSoon }}</p>
                                </div>
                                <div class="min-w-[7rem] rounded-lg border px-3 py-2">
                                    <p class="text-[11px] text-muted-foreground">Tracked</p>
                                    <p class="text-sm font-semibold">{{ credentialExpirySummary.totalTracked }}</p>
                                </div>
                            </div>
                            <div v-if="boardLoading" class="space-y-2"><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /></div>
                            <div v-else-if="documentReadDenied" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Document permission is unavailable, so expiry monitoring is limited.</div>
                            <div v-else-if="credentialExpiryRows.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No expiring credentials in the current board scope.</div>
                            <ScrollArea v-else class="min-h-0 flex-1 rounded-lg border p-2">
                                <div class="space-y-2">
                                    <div v-for="row in credentialExpiryRows.slice(0, 4)" :key="`${row.staffId}-${row.title}-${row.expiresAt}`" class="rounded-lg border p-2.5 text-sm">
                                        <div class="flex items-start justify-between gap-2">
                                            <div>
                                                <p class="font-medium">{{ row.staffLabel }}</p>
                                                <p class="text-xs text-muted-foreground">{{ row.title }} | {{ row.department }}</p>
                                            </div>
                                            <Badge :variant="(row.dayDelta ?? 1) < 0 ? 'destructive' : (row.dayDelta ?? 999) <= 30 ? 'outline' : 'secondary'">{{ row.dayDelta }}d</Badge>
                                        </div>
                                        <p class="mt-1 text-xs text-muted-foreground">Expires {{ formatDateLabel(row.expiresAt) }} | {{ row.verificationStatus }}</p>
                                    </div>
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <Card class="flex min-h-0 max-h-[34rem] flex-col rounded-lg border-sidebar-border/70 xl:col-span-4">
                        <CardHeader class="gap-1.5 pb-2">
                            <CardTitle>Shift / Skill Coverage</CardTitle>
                            <CardDescription>
                                {{
                                    canReadCredentialing
                                        ? 'Only credentialing-ready staff with active privileges count toward effective department coverage.'
                                        : 'See where active privilege coverage is concentrated by department.'
                                }}
                            </CardDescription>
                        </CardHeader>
                        <CardContent class="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                            <div v-if="boardLoading" class="space-y-2"><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /></div>
                            <div v-else-if="coverageRows.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No active privilege coverage in the current board scope.</div>
                            <ScrollArea v-else class="min-h-0 flex-1 rounded-lg border p-2">
                                <div class="space-y-2">
                                    <div v-for="row in coverageRows" :key="row.department" class="rounded-lg border p-2.5">
                                        <div class="flex items-start justify-between gap-2">
                                            <div>
                                                <p class="text-sm font-medium">{{ row.department }}</p>
                                                <p class="text-xs text-muted-foreground">
                                                    {{
                                                        canReadCredentialing
                                                            ? `${row.activeStaffCount} credentialing-ready staff with active privileges`
                                                            : `${row.activeStaffCount} staff with active privileges`
                                                    }}
                                                </p>
                                            </div>
                                            <Badge variant="secondary">{{ row.activePrivilegeCount }} grants</Badge>
                                        </div>
                                        <p class="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">{{ row.specialties.length ? row.specialties.join(' | ') : 'No specialty coverage tags recorded.' }}</p>
                                        <p v-if="canReadCredentialing && row.excludedActiveStaffCount > 0" class="mt-1 text-[11px] text-amber-700">
                                            {{ row.excludedActiveStaffCount }} active privilege holder{{ row.excludedActiveStaffCount === 1 ? '' : 's' }} excluded because credentialing is not ready.
                                        </p>
                                    </div>
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70 xl:col-span-3">
                        <CardHeader class="gap-1.5 pb-2">
                            <CardTitle>Privileging Decision Timeline</CardTitle>
                            <CardDescription>Latest grant changes and review pressure across the current board scope.</CardDescription>
                        </CardHeader>
                        <CardContent class="flex min-h-0 flex-1 flex-col gap-2">
                            <div v-if="boardLoading" class="space-y-2"><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /></div>
                            <div v-else-if="privilegingTimelineRows.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No recent privileging updates found.</div>
                            <ScrollArea v-else class="min-h-0 flex-1 rounded-lg border p-2">
                                <div class="space-y-2">
                                    <div v-for="row in privilegingTimelineRows.slice(0, 4)" :key="row.id" class="rounded-lg border p-2.5">
                                        <div class="flex items-start justify-between gap-2">
                                            <div>
                                                <p class="text-sm font-medium">{{ row.privilegeLabel }}</p>
                                                <p class="text-xs text-muted-foreground">{{ row.staffLabel }}</p>
                                            </div>
                                            <Badge :variant="statusVariant(row.status)" class="capitalize">{{ row.status }}</Badge>
                                        </div>
                                        <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{{ formatDateLabel(row.at) }} | {{ row.detail || 'No note recorded.' }}</p>
                                    </div>
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </template>
            </div>

            <Card v-else-if="workspaceView === 'grant'" id="grant-staff-privilege" class="rounded-lg border-sidebar-border/70">
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <AppIcon name="plus" class="size-5 text-muted-foreground" />
                        Submit Privilege Request
                    </CardTitle>
                    <CardDescription>{{ selectedStaff ? `${staffDisplayName(selectedStaff)} | ${selectedStaff.employeeNumber || selectedStaff.id}` : 'Select staff profile from the queue first.' }}</CardDescription>
                </CardHeader>
                <CardContent class="space-y-4">
                    <Alert v-if="!selectedStaff" variant="destructive">
                        <AlertTitle>Staff selection required</AlertTitle>
                        <AlertDescription>Choose a staff profile in the queue before submitting a privilege request.</AlertDescription>
                    </Alert>
                    <Alert v-else-if="canReadCredentialing && selectedStaffCredentialingError" variant="destructive">
                        <AlertTitle>Credentialing summary issue</AlertTitle>
                        <AlertDescription>{{ selectedStaffCredentialingError }}</AlertDescription>
                    </Alert>
                    <Alert v-else-if="canReadCredentialing && selectedStaffCredentialingSummary" :variant="(selectedStaffCredentialingSummary.credentialingState ?? '').toLowerCase() === 'blocked' ? 'destructive' : 'default'">
                        <AlertTitle class="flex flex-wrap items-center gap-2">
                            Privileging eligibility
                            <Badge :variant="credentialingStateVariant(selectedStaffCredentialingSummary.credentialingState)" class="capitalize">
                                {{ formatStatusLabel(selectedStaffCredentialingSummary.credentialingState) || 'Unknown' }}
                            </Badge>
                        </AlertTitle>
                        <AlertDescription>{{ selectedStaffCredentialingPreview }}</AlertDescription>
                    </Alert>
                    <Alert v-else-if="canReadCredentialing && selectedStaffCredentialingLoading">
                        <AlertTitle>Checking eligibility</AlertTitle>
                        <AlertDescription>Loading the selected staff member's credentialing state before submitting a privilege request.</AlertDescription>
                    </Alert>
                    <Alert v-if="createErrorMessage" variant="destructive">
                        <AlertTitle>Privilege request blocked</AlertTitle>
                        <AlertDescription>{{ createErrorMessage }}</AlertDescription>
                    </Alert>
                    <Alert v-if="!catalogLoading && !catalogError && privilegeCatalogOptions.length === 0">
                        <AlertTitle>Manual entry fallback</AlertTitle>
                        <AlertDescription>No governed privilege templates are available in the current scope, so manual privilege entry is enabled.</AlertDescription>
                    </Alert>
                    <div class="grid gap-3 md:grid-cols-2">
                        <div class="grid gap-2"><Label for="create-facility">Facility</Label><Select v-if="facilityOptions.length" v-model="createForm.facilityId"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="">Select facility</SelectItem><SelectItem v-for="row in facilityOptions" :key="`cf-${row.id}`" :value="row.id">{{ row.label }}</SelectItem></SelectContent></Select><Input v-else id="create-facility" v-model="createForm.facilityId" placeholder="Facility UUID" /><p v-if="createErrors.facilityId" class="text-xs text-destructive">{{ createErrors.facilityId[0] }}</p></div>
                        <template v-if="privilegeCatalogOptions.length > 0">
                            <div class="grid gap-2">
                                <Label for="create-privilege-catalog">Privilege Template</Label>
                                <Select v-model="createForm.privilegeCatalogId">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="">Select template</SelectItem>
                                    <SelectItem v-for="row in privilegeCatalogOptions" :key="`pc-${row.id}`" :value="row.id">{{ row.label }}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p class="text-xs text-muted-foreground">Governed templates are filtered by facility type when that context is available.</p>
                                <p v-if="createErrors.privilegeCatalogId" class="text-xs text-destructive">{{ createErrors.privilegeCatalogId[0] }}</p>
                            </div>
                            <div class="grid gap-2">
                                <Label>Template Scope</Label>
                                <div class="min-h-[5.5rem] rounded-lg border bg-muted/20 p-3 text-sm">
                                    <template v-if="selectedCreateCatalog">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Badge variant="secondary">{{ selectedCreateCatalog.code || 'Template' }}</Badge>
                                            <Badge variant="outline">{{ loadLabel(specialtyMap, selectedCreateCatalog.specialtyId) }}</Badge>
                                            <Badge v-if="selectedCreateCatalog.cadreCode" variant="outline">{{ formatStatusLabel(selectedCreateCatalog.cadreCode) }}</Badge>
                                            <Badge v-if="selectedCreateCatalog.facilityType" variant="outline">{{ formatStatusLabel(selectedCreateCatalog.facilityType) }}</Badge>
                                        </div>
                                        <p class="mt-2 font-medium">{{ selectedCreateCatalog.name || 'Unnamed template' }}</p>
                                        <p class="mt-1 text-xs text-muted-foreground">{{ selectedCreateCatalog.description || 'No template description recorded.' }}</p>
                                    </template>
                                    <p v-else class="text-xs text-muted-foreground">Select a privilege template to preview its governed scope.</p>
                                </div>
                                <p v-if="selectedCreateCatalogEligibilityIssue" class="text-xs text-destructive">
                                    {{ selectedCreateCatalogEligibilityIssue }}
                                </p>
                                <p
                                    v-else-if="selectedCreateCatalog?.cadreCode && !canReadCredentialing"
                                    class="text-xs text-muted-foreground"
                                >
                                    Staff cadre restriction will still be enforced on save even though credentialing detail is not readable here.
                                </p>
                            </div>
                        </template>
                        <template v-else>
                            <div class="grid gap-2"><Label for="create-specialty">Specialty</Label><Select v-if="specialtyOptions.length" v-model="createForm.specialtyId"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="">Select specialty</SelectItem><SelectItem v-for="row in specialtyOptions" :key="`cs-${row.id}`" :value="row.id">{{ row.label }}</SelectItem></SelectContent></Select><Input v-else id="create-specialty" v-model="createForm.specialtyId" placeholder="Specialty UUID" /><p v-if="createErrors.specialtyId" class="text-xs text-destructive">{{ createErrors.specialtyId[0] }}</p></div>
                            <div class="grid gap-2"><Label for="create-code">Privilege Code</Label><Input id="create-code" v-model="createForm.privilegeCode" /><p v-if="createErrors.privilegeCode" class="text-xs text-destructive">{{ createErrors.privilegeCode[0] }}</p></div>
                            <div class="grid gap-2 md:col-span-2"><Label for="create-name">Privilege Name</Label><Input id="create-name" v-model="createForm.privilegeName" /><p v-if="createErrors.privilegeName" class="text-xs text-destructive">{{ createErrors.privilegeName[0] }}</p></div>
                        </template>
                        <div class="grid gap-2"><Label for="create-granted">Granted At</Label><Input id="create-granted" v-model="createForm.grantedAt" type="date" /><p v-if="createErrors.grantedAt" class="text-xs text-destructive">{{ createErrors.grantedAt[0] }}</p></div>
                        <div class="grid gap-2"><Label for="create-review">Review Due At</Label><Input id="create-review" v-model="createForm.reviewDueAt" type="date" /><p v-if="createErrors.reviewDueAt" class="text-xs text-destructive">{{ createErrors.reviewDueAt[0] }}</p></div>
                        <div class="grid gap-2 md:col-span-2"><Label for="create-notes">Scope Notes</Label><Textarea id="create-notes" v-model="createForm.scopeNotes" class="min-h-24" /></div>
                    </div>
                    <div class="flex flex-wrap items-center justify-end gap-2">
                        <Button variant="outline" :disabled="createLoading" @click="setWorkspaceView('queue')">Cancel</Button>
                        <Button :disabled="createLoading || !canSubmitCreateGrant" @click="saveCreate">{{ createLoading ? 'Saving...' : 'Submit Request' }}</Button>
                    </div>
                </CardContent>
            </Card>
                    </template>
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-2.5">
                <span class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <AppIcon name="activity" class="size-3.5" />
                    Care workflow:
                </span>
                <Button size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="workspaceStaffHref('/staff', selectedStaff)">
                        <AppIcon name="users" class="size-3.5" />
                        Staff Directory
                    </Link>
                </Button>
                <Button v-if="canReadCredentialing" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="workspaceStaffHref('/staff-credentialing', selectedStaff)">
                        <AppIcon name="badge-check" class="size-3.5" />
                        Credentialing
                    </Link>
                </Button>
                <Button size="sm" class="gap-1.5">
                    <AppIcon name="shield-check" class="size-3.5" />
                    Privileging &amp; Coverage
                </Button>
                <span v-if="selectedStaff" class="text-xs text-muted-foreground">
                    Viewing {{ staffDisplayName(selectedStaff) }}
                </span>
            </div>

            <StaffProfileEditDialog
                :open="staffEditDialogOpen"
                :profile="staffEditDialogProfile"
                @update:open="(open) => (staffEditDialogOpen = open)"
                @saved="handleStaffProfileSaved"
            />

            <StaffProfileStatusDialog
                :open="staffStatusDialogOpen"
                :profile="staffStatusDialogProfile"
                @update:open="(open) => (staffStatusDialogOpen = open)"
                @saved="handleStaffStatusSaved"
            />

            <Dialog :open="editOpen" @update:open="(open) => (open ? (editOpen = true) : (editOpen = false))">
                <DialogContent size="2xl">
                    <DialogHeader><DialogTitle>Edit Privilege Grant</DialogTitle><DialogDescription>{{ selectedStaff ? `${staffDisplayName(selectedStaff)} - ${selectedStaff.employeeNumber || selectedStaff.id}` : '' }}</DialogDescription></DialogHeader>
                    <div class="grid gap-3 md:grid-cols-2">
                        <div class="grid gap-2"><Label for="edit-facility">Facility</Label><Select v-if="facilityOptions.length" v-model="editForm.facilityId"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="">Select facility</SelectItem><SelectItem v-for="row in facilityOptions" :key="`ef-${row.id}`" :value="row.id">{{ row.label }}</SelectItem></SelectContent></Select><Input v-else id="edit-facility" v-model="editForm.facilityId" placeholder="Facility UUID" /><p v-if="editErrors.facilityId" class="text-xs text-destructive">{{ editErrors.facilityId[0] }}</p></div>
                        <div class="grid gap-2"><Label for="edit-specialty">Specialty</Label><Select v-if="specialtyOptions.length" v-model="editForm.specialtyId"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="">Select specialty</SelectItem><SelectItem v-for="row in specialtyOptions" :key="`es-${row.id}`" :value="row.id">{{ row.label }}</SelectItem></SelectContent></Select><Input v-else id="edit-specialty" v-model="editForm.specialtyId" placeholder="Specialty UUID" /><p v-if="editErrors.specialtyId" class="text-xs text-destructive">{{ editErrors.specialtyId[0] }}</p></div>
                        <div class="grid gap-2"><Label for="edit-code">Privilege Code</Label><Input id="edit-code" v-model="editForm.privilegeCode" /><p v-if="editErrors.privilegeCode" class="text-xs text-destructive">{{ editErrors.privilegeCode[0] }}</p></div>
                        <div class="grid gap-2"><Label for="edit-name">Privilege Name</Label><Input id="edit-name" v-model="editForm.privilegeName" /><p v-if="editErrors.privilegeName" class="text-xs text-destructive">{{ editErrors.privilegeName[0] }}</p></div>
                        <div class="grid gap-2"><Label for="edit-granted">Granted At</Label><Input id="edit-granted" v-model="editForm.grantedAt" type="date" /><p v-if="editErrors.grantedAt" class="text-xs text-destructive">{{ editErrors.grantedAt[0] }}</p></div>
                        <div class="grid gap-2"><Label for="edit-review">Review Due At</Label><Input id="edit-review" v-model="editForm.reviewDueAt" type="date" /><p v-if="editErrors.reviewDueAt" class="text-xs text-destructive">{{ editErrors.reviewDueAt[0] }}</p></div>
                        <div class="grid gap-2 md:col-span-2"><Label for="edit-notes">Scope Notes</Label><Textarea id="edit-notes" v-model="editForm.scopeNotes" class="min-h-24" /></div>
                    </div>
                    <DialogFooter class="gap-2"><Button variant="outline" :disabled="editLoading" @click="editOpen=false">Cancel</Button><Button :disabled="editLoading || !selectedStaffHasVerifiedLinkedUser" @click="saveEdit">{{ editLoading ? 'Saving...' : 'Save Changes' }}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog :open="statusOpen" @update:open="(open) => (open ? (statusOpen = true) : (statusOpen = false))">
                <DialogContent variant="action" size="lg">
                    <DialogHeader><DialogTitle>{{ statusDialogTitle }}</DialogTitle><DialogDescription>{{ statusDialogDescription }}</DialogDescription></DialogHeader>
                    <div class="space-y-3">
                        <Alert v-if="statusError" variant="destructive"><AlertTitle>Status update failed</AlertTitle><AlertDescription>{{ statusError }}</AlertDescription></Alert>
                        <Alert v-if="availableStatusOptions.length === 0" variant="destructive"><AlertTitle>Workflow access restricted</AlertTitle><AlertDescription>You do not have any workflow actions available for this privilege request.</AlertDescription></Alert>
                        <div v-if="statusActionChoices.length > 1" class="grid gap-2">
                            <Label for="status-target">Action</Label>
                            <Select v-model="statusTarget">
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem v-for="option in statusActionChoices" :key="option.value" :value="option.value">{{ option.meta.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <p class="text-xs text-muted-foreground">Pick the next permitted action for this request.</p>
                        </div>
                        <div v-else-if="statusActionChoices.length === 1" class="rounded-lg border bg-muted/20 p-3 text-sm">
                            <p class="font-medium">{{ statusActionChoices[0].meta.label }}</p>
                            <p class="mt-1 text-xs text-muted-foreground">{{ statusActionChoices[0].meta.description }}</p>
                        </div>
                        <div class="grid gap-2"><Label for="status-reason">{{ statusReasonLabel }} <span v-if="statusReasonRequired" class="text-destructive">*</span></Label><Textarea id="status-reason" v-model="statusReason" class="min-h-20" /></div>
                    </div>
                    <DialogFooter class="gap-2"><Button variant="outline" :disabled="statusLoading" @click="statusOpen=false">Cancel</Button><Button :disabled="statusLoading || availableStatusOptions.length === 0 || !selectedStaffHasVerifiedLinkedUser" @click="saveStatus">{{ statusSubmitLabel }}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Sheet :open="detailsOpen" @update:open="(open) => (detailsOpen = open)">
                <SheetContent side="right" variant="workspace" size="3xl">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12"><SheetTitle>{{ selectedGrant?.privilegeCode || selectedGrant?.id || 'Privilege' }}</SheetTitle><SheetDescription>{{ selectedGrant?.privilegeName || 'Privilege details' }}</SheetDescription></SheetHeader>
                    <div class="flex-1 overflow-hidden p-4">
                        <Tabs v-model="detailsTab" class="flex h-full flex-col">
                            <TabsList class="grid w-full grid-cols-3"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="workflows">Workflows</TabsTrigger><TabsTrigger value="audit">Audit</TabsTrigger></TabsList>
                            <TabsContent value="overview" class="mt-3 space-y-3">
                                <div v-if="!selectedGrant" class="text-sm text-muted-foreground">No privilege selected.</div>
                                <template v-else>
                                    <div class="grid gap-3 md:grid-cols-2">
                                        <Card class="rounded-lg"><CardHeader class="pb-2"><CardTitle class="text-sm">Assignment</CardTitle></CardHeader><CardContent class="space-y-1 text-xs text-muted-foreground"><p>Facility: {{ loadLabel(facilityMap, selectedGrant.facilityId) }}</p><p>Specialty: {{ loadLabel(specialtyMap, selectedGrant.specialtyId) }}</p><p>Template: {{ selectedGrant.privilegeCatalogId ? loadLabel(privilegeCatalogMap, selectedGrant.privilegeCatalogId) : 'Manual / legacy entry' }}</p><p>Granted: {{ formatDateLabel(selectedGrant.grantedAt) }}</p><p>Review Due: {{ formatDateLabel(selectedGrant.reviewDueAt) }}</p></CardContent></Card>
                                        <Card class="rounded-lg"><CardHeader class="pb-2"><CardTitle class="text-sm">Status</CardTitle></CardHeader><CardContent class="space-y-1 text-xs text-muted-foreground"><p>Status: {{ selectedGrant.status || 'unknown' }}</p><p>Reason: {{ selectedGrant.statusReason || 'N/A' }}</p><p>Requested: {{ formatDateLabel(selectedGrant.requestedAt) }}</p><p>Review Started: {{ formatDateLabel(selectedGrant.reviewStartedAt) }}</p><p>Reviewer: {{ actorDisplayName(selectedGrant.reviewerUser, selectedGrant.reviewerUserId) }}</p><p>Review Note: {{ selectedGrant.reviewNote || 'N/A' }}</p><p>Approved: {{ formatDateLabel(selectedGrant.approvedAt) }}</p><p>Approver: {{ actorDisplayName(selectedGrant.approverUser, selectedGrant.approverUserId) }}</p><p>Approval Note: {{ selectedGrant.approvalNote || 'N/A' }}</p><p>Activated: {{ formatDateLabel(selectedGrant.activatedAt) }}</p><p>Code: {{ selectedGrant.privilegeCode || 'N/A' }}</p><p>Name: {{ selectedGrant.privilegeName || 'N/A' }}</p></CardContent></Card>
                                    </div>
                                    <Card class="rounded-lg"><CardHeader class="pb-2"><CardTitle class="text-sm">Scope Notes</CardTitle></CardHeader><CardContent class="text-xs text-muted-foreground">{{ selectedGrant.scopeNotes || 'No scope notes.' }}</CardContent></Card>
                                </template>
                            </TabsContent>
                            <TabsContent value="workflows" class="mt-3 space-y-3">
                                <div v-if="!selectedGrant" class="text-sm text-muted-foreground">No privilege selected.</div>
                                <template v-else>
                                    <Card class="rounded-lg">
                                        <CardHeader class="pb-2">
                                            <CardTitle class="text-sm">Privileging Timeline</CardTitle>
                                            <CardDescription>Track creation, grant, review, and current governance state.</CardDescription>
                                        </CardHeader>
                                        <CardContent class="space-y-4">
                                            <div v-for="(event, index) in selectedGrantTimelineItems" :key="event.id" class="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                                                <div class="flex flex-col items-center">
                                                    <span class="mt-1 inline-flex size-3 rounded-full" :class="event.complete ? 'bg-primary' : 'bg-muted-foreground/30'" />
                                                    <span v-if="index < selectedGrantTimelineItems.length - 1" class="mt-1 h-full min-h-8 w-px bg-border" />
                                                </div>
                                                <div class="rounded-lg border p-3">
                                                    <div class="flex flex-wrap items-center justify-between gap-2">
                                                        <p class="text-sm font-medium">{{ event.title }}</p>
                                                        <Badge :variant="event.complete ? 'default' : 'outline'">{{ event.complete ? formatDateLabel(event.at) : 'Pending' }}</Badge>
                                                    </div>
                                                    <p class="mt-2 text-sm text-muted-foreground">{{ event.description }}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </template>
                            </TabsContent>
                            <TabsContent value="audit" class="mt-3 space-y-2">
                                <Alert v-if="privilegeAuditDenied" variant="destructive"><AlertTitle>Audit access restricted</AlertTitle><AlertDescription>Request <code>staff.privileges.view-audit-logs</code>.</AlertDescription></Alert>
                                <template v-else>
                                    <div class="grid gap-2 md:grid-cols-3">
                                        <div class="md:col-span-3"><Label for="audit-q">Action Text</Label><Input id="audit-q" v-model="auditFilters.q" /></div>
                                        <div><Label for="audit-action">Action</Label><Input id="audit-action" v-model="auditFilters.action" /></div>
                                        <div><Label for="audit-actor-type">Actor Type</Label><Select v-model="auditFilters.actorType"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="">All actors</SelectItem><SelectItem value="user">User</SelectItem><SelectItem value="system">System</SelectItem></SelectContent></Select></div>
                                        <div><Label for="audit-actor-id">Actor ID</Label><Input id="audit-actor-id" v-model="auditFilters.actorId" /></div>
                                        <div><Label for="audit-from">From</Label><Input id="audit-from" v-model="auditFilters.from" type="datetime-local" /></div>
                                        <div><Label for="audit-to">To</Label><Input id="audit-to" v-model="auditFilters.to" type="datetime-local" /></div>
                                        <div class="flex items-end gap-2"><Button class="flex-1" :disabled="auditLoading" @click="auditFilters.page=1;loadAudit()">Apply</Button><Button variant="outline" :disabled="auditLoading" @click="auditFilters.q='';auditFilters.action='';auditFilters.actorType='';auditFilters.actorId='';auditFilters.from='';auditFilters.to='';auditFilters.page=1;loadAudit()">Reset</Button><Button variant="outline" :disabled="auditLoading || auditExporting" @click="exportAudit">{{ auditExporting ? 'Preparing...' : 'Export CSV' }}</Button></div>
                                    </div>
                                    <Alert v-if="auditError" variant="destructive"><AlertTitle>Audit issue</AlertTitle><AlertDescription>{{ auditError }}</AlertDescription></Alert>
                                    <div v-if="auditLoading" class="space-y-2"><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /></div>
                                    <div v-else-if="auditRows.length === 0" class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No audit logs found.</div>
                                    <ScrollArea v-else class="max-h-[320px] rounded-lg border p-2"><div class="space-y-2"><div v-for="row in auditRows" :key="row.id" class="rounded-md border p-2"><p class="text-sm font-medium">{{ row.actionLabel || row.action || 'event' }}</p><p class="text-xs text-muted-foreground">{{ row.createdAt || 'N/A' }} | {{ row.actor?.displayName || (row.actorId === null ? 'System' : `User #${row.actorId}`) }}</p></div></div></ScrollArea>
                                </template>
                            </TabsContent>
                        </Tabs>
                    </div>
                    <div class="border-t px-4 py-3"><div class="flex justify-end"><Button variant="outline" @click="detailsOpen=false">Close</Button></div></div>
                </SheetContent>
            </Sheet>
        </div>
    </AppLayout>
</template>





