<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, ref, nextTick, onBeforeUnmount, onMounted, reactive, watch, type Ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
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
import { useWorkflowDraftPersistence } from '@/composables/useWorkflowDraftPersistence';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import type { AppIconName } from '@/lib/icons';
import { generateRequestKey } from '@/lib/idempotency';
import { INVENTORY_PROCUREMENT_HOME_PATH } from '@/lib/inventoryProcurement';
import { isInventoryDepartmentRequester, isInventoryStoreOperations, type InventoryProcurementAccess } from '@/lib/inventoryProcurementAccess';
import { formatEnumLabel } from '@/lib/labels';
import { stockMovementStripeClass } from '@/lib/listRows';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import SupplyChainAuxiliarySheets from '@/pages/inventory-procurement/components/SupplyChainAuxiliarySheets.vue';
import SupplyChainCatalogSyncDialog from '@/pages/inventory-procurement/components/SupplyChainCatalogSyncDialog.vue';
import SupplyChainFilterOverlays from '@/pages/inventory-procurement/components/SupplyChainFilterOverlays.vue';
import SupplyChainFilterPopover from '@/pages/inventory-procurement/components/SupplyChainFilterPopover.vue';
import SupplyChainInventoryImportCsvDialog from '@/pages/inventory-procurement/components/SupplyChainInventoryImportCsvDialog.vue';
import SupplyChainInventoryOpsSheets from '@/pages/inventory-procurement/components/SupplyChainInventoryOpsSheets.vue';
import SupplyChainItemDetailsSheet from '@/pages/inventory-procurement/components/SupplyChainItemDetailsSheet.vue';
import { EMPTY_SELECT_VALUE, fromSelectValue, toSelectValue, formatDateTime, formatDateOnly, auditActorLabel } from '@/pages/inventory-procurement/constants';
import { bindSupplyChainPageApi } from '@/pages/inventory-procurement/registerSupplyChainPageApi';
import { clearSupplyChainPageApi } from '@/pages/inventory-procurement/supplyChainPageApi';
import {
    SupplyChainDepartmentStockTab,
    SupplyChainInventoryTab,
    SupplyChainLedgerTab,
} from '@/pages/inventory-procurement/supplyChainTabComponents';
import { type BreadcrumbItem } from '@/types';

type ApiError = Error & { payload?: { message?: string; errors?: Record<string, string[]> } };
type SelectOption = { value: string; label: string };
type InventoryCategoryTemplate = 'pharmaceutical' | 'expiry_sensitive' | 'specialist_equipment' | 'general_supply';
type InventoryCategoryOption = SelectOption & {
    template: InventoryCategoryTemplate; description: string; requiresExpiryTracking: boolean;
    requiresColdChain: boolean; controlledSubstanceEligible: boolean; supportsMedicineDetails: boolean;
    supportsStorageFields: boolean; supportsClinicalClassification: boolean;
};
type InventoryItemFormState = {
    clinicalCatalogItemId: string; itemCode: string; itemName: string; genericName: string;
    dosageForm: string; strength: string; category: string; subcategory: string;
    venClassification: string; abcClassification: string; unit: string; dispensingUnit: string;
    conversionFactor: string; binLocation: string; manufacturer: string; storageConditions: string;
    requiresColdChain: boolean; isControlledSubstance: boolean; controlledSubstanceSchedule: string;
    msdCode: string; nhifCode: string; barcode: string; reorderLevel: string; maxStockLevel: string;
    defaultWarehouseId: string; defaultSupplierId: string;
};
type StockMovementLookupItem = {
    id: string; itemCode?: string | null; itemName?: string | null; genericName?: string | null;
    category?: string | null; subcategory?: string | null; unit?: string | null;
    currentStock?: number | string | null; reorderLevel?: number | string | null;
    movementCount?: number | string | null; status?: string | null; stockState?: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Supply chain', href: INVENTORY_PROCUREMENT_HOME_PATH },
    { title: 'Stock Control', href: '/inventory-procurement/stock-control' },
];

type StockControlTab = 'inventory' | 'ledger' | 'department-stock';
const stockControlTabs: StockControlTab[] = ['inventory', 'ledger', 'department-stock'];

const { permissionNames: sharedPermissionNames, isFacilitySuperAdmin, hasPermission, permissionState, scope: platformScope } = usePlatformAccess();

const permissionsResolved = computed(() => sharedPermissionNames.value !== null);
const canReadDepartments = computed(() => isFacilitySuperAdmin.value || hasPermission('departments.read'));


const canRead = ref(false);
const canManageItems = ref(false);
const canCreateMovement = ref(false);
const canSetOpeningStock = ref(false);
const canReconcileStock = ref(false);
const canViewAudit = ref(false);
const canManageSuppliers = ref(false);
const canManageWarehouses = ref(false);

const inventoryAccess = computed<InventoryProcurementAccess>(() => ({
    canRead: canRead.value, canManageItems: canManageItems.value, canCreateMovement: canCreateMovement.value,
    canSetOpeningStock: canSetOpeningStock.value, canReconcileStock: canReconcileStock.value,
    canCreateRequest: false, canUpdateRequestStatus: false, canViewAudit: canViewAudit.value,
    canApproveRequisitions: false, canManageSuppliers: canManageSuppliers.value, canManageWarehouses: canManageWarehouses.value,
}));

const isStoreOperations = computed(() => isInventoryStoreOperations(inventoryAccess.value));

const activeTab = ref<StockControlTab>('inventory');

const tabHeader = computed(() => {
    const headers: Record<StockControlTab, { icon: string; title: string; description: string }> = {
        inventory: { icon: 'package', title: 'Inventory Items', description: 'Physical stock master with category, reorder policy, opening stock, and warehouse operations.' },
        ledger: { icon: 'activity', title: 'Stock Ledger', description: 'All stock movements recorded against inventory items.' },
        'department-stock': { icon: 'building-2', title: 'Department Stock', description: 'Stock issued out of the store and held by departments for local use.' },
    };
    return headers[activeTab.value];
});
const filterCount = computed(() => {
    let count = 0;
    const tab = activeTab.value;
    if (tab === 'inventory' && itemSearch.perPage !== 50) count++;
    else if (tab === 'ledger' && stockLedgerFilters.perPage !== 50) count++;
    else if (tab === 'department-stock' && departmentStockFilters.perPage !== 50) count++;
    if (itemSearch.category) count++;
    if (itemSearch.stockState) count++;
    if (itemSearch.sortBy !== 'itemName') count++;
    if (stockLedgerFilters.movementType) count++;
    if (stockLedgerFilters.sourceKey) count++;
    if (stockLedgerFilters.from || stockLedgerFilters.to) count++;
    if (departmentStockFilters.departmentId) count++;
    return count;
});

const canSelectAnyRequisitionDepartment = computed(() => false);
const departmentFilterOptions = computed<Array<{ id: string; name: string; code?: string | null }>>(() => []);
function setDepartmentStockDepartmentFilter(value: string): void {
    departmentStockFilters.departmentId = fromSelectValue(value);
    departmentStockFilters.page = 1;
    void loadDepartmentStock();
}

const searchPlaceholder = computed(() => {
    if (activeTab.value === 'inventory') return 'Item code, name, category...';
    if (activeTab.value === 'ledger') return 'Search item, reason, notes, reference…';
    return 'Department, item, category, warehouse…';
});

function handleSearch() {
    if (activeTab.value === 'inventory') flushInventorySearch();
    else if (activeTab.value === 'ledger') applyStockLedgerFilters();
    else applyDepartmentStockFilters();
}

function resetAllFilters() {
    itemSearch.q = '';
    itemSearch.category = '';
    itemSearch.stockState = '';
    itemSearch.sortBy = 'itemName';
    itemSearch.sortDir = 'asc';
    itemSearch.perPage = 50;
    itemSearch.page = 1;
    stockLedgerFilters.q = '';
    stockLedgerFilters.movementType = '';
    stockLedgerFilters.sourceKey = '';
    stockLedgerFilters.from = '';
    stockLedgerFilters.to = '';
    stockLedgerFilters.perPage = 50;
    stockLedgerFilters.page = 1;
    departmentStockFilters.q = '';
    departmentStockFilters.departmentId = '';
    departmentStockFilters.perPage = 50;
    departmentStockFilters.page = 1;
    if (activeTab.value === 'inventory') refreshInventoryItems();
    else if (activeTab.value === 'ledger') loadStockLedger();
    else loadDepartmentStock();
}

function applyFilters() {
    if (activeTab.value === 'inventory') { itemSearch.page = 1; refreshInventoryItems(); }
    else if (activeTab.value === 'ledger') applyStockLedgerFilters();
    else applyDepartmentStockFilters();
}
function handlePerPageChange(value: string) {
    const perPage = Number(value);
    if (activeTab.value === 'inventory') {
        itemSearch.perPage = perPage;
        itemSearch.page = 1;
        refreshInventoryItems();
    } else if (activeTab.value === 'ledger') {
        stockLedgerFilters.perPage = perPage;
        stockLedgerFilters.page = 1;
        loadStockLedger();
    } else {
        departmentStockFilters.perPage = perPage;
        departmentStockFilters.page = 1;
        loadDepartmentStock();
    }
}
const loading = ref(true);
const catalogExporting = ref(false);
const catalogPrinting = ref(false);
const queueError = ref<string | null>(null);
const referenceStructureLoaded = ref(false);

const items = ref<any[]>([]);
const itemPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const itemCounts = ref({ outOfStock: 0, lowStock: 0, healthy: 0, total: 0 });
const itemSearch = reactive({ q: '', category: '', stockState: '', sortBy: 'itemName', sortDir: 'asc', page: 1, perPage: 50 });
function itemQuery() { return { q: itemSearch.q.trim() || null, category: itemSearch.category.trim() || null, stockState: itemSearch.stockState || null, sortBy: itemSearch.sortBy || null, sortDir: itemSearch.sortDir || null, requestingDepartmentId: inventoryItemRequestingDepartmentId.value || null, page: itemSearch.page, perPage: itemSearch.perPage }; }

const stockMovements = ref<any[]>([]);
const stockMovementPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const stockLedgerLoading = ref(false);
const stockLedgerFiltersOpen = ref(false);
const stockLedgerSummary = ref({ total: 0, receive: 0, issue: 0, adjust: 0, transfer: 0, reconciliationAdjustments: 0, reconciliationIncreases: 0, reconciliationDecreases: 0, distinctItems: 0, netQuantityDelta: 0 });
const stockLedgerFilters = reactive({ q: '', itemId: '', movementType: '', sourceKey: '', actorType: '', actorId: '', from: '', to: '', page: 1, perPage: 50 });

const departmentStock = ref<any[]>([]);
const departmentStockPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const departmentStockLoading = ref(false);
const departmentStockFiltersOpen = ref(false);
const departmentStockSummary = ref({ totalRows: 0, departments: 0, items: 0, totalIssuedQuantity: 0, lastIssuedAt: null as string | null });
const departmentStockScopedItem = ref<{ id: string; name: string; code?: string | null } | null>(null);
const departmentStockFilters = reactive({ q: '', departmentId: '', itemId: '', page: 1, perPage: 50 });

function stockLedgerQuery() {
    return {
        q: stockLedgerFilters.q.trim() || null,
        itemId: stockLedgerFilters.itemId.trim() || null,
        movementType: stockLedgerFilters.movementType || null,
        sourceKey: stockLedgerFilters.sourceKey || null,
        actorType: stockLedgerFilters.actorType || null,
        actorId: stockLedgerFilters.actorId.trim() || null,
        from: stockLedgerFilters.from || null,
        to: stockLedgerFilters.to || null,
        page: stockLedgerFilters.page,
        perPage: stockLedgerFilters.perPage,
    };
}

function departmentStockQuery() {
    return {
        q: departmentStockFilters.q.trim() || null,
        departmentId: departmentStockFilters.departmentId.trim() || null,
        itemId: departmentStockFilters.itemId.trim() || null,
        page: departmentStockFilters.page,
        perPage: departmentStockFilters.perPage,
    };
}

async function loadReferenceData() {
    if (!canRead.value) return;
    try {
        const response = await apiRequest<any>('GET', '/inventory-procurement/reference-data');
        if (Array.isArray(response.categoryOptions) && response.categoryOptions.length > 0) {
            itemCategoryOptions.value = response.categoryOptions;
        } else if (response.categories) {
            itemCategoryOptions.value = Object.entries(response.categories).map(([value, label]) => fallbackCategoryOption(value, label as string));
        }
        if (Array.isArray(response.venClassifications) && response.venClassifications.length > 0) {
            venClassificationOptions.value = response.venClassifications;
        }
        if (Array.isArray(response.abcClassifications) && response.abcClassifications.length > 0) {
            abcClassificationOptions.value = response.abcClassifications;
        }
        if (Array.isArray(response.storageConditionOptions) && response.storageConditionOptions.length > 0) {
            storageConditionOptions.value = response.storageConditionOptions;
        } else if (Array.isArray(response.storageConditions) && response.storageConditions.length > 0) {
            storageConditionOptions.value = response.storageConditions.map((v: string) => ({ value: v, label: formatEnumLabel(v) }));
        }
        if (Array.isArray(response.controlledSubstanceScheduleOptions) && response.controlledSubstanceScheduleOptions.length > 0) {
            controlledSubstanceScheduleOptions.value = response.controlledSubstanceScheduleOptions;
        } else if (Array.isArray(response.controlledSubstanceSchedules) && response.controlledSubstanceSchedules.length > 0) {
            controlledSubstanceScheduleOptions.value = response.controlledSubstanceSchedules.map((v: string) => ({ value: v, label: formatEnumLabel(v) }));
        }
        const clinicalItems = Array.isArray(response.clinicalCatalogItems) ? response.clinicalCatalogItems : response.formularyCatalogItems;
        clinicalCatalogItems.value = Array.isArray(clinicalItems) ? clinicalItems.filter((item: any) => typeof item?.id === 'string' && item.id.trim().length > 0) : [];
    } catch {
        itemCategoryOptions.value = [...DEFAULT_ITEM_CATEGORIES];
        venClassificationOptions.value = [...VEN_CLASSIFICATIONS];
        abcClassificationOptions.value = [...ABC_CLASSIFICATIONS];
        storageConditionOptions.value = [...STORAGE_CONDITIONS];
        controlledSubstanceScheduleOptions.value = [...CONTROLLED_SUBSTANCE_SCHEDULES];
        clinicalCatalogItems.value = [];
    }
}

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

async function loadItems() {
    if (!canRead.value) return;
    const [listResponse, countsResponse] = await Promise.all([
        apiRequest<{ data: any[]; meta: { currentPage: number; lastPage: number; total?: number } }>('GET', '/inventory-procurement/items', {
            query: {
                q: itemSearch.q.trim() || null,
                category: itemSearch.category.trim() || null,
                stockState: itemSearch.stockState || null,
                sortBy: itemSearch.sortBy || null,
                sortDir: itemSearch.sortDir || null,
                requestingDepartmentId: inventoryItemRequestingDepartmentId.value || null,
                page: itemSearch.page,
                perPage: itemSearch.perPage,
            },
        }),
        apiRequest<{ data: typeof itemCounts.value }>('GET', '/inventory-procurement/stock-alert-counts', {
            query: {
                q: itemSearch.q.trim() || null,
                category: itemSearch.category.trim() || null,
                requestingDepartmentId: inventoryItemRequestingDepartmentId.value || null,
            },
        }),
    ]);
    items.value = listResponse.data;
    itemPagination.value = listResponse.meta;
    itemCounts.value = countsResponse.data;
}

async function loadStockLedger() {
    if (!canRead.value) return;
    stockLedgerLoading.value = true;
    try {
        const [listResponse, summaryResponse] = await Promise.all([
            apiRequest<{ data: any[]; meta: { currentPage: number; lastPage: number; total?: number } }>('GET', '/inventory-procurement/stock-movements', {
                query: stockLedgerQuery(),
            }),
            apiRequest<{ data: typeof stockLedgerSummary.value }>('GET', '/inventory-procurement/stock-movements/summary', {
                query: stockLedgerQuery(),
            }),
        ]);
        stockMovements.value = listResponse.data ?? [];
        stockMovementPagination.value = listResponse.meta ?? null;
        stockLedgerSummary.value = summaryResponse.data ?? {
            total: 0, receive: 0, issue: 0, adjust: 0, transfer: 0,
            reconciliationAdjustments: 0, reconciliationIncreases: 0, reconciliationDecreases: 0,
            distinctItems: 0, netQuantityDelta: 0,
        };
    } catch {
        stockMovements.value = [];
        stockMovementPagination.value = null;
        stockLedgerSummary.value = {
            total: 0, receive: 0, issue: 0, adjust: 0, transfer: 0,
            reconciliationAdjustments: 0, reconciliationIncreases: 0, reconciliationDecreases: 0,
            distinctItems: 0, netQuantityDelta: 0,
        };
    } finally {
        stockLedgerLoading.value = false;
    }
}

async function loadDepartmentStock() {
    if (!canRead.value) return;
    departmentStockLoading.value = true;
    try {
        const response = await apiRequest<{
            data: any[];
            summary?: typeof departmentStockSummary.value;
            meta: { currentPage: number; lastPage: number; total?: number };
        }>('GET', '/inventory-procurement/department-stock-balances', {
            query: departmentStockQuery(),
        });
        departmentStock.value = response.data ?? [];
        departmentStockSummary.value = response.summary ?? {
            totalRows: 0, departments: 0, items: 0, totalIssuedQuantity: 0, lastIssuedAt: null,
        };
        departmentStockPagination.value = response.meta ?? null;
    } catch {
        departmentStock.value = [];
        departmentStockPagination.value = null;
        departmentStockSummary.value = {
            totalRows: 0, departments: 0, items: 0, totalIssuedQuantity: 0, lastIssuedAt: null,
        };
    } finally {
        departmentStockLoading.value = false;
    }
}

async function refreshInventoryItems(): Promise<void> {
    if (!canRead.value || loading.value) return;
    loading.value = true;
    queueError.value = null;
    try {
        await loadItems();
        await loadSuppliersAndWarehouses();
    } catch (error) {
        queueError.value = messageFromUnknown(error, 'Unable to load inventory items.');
    } finally {
        loading.value = false;
    }
}

async function reloadAll() {
    if (!canRead.value) { loading.value = false; return; }
    loading.value = true;
    queueError.value = null;
    try {
        await loadReferenceData();
        await loadSuppliersAndWarehouses();
        await Promise.all([loadItems(), loadStockLedger(), loadDepartmentStock()]);
    } catch (error) {
        queueError.value = messageFromUnknown(error, 'Unable to load inventory/procurement data.');
    } finally {
        loading.value = false;
    }
}

const compactProcurementRows = useLocalStorageBoolean('inventory.procurement.procurement.compact', false);
type InventoryAutoRefreshKey = 'off' | '30s' | '1m' | '5m';
const INVENTORY_AUTO_REFRESH_INTERVAL_MS: Record<InventoryAutoRefreshKey, number> = { off: 0, '30s': 30_000, '1m': 60_000, '5m': 300_000 };
const INVENTORY_AUTO_REFRESH_LABEL: Record<InventoryAutoRefreshKey, string> = { off: 'Auto: Off', '30s': 'Auto: 30s', '1m': 'Auto: 1m', '5m': 'Auto: 5m' };

function useLocalStorageString<T extends string>(key: string, defaultValue: T, valid: readonly T[]): Ref<T> {
    const state = ref(defaultValue) as Ref<T>;
    onMounted(() => { if (typeof window === 'undefined') return; const raw = window.localStorage.getItem(key); if (raw && (valid as readonly string[]).includes(raw)) state.value = raw as T; });
    watch(state, (value) => { if (typeof window === 'undefined') return; window.localStorage.setItem(key, value); });
    return state;
}

const inventoryAutoRefreshInterval = useLocalStorageString<InventoryAutoRefreshKey>('inventory.procurement.items.auto-refresh', 'off', ['off', '30s', '1m', '5m']);
const inventoryItemSetupBlockedReason = computed(() => {
    if (!referenceStructureLoaded.value) return null;
    if (!warehouseReady.value && !supplierReady.value) return 'Create at least one warehouse and one supplier first so inventory items can attach to a real stock structure.';
    if (!warehouseReady.value) return 'Create a warehouse first so inventory items can belong to a real stock location.';
    if (!supplierReady.value) return 'Create a supplier first so inventory items can carry a real procurement source.';
    return null;
});
const stockExecutionBlockedReason = computed(() => {
    if (!warehouseReady.value) return 'Create a warehouse first before recording stock movement or stock reconciliation.';
    if (itemCounts.value.total <= 0) return 'Create the first inventory item before recording stock movement or stock reconciliation.';
    return null;
});

const canLaunchCreateItem = computed(() => canManageItems.value && !inventoryItemSetupBlockedReason.value);
const canLaunchStockMovement = computed(() => canCreateMovement.value && !stockExecutionBlockedReason.value);
const canLaunchOpeningStock = computed(() => canSetOpeningStock.value && canCreateMovement.value && !stockExecutionBlockedReason.value);
const canLaunchReconciliation = computed(() => canReconcileStock.value && !stockExecutionBlockedReason.value);

const canSyncFromCatalog = computed(() => canManageItems.value);

interface HeaderAction {
    key: string; label: string; icon: string; variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
    show: boolean; disabled?: boolean; loading?: boolean; iconOnly?: boolean; onClick?: () => void; class?: string;
    isDropdown?: boolean; dropdownOptions?: Array<{ value: string; label: string }>; dropdownValue?: string; onDropdownChange?: (value: string) => void;
    isMenuDropdown?: boolean; menuItems?: Array<{ key: string; label: string; icon: string; onClick: () => void; disabled?: boolean }>;
}

const headerActions = computed<HeaderAction[]>(() => {
    const actions: HeaderAction[] = [];
    if (activeTab.value === 'inventory') {
        actions.push({ key: 'auto-refresh', label: 'Auto', icon: 'clock', variant: 'outline', show: true, isDropdown: true, dropdownValue: inventoryAutoRefreshInterval.value, dropdownOptions: [{ value: 'off', label: INVENTORY_AUTO_REFRESH_LABEL.off }, { value: '30s', label: INVENTORY_AUTO_REFRESH_LABEL['30s'] }, { value: '1m', label: INVENTORY_AUTO_REFRESH_LABEL['1m'] }, { value: '5m', label: INVENTORY_AUTO_REFRESH_LABEL['5m'] }], onDropdownChange: (value) => { inventoryAutoRefreshInterval.value = value as InventoryAutoRefreshKey; } });
        actions.push({ key: 'create-item', label: 'New Item', icon: 'plus', variant: 'default', show: canManageItems.value, disabled: !canLaunchCreateItem.value, onClick: () => openCreateItemDialog() });
    }
    if (activeTab.value === 'ledger') {
        actions.push({ key: 'stock-adjustment', label: 'Stock Adjustment', icon: 'sliders-horizontal', variant: 'default', show: canCreateMovement.value, disabled: !canLaunchStockMovement.value, onClick: () => openStockMovementDialog(null, 'adjust') });
        actions.push({ key: 'stock-transfer', label: 'Stock Transfer', icon: 'arrow-right', variant: 'outline', show: canCreateMovement.value, disabled: !canLaunchStockMovement.value, onClick: () => openStockMovementDialog(null, 'transfer') });
    }
    if (activeTab.value === 'department-stock') {
        actions.push({ key: 'issue-stock', label: 'Issue Stock', icon: 'package', variant: 'default', show: canCreateMovement.value, disabled: !canLaunchStockMovement.value, onClick: () => openStockMovementDialog(null, 'issue') });
        actions.push({ key: 'receive-stock', label: 'Receive Stock', icon: 'arrow-right', variant: 'outline', show: canCreateMovement.value, disabled: !canLaunchStockMovement.value, onClick: () => openStockMovementDialog(null, 'receive') });
        actions.push({ key: 'transfer-stock', label: 'Transfer Stock', icon: 'arrow-up-down', variant: 'outline', show: canCreateMovement.value, disabled: !canLaunchStockMovement.value, onClick: () => openStockMovementDialog(null, 'transfer') });
    }
    actions.push({ key: 'export', label: 'Export', icon: 'download', variant: 'outline', show: true, disabled: catalogExporting.value, onClick: () => handleExport() });
    actions.push({ key: 'print', label: 'Print', icon: 'printer', variant: 'outline', show: true, disabled: catalogPrinting.value, onClick: () => handlePrint() });
    return actions.filter(action => action.show);
});

// ── Catalogue sync ──
const catalogSyncDialogOpen = ref(false);
const importItemsCsvDialogOpen = ref(false);
const importItemsCsvSubmitting = ref(false);
const importItemsCsvFile = ref<File | null>(null);
const importItemsCsvInputKey = ref(0);
const importItemsCsvResult = ref<{ successful: number; failed: number; errors?: string } | null>(null);

function openCatalogSyncDialog() { catalogSyncDialogOpen.value = true; }

// ── Item create state ──
const createItemDialogOpen = ref(false);
const createItemWarehouseOpen = ref(false);
const createItemSupplierOpen = ref(false);
const updateItemWarehouseOpen = ref(false);
const updateItemSupplierOpen = ref(false);
const stockMovementDialogOpen = ref(false);
const stockMovementCorrectionDialogOpen = ref(false);
const stockMovementCorrectionSubmitting = ref(false);
const stockMovementCorrectionErrors = ref<Record<string, string[]>>({});
const stockMovementCorrectionItem = ref<StockMovementLookupItem | null>(null);
const stockMovementCorrectionMovement = ref<any>(null);
const stockMovementCorrectionForm = reactive({ quantity: '', reason: '', reasonCode: 'audit_correction' });
function resetStockMovementCorrectionForm(item: any | null = null): void {
    stockMovementCorrectionItem.value = item;
    stockMovementCorrectionMovement.value = null;
    stockMovementCorrectionForm.quantity = '';
    stockMovementCorrectionForm.reason = '';
    stockMovementCorrectionForm.reasonCode = 'audit_correction';
}
const reconcileDialogOpen = ref(false);
const createItemDiscardConfirmOpen = ref(false);
const itemDetailsDiscardConfirmOpen = ref(false);
const createItemRequestKey = ref(generateRequestKey('inventory-item-create'));
const itemUpdateRequestKey = ref(generateRequestKey('inventory-item-update'));
const itemStatusRequestKey = ref(generateRequestKey('inventory-item-status'));

const stockMovementSubmitting = ref(false);
const stockMovementErrors = ref<Record<string, string[]>>({});
const stockMovementSelectedItem = ref<StockMovementLookupItem | null>(null);
const stockMovementForm = reactive({ itemId: '', category: '', subcategory: '', movementType: 'receive', adjustmentDirection: 'increase', batchId: '', batchNumber: '', lotNumber: '', manufactureDate: '', expiryDate: '', binLocation: '', sourceSupplierId: '', sourceWarehouseId: '', destinationWarehouseId: '', destinationDepartmentId: '', quantity: '', reason: '', reasonCode: '', notes: '', occurredAt: '' });

const stockReconciliationSubmitting = ref(false);
const stockReconciliationErrors = ref<Record<string, string[]>>({});
const stockReconciliationSelectedItem = ref<StockMovementLookupItem | null>(null);
const stockReconciliationForm = reactive({ itemId: '', batchId: '', countedStock: '', countedBatchQuantity: '', sessionReference: '', reason: '', notes: '', occurredAt: '' });
const stockMovementBatchOptions = ref<any[]>([]);
const stockMovementBatchesLoading = ref(false);
const stockReconciliationBatchOptions = ref<any[]>([]);
const stockReconciliationBatchesLoading = ref(false);
const transferBatchOptionsByItemId = ref<Record<string, any[]>>({});
const transferBatchLoadingByItemId = ref<Record<string, boolean>>({});

const suppliers = ref<{ id: string; name: string; code: string | null }[]>([]);
const warehouses = ref<{ id: string; name: string; code: string | null }[]>([]);
const departments = ref<{ id: string; name: string; code: string | null }[]>([]);
const supplierReady = computed(() => suppliers.value.length > 0);
const warehouseReady = computed(() => warehouses.value.length > 0);

const flashedItemId = ref<string | null>(null);
const flashedRequestId = ref<string | null>(null);
let flashedItemTimer: ReturnType<typeof setTimeout> | null = null;
const flashedRequestTimer: ReturnType<typeof setTimeout> | null = null;
const pollingTimer: ReturnType<typeof setInterval> | null = null;
let inventorySearchTimer: ReturnType<typeof setTimeout> | null = null;
let stockLedgerSearchTimer: ReturnType<typeof setTimeout> | null = null;
let departmentStockSearchTimer: ReturnType<typeof setTimeout> | null = null;
let stockMovementSelectionResetLocked = false;

const inventoryItemRequestingDepartmentId = ref<string | null>(null);

const stockMovementTypeMeta: Record<string, { label: string; description: string; impact: string; reasonPlaceholder: string }> = {
    receive: { label: 'Receive', description: 'Add delivered, returned, or opening-balance stock into on-hand inventory.', impact: 'Adds stock', reasonPlaceholder: 'Delivery note, return note, opening balance, or receipt reference' },
    issue: { label: 'Issue', description: 'Remove stock issued to wards, departments, procedures, or direct patient use.', impact: 'Reduces stock', reasonPlaceholder: 'Ward issue, patient dispense, damaged issue, or issue reference' },
    adjust: { label: 'Adjust', description: 'Correct stock variance after count, expiry write-off, spoilage, or audit findings.', impact: 'Variance control', reasonPlaceholder: 'Cycle count variance, expiry write-off, damaged stock, or audit correction' },
    transfer: { label: 'Transfer Out', description: 'Record stock leaving the current store before it is received elsewhere.', impact: 'Reduces stock', reasonPlaceholder: 'Transfer reference, destination store, or transfer reason' },
};
const stockStateOptions = ['out_of_stock', 'low_stock', 'healthy'] as const;
const movementTypeOptions = ['receive', 'issue', 'adjust', 'transfer'] as const;
const auditActorTypeOptions = [{ value: '', label: 'All actors' }, { value: 'user', label: 'User only' }, { value: 'system', label: 'System only' }] as const;
const stockLedgerSourceOptions = [{ value: '', label: 'All sources' }, { value: 'clinical_consumption', label: 'Clinical consumption' }, { value: 'procurement_receipt', label: 'Procurement receipt' }, { value: 'warehouse_transfer', label: 'Warehouse transfer' }, { value: 'stock_reconciliation', label: 'Stock reconciliation' }, { value: 'manual_entry', label: 'Manual entry' }, { value: 'system_generated', label: 'Other system' }] as const;
const correctionReasonOptions: Array<{ value: string; label: string }> = [{ value: 'opening_balance', label: 'Opening Balance Correction' }, { value: 'physical_count_adjustment', label: 'Physical Count Adjustment' }, { value: 'audit_correction', label: 'Audit Correction' }, { value: 'other', label: 'Other' }];
const stockMovementReasonOptions: Array<{ value: string; label: string }> = [{ value: 'opening_balance', label: 'Opening Balance' }, { value: 'physical_count_adjustment', label: 'Physical Count Adjustment' }, { value: 'expiry_write_off', label: 'Expiry Write-off' }, { value: 'damaged_stock', label: 'Damaged Stock' }, { value: 'donation', label: 'Donation' }, { value: 'emergency_replenishment', label: 'Emergency Replenishment' }, { value: 'audit_correction', label: 'Audit Correction' }, { value: 'return_to_supplier', label: 'Return to Supplier' }, { value: 'other', label: 'Other' }];

const DEFAULT_ITEM_CATEGORIES: InventoryCategoryOption[] = [
    { value: 'pharmaceutical', label: 'Pharmaceutical', template: 'pharmaceutical', description: 'Medicine stock master with dispensing, clinical classification, and reimbursement mapping fields.', requiresExpiryTracking: true, requiresColdChain: false, controlledSubstanceEligible: true, supportsMedicineDetails: true, supportsStorageFields: true, supportsClinicalClassification: true },
    { value: 'medical_consumable', label: 'Medical Consumable', template: 'general_supply', description: 'General stock item with supplier, warehouse, barcode, and stock-threshold defaults.', requiresExpiryTracking: false, requiresColdChain: false, controlledSubstanceEligible: false, supportsMedicineDetails: false, supportsStorageFields: false, supportsClinicalClassification: true },
    { value: 'laboratory', label: 'Laboratory Reagent & Supply', template: 'expiry_sensitive', description: 'Expiry-sensitive reagent and laboratory supply inventory with storage-handling requirements.', requiresExpiryTracking: true, requiresColdChain: false, controlledSubstanceEligible: false, supportsMedicineDetails: false, supportsStorageFields: true, supportsClinicalClassification: true },
    { value: 'surgical_instrument', label: 'Surgical Instrument', template: 'specialist_equipment', description: 'Specialist stock master for procurement and replenishment defaults.', requiresExpiryTracking: false, requiresColdChain: false, controlledSubstanceEligible: false, supportsMedicineDetails: false, supportsStorageFields: false, supportsClinicalClassification: false },
    { value: 'medical_equipment', label: 'Medical Equipment', template: 'specialist_equipment', description: 'Specialist stock master for procurement and replenishment defaults.', requiresExpiryTracking: false, requiresColdChain: false, controlledSubstanceEligible: false, supportsMedicineDetails: false, supportsStorageFields: false, supportsClinicalClassification: false },
    { value: 'linen_textile', label: 'Linen & Textile', template: 'general_supply', description: 'General stock item with supplier, warehouse, barcode, and stock-threshold defaults.', requiresExpiryTracking: false, requiresColdChain: false, controlledSubstanceEligible: false, supportsMedicineDetails: false, supportsStorageFields: false, supportsClinicalClassification: false },
    { value: 'food_nutrition', label: 'Food & Nutrition', template: 'expiry_sensitive', description: 'Expiry-sensitive nutrition inventory with storage defaults and replenishment controls.', requiresExpiryTracking: true, requiresColdChain: false, controlledSubstanceEligible: false, supportsMedicineDetails: false, supportsStorageFields: true, supportsClinicalClassification: false },
    { value: 'office_admin', label: 'Office & Admin Supply', template: 'general_supply', description: 'General stock item with supplier, warehouse, barcode, and stock-threshold defaults.', requiresExpiryTracking: false, requiresColdChain: false, controlledSubstanceEligible: false, supportsMedicineDetails: false, supportsStorageFields: false, supportsClinicalClassification: false },
    { value: 'cleaning_sanitation', label: 'Cleaning & Sanitation', template: 'general_supply', description: 'General stock item with supplier, warehouse, barcode, and stock-threshold defaults.', requiresExpiryTracking: false, requiresColdChain: false, controlledSubstanceEligible: false, supportsMedicineDetails: false, supportsStorageFields: false, supportsClinicalClassification: false },
    { value: 'blood_product', label: 'Blood Product', template: 'expiry_sensitive', description: 'Expiry-sensitive and cold-chain inventory.', requiresExpiryTracking: true, requiresColdChain: true, controlledSubstanceEligible: false, supportsMedicineDetails: false, supportsStorageFields: true, supportsClinicalClassification: true },
    { value: 'ppe', label: 'Personal Protective Equipment', template: 'general_supply', description: 'General stock item with supplier, warehouse, barcode, and stock-threshold defaults.', requiresExpiryTracking: false, requiresColdChain: false, controlledSubstanceEligible: false, supportsMedicineDetails: false, supportsStorageFields: false, supportsClinicalClassification: false },
    { value: 'dental', label: 'Dental', template: 'specialist_equipment', description: 'Specialist stock master for procurement and replenishment defaults.', requiresExpiryTracking: false, requiresColdChain: false, controlledSubstanceEligible: false, supportsMedicineDetails: false, supportsStorageFields: false, supportsClinicalClassification: true },
    { value: 'radiology', label: 'Radiology', template: 'specialist_equipment', description: 'Specialist stock master for procurement and replenishment defaults.', requiresExpiryTracking: false, requiresColdChain: false, controlledSubstanceEligible: false, supportsMedicineDetails: false, supportsStorageFields: false, supportsClinicalClassification: true },
    { value: 'other', label: 'Other', template: 'general_supply', description: 'General stock item with supplier, warehouse, barcode, and stock-threshold defaults.', requiresExpiryTracking: false, requiresColdChain: false, controlledSubstanceEligible: false, supportsMedicineDetails: false, supportsStorageFields: false, supportsClinicalClassification: false },
];
const VEN_CLASSIFICATIONS = [{ value: 'vital', label: 'Vital' }, { value: 'essential', label: 'Essential' }, { value: 'non_essential', label: 'Non-Essential' }] as const;
const ABC_CLASSIFICATIONS = [{ value: 'A', label: 'A - High Value' }, { value: 'B', label: 'B - Medium Value' }, { value: 'C', label: 'C - Low Value' }] as const;
const STORAGE_CONDITIONS = [{ value: 'room_temperature', label: 'Room Temperature' }, { value: 'cool_dry_place', label: 'Cool & Dry Place' }, { value: 'refrigerated_2_8c', label: 'Refrigerated (2-8C)' }, { value: 'frozen_minus_20c', label: 'Frozen (-20C)' }, { value: 'frozen_minus_70c', label: 'Frozen (-70C)' }, { value: 'protect_from_light', label: 'Protect from Light' }] as const;
const CONTROLLED_SUBSTANCE_SCHEDULES = [{ value: 'schedule_I', label: 'Schedule I' }, { value: 'schedule_II', label: 'Schedule II' }, { value: 'schedule_III', label: 'Schedule III' }, { value: 'schedule_IV', label: 'Schedule IV' }] as const;
const DOSAGE_FORM_OPTIONS: SearchableSelectOption[] = [
    { value: 'tablet', label: 'Tablet', group: 'Oral solid', keywords: ['tab'] }, { value: 'capsule', label: 'Capsule', group: 'Oral solid', keywords: ['cap'] },
    { value: 'dispersible tablet', label: 'Dispersible tablet', group: 'Oral solid', keywords: ['dt', 'soluble'] }, { value: 'chewable tablet', label: 'Chewable tablet', group: 'Oral solid' },
    { value: 'powder', label: 'Powder', group: 'Oral solid', keywords: ['oral powder'] }, { value: 'sachet', label: 'Sachet', group: 'Oral solid', keywords: ['packet'] },
    { value: 'syrup', label: 'Syrup', group: 'Oral liquid' }, { value: 'suspension', label: 'Suspension', group: 'Oral liquid' },
    { value: 'oral solution', label: 'Oral solution', group: 'Oral liquid' }, { value: 'drops', label: 'Drops', group: 'Topical / local', keywords: ['eye drops', 'ear drops'] },
    { value: 'cream', label: 'Cream', group: 'Topical / local' }, { value: 'ointment', label: 'Ointment', group: 'Topical / local' },
    { value: 'gel', label: 'Gel', group: 'Topical / local' }, { value: 'inhaler', label: 'Inhaler', group: 'Respiratory' },
    { value: 'nebuliser solution', label: 'Nebuliser solution', group: 'Respiratory', keywords: ['nebulizer'] }, { value: 'injection', label: 'Injection', group: 'Parenteral' },
    { value: 'vial', label: 'Vial', group: 'Parenteral' }, { value: 'ampoule', label: 'Ampoule', group: 'Parenteral', keywords: ['ampule'] },
    { value: 'infusion', label: 'Infusion', group: 'Parenteral', keywords: ['iv fluid'] }, { value: 'suppository', label: 'Suppository', group: 'Rectal / vaginal' },
    { value: 'pessary', label: 'Pessary', group: 'Rectal / vaginal' }, { value: 'patch', label: 'Patch', group: 'Device / implant' },
    { value: 'implant', label: 'Implant', group: 'Device / implant' },
];
const ITEM_SUBCATEGORY_OPTIONS: Record<string, SearchableSelectOption[]> = {
    pharmaceutical: [
        { value: 'analgesics', label: 'Analgesics', group: 'Medicines', keywords: ['pain', 'fever'] }, { value: 'antibiotics', label: 'Antibiotics', group: 'Medicines', keywords: ['antimicrobial'] },
        { value: 'antimalarials', label: 'Antimalarials', group: 'Medicines', keywords: ['malaria', 'alu'] }, { value: 'cardiovascular', label: 'Cardiovascular', group: 'Medicines', keywords: ['bp', 'hypertension'] },
        { value: 'endocrine', label: 'Endocrine / diabetes', group: 'Medicines', keywords: ['diabetes', 'insulin'] }, { value: 'gastrointestinal', label: 'Gastrointestinal', group: 'Medicines', keywords: ['stomach', 'antiemetic'] },
        { value: 'maternal_health', label: 'Maternal health', group: 'Medicines', keywords: ['iron', 'folic', 'antenatal'] }, { value: 'respiratory', label: 'Respiratory', group: 'Medicines', keywords: ['asthma', 'inhaler'] },
        { value: 'dermatology', label: 'Dermatology', group: 'Medicines', keywords: ['skin', 'topical'] }, { value: 'iv_fluids', label: 'IV fluids', group: 'Medicines', keywords: ['infusion', 'fluid'] },
        { value: 'vaccines', label: 'Vaccines / immunization', group: 'Medicines', keywords: ['epi', 'immunization'] }, { value: 'controlled_medicines', label: 'Controlled medicines', group: 'Medicines', keywords: ['narcotic', 'schedule'] },
    ],
    medical_consumable: [
        { value: 'syringes_needles', label: 'Syringes & needles', group: 'Consumables' }, { value: 'dressings_bandages', label: 'Dressings & bandages', group: 'Consumables', keywords: ['wound care'] },
        { value: 'catheters_tubes', label: 'Catheters & tubes', group: 'Consumables' }, { value: 'gloves_ppe', label: 'Gloves & PPE', group: 'Consumables' },
        { value: 'sterilization_consumables', label: 'Sterilization consumables', group: 'Consumables' }, { value: 'patient_care_consumables', label: 'Patient care consumables', group: 'Consumables' },
    ],
};

const itemCategoryOptions = ref<InventoryCategoryOption[]>([...DEFAULT_ITEM_CATEGORIES]);
const venClassificationOptions = ref<SelectOption[]>([...VEN_CLASSIFICATIONS]);
const abcClassificationOptions = ref<SelectOption[]>([...ABC_CLASSIFICATIONS]);
const storageConditionOptions = ref<SelectOption[]>([...STORAGE_CONDITIONS]);
const controlledSubstanceScheduleOptions = ref<SelectOption[]>([...CONTROLLED_SUBSTANCE_SCHEDULES]);
const clinicalCatalogItems = ref<any[]>([]);

function createEmptyItemForm(): InventoryItemFormState {
    return { clinicalCatalogItemId: '', itemCode: '', itemName: '', genericName: '', dosageForm: '', strength: '', category: '', subcategory: '', venClassification: '', abcClassification: '', unit: '', dispensingUnit: '', conversionFactor: '', binLocation: '', manufacturer: '', storageConditions: '', requiresColdChain: false, isControlledSubstance: false, controlledSubstanceSchedule: '', msdCode: '', nhifCode: '', barcode: '', reorderLevel: '', maxStockLevel: '', defaultWarehouseId: '', defaultSupplierId: '' };
}

const itemCreateForm = reactive<InventoryItemFormState>(createEmptyItemForm());
const itemCreateSubmitting = ref(false);
const itemCreateErrors = ref<Record<string, string[]>>({});
const itemCreateRequestError = ref<string | null>(null);
const INVENTORY_ITEM_CREATE_DRAFT_STORAGE_KEY = 'ahs.inventory-procurement.create-item-draft.v1';

function trimmedFormValue(value: unknown): string { return String(value ?? '').trim(); }
function nullableTrimmedFormValue(value: unknown): string | null { const v = String(value ?? '').trim(); return v || null; }
function nullableNumericFormValue(value: unknown): number | null { const v = Number(value); return Number.isFinite(v) && v >= 0 ? v : null; }

const GENERAL_SUBCATEGORY_OPTIONS: SearchableSelectOption[] = [{ value: 'general_supplies', label: 'General supplies', group: 'General' }, { value: 'department_consumables', label: 'Department consumables', group: 'General' }, { value: 'maintenance_supplies', label: 'Maintenance supplies', group: 'General' }, { value: 'other', label: 'Other', group: 'General' }];

function subcategoryOptionsForCategory(categoryValue: string | null | undefined): SearchableSelectOption[] {
    const key = (categoryValue ?? '').trim();
    return ITEM_SUBCATEGORY_OPTIONS[key] ?? GENERAL_SUBCATEGORY_OPTIONS;
}

function resolveCategoryOption(categoryValue: string): InventoryCategoryOption | null {
    if (!categoryValue) return null;
    return itemCategoryOptions.value.find((option) => option.value === categoryValue) ?? null;
}

function fallbackCategoryOption(value: string, label: string): InventoryCategoryOption {
    return DEFAULT_ITEM_CATEGORIES.find((option) => option.value === value) ?? { value, label, template: 'general_supply', description: 'General stock item.', requiresExpiryTracking: false, requiresColdChain: false, controlledSubstanceEligible: false, supportsMedicineDetails: false, supportsStorageFields: false, supportsClinicalClassification: false };
}

const selectedCreateCategory = computed(() => resolveCategoryOption(itemCreateForm.category));
const createSubcategoryOptions = computed(() => subcategoryOptionsForCategory(itemCreateForm.category));

const createClinicalCatalogOptions = computed<SearchableSelectOption[]>(() => []);
const createClinicalCatalogSelectionRequired = computed(() => false);
const createClinicalCatalogOptionsEmpty = computed(() => false);
const createClinicalCatalogSelectionMissing = computed(() => false);
const createIdentityLockedToCatalog = computed(() => false);
const createSelectedCatalogItem = computed(() => null);
const createCategoryWorkflowBadges = computed(() => []);

const hasCreateItemDraftContent = computed(() => itemFormHasDraftContent(itemCreateForm));
const { restoredDraft: restoredCreateItemDraft, clearPersistedDraft: clearPersistedCreateItemDraft } = useWorkflowDraftPersistence<InventoryItemFormState>({ key: INVENTORY_ITEM_CREATE_DRAFT_STORAGE_KEY, shouldPersist: hasCreateItemDraftContent, capture: () => createEmptyItemForm(), restore: () => {}, canRestore: () => false });
const itemCreateSubmitReason = computed(() => null);
const itemCreateSubmitDisabled = computed(() => itemCreateSubmitting.value || itemCreateSubmitReason.value !== null);
const hasPendingCreateItemWorkflow = computed(() => hasCreateItemDraftContent.value);
const hasPendingItemUpdateWorkflow = computed(() => Boolean(itemDetails.value) && currentItemUpdateSnapshot() !== itemUpdateSnapshot.value);
const hasPendingItemStatusWorkflow = computed(() => Boolean(itemDetails.value) && currentItemStatusSnapshot() !== itemStatusSnapshot.value);
const hasPendingItemDetailsWorkflow = computed(() => hasPendingItemUpdateWorkflow.value || hasPendingItemStatusWorkflow.value);
const isSubmittingInventoryWorkflow = computed(() => itemCreateSubmitting.value || itemUpdateSubmitting.value || itemStatusSubmitting.value);

function openCreateItemDialog() {
    if (inventoryItemSetupBlockedReason.value) { notifyError(inventoryItemSetupBlockedReason.value); return; }
    itemCreateErrors.value = {}; itemCreateRequestError.value = null;
    Object.assign(itemCreateForm, createEmptyItemForm());
    rotateCreateItemRequestKey();
    createItemDialogOpen.value = true;
}

function closeCreateItemDialog(): void {
    createItemDialogOpen.value = false; createItemDiscardConfirmOpen.value = false;
    itemCreateErrors.value = {}; itemCreateRequestError.value = null;
    Object.assign(itemCreateForm, createEmptyItemForm()); rotateCreateItemRequestKey();
}

function requestCreateItemOpenChange(open: boolean): void { if (open) { createItemDialogOpen.value = true; return; } if (itemCreateSubmitting.value) return; if (hasCreateItemDraftContent.value) { createItemDiscardConfirmOpen.value = true; return; } closeCreateItemDialog(); }
function confirmCreateItemDiscard(): void { closeCreateItemDialog(); }
function rotateCreateItemRequestKey(): void { createItemRequestKey.value = generateRequestKey('inventory-item-create'); }
function rotateItemUpdateRequestKey(): void { itemUpdateRequestKey.value = generateRequestKey('inventory-item-update'); }
function rotateItemStatusRequestKey(): void { itemStatusRequestKey.value = generateRequestKey('inventory-item-status'); }

function resetStockMovementForm(item: StockMovementLookupItem | null = null): void {
    stockMovementSelectedItem.value = item; stockMovementBatchOptions.value = []; stockMovementSelectionResetLocked = true;
    Object.assign(stockMovementForm, { itemId: item?.id ?? '', category: item?.category ?? '', subcategory: item?.subcategory ?? '', movementType: 'receive', adjustmentDirection: 'increase', batchId: '', batchNumber: '', lotNumber: '', manufactureDate: '', expiryDate: '', binLocation: '', sourceSupplierId: '', sourceWarehouseId: '', destinationWarehouseId: '', destinationDepartmentId: '', quantity: '', reason: '', notes: '', occurredAt: currentDateTimeLocal() });
}

function currentDateTimeLocal(): string { const date = new Date(); return new Date(date.getTime() - (date.getTimezoneOffset() * 60_000)).toISOString().slice(0, 16); }

function openStockMovementDialog(item: StockMovementLookupItem | null = null, movementType?: 'receive' | 'issue' | 'adjust' | 'transfer') {
    if (stockExecutionBlockedReason.value) { notifyError(stockExecutionBlockedReason.value); return; }
    if (item && inventoryItemNeedsOpeningStock(item) && !canSetOpeningStock.value) { notifyError('You do not have permission to set opening stock. Contact a supervisor or manager.'); return; }
    if (item && !inventoryItemNeedsOpeningStock(item) && !canCreateMovement.value) { notifyError('You do not have permission to record stock movements.'); return; }
    stockMovementErrors.value = {}; resetStockMovementForm(item);
    if (movementType) stockMovementForm.movementType = movementType;
    stockMovementDialogOpen.value = true;
}

function openReconcileDialog() {
    if (stockExecutionBlockedReason.value) { notifyError(stockExecutionBlockedReason.value); return; }
    stockReconciliationErrors.value = {}; resetStockReconciliationForm(); reconcileDialogOpen.value = true;
}

function resetStockReconciliationForm(item: StockMovementLookupItem | null = null): void {
    stockReconciliationSelectedItem.value = item; stockReconciliationBatchOptions.value = [];
    Object.assign(stockReconciliationForm, { itemId: item?.id ?? '', batchId: '', countedStock: '', countedBatchQuantity: '', sessionReference: '', reason: '', notes: '', occurredAt: currentDateTimeLocal() });
}

function handleStockMovementItemSelected(item: StockMovementLookupItem | null): void {
    stockMovementSelectedItem.value = item;
    if (inventoryItemNeedsOpeningStock(item)) { stockMovementForm.movementType = 'receive'; stockMovementForm.reasonCode = 'opening_balance'; stockMovementForm.sourceSupplierId = ''; stockMovementForm.sourceWarehouseId = ''; stockMovementForm.destinationDepartmentId = ''; }
}

function inventoryItemNeedsOpeningStock(item: StockMovementLookupItem | Record<string, unknown> | null | undefined): boolean { return Boolean(item) && (Number((item as any)?.movementCount ?? 0) <= 0); }
function inventoryItemHasOpeningStock(item: StockMovementLookupItem | Record<string, unknown> | null | undefined): boolean { return Boolean(item) && (Number((item as any)?.openingStockMovementCount ?? 0) > 0); }
function inventoryItemStockActionLabel(item: StockMovementLookupItem | Record<string, unknown>): string { return inventoryItemNeedsOpeningStock(item) ? 'Set Opening Stock' : 'Record Item Movement'; }
function stockStateDotClass(state: string | null | undefined): string { if (state === 'out_of_stock') return 'bg-rose-500'; if (state === 'low_stock') return 'bg-amber-500'; if (state === 'healthy') return 'bg-emerald-500'; return 'bg-muted-foreground/40'; }
function stockStateLabel(state: string | null | undefined): string { if (state === 'out_of_stock') return 'Store out'; if (state === 'low_stock') return 'Store low'; if (state === 'healthy') return 'Store healthy'; return formatEnumLabel(state || 'n/a'); }
function stockAlertBadgeClass(state: string): string {
    if (state === 'out_of_stock') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300';
    if (state === 'low_stock') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300';
    if (state === 'healthy') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
    return '';
}
function inventoryItemListMeta(item: Record<string, unknown>): string {
    const category = item.category ? formatEnumLabel(String(item.category)) : 'Uncategorized';
    const unit = String(item.unit ?? 'No unit');
    const parts = [category, unit, `Store ${item.currentStock != null ? formatAmount(Number(item.currentStock)) : '—'}`, `Reorder ${item.reorderLevel != null ? formatAmount(Number(item.reorderLevel)) : '—'}`];
    return parts.join(' · ');
}
function inventoryItemMovementCount(item: any): number { return Number(item?.movementCount ?? 0); }

const itemDetailsOpen = ref(false);
const itemDetails = ref<any | null>(null);
const itemDetailsLoading = ref(false);
const itemDetailsError = ref<string | null>(null);
const itemDetailsTab = ref('overview');
const itemUpdateForm = reactive<InventoryItemFormState>(createEmptyItemForm());
const itemUpdateSubmitting = ref(false);
const itemUpdateErrors = ref<Record<string, string[]>>({});
const itemUpdateSnapshot = ref('');
const itemStatusForm = reactive({ status: 'active', reason: '' });
const itemStatusOptions = ['active', 'inactive'] as const;
const itemStatusSubmitting = ref(false);
const itemStatusError = ref<string | null>(null);
const itemStatusSnapshot = ref('');
const itemBatches = ref<any[]>([]);
const itemBatchesLoading = ref(false);
const itemUnits = ref<any[]>([]);
const itemUnitsLoading = ref(false);
const unitPrices = ref<any[]>([]);
const unitPricesLoading = ref(false);
const itemAuditLogs = ref<any[]>([]);
const itemAuditLoading = ref(false);
const itemAuditError = ref<string | null>(null);
const itemAuditExporting = ref(false);
const itemAuditMeta = ref<{ currentPage: number; lastPage: number; total: number; perPage: number } | null>(null);
const itemAuditFilters = reactive({ q: '', action: '', actorType: '', actorId: '', from: '', to: '', page: 1, perPage: 50 });
const selectedUpdateCategory = computed(() => resolveCategoryOption(itemUpdateForm.category));
const updateSubcategoryOptions = computed(() => subcategoryOptionsForCategory(itemUpdateForm.category));
const updateClinicalCatalogOptions = computed<SearchableSelectOption[]>(() => []);
const updateIdentityLockedToCatalog = computed(() => false);
const updateSelectedCatalogItem = computed(() => null);
const updateCategoryWorkflowBadges = computed(() => []);

function hydrateItemForms(item: any): void {
    itemUpdateForm.clinicalCatalogItemId = item?.clinicalCatalogItemId ?? ''; itemUpdateForm.itemCode = item?.itemCode ?? ''; itemUpdateForm.itemName = item?.itemName ?? '';
    itemUpdateForm.genericName = item?.genericName ?? ''; itemUpdateForm.dosageForm = item?.dosageForm ?? ''; itemUpdateForm.strength = item?.strength ?? '';
    itemUpdateForm.category = item?.category ?? ''; itemUpdateForm.subcategory = item?.subcategory ?? ''; itemUpdateForm.venClassification = item?.venClassification ?? '';
    itemUpdateForm.abcClassification = item?.abcClassification ?? ''; itemUpdateForm.unit = item?.unit ?? ''; itemUpdateForm.dispensingUnit = item?.dispensingUnit ?? '';
    itemUpdateForm.conversionFactor = String(item?.conversionFactor ?? ''); itemUpdateForm.binLocation = item?.binLocation ?? ''; itemUpdateForm.manufacturer = item?.manufacturer ?? '';
    itemUpdateForm.storageConditions = item?.storageConditions ?? ''; itemUpdateForm.requiresColdChain = item?.requiresColdChain ?? false;
    itemUpdateForm.isControlledSubstance = item?.isControlledSubstance ?? false; itemUpdateForm.controlledSubstanceSchedule = item?.controlledSubstanceSchedule ?? '';
    itemUpdateForm.msdCode = item?.msdCode ?? ''; itemUpdateForm.nhifCode = item?.nhifCode ?? ''; itemUpdateForm.barcode = item?.barcode ?? '';
    itemUpdateForm.reorderLevel = String(item?.reorderLevel ?? ''); itemUpdateForm.maxStockLevel = String(item?.maxStockLevel ?? '');
    itemUpdateForm.defaultWarehouseId = item?.defaultWarehouseId ?? ''; itemUpdateForm.defaultSupplierId = item?.defaultSupplierId ?? '';
    itemStatusForm.status = item?.status === 'inactive' ? 'inactive' : 'active'; itemStatusForm.reason = item?.statusReason ?? '';
}

const DEFAULT_STORAGE_CONDITIONS_BY_CATEGORY: Record<string, string> = {
    pharmaceutical: 'room_temperature',
    laboratory: 'cool_dry_place',
    food_nutrition: 'cool_dry_place',
    blood_product: 'refrigerated_2_8c',
};

function stringMetadataValue(metadata: Record<string, unknown> | null | undefined, ...keys: string[]): string {
    for (const key of keys) {
        const value = metadata?.[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

function stringCodesValue(codes: Record<string, unknown> | null | undefined, ...keys: string[]): string {
    for (const key of keys) {
        const value = codes?.[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

function genericNameFromClinicalName(name: string, strength: string): string {
    const withoutStrength = strength
        ? name.replace(new RegExp(`\\s*${strength.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '').trim()
        : name.trim();
    return withoutStrength.replace(/\s+\d+.*$/u, '').trim() || name.trim();
}

function toNumericFormValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(numeric) : '';
}

function hasSubcategoryOption(options: SearchableSelectOption[], value: string): boolean {
    const normalizedValue = value.trim().toLowerCase();
    return options.some((option) => option.value.trim().toLowerCase() === normalizedValue);
}

function defaultStorageConditionsForCategory(category: InventoryCategoryOption): string {
    if (!category.supportsStorageFields) return '';
    if (category.requiresColdChain) return 'refrigerated_2_8c';
    return DEFAULT_STORAGE_CONDITIONS_BY_CATEGORY[category.value] ?? 'room_temperature';
}

function clinicalCatalogTypeForCategory(category: InventoryCategoryOption | null): string[] {
    if (!category) return [];
    if (category.template === 'pharmaceutical') return ['formulary_item'];
    if (category.template === 'expiry_sensitive') return ['formulary_item'];
    return [];
}

function applyItemCategoryRules(form: InventoryItemFormState): void {
    const category = resolveCategoryOption(form.category);
    if (!category) return;
    if (clinicalCatalogTypeForCategory(category).length === 0) form.clinicalCatalogItemId = '';
    if (!category.supportsMedicineDetails) {
        form.genericName = ''; form.dosageForm = ''; form.strength = '';
        form.dispensingUnit = ''; form.conversionFactor = '';
    }
    if (!category.supportsClinicalClassification) {
        form.venClassification = ''; form.abcClassification = ''; form.nhifCode = '';
    }
    if (!category.supportsStorageFields) {
        form.storageConditions = ''; form.requiresColdChain = false;
    } else if (!form.storageConditions) {
        form.storageConditions = defaultStorageConditionsForCategory(category);
    }
    if (!category.controlledSubstanceEligible) {
        form.isControlledSubstance = false; form.controlledSubstanceSchedule = '';
    }
    if (category.requiresColdChain) {
        form.requiresColdChain = true;
        if (!form.storageConditions) form.storageConditions = 'refrigerated_2_8c';
    }
}

function clearStalePresetSubcategory(form: InventoryItemFormState, oldCategory: string | undefined, newCategory: string): void {
    const currentSubcategory = form.subcategory.trim();
    if (!currentSubcategory || oldCategory === newCategory) return;
    const wasPresetForOldCategory = hasSubcategoryOption(subcategoryOptionsForCategory(oldCategory), currentSubcategory);
    const isPresetForNewCategory = hasSubcategoryOption(subcategoryOptionsForCategory(newCategory), currentSubcategory);
    if (wasPresetForOldCategory && !isPresetForNewCategory) form.subcategory = '';
}

function selectClinicalCatalogItem(form: InventoryItemFormState, itemId: string): void {
    form.clinicalCatalogItemId = itemId;
    const item = clinicalCatalogItems.value.find((entry) => entry.id === itemId);
    if (!item) return;
    const metadata = item.metadata ?? {};
    const codes = item.codes ?? {};
    const code = item.code?.trim() || '';
    const name = item.name?.trim() || '';
    const category = item.category?.trim() || '';
    const unit = item.unit?.trim() || '';
    const dosageForm = stringMetadataValue(metadata, 'dosageForm', 'dosage_form');
    const strength = stringMetadataValue(metadata, 'strength');
    const msdCode = stringCodesValue(codes, 'MSD');
    const nhifCode = stringCodesValue(codes, 'NHIF');
    form.itemCode = code || form.itemCode;
    form.itemName = name || form.itemName;
    if (item.catalogType === 'formulary_item') {
        if (name) form.genericName = genericNameFromClinicalName(name, strength);
        form.dispensingUnit = unit || form.dispensingUnit;
        form.dosageForm = dosageForm || form.dosageForm;
        form.strength = strength || form.strength;
    }
    form.subcategory = category || form.subcategory;
    form.unit = unit || form.unit;
    form.msdCode = msdCode || form.msdCode;
    form.nhifCode = nhifCode || form.nhifCode;
}

function buildItemPayload(form: InventoryItemFormState): Record<string, unknown> {
    const category = resolveCategoryOption(form.category);
    const supportsMedicineDetails = category?.supportsMedicineDetails ?? false;
    const supportsClinicalClassification = category?.supportsClinicalClassification ?? false;
    const supportsClinicalCatalogLink = clinicalCatalogTypeForCategory(category ?? null).length > 0;
    const supportsStorageFields = category?.supportsStorageFields ?? false;
    const controlledSubstanceEligible = category?.controlledSubstanceEligible ?? false;
    const requiresColdChain = category?.requiresColdChain ? true : form.requiresColdChain;
    const itemCode = trimmedFormValue(form.itemCode);
    const clinicalCatalogItemId = nullableTrimmedFormValue(form.clinicalCatalogItemId);
    const itemName = trimmedFormValue(form.itemName);
    const genericName = nullableTrimmedFormValue(form.genericName);
    const dosageForm = nullableTrimmedFormValue(form.dosageForm);
    const strength = nullableTrimmedFormValue(form.strength);
    const subcategory = nullableTrimmedFormValue(form.subcategory);
    const unit = trimmedFormValue(form.unit);
    const dispensingUnit = nullableTrimmedFormValue(form.dispensingUnit);
    const conversionFactor = nullableNumericFormValue(form.conversionFactor);
    const binLocation = nullableTrimmedFormValue(form.binLocation);
    const manufacturer = nullableTrimmedFormValue(form.manufacturer);
    const storageConditions = nullableTrimmedFormValue(form.storageConditions);
    const controlledSubstanceSchedule = nullableTrimmedFormValue(form.controlledSubstanceSchedule);
    const msdCode = nullableTrimmedFormValue(form.msdCode);
    const nhifCode = nullableTrimmedFormValue(form.nhifCode);
    const barcode = nullableTrimmedFormValue(form.barcode);
    const reorderLevel = nullableNumericFormValue(form.reorderLevel);
    const maxStockLevel = nullableNumericFormValue(form.maxStockLevel);
    const defaultWarehouseId = nullableTrimmedFormValue(form.defaultWarehouseId);
    const defaultSupplierId = nullableTrimmedFormValue(form.defaultSupplierId);
    const standardsCodes = {
        LOCAL: itemCode || undefined,
        GS1_GTIN: barcode || undefined,
        MSD: msdCode || undefined,
        NHIF: supportsClinicalClassification ? (nhifCode || undefined) : undefined,
    };
    return {
        itemCode,
        clinicalCatalogItemId: supportsClinicalCatalogLink ? clinicalCatalogItemId : null,
        itemName,
        genericName: supportsMedicineDetails ? genericName : null,
        dosageForm: supportsMedicineDetails ? dosageForm : null,
        strength: supportsMedicineDetails ? strength : null,
        category: form.category || null,
        subcategory,
        venClassification: supportsClinicalClassification ? (form.venClassification || null) : null,
        abcClassification: supportsClinicalClassification ? (form.abcClassification || null) : null,
        unit,
        dispensingUnit: supportsMedicineDetails ? dispensingUnit : null,
        conversionFactor: supportsMedicineDetails ? conversionFactor : null,
        binLocation,
        manufacturer,
        storageConditions: supportsStorageFields ? storageConditions : null,
        requiresColdChain,
        isControlledSubstance: controlledSubstanceEligible ? form.isControlledSubstance : false,
        controlledSubstanceSchedule: controlledSubstanceEligible ? controlledSubstanceSchedule : null,
        msdCode,
        nhifCode: supportsClinicalClassification ? nhifCode : null,
        barcode,
        codes: standardsCodes,
        reorderLevel,
        maxStockLevel,
        defaultWarehouseId,
        defaultSupplierId,
    };
}

function itemFormHasDraftContent(form: InventoryItemFormState): boolean {
    return Object.entries(form).some(([key, value]) => {
        if (typeof value === 'boolean') return value;
        if (key === 'storageConditions' && !form.category) return false;
        return String(value ?? '').trim().length > 0;
    });
}

function currentItemUpdateSnapshot(): string {
    return JSON.stringify(buildItemPayload(itemUpdateForm));
}

function currentItemStatusSnapshot(): string {
    return JSON.stringify({
        status: itemStatusForm.status === 'inactive' ? 'inactive' : 'active',
        reason: itemStatusForm.reason.trim() || null,
    });
}

function captureItemDetailWorkflowSnapshots(): void {
    itemUpdateSnapshot.value = currentItemUpdateSnapshot();
    itemStatusSnapshot.value = currentItemStatusSnapshot();
}

function formatAmount(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return 'N/A';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return String(value);
    return numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type LookupOption = { id: string; name: string; code: string | null };

function lookupOptionText(option: LookupOption | null | undefined): string {
    if (!option) return '';
    return option.code ? `${option.name} (${option.code})` : option.name;
}

function warehouseLabel(warehouseId: string | null | undefined): string | null {
    if (!warehouseId) return null;
    const warehouse = warehouses.value.find((entry) => entry.id === warehouseId);
    return warehouse ? lookupOptionText(warehouse) : warehouseId;
}

function supplierLabel(supplierId: string | null | undefined): string | null {
    if (!supplierId) return null;
    const supplier = suppliers.value.find((entry) => entry.id === supplierId);
    return supplier ? lookupOptionText(supplier) : supplierId;
}

function flushInventorySearch(): void {
    if (inventorySearchTimer) {
        clearTimeout(inventorySearchTimer);
        inventorySearchTimer = null;
    }
    if (!canRead.value) return;
    itemSearch.page = 1;
    void refreshInventoryItems();
}

function clinicalCatalogLabel(itemId: string | null | undefined): string {
    const item = clinicalCatalogItems.value.find((entry) => entry.id === itemId);
    if (!item) return itemId ? String(itemId) : 'Not linked';
    const code = typeof item.code === 'string' && item.code.trim() ? item.code.trim() : null;
    const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : item.id;
    return code ? `${name} (${code})` : name;
}

function expiryBadgeClass(state: string): string {
    switch (state) {
        case 'expired': return 'bg-destructive text-destructive-foreground';
        case 'critical': return 'bg-orange-600 text-white';
        case 'warning': return 'bg-yellow-500 text-black';
        default: return 'bg-green-600 text-white';
    }
}

function flashItem(itemId: string) {
    if (flashedItemTimer) clearTimeout(flashedItemTimer);
    flashedItemId.value = itemId;
    flashedItemTimer = setTimeout(() => { flashedItemId.value = null; flashedItemTimer = null; }, 1500);
}

let pendingItemDetailsCloseAction: (() => void) | null = null;

function itemAuditQuery() {
    return {
        q: itemAuditFilters.q.trim() || null,
        action: itemAuditFilters.action.trim() || null,
        actorType: itemAuditFilters.actorType || null,
        actorId: itemAuditFilters.actorId.trim() || null,
        from: itemAuditFilters.from || null,
        to: itemAuditFilters.to || null,
        page: itemAuditFilters.page,
        perPage: itemAuditFilters.perPage,
    };
}

async function loadItemDetails(itemId: string) {
    itemDetailsLoading.value = true;
    itemDetailsError.value = null;
    try {
        const response = await apiRequest<{ data: any }>('GET', `/inventory-procurement/items/${itemId}`);
        itemDetails.value = response.data;
        hydrateItemForms(response.data);
        captureItemDetailWorkflowSnapshots();
        void loadItemBatches(itemId);
        void loadItemUnits(itemId);
        void loadItemUnitPrices(itemId);
    } catch (error) {
        itemDetails.value = null;
        itemDetailsError.value = messageFromUnknown(error, 'Unable to load inventory item details.');
        itemUpdateSnapshot.value = '';
        itemStatusSnapshot.value = '';
    } finally {
        itemDetailsLoading.value = false;
    }
}

async function loadItemBatches(itemId: string) {
    itemBatchesLoading.value = true;
    try {
        const response = await apiRequest<{ data: any[] }>('GET', '/inventory-procurement/batches', { query: { itemId, perPage: 50 } });
        itemBatches.value = response.data ?? [];
    } catch {
        itemBatches.value = [];
    } finally {
        itemBatchesLoading.value = false;
    }
}

async function loadItemUnits(itemId: string) {
    if (!itemId.trim()) { itemUnits.value = []; return; }
    itemUnitsLoading.value = true;
    try {
        const response = await apiRequest<{ data: any[] }>('GET', `/inventory-procurement/items/${itemId}/units`);
        itemUnits.value = response.data ?? [];
    } catch {
        itemUnits.value = [];
    } finally {
        itemUnitsLoading.value = false;
    }
}

async function loadItemUnitPrices(itemId: string) {
    if (!itemId.trim()) { unitPrices.value = []; return; }
    unitPricesLoading.value = true;
    try {
        const response = await apiRequest<{ data: any[] }>('GET', `/inventory-procurement/items/${itemId}/unit-prices`);
        unitPrices.value = response.data ?? [];
    } catch {
        unitPrices.value = [];
    } finally {
        unitPricesLoading.value = false;
    }
}

const itemDetailsSummaryCards = computed(() => {
    const item = itemDetails.value;
    if (!item) return [];
    const unitLabel = item.unit ?? 'units';
    const currentStockLabel = item.currentStock != null ? `${formatAmount(item.currentStock)} ${unitLabel}` : `0.00 ${unitLabel}`;
    const reorderLevelLabel = item.reorderLevel != null ? formatAmount(item.reorderLevel) : 'Not set';
    const maxStockLevelLabel = item.maxStockLevel != null ? formatAmount(item.maxStockLevel) : 'Not set';
    const classificationHelper = [
        item.subcategory ? formatEnumLabel(item.subcategory) : null,
        item.dispensingUnit ?? item.unit ?? null,
        item.dosageForm ?? null,
    ].filter((value): value is string => Boolean(value && String(value).trim())).join(' | ');
    const conversionFactor = Number(item.conversionFactor ?? 0);
    const dispensingUnit = item.dispensingUnit ?? null;
    const showConverted = item.currentStock != null && conversionFactor > 0 && dispensingUnit && dispensingUnit.toLowerCase() !== unitLabel.toLowerCase();
    const stockValue = showConverted
        ? `${formatAmount(item.currentStock)} ${unitLabel} (${formatAmount(item.currentStock * conversionFactor)} ${dispensingUnit}s)`
        : currentStockLabel;
    return [
        { key: 'status', label: 'Current status', value: formatEnumLabel(item.status ?? 'n/a'), helper: item.statusReason ? String(item.statusReason) : 'No reason recorded' },
        { key: 'stock', label: 'Store stock', value: stockValue, helper: `Reorder ${reorderLevelLabel} | Max ${maxStockLevelLabel}` },
        { key: 'openingStock', label: 'Opening stock', value: inventoryItemHasOpeningStock(item) ? `${formatAmount(item.openingStockMovementCount)} entry(ies)` : 'Not set', helper: inventoryItemHasOpeningStock(item) ? 'Correct from the action bar above' : 'Use "Set Opening Stock" after creating the item' },
        (() => {
            const price = unitPrices.value?.[0];
            const priceLabel = price ? `${price.currencyCode} ${Number(price.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;
            return { key: 'billingPrice', label: 'Billing price', value: priceLabel ?? 'Not set', helper: priceLabel ? `${price.priceType.replace('_', ' ')} · per ${unitLabel}` : 'No active unit price configured', valueClass: priceLabel ? 'text-emerald-600 dark:text-emerald-400' : '' };
        })(),
        { key: 'classification', label: 'Inventory class', value: item.category ? formatEnumLabel(item.category) : 'Unclassified', helper: classificationHelper || 'No extra classification recorded' },
    ];
});

const itemFilterChips = computed<string[]>(() => {
    const chips: string[] = [];
    if (itemSearch.q) chips.push(`Search: "${itemSearch.q}"`);
    if (itemSearch.category) chips.push(`Category: ${itemSearch.category}`);
    if (itemSearch.stockState) chips.push(`Store stock: ${stockStateLabel(itemSearch.stockState)}`);
    if (itemSearch.sortBy !== 'itemName' || itemSearch.sortDir !== 'asc') chips.push(`Sort: ${formatEnumLabel(itemSearch.sortBy)} ${itemSearch.sortDir.toUpperCase()}`);
    if (itemSearch.perPage !== 50) chips.push(`${itemSearch.perPage} per page`);
    return chips;
});
const hasAnyItemFilters = computed(() => itemFilterChips.value.length > 0);

const stockFilterChips = computed<string[]>(() => {
    if (activeTab.value === 'inventory') return itemFilterChips.value;
    if (activeTab.value === 'ledger') {
        const chips: string[] = [];
        if (stockLedgerFilters.q) chips.push(`Search: "${stockLedgerFilters.q}"`);
        if (stockLedgerFilters.movementType) chips.push(`Type: ${formatEnumLabel(stockLedgerFilters.movementType)}`);
        if (stockLedgerFilters.sourceKey) chips.push(`Source: ${stockLedgerSourceOptions.find(o => o.value === stockLedgerFilters.sourceKey)?.label || formatEnumLabel(stockLedgerFilters.sourceKey)}`);
        if (stockLedgerFilters.from || stockLedgerFilters.to) chips.push(`Date range: ${stockLedgerFilters.from || '...'} → ${stockLedgerFilters.to || '...'}`);
        if (stockLedgerFilters.perPage !== 50) chips.push(`${stockLedgerFilters.perPage} per page`);
        return chips;
    }
    if (activeTab.value === 'department-stock') {
        const chips: string[] = [];
        if (departmentStockFilters.q) chips.push(`Search: "${departmentStockFilters.q}"`);
        if (departmentStockFilters.departmentId) chips.push(`Department: ${departmentFilterOptions.value.find(d => d.id === departmentStockFilters.departmentId)?.name || departmentStockFilters.departmentId}`);
        if (departmentStockFilters.perPage !== 50) chips.push(`${departmentStockFilters.perPage} per page`);
        return chips;
    }
    return [];
});
const hasAnyStockFilter = computed(() => stockFilterChips.value.length > 0);

function resetItemFilters() { itemSearch.q = ''; itemSearch.category = ''; itemSearch.stockState = ''; itemSearch.sortBy = 'itemName'; itemSearch.sortDir = 'asc'; itemSearch.page = 1; void refreshInventoryItems(); }

async function openItemDetails(item: any, tab: string = 'overview') {
    itemDetailsOpen.value = true;
    itemDetailsTab.value = tab;
    itemDetails.value = null;
    itemDetailsError.value = null;
    itemDetailsDiscardConfirmOpen.value = false;
    pendingItemDetailsCloseAction = null;
    itemUpdateErrors.value = {};
    itemStatusError.value = null;
    rotateItemUpdateRequestKey();
    rotateItemStatusRequestKey();
    itemBatches.value = [];
    itemBatchesLoading.value = false;
    itemAuditLogs.value = [];
    itemAuditMeta.value = null;
    itemAuditError.value = null;
    itemAuditFilters.q = '';
    itemAuditFilters.action = '';
    itemAuditFilters.actorType = '';
    itemAuditFilters.actorId = '';
    itemAuditFilters.from = '';
    itemAuditFilters.to = '';
    itemAuditFilters.page = 1;
    itemAuditFilters.perPage = 20;
    await loadItemDetails(String(item.id));
    if (canViewAudit.value && itemDetails.value) {
        await loadItemAuditLogs();
    }
}

// ── Item details sheets open state ──
function closeItemDetails(): void {
    itemDetailsOpen.value = false;
    itemDetailsDiscardConfirmOpen.value = false;
    pendingItemDetailsCloseAction = null;
    itemUpdateErrors.value = {};
    itemStatusError.value = null;
    itemUpdateSnapshot.value = '';
    itemStatusSnapshot.value = '';
    rotateItemUpdateRequestKey();
    rotateItemStatusRequestKey();
}

function requestItemDetailsOpenChange(open: boolean, afterClose?: () => void): void {
    if (open) { itemDetailsOpen.value = true; return; }
    if (itemUpdateSubmitting.value || itemStatusSubmitting.value) return;
    if (hasPendingItemDetailsWorkflow.value) {
        pendingItemDetailsCloseAction = afterClose ?? null;
        itemDetailsDiscardConfirmOpen.value = true;
        return;
    }
    closeItemDetails();
    afterClose?.();
}

function confirmItemDetailsDiscard(): void {
    const afterClose = pendingItemDetailsCloseAction;
    closeItemDetails();
    afterClose?.();
}

async function submitItemUpdate() {
    if (!itemDetails.value || !canManageItems.value || itemUpdateSubmitting.value) return;
    itemUpdateSubmitting.value = true;
    itemUpdateErrors.value = {};
    try {
        const response = await apiRequest<{ data: any }>('PATCH', `/inventory-procurement/items/${itemDetails.value.id}`, {
            body: buildItemPayload(itemUpdateForm),
            meta: {
                idempotencyKey: itemUpdateRequestKey.value,
                requestId: itemUpdateRequestKey.value,
                entitlementContext: 'Inventory item update',
            },
        });
        itemDetails.value = response.data;
        hydrateItemForms(response.data);
        captureItemDetailWorkflowSnapshots();
        rotateItemUpdateRequestKey();
        notifySuccess('Inventory item updated.');
        flashItem(itemDetails.value.id);
        await loadItems();
        if (canViewAudit.value) await loadItemAuditLogs();
    } catch (error) {
        itemUpdateErrors.value = (error as ApiError).payload?.errors ?? {};
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
            body: { status: itemStatusForm.status, reason: itemStatusForm.reason.trim() || null },
            meta: {
                idempotencyKey: itemStatusRequestKey.value,
                requestId: itemStatusRequestKey.value,
                entitlementContext: 'Inventory item status update',
            },
        });
        itemDetails.value = response.data;
        hydrateItemForms(response.data);
        captureItemDetailWorkflowSnapshots();
        rotateItemStatusRequestKey();
        notifySuccess('Inventory item status updated.');
        flashItem(itemDetails.value.id);
        await loadItems();
        if (canViewAudit.value) await loadItemAuditLogs();
    } catch (error) {
        itemStatusError.value = messageFromUnknown(error, 'Unable to update item status.');
        notifyError(itemStatusError.value);
    } finally {
        itemStatusSubmitting.value = false;
    }
}

async function loadItemAuditLogs() {
    if (!canViewAudit.value || !itemDetails.value) return;
    itemAuditLoading.value = true;
    itemAuditError.value = null;
    try {
        const response = await apiRequest<{
            data: any[];
            meta?: { currentPage?: number; lastPage?: number; total?: number; perPage?: number };
        }>('GET', `/inventory-procurement/items/${itemDetails.value.id}/audit-logs`, {
            query: itemAuditQuery(),
        });
        itemAuditLogs.value = response.data ?? [];
        itemAuditMeta.value = {
            currentPage: response.meta?.currentPage ?? itemAuditFilters.page,
            lastPage: response.meta?.lastPage ?? 1,
            total: response.meta?.total ?? itemAuditLogs.value.length,
            perPage: response.meta?.perPage ?? itemAuditFilters.perPage,
        };
    } catch (error) {
        itemAuditError.value = messageFromUnknown(error, 'Unable to load item audit logs.');
        itemAuditLogs.value = [];
        itemAuditMeta.value = null;
    } finally {
        itemAuditLoading.value = false;
    }
}

const barcodeScannerOpen = ref(false);
const barcodeInput = ref('');
const barcodeLookupLoading = ref(false);
const barcodeLookupError = ref<string | null>(null);
const barcodeLookupResult = ref<any>(null);
function onBarcodeKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') { e.preventDefault(); lookupBarcode(); }
}

async function lookupBarcode(): Promise<void> {
    if (!barcodeInput.value.trim()) return;
    barcodeLookupLoading.value = true;
    barcodeLookupError.value = null;
    barcodeLookupResult.value = null;
    try {
        const response = await apiRequest<{ data: any }>('GET', '/inventory-procurement/items/lookup-barcode', { query: { barcode: barcodeInput.value.trim() } });
        barcodeLookupResult.value = response.data ?? null;
        if (!barcodeLookupResult.value) barcodeLookupError.value = 'No item found for this barcode.';
    } catch (error) {
        barcodeLookupError.value = messageFromUnknown(error, 'Barcode lookup failed.');
    } finally {
        barcodeLookupLoading.value = false;
    }
}

// ── Unit / batch create state ──
const createBatchDialogOpen = ref(false);
const batchForm = reactive({ batchNumber: '', lotNumber: '', manufactureDate: '', expiryDate: '', binLocation: '', notes: '' });
const batchCreateSubmitting = ref(false);
const batchCreateErrors = ref<Record<string, string[]>>({});
async function submitCreateBatch() {
    if (!itemDetails.value || batchCreateSubmitting.value) return;
    batchCreateSubmitting.value = true;
    batchCreateErrors.value = {};
    try {
        await apiRequest('POST', '/inventory-procurement/batches', {
            body: {
                itemId: itemDetails.value.id,
                batchNumber: batchForm.batchNumber.trim(),
                lotNumber: batchForm.lotNumber.trim() || null,
                manufactureDate: batchForm.manufactureDate || null,
                expiryDate: batchForm.expiryDate || null,
                binLocation: batchForm.binLocation.trim() || null,
                notes: batchForm.notes.trim() || null,
            },
        });
        notifySuccess('Batch created.');
        createBatchDialogOpen.value = false;
        Object.assign(batchForm, { batchNumber: '', lotNumber: '', manufactureDate: '', expiryDate: '', binLocation: '', notes: '' });
        await loadItemBatches(String(itemDetails.value.id));
    } catch (error) {
        batchCreateErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to create batch.'));
    } finally {
        batchCreateSubmitting.value = false;
    }
}

const createUnitDialogOpen = ref(false);
const editingUnitId = ref<string | null>(null);
const unitForm = reactive({ unitName: '', unitCode: '', baseQuantity: '', barcode: '', isDefaultSalesUnit: false, isDefaultPurchaseUnit: false });
const unitFormErrors = ref<Record<string, string[]>>({});
const unitFormSubmitting = ref(false);
function openCreateUnitDialog(): void { createUnitDialogOpen.value = true; }
function openEditUnitDialog(unit: any): void {
    editingUnitId.value = unit.id;
    unitForm.unitName = unit.unitName ?? '';
    unitForm.unitCode = unit.unitCode ?? '';
    unitForm.baseQuantity = String(unit.baseQuantity ?? '');
    unitForm.barcode = unit.barcode ?? '';
    unitForm.isDefaultSalesUnit = unit.isDefaultSalesUnit ?? false;
    unitForm.isDefaultPurchaseUnit = unit.isDefaultPurchaseUnit ?? false;
    createUnitDialogOpen.value = true;
}

async function submitCreateUnit(): Promise<void> {
    if (!itemDetails.value || createUnitDialogOpen.value === false) return;
    if (unitFormSubmitting.value) return;
    unitFormSubmitting.value = true;
    unitFormErrors.value = {};
    try {
        const body: Record<string, unknown> = {
            unit_name: unitForm.unitName,
            base_quantity: Number(unitForm.baseQuantity),
            is_default_sales_unit: unitForm.isDefaultSalesUnit,
            is_default_purchase_unit: unitForm.isDefaultPurchaseUnit,
        };
        if (unitForm.unitCode.trim()) body.unit_code = unitForm.unitCode.trim();
        if (unitForm.barcode.trim()) body.barcode = unitForm.barcode.trim();
        const url = editingUnitId.value
            ? `/inventory-procurement/items/${itemDetails.value.id}/units/${editingUnitId.value}`
            : `/inventory-procurement/items/${itemDetails.value.id}/units`;
        await apiRequest(editingUnitId.value ? 'PATCH' : 'POST', url, { body });
        createUnitDialogOpen.value = false;
        resetUnitForm();
        notifySuccess(editingUnitId.value ? 'Unit updated successfully.' : 'Unit created successfully.');
        await loadItemUnits(String(itemDetails.value.id));
    } catch (error: any) {
        unitFormErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Failed to save unit.'));
    } finally {
        unitFormSubmitting.value = false;
    }
}

async function submitDeactivateUnit(unitId: string): Promise<void> {
    if (!itemDetails.value) return;
    if (!confirm('Deactivate this unit? It will be hidden from active selections but preserved for historical records.')) return;
    try {
        await apiRequestJson('DELETE', `/inventory-procurement/items/${itemDetails.value.id}/units/${unitId}`);
        notifySuccess('Unit deactivated.');
        await loadItemUnits(String(itemDetails.value.id));
    } catch (error: any) {
        notifyError(messageFromUnknown(error, 'Failed to deactivate unit.'));
    }
}
function resetUnitForm(): void { Object.assign(unitForm, { unitName: '', unitCode: '', baseQuantity: '', barcode: '', isDefaultSalesUnit: false, isDefaultPurchaseUnit: false }); }

const createPriceDialogOpen = ref(false);

// ── Stock movement computeds ──
const stockMovementItem = computed(() => stockMovementSelectedItem.value);

function handleStockReconciliationItemSelected(item: StockMovementLookupItem | null): void {
    stockReconciliationSelectedItem.value = item;
}

// ── filter overlay mobile ──
const mobileProcurementDrawerOpen = ref(false);
const mobileLedgerDrawerOpen = ref(false);
function submitLedgerSearchFromMobileDrawer(): void { mobileLedgerDrawerOpen.value = false; stockLedgerFilters.page = 1; void loadStockLedger(); }
function resetLedgerFiltersFromMobileDrawer(): void { mobileLedgerDrawerOpen.value = false; resetStockLedgerFilters(); }
function resetStockLedgerFilters(): void {
    stockLedgerFilters.q = ''; stockLedgerFilters.itemId = ''; stockLedgerFilters.movementType = '';
    stockLedgerFilters.sourceKey = ''; stockLedgerFilters.actorType = ''; stockLedgerFilters.actorId = '';
    stockLedgerFilters.from = ''; stockLedgerFilters.to = ''; stockLedgerFilters.page = 1;
    void loadStockLedger();
}
function applyStockLedgerFilters(): void { stockLedgerFilters.page = 1; void loadStockLedger(); }

const stockControlUrlStateHydrated = ref(false);
const { setQueryParam, replaceUrlQuery } = useUrlQueryState();

function hydrateStockControlStateFromUrl(): void {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    const tab = (params.get('tab') ?? '').trim().toLowerCase();
    const section = (params.get('section') ?? '').trim().toLowerCase();

    if (stockControlTabs.includes(tab as StockControlTab)) {
        activeTab.value = tab as StockControlTab;
    } else if (section === 'stock-ledger') {
        activeTab.value = 'ledger';
    } else if (stockControlTabs.includes(section as StockControlTab)) {
        activeTab.value = section as StockControlTab;
    }

    const forceLedgerByLegacyParams = !!params.get('movementType') || !!params.get('itemId') || !!params.get('sourceKey');
    if (forceLedgerByLegacyParams) {
        activeTab.value = 'ledger';
    }

    if (activeTab.value === 'inventory') {
        itemSearch.q = params.get('q')?.trim() ?? '';
        itemSearch.category = params.get('category')?.trim() ?? '';
        itemSearch.stockState = params.get('stockState')?.trim() ?? '';
        itemSearch.sortBy = params.get('sortBy')?.trim() || 'itemName';
        itemSearch.sortDir = params.get('sortDir')?.trim() || 'asc';
        itemSearch.page = Number.isFinite(Number(params.get('page') ?? '')) && Number(params.get('page')) > 0
            ? Number(params.get('page'))
            : 1;
        itemSearch.perPage = Number.isFinite(Number(params.get('perPage') ?? '')) && Number(params.get('perPage')) > 0
            ? Number(params.get('perPage'))
            : 50;
    }

    if (activeTab.value === 'ledger') {
        stockLedgerFilters.q = params.get('q')?.trim() ?? '';
        stockLedgerFilters.itemId = params.get('itemId')?.trim() ?? '';
        stockLedgerFilters.movementType = params.get('movementType')?.trim() ?? '';
        stockLedgerFilters.sourceKey = params.get('sourceKey')?.trim() ?? '';
        stockLedgerFilters.actorType = params.get('actorType')?.trim() ?? '';
        stockLedgerFilters.actorId = params.get('actorId')?.trim() ?? '';
        stockLedgerFilters.from = params.get('from')?.trim() ?? '';
        stockLedgerFilters.to = params.get('to')?.trim() ?? '';
        stockLedgerFilters.page = Number.isFinite(Number(params.get('page') ?? '')) && Number(params.get('page')) > 0
            ? Number(params.get('page'))
            : 1;
        stockLedgerFilters.perPage = Number.isFinite(Number(params.get('perPage') ?? '')) && Number(params.get('perPage')) > 0
            ? Number(params.get('perPage'))
            : 50;
    }

    if (activeTab.value === 'department-stock') {
        departmentStockFilters.q = params.get('q')?.trim() ?? '';
        departmentStockFilters.departmentId = params.get('departmentId')?.trim() ?? '';
        departmentStockFilters.itemId = params.get('itemId')?.trim() ?? '';
        departmentStockFilters.page = Number.isFinite(Number(params.get('page') ?? '')) && Number(params.get('page')) > 0
            ? Number(params.get('page'))
            : 1;
        departmentStockFilters.perPage = Number.isFinite(Number(params.get('perPage') ?? '')) && Number(params.get('perPage')) > 0
            ? Number(params.get('perPage'))
            : 50;
    }

    stockControlUrlStateHydrated.value = true;
}

function syncStockControlStateToUrl(): void {
    if (!stockControlUrlStateHydrated.value || typeof window === 'undefined') return;

    replaceUrlQuery((params) => {
        params.delete('section');
        setQueryParam(params, 'tab', activeTab.value);

        const allStateKeys = ['q', 'category', 'stockState', 'sortBy', 'sortDir', 'page', 'perPage', 'itemId', 'movementType', 'sourceKey', 'actorType', 'actorId', 'from', 'to', 'departmentId'];
        for (const key of allStateKeys) params.delete(key);

        if (activeTab.value === 'inventory') {
            setQueryParam(params, 'q', itemSearch.q);
            setQueryParam(params, 'category', itemSearch.category);
            setQueryParam(params, 'stockState', itemSearch.stockState);
            if (itemSearch.sortBy !== 'itemName') setQueryParam(params, 'sortBy', itemSearch.sortBy);
            if (itemSearch.sortDir !== 'asc') setQueryParam(params, 'sortDir', itemSearch.sortDir);
            if (itemSearch.page > 1) setQueryParam(params, 'page', itemSearch.page);
            if (itemSearch.perPage !== 50) setQueryParam(params, 'perPage', itemSearch.perPage);
        }

        if (activeTab.value === 'ledger') {
            setQueryParam(params, 'q', stockLedgerFilters.q);
            setQueryParam(params, 'itemId', stockLedgerFilters.itemId);
            setQueryParam(params, 'movementType', stockLedgerFilters.movementType);
            setQueryParam(params, 'sourceKey', stockLedgerFilters.sourceKey);
            setQueryParam(params, 'actorType', stockLedgerFilters.actorType);
            setQueryParam(params, 'actorId', stockLedgerFilters.actorId);
            setQueryParam(params, 'from', stockLedgerFilters.from);
            setQueryParam(params, 'to', stockLedgerFilters.to);
            if (stockLedgerFilters.page > 1) setQueryParam(params, 'page', stockLedgerFilters.page);
            if (stockLedgerFilters.perPage !== 50) setQueryParam(params, 'perPage', stockLedgerFilters.perPage);
        }

        if (activeTab.value === 'department-stock') {
            setQueryParam(params, 'q', departmentStockFilters.q);
            setQueryParam(params, 'departmentId', departmentStockFilters.departmentId);
            setQueryParam(params, 'itemId', departmentStockFilters.itemId);
            if (departmentStockFilters.page > 1) setQueryParam(params, 'page', departmentStockFilters.page);
            if (departmentStockFilters.perPage !== 50) setQueryParam(params, 'perPage', departmentStockFilters.perPage);
        }
    });
}

async function exportStockLedgerCsv() {
    const url = new URL('/api/v1/inventory-procurement/stock-movements/export', window.location.origin);
    Object.entries(stockLedgerQuery()).forEach(([key, value]) => {
        if (value === null || value === '') return;
        if (key === 'page' || key === 'perPage') return;
        url.searchParams.set(key, String(value));
    });
    window.open(url.toString(), '_blank', 'noopener');
}

async function exportInventoryItemsCsv() {
    const url = new URL('/api/v1/inventory-procurement/items/export', window.location.origin);
    Object.entries(itemQuery()).forEach(([key, value]) => {
        if (value === null || value === '') return;
        if (key === 'page' || key === 'perPage') return;
        url.searchParams.set(key, String(value));
    });
    window.open(url.toString(), '_blank', 'noopener');
}

async function exportDepartmentStockCsv() {
    const url = new URL('/api/v1/inventory-procurement/department-stock/export', window.location.origin);
    Object.entries(departmentStockQuery()).forEach(([key, value]) => {
        if (value === null || value === '') return;
        if (key === 'page' || key === 'perPage') return;
        url.searchParams.set(key, String(value));
    });
    window.open(url.toString(), '_blank', 'noopener');
}

function printCurrentView(): void { window.print(); }

function handleExport() {
    if (catalogExporting.value) return;
    catalogExporting.value = true;
    try {
        if (activeTab.value === 'inventory') exportInventoryItemsCsv();
        else if (activeTab.value === 'ledger') exportStockLedgerCsv();
        else exportDepartmentStockCsv();
    } finally {
        catalogExporting.value = false;
    }
}

function handlePrint() {
    if (catalogPrinting.value) return;
    catalogPrinting.value = true;
    try {
        printCurrentView();
    } finally {
        catalogPrinting.value = false;
    }
}

function stockMovementSourceSummary(movement: Record<string, unknown>): string {
    const parts = [
        typeof movement.sourceLabel === 'string' ? movement.sourceLabel : null,
        typeof movement.sourceReference === 'string' ? movement.sourceReference : null,
        typeof movement.sourceDetail === 'string' ? movement.sourceDetail : null,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    return parts.join(' | ');
}

function fieldError(errors: Record<string, string[]>, key: string): string | null { return errors?.[key]?.[0] ?? null; }

function openDepartmentStockForItem(item: any | null | undefined): void {
    const itemId = String(item?.id ?? '').trim();
    if (!itemId) return;
    requestItemDetailsOpenChange(false, () => {
        departmentStockScopedItem.value = {
            id: itemId,
            name: String(item?.itemName ?? item?.name ?? itemId),
            code: item?.itemCode ?? item?.code ?? null,
        };
        departmentStockFilters.q = '';
        departmentStockFilters.itemId = itemId;
        departmentStockFilters.page = 1;
        activeTab.value = 'department-stock';
        void loadDepartmentStock();
    });
}
function clearDepartmentStockItemScope(): void { departmentStockFilters.itemId = ''; departmentStockScopedItem.value = null; departmentStockFilters.page = 1; void loadDepartmentStock(); }
function applyDepartmentStockFilters(): void { departmentStockFilters.page = 1; void loadDepartmentStock(); }
function resetDepartmentStockFilters(): void { departmentStockFilters.q = ''; departmentStockFilters.departmentId = ''; departmentStockFilters.itemId = ''; departmentStockFilters.page = 1; void loadDepartmentStock(); }

function buildPageList(current: number, last: number): (number | '...')[] {
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(last - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < last - 2) pages.push('...');
    pages.push(last);
    return pages;
}

const itemPages = computed(() => buildPageList(itemPagination.value?.currentPage ?? 1, itemPagination.value?.lastPage ?? 1));
const stockLedgerPages = computed(() => buildPageList(stockMovementPagination.value?.currentPage ?? 1, stockMovementPagination.value?.lastPage ?? 1));
const departmentStockPages = computed(() => buildPageList(departmentStockPagination.value?.currentPage ?? 1, departmentStockPagination.value?.lastPage ?? 1));

function goToItemPage(page: number) {
    const last = itemPagination.value?.lastPage ?? 1;
    const target = Math.max(1, Math.min(page, last));
    if (target === (itemPagination.value?.currentPage ?? 1)) return;
    itemSearch.page = target;
    void refreshInventoryItems();
}

function goToStockLedgerPage(page: number) {
    stockLedgerFilters.page = Math.max(page, 1);
    void loadStockLedger();
}

function goToDepartmentStockPage(page: number) {
    const last = departmentStockPagination.value?.lastPage ?? 1;
    const target = Math.max(1, Math.min(page, last));
    if (target === (departmentStockPagination.value?.currentPage ?? 1)) return;
    departmentStockFilters.page = target;
    void loadDepartmentStock();
}

async function loadStockMovementBatchOptions(itemId: string): Promise<void> {
    if (!itemId.trim()) { stockMovementBatchOptions.value = []; return; }
    stockMovementBatchesLoading.value = true;
    try {
        const response = await apiRequest<{ data: any[] }>('GET', '/inventory-procurement/batches', { query: { itemId, perPage: 50 } });
        stockMovementBatchOptions.value = response.data ?? [];
    } catch { stockMovementBatchOptions.value = []; } finally { stockMovementBatchesLoading.value = false; }
}

async function loadStockReconciliationBatchOptions(itemId: string): Promise<void> {
    if (!itemId.trim()) { stockReconciliationBatchOptions.value = []; return; }
    stockReconciliationBatchesLoading.value = true;
    try {
        const response = await apiRequest<{ data: any[] }>('GET', '/inventory-procurement/batches', { query: { itemId, perPage: 50 } });
        stockReconciliationBatchOptions.value = response.data ?? [];
    } catch { stockReconciliationBatchOptions.value = []; } finally { stockReconciliationBatchesLoading.value = false; }
}

function resolveStockStateForPreview(currentStock: number, reorderLevel: number): 'out_of_stock' | 'low_stock' | 'healthy' {
    if (currentStock <= 0) return 'out_of_stock';
    if (currentStock <= reorderLevel) return 'low_stock';
    return 'healthy';
}

const stockMovementCategoryOption = computed(() => resolveCategoryOption(stockMovementItem.value?.category ?? stockMovementForm.category));
const stockMovementCategoryLabel = computed(() => stockMovementCategoryOption.value?.label ?? (stockMovementForm.category ? formatEnumLabel(stockMovementForm.category) : 'Inventory items'));
const stockMovementSubcategoryLabel = computed(() => stockMovementForm.subcategory.trim() ? formatEnumLabel(stockMovementForm.subcategory) : 'subcategory');
const selectedStockMovementTypeMeta = computed(() => stockMovementTypeMeta[stockMovementForm.movementType as keyof typeof stockMovementTypeMeta]);
const stockMovementSubcategoryOptions = computed(() => stockMovementForm.category.trim() ? subcategoryOptionsForCategory(stockMovementForm.category) : []);
const stockMovementLookupBlockedReason = computed(() => {
    if (stockMovementForm.itemId.trim()) return null;
    if (!stockMovementForm.category.trim()) return 'Select an item category first.';
    return null;
});
const stockMovementLookupHelperText = computed(() => {
    if (stockMovementLookupBlockedReason.value) return stockMovementLookupBlockedReason.value;
    if (!stockMovementForm.itemId.trim()) return 'Search and select an inventory item to record a movement.';
    return '';
});
const stockMovementUsesBatchTracking = computed(() => Boolean(stockMovementCategoryOption.value?.requiresExpiryTracking) || stockMovementBatchOptions.value.length > 0);

const stockMovementRequiresBatchSelection = computed(() => (
    stockMovementUsesBatchTracking.value
    && (stockMovementForm.movementType === 'issue' || stockMovementForm.movementType === 'transfer'
        || (stockMovementForm.movementType === 'adjust' && stockMovementForm.adjustmentDirection === 'decrease'))
));
const stockMovementRequiresBatchReceiptFields = computed(() => (
    stockMovementUsesBatchTracking.value
    && (stockMovementForm.movementType === 'receive'
        || (stockMovementForm.movementType === 'adjust' && stockMovementForm.adjustmentDirection === 'increase'))
));
const stockMovementFilteredBatches = computed(() => stockMovementBatchOptions.value.filter((batch) => {
    if (!stockMovementForm.sourceWarehouseId) return true;
    return batch.warehouseId === stockMovementForm.sourceWarehouseId;
}));
const selectedStockMovementBatch = computed(() => stockMovementFilteredBatches.value.find((batch) => batch.id === stockMovementForm.batchId) ?? null);

const stockMovementQuantityValue = computed<number | null>(() => {
    const numeric = Number(stockMovementForm.quantity);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
});

const stockMovementOpeningBalanceMode = computed(() => inventoryItemNeedsOpeningStock(stockMovementItem.value));
const stockMovementUnitLabel = computed(() => { const unit = stockMovementItem.value?.unit; return typeof unit === 'string' && unit.trim() ? unit.trim() : 'units'; });
const stockMovementSubmitLabel = computed(() => stockMovementOpeningBalanceMode.value ? 'Save Opening Stock' : 'Record Movement');
const stockMovementReasonPlaceholder = computed(() => stockMovementOpeningBalanceMode.value ? 'Opening balance count sheet, legacy register, or go-live reference' : selectedStockMovementTypeMeta.value.reasonPlaceholder);
const stockMovementReasonRequired = computed(() => stockMovementOpeningBalanceMode.value || ['issue', 'adjust', 'transfer'].includes(stockMovementForm.movementType));
const stockMovementSuccessMessage = computed(() => stockMovementOpeningBalanceMode.value ? 'Opening stock recorded.' : 'Stock movement recorded.');

const stockMovementSignedDelta = computed<number | null>(() => {
    const quantity = stockMovementQuantityValue.value;
    if (quantity === null) return null;
    switch (stockMovementForm.movementType) {
        case 'receive': return quantity;
        case 'issue': case 'transfer': return -1 * quantity;
        case 'adjust': return stockMovementForm.adjustmentDirection === 'decrease' ? -1 * quantity : quantity;
        default: return null;
    }
});

const stockMovementProjectedStock = computed<number | null>(() => {
    const item = stockMovementItem.value;
    const delta = stockMovementSignedDelta.value;
    if (!item || delta === null) return null;
    const currentStock = Number(item.currentStock ?? 0);
    if (Number.isNaN(currentStock)) return null;
    return currentStock + delta;
});

const stockMovementProjectedNegative = computed(() => stockMovementProjectedStock.value !== null && stockMovementProjectedStock.value < 0);

const stockMovementProjectedState = computed<string | null>(() => {
    const projectedStock = stockMovementProjectedStock.value;
    const item = stockMovementItem.value;
    if (projectedStock === null || !item) return null;
    const reorderLevel = Number(item.reorderLevel ?? 0);
    return resolveStockStateForPreview(projectedStock, Number.isNaN(reorderLevel) ? 0 : reorderLevel);
});

const stockMovementSubmitDisabled = computed(() => {
    if (stockMovementSubmitting.value || !canCreateMovement.value) return true;
    if (!stockMovementForm.itemId.trim() || stockMovementQuantityValue.value === null) return true;
    if (stockMovementReasonRequired.value && !(stockMovementOpeningBalanceMode.value ? stockMovementForm.reasonCode.trim() : stockMovementForm.reason.trim())) return true;
    if (stockMovementRequiresBatchSelection.value && !stockMovementForm.batchId.trim()) return true;
    if (stockMovementRequiresBatchReceiptFields.value && !stockMovementForm.batchNumber.trim()) return true;
    return stockMovementProjectedNegative.value;
});

const stockReconciliationUsesBatchTracking = computed(() => Boolean(stockMovementCategoryOption.value?.requiresExpiryTracking) || stockReconciliationBatchOptions.value.length > 0);
const selectedStockReconciliationBatch = computed(() => stockReconciliationBatchOptions.value.find((batch) => batch.id === stockReconciliationForm.batchId) ?? null);
const stockReconciliationSubmitDisabled = computed(() => {
    if (stockReconciliationSubmitting.value || !canReconcileStock.value) return true;
    if (!stockReconciliationForm.itemId.trim() || !stockReconciliationForm.reason.trim()) return true;
    if (stockReconciliationUsesBatchTracking.value) {
        return !stockReconciliationForm.batchId.trim() || stockReconciliationForm.countedBatchQuantity.trim() === '';
    }
    return stockReconciliationForm.countedStock.trim() === '';
});

async function submitCreateItem() {
    if (itemCreateSubmitting.value) return;
    if (!canManageItems.value) {
        itemCreateRequestError.value = 'You do not have permission to create inventory items.';
        notifyError(itemCreateRequestError.value);
        return;
    }
    if (itemCreateSubmitReason.value) {
        itemCreateRequestError.value = itemCreateSubmitReason.value;
        notifyError(itemCreateRequestError.value);
        return;
    }
    itemCreateSubmitting.value = true;
    itemCreateErrors.value = {};
    itemCreateRequestError.value = null;
    await nextTick();
    try {
        applyItemCategoryRules(itemCreateForm);
        await apiRequest('POST', '/inventory-procurement/items', {
            body: buildItemPayload(itemCreateForm),
            meta: {
                idempotencyKey: createItemRequestKey.value,
                requestId: createItemRequestKey.value,
                entitlementContext: 'Inventory item create',
            },
        });
        notifySuccess('Inventory item created.');
        closeCreateItemDialog();
        await reloadAll();
    } catch (error) {
        const apiError = error as ApiError;
        itemCreateErrors.value = apiError.payload?.errors ?? {};
        itemCreateRequestError.value = Object.keys(itemCreateErrors.value).length > 0
            ? 'Review the highlighted item fields and try again.'
            : messageFromUnknown(error, 'Unable to create inventory item.');
        notifyError(itemCreateRequestError.value);
    } finally {
        itemCreateSubmitting.value = false;
    }
}

async function submitStockMovement() {
    if (!canCreateMovement.value || stockMovementSubmitting.value) return;
    stockMovementSubmitting.value = true;
    stockMovementErrors.value = {};
    try {
        const effectiveMovementType = stockMovementOpeningBalanceMode.value ? 'receive' : stockMovementForm.movementType;
        await apiRequest('POST', '/inventory-procurement/stock-movements', {
            body: {
                itemId: stockMovementForm.itemId.trim(),
                movementType: effectiveMovementType,
                adjustmentDirection: effectiveMovementType === 'adjust' ? stockMovementForm.adjustmentDirection : null,
                batchId: stockMovementRequiresBatchSelection.value ? (stockMovementForm.batchId || null) : null,
                batchNumber: stockMovementRequiresBatchReceiptFields.value ? (stockMovementForm.batchNumber.trim() || null) : null,
                lotNumber: stockMovementRequiresBatchReceiptFields.value ? (stockMovementForm.lotNumber.trim() || null) : null,
                manufactureDate: stockMovementRequiresBatchReceiptFields.value ? (stockMovementForm.manufactureDate || null) : null,
                expiryDate: stockMovementRequiresBatchReceiptFields.value ? (stockMovementForm.expiryDate || null) : null,
                binLocation: stockMovementRequiresBatchReceiptFields.value ? (stockMovementForm.binLocation.trim() || null) : null,
                sourceSupplierId: effectiveMovementType === 'receive' && !stockMovementOpeningBalanceMode.value ? (stockMovementForm.sourceSupplierId || null) : null,
                sourceWarehouseId: ['issue', 'transfer'].includes(effectiveMovementType) ? (stockMovementForm.sourceWarehouseId || null) : null,
                destinationWarehouseId: ['receive', 'transfer'].includes(effectiveMovementType) ? (stockMovementForm.destinationWarehouseId || null) : null,
                destinationDepartmentId: effectiveMovementType === 'issue' ? (stockMovementForm.destinationDepartmentId || null) : null,
                quantity: Number(stockMovementForm.quantity),
                isOpeningStock: stockMovementOpeningBalanceMode.value,
                reasonCode: stockMovementForm.reasonCode || null,
                reason: stockMovementOpeningBalanceMode.value
                    ? ((stockMovementReasonOptions.find((opt) => opt.value === stockMovementForm.reasonCode)?.label) ?? (stockMovementForm.reason.trim() || null))
                    : stockMovementForm.reason.trim() || null,
                notes: stockMovementForm.notes.trim() || null,
                occurredAt: stockMovementForm.occurredAt || null,
            },
        });
        const movementItemId = stockMovementForm.itemId.trim();
        notifySuccess(stockMovementSuccessMessage.value);
        stockMovementDialogOpen.value = false;
        resetStockMovementForm();
        await reloadAll();
        if (itemDetailsOpen.value && itemDetails.value?.id === movementItemId) {
            await loadItemDetails(movementItemId);
        }
    } catch (error) {
        stockMovementErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to record stock movement.'));
    } finally {
        stockMovementSubmitting.value = false;
    }
}

async function submitStockReconciliation() {
    if (!canReconcileStock.value || stockReconciliationSubmitting.value) return;
    stockReconciliationSubmitting.value = true;
    stockReconciliationErrors.value = {};
    try {
        await apiRequest('POST', '/inventory-procurement/stock-movements/reconcile', {
            body: {
                itemId: stockReconciliationForm.itemId.trim(),
                batchId: stockReconciliationUsesBatchTracking.value ? (stockReconciliationForm.batchId || null) : null,
                countedStock: stockReconciliationUsesBatchTracking.value ? null : Number(stockReconciliationForm.countedStock),
                countedBatchQuantity: stockReconciliationUsesBatchTracking.value ? Number(stockReconciliationForm.countedBatchQuantity) : null,
                reason: stockReconciliationForm.reason.trim(),
                notes: stockReconciliationForm.notes.trim() || null,
                sessionReference: stockReconciliationForm.sessionReference.trim() || null,
                occurredAt: stockReconciliationForm.occurredAt || null,
            },
        });
        const reconciliationItemId = stockReconciliationForm.itemId.trim();
        notifySuccess('Stock reconciliation recorded.');
        reconcileDialogOpen.value = false;
        resetStockReconciliationForm();
        await reloadAll();
        if (itemDetailsOpen.value && itemDetails.value?.id === reconciliationItemId) {
            await loadItemDetails(reconciliationItemId);
        }
    } catch (error) {
        stockReconciliationErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to reconcile stock.'));
    } finally {
        stockReconciliationSubmitting.value = false;
    }
}

async function openStockMovementCorrection(item: StockMovementLookupItem) {
    if (stockExecutionBlockedReason.value) { notifyError(stockExecutionBlockedReason.value); return; }
    if (!canSetOpeningStock.value) { notifyError('You do not have permission to correct opening stock.'); return; }
    stockMovementCorrectionErrors.value = {};
    resetStockMovementCorrectionForm(item);
    try {
        const response = await apiRequest<{ data: any[] }>('GET', '/inventory-procurement/stock-movements', {
            query: { itemId: item.id, isOpeningStock: 'true', perPage: 1, sortBy: 'occurredAt', sortDir: 'desc' },
        });
        const movements = response.data ?? [];
        if (movements.length === 0) { notifyError('No opening stock movement found for this item.'); return; }
        stockMovementCorrectionMovement.value = movements[0];
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to load opening stock details.'));
        return;
    }
    stockMovementCorrectionDialogOpen.value = true;
}

async function submitStockMovementCorrection() {
    const movement = stockMovementCorrectionMovement.value;
    if (!movement || stockMovementCorrectionSubmitting.value) return;
    stockMovementCorrectionSubmitting.value = true;
    stockMovementCorrectionErrors.value = {};
    try {
        await apiRequest('POST', `/inventory-procurement/stock-movements/${movement.id}/correct`, {
            body: {
                quantity: Number(stockMovementCorrectionForm.quantity),
                reason: stockMovementCorrectionForm.reason.trim()
                    || (correctionReasonOptions.find((opt) => opt.value === stockMovementCorrectionForm.reasonCode)?.label)
                    || 'Opening stock correction',
            },
        });
        notifySuccess('Opening stock corrected.');
        stockMovementCorrectionDialogOpen.value = false;
        resetStockMovementCorrectionForm();
        await reloadAll();
        if (itemDetailsOpen.value && itemDetails.value?.id === movement.itemId) {
            await loadItemDetails(movement.itemId);
        }
    } catch (error) {
        stockMovementCorrectionErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to correct opening stock.'));
    } finally {
        stockMovementCorrectionSubmitting.value = false;
    }
}

// ── Bulk actions ── (stubs for compat)
const selectedItemIds = ref<string[]>([]);

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
        canSetOpeningStock.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.set-opening-stock');
        canReconcileStock.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.reconcile-stock') || permissionSet.has('inventory.procurement.create-movement');
        canViewAudit.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.view-audit-logs');
        canManageSuppliers.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.manage-suppliers');
        canManageWarehouses.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.manage-warehouses');
    };
    applyResolvedPermissions(sharedPermissionNames.value ?? [], isFacilitySuperAdmin.value);
}

function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, options?: { query?: Record<string, any>; body?: Record<string, any>; meta?: Record<string, any> }): Promise<T> {
    return apiRequestJson<T>(method, path, { query: options?.query as any, body: options?.body, idempotencyKey: options?.meta?.idempotencyKey, requestId: options?.meta?.requestId, entitlementContext: options?.meta?.entitlementContext });
}

// ── Bind shared page API for support components ──
bindSupplyChainPageApi({
    canRead, canManageItems, canCreateMovement, canSetOpeningStock, canLaunchCreateItem, canLaunchStockMovement,
    canLaunchOpeningStock, canLaunchReconciliation, loading, itemSearch, itemCounts, items, itemPagination,
    inventoryItemSetupBlockedReason, resetItemFilters, stockStateDotClass, stockStateLabel, flashedItemId,
    inventoryItemNeedsOpeningStock, inventoryItemHasOpeningStock, stockAlertBadgeClass, openStockMovementDialog,
    inventoryItemStockActionLabel, inventoryItemListMeta, openDepartmentStockForItem, itemPages, goToItemPage, reloadAll,
    departmentStockSummary, departmentStockFiltersOpen, departmentStockScopedItem, departmentStockLoading,
    clearDepartmentStockItemScope, departmentStockFilters, applyDepartmentStockFilters, resetDepartmentStockFilters,
    departmentStock, goToDepartmentStockPage, departmentStockPagination, departmentStockPages, EMPTY_SELECT_VALUE,
    toSelectValue, fromSelectValue, formatEnumLabel, formatDateTime, formatDateOnly, auditActorLabel, formatAmount,
    mobileProcurementDrawerOpen, mobileLedgerDrawerOpen, stockLedgerFilters, stockLedgerFiltersOpen, stockLedgerSummary,
    stockLedgerLoading, stockMovements, stockMovementPagination, stockMovementSourceSummary, stockLedgerPages,
    goToStockLedgerPage, movementTypeOptions, stockLedgerSourceOptions, applyStockLedgerFilters, auditActorTypeOptions,
    resetStockLedgerFilters, submitLedgerSearchFromMobileDrawer, resetLedgerFiltersFromMobileDrawer,
    exportStockLedgerCsv, exportInventoryItemsCsv, exportDepartmentStockCsv, printCurrentView,
    createItemDialogOpen, hasCreateItemDraftContent, itemCreateForm, itemCreateErrors, itemCreateSubmitting,
    selectedCreateCategory, createSubcategoryOptions, createClinicalCatalogOptions, createClinicalCatalogSelectionRequired,
    createIdentityLockedToCatalog, createSelectedCatalogItem, selectClinicalCatalogItem, createCategoryWorkflowBadges,
    DOSAGE_FORM_OPTIONS, storageConditionOptions, controlledSubstanceScheduleOptions, venClassificationOptions,
    abcClassificationOptions, createItemWarehouseOpen, createItemSupplierOpen, itemCreateRequestError, itemCreateSubmitReason,
    itemCreateSubmitDisabled, submitCreateItem, stockMovementDialogOpen, stockMovementForm, stockMovementErrors,
    stockMovementSubmitting, stockMovementSubcategoryOptions, stockMovementLookupBlockedReason, stockMovementCategoryLabel,
    stockMovementSubcategoryLabel, stockMovementLookupHelperText, handleStockMovementItemSelected, stockMovementItem,
    stockMovementSignedDelta, stockMovementProjectedNegative, stockMovementProjectedStock, stockMovementProjectedState,
    stockMovementTypeMeta, selectedStockMovementTypeMeta, stockMovementReasonOptions, correctionReasonOptions,
    stockMovementCorrectionDialogOpen, stockMovementCorrectionSubmitting, stockMovementCorrectionErrors,
    stockMovementCorrectionItem, stockMovementCorrectionMovement, stockMovementCorrectionForm,
    resetStockMovementCorrectionForm, openStockMovementCorrection, submitStockMovementCorrection, requiresAdjustmentDirection: computed(() => stockMovementForm.movementType === 'adjust'),
    stockMovementUnitLabel, stockMovementRequiresBatchSelection, stockMovementBatchesLoading, selectedStockMovementBatch,
    stockMovementFilteredBatches, stockMovementRequiresBatchReceiptFields, stockMovementReasonRequired,
    stockMovementReasonPlaceholder, stockMovementSubmitDisabled, stockMovementSubmitLabel, submitStockMovement,
    reconcileDialogOpen, stockReconciliationForm, stockReconciliationErrors, stockReconciliationSubmitting,
    handleStockReconciliationItemSelected, stockReconciliationUsesBatchTracking, stockReconciliationBatchesLoading,
    selectedStockReconciliationBatch, stockReconciliationBatchOptions, stockReconciliationSubmitDisabled,
    submitStockReconciliation, itemDetailsOpen, itemDetailsLoading, itemDetailsError, itemDetailsTab, itemDetailsSummaryCards,
    itemDetails, itemUpdateForm, itemUpdateErrors, itemUpdateSubmitting, selectedUpdateCategory, updateSubcategoryOptions,
    updateClinicalCatalogOptions, updateIdentityLockedToCatalog, updateSelectedCatalogItem, updateCategoryWorkflowBadges,
    updateItemWarehouseOpen, updateItemSupplierOpen, submitItemUpdate, itemStatusForm, itemStatusOptions, itemStatusSubmitting,
    itemStatusError, submitItemStatus, itemBatches, itemBatchesLoading, loadItemBatches, expiryBadgeClass, clinicalCatalogLabel,
    itemAuditFilters, itemAuditLoading, itemAuditError, itemAuditExporting, itemAuditLogs, itemAuditMeta,
    applyItemAuditFilters: () => { itemAuditFilters.page = 1; loadItemAuditLogs(); },
    resetItemAuditFilters: () => { itemAuditFilters.q = ''; itemAuditFilters.action = ''; itemAuditFilters.actorType = ''; itemAuditFilters.actorId = ''; itemAuditFilters.from = ''; itemAuditFilters.to = ''; itemAuditFilters.page = 1; loadItemAuditLogs(); },
    exportItemAuditLogsCsv: async () => {
        if (!itemDetails.value || !canViewAudit.value || itemAuditExporting.value) return;
        itemAuditExporting.value = true;
        try {
            const url = new URL(`/api/v1/inventory-procurement/items/${itemDetails.value.id}/audit-logs/export`, window.location.origin);
            Object.entries(itemAuditQuery()).forEach(([key, value]) => {
                if (value === null || value === '') return;
                url.searchParams.set(key, String(value));
            });
            window.open(url.toString(), '_blank', 'noopener');
        } finally { itemAuditExporting.value = false; }
    }, goToItemAuditPage: (page: number) => { itemAuditFilters.page = page; loadItemAuditLogs(); },
    loadItemDetails, openItemDetails, closeItemDetails, requestItemDetailsOpenChange, confirmItemDetailsDiscard,
    createBatchDialogOpen, batchForm, batchCreateSubmitting, batchCreateErrors, fieldError, submitCreateBatch,
    createUnitDialogOpen, openCreateUnitDialog, createPriceDialogOpen, unitForm, unitFormErrors, unitFormSubmitting,
    editingUnitId, submitCreateUnit, submitDeactivateUnit, openEditUnitDialog, itemUnits, itemUnitsLoading, loadItemUnits,
    resetUnitForm, unitPrices, unitPricesLoading, loadItemUnitPrices, suppliers, warehouses, departments, barcodeScannerOpen,
    barcodeInput, barcodeLookupLoading, barcodeLookupError, barcodeLookupResult, onBarcodeKeydown, lookupBarcode,
    inventoryAutoRefreshInterval, INVENTORY_AUTO_REFRESH_LABEL,     refreshInventoryItems,
    headerActions: computed(() => []), canSyncFromCatalog, catalogSyncDialogOpen, openCatalogSyncDialog,
    importItemsCsvDialogOpen, importItemsCsvSubmitting, importItemsCsvFile, importItemsCsvInputKey, importItemsCsvResult,
    openImportItemsCsvDialog: () => { importItemsCsvDialogOpen.value = true; },
    closeImportItemsCsvDialog: () => { importItemsCsvDialogOpen.value = false; },
    submitImportItemsCsv: async () => {
        if (!importItemsCsvFile.value || importItemsCsvSubmitting.value) return;
        importItemsCsvSubmitting.value = true;
        importItemsCsvResult.value = null;
        try {
            const formData = new FormData();
            formData.append('file', importItemsCsvFile.value);
            const response = await apiRequest<{ data: { successful: number; failed: number; errors?: string } }>('POST', '/inventory-procurement/items/import-csv', { body: formData as any });
            importItemsCsvResult.value = response.data ?? { successful: 0, failed: 0 };
            notifySuccess(`Import complete: ${importItemsCsvResult.value.successful} successful, ${importItemsCsvResult.value.failed} failed.`);
            if (importItemsCsvResult.value.failed === 0) {
                importItemsCsvDialogOpen.value = false;
                await reloadAll();
            }
        } catch (error) {
            notifyError(messageFromUnknown(error, 'CSV import failed.'));
        } finally {
            importItemsCsvSubmitting.value = false;
        }
    },
    createItemRequestKey, itemUpdateRequestKey, itemStatusRequestKey, createItemDiscardConfirmOpen,
    requestCreateItemOpenChange, confirmCreateItemDiscard, itemDetailsDiscardConfirmOpen, hasPendingCreateItemWorkflow,
    hasPendingItemDetailsWorkflow, isSubmittingInventoryWorkflow,
    itemCreateValidationMessages: computed(() => {
        const messages: string[] = [];
        if (!itemCreateForm.itemName.trim()) messages.push('Item name is required.');
        if (!itemCreateForm.category.trim()) messages.push('Category is required.');
        if (!itemCreateForm.unit.trim()) messages.push('Unit is required.');
        return messages;
    }), clearPersistedCreateItemDraft, discardCreateItemDraft: () => {
        Object.assign(itemCreateForm, createEmptyItemForm());
        clearPersistedCreateItemDraft();
    },
    stockMovementSelectionResetLocked: ref(stockMovementSelectionResetLocked) as any,
    itemFilterChips, hasAnyItemFilters, referenceStructureLoaded: ref(true),
    isStoreOperations, canReconcileStock, canCreateRequest: ref(false), canUpdateRequestStatus: ref(false),
    canApproveRequisitions: ref(false), inventoryAccess,
    flushInventorySearch, lookupOptionText, supplierLabel, warehouseLabel,
    stockStateOptions, itemCategoryOptions, restoredCreateItemDraft,
    stockMovementOpeningBalanceMode, stockMovementSheetTitle: computed(() => stockMovementOpeningBalanceMode.value ? 'Opening Stock' : 'Stock Movement'),
    stockMovementSheetDescription: computed(() => stockMovementOpeningBalanceMode.value ? 'Record the opening stock balance for this item' : 'Record a stock movement against this item'),
    openCreateItemDialog, batchOptionLabel: (batch: any) => batch ? `${batch.batchNumber ?? batch.id ?? 'Batch'} — ${batch.quantity ?? 0} units` : 'Select batch',
    canSelectAnyRequisitionDepartment: computed(() => false),
    departmentFilterOptions: computed(() => []),
    setDepartmentStockDepartmentFilter: () => {},
    procurementSearch: reactive({ q: '', status: '', sortBy: 'createdAt', sortDir: 'desc', page: 1, perPage: 20 }),
    procurementStatusOptions: [],
    hasAnyProcurementFilters: computed(() => false),
    resetProcurementFiltersFromMobileDrawer: () => {},
    submitProcurementSearchFromMobileDrawer: () => {},
    leadTimeForm: reactive({ supplierId: '', itemId: '', leadTimeDays: 0, notes: '' }),
    leadTimeErrors: ref({} as Record<string, string>),
    leadTimeSubmitting: ref(false),
    submitCreateLeadTime: () => Promise.resolve(),
    createLeadTimeDialogOpen: ref(false),
    deliveryForm: reactive({ deliveredAt: '', notes: '' }),
    deliveryErrors: ref({} as Record<string, string>),
    deliverySubmitting: ref(false),
    submitRecordDelivery: () => Promise.resolve(),
    recordDeliveryDialogOpen: ref(false),
    transfers: ref([]),
});

watch(() => itemCreateForm.category, (newCategory, oldCategory) => {
    applyItemCategoryRules(itemCreateForm);
    clearStalePresetSubcategory(itemCreateForm, oldCategory, newCategory);
});
watch(() => itemUpdateForm.category, (newCategory, oldCategory) => {
    applyItemCategoryRules(itemUpdateForm);
    clearStalePresetSubcategory(itemUpdateForm, oldCategory, newCategory);
});
watch(() => itemCreateForm.isControlledSubstance, (value) => {
    if (!value) itemCreateForm.controlledSubstanceSchedule = '';
});
watch(() => itemUpdateForm.isControlledSubstance, (value) => {
    if (!value) itemUpdateForm.controlledSubstanceSchedule = '';
});
watch(() => itemSearch.q, () => {
    if (inventorySearchTimer) clearTimeout(inventorySearchTimer);
    inventorySearchTimer = setTimeout(() => {
        inventorySearchTimer = null;
        if (!canRead.value) return;
        itemSearch.page = 1;
        void refreshInventoryItems();
    }, 300);
});
watch(() => itemSearch.category, () => { itemSearch.page = 1; void refreshInventoryItems(); });
watch(() => itemSearch.stockState, () => { itemSearch.page = 1; void refreshInventoryItems(); });
watch(() => itemSearch.sortBy, () => { itemSearch.page = 1; void refreshInventoryItems(); });
watch(() => itemSearch.sortDir, () => { itemSearch.page = 1; void refreshInventoryItems(); });
watch(() => stockLedgerFilters.q, () => {
    if (stockLedgerSearchTimer) clearTimeout(stockLedgerSearchTimer);
    stockLedgerSearchTimer = setTimeout(() => {
        stockLedgerSearchTimer = null;
        if (!canRead.value) return;
        stockLedgerFilters.page = 1;
        void loadStockLedger();
    }, 300);
});
watch(() => stockLedgerFilters.movementType, () => { stockLedgerFilters.page = 1; void loadStockLedger(); });
watch(() => stockLedgerFilters.sourceKey, () => { stockLedgerFilters.page = 1; void loadStockLedger(); });
watch(() => departmentStockFilters.q, () => {
    if (departmentStockSearchTimer) clearTimeout(departmentStockSearchTimer);
    departmentStockSearchTimer = setTimeout(() => {
        departmentStockSearchTimer = null;
        if (!canRead.value) return;
        departmentStockFilters.page = 1;
        void loadDepartmentStock();
    }, 300);
});
watch(() => departmentStockFilters.departmentId, () => { departmentStockFilters.page = 1; void loadDepartmentStock(); });
watch(() => activeTab.value, () => { syncStockControlStateToUrl(); });
watch(() => [itemSearch.q, itemSearch.category, itemSearch.stockState, itemSearch.sortBy, itemSearch.sortDir, itemSearch.page, itemSearch.perPage], () => {
    syncStockControlStateToUrl();
});
watch(() => [stockLedgerFilters.q, stockLedgerFilters.itemId, stockLedgerFilters.movementType, stockLedgerFilters.sourceKey, stockLedgerFilters.actorType, stockLedgerFilters.actorId, stockLedgerFilters.from, stockLedgerFilters.to, stockLedgerFilters.page, stockLedgerFilters.perPage], () => {
    syncStockControlStateToUrl();
});
watch(() => [departmentStockFilters.q, departmentStockFilters.departmentId, departmentStockFilters.itemId, departmentStockFilters.page, departmentStockFilters.perPage], () => {
    syncStockControlStateToUrl();
});
// ── Lifecycle ──
onBeforeUnmount(() => {
    if (pollingTimer) clearInterval(pollingTimer);
    if (flashedItemTimer) clearTimeout(flashedItemTimer);
    if (inventorySearchTimer) clearTimeout(inventorySearchTimer);
    if (stockLedgerSearchTimer) clearTimeout(stockLedgerSearchTimer);
    if (departmentStockSearchTimer) clearTimeout(departmentStockSearchTimer);
    clearSupplyChainPageApi();
});

onMounted(async () => {
    hydrateStockControlStateFromUrl();
    await loadPermissions();
    await Promise.allSettled([loadItems(), loadStockLedger(), loadDepartmentStock()]);
    await loadSuppliersAndWarehouses();
    loading.value = false;
});
</script>

<template>
    <Head title="Stock Control" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="package" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">Stock Control</h1>
                                <Badge v-if="permissionsResolved && !canRead" variant="outline" class="h-5 px-1.5 text-[10px] font-medium">
                                    View only
                                </Badge>
                            </div>
                            <p class="truncate text-xs text-muted-foreground">Inventory items, stock ledger, and department stock</p>
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
                            @click="reloadAll"
                        >
                            <AppIcon :name="(loading ? 'loader-circle' : 'refresh-cw') as AppIconName" class="size-3.5" :class="loading ? 'animate-spin' : ''" />
                        </Button>
                        <template v-for="action in headerActions" :key="action.key">
                            <Select v-if="action.isDropdown" :model-value="action.dropdownValue" @update:model-value="(value) => action.onDropdownChange?.(String(value ?? EMPTY_SELECT_VALUE))">
                                <SelectTrigger class="h-8 w-[8rem] rounded-lg text-xs data-[size=default]:h-8" :title="action.dropdownValue !== 'off' ? `Auto-refresh every ${action.dropdownValue}` : 'Auto-refresh off'">
                                    <SelectValue placeholder="Auto" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="opt in action.dropdownOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button v-else :size="'sm'" :variant="action.variant ?? 'outline'" :class="[action.class ?? '', 'h-8', action.iconOnly ? 'w-8 p-0' : 'gap-1.5']" :disabled="action.disabled || action.loading" @click="action?.onClick">
                                <AppIcon :name="action.icon as AppIconName" :class="`size-3.5 ${action.loading ? 'animate-spin' : ''}`" />
                                <span v-if="!action.iconOnly">{{ action.label }}</span>
                            </Button>
                        </template>
                        <Button v-if="canReconcileStock" size="sm" variant="outline" class="h-8 gap-1.5" :disabled="!canLaunchReconciliation" @click="openReconcileDialog">
                            <AppIcon name="shield-check" class="size-3.5" /> Reconcile stock
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                                    <AppIcon name="ellipsis-vertical" class="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" class="w-48">
                                <DropdownMenuItem @click="barcodeScannerOpen = true">
                                    <AppIcon name="search" class="size-4" /> Barcode lookup
                                </DropdownMenuItem>
                                <DropdownMenuItem @click="openReconcileDialog" :disabled="!canLaunchReconciliation">
                                    <AppIcon name="shield-check" class="size-4" /> Reconcile stock
                                </DropdownMenuItem>
                                <DropdownMenuItem as-child>
                                    <Link href="/inventory-procurement/procurement" class="gap-2">
                                        <AppIcon name="clipboard-list" class="size-4" /> Procurement
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem as-child>
                                    <Link href="/inventory-procurement/requests-fulfilment" class="gap-2">
                                        <AppIcon name="activity" class="size-4" /> Requests & Fulfilment
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

            <Alert v-if="!permissionsResolved">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="loader-circle" class="size-4 animate-spin" />
                    Resolving access
                </AlertTitle>
                <AlertDescription>Permission context is still loading.</AlertDescription>
            </Alert>

            <template v-if="!canRead && permissionsResolved">
                <Alert variant="destructive">
                    <AlertTitle class="flex items-center gap-2">
                        <AppIcon name="alert-triangle" class="size-4" />
                        Access denied
                    </AlertTitle>
                    <AlertDescription>You do not have `inventory-procurement.read` permission, so this page cannot load the stock control data.</AlertDescription>
                </Alert>
            </template>

            <template v-else>
                <Card class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                    <Tabs :model-value="activeTab" :unmount-on-hide="false" class="flex h-full min-h-0 flex-col" @update:model-value="(v) => { activeTab = v as StockControlTab; }">
                        <div class="flex flex-col gap-3 border-b px-4 py-3">
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div class="min-w-0 shrink-0">
                                    <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                        <AppIcon :name="tabHeader.icon as AppIconName" class="size-4 text-primary" />
                                        {{ tabHeader.title }}
                                    </h3>
                                    <p class="mt-1 text-xs text-muted-foreground">{{ tabHeader.description }}</p>
                                </div>
                                <div class="flex min-w-0 items-center gap-2">
                                    <div class="relative min-w-0 flex-1 lg:flex-none">
                                        <AppIcon name="search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            v-if="activeTab === 'inventory'"
                                            v-model="itemSearch.q"
                                            class="h-8 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-80"
                                            :placeholder="searchPlaceholder"
                                            @keydown.enter="handleSearch"
                                        />
                                        <input
                                            v-else-if="activeTab === 'ledger'"
                                            v-model="stockLedgerFilters.q"
                                            class="h-8 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-80"
                                            :placeholder="searchPlaceholder"
                                            @keydown.enter="handleSearch"
                                        />
                                        <input
                                            v-else
                                            v-model="departmentStockFilters.q"
                                            class="h-8 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-80"
                                            :placeholder="searchPlaceholder"
                                            @keydown.enter="handleSearch"
                                        />
                                    </div>
                                    <SupplyChainFilterPopover :filter-count="filterCount" @apply="applyFilters" @reset="resetAllFilters">
                                        <template v-if="activeTab === 'inventory'">
                                            <div class="grid gap-2">
                                                <Label>Category</Label>
                                                <Select :model-value="toSelectValue(itemSearch.category)" @update:model-value="itemSearch.category = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE)); itemSearch.page = 1; refreshInventoryItems()">
                                                    <SelectTrigger class="w-full"><SelectValue placeholder="All Categories" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem :value="EMPTY_SELECT_VALUE">All Categories</SelectItem>
                                                        <SelectItem v-for="cat in itemCategoryOptions" :key="cat.value" :value="cat.value">{{ cat.label }}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label>Stock state</Label>
                                                <Select :model-value="toSelectValue(itemSearch.stockState)" @update:model-value="itemSearch.stockState = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE)); itemSearch.page = 1; refreshInventoryItems()">
                                                    <SelectTrigger class="w-full"><SelectValue placeholder="All stock states" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem :value="EMPTY_SELECT_VALUE">All stock states</SelectItem>
                                                        <SelectItem v-for="opt in stockStateOptions" :key="opt" :value="opt">{{ stockStateLabel(opt) }}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label>Sort by</Label>
                                                <Select :model-value="toSelectValue(itemSearch.sortBy)" @update:model-value="itemSearch.sortBy = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE)); itemSearch.page = 1; refreshInventoryItems()">
                                                    <SelectTrigger class="w-full"><SelectValue placeholder="Sort by" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="itemName">Name</SelectItem>
                                                        <SelectItem value="itemCode">Code</SelectItem>
                                                        <SelectItem value="currentStock">Store Stock</SelectItem>
                                                        <SelectItem value="category">Category</SelectItem>
                                                        <SelectItem value="createdAt">Created</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </template>
                                        <template v-else-if="activeTab === 'ledger'">
                                            <div class="grid gap-2">
                                                <Label>Movement type</Label>
                                                <Select :model-value="toSelectValue(stockLedgerFilters.movementType)" @update:model-value="stockLedgerFilters.movementType = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                                    <SelectTrigger class="w-full"><SelectValue placeholder="All types" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem :value="EMPTY_SELECT_VALUE">All types</SelectItem>
                                                        <SelectItem v-for="opt in movementTypeOptions" :key="`ft-${opt}`" :value="opt">{{ formatEnumLabel(opt) }}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label>Source</Label>
                                                <Select :model-value="toSelectValue(stockLedgerFilters.sourceKey)" @update:model-value="stockLedgerFilters.sourceKey = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                                    <SelectTrigger class="w-full"><SelectValue placeholder="All sources" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem v-for="option in stockLedgerSourceOptions" :key="`fs-${option.value || 'all'}`" :value="toSelectValue(option.value)">{{ option.label }}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label>From</Label>
                                                <input v-model="stockLedgerFilters.from" type="datetime-local" class="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label>To</Label>
                                                <input v-model="stockLedgerFilters.to" type="datetime-local" class="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                                            </div>
                                        </template>
                                        <template v-else-if="activeTab === 'department-stock'">
                                            <div class="grid gap-2">
                                                <Label for="stock-popover-department">Department</Label>
                                                <Select :model-value="toSelectValue(departmentStockFilters.departmentId)" @update:model-value="setDepartmentStockDepartmentFilter(String($event ?? EMPTY_SELECT_VALUE))">
                                                    <SelectTrigger id="stock-popover-department" class="w-full" :disabled="!canSelectAnyRequisitionDepartment">
                                                        <SelectValue :placeholder="canSelectAnyRequisitionDepartment ? 'All departments' : 'Your department'" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem v-if="canSelectAnyRequisitionDepartment" :value="EMPTY_SELECT_VALUE">All departments</SelectItem>
                                                        <SelectItem v-for="dept in departmentFilterOptions" :key="`popover-ds-${dept.id}`" :value="dept.id" :text-value="dept.name">
                                                            {{ dept.name }}<span v-if="dept.code" class="text-muted-foreground"> ({{ dept.code }})</span>
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </template>
                                        <div class="grid gap-2">
                                            <Label>Per page</Label>
                                            <Select :model-value="String(activeTab === 'inventory' ? itemSearch.perPage : activeTab === 'ledger' ? stockLedgerFilters.perPage : departmentStockFilters.perPage)" @update:model-value="handlePerPageChange(String($event))">
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
                                <TabsTrigger value="inventory" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <span class="flex items-center gap-1 leading-none">
                                        <AppIcon name="package" class="size-3" />
                                        Inventory Items
                                    </span>
                                </TabsTrigger>
                                <TabsTrigger value="ledger" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <span class="flex items-center gap-1 leading-none">
                                        <AppIcon name="activity" class="size-3" />
                                        Stock Ledger
                                    </span>
                                </TabsTrigger>
                                <TabsTrigger value="department-stock" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <span class="flex items-center gap-1 leading-none">
                                        <AppIcon name="building-2" class="size-3" />
                                        Department Stock
                                    </span>
                                </TabsTrigger>
                            </TabsList>

                            <div v-if="hasAnyStockFilter" class="flex flex-wrap items-center gap-1.5 border-t py-2">
                                <span class="text-[11px] text-muted-foreground">Filters:</span>
                                <Badge v-for="chip in stockFilterChips" :key="`stock-filter-${chip}`" variant="outline" class="text-[11px]">
                                    {{ chip }}
                                </Badge>
                                <button class="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline" @click="resetAllFilters">
                                    Clear all
                                </button>
                            </div>
                        </div>

                        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <TabsContent value="inventory" class="m-0 flex min-h-0 flex-1 flex-col">
                                <SupplyChainInventoryTab />
                            </TabsContent>
                            <TabsContent value="ledger" class="m-0 flex min-h-0 flex-1 flex-col">
                                <SupplyChainLedgerTab />
                            </TabsContent>
                            <TabsContent value="department-stock" class="m-0 flex min-h-0 flex-1 flex-col">
                                <SupplyChainDepartmentStockTab />
                            </TabsContent>
                        </div>
                    </Tabs>
                </Card>

                <SupplyChainFilterOverlays />
            </template>
        </div>
    </AppLayout>

    <SupplyChainAuxiliarySheets />
    <SupplyChainInventoryOpsSheets />
    <SupplyChainItemDetailsSheet />
    <SupplyChainCatalogSyncDialog />
    <SupplyChainInventoryImportCsvDialog />

    <Sheet :open="createUnitDialogOpen" @update:open="createUnitDialogOpen = $event">
        <SheetContent side="right" variant="form" size="2xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="package" class="size-5 text-muted-foreground" />
                    {{ editingUnitId ? 'Edit Unit' : 'Add Selling Unit' }}
                </SheetTitle>
                <SheetDescription>
                    {{ editingUnitId ? 'Update conversion and defaults for this unit.' : 'Define a new sellable or receivable unit for this item.' }}
                </SheetDescription>
            </SheetHeader>
            <div class="min-h-0 flex-1 overflow-y-auto p-4">
                <Alert v-if="Object.keys(unitFormErrors).length > 0" variant="destructive" class="mb-4">
                    <AlertTitle>Form needs review</AlertTitle>
                    <AlertDescription>{{ Object.values(unitFormErrors).flat().join(', ') }}</AlertDescription>
                </Alert>
                <div class="grid gap-4">
                    <fieldset class="grid gap-2 rounded-lg border p-2 sm:grid-cols-2">
                        <legend class="px-2 text-xs font-medium text-muted-foreground">Unit Identity</legend>
                        <div class="grid gap-1">
                            <Label for="inv-unit-name">Unit Name *</Label>
                            <Input id="inv-unit-name" v-model="unitForm.unitName" :disabled="unitFormSubmitting" placeholder="e.g. tablet, blister, box" />
                            <p v-if="unitFormErrors['unit_name']" class="text-xs text-destructive">{{ unitFormErrors['unit_name'][0] }}</p>
                        </div>
                        <div class="grid gap-1">
                            <Label for="inv-unit-code">Unit Code</Label>
                            <Input id="inv-unit-code" v-model="unitForm.unitCode" :disabled="unitFormSubmitting" placeholder="e.g. TAB, BLT, BOX" />
                            <p v-if="unitFormErrors['unit_code']" class="text-xs text-destructive">{{ unitFormErrors['unit_code'][0] }}</p>
                        </div>
                        <div class="grid gap-1">
                            <Label for="inv-unit-base-qty">Base Quantity *</Label>
                            <Input id="inv-unit-base-qty" v-model="unitForm.baseQuantity" :disabled="unitFormSubmitting" type="number" min="0.000001" step="1" placeholder="1" />
                            <p class="text-xs text-muted-foreground">How many base units make 1 of this unit?</p>
                            <p v-if="unitFormErrors['base_quantity']" class="text-xs text-destructive">{{ unitFormErrors['base_quantity'][0] }}</p>
                        </div>
                        <div class="grid gap-1">
                            <Label for="inv-unit-barcode">Barcode</Label>
                            <Input id="inv-unit-barcode" v-model="unitForm.barcode" :disabled="unitFormSubmitting" placeholder="Optional unit-level barcode" />
                            <p v-if="unitFormErrors['barcode']" class="text-xs text-destructive">{{ unitFormErrors['barcode'][0] }}</p>
                        </div>
                    </fieldset>
                    <fieldset class="grid gap-2 rounded-lg border p-2 sm:grid-cols-2">
                        <legend class="px-2 text-xs font-medium text-muted-foreground">Defaults</legend>
                        <label class="flex items-center gap-2 pt-2 text-sm">
                            <Checkbox :checked="unitForm.isDefaultSalesUnit" :disabled="unitFormSubmitting" @update:checked="unitForm.isDefaultSalesUnit = $event" />
                            Default sales unit
                        </label>
                        <label class="flex items-center gap-2 pt-2 text-sm">
                            <Checkbox :checked="unitForm.isDefaultPurchaseUnit" :disabled="unitFormSubmitting" @update:checked="unitForm.isDefaultPurchaseUnit = $event" />
                            Default purchase unit
                        </label>
                    </fieldset>
                </div>
            </div>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="resetUnitForm(); createUnitDialogOpen = false">Cancel</Button>
                <Button :disabled="unitFormSubmitting" class="gap-1.5" @click="submitCreateUnit">
                    <AppIcon name="plus" class="size-3.5" />
                    {{ unitFormSubmitting ? 'Saving...' : (editingUnitId ? 'Update Unit' : 'Create Unit') }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>



