<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input, SearchInput } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type Pagination = {
    currentPage: number;
    perPage: number;
    total: number;
    lastPage: number;
};

type PlanEntitlement = {
    id: string;
    key: string;
    label: string;
    group: string | null;
    type: string | null;
    limitValue: number | null;
    enabled: boolean;
};

type EntitlementCatalogItem = PlanEntitlement & {
    enabledPlanIds: string[];
    enabledPlanCount: number;
};

type EntitlementCatalogGroup = {
    group: string;
    items: EntitlementCatalogItem[];
};

type ServicePlan = {
    id: string;
    code: string;
    name: string;
    description: string | null;
    billingCycle: string;
    priceAmount: string | number | null;
    currencyCode: string | null;
    status: string;
    sortOrder: number | null;
    entitlements: PlanEntitlement[];
};

type AuditActor = {
    email?: string | null;
    displayName?: string | null;
};

type AuditChangeRecord = {
    before: unknown;
    after: unknown;
};

type AuditFieldChangeEntry = {
    key: string;
    label: string;
    before: string;
    after: string;
};

type EntitlementAuditState = {
    enabled: boolean | null;
    limitValue: number | null;
};

type EntitlementAuditChangeEntry = {
    key: string;
    label: string;
    beforeEnabled: boolean | null;
    afterEnabled: boolean | null;
    beforeLimitValue: number | null;
    afterLimitValue: number | null;
};

type AuditLog = {
    id: string;
    actorId: number | null;
    actor?: AuditActor | null;
    action: string | null;
    actionLabel?: string | null;
    changes: Record<string, AuditChangeRecord>;
    metadata: Record<string, unknown>;
    createdAt: string | null;
};

type ApiError = { message?: string; errors?: Record<string, string[]> };
type ApiRequestError = Error & { errors?: Record<string, string[]> };
type ListResponse<T> = { data: T[]; meta: Pagination };
type ItemResponse<T> = { data: T };
type PlanDetailsTab = 'configure' | 'entitlements';

const SELECT_ALL_VALUE = '__all__';
const SEARCH_DEBOUNCE_MS = 300;
const subscriptionWorkspaceTabs = ['plans', 'entitlements'] as const;
type SubscriptionWorkspaceTab = (typeof subscriptionWorkspaceTabs)[number];

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Platform Admin', href: '/platform/admin/service-plans' },
    { title: 'Facility Subscription Plans', href: '/platform/admin/service-plans' },
];

const { permissionState } = usePlatformAccess();
const canRead = computed(() => permissionState('platform.subscription-plans.read') === 'allowed');
const canManage = computed(() => permissionState('platform.subscription-plans.manage') === 'allowed');
const canAudit = computed(() => permissionState('platform.subscription-plans.view-audit-logs') === 'allowed');

const loading = ref(true);
const listLoading = ref(false);
const matrixLoading = ref(true);
const plans = ref<ServicePlan[]>([]);
const matrixPlans = ref<ServicePlan[]>([]);
const pagination = ref<Pagination | null>(null);
const errors = ref<string[]>([]);
const matrixError = ref<string | null>(null);
const activeWorkspaceTab = ref<SubscriptionWorkspaceTab>('plans');
const matrixUpdatingKeys = ref<Set<string>>(new Set());
const filters = reactive({
    q: '',
    status: SELECT_ALL_VALUE,
    page: 1,
    perPage: 20,
});

const detailsOpen = ref(false);
const detailsTarget = ref<ServicePlan | null>(null);
const detailsSaving = ref(false);
const detailsWorkspaceTab = ref<PlanDetailsTab>('configure');
const detailsSectionOpen = reactive({
    catalogIdentity: true,
    billingTerms: true,
    entitlements: true,
});
const detailsErrors = ref<Record<string, string[]>>({});
const detailsForm = reactive<{
    name: string;
    description: string;
    billingCycle: string;
    priceAmount: string;
    currencyCode: string;
    status: string;
    entitlements: PlanEntitlement[];
}>({
    name: '',
    description: '',
    billingCycle: 'monthly',
    priceAmount: '',
    currencyCode: 'TZS',
    status: 'active',
    entitlements: [],
});

const auditOpen = ref(false);
const auditTarget = ref<ServicePlan | null>(null);
const auditLoading = ref(false);
const auditLogs = ref<AuditLog[]>([]);
const auditMeta = ref<Pagination | null>(null);
const auditError = ref<string | null>(null);

let searchTimer: number | null = null;

const catalogPlans = computed(() => (matrixPlans.value.length > 0 ? matrixPlans.value : plans.value));
const activePlans = computed(() => catalogPlans.value.filter((plan) => plan.status === 'active').length);
const inactivePlans = computed(() => catalogPlans.value.filter((plan) => plan.status === 'inactive').length);
const enabledEntitlements = computed(() =>
    catalogPlans.value.reduce((total, plan) => total + plan.entitlements.filter((entitlement) => entitlement.enabled).length, 0),
);
const configuredPlans = computed(() =>
    catalogPlans.value.filter((plan) => Number(plan.priceAmount ?? 0) > 0).length,
);
const enabledDetailsEntitlements = computed(() => detailsForm.entitlements.filter((entitlement) => entitlement.enabled).length);
const disabledDetailsEntitlements = computed(() => Math.max(detailsForm.entitlements.length - enabledDetailsEntitlements.value, 0));
const detailsGroupedEntitlements = computed(() => groupEntitlementItems(detailsForm.entitlements));
const detailsEntitlementGroupCount = computed(() => detailsGroupedEntitlements.value.length);
const auditEnabledEntitlements = computed(() => enabledEntitlementCountForPlan(auditTarget.value));
const auditEntitlementGroupCount = computed(() => entitlementGroupCountForPlan(auditTarget.value));
const auditLatestActivity = computed(() => auditLogs.value[0]?.createdAt ?? null);
const auditEventCount = computed(() => auditMeta.value?.total ?? auditLogs.value.length);
const entitlementCatalogGroups = computed<EntitlementCatalogGroup[]>(() => {
    const catalog = new Map<string, EntitlementCatalogItem>();

    catalogPlans.value.forEach((plan) => {
        plan.entitlements.forEach((entitlement) => {
            const existing = catalog.get(entitlement.key) ?? {
                ...entitlement,
                id: entitlement.key,
                enabled: false,
                enabledPlanIds: [],
                enabledPlanCount: 0,
            };

            existing.label = entitlement.label || existing.label;
            existing.group = entitlement.group || existing.group;
            existing.type = entitlement.type || existing.type;

            if (entitlement.enabled && !existing.enabledPlanIds.includes(plan.id)) {
                existing.enabled = true;
                existing.enabledPlanIds.push(plan.id);
                existing.enabledPlanCount = existing.enabledPlanIds.length;
            }

            catalog.set(entitlement.key, existing);
        });
    });

    const groups = new Map<string, EntitlementCatalogItem[]>();
    Array.from(catalog.values()).forEach((entitlement) => {
        const group = entitlement.group?.trim() || 'General';
        groups.set(group, [...(groups.get(group) ?? []), entitlement]);
    });

    return Array.from(groups.entries()).map(([group, items]) => ({
        group,
        items: items.sort((left, right) => left.label.localeCompare(right.label)),
    }));
});
const entitlementCatalogCount = computed(() =>
    entitlementCatalogGroups.value.reduce((total, group) => total + group.items.length, 0),
);
const planMatrixColumns = computed(() =>
    catalogPlans.value.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name || plan.code || 'Unnamed plan',
        status: plan.status,
        enabledEntitlementCount: plan.entitlements.filter((entitlement) => entitlement.enabled).length,
    })),
);

const billingCycleOptions = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'annual', label: 'Annual' },
    { value: 'custom', label: 'Custom' },
];

const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
];

function csrfToken(): string | null {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
}

async function apiRequest<T>(
    method: 'GET' | 'PATCH',
    path: string,
    options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> },
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    let body: string | undefined;
    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        const token = csrfToken();
        if (token) headers['X-CSRF-TOKEN'] = token;
        body = JSON.stringify(options?.body ?? {});
    }

    const response = await fetch(url.toString(), {
        method,
        credentials: 'same-origin',
        headers,
        body,
    });
    const payload = (await response.json().catch(() => ({}))) as ApiError;

    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as ApiRequestError;
        error.errors = payload.errors ?? {};
        throw error;
    }

    return payload as T;
}

function normalizeSubscriptionWorkspaceTab(value: string): SubscriptionWorkspaceTab {
    return subscriptionWorkspaceTabs.includes(value as SubscriptionWorkspaceTab) ? (value as SubscriptionWorkspaceTab) : 'plans';
}

function onWorkspaceTabChange(value: string) {
    activeWorkspaceTab.value = normalizeSubscriptionWorkspaceTab(value);
}

async function loadPlans() {
    if (!canRead.value) {
        plans.value = [];
        pagination.value = null;
        loading.value = false;
        listLoading.value = false;
        return;
    }

    listLoading.value = true;
    errors.value = [];

    try {
        const response = await apiRequest<ListResponse<ServicePlan>>('GET', '/platform/admin/service-plans', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status === SELECT_ALL_VALUE ? null : filters.status,
                page: filters.page,
                perPage: filters.perPage,
            },
        });
        plans.value = response.data ?? [];
        pagination.value = response.meta ?? null;
    } catch (error) {
        plans.value = [];
        pagination.value = null;
        errors.value.push(messageFromUnknown(error, 'Unable to load service plans.'));
    } finally {
        loading.value = false;
        listLoading.value = false;
    }
}

async function loadEntitlementMatrix() {
    if (!canRead.value) {
        matrixPlans.value = [];
        matrixLoading.value = false;
        matrixError.value = null;
        return;
    }

    matrixLoading.value = true;
    matrixError.value = null;

    try {
        const response = await apiRequest<ListResponse<ServicePlan>>('GET', '/platform/admin/service-plans', {
            query: {
                q: null,
                status: null,
                page: 1,
                perPage: 50,
            },
        });
        matrixPlans.value = response.data ?? [];
    } catch (error) {
        matrixPlans.value = [];
        matrixError.value = messageFromUnknown(error, 'Unable to load entitlement matrix.');
    } finally {
        matrixLoading.value = false;
    }
}

async function refreshWorkspace() {
    await Promise.all([loadPlans(), loadEntitlementMatrix()]);
}

function cloneServicePlan(plan: ServicePlan): ServicePlan {
    return {
        ...plan,
        entitlements: plan.entitlements.map((entitlement) => ({ ...entitlement })),
    };
}

function matrixToggleKey(planId: string, entitlementKey: string): string {
    return `${planId}:${entitlementKey}`;
}

function setMatrixCellUpdating(planId: string, entitlementKey: string, updating: boolean) {
    const next = new Set(matrixUpdatingKeys.value);
    const key = matrixToggleKey(planId, entitlementKey);

    if (updating) {
        next.add(key);
    } else {
        next.delete(key);
    }

    matrixUpdatingKeys.value = next;
}

function isMatrixCellUpdating(planId: string, entitlementKey: string): boolean {
    return matrixUpdatingKeys.value.has(matrixToggleKey(planId, entitlementKey));
}

function findPlanForMatrixUpdate(planId: string): ServicePlan | null {
    return matrixPlans.value.find((plan) => plan.id === planId)
        ?? plans.value.find((plan) => plan.id === planId)
        ?? null;
}

function matrixPlanEntitlement(planId: string, entitlementKey: string): PlanEntitlement | null {
    return catalogPlans.value
        .find((plan) => plan.id === planId)
        ?.entitlements.find((entitlement) => entitlement.key === entitlementKey)
        ?? null;
}

function isEntitlementEnabledForPlan(planId: string, entitlementKey: string): boolean {
    return matrixPlanEntitlement(planId, entitlementKey)?.enabled === true;
}

function replacePlanInWorkspace(updatedPlan: ServicePlan) {
    plans.value = plans.value.map((plan) => (plan.id === updatedPlan.id ? cloneServicePlan(updatedPlan) : plan));
    matrixPlans.value = matrixPlans.value.map((plan) => (plan.id === updatedPlan.id ? cloneServicePlan(updatedPlan) : plan));

    if (detailsTarget.value?.id === updatedPlan.id) {
        detailsTarget.value = cloneServicePlan(updatedPlan);
        detailsForm.entitlements = updatedPlan.entitlements.map((entitlement) => ({ ...entitlement }));
    }
}

async function updateMatrixEntitlement(planId: string, entitlementKey: string, enabled: boolean) {
    if (!canManage.value) {
        notifyError('Request platform.subscription-plans.manage permission to change plan entitlements.');
        return;
    }

    const plan = findPlanForMatrixUpdate(planId);
    const targetEntitlement = plan?.entitlements.find((entitlement) => entitlement.key === entitlementKey) ?? null;

    if (!plan || !targetEntitlement) {
        notifyError('Unable to find this entitlement on the selected plan.');
        return;
    }

    if (targetEntitlement.enabled === enabled || isMatrixCellUpdating(planId, entitlementKey)) {
        return;
    }

    const before = cloneServicePlan(plan);
    const nextPlan: ServicePlan = {
        ...cloneServicePlan(plan),
        entitlements: plan.entitlements.map((entitlement) => ({
            ...entitlement,
            enabled: entitlement.key === entitlementKey ? enabled : entitlement.enabled,
        })),
    };

    setMatrixCellUpdating(planId, entitlementKey, true);
    replacePlanInWorkspace(nextPlan);

    try {
        const response = await apiRequest<ItemResponse<ServicePlan>>('PATCH', `/platform/admin/service-plans/${planId}/entitlements/${targetEntitlement.id}`, {
            body: {
                enabled,
                limitValue: targetEntitlement.limitValue,
            },
        });

        replacePlanInWorkspace(response.data);
        notifySuccess(`${enabled ? 'Enabled' : 'Disabled'} ${targetEntitlement.label} for ${plan.name}.`);
    } catch (error) {
        replacePlanInWorkspace(before);
        notifyError(messageFromUnknown(error, 'Unable to update plan entitlement.'));
    } finally {
        setMatrixCellUpdating(planId, entitlementKey, false);
    }
}

function scheduleSearch() {
    if (searchTimer !== null) {
        window.clearTimeout(searchTimer);
    }

    searchTimer = window.setTimeout(() => {
        filters.page = 1;
        void loadPlans();
    }, SEARCH_DEBOUNCE_MS);
}

function applyStatusFilter(value: string) {
    filters.status = value || SELECT_ALL_VALUE;
    filters.page = 1;
    void loadPlans();
}

function resetFilters() {
    filters.q = '';
    filters.status = SELECT_ALL_VALUE;
    filters.page = 1;
    void loadPlans();
}

function openDetails(plan: ServicePlan) {
    detailsTarget.value = plan;
    detailsWorkspaceTab.value = 'configure';
    detailsSectionOpen.catalogIdentity = true;
    detailsSectionOpen.billingTerms = true;
    detailsSectionOpen.entitlements = true;
    detailsForm.name = plan.name ?? '';
    detailsForm.description = plan.description ?? '';
    detailsForm.billingCycle = plan.billingCycle || 'monthly';
    detailsForm.priceAmount = String(plan.priceAmount ?? '');
    detailsForm.currencyCode = (plan.currencyCode ?? 'TZS').toUpperCase();
    detailsForm.status = plan.status || 'active';
    detailsForm.entitlements = plan.entitlements.map((entitlement) => ({ ...entitlement }));
    detailsErrors.value = {};
    detailsOpen.value = true;
}

function closeDetails(open: boolean) {
    detailsOpen.value = open;
    if (!open) {
        detailsTarget.value = null;
        detailsErrors.value = {};
        detailsWorkspaceTab.value = 'configure';
        detailsSectionOpen.catalogIdentity = true;
        detailsSectionOpen.billingTerms = true;
        detailsSectionOpen.entitlements = true;
    }
}

async function saveDetails() {
    const id = detailsTarget.value?.id;
    if (!id || !canManage.value || detailsSaving.value) return;

    detailsSaving.value = true;
    detailsErrors.value = {};

    try {
        const response = await apiRequest<ItemResponse<ServicePlan>>('PATCH', `/platform/admin/service-plans/${id}`, {
            body: {
                name: detailsForm.name.trim(),
                description: detailsForm.description.trim() || null,
                billingCycle: detailsForm.billingCycle,
                priceAmount: detailsForm.priceAmount,
                currencyCode: detailsForm.currencyCode.trim().toUpperCase(),
                status: detailsForm.status,
                entitlements: detailsForm.entitlements.map((entitlement) => ({
                    id: entitlement.id,
                    enabled: entitlement.enabled,
                    limitValue: entitlement.limitValue,
                })),
            },
        });

        notifySuccess(`Updated ${response.data.name}.`);
        closeDetails(false);
        await refreshWorkspace();
    } catch (error) {
        detailsErrors.value = (error as ApiRequestError).errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to update service plan.'));
    } finally {
        detailsSaving.value = false;
    }
}

async function openAudit(plan: ServicePlan) {
    if (!canAudit.value) return;

    auditTarget.value = plan;
    auditOpen.value = true;
    await loadAuditLogs(plan, 1);
}

async function loadAuditLogs(plan: ServicePlan, page = 1) {
    auditLoading.value = true;
    auditError.value = null;
    auditLogs.value = [];
    auditMeta.value = null;

    try {
        const response = await apiRequest<ListResponse<AuditLog>>('GET', `/platform/admin/service-plans/${plan.id}/audit-logs`, {
            query: { page, perPage: 20 },
        });
        auditLogs.value = response.data ?? [];
        auditMeta.value = response.meta ?? null;
    } catch (error) {
        auditError.value = messageFromUnknown(error, 'Unable to load plan audit history.');
    } finally {
        auditLoading.value = false;
    }
}

async function refreshAudit() {
    if (!auditTarget.value || auditLoading.value) return;

    await loadAuditLogs(auditTarget.value, auditMeta.value?.currentPage ?? 1);
}

async function goToAuditPage(page: number) {
    if (!auditTarget.value || auditLoading.value) return;

    await loadAuditLogs(auditTarget.value, Math.max(1, page));
}

function closeAudit(open: boolean) {
    auditOpen.value = open;
    if (!open) {
        auditTarget.value = null;
        auditLogs.value = [];
        auditMeta.value = null;
        auditError.value = null;
    }
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    if (status === 'active') return 'secondary';
    if (status === 'inactive') return 'destructive';
    return 'outline';
}

function formatEnumLabel(value: string | null | undefined): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) return 'Not set';

    return normalized
        .split(/[_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function moneyLabel(amount: string | number | null | undefined, currencyCode: string | null | undefined): string {
    const currency = (currencyCode || 'TZS').toUpperCase();
    const numeric = Number(amount ?? 0);

    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(Number.isFinite(numeric) ? numeric : 0);
    } catch {
        return `${currency} ${Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00'}`;
    }
}

function formatDateTime(value: string | null): string {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function actorLabel(log: AuditLog): string {
    return log.actor?.displayName?.trim() || (log.actorId === null ? 'System' : `User #${log.actorId}`);
}

function actorMetaLabel(log: AuditLog): string {
    return log.actor?.email?.trim() || (log.actorId === null ? 'System action' : 'Authenticated user');
}

function enabledEntitlementCountForPlan(plan: ServicePlan | null): number {
    return plan?.entitlements.filter((entitlement) => entitlement.enabled).length ?? 0;
}

function entitlementGroupCountForPlan(plan: ServicePlan | null): number {
    return groupedEntitlements(plan).length;
}

function groupedEntitlements(plan: ServicePlan | null): Array<{ group: string; items: PlanEntitlement[] }> {
    return groupEntitlementItems(plan?.entitlements ?? []);
}

function groupEntitlementItems(entitlements: PlanEntitlement[] | null | undefined): Array<{ group: string; items: PlanEntitlement[] }> {
    const groups = new Map<string, PlanEntitlement[]>();

    (entitlements ?? []).forEach((entitlement) => {
        const group = entitlement.group?.trim() || 'General';
        groups.set(group, [...(groups.get(group) ?? []), entitlement]);
    });

    return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
}

function setEntitlementEnabled(id: string, checked: boolean) {
    const entitlement = detailsForm.entitlements.find((item) => item.id === id);
    if (!entitlement) return;

    entitlement.enabled = checked;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAuditChangeRecord(value: unknown): value is AuditChangeRecord {
    return isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'before') && Object.prototype.hasOwnProperty.call(value, 'after');
}

function formatAuditFieldLabel(field: string): string {
    if (field === 'price_amount') return 'Facility fee';
    if (field === 'currency_code') return 'Currency';
    if (field === 'billing_cycle') return 'Billing cycle';
    if (field === 'entitlements') return 'Entitlements';

    return formatEnumLabel(field);
}

function formatAuditScalarValue(field: string, value: unknown): string {
    if (value === null || value === undefined || value === '') {
        return 'Empty';
    }

    if (field === 'status' || field === 'billing_cycle') {
        return formatEnumLabel(String(value));
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }

    if (typeof value === 'number') {
        return String(value);
    }

    if (typeof value === 'string') {
        return value.trim() || 'Empty';
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function auditFieldChangeEntries(log: AuditLog): AuditFieldChangeEntry[] {
    return Object.entries(log.changes ?? {}).flatMap(([field, change]) => {
        if (field === 'entitlements' || !isAuditChangeRecord(change)) {
            return [];
        }

        return [
            {
                key: field,
                label: formatAuditFieldLabel(field),
                before: formatAuditScalarValue(field, change.before),
                after: formatAuditScalarValue(field, change.after),
            },
        ];
    });
}

function toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const numeric = Number(value);

    return Number.isFinite(numeric) ? numeric : null;
}

function normalizeEntitlementAuditSnapshot(value: unknown): Record<string, EntitlementAuditState> {
    if (!isRecord(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
            if (!isRecord(item)) {
                return [key, { enabled: null, limitValue: null }];
            }

            return [
                key,
                {
                    enabled: typeof item.enabled === 'boolean' ? item.enabled : null,
                    limitValue: toNullableNumber(item.limit_value),
                },
            ];
        }),
    );
}

function entitlementAuditLabel(key: string): string {
    return auditTarget.value?.entitlements.find((entitlement) => entitlement.key === key)?.label || key;
}

function entitlementAuditChangeEntries(log: AuditLog): EntitlementAuditChangeEntry[] {
    const entitlementChange = log.changes?.entitlements;
    if (!isAuditChangeRecord(entitlementChange)) {
        return [];
    }

    const before = normalizeEntitlementAuditSnapshot(entitlementChange.before);
    const after = normalizeEntitlementAuditSnapshot(entitlementChange.after);
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort((left, right) => left.localeCompare(right));

    return keys.flatMap((key) => {
        const beforeState = before[key] ?? { enabled: null, limitValue: null };
        const afterState = after[key] ?? { enabled: null, limitValue: null };

        if (beforeState.enabled === afterState.enabled && beforeState.limitValue === afterState.limitValue) {
            return [];
        }

        return [
            {
                key,
                label: entitlementAuditLabel(key),
                beforeEnabled: beforeState.enabled,
                afterEnabled: afterState.enabled,
                beforeLimitValue: beforeState.limitValue,
                afterLimitValue: afterState.limitValue,
            },
        ];
    });
}

function entitlementStateLabel(enabled: boolean | null, limitValue: number | null): string {
    const parts = [enabled === true ? 'Enabled' : enabled === false ? 'Disabled' : 'Not set'];

    if (limitValue !== null) {
        parts.push(`Limit ${limitValue}`);
    }

    return parts.join(' | ');
}

function auditChangeChipLabels(log: AuditLog): string[] {
    const scalarLabels = auditFieldChangeEntries(log).map((entry) => entry.label);
    const entitlementChanges = entitlementAuditChangeEntries(log).length;

    if (entitlementChanges > 0) {
        scalarLabels.push(entitlementChanges === 1 ? '1 entitlement update' : `${entitlementChanges} entitlement updates`);
    }

    return scalarLabels;
}

function auditMetadataChips(log: AuditLog): string[] {
    const chips: string[] = [];
    const activeSubscriptions = toNullableNumber(log.metadata?.['active_facility_subscriptions']);
    const entitlementKey = typeof log.metadata?.['entitlement_key'] === 'string' ? log.metadata['entitlement_key'].trim() : '';

    if (activeSubscriptions !== null) {
        chips.push(`${activeSubscriptions} active facilities`);
    }

    if (entitlementKey) {
        chips.push(`Source ${entitlementKey}`);
    }

    return chips;
}

function auditChangeCount(log: AuditLog): number {
    return auditFieldChangeEntries(log).length + entitlementAuditChangeEntries(log).length;
}

function fieldError(field: string): string | null {
    return detailsErrors.value[field]?.[0] ?? null;
}

function nextPage() {
    if (!pagination.value || filters.page >= pagination.value.lastPage) return;
    filters.page += 1;
    void loadPlans();
}

function previousPage() {
    if (filters.page <= 1) return;
    filters.page -= 1;
    void loadPlans();
}

watch(() => filters.q, scheduleSearch);

onMounted(() => {
    void refreshWorkspace();
});

onBeforeUnmount(() => {
    if (searchTimer !== null) {
        window.clearTimeout(searchTimer);
    }
});
</script>

<template>
    <Head title="Facility Subscription Plans" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <AppIcon name="receipt" class="size-5 text-primary" />
                        <h1 class="text-xl font-semibold tracking-normal text-foreground">Facility Subscription Plans</h1>
                    </div>
                    <p class="max-w-3xl text-sm text-muted-foreground">
                        Facility subscription packages, monthly fees, enabled modules, and plan audit history.
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    <Button variant="outline" size="sm" class="h-9 gap-1.5" :disabled="listLoading || matrixLoading" @click="refreshWorkspace">
                        <AppIcon name="refresh-cw" class="size-3.5" />
                        Refresh
                    </Button>
                </div>
            </div>

            <Alert v-if="!canRead" variant="destructive">
                <AlertTitle>Access restricted</AlertTitle>
                <AlertDescription>Request <code>platform.subscription-plans.read</code> permission.</AlertDescription>
            </Alert>

            <template v-else>
                <div class="grid gap-3 md:grid-cols-4">
                    <Card>
                        <CardHeader class="pb-2">
                            <CardDescription>Active Plans</CardDescription>
                            <CardTitle class="text-2xl">{{ activePlans }}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader class="pb-2">
                            <CardDescription>Configured Fees</CardDescription>
                            <CardTitle class="text-2xl">{{ configuredPlans }}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader class="pb-2">
                            <CardDescription>Enabled Entitlements</CardDescription>
                            <CardTitle class="text-2xl">{{ enabledEntitlements }}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader class="pb-2">
                            <CardDescription>Inactive Plans</CardDescription>
                            <CardTitle class="text-2xl">{{ inactivePlans }}</CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                <Tabs :model-value="activeWorkspaceTab" class="flex min-h-0 flex-1 flex-col gap-3" @update:model-value="onWorkspaceTabChange">
                    <TabsList class="w-full justify-start">
                        <TabsTrigger value="plans" class="gap-1.5">
                            <AppIcon name="layout-list" class="size-3.5" />
                            Plans
                        </TabsTrigger>
                        <TabsTrigger value="entitlements" class="gap-1.5">
                            <AppIcon name="layout-grid" class="size-3.5" />
                            Entitlement Matrix
                            <Badge v-if="entitlementCatalogCount > 0" variant="secondary" class="h-4 min-w-4 rounded-full px-1 text-[10px] font-semibold leading-none">
                                {{ entitlementCatalogCount }}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="plans" class="mt-0">
                <Card>
                    <CardHeader class="gap-4">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <CardTitle>Plan Catalog</CardTitle>
                                <CardDescription>Price schedule and package availability for facility subscriptions.</CardDescription>
                            </div>
                            <div class="grid gap-2 sm:grid-cols-[minmax(16rem,1fr)_12rem_auto]">
                                <SearchInput
                                    v-model="filters.q"
                                    placeholder="Search plan, code, or package"
                                    :disabled="listLoading"
                                    class="h-9"
                                />
                                <Select :model-value="filters.status" @update:model-value="(value) => applyStatusFilter(String(value ?? SELECT_ALL_VALUE))">
                                    <SelectTrigger class="h-9 w-full" :disabled="listLoading">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem :value="SELECT_ALL_VALUE">All statuses</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="h-9 gap-1.5"
                                    :disabled="listLoading || (!filters.q && filters.status === SELECT_ALL_VALUE)"
                                    @click="resetFilters"
                                >
                                    <AppIcon name="rotate-ccw" class="size-3.5" />
                                    Reset
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="space-y-3">
                        <Alert v-for="error in errors" :key="error" variant="destructive">
                            <AlertTitle>Unable to load plans</AlertTitle>
                            <AlertDescription>{{ error }}</AlertDescription>
                        </Alert>

                        <div v-if="loading" class="grid gap-3">
                            <Skeleton v-for="index in 4" :key="index" class="h-24 rounded-lg" />
                        </div>

                        <div v-else-if="plans.length === 0" class="rounded-lg border border-dashed p-8 text-center">
                            <AppIcon name="receipt" class="mx-auto mb-3 size-8 text-muted-foreground" />
                            <p class="text-sm font-medium text-foreground">No subscription plans found</p>
                            <p class="mt-1 text-sm text-muted-foreground">Adjust the catalog filters and try again.</p>
                        </div>

                        <div v-else class="grid gap-3">
                            <div
                                v-for="plan in plans"
                                :key="plan.id"
                                class="grid gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(0,1.45fr)_0.7fr_0.55fr_auto]"
                            >
                                <div class="min-w-0 space-y-2">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <h2 class="truncate text-sm font-semibold text-foreground">{{ plan.name }}</h2>
                                        <Badge variant="outline">{{ plan.code }}</Badge>
                                        <Badge :variant="statusVariant(plan.status)">{{ formatEnumLabel(plan.status) }}</Badge>
                                    </div>
                                    <p class="line-clamp-2 text-sm text-muted-foreground">
                                        {{ plan.description || 'No description recorded.' }}
                                    </p>
                                    <div class="flex flex-wrap gap-1.5">
                                        <Badge
                                            v-for="group in groupedEntitlements(plan).slice(0, 4)"
                                            :key="group.group"
                                            variant="secondary"
                                            class="font-normal"
                                        >
                                            {{ group.group }} - {{ group.items.filter((item) => item.enabled).length }}
                                        </Badge>
                                    </div>
                                </div>

                                <div class="space-y-1">
                                    <p class="text-xs text-muted-foreground">Facility Fee</p>
                                    <p class="text-sm font-semibold text-foreground">{{ moneyLabel(plan.priceAmount, plan.currencyCode) }}</p>
                                    <p class="text-xs text-muted-foreground">{{ formatEnumLabel(plan.billingCycle) }}</p>
                                </div>

                                <div class="space-y-1">
                                    <p class="text-xs text-muted-foreground">Entitlements</p>
                                    <p class="text-sm font-semibold text-foreground">
                                        {{ plan.entitlements.filter((entitlement) => entitlement.enabled).length }}
                                    </p>
                                    <p class="text-xs text-muted-foreground">enabled</p>
                                </div>

                                <div class="flex items-center justify-end gap-2">
                                    <Button variant="outline" size="sm" class="h-9 gap-1.5" @click="openDetails(plan)">
                                        <AppIcon :name="canManage ? 'pencil' : 'eye'" class="size-3.5" />
                                        {{ canManage ? 'Configure' : 'View' }}
                                    </Button>
                                    <Button
                                        v-if="canAudit"
                                        variant="ghost"
                                        size="sm"
                                        class="h-9 gap-1.5"
                                        @click="openAudit(plan)"
                                    >
                                        <AppIcon name="clipboard-list" class="size-3.5" />
                                        Audit
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div v-if="pagination && pagination.lastPage > 1" class="flex items-center justify-between border-t pt-3">
                            <p class="text-xs text-muted-foreground">
                                Page {{ pagination.currentPage }} of {{ pagination.lastPage }} - {{ pagination.total }} plans
                            </p>
                            <div class="flex items-center gap-2">
                                <Button variant="outline" size="sm" :disabled="filters.page <= 1 || listLoading" @click="previousPage">
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                </Button>
                                <Button variant="outline" size="sm" :disabled="filters.page >= pagination.lastPage || listLoading" @click="nextPage">
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                    </TabsContent>

                    <TabsContent value="entitlements" class="mt-0">
                        <Card>
                            <CardHeader class="gap-3">
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <CardTitle>Entitlement Matrix</CardTitle>
                                        <CardDescription>
                                            Feature groups mapped across every subscription plan, with direct entitlement switches.
                                        </CardDescription>
                                    </div>
                                    <div class="flex flex-wrap gap-1.5">
                                        <Badge variant="secondary">{{ entitlementCatalogGroups.length }} groups</Badge>
                                        <Badge variant="outline">{{ entitlementCatalogCount }} features</Badge>
                                        <Badge variant="outline">{{ planMatrixColumns.length }} plans</Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent class="space-y-4">
                                <Alert v-if="matrixError" variant="destructive">
                                    <AlertTitle>Unable to load entitlement matrix</AlertTitle>
                                    <AlertDescription>{{ matrixError }}</AlertDescription>
                                </Alert>
                                <Alert v-if="!canManage">
                                    <AlertTitle>Read-only matrix</AlertTitle>
                                    <AlertDescription>Request <code>platform.subscription-plans.manage</code> permission to turn entitlements on or off here.</AlertDescription>
                                </Alert>

                                <div v-if="matrixLoading" class="grid gap-3">
                                    <Skeleton v-for="index in 5" :key="index" class="h-16 rounded-lg" />
                                </div>

                                <div v-else-if="entitlementCatalogGroups.length === 0" class="rounded-lg border border-dashed p-8 text-center">
                                    <AppIcon name="layout-grid" class="mx-auto mb-3 size-8 text-muted-foreground" />
                                    <p class="text-sm font-medium text-foreground">No entitlement catalog found</p>
                                    <p class="mt-1 text-sm text-muted-foreground">Seed subscription entitlements before assigning coverage to plans.</p>
                                </div>

                                <template v-else>
                                    <div class="grid gap-3">
                                        <Collapsible
                                            v-for="(group, groupIndex) in entitlementCatalogGroups"
                                            :key="group.group"
                                            :default-open="groupIndex === 0 || group.group === 'Care Delivery'"
                                            class="rounded-lg border bg-background"
                                        >
                                            <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 [&[data-state=open]>svg]:rotate-90">
                                                <div class="min-w-0">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <p class="truncate text-sm font-semibold text-foreground">{{ group.group }}</p>
                                                        <Badge variant="secondary" class="font-normal">{{ group.items.length }} features</Badge>
                                                        <Badge variant="outline" class="font-normal">
                                                            {{ group.items.reduce((total, item) => total + item.enabledPlanCount, 0) }} plan links
                                                        </Badge>
                                                    </div>
                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                        {{ group.items.filter((item) => item.enabledPlanCount > 0).length }} active features across {{ planMatrixColumns.length }} plans.
                                                    </p>
                                                </div>
                                                <AppIcon name="chevron-right" class="size-4 shrink-0 text-muted-foreground transition-transform" />
                                            </CollapsibleTrigger>

                                            <CollapsibleContent>
                                                <div class="border-t">
                                                    <div class="overflow-x-auto">
                                                        <table class="w-full min-w-[820px] border-collapse text-sm">
                                                            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                                                                <tr>
                                                                    <th class="sticky left-0 z-10 w-[20rem] bg-muted/50 px-3 py-3 font-medium">
                                                                        Feature
                                                                    </th>
                                                                    <th
                                                                        v-for="plan in planMatrixColumns"
                                                                        :key="`header-${group.group}-${plan.id}`"
                                                                        class="min-w-40 px-3 py-3 font-medium"
                                                                    >
                                                                        <div class="space-y-1">
                                                                            <p class="truncate text-foreground">{{ plan.name }}</p>
                                                                            <div class="flex flex-wrap items-center gap-1.5">
                                                                                <Badge variant="outline" class="font-normal">{{ plan.code }}</Badge>
                                                                                <Badge :variant="statusVariant(plan.status)" class="font-normal">
                                                                                    {{ formatEnumLabel(plan.status) }}
                                                                                </Badge>
                                                                            </div>
                                                                            <p class="text-[11px] text-muted-foreground">{{ plan.enabledEntitlementCount }} enabled</p>
                                                                        </div>
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                <tr
                                                                    v-for="entitlement in group.items"
                                                                    :key="entitlement.key"
                                                                    class="border-t bg-background align-top"
                                                                >
                                                                    <td class="sticky left-0 z-10 w-[20rem] bg-background px-3 py-3">
                                                                        <p class="font-medium text-foreground">{{ entitlement.label }}</p>
                                                                        <p class="mt-1 break-all text-xs text-muted-foreground">{{ entitlement.key }}</p>
                                                                    </td>
                                                                    <td
                                                                        v-for="plan in planMatrixColumns"
                                                                        :key="`${entitlement.key}-${plan.id}`"
                                                                        class="px-3 py-3"
                                                                    >
                                                                        <div class="flex items-center gap-2">
                                                                            <Switch
                                                                                :model-value="isEntitlementEnabledForPlan(plan.id, entitlement.key)"
                                                                                :disabled="!canManage || isMatrixCellUpdating(plan.id, entitlement.key) || matrixPlanEntitlement(plan.id, entitlement.key) === null"
                                                                                :aria-label="`${isEntitlementEnabledForPlan(plan.id, entitlement.key) ? 'Disable' : 'Enable'} ${entitlement.label} for ${plan.name}`"
                                                                                @update:model-value="(value) => updateMatrixEntitlement(plan.id, entitlement.key, Boolean(value))"
                                                                            />
                                                                            <Badge
                                                                                :variant="isEntitlementEnabledForPlan(plan.id, entitlement.key) ? 'secondary' : 'outline'"
                                                                                class="gap-1.5 font-normal"
                                                                            >
                                                                                <AppIcon
                                                                                    :name="isEntitlementEnabledForPlan(plan.id, entitlement.key) ? 'check-circle' : 'circle-x'"
                                                                                    class="size-3"
                                                                                />
                                                                                {{
                                                                                    matrixPlanEntitlement(plan.id, entitlement.key) === null
                                                                                        ? 'Missing'
                                                                                        : isMatrixCellUpdating(plan.id, entitlement.key)
                                                                                            ? 'Saving'
                                                                                            : isEntitlementEnabledForPlan(plan.id, entitlement.key)
                                                                                                ? 'On'
                                                                                                : 'Off'
                                                                                }}
                                                                            </Badge>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    </div>
                                </template>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </template>
        </div>

        <Sheet :open="detailsOpen" @update:open="closeDetails">
            <SheetContent side="right" variant="workspace" size="5xl" class="flex h-full min-h-0 flex-col">
                <SheetHeader class="shrink-0 border-b bg-background px-4 py-3 text-left pr-12">
                    <SheetTitle class="flex min-w-0 flex-wrap items-center gap-2">
                        <AppIcon name="receipt" class="size-5 text-muted-foreground" />
                        <span class="min-w-0 truncate">{{ detailsTarget?.name || 'Subscription Plan' }}</span>
                        <Badge v-if="detailsTarget?.code" variant="outline" class="shrink-0 font-normal">{{ detailsTarget.code }}</Badge>
                    </SheetTitle>
                    <SheetDescription>
                        {{
                            detailsTarget
                                ? `${moneyLabel(detailsForm.priceAmount, detailsForm.currencyCode)} | ${formatEnumLabel(detailsForm.billingCycle)} | ${formatEnumLabel(detailsForm.status)}`
                                : 'Plan catalog record'
                        }}
                    </SheetDescription>
                </SheetHeader>

                <form v-if="detailsTarget" class="flex h-full min-h-0 flex-col" @submit.prevent="saveDetails">
                    <Tabs v-model="detailsWorkspaceTab" class="flex h-full min-h-0 flex-col">
                        <div class="shrink-0 border-b bg-muted/5 px-4 py-2.5">
                            <div class="space-y-4">
                                <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                    <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-1.5">
                                        <div class="flex flex-wrap items-start justify-between gap-2">
                                            <div class="min-w-0">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Plan</p>
                                                <p class="mt-0.5 truncate text-sm font-semibold leading-4">
                                                    {{ detailsTarget.name || detailsTarget.code || 'Subscription plan' }}
                                                </p>
                                                <p class="truncate text-xs leading-4 text-muted-foreground">
                                                    {{ detailsTarget.code || 'Code not set' }} | {{ formatEnumLabel(detailsForm.status) }}
                                                </p>
                                            </div>
                                            <Badge :variant="statusVariant(detailsForm.status)" class="shrink-0">
                                                {{ formatEnumLabel(detailsForm.status) }}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-1.5">
                                        <div class="flex items-center justify-between gap-2">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Billing</p>
                                            <Badge variant="outline">{{ formatEnumLabel(detailsForm.billingCycle) }}</Badge>
                                        </div>
                                        <p class="mt-0.5 truncate text-sm font-semibold leading-4">
                                            {{ moneyLabel(detailsForm.priceAmount, detailsForm.currencyCode) }}
                                        </p>
                                        <p class="truncate text-xs leading-4 text-muted-foreground">
                                            Currency {{ detailsForm.currencyCode || 'TZS' }} | Fee charged per facility
                                        </p>
                                    </div>
                                    <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-1.5">
                                        <div class="flex items-center justify-between gap-2">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Entitlements</p>
                                            <Badge variant="secondary">{{ enabledDetailsEntitlements }} enabled</Badge>
                                        </div>
                                        <p class="mt-0.5 truncate text-sm font-semibold leading-4">{{ detailsEntitlementGroupCount }} groups configured</p>
                                        <p class="truncate text-xs leading-4 text-muted-foreground">
                                            {{ disabledDetailsEntitlements }} off | {{ detailsForm.entitlements.length }} total capabilities
                                        </p>
                                    </div>
                                </div>

                                <div class="pb-1">
                                    <TabsList class="flex h-auto w-full flex-wrap justify-start gap-2 rounded-lg bg-transparent p-0">
                                        <TabsTrigger
                                            value="configure"
                                            class="gap-1.5 rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background"
                                        >
                                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                                            Configure
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="entitlements"
                                            class="gap-1.5 rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background"
                                        >
                                            <AppIcon name="shield-check" class="size-3.5" />
                                            Entitlements
                                        </TabsTrigger>
                                    </TabsList>
                                </div>
                            </div>
                        </div>

                        <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                            <div class="grid gap-4 px-6 py-4">
                                <Alert v-if="!canManage">
                                    <AlertTitle>Read-only access</AlertTitle>
                                    <AlertDescription>
                                        Request <code>platform.subscription-plans.manage</code> permission to update plan pricing, status, or entitlements.
                                    </AlertDescription>
                                </Alert>

                                <TabsContent value="configure" class="m-0">
                                    <div class="grid gap-4">
                                        <Collapsible v-model:open="detailsSectionOpen.catalogIdentity" class="rounded-lg border bg-background">
                                            <CollapsibleTrigger class="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 [&[data-state=open]>svg]:rotate-90">
                                                <div class="min-w-0">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <p class="truncate text-sm font-semibold text-foreground">Catalog Identity</p>
                                                        <Badge variant="outline" class="font-normal">{{ detailsTarget.code }}</Badge>
                                                    </div>
                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                        Keep the commercial name, visibility status, and description aligned with the current subscription catalog.
                                                    </p>
                                                </div>
                                                <AppIcon name="chevron-right" class="size-4 shrink-0 text-muted-foreground transition-transform" />
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <div class="grid gap-3 border-t p-3 sm:grid-cols-2">
                                                    <FormFieldShell
                                                        input-id="plan-code"
                                                        label="Plan code"
                                                        helper-text="Stable catalog key used when assigning facilities."
                                                    >
                                                        <Input id="plan-code" :model-value="detailsTarget.code" disabled />
                                                    </FormFieldShell>
                                                    <FormFieldShell
                                                        input-id="plan-status"
                                                        label="Status"
                                                        required
                                                        :error-message="fieldError('status')"
                                                    >
                                                        <Select v-model="detailsForm.status" :disabled="detailsSaving || !canManage">
                                                            <SelectTrigger id="plan-status" class="w-full">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem v-for="option in statusOptions" :key="option.value" :value="option.value">
                                                                    {{ option.label }}
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormFieldShell>
                                                    <FormFieldShell
                                                        input-id="plan-name"
                                                        label="Plan name"
                                                        required
                                                        container-class="sm:col-span-2"
                                                        :error-message="fieldError('name')"
                                                    >
                                                        <Input id="plan-name" v-model="detailsForm.name" :disabled="detailsSaving || !canManage" />
                                                    </FormFieldShell>
                                                    <FormFieldShell
                                                        input-id="plan-description"
                                                        label="Description"
                                                        container-class="sm:col-span-2"
                                                        :error-message="fieldError('description')"
                                                    >
                                                        <Textarea
                                                            id="plan-description"
                                                            v-model="detailsForm.description"
                                                            class="min-h-24"
                                                            :disabled="detailsSaving || !canManage"
                                                        />
                                                    </FormFieldShell>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>

                                        <Collapsible v-model:open="detailsSectionOpen.billingTerms" class="rounded-lg border bg-background">
                                            <CollapsibleTrigger class="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 [&[data-state=open]>svg]:rotate-90">
                                                <div class="min-w-0">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <p class="truncate text-sm font-semibold text-foreground">Billing Terms</p>
                                                        <Badge variant="outline" class="font-normal">{{ formatEnumLabel(detailsForm.billingCycle) }}</Badge>
                                                    </div>
                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                        Define the recurring cycle and fee that facilities inherit when this plan is applied.
                                                    </p>
                                                </div>
                                                <AppIcon name="chevron-right" class="size-4 shrink-0 text-muted-foreground transition-transform" />
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <div class="grid gap-3 border-t p-3 sm:grid-cols-2">
                                                    <FormFieldShell
                                                        input-id="plan-cycle"
                                                        label="Billing cycle"
                                                        required
                                                        :error-message="fieldError('billingCycle')"
                                                    >
                                                        <Select v-model="detailsForm.billingCycle" :disabled="detailsSaving || !canManage">
                                                            <SelectTrigger id="plan-cycle" class="w-full">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem v-for="option in billingCycleOptions" :key="option.value" :value="option.value">
                                                                    {{ option.label }}
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormFieldShell>
                                                    <FormFieldShell
                                                        input-id="plan-currency"
                                                        label="Currency"
                                                        required
                                                        :error-message="fieldError('currencyCode')"
                                                    >
                                                        <Input
                                                            id="plan-currency"
                                                            v-model="detailsForm.currencyCode"
                                                            maxlength="3"
                                                            :disabled="detailsSaving || !canManage"
                                                        />
                                                    </FormFieldShell>
                                                    <FormFieldShell
                                                        input-id="plan-price"
                                                        label="Facility fee"
                                                        container-class="sm:col-span-2"
                                                        :helper-text="`Current display: ${moneyLabel(detailsForm.priceAmount, detailsForm.currencyCode)}`"
                                                        :error-message="fieldError('priceAmount')"
                                                    >
                                                        <Input
                                                            id="plan-price"
                                                            v-model="detailsForm.priceAmount"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            :disabled="detailsSaving || !canManage"
                                                        />
                                                    </FormFieldShell>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    </div>
                                </TabsContent>

                                <TabsContent value="entitlements" class="m-0">
                                    <div class="grid gap-4">
                                        <Collapsible v-model:open="detailsSectionOpen.entitlements" class="rounded-lg border bg-background">
                                            <CollapsibleTrigger class="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 [&[data-state=open]>svg]:rotate-90">
                                                <div class="min-w-0">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <p class="truncate text-sm font-semibold text-foreground">Entitlements</p>
                                                        <Badge variant="secondary" class="font-normal">{{ enabledDetailsEntitlements }} enabled</Badge>
                                                        <Badge variant="outline" class="font-normal">{{ detailsForm.entitlements.length }} total</Badge>
                                                    </div>
                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                        Turn capabilities on or off for every facility subscribed to this package.
                                                    </p>
                                                </div>
                                                <AppIcon name="chevron-right" class="size-4 shrink-0 text-muted-foreground transition-transform" />
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <div class="grid gap-3 border-t p-3">
                                                    <div
                                                        v-if="detailsGroupedEntitlements.length === 0"
                                                        class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
                                                    >
                                                        No entitlements recorded for this package.
                                                    </div>
                                                    <div v-else class="grid gap-3">
                                                        <Collapsible
                                                            v-for="(group, groupIndex) in detailsGroupedEntitlements"
                                                            :key="group.group"
                                                            :default-open="groupIndex === 0 || group.group === 'Care Delivery'"
                                                            class="rounded-lg border bg-muted/10"
                                                        >
                                                            <CollapsibleTrigger class="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40 [&[data-state=open]>svg]:rotate-90">
                                                                <div class="min-w-0">
                                                                    <div class="flex flex-wrap items-center gap-2">
                                                                        <p class="truncate text-sm font-medium text-foreground">{{ group.group }}</p>
                                                                        <Badge variant="outline" class="font-normal">
                                                                            {{ group.items.filter((item) => item.enabled).length }} enabled
                                                                        </Badge>
                                                                    </div>
                                                                    <p class="mt-1 text-xs text-muted-foreground">{{ group.items.length }} capabilities in this group</p>
                                                                </div>
                                                                <AppIcon name="chevron-right" class="size-4 shrink-0 text-muted-foreground transition-transform" />
                                                            </CollapsibleTrigger>
                                                            <CollapsibleContent>
                                                                <div class="grid gap-2 border-t p-3">
                                                                    <div
                                                                        v-for="entitlement in group.items"
                                                                        :key="entitlement.id"
                                                                        class="flex items-start justify-between gap-3 rounded-md border bg-background p-3"
                                                                        :class="{ 'opacity-70': !entitlement.enabled }"
                                                                    >
                                                                        <div class="min-w-0 space-y-1">
                                                                            <div class="flex flex-wrap items-center gap-2">
                                                                                <p class="text-sm font-medium text-foreground">{{ entitlement.label }}</p>
                                                                                <Badge
                                                                                    :variant="entitlement.enabled ? 'secondary' : 'outline'"
                                                                                    class="gap-1.5 font-normal"
                                                                                >
                                                                                    <AppIcon
                                                                                        :name="entitlement.enabled ? 'check-circle' : 'circle-x'"
                                                                                        class="size-3"
                                                                                    />
                                                                                    {{ entitlement.enabled ? 'Enabled' : 'Disabled' }}
                                                                                </Badge>
                                                                            </div>
                                                                            <p class="break-all text-xs text-muted-foreground">{{ entitlement.key }}</p>
                                                                            <p
                                                                                v-if="entitlement.type || entitlement.limitValue !== null"
                                                                                class="text-xs text-muted-foreground"
                                                                            >
                                                                                {{ entitlement.type ? formatEnumLabel(entitlement.type) : 'Capability' }}
                                                                                <span v-if="entitlement.limitValue !== null"> | Limit: {{ entitlement.limitValue }}</span>
                                                                            </p>
                                                                        </div>
                                                                        <Switch
                                                                            :model-value="entitlement.enabled"
                                                                            :disabled="detailsSaving || !canManage"
                                                                            :aria-label="`${entitlement.enabled ? 'Disable' : 'Enable'} ${entitlement.label}`"
                                                                            @update:model-value="(checked) => setEntitlementEnabled(entitlement.id, Boolean(checked))"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </CollapsibleContent>
                                                        </Collapsible>
                                                    </div>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    </div>
                                </TabsContent>
                            </div>
                        </ScrollArea>
                    </Tabs>

                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <Button type="button" variant="outline" :disabled="detailsSaving" @click="closeDetails(false)">Cancel</Button>
                        <Button type="submit" class="gap-1.5" :disabled="detailsSaving || !canManage">
                            <AppIcon name="pencil" class="size-3.5" />
                            {{ detailsSaving ? 'Saving...' : 'Save Plan' }}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>

        <Sheet :open="auditOpen" @update:open="closeAudit">
            <SheetContent side="right" variant="workspace" size="5xl" class="flex h-full min-h-0 flex-col">
                <SheetHeader class="shrink-0 border-b bg-background px-4 py-3 text-left pr-12">
                    <SheetTitle class="flex min-w-0 flex-wrap items-center gap-2">
                        <AppIcon name="clipboard-list" class="size-5 text-muted-foreground" />
                        <span class="min-w-0 truncate">{{ auditTarget?.name || 'Plan Audit' }}</span>
                        <Badge v-if="auditTarget?.code" variant="outline" class="shrink-0 font-normal">{{ auditTarget.code }}</Badge>
                    </SheetTitle>
                    <SheetDescription>
                        {{
                            auditTarget
                                ? `${moneyLabel(auditTarget.priceAmount, auditTarget.currencyCode)} | ${formatEnumLabel(auditTarget.billingCycle)} | ${formatEnumLabel(auditTarget.status)}`
                                : 'Service plan history'
                        }}
                    </SheetDescription>
                </SheetHeader>

                <div class="shrink-0 border-b bg-muted/5 px-4 py-2.5">
                    <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-1.5">
                            <div class="flex flex-wrap items-start justify-between gap-2">
                                <div class="min-w-0">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Plan</p>
                                    <p class="mt-0.5 truncate text-sm font-semibold leading-4">
                                        {{ auditTarget?.name || auditTarget?.code || 'Subscription plan' }}
                                    </p>
                                    <p class="truncate text-xs leading-4 text-muted-foreground">
                                        {{ auditTarget?.code || 'Code not set' }} | {{ formatEnumLabel(auditTarget?.status) }}
                                    </p>
                                </div>
                                <Badge :variant="statusVariant(auditTarget?.status ?? null)" class="shrink-0">
                                    {{ formatEnumLabel(auditTarget?.status) }}
                                </Badge>
                            </div>
                        </div>
                        <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-1.5">
                            <div class="flex items-center justify-between gap-2">
                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Billing</p>
                                <Badge variant="outline">{{ formatEnumLabel(auditTarget?.billingCycle) }}</Badge>
                            </div>
                            <p class="mt-0.5 truncate text-sm font-semibold leading-4">
                                {{ moneyLabel(auditTarget?.priceAmount, auditTarget?.currencyCode) }}
                            </p>
                            <p class="truncate text-xs leading-4 text-muted-foreground">
                                {{ auditEnabledEntitlements }} enabled entitlements | {{ auditEntitlementGroupCount }} groups
                            </p>
                        </div>
                        <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-1.5">
                            <div class="flex items-center justify-between gap-2">
                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Change Feed</p>
                                <Badge :variant="auditError ? 'destructive' : auditLoading ? 'outline' : 'secondary'">
                                    {{ auditLoading ? 'Loading' : `${auditEventCount} events` }}
                                </Badge>
                            </div>
                            <p class="mt-0.5 truncate text-sm font-semibold leading-4">
                                {{
                                    auditLoading
                                        ? 'Loading latest activity...'
                                        : auditLogs.length > 0 && (auditMeta?.currentPage ?? 1) === 1
                                            ? formatDateTime(auditLatestActivity)
                                            : auditMeta
                                                ? `Page ${auditMeta.currentPage} of ${auditMeta.lastPage}`
                                                : 'No events loaded'
                                }}
                            </p>
                            <p class="truncate text-xs leading-4 text-muted-foreground">
                                {{ auditError || 'Review pricing, status, and entitlement changes for this plan.' }}
                            </p>
                        </div>
                    </div>
                </div>

                <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                    <div class="grid gap-4 px-6 py-4">
                        <fieldset class="grid gap-4 rounded-lg border p-3">
                            <legend class="px-2 text-sm font-medium text-muted-foreground">Audit Trail</legend>
                            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Plan change history</p>
                                    <p class="max-w-2xl text-xs text-muted-foreground">
                                        Review pricing, status, and entitlement changes recorded against this subscription package.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="auditLoading || !auditTarget"
                                    @click="refreshAudit"
                                >
                                    <AppIcon name="refresh-cw" class="size-3.5" />
                                    {{ auditLoading ? 'Refreshing...' : 'Refresh' }}
                                </Button>
                            </div>

                            <Alert v-if="auditError" variant="destructive">
                                <AlertTitle>Audit unavailable</AlertTitle>
                                <AlertDescription>{{ auditError }}</AlertDescription>
                            </Alert>

                            <div v-else-if="auditLoading" class="grid gap-3">
                                <Skeleton v-for="index in 4" :key="index" class="h-20 rounded-lg" />
                            </div>

                            <div v-else-if="auditLogs.length === 0" class="rounded-lg border border-dashed p-6 text-center">
                                <AppIcon name="clipboard-list" class="mx-auto mb-3 size-7 text-muted-foreground" />
                                <p class="text-sm font-medium text-foreground">No audit events recorded</p>
                                <p class="mt-1 text-xs text-muted-foreground">Plan changes will appear here as soon as updates are saved.</p>
                            </div>

                            <div v-else class="grid gap-3">
                                <Collapsible
                                    v-for="(log, logIndex) in auditLogs"
                                    :key="log.id"
                                    :default-open="logIndex === 0"
                                    class="rounded-lg border bg-card"
                                >
                                    <CollapsibleTrigger class="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 [&[data-state=open]>svg]:rotate-90">
                                        <div class="min-w-0">
                                            <div class="flex flex-wrap items-center gap-2">
                                                <p class="truncate text-sm font-semibold text-foreground">
                                                    {{ log.actionLabel || formatEnumLabel(log.action) }}
                                                </p>
                                                <Badge variant="outline" class="font-normal">
                                                    {{ auditChangeCount(log) }} {{ auditChangeCount(log) === 1 ? 'change' : 'changes' }}
                                                </Badge>
                                            </div>
                                            <p class="mt-1 text-xs text-muted-foreground">
                                                {{ actorLabel(log) }} | {{ actorMetaLabel(log) }} | {{ formatDateTime(log.createdAt) }}
                                            </p>
                                            <div v-if="auditChangeChipLabels(log).length > 0" class="mt-2 flex flex-wrap gap-1">
                                                <Badge
                                                    v-for="chip in auditChangeChipLabels(log).slice(0, 4)"
                                                    :key="`${log.id}-${chip}`"
                                                    variant="secondary"
                                                    class="font-normal"
                                                >
                                                    {{ chip }}
                                                </Badge>
                                            </div>
                                        </div>
                                        <AppIcon name="chevron-right" class="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div class="grid gap-3 border-t p-3">
                                            <div v-if="auditMetadataChips(log).length > 0" class="flex flex-wrap gap-1.5">
                                                <Badge
                                                    v-for="chip in auditMetadataChips(log)"
                                                    :key="`${log.id}-${chip}`"
                                                    variant="outline"
                                                    class="font-normal"
                                                >
                                                    {{ chip }}
                                                </Badge>
                                            </div>

                                            <div v-if="auditFieldChangeEntries(log).length > 0" class="grid gap-2">
                                                <div class="flex items-center justify-between gap-2">
                                                    <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Field changes</p>
                                                    <Badge variant="outline" class="font-normal">{{ auditFieldChangeEntries(log).length }}</Badge>
                                                </div>
                                                <div
                                                    v-for="entry in auditFieldChangeEntries(log)"
                                                    :key="`${log.id}-${entry.key}`"
                                                    class="rounded-md border bg-muted/20 p-3"
                                                >
                                                    <p class="text-sm font-medium text-foreground">{{ entry.label }}</p>
                                                    <div class="mt-2 grid gap-2 lg:grid-cols-2">
                                                        <div class="rounded-md border bg-background p-2">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Before</p>
                                                            <p class="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                                                                {{ entry.before }}
                                                            </p>
                                                        </div>
                                                        <div class="rounded-md border bg-background p-2">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">After</p>
                                                            <p class="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">
                                                                {{ entry.after }}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div v-if="entitlementAuditChangeEntries(log).length > 0" class="grid gap-2">
                                                <div class="flex items-center justify-between gap-2">
                                                    <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Entitlement changes</p>
                                                    <Badge variant="outline" class="font-normal">{{ entitlementAuditChangeEntries(log).length }}</Badge>
                                                </div>
                                                <div
                                                    v-for="entry in entitlementAuditChangeEntries(log)"
                                                    :key="`${log.id}-${entry.key}`"
                                                    class="rounded-md border bg-muted/20 p-3"
                                                >
                                                    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                        <div class="min-w-0">
                                                            <p class="text-sm font-medium text-foreground">{{ entry.label }}</p>
                                                            <p class="break-all text-xs text-muted-foreground">{{ entry.key }}</p>
                                                        </div>
                                                        <Badge
                                                            :variant="entry.afterEnabled === true ? 'secondary' : entry.afterEnabled === false ? 'outline' : 'destructive'"
                                                            class="font-normal"
                                                        >
                                                            {{ entry.afterEnabled === true ? 'Enabled now' : entry.afterEnabled === false ? 'Disabled now' : 'State cleared' }}
                                                        </Badge>
                                                    </div>
                                                    <div class="mt-2 grid gap-2 lg:grid-cols-2">
                                                        <div class="rounded-md border bg-background p-2">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Before</p>
                                                            <p class="mt-1 text-xs text-muted-foreground">
                                                                {{ entitlementStateLabel(entry.beforeEnabled, entry.beforeLimitValue) }}
                                                            </p>
                                                        </div>
                                                        <div class="rounded-md border bg-background p-2">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">After</p>
                                                            <p class="mt-1 text-xs text-foreground">
                                                                {{ entitlementStateLabel(entry.afterEnabled, entry.afterLimitValue) }}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div
                                                v-if="auditFieldChangeEntries(log).length === 0 && entitlementAuditChangeEntries(log).length === 0"
                                                class="rounded-md border border-dashed p-3 text-xs text-muted-foreground"
                                            >
                                                No structured field deltas were recorded for this event.
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>

                            <div v-if="auditMeta" class="flex items-center justify-between gap-2 border-t pt-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    :disabled="auditLoading || auditMeta.currentPage <= 1"
                                    @click="goToAuditPage(auditMeta.currentPage - 1)"
                                >
                                    Newer
                                </Button>
                                <p class="text-xs text-muted-foreground">
                                    Page {{ auditMeta.currentPage }} of {{ auditMeta.lastPage }} | {{ auditMeta.total }} events
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    :disabled="auditLoading || auditMeta.currentPage >= auditMeta.lastPage"
                                    @click="goToAuditPage(auditMeta.currentPage + 1)"
                                >
                                    Older
                                </Button>
                            </div>
                        </fieldset>
                    </div>
                </ScrollArea>

                <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                    <Button type="button" variant="outline" @click="closeAudit(false)">Close</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    </AppLayout>
</template>
