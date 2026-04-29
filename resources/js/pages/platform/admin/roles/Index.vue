<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
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
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { Textarea } from '@/components/ui/textarea';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type ScopeData = {
    resolvedFrom: string;
};

type PlatformRole = {
    id: string | null;
    code: string | null;
    name: string | null;
    status: string | null;
    description: string | null;
    isSystem: boolean;
    permissionsCount: number;
    usersCount: number;
    permissionNames: string[];
    createdAt: string | null;
    updatedAt: string | null;
};

type PlatformPermission = {
    id: number | null;
    name: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type PlatformRbacAuditLog = {
    id: string;
    actorId: number | null;
    actorType?: 'system' | 'user' | null;
    actor?: { displayName?: string | null } | null;
    action: string | null;
    actionLabel?: string | null;
    targetType: string | null;
    targetId: string | null;
    createdAt: string | null;
};

type Pagination = {
    currentPage: number;
    perPage: number;
    total: number;
    lastPage: number;
};

type ValidationErrorResponse = {
    message?: string;
    code?: string;
    errors?: Record<string, string[]>;
};
type CheckboxCheckedState = boolean | 'indeterminate';

type PlatformRoleListResponse = { data: PlatformRole[]; meta: Pagination };
type PlatformRoleResponse = { data: PlatformRole };
type PlatformPermissionListResponse = { data: PlatformPermission[]; meta: Pagination };
type PlatformRbacAuditLogListResponse = { data: PlatformRbacAuditLog[]; meta: Pagination };

type SearchForm = {
    q: string;
    status: string;
    sortBy: string;
    sortDir: 'asc' | 'desc';
    perPage: number;
    page: number;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Platform Admin', href: '/platform/admin/roles' },
    { title: 'RBAC', href: '/platform/admin/roles' },
];

const { permissionNames, permissionState, scope: sharedScope, multiTenantIsolationEnabled } = usePlatformAccess();

const permissionsResolved = computed(() => permissionNames.value !== null);
const canRead = computed(() => permissionState('platform.rbac.read') === 'allowed');
const canManageRoles = computed(() => permissionState('platform.rbac.manage-roles') === 'allowed');
const canViewAudit = computed(() => permissionState('platform.rbac.view-audit-logs') === 'allowed');
const scope = computed<ScopeData | null>(() => (sharedScope.value as ScopeData | null) ?? null);
const scopeUnresolved = computed(() => multiTenantIsolationEnabled.value && (scope.value?.resolvedFrom ?? 'none') === 'none');

const pageLoading = ref(true);
const listLoading = ref(false);
const actionLoadingId = ref<string | null>(null);
const actionMessage = ref<string | null>(null);
const listErrors = ref<string[]>([]);
const roles = ref<PlatformRole[]>([]);
const pagination = ref<Pagination | null>(null);

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

function queryNumberParam(name: string, fallback: number, allowed: number[]): number {
    const parsed = Number.parseInt(queryParam(name), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return allowed.includes(parsed) ? parsed : fallback;
}

const searchForm = reactive<SearchForm>({
    q: queryParam('q'),
    status: queryParam('status'),
    sortBy: queryParam('sortBy') || 'name',
    sortDir: queryParam('sortDir') === 'desc' ? 'desc' : 'asc',
    perPage: queryNumberParam('perPage', 12, [12, 24, 48]),
    page: Math.max(Number.parseInt(queryParam('page') || '1', 10) || 1, 1),
});

const createForm = reactive({
    code: '',
    name: '',
    description: '',
});
const createLoading = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const createMessage = ref<string | null>(null);

const createDialogOpen = ref(false);
const showAdvancedFilters = useLocalStorageBoolean('platform.rbac.filters.advanced', false);
const compactQueueRows = useLocalStorageBoolean('platform.rbac.queueRows.compact', false);
const mobileFiltersDrawerOpen = ref(false);

const permissionsLoading = ref(false);
const permissionsError = ref<string | null>(null);
const permissionsCatalog = ref<PlatformPermission[]>([]);

const detailsOpen = ref(false);
const detailsLoading = ref(false);
const detailsSheetTab = ref('overview');
const detailsRole = ref<PlatformRole | null>(null);
const detailsForm = reactive({
    code: '',
    name: '',
    description: '',
    status: 'active',
});
const detailsFormErrors = ref<Record<string, string[]>>({});
const saveRoleLoading = ref(false);
const permissionDraftNames = ref<string[]>([]);
const permissionDraftDirty = ref(false);
const permissionSearch = ref('');
const savePermissionsLoading = ref(false);

const deleteRoleDialogOpen = ref(false);
const deleteRoleLoading = ref(false);
const deleteRoleError = ref<string | null>(null);

const detailsAuditLoading = ref(false);
const detailsAuditError = ref<string | null>(null);
const detailsAuditLogs = ref<PlatformRbacAuditLog[]>([]);
const detailsAuditMeta = ref<Pagination | null>(null);
const detailsAuditFiltersOpen = ref(false);
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

const hasAdvancedFilters = computed(() => Boolean(searchForm.sortBy !== 'name' || searchForm.sortDir !== 'asc' || searchForm.perPage !== 12));
const hasAnyFilters = computed(() => Boolean(searchForm.q.trim() || searchForm.status || hasAdvancedFilters.value));
const filterBadgeCount = computed(() => {
    let count = 0;
    if (searchForm.q.trim()) count += 1;
    if (searchForm.status) count += 1;
    if (searchForm.sortBy !== 'name') count += 1;
    if (searchForm.sortDir !== 'asc') count += 1;
    if (searchForm.perPage !== 12) count += 1;
    return count;
});
const canPrev = computed(() => (pagination.value?.currentPage ?? 1) > 1);
const canNext = computed(() => (pagination.value ? pagination.value.currentPage < pagination.value.lastPage : false));

const summary = computed(() => {
    const counts = {
        active: 0,
        inactive: 0,
        other: 0,
        system: 0,
    };
    for (const role of roles.value) {
        const status = (role.status ?? '').toLowerCase();
        if (status === 'active') counts.active += 1;
        else if (status === 'inactive') counts.inactive += 1;
        else counts.other += 1;
        if (role.isSystem) counts.system += 1;
    }
    return counts;
});
const roleQueueSummaryText = computed(() => {
    const segments = [`${summary.value.active} active`, `${summary.value.inactive} inactive`];

    if (summary.value.system > 0) {
        segments.push(`${summary.value.system} system`);
    }

    if (summary.value.other > 0) {
        segments.push(`${summary.value.other} other`);
    }

    if (filterBadgeCount.value > 0) {
        segments.push(`${filterBadgeCount.value} filters applied`);
    }

    return segments.join(' | ');
});

const queueDensityValue = computed({
    get: () => (compactQueueRows.value ? 'compact' : 'comfortable'),
    set: (value: string) => {
        compactQueueRows.value = value === 'compact';
    },
});

const permissionsFiltered = computed(() => {
    const q = permissionSearch.value.trim().toLowerCase();
    if (!q) return permissionsCatalog.value;
    return permissionsCatalog.value.filter((permission) => (permission.name ?? '').toLowerCase().includes(q));
});

const detailsIsSystem = computed(() => Boolean(detailsRole.value?.isSystem));

const detailsTabGridClass = computed(() =>
    canManageRoles.value && !detailsIsSystem.value ? 'grid w-full grid-cols-4' : 'grid w-full grid-cols-3',
);

const detailsRoleIdentity = computed(() => {
    const source = (detailsRole.value?.name ?? detailsRole.value?.code ?? 'Role').trim();
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    const initials = parts
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('');

    return initials || 'RL';
});

const detailsRoleSavedPermissionNames = computed(() => normalizePermissionNames(detailsRole.value?.permissionNames ?? []));

const selectedPermissionNames = computed(() => {
    if (permissionDraftDirty.value) {
        return normalizePermissionNames(permissionDraftNames.value);
    }

    if (permissionDraftNames.value.length > 0) {
        return normalizePermissionNames(permissionDraftNames.value);
    }

    return detailsRoleSavedPermissionNames.value;
});

const detailsRolePermissionCount = computed(() => {
    const payloadCount = Number(detailsRole.value?.permissionsCount ?? 0);
    const savedCount = detailsRoleSavedPermissionNames.value.length;

    return savedCount > 0 ? savedCount : payloadCount;
});

const detailsPermissionNamespaces = computed(() => {
    const namespaces = Array.from(
        new Set(
            selectedPermissionNames.value
                .map((name) =>
                    String(name)
                        .split('.')
                        .slice(0, 2)
                        .join('.')
                        .trim(),
                )
                .filter((entry) => entry !== ''),
        ),
    ).sort((a, b) => a.localeCompare(b));

    return {
        visible: namespaces.slice(0, 6),
        hiddenCount: Math.max(0, namespaces.length - 6),
        total: namespaces.length,
    };
});

function normalizePermissionNames(names: string[]): string[] {
    return Array.from(
        new Set(
            names
                .map((name) => String(name).trim())
                .filter((name) => name !== ''),
        ),
    ).sort((a, b) => a.localeCompare(b));
}

function roleStatusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive') return 'destructive';
    return 'outline';
}

function csrfToken(): string | null {
    const element = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    return element?.content ?? null;
}

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
        body = options?.body ? JSON.stringify(options.body) : undefined;
    }

    const response = await fetch(url.toString(), {
        method,
        credentials: 'same-origin',
        headers,
        body,
    });

    if (response.status === 204) return {} as T;

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

function normalizeRolePayload(payload: Partial<PlatformRole> & Record<string, unknown>): PlatformRole {
    const permissionNamesSource = Array.isArray(payload.permissionNames)
        ? payload.permissionNames
        : Array.isArray(payload.permission_names)
          ? payload.permission_names
          : [];

    const normalizedPermissionNames = normalizePermissionNames(
        permissionNamesSource
            .map((entry) => (typeof entry === 'string' ? entry : String(entry ?? '').trim()))
            .filter((entry) => entry !== ''),
    );

    const permissionsCountSource =
        typeof payload.permissionsCount === 'number'
            ? payload.permissionsCount
            : typeof payload.permissions_count === 'number'
              ? payload.permissions_count
              : normalizedPermissionNames.length;

    const usersCountSource =
        typeof payload.usersCount === 'number'
            ? payload.usersCount
            : typeof payload.users_count === 'number'
              ? payload.users_count
              : 0;

    return {
        id: typeof payload.id === 'string' ? payload.id : payload.id === null ? null : String(payload.id ?? ''),
        code: typeof payload.code === 'string' ? payload.code : payload.code === null ? null : String(payload.code ?? ''),
        name: typeof payload.name === 'string' ? payload.name : payload.name === null ? null : String(payload.name ?? ''),
        status: typeof payload.status === 'string' ? payload.status : payload.status === null ? null : String(payload.status ?? ''),
        description:
            typeof payload.description === 'string'
                ? payload.description
                : payload.description === null
                  ? null
                  : String(payload.description ?? ''),
        isSystem: Boolean(payload.isSystem ?? payload.is_system ?? false),
        permissionsCount: Number.isFinite(permissionsCountSource) ? Number(permissionsCountSource) : normalizedPermissionNames.length,
        usersCount: Number.isFinite(usersCountSource) ? Number(usersCountSource) : 0,
        permissionNames: normalizedPermissionNames,
        createdAt:
            typeof payload.createdAt === 'string'
                ? payload.createdAt
                : typeof payload.created_at === 'string'
                  ? payload.created_at
                  : null,
        updatedAt:
            typeof payload.updatedAt === 'string'
                ? payload.updatedAt
                : typeof payload.updated_at === 'string'
                  ? payload.updated_at
                  : null,
    };
}

function syncRoleInList(role: PlatformRole): void {
    const normalizedRole = normalizeRolePayload(role as Partial<PlatformRole> & Record<string, unknown>);
    const index = roles.value.findIndex((entry) => entry.id === normalizedRole.id);
    if (index >= 0) {
        roles.value[index] = normalizedRole;
        return;
    }
    roles.value = [normalizedRole, ...roles.value];
}

function removeRoleFromList(roleId: string): void {
    roles.value = roles.value.filter((role) => role.id !== roleId);
}

async function loadRoles() {
    if (!canRead.value) {
        roles.value = [];
        pagination.value = null;
        pageLoading.value = false;
        listLoading.value = false;
        return;
    }

    listLoading.value = true;
    listErrors.value = [];
    try {
        const response = await apiRequest<PlatformRoleListResponse>('GET', '/platform/admin/roles', {
            query: {
                q: searchForm.q.trim() || null,
                status: searchForm.status || null,
                sortBy: searchForm.sortBy,
                sortDir: searchForm.sortDir,
                perPage: searchForm.perPage,
                page: searchForm.page,
            },
        });
        roles.value = Array.isArray(response.data)
            ? response.data.map((role) => normalizeRolePayload(role as Partial<PlatformRole> & Record<string, unknown>))
            : [];
        pagination.value = response.meta ?? null;
    } catch (error) {
        roles.value = [];
        pagination.value = null;
        listErrors.value = [messageFromUnknown(error, 'Unable to load roles.')];
    } finally {
        listLoading.value = false;
        pageLoading.value = false;
    }
}

async function loadPermissionsCatalog() {
    if (!canRead.value && !canManageRoles.value) {
        permissionsCatalog.value = [];
        permissionsLoading.value = false;
        permissionsError.value = null;
        return;
    }

    permissionsLoading.value = true;
    permissionsError.value = null;
    try {
        const response = await apiRequest<PlatformPermissionListResponse>('GET', '/platform/admin/permissions', {
            query: {
                page: 1,
                perPage: 200,
            },
        });
        permissionsCatalog.value = response.data ?? [];
    } catch (error) {
        permissionsCatalog.value = [];
        permissionsError.value = messageFromUnknown(error, 'Unable to load permission catalog.');
    } finally {
        permissionsLoading.value = false;
    }
}

async function refreshPage() {
    clearSearchDebounce();
    await Promise.all([loadRoles(), loadPermissionsCatalog()]);
}

function submitSearch() {
    clearSearchDebounce();
    searchForm.page = 1;
    void loadRoles();
}

function submitSearchFromMobileDrawer() {
    submitSearch();
    mobileFiltersDrawerOpen.value = false;
}

function resetFilters() {
    clearSearchDebounce();
    searchForm.q = '';
    searchForm.status = '';
    searchForm.sortBy = 'name';
    searchForm.sortDir = 'asc';
    searchForm.perPage = 12;
    searchForm.page = 1;
    showAdvancedFilters.value = false;
    compactQueueRows.value = false;
    void loadRoles();
}

function resetFiltersFromMobileDrawer() {
    resetFilters();
    mobileFiltersDrawerOpen.value = false;
}

function prevPage() {
    if (!canPrev.value) return;
    clearSearchDebounce();
    searchForm.page -= 1;
    void loadRoles();
}

function nextPage() {
    if (!canNext.value) return;
    clearSearchDebounce();
    searchForm.page += 1;
    void loadRoles();
}

async function createRole() {
    if (!canManageRoles.value || createLoading.value) return;

    createLoading.value = true;
    createErrors.value = {};
    createMessage.value = null;

    try {
        const response = await apiRequest<PlatformRoleResponse>('POST', '/platform/admin/roles', {
            body: {
                code: createForm.code.trim(),
                name: createForm.name.trim(),
                description: createForm.description.trim() || null,
            },
        });
        const createdRole = normalizeRolePayload(response.data as Partial<PlatformRole> & Record<string, unknown>);
        createMessage.value = `Role ${createdRole.code ?? ''} created successfully.`.trim();
        actionMessage.value = createMessage.value;
        notifySuccess(createMessage.value);
        createForm.code = '';
        createForm.name = '';
        createForm.description = '';
        createDialogOpen.value = false;
        searchForm.page = 1;
        await loadRoles();
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
        } else {
            notifyError(messageFromUnknown(error, 'Unable to create role.'));
        }
    } finally {
        createLoading.value = false;
    }
}

async function quickToggleStatus(role: PlatformRole) {
    const roleId = String(role.id ?? '');
    if (!roleId || !canManageRoles.value || actionLoadingId.value !== null) return;
    const targetStatus = (role.status ?? '').toLowerCase() === 'active' ? 'inactive' : 'active';

    actionLoadingId.value = roleId;
    try {
        const response = await apiRequest<PlatformRoleResponse>('PATCH', `/platform/admin/roles/${roleId}`, {
            body: { status: targetStatus },
        });
        const updatedRole = normalizeRolePayload(response.data as Partial<PlatformRole> & Record<string, unknown>);
        syncRoleInList(updatedRole);
        if (detailsRole.value?.id === updatedRole.id) {
            detailsRole.value = updatedRole;
            detailsForm.status = updatedRole.status ?? 'active';
        }
        actionMessage.value = `Role ${updatedRole.code ?? roleId} updated to ${targetStatus}.`;
        notifySuccess(actionMessage.value);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to update role status.'));
    } finally {
        actionLoadingId.value = null;
    }
}

async function openDetails(role: PlatformRole) {
    const roleId = String(role.id ?? '');
    if (!roleId) return;

    detailsOpen.value = true;
    detailsLoading.value = true;
    detailsSheetTab.value = 'overview';
    detailsRole.value = null;
    detailsFormErrors.value = {};
    permissionSearch.value = '';
    deleteRoleError.value = null;

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
    detailsAuditFiltersOpen.value = false;

    try {
        const response = await apiRequest<PlatformRoleResponse>('GET', `/platform/admin/roles/${roleId}`);
        const resolvedRole = normalizeRolePayload(response.data as Partial<PlatformRole> & Record<string, unknown>);
        detailsRole.value = resolvedRole;
        detailsForm.code = resolvedRole.code ?? '';
        detailsForm.name = resolvedRole.name ?? '';
        detailsForm.description = resolvedRole.description ?? '';
        detailsForm.status = resolvedRole.status ?? 'active';
        permissionDraftNames.value = normalizePermissionNames(resolvedRole.permissionNames ?? []);
        permissionDraftDirty.value = false;
        await loadDetailsAudit(roleId);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to load role details.'));
        detailsRole.value = null;
    } finally {
        detailsLoading.value = false;
    }
}

function closeDetails() {
    detailsOpen.value = false;
    detailsSheetTab.value = 'overview';
    detailsRole.value = null;
    detailsForm.code = '';
    detailsForm.name = '';
    detailsForm.description = '';
    detailsForm.status = 'active';
    detailsFormErrors.value = {};
    permissionDraftNames.value = [];
    permissionDraftDirty.value = false;
    permissionSearch.value = '';
    detailsAuditLogs.value = [];
    detailsAuditMeta.value = null;
    detailsAuditError.value = null;
    detailsAuditFiltersOpen.value = false;
    deleteRoleDialogOpen.value = false;
    deleteRoleError.value = null;
}

async function saveRoleMetadata() {
    const roleId = String(detailsRole.value?.id ?? '');
    if (!roleId || !canManageRoles.value || saveRoleLoading.value) return;

    saveRoleLoading.value = true;
    detailsFormErrors.value = {};
    try {
        const response = await apiRequest<PlatformRoleResponse>('PATCH', `/platform/admin/roles/${roleId}`, {
            body: {
                code: detailsForm.code.trim(),
                name: detailsForm.name.trim(),
                description: detailsForm.description.trim() || null,
                status: detailsForm.status,
            },
        });
        const updatedRole = normalizeRolePayload(response.data as Partial<PlatformRole> & Record<string, unknown>);
        detailsRole.value = updatedRole;
        detailsForm.code = updatedRole.code ?? '';
        detailsForm.name = updatedRole.name ?? '';
        detailsForm.description = updatedRole.description ?? '';
        detailsForm.status = updatedRole.status ?? 'active';
        permissionDraftNames.value = normalizePermissionNames(updatedRole.permissionNames ?? []);
        permissionDraftDirty.value = false;
        syncRoleInList(updatedRole);
        actionMessage.value = `Role ${updatedRole.code ?? roleId} metadata updated.`;
        notifySuccess(actionMessage.value);
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            detailsFormErrors.value = apiError.payload.errors;
        } else {
            notifyError(messageFromUnknown(error, 'Unable to update role.'));
        }
    } finally {
        saveRoleLoading.value = false;
    }
}

function togglePermissionName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!permissionDraftDirty.value && permissionDraftNames.value.length === 0) {
        permissionDraftNames.value = [...selectedPermissionNames.value];
    }

    permissionDraftDirty.value = true;

    if (permissionDraftNames.value.includes(trimmed)) {
        permissionDraftNames.value = permissionDraftNames.value.filter((entry) => entry !== trimmed);
    } else {
        permissionDraftNames.value = normalizePermissionNames([...permissionDraftNames.value, trimmed]);
    }
}

function updatePermissionSelection(name: string, checked: CheckboxCheckedState): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const nextChecked = checked === true;
    const currentlyChecked = selectedPermissionNames.value.includes(trimmed);
    if (nextChecked === currentlyChecked) return;
    togglePermissionName(trimmed);
}

async function saveRolePermissions() {
    const roleId = String(detailsRole.value?.id ?? '');
    if (!roleId || !canManageRoles.value || savePermissionsLoading.value || detailsIsSystem.value) return;

    savePermissionsLoading.value = true;
    try {
        const response = await apiRequest<PlatformRoleResponse>('PATCH', `/platform/admin/roles/${roleId}/permissions`, {
            body: {
                permissionNames: normalizePermissionNames(selectedPermissionNames.value),
            },
        });
        const updatedRole = normalizeRolePayload(response.data as Partial<PlatformRole> & Record<string, unknown>);
        detailsRole.value = updatedRole;
        permissionDraftNames.value = normalizePermissionNames(updatedRole.permissionNames ?? []);
        permissionDraftDirty.value = false;
        syncRoleInList(updatedRole);
        actionMessage.value = `Permissions synced for role ${updatedRole.code ?? roleId}.`;
        notifySuccess(actionMessage.value);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to sync role permissions.'));
    } finally {
        savePermissionsLoading.value = false;
    }
}

function openDeleteRoleDialog() {
    deleteRoleError.value = null;
    deleteRoleDialogOpen.value = true;
}

function closeDeleteRoleDialog() {
    deleteRoleDialogOpen.value = false;
    deleteRoleError.value = null;
}

async function deleteRoleFromDetails() {
    const roleId = String(detailsRole.value?.id ?? '');
    if (!roleId || !canManageRoles.value || deleteRoleLoading.value || detailsIsSystem.value) return;

    deleteRoleLoading.value = true;
    deleteRoleError.value = null;
    try {
        await apiRequest('DELETE', `/platform/admin/roles/${roleId}`);
        removeRoleFromList(roleId);
        actionMessage.value = `Role ${detailsRole.value?.code ?? roleId} deleted.`;
        notifySuccess(actionMessage.value);
        closeDeleteRoleDialog();
        closeDetails();
        await loadRoles();
    } catch (error) {
        deleteRoleError.value = messageFromUnknown(error, 'Unable to delete role.');
    } finally {
        deleteRoleLoading.value = false;
    }
}

async function loadDetailsAudit(roleId: string) {
    if (!canViewAudit.value) {
        detailsAuditLoading.value = false;
        detailsAuditError.value = null;
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
        return;
    }

    detailsAuditLoading.value = true;
    detailsAuditError.value = null;
    try {
        const response = await apiRequest<PlatformRbacAuditLogListResponse>('GET', '/platform/admin/rbac-audit-logs', {
            query: {
                q: detailsAuditFilters.q.trim() || null,
                action: detailsAuditFilters.action.trim() || null,
                targetType: 'role',
                targetId: roleId,
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
        detailsAuditError.value = messageFromUnknown(error, 'Unable to load RBAC audit logs.');
    } finally {
        detailsAuditLoading.value = false;
    }
}

function applyDetailsAuditFilters() {
    const roleId = String(detailsRole.value?.id ?? '');
    if (!roleId) return;
    detailsAuditFilters.page = 1;
    void loadDetailsAudit(roleId);
}

function resetDetailsAuditFilters() {
    const roleId = String(detailsRole.value?.id ?? '');
    if (!roleId) return;
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    void loadDetailsAudit(roleId);
}

function prevDetailsAuditPage() {
    const roleId = String(detailsRole.value?.id ?? '');
    if (!roleId || !detailsAuditMeta.value || detailsAuditMeta.value.currentPage <= 1) return;
    detailsAuditFilters.page -= 1;
    void loadDetailsAudit(roleId);
}

function nextDetailsAuditPage() {
    const roleId = String(detailsRole.value?.id ?? '');
    if (!roleId || !detailsAuditMeta.value || detailsAuditMeta.value.currentPage >= detailsAuditMeta.value.lastPage) return;
    detailsAuditFilters.page += 1;
    void loadDetailsAudit(roleId);
}

function clearSearchDebounce() {
    if (searchDebounceTimer !== null) {
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
    }
}

watch(
    () => searchForm.q,
    () => {
        clearSearchDebounce();
        searchDebounceTimer = window.setTimeout(() => {
            searchForm.page = 1;
            void loadRoles();
            searchDebounceTimer = null;
        }, 300);
    },
);

watch(
    () => [searchForm.status, searchForm.sortBy, searchForm.sortDir, searchForm.perPage],
    () => {
        searchForm.page = 1;
        void loadRoles();
    },
);
function openCreateDialog() {
    createErrors.value = {};
    createMessage.value = null;
    createForm.code = '';
    createForm.name = '';
    createForm.description = '';
    createDialogOpen.value = true;
}

onBeforeUnmount(clearSearchDebounce);
onMounted(refreshPage);
</script>
<template>
    <Head title="Platform RBAC" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <!-- Page header -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="shield-check" class="size-7 text-primary" />
                        Platform RBAC
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Manage platform roles, permission mapping, and RBAC audit visibility.
                    </p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Badge :variant="scopeUnresolved ? 'destructive' : 'secondary'">
                        {{ scopeUnresolved ? 'Scope Unresolved' : 'Scope Ready' }}
                    </Badge>
                </div>
            </div>

            <!-- Alerts -->
            <Alert v-if="scopeUnresolved" variant="destructive">
                <AlertTitle>Scope warning</AlertTitle>
                <AlertDescription>No tenant/facility scope is resolved. Role create/update may be blocked by tenant isolation controls.</AlertDescription>
            </Alert>

            <Alert v-if="actionMessage">
                <AlertTitle>Action completed</AlertTitle>
                <AlertDescription>{{ actionMessage }}</AlertDescription>
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
                <AlertTitle>RBAC access restricted</AlertTitle>
                <AlertDescription>Request <code>platform.rbac.read</code> permission.</AlertDescription>
            </Alert>

            <template v-else>
                <Alert v-if="listErrors.length" variant="destructive">
                    <AlertTitle>Request error</AlertTitle>
                    <AlertDescription>{{ listErrors[0] }}</AlertDescription>
                </Alert>

                <div class="space-y-4">
                    <div class="flex flex-col gap-3 rounded-lg border border-sidebar-border/70 bg-muted/20 p-3 md:flex-row md:items-center md:justify-between">
                        <div class="flex flex-wrap items-center gap-2">
                            <Button size="sm" :variant="searchForm.status === '' ? 'default' : 'outline'" @click="searchForm.status = ''">
                                <span class="font-medium">{{ pagination?.total ?? roles.length }}</span>
                                All roles
                            </Button>
                            <Button size="sm" :variant="searchForm.status === 'active' ? 'default' : 'outline'" @click="searchForm.status = 'active'">
                                <span class="font-medium">{{ summary.active }}</span>
                                Active
                            </Button>
                            <Button size="sm" :variant="searchForm.status === 'inactive' ? 'default' : 'outline'" @click="searchForm.status = 'inactive'">
                                <span class="font-medium">{{ summary.inactive }}</span>
                                Inactive
                            </Button>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{{ pageLoading ? 'Loading roles...' : roleQueueSummaryText }}</span>
                            <Button v-if="hasAnyFilters" variant="outline" size="sm" @click="resetFilters">Reset</Button>
                            <Button variant="outline" size="sm" class="gap-1.5" :disabled="listLoading || permissionsLoading" @click="refreshPage">
                                <AppIcon name="activity" class="size-3.5" />
                                {{ listLoading || permissionsLoading ? 'Refreshing...' : 'Refresh' }}
                            </Button>
                            <Button v-if="canManageRoles" size="sm" class="gap-1.5" @click="openCreateDialog">
                                <AppIcon name="plus" class="size-3.5" />
                                Create Role
                            </Button>
                        </div>
                    </div>

                    <Card class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col">
                        <CardHeader class="gap-3 border-b pb-3 pt-4">
                            <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                <div class="min-w-0 space-y-1">
                                    <CardTitle class="flex items-center gap-2 text-base">
                                        <AppIcon name="layout-list" class="size-4.5 text-muted-foreground" />
                                        Roles
                                    </CardTitle>
                                    <CardDescription>Select a role to review detail, permissions, and RBAC audit history.</CardDescription>
                                </div>
                                <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:max-w-2xl">
                                    <div class="relative min-w-0 flex-1">
                                        <AppIcon name="search" class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="rbac-search-q"
                                            v-model="searchForm.q"
                                            placeholder="Role code, name, or description"
                                            class="h-9 pl-9"
                                            @keyup.enter="submitSearch"
                                        />
                                    </div>
                                    <Popover>
                                        <PopoverTrigger as-child>
                                            <Button variant="outline" size="sm" class="hidden gap-1.5 md:inline-flex">
                                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                Queue options
                                                <Badge v-if="filterBadgeCount > 0" variant="secondary" class="ml-1 text-[10px]">{{ filterBadgeCount }}</Badge>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent align="end" class="flex max-h-[28rem] w-[20rem] flex-col overflow-hidden rounded-lg border bg-popover p-0 shadow-md">
                                            <div class="space-y-3 border-b px-4 py-3">
                                                <p class="flex items-center gap-2 text-sm font-medium">
                                                    <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                                    Queue options
                                                </p>
                                                <div class="grid gap-2">
                                                    <Label for="rbac-search-status">Status</Label>
                                                    <Select v-model="searchForm.status">
                                                        <SelectTrigger class="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                        <SelectItem value="">All statuses</SelectItem>
                                                        <SelectItem value="active">Active</SelectItem>
                                                        <SelectItem value="inactive">Inactive</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label for="rbac-search-per-page">Per page</Label>
                                                    <Select :model-value="String(searchForm.perPage)" @update:model-value="searchForm.perPage = Number($event)">
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
                                                    <Label for="rbac-search-density">Row density</Label>
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
                                                <div class="grid gap-2 sm:grid-cols-2">
                                                    <div class="grid gap-2">
                                                        <Label for="rbac-search-sort-by">Sort by</Label>
                                                        <Select v-model="searchForm.sortBy">
                                                            <SelectTrigger class="w-full">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                            <SelectItem value="name">Name</SelectItem>
                                                            <SelectItem value="code">Code</SelectItem>
                                                            <SelectItem value="status">Status</SelectItem>
                                                            <SelectItem value="createdAt">Created</SelectItem>
                                                            <SelectItem value="updatedAt">Updated</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div class="grid gap-2">
                                                        <Label for="rbac-search-sort-dir">Sort direction</Label>
                                                        <Select v-model="searchForm.sortDir">
                                                            <SelectTrigger class="w-full">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                            <SelectItem value="asc">Ascending</SelectItem>
                                                            <SelectItem value="desc">Descending</SelectItem>
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
                                    <Button variant="outline" size="sm" class="w-full gap-1.5 md:hidden" @click="mobileFiltersDrawerOpen = true">
                                        <AppIcon name="sliders-horizontal" class="size-3.5" />
                                        Queue options
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent class="p-0">
                            <div v-if="pageLoading || roles.length > 0" class="hidden border-b bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground md:grid md:grid-cols-[minmax(0,2.3fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,auto)] md:items-center md:gap-2.5">
                                <span>Role</span>
                                <span>Status</span>
                                <span>Scope</span>
                                <span class="text-right">Actions</span>
                            </div>
                            <div v-if="listLoading || pageLoading" class="divide-y">
                                <div
                                    v-for="index in 6"
                                    :key="`platform-role-skeleton-${index}`"
                                    class="grid items-center gap-2.5 px-4 transition-colors md:grid-cols-[minmax(0,2.3fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,auto)]"
                                    :class="compactQueueRows ? 'py-2' : 'py-2.5'"
                                >
                                    <div class="min-w-0 space-y-1.5">
                                        <Skeleton class="h-4 w-40" />
                                        <Skeleton class="h-3 w-full max-w-[18rem]" />
                                    </div>
                                    <div class="hidden md:flex items-center gap-2">
                                        <Skeleton class="h-5 w-16 rounded-full" />
                                    </div>
                                    <div class="hidden md:block space-y-1.5">
                                        <Skeleton class="h-3 w-28" />
                                        <Skeleton class="h-3 w-36" />
                                    </div>
                                    <div class="flex items-center justify-end gap-2">
                                        <Skeleton class="hidden h-8 w-20 rounded-md lg:block" />
                                        <Skeleton class="h-8 w-8 rounded-md" />
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground md:hidden">
                                        <Skeleton class="h-5 w-16 rounded-full" />
                                        <Skeleton class="h-3 w-28" />
                                    </div>
                                </div>
                            </div>
                            <div v-else-if="roles.length === 0" class="px-4 py-6">
                                <div class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                    No roles found for the current filters.
                                </div>
                            </div>
                            <div v-else class="divide-y">
                                <div
                                    v-for="role in roles"
                                    :key="String(role.id ?? role.code)"
                                    class="group grid items-center gap-2.5 border-l-2 px-4 transition-colors hover:bg-muted/30 md:grid-cols-[minmax(0,2.3fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,auto)]"
                                    :class="[compactQueueRows ? 'py-2' : 'py-2.5', detailsOpen && detailsRole?.id === role.id ? 'border-primary bg-primary/5' : 'border-transparent']"
                                >
                                    <div class="min-w-0">
                                        <button class="truncate text-left text-sm font-medium hover:text-primary hover:underline" @click="openDetails(role)">
                                            {{ role.name || 'Unnamed role' }}
                                        </button>
                                        <p class="truncate text-xs text-muted-foreground">
                                            {{ role.code || 'No code' }}
                                            <span v-if="role.description"> | {{ role.description }}</span>
                                        </p>
                                    </div>
                                    <div class="hidden items-center gap-2 md:flex">
                                        <Badge :variant="roleStatusVariant(role.status)" class="text-[10px] leading-none">{{ role.status || 'unknown' }}</Badge>
                                        <Badge v-if="role.isSystem" variant="outline" class="text-[10px] leading-none">System</Badge>
                                    </div>
                                    <div class="hidden md:block">
                                        <p class="text-xs text-muted-foreground">{{ role.usersCount }} users | {{ role.permissionsCount }} permissions</p>
                                        <p class="mt-1 text-xs text-muted-foreground">Updated {{ formatDateTime(role.updatedAt) }}</p>
                                    </div>
                                    <div class="flex items-center justify-end gap-2">
                                        <Button variant="ghost" size="sm" class="hidden lg:inline-flex" @click="openDetails(role)">
                                            <AppIcon name="eye" class="size-3.5" />
                                            Open
                                        </Button>
                                        <Button variant="ghost" size="icon-sm" class="lg:hidden" @click="openDetails(role)">
                                            <AppIcon name="eye" class="size-4" />
                                            <span class="sr-only">Open role details</span>
                                        </Button>
                                        <DropdownMenu v-if="canManageRoles">
                                            <DropdownMenuTrigger as-child>
                                                <Button variant="ghost" size="icon-sm">
                                                    <AppIcon name="ellipsis-vertical" class="size-4" />
                                                    <span class="sr-only">More actions</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" class="w-44 rounded-lg">
                                                <DropdownMenuItem class="gap-2" :disabled="actionLoadingId === role.id || role.isSystem" @select="quickToggleStatus(role)">
                                                    <AppIcon name="activity" class="size-4" />
                                                    {{ (role.status ?? '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate' }}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground md:hidden">
                                        <Badge :variant="roleStatusVariant(role.status)" class="text-[10px] leading-none">{{ role.status || 'unknown' }}</Badge>
                                        <Badge v-if="role.isSystem" variant="outline" class="text-[10px] leading-none">System</Badge>
                                        <span>{{ role.usersCount }} users | {{ role.permissionsCount }} permissions</span>
                                    </div>
                                </div>
                            </div>
                            <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3">
                                <p class="text-xs text-muted-foreground">
                                    Showing {{ roles.length }} of {{ pagination?.total ?? roles.length }} results | Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                                </p>
                                <div v-if="(pagination?.lastPage ?? 1) > 1" class="flex items-center gap-2">
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

                    <Dialog v-model:open="createDialogOpen">
                        <DialogContent size="xl">
                            <DialogHeader>
                                <DialogTitle>Create Role</DialogTitle>
                                <DialogDescription>Create scoped RBAC roles for tenant and facility operations.</DialogDescription>
                            </DialogHeader>
                            <div class="grid gap-4 py-2">
                                <div class="grid gap-3 md:grid-cols-2">
                                    <div class="grid gap-2">
                                        <Label for="create-role-code">Code</Label>
                                        <Input id="create-role-code" v-model="createForm.code" placeholder="role.code.example" :disabled="createLoading" />
                                        <p v-if="createErrors.code?.length" class="text-xs text-destructive">{{ createErrors.code[0] }}</p>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="create-role-name">Name</Label>
                                        <Input id="create-role-name" v-model="createForm.name" placeholder="Role display name" :disabled="createLoading" />
                                        <p v-if="createErrors.name?.length" class="text-xs text-destructive">{{ createErrors.name[0] }}</p>
                                    </div>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="create-role-description">Description</Label>
                                    <Textarea id="create-role-description" v-model="createForm.description" class="min-h-24" placeholder="Role purpose and scope..." :disabled="createLoading" />
                                    <p v-if="createErrors.description?.length" class="text-xs text-destructive">{{ createErrors.description[0] }}</p>
                                </div>
                            </div>
                            <DialogFooter class="gap-2">
                                <Button variant="outline" :disabled="createLoading" @click="createDialogOpen = false">Cancel</Button>
                                <Button :disabled="createLoading" class="gap-1.5" @click="createRole">
                                    <AppIcon name="plus" class="size-3.5" />
                                    {{ createLoading ? 'Creating...' : 'Create Role' }}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </template>
            <Sheet :open="detailsOpen" @update:open="(open) => (open ? (detailsOpen = true) : closeDetails())">
                <SheetContent side="right" variant="workspace" size="4xl">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2 text-lg">
                            <AppIcon name="shield" class="size-5 text-primary" />
                            Role Details
                        </SheetTitle>
                        <SheetDescription class="text-sm">
                            Review role scope, manage permission bundles, and inspect RBAC audit history.
                        </SheetDescription>
                    </SheetHeader>

                    <div v-if="detailsLoading" class="space-y-3 p-4">
                        <Skeleton class="h-24 w-full rounded-lg" />
                        <Skeleton class="h-10 w-full rounded-lg" />
                        <Skeleton class="h-40 w-full rounded-lg" />
                        <Skeleton class="h-40 w-full rounded-lg" />
                    </div>

                    <ScrollArea v-else-if="detailsRole" class="min-h-0 flex-1">
                        <div class="space-y-4 p-4">
                            <div class="sticky top-0 z-10 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                <div class="flex items-start gap-4">
                                    <div class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                                        {{ detailsRoleIdentity }}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <div class="flex flex-wrap items-start justify-between gap-2">
                                            <div class="min-w-0">
                                                <p class="text-base font-semibold leading-tight">{{ detailsRole.name || 'Unnamed role' }}</p>
                                                <p class="mt-0.5 text-sm text-muted-foreground">{{ detailsRole.code || 'No code' }}</p>
                                                <p v-if="detailsRole.description" class="mt-1 text-sm text-muted-foreground">
                                                    {{ detailsRole.description }}
                                                </p>
                                            </div>
                                            <div class="flex flex-wrap items-center gap-2">
                                                <Badge :variant="roleStatusVariant(detailsRole.status)" class="shrink-0">
                                                    {{ detailsRole.status || 'unknown' }}
                                                </Badge>
                                                <Badge v-if="detailsRole.isSystem" variant="outline" class="shrink-0">System role</Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <div class="rounded-lg border bg-background p-3">
                                        <p class="text-xs uppercase tracking-wide text-muted-foreground">Users assigned</p>
                                        <p class="mt-1 text-lg font-semibold">{{ detailsRole.usersCount }}</p>
                                    </div>
                                    <div class="rounded-lg border bg-background p-3">
                                        <p class="text-xs uppercase tracking-wide text-muted-foreground">Permissions</p>
                                        <p class="mt-1 text-lg font-semibold">{{ detailsRolePermissionCount }}</p>
                                    </div>
                                    <div class="rounded-lg border bg-background p-3">
                                        <p class="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                                        <p class="mt-1 text-sm font-medium">{{ formatDateTime(detailsRole.createdAt) }}</p>
                                    </div>
                                    <div class="rounded-lg border bg-background p-3">
                                        <p class="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
                                        <p class="mt-1 text-sm font-medium">{{ formatDateTime(detailsRole.updatedAt) }}</p>
                                    </div>
                                </div>
                            </div>

                            <Tabs v-model="detailsSheetTab" class="w-full">
                                <TabsList :class="detailsTabGridClass" class="h-auto rounded-lg bg-muted/50 p-1">
                                    <TabsTrigger value="overview" class="inline-flex items-center gap-1.5 rounded-md text-xs sm:text-sm">
                                        <AppIcon name="layout-grid" class="size-3.5" />
                                        Overview
                                    </TabsTrigger>
                                    <TabsTrigger value="permissions" class="inline-flex items-center gap-1.5 rounded-md text-xs sm:text-sm">
                                        <AppIcon name="shield-check" class="size-3.5" />
                                        Permissions
                                    </TabsTrigger>
                                    <TabsTrigger value="audit" class="inline-flex items-center gap-1.5 rounded-md text-xs sm:text-sm">
                                        <AppIcon name="file-text" class="size-3.5" />
                                        Audit
                                        <Badge v-if="detailsAuditMeta" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                                            {{ detailsAuditMeta.total }}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        v-if="canManageRoles && !detailsIsSystem"
                                        value="danger"
                                        class="inline-flex items-center gap-1.5 rounded-md text-xs sm:text-sm"
                                    >
                                        <AppIcon name="circle-x" class="size-3.5" />
                                        Danger
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" class="mt-3 space-y-3">
                                    <div class="grid gap-3 xl:grid-cols-[1.25fr_0.75fr]">
                                        <Card class="h-full rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <div class="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                            <AppIcon name="shield" class="size-4 text-muted-foreground" />
                                                            Role Metadata
                                                        </CardTitle>
                                                        <CardDescription>Maintain the role code, label, description, and activation status.</CardDescription>
                                                    </div>
                                                    <Button
                                                        v-if="canManageRoles"
                                                        size="sm"
                                                        class="h-7 gap-1.5 text-xs"
                                                        :disabled="saveRoleLoading"
                                                        @click="saveRoleMetadata"
                                                    >
                                                        <AppIcon name="shield-check" class="size-3.5" />
                                                        {{ saveRoleLoading ? 'Saving...' : 'Save Metadata' }}
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-3 px-4 pt-0">
                                                <Alert v-if="!canManageRoles" variant="destructive">
                                                    <AlertTitle>Role editing restricted</AlertTitle>
                                                    <AlertDescription>Request <code>platform.rbac.manage-roles</code> permission.</AlertDescription>
                                                </Alert>

                                                <div class="grid gap-3 sm:grid-cols-2">
                                                    <div class="grid gap-2">
                                                        <Label for="role-details-code">Code</Label>
                                                        <Input id="role-details-code" v-model="detailsForm.code" :disabled="!canManageRoles || detailsIsSystem" />
                                                        <p v-if="detailsFormErrors.code?.length" class="text-xs text-destructive">{{ detailsFormErrors.code[0] }}</p>
                                                    </div>
                                                    <div class="grid gap-2">
                                                        <Label for="role-details-name">Name</Label>
                                                        <Input id="role-details-name" v-model="detailsForm.name" :disabled="!canManageRoles" />
                                                        <p v-if="detailsFormErrors.name?.length" class="text-xs text-destructive">{{ detailsFormErrors.name[0] }}</p>
                                                    </div>
                                                    <div class="grid gap-2 sm:col-span-2">
                                                        <Label for="role-details-description">Description</Label>
                                                        <Textarea id="role-details-description" v-model="detailsForm.description" class="min-h-24" :disabled="!canManageRoles" />
                                                        <p v-if="detailsFormErrors.description?.length" class="text-xs text-destructive">{{ detailsFormErrors.description[0] }}</p>
                                                    </div>
                                                    <div class="grid gap-2">
                                                        <Label for="role-details-status">Status</Label>
                                                        <Select v-model="detailsForm.status">
                                                            <SelectTrigger :disabled="!canManageRoles">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                            <SelectItem value="active">Active</SelectItem>
                                                            <SelectItem value="inactive">Inactive</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <p v-if="detailsFormErrors.status?.length" class="text-xs text-destructive">{{ detailsFormErrors.status[0] }}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <div class="grid gap-3">
                                            <Card class="rounded-lg !gap-4 !py-4">
                                                <CardHeader class="px-4 pb-1 pt-0">
                                                    <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                        <AppIcon name="activity" class="size-4 text-muted-foreground" />
                                                        Assignment Snapshot
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent class="space-y-2 px-4 pt-0 text-sm">
                                                    <div class="flex justify-between gap-4">
                                                        <span class="text-muted-foreground">Role type</span>
                                                        <span class="text-right font-medium">{{ detailsRole.isSystem ? 'System protected' : 'Custom role' }}</span>
                                                    </div>
                                                    <div class="flex justify-between gap-4">
                                                        <span class="text-muted-foreground">Status</span>
                                                        <Badge :variant="roleStatusVariant(detailsRole.status)" class="h-5 text-xs">
                                                            {{ detailsRole.status || 'unknown' }}
                                                        </Badge>
                                                    </div>
                                                    <div class="flex justify-between gap-4">
                                                        <span class="text-muted-foreground">Users assigned</span>
                                                        <span class="text-right font-medium">{{ detailsRole.usersCount }}</span>
                                                    </div>
                                                    <div class="flex justify-between gap-4">
                                                        <span class="text-muted-foreground">Permissions</span>
                                                        <span class="text-right font-medium">{{ detailsRolePermissionCount }}</span>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card class="rounded-lg !gap-4 !py-4">
                                                <CardHeader class="px-4 pb-1 pt-0">
                                                    <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                        <AppIcon name="shield-check" class="size-4 text-muted-foreground" />
                                                        Permission Scope
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent class="space-y-3 px-4 pt-0 text-sm">
                                                    <div class="flex justify-between gap-4">
                                                        <span class="text-muted-foreground">Selected permissions</span>
                                                        <span class="text-right font-medium">{{ selectedPermissionNames.length }}</span>
                                                    </div>
                                                    <div class="flex justify-between gap-4">
                                                        <span class="text-muted-foreground">Namespaces</span>
                                                        <span class="text-right font-medium">{{ detailsPermissionNamespaces.total }}</span>
                                                    </div>
                                                    <div class="flex flex-wrap gap-2">
                                                        <Badge
                                                            v-for="namespace in detailsPermissionNamespaces.visible"
                                                            :key="`permission-namespace-${namespace}`"
                                                            variant="secondary"
                                                            class="rounded-md"
                                                        >
                                                            {{ namespace }}
                                                        </Badge>
                                                        <Badge v-if="detailsPermissionNamespaces.hiddenCount > 0" variant="outline" class="rounded-md">
                                                            +{{ detailsPermissionNamespaces.hiddenCount }} more
                                                        </Badge>
                                                        <span v-if="detailsPermissionNamespaces.total === 0" class="text-xs text-muted-foreground">
                                                            No permission namespaces selected yet.
                                                        </span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="permissions" class="mt-3 space-y-3">
                                    <div class="grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
                                        <Card class="h-full min-h-[32rem] rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                    <AppIcon name="shield-check" class="size-4 text-muted-foreground" />
                                                    Permission Summary
                                                </CardTitle>
                                                <CardDescription>Track the current draft before saving changes to the role.</CardDescription>
                                            </CardHeader>
                                            <CardContent class="space-y-3 px-4 pt-0 text-sm">
                                                <div class="grid gap-3 sm:grid-cols-2">
                                                    <div class="rounded-lg border bg-muted/20 p-3">
                                                        <p class="text-xs uppercase tracking-wide text-muted-foreground">Selected</p>
                                                        <p class="mt-1 text-lg font-semibold">{{ selectedPermissionNames.length }}</p>
                                                    </div>
                                                    <div class="rounded-lg border bg-muted/20 p-3">
                                                        <p class="text-xs uppercase tracking-wide text-muted-foreground">Namespaces</p>
                                                        <p class="mt-1 text-lg font-semibold">{{ detailsPermissionNamespaces.total }}</p>
                                                    </div>
                                                </div>

                                                <Alert v-if="permissionsError" variant="destructive">
                                                    <AlertTitle>Permission catalog unavailable</AlertTitle>
                                                    <AlertDescription>{{ permissionsError }}</AlertDescription>
                                                </Alert>

                                                <Alert v-if="detailsIsSystem" variant="destructive">
                                                    <AlertTitle>System role protection</AlertTitle>
                                                    <AlertDescription>System role permissions are protected and cannot be modified.</AlertDescription>
                                                </Alert>

                                                <div class="flex flex-wrap gap-2">
                                                    <Badge
                                                        v-for="namespace in detailsPermissionNamespaces.visible"
                                                        :key="`permission-summary-${namespace}`"
                                                        variant="secondary"
                                                        class="rounded-md"
                                                    >
                                                        {{ namespace }}
                                                    </Badge>
                                                    <Badge v-if="detailsPermissionNamespaces.hiddenCount > 0" variant="outline" class="rounded-md">
                                                        +{{ detailsPermissionNamespaces.hiddenCount }} more
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card class="rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <div class="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                            <AppIcon name="layout-grid" class="size-4 text-muted-foreground" />
                                                            Permission Assignments
                                                        </CardTitle>
                                                        <CardDescription>Search and assign permission bundles to this role.</CardDescription>
                                                    </div>
                                                    <Button
                                                        v-if="canManageRoles"
                                                        size="sm"
                                                        class="h-7 gap-1.5 text-xs"
                                                        :disabled="savePermissionsLoading || detailsIsSystem"
                                                        @click="saveRolePermissions"
                                                    >
                                                        <AppIcon name="shield-check" class="size-3.5" />
                                                        {{ savePermissionsLoading ? 'Saving...' : 'Save Permissions' }}
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-3 px-4 pt-0">
                                                <div class="grid gap-2">
                                                    <Label for="role-permission-search">Permission search</Label>
                                                    <Input id="role-permission-search" v-model="permissionSearch" placeholder="Search permission names..." :disabled="permissionsLoading" />
                                                </div>

                                                <div v-if="permissionsLoading" class="space-y-2">
                                                    <Skeleton class="h-10 w-full rounded-lg" />
                                                    <Skeleton class="h-10 w-full rounded-lg" />
                                                    <Skeleton class="h-10 w-full rounded-lg" />
                                                </div>
                                                <div v-else-if="permissionsFiltered.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                                    No permissions found for the current search.
                                                </div>
                                                <div v-else class="grid max-h-96 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
                                                    <label
                                                        v-for="permission in permissionsFiltered"
                                                        :key="permission.name ?? String(permission.id)"
                                                        class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                                                    >
                                                        <Checkbox
                                                            :id="`role-permission-${permission.id ?? permission.name ?? 'unknown'}`"
                                                            :model-value="permission.name ? selectedPermissionNames.includes(permission.name) : false"
                                                            :disabled="!canManageRoles || detailsIsSystem || savePermissionsLoading || !permission.name"
                                                            @update:model-value="permission.name && updatePermissionSelection(permission.name, $event)"
                                                        />
                                                        <span class="min-w-0 break-all">{{ permission.name || 'Unknown permission' }}</span>
                                                    </label>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>
                                <TabsContent value="audit" class="mt-3 space-y-3">
                                    <Alert v-if="!canViewAudit" variant="destructive">
                                        <AlertTitle>Audit access restricted</AlertTitle>
                                        <AlertDescription>Request <code>platform.rbac.view-audit-logs</code> permission.</AlertDescription>
                                    </Alert>

                                    <Collapsible v-else v-model:open="detailsAuditFiltersOpen">
                                        <Card class="rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-2 pt-0">
                                                <div class="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <CardTitle class="text-sm font-medium">Filter audit logs</CardTitle>
                                                        <CardDescription class="mt-0.5 text-xs">
                                                            {{ detailsAuditMeta?.total ?? 0 }} entries &middot; Refine by action, actor, or date range
                                                        </CardDescription>
                                                    </div>
                                                    <CollapsibleTrigger as-child>
                                                        <Button variant="secondary" size="sm" class="gap-1.5">
                                                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                            {{ detailsAuditFiltersOpen ? 'Hide filters' : 'Show filters' }}
                                                        </Button>
                                                    </CollapsibleTrigger>
                                                </div>
                                            </CardHeader>
                                            <CollapsibleContent>
                                                <CardContent class="px-4 pt-0">
                                                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                        <div class="sm:col-span-2 lg:col-span-3">
                                                            <Label for="rbac-audit-q" class="text-xs">Text search</Label>
                                                            <Input
                                                                id="rbac-audit-q"
                                                                v-model="detailsAuditFilters.q"
                                                                placeholder="role.created, role.updated, permission.synced..."
                                                                class="mt-1"
                                                            />
                                                        </div>
                                                        <div class="space-y-1.5">
                                                            <Label for="rbac-audit-action" class="text-xs">Action (exact)</Label>
                                                            <Input id="rbac-audit-action" v-model="detailsAuditFilters.action" placeholder="Action key" />
                                                        </div>
                                                        <div class="space-y-1.5">
                                                            <Label for="rbac-audit-actor-type" class="text-xs">Actor type</Label>
                                                            <Select v-model="detailsAuditFilters.actorType">
                                                                <SelectTrigger class="mt-0">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                <SelectItem value="">All actors</SelectItem>
                                                                <SelectItem value="user">User only</SelectItem>
                                                                <SelectItem value="system">System only</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div class="space-y-1.5">
                                                            <Label for="rbac-audit-actor-id" class="text-xs">Actor ID</Label>
                                                            <Input id="rbac-audit-actor-id" v-model="detailsAuditFilters.actorId" inputmode="numeric" placeholder="User ID" />
                                                        </div>
                                                        <div class="space-y-1.5">
                                                            <Label for="rbac-audit-per-page" class="text-xs">Per page</Label>
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
                                                            <Label for="rbac-audit-from" class="text-xs">From (date/time)</Label>
                                                            <Input id="rbac-audit-from" v-model="detailsAuditFilters.from" type="datetime-local" class="mt-0" />
                                                        </div>
                                                        <div class="space-y-1.5">
                                                            <Label for="rbac-audit-to" class="text-xs">To (date/time)</Label>
                                                            <Input id="rbac-audit-to" v-model="detailsAuditFilters.to" type="datetime-local" class="mt-0" />
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

                                    <Card class="rounded-lg !gap-4 !py-4">
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                <AppIcon name="file-text" class="size-4 text-muted-foreground" />
                                                Audit Timeline
                                            </CardTitle>
                                            <CardDescription>
                                                {{ canViewAudit ? `${detailsAuditMeta?.total ?? detailsAuditLogs.length} entries in scope.` : 'Audit access is permission restricted.' }}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent class="space-y-3 px-4 pt-0">
                                            <Alert v-if="detailsAuditError" variant="destructive">
                                                <AlertTitle>Audit load issue</AlertTitle>
                                                <AlertDescription>{{ detailsAuditError }}</AlertDescription>
                                            </Alert>

                                            <div v-else-if="canViewAudit && detailsAuditLoading" class="space-y-2">
                                                <Skeleton class="h-14 w-full rounded-lg" />
                                                <Skeleton class="h-14 w-full rounded-lg" />
                                                <Skeleton class="h-14 w-full rounded-lg" />
                                            </div>

                                            <div v-else-if="canViewAudit && detailsAuditLogs.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                                No audit logs found for the current filters.
                                            </div>

                                            <div v-else-if="canViewAudit" class="space-y-2">
                                                <div v-for="log in detailsAuditLogs" :key="log.id" class="rounded-lg border p-3 text-sm">
                                                    <div class="flex flex-wrap items-start justify-between gap-2">
                                                        <div>
                                                            <p class="font-medium">{{ log.actionLabel || log.action || 'event' }}</p>
                                                            <p class="mt-1 text-xs text-muted-foreground">
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
                                                        <p class="text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }}</p>
                                                    </div>
                                                </div>

                                                <div class="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        class="h-7 text-xs"
                                                        :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage <= 1"
                                                        @click="prevDetailsAuditPage"
                                                    >
                                                        Previous
                                                    </Button>
                                                    <p class="text-xs text-muted-foreground">
                                                        Page {{ detailsAuditMeta?.currentPage ?? 1 }} of {{ detailsAuditMeta?.lastPage ?? 1 }} |
                                                        {{ detailsAuditMeta?.total ?? detailsAuditLogs.length }} logs
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        class="h-7 text-xs"
                                                        :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage >= detailsAuditMeta.lastPage"
                                                        @click="nextDetailsAuditPage"
                                                    >
                                                        Next
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent v-if="canManageRoles && !detailsIsSystem" value="danger" class="mt-3">
                                    <Card class="rounded-lg border-destructive/50 !gap-4 !py-4">
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <CardTitle class="flex items-center gap-2 text-sm font-medium text-destructive">
                                                <AppIcon name="circle-x" class="size-4" />
                                                Danger Zone
                                            </CardTitle>
                                            <CardDescription>
                                                Deleting a role permanently removes role mappings from users in scope.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent class="px-4 pt-0">
                                            <div class="flex justify-end">
                                                <Button variant="destructive" class="gap-1.5" @click="openDeleteRoleDialog">
                                                    <AppIcon name="circle-x" class="size-3.5" />
                                                    Delete Role
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ScrollArea>

                    <SheetFooter class="shrink-0 flex-row border-t bg-muted/20 px-4 py-3 sm:justify-end">
                        <Button variant="outline" class="gap-1.5" @click="closeDetails">
                            <AppIcon name="circle-x" class="size-3.5" />
                            Close
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Dialog :open="deleteRoleDialogOpen" @update:open="(open) => (open ? (deleteRoleDialogOpen = true) : closeDeleteRoleDialog())">
                <DialogContent variant="action" size="lg">
                    <DialogHeader>
                        <DialogTitle>Delete Role</DialogTitle>
                        <DialogDescription>
                            This will permanently delete role
                            <code>{{ detailsRole?.code || detailsRole?.id || '' }}</code>.
                        </DialogDescription>
                    </DialogHeader>
                    <Alert v-if="deleteRoleError" variant="destructive">
                        <AlertTitle>Delete failed</AlertTitle>
                        <AlertDescription>{{ deleteRoleError }}</AlertDescription>
                    </Alert>
                    <DialogFooter>
                        <Button variant="outline" :disabled="deleteRoleLoading" @click="closeDeleteRoleDialog">Cancel</Button>
                        <Button variant="destructive" :disabled="deleteRoleLoading" @click="deleteRoleFromDetails">
                            {{ deleteRoleLoading ? 'Deleting...' : 'Delete' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Drawer v-if="canRead" :open="mobileFiltersDrawerOpen" @update:open="mobileFiltersDrawerOpen = $event">
                <DrawerContent class="max-h-[90vh]">
                    <DrawerHeader>
                        <DrawerTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            RBAC Filters
                        </DrawerTitle>
                        <DrawerDescription>Filter roles on mobile without leaving the queue.</DrawerDescription>
                    </DrawerHeader>
                    <div class="space-y-4 overflow-y-auto px-4 pb-2">
                        <div class="rounded-lg border p-3">
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="rbac-search-q-mobile">Search</Label>
                                    <Input
                                        id="rbac-search-q-mobile"
                                        v-model="searchForm.q"
                                        placeholder="Role code, name, description"
                                        @keyup.enter="submitSearchFromMobileDrawer"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="rbac-search-status-mobile">Status</Label>
                                    <Select v-model="searchForm.status">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">All statuses</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="rbac-search-per-page-mobile">Results per page</Label>
                                    <Select :model-value="String(searchForm.perPage)" @update:model-value="searchForm.perPage = Number($event)">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="12">12 / page</SelectItem>
                                        <SelectItem value="24">24 / page</SelectItem>
                                        <SelectItem value="48">48 / page</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="rbac-search-density-mobile">Row density</Label>
                                    <Select v-model="queueDensityValue">
                                        <SelectTrigger>
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
                        <div class="rounded-lg border p-3">
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="rbac-search-sort-by-mobile">Sort by</Label>
                                    <Select v-model="searchForm.sortBy">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="name">Name</SelectItem>
                                        <SelectItem value="code">Code</SelectItem>
                                        <SelectItem value="status">Status</SelectItem>
                                        <SelectItem value="createdAt">Created</SelectItem>
                                        <SelectItem value="updatedAt">Updated</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="rbac-search-sort-dir-mobile">Sort direction</Label>
                                    <Select v-model="searchForm.sortDir">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="asc">Ascending</SelectItem>
                                        <SelectItem value="desc">Descending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DrawerFooter class="gap-2">
                        <Button :disabled="listLoading" @click="submitSearchFromMobileDrawer">
                            <AppIcon name="search" class="mr-1.5 size-4" />
                            Search
                        </Button>
                        <Button variant="outline" :disabled="listLoading && !hasAnyFilters" @click="resetFiltersFromMobileDrawer">
                            Reset Filters
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    </AppLayout>
</template>




