<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
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

type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type ApiError = { message?: string; errors?: Record<string, string[]> };
type PatientLookupSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    phone?: string | null;
};
type CashAccountPatient = {
    id: string | null;
    patient_number: string | null;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    display_name: string | null;
    phone: string | null;
    gender: string | null;
    date_of_birth: string | null;
    status: string | null;
};
type CashAccount = {
    id: string;
    tenant_id: string | null;
    facility_id: string | null;
    patient_id: string | null;
    currency_code: string | null;
    account_balance: number | null;
    total_charged: number | null;
    total_paid: number | null;
    status: string | null;
    notes: string | null;
    patient: CashAccountPatient | null;
    created_at: string | null;
    updated_at: string | null;
};
type CashCharge = {
    id: string;
    cash_billing_account_id: string | null;
    service_name: string | null;
    quantity: number | null;
    unit_price: string | number | null;
    charge_amount: string | number | null;
    charge_date: string | null;
    description: string | null;
};
type CashPayment = {
    id: string;
    amount_paid: number | null;
    currency_code: string | null;
    payment_method: string | null;
    payment_reference: string | null;
    mobile_money_provider: string | null;
    mobile_money_transaction_id: string | null;
    check_number: string | null;
    receipt_number: string | null;
    notes: string | null;
    paid_at: string | null;
    remaining_balance: number | null;
};
type AccountListResponse = { success: boolean; data: CashAccount[]; meta: Pagination };
type AccountDetailResponse = { success: boolean; data: { account: CashAccount; charges: CashCharge[]; payments: CashPayment[] } };
type ItemResponse<T> = { success: boolean; data: T };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing-invoices' },
    { title: 'Cash Billing', href: '/billing-cash' },
];

const { permissionState } = usePlatformAccess();
const canRead = computed(() => permissionState('billing.cash-accounts.read') === 'allowed');
const canManage = computed(() => permissionState('billing.cash-accounts.manage') === 'allowed');

const listLoading = ref(false);
const detailsLoading = ref(false);
const actionLoading = ref(false);
const booting = ref(true);
const pageError = ref<string | null>(null);

const filters = reactive({
    q: '',
    status: 'all',
    page: 1,
    perPage: 20,
});

const accounts = ref<CashAccount[]>([]);
const pagination = ref<Pagination | null>(null);
const selectedAccountId = ref<string | null>(null);
const selectedAccount = ref<CashAccount | null>(null);
const selectedCharges = ref<CashCharge[]>([]);
const selectedPayments = ref<CashPayment[]>([]);

const createDialogOpen = ref(false);
const chargeDialogOpen = ref(false);
const paymentDialogOpen = ref(false);

const createForm = reactive({
    patientId: '',
    currencyCode: 'TZS',
    notes: '',
});
const createPatient = ref<PatientLookupSummary | null>(null);

const chargeForm = reactive({
    serviceName: '',
    quantity: 1,
    unitPrice: '',
    description: '',
});

const paymentForm = reactive({
    amountPaid: '',
    paymentMethod: 'cash',
    paymentReference: '',
    mobileMoneyProvider: '',
    mobileMoneyTransactionId: '',
    cardLastFour: '',
    checkNumber: '',
    notes: '',
});

const paymentMethodOptions = [
    { value: 'cash', label: 'Cash' },
    { value: 'mobile_money', label: 'Mobile money' },
    { value: 'card', label: 'Card' },
    { value: 'check', label: 'Cheque' },
];

const mobileMoneyProviders = ['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'HaloPesa'];

const selectedAccountBalance = computed(() => selectedAccount.value?.account_balance ?? 0);
const selectedAccountCurrency = computed(() => selectedAccount.value?.currency_code ?? 'TZS');
const hasPreviousPage = computed(() => (pagination.value?.currentPage ?? 1) > 1);
const hasNextPage = computed(() => {
    if (!pagination.value) return false;
    return pagination.value.currentPage < pagination.value.lastPage;
});
const accountListSummary = computed(() => {
    const total = pagination.value?.total ?? accounts.value.length;
    const activeCount = accounts.value.filter((account) => account.status === 'active').length;
    const settledCount = accounts.value.filter((account) => account.status === 'settled').length;

    return `${total} accounts in view | ${activeCount} active | ${settledCount} settled`;
});

const leadAccountAction = computed(() => {
    if (!selectedAccount.value) return 'Create or open a cash account to start posting charges.';
    if (selectedAccountBalance.value > 0) return 'Collect payment or continue posting services against this account.';
    return 'This account is balanced. Post a new charge only if new walk-in services are captured.';
});

watch(
    () => filters.status,
    () => {
        filters.page = 1;
        loadAccounts();
    },
);

watch(
    () => filters.perPage,
    () => {
        filters.page = 1;
        loadAccounts(false);
    },
);

function patientDisplayName(patient: CashAccountPatient | null): string {
    if (!patient) return 'Unknown patient';
    return patient.display_name || patient.patient_number || 'Unknown patient';
}

function patientLookupDisplayName(patient: PatientLookupSummary | null): string {
    if (!patient) return 'No patient selected';
    return [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ') || patient.patientNumber || patient.id;
}

function formatCurrency(value: string | number | null | undefined, currency = 'TZS'): string {
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
    if (!value) return 'Not recorded';

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

    return value
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function badgeVariant(status: string | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (status === 'active') return 'default';
    if (status === 'settled') return 'secondary';
    if (status === 'suspended') return 'destructive';
    return 'outline';
}

async function apiRequest<T>(
    method: 'GET' | 'POST',
    path: string,
    options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> },
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);

    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === '' || Number.isNaN(value)) return;
        url.searchParams.set(key, String(value));
    });

    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    let body: string | undefined;
    if (method !== 'GET') {
        await refreshCsrfToken();
        Object.assign(headers, csrfRequestHeaders(), {
            'Content-Type': 'application/json',
        });
        body = JSON.stringify(options?.body ?? {});
    }

    const response = await fetch(url.toString(), {
        method,
        credentials: 'same-origin',
        headers,
        body,
    });

    const payload = (await response.json().catch(() => ({}))) as T & ApiError;
    if (!response.ok) {
        throw new Error(payload.message || `${response.status} ${response.statusText}`);
    }

    return payload;
}

async function loadAccounts(preserveSelection = true) {
    if (!canRead.value) {
        booting.value = false;
        return;
    }

    listLoading.value = true;
    pageError.value = null;

    try {
        const response = await apiRequest<AccountListResponse>('GET', '/cash-patients', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status === 'all' ? null : filters.status,
                page: filters.page,
                perPage: filters.perPage,
            },
        });

        accounts.value = response.data;
        pagination.value = response.meta;

        const currentSelectionStillExists = preserveSelection
            && selectedAccountId.value !== null
            && response.data.some((account) => account.id === selectedAccountId.value);

        if (currentSelectionStillExists) {
            await loadAccountDetails(selectedAccountId.value!);
        } else if (response.data.length > 0) {
            await selectAccount(response.data[0].id);
        } else {
            selectedAccountId.value = null;
            selectedAccount.value = null;
            selectedCharges.value = [];
            selectedPayments.value = [];
        }
    } catch (error) {
        pageError.value = messageFromUnknown(error, 'Unable to load cash billing accounts.');
        notifyError(pageError.value);
    } finally {
        listLoading.value = false;
        booting.value = false;
    }
}

async function loadAccountDetails(accountId: string) {
    detailsLoading.value = true;

    try {
        const response = await apiRequest<AccountDetailResponse>('GET', `/cash-patients/${accountId}`);
        selectedAccountId.value = accountId;
        selectedAccount.value = response.data.account;
        selectedCharges.value = response.data.charges;
        selectedPayments.value = response.data.payments;
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to load account details.'));
    } finally {
        detailsLoading.value = false;
    }
}

async function selectAccount(accountId: string) {
    if (selectedAccountId.value === accountId && selectedAccount.value) return;
    await loadAccountDetails(accountId);
}

function resetCreateForm() {
    createForm.patientId = '';
    createForm.currencyCode = 'TZS';
    createForm.notes = '';
    createPatient.value = null;
}

function resetChargeForm() {
    chargeForm.serviceName = '';
    chargeForm.quantity = 1;
    chargeForm.unitPrice = '';
    chargeForm.description = '';
}

function resetPaymentForm() {
    paymentForm.amountPaid = '';
    paymentForm.paymentMethod = 'cash';
    paymentForm.paymentReference = '';
    paymentForm.mobileMoneyProvider = '';
    paymentForm.mobileMoneyTransactionId = '';
    paymentForm.cardLastFour = '';
    paymentForm.checkNumber = '';
    paymentForm.notes = '';
}

async function submitCreateAccount() {
    if (!canManage.value || !createForm.patientId) return;

    actionLoading.value = true;

    try {
        const response = await apiRequest<ItemResponse<CashAccount>>('POST', '/cash-patients', {
            body: {
                patient_id: createForm.patientId,
                currency_code: createForm.currencyCode.trim().toUpperCase() || 'TZS',
                notes: createForm.notes.trim() || null,
            },
        });

        notifySuccess('Cash billing account is ready.');
        createDialogOpen.value = false;
        resetCreateForm();
        filters.page = 1;
        await loadAccounts(false);
        if (response.data.id) {
            await selectAccount(response.data.id);
        }
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to create cash billing account.'));
    } finally {
        actionLoading.value = false;
    }
}

async function submitCharge() {
    if (!selectedAccountId.value || !canManage.value) return;

    actionLoading.value = true;

    try {
        await apiRequest<ItemResponse<CashCharge>>('POST', `/cash-patients/${selectedAccountId.value}/charges`, {
            body: {
                service_name: chargeForm.serviceName.trim(),
                quantity: chargeForm.quantity,
                unit_price: Number(chargeForm.unitPrice),
                description: chargeForm.description.trim() || null,
            },
        });

        notifySuccess('Charge posted to cash account.');
        chargeDialogOpen.value = false;
        resetChargeForm();
        await loadAccounts();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to post cash charge.'));
    } finally {
        actionLoading.value = false;
    }
}

async function submitPayment() {
    if (!selectedAccountId.value || !canManage.value) return;

    actionLoading.value = true;

    try {
        await apiRequest<ItemResponse<CashPayment>>('POST', `/cash-patients/${selectedAccountId.value}/payments`, {
            body: {
                amount_paid: Number(paymentForm.amountPaid),
                payment_method: paymentForm.paymentMethod,
                payment_reference: paymentForm.paymentReference.trim() || null,
                mobile_money_provider: paymentForm.paymentMethod === 'mobile_money' ? paymentForm.mobileMoneyProvider || null : null,
                mobile_money_transaction_id: paymentForm.paymentMethod === 'mobile_money' ? paymentForm.mobileMoneyTransactionId.trim() || null : null,
                card_last_four: paymentForm.paymentMethod === 'card' ? paymentForm.cardLastFour.trim() || null : null,
                check_number: paymentForm.paymentMethod === 'check' ? paymentForm.checkNumber.trim() || null : null,
                notes: paymentForm.notes.trim() || null,
            },
        });

        notifySuccess('Payment posted to cash account.');
        paymentDialogOpen.value = false;
        resetPaymentForm();
        await loadAccounts();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to post payment.'));
    } finally {
        actionLoading.value = false;
    }
}

onMounted(async () => {
    await loadAccounts(false);
});
</script>

<template>
    <Head title="Cash Billing" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden p-4 md:p-6">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="receipt" class="size-6 text-muted-foreground" />
                        <span>Cash Billing</span>
                    </div>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Walk-in cashier workboard for Tanzania private hospitals: open accounts, post services, and collect payment without jumping across modules.
                    </p>
                    <div class="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">Cash path</Badge>
                        <Badge variant="outline">Mobile money ready</Badge>
                        <Badge variant="outline">Receipt discipline</Badge>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2">
                    <Button variant="outline" class="gap-2" as-child>
                        <a href="/billing-payment-plans">
                            <AppIcon name="calendar-range" class="size-4" />
                            Payment plans
                        </a>
                    </Button>
                    <Button v-if="canManage" class="gap-2" @click="createDialogOpen = true">
                        <AppIcon name="plus" class="size-4" />
                        New cash account
                    </Button>
                    <Button variant="outline" class="gap-2" :disabled="listLoading" @click="loadAccounts()">
                        <AppIcon name="refresh-cw" class="size-4" />
                        Refresh workboard
                    </Button>
                </div>
            </div>

            <Alert v-if="!canRead" variant="destructive" class="rounded-lg">
                <AppIcon name="shield-alert" class="size-4" />
                <AlertTitle>Cash billing access is restricted</AlertTitle>
                <AlertDescription>
                    This account does not have permission to read cash billing accounts.
                </AlertDescription>
            </Alert>

            <Alert v-else class="rounded-lg border-sidebar-border/70">
                <AppIcon name="banknote" class="size-4" />
                <AlertTitle>Cashier execution posture</AlertTitle>
                <AlertDescription>
                    {{ leadAccountAction }}
                </AlertDescription>
            </Alert>

            <div v-if="canRead" class="grid min-h-0 flex-1 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
                <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70">
                    <CardHeader class="gap-3">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <CardTitle>Cash accounts</CardTitle>
                                <CardDescription>{{ accountListSummary }}</CardDescription>
                            </div>
                            <Badge variant="outline">{{ pagination?.total ?? 0 }}</Badge>
                        </div>
                        <div class="grid gap-3">
                            <Input
                                v-model="filters.q"
                                placeholder="Search patient number, name, phone, or note"
                                @keydown.enter.prevent="filters.page = 1; loadAccounts(false)"
                            />
                            <div class="grid gap-3 sm:grid-cols-2">
                                <Select v-model="filters.status">
                                    <SelectTrigger>
                                        <SelectValue placeholder="All statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="settled">Settled</SelectItem>
                                        <SelectItem value="suspended">Suspended</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Button variant="outline" :disabled="listLoading" @click="filters.page = 1; loadAccounts(false)">
                                    Search
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="flex min-h-0 flex-1 flex-col gap-3">
                        <div v-if="pageError" class="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
                            {{ pageError }}
                        </div>

                        <ScrollArea class="min-h-0 flex-1 pr-3">
                            <div class="space-y-3">
                                <template v-if="booting || listLoading">
                                    <div v-for="index in 5" :key="`cash-account-skeleton-${index}`" class="rounded-lg border border-sidebar-border/70 p-3">
                                        <div class="h-4 w-2/3 rounded bg-muted"></div>
                                        <div class="mt-2 h-3 w-1/2 rounded bg-muted"></div>
                                        <div class="mt-3 h-8 w-full rounded bg-muted"></div>
                                    </div>
                                </template>

                                <template v-else-if="accounts.length > 0">
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
                                                <p class="truncate text-sm font-medium">{{ patientDisplayName(account.patient) }}</p>
                                                <p class="truncate text-xs text-muted-foreground">
                                                    {{ account.patient?.patient_number || 'No patient number' }}
                                                    <span v-if="account.patient?.phone"> | {{ account.patient.phone }}</span>
                                                </p>
                                            </div>
                                            <Badge :variant="badgeVariant(account.status)">
                                                {{ formatStatusLabel(account.status) }}
                                            </Badge>
                                        </div>
                                        <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                            <div>
                                                <span class="block text-[11px] uppercase tracking-[0.16em]">Open balance</span>
                                                <span class="text-sm font-semibold text-foreground">
                                                    {{ formatCurrency(account.account_balance, account.currency_code || 'TZS') }}
                                                </span>
                                            </div>
                                            <div>
                                                <span class="block text-[11px] uppercase tracking-[0.16em]">Last activity</span>
                                                <span class="text-sm text-foreground">{{ formatDateTime(account.updated_at) }}</span>
                                            </div>
                                        </div>
                                    </button>
                                </template>

                                <div v-else class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                    No cash billing accounts match the current work filters.
                                </div>
                            </div>
                        </ScrollArea>

                        <div class="flex flex-col gap-3 border-t border-sidebar-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
                            <div class="flex items-center gap-2">
                                <span class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Rows</span>
                                <Select :model-value="String(filters.perPage)" @update:model-value="(value) => (filters.perPage = Number(value) || 20)">
                                    <SelectTrigger class="w-[7.5rem]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10 per page</SelectItem>
                                        <SelectItem value="20">20 per page</SelectItem>
                                        <SelectItem value="50">50 per page</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div class="flex items-center justify-between gap-2 sm:justify-end">
                                <p class="text-xs text-muted-foreground">
                                    Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                                </p>
                                <div class="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        :disabled="listLoading || !hasPreviousPage"
                                        @click="filters.page -= 1; loadAccounts(false)"
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        :disabled="listLoading || !hasNextPage"
                                        @click="filters.page += 1; loadAccounts(false)"
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div class="flex min-h-0 flex-col gap-4">
                    <template v-if="selectedAccount">
                        <Card class="rounded-lg border-sidebar-border/70">
                            <CardHeader class="gap-3">
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="min-w-0">
                                        <CardTitle class="truncate">{{ patientDisplayName(selectedAccount.patient) }}</CardTitle>
                                        <CardDescription class="mt-1">
                                            {{ selectedAccount.patient?.patient_number || 'No patient number' }}
                                            <span v-if="selectedAccount.patient?.phone"> | {{ selectedAccount.patient.phone }}</span>
                                        </CardDescription>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Badge :variant="badgeVariant(selectedAccount.status)">
                                            {{ formatStatusLabel(selectedAccount.status) }}
                                        </Badge>
                                        <Badge variant="outline">{{ selectedAccount.currency_code || 'TZS' }}</Badge>
                                    </div>
                                </div>

                                <div class="grid gap-3 sm:grid-cols-3">
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Open balance</p>
                                        <p class="mt-1 text-lg font-semibold">
                                            {{ formatCurrency(selectedAccount.account_balance, selectedAccount.currency_code || 'TZS') }}
                                        </p>
                                    </div>
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total charged</p>
                                        <p class="mt-1 text-lg font-semibold">
                                            {{ formatCurrency(selectedAccount.total_charged, selectedAccount.currency_code || 'TZS') }}
                                        </p>
                                    </div>
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total paid</p>
                                        <p class="mt-1 text-lg font-semibold">
                                            {{ formatCurrency(selectedAccount.total_paid, selectedAccount.currency_code || 'TZS') }}
                                        </p>
                                    </div>
                                </div>

                                <div class="flex flex-wrap gap-2" v-if="canManage">
                                    <Button class="gap-2" @click="chargeDialogOpen = true">
                                        <AppIcon name="plus" class="size-4" />
                                        Record charge
                                    </Button>
                                    <Button variant="outline" class="gap-2" as-child>
                                        <a :href="`/billing-payment-plans?cashBillingAccountId=${selectedAccount.id}`">
                                            <AppIcon name="calendar-range" class="size-4" />
                                            Payment plan
                                        </a>
                                    </Button>
                                    <Button variant="outline" class="gap-2" @click="paymentDialogOpen = true">
                                        <AppIcon name="banknote" class="size-4" />
                                        Record payment
                                    </Button>
                                </div>
                            </CardHeader>
                        </Card>

                        <div class="grid min-h-0 gap-4 xl:grid-cols-2">
                            <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70">
                                <CardHeader>
                                    <CardTitle>Charges</CardTitle>
                                    <CardDescription>Services posted against this walk-in cash account.</CardDescription>
                                </CardHeader>
                                <CardContent class="min-h-0 flex-1">
                                    <ScrollArea class="h-[24rem] pr-3">
                                        <div class="space-y-3">
                                            <template v-if="detailsLoading">
                                                <div v-for="index in 4" :key="`cash-charge-skeleton-${index}`" class="rounded-lg border border-sidebar-border/70 p-3">
                                                    <div class="h-4 w-2/3 rounded bg-muted"></div>
                                                    <div class="mt-2 h-3 w-1/2 rounded bg-muted"></div>
                                                </div>
                                            </template>
                                            <template v-else-if="selectedCharges.length > 0">
                                                <div v-for="charge in selectedCharges" :key="charge.id" class="rounded-lg border border-sidebar-border/70 p-3">
                                                    <div class="flex items-start justify-between gap-3">
                                                        <div class="min-w-0">
                                                            <p class="truncate text-sm font-medium">{{ charge.service_name || 'Service charge' }}</p>
                                                            <p class="mt-1 text-xs text-muted-foreground">
                                                                Qty {{ charge.quantity ?? 0 }} | Unit {{ formatCurrency(charge.unit_price, selectedAccount.currency_code || 'TZS') }}
                                                            </p>
                                                        </div>
                                                        <p class="text-sm font-semibold">
                                                            {{ formatCurrency(charge.charge_amount, selectedAccount.currency_code || 'TZS') }}
                                                        </p>
                                                    </div>
                                                    <p v-if="charge.description" class="mt-2 text-xs text-muted-foreground">{{ charge.description }}</p>
                                                    <p class="mt-2 text-[11px] text-muted-foreground">{{ formatDateTime(charge.charge_date) }}</p>
                                                </div>
                                            </template>
                                            <div v-else class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                                No charges have been posted to this account yet.
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>

                            <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70">
                                <CardHeader>
                                    <CardTitle>Payments</CardTitle>
                                    <CardDescription>Cashier collection history and receipt trail.</CardDescription>
                                </CardHeader>
                                <CardContent class="min-h-0 flex-1">
                                    <ScrollArea class="h-[24rem] pr-3">
                                        <div class="space-y-3">
                                            <template v-if="detailsLoading">
                                                <div v-for="index in 4" :key="`cash-payment-skeleton-${index}`" class="rounded-lg border border-sidebar-border/70 p-3">
                                                    <div class="h-4 w-2/3 rounded bg-muted"></div>
                                                    <div class="mt-2 h-3 w-1/2 rounded bg-muted"></div>
                                                </div>
                                            </template>
                                            <template v-else-if="selectedPayments.length > 0">
                                                <div v-for="payment in selectedPayments" :key="payment.id" class="rounded-lg border border-sidebar-border/70 p-3">
                                                    <div class="flex items-start justify-between gap-3">
                                                        <div class="min-w-0">
                                                            <p class="truncate text-sm font-medium">
                                                                {{ formatStatusLabel(payment.payment_method) }}
                                                                <span v-if="payment.receipt_number"> | {{ payment.receipt_number }}</span>
                                                            </p>
                                                            <p class="mt-1 text-xs text-muted-foreground">
                                                                <span v-if="payment.mobile_money_provider">{{ payment.mobile_money_provider }} | </span>
                                                                <span v-if="payment.payment_reference">{{ payment.payment_reference }}</span>
                                                                <span v-else-if="payment.mobile_money_transaction_id">{{ payment.mobile_money_transaction_id }}</span>
                                                                <span v-else-if="payment.check_number">{{ payment.check_number }}</span>
                                                                <span v-else>Manual cashier post</span>
                                                            </p>
                                                        </div>
                                                        <p class="text-sm font-semibold">
                                                            {{ formatCurrency(payment.amount_paid, payment.currency_code || selectedAccount.currency_code || 'TZS') }}
                                                        </p>
                                                    </div>
                                                    <p v-if="payment.notes" class="mt-2 text-xs text-muted-foreground">{{ payment.notes }}</p>
                                                    <p class="mt-2 text-[11px] text-muted-foreground">{{ formatDateTime(payment.paid_at) }}</p>
                                                </div>
                                            </template>
                                            <div v-else class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                                No payments have been posted to this account yet.
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>

                        <Card v-if="selectedAccount.notes" class="rounded-lg border-sidebar-border/70">
                            <CardHeader>
                                <CardTitle>Cash account notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p class="text-sm text-muted-foreground">{{ selectedAccount.notes }}</p>
                            </CardContent>
                        </Card>
                    </template>

                    <Card v-else class="rounded-lg border-sidebar-border/70">
                        <CardContent class="flex min-h-[24rem] flex-col items-center justify-center gap-3 text-center">
                            <AppIcon name="receipt" class="size-8 text-muted-foreground" />
                            <div>
                                <p class="text-base font-medium">No cash account selected</p>
                                <p class="mt-1 text-sm text-muted-foreground">
                                    Choose an account from the workboard or open a new one for a walk-in patient.
                                </p>
                            </div>
                            <Button v-if="canManage" @click="createDialogOpen = true">New cash account</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>

        <Dialog :open="createDialogOpen" @update:open="createDialogOpen = $event">
            <DialogContent class="rounded-lg sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Open cash billing account</DialogTitle>
                    <DialogDescription>
                        Start or continue a walk-in patient cash account for immediate cashier posting.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-4 py-2">
                    <PatientLookupField
                        input-id="cash-billing-create-patient"
                        v-model="createForm.patientId"
                        label="Patient"
                        helper-text="Select the walk-in patient who will use this cash account."
                        @selected="createPatient = $event"
                    />

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="cash-billing-create-currency">Currency</Label>
                            <Input id="cash-billing-create-currency" v-model="createForm.currencyCode" maxlength="3" />
                        </div>
                        <div class="rounded-lg border border-sidebar-border/70 p-3 text-sm text-muted-foreground">
                            <p class="text-xs uppercase tracking-[0.16em]">Selected patient</p>
                            <p class="mt-1 font-medium text-foreground">{{ patientLookupDisplayName(createPatient) }}</p>
                        </div>
                    </div>

                    <div class="grid gap-2">
                        <Label for="cash-billing-create-notes">Notes</Label>
                        <Textarea
                            id="cash-billing-create-notes"
                            v-model="createForm.notes"
                            rows="3"
                            placeholder="Optional cashier note, contract exception, or walk-in context"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" :disabled="actionLoading" @click="createDialogOpen = false">Cancel</Button>
                    <Button :disabled="actionLoading || !createForm.patientId" @click="submitCreateAccount">Open account</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog :open="chargeDialogOpen" @update:open="chargeDialogOpen = $event">
            <DialogContent class="rounded-lg sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Record cash charge</DialogTitle>
                    <DialogDescription>
                        Post service cost to the selected cash account before or alongside collection.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-4 py-2">
                    <div class="grid gap-2">
                        <Label for="cash-charge-service">Service name</Label>
                        <Input id="cash-charge-service" v-model="chargeForm.serviceName" placeholder="Consultation, dressing, scan, lab bundle" />
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="cash-charge-quantity">Quantity</Label>
                            <Input id="cash-charge-quantity" v-model.number="chargeForm.quantity" type="number" min="1" step="1" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="cash-charge-unit-price">Unit price</Label>
                            <Input id="cash-charge-unit-price" v-model="chargeForm.unitPrice" inputmode="decimal" placeholder="0.00" />
                        </div>
                    </div>

                    <div class="rounded-lg border border-sidebar-border/70 p-3 text-sm text-muted-foreground">
                        <p class="text-xs uppercase tracking-[0.16em]">Projected charge</p>
                        <p class="mt-1 text-lg font-semibold text-foreground">
                            {{ formatCurrency(Number(chargeForm.unitPrice || 0) * Number(chargeForm.quantity || 0), selectedAccountCurrency) }}
                        </p>
                    </div>

                    <div class="grid gap-2">
                        <Label for="cash-charge-description">Posting note</Label>
                        <Textarea
                            id="cash-charge-description"
                            v-model="chargeForm.description"
                            rows="3"
                            placeholder="Optional service explanation or cashier note"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" :disabled="actionLoading" @click="chargeDialogOpen = false">Cancel</Button>
                    <Button
                        :disabled="actionLoading || !chargeForm.serviceName.trim() || Number(chargeForm.quantity) < 1 || Number(chargeForm.unitPrice) <= 0"
                        @click="submitCharge"
                    >
                        Post charge
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog :open="paymentDialogOpen" @update:open="paymentDialogOpen = $event">
            <DialogContent class="rounded-lg sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Record cash payment</DialogTitle>
                    <DialogDescription>
                        Post patient collection with Tanzania-ready cashier proof rules.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-4 py-2">
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="cash-payment-amount">Amount received</Label>
                            <Input id="cash-payment-amount" v-model="paymentForm.amountPaid" inputmode="decimal" placeholder="0.00" />
                        </div>
                        <div class="grid gap-2">
                            <Label>Payment method</Label>
                            <Select v-model="paymentForm.paymentMethod">
                                <SelectTrigger>
                                    <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="option in paymentMethodOptions" :key="option.value" :value="option.value">
                                        {{ option.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div v-if="paymentForm.paymentMethod === 'mobile_money'" class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label>Mobile money provider</Label>
                            <Select v-model="paymentForm.mobileMoneyProvider">
                                <SelectTrigger>
                                    <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="provider in mobileMoneyProviders" :key="provider" :value="provider">
                                        {{ provider }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="grid gap-2">
                            <Label for="cash-payment-mobile-ref">Transaction ID</Label>
                            <Input id="cash-payment-mobile-ref" v-model="paymentForm.mobileMoneyTransactionId" placeholder="M-Pesa or telecom reference" />
                        </div>
                    </div>

                    <div v-else-if="paymentForm.paymentMethod === 'card'" class="grid gap-2">
                        <Label for="cash-payment-card-last-four">Card last four</Label>
                        <Input id="cash-payment-card-last-four" v-model="paymentForm.cardLastFour" maxlength="4" placeholder="1234" />
                    </div>

                    <div v-else-if="paymentForm.paymentMethod === 'check'" class="grid gap-2">
                        <Label for="cash-payment-check-number">Cheque number</Label>
                        <Input id="cash-payment-check-number" v-model="paymentForm.checkNumber" placeholder="Cheque or bank proof number" />
                    </div>

                    <div class="grid gap-2">
                        <Label for="cash-payment-reference">Receipt or control reference</Label>
                        <Input id="cash-payment-reference" v-model="paymentForm.paymentReference" placeholder="Receipt number, control number, or cashier note ref" />
                    </div>

                    <div class="rounded-lg border border-sidebar-border/70 p-3 text-sm text-muted-foreground">
                        <p class="text-xs uppercase tracking-[0.16em]">Posting snapshot</p>
                        <p class="mt-1 text-lg font-semibold text-foreground">
                            {{ formatCurrency(paymentForm.amountPaid, selectedAccountCurrency) }}
                        </p>
                        <p class="mt-1 text-xs">
                            Remaining after post:
                            {{ formatCurrency(Math.max(0, selectedAccountBalance - Number(paymentForm.amountPaid || 0)), selectedAccountCurrency) }}
                        </p>
                    </div>

                    <div class="grid gap-2">
                        <Label for="cash-payment-notes">Posting note</Label>
                        <Textarea
                            id="cash-payment-notes"
                            v-model="paymentForm.notes"
                            rows="3"
                            placeholder="Optional cashier note, waiver justification, or proof handoff note"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" :disabled="actionLoading" @click="paymentDialogOpen = false">Cancel</Button>
                    <Button
                        :disabled="actionLoading || Number(paymentForm.amountPaid) <= 0"
                        @click="submitPayment"
                    >
                        Post payment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>
