<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import { apiRequestJson } from '@/lib/apiClient';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

type PlatformUser = {
    id: number | null;
    name: string | null;
    email: string | null;
    status: string | null;
    roles?: Array<{ id: string | null; code: string | null; name: string | null }>;
};
type Facility = {
    id: string | null; code: string | null; name: string | null; facilityType: string | null; timezone: string | null;
    tenantCode: string | null; tenantName: string | null; tenantCountryCode: string | null; tenantAllowedCountryCodes: string[];
    status: 'active' | 'inactive' | null; statusReason: string | null;
    operationsOwnerUserId: number | null; clinicalOwnerUserId: number | null; administrativeOwnerUserId: number | null;
    operationsOwner?: PlatformUser | null; clinicalOwner?: PlatformUser | null; administrativeOwner?: PlatformUser | null;
    updatedAt: string | null;
};
type OwnerSlotKey = 'operationsOwnerUserId' | 'clinicalOwnerUserId' | 'administrativeOwnerUserId';
type OwnerSearchState = {
    query: string;
    candidates: PlatformUser[];
    loading: boolean;
    error: string | null;
    requestId: number;
    timer: number | null;
};
type OwnerSlot = {
    key: OwnerSlotKey;
    label: string;
    description: string;
    icon: string;
    searchPlaceholder: string;
};
type VError = { message?: string; errors?: Record<string, string[]> };

const props = withDefaults(defineProps<{
    facility: Facility | null;
    loading?: boolean;
    saving?: boolean;
}>(), {
    loading: false,
    saving: false,
});

const emit = defineEmits<{
    saved: [facility: Facility];
}>();

const { permissionState } = usePlatformAccess();
const { countryProfileFullCatalog } = usePlatformCountryProfile();

const canUpdate = computed(() => permissionState('platform.facilities.update') === 'allowed');
const canUpdateStatus = computed(() => permissionState('platform.facilities.update-status') === 'allowed');
const canManageOwners = computed(() => permissionState('platform.facilities.manage-owners') === 'allowed');
const canReadUsers = computed(() => permissionState('platform.users.read') === 'allowed');
const canCreate = computed(() => permissionState('platform.facilities.create') === 'allowed');

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

const ownerSlots: OwnerSlot[] = [
    {
        key: 'operationsOwnerUserId',
        label: 'Operations owner',
        description: 'Accountable for front desk, billing handoffs, queues, and daily facility operations.',
        icon: 'clipboard-list',
        searchPlaceholder: 'Search operations lead',
    },
    {
        key: 'clinicalOwnerUserId',
        label: 'Clinical owner',
        description: 'Accountable for clinical governance, care workflows, and service readiness.',
        icon: 'stethoscope',
        searchPlaceholder: 'Search clinical lead',
    },
    {
        key: 'administrativeOwnerUserId',
        label: 'Facility admin',
        description: 'Accountable for local administration, user onboarding, and facility-level controls. Only eligible Facility Administrators are listed.',
        icon: 'shield-check',
        searchPlaceholder: 'Search eligible facility admin',
    },
];

const ownerUsers = reactive<Record<OwnerSlotKey, PlatformUser | null>>({
    operationsOwnerUserId: null,
    clinicalOwnerUserId: null,
    administrativeOwnerUserId: null,
});

const ownerSearchStates = reactive<Record<OwnerSlotKey, OwnerSearchState>>({
    operationsOwnerUserId: { query: '', candidates: [], loading: false, error: null, requestId: 0, timer: null },
    clinicalOwnerUserId: { query: '', candidates: [], loading: false, error: null, requestId: 0, timer: null },
    administrativeOwnerUserId: { query: '', candidates: [], loading: false, error: null, requestId: 0, timer: null },
});

const tenantCountryOptions = computed(() =>
    countryProfileFullCatalog.value
        .map((profile) => {
            const code = String(profile.code ?? '').trim().toUpperCase();
            if (!code) return null;
            return { code, label: `${code} - ${profile.name || ''}` };
        })
        .filter((option): option is { code: string; label: string } => option !== null),
);

function firstError(e: Record<string, string[]> | null | undefined, k: string): string | null {
    return e?.[k]?.[0] ?? null;
}

function vStatus(s: string | null): 'outline' | 'secondary' | 'destructive' {
    if (s === 'active') return 'secondary';
    if (s === 'inactive') return 'destructive';
    return 'outline';
}

function fmt(v: string | null): string {
    if (!v) return 'N/A';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function parseUid(v: string): number | null | 'invalid' {
    const t = v.trim();
    if (!t) return null;
    const n = Number.parseInt(t, 10);
    return Number.isFinite(n) && n > 0 ? n : 'invalid';
}

function normalizeCountryCodes(v: string[]): string[] {
    return Array.from(new Set(v.map((x) => x.trim().toUpperCase()).filter(Boolean)));
}

function setTenantPolicyCountryAllowed(code: string, checked: boolean): void {
    const normalizedCode = code.trim().toUpperCase();
    const nextCodes = checked
        ? [...tenantPolicyForm.allowedCountryCodes, normalizedCode]
        : tenantPolicyForm.allowedCountryCodes.filter((entry) => entry !== normalizedCode);
    const nextSet = new Set(normalizeCountryCodes(nextCodes));
    tenantPolicyForm.allowedCountryCodes = tenantCountryOptions.value.length
        ? tenantCountryOptions.value.filter((option) => nextSet.has(option.code)).map((option) => option.code)
        : Array.from(nextSet);
    tenantPolicyErrors.value = { ...tenantPolicyErrors.value, tenantAllowedCountryCodes: [], 'tenantAllowedCountryCodes.0': [] };
}

function ownerRelationKey(slotKey: OwnerSlotKey): 'operationsOwner' | 'clinicalOwner' | 'administrativeOwner' {
    if (slotKey === 'operationsOwnerUserId') return 'operationsOwner';
    if (slotKey === 'clinicalOwnerUserId') return 'clinicalOwner';
    return 'administrativeOwner';
}

function facilityOwnerUser(facility: Facility, slotKey: OwnerSlotKey): PlatformUser | null {
    return facility[ownerRelationKey(slotKey)] ?? null;
}

function ownerDisplayName(slotKey: OwnerSlotKey): string {
    const user = ownerUsers[slotKey];
    const id = parseUid(ownerForm[slotKey]);
    return user?.name?.trim() || (id ? `User #${id}` : 'Not assigned');
}

function ownerDisplayMeta(slotKey: OwnerSlotKey): string {
    const user = ownerUsers[slotKey];
    const id = parseUid(ownerForm[slotKey]);
    if (user) return `${user.email || 'No email'} | ${userRoleLabel(user)}`;
    if (id) return canReadUsers.value ? 'Profile is loading or unavailable.' : 'User profile hidden by permission.';
    return 'No user selected for this owner slot.';
}

function userRoleLabel(user: PlatformUser): string {
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const roleNames = roles.map((role) => role.name || role.code).filter(Boolean);
    return roleNames.length > 0 ? roleNames.slice(0, 2).join(', ') : 'No role assigned';
}

function ownerId(slotKey: OwnerSlotKey): number | null {
    const parsed = parseUid(ownerForm[slotKey]);
    return parsed === 'invalid' ? null : parsed;
}

function ownerSearchLockedReason(slotKey: OwnerSlotKey): string | null {
    if (!canReadUsers.value) return 'User lookup needs platform.users.read.';
    if (slotKey === 'administrativeOwnerUserId' && !canCreate.value) return 'Facility admin lookup needs platform.facilities.create.';
    return null;
}

function ownerSearchDisabled(slotKey: OwnerSlotKey): boolean {
    return !canManageOwners.value || ownersSaving.value || ownerSearchLockedReason(slotKey) !== null;
}

function resetOwnerSearchState(slotKey: OwnerSlotKey): void {
    const state = ownerSearchStates[slotKey];
    if (state.timer !== null) {
        window.clearTimeout(state.timer);
        state.timer = null;
    }
    state.query = '';
    state.candidates = [];
    state.loading = false;
    state.error = null;
    state.requestId += 1;
}

async function api<T>(method: 'GET' | 'POST' | 'PATCH', path: string, options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> }): Promise<T> {
    const id = String(props.facility?.id ?? '').trim();
    if (!id) throw new Error('No facility selected');
    return apiRequestJson<T>(method, path, options);
}

function syncInQueue(f: Facility): void {
    // Parent will handle queue sync via emit
    emit('saved', f);
}

async function loadOwnerSummaries(): Promise<void> {
    ownerSlots.forEach((slot) => {
        if (!ownerId(slot.key)) ownerUsers[slot.key] = null;
    });
    if (!canReadUsers.value || !props.facility) return;
    await Promise.all(ownerSlots.map(async (slot) => {
        const id = ownerId(slot.key);
        if (!id) return;
        try {
            const response = await api<{ data: PlatformUser }>('GET', `/platform/admin/users/${id}`);
            ownerUsers[slot.key] = response.data ?? null;
        } catch {
            ownerUsers[slot.key] = null;
        }
    }));
}

async function loadOwnerCandidates(slotKey: OwnerSlotKey): Promise<void> {
    const state = ownerSearchStates[slotKey];
    const query = state.query.trim();
    if (!canReadUsers.value) {
        state.candidates = []; state.error = 'Missing permission: platform.users.read.'; state.loading = false;
        return;
    }
    if (slotKey === 'administrativeOwnerUserId' && !canCreate.value) {
        state.candidates = []; state.error = 'Missing permission: platform.facilities.create.'; state.loading = false;
        return;
    }
    if (query.length < 2) {
        state.candidates = []; state.error = null; state.loading = false;
        return;
    }
    state.loading = true;
    state.error = null;
    const requestId = ++state.requestId;
    try {
        const response = slotKey === 'administrativeOwnerUserId'
            ? await api<{ data: PlatformUser[] }>('GET', '/platform/admin/facility-admin-candidates', {
                query: { q: query, limit: 8, tenantCode: props.facility?.tenantCode?.trim().toUpperCase() || null },
            })
            : await api<{ data: PlatformUser[] }>('GET', '/platform/admin/users', {
                query: { q: query, status: 'active', perPage: 8, page: 1, sortBy: 'name', sortDir: 'asc' },
            });
        if (requestId !== state.requestId) return;
        state.candidates = response.data ?? [];
    } catch (e) {
        if (requestId !== state.requestId) return;
        state.candidates = [];
        state.error = messageFromUnknown(e, 'Unable to load owner candidates.');
    } finally {
        if (requestId === state.requestId) state.loading = false;
    }
}

function scheduleOwnerSearch(slotKey: OwnerSlotKey): void {
    const state = ownerSearchStates[slotKey];
    if (state.timer !== null) { window.clearTimeout(state.timer); state.timer = null; }
    if (state.query.trim().length < 2) {
        state.candidates = []; state.error = null; state.loading = false; state.requestId += 1;
        return;
    }
    state.loading = true;
    state.timer = window.setTimeout(() => { void loadOwnerCandidates(slotKey); state.timer = null; }, 300);
}

function selectOwner(slotKey: OwnerSlotKey, user: PlatformUser): void {
    if (user.id === null) return;
    ownerForm[slotKey] = String(user.id);
    ownerUsers[slotKey] = user;
    ownerErrors.value = { ...ownerErrors.value, [slotKey]: [] };
    resetOwnerSearchState(slotKey);
}

function clearOwner(slotKey: OwnerSlotKey): void {
    ownerForm[slotKey] = '';
    ownerUsers[slotKey] = null;
    ownerErrors.value = { ...ownerErrors.value, [slotKey]: [] };
    resetOwnerSearchState(slotKey);
}

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
    ownerSlots.forEach((slot) => {
        ownerUsers[slot.key] = ownerForm[slot.key] ? facilityOwnerUser(f, slot.key) : null;
    });
}

watch(() => props.facility, (f) => {
    if (f) {
        hydrate(f);
        void loadOwnerSummaries();
    }
}, { immediate: true });

async function saveConfig(): Promise<void> {
    const id = String(props.facility?.id ?? '').trim();
    if (!id || !canUpdate.value || configSaving.value) return;
    configSaving.value = true; configErrors.value = {};
    const code = configForm.code.trim(); const name = configForm.name.trim();
    if (!code || !name) {
        configErrors.value = { ...(code ? {} : { code: ['Code is required.'] }), ...(name ? {} : { name: ['Name is required.'] }) };
        configSaving.value = false; return;
    }
    try {
        const r = await api<{ data: Facility }>('PATCH', `/platform/admin/facilities/${id}`, {
            body: { code, name, facilityType: configForm.facilityType.trim() || null, timezone: configForm.timezone.trim() || null },
        });
        syncInQueue(r.data); notifySuccess('Facility configuration updated.');
    } catch (e) {
        const er = e as Error & { status?: number; payload?: VError };
        if (er.status === 422 && er.payload?.errors) configErrors.value = er.payload.errors;
        else notifyError(messageFromUnknown(e, 'Unable to save configuration.'));
    } finally { configSaving.value = false; }
}

async function saveTenantPolicy(): Promise<void> {
    const id = String(props.facility?.id ?? '').trim();
    if (!id || !canUpdate.value || tenantPolicySaving.value) return;
    tenantPolicySaving.value = true; tenantPolicyErrors.value = {};
    try {
        const r = await api<{ data: Facility }>('PATCH', `/platform/admin/facilities/${id}`, {
            body: { tenantAllowedCountryCodes: normalizeCountryCodes(tenantPolicyForm.allowedCountryCodes) },
        });
        syncInQueue(r.data); notifySuccess('Tenant country policy updated.');
    } catch (e) {
        const er = e as Error & { status?: number; payload?: VError };
        if (er.status === 422 && er.payload?.errors) tenantPolicyErrors.value = er.payload.errors;
        else notifyError(messageFromUnknown(e, 'Unable to save tenant country policy.'));
    } finally { tenantPolicySaving.value = false; }
}

async function saveStatus(): Promise<void> {
    const id = String(props.facility?.id ?? '').trim();
    if (!id || !canUpdateStatus.value || statusSaving.value) return;
    statusSaving.value = true; statusErrors.value = {};
    const reason = statusForm.reason.trim();
    if (statusForm.status === 'inactive' && !reason) {
        statusErrors.value = { reason: ['Reason is required when status is inactive.'] };
        statusSaving.value = false; return;
    }
    try {
        const r = await api<{ data: Facility }>('PATCH', `/platform/admin/facilities/${id}/status`, {
            body: { status: statusForm.status, reason: statusForm.status === 'inactive' ? reason : null },
        });
        syncInQueue(r.data); notifySuccess('Facility status updated.');
    } catch (e) {
        const er = e as Error & { status?: number; payload?: VError };
        if (er.status === 422 && er.payload?.errors) statusErrors.value = er.payload.errors;
        else notifyError(messageFromUnknown(e, 'Unable to save status.'));
    } finally { statusSaving.value = false; }
}

async function saveOwners(): Promise<void> {
    const id = String(props.facility?.id ?? '').trim();
    if (!id || !canManageOwners.value || ownersSaving.value) return;
    ownersSaving.value = true; ownerErrors.value = {};
    const ops = parseUid(ownerForm.operationsOwnerUserId);
    const cli = parseUid(ownerForm.clinicalOwnerUserId);
    const adm = parseUid(ownerForm.administrativeOwnerUserId);
    const err: Record<string, string[]> = {};
    if (ops === 'invalid') err.operationsOwnerUserId = ['Must be a positive integer.'];
    if (cli === 'invalid') err.clinicalOwnerUserId = ['Must be a positive integer.'];
    if (adm === 'invalid') err.administrativeOwnerUserId = ['Must be a positive integer.'];
    if (Object.keys(err).length > 0) { ownerErrors.value = err; ownersSaving.value = false; return; }
    try {
        const r = await api<{ data: Facility }>('PATCH', `/platform/admin/facilities/${id}/owners`, {
            body: { operationsOwnerUserId: ops, clinicalOwnerUserId: cli, administrativeOwnerUserId: adm },
        });
        syncInQueue(r.data);
        await loadOwnerSummaries();
        notifySuccess('Facility owners updated.');
    } catch (e) {
        const er = e as Error & { status?: number; payload?: VError };
        if (er.status === 422 && er.payload?.errors) ownerErrors.value = er.payload.errors;
        else notifyError(messageFromUnknown(e, 'Unable to save owners.'));
    } finally { ownersSaving.value = false; }
}
</script>

<template>
    <div v-if="loading" class="space-y-4">
        <Skeleton class="h-24 w-full" />
        <Skeleton class="h-48 w-full" />
        <Skeleton class="h-36 w-full" />
        <Skeleton class="h-72 w-full" />
    </div>
    <div v-else-if="!facility" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Select a facility to view and edit its profile.
    </div>
    <div v-else class="grid gap-4">
        <!-- Facility Identity -->
        <fieldset class="grid gap-3 rounded-lg border p-3">
            <legend class="px-2 text-sm font-medium text-muted-foreground">Facility Identity</legend>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div class="space-y-1">
                    <p class="text-sm font-medium">Core operating profile</p>
                    <p class="max-w-2xl text-xs text-muted-foreground">
                        Keep the facility code, display name, type, and timezone aligned with the real site before clinical testing starts.
                    </p>
                </div>
                <Button v-if="canUpdate" size="sm" class="gap-1.5 shrink-0" :disabled="configSaving" @click="saveConfig">
                    <AppIcon name="circle-check-big" class="size-3.5" />
                    {{ configSaving ? 'Saving...' : 'Save Identity' }}
                </Button>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
                <FormFieldShell input-id="details-facility-code" label="Facility code" required :error-message="firstError(configErrors, 'code')">
                    <Input id="details-facility-code" v-model="configForm.code" :disabled="configSaving" />
                </FormFieldShell>
                <FormFieldShell input-id="details-facility-name" label="Facility name" required :error-message="firstError(configErrors, 'name')">
                    <Input id="details-facility-name" v-model="configForm.name" :disabled="configSaving" />
                </FormFieldShell>
                <FormFieldShell input-id="details-facility-type" label="Facility type">
                    <Input id="details-facility-type" v-model="configForm.facilityType" placeholder="hospital, dispensary, clinic" :disabled="configSaving" />
                </FormFieldShell>
                <FormFieldShell input-id="details-facility-timezone" label="Timezone">
                    <Input id="details-facility-timezone" v-model="configForm.timezone" placeholder="Africa/Dar_es_Salaam" :disabled="configSaving" />
                </FormFieldShell>
            </div>
        </fieldset>

        <!-- Organization Policy -->
        <fieldset class="grid gap-3 rounded-lg border p-3">
            <legend class="px-2 text-sm font-medium text-muted-foreground">Organization Policy</legend>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div class="space-y-1">
                    <p class="text-sm font-medium">{{ facility.tenantName || facility.tenantCode || 'Tenant' }} country profile</p>
                    <p class="max-w-2xl text-xs text-muted-foreground">
                        Controls the country profiles available to intake, identifiers, phone formats, and country-aware defaults for this organization.
                    </p>
                    <p class="text-xs text-muted-foreground">
                        Tenant code {{ facility.tenantCode || 'N/A' }} | Base country {{ facility.tenantCountryCode || 'N/A' }}
                    </p>
                </div>
                <Button v-if="canUpdate" size="sm" class="gap-1.5 shrink-0" :disabled="tenantPolicySaving" @click="saveTenantPolicy">
                    <AppIcon name="shield-check" class="size-3.5" />
                    {{ tenantPolicySaving ? 'Saving...' : 'Save Policy' }}
                </Button>
            </div>
            <Alert>
                <AlertTitle>Policy behavior</AlertTitle>
                <AlertDescription>Leave all countries unchecked to clear the tenant override and fall back to the global config policy.</AlertDescription>
            </Alert>
            <div v-if="tenantCountryOptions.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Country catalog is unavailable right now. Current tenant policy:
                {{ tenantPolicyForm.allowedCountryCodes.length ? tenantPolicyForm.allowedCountryCodes.join(', ') : 'fallback to global config' }}.
            </div>
            <div v-else class="grid gap-3 sm:grid-cols-2">
                <label
                    v-for="option in tenantCountryOptions"
                    :key="option.code"
                    class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/40"
                    :class="{ 'cursor-not-allowed opacity-60': !canUpdate || tenantPolicySaving }"
                >
                    <Checkbox
                        :id="`tenant-policy-country-${option.code}`"
                        :model-value="tenantPolicyForm.allowedCountryCodes.includes(option.code)"
                        class="mt-1"
                        :disabled="!canUpdate || tenantPolicySaving"
                        @update:model-value="(checked) => setTenantPolicyCountryAllowed(option.code, checked === true)"
                    />
                    <span class="space-y-1">
                        <span class="flex flex-wrap items-center gap-2">
                            <span class="font-medium">{{ option.label }}</span>
                            <Badge v-if="option.code === facility.tenantCountryCode" variant="outline">Tenant base country</Badge>
                        </span>
                        <span class="block text-xs text-muted-foreground">Allow this country profile for organization-wide workflows.</span>
                    </span>
                </label>
            </div>
            <p v-if="firstError(tenantPolicyErrors, 'tenantAllowedCountryCodes')" class="text-xs text-destructive">{{ firstError(tenantPolicyErrors, 'tenantAllowedCountryCodes') }}</p>
            <p v-if="firstError(tenantPolicyErrors, 'tenantAllowedCountryCodes.0')" class="text-xs text-destructive">{{ firstError(tenantPolicyErrors, 'tenantAllowedCountryCodes.0') }}</p>
        </fieldset>

        <!-- Status Control -->
        <fieldset class="grid gap-3 rounded-lg border p-3">
            <legend class="px-2 text-sm font-medium text-muted-foreground">Status Control</legend>
            <div class="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <div class="h-full rounded-lg border bg-muted/20 p-3">
                    <p class="text-xs text-muted-foreground">Current status</p>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                        <Badge :variant="vStatus(facility.status)">{{ formatEnumLabel(facility.status) }}</Badge>
                        <span class="text-xs text-muted-foreground">Updated {{ fmt(facility.updatedAt) }}</span>
                    </div>
                    <p v-if="facility.statusReason" class="mt-3 text-xs text-muted-foreground">{{ facility.statusReason }}</p>
                </div>
                <div class="grid h-full gap-3 rounded-lg border bg-background p-3">
                    <FormFieldShell input-id="details-status-target" label="Target status">
                        <Select v-model="statusForm.status">
                            <SelectTrigger id="details-status-target" class="w-full" :disabled="!canUpdateStatus || statusSaving"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                    <FormFieldShell input-id="details-status-reason" label="Reason" :error-message="firstError(statusErrors, 'reason')">
                        <Textarea id="details-status-reason" v-model="statusForm.reason" class="min-h-24" :disabled="!canUpdateStatus || statusSaving" placeholder="Required when inactivating a facility" />
                    </FormFieldShell>
                </div>
            </div>
            <div class="flex justify-end border-t pt-3">
                <Button v-if="canUpdateStatus" size="sm" class="gap-1.5" :disabled="statusSaving" @click="saveStatus">
                    <AppIcon name="circle-check-big" class="size-3.5" />
                    {{ statusSaving ? 'Saving...' : 'Save Status' }}
                </Button>
            </div>
        </fieldset>

        <Separator />

        <!-- Operational Ownership -->
        <fieldset class="grid gap-3 rounded-lg border p-3">
            <legend class="px-2 text-sm font-medium text-muted-foreground">Operational Ownership</legend>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div class="space-y-1">
                    <p class="text-sm font-medium">Named accountable users</p>
                    <p class="max-w-2xl text-xs text-muted-foreground">
                        Assign active users to the operational, clinical, and administrative owner slots. Search starts after two characters.
                    </p>
                </div>
                <Button v-if="canManageOwners" size="sm" class="gap-1.5 shrink-0" :disabled="ownersSaving" @click="saveOwners">
                    <AppIcon name="users" class="size-3.5" />
                    {{ ownersSaving ? 'Saving...' : 'Save Owners' }}
                </Button>
            </div>
            <Alert v-if="!canReadUsers && canManageOwners">
                <AlertTitle>User lookup is restricted</AlertTitle>
                <AlertDescription>Owner selection needs `platform.users.read` so names can be searched instead of entering user IDs.</AlertDescription>
            </Alert>
            <div class="grid gap-3 lg:grid-cols-3">
                <div v-for="slot in ownerSlots" :key="slot.key" class="flex min-h-[18rem] flex-col gap-3 rounded-lg border bg-muted/20 p-3">
                    <div class="flex items-start gap-2">
                        <span class="rounded-md border bg-background p-2 text-muted-foreground">
                            <AppIcon :name="slot.icon" class="size-4" />
                        </span>
                        <span class="min-w-0">
                            <span class="block text-sm font-medium">{{ slot.label }}</span>
                            <span class="block text-xs text-muted-foreground">{{ slot.description }}</span>
                        </span>
                    </div>
                    <div class="rounded-md border bg-background p-3">
                        <div class="flex items-start justify-between gap-2">
                            <div class="min-w-0">
                                <p class="truncate text-sm font-medium">{{ ownerDisplayName(slot.key) }}</p>
                                <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{{ ownerDisplayMeta(slot.key) }}</p>
                            </div>
                            <Button v-if="ownerId(slot.key) && canManageOwners" type="button" size="sm" variant="ghost" class="h-8 shrink-0 px-2" :disabled="ownersSaving" @click="clearOwner(slot.key)">Clear</Button>
                        </div>
                    </div>
                    <div class="grid gap-2">
                        <div class="relative">
                            <Input
                                :id="`owner-search-${slot.key}`"
                                v-model="ownerSearchStates[slot.key].query"
                                :placeholder="slot.searchPlaceholder"
                                class="pr-10"
                                :disabled="ownerSearchDisabled(slot.key)"
                                @input="scheduleOwnerSearch(slot.key)"
                            />
                            <AppIcon v-if="ownerSearchStates[slot.key].loading" name="refresh-cw" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                            <AppIcon v-else name="search" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        </div>
                        <p v-if="firstError(ownerErrors, slot.key)" class="text-xs text-destructive">{{ firstError(ownerErrors, slot.key) }}</p>
                        <p v-else-if="ownerSearchStates[slot.key].error" class="text-xs text-destructive">{{ ownerSearchStates[slot.key].error }}</p>
                        <p v-else-if="ownerSearchLockedReason(slot.key)" class="text-xs text-muted-foreground">{{ ownerSearchLockedReason(slot.key) }}</p>
                    </div>
                    <div class="min-h-0 flex-1 space-y-2">
                        <div v-if="ownerSearchStates[slot.key].loading" class="space-y-2">
                            <Skeleton class="h-11 w-full" />
                            <Skeleton class="h-11 w-full" />
                        </div>
                        <div v-else-if="ownerSearchStates[slot.key].query.trim().length >= 2 && ownerSearchStates[slot.key].candidates.length === 0" class="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
                            No active user matched this search.
                        </div>
                        <div v-else-if="ownerSearchStates[slot.key].query.trim().length < 2" class="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
                            Type at least two characters to search active users.
                        </div>
                        <button
                            v-for="user in ownerSearchStates[slot.key].candidates"
                            :key="`${slot.key}-${user.id}`"
                            type="button"
                            class="flex w-full items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                            :disabled="ownersSaving"
                            @click="selectOwner(slot.key, user)"
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
        </fieldset>
    </div>
</template>