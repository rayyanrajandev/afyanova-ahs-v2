<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, ref, nextTick, onBeforeUnmount, onMounted, reactive, watch, type Ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input, SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import LeaveWorkflowDialog from '@/components/workflow/LeaveWorkflowDialog.vue';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePendingWorkflowLeaveGuard } from '@/composables/usePendingWorkflowLeaveGuard';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useUrlQueryState } from '@/composables/useUrlQueryState';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGetBlob, apiRequestJson } from '@/lib/apiClient';
import type { AppIconName } from '@/lib/icons';
import { generateRequestKey } from '@/lib/idempotency';
import { INVENTORY_PROCUREMENT_HOME_PATH } from '@/lib/inventoryProcurement';
import { isInventoryDepartmentRequester, isInventoryStoreOperations, type InventoryProcurementAccess } from '@/lib/inventoryProcurementAccess';
import { formatEnumLabel } from '@/lib/labels';
import { procurementRequestStripeClass } from '@/lib/listRows';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import SupplyChainAuxiliarySheets from '@/pages/inventory-procurement/components/SupplyChainAuxiliarySheets.vue';
import SupplyChainClaimsAndMsdSheets from '@/pages/inventory-procurement/components/SupplyChainClaimsAndMsdSheets.vue';
import SupplyChainFilterOverlays from '@/pages/inventory-procurement/components/SupplyChainFilterOverlays.vue';
import SupplyChainFilterPopover from '@/pages/inventory-procurement/components/SupplyChainFilterPopover.vue';
import SupplyChainInventoryOpsSheets from '@/pages/inventory-procurement/components/SupplyChainInventoryOpsSheets.vue';
import SupplyChainItemDetailsSheet from '@/pages/inventory-procurement/components/SupplyChainItemDetailsSheet.vue';
import SupplyChainProcurementLifecycleSheets from '@/pages/inventory-procurement/components/SupplyChainProcurementLifecycleSheets.vue';
import SupplyChainRequestEntrySheets from '@/pages/inventory-procurement/components/SupplyChainRequestEntrySheets.vue';
import { EMPTY_SELECT_VALUE, fromSelectValue, toSelectValue, formatDateTime, formatDateOnly, auditActorLabel } from '@/pages/inventory-procurement/constants';
import { bindSupplyChainPageApi } from '@/pages/inventory-procurement/registerSupplyChainPageApi';
import { clearSupplyChainPageApi } from '@/pages/inventory-procurement/supplyChainPageApi';
import {
    SupplyChainLeadTimesTab,
    SupplyChainMsdOrdersTab,
    SupplyChainProcurementTab,
} from '@/pages/inventory-procurement/supplyChainTabComponents';
import { type BreadcrumbItem } from '@/types';

type ApiError = Error & { payload?: { message?: string; errors?: Record<string, string[]> } };
type StockMovementLookupItem = { id: string; itemCode?: string | null; itemName?: string | null; genericName?: string | null; category?: string | null; subcategory?: string | null; unit?: string | null; currentStock?: number | string | null; reorderLevel?: number | string | null; movementCount?: number | string | null; status?: string | null; stockState?: string | null };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Supply chain', href: INVENTORY_PROCUREMENT_HOME_PATH },
    { title: 'Procurement', href: '/inventory-procurement/procurement' },
];

type ProcurementTab = 'procurement' | 'msd-orders' | 'lead-times';
const procurementTabs: ProcurementTab[] = ['procurement', 'msd-orders', 'lead-times'];

const { permissionNames: sharedPermissionNames, isFacilitySuperAdmin, hasPermission, permissionState, scope: platformScope } = usePlatformAccess();
const permissionsResolved = computed(() => sharedPermissionNames.value !== null);

const canRead = ref(false);
const canManageItems = ref(false);
const canCreateMovement = ref(false);
const canCreateRequest = ref(false);
const canUpdateRequestStatus = ref(false);
const canViewAudit = ref(false);
const canApproveRequisitions = ref(false);
const canManageSuppliers = ref(false);
const canManageWarehouses = ref(false);

const inventoryAccess = computed<InventoryProcurementAccess>(() => ({
    canRead: canRead.value, canManageItems: canManageItems.value, canCreateMovement: canCreateMovement.value,
    canSetOpeningStock: false, canReconcileStock: false, canCreateRequest: canCreateRequest.value,
    canUpdateRequestStatus: canUpdateRequestStatus.value, canViewAudit: canViewAudit.value,
    canApproveRequisitions: canApproveRequisitions.value, canManageSuppliers: canManageSuppliers.value,
    canManageWarehouses: canManageWarehouses.value,
}));

const isStoreOperations = computed(() => isInventoryStoreOperations(inventoryAccess.value));
const canReadDepartments = computed(() => isFacilitySuperAdmin.value || hasPermission('departments.read'));
const activeTab = ref<ProcurementTab>('procurement');
const loading = ref(true);

const procurementRequests = ref<any[]>([]);
const procurementPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const procurementSearch = reactive({ q: '', status: '', sortBy: 'createdAt', sortDir: 'desc', page: 1, perPage: 50 });
const procurementExporting = ref(false);

function triggerBlobDownload(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
}

async function exportProcurementRequestsCsv(): Promise<void> {
    if (procurementExporting.value) return;
    procurementExporting.value = true;
    try {
        const { blob, filename } = await apiGetBlob('/inventory-procurement/procurement-requests/export', {
            query: {
                q: procurementSearch.q || undefined,
                status: procurementSearch.status || undefined,
                sortBy: procurementSearch.sortBy,
                sortDir: procurementSearch.sortDir,
            },
            entitlementContext: 'Procurement requests export',
        });
        triggerBlobDownload(blob, filename ?? 'procurement-requests.csv');
        notifySuccess('Procurement requests exported.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to export procurement requests.'));
    } finally {
        procurementExporting.value = false;
    }
}

const msdOrders = ref<any[]>([]);
const msdOrderPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const msdOrderSearch = reactive({ q: '', status: '', page: 1, perPage: 50 });
const msdOrderLoading = ref(false);

const leadTimes = ref<any[]>([]);
const leadTimePagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const leadTimeSearch = reactive({ supplierId: '', page: 1, perPage: 15 });
const leadTimeLoading = ref(false);
const suppliers = ref<{ id: string; name: string; code: string | null }[]>([]);
const supplierPerformance = ref<any>(null);
const procurementUrlStateHydrated = ref(false);
const { setQueryParam, replaceUrlQuery } = useUrlQueryState();

function hydrateProcurementStateFromUrl(): void {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    const tab = (params.get('tab') ?? '').trim().toLowerCase();
    const section = (params.get('section') ?? '').trim().toLowerCase();

    if (procurementTabs.includes(tab as ProcurementTab)) {
        activeTab.value = tab as ProcurementTab;
    } else if (procurementTabs.includes(section as ProcurementTab)) {
        activeTab.value = section as ProcurementTab;
    }

    if (activeTab.value === 'procurement') {
        procurementSearch.q = params.get('q')?.trim() ?? '';
        procurementSearch.status = params.get('status')?.trim() ?? '';
        procurementSearch.sortBy = params.get('sortBy')?.trim() || 'createdAt';
        procurementSearch.sortDir = params.get('sortDir')?.trim() || 'desc';
        procurementSearch.page = Number.isFinite(Number(params.get('page') ?? '')) && Number(params.get('page')) > 0
            ? Number(params.get('page'))
            : 1;
        procurementSearch.perPage = Number.isFinite(Number(params.get('perPage') ?? '')) && Number(params.get('perPage')) > 0
            ? Number(params.get('perPage'))
            : 50;
    }

    if (activeTab.value === 'msd-orders') {
        msdOrderSearch.q = params.get('q')?.trim() ?? '';
        msdOrderSearch.status = params.get('status')?.trim() ?? '';
        msdOrderSearch.page = Number.isFinite(Number(params.get('page') ?? '')) && Number(params.get('page')) > 0
            ? Number(params.get('page'))
            : 1;
        msdOrderSearch.perPage = Number.isFinite(Number(params.get('perPage') ?? '')) && Number(params.get('perPage')) > 0
            ? Number(params.get('perPage'))
            : 50;
    }

    if (activeTab.value === 'lead-times') {
        leadTimeSearch.supplierId = params.get('supplierId')?.trim() ?? '';
        leadTimeSearch.page = Number.isFinite(Number(params.get('page') ?? '')) && Number(params.get('page')) > 0
            ? Number(params.get('page'))
            : 1;
        leadTimeSearch.perPage = Number.isFinite(Number(params.get('perPage') ?? '')) && Number(params.get('perPage')) > 0
            ? Number(params.get('perPage'))
            : 15;
    }

    procurementUrlStateHydrated.value = true;
}

function syncProcurementStateToUrl(): void {
    if (!procurementUrlStateHydrated.value || typeof window === 'undefined') return;

    replaceUrlQuery((params) => {
        params.delete('section');
        setQueryParam(params, 'tab', activeTab.value);

        const allStateKeys = ['q', 'status', 'sortBy', 'sortDir', 'page', 'perPage', 'supplierId'];
        for (const key of allStateKeys) params.delete(key);

        if (activeTab.value === 'procurement') {
            setQueryParam(params, 'q', procurementSearch.q);
            setQueryParam(params, 'status', procurementSearch.status);
            if (procurementSearch.sortBy !== 'createdAt') setQueryParam(params, 'sortBy', procurementSearch.sortBy);
            if (procurementSearch.sortDir !== 'desc') setQueryParam(params, 'sortDir', procurementSearch.sortDir);
            if (procurementSearch.page > 1) setQueryParam(params, 'page', procurementSearch.page);
            if (procurementSearch.perPage !== 50) setQueryParam(params, 'perPage', procurementSearch.perPage);
        }

        if (activeTab.value === 'msd-orders') {
            setQueryParam(params, 'q', msdOrderSearch.q);
            setQueryParam(params, 'status', msdOrderSearch.status);
            if (msdOrderSearch.page > 1) setQueryParam(params, 'page', msdOrderSearch.page);
            if (msdOrderSearch.perPage !== 50) setQueryParam(params, 'perPage', msdOrderSearch.perPage);
        }

        if (activeTab.value === 'lead-times') {
            setQueryParam(params, 'supplierId', leadTimeSearch.supplierId);
            if (leadTimeSearch.page > 1) setQueryParam(params, 'page', leadTimeSearch.page);
            if (leadTimeSearch.perPage !== 15) setQueryParam(params, 'perPage', leadTimeSearch.perPage);
        }
    });
}

type LookupOption = { id: string; name: string; code: string | null };
const warehouses = ref<LookupOption[]>([]);
const departments = ref<LookupOption[]>([]);
const items = ref<any[]>([]);
const itemCounts = ref({ outOfStock: 0, lowStock: 0, healthy: 0, total: 0 });

const inventoryItemRequestingDepartmentId = ref<string | null>(null);
const referenceStructureLoaded = ref(false);
const supplierReady = computed(() => suppliers.value.length > 0);
const warehouseReady = computed(() => warehouses.value.length > 0);

const procurementSetupBlockedReason = computed(() => {
    if (loading.value) return 'Loading inventory data...';
    if (!referenceStructureLoaded.value) return 'Loading reference data...';
    if (!warehouseReady.value || !supplierReady.value) return 'Create at least one warehouse and one supplier first.';
    if (itemCounts.value.total <= 0) return 'Create the first inventory item before opening procurement requests.';
    return null;
});
const canLaunchProcurementRequest = computed(() => canCreateRequest.value && !procurementSetupBlockedReason.value);

const compactProcurementRows = useLocalStorageBoolean('inventory.procurement.procurement.compact', false);

interface HeaderAction {
    key: string; label: string; icon: string; variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
    show: boolean; disabled?: boolean; loading?: boolean; iconOnly?: boolean; onClick?: () => void; class?: string;
}
const headerActions = computed<HeaderAction[]>(() => {
    const actions: HeaderAction[] = [];
    if (activeTab.value === 'procurement') {
        actions.push({ key: 'new-request', label: 'New Request', icon: 'plus', variant: 'default', show: canCreateRequest.value, disabled: !canLaunchProcurementRequest.value, onClick: () => openCreateProcurementDialog() });
    } else if (activeTab.value === 'msd-orders') {
        actions.push({ key: 'blank-msd-order', label: 'Blank Order', icon: 'plus', variant: 'default', show: true, onClick: () => openBlankMsdOrder() });
    } else if (activeTab.value === 'lead-times') {
        actions.push({ key: 'record-lead-time', label: 'Record Order', icon: 'plus', variant: 'default', show: true, onClick: () => { createLeadTimeDialogOpen.value = true; } });
    }
    actions.push({
        key: 'export', label: 'Export', icon: 'download', variant: 'outline', show: activeTab.value === 'procurement',
        disabled: procurementExporting.value, loading: procurementExporting.value,
        onClick: () => { void exportProcurementRequestsCsv(); },
    });
    actions.push({ key: 'print', label: 'Print', icon: 'printer', variant: 'outline', show: true, onClick: () => handlePrint() });
    return actions.filter((action) => action.show);
});

// ── Procurement request dialogs ──
const createProcurementDialogOpen = ref(false);
const procurementDiscardConfirmOpen = ref(false);
const procurementSubmitting = ref(false);
const procurementErrors = ref<Record<string, string[]>>({});
const procurementRequestError = ref<string | null>(null);
const procurementRequestKey = ref(generateRequestKey('inventory-procurement-request-create'));
const procurementForm = reactive({
    itemId: '', itemName: '', category: '', unit: '', reorderLevel: '', requestedQuantity: '',
    unitCostEstimate: '', neededBy: '', supplierId: '', sourceDepartmentRequisitionId: '',
    sourceDepartmentRequisitionLineId: '', sourceSummary: '', notes: '',
});
const selectedProcurementItem = ref<StockMovementLookupItem | null>(null);
const procurementUsesExistingItem = computed(() => procurementForm.itemId.trim().length > 0);
const procurementLockedToSource = computed(() => procurementForm.sourceDepartmentRequisitionLineId.trim().length > 0);
// requestedQuantity binds to a native type="number" <Input>, which Vue's compiler auto-casts
// to a Number on v-model even without an explicit .number modifier -- .trim() only exists on
// strings, so calling it here threw the instant a user typed a quantity, silently aborting the
// click on submitProcurementRequest below before it ever ran (the button just appeared to do
// nothing). Coerce to String first so this works whether the value is a string or number.
const procurementSubmitDisabled = computed(() => procurementSubmitting.value || !procurementForm.itemId.trim() || !String(procurementForm.requestedQuantity ?? '').trim() || Number(procurementForm.requestedQuantity) <= 0);
const activeRequests = ref<Record<string, any>[]>([]);
const activeRequestsForItem = computed(() => {
    if (!procurementForm.itemId.trim()) return [];
    return activeRequests.value.filter((req) => req.itemId === procurementForm.itemId);
});

function resetProcurementForm() {
    selectedProcurementItem.value = null; procurementForm.itemId = ''; procurementForm.itemName = '';
    procurementForm.category = ''; procurementForm.unit = ''; procurementForm.reorderLevel = '';
    procurementForm.requestedQuantity = ''; procurementForm.unitCostEstimate = ''; procurementForm.neededBy = '';
    procurementForm.supplierId = ''; procurementForm.sourceDepartmentRequisitionId = '';
    procurementForm.sourceDepartmentRequisitionLineId = ''; procurementForm.sourceSummary = ''; procurementForm.notes = '';
}

function openCreateProcurementDialog() {
    if (procurementSetupBlockedReason.value) { notifyError(procurementSetupBlockedReason.value); return; }
    procurementErrors.value = {}; procurementRequestError.value = null; resetProcurementForm(); rotateProcurementRequestKey();
    createProcurementDialogOpen.value = true;
}

function closeCreateProcurementDialog(): void {
    createProcurementDialogOpen.value = false; procurementDiscardConfirmOpen.value = false;
    procurementErrors.value = {}; procurementRequestError.value = null; resetProcurementForm(); rotateProcurementRequestKey();
}

function handleProcurementDialogOpenChange(open: boolean): void {
    if (open) { createProcurementDialogOpen.value = true; return; }
    if (procurementSubmitting.value) return; closeCreateProcurementDialog();
}

async function submitProcurementRequest(): Promise<void> {
    if (procurementSubmitDisabled.value) return;
    procurementSubmitting.value = true;
    procurementErrors.value = {};
    procurementRequestError.value = null;
    try {
        // itemName/category/unit/reorderLevel are display-only (auto-filled from the picked
        // item) -- StoreInventoryProcurementRequestRequest marks them `prohibited` and derives
        // them server-side from itemId, so they're deliberately omitted here.
        await apiRequest('POST', '/inventory-procurement/procurement-requests', {
            body: {
                itemId: procurementForm.itemId,
                requestedQuantity: procurementForm.requestedQuantity,
                unitCostEstimate: procurementForm.unitCostEstimate || null,
                neededBy: procurementForm.neededBy || null,
                supplierId: procurementForm.supplierId || null,
                sourceDepartmentRequisitionId: procurementForm.sourceDepartmentRequisitionId || null,
                sourceDepartmentRequisitionLineId: procurementForm.sourceDepartmentRequisitionLineId || null,
                notes: procurementForm.notes.trim() || null,
            },
            meta: {
                idempotencyKey: procurementRequestKey.value,
                requestId: procurementRequestKey.value,
                entitlementContext: 'Procurement request create',
            },
        });
        notifySuccess('Procurement request created.');
        closeCreateProcurementDialog();
        await loadProcurementRequests();
        await loadActiveProcurementRequests();
    } catch (error) {
        procurementErrors.value = (error as ApiError).payload?.errors ?? {};
        procurementRequestError.value = messageFromUnknown(error, 'Unable to create procurement request.');
        notifyError(procurementRequestError.value);
    } finally {
        procurementSubmitting.value = false;
    }
}

function handleProcurementItemSelected(item: StockMovementLookupItem | null): void {
    selectedProcurementItem.value = item;
    if (!item) { procurementForm.itemName = ''; procurementForm.category = ''; procurementForm.unit = ''; procurementForm.reorderLevel = ''; if (!procurementLockedToSource.value) procurementForm.supplierId = ''; return; }
    procurementForm.itemName = String(item.itemName ?? ''); procurementForm.category = String(item.category ?? '');
    procurementForm.unit = String(item.unit ?? ''); procurementForm.reorderLevel = item.reorderLevel != null ? String(item.reorderLevel) : '';
    const masterItem = items.value.find((entry) => entry.id === item.id) ?? null;
    if (masterItem?.defaultSupplierId) procurementForm.supplierId = masterItem.defaultSupplierId;
}

function rotateProcurementRequestKey(): void { procurementRequestKey.value = generateRequestKey('inventory-procurement-request-create'); }

// ── Procurement lifecycle ──
const placeOrderDialogOpen = ref(false);
const placeOrderRequest = ref<any>(null);
const placeOrderForm = reactive({ purchaseOrderNumber: '', orderedQuantity: '', unitCostEstimate: '', neededBy: '', supplierId: '', notes: '' });
const placeOrderErrors = ref<Record<string, string[]>>({});
const placeOrderError = ref<string | null>(null);
const placeOrderSubmitting = ref(false);

const receiveDialogOpen = ref(false);
const receiveRequest = ref<any>(null);
const receiveForm = reactive({ receivedQuantity: '', receivedUnitCost: '', warehouseId: '', batchNumber: '', lotNumber: '', manufactureDate: '', expiryDate: '', binLocation: '', reason: '', notes: '', occurredAt: '' });
const receiveErrors = ref<Record<string, string[]>>({});
const receiveError = ref<string | null>(null);
const receiveSubmitting = ref(false);

const statusDialogOpen = ref(false);
const statusRequest = ref<any>(null);
const statusValue = ref('');
const statusReason = ref('');
const statusError = ref<string | null>(null);
const statusSubmitting = ref(false);

const detailsOpen = ref(false);
const detailsRequest = ref<any>(null);
const detailsAuditLogs = ref<any[]>([]);
const detailsAuditLoading = ref(false);
const detailsAuditExporting = ref(false);
const detailsAuditError = ref<string | null>(null);
const detailsAuditMeta = ref<{ currentPage: number; lastPage: number; total: number; perPage: number } | null>(null);
const detailsAuditFilters = reactive({ q: '', action: '', actorType: '', actorId: '', from: '', to: '', page: 1, perPage: 20 });

async function loadDetailsAuditLogs(): Promise<void> {
    if (!detailsRequest.value?.id || !canViewAudit.value) return;
    detailsAuditLoading.value = true;
    detailsAuditError.value = null;
    try {
        const response = await apiRequest<{ data: any[]; meta: { currentPage: number; lastPage: number; total: number; perPage: number } }>(
            'GET',
            `/inventory-procurement/procurement-requests/${detailsRequest.value.id}/audit-logs`,
            {
                query: {
                    q: detailsAuditFilters.q || undefined,
                    action: detailsAuditFilters.action || undefined,
                    actorType: detailsAuditFilters.actorType || undefined,
                    actorId: detailsAuditFilters.actorId || undefined,
                    from: detailsAuditFilters.from || undefined,
                    to: detailsAuditFilters.to || undefined,
                    page: detailsAuditFilters.page,
                    perPage: detailsAuditFilters.perPage,
                },
            },
        );
        detailsAuditLogs.value = response.data ?? [];
        detailsAuditMeta.value = response.meta ?? null;
    } catch (error) {
        detailsAuditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
    } finally {
        detailsAuditLoading.value = false;
    }
}

function applyDetailsAuditFilters(): void {
    detailsAuditFilters.page = 1;
    void loadDetailsAuditLogs();
}

function resetDetailsAuditFilters(): void {
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    void loadDetailsAuditLogs();
}

function goToDetailsAuditPage(page: number): void {
    if (page < 1 || (detailsAuditMeta.value && page > detailsAuditMeta.value.lastPage)) return;
    detailsAuditFilters.page = page;
    void loadDetailsAuditLogs();
}

async function exportDetailsAuditLogsCsv(): Promise<void> {
    if (!detailsRequest.value?.id || detailsAuditExporting.value) return;
    detailsAuditExporting.value = true;
    try {
        const { blob, filename } = await apiGetBlob(`/inventory-procurement/procurement-requests/${detailsRequest.value.id}/audit-logs/export`, {
            query: {
                q: detailsAuditFilters.q || undefined,
                action: detailsAuditFilters.action || undefined,
                actorType: detailsAuditFilters.actorType || undefined,
                actorId: detailsAuditFilters.actorId || undefined,
                from: detailsAuditFilters.from || undefined,
                to: detailsAuditFilters.to || undefined,
            },
            entitlementContext: 'Procurement request audit log export',
        });
        triggerBlobDownload(blob, filename ?? `procurement-request-audit-${detailsRequest.value.id}.csv`);
        notifySuccess('Audit logs exported.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to export audit logs.'));
    } finally {
        detailsAuditExporting.value = false;
    }
}

function openDetails(request: any): void {
    detailsRequest.value = request;
    detailsOpen.value = true;
    detailsAuditLogs.value = [];
    detailsAuditMeta.value = null;
    detailsAuditError.value = null;
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    void loadDetailsAuditLogs();
}
function openStatusDialog(request: any, status: string): void { statusRequest.value = request; statusValue.value = status; statusReason.value = ''; statusError.value = null; statusDialogOpen.value = true; }
function openPlaceOrderDialog(request: any): void { placeOrderRequest.value = request; placeOrderError.value = null; placeOrderErrors.value = {}; placeOrderDialogOpen.value = true; }
function openReceiveDialog(request: any): void { receiveRequest.value = request; receiveError.value = null; receiveErrors.value = {}; receiveDialogOpen.value = true; }
async function submitStatusUpdate(): Promise<void> {
    if (!statusRequest.value || statusSubmitting.value) return;
    statusSubmitting.value = true;
    statusError.value = null;
    try {
        await apiRequest('PATCH', `/inventory-procurement/procurement-requests/${statusRequest.value.id}/status`, {
            body: { status: statusValue.value, reason: statusReason.value.trim() || null },
        });
        notifySuccess(`Procurement request set to ${formatEnumLabel(statusValue.value)}.`);
        flashRequest(statusRequest.value.id);
        statusDialogOpen.value = false;
        await loadProcurementRequests();
        await loadActiveProcurementRequests();
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update procurement request status.');
        notifyError(statusError.value);
    } finally {
        statusSubmitting.value = false;
    }
}

async function submitPlaceOrder(): Promise<void> {
    if (!placeOrderRequest.value || placeOrderSubmitting.value) return;
    placeOrderSubmitting.value = true;
    placeOrderError.value = null;
    placeOrderErrors.value = {};
    try {
        await apiRequest('POST', `/inventory-procurement/procurement-requests/${placeOrderRequest.value.id}/place-order`, {
            body: {
                purchaseOrderNumber: placeOrderForm.purchaseOrderNumber.trim(),
                orderedQuantity: placeOrderForm.orderedQuantity,
                unitCostEstimate: placeOrderForm.unitCostEstimate || null,
                neededBy: placeOrderForm.neededBy || null,
                supplierId: placeOrderForm.supplierId || null,
                notes: placeOrderForm.notes.trim() || null,
            },
        });
        notifySuccess('Purchase order recorded.');
        flashRequest(placeOrderRequest.value.id);
        placeOrderDialogOpen.value = false;
        await loadProcurementRequests();
        await loadActiveProcurementRequests();
    } catch (error) {
        placeOrderErrors.value = (error as ApiError).payload?.errors ?? {};
        placeOrderError.value = messageFromUnknown(error, 'Unable to place order.');
        notifyError(placeOrderError.value);
    } finally {
        placeOrderSubmitting.value = false;
    }
}

async function submitReceiveGoods(): Promise<void> {
    if (!receiveRequest.value || receiveSubmitting.value) return;
    receiveSubmitting.value = true;
    receiveError.value = null;
    receiveErrors.value = {};
    try {
        await apiRequest('POST', `/inventory-procurement/procurement-requests/${receiveRequest.value.id}/receive`, {
            body: {
                receivedQuantity: receiveForm.receivedQuantity,
                receivedUnitCost: receiveForm.receivedUnitCost || null,
                receivedUnit: (receiveForm as any).receivedUnit || null,
                warehouseId: receiveForm.warehouseId || null,
                batchNumber: receiveForm.batchNumber.trim() || null,
                lotNumber: receiveForm.lotNumber.trim() || null,
                manufactureDate: receiveForm.manufactureDate || null,
                expiryDate: receiveForm.expiryDate || null,
                binLocation: receiveForm.binLocation.trim() || null,
                reason: receiveForm.reason.trim() || null,
                notes: receiveForm.notes.trim() || null,
                occurredAt: receiveForm.occurredAt || null,
            },
        });
        notifySuccess('Goods receipt recorded.');
        flashRequest(receiveRequest.value.id);
        receiveDialogOpen.value = false;
        await loadProcurementRequests();
        await loadActiveProcurementRequests();
    } catch (error) {
        receiveErrors.value = (error as ApiError).payload?.errors ?? {};
        receiveError.value = messageFromUnknown(error, 'Unable to record goods receipt.');
        notifyError(receiveError.value);
    } finally {
        receiveSubmitting.value = false;
    }
}

function openProcurementFromShortage(req: any | null, line: any): void {}
function openProcurementFromRequisitionShortage(line: any): void {}
function openProcurementFromQueueShortage(req: any, line: any): void {}

// ── MSD Orders ──
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
const shortageQueueReplenishmentBanner = ref<{ itemId: string | null; pendingLineCount: number } | null>(null);
function openMsdOrderFromDraft(lines: any[], sourceLabel?: string): void {
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
    msdOrderForm.notes = lines.length > 0 && sourceLabel
        ? `Draft generated from ${sourceLabel}. Review quantities, MSD codes, and submit when ready.`
        : '';
    createMsdOrderDialogOpen.value = true;
}
function openBlankMsdOrder(): void {
    resetMsdOrderForm();
    msdOrderErrors.value = {};
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

function resetMsdOrderForm() {
    msdOrderForm.facilityMsdCode = ''; msdOrderForm.orderDate = ''; msdOrderForm.expectedDeliveryDate = '';
    msdOrderForm.notes = ''; msdOrderForm.submitImmediately = false;
    msdOrderForm.lines = [{ msdCode: '', itemName: '', quantity: '', unit: '', unitCost: '' }];
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

// ── Lead Times ──
const createLeadTimeDialogOpen = ref(false);
const leadTimeForm = reactive({
    supplierId: '',
    itemId: '',
    orderDate: '',
    expectedDeliveryDate: '',
    quantityOrdered: '',
    notes: '',
});
const leadTimeErrors = ref<Record<string, string[]>>({});
const leadTimeSubmitting = ref(false);
function resetLeadTimeForm() {
    leadTimeForm.supplierId = '';
    leadTimeForm.itemId = '';
    leadTimeForm.orderDate = '';
    leadTimeForm.expectedDeliveryDate = '';
    leadTimeForm.quantityOrdered = '';
    leadTimeForm.notes = '';
}

async function submitCreateLeadTime() {
    if (leadTimeSubmitting.value) return;
    leadTimeSubmitting.value = true;
    leadTimeErrors.value = {};
    try {
        await apiRequest('POST', '/inventory-procurement/supplier-lead-times', {
            body: {
                supplierId: leadTimeForm.supplierId,
                itemId: leadTimeForm.itemId || null,
                orderDate: leadTimeForm.orderDate,
                expectedDeliveryDate: leadTimeForm.expectedDeliveryDate || null,
                quantityOrdered: leadTimeForm.quantityOrdered ? Number(leadTimeForm.quantityOrdered) : null,
                notes: leadTimeForm.notes || null,
            },
        });
        createLeadTimeDialogOpen.value = false;
        resetLeadTimeForm();
        notifySuccess('Lead time record created.');
        if (leadTimeSearch.supplierId) { await loadLeadTimes(); }
    } catch (error: any) {
        if (error?.errors) leadTimeErrors.value = error.errors;
        else notifyError(messageFromUnknown(error, 'Failed to create lead time record.'));
    } finally { leadTimeSubmitting.value = false; }
}
const recordDeliveryDialogOpen = ref(false);
const deliveryForm = reactive({ leadTimeId: '', actualDeliveryDate: '', quantityReceived: '' });
const deliveryErrors = ref<Record<string, string[]>>({});
const deliverySubmitting = ref(false);
async function submitRecordDelivery() {
    if (deliverySubmitting.value) return;
    deliverySubmitting.value = true;
    deliveryErrors.value = {};
    try {
        await apiRequest('PATCH', `/inventory-procurement/supplier-lead-times/${deliveryForm.leadTimeId}/delivery`, {
            body: {
                actualDeliveryDate: deliveryForm.actualDeliveryDate,
                quantityReceived: deliveryForm.quantityReceived ? Number(deliveryForm.quantityReceived) : null,
            },
        });
        recordDeliveryDialogOpen.value = false;
        deliveryForm.leadTimeId = '';
        deliveryForm.actualDeliveryDate = '';
        deliveryForm.quantityReceived = '';
        notifySuccess('Delivery recorded.');
        if (leadTimeSearch.supplierId) { await loadLeadTimes(); }
    } catch (error: any) {
        if (error?.errors) deliveryErrors.value = error.errors;
        else notifyError(messageFromUnknown(error, 'Failed to record delivery.'));
    } finally { deliverySubmitting.value = false; }
}
function deliveryStatusBadge(status: string): string {
    switch (status) {
        case 'on_time': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        case 'late': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        case 'partial': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        case 'pending': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        case 'cancelled': return 'bg-muted text-muted-foreground';
        default: return 'bg-muted text-muted-foreground';
    }
}
function openRecordDelivery(lt: any) {
    deliveryForm.leadTimeId = lt.id;
    deliveryForm.actualDeliveryDate = '';
    deliveryForm.quantityReceived = '';
    recordDeliveryDialogOpen.value = true;
}
function supplierLabel(supplierId: string | null | undefined): string | null {
    if (!supplierId) return null;
    const supplier = suppliers.value.find((entry) => entry.id === supplierId);
    return supplier ? lookupOptionText(supplier) : supplierId;
}

// warehouses/suppliers were never fetched on this page -- warehouseReady/supplierReady stayed
// permanently false, and referenceStructureLoaded (the real top-level ref) was shadowed by an
// unrelated `ref(true)` stub inlined directly in the bindSupplyChainPageApi call below, so
// procurementSetupBlockedReason always returned 'Loading reference data...' and the New
// Request button could never enable, regardless of permissions.
async function loadSuppliersAndWarehouses() {
    try {
        const [suppliersRes, warehousesRes, deptsRes] = await Promise.all([
            apiRequest<{ data: any[] }>('GET', '/inventory-procurement/suppliers', { query: { perPage: 200 } }).catch(() => ({ data: [] })),
            apiRequest<{ data: any[] }>('GET', '/inventory-procurement/warehouses', { query: { perPage: 200 } }).catch(() => ({ data: [] })),
            canReadDepartments.value
                ? apiRequest<{ data: any[] }>('GET', '/departments', { query: { perPage: 200, status: 'active' } }).catch(() => ({ data: [] }))
                : Promise.resolve({ data: [] }),
        ]);
        suppliers.value = (suppliersRes.data ?? []).map((s: any) => ({ id: String(s.id), name: String(s.supplierName ?? s.name ?? ''), code: s.supplierCode ?? s.code ?? null })).filter((s: any) => s.id && s.name);
        warehouses.value = (warehousesRes.data ?? []).map((w: any) => ({ id: String(w.id), name: String(w.warehouseName ?? w.name ?? ''), code: w.warehouseCode ?? w.code ?? null })).filter((w: any) => w.id && w.name);
        departments.value = (deptsRes.data ?? []).map((d: any) => ({ id: String(d.id), name: String(d.name ?? ''), code: d.code ?? null })).filter((d: any) => d.id && d.name);
    } catch {
        suppliers.value = [];
        warehouses.value = [];
        departments.value = [];
    } finally {
        referenceStructureLoaded.value = true;
    }
}
async function loadLeadTimes() {
    if (!leadTimeSearch.supplierId) { leadTimes.value = []; leadTimePagination.value = null; return; }
    leadTimeLoading.value = true;
    try {
        const response = await apiRequest<{ data: any[]; meta: any }>('GET', '/inventory-procurement/supplier-lead-times', {
            query: { supplierId: leadTimeSearch.supplierId, page: leadTimeSearch.page, perPage: leadTimeSearch.perPage },
        });
        leadTimes.value = response.data ?? [];
        leadTimePagination.value = response.meta ?? null;
    } catch { leadTimes.value = []; leadTimePagination.value = null; } finally { leadTimeLoading.value = false; }
}

// ── Claim link modal (MSD uses this) ──
const createClaimLinkDialogOpen = ref(false);
const claimLinks = ref<any[]>([]);
const claimLinkPagination = ref<any>(null);
const claimLinkLoading = ref(false);
const claimLinkSearch = reactive({ q: '', status: '', page: 1, perPage: 50 });
const CLAIM_STATUSES = ['active', 'settled', 'rejected'] as const;
function loadClaimLinks(): Promise<void> { return Promise.resolve(); }
const createMsdOrderDialogOpen = ref(false);
const msdOrderForm = reactive({
    facilityMsdCode: '', orderDate: '', expectedDeliveryDate: '',
    notes: '', submitImmediately: false,
    lines: [{ msdCode: '', itemName: '', quantity: '', unit: '', unitCost: '' }] as Array<{ msdCode: string; itemName: string; quantity: string; unit: string; unitCost: string }>,
});
const msdOrderErrors = ref<Record<string, string[]>>({});
const msdOrderSubmitting = ref(false);
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

// ── Utils ──
const flashedItemId = ref<string | null>(null);
const flashedRequestId = ref<string | null>(null);
const flashedItemTimer: ReturnType<typeof setTimeout> | null = null;
let flashedRequestTimer: ReturnType<typeof setTimeout> | null = null;
let procurementSearchTimer: ReturnType<typeof setTimeout> | null = null;
let msdOrderSearchTimer: ReturnType<typeof setTimeout> | null = null;

function flashRequest(requestId: string) { flashedRequestId.value = requestId; if (flashedRequestTimer) clearTimeout(flashedRequestTimer); flashedRequestTimer = setTimeout(() => { flashedRequestId.value = null; flashedRequestTimer = null; }, 1500); }

const procurementManualStatusOptions = ['draft', 'pending_approval', 'approved', 'rejected', 'ordered', 'received', 'cancelled'] as const;
const procurementStatusOptions = procurementManualStatusOptions;

async function loadProcurementRequests() {
    if (!canRead.value) return;
    const response = await apiRequest<{ data: any[]; meta: { currentPage: number; lastPage: number; total?: number } }>('GET', '/inventory-procurement/procurement-requests', {
        query: {
            q: procurementSearch.q.trim() || null,
            status: procurementSearch.status || null,
            sortBy: procurementSearch.sortBy || null,
            sortDir: procurementSearch.sortDir || null,
            page: procurementSearch.page,
            perPage: procurementSearch.perPage,
        },
    });

    procurementRequests.value = response.data;
    procurementPagination.value = response.meta;
}

async function loadActiveProcurementRequests() {
    if (!canRead.value) return;
    try {
        const response = await apiRequest<{ data: any[]; meta: { total: number } }>('GET', '/inventory-procurement/procurement-requests/active', {});
        activeRequests.value = response.data;
    } catch (error) {
        console.warn('Failed to load active procurement requests:', error);
        activeRequests.value = [];
    }
}

function procurementSourceLabel(request: any | null | undefined): string | null {
    if (!request?.sourceDepartmentRequisitionId) return null;

    const requestNumber = request.sourceDepartmentRequisitionNumber || request.sourceDepartmentRequisitionId;
    const department = request.sourceDepartmentName ? ` | ${request.sourceDepartmentName}` : '';

    return `${requestNumber}${department}`;
}
const sourceRequisitionOpeningId = ref<string | null>(null);
async function openSourceRequisitionFromProcurement(request: any | null | undefined): Promise<void> {
    const sourceId = request?.sourceDepartmentRequisitionId;
    if (!sourceId) return;
    if (sourceRequisitionOpeningId.value) return;

    sourceRequisitionOpeningId.value = String(request?.id ?? sourceId);
    try {
        const response = await apiRequest<{ data: any }>('GET', `/inventory-procurement/department-requisitions/${sourceId}`);
        const requisition = response.data ?? null;

        if (!requisition) {
            notifyError('Source requisition was not found in the current facility scope.');
            return;
        }

        detailsOpen.value = false;
        window.location.href = '/inventory-procurement/requests-fulfilment';
    } catch (error) {
        notifyError('Source requisition was not found in the current facility scope.');
    } finally {
        sourceRequisitionOpeningId.value = null;
    }
}

function procurementPrimaryAction(request: any): { label: string; handler: () => void } | null {
    if (request.status === 'draft' || request.status === 'pending_approval') return { label: 'Approve', handler: () => openStatusDialog(request, 'approved') };
    if (request.status === 'approved') return { label: 'Place Order', handler: () => openPlaceOrderDialog(request) };
    if (request.status === 'ordered' && canCreateMovement.value) return { label: 'Receive Goods', handler: () => openReceiveDialog(request) };
    if (request.status === 'received' && request.sourceDepartmentRequisitionId && canManageItems.value) {
        return {
            label: sourceRequisitionOpeningId.value === String(request.id) ? 'Opening...' : 'Complete Issue',
            handler: () => openSourceRequisitionFromProcurement(request),
        };
    }
    return null;
}

function procurementOverflowActions(request: any): Array<{ label: string; handler: () => void }> {
    const actions: Array<{ label: string; handler: () => void }> = [];
    if (canUpdateRequestStatus.value) {
        if (request.status !== 'approved' && request.status !== 'rejected' && request.status !== 'cancelled' && request.status !== 'received') {
            actions.push({ label: 'Reject', handler: () => openStatusDialog(request, 'rejected') });
        }
        for (const opt of procurementManualStatusOptions) {
            if (opt === 'approved' || opt === 'rejected') continue;
            actions.push({ label: formatEnumLabel(opt), handler: () => openStatusDialog(request, opt) });
        }
    }
    return actions;
}

function normalizeLookupOption(value: any, nameKeys: string[], codeKeys: string[] = []): LookupOption | null {
    const id = String(value?.id ?? '').trim();
    if (!id) return null;

    let name = '';
    for (const key of nameKeys) {
        const candidate = String(value?.[key] ?? '').trim();
        if (candidate) {
            name = candidate;
            break;
        }
    }

    let code: string | null = null;
    for (const key of codeKeys) {
        const candidate = String(value?.[key] ?? '').trim();
        if (candidate) {
            code = candidate;
            break;
        }
    }

    return {
        id,
        name: name || id,
        code,
    };
}

function lookupOptionText(option: LookupOption | null | undefined): string {
    if (!option) return '';
    return option.code ? `${option.name} (${option.code})` : option.name;
}

function formatAmount(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return 'N/A';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return String(value);
    return numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Mobile drawers ──
const mobileProcurementDrawerOpen = ref(false);
function submitProcurementSearchFromMobileDrawer(): void { mobileProcurementDrawerOpen.value = false; procurementSearch.page = 1; }
function resetProcurementFiltersFromMobileDrawer(): void { mobileProcurementDrawerOpen.value = false; procurementSearch.q = ''; procurementSearch.status = ''; procurementSearch.page = 1; }
const procurementFilterChips = computed(() => { const chips: string[] = []; if (procurementSearch.q) chips.push(`Search: "${procurementSearch.q}"`); if (procurementSearch.status) chips.push(`Status: ${formatEnumLabel(procurementSearch.status)}`); return chips; });
const hasAnyProcurementFilters = computed(() => procurementFilterChips.value.length > 0);
function resetProcurementFilters(): void { procurementSearch.q = ''; procurementSearch.status = ''; procurementSearch.page = 1; }

// ── Computeds ──
const procurementPages = computed<(number | '...')[]>(() => {
    const last = procurementPagination.value?.lastPage ?? 1;
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
    return [1, '...', last];
});
function goToProcurementPage(page: number): void { procurementSearch.page = Math.max(1, Math.min(page, procurementPagination.value?.lastPage ?? 1)); }

const procurementFilterHelperText = computed(() => procurementSearch.q || procurementSearch.status ? 'Filters applied' : 'Search by request number, supplier, or item');

const tabContentTitle = computed(() => {
    const titles: Record<string, string> = {
        procurement: 'Procurement Requests',
        'msd-orders': 'MSD Orders',
        'lead-times': 'Supplier Lead Times',
    };
    return titles[activeTab.value] ?? 'Procurement';
});
const tabContentIcon = computed(() => {
    const icons: Record<string, string> = {
        procurement: 'clipboard-list',
        'msd-orders': 'package',
        'lead-times': 'clock',
    };
    return icons[activeTab.value] ?? 'clipboard-list';
});
const tabContentDescription = computed(() => {
    const descs: Record<string, string> = {
        procurement: 'Purchase requests from submission through ordering and receipt.',
        'msd-orders': 'Orders placed against the MSD standing contract.',
        'lead-times': 'Supplier lead time tracking and management.',
    };
    return descs[activeTab.value] ?? '';
});

const filterCount = computed(() => {
    if (activeTab.value === 'procurement') {
        let count = 0;
        if (procurementSearch.q) count++;
        if (procurementSearch.status) count++;
        if (procurementSearch.sortBy !== 'createdAt') count++;
        if (procurementSearch.sortDir !== 'desc') count++;
        if (procurementSearch.perPage !== 50) count++;
        return count;
    }
    if (activeTab.value === 'msd-orders') {
        let count = 0;
        if (msdOrderSearch.q) count++;
        if (msdOrderSearch.status) count++;
        if (msdOrderSearch.perPage !== 50) count++;
        return count;
    }
    return 0;
});

function resetAllFilters() {
    if (activeTab.value === 'procurement') {
        procurementSearch.q = '';
        procurementSearch.status = '';
        procurementSearch.sortBy = 'createdAt';
        procurementSearch.sortDir = 'desc';
        procurementSearch.perPage = 50;
        procurementSearch.page = 1;
        loadProcurementRequests();
    } else if (activeTab.value === 'msd-orders') {
        msdOrderSearch.q = '';
        msdOrderSearch.status = '';
        msdOrderSearch.perPage = 50;
        msdOrderSearch.page = 1;
        loadMsdOrders();
    }
}

function applyFilters() {
    if (activeTab.value === 'procurement') {
        procurementSearch.page = 1;
        loadProcurementRequests();
    } else if (activeTab.value === 'msd-orders') {
        msdOrderSearch.page = 1;
        loadMsdOrders();
    }
}

function handlePrint(): void {
    if (typeof window !== 'undefined') {
        window.print();
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
        canUpdateRequestStatus.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.update-request-status');
        canViewAudit.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.view-audit-logs');
        canApproveRequisitions.value = hasSuperAdminAccess || permissionSet.has('inventory.approve-requisition-own-department');
        canManageSuppliers.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.manage-suppliers');
        canManageWarehouses.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.manage-warehouses');
    };
    applyResolvedPermissions(sharedPermissionNames.value ?? [], isFacilitySuperAdmin.value);
}

function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, options?: { query?: Record<string, any>; body?: Record<string, any>; meta?: Record<string, any> }): Promise<T> {
    return apiRequestJson<T>(method, path, { query: options?.query as any, body: options?.body, idempotencyKey: options?.meta?.idempotencyKey, requestId: options?.meta?.requestId, entitlementContext: options?.meta?.entitlementContext });
}

const itemDetails = ref<any>(null);
const itemDetailsOpen = ref(false);
function requestItemDetailsOpenChange(open: boolean): void { itemDetailsOpen.value = open; }
const itemUpdateForm = reactive({} as any);
const itemUpdateErrors = ref<Record<string, string[]>>({});
const itemUpdateSubmitting = ref(false);
const itemStatusForm = reactive({ status: '', reason: '' });
const itemStatusSubmitting = ref(false);
const itemStatusError = ref<string | null>(null);
const itemStatusOptions = computed(() => ['active', 'inactive'] as const);

async function loadItems() {
    if (!canRead.value) return;
    try {
        const response = await apiRequest<{ data: any[]; meta: { currentPage: number; lastPage: number; total?: number } }>('GET', '/inventory-procurement/items', {
            query: { perPage: 50 },
        });
        items.value = response.data ?? [];
        itemCounts.value = { outOfStock: 0, lowStock: 0, healthy: 0, total: response.meta?.total ?? 0 };
    } catch {
        // handled silently
    }
}

const clinicalCatalogItems = ref<any[]>([]);
const clinicalCatalogLabel = (id: string | null | undefined) => { if (!id) return 'Unknown'; const item = clinicalCatalogItems.value?.find((c: any) => c.id === id); return item?.name ?? 'Unknown'; };
const createClinicalCatalogOptions = computed(() => clinicalCatalogItems.value.map((c: any) => ({ value: c.id, label: `${c.name} (${c.code})` })));
const updateClinicalCatalogOptions = createClinicalCatalogOptions;
const selectClinicalCatalogItem = (form: any, catalogItemId: string) => { const item = clinicalCatalogItems.value?.find((c: any) => c.id === catalogItemId); if (item) { form.clinicalCatalogItemId = catalogItemId; if (!form.itemName) form.itemName = item.name; if (!form.itemCode) form.itemCode = item.code; } };
const selectedUpdateCategory = computed(() => null);
const updateIdentityLockedToCatalog = computed(() => false);
const updateSelectedCatalogItem = computed(() => null);
const fieldError = (errors: Record<string, string[]>, field: string) => errors[field]?.[0] ?? null;
const itemUpdateSubmitDisabled = computed(() => false);

async function searchClinicalCatalog(q: string, catalogType?: string): Promise<any[]> {
    try {
        const response = await apiRequest<{ data: any[] }>('GET', '/inventory-procurement/clinical-catalog/search', {
            query: { q, catalogType: catalogType ?? 'formulary_item', perPage: 50 },
        });
        return response.data ?? [];
    } catch {
        return [];
    }
}

async function submitItemUpdate() {
    if (!itemDetails.value || !canManageItems.value || itemUpdateSubmitting.value) return;
    itemUpdateSubmitting.value = true;
    itemUpdateErrors.value = {};
    try {
        const response = await apiRequest<{ data: any }>('PATCH', `/inventory-procurement/items/${itemDetails.value.id}`, {
            body: itemUpdateForm,
            meta: { idempotencyKey: generateRequestKey(), requestId: generateRequestKey(), entitlementContext: 'Inventory item update' },
        });
        itemDetails.value = response.data;
        notifySuccess('Inventory item updated.');
        await loadItems();
    } catch (error) {
        itemUpdateErrors.value = (error as any).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to update inventory item.'));
    } finally {
        itemUpdateSubmitting.value = false;
    }
}

async function submitItemStatus() {
    if (!itemDetails.value || !canManageItems.value || itemStatusSubmitting.value) return;
    itemStatusSubmitting.value = true;
    itemStatusError.value = null;
    try {
        const response = await apiRequest<{ data: any }>('PATCH', `/inventory-procurement/items/${itemDetails.value.id}/status`, {
            body: { status: itemStatusForm.status, reason: (itemStatusForm.reason || '').trim() || null },
            meta: { idempotencyKey: generateRequestKey(), requestId: generateRequestKey(), entitlementContext: 'Inventory item status update' },
        });
        itemDetails.value = response.data;
        notifySuccess('Inventory item status updated.');
        await loadItems();
    } catch (error) {
        itemStatusError.value = messageFromUnknown(error, 'Unable to update item status.');
        notifyError(itemStatusError.value);
    } finally {
        itemStatusSubmitting.value = false;
    }
}

// ── Bind shared page API ──
bindSupplyChainPageApi({
    canRead, canCreateRequest, canManageItems, canCreateMovement, canLaunchProcurementRequest,
    canSyncFromCatalog: computed(() => false), headerActions, loading,
    EMPTY_SELECT_VALUE, toSelectValue, fromSelectValue, items, itemCounts, suppliers, warehouses, departments, lookupOptionText,
    procurementRequests, procurementPagination, procurementSearch, procurementStatusOptions,
    hasAnyProcurementFilters, procurementFilterChips, resetProcurementFilters, flashedRequestId,
    openDetails, procurementSourceLabel, sourceRequisitionOpeningId, openSourceRequisitionFromProcurement,
    procurementPrimaryAction, procurementOverflowActions, procurementPages, goToProcurementPage,
    loadProcurementRequests, loadActiveProcurementRequests, formatAmount, formatEnumLabel, formatDateTime, formatDateOnly, auditActorLabel,
    compactProcurementRows: ref(false), canApproveRequisitions, isStoreOperations, canViewAudit,
    mobileProcurementDrawerOpen, submitProcurementSearchFromMobileDrawer, resetProcurementFiltersFromMobileDrawer,
    procurementManualStatusOptions, stockStateDotClass: () => '', stockStateLabel: () => '',
    createProcurementDialogOpen, procurementDiscardConfirmOpen, procurementSubmitting, procurementErrors,
    procurementRequestError, procurementRequestKey, procurementForm, procurementUsesExistingItem,
    procurementLockedToSource, selectedProcurementItem, handleProcurementItemSelected, activeRequestsForItem,
    handleProcurementDialogOpenChange, submitProcurementRequest,
    closeCreateProcurementDialog, openCreateProcurementDialog,
    msdOrders, msdOrderPagination, msdOrderLoading, msdOrderSearch, MSD_ORDER_STATUSES,
    shortageMsdDraftLines, lowStockMsdDraftLines, openMsdOrderFromDraft, openBlankMsdOrder,
    loadMsdOrders, syncMsdOrderStatus,
    leadTimeSearch, leadTimeLoading, leadTimes, leadTimePagination, supplierPerformance,
    supplierLabel, createLeadTimeDialogOpen, loadLeadTimes, deliveryStatusBadge,
    openRecordDelivery, leadTimeForm, leadTimeErrors, leadTimeSubmitting, submitCreateLeadTime,
    recordDeliveryDialogOpen, deliveryForm, deliveryErrors, deliverySubmitting, submitRecordDelivery,
    placeOrderDialogOpen, placeOrderRequest, placeOrderForm, placeOrderErrors, placeOrderError,
    placeOrderSubmitting, submitPlaceOrder, openPlaceOrderDialog,
    receiveDialogOpen, receiveRequest, receiveForm, receiveErrors, receiveError, receiveSubmitting,
    submitReceiveGoods, openReceiveDialog,
    statusDialogOpen, statusRequest, statusValue, statusReason, statusError, statusSubmitting,
    submitStatusUpdate, openStatusDialog,
    detailsOpen, detailsRequest, detailsAuditFilters, detailsAuditLoading,
    detailsAuditExporting, detailsAuditError, detailsAuditLogs, detailsAuditMeta,
    applyDetailsAuditFilters, resetDetailsAuditFilters,
    exportDetailsAuditLogsCsv,
    goToDetailsAuditPage,
    requestCreateProcurementOpenChange: handleProcurementDialogOpenChange,
    confirmProcurementDiscard: () => { closeCreateProcurementDialog(); },
    requisitionDepartmentHelperText: computed(() => ''), referenceStructureLoaded,
    inventoryItemSetupBlockedReason: computed(() => null),
    canSetOpeningStock: ref(false), canReconcileStock: ref(false),
    inventoryAccess, barcodeScannerOpen: ref(false), barcodeInput: ref(''),
    barcodeLookupLoading: ref(false), barcodeLookupError: ref(null), barcodeLookupResult: ref(null),
    onBarcodeKeydown: () => {}, lookupBarcode: () => Promise.resolve(),
    itemFilterChips: computed(() => []), hasAnyItemFilters: computed(() => false),
    resetItemFilters: () => {}, openItemDetails: () => Promise.resolve(),
    itemDetails, itemDetailsOpen, itemUpdateForm, itemUpdateErrors, itemUpdateSubmitting,
    submitItemUpdate, itemStatusForm, itemStatusSubmitting, itemStatusError, itemStatusOptions,
    submitItemStatus, loadItems,
    inventoryItemNeedsOpeningStock: () => false, inventoryItemHasOpeningStock: () => false,
    stockAlertBadgeClass: () => '', openStockMovementDialog: () => {},
    inventoryItemStockActionLabel: () => '', inventoryItemListMeta: () => '',
    reloadAll: () => {},
    catalogSyncDialogOpen: ref(false), openCatalogSyncDialog: () => {},
    importItemsCsvDialogOpen: ref(false), importItemsCsvSubmitting: ref(false),
    importItemsCsvFile: ref(null), importItemsCsvInputKey: ref(0), importItemsCsvResult: ref(null),
    openImportItemsCsvDialog: () => {}, closeImportItemsCsvDialog: () => {},
    submitImportItemsCsv: () => Promise.resolve(), createItemDialogOpen: ref(false),
    openCreateItemDialog: () => {}, closeCreateItemDialog: () => {},
    requestCreateItemOpenChange: () => {}, confirmCreateItemDiscard: () => {},
    hasCreateItemDraftContent: computed(() => false), itemCreateForm: reactive({} as any),
    itemCreateSubmitting: ref(false), itemCreateErrors: ref({}),
    selectedCreateCategory: computed(() => null), createSubcategoryOptions: computed(() => []),
    createClinicalCatalogOptions, createClinicalCatalogSelectionRequired: computed(() => false),
    createIdentityLockedToCatalog: computed(() => false), createSelectedCatalogItem: computed(() => null),
    selectClinicalCatalogItem,
    clinicalCatalogItems, clinicalCatalogLabel, updateClinicalCatalogOptions,
    selectedUpdateCategory, updateIdentityLockedToCatalog, updateSelectedCatalogItem,
    fieldError, itemUpdateSubmitDisabled, searchClinicalCatalog,
    requestItemDetailsOpenChange,
    DOSAGE_FORM_OPTIONS: ref([]), storageConditionOptions: ref([]),
    controlledSubstanceScheduleOptions: ref([]), venClassificationOptions: ref([]),
    abcClassificationOptions: ref([]), createItemWarehouseOpen: ref(false),
    createItemSupplierOpen: ref(false), itemCreateRequestError: ref(null),
    itemCreateSubmitReason: computed(() => null), itemCreateSubmitDisabled: computed(() => true),
    submitCreateItem: () => Promise.resolve(),
    canUpdateRequestStatus,
    auditActorTypeOptions: computed(() => [
        { value: 'user', label: 'User' }, { value: 'system', label: 'System' },
    ]),
    batchCreateErrors: ref({} as Record<string, string>),
    batchCreateSubmitting: ref(false),
    batchForm: reactive({ batchNumber: '', expiryDate: '', quantity: 0, unitCost: 0 }),
    batchOptionLabel: (batch: any) => batch ? `${batch.internalBatchNumber ?? batch.batchNumber ?? batch.id ?? 'Batch'} ${batch.batchNumber ? `(${batch.batchNumber})` : ''} — ${batch.quantity ?? 0} units` : 'Select batch',
    submitCreateBatch: () => Promise.resolve(),
    claimLinkContextStatusLabel: computed(() => ''),
    claimLinkContextStatusVariant: computed(() => 'secondary'),
    claimLinkErrors: ref({} as Record<string, string>),
    claimLinkForm: reactive({ itemId: '', patientId: '', invoiceId: '', payerType: '', amount: 0, notes: '' }),
    claimLinkItemContextLabel: computed(() => ''),
    claimLinkItemContextMeta: computed(() => ''),
    claimLinkPatientContextLabel: computed(() => ''),
    claimLinkPatientContextMeta: computed(() => ''),
    claimLinkSubmitting: ref(false),
    claimLinkWorkflowContextLabel: computed(() => ''),
    claimLinkWorkflowContextMeta: computed(() => ''),
    submitCreateClaimLink: () => Promise.resolve(),
    mobileLedgerDrawerOpen: ref(false),
    movementTypeOptions: computed(() => []),
    receiveItemUnits: computed(() => []),
    receiveRequiresBatchTracking: computed(() => false),
    receiveTrackedCategory: computed(() => null),
    stockLedgerFilters: reactive({ q: '', movementType: '', sourceKey: '', actorType: '', actorId: '', from: '', to: '', page: 1, perPage: 20 }),
    stockLedgerLoading: ref(false),
    stockLedgerSourceOptions: computed(() => []),
    submitLedgerSearchFromMobileDrawer: () => {},
    warehouseLabel: (id: string | null | undefined) => id ?? null,
    stockMovementOpeningBalanceMode: computed(() => false),
    stockMovementSheetTitle: computed(() => 'Stock Movement'),
    stockMovementSheetDescription: computed(() => 'Record a stock movement'),
    canSelectAnyRequisitionDepartment: computed(() => false),
    setDepartmentStockDepartmentFilter: () => {},
    departmentFilterOptions: computed(() => []),
    flushInventorySearch: () => {},
    openCreateUnitDialog: () => {},
    createBatchDialogOpen: ref(false),
    createUnitDialogOpen: ref(false),
    createPriceDialogOpen: ref(false),
    unitForm: reactive({ name: '', conversionFactor: 1, dispensingUnit: '', barcode: '' }),
    unitFormErrors: ref({} as Record<string, string>),
    unitFormSubmitting: ref(false),
    editingUnitId: ref(null),
    submitCreateUnit: () => Promise.resolve(),
    submitDeactivateUnit: () => Promise.resolve(),
    openEditUnitDialog: () => {},
    itemUnits: ref([]),
    itemUnitsLoading: ref(false),
    loadItemUnits: () => Promise.resolve(),
    resetUnitForm: () => {},
    unitPrices: ref([]),
    unitPricesLoading: ref(false),
    loadItemUnitPrices: () => Promise.resolve(),
    restoredCreateItemDraft: { value: false },
    discardCreateItemDraft: () => {},
    clearPersistedCreateItemDraft: () => {},
    stockMovementSelectionResetLocked: ref(false),
    stockStateOptions: ['out_of_stock', 'low_stock', 'healthy'] as const,
    itemCategoryOptions: ref([]),
    createItemStep: ref(1), createItemSteps: [{ value: 1, label: 'Category' }, { value: 2, label: 'Identity' }, { value: 3, label: 'Compliance' }, { value: 4, label: 'Stock Policy' }],
    createStepBlockedReason: computed(() => null), goToNextCreateStep: () => {}, goToPrevCreateStep: () => {},
    hasPendingCreateItemWorkflow: computed(() => false),
    isSubmittingInventoryWorkflow: computed(() => false),
    createItemRequestKey: ref(''),
    itemUpdateRequestKey: ref(''),
    itemStatusRequestKey: ref(''),
    createItemDiscardConfirmOpen: ref(false),
    itemDetailsDiscardConfirmOpen: ref(false),
    hasPendingItemDetailsWorkflow: computed(() => false),
    refreshInventoryItems: () => {},
    openDepartmentStockForItem: () => {},
    itemPages: computed(() => 1),
    goToItemPage: () => {},
    itemSearch: reactive({ q: '', category: '', stockState: '', sortBy: 'itemName', sortDir: 'asc', page: 1, perPage: 50 }),
});

onBeforeUnmount(() => {
    if (flashedItemTimer) clearTimeout(flashedItemTimer);
    if (flashedRequestTimer) clearTimeout(flashedRequestTimer);
    if (procurementSearchTimer) clearTimeout(procurementSearchTimer);
    if (msdOrderSearchTimer) clearTimeout(msdOrderSearchTimer);
    clearSupplyChainPageApi();
});

watch(() => procurementSearch.q, () => {
    if (procurementSearchTimer) clearTimeout(procurementSearchTimer);
    procurementSearchTimer = setTimeout(() => {
        procurementSearchTimer = null;
        if (!canRead.value) return;
        procurementSearch.page = 1;
        void loadProcurementRequests();
    }, 180);
});
watch(() => procurementSearch.status, () => { procurementSearch.page = 1; void loadProcurementRequests(); });
watch(() => procurementSearch.sortBy, () => { procurementSearch.page = 1; void loadProcurementRequests(); });
watch(() => procurementSearch.sortDir, () => { procurementSearch.page = 1; void loadProcurementRequests(); });
watch(() => msdOrderSearch.q, () => {
    if (msdOrderSearchTimer) clearTimeout(msdOrderSearchTimer);
    msdOrderSearchTimer = setTimeout(() => {
        msdOrderSearchTimer = null;
        if (!canRead.value) return;
        msdOrderSearch.page = 1;
        void loadMsdOrders();
    }, 180);
});
watch(() => msdOrderSearch.status, () => { msdOrderSearch.page = 1; void loadMsdOrders(); });

watch(() => activeTab.value, () => { syncProcurementStateToUrl(); });
watch(() => [procurementSearch.q, procurementSearch.status, procurementSearch.sortBy, procurementSearch.sortDir, procurementSearch.page, procurementSearch.perPage], () => {
    syncProcurementStateToUrl();
});
watch(() => [msdOrderSearch.q, msdOrderSearch.status, msdOrderSearch.page, msdOrderSearch.perPage], () => {
    syncProcurementStateToUrl();
});
watch(() => [leadTimeSearch.supplierId, leadTimeSearch.page, leadTimeSearch.perPage], () => {
    syncProcurementStateToUrl();
});

onMounted(async () => {
    hydrateProcurementStateFromUrl();
    await loadPermissions();
    await Promise.allSettled([loadProcurementRequests(), loadMsdOrders(), loadLeadTimes(), loadSuppliersAndWarehouses(), loadItems()]);
    loading.value = false;
});
</script>

<template>
    <Head title="Procurement" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="clipboard-list" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">Procurement</h1>
                                <Badge v-if="permissionsResolved && !canRead" variant="outline" class="h-5 px-1.5 text-[10px] font-medium">
                                    View only
                                </Badge>
                            </div>
                            <p class="truncate text-xs text-muted-foreground">Purchase requests, MSD orders, and supplier lead times</p>
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
                            @click="loadProcurementRequests()"
                        >
                            <AppIcon :name="(loading ? 'loader-circle' : 'refresh-cw') as AppIconName" class="size-3.5" :class="loading ? 'animate-spin' : ''" />
                        </Button>
                        <Button v-for="action in headerActions" :key="action.key" :size="'sm'" :variant="action.variant ?? 'outline'" :class="[action.class ?? '', 'h-8', action.iconOnly ? 'w-8 p-0' : 'gap-1.5']" :disabled="action.disabled || action.loading" @click="action?.onClick">
                            <AppIcon :name="action.icon as AppIconName" :class="`size-3.5 ${action.loading ? 'animate-spin' : ''}`" />
                            <span v-if="!action.iconOnly">{{ action.label }}</span>
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
                                    <Link href="/inventory-procurement/requests-fulfilment" class="gap-2">
                                        <AppIcon name="activity" class="size-4" /> Requests &amp; Fulfilment
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem as-child>
                                    <Link href="/inventory-procurement/review" class="gap-2">
                                        <AppIcon name="shield-check" class="size-4" /> Review
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </section>

            <template v-if="!canRead && permissionsResolved">
                <Alert variant="destructive">
                    <AlertTitle class="flex items-center gap-2">
                        <AppIcon name="alert-triangle" class="size-4" />
                        Access denied
                    </AlertTitle>
                    <AlertDescription>You do not have `inventory-procurement.read` permission, so this page cannot load the procurement data.</AlertDescription>
                </Alert>
            </template>

            <template v-else>
                <Card class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                    <Tabs :model-value="activeTab" :unmount-on-hide="false" class="flex h-full min-h-0 flex-col" @update:model-value="(v) => { activeTab = v as ProcurementTab; }">
                        <div class="flex flex-col gap-3 border-b px-4 py-3">
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div class="min-w-0 shrink-0">
                                    <h3 class="flex items-center gap-2 text-sm font-semibold leading-none whitespace-nowrap">
                                        <AppIcon :name="tabContentIcon as AppIconName" class="size-4 text-primary" />
                                        {{ tabContentTitle }}
                                    </h3>
                                    <p class="mt-1 text-xs text-muted-foreground">{{ tabContentDescription }}</p>
                                </div>
                                <div class="flex min-w-0 items-center gap-2">
                                    <template v-if="activeTab === 'procurement'">
                                        <div class="relative min-w-0 flex-1 lg:flex-none">
                                            <AppIcon name="search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                            <input
                                                v-model="procurementSearch.q"
                                                class="h-8 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-80"
                                                placeholder="Request number, supplier, item…"
                                                @keydown.enter="procurementSearch.page = 1; loadProcurementRequests()"
                                            />
                                        </div>
                                    </template>
                                    <template v-else-if="activeTab === 'msd-orders'">
                                        <div class="relative min-w-0 flex-1 lg:flex-none">
                                            <AppIcon name="search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                            <input
                                                v-model="msdOrderSearch.q"
                                                class="h-8 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-80"
                                                placeholder="Search order number, reference..."
                                                @keydown.enter="msdOrderSearch.page = 1; loadMsdOrders()"
                                            />
                                        </div>
                                    </template>
                                    <template v-else-if="activeTab === 'lead-times'">
                                        <Select :model-value="toSelectValue(leadTimeSearch.supplierId)" @update:model-value="leadTimeSearch.supplierId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE)); leadTimeSearch.page = 1; loadLeadTimes()">
                                            <SelectTrigger class="h-8 w-full rounded-lg text-xs lg:w-80">
                                                <SelectValue placeholder="Select supplier…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem :value="EMPTY_SELECT_VALUE">All suppliers</SelectItem>
                                                <SelectItem v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </template>
                                    <SupplyChainFilterPopover :filter-count="filterCount" @apply="applyFilters" @reset="resetAllFilters">
                                        <template v-if="activeTab === 'procurement'">
                                            <div class="grid gap-2">
                                                <Label>Status</Label>
                                                <Select :model-value="toSelectValue(procurementSearch.status)" @update:model-value="procurementSearch.status = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                                    <SelectTrigger class="w-full"><SelectValue placeholder="All statuses" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem :value="EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                                        <SelectItem v-for="opt in procurementStatusOptions" :key="`ps-${opt}`" :value="opt">{{ formatEnumLabel(opt) }}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label>Sort by</Label>
                                                <Select :model-value="toSelectValue(procurementSearch.sortBy)" @update:model-value="procurementSearch.sortBy = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                                    <SelectTrigger class="w-full"><SelectValue placeholder="Sort by" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="createdAt">Created</SelectItem>
                                                        <SelectItem value="neededBy">Needed By</SelectItem>
                                                        <SelectItem value="requestedQuantity">Quantity</SelectItem>
                                                        <SelectItem value="status">Status</SelectItem>
                                                        <SelectItem value="supplierName">Supplier</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </template>
                                        <template v-else-if="activeTab === 'msd-orders'">
                                            <div class="grid gap-2">
                                                <Label>Status</Label>
                                                <Select :model-value="toSelectValue(msdOrderSearch.status)" @update:model-value="msdOrderSearch.status = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE)); msdOrderSearch.page = 1; loadMsdOrders()">
                                                    <SelectTrigger class="w-full"><SelectValue placeholder="All statuses" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem :value="EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                                        <SelectItem v-for="s in MSD_ORDER_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </template>
                                        <div class="grid gap-2">
                                            <Label>Per page</Label>
                                            <Select :model-value="String(activeTab === 'msd-orders' ? msdOrderSearch.perPage : procurementSearch.perPage)" @update:model-value="(v) => { const val = Number(v); if (activeTab === 'msd-orders') { msdOrderSearch.perPage = val; msdOrderSearch.page = 1; loadMsdOrders(); } else { procurementSearch.perPage = val; procurementSearch.page = 1; loadProcurementRequests(); } }">
                                                <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="50">50</SelectItem>
                                                    <SelectItem value="100">100</SelectItem>
                                                    <SelectItem value="150">150</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </SupplyChainFilterPopover>
                                </div>
                            </div>

                            <TabsList class="grid h-9 w-full grid-cols-3 gap-1 bg-muted/40 p-1">
                                <TabsTrigger value="procurement" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <span class="flex items-center gap-1 leading-none">
                                        <AppIcon name="clipboard-list" class="size-3" />
                                        Purchase Requests
                                    </span>
                                </TabsTrigger>
                                <TabsTrigger value="msd-orders" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <span class="flex items-center gap-1 leading-none">
                                        <AppIcon name="package" class="size-3" />
                                        MSD Orders
                                    </span>
                                </TabsTrigger>
                                <TabsTrigger value="lead-times" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <span class="flex items-center gap-1 leading-none">
                                        <AppIcon name="activity" class="size-3" />
                                        Lead Times
                                    </span>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <TabsContent value="procurement" class="m-0 flex min-h-0 flex-1 flex-col">
                                <SupplyChainProcurementTab />
                            </TabsContent>
                            <TabsContent value="msd-orders" class="m-0 flex min-h-0 flex-1 flex-col">
                                <SupplyChainMsdOrdersTab />
                            </TabsContent>
                            <TabsContent value="lead-times" class="m-0 flex min-h-0 flex-1 flex-col">
                                <SupplyChainLeadTimesTab />
                            </TabsContent>
                        </div>
                    </Tabs>
                </Card>

                <SupplyChainFilterOverlays />
            </template>
        </div>
    </AppLayout>

    <SupplyChainProcurementLifecycleSheets />
    <SupplyChainRequestEntrySheets />
    <SupplyChainClaimsAndMsdSheets />
    <SupplyChainAuxiliarySheets />
    <SupplyChainItemDetailsSheet />
    <SupplyChainInventoryOpsSheets />
</template>



