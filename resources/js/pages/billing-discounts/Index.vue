<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { csrfRequestHeaders, refreshCsrfToken } from '@/lib/csrf';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type ApiError = { message?: string };
type DiscountType = 'percentage' | 'fixed' | 'full_waiver';
type DiscountPolicy = {
    id: string;
    code: string | null;
    name: string | null;
    description: string | null;
    discount_type: string | null;
    discount_value: string | number | null;
    discount_percentage: string | number | null;
    applicable_services: string[] | null;
    auto_apply: boolean | null;
    requires_approval_above_amount: string | number | null;
    active_from_date: string | null;
    active_to_date: string | null;
    status: string | null;
    created_at: string | null;
    updated_at: string | null;
};
type DiscountApplication = {
    id: string;
    billing_invoice_id: string | null;
    billing_discount_policy_id: string | null;
    original_amount: number | null;
    discount_amount: number | null;
    final_amount: number | null;
    reason: string | null;
    original_total: number | null;
    discount_applied: number | null;
    new_total: number | null;
    applied_at: string | null;
    financePosting?: {
        infrastructure: {
            revenueRecognitionReady: boolean;
            glPostingReady: boolean;
            missingTables: string[];
        };
        recognition: {
            status: string;
            recognizedAt: string | null;
            netRevenue: number;
        };
    } | null;
};
type CollectionResponse<T> = { success: boolean; data: T[] };
type ItemResponse<T> = { success: boolean; data: T };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing-invoices' },
    { title: 'Discount Policies', href: '/billing-discounts' },
];

const { permissionState } = usePlatformAccess();
const canRead = computed(() => permissionState('billing.discounts.read') === 'allowed');
const canManage = computed(() => permissionState('billing.discounts.manage') === 'allowed');

const listLoading = ref(false);
const detailsLoading = ref(false);
const actionLoading = ref(false);
const booting = ref(true);
const pageError = ref<string | null>(null);

const filters = reactive({
    q: '',
    status: 'all',
    availability: 'all',
});

const policies = ref<DiscountPolicy[]>([]);
const selectedPolicyId = ref<string | null>(null);
const selectedPolicy = ref<DiscountPolicy | null>(null);

const createDialogOpen = ref(false);
const applyDialogOpen = ref(false);
const lastApplication = ref<DiscountApplication | null>(null);

const createForm = reactive({
    code: '',
    name: '',
    description: '',
    discountType: 'percentage' as DiscountType,
    discountValue: '',
    discountPercentage: '',
    autoApply: 'false',
    requiresApprovalAboveAmount: '',
    activeFromDate: '',
    activeToDate: '',
    applicableServices: '',
    status: 'active',
});

const applyForm = reactive({
    invoiceNumber: '',
    reason: '',
});

const policySummary = computed(() => {
    const total = policies.value.length;
    const active = policies.value.filter((item) => item.status === 'active').length;
    const autoApply = policies.value.filter((item) => item.auto_apply).length;
    return `${total} policies in view | ${active} active | ${autoApply} auto-apply`;
});

const leadPolicyAction = computed(() => {
    if (!selectedPolicy.value) return 'Create or select a discount policy to control invoice concessions safely.';
    if (selectedPolicy.value.status !== 'active') return 'This policy is inactive and should not be used for new invoice discounts.';
    if (selectedPolicy.value.auto_apply) return 'This policy is marked for auto-apply and should be monitored carefully for scope and dates.';
    return 'Apply this policy only to the right invoice context and keep the concession reason on the billing trail.';
});

function discountFinanceSetupMissing(application: DiscountApplication | null | undefined): boolean {
    return Boolean(application?.financePosting?.infrastructure && !application.financePosting.infrastructure.revenueRecognitionReady);
}

function discountFinanceMissingTables(application: DiscountApplication | null | undefined): string {
    return application?.financePosting?.infrastructure?.missingTables?.join(', ') || 'revenue_recognition_records';
}

watch(
    () => [filters.status, filters.availability],
    () => {
        loadPolicies(false);
    },
);

function formatCurrency(value: number | string | null | undefined, currency = 'TZS'): string {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return `${currency} 0`;

    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(numeric);
    } catch {
        return `${currency} ${numeric.toLocaleString()}`;
    }
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not scheduled';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function formatStatusLabel(value: string | null | undefined): string {
    if (!value) return 'Unknown';
    return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function policyBadgeVariant(status: string | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (status === 'active') return 'default';
    if (status === 'inactive') return 'secondary';
    return 'outline';
}

function policyValueLabel(policy: DiscountPolicy | null): string {
    if (!policy) return 'No value';
    if (policy.discount_type === 'percentage') return `${policy.discount_percentage ?? 0}% discount`;
    if (policy.discount_type === 'fixed') return `${formatCurrency(policy.discount_value)} fixed`;
    if (policy.discount_type === 'full_waiver') return 'Full waiver';
    return 'Policy value unavailable';
}

async function apiRequest<T>(
    method: 'GET' | 'POST',
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
        await refreshCsrfToken();
        Object.assign(headers, csrfRequestHeaders(), { 'Content-Type': 'application/json' });
        body = JSON.stringify(options?.body ?? {});
    }

    const response = await fetch(url.toString(), {
        method,
        credentials: 'same-origin',
        headers,
        body,
    });

    const payload = (await response.json().catch(() => ({}))) as T & ApiError;
    if (!response.ok) throw new Error(payload.message || `${response.status} ${response.statusText}`);
    return payload;
}

async function loadPolicies(preserveSelection = true) {
    if (!canRead.value) {
        booting.value = false;
        return;
    }

    listLoading.value = true;
    pageError.value = null;

    try {
        const response = await apiRequest<CollectionResponse<DiscountPolicy>>('GET', '/discount-policies', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status,
                availability: filters.availability,
            },
        });

        policies.value = response.data;

        const currentStillExists = preserveSelection
            && selectedPolicyId.value !== null
            && response.data.some((policy) => policy.id === selectedPolicyId.value);

        if (currentStillExists) {
            selectedPolicy.value = response.data.find((policy) => policy.id === selectedPolicyId.value) ?? null;
        } else if (response.data.length > 0) {
            selectedPolicyId.value = response.data[0].id;
            selectedPolicy.value = response.data[0];
        } else {
            selectedPolicyId.value = null;
            selectedPolicy.value = null;
        }
    } catch (error) {
        pageError.value = messageFromUnknown(error, 'Unable to load discount policies.');
        notifyError(pageError.value);
    } finally {
        listLoading.value = false;
        booting.value = false;
    }
}

function selectPolicy(policyId: string) {
    if (selectedPolicyId.value === policyId) return;
    selectedPolicyId.value = policyId;
    selectedPolicy.value = policies.value.find((policy) => policy.id === policyId) ?? null;
}

function resetCreateForm() {
    createForm.code = '';
    createForm.name = '';
    createForm.description = '';
    createForm.discountType = 'percentage';
    createForm.discountValue = '';
    createForm.discountPercentage = '';
    createForm.autoApply = 'false';
    createForm.requiresApprovalAboveAmount = '';
    createForm.activeFromDate = '';
    createForm.activeToDate = '';
    createForm.applicableServices = '';
    createForm.status = 'active';
}

function resetApplyForm() {
    applyForm.invoiceNumber = '';
    applyForm.reason = '';
}

async function submitCreatePolicy() {
    if (!canManage.value || !createForm.code.trim() || !createForm.name.trim()) return;

    actionLoading.value = true;
    try {
        const payload: Record<string, unknown> = {
            code: createForm.code.trim().toUpperCase(),
            name: createForm.name.trim(),
            description: createForm.description.trim() || null,
            discount_type: createForm.discountType,
            auto_apply: createForm.autoApply === 'true',
            requires_approval_above_amount: createForm.requiresApprovalAboveAmount.trim() ? Number(createForm.requiresApprovalAboveAmount) : null,
            active_from_date: createForm.activeFromDate.trim() || null,
            active_to_date: createForm.activeToDate.trim() || null,
            applicable_services: createForm.applicableServices.trim()
                ? createForm.applicableServices.split(',').map((item) => item.trim()).filter(Boolean)
                : null,
            status: createForm.status,
        };

        if (createForm.discountType === 'percentage') payload.discount_percentage = Number(createForm.discountPercentage || 0);
        if (createForm.discountType === 'fixed') payload.discount_value = Number(createForm.discountValue || 0);

        const response = await apiRequest<ItemResponse<DiscountPolicy>>('POST', '/discount-policies', { body: payload });
        notifySuccess('Discount policy created.');
        createDialogOpen.value = false;
        resetCreateForm();
        filters.status = 'all';
        filters.availability = 'all';
        await loadPolicies(false);
        if (response.data.id) selectPolicy(response.data.id);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to create discount policy.'));
    } finally {
        actionLoading.value = false;
    }
}

async function submitApplyPolicy() {
    if (!canManage.value || !selectedPolicy.value || !applyForm.invoiceNumber.trim()) return;

    actionLoading.value = true;
    try {
        const response = await apiRequest<ItemResponse<DiscountApplication>>('POST', '/discount-applications', {
            body: {
                invoice_number: applyForm.invoiceNumber.trim(),
                discount_policy_id: selectedPolicy.value.id,
                reason: applyForm.reason.trim() || null,
            },
        });

        lastApplication.value = response.data;
        notifySuccess('Discount applied to invoice.');
        applyDialogOpen.value = false;
        resetApplyForm();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to apply discount policy.'));
    } finally {
        actionLoading.value = false;
    }
}

onMounted(async () => {
    await loadPolicies(false);
});
</script>

<template>
    <Head title="Discount Policies" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden p-4 md:p-6">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="file-text" class="size-6 text-muted-foreground" />
                        <span>Discount Policies</span>
                    </div>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Finance governance board for concessions, waivers, and controlled invoice discounts.
                    </p>
                    <div class="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">Policy control</Badge>
                        <Badge variant="outline">Invoice-number apply</Badge>
                        <Badge variant="outline">Approval threshold</Badge>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2">
                    <Button v-if="canManage" class="gap-2" @click="createDialogOpen = true">
                        <AppIcon name="plus" class="size-4" />
                        New policy
                    </Button>
                    <Button variant="outline" class="gap-2" :disabled="listLoading" @click="loadPolicies()">
                        <AppIcon name="refresh-cw" class="size-4" />
                        Refresh board
                    </Button>
                </div>
            </div>

            <Alert v-if="!canRead" variant="destructive" class="rounded-lg">
                <AppIcon name="shield-check" class="size-4" />
                <AlertTitle>Discount policy access is restricted</AlertTitle>
                <AlertDescription>This account does not have permission to read billing discount policies.</AlertDescription>
            </Alert>

            <Alert v-else class="rounded-lg border-sidebar-border/70">
                <AppIcon name="receipt" class="size-4" />
                <AlertTitle>Discount governance posture</AlertTitle>
                <AlertDescription>{{ leadPolicyAction }}</AlertDescription>
            </Alert>

            <div v-if="canRead" class="grid min-h-0 flex-1 gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
                <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70">
                    <CardHeader class="gap-3">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <CardTitle>Policy queue</CardTitle>
                                <CardDescription>{{ policySummary }}</CardDescription>
                            </div>
                            <Badge variant="outline">{{ policies.length }}</Badge>
                        </div>

                        <div class="grid gap-3">
                            <Input
                                v-model="filters.q"
                                placeholder="Search code, policy name, or description"
                                @keydown.enter.prevent="loadPolicies(false)"
                            />

                            <div class="grid gap-3 sm:grid-cols-2">
                                <Select v-model="filters.status">
                                    <SelectTrigger>
                                        <SelectValue placeholder="All statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select v-model="filters.availability">
                                    <SelectTrigger>
                                        <SelectValue placeholder="All availability" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All availability</SelectItem>
                                        <SelectItem value="current">Current</SelectItem>
                                        <SelectItem value="scheduled">Scheduled</SelectItem>
                                        <SelectItem value="expired">Expired</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button variant="outline" :disabled="listLoading" @click="loadPolicies(false)">Search</Button>
                        </div>
                    </CardHeader>

                    <CardContent class="flex min-h-0 flex-1 flex-col gap-3">
                        <div v-if="pageError" class="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
                            {{ pageError }}
                        </div>

                        <ScrollArea class="min-h-0 flex-1 pr-3">
                            <div class="space-y-3">
                                <template v-if="booting || listLoading">
                                    <div v-for="index in 5" :key="`discount-policy-skeleton-${index}`" class="rounded-lg border border-sidebar-border/70 p-3">
                                        <div class="h-4 w-2/3 rounded bg-muted"></div>
                                        <div class="mt-2 h-3 w-1/2 rounded bg-muted"></div>
                                        <div class="mt-3 h-8 w-full rounded bg-muted"></div>
                                    </div>
                                </template>

                                <template v-else-if="policies.length > 0">
                                    <button
                                        v-for="policy in policies"
                                        :key="policy.id"
                                        type="button"
                                        class="w-full rounded-lg border p-3 text-left transition-colors"
                                        :class="policy.id === selectedPolicyId ? 'border-primary bg-primary/5' : 'border-sidebar-border/70 hover:bg-muted/50'"
                                        @click="selectPolicy(policy.id)"
                                    >
                                        <div class="flex items-start justify-between gap-3">
                                            <div class="min-w-0">
                                                <p class="truncate text-sm font-medium">{{ policy.name || policy.code || 'Discount policy' }}</p>
                                                <p class="truncate text-xs text-muted-foreground">{{ policy.code || 'No code' }}</p>
                                            </div>
                                            <Badge :variant="policyBadgeVariant(policy.status)">{{ formatStatusLabel(policy.status) }}</Badge>
                                        </div>

                                        <div class="mt-3 grid gap-2 text-xs text-muted-foreground">
                                            <div>
                                                <span class="block text-[11px] uppercase tracking-[0.16em]">Policy value</span>
                                                <span class="text-sm font-semibold text-foreground">{{ policyValueLabel(policy) }}</span>
                                            </div>
                                            <div>
                                                <span class="block text-[11px] uppercase tracking-[0.16em]">Active from</span>
                                                <span class="text-sm text-foreground">{{ formatDateTime(policy.active_from_date) }}</span>
                                            </div>
                                        </div>
                                    </button>
                                </template>

                                <div v-else class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                    No discount policies match the current work filters.
                                </div>
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <div class="flex min-h-0 flex-col gap-4">
                    <template v-if="selectedPolicy">
                        <Card class="rounded-lg border-sidebar-border/70">
                            <CardHeader class="gap-3">
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="min-w-0">
                                        <CardTitle class="truncate">{{ selectedPolicy.name || selectedPolicy.code || 'Discount policy' }}</CardTitle>
                                        <CardDescription class="mt-1">{{ selectedPolicy.code || 'No policy code' }}</CardDescription>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Badge :variant="policyBadgeVariant(selectedPolicy.status)">{{ formatStatusLabel(selectedPolicy.status) }}</Badge>
                                        <Badge variant="outline">{{ policyValueLabel(selectedPolicy) }}</Badge>
                                        <Badge
                                            v-if="lastApplication && lastApplication.billing_discount_policy_id === selectedPolicy.id"
                                            :variant="discountFinanceSetupMissing(lastApplication) ? 'destructive' : (lastApplication.financePosting?.recognition.status === 'recognized' ? 'secondary' : 'outline')"
                                        >
                                            {{
                                                discountFinanceSetupMissing(lastApplication)
                                                    ? 'Finance setup missing'
                                                    : (lastApplication.financePosting?.recognition.status === 'recognized'
                                                        ? 'Recognition synced'
                                                        : 'Recognition pending')
                                            }}
                                        </Badge>
                                    </div>
                                </div>

                                <div class="grid gap-3 sm:grid-cols-3">
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Type</p>
                                        <p class="mt-1 text-lg font-semibold">{{ formatStatusLabel(selectedPolicy.discount_type) }}</p>
                                    </div>
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Approval threshold</p>
                                        <p class="mt-1 text-lg font-semibold">
                                            {{ selectedPolicy.requires_approval_above_amount ? formatCurrency(selectedPolicy.requires_approval_above_amount) : 'No threshold' }}
                                        </p>
                                    </div>
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Auto apply</p>
                                        <p class="mt-1 text-lg font-semibold">{{ selectedPolicy.auto_apply ? 'Enabled' : 'Manual only' }}</p>
                                    </div>
                                </div>

                                <div class="flex flex-wrap gap-2">
                                    <Button v-if="canManage && selectedPolicy.status === 'active'" class="gap-2" @click="applyDialogOpen = true">
                                        <AppIcon name="receipt" class="size-4" />
                                        Apply to invoice
                                    </Button>
                                    <Button variant="outline" class="gap-2" @click="window.location.href = '/billing-invoices'">
                                        <AppIcon name="arrow-right" class="size-4" />
                                        Open invoice board
                                    </Button>
                                </div>
                            </CardHeader>
                        </Card>

                        <div class="grid gap-4 xl:grid-cols-2">
                            <Card class="rounded-lg border-sidebar-border/70">
                                <CardHeader>
                                    <CardTitle>Policy posture</CardTitle>
                                    <CardDescription>Business shape and operational limits for this concession.</CardDescription>
                                </CardHeader>
                                <CardContent class="grid gap-3 text-sm">
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Description</p>
                                        <p class="mt-1 font-medium">{{ selectedPolicy.description || 'No description recorded.' }}</p>
                                    </div>
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Active window</p>
                                        <p class="mt-1 font-medium">
                                            {{ formatDateTime(selectedPolicy.active_from_date) }} to
                                            {{ selectedPolicy.active_to_date ? formatDateTime(selectedPolicy.active_to_date) : 'Open ended' }}
                                        </p>
                                    </div>
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Applicable services</p>
                                        <p class="mt-1 font-medium">
                                            {{ selectedPolicy.applicable_services?.length ? selectedPolicy.applicable_services.join(', ') : 'General invoice scope' }}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card class="rounded-lg border-sidebar-border/70">
                                <CardHeader>
                                    <CardTitle>Latest application</CardTitle>
                                    <CardDescription>Most recent discount application posted from this workboard session.</CardDescription>
                                </CardHeader>
                                <CardContent class="grid gap-3 text-sm">
                                    <template v-if="lastApplication && lastApplication.billing_discount_policy_id === selectedPolicy.id">
                                        <Alert v-if="discountFinanceSetupMissing(lastApplication)" variant="destructive" class="rounded-lg">
                                            <AppIcon name="triangle-alert" class="size-4" />
                                            <AlertTitle>Finance ledger setup is incomplete</AlertTitle>
                                            <AlertDescription>
                                                Discount recognition is using fallback values because these tables are not available yet:
                                                {{ discountFinanceMissingTables(lastApplication) }}.
                                            </AlertDescription>
                                        </Alert>

                                        <div class="rounded-lg border border-sidebar-border/70 p-3">
                                            <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Original total</p>
                                            <p class="mt-1 font-medium">{{ formatCurrency(lastApplication.original_total) }}</p>
                                        </div>
                                        <div class="rounded-lg border border-sidebar-border/70 p-3">
                                            <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Discount applied</p>
                                            <p class="mt-1 font-medium">{{ formatCurrency(lastApplication.discount_applied) }}</p>
                                        </div>
                                        <div class="rounded-lg border border-sidebar-border/70 p-3">
                                            <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">New total</p>
                                            <p class="mt-1 font-medium">{{ formatCurrency(lastApplication.new_total) }}</p>
                                        </div>
                                        <div class="rounded-lg border border-sidebar-border/70 p-3">
                                            <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Reason</p>
                                            <p class="mt-1 font-medium">{{ lastApplication.reason || 'No reason recorded.' }}</p>
                                        </div>
                                        <div class="rounded-lg border border-sidebar-border/70 p-3">
                                            <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recognition sync</p>
                                            <p class="mt-1 font-medium">
                                                {{
                                                    discountFinanceSetupMissing(lastApplication)
                                                        ? 'Setup missing'
                                                        : (lastApplication.financePosting?.recognition.status === 'recognized'
                                                            ? 'Recognized'
                                                            : 'Pending')
                                                }}
                                            </p>
                                            <p class="mt-1 text-xs text-muted-foreground">
                                                {{
                                                    discountFinanceSetupMissing(lastApplication)
                                                        ? `Revenue recognition is using fallback values because these tables are not available yet: ${discountFinanceMissingTables(lastApplication)}.`
                                                        : (lastApplication.financePosting?.recognition.status === 'recognized'
                                                            ? `${formatCurrency(lastApplication.financePosting?.recognition.netRevenue)} net revenue | ${formatDateTime(lastApplication.financePosting?.recognition.recognizedAt)}`
                                                            : 'Invoice recognition has not been synchronized yet.')
                                                }}
                                            </p>
                                        </div>
                                    </template>
                                    <div v-else class="rounded-lg border border-dashed p-4 text-muted-foreground">
                                        No discount application has been posted from this board session yet.
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </template>

                    <Card v-else class="rounded-lg border-sidebar-border/70">
                        <CardContent class="flex min-h-[24rem] flex-col items-center justify-center gap-3 text-center">
                            <AppIcon name="file-text" class="size-8 text-muted-foreground" />
                            <div>
                                <p class="text-base font-medium">No policy selected</p>
                                <p class="mt-1 text-sm text-muted-foreground">
                                    Choose a discount policy from the board or create a new one for finance operations.
                                </p>
                            </div>
                            <Button v-if="canManage" @click="createDialogOpen = true">New policy</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>

        <Dialog :open="createDialogOpen" @update:open="createDialogOpen = $event">
            <DialogContent class="rounded-lg sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create discount policy</DialogTitle>
                    <DialogDescription>
                        Build a concession rule with clear value, scope, and approval threshold.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-4 py-2">
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="discount-create-code">Policy code</Label>
                            <Input id="discount-create-code" v-model="createForm.code" placeholder="VIP-10" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="discount-create-name">Policy name</Label>
                            <Input id="discount-create-name" v-model="createForm.name" placeholder="VIP 10 Percent" />
                        </div>
                    </div>

                    <div class="grid gap-2">
                        <Label for="discount-create-description">Description</Label>
                        <Textarea id="discount-create-description" v-model="createForm.description" rows="3" placeholder="Short business note for finance and audit users" />
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label>Discount type</Label>
                            <Select v-model="createForm.discountType">
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="percentage">Percentage</SelectItem>
                                    <SelectItem value="fixed">Fixed amount</SelectItem>
                                    <SelectItem value="full_waiver">Full waiver</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div v-if="createForm.discountType === 'percentage'" class="grid gap-2">
                            <Label for="discount-create-percentage">Discount %</Label>
                            <Input id="discount-create-percentage" v-model="createForm.discountPercentage" inputmode="decimal" placeholder="10" />
                        </div>
                        <div v-else-if="createForm.discountType === 'fixed'" class="grid gap-2">
                            <Label for="discount-create-value">Fixed amount</Label>
                            <Input id="discount-create-value" v-model="createForm.discountValue" inputmode="decimal" placeholder="10000" />
                        </div>
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label>Auto apply</Label>
                            <Select v-model="createForm.autoApply">
                                <SelectTrigger>
                                    <SelectValue placeholder="Select mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="false">Manual only</SelectItem>
                                    <SelectItem value="true">Auto apply</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="grid gap-2">
                            <Label for="discount-create-threshold">Approval threshold</Label>
                            <Input id="discount-create-threshold" v-model="createForm.requiresApprovalAboveAmount" inputmode="decimal" placeholder="Optional amount" />
                        </div>
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="discount-create-from">Active from</Label>
                            <Input id="discount-create-from" v-model="createForm.activeFromDate" placeholder="2026-04-15 08:00:00" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="discount-create-to">Active to</Label>
                            <Input id="discount-create-to" v-model="createForm.activeToDate" placeholder="Optional end date" />
                        </div>
                    </div>

                    <div class="grid gap-2">
                        <Label for="discount-create-services">Applicable services</Label>
                        <Input id="discount-create-services" v-model="createForm.applicableServices" placeholder="Comma-separated service codes or names" />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" :disabled="actionLoading" @click="createDialogOpen = false">Cancel</Button>
                    <Button :disabled="actionLoading || !createForm.code.trim() || !createForm.name.trim()" @click="submitCreatePolicy">Create policy</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog :open="applyDialogOpen" @update:open="applyDialogOpen = $event">
            <DialogContent class="rounded-lg sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Apply discount policy</DialogTitle>
                    <DialogDescription>
                        Apply the selected policy using the invoice number staff already use at the billing desk.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-4 py-2">
                    <div class="rounded-lg border border-sidebar-border/70 p-3 text-sm text-muted-foreground">
                        <p class="text-xs uppercase tracking-[0.16em]">Selected policy</p>
                        <p class="mt-1 font-medium text-foreground">
                            {{ selectedPolicy?.name || selectedPolicy?.code }} | {{ policyValueLabel(selectedPolicy) }}
                        </p>
                    </div>

                    <div class="grid gap-2">
                        <Label for="discount-apply-invoice-number">Invoice number</Label>
                        <Input id="discount-apply-invoice-number" v-model="applyForm.invoiceNumber" placeholder="INV2026..." />
                    </div>

                    <div class="grid gap-2">
                        <Label for="discount-apply-reason">Reason</Label>
                        <Textarea id="discount-apply-reason" v-model="applyForm.reason" rows="3" placeholder="VIP agreement, corporate concession, or approved waiver note" />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" :disabled="actionLoading" @click="applyDialogOpen = false">Cancel</Button>
                    <Button :disabled="actionLoading || !applyForm.invoiceNumber.trim()" @click="submitApplyPolicy">Apply policy</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>
