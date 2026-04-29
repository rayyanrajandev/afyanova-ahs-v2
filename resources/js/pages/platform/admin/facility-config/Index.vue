
<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type Facility = {
  id: string | null; code: string | null; name: string | null; facilityType: string | null; timezone: string | null;
  facilityTier?: string | null;
  tenantCode: string | null; tenantName: string | null; tenantCountryCode: string | null; tenantAllowedCountryCodes: string[];
  status: 'active' | 'inactive' | null; statusReason: string | null;
  operationsOwnerUserId: number | null; clinicalOwnerUserId: number | null; administrativeOwnerUserId: number | null;
  updatedAt: string | null;
};
type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type VError = { message?: string; errors?: Record<string, string[]> };
type AuditLog = {
  id: string; action: string | null; actionLabel?: string | null; createdAt: string | null;
  actorId: number | null; actorType?: 'system' | 'user' | null; actor?: { displayName?: string | null } | null;
  changes?: Record<string, unknown>;
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Platform Admin', href: '/platform/admin/facility-config' },
  { title: 'Facility Configuration', href: '/platform/admin/facility-config' },
];

const { permissionNames, permissionState } = usePlatformAccess();
const { countryProfileFullCatalog, loadCountryProfile } = usePlatformCountryProfile();
const permissionsResolved = computed(() => permissionNames.value !== null);
const canRead = computed(() => permissionState('platform.facilities.read') === 'allowed');
const canCreate = computed(() => permissionState('platform.facilities.create') === 'allowed' || permissionState('platform.facilities.update') === 'allowed');
const canUpdate = computed(() => permissionState('platform.facilities.update') === 'allowed');
const canUpdateStatus = computed(() => permissionState('platform.facilities.update-status') === 'allowed');
const canManageOwners = computed(() => permissionState('platform.facilities.manage-owners') === 'allowed');
const canViewAudit = computed(() => permissionState('platform.facilities.view-audit-logs') === 'allowed');

const loading = ref(true);
const listLoading = ref(false);
const listError = ref<string | null>(null);
const facilities = ref<Facility[]>([]);
const page = ref<Pagination | null>(null);
const filters = reactive({ q: '', status: '', facilityType: '', ownerUserId: '', sortBy: 'name', sortDir: 'asc' as 'asc' | 'desc', perPage: 20, page: 1 });

const createOpen = ref(false);
const createSaving = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const createForm = reactive({
  tenantCode: 'DSK',
  tenantName: 'DSK Dispensary',
  tenantCountryCode: 'TZ',
  tenantAllowedCountryCodes: ['TZ'] as string[],
  facilityCode: 'DSK-DISP',
  facilityName: 'DSK Dispensary',
  facilityType: 'dispensary',
  facilityTier: 'primary_care',
  timezone: 'Africa/Dar_es_Salaam',
  facilityAdminUserId: '',
});

const detailsOpen = ref(false);
const detailsLoading = ref(false);
const detailsError = ref<string | null>(null);
const detailsTab = ref('config');
const selected = ref<Facility | null>(null);

const configForm = reactive({ code: '', name: '', facilityType: '', timezone: '' });
const tenantPolicyForm = reactive({ allowedCountryCodes: [] as string[] });
const statusForm = reactive({ status: 'active', reason: '' });
const ownerForm = reactive({ operationsOwnerUserId: '', clinicalOwnerUserId: '', administrativeOwnerUserId: '' });
const configErrors = ref<Record<string, string[]>>({});
const tenantPolicyErrors = ref<Record<string, string[]>>({});
const statusErrors = ref<Record<string, string[]>>({});
const ownerErrors = ref<Record<string, string[]>>({});
const configSaving = ref(false);
const tenantPolicySaving = ref(false);
const statusSaving = ref(false);
const ownersSaving = ref(false);

const auditLoading = ref(false);
const auditExporting = ref(false);
const auditError = ref<string | null>(null);
const audit = ref<AuditLog[]>([]);
const auditMeta = ref<Pagination | null>(null);
const auditFilters = reactive({ q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20, page: 1 });

function firstError(e: Record<string, string[]> | null | undefined, k: string): string | null { return e?.[k]?.[0] ?? null; }
function csrfToken(): string | null { return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null; }
function toApiDateTime(v: string): string | null { const t = v.trim(); if (!t) return null; const d = new Date(t); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
function fmt(v: string | null): string { if (!v) return 'N/A'; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }); }
function vStatus(s: string | null): 'outline' | 'secondary' | 'destructive' { if (s === 'active') return 'secondary'; if (s === 'inactive') return 'destructive'; return 'outline'; }
function actorLabel(l: AuditLog): string { return l.actor?.displayName?.trim() || (l.actorType === 'system' ? 'System' : l.actorId !== null ? `User #${l.actorId}` : 'Unknown actor'); }
function parseUid(v: string): number | null | 'invalid' { const t = v.trim(); if (!t) return null; const n = Number.parseInt(t, 10); return Number.isFinite(n) && n > 0 ? n : 'invalid'; }
function normalizeCountryCodes(v: string[]): string[] { return Array.from(new Set(v.map((x) => x.trim().toUpperCase()).filter(Boolean))); }
function countryOptionLabel(code: string | null | undefined, name: string | null | undefined): string {
  const normalizedCode = String(code ?? '').trim().toUpperCase();
  const normalizedName = String(name ?? '').trim();
  if (!normalizedCode) return normalizedName || 'Unknown country';
  return normalizedName ? `${normalizedCode} - ${normalizedName}` : normalizedCode;
}

const tenantCountryOptions = computed(() =>
  countryProfileFullCatalog.value
    .map((profile) => {
      const code = String(profile.code ?? '').trim().toUpperCase();
      if (!code) return null;
      return {
        code,
        label: countryOptionLabel(code, profile.name ?? null),
      };
    })
    .filter((option): option is { code: string; label: string } => option !== null),
);

function hydrate(f: Facility): void {
  configForm.code = f.code ?? '';
  configForm.name = f.name ?? '';
  configForm.facilityType = f.facilityType ?? '';
  configForm.timezone = f.timezone ?? '';
  tenantPolicyForm.allowedCountryCodes = normalizeCountryCodes(Array.isArray(f.tenantAllowedCountryCodes) ? f.tenantAllowedCountryCodes : []);
  statusForm.status = (f.status ?? 'active') as 'active' | 'inactive';
  statusForm.reason = f.statusReason ?? '';
  ownerForm.operationsOwnerUserId = f.operationsOwnerUserId === null ? '' : String(f.operationsOwnerUserId);
  ownerForm.clinicalOwnerUserId = f.clinicalOwnerUserId === null ? '' : String(f.clinicalOwnerUserId);
  ownerForm.administrativeOwnerUserId = f.administrativeOwnerUserId === null ? '' : String(f.administrativeOwnerUserId);
}

function syncInQueue(f: Facility): void { const i = facilities.value.findIndex((x) => x.id === f.id); if (i >= 0) facilities.value[i] = f; }

async function api<T>(method: 'GET' | 'POST' | 'PATCH', path: string, options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> }): Promise<T> {
  const url = new URL(`/api/v1${path}`, window.location.origin);
  Object.entries(options?.query ?? {}).forEach(([k, v]) => { if (v !== null && v !== '') url.searchParams.set(k, String(v)); });
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
  let body: string | undefined;
  if (method !== 'GET') { headers['Content-Type'] = 'application/json'; const token = csrfToken(); if (token) headers['X-CSRF-TOKEN'] = token; body = JSON.stringify(options?.body ?? {}); }
  const res = await fetch(url.toString(), { method, credentials: 'same-origin', headers, body });
  const payload = (await res.json().catch(() => ({}))) as VError;
  if (!res.ok) {
    const err = new Error(payload.message ?? `${res.status} ${res.statusText}`) as Error & { status?: number; payload?: VError };
    err.status = res.status; err.payload = payload; throw err;
  }
  return payload as T;
}
async function loadList(): Promise<void> {
  if (!canRead.value) { facilities.value = []; page.value = null; loading.value = false; return; }
  listLoading.value = true; listError.value = null;
  try {
    const r = await api<{ data: Facility[]; meta: Pagination }>('GET', '/platform/admin/facilities', { query: {
      q: filters.q.trim() || null, status: filters.status || null, facilityType: filters.facilityType.trim() || null,
      ownerUserId: filters.ownerUserId.trim() || null, sortBy: filters.sortBy, sortDir: filters.sortDir, perPage: filters.perPage, page: filters.page,
    } });
    facilities.value = r.data ?? []; page.value = r.meta ?? null;
  } catch (e) { listError.value = messageFromUnknown(e, 'Unable to load facilities.'); facilities.value = []; page.value = null; }
  finally { listLoading.value = false; loading.value = false; }
}
function search(): void { filters.page = 1; void loadList(); }
function resetFilters(): void { Object.assign(filters, { q: '', status: '', facilityType: '', ownerUserId: '', sortBy: 'name', sortDir: 'asc', perPage: 20, page: 1 }); void loadList(); }
function prevPage(): void { if ((page.value?.currentPage ?? 1) <= 1) return; filters.page -= 1; void loadList(); }
function nextPage(): void { if (!page.value || page.value.currentPage >= page.value.lastPage) return; filters.page += 1; void loadList(); }

async function loadDetails(id: string): Promise<void> {
  detailsLoading.value = true; detailsError.value = null;
  try {
    const r = await api<{ data: Facility }>('GET', `/platform/admin/facilities/${id}`);
    selected.value = r.data; hydrate(r.data);
    if (canViewAudit.value) await loadAudit(1);
  } catch (e) { selected.value = null; detailsError.value = messageFromUnknown(e, 'Unable to load facility details.'); }
  finally { detailsLoading.value = false; }
}
function openDetails(f: Facility): void {
  const id = String(f.id ?? '').trim(); if (!id) return;
  detailsOpen.value = true; detailsTab.value = 'config'; detailsError.value = null; selected.value = null;
  configErrors.value = {}; tenantPolicyErrors.value = {}; statusErrors.value = {}; ownerErrors.value = {}; audit.value = []; auditMeta.value = null; auditError.value = null;
  Object.assign(auditFilters, { q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20, page: 1 });
  void loadDetails(id);
}
function closeDetails(): void { detailsOpen.value = false; selected.value = null; }

function resetCreateForm(): void {
  Object.assign(createForm, {
    tenantCode: 'DSK',
    tenantName: 'DSK Dispensary',
    tenantCountryCode: 'TZ',
    tenantAllowedCountryCodes: ['TZ'],
    facilityCode: 'DSK-DISP',
    facilityName: 'DSK Dispensary',
    facilityType: 'dispensary',
    facilityTier: 'primary_care',
    timezone: 'Africa/Dar_es_Salaam',
    facilityAdminUserId: '',
  });
  createErrors.value = {};
}

function openCreate(): void {
  if (!canCreate.value) return;
  resetCreateForm();
  createOpen.value = true;
}

function closeCreate(): void {
  if (createSaving.value) return;
  createOpen.value = false;
  createErrors.value = {};
}

function positiveUserId(value: string): number | null | 'invalid' {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 'invalid';
}

async function createFacility(): Promise<void> {
  if (!canCreate.value || createSaving.value) return;
  createSaving.value = true; createErrors.value = {};
  const adminUserId = positiveUserId(createForm.facilityAdminUserId);
  if (adminUserId === 'invalid') {
    createErrors.value = { facilityAdminUserId: ['Must be a positive user ID.'] };
    createSaving.value = false;
    return;
  }
  try {
    const r = await api<{ data: Facility }>('POST', '/platform/admin/facilities', {
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
        facilityAdminUserId: adminUserId,
      },
    });
    facilities.value = [r.data, ...facilities.value.filter((entry) => entry.id !== r.data.id)];
    notifySuccess('Organization and facility created.');
    createOpen.value = false;
    void loadList();
    openDetails(r.data);
  } catch (e) {
    const er = e as Error & { status?: number; payload?: VError };
    if (er.status === 422 && er.payload?.errors) createErrors.value = er.payload.errors;
    else notifyError(messageFromUnknown(e, 'Unable to create facility.'));
  } finally { createSaving.value = false; }
}

async function saveConfig(): Promise<void> {
  const id = String(selected.value?.id ?? '').trim(); if (!id || !canUpdate.value || configSaving.value) return;
  configSaving.value = true; configErrors.value = {};
  const code = configForm.code.trim(); const name = configForm.name.trim();
  if (!code || !name) { configErrors.value = { ...(code ? {} : { code: ['Code is required.'] }), ...(name ? {} : { name: ['Name is required.'] }) }; configSaving.value = false; return; }
  try {
    const r = await api<{ data: Facility }>('PATCH', `/platform/admin/facilities/${id}`, { body: { code, name, facilityType: configForm.facilityType.trim() || null, timezone: configForm.timezone.trim() || null } });
    selected.value = r.data; hydrate(r.data); syncInQueue(r.data); notifySuccess('Facility configuration updated.');
  } catch (e) { const er = e as Error & { status?: number; payload?: VError }; if (er.status === 422 && er.payload?.errors) configErrors.value = er.payload.errors; else notifyError(messageFromUnknown(e, 'Unable to save configuration.')); }
  finally { configSaving.value = false; }
}

async function saveTenantPolicy(): Promise<void> {
  const id = String(selected.value?.id ?? '').trim(); if (!id || !canUpdate.value || tenantPolicySaving.value) return;
  tenantPolicySaving.value = true; tenantPolicyErrors.value = {};
  try {
    const r = await api<{ data: Facility }>('PATCH', `/platform/admin/facilities/${id}`, {
      body: { tenantAllowedCountryCodes: normalizeCountryCodes(tenantPolicyForm.allowedCountryCodes) },
    });
    selected.value = r.data; hydrate(r.data); syncInQueue(r.data); notifySuccess('Tenant country policy updated.');
  } catch (e) {
    const er = e as Error & { status?: number; payload?: VError };
    if (er.status === 422 && er.payload?.errors) tenantPolicyErrors.value = er.payload.errors;
    else notifyError(messageFromUnknown(e, 'Unable to save tenant country policy.'));
  } finally { tenantPolicySaving.value = false; }
}

async function saveStatus(): Promise<void> {
  const id = String(selected.value?.id ?? '').trim(); if (!id || !canUpdateStatus.value || statusSaving.value) return;
  statusSaving.value = true; statusErrors.value = {}; const reason = statusForm.reason.trim();
  if (statusForm.status === 'inactive' && !reason) { statusErrors.value = { reason: ['Reason is required when status is inactive.'] }; statusSaving.value = false; return; }
  try {
    const r = await api<{ data: Facility }>('PATCH', `/platform/admin/facilities/${id}/status`, { body: { status: statusForm.status, reason: statusForm.status === 'inactive' ? reason : null } });
    selected.value = r.data; hydrate(r.data); syncInQueue(r.data); notifySuccess('Facility status updated.');
  } catch (e) { const er = e as Error & { status?: number; payload?: VError }; if (er.status === 422 && er.payload?.errors) statusErrors.value = er.payload.errors; else notifyError(messageFromUnknown(e, 'Unable to save status.')); }
  finally { statusSaving.value = false; }
}

async function saveOwners(): Promise<void> {
  const id = String(selected.value?.id ?? '').trim(); if (!id || !canManageOwners.value || ownersSaving.value) return;
  ownersSaving.value = true; ownerErrors.value = {};
  const ops = parseUid(ownerForm.operationsOwnerUserId); const cli = parseUid(ownerForm.clinicalOwnerUserId); const adm = parseUid(ownerForm.administrativeOwnerUserId);
  const err: Record<string, string[]> = {};
  if (ops === 'invalid') err.operationsOwnerUserId = ['Must be a positive integer.'];
  if (cli === 'invalid') err.clinicalOwnerUserId = ['Must be a positive integer.'];
  if (adm === 'invalid') err.administrativeOwnerUserId = ['Must be a positive integer.'];
  if (Object.keys(err).length > 0) { ownerErrors.value = err; ownersSaving.value = false; return; }
  try {
    const r = await api<{ data: Facility }>('PATCH', `/platform/admin/facilities/${id}/owners`, { body: { operationsOwnerUserId: ops, clinicalOwnerUserId: cli, administrativeOwnerUserId: adm } });
    selected.value = r.data; hydrate(r.data); syncInQueue(r.data); notifySuccess('Facility owners updated.');
  } catch (e) { const er = e as Error & { status?: number; payload?: VError }; if (er.status === 422 && er.payload?.errors) ownerErrors.value = er.payload.errors; else notifyError(messageFromUnknown(e, 'Unable to save owners.')); }
  finally { ownersSaving.value = false; }
}

async function loadAudit(pageNo = 1): Promise<void> {
  if (!canViewAudit.value) return;
  const id = String(selected.value?.id ?? '').trim(); if (!id) return;
  auditLoading.value = true; auditError.value = null; auditFilters.page = pageNo;
  try {
    const r = await api<{ data: AuditLog[]; meta: Pagination }>('GET', `/platform/admin/facilities/${id}/audit-logs`, { query: {
      q: auditFilters.q.trim() || null, action: auditFilters.action.trim() || null, actorType: auditFilters.actorType || null, actorId: auditFilters.actorId.trim() || null,
      from: toApiDateTime(auditFilters.from), to: toApiDateTime(auditFilters.to), perPage: auditFilters.perPage, page: pageNo,
    } });
    audit.value = r.data ?? []; auditMeta.value = r.meta ?? null;
  } catch (e) { auditError.value = messageFromUnknown(e, 'Unable to load audit logs.'); audit.value = []; auditMeta.value = null; }
  finally { auditLoading.value = false; }
}

async function exportAudit(): Promise<void> {
  if (!canViewAudit.value || auditExporting.value) return;
  const id = String(selected.value?.id ?? '').trim(); if (!id) return;
  auditExporting.value = true;
  try {
    const url = new URL(`/api/v1/platform/admin/facilities/${id}/audit-logs/export`, window.location.origin);
    const q = { q: auditFilters.q.trim() || null, action: auditFilters.action.trim() || null, actorType: auditFilters.actorType || null, actorId: auditFilters.actorId.trim() || null, from: toApiDateTime(auditFilters.from), to: toApiDateTime(auditFilters.to) };
    Object.entries(q).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
    const h: Record<string, string> = { Accept: 'text/csv,application/json', 'X-Requested-With': 'XMLHttpRequest' }; const t = csrfToken(); if (t) h['X-CSRF-TOKEN'] = t;
    const res = await fetch(url.toString(), { method: 'GET', credentials: 'same-origin', headers: h });
    if (!res.ok) { const p = (await res.json().catch(() => ({}))) as VError; throw new Error(p.message ?? `${res.status} ${res.statusText}`); }
    const blob = await res.blob(); const cd = res.headers.get('Content-Disposition') ?? ''; const m = cd.match(/filename="?([^";]+)"?/i); const name = m?.[1] ?? `facility-audit-${id}.csv`;
    const obj = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = obj; a.download = name; document.body.append(a); a.click(); a.remove(); window.URL.revokeObjectURL(obj);
    notifySuccess('Audit CSV prepared.');
  } catch (e) { notifyError(messageFromUnknown(e, 'Unable to export audit CSV.')); }
  finally { auditExporting.value = false; }
}

onMounted(() => { void Promise.all([loadList(), loadCountryProfile()]); });
</script>

<template>
  <Head title="Facility Configuration" />
  <AppLayout :breadcrumbs="breadcrumbs">
    <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex flex-col gap-1">
          <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <AppIcon name="building-2" class="size-7 text-primary" /> Facility Configuration and Ownership
          </h1>
          <p class="text-sm text-muted-foreground">Organizations, hospitals, facility administrators, status, and audit workflows.</p>
        </div>
        <Button v-if="canCreate" class="gap-2" @click="openCreate">
          <AppIcon name="plus" class="size-4" />
          New Facility
        </Button>
      </div>

      <Alert v-if="!permissionsResolved">
        <AlertTitle>Resolving access</AlertTitle>
        <AlertDescription>Loading permission context.</AlertDescription>
      </Alert>
      <Alert v-else-if="!canRead" variant="destructive">
        <AlertTitle>Access denied</AlertTitle>
        <AlertDescription>Missing permission: `platform.facilities.read`.</AlertDescription>
      </Alert>

      <Card v-if="canRead" class="rounded-lg border-sidebar-border/70">
        <CardHeader>
          <CardTitle class="flex items-center gap-2"><AppIcon name="search" class="size-4" /> Facility Queue Filters</CardTitle>
          <CardDescription>Search by text, status, facility type, and owner user ID.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <div class="grid gap-3 md:grid-cols-4">
            <div class="grid gap-1.5 md:col-span-2"><Label>Search</Label><Input v-model="filters.q" placeholder="Code, name, type, timezone" @keyup.enter="search" /></div>
            <div class="grid gap-1.5"><Label>Status</Label><Select v-model="filters.status"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="">All</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
            <div class="grid gap-1.5"><Label>Facility type</Label><Input v-model="filters.facilityType" placeholder="hospital, clinic..." @keyup.enter="search" /></div>
            <div class="grid gap-1.5"><Label>Owner user ID</Label><Input v-model="filters.ownerUserId" inputmode="numeric" placeholder="Any owner slot" @keyup.enter="search" /></div>
            <div class="grid gap-1.5"><Label>Sort by</Label><Select v-model="filters.sortBy"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Name</SelectItem><SelectItem value="code">Code</SelectItem><SelectItem value="facilityType">Facility type</SelectItem><SelectItem value="timezone">Timezone</SelectItem><SelectItem value="status">Status</SelectItem><SelectItem value="updatedAt">Updated</SelectItem></SelectContent></Select></div>
            <div class="grid gap-1.5"><Label>Sort direction</Label><Select v-model="filters.sortDir"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="asc">Ascending</SelectItem><SelectItem value="desc">Descending</SelectItem></SelectContent></Select></div>
            <div class="grid gap-1.5"><Label>Per page</Label><Select :model-value="String(filters.perPage)" @update:model-value="filters.perPage = Number($event)"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div>
          </div>
          <div class="flex flex-wrap justify-end gap-2 border-t pt-3">
            <Button variant="outline" :disabled="listLoading" @click="resetFilters">Reset</Button>
            <Button :disabled="listLoading" @click="search">{{ listLoading ? 'Searching...' : 'Search Queue' }}</Button>
          </div>
        </CardContent>
      </Card>

      <Card v-if="canRead" class="rounded-lg border-sidebar-border/70">
        <CardHeader>
          <CardTitle>Facility Queue</CardTitle>
          <CardDescription>Click `Open` on a facility to manage configuration, status, owners, and audit logs.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <Alert v-if="listError" variant="destructive"><AlertTitle>Queue load issue</AlertTitle><AlertDescription>{{ listError }}</AlertDescription></Alert>
          <div v-else-if="loading || listLoading" class="space-y-2"><Skeleton class="h-12 w-full" /><Skeleton class="h-12 w-full" /><Skeleton class="h-12 w-full" /></div>
          <div v-else-if="facilities.length === 0" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No facilities matched current filters.</div>
          <div v-else class="space-y-2">
            <div v-for="f in facilities" :key="String(f.id)" class="rounded-lg border p-3">
              <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2"><p class="text-sm font-medium">{{ f.code || 'NO-CODE' }} - {{ f.name || 'Unnamed Facility' }}</p><Badge :variant="vStatus(f.status)">{{ formatEnumLabel(f.status) }}</Badge></div>
                  <p class="text-xs text-muted-foreground">Type {{ f.facilityType || 'N/A' }} | Timezone {{ f.timezone || 'N/A' }} | Updated {{ fmt(f.updatedAt) }}</p>
                  <p class="text-xs text-muted-foreground">Ops {{ f.operationsOwnerUserId ?? 'N/A' }} | Clinical {{ f.clinicalOwnerUserId ?? 'N/A' }} | Admin {{ f.administrativeOwnerUserId ?? 'N/A' }}</p>
                </div>
                <Button size="sm" @click="openDetails(f)">Open</Button>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between border-t pt-2">
            <Button variant="outline" size="sm" :disabled="listLoading || (page?.currentPage ?? 1) <= 1" @click="prevPage">Previous</Button>
            <p class="text-xs text-muted-foreground">Page {{ page?.currentPage ?? 1 }} of {{ page?.lastPage ?? 1 }}<span v-if="page"> | {{ page.total }} total</span></p>
            <Button variant="outline" size="sm" :disabled="listLoading || !page || page.currentPage >= page.lastPage" @click="nextPage">Next</Button>
          </div>
        </CardContent>
      </Card>

      <Sheet :open="detailsOpen" @update:open="(o) => (o ? (detailsOpen = true) : closeDetails())">
        <SheetContent side="right" variant="workspace" size="4xl">
          <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
            <SheetTitle>{{ selected?.code || selected?.id || 'Facility Details' }}</SheetTitle>
            <SheetDescription>{{ selected?.name || 'Facility configuration workspace' }}</SheetDescription>
          </SheetHeader>
          <div class="min-h-0 flex-1 overflow-hidden">
            <div v-if="detailsLoading" class="space-y-2 p-4"><Skeleton class="h-14 w-full" /><Skeleton class="h-14 w-full" /></div>
            <Alert v-else-if="detailsError" variant="destructive" class="m-4"><AlertTitle>Details load issue</AlertTitle><AlertDescription>{{ detailsError }}</AlertDescription></Alert>
            <Tabs v-else-if="selected" v-model="detailsTab" class="flex h-full min-h-0 flex-col">
              <div class="border-b px-4 py-2"><TabsList class="w-full justify-start overflow-x-auto"><TabsTrigger value="config">Config</TabsTrigger><TabsTrigger value="tenant-policy">Tenant Policy</TabsTrigger><TabsTrigger value="status">Status</TabsTrigger><TabsTrigger value="owners">Owners</TabsTrigger><TabsTrigger v-if="canViewAudit" value="audit">Audit</TabsTrigger></TabsList></div>
              <ScrollArea class="min-h-0 flex-1"><div class="space-y-4 p-4">
                <TabsContent value="config" class="space-y-3">
                  <div class="grid gap-3 md:grid-cols-2">
                    <div class="grid gap-1.5"><Label>Code</Label><Input v-model="configForm.code" :disabled="!canUpdate" /><p v-if="firstError(configErrors, 'code')" class="text-xs text-destructive">{{ firstError(configErrors, 'code') }}</p></div>
                    <div class="grid gap-1.5"><Label>Name</Label><Input v-model="configForm.name" :disabled="!canUpdate" /><p v-if="firstError(configErrors, 'name')" class="text-xs text-destructive">{{ firstError(configErrors, 'name') }}</p></div>
                    <div class="grid gap-1.5"><Label>Facility type</Label><Input v-model="configForm.facilityType" :disabled="!canUpdate" /></div>
                    <div class="grid gap-1.5"><Label>Timezone</Label><Input v-model="configForm.timezone" :disabled="!canUpdate" /></div>
                  </div>
                  <div class="flex justify-end border-t pt-3"><Button v-if="canUpdate" :disabled="configSaving" @click="saveConfig">{{ configSaving ? 'Saving...' : 'Save Configuration' }}</Button></div>
                </TabsContent>
                <TabsContent value="tenant-policy" class="space-y-3">
                  <div class="rounded-lg border bg-muted/30 p-3 text-sm">
                    <p class="font-medium">Tenant-wide country policy</p>
                    <p class="mt-1 text-muted-foreground">
                      Controls which country profiles are allowed across patient intake and other country-aware workflows for
                      tenant {{ selected?.tenantName || selected?.tenantCode || 'this tenant' }}.
                    </p>
                    <p class="mt-2 text-xs text-muted-foreground">
                      Tenant code {{ selected?.tenantCode || 'N/A' }} | Base country {{ selected?.tenantCountryCode || 'N/A' }}
                    </p>
                  </div>
                  <Alert>
                    <AlertTitle>Policy behavior</AlertTitle>
                    <AlertDescription>
                      Leave all countries unchecked to clear the tenant override and fall back to the global config policy.
                    </AlertDescription>
                  </Alert>
                  <div v-if="tenantCountryOptions.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Country catalog is unavailable right now. Current tenant policy:
                    {{ tenantPolicyForm.allowedCountryCodes.length ? tenantPolicyForm.allowedCountryCodes.join(', ') : 'fallback to global config' }}.
                  </div>
                  <div v-else class="grid gap-3 md:grid-cols-2">
                    <label v-for="option in tenantCountryOptions" :key="option.code" class="flex items-start gap-3 rounded-lg border p-3 text-sm">
                      <input v-model="tenantPolicyForm.allowedCountryCodes" type="checkbox" class="mt-1 h-4 w-4 rounded border-input" :value="option.code" :disabled="!canUpdate || tenantPolicySaving" />
                      <div class="space-y-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="font-medium">{{ option.label }}</span>
                          <Badge v-if="option.code === selected?.tenantCountryCode" variant="outline">Tenant base country</Badge>
                        </div>
                        <p class="text-xs text-muted-foreground">Allow this country profile for tenant-wide intake and country-aware defaults.</p>
                      </div>
                    </label>
                  </div>
                  <p v-if="firstError(tenantPolicyErrors, 'tenantAllowedCountryCodes')" class="text-xs text-destructive">{{ firstError(tenantPolicyErrors, 'tenantAllowedCountryCodes') }}</p>
                  <p v-if="firstError(tenantPolicyErrors, 'tenantAllowedCountryCodes.0')" class="text-xs text-destructive">{{ firstError(tenantPolicyErrors, 'tenantAllowedCountryCodes.0') }}</p>
                  <div class="flex justify-end border-t pt-3"><Button v-if="canUpdate" :disabled="tenantPolicySaving" @click="saveTenantPolicy">{{ tenantPolicySaving ? 'Saving...' : 'Save Tenant Policy' }}</Button></div>
                </TabsContent>
                <TabsContent value="status" class="space-y-3">
                  <div class="grid gap-3 md:grid-cols-2"><div class="grid gap-1.5"><Label>Target status</Label><Select v-model="statusForm.status"><SelectTrigger :disabled="!canUpdateStatus"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div><div class="grid gap-1.5 md:col-span-2"><Label>Reason</Label><Textarea v-model="statusForm.reason" class="min-h-24" :disabled="!canUpdateStatus" /></div></div>
                  <p v-if="firstError(statusErrors, 'reason')" class="text-xs text-destructive">{{ firstError(statusErrors, 'reason') }}</p>
                  <div class="flex justify-end border-t pt-3"><Button v-if="canUpdateStatus" :disabled="statusSaving" @click="saveStatus">{{ statusSaving ? 'Saving...' : 'Save Status' }}</Button></div>
                </TabsContent>
                <TabsContent value="owners" class="space-y-3">
                  <div class="grid gap-3 md:grid-cols-2">
                    <div class="grid gap-1.5"><Label>Operations owner user ID</Label><Input v-model="ownerForm.operationsOwnerUserId" inputmode="numeric" :disabled="!canManageOwners" /><p v-if="firstError(ownerErrors, 'operationsOwnerUserId')" class="text-xs text-destructive">{{ firstError(ownerErrors, 'operationsOwnerUserId') }}</p></div>
                    <div class="grid gap-1.5"><Label>Clinical owner user ID</Label><Input v-model="ownerForm.clinicalOwnerUserId" inputmode="numeric" :disabled="!canManageOwners" /><p v-if="firstError(ownerErrors, 'clinicalOwnerUserId')" class="text-xs text-destructive">{{ firstError(ownerErrors, 'clinicalOwnerUserId') }}</p></div>
                    <div class="grid gap-1.5 md:col-span-2"><Label>Administrative owner user ID</Label><Input v-model="ownerForm.administrativeOwnerUserId" inputmode="numeric" :disabled="!canManageOwners" /><p v-if="firstError(ownerErrors, 'administrativeOwnerUserId')" class="text-xs text-destructive">{{ firstError(ownerErrors, 'administrativeOwnerUserId') }}</p></div>
                  </div>
                  <div class="flex justify-end border-t pt-3"><Button v-if="canManageOwners" :disabled="ownersSaving" @click="saveOwners">{{ ownersSaving ? 'Saving...' : 'Save Owners' }}</Button></div>
                </TabsContent>
                <TabsContent v-if="canViewAudit" value="audit" class="space-y-3">
                  <div class="grid gap-3 md:grid-cols-3">
                    <div class="grid gap-1.5 md:col-span-3"><Label>Search text</Label><Input v-model="auditFilters.q" /></div>
                    <div class="grid gap-1.5"><Label>Action</Label><Input v-model="auditFilters.action" /></div>
                    <div class="grid gap-1.5"><Label>Actor type</Label><Select v-model="auditFilters.actorType"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="">All</SelectItem><SelectItem value="user">User</SelectItem><SelectItem value="system">System</SelectItem></SelectContent></Select></div>
                    <div class="grid gap-1.5"><Label>Actor ID</Label><Input v-model="auditFilters.actorId" /></div>
                    <div class="grid gap-1.5"><Label>From</Label><Input v-model="auditFilters.from" type="datetime-local" /></div>
                    <div class="grid gap-1.5"><Label>To</Label><Input v-model="auditFilters.to" type="datetime-local" /></div>
                  </div>
                  <div class="flex flex-wrap justify-end gap-2 border-t pt-3"><Button variant="outline" size="sm" :disabled="auditLoading" @click="Object.assign(auditFilters, { q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20 }); void loadAudit(1)">Reset</Button><Button size="sm" :disabled="auditLoading" @click="loadAudit(1)">{{ auditLoading ? 'Applying...' : 'Apply Filters' }}</Button><Button variant="outline" size="sm" :disabled="auditExporting" @click="exportAudit">{{ auditExporting ? 'Preparing...' : 'Export CSV' }}</Button></div>
                  <Alert v-if="auditError" variant="destructive"><AlertTitle>Audit load issue</AlertTitle><AlertDescription>{{ auditError }}</AlertDescription></Alert>
                  <div v-else-if="auditLoading" class="space-y-2"><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /></div>
                  <div v-else-if="audit.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No audit logs found.</div>
                  <div v-else class="space-y-2"><div v-for="log in audit" :key="log.id" class="rounded border p-2 text-sm"><p class="font-medium">{{ log.actionLabel || log.action || 'event' }}</p><p class="text-xs text-muted-foreground">{{ fmt(log.createdAt) }} | {{ actorLabel(log) }}</p></div></div>
                  <div class="flex items-center justify-between border-t pt-2"><Button variant="outline" size="sm" :disabled="auditLoading || (auditMeta?.currentPage ?? 1) <= 1" @click="loadAudit((auditMeta?.currentPage ?? 1) - 1)">Previous</Button><p class="text-xs text-muted-foreground">Page {{ auditMeta?.currentPage ?? 1 }} of {{ auditMeta?.lastPage ?? 1 }}</p><Button variant="outline" size="sm" :disabled="auditLoading || !auditMeta || auditMeta.currentPage >= auditMeta.lastPage" @click="loadAudit((auditMeta?.currentPage ?? 1) + 1)">Next</Button></div>
                </TabsContent>
              </div></ScrollArea>
            </Tabs>
          </div>
          <SheetFooter class="border-t px-4 py-3"><Button variant="outline" @click="closeDetails">Close</Button></SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog :open="createOpen" @update:open="(open) => (open ? (createOpen = true) : closeCreate())">
        <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle class="flex items-center gap-2">
              <AppIcon name="building-2" class="size-5 text-primary" />
              New Organization And Facility
            </DialogTitle>
            <DialogDescription>Create the hospital foundation and optionally assign its first facility super admin.</DialogDescription>
          </DialogHeader>

          <div class="grid gap-4">
            <div class="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
              <div class="grid gap-1.5">
                <Label>Organization code</Label>
                <Input v-model="createForm.tenantCode" :disabled="createSaving" />
                <p v-if="firstError(createErrors, 'tenantCode')" class="text-xs text-destructive">{{ firstError(createErrors, 'tenantCode') }}</p>
              </div>
              <div class="grid gap-1.5">
                <Label>Organization name</Label>
                <Input v-model="createForm.tenantName" :disabled="createSaving" />
                <p v-if="firstError(createErrors, 'tenantName')" class="text-xs text-destructive">{{ firstError(createErrors, 'tenantName') }}</p>
              </div>
              <div class="grid gap-1.5">
                <Label>Country</Label>
                <Input v-model="createForm.tenantCountryCode" maxlength="2" :disabled="createSaving" />
                <p v-if="firstError(createErrors, 'tenantCountryCode')" class="text-xs text-destructive">{{ firstError(createErrors, 'tenantCountryCode') }}</p>
              </div>
              <div class="grid gap-1.5">
                <Label>Allowed country profiles</Label>
                <Select
                  :model-value="createForm.tenantAllowedCountryCodes[0] ?? ''"
                  @update:model-value="createForm.tenantAllowedCountryCodes = $event ? [String($event)] : []"
                >
                  <SelectTrigger :disabled="createSaving"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TZ">TZ - Tanzania</SelectItem>
                    <SelectItem value="KE">KE - Kenya</SelectItem>
                    <SelectItem value="UG">UG - Uganda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div class="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
              <div class="grid gap-1.5">
                <Label>Facility code</Label>
                <Input v-model="createForm.facilityCode" :disabled="createSaving" />
                <p v-if="firstError(createErrors, 'facilityCode')" class="text-xs text-destructive">{{ firstError(createErrors, 'facilityCode') }}</p>
              </div>
              <div class="grid gap-1.5">
                <Label>Facility name</Label>
                <Input v-model="createForm.facilityName" :disabled="createSaving" />
                <p v-if="firstError(createErrors, 'facilityName')" class="text-xs text-destructive">{{ firstError(createErrors, 'facilityName') }}</p>
              </div>
              <div class="grid gap-1.5">
                <Label>Facility type</Label>
                <Select v-model="createForm.facilityType">
                  <SelectTrigger :disabled="createSaving"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hospital">Hospital</SelectItem>
                    <SelectItem value="dispensary">Dispensary</SelectItem>
                    <SelectItem value="clinic">Clinic</SelectItem>
                    <SelectItem value="diagnostic_center">Diagnostic center</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="grid gap-1.5">
                <Label>Facility tier</Label>
                <Select v-model="createForm.facilityTier">
                  <SelectTrigger :disabled="createSaving"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary_care">Primary care</SelectItem>
                    <SelectItem value="secondary_care">Secondary care</SelectItem>
                    <SelectItem value="tertiary_care">Tertiary care</SelectItem>
                    <SelectItem value="specialist">Specialist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="grid gap-1.5">
                <Label>Timezone</Label>
                <Input v-model="createForm.timezone" :disabled="createSaving" />
              </div>
              <div class="grid gap-1.5">
                <Label>Facility super admin user ID</Label>
                <Input v-model="createForm.facilityAdminUserId" inputmode="numeric" :disabled="createSaving" />
                <p v-if="firstError(createErrors, 'facilityAdminUserId')" class="text-xs text-destructive">{{ firstError(createErrors, 'facilityAdminUserId') }}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" :disabled="createSaving" @click="closeCreate">Cancel</Button>
            <Button :disabled="createSaving" @click="createFacility">{{ createSaving ? 'Creating...' : 'Create Facility' }}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </AppLayout>
</template>
