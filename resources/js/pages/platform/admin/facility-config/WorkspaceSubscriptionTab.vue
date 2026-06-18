<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiRequestJson } from '@/lib/apiClient';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

type SubscriptionPlanEntitlement = {
    id: string | null;
    key: string | null;
    label: string | null;
    group: string | null;
    type: string | null;
    limitValue: number | null;
    enabled: boolean;
};

type SubscriptionPlan = {
    id: string;
    code: string | null;
    name: string | null;
    description: string | null;
    billingCycle: string | null;
    priceAmount: string | number | null;
    currencyCode: string | null;
    status: string | null;
    entitlements: SubscriptionPlanEntitlement[];
};

type FacilitySubscription = {
    id: string | null;
    facilityId: string | null;
    planId: string | null;
    plan: SubscriptionPlan | null;
    status: string | null;
    billingCycle: string | null;
    priceAmount: string | number | null;
    currencyCode: string | null;
    trialEndsAt: string | null;
    currentPeriodStartsAt: string | null;
    currentPeriodEndsAt: string | null;
    nextInvoiceAt: string | null;
    gracePeriodEndsAt: string | null;
    suspendedAt: string | null;
    cancellationEffectiveAt: string | null;
    statusReason: string | null;
    entitlementKeys: string[];
    accessEnabled: boolean;
    accessState: string | null;
    updatedAt: string | null;
};

type VError = { message?: string; errors?: Record<string, string[]> };

type Facility = {
    id: string | null;
    tenantName?: string | null;
    tenantCode?: string | null;
    name?: string | null;
    code?: string | null;
};

type SubscriptionDateTimeField = 'trialEndsAt' | 'currentPeriodStartsAt' | 'currentPeriodEndsAt' | 'nextInvoiceAt' | 'gracePeriodEndsAt';
type SubscriptionVisibilityTone = 'outline' | 'secondary' | 'destructive';

const props = withDefaults(defineProps<{
    facility: Facility | null;
    loading?: boolean;
}>(), {
    loading: false,
});

const emit = defineEmits<{
    saved: [];
}>();

const canManageSubscriptions = computed(() => true); // Will be passed from parent

const subscriptionPlans = ref<SubscriptionPlan[]>([]);
const subscription = ref<FacilitySubscription | null>(null);
const subscriptionLoading = ref(false);
const subscriptionSaving = ref(false);
const subscriptionError = ref<string | null>(null);
const subscriptionErrors = ref<Record<string, string[]>>({});
const subscriptionForm = reactive({
    planId: '',
    status: 'trial',
    billingCycle: 'monthly',
    priceAmount: '',
    currencyCode: 'TZS',
    trialEndsAt: '',
    currentPeriodStartsAt: '',
    currentPeriodEndsAt: '',
    nextInvoiceAt: '',
    gracePeriodEndsAt: '',
    statusReason: '',
});

const subscriptionAccessOpenStatuses = ['trial', 'active', 'grace_period'];

const subscriptionStatusOptions = [
    { value: 'trial', label: 'Trial' },
    { value: 'active', label: 'Active' },
    { value: 'past_due', label: 'Past due' },
    { value: 'grace_period', label: 'Grace period' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'cancelled', label: 'Cancelled' },
];

const selectedSubscriptionPlan = computed(() =>
    subscriptionPlans.value.find((plan) => plan.id === subscriptionForm.planId)
        ?? subscription.value?.plan
        ?? null,
);

const selectedSubscriptionEntitlementKeys = computed(() =>
    new Set(
        (selectedSubscriptionPlan.value?.entitlements ?? [])
            .filter((entitlement) => entitlement.enabled && entitlement.key)
            .map((entitlement) => String(entitlement.key)),
    ),
);

const allSubscriptionEntitlements = computed(() => {
    const entitlements = new Map<string, SubscriptionPlanEntitlement>();
    subscriptionPlans.value.forEach((plan) => {
        plan.entitlements
            .filter((entitlement) => entitlement.enabled && entitlement.key)
            .forEach((entitlement) => {
                const key = String(entitlement.key);
                if (!entitlements.has(key)) {
                    entitlements.set(key, entitlement);
                }
            });
    });
    return Array.from(entitlements.values()).sort((a, b) =>
        String(a.group ?? '').localeCompare(String(b.group ?? ''))
            || String(a.label ?? a.key ?? '').localeCompare(String(b.label ?? b.key ?? '')),
    );
});

const enabledAccessEntitlements = computed(() =>
    (selectedSubscriptionPlan.value?.entitlements ?? []).filter((entitlement) => entitlement.enabled),
);

const restrictedAccessEntitlements = computed(() =>
    allSubscriptionEntitlements.value.filter((entitlement) =>
        entitlement.key ? !selectedSubscriptionEntitlementKeys.value.has(String(entitlement.key)) : false,
    ),
);

const subscriptionCoveragePercent = computed(() => {
    const total = allSubscriptionEntitlements.value.length;
    if (total === 0) return 0;
    return Math.round((enabledAccessEntitlements.value.length / total) * 100);
});

const subscriptionAccessSummary = computed(() => {
    if (!subscriptionForm.planId) {
        return {
            label: 'Not configured',
            tone: 'outline' as SubscriptionVisibilityTone,
            description: 'Assign a service plan before live facility testing.',
        };
    }
    if (subscriptionDraftAccessEnabled.value) {
        return {
            label: 'Access enabled',
            tone: 'secondary' as SubscriptionVisibilityTone,
            description: 'Allowed modules will be open for this facility after saving.',
        };
    }
    return {
        label: formatEnumLabel(subscriptionDraftAccessState.value),
        tone: (['expired', 'restricted'].includes(subscriptionDraftAccessState.value) ? 'destructive' : 'outline') as SubscriptionVisibilityTone,
        description: subscriptionDraftAccessState.value === 'expired'
            ? 'The selected access period has expired.'
            : 'Subscription state is restricting service access.',
    };
});

function isPastDateTimeInput(value: string): boolean {
    const apiValue = toApiDateTime(value);
    if (!apiValue) return false;
    const date = new Date(apiValue);
    return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function toApiDateTime(v: string): string | null {
    const t = v.trim();
    if (!t) return null;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function daysUntil(value: string | null | undefined): number | null {
    if (!value) return null;
    const target = new Date(value);
    if (Number.isNaN(target.getTime())) return null;
    const today = new Date();
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil((target.getTime() - today.getTime()) / millisecondsPerDay);
}

function dateDistanceLabel(value: string | null | undefined): string {
    const days = daysUntil(value);
    if (days === null) return 'not set';
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days > 1) return `in ${days} days`;
    if (days === -1) return 'yesterday';
    return `${Math.abs(days)} days ago`;
}

function subscriptionStatusVariant(s: string | null): 'outline' | 'secondary' | 'destructive' {
    if (s === 'active' || s === 'trial' || s === 'grace_period') return 'secondary';
    if (s === 'past_due' || s === 'suspended' || s === 'cancelled') return 'destructive';
    return 'outline';
}

function fmt(v: string | null): string {
    if (!v) return 'N/A';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function moneyLabel(amount: string | number | null | undefined, currencyCode: string | null | undefined): string {
    if (amount === null || amount === undefined || amount === '') return 'Fee not set';
    const numeric = Number(amount);
    const currency = (currencyCode || 'TZS').toUpperCase();
    if (!Number.isFinite(numeric)) return `${currency} ${amount}`;
    try {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(numeric);
    } catch {
        return `${currency} ${numeric.toFixed(2)}`;
    }
}

function splitSubscriptionDateTime(value: string): { date: string; time: string } {
    const normalized = value.trim().replace(' ', 'T');
    const [date = '', rawTime = ''] = normalized.split('T');
    const time = rawTime.match(/^(\d{2}):(\d{2})/)?.[0] ?? '';
    return {
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
        time,
    };
}

function defaultSubscriptionTime(field: SubscriptionDateTimeField): string {
    if (field === 'nextInvoiceAt') return '08:00';
    if (field === 'currentPeriodStartsAt') return '00:00';
    return '23:59';
}

function subscriptionDatePart(field: SubscriptionDateTimeField): string {
    return splitSubscriptionDateTime(subscriptionForm[field]).date;
}

function subscriptionTimePart(field: SubscriptionDateTimeField): string {
    return splitSubscriptionDateTime(subscriptionForm[field]).time;
}

function updateSubscriptionDatePart(field: SubscriptionDateTimeField, value: string): void {
    const date = value.trim();
    if (!date) {
        subscriptionForm[field] = '';
        return;
    }
    const time = subscriptionTimePart(field) || defaultSubscriptionTime(field);
    subscriptionForm[field] = `${date}T${time}`;
}

function updateSubscriptionTimePart(field: SubscriptionDateTimeField, value: string): void {
    const date = subscriptionDatePart(field);
    if (!date) return;
    const time = value.trim() || defaultSubscriptionTime(field);
    subscriptionForm[field] = `${date}T${time}`;
}

function firstError(e: Record<string, string[]> | null | undefined, k: string): string | null {
    return e?.[k]?.[0] ?? null;
}

function toDateTimeInputValue(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (part: number): string => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const subscriptionDraftExpired = computed(() => {
    if (subscriptionForm.status === 'trial') return isPastDateTimeInput(subscriptionForm.trialEndsAt);
    if (subscriptionForm.status === 'grace_period') return isPastDateTimeInput(subscriptionForm.gracePeriodEndsAt);
    if (subscriptionForm.status === 'active') return isPastDateTimeInput(subscriptionForm.currentPeriodEndsAt);
    return false;
});

const subscriptionDraftAccessEnabled = computed(() =>
    Boolean(subscriptionForm.planId)
        && subscriptionAccessOpenStatuses.includes(subscriptionForm.status)
        && !subscriptionDraftExpired.value,
);

const subscriptionDraftAccessState = computed(() => {
    if (!subscriptionForm.planId) return 'not_configured';
    if (subscriptionDraftAccessEnabled.value) return 'enabled';
    if (subscriptionDraftExpired.value && subscriptionAccessOpenStatuses.includes(subscriptionForm.status)) return 'expired';
    if (['past_due', 'suspended', 'cancelled'].includes(subscriptionForm.status)) return 'restricted';
    return 'pending';
});

const subscriptionRenewalRisk = computed(() => {
    const status = subscriptionForm.status;
    if (!subscriptionForm.planId) {
        return { label: 'No plan', tone: 'outline' as SubscriptionVisibilityTone, description: 'Plan assignment is required.' };
    }
    if (['past_due', 'suspended', 'cancelled'].includes(status)) {
        return { label: formatEnumLabel(status), tone: 'destructive' as SubscriptionVisibilityTone, description: 'Access is restricted or requires billing action.' };
    }
    const graceDays = daysUntil(subscriptionForm.gracePeriodEndsAt);
    if (status === 'grace_period') {
        return { label: graceDays !== null && graceDays >= 0 ? `Grace ${dateDistanceLabel(subscriptionForm.gracePeriodEndsAt)}` : 'Grace expired', tone: (graceDays !== null && graceDays >= 0 ? 'outline' : 'destructive') as SubscriptionVisibilityTone, description: 'Resolve payment before grace ends.' };
    }
    const periodDays = daysUntil(subscriptionForm.currentPeriodEndsAt);
    if (periodDays !== null && periodDays < 0) {
        return { label: 'Period expired', tone: 'destructive' as SubscriptionVisibilityTone, description: 'Renewal is overdue.' };
    }
    if (periodDays !== null && periodDays <= 7) {
        return { label: `Renews ${dateDistanceLabel(subscriptionForm.currentPeriodEndsAt)}`, tone: 'outline' as SubscriptionVisibilityTone, description: 'Renewal is near.' };
    }
    const trialDays = daysUntil(subscriptionForm.trialEndsAt);
    if (status === 'trial' && trialDays !== null && trialDays <= 7) {
        return { label: `Trial ${dateDistanceLabel(subscriptionForm.trialEndsAt)}`, tone: 'outline' as SubscriptionVisibilityTone, description: 'Trial conversion should be prepared.' };
    }
    return { label: 'Healthy', tone: 'secondary' as SubscriptionVisibilityTone, description: 'No immediate subscription risk.' };
});

const subscriptionTimeline = computed(() => [
    { label: 'Trial ends', value: subscriptionForm.trialEndsAt },
    { label: 'Period starts', value: subscriptionForm.currentPeriodStartsAt },
    { label: 'Period ends', value: subscriptionForm.currentPeriodEndsAt },
    { label: 'Next invoice', value: subscriptionForm.nextInvoiceAt },
    { label: 'Grace ends', value: subscriptionForm.gracePeriodEndsAt },
]);

const subscriptionSaveDisabled = computed(() =>
    subscriptionSaving.value || subscriptionLoading.value || subscriptionPlans.value.length === 0,
);

async function api<T>(method: 'GET' | 'POST' | 'PATCH', path: string, options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> }): Promise<T> {
    return apiRequestJson<T>(method, path, options);
}

function hydrateSubscription(nextSubscription: FacilitySubscription): void {
    subscription.value = nextSubscription;
    const fallbackPlan = nextSubscription.plan ?? subscriptionPlans.value[0] ?? null;
    const isConfigured = nextSubscription.status !== 'not_configured';
    subscriptionForm.planId = nextSubscription.planId ?? fallbackPlan?.id ?? '';
    subscriptionForm.status = isConfigured ? (nextSubscription.status ?? 'trial') : 'trial';
    subscriptionForm.billingCycle = fallbackPlan?.billingCycle ?? nextSubscription.billingCycle ?? 'monthly';
    subscriptionForm.priceAmount = String(fallbackPlan?.priceAmount ?? nextSubscription.priceAmount ?? '');
    subscriptionForm.currencyCode = (fallbackPlan?.currencyCode ?? nextSubscription.currencyCode ?? 'TZS').toUpperCase();
    subscriptionForm.trialEndsAt = toDateTimeInputValue(nextSubscription.trialEndsAt);
    subscriptionForm.currentPeriodStartsAt = toDateTimeInputValue(nextSubscription.currentPeriodStartsAt);
    subscriptionForm.currentPeriodEndsAt = toDateTimeInputValue(nextSubscription.currentPeriodEndsAt);
    subscriptionForm.nextInvoiceAt = toDateTimeInputValue(nextSubscription.nextInvoiceAt);
    subscriptionForm.gracePeriodEndsAt = toDateTimeInputValue(nextSubscription.gracePeriodEndsAt);
    subscriptionForm.statusReason = nextSubscription.statusReason ?? '';
}

function applySubscriptionPlanDefaults(planId: string): void {
    subscriptionForm.planId = planId;
    const plan = subscriptionPlans.value.find((entry) => entry.id === planId);
    if (!plan) return;
    subscriptionForm.billingCycle = plan.billingCycle ?? 'monthly';
    subscriptionForm.currencyCode = (plan.currencyCode ?? 'TZS').toUpperCase();
    subscriptionForm.priceAmount = String(plan.priceAmount ?? '');
    subscriptionErrors.value = { ...subscriptionErrors.value, planId: [] };
}

async function loadSubscriptionWorkspace(id: string): Promise<void> {
    subscriptionLoading.value = true;
    subscriptionError.value = null;
    subscriptionErrors.value = {};
    try {
        const [plansResponse, subscriptionResponse] = await Promise.all([
            subscriptionPlans.value.length > 0
                ? Promise.resolve({ data: subscriptionPlans.value })
                : api<{ data: SubscriptionPlan[] }>('GET', '/platform/admin/facility-subscription-plans'),
            api<{ data: FacilitySubscription }>('GET', `/platform/admin/facilities/${id}/subscription`),
        ]);
        subscriptionPlans.value = plansResponse.data ?? [];
        hydrateSubscription(subscriptionResponse.data);
    } catch (e) {
        subscription.value = null;
        subscriptionError.value = messageFromUnknown(e, 'Unable to load facility subscription.');
    } finally {
        subscriptionLoading.value = false;
    }
}

async function saveSubscription(): Promise<void> {
    const id = String(props.facility?.id ?? '').trim();
    if (!id || !canManageSubscriptions.value || subscriptionSaving.value) return;
    subscriptionSaving.value = true;
    subscriptionErrors.value = {};
    const reason = subscriptionForm.statusReason.trim();
    const errors: Record<string, string[]> = {};
    if (!subscriptionForm.planId) errors.planId = ['Select a service plan.'];
    if (['past_due', 'suspended', 'cancelled'].includes(subscriptionForm.status) && !reason) {
        errors.statusReason = ['Reason is required for restricted subscription states.'];
    }
    if (Object.keys(errors).length > 0) {
        subscriptionErrors.value = errors;
        subscriptionSaving.value = false;
        return;
    }
    try {
        await api<{ data: FacilitySubscription }>('PATCH', `/platform/admin/facilities/${id}/subscription`, {
            body: {
                planId: subscriptionForm.planId,
                status: subscriptionForm.status,
                trialEndsAt: toApiDateTime(subscriptionForm.trialEndsAt),
                currentPeriodStartsAt: toApiDateTime(subscriptionForm.currentPeriodStartsAt),
                currentPeriodEndsAt: toApiDateTime(subscriptionForm.currentPeriodEndsAt),
                nextInvoiceAt: toApiDateTime(subscriptionForm.nextInvoiceAt),
                gracePeriodEndsAt: toApiDateTime(subscriptionForm.gracePeriodEndsAt),
                statusReason: reason || null,
            },
        });
        notifySuccess('Facility subscription updated.');
        emit('saved');
    } catch (e) {
        const error = e as Error & { status?: number; payload?: VError };
        if (error.status === 422 && error.payload?.errors) subscriptionErrors.value = error.payload.errors;
        else notifyError(messageFromUnknown(e, 'Unable to save facility subscription.'));
    } finally {
        subscriptionSaving.value = false;
    }
}

watch(() => props.facility, (f) => {
    if (f?.id) {
        void loadSubscriptionWorkspace(String(f.id));
    }
}, { immediate: true });
</script>

<template>
    <div v-if="loading" class="grid gap-4">
        <Skeleton class="h-48 w-full" />
        <Skeleton class="h-96 w-full" />
    </div>
    <div v-else-if="!facility" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Select a facility to view and manage its subscription.
    </div>
    <div v-else class="grid gap-4">
        <fieldset class="grid gap-3 rounded-lg border p-3">
            <legend class="px-2 text-sm font-medium text-muted-foreground">Subscription and Service Access</legend>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div class="space-y-1">
                    <p class="text-sm font-medium">{{ selectedSubscriptionPlan?.name || 'No service plan selected' }}</p>
                    <div class="flex flex-wrap items-center gap-1.5">
                        <Badge :variant="subscriptionStatusVariant(subscriptionForm.planId ? subscriptionForm.status : 'not_configured')">
                            {{ formatEnumLabel(subscriptionForm.planId ? subscriptionForm.status : 'not_configured') }}
                        </Badge>
                        <Badge :variant="subscriptionDraftAccessEnabled ? 'secondary' : 'outline'">
                            {{ subscriptionDraftAccessEnabled ? 'Access enabled' : formatEnumLabel(subscriptionDraftAccessState) }}
                        </Badge>
                        <Badge variant="outline">{{ moneyLabel(subscriptionForm.priceAmount, subscriptionForm.currencyCode) }}</Badge>
                    </div>
                </div>
            </div>

            <Alert v-if="subscriptionError" variant="destructive">
                <AlertTitle>Subscription load issue</AlertTitle>
                <AlertDescription>{{ subscriptionError }}</AlertDescription>
            </Alert>

            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div class="rounded-lg border bg-background p-3">
                    <p class="text-xs font-medium uppercase text-muted-foreground">Access state</p>
                    <div class="mt-2 flex items-center justify-between gap-2">
                        <p class="text-sm font-semibold">{{ subscriptionAccessSummary.label }}</p>
                        <Badge :variant="subscriptionAccessSummary.tone">
                            {{ !subscriptionForm.planId ? 'Setup needed' : subscriptionDraftAccessEnabled ? 'Open' : 'Restricted' }}
                        </Badge>
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">{{ subscriptionAccessSummary.description }}</p>
                </div>
                <div class="rounded-lg border bg-background p-3">
                    <p class="text-xs font-medium uppercase text-muted-foreground">Renewal risk</p>
                    <div class="mt-2 flex items-center justify-between gap-2">
                        <p class="text-sm font-semibold">{{ subscriptionRenewalRisk.label }}</p>
                        <Badge :variant="subscriptionRenewalRisk.tone">{{ formatEnumLabel(subscriptionForm.status) }}</Badge>
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">{{ subscriptionRenewalRisk.description }}</p>
                </div>
                <div class="rounded-lg border bg-background p-3">
                    <p class="text-xs font-medium uppercase text-muted-foreground">Fee source</p>
                    <p class="mt-2 text-sm font-semibold">{{ moneyLabel(subscriptionForm.priceAmount, subscriptionForm.currencyCode) }}</p>
                    <p class="mt-1 text-xs text-muted-foreground">Derived from {{ selectedSubscriptionPlan?.name || 'selected plan' }}.</p>
                </div>
                <div class="rounded-lg border bg-background p-3">
                    <p class="text-xs font-medium uppercase text-muted-foreground">Coverage</p>
                    <p class="mt-2 text-sm font-semibold">{{ subscriptionCoveragePercent }}%</p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        {{ enabledAccessEntitlements.length }} allowed, {{ restrictedAccessEntitlements.length }} restricted.
                    </p>
                </div>
            </div>

            <div v-if="subscriptionLoading" class="grid gap-3">
                <Skeleton class="h-48 w-full" />
                <Skeleton class="h-48 w-full" />
            </div>
            <div v-else-if="subscriptionPlans.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No active subscription plans are configured.
            </div>
            <div v-else class="grid items-start gap-3">
                <div class="grid gap-3 rounded-lg border bg-muted/20 p-3">
                    <FormFieldShell input-id="details-subscription-plan" label="Service plan" required :error-message="firstError(subscriptionErrors, 'planId')">
                        <Select
                            :model-value="subscriptionForm.planId || undefined"
                            @update:model-value="applySubscriptionPlanDefaults(String($event ?? ''))"
                        >
                            <SelectTrigger id="details-subscription-plan" class="w-full" :disabled="subscriptionSaving">
                                <SelectValue placeholder="Select service plan" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="plan in subscriptionPlans" :key="plan.id" :value="plan.id">
                                    {{ plan.name || plan.code || 'Unnamed plan' }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                    <div class="rounded-md border bg-background p-3">
                        <p class="text-sm font-medium">{{ selectedSubscriptionPlan?.name || 'Plan not selected' }}</p>
                        <p class="mt-1 text-xs text-muted-foreground">{{ selectedSubscriptionPlan?.description || 'Service plan description not configured.' }}</p>
                        <div class="mt-3 flex flex-wrap gap-1.5">
                            <Badge variant="outline">{{ formatEnumLabel(selectedSubscriptionPlan?.billingCycle ?? 'monthly') }}</Badge>
                            <Badge variant="outline">{{ moneyLabel(selectedSubscriptionPlan?.priceAmount ?? null, selectedSubscriptionPlan?.currencyCode ?? 'TZS') }}</Badge>
                        </div>
                    </div>
                    <div class="grid gap-3 lg:grid-cols-2">
                        <div class="rounded-md border bg-background p-3">
                            <div class="flex items-center justify-between gap-2">
                                <p class="text-xs font-medium uppercase text-muted-foreground">Allowed modules</p>
                                <Badge variant="secondary">{{ enabledAccessEntitlements.length }}</Badge>
                            </div>
                            <div class="mt-2 flex flex-wrap gap-1.5">
                                <Badge v-for="entitlement in enabledAccessEntitlements" :key="`allowed-${entitlement.key || entitlement.id || entitlement.label}`" variant="secondary">
                                    {{ entitlement.label || entitlement.key }}
                                </Badge>
                            </div>
                            <p v-if="enabledAccessEntitlements.length === 0" class="mt-2 text-xs text-muted-foreground">No enabled entitlements on this plan.</p>
                        </div>
                        <div class="rounded-md border bg-background p-3">
                            <div class="flex items-center justify-between gap-2">
                                <p class="text-xs font-medium uppercase text-muted-foreground">Restricted by plan</p>
                                <Badge variant="outline">{{ restrictedAccessEntitlements.length }}</Badge>
                            </div>
                            <div class="mt-2 flex flex-wrap gap-1.5">
                                <Badge v-for="entitlement in restrictedAccessEntitlements.slice(0, 12)" :key="`restricted-${entitlement.key || entitlement.id || entitlement.label}`" variant="outline">
                                    {{ entitlement.label || entitlement.key }}
                                </Badge>
                            </div>
                            <p v-if="restrictedAccessEntitlements.length === 0" class="mt-2 text-xs text-muted-foreground">This plan includes every configured service entitlement.</p>
                            <p v-else-if="restrictedAccessEntitlements.length > 12" class="mt-2 text-xs text-muted-foreground">
                                {{ restrictedAccessEntitlements.length - 12 }} more restricted entitlements are hidden for scanning.
                            </p>
                        </div>
                    </div>
                </div>

                <div class="grid gap-3 rounded-lg border p-3">
                    <div class="grid gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-5">
                        <div v-for="item in subscriptionTimeline" :key="item.label" class="min-w-0">
                            <p class="text-xs font-medium uppercase text-muted-foreground">{{ item.label }}</p>
                            <p class="mt-1 truncate text-sm font-semibold">{{ dateDistanceLabel(item.value) }}</p>
                            <p class="truncate text-xs text-muted-foreground">{{ fmt(toApiDateTime(item.value)) }}</p>
                        </div>
                    </div>
                    <div class="grid gap-3 sm:grid-cols-2">
                        <FormFieldShell input-id="details-subscription-status" label="Subscription status" required :error-message="firstError(subscriptionErrors, 'status')">
                            <Select v-model="subscriptionForm.status">
                                <SelectTrigger id="details-subscription-status" class="w-full" :disabled="subscriptionSaving"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="statusOption in subscriptionStatusOptions" :key="statusOption.value" :value="statusOption.value">
                                        {{ statusOption.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </FormFieldShell>
                        <FormFieldShell input-id="details-subscription-cycle" label="Billing cycle" helper-text="Derived from the selected service plan.">
                            <Input id="details-subscription-cycle" :model-value="formatEnumLabel(subscriptionForm.billingCycle)" disabled />
                        </FormFieldShell>
                        <FormFieldShell input-id="details-subscription-price" label="Plan fee" helper-text="Changing the plan changes the facility fee.">
                            <Input id="details-subscription-price" :model-value="moneyLabel(subscriptionForm.priceAmount, subscriptionForm.currencyCode)" disabled />
                        </FormFieldShell>
                        <FormFieldShell input-id="details-subscription-currency" label="Currency" helper-text="Derived from the selected service plan.">
                            <Input id="details-subscription-currency" :model-value="subscriptionForm.currencyCode" disabled />
                        </FormFieldShell>
                        <div class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                            <SingleDatePopoverField
                                input-id="details-subscription-period-start-date"
                                label="Period start date"
                                :model-value="subscriptionDatePart('currentPeriodStartsAt')"
                                :disabled="subscriptionSaving"
                                :error-message="firstError(subscriptionErrors, 'currentPeriodStartsAt')"
                                @update:model-value="(value) => updateSubscriptionDatePart('currentPeriodStartsAt', value)"
                            />
                            <TimePopoverField
                                input-id="details-subscription-period-start-time"
                                label="Period start time"
                                :model-value="subscriptionTimePart('currentPeriodStartsAt')"
                                :disabled="subscriptionSaving || !subscriptionDatePart('currentPeriodStartsAt')"
                                @update:model-value="(value) => updateSubscriptionTimePart('currentPeriodStartsAt', value)"
                            />
                        </div>
                        <div class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                            <SingleDatePopoverField
                                input-id="details-subscription-period-end-date"
                                label="Period end date"
                                :model-value="subscriptionDatePart('currentPeriodEndsAt')"
                                :disabled="subscriptionSaving"
                                :error-message="firstError(subscriptionErrors, 'currentPeriodEndsAt')"
                                @update:model-value="(value) => updateSubscriptionDatePart('currentPeriodEndsAt', value)"
                            />
                            <TimePopoverField
                                input-id="details-subscription-period-end-time"
                                label="Period end time"
                                :model-value="subscriptionTimePart('currentPeriodEndsAt')"
                                :disabled="subscriptionSaving || !subscriptionDatePart('currentPeriodEndsAt')"
                                @update:model-value="(value) => updateSubscriptionTimePart('currentPeriodEndsAt', value)"
                            />
                        </div>
                        <div class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                            <SingleDatePopoverField
                                input-id="details-subscription-next-invoice-date"
                                label="Next invoice date"
                                :model-value="subscriptionDatePart('nextInvoiceAt')"
                                :disabled="subscriptionSaving"
                                @update:model-value="(value) => updateSubscriptionDatePart('nextInvoiceAt', value)"
                            />
                            <TimePopoverField
                                input-id="details-subscription-next-invoice-time"
                                label="Next invoice time"
                                :model-value="subscriptionTimePart('nextInvoiceAt')"
                                :disabled="subscriptionSaving || !subscriptionDatePart('nextInvoiceAt')"
                                @update:model-value="(value) => updateSubscriptionTimePart('nextInvoiceAt', value)"
                            />
                        </div>
                        <div class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                            <SingleDatePopoverField
                                input-id="details-subscription-trial-end-date"
                                label="Trial end date"
                                :model-value="subscriptionDatePart('trialEndsAt')"
                                :disabled="subscriptionSaving"
                                :error-message="firstError(subscriptionErrors, 'trialEndsAt')"
                                @update:model-value="(value) => updateSubscriptionDatePart('trialEndsAt', value)"
                            />
                            <TimePopoverField
                                input-id="details-subscription-trial-end-time"
                                label="Trial end time"
                                :model-value="subscriptionTimePart('trialEndsAt')"
                                :disabled="subscriptionSaving || !subscriptionDatePart('trialEndsAt')"
                                @update:model-value="(value) => updateSubscriptionTimePart('trialEndsAt', value)"
                            />
                        </div>
                        <div class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                            <SingleDatePopoverField
                                input-id="details-subscription-grace-end-date"
                                label="Grace end date"
                                :model-value="subscriptionDatePart('gracePeriodEndsAt')"
                                :disabled="subscriptionSaving"
                                :error-message="firstError(subscriptionErrors, 'gracePeriodEndsAt')"
                                @update:model-value="(value) => updateSubscriptionDatePart('gracePeriodEndsAt', value)"
                            />
                            <TimePopoverField
                                input-id="details-subscription-grace-end-time"
                                label="Grace end time"
                                :model-value="subscriptionTimePart('gracePeriodEndsAt')"
                                :disabled="subscriptionSaving || !subscriptionDatePart('gracePeriodEndsAt')"
                                @update:model-value="(value) => updateSubscriptionTimePart('gracePeriodEndsAt', value)"
                            />
                        </div>
                        <FormFieldShell input-id="details-subscription-reason" label="Status reason" container-class="sm:col-span-2" :error-message="firstError(subscriptionErrors, 'statusReason')">
                            <Textarea id="details-subscription-reason" v-model="subscriptionForm.statusReason" class="min-h-20" :disabled="subscriptionSaving" />
                        </FormFieldShell>
                    </div>
                </div>
            </div>
        </fieldset>

        <div v-if="canManageSubscriptions" class="flex justify-end">
            <Button class="gap-1.5" :disabled="subscriptionSaveDisabled" @click="saveSubscription">
                <AppIcon name="circle-check-big" class="size-3.5" />
                {{ subscriptionSaving ? 'Saving...' : 'Save Subscription' }}
            </Button>
        </div>
    </div>
</template>