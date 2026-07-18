<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import AppIcon from '@/components/AppIcon.vue';
import ListPagination from '@/components/ListPagination.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PlatformUserDetailsSheet from '@/components/platform-users/PlatformUserDetailsSheet.vue';
import PlatformUserEditSheet from '@/components/platform-users/PlatformUserEditSheet.vue';
import PlatformUserFacilitiesDialog from '@/components/platform-users/PlatformUserFacilitiesDialog.vue';
import PlatformUserRegistrationSheet from '@/components/platform-users/PlatformUserRegistrationSheet.vue';
import PlatformUserRolesDialog from '@/components/platform-users/PlatformUserRolesDialog.vue';
import PlatformUserRowActionsMenu from '@/components/platform-users/PlatformUserRowActionsMenu.vue';
import PlatformUserStatusDialog from '@/components/platform-users/PlatformUserStatusDialog.vue';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { usePlatformUserBulkCredentialLinks, usePlatformUserCredentialLink } from '@/composables/platformUsersIndex/usePlatformUserCredentialLinkMutations';
import { toFacilityDrafts } from '@/composables/platformUsersIndex/usePlatformUserFacilitiesMutations';
import { usePlatformUserList, usePlatformUserStatusCounts, type PlatformUser } from '@/composables/platformUsersIndex/usePlatformUserList';
import { usePlatformUserListFilters } from '@/composables/platformUsersIndex/usePlatformUserListFilters';
import { usePlatformUserRoleOptions } from '@/composables/platformUsersIndex/usePlatformUserRoleOptions';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Platform Admin', href: '/platform/admin/users' },
    { title: 'Users', href: '/platform/admin/users' },
];

const { hasPermission, scope: sharedScope, multiTenantIsolationEnabled, mail: platformMail } = usePlatformAccess();

const canRead = computed(() => hasPermission('platform.users.read'));
const canCreate = computed(() => hasPermission('platform.users.create'));
const canUpdate = computed(() => hasPermission('platform.users.update'));
const canUpdateStatus = computed(() => hasPermission('platform.users.update-status'));
const canResetPassword = computed(() => hasPermission('platform.users.reset-password'));
const canManageRoles = computed(() => hasPermission('platform.rbac.manage-user-roles'));
const canManageFacilities = computed(() => hasPermission('platform.users.manage-facilities'));
const canViewAudit = computed(() => hasPermission('platform.users.view-audit-logs'));
const canReadApprovalCases = computed(() => hasPermission('platform.users.approval-cases.read'));
const canCreateLinkedStaffProfile = computed(() => hasPermission('staff.create'));
const canUseBulkSelection = computed(
    () => canUpdateStatus.value || canResetPassword.value || canManageRoles.value || canManageFacilities.value,
);
const canShowRowActions = computed(
    () => canUpdate.value || canUpdateStatus.value || canResetPassword.value || canReadApprovalCases.value || canCreateLinkedStaffProfile.value,
);

const scope = computed(() => sharedScope.value);
const availableFacilities = computed(() => scope.value?.userAccess?.facilities ?? []);
const scopeUnresolved = computed(() => multiTenantIsolationEnabled.value && (scope.value?.resolvedFrom ?? 'none') === 'none');
const scopedFacilityLabel = computed(() => {
    const facility = scope.value?.facility;
    const name = String(facility?.name ?? '').trim();
    const code = String(facility?.code ?? '').trim();
    if (name && code) return `${name} (${code})`;
    return name || code || null;
});
const scopedFacilityId = computed<string | null>(() => (scope.value?.facility?.id ? String(scope.value.facility.id) : null));
const isFacilityScopedView = computed(() => Boolean(scopedFacilityLabel.value));
const usersWorkspaceTitle = computed(() => (scopedFacilityLabel.value ? 'Facility Users' : 'Platform Users'));
const usersWorkspaceDescription = computed(() =>
    scopedFacilityLabel.value
        ? `Onboard, invite, and maintain user access for ${scopedFacilityLabel.value}.`
        : 'Account queue, lifecycle actions, role mapping, and facility assignments for platform access.',
);
const platformMailDeliversExternally = computed(() => platformMail.value?.deliversExternally !== false);

const filters = usePlatformUserListFilters();
const list = usePlatformUserList(filters, scopedFacilityId);
const statusCounts = usePlatformUserStatusCounts(filters);
const roleOptions = usePlatformUserRoleOptions(scopedFacilityId);

const users = computed(() => list.data.value?.data ?? []);
const meta = computed(() => list.data.value?.meta ?? null);
const roles = computed(() => roleOptions.data.value?.roles ?? []);
const roleAssignmentPolicy = computed(() => roleOptions.data.value?.roleAssignmentPolicy ?? 'full');

const allSelectValue = '__all';
const verificationSelectValue = computed({
    get: () => filters.verification || allSelectValue,
    set: (value: string) => (filters.verification = value === allSelectValue ? '' : value),
});
const roleSelectValue = computed({
    get: () => filters.roleId || allSelectValue,
    set: (value: string) => (filters.roleId = value === allSelectValue ? '' : value),
});
const facilitySelectValue = computed({
    get: () => filters.facilityId || allSelectValue,
    set: (value: string) => (filters.facilityId = value === allSelectValue ? '' : value),
});
const sortSelectValue = computed({
    get: () => `${filters.sortBy}:${filters.sortDir}`,
    set: (value: string) => {
        const [sortBy, sortDir] = value.split(':');
        filters.sortBy = sortBy;
        filters.sortDir = sortDir === 'desc' ? 'desc' : 'asc';
        filters.page = 1;
    },
});

function statusTabCount(value: string): number | null {
    const counts = statusCounts.data.value;
    if (!counts) return null;
    if (value === 'active') return counts.active;
    if (value === 'inactive') return counts.inactive;
    return counts.total;
}

function setStatus(value: string | number): void {
    filters.status = value === 'all' ? '' : String(value);
    filters.page = 1;
}

function submitSearch(): void {
    filters.page = 1;
}

function goToPage(page: number): void {
    if (!meta.value) return;
    filters.page = Math.min(Math.max(page, 1), meta.value.lastPage);
}

function userInitials(user: PlatformUser): string {
    const name = (user.name ?? '').trim();
    if (!name) return '?';
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const MAX_VISIBLE_ROLES_IN_TABLE = 3;

function userRoleSummary(user: PlatformUser): string {
    const roleLabels = (user.roles ?? []).map((role) => (role.name ?? role.code ?? '').trim()).filter(Boolean);
    if (roleLabels.length === 0) return 'No roles assigned';
    if (roleLabels.length <= MAX_VISIBLE_ROLES_IN_TABLE) return roleLabels.join(', ');
    return `${roleLabels.slice(0, MAX_VISIBLE_ROLES_IN_TABLE).join(', ')} +${roleLabels.length - MAX_VISIBLE_ROLES_IN_TABLE} more`;
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive') return 'destructive';
    return 'outline';
}

function verificationVariant(user: PlatformUser): 'outline' | 'secondary' | 'destructive' {
    if (!user.email) return 'outline';
    return user.emailVerifiedAt ? 'secondary' : 'destructive';
}

function verificationLabel(user: PlatformUser): string {
    if (!user.email) return 'Email missing';
    return user.emailVerifiedAt ? 'Email verified' : 'Verification pending';
}

function isUserActive(user: PlatformUser): boolean {
    return (user.status ?? '').toLowerCase() === 'active';
}

function formatDate(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

const queryClient = useQueryClient();

function invalidateList(): void {
    void queryClient.invalidateQueries({ queryKey: ['platform-users-index'] });
    void queryClient.invalidateQueries({ queryKey: ['platform-users-index-status-counts'] });
}

// --- Selection ---
const selectedUserIds = ref<number[]>([]);
const pageUserIds = computed<number[]>(() =>
    users.value.map((user) => (typeof user.id === 'number' ? user.id : null)).filter((id): id is number => id !== null),
);
const allVisibleSelected = computed(() => pageUserIds.value.length > 0 && pageUserIds.value.every((id) => selectedUserIds.value.includes(id)));

function updateUserSelection(userId: number, checked: boolean | 'indeterminate'): void {
    const next = checked === true;
    const current = selectedUserIds.value.includes(userId);
    if (next === current) return;
    selectedUserIds.value = next ? [...selectedUserIds.value, userId] : selectedUserIds.value.filter((id) => id !== userId);
}

function updateSelectAllVisible(checked: boolean | 'indeterminate'): void {
    const next = checked === true;
    if (next === allVisibleSelected.value) return;
    if (next) {
        selectedUserIds.value = Array.from(new Set([...selectedUserIds.value, ...pageUserIds.value]));
    } else {
        const visible = new Set(pageUserIds.value);
        selectedUserIds.value = selectedUserIds.value.filter((id) => !visible.has(id));
    }
}

function clearSelection(): void {
    selectedUserIds.value = [];
}

function selectedUsers(): PlatformUser[] {
    const selected = new Set(selectedUserIds.value);
    return users.value.filter((user) => typeof user.id === 'number' && selected.has(user.id));
}

// --- Create ---
const registerSheetOpen = ref(false);

function onUserCreated(): void {
    filters.page = 1;
    invalidateList();
}

// --- Edit ---
const editSheetOpen = ref(false);
const editingUser = ref<PlatformUser | null>(null);

function openEditSheet(user: PlatformUser): void {
    editingUser.value = user;
    editSheetOpen.value = true;
}

function onUserUpdated(user: PlatformUser): void {
    invalidateList();
    notifySuccess(`User ${user.email ?? `#${user.id ?? ''}`} profile updated.`);
}

// --- Details ---
const detailsSheetOpen = ref(false);
const detailsUserId = ref<number | null>(null);

function openDetails(user: PlatformUser): void {
    detailsUserId.value = typeof user.id === 'number' ? user.id : null;
    detailsSheetOpen.value = true;
}

// --- Status change (single + bulk share one dialog) ---
const statusDialogOpen = ref(false);
const statusDialogTargetUserIds = ref<number[]>([]);
const statusDialogTargetStatus = ref<'active' | 'inactive'>('active');
const statusDialogTargetLabel = ref('');
const statusDialogInitialReason = ref('');

function openStatusDialog(user: PlatformUser, status: 'active' | 'inactive'): void {
    if (typeof user.id !== 'number') return;
    statusDialogTargetUserIds.value = [user.id];
    statusDialogTargetStatus.value = status;
    statusDialogTargetLabel.value = user.name ?? user.email ?? `User #${user.id}`;
    statusDialogInitialReason.value = user.statusReason ?? '';
    statusDialogOpen.value = true;
}

function openBulkStatusDialog(status: 'active' | 'inactive'): void {
    if (selectedUserIds.value.length === 0) return;
    statusDialogTargetUserIds.value = [...selectedUserIds.value];
    statusDialogTargetStatus.value = status;
    statusDialogTargetLabel.value = '';
    statusDialogInitialReason.value = '';
    statusDialogOpen.value = true;
}

function onStatusChanged(updatedUsers: PlatformUser[]): void {
    invalidateList();
    if (updatedUsers.length === 1) {
        const user = updatedUsers[0];
        notifySuccess(`User ${user.email ?? `#${user.id ?? ''}`} updated to ${user.status ?? statusDialogTargetStatus.value}.`);
    } else {
        notifySuccess(`${updatedUsers.length} users ${statusDialogTargetStatus.value === 'inactive' ? 'deactivated' : 'activated'}.`);
    }
    clearSelection();
}

// --- Roles (single + bulk share one dialog) ---
const rolesDialogOpen = ref(false);
const rolesDialogTargetUserIds = ref<number[]>([]);
const rolesDialogTargetLabel = ref('');
const rolesDialogInitialRoleIds = ref<string[]>([]);

function openRolesDialog(user: PlatformUser): void {
    if (typeof user.id !== 'number') return;
    rolesDialogTargetUserIds.value = [user.id];
    rolesDialogTargetLabel.value = user.name ?? user.email ?? `User #${user.id}`;
    rolesDialogInitialRoleIds.value = Array.from(new Set((user.roleIds ?? []).filter(Boolean)));
    rolesDialogOpen.value = true;
}

function openBulkRolesDialog(): void {
    const targets = selectedUsers();
    if (targets.length === 0) return;
    let shared = Array.from(new Set((targets[0].roleIds ?? []).filter(Boolean)));
    for (const user of targets.slice(1)) {
        const ids = new Set((user.roleIds ?? []).filter(Boolean));
        shared = shared.filter((id) => ids.has(id));
    }
    rolesDialogTargetUserIds.value = targets.map((user) => user.id as number);
    rolesDialogTargetLabel.value = '';
    rolesDialogInitialRoleIds.value = shared;
    rolesDialogOpen.value = true;
}

function onRolesChanged(count: number): void {
    invalidateList();
    void queryClient.invalidateQueries({ queryKey: ['platform-users-details'] });
    notifySuccess(`${count} user${count === 1 ? '' : 's'} updated with selected roles.`);
    clearSelection();
}

// --- Facilities (single + bulk share one dialog) ---
const facilitiesDialogOpen = ref(false);
const facilitiesDialogTargetUserIds = ref<number[]>([]);
const facilitiesDialogTargetLabel = ref('');
const facilitiesDialogInitialAssignments = ref(toFacilityDrafts([]));

function openFacilitiesDialog(user: PlatformUser): void {
    if (typeof user.id !== 'number') return;
    facilitiesDialogTargetUserIds.value = [user.id];
    facilitiesDialogTargetLabel.value = user.name ?? user.email ?? `User #${user.id}`;
    facilitiesDialogInitialAssignments.value = toFacilityDrafts(user.facilityAssignments);
    facilitiesDialogOpen.value = true;
}

function openBulkFacilitiesDialog(): void {
    const targets = selectedUsers();
    if (targets.length === 0) return;
    facilitiesDialogTargetUserIds.value = targets.map((user) => user.id as number);
    facilitiesDialogTargetLabel.value = '';
    facilitiesDialogInitialAssignments.value = toFacilityDrafts(targets[0].facilityAssignments);
    facilitiesDialogOpen.value = true;
}

function onFacilitiesChanged(updatedUsers: PlatformUser[]): void {
    invalidateList();
    void queryClient.invalidateQueries({ queryKey: ['platform-users-details'] });
    notifySuccess(`${updatedUsers.length} user${updatedUsers.length === 1 ? '' : 's'} updated with selected facilities.`);
    clearSelection();
}

// --- Credential link (single row action) ---
const credentialLink = usePlatformUserCredentialLink();

async function sendCredentialLink(user: PlatformUser): Promise<void> {
    if (typeof user.id !== 'number') return;
    const isInvite = !user.emailVerifiedAt;
    try {
        const result = await credentialLink.mutateAsync({ userId: user.id, isInvite });
        const label = isInvite ? 'Invite' : 'Password reset';
        notifySuccess(
            platformMailDeliversExternally.value
                ? `${label} link sent for ${user.email ?? `User #${user.id}`}.`
                : `${label} link generated for ${user.email ?? `User #${user.id}`}, but email delivery is currently set to log only.`,
        );
    } catch (error) {
        notifyError(messageFromUnknown(error, `Unable to send ${isInvite ? 'invitation' : 'reset'} link.`));
    }
}

// --- Bulk credential links (no dialog, one click — matches legacy) ---
const bulkCredentialLinks = usePlatformUserBulkCredentialLinks();

async function dispatchBulkCredentialLinks(): Promise<void> {
    if (selectedUserIds.value.length === 0) return;
    try {
        const result = await bulkCredentialLinks.mutateAsync([...selectedUserIds.value]);
        const skippedCount = result.skippedUserIds.length;
        const failedCount = result.failedCount ?? result.failed.length;
        const message =
            `${result.dispatchedCount} credential links sent (${result.inviteCount} invites, ${result.resetCount} resets)` +
            `${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}${failedCount > 0 ? `, ${failedCount} failed` : ''}.`;
        if (result.dispatchedCount > 0) notifySuccess(message);
        else notifyError(message);

        if (result.failedUserIds.length > 0) {
            selectedUserIds.value = Array.from(new Set(result.failedUserIds));
        } else {
            clearSelection();
        }
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to send bulk credential links.'));
    }
}

function openApprovalCases(user: PlatformUser): void {
    if (typeof user.id !== 'number') return;
    window.location.assign(`/platform/admin/user-approval-cases?targetUserId=${user.id}`);
}

function openCreateStaffProfile(user: PlatformUser): void {
    if (typeof user.id !== 'number' || !canCreateLinkedStaffProfile.value) return;
    const url = new URL('/staff', window.location.origin);
    url.searchParams.set('createUserId', String(user.id));
    window.location.assign(`${url.pathname}${url.search}`);
}

function createStaffProfileForDetailsUser(): void {
    const user = users.value.find((entry) => entry.id === detailsUserId.value);
    if (user) openCreateStaffProfile(user);
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head :title="usersWorkspaceTitle" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div ref="scrollContainer" class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg" :style="{ height: scrollContainerHeight }">
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">{{ usersWorkspaceTitle }}</h1>
                        <p class="text-sm text-muted-foreground">{{ usersWorkspaceDescription }}</p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <Badge v-if="meta" variant="secondary">{{ meta.total }} users</Badge>
                        <Button v-if="canCreate" size="sm" class="h-8 gap-1.5" @click="registerSheetOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            Create user
                        </Button>
                    </div>
                </div>

                <div v-if="canRead" class="mt-3 grid grid-cols-3 gap-2">
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Active</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusTabCount('active') ?? '—' }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Inactive</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusTabCount('inactive') ?? '—' }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusTabCount('') ?? '—' }}</p>
                    </div>
                </div>

                <Tabs v-if="canRead" :model-value="filters.status || 'all'" class="mt-3" @update:model-value="setStatus">
                    <TabsList class="grid w-full grid-cols-3">
                        <TabsTrigger value="active" class="inline-flex items-center gap-1.5">
                            Active
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusTabCount('active') ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="inactive" class="inline-flex items-center gap-1.5">
                            Inactive
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusTabCount('inactive') ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                            All
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusTabCount('') ?? '—' }}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div v-if="canRead" class="mt-3 flex flex-wrap items-center gap-2">
                    <div class="relative min-w-0 flex-1">
                        <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input v-model="filters.q" placeholder="Search name or email…" class="h-9 pl-9" @keyup.enter="submitSearch" />
                    </div>
                    <Select v-model="verificationSelectValue">
                        <SelectTrigger class="h-9 w-40 bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem :value="allSelectValue">Any verification</SelectItem>
                            <SelectItem value="verified">Verified</SelectItem>
                            <SelectItem value="unverified">Unverified</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select v-model="roleSelectValue">
                        <SelectTrigger class="h-9 w-44 bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem :value="allSelectValue">Any role</SelectItem>
                            <SelectItem v-for="role in roles" :key="String(role.id)" :value="String(role.id)">
                                {{ role.name ?? role.code ?? role.id }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <Select v-if="!isFacilityScopedView" v-model="facilitySelectValue">
                        <SelectTrigger class="h-9 w-48 bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem :value="allSelectValue">Any facility</SelectItem>
                            <SelectItem v-for="facility in availableFacilities" :key="String(facility.id)" :value="String(facility.id)">
                                {{ facility.code ?? 'FAC' }} - {{ facility.name ?? 'Facility' }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <Select v-model="sortSelectValue">
                        <SelectTrigger class="h-9 w-44 bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name:asc">Name (A–Z)</SelectItem>
                            <SelectItem value="name:desc">Name (Z–A)</SelectItem>
                            <SelectItem value="createdAt:desc">Newest first</SelectItem>
                            <SelectItem value="createdAt:asc">Oldest first</SelectItem>
                            <SelectItem value="status:asc">Status</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canRead" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing users requires <code>platform.users.read</code>.</AlertDescription>
                </Alert>

                <template v-else>
                    <Alert v-if="scopeUnresolved" variant="destructive">
                        <AlertTitle>Scope unresolved</AlertTitle>
                        <AlertDescription>Your tenant/facility scope could not be determined. Some results may be incomplete.</AlertDescription>
                    </Alert>

                    <div
                        v-if="canUseBulkSelection && selectedUserIds.length > 0"
                        class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                    >
                        <span class="text-sm font-medium">{{ selectedUserIds.length }} selected</span>
                        <Button v-if="canResetPassword" size="sm" variant="outline" :disabled="bulkCredentialLinks.isPending.value" @click="dispatchBulkCredentialLinks">
                            Send links
                        </Button>
                        <Button v-if="canManageRoles" size="sm" variant="outline" @click="openBulkRolesDialog">Assign roles</Button>
                        <Button v-if="canManageFacilities" size="sm" variant="outline" @click="openBulkFacilitiesDialog">Assign facilities</Button>
                        <Button v-if="canUpdateStatus" size="sm" variant="outline" @click="openBulkStatusDialog('active')">Activate selected</Button>
                        <Button v-if="canUpdateStatus" size="sm" variant="outline" @click="openBulkStatusDialog('inactive')">Deactivate selected</Button>
                        <Button size="sm" variant="ghost" class="ml-auto" @click="clearSelection">Clear</Button>
                    </div>

                    <div v-if="list.isPending.value" class="space-y-2">
                        <Skeleton class="h-14 w-full" />
                        <Skeleton class="h-14 w-full" />
                        <Skeleton class="h-14 w-full" />
                    </div>

                    <Alert v-else-if="list.isError.value" variant="destructive">
                        <AlertTitle>Unable to load users</AlertTitle>
                        <AlertDescription>{{ (list.error.value as Error | null)?.message ?? 'Unknown error.' }}</AlertDescription>
                    </Alert>

                    <div v-else-if="users.length === 0" class="rounded-lg border border-dashed bg-card px-5 py-5">
                        <p class="text-sm font-medium text-foreground">No users found</p>
                        <p class="mt-1 text-xs text-muted-foreground">Try adjusting the search query or filters.</p>
                    </div>

                    <div v-else class="overflow-hidden rounded-lg border bg-card">
                        <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="border-b bg-muted/30 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th v-if="canUseBulkSelection" class="w-8 px-3 py-2">
                                        <Checkbox :model-value="allVisibleSelected" @update:model-value="updateSelectAllVisible" />
                                    </th>
                                    <th class="px-3 py-2 text-left">User</th>
                                    <th class="px-3 py-2 text-left">Status</th>
                                    <th class="px-3 py-2 text-left">Verification</th>
                                    <th class="px-3 py-2 text-left">Roles</th>
                                    <th class="px-3 py-2 text-left">Created</th>
                                    <th v-if="canShowRowActions" class="px-3 py-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="user in users" :key="String(user.id)" class="border-b last:border-b-0 hover:bg-muted/20">
                                    <td v-if="canUseBulkSelection" class="px-3 py-2">
                                        <Checkbox
                                            :model-value="typeof user.id === 'number' && selectedUserIds.includes(user.id)"
                                            @update:model-value="(checked) => typeof user.id === 'number' && updateUserSelection(user.id, checked)"
                                        />
                                    </td>
                                    <td class="px-3 py-2">
                                        <div class="flex items-center gap-2.5">
                                            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                                {{ userInitials(user) }}
                                            </div>
                                            <div class="min-w-0">
                                                <button type="button" class="truncate text-left font-medium text-foreground hover:underline" @click="openDetails(user)">
                                                    {{ user.name || 'Unnamed user' }}
                                                </button>
                                                <p class="truncate text-xs text-muted-foreground">{{ user.email || 'No email' }}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-3 py-2">
                                        <Badge :variant="statusVariant(user.status)">{{ user.status || 'unknown' }}</Badge>
                                    </td>
                                    <td class="px-3 py-2">
                                        <Badge :variant="verificationVariant(user)">{{ verificationLabel(user) }}</Badge>
                                    </td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ userRoleSummary(user) }}</td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ formatDate(user.createdAt) }}</td>
                                    <td v-if="canShowRowActions" class="px-3 py-2">
                                        <div class="flex items-center justify-end gap-1">
                                            <PlatformUserRowActionsMenu
                                                :user="user"
                                                :can-reset-password="canResetPassword"
                                                :can-read-approval-cases="canReadApprovalCases"
                                                :can-create-linked-staff-profile="canCreateLinkedStaffProfile"
                                                @credential-link="sendCredentialLink(user)"
                                                @approval-cases="openApprovalCases(user)"
                                                @create-staff-profile="openCreateStaffProfile(user)"
                                            />
                                            <Button v-if="canUpdate" size="sm" variant="ghost" class="h-7 gap-1 px-2 text-xs" @click="openEditSheet(user)">
                                                <AppIcon name="pencil" class="size-3.5" />Edit
                                            </Button>
                                            <Button
                                                v-if="canUpdateStatus"
                                                size="sm"
                                                variant="ghost"
                                                class="h-7 gap-1 px-2 text-xs"
                                                @click="openStatusDialog(user, isUserActive(user) ? 'inactive' : 'active')"
                                            >
                                                <AppIcon name="refresh-cw" class="size-3.5" />{{ isUserActive(user) ? 'Deactivate' : 'Activate' }}
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        </div>

                        <div v-if="meta && meta.lastPage > 1" class="border-t px-3 py-3">
                            <ListPagination
                                :current-page="meta.currentPage"
                                :last-page="meta.lastPage"
                                :total="meta.total"
                                item-label="users"
                                @update:page="goToPage"
                            />
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <PlatformUserRegistrationSheet
            v-model:open="registerSheetOpen"
            :roles="roles"
            :role-assignment-policy="roleAssignmentPolicy"
            :can-send-invite="canResetPassword"
            :mail-delivers-externally="platformMailDeliversExternally"
            @created="onUserCreated"
        />
        <PlatformUserEditSheet v-model:open="editSheetOpen" :user="editingUser" @updated="onUserUpdated" />
        <PlatformUserDetailsSheet
            v-model:open="detailsSheetOpen"
            :user-id="detailsUserId"
            :roles="roles"
            :role-assignment-policy="roleAssignmentPolicy"
            :available-facilities="availableFacilities"
            :can-manage-roles="canManageRoles"
            :can-manage-facilities="canManageFacilities"
            :can-view-audit="canViewAudit"
            :can-reset-password="canResetPassword"
            :can-create-linked-staff-profile="canCreateLinkedStaffProfile"
            :mail-delivers-externally="platformMailDeliversExternally"
            @create-staff-profile="createStaffProfileForDetailsUser"
        />
        <PlatformUserStatusDialog
            v-model:open="statusDialogOpen"
            :target-user-ids="statusDialogTargetUserIds"
            :target-status="statusDialogTargetStatus"
            :target-label="statusDialogTargetLabel"
            :initial-reason="statusDialogInitialReason"
            @changed="onStatusChanged"
        />
        <PlatformUserRolesDialog
            v-model:open="rolesDialogOpen"
            :target-user-ids="rolesDialogTargetUserIds"
            :target-label="rolesDialogTargetLabel"
            :initial-role-ids="rolesDialogInitialRoleIds"
            :roles="roles"
            :role-assignment-policy="roleAssignmentPolicy"
            @changed="(updates) => onRolesChanged(updates.length)"
        />
        <PlatformUserFacilitiesDialog
            v-model:open="facilitiesDialogOpen"
            :target-user-ids="facilitiesDialogTargetUserIds"
            :target-label="facilitiesDialogTargetLabel"
            :initial-assignments="facilitiesDialogInitialAssignments"
            :available-facilities="availableFacilities"
            @changed="onFacilitiesChanged"
        />
    </AppLayout>
</template>
