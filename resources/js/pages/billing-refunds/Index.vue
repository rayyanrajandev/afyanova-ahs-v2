<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ClinicalContextBanner from '@/components/domain/clinical/ClinicalContextBanner.vue';
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
import LeaveWorkflowDialog from '@/components/workflow/LeaveWorkflowDialog.vue';
import { usePendingWorkflowLeaveGuard } from '@/composables/usePendingWorkflowLeaveGuard';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import BillingModuleNav from '@/pages/billing-invoices/components/BillingModuleNav.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGet, apiPost } from '@/lib/apiClient';
import { generateRequestKey } from '@/lib/idempotency';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';
type RefundStatus = 'pending' | 'approved' | 'processed' | 'rejected' | 'cancelled' | 'all';
type RefundRecord = {
    id: string;
    billing_invoice_id: string | null;
    billing_invoice_payment_id: string | null;
    patient_id: string | null;
    refund_reason: string | null;
    refund_amount: number | null;
    refund_method: string | null;
    mobile_money_provider: string | null;
    mobile_money_reference: string | null;
    card_reference: string | null;
    check_number: string | null;
    requested_at: string | null;
    approved_at: string | null;
    processed_at: string | null;
    refund_status: string | null;
    notes: string | null;
    invoice: {
        id: string | null;
        invoice_number: string | null;
        currency_code: string | null;
        status: string | null;
        total_amount: number | null;
        paid_amount: number | null;
        balance_amount: number | null;
    } | null;
    patient: {
        id: string | null;
        patient_number: string | null;
        display_name: string | null;
        phone: string | null;
    } | null;
    financePosting?: {
        infrastructure: {
            revenueRecognitionReady: boolean;
            glPostingReady: boolean;
            missingTables: string[];
        };
        payoutPosted: boolean;
        ledger: {
            entryCount: number;
            postedCount: number;
            draftCount: number;
            reversedCount: number;
            latestPostingDate: string | null;
        };
    } | null;
};
type CollectionResponse<T> = { success: boolean; data: T[] };
type ItemResponse<T> = { success: boolean; data: T };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing-invoices' },
    { title: 'Refund Operations', href: '/billing-refunds' },
];

const { permissionState, scope } = usePlatformAccess();
const canRead = computed(() => permissionState('billing.refunds.read') === 'allowed');
const canCreate = computed(() => permissionState('billing.refunds.create') === 'allowed');
const canApprove = computed(() => permissionState('billing.refunds.approve') === 'allowed');
const canProcess = computed(() => permissionState('billing.refunds.process') === 'allowed');

const listLoading = ref(false);
const detailsLoading = ref(false);
const actionLoading = ref(false);
const booting = ref(true);
const pageError = ref<string | null>(null);

const filters = reactive({
    q: '',
    status: 'all' as RefundStatus,
});

const refunds = ref<RefundRecord[]>([]);
const selectedRefundId = ref<string | null>(null);
const selectedRefund = ref<RefundRecord | null>(null);

const createDialogOpen = ref(false);
const approveDialogOpen = ref(false);
const processDialogOpen = ref(false);
const createDiscardConfirmOpen = ref(false);
const approveDiscardConfirmOpen = ref(false);
const processDiscardConfirmOpen = ref(false);
const createRefundRequestKey = ref(generateRequestKey('billing-refund-create'));
const approveRefundRequestKey = ref(generateRequestKey('billing-refund-approve'));
const processRefundRequestKey = ref(generateRequestKey('billing-refund-process'));

const createForm = reactive({
    invoiceNumber: '',
    paymentId: '',
    refundReason: 'overpayment',
    refundAmount: '',
    refundMethod: 'cash',
    mobileMoneyProvider: '',
    mobileMoneyReference: '',
    cardReference: '',
    checkNumber: '',
    notes: '',
});

const approveForm = reactive({
    actorName: '',
    notes: '',
});

const processForm = reactive({
    actorName: '',
    mobileMoneyReference: '',
    cardReference: '',
    checkNumber: '',
    notes: '',
});

const refundReasonOptions = [
    { value: 'overpayment', label: 'Overpayment' },
    { value: 'service_cancelled', label: 'Service cancelled' },
    { value: 'insurance_adjustment', label: 'Insurance adjustment' },
    { value: 'error', label: 'Posting error' },
];

const refundMethodOptions = [
    { value: 'cash', label: 'Cash' },
    { value: 'mobile_money', label: 'Mobile money' },
    { value: 'check', label: 'Cheque' },
    { value: 'credit_note', label: 'Credit note' },
];

const mobileMoneyProviders = ['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'HaloPesa'];

const queueSummary = computed(() => {
    const total = refunds.value.length;
    const pending = refunds.value.filter((item) => item.refund_status === 'pending').length;
    const approved = refunds.value.filter((item) => item.refund_status === 'approved').length;
    const processed = refunds.value.filter((item) => item.refund_status === 'processed').length;

    return `${total} refunds in view | ${pending} pending | ${approved} approved | ${processed} processed`;
});

const createRefundWorkflowContextLabel = computed(() => {
    const invoiceNumber = createForm.invoiceNumber.trim();
    return invoiceNumber ? `Invoice ${invoiceNumber}` : 'Select billing invoice';
});

const createRefundWorkflowContextMeta = computed(() => {
    const parts = [
        formatStatusLabel(createForm.refundReason),
        formatStatusLabel(createForm.refundMethod),
        createForm.paymentId.trim() ? `Payment ${createForm.paymentId.trim()}` : null,
    ].filter(Boolean);

    return parts.length > 0
        ? parts.join(' · ')
        : 'Start the refund trail using the invoice number staff already know from the billing desk.';
});

const createRefundContextStatusLabel = computed(() => {
    if (createForm.invoiceNumber.trim() && Number(createForm.refundAmount) > 0) {
        return 'Ready to request';
    }
    if (createForm.invoiceNumber.trim()) return 'Amount required';
    return 'Invoice required';
});

const createRefundContextStatusVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    if (createForm.invoiceNumber.trim() && Number(createForm.refundAmount) > 0) return 'default';
    return 'outline';
});

const selectedRefundPatientName = computed(() =>
    selectedRefund.value ? patientLabel(selectedRefund.value) : null,
);

const selectedRefundPatientMeta = computed(() => {
    if (!selectedRefund.value) return null;

    const parts = [
        selectedRefund.value.patient?.patient_number?.trim()
            ? `Patient No. ${selectedRefund.value.patient.patient_number.trim()}`
            : null,
        selectedRefund.value.patient?.phone?.trim() || null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' · ') : null;
});

const selectedRefundWorkflowContextLabel = computed(() =>
    selectedRefund.value?.invoice?.invoice_number?.trim() || 'Refund request',
);

const selectedRefundWorkflowContextMeta = computed(() => {
    if (!selectedRefund.value) return null;

    const parts = [
        formatStatusLabel(selectedRefund.value.refund_reason),
        formatCurrency(selectedRefund.value.refund_amount, selectedRefund.value.invoice?.currency_code || 'TZS'),
    ];

    return parts.join(' · ');
});

const leadRefundAction = computed(() => {
    if (!selectedRefund.value) return 'Open a refund request or select one from the queue to continue approval and payout control.';
    if (selectedRefund.value.refund_status === 'pending') return 'This refund is waiting for finance approval before any money leaves the hospital.';
    if (selectedRefund.value.refund_status === 'approved') return 'This refund is approved and now needs payout proof before it can be closed.';
    if (selectedRefund.value.refund_status === 'processed') return 'This refund is complete. Keep the payout proof and invoice trail together for audit review.';
    return 'Review this refund carefully before taking the next operational step.';
});

const hasPendingCreateRefundWorkflow = computed(() => Boolean(
    createForm.invoiceNumber.trim()
    || createForm.paymentId.trim()
    || createForm.refundReason !== 'overpayment'
    || createForm.refundAmount.trim()
    || createForm.refundMethod !== 'cash'
    || createForm.mobileMoneyProvider.trim()
    || createForm.mobileMoneyReference.trim()
    || createForm.cardReference.trim()
    || createForm.checkNumber.trim()
    || createForm.notes.trim(),
));

const hasPendingApproveRefundWorkflow = computed(() => Boolean(
    approveForm.actorName.trim() || approveForm.notes.trim(),
));

const hasPendingProcessRefundWorkflow = computed(() => Boolean(
    processForm.actorName.trim()
    || processForm.mobileMoneyReference.trim()
    || processForm.cardReference.trim()
    || processForm.checkNumber.trim()
    || processForm.notes.trim(),
));

const hasPendingRefundWorkflow = computed(() => (
    (createDialogOpen.value && hasPendingCreateRefundWorkflow.value)
    || (approveDialogOpen.value && hasPendingApproveRefundWorkflow.value)
    || (processDialogOpen.value && hasPendingProcessRefundWorkflow.value)
));

const {
    confirmOpen: leaveConfirmOpen,
    confirmLeave: confirmPendingRefundWorkflowLeave,
    cancelLeave: cancelPendingRefundWorkflowLeave,
} = usePendingWorkflowLeaveGuard({
    shouldBlock: hasPendingRefundWorkflow,
    isSubmitting: actionLoading,
    blockBrowserUnload: false,
});

function refundFinanceSetupMissing(refund: RefundRecord | null | undefined): boolean {
    return Boolean(refund?.financePosting?.infrastructure && !refund.financePosting.infrastructure.glPostingReady);
}

function refundFinanceMissingTables(refund: RefundRecord | null | undefined): string {
    return refund?.financePosting?.infrastructure?.missingTables?.join(', ') || 'gl_journal_entries';
}

watch(
    () => filters.status,
    () => {
        loadRefunds(false);
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
    return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function refundBadgeVariant(status: string | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (status === 'pending') return 'default';
    if (status === 'approved') return 'secondary';
    if (status === 'processed') return 'outline';
    return 'destructive';
}

function patientLabel(refund: RefundRecord): string {
    return refund.patient?.display_name || refund.patient?.patient_number || 'Unknown patient';
}

async function apiRequest<T>(
    method: 'GET' | 'POST',
    path: string,
    options?: {
        query?: Record<string, string | number | null>;
        body?: Record<string, unknown>;
        entitlementContext?: string;
        idempotencyKey?: string | null;
        requestId?: string | null;
    },
): Promise<T> {
    if (method === 'GET') {
        const query = Object.fromEntries(
            Object.entries(options?.query ?? {}).filter(([, value]) => value !== null && value !== ''),
        );

        return apiGet<T>(path, query, {
            entitlementContext: options?.entitlementContext,
        });
    }

    return apiPost<T>(path, {
        body: options?.body,
        entitlementContext: options?.entitlementContext,
        idempotencyKey: options?.idempotencyKey,
        requestId: options?.requestId,
    });
}

async function loadRefunds(preserveSelection = true) {
    if (!canRead.value) {
        booting.value = false;
        return;
    }

    listLoading.value = true;
    pageError.value = null;

    try {
        const response = await apiRequest<CollectionResponse<RefundRecord>>('GET', '/billing-refunds', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status,
            },
        });

        refunds.value = response.data;

        const currentStillExists = preserveSelection
            && selectedRefundId.value !== null
            && response.data.some((refund) => refund.id === selectedRefundId.value);

        if (currentStillExists) {
            await loadRefund(selectedRefundId.value!);
        } else if (response.data.length > 0) {
            await selectRefund(response.data[0].id);
        } else {
            selectedRefundId.value = null;
            selectedRefund.value = null;
        }
    } catch (error) {
        pageError.value = messageFromUnknown(error, 'Unable to load refund queue.');
        notifyError(pageError.value);
    } finally {
        listLoading.value = false;
        booting.value = false;
    }
}

async function loadRefund(refundId: string) {
    detailsLoading.value = true;

    try {
        const response = await apiRequest<ItemResponse<RefundRecord>>('GET', `/billing-refunds/${refundId}`);
        selectedRefundId.value = refundId;
        selectedRefund.value = response.data;
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to load refund details.'));
    } finally {
        detailsLoading.value = false;
    }
}

async function selectRefund(refundId: string) {
    if (selectedRefundId.value === refundId && selectedRefund.value) return;
    await loadRefund(refundId);
}

function resetCreateForm() {
    createForm.invoiceNumber = '';
    createForm.paymentId = '';
    createForm.refundReason = 'overpayment';
    createForm.refundAmount = '';
    createForm.refundMethod = 'cash';
    createForm.mobileMoneyProvider = '';
    createForm.mobileMoneyReference = '';
    createForm.cardReference = '';
    createForm.checkNumber = '';
    createForm.notes = '';
}

function resetApproveForm() {
    approveForm.actorName = '';
    approveForm.notes = '';
}

function resetProcessForm() {
    processForm.actorName = '';
    processForm.mobileMoneyReference = '';
    processForm.cardReference = '';
    processForm.checkNumber = '';
    processForm.notes = '';
}

function rotateCreateRefundRequestKey(): void {
    createRefundRequestKey.value = generateRequestKey('billing-refund-create');
}

function rotateApproveRefundRequestKey(): void {
    approveRefundRequestKey.value = generateRequestKey('billing-refund-approve');
}

function rotateProcessRefundRequestKey(): void {
    processRefundRequestKey.value = generateRequestKey('billing-refund-process');
}

function openCreateRefundDialog(): void {
    resetCreateForm();
    rotateCreateRefundRequestKey();
    createDialogOpen.value = true;
}

function openApproveRefundDialog(): void {
    resetApproveForm();
    rotateApproveRefundRequestKey();
    approveDialogOpen.value = true;
}

function openProcessRefundDialog(): void {
    resetProcessForm();
    rotateProcessRefundRequestKey();
    processDialogOpen.value = true;
}

function requestCreateDialogOpenChange(open: boolean): void {
    if (open) {
        openCreateRefundDialog();
        return;
    }

    if (actionLoading.value) return;

    if (hasPendingCreateRefundWorkflow.value) {
        createDiscardConfirmOpen.value = true;
        return;
    }

    createDialogOpen.value = false;
    resetCreateForm();
    rotateCreateRefundRequestKey();
}

function requestApproveDialogOpenChange(open: boolean): void {
    if (open) {
        openApproveRefundDialog();
        return;
    }

    if (actionLoading.value) return;

    if (hasPendingApproveRefundWorkflow.value) {
        approveDiscardConfirmOpen.value = true;
        return;
    }

    approveDialogOpen.value = false;
    resetApproveForm();
    rotateApproveRefundRequestKey();
}

function requestProcessDialogOpenChange(open: boolean): void {
    if (open) {
        openProcessRefundDialog();
        return;
    }

    if (actionLoading.value) return;

    if (hasPendingProcessRefundWorkflow.value) {
        processDiscardConfirmOpen.value = true;
        return;
    }

    processDialogOpen.value = false;
    resetProcessForm();
    rotateProcessRefundRequestKey();
}

function confirmCreateDialogDiscard(): void {
    createDiscardConfirmOpen.value = false;
    createDialogOpen.value = false;
    resetCreateForm();
    rotateCreateRefundRequestKey();
}

function confirmApproveDialogDiscard(): void {
    approveDiscardConfirmOpen.value = false;
    approveDialogOpen.value = false;
    resetApproveForm();
    rotateApproveRefundRequestKey();
}

function confirmProcessDialogDiscard(): void {
    processDiscardConfirmOpen.value = false;
    processDialogOpen.value = false;
    resetProcessForm();
    rotateProcessRefundRequestKey();
}

async function submitCreateRefund() {
    if (
        !canCreate.value
        || actionLoading.value
        || !createForm.invoiceNumber.trim()
        || Number(createForm.refundAmount) <= 0
    ) return;

    actionLoading.value = true;

    try {
        const requestKey = createRefundRequestKey.value;
        const response = await apiRequest<ItemResponse<RefundRecord>>('POST', '/billing-refunds', {
            body: {
                invoice_number: createForm.invoiceNumber.trim(),
                payment_id: createForm.paymentId.trim() || null,
                refund_reason: createForm.refundReason,
                refund_amount: Number(createForm.refundAmount),
                refund_method: createForm.refundMethod,
                mobile_money_provider: createForm.refundMethod === 'mobile_money' ? createForm.mobileMoneyProvider || null : null,
                mobile_money_reference: createForm.refundMethod === 'mobile_money' ? createForm.mobileMoneyReference.trim() || null : null,
                card_reference: createForm.refundMethod === 'credit_note' ? createForm.cardReference.trim() || null : null,
                check_number: createForm.refundMethod === 'check' ? createForm.checkNumber.trim() || null : null,
                notes: createForm.notes.trim() || null,
            },
            entitlementContext: 'Refund request create',
            idempotencyKey: requestKey,
            requestId: requestKey,
        });

        notifySuccess('Refund request recorded.');
        createDialogOpen.value = false;
        resetCreateForm();
        rotateCreateRefundRequestKey();
        filters.status = 'all';
        await loadRefunds(false);
        if (response.data.id) {
            await selectRefund(response.data.id);
        }
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to create refund request.'));
    } finally {
        actionLoading.value = false;
    }
}

async function submitApproveRefund() {
    if (!canApprove.value || !selectedRefund.value || actionLoading.value) return;

    actionLoading.value = true;

    try {
        const requestKey = approveRefundRequestKey.value;
        await apiRequest<ItemResponse<RefundRecord>>('POST', `/billing-refunds/${selectedRefund.value.id}/approve`, {
            body: {
                actor_name: approveForm.actorName.trim() || null,
                notes: approveForm.notes.trim() || null,
            },
            entitlementContext: 'Refund approval',
            idempotencyKey: requestKey,
            requestId: requestKey,
        });

        notifySuccess('Refund approved.');
        approveDialogOpen.value = false;
        resetApproveForm();
        rotateApproveRefundRequestKey();
        await loadRefunds();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to approve refund.'));
    } finally {
        actionLoading.value = false;
    }
}

async function submitProcessRefund() {
    if (!canProcess.value || !selectedRefund.value || actionLoading.value) return;

    actionLoading.value = true;

    try {
        const requestKey = processRefundRequestKey.value;
        await apiRequest<ItemResponse<RefundRecord>>('POST', `/billing-refunds/${selectedRefund.value.id}/process`, {
            body: {
                actor_name: processForm.actorName.trim() || null,
                mobile_money_reference: processForm.mobileMoneyReference.trim() || null,
                card_reference: processForm.cardReference.trim() || null,
                check_number: processForm.checkNumber.trim() || null,
                notes: processForm.notes.trim() || null,
            },
            entitlementContext: 'Refund payout processing',
            idempotencyKey: requestKey,
            requestId: requestKey,
        });

        notifySuccess('Refund processed.');
        processDialogOpen.value = false;
        resetProcessForm();
        rotateProcessRefundRequestKey();
        await loadRefunds();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to process refund.'));
    } finally {
        actionLoading.value = false;
    }
}

onMounted(async () => {
    await loadRefunds(false);
});
</script>

<template>
    <Head title="Refund Operations" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <BillingModuleNav />
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20" aria-hidden="true">
                            <AppIcon name="undo-2" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <h1 class="text-base font-semibold tracking-tight md:text-lg">Refunds</h1>
                            <p class="text-xs text-muted-foreground">Finance workboard for refund control: request, approve, process, and keep payout proof tied to the invoice trail.</p>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <Button v-if="canCreate" size="sm" class="h-8 gap-1.5" @click="openCreateRefundDialog">
                            <AppIcon name="plus" class="size-3.5" />
                            New refund
                        </Button>
                        <Button variant="outline" size="sm" class="h-8 gap-1.5" :disabled="listLoading" @click="loadRefunds()">
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            Refresh
                        </Button>
                    </div>
                </div>
            </section>

            <Alert v-if="!canRead" variant="destructive" class="rounded-lg">
                <AppIcon name="shield-alert" class="size-4" />
                <AlertTitle>Refund operations access is restricted</AlertTitle>
                <AlertDescription>This account does not have permission to read the refund queue.</AlertDescription>
            </Alert>

            <Alert v-else class="rounded-lg border-sidebar-border/70">
                <AppIcon name="receipt" class="size-4" />
                <AlertTitle>Refund control posture</AlertTitle>
                <AlertDescription>{{ leadRefundAction }}</AlertDescription>
            </Alert>

            <div v-if="canRead" class="grid min-h-0 flex-1 gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
                <Card class="flex min-h-0 flex-col rounded-lg border-sidebar-border/70">
                    <CardHeader class="gap-3">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <CardTitle>Refund queue</CardTitle>
                                <CardDescription>{{ queueSummary }}</CardDescription>
                            </div>
                            <Badge variant="outline">{{ refunds.length }}</Badge>
                        </div>

                        <div class="grid gap-3">
                            <Input
                                v-model="filters.q"
                                placeholder="Search invoice number, patient, or payout reference"
                                @keydown.enter.prevent="loadRefunds(false)"
                            />

                            <div class="grid gap-3 sm:grid-cols-2">
                                <Select v-model="filters.status">
                                    <SelectTrigger>
                                        <SelectValue placeholder="All statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="approved">Approved</SelectItem>
                                        <SelectItem value="processed">Processed</SelectItem>
                                        <SelectItem value="rejected">Rejected</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Button variant="outline" :disabled="listLoading" @click="loadRefunds(false)">Search</Button>
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
                                    <div v-for="index in 5" :key="`refund-skeleton-${index}`" class="rounded-lg border border-sidebar-border/70 p-3">
                                        <div class="h-4 w-2/3 rounded bg-muted"></div>
                                        <div class="mt-2 h-3 w-1/2 rounded bg-muted"></div>
                                        <div class="mt-3 h-8 w-full rounded bg-muted"></div>
                                    </div>
                                </template>

                                <template v-else-if="refunds.length > 0">
                                    <button
                                        v-for="refund in refunds"
                                        :key="refund.id"
                                        type="button"
                                        class="w-full rounded-lg border p-3 text-left transition-colors"
                                        :class="refund.id === selectedRefundId ? 'border-primary bg-primary/5' : 'border-sidebar-border/70 hover:bg-muted/50'"
                                        @click="selectRefund(refund.id)"
                                    >
                                        <div class="flex items-start justify-between gap-3">
                                            <div class="min-w-0">
                                                <p class="truncate text-sm font-medium">{{ refund.invoice?.invoice_number || 'Invoice not linked' }}</p>
                                                <p class="truncate text-xs text-muted-foreground">
                                                    {{ patientLabel(refund) }}
                                                    <span v-if="refund.patient?.patient_number"> | {{ refund.patient.patient_number }}</span>
                                                </p>
                                            </div>
                                            <Badge :variant="refundBadgeVariant(refund.refund_status)">
                                                {{ formatStatusLabel(refund.refund_status) }}
                                            </Badge>
                                        </div>

                                        <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                            <div>
                                                <span class="block text-[11px] uppercase tracking-[0.16em]">Refund amount</span>
                                                <span class="text-sm font-semibold text-foreground">
                                                    {{ formatCurrency(refund.refund_amount, refund.invoice?.currency_code || 'TZS') }}
                                                </span>
                                            </div>
                                            <div>
                                                <span class="block text-[11px] uppercase tracking-[0.16em]">Requested</span>
                                                <span class="text-sm text-foreground">{{ formatDateTime(refund.requested_at) }}</span>
                                            </div>
                                        </div>
                                        <div
                                            v-if="refund.financePosting"
                                            class="mt-3 flex flex-wrap gap-1.5"
                                        >
                                            <Badge
                                                :variant="refundFinanceSetupMissing(refund) ? 'destructive' : (refund.financePosting.payoutPosted ? 'secondary' : 'outline')"
                                                class="text-[10px]"
                                            >
                                                {{
                                                    refundFinanceSetupMissing(refund)
                                                        ? 'Finance setup missing'
                                                        : (refund.financePosting.payoutPosted ? 'Payout GL posted' : 'Payout GL pending')
                                                }}
                                            </Badge>
                                            <Badge variant="outline" class="text-[10px]">
                                                Ledger {{ refund.financePosting.ledger.postedCount }}/{{ refund.financePosting.ledger.entryCount }}
                                            </Badge>
                                        </div>
                                    </button>
                                </template>

                                <div v-else class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                    No refunds match the current queue setup.
                                </div>
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <div class="flex min-h-0 flex-col gap-4">
                    <template v-if="selectedRefund">
                        <Card class="rounded-lg border-sidebar-border/70">
                            <CardHeader class="gap-3">
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="min-w-0">
                                        <CardTitle class="truncate">{{ selectedRefund.invoice?.invoice_number || 'Refund request' }}</CardTitle>
                                        <CardDescription class="mt-1">
                                            {{ patientLabel(selectedRefund) }}
                                            <span v-if="selectedRefund.patient?.patient_number"> | {{ selectedRefund.patient.patient_number }}</span>
                                        </CardDescription>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Badge :variant="refundBadgeVariant(selectedRefund.refund_status)">
                                            {{ formatStatusLabel(selectedRefund.refund_status) }}
                                        </Badge>
                                        <Badge variant="outline">{{ formatStatusLabel(selectedRefund.refund_method) }}</Badge>
                                        <Badge
                                            v-if="selectedRefund.financePosting"
                                            :variant="refundFinanceSetupMissing(selectedRefund) ? 'destructive' : (selectedRefund.financePosting.payoutPosted ? 'secondary' : 'outline')"
                                        >
                                            {{
                                                refundFinanceSetupMissing(selectedRefund)
                                                    ? 'Finance setup missing'
                                                    : (selectedRefund.financePosting.payoutPosted ? 'Payout GL posted' : 'Payout GL pending')
                                            }}
                                        </Badge>
                                    </div>
                                </div>

                                <div class="grid gap-3 sm:grid-cols-3">
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Refund amount</p>
                                        <p class="mt-1 text-lg font-semibold">
                                            {{ formatCurrency(selectedRefund.refund_amount, selectedRefund.invoice?.currency_code || 'TZS') }}
                                        </p>
                                    </div>
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Invoice total</p>
                                        <p class="mt-1 text-lg font-semibold">
                                            {{ formatCurrency(selectedRefund.invoice?.total_amount, selectedRefund.invoice?.currency_code || 'TZS') }}
                                        </p>
                                    </div>
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Open balance</p>
                                        <p class="mt-1 text-lg font-semibold">
                                            {{ formatCurrency(selectedRefund.invoice?.balance_amount, selectedRefund.invoice?.currency_code || 'TZS') }}
                                        </p>
                                    </div>
                                </div>

                                <div class="flex flex-wrap gap-2">
                                    <Button
                                        v-if="canApprove && selectedRefund.refund_status === 'pending'"
                                        class="gap-2"
                                        @click="openApproveRefundDialog"
                                    >
                                        <AppIcon name="check" class="size-4" />
                                        Approve refund
                                    </Button>
                                    <Button
                                        v-if="canProcess && selectedRefund.refund_status === 'approved'"
                                        variant="outline"
                                        class="gap-2"
                                        @click="openProcessRefundDialog"
                                    >
                                        <AppIcon name="banknote" class="size-4" />
                                        Process payout
                                    </Button>
                                    <Button
                                        variant="outline"
                                        class="gap-2"
                                        @click="router.visit(`/billing-invoices?search=${encodeURIComponent(selectedRefund.invoice?.invoice_number || '')}`)"
                                    >
                                        <AppIcon name="receipt" class="size-4" />
                                        Open invoice queue
                                    </Button>
                                </div>
                            </CardHeader>
                        </Card>

                        <div class="grid gap-4 xl:grid-cols-2">
                            <Card class="rounded-lg border-sidebar-border/70">
                                <CardHeader>
                                    <CardTitle>Refund control</CardTitle>
                                    <CardDescription>Operational checkpoints for approval and payout.</CardDescription>
                                </CardHeader>
                                <CardContent class="grid gap-3 text-sm">
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Reason</p>
                                        <p class="mt-1 font-medium">{{ formatStatusLabel(selectedRefund.refund_reason) }}</p>
                                    </div>
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Requested</p>
                                        <p class="mt-1 font-medium">{{ formatDateTime(selectedRefund.requested_at) }}</p>
                                    </div>
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Approval state</p>
                                        <p class="mt-1 font-medium">{{ formatStatusLabel(selectedRefund.refund_status) }}</p>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            <template v-if="selectedRefund.refund_status === 'pending'">
                                                Approval is still required before payout.
                                            </template>
                                            <template v-else-if="selectedRefund.refund_status === 'approved'">
                                                Finance approval is complete. Payout proof is now required.
                                            </template>
                                            <template v-else-if="selectedRefund.refund_status === 'processed'">
                                                Payout is complete and should stay attached to the invoice trail.
                                            </template>
                                            <template v-else>
                                                Review this refund outcome in the invoice record.
                                            </template>
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card class="rounded-lg border-sidebar-border/70">
                                <CardHeader>
                                    <CardTitle>Payout proof</CardTitle>
                                    <CardDescription>Cash office or finance proof that should travel with this refund.</CardDescription>
                                </CardHeader>
                                <CardContent class="grid gap-3 text-sm">
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Method</p>
                                        <p class="mt-1 font-medium">{{ formatStatusLabel(selectedRefund.refund_method) }}</p>
                                    </div>
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Reference</p>
                                        <p class="mt-1 font-medium">
                                            {{ selectedRefund.mobile_money_reference || selectedRefund.card_reference || selectedRefund.check_number || 'No payout reference recorded yet' }}
                                        </p>
                                    </div>
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Processed</p>
                                        <p class="mt-1 font-medium">{{ formatDateTime(selectedRefund.processed_at) }}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card
                            v-if="selectedRefund.financePosting"
                            class="rounded-lg border-sidebar-border/70"
                        >
                            <CardHeader>
                                <CardTitle>Finance posting</CardTitle>
                                <CardDescription>
                                    Keep refund payout posting visible alongside approval and payout proof.
                                </CardDescription>
                            </CardHeader>
                            <CardContent class="grid gap-3 text-sm">
                                <Alert v-if="refundFinanceSetupMissing(selectedRefund)" variant="destructive" class="rounded-lg">
                                    <AppIcon name="triangle-alert" class="size-4" />
                                    <AlertTitle>Finance ledger setup is incomplete</AlertTitle>
                                    <AlertDescription>
                                        Refund payout posting is using fallback values because these tables are not available yet:
                                        {{ refundFinanceMissingTables(selectedRefund) }}.
                                    </AlertDescription>
                                </Alert>

                                <div class="grid gap-3 sm:grid-cols-3">
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Payout GL</p>
                                        <p class="mt-1 font-medium">
                                            {{
                                                refundFinanceSetupMissing(selectedRefund)
                                                    ? 'Setup missing'
                                                    : (selectedRefund.financePosting.payoutPosted ? 'Posted' : 'Pending')
                                            }}
                                        </p>
                                    </div>
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Ledger entries</p>
                                        <p class="mt-1 font-medium">
                                            {{ selectedRefund.financePosting.ledger.postedCount }} posted /
                                            {{ selectedRefund.financePosting.ledger.entryCount }} total
                                        </p>
                                    </div>
                                    <div class="rounded-lg border border-sidebar-border/70 p-3">
                                        <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Latest posting</p>
                                        <p class="mt-1 font-medium">
                                            {{ formatDateTime(selectedRefund.financePosting.ledger.latestPostingDate) }}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card v-if="selectedRefund.notes" class="rounded-lg border-sidebar-border/70">
                            <CardHeader>
                                <CardTitle>Refund notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p class="text-sm text-muted-foreground">{{ selectedRefund.notes }}</p>
                            </CardContent>
                        </Card>
                    </template>

                    <Card v-else class="rounded-lg border-sidebar-border/70">
                        <CardContent class="flex min-h-[24rem] flex-col items-center justify-center gap-3 text-center">
                            <AppIcon name="rotate-ccw" class="size-8 text-muted-foreground" />
                            <div>
                                <p class="text-base font-medium">No refund selected</p>
                                <p class="mt-1 text-sm text-muted-foreground">
                                    Choose a refund from the queue or create a new request to start the control flow.
                                </p>
                            </div>
                            <Button v-if="canCreate" @click="openCreateRefundDialog">New refund request</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>

        <Dialog :open="createDialogOpen" @update:open="requestCreateDialogOpenChange">
            <DialogContent class="rounded-lg sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>New refund request</DialogTitle>
                    <DialogDescription>
                        Start the refund trail using the invoice number staff already know from the billing desk.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-4 py-2">
                    <ClinicalContextBanner
                        title="Refund request context"
                        description="Confirm the source invoice, refund pathway, and payout route before opening the refund trail."
                        :facility-name="scope?.facility?.name || null"
                        :tenant-name="null"
                        :context-label="createRefundWorkflowContextLabel"
                        :context-meta="createRefundWorkflowContextMeta"
                        :status-label="createRefundContextStatusLabel"
                        :status-variant="createRefundContextStatusVariant"
                        tone="muted"
                    >
                        <div class="grid gap-2 sm:grid-cols-2">
                            <div class="rounded-md border bg-background/80 px-3 py-2">
                                <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    Refund amount
                                </p>
                                <p class="mt-1 text-sm font-medium text-foreground">
                                    {{
                                        Number(createForm.refundAmount) > 0
                                            ? formatCurrency(Number(createForm.refundAmount), 'TZS')
                                            : 'Enter amount'
                                    }}
                                </p>
                            </div>
                            <div class="rounded-md border bg-background/80 px-3 py-2">
                                <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    Payout route
                                </p>
                                <p class="mt-1 text-sm font-medium text-foreground">
                                    {{ formatStatusLabel(createForm.refundMethod) }}
                                </p>
                            </div>
                        </div>
                    </ClinicalContextBanner>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="refund-create-invoice-number">Invoice number</Label>
                            <Input id="refund-create-invoice-number" v-model="createForm.invoiceNumber" placeholder="INV2026..." />
                        </div>
                        <div class="grid gap-2">
                            <Label for="refund-create-payment-id">Payment ID</Label>
                            <Input id="refund-create-payment-id" v-model="createForm.paymentId" placeholder="Optional payment UUID for payment-linked refunds" />
                        </div>
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label>Refund reason</Label>
                            <Select v-model="createForm.refundReason">
                                <SelectTrigger>
                                    <SelectValue placeholder="Select reason" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="option in refundReasonOptions" :key="option.value" :value="option.value">
                                        {{ option.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="grid gap-2">
                            <Label for="refund-create-amount">Refund amount</Label>
                            <Input id="refund-create-amount" v-model="createForm.refundAmount" inputmode="decimal" placeholder="0.00" />
                        </div>
                    </div>

                    <div class="grid gap-2">
                        <Label>Refund method</Label>
                        <Select v-model="createForm.refundMethod">
                            <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="option in refundMethodOptions" :key="option.value" :value="option.value">
                                    {{ option.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div v-if="createForm.refundMethod === 'mobile_money'" class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label>Mobile money provider</Label>
                            <Select v-model="createForm.mobileMoneyProvider">
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
                            <Label for="refund-create-mobile-reference">Reference</Label>
                            <Input id="refund-create-mobile-reference" v-model="createForm.mobileMoneyReference" placeholder="Telecom or control reference" />
                        </div>
                    </div>

                    <div v-else-if="createForm.refundMethod === 'check'" class="grid gap-2">
                        <Label for="refund-create-check-number">Cheque number</Label>
                        <Input id="refund-create-check-number" v-model="createForm.checkNumber" placeholder="Cheque or bank proof number" />
                    </div>

                    <div v-else-if="createForm.refundMethod === 'credit_note'" class="grid gap-2">
                        <Label for="refund-create-credit-reference">Credit note reference</Label>
                        <Input id="refund-create-credit-reference" v-model="createForm.cardReference" placeholder="Credit note or adjustment reference" />
                    </div>

                    <div class="rounded-lg border border-sidebar-border/70 p-3 text-sm text-muted-foreground">
                        <p class="text-xs uppercase tracking-[0.16em]">Control reminder</p>
                        <p class="mt-1">
                            Request the refund against the invoice number first, then keep approval and payout proof on the same trail.
                        </p>
                    </div>

                    <div class="grid gap-2">
                        <Label for="refund-create-notes">Notes</Label>
                        <Textarea
                            id="refund-create-notes"
                            v-model="createForm.notes"
                            rows="3"
                            placeholder="Operational context, cancellation reason, or payer adjustment note"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" :disabled="actionLoading" @click="requestCreateDialogOpenChange(false)">Cancel</Button>
                    <Button :disabled="actionLoading || !createForm.invoiceNumber.trim() || Number(createForm.refundAmount) <= 0 || (createForm.refundMethod === 'mobile_money' && !createForm.mobileMoneyProvider)" @click="submitCreateRefund">
                        Create refund request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog :open="approveDialogOpen" @update:open="requestApproveDialogOpenChange">
            <DialogContent class="rounded-lg sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Approve refund</DialogTitle>
                    <DialogDescription>
                        Confirm that this refund is valid and ready for payout handling.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-4 py-2">
                    <ClinicalContextBanner
                        title="Refund approval context"
                        description="Confirm the patient, source invoice, and refund amount before authorizing payout handling."
                        :patient-name="selectedRefundPatientName"
                        :patient-meta="selectedRefundPatientMeta"
                        :facility-name="scope?.facility?.name || null"
                        :tenant-name="null"
                        :context-label="selectedRefundWorkflowContextLabel"
                        :context-meta="selectedRefundWorkflowContextMeta"
                        :status-label="selectedRefund ? formatStatusLabel(selectedRefund.refund_status) : null"
                        :status-variant="selectedRefund ? refundBadgeVariant(selectedRefund.refund_status) : 'outline'"
                        tone="muted"
                    />
                    <div class="rounded-lg border border-sidebar-border/70 p-3 text-sm text-muted-foreground">
                        <p class="text-xs uppercase tracking-[0.16em]">Approval target</p>
                        <p class="mt-1 font-medium text-foreground">
                            {{ selectedRefund?.invoice?.invoice_number || 'Refund request' }} |
                            {{ formatCurrency(selectedRefund?.refund_amount, selectedRefund?.invoice?.currency_code || 'TZS') }}
                        </p>
                    </div>

                    <div class="grid gap-2">
                        <Label for="refund-approve-actor-name">Approver name</Label>
                        <Input id="refund-approve-actor-name" v-model="approveForm.actorName" placeholder="Finance approver" />
                    </div>

                    <div class="grid gap-2">
                        <Label for="refund-approve-notes">Approval note</Label>
                        <Textarea
                            id="refund-approve-notes"
                            v-model="approveForm.notes"
                            rows="3"
                            placeholder="Reason approval is valid, supporting document, or supervisor note"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" :disabled="actionLoading" @click="requestApproveDialogOpenChange(false)">Cancel</Button>
                    <Button :disabled="actionLoading" @click="submitApproveRefund">Approve refund</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog :open="processDialogOpen" @update:open="requestProcessDialogOpenChange">
            <DialogContent class="rounded-lg sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Process refund payout</DialogTitle>
                    <DialogDescription>
                        Capture the payout proof that closes the refund trail.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-4 py-2">
                    <ClinicalContextBanner
                        title="Refund payout context"
                        description="Confirm the patient, invoice trail, and payout method before closing the refund."
                        :patient-name="selectedRefundPatientName"
                        :patient-meta="selectedRefundPatientMeta"
                        :facility-name="scope?.facility?.name || null"
                        :tenant-name="null"
                        :context-label="selectedRefundWorkflowContextLabel"
                        :context-meta="selectedRefundWorkflowContextMeta"
                        :status-label="selectedRefund ? formatStatusLabel(selectedRefund.refund_status) : null"
                        :status-variant="selectedRefund ? refundBadgeVariant(selectedRefund.refund_status) : 'outline'"
                        tone="muted"
                    />
                    <div class="rounded-lg border border-sidebar-border/70 p-3 text-sm text-muted-foreground">
                        <p class="text-xs uppercase tracking-[0.16em]">Payout target</p>
                        <p class="mt-1 font-medium text-foreground">
                            {{ selectedRefund?.invoice?.invoice_number || 'Refund request' }} |
                            {{ formatStatusLabel(selectedRefund?.refund_method) }}
                        </p>
                    </div>

                    <div class="grid gap-2">
                        <Label for="refund-process-actor-name">Payout officer</Label>
                        <Input id="refund-process-actor-name" v-model="processForm.actorName" placeholder="Cash office or finance officer" />
                    </div>

                    <div v-if="selectedRefund?.refund_method === 'mobile_money'" class="grid gap-2">
                        <Label for="refund-process-mobile-reference">Mobile money reference</Label>
                        <Input id="refund-process-mobile-reference" v-model="processForm.mobileMoneyReference" placeholder="Telecom transaction reference" />
                    </div>

                    <div v-else-if="selectedRefund?.refund_method === 'check'" class="grid gap-2">
                        <Label for="refund-process-check-number">Cheque number</Label>
                        <Input id="refund-process-check-number" v-model="processForm.checkNumber" placeholder="Cheque or bank proof number" />
                    </div>

                    <div v-else-if="selectedRefund?.refund_method === 'credit_note'" class="grid gap-2">
                        <Label for="refund-process-credit-reference">Credit note reference</Label>
                        <Input id="refund-process-credit-reference" v-model="processForm.cardReference" placeholder="Credit note reference" />
                    </div>

                    <div class="grid gap-2">
                        <Label for="refund-process-notes">Processing note</Label>
                        <Textarea
                            id="refund-process-notes"
                            v-model="processForm.notes"
                            rows="3"
                            placeholder="Payout note, handoff reference, or supporting proof"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" :disabled="actionLoading" @click="requestProcessDialogOpenChange(false)">Cancel</Button>
                    <Button :disabled="actionLoading" @click="submitProcessRefund">Process refund</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <LeaveWorkflowDialog
            :open="leaveConfirmOpen"
            title="Leave refund workflow?"
            description="A refund form still has unsaved changes. Stay here to finish the finance control step, or leave this page and discard the unfinished work."
            stay-label="Stay on workflow"
            leave-label="Leave page"
            @update:open="cancelPendingRefundWorkflowLeave"
            @confirm="confirmPendingRefundWorkflowLeave"
        />

        <LeaveWorkflowDialog
            :open="createDiscardConfirmOpen"
            title="Discard refund request?"
            description="This refund request form has unsaved invoice or payout details. Keep editing to open the refund trail, or discard the form."
            stay-label="Keep editing"
            leave-label="Discard form"
            @update:open="createDiscardConfirmOpen = false"
            @confirm="confirmCreateDialogDiscard"
        />

        <LeaveWorkflowDialog
            :open="approveDiscardConfirmOpen"
            title="Discard refund approval?"
            description="This approval form has unsaved approver notes. Keep editing to complete the control step, or discard the form."
            stay-label="Keep editing"
            leave-label="Discard form"
            @update:open="approveDiscardConfirmOpen = false"
            @confirm="confirmApproveDialogDiscard"
        />

        <LeaveWorkflowDialog
            :open="processDiscardConfirmOpen"
            title="Discard refund payout form?"
            description="This payout form has unsaved settlement details. Keep editing to close the refund trail safely, or discard the form."
            stay-label="Keep editing"
            leave-label="Discard form"
            @update:open="processDiscardConfirmOpen = false"
            @confirm="confirmProcessDialogDiscard"
        />
    </AppLayout>
</template>

