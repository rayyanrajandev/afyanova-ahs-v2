<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type ClinicalSpecialty = { id: string | null; code: string | null; name: string | null };
type PrivilegeCatalog = {
    id: string | null;
    specialtyId: string | null;
    code: string | null;
    name: string | null;
    description: string | null;
    cadreCode: string | null;
    facilityType: string | null;
    status: string | null;
    statusReason: string | null;
    createdAt: string | null;
    updatedAt: string | null;
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
type CatalogListResponse = { data: PrivilegeCatalog[]; meta: Pagination };
type CatalogResponse = { data: PrivilegeCatalog };
type SpecialtyListResponse = { data: ClinicalSpecialty[]; meta: Pagination };
type AuditLogListResponse = { data: AuditLog[]; meta: Pagination };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Platform Admin', href: '/platform/admin/privilege-catalogs' },
    { title: 'Privilege Catalog', href: '/platform/admin/privilege-catalogs' },
];

const { permissionState } = usePlatformAccess();
const canRead = computed(() => permissionState('staff.privileges.read') === 'allowed');
const canCreate = computed(() => permissionState('staff.privileges.create') === 'allowed');
const canUpdate = computed(() => permissionState('staff.privileges.update') === 'allowed');
const canUpdateStatus = computed(() => permissionState('staff.privileges.update-status') === 'allowed');
const canViewAudit = computed(() => permissionState('staff.privileges.view-audit-logs') === 'allowed');
const canReadSpecialties = computed(() => permissionState('specialties.read') === 'allowed');

const loading = ref(true);
const listLoading = ref(false);
const specialtyLoading = ref(false);
const auditLoading = ref(false);
const errors = ref<string[]>([]);
const specialtyError = ref<string | null>(null);
const auditError = ref<string | null>(null);

const catalogs = ref<PrivilegeCatalog[]>([]);
const pagination = ref<Pagination | null>(null);
const specialties = ref<ClinicalSpecialty[]>([]);
const auditLogs = ref<AuditLog[]>([]);
const selectedCatalogId = ref<string | null>(null);

const filters = reactive({
    q: '',
    status: '',
    specialtyId: '',
    cadreCode: '',
    facilityType: '',
    page: 1,
    perPage: 20,
});

const createDialogOpen = ref(false);
const createLoading = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const createForm = reactive({
    specialtyId: '',
    code: '',
    name: '',
    description: '',
    cadreCode: '',
    facilityType: '',
});

const editDialogOpen = ref(false);
const editLoading = ref(false);
const editErrors = ref<Record<string, string[]>>({});
const editCatalog = ref<PrivilegeCatalog | null>(null);
const editForm = reactive({
    specialtyId: '',
    code: '',
    name: '',
    description: '',
    cadreCode: '',
    facilityType: '',
});

const statusDialogOpen = ref(false);
const statusLoading = ref(false);
const statusError = ref<string | null>(null);
const statusCatalog = ref<PrivilegeCatalog | null>(null);
const statusTarget = ref<'active' | 'inactive'>('active');
const statusReason = ref('');

const selectedCatalog = computed(() =>
    catalogs.value.find((catalog) => catalog.id === selectedCatalogId.value) ?? null,
);

const visibleCounts = computed(() => {
    const counts = { active: 0, inactive: 0 };
    for (const catalog of catalogs.value) {
        if ((catalog.status ?? '').toLowerCase() === 'inactive') counts.inactive += 1;
        else counts.active += 1;
    }
    return counts;
});
const catalogFilterCount = computed(() => {
    let count = 0;
    if (filters.q.trim()) count += 1;
    if (filters.status) count += 1;
    if (filters.specialtyId) count += 1;
    if (filters.cadreCode.trim()) count += 1;
    if (filters.facilityType.trim()) count += 1;
    if (filters.perPage !== 20) count += 1;
    return count;
});
const catalogListSummaryText = computed(() => {
    const total = pagination.value?.total ?? catalogs.value.length;
    const segments = [`${total} templates in scope`, `${visibleCounts.value.active} active`];

    if (visibleCounts.value.inactive > 0) {
        segments.push(`${visibleCounts.value.inactive} inactive`);
    }

    if (catalogFilterCount.value > 0) {
        segments.push(`${catalogFilterCount.value} filters applied`);
    }

    return segments.join(' | ');
});

function csrfToken(): string | null {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
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

function formatDateTime(value: string | null): string {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    return (status ?? '').toLowerCase() === 'inactive' ? 'destructive' : 'secondary';
}

function actorLabel(log: AuditLog): string {
    return log.actor?.displayName?.trim() || (log.actorId === null ? 'System' : `User #${log.actorId}`);
}

function specialtyLabel(specialtyId: string | null): string {
    const specialty = specialties.value.find((item) => item.id === specialtyId) ?? null;
    if (!specialty) return specialtyId || 'Not mapped';
    if (specialty.code && specialty.name) return `${specialty.code} - ${specialty.name}`;
    return specialty.name || specialty.code || specialty.id || 'Not mapped';
}

function resetCreateForm() {
    Object.assign(createForm, {
        specialtyId: '',
        code: '',
        name: '',
        description: '',
        cadreCode: '',
        facilityType: '',
    });
}

function openCreateDialog() {
    createErrors.value = {};
    resetCreateForm();
    createDialogOpen.value = true;
}

function syncEditForm(catalog: PrivilegeCatalog) {
    Object.assign(editForm, {
        specialtyId: catalog.specialtyId ?? '',
        code: catalog.code ?? '',
        name: catalog.name ?? '',
        description: catalog.description ?? '',
        cadreCode: catalog.cadreCode ?? '',
        facilityType: catalog.facilityType ?? '',
    });
}

function applyCatalogFilters(): void {
    filters.page = 1;
    void loadCatalogs(false);
}

function resetCatalogFilters(): void {
    filters.q = '';
    filters.status = '';
    filters.specialtyId = '';
    filters.cadreCode = '';
    filters.facilityType = '';
    filters.page = 1;
    filters.perPage = 20;
    void loadCatalogs(false);
}
function setCatalogStatusFilter(status: '' | 'active' | 'inactive'): void {
    filters.status = status;
    applyCatalogFilters();
}

async function loadCatalogs(preserveSelection = true) {
    if (!canRead.value) {
        catalogs.value = [];
        pagination.value = null;
        loading.value = false;
        listLoading.value = false;
        return;
    }

    listLoading.value = true;
    errors.value = [];

    try {
        const response = await apiRequest<CatalogListResponse>('GET', '/privilege-catalogs', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status || null,
                specialtyId: filters.specialtyId || null,
                cadreCode: filters.cadreCode.trim() || null,
                facilityType: filters.facilityType.trim() || null,
                page: filters.page,
                perPage: filters.perPage,
                sortBy: 'name',
                sortDir: 'asc',
            },
        });

        catalogs.value = response.data ?? [];
        pagination.value = response.meta ?? null;
        if (!preserveSelection || !catalogs.value.some((catalog) => catalog.id === selectedCatalogId.value)) {
            selectedCatalogId.value = catalogs.value[0]?.id ?? null;
        }
    } catch (error) {
        catalogs.value = [];
        pagination.value = null;
        selectedCatalogId.value = null;
        errors.value = [messageFromUnknown(error, 'Unable to load privilege catalog templates.')];
    } finally {
        listLoading.value = false;
        loading.value = false;
    }
}

async function loadSpecialties() {
    if (!canReadSpecialties.value) {
        specialties.value = [];
        return;
    }

    specialtyLoading.value = true;
    specialtyError.value = null;
    try {
        const response = await apiRequest<SpecialtyListResponse>('GET', '/specialties', {
            query: { perPage: 200, sortBy: 'name', sortDir: 'asc' },
        });
        specialties.value = response.data ?? [];
    } catch (error) {
        specialties.value = [];
        specialtyError.value = messageFromUnknown(error, 'Unable to load specialties.');
    } finally {
        specialtyLoading.value = false;
    }
}

async function loadAuditLogs(id: string | null) {
    if (!canViewAudit.value || !id) {
        auditLogs.value = [];
        auditError.value = null;
        auditLoading.value = false;
        return;
    }

    auditLoading.value = true;
    auditError.value = null;
    try {
        const response = await apiRequest<AuditLogListResponse>('GET', `/privilege-catalogs/${id}/audit-logs`, {
            query: { perPage: 20 },
        });
        auditLogs.value = response.data ?? [];
    } catch (error) {
        auditLogs.value = [];
        auditError.value = messageFromUnknown(error, 'Unable to load privilege catalog audit logs.');
    } finally {
        auditLoading.value = false;
    }
}

async function refreshPage() {
    await Promise.all([loadSpecialties(), loadCatalogs()]);
}

async function createCatalog() {
    if (!canCreate.value) return;

    createLoading.value = true;
    createErrors.value = {};
    try {
        const response = await apiRequest<CatalogResponse>('POST', '/privilege-catalogs', {
            body: {
                specialtyId: createForm.specialtyId,
                code: createForm.code,
                name: createForm.name,
                description: createForm.description || null,
                cadreCode: createForm.cadreCode || null,
                facilityType: createForm.facilityType || null,
            },
        });

        resetCreateForm();
        createDialogOpen.value = false;
        filters.page = 1;
        selectedCatalogId.value = response.data.id;
        await loadCatalogs();
        notifySuccess('Privilege template created.');
    } catch (error) {
        createErrors.value = (error as { payload?: ValidationErrorResponse }).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to create privilege template.'));
    } finally {
        createLoading.value = false;
    }
}

function openEditDialog(catalog: PrivilegeCatalog) {
    editCatalog.value = catalog;
    editErrors.value = {};
    syncEditForm(catalog);
    editDialogOpen.value = true;
}

async function saveEdit() {
    if (!canUpdate.value || !editCatalog.value?.id) return;

    editLoading.value = true;
    editErrors.value = {};
    try {
        const response = await apiRequest<CatalogResponse>('PATCH', `/privilege-catalogs/${editCatalog.value.id}`, {
            body: {
                specialtyId: editForm.specialtyId,
                code: editForm.code,
                name: editForm.name,
                description: editForm.description || null,
                cadreCode: editForm.cadreCode || null,
                facilityType: editForm.facilityType || null,
            },
        });

        editDialogOpen.value = false;
        selectedCatalogId.value = response.data.id;
        await loadCatalogs();
        await loadAuditLogs(response.data.id);
        notifySuccess('Privilege template updated.');
    } catch (error) {
        editErrors.value = (error as { payload?: ValidationErrorResponse }).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to update privilege template.'));
    } finally {
        editLoading.value = false;
    }
}

function openStatusDialog(catalog: PrivilegeCatalog, nextStatus: 'active' | 'inactive') {
    statusCatalog.value = catalog;
    statusTarget.value = nextStatus;
    statusReason.value = nextStatus === 'inactive' ? catalog.statusReason ?? '' : '';
    statusError.value = null;
    statusDialogOpen.value = true;
}

async function saveStatus() {
    if (!canUpdateStatus.value || !statusCatalog.value?.id) return;

    statusLoading.value = true;
    statusError.value = null;
    try {
        const response = await apiRequest<CatalogResponse>('PATCH', `/privilege-catalogs/${statusCatalog.value.id}/status`, {
            body: {
                status: statusTarget.value,
                reason: statusReason.value || null,
            },
        });

        statusDialogOpen.value = false;
        selectedCatalogId.value = response.data.id;
        await loadCatalogs();
        await loadAuditLogs(response.data.id);
        notifySuccess(`Privilege template marked ${statusTarget.value}.`);
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update privilege template status.');
        notifyError(statusError.value);
    } finally {
        statusLoading.value = false;
    }
}

watch(selectedCatalogId, async (id) => {
    await loadAuditLogs(id);
});

onMounted(async () => {
    await refreshPage();
});
</script>

<template>
    <Head title="Privilege Catalog" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-5 px-4 py-6 md:px-6">
            <section class="space-y-2">
                <h1 class="text-2xl font-semibold tracking-tight text-foreground">Privilege Catalog Registry</h1>
                <p class="max-w-3xl text-sm text-muted-foreground">
                    Govern reusable privilege templates by specialty, cadre, and facility type so staff grants stay
                    consistent across Tanzania-facing workflows.
                </p>
            </section>

            <Alert v-if="!canRead && !canCreate" variant="destructive">
                <AppIcon name="shield-check" class="h-4 w-4" />
                <AlertTitle>Permission required</AlertTitle>
                <AlertDescription>
                    This registry needs <code>staff.privileges.*</code> access before templates can be viewed or managed.
                </AlertDescription>
            </Alert>

            <Alert v-else-if="specialtyError" variant="destructive">
                <AppIcon name="activity" class="h-4 w-4" />
                <AlertTitle>Specialty catalog unavailable</AlertTitle>
                <AlertDescription>{{ specialtyError }}</AlertDescription>
            </Alert>

            <template v-else>
                <div v-if="canRead" class="space-y-4">
                    <div class="flex flex-col gap-3 rounded-lg border border-sidebar-border/70 bg-muted/20 p-3 md:flex-row md:items-center md:justify-between">
                        <div class="flex flex-wrap items-center gap-2">
                            <Button size="sm" :variant="filters.status === '' ? 'default' : 'outline'" @click="setCatalogStatusFilter('')">All</Button>
                            <Button size="sm" :variant="filters.status === 'active' ? 'default' : 'outline'" @click="setCatalogStatusFilter('active')">Active</Button>
                            <Button size="sm" :variant="filters.status === 'inactive' ? 'default' : 'outline'" @click="setCatalogStatusFilter('inactive')">Inactive</Button>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{{ loading ? 'Loading templates...' : catalogListSummaryText }}</span>
                            <Button v-if="catalogFilterCount > 0" variant="outline" size="sm" @click="resetCatalogFilters">Reset</Button>
                            <Button variant="outline" size="sm" class="gap-1.5" :disabled="listLoading || specialtyLoading" @click="refreshPage">
                                <AppIcon name="activity" class="size-3.5" />
                                {{ listLoading || specialtyLoading ? 'Refreshing...' : 'Refresh' }}
                            </Button>
                            <Button v-if="canCreate" size="sm" class="gap-1.5" @click="openCreateDialog">
                                <AppIcon name="plus" class="size-3.5" />
                                Create template
                            </Button>
                        </div>
                    </div>

                    <div class="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.42fr)]">
                        <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70">
                            <CardHeader class="gap-3 border-b pb-3 pt-4">
                                <div class="space-y-3">
                                    <div class="min-w-0 space-y-1">
                                        <CardTitle class="flex items-center gap-2 text-base">
                                            <AppIcon name="layout-list" class="size-4.5 text-muted-foreground" />
                                            Privilege Templates
                                        </CardTitle>
                                        <CardDescription>Select a template to review detail and governance activity.</CardDescription>
                                    </div>
                                    <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                                        <div class="relative min-w-0 flex-1">
                                            <AppIcon name="search" class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                v-model="filters.q"
                                                placeholder="Search code, name, specialty, cadre, or facility"
                                                class="h-9 pl-9"
                                                @keyup.enter="applyCatalogFilters"
                                            />
                                        </div>
                                        <Popover>
                                            <PopoverTrigger as-child>
                                                <Button variant="outline" size="sm" class="gap-1.5 sm:self-stretch">
                                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                    Queue options
                                                    <Badge v-if="catalogFilterCount > 0" variant="secondary" class="ml-1 text-[10px]">{{ catalogFilterCount }}</Badge>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent align="end" class="w-[18rem] rounded-lg p-0">
                                                <div class="space-y-3 border-b px-4 py-3">
                                                    <p class="flex items-center gap-2 text-sm font-medium">
                                                        <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                                        Queue options
                                                    </p>
                                                    <div class="grid gap-2">
                                                        <Label for="catalog-status-popover">Status</Label>
                                                        <Select v-model="filters.status">
                                                            <SelectTrigger class="w-full">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                            <SelectItem value="">All</SelectItem>
                                                            <SelectItem value="active">Active</SelectItem>
                                                            <SelectItem value="inactive">Inactive</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div class="grid gap-2">
                                                        <Label for="catalog-specialty-popover">Specialty</Label>
                                                        <Select
                                                            v-if="specialties.length > 0"
                                                            v-model="filters.specialtyId"
                                                        >
                                                            <SelectTrigger class="w-full">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                            <SelectItem value="">All specialties</SelectItem>
                                                            <SelectItem
                                                                v-for="specialty in specialties"
                                                                :key="specialty.id ?? specialty.code ?? specialty.name"
                                                                :value="specialty.id ?? ''"
                                                            >
                                                                {{ specialty.code ? specialty.code + ' - ' + specialty.name : specialty.name }}
                                                            </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Input
                                                            v-else
                                                            id="catalog-specialty-popover"
                                                            v-model="filters.specialtyId"
                                                            placeholder="Specialty UUID"
                                                        />
                                                    </div>
                                                    <div class="grid gap-2 sm:grid-cols-2">
                                                        <div class="grid gap-2">
                                                            <Label for="catalog-cadre-popover">Cadre code</Label>
                                                            <Input id="catalog-cadre-popover" v-model="filters.cadreCode" placeholder="clinical_officer" />
                                                        </div>
                                                        <div class="grid gap-2">
                                                            <Label for="catalog-facility-popover">Facility type</Label>
                                                            <Input id="catalog-facility-popover" v-model="filters.facilityType" placeholder="hospital" />
                                                        </div>
                                                    </div>
                                                    <div class="grid gap-2">
                                                        <Label for="catalog-per-page-popover">Per page</Label>
                                                        <Select :model-value="String(filters.perPage)" @update:model-value="filters.perPage = Number($event)">
                                                            <SelectTrigger class="w-full">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                            <SelectItem value="20">20</SelectItem>
                                                            <SelectItem value="50">50</SelectItem>
                                                            <SelectItem value="100">100</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div class="flex flex-wrap items-center justify-between gap-2 bg-muted/30 px-4 py-3">
                                                    <Button variant="outline" size="sm" @click="resetCatalogFilters">Reset</Button>
                                                    <Button size="sm" class="gap-1.5" :disabled="listLoading" @click="applyCatalogFilters">
                                                        <AppIcon name="search" class="size-3.5" />
                                                        Search
                                                    </Button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent class="p-0">
                                <Alert v-if="errors.length > 0" variant="destructive" class="mx-4 mt-4">
                                    <AlertTitle>Privilege template queue unavailable</AlertTitle>
                                    <AlertDescription>
                                        <ul class="mt-2 list-disc space-y-1 pl-5">
                                            <li v-for="error in errors" :key="error">{{ error }}</li>
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                                <div v-if="loading || catalogs.length > 0" class="hidden border-b bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,auto)] md:items-center md:gap-2.5">
                                    <span>Template</span>
                                    <span class="text-right">Actions</span>
                                </div>
                                <div v-if="loading" class="divide-y">
                                    <div v-for="index in 6" :key="'catalog-skeleton-' + index" class="grid items-center gap-2.5 px-4 py-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,auto)]">
                                        <div class="min-w-0">
                                            <Skeleton class="h-4 w-full max-w-[22rem]" />
                                        </div>
                                        <div class="flex items-center justify-end gap-2">
                                            <Skeleton class="hidden h-8 w-16 rounded-md lg:block" />
                                            <Skeleton class="h-8 w-8 rounded-md lg:hidden" />
                                        </div>
                                    </div>
                                </div>
                                <div v-else-if="catalogs.length === 0" class="px-4 py-6">
                                    <div class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                        No privilege templates found for the current queue options.
                                    </div>
                                </div>
                                <div v-else class="divide-y">
                                    <div
                                        v-for="catalog in catalogs"
                                        :key="catalog.id ?? catalog.code ?? catalog.name"
                                        class="group grid items-center gap-2.5 border-l-2 px-4 py-2 transition-colors hover:bg-muted/30 md:grid-cols-[minmax(0,1fr)_minmax(0,auto)]"
                                        :class="selectedCatalogId === catalog.id ? 'border-primary bg-primary/5' : 'border-transparent'"
                                    >
                                        <div class="min-w-0">
                                            <button class="block truncate text-left text-sm font-medium hover:text-primary hover:underline" @click="selectedCatalogId = catalog.id">
                                                {{ catalog.code || 'No code' }} - {{ catalog.name || 'Unnamed template' }}
                                            </button>
                                        </div>
                                        <div class="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="sm" class="hidden lg:inline-flex" @click="selectedCatalogId = catalog.id">
                                                <AppIcon name="eye" class="size-3.5" />
                                                Open
                                            </Button>
                                            <Button variant="ghost" size="icon-sm" class="lg:hidden" @click="selectedCatalogId = catalog.id">
                                                <AppIcon name="eye" class="size-4" />
                                                <span class="sr-only">Open privilege template details</span>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3">
                                    <p class="text-xs text-muted-foreground">
                                        Showing {{ catalogs.length }} of {{ pagination?.total ?? catalogs.length }} results | Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                                    </p>
                                    <div v-if="(pagination?.lastPage ?? 1) > 1" class="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            :disabled="listLoading || (pagination?.currentPage ?? 1) <= 1"
                                            @click="filters.page = Math.max(filters.page - 1, 1); loadCatalogs(false)"
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            :disabled="listLoading || !pagination || pagination.currentPage >= pagination.lastPage"
                                            @click="filters.page += 1; loadCatalogs(false)"
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </footer>
                            </CardContent>
                        </Card>

                        <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70">
                            <template v-if="loading">
                                <CardHeader class="gap-3 border-b pb-3">
                                    <Skeleton class="h-5 w-44" />
                                    <Skeleton class="h-4 w-64" />
                                </CardHeader>
                                <CardContent class="space-y-4 p-4">
                                    <div class="grid gap-3 sm:grid-cols-3">
                                        <Skeleton class="h-20 rounded-lg" />
                                        <Skeleton class="h-20 rounded-lg" />
                                        <Skeleton class="h-20 rounded-lg" />
                                    </div>
                                    <Skeleton class="h-24 rounded-lg" />
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <Skeleton class="h-24 rounded-lg" />
                                        <Skeleton class="h-24 rounded-lg" />
                                    </div>
                                    <Skeleton class="h-36 rounded-lg" />
                                </CardContent>
                            </template>
                            <template v-else-if="selectedCatalog">
                                <CardHeader class="gap-4 border-b pb-4">
                                    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div class="min-w-0 space-y-1">
                                            <CardTitle class="text-base">
                                                {{ selectedCatalog.code || 'No code' }} - {{ selectedCatalog.name || 'Unnamed template' }}
                                            </CardTitle>
                                            <CardDescription>
                                                {{ selectedCatalog.description || 'No description recorded for this privilege template.' }}
                                            </CardDescription>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Button
                                                v-if="canViewAudit"
                                                variant="outline"
                                                size="sm"
                                                class="gap-1.5"
                                                :disabled="auditLoading"
                                                @click="selectedCatalog && loadAuditLogs(selectedCatalog.id)"
                                            >
                                                <AppIcon name="shield-check" class="size-3.5" />
                                                {{ auditLoading ? 'Refreshing audit...' : 'Refresh audit' }}
                                            </Button>
                                            <Button v-if="canUpdate" variant="outline" size="sm" class="gap-1.5" @click="openEditDialog(selectedCatalog)">
                                                <AppIcon name="pencil" class="size-3.5" />
                                                Edit
                                            </Button>
                                            <Button
                                                v-if="canUpdateStatus"
                                                size="sm"
                                                class="gap-1.5"
                                                :variant="(selectedCatalog.status ?? '').toLowerCase() === 'active' ? 'destructive' : 'secondary'"
                                                @click="openStatusDialog(selectedCatalog, (selectedCatalog.status ?? '').toLowerCase() === 'active' ? 'inactive' : 'active')"
                                            >
                                                <AppIcon :name="(selectedCatalog.status ?? '').toLowerCase() === 'active' ? 'circle-x' : 'check-circle'" class="size-3.5" />
                                                {{ (selectedCatalog.status ?? '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate' }}
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent class="space-y-4 p-4">
                                    <div class="grid gap-3 sm:grid-cols-3">
                                        <div class="rounded-lg border bg-muted/20 p-3">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Status</p>
                                            <div class="mt-2">
                                                <Badge :variant="statusVariant(selectedCatalog.status)">{{ selectedCatalog.status || 'unknown' }}</Badge>
                                            </div>
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 p-3">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Specialty</p>
                                            <p class="mt-2 text-sm font-medium">{{ specialtyLabel(selectedCatalog.specialtyId) }}</p>
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 p-3">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Updated</p>
                                            <p class="mt-2 text-sm font-medium">{{ formatDateTime(selectedCatalog.updatedAt || selectedCatalog.createdAt) }}</p>
                                        </div>
                                    </div>

                                    <div class="rounded-lg border p-4">
                                        <h3 class="text-sm font-medium">Description</h3>
                                        <p class="mt-2 text-sm text-muted-foreground">
                                            {{ selectedCatalog.description || 'No description recorded for this privilege template.' }}
                                        </p>
                                    </div>

                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <div class="rounded-lg border p-4">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Cadre code</p>
                                            <p class="mt-2 text-sm font-medium">{{ selectedCatalog.cadreCode || 'Not specified' }}</p>
                                        </div>
                                        <div class="rounded-lg border p-4">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Facility type</p>
                                            <p class="mt-2 text-sm font-medium">{{ selectedCatalog.facilityType || 'Not specified' }}</p>
                                        </div>
                                    </div>

                                    <div v-if="selectedCatalog.statusReason" class="rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                                        <h3 class="text-sm font-medium text-foreground">Status reason</h3>
                                        <p class="mt-2 text-sm text-muted-foreground">{{ selectedCatalog.statusReason }}</p>
                                    </div>

                                    <div class="rounded-lg border p-4">
                                        <div class="flex items-center justify-between gap-3">
                                            <div>
                                                <h3 class="text-sm font-medium">Audit activity</h3>
                                                <p class="text-xs text-muted-foreground">Recent governance changes and actor trail for this template.</p>
                                            </div>
                                        </div>
                                        <div v-if="!canViewAudit" class="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                                            Audit history is hidden for your role.
                                        </div>
                                        <Alert v-else-if="auditError" variant="destructive" class="mt-4">
                                            <AlertTitle>Audit load issue</AlertTitle>
                                            <AlertDescription>{{ auditError }}</AlertDescription>
                                        </Alert>
                                        <div v-else-if="auditLoading" class="mt-4 space-y-2">
                                            <Skeleton class="h-10 w-full" />
                                            <Skeleton class="h-10 w-full" />
                                            <Skeleton class="h-10 w-full" />
                                        </div>
                                        <div v-else-if="auditLogs.length === 0" class="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                                            No audit logs found for this privilege template.
                                        </div>
                                        <div v-else class="mt-4 space-y-3">
                                            <div v-for="log in auditLogs" :key="log.id" class="flex items-start gap-3 rounded-lg border bg-muted/10 px-3 py-3">
                                                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                                    <AppIcon name="activity" class="size-3.5 text-muted-foreground" />
                                                </div>
                                                <div class="min-w-0 flex-1">
                                                    <p class="text-sm font-medium">{{ log.actionLabel || log.action || 'Activity' }}</p>
                                                    <p class="mt-0.5 text-xs text-muted-foreground">
                                                        {{ formatDateTime(log.createdAt) }} | {{ actorLabel(log) }}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </template>
                            <template v-else>
                                <CardContent class="flex min-h-[18rem] items-center justify-center p-6">
                                    <div class="max-w-sm text-center text-sm text-muted-foreground">
                                        Select a privilege template from the queue to review detail and audit activity.
                                    </div>
                                </CardContent>
                            </template>
                        </Card>
                    </div>

                    <Dialog v-model:open="createDialogOpen">
                        <DialogContent size="2xl">
                            <DialogHeader>
                                <DialogTitle>Create Privilege Template</DialogTitle>
                                <DialogDescription>Add a governed privilege template for specialty, cadre, and facility scope.</DialogDescription>
                            </DialogHeader>

                            <div class="grid gap-4 py-2">
                                <div class="space-y-2">
                                    <Label for="create-specialty-id">Specialty</Label>
                                    <Select
                                        v-if="specialties.length > 0"
                                        v-model="createForm.specialtyId"
                                    >
                                        <SelectTrigger :disabled="createLoading || specialtyLoading">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">Select specialty</SelectItem>
                                        <SelectItem
                                            v-for="specialty in specialties"
                                            :key="specialty.id ?? specialty.code ?? specialty.name"
                                            :value="specialty.id ?? ''"
                                        >
                                            {{ specialty.code ? specialty.code + ' - ' + specialty.name : specialty.name }}
                                        </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        v-else
                                        id="create-specialty-id"
                                        v-model="createForm.specialtyId"
                                        placeholder="Clinical specialty UUID"
                                        :disabled="createLoading"
                                    />
                                    <p v-if="createErrors.specialtyId" class="text-xs text-destructive">{{ createErrors.specialtyId[0] }}</p>
                                </div>

                                <div class="grid gap-4 sm:grid-cols-2">
                                    <div class="space-y-2">
                                        <Label for="create-code">Code</Label>
                                        <Input id="create-code" v-model="createForm.code" :disabled="createLoading" />
                                        <p v-if="createErrors.code" class="text-xs text-destructive">{{ createErrors.code[0] }}</p>
                                    </div>
                                    <div class="space-y-2">
                                        <Label for="create-facility-type">Facility Type</Label>
                                        <Input id="create-facility-type" v-model="createForm.facilityType" :disabled="createLoading" />
                                        <p v-if="createErrors.facilityType" class="text-xs text-destructive">{{ createErrors.facilityType[0] }}</p>
                                    </div>
                                </div>

                                <div class="space-y-2">
                                    <Label for="create-name">Name</Label>
                                    <Input id="create-name" v-model="createForm.name" :disabled="createLoading" />
                                    <p v-if="createErrors.name" class="text-xs text-destructive">{{ createErrors.name[0] }}</p>
                                </div>

                                <div class="space-y-2">
                                    <Label for="create-cadre-code">Cadre Code</Label>
                                    <Input id="create-cadre-code" v-model="createForm.cadreCode" :disabled="createLoading" />
                                    <p v-if="createErrors.cadreCode" class="text-xs text-destructive">{{ createErrors.cadreCode[0] }}</p>
                                </div>

                                <div class="space-y-2">
                                    <Label for="create-description">Description</Label>
                                    <Textarea id="create-description" v-model="createForm.description" rows="4" :disabled="createLoading" />
                                    <p v-if="createErrors.description" class="text-xs text-destructive">{{ createErrors.description[0] }}</p>
                                </div>
                            </div>

                            <DialogFooter class="gap-2">
                                <Button variant="outline" :disabled="createLoading" @click="createDialogOpen = false">Cancel</Button>
                                <Button :disabled="createLoading" class="gap-1.5" @click="createCatalog">
                                    <AppIcon name="plus" class="size-3.5" />
                                    {{ createLoading ? 'Creating...' : 'Create template' }}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card v-else class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                            Privilege Catalog
                        </CardTitle>
                        <CardDescription>Catalog access is permission restricted.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle>Access restricted</AlertTitle>
                            <AlertDescription>Request <code>staff.privileges.read</code> permission.</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </template>
        </div>

        <Dialog v-model:open="editDialogOpen">
            <DialogContent size="2xl">
                <DialogHeader>
                    <DialogTitle>Edit Privilege Template</DialogTitle>
                    <DialogDescription>Update the governed template metadata and scope.</DialogDescription>
                </DialogHeader>

                <div class="grid gap-4 py-2">
                    <div class="space-y-2">
                        <Label for="edit-specialty-id">Specialty</Label>
                        <Select
                            v-if="specialties.length > 0"
                            v-model="editForm.specialtyId"
                        >
                            <SelectTrigger :disabled="editLoading || specialtyLoading">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="">Select specialty</SelectItem>
                            <SelectItem
                                v-for="specialty in specialties"
                                :key="specialty.id ?? specialty.code ?? specialty.name"
                                :value="specialty.id ?? ''"
                            >
                                {{ specialty.code ? `${specialty.code} - ${specialty.name}` : specialty.name }}
                            </SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            v-else
                            id="edit-specialty-id"
                            v-model="editForm.specialtyId"
                            placeholder="Clinical specialty UUID"
                            :disabled="editLoading"
                        />
                        <p v-if="editErrors.specialtyId" class="text-xs text-destructive">{{ editErrors.specialtyId[0] }}</p>
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="space-y-2">
                            <Label for="edit-code">Code</Label>
                            <Input id="edit-code" v-model="editForm.code" :disabled="editLoading" />
                            <p v-if="editErrors.code" class="text-xs text-destructive">{{ editErrors.code[0] }}</p>
                        </div>
                        <div class="space-y-2">
                            <Label for="edit-facility-type">Facility Type</Label>
                            <Input id="edit-facility-type" v-model="editForm.facilityType" :disabled="editLoading" />
                        </div>
                    </div>

                    <div class="space-y-2">
                        <Label for="edit-name">Name</Label>
                        <Input id="edit-name" v-model="editForm.name" :disabled="editLoading" />
                        <p v-if="editErrors.name" class="text-xs text-destructive">{{ editErrors.name[0] }}</p>
                    </div>

                    <div class="space-y-2">
                        <Label for="edit-cadre-code">Cadre Code</Label>
                        <Input id="edit-cadre-code" v-model="editForm.cadreCode" :disabled="editLoading" />
                    </div>

                    <div class="space-y-2">
                        <Label for="edit-description">Description</Label>
                        <Textarea id="edit-description" v-model="editForm.description" rows="4" :disabled="editLoading" />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" :disabled="editLoading" @click="editDialogOpen = false">Cancel</Button>
                    <Button :disabled="editLoading" @click="saveEdit">
                        {{ editLoading ? 'Saving...' : 'Save changes' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="statusDialogOpen">
            <DialogContent size="lg">
                <DialogHeader>
                    <DialogTitle>Update Template Status</DialogTitle>
                    <DialogDescription>
                        {{ statusTarget === 'inactive' ? 'Retire a template from future grants.' : 'Restore a template for active use.' }}
                    </DialogDescription>
                </DialogHeader>

                <div class="space-y-4 py-2">
                    <div class="rounded-lg border border-border/70 p-4 text-sm text-muted-foreground">
                        <p class="font-medium text-foreground">{{ statusCatalog?.code || 'Privilege template' }}</p>
                        <p class="mt-1">{{ statusCatalog?.name || 'No name recorded' }}</p>
                    </div>

                    <div class="space-y-2">
                        <Label for="status-reason">Reason</Label>
                        <Textarea
                            id="status-reason"
                            v-model="statusReason"
                            rows="4"
                            placeholder="Reason for the status decision"
                            :disabled="statusLoading"
                        />
                        <p v-if="statusError" class="text-xs text-destructive">{{ statusError }}</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" :disabled="statusLoading" @click="statusDialogOpen = false">Cancel</Button>
                    <Button :disabled="statusLoading" @click="saveStatus">
                        {{ statusLoading ? 'Saving...' : `Mark ${statusTarget}` }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>








