<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import PlatformRoleAssignmentPicker from '@/components/platform/PlatformRoleAssignmentPicker.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { csrfRequestHeaders, refreshCsrfToken } from '@/lib/csrf';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type AccessibleFacility = { id?: string | null; code?: string | null; name?: string | null };
type ScopeData = {
    resolvedFrom: string;
    tenant?: { code?: string | null; name?: string | null } | null;
    facility?: AccessibleFacility | null;
    userAccess?: { facilities?: AccessibleFacility[]; accessibleFacilityCount?: number };
};
type PlatformRole = {
    id: string | null;
    name: string | null;
    code: string | null;
    riskTier?: 'hospital' | 'platform' | 'system' | 'other' | null;
    isElevated?: boolean | null;
};
type PlatformUserFacilityAssignment = { facilityId: string | null; role?: string | null; isPrimary?: boolean; isActive?: boolean };
type PlatformUserPrivilegedContext = {
    isPrivileged?: boolean;
    matchedPermissionNames?: string[];
    roleCodes?: string[];
    systemRoleCodes?: string[];
} | null;
type PlatformUser = {
    id: number | null;
    name: string | null;
    email: string | null;
    emailVerifiedAt: string | null;
    status: string | null;
    statusReason: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    roleIds: string[];
    roles: PlatformRole[];
    requiresApprovalCaseForSensitiveChanges?: boolean;
    privilegedTargetUser?: PlatformUserPrivilegedContext;
    facilityAssignments: PlatformUserFacilityAssignment[];
};
type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type PlatformUserListResponse = { data: PlatformUser[]; meta: Pagination };
type PlatformUserResponse = { data: PlatformUser };
type PlatformUserStatusCounts = { active: number; inactive: number; other: number; total: number };
type PlatformUserStatusCountsResponse = { data: PlatformUserStatusCounts };
type PlatformUserBulkStatusResponse = {
    data: {
        requestedCount: number;
        updatedCount: number;
        skippedUserIds: number[];
        users: PlatformUser[];
    };
};
type PlatformUserBulkCredentialLinksResponse = {
    data: {
        requestedCount: number;
        dispatchedCount: number;
        inviteCount: number;
        resetCount: number;
        skippedUserIds: number[];
        failedCount: number;
        failedUserIds: number[];
        failed: Array<{ userId: number | null; message: string }>;
    };
};
type PlatformUserBulkRoleSyncResponse = {
    data: {
        requestedCount: number;
        updatedCount: number;
        skippedUserIds: number[];
        updates: Array<{
            userId: number | null;
            roleIds: string[];
            roles: PlatformRole[];
        }>;
    };
};
type PlatformUserBulkFacilitiesResponse = {
    data: {
        requestedCount: number;
        updatedCount: number;
        skippedUserIds: number[];
        users: PlatformUser[];
    };
};
type PlatformRoleListResponse = {
    data: PlatformRole[];
    meta?: { roleAssignmentPolicy?: 'full' | 'hospital_operational' };
};
type PlatformUserRoleSyncResponse = { data: { roleIds: string[]; roles: PlatformRole[] } };
type PlatformUserCredentialLinkResponse = {
    data: {
        userId: number | null;
        message: string | null;
        previewUrl?: string | null;
        deliveryMode?: string | null;
    };
};
type PlatformUserAuditLog = {
    id: string;
    actorId: number | null;
    actorType?: 'system' | 'user' | null;
    actor?: { displayName?: string | null } | null;
    action: string | null;
    actionLabel?: string | null;
    createdAt: string | null;
};
type PlatformUserAuditLogListResponse = { data: PlatformUserAuditLog[]; meta: Pagination };
type ValidationErrorResponse = { message?: string; errors?: Record<string, string[]> };
type SearchForm = {
    q: string;
    status: string;
    verification: string;
    roleId: string;
    facilityId: string;
    sortBy: string;
    sortDir: 'asc' | 'desc';
    perPage: number;
    page: number;
};
type FacilityAssignmentDraft = { facilityId: string; role: string; isPrimary: boolean; isActive: boolean };
type CheckboxCheckedState = boolean | 'indeterminate';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Platform Admin', href: '/platform/admin/users' },
    { title: 'Users', href: '/platform/admin/users' },
];

const { permissionNames, permissionState, scope: sharedScope, multiTenantIsolationEnabled, mail: platformMail } = usePlatformAccess();

const permissionsResolved = computed(() => permissionNames.value !== null);
const canRead = computed(() => permissionState('platform.users.read') === 'allowed');
const canCreate = computed(() => permissionState('platform.users.create') === 'allowed');
const canUpdate = computed(() => permissionState('platform.users.update') === 'allowed');
const canUpdateStatus = computed(() => permissionState('platform.users.update-status') === 'allowed');
const canResetPassword = computed(() => permissionState('platform.users.reset-password') === 'allowed');
const canManageRoles = computed(() => permissionState('platform.rbac.manage-user-roles') === 'allowed');
const canReadRoles = computed(() => permissionState('platform.rbac.read') === 'allowed');
const canManageFacilities = computed(() => permissionState('platform.users.manage-facilities') === 'allowed');
const canViewAudit = computed(() => permissionState('platform.users.view-audit-logs') === 'allowed');
const canReadApprovalCases = computed(() => permissionState('platform.users.approval-cases.read') === 'allowed');
const canCreateLinkedStaffProfile = computed(() => permissionState('staff.create') === 'allowed');

const scope = computed<ScopeData | null>(() => (sharedScope.value as ScopeData | null) ?? null);
const availableFacilities = computed(() => scope.value?.userAccess?.facilities ?? []);
const scopeUnresolved = computed(() => multiTenantIsolationEnabled.value && (scope.value?.resolvedFrom ?? 'none') === 'none');
const platformMailWarning = computed(() => platformMail.value?.warning ?? null);
const platformMailDeliversExternally = computed(() => platformMail.value?.deliversExternally !== false);
const platformMailSupportsCredentialLinkPreview = computed(() => platformMail.value?.supportsCredentialLinkPreview === true);
const scopedFacilityLabel = computed(() => {
    const facility = scope.value?.facility;
    const name = String(facility?.name ?? '').trim();
    const code = String(facility?.code ?? '').trim();

    if (name && code) return `${name} (${code})`;
    if (name) return name;
    if (code) return code;

    return null;
});
const scopedFacilityId = computed<string | null>(() => {
    const facility = scope.value?.facility;
    return facility?.id ? String(facility.id) : null;
});
const usersWorkspaceTitle = computed(() => (scopedFacilityLabel.value ? 'Facility Users' : 'Platform Users'));
const usersWorkspaceDescription = computed(() =>
    scopedFacilityLabel.value
        ? `Onboard, invite, and maintain user access for ${scopedFacilityLabel.value}.`
        : 'Account queue, lifecycle actions, role mapping, and facility assignments for platform access.',
);

const pageLoading = ref(true);
const listLoading = ref(false);
const queueReady = ref(false);
const createLoading = ref(false);
const actionLoadingId = ref<number | null>(null);
const users = ref<PlatformUser[]>([]);
const pagination = ref<Pagination | null>(null);
const statusCounts = ref<PlatformUserStatusCounts>({ active: 0, inactive: 0, other: 0, total: 0 });
const listErrors = ref<string[]>([]);

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

function queryPositiveNumberParam(name: string): number | null {
    const parsed = Number.parseInt(queryParam(name), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function queryNumberParam(name: string, fallback: number, allowed: number[]): number {
    const parsed = Number.parseInt(queryParam(name), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return allowed.includes(parsed) ? parsed : fallback;
}

const initialOpenUserId = queryPositiveNumberParam('openUserId');

const searchForm = reactive<SearchForm>({
    q: queryParam('q'),
    status: queryParam('status'),
    verification: queryParam('verification'),
    roleId: queryParam('roleId'),
    facilityId: queryParam('facilityId'),
    sortBy: queryParam('sortBy') || 'name',
    sortDir: queryParam('sortDir') === 'desc' ? 'desc' : 'asc',
    perPage: queryNumberParam('perPage', 12, [12, 24, 48]),
    page: Math.max(Number.parseInt(queryParam('page') || '1', 10) || 1, 1),
});

const createForm = reactive({ name: '', email: '' });
const createSendInvite = ref(true);
const createErrors = ref<Record<string, string[]>>({});
const createDialogOpen = ref(false);

const showAdvancedFilters = useLocalStorageBoolean('platform.users.filters.advanced', false);
const compactQueueRows = useLocalStorageBoolean('platform.users.queueRows.compact', false);
const userFiltersSheetOpen = ref(false);
const isFacilityScopedView = computed(() => Boolean(scopedFacilityLabel.value));
const selectedUserIds = ref<number[]>([]);
const bulkStatusDialogOpen = ref(false);
const bulkStatusDialogTarget = ref<'active' | 'inactive' | null>(null);
const bulkStatusDialogReason = ref('');
const bulkStatusDialogApprovalCaseReference = ref('');
const bulkStatusDialogError = ref<string | null>(null);
const bulkStatusLoading = ref(false);
const bulkCredentialLinksLoading = ref(false);
const bulkRolesDialogOpen = ref(false);
const bulkRolesDialogError = ref<string | null>(null);
const bulkRolesLoading = ref(false);
const bulkRoleDraftIds = ref<string[]>([]);
const bulkRolesApprovalCaseReference = ref('');
const bulkFacilitiesDialogOpen = ref(false);
const bulkFacilitiesDialogError = ref<string | null>(null);
const bulkFacilitiesLoading = ref(false);
const bulkFacilityDrafts = ref<FacilityAssignmentDraft[]>([]);
const newBulkFacilityDraftId = ref('');
const bulkFacilitiesApprovalCaseReference = ref('');

const detailsOpen = ref(false);
const detailsLoading = ref(false);
const detailsSheetTab = ref('overview');
const detailsAuditFiltersOpen = ref(false);
const detailsUser = ref<PlatformUser | null>(null);
const roles = ref<PlatformRole[]>([]);
const roleAssignmentPolicy = ref<'full' | 'hospital_operational'>('full');
const roleDraftIds = ref<string[]>([]);
const facilityDrafts = ref<FacilityAssignmentDraft[]>([]);
const newFacilityDraftId = ref('');
const saveRolesLoading = ref(false);
const saveFacilitiesLoading = ref(false);
const saveRolesApprovalCaseReference = ref('');
const saveFacilitiesApprovalCaseReference = ref('');
const saveRolesError = ref<string | null>(null);
const saveFacilitiesError = ref<string | null>(null);
const detailsAuditLoading = ref(false);
const detailsAuditError = ref<string | null>(null);
const detailsAuditLogs = ref<PlatformUserAuditLog[]>([]);
const detailsAuditMeta = ref<Pagination | null>(null);
const detailsAuditExporting = ref(false);
const detailsAuditFilters = reactive({ q: '', action: '', actorType: '', actorId: '', from: '', to: '', page: 1, perPage: 20 });

const statusDialogOpen = ref(false);
const statusDialogUser = ref<PlatformUser | null>(null);
const statusDialogTarget = ref<'active' | 'inactive' | null>(null);
const statusDialogReason = ref('');
const statusDialogApprovalCaseReference = ref('');
const statusDialogError = ref<string | null>(null);

const editDialogOpen = ref(false);
const editDialogLoading = ref(false);
const editDialogFetching = ref(false);
const editDialogUserId = ref<number | null>(null);
const editDialogRequiresApprovalCase = ref(false);
const editDialogApprovalCaseReference = ref('');
const editForm = reactive({ name: '', email: '' });
const editErrors = ref<Record<string, string[]>>({});
const editDialogError = ref<string | null>(null);

let searchDebounceTimer: number | null = null;

function resetCreateForm(): void {
    createForm.name = '';
    createForm.email = '';
    createSendInvite.value = true;
    createErrors.value = {};
}

function openCreateUserDialog(): void {
    if (!canCreate.value) return;
    resetCreateForm();
    createDialogOpen.value = true;
}

function closeCreateUserDialog(): void {
    createDialogOpen.value = false;
    resetCreateForm();
}
const hasAdvancedFilters = computed(() =>
    Boolean(
        searchForm.verification ||
        searchForm.roleId ||
        searchForm.facilityId ||
        searchForm.sortBy !== 'name' ||
        searchForm.sortDir !== 'asc' ||
        searchForm.perPage !== 12,
    ),
);
const userSortByLabels: Record<string, string> = {
    name: 'Name',
    email: 'Email',
    status: 'Status',
    createdAt: 'Created',
    updatedAt: 'Updated',
};
const userFilterChips = computed(() => {
    const chips: Array<{ key: string; label: string }> = [];

    if (searchForm.q.trim()) {
        chips.push({ key: 'q', label: `Search: ${searchForm.q.trim()}` });
    }
    if (searchForm.status) {
        chips.push({ key: 'status', label: `Status: ${searchForm.status}` });
    }
    if (searchForm.verification) {
        chips.push({
            key: 'verification',
            label: `Verification: ${searchForm.verification === 'verified' ? 'Verified' : 'Unverified'}`,
        });
    }
    if (searchForm.roleId) {
        const role = roles.value.find((entry) => String(entry.id ?? '') === searchForm.roleId);
        chips.push({
            key: 'roleId',
            label: `Role: ${role?.name || role?.code || searchForm.roleId}`,
        });
    }
    if (!isFacilityScopedView.value && searchForm.facilityId) {
        chips.push({
            key: 'facilityId',
            label: `Facility: ${facilityLabel(searchForm.facilityId)}`,
        });
    }
    if (searchForm.sortBy !== 'name' || searchForm.sortDir !== 'asc') {
        chips.push({
            key: 'sort',
            label: `Sort: ${userSortByLabels[searchForm.sortBy] ?? searchForm.sortBy}, ${searchForm.sortDir === 'asc' ? 'Ascending' : 'Descending'}`,
        });
    }
    if (searchForm.perPage !== 12) {
        chips.push({ key: 'perPage', label: `${searchForm.perPage} rows` });
    }

    return chips;
});
const filterBadgeCount = computed(() => userFilterChips.value.length);
const hasActiveUserFilters = computed(() => userFilterChips.value.length > 0);
const canPrev = computed(() => (pagination.value?.currentPage ?? 1) > 1);
const canNext = computed(() => {
    if (!pagination.value) return false;
    return pagination.value.currentPage < pagination.value.lastPage;
});
const paginationPageNumbers = computed((): (number | '...')[] => {
    const total = pagination.value?.lastPage ?? 1;
    const current = pagination.value?.currentPage ?? 1;
    if (total <= 7) {
        return Array.from({ length: total }, (_, index) => index + 1);
    }
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) {
        pages.push(page);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
});
const queueDensityValue = computed({
    get: () => (compactQueueRows.value ? 'compact' : 'comfortable'),
    set: (value: string) => {
        compactQueueRows.value = value === 'compact';
    },
});
const detailsUserRequiresApprovalCase = computed(() => Boolean(detailsUser.value?.requiresApprovalCaseForSensitiveChanges));
const detailsPrivilegedRoleCodes = computed(() => detailsUser.value?.privilegedTargetUser?.roleCodes?.filter(Boolean) ?? []);
const detailsPrivilegedMatchedPermissions = computed(() => detailsUser.value?.privilegedTargetUser?.matchedPermissionNames?.filter(Boolean) ?? []);

const detailsRolesOutsideAssignmentScope = computed(() => {
    const assignableIds = new Set(roles.value.map((role) => String(role.id ?? '')).filter(Boolean));

    return (detailsUser.value?.roles ?? []).filter((role) => {
        const roleId = String(role.id ?? '');
        return roleId !== '' && !assignableIds.has(roleId);
    });
});

const unassignedFacilities = computed(() => {
    const selected = new Set(facilityDrafts.value.map((entry) => entry.facilityId));
    return availableFacilities.value.filter((facility) => {
        const id = String(facility.id ?? '');
        return id !== '' && !selected.has(id);
    });
});
const bulkUnassignedFacilities = computed(() => {
    const selected = new Set(bulkFacilityDrafts.value.map((entry) => entry.facilityId));
    return availableFacilities.value.filter((facility) => {
        const id = String(facility.id ?? '');
        return id !== '' && !selected.has(id);
    });
});
const allSelectValue = '__all';
const searchStatusSelectValue = computed({
    get: () => searchForm.status || allSelectValue,
    set: (value: string) => {
        searchForm.status = value === allSelectValue ? '' : value;
    },
});
const searchVerificationSelectValue = computed({
    get: () => searchForm.verification || allSelectValue,
    set: (value: string) => {
        searchForm.verification = value === allSelectValue ? '' : value;
    },
});
const searchRoleSelectValue = computed({
    get: () => searchForm.roleId || allSelectValue,
    set: (value: string) => {
        searchForm.roleId = value === allSelectValue ? '' : value;
    },
});
const searchFacilitySelectValue = computed({
    get: () => searchForm.facilityId || allSelectValue,
    set: (value: string) => {
        searchForm.facilityId = value === allSelectValue ? '' : value;
    },
});
const detailsAuditActorTypeSelectValue = computed({
    get: () => detailsAuditFilters.actorType || allSelectValue,
    set: (value: string) => {
        detailsAuditFilters.actorType = value === allSelectValue ? '' : value;
    },
});

function normalizeRoleIds(roleIds: Array<number | string>): string[] {
    return Array.from(new Set(
        roleIds
            .map((value) => String(value ?? '').trim())
            .filter((value) => value !== ''),
    ));
}

function firstValidationError(payload: ValidationErrorResponse | undefined, keys: string[]): string | null {
    const errors = payload?.errors ?? {};
    for (const key of keys) {
        const messages = errors[key];
        if (Array.isArray(messages) && messages.length > 0) {
            return messages[0] ?? null;
        }
    }

    return null;
}
async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> },
    retryOnCsrfMismatch = true,
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
        Object.assign(headers, csrfRequestHeaders());
        body = JSON.stringify(options?.body ?? {});
    }

    const timeoutMs = method === 'GET' ? 12000 : 20000;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timerId = controller !== null
        ? (typeof window !== 'undefined' ? window.setTimeout(() => controller.abort(), timeoutMs) : setTimeout(() => controller.abort(), timeoutMs))
        : null;

    try {
        const response = await fetch(url.toString(), {
            method,
            credentials: 'same-origin',
            headers,
            body,
            signal: controller?.signal,
        });
        if (response.status === 419 && method !== 'GET' && retryOnCsrfMismatch) {
            await refreshCsrfToken();
            return apiRequest<T>(method, path, options, false);
        }
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
    } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') {
            throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
        }
        throw error;
    } finally {
        if (timerId !== null) {
            if (typeof window !== 'undefined') {
                window.clearTimeout(timerId);
            } else {
                clearTimeout(timerId);
            }
        }
    }
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

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive') return 'destructive';
    return 'outline';
}

function verificationVariant(user: PlatformUser | null): 'outline' | 'secondary' | 'destructive' {
    if (!user?.email) return 'outline';
    return user.emailVerifiedAt ? 'secondary' : 'destructive';
}

function verificationLabel(user: PlatformUser | null): string {
    if (!user?.email) return 'Email missing';
    return user.emailVerifiedAt ? 'Email verified' : 'Verification pending';
}

function credentialLinkActionLabel(user: PlatformUser | null): string {
    if (!user?.emailVerifiedAt) return 'Send invite link';
    return 'Send password reset';
}

function credentialLinkPreviewLabel(user: PlatformUser | null): string {
    if (!user?.emailVerifiedAt) return 'Open invite link';
    return 'Open reset link';
}

function credentialLinkActionDescription(user: PlatformUser | null): string {
    if (!user?.email) return 'This account needs a valid email address before credentials can be dispatched.';
    if (!user.emailVerifiedAt) {
        return 'The invite link confirms mailbox control. Until the user completes it, linked staff credentialing and privileging actions stay blocked.';
    }

    return 'Use password reset when the user already controls the mailbox but needs a fresh sign-in link.';
}


function credentialLinkSuccessMessage(user: PlatformUser): string {
    if (!platformMailDeliversExternally.value) {
        return `${isInviteAction(user) ? 'Invite' : 'Password reset'} link generated for ${user.email ?? `User #${user.id ?? ''}`}, but email delivery is currently set to log only.`;
    }

    return `${isInviteAction(user) ? 'Invite' : 'Password reset'} link sent for ${user.email ?? `User #${user.id ?? ''}`}.`;
}

function userInitials(user: PlatformUser): string {
    const name = (user.name ?? '').trim();
    if (!name) return '?';
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}


const MAX_VISIBLE_USER_ROLES_IN_TABLE = 3;

function userRoleSummary(user: PlatformUser): string {
    const roleLabels = (user.roles ?? [])
        .map((role) => (role.name ?? role.code ?? '').trim())
        .filter((value) => value !== '');

    if (roleLabels.length === 0) return 'No roles assigned';
    if (roleLabels.length <= MAX_VISIBLE_USER_ROLES_IN_TABLE) {
        return roleLabels.join(', ');
    }

    const visible = roleLabels.slice(0, MAX_VISIBLE_USER_ROLES_IN_TABLE);
    const remaining = roleLabels.length - MAX_VISIBLE_USER_ROLES_IN_TABLE;

    return `${visible.join(', ')} +${remaining} more`;
}


function userFacilitySummary(user: PlatformUser): string {
    const assignments = (user.facilityAssignments ?? []).filter((assignment) => String(assignment.facilityId ?? '').trim() !== '');
    if (assignments.length === 0) return 'No facility assignments';

    const primaryAssignment = assignments.find((assignment) => assignment.isPrimary) ?? assignments[0];
    const primaryLabel = facilityLabel(primaryAssignment?.facilityId ?? null) ?? 'Assigned facility';
    const activeCount = assignments.filter((assignment) => assignment.isActive !== false).length;

    if (assignments.length === 1) {
        return primaryAssignment?.isActive === false ? `${primaryLabel} (inactive)` : primaryLabel;
    }

    return `${primaryLabel} +${assignments.length - 1} more${activeCount < assignments.length ? ` | ${activeCount} active` : ''}`;
}

function isInviteAction(user: PlatformUser): boolean {
    return !user.emailVerifiedAt;
}

function syncUserInList(user: PlatformUser): void {
    const index = users.value.findIndex((entry) => entry.id === user.id);
    if (index >= 0) users.value[index] = user;
}

function parseNumericUserId(value: number | null): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;

    return value;
}

const pageUserIds = computed<number[]>(() =>
    users.value
        .map((user) => parseNumericUserId(user.id))
        .filter((value): value is number => value !== null),
);

const selectedCount = computed(() => selectedUserIds.value.length);
const canUseBulkSelection = computed(() => canUpdateStatus.value || canResetPassword.value || canManageRoles.value || canManageFacilities.value);
const bulkActionLoading = computed(() => bulkStatusLoading.value || bulkCredentialLinksLoading.value || bulkRolesLoading.value || bulkFacilitiesLoading.value);
const allVisibleUsersSelected = computed(() =>
    pageUserIds.value.length > 0 && pageUserIds.value.every((id) => selectedUserIds.value.includes(id)),
);
const bulkStatusDialogTitle = computed(() =>
    bulkStatusDialogTarget.value === 'inactive' ? 'Deactivate Selected Users' : 'Activate Selected Users',
);
const bulkStatusDialogDescription = computed(() =>
    bulkStatusDialogTarget.value === 'inactive'
        ? 'Deactivation reason is required. This action applies to all selected users.'
        : 'Confirm re-activation for all selected users.',
);

function toggleUserSelection(userId: number): void {
    if (selectedUserIds.value.includes(userId)) {
        selectedUserIds.value = selectedUserIds.value.filter((value) => value !== userId);

        return;
    }

    selectedUserIds.value = [...selectedUserIds.value, userId];
}

function toggleSelectAllVisibleUsers(): void {
    if (allVisibleUsersSelected.value) {
        const visible = new Set(pageUserIds.value);
        selectedUserIds.value = selectedUserIds.value.filter((id) => !visible.has(id));

        return;
    }

    selectedUserIds.value = Array.from(new Set([...selectedUserIds.value, ...pageUserIds.value]));
}

function updateSelectAllVisibleUsers(checked: CheckboxCheckedState): void {
    const nextChecked = checked === true;
    if (nextChecked === allVisibleUsersSelected.value) return;
    toggleSelectAllVisibleUsers();
}

function updateUserSelection(userId: number, checked: CheckboxCheckedState): void {
    const nextChecked = checked === true;
    const currentlyChecked = selectedUserIds.value.includes(userId);
    if (nextChecked === currentlyChecked) return;
    toggleUserSelection(userId);
}

function clearSelectedUsers(): void {
    selectedUserIds.value = [];
}

function normalizeRoleIdsForRequest(roleIds: Array<number | string>): string[] {
    return Array.from(new Set(
        roleIds
            .map((value) => String(value).trim())
            .filter((value) => value !== ''),
    ));
}

function openBulkRolesDialog(): void {
    if (!canManageRoles.value || selectedUserIds.value.length === 0 || bulkActionLoading.value) {
        return;
    }

    bulkRolesDialogError.value = null;
    bulkRolesApprovalCaseReference.value = '';

    const selectedUsers = users.value.filter((entry) => entry.id !== null && selectedUserIds.value.includes(Number(entry.id)));
    if (selectedUsers.length === 0) {
        bulkRoleDraftIds.value = [];
    } else {
        let sharedRoleIds = normalizeRoleIdsForRequest(selectedUsers[0].roleIds ?? []);
        for (const user of selectedUsers.slice(1)) {
            const userRoleIdSet = new Set(normalizeRoleIdsForRequest(user.roleIds ?? []));
            sharedRoleIds = sharedRoleIds.filter((roleId) => userRoleIdSet.has(roleId));
        }
        bulkRoleDraftIds.value = sharedRoleIds;
    }

    bulkRolesDialogOpen.value = true;
}

function closeBulkRolesDialog(): void {
    bulkRolesDialogOpen.value = false;
    bulkRolesDialogError.value = null;
    bulkRoleDraftIds.value = [];
    bulkRolesApprovalCaseReference.value = '';
}

function toggleBulkRole(roleId: string): void {
    if (bulkRoleDraftIds.value.includes(roleId)) {
        bulkRoleDraftIds.value = bulkRoleDraftIds.value.filter((value) => value !== roleId);

        return;
    }

    bulkRoleDraftIds.value = [...bulkRoleDraftIds.value, roleId];
}

function updateBulkRoleSelection(roleId: string, checked: CheckboxCheckedState): void {
    const nextChecked = checked === true;
    const currentlyChecked = bulkRoleDraftIds.value.includes(roleId);
    if (nextChecked === currentlyChecked) return;
    toggleBulkRole(roleId);
}

function ensureSingleBulkFacilityPrimary(): void {
    const primaries = bulkFacilityDrafts.value.filter((entry) => entry.isPrimary);
    if (bulkFacilityDrafts.value.length > 0 && primaries.length === 0) bulkFacilityDrafts.value[0].isPrimary = true;
    if (primaries.length > 1) {
        let first = true;
        bulkFacilityDrafts.value = bulkFacilityDrafts.value.map((entry) => {
            if (!entry.isPrimary) return entry;
            if (first) {
                first = false;

                return entry;
            }

            return { ...entry, isPrimary: false };
        });
    }
}

function openBulkFacilitiesDialog(): void {
    if (!canManageFacilities.value || selectedUserIds.value.length === 0 || bulkActionLoading.value) {
        return;
    }

    bulkFacilitiesDialogError.value = null;
    bulkFacilitiesApprovalCaseReference.value = '';
    const firstSelectedUser = users.value.find((entry) => entry.id !== null && selectedUserIds.value.includes(Number(entry.id)));
    bulkFacilityDrafts.value = firstSelectedUser
        ? toFacilityDrafts(firstSelectedUser.facilityAssignments ?? [])
        : [];
    ensureSingleBulkFacilityPrimary();
    newBulkFacilityDraftId.value = '';
    bulkFacilitiesDialogOpen.value = true;
}

function closeBulkFacilitiesDialog(): void {
    bulkFacilitiesDialogOpen.value = false;
    bulkFacilitiesDialogError.value = null;
    bulkFacilityDrafts.value = [];
    newBulkFacilityDraftId.value = '';
    bulkFacilitiesApprovalCaseReference.value = '';
}

function setBulkPrimaryFacility(facilityId: string): void {
    bulkFacilityDrafts.value = bulkFacilityDrafts.value.map((entry) => ({ ...entry, isPrimary: entry.facilityId === facilityId }));
}

function addBulkFacilityDraft(): void {
    const facilityId = newBulkFacilityDraftId.value.trim();
    if (!facilityId) return;
    if (bulkFacilityDrafts.value.some((entry) => entry.facilityId === facilityId)) return;
    bulkFacilityDrafts.value.push({ facilityId, role: '', isPrimary: bulkFacilityDrafts.value.length === 0, isActive: true });
    newBulkFacilityDraftId.value = '';
    ensureSingleBulkFacilityPrimary();
}

function removeBulkFacilityDraft(facilityId: string): void {
    bulkFacilityDrafts.value = bulkFacilityDrafts.value.filter((entry) => entry.facilityId !== facilityId);
    ensureSingleBulkFacilityPrimary();
}

function openBulkStatusDialog(target: 'active' | 'inactive'): void {
    if (!canUpdateStatus.value || selectedUserIds.value.length === 0) return;

    bulkStatusDialogTarget.value = target;
    bulkStatusDialogReason.value = '';
    bulkStatusDialogApprovalCaseReference.value = '';
    bulkStatusDialogError.value = null;
    bulkStatusDialogOpen.value = true;
}

function closeBulkStatusDialog(): void {
    bulkStatusDialogOpen.value = false;
    bulkStatusDialogTarget.value = null;
    bulkStatusDialogReason.value = '';
    bulkStatusDialogApprovalCaseReference.value = '';
    bulkStatusDialogError.value = null;
}

async function submitBulkStatusDialog(): Promise<void> {
    if (!canUpdateStatus.value || !bulkStatusDialogTarget.value || selectedUserIds.value.length === 0 || bulkStatusLoading.value) {
        return;
    }

    const reason = bulkStatusDialogTarget.value === 'inactive' ? bulkStatusDialogReason.value.trim() : '';
    const approvalCaseReference = bulkStatusDialogApprovalCaseReference.value.trim();
    if (bulkStatusDialogTarget.value === 'inactive' && reason === '') {
        bulkStatusDialogError.value = 'Reason is required when deactivating users.';

        return;
    }

    bulkStatusLoading.value = true;
    bulkStatusDialogError.value = null;

    try {
        const response = await apiRequest<PlatformUserBulkStatusResponse>('PATCH', '/platform/admin/users/bulk-status', {
            body: {
                userIds: selectedUserIds.value,
                status: bulkStatusDialogTarget.value,
                reason: bulkStatusDialogTarget.value === 'inactive' ? reason : null,
                approvalCaseReference: approvalCaseReference || null,
            },
        });

        const result = response.data;
        for (const updatedUser of result.users ?? []) {
            syncUserInList(updatedUser);
            if (detailsUser.value?.id === updatedUser.id) {
                detailsUser.value = updatedUser;
            }
        }

        const skippedCount = (result.skippedUserIds ?? []).length;
        const targetLabel = bulkStatusDialogTarget.value === 'inactive' ? 'deactivated' : 'activated';
        notifySuccess(`${result.updatedCount ?? 0} users ${targetLabel}${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}.`);
        clearSelectedUsers();
        closeBulkStatusDialog();
        await Promise.all([loadUsers(), loadStatusCounts()]);
    } catch (error) {
        bulkStatusDialogError.value = messageFromUnknown(error, 'Unable to apply bulk status update.');
    } finally {
        bulkStatusLoading.value = false;
    }
}

async function dispatchBulkCredentialLinks(): Promise<void> {
    if (!canResetPassword.value || selectedUserIds.value.length === 0 || bulkActionLoading.value) {
        return;
    }

    bulkCredentialLinksLoading.value = true;
    try {
        const response = await apiRequest<PlatformUserBulkCredentialLinksResponse>('POST', '/platform/admin/users/bulk-credential-links', {
            body: {
                userIds: selectedUserIds.value,
            },
        });

        const result = response.data;
        const skippedCount = (result.skippedUserIds ?? []).length;
        const failedEntries = result.failed ?? [];
        const failedCount = result.failedCount ?? failedEntries.length;
        const failedUserIds = (result.failedUserIds ?? failedEntries.map((entry) => Number(entry.userId)))
            .filter((id) => Number.isInteger(id) && id > 0) as number[];
        const dispatchedCount = result.dispatchedCount ?? 0;
        const credentialMessage = `${dispatchedCount} credential links sent (${result.inviteCount ?? 0} invites, ${result.resetCount ?? 0} resets)` +
                `${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}` +
                `${failedCount > 0 ? `, ${failedCount} failed` : ''}.`;

        if (dispatchedCount > 0) {
            notifySuccess(credentialMessage);
        } else {
            notifyError(credentialMessage);
        }

        if (failedCount > 0) {
            const failureSummary = failedEntries
                .slice(0, 3)
                .map((entry) => `${entry.userId === null ? 'unknown user' : `user #${entry.userId}`}: ${entry.message}`)
                .join(' | ');
            notifyError(`Bulk credential link failures: ${failureSummary}${failedEntries.length > 3 ? ' | ...' : ''}`);
        }

        if (failedUserIds.length > 0) {
            selectedUserIds.value = Array.from(new Set(failedUserIds));
        } else {
            clearSelectedUsers();
        }
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to send bulk credential links.'));
    } finally {
        bulkCredentialLinksLoading.value = false;
    }
}

async function submitBulkRolesDialog(): Promise<void> {
    if (!canManageRoles.value || selectedUserIds.value.length === 0 || bulkRolesLoading.value) {
        return;
    }

    bulkRolesLoading.value = true;
    bulkRolesDialogError.value = null;
    const approvalCaseReference = bulkRolesApprovalCaseReference.value.trim();

    try {
        const response = await apiRequest<PlatformUserBulkRoleSyncResponse>('PATCH', '/platform/admin/users/bulk-roles', {
            body: {
                userIds: selectedUserIds.value,
                roleIds: bulkRoleDraftIds.value,
                approvalCaseReference: approvalCaseReference || null,
            },
        });

        const result = response.data;
        const updates = result.updates ?? [];
        for (const update of updates) {
            const updatedUserId = Number(update.userId);
            if (!Number.isFinite(updatedUserId)) {
                continue;
            }

            const index = users.value.findIndex((entry) => Number(entry.id) === updatedUserId);
            if (index >= 0) {
                users.value[index] = {
                    ...users.value[index],
                    roleIds: update.roleIds ?? [],
                    roles: update.roles ?? [],
                };
            }

            if (Number(detailsUser.value?.id) === updatedUserId && detailsUser.value) {
                detailsUser.value = {
                    ...detailsUser.value,
                    roleIds: update.roleIds ?? [],
                    roles: update.roles ?? [],
                };
                roleDraftIds.value = normalizeRoleIds(detailsUser.value.roleIds ?? []);
            }
        }

        const skippedCount = (result.skippedUserIds ?? []).length;
        notifySuccess(`${result.updatedCount ?? 0} users updated with selected roles${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}.`);

        clearSelectedUsers();
        closeBulkRolesDialog();
        await Promise.all([loadUsers(), loadStatusCounts()]);
    } catch (error) {
        bulkRolesDialogError.value = messageFromUnknown(error, 'Unable to apply bulk role assignment.');
    } finally {
        bulkRolesLoading.value = false;
    }
}

async function submitBulkFacilitiesDialog(): Promise<void> {
    if (!canManageFacilities.value || selectedUserIds.value.length === 0 || bulkFacilitiesLoading.value) {
        return;
    }

    ensureSingleBulkFacilityPrimary();
    bulkFacilitiesLoading.value = true;
    bulkFacilitiesDialogError.value = null;
    const approvalCaseReference = bulkFacilitiesApprovalCaseReference.value.trim();

    try {
        const response = await apiRequest<PlatformUserBulkFacilitiesResponse>('PATCH', '/platform/admin/users/bulk-facilities', {
            body: {
                userIds: selectedUserIds.value,
                facilityAssignments: bulkFacilityDrafts.value.map((entry) => ({
                    facilityId: entry.facilityId,
                    role: entry.role.trim() || null,
                    isPrimary: entry.isPrimary,
                    isActive: entry.isActive,
                })),
                approvalCaseReference: approvalCaseReference || null,
            },
        });

        const result = response.data;
        for (const updatedUser of result.users ?? []) {
            syncUserInList(updatedUser);
            if (detailsUser.value?.id === updatedUser.id) {
                detailsUser.value = updatedUser;
                facilityDrafts.value = toFacilityDrafts(updatedUser.facilityAssignments ?? []);
                ensureSinglePrimary();
            }
        }

        const skippedCount = (result.skippedUserIds ?? []).length;
        notifySuccess(`${result.updatedCount ?? 0} users updated with selected facilities${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}.`);

        clearSelectedUsers();
        closeBulkFacilitiesDialog();
        await Promise.all([loadUsers(), loadStatusCounts()]);
    } catch (error) {
        bulkFacilitiesDialogError.value = messageFromUnknown(error, 'Unable to apply bulk facility assignment.');
    } finally {
        bulkFacilitiesLoading.value = false;
    }
}

async function loadStatusCounts() {
    if (!canRead.value) {
        statusCounts.value = { active: 0, inactive: 0, other: 0, total: 0 };
        return;
    }

    try {
        const response = await apiRequest<PlatformUserStatusCountsResponse>('GET', '/platform/admin/users/status-counts', {
            query: {
                q: searchForm.q.trim() || null,
                verification: searchForm.verification || null,
                roleId: searchForm.roleId || null,
                facilityId: searchForm.facilityId || null,
            },
        });
        statusCounts.value = response.data ?? { active: 0, inactive: 0, other: 0, total: 0 };
    } catch {
        statusCounts.value = { active: 0, inactive: 0, other: 0, total: 0 };
    }
}

async function loadUsers() {
    if (!canRead.value) {
        users.value = [];
        pagination.value = null;
        listLoading.value = false;
        queueReady.value = true;
        return;
    }

    listLoading.value = true;
    listErrors.value = [];
    try {
        const queryFacilityId = scopedFacilityId.value ?? (searchForm.facilityId || null);
        const response = await apiRequest<PlatformUserListResponse>('GET', '/platform/admin/users', {
            query: {
                q: searchForm.q.trim() || null,
                status: searchForm.status || null,
                verification: searchForm.verification || null,
                roleId: searchForm.roleId || null,
                facilityId: queryFacilityId,
                sortBy: searchForm.sortBy,
                sortDir: searchForm.sortDir,
                perPage: searchForm.perPage,
                page: searchForm.page,
            },
        });
        users.value = response.data ?? [];
        pagination.value = response.meta ?? null;
    } catch (error) {
        users.value = [];
        pagination.value = null;
        listErrors.value = [messageFromUnknown(error, 'Unable to load users.')];
    } finally {
        listLoading.value = false;
        queueReady.value = true;
    }
}

async function loadRoles() {
    if (!canReadRoles.value && !canManageRoles.value) {
        roles.value = [];
        roleAssignmentPolicy.value = 'full';
        return;
    }

    try {
        const response = await apiRequest<PlatformRoleListResponse>('GET', '/platform/admin/roles', {
            query: { page: 1, perPage: 100, sortBy: 'name', sortDir: 'asc' },
        });
        const allRoles = (response.data ?? []).filter((entry) => entry.id !== null);
        if (scopedFacilityId.value) {
            roles.value = allRoles.filter(
                (role) => !role.facilityId || role.facilityId === scopedFacilityId.value,
            );
        } else {
            roles.value = allRoles;
        }
        roleAssignmentPolicy.value = response.meta?.roleAssignmentPolicy === 'hospital_operational' ? 'hospital_operational' : 'full';
    } catch {
        roles.value = [];
        roleAssignmentPolicy.value = 'full';
    }
}

async function refreshPage() {
    clearSearchDebounce();
    await Promise.all([loadUsers(), loadStatusCounts()]);
    void loadRoles();
}

async function bootstrapPage() {
    pageLoading.value = true;
    try {
        await refreshPage();
    } finally {
        pageLoading.value = false;
    }
}

function submitSearch() {
    clearSearchDebounce();
    searchForm.page = 1;
    void Promise.all([loadUsers(), loadStatusCounts()]);
}

function submitSearchFromFiltersSheet() {
    submitSearch();
    userFiltersSheetOpen.value = false;
}

function toggleColumnSort(field: string) {
    if (searchForm.sortBy === field) {
        searchForm.sortDir = searchForm.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        searchForm.sortBy = field;
        searchForm.sortDir = field === 'name' ? 'asc' : 'desc';
    }
    submitSearch();
}

function goToPage(page: number) {
    clearSearchDebounce();
    searchForm.page = page;
    void loadUsers();
}

function removeFilterChip(key: string) {
    clearSearchDebounce();
    switch (key) {
        case 'q':
            searchForm.q = '';
            break;
        case 'status':
            searchForm.status = '';
            break;
        case 'verification':
            searchForm.verification = '';
            break;
        case 'roleId':
            searchForm.roleId = '';
            break;
        case 'facilityId':
            searchForm.facilityId = '';
            break;
        case 'sort':
            searchForm.sortBy = 'name';
            searchForm.sortDir = 'asc';
            break;
        case 'perPage':
            searchForm.perPage = 12;
            break;
    }
    searchForm.page = 1;
    void Promise.all([loadUsers(), loadStatusCounts()]);
}

function resetFilters() {
    clearSearchDebounce();
    searchForm.q = '';
    searchForm.status = '';
    searchForm.verification = '';
    searchForm.roleId = '';
    searchForm.facilityId = '';
    searchForm.sortBy = 'name';
    searchForm.sortDir = 'asc';
    searchForm.perPage = 12;
    searchForm.page = 1;
    showAdvancedFilters.value = false;
    compactQueueRows.value = false;
    void Promise.all([loadUsers(), loadStatusCounts()]);
}

function resetFiltersFromFiltersSheet() {
    resetFilters();
    userFiltersSheetOpen.value = false;
}

function updateCreateSendInvite(checked: CheckboxCheckedState): void {
    createSendInvite.value = checked === true;
}

function prevPage() {
    if (!pagination.value || pagination.value.currentPage <= 1) return;
    searchForm.page -= 1;
    void loadUsers();
}

function nextPage() {
    if (!pagination.value || pagination.value.currentPage >= pagination.value.lastPage) return;
    searchForm.page += 1;
    void loadUsers();
}

async function createUser() {
    if (!canCreate.value || createLoading.value) return;
    createLoading.value = true;
    createErrors.value = {};

    let successMessage: string | null = null;
    let previewUrl: string | null = null;

    try {
        const response = await apiRequest<PlatformUserResponse>('POST', '/platform/admin/users', {
            body: { name: createForm.name.trim(), email: createForm.email.trim() },
        });
        const createdUserId = Number(response.data.id);
        const canSendInviteNow =
            canResetPassword.value &&
            createSendInvite.value &&
            Number.isFinite(createdUserId);

        if (canSendInviteNow) {
            try {
                const inviteResponse = await apiRequest<PlatformUserCredentialLinkResponse>('POST', `/platform/admin/users/${createdUserId}/invite-link`);
                successMessage = platformMailDeliversExternally.value
                    ? `User ${response.data.email ?? createForm.email} created and invite link sent.`
                    : inviteResponse.data.previewUrl
                        ? `User ${response.data.email ?? createForm.email} created and invite link generated for local preview.`
                        : `User ${response.data.email ?? createForm.email} created and invite link generated, but email delivery is not external.`;
                previewUrl = inviteResponse.data.previewUrl ?? null;
            } catch {
                successMessage = `User ${response.data.email ?? createForm.email} created. Invite dispatch failed; retry from queue actions.`;
            }
        } else {
            successMessage = `User ${response.data.email ?? createForm.email} created successfully.`;
        }

        notifySuccess(successMessage);
        closeCreateUserDialog();
        searchForm.page = 1;
        await Promise.all([loadUsers(), loadStatusCounts()]);
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) createErrors.value = apiError.payload.errors;
        else notifyError(messageFromUnknown(error, 'Unable to create user.'));
    } finally {
        createLoading.value = false;
    }
}
function openStatusDialog(user: PlatformUser, target: 'active' | 'inactive') {
    statusDialogUser.value = user;
    statusDialogTarget.value = target;
    statusDialogReason.value = target === 'inactive' ? (user.statusReason ?? '') : '';
    statusDialogApprovalCaseReference.value = '';
    statusDialogError.value = null;
    statusDialogOpen.value = true;
}

function closeStatusDialog() {
    statusDialogOpen.value = false;
    statusDialogUser.value = null;
    statusDialogTarget.value = null;
    statusDialogReason.value = '';
    statusDialogApprovalCaseReference.value = '';
    statusDialogError.value = null;
}

const statusDialogTitle = computed(() => (statusDialogTarget.value === 'inactive' ? 'Deactivate User' : 'Activate User'));
const statusDialogDescription = computed(() =>
    statusDialogTarget.value === 'inactive' ? 'Deactivation reason is required for audit traceability.' : 'Confirm user re-activation.',
);

async function submitStatusDialog() {
    const userId = Number(statusDialogUser.value?.id);
    if (!Number.isFinite(userId) || !statusDialogTarget.value || !canUpdateStatus.value) return;

    const reason = statusDialogTarget.value === 'inactive' ? statusDialogReason.value.trim() : '';
    const approvalCaseReference = statusDialogApprovalCaseReference.value.trim();
    if (statusDialogTarget.value === 'inactive' && !reason) {
        statusDialogError.value = 'Reason is required when deactivating a user.';
        return;
    }

    actionLoadingId.value = userId;
    statusDialogError.value = null;
    try {
        const response = await apiRequest<PlatformUserResponse>('PATCH', `/platform/admin/users/${userId}/status`, {
            body: {
                status: statusDialogTarget.value,
                reason: statusDialogTarget.value === 'inactive' ? reason : null,
                approvalCaseReference: approvalCaseReference || null,
            },
        });
        syncUserInList(response.data);
        if (detailsUser.value?.id === response.data.id) detailsUser.value = response.data;
        notifySuccess(`User ${response.data.email ?? `#${response.data.id ?? ''}`} updated to ${statusDialogTarget.value}.`);
        void loadStatusCounts();
        closeStatusDialog();
    } catch (error) {
        statusDialogError.value = messageFromUnknown(error, 'Unable to update user status.');
    } finally {
        actionLoadingId.value = null;
    }
}
async function sendCredentialLink(user: PlatformUser) {
    const userId = Number(user.id);
    if (!Number.isFinite(userId) || !canResetPassword.value || actionLoadingId.value !== null) return;
    const inviteAction = isInviteAction(user);
    const endpoint = inviteAction ? 'invite-link' : 'password-reset-link';
    actionLoadingId.value = userId;
    try {
        const response = await apiRequest<PlatformUserCredentialLinkResponse>('POST', `/platform/admin/users/${userId}/${endpoint}`);
        notifySuccess(credentialLinkSuccessMessage(user));
    } catch (error) {
        notifyError(messageFromUnknown(error, `Unable to send ${inviteAction ? 'invitation' : 'reset'} link.`));
    } finally {
        actionLoadingId.value = null;
    }
}

function openApprovalCases(user: PlatformUser): void {
    const userId = Number(user.id);
    if (!Number.isFinite(userId) || userId <= 0) return;
    window.location.assign(`/platform/admin/user-approval-cases?targetUserId=${userId}`);
}

function openCreateStaffProfile(user: PlatformUser): void {
    const userId = Number(user.id);
    if (!Number.isFinite(userId) || userId <= 0 || !canCreateLinkedStaffProfile.value) return;

    const url = new URL('/staff', window.location.origin);
    url.searchParams.set('createUserId', String(userId));
    window.location.assign(`${url.pathname}${url.search}`);
}

async function openEditDialog(user: PlatformUser) {
    const userId = Number(user.id);
    if (!Number.isFinite(userId) || !canUpdate.value) return;

    editDialogUserId.value = userId;
    // Seed from whatever data we have now (may be incomplete from list endpoint)
    editDialogRequiresApprovalCase.value = Boolean(user.requiresApprovalCaseForSensitiveChanges);
    editDialogApprovalCaseReference.value = '';
    editForm.name = (user.name ?? '').trim();
    editForm.email = (user.email ?? '').trim();
    editErrors.value = {};
    editDialogError.value = null;
    editDialogOpen.value = true;

    // If requiresApprovalCaseForSensitiveChanges is missing (list endpoint omits it),
    // fetch the full user record so the approval-case field shows correctly upfront.
    if (!user.requiresApprovalCaseForSensitiveChanges) {
        editDialogFetching.value = true;
        try {
            const response = await apiRequest<PlatformUserResponse>('GET', `/platform/admin/users/${userId}`);
            // Only apply if the dialog is still open for the same user
            if (editDialogUserId.value === userId) {
                editDialogRequiresApprovalCase.value = Boolean(response.data.requiresApprovalCaseForSensitiveChanges);
                // Keep name/email in sync with authoritative data
                editForm.name = (response.data.name ?? editForm.name).trim();
                editForm.email = (response.data.email ?? editForm.email).trim();
            }
        } catch {
            // Non-fatal: dialog remains usable; approval case will reveal on 422 if needed
        } finally {
            if (editDialogUserId.value === userId) {
                editDialogFetching.value = false;
            }
        }
    }
}

function closeEditDialog() {
    editDialogOpen.value = false;
    editDialogLoading.value = false;
    editDialogFetching.value = false;
    editDialogUserId.value = null;
    editDialogRequiresApprovalCase.value = false;
    editDialogApprovalCaseReference.value = '';
    editForm.name = '';
    editForm.email = '';
    editErrors.value = {};
    editDialogError.value = null;
}

async function submitEditDialog() {
    const userId = editDialogUserId.value;
    if (!Number.isFinite(userId) || !canUpdate.value || editDialogLoading.value) return;

    editDialogLoading.value = true;
    editErrors.value = {};
    editDialogError.value = null;
    try {
        const response = await apiRequest<PlatformUserResponse>('PATCH', `/platform/admin/users/${userId}`, {
            body: {
                name: editForm.name.trim(),
                email: editForm.email.trim(),
                approvalCaseReference: editDialogApprovalCaseReference.value.trim() || null,
            },
        });

        syncUserInList(response.data);
        if (detailsUser.value?.id === response.data.id) {
            detailsUser.value = response.data;
        }

        notifySuccess(`User ${response.data.email ?? `#${response.data.id ?? ''}`} profile updated.`);
        closeEditDialog();
        void Promise.all([loadUsers(), loadStatusCounts()]);
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            editErrors.value = apiError.payload.errors;
            // If the backend requires an approval case reference (privileged user),
            // reveal the field even if it wasn't shown initially (e.g. opened from list).
            if (apiError.payload.errors['approvalCaseReference']) {
                editDialogRequiresApprovalCase.value = true;
            }
            return;
        }

        editDialogError.value = messageFromUnknown(error, 'Unable to update user profile.');
    } finally {
        editDialogLoading.value = false;
    }
}

function toFacilityDrafts(assignments: PlatformUserFacilityAssignment[]): FacilityAssignmentDraft[] {
    return (assignments ?? [])
        .map((assignment): FacilityAssignmentDraft | null => {
            const facilityId = String(assignment.facilityId ?? '').trim();
            if (!facilityId) return null;
            return {
                facilityId,
                role: String(assignment.role ?? ''),
                isPrimary: Boolean(assignment.isPrimary),
                isActive: assignment.isActive === undefined ? true : Boolean(assignment.isActive),
            };
        })
        .filter((entry): entry is FacilityAssignmentDraft => entry !== null);
}

function ensureSinglePrimary() {
    const primaries = facilityDrafts.value.filter((entry) => entry.isPrimary);
    if (facilityDrafts.value.length > 0 && primaries.length === 0) facilityDrafts.value[0].isPrimary = true;
    if (primaries.length > 1) {
        let first = true;
        facilityDrafts.value = facilityDrafts.value.map((entry) => {
            if (!entry.isPrimary) return entry;
            if (first) {
                first = false;
                return entry;
            }
            return { ...entry, isPrimary: false };
        });
    }
}

function setPrimaryFacility(facilityId: string) {
    facilityDrafts.value = facilityDrafts.value.map((entry) => ({ ...entry, isPrimary: entry.facilityId === facilityId }));
}

function addFacilityDraft() {
    const facilityId = newFacilityDraftId.value.trim();
    if (!facilityId) return;
    if (facilityDrafts.value.some((entry) => entry.facilityId === facilityId)) return;
    facilityDrafts.value.push({ facilityId, role: '', isPrimary: facilityDrafts.value.length === 0, isActive: true });
    newFacilityDraftId.value = '';
    ensureSinglePrimary();
}

function removeFacilityDraft(facilityId: string) {
    facilityDrafts.value = facilityDrafts.value.filter((entry) => entry.facilityId !== facilityId);
    ensureSinglePrimary();
}

function facilityLabel(facilityId: string): string {
    const facility = availableFacilities.value.find((entry) => String(entry.id ?? '') === facilityId);
    if (!facility) return facilityId;
    return `${facility.code ?? 'FAC'} - ${facility.name ?? 'Facility'}`;
}

async function loadDetailsAudit(userId: number) {
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
        const response = await apiRequest<PlatformUserAuditLogListResponse>('GET', `/platform/admin/users/${userId}/audit-logs`, {
            query: {
                q: detailsAuditFilters.q.trim() || null,
                action: detailsAuditFilters.action.trim() || null,
                actorType: detailsAuditFilters.actorType || null,
                actorId: detailsAuditFilters.actorId.trim() || null,
                from: detailsAuditFilters.from || null,
                to: detailsAuditFilters.to || null,
                page: detailsAuditFilters.page,
                perPage: detailsAuditFilters.perPage,
            },
        });
        detailsAuditLogs.value = response.data ?? [];
        detailsAuditMeta.value = response.meta ?? null;
    } catch (error) {
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
        detailsAuditError.value = messageFromUnknown(error, 'Unable to load user audit logs.');
    } finally {
        detailsAuditLoading.value = false;
    }
}

function applyDetailsAuditFilters() {
    const userId = Number(detailsUser.value?.id);
    if (!Number.isFinite(userId)) return;
    detailsAuditFilters.page = 1;
    void loadDetailsAudit(userId);
}

function resetDetailsAuditFilters() {
    const userId = Number(detailsUser.value?.id);
    if (!Number.isFinite(userId)) return;
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    void loadDetailsAudit(userId);
}

function prevDetailsAuditPage() {
    const userId = Number(detailsUser.value?.id);
    if (!Number.isFinite(userId)) return;
    if ((detailsAuditMeta.value?.currentPage ?? 1) <= 1) return;
    detailsAuditFilters.page -= 1;
    void loadDetailsAudit(userId);
}

function nextDetailsAuditPage() {
    const userId = Number(detailsUser.value?.id);
    if (!Number.isFinite(userId)) return;
    if (!detailsAuditMeta.value || detailsAuditMeta.value.currentPage >= detailsAuditMeta.value.lastPage) return;
    detailsAuditFilters.page += 1;
    void loadDetailsAudit(userId);
}

function exportDetailsAuditLogs() {
    const userId = Number(detailsUser.value?.id);
    if (!Number.isFinite(userId) || detailsAuditExporting.value) return;

    const url = new URL(`/api/v1/platform/admin/users/${userId}/audit-logs/export`, window.location.origin);
    const query: Record<string, string> = {
        q: detailsAuditFilters.q.trim(),
        action: detailsAuditFilters.action.trim(),
        actorType: detailsAuditFilters.actorType,
        actorId: detailsAuditFilters.actorId.trim(),
        from: detailsAuditFilters.from,
        to: detailsAuditFilters.to,
    };
    Object.entries(query).forEach(([key, value]) => {
        if (!value) return;
        url.searchParams.set(key, value);
    });

    detailsAuditExporting.value = true;
    window.open(url.toString(), '_blank', 'noopener');
    window.setTimeout(() => {
        detailsAuditExporting.value = false;
    }, 600);
}

function seedDetailsUserFromList(user: PlatformUser): void {
    detailsUser.value = user;
    roleDraftIds.value = normalizeRoleIds(user.roleIds ?? []);
    facilityDrafts.value = toFacilityDrafts(user.facilityAssignments ?? []);
    ensureSinglePrimary();
    newFacilityDraftId.value = '';
    saveRolesApprovalCaseReference.value = '';
    saveFacilitiesApprovalCaseReference.value = '';
    saveRolesError.value = null;
    saveFacilitiesError.value = null;
}

async function openDetails(user: PlatformUser) {
    const userId = Number(user.id);
    if (!Number.isFinite(userId)) return;

    detailsOpen.value = true;
    detailsSheetTab.value = 'overview';
    detailsAuditFiltersOpen.value = false;
    seedDetailsUserFromList(user);
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

    detailsLoading.value = true;
    try {
        const response = await apiRequest<PlatformUserResponse>('GET', `/platform/admin/users/${userId}`);
        detailsUser.value = response.data;
        roleDraftIds.value = normalizeRoleIds(response.data.roleIds ?? []);
        facilityDrafts.value = toFacilityDrafts(response.data.facilityAssignments ?? []);
        ensureSinglePrimary();
        newFacilityDraftId.value = '';
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to refresh user details.'));
    } finally {
        detailsLoading.value = false;
    }
}

async function openDetailsById(userId: number) {
    if (!Number.isFinite(userId)) return;

    detailsOpen.value = true;
    detailsLoading.value = true;
    detailsSheetTab.value = 'overview';
    detailsAuditFiltersOpen.value = false;
    detailsUser.value = null;
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

    try {
        const response = await apiRequest<PlatformUserResponse>('GET', `/platform/admin/users/${userId}`);
        detailsUser.value = response.data;
        roleDraftIds.value = normalizeRoleIds(response.data.roleIds ?? []);
        facilityDrafts.value = toFacilityDrafts(response.data.facilityAssignments ?? []);
        ensureSinglePrimary();
        newFacilityDraftId.value = '';
        saveRolesApprovalCaseReference.value = '';
        saveFacilitiesApprovalCaseReference.value = '';
        saveRolesError.value = null;
        saveFacilitiesError.value = null;
    } catch (error) {
        detailsUser.value = null;
        notifyError(messageFromUnknown(error, 'Unable to load user details.'));
    } finally {
        detailsLoading.value = false;
    }
}

function consumeOpenUserIdFromQuery(): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (!url.searchParams.has('openUserId')) return;
    url.searchParams.delete('openUserId');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function closeDetails() {
    detailsOpen.value = false;
    closeEditDialog();
    detailsUser.value = null;
    roleDraftIds.value = [];
    facilityDrafts.value = [];
    newFacilityDraftId.value = '';
    saveRolesApprovalCaseReference.value = '';
    saveFacilitiesApprovalCaseReference.value = '';
    saveRolesError.value = null;
    saveFacilitiesError.value = null;
    detailsAuditLogs.value = [];
    detailsAuditMeta.value = null;
    detailsAuditError.value = null;
}

function toggleRole(roleId: string) {
    if (roleDraftIds.value.includes(roleId)) roleDraftIds.value = roleDraftIds.value.filter((value) => value !== roleId);
    else roleDraftIds.value = [...roleDraftIds.value, roleId];
}

function updateRoleSelection(roleId: string, checked: CheckboxCheckedState): void {
    const nextChecked = checked === true;
    const currentlyChecked = roleDraftIds.value.includes(roleId);
    if (nextChecked === currentlyChecked) return;
    toggleRole(roleId);
}

async function saveRoles() {
    const userId = Number(detailsUser.value?.id);
    if (!Number.isFinite(userId) || !canManageRoles.value || saveRolesLoading.value) return;
    saveRolesLoading.value = true;
    saveRolesError.value = null;
    const approvalCaseReference = saveRolesApprovalCaseReference.value.trim();
    try {
        const response = await apiRequest<PlatformUserRoleSyncResponse>('PATCH', `/platform/admin/users/${userId}/roles`, {
            body: {
                roleIds: roleDraftIds.value,
                approvalCaseReference: approvalCaseReference || null,
            },
        });
        if (detailsUser.value) {
            detailsUser.value.roleIds = response.data.roleIds ?? [];
            detailsUser.value.roles = response.data.roles ?? [];
            syncUserInList(detailsUser.value);
        }
        notifySuccess('Role assignments updated.');
    } catch (error) {
        saveRolesError.value = firstValidationError((error as Error & { payload?: ValidationErrorResponse }).payload, [
            'approvalCaseReference',
            'roleIds',
        ]) ?? messageFromUnknown(error, 'Unable to save roles.');
        notifyError(saveRolesError.value);
    } finally {
        saveRolesLoading.value = false;
    }
}

async function saveFacilities() {
    const userId = Number(detailsUser.value?.id);
    if (!Number.isFinite(userId) || !canManageFacilities.value || saveFacilitiesLoading.value) return;
    ensureSinglePrimary();
    saveFacilitiesLoading.value = true;
    saveFacilitiesError.value = null;
    const approvalCaseReference = saveFacilitiesApprovalCaseReference.value.trim();
    try {
        const response = await apiRequest<PlatformUserResponse>('PATCH', `/platform/admin/users/${userId}/facilities`, {
            body: {
                facilityAssignments: facilityDrafts.value.map((entry) => ({
                    facilityId: entry.facilityId,
                    role: entry.role.trim() || null,
                    isPrimary: entry.isPrimary,
                    isActive: entry.isActive,
                })),
                approvalCaseReference: approvalCaseReference || null,
            },
        });
        detailsUser.value = response.data;
        facilityDrafts.value = toFacilityDrafts(response.data.facilityAssignments ?? []);
        ensureSinglePrimary();
        syncUserInList(response.data);
        notifySuccess('Facility assignments updated.');
    } catch (error) {
        saveFacilitiesError.value = firstValidationError((error as Error & { payload?: ValidationErrorResponse }).payload, [
            'approvalCaseReference',
            'facilityAssignments',
        ]) ?? messageFromUnknown(error, 'Unable to save facilities.');
        notifyError(saveFacilitiesError.value);
    } finally {
        saveFacilitiesLoading.value = false;
    }
}

function clearSearchDebounce() {
    if (searchDebounceTimer !== null) {
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
    }
}

watch(() => searchForm.q, () => {
    clearSearchDebounce();
    searchDebounceTimer = window.setTimeout(() => {
        searchForm.page = 1;
        void Promise.all([loadUsers(), loadStatusCounts()]);
        searchDebounceTimer = null;
    }, 300);
});

watch(() => [searchForm.status, searchForm.verification, searchForm.roleId, searchForm.facilityId, searchForm.sortBy, searchForm.sortDir, searchForm.perPage], () => {
    searchForm.page = 1;
    void Promise.all([loadUsers(), loadStatusCounts()]);
});

watch(pageUserIds, () => {
    const visible = new Set(pageUserIds.value);
    selectedUserIds.value = selectedUserIds.value.filter((id) => visible.has(id));
});

watch(
    () => [scope.value?.facility?.code ?? null, scope.value?.tenant?.code ?? null] as const,
    async (next, prev) => {
        if (!queueReady.value || prev === undefined) return;
        const [nextFacility, nextTenant] = next;
        const [prevFacility, prevTenant] = prev;
        if (nextFacility === prevFacility && nextTenant === prevTenant) return;

        searchForm.page = 1;
        await Promise.all([loadUsers(), loadStatusCounts()]);
        void loadRoles();
    },
);

watch(
    () => detailsSheetTab.value,
    (tab) => {
        const userId = Number(detailsUser.value?.id);
        if (!Number.isFinite(userId)) return;

        if (
            tab === 'audit' &&
            canViewAudit.value &&
            !detailsAuditLoading.value &&
            detailsAuditMeta.value === null &&
            detailsAuditLogs.value.length === 0
        ) {
            void loadDetailsAudit(userId);
        }
    },
);

onBeforeUnmount(clearSearchDebounce);
onMounted(async () => {
    await bootstrapPage();

    if (canRead.value && initialOpenUserId !== null) {
        await openDetailsById(initialOpenUserId);
        consumeOpenUserIdFromQuery();
    }
});
</script>

<template>
    <Head :title="usersWorkspaceTitle" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-3 md:p-5 lg:p-6">

            <!-- Page header -->
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="users" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <h1 class="text-base font-semibold tracking-tight md:text-lg">
                                {{ usersWorkspaceTitle }}
                            </h1>
                            <p class="truncate text-xs text-muted-foreground">
                                {{ usersWorkspaceDescription }}
                            </p>
                            <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground">
                                <span class="inline-flex items-center gap-1">
                                    <AppIcon name="building-2" class="size-3 opacity-75" aria-hidden="true" />
                                    <span class="font-medium text-foreground">{{ scope?.facility?.name || scopedFacilityLabel || 'No facility' }}</span>
                                </span>
                                <span class="text-border select-none" aria-hidden="true">·</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <Button
                            v-if="canReadApprovalCases"
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5"
                            as-child
                        >
                            <Link href="/platform/admin/user-approval-cases">
                                <AppIcon name="clipboard-list" class="size-3.5" />
                                Approval Cases
                            </Link>
                        </Button>
                        <Button variant="outline" size="sm" :disabled="listLoading" class="h-8 gap-1.5" @click="refreshPage">
                            <AppIcon name="activity" class="size-3.5" />
                            {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                        </Button>
                        <Button v-if="canCreate" size="sm" class="h-8 gap-1.5" @click="openCreateUserDialog">
                            <AppIcon name="plus" class="size-3.5" />
                            Create User
                        </Button>
                    </div>
                </div>
            </section>

            <Alert
                v-if="platformMailWarning"
                class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
            >
                <AlertTitle>Mail delivery not configured</AlertTitle>
                <AlertDescription>
                    {{ platformMailWarning }}
                    <span v-if="platformMail?.defaultMailer"> Current mailer: <code>{{ platformMail.defaultMailer }}</code>.</span>
                    <span v-if="platformMailSupportsCredentialLinkPreview"> Local credential-link preview is available after sending an invite or reset link.</span>
                </AlertDescription>
            </Alert>

            <template v-if="!permissionsResolved">
                <Card class="border-sidebar-border/70">
                    <CardContent class="space-y-2 py-4">
                        <Skeleton class="h-5 w-40" />
                        <Skeleton class="h-10 w-full" />
                        <Skeleton class="h-10 w-full" />
                    </CardContent>
                </Card>
            </template>
            <Alert v-else-if="!canRead" variant="destructive">
                <AlertTitle>User access restricted</AlertTitle>
                <AlertDescription>Request <code>platform.users.read</code> permission.</AlertDescription>
            </Alert>

            <template v-else>
                <Card class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70">
                    <div class="flex flex-col gap-3 border-b px-4 py-3">
                        <div class="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                                :class="{ 'border-primary bg-primary/5': searchForm.status === 'active' }"
                                @click="searchForm.status = 'active'"
                            >
                                <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                <template v-if="!queueReady">
                                    <Skeleton class="h-3.5 w-6" />
                                    <Skeleton class="h-3.5 w-10" />
                                </template>
                                <template v-else>
                                    <span class="font-medium">{{ statusCounts.active }}</span>
                                    <span class="text-muted-foreground">Active</span>
                                </template>
                            </button>
                            <button
                                type="button"
                                class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                                :class="{ 'border-primary bg-primary/5': searchForm.status === 'inactive' }"
                                @click="searchForm.status = 'inactive'"
                            >
                                <span class="inline-block h-2 w-2 rounded-full bg-rose-500" />
                                <template v-if="!queueReady">
                                    <Skeleton class="h-3.5 w-6" />
                                    <Skeleton class="h-3.5 w-12" />
                                </template>
                                <template v-else>
                                    <span class="font-medium">{{ statusCounts.inactive }}</span>
                                    <span class="text-muted-foreground">Inactive</span>
                                </template>
                            </button>
                            <button
                                type="button"
                                class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                                :class="{ 'border-primary bg-primary/5': searchForm.status === '' }"
                                @click="searchForm.status = ''"
                            >
                                <span class="inline-block h-2 w-2 rounded-full bg-slate-400" />
                                <template v-if="!queueReady">
                                    <Skeleton class="h-3.5 w-6" />
                                    <Skeleton class="h-3.5 w-6" />
                                </template>
                                <template v-else>
                                    <span class="font-medium">{{ statusCounts.total }}</span>
                                    <span class="text-muted-foreground">All</span>
                                </template>
                            </button>
                            <div class="ml-auto flex items-center gap-2">
                                <Badge variant="secondary" class="hidden sm:inline-flex">
                                    {{ pagination?.total ?? 0 }} users
                                </Badge>
                                <Button
                                    v-if="hasActiveUserFilters"
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
                        <div class="flex flex-wrap items-center gap-2">
                            <div class="relative min-w-0 flex-1">
                                <AppIcon
                                    name="search"
                                    class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                                />
                                <Input
                                    id="user-search-q"
                                    v-model="searchForm.q"
                                    placeholder="Search name, email, role, or facility…"
                                    class="h-8 pl-9 text-sm"
                                    @keyup.enter="submitSearch"
                                />
                            </div>
                            <Button variant="outline" size="sm" class="h-8 gap-1.5" @click="userFiltersSheetOpen = true">
                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                Filters
                                <Badge
                                    v-if="filterBadgeCount > 0"
                                    variant="secondary"
                                    class="ml-1 h-5 px-1.5 text-[10px]"
                                >
                                    {{ filterBadgeCount }}
                                </Badge>
                            </Button>
                        </div>
                        <div v-if="userFilterChips.length > 0" class="flex flex-wrap gap-1.5">
                            <button
                                v-for="chip in userFilterChips"
                                :key="chip.key"
                                type="button"
                                class="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                                @click="removeFilterChip(chip.key)"
                            >
                                {{ chip.label }}
                                <AppIcon name="x" class="size-3 text-muted-foreground" />
                            </button>
                        </div>
                    </div>
                        <div v-if="canUseBulkSelection" class="border-b bg-muted/20 px-4 py-2.5">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <label class="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Checkbox
                                        id="users-select-page"
                                        :model-value="allVisibleUsersSelected"
                                        :disabled="pageUserIds.length === 0 || bulkActionLoading"
                                        @update:model-value="updateSelectAllVisibleUsers"
                                    />
                                    Select page
                                </label>
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="text-xs text-muted-foreground">{{ selectedCount }} selected</span>
                                    <Button
                                        v-if="canResetPassword"
                                        size="sm"
                                        variant="outline"
                                        :disabled="selectedCount === 0 || bulkActionLoading"
                                        @click="dispatchBulkCredentialLinks"
                                    >
                                        {{ bulkCredentialLinksLoading ? 'Sending...' : 'Send links' }}
                                    </Button>
                                    <Button
                                        v-if="canManageRoles"
                                        size="sm"
                                        variant="outline"
                                        :disabled="selectedCount === 0 || bulkActionLoading"
                                        @click="openBulkRolesDialog"
                                    >
                                        {{ bulkRolesLoading ? 'Applying...' : 'Assign roles' }}
                                    </Button>
                                    <Button
                                        v-if="canManageFacilities"
                                        size="sm"
                                        variant="outline"
                                        :disabled="selectedCount === 0 || bulkActionLoading"
                                        @click="openBulkFacilitiesDialog"
                                    >
                                        {{ bulkFacilitiesLoading ? 'Applying...' : 'Assign facilities' }}
                                    </Button>
                                    <Button
                                        v-if="canUpdateStatus"
                                        size="sm"
                                        variant="secondary"
                                        :disabled="selectedCount === 0 || bulkActionLoading"
                                        @click="openBulkStatusDialog('active')"
                                    >
                                        Activate selected
                                    </Button>
                                    <Button
                                        v-if="canUpdateStatus"
                                        size="sm"
                                        variant="destructive"
                                        :disabled="selectedCount === 0 || bulkActionLoading"
                                        @click="openBulkStatusDialog('inactive')"
                                    >
                                        Deactivate selected
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        :disabled="selectedCount === 0 || bulkActionLoading"
                                        @click="clearSelectedUsers"
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </div>
                        </div>
                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden px-0 pb-0">
                        <div v-if="scopeUnresolved || listErrors.length" class="space-y-2 px-4 pt-3">
                            <Alert v-if="scopeUnresolved" variant="destructive" class="py-2">
                                <AppIcon name="alert-triangle" class="size-4" />
                                <AlertTitle class="text-xs font-medium">Scope warning</AlertTitle>
                                <AlertDescription class="text-xs">
                                    No tenant/facility scope is resolved. User create/search may be blocked by tenant isolation controls.
                                </AlertDescription>
                            </Alert>
                            <Alert v-if="listErrors.length" variant="destructive" class="py-2">
                                <AppIcon name="circle-x" class="size-4" />
                                <AlertTitle class="text-xs font-medium">Request error</AlertTitle>
                                <AlertDescription class="text-xs">
                                    <p v-for="errorMessage in listErrors" :key="errorMessage">{{ errorMessage }}</p>
                                </AlertDescription>
                            </Alert>
                        </div>
                        <div
                            class="hidden shrink-0 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,auto)] md:items-center md:gap-3"
                        >
                            <button
                                type="button"
                                class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                                @click="toggleColumnSort('name')"
                            >
                                User
                                <AppIcon
                                    :name="
                                        searchForm.sortBy === 'name'
                                            ? searchForm.sortDir === 'asc'
                                                ? 'chevron-up'
                                                : 'chevron-down'
                                            : 'chevrons-up-down'
                                    "
                                    class="size-3.5"
                                />
                            </button>
                            <button
                                type="button"
                                class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                                @click="toggleColumnSort('status')"
                            >
                                Status
                                <AppIcon
                                    :name="
                                        searchForm.sortBy === 'status'
                                            ? searchForm.sortDir === 'asc'
                                                ? 'chevron-up'
                                                : 'chevron-down'
                                            : 'chevrons-up-down'
                                    "
                                    class="size-3.5"
                                />
                            </button>
                            <span>Verification</span>
                            <span>Roles</span>
                            <span class="text-right">Actions</span>
                        </div>
                        <ScrollArea class="min-h-0 flex-1">
                            <div v-if="!queueReady || listLoading" class="space-y-0 divide-y">
                                <div v-for="index in 5" :key="`platform-user-skeleton-${index}`" class="flex items-center gap-4 px-4 py-3">
                                    <Skeleton v-if="canUseBulkSelection" class="h-4 w-4 rounded-sm" />
                                    <Skeleton class="h-9 w-9 rounded-full" />
                                    <div class="flex-1 space-y-2">
                                        <Skeleton class="h-4 w-1/3" />
                                        <Skeleton class="h-3 w-1/5" />
                                    </div>
                                </div>
                            </div>
                            <div v-else-if="users.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
                                <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                    <AppIcon name="users" class="size-6 text-muted-foreground" />
                                </div>
                                <p class="text-sm font-medium">No users found</p>
                                <p class="mt-1 max-w-sm text-xs text-muted-foreground">
                                    Try adjusting your search or filters, or create a new user account.
                                </p>
                                <Button v-if="canCreate" size="sm" variant="outline" class="mt-4 gap-1.5" @click="openCreateUserDialog">
                                    <AppIcon name="plus" class="size-3.5" />
                                    Create User
                                </Button>
                            </div>
                            <div v-else class="divide-y">
                                <div
                                    v-for="user in users"
                                    :key="String(user.id ?? user.email)"
                                    class="group grid items-center gap-3 px-4 transition-colors hover:bg-muted/30 md:grid-cols-[minmax(0,2.4fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,auto)]"
                                    :class="[
                                        compactQueueRows ? 'py-2' : 'py-3',
                                        detailsOpen && detailsUser?.id === user.id ? 'bg-primary/5' : '',
                                        canUseBulkSelection && user.id !== null && selectedUserIds.includes(Number(user.id)) ? 'bg-muted/20' : '',
                                    ]"
                                >
                                    <div class="flex min-w-0 items-center gap-3">
                                        <Checkbox
                                            v-if="canUseBulkSelection && user.id !== null"
                                            :id="`user-select-${user.id}`"
                                            :model-value="selectedUserIds.includes(Number(user.id))"
                                            :disabled="bulkActionLoading"
                                            @update:model-value="updateUserSelection(Number(user.id), $event)"
                                        />
                                        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                            {{ userInitials(user) }}
                                        </div>
                                        <div class="min-w-0">
                                            <button
                                                class="truncate text-sm font-medium hover:text-primary hover:underline"
                                                @click="openDetails(user)"
                                            >
                                                {{ user.name || 'Unnamed user' }}
                                            </button>
                                            <p class="truncate text-xs text-muted-foreground">{{ user.email || 'No email address' }}</p>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-xs text-muted-foreground md:hidden">Status:</span>
                                        <Badge :variant="statusVariant(user.status)" class="text-xs leading-none">
                                            {{ user.status || 'unknown' }}
                                        </Badge>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-xs text-muted-foreground md:hidden">Verification:</span>
                                        <Badge :variant="verificationVariant(user)" class="text-xs leading-none">
                                            {{ verificationLabel(user) }}
                                        </Badge>
                                    </div>
                                    <div class="min-w-0 text-xs text-muted-foreground">
                                        <span class="font-medium text-foreground md:hidden">Roles: </span>
                                        <span class="line-clamp-2 md:truncate">{{ userRoleSummary(user) }}</span>
                                    </div>
                                    <div class="flex items-center justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            class="hidden h-7 gap-1.5 text-xs lg:inline-flex"
                                            :disabled="bulkActionLoading"
                                            @click="openDetails(user)"
                                        >
                                            <AppIcon name="eye" class="size-3.5" />
                                            View
                                        </Button>
                                        <DropdownMenu v-if="canReadApprovalCases || canResetPassword || canUpdateStatus || canUpdate">
                                            <DropdownMenuTrigger as-child>
                                                <Button variant="ghost" size="sm" class="h-7 w-7 p-0">
                                                    <span class="sr-only">Actions</span>
                                                    <AppIcon name="ellipsis-vertical" class="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" class="w-56">
                                                <DropdownMenuLabel class="text-xs">User Actions</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem class="flex items-center gap-2" @click="openDetails(user)">
                                                    <AppIcon name="eye" class="size-3.5" />
                                                    View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    v-if="canUpdate"
                                                    class="flex items-center gap-2"
                                                    @select="openEditDialog(user)"
                                                >
                                                    <AppIcon name="pencil" class="size-3.5" />
                                                    Edit User
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    v-if="canReadApprovalCases && user.id !== null"
                                                    class="flex items-center gap-2"
                                                    @select="openApprovalCases(user)"
                                                >
                                                    <AppIcon name="clipboard-list" class="size-3.5" />
                                                    Approval Cases
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    v-if="canResetPassword"
                                                    class="flex items-center gap-2"
                                                    :disabled="actionLoadingId === user.id || bulkActionLoading"
                                                    @select="sendCredentialLink(user)"
                                                >
                                                    <AppIcon name="log-in" class="size-3.5" />
                                                    {{ credentialLinkActionLabel(user) }}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    v-if="canUpdateStatus"
                                                    class="flex items-center gap-2"
                                                    :disabled="actionLoadingId === user.id || bulkActionLoading"
                                                    @select="openStatusDialog(user, (user.status ?? '').toLowerCase() === 'active' ? 'inactive' : 'active')"
                                                >
                                                    <AppIcon name="activity" class="size-3.5" />
                                                    {{ (user.status ?? '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate' }}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                        <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                            <p class="text-xs text-muted-foreground">
                                <template v-if="pagination">
                                    Showing {{ users.length }} of {{ pagination.total }} &middot; Page {{ pagination.currentPage }} of {{ pagination.lastPage }}
                                </template>
                                <template v-else>No pagination data</template>
                            </p>
                            <div class="flex items-center gap-1">
                                <Button variant="outline" size="icon" class="size-8" :disabled="!canPrev || listLoading" @click="prevPage">
                                    <AppIcon name="chevron-left" class="size-4" />
                                </Button>
                                <template v-for="page in paginationPageNumbers" :key="String(page)">
                                    <span v-if="page === '...'" class="px-1 text-xs text-muted-foreground">…</span>
                                    <Button
                                        v-else
                                        :variant="page === pagination?.currentPage ? 'default' : 'ghost'"
                                        size="icon"
                                        class="size-8 text-xs"
                                        :disabled="listLoading"
                                        @click="goToPage(page as number)"
                                    >
                                        {{ page }}
                                    </Button>
                                </template>
                                <Button variant="outline" size="icon" class="size-8" :disabled="!canNext || listLoading" @click="nextPage">
                                    <AppIcon name="chevron-right" class="size-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </template>

            <Dialog :open="createDialogOpen" @update:open="(open) => (open ? (createDialogOpen = true) : closeCreateUserDialog())">
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle class="flex items-center gap-2">
                            <AppIcon name="plus" class="size-4 text-muted-foreground" />
                            Create user
                        </DialogTitle>
                        <DialogDescription>Provision a new platform account and send the invite when you are ready.</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-4">
                        <div class="grid gap-3">
                            <div class="grid gap-2">
                                <Label for="create-user-name">Name</Label>
                                <Input id="create-user-name" v-model="createForm.name" placeholder="Full name" />
                                <p v-if="createErrors.name?.length" class="text-xs text-destructive">{{ createErrors.name[0] }}</p>
                            </div>
                            <div class="grid gap-2">
                                <Label for="create-user-email">Email</Label>
                                <Input id="create-user-email" v-model="createForm.email" type="email" placeholder="user@facility.org" />
                                <p v-if="createErrors.email?.length" class="text-xs text-destructive">{{ createErrors.email[0] }}</p>
                            </div>
                        </div>
                        <div class="flex items-start gap-2 rounded-md border p-2.5 text-xs">
                            <Checkbox
                                id="create-user-send-invite"
                                class="mt-0.5"
                                :model-value="createSendInvite"
                                :disabled="!canResetPassword || createLoading"
                                @update:model-value="updateCreateSendInvite"
                            />
                            <Label for="create-user-send-invite" class="cursor-pointer leading-snug">
                                Send invite link immediately after create
                                <span v-if="!canResetPassword" class="text-muted-foreground">
                                    (requires <code>platform.users.reset-password</code>)
                                </span>
                            </Label>
                        </div>
                        <p v-if="platformMailWarning" class="text-xs text-amber-700 dark:text-amber-300">
                            {{ platformMailWarning }}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" @click="closeCreateUserDialog">Cancel</Button>
                        <Button :disabled="createLoading" class="gap-1.5" @click="createUser">
                            <AppIcon name="plus" class="size-3.5" />
                            {{ createLoading ? 'Creating...' : 'Create User' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog :open="statusDialogOpen" @update:open="(open) => (open ? (statusDialogOpen = true) : closeStatusDialog())">
                <DialogContent variant="action" size="lg">
                    <DialogHeader><DialogTitle>{{ statusDialogTitle }}</DialogTitle><DialogDescription>{{ statusDialogDescription }}</DialogDescription></DialogHeader>
                    <div class="space-y-3">
                        <Alert v-if="statusDialogError" variant="destructive"><AlertTitle>Status action failed</AlertTitle><AlertDescription>{{ statusDialogError }}</AlertDescription></Alert>
                        <div v-if="statusDialogTarget === 'inactive'" class="grid gap-2"><Label for="status-reason">Reason</Label><Input id="status-reason" v-model="statusDialogReason" placeholder="Enter deactivation reason" /></div>
                        <div class="grid gap-2">
                            <Label for="status-approval-case-reference">Approval Case Reference (if required)</Label>
                            <Input
                                id="status-approval-case-reference"
                                v-model="statusDialogApprovalCaseReference"
                                placeholder="CASE-2026-0001"
                            />
                        </div>
                    </div>
                    <DialogFooter><Button variant="outline" @click="closeStatusDialog">Cancel</Button><Button :disabled="actionLoadingId !== null" @click="submitStatusDialog">{{ actionLoadingId !== null ? 'Saving...' : 'Confirm' }}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog :open="bulkStatusDialogOpen" @update:open="(open) => (open ? (bulkStatusDialogOpen = true) : closeBulkStatusDialog())">
                <DialogContent variant="action" size="lg">
                    <DialogHeader>
                        <DialogTitle>{{ bulkStatusDialogTitle }}</DialogTitle>
                        <DialogDescription>{{ bulkStatusDialogDescription }}</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <Alert v-if="bulkStatusDialogError" variant="destructive">
                            <AlertTitle>Bulk status action failed</AlertTitle>
                            <AlertDescription>{{ bulkStatusDialogError }}</AlertDescription>
                        </Alert>
                        <p class="text-xs text-muted-foreground">{{ selectedCount }} users selected on this page.</p>
                        <div v-if="bulkStatusDialogTarget === 'inactive'" class="grid gap-2">
                            <Label for="bulk-status-reason">Reason</Label>
                            <Input id="bulk-status-reason" v-model="bulkStatusDialogReason" placeholder="Enter deactivation reason" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="bulk-status-approval-case-reference">Approval Case Reference (if required)</Label>
                            <Input
                                id="bulk-status-approval-case-reference"
                                v-model="bulkStatusDialogApprovalCaseReference"
                                placeholder="CASE-2026-0001"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" :disabled="bulkStatusLoading" @click="closeBulkStatusDialog">Cancel</Button>
                        <Button :disabled="bulkStatusLoading" @click="submitBulkStatusDialog">
                            {{ bulkStatusLoading ? 'Applying...' : 'Confirm' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog :open="bulkRolesDialogOpen" @update:open="(open) => (open ? (bulkRolesDialogOpen = true) : closeBulkRolesDialog())">
                <DialogContent size="2xl">
                    <DialogHeader>
                        <DialogTitle>Assign Roles To Selected Users</DialogTitle>
                        <DialogDescription>Selected roles replace current role assignments for each selected user.</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <Alert v-if="bulkRolesDialogError" variant="destructive">
                            <AlertTitle>Bulk role assignment failed</AlertTitle>
                            <AlertDescription>{{ bulkRolesDialogError }}</AlertDescription>
                        </Alert>
                        <p class="text-xs text-muted-foreground">{{ selectedCount }} users selected on this page.</p>
                        <p class="text-xs text-muted-foreground">Leave all unchecked to clear scoped role assignments.</p>
                        <div class="grid gap-2">
                            <Label for="bulk-roles-approval-case-reference">Approval Case Reference (if required)</Label>
                            <Input
                                id="bulk-roles-approval-case-reference"
                                v-model="bulkRolesApprovalCaseReference"
                                placeholder="CASE-2026-0001"
                            />
                        </div>
                        <div class="max-h-[min(24rem,55vh)] overflow-y-auto rounded-md border p-3">
                            <PlatformRoleAssignmentPicker
                                v-model="bulkRoleDraftIds"
                                :roles="roles"
                                :policy="roleAssignmentPolicy"
                                :disabled="bulkRolesLoading"
                                id-prefix="bulk-role"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" :disabled="bulkRolesLoading" @click="closeBulkRolesDialog">Cancel</Button>
                        <Button :disabled="bulkRolesLoading" @click="submitBulkRolesDialog">
                            {{ bulkRolesLoading ? 'Applying...' : 'Apply Roles' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog :open="bulkFacilitiesDialogOpen" @update:open="(open) => (open ? (bulkFacilitiesDialogOpen = true) : closeBulkFacilitiesDialog())">
                <DialogContent size="2xl">
                    <DialogHeader>
                        <DialogTitle>Assign Facilities To Selected Users</DialogTitle>
                        <DialogDescription>Selected facility assignments replace current assignments for each selected user.</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <Alert v-if="bulkFacilitiesDialogError" variant="destructive">
                            <AlertTitle>Bulk facility assignment failed</AlertTitle>
                            <AlertDescription>{{ bulkFacilitiesDialogError }}</AlertDescription>
                        </Alert>
                        <p class="text-xs text-muted-foreground">{{ selectedCount }} users selected on this page.</p>
                        <div class="grid gap-2">
                            <Label for="bulk-facilities-approval-case-reference">Approval Case Reference (if required)</Label>
                            <Input
                                id="bulk-facilities-approval-case-reference"
                                v-model="bulkFacilitiesApprovalCaseReference"
                                placeholder="CASE-2026-0001"
                            />
                        </div>
                        <div class="rounded-lg border bg-muted/20 p-3">
                            <div class="flex flex-wrap items-end gap-2">
                                <div class="grid min-w-0 flex-1 gap-1.5">
                                    <Label for="bulk-facility-add">Add facility</Label>
                                    <Select v-model="newBulkFacilityDraftId">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select facility" />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem
                                            v-for="facility in bulkUnassignedFacilities"
                                            :key="`bulk-facility-${String(facility.id)}`"
                                            :value="String(facility.id ?? '')"
                                        >
                                            {{ facility.code || 'FAC' }} - {{ facility.name || 'Facility' }}
                                        </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button variant="outline" class="min-w-24" :disabled="!newBulkFacilityDraftId || bulkFacilitiesLoading" @click="addBulkFacilityDraft">
                                    Add Site
                                </Button>
                            </div>
                            <p class="mt-2 text-xs text-muted-foreground">Choose the facilities that should apply to all selected users. One site remains primary in the saved set.</p>
                        </div>
                        <div v-if="bulkFacilityDrafts.length === 0" class="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                            No facilities selected. Apply with empty list to clear facility assignments.
                        </div>
                        <div v-else class="max-h-72 space-y-3 overflow-y-auto rounded-lg border p-3">
                            <div v-for="entry in bulkFacilityDrafts" :key="`bulk-facility-entry-${entry.facilityId}`" class="rounded-lg border bg-background/80 p-4">
                                <div class="flex flex-wrap items-start justify-between gap-3">
                                    <div class="min-w-0 space-y-1">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="text-sm font-medium">{{ facilityLabel(entry.facilityId) }}</p>
                                            <Badge :variant="entry.isPrimary ? 'secondary' : 'outline'" class="rounded-md">
                                                {{ entry.isPrimary ? 'Primary site' : 'Assigned site' }}
                                            </Badge>
                                            <Badge :variant="entry.isActive ? 'secondary' : 'outline'" class="rounded-md">
                                                {{ entry.isActive ? 'Active' : 'Inactive' }}
                                            </Badge>
                                        </div>
                                        <p class="text-xs text-muted-foreground">Bulk facility assignment draft for the selected users.</p>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Button
                                            size="sm"
                                            :variant="entry.isPrimary ? 'secondary' : 'outline'"
                                            :disabled="entry.isPrimary || bulkFacilitiesLoading"
                                            @click="setBulkPrimaryFacility(entry.facilityId)"
                                        >
                                            {{ entry.isPrimary ? 'Primary Site' : 'Set Primary' }}
                                        </Button>
                                        <Button size="sm" variant="destructive" :disabled="bulkFacilitiesLoading" @click="removeBulkFacilityDraft(entry.facilityId)">
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                                <Separator class="my-3" />
                                <div class="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px]">
                                    <div class="grid gap-1.5">
                                        <Label>Facility Posting / Local Function</Label>
                                        <Input v-model="entry.role" placeholder="e.g. Nurse In Charge, Registration Desk, Cashier" :disabled="bulkFacilitiesLoading" />
                                        <p class="text-[11px] text-muted-foreground">Optional local posting or duty station at this facility. This is not the staff job title and not a platform access role.</p>
                                    </div>
                                    <div class="grid gap-1.5">
                                        <Label>Status</Label>
                                        <Select v-model="entry.isActive">
                                            <SelectTrigger :disabled="bulkFacilitiesLoading">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem :value="true">Active</SelectItem>
                                            <SelectItem :value="false">Inactive</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p class="text-[11px] text-muted-foreground">Controls whether this facility assignment is active when applied.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" :disabled="bulkFacilitiesLoading" @click="closeBulkFacilitiesDialog">Cancel</Button>
                        <Button :disabled="bulkFacilitiesLoading" @click="submitBulkFacilitiesDialog">
                            {{ bulkFacilitiesLoading ? 'Applying...' : 'Apply Facilities' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog :open="editDialogOpen" @update:open="(open) => (open ? (editDialogOpen = true) : closeEditDialog())">
                <DialogContent size="xl">
                    <DialogHeader>
                        <DialogTitle>Edit User Profile</DialogTitle>
                        <DialogDescription>Update core identity fields for this account.</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <Alert v-if="editDialogError" variant="destructive">
                            <AlertTitle>Profile update failed</AlertTitle>
                            <AlertDescription>{{ editDialogError }}</AlertDescription>
                        </Alert>
                        <Alert
                            v-if="editDialogRequiresApprovalCase"
                            class="rounded-lg border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
                        >
                            <AlertTitle>Privileged account protection</AlertTitle>
                            <AlertDescription>
                                This account holds elevated platform privileges. Profile edits require an approved case reference for governance traceability.
                            </AlertDescription>
                        </Alert>
                        <div class="grid gap-2">
                            <Label for="edit-user-name">Name</Label>
                            <Input id="edit-user-name" v-model="editForm.name" :disabled="editDialogFetching" placeholder="Full name" />
                            <p v-if="editErrors.name?.length" class="text-xs text-destructive">{{ editErrors.name[0] }}</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="edit-user-email">Email</Label>
                            <Input id="edit-user-email" v-model="editForm.email" :disabled="editDialogFetching" type="email" placeholder="user@facility.org" />
                            <p v-if="editErrors.email?.length" class="text-xs text-destructive">{{ editErrors.email[0] }}</p>
                        </div>
                        <div v-if="editDialogRequiresApprovalCase" class="grid gap-2">
                            <Label for="edit-user-approval-case-reference">Approval Case Reference</Label>
                            <Input
                                id="edit-user-approval-case-reference"
                                v-model="editDialogApprovalCaseReference"
                                :disabled="editDialogFetching"
                                placeholder="CASE-PLT-2026-0001"
                            />
                            <p v-if="editErrors.approvalCaseReference?.length" class="text-xs text-destructive">
                                {{ editErrors.approvalCaseReference[0] }}
                            </p>
                        </div>
                        <p v-if="editDialogFetching" class="text-xs text-muted-foreground">Checking account privileges...</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" :disabled="editDialogLoading || editDialogFetching" @click="closeEditDialog">Cancel</Button>
                        <Button
                            :disabled="editDialogLoading || editDialogFetching || (editDialogRequiresApprovalCase && !editDialogApprovalCaseReference.trim())"
                            @click="submitEditDialog"
                        >
                            {{ editDialogLoading ? 'Saving...' : editDialogFetching ? 'Loading...' : 'Save Changes' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            <Sheet :open="detailsOpen" @update:open="(open) => (open ? (detailsOpen = true) : closeDetails())">
                <SheetContent side="right" variant="workspace" size="5xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader class="shrink-0 border-b bg-background px-4 py-3 pr-12 text-left">
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div class="min-w-0 space-y-1">
                                <SheetTitle class="flex min-w-0 items-center gap-2 text-lg">
                                    <AppIcon name="user" class="size-5 shrink-0 text-primary" />
                                    <span class="truncate">{{ detailsUser?.name || 'User Details' }}</span>
                                </SheetTitle>
                                <SheetDescription class="truncate text-sm">
                                    <template v-if="detailsUser">
                                        {{ detailsUser.email || 'No email recorded' }} | User #{{ detailsUser.id ?? 'N/A' }}
                                    </template>
                                    <template v-else>
                                        Review identity, credentials, facility scope, and audit activity.
                                    </template>
                                </SheetDescription>
                            </div>
                            <div v-if="detailsUser" class="flex flex-wrap items-center gap-2 pr-1 sm:justify-end">
                                <Badge :variant="verificationVariant(detailsUser)" class="rounded-md">
                                    {{ verificationLabel(detailsUser) }}
                                </Badge>
                                <Badge :variant="statusVariant(detailsUser.status)" class="rounded-md capitalize">
                                    {{ detailsUser.status || 'unknown' }}
                                </Badge>
                            </div>
                        </div>
                    </SheetHeader>

                    <div v-if="detailsLoading && !detailsUser" class="space-y-3 p-4">
                        <Skeleton class="h-20 w-full" />
                        <Skeleton class="h-10 w-full" />
                        <Skeleton class="h-32 w-full" />
                        <Skeleton class="h-32 w-full" />
                    </div>

                    <ScrollArea v-else-if="detailsUser" class="min-h-0 flex-1" viewport-class="pb-6">
                        <div class="grid gap-4 px-4 py-4">
                            <div class="rounded-lg border bg-muted/10 p-3">
                                <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)] lg:items-center">
                                    <div class="flex min-w-0 items-start gap-4">
                                        <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                                            {{ userInitials(detailsUser) }}
                                        </div>
                                        <div class="min-w-0 space-y-1">
                                            <p class="truncate text-base font-semibold leading-tight">{{ detailsUser.name || 'Unnamed user' }}</p>
                                            <p class="truncate text-sm text-muted-foreground">{{ detailsUser.email || 'No email recorded' }}</p>
                                            <p class="text-xs text-muted-foreground">
                                                User ID:
                                                <span class="font-mono font-medium text-foreground">{{ detailsUser.id ?? 'N/A' }}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div class="grid gap-2 sm:grid-cols-3">
                                        <div class="rounded-md border bg-background px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Roles</p>
                                            <p class="mt-1 truncate text-sm font-semibold">{{ detailsUser.roles.length }}</p>
                                        </div>
                                        <div class="rounded-md border bg-background px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Facilities</p>
                                            <p class="mt-1 truncate text-sm font-semibold">{{ detailsUser.facilityAssignments.length }}</p>
                                        </div>
                                        <div class="rounded-md border bg-background px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Updated</p>
                                            <p class="mt-1 truncate text-sm font-semibold">{{ formatDateTime(detailsUser.updatedAt) }}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Tabs v-model="detailsSheetTab" class="w-full">
                                <TabsList class="grid w-full grid-cols-3">
                                    <TabsTrigger value="overview" class="inline-flex items-center gap-1.5 text-xs sm:text-sm">
                                        <AppIcon name="layout-grid" class="size-3.5" />
                                        Overview
                                    </TabsTrigger>
                                    <TabsTrigger value="access" class="inline-flex items-center gap-1.5 text-xs sm:text-sm">
                                        <AppIcon name="shield-check" class="size-3.5" />
                                        Access
                                    </TabsTrigger>
                                    <TabsTrigger value="audit" class="inline-flex items-center gap-1.5 text-xs sm:text-sm">
                                        <AppIcon name="file-text" class="size-3.5" />
                                        Audit
                                        <Badge v-if="detailsAuditMeta" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                                            {{ detailsAuditMeta.total }}
                                        </Badge>
                                    </TabsTrigger>
                                </TabsList>

                                <!-- OVERVIEW TAB -->
                                <TabsContent value="overview" class="mt-3 space-y-3">
                                    <div class="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
                                        <Card class="rounded-lg !gap-4 !py-4 xl:row-span-2">
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <div class="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                            <AppIcon name="user" class="size-4 text-muted-foreground" />
                                                            Account Profile
                                                        </CardTitle>
                                                        <CardDescription class="mt-0.5 text-xs">
                                                            Core identity used across platform, facility scope, and audit records.
                                                        </CardDescription>
                                                    </div>
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <Button
                                                            v-if="canCreateLinkedStaffProfile"
                                                            size="sm"
                                                            variant="outline"
                                                            class="h-8 gap-1.5 text-xs"
                                                            @click="openCreateStaffProfile(detailsUser)"
                                                        >
                                                            <AppIcon name="users" class="size-3.5" />
                                                            Create Staff Profile
                                                        </Button>
                                                        <Button
                                                            v-if="canUpdate"
                                                            size="sm"
                                                            variant="outline"
                                                            class="h-8 gap-1.5 text-xs"
                                                            @click="openEditDialog(detailsUser)"
                                                        >
                                                            <AppIcon name="pencil" class="size-3.5" />
                                                            Edit Profile
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-4 px-4 pt-0 text-sm">
                                                <Alert v-if="!canUpdate" variant="destructive">
                                                    <AlertTitle>Profile edit restricted</AlertTitle>
                                                    <AlertDescription>Request <code>platform.users.update</code> permission.</AlertDescription>
                                                </Alert>
                                                <div class="grid gap-3 sm:grid-cols-2">
                                                    <div class="rounded-md border bg-muted/10 px-3 py-2">
                                                        <p class="text-xs text-muted-foreground">Full name</p>
                                                        <p class="mt-1 truncate font-medium">{{ detailsUser.name || '--' }}</p>
                                                    </div>
                                                    <div class="rounded-md border bg-muted/10 px-3 py-2">
                                                        <p class="text-xs text-muted-foreground">Email address</p>
                                                        <p class="mt-1 truncate font-medium">{{ detailsUser.email || '--' }}</p>
                                                    </div>
                                                    <div class="rounded-md border bg-muted/10 px-3 py-2">
                                                        <p class="text-xs text-muted-foreground">Verification</p>
                                                        <Badge :variant="verificationVariant(detailsUser)" class="mt-1 h-5 rounded-md text-xs">
                                                            {{ verificationLabel(detailsUser) }}
                                                        </Badge>
                                                    </div>
                                                    <div class="rounded-md border bg-muted/10 px-3 py-2">
                                                        <p class="text-xs text-muted-foreground">Current status</p>
                                                        <Badge :variant="statusVariant(detailsUser.status)" class="mt-1 h-5 rounded-md text-xs capitalize">
                                                            {{ detailsUser.status || 'unknown' }}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div v-if="detailsUserRequiresApprovalCase" class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                                                    This is a privileged platform account. Profile, role, facility, and status changes require approval-case traceability.
                                                </div>
                                                <div v-if="detailsUser.statusReason" class="rounded-lg border bg-muted/20 p-3">
                                                    <p class="text-xs text-muted-foreground">Status note</p>
                                                    <p class="mt-1 text-sm font-medium">{{ detailsUser.statusReason }}</p>
                                                </div>
                                                <div class="grid gap-3 border-t pt-3 sm:grid-cols-2">
                                                    <div>
                                                        <p class="text-xs text-muted-foreground">Role summary</p>
                                                        <p class="mt-1 truncate font-medium">{{ userRoleSummary(detailsUser) }}</p>
                                                    </div>
                                                    <div>
                                                        <p class="text-xs text-muted-foreground">Facility summary</p>
                                                        <p class="mt-1 truncate font-medium">{{ userFacilitySummary(detailsUser) }}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card class="rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <div class="flex items-start justify-between gap-3">
                                                    <div>
                                                        <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                            <AppIcon name="mail" class="size-4 text-muted-foreground" />
                                                            Credential Delivery
                                                        </CardTitle>
                                                        <CardDescription class="mt-0.5 text-xs">
                                                            Verification and password recovery for this account.
                                                        </CardDescription>
                                                    </div>
                                                    <Badge :variant="verificationVariant(detailsUser)" class="shrink-0 rounded-md">
                                                        {{ verificationLabel(detailsUser) }}
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-3 px-4 pt-0 text-sm">
                                                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                                                    <div class="rounded-md border bg-muted/10 px-3 py-2">
                                                        <p class="text-xs text-muted-foreground">Verified at</p>
                                                        <p class="mt-1 font-medium">{{ detailsUser.emailVerifiedAt ? formatDateTime(detailsUser.emailVerifiedAt) : 'Pending completion' }}</p>
                                                    </div>
                                                    <div class="rounded-md border bg-muted/10 px-3 py-2">
                                                        <p class="text-xs text-muted-foreground">Delivery mode</p>
                                                        <p class="mt-1 font-medium">{{ platformMailDeliversExternally ? 'SMTP email' : 'Log preview only' }}</p>
                                                    </div>
                                                </div>
                                                <div class="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                                                    {{ credentialLinkActionDescription(detailsUser) }}
                                                </div>
                                                <Alert
                                                    v-if="platformMailWarning"
                                                    class="rounded-lg border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
                                                >
                                                    <AlertTitle>Delivery check</AlertTitle>
                                                    <AlertDescription>
                                                        {{ platformMailWarning }}
                                                        <span v-if="platformMail?.fromAddress"> From: <code>{{ platformMail.fromAddress }}</code>.</span>
                                                    </AlertDescription>
                                                </Alert>
                                                <Alert
                                                    v-if="!detailsUser.emailVerifiedAt"
                                                    class="rounded-lg border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
                                                >
                                                    <AlertTitle>Verification pending</AlertTitle>
                                                    <AlertDescription>
                                                        This account cannot safely unlock staff credentialing or privileging workflows until the mailbox owner completes the invite.
                                                    </AlertDescription>
                                                </Alert>
                                                <Alert v-if="!canResetPassword" variant="destructive">
                                                    <AlertTitle>Credential dispatch restricted</AlertTitle>
                                                    <AlertDescription>Request <code>platform.users.reset-password</code> permission.</AlertDescription>
                                                </Alert>
                                                <Button
                                                    v-if="canResetPassword"
                                                    size="sm"
                                                    class="w-full gap-1.5"
                                                    :disabled="actionLoadingId === detailsUser.id || !detailsUser.email"
                                                    @click="sendCredentialLink(detailsUser)"
                                                >
                                                    <AppIcon name="mail" class="size-3.5" />
                                                    {{ actionLoadingId === detailsUser.id ? 'Sending...' : credentialLinkActionLabel(detailsUser) }}
                                                </Button>
                                            </CardContent>
                                        </Card>
                                        <Card class="rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                    <AppIcon name="activity" class="size-4 text-muted-foreground" />
                                                    Account Timeline
                                                </CardTitle>
                                                <CardDescription class="text-xs">Lifecycle markers for operational traceability.</CardDescription>
                                            </CardHeader>
                                            <CardContent class="grid gap-2 px-4 pt-0 text-sm">
                                                <div class="flex items-center justify-between gap-4 rounded-md border bg-muted/10 px-3 py-2">
                                                    <span class="text-muted-foreground">Created</span>
                                                    <span class="text-right font-medium">{{ formatDateTime(detailsUser.createdAt) }}</span>
                                                </div>
                                                <div class="flex items-center justify-between gap-4 rounded-md border bg-muted/10 px-3 py-2">
                                                    <span class="text-muted-foreground">Updated</span>
                                                    <span class="text-right font-medium">{{ formatDateTime(detailsUser.updatedAt) }}</span>
                                                </div>
                                                <div class="flex items-center justify-between gap-4 rounded-md border bg-muted/10 px-3 py-2">
                                                    <span class="text-muted-foreground">User ID</span>
                                                    <span class="font-mono text-right font-medium">{{ detailsUser.id ?? '--' }}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>

                                <!-- ACCESS TAB -->
                                <TabsContent value="access" class="mt-3 space-y-3">
                                    <!-- Role Assignments -->
                                    <Card class="rounded-lg !gap-4 !py-4">
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                <AppIcon name="shield-check" class="size-4 text-muted-foreground" />
                                                Role Assignments
                                            </CardTitle>
                                            <CardDescription class="text-xs">
                                                Account-level RBAC roles (hospital operational vs platform/system). Separate from facility site posting below.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent class="px-4 pt-0">
                                            <Alert v-if="!canManageRoles && !canReadRoles" variant="destructive">
                                                <AlertTitle>Role access restricted</AlertTitle>
                                                <AlertDescription>Request <code>platform.rbac.read</code> or <code>platform.rbac.manage-user-roles</code>.</AlertDescription>
                                            </Alert>
                                            <div v-else class="space-y-3">
                                                <Alert v-if="detailsUserRequiresApprovalCase" class="rounded-lg border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                                                    <AlertTitle>Approval case required</AlertTitle>
                                                    <AlertDescription class="space-y-1 text-xs">
                                                        <p>This user has privileged access. Role changes require an approval case reference before they can be saved.</p>
                                                        <p v-if="detailsPrivilegedRoleCodes.length > 0">
                                                            Current privileged roles: {{ detailsPrivilegedRoleCodes.join(', ') }}
                                                        </p>
                                                    </AlertDescription>
                                                </Alert>
                                                <Alert v-if="saveRolesError" variant="destructive">
                                                    <AlertTitle>Unable to save roles</AlertTitle>
                                                    <AlertDescription>{{ saveRolesError }}</AlertDescription>
                                                </Alert>
                                                <Alert
                                                    v-if="detailsRolesOutsideAssignmentScope.length > 0"
                                                    variant="outline"
                                                    class="rounded-lg"
                                                >
                                                    <AlertTitle class="text-sm">Roles outside your assignment scope</AlertTitle>
                                                    <AlertDescription class="space-y-1 text-xs">
                                                        <p>
                                                            This user still holds elevated roles you cannot modify from a facility-scoped session.
                                                            Contact tenant or platform IAM to change them.
                                                        </p>
                                                        <p class="font-medium">
                                                            {{
                                                                detailsRolesOutsideAssignmentScope
                                                                    .map((role) => role.code || role.name)
                                                                    .filter(Boolean)
                                                                    .join(', ')
                                                            }}
                                                        </p>
                                                    </AlertDescription>
                                                </Alert>
                                                <PlatformRoleAssignmentPicker
                                                    v-model="roleDraftIds"
                                                    :roles="roles"
                                                    :policy="roleAssignmentPolicy"
                                                    :disabled="!canManageRoles || saveRolesLoading"
                                                    id-prefix="details-role"
                                                />
                                                <div class="grid gap-1.5">
                                                    <Label for="details-roles-approval-case-reference" class="text-xs">
                                                        Approval Case Reference
                                                        <span v-if="detailsUserRequiresApprovalCase" class="text-destructive">*</span>
                                                    </Label>
                                                    <Input
                                                        id="details-roles-approval-case-reference"
                                                        v-model="saveRolesApprovalCaseReference"
                                                        placeholder="CASE-2026-0001"
                                                    />
                                                    <p class="text-[11px] text-muted-foreground">
                                                        {{ detailsUserRequiresApprovalCase ? 'Required for this user because the account currently holds privileged access.' : 'Provide only when your governance workflow requires it.' }}
                                                    </p>
                                                </div>
                                                <div class="flex justify-end">
                                                    <Button
                                                        v-if="canManageRoles"
                                                        size="sm"
                                                        :disabled="saveRolesLoading || (detailsUserRequiresApprovalCase && !saveRolesApprovalCaseReference.trim())"
                                                        @click="saveRoles"
                                                    >
                                                        {{ saveRolesLoading ? 'Saving...' : 'Save Roles' }}
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <!-- Facility Assignments -->
                                    <Card v-if="canManageFacilities" class="rounded-lg !gap-4 !py-4">
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                <AppIcon name="building-2" class="size-4 text-muted-foreground" />
                                                Facility Assignments
                                            </CardTitle>
                                            <CardDescription class="text-xs">Assign operational facilities and one primary site. Facility posting is optional and separate from platform roles.</CardDescription>
                                        </CardHeader>
                                        <CardContent class="px-4 pt-0">
                                            <div class="space-y-3">
                                                <Alert v-if="detailsUserRequiresApprovalCase" class="rounded-lg border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                                                    <AlertTitle>Approval case required</AlertTitle>
                                                    <AlertDescription class="space-y-1 text-xs">
                                                        <p>This user has privileged access. Facility assignment changes require an approval case reference before they can be saved.</p>
                                                        <p v-if="detailsPrivilegedMatchedPermissions.length > 0">
                                                            Triggered by: {{ detailsPrivilegedMatchedPermissions.slice(0, 3).join(', ') }}<span v-if="detailsPrivilegedMatchedPermissions.length > 3"> and {{ detailsPrivilegedMatchedPermissions.length - 3 }} more</span>
                                                        </p>
                                                    </AlertDescription>
                                                </Alert>
                                                <Alert v-if="saveFacilitiesError" variant="destructive">
                                                    <AlertTitle>Unable to save facilities</AlertTitle>
                                                    <AlertDescription>{{ saveFacilitiesError }}</AlertDescription>
                                                </Alert>
                                                <div class="rounded-lg border bg-muted/20 p-3">
                                                    <div class="grid gap-2 md:grid-cols-[1fr_auto]">
                                                        <div class="grid gap-1.5">
                                                            <Label for="details-facility-add">Add facility</Label>
                                                            <Select v-model="newFacilityDraftId">
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select facility to add" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                <SelectItem
                                                                    v-for="facility in unassignedFacilities"
                                                                    :key="`available-${String(facility.id)}`"
                                                                    :value="String(facility.id)"
                                                                >
                                                                    {{ facility.code || 'FAC' }} - {{ facility.name || 'Facility' }}
                                                                </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <Button variant="outline" class="min-w-24 self-end" :disabled="!newFacilityDraftId || saveFacilitiesLoading" @click="addFacilityDraft">
                                                            Add Site
                                                        </Button>
                                                    </div>
                                                    <p class="mt-2 text-xs text-muted-foreground">Assigned facilities control operational scope for this user. One site remains primary.</p>
                                                </div>
                                                <div v-if="facilityDrafts.length === 0" class="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center">
                                                    <AppIcon name="building-2" class="size-5 text-muted-foreground/50" />
                                                    <p class="text-sm text-muted-foreground">No facilities assigned.</p>
                                                </div>
                                                <div v-else class="space-y-3">
                                                    <div v-for="entry in facilityDrafts" :key="entry.facilityId" class="rounded-lg border bg-background/80 p-4">
                                                        <div class="flex flex-wrap items-start justify-between gap-3">
                                                            <div class="min-w-0 space-y-1">
                                                                <div class="flex flex-wrap items-center gap-2">
                                                                    <p class="text-sm font-medium">{{ facilityLabel(entry.facilityId) }}</p>
                                                                    <Badge :variant="entry.isPrimary ? 'secondary' : 'outline'" class="rounded-md">
                                                                        {{ entry.isPrimary ? 'Primary site' : 'Assigned site' }}
                                                                    </Badge>
                                                                    <Badge :variant="entry.isActive ? 'secondary' : 'outline'" class="rounded-md">
                                                                        {{ entry.isActive ? 'Active' : 'Inactive' }}
                                                                    </Badge>
                                                                </div>
                                                                <p class="text-xs text-muted-foreground">Operational facility assignment and optional local posting for this user at this site.</p>
                                                            </div>
                                                            <div class="flex flex-wrap items-center gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    :variant="entry.isPrimary ? 'secondary' : 'outline'"
                                                                    :disabled="entry.isPrimary || saveFacilitiesLoading"
                                                                    @click="setPrimaryFacility(entry.facilityId)"
                                                                >
                                                                    {{ entry.isPrimary ? 'Primary Site' : 'Set Primary' }}
                                                                </Button>
                                                                <Button size="sm" variant="destructive" :disabled="saveFacilitiesLoading" @click="removeFacilityDraft(entry.facilityId)">
                                                                    Remove
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <Separator class="my-3" />
                                                        <div class="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px]">
                                                            <div class="grid gap-1.5">
                                                                <Label :for="`facility-role-${entry.facilityId}`" class="text-xs">Facility Posting / Local Function</Label>
                                                                <Input :id="`facility-role-${entry.facilityId}`" v-model="entry.role" placeholder="OPD Nurse, Cashier, Registration Desk..." />
                                                                <p class="text-[11px] text-muted-foreground">Optional local posting or duty station at this facility. This is not the staff job title and not a platform access role.</p>
                                                            </div>
                                                            <div class="grid gap-1.5">
                                                                <Label :for="`facility-active-${entry.facilityId}`" class="text-xs">Assignment Status</Label>
                                                                <Select v-model="entry.isActive">
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                    <SelectItem :value="true">Active</SelectItem>
                                                                    <SelectItem :value="false">Inactive</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <p class="text-[11px] text-muted-foreground">Controls whether this facility assignment is currently active.</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="grid gap-1.5">
                                                    <Label for="details-facilities-approval-case-reference" class="text-xs">
                                                        Approval Case Reference
                                                        <span v-if="detailsUserRequiresApprovalCase" class="text-destructive">*</span>
                                                    </Label>
                                                    <Input
                                                        id="details-facilities-approval-case-reference"
                                                        v-model="saveFacilitiesApprovalCaseReference"
                                                        placeholder="CASE-2026-0001"
                                                    />
                                                    <p class="text-[11px] text-muted-foreground">
                                                        {{ detailsUserRequiresApprovalCase ? 'Required before saving because this user currently holds privileged platform access.' : 'Provide only when your governance workflow requires it.' }}
                                                    </p>
                                                </div>
                                                <div class="flex justify-end">
                                                    <Button
                                                        size="sm"
                                                        :disabled="saveFacilitiesLoading || (detailsUserRequiresApprovalCase && !saveFacilitiesApprovalCaseReference.trim())"
                                                        @click="saveFacilities"
                                                    >
                                                        {{ saveFacilitiesLoading ? 'Saving...' : 'Save Facilities' }}
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <!-- AUDIT TAB -->
                                <TabsContent value="audit" class="mt-3 space-y-3">
                                    <Alert v-if="!canViewAudit" variant="destructive">
                                        <AlertTitle class="flex items-center gap-2">
                                            <AppIcon name="shield-check" class="size-4" />
                                            Audit Access Restricted
                                        </AlertTitle>
                                        <AlertDescription>Request <code>platform.users.view-audit-logs</code> permission.</AlertDescription>
                                    </Alert>

                                    <template v-else>
                                        <!-- Collapsible audit filters -->
                                        <Collapsible v-model:open="detailsAuditFiltersOpen">
                                            <Card class="rounded-lg !gap-4 !py-4">
                                                <CardHeader class="px-4 pb-2 pt-0">
                                                    <div class="flex flex-wrap items-center justify-between gap-2">
                                                        <div>
                                                            <CardTitle class="text-sm font-medium">Filter audit logs</CardTitle>
                                                            <CardDescription class="mt-0.5 text-xs">
                                                                {{ detailsAuditMeta?.total ?? 0 }} entries &middot; Refine by action, actor, or date range
                                                            </CardDescription>
                                                        </div>
                                                        <div class="flex items-center gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                class="gap-1.5"
                                                                :disabled="detailsAuditExporting || detailsAuditLoading"
                                                                @click="exportDetailsAuditLogs"
                                                            >
                                                                <AppIcon name="file-text" class="size-3.5" />
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
                                                    <CardContent class="px-4 pt-0">
                                                        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                            <div class="sm:col-span-2 lg:col-span-3">
                                                                <Label for="user-audit-q" class="text-xs">Text search</Label>
                                                                <Input id="user-audit-q" v-model="detailsAuditFilters.q" placeholder="created, status.updated, role.assigned..." class="mt-1" />
                                                            </div>
                                                            <div class="space-y-1.5">
                                                                <Label for="user-audit-action" class="text-xs">Action (exact)</Label>
                                                                <Input id="user-audit-action" v-model="detailsAuditFilters.action" placeholder="Action key" />
                                                            </div>
                                                            <div class="space-y-1.5">
                                                                <Label for="user-audit-actor-type" class="text-xs">Actor type</Label>
                                                                <Select v-model="detailsAuditActorTypeSelectValue">
                                                                    <SelectTrigger class="mt-0">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                    <SelectItem :value="allSelectValue">All actors</SelectItem>
                                                                    <SelectItem value="user">User only</SelectItem>
                                                                    <SelectItem value="system">System only</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div class="space-y-1.5">
                                                                <Label for="user-audit-actor-id" class="text-xs">Actor ID</Label>
                                                                <Input id="user-audit-actor-id" v-model="detailsAuditFilters.actorId" inputmode="numeric" placeholder="User ID" />
                                                            </div>
                                                            <div class="space-y-1.5">
                                                                <Label for="user-audit-per-page" class="text-xs">Per page</Label>
                                                                <Select :model-value="String(detailsAuditFilters.perPage)" @update:model-value="detailsAuditFilters.perPage = Number($event)">
                                                                    <SelectTrigger class="mt-0">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                    <SelectItem value="10">10</SelectItem>
                                                                    <SelectItem value="20">20</SelectItem>
                                                                    <SelectItem value="50">50</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div class="space-y-1.5">
                                                                <Label for="user-audit-from" class="text-xs">From (date/time)</Label>
                                                                <Input id="user-audit-from" v-model="detailsAuditFilters.from" type="datetime-local" class="mt-0" />
                                                            </div>
                                                            <div class="space-y-1.5">
                                                                <Label for="user-audit-to" class="text-xs">To (date/time)</Label>
                                                                <Input id="user-audit-to" v-model="detailsAuditFilters.to" type="datetime-local" class="mt-0" />
                                                            </div>
                                                            <div class="flex flex-wrap items-center gap-2 border-t pt-3 sm:col-span-2 lg:col-span-3">
                                                                <Button size="sm" class="gap-1.5" :disabled="detailsAuditLoading" @click="applyDetailsAuditFilters">
                                                                    <AppIcon name="eye" class="size-3.5" />
                                                                    {{ detailsAuditLoading ? 'Applying...' : 'Apply filters' }}
                                                                </Button>
                                                                <Button size="sm" variant="outline" class="gap-1.5" :disabled="detailsAuditLoading" @click="resetDetailsAuditFilters">
                                                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                                    Reset
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </CollapsibleContent>
                                            </Card>
                                        </Collapsible>

                                        <!-- Audit list -->
                                        <Alert v-if="detailsAuditError" variant="destructive">
                                            <AlertTitle class="flex items-center gap-2">
                                                <AppIcon name="circle-x" class="size-4" />
                                                Audit Load Issue
                                            </AlertTitle>
                                            <AlertDescription>{{ detailsAuditError }}</AlertDescription>
                                        </Alert>
                                        <div v-else-if="detailsAuditLoading" class="space-y-2">
                                            <Skeleton class="h-12 w-full" />
                                            <Skeleton class="h-12 w-full" />
                                            <Skeleton class="h-12 w-full" />
                                        </div>
                                        <div v-else-if="detailsAuditLogs.length === 0" class="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
                                            <AppIcon name="file-text" class="size-6 text-muted-foreground/50" />
                                            <p class="text-sm text-muted-foreground">No audit logs found for current filters.</p>
                                        </div>
                                        <div v-else class="space-y-1.5">
                                            <div
                                                v-for="log in detailsAuditLogs"
                                                :key="log.id"
                                                class="flex items-start gap-3 rounded-lg border px-2.5 py-1.5 text-sm"
                                            >
                                                <div class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                                                    <AppIcon name="activity" class="size-3 text-muted-foreground" />
                                                </div>
                                                <div class="min-w-0 flex-1">
                                                    <p class="font-medium">{{ log.actionLabel || log.action || 'event' }}</p>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{ formatDateTime(log.createdAt) }} &middot;
                                                        {{
                                                            log.actor?.displayName ||
                                                            (log.actorType === 'system'
                                                                ? 'System'
                                                                : log.actorId
                                                                  ? `User #${log.actorId}`
                                                                  : 'Unknown actor')
                                                        }}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Audit pagination -->
                                        <div v-if="detailsAuditLogs.length > 0" class="flex items-center justify-between border-t pt-1.5">
                                            <Button variant="outline" size="sm" class="h-7 text-xs" :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage <= 1" @click="prevDetailsAuditPage">
                                                Previous
                                            </Button>
                                            <p class="text-xs text-muted-foreground">
                                                Page {{ detailsAuditMeta?.currentPage ?? 1 }} of {{ detailsAuditMeta?.lastPage ?? 1 }} | {{ detailsAuditMeta?.total ?? detailsAuditLogs.length }} logs
                                            </p>
                                            <Button variant="outline" size="sm" class="h-7 text-xs" :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage >= detailsAuditMeta.lastPage" @click="nextDetailsAuditPage">
                                                Next
                                            </Button>
                                        </div>
                                    </template>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ScrollArea>

                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p class="text-xs text-muted-foreground">
                                {{ detailsUser ? `${verificationLabel(detailsUser)} | ${userFacilitySummary(detailsUser)}` : 'User details workspace' }}
                            </p>
                            <Button variant="outline" class="gap-1.5 self-end sm:self-auto" @click="closeDetails">
                                <AppIcon name="circle-x" class="size-3.5" />
                                Close
                            </Button>
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Sheet v-if="canRead" :open="userFiltersSheetOpen" @update:open="userFiltersSheetOpen = $event">
                <SheetContent side="right" variant="form" size="md" class="flex h-full min-h-0 flex-col">
                    <SheetHeader>
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            User Filters
                        </SheetTitle>
                        <SheetDescription>
                            Filter by status, verification, role, sorting, and how many rows appear in the list.
                        </SheetDescription>
                    </SheetHeader>
                    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        <div class="rounded-lg border p-3">
                            <div class="mb-3">
                                <p class="text-sm font-medium">Find user accounts</p>
                                <p class="text-xs text-muted-foreground">Search across name, email, role, and facility assignment.</p>
                            </div>
                            <div class="grid gap-3 sm:grid-cols-2">
                                <div class="grid gap-2 sm:col-span-2">
                                    <Label for="user-search-q-sheet">Search</Label>
                                    <div class="relative">
                                        <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="user-search-q-sheet"
                                            v-model="searchForm.q"
                                            placeholder="Name, email, role, or facility"
                                            class="pl-9"
                                            :disabled="listLoading"
                                            @keyup.enter="submitSearchFromFiltersSheet"
                                        />
                                    </div>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="user-search-status-sheet">Status</Label>
                                    <Select v-model="searchStatusSelectValue">
                                        <SelectTrigger id="user-search-status-sheet" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem :value="allSelectValue">All statuses</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="user-search-verification-sheet">Verification</Label>
                                    <Select v-model="searchVerificationSelectValue">
                                        <SelectTrigger id="user-search-verification-sheet" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem :value="allSelectValue">All users</SelectItem>
                                            <SelectItem value="verified">Verified only</SelectItem>
                                            <SelectItem value="unverified">Unverified only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2 sm:col-span-2">
                                    <Label for="user-search-role-sheet">Role</Label>
                                    <Select v-model="searchRoleSelectValue">
                                        <SelectTrigger id="user-search-role-sheet" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem :value="allSelectValue">All roles</SelectItem>
                                            <SelectItem
                                                v-for="role in roles"
                                                :key="`sheet-role-${String(role.id)}`"
                                                :value="String(role.id ?? '')"
                                            >
                                                {{ role.name || role.code || 'Role' }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div v-if="!isFacilityScopedView" class="grid gap-2 sm:col-span-2">
                                    <Label for="user-search-facility-sheet">Facility</Label>
                                    <Select v-model="searchFacilitySelectValue">
                                        <SelectTrigger id="user-search-facility-sheet" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem :value="allSelectValue">All facilities</SelectItem>
                                            <SelectItem
                                                v-for="facility in availableFacilities"
                                                :key="`sheet-${String(facility.id)}`"
                                                :value="String(facility.id)"
                                            >
                                                {{ facility.code || 'FAC' }} - {{ facility.name || 'Facility' }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="user-search-sort-by-sheet">Sort by</Label>
                                    <Select v-model="searchForm.sortBy">
                                        <SelectTrigger id="user-search-sort-by-sheet" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="name">Name</SelectItem>
                                            <SelectItem value="email">Email</SelectItem>
                                            <SelectItem value="status">Status</SelectItem>
                                            <SelectItem value="createdAt">Created</SelectItem>
                                            <SelectItem value="updatedAt">Updated</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="user-search-sort-dir-sheet">Sort direction</Label>
                                    <Select v-model="searchForm.sortDir">
                                        <SelectTrigger id="user-search-sort-dir-sheet" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="asc">Ascending</SelectItem>
                                            <SelectItem value="desc">Descending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="user-search-per-page-sheet">Rows per page</Label>
                                    <Select :model-value="String(searchForm.perPage)" @update:model-value="searchForm.perPage = Number($event)">
                                        <SelectTrigger id="user-search-per-page-sheet" class="w-full">
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
                                    <Label for="user-search-density-sheet">Row density</Label>
                                    <Select v-model="queueDensityValue">
                                        <SelectTrigger id="user-search-density-sheet" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="comfortable">Comfortable</SelectItem>
                                            <SelectItem value="compact">Compact</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <SheetFooter class="gap-2 border-t px-4 py-3">
                        <Button variant="outline" :disabled="listLoading && !hasActiveUserFilters" @click="resetFiltersFromFiltersSheet">
                            Reset
                        </Button>
                        <Button :disabled="listLoading" @click="submitSearchFromFiltersSheet">
                            Apply Filters
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    </AppLayout>
</template>












