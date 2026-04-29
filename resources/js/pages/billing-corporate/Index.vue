<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import BillingPayerContractLookupField from '@/components/billing/BillingPayerContractLookupField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { csrfRequestHeaders, refreshCsrfToken } from '@/lib/csrf';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type CorporateAccount = {
    id: string;
    billingPayerContractId: string | null;
    accountCode: string | null;
    accountName: string | null;
    billingContactName: string | null;
    billingContactEmail: string | null;
    billingContactPhone: string | null;
    billingCycleDay: number | null;
    settlementTermsDays: number | null;
    status: string | null;
    notes: string | null;
    contractCode: string | null;
    contractName: string | null;
    payerType: string | null;
    payerName: string | null;
    currencyCode: string | null;
};
type CorporateRun = {
    id: string;
    billingCorporateAccountId: string | null;
    runNumber: string | null;
    billingPeriodStart: string | null;
    billingPeriodEnd: string | null;
    issueDate: string | null;
    dueDate: string | null;
    currencyCode: string | null;
    invoiceCount: number | null;
    totalAmount: number | null;
    paidAmount: number | null;
    balanceAmount: number | null;
    lastPaymentAt: string | null;
    status: string | null;
    notes: string | null;
    invoices: Array<{ id: string; billing_invoice_id?: string; billingInvoiceId?: string; invoice_number?: string; invoiceNumber?: string; patient_display_name?: string; patientDisplayName?: string; included_amount?: number; includedAmount?: number; outstanding_amount?: number; outstandingAmount?: number; status?: string }>;
    payments: Array<{ id: string; amount: number; paid_at?: string; paidAt?: string; payment_method?: string; paymentMethod?: string; payment_reference?: string; paymentReference?: string }>;
};
type ApiListResponse<T> = { data: T[]; meta: Pagination };
type ApiItemResponse<T> = { data: T };

type CorporatePayerContractSelection = {
    contractCode: string | null;
    contractName: string | null;
    payerName: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing-invoices' },
    { title: 'Corporate Billing', href: '/billing-corporate' },
];

const { permissionState } = usePlatformAccess();
const canRead = computed(() => permissionState('billing.payer-contracts.read') === 'allowed');
const canManage = computed(() => permissionState('billing.payer-contracts.manage') === 'allowed');
const canRecordPayments = computed(() => permissionState('billing.payments.record') === 'allowed');

const loading = ref(false);
const detailLoading = ref(false);
const runLoading = ref(false);
const actionLoading = ref(false);
const pageError = ref<string | null>(null);
const accounts = ref<CorporateAccount[]>([]);
const accountPagination = ref<Pagination | null>(null);
const selectedAccountId = ref<string | null>(null);
const selectedAccount = ref<CorporateAccount | null>(null);
const runs = ref<CorporateRun[]>([]);
const runPagination = ref<Pagination | null>(null);
const selectedRunId = ref<string | null>(null);
const selectedRun = ref<CorporateRun | null>(null);
const createAccountDialogOpen = ref(false);
const createRunDialogOpen = ref(false);
const runPaymentDialogOpen = ref(false);

const filters = reactive({ q: '', status: 'all', page: 1, perPage: 15 });
const createAccountForm = reactive({
    billingPayerContractId: '',
    accountCode: '',
    accountName: '',
    billingContactName: '',
    billingContactEmail: '',
    billingContactPhone: '',
    billingCycleDay: '1',
    settlementTermsDays: '30',
    notes: '',
});
const createRunForm = reactive({ billingPeriodStart: '', billingPeriodEnd: '', issueDate: '', dueDate: '', notes: '' });
const runPaymentForm = reactive({ amount: '', paymentMethod: 'bank_transfer', paymentReference: '', note: '' });

async function apiRequest<T>(method: 'GET' | 'POST', path: string, options?: { query?: Record<string, string | number>; body?: Record<string, unknown> }): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
        if (value === '' || value === 'all') return;
        url.searchParams.set(key, String(value));
    });

    const headers: Record<string, string> = { Accept: 'application/json' };
    let body: string | undefined;
    if (method === 'POST') {
        await refreshCsrfToken();
        Object.assign(headers, csrfRequestHeaders(), { 'Content-Type': 'application/json' });
        body = JSON.stringify(options?.body ?? {});
    }

    const response = await fetch(url.toString(), { method, headers, body, credentials: 'same-origin' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `Request failed with status ${response.status}.`);
    return payload as T;
}

function formatCurrency(value: number | null | undefined, currency = 'TZS'): string {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

function formatDate(value: string | null | undefined): string {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(date);
}

function formatStatusLabel(value: string | null | undefined): string {
    if (!value) return 'Unknown';
    return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function statusVariant(status: string | null | undefined): 'default' | 'secondary' | 'outline' | 'destructive' {
    if (status === 'paid' || status === 'closed') return 'secondary';
    if (status === 'suspended' || status === 'cancelled') return 'destructive';
    if (status === 'partially_paid' || status === 'issued' || status === 'active') return 'default';
    return 'outline';
}

function normalizeDateInputValue(value: string | null | undefined): string {
    if (!value) return '';

    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 10);
    }

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toISOString().slice(0, 10);
}

function seedRunFormFromInvoiceDate(invoiceDate: string | null | undefined): void {
    const normalizedDate = normalizeDateInputValue(invoiceDate);
    if (!normalizedDate) return;

    createRunForm.billingPeriodStart = normalizedDate;
    createRunForm.billingPeriodEnd = normalizedDate;
    if (!createRunForm.issueDate) createRunForm.issueDate = normalizedDate;
    if (!createRunForm.dueDate) createRunForm.dueDate = normalizedDate;
}

function handleCorporateContractSelected(contract: CorporatePayerContractSelection | null): void {
    if (!contract) return;

    if (!createAccountForm.accountCode.trim() && contract.contractCode) {
        createAccountForm.accountCode = contract.contractCode;
    }

    if (!createAccountForm.accountName.trim()) {
        createAccountForm.accountName = contract.contractName || contract.payerName || '';
    }
}

async function loadAccounts(selectFirst = true): Promise<void> {
    if (!canRead.value) return;
    loading.value = true;
    pageError.value = null;
    try {
        const response = await apiRequest<ApiListResponse<CorporateAccount>>('GET', '/billing-corporate-accounts', {
            query: { q: filters.q, status: filters.status, page: filters.page, perPage: filters.perPage },
        });
        accounts.value = response.data;
        accountPagination.value = response.meta;
        if (accounts.value.length === 0) {
            selectedAccount.value = null;
            selectedAccountId.value = null;
            runs.value = [];
            selectedRun.value = null;
            return;
        }
        if (selectFirst) {
            const targetId = selectedAccountId.value && accounts.value.some((item) => item.id === selectedAccountId.value)
                ? selectedAccountId.value
                : accounts.value[0].id;
            await selectAccount(targetId);
        }
    } catch (error) {
        pageError.value = messageFromUnknown(error, 'Unable to load corporate billing accounts.');
        notifyError(pageError.value);
    } finally {
        loading.value = false;
    }
}

async function selectAccount(id: string): Promise<void> {
    detailLoading.value = true;
    try {
        const response = await apiRequest<ApiItemResponse<CorporateAccount>>('GET', `/billing-corporate-accounts/${id}`);
        selectedAccount.value = response.data;
        selectedAccountId.value = response.data.id;
        await loadRuns(response.data.id, true);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to load the selected corporate account.'));
    } finally {
        detailLoading.value = false;
    }
}

async function loadRuns(accountId: string, selectFirstRun = false): Promise<void> {
    runLoading.value = true;
    try {
        const response = await apiRequest<ApiListResponse<CorporateRun>>('GET', `/billing-corporate-accounts/${accountId}/runs`);
        runs.value = response.data;
        runPagination.value = response.meta;
        if (response.data.length === 0) {
            selectedRun.value = null;
            selectedRunId.value = null;
            return;
        }
        if (selectFirstRun) {
            const runId = selectedRunId.value && response.data.some((item) => item.id === selectedRunId.value)
                ? selectedRunId.value
                : response.data[0].id;
            await loadRun(runId);
        }
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to load corporate billing runs.'));
    } finally {
        runLoading.value = false;
    }
}

async function loadRun(id: string): Promise<void> {
    const response = await apiRequest<ApiItemResponse<CorporateRun>>('GET', `/billing-corporate-runs/${id}`);
    selectedRun.value = response.data;
    selectedRunId.value = response.data.id;
}

async function submitCreateAccount(): Promise<void> {
    if (!canManage.value) return;
    actionLoading.value = true;
    try {
        await apiRequest<ApiItemResponse<CorporateAccount>>('POST', '/billing-corporate-accounts', {
            body: {
                billingPayerContractId: createAccountForm.billingPayerContractId,
                accountCode: createAccountForm.accountCode || null,
                accountName: createAccountForm.accountName || null,
                billingContactName: createAccountForm.billingContactName || null,
                billingContactEmail: createAccountForm.billingContactEmail || null,
                billingContactPhone: createAccountForm.billingContactPhone || null,
                billingCycleDay: Number(createAccountForm.billingCycleDay),
                settlementTermsDays: Number(createAccountForm.settlementTermsDays),
                notes: createAccountForm.notes || null,
            },
        });
        createAccountDialogOpen.value = false;
        notifySuccess('Corporate billing account created.');
        await loadAccounts(true);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to create the corporate billing account.'));
    } finally {
        actionLoading.value = false;
    }
}

async function submitCreateRun(): Promise<void> {
    if (!selectedAccount.value || !canManage.value) return;
    actionLoading.value = true;
    try {
        await apiRequest<ApiItemResponse<CorporateRun>>('POST', `/billing-corporate-accounts/${selectedAccount.value.id}/runs`, {
            body: {
                billingPeriodStart: createRunForm.billingPeriodStart,
                billingPeriodEnd: createRunForm.billingPeriodEnd,
                issueDate: createRunForm.issueDate || null,
                dueDate: createRunForm.dueDate || null,
                notes: createRunForm.notes || null,
            },
        });
        createRunDialogOpen.value = false;
        notifySuccess('Corporate billing run created from eligible invoices.');
        await loadRuns(selectedAccount.value.id, true);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to create the corporate billing run.'));
    } finally {
        actionLoading.value = false;
    }
}

async function submitRunPayment(): Promise<void> {
    if (!selectedRun.value || !canRecordPayments.value) return;
    actionLoading.value = true;
    try {
        const response = await apiRequest<ApiItemResponse<CorporateRun>>('POST', `/billing-corporate-runs/${selectedRun.value.id}/payments`, {
            body: {
                amount: Number(runPaymentForm.amount),
                paymentMethod: runPaymentForm.paymentMethod,
                paymentReference: runPaymentForm.paymentReference || null,
                note: runPaymentForm.note || null,
            },
        });
        selectedRun.value = response.data;
        runPaymentDialogOpen.value = false;
        runPaymentForm.amount = '';
        runPaymentForm.paymentReference = '';
        runPaymentForm.note = '';
        notifySuccess('Corporate payment recorded and allocated to source invoices.');
        if (selectedAccount.value) {
            await loadRuns(selectedAccount.value.id, false);
        }
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to record the corporate settlement payment.'));
    } finally {
        actionLoading.value = false;
    }
}

async function applyRouteContext(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const contractId = params.get('billingPayerContractId')?.trim() ?? '';
    const invoiceDate = params.get('invoiceDate');
    const openRunDialog = params.get('openRunDialog') === '1';

    if (!contractId) return;

    createAccountForm.billingPayerContractId = contractId;
    seedRunFormFromInvoiceDate(invoiceDate);

    const matchingAccount = accounts.value.find(
        (account) => (account.billingPayerContractId ?? '').trim() === contractId,
    );

    if (matchingAccount) {
        if (selectedAccountId.value !== matchingAccount.id) {
            await selectAccount(matchingAccount.id);
        }

        if (openRunDialog && canManage.value) {
            createRunDialogOpen.value = true;
        }

        return;
    }

    if (canManage.value) {
        createAccountDialogOpen.value = true;
    }
}

onMounted(async () => {
    await loadAccounts();
    await applyRouteContext();
});
</script>

<template>
    <Head title="Corporate Billing" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden p-4 md:p-6">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="building-2" class="size-7 text-primary" />
                        <span>Corporate Billing</span>
                    </div>
                    <p class="mt-1 max-w-3xl text-sm text-muted-foreground">
                        Consolidate employer and sponsor invoices by payer contract, then settle the underlying patient invoices through a single corporate collection workflow.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Button variant="outline" as-child>
                        <Link href="/billing-payer-contracts">Payer Contracts</Link>
                    </Button>
                    <Button variant="outline" as-child>
                        <Link href="/billing-invoices">Billing Invoices</Link>
                    </Button>
                    <Button variant="outline" as-child>
                        <Link href="/billing-financial-reports">Financial Reports</Link>
                    </Button>
                    <Button v-if="canManage" class="gap-1.5" @click="createAccountDialogOpen = true">
                        <AppIcon name="plus" class="size-4" />
                        New corporate account
                    </Button>
                    <Button variant="outline" :disabled="loading" @click="loadAccounts()">Refresh</Button>
                </div>
            </div>

            <Alert v-if="pageError" variant="destructive" class="rounded-lg">
                <AppIcon name="shield-alert" class="size-4" />
                <AlertTitle>Corporate billing unavailable</AlertTitle>
                <AlertDescription>{{ pageError }}</AlertDescription>
            </Alert>

            <div class="grid min-h-0 flex-1 gap-4 xl:grid-cols-[22rem_24rem_minmax(0,1fr)]">
                <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70">
                    <CardHeader class="gap-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <CardTitle>Corporate accounts</CardTitle>
                                <CardDescription>{{ accountPagination?.total ?? accounts.length }} linked accounts</CardDescription>
                            </div>
                            <Badge variant="outline">{{ accountPagination?.total ?? 0 }}</Badge>
                        </div>
                        <div class="grid gap-3">
                            <Input v-model="filters.q" placeholder="Search account, contract, payer" @keydown.enter.prevent="filters.page = 1; loadAccounts(false)" />
                            <div class="grid gap-3 sm:grid-cols-2">
                                <Select v-model="filters.status">
                                    <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                        <SelectItem value="suspended">Suspended</SelectItem>
                                        <SelectItem value="closed">Closed</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" :disabled="loading" @click="filters.page = 1; loadAccounts(false)">Search</Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="min-h-0 flex-1 space-y-3 overflow-y-auto">
                        <button
                            v-for="account in accounts"
                            :key="account.id"
                            type="button"
                            class="w-full rounded-lg border p-3 text-left transition-colors"
                            :class="account.id === selectedAccountId ? 'border-primary bg-primary/5' : 'border-sidebar-border/70 hover:bg-muted/50'"
                            @click="selectAccount(account.id)"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <p class="truncate text-sm font-medium">{{ account.accountName || account.accountCode }}</p>
                                    <p class="truncate text-xs text-muted-foreground">{{ account.contractCode || account.contractName || account.payerName }}</p>
                                </div>
                                <Badge :variant="statusVariant(account.status)">{{ formatStatusLabel(account.status) }}</Badge>
                            </div>
                            <div class="mt-3 text-xs text-muted-foreground">
                                {{ account.billingContactName || 'No billing contact' }}
                            </div>
                        </button>
                    </CardContent>
                </Card>

                <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70">
                    <CardHeader class="gap-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <CardTitle>Billing runs</CardTitle>
                                <CardDescription v-if="selectedAccount">{{ selectedAccount.accountName }}</CardDescription>
                                <CardDescription v-else>Select a corporate account</CardDescription>
                            </div>
                            <Button v-if="selectedAccount && canManage" size="sm" @click="createRunDialogOpen = true">Generate run</Button>
                        </div>
                    </CardHeader>
                    <CardContent class="min-h-0 flex-1 space-y-3 overflow-y-auto">
                        <div v-if="runLoading" class="py-8 text-sm text-muted-foreground">Loading runs...</div>
                        <button
                            v-for="run in runs"
                            :key="run.id"
                            type="button"
                            class="w-full rounded-lg border p-3 text-left transition-colors"
                            :class="run.id === selectedRunId ? 'border-primary bg-primary/5' : 'border-sidebar-border/70 hover:bg-muted/50'"
                            @click="loadRun(run.id)"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="text-sm font-medium">{{ run.runNumber }}</p>
                                    <p class="text-xs text-muted-foreground">{{ formatDate(run.billingPeriodStart) }} to {{ formatDate(run.billingPeriodEnd) }}</p>
                                </div>
                                <Badge :variant="statusVariant(run.status)">{{ formatStatusLabel(run.status) }}</Badge>
                            </div>
                            <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                <div>
                                    <span class="block text-[11px] uppercase tracking-[0.16em]">Invoices</span>
                                    <span class="text-sm text-foreground">{{ run.invoiceCount || 0 }}</span>
                                </div>
                                <div>
                                    <span class="block text-[11px] uppercase tracking-[0.16em]">Outstanding</span>
                                    <span class="text-sm text-foreground">{{ formatCurrency(run.balanceAmount, run.currencyCode || 'TZS') }}</span>
                                </div>
                            </div>
                        </button>
                    </CardContent>
                </Card>

                <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70">
                    <CardHeader v-if="selectedRun" class="gap-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="briefcase" class="size-5 text-muted-foreground" />
                                    {{ selectedRun.runNumber }}
                                </CardTitle>
                                <CardDescription>
                                    {{ formatDate(selectedRun.billingPeriodStart) }} to {{ formatDate(selectedRun.billingPeriodEnd) }}
                                </CardDescription>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                <Badge :variant="statusVariant(selectedRun.status)">{{ formatStatusLabel(selectedRun.status) }}</Badge>
                                <Button v-if="canRecordPayments" size="sm" class="gap-1.5" @click="runPaymentDialogOpen = true">
                                    <AppIcon name="banknote" class="size-3.5" />
                                    Record settlement
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="min-h-0 flex-1 overflow-y-auto pt-0">
                        <div v-if="detailLoading" class="py-8 text-sm text-muted-foreground">Loading corporate account...</div>
                        <div v-else-if="!selectedRun" class="py-8 text-sm text-muted-foreground">Select a run to review included invoices and settlement history.</div>
                        <div v-else class="space-y-4">
                            <div class="grid gap-3 md:grid-cols-4">
                                <div class="rounded-lg border border-sidebar-border/70 p-3">
                                    <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Invoices</p>
                                    <p class="mt-2 text-lg font-semibold">{{ selectedRun.invoiceCount || 0 }}</p>
                                </div>
                                <div class="rounded-lg border border-sidebar-border/70 p-3">
                                    <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Run total</p>
                                    <p class="mt-2 text-lg font-semibold">{{ formatCurrency(selectedRun.totalAmount, selectedRun.currencyCode || 'TZS') }}</p>
                                </div>
                                <div class="rounded-lg border border-sidebar-border/70 p-3">
                                    <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Collected</p>
                                    <p class="mt-2 text-lg font-semibold">{{ formatCurrency(selectedRun.paidAmount, selectedRun.currencyCode || 'TZS') }}</p>
                                </div>
                                <div class="rounded-lg border border-sidebar-border/70 p-3">
                                    <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Outstanding</p>
                                    <p class="mt-2 text-lg font-semibold">{{ formatCurrency(selectedRun.balanceAmount, selectedRun.currencyCode || 'TZS') }}</p>
                                </div>
                            </div>

                            <Card class="rounded-lg border-sidebar-border/70">
                                <CardHeader class="pb-2">
                                    <CardTitle class="text-base">Included invoices</CardTitle>
                                    <CardDescription>Corporate settlement allocates into the real invoice ledger for each invoice below.</CardDescription>
                                </CardHeader>
                                <CardContent class="pt-0">
                                    <div class="overflow-auto">
                                        <table class="w-full text-sm">
                                            <thead>
                                                <tr class="border-b text-left text-xs text-muted-foreground">
                                                    <th class="pb-2 pr-4 font-medium">Invoice</th>
                                                    <th class="pb-2 pr-4 font-medium">Patient</th>
                                                    <th class="pb-2 pr-4 font-medium text-right">Included</th>
                                                    <th class="pb-2 pr-4 font-medium text-right">Outstanding</th>
                                                    <th class="pb-2 pr-4 font-medium">Status</th>
                                                    <th class="pb-2 pr-4 font-medium">Link</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr v-for="invoice in selectedRun.invoices" :key="invoice.id" class="border-b last:border-0">
                                                    <td class="py-2 pr-4 text-xs font-medium">{{ invoice.invoiceNumber || invoice.invoice_number }}</td>
                                                    <td class="py-2 pr-4 text-xs">{{ invoice.patientDisplayName || invoice.patient_display_name || 'Patient unavailable' }}</td>
                                                    <td class="py-2 pr-4 text-right text-xs">{{ formatCurrency(invoice.includedAmount || invoice.included_amount || 0, selectedRun.currencyCode || 'TZS') }}</td>
                                                    <td class="py-2 pr-4 text-right text-xs">{{ formatCurrency(invoice.outstandingAmount || invoice.outstanding_amount || 0, selectedRun.currencyCode || 'TZS') }}</td>
                                                    <td class="py-2 pr-4"><Badge :variant="statusVariant(invoice.status)">{{ formatStatusLabel(invoice.status) }}</Badge></td>
                                                    <td class="py-2 pr-4">
                                                        <Button size="sm" variant="outline" as-child>
                                                            <Link href="/billing-invoices">Open billing</Link>
                                                        </Button>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card class="rounded-lg border-sidebar-border/70">
                                <CardHeader class="pb-2">
                                    <CardTitle class="text-base">Settlement history</CardTitle>
                                </CardHeader>
                                <CardContent class="pt-0 space-y-2">
                                    <div v-if="selectedRun.payments.length === 0" class="text-sm text-muted-foreground">No settlement payments recorded yet.</div>
                                    <div v-for="payment in selectedRun.payments" :key="payment.id" class="rounded-lg border border-sidebar-border/70 p-3 text-sm">
                                        <div class="flex items-center justify-between gap-3">
                                            <div>
                                                <p class="font-medium">{{ formatCurrency(payment.amount, selectedRun.currencyCode || 'TZS') }}</p>
                                                <p class="text-xs text-muted-foreground">{{ formatDate(payment.paidAt || payment.paid_at) }} | {{ formatStatusLabel(payment.paymentMethod || payment.payment_method) }}</p>
                                            </div>
                                            <span class="text-xs text-muted-foreground">{{ payment.paymentReference || payment.payment_reference || 'No reference' }}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>

        <Dialog v-model:open="createAccountDialogOpen">
            <DialogContent class="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create corporate billing account</DialogTitle>
                    <DialogDescription>Attach a payer contract to a dedicated corporate settlement workspace.</DialogDescription>
                </DialogHeader>
                <div class="grid gap-4">
                    <div class="grid gap-2">
                        <BillingPayerContractLookupField
                            input-id="billing-corporate-payer-contract"
                            v-model="createAccountForm.billingPayerContractId"
                            label="Payer contract"
                            helper-text="Search employer, sponsor, or insurer contracts that should settle grouped patient invoices."
                            :payer-types="['employer', 'insurance', 'other']"
                            @selected="handleCorporateContractSelected"
                        />
                    </div>
                    <div class="grid gap-2 sm:grid-cols-2">
                        <div class="grid gap-2"><Label>Account code</Label><Input v-model="createAccountForm.accountCode" placeholder="Optional" /></div>
                        <div class="grid gap-2"><Label>Account name</Label><Input v-model="createAccountForm.accountName" placeholder="Optional override" /></div>
                    </div>
                    <div class="grid gap-2 sm:grid-cols-3">
                        <div class="grid gap-2"><Label>Billing contact</Label><Input v-model="createAccountForm.billingContactName" /></div>
                        <div class="grid gap-2"><Label>Email</Label><Input v-model="createAccountForm.billingContactEmail" type="email" /></div>
                        <div class="grid gap-2"><Label>Phone</Label><Input v-model="createAccountForm.billingContactPhone" /></div>
                    </div>
                    <div class="grid gap-2 sm:grid-cols-2">
                        <div class="grid gap-2"><Label>Billing cycle day</Label><Input v-model="createAccountForm.billingCycleDay" type="number" min="1" max="31" /></div>
                        <div class="grid gap-2"><Label>Settlement terms days</Label><Input v-model="createAccountForm.settlementTermsDays" type="number" min="1" max="365" /></div>
                    </div>
                    <div class="grid gap-2"><Label>Notes</Label><Textarea v-model="createAccountForm.notes" rows="3" /></div>
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="createAccountDialogOpen = false">Cancel</Button>
                    <Button :disabled="actionLoading" @click="submitCreateAccount">{{ actionLoading ? 'Creating...' : 'Create account' }}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="createRunDialogOpen">
            <DialogContent class="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Generate corporate billing run</DialogTitle>
                    <DialogDescription>Pull all eligible open invoices for this contract and period into a consolidated settlement run.</DialogDescription>
                </DialogHeader>
                <div class="grid gap-4">
                    <div class="grid gap-2 sm:grid-cols-2">
                        <div class="grid gap-2"><Label>Period start</Label><Input v-model="createRunForm.billingPeriodStart" type="date" /></div>
                        <div class="grid gap-2"><Label>Period end</Label><Input v-model="createRunForm.billingPeriodEnd" type="date" /></div>
                    </div>
                    <div class="grid gap-2 sm:grid-cols-2">
                        <div class="grid gap-2"><Label>Issue date</Label><Input v-model="createRunForm.issueDate" type="date" /></div>
                        <div class="grid gap-2"><Label>Due date</Label><Input v-model="createRunForm.dueDate" type="date" /></div>
                    </div>
                    <div class="grid gap-2"><Label>Notes</Label><Textarea v-model="createRunForm.notes" rows="3" /></div>
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="createRunDialogOpen = false">Cancel</Button>
                    <Button :disabled="actionLoading" @click="submitCreateRun">{{ actionLoading ? 'Generating...' : 'Generate run' }}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="runPaymentDialogOpen">
            <DialogContent class="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Record corporate settlement</DialogTitle>
                    <DialogDescription>Allocate the settlement payment across the included invoices and update each invoice’s payer ledger.</DialogDescription>
                </DialogHeader>
                <div class="grid gap-4">
                    <div class="grid gap-2 sm:grid-cols-2">
                        <div class="grid gap-2"><Label>Amount</Label><Input v-model="runPaymentForm.amount" type="number" min="0.01" step="0.01" /></div>
                        <div class="grid gap-2">
                            <Label>Method</Label>
                            <Select v-model="runPaymentForm.paymentMethod">
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="mobile_money">Mobile money</SelectItem>
                                    <SelectItem value="card">Card</SelectItem>
                                    <SelectItem value="cheque">Cheque</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div class="grid gap-2"><Label>Reference</Label><Input v-model="runPaymentForm.paymentReference" /></div>
                    <div class="grid gap-2"><Label>Note</Label><Textarea v-model="runPaymentForm.note" rows="3" /></div>
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="runPaymentDialogOpen = false">Cancel</Button>
                    <Button :disabled="actionLoading" @click="submitRunPayment">{{ actionLoading ? 'Posting...' : 'Post settlement' }}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>
