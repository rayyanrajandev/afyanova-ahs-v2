<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { refDebounced, useDebounceFn, useMediaQuery } from '@vueuse/core';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import InventoryEmptyState from '@/components/inventory/InventoryEmptyState.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import ListPagination from '@/components/ListPagination.vue';
import PatientSummaryPopover from '@/components/patients/summary/PatientSummaryPopover.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useBillingCashierActions } from '@/composables/billingCashierQueue/useBillingCashierActions';
import { useBillingCashierQueue, type CashierQueueEntry } from '@/composables/billingCashierQueue/useBillingCashierQueue';
import { useBillingCashierQueueFilters } from '@/composables/billingCashierQueue/useBillingCashierQueueFilters';
import { useBillingCashierQueueStatusCounts } from '@/composables/billingCashierQueue/useBillingCashierQueueStatusCounts';
import {
    useBillingPatientInvoices,
    type BillingInvoice,
    type ChargeCaptureCandidate,
} from '@/composables/billingCashierQueue/useBillingPatientInvoices';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { BreadcrumbItem } from '@/types';

/**
 * V2 rebuild of the Cashier Queue — same master-detail interaction as
 * billing/Index.vue (queue on the left, invoices/unbilled-charges/payment on
 * the right), rebuilt on this codebase's V2 pages architecture: TanStack
 * Query composables (composables/billingCashierQueue/*) instead of a
 * page-local fetch wrapper, URL-synced "remembered" filters, a sticky
 * search bar (useStickyScrollContainer), and the shared ListPagination
 * component — matching patients/IndexV2.vue and pharmacy-orders/IndexV2.vue.
 *
 * The old page's "Undo" toast called POST .../payments/undo, a route that
 * doesn't exist anywhere server-side (silently 404s today). The only real
 * reversal path is POST .../payments/{paymentId}/reversals
 * (billing.payments.reverse), which requires an audited reason — so Undo now
 * opens a small reason prompt and calls that endpoint for real, gated behind
 * that permission.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canRecordPayments = computed(() => hasAccess('billing.payments.record'));
const canReverseBillingPayments = computed(() => hasAccess('billing.payments.reverse'));
const canCreateInvoices = computed(() => hasAccess('billing.invoices.create'));

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Billing', href: '/billing-invoices' }];

const DRAFT_STORAGE_KEY = 'billing.payment-draft.v1';
const PER_PAGE_STORAGE_KEY = 'billing.queue-per-page.v1';

type UndoEntry = {
    invoiceId: string;
    paymentId: string;
    amount: number;
    method: string;
    reference: string;
    previousPaidAmount: number;
    previousBalance: number;
    previousStatus: string;
    patientId: string;
};

const queryClient = useQueryClient();
const actions = useBillingCashierActions();

const filters = useBillingCashierQueueFilters();
const queue = useBillingCashierQueue(filters);
const statusCounts = useBillingCashierQueueStatusCounts(filters);
const queueEntries = computed(() => queue.data.value?.data ?? []);
const pagination = computed(() => queue.data.value?.meta ?? null);
const pageLoading = computed(() => queue.isLoading.value);
const listLoading = computed(() => queue.isFetching.value);
const queueError = computed(() => (queue.isError.value ? ((queue.error.value as Error | null)?.message ?? 'Unable to load billing queue.') : null));

const selectedPatientId = ref<string | null>(null);
const selectedQueueEntry = computed(() => queueEntries.value.find((e) => e.patientId === selectedPatientId.value) ?? null);
const directPatientIdentity = ref<{ patientNumber: string; patientName: string; phone: string | null } | null>(null);
const selectedIdentity = computed(() => {
    if (selectedQueueEntry.value) return selectedQueueEntry.value;
    if (!selectedPatientId.value || !directPatientIdentity.value) return null;
    return { patientId: selectedPatientId.value, inConsultation: false, ...directPatientIdentity.value };
});

const patientInvoicesQuery = useBillingPatientInvoices(selectedPatientId);
const patientInvoices = computed(() => patientInvoicesQuery.data.value?.invoices ?? []);
const chargeCaptureCandidates = computed(() => patientInvoicesQuery.data.value?.candidates ?? []);
const patientInvoicesLoading = computed(() => patientInvoicesQuery.isLoading.value);

const selectedInvoiceIds = ref<Set<string>>(new Set());
const showBulkPaymentDialog = ref(false);
const bulkPaymentAmount = ref(0);
const bulkPaymentMethod = ref('cash');
const bulkPaymentReference = ref('');
const bulkPaymentSaving = ref(false);

const showPaymentDialog = ref(false);
const paymentInvoice = ref<BillingInvoice | null>(null);
const paymentAmount = ref(0);
const paymentMethod = ref('cash');
const paymentReference = ref('');
const paymentSaving = ref(false);

const capturingCandidateIds = ref<Set<string>>(new Set());
const issuingInvoiceIds = ref<Set<string>>(new Set());

const undoStack = ref<UndoEntry[]>([]);
const showUndoToast = ref(false);
const undoTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const showReversalDialog = ref(false);
const reversalReason = ref('');
const reversalSaving = ref(false);

const compactRows = useLocalStorageBoolean('billing.queue-compact-rows.v1', false);

const mobileView = ref<'queue' | 'detail'>('queue');
const isMobile = useMediaQuery('(max-width: 767px)');

// Deep-link support from patientChartModuleHref('/billing-invoices', ..., {
// focusInvoiceId }) — see loadPatientByIdDirect() below.
const deepLinkParams = new URLSearchParams(window.location.search);
const deepLinkPatientId = deepLinkParams.get('patientId');
const focusInvoiceId = ref(deepLinkParams.get('focusInvoiceId'));

/**
 * Search input is decoupled from filters.q: binding the Input directly to
 * filters.q would fire a new query (and a URL sync) on every keystroke.
 * searchInputRaw debounces (250ms, matching patients/IndexV2.vue) before
 * committing into filters.q. Enter bypasses the debounce for an immediate
 * search.
 */
const searchInputRaw = ref(filters.q);
const searchInputDebounced = refDebounced(searchInputRaw, 250);

watch(searchInputDebounced, (value) => {
    if (filters.q === value) return;
    filters.q = value;
    filters.page = 1;
});

function submitSearchNow(): void {
    if (filters.q === searchInputRaw.value) return;
    filters.q = searchInputRaw.value;
    filters.page = 1;
}

function setStatus(value: string | number): void {
    filters.status = String(value) as typeof filters.status;
    filters.page = 1;
}

function setPerPage(value: number): void {
    filters.perPage = value;
    filters.page = 1;
    try {
        window.localStorage.setItem(PER_PAGE_STORAGE_KEY, String(value));
    } catch {
        /* storage unavailable, ignore */
    }
}

const hasActiveFilters = computed(() => filters.status !== 'all' || filters.q.trim() !== '');

function clearAllFilters(): void {
    searchInputRaw.value = '';
    filters.q = '';
    filters.status = 'all';
    filters.page = 1;
}

/**
 * Keeps the URL in sync with filters (patients/IndexV2.vue's "remembered
 * filters" contract) so a refresh, a copied link, or the back button all
 * land on the same filtered queue. history.replaceState, not an Inertia
 * visit, so the component never remounts and the TanStack Query cache
 * survives filter changes.
 */
const syncUrl = useDebounceFn(() => {
    const params = new URLSearchParams();
    if (filters.q.trim() !== '') params.set('q', filters.q.trim());
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.perPage !== 20) params.set('perPage', String(filters.perPage));
    if (filters.page !== 1) params.set('page', String(filters.page));

    const query = params.toString();
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(window.history.state, '', newUrl);
}, 300);

watch(filters, () => void syncUrl(), { deep: true });

function goToPage(page: number): void {
    filters.page = page;
}

function refreshQueue(): void {
    void queue.refetch();
    if (selectedPatientId.value) void patientInvoicesQuery.refetch();
}

function selectPatient(entry: CashierQueueEntry): void {
    selectedPatientId.value = entry.patientId;
    directPatientIdentity.value = null;
    selectedInvoiceIds.value = new Set();
    if (isMobile.value) mobileView.value = 'detail';
}

/**
 * Deep-link entry point from patientChartModuleHref('/billing-invoices',
 * ..., { focusInvoiceId }) — the Patient Chart's Billing tab links straight
 * to one invoice. The cashier queue only lists patients with pending
 * payment/unbilled/in-consultation activity, so a fully-paid patient's
 * invoice history may never appear there; this loads that patient's
 * invoices directly instead of requiring queue selection.
 */
async function loadPatientByIdDirect(targetPatientId: string): Promise<void> {
    selectedPatientId.value = targetPatientId;
    selectedInvoiceIds.value = new Set();
    if (isMobile.value) mobileView.value = 'detail';

    const patientResponse = await actions.fetchPatientSummary(targetPatientId);
    const patient = patientResponse?.data ?? null;
    const patientName = patient ? [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() : '';
    directPatientIdentity.value = {
        patientNumber: patient?.patientNumber ?? '',
        patientName: patientName || 'Patient',
        phone: patient?.phone ?? null,
    };
}

function openPaymentDialog(invoice: BillingInvoice): void {
    paymentInvoice.value = invoice;
    paymentAmount.value = invoice.balanceAmount;
    paymentMethod.value = 'cash';
    paymentReference.value = '';
    showPaymentDialog.value = true;
}

function loadDraftPayment(): void {
    try {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw) as { invoiceId?: string; amount?: number; method?: string; reference?: string };
        if (draft.invoiceId && paymentInvoice.value?.id === draft.invoiceId) {
            if (draft.amount !== undefined && draft.amount > 0) paymentAmount.value = draft.amount;
            if (draft.method) paymentMethod.value = draft.method;
            if (draft.reference !== undefined) paymentReference.value = draft.reference;
        }
    } catch {
        /* ignore corrupted draft */
    }
}

function saveDraftPayment(): void {
    if (!paymentInvoice.value) return;
    try {
        localStorage.setItem(
            DRAFT_STORAGE_KEY,
            JSON.stringify({
                invoiceId: paymentInvoice.value.id,
                amount: paymentAmount.value,
                method: paymentMethod.value,
                reference: paymentReference.value,
            }),
        );
    } catch {
        /* storage full, ignore */
    }
}

function clearDraftPayment(): void {
    try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

function printReceipt(invoice: BillingInvoice, paidAmount: number, paymentMethodStr: string): void {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const facilityName = document.querySelector('meta[name="app-name"]')?.getAttribute('content') ?? 'Health Facility';
    const now = new Date().toLocaleString('en-TZ', { dateStyle: 'medium', timeStyle: 'short' });

    const lineItemsHtml = invoice.lineItems
        .map(
            (item) => `
        <tr>
            <td style="padding:4px 0;text-align:left;font-size:11px;">${item.description}</td>
            <td style="padding:4px 0;text-align:center;font-size:11px;">${item.quantity}</td>
            <td style="padding:4px 0;text-align:right;font-size:11px;">${formatMoney(item.unitPrice * item.quantity, invoice.currencyCode)}</td>
        </tr>
    `,
        )
        .join('');

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
                <div style="display:flex;justify-content:space-between;"><span class="bold">Total:</span><span class="bold">${formatMoney(invoice.totalAmount, invoice.currencyCode)}</span></div>
                <div style="display:flex;justify-content:space-between;"><span class="bold">Paid:</span><span class="bold">${formatMoney(paidAmount, invoice.currencyCode)}</span></div>
                <div style="display:flex;justify-content:space-between;"><span class="bold">Balance:</span><span class="bold">${formatMoney(invoice.totalAmount - paidAmount, invoice.currencyCode)}</span></div>
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

function applyOptimisticPayment(invoice: BillingInvoice, amount: number): BillingInvoice {
    const newPaidAmount = invoice.paidAmount + amount;
    const newBalance = invoice.totalAmount - newPaidAmount;
    return {
        ...invoice,
        paidAmount: newPaidAmount,
        balanceAmount: Math.max(0, newBalance),
        status: newBalance <= 0 ? 'paid' : newPaidAmount > 0 ? 'partially_paid' : invoice.status,
    };
}

function updateQueueForPatient(entry: CashierQueueEntry, invoices: BillingInvoice[]): CashierQueueEntry {
    const updatedUnpaid = invoices.filter((inv) => inv.status !== 'cancelled' && inv.status !== 'voided' && inv.balanceAmount > 0);
    const updatedPaid = invoices.filter((inv) => inv.balanceAmount <= 0 && inv.status !== 'cancelled' && inv.status !== 'voided');
    return {
        ...entry,
        unpaidInvoiceCount: updatedUnpaid.length,
        totalUnpaidAmount: updatedUnpaid.reduce((sum, inv) => sum + inv.balanceAmount, 0),
        paidInvoiceCount: updatedPaid.length,
        totalPaidAmount: updatedPaid.reduce((sum, inv) => sum + inv.totalAmount, 0),
    };
}

function patchPatientInvoicesCache(patientId: string, invoices: BillingInvoice[]): void {
    queryClient.setQueryData(['billing-cashier-patient', patientId], (old: { invoices: BillingInvoice[]; candidates: ChargeCaptureCandidate[] } | undefined) =>
        old ? { ...old, invoices } : old,
    );
}

function patchQueueCache(patientId: string, updater: (entry: CashierQueueEntry) => CashierQueueEntry): void {
    queryClient.setQueriesData(
        { queryKey: ['billing-cashier-queue'] },
        (old: { data: CashierQueueEntry[]; meta: unknown } | undefined) =>
            old ? { ...old, data: old.data.map((e) => (e.patientId === patientId ? updater(e) : e)) } : old,
    );
}

function showUndoToastMessage(): void {
    showUndoToast.value = true;
    if (undoTimer.value) clearTimeout(undoTimer.value);
    undoTimer.value = setTimeout(() => {
        showUndoToast.value = false;
    }, 10_000);
}

async function recordPayment(): Promise<void> {
    if (!paymentInvoice.value || paymentAmount.value <= 0 || !selectedPatientId.value) return;

    const invoice = paymentInvoice.value;
    const amount = paymentAmount.value;
    const method = paymentMethod.value;
    const reference = paymentReference.value;
    const patientId = selectedPatientId.value;

    showPaymentDialog.value = false;
    clearDraftPayment();
    paymentSaving.value = true;

    const previousPaidAmount = invoice.paidAmount;
    const previousBalance = invoice.balanceAmount;
    const previousStatus = invoice.status;

    const updatedInvoices = patientInvoices.value.map((inv) => (inv.id === invoice.id ? applyOptimisticPayment(inv, amount) : inv));
    patchPatientInvoicesCache(patientId, updatedInvoices);
    patchQueueCache(patientId, (entry) => updateQueueForPatient(entry, updatedInvoices));

    try {
        const response = await actions.recordPayment.mutateAsync({ invoiceId: invoice.id, amount, paymentMethod: method, paymentReference: reference });
        undoStack.value.push({
            invoiceId: invoice.id,
            paymentId: response.data.id,
            amount,
            method,
            reference,
            previousPaidAmount,
            previousBalance,
            previousStatus,
            patientId,
        });
        showUndoToastMessage();
        printReceipt(invoice, amount, method);
        actions.invalidate(patientId);
    } catch (error) {
        const revertedInvoices = patientInvoices.value.map((inv) =>
            inv.id === invoice.id ? { ...inv, paidAmount: previousPaidAmount, balanceAmount: previousBalance, status: previousStatus } : inv,
        );
        patchPatientInvoicesCache(patientId, revertedInvoices);
        patchQueueCache(patientId, (entry) => updateQueueForPatient(entry, revertedInvoices));
        notifyError(error instanceof Error ? error.message : 'Unable to record payment.');
    } finally {
        paymentSaving.value = false;
    }
}

function toggleInvoiceSelection(invoiceId: string): void {
    if (selectedInvoiceIds.value.has(invoiceId)) {
        selectedInvoiceIds.value.delete(invoiceId);
    } else {
        selectedInvoiceIds.value.add(invoiceId);
    }
    selectedInvoiceIds.value = new Set(selectedInvoiceIds.value);
}

const selectedUnpaidInvoices = computed(() =>
    patientInvoices.value.filter((inv) => selectedInvoiceIds.value.has(inv.id) && inv.balanceAmount > 0 && inv.status !== 'cancelled' && inv.status !== 'voided'),
);

const bulkTotalAmount = computed(() => selectedUnpaidInvoices.value.reduce((sum, inv) => sum + inv.balanceAmount, 0));

function openBulkPaymentDialog(): void {
    if (selectedUnpaidInvoices.value.length === 0) return;
    bulkPaymentAmount.value = bulkTotalAmount.value;
    bulkPaymentMethod.value = 'cash';
    bulkPaymentReference.value = '';
    showBulkPaymentDialog.value = true;
}

async function recordBulkPayment(): Promise<void> {
    if (selectedUnpaidInvoices.value.length === 0 || bulkPaymentAmount.value <= 0 || !selectedPatientId.value) return;

    const invoices = [...selectedUnpaidInvoices.value];
    const totalAmount = bulkPaymentAmount.value;
    const method = bulkPaymentMethod.value;
    const reference = bulkPaymentReference.value;
    const patientId = selectedPatientId.value;
    const perInvoiceAmount = totalAmount / invoices.length;

    showBulkPaymentDialog.value = false;
    selectedInvoiceIds.value = new Set();
    bulkPaymentSaving.value = true;

    const invoiceIds = new Set(invoices.map((inv) => inv.id));
    const updatedInvoices = patientInvoices.value.map((inv) => (invoiceIds.has(inv.id) ? applyOptimisticPayment(inv, perInvoiceAmount) : inv));
    patchPatientInvoicesCache(patientId, updatedInvoices);
    patchQueueCache(patientId, (entry) => updateQueueForPatient(entry, updatedInvoices));

    notifySuccess(`Payment of ${formatMoney(totalAmount, invoices[0]?.currencyCode)} recorded for ${invoices.length} invoices.`);

    try {
        for (const inv of invoices) {
            await actions.recordPayment.mutateAsync({ invoiceId: inv.id, amount: perInvoiceAmount, paymentMethod: method, paymentReference: reference });
        }
        actions.invalidate(patientId);
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to record bulk payment.');
        actions.invalidate(patientId);
    } finally {
        bulkPaymentSaving.value = false;
    }
}

/**
 * The old page's "Undo" was an instant, unconfirmed local revert whose
 * server call 404'd. billing.payments.reverse is a real audited reversal
 * that requires a reason, so Undo now opens a confirm prompt instead of
 * firing immediately — see useBillingCashierActions.ts's reversePayment.
 */
function openReversalDialog(): void {
    if (undoStack.value.length === 0) return;
    showUndoToast.value = false;
    if (undoTimer.value) clearTimeout(undoTimer.value);
    reversalReason.value = '';
    showReversalDialog.value = true;
}

async function confirmReversal(): Promise<void> {
    const entry = undoStack.value[undoStack.value.length - 1];
    if (!entry || reversalReason.value.trim() === '') return;

    reversalSaving.value = true;
    try {
        await actions.reversePayment.mutateAsync({
            invoiceId: entry.invoiceId,
            paymentId: entry.paymentId,
            amount: entry.amount,
            reason: reversalReason.value.trim(),
        });
        undoStack.value.pop();
        showReversalDialog.value = false;
        notifySuccess('Payment reversed.');
        actions.invalidate(entry.patientId);
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to reverse payment.');
    } finally {
        reversalSaving.value = false;
    }
}

/**
 * Captures a priced, not-yet-invoiced charge (lab/pharmacy/radiology/theatre
 * order or consultation) onto the patient's invoice. Appends to their
 * existing draft invoice in the same currency if one exists, otherwise opens
 * a new invoice with this as its first line item.
 */
async function addCandidateToInvoice(candidate: ChargeCaptureCandidate): Promise<void> {
    const patientId = selectedPatientId.value;
    if (!patientId || capturingCandidateIds.value.has(candidate.id)) return;

    capturingCandidateIds.value = new Set(capturingCandidateIds.value).add(candidate.id);

    const lineItem = candidate.suggestedLineItem;
    const draftInvoice = patientInvoices.value.find((inv) => inv.status === 'draft' && inv.currencyCode === candidate.currencyCode);

    try {
        if (draftInvoice) {
            await actions.addChargeCandidateToDraft.mutateAsync({
                draftInvoiceId: draftInvoice.id,
                lineItems: [...draftInvoice.lineItems, lineItem],
            });
        } else {
            await actions.createInvoiceFromCandidate.mutateAsync({
                patientId,
                invoiceDate: new Date().toISOString().slice(0, 10),
                currencyCode: candidate.currencyCode || 'TZS',
                subtotalAmount: candidate.lineTotal ?? 0,
                appointmentId: candidate.appointmentId ?? null,
                admissionId: candidate.admissionId ?? null,
                lineItems: [lineItem],
            });
        }

        notifySuccess(`${candidate.serviceName || candidate.sourceWorkflowLabel} added to invoice.`);
        actions.invalidate(patientId);
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to add charge to invoice.');
    } finally {
        const next = new Set(capturingCandidateIds.value);
        next.delete(candidate.id);
        capturingCandidateIds.value = next;
    }
}

async function issueInvoice(invoice: BillingInvoice): Promise<void> {
    const patientId = selectedPatientId.value;
    if (!patientId || issuingInvoiceIds.value.has(invoice.id)) return;

    issuingInvoiceIds.value = new Set(issuingInvoiceIds.value).add(invoice.id);

    try {
        await actions.issueInvoice.mutateAsync(invoice.id);
        notifySuccess(`${invoice.invoiceNumber || 'Invoice'} issued.`);
        actions.invalidate(patientId);
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to issue invoice.');
    } finally {
        const next = new Set(issuingInvoiceIds.value);
        next.delete(invoice.id);
        issuingInvoiceIds.value = next;
    }
}

function formatMoney(amount: number, currencyCode?: string | null): string {
    const formatted = new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    return `${formatted} ${currencyCode || 'TZS'}`;
}

type BadgeVariant = 'outline' | 'default' | 'secondary' | 'destructive';

function statusVariant(status: string): BadgeVariant {
    switch (status) {
        case 'draft':
            return 'outline';
        case 'issued':
            return 'default';
        case 'partially_paid':
            return 'secondary';
        case 'paid':
            return 'default';
        case 'cancelled':
            return 'destructive';
        case 'voided':
            return 'destructive';
        default:
            return 'outline';
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

const unpaidInvoices = computed(() => patientInvoices.value.filter((inv) => inv.status !== 'cancelled' && inv.status !== 'voided' && inv.balanceAmount > 0));
const totalUnpaid = computed(() => unpaidInvoices.value.reduce((sum, inv) => sum + inv.balanceAmount, 0));
const totalBilled = computed(() => patientInvoices.value.reduce((sum, inv) => sum + inv.totalAmount, 0));
const pricedCandidates = computed(() => chargeCaptureCandidates.value.filter((c) => c.pricingStatus === 'priced' && !c.alreadyInvoiced));
const unpricedCandidates = computed(() => chargeCaptureCandidates.value.filter((c) => c.pricingStatus !== 'priced' && !c.alreadyInvoiced));

function handleKeydown(event: KeyboardEvent): void {
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
    try {
        const storedPerPage = window.localStorage.getItem(PER_PAGE_STORAGE_KEY);
        if (storedPerPage && !new URLSearchParams(window.location.search).has('perPage')) {
            const parsed = parseInt(storedPerPage, 10);
            if (Number.isFinite(parsed) && parsed > 0) filters.perPage = parsed;
        }
    } catch {
        /* storage unavailable, ignore */
    }

    window.addEventListener('keydown', handleKeydown);
    if (deepLinkPatientId) {
        loadPatientByIdDirect(deepLinkPatientId);
    }
});

watch(patientInvoices, async (list) => {
    if (!focusInvoiceId.value) return;
    if (!list.some((inv) => inv.id === focusInvoiceId.value)) return;
    await nextTick();
    document.getElementById(`billing-invoice-${focusInvoiceId.value}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown);
    if (undoTimer.value) clearTimeout(undoTimer.value);
});

watch(showPaymentDialog, (open) => {
    if (open) loadDraftPayment();
});

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Billing" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div ref="scrollContainer" class="flex flex-col overflow-x-hidden overflow-y-auto rounded-lg" :style="{ height: scrollContainerHeight }">
            <div class="sticky top-0 z-10 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div class="flex min-w-0 items-center gap-2">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">Billing</h1>
                        <Badge v-if="pagination" variant="secondary">{{ pagination.total }} patients</Badge>
                    </div>
                    <div class="flex flex-shrink-0 items-center gap-2">
                        <Button variant="ghost" size="sm" class="h-8 w-8 p-0" :disabled="listLoading" title="Refresh queue" @click="refreshQueue">
                            <AppIcon :name="listLoading ? 'loader-circle' : 'refresh-cw'" class="size-3.5" :class="listLoading ? 'animate-spin' : ''" />
                        </Button>
                    </div>
                </div>

                <div class="mt-3 grid grid-cols-3 gap-2">
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">In Consultation</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.inConsultation ?? '—' }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Unpaid</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.unpaid ?? '—' }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Fully Paid</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.paid ?? '—' }}</p>
                    </div>
                </div>

                <Tabs :model-value="filters.status" class="mt-3" @update:model-value="setStatus">
                    <TabsList class="grid w-full grid-cols-4">
                        <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                            All
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.all ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="in_consultation" class="inline-flex items-center gap-1.5">
                            In consultation
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.inConsultation ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="unpaid" class="inline-flex items-center gap-1.5">
                            Unpaid
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.unpaid ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="paid" class="inline-flex items-center gap-1.5">
                            Paid
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.paid ?? '—' }}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div class="mt-3 flex flex-wrap items-center gap-2">
                    <div class="relative min-w-0 flex-1">
                        <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input v-model="searchInputRaw" placeholder="Search by name, MRN, or phone…" class="h-9 pl-9" @keyup.enter="submitSearchNow" />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                            <Button variant="outline" size="sm" class="h-9 gap-1.5">
                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                View
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="w-48">
                            <DropdownMenuItem @click="setPerPage(10)">10 per page</DropdownMenuItem>
                            <DropdownMenuItem @click="setPerPage(20)">20 per page</DropdownMenuItem>
                            <DropdownMenuItem @click="setPerPage(50)">50 per page</DropdownMenuItem>
                            <DropdownMenuItem @click="compactRows = true">Compact rows</DropdownMenuItem>
                            <DropdownMenuItem @click="compactRows = false">Comfortable rows</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button v-if="hasActiveFilters" size="sm" variant="ghost" class="h-9 gap-1.5 text-xs" @click="clearAllFilters">
                        <AppIcon name="x" class="size-3.5" />
                        Clear filters
                    </Button>
                </div>
            </div>

            <div class="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6 md:px-6">
                <!-- Error banner -->
                <div v-if="queueError" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <div class="flex items-start gap-2.5">
                        <AppIcon name="alert-triangle" class="mt-0.5 size-4 shrink-0 text-destructive" />
                        <div class="min-w-0">
                            <p class="text-sm font-medium text-destructive">Unable to load billing queue</p>
                            <p class="mt-1 text-xs break-all text-muted-foreground">{{ queueError }}</p>
                        </div>
                        <Button variant="ghost" size="sm" class="ml-auto h-7 shrink-0 px-2" @click="refreshQueue">
                            <AppIcon name="refresh-cw" class="mr-1 size-3" />
                            Retry
                        </Button>
                    </div>
                </div>

                <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
                    <div class="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
                        <!-- Left: Queue -->
                        <div
                            class="flex min-h-0 flex-col border-b md:flex md:border-r md:border-b-0"
                            :class="[selectedPatientId ? 'md:w-96' : 'md:flex-1', isMobile && mobileView === 'detail' ? 'hidden' : '']"
                        >
                            <!-- Plain overflow-y-auto, not ScrollArea: ScrollArea's viewport
                            doesn't reliably resolve a percentage height inside a flex column in
                            this app's build (confirmed live — its scrollHeight tracked content
                            size instead of clamping to available space, silently defeating the
                            scroll), so native overflow is used here instead. -->
                            <div class="min-h-0 flex-1 overflow-y-auto">
                                <RegistryListSkeleton v-if="pageLoading" :count="5" />
                                <div v-else-if="queueEntries.length === 0" class="p-4">
                                    <InventoryEmptyState icon="check-circle" title="No patients in queue" description="All patients have been served or no pending charges found." />
                                </div>
                                <div
                                    v-show="queueEntries.length > 0"
                                    class="divide-y px-4"
                                    :class="{ 'pointer-events-none opacity-40 transition-opacity duration-200': listLoading }"
                                >
                                    <RegistryListRow
                                        v-for="entry in queueEntries"
                                        :key="entry.patientId"
                                        :class="compactRows ? '[&_p]:text-[11px]' : ''"
                                        :status-dot-class="queueStatusDotClass(entry)"
                                        :status-title="queueStatusTitle(entry)"
                                        :flash="selectedPatientId === entry.patientId"
                                        @select="selectPatient(entry)"
                                    >
                                        <template #title>
                                            <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                                <span class="truncate text-sm font-medium transition-colors hover:text-primary">{{ entry.patientName }}</span>
                                                <Badge v-if="entry.inConsultation" variant="default" class="h-4.5 bg-blue-500 px-1.5 text-[10px] leading-none font-normal text-white">
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
                                            <Badge v-if="entry.unpaidInvoiceCount > 0" variant="destructive" class="h-5 px-1.5 text-[10px] tabular-nums">
                                                {{ formatMoney(entry.totalUnpaidAmount) }}
                                            </Badge>
                                            <Badge v-if="entry.unbilledServiceCount > 0" variant="secondary" class="h-5 px-1.5 text-[10px] tabular-nums">
                                                {{ entry.unbilledServiceCount }} unbilled
                                            </Badge>
                                        </template>
                                        <template #actions>
                                            <PatientSummaryPopover v-if="entry.patientId" :patient-id="entry.patientId">
                                                <template #trigger>
                                                    <button type="button" class="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="View patient summary">
                                                        <AppIcon name="info" class="size-3.5" />
                                                    </button>
                                                </template>
                                                <template #actions>
                                                    <a :href="`/patients/${entry.patientId}/chart`" class="text-xs font-medium text-primary hover:underline">View chart</a>
                                                </template>
                                            </PatientSummaryPopover>
                                            <AppIcon name="chevron-right" class="size-4 text-muted-foreground" />
                                        </template>
                                    </RegistryListRow>
                                </div>
                            </div>

                            <footer v-if="pagination && pagination.lastPage > 1" class="shrink-0 border-t bg-muted/30 px-4 py-2">
                                <ListPagination :current-page="pagination.currentPage" :last-page="pagination.lastPage" :total="pagination.total" item-label="patients" @update:page="goToPage" />
                            </footer>
                        </div>

                        <!-- Right: Patient Detail Panel -->
                        <div v-if="selectedIdentity" class="flex min-h-0 flex-1 flex-col overflow-hidden md:flex" :class="isMobile && mobileView === 'queue' ? 'hidden' : ''">
                            <div class="flex items-center justify-between border-b px-4 py-3">
                                <div class="flex items-center gap-2">
                                    <Button v-if="isMobile" variant="ghost" size="sm" class="h-8 w-8 p-0 md:hidden" @click="mobileView = 'queue'">
                                        <AppIcon name="chevron-left" class="size-4" />
                                    </Button>
                                    <div>
                                        <h2 class="text-base font-semibold">{{ selectedIdentity.patientName }}</h2>
                                        <p class="text-xs text-muted-foreground">
                                            {{ selectedIdentity.patientNumber }}
                                            <span v-if="selectedIdentity.phone"> · {{ selectedIdentity.phone }}</span>
                                        </p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <Button v-if="canRecordPayments && selectedUnpaidInvoices.length > 0" size="sm" variant="default" @click="openBulkPaymentDialog">
                                        Pay Selected ({{ selectedUnpaidInvoices.length }})
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        @click="
                                            selectedPatientId = null;
                                            if (isMobile) mobileView = 'queue';
                                        "
                                    >
                                        <AppIcon name="x" class="size-4" />
                                    </Button>
                                </div>
                            </div>

                            <Tabs default-value="invoices" class="flex min-h-0 flex-1 flex-col overflow-hidden">
                                <TabsList class="mx-4 mt-2 grid h-9 w-full grid-cols-2 gap-1 bg-muted/40 p-1">
                                    <TabsTrigger value="invoices" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                        <span class="flex items-center gap-1 leading-none">
                                            <AppIcon name="receipt" class="size-3" />
                                            Invoices
                                            <Badge v-if="unpaidInvoices.length > 0" variant="destructive" class="ml-1 h-4.5 px-1.5 text-[10px]">{{ unpaidInvoices.length }}</Badge>
                                        </span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        v-if="canCreateInvoices"
                                        value="unbilled"
                                        class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                                    >
                                        <span class="flex items-center gap-1 leading-none">
                                            <AppIcon name="activity" class="size-3" />
                                            Unbilled Services
                                            <Badge v-if="pricedCandidates.length > 0" variant="secondary" class="ml-1 h-4.5 px-1.5 text-[10px]">{{ pricedCandidates.length }}</Badge>
                                        </span>
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="invoices" class="m-0 flex min-h-0 flex-1 flex-col overflow-auto p-4">
                                    <div v-if="patientInvoicesLoading" class="space-y-3">
                                        <RegistryListSkeleton :count="3" />
                                    </div>

                                    <div v-else-if="patientInvoices.length === 0" class="py-4">
                                        <InventoryEmptyState icon="receipt" title="No invoices found" description="This patient has no invoices yet." compact />
                                    </div>

                                    <div v-else class="space-y-3">
                                        <div class="mb-4 grid grid-cols-2 gap-2">
                                            <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                                                <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total Billed</p>
                                                <p class="text-sm font-bold tabular-nums">{{ formatMoney(totalBilled, patientInvoices[0]?.currencyCode) }}</p>
                                            </div>
                                            <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                                                <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Unpaid</p>
                                                <p class="text-sm font-bold text-destructive tabular-nums">{{ formatMoney(totalUnpaid, patientInvoices[0]?.currencyCode) }}</p>
                                            </div>
                                        </div>

                                        <div
                                            v-for="invoice in patientInvoices"
                                            :id="`billing-invoice-${invoice.id}`"
                                            :key="invoice.id"
                                            :class="['rounded-lg border p-3 transition-colors', invoice.id === focusInvoiceId ? 'border-primary ring-2 ring-primary/40' : '']"
                                        >
                                            <div class="flex items-start justify-between gap-2">
                                                <div class="flex items-start gap-2">
                                                    <Checkbox
                                                        v-if="canRecordPayments && invoice.balanceAmount > 0 && invoice.status !== 'draft' && invoice.status !== 'cancelled' && invoice.status !== 'voided'"
                                                        :checked="selectedInvoiceIds.has(invoice.id)"
                                                        class="mt-0.5"
                                                        @update:checked="toggleInvoiceSelection(invoice.id)"
                                                    />
                                                    <div>
                                                        <div class="flex items-center gap-2">
                                                            <p class="text-sm font-medium">{{ invoice.invoiceNumber || 'Draft' }}</p>
                                                            <Badge :variant="statusVariant(invoice.status)" class="text-[10px]">{{ invoiceStatusLabel(invoice.status) }}</Badge>
                                                        </div>
                                                        <p class="mt-0.5 text-xs text-muted-foreground">
                                                            {{ invoice.invoiceDate }}
                                                            <span v-if="invoice.paymentDueAt"> · Due {{ invoice.paymentDueAt }}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div class="text-right">
                                                    <p class="text-sm font-semibold tabular-nums">{{ formatMoney(invoice.totalAmount, invoice.currencyCode) }}</p>
                                                    <p v-if="invoice.balanceAmount > 0" class="text-xs text-destructive tabular-nums">Balance: {{ formatMoney(invoice.balanceAmount, invoice.currencyCode) }}</p>
                                                </div>
                                            </div>

                                            <div v-if="invoice.lineItems?.length > 0" class="mt-2 space-y-1">
                                                <div v-for="(item, idx) in invoice.lineItems.slice(0, 3)" :key="idx" class="flex items-center justify-between text-xs text-muted-foreground">
                                                    <span class="truncate">{{ item.description }}</span>
                                                    <span class="tabular-nums">{{ formatMoney(item.unitPrice * item.quantity, invoice.currencyCode) }}</span>
                                                </div>
                                                <p v-if="invoice.lineItems.length > 3" class="text-xs text-muted-foreground">+{{ invoice.lineItems.length - 3 }} more items</p>
                                            </div>

                                            <div class="mt-2 flex gap-2">
                                                <Button v-if="invoice.status === 'draft'" size="sm" variant="outline" :disabled="issuingInvoiceIds.has(invoice.id)" @click="issueInvoice(invoice)">
                                                    {{ issuingInvoiceIds.has(invoice.id) ? 'Issuing…' : 'Issue Invoice' }}
                                                </Button>
                                                <Button v-else-if="canRecordPayments && invoice.balanceAmount > 0 && invoice.status !== 'cancelled' && invoice.status !== 'voided'" size="sm" @click="openPaymentDialog(invoice)">
                                                    Record Payment
                                                </Button>
                                                <Badge v-else-if="invoice.balanceAmount <= 0" variant="default" class="text-[10px]">Paid</Badge>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent v-if="canCreateInvoices" value="unbilled" class="m-0 flex min-h-0 flex-1 flex-col overflow-auto p-4">
                                    <div v-if="patientInvoicesLoading" class="space-y-3">
                                        <RegistryListSkeleton :count="3" />
                                    </div>

                                    <div v-else-if="chargeCaptureCandidates.length === 0" class="py-4">
                                        <InventoryEmptyState icon="activity" title="No unbilled services" description="No unbilled services found for this patient." compact />
                                    </div>

                                    <div v-else class="space-y-3">
                                        <div v-if="pricedCandidates.length > 0">
                                            <p class="mb-2 text-xs font-medium text-muted-foreground">Ready to bill ({{ pricedCandidates.length }})</p>
                                            <div v-for="candidate in pricedCandidates" :key="candidate.id" class="rounded-lg border p-3">
                                                <div class="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p class="text-sm font-medium">{{ candidate.serviceName || candidate.sourceWorkflowLabel }}</p>
                                                        <div class="mt-0.5 flex items-center gap-2">
                                                            <Badge variant="outline" class="text-[10px]">{{ formatEnumLabel(candidate.serviceType || candidate.sourceWorkflowKind || '') }}</Badge>
                                                            <span class="text-xs text-muted-foreground">{{ candidate.sourceWorkflowLabel }}</span>
                                                            <span v-if="candidate.performedAt" class="text-xs text-muted-foreground">· {{ candidate.performedAt }}</span>
                                                        </div>
                                                    </div>
                                                    <p class="text-sm font-semibold tabular-nums">{{ formatMoney(candidate.lineTotal || candidate.unitPrice || 0, candidate.currencyCode) }}</p>
                                                </div>
                                                <div class="mt-2 flex justify-end">
                                                    <Button size="sm" :disabled="capturingCandidateIds.has(candidate.id)" @click="addCandidateToInvoice(candidate)">
                                                        {{ capturingCandidateIds.has(candidate.id) ? 'Adding…' : 'Add to invoice' }}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div v-if="unpricedCandidates.length > 0">
                                            <Separator class="my-3" />
                                            <p class="mb-2 text-xs font-medium text-muted-foreground">Needs pricing ({{ unpricedCandidates.length }})</p>
                                            <div v-for="candidate in unpricedCandidates" :key="candidate.id" class="rounded-lg border border-dashed p-3 opacity-60">
                                                <div class="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p class="text-sm font-medium">{{ candidate.serviceName || candidate.sourceWorkflowLabel }}</p>
                                                        <div class="mt-0.5 flex items-center gap-2">
                                                            <Badge variant="outline" class="text-[10px]">{{ formatEnumLabel(candidate.serviceType || candidate.sourceWorkflowKind || '') }}</Badge>
                                                            <span class="text-xs text-muted-foreground">{{ candidate.sourceWorkflowLabel }}</span>
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
            </div>
        </div>

        <!-- Single Payment Sheet -->
        <Sheet v-model:open="showPaymentDialog">
            <SheetContent side="right" variant="form" size="xl">
                <SheetHeader class="shrink-0 border-b px-4 py-3 pr-12 text-left">
                    <SheetTitle>Record Payment</SheetTitle>
                    <SheetDescription>{{ paymentInvoice?.invoiceNumber || 'Draft invoice' }} — Balance: {{ formatMoney(paymentInvoice?.balanceAmount || 0, paymentInvoice?.currencyCode) }}</SheetDescription>
                </SheetHeader>

                <div class="flex-1 space-y-4 overflow-y-auto p-4">
                    <div>
                        <Label for="paymentAmount">Amount</Label>
                        <Input id="paymentAmount" v-model.number="paymentAmount" type="number" min="1" :max="paymentInvoice?.balanceAmount || 0" class="mt-1" />
                    </div>

                    <div>
                        <Label for="paymentMethod">Payment Method</Label>
                        <Select v-model="paymentMethod">
                            <SelectTrigger class="mt-1"><SelectValue /></SelectTrigger>
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
                        <Input id="paymentReference" v-model="paymentReference" placeholder="Receipt number, transaction ID..." class="mt-1" />
                    </div>
                </div>

                <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                    <p class="mr-auto text-[10px] text-muted-foreground">
                        <kbd class="rounded border bg-muted px-1 py-0.5 text-[10px] font-medium">Enter</kbd> to save
                        · <kbd class="rounded border bg-muted px-1 py-0.5 text-[10px] font-medium">Esc</kbd> to close
                    </p>
                    <Button
                        variant="outline"
                        @click="
                            saveDraftPayment();
                            showPaymentDialog = false;
                        "
                        >Cancel</Button
                    >
                    <Button :disabled="paymentAmount <= 0" @click="recordPayment()">Record Payment</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>

        <!-- Bulk Payment Sheet -->
        <Sheet v-model:open="showBulkPaymentDialog">
            <SheetContent side="right" variant="form" size="xl">
                <SheetHeader class="shrink-0 border-b px-4 py-3 pr-12 text-left">
                    <SheetTitle>Bulk Payment</SheetTitle>
                    <SheetDescription>{{ selectedUnpaidInvoices.length }} invoices selected — Total: {{ formatMoney(bulkTotalAmount, selectedUnpaidInvoices[0]?.currencyCode) }}</SheetDescription>
                </SheetHeader>

                <div class="flex-1 space-y-4 overflow-y-auto p-4">
                    <div>
                        <Label for="bulkPaymentAmount">Amount</Label>
                        <Input id="bulkPaymentAmount" v-model.number="bulkPaymentAmount" type="number" min="1" :max="bulkTotalAmount" class="mt-1" />
                    </div>

                    <div>
                        <Label for="bulkPaymentMethod">Payment Method</Label>
                        <Select v-model="bulkPaymentMethod">
                            <SelectTrigger class="mt-1"><SelectValue /></SelectTrigger>
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
                        <Input id="bulkPaymentReference" v-model="bulkPaymentReference" placeholder="Receipt number, transaction ID..." class="mt-1" />
                    </div>
                </div>

                <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                    <Button variant="outline" @click="showBulkPaymentDialog = false">Cancel</Button>
                    <Button :disabled="bulkPaymentAmount <= 0" @click="recordBulkPayment()">Record Bulk Payment</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>

        <!-- Reversal reason dialog (replaces the old, non-functional instant Undo) -->
        <Dialog v-model:open="showReversalDialog">
            <DialogContent class="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Reverse payment</DialogTitle>
                    <DialogDescription>This reverses the last payment recorded and is logged to the invoice's audit trail.</DialogDescription>
                </DialogHeader>
                <div class="space-y-2">
                    <Label for="reversalReason">Reason (required)</Label>
                    <Textarea id="reversalReason" v-model="reversalReason" rows="3" placeholder="Why is this payment being reversed?" />
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="showReversalDialog = false">Cancel</Button>
                    <Button :disabled="reversalReason.trim() === '' || reversalSaving" @click="confirmReversal">
                        {{ reversalSaving ? 'Reversing…' : 'Confirm reversal' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

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
                <div v-if="showUndoToast" class="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border bg-background p-3 shadow-lg">
                    <AppIcon name="check-circle" class="size-4 text-green-500" />
                    <span class="text-sm">Payment recorded</span>
                    <Button v-if="canReverseBillingPayments" variant="ghost" size="sm" class="text-sm font-medium text-primary" @click="openReversalDialog">Undo</Button>
                </div>
            </Transition>
        </Teleport>
    </AppLayout>
</template>
