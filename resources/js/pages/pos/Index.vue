<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/AppLayout.vue';
import { csrfRequestHeaders, refreshCsrfToken } from '@/lib/csrf';
import { type BreadcrumbItem } from '@/types';

type Pager<T> = {
    data: T[];
    meta: {
        total: number;
        currentPage?: number;
        lastPage?: number;
        perPage?: number;
        [key: string]: unknown;
    };
};
type AuthPermissionsResponse = { data?: Array<{ name?: string | null }> };
type PosSaleAdjustment = {
    id: string;
    adjustmentNumber: string | null;
    adjustmentType: string | null;
    amount: string | number | null;
    cashAmount: string | number | null;
    nonCashAmount: string | number | null;
    currencyCode: string | null;
    paymentMethod: string | null;
    adjustmentReference: string | null;
    reasonCode: string | null;
    notes: string | null;
    processedAt: string | null;
};
type PosRegister = {
    id: string;
    registerCode: string | null;
    registerName: string | null;
    location: string | null;
    defaultCurrencyCode: string | null;
    status: string | null;
    statusReason: string | null;
    notes: string | null;
    currentOpenSession: { id: string; sessionNumber: string | null; openedAt: string | null } | null;
};
type PosSession = {
    id: string;
    sessionNumber: string | null;
    status: string | null;
    openedAt: string | null;
    closedAt: string | null;
    openedByUserId: number | null;
    closedByUserId: number | null;
    openingCashAmount: string | number | null;
    closingCashAmount: string | number | null;
    expectedCashAmount: string | number | null;
    discrepancyAmount: string | number | null;
    grossSalesAmount: string | number | null;
    totalDiscountAmount: string | number | null;
    totalTaxAmount: string | number | null;
    cashNetSalesAmount: string | number | null;
    nonCashSalesAmount: string | number | null;
    saleCount: number | null;
    voidCount: number | null;
    refundCount: number | null;
    adjustmentAmount: string | number | null;
    cashAdjustmentAmount: string | number | null;
    nonCashAdjustmentAmount: string | number | null;
    openingNote: string | null;
    closingNote: string | null;
    register: { registerCode: string | null; registerName: string | null; location: string | null; defaultCurrencyCode?: string | null } | null;
    closeoutPreview: {
        expectedCashAmount: string | number | null;
        grossSalesAmount: string | number | null;
        totalDiscountAmount: string | number | null;
        totalTaxAmount: string | number | null;
        cashNetSalesAmount: string | number | null;
        nonCashSalesAmount: string | number | null;
        saleCount: number | null;
        voidCount: number | null;
        refundCount: number | null;
        adjustmentAmount: string | number | null;
        cashAdjustmentAmount: string | number | null;
        nonCashAdjustmentAmount: string | number | null;
    } | null;
};
type PosSale = {
    id: string;
    saleNumber: string | null;
    receiptNumber: string | null;
    saleChannel: string | null;
    customerType: string | null;
    customerName: string | null;
    status: string | null;
    totalAmount: string | number | null;
    currencyCode: string | null;
    changeAmount: string | number | null;
    soldAt: string | null;
    register: { registerCode: string | null; registerName: string | null } | null;
    session: { id: string | null; sessionNumber: string | null; status: string | null; openedAt: string | null } | null;
    adjustments: PosSaleAdjustment[] | null;
};
type OtcCatalogItem = {
    id: string;
    code: string | null;
    name: string | null;
    category: string | null;
    unit: string | null;
    strength: string | null;
    dosageForm: string | null;
    otcEligible: boolean;
    otcEligibilityReason: string | null;
    otcUnitPrice: string | number | null;
    inventoryItem: {
        id: string | null;
        itemCode: string | null;
        itemName: string | null;
        unit: string | null;
        currentStock: string | number | null;
        stockState: string | null;
    } | null;
};
type OtcBasketItem = {
    clientId: string;
    catalogItemId: string;
    code: string | null;
    name: string | null;
    quantity: number;
    unitPrice: number;
    note: string | null;
};
type LabQuickCandidate = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
    patientNumber: string | null;
    patientName: string | null;
    appointmentId: string | null;
    admissionId: string | null;
    testCode: string | null;
    testName: string | null;
    serviceCode: string | null;
    serviceName: string | null;
    unit: string | null;
    sourceStatus: string | null;
    orderedAt: string | null;
    resultedAt: string | null;
    performedAt: string | null;
    currencyCode: string | null;
    unitPrice: string | number | null;
    lineTotal: string | number | null;
};
type LabQuickBasketItem = {
    clientId: string;
    orderId: string;
    orderNumber: string | null;
    patientId: string;
    patientNumber: string | null;
    patientName: string | null;
    testCode: string | null;
    serviceCode: string | null;
    serviceName: string | null;
    lineTotal: number;
    note: string | null;
};
type CafeteriaCatalogItem = {
    id: string;
    itemCode: string | null;
    itemName: string | null;
    category: string | null;
    unitLabel: string | null;
    unitPrice: string | number | null;
    taxRatePercent: string | number | null;
    status: string | null;
    statusReason: string | null;
    sortOrder: number | null;
    description: string | null;
};
type CafeteriaBasketItem = {
    clientId: string;
    menuItemId: string;
    itemCode: string | null;
    itemName: string | null;
    category: string | null;
    unitLabel: string | null;
    quantity: number;
    unitPrice: number;
    taxRatePercent: number;
    lineTaxAmount: number;
    note: string | null;
};
type PaymentEntry = {
    clientId: string;
    paymentMethod: string;
    amount: string;
    paymentReference: string;
    note: string;
};
type OtcCustomerMode = 'walk_in' | 'patient';
type GeneralRetailLineItem = {
    clientId: string;
    itemName: string;
    itemCode: string | null;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    taxAmount: number;
    note: string | null;
};
type ApiError = Error & { status?: number; payload?: Record<string, unknown> };

const breadcrumbs: BreadcrumbItem[] = [{ title: 'POS Operations', href: '/pos' }];
const paymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'mobile_money', label: 'Mobile money' },
    { value: 'card', label: 'Card' },
    { value: 'bank_transfer', label: 'Bank transfer' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'other', label: 'Other' },
];
const adjustmentReasonOptions = [
    { value: 'customer_return', label: 'Customer Return' },
    { value: 'error_correction', label: 'Error Correction' },
    { value: 'wrong_item', label: 'Wrong Item' },
    { value: 'duplicate_sale', label: 'Duplicate Sale' },
    { value: 'pricing_error', label: 'Pricing Error' },
    { value: 'quality_issue', label: 'Quality Issue' },
    { value: 'other', label: 'Other' },
];

const loading = ref(true);
const errorMessage = ref<string | null>(null);
const canReadLabQuick = ref(false);
const canCreateLabQuick = ref(false);
const canReadPharmacyOtc = ref(false);
const canCreatePharmacyOtc = ref(false);
const canReadCafeteria = ref(false);
const canCreateCafeteria = ref(false);
const canManageCafeteriaCatalog = ref(false);
const canReadSessions = ref(false);
const canManageSessions = ref(false);
const canReadSales = ref(false);
const canCreateSales = ref(false);
const canVoidSales = ref(false);
const canRefundSales = ref(false);
const canManageRegisters = ref(false);
const registerRows = ref<PosRegister[]>([]);
const openSessionRows = ref<PosSession[]>([]);
const closedSessionRows = ref<PosSession[]>([]);
const recentSales = ref<PosSale[]>([]);
const totalRegisters = ref(0);
const totalOpenSessions = ref(0);
const totalClosedSessions = ref(0);
const activeTab = ref('overview');

const registerSubmitting = ref(false);
const registerError = ref<string | null>(null);
const registerSuccess = ref<string | null>(null);
const registerSearch = ref('');
const registerStatusFilter = ref<'active' | 'inactive' | 'all'>('all');
const registerEditorId = ref('');
const registerEditorCode = ref('');
const registerEditorName = ref('');
const registerEditorLocation = ref('');
const registerEditorCurrency = ref('');
const registerEditorStatus = ref<'active' | 'inactive'>('active');
const registerEditorStatusReason = ref('');
const registerEditorNotes = ref('');

const labQuickLoading = ref(false);
const labQuickSubmitting = ref(false);
const labQuickError = ref<string | null>(null);
const labQuickSuccess = ref<string | null>(null);
const labQuickSearch = ref('');
const labQuickStatusFilter = ref<'ordered' | 'collected' | 'in_progress' | 'completed' | 'all'>('all');
const labQuickCandidates = ref<LabQuickCandidate[]>([]);
const selectedLabOrderId = ref('');
const selectedLabRegisterId = ref('');
const labQuickLineNote = ref('');
const labQuickBasketItems = ref<LabQuickBasketItem[]>([]);
const labQuickPayments = ref<PaymentEntry[]>([createPaymentEntry()]);
const labQuickCheckoutNote = ref('');
const labQuickVisiblePatients = ref(0);

const otcLoading = ref(false);
const otcSubmitting = ref(false);
const otcError = ref<string | null>(null);
const otcSuccess = ref<string | null>(null);
const otcSearch = ref('');
const otcCatalogItems = ref<OtcCatalogItem[]>([]);
const selectedCatalogItemId = ref('');
const selectedRegisterId = ref('');
const otcQuantity = ref('1');
const otcUnitPrice = ref('');
const otcLineNote = ref('');
const basketItems = ref<OtcBasketItem[]>([]);
const otcCustomerMode = ref<OtcCustomerMode>('walk_in');
const otcPatientId = ref('');
const checkoutCustomerName = ref('');
const checkoutCustomerReference = ref('');
const otcPayments = ref<PaymentEntry[]>([createPaymentEntry()]);
const checkoutNote = ref('');

const cafeteriaLoading = ref(false);
const cafeteriaSubmitting = ref(false);
const cafeteriaCatalogSaving = ref(false);
const cafeteriaError = ref<string | null>(null);
const cafeteriaSuccess = ref<string | null>(null);
const cafeteriaSearch = ref('');
const cafeteriaCategory = ref('');
const cafeteriaStatusFilter = ref<'active' | 'inactive' | 'all'>('active');
const cafeteriaCatalogItems = ref<CafeteriaCatalogItem[]>([]);
const selectedCafeteriaMenuItemId = ref('');
const selectedCafeteriaRegisterId = ref('');
const cafeteriaQuantity = ref('1');
const cafeteriaLineNote = ref('');
const cafeteriaBasketItems = ref<CafeteriaBasketItem[]>([]);
const cafeteriaCustomerName = ref('');
const cafeteriaCustomerReference = ref('');
const cafeteriaPayments = ref<PaymentEntry[]>([createPaymentEntry()]);
const cafeteriaCheckoutNote = ref('');
const cafeteriaEditorId = ref('');
const cafeteriaEditorItemCode = ref('');
const cafeteriaEditorItemName = ref('');
const cafeteriaEditorCategory = ref('');
const cafeteriaEditorUnitLabel = ref('');
const cafeteriaEditorUnitPrice = ref('');
const cafeteriaEditorTaxRatePercent = ref('0');
const cafeteriaEditorStatus = ref<'active' | 'inactive'>('active');
const cafeteriaEditorStatusReason = ref('');
const cafeteriaEditorSortOrder = ref('0');
const cafeteriaEditorDescription = ref('');
const salesLoading = ref(false);
const salesRows = ref<PosSale[]>([]);
const salesSearch = ref('');
const salesChannelFilter = ref('');
const salesStatusFilter = ref('');
const salesPaymentMethodFilter = ref('');
const salesRegisterFilter = ref('');
const salesSessionFilter = ref('');
const salesDateFrom = ref('');
const salesDateTo = ref('');
const salesPage = ref(1);
const salesPerPage = ref(10);
const salesTotal = ref(0);
const salesLastPage = ref(1);
const retailSubmitting = ref(false);
const retailError = ref<string | null>(null);
const retailSuccess = ref<string | null>(null);
const retailLatestSaleId = ref('');
const selectedRetailRegisterId = ref('');
const retailCustomerType = ref<'anonymous' | 'staff' | 'visitor' | 'other'>('anonymous');
const retailCustomerName = ref('');
const retailCustomerReference = ref('');
const retailCheckoutNote = ref('');
const retailLineItems = ref<GeneralRetailLineItem[]>([]);
const retailPayments = ref<PaymentEntry[]>([{ clientId: 'retail-payment-1', paymentMethod: 'cash', amount: '', paymentReference: '', note: '' }]);
const retailDraftItemName = ref('');
const retailDraftItemCode = ref('');
const retailDraftQuantity = ref('1');
const retailDraftUnitPrice = ref('');
const retailDraftDiscount = ref('0');
const retailDraftTax = ref('0');
const retailDraftNote = ref('');
const saleActionMode = ref<'void' | 'refund'>('void');
const selectedSaleActionId = ref('');
const saleActionRegisterId = ref('');
const saleActionRefundMethod = ref('cash');
const saleActionReference = ref('');
const saleActionReasonCode = ref('customer_return');
const saleActionNote = ref('');
const saleActionSubmitting = ref(false);
const saleActionError = ref<string | null>(null);
const saleActionSuccess = ref<string | null>(null);
const labQuickLatestSaleId = ref('');
const otcLatestSaleId = ref('');
const cafeteriaLatestSaleId = ref('');
const sessionOpenRegisterId = ref('');
const sessionOpeningCashAmount = ref('100');
const sessionOpeningNote = ref('');
const sessionOpenSubmitting = ref(false);
const selectedCloseoutSessionId = ref('');
const closeoutSessionDetail = ref<PosSession | null>(null);
const closeoutCashAmount = ref('');
const closeoutNote = ref('');
const closeoutLoading = ref(false);
const closeoutSubmitting = ref(false);
const sessionActionError = ref<string | null>(null);
const sessionActionSuccess = ref<string | null>(null);

const readinessLabel = computed(() => totalRegisters.value === 0
    ? 'No registers configured'
    : totalOpenSessions.value === 0
      ? 'Registers configured, sessions closed'
      : 'Cashier sessions active');
const recentGrossAmount = computed(() => recentSales.value.reduce((sum, sale) => sum + Number(sale.totalAmount ?? 0), 0));
const readyRegisters = computed(() => registerRows.value.filter((row) => Boolean(row.currentOpenSession)));
const availableSessionRegisters = computed(() =>
    registerRows.value.filter((row) => !row.currentOpenSession && row.status !== 'inactive'));
const labQuickReadyRegisters = readyRegisters;
const otcReadyRegisters = readyRegisters;
const cafeteriaReadyRegisters = readyRegisters;
const retailReadyRegisters = readyRegisters;
const labQuickSelectedCurrency = computed(() =>
    labQuickReadyRegisters.value.find((row) => row.id === selectedLabRegisterId.value)?.defaultCurrencyCode
    || labQuickReadyRegisters.value[0]?.defaultCurrencyCode
    || 'TZS');
const otcSelectedCurrency = computed(() =>
    otcReadyRegisters.value.find((row) => row.id === selectedRegisterId.value)?.defaultCurrencyCode
    || otcReadyRegisters.value[0]?.defaultCurrencyCode
    || 'TZS');
const cafeteriaSelectedCurrency = computed(() =>
    cafeteriaReadyRegisters.value.find((row) => row.id === selectedCafeteriaRegisterId.value)?.defaultCurrencyCode
    || cafeteriaReadyRegisters.value[0]?.defaultCurrencyCode
    || 'TZS');
const retailSelectedCurrency = computed(() =>
    retailReadyRegisters.value.find((row) => row.id === selectedRetailRegisterId.value)?.defaultCurrencyCode
    || retailReadyRegisters.value[0]?.defaultCurrencyCode
    || 'TZS');
const selectedLabCandidate = computed(() =>
    labQuickCandidates.value.find((item) => item.id === selectedLabOrderId.value) ?? null);
const labQuickBasketTotal = computed(() =>
    roundMoney(labQuickBasketItems.value.reduce((sum, item) => sum + item.lineTotal, 0)));
const labQuickBasketPatientLabel = computed(() => {
    const firstItem = labQuickBasketItems.value[0];
    if (!firstItem) return 'No patient selected yet';
    return [firstItem.patientName, firstItem.patientNumber].filter(Boolean).join(' / ') || 'Patient basket';
});
const labQuickStatusCounts = computed<Record<string, number>>(() =>
    labQuickCandidates.value.reduce((counts, candidate) => {
        const key = String(candidate.sourceStatus || 'unknown');
        counts[key] = (counts[key] || 0) + 1;
        return counts;
    }, {} as Record<string, number>));
const selectedCatalogItem = computed(() => otcCatalogItems.value.find((item) => item.id === selectedCatalogItemId.value) ?? null);
const basketTotal = computed(() => roundMoney(basketItems.value.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)));
const labQuickPaymentTotal = computed(() => paymentEntriesTotal(labQuickPayments.value));
const otcPaymentTotal = computed(() => paymentEntriesTotal(otcPayments.value));
const cafeteriaPaymentTotal = computed(() => paymentEntriesTotal(cafeteriaPayments.value));
const selectedRemainingStock = computed(() => {
    if (!selectedCatalogItem.value) return 0;
    const onHand = Number(selectedCatalogItem.value.inventoryItem?.currentStock ?? 0);
    const reserved = basketItems.value.reduce((sum, item) => item.catalogItemId === selectedCatalogItem.value?.id ? sum + item.quantity : sum, 0);
    return roundMoney(Math.max(onHand - reserved, 0));
});
const selectedCafeteriaMenuItem = computed(() =>
    cafeteriaCatalogItems.value.find((item) => item.id === selectedCafeteriaMenuItemId.value) ?? null);
const cafeteriaBasketSubtotal = computed(() =>
    roundMoney(cafeteriaBasketItems.value.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)));
const cafeteriaBasketTax = computed(() =>
    roundMoney(cafeteriaBasketItems.value.reduce((sum, item) => sum + item.lineTaxAmount, 0)));
const cafeteriaBasketTotal = computed(() => roundMoney(cafeteriaBasketSubtotal.value + cafeteriaBasketTax.value));
const retailSubtotal = computed(() =>
    roundMoney(retailLineItems.value.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)));
const retailDiscountAmount = computed(() =>
    roundMoney(retailLineItems.value.reduce((sum, item) => sum + item.discountAmount, 0)));
const retailTaxAmount = computed(() =>
    roundMoney(retailLineItems.value.reduce((sum, item) => sum + item.taxAmount, 0)));
const retailTotal = computed(() =>
    roundMoney(retailSubtotal.value - retailDiscountAmount.value + retailTaxAmount.value));
const isEditingCafeteriaCatalogItem = computed(() => cafeteriaEditorId.value.trim() !== '');
const isEditingRegister = computed(() => registerEditorId.value.trim() !== '');
const selectedSaleAction = computed(() =>
    salesRows.value.find((sale) => sale.id === selectedSaleActionId.value) ?? null);
const salesSummaryLabel = computed(() => {
    if (salesSessionFilter.value) {
        const matchingSession = [...openSessionRows.value, ...closedSessionRows.value].find((session) => session.id === salesSessionFilter.value);
        return matchingSession?.sessionNumber
            ? `Filtered to session ${matchingSession.sessionNumber}`
            : 'Filtered to one cashier session';
    }

    if (salesSearch.value.trim() !== '') return `Search results for "${salesSearch.value.trim()}"`;
    return 'Search and filter across POS sales';
});
const closeoutPreview = computed(() => closeoutSessionDetail.value?.closeoutPreview ?? null);
const closeoutExpectedCashAmount = computed(() =>
    Number(closeoutPreview.value?.expectedCashAmount ?? closeoutSessionDetail.value?.expectedCashAmount ?? 0));
const closeoutVarianceAmount = computed(() => {
    const counted = Number(closeoutCashAmount.value || 0);
    return Number.isFinite(counted) ? roundMoney(counted - closeoutExpectedCashAmount.value) : 0;
});
const balancedClosedSessionCount = computed(() =>
    closedSessionRows.value.filter((session) => Number(session.discrepancyAmount ?? 0) === 0).length);
const closedSessionVarianceCount = computed(() =>
    closedSessionRows.value.filter((session) => Number(session.discrepancyAmount ?? 0) !== 0).length);
const closedSessionNetDiscrepancy = computed(() =>
    roundMoney(closedSessionRows.value.reduce((sum, session) => sum + Number(session.discrepancyAmount ?? 0), 0)));

watch(readyRegisters, (rows) => {
    if (!rows.some((row) => row.id === selectedLabRegisterId.value)) selectedLabRegisterId.value = rows[0]?.id ?? '';
    if (!rows.some((row) => row.id === selectedRegisterId.value)) selectedRegisterId.value = rows[0]?.id ?? '';
    if (!rows.some((row) => row.id === selectedCafeteriaRegisterId.value)) selectedCafeteriaRegisterId.value = rows[0]?.id ?? '';
    if (!rows.some((row) => row.id === selectedRetailRegisterId.value)) selectedRetailRegisterId.value = rows[0]?.id ?? '';
    if (!rows.some((row) => row.id === saleActionRegisterId.value)) saleActionRegisterId.value = rows[0]?.id ?? '';
}, { immediate: true });
watch(availableSessionRegisters, (rows) => {
    if (!rows.some((row) => row.id === sessionOpenRegisterId.value)) sessionOpenRegisterId.value = rows[0]?.id ?? '';
}, { immediate: true });
watch(salesRows, (sales) => {
    if (!sales.some((sale) => sale.id === selectedSaleActionId.value)) resetSaleAction();
});
watch(openSessionRows, (sessions) => {
    if (sessions.some((session) => session.id === selectedCloseoutSessionId.value)) return;
    selectedCloseoutSessionId.value = '';
    closeoutSessionDetail.value = null;
    closeoutCashAmount.value = '';
    closeoutNote.value = '';
});
watch(selectedLabCandidate, () => {
    labQuickLineNote.value = '';
}, { immediate: true });
watch([labQuickBasketTotal, () => labQuickPayments.value.map((entry) => `${entry.clientId}:${entry.paymentMethod}:${entry.amount}`).join('|')], ([total]) => {
    syncSinglePaymentEntry(labQuickPayments.value, total);
});
watch([selectedLabRegisterId, labQuickStatusFilter], ([registerId, status], [previousRegisterId, previousStatus]) => {
    if (loading.value) return;
    if (!canReadLabQuick.value) return;
    if (activeTab.value !== 'lab-quick') return;
    if (registerId === previousRegisterId && status === previousStatus) return;
    void loadLabQuickCandidates(true);
});
watch(selectedCatalogItem, (item) => {
    otcQuantity.value = '1';
    otcLineNote.value = '';
    otcUnitPrice.value = item?.otcUnitPrice != null ? String(item.otcUnitPrice) : '';
}, { immediate: true });
watch(otcCustomerMode, (mode) => {
    if (mode === 'patient') {
        checkoutCustomerName.value = '';
        checkoutCustomerReference.value = '';
        return;
    }

    otcPatientId.value = '';
});
watch([basketTotal, () => otcPayments.value.map((entry) => `${entry.clientId}:${entry.paymentMethod}:${entry.amount}`).join('|')], ([total]) => {
    syncSinglePaymentEntry(otcPayments.value, total);
});
watch(selectedCafeteriaMenuItem, () => {
    cafeteriaQuantity.value = '1';
    cafeteriaLineNote.value = '';
}, { immediate: true });
watch([cafeteriaBasketTotal, () => cafeteriaPayments.value.map((entry) => `${entry.clientId}:${entry.paymentMethod}:${entry.amount}`).join('|')], ([total]) => {
    syncSinglePaymentEntry(cafeteriaPayments.value, total);
});
watch(retailTotal, (total) => {
    syncSinglePaymentEntry(retailPayments.value, total);
});

function roundMoney(value: number): number { return Math.round(value * 100) / 100; }
function formatEnumLabel(value: string | null | undefined): string {
    return String(value ?? 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not available';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function formatCurrency(amount: string | number | null | undefined, currencyCode = 'TZS'): string {
    const numericAmount = Number(amount ?? 0);
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode || 'TZS', maximumFractionDigits: 2 }).format(numericAmount);
    } catch {
        return `${currencyCode || 'TZS'} ${numericAmount.toFixed(2)}`;
    }
}
function stockVariant(state: string | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (state === 'healthy') return 'default';
    if (state === 'low_stock') return 'secondary';
    if (state === 'out_of_stock') return 'destructive';
    return 'outline';
}
function catalogStatusVariant(status: string | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (status === 'active') return 'default';
    if (status === 'inactive') return 'secondary';
    return 'outline';
}
function saleStatusVariant(status: string | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (status === 'completed') return 'default';
    if (status === 'voided') return 'secondary';
    if (status === 'refunded') return 'destructive';
    return 'outline';
}
function sessionDiscrepancyVariant(amount: string | number | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
    const numericAmount = Number(amount ?? 0);
    if (numericAmount === 0) return 'default';
    if (numericAmount > 0) return 'secondary';
    return 'destructive';
}
function sessionDiscrepancyLabel(amount: string | number | null | undefined, currencyCode = 'TZS'): string {
    const numericAmount = Number(amount ?? 0);
    if (numericAmount === 0) return 'Balanced closeout';
    if (numericAmount > 0) return `Over by ${formatCurrency(numericAmount, currencyCode)}`;
    return `Short by ${formatCurrency(Math.abs(numericAmount), currencyCode)}`;
}
function retailLineTotal(item: GeneralRetailLineItem): number {
    return roundMoney((item.quantity * item.unitPrice) - item.discountAmount + item.taxAmount);
}
function createPaymentEntry(method = 'cash', amount = ''): PaymentEntry {
    return {
        clientId: `${method}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        paymentMethod: method,
        amount,
        paymentReference: '',
        note: '',
    };
}
function paymentEntriesTotal(entries: PaymentEntry[]): number {
    return roundMoney(entries.reduce((sum, entry) => {
        const amount = Number(entry.amount || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0));
}
function syncSinglePaymentEntry(entries: PaymentEntry[], total: number): void {
    if (entries.length !== 1) return;
    const [entry] = entries;
    if (!entry) return;
    if (entry.paymentMethod !== 'cash' || entry.amount.trim() === '') {
        entry.amount = total > 0 ? total.toFixed(2) : '';
    }
}
function addPaymentEntry(entries: { value: PaymentEntry[] }): void {
    entries.value = [...entries.value, createPaymentEntry()];
}
function removePaymentEntry(entries: { value: PaymentEntry[] }, clientId: string): void {
    if (entries.value.length === 1) {
        entries.value = [createPaymentEntry()];
        return;
    }

    entries.value = entries.value.filter((entry) => entry.clientId !== clientId);
}
function normalizePaymentEntries(
    entries: PaymentEntry[],
    saleTotal: number,
    setError: (message: string) => string,
): Array<{ paymentMethod: string; amount: number; paymentReference: string | null; note: string | null }> | null {
    if (entries.length === 0) return setError('Add at least one payment entry before checkout.'), null;

    const normalized = entries.map((entry, index) => {
        const amount = Number(entry.amount || 0);
        if (!entry.paymentMethod) {
            setError(`Select a payment method for payment ${index + 1}.`);
            return null;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            setError(`Enter a valid amount for payment ${index + 1}.`);
            return null;
        }

        return {
            paymentMethod: entry.paymentMethod,
            amount: roundMoney(amount),
            paymentReference: entry.paymentReference.trim() || null,
            note: entry.note.trim() || null,
        };
    });

    if (normalized.some((entry) => entry === null)) return null;

    const payments = normalized.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    const totalEntered = roundMoney(payments.reduce((sum, entry) => sum + entry.amount, 0));
    const nonCashTotal = roundMoney(payments.reduce((sum, entry) => sum + (entry.paymentMethod === 'cash' ? 0 : entry.amount), 0));
    const cashTotal = roundMoney(totalEntered - nonCashTotal);

    if (totalEntered + 0.001 < saleTotal) {
        return setError('Payments do not cover the sale total.'), null;
    }
    if (nonCashTotal > saleTotal + 0.001) {
        return setError('Non-cash payments cannot exceed the sale total.'), null;
    }
    if (totalEntered > saleTotal + 0.001 && cashTotal <= 0) {
        return setError('Only cash payments can exceed the sale total for change handling.'), null;
    }

    return payments;
}
function clearLabQuickMessages(): void { labQuickError.value = null; labQuickSuccess.value = null; labQuickLatestSaleId.value = ''; }
function clearOtcMessages(): void { otcError.value = null; otcSuccess.value = null; otcLatestSaleId.value = ''; }
function clearCafeteriaMessages(): void { cafeteriaError.value = null; cafeteriaSuccess.value = null; cafeteriaLatestSaleId.value = ''; }
function clearRetailMessages(): void { retailError.value = null; retailSuccess.value = null; retailLatestSaleId.value = ''; }
function clearRegisterMessages(): void { registerError.value = null; registerSuccess.value = null; }
function clearSaleActionMessages(): void { saleActionError.value = null; saleActionSuccess.value = null; }
function clearSessionActionMessages(): void { sessionActionError.value = null; sessionActionSuccess.value = null; }
function messageFromError(error: unknown, fallback: string): string { return error instanceof Error && error.message.trim() !== '' ? error.message : fallback; }
function cafeteriaLineTaxAmount(unitPrice: number, quantity: number, taxRatePercent: number): number {
    return roundMoney(unitPrice * quantity * (taxRatePercent / 100));
}
function cafeteriaLineTotal(item: CafeteriaBasketItem): number {
    return roundMoney((item.quantity * item.unitPrice) + item.lineTaxAmount);
}
function saleReceiptHref(saleId: string): string {
    return `/pos/sales/${saleId}/print`;
}
function saleReceiptPdfHref(saleId: string): string {
    return `/pos/sales/${saleId}/pdf`;
}
function sessionReportHref(sessionId: string): string {
    return `/pos/sessions/${sessionId}/report`;
}
function sessionReportPdfHref(sessionId: string): string {
    return `/pos/sessions/${sessionId}/report.pdf`;
}
function resetRegisterEditor(): void {
    registerEditorId.value = '';
    registerEditorCode.value = '';
    registerEditorName.value = '';
    registerEditorLocation.value = '';
    registerEditorCurrency.value = '';
    registerEditorStatus.value = 'active';
    registerEditorStatusReason.value = '';
    registerEditorNotes.value = '';
    clearRegisterMessages();
}
function populateRegisterEditor(register: PosRegister): void {
    clearRegisterMessages();
    registerEditorId.value = register.id;
    registerEditorCode.value = register.registerCode ?? '';
    registerEditorName.value = register.registerName ?? '';
    registerEditorLocation.value = register.location ?? '';
    registerEditorCurrency.value = register.defaultCurrencyCode ?? '';
    registerEditorStatus.value = register.status === 'inactive' ? 'inactive' : 'active';
    registerEditorStatusReason.value = register.statusReason ?? '';
    registerEditorNotes.value = register.notes ?? '';
}
function addRetailLineItem(): void {
    clearRetailMessages();

    const itemName = retailDraftItemName.value.trim();
    if (itemName === '') return retailError.value = 'Item name is required before adding a retail line.';

    const quantity = Number(retailDraftQuantity.value || 0);
    const unitPrice = Number(retailDraftUnitPrice.value || 0);
    const discountAmount = Number(retailDraftDiscount.value || 0);
    const taxAmount = Number(retailDraftTax.value || 0);

    if (!Number.isFinite(quantity) || quantity <= 0) return retailError.value = 'Line quantity must be greater than zero.';
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return retailError.value = 'Line unit price must be greater than zero.';
    if (!Number.isFinite(discountAmount) || discountAmount < 0) return retailError.value = 'Line discount cannot be negative.';
    if (!Number.isFinite(taxAmount) || taxAmount < 0) return retailError.value = 'Line tax cannot be negative.';

    const lineSubtotal = roundMoney(quantity * unitPrice);
    if (discountAmount > lineSubtotal) return retailError.value = 'Line discount cannot exceed the line subtotal.';

    retailLineItems.value = [...retailLineItems.value, {
        clientId: `retail-${Date.now()}-${retailLineItems.value.length + 1}`,
        itemName,
        itemCode: retailDraftItemCode.value.trim() || null,
        quantity: roundMoney(quantity),
        unitPrice: roundMoney(unitPrice),
        discountAmount: roundMoney(discountAmount),
        taxAmount: roundMoney(taxAmount),
        note: retailDraftNote.value.trim() || null,
    }];

    retailDraftItemName.value = '';
    retailDraftItemCode.value = '';
    retailDraftQuantity.value = '1';
    retailDraftUnitPrice.value = '';
    retailDraftDiscount.value = '0';
    retailDraftTax.value = '0';
    retailDraftNote.value = '';
}
function removeRetailLineItem(clientId: string): void {
    retailLineItems.value = retailLineItems.value.filter((item) => item.clientId !== clientId);
    clearRetailMessages();
}
function addRetailPaymentEntry(): void {
    addPaymentEntry(retailPayments);
}
function removeRetailPaymentEntry(clientId: string): void {
    removePaymentEntry(retailPayments, clientId);
}
function addLabQuickPaymentEntry(): void {
    addPaymentEntry(labQuickPayments);
}
function removeLabQuickPaymentEntry(clientId: string): void {
    removePaymentEntry(labQuickPayments, clientId);
}
function addOtcPaymentEntry(): void {
    addPaymentEntry(otcPayments);
}
function removeOtcPaymentEntry(clientId: string): void {
    removePaymentEntry(otcPayments, clientId);
}
function addCafeteriaPaymentEntry(): void {
    addPaymentEntry(cafeteriaPayments);
}
function removeCafeteriaPaymentEntry(clientId: string): void {
    removePaymentEntry(cafeteriaPayments, clientId);
}
function resetRetailCheckout(): void {
    retailCustomerType.value = 'anonymous';
    retailCustomerName.value = '';
    retailCustomerReference.value = '';
    retailCheckoutNote.value = '';
    retailLineItems.value = [];
    retailPayments.value = [createPaymentEntry()];
    retailDraftItemName.value = '';
    retailDraftItemCode.value = '';
    retailDraftQuantity.value = '1';
    retailDraftUnitPrice.value = '';
    retailDraftDiscount.value = '0';
    retailDraftTax.value = '0';
    retailDraftNote.value = '';
    clearRetailMessages();
}
function applySalesFilters(): void {
    salesPage.value = 1;
    void loadSalesWorkbench();
}
function clearSalesFilters(): void {
    salesSearch.value = '';
    salesChannelFilter.value = '';
    salesStatusFilter.value = '';
    salesPaymentMethodFilter.value = '';
    salesRegisterFilter.value = '';
    salesSessionFilter.value = '';
    salesDateFrom.value = '';
    salesDateTo.value = '';
    salesPage.value = 1;
    void loadSalesWorkbench();
}
function goToSalesPage(page: number): void {
    if (page < 1 || page > salesLastPage.value || page === salesPage.value) return;
    salesPage.value = page;
    void loadSalesWorkbench();
}
function openSessionSales(session: PosSession): void {
    salesSessionFilter.value = session.id;
    salesPage.value = 1;
    activeTab.value = 'overview';
    void loadSalesWorkbench();
}

async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, options: { query?: Record<string, string | number | null | undefined>; body?: Record<string, unknown> } = {}, retry = true): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(options.query ?? {}).forEach(([key, value]) => {
        if (value == null || String(value).trim() === '') return;
        url.searchParams.set(key, String(value));
    });
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    let body: string | undefined;
    if (method !== 'GET') {
        Object.assign(headers, csrfRequestHeaders(), { 'Content-Type': 'application/json' });
        body = JSON.stringify(options.body ?? {});
    }
    const response = await fetch(url.toString(), { method, credentials: 'same-origin', headers, body });
    if (response.status === 419 && retry && method !== 'GET') {
        await refreshCsrfToken();
        return apiRequest<T>(method, path, options, false);
    }
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
        const error = new Error(typeof payload.message === 'string' ? payload.message : `Request failed with status ${response.status}.`) as ApiError;
        error.status = response.status;
        error.payload = payload;
        throw error;
    }
    return payload as T;
}
async function loadPermissions(): Promise<void> {
    try {
        const response = await apiRequest<AuthPermissionsResponse>('GET', '/auth/me/permissions');
        const names = new Set((response.data ?? []).map((item) => item.name?.trim()).filter((name): name is string => Boolean(name)));
        canReadLabQuick.value = names.has('pos.lab-quick.read');
        canCreateLabQuick.value = names.has('pos.lab-quick.create');
        canReadPharmacyOtc.value = names.has('pos.pharmacy-otc.read');
        canCreatePharmacyOtc.value = names.has('pos.pharmacy-otc.create');
        canReadCafeteria.value = names.has('pos.cafeteria.read');
        canCreateCafeteria.value = names.has('pos.cafeteria.create');
        canManageCafeteriaCatalog.value = names.has('pos.cafeteria.manage-catalog');
        canReadSessions.value = names.has('pos.sessions.read');
        canManageSessions.value = names.has('pos.sessions.manage');
        canReadSales.value = names.has('pos.sales.read');
        canCreateSales.value = names.has('pos.sales.create');
        canVoidSales.value = names.has('pos.sales.void');
        canRefundSales.value = names.has('pos.sales.refund');
        canManageRegisters.value = names.has('pos.registers.manage');
    } catch {
        canReadLabQuick.value = false;
        canCreateLabQuick.value = false;
        canReadPharmacyOtc.value = false;
        canCreatePharmacyOtc.value = false;
        canReadCafeteria.value = false;
        canCreateCafeteria.value = false;
        canManageCafeteriaCatalog.value = false;
        canReadSessions.value = false;
        canManageSessions.value = false;
        canReadSales.value = false;
        canCreateSales.value = false;
        canVoidSales.value = false;
        canRefundSales.value = false;
        canManageRegisters.value = false;
    }
}
async function loadRegisters(): Promise<void> {
    const registersResponse = await apiRequest<Pager<PosRegister>>('GET', '/pos/registers', {
        query: {
            q: registerSearch.value.trim() || null,
            status: registerStatusFilter.value === 'all' ? null : registerStatusFilter.value,
            perPage: 24,
            page: 1,
            sortBy: 'registerName',
            sortDir: 'asc',
        },
    });
    registerRows.value = registersResponse.data;
    totalRegisters.value = registersResponse.meta.total;
}
async function loadSessionRails(): Promise<void> {
    if (!canReadSessions.value) {
        openSessionRows.value = [];
        closedSessionRows.value = [];
        totalOpenSessions.value = 0;
        totalClosedSessions.value = 0;
        return;
    }

    const [openSessionsResponse, closedSessionsResponse] = await Promise.all([
        apiRequest<Pager<PosSession>>('GET', '/pos/sessions', { query: { status: 'open', perPage: 8 } }),
        apiRequest<Pager<PosSession>>('GET', '/pos/sessions', { query: { status: 'closed', perPage: 6 } }),
    ]);

    openSessionRows.value = openSessionsResponse.data;
    closedSessionRows.value = closedSessionsResponse.data;
    totalOpenSessions.value = openSessionsResponse.meta.total;
    totalClosedSessions.value = closedSessionsResponse.meta.total;
}
async function loadRecentSales(): Promise<void> {
    if (!canReadSales.value) {
        recentSales.value = [];
        return;
    }

    const salesResponse = await apiRequest<Pager<PosSale>>('GET', '/pos/sales', { query: { perPage: 8 } });
    recentSales.value = salesResponse.data;
}
async function loadSalesWorkbench(): Promise<void> {
    if (!canReadSales.value) {
        salesRows.value = [];
        salesTotal.value = 0;
        salesLastPage.value = 1;
        return;
    }

    salesLoading.value = true;

    try {
        const response = await apiRequest<Pager<PosSale>>('GET', '/pos/sales', {
            query: {
                q: salesSearch.value.trim() || null,
                registerId: salesRegisterFilter.value || null,
                sessionId: salesSessionFilter.value || null,
                paymentMethod: salesPaymentMethodFilter.value || null,
                saleChannel: salesChannelFilter.value || null,
                status: salesStatusFilter.value || null,
                soldFrom: salesDateFrom.value || null,
                soldTo: salesDateTo.value || null,
                page: salesPage.value,
                perPage: salesPerPage.value,
            },
        });

        salesRows.value = response.data;
        salesTotal.value = Number(response.meta.total ?? 0);
        salesLastPage.value = Number(response.meta.lastPage ?? 1) || 1;
        salesPage.value = Number(response.meta.currentPage ?? salesPage.value) || 1;
    } catch {
        salesRows.value = [];
        salesTotal.value = 0;
        salesLastPage.value = 1;
    } finally {
        salesLoading.value = false;
    }
}
async function loadOperationalData(): Promise<void> {
    await Promise.all([loadRegisters(), loadSessionRails(), loadRecentSales(), loadSalesWorkbench()]);
}
async function loadCloseoutSessionDetail(sessionId: string): Promise<void> {
    if (!canReadSessions.value) return;

    closeoutLoading.value = true;
    try {
        const response = await apiRequest<{ data: PosSession }>('GET', `/pos/sessions/${sessionId}`);
        closeoutSessionDetail.value = response.data;
        closeoutCashAmount.value = Number(
            response.data.closeoutPreview?.expectedCashAmount
            ?? response.data.expectedCashAmount
            ?? response.data.openingCashAmount
            ?? 0,
        ).toFixed(2);
        closeoutNote.value = response.data.closingNote ?? '';
    } catch (error) {
        closeoutSessionDetail.value = null;
        sessionActionError.value = messageFromError(error, 'Unable to load session closeout preview.');
    } finally {
        closeoutLoading.value = false;
    }
}
async function loadLabQuickCandidates(force = false): Promise<void> {
    if (!canReadLabQuick.value) {
        labQuickCandidates.value = [];
        labQuickVisiblePatients.value = 0;
        return;
    }
    if (labQuickLoading.value) return;
    if (!force) clearLabQuickMessages();
    labQuickLoading.value = true;
    try {
        const statusFilter = labQuickStatusFilter.value === 'all' ? null : labQuickStatusFilter.value;
        const response = await apiRequest<Pager<LabQuickCandidate> & { meta: { total: number; visiblePatients?: number } }>('GET', '/pos/lab-quick/candidates', {
            query: {
                q: labQuickSearch.value.trim() || null,
                status: statusFilter,
                currencyCode: labQuickSelectedCurrency.value,
                perPage: 16,
                page: 1,
            },
        });
        labQuickCandidates.value = response.data;
        labQuickVisiblePatients.value = Number(response.meta.visiblePatients ?? 0);
        if (!response.data.some((item) => item.id === selectedLabOrderId.value)) selectedLabOrderId.value = '';
    } catch (error) {
        labQuickCandidates.value = [];
        labQuickVisiblePatients.value = 0;
        labQuickError.value = messageFromError(error, 'Unable to load payable laboratory orders.');
    } finally {
        labQuickLoading.value = false;
    }
}
async function loadOtcCatalog(force = false): Promise<void> {
    if (!canReadPharmacyOtc.value) {
        otcCatalogItems.value = [];
        return;
    }
    if (otcLoading.value) return;
    if (!force) clearOtcMessages();
    otcLoading.value = true;
    try {
        const response = await apiRequest<Pager<OtcCatalogItem>>('GET', '/pos/pharmacy-otc/catalog', {
            query: { q: otcSearch.value.trim() || null, perPage: 12, page: 1, sortBy: 'name', sortDir: 'asc' },
        });
        otcCatalogItems.value = response.data;
        if (!response.data.some((item) => item.id === selectedCatalogItemId.value)) selectedCatalogItemId.value = '';
    } catch (error) {
        otcCatalogItems.value = [];
        otcError.value = messageFromError(error, 'Unable to load pharmacy OTC catalog.');
    } finally {
        otcLoading.value = false;
    }
}
async function loadCafeteriaCatalog(force = false): Promise<void> {
    if (!canReadCafeteria.value) {
        cafeteriaCatalogItems.value = [];
        return;
    }
    if (cafeteriaLoading.value) return;
    if (!force) clearCafeteriaMessages();
    cafeteriaLoading.value = true;
    try {
        const statusFilter = canManageCafeteriaCatalog.value
            ? (cafeteriaStatusFilter.value === 'all' ? null : cafeteriaStatusFilter.value)
            : 'active';
        const response = await apiRequest<Pager<CafeteriaCatalogItem>>('GET', '/pos/cafeteria/catalog', {
            query: {
                q: cafeteriaSearch.value.trim() || null,
                category: cafeteriaCategory.value.trim() || null,
                status: statusFilter,
                perPage: 16,
                page: 1,
                sortBy: 'sortOrder',
                sortDir: 'asc',
            },
        });
        cafeteriaCatalogItems.value = response.data;
        if (!response.data.some((item) => item.id === selectedCafeteriaMenuItemId.value)) selectedCafeteriaMenuItemId.value = '';
        if (isEditingCafeteriaCatalogItem.value && !response.data.some((item) => item.id === cafeteriaEditorId.value)) {
            resetCafeteriaCatalogEditor();
        }
    } catch (error) {
        cafeteriaCatalogItems.value = [];
        cafeteriaError.value = messageFromError(error, 'Unable to load cafeteria menu catalog.');
    } finally {
        cafeteriaLoading.value = false;
    }
}
function addLabQuickToBasket(): void {
    clearLabQuickMessages();
    const candidate = selectedLabCandidate.value;
    if (!candidate) return labQuickError.value = 'Select one laboratory order before adding it to the basket.';
    if (!candidate.patientId) return labQuickError.value = 'This laboratory order is missing a patient link and cannot be settled through quick cashier.';
    if (labQuickBasketItems.value.some((item) => item.orderId === candidate.id)) return labQuickError.value = 'This laboratory order is already in the basket.';
    if (labQuickBasketItems.value[0]?.patientId && labQuickBasketItems.value[0].patientId !== candidate.patientId) {
        return labQuickError.value = 'Lab quick checkout can only hold one patient at a time.';
    }
    const lineTotal = Number(candidate.lineTotal ?? candidate.unitPrice ?? 0);
    if (!Number.isFinite(lineTotal) || lineTotal <= 0) return labQuickError.value = 'This laboratory order has no payable amount in the selected currency.';

    labQuickBasketItems.value = [...labQuickBasketItems.value, {
        clientId: `${candidate.id}-${Date.now()}-${labQuickBasketItems.value.length + 1}`,
        orderId: candidate.id,
        orderNumber: candidate.orderNumber,
        patientId: candidate.patientId,
        patientNumber: candidate.patientNumber,
        patientName: candidate.patientName,
        testCode: candidate.testCode,
        serviceCode: candidate.serviceCode,
        serviceName: candidate.serviceName,
        lineTotal: roundMoney(lineTotal),
        note: labQuickLineNote.value.trim() || null,
    }];
    labQuickLineNote.value = '';
}
function removeLabQuickBasketItem(clientId: string): void {
    labQuickBasketItems.value = labQuickBasketItems.value.filter((item) => item.clientId !== clientId);
    clearLabQuickMessages();
}
function resetLabQuickCheckout(): void {
    labQuickBasketItems.value = [];
    labQuickLineNote.value = '';
    labQuickPayments.value = [createPaymentEntry()];
    labQuickCheckoutNote.value = '';
    clearLabQuickMessages();
}
function addToBasket(): void {
    clearOtcMessages();
    const item = selectedCatalogItem.value;
    if (!item) return otcError.value = 'Select one approved medicine before adding to basket.';
    if (!item.otcEligible) return otcError.value = item.otcEligibilityReason || 'This medicine cannot be sold through OTC POS.';
    if (!item.inventoryItem) return otcError.value = 'No active inventory item matches this approved medicine in the current facility scope.';
    const quantity = Number(otcQuantity.value);
    const unitPrice = Number(otcUnitPrice.value);
    if (!Number.isFinite(quantity) || quantity <= 0) return otcError.value = 'Quantity must be greater than zero.';
    if (quantity > selectedRemainingStock.value) return otcError.value = 'Requested quantity exceeds the remaining visible stock.';
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return otcError.value = 'Enter a positive unit price before adding to basket.';
    basketItems.value = [...basketItems.value, {
        clientId: `${item.id}-${Date.now()}-${basketItems.value.length + 1}`,
        catalogItemId: item.id,
        code: item.code,
        name: item.name,
        quantity: roundMoney(quantity),
        unitPrice: roundMoney(unitPrice),
        note: otcLineNote.value.trim() || null,
    }];
    otcQuantity.value = '1';
    otcLineNote.value = '';
}
function removeBasketItem(clientId: string): void {
    basketItems.value = basketItems.value.filter((item) => item.clientId !== clientId);
    clearOtcMessages();
}
function resetCheckout(): void {
    basketItems.value = [];
    checkoutCustomerName.value = '';
    checkoutCustomerReference.value = '';
    otcCustomerMode.value = 'walk_in';
    otcPatientId.value = '';
    otcPayments.value = [createPaymentEntry()];
    checkoutNote.value = '';
    otcQuantity.value = '1';
    otcLineNote.value = '';
    clearOtcMessages();
}
function addCafeteriaToBasket(): void {
    clearCafeteriaMessages();
    const item = selectedCafeteriaMenuItem.value;
    if (!item) return cafeteriaError.value = 'Select one cafeteria menu item before adding to the tray.';
    if (item.status !== 'active') return cafeteriaError.value = 'Inactive cafeteria menu items cannot be added to the tray.';
    const quantity = Number(cafeteriaQuantity.value);
    const unitPrice = Number(item.unitPrice ?? 0);
    const taxRatePercent = Number(item.taxRatePercent ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return cafeteriaError.value = 'Quantity must be greater than zero.';
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return cafeteriaError.value = 'This cafeteria menu item needs a positive price before checkout.';
    cafeteriaBasketItems.value = [...cafeteriaBasketItems.value, {
        clientId: `${item.id}-${Date.now()}-${cafeteriaBasketItems.value.length + 1}`,
        menuItemId: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        category: item.category,
        unitLabel: item.unitLabel,
        quantity: roundMoney(quantity),
        unitPrice: roundMoney(unitPrice),
        taxRatePercent: roundMoney(taxRatePercent),
        lineTaxAmount: cafeteriaLineTaxAmount(unitPrice, quantity, taxRatePercent),
        note: cafeteriaLineNote.value.trim() || null,
    }];
    cafeteriaQuantity.value = '1';
    cafeteriaLineNote.value = '';
}
function removeCafeteriaBasketItem(clientId: string): void {
    cafeteriaBasketItems.value = cafeteriaBasketItems.value.filter((item) => item.clientId !== clientId);
    clearCafeteriaMessages();
}
function resetCafeteriaCheckout(): void {
    cafeteriaBasketItems.value = [];
    cafeteriaCustomerName.value = '';
    cafeteriaCustomerReference.value = '';
    cafeteriaPayments.value = [createPaymentEntry()];
    cafeteriaCheckoutNote.value = '';
    cafeteriaQuantity.value = '1';
    cafeteriaLineNote.value = '';
    clearCafeteriaMessages();
}
function resetCafeteriaCatalogEditor(): void {
    cafeteriaEditorId.value = '';
    cafeteriaEditorItemCode.value = '';
    cafeteriaEditorItemName.value = '';
    cafeteriaEditorCategory.value = '';
    cafeteriaEditorUnitLabel.value = '';
    cafeteriaEditorUnitPrice.value = '';
    cafeteriaEditorTaxRatePercent.value = '0';
    cafeteriaEditorStatus.value = 'active';
    cafeteriaEditorStatusReason.value = '';
    cafeteriaEditorSortOrder.value = '0';
    cafeteriaEditorDescription.value = '';
}
function populateCafeteriaCatalogEditor(item: CafeteriaCatalogItem): void {
    clearCafeteriaMessages();
    cafeteriaEditorId.value = item.id;
    cafeteriaEditorItemCode.value = item.itemCode ?? '';
    cafeteriaEditorItemName.value = item.itemName ?? '';
    cafeteriaEditorCategory.value = item.category ?? '';
    cafeteriaEditorUnitLabel.value = item.unitLabel ?? '';
    cafeteriaEditorUnitPrice.value = item.unitPrice != null ? String(item.unitPrice) : '';
    cafeteriaEditorTaxRatePercent.value = item.taxRatePercent != null ? String(item.taxRatePercent) : '0';
    cafeteriaEditorStatus.value = item.status === 'inactive' ? 'inactive' : 'active';
    cafeteriaEditorStatusReason.value = item.statusReason ?? '';
    cafeteriaEditorSortOrder.value = item.sortOrder != null ? String(item.sortOrder) : '0';
    cafeteriaEditorDescription.value = item.description ?? '';
}
function resetSaleAction(): void {
    selectedSaleActionId.value = '';
    saleActionMode.value = 'void';
    saleActionRegisterId.value = readyRegisters.value[0]?.id ?? '';
    saleActionRefundMethod.value = 'cash';
    saleActionReference.value = '';
    saleActionReasonCode.value = 'customer_return';
    saleActionNote.value = '';
    clearSaleActionMessages();
}
function openSaleAction(sale: PosSale, mode: 'void' | 'refund'): void {
    clearSaleActionMessages();
    selectedSaleActionId.value = sale.id;
    saleActionMode.value = mode;
    saleActionReasonCode.value = mode === 'void' ? 'error_correction' : 'customer_return';
    saleActionRefundMethod.value = 'cash';
    saleActionReference.value = '';
    saleActionNote.value = '';
    if (!readyRegisters.value.some((row) => row.id === saleActionRegisterId.value)) {
        saleActionRegisterId.value = readyRegisters.value[0]?.id ?? '';
    }
}
function latestSaleAdjustment(sale: PosSale): PosSaleAdjustment | null {
    const adjustments = Array.isArray(sale.adjustments) ? sale.adjustments : [];
    return adjustments.length > 0 ? adjustments[adjustments.length - 1] ?? null : null;
}
function canControlSale(sale: PosSale): boolean {
    return sale.status === 'completed' && (canVoidSales.value || canRefundSales.value);
}
async function submitSaleAction(): Promise<void> {
    clearSaleActionMessages();
    const sale = selectedSaleAction.value;
    if (!sale) return saleActionError.value = 'Select one recent sale before applying a control.';
    if (sale.status !== 'completed') return saleActionError.value = 'Only completed sales can be voided or refunded.';
    if (saleActionMode.value === 'void' && sale.session?.status !== 'open') {
        return saleActionError.value = 'The original cashier session is already closed, so this sale can no longer be voided.';
    }
    if (saleActionMode.value === 'void' && !canVoidSales.value) return saleActionError.value = 'This account cannot void POS sales.';
    if (saleActionMode.value === 'refund' && !canRefundSales.value) return saleActionError.value = 'This account cannot refund POS sales.';
    if (saleActionMode.value === 'refund' && !saleActionRegisterId.value.trim()) return saleActionError.value = 'Select an open register before processing a refund.';

    saleActionSubmitting.value = true;

    try {
        if (saleActionMode.value === 'void') {
            await apiRequest<{ data: PosSale }>('POST', `/pos/sales/${sale.id}/void`, {
                body: {
                    reasonCode: saleActionReasonCode.value,
                    note: saleActionNote.value.trim() || null,
                },
            });
            saleActionSuccess.value = `${sale.saleNumber || 'POS sale'} voided.`;
        } else {
            await apiRequest<{ data: PosSale }>('POST', `/pos/sales/${sale.id}/refund`, {
                body: {
                    registerId: saleActionRegisterId.value,
                    refundMethod: saleActionRefundMethod.value,
                    refundReference: saleActionReference.value.trim() || null,
                    reasonCode: saleActionReasonCode.value,
                    note: saleActionNote.value.trim() || null,
                },
            });
            saleActionSuccess.value = `${sale.saleNumber || 'POS sale'} refunded.`;
        }

        const refreshers: Array<Promise<unknown>> = [loadOperationalData()];
        if (sale.saleChannel === 'pharmacy_otc') refreshers.push(loadOtcCatalog(true));
        if (sale.saleChannel === 'cafeteria') refreshers.push(loadCafeteriaCatalog(true));
        await Promise.all(refreshers);
    } catch (error) {
        const requestError = error as ApiError;
        const validationErrors = requestError.payload?.errors as Record<string, string[]> | undefined;
        saleActionError.value = validationErrors
            ? validationErrors[Object.keys(validationErrors)[0]]?.[0] || messageFromError(error, 'Unable to process the POS sale control.')
            : messageFromError(error, 'Unable to process the POS sale control.');
    } finally {
        saleActionSubmitting.value = false;
    }
}
async function submitOpenSession(): Promise<void> {
    clearSessionActionMessages();
    if (!canManageSessions.value) return sessionActionError.value = 'This account cannot open cashier sessions.';
    if (!sessionOpenRegisterId.value.trim()) return sessionActionError.value = 'Select one register before opening a cashier session.';

    const openingCashAmount = Number(sessionOpeningCashAmount.value || 0);
    if (!Number.isFinite(openingCashAmount) || openingCashAmount < 0) {
        return sessionActionError.value = 'Enter a valid opening cash amount before opening the session.';
    }

    sessionOpenSubmitting.value = true;

    try {
        const response = await apiRequest<{ data: PosSession }>('POST', `/pos/registers/${sessionOpenRegisterId.value}/sessions`, {
            body: {
                openingCashAmount,
                openingNote: sessionOpeningNote.value.trim() || null,
            },
        });

        sessionActionSuccess.value = `${response.data.sessionNumber || 'Cashier session'} opened and ready for checkout.`;
        sessionOpeningCashAmount.value = '100';
        sessionOpeningNote.value = '';
        await Promise.all([loadOperationalData(), loadLabQuickCandidates(true)]);
    } catch (error) {
        const requestError = error as ApiError;
        const validationErrors = requestError.payload?.errors as Record<string, string[]> | undefined;
        sessionActionError.value = validationErrors
            ? validationErrors[Object.keys(validationErrors)[0]]?.[0] || messageFromError(error, 'Unable to open cashier session.')
            : messageFromError(error, 'Unable to open cashier session.');
    } finally {
        sessionOpenSubmitting.value = false;
    }
}
async function prepareCloseout(session: PosSession): Promise<void> {
    clearSessionActionMessages();
    selectedCloseoutSessionId.value = session.id;
    closeoutCashAmount.value = '';
    closeoutNote.value = '';
    await loadCloseoutSessionDetail(session.id);
}
function cancelCloseout(): void {
    selectedCloseoutSessionId.value = '';
    closeoutSessionDetail.value = null;
    closeoutCashAmount.value = '';
    closeoutNote.value = '';
    clearSessionActionMessages();
}
async function submitCloseout(): Promise<void> {
    clearSessionActionMessages();
    if (!canManageSessions.value) return sessionActionError.value = 'This account cannot close cashier sessions.';
    if (!selectedCloseoutSessionId.value.trim()) return sessionActionError.value = 'Select one live session before running closeout.';

    const closingCashAmount = Number(closeoutCashAmount.value || 0);
    if (!Number.isFinite(closingCashAmount) || closingCashAmount < 0) {
        return sessionActionError.value = 'Enter a valid counted cash amount before closing the session.';
    }

    closeoutSubmitting.value = true;

    try {
        const response = await apiRequest<{ data: PosSession }>('PATCH', `/pos/sessions/${selectedCloseoutSessionId.value}/close`, {
            body: {
                closingCashAmount,
                closingNote: closeoutNote.value.trim() || null,
            },
        });

        sessionActionSuccess.value = `${response.data.sessionNumber || 'Cashier session'} closed. ${sessionDiscrepancyLabel(response.data.discrepancyAmount, response.data.register?.defaultCurrencyCode || 'TZS')}.`;
        selectedCloseoutSessionId.value = '';
        closeoutSessionDetail.value = null;
        closeoutCashAmount.value = '';
        closeoutNote.value = '';
        await loadOperationalData();
    } catch (error) {
        const requestError = error as ApiError;
        const validationErrors = requestError.payload?.errors as Record<string, string[]> | undefined;
        sessionActionError.value = validationErrors
            ? validationErrors[Object.keys(validationErrors)[0]]?.[0] || messageFromError(error, 'Unable to close cashier session.')
            : messageFromError(error, 'Unable to close cashier session.');
    } finally {
        closeoutSubmitting.value = false;
    }
}

async function submitLabQuickSale(): Promise<void> {
    clearLabQuickMessages();
    if (!canCreateLabQuick.value) return labQuickError.value = 'This account cannot create laboratory quick cashier sales.';
    if (!selectedLabRegisterId.value.trim()) return labQuickError.value = 'Open one cashier session before settling laboratory orders.';
    if (labQuickBasketItems.value.length === 0) return labQuickError.value = 'Add at least one laboratory order to the basket before checkout.';
    const payments = normalizePaymentEntries(
        labQuickPayments.value,
        labQuickBasketTotal.value,
        (message) => (labQuickError.value = message),
    );
    if (!payments) return;

    labQuickSubmitting.value = true;

    try {
        const response = await apiRequest<{ data: PosSale }>('POST', '/pos/lab-quick/sales', {
            body: {
                registerId: selectedLabRegisterId.value,
                currencyCode: labQuickSelectedCurrency.value,
                notes: labQuickCheckoutNote.value.trim() || null,
                items: labQuickBasketItems.value.map((item) => ({
                    orderId: item.orderId,
                    note: item.note,
                })),
                payments,
            },
        });
        labQuickLatestSaleId.value = response.data.id;
        labQuickSuccess.value = [response.data.saleNumber || 'Lab quick sale recorded', response.data.receiptNumber ? `Receipt ${response.data.receiptNumber}` : null].filter(Boolean).join(' / ');
        resetLabQuickCheckout();
        await Promise.all([loadOperationalData(), loadLabQuickCandidates(true)]);
    } catch (error) {
        const requestError = error as ApiError;
        const validationErrors = requestError.payload?.errors as Record<string, string[]> | undefined;
        labQuickError.value = validationErrors
            ? validationErrors[Object.keys(validationErrors)[0]]?.[0] || messageFromError(error, 'Unable to record lab quick sale.')
            : messageFromError(error, 'Unable to record lab quick sale.');
    } finally {
        labQuickSubmitting.value = false;
    }
}

async function submitOtcSale(): Promise<void> {
    clearOtcMessages();
    if (!canCreatePharmacyOtc.value) return otcError.value = 'This account cannot create pharmacy OTC sales.';
    if (!selectedRegisterId.value.trim()) return otcError.value = 'Open one cashier session before OTC checkout.';
    if (basketItems.value.length === 0) return otcError.value = 'Add at least one medicine to the basket before checkout.';
    if (otcCustomerMode.value === 'patient' && !otcPatientId.value.trim()) {
        return otcError.value = 'Select the patient before recording a patient-linked OTC sale.';
    }
    if (otcCustomerMode.value === 'walk_in' && checkoutCustomerName.value.trim() === '' && checkoutCustomerReference.value.trim() === '') {
        return otcError.value = 'Capture at least a walk-in name or reference so the OTC counter stays traceable.';
    }
    const payments = normalizePaymentEntries(
        otcPayments.value,
        basketTotal.value,
        (message) => (otcError.value = message),
    );
    if (!payments) return;
    otcSubmitting.value = true;
    try {
        const response = await apiRequest<{ data: PosSale }>('POST', '/pos/pharmacy-otc/sales', {
            body: {
                registerId: selectedRegisterId.value,
                patientId: otcCustomerMode.value === 'patient' ? otcPatientId.value.trim() : null,
                customerName: otcCustomerMode.value === 'walk_in' ? checkoutCustomerName.value.trim() || null : null,
                customerReference: checkoutCustomerReference.value.trim() || null,
                notes: checkoutNote.value.trim() || null,
                items: basketItems.value.map((item) => ({ catalogItemId: item.catalogItemId, quantity: item.quantity, unitPrice: item.unitPrice, notes: item.note })),
                payments,
            },
        });
        otcLatestSaleId.value = response.data.id;
        otcSuccess.value = [response.data.saleNumber || 'OTC sale recorded', response.data.receiptNumber ? `Receipt ${response.data.receiptNumber}` : null].filter(Boolean).join(' / ');
        resetCheckout();
        await Promise.all([loadOperationalData(), loadOtcCatalog(true)]);
    } catch (error) {
        const requestError = error as ApiError;
        const validationErrors = requestError.payload?.errors as Record<string, string[]> | undefined;
        otcError.value = validationErrors
            ? validationErrors[Object.keys(validationErrors)[0]]?.[0] || messageFromError(error, 'Unable to record OTC sale.')
            : messageFromError(error, 'Unable to record OTC sale.');
    } finally {
        otcSubmitting.value = false;
    }
}
async function submitCafeteriaSale(): Promise<void> {
    clearCafeteriaMessages();
    if (!canCreateCafeteria.value) return cafeteriaError.value = 'This account cannot create cafeteria sales.';
    if (!selectedCafeteriaRegisterId.value.trim()) return cafeteriaError.value = 'Open one cashier session before cafeteria checkout.';
    if (cafeteriaBasketItems.value.length === 0) return cafeteriaError.value = 'Add at least one menu item to the tray before checkout.';
    const payments = normalizePaymentEntries(
        cafeteriaPayments.value,
        cafeteriaBasketTotal.value,
        (message) => (cafeteriaError.value = message),
    );
    if (!payments) return;
    cafeteriaSubmitting.value = true;
    try {
        const response = await apiRequest<{ data: PosSale }>('POST', '/pos/cafeteria/sales', {
            body: {
                registerId: selectedCafeteriaRegisterId.value,
                customerName: cafeteriaCustomerName.value.trim() || null,
                customerReference: cafeteriaCustomerReference.value.trim() || null,
                notes: cafeteriaCheckoutNote.value.trim() || null,
                items: cafeteriaBasketItems.value.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity, notes: item.note })),
                payments,
            },
        });
        cafeteriaLatestSaleId.value = response.data.id;
        cafeteriaSuccess.value = [response.data.saleNumber || 'Cafeteria sale recorded', response.data.receiptNumber ? `Receipt ${response.data.receiptNumber}` : null].filter(Boolean).join(' / ');
        resetCafeteriaCheckout();
        await Promise.all([loadOperationalData(), loadCafeteriaCatalog(true)]);
    } catch (error) {
        const requestError = error as ApiError;
        const validationErrors = requestError.payload?.errors as Record<string, string[]> | undefined;
        cafeteriaError.value = validationErrors
            ? validationErrors[Object.keys(validationErrors)[0]]?.[0] || messageFromError(error, 'Unable to record cafeteria sale.')
            : messageFromError(error, 'Unable to record cafeteria sale.');
    } finally {
        cafeteriaSubmitting.value = false;
    }
}
async function submitCafeteriaCatalogItem(): Promise<void> {
    clearCafeteriaMessages();
    if (!canManageCafeteriaCatalog.value) return cafeteriaError.value = 'This account cannot manage the cafeteria catalog.';
    const method = isEditingCafeteriaCatalogItem.value ? 'PATCH' : 'POST';
    const path = isEditingCafeteriaCatalogItem.value
        ? `/pos/cafeteria/catalog/${cafeteriaEditorId.value}`
        : '/pos/cafeteria/catalog';
    cafeteriaCatalogSaving.value = true;
    try {
        const response = await apiRequest<{ data: CafeteriaCatalogItem }>(method, path, {
            body: {
                itemCode: cafeteriaEditorItemCode.value.trim() || null,
                itemName: cafeteriaEditorItemName.value.trim(),
                category: cafeteriaEditorCategory.value.trim() || null,
                unitLabel: cafeteriaEditorUnitLabel.value.trim() || null,
                unitPrice: Number(cafeteriaEditorUnitPrice.value || 0),
                taxRatePercent: Number(cafeteriaEditorTaxRatePercent.value || 0),
                status: cafeteriaEditorStatus.value,
                statusReason: cafeteriaEditorStatusReason.value.trim() || null,
                sortOrder: Number(cafeteriaEditorSortOrder.value || 0),
                description: cafeteriaEditorDescription.value.trim() || null,
            },
        });
        cafeteriaSuccess.value = isEditingCafeteriaCatalogItem.value
            ? `${response.data.itemName || 'Menu item'} updated.`
            : `${response.data.itemName || 'Menu item'} created.`;
        resetCafeteriaCatalogEditor();
        await loadCafeteriaCatalog(true);
    } catch (error) {
        const requestError = error as ApiError;
        const validationErrors = requestError.payload?.errors as Record<string, string[]> | undefined;
        cafeteriaError.value = validationErrors
            ? validationErrors[Object.keys(validationErrors)[0]]?.[0] || messageFromError(error, 'Unable to save cafeteria catalog item.')
            : messageFromError(error, 'Unable to save cafeteria catalog item.');
    } finally {
        cafeteriaCatalogSaving.value = false;
    }
}
async function submitRegisterEditor(): Promise<void> {
    clearRegisterMessages();
    if (!canManageRegisters.value) return registerError.value = 'This account cannot manage POS registers.';
    if (registerEditorCode.value.trim() === '') return registerError.value = 'Register code is required.';
    if (registerEditorName.value.trim() === '') return registerError.value = 'Register name is required.';
    if (registerEditorStatus.value === 'inactive' && registerEditorStatusReason.value.trim() === '') {
        return registerError.value = 'Provide a reason before deactivating a register.';
    }

    registerSubmitting.value = true;

    const editing = isEditingRegister.value;
    const method = isEditingRegister.value ? 'PATCH' : 'POST';
    const path = isEditingRegister.value ? `/pos/registers/${registerEditorId.value}` : '/pos/registers';
    const body: Record<string, unknown> = {
        registerCode: registerEditorCode.value.trim(),
        registerName: registerEditorName.value.trim(),
        location: registerEditorLocation.value.trim() || null,
        defaultCurrencyCode: registerEditorCurrency.value.trim() || null,
        notes: registerEditorNotes.value.trim() || null,
    };

    if (isEditingRegister.value) {
        body.status = registerEditorStatus.value;
        body.statusReason = registerEditorStatus.value === 'inactive'
            ? registerEditorStatusReason.value.trim() || null
            : null;
    }

    try {
        const response = await apiRequest<{ data: PosRegister }>(method, path, { body });
        resetRegisterEditor();
        registerSuccess.value = editing
            ? `${response.data.registerName || 'Register'} updated.`
            : `${response.data.registerName || 'Register'} created.`;
        await loadRegisters();
    } catch (error) {
        const requestError = error as ApiError;
        const validationErrors = requestError.payload?.errors as Record<string, string[]> | undefined;
        registerError.value = validationErrors
            ? validationErrors[Object.keys(validationErrors)[0]]?.[0] || messageFromError(error, 'Unable to save POS register.')
            : messageFromError(error, 'Unable to save POS register.');
    } finally {
        registerSubmitting.value = false;
    }
}
async function submitRetailSale(): Promise<void> {
    clearRetailMessages();
    if (!canCreateSales.value) return retailError.value = 'This account cannot create general retail sales.';
    if (!selectedRetailRegisterId.value.trim()) return retailError.value = 'Open one cashier session before recording a retail sale.';
    if (retailLineItems.value.length === 0) return retailError.value = 'Add at least one retail line before checkout.';
    if (retailCustomerType.value !== 'anonymous' && retailCustomerName.value.trim() === '') {
        return retailError.value = 'Customer name is required for non-anonymous retail sales.';
    }

    const payments = normalizePaymentEntries(
        retailPayments.value,
        retailTotal.value,
        (message) => (retailError.value = message),
    );
    if (!payments) return;

    retailSubmitting.value = true;

    try {
        const response = await apiRequest<{ data: PosSale }>('POST', '/pos/sales', {
            body: {
                registerId: selectedRetailRegisterId.value,
                saleChannel: 'general_retail',
                customerType: retailCustomerType.value,
                customerName: retailCustomerName.value.trim() || null,
                customerReference: retailCustomerReference.value.trim() || null,
                notes: retailCheckoutNote.value.trim() || null,
                lineItems: retailLineItems.value.map((item) => ({
                    itemType: 'retail_item',
                    itemCode: item.itemCode,
                    itemName: item.itemName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discountAmount: item.discountAmount,
                    taxAmount: item.taxAmount,
                    notes: item.note,
                })),
                payments,
            },
        });

        resetRetailCheckout();
        retailLatestSaleId.value = response.data.id;
        retailSuccess.value = [response.data.saleNumber || 'Retail sale recorded', response.data.receiptNumber ? `Receipt ${response.data.receiptNumber}` : null]
            .filter(Boolean)
            .join(' / ');
        await loadOperationalData();
    } catch (error) {
        const requestError = error as ApiError;
        const validationErrors = requestError.payload?.errors as Record<string, string[]> | undefined;
        retailError.value = validationErrors
            ? validationErrors[Object.keys(validationErrors)[0]]?.[0] || messageFromError(error, 'Unable to record retail sale.')
            : messageFromError(error, 'Unable to record retail sale.');
    } finally {
        retailSubmitting.value = false;
    }
}

async function refreshPage(): Promise<void> {
    loading.value = true;
    errorMessage.value = null;
    try {
        await loadPermissions();
        await loadOperationalData();
        await Promise.all([loadOtcCatalog(true), loadCafeteriaCatalog(true)]);
    } catch (error) {
        errorMessage.value = messageFromError(error, 'Unable to load POS workspace.');
    } finally {
        loading.value = false;
    }
}

onMounted(refreshPage);
</script>

<template>
    <Head title="POS Operations" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col overflow-x-auto">
            <div class="border-b px-4 py-4 md:px-6">
            <section class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div class="min-w-0 space-y-2">
                    <div class="flex flex-wrap items-center gap-2">
                        <h1 class="text-lg font-semibold tracking-tight md:text-xl">POS Operations</h1>
                        <Badge variant="outline">{{ readinessLabel }}</Badge>
                        <Badge v-if="canReadPharmacyOtc" variant="secondary">Pharmacy OTC</Badge>
                        <Badge v-if="canReadCafeteria" variant="secondary">Cafeteria</Badge>
                        <Badge v-if="canCreateSales" variant="secondary">General Retail</Badge>
                        <Badge v-if="canVoidSales || canRefundSales" variant="secondary">Sale Controls</Badge>
                    </div>
                    <p class="text-sm text-muted-foreground">Use this workspace for counter sales only: OTC pharmacy, cafeteria, cashier sessions, receipts, refunds, and miscellaneous retail. Clinical orders stay in Billing.</p>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <div class="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm shadow-sm">
                        <div class="text-[11px] uppercase tracking-wide text-muted-foreground">Registers</div>
                        <div class="font-semibold">{{ totalRegisters }}</div>
                    </div>
                    <div class="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm shadow-sm">
                        <div class="text-[11px] uppercase tracking-wide text-muted-foreground">Open Sessions</div>
                        <div class="font-semibold">{{ totalOpenSessions }}</div>
                    </div>
                    <div class="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm shadow-sm">
                        <div class="text-[11px] uppercase tracking-wide text-muted-foreground">Recent Gross</div>
                        <div class="font-semibold">{{ formatCurrency(recentGrossAmount, recentSales[0]?.currencyCode ?? 'TZS') }}</div>
                    </div>
                    <Button size="sm" variant="outline" @click="refreshPage">Refresh</Button>
                </div>
            </section>

            <div v-if="errorMessage" class="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{{ errorMessage }}</div>
            </div>

            <Tabs v-model="activeTab" class="flex flex-1 flex-col gap-4 p-4 md:p-6">
            <TabsList class="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-6">
                <TabsTrigger value="overview" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm">
                    <AppIcon name="layout-dashboard" class="size-3.5" />
                    Cashier Home
                </TabsTrigger>
                <TabsTrigger value="pharmacy-otc" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm">
                    <AppIcon name="pill" class="size-3.5" />
                    OTC Pharmacy
                    <Badge v-if="basketItems.length > 0" class="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[10px]">{{ basketItems.length }}</Badge>
                </TabsTrigger>
                <TabsTrigger value="cafeteria" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm">
                    <AppIcon name="shopping-cart" class="size-3.5" />
                    Cafeteria
                    <Badge v-if="cafeteriaBasketItems.length > 0" class="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[10px]">{{ cafeteriaBasketItems.length }}</Badge>
                </TabsTrigger>
                <TabsTrigger value="general-retail" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm">
                    <AppIcon name="scan-line" class="size-3.5" />
                    Retail Desk
                    <Badge v-if="retailLineItems.length > 0" class="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[10px]">{{ retailLineItems.length }}</Badge>
                </TabsTrigger>
                <TabsTrigger value="sessions" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm">
                    <AppIcon name="clock-3" class="size-3.5" />
                    Sessions & Closeout
                    <Badge v-if="totalOpenSessions > 0" class="ml-0.5 h-4 min-w-4 rounded-full bg-emerald-600 px-1 text-[10px] text-white dark:bg-emerald-500">{{ totalOpenSessions }}</Badge>
                </TabsTrigger>
                <TabsTrigger value="operations" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm">
                    <AppIcon name="briefcase-business" class="size-3.5" />
                    Operations
                </TabsTrigger>
            </TabsList>

            <TabsContent value="lab-quick" class="mt-0 space-y-4">
            <section class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <CardTitle class="flex items-center gap-2 text-base"><AppIcon name="flask-conical" class="size-5 text-cyan-600 dark:text-cyan-400" />Lab Quick Cashier</CardTitle>
                                <CardDescription>Patient-linked laboratory order settlement using governed billing prices and the shared POS cash controls.</CardDescription>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <Badge variant="outline">{{ labQuickBasketItems.length }} basket lines</Badge>
                                <Badge variant="secondary">{{ formatCurrency(labQuickBasketTotal, labQuickSelectedCurrency) }}</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="space-y-4 pt-0">
                        <div v-if="!canReadLabQuick" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Lab quick cashier is permission-scoped. This account can still use the shared POS workspace, but the laboratory quick lane stays hidden until `pos.lab-quick.read` is granted.</div>
                        <template v-else>
                            <div class="grid gap-3 md:grid-cols-[1fr_1.2fr_0.8fr_auto]">
                                <div class="grid gap-2">
                                    <Label for="lab-quick-register">Checkout Register</Label>
                                    <Select v-model="selectedLabRegisterId">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select register with open session" />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem v-for="register in labQuickReadyRegisters" :key="register.id" :value="register.id">{{ `${register.registerName || 'Register'} (${register.registerCode || 'No Code'})` }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="lab-quick-search">Order / Patient Search</Label>
                                    <Input id="lab-quick-search" v-model="labQuickSearch" placeholder="Search by order number, patient, or test" @keydown.enter.prevent="loadLabQuickCandidates(true)" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="lab-quick-status">Status</Label>
                                    <Select v-model="labQuickStatusFilter">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="all">All payable statuses</SelectItem>
                                        <SelectItem value="ordered">Ordered</SelectItem>
                                        <SelectItem value="collected">Collected</SelectItem>
                                        <SelectItem value="in_progress">In progress</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="flex items-end">
                                    <Button variant="outline" :disabled="labQuickLoading" @click="loadLabQuickCandidates(true)">{{ labQuickLoading ? 'Loading...' : 'Refresh Queue' }}</Button>
                                </div>
                            </div>
                            <div class="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
                                <div class="space-y-3 rounded-lg border bg-muted/20 p-4">
                                    <div v-if="labQuickCandidates.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No payable laboratory orders matched this search. Orders already invoiced or already settled through lab quick are excluded automatically.</div>
                                    <div v-for="candidate in labQuickCandidates" :key="candidate.id" class="rounded-lg border px-4 py-3" :class="selectedLabOrderId === candidate.id ? 'border-cyan-300 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/30' : 'bg-background'">
                                        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div class="space-y-1">
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <p class="text-sm font-semibold">{{ candidate.serviceName || candidate.testName || 'Laboratory order' }}</p>
                                                    <Badge variant="outline">{{ candidate.orderNumber || 'No Order Number' }}</Badge>
                                                    <Badge variant="secondary">{{ formatEnumLabel(candidate.sourceStatus) }}</Badge>
                                                </div>
                                                <p class="text-xs text-muted-foreground">{{ [candidate.patientName, candidate.patientNumber].filter(Boolean).join(' / ') || 'Patient-linked order' }}</p>
                                                <p class="text-xs text-muted-foreground">{{ [candidate.testCode, candidate.serviceCode].filter(Boolean).join(' / ') || 'Governed laboratory service' }}</p>
                                                <p class="text-xs text-muted-foreground">Ordered {{ formatDateTime(candidate.orderedAt) }}<span v-if="candidate.resultedAt"> / Resulted {{ formatDateTime(candidate.resultedAt) }}</span></p>
                                            </div>
                                            <div class="flex shrink-0 flex-col items-start gap-2 md:items-end">
                                                <p class="text-sm font-medium">{{ formatCurrency(candidate.lineTotal, candidate.currencyCode || labQuickSelectedCurrency) }}</p>
                                                <Button size="sm" variant="outline" @click="selectedLabOrderId = candidate.id">{{ selectedLabOrderId === candidate.id ? 'Selected' : 'Prepare line' }}</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="space-y-3 rounded-lg border bg-background p-4">
                                    <div class="rounded-lg border bg-muted/20 p-4">
                                        <p class="text-sm font-semibold">{{ selectedLabCandidate?.serviceName || 'Select one laboratory order' }}</p>
                                        <p class="text-xs text-muted-foreground">{{ selectedLabCandidate ? [selectedLabCandidate.patientName, selectedLabCandidate.patientNumber, selectedLabCandidate.orderNumber].filter(Boolean).join(' / ') : 'Choose a payable lab order, confirm the patient basket, then add it to checkout.' }}</p>
                                        <div class="mt-4 grid gap-3 sm:grid-cols-2">
                                            <div class="rounded-lg border bg-background px-3 py-2 text-sm">
                                                <p class="text-xs text-muted-foreground">Test / Service Code</p>
                                                <p class="font-medium">{{ [selectedLabCandidate?.testCode, selectedLabCandidate?.serviceCode].filter(Boolean).join(' / ') || 'Pending selection' }}</p>
                                            </div>
                                            <div class="rounded-lg border bg-background px-3 py-2 text-sm">
                                                <p class="text-xs text-muted-foreground">Payable Amount</p>
                                                <p class="font-medium">{{ selectedLabCandidate ? formatCurrency(selectedLabCandidate.lineTotal, selectedLabCandidate.currencyCode || labQuickSelectedCurrency) : formatCurrency(0, labQuickSelectedCurrency) }}</p>
                                            </div>
                                        </div>
                                        <div class="mt-3 grid gap-2">
                                            <Label for="lab-quick-line-note">Line Note</Label>
                                            <Textarea id="lab-quick-line-note" v-model="labQuickLineNote" rows="2" placeholder="Optional lab quick line note" :disabled="!selectedLabCandidate" />
                                        </div>
                                        <div class="mt-4 flex flex-wrap gap-2">
                                            <Button :disabled="!selectedLabCandidate" @click="addLabQuickToBasket">Add To Basket</Button>
                                            <Button variant="outline" :disabled="!selectedLabOrderId" @click="selectedLabOrderId = ''">Clear Selection</Button>
                                        </div>
                                    </div>
                                    <div class="space-y-3 rounded-lg border bg-muted/20 p-4">
                                        <div class="flex items-center justify-between gap-3"><p class="text-sm font-semibold">Lab Basket</p><Badge variant="outline">{{ labQuickBasketItems.length }} lines</Badge></div>
                                        <div v-if="labQuickBasketItems.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Basket is empty. Add patient-linked lab orders here before checkout.</div>
                                        <div v-for="item in labQuickBasketItems" v-else :key="item.clientId" class="rounded-lg border bg-background px-4 py-3">
                                            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div>
                                                    <p class="text-sm font-semibold">{{ item.serviceName || 'Laboratory order' }}</p>
                                                    <p class="text-xs text-muted-foreground">{{ [item.patientName, item.patientNumber, item.orderNumber].filter(Boolean).join(' / ') }}</p>
                                                    <p class="text-xs text-muted-foreground">{{ [item.testCode, item.serviceCode].filter(Boolean).join(' / ') || 'Governed laboratory service' }}</p>
                                                    <p v-if="item.note" class="text-xs text-muted-foreground">{{ item.note }}</p>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <p class="text-sm font-medium">{{ formatCurrency(item.lineTotal, labQuickSelectedCurrency) }}</p>
                                                    <Button size="sm" variant="outline" @click="removeLabQuickBasketItem(item.clientId)">Remove</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="space-y-3 rounded-lg border bg-background p-4">
                                        <div class="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                                            <div class="flex flex-wrap items-center justify-between gap-2">
                                                <p class="font-medium">Patient lock</p>
                                                <p class="text-right font-medium">{{ labQuickBasketPatientLabel }}</p>
                                            </div>
                                            <p class="mt-1 text-xs text-muted-foreground">One patient per basket keeps cashier settlement aligned with the underlying lab encounter trail.</p>
                                        </div>
                                        <div class="space-y-3 rounded-lg border bg-muted/20 p-4">
                                            <div class="flex items-center justify-between gap-3">
                                                <p class="text-sm font-semibold">Payment Split</p>
                                                <Button size="sm" variant="outline" @click="addLabQuickPaymentEntry">Add Payment</Button>
                                            </div>
                                            <div v-for="entry in labQuickPayments" :key="entry.clientId" class="rounded-lg border bg-background p-4">
                                                <div class="grid gap-3 sm:grid-cols-2">
                                                    <div class="grid gap-2">
                                                        <Label>Method</Label>
                                                        <Select v-model="entry.paymentMethod">
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem v-for="option in paymentMethods" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div class="grid gap-2">
                                                        <Label>{{ entry.paymentMethod === 'cash' ? 'Amount Tendered' : 'Amount To Apply' }}</Label>
                                                        <Input v-model="entry.amount" inputmode="decimal" placeholder="0.00" />
                                                    </div>
                                                    <div class="grid gap-2">
                                                        <Label>Reference</Label>
                                                        <Input v-model="entry.paymentReference" placeholder="Wallet, bank, or card reference" />
                                                    </div>
                                                    <div class="grid gap-2">
                                                        <Label>Payment Note</Label>
                                                        <Input v-model="entry.note" placeholder="Optional payment note" />
                                                    </div>
                                                </div>
                                                <div class="mt-3 flex justify-end">
                                                    <Button size="sm" variant="outline" @click="removeLabQuickPaymentEntry(entry.clientId)">Remove Payment</Button>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="lab-quick-note">Checkout Note</Label>
                                            <Textarea id="lab-quick-note" v-model="labQuickCheckoutNote" rows="2" placeholder="Optional cashier or lab collection note" />
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                            <div class="grid gap-2 text-sm sm:grid-cols-2">
                                                <div class="flex items-center justify-between gap-2 sm:block"><p class="text-muted-foreground">Basket total</p><p class="text-lg font-semibold">{{ formatCurrency(labQuickBasketTotal, labQuickSelectedCurrency) }}</p></div>
                                                <div class="flex items-center justify-between gap-2 sm:block"><p class="text-muted-foreground">Payments entered</p><p class="font-medium">{{ formatCurrency(labQuickPaymentTotal, labQuickSelectedCurrency) }}</p></div>
                                            </div>
                                            <p class="mt-1 text-xs text-muted-foreground">Cash payments may exceed the basket total for change. Non-cash entries should stay within the remaining balance.</p>
                                        </div>
                                        <div v-if="labQuickError" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{{ labQuickError }}</div>
                                        <div v-if="labQuickSuccess" class="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200">
                                            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                <p>{{ labQuickSuccess }}</p>
                                                <div v-if="labQuickLatestSaleId" class="flex flex-wrap gap-2">
                                                    <Button as-child size="sm" variant="outline" class="border-cyan-300 bg-background text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-950/40">
                                                        <Link :href="saleReceiptHref(labQuickLatestSaleId)">Open Receipt</Link>
                                                    </Button>
                                                    <Button as-child size="sm" variant="outline" class="border-cyan-300 bg-background text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-950/40">
                                                        <a :href="saleReceiptPdfHref(labQuickLatestSaleId)">Receipt PDF</a>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex flex-wrap gap-2">
                                            <Button :disabled="labQuickSubmitting || labQuickBasketItems.length === 0 || !selectedLabRegisterId" @click="submitLabQuickSale">{{ labQuickSubmitting ? 'Recording Lab Sale...' : 'Record Lab Sale' }}</Button>
                                            <Button variant="outline" :disabled="labQuickBasketItems.length === 0" @click="resetLabQuickCheckout">Clear Basket</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </CardContent>
                </Card>
                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-3">
                        <CardTitle class="flex items-center gap-2 text-base"><AppIcon name="activity" class="size-5 text-cyan-600 dark:text-cyan-400" />Lab Queue Snapshot</CardTitle>
                        <CardDescription>Operational summary for the current payable laboratory quick queue.</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-4 pt-0">
                        <div v-if="!canReadLabQuick" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Queue analytics stay hidden until `pos.lab-quick.read` is granted.</div>
                        <template v-else>
                            <div class="grid gap-3 sm:grid-cols-2">
                                <div class="rounded-lg border border-cyan-200 bg-cyan-50/70 px-4 py-3 dark:border-cyan-900 dark:bg-cyan-950/30">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Payable Orders</p>
                                    <p class="mt-2 text-2xl font-semibold">{{ labQuickCandidates.length }}</p>
                                    <p class="mt-1 text-xs text-muted-foreground">Visible in the current register currency and search scope.</p>
                                </div>
                                <div class="rounded-lg border border-border/70 bg-muted/40 px-4 py-3">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Patients</p>
                                    <p class="mt-2 text-2xl font-semibold">{{ labQuickVisiblePatients }}</p>
                                    <p class="mt-1 text-xs text-muted-foreground">Distinct patients represented in the visible payable queue.</p>
                                </div>
                            </div>
                            <div class="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <p class="font-medium">Checkout context</p>
                                    <Badge variant="outline">{{ labQuickSelectedCurrency }}</Badge>
                                </div>
                                <p class="mt-2 text-muted-foreground">{{ selectedLabRegisterId ? `${labQuickReadyRegisters.find((row) => row.id === selectedLabRegisterId)?.registerName || 'Register'} is selected for cashier settlement.` : 'Select an open register to anchor cashier settlement and currency.' }}</p>
                            </div>
                            <div class="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                                <p class="font-medium">Status mix</p>
                                <div class="mt-3 flex flex-wrap gap-2">
                                    <Badge v-for="([status, count]) in Object.entries(labQuickStatusCounts)" :key="status" variant="outline">{{ `${formatEnumLabel(status)}: ${count}` }}</Badge>
                                    <Badge v-if="Object.keys(labQuickStatusCounts).length === 0" variant="outline">No visible orders</Badge>
                                </div>
                            </div>
                            <div class="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                                Orders already invoiced in billing or already settled through the lab quick lane are automatically removed from this queue so the cashier workboard stays reconciliation-safe.
                            </div>
                        </template>
                    </CardContent>
                </Card>
            </section>
            </TabsContent>

            <TabsContent value="pharmacy-otc" class="mt-0">
                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <CardTitle class="flex items-center gap-2 text-base"><AppIcon name="pill" class="size-5 text-emerald-600 dark:text-emerald-400" />Pharmacy OTC Counter</CardTitle>
                                <CardDescription>Walk-in pharmacy sale capture backed by approved medicines and live stock issue.</CardDescription>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <Badge variant="outline">{{ basketItems.length }} basket lines</Badge>
                                <Badge variant="secondary">{{ formatCurrency(basketTotal, otcSelectedCurrency) }}</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="space-y-4 pt-0">
                        <div v-if="!canReadPharmacyOtc" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Pharmacy OTC is permission-scoped. This account can still use the shared POS workspace, but the OTC medicine counter stays hidden until `pos.pharmacy-otc.read` is granted.</div>
                        <template v-else>
                            <div class="grid gap-3 lg:grid-cols-3">
                                <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Step 1</p>
                                    <p class="mt-2 text-sm font-semibold">Choose register</p>
                                    <p class="mt-1 text-xs text-muted-foreground">OTC checkout needs one open cashier session before medicines can be sold.</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Step 2</p>
                                    <p class="mt-2 text-sm font-semibold">Build medicine basket</p>
                                    <p class="mt-1 text-xs text-muted-foreground">Search approved OTC medicines, confirm stock, then add the requested quantity.</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Step 3</p>
                                    <p class="mt-2 text-sm font-semibold">Identify customer and collect payment</p>
                                    <p class="mt-1 text-xs text-muted-foreground">Link to a patient when needed, otherwise capture walk-in traceability and finish the split payment.</p>
                                </div>
                            </div>
                            <div class="rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                                <p class="font-medium">Use this lane only for direct OTC counter sales.</p>
                                <p class="mt-1 text-xs text-emerald-800 dark:text-emerald-200">Prescribed medicines and patient treatment orders should continue through clinical workflow plus Billing, not POS.</p>
                            </div>
                            <div class="grid gap-3 sm:grid-cols-2">
                                <div class="grid gap-2">
                                    <Label for="otc-register">Checkout Register</Label>
                                    <Select v-model="selectedRegisterId">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select register with open session" />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem v-for="register in otcReadyRegisters" :key="register.id" :value="register.id">{{ `${register.registerName || 'Register'} (${register.registerCode || 'No Code'})` }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="otc-search">Approved Medicine Search</Label>
                                    <div class="flex gap-2">
                                        <Input id="otc-search" v-model="otcSearch" placeholder="Search by medicine name, code, or category" @keydown.enter.prevent="loadOtcCatalog(true)" />
                                        <Button variant="outline" :disabled="otcLoading" @click="loadOtcCatalog(true)">{{ otcLoading ? 'Loading...' : 'Search' }}</Button>
                                    </div>
                                </div>
                            </div>
                            <div class="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
                                <div class="space-y-3 rounded-lg border bg-muted/20 p-4">
                                    <div v-if="otcCatalogItems.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No in-stock OTC medicines matched this search.</div>
                                    <div v-for="item in otcCatalogItems" :key="item.id" class="rounded-lg border px-4 py-3" :class="selectedCatalogItemId === item.id ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'bg-background'">
                                        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div class="space-y-1">
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <p class="text-sm font-semibold">{{ item.name || 'OTC medicine' }}</p>
                                                    <Badge variant="outline">{{ item.code || 'No code' }}</Badge>
                                                    <Badge :variant="stockVariant(item.inventoryItem?.stockState)">{{ formatEnumLabel(item.inventoryItem?.stockState) }}</Badge>
                                                    <Badge variant="default">Ready for OTC</Badge>
                                                </div>
                                                <p class="text-xs text-muted-foreground">{{ [item.strength, item.dosageForm, item.category].filter(Boolean).join(' / ') || 'OTC medicine' }}</p>
                                                <p class="text-xs text-muted-foreground">{{ item.inventoryItem ? `${item.inventoryItem.currentStock} ${item.inventoryItem.unit || item.unit || 'units'} on hand` : 'Stock details unavailable' }}</p>
                                            </div>
                                            <div class="flex shrink-0 flex-col items-start gap-2 md:items-end">
                                                <p class="text-sm font-medium">{{ item.otcUnitPrice != null ? formatCurrency(item.otcUnitPrice, otcSelectedCurrency) : 'Manual price' }}</p>
                                                <Button size="sm" variant="outline" @click="selectedCatalogItemId = item.id">{{ selectedCatalogItemId === item.id ? 'Selected' : 'Prepare line' }}</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="space-y-3 rounded-lg border bg-background p-4">
                                    <div class="rounded-lg border bg-muted/20 p-4">
                                        <p class="text-sm font-semibold">{{ selectedCatalogItem?.name || 'Select one approved medicine' }}</p>
                                        <p class="text-xs text-muted-foreground">{{ selectedCatalogItem ? `${selectedRemainingStock} remaining in basket view` : 'Search the approved medicines list, then set quantity and price before adding to basket.' }}</p>
                                        <div class="mt-4 grid gap-3 sm:grid-cols-2">
                                            <div class="grid gap-2"><Label for="otc-quantity">Quantity</Label><Input id="otc-quantity" v-model="otcQuantity" inputmode="decimal" placeholder="1" :disabled="!selectedCatalogItem" /></div>
                                            <div class="grid gap-2"><Label for="otc-unit-price">Unit Price</Label><Input id="otc-unit-price" v-model="otcUnitPrice" inputmode="decimal" placeholder="Enter OTC price" :disabled="!selectedCatalogItem" /></div>
                                        </div>
                                        <div class="mt-3 grid gap-2"><Label for="otc-line-note">Line Note</Label><Textarea id="otc-line-note" v-model="otcLineNote" rows="2" placeholder="Optional OTC line note" :disabled="!selectedCatalogItem" /></div>
                                        <div class="mt-4 flex flex-wrap gap-2"><Button :disabled="!selectedCatalogItem" @click="addToBasket">Add To Basket</Button><Button variant="outline" :disabled="!selectedCatalogItemId" @click="selectedCatalogItemId = ''">Clear Selection</Button></div>
                                    </div>
                                    <div class="space-y-3 rounded-lg border bg-muted/20 p-4">
                                        <div class="flex items-center justify-between gap-3"><p class="text-sm font-semibold">OTC Basket</p><Badge variant="outline">{{ basketItems.length }} lines</Badge></div>
                                        <div v-if="basketItems.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Basket is empty. Add medicines here before checkout.</div>
                                        <div v-for="item in basketItems" v-else :key="item.clientId" class="rounded-lg border bg-background px-4 py-3">
                                            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div><p class="text-sm font-semibold">{{ item.name || 'OTC basket item' }}</p><p class="text-xs text-muted-foreground">Qty {{ item.quantity }} x {{ formatCurrency(item.unitPrice, otcSelectedCurrency) }}</p><p v-if="item.note" class="text-xs text-muted-foreground">{{ item.note }}</p></div>
                                                <div class="flex items-center gap-2"><p class="text-sm font-medium">{{ formatCurrency(item.quantity * item.unitPrice, otcSelectedCurrency) }}</p><Button size="sm" variant="outline" @click="removeBasketItem(item.clientId)">Remove</Button></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="space-y-3 rounded-lg border bg-background p-4">
                                        <div class="grid gap-3 sm:grid-cols-2">
                                            <div class="grid gap-2">
                                                <Label for="otc-customer-mode">Checkout Mode</Label>
                                                <Select v-model="otcCustomerMode">
                                                    <SelectTrigger id="otc-customer-mode"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="walk_in">Walk-in customer</SelectItem>
                                                        <SelectItem value="patient">Existing patient</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                                                {{ otcCustomerMode === 'patient'
                                                    ? 'Patient-linked OTC keeps medication history and counseling traceable to the chart.'
                                                    : 'Walk-in OTC keeps the counter fast while still capturing who was served.' }}
                                            </div>
                                        </div>
                                        <div v-if="otcCustomerMode === 'patient'" class="grid gap-3 sm:grid-cols-2">
                                            <PatientLookupField
                                                input-id="otc-patient-id"
                                                v-model="otcPatientId"
                                                label="Patient"
                                                helper-text="Link the OTC sale to an existing patient record for continuity."
                                            />
                                            <div class="grid gap-2">
                                                <Label for="otc-customer-reference">Collection Reference</Label>
                                                <Input id="otc-customer-reference" v-model="checkoutCustomerReference" placeholder="Optional phone, pickup note, or visit reference" />
                                            </div>
                                        </div>
                                        <div v-else class="grid gap-3 sm:grid-cols-2">
                                            <div class="grid gap-2"><Label for="otc-customer-name">Customer Name</Label><Input id="otc-customer-name" v-model="checkoutCustomerName" placeholder="Walk-in customer name" /></div>
                                            <div class="grid gap-2"><Label for="otc-customer-reference">Customer Reference</Label><Input id="otc-customer-reference" v-model="checkoutCustomerReference" placeholder="Phone number or counter reference" /></div>
                                        </div>
                                        <div class="space-y-3 rounded-lg border bg-muted/20 p-4">
                                            <div class="flex items-center justify-between gap-3">
                                                <p class="text-sm font-semibold">Payment Split</p>
                                                <Button size="sm" variant="outline" @click="addOtcPaymentEntry">Add Payment</Button>
                                            </div>
                                            <div v-for="entry in otcPayments" :key="entry.clientId" class="rounded-lg border bg-background p-4">
                                                <div class="grid gap-3 sm:grid-cols-2">
                                                    <div class="grid gap-2"><Label>Method</Label><Select v-model="entry.paymentMethod"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="option in paymentMethods" :key="option.value" :value="option.value">{{ option.label }}</SelectItem></SelectContent></Select></div>
                                                    <div class="grid gap-2"><Label>{{ entry.paymentMethod === 'cash' ? 'Amount Tendered' : 'Amount To Apply' }}</Label><Input v-model="entry.amount" inputmode="decimal" placeholder="0.00" /></div>
                                                    <div class="grid gap-2"><Label>Reference</Label><Input v-model="entry.paymentReference" placeholder="Wallet, bank, or card reference" /></div>
                                                    <div class="grid gap-2"><Label>Payment Note</Label><Input v-model="entry.note" placeholder="Optional payment note" /></div>
                                                </div>
                                                <div class="mt-3 flex justify-end">
                                                    <Button size="sm" variant="outline" @click="removeOtcPaymentEntry(entry.clientId)">Remove Payment</Button>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="grid gap-2"><Label for="otc-note">Checkout Note</Label><Textarea id="otc-note" v-model="checkoutNote" rows="2" placeholder="Optional shift or OTC checkout note" /></div>
                                        <div class="rounded-lg border bg-muted/20 px-4 py-3"><div class="grid gap-2 text-sm sm:grid-cols-2"><div class="flex items-center justify-between gap-2 sm:block"><p class="text-muted-foreground">Basket total</p><p class="text-lg font-semibold">{{ formatCurrency(basketTotal, otcSelectedCurrency) }}</p></div><div class="flex items-center justify-between gap-2 sm:block"><p class="text-muted-foreground">Payments entered</p><p class="font-medium">{{ formatCurrency(otcPaymentTotal, otcSelectedCurrency) }}</p></div></div><p class="mt-1 text-xs text-muted-foreground">Cash payments may exceed the basket total for change. Non-cash entries should stay within the remaining balance.</p></div>
                                        <div v-if="otcError" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{{ otcError }}</div>
                                        <div v-if="otcSuccess" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                                            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                <p>{{ otcSuccess }}</p>
                                                <div v-if="otcLatestSaleId" class="flex flex-wrap gap-2">
                                                    <Button as-child size="sm" variant="outline" class="border-emerald-300 bg-background text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/40">
                                                        <Link :href="saleReceiptHref(otcLatestSaleId)">Open Receipt</Link>
                                                    </Button>
                                                    <Button as-child size="sm" variant="outline" class="border-emerald-300 bg-background text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/40">
                                                        <a :href="saleReceiptPdfHref(otcLatestSaleId)">Receipt PDF</a>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex flex-wrap gap-2"><Button :disabled="otcSubmitting || basketItems.length === 0 || !selectedRegisterId" @click="submitOtcSale">{{ otcSubmitting ? 'Recording OTC Sale...' : 'Record OTC Sale' }}</Button><Button variant="outline" :disabled="basketItems.length === 0" @click="resetCheckout">Clear Basket</Button></div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="general-retail" class="mt-0">
                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <CardTitle class="flex items-center gap-2 text-base"><AppIcon name="scan-line" class="size-5 text-violet-600 dark:text-violet-400" />General Retail Counter</CardTitle>
                                <CardDescription>Free-form retail capture for miscellaneous counter sales, direct shop items, and governed split-payment checkout.</CardDescription>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <Badge variant="outline">{{ retailLineItems.length }} retail lines</Badge>
                                <Badge variant="secondary">{{ formatCurrency(retailTotal, retailSelectedCurrency) }}</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="space-y-4 pt-0">
                        <div v-if="!canCreateSales" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">General retail capture stays hidden until `pos.sales.create` is granted.</div>
                        <template v-else>
                            <div class="grid gap-3 lg:grid-cols-3">
                                <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Step 1</p>
                                    <p class="mt-2 text-sm font-semibold">Choose register</p>
                                    <p class="mt-1 text-xs text-muted-foreground">Pick the active counter that will own the receipt, session totals, and any refund later.</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Step 2</p>
                                    <p class="mt-2 text-sm font-semibold">Enter retail lines</p>
                                    <p class="mt-1 text-xs text-muted-foreground">Capture free-form items such as parking, lost cards, shop items, or staff sales.</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Step 3</p>
                                    <p class="mt-2 text-sm font-semibold">Take payment and issue receipt</p>
                                    <p class="mt-1 text-xs text-muted-foreground">Complete the split payment, save the sale, and use the receipt links immediately.</p>
                                </div>
                            </div>
                            <div class="rounded-lg border border-violet-200 bg-violet-50/70 px-4 py-3 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
                                <p class="font-medium">Use Retail Desk for non-clinical cashier charges.</p>
                                <p class="mt-1 text-xs text-violet-800 dark:text-violet-200">This is the right place for miscellaneous counter revenue that does not belong to a clinical order or invoice workflow.</p>
                            </div>
                            <div class="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
                                <div class="space-y-3 rounded-lg border bg-muted/20 p-4">
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <div class="grid gap-2">
                                            <Label for="retail-register">Checkout Register</Label>
                                            <Select v-model="selectedRetailRegisterId">
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select register with open session" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem v-for="register in retailReadyRegisters" :key="register.id" :value="register.id">{{ `${register.registerName || 'Register'} (${register.registerCode || 'No Code'})` }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="retail-customer-type">Customer Type</Label>
                                            <Select v-model="retailCustomerType">
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="anonymous">Anonymous</SelectItem>
                                                    <SelectItem value="staff">Staff</SelectItem>
                                                    <SelectItem value="visitor">Visitor</SelectItem>
                                                    <SelectItem value="other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <div class="grid gap-2">
                                            <Label for="retail-customer-name">Customer Name</Label>
                                            <Input id="retail-customer-name" v-model="retailCustomerName" placeholder="Optional unless non-anonymous" />
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="retail-customer-reference">Customer Reference</Label>
                                            <Input id="retail-customer-reference" v-model="retailCustomerReference" placeholder="Phone, badge, or receipt ref" />
                                        </div>
                                    </div>
                                    <div class="rounded-lg border bg-background p-4">
                                        <div class="grid gap-3 sm:grid-cols-2">
                                            <div class="grid gap-2">
                                                <Label for="retail-item-name">Item Name</Label>
                                                <Input id="retail-item-name" v-model="retailDraftItemName" placeholder="Lost card, parking fee, snack pack" />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="retail-item-code">Item Code</Label>
                                                <Input id="retail-item-code" v-model="retailDraftItemCode" placeholder="Optional short code" />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="retail-item-quantity">Quantity</Label>
                                                <Input id="retail-item-quantity" v-model="retailDraftQuantity" inputmode="decimal" placeholder="1" />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="retail-item-unit-price">Unit Price</Label>
                                                <Input id="retail-item-unit-price" v-model="retailDraftUnitPrice" inputmode="decimal" placeholder="0.00" />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="retail-item-discount">Discount</Label>
                                                <Input id="retail-item-discount" v-model="retailDraftDiscount" inputmode="decimal" placeholder="0.00" />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="retail-item-tax">Tax</Label>
                                                <Input id="retail-item-tax" v-model="retailDraftTax" inputmode="decimal" placeholder="0.00" />
                                            </div>
                                        </div>
                                        <div class="mt-3 grid gap-2">
                                            <Label for="retail-item-note">Line Note</Label>
                                            <Input id="retail-item-note" v-model="retailDraftNote" placeholder="Optional note for this line" />
                                        </div>
                                        <div class="mt-4 flex flex-wrap gap-2">
                                            <Button @click="addRetailLineItem">Add Retail Line</Button>
                                        </div>
                                    </div>
                                </div>
                                <div class="space-y-3 rounded-lg border bg-background p-4">
                                    <div class="space-y-3 rounded-lg border bg-muted/20 p-4">
                                        <div class="flex items-center justify-between gap-3">
                                            <p class="text-sm font-semibold">Retail Basket</p>
                                            <Badge variant="outline">{{ retailLineItems.length }} lines</Badge>
                                        </div>
                                        <div v-if="retailLineItems.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No retail lines yet. Add one or more direct-sale lines before checkout.</div>
                                        <div v-for="item in retailLineItems" v-else :key="item.clientId" class="rounded-lg border bg-background px-4 py-3">
                                            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div>
                                                    <p class="text-sm font-semibold">{{ item.itemName }}</p>
                                                    <p class="text-xs text-muted-foreground">{{ [item.itemCode, `Qty ${item.quantity}`, formatCurrency(item.unitPrice, retailSelectedCurrency)].filter(Boolean).join(' / ') }}</p>
                                                    <p class="text-xs text-muted-foreground">Discount {{ formatCurrency(item.discountAmount, retailSelectedCurrency) }} / Tax {{ formatCurrency(item.taxAmount, retailSelectedCurrency) }}</p>
                                                    <p v-if="item.note" class="text-xs text-muted-foreground">{{ item.note }}</p>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <p class="text-sm font-medium">{{ formatCurrency(retailLineTotal(item), retailSelectedCurrency) }}</p>
                                                    <Button size="sm" variant="outline" @click="removeRetailLineItem(item.clientId)">Remove</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="space-y-3 rounded-lg border bg-background p-4">
                                        <div class="flex items-center justify-between gap-3">
                                            <p class="text-sm font-semibold">Payment Split</p>
                                            <Button size="sm" variant="outline" @click="addRetailPaymentEntry">Add Payment</Button>
                                        </div>
                                        <div v-for="entry in retailPayments" :key="entry.clientId" class="rounded-lg border bg-muted/20 p-4">
                                            <div class="grid gap-3 sm:grid-cols-2">
                                                <div class="grid gap-2">
                                                    <Label>Method</Label>
                                                    <Select v-model="entry.paymentMethod">
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem v-for="option in paymentMethods" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label>Amount</Label>
                                                    <Input v-model="entry.amount" inputmode="decimal" placeholder="0.00" />
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label>Reference</Label>
                                                    <Input v-model="entry.paymentReference" placeholder="Wallet, bank, or card reference" />
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label>Payment Note</Label>
                                                    <Input v-model="entry.note" placeholder="Optional payment note" />
                                                </div>
                                            </div>
                                            <div class="mt-3 flex justify-end">
                                                <Button size="sm" variant="outline" @click="removeRetailPaymentEntry(entry.clientId)">Remove Payment</Button>
                                            </div>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="retail-note">Checkout Note</Label>
                                            <Textarea id="retail-note" v-model="retailCheckoutNote" rows="2" placeholder="Optional direct-sale or shift note" />
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                            <div class="grid gap-2 text-sm sm:grid-cols-4">
                                                <div class="flex items-center justify-between gap-2 sm:block"><p class="text-muted-foreground">Subtotal</p><p class="font-medium">{{ formatCurrency(retailSubtotal, retailSelectedCurrency) }}</p></div>
                                                <div class="flex items-center justify-between gap-2 sm:block"><p class="text-muted-foreground">Discount</p><p class="font-medium">{{ formatCurrency(retailDiscountAmount, retailSelectedCurrency) }}</p></div>
                                                <div class="flex items-center justify-between gap-2 sm:block"><p class="text-muted-foreground">Tax</p><p class="font-medium">{{ formatCurrency(retailTaxAmount, retailSelectedCurrency) }}</p></div>
                                                <div class="flex items-center justify-between gap-2 sm:block"><p class="text-muted-foreground">Total</p><p class="text-lg font-semibold">{{ formatCurrency(retailTotal, retailSelectedCurrency) }}</p></div>
                                            </div>
                                        </div>
                                        <div v-if="retailError" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{{ retailError }}</div>
                                        <div v-if="retailSuccess" class="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
                                            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                <p>{{ retailSuccess }}</p>
                                                <div v-if="retailLatestSaleId" class="flex flex-wrap gap-2">
                                                    <Button as-child size="sm" variant="outline" class="border-violet-300 bg-background text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950/40">
                                                        <Link :href="saleReceiptHref(retailLatestSaleId)">Open Receipt</Link>
                                                    </Button>
                                                    <Button as-child size="sm" variant="outline" class="border-violet-300 bg-background text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950/40">
                                                        <a :href="saleReceiptPdfHref(retailLatestSaleId)">Receipt PDF</a>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex flex-wrap gap-2">
                                            <Button :disabled="retailSubmitting || retailLineItems.length === 0 || !selectedRetailRegisterId" @click="submitRetailSale">{{ retailSubmitting ? 'Recording Retail Sale...' : 'Record Retail Sale' }}</Button>
                                            <Button variant="outline" :disabled="retailLineItems.length === 0" @click="resetRetailCheckout">Clear Retail Basket</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="sessions" class="mt-0">
                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-3">
                        <CardTitle class="flex items-center gap-2 text-base"><AppIcon name="clock-3" class="size-5 text-emerald-600 dark:text-emerald-400" />Cashier Sessions & Closeout</CardTitle>
                        <CardDescription>Open drawer shifts, prepare closeout, and review the most recent reconciliation trail from the shared POS shell.</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-4 pt-0">
                        <div v-if="!canReadSessions" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Cashier session detail stays hidden until `pos.sessions.read` is granted.</div>
                        <template v-else>
                            <div class="grid gap-3 sm:grid-cols-3">
                                <div class="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Live Sessions</p>
                                    <p class="mt-2 text-2xl font-semibold">{{ totalOpenSessions }}</p>
                                    <p class="mt-1 text-xs text-muted-foreground">Registers currently able to capture sales right now.</p>
                                </div>
                                <div class="rounded-lg border border-border/70 bg-muted/40 px-4 py-3">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recent Closeouts</p>
                                    <p class="mt-2 text-2xl font-semibold">{{ totalClosedSessions }}</p>
                                    <p class="mt-1 text-xs text-muted-foreground">{{ balancedClosedSessionCount }} balanced closeout{{ balancedClosedSessionCount === 1 ? '' : 's' }} in the current recent view.</p>
                                </div>
                                <div class="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Variance Alerts</p>
                                    <p class="mt-2 text-2xl font-semibold">{{ closedSessionVarianceCount }}</p>
                                    <p class="mt-1 text-xs text-muted-foreground">{{ closedSessionVarianceCount === 0 ? 'Recent closeouts are balanced.' : `${sessionDiscrepancyLabel(closedSessionNetDiscrepancy, 'TZS')} across recent closeouts.` }}</p>
                                </div>
                            </div>

                            <div v-if="sessionActionError" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{{ sessionActionError }}</div>
                            <div v-if="sessionActionSuccess" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{{ sessionActionSuccess }}</div>

                            <div v-if="canManageSessions" class="rounded-lg border bg-muted/20 p-4">
                                <div class="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p class="text-sm font-semibold">Open cashier session</p>
                                        <p class="text-xs text-muted-foreground">Start the next register shift here when a visible counter is ready to receive sales.</p>
                                    </div>
                                    <Badge variant="outline">{{ availableSessionRegisters.length }} register{{ availableSessionRegisters.length === 1 ? '' : 's' }} ready</Badge>
                                </div>
                                <div v-if="availableSessionRegisters.length === 0" class="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">All visible registers already have an active session. Close one session before opening another.</div>
                                <div v-else class="mt-4 grid gap-3 sm:grid-cols-2">
                                    <div class="grid gap-2">
                                        <Label for="session-open-register">Register</Label>
                                        <Select v-model="sessionOpenRegisterId">
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select register" />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem v-for="register in availableSessionRegisters" :key="register.id" :value="register.id">{{ `${register.registerName || 'Register'} (${register.registerCode || 'No Code'})` }}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="session-opening-cash">Opening Cash</Label>
                                        <Input id="session-opening-cash" v-model="sessionOpeningCashAmount" inputmode="decimal" placeholder="100" />
                                    </div>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="session-opening-note">Opening Note</Label>
                                        <Textarea id="session-opening-note" v-model="sessionOpeningNote" rows="2" placeholder="Optional shift or drawer handover note" />
                                    </div>
                                </div>
                                <div v-if="availableSessionRegisters.length > 0" class="mt-4 flex flex-wrap gap-2">
                                    <Button :disabled="sessionOpenSubmitting || !sessionOpenRegisterId" @click="submitOpenSession">{{ sessionOpenSubmitting ? 'Opening Session...' : 'Open Session' }}</Button>
                                </div>
                            </div>

                            <div class="space-y-3">
                                <div class="flex items-center justify-between gap-3">
                                    <p class="text-sm font-semibold">Live cashier sessions</p>
                                    <Badge variant="outline">{{ openSessionRows.length }} visible</Badge>
                                </div>
                                <div v-if="loading" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Loading active sessions...</div>
                                <div v-else-if="openSessionRows.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No active cashier sessions right now. Open one session before OTC, cafeteria, or general retail capture can begin.</div>
                                <div v-for="session in openSessionRows" v-else :key="session.id" class="rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                                    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div class="flex flex-wrap items-center gap-2">
                                                <p class="text-sm font-semibold">{{ session.register?.registerName || 'Register' }}</p>
                                                <Badge variant="outline">{{ session.register?.registerCode || 'No Code' }}</Badge>
                                                <Badge>{{ formatEnumLabel(session.status || 'open') }}</Badge>
                                            </div>
                                            <p class="mt-1 text-xs text-muted-foreground">{{ session.register?.location || 'Location pending' }}</p>
                                        </div>
                                        <div class="flex flex-wrap gap-2 md:justify-end">
                                            <Badge variant="outline">{{ session.sessionNumber || 'Session pending' }}</Badge>
                                            <Button size="sm" variant="outline" @click="openSessionSales(session)">View Sales</Button>
                                            <Button as-child size="sm" variant="outline">
                                                <Link :href="sessionReportHref(session.id)">Shift Report</Link>
                                            </Button>
                                            <Button v-if="canManageSessions" size="sm" variant="outline" @click="prepareCloseout(session)">{{ selectedCloseoutSessionId === session.id ? 'Closeout Selected' : 'Prepare Closeout' }}</Button>
                                        </div>
                                    </div>
                                    <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                        <div>Opened: {{ formatDateTime(session.openedAt) }}</div>
                                        <div>Opening cash: {{ formatCurrency(session.openingCashAmount, session.register?.defaultCurrencyCode || 'TZS') }}</div>
                                        <div>Cashier user: {{ session.openedByUserId || 'System' }}</div>
                                        <div>Closeout action: {{ canManageSessions ? 'Ready' : 'View only' }}</div>
                                    </div>
                                </div>
                            </div>

                            <div v-if="selectedCloseoutSessionId" class="space-y-3 rounded-lg border bg-background p-4">
                                <div class="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p class="text-sm font-semibold">Closeout workspace</p>
                                        <p class="text-xs text-muted-foreground">{{ closeoutSessionDetail?.register?.registerName || 'Selected register' }} / {{ closeoutSessionDetail?.sessionNumber || 'Cashier session' }}</p>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Badge variant="outline">{{ closeoutSessionDetail?.register?.registerCode || 'POS' }}</Badge>
                                        <Badge>{{ formatEnumLabel(closeoutSessionDetail?.status || 'open') }}</Badge>
                                    </div>
                                </div>

                                <div v-if="closeoutLoading" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Loading closeout preview...</div>
                                <template v-else-if="closeoutSessionDetail">
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                            <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expected Cash</p>
                                            <p class="mt-2 text-2xl font-semibold">{{ formatCurrency(closeoutExpectedCashAmount, closeoutSessionDetail.register?.defaultCurrencyCode || 'TZS') }}</p>
                                            <p class="mt-1 text-xs text-muted-foreground">Opening cash plus cash sales less cash refunds and void adjustments.</p>
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                            <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sales Mix</p>
                                            <p class="mt-2 text-2xl font-semibold">{{ closeoutPreview?.saleCount ?? 0 }}</p>
                                            <p class="mt-1 text-xs text-muted-foreground">{{ formatCurrency(closeoutPreview?.cashNetSalesAmount, closeoutSessionDetail.register?.defaultCurrencyCode || 'TZS') }} cash / {{ formatCurrency(closeoutPreview?.nonCashSalesAmount, closeoutSessionDetail.register?.defaultCurrencyCode || 'TZS') }} non-cash</p>
                                        </div>
                                    </div>

                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <div class="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                                            <p class="font-medium">Closeout controls</p>
                                            <div class="mt-3 grid gap-3">
                                                <div class="grid gap-2">
                                                    <Label for="session-close-cash">Counted Cash</Label>
                                                    <Input id="session-close-cash" v-model="closeoutCashAmount" inputmode="decimal" placeholder="Enter counted drawer cash" />
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label for="session-close-note">Closing Note</Label>
                                                    <Textarea id="session-close-note" v-model="closeoutNote" rows="2" placeholder="Drawer handover, discrepancy explanation, or shift note" />
                                                </div>
                                            </div>
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                                            <p class="font-medium">Reconciliation preview</p>
                                            <div class="mt-3 space-y-2 text-muted-foreground">
                                                <div class="flex items-center justify-between gap-3"><span>Gross sales</span><span class="font-medium text-foreground">{{ formatCurrency(closeoutPreview?.grossSalesAmount, closeoutSessionDetail.register?.defaultCurrencyCode || 'TZS') }}</span></div>
                                                <div class="flex items-center justify-between gap-3"><span>Adjustments</span><span class="font-medium text-foreground">{{ formatCurrency(closeoutPreview?.adjustmentAmount, closeoutSessionDetail.register?.defaultCurrencyCode || 'TZS') }}</span></div>
                                                <div class="flex items-center justify-between gap-3"><span>Counted cash</span><span class="font-medium text-foreground">{{ formatCurrency(closeoutCashAmount || 0, closeoutSessionDetail.register?.defaultCurrencyCode || 'TZS') }}</span></div>
                                                <div class="flex items-center justify-between gap-3"><span>Projected variance</span><Badge :variant="sessionDiscrepancyVariant(closeoutVarianceAmount)">{{ sessionDiscrepancyLabel(closeoutVarianceAmount, closeoutSessionDetail.register?.defaultCurrencyCode || 'TZS') }}</Badge></div>
                                                <div class="flex items-center justify-between gap-3"><span>Refund / void count</span><span class="font-medium text-foreground">{{ `${closeoutPreview?.refundCount ?? 0} refund / ${closeoutPreview?.voidCount ?? 0} void` }}</span></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="flex flex-wrap gap-2">
                                        <Button as-child variant="outline">
                                            <Link :href="sessionReportHref(closeoutSessionDetail.id)">Open Shift Report</Link>
                                        </Button>
                                        <Button as-child variant="outline">
                                            <a :href="sessionReportPdfHref(closeoutSessionDetail.id)">Shift Report PDF</a>
                                        </Button>
                                        <Button :disabled="closeoutSubmitting" @click="submitCloseout">{{ closeoutSubmitting ? 'Closing Session...' : 'Confirm Closeout' }}</Button>
                                        <Button variant="outline" :disabled="closeoutSubmitting" @click="cancelCloseout">Cancel</Button>
                                    </div>
                                </template>
                            </div>

                            <div class="space-y-3">
                                <div class="flex items-center justify-between gap-3">
                                    <p class="text-sm font-semibold">Recent closeouts</p>
                                    <Badge variant="outline">{{ closedSessionRows.length }} visible</Badge>
                                </div>
                                <div v-if="loading" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Loading closeout history...</div>
                                <div v-else-if="closedSessionRows.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No recent closeouts yet. Closed sessions will appear here with cash variance and activity counts.</div>
                                <div v-for="session in closedSessionRows" v-else :key="`${session.id}-closed`" class="rounded-lg border border-border/70 bg-muted/40 px-4 py-3">
                                    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div class="flex flex-wrap items-center gap-2">
                                                <p class="text-sm font-semibold">{{ session.register?.registerName || 'Register' }}</p>
                                                <Badge variant="outline">{{ session.sessionNumber || 'Session' }}</Badge>
                                                <Badge :variant="sessionDiscrepancyVariant(session.discrepancyAmount)">{{ sessionDiscrepancyLabel(session.discrepancyAmount, session.register?.defaultCurrencyCode || 'TZS') }}</Badge>
                                            </div>
                                            <p class="mt-1 text-xs text-muted-foreground">{{ session.register?.registerCode || 'No Code' }} / Closed {{ formatDateTime(session.closedAt) }}</p>
                                        </div>
                                        <div class="flex flex-col items-start gap-2 text-xs text-muted-foreground md:items-end">
                                            <div>Sales: {{ session.saleCount ?? 0 }}</div>
                                            <div>Refunds: {{ session.refundCount ?? 0 }} / Voids: {{ session.voidCount ?? 0 }}</div>
                                            <div class="flex flex-wrap gap-2">
                                                <Button size="sm" variant="outline" @click="openSessionSales(session)">View Sales</Button>
                                                <Button as-child size="sm" variant="outline">
                                                    <Link :href="sessionReportHref(session.id)">Shift Report</Link>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                        <div>Expected cash: {{ formatCurrency(session.expectedCashAmount, session.register?.defaultCurrencyCode || 'TZS') }}</div>
                                        <div>Counted cash: {{ formatCurrency(session.closingCashAmount, session.register?.defaultCurrencyCode || 'TZS') }}</div>
                                        <div>Cash sales: {{ formatCurrency(session.cashNetSalesAmount, session.register?.defaultCurrencyCode || 'TZS') }}</div>
                                        <div>Adjustments: {{ formatCurrency(session.cashAdjustmentAmount, session.register?.defaultCurrencyCode || 'TZS') }}</div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="cafeteria" class="mt-0">
            <section class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <CardTitle class="flex items-center gap-2 text-base"><AppIcon name="shopping-cart" class="size-5 text-sky-600 dark:text-sky-400" />Cafeteria Counter</CardTitle>
                                <CardDescription>Food and beverage checkout running on the shared register, session, and receipt foundation.</CardDescription>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <Badge variant="outline">{{ cafeteriaBasketItems.length }} tray lines</Badge>
                                <Badge variant="secondary">{{ formatCurrency(cafeteriaBasketTotal, cafeteriaSelectedCurrency) }}</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="space-y-4 pt-0">
                        <div v-if="!canReadCafeteria" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Cafeteria POS is permission-scoped. This account can still use the shared POS shell, but the cafeteria counter stays hidden until `pos.cafeteria.read` is granted.</div>
                        <template v-else>
                            <div class="grid gap-3 lg:grid-cols-3">
                                <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Step 1</p>
                                    <p class="mt-2 text-sm font-semibold">Choose register</p>
                                    <p class="mt-1 text-xs text-muted-foreground">The cafeteria lane uses the same session and receipt foundation as the other cashier counters.</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Step 2</p>
                                    <p class="mt-2 text-sm font-semibold">Build tray</p>
                                    <p class="mt-1 text-xs text-muted-foreground">Search the menu, select active items, add quantity, and attach kitchen notes if needed.</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Step 3</p>
                                    <p class="mt-2 text-sm font-semibold">Collect payment</p>
                                    <p class="mt-1 text-xs text-muted-foreground">Take split payment, save the sale, and open the receipt or PDF for service handoff.</p>
                                </div>
                            </div>
                            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div class="grid gap-2">
                                    <Label for="cafeteria-register">Checkout Register</Label>
                                    <Select v-model="selectedCafeteriaRegisterId">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select register with open session" />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem v-for="register in cafeteriaReadyRegisters" :key="register.id" :value="register.id">{{ `${register.registerName || 'Register'} (${register.registerCode || 'No Code'})` }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="cafeteria-search">Menu Search</Label>
                                    <Input id="cafeteria-search" v-model="cafeteriaSearch" placeholder="Search by name, code, or category" @keydown.enter.prevent="loadCafeteriaCatalog(true)" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="cafeteria-category">Category</Label>
                                    <Input id="cafeteria-category" v-model="cafeteriaCategory" placeholder="Beverages, snacks, meals" @keydown.enter.prevent="loadCafeteriaCatalog(true)" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="cafeteria-status">Status</Label>
                                    <Select v-model="cafeteriaStatusFilter">
                                        <SelectTrigger :disabled="!canManageCafeteriaCatalog">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="active">Active only</SelectItem>
                                        <SelectItem value="inactive">Inactive only</SelectItem>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <Button variant="outline" :disabled="cafeteriaLoading" @click="loadCafeteriaCatalog(true)">{{ cafeteriaLoading ? 'Loading...' : 'Refresh Menu' }}</Button>
                                <Badge variant="outline">Only active items can be sold</Badge>
                            </div>
                            <div class="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
                                <div class="space-y-3 rounded-lg border bg-muted/20 p-4">
                                    <div v-if="cafeteriaCatalogItems.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No cafeteria menu items matched the current search.</div>
                                    <div v-for="item in cafeteriaCatalogItems" :key="item.id" class="rounded-lg border px-4 py-3" :class="selectedCafeteriaMenuItemId === item.id ? 'border-sky-300 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/30' : 'bg-background'">
                                        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div class="space-y-1">
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <p class="text-sm font-semibold">{{ item.itemName || 'Menu item' }}</p>
                                                    <Badge variant="outline">{{ item.itemCode || 'No code' }}</Badge>
                                                    <Badge :variant="catalogStatusVariant(item.status)">{{ formatEnumLabel(item.status) }}</Badge>
                                                    <Badge variant="secondary">{{ item.category || 'Uncategorised' }}</Badge>
                                                </div>
                                                <p class="text-xs text-muted-foreground">{{ [item.unitLabel, item.description].filter(Boolean).join(' / ') || 'Cafeteria menu item' }}</p>
                                                <p v-if="item.status === 'inactive' && item.statusReason" class="text-xs text-muted-foreground">{{ item.statusReason }}</p>
                                            </div>
                                            <div class="flex shrink-0 flex-col items-start gap-2 md:items-end">
                                                <p class="text-sm font-medium">{{ formatCurrency(item.unitPrice, cafeteriaSelectedCurrency) }}</p>
                                                <p class="text-xs text-muted-foreground">Tax {{ Number(item.taxRatePercent ?? 0).toFixed(2) }}%</p>
                                                <Button size="sm" variant="outline" :disabled="item.status !== 'active'" @click="selectedCafeteriaMenuItemId = item.id">{{ selectedCafeteriaMenuItemId === item.id ? 'Selected' : (item.status === 'active' ? 'Prepare line' : 'Inactive') }}</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="space-y-3 rounded-lg border bg-background p-4">
                                    <div class="rounded-lg border bg-muted/20 p-4">
                                        <p class="text-sm font-semibold">{{ selectedCafeteriaMenuItem?.itemName || 'Select one cafeteria menu item' }}</p>
                                        <p class="text-xs text-muted-foreground">{{ selectedCafeteriaMenuItem ? `${formatCurrency(selectedCafeteriaMenuItem.unitPrice, cafeteriaSelectedCurrency)} / ${selectedCafeteriaMenuItem.unitLabel || 'unit'} / Tax ${Number(selectedCafeteriaMenuItem.taxRatePercent ?? 0).toFixed(2)}%` : 'Search the cafeteria menu, then set quantity before adding to the tray.' }}</p>
                                        <div class="mt-4 grid gap-3 sm:grid-cols-2">
                                            <div class="grid gap-2"><Label for="cafeteria-quantity">Quantity</Label><Input id="cafeteria-quantity" v-model="cafeteriaQuantity" inputmode="decimal" placeholder="1" :disabled="!selectedCafeteriaMenuItem" /></div>
                                            <div class="grid gap-2"><Label for="cafeteria-line-note">Line Note</Label><Input id="cafeteria-line-note" v-model="cafeteriaLineNote" placeholder="Optional kitchen note" :disabled="!selectedCafeteriaMenuItem" /></div>
                                        </div>
                                        <div class="mt-4 flex flex-wrap gap-2"><Button :disabled="!selectedCafeteriaMenuItem" @click="addCafeteriaToBasket">Add To Tray</Button><Button variant="outline" :disabled="!selectedCafeteriaMenuItemId" @click="selectedCafeteriaMenuItemId = ''">Clear Selection</Button></div>
                                    </div>
                                    <div class="space-y-3 rounded-lg border bg-muted/20 p-4">
                                        <div class="flex items-center justify-between gap-3"><p class="text-sm font-semibold">Cafeteria Tray</p><Badge variant="outline">{{ cafeteriaBasketItems.length }} lines</Badge></div>
                                        <div v-if="cafeteriaBasketItems.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Tray is empty. Add menu items here before checkout.</div>
                                        <div v-for="item in cafeteriaBasketItems" v-else :key="item.clientId" class="rounded-lg border bg-background px-4 py-3">
                                            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div><p class="text-sm font-semibold">{{ item.itemName || 'Tray item' }}</p><p class="text-xs text-muted-foreground">Qty {{ item.quantity }} x {{ formatCurrency(item.unitPrice, cafeteriaSelectedCurrency) }}<span v-if="item.taxRatePercent > 0"> / Tax {{ item.taxRatePercent.toFixed(2) }}%</span></p><p v-if="item.note" class="text-xs text-muted-foreground">{{ item.note }}</p></div>
                                                <div class="flex items-center gap-2"><p class="text-sm font-medium">{{ formatCurrency(cafeteriaLineTotal(item), cafeteriaSelectedCurrency) }}</p><Button size="sm" variant="outline" @click="removeCafeteriaBasketItem(item.clientId)">Remove</Button></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="space-y-3 rounded-lg border bg-background p-4">
                                        <div class="grid gap-3 sm:grid-cols-2"><div class="grid gap-2"><Label for="cafeteria-customer-name">Customer Name</Label><Input id="cafeteria-customer-name" v-model="cafeteriaCustomerName" placeholder="Optional visitor or staff name" /></div><div class="grid gap-2"><Label for="cafeteria-customer-reference">Customer Reference</Label><Input id="cafeteria-customer-reference" v-model="cafeteriaCustomerReference" placeholder="Optional phone or badge number" /></div></div>
                                        <div class="space-y-3 rounded-lg border bg-muted/20 p-4">
                                            <div class="flex items-center justify-between gap-3">
                                                <p class="text-sm font-semibold">Payment Split</p>
                                                <Button size="sm" variant="outline" @click="addCafeteriaPaymentEntry">Add Payment</Button>
                                            </div>
                                            <div v-for="entry in cafeteriaPayments" :key="entry.clientId" class="rounded-lg border bg-background p-4">
                                                <div class="grid gap-3 sm:grid-cols-2">
                                                    <div class="grid gap-2"><Label>Method</Label><Select v-model="entry.paymentMethod"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="option in paymentMethods" :key="option.value" :value="option.value">{{ option.label }}</SelectItem></SelectContent></Select></div>
                                                    <div class="grid gap-2"><Label>{{ entry.paymentMethod === 'cash' ? 'Amount Tendered' : 'Amount To Apply' }}</Label><Input v-model="entry.amount" inputmode="decimal" placeholder="0.00" /></div>
                                                    <div class="grid gap-2"><Label>Reference</Label><Input v-model="entry.paymentReference" placeholder="Wallet, bank, or card reference" /></div>
                                                    <div class="grid gap-2"><Label>Payment Note</Label><Input v-model="entry.note" placeholder="Optional payment note" /></div>
                                                </div>
                                                <div class="mt-3 flex justify-end">
                                                    <Button size="sm" variant="outline" @click="removeCafeteriaPaymentEntry(entry.clientId)">Remove Payment</Button>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="grid gap-2"><Label for="cafeteria-note">Checkout Note</Label><Textarea id="cafeteria-note" v-model="cafeteriaCheckoutNote" rows="2" placeholder="Optional kitchen or shift note" /></div>
                                        <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                            <div class="grid gap-2 text-sm sm:grid-cols-4">
                                                <div class="flex items-center justify-between gap-2 sm:block"><p class="text-muted-foreground">Subtotal</p><p class="font-medium">{{ formatCurrency(cafeteriaBasketSubtotal, cafeteriaSelectedCurrency) }}</p></div>
                                                <div class="flex items-center justify-between gap-2 sm:block"><p class="text-muted-foreground">Tax</p><p class="font-medium">{{ formatCurrency(cafeteriaBasketTax, cafeteriaSelectedCurrency) }}</p></div>
                                                <div class="flex items-center justify-between gap-2 sm:block"><p class="text-muted-foreground">Total</p><p class="text-lg font-semibold">{{ formatCurrency(cafeteriaBasketTotal, cafeteriaSelectedCurrency) }}</p></div>
                                                <div class="flex items-center justify-between gap-2 sm:block"><p class="text-muted-foreground">Payments entered</p><p class="font-medium">{{ formatCurrency(cafeteriaPaymentTotal, cafeteriaSelectedCurrency) }}</p></div>
                                            </div>
                                            <p class="mt-2 text-xs text-muted-foreground">Cash payments may exceed the tray total for change. Non-cash entries should stay within the remaining balance.</p>
                                        </div>
                                        <div v-if="cafeteriaError" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{{ cafeteriaError }}</div>
                                        <div v-if="cafeteriaSuccess" class="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                                            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                <p>{{ cafeteriaSuccess }}</p>
                                                <div v-if="cafeteriaLatestSaleId" class="flex flex-wrap gap-2">
                                                    <Button as-child size="sm" variant="outline" class="border-sky-300 bg-background text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-200 dark:hover:bg-sky-950/40">
                                                        <Link :href="saleReceiptHref(cafeteriaLatestSaleId)">Open Receipt</Link>
                                                    </Button>
                                                    <Button as-child size="sm" variant="outline" class="border-sky-300 bg-background text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-200 dark:hover:bg-sky-950/40">
                                                        <a :href="saleReceiptPdfHref(cafeteriaLatestSaleId)">Receipt PDF</a>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex flex-wrap gap-2"><Button :disabled="cafeteriaSubmitting || cafeteriaBasketItems.length === 0 || !selectedCafeteriaRegisterId" @click="submitCafeteriaSale">{{ cafeteriaSubmitting ? 'Recording Cafeteria Sale...' : 'Record Cafeteria Sale' }}</Button><Button variant="outline" :disabled="cafeteriaBasketItems.length === 0" @click="resetCafeteriaCheckout">Clear Tray</Button></div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </CardContent>
                </Card>
                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-3">
                        <CardTitle class="flex items-center gap-2 text-base"><AppIcon name="book-open" class="size-5 text-amber-600 dark:text-amber-400" />Cafeteria Menu Studio</CardTitle>
                        <CardDescription>Quick catalog control for items, pricing, tax, and activation state.</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-4 pt-0">
                        <div v-if="!canManageCafeteriaCatalog" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Menu catalog management stays hidden until `pos.cafeteria.manage-catalog` is granted.</div>
                        <template v-else>
                            <div class="grid gap-3 sm:grid-cols-2">
                                <div class="grid gap-2"><Label for="cafeteria-editor-code">Item Code</Label><Input id="cafeteria-editor-code" v-model="cafeteriaEditorItemCode" placeholder="CAF-COFFEE" /></div>
                                <div class="grid gap-2"><Label for="cafeteria-editor-name">Item Name</Label><Input id="cafeteria-editor-name" v-model="cafeteriaEditorItemName" placeholder="House Coffee" /></div>
                                <div class="grid gap-2"><Label for="cafeteria-editor-category">Category</Label><Input id="cafeteria-editor-category" v-model="cafeteriaEditorCategory" placeholder="Beverages" /></div>
                                <div class="grid gap-2"><Label for="cafeteria-editor-unit">Unit Label</Label><Input id="cafeteria-editor-unit" v-model="cafeteriaEditorUnitLabel" placeholder="cup, plate, bottle" /></div>
                                <div class="grid gap-2"><Label for="cafeteria-editor-price">Unit Price</Label><Input id="cafeteria-editor-price" v-model="cafeteriaEditorUnitPrice" inputmode="decimal" placeholder="2500" /></div>
                                <div class="grid gap-2"><Label for="cafeteria-editor-tax">Tax Rate %</Label><Input id="cafeteria-editor-tax" v-model="cafeteriaEditorTaxRatePercent" inputmode="decimal" placeholder="0" /></div>
                                <div class="grid gap-2"><Label for="cafeteria-editor-status">Status</Label><Select v-model="cafeteriaEditorStatus"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
                                <div class="grid gap-2"><Label for="cafeteria-editor-sort">Sort Order</Label><Input id="cafeteria-editor-sort" v-model="cafeteriaEditorSortOrder" inputmode="numeric" placeholder="0" /></div>
                            </div>
                            <div class="grid gap-2"><Label for="cafeteria-editor-status-reason">Status Reason</Label><Input id="cafeteria-editor-status-reason" v-model="cafeteriaEditorStatusReason" placeholder="Why this item is inactive or constrained" /></div>
                            <div class="grid gap-2"><Label for="cafeteria-editor-description">Description</Label><Textarea id="cafeteria-editor-description" v-model="cafeteriaEditorDescription" rows="3" placeholder="Short service or kitchen note for this menu item" /></div>
                            <div class="flex flex-wrap gap-2"><Button :disabled="cafeteriaCatalogSaving" @click="submitCafeteriaCatalogItem">{{ cafeteriaCatalogSaving ? 'Saving...' : (isEditingCafeteriaCatalogItem ? 'Update Menu Item' : 'Create Menu Item') }}</Button><Button variant="outline" @click="resetCafeteriaCatalogEditor">Reset Form</Button></div>
                            <div class="space-y-3 rounded-lg border bg-muted/20 p-4">
                                <div class="flex items-center justify-between gap-3"><p class="text-sm font-semibold">Loaded Menu Items</p><Badge variant="outline">{{ cafeteriaCatalogItems.length }} visible</Badge></div>
                                <div v-if="cafeteriaCatalogItems.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Run a menu search or switch the status filter to load items here.</div>
                                <div v-for="item in cafeteriaCatalogItems" :key="`${item.id}-editor`" class="rounded-lg border bg-background px-4 py-3">
                                    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div><div class="flex flex-wrap items-center gap-2"><p class="text-sm font-semibold">{{ item.itemName || 'Menu item' }}</p><Badge variant="outline">{{ item.itemCode || 'No code' }}</Badge><Badge :variant="catalogStatusVariant(item.status)">{{ formatEnumLabel(item.status) }}</Badge></div><p class="text-xs text-muted-foreground">{{ [item.category, item.unitLabel].filter(Boolean).join(' / ') || 'Menu item' }}</p><p class="text-xs text-muted-foreground">{{ formatCurrency(item.unitPrice, cafeteriaSelectedCurrency) }} / Tax {{ Number(item.taxRatePercent ?? 0).toFixed(2) }}%</p></div>
                                        <div class="flex items-center gap-2"><Button size="sm" variant="outline" @click="populateCafeteriaCatalogEditor(item)">Edit</Button></div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </CardContent>
                </Card>
            </section>
            </TabsContent>

            <TabsContent value="overview" class="mt-0 space-y-4">
                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <CardTitle class="flex items-center gap-2 text-base"><AppIcon name="compass" class="size-5 text-cyan-600 dark:text-cyan-400" />Start Here</CardTitle>
                                <CardDescription>Run the cashier workspace in the same order frontline staff naturally think: shift first, lane second, payment third, receipt last.</CardDescription>
                            </div>
                            <Badge variant="outline">2026 cashier flow</Badge>
                        </div>
                    </CardHeader>
                    <CardContent class="space-y-4 pt-0">
                        <div class="grid gap-3 lg:grid-cols-4">
                            <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">1. Ready Counter</p>
                                <p class="mt-2 text-sm font-semibold">Check register and session</p>
                                <p class="mt-1 text-xs text-muted-foreground">A cashier session must be open before any POS lane can issue receipts.</p>
                                <div class="mt-3">
                                    <Button size="sm" variant="outline" @click="activeTab = 'sessions'">Open Sessions</Button>
                                </div>
                            </div>
                            <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">2. Choose Lane</p>
                                <p class="mt-2 text-sm font-semibold">Pick the right counter workflow</p>
                                <p class="mt-1 text-xs text-muted-foreground">OTC pharmacy, cafeteria, and retail are separate because they serve different operational rules.</p>
                            </div>
                            <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">3. Capture Sale</p>
                                <p class="mt-2 text-sm font-semibold">Build basket and take payment</p>
                                <p class="mt-1 text-xs text-muted-foreground">Each lane keeps basket building and payment capture in one place to reduce cashier backtracking.</p>
                            </div>
                            <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">4. Review History</p>
                                <p class="mt-2 text-sm font-semibold">Receipt, refund, and closeout</p>
                                <p class="mt-1 text-xs text-muted-foreground">Use POS sales history and session closeout when reconciling drawer activity or correcting mistakes.</p>
                            </div>
                        </div>
                        <div class="grid gap-3 lg:grid-cols-4">
                            <div class="rounded-lg border bg-background px-4 py-3 shadow-sm">
                                <div class="flex items-center justify-between gap-2">
                                    <div>
                                        <p class="text-sm font-semibold">OTC Pharmacy</p>
                                        <p class="mt-1 text-xs text-muted-foreground">Direct walk-in medicine counter only.</p>
                                    </div>
                                    <Badge :variant="canReadPharmacyOtc ? 'secondary' : 'outline'">{{ canReadPharmacyOtc ? 'Available' : 'Hidden' }}</Badge>
                                </div>
                                <p class="mt-3 text-xs text-muted-foreground">{{ readyRegisters.length }} open register{{ readyRegisters.length === 1 ? '' : 's' }} visible for checkout.</p>
                                <div class="mt-3">
                                    <Button size="sm" :disabled="!canReadPharmacyOtc" @click="activeTab = 'pharmacy-otc'">Open OTC Lane</Button>
                                </div>
                            </div>
                            <div class="rounded-lg border bg-background px-4 py-3 shadow-sm">
                                <div class="flex items-center justify-between gap-2">
                                    <div>
                                        <p class="text-sm font-semibold">Retail Desk</p>
                                        <p class="mt-1 text-xs text-muted-foreground">Parking, lost card, visitor and other miscellaneous sales.</p>
                                    </div>
                                    <Badge :variant="canCreateSales ? 'secondary' : 'outline'">{{ canCreateSales ? 'Available' : 'Hidden' }}</Badge>
                                </div>
                                <p class="mt-3 text-xs text-muted-foreground">Use when a charge does not belong to a clinical invoice workflow.</p>
                                <div class="mt-3">
                                    <Button size="sm" :disabled="!canCreateSales" @click="activeTab = 'general-retail'">Open Retail Desk</Button>
                                </div>
                            </div>
                            <div class="rounded-lg border bg-background px-4 py-3 shadow-sm">
                                <div class="flex items-center justify-between gap-2">
                                    <div>
                                        <p class="text-sm font-semibold">Cafeteria</p>
                                        <p class="mt-1 text-xs text-muted-foreground">Food and beverage tray checkout with menu control.</p>
                                    </div>
                                    <Badge :variant="canReadCafeteria ? 'secondary' : 'outline'">{{ canReadCafeteria ? 'Available' : 'Hidden' }}</Badge>
                                </div>
                                <p class="mt-3 text-xs text-muted-foreground">{{ cafeteriaCatalogItems.length }} menu item{{ cafeteriaCatalogItems.length === 1 ? '' : 's' }} currently loaded.</p>
                                <div class="mt-3">
                                    <Button size="sm" :disabled="!canReadCafeteria" @click="activeTab = 'cafeteria'">Open Cafeteria</Button>
                                </div>
                            </div>
                            <div class="rounded-lg border border-rose-200 bg-rose-50/70 px-4 py-3 shadow-sm dark:border-rose-900 dark:bg-rose-950/30">
                                <div class="flex items-center justify-between gap-2">
                                    <div>
                                        <p class="text-sm font-semibold">Clinical Billing</p>
                                        <p class="mt-1 text-xs text-muted-foreground">Lab, radiology, procedures, and prescribed orders do not settle here.</p>
                                    </div>
                                    <Badge variant="outline">Billing</Badge>
                                </div>
                                <p class="mt-3 text-xs text-muted-foreground">Send clinical services to Billing so invoices, payer logic, and financial reporting stay consistent.</p>
                                <div class="mt-3 flex flex-wrap gap-2">
                                    <Button as-child size="sm" variant="outline">
                                        <Link href="/billing-invoices">Open Billing</Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <CardTitle class="flex items-center gap-2 text-base"><AppIcon name="shield-check" class="size-5 text-rose-600 dark:text-rose-400" />Clinical Settlement Boundary</CardTitle>
                                <CardDescription>Keep clinical billing and retail cashier work separate so revenue, audit, and operational reporting stay clean.</CardDescription>
                            </div>
                            <Badge variant="outline">Billing first</Badge>
                        </div>
                    </CardHeader>
                    <CardContent class="space-y-4 pt-0">
                        <div class="grid gap-3 lg:grid-cols-2">
                            <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                <p class="text-sm font-semibold">Handled in Billing</p>
                                <p class="mt-1 text-sm text-muted-foreground">Laboratory, radiology, procedures, and prescribed pharmacy orders should continue through Billing Invoices and related financial workflows.</p>
                            </div>
                            <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                <p class="text-sm font-semibold">Handled in POS</p>
                                <p class="mt-1 text-sm text-muted-foreground">OTC pharmacy, cafeteria, and miscellaneous retail counter sales stay here under register, session, receipt, void, and refund controls.</p>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <Button as-child variant="outline">
                                <Link href="/billing-invoices">Open Billing Invoices</Link>
                            </Button>
                            <Button as-child variant="outline">
                                <Link href="/billing-cash">Open Billing Cash</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="operations" class="mt-0 space-y-4">
                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <CardTitle class="flex items-center gap-2 text-base"><AppIcon name="briefcase-business" class="size-5 text-sky-600 dark:text-sky-400" />Supervisor Operations</CardTitle>
                                <CardDescription>Use this area for register setup, sales search, receipt history, refunds, void review, and closeout investigation without crowding the cashier lane.</CardDescription>
                            </div>
                            <Badge variant="outline">Backoffice controls</Badge>
                        </div>
                    </CardHeader>
                    <CardContent class="pt-0">
                        <div class="grid gap-3 lg:grid-cols-3">
                            <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                <p class="text-sm font-semibold">Register administration</p>
                                <p class="mt-1 text-sm text-muted-foreground">Create, edit, activate, and monitor counter endpoints used by cashiers.</p>
                            </div>
                            <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                <p class="text-sm font-semibold">Sales investigation</p>
                                <p class="mt-1 text-sm text-muted-foreground">Search by sale, receipt, customer, channel, date, register, and cashier session.</p>
                            </div>
                            <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                <p class="text-sm font-semibold">Audit-safe controls</p>
                                <p class="mt-1 text-sm text-muted-foreground">Handle refunds and voids from a dedicated supervisor surface with receipt history still visible.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <div class="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <CardTitle class="flex items-center gap-2 text-base"><AppIcon name="shopping-cart" class="size-5 text-amber-600 dark:text-amber-400" />Register Administration</CardTitle>
                                <CardDescription>Register master data, live readiness, and browser-based counter administration for supervisors.</CardDescription>
                            </div>
                            <Badge variant="outline">{{ registerRows.length }} visible</Badge>
                        </div>
                    </CardHeader>
                    <CardContent class="space-y-4 pt-0">
                        <div class="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                            <div class="grid gap-2">
                                <Label for="register-search">Register Search</Label>
                                <Input id="register-search" v-model="registerSearch" placeholder="Search by code, name, or location" @keydown.enter.prevent="loadRegisters" />
                            </div>
                            <div class="grid gap-2">
                                <Label for="register-status-filter">Status</Label>
                                <Select v-model="registerStatusFilter">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All registers</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="flex items-end gap-2">
                                <Button variant="outline" @click="loadRegisters">Refresh Registers</Button>
                            </div>
                        </div>
                        <div v-if="canManageRegisters" class="rounded-lg border bg-muted/20 p-4">
                            <div class="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p class="text-sm font-semibold">{{ isEditingRegister ? 'Edit Register' : 'Create Register' }}</p>
                                    <p class="text-xs text-muted-foreground">Counter setup lives here so supervisors can onboard, relocate, or deactivate tills without code changes.</p>
                                </div>
                                <Button v-if="isEditingRegister" size="sm" variant="outline" @click="resetRegisterEditor">New Register</Button>
                            </div>
                            <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <div class="grid gap-2"><Label for="register-editor-code">Register Code</Label><Input id="register-editor-code" v-model="registerEditorCode" placeholder="POS-ER-01" /></div>
                                <div class="grid gap-2"><Label for="register-editor-name">Register Name</Label><Input id="register-editor-name" v-model="registerEditorName" placeholder="Emergency Counter" /></div>
                                <div class="grid gap-2"><Label for="register-editor-location">Location</Label><Input id="register-editor-location" v-model="registerEditorLocation" placeholder="Emergency, Pharmacy, Cafeteria" /></div>
                                <div class="grid gap-2"><Label for="register-editor-currency">Default Currency</Label><Input id="register-editor-currency" v-model="registerEditorCurrency" placeholder="TZS" /></div>
                                <div class="grid gap-2"><Label for="register-editor-status">Status</Label><Select v-model="registerEditorStatus"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
                                <div class="grid gap-2"><Label for="register-editor-status-reason">Status Reason</Label><Input id="register-editor-status-reason" v-model="registerEditorStatusReason" placeholder="Required when inactive" /></div>
                            </div>
                            <div class="mt-3 grid gap-2">
                                <Label for="register-editor-notes">Notes</Label>
                                <Textarea id="register-editor-notes" v-model="registerEditorNotes" rows="2" placeholder="Optional audit-safe note for this counter" />
                            </div>
                            <div v-if="registerError" class="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{{ registerError }}</div>
                            <div v-if="registerSuccess" class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{{ registerSuccess }}</div>
                            <div class="mt-4 flex flex-wrap gap-2">
                                <Button :disabled="registerSubmitting" @click="submitRegisterEditor">{{ registerSubmitting ? 'Saving Register...' : (isEditingRegister ? 'Update Register' : 'Create Register') }}</Button>
                                <Button variant="outline" :disabled="registerSubmitting" @click="resetRegisterEditor">Reset</Button>
                            </div>
                        </div>
                        <div v-if="loading" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Loading POS registers...</div>
                        <div v-else-if="registerRows.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No registers are configured yet. The backend foundation is live and ready for cashier setup.</div>
                        <div v-for="register in registerRows" v-else :key="register.id" class="rounded-lg border bg-background px-4 py-3 shadow-sm">
                            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <h3 class="text-sm font-semibold">{{ register.registerName || 'Unnamed Register' }}</h3>
                                        <Badge variant="outline">{{ register.registerCode || 'No Code' }}</Badge>
                                        <Badge :variant="register.currentOpenSession ? 'default' : 'secondary'">{{ register.currentOpenSession ? 'Session Open' : formatEnumLabel(register.status) }}</Badge>
                                    </div>
                                    <p class="text-sm text-muted-foreground">{{ register.location || 'Location pending' }}</p>
                                    <p v-if="register.statusReason" class="text-xs text-muted-foreground">{{ register.statusReason }}</p>
                                </div>
                                <div class="flex flex-col items-start gap-2 text-xs text-muted-foreground md:items-end">
                                    <div>Currency: {{ register.defaultCurrencyCode || 'TZS' }}</div>
                                    <div v-if="register.currentOpenSession">{{ register.currentOpenSession.sessionNumber }} opened {{ formatDateTime(register.currentOpenSession.openedAt) }}</div>
                                    <div v-else>Ready for next cashier session</div>
                                    <Button v-if="canManageRegisters" size="sm" variant="outline" @click="populateRegisterEditor(register)">Edit Register</Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <CardTitle class="flex items-center gap-2 text-base"><AppIcon name="receipt" class="size-5 text-sky-600 dark:text-sky-400" />Sales History & Controls</CardTitle>
                                <CardDescription>{{ salesSummaryLabel }}</CardDescription>
                            </div>
                            <Badge variant="outline">{{ salesTotal }} total</Badge>
                        </div>
                    </CardHeader>
                    <CardContent class="space-y-4 pt-0">
                        <div v-if="!canReadSales" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Sales search and receipt history stay hidden until `pos.sales.read` is granted.</div>
                        <template v-else>
                            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div class="grid gap-2"><Label for="sales-search">Search</Label><Input id="sales-search" v-model="salesSearch" placeholder="Sale, receipt, customer, reference" @keydown.enter.prevent="applySalesFilters" /></div>
                                <div class="grid gap-2"><Label for="sales-channel">Channel</Label><Select :model-value="salesChannelFilter || '__all__'" @update:model-value="salesChannelFilter = $event === '__all__' ? '' : String($event)"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All channels</SelectItem><SelectItem value="general_retail">General retail</SelectItem><SelectItem value="pharmacy_otc">Pharmacy OTC</SelectItem><SelectItem value="cafeteria">Cafeteria</SelectItem><SelectItem value="lab_quick">Legacy lab quick</SelectItem></SelectContent></Select></div>
                                <div class="grid gap-2"><Label for="sales-status">Status</Label><Select :model-value="salesStatusFilter || '__all__'" @update:model-value="salesStatusFilter = $event === '__all__' ? '' : String($event)"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All statuses</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="voided">Voided</SelectItem><SelectItem value="refunded">Refunded</SelectItem></SelectContent></Select></div>
                                <div class="grid gap-2"><Label for="sales-payment-method">Payment Method</Label><Select :model-value="salesPaymentMethodFilter || '__all__'" @update:model-value="salesPaymentMethodFilter = $event === '__all__' ? '' : String($event)"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All methods</SelectItem><SelectItem v-for="option in paymentMethods" :key="option.value" :value="option.value">{{ option.label }}</SelectItem></SelectContent></Select></div>
                                <div class="grid gap-2"><Label for="sales-register-filter">Register</Label><Select :model-value="salesRegisterFilter || '__all__'" @update:model-value="salesRegisterFilter = $event === '__all__' ? '' : String($event)"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All registers</SelectItem><SelectItem v-for="register in registerRows" :key="register.id" :value="register.id">{{ `${register.registerName || 'Register'} (${register.registerCode || 'No Code'})` }}</SelectItem></SelectContent></Select></div>
                                <div class="grid gap-2"><Label for="sales-date-from">Date From</Label><Input id="sales-date-from" v-model="salesDateFrom" type="date" /></div>
                                <div class="grid gap-2"><Label for="sales-date-to">Date To</Label><Input id="sales-date-to" v-model="salesDateTo" type="date" /></div>
                                <div class="grid gap-2"><Label for="sales-session-filter">Session Scope</Label><Input id="sales-session-filter" :model-value="salesSessionFilter" readonly placeholder="Set from Sessions tab or clear below" /></div>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <Button variant="outline" :disabled="salesLoading" @click="applySalesFilters">{{ salesLoading ? 'Loading...' : 'Apply Filters' }}</Button>
                                <Button variant="outline" :disabled="salesLoading" @click="clearSalesFilters">Clear Filters</Button>
                            </div>
                            <div v-if="salesLoading" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Loading filtered POS sales...</div>
                            <div v-else-if="salesRows.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No POS sales matched the current filters.</div>
                            <div v-for="sale in salesRows" v-else :key="sale.id" class="space-y-3 rounded-lg border bg-background px-4 py-3 shadow-sm">
                                <div class="grid gap-3 md:grid-cols-[1.1fr_0.7fr_0.8fr]">
                                    <div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="text-sm font-semibold">{{ sale.saleNumber || 'POS Sale' }}</p>
                                            <Badge variant="outline">{{ sale.receiptNumber || 'No Receipt' }}</Badge>
                                            <Badge variant="secondary">{{ formatEnumLabel(sale.saleChannel) }}</Badge>
                                            <Badge :variant="saleStatusVariant(sale.status)">{{ formatEnumLabel(sale.status) }}</Badge>
                                        </div>
                                        <p class="text-xs text-muted-foreground">{{ sale.register?.registerName || 'Register pending' }} / {{ formatDateTime(sale.soldAt) }}</p>
                                        <p class="text-xs text-muted-foreground">{{ formatEnumLabel(sale.customerType) }}<span v-if="sale.customerName"> / {{ sale.customerName }}</span></p>
                                        <p v-if="sale.session?.sessionNumber" class="text-xs text-muted-foreground">Original session: {{ sale.session.sessionNumber }}</p>
                                    </div>
                                    <div>
                                        <p class="font-medium">{{ formatCurrency(sale.totalAmount, sale.currencyCode || 'TZS') }}</p>
                                        <p class="text-xs text-muted-foreground">Change: {{ formatCurrency(sale.changeAmount, sale.currencyCode || 'TZS') }}</p>
                                        <p v-if="latestSaleAdjustment(sale)" class="text-xs text-muted-foreground">Last adjustment: {{ formatEnumLabel(latestSaleAdjustment(sale)?.adjustmentType) }}<span v-if="latestSaleAdjustment(sale)?.processedAt"> / {{ formatDateTime(latestSaleAdjustment(sale)?.processedAt) }}</span></p>
                                    </div>
                                    <div class="flex flex-col gap-2 md:items-end">
                                        <Badge>{{ sale.register?.registerCode || 'POS' }}</Badge>
                                        <div class="flex flex-wrap gap-2 md:justify-end">
                                            <Button as-child size="sm" variant="outline"><Link :href="saleReceiptHref(sale.id)">Receipt</Link></Button>
                                            <Button as-child size="sm" variant="outline"><a :href="saleReceiptPdfHref(sale.id)">PDF</a></Button>
                                        </div>
                                        <div v-if="canControlSale(sale)" class="flex flex-wrap gap-2 md:justify-end">
                                            <Button v-if="canVoidSales" size="sm" variant="outline" @click="openSaleAction(sale, 'void')">{{ selectedSaleActionId === sale.id && saleActionMode === 'void' ? 'Voiding' : 'Void Sale' }}</Button>
                                            <Button v-if="canRefundSales" size="sm" variant="outline" @click="openSaleAction(sale, 'refund')">{{ selectedSaleActionId === sale.id && saleActionMode === 'refund' ? 'Refunding' : 'Refund Sale' }}</Button>
                                        </div>
                                        <p v-else class="text-xs text-muted-foreground">{{ sale.status === 'completed' ? 'Receipt is available. Sale controls need extra permission.' : `Sale ${formatEnumLabel(sale.status)} with receipt preserved.` }}</p>
                                    </div>
                                </div>
                                <div v-if="selectedSaleActionId === sale.id" class="space-y-3 rounded-lg border bg-muted/20 p-4">
                                    <div class="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p class="text-sm font-semibold">{{ saleActionMode === 'void' ? 'Void Sale Control' : 'Refund Sale Control' }}</p>
                                            <p class="text-xs text-muted-foreground">{{ saleActionMode === 'void' ? 'Voids are limited to sales whose original cashier session is still open.' : 'Refunds return the full sale value through the selected open register session.' }}</p>
                                        </div>
                                        <div class="flex flex-wrap gap-2">
                                            <Badge variant="outline">{{ sale.saleNumber || 'POS Sale' }}</Badge>
                                            <Badge :variant="saleStatusVariant(sale.status)">{{ formatEnumLabel(sale.status) }}</Badge>
                                        </div>
                                    </div>
                                    <div class="grid gap-3 md:grid-cols-2">
                                        <div class="grid gap-2">
                                            <Label for="sale-action-reason">Reason Code</Label>
                                            <Select v-model="saleActionReasonCode"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="reason in adjustmentReasonOptions" :key="reason.value" :value="reason.value">{{ reason.label }}</SelectItem></SelectContent></Select>
                                        </div>
                                        <div v-if="saleActionMode === 'refund'" class="grid gap-2">
                                            <Label for="sale-action-register">Refund Register</Label>
                                            <Select v-model="saleActionRegisterId"><SelectTrigger><SelectValue placeholder="Select open register" /></SelectTrigger><SelectContent><SelectItem v-for="register in readyRegisters" :key="register.id" :value="register.id">{{ `${register.registerName || 'Register'} (${register.registerCode || 'No Code'})` }}</SelectItem></SelectContent></Select>
                                        </div>
                                        <div v-if="saleActionMode === 'refund'" class="grid gap-2">
                                            <Label for="sale-action-method">Refund Method</Label>
                                            <Select v-model="saleActionRefundMethod"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="option in paymentMethods" :key="option.value" :value="option.value">{{ option.label }}</SelectItem></SelectContent></Select>
                                        </div>
                                        <div v-if="saleActionMode === 'refund'" class="grid gap-2">
                                            <Label for="sale-action-reference">Refund Reference</Label>
                                            <Input id="sale-action-reference" v-model="saleActionReference" placeholder="Optional bank, card, or wallet reference" />
                                        </div>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="sale-action-note">Control Note</Label>
                                        <Textarea id="sale-action-note" v-model="saleActionNote" rows="2" placeholder="Short audit-safe explanation for this void or refund" />
                                    </div>
                                    <div class="rounded-lg border bg-background px-4 py-3 text-sm">
                                        <div class="flex flex-wrap items-center justify-between gap-2">
                                            <p class="font-medium">Adjustment amount</p>
                                            <p class="text-base font-semibold">{{ formatCurrency(sale.totalAmount, sale.currencyCode || 'TZS') }}</p>
                                        </div>
                                        <p class="mt-1 text-xs text-muted-foreground">{{ saleActionMode === 'void' ? 'Voiding preserves the original sale and records an audited reversal against the same session.' : 'Refunding records a payout against the selected live register session and updates stock for pharmacy OTC items.' }}</p>
                                    </div>
                                    <div v-if="saleActionError" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{{ saleActionError }}</div>
                                    <div v-if="saleActionSuccess" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{{ saleActionSuccess }}</div>
                                    <div class="flex flex-wrap gap-2">
                                        <Button :disabled="saleActionSubmitting" @click="submitSaleAction">{{ saleActionSubmitting ? 'Processing...' : (saleActionMode === 'void' ? 'Confirm Void' : 'Confirm Refund') }}</Button>
                                        <Button variant="outline" :disabled="saleActionSubmitting" @click="resetSaleAction">Cancel</Button>
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                                <p class="text-muted-foreground">Page {{ salesPage }} of {{ salesLastPage }}</p>
                                <div class="flex gap-2">
                                    <Button size="sm" variant="outline" :disabled="salesPage <= 1 || salesLoading" @click="goToSalesPage(salesPage - 1)">Previous</Button>
                                    <Button size="sm" variant="outline" :disabled="salesPage >= salesLastPage || salesLoading" @click="goToSalesPage(salesPage + 1)">Next</Button>
                                </div>
                            </div>
                        </template>
                    </CardContent>
                </Card>
                </div>
            </TabsContent>
            </Tabs>
        </div>
    </AppLayout>
</template>
