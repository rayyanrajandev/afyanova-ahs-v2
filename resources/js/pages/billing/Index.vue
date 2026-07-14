<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { watchDebounced } from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import InventoryEmptyState from '@/components/inventory/InventoryEmptyState.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import PatientSummaryPopover from '@/components/patients/summary/PatientSummaryPopover.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/AppLayout.vue';
import BillingModuleNav from '@/pages/billing/components/BillingModuleNav.vue';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { formatEnumLabel } from '@/lib/labels';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { BreadcrumbItem } from '@/types';

const { scope: platformScope } = usePlatformAccess();

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing-invoices' },
];

const DRAFT_STORAGE_KEY = 'billing.payment-draft.v1';
type AutoRefreshKey = 'off' | '30s' | '1m' | '5m';
const AUTO_REFRESH_INTERVALS: Record<AutoRefreshKey, number> = { off: 0, '30s': 30_000, '1m': 60_000, '5m': 300_000 };
const AUTO_REFRESH_LABELS: Record<AutoRefreshKey, string> = { off: 'Auto: Off', '30s': '30s', '1m': '1m', '5m': '5m' };

type CashierQueueEntry = {
    patientId: string;
    patientNumber: string;
    patientName: string;
    phone: string | null;
    unpaidInvoiceCount: number;
    totalUnpaidAmount: number;
    paidInvoiceCount: number;
    totalPaidAmount: number;
    unbilledServiceCount: number;
    inConsultation: boolean;
    summaryLabel: string;
};

type CashierQueueResponse = {
    data: CashierQueueEntry[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type Invoice = {
    id: string;
    invoiceNumber: string | null;
    status: string;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    invoiceDate: string;
    paymentDueAt: string | null;
    lineItems: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        serviceCode: string | null;
    }>;
};

type PaymentResponse = {
    data: {
        id: string;
        amount: number;
        paymentMethod: string;
        payerType: string;
    };
};

type UndoEntry = {
    invoiceId: string;
    amount: number;
    method: string;
    reference: string;
    previousPaidAmount: number;
    previousBalance: number;
    previousStatus: string;
};

const pageLoading = ref(true);
const listLoading = ref(false);
const queueError = ref<string | null>(null);
const queueEntries = ref<CashierQueueEntry[]>([]);
const pagination = ref<{ currentPage: number; perPage: number; total: number; lastPage: number } | null>(null);
const searchQuery = ref('');
const statusFilter = ref('all');
const currentPage = ref(1);

const selectedPatient = ref<CashierQueueEntry | null>(null);
const patientInvoices = ref<Invoice[]>([]);
const patientInvoicesLoading = ref(false);
const chargeCaptureCandidates = ref<any[]>([]);
const chargeCandidatesLoading = ref(false);

const showPaymentDialog = ref(false);
const paymentInvoice = ref<Invoice | null>(null);
const paymentAmount = ref(0);
const paymentMethod = ref('cash');
const paymentReference = ref('');
const paymentSaving = ref(false);

const autoRefreshInterval = ref<AutoRefreshKey>('off');
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
let searchAbortController: AbortController | null = null;

const selectedInvoiceIds = ref<Set<string>>(new Set());
const showBulkPaymentDialog = ref(false);
const bulkPaymentAmount = ref(0);
const bulkPaymentMethod = ref('cash');
const bulkPaymentReference = ref('');
const bulkPaymentSaving = ref(false);

const undoStack = ref<UndoEntry[]>([]);
const showUndoToast = ref(false);
const undoTimer = ref<ReturnType<typeof setTimeout> | null>(null);

const mobileView = ref<'queue' | 'detail'>('queue');
const isMobile = ref(false);

const csrfToken = (): string | null => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta?.getAttribute('content') ?? null;
};

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: {
        query?: Record<string, string | number | null | undefined>;
        body?: Record<string, unknown>;
        signal?: AbortSignal;
    },
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);

    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
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
        signal: options?.signal,
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        const message =
            (payload as any)?.message ??
            `Request failed (${response.status})`;
        throw new Error(message);
    }

    return (await response.json()) as T;
}

async function loadQueue() {
    if (searchAbortController) {
        searchAbortController.abort();
    }
    searchAbortController = new AbortController();
    const signal = searchAbortController.signal;

    listLoading.value = true;
    queueError.value = null;

    try {
        const response = await apiRequest<CashierQueueResponse>(
            'GET',
            '/billing-invoices/cashier-queue',
            {
                query: {
                    q: searchQuery.value.trim() || null,
                    status: statusFilter.value === 'all' ? null : statusFilter.value,
                    page: currentPage.value,
                    perPage: 20,
                },
                signal,
            },
        );

        queueEntries.value = response.data;
        pagination.value = response.meta;
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        queueEntries.value = [];
        pagination.value = null;
        const message = error instanceof Error ? error.message : 'Unable to load billing queue.';
        queueError.value = message;
    } finally {
        if (!signal.aborted) {
            listLoading.value = false;
            pageLoading.value = false;
        }
    }
}

async function selectPatient(entry: CashierQueueEntry) {
    selectedPatient.value = entry;
    patientInvoices.value = [];
    chargeCaptureCandidates.value = [];
    selectedInvoiceIds.value.clear();

    if (isMobile.value) mobileView.value = 'detail';

    patientInvoicesLoading.value = true;
    chargeCandidatesLoading.value = true;

    try {
        const [invoicesResponse, candidatesResponse] = await Promise.all([
            apiRequest<{ data: Invoice[] }>('GET', '/billing-invoices', {
                query: {
                    patientId: entry.patientId,
                    perPage: 50,
                    sortBy: 'invoiceDate',
                    sortDir: 'desc',
                },
            }),
            apiRequest<{ data: any[] }>('GET', '/billing-invoices/charge-capture-candidates', {
                query: {
                    patientId: entry.patientId,
                    includeInvoiced: 'false',
                    limit: 100,
                },
            }),
        ]);

        patientInvoices.value = invoicesResponse.data;
        chargeCaptureCandidates.value = candidatesResponse.data;
    } catch (error) {
        notifyError(
            error instanceof Error
                ? error.message
                : 'Unable to load patient details.',
        );
    } finally {
        patientInvoicesLoading.value = false;
        chargeCandidatesLoading.value = false;
    }
}

function openPaymentDialog(invoice: Invoice) {
    paymentInvoice.value = invoice;
    paymentAmount.value = invoice.balanceAmount;
    paymentMethod.value = 'cash';
    paymentReference.value = '';
    showPaymentDialog.value = true;
}

function loadDraftPayment() {
    try {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw) as { invoiceId?: string; amount?: number; method?: string; reference?: string };
        if (draft.invoiceId && paymentInvoice.value?.id === draft.invoiceId) {
            if (draft.amount !== undefined && draft.amount > 0) paymentAmount.value = draft.amount;
            if (draft.method) paymentMethod.value = draft.method;
            if (draft.reference !== undefined) paymentReference.value = draft.reference;
        }
    } catch { /* ignore corrupted draft */ }
}

function saveDraftPayment() {
    if (!paymentInvoice.value) return;
    try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
            invoiceId: paymentInvoice.value.id,
            amount: paymentAmount.value,
            method: paymentMethod.value,
            reference: paymentReference.value,
        }));
    } catch { /* storage full, ignore */ }
}

function clearDraftPayment() {
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* ignore */ }
}

function printReceipt(invoice: Invoice, paymentAmount: number, paymentMethodStr: string) {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const facilityName = document.querySelector('meta[name="app-name"]')?.getAttribute('content') ?? 'Health Facility';
    const now = new Date().toLocaleString('en-TZ', { dateStyle: 'medium', timeStyle: 'short' });

    const lineItemsHtml = invoice.lineItems.map((item) => `
        <tr>
            <td style="padding:4px 0;text-align:left;font-size:11px;">${item.description}</td>
            <td style="padding:4px 0;text-align:center;font-size:11px;">${item.quantity}</td>
            <td style="padding:4px 0;text-align:right;font-size:11px;">${formatMoney(item.unitPrice * item.quantity)}</td>
        </tr>
    `).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receipt - ${invoice.invoiceNumber || 'Draft'}</title>
            <style>
                body { font-family: 'Courier New', monospace; margin: 0; padding: 20px; max-width: 360px; }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .divider { border-top: 1px dashed #000; margin: 8px 0; }
                table { width: 100%; border-collapse: collapse; }
                @media print { body { padding: 10px; } }
            </style>
        </head>
        <body>
            <div class="center bold" style="font-size:14px;">${facilityName}</div>
            <div class="center" style="font-size:10px;color:#666;">Payment Receipt</div>
            <div class="divider"></div>
            <div style="font-size:11px;">
                <div><strong>Invoice:</strong> ${invoice.invoiceNumber || 'Draft'}</div>
                <div><strong>Date:</strong> ${now}</div>
                <div><strong>Method:</strong> ${formatEnumLabel(paymentMethodStr)}</div>
            </div>
            <div class="divider"></div>
            <table>
                <thead>
                    <tr>
                        <th style="text-align:left;font-size:10px;border-bottom:1px solid #ccc;">Item</th>
                        <th style="text-align:center;font-size:10px;border-bottom:1px solid #ccc;">Qty</th>
                        <th style="text-align:right;font-size:10px;border-bottom:1px solid #ccc;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${lineItemsHtml}
                </tbody>
            </table>
            <div class="divider"></div>
            <div style="font-size:12px;">
                <div style="display:flex;justify-content:space-between;"><span class="bold">Total:</span><span class="bold">${formatMoney(invoice.totalAmount)}</span></div>
                <div style="display:flex;justify-content:space-between;"><span class="bold">Paid:</span><span class="bold">${formatMoney(paymentAmount)}</span></div>
                <div style="display:flex;justify-content:space-between;"><span class="bold">Balance:</span><span class="bold">${formatMoney(invoice.totalAmount - paymentAmount)}</span></div>
            </div>
            <div class="divider"></div>
            <div class="center" style="font-size:10px;color:#666;">Thank you for your payment</div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
}

function applyOptimisticPayment(invoice: Invoice, amount: number) {
    const newPaidAmount = invoice.paidAmount + amount;
    const newBalance = invoice.totalAmount - newPaidAmount;

    return {
        ...invoice,
        paidAmount: newPaidAmount,
        balanceAmount: Math.max(0, newBalance),
        status: newBalance <= 0 ? 'paid' : newPaidAmount > 0 ? 'partially_paid' : invoice.status,
    };
}

function revertOptimisticPayment(invoice: Invoice, entry: UndoEntry) {
    return {
        ...invoice,
        paidAmount: entry.previousPaidAmount,
        balanceAmount: entry.previousBalance,
        status: entry.previousStatus,
    };
}

function updateQueueForPatient(patient: CashierQueueEntry, invoices: Invoice[]) {
    const updatedUnpaid = invoices.filter(
        (inv) => inv.status !== 'cancelled' && inv.status !== 'voided' && inv.balanceAmount > 0,
    );
    const updatedPaid = invoices.filter(
        (inv) => inv.balanceAmount <= 0 && inv.status !== 'cancelled' && inv.status !== 'voided',
    );
    return {
        ...patient,
        unpaidInvoiceCount: updatedUnpaid.length,
        totalUnpaidAmount: updatedUnpaid.reduce((sum, inv) => sum + inv.balanceAmount, 0),
        paidInvoiceCount: updatedPaid.length,
        totalPaidAmount: updatedPaid.reduce((sum, inv) => sum + inv.totalAmount, 0),
    };
}

function showUndoToastMessage() {
    showUndoToast.value = true;
    if (undoTimer.value) clearTimeout(undoTimer.value);
    undoTimer.value = setTimeout(() => {
        showUndoToast.value = false;
        undoStack.value = [];
    }, 10_000);
}

async function undoLastPayment() {
    const entry = undoStack.value.pop();
    if (!entry) return;

    showUndoToast.value = false;
    if (undoTimer.value) clearTimeout(undoTimer.value);

    const patient = selectedPatient.value;
    if (patient) {
        patientInvoices.value = patientInvoices.value.map((inv) => {
            if (inv.id !== entry.invoiceId) return inv;
            return revertOptimisticPayment(inv, entry);
        });
        queueEntries.value = queueEntries.value.map((e) => {
            if (e.patientId !== patient.patientId) return e;
            return updateQueueForPatient(e, patientInvoices.value);
        });
    }

    notifySuccess('Payment reversed.');

    try {
        await apiRequest('POST', `/billing-invoices/${entry.invoiceId}/payments/undo`, {
            body: { amount: entry.amount, paymentMethod: entry.method },
        });
        if (patient) await selectPatient(patient);
        await loadQueue();
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to undo payment.');
        if (patient) await selectPatient(patient);
        await loadQueue();
    }
}

async function recordPayment() {
    if (!paymentInvoice.value || paymentAmount.value <= 0) return;

    const invoice = paymentInvoice.value;
    const amount = paymentAmount.value;
    const method = paymentMethod.value;
    const reference = paymentReference.value;
    const patient = selectedPatient.value;

    showPaymentDialog.value = false;
    clearDraftPayment();

    if (patient) {
        const undoEntry: UndoEntry = {
            invoiceId: invoice.id,
            amount,
            method,
            reference,
            previousPaidAmount: invoice.paidAmount,
            previousBalance: invoice.balanceAmount,
            previousStatus: invoice.status,
        };
        undoStack.value.push(undoEntry);

        patientInvoices.value = patientInvoices.value.map((inv) => {
            if (inv.id !== invoice.id) return inv;
            return applyOptimisticPayment(inv, amount);
        });
        queueEntries.value = queueEntries.value.map((entry) => {
            if (entry.patientId !== patient.patientId) return entry;
            return updateQueueForPatient(entry, patientInvoices.value);
        });
    }

    showUndoToastMessage();

    try {
        await apiRequest<PaymentResponse>(
            'POST',
            `/billing-invoices/${invoice.id}/payments`,
            {
                body: {
                    amount,
                    payerType: 'patient',
                    paymentMethod: method,
                    paymentReference: reference || null,
                },
            },
        );

        printReceipt(invoice, amount, method);

        if (patient) await selectPatient(patient);
        await loadQueue();
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to record payment.');
        if (patient) await selectPatient(patient);
        await loadQueue();
    }
}

function toggleInvoiceSelection(invoiceId: string) {
    if (selectedInvoiceIds.value.has(invoiceId)) {
        selectedInvoiceIds.value.delete(invoiceId);
    } else {
        selectedInvoiceIds.value.add(invoiceId);
    }
    selectedInvoiceIds.value = new Set(selectedInvoiceIds.value);
}

const selectedUnpaidInvoices = computed(() =>
    patientInvoices.value.filter(
        (inv) => selectedInvoiceIds.value.has(inv.id) && inv.balanceAmount > 0 && inv.status !== 'cancelled' && inv.status !== 'voided',
    ),
);

const bulkTotalAmount = computed(() =>
    selectedUnpaidInvoices.value.reduce((sum, inv) => sum + inv.balanceAmount, 0),
);

function openBulkPaymentDialog() {
    if (selectedUnpaidInvoices.value.length === 0) return;
    bulkPaymentAmount.value = bulkTotalAmount.value;
    bulkPaymentMethod.value = 'cash';
    bulkPaymentReference.value = '';
    showBulkPaymentDialog.value = true;
}

async function recordBulkPayment() {
    if (selectedUnpaidInvoices.value.length === 0 || bulkPaymentAmount.value <= 0) return;

    const invoices = [...selectedUnpaidInvoices.value];
    const totalAmount = bulkPaymentAmount.value;
    const method = bulkPaymentMethod.value;
    const reference = bulkPaymentReference.value;
    const patient = selectedPatient.value;

    showBulkPaymentDialog.value = false;
    selectedInvoiceIds.value.clear();
    selectedInvoiceIds.value = new Set();

    if (patient) {
        const perInvoiceAmount = totalAmount / invoices.length;
        patientInvoices.value = patientInvoices.value.map((inv) => {
            const selected = invoices.find((i) => i.id === inv.id);
            if (!selected) return inv;
            return applyOptimisticPayment(inv, perInvoiceAmount);
        });
        queueEntries.value = queueEntries.value.map((entry) => {
            if (entry.patientId !== patient.patientId) return entry;
            return updateQueueForPatient(entry, patientInvoices.value);
        });
    }

    notifySuccess(`Payment of ${formatMoney(totalAmount)} recorded for ${invoices.length} invoices.`);

    try {
        for (const inv of invoices) {
            const perInvoiceAmount = totalAmount / invoices.length;
            await apiRequest('POST', `/billing-invoices/${inv.id}/payments`, {
                body: {
                    amount: perInvoiceAmount,
                    payerType: 'patient',
                    paymentMethod: method,
                    paymentReference: reference || null,
                },
            });
        }
        if (patient) await selectPatient(patient);
        await loadQueue();
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to record bulk payment.');
        if (patient) await selectPatient(patient);
        await loadQueue();
    }
}

function formatMoney(amount: number): string {
    return new Intl.NumberFormat('en-TZ', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

type BadgeVariant = 'outline' | 'default' | 'secondary' | 'destructive';

function statusVariant(status: string): BadgeVariant {
    switch (status) {
        case 'draft': return 'outline';
        case 'issued': return 'default';
        case 'partially_paid': return 'secondary';
        case 'paid': return 'default';
        case 'cancelled': return 'destructive';
        case 'voided': return 'destructive';
        default: return 'outline';
    }
}

function invoiceStatusLabel(status: string): string {
    return formatEnumLabel(status);
}

function queueStatusDotClass(entry: CashierQueueEntry): string {
    if (entry.inConsultation) return 'bg-blue-500';
    if (entry.unpaidInvoiceCount > 0) return 'bg-destructive';
    if (entry.unbilledServiceCount > 0) return 'bg-amber-500';
    return 'bg-emerald-500';
}

function queueStatusTitle(entry: CashierQueueEntry): string {
    if (entry.inConsultation) return 'In consultation';
    if (entry.unpaidInvoiceCount > 0) return 'Has unpaid invoices';
    if (entry.unbilledServiceCount > 0) return 'Has unbilled services';
    return 'Fully paid';
}

const unpaidInvoices = computed(() =>
    patientInvoices.value.filter(
        (inv) => inv.status !== 'cancelled' && inv.status !== 'voided' && inv.balanceAmount > 0,
    ),
);

const totalUnpaid = computed(() =>
    unpaidInvoices.value.reduce((sum, inv) => sum + inv.balanceAmount, 0),
);

const totalBilled = computed(() =>
    patientInvoices.value.reduce((sum, inv) => sum + inv.totalAmount, 0),
);

const pricedCandidates = computed(() =>
    chargeCaptureCandidates.value.filter(
        (c) => c.pricingStatus === 'priced' && !c.alreadyInvoiced,
    ),
);

const unpricedCandidates = computed(() =>
    chargeCaptureCandidates.value.filter(
        (c) => c.pricingStatus !== 'priced' && !c.alreadyInvoiced,
    ),
);

const hasActiveFilters = computed(() => statusFilter.value !== 'all' || searchQuery.value.trim() !== '');

const activeFilterChips = computed(() => {
    const chips: string[] = [];
    if (statusFilter.value !== 'all') {
        const labels: Record<string, string> = {
            in_consultation: 'In consultation',
            unpaid: 'Has unpaid invoices',
            paid: 'Fully paid',
        };
        chips.push(labels[statusFilter.value] ?? statusFilter.value);
    }
    if (searchQuery.value.trim() !== '') {
        chips.push(`Search: "${searchQuery.value.trim()}"`);
    }
    return chips;
});

function clearAllFilters() {
    searchQuery.value = '';
    statusFilter.value = 'all';
    currentPage.value = 1;
    loadQueue();
}

const queuePages = computed<(number | '...')[]>(() => {
    if (!pagination.value) return [];
    const { currentPage: cur, lastPage } = pagination.value;
    if (lastPage <= 1) return [];
    const pages: (number | '...')[] = [];
    const showLeft = Math.max(1, cur - 2);
    const showRight = Math.min(lastPage, cur + 2);
    if (showLeft > 1) pages.push(1);
    if (showLeft > 2) pages.push('...');
    for (let i = showLeft; i <= showRight; i++) pages.push(i);
    if (showRight < lastPage - 1) pages.push('...');
    if (showRight < lastPage) pages.push(lastPage);
    return pages;
});

function goToPage(page: number) {
    currentPage.value = page;
    loadQueue();
}

function startAutoRefresh() {
    stopAutoRefresh();
    const interval = AUTO_REFRESH_INTERVALS[autoRefreshInterval.value];
    if (interval <= 0) return;
    autoRefreshTimer = setInterval(() => {
        if (!listLoading.value && !pageLoading.value) {
            loadQueue();
            if (selectedPatient.value) selectPatient(selectedPatient.value);
        }
    }, interval);
}

function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
}

function checkMobile() {
    isMobile.value = window.innerWidth < 768;
}

function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && showPaymentDialog.value) {
        saveDraftPayment();
        showPaymentDialog.value = false;
    }
    if (event.key === 'Enter' && showPaymentDialog.value && !paymentSaving.value) {
        event.preventDefault();
        recordPayment();
    }
    if (event.key === 'Enter' && showBulkPaymentDialog.value && !bulkPaymentSaving.value) {
        event.preventDefault();
        recordBulkPayment();
    }
}

onMounted(() => {
    loadQueue();
    checkMobile();
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', checkMobile);
});

onBeforeUnmount(() => {
    stopAutoRefresh();
    if (searchAbortController) searchAbortController.abort();
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('resize', checkMobile);
    if (undoTimer.value) clearTimeout(undoTimer.value);
});

watchDebounced(
    searchQuery,
    () => {
        if (searchQuery.value.trim().length === 1) return;
        currentPage.value = 1;
        loadQueue();
    },
    { debounce: 400, maxWait: 1200 },
);

watch(statusFilter, () => {
    currentPage.value = 1;
    loadQueue();
});

watch(autoRefreshInterval, () => {
    startAutoRefresh();
});

watch(showPaymentDialog, (open) => {
    if (open) loadDraftPayment();
});
</script>

<template>
    <Head title="Billing" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <!-- Page header (section card pattern matching FacilityWorkspacePageHeader) -->
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="receipt" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">Billing</h1>
                                <Badge v-if="pagination" variant="secondary" class="h-5 px-1.5 text-[10px] font-medium tabular-nums">
                                    {{ pagination.total }} patients
                                </Badge>
                            </div>
                            <p class="truncate text-xs text-muted-foreground">
                                Patient billing queue — select a patient to view charges and record payments
                            </p>
                            <div
                                v-if="platformScope?.facility?.name"
                                class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground"
                            >
                                <span class="inline-flex items-center gap-1">
                                    <AppIcon name="building-2" class="size-3 opacity-75" aria-hidden="true" />
                                    <span class="font-medium text-foreground">{{ platformScope.facility.name }}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <Select v-model="autoRefreshInterval">
                            <SelectTrigger class="h-8 w-[6rem] text-xs" :title="autoRefreshInterval !== 'off' ? `Auto-refresh every ${autoRefreshInterval}` : 'Auto-refresh off'">
                                <SelectValue placeholder="Auto" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="(label, key) in AUTO_REFRESH_LABELS" :key="key" :value="key">{{ label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="ghost"
                            size="sm"
                            class="h-8 w-8 p-0"
                            :disabled="listLoading"
                            title="Refresh queue"
                            @click="loadQueue(); if (selectedPatient) selectPatient(selectedPatient)"
                        >
                            <AppIcon :name="(listLoading ? 'loader-circle' : 'refresh-cw')" class="size-3.5" :class="listLoading ? 'animate-spin' : ''" />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                                    <AppIcon name="ellipsis-vertical" class="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" class="w-48">
                                <DropdownMenuItem @click="loadQueue(); if (selectedPatient) selectPatient(selectedPatient)">
                                    <AppIcon name="refresh-cw" class="size-4" /> Refresh queue
                                </DropdownMenuItem>
                                <DropdownMenuItem as-child>
                                    <a href="/billing-cash" class="gap-2">
                                        <AppIcon name="banknote" class="size-4" /> Cash payments
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem as-child>
                                    <a href="/billing-refunds" class="gap-2">
                                        <AppIcon name="undo-2" class="size-4" /> Refunds
                                    </a>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </section>

            <BillingModuleNav />

            <!-- Main content: master-detail layout -->
            <Card class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <!-- Search & Filters bar -->
                    <div class="flex flex-col gap-3 border-b px-4 py-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div class="min-w-0 shrink-0">
                                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                    <AppIcon name="receipt" class="size-4 text-primary" />
                                    Cashier Queue
                                </h3>
                                <p class="mt-1 text-xs text-muted-foreground">Select a patient to view invoices and record payments</p>
                            </div>
                            <div class="flex min-w-0 items-center gap-2">
                                <div class="relative min-w-0 flex-1 lg:flex-none">
                                    <AppIcon name="search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        v-model="searchQuery"
                                        class="h-8 w-full pl-9 text-xs lg:w-80"
                                        placeholder="Search by name, MRN, or phone..."
                                    />
                                </div>
                                <Select v-model="statusFilter">
                                    <SelectTrigger class="h-8 w-44 rounded-lg text-xs">
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="in_consultation">In consultation</SelectItem>
                                        <SelectItem value="unpaid">Has unpaid invoices</SelectItem>
                                        <SelectItem value="paid">Fully paid</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <!-- Active filter chips -->
                        <div v-if="hasActiveFilters" class="flex flex-wrap items-center gap-1.5 border-t py-2">
                            <span class="text-[11px] text-muted-foreground">Filters:</span>
                            <Badge v-for="chip in activeFilterChips" :key="chip" variant="outline" class="text-[11px]">
                                {{ chip }}
                            </Badge>
                            <button class="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline" @click="clearAllFilters">
                                Clear all
                            </button>
                        </div>
                    </div>

                    <!-- Error banner -->
                    <div
                        v-if="queueError"
                        class="mx-4 mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
                    >
                        <div class="flex items-start gap-2.5">
                            <AppIcon name="alert-triangle" class="mt-0.5 size-4 shrink-0 text-destructive" />
                            <div class="min-w-0">
                                <p class="text-sm font-medium text-destructive">Unable to load billing queue</p>
                                <p class="mt-1 text-xs text-muted-foreground break-all">{{ queueError }}</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                class="ml-auto h-7 shrink-0 px-2"
                                @click="queueError = null; loadQueue()"
                            >
                                <AppIcon name="refresh-cw" class="mr-1 size-3" />
                                Retry
                            </Button>
                        </div>
                    </div>

                    <!-- Master-detail split -->
                    <div class="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
                        <!-- Left: Queue (hidden on mobile when detail is showing) -->
                        <div
                            class="flex min-h-0 flex-col border-b md:block md:border-r md:border-b-0"
                            :class="[
                                selectedPatient ? 'md:w-96' : 'md:flex-1',
                                isMobile && mobileView === 'detail' ? 'hidden' : '',
                            ]"
                        >
                            <ScrollArea class="min-h-0 flex-1">
                                <RegistryListSkeleton v-if="pageLoading || listLoading" :count="5" />
                                <div v-else-if="queueEntries.length === 0" class="p-4">
                                    <InventoryEmptyState
                                        icon="check-circle"
                                        title="No patients in queue"
                                        description="All patients have been served or no pending charges found."
                                    />
                                </div>
                                <div
                                    v-show="queueEntries.length > 0"
                                    class="divide-y px-4"
                                    :class="{ 'opacity-40 pointer-events-none transition-opacity duration-200': listLoading }"
                                >
                                    <RegistryListRow
                                        v-for="entry in queueEntries"
                                        :key="entry.patientId"
                                        :status-dot-class="queueStatusDotClass(entry)"
                                        :status-title="queueStatusTitle(entry)"
                                        :flash="selectedPatient?.patientId === entry.patientId"
                                        @select="selectPatient(entry)"
                                    >
                                        <template #title>
                                            <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                                <span class="truncate text-sm font-medium transition-colors hover:text-primary">{{ entry.patientName }}</span>
                                                <Badge
                                                    v-if="entry.inConsultation"
                                                    variant="default"
                                                    class="h-4.5 bg-blue-500 px-1.5 text-[10px] font-normal leading-none text-white"
                                                >
                                                    In consultation
                                                </Badge>
                                            </div>
                                        </template>
                                        <template #meta>
                                            <p class="truncate text-xs text-muted-foreground">
                                                {{ entry.patientNumber }}
                                                <span v-if="entry.phone"> · {{ entry.phone }}</span>
                                                — {{ entry.summaryLabel }}
                                            </p>
                                        </template>
                                        <template #badges>
                                            <Badge
                                                v-if="entry.unpaidInvoiceCount > 0"
                                                variant="destructive"
                                                class="h-5 px-1.5 text-[10px] tabular-nums"
                                            >
                                                {{ formatMoney(entry.totalUnpaidAmount) }}
                                            </Badge>
                                            <Badge
                                                v-if="entry.unbilledServiceCount > 0"
                                                variant="secondary"
                                                class="h-5 px-1.5 text-[10px] tabular-nums"
                                            >
                                                {{ entry.unbilledServiceCount }} unbilled
                                            </Badge>
                                        </template>
                                        <template #actions>
                                            <PatientSummaryPopover v-if="entry.patientId" :patient-id="entry.patientId">
                                                <template #trigger>
                                                    <button
                                                        type="button"
                                                        class="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                                        aria-label="View patient summary"
                                                    >
                                                        <AppIcon name="info" class="size-3.5" />
                                                    </button>
                                                </template>
                                                <template #actions>
                                                    <a :href="`/patients/${entry.patientId}/chart`" class="text-xs font-medium text-primary hover:underline">
                                                        View chart
                                                    </a>
                                                </template>
                                            </PatientSummaryPopover>
                                            <AppIcon name="chevron-right" class="size-4 text-muted-foreground" />
                                        </template>
                                    </RegistryListRow>
                                </div>
                            </ScrollArea>

                            <!-- Pagination footer -->
                            <footer
                                v-if="pagination && pagination.lastPage > 1"
                                class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2"
                            >
                                <p class="text-xs text-muted-foreground">
                                    Showing {{ queueEntries.length }} of {{ pagination.total }} results &middot; Page {{ currentPage }} of {{ pagination.lastPage }}
                                </p>
                                <div class="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="gap-1.5"
                                        :disabled="currentPage <= 1 || listLoading"
                                        @click="goToPage(currentPage - 1)"
                                    >
                                        <AppIcon name="chevron-left" class="size-3.5" />
                                        Previous
                                    </Button>
                                    <template v-for="pg in queuePages" :key="typeof pg === 'number' ? `qp-${pg}` : `qp-e-${Math.random()}`">
                                        <span v-if="pg === '...'" class="px-1 text-xs text-muted-foreground">&hellip;</span>
                                        <Button
                                            v-else
                                            size="sm"
                                            :variant="pg === currentPage ? 'default' : 'outline'"
                                            class="h-8 w-8 p-0"
                                            :disabled="listLoading"
                                            @click="goToPage(pg)"
                                        >
                                            {{ pg }}
                                        </Button>
                                    </template>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="gap-1.5"
                                        :disabled="currentPage >= pagination.lastPage || listLoading"
                                        @click="goToPage(currentPage + 1)"
                                    >
                                        Next
                                        <AppIcon name="chevron-right" class="size-3.5" />
                                    </Button>
                                </div>
                            </footer>
                        </div>

                        <!-- Right: Patient Detail Panel -->
                        <div
                            v-if="selectedPatient"
                            class="flex min-h-0 flex-1 flex-col overflow-hidden md:block"
                            :class="isMobile && mobileView === 'queue' ? 'hidden' : ''"
                        >
                            <!-- Patient Header -->
                            <div class="flex items-center justify-between border-b px-4 py-3">
                                <div class="flex items-center gap-2">
                                    <Button
                                        v-if="isMobile"
                                        variant="ghost"
                                        size="sm"
                                        class="h-8 w-8 p-0 md:hidden"
                                        @click="mobileView = 'queue'"
                                    >
                                        <AppIcon name="chevron-left" class="size-4" />
                                    </Button>
                                    <div>
                                        <h2 class="text-base font-semibold">{{ selectedPatient.patientName }}</h2>
                                        <p class="text-xs text-muted-foreground">
                                            {{ selectedPatient.patientNumber }}
                                            <span v-if="selectedPatient.phone"> · {{ selectedPatient.phone }}</span>
                                        </p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <Button
                                        v-if="selectedUnpaidInvoices.length > 0"
                                        size="sm"
                                        variant="default"
                                        @click="openBulkPaymentDialog"
                                    >
                                        Pay Selected ({{ selectedUnpaidInvoices.length }})
                                    </Button>
                                    <Button variant="ghost" size="sm" @click="selectedPatient = null; if (isMobile) mobileView = 'queue'">
                                        <AppIcon name="x" class="size-4" />
                                    </Button>
                                </div>
                            </div>

                            <Tabs default-value="invoices" class="flex min-h-0 flex-1 flex-col overflow-hidden">
                                <TabsList class="grid h-9 w-full grid-cols-2 gap-1 bg-muted/40 p-1 mx-4 mt-2">
                                    <TabsTrigger
                                        value="invoices"
                                        class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                                    >
                                        <span class="flex items-center gap-1 leading-none">
                                            <AppIcon name="receipt" class="size-3" />
                                            Invoices
                                            <Badge v-if="unpaidInvoices.length > 0" variant="destructive" class="ml-1 h-4.5 px-1.5 text-[10px]">
                                                {{ unpaidInvoices.length }}
                                            </Badge>
                                        </span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="unbilled"
                                        class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                                    >
                                        <span class="flex items-center gap-1 leading-none">
                                            <AppIcon name="activity" class="size-3" />
                                            Unbilled Services
                                            <Badge v-if="pricedCandidates.length > 0" variant="secondary" class="ml-1 h-4.5 px-1.5 text-[10px]">
                                                {{ pricedCandidates.length }}
                                            </Badge>
                                        </span>
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="invoices" class="m-0 flex min-h-0 flex-1 flex-col overflow-auto p-4">
                                    <div v-if="patientInvoicesLoading" class="space-y-3">
                                        <RegistryListSkeleton :count="3" />
                                    </div>

                                    <div v-else-if="patientInvoices.length === 0" class="py-4">
                                        <InventoryEmptyState
                                            icon="receipt"
                                            title="No invoices found"
                                            description="This patient has no invoices yet."
                                            compact
                                        />
                                    </div>

                                    <div v-else class="space-y-3">
                                        <div class="grid grid-cols-3 gap-3 mb-4">
                                            <Card>
                                                <CardHeader class="pb-1">
                                                    <CardTitle class="text-xs text-muted-foreground">Total Billed</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <p class="text-lg font-bold tabular-nums">{{ formatMoney(totalBilled) }}</p>
                                                </CardContent>
                                            </Card>
                                            <Card>
                                                <CardHeader class="pb-1">
                                                    <CardTitle class="text-xs text-muted-foreground">Unpaid</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <p class="text-lg font-bold text-destructive tabular-nums">{{ formatMoney(totalUnpaid) }}</p>
                                                </CardContent>
                                            </Card>
                                            <Card>
                                                <CardHeader class="pb-1">
                                                    <CardTitle class="text-xs text-muted-foreground">Invoices</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <p class="text-lg font-bold tabular-nums">{{ patientInvoices.length }}</p>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        <div
                                            v-for="invoice in patientInvoices"
                                            :key="invoice.id"
                                            class="rounded-lg border p-3"
                                        >
                                            <div class="flex items-start justify-between gap-2">
                                                <div class="flex items-start gap-2">
                                                    <Checkbox
                                                        v-if="invoice.balanceAmount > 0 && invoice.status !== 'cancelled' && invoice.status !== 'voided'"
                                                        :checked="selectedInvoiceIds.has(invoice.id)"
                                                        class="mt-0.5"
                                                        @update:checked="toggleInvoiceSelection(invoice.id)"
                                                    />
                                                    <div>
                                                        <div class="flex items-center gap-2">
                                                            <p class="text-sm font-medium">
                                                                {{ invoice.invoiceNumber || 'Draft' }}
                                                            </p>
                                                            <Badge :variant="statusVariant(invoice.status)" class="text-[10px]">
                                                                {{ invoiceStatusLabel(invoice.status) }}
                                                            </Badge>
                                                        </div>
                                                        <p class="text-xs text-muted-foreground mt-0.5">
                                                            {{ invoice.invoiceDate }}
                                                            <span v-if="invoice.paymentDueAt"> · Due {{ invoice.paymentDueAt }}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div class="text-right">
                                                    <p class="text-sm font-semibold tabular-nums">{{ formatMoney(invoice.totalAmount) }}</p>
                                                    <p v-if="invoice.balanceAmount > 0" class="text-xs text-destructive tabular-nums">
                                                        Balance: {{ formatMoney(invoice.balanceAmount) }}
                                                    </p>
                                                </div>
                                            </div>

                                            <div v-if="invoice.lineItems?.length > 0" class="mt-2 space-y-1">
                                                <div
                                                    v-for="(item, idx) in invoice.lineItems.slice(0, 3)"
                                                    :key="idx"
                                                    class="flex items-center justify-between text-xs text-muted-foreground"
                                                >
                                                    <span class="truncate">{{ item.description }}</span>
                                                    <span class="tabular-nums">{{ formatMoney(item.unitPrice * item.quantity) }}</span>
                                                </div>
                                                <p v-if="invoice.lineItems.length > 3" class="text-xs text-muted-foreground">
                                                    +{{ invoice.lineItems.length - 3 }} more items
                                                </p>
                                            </div>

                                            <div class="mt-2 flex gap-2">
                                                <Button
                                                    v-if="invoice.balanceAmount > 0 && invoice.status !== 'cancelled' && invoice.status !== 'voided'"
                                                    size="sm"
                                                    @click="openPaymentDialog(invoice)"
                                                >
                                                    Record Payment
                                                </Button>
                                                <Badge v-else-if="invoice.balanceAmount <= 0" variant="default" class="text-[10px]">
                                                    Paid
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="unbilled" class="m-0 flex min-h-0 flex-1 flex-col overflow-auto p-4">
                                    <div v-if="chargeCandidatesLoading" class="space-y-3">
                                        <RegistryListSkeleton :count="3" />
                                    </div>

                                    <div v-else-if="chargeCaptureCandidates.length === 0" class="py-4">
                                        <InventoryEmptyState
                                            icon="activity"
                                            title="No unbilled services"
                                            description="No unbilled services found for this patient."
                                            compact
                                        />
                                    </div>

                                    <div v-else class="space-y-3">
                                        <div v-if="pricedCandidates.length > 0">
                                            <p class="text-xs font-medium text-muted-foreground mb-2">
                                                Ready to bill ({{ pricedCandidates.length }})
                                            </p>
                                            <div
                                                v-for="candidate in pricedCandidates"
                                                :key="candidate.id"
                                                class="rounded-lg border p-3"
                                            >
                                                <div class="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p class="text-sm font-medium">{{ candidate.serviceName || candidate.sourceWorkflowLabel }}</p>
                                                        <div class="flex items-center gap-2 mt-0.5">
                                                            <Badge variant="outline" class="text-[10px]">
                                                                {{ formatEnumLabel(candidate.serviceType || candidate.sourceWorkflowKind) }}
                                                            </Badge>
                                                            <span class="text-xs text-muted-foreground">
                                                                {{ candidate.sourceWorkflowLabel }}
                                                            </span>
                                                            <span v-if="candidate.performedAt" class="text-xs text-muted-foreground">
                                                                · {{ candidate.performedAt }}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <p class="text-sm font-semibold tabular-nums">{{ formatMoney(candidate.lineTotal || candidate.unitPrice || 0) }}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div v-if="unpricedCandidates.length > 0">
                                            <Separator class="my-3" />
                                            <p class="text-xs font-medium text-muted-foreground mb-2">
                                                Needs pricing ({{ unpricedCandidates.length }})
                                            </p>
                                            <div
                                                v-for="candidate in unpricedCandidates"
                                                :key="candidate.id"
                                                class="rounded-lg border border-dashed p-3 opacity-60"
                                            >
                                                <div class="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p class="text-sm font-medium">{{ candidate.serviceName || candidate.sourceWorkflowLabel }}</p>
                                                        <div class="flex items-center gap-2 mt-0.5">
                                                            <Badge variant="outline" class="text-[10px]">
                                                                {{ formatEnumLabel(candidate.serviceType || candidate.sourceWorkflowKind) }}
                                                            </Badge>
                                                            <span class="text-xs text-muted-foreground">
                                                                {{ candidate.sourceWorkflowLabel }}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Badge variant="secondary" class="text-[10px]">No price</Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </div>
            </Card>
        </div>

        <!-- Single Payment Sheet -->
        <Sheet v-model:open="showPaymentDialog">
            <SheetContent side="right" variant="form" size="xl">
                <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                    <SheetTitle>Record Payment</SheetTitle>
                    <SheetDescription>
                        {{ paymentInvoice?.invoiceNumber || 'Draft invoice' }}
                        — Balance: {{ formatMoney(paymentInvoice?.balanceAmount || 0) }}
                    </SheetDescription>
                </SheetHeader>

                <div class="flex-1 space-y-4 overflow-y-auto p-4">
                    <div>
                        <Label for="paymentAmount">Amount</Label>
                        <Input
                            id="paymentAmount"
                            v-model.number="paymentAmount"
                            type="number"
                            min="1"
                            :max="paymentInvoice?.balanceAmount || 0"
                            class="mt-1"
                        />
                    </div>

                    <div>
                        <Label for="paymentMethod">Payment Method</Label>
                        <Select v-model="paymentMethod">
                            <SelectTrigger class="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="card">Card</SelectItem>
                                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="insurance">Insurance</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label for="paymentReference">Reference (optional)</Label>
                        <Input
                            id="paymentReference"
                            v-model="paymentReference"
                            placeholder="Receipt number, transaction ID..."
                            class="mt-1"
                        />
                    </div>
                </div>

                <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                    <p class="mr-auto text-[10px] text-muted-foreground">
                        <kbd class="rounded border bg-muted px-1 py-0.5 text-[10px] font-medium">Enter</kbd> to save
                        · <kbd class="rounded border bg-muted px-1 py-0.5 text-[10px] font-medium">Esc</kbd> to close
                    </p>
                    <Button variant="outline" @click="saveDraftPayment(); showPaymentDialog = false">Cancel</Button>
                    <Button :disabled="paymentAmount <= 0" @click="recordPayment()">
                        Record Payment
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>

        <!-- Bulk Payment Sheet -->
        <Sheet v-model:open="showBulkPaymentDialog">
            <SheetContent side="right" variant="form" size="xl">
                <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                    <SheetTitle>Bulk Payment</SheetTitle>
                    <SheetDescription>
                        {{ selectedUnpaidInvoices.length }} invoices selected — Total: {{ formatMoney(bulkTotalAmount) }}
                    </SheetDescription>
                </SheetHeader>

                <div class="flex-1 space-y-4 overflow-y-auto p-4">
                    <div>
                        <Label for="bulkPaymentAmount">Amount</Label>
                        <Input
                            id="bulkPaymentAmount"
                            v-model.number="bulkPaymentAmount"
                            type="number"
                            min="1"
                            :max="bulkTotalAmount"
                            class="mt-1"
                        />
                    </div>

                    <div>
                        <Label for="bulkPaymentMethod">Payment Method</Label>
                        <Select v-model="bulkPaymentMethod">
                            <SelectTrigger class="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="card">Card</SelectItem>
                                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="insurance">Insurance</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label for="bulkPaymentReference">Reference (optional)</Label>
                        <Input
                            id="bulkPaymentReference"
                            v-model="bulkPaymentReference"
                            placeholder="Receipt number, transaction ID..."
                            class="mt-1"
                        />
                    </div>
                </div>

                <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                    <Button variant="outline" @click="showBulkPaymentDialog = false">Cancel</Button>
                    <Button :disabled="bulkPaymentAmount <= 0" @click="recordBulkPayment()">
                        Record Bulk Payment
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>

        <!-- Undo Toast -->
        <Teleport to="body">
            <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="translate-y-2 opacity-0"
                enter-to-class="translate-y-0 opacity-100"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="translate-y-0 opacity-100"
                leave-to-class="translate-y-2 opacity-0"
            >
                <div
                    v-if="showUndoToast"
                    class="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-background p-3 shadow-lg"
                >
                    <AppIcon name="check-circle" class="size-4 text-green-500" />
                    <span class="text-sm">Payment recorded</span>
                    <Button variant="ghost" size="sm" class="text-sm font-medium text-primary" @click="undoLastPayment">
                        Undo
                    </Button>
                </div>
            </Transition>
        </Teleport>
    </AppLayout>
</template>