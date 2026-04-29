<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import BillingInvoiceLookupField from '@/components/billing/BillingInvoiceLookupField.vue';
import CashBillingAccountLookupField from '@/components/billing/CashBillingAccountLookupField.vue';
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
type PlanInstallment = {
    id: string;
    installmentNumber: number | null;
    dueDate: string | null;
    scheduledAmount: number | null;
    paidAmount: number | null;
    outstandingAmount: number | null;
    paidAt: string | null;
    status: string | null;
};
type PaymentPlan = {
    id: string;
    patientId: string | null;
    billingInvoiceId: string | null;
    cashBillingAccountId: string | null;
    planNumber: string | null;
    planName: string | null;
    currencyCode: string | null;
    totalAmount: number | null;
    downPaymentAmount: number | null;
    financedAmount: number | null;
    paidAmount: number | null;
    balanceAmount: number | null;
    installmentCount: number | null;
    installmentFrequency: string | null;
    firstDueDate: string | null;
    nextDueDate: string | null;
    lastPaymentAt: string | null;
    status: string | null;
    termsAndNotes: string | null;
    invoiceNumber: string | null;
    patient?: { patientNumber: string | null; displayName: string | null } | null;
    installments: PlanInstallment[];
};
type ApiListResponse<T> = { success: boolean; data: T[]; meta: Pagination };
type ApiItemResponse<T> = { success: boolean; data: T };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing-invoices' },
    { title: 'Payment Plans', href: '/billing-payment-plans' },
];

const { permissionState } = usePlatformAccess();
const canRead = computed(() => permissionState('billing.invoices.read') === 'allowed');
const canManage = computed(() => permissionState('billing.payments.record') === 'allowed');

const loading = ref(false);
const detailLoading = ref(false);
const actionLoading = ref(false);
const pageError = ref<string | null>(null);
const plans = ref<PaymentPlan[]>([]);
const pagination = ref<Pagination | null>(null);
const selectedPlanId = ref<string | null>(null);
const selectedPlan = ref<PaymentPlan | null>(null);
const createDialogOpen = ref(false);
const paymentDialogOpen = ref(false);

const filters = reactive({ q: '', status: 'all', page: 1, perPage: 15 });
const createForm = reactive({
    sourceType: 'invoice',
    billingInvoiceId: '',
    cashBillingAccountId: '',
    planName: '',
    totalAmount: '',
    downPaymentAmount: '',
    downPaymentPaymentMethod: 'cash',
    downPaymentReference: '',
    payerType: 'self_pay',
    installmentCount: '3',
    installmentFrequency: 'monthly',
    installmentIntervalDays: '',
    firstDueDate: '',
    termsAndNotes: '',
});
const paymentForm = reactive({ amount: '', paymentMethod: 'cash', paymentReference: '', note: '' });

const selectedSourceHref = computed(() => {
    if (!selectedPlan.value) return null;
    if (selectedPlan.value.billingInvoiceId) return '/billing-invoices';
    if (selectedPlan.value.cashBillingAccountId) return '/billing-cash';
    return null;
});

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
    const numeric = Number(value ?? 0);
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(numeric);
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
    if (status === 'completed') return 'secondary';
    if (status === 'defaulted') return 'destructive';
    if (status === 'partially_paid' || status === 'active') return 'default';
    return 'outline';
}

async function loadPlans(focusSelected = true): Promise<void> {
    if (!canRead.value) return;
    loading.value = true;
    pageError.value = null;
    try {
        const response = await apiRequest<ApiListResponse<PaymentPlan>>('GET', '/billing-payment-plans', {
            query: { q: filters.q, status: filters.status, page: filters.page, perPage: filters.perPage },
        });
        plans.value = response.data;
        pagination.value = response.meta;
        if (plans.value.length === 0) {
            selectedPlanId.value = null;
            selectedPlan.value = null;
            return;
        }
        const targetId = focusSelected && selectedPlanId.value && plans.value.some((item) => item.id === selectedPlanId.value)
            ? selectedPlanId.value
            : plans.value[0].id;
        await loadPlan(targetId);
    } catch (error) {
        pageError.value = messageFromUnknown(error, 'Unable to load payment plans.');
        notifyError(pageError.value);
    } finally {
        loading.value = false;
    }
}

async function loadPlan(id: string): Promise<void> {
    detailLoading.value = true;
    try {
        const response = await apiRequest<ApiItemResponse<PaymentPlan>>('GET', `/billing-payment-plans/${id}`);
        selectedPlan.value = response.data;
        selectedPlanId.value = response.data.id;
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to load the selected payment plan.'));
    } finally {
        detailLoading.value = false;
    }
}

async function submitCreatePlan(): Promise<void> {
    if (!canManage.value) return;
    actionLoading.value = true;
    try {
        await apiRequest<ApiItemResponse<PaymentPlan>>('POST', '/billing-payment-plans', {
            body: {
                billingInvoiceId: createForm.sourceType === 'invoice' ? createForm.billingInvoiceId : null,
                cashBillingAccountId: createForm.sourceType === 'cash' ? createForm.cashBillingAccountId : null,
                planName: createForm.planName || null,
                totalAmount: createForm.totalAmount || null,
                downPaymentAmount: createForm.downPaymentAmount || 0,
                downPaymentPaymentMethod: createForm.downPaymentPaymentMethod,
                downPaymentReference: createForm.downPaymentReference || null,
                payerType: createForm.payerType,
                installmentCount: Number(createForm.installmentCount),
                installmentFrequency: createForm.installmentFrequency,
                installmentIntervalDays: createForm.installmentFrequency === 'custom' ? Number(createForm.installmentIntervalDays || 0) : null,
                firstDueDate: createForm.firstDueDate,
                termsAndNotes: createForm.termsAndNotes || null,
            },
        });
        createDialogOpen.value = false;
        notifySuccess('Payment plan created.');
        await loadPlans(false);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to create payment plan.'));
    } finally {
        actionLoading.value = false;
    }
}

async function submitPlanPayment(): Promise<void> {
    if (!selectedPlan.value || !canManage.value) return;
    actionLoading.value = true;
    try {
        const response = await apiRequest<ApiItemResponse<PaymentPlan>>('POST', `/billing-payment-plans/${selectedPlan.value.id}/payments`, {
            body: {
                amount: Number(paymentForm.amount),
                paymentMethod: paymentForm.paymentMethod,
                paymentReference: paymentForm.paymentReference || null,
                note: paymentForm.note || null,
            },
        });
        selectedPlan.value = response.data;
        paymentDialogOpen.value = false;
        paymentForm.amount = '';
        paymentForm.paymentReference = '';
        paymentForm.note = '';
        notifySuccess('Payment posted to the plan and linked billing source.');
        await loadPlans(false);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to record payment for the selected plan.'));
    } finally {
        actionLoading.value = false;
    }
}

onMounted(() => {
    const params = new URLSearchParams(window.location.search);
    const invoiceId = params.get('billingInvoiceId');
    const cashBillingAccountId = params.get('cashBillingAccountId');
    if (invoiceId) {
        createForm.sourceType = 'invoice';
        createForm.billingInvoiceId = invoiceId;
        createDialogOpen.value = true;
    }
    if (cashBillingAccountId) {
        createForm.sourceType = 'cash';
        createForm.cashBillingAccountId = cashBillingAccountId;
        createDialogOpen.value = true;
    }
    void loadPlans();
});
</script>

<template>
    <Head title="Payment Plans" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden p-4 md:p-6">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="calendar-range" class="size-7 text-primary" />
                        <span>Payment Plans</span>
                    </div>
                    <p class="mt-1 max-w-3xl text-sm text-muted-foreground">
                        Structure installment recovery for private-hospital invoices and walk-in cash balances, while posting every collected amount through the existing billing or cashier ledger.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Button variant="outline" as-child>
                        <Link href="/billing-invoices">Billing Invoices</Link>
                    </Button>
                    <Button variant="outline" as-child>
                        <Link href="/billing-cash">Cash Billing</Link>
                    </Button>
                    <Button variant="outline" as-child>
                        <Link href="/billing-corporate">Corporate Billing</Link>
                    </Button>
                    <Button v-if="canManage" class="gap-1.5" @click="createDialogOpen = true">
                        <AppIcon name="plus" class="size-4" />
                        New plan
                    </Button>
                    <Button variant="outline" :disabled="loading" @click="loadPlans()">Refresh</Button>
                </div>
            </div>

            <Alert v-if="pageError" variant="destructive" class="rounded-lg">
                <AppIcon name="shield-alert" class="size-4" />
                <AlertTitle>Payment plan workspace unavailable</AlertTitle>
                <AlertDescription>{{ pageError }}</AlertDescription>
            </Alert>

            <div class="grid min-h-0 flex-1 gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
                <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70">
                    <CardHeader class="gap-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <CardTitle>Open plans</CardTitle>
                                <CardDescription>{{ pagination?.total ?? plans.length }} plans in scope</CardDescription>
                            </div>
                            <Badge variant="outline">{{ pagination?.total ?? 0 }}</Badge>
                        </div>
                        <div class="grid gap-3">
                            <Input v-model="filters.q" placeholder="Search plan, patient, invoice" @keydown.enter.prevent="filters.page = 1; loadPlans(false)" />
                            <div class="grid gap-3 sm:grid-cols-2">
                                <Select v-model="filters.status">
                                    <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="partially_paid">Partially paid</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="defaulted">Defaulted</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" :disabled="loading" @click="filters.page = 1; loadPlans(false)">Search</Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="min-h-0 flex-1 space-y-3 overflow-y-auto">
                        <div v-if="loading" class="space-y-3">
                            <div v-for="index in 4" :key="index" class="rounded-lg border border-sidebar-border/70 p-3">
                                <div class="h-4 w-1/2 rounded bg-muted"></div>
                                <div class="mt-2 h-3 w-2/3 rounded bg-muted"></div>
                            </div>
                        </div>
                        <button
                            v-for="plan in plans"
                            :key="plan.id"
                            type="button"
                            class="w-full rounded-lg border p-3 text-left transition-colors"
                            :class="plan.id === selectedPlanId ? 'border-primary bg-primary/5' : 'border-sidebar-border/70 hover:bg-muted/50'"
                            @click="loadPlan(plan.id)"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <p class="truncate text-sm font-medium">{{ plan.planName || plan.planNumber }}</p>
                                    <p class="truncate text-xs text-muted-foreground">{{ plan.patient?.displayName || plan.patient?.patientNumber || 'Unlinked patient' }}</p>
                                </div>
                                <Badge :variant="statusVariant(plan.status)">{{ formatStatusLabel(plan.status) }}</Badge>
                            </div>
                            <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                <div>
                                    <span class="block text-[11px] uppercase tracking-[0.16em]">Outstanding</span>
                                    <span class="text-sm font-semibold text-foreground">{{ formatCurrency(plan.balanceAmount, plan.currencyCode || 'TZS') }}</span>
                                </div>
                                <div>
                                    <span class="block text-[11px] uppercase tracking-[0.16em]">Next due</span>
                                    <span class="text-sm text-foreground">{{ formatDate(plan.nextDueDate) }}</span>
                                </div>
                            </div>
                        </button>
                    </CardContent>
                </Card>

                <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70">
                    <CardHeader v-if="selectedPlan" class="gap-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div class="min-w-0">
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="calendar-range" class="size-5 text-muted-foreground" />
                                    {{ selectedPlan.planName || selectedPlan.planNumber }}
                                </CardTitle>
                                <CardDescription>
                                    {{ selectedPlan.patient?.displayName || selectedPlan.patient?.patientNumber || 'Patient unavailable' }}
                                    <span v-if="selectedPlan.invoiceNumber"> | {{ selectedPlan.invoiceNumber }}</span>
                                </CardDescription>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                <Badge :variant="statusVariant(selectedPlan.status)">{{ formatStatusLabel(selectedPlan.status) }}</Badge>
                                <Button v-if="selectedSourceHref" size="sm" variant="outline" as-child>
                                    <Link :href="selectedSourceHref">Open source workflow</Link>
                                </Button>
                                <Button v-if="canManage" size="sm" class="gap-1.5" @click="paymentDialogOpen = true">
                                    <AppIcon name="banknote" class="size-3.5" />
                                    Record payment
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="min-h-0 flex-1 overflow-y-auto pt-0">
                        <div v-if="detailLoading" class="py-8 text-sm text-muted-foreground">Loading payment plan...</div>
                        <div v-else-if="!selectedPlan" class="py-8 text-sm text-muted-foreground">Select a payment plan to review installment status and settlement progress.</div>
                        <div v-else class="space-y-4">
                            <div class="grid gap-3 md:grid-cols-4">
                                <div class="rounded-lg border border-sidebar-border/70 p-3">
                                    <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Plan total</p>
                                    <p class="mt-2 text-lg font-semibold">{{ formatCurrency(selectedPlan.totalAmount, selectedPlan.currencyCode || 'TZS') }}</p>
                                </div>
                                <div class="rounded-lg border border-sidebar-border/70 p-3">
                                    <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Collected</p>
                                    <p class="mt-2 text-lg font-semibold">{{ formatCurrency(selectedPlan.paidAmount, selectedPlan.currencyCode || 'TZS') }}</p>
                                </div>
                                <div class="rounded-lg border border-sidebar-border/70 p-3">
                                    <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Outstanding</p>
                                    <p class="mt-2 text-lg font-semibold">{{ formatCurrency(selectedPlan.balanceAmount, selectedPlan.currencyCode || 'TZS') }}</p>
                                </div>
                                <div class="rounded-lg border border-sidebar-border/70 p-3">
                                    <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Installments</p>
                                    <p class="mt-2 text-lg font-semibold">{{ selectedPlan.installmentCount || 0 }}</p>
                                </div>
                            </div>

                            <Card class="rounded-lg border-sidebar-border/70">
                                <CardHeader class="pb-2">
                                    <CardTitle class="text-base">Installment schedule</CardTitle>
                                    <CardDescription>Each payment updates the linked invoice or cash balance first, then allocates against the schedule below.</CardDescription>
                                </CardHeader>
                                <CardContent class="pt-0">
                                    <div class="overflow-auto">
                                        <table class="w-full text-sm">
                                            <thead>
                                                <tr class="border-b text-left text-xs text-muted-foreground">
                                                    <th class="pb-2 pr-4 font-medium">#</th>
                                                    <th class="pb-2 pr-4 font-medium">Due date</th>
                                                    <th class="pb-2 pr-4 font-medium text-right">Scheduled</th>
                                                    <th class="pb-2 pr-4 font-medium text-right">Paid</th>
                                                    <th class="pb-2 pr-4 font-medium text-right">Outstanding</th>
                                                    <th class="pb-2 pr-4 font-medium">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr v-for="installment in selectedPlan.installments" :key="installment.id" class="border-b last:border-0">
                                                    <td class="py-2 pr-4 text-xs font-medium">{{ installment.installmentNumber }}</td>
                                                    <td class="py-2 pr-4 text-xs">{{ formatDate(installment.dueDate) }}</td>
                                                    <td class="py-2 pr-4 text-right text-xs">{{ formatCurrency(installment.scheduledAmount, selectedPlan.currencyCode || 'TZS') }}</td>
                                                    <td class="py-2 pr-4 text-right text-xs">{{ formatCurrency(installment.paidAmount, selectedPlan.currencyCode || 'TZS') }}</td>
                                                    <td class="py-2 pr-4 text-right text-xs">{{ formatCurrency(installment.outstandingAmount, selectedPlan.currencyCode || 'TZS') }}</td>
                                                    <td class="py-2 pr-4"><Badge :variant="statusVariant(installment.status)">{{ formatStatusLabel(installment.status) }}</Badge></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card v-if="selectedPlan.termsAndNotes" class="rounded-lg border-sidebar-border/70">
                                <CardHeader class="pb-2"><CardTitle class="text-base">Terms</CardTitle></CardHeader>
                                <CardContent class="pt-0 text-sm text-muted-foreground">{{ selectedPlan.termsAndNotes }}</CardContent>
                            </Card>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>

        <Dialog v-model:open="createDialogOpen">
            <DialogContent class="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create payment plan</DialogTitle>
                    <DialogDescription>Link the plan to an existing invoice or cash account so every collection flows through the current billing ledger.</DialogDescription>
                </DialogHeader>
                <div class="grid gap-4">
                    <div class="grid gap-2 sm:grid-cols-3">
                        <div class="grid gap-2">
                            <Label>Source type</Label>
                            <Select v-model="createForm.sourceType">
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="invoice">Billing invoice</SelectItem>
                                    <SelectItem value="cash">Cash billing account</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <BillingInvoiceLookupField
                            v-if="createForm.sourceType === 'invoice'"
                            input-id="billing-payment-plan-invoice"
                            v-model="createForm.billingInvoiceId"
                            label="Billing invoice"
                            helper-text="Search issued or partially paid invoices and attach this plan to the open balance."
                            :statuses="['issued', 'partially_paid']"
                            class="sm:col-span-2"
                        />
                        <CashBillingAccountLookupField
                            v-else
                            input-id="billing-payment-plan-cash-account"
                            v-model="createForm.cashBillingAccountId"
                            label="Cash billing account"
                            helper-text="Search the cashier workboard and attach the plan to the selected walk-in account balance."
                            class="sm:col-span-2"
                        />
                    </div>
                    <div class="grid gap-2 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label>Plan name</Label>
                            <Input v-model="createForm.planName" placeholder="Optional plan label" />
                        </div>
                        <div class="grid gap-2">
                            <Label>Total amount</Label>
                            <Input v-model="createForm.totalAmount" type="number" min="0" step="0.01" placeholder="Leave blank to use full open balance" />
                        </div>
                    </div>
                    <div class="grid gap-2 sm:grid-cols-4">
                        <div class="grid gap-2">
                            <Label>Down payment</Label>
                            <Input v-model="createForm.downPaymentAmount" type="number" min="0" step="0.01" />
                        </div>
                        <div class="grid gap-2">
                            <Label>Method</Label>
                            <Select v-model="createForm.downPaymentPaymentMethod">
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="mobile_money">Mobile money</SelectItem>
                                    <SelectItem value="card">Card</SelectItem>
                                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                                    <SelectItem value="cheque">Cheque</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="grid gap-2">
                            <Label>Payer type</Label>
                            <Select v-model="createForm.payerType">
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="self_pay">Self pay</SelectItem>
                                    <SelectItem value="employer">Employer</SelectItem>
                                    <SelectItem value="insurance">Insurance</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="grid gap-2">
                            <Label>Reference</Label>
                            <Input v-model="createForm.downPaymentReference" placeholder="Optional reference" />
                        </div>
                    </div>
                    <div class="grid gap-2 sm:grid-cols-4">
                        <div class="grid gap-2">
                            <Label>Installments</Label>
                            <Input v-model="createForm.installmentCount" type="number" min="1" max="60" />
                        </div>
                        <div class="grid gap-2">
                            <Label>Frequency</Label>
                            <Select v-model="createForm.installmentFrequency">
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="biweekly">Biweekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="quarterly">Quarterly</SelectItem>
                                    <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="grid gap-2">
                            <Label>Custom interval days</Label>
                            <Input v-model="createForm.installmentIntervalDays" :disabled="createForm.installmentFrequency !== 'custom'" type="number" min="1" max="365" />
                        </div>
                        <div class="grid gap-2">
                            <Label>First due date</Label>
                            <Input v-model="createForm.firstDueDate" type="date" />
                        </div>
                    </div>
                    <div class="grid gap-2">
                        <Label>Terms and notes</Label>
                        <Textarea v-model="createForm.termsAndNotes" rows="3" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="createDialogOpen = false">Cancel</Button>
                    <Button :disabled="actionLoading" @click="submitCreatePlan">{{ actionLoading ? 'Creating...' : 'Create plan' }}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="paymentDialogOpen">
            <DialogContent class="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Record installment payment</DialogTitle>
                    <DialogDescription>Post the payment to the linked billing source, then allocate it across the open installment schedule.</DialogDescription>
                </DialogHeader>
                <div class="grid gap-4">
                    <div class="grid gap-2 sm:grid-cols-3">
                        <div class="grid gap-2">
                            <Label>Amount</Label>
                            <Input v-model="paymentForm.amount" type="number" min="0.01" step="0.01" />
                        </div>
                        <div class="grid gap-2 sm:col-span-2">
                            <Label>Method</Label>
                            <Select v-model="paymentForm.paymentMethod">
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="mobile_money">Mobile money</SelectItem>
                                    <SelectItem value="card">Card</SelectItem>
                                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                                    <SelectItem value="cheque">Cheque</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div class="grid gap-2">
                        <Label>Reference</Label>
                        <Input v-model="paymentForm.paymentReference" placeholder="Optional payment reference" />
                    </div>
                    <div class="grid gap-2">
                        <Label>Note</Label>
                        <Textarea v-model="paymentForm.note" rows="3" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="paymentDialogOpen = false">Cancel</Button>
                    <Button :disabled="actionLoading" @click="submitPlanPayment">{{ actionLoading ? 'Posting...' : 'Post payment' }}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>
