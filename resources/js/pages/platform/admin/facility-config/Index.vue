<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import FacilityWorkspacePageHeader from '@/components/layout/FacilityWorkspacePageHeader.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import type { AppIconName } from '@/lib/icons';
import { formatEnumLabel } from '@/lib/labels';
import { activeInactiveStatusDotClass } from '@/lib/listRows';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import {
    WorkspaceProfileTab,
    WorkspaceSubscriptionTab,
    WorkspaceAuditTab,
} from '@/pages/platform/admin/facility-config/workspaceTabComponents';
import { type BreadcrumbItem } from '@/types';

type Facility = {
    id: string | null; code: string | null; name: string | null; facilityType: string | null; timezone: string | null;
    facilityTier?: string | null;
    tenantCode: string | null; tenantName: string | null; tenantCountryCode: string | null; tenantAllowedCountryCodes: string[];
    status: 'active' | 'inactive' | null; statusReason: string | null;
    operationsOwnerUserId: number | null; clinicalOwnerUserId: number | null; administrativeOwnerUserId: number | null;
    operationsOwner?: { id: number | null; name: string | null; email: string | null; status: string | null; roles?: Array<{ id: string | null; code: string | null; name: string | null }> } | null;
    clinicalOwner?: { id: number | null; name: string | null; email: string | null; status: string | null; roles?: Array<{ id: string | null; code: string | null; name: string | null }> } | null;
    administrativeOwner?: { id: number | null; name: string | null; email: string | null; status: string | null; roles?: Array<{ id: string | null; code: string | null; name: string | null }> } | null;
    updatedAt: string | null;
};
type FacilityCreateResponse = {
    data: Facility;
    meta?: {
        facilityAdminUserId?: number | null;
        createdFacilityAdminUserId?: number | null;
        facilityAdminInvite?: { userId?: number | null; message?: string | null; previewUrl?: string | null; deliveryMode?: string | null } | null;
        facilityAdminInviteError?: string | null;
    };
};
type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type VError = { message?: string; errors?: Record<string, string[]> };
type PlatformUser = {
    id: number | null;
    name: string | null;
    email: string | null;
    status: string | null;
    roles?: Array<{ id: string | null; code: string | null; name: string | null }>;
};
type SetupHubItem = {
    title: string;
    description: string;
    href: string;
    icon: AppIconName;
    permissionPrefixes: string[];
    badge?: string;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Platform Admin', href: '/platform/admin/facility-config' },
    { title: 'Facility setup', href: '/platform/admin/facility-config' },
];
const SELECT_ALL_VALUE = '__all__';

const { permissionNames, permissionState, hasUniversalAdminAccess } = usePlatformAccess();
const { countryProfileFullCatalog } = usePlatformCountryProfile();
const permissionsResolved = computed(() => permissionNames.value !== null);

const canRead = computed(() => permissionState('platform.facilities.read') === 'allowed');
const canCreate = computed(() => permissionState('platform.facilities.create') === 'allowed');
const canViewAudit = computed(() => permissionState('platform.facilities.view-audit-logs') === 'allowed');
const canReadUsers = computed(() => permissionState('platform.users.read') === 'allowed');

const setupHubItems: SetupHubItem[] = [
    {
        title: 'Facilities & ownership',
        description: 'Create facilities, assign accountable owners, manage status, and review audit history.',
        href: '/platform/admin/facility-config',
        icon: 'building-2',
        permissionPrefixes: ['platform.facilities.'],
        badge: 'Current page',
    },
    {
        title: 'Departments',
        description: 'Maintain clinical and operational department master data before scheduling and reporting.',
        href: '/platform/admin/departments',
        icon: 'building-2',
        permissionPrefixes: ['departments.'],
    },
    {
        title: 'Service points',
        description: 'Configure clinics, counters, rooms, and other patient-facing service locations.',
        href: '/platform/admin/service-points',
        icon: 'map-pin',
        permissionPrefixes: ['platform.resources.'],
    },
    {
        title: 'Wards & beds',
        description: 'Set up ward capacity, bed identifiers, locations, and admission-ready resources.',
        href: '/platform/admin/ward-beds',
        icon: 'bed-double',
        permissionPrefixes: ['platform.resources.'],
    },
    {
        title: 'Clinical Catalog',
        description: 'Govern lab tests, radiology procedures, theatre procedures, formulary items, and consumables.',
        href: '/platform/admin/clinical-catalogs',
        icon: 'book-open',
        permissionPrefixes: ['platform.clinical-catalog.', 'laboratory.orders.', 'radiology.orders.', 'pharmacy.orders.'],
    },
    {
        title: 'Billing Service Catalog',
        description: 'Connect clinical definitions to billable service codes, prices, and billing behavior.',
        href: '/billing-service-catalog',
        icon: 'receipt',
        permissionPrefixes: ['billing.service-catalog.'],
    },
    {
        title: 'Subscription plans',
        description: 'Control active modules, plan entitlements, billing cycle, and service access.',
        href: '/platform/admin/service-plans',
        icon: 'receipt',
        permissionPrefixes: ['platform.subscription-plans.'],
    },
    {
        title: 'Users & facility access',
        description: 'Assign users to facilities, roles, access states, and approval workflows.',
        href: '/platform/admin/users',
        icon: 'users',
        permissionPrefixes: ['platform.users.'],
    },
    {
        title: 'Branding',
        description: 'Manage facility logo, colors, print identity, and patient-facing brand settings.',
        href: '/platform/admin/branding',
        icon: 'pencil',
        permissionPrefixes: ['platform.settings.'],
    },
];

function hasAnyPermissionPrefix(prefixes: string[]): boolean {
    if (hasUniversalAdminAccess.value) return true;
    const names = permissionNames.value;
    if (!names) return false;
    return prefixes.some((prefix) => names.some((name) => name === prefix || name.startsWith(prefix)));
}

const visibleSetupHubItems = computed(() => setupHubItems.filter((item) => hasAnyPermissionPrefix(item.permissionPrefixes)));

// Facility queue state
const loading = ref(true);
const listLoading = ref(false);
const listError = ref<string | null>(null);
const facilities = ref<Facility[]>([]);
const page = ref<Pagination | null>(null);
const filters = reactive({ q: '', status: '', facilityType: '', ownerUserId: '', sortBy: 'name', sortDir: 'asc' as 'asc' | 'desc', perPage: 20, page: 1 });
const facilityFiltersSheetOpen = ref(false);
const ownerFilterSearch = ref('');
const ownerFilterCandidates = ref<PlatformUser[]>([]);
const ownerFilterUser = ref<PlatformUser | null>(null);
const ownerFilterLoading = ref(false);
const ownerFilterError = ref<string | null>(null);
let facilitySearchDebounceTimer: number | null = null;
let ownerFilterSearchDebounceTimer: number | null = null;
let ownerFilterSearchRequestId = 0;

// Create facility state
const createOpen = ref(false);
const createSaving = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const createAdminMode = ref<'select' | 'create'>('select');
const facilityAdminInviteNotice = ref<{ message: string; previewUrl: string | null; tone: 'success' | 'warning' } | null>(null);
const createForm = reactive({
    tenantCode: '',
    tenantName: '',
    tenantCountryCode: 'TZ',
    tenantAllowedCountryCodes: ['TZ'] as string[],
    facilityCode: '',
    facilityName: '',
    facilityType: '',
    facilityTier: '',
    timezone: 'Africa/Dar_es_Salaam',
    facilityAdminUserId: null as number | null,
});
const createAdminForm = reactive({ name: '', email: '' });
const adminSearch = ref('');
const adminCandidates = ref<PlatformUser[]>([]);
const adminCandidatesLoading = ref(false);
const adminCandidatesError = ref<string | null>(null);
let adminSearchDebounceTimer: number | null = null;
let adminSearchRequestId = 0;

// Detail sheet state
const detailsOpen = ref(false);
const detailsLoading = ref(false);
const detailsError = ref<string | null>(null);
const detailsWorkspaceTab = ref<'profile' | 'subscription' | 'audit'>('profile');
const selected = ref<Facility | null>(null);

const facilityTypeOptions = [
    { value: 'hospital', label: 'Hospital' },
    { value: 'dispensary', label: 'Dispensary' },
    { value: 'clinic', label: 'Clinic' },
    { value: 'diagnostic_center', label: 'Diagnostic center' },
];

function vStatus(s: string | null): 'outline' | 'secondary' | 'destructive' {
    if (s === 'active') return 'secondary';
    if (s === 'inactive') return 'destructive';
    return 'outline';
}

function fmt(v: string | null): string {
    if (!v) return 'N/A';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false });
}

function firstError(e: Record<string, string[]> | null | undefined, k: string): string | null {
    return e?.[k]?.[0] ?? null;
}

function normalizeCountryCodes(v: string[]): string[] {
    return Array.from(new Set(v.map((x) => x.trim().toUpperCase()).filter(Boolean)));
}

function fromSelectAllValue(value: string): string {
    return value === SELECT_ALL_VALUE ? '' : value;
}

// Owner helpers
type OwnerSlotKey = 'operationsOwnerUserId' | 'clinicalOwnerUserId' | 'administrativeOwnerUserId';
type OwnerSlot = {
    key: OwnerSlotKey;
    label: string;
    icon: AppIconName;
};

const ownerSlots: OwnerSlot[] = [
    { key: 'operationsOwnerUserId', label: 'Operations', icon: 'clipboard-list' },
    { key: 'clinicalOwnerUserId', label: 'Clinical', icon: 'stethoscope' },
    { key: 'administrativeOwnerUserId', label: 'Admin', icon: 'shield-check' },
];

function ownerRelationKey(slotKey: OwnerSlotKey): 'operationsOwner' | 'clinicalOwner' | 'administrativeOwner' {
    if (slotKey === 'operationsOwnerUserId') return 'operationsOwner';
    if (slotKey === 'clinicalOwnerUserId') return 'clinicalOwner';
    return 'administrativeOwner';
}


function ownerSummaryLabel(user: PlatformUser | null, id: number | null): string {
    if (user?.name?.trim()) return user.name.trim();
    if (user?.email?.trim()) return user.email.trim();
    return id ? `User #${id}` : 'Unassigned';
}

function facilityOwnerCoverage(facility: Facility): number {
    return [facility.operationsOwnerUserId, facility.clinicalOwnerUserId, facility.administrativeOwnerUserId]
        .filter((id) => id !== null).length;
}

function facilityMissingOwnerSummary(facility: Facility): string {
    const missing = ownerSlots.filter((slot) => facility[slot.key] === null).map((slot) => slot.label);
    return missing.length === 0 ? 'All roles assigned.' : `Missing: ${missing.join(', ')}`;
}

function facilitySortLabel(): string {
    const sortLabels: Record<string, string> = {
        name: 'Name', code: 'Code', facilityType: 'Facility type', timezone: 'Timezone', status: 'Status', updatedAt: 'Updated',
    };
    return `${sortLabels[filters.sortBy] ?? 'Name'} ${filters.sortDir === 'desc' ? 'descending' : 'ascending'}`;
}

const facilityFilterChips = computed<string[]>(() => {
    const chips: string[] = [];
    if (filters.q.trim()) chips.push(`Search: ${filters.q.trim()}`);
    if (filters.status) chips.push(`Status: ${formatEnumLabel(filters.status)}`);
    if (filters.facilityType.trim()) chips.push(`Type: ${formatEnumLabel(filters.facilityType)}`);
    if (filters.ownerUserId.trim()) chips.push(`Owner: ${ownerSummaryLabel(ownerFilterUser.value, Number(filters.ownerUserId))}`);
    if (filters.sortBy !== 'name' || filters.sortDir !== 'asc') chips.push(`Sort: ${facilitySortLabel()}`);
    if (filters.perPage !== 20) chips.push(`${filters.perPage} rows`);
    return chips;
});

const hasActiveFacilityFilters = computed(() => facilityFilterChips.value.length > 0);

// API helpers
async function api<T>(method: 'GET' | 'POST' | 'PATCH', path: string, options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> }): Promise<T> {
    return apiRequestJson<T>(method, path, options);
}

// List operations
async function loadList(): Promise<void> {
    if (!canRead.value) { facilities.value = []; page.value = null; loading.value = false; return; }
    listLoading.value = true; listError.value = null;
    try {
        const r = await api<{ data: Facility[]; meta: Pagination }>('GET', '/platform/admin/facilities', {
            query: {
                q: filters.q.trim() || null, status: filters.status || null, facilityType: filters.facilityType.trim() || null,
                ownerUserId: filters.ownerUserId.trim() || null, sortBy: filters.sortBy, sortDir: filters.sortDir, perPage: filters.perPage, page: filters.page,
            },
        });
        facilities.value = r.data ?? []; page.value = r.meta ?? null;
    } catch (e) {
        listError.value = messageFromUnknown(e, 'Unable to load facilities.'); facilities.value = []; page.value = null;
    } finally { listLoading.value = false; loading.value = false; }
}

function clearFacilitySearchDebounce(): void {
    if (facilitySearchDebounceTimer !== null) {
        window.clearTimeout(facilitySearchDebounceTimer);
        facilitySearchDebounceTimer = null;
    }
}

function applyFacilityFilters(): void {
    clearFacilitySearchDebounce();
    filters.page = 1;
    void loadList();
}

function updateFacilityQuery(value: string | number): void {
    filters.q = String(value ?? '');
    clearFacilitySearchDebounce();
    facilitySearchDebounceTimer = window.setTimeout(() => {
        filters.page = 1;
        void loadList();
        facilitySearchDebounceTimer = null;
    }, 350);
}

function setFacilityStatusFilter(status: string): void {
    if (filters.status === status) return;
    filters.status = status;
    applyFacilityFilters();
}

function setFacilityTypeFilter(value: string): void {
    filters.facilityType = value;
    applyFacilityFilters();
}

function setFacilitySortBy(value: string): void {
    filters.sortBy = value;
    applyFacilityFilters();
}

function setFacilitySortDir(value: string): void {
    filters.sortDir = value === 'desc' ? 'desc' : 'asc';
    applyFacilityFilters();
}

function setFacilityPerPage(value: string | number): void {
    const nextPerPage = Number(value);
    filters.perPage = Number.isFinite(nextPerPage) && nextPerPage > 0 ? nextPerPage : 20;
    applyFacilityFilters();
}

function resetFilters(): void {
    clearFacilitySearchDebounce();
    clearOwnerFilterSearchDebounce();
    Object.assign(filters, { q: '', status: '', facilityType: '', ownerUserId: '', sortBy: 'name', sortDir: 'asc', perPage: 20, page: 1 });
    ownerFilterUser.value = null;
    ownerFilterSearch.value = '';
    ownerFilterCandidates.value = [];
    ownerFilterError.value = null;
    ownerFilterLoading.value = false;
    ownerFilterSearchRequestId += 1;
    void loadList();
}

function clearOwnerFilterSearchDebounce(): void {
    if (ownerFilterSearchDebounceTimer !== null) {
        window.clearTimeout(ownerFilterSearchDebounceTimer);
        ownerFilterSearchDebounceTimer = null;
    }
}

function prevPage(): void { if ((page.value?.currentPage ?? 1) <= 1) return; filters.page -= 1; void loadList(); }
function nextPage(): void { if (!page.value || page.value.currentPage >= page.value.lastPage) return; filters.page += 1; void loadList(); }

// Owner filter
async function loadOwnerFilterCandidates(): Promise<void> {
    const query = ownerFilterSearch.value.trim();
    if (!canReadUsers.value) {
        ownerFilterCandidates.value = [];
        ownerFilterError.value = 'Owner lookup needs platform.users.read.';
        ownerFilterLoading.value = false;
        return;
    }
    if (query.length < 2) {
        ownerFilterCandidates.value = [];
        ownerFilterError.value = null;
        ownerFilterLoading.value = false;
        return;
    }
    ownerFilterLoading.value = true;
    ownerFilterError.value = null;
    const requestId = ++ownerFilterSearchRequestId;
    try {
        const response = await api<{ data: PlatformUser[] }>('GET', '/platform/admin/users', {
            query: { q: query, status: 'active', perPage: 8, page: 1, sortBy: 'name', sortDir: 'asc' },
        });
        if (requestId !== ownerFilterSearchRequestId) return;
        ownerFilterCandidates.value = response.data ?? [];
    } catch (e) {
        if (requestId !== ownerFilterSearchRequestId) return;
        ownerFilterCandidates.value = [];
        ownerFilterError.value = messageFromUnknown(e, 'Unable to load owner candidates.');
    } finally {
        if (requestId === ownerFilterSearchRequestId) ownerFilterLoading.value = false;
    }
}

function updateOwnerFilterSearch(value: string | number): void {
    ownerFilterSearch.value = String(value ?? '');
    clearOwnerFilterSearchDebounce();
    if (ownerFilterSearch.value.trim().length < 2) {
        ownerFilterCandidates.value = [];
        ownerFilterError.value = null;
        ownerFilterLoading.value = false;
        ownerFilterSearchRequestId += 1;
        return;
    }
    ownerFilterLoading.value = true;
    ownerFilterSearchDebounceTimer = window.setTimeout(() => {
        void loadOwnerFilterCandidates();
        ownerFilterSearchDebounceTimer = null;
    }, 300);
}

function selectOwnerFilter(user: PlatformUser): void {
    if (user.id === null) return;
    filters.ownerUserId = String(user.id);
    ownerFilterUser.value = user;
    ownerFilterSearch.value = '';
    ownerFilterCandidates.value = [];
    ownerFilterError.value = null;
    ownerFilterSearchRequestId += 1;
    clearOwnerFilterSearchDebounce();
    applyFacilityFilters();
}

function clearOwnerFilter(): void {
    filters.ownerUserId = '';
    ownerFilterUser.value = null;
    ownerFilterSearch.value = '';
    ownerFilterCandidates.value = [];
    ownerFilterError.value = null;
    ownerFilterSearchRequestId += 1;
    clearOwnerFilterSearchDebounce();
    applyFacilityFilters();
}

function userRoleLabel(user: PlatformUser): string {
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const roleNames = roles.map((role) => role.name || role.code).filter(Boolean);
    return roleNames.length > 0 ? roleNames.slice(0, 2).join(', ') : 'No role assigned';
}

// Detail operations
async function loadDetails(id: string): Promise<void> {
    detailsLoading.value = true; detailsError.value = null;
    try {
        const r = await api<{ data: Facility }>('GET', `/platform/admin/facilities/${id}`);
        selected.value = r.data;
    } catch (e) {
        detailsError.value = messageFromUnknown(e, 'Unable to refresh facility details.');
    } finally { detailsLoading.value = false; }
}

function openDetails(f: Facility): void {
    const id = String(f.id ?? '').trim(); if (!id) return;
    detailsOpen.value = true;
    detailsWorkspaceTab.value = 'profile';
    detailsError.value = null;
    selected.value = f;
    void loadDetails(id);
}

function closeDetails(): void {
    detailsOpen.value = false;
    selected.value = null;
}

function handleProfileSaved(facility: Facility): void {
    const i = facilities.value.findIndex((x) => x.id === facility.id);
    if (i >= 0) facilities.value[i] = facility;
}

function handleSubscriptionSaved(): void {
    if (selected.value?.id) {
        void loadDetails(String(selected.value.id));
    }
}

// Create operations
function resetCreateForm(): void {
    Object.assign(createForm, {
        tenantCode: '', tenantName: '', tenantCountryCode: 'TZ', tenantAllowedCountryCodes: ['TZ'],
        facilityCode: '', facilityName: '', facilityType: '', facilityTier: '', timezone: 'Africa/Dar_es_Salaam',
        facilityAdminUserId: null,
    });
    createAdminMode.value = 'select';
    createAdminForm.name = '';
    createAdminForm.email = '';
    adminSearch.value = '';
    adminCandidates.value = [];
    adminCandidatesError.value = null;
    facilityAdminInviteNotice.value = null;
    createErrors.value = {};
}

function openCreate(): void {
    if (!canCreate.value) return;
    resetCreateForm();
    createOpen.value = true;
}

function closeCreate(): void {
    if (createSaving.value) return;
    clearAdminSearchDebounce();
    adminSearchRequestId += 1;
    adminCandidatesLoading.value = false;
    createOpen.value = false;
    createErrors.value = {};
}

const createCountryOptions = computed(() => {
    const options = countryProfileFullCatalog.value
        .map((profile) => {
            const code = String(profile.code ?? '').trim().toUpperCase();
            if (!code) return null;
            return { code, label: `${code} - ${profile.name || ''}` };
        })
        .filter((option): option is { code: string; label: string } => option !== null);
    return options.length > 0 ? options : [
        { code: 'TZ', label: 'TZ - Tanzania' },
        { code: 'KE', label: 'KE - Kenya' },
        { code: 'UG', label: 'UG - Uganda' },
    ];
});

function clearAdminSearchDebounce(): void {
    if (adminSearchDebounceTimer !== null) {
        window.clearTimeout(adminSearchDebounceTimer);
        adminSearchDebounceTimer = null;
    }
}

const selectedFacilityAdmin = computed(() =>
    adminCandidates.value.find((user) => user.id === createForm.facilityAdminUserId) ?? null,
);

async function loadAdminCandidates(): Promise<void> {
    const query = adminSearch.value.trim();
    if (!canReadUsers.value) {
        adminCandidates.value = [];
        adminCandidatesError.value = 'Missing permission: platform.users.read.';
        return;
    }
    if (query.length < 2) {
        adminCandidates.value = [];
        adminCandidatesError.value = null;
        return;
    }
    adminCandidatesLoading.value = true;
    adminCandidatesError.value = null;
    const requestId = ++adminSearchRequestId;
    try {
        const r = await api<{ data: PlatformUser[] }>('GET', '/platform/admin/facility-admin-candidates', {
            query: { q: query, limit: 8, tenantCode: createForm.tenantCode.trim().toUpperCase() || null },
        });
        if (requestId !== adminSearchRequestId) return;
        adminCandidates.value = r.data ?? [];
    } catch (e) {
        if (requestId !== adminSearchRequestId) return;
        adminCandidates.value = [];
        adminCandidatesError.value = messageFromUnknown(e, 'Unable to load admin candidates.');
    } finally {
        if (requestId === adminSearchRequestId) adminCandidatesLoading.value = false;
    }
}

function selectFacilityAdmin(user: PlatformUser): void {
    if (user.id === null) return;
    createForm.facilityAdminUserId = user.id;
    createErrors.value = { ...createErrors.value, facilityAdminUserId: [] };
}

function clearFacilityAdmin(): void {
    createForm.facilityAdminUserId = null;
}

watch(adminSearch, (value) => {
    clearAdminSearchDebounce();
    if (value.trim().length < 2) {
        adminCandidates.value = [];
        adminCandidatesError.value = null;
        adminCandidatesLoading.value = false;
        adminSearchRequestId += 1;
        return;
    }
    adminCandidatesLoading.value = true;
    adminSearchDebounceTimer = window.setTimeout(() => {
        void loadAdminCandidates();
        adminSearchDebounceTimer = null;
    }, 300);
});

watch(() => createForm.tenantCode, () => {
    createForm.facilityAdminUserId = null;
    adminCandidates.value = [];
    adminCandidatesError.value = null;
    adminSearchRequestId += 1;
    clearAdminSearchDebounce();
    if (adminSearch.value.trim().length < 2) {
        adminCandidatesLoading.value = false;
        return;
    }
    adminCandidatesLoading.value = true;
    adminSearchDebounceTimer = window.setTimeout(() => {
        void loadAdminCandidates();
        adminSearchDebounceTimer = null;
    }, 300);
});

watch(createAdminMode, () => {
    createErrors.value = { ...createErrors.value, facilityAdmin: [], facilityAdminUserId: [], 'facilityAdmin.name': [], 'facilityAdmin.email': [] };
});

async function createFacility(): Promise<void> {
    if (!canCreate.value || createSaving.value) return;
    createSaving.value = true; createErrors.value = {};
    if (createAdminMode.value === 'select' && createForm.facilityAdminUserId === null) {
        createErrors.value = { facilityAdmin: ['Select an eligible Facility Administrator.'] };
        createSaving.value = false;
        return;
    }
    if (createAdminMode.value === 'create') {
        const adminName = createAdminForm.name.trim();
        const adminEmail = createAdminForm.email.trim();
        const errors: Record<string, string[]> = {};
        if (!adminName) errors['facilityAdmin.name'] = ['Name is required.'];
        if (!adminEmail) errors['facilityAdmin.email'] = ['Email is required.'];
        if (Object.keys(errors).length > 0) {
            createErrors.value = errors;
            createSaving.value = false;
            return;
        }
    }
    try {
        const r = await api<FacilityCreateResponse>('POST', '/platform/admin/facilities', {
            body: {
                tenantCode: createForm.tenantCode.trim(),
                tenantName: createForm.tenantName.trim(),
                tenantCountryCode: createForm.tenantCountryCode.trim().toUpperCase(),
                tenantAllowedCountryCodes: normalizeCountryCodes(createForm.tenantAllowedCountryCodes),
                facilityCode: createForm.facilityCode.trim(),
                facilityName: createForm.facilityName.trim(),
                facilityType: createForm.facilityType.trim() || null,
                facilityTier: createForm.facilityTier.trim() || null,
                timezone: createForm.timezone.trim() || null,
                facilityAdminUserId: createAdminMode.value === 'select' ? createForm.facilityAdminUserId : null,
                facilityAdmin: createAdminMode.value === 'create'
                    ? { name: createAdminForm.name.trim(), email: createAdminForm.email.trim() }
                    : null,
            },
        });
        facilities.value = [r.data, ...facilities.value.filter((entry) => entry.id !== r.data.id)];
        const invite = r.meta?.facilityAdminInvite ?? null;
        const inviteError = r.meta?.facilityAdminInviteError ?? null;
        const successMessage = createAdminMode.value === 'create'
            ? invite?.deliveryMode === 'email'
                ? 'Organization, facility, and facility admin created. Invite link sent.'
                : invite?.previewUrl
                    ? 'Organization, facility, and facility admin created. Invite link generated for local preview.'
                    : inviteError
                        ? `Organization, facility, and facility admin created. Invite was not dispatched: ${inviteError}. Retry from Platform Users.`
                        : 'Organization, facility, and facility admin created.'
            : 'Organization and facility created.';
        facilityAdminInviteNotice.value = createAdminMode.value === 'create'
            ? { message: successMessage, previewUrl: invite?.previewUrl ?? null, tone: inviteError ? 'warning' : 'success' }
            : null;
        if (inviteError) notifyError(successMessage);
        else notifySuccess(successMessage);
        createOpen.value = false;
        void loadList();
        openDetails(r.data);
    } catch (e) {
        const er = e as Error & { status?: number; payload?: VError };
        if (er.status === 422 && er.payload?.errors) createErrors.value = er.payload.errors;
        else notifyError(messageFromUnknown(e, 'Unable to create facility.'));
    } finally { createSaving.value = false; }
}

onMounted(() => { void loadList(); });
onBeforeUnmount(() => {
    clearFacilitySearchDebounce();
    clearOwnerFilterSearchDebounce();
    clearAdminSearchDebounce();
});
</script>

<template>
    <Head title="Facility setup" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <!-- Page header -->
            <FacilityWorkspacePageHeader
                title="Facility setup"
                description="The operational foundation for facilities, departments, resources, catalogs, subscriptions, and access."
                icon="building-2"
            >
                <template #actions>
                    <Button v-if="canCreate" class="gap-2" @click="openCreate">
                        <AppIcon name="plus" class="size-4" />
                        New Facility
                    </Button>
                </template>
            </FacilityWorkspacePageHeader>

            <!-- Permission alerts -->
            <Alert v-if="!permissionsResolved">
                <AlertTitle>Resolving access</AlertTitle>
                <AlertDescription>Loading permission context.</AlertDescription>
            </Alert>
            <Alert v-else-if="visibleSetupHubItems.length === 0" variant="destructive">
                <AlertTitle>Access denied</AlertTitle>
                <AlertDescription>You do not have access to any Facility setup work area.</AlertDescription>
            </Alert>

            <!-- Invite notice -->
            <Alert v-if="facilityAdminInviteNotice" :variant="facilityAdminInviteNotice.tone === 'warning' ? 'destructive' : 'default'">
                <AlertTitle>Facility admin invite</AlertTitle>
                <AlertDescription class="space-y-2">
                    <p>{{ facilityAdminInviteNotice.message }}</p>
                    <a
                        v-if="facilityAdminInviteNotice.previewUrl"
                        :href="facilityAdminInviteNotice.previewUrl"
                        target="_blank"
                        rel="noreferrer"
                        class="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                        Open local invite link
                    </a>
                </AlertDescription>
            </Alert>

            <!-- Setup hub -->
            <section v-if="permissionsResolved && visibleSetupHubItems.length > 0" class="grid gap-3">
                <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 class="text-base font-semibold tracking-tight">Setup work areas</h2>
                        <p class="text-sm text-muted-foreground">Open the registries that must be ready before care teams go live.</p>
                    </div>
                    <Badge variant="secondary" class="w-fit">{{ visibleSetupHubItems.length }} available</Badge>
                </div>
                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div
                        v-for="item in visibleSetupHubItems"
                        :key="item.href"
                        class="flex min-h-[9.5rem] flex-col justify-between rounded-lg border bg-background p-4 transition-colors hover:bg-muted/30"
                    >
                        <div class="space-y-3">
                            <div class="flex items-start justify-between gap-3">
                                <span class="rounded-md border bg-muted/30 p-2 text-muted-foreground">
                                    <AppIcon :name="item.icon" class="size-4" />
                                </span>
                                <Badge v-if="item.badge" variant="outline">{{ item.badge }}</Badge>
                            </div>
                            <div class="space-y-1">
                                <h3 class="text-sm font-semibold leading-5">{{ item.title }}</h3>
                                <p class="text-xs leading-5 text-muted-foreground">{{ item.description }}</p>
                            </div>
                        </div>
                        <Button size="sm" variant="outline" class="mt-4 w-fit gap-1.5" as-child>
                            <Link :href="item.href">
                                <AppIcon name="chevron-right" class="size-3.5" />
                                Open
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>

            <!-- Facility queue -->
            <Card v-if="canRead" class="rounded-lg border-sidebar-border/70">
                <CardHeader class="gap-4">
                    <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div class="min-w-0 space-y-2">
                            <div>
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="building-2" class="size-5 text-muted-foreground" />
                                    Facility Queue
                                </CardTitle>
                                <CardDescription>Facility readiness, ownership coverage, tenant scope, and operational state.</CardDescription>
                            </div>
                            <div class="flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary">{{ page?.total ?? facilities.length }} facilities</Badge>
                                <Badge v-if="filters.facilityType" variant="outline">{{ formatEnumLabel(filters.facilityType) }}</Badge>
                                <Badge v-if="filters.ownerUserId" variant="outline">{{ ownerSummaryLabel(ownerFilterUser, Number(filters.ownerUserId)) }}</Badge>
                                <Badge v-if="filters.sortBy !== 'name' || filters.sortDir !== 'asc'" variant="outline">{{ facilitySortLabel() }}</Badge>
                            </div>
                        </div>

                        <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:max-w-2xl">
                            <SearchInput
                                id="facility-search-q"
                                :model-value="filters.q"
                                placeholder="Search code, name, type, timezone"
                                class="min-w-0 flex-1"
                                :disabled="listLoading"
                                @update:model-value="updateFacilityQuery"
                            />
                            <Button variant="outline" size="sm" class="h-9 gap-1.5 rounded-lg text-xs" @click="facilityFiltersSheetOpen = true">
                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                Filters
                                <Badge v-if="facilityFilterChips.length > 0" variant="secondary" class="ml-1 h-5 px-1.5 text-[10px]">
                                    {{ facilityFilterChips.length }}
                                </Badge>
                            </Button>
                        </div>
                    </div>
                    <div v-if="facilityFilterChips.length > 0" class="flex flex-wrap gap-1.5">
                        <Badge v-for="chip in facilityFilterChips" :key="chip" variant="outline">{{ chip }}</Badge>
                    </div>
                </CardHeader>
                <CardContent class="space-y-3">
                    <Alert v-if="listError" variant="destructive">
                        <AlertTitle>Queue load issue</AlertTitle>
                        <AlertDescription>{{ listError }}</AlertDescription>
                    </Alert>
                    <div v-else-if="loading || listLoading" class="space-y-2">
                        <RegistryListSkeleton />
                        <RegistryListSkeleton />
                        <RegistryListSkeleton />
                    </div>
                    <div v-else-if="facilities.length === 0" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        No facilities matched current filters.
                    </div>
                    <div v-else class="space-y-2">
                        <RegistryListRow
                            v-for="f in facilities"
                            :key="String(f.id)"
                            :status-dot-class="activeInactiveStatusDotClass(f.status)"
                            :primary-label="`${f.code || 'NO-CODE'} - ${f.name || 'Unnamed Facility'}`"
                            :secondary-label="`Type ${f.facilityType ? formatEnumLabel(f.facilityType) : 'N/A'} | ${f.timezone || 'N/A'}`"
                            :meta="`Updated ${fmt(f.updatedAt)}`"
                            @select="openDetails(f)"
                        >
                            <template #badges>
                                <Badge :variant="vStatus(f.status)">{{ formatEnumLabel(f.status) }}</Badge>
                                <Badge variant="outline">Owners {{ facilityOwnerCoverage(f) }}/3</Badge>
                            </template>
                            <template #actions>
                                <Button size="sm" class="gap-1.5" @click.stop="openDetails(f)">
                                    <AppIcon name="eye" class="size-3.5" />
                                    Open
                                </Button>
                            </template>
                        </RegistryListRow>
                    </div>
                    <div class="flex items-center justify-between border-t pt-2">
                        <Button variant="outline" size="sm" :disabled="listLoading || (page?.currentPage ?? 1) <= 1" @click="prevPage">Previous</Button>
                        <p class="text-xs text-muted-foreground">Page {{ page?.currentPage ?? 1 }} of {{ page?.lastPage ?? 1 }}<span v-if="page"> | {{ page.total }} total</span></p>
                        <Button variant="outline" size="sm" :disabled="listLoading || !page || page.currentPage >= page.lastPage" @click="nextPage">Next</Button>
                    </div>
                </CardContent>
            </Card>

            <!-- Filters sheet -->
            <Sheet v-if="canRead" :open="facilityFiltersSheetOpen" @update:open="facilityFiltersSheetOpen = $event">
                <SheetContent side="right" variant="form" size="md" class="flex h-full min-h-0 flex-col">
                    <SheetHeader>
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            Facility Filters
                        </SheetTitle>
                        <SheetDescription>Facility queue controls for status, ownership, type, and sorting.</SheetDescription>
                    </SheetHeader>

                    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        <div class="rounded-lg border p-3">
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="facility-search-q-sheet">Search</Label>
                                    <SearchInput
                                        id="facility-search-q-sheet"
                                        :model-value="filters.q"
                                        placeholder="Search code, name, type, timezone"
                                        :disabled="listLoading"
                                        @update:model-value="updateFacilityQuery"
                                    />
                                </div>

                                <div class="grid gap-2">
                                    <Label for="facility-status-sheet">Status</Label>
                                    <Select
                                        :model-value="filters.status || SELECT_ALL_VALUE"
                                        @update:model-value="setFacilityStatusFilter(fromSelectAllValue($event))"
                                    >
                                        <SelectTrigger id="facility-status-sheet" class="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem :value="SELECT_ALL_VALUE">All statuses</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="facility-type-sheet">Facility type</Label>
                                    <Select
                                        :model-value="filters.facilityType || SELECT_ALL_VALUE"
                                        @update:model-value="setFacilityTypeFilter(fromSelectAllValue($event))"
                                    >
                                        <SelectTrigger id="facility-type-sheet" class="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem :value="SELECT_ALL_VALUE">All facility types</SelectItem>
                                            <SelectItem v-for="option in facilityTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Separator />

                                <div class="grid gap-2">
                                    <Label for="facility-owner-filter">Owner</Label>
                                    <div v-if="filters.ownerUserId" class="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
                                        <div class="min-w-0">
                                            <p class="truncate text-sm font-medium">{{ ownerSummaryLabel(ownerFilterUser, Number(filters.ownerUserId)) }}</p>
                                            <p class="truncate text-xs text-muted-foreground">{{ ownerFilterUser?.email || 'Any ownership slot' }}</p>
                                        </div>
                                        <Button variant="outline" size="sm" :disabled="listLoading" @click="clearOwnerFilter">Clear</Button>
                                    </div>
                                    <div class="relative">
                                        <Input
                                            id="facility-owner-filter"
                                            :model-value="ownerFilterSearch"
                                            placeholder="Search owner by name or email"
                                            class="pr-10"
                                            :disabled="listLoading || !canReadUsers"
                                            @update:model-value="updateOwnerFilterSearch"
                                        />
                                        <AppIcon v-if="ownerFilterLoading" name="refresh-cw" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                                        <AppIcon v-else name="search" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    </div>
                                    <p v-if="!canReadUsers" class="text-xs text-muted-foreground">Owner lookup needs platform.users.read.</p>
                                    <p v-else-if="ownerFilterError" class="text-xs text-destructive">{{ ownerFilterError }}</p>
                                    <div v-else-if="ownerFilterLoading" class="space-y-2">
                                        <Skeleton class="h-11 w-full" />
                                        <Skeleton class="h-11 w-full" />
                                    </div>
                                    <div v-else-if="ownerFilterSearch.trim().length >= 2 && ownerFilterCandidates.length === 0" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                        No active owner matched this search.
                                    </div>
                                    <div v-else-if="ownerFilterSearch.trim().length < 2 && !filters.ownerUserId" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                        Type at least two characters to filter by an assigned owner.
                                    </div>
                                    <div v-else class="grid gap-2">
                                        <button
                                            v-for="user in ownerFilterCandidates"
                                            :key="`owner-filter-${user.id}`"
                                            type="button"
                                            class="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                                            :disabled="listLoading"
                                            @click="selectOwnerFilter(user)"
                                        >
                                            <span class="min-w-0">
                                                <span class="block truncate font-medium">{{ user.name || 'Unnamed user' }}</span>
                                                <span class="block truncate text-xs text-muted-foreground">{{ user.email || 'No email' }} | {{ userRoleLabel(user) }}</span>
                                            </span>
                                            <Badge :variant="vStatus(user.status)">{{ formatEnumLabel(user.status) }}</Badge>
                                        </button>
                                    </div>
                                </div>

                                <Separator />

                                <div class="grid gap-2">
                                    <Label for="facility-sort-by-sheet">Sort by</Label>
                                    <Select :model-value="filters.sortBy" @update:model-value="setFacilitySortBy($event)">
                                        <SelectTrigger id="facility-sort-by-sheet" class="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="name">Name</SelectItem>
                                            <SelectItem value="code">Code</SelectItem>
                                            <SelectItem value="facilityType">Facility type</SelectItem>
                                            <SelectItem value="timezone">Timezone</SelectItem>
                                            <SelectItem value="status">Status</SelectItem>
                                            <SelectItem value="updatedAt">Updated</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="facility-sort-dir-sheet">Sort direction</Label>
                                    <Select :model-value="filters.sortDir" @update:model-value="setFacilitySortDir($event)">
                                        <SelectTrigger id="facility-sort-dir-sheet" class="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="asc">Ascending</SelectItem>
                                            <SelectItem value="desc">Descending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="facility-per-page-sheet">Rows per page</Label>
                                    <Select :model-value="String(filters.perPage)" @update:model-value="setFacilityPerPage($event)">
                                        <SelectTrigger id="facility-per-page-sheet" class="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="20">20</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <SheetFooter class="gap-2 border-t px-4 py-3">
                        <Button variant="outline" :disabled="listLoading && !hasActiveFacilityFilters" @click="resetFilters">Reset Filters</Button>
                        <Button :disabled="listLoading" @click="facilityFiltersSheetOpen = false">Done</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Detail workspace sheet -->
            <Sheet :open="detailsOpen" @update:open="(o) => (o ? (detailsOpen = true) : closeDetails())">
                <SheetContent side="right" variant="workspace" size="5xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader class="shrink-0 border-b bg-background px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex min-w-0 flex-wrap items-center gap-2">
                            <AppIcon name="building-2" class="size-5 text-muted-foreground" />
                            <span class="min-w-0 truncate">{{ selected?.name || selected?.code || 'Facility Details' }}</span>
                            <Badge v-if="selected?.code" variant="outline" class="shrink-0 font-normal">{{ selected.code }}</Badge>
                            <AppIcon v-if="detailsLoading" name="refresh-cw" class="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                        </SheetTitle>
                        <SheetDescription>
                            {{ selected?.tenantName || 'Organization not set' }} | {{ selected?.facilityType ? formatEnumLabel(selected.facilityType) : 'Facility type not set' }} | {{ selected?.timezone || 'Timezone not set' }}
                        </SheetDescription>
                    </SheetHeader>

                    <div class="min-h-0 flex flex-1 flex-col overflow-hidden">
                        <Alert v-if="detailsError" variant="destructive" class="mx-4 mt-4 shrink-0">
                            <AlertTitle>Details refresh issue</AlertTitle>
                            <AlertDescription>{{ detailsError }}</AlertDescription>
                        </Alert>

                        <Tabs v-if="selected" v-model="detailsWorkspaceTab" class="flex h-full min-h-0 flex-col">
                            <div class="shrink-0 border-b bg-muted/5 px-4 py-2.5">
                                <div class="space-y-4">
                                    <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                        <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-1.5">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Facility</p>
                                            <p class="mt-0.5 truncate text-sm font-semibold leading-4">{{ selected.name || selected.code || 'Facility' }}</p>
                                            <p class="truncate text-xs leading-4 text-muted-foreground">{{ selected.facilityType ? formatEnumLabel(selected.facilityType) : 'Type not set' }} | {{ selected.timezone || 'Timezone not set' }}</p>
                                        </div>
                                        <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-1.5">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Ownership</p>
                                            <p class="mt-0.5 line-clamp-1 text-sm font-semibold leading-4">{{ facilityMissingOwnerSummary(selected) }}</p>
                                            <p class="truncate text-xs leading-4 text-muted-foreground">{{ selected.tenantCode ? `Tenant: ${selected.tenantCode}` : 'No tenant' }}</p>
                                        </div>
                                        <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-1.5">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                                            <p class="mt-0.5 line-clamp-1 text-sm font-semibold leading-4">
                                                <Badge :variant="vStatus(selected.status)" class="font-normal">{{ formatEnumLabel(selected.status) }}</Badge>
                                            </p>
                                            <p class="truncate text-xs leading-4 text-muted-foreground">Updated {{ fmt(selected.updatedAt) }}</p>
                                        </div>
                                    </div>

                                    <div class="pb-1">
                                        <TabsList class="flex h-auto w-full flex-wrap justify-start gap-2 rounded-lg bg-transparent p-0">
                                            <TabsTrigger value="profile" class="gap-1.5 rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">
                                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                Profile
                                            </TabsTrigger>
                                            <TabsTrigger value="subscription" class="gap-1.5 rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">
                                                <AppIcon name="receipt" class="size-3.5" />
                                                Subscription
                                            </TabsTrigger>
                                            <TabsTrigger v-if="canViewAudit" value="audit" class="gap-1.5 rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">
                                                <AppIcon name="file-text" class="size-3.5" />
                                                Audit
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>
                                </div>
                            </div>

                            <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                                <TabsContent value="profile" class="m-0">
                                    <div class="px-6 py-4">
                                        <WorkspaceProfileTab
                                            :facility="selected"
                                            :loading="detailsLoading"
                                            @saved="handleProfileSaved"
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="subscription" class="m-0">
                                    <div class="px-6 py-4">
                                        <WorkspaceSubscriptionTab
                                            :facility="selected"
                                            :loading="detailsLoading"
                                            @saved="handleSubscriptionSaved"
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent v-if="canViewAudit" value="audit" class="m-0">
                                    <div class="px-6 py-4">
                                        <WorkspaceAuditTab
                                            :facility-id="selected?.id"
                                            :can-view-audit="canViewAudit"
                                        />
                                    </div>
                                </TabsContent>
                            </ScrollArea>
                        </Tabs>
                    </div>

                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <div class="flex w-full items-center justify-between">
                            <p class="text-xs text-muted-foreground">{{ selected?.name || selected?.code || 'Facility details' }}</p>
                            <Button variant="outline" @click="closeDetails">Close</Button>
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Create facility sheet -->
            <Sheet :open="createOpen" @update:open="(open) => (open ? (createOpen = true) : closeCreate())">
                <SheetContent side="right" variant="form" size="4xl">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="building-2" class="size-5 text-muted-foreground" />
                            Create Facility
                        </SheetTitle>
                        <SheetDescription>Create the hospital foundation and assign its first facility admin.</SheetDescription>
                    </SheetHeader>

                    <ScrollArea class="min-h-0 flex-1">
                        <div class="grid gap-4 px-6 py-4">
                            <div class="flex flex-col gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                                <div class="min-w-0">
                                    <p class="font-medium">{{ createForm.facilityName || 'New facility' }}</p>
                                    <p class="text-muted-foreground">{{ createForm.tenantName || 'Organization' }} | {{ createForm.tenantCountryCode || 'Country' }}</p>
                                </div>
                                <div class="flex flex-wrap gap-1.5">
                                    <Badge variant="outline">{{ createForm.facilityType ? formatEnumLabel(createForm.facilityType) : 'Facility type' }}</Badge>
                                    <Badge variant="outline">{{ createForm.facilityTier ? formatEnumLabel(createForm.facilityTier) : 'Facility tier' }}</Badge>
                                </div>
                            </div>

                            <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Organization Foundation</legend>
                                <FormFieldShell input-id="facility-create-tenant-code" label="Organization code" required :error-message="firstError(createErrors, 'tenantCode')">
                                    <Input id="facility-create-tenant-code" v-model="createForm.tenantCode" :disabled="createSaving" />
                                </FormFieldShell>
                                <FormFieldShell input-id="facility-create-tenant-name" label="Organization name" required :error-message="firstError(createErrors, 'tenantName')">
                                    <Input id="facility-create-tenant-name" v-model="createForm.tenantName" :disabled="createSaving" />
                                </FormFieldShell>
                                <FormFieldShell input-id="facility-create-tenant-country" label="Country" required :error-message="firstError(createErrors, 'tenantCountryCode')">
                                    <Select :model-value="createForm.tenantCountryCode || undefined" @update:model-value="createForm.tenantCountryCode = String($event ?? '')">
                                        <SelectTrigger id="facility-create-tenant-country" class="w-full" :disabled="createSaving">
                                            <SelectValue placeholder="Select country" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="option in createCountryOptions" :key="option.code" :value="option.code">{{ option.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormFieldShell>
                                <FormFieldShell input-id="facility-create-tenant-country-profile" label="Allowed country profile" :error-message="firstError(createErrors, 'tenantAllowedCountryCodes') || firstError(createErrors, 'tenantAllowedCountryCodes.0')">
                                    <Select :model-value="createForm.tenantAllowedCountryCodes[0] ?? undefined" @update:model-value="createForm.tenantAllowedCountryCodes = $event ? [String($event)] : []">
                                        <SelectTrigger id="facility-create-tenant-country-profile" class="w-full" :disabled="createSaving">
                                            <SelectValue placeholder="Select profile" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="option in createCountryOptions" :key="`allowed-${option.code}`" :value="option.code">{{ option.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormFieldShell>
                            </fieldset>

                            <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Facility Profile</legend>
                                <FormFieldShell input-id="facility-create-code" label="Facility code" required :error-message="firstError(createErrors, 'facilityCode')">
                                    <Input id="facility-create-code" v-model="createForm.facilityCode" :disabled="createSaving" />
                                </FormFieldShell>
                                <FormFieldShell input-id="facility-create-name" label="Facility name" required :error-message="firstError(createErrors, 'facilityName')">
                                    <Input id="facility-create-name" v-model="createForm.facilityName" :disabled="createSaving" />
                                </FormFieldShell>
                                <FormFieldShell input-id="facility-create-type" label="Facility type">
                                    <Select :model-value="createForm.facilityType || undefined" @update:model-value="createForm.facilityType = String($event ?? '')">
                                        <SelectTrigger id="facility-create-type" class="w-full" :disabled="createSaving"><SelectValue placeholder="Select facility type" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="hospital">Hospital</SelectItem>
                                            <SelectItem value="dispensary">Dispensary</SelectItem>
                                            <SelectItem value="clinic">Clinic</SelectItem>
                                            <SelectItem value="diagnostic_center">Diagnostic center</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormFieldShell>
                                <FormFieldShell input-id="facility-create-tier" label="Facility tier">
                                    <Select :model-value="createForm.facilityTier || undefined" @update:model-value="createForm.facilityTier = String($event ?? '')">
                                        <SelectTrigger id="facility-create-tier" class="w-full" :disabled="createSaving"><SelectValue placeholder="Select facility tier" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="primary_care">Primary care</SelectItem>
                                            <SelectItem value="secondary_care">Secondary care</SelectItem>
                                            <SelectItem value="tertiary_care">Tertiary care</SelectItem>
                                            <SelectItem value="specialist">Specialist</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormFieldShell>
                                <FormFieldShell input-id="facility-create-timezone" label="Timezone" container-class="sm:col-span-2">
                                    <Input id="facility-create-timezone" v-model="createForm.timezone" :disabled="createSaving" />
                                </FormFieldShell>
                            </fieldset>

                            <fieldset class="grid gap-3 rounded-lg border p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Facility Admin Assignment</legend>

                                <div class="inline-flex w-fit rounded-md border bg-muted/20 p-1">
                                    <Button type="button" size="sm" :variant="createAdminMode === 'select' ? 'secondary' : 'ghost'" :disabled="createSaving" @click="createAdminMode = 'select'">
                                        Select existing
                                    </Button>
                                    <Button type="button" size="sm" :variant="createAdminMode === 'create' ? 'secondary' : 'ghost'" :disabled="createSaving" @click="createAdminMode = 'create'">
                                        Create new
                                    </Button>
                                </div>

                                <div v-if="createAdminMode === 'select'" class="grid gap-3">
                                    <div v-if="selectedFacilityAdmin" class="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p class="text-sm font-medium">{{ selectedFacilityAdmin.name || 'Unnamed user' }}</p>
                                            <p class="text-xs text-muted-foreground">{{ selectedFacilityAdmin.email || 'No email' }} | {{ userRoleLabel(selectedFacilityAdmin) }}</p>
                                        </div>
                                        <Button variant="outline" size="sm" :disabled="createSaving" @click="clearFacilityAdmin">Change</Button>
                                    </div>

                                    <div v-else class="grid gap-3">
                                        <FormFieldShell input-id="facility-create-admin-search" label="Eligible Facility Administrator" :error-message="firstError(createErrors, 'facilityAdminUserId')" :reserve-message-space="false">
                                            <div class="relative">
                                                <Input id="facility-create-admin-search" v-model="adminSearch" placeholder="Search by name or email" :disabled="createSaving" class="pr-10" />
                                                <AppIcon v-if="adminCandidatesLoading" name="refresh-cw" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                                                <AppIcon v-else name="search" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                            </div>
                                        </FormFieldShell>
                                        <Alert v-if="adminCandidatesError" variant="destructive">
                                            <AlertTitle>Admin search issue</AlertTitle>
                                            <AlertDescription>{{ adminCandidatesError }}</AlertDescription>
                                        </Alert>
                                        <div v-else-if="adminCandidatesLoading" class="space-y-2">
                                            <Skeleton class="h-12 w-full" />
                                            <Skeleton class="h-12 w-full" />
                                        </div>
                                        <div v-else-if="adminCandidates.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                            {{ adminSearch.trim().length < 2 ? 'Start typing to search eligible Facility Administrators.' : 'No eligible Facility Administrator matched this search.' }}
                                        </div>
                                        <div v-else class="grid gap-2">
                                            <button
                                                v-for="user in adminCandidates"
                                                :key="String(user.id)"
                                                type="button"
                                                class="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                                                :disabled="createSaving"
                                                @click="selectFacilityAdmin(user)"
                                            >
                                                <span class="min-w-0">
                                                    <span class="block truncate font-medium">{{ user.name || 'Unnamed user' }}</span>
                                                    <span class="block truncate text-xs text-muted-foreground">{{ user.email || 'No email' }} | {{ userRoleLabel(user) }}</span>
                                                </span>
                                                <Badge :variant="vStatus(user.status)">{{ formatEnumLabel(user.status) }}</Badge>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div v-else class="grid gap-3 md:grid-cols-2">
                                    <FormFieldShell input-id="facility-create-admin-name" label="Admin name" required :error-message="firstError(createErrors, 'facilityAdmin.name')">
                                        <Input id="facility-create-admin-name" v-model="createAdminForm.name" :disabled="createSaving" />
                                    </FormFieldShell>
                                    <FormFieldShell input-id="facility-create-admin-email" label="Admin email" required :error-message="firstError(createErrors, 'facilityAdmin.email')">
                                        <Input id="facility-create-admin-email" v-model="createAdminForm.email" type="email" :disabled="createSaving" />
                                    </FormFieldShell>
                                    <div class="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground md:col-span-2">
                                        <AppIcon name="shield-check" class="mt-0.5 size-4 shrink-0" />
                                        <span>The new user will be created as an active Facility Administrator for this organization.</span>
                                    </div>
                                </div>
                                <p v-if="firstError(createErrors, 'facilityAdmin')" class="text-xs text-destructive">{{ firstError(createErrors, 'facilityAdmin') }}</p>
                            </fieldset>
                        </div>
                    </ScrollArea>

                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <div class="flex w-full flex-wrap items-center justify-between gap-2">
                            <p class="text-xs text-muted-foreground">{{ createForm.facilityName || 'Facility' }} will be created under {{ createForm.tenantName || 'the organization' }}.</p>
                            <div class="flex items-center gap-2">
                                <Button variant="outline" :disabled="createSaving" @click="closeCreate">Cancel</Button>
                                <Button :disabled="createSaving" class="gap-1.5" @click="createFacility">
                                    <AppIcon name="plus" class="size-3.5" />
                                    {{ createSaving ? 'Creating...' : 'Create Facility' }}
                                </Button>
                            </div>
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    </AppLayout>
</template>