<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, ref, nextTick, onBeforeUnmount, onMounted, reactive, watch, type Ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import type { AppIconName } from '@/lib/icons';
import BillingInvoiceLookupField from '@/components/billing/BillingInvoiceLookupField.vue';
import ClaimsInsuranceCaseLookupField from '@/components/claims/ClaimsInsuranceCaseLookupField.vue';
import ComboboxField from '@/components/forms/ComboboxField.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import InventoryEmptyState from '@/components/inventory/InventoryEmptyState.vue';
import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input, SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import LeaveWorkflowDialog from '@/components/workflow/LeaveWorkflowDialog.vue';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useUrlQueryState } from '@/composables/useUrlQueryState';
const { permissionNames: sharedPermissionNames, isFacilitySuperAdmin, permissionState, scope: platformScope } = usePlatformAccess();
const permissionsResolved = computed(() => sharedPermissionNames.value !== null);
const showBootstrapSkeleton = computed(() => !permissionsResolved.value || (canRead.value && loading.value));
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import { generateRequestKey } from '@/lib/idempotency';
import { INVENTORY_PROCUREMENT_HOME_PATH } from '@/lib/inventoryProcurement';
import { isInventoryStoreOperations, type InventoryProcurementAccess } from '@/lib/inventoryProcurementAccess';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { EMPTY_SELECT_VALUE, toSelectValue, fromSelectValue, formatDateTime, formatDateOnly, auditActorLabel } from '@/pages/inventory-procurement/constants';
import { clearSupplyChainPageApi } from '@/pages/inventory-procurement/supplyChainPageApi';
import { bindSupplyChainPageApi } from '@/pages/inventory-procurement/registerSupplyChainPageApi';
import SupplyChainClaimsAndMsdSheets from '@/pages/inventory-procurement/components/SupplyChainClaimsAndMsdSheets.vue';
import SupplyChainPageBootstrapSkeleton from '@/pages/inventory-procurement/components/SupplyChainPageBootstrapSkeleton.vue';
import {
    SupplyChainAnalyticsTab,
    SupplyChainClaimsTab,
} from '@/pages/inventory-procurement/supplyChainTabComponents';
import { type BreadcrumbItem } from '@/types';

type ApiError = Error & { payload?: { message?: string; errors?: Record<string, string[]> } };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Supply chain', href: INVENTORY_PROCUREMENT_HOME_PATH },
    { title: 'Review', href: '/inventory-procurement/review' },
];

type ReviewTab = 'claims' | 'analytics';
const reviewTabs: ReviewTab[] = ['claims', 'analytics'];

const canRead = ref(false);
const canManageItems = ref(false);
const canCreateMovement = ref(false);
const canViewAudit = ref(false);
const canCreateRequest = ref(false);

const inventoryAccess = computed<InventoryProcurementAccess>(() => ({
    canRead: canRead.value, canManageItems: canManageItems.value, canCreateMovement: canCreateMovement.value,
    canSetOpeningStock: false, canReconcileStock: false, canCreateRequest: canCreateRequest.value,
    canUpdateRequestStatus: false, canViewAudit: canViewAudit.value, canApproveRequisitions: false,
    canManageSuppliers: false, canManageWarehouses: false,
}));

const activeTab = ref<ReviewTab>('claims');
const loading = ref(true);
const { hydrated: reviewUrlStateHydrated, setQueryParam, replaceUrlQuery } = useUrlQueryState();

// ── Claims state ──
const claimLinks = ref<any[]>([]);
const claimLinkPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const claimLinkLoading = ref(false);
const claimLinkSearch = reactive({ q: '', claimStatus: '', page: 1, perPage: 15 });
const CLAIM_STATUSES = [
    { value: 'pending', label: 'Pending' },
    { value: 'linked', label: 'Linked to Claim' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'partially_approved', label: 'Partially Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' },
] as const;
const createClaimLinkDialogOpen = ref(false);
const claimLinkErrors = ref<Record<string, string[]>>({});
const claimLinkSubmitting = ref(false);
const claimLinkSelectedItem = ref<any | null>(null);
const claimLinkSelectedClaim = ref<any | null>(null);
const claimLinkSelectedInvoice = ref<any | null>(null);
const claimLinkForm = reactive({
    itemId: '', patientId: '', quantityDispensed: '', unit: '', unitCost: '',
    nhifCode: '', payerType: '', payerName: '', insuranceClaimId: '', billingInvoiceId: '', notes: '',
});

function claimStatusBadgeClass(status: string): string {
    switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        case 'linked': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        case 'submitted': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
        case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        case 'partially_approved': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
        case 'rejected': return 'bg-destructive text-destructive-foreground';
        case 'cancelled': return 'bg-muted text-muted-foreground line-through';
        default: return 'bg-muted text-muted-foreground';
    }
}

function resetClaimLinkForm() {
    claimLinkForm.itemId = ''; claimLinkForm.patientId = ''; claimLinkForm.quantityDispensed = '';
    claimLinkForm.unit = ''; claimLinkForm.unitCost = ''; claimLinkForm.nhifCode = '';
    claimLinkForm.payerType = ''; claimLinkForm.payerName = ''; claimLinkForm.insuranceClaimId = '';
    claimLinkForm.billingInvoiceId = ''; claimLinkForm.notes = '';
    claimLinkSelectedItem.value = null;
    claimLinkSelectedClaim.value = null;
    claimLinkSelectedInvoice.value = null;
}

function handleClaimLinkItemSelected(item: any) {
    claimLinkSelectedItem.value = item;
    if (!item) return;

    if (!claimLinkForm.unit && (item.dispensingUnit || item.unit)) {
        claimLinkForm.unit = item.dispensingUnit || item.unit || '';
    }

    if (!claimLinkForm.nhifCode && item.nhifCode) {
        claimLinkForm.nhifCode = item.nhifCode;
    }
}

function handleClaimLinkClaimsCaseSelected(claim: any) {
    claimLinkSelectedClaim.value = claim;
    if (!claim) return;

    if (!claimLinkForm.patientId && claim.patientId) {
        claimLinkForm.patientId = claim.patientId;
    }

    if (!claimLinkForm.billingInvoiceId && claim.invoiceId) {
        claimLinkForm.billingInvoiceId = claim.invoiceId;
    }

    if (!claimLinkForm.payerType && claim.payerType) {
        claimLinkForm.payerType = claim.payerType;
    }

    if (!claimLinkForm.payerName && claim.payerName) {
        claimLinkForm.payerName = claim.payerName;
    }
}

function handleClaimLinkInvoiceSelected(invoice: any | null) {
    claimLinkSelectedInvoice.value = invoice;
}

const claimLinkItemContextLabel = computed(() => {
    const item = claimLinkSelectedItem.value;
    const name = String(item?.itemName ?? item?.genericName ?? '').trim();
    const code = String(item?.itemCode ?? '').trim();

    if (name && code) return `${name} (${code})`;
    if (name) return name;
    if (code) return code;
    if (claimLinkForm.itemId.trim()) return `Item ${claimLinkForm.itemId.trim()}`;
    return 'Select dispensed item';
});

const claimLinkItemContextMeta = computed(() => {
    const item = claimLinkSelectedItem.value;
    const parts: string[] = [];
    const unit = String(item?.dispensingUnit ?? item?.unit ?? claimLinkForm.unit ?? '').trim();
    const nhifCode = String(item?.nhifCode ?? claimLinkForm.nhifCode ?? '').trim();

    if (unit) parts.push(`Unit ${unit}`);
    if (nhifCode) parts.push(`NHIF ${nhifCode}`);
    if (parts.length > 0) return parts.join(' · ');
    if (claimLinkForm.itemId.trim()) return 'Dispensed item selected for reimbursement traceability.';
    return 'Search the inventory catalogue for the dispensed item.';
});

const claimLinkPatientContextLabel = computed(() =>
    claimLinkForm.patientId.trim() ? 'Selected patient' : null,
);

const claimLinkPatientContextMeta = computed(() => {
    const patientId = claimLinkForm.patientId.trim();
    if (!patientId) return null;

    const parts = [`Patient ID ${patientId}`];
    if (claimLinkSelectedClaim.value?.patientId === patientId) parts.push('Matches selected claim');
    if (claimLinkSelectedInvoice.value?.patientId === patientId) parts.push('Matches selected invoice');

    return parts.join(' · ');
});

const claimLinkWorkflowContextLabel = computed(() => {
    if (claimLinkForm.insuranceClaimId.trim() && claimLinkForm.billingInvoiceId.trim()) {
        return 'Claim and invoice linked';
    }
    if (claimLinkForm.insuranceClaimId.trim()) return 'Insurance claim linked';
    if (claimLinkForm.billingInvoiceId.trim()) return 'Billing invoice linked';
    if (claimLinkForm.payerType || claimLinkForm.payerName.trim()) return 'Payer context prepared';
    return 'Manual reimbursement link';
});

const claimLinkWorkflowContextMeta = computed(() => {
    const parts: string[] = [];
    const claimNumber = String(claimLinkSelectedClaim.value?.claimNumber ?? '').trim();
    const invoiceNumber = String(claimLinkSelectedInvoice.value?.invoiceNumber ?? '').trim();
    const payerName = claimLinkForm.payerName.trim()
        || String(claimLinkSelectedClaim.value?.payerName ?? '').trim();

    if (claimNumber) parts.push(claimNumber);
    else if (claimLinkForm.insuranceClaimId.trim()) parts.push(`Claim ${claimLinkForm.insuranceClaimId.trim()}`);

    if (invoiceNumber) parts.push(invoiceNumber);
    else if (claimLinkForm.billingInvoiceId.trim()) parts.push(`Invoice ${claimLinkForm.billingInvoiceId.trim()}`);

    if (payerName) parts.push(payerName);
    else if (claimLinkForm.payerType) parts.push(formatEnumLabel(claimLinkForm.payerType));

    return parts.length > 0
        ? parts.join(' · ')
        : 'Connect the dispensed item to claim, invoice, or payer context before submitting.';
});

const claimLinkContextStatusLabel = computed(() => {
    if (claimLinkForm.insuranceClaimId.trim()) return 'Claim context linked';
    if (claimLinkForm.billingInvoiceId.trim()) return 'Invoice context linked';
    if (claimLinkForm.itemId.trim() && claimLinkForm.patientId.trim()) return 'Ready to link';
    if (claimLinkForm.itemId.trim() || claimLinkForm.patientId.trim()) return 'Context in progress';
    return 'Context required';
});

const claimLinkContextStatusVariant = computed<'default' | 'secondary' | 'outline' | 'destructive'>(() => {
    if (claimLinkForm.insuranceClaimId.trim()) return 'default';
    if (claimLinkForm.billingInvoiceId.trim()) return 'secondary';
    if (claimLinkForm.itemId.trim() && claimLinkForm.patientId.trim()) return 'secondary';
    return 'outline';
});

const reviewFilterCount = computed(() => {
    if (activeTab.value === 'claims') {
        let count = 0;
        if (claimLinkSearch.claimStatus) count++;
        return count;
    }

    let count = 0;
    if (consumptionGranularity.value !== 'daily') count++;
    if (consumptionDays.value !== 30) count++;
    return count;
});

interface HeaderAction {
    key: string;
    label: string;
    icon: string;
    variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
    show: boolean;
    onClick?: () => void;
}

const headerActions = computed<HeaderAction[]>(() => {
    const actions: HeaderAction[] = [];
    if (activeTab.value === 'claims') {
        actions.push({ key: 'link-dispensing', label: 'Link Dispensing', icon: 'plus', variant: 'default', show: true, onClick: () => { createClaimLinkDialogOpen.value = true; } });
    }
    actions.push({ key: 'export', label: 'Export', icon: 'download', variant: 'outline', show: true, onClick: () => {} });
    actions.push({ key: 'print', label: 'Print', icon: 'printer', variant: 'outline', show: true, onClick: () => { if (typeof window !== 'undefined') window.print(); } });
    return actions.filter((action) => action.show);
});

function refreshActiveTab(): void {
    if (activeTab.value === 'analytics') {
        void loadAllAnalytics();
        return;
    }
    void loadClaimLinks();
}

async function loadClaimLinks() {
    claimLinkLoading.value = true;
    try {
        const query: Record<string, string | number> = { page: claimLinkSearch.page, perPage: claimLinkSearch.perPage };
        if (claimLinkSearch.q) query.query = claimLinkSearch.q;
        if (claimLinkSearch.claimStatus) query.claimStatus = claimLinkSearch.claimStatus;
        const response = await apiRequest<{ data: any[]; meta: any }>('GET', '/inventory-procurement/dispensing-claim-links', { query });
        claimLinks.value = response.data ?? [];
        claimLinkPagination.value = response.meta ?? null;
    } catch { claimLinks.value = []; claimLinkPagination.value = null; } finally { claimLinkLoading.value = false; }
}

function hydrateReviewStateFromUrl(): void {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    const tab = (params.get('tab') ?? '').trim().toLowerCase();
    const section = (params.get('section') ?? '').trim().toLowerCase();
    if (reviewTabs.includes(tab as ReviewTab)) {
        activeTab.value = tab as ReviewTab;
    } else if (reviewTabs.includes(section as ReviewTab)) {
        activeTab.value = section as ReviewTab;
    }

    if (activeTab.value === 'claims') {
        claimLinkSearch.q = params.get('q')?.trim() ?? '';
        claimLinkSearch.claimStatus = params.get('claimStatus')?.trim() ?? '';
        claimLinkSearch.page = Number.isFinite(Number(params.get('page') ?? '')) && Number(params.get('page')) > 0
            ? Number(params.get('page'))
            : 1;
        claimLinkSearch.perPage = Number.isFinite(Number(params.get('perPage') ?? '')) && Number(params.get('perPage')) > 0
            ? Number(params.get('perPage'))
            : 15;
    }

    if (activeTab.value === 'analytics') {
        const granularity = (params.get('granularity') ?? '').trim().toLowerCase();
        if (granularity === 'daily' || granularity === 'weekly' || granularity === 'monthly') {
            consumptionGranularity.value = granularity;
        }

        const days = Number(params.get('days') ?? '');
        if (Number.isFinite(days) && days > 0) {
            consumptionDays.value = days;
        }
    }

    reviewUrlStateHydrated.value = true;
}

function syncReviewStateToUrl(): void {
    if (!reviewUrlStateHydrated.value || typeof window === 'undefined') return;

    replaceUrlQuery((params) => {
        params.delete('section');
        setQueryParam(params, 'tab', activeTab.value);

        const allStateKeys = ['q', 'claimStatus', 'page', 'perPage', 'granularity', 'days'];
        for (const key of allStateKeys) params.delete(key);

        if (activeTab.value === 'claims') {
            setQueryParam(params, 'q', claimLinkSearch.q);
            setQueryParam(params, 'claimStatus', claimLinkSearch.claimStatus);
            if (claimLinkSearch.page > 1) setQueryParam(params, 'page', claimLinkSearch.page);
            if (claimLinkSearch.perPage !== 15) setQueryParam(params, 'perPage', claimLinkSearch.perPage);
        }

        if (activeTab.value === 'analytics') {
            if (consumptionGranularity.value !== 'daily') setQueryParam(params, 'granularity', consumptionGranularity.value);
            if (consumptionDays.value !== 30) setQueryParam(params, 'days', consumptionDays.value);
        }
    });
}

async function submitCreateClaimLink() {
    if (claimLinkSubmitting.value) return;
    claimLinkSubmitting.value = true;
    claimLinkErrors.value = {};
    try {
        await apiRequest('POST', '/inventory-procurement/dispensing-claim-links', {
            body: {
                itemId: claimLinkForm.itemId,
                patientId: claimLinkForm.patientId,
                quantityDispensed: Number(claimLinkForm.quantityDispensed),
                unit: claimLinkForm.unit || null,
                unitCost: claimLinkForm.unitCost ? Number(claimLinkForm.unitCost) : null,
                nhifCode: claimLinkForm.nhifCode || null,
                payerType: claimLinkForm.payerType || null,
                payerName: claimLinkForm.payerName || null,
                insuranceClaimId: claimLinkForm.insuranceClaimId || null,
                billingInvoiceId: claimLinkForm.billingInvoiceId || null,
                notes: claimLinkForm.notes || null,
            },
        });
        createClaimLinkDialogOpen.value = false;
        resetClaimLinkForm();
        notifySuccess('Dispensing claim link created.');
        await loadClaimLinks();
    } catch (error: any) {
        if (error?.errors) claimLinkErrors.value = error.errors;
        else notifyError(messageFromUnknown(error, 'Failed to create claim link.'));
    } finally { claimLinkSubmitting.value = false; }
}

// ── Analytics state ──
const analyticsLoading = ref(false);
const consumptionTrends = ref<any[]>([]);
const abcVenMatrix = ref<any[]>([]);
const expiryWastage = ref<{ summary: any; expired: any[]; critical: any[]; warning: any[] } | null>(null);
const stockTurnover = ref<any[]>([]);
const consumptionGranularity = ref('daily');
const consumptionDays = ref(30);

async function loadConsumptionTrends() {
    try {
        const response = await apiRequest<{ data: any[] }>('GET', '/inventory-procurement/analytics/consumption-trends', {
            query: { granularity: consumptionGranularity.value, days: consumptionDays.value },
        });
        consumptionTrends.value = response.data ?? [];
    } catch { consumptionTrends.value = []; }
}

async function loadAbcVenMatrix() {
    try {
        const response = await apiRequest<{ matrix: any[]; topItems: any[] }>('GET', '/inventory-procurement/analytics/abc-ven-matrix');
        abcVenMatrix.value = response.matrix ?? [];
    } catch { abcVenMatrix.value = []; }
}

async function loadExpiryWastage() {
    try {
        const response = await apiRequest<{ summary: any; expired: any[]; critical: any[]; warning: any[] }>('GET', '/inventory-procurement/analytics/expiry-wastage');
        expiryWastage.value = response;
    } catch { expiryWastage.value = null; }
}

async function loadStockTurnover() {
    try {
        const response = await apiRequest<{ data: any[] }>('GET', '/inventory-procurement/analytics/stock-turnover');
        stockTurnover.value = response.data ?? [];
    } catch { stockTurnover.value = []; }
}

async function loadAllAnalytics() {
    analyticsLoading.value = true;
    try {
        await Promise.all([loadConsumptionTrends(), loadAbcVenMatrix(), loadExpiryWastage(), loadStockTurnover()]);
    } catch { /* handled individually */ } finally { analyticsLoading.value = false; }
}

function resetReviewFilters(): void {
    if (activeTab.value === 'claims') {
        claimLinkSearch.q = '';
        claimLinkSearch.claimStatus = '';
        claimLinkSearch.page = 1;
        void loadClaimLinks();
        return;
    }

    consumptionGranularity.value = 'daily';
    consumptionDays.value = 30;
    void loadConsumptionTrends();
}

function applyReviewFilters(): void {
    if (activeTab.value === 'claims') {
        claimLinkSearch.page = 1;
        void loadClaimLinks();
        return;
    }

    void loadConsumptionTrends();
}

// ── MSD / claim link sheets ──
const createMsdOrderDialogOpen = ref(false);
const msdOrderForm = reactive({
    facilityMsdCode: '', orderDate: '', expectedDeliveryDate: '',
    notes: '', submitImmediately: false,
    lines: [{ msdCode: '', itemName: '', quantity: '', unit: '', unitCost: '' }] as Array<{ msdCode: string; itemName: string; quantity: string; unit: string; unitCost: string }>,
});
const msdOrderErrors = ref<Record<string, string[]>>({});
const msdOrderSubmitting = ref(false);

type MsdDraftLine = { msdCode: string; itemName: string; quantity: string; unit: string; unitCost: string; source: string };

function resetMsdOrderForm() {
    msdOrderForm.facilityMsdCode = ''; msdOrderForm.orderDate = ''; msdOrderForm.expectedDeliveryDate = '';
    msdOrderForm.notes = ''; msdOrderForm.submitImmediately = false;
    msdOrderForm.lines = [{ msdCode: '', itemName: '', quantity: '', unit: '', unitCost: '' }];
}

function openBlankMsdOrder(): void {
    resetMsdOrderForm();
    msdOrderErrors.value = {};
    createMsdOrderDialogOpen.value = true;
}

function addMsdOrderLine() {
    msdOrderForm.lines.push({ msdCode: '', itemName: '', quantity: '', unit: '', unitCost: '' });
}

function removeMsdOrderLine(index: number) {
    if (msdOrderForm.lines.length > 1) msdOrderForm.lines.splice(index, 1);
}

async function submitCreateMsdOrder() {
    if (msdOrderSubmitting.value) return;
    msdOrderSubmitting.value = true;
    msdOrderErrors.value = {};
    try {
        await apiRequest('POST', '/inventory-procurement/msd-orders', {
            body: {
                facilityMsdCode: msdOrderForm.facilityMsdCode || null,
                orderDate: msdOrderForm.orderDate,
                expectedDeliveryDate: msdOrderForm.expectedDeliveryDate || null,
                notes: msdOrderForm.notes || null,
                submitImmediately: msdOrderForm.submitImmediately,
                orderLines: msdOrderForm.lines.map(l => ({
                    msdCode: l.msdCode,
                    itemName: l.itemName,
                    quantity: Number(l.quantity),
                    unit: l.unit,
                    unitCost: l.unitCost ? Number(l.unitCost) : null,
                })),
            },
        });
        createMsdOrderDialogOpen.value = false;
        resetMsdOrderForm();
        notifySuccess('MSD order created.');
        await loadMsdOrders();
    } catch (error: any) {
        if (error?.errors) msdOrderErrors.value = error.errors;
        else notifyError(messageFromUnknown(error, 'Failed to create MSD order.'));
    } finally { msdOrderSubmitting.value = false; }
}

// ── MSD orders state (needed for SupplyChainClaimsTab compat) ──
const msdOrders = ref<any[]>([]);
const msdOrderPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const msdOrderLoading = ref(false);
const msdOrderSearch = reactive({ q: '', status: '', page: 1, perPage: 50 });
const MSD_ORDER_STATUSES = [
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted to MSD' },
    { value: 'confirmed', label: 'Confirmed by MSD' },
    { value: 'partially_fulfilled', label: 'Partially Fulfilled' },
    { value: 'dispatched', label: 'Dispatched' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' },
] as const;
const shortageMsdDraftLines = ref<any[]>([]);
const lowStockMsdDraftLines = ref<any[]>([]);

function openMsdOrderFromDraft(lines: MsdDraftLine[], sourceLabel: string): void {
    resetMsdOrderForm();
    msdOrderErrors.value = {};
    msdOrderForm.lines = lines.length > 0
        ? lines.map((line) => ({
            msdCode: line.msdCode,
            itemName: line.itemName,
            quantity: line.quantity,
            unit: line.unit,
            unitCost: line.unitCost,
        }))
        : [{ msdCode: '', itemName: '', quantity: '', unit: '', unitCost: '' }];
    msdOrderForm.notes = lines.length > 0
        ? `Draft generated from ${sourceLabel}. Review quantities, MSD codes, and submit when ready.`
        : '';
    createMsdOrderDialogOpen.value = true;
}

async function loadMsdOrders() {
    msdOrderLoading.value = true;
    try {
        const query: Record<string, string | number> = { page: msdOrderSearch.page, perPage: msdOrderSearch.perPage };
        if (msdOrderSearch.q) query.query = msdOrderSearch.q;
        if (msdOrderSearch.status) query.status = msdOrderSearch.status;
        const response = await apiRequest<{ data: any[]; meta: any }>('GET', '/inventory-procurement/msd-orders', { query });
        msdOrders.value = response.data ?? [];
        msdOrderPagination.value = response.meta ?? null;
    } catch { msdOrders.value = []; msdOrderPagination.value = null; } finally { msdOrderLoading.value = false; }
}

async function syncMsdOrderStatus(orderId: string) {
    try {
        await apiRequest('PATCH', `/inventory-procurement/msd-orders/${orderId}/sync-status`);
        notifySuccess('MSD order status synced.');
        await loadMsdOrders();
    } catch (error: any) {
        notifyError(messageFromUnknown(error, 'Failed to sync MSD order status.'));
    }
}

function msdStatusBadgeClass(status: string): string {
    switch (status) {
        case 'draft': return 'bg-muted text-muted-foreground';
        case 'submitted': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        case 'confirmed': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
        case 'partially_fulfilled': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        case 'dispatched': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
        case 'delivered': return 'bg-green-600 text-white';
        case 'rejected': return 'bg-destructive text-destructive-foreground';
        case 'cancelled': return 'bg-muted text-muted-foreground line-through';
        default: return 'bg-muted text-muted-foreground';
    }
}

// ── Permissions loading ──
async function loadPermissions() {
    const applyResolvedPermissions = (names: Iterable<string>, hasSuperAdminAccess: boolean): void => {
        const permissionSet = new Set(
            Array.from(names)
                .map((name) => String(name ?? '').trim())
                .filter((name) => name.length > 0),
        );
        canRead.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.read');
        canManageItems.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.manage-items');
        canCreateMovement.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.create-movement');
        canCreateRequest.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.create-request');
        canViewAudit.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.view-audit-logs');
    };
    applyResolvedPermissions(sharedPermissionNames.value ?? [], isFacilitySuperAdmin.value);
}

function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, options?: { query?: Record<string, any>; body?: Record<string, any>; meta?: Record<string, any> }): Promise<T> {
    return apiRequestJson<T>(method, path, { query: options?.query as any, body: options?.body, idempotencyKey: options?.meta?.idempotencyKey, requestId: options?.meta?.requestId, entitlementContext: options?.meta?.entitlementContext });
}

function formatAmount(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return 'N/A';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return String(value);
    return numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

bindSupplyChainPageApi({
    canRead, canCreateRequest, loading,
    claimLinks, claimLinkPagination, claimLinkLoading, claimLinkSearch, CLAIM_STATUSES,
    createClaimLinkDialogOpen, loadClaimLinks, claimStatusBadgeClass, formatAmount,
    formatEnumLabel, EMPTY_SELECT_VALUE, toSelectValue, fromSelectValue, formatDateTime, formatDateOnly, auditActorLabel, canViewAudit, isStoreOperations: computed(() => false),
    claimLinkForm, claimLinkErrors, claimLinkSubmitting, claimLinkPatientContextLabel,
    claimLinkPatientContextMeta, claimLinkItemContextLabel, claimLinkItemContextMeta,
    claimLinkWorkflowContextMeta, claimLinkWorkflowContextLabel, claimLinkContextStatusLabel,
    claimLinkContextStatusVariant, handleClaimLinkItemSelected, handleClaimLinkClaimsCaseSelected,
    handleClaimLinkInvoiceSelected, submitCreateClaimLink,
    analyticsLoading, loadAllAnalytics, consumptionTrends, abcVenMatrix, expiryWastage, stockTurnover,
    consumptionGranularity, consumptionDays, loadConsumptionTrends,
    msdOrders, msdOrderPagination, msdOrderLoading, msdOrderSearch, MSD_ORDER_STATUSES,
    shortageMsdDraftLines, lowStockMsdDraftLines, openMsdOrderFromDraft, openBlankMsdOrder,
    loadMsdOrders, syncMsdOrderStatus, msdStatusBadgeClass,
    createMsdOrderDialogOpen, msdOrderForm, msdOrderErrors, msdOrderSubmitting,
    addMsdOrderLine, removeMsdOrderLine, submitCreateMsdOrder,
    suppliers: ref([]), items: ref([]), itemCounts: ref({ outOfStock: 0, lowStock: 0, healthy: 0, total: 0 }),
    departments: ref([]), warehouses: ref([]), inventoryAccess,
    referenceStructureLoaded: ref(true),
    openItemDetails: () => Promise.resolve(),
    warehouseLabel: (id: string | null | undefined) => id ?? null,
    supplierLabel: (id: string | null | undefined) => id ?? null,
    lookupOptionText: (option: any) => option ? (option.code ? `${option.name} (${option.code})` : option.name) : '',
});

onBeforeUnmount(() => { clearSupplyChainPageApi(); });

watch(() => activeTab.value, () => { syncReviewStateToUrl(); });
watch(() => [claimLinkSearch.q, claimLinkSearch.claimStatus, claimLinkSearch.page, claimLinkSearch.perPage], () => {
    syncReviewStateToUrl();
});
watch(() => [consumptionGranularity.value, consumptionDays.value], () => {
    syncReviewStateToUrl();
});

onMounted(async () => {
    hydrateReviewStateFromUrl();
    await loadPermissions();
    await Promise.allSettled([loadClaimLinks(), loadAllAnalytics()]);
    loading.value = false;
});
</script>

<template>
    <Head title="Review" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="shield-check" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">Review</h1>
                                <Badge v-if="permissionsResolved && !canRead" variant="outline" class="h-5 px-1.5 text-[10px] font-medium">
                                    View only
                                </Badge>
                            </div>
                            <p class="truncate text-xs text-muted-foreground">Dispensing claim links and inventory analytics</p>
                            <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground">
                                <span class="inline-flex items-center gap-1">
                                    <AppIcon name="building-2" class="size-3 opacity-75" aria-hidden="true" />
                                    <span class="font-medium text-foreground">{{ platformScope?.facility?.name || 'No facility' }}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            class="h-8 w-8 p-0"
                            :disabled="loading"
                            title="Refresh"
                            @click="refreshActiveTab()"
                        >
                            <AppIcon :name="(loading ? 'loader-circle' : 'refresh-cw') as AppIconName" class="size-3.5" :class="loading ? 'animate-spin' : ''" />
                        </Button>
                        <Button v-for="action in headerActions" :key="action.key" :size="'sm'" :variant="action.variant ?? 'outline'" class="h-8 gap-1.5" @click="action.onClick?.()">
                            <AppIcon :name="action.icon as AppIconName" class="size-3.5" />
                            <span>{{ action.label }}</span>
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                                    <AppIcon name="ellipsis-vertical" class="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" class="w-48">
                                <DropdownMenuItem as-child>
                                    <Link href="/inventory-procurement/stock-control" class="gap-2">
                                        <AppIcon name="package" class="size-4" /> Stock Control
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem as-child>
                                    <Link href="/inventory-procurement/procurement" class="gap-2">
                                        <AppIcon name="clipboard-list" class="size-4" /> Procurement
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem as-child>
                                    <Link href="/inventory-procurement/requests-fulfilment" class="gap-2">
                                        <AppIcon name="activity" class="size-4" /> Requests &amp; Fulfilment
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </section>

            <SupplyChainPageBootstrapSkeleton v-if="showBootstrapSkeleton" :tab-count="2" :summary-count="3" :row-count="3" />

            <Alert v-else-if="!canRead" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="alert-triangle" class="size-4" />
                    Access denied
                </AlertTitle>
                <AlertDescription>You do not have `inventory-procurement.read` permission, so this page cannot load the review data.</AlertDescription>
            </Alert>

            <template v-else>
                <Card class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                    <Tabs :model-value="activeTab" :unmount-on-hide="false" class="flex h-full min-h-0 flex-col" @update:model-value="(v) => { activeTab = v as ReviewTab; }">
                        <div class="flex flex-col gap-3 border-b px-4 py-3">
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div class="min-w-0 shrink-0">
                                    <h3 class="flex items-center gap-2 text-sm font-semibold leading-none whitespace-nowrap">
                                        <AppIcon :name="activeTab === 'claims' ? 'receipt' : 'bar-chart-3'" class="size-4 text-primary" />
                                        {{ activeTab === 'claims' ? 'Dispensing Claim Links' : 'Inventory Analytics' }}
                                    </h3>
                                    <p class="mt-1 text-xs text-muted-foreground">
                                        {{ activeTab === 'claims' ? 'Connect dispensed stock to payer claims, NHIF references, and reimbursement.' : 'Consumption trends, ABC/VEN matrix, expiry risk, and stock turnover.' }}
                                    </p>
                                </div>
                                <div class="flex min-w-0 items-center gap-2">
                                    <template v-if="activeTab === 'claims'">
                                        <div class="relative min-w-0 flex-1 lg:flex-none">
                                            <AppIcon name="search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                            <input
                                                v-model="claimLinkSearch.q"
                                                class="h-8 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-72"
                                                placeholder="Search NHIF code, payer..."
                                                @keydown.enter="claimLinkSearch.page = 1; loadClaimLinks()"
                                            />
                                        </div>
                                    </template>
                                    <Popover>
                                        <PopoverTrigger as-child>
                                            <Button variant="outline" size="sm" class="h-8 gap-1.5 rounded-lg text-xs shrink-0">
                                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                Filters
                                                <Badge v-if="reviewFilterCount > 0" variant="secondary" class="ml-1 h-5 px-1.5 text-[10px]">{{ reviewFilterCount }}</Badge>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent align="end" class="z-50 w-80 space-y-3">
                                            <template v-if="activeTab === 'claims'">
                                                <div class="grid gap-2">
                                                    <Label>Status</Label>
                                                    <Select :model-value="toSelectValue(claimLinkSearch.claimStatus)" @update:model-value="claimLinkSearch.claimStatus = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                                        <SelectTrigger class="w-full"><SelectValue placeholder="All statuses" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem :value="EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                                            <SelectItem v-for="option in CLAIM_STATUSES" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </template>
                                            <template v-else>
                                                <div class="grid gap-2">
                                                    <Label>Granularity</Label>
                                                    <Select :model-value="consumptionGranularity" @update:model-value="consumptionGranularity = String($event)">
                                                        <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="daily">Daily</SelectItem>
                                                            <SelectItem value="weekly">Weekly</SelectItem>
                                                            <SelectItem value="monthly">Monthly</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label>Period</Label>
                                                    <Select :model-value="String(consumptionDays)" @update:model-value="consumptionDays = Number($event)">
                                                        <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="7">7 days</SelectItem>
                                                            <SelectItem value="30">30 days</SelectItem>
                                                            <SelectItem value="90">90 days</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </template>
                                            <div class="flex gap-2 pt-1">
                                                <Button size="sm" variant="outline" class="flex-1 gap-1.5" @click="resetReviewFilters">Reset</Button>
                                                <Button size="sm" class="flex-1 gap-1.5" @click="applyReviewFilters">Apply</Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            <TabsList class="grid h-9 w-full grid-cols-2 gap-1 bg-muted/40 p-1">
                                <TabsTrigger value="claims" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <span class="flex items-center gap-1 leading-none">
                                        <AppIcon name="shield-check" class="size-3" />
                                        Claims
                                    </span>
                                </TabsTrigger>
                                <TabsTrigger value="analytics" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <span class="flex items-center gap-1 leading-none">
                                        <AppIcon name="activity" class="size-3" />
                                        Analytics
                                    </span>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <TabsContent value="claims" class="m-0 flex min-h-0 flex-1 flex-col">
                                <SupplyChainClaimsTab />
                            </TabsContent>
                            <TabsContent value="analytics" class="m-0 flex min-h-0 flex-1 flex-col">
                                <SupplyChainAnalyticsTab />
                            </TabsContent>
                        </div>
                    </Tabs>
                </Card>
            </template>
        </div>
    </AppLayout>

    <SupplyChainClaimsAndMsdSheets />
</template>



