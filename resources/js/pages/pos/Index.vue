<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import OrdersWorkspacePageHeader from '@/components/orders/OrdersWorkspacePageHeader.vue';
import PosCheckoutSection from '@/components/pos/PosCheckoutSection.vue';
import PosFilterBar from '@/components/pos/PosFilterBar.vue';
import PosFilterField from '@/components/pos/PosFilterField.vue';
import PosFormGrid from '@/components/pos/PosFormGrid.vue';
import PosKpiStrip from '@/components/pos/PosKpiStrip.vue';
import PosLaneWorkspace from '@/components/pos/PosLaneWorkspace.vue';
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
import { type AppIconName } from '@/lib/icons';
import { type BreadcrumbItem } from '@/types';

type PosTab =
    | 'overview'
    | 'sessions'
    | 'pharmacy-otc'
    | 'cafeteria'
    | 'general-retail'
    | 'lab-quick'
    | 'operations';

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
    inventoryItemId: string | null;
    unitId: string | null;
    unit: string | null;
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
const posWorkspaceIntro = computed(() => {
    if (totalRegisters.value === 0) {
        return 'Configure registers and open a cashier session before taking counter payments.';
    }
    if (totalOpenSessions.value === 0) {
        return 'Open a cashier session, then choose OTC, cafeteria, retail, or lab quick settlement.';
    }
    return 'Counter sales for OTC pharmacy, cafeteria, miscellaneous retail, and lab quick settlement.';
});
const posQuickLanes = computed(() => {
    const lanes: Array<{
        tab: PosTab;
        label: string;
        icon: AppIconName;
        visible: boolean;
        badge: string | null;
        emphasis: boolean;
    }> = [
        {
            tab: 'sessions',
            label: 'Sessions',
            icon: 'clock-3',
            visible: canReadSessions.value || canManageSessions.value,
            badge: totalOpenSessions.value > 0 ? String(totalOpenSessions.value) : null,
            emphasis: totalRegisters.value > 0 && totalOpenSessions.value === 0,
        },
        {
            tab: 'pharmacy-otc',
            label: 'OTC',
            icon: 'pill',
            visible: canReadPharmacyOtc.value,
            badge: basketItems.value.length > 0 ? String(basketItems.value.length) : null,
            emphasis: false,
        },
        {
            tab: 'cafeteria',
            label: 'Cafeteria',
            icon: 'shopping-cart',
            visible: canReadCafeteria.value,
            badge: cafeteriaBasketItems.value.length > 0 ? String(cafeteriaBasketItems.value.length) : null,
            emphasis: false,
        },
        {
            tab: 'general-retail',
            label: 'Retail',
            icon: 'scan-line',
            visible: canCreateSales.value,
            badge: retailLineItems.value.length > 0 ? String(retailLineItems.value.length) : null,
            emphasis: false,
        },
        {
            tab: 'lab-quick',
            label: 'Lab payment',
            icon: 'flask-conical',
            visible: canReadLabQuick.value,
            badge: labQuickBasketItems.value.length > 0 ? String(labQuickBasketItems.value.length) : null,
            emphasis: false,
        },
        {
            tab: 'operations',
            label: 'History',
            icon: 'briefcase-business',
            visible: canReadSales.value || canVoidSales.value || canRefundSales.value,
            badge: null,
            emphasis: false,
        },
    ];

    return lanes.filter((lane) => lane.visible);
});
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
const labQuickBasketPatientId = computed(() => labQuickBasketItems.value[0]?.patientId ?? null);
const labQuickFilteredCandidates = computed(() => {
    const lockedPatientId = labQuickBasketPatientId.value;
    if (!lockedPatientId) return labQuickCandidates.value;
    return labQuickCandidates.value.filter((candidate) => candidate.patientId === lockedPatientId);
});
const labQuickPaymentBalance = computed(() =>
    roundMoney(labQuickBasketTotal.value - labQuickPaymentTotal.value));
const labQuickRegisterLabel = computed(() => {
    const register = labQuickReadyRegisters.value.find((row) => row.id === selectedLabRegisterId.value);
    if (!register) return 'Choose a register with an open session';
    return [register.registerName, register.registerCode].filter(Boolean).join(' · ');
});
function labQuickOrderInBasket(orderId: string): boolean {
    return labQuickBasketItems.value.some((item) => item.orderId === orderId);
}
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
function addLabQuickOrder(candidate: LabQuickCandidate, noteOverride?: string | null): boolean {
    clearLabQuickMessages();
    if (!candidate.patientId) {
        labQuickError.value = 'This order is not linked to a patient and cannot be paid here.';
        return false;
    }
    if (labQuickOrderInBasket(candidate.id)) {
        labQuickError.value = 'This order is already in the basket.';
        return false;
    }
    if (labQuickBasketPatientId.value && labQuickBasketPatientId.value !== candidate.patientId) {
        labQuickError.value = 'Clear the basket or finish checkout before paying for a different patient.';
        return false;
    }
    const lineTotal = Number(candidate.lineTotal ?? candidate.unitPrice ?? 0);
    if (!Number.isFinite(lineTotal) || lineTotal <= 0) {
        labQuickError.value = 'This order has no payable amount for the selected register.';
        return false;
    }

    const note = noteOverride !== undefined ? noteOverride : labQuickLineNote.value.trim() || null;
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
        note,
    }];
    labQuickLineNote.value = '';
    selectedLabOrderId.value = '';
    return true;
}
function addLabQuickToBasket(): void {
    const candidate = selectedLabCandidate.value;
    if (!candidate) {
        labQuickError.value = 'Select an order from the list, or use Add on the order row.';
        return;
    }
    addLabQuickOrder(candidate);
}
function addLabQuickOrderFromList(candidate: LabQuickCandidate): void {
    selectedLabOrderId.value = candidate.id;
    addLabQuickOrder(candidate);
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
        <div class="flex flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <OrdersWorkspacePageHeader
                title="POS Operations"
                icon="scan-line"
                :intro="posWorkspaceIntro"
                :list-loading="loading"
                @refresh="refreshPage"
            >
                <template #actions>
                    <Badge variant="outline">{{ readinessLabel }}</Badge>
                </template>
            </OrdersWorkspacePageHeader>

            <div
                v-if="errorMessage"
                class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
                {{ errorMessage }}
            </div>

            <div
                v-if="posQuickLanes.length > 0"
                class="rounded-lg border bg-muted/30 px-3 py-2.5"
            >
                <div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                    <div class="flex flex-wrap items-center gap-2">
                        <Button
                            v-for="lane in posQuickLanes"
                            :key="lane.tab"
                            size="sm"
                            class="h-8 gap-1.5"
                            :variant="activeTab === lane.tab ? 'default' : lane.emphasis ? 'default' : 'outline'"
                            @click="activeTab = lane.tab"
                        >
                            <AppIcon :name="lane.icon" class="size-3.5" />
                            {{ lane.label }}
                            <Badge
                                v-if="lane.badge"
                                class="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[10px]"
                                :class="lane.tab === 'sessions' ? 'bg-emerald-600 text-white dark:bg-emerald-500' : ''"
                            >
                                {{ lane.badge }}
                            </Badge>
                        </Button>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 text-sm">
                        <div class="rounded-md border border-border/70 bg-background px-2.5 py-1.5 shadow-sm">
                            <span class="text-[11px] uppercase tracking-wide text-muted-foreground">Registers</span>
                            <span class="ml-2 font-semibold tabular-nums">{{ totalRegisters }}</span>
                        </div>
                        <div class="rounded-md border border-border/70 bg-background px-2.5 py-1.5 shadow-sm">
                            <span class="text-[11px] uppercase tracking-wide text-muted-foreground">Open</span>
                            <span class="ml-2 font-semibold tabular-nums">{{ totalOpenSessions }}</span>
                        </div>
                        <div class="rounded-md border border-border/70 bg-background px-2.5 py-1.5 shadow-sm">
                            <span class="text-[11px] uppercase tracking-wide text-muted-foreground">Recent gross</span>
                            <span class="ml-2 font-semibold tabular-nums">{{ formatCurrency(recentGrossAmount, recentSales[0]?.currencyCode ?? 'TZS') }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div
                v-if="totalRegisters > 0 && totalOpenSessions === 0 && (canReadSessions || canManageSessions)"
                class="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between"
            >
                <p class="text-amber-900 dark:text-amber-100">
                    No open cashier session. Open a session before OTC, cafeteria, retail, or lab quick lanes can issue receipts.
                </p>
                <Button size="sm" class="shrink-0" @click="activeTab = 'sessions'">Open session</Button>
            </div>

            <Tabs v-model="activeTab" class="flex flex-col gap-4">
            <TabsList class="grid h-auto w-full gap-1 [grid-template-columns:repeat(auto-fit,minmax(min(100%,8.5rem),1fr))]">
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
                <TabsTrigger
                    v-if="canReadLabQuick"
                    value="lab-quick"
                    class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"
                >
                    <AppIcon name="flask-conical" class="size-3.5" />
                    Lab payment
                    <Badge v-if="labQuickBasketItems.length > 0" class="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[10px]">{{ labQuickBasketItems.length }}</Badge>
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

            <TabsContent value="lab-quick" class="mt-0">
                <Card class="border-sidebar-border/70 rounded-lg">
                    <CardHeader class="pb-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <CardTitle class="flex items-center gap-2 text-base">
                                    <AppIcon name="flask-conical" class="size-5 text-cyan-600 dark:text-cyan-400" />
                                    Lab counter payment
                                </CardTitle>
                                <CardDescription>
                                    Collect payment for laboratory orders at the counter. Add one or more tests for the same patient, then take payment and print the receipt.
                                </CardDescription>
                            </div>
                            <div v-if="labQuickBasketItems.length > 0" class="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">{{ formatCurrency(labQuickBasketTotal, labQuickSelectedCurrency) }} due</Badge>
                                <Badge variant="outline">{{ labQuickBasketItems.length }} test{{ labQuickBasketItems.length === 1 ? '' : 's' }}</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="space-y-4 pt-0">
                        <div v-if="!canReadLabQuick" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            You do not have access to lab counter payment. Ask a supervisor for the lab quick cashier permission.
                        </div>
                        <template v-else>
                            <ol class="grid gap-2 text-sm sm:grid-cols-3">
                                <li class="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                                    <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-semibold text-white">1</span>
                                    <span><span class="font-medium">Find orders</span> — search by patient name, order number, or test.</span>
                                </li>
                                <li class="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                                    <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-semibold text-white">2</span>
                                    <span><span class="font-medium">Add to basket</span> — same patient only; use Add on each test.</span>
                                </li>
                                <li class="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                                    <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-semibold text-white">3</span>
                                    <span><span class="font-medium">Take payment</span> — enter amount and record sale for a receipt.</span>
                                </li>
                            </ol>

                            <div
                                v-if="labQuickBasketPatientId"
                                class="flex flex-col gap-2 rounded-lg border border-cyan-200 bg-cyan-50/80 px-4 py-3 text-sm dark:border-cyan-900 dark:bg-cyan-950/40 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div>
                                    <p class="font-medium text-cyan-950 dark:text-cyan-100">Paying for: {{ labQuickBasketPatientLabel }}</p>
                                    <p class="text-xs text-cyan-800 dark:text-cyan-200">Only more tests for this patient can be added. Clear the basket to switch patients.</p>
                                </div>
                                <Button size="sm" variant="outline" class="shrink-0 border-cyan-300 bg-background" @click="resetLabQuickCheckout">Change patient</Button>
                            </div>

                            <PosFilterBar>
                                <PosFilterField :xl-span="4">
                                    <Label for="lab-quick-register">Your register</Label>
                                    <Select v-model="selectedLabRegisterId">
                                        <SelectTrigger><SelectValue placeholder="Select register" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="register in labQuickReadyRegisters" :key="register.id" :value="register.id">{{ `${register.registerName || 'Register'} (${register.registerCode || 'No Code'})` }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p v-if="!selectedLabRegisterId" class="text-xs text-amber-700 dark:text-amber-300">Open a cashier session first (Sessions tab).</p>
                                </PosFilterField>
                                <PosFilterField :xl-span="5">
                                    <Label for="lab-quick-search">Find patient or order</Label>
                                    <Input id="lab-quick-search" v-model="labQuickSearch" placeholder="Patient name, order #, test name" @keydown.enter.prevent="loadLabQuickCandidates(true)" />
                                </PosFilterField>
                                <PosFilterField :xl-span="3">
                                    <Label for="lab-quick-status">Order status</Label>
                                    <Select v-model="labQuickStatusFilter">
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Any payable status</SelectItem>
                                            <SelectItem value="ordered">Ordered</SelectItem>
                                            <SelectItem value="collected">Collected</SelectItem>
                                            <SelectItem value="in_progress">In progress</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </PosFilterField>
                                <PosFilterField :xl-span="12">
                                    <Button variant="outline" size="sm" :disabled="labQuickLoading" @click="loadLabQuickCandidates(true)">{{ labQuickLoading ? 'Searching…' : 'Search orders' }}</Button>
                                    <span class="ml-2 text-xs text-muted-foreground">{{ labQuickFilteredCandidates.length }} order{{ labQuickFilteredCandidates.length === 1 ? '' : 's' }} shown</span>
                                </PosFilterField>
                            </PosFilterBar>

                            <PosLaneWorkspace>
                                <template #catalog>
                                    <PosCheckoutSection
                                        :title="labQuickBasketPatientId ? 'More tests for this patient' : 'Orders waiting for payment'"
                                        :description="labQuickBasketPatientId ? 'Already invoiced or paid orders are hidden.' : 'Tap Add to put a test in the basket. One patient per checkout.'"
                                    >
                                        <div class="max-h-[min(28rem,50vh)] space-y-2 overflow-y-auto pr-1">
                                            <div v-if="labQuickLoading" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Loading orders…</div>
                                            <div v-else-if="labQuickFilteredCandidates.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                                {{ labQuickCandidates.length === 0 ? 'No unpaid lab orders match your search. Try another name or order number.' : 'No other orders for this patient in the current search.' }}
                                            </div>
                                            <div
                                                v-for="candidate in labQuickFilteredCandidates"
                                                v-else
                                                :key="candidate.id"
                                                class="flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                                                :class="selectedLabOrderId === candidate.id ? 'border-cyan-300 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/30' : 'bg-background'"
                                            >
                                                <button
                                                    type="button"
                                                    class="min-w-0 flex-1 text-left"
                                                    @click="selectedLabOrderId = candidate.id"
                                                >
                                                    <div class="flex flex-wrap items-center gap-1.5">
                                                        <p class="text-sm font-semibold">{{ candidate.serviceName || candidate.testName || 'Lab test' }}</p>
                                                        <Badge variant="outline" class="text-[10px]">{{ formatEnumLabel(candidate.sourceStatus) }}</Badge>
                                                        <Badge v-if="labQuickOrderInBasket(candidate.id)" variant="secondary" class="text-[10px]">In basket</Badge>
                                                    </div>
                                                    <p class="mt-0.5 text-xs text-muted-foreground">
                                                        {{ [candidate.patientName, candidate.patientNumber, candidate.orderNumber].filter(Boolean).join(' · ') }}
                                                    </p>
                                                    <p class="text-sm font-medium">{{ formatCurrency(candidate.lineTotal, candidate.currencyCode || labQuickSelectedCurrency) }}</p>
                                                </button>
                                                <Button
                                                    size="sm"
                                                    class="shrink-0"
                                                    :variant="labQuickOrderInBasket(candidate.id) ? 'outline' : 'default'"
                                                    :disabled="labQuickOrderInBasket(candidate.id)"
                                                    @click="addLabQuickOrderFromList(candidate)"
                                                >
                                                    {{ labQuickOrderInBasket(candidate.id) ? 'Added' : 'Add' }}
                                                </Button>
                                            </div>
                                        </div>
                                    </PosCheckoutSection>
                                </template>
                                <template #checkout>
                                    <PosCheckoutSection
                                        title="Checkout"
                                        :description="labQuickRegisterLabel"
                                    >
                                        <div v-if="labQuickBasketItems.length === 0" class="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                                            <p class="font-medium text-foreground">Basket is empty</p>
                                            <p class="mt-1">Use <span class="font-medium">Add</span> on the left for each lab test you are collecting payment for.</p>
                                        </div>
                                        <template v-else>
                                            <ul class="space-y-2">
                                                <li
                                                    v-for="item in labQuickBasketItems"
                                                    :key="item.clientId"
                                                    class="flex items-start justify-between gap-2 rounded-lg border bg-background px-3 py-2"
                                                >
                                                    <div class="min-w-0">
                                                        <p class="text-sm font-semibold">{{ item.serviceName || 'Lab test' }}</p>
                                                        <p class="text-xs text-muted-foreground">{{ item.orderNumber }}</p>
                                                        <p class="text-sm tabular-nums">{{ formatCurrency(item.lineTotal, labQuickSelectedCurrency) }}</p>
                                                    </div>
                                                    <Button size="sm" variant="ghost" @click="removeLabQuickBasketItem(item.clientId)">Remove</Button>
                                                </li>
                                            </ul>
                                            <div class="border-t pt-3">
                                                <div class="flex items-center justify-between text-sm">
                                                    <span class="text-muted-foreground">Amount due</span>
                                                    <span class="text-lg font-semibold tabular-nums">{{ formatCurrency(labQuickBasketTotal, labQuickSelectedCurrency) }}</span>
                                                </div>
                                            </div>
                                        </template>
                                    </PosCheckoutSection>

                                    <PosCheckoutSection
                                        v-if="labQuickBasketItems.length > 0"
                                        title="Payment"
                                        description="Cash may be more than the total for change."
                                    >
                                        <template #actions>
                                            <Button size="sm" variant="outline" @click="addLabQuickPaymentEntry">Split payment</Button>
                                        </template>
                                        <div v-for="entry in labQuickPayments" :key="entry.clientId" class="rounded-lg border bg-background p-3">
                                            <PosFormGrid>
                                                <div class="grid gap-2">
                                                    <Label>Payment method</Label>
                                                    <Select v-model="entry.paymentMethod">
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem v-for="option in paymentMethods" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label>{{ entry.paymentMethod === 'cash' ? 'Cash tendered' : 'Amount' }}</Label>
                                                    <Input v-model="entry.amount" inputmode="decimal" placeholder="0.00" />
                                                </div>
                                            </PosFormGrid>
                                            <Button
                                                v-if="labQuickPayments.length > 1"
                                                size="sm"
                                                variant="ghost"
                                                class="mt-1"
                                                @click="removeLabQuickPaymentEntry(entry.clientId)"
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="lab-quick-note">Receipt note (optional)</Label>
                                            <Textarea id="lab-quick-note" v-model="labQuickCheckoutNote" rows="2" placeholder="e.g. sample collection desk" />
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                                            <div class="flex justify-between gap-2">
                                                <span class="text-muted-foreground">Entered</span>
                                                <span class="font-medium tabular-nums">{{ formatCurrency(labQuickPaymentTotal, labQuickSelectedCurrency) }}</span>
                                            </div>
                                            <div v-if="labQuickPaymentBalance > 0" class="mt-1 flex justify-between gap-2 text-amber-800 dark:text-amber-200">
                                                <span>Still owed</span>
                                                <span class="font-medium tabular-nums">{{ formatCurrency(labQuickPaymentBalance, labQuickSelectedCurrency) }}</span>
                                            </div>
                                            <div v-else-if="labQuickPaymentBalance < 0" class="mt-1 flex justify-between gap-2 text-emerald-800 dark:text-emerald-200">
                                                <span>Change</span>
                                                <span class="font-medium tabular-nums">{{ formatCurrency(Math.abs(labQuickPaymentBalance), labQuickSelectedCurrency) }}</span>
                                            </div>
                                        </div>
                                    </PosCheckoutSection>

                                    <div v-if="labQuickError" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{{ labQuickError }}</div>
                                    <div v-if="labQuickSuccess" class="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100">
                                        <p>{{ labQuickSuccess }}</p>
                                        <div v-if="labQuickLatestSaleId" class="mt-2 flex flex-wrap gap-2">
                                            <Button as-child size="sm" variant="outline">
                                                <Link :href="saleReceiptHref(labQuickLatestSaleId)" class="inline-flex items-center gap-1.5">
                                                    <AppIcon name="receipt" class="size-3.5" />
                                                    View receipt
                                                </Link>
                                            </Button>
                                            <Button as-child size="sm" variant="outline">
                                                <a :href="saleReceiptPdfHref(labQuickLatestSaleId)" class="inline-flex items-center gap-1.5">
                                                    <AppIcon name="printer" class="size-3.5" />
                                                    Print PDF
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Button
                                            class="flex-1 sm:flex-none"
                                            :disabled="labQuickSubmitting || labQuickBasketItems.length === 0 || !selectedLabRegisterId"
                                            @click="submitLabQuickSale"
                                        >
                                            {{ labQuickSubmitting ? 'Processing…' : 'Complete payment' }}
                                        </Button>
                                        <Button variant="outline" :disabled="labQuickBasketItems.length === 0" @click="resetLabQuickCheckout">Clear basket</Button>
                                    </div>
                                </template>
                            </PosLaneWorkspace>
                        </template>
                    </CardContent>
                </Card>
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
                            <p class="rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                                Direct OTC counter sales only — prescribed medicines stay in clinical workflow and Billing.
                            </p>
                            <PosFilterBar>
                                <PosFilterField :xl-span="4">
                                    <Label for="otc-register">Checkout register</Label>
                                    <Select v-model="selectedRegisterId">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Register with open session" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="register in otcReadyRegisters" :key="register.id" :value="register.id">{{ `${register.registerName || 'Register'} (${register.registerCode || 'No Code'})` }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </PosFilterField>
                                <PosFilterField :xl-span="8">
                                    <Label for="otc-search">Medicine search</Label>
                                    <div class="flex gap-2">
                                        <Input id="otc-search" v-model="otcSearch" class="min-w-0 flex-1" placeholder="Name, code, or category" @keydown.enter.prevent="loadOtcCatalog(true)" />
                                        <Button variant="outline" class="shrink-0" :disabled="otcLoading" @click="loadOtcCatalog(true)">{{ otcLoading ? 'Loading…' : 'Search' }}</Button>
                                    </div>
                                </PosFilterField>
                            </PosFilterBar>
                            <PosLaneWorkspace>
                                <template #catalog>
                                <PosCheckoutSection title="Approved medicines" description="Select a line, set quantity and price, then add to basket.">
                                <div class="max-h-[min(28rem,50vh)] space-y-3 overflow-y-auto pr-1">
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
                                </PosCheckoutSection>
                                </template>
                                <template #checkout>
                                    <PosCheckoutSection title="Add line" :description="selectedCatalogItem?.name || 'Select a medicine from the list'">
                                        <PosFormGrid>
                                            <div class="grid gap-2">
                                                <Label for="otc-quantity">Quantity</Label>
                                                <Input id="otc-quantity" v-model="otcQuantity" inputmode="decimal" placeholder="1" :disabled="!selectedCatalogItem" />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="otc-unit-price">Unit price</Label>
                                                <Input id="otc-unit-price" v-model="otcUnitPrice" inputmode="decimal" placeholder="Price" :disabled="!selectedCatalogItem" />
                                            </div>
                                            <div class="grid gap-2 sm:col-span-2">
                                                <Label for="otc-line-note">Line note</Label>
                                                <Textarea id="otc-line-note" v-model="otcLineNote" rows="2" placeholder="Optional" :disabled="!selectedCatalogItem" />
                                            </div>
                                        </PosFormGrid>
                                        <p v-if="selectedCatalogItem" class="text-xs text-muted-foreground">{{ selectedRemainingStock }} remaining after basket quantities.</p>
                                        <div class="flex flex-wrap gap-2">
                                            <Button :disabled="!selectedCatalogItem" @click="addToBasket">Add to basket</Button>
                                            <Button variant="outline" :disabled="!selectedCatalogItemId" @click="selectedCatalogItemId = ''">Clear</Button>
                                        </div>
                                    </PosCheckoutSection>
                                    <PosCheckoutSection title="Basket">
                                        <template #actions>
                                            <Badge variant="outline">{{ basketItems.length }} lines</Badge>
                                        </template>
                                        <div v-if="basketItems.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Basket is empty.</div>
                                        <div v-for="item in basketItems" v-else :key="item.clientId" class="flex items-start justify-between gap-3 rounded-lg border bg-background px-3 py-2">
                                            <div class="min-w-0">
                                                <p class="text-sm font-semibold">{{ item.name || 'Item' }}</p>
                                                <p class="text-xs text-muted-foreground">Qty {{ item.quantity }} × {{ formatCurrency(item.unitPrice, otcSelectedCurrency) }}</p>
                                            </div>
                                            <div class="flex shrink-0 items-center gap-2">
                                                <p class="text-sm font-medium">{{ formatCurrency(item.quantity * item.unitPrice, otcSelectedCurrency) }}</p>
                                                <Button size="sm" variant="outline" @click="removeBasketItem(item.clientId)">Remove</Button>
                                            </div>
                                        </div>
                                    </PosCheckoutSection>
                                    <PosCheckoutSection title="Customer">
                                        <div class="grid gap-2">
                                            <Label for="otc-customer-mode">Checkout mode</Label>
                                            <Select v-model="otcCustomerMode">
                                                <SelectTrigger id="otc-customer-mode"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="walk_in">Walk-in</SelectItem>
                                                    <SelectItem value="patient">Existing patient</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <PosFormGrid v-if="otcCustomerMode === 'patient'" class="mt-4">
                                            <div class="sm:col-span-2">
                                                <PatientLookupField input-id="otc-patient-id" v-model="otcPatientId" label="Patient" helper-text="Links sale to chart." />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="otc-customer-reference">Reference</Label>
                                                <Input id="otc-customer-reference" v-model="checkoutCustomerReference" placeholder="Phone or pickup note" />
                                            </div>
                                        </PosFormGrid>
                                        <PosFormGrid v-else class="mt-4">
                                            <div class="grid gap-2">
                                                <Label for="otc-customer-name">Name</Label>
                                                <Input id="otc-customer-name" v-model="checkoutCustomerName" placeholder="Walk-in name" />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="otc-customer-reference-walkin">Reference</Label>
                                                <Input id="otc-customer-reference-walkin" v-model="checkoutCustomerReference" placeholder="Phone or counter ref" />
                                            </div>
                                        </PosFormGrid>
                                    </PosCheckoutSection>
                                    <PosCheckoutSection title="Payment">
                                        <template #actions>
                                            <Button size="sm" variant="outline" @click="addOtcPaymentEntry">Add payment</Button>
                                        </template>
                                        <div v-for="entry in otcPayments" :key="entry.clientId" class="rounded-lg border bg-background p-3">
                                            <PosFormGrid>
                                                <div class="grid gap-2">
                                                    <Label>Method</Label>
                                                    <Select v-model="entry.paymentMethod"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="option in paymentMethods" :key="option.value" :value="option.value">{{ option.label }}</SelectItem></SelectContent></Select>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label>{{ entry.paymentMethod === 'cash' ? 'Tendered' : 'Amount' }}</Label>
                                                    <Input v-model="entry.amount" inputmode="decimal" placeholder="0.00" />
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label>Reference</Label>
                                                    <Input v-model="entry.paymentReference" placeholder="Card / wallet ref" />
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label>Note</Label>
                                                    <Input v-model="entry.note" placeholder="Optional" />
                                                </div>
                                            </PosFormGrid>
                                            <div class="mt-2 flex justify-end">
                                                <Button size="sm" variant="ghost" @click="removeOtcPaymentEntry(entry.clientId)">Remove</Button>
                                            </div>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="otc-note">Checkout note</Label>
                                            <Textarea id="otc-note" v-model="checkoutNote" rows="2" placeholder="Optional" />
                                        </div>
                                    </PosCheckoutSection>
                                    <div class="rounded-lg border bg-muted/20 p-4">
                                        <PosFormGrid columns="2">
                                            <div>
                                                <p class="text-xs text-muted-foreground">Basket total</p>
                                                <p class="text-lg font-semibold">{{ formatCurrency(basketTotal, otcSelectedCurrency) }}</p>
                                            </div>
                                            <div>
                                                <p class="text-xs text-muted-foreground">Payments</p>
                                                <p class="text-lg font-semibold">{{ formatCurrency(otcPaymentTotal, otcSelectedCurrency) }}</p>
                                            </div>
                                        </PosFormGrid>
                                    </div>
                                    <div v-if="otcError" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{{ otcError }}</div>
                                    <div v-if="otcSuccess" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                                        <p>{{ otcSuccess }}</p>
                                        <div v-if="otcLatestSaleId" class="mt-2 flex flex-wrap gap-2">
                                            <Button as-child size="sm" variant="outline">
                                                <Link :href="saleReceiptHref(otcLatestSaleId)" class="inline-flex items-center gap-1.5">
                                                    <AppIcon name="receipt" class="size-3.5" />
                                                    Receipt
                                                </Link>
                                            </Button>
                                            <Button as-child size="sm" variant="outline">
                                                <a :href="saleReceiptPdfHref(otcLatestSaleId)" class="inline-flex items-center gap-1.5">
                                                    <AppIcon name="printer" class="size-3.5" />
                                                    PDF
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Button class="flex-1 sm:flex-none" :disabled="otcSubmitting || basketItems.length === 0 || !selectedRegisterId" @click="submitOtcSale">{{ otcSubmitting ? 'Recording…' : 'Record sale' }}</Button>
                                        <Button variant="outline" :disabled="basketItems.length === 0" @click="resetCheckout">Clear basket</Button>
                                    </div>
                                </template>
                            </PosLaneWorkspace>
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
                            <p class="rounded-lg border border-violet-200 bg-violet-50/70 px-4 py-2.5 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
                                Miscellaneous counter charges only — not clinical invoices.
                            </p>
                            <PosFilterBar>
                                <PosFilterField :xl-span="4">
                                    <Label for="retail-register">Register</Label>
                                    <Select v-model="selectedRetailRegisterId">
                                        <SelectTrigger><SelectValue placeholder="Open session" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="register in retailReadyRegisters" :key="register.id" :value="register.id">{{ `${register.registerName || 'Register'} (${register.registerCode || 'No Code'})` }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </PosFilterField>
                                <PosFilterField :xl-span="4">
                                    <Label for="retail-customer-type">Customer type</Label>
                                    <Select v-model="retailCustomerType">
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="anonymous">Anonymous</SelectItem>
                                            <SelectItem value="staff">Staff</SelectItem>
                                            <SelectItem value="visitor">Visitor</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </PosFilterField>
                                <PosFilterField :xl-span="4">
                                    <Label for="retail-customer-name">Customer name</Label>
                                    <Input id="retail-customer-name" v-model="retailCustomerName" placeholder="Optional" />
                                </PosFilterField>
                            </PosFilterBar>
                            <PosLaneWorkspace>
                                <template #catalog>
                                    <PosCheckoutSection title="New line" description="Add items to the basket before payment.">
                                        <PosFormGrid>
                                            <div class="grid gap-2 sm:col-span-2">
                                                <Label for="retail-item-name">Item name</Label>
                                                <Input id="retail-item-name" v-model="retailDraftItemName" placeholder="Parking, lost card, snack" />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="retail-item-code">Code</Label>
                                                <Input id="retail-item-code" v-model="retailDraftItemCode" placeholder="Optional" />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="retail-item-quantity">Qty</Label>
                                                <Input id="retail-item-quantity" v-model="retailDraftQuantity" inputmode="decimal" placeholder="1" />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="retail-item-unit-price">Unit price</Label>
                                                <Input id="retail-item-unit-price" v-model="retailDraftUnitPrice" inputmode="decimal" placeholder="0.00" />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="retail-item-discount">Discount</Label>
                                                <Input id="retail-item-discount" v-model="retailDraftDiscount" inputmode="decimal" placeholder="0" />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="retail-item-tax">Tax</Label>
                                                <Input id="retail-item-tax" v-model="retailDraftTax" inputmode="decimal" placeholder="0" />
                                            </div>
                                            <div class="grid gap-2 sm:col-span-2">
                                                <Label for="retail-customer-reference">Customer reference</Label>
                                                <Input id="retail-customer-reference" v-model="retailCustomerReference" placeholder="Phone or badge" />
                                            </div>
                                            <div class="grid gap-2 sm:col-span-2">
                                                <Label for="retail-item-note">Line note</Label>
                                                <Input id="retail-item-note" v-model="retailDraftNote" placeholder="Optional" />
                                            </div>
                                        </PosFormGrid>
                                        <Button @click="addRetailLineItem">Add line</Button>
                                    </PosCheckoutSection>
                                    <PosCheckoutSection title="Basket lines">
                                        <template #actions>
                                            <Badge variant="outline">{{ retailLineItems.length }}</Badge>
                                        </template>
                                        <div v-if="retailLineItems.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No lines yet.</div>
                                        <div v-for="item in retailLineItems" v-else :key="item.clientId" class="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
                                            <div class="min-w-0">
                                                <p class="text-sm font-semibold">{{ item.itemName }}</p>
                                                <p class="text-xs text-muted-foreground">{{ [item.itemCode, `Qty ${item.quantity}`].filter(Boolean).join(' · ') }}</p>
                                            </div>
                                            <div class="flex shrink-0 items-center gap-2">
                                                <p class="text-sm font-medium">{{ formatCurrency(retailLineTotal(item), retailSelectedCurrency) }}</p>
                                                <Button size="sm" variant="outline" @click="removeRetailLineItem(item.clientId)">Remove</Button>
                                            </div>
                                        </div>
                                    </PosCheckoutSection>
                                </template>
                                <template #checkout>
                                    <PosCheckoutSection title="Payment">
                                        <template #actions>
                                            <Button size="sm" variant="outline" @click="addRetailPaymentEntry">Add payment</Button>
                                        </template>
                                        <div v-for="entry in retailPayments" :key="entry.clientId" class="rounded-lg border bg-background p-3">
                                            <PosFormGrid>
                                                <div class="grid gap-2">
                                                    <Label>Method</Label>
                                                    <Select v-model="entry.paymentMethod"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="option in paymentMethods" :key="option.value" :value="option.value">{{ option.label }}</SelectItem></SelectContent></Select>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label>Amount</Label>
                                                    <Input v-model="entry.amount" inputmode="decimal" placeholder="0.00" />
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label>Reference</Label>
                                                    <Input v-model="entry.paymentReference" placeholder="Optional" />
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label>Note</Label>
                                                    <Input v-model="entry.note" placeholder="Optional" />
                                                </div>
                                            </PosFormGrid>
                                            <div class="mt-2 flex justify-end">
                                                <Button size="sm" variant="ghost" @click="removeRetailPaymentEntry(entry.clientId)">Remove</Button>
                                            </div>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="retail-note">Checkout note</Label>
                                            <Textarea id="retail-note" v-model="retailCheckoutNote" rows="2" placeholder="Optional" />
                                        </div>
                                    </PosCheckoutSection>
                                    <div class="rounded-lg border bg-muted/20 p-4">
                                        <PosFormGrid :columns="4">
                                            <div><p class="text-xs text-muted-foreground">Subtotal</p><p class="font-medium">{{ formatCurrency(retailSubtotal, retailSelectedCurrency) }}</p></div>
                                            <div><p class="text-xs text-muted-foreground">Discount</p><p class="font-medium">{{ formatCurrency(retailDiscountAmount, retailSelectedCurrency) }}</p></div>
                                            <div><p class="text-xs text-muted-foreground">Tax</p><p class="font-medium">{{ formatCurrency(retailTaxAmount, retailSelectedCurrency) }}</p></div>
                                            <div><p class="text-xs text-muted-foreground">Total</p><p class="text-lg font-semibold">{{ formatCurrency(retailTotal, retailSelectedCurrency) }}</p></div>
                                        </PosFormGrid>
                                    </div>
                                    <div v-if="retailError" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{{ retailError }}</div>
                                    <div v-if="retailSuccess" class="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
                                        <p>{{ retailSuccess }}</p>
                                        <div v-if="retailLatestSaleId" class="mt-2 flex gap-2">
                                            <Button as-child size="sm" variant="outline">
                                                <Link :href="saleReceiptHref(retailLatestSaleId)" class="inline-flex items-center gap-1.5">
                                                    <AppIcon name="receipt" class="size-3.5" />
                                                    Receipt
                                                </Link>
                                            </Button>
                                            <Button as-child size="sm" variant="outline">
                                                <a :href="saleReceiptPdfHref(retailLatestSaleId)" class="inline-flex items-center gap-1.5">
                                                    <AppIcon name="printer" class="size-3.5" />
                                                    PDF
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Button :disabled="retailSubmitting || retailLineItems.length === 0 || !selectedRetailRegisterId" @click="submitRetailSale">{{ retailSubmitting ? 'Recording…' : 'Record sale' }}</Button>
                                        <Button variant="outline" :disabled="retailLineItems.length === 0" @click="resetRetailCheckout">Clear</Button>
                                    </div>
                                </template>
                            </PosLaneWorkspace>
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
                            <PosKpiStrip>
                                <div class="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                                    <p class="text-xs uppercase tracking-wide text-muted-foreground">Live sessions</p>
                                    <p class="mt-1 text-2xl font-semibold tabular-nums">{{ totalOpenSessions }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/40 px-4 py-3">
                                    <p class="text-xs uppercase tracking-wide text-muted-foreground">Recent closeouts</p>
                                    <p class="mt-1 text-2xl font-semibold tabular-nums">{{ totalClosedSessions }}</p>
                                    <p class="mt-0.5 text-xs text-muted-foreground">{{ balancedClosedSessionCount }} balanced</p>
                                </div>
                                <div class="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                                    <p class="text-xs uppercase tracking-wide text-muted-foreground">Variance alerts</p>
                                    <p class="mt-1 text-2xl font-semibold tabular-nums">{{ closedSessionVarianceCount }}</p>
                                </div>
                            </PosKpiStrip>

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
                                <div v-else class="mt-4">
                                <PosFormGrid>
                                    <div class="grid gap-2">
                                        <Label for="session-open-register">Register</Label>
                                        <Select v-model="sessionOpenRegisterId">
                                            <SelectTrigger><SelectValue placeholder="Select register" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem v-for="register in availableSessionRegisters" :key="register.id" :value="register.id">{{ `${register.registerName || 'Register'} (${register.registerCode || 'No Code'})` }}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="session-opening-cash">Opening cash</Label>
                                        <Input id="session-opening-cash" v-model="sessionOpeningCashAmount" inputmode="decimal" placeholder="100" />
                                    </div>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="session-opening-note">Opening note</Label>
                                        <Textarea id="session-opening-note" v-model="sessionOpeningNote" rows="2" placeholder="Optional handover note" />
                                    </div>
                                </PosFormGrid>
                                <div v-if="availableSessionRegisters.length > 0" class="mt-4 flex flex-wrap gap-2">
                                    <Button :disabled="sessionOpenSubmitting || !sessionOpenRegisterId" @click="submitOpenSession">{{ sessionOpenSubmitting ? 'Opening Session...' : 'Open Session' }}</Button>
                                </div>
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

            <TabsContent value="cafeteria" class="mt-0 space-y-4">
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
                            <PosFilterBar>
                                <PosFilterField :xl-span="3">
                                    <Label for="cafeteria-register">Register</Label>
                                    <Select v-model="selectedCafeteriaRegisterId">
                                        <SelectTrigger><SelectValue placeholder="Open session" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="register in cafeteriaReadyRegisters" :key="register.id" :value="register.id">{{ `${register.registerName || 'Register'} (${register.registerCode || 'No Code'})` }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </PosFilterField>
                                <PosFilterField :xl-span="4">
                                    <Label for="cafeteria-search">Menu search</Label>
                                    <Input id="cafeteria-search" v-model="cafeteriaSearch" placeholder="Name, code, category" @keydown.enter.prevent="loadCafeteriaCatalog(true)" />
                                </PosFilterField>
                                <PosFilterField :xl-span="3">
                                    <Label for="cafeteria-category">Category</Label>
                                    <Input id="cafeteria-category" v-model="cafeteriaCategory" placeholder="Filter category" @keydown.enter.prevent="loadCafeteriaCatalog(true)" />
                                </PosFilterField>
                                <PosFilterField :xl-span="2">
                                    <Label for="cafeteria-status">Status</Label>
                                    <Select v-model="cafeteriaStatusFilter">
                                        <SelectTrigger :disabled="!canManageCafeteriaCatalog"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                            <SelectItem value="all">All</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </PosFilterField>
                                <PosFilterField :xl-span="12">
                                    <Button variant="outline" size="sm" :disabled="cafeteriaLoading" @click="loadCafeteriaCatalog(true)">{{ cafeteriaLoading ? 'Loading…' : 'Refresh menu' }}</Button>
                                </PosFilterField>
                            </PosFilterBar>
                            <PosLaneWorkspace>
                                <template #catalog>
                                <PosCheckoutSection title="Menu" description="Active items only at checkout.">
                                <div class="max-h-[min(28rem,50vh)] space-y-3 overflow-y-auto pr-1">
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
                                </PosCheckoutSection>
                                </template>
                                <template #checkout>
                                    <PosCheckoutSection title="Add to tray" :description="selectedCafeteriaMenuItem?.itemName || 'Select a menu item'">
                                        <PosFormGrid>
                                            <div class="grid gap-2"><Label for="cafeteria-quantity">Qty</Label><Input id="cafeteria-quantity" v-model="cafeteriaQuantity" inputmode="decimal" placeholder="1" :disabled="!selectedCafeteriaMenuItem" /></div>
                                            <div class="grid gap-2"><Label for="cafeteria-line-note">Kitchen note</Label><Input id="cafeteria-line-note" v-model="cafeteriaLineNote" placeholder="Optional" :disabled="!selectedCafeteriaMenuItem" /></div>
                                        </PosFormGrid>
                                        <div class="flex gap-2">
                                            <Button :disabled="!selectedCafeteriaMenuItem" @click="addCafeteriaToBasket">Add to tray</Button>
                                            <Button variant="outline" :disabled="!selectedCafeteriaMenuItemId" @click="selectedCafeteriaMenuItemId = ''">Clear</Button>
                                        </div>
                                    </PosCheckoutSection>
                                    <PosCheckoutSection title="Tray">
                                        <template #actions><Badge variant="outline">{{ cafeteriaBasketItems.length }}</Badge></template>
                                        <div v-if="cafeteriaBasketItems.length === 0" class="text-sm text-muted-foreground">Tray is empty.</div>
                                        <div v-for="item in cafeteriaBasketItems" v-else :key="item.clientId" class="flex justify-between gap-2 rounded-lg border px-3 py-2">
                                            <div class="min-w-0"><p class="text-sm font-semibold">{{ item.itemName }}</p><p class="text-xs text-muted-foreground">Qty {{ item.quantity }} × {{ formatCurrency(item.unitPrice, cafeteriaSelectedCurrency) }}</p></div>
                                            <Button size="sm" variant="outline" @click="removeCafeteriaBasketItem(item.clientId)">Remove</Button>
                                        </div>
                                    </PosCheckoutSection>
                                    <PosCheckoutSection title="Customer & payment">
                                        <PosFormGrid>
                                            <div class="grid gap-2"><Label for="cafeteria-customer-name">Name</Label><Input id="cafeteria-customer-name" v-model="cafeteriaCustomerName" placeholder="Optional" /></div>
                                            <div class="grid gap-2"><Label for="cafeteria-customer-reference">Reference</Label><Input id="cafeteria-customer-reference" v-model="cafeteriaCustomerReference" placeholder="Phone or badge" /></div>
                                        </PosFormGrid>
                                        <div class="mt-4 flex items-center justify-between">
                                            <p class="text-sm font-medium">Payments</p>
                                            <Button size="sm" variant="outline" @click="addCafeteriaPaymentEntry">Add</Button>
                                        </div>
                                        <div v-for="entry in cafeteriaPayments" :key="entry.clientId" class="mt-2 rounded-lg border p-3">
                                            <PosFormGrid>
                                                <div class="grid gap-2"><Label>Method</Label><Select v-model="entry.paymentMethod"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="option in paymentMethods" :key="option.value" :value="option.value">{{ option.label }}</SelectItem></SelectContent></Select></div>
                                                <div class="grid gap-2"><Label>Amount</Label><Input v-model="entry.amount" inputmode="decimal" /></div>
                                            </PosFormGrid>
                                            <Button size="sm" variant="ghost" class="mt-1" @click="removeCafeteriaPaymentEntry(entry.clientId)">Remove</Button>
                                        </div>
                                        <div class="mt-3 grid gap-2"><Label for="cafeteria-note">Note</Label><Textarea id="cafeteria-note" v-model="cafeteriaCheckoutNote" rows="2" /></div>
                                    </PosCheckoutSection>
                                    <div class="rounded-lg border bg-muted/20 p-4">
                                        <PosFormGrid :columns="4">
                                            <div><p class="text-xs text-muted-foreground">Subtotal</p><p class="font-medium">{{ formatCurrency(cafeteriaBasketSubtotal, cafeteriaSelectedCurrency) }}</p></div>
                                            <div><p class="text-xs text-muted-foreground">Tax</p><p class="font-medium">{{ formatCurrency(cafeteriaBasketTax, cafeteriaSelectedCurrency) }}</p></div>
                                            <div><p class="text-xs text-muted-foreground">Total</p><p class="text-lg font-semibold">{{ formatCurrency(cafeteriaBasketTotal, cafeteriaSelectedCurrency) }}</p></div>
                                            <div><p class="text-xs text-muted-foreground">Paid</p><p class="font-medium">{{ formatCurrency(cafeteriaPaymentTotal, cafeteriaSelectedCurrency) }}</p></div>
                                        </PosFormGrid>
                                    </div>
                                    <div v-if="cafeteriaError" class="text-sm text-destructive">{{ cafeteriaError }}</div>
                                    <div v-if="cafeteriaSuccess" class="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm dark:border-sky-800 dark:bg-sky-950/40">{{ cafeteriaSuccess }}</div>
                                    <div class="flex gap-2">
                                        <Button :disabled="cafeteriaSubmitting || cafeteriaBasketItems.length === 0 || !selectedCafeteriaRegisterId" @click="submitCafeteriaSale">{{ cafeteriaSubmitting ? 'Recording…' : 'Record sale' }}</Button>
                                        <Button variant="outline" :disabled="cafeteriaBasketItems.length === 0" @click="resetCafeteriaCheckout">Clear</Button>
                                    </div>
                                </template>
                            </PosLaneWorkspace>
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
                            <PosFormGrid>
                                <div class="grid gap-2"><Label for="cafeteria-editor-code">Item Code</Label><Input id="cafeteria-editor-code" v-model="cafeteriaEditorItemCode" placeholder="CAF-COFFEE" /></div>
                                <div class="grid gap-2"><Label for="cafeteria-editor-name">Item Name</Label><Input id="cafeteria-editor-name" v-model="cafeteriaEditorItemName" placeholder="House Coffee" /></div>
                                <div class="grid gap-2"><Label for="cafeteria-editor-category">Category</Label><Input id="cafeteria-editor-category" v-model="cafeteriaEditorCategory" placeholder="Beverages" /></div>
                                <div class="grid gap-2"><Label for="cafeteria-editor-unit">Unit Label</Label><Input id="cafeteria-editor-unit" v-model="cafeteriaEditorUnitLabel" placeholder="cup, plate, bottle" /></div>
                                <div class="grid gap-2"><Label for="cafeteria-editor-price">Unit Price</Label><Input id="cafeteria-editor-price" v-model="cafeteriaEditorUnitPrice" inputmode="decimal" placeholder="2500" /></div>
                                <div class="grid gap-2"><Label for="cafeteria-editor-tax">Tax Rate %</Label><Input id="cafeteria-editor-tax" v-model="cafeteriaEditorTaxRatePercent" inputmode="decimal" placeholder="0" /></div>
                                <div class="grid gap-2"><Label for="cafeteria-editor-status">Status</Label><Select v-model="cafeteriaEditorStatus"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
                                <div class="grid gap-2"><Label for="cafeteria-editor-sort">Sort Order</Label><Input id="cafeteria-editor-sort" v-model="cafeteriaEditorSortOrder" inputmode="numeric" placeholder="0" /></div>
                                <div class="grid gap-2 sm:col-span-2"><Label for="cafeteria-editor-status-reason">Status Reason</Label><Input id="cafeteria-editor-status-reason" v-model="cafeteriaEditorStatusReason" placeholder="Why inactive" /></div>
                                <div class="grid gap-2 sm:col-span-2"><Label for="cafeteria-editor-description">Description</Label><Textarea id="cafeteria-editor-description" v-model="cafeteriaEditorDescription" rows="2" placeholder="Kitchen note" /></div>
                            </PosFormGrid>
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
                        <p class="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                            <span class="font-medium text-foreground">Cashier flow:</span>
                            open a session → pick a lane → build basket → take payment → use History for receipts and refunds.
                            <Button size="sm" variant="link" class="h-auto p-0 align-baseline" @click="activeTab = 'sessions'">Open sessions</Button>
                        </p>
                        <div class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
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
                            <div
                                v-if="canReadLabQuick"
                                class="rounded-lg border border-cyan-200 bg-cyan-50/50 px-4 py-3 shadow-sm dark:border-cyan-900 dark:bg-cyan-950/30"
                            >
                                <div class="flex items-center justify-between gap-2">
                                    <div>
                                        <p class="text-sm font-semibold">Lab payment</p>
                                        <p class="mt-1 text-xs text-muted-foreground">Pay for lab tests at the counter (same patient per checkout).</p>
                                    </div>
                                    <Badge variant="secondary">POS lane</Badge>
                                </div>
                                <p class="mt-3 text-xs text-muted-foreground">{{ labQuickBasketItems.length }} test{{ labQuickBasketItems.length === 1 ? '' : 's' }} in basket if you started one.</p>
                                <div class="mt-3">
                                    <Button size="sm" @click="activeTab = 'lab-quick'">Open lab payment</Button>
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
                <p class="text-sm text-muted-foreground">Register setup, sales search, refunds, and void review for supervisors.</p>
                <div class="flex flex-col gap-4">
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
                        <PosFilterBar>
                            <PosFilterField :xl-span="8">
                                <Label for="register-search">Register search</Label>
                                <Input id="register-search" v-model="registerSearch" placeholder="Code, name, location" @keydown.enter.prevent="loadRegisters" />
                            </PosFilterField>
                            <PosFilterField :xl-span="4">
                                <Label for="register-status-filter">Status</Label>
                                <Select v-model="registerStatusFilter">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </PosFilterField>
                            <PosFilterField :xl-span="12">
                                <Button variant="outline" size="sm" @click="loadRegisters">Refresh registers</Button>
                            </PosFilterField>
                        </PosFilterBar>
                        <div v-if="canManageRegisters" class="rounded-lg border bg-muted/20 p-4">
                            <div class="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p class="text-sm font-semibold">{{ isEditingRegister ? 'Edit Register' : 'Create Register' }}</p>
                                    <p class="text-xs text-muted-foreground">Counter setup lives here so supervisors can onboard, relocate, or deactivate tills without code changes.</p>
                                </div>
                                <Button v-if="isEditingRegister" size="sm" variant="outline" @click="resetRegisterEditor">New Register</Button>
                            </div>
                            <div class="mt-4">
                            <PosFormGrid>
                                <div class="grid gap-2"><Label for="register-editor-code">Code</Label><Input id="register-editor-code" v-model="registerEditorCode" placeholder="POS-ER-01" /></div>
                                <div class="grid gap-2"><Label for="register-editor-name">Name</Label><Input id="register-editor-name" v-model="registerEditorName" placeholder="Emergency counter" /></div>
                                <div class="grid gap-2"><Label for="register-editor-location">Location</Label><Input id="register-editor-location" v-model="registerEditorLocation" placeholder="Building / desk" /></div>
                                <div class="grid gap-2"><Label for="register-editor-currency">Currency</Label><Input id="register-editor-currency" v-model="registerEditorCurrency" placeholder="TZS" /></div>
                                <div class="grid gap-2"><Label for="register-editor-status">Status</Label><Select v-model="registerEditorStatus"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
                                <div class="grid gap-2"><Label for="register-editor-status-reason">Status reason</Label><Input id="register-editor-status-reason" v-model="registerEditorStatusReason" placeholder="If inactive" /></div>
                                <div class="grid gap-2 sm:col-span-2"><Label for="register-editor-notes">Notes</Label><Textarea id="register-editor-notes" v-model="registerEditorNotes" rows="2" placeholder="Optional" /></div>
                            </PosFormGrid>
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
                            <PosFilterBar>
                                <PosFilterField :xl-span="6">
                                    <Label for="sales-search">Search</Label>
                                    <Input id="sales-search" v-model="salesSearch" placeholder="Sale, receipt, customer" @keydown.enter.prevent="applySalesFilters" />
                                </PosFilterField>
                                <PosFilterField :xl-span="3">
                                    <Label for="sales-channel">Channel</Label>
                                    <Select :model-value="salesChannelFilter || '__all__'" @update:model-value="salesChannelFilter = $event === '__all__' ? '' : String($event)"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All</SelectItem><SelectItem value="general_retail">Retail</SelectItem><SelectItem value="pharmacy_otc">OTC</SelectItem><SelectItem value="cafeteria">Cafeteria</SelectItem><SelectItem value="lab_quick">Lab quick</SelectItem></SelectContent></Select>
                                </PosFilterField>
                                <PosFilterField :xl-span="3">
                                    <Label for="sales-status">Status</Label>
                                    <Select :model-value="salesStatusFilter || '__all__'" @update:model-value="salesStatusFilter = $event === '__all__' ? '' : String($event)"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="voided">Voided</SelectItem><SelectItem value="refunded">Refunded</SelectItem></SelectContent></Select>
                                </PosFilterField>
                                <PosFilterField :xl-span="3">
                                    <Label for="sales-payment-method">Payment</Label>
                                    <Select :model-value="salesPaymentMethodFilter || '__all__'" @update:model-value="salesPaymentMethodFilter = $event === '__all__' ? '' : String($event)"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All</SelectItem><SelectItem v-for="option in paymentMethods" :key="option.value" :value="option.value">{{ option.label }}</SelectItem></SelectContent></Select>
                                </PosFilterField>
                                <PosFilterField :xl-span="3">
                                    <Label for="sales-register-filter">Register</Label>
                                    <Select :model-value="salesRegisterFilter || '__all__'" @update:model-value="salesRegisterFilter = $event === '__all__' ? '' : String($event)"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All</SelectItem><SelectItem v-for="register in registerRows" :key="register.id" :value="register.id">{{ register.registerCode || register.registerName }}</SelectItem></SelectContent></Select>
                                </PosFilterField>
                                <PosFilterField :xl-span="3">
                                    <Label for="sales-date-from">From</Label>
                                    <Input id="sales-date-from" v-model="salesDateFrom" type="date" />
                                </PosFilterField>
                                <PosFilterField :xl-span="3">
                                    <Label for="sales-date-to">To</Label>
                                    <Input id="sales-date-to" v-model="salesDateTo" type="date" />
                                </PosFilterField>
                                <PosFilterField :xl-span="6">
                                    <Label for="sales-session-filter">Session</Label>
                                    <Input id="sales-session-filter" :model-value="salesSessionFilter" readonly placeholder="From Sessions tab" />
                                </PosFilterField>
                            </PosFilterBar>
                            <div class="flex flex-wrap gap-2">
                                <Button variant="outline" :disabled="salesLoading" @click="applySalesFilters">{{ salesLoading ? 'Loading...' : 'Apply Filters' }}</Button>
                                <Button variant="outline" :disabled="salesLoading" @click="clearSalesFilters">Clear Filters</Button>
                            </div>
                            <div v-if="salesLoading" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Loading filtered POS sales...</div>
                            <div v-else-if="salesRows.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No POS sales matched the current filters.</div>
                            <div v-for="sale in salesRows" v-else :key="sale.id" class="space-y-3 rounded-lg border bg-background px-4 py-3 shadow-sm">
                                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="min-w-0 flex-1">
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
                                            <Button as-child size="sm" variant="outline">
                                                <Link :href="saleReceiptHref(sale.id)" class="inline-flex items-center gap-1.5">
                                                    <AppIcon name="receipt" class="size-3.5" />
                                                    Receipt
                                                </Link>
                                            </Button>
                                            <Button as-child size="sm" variant="outline">
                                                <a :href="saleReceiptPdfHref(sale.id)" class="inline-flex items-center gap-1.5">
                                                    <AppIcon name="printer" class="size-3.5" />
                                                    PDF
                                                </a>
                                            </Button>
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
