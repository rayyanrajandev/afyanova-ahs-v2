<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, ref, nextTick, onBeforeUnmount, onMounted, reactive, watch, type Ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import BillingInvoiceLookupField from '@/components/billing/BillingInvoiceLookupField.vue';
import ClaimsInsuranceCaseLookupField from '@/components/claims/ClaimsInsuranceCaseLookupField.vue';
import ClinicalContextBanner from '@/components/domain/clinical/ClinicalContextBanner.vue';
import ComboboxField from '@/components/forms/ComboboxField.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import InventoryEmptyState from '@/components/inventory/InventoryEmptyState.vue';
import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';
import FacilityWorkspacePageHeader from '@/components/layout/FacilityWorkspacePageHeader.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input, SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { useWorkflowDraftPersistence } from '@/composables/useWorkflowDraftPersistence';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import {
    departmentDisplayName,
    departmentRequesterHeaderDescription,
} from '@/lib/departmentRequisitionContext';
import { generateRequestKey } from '@/lib/idempotency';
import {
    INVENTORY_PROCUREMENT_HOME_PATH,
    inventoryWorkspaceHref,
    normalizeInventoryWorkspaceSection,
} from '@/lib/inventoryProcurement';
import {
    canAccessInventoryWorkspaceSection,
    defaultInventoryWorkspaceSection,
    isInventoryDepartmentRequester,
    isInventoryStoreOperations,
    type InventoryProcurementAccess,
} from '@/lib/inventoryProcurementAccess';
import { formatEnumLabel } from '@/lib/labels';
import {
    departmentRequisitionStripeClass,
    procurementRequestStripeClass,
    shortageReadinessStripeClass,
    stockMovementStripeClass,
} from '@/lib/listRows';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { EMPTY_SELECT_VALUE, fromSelectValue, toSelectValue } from '@/pages/inventory-procurement/workspace/constants';
import { clearInventoryWorkspace } from '@/pages/inventory-procurement/workspace/inventoryWorkspaceApi';
import { bindInventoryWorkspace } from '@/pages/inventory-procurement/workspace/registerInventoryWorkspaceApi';
import { useRequestPipelineCounts } from '@/pages/inventory-procurement/workspace/useRequestPipelineCounts';
import WorkspaceAuxiliarySheets from '@/pages/inventory-procurement/workspace/WorkspaceAuxiliarySheets.vue';
import WorkspaceCatalogSyncDialog from '@/pages/inventory-procurement/workspace/WorkspaceCatalogSyncDialog.vue';
import WorkspaceClaimsAndMsdSheets from '@/pages/inventory-procurement/workspace/WorkspaceClaimsAndMsdSheets.vue';
import WorkspaceFilterOverlays from '@/pages/inventory-procurement/workspace/WorkspaceFilterOverlays.vue';
import WorkspaceInventoryImportCsvDialog from '@/pages/inventory-procurement/workspace/WorkspaceInventoryImportCsvDialog.vue';
import WorkspaceInventoryOpsSheets from '@/pages/inventory-procurement/workspace/WorkspaceInventoryOpsSheets.vue';
import WorkspaceItemDetailsSheet from '@/pages/inventory-procurement/workspace/WorkspaceItemDetailsSheet.vue';
import { type RequestPipelineStage, type WorkspaceNextAction } from '@/pages/inventory-procurement/workspace/workspaceOverview';
import WorkspaceProcurementLifecycleSheets from '@/pages/inventory-procurement/workspace/WorkspaceProcurementLifecycleSheets.vue';
import WorkspaceRequestEntrySheets from '@/pages/inventory-procurement/workspace/WorkspaceRequestEntrySheets.vue';
import WorkspaceRequisitionDetailsSheet from '@/pages/inventory-procurement/workspace/WorkspaceRequisitionDetailsSheet.vue';
import {
    WorkspaceAnalyticsTab,
    WorkspaceClaimsTab,
    WorkspaceDepartmentStockTab,
    WorkspaceInventoryTab,
    WorkspaceLeadTimesTab,
    WorkspaceLedgerTab,
    WorkspaceMsdOrdersTab,
    WorkspaceOverviewTab,
    WorkspaceProcurementTab,
    WorkspaceRequisitionsTab,
    WorkspaceShortageQueueTab,
    WorkspaceTransfersTab,
} from '@/pages/inventory-procurement/workspace/workspaceTabComponents';
import WorkspaceTransferSheets from '@/pages/inventory-procurement/workspace/WorkspaceTransferSheets.vue';
import { type BreadcrumbItem } from '@/types';

type ApiError = Error & {
    payload?: {
        message?: string;
        errors?: Record<string, string[]>;
    };
};

type SelectOption = {
    value: string;
    label: string;
};

type InventoryCategoryTemplate = 'pharmaceutical' | 'expiry_sensitive' | 'specialist_equipment' | 'general_supply';

type InventoryCategoryOption = SelectOption & {
    template: InventoryCategoryTemplate;
    description: string;
    requiresExpiryTracking: boolean;
    requiresColdChain: boolean;
    controlledSubstanceEligible: boolean;
    supportsMedicineDetails: boolean;
    supportsStorageFields: boolean;
    supportsClinicalClassification: boolean;
};

type InventoryItemFormState = {
    clinicalCatalogItemId: string;
    itemCode: string;
    itemName: string;
    genericName: string;
    dosageForm: string;
    strength: string;
    category: string;
    subcategory: string;
    venClassification: string;
    abcClassification: string;
    unit: string;
    dispensingUnit: string;
    conversionFactor: string;
    binLocation: string;
    manufacturer: string;
    storageConditions: string;
    requiresColdChain: boolean;
    isControlledSubstance: boolean;
    controlledSubstanceSchedule: string;
    msdCode: string;
    nhifCode: string;
    barcode: string;
    reorderLevel: string;
    maxStockLevel: string;
    defaultWarehouseId: string;
    defaultSupplierId: string;
};

type StockMovementLookupItem = {
    id: string;
    itemCode?: string | null;
    itemName?: string | null;
    genericName?: string | null;
    category?: string | null;
    subcategory?: string | null;
    unit?: string | null;
    currentStock?: number | string | null;
    reorderLevel?: number | string | null;
    movementCount?: number | string | null;
    status?: string | null;
    stockState?: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Supply chain', href: INVENTORY_PROCUREMENT_HOME_PATH },
    { title: 'Workspace', href: inventoryWorkspaceHref() },
];

type InventoryAutoRefreshKey = 'off' | '30s' | '1m' | '5m';

const INVENTORY_AUTO_REFRESH_INTERVAL_MS: Record<InventoryAutoRefreshKey, number> = {
    off: 0,
    '30s': 30_000,
    '1m': 60_000,
    '5m': 300_000,
};

const INVENTORY_AUTO_REFRESH_LABEL: Record<InventoryAutoRefreshKey, string> = {
    off: 'Auto: Off',
    '30s': 'Auto: 30s',
    '1m': 'Auto: 1m',
    '5m': 'Auto: 5m',
};

function useLocalStorageString<T extends string>(key: string, defaultValue: T, valid: readonly T[]): Ref<T> {
    const state = ref(defaultValue) as Ref<T>;
    onMounted(() => {
        if (typeof window === 'undefined') return;
        const raw = window.localStorage.getItem(key);
        if (raw && (valid as readonly string[]).includes(raw)) {
            state.value = raw as T;
        }
    });
    watch(state, (value) => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(key, value);
    });
    return state;
}

const INVENTORY_ITEM_CREATE_DRAFT_STORAGE_KEY = 'ahs.inventory-procurement.create-item-draft.v1';

const stockStateOptions = ['out_of_stock', 'low_stock', 'healthy'] as const;
const procurementStatusOptions = ['draft', 'pending_approval', 'approved', 'rejected', 'ordered', 'received', 'cancelled'] as const;
const procurementManualStatusOptions = procurementStatusOptions;
const movementTypeOptions = ['receive', 'issue', 'adjust', 'transfer'] as const;

const correctionReasonOptions: Array<{ value: string; label: string }> = [
    { value: 'opening_balance', label: 'Opening Balance Correction' },
    { value: 'physical_count_adjustment', label: 'Physical Count Adjustment' },
    { value: 'audit_correction', label: 'Audit Correction' },
    { value: 'other', label: 'Other' },
];

const stockMovementReasonOptions: Array<{ value: string; label: string }> = [
    { value: 'opening_balance', label: 'Opening Balance' },
    { value: 'physical_count_adjustment', label: 'Physical Count Adjustment' },
    { value: 'expiry_write_off', label: 'Expiry Write-off' },
    { value: 'damaged_stock', label: 'Damaged Stock' },
    { value: 'donation', label: 'Donation' },
    { value: 'emergency_replenishment', label: 'Emergency Replenishment' },
    { value: 'audit_correction', label: 'Audit Correction' },
    { value: 'return_to_supplier', label: 'Return to Supplier' },
    { value: 'other', label: 'Other' },
];
const stockMovementTypeMeta: Record<(typeof movementTypeOptions)[number], { label: string; description: string; impact: string; reasonPlaceholder: string }> = {
    receive: {
        label: 'Receive',
        description: 'Add delivered, returned, or opening-balance stock into on-hand inventory.',
        impact: 'Adds stock',
        reasonPlaceholder: 'Delivery note, return note, opening balance, or receipt reference',
    },
    issue: {
        label: 'Issue',
        description: 'Remove stock issued to wards, departments, procedures, or direct patient use.',
        impact: 'Reduces stock',
        reasonPlaceholder: 'Ward issue, patient dispense, damaged issue, or issue reference',
    },
    adjust: {
        label: 'Adjust',
        description: 'Correct stock variance after count, expiry write-off, spoilage, or audit findings.',
        impact: 'Variance control',
        reasonPlaceholder: 'Cycle count variance, expiry write-off, damaged stock, or audit correction',
    },
    transfer: {
        label: 'Transfer Out',
        description: 'Record stock leaving the current store before it is received elsewhere.',
        impact: 'Reduces stock',
        reasonPlaceholder: 'Transfer reference, destination store, or transfer reason',
    },
};
const auditActorTypeOptions = [
    { value: '', label: 'All actors' },
    { value: 'user', label: 'User only' },
    { value: 'system', label: 'System only' },
] as const;
const stockLedgerSourceOptions = [
    { value: '', label: 'All sources' },
    { value: 'clinical_consumption', label: 'Clinical consumption' },
    { value: 'procurement_receipt', label: 'Procurement receipt' },
    { value: 'warehouse_transfer', label: 'Warehouse transfer' },
    { value: 'stock_reconciliation', label: 'Stock reconciliation' },
    { value: 'manual_entry', label: 'Manual entry' },
    { value: 'system_generated', label: 'Other system' },
] as const;

const inventoryWorkspaceTabs = ['overview', 'requisitions', 'shortage-queue', 'transfers', 'inventory', 'ledger', 'department-stock', 'procurement', 'msd-orders', 'lead-times', 'claims', 'analytics'] as const;
type InventoryWorkspaceTab = (typeof inventoryWorkspaceTabs)[number];
type InventoryWorkspaceArea = 'stock-control' | 'procurement' | 'requests-fulfilment' | 'review';

const inventoryWorkspaceAreas: Array<{
    id: InventoryWorkspaceArea;
    label: string;
    description: string;
    icon: string;
    activeClass: string;
    tabs: InventoryWorkspaceTab[];
}> = [
    {
        id: 'stock-control',
        label: 'Stock Control',
        description: 'Items, ledger and department stock',
        icon: 'package',
        activeClass: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
        tabs: ['inventory', 'ledger', 'department-stock'],
    },
    {
        id: 'procurement',
        label: 'Procurement',
        description: 'Purchase requests, MSD and lead times',
        icon: 'clipboard-list',
        activeClass: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
        tabs: ['procurement', 'msd-orders', 'lead-times'],
    },
    {
        id: 'requests-fulfilment',
        label: 'Requests & Fulfilment',
        description: 'Priorities, requests and shortages',
        icon: 'activity',
        activeClass: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100',
        tabs: ['overview', 'requisitions', 'shortage-queue', 'transfers'],
    },
    {
        id: 'review',
        label: 'Review',
        description: 'Claims and analytics',
        icon: 'shield-check',
        activeClass: 'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100',
        tabs: ['claims', 'analytics'],
    },
];

function normalizeInventoryWorkspaceTab(value: string): InventoryWorkspaceTab {
    return normalizeInventoryWorkspaceSection(value) as InventoryWorkspaceTab;
}

const activeTab = ref<InventoryWorkspaceTab>('inventory');
const loading = ref(true);
const queueError = ref<string | null>(null);
const referenceStructureLoaded = ref(false);

const canRead = ref(false);
const canManageItems = ref(false);
const canCreateMovement = ref(false);
const canSetOpeningStock = ref(false);
const canReconcileStock = ref(false);
const canCreateRequest = ref(false);
const canUpdateRequestStatus = ref(false);
const canViewAudit = ref(false);
const canApproveRequisitions = ref(false);
const canManageSuppliers = ref(false);
const canManageWarehouses = ref(false);
const { permissionNames: sharedPermissionNames, isFacilitySuperAdmin, hasPermission } = usePlatformAccess();
const canReadDepartments = computed(() => isFacilitySuperAdmin.value || hasPermission('departments.read'));

const inventoryAccess = computed<InventoryProcurementAccess>(() => ({
    canRead: canRead.value,
    canManageItems: canManageItems.value,
        canCreateMovement: canCreateMovement.value,
        canSetOpeningStock: canSetOpeningStock.value,
        canReconcileStock: canReconcileStock.value,
    canCreateRequest: canCreateRequest.value,
    canUpdateRequestStatus: canUpdateRequestStatus.value,
    canViewAudit: canViewAudit.value,
    canApproveRequisitions: canApproveRequisitions.value,
    canManageSuppliers: canManageSuppliers.value,
    canManageWarehouses: canManageWarehouses.value,
}));

const isDepartmentRequester = computed(() => isInventoryDepartmentRequester(inventoryAccess.value));
const isStoreOperations = computed(() => isInventoryStoreOperations(inventoryAccess.value));

function workspaceTabVisible(tab: InventoryWorkspaceTab): boolean {
    return canAccessInventoryWorkspaceSection(
        inventoryAccess.value,
        normalizeInventoryWorkspaceSection(tab),
    );
}

function workspaceAreaVisible(area: (typeof inventoryWorkspaceAreas)[number]): boolean {
    return area.tabs.some((tab) => workspaceTabVisible(tab));
}

function firstVisibleWorkspaceAreaTab(area: (typeof inventoryWorkspaceAreas)[number]): InventoryWorkspaceTab | null {
    return area.tabs.find((tab) => workspaceTabVisible(tab)) ?? null;
}

const visibleWorkspaceAreas = computed(() => inventoryWorkspaceAreas.filter((area) => workspaceAreaVisible(area)));

const activeWorkspaceArea = computed(() => {
    return visibleWorkspaceAreas.value.find((area) => area.tabs.includes(activeTab.value))
        ?? visibleWorkspaceAreas.value[0]
        ?? inventoryWorkspaceAreas[0];
});

const activeWorkspaceAreaTabs = computed(() => activeWorkspaceArea.value.tabs.filter((tab) => workspaceTabVisible(tab)));

function switchWorkspaceArea(areaId: InventoryWorkspaceArea): void {
    const area = inventoryWorkspaceAreas.find((candidate) => candidate.id === areaId);
    if (!area) return;

    const nextTab = firstVisibleWorkspaceAreaTab(area);
    if (nextTab) {
        onTabChange(nextTab);
    }
}

function syncActiveTabWithAccess(): void {
    if (!workspaceTabVisible(activeTab.value)) {
        const next = defaultInventoryWorkspaceSection(inventoryAccess.value) as InventoryWorkspaceTab;
        activeTab.value = next;
        syncWorkspaceUrl(next);
    }
}

const items = ref<any[]>([]);
const itemPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const itemCounts = ref({ outOfStock: 0, lowStock: 0, healthy: 0, total: 0 });
const itemSearch = reactive({
    q: '',
    category: '',
    stockState: '',
    sortBy: 'itemName',
    sortDir: 'asc',
    page: 1,
    perPage: 20,
});

function itemQuery() {
    return {
        q: itemSearch.q.trim() || null,
        category: itemSearch.category.trim() || null,
        stockState: itemSearch.stockState || null,
        sortBy: itemSearch.sortBy || null,
        sortDir: itemSearch.sortDir || null,
        requestingDepartmentId: inventoryItemRequestingDepartmentId.value || null,
        page: itemSearch.page,
        perPage: itemSearch.perPage,
    };
}

const procurementRequests = ref<any[]>([]);
const procurementPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const procurementSearch = reactive({
    q: '',
    status: '',
    sortBy: 'createdAt',
    sortDir: 'desc',
    page: 1,
    perPage: 20,
});

const stockMovements = ref<any[]>([]);
const stockMovementPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const stockLedgerLoading = ref(false);
const stockLedgerFiltersOpen = ref(false);
const stockLedgerSummary = ref({
    total: 0,
    receive: 0,
    issue: 0,
    adjust: 0,
    transfer: 0,
    reconciliationAdjustments: 0,
    reconciliationIncreases: 0,
    reconciliationDecreases: 0,
    distinctItems: 0,
    netQuantityDelta: 0,
});
const stockLedgerFilters = reactive({
    q: '',
    itemId: '',
    movementType: '',
    sourceKey: '',
    actorType: '',
    actorId: '',
    from: '',
    to: '',
    page: 1,
    perPage: 20,
});
const departmentStock = ref<any[]>([]);
const departmentStockPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const departmentStockLoading = ref(false);
const departmentStockFiltersOpen = ref(false);
const departmentStockSummary = ref({
    totalRows: 0,
    departments: 0,
    items: 0,
    totalIssuedQuantity: 0,
    lastIssuedAt: null as string | null,
});
const departmentStockScopedItem = ref<{ id: string; name: string; code?: string | null } | null>(null);
const departmentStockFilters = reactive({
    q: '',
    departmentId: '',
    itemId: '',
    page: 1,
    perPage: 20,
});

const compactProcurementRows = useLocalStorageBoolean('inventory.procurement.procurement.compact', false);
const inventoryAutoRefreshInterval = useLocalStorageString<InventoryAutoRefreshKey>(
    'inventory.procurement.items.auto-refresh',
    'off',
    ['off', '30s', '1m', '5m'],
);
const inventoryItemSetupBlockedReason = computed(() => {
    if (!referenceStructureLoaded.value) {
        return null;
    }

    if (!warehouseReady.value && !supplierReady.value) {
        return 'Create at least one warehouse and one supplier first so inventory items can attach to a real stock structure.';
    }

    if (!warehouseReady.value) {
        return 'Create a warehouse first so inventory items can belong to a real stock location.';
    }

    if (!supplierReady.value) {
        return 'Create a supplier first so inventory items can carry a real procurement source.';
    }

    return null;
});
const stockExecutionBlockedReason = computed(() => {
    if (!warehouseReady.value) {
        return 'Create a warehouse first before recording stock movement or stock reconciliation.';
    }

    if (itemCounts.value.total <= 0) {
        return 'Create the first inventory item before recording stock movement or stock reconciliation.';
    }

    return null;
});
const procurementSetupBlockedReason = computed(() => {
    if (loading.value) {
        return 'Loading inventory data...';
    }

    if (!referenceStructureLoaded.value) {
        return 'Loading reference data...';
    }

    if (inventoryItemSetupBlockedReason.value) {
        return inventoryItemSetupBlockedReason.value;
    }

    if (itemCounts.value.total <= 0) {
        return 'Create the first inventory item before opening procurement requests.';
    }

    return null;
});
const canLaunchCreateItem = computed(() => canManageItems.value && !inventoryItemSetupBlockedReason.value);
const canLaunchStockMovement = computed(() => canCreateMovement.value && !stockExecutionBlockedReason.value);
const canLaunchOpeningStock = computed(() => canSetOpeningStock.value && canCreateMovement.value && !stockExecutionBlockedReason.value);
const canLaunchReconciliation = computed(() => canReconcileStock.value && !stockExecutionBlockedReason.value);
const canLaunchProcurementRequest = computed(() => canCreateRequest.value && !procurementSetupBlockedReason.value);

const canSyncFromCatalog = computed(() =>
    canManageItems.value
    && (requisitionContext.value?.canSelectAnyDepartment || isFacilitySuperAdmin.value || requisitionContext.value?.departmentProfile === 'pharmacy'),
);

interface HeaderAction {
    key: string;
    label: string;
    icon: string;
    variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
    show: boolean;
    disabled?: boolean;
    loading?: boolean;
    iconOnly?: boolean;
    onClick?: () => void;
    class?: string;
    isDropdown?: boolean;
    dropdownOptions?: Array<{ value: string; label: string }>;
    dropdownValue?: string;
    onDropdownChange?: (value: string) => void;
    isMenuDropdown?: boolean;
    menuItems?: Array<{ key: string; label: string; icon: string; onClick: () => void; disabled?: boolean }>;
}

const headerActions = computed<HeaderAction[]>(() => {
    const actions: HeaderAction[] = [];

    if (activeTab.value === 'inventory') {
        actions.push({
            key: 'refresh',
            label: '',
            icon: 'refresh-cw',
            variant: 'ghost',
            show: true,
            iconOnly: true,
            loading: loading.value,
            onClick: () => refreshInventoryItems(),
        });
        actions.push({
            key: 'auto-refresh',
            label: 'Auto',
            icon: 'clock',
            variant: 'outline',
            show: true,
            isDropdown: true,
            dropdownValue: inventoryAutoRefreshInterval.value,
            dropdownOptions: [
                { value: 'off', label: INVENTORY_AUTO_REFRESH_LABEL.off },
                { value: '30s', label: INVENTORY_AUTO_REFRESH_LABEL['30s'] },
                { value: '1m', label: INVENTORY_AUTO_REFRESH_LABEL['1m'] },
                { value: '5m', label: INVENTORY_AUTO_REFRESH_LABEL['5m'] },
            ],
            onDropdownChange: (value) => {
                inventoryAutoRefreshInterval.value = value;
            },
        });
        actions.push({
            key: 'create-item',
            label: 'New Item',
            icon: 'plus',
            variant: 'default',
            show: canManageItems.value,
            disabled: !canLaunchCreateItem.value,
            onClick: () => openCreateItemDialog(),
        });
        actions.push({
            key: 'sync-catalog',
            label: 'Sync from Catalog',
            icon: 'book-open',
            variant: 'outline',
            show: canSyncFromCatalog.value,
            disabled: !canLaunchCreateItem.value,
            onClick: () => openCatalogSyncDialog(),
        });
    }

    if (activeTab.value === 'ledger') {
        actions.push({
            key: 'stock-adjustment',
            label: 'Stock Adjustment',
            icon: 'sliders-horizontal',
            variant: 'default',
            show: canCreateMovement.value,
            disabled: !canLaunchStockMovement.value,
            onClick: () => openStockMovementDialog(null, 'adjust'),
        });
        actions.push({
            key: 'stock-transfer',
            label: 'Stock Transfer',
            icon: 'arrow-right',
            variant: 'outline',
            show: canCreateMovement.value,
            disabled: !canLaunchStockMovement.value,
            onClick: () => openStockMovementDialog(null, 'transfer'),
        });
    }

    if (activeTab.value === 'department-stock') {
        actions.push({
            key: 'issue-stock',
            label: 'Issue Stock',
            icon: 'package',
            variant: 'default',
            show: canCreateMovement.value,
            disabled: !canLaunchStockMovement.value,
            onClick: () => openStockMovementDialog(null, 'issue'),
        });
        actions.push({
            key: 'receive-stock',
            label: 'Receive Stock',
            icon: 'arrow-right',
            variant: 'outline',
            show: canCreateMovement.value,
            disabled: !canLaunchStockMovement.value,
            onClick: () => openStockMovementDialog(null, 'receive'),
        });
        actions.push({
            key: 'transfer-stock',
            label: 'Transfer Stock',
            icon: 'arrow-up-down',
            variant: 'outline',
            show: canCreateMovement.value,
            disabled: !canLaunchStockMovement.value,
            onClick: () => openStockMovementDialog(null, 'transfer'),
        });
    }

    return actions.filter(action => action.show);
});

const mobileProcurementDrawerOpen = ref(false);
const mobileLedgerDrawerOpen = ref(false);

const catalogSyncDialogOpen = ref(false);
const importItemsCsvDialogOpen = ref(false);
const importItemsCsvSubmitting = ref(false);
const importItemsCsvFile = ref<File | null>(null);
const importItemsCsvInputKey = ref(0);
const importItemsCsvResult = ref<{ successful: number; failed: number; errors?: string } | null>(null);

function openCatalogSyncDialog() {
    catalogSyncDialogOpen.value = true;
}

function openImportItemsCsvDialog() {
    if (inventoryItemSetupBlockedReason.value) {
        notifyError(inventoryItemSetupBlockedReason.value);
        return;
    }
    importItemsCsvDialogOpen.value = true;
    importItemsCsvResult.value = null;
    importItemsCsvFile.value = null;
    importItemsCsvInputKey.value += 1;
}

function closeImportItemsCsvDialog() {
    importItemsCsvDialogOpen.value = false;
    importItemsCsvResult.value = null;
    importItemsCsvFile.value = null;
    importItemsCsvSubmitting.value = false;
}

async function submitImportItemsCsv() {
    if (!importItemsCsvFile.value || importItemsCsvSubmitting.value) return;
    importItemsCsvSubmitting.value = true;
    importItemsCsvResult.value = null;
    try {
        const formData = new FormData();
        formData.append('file', importItemsCsvFile.value);
        const response = await fetch('/api/v1/inventory-procurement/items/import', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                ...(typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).csrfToken
                    ? { 'X-CSRF-TOKEN': String((window as unknown as Record<string, unknown>).csrfToken) }
                    : {}),
            },
            body: formData,
        });
        const payload = await response.json() as { successful?: any[]; failed?: any[]; message?: string };
        const successfulCount = payload.successful?.length ?? 0;
        const failedCount = payload.failed?.length ?? 0;
        if (successfulCount > 0) {
            notifySuccess(`${successfulCount} item${successfulCount === 1 ? '' : 's'} imported successfully.`);
        }
        if (failedCount > 0) {
            notifyError(`${failedCount} row${failedCount === 1 ? '' : 's'} failed validation.`);
            importItemsCsvResult.value = {
                successful: successfulCount,
                failed: failedCount,
                errors: payload.failed?.slice(0, 3).map((f: any) => `Row ${f.row}: ${Object.values(f.errors ?? {}).flat().join(', ')}`).join('\n') || undefined,
            };
        } else {
            importItemsCsvResult.value = { successful: successfulCount, failed: 0 };
            importItemsCsvDialogOpen.value = false;
            importItemsCsvFile.value = null;
            await reloadAll();
        }
    } catch (error: any) {
        notifyError(messageFromUnknown(error, 'Unable to import CSV.'));
    } finally {
        importItemsCsvSubmitting.value = false;
    }
}

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
const stockMovementCorrectionForm = reactive({
    quantity: '',
    reason: '',
    reasonCode: 'audit_correction',
});
function resetStockMovementCorrectionForm(item: StockMovementLookupItem | null = null): void {
    stockMovementCorrectionItem.value = item;
    stockMovementCorrectionMovement.value = null;
    stockMovementCorrectionForm.quantity = '';
    stockMovementCorrectionForm.reason = '';
    stockMovementCorrectionForm.reasonCode = 'audit_correction';
}
const reconcileDialogOpen = ref(false);
const createProcurementDialogOpen = ref(false);
const createItemDiscardConfirmOpen = ref(false);
const procurementDiscardConfirmOpen = ref(false);
const itemDetailsDiscardConfirmOpen = ref(false);
const createItemRequestKey = ref(generateRequestKey('inventory-item-create'));
const procurementRequestKey = ref(generateRequestKey('inventory-procurement-request-create'));
const itemUpdateRequestKey = ref(generateRequestKey('inventory-item-update'));
const itemStatusRequestKey = ref(generateRequestKey('inventory-item-status'));

const stockMovementSubmitting = ref(false);
const stockMovementErrors = ref<Record<string, string[]>>({});
const stockMovementSelectedItem = ref<StockMovementLookupItem | null>(null);
const stockMovementForm = reactive({
    itemId: '',
    category: '',
    subcategory: '',
    movementType: 'receive',
    adjustmentDirection: 'increase',
    batchId: '',
    batchNumber: '',
    lotNumber: '',
    manufactureDate: '',
    expiryDate: '',
    binLocation: '',
    sourceSupplierId: '',
    sourceWarehouseId: '',
    destinationWarehouseId: '',
    destinationDepartmentId: '',
    quantity: '',
    reason: '',
    reasonCode: '',
    notes: '',
    occurredAt: '',
});

const stockReconciliationSubmitting = ref(false);
const stockReconciliationErrors = ref<Record<string, string[]>>({});
const stockReconciliationSelectedItem = ref<StockMovementLookupItem | null>(null);
const stockReconciliationForm = reactive({
    itemId: '',
    batchId: '',
    countedStock: '',
    countedBatchQuantity: '',
    sessionReference: '',
    reason: '',
    notes: '',
    occurredAt: '',
});
const stockMovementBatchOptions = ref<any[]>([]);
const stockMovementBatchesLoading = ref(false);
const stockReconciliationBatchOptions = ref<any[]>([]);
const stockReconciliationBatchesLoading = ref(false);
const transferBatchOptionsByItemId = ref<Record<string, any[]>>({});
const transferBatchLoadingByItemId = ref<Record<string, boolean>>({});

const procurementSubmitting = ref(false);
const procurementErrors = ref<Record<string, string[]>>({});
const procurementRequestError = ref<string | null>(null);
const procurementForm = reactive({
    itemId: '',
    itemName: '',
    category: '',
    unit: '',
    reorderLevel: '',
    requestedQuantity: '',
    unitCostEstimate: '',
    neededBy: '',
    supplierId: '',
    sourceDepartmentRequisitionId: '',
    sourceDepartmentRequisitionLineId: '',
    sourceSummary: '',
    notes: '',
});
const selectedProcurementItem = ref<StockMovementLookupItem | null>(null);
const procurementUsesExistingItem = computed(() => procurementForm.itemId.trim().length > 0);
const procurementLockedToSource = computed(() => procurementForm.sourceDepartmentRequisitionLineId.trim().length > 0);
const procurementSubmitDisabled = computed(() => (
    procurementSubmitting.value
    || !procurementForm.itemId.trim()
    || procurementForm.requestedQuantity.trim() === ''
    || Number(procurementForm.requestedQuantity) <= 0
));
const ACTIVE_SOURCE_PROCUREMENT_STATUSES = ['pending_approval', 'approved', 'ordered'];

const activeRequests = ref<Record<string, any>[]>([]);
const activeRequestsForItem = computed(() => {
    if (!procurementForm.itemId.trim()) {
        return [];
    }
    return activeRequests.value.filter((req) => req.itemId === procurementForm.itemId);
});

type LookupOption = {
    id: string;
    name: string;
    code: string | null;
};

type DepartmentRequisitionContext = {
    canSelectAnyDepartment: boolean;
    lockedDepartment: LookupOption | null;
    staffDepartmentName: string | null;
    preferredWarehouseId: string | null;
    hasExplicitItemCatalog: boolean;
    departmentProfile: string | null;
};

const suppliers = ref<LookupOption[]>([]);
const warehouses = ref<LookupOption[]>([]);
const departments = ref<LookupOption[]>([]);
const requisitionContext = ref<DepartmentRequisitionContext | null>(null);
const supplierReady = computed(() => suppliers.value.length > 0);
const warehouseReady = computed(() => warehouses.value.length > 0);

type RequisitionInventorySelection = {
    id: string;
    unit?: string | null;
} | null;

const flashedItemId = ref<string | null>(null);
const flashedRequestId = ref<string | null>(null);

let flashedItemTimer: ReturnType<typeof setTimeout> | null = null;
let flashedRequestTimer: ReturnType<typeof setTimeout> | null = null;
let pollingTimer: ReturnType<typeof setInterval> | null = null;
let inventorySearchTimer: ReturnType<typeof setTimeout> | null = null;
let stockMovementSelectionResetLocked = false;

function openCreateItemDialog() {
    if (inventoryItemSetupBlockedReason.value) {
        notifyError(inventoryItemSetupBlockedReason.value);
        return;
    }

    itemCreateErrors.value = {};
    itemCreateRequestError.value = null;
    if (!hasCreateItemDraftContent.value) {
        resetItemForm(itemCreateForm);
        rotateCreateItemRequestKey();
    }
    createItemDialogOpen.value = true;
}

function closeCreateItemDialog(): void {
    createItemDialogOpen.value = false;
    createItemDiscardConfirmOpen.value = false;
    itemCreateErrors.value = {};
    itemCreateRequestError.value = null;
    clearPersistedCreateItemDraft();
    resetItemForm(itemCreateForm);
    rotateCreateItemRequestKey();
}

function requestCreateItemOpenChange(open: boolean): void {
    if (open) {
        createItemDialogOpen.value = true;
        return;
    }

    if (itemCreateSubmitting.value) return;

    if (hasPendingCreateItemWorkflow.value) {
        createItemDiscardConfirmOpen.value = true;
        return;
    }

    closeCreateItemDialog();
}

function confirmCreateItemDiscard(): void {
    closeCreateItemDialog();
}

function discardCreateItemDraft(): void {
    clearPersistedCreateItemDraft();
    itemCreateErrors.value = {};
    itemCreateRequestError.value = null;
    resetItemForm(itemCreateForm);
    rotateCreateItemRequestKey();
    notifySuccess('Inventory item draft cleared.');
}

function currentDateTimeLocal(): string {
    const date = new Date();
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60_000)).toISOString().slice(0, 16);
}

function resetStockMovementForm(item: StockMovementLookupItem | null = null): void {
    stockMovementSelectedItem.value = item;
    stockMovementBatchOptions.value = [];
    stockMovementSelectionResetLocked = true;
    Object.assign(stockMovementForm, {
        itemId: item?.id ?? '',
        category: item?.category ?? '',
        subcategory: item?.subcategory ?? '',
        movementType: 'receive',
        adjustmentDirection: 'increase',
        batchId: '',
        batchNumber: '',
        lotNumber: '',
        manufactureDate: '',
        expiryDate: '',
        binLocation: '',
        sourceSupplierId: '',
        sourceWarehouseId: '',
        destinationWarehouseId: '',
        destinationDepartmentId: '',
        quantity: '',
        reason: '',
        notes: '',
        occurredAt: currentDateTimeLocal(),
    });
}

async function openStockMovementCorrection(item: StockMovementLookupItem) {
    if (stockExecutionBlockedReason.value) {
        notifyError(stockExecutionBlockedReason.value);
        return;
    }

    if (!canSetOpeningStock.value) {
        notifyError('You do not have permission to correct opening stock.');
        return;
    }

    stockMovementCorrectionErrors.value = {};
    resetStockMovementCorrectionForm(item);

    try {
        const response = await apiRequest<{ data: any[] }>('GET', '/inventory-procurement/stock-movements', {
            query: {
                itemId: item.id,
                isOpeningStock: 'true',
                perPage: 1,
                sortBy: 'occurredAt',
                sortDir: 'desc',
            },
        });
        const movements = response.data ?? [];
        if (movements.length === 0) {
            notifyError('No opening stock movement found for this item.');
            return;
        }
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

function openStockMovementDialog(item: StockMovementLookupItem | null = null, movementType?: 'receive' | 'issue' | 'adjust' | 'transfer') {
    if (stockExecutionBlockedReason.value) {
        notifyError(stockExecutionBlockedReason.value);
        return;
    }

    if (item && inventoryItemNeedsOpeningStock(item) && !canSetOpeningStock.value) {
        notifyError('You do not have permission to set opening stock. Contact a supervisor or manager.');
        return;
    }

    if (item && !inventoryItemNeedsOpeningStock(item) && !canCreateMovement.value) {
        notifyError('You do not have permission to record stock movements.');
        return;
    }

    stockMovementErrors.value = {};
    resetStockMovementForm(item);
    if (movementType) {
        stockMovementForm.movementType = movementType;
    }
    stockMovementDialogOpen.value = true;
}

function handleStockMovementItemSelected(item: StockMovementLookupItem | null): void {
    stockMovementSelectedItem.value = item;
    if (inventoryItemNeedsOpeningStock(item)) {
        stockMovementForm.movementType = 'receive';
        stockMovementForm.reasonCode = 'opening_balance';
        stockMovementForm.sourceSupplierId = '';
        stockMovementForm.sourceWarehouseId = '';
        stockMovementForm.destinationDepartmentId = '';
    }
}

function resetStockReconciliationForm(item: StockMovementLookupItem | null = null): void {
    stockReconciliationSelectedItem.value = item;
    stockReconciliationBatchOptions.value = [];
    Object.assign(stockReconciliationForm, {
        itemId: item?.id ?? '',
        batchId: '',
        countedStock: '',
        countedBatchQuantity: '',
        sessionReference: '',
        reason: '',
        notes: '',
        occurredAt: currentDateTimeLocal(),
    });
    nextTick(() => {
        stockMovementSelectionResetLocked = false;
    });
}

function handleStockReconciliationItemSelected(item: StockMovementLookupItem | null): void {
    stockReconciliationSelectedItem.value = item;
}

function openReconcileDialog() {
    if (stockExecutionBlockedReason.value) {
        notifyError(stockExecutionBlockedReason.value);
        return;
    }

    stockReconciliationErrors.value = {};
    resetStockReconciliationForm();
    reconcileDialogOpen.value = true;
}

function openCreateProcurementDialog() {
    if (procurementSetupBlockedReason.value) {
        notifyError(procurementSetupBlockedReason.value);
        return;
    }

    procurementErrors.value = {};
    procurementRequestError.value = null;
    resetProcurementForm();
    rotateProcurementRequestKey();
    void loadActiveProcurementRequests();
    createProcurementDialogOpen.value = true;
}

function handleProcurementItemSelected(item: StockMovementLookupItem | null): void {
    selectedProcurementItem.value = item;

    if (!item) {
        procurementForm.itemName = '';
        procurementForm.category = '';
        procurementForm.unit = '';
        procurementForm.reorderLevel = '';
        if (!procurementLockedToSource.value) {
            procurementForm.supplierId = '';
        }
        return;
    }

    procurementForm.itemName = String(item.itemName ?? '');
    procurementForm.category = String(item.category ?? '');
    procurementForm.unit = String(item.unit ?? '');
    procurementForm.reorderLevel = item.reorderLevel != null ? String(item.reorderLevel) : '';

    const masterItem = items.value.find((entry) => entry.id === item.id) ?? null;
    if (masterItem?.defaultSupplierId) {
        procurementForm.supplierId = masterItem.defaultSupplierId;
    }
}

function closeCreateProcurementDialog(): void {
    createProcurementDialogOpen.value = false;
    procurementDiscardConfirmOpen.value = false;
    procurementErrors.value = {};
    procurementRequestError.value = null;
    resetProcurementForm();
    rotateProcurementRequestKey();
}

function handleProcurementDialogOpenChange(open: boolean): void {
    if (open) {
        createProcurementDialogOpen.value = true;
        return;
    }

    if (procurementSubmitting.value) {
        return;
    }

    closeCreateProcurementDialog();
}

function requestCreateProcurementOpenChange(open: boolean): void {
    handleProcurementDialogOpenChange(open);
}

function confirmProcurementDiscard(): void {
    closeCreateProcurementDialog();
}

function syncWorkspaceUrl(tab: InventoryWorkspaceTab): void {
    if (typeof window === 'undefined') {
        return;
    }

    const nextUrl = inventoryWorkspaceHref({ section: tab });
    window.history.replaceState(window.history.state, '', nextUrl);
}

function onTabChange(value: string) {
    const nextTab = normalizeInventoryWorkspaceTab(value);

    if (!workspaceTabVisible(nextTab)) {
        syncActiveTabWithAccess();
        void loadActiveWorkspaceTab(activeTab.value);
        return;
    }

    activeTab.value = nextTab;
    syncWorkspaceUrl(nextTab);
    void loadActiveWorkspaceTab(nextTab);
}

function switchToStockLedger() {
    onTabChange('ledger');
}

const DEFAULT_ITEM_CATEGORIES: InventoryCategoryOption[] = [
    {
        value: 'pharmaceutical',
        label: 'Pharmaceutical',
        template: 'pharmaceutical',
        description: 'Medicine stock master with dispensing, clinical classification, and reimbursement mapping fields.',
        requiresExpiryTracking: true,
        requiresColdChain: false,
        controlledSubstanceEligible: true,
        supportsMedicineDetails: true,
        supportsStorageFields: true,
        supportsClinicalClassification: true,
    },
    {
        value: 'medical_consumable',
        label: 'Medical Consumable',
        template: 'general_supply',
        description: 'General stock item with supplier, warehouse, barcode, and stock-threshold defaults.',
        requiresExpiryTracking: false,
        requiresColdChain: false,
        controlledSubstanceEligible: false,
        supportsMedicineDetails: false,
        supportsStorageFields: false,
        supportsClinicalClassification: true,
    },
    {
        value: 'laboratory',
        label: 'Laboratory Reagent & Supply',
        template: 'expiry_sensitive',
        description: 'Expiry-sensitive reagent and laboratory supply inventory with storage-handling requirements.',
        requiresExpiryTracking: true,
        requiresColdChain: false,
        controlledSubstanceEligible: false,
        supportsMedicineDetails: false,
        supportsStorageFields: true,
        supportsClinicalClassification: true,
    },
    {
        value: 'surgical_instrument',
        label: 'Surgical Instrument',
        template: 'specialist_equipment',
        description: 'Specialist stock master for procurement and replenishment defaults. Keep serial, calibration, and maintenance details in the equipment workflow.',
        requiresExpiryTracking: false,
        requiresColdChain: false,
        controlledSubstanceEligible: false,
        supportsMedicineDetails: false,
        supportsStorageFields: false,
        supportsClinicalClassification: false,
    },
    {
        value: 'medical_equipment',
        label: 'Medical Equipment',
        template: 'specialist_equipment',
        description: 'Specialist stock master for procurement and replenishment defaults. Keep serial, calibration, and maintenance details in the equipment workflow.',
        requiresExpiryTracking: false,
        requiresColdChain: false,
        controlledSubstanceEligible: false,
        supportsMedicineDetails: false,
        supportsStorageFields: false,
        supportsClinicalClassification: false,
    },
    {
        value: 'linen_textile',
        label: 'Linen & Textile',
        template: 'general_supply',
        description: 'General stock item with supplier, warehouse, barcode, and stock-threshold defaults.',
        requiresExpiryTracking: false,
        requiresColdChain: false,
        controlledSubstanceEligible: false,
        supportsMedicineDetails: false,
        supportsStorageFields: false,
        supportsClinicalClassification: false,
    },
    {
        value: 'food_nutrition',
        label: 'Food & Nutrition',
        template: 'expiry_sensitive',
        description: 'Expiry-sensitive nutrition inventory with storage defaults and replenishment controls.',
        requiresExpiryTracking: true,
        requiresColdChain: false,
        controlledSubstanceEligible: false,
        supportsMedicineDetails: false,
        supportsStorageFields: true,
        supportsClinicalClassification: false,
    },
    {
        value: 'office_admin',
        label: 'Office & Admin Supply',
        template: 'general_supply',
        description: 'General stock item with supplier, warehouse, barcode, and stock-threshold defaults.',
        requiresExpiryTracking: false,
        requiresColdChain: false,
        controlledSubstanceEligible: false,
        supportsMedicineDetails: false,
        supportsStorageFields: false,
        supportsClinicalClassification: false,
    },
    {
        value: 'cleaning_sanitation',
        label: 'Cleaning & Sanitation',
        template: 'general_supply',
        description: 'General stock item with supplier, warehouse, barcode, and stock-threshold defaults.',
        requiresExpiryTracking: false,
        requiresColdChain: false,
        controlledSubstanceEligible: false,
        supportsMedicineDetails: false,
        supportsStorageFields: false,
        supportsClinicalClassification: false,
    },
    {
        value: 'blood_product',
        label: 'Blood Product',
        template: 'expiry_sensitive',
        description: 'Expiry-sensitive and cold-chain inventory. Capture handling defaults here and batch details on first receipt.',
        requiresExpiryTracking: true,
        requiresColdChain: true,
        controlledSubstanceEligible: false,
        supportsMedicineDetails: false,
        supportsStorageFields: true,
        supportsClinicalClassification: true,
    },
    {
        value: 'ppe',
        label: 'Personal Protective Equipment',
        template: 'general_supply',
        description: 'General stock item with supplier, warehouse, barcode, and stock-threshold defaults.',
        requiresExpiryTracking: false,
        requiresColdChain: false,
        controlledSubstanceEligible: false,
        supportsMedicineDetails: false,
        supportsStorageFields: false,
        supportsClinicalClassification: false,
    },
    {
        value: 'dental',
        label: 'Dental',
        template: 'specialist_equipment',
        description: 'Specialist stock master for procurement and replenishment defaults. Keep serial, calibration, and maintenance details in the equipment workflow.',
        requiresExpiryTracking: false,
        requiresColdChain: false,
        controlledSubstanceEligible: false,
        supportsMedicineDetails: false,
        supportsStorageFields: false,
        supportsClinicalClassification: true,
    },
    {
        value: 'radiology',
        label: 'Radiology',
        template: 'specialist_equipment',
        description: 'Specialist stock master for procurement and replenishment defaults. Keep serial, calibration, and maintenance details in the equipment workflow.',
        requiresExpiryTracking: false,
        requiresColdChain: false,
        controlledSubstanceEligible: false,
        supportsMedicineDetails: false,
        supportsStorageFields: false,
        supportsClinicalClassification: true,
    },
    {
        value: 'other',
        label: 'Other',
        template: 'general_supply',
        description: 'General stock item with supplier, warehouse, barcode, and stock-threshold defaults.',
        requiresExpiryTracking: false,
        requiresColdChain: false,
        controlledSubstanceEligible: false,
        supportsMedicineDetails: false,
        supportsStorageFields: false,
        supportsClinicalClassification: false,
    },
];

const VEN_CLASSIFICATIONS = [
    { value: 'vital', label: 'Vital' },
    { value: 'essential', label: 'Essential' },
    { value: 'non_essential', label: 'Non-Essential' },
] as const;

const ABC_CLASSIFICATIONS = [
    { value: 'A', label: 'A - High Value' },
    { value: 'B', label: 'B - Medium Value' },
    { value: 'C', label: 'C - Low Value' },
] as const;

const STORAGE_CONDITIONS = [
    { value: 'room_temperature', label: 'Room Temperature' },
    { value: 'cool_dry_place', label: 'Cool & Dry Place' },
    { value: 'refrigerated_2_8c', label: 'Refrigerated (2-8C)' },
    { value: 'frozen_minus_20c', label: 'Frozen (-20C)' },
    { value: 'frozen_minus_70c', label: 'Frozen (-70C)' },
    { value: 'protect_from_light', label: 'Protect from Light' },
] as const;

const DEFAULT_STORAGE_CONDITIONS_BY_CATEGORY: Record<string, string> = {
    pharmaceutical: 'room_temperature',
    laboratory: 'cool_dry_place',
    food_nutrition: 'cool_dry_place',
    blood_product: 'refrigerated_2_8c',
};

type InventoryClinicalCatalogItem = {
    id: string;
    catalogType?: string | null;
    code?: string | null;
    name?: string | null;
    category?: string | null;
    unit?: string | null;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
    codes?: Record<string, unknown> | null;
    status?: string | null;
};

const DOSAGE_FORM_OPTIONS: SearchableSelectOption[] = [
    { value: 'tablet', label: 'Tablet', group: 'Oral solid', keywords: ['tab'] },
    { value: 'capsule', label: 'Capsule', group: 'Oral solid', keywords: ['cap'] },
    { value: 'dispersible tablet', label: 'Dispersible tablet', group: 'Oral solid', keywords: ['dt', 'soluble'] },
    { value: 'chewable tablet', label: 'Chewable tablet', group: 'Oral solid' },
    { value: 'powder', label: 'Powder', group: 'Oral solid', keywords: ['oral powder'] },
    { value: 'sachet', label: 'Sachet', group: 'Oral solid', keywords: ['packet'] },
    { value: 'syrup', label: 'Syrup', group: 'Oral liquid' },
    { value: 'suspension', label: 'Suspension', group: 'Oral liquid' },
    { value: 'oral solution', label: 'Oral solution', group: 'Oral liquid' },
    { value: 'drops', label: 'Drops', group: 'Topical / local', keywords: ['eye drops', 'ear drops'] },
    { value: 'cream', label: 'Cream', group: 'Topical / local' },
    { value: 'ointment', label: 'Ointment', group: 'Topical / local' },
    { value: 'gel', label: 'Gel', group: 'Topical / local' },
    { value: 'inhaler', label: 'Inhaler', group: 'Respiratory' },
    { value: 'nebuliser solution', label: 'Nebuliser solution', group: 'Respiratory', keywords: ['nebulizer'] },
    { value: 'injection', label: 'Injection', group: 'Parenteral' },
    { value: 'vial', label: 'Vial', group: 'Parenteral' },
    { value: 'ampoule', label: 'Ampoule', group: 'Parenteral', keywords: ['ampule'] },
    { value: 'infusion', label: 'Infusion', group: 'Parenteral', keywords: ['iv fluid'] },
    { value: 'suppository', label: 'Suppository', group: 'Rectal / vaginal' },
    { value: 'pessary', label: 'Pessary', group: 'Rectal / vaginal' },
    { value: 'patch', label: 'Patch', group: 'Device / implant' },
    { value: 'implant', label: 'Implant', group: 'Device / implant' },
];

const GENERAL_SUBCATEGORY_OPTIONS: SearchableSelectOption[] = [
    { value: 'general_supplies', label: 'General supplies', group: 'General' },
    { value: 'department_consumables', label: 'Department consumables', group: 'General' },
    { value: 'maintenance_supplies', label: 'Maintenance supplies', group: 'General' },
    { value: 'other', label: 'Other', group: 'General' },
];

const ITEM_SUBCATEGORY_OPTIONS: Record<string, SearchableSelectOption[]> = {
    pharmaceutical: [
        { value: 'analgesics', label: 'Analgesics', group: 'Medicines', keywords: ['pain', 'fever'] },
        { value: 'antibiotics', label: 'Antibiotics', group: 'Medicines', keywords: ['antimicrobial'] },
        { value: 'antimalarials', label: 'Antimalarials', group: 'Medicines', keywords: ['malaria', 'alu'] },
        { value: 'cardiovascular', label: 'Cardiovascular', group: 'Medicines', keywords: ['bp', 'hypertension'] },
        { value: 'endocrine', label: 'Endocrine / diabetes', group: 'Medicines', keywords: ['diabetes', 'insulin'] },
        { value: 'gastrointestinal', label: 'Gastrointestinal', group: 'Medicines', keywords: ['stomach', 'antiemetic'] },
        { value: 'maternal_health', label: 'Maternal health', group: 'Medicines', keywords: ['iron', 'folic', 'antenatal'] },
        { value: 'respiratory', label: 'Respiratory', group: 'Medicines', keywords: ['asthma', 'inhaler'] },
        { value: 'dermatology', label: 'Dermatology', group: 'Medicines', keywords: ['skin', 'topical'] },
        { value: 'iv_fluids', label: 'IV fluids', group: 'Medicines', keywords: ['infusion', 'fluid'] },
        { value: 'vaccines', label: 'Vaccines / immunization', group: 'Medicines', keywords: ['epi', 'immunization'] },
        { value: 'controlled_medicines', label: 'Controlled medicines', group: 'Medicines', keywords: ['narcotic', 'schedule'] },
    ],
    medical_consumable: [
        { value: 'syringes_needles', label: 'Syringes & needles', group: 'Consumables' },
        { value: 'dressings_bandages', label: 'Dressings & bandages', group: 'Consumables', keywords: ['wound care'] },
        { value: 'catheters_tubes', label: 'Catheters & tubes', group: 'Consumables' },
        { value: 'gloves_ppe', label: 'Gloves & PPE', group: 'Consumables' },
        { value: 'sterilization_consumables', label: 'Sterilization consumables', group: 'Consumables' },
        { value: 'patient_care_consumables', label: 'Patient care consumables', group: 'Consumables' },
    ],
    laboratory: [
        { value: 'reagents', label: 'Reagents', group: 'Laboratory' },
        { value: 'rapid_tests', label: 'Rapid tests', group: 'Laboratory', keywords: ['rdt'] },
        { value: 'sample_collection', label: 'Sample collection', group: 'Laboratory', keywords: ['vacutainer', 'container'] },
        { value: 'lab_consumables', label: 'Lab consumables', group: 'Laboratory' },
        { value: 'quality_control', label: 'Quality control', group: 'Laboratory', keywords: ['qc'] },
        { value: 'microbiology', label: 'Microbiology', group: 'Laboratory' },
        { value: 'hematology', label: 'Hematology', group: 'Laboratory', keywords: ['haematology'] },
        { value: 'chemistry', label: 'Chemistry', group: 'Laboratory' },
    ],
    surgical_instrument: [
        { value: 'reusable_instruments', label: 'Reusable instruments', group: 'Theatre' },
        { value: 'sutures', label: 'Sutures', group: 'Theatre' },
        { value: 'anaesthesia_consumables', label: 'Anaesthesia consumables', group: 'Theatre' },
        { value: 'sterile_drapes_gowns', label: 'Sterile drapes & gowns', group: 'Theatre' },
        { value: 'theatre_packs', label: 'Theatre packs', group: 'Theatre' },
    ],
    medical_equipment: [
        { value: 'diagnostic_equipment', label: 'Diagnostic equipment', group: 'Equipment' },
        { value: 'monitoring_equipment', label: 'Monitoring equipment', group: 'Equipment' },
        { value: 'ward_equipment', label: 'Ward equipment', group: 'Equipment' },
        { value: 'maintenance_spares', label: 'Maintenance spares', group: 'Equipment' },
    ],
    linen_textile: [
        { value: 'bed_linen', label: 'Bed linen', group: 'Linen' },
        { value: 'patient_gowns', label: 'Patient gowns', group: 'Linen' },
        { value: 'staff_uniforms', label: 'Staff uniforms', group: 'Linen' },
        { value: 'theatre_linen', label: 'Theatre linen', group: 'Linen' },
    ],
    food_nutrition: [
        { value: 'therapeutic_feeds', label: 'Therapeutic feeds', group: 'Nutrition' },
        { value: 'infant_formula', label: 'Infant formula', group: 'Nutrition' },
        { value: 'supplements', label: 'Supplements', group: 'Nutrition' },
        { value: 'kitchen_supplies', label: 'Kitchen supplies', group: 'Nutrition' },
    ],
    office_admin: [
        { value: 'stationery', label: 'Stationery', group: 'Admin' },
        { value: 'printing_supplies', label: 'Printing supplies', group: 'Admin' },
        { value: 'records_forms', label: 'Records & forms', group: 'Admin' },
        { value: 'it_accessories', label: 'IT accessories', group: 'Admin' },
    ],
    cleaning_sanitation: [
        { value: 'detergents', label: 'Detergents', group: 'Sanitation' },
        { value: 'disinfectants', label: 'Disinfectants', group: 'Sanitation' },
        { value: 'waste_management', label: 'Waste management', group: 'Sanitation' },
        { value: 'cleaning_tools', label: 'Cleaning tools', group: 'Sanitation' },
    ],
    blood_product: [
        { value: 'whole_blood', label: 'Whole blood', group: 'Blood products' },
        { value: 'packed_red_cells', label: 'Packed red cells', group: 'Blood products', keywords: ['prbc'] },
        { value: 'plasma', label: 'Plasma', group: 'Blood products' },
        { value: 'platelets', label: 'Platelets', group: 'Blood products' },
    ],
    ppe: [
        { value: 'gloves', label: 'Gloves', group: 'PPE' },
        { value: 'masks_respirators', label: 'Masks & respirators', group: 'PPE' },
        { value: 'gowns_aprons', label: 'Gowns & aprons', group: 'PPE' },
        { value: 'eye_face_protection', label: 'Eye & face protection', group: 'PPE' },
    ],
    dental: [
        { value: 'dental_consumables', label: 'Dental consumables', group: 'Dental' },
        { value: 'dental_instruments', label: 'Dental instruments', group: 'Dental' },
        { value: 'restorative_materials', label: 'Restorative materials', group: 'Dental' },
        { value: 'oral_surgery', label: 'Oral surgery', group: 'Dental' },
    ],
    radiology: [
        { value: 'contrast_media', label: 'Contrast media', group: 'Radiology' },
        { value: 'xray_consumables', label: 'X-ray consumables', group: 'Radiology' },
        { value: 'ultrasound_consumables', label: 'Ultrasound consumables', group: 'Radiology' },
        { value: 'radiology_accessories', label: 'Radiology accessories', group: 'Radiology' },
        { value: 'protective_equipment', label: 'Protective equipment', group: 'Radiology', keywords: ['lead apron'] },
    ],
    other: GENERAL_SUBCATEGORY_OPTIONS,
};

const CONTROLLED_SUBSTANCE_SCHEDULES = [
    { value: 'schedule_I', label: 'Schedule I' },
    { value: 'schedule_II', label: 'Schedule II' },
    { value: 'schedule_III', label: 'Schedule III' },
    { value: 'schedule_IV', label: 'Schedule IV' },
] as const;

const itemCategoryOptions = ref<InventoryCategoryOption[]>([...DEFAULT_ITEM_CATEGORIES]);
const venClassificationOptions = ref<SelectOption[]>([...VEN_CLASSIFICATIONS]);
const abcClassificationOptions = ref<SelectOption[]>([...ABC_CLASSIFICATIONS]);
const storageConditionOptions = ref<SelectOption[]>([...STORAGE_CONDITIONS]);
const controlledSubstanceScheduleOptions = ref<SelectOption[]>([...CONTROLLED_SUBSTANCE_SCHEDULES]);
const clinicalCatalogItems = ref<InventoryClinicalCatalogItem[]>([]);

const REQUISITION_PRIORITIES = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Routine' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
] as const;

const REQUISITION_STATUSES = ['draft', 'submitted', 'approved', 'partially_issued', 'issued', 'rejected', 'cancelled'] as const;

function createEmptyItemForm(): InventoryItemFormState {
    return {
        clinicalCatalogItemId: '',
        itemCode: '',
        itemName: '',
        genericName: '',
        dosageForm: '',
        strength: '',
        category: '',
        subcategory: '',
        venClassification: '',
        abcClassification: '',
        unit: '',
        dispensingUnit: '',
        conversionFactor: '',
        binLocation: '',
        manufacturer: '',
        storageConditions: '',
        requiresColdChain: false,
        isControlledSubstance: false,
        controlledSubstanceSchedule: '',
        msdCode: '',
        nhifCode: '',
        barcode: '',
        reorderLevel: '',
        maxStockLevel: '',
        defaultWarehouseId: '',
        defaultSupplierId: '',
    };
}

const itemCreateForm = reactive<InventoryItemFormState>(createEmptyItemForm());
const itemCreateSubmitting = ref(false);
const itemCreateErrors = ref<Record<string, string[]>>({});
const itemCreateRequestError = ref<string | null>(null);

function stringDraftValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function normalizeInventoryItemDraft(draft: Partial<InventoryItemFormState> | null | undefined): InventoryItemFormState {
    return {
        clinicalCatalogItemId: stringDraftValue(draft?.clinicalCatalogItemId),
        itemCode: stringDraftValue(draft?.itemCode),
        itemName: stringDraftValue(draft?.itemName),
        genericName: stringDraftValue(draft?.genericName),
        dosageForm: stringDraftValue(draft?.dosageForm),
        strength: stringDraftValue(draft?.strength),
        category: stringDraftValue(draft?.category),
        subcategory: stringDraftValue(draft?.subcategory),
        venClassification: stringDraftValue(draft?.venClassification),
        abcClassification: stringDraftValue(draft?.abcClassification),
        unit: stringDraftValue(draft?.unit),
        dispensingUnit: stringDraftValue(draft?.dispensingUnit),
        conversionFactor: stringDraftValue(draft?.conversionFactor),
        binLocation: stringDraftValue(draft?.binLocation),
        manufacturer: stringDraftValue(draft?.manufacturer),
        storageConditions: stringDraftValue(draft?.storageConditions),
        requiresColdChain: Boolean(draft?.requiresColdChain),
        isControlledSubstance: Boolean(draft?.isControlledSubstance),
        controlledSubstanceSchedule: stringDraftValue(draft?.controlledSubstanceSchedule),
        msdCode: stringDraftValue(draft?.msdCode),
        nhifCode: stringDraftValue(draft?.nhifCode),
        barcode: stringDraftValue(draft?.barcode),
        reorderLevel: stringDraftValue(draft?.reorderLevel),
        maxStockLevel: stringDraftValue(draft?.maxStockLevel),
        defaultWarehouseId: stringDraftValue(draft?.defaultWarehouseId),
        defaultSupplierId: stringDraftValue(draft?.defaultSupplierId),
    };
}

function itemFormHasDraftContent(form: InventoryItemFormState): boolean {
    return Object.entries(form).some(([key, value]) => {
        if (typeof value === 'boolean') {
            return value;
        }

        if (key === 'storageConditions' && !form.category) {
            return false;
        }

        return String(value ?? '').trim().length > 0;
    });
}

function restoreItemCreateDraft(draft: Partial<InventoryItemFormState>): void {
    Object.assign(itemCreateForm, normalizeInventoryItemDraft(draft));
    applyItemCategoryRules(itemCreateForm);
}

const hasCreateItemDraftContent = computed(() => itemFormHasDraftContent(itemCreateForm));

const {
    restoredDraft: restoredCreateItemDraft,
    clearPersistedDraft: clearPersistedCreateItemDraft,
} = useWorkflowDraftPersistence<InventoryItemFormState>({
    key: INVENTORY_ITEM_CREATE_DRAFT_STORAGE_KEY,
    shouldPersist: hasCreateItemDraftContent,
    capture: () => normalizeInventoryItemDraft(itemCreateForm),
    restore: restoreItemCreateDraft,
    canRestore: (draft) => itemFormHasDraftContent(normalizeInventoryItemDraft(draft)),
});

const itemDetailsOpen = ref(false);
const itemDetails = ref<any | null>(null);
const itemDetailsLoading = ref(false);
const itemDetailsError = ref<string | null>(null);
const itemDetailsTab = ref('overview');
const itemUpdateForm = reactive<InventoryItemFormState>(createEmptyItemForm());
const itemUpdateSubmitting = ref(false);
const itemUpdateErrors = ref<Record<string, string[]>>({});
const itemUpdateSnapshot = ref('');
const itemStatusForm = reactive({
    status: 'active',
    reason: '',
});
const itemStatusOptions = ['active', 'inactive'] as const;
const itemStatusSubmitting = ref(false);
const itemStatusError = ref<string | null>(null);
const itemStatusSnapshot = ref('');

const itemAuditLogs = ref<any[]>([]);
const itemAuditLoading = ref(false);
const itemAuditError = ref<string | null>(null);
const itemAuditExporting = ref(false);
const itemAuditMeta = ref<{ currentPage: number; lastPage: number; total: number; perPage: number } | null>(null);
const itemAuditFilters = reactive({
    q: '',
    action: '',
    actorType: '',
    actorId: '',
    from: '',
    to: '',
    page: 1,
    perPage: 20,
});

type InventoryReferenceDataResponse = {
    categories?: Record<string, string>;
    categoryOptions?: InventoryCategoryOption[];
    venClassifications?: SelectOption[];
    abcClassifications?: SelectOption[];
    storageConditions?: string[];
    storageConditionOptions?: SelectOption[];
    controlledSubstanceSchedules?: string[];
    controlledSubstanceScheduleOptions?: SelectOption[];
    clinicalCatalogItems?: InventoryClinicalCatalogItem[];
    formularyCatalogItems?: InventoryClinicalCatalogItem[];
};

function resetItemForm(form: InventoryItemFormState): void {
    Object.assign(form, createEmptyItemForm());
}

function rotateCreateItemRequestKey(): void {
    createItemRequestKey.value = generateRequestKey('inventory-item-create');
}

function rotateProcurementRequestKey(): void {
    procurementRequestKey.value = generateRequestKey('inventory-procurement-request-create');
}

function rotateItemUpdateRequestKey(): void {
    itemUpdateRequestKey.value = generateRequestKey('inventory-item-update');
}

function rotateItemStatusRequestKey(): void {
    itemStatusRequestKey.value = generateRequestKey('inventory-item-status');
}

function procurementFormHasDraftContent(): boolean {
    return Object.values(procurementForm).some((value) => String(value ?? '').trim().length > 0);
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

const hasPendingCreateItemWorkflow = computed(() => hasCreateItemDraftContent.value);
const hasPendingProcurementWorkflow = computed(() => procurementFormHasDraftContent());
const hasPendingItemUpdateWorkflow = computed(() => Boolean(itemDetails.value) && currentItemUpdateSnapshot() !== itemUpdateSnapshot.value);
const hasPendingItemStatusWorkflow = computed(() => Boolean(itemDetails.value) && currentItemStatusSnapshot() !== itemStatusSnapshot.value);
const hasPendingItemDetailsWorkflow = computed(() => hasPendingItemUpdateWorkflow.value || hasPendingItemStatusWorkflow.value);
const isSubmittingInventoryWorkflow = computed(() => (
    itemCreateSubmitting.value
    || procurementSubmitting.value
    || itemUpdateSubmitting.value
    || itemStatusSubmitting.value
));

function selectOptionsFromValues(values: string[]): SelectOption[] {
    return values.map((value) => ({ value, label: formatEnumLabel(value) }));
}

function fallbackCategoryOption(value: string, label: string): InventoryCategoryOption {
    return DEFAULT_ITEM_CATEGORIES.find((option) => option.value === value) ?? {
        value,
        label,
        template: 'general_supply',
        description: 'General stock item with supplier, warehouse, barcode, and stock-threshold defaults.',
        requiresExpiryTracking: false,
        requiresColdChain: false,
        controlledSubstanceEligible: false,
        supportsMedicineDetails: false,
        supportsStorageFields: false,
        supportsClinicalClassification: false,
    };
}

function resolveCategoryOption(categoryValue: string): InventoryCategoryOption | null {
    if (!categoryValue) {
        return null;
    }

    return itemCategoryOptions.value.find((option) => option.value === categoryValue) ?? fallbackCategoryOption(categoryValue, formatEnumLabel(categoryValue));
}

function categoryTemplateLabel(template: InventoryCategoryTemplate): string {
    switch (template) {
        case 'pharmaceutical': return 'Medicine workflow';
        case 'expiry_sensitive': return 'Expiry-sensitive workflow';
        case 'specialist_equipment': return 'Specialist stock workflow';
        default: return 'General stock workflow';
    }
}

function subcategoryOptionsForCategory(categoryValue: string | null | undefined): SearchableSelectOption[] {
    const key = (categoryValue ?? '').trim();
    return ITEM_SUBCATEGORY_OPTIONS[key] ?? GENERAL_SUBCATEGORY_OPTIONS;
}

function stringMetadataValue(metadata: Record<string, unknown> | null | undefined, ...keys: string[]): string {
    for (const key of keys) {
        const value = metadata?.[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return '';
}

function stringCodesValue(codes: Record<string, unknown> | null | undefined, ...keys: string[]): string {
    for (const key of keys) {
        const value = codes?.[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return '';
}

function genericNameFromClinicalName(name: string, strength: string): string {
    const withoutStrength = strength
        ? name.replace(new RegExp(`\\s*${strength.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '').trim()
        : name.trim();

    return withoutStrength.replace(/\s+\d+.*$/u, '').trim() || name.trim();
}

function clinicalCatalogTypeLabel(type: string | null | undefined): string {
    switch (type) {
        case 'formulary_item': return 'Approved medicines';
        case 'lab_test': return 'Lab tests';
        case 'radiology_procedure': return 'Radiology';
        case 'theatre_procedure': return 'Theatre';
        default: return 'Clinical catalog';
    }
}

function clinicalCatalogTypeForCategory(category: InventoryCategoryOption | null): string[] {
    if (!category) return [];

    switch (category.value) {
        case 'pharmaceutical': return ['formulary_item'];
        default: return [];
    }
}

function clinicalCatalogLabel(itemId: string | null | undefined): string {
    const item = clinicalCatalogItems.value.find((entry) => entry.id === itemId);
    if (!item) {
        return itemId ? String(itemId) : 'Not linked';
    }

    const code = typeof item.code === 'string' && item.code.trim() ? item.code.trim() : null;
    const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : item.id;

    return code ? `${name} (${code})` : name;
}

function clinicalCatalogOptionsForCategory(category: InventoryCategoryOption | null): SearchableSelectOption[] {
    const catalogTypes = clinicalCatalogTypeForCategory(category);
    if (catalogTypes.length === 0) {
        return [];
    }

    return clinicalCatalogItems.value
        .filter((item) => catalogTypes.includes(String(item.catalogType ?? '')))
        .map((item) => {
        const metadata = item.metadata ?? {};
        const dosageForm = stringMetadataValue(metadata, 'dosageForm', 'dosage_form');
        const strength = stringMetadataValue(metadata, 'strength');
        const code = typeof item.code === 'string' ? item.code.trim() : '';
        const category = typeof item.category === 'string' ? item.category.trim() : '';
        const unit = typeof item.unit === 'string' ? item.unit.trim() : '';
        const catalogType = typeof item.catalogType === 'string' ? item.catalogType.trim() : '';

        return {
            value: item.id,
            label: item.name?.trim() || item.id,
            description: [code, strength, dosageForm, category].filter(Boolean).join(' | '),
            group: clinicalCatalogTypeLabel(catalogType),
            keywords: [code, item.name ?? '', category, unit, dosageForm, strength, catalogType].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
        };
        });
}

const createClinicalCatalogOptions = computed<SearchableSelectOption[]>(() => clinicalCatalogOptionsForCategory(selectedCreateCategory.value));
const updateClinicalCatalogOptions = computed<SearchableSelectOption[]>(() => clinicalCatalogOptionsForCategory(selectedUpdateCategory.value));
const createClinicalCatalogSelectionRequired = computed(() => clinicalCatalogTypeForCategory(selectedCreateCategory.value).length > 0);
const createClinicalCatalogOptionsEmpty = computed(() => createClinicalCatalogSelectionRequired.value && createClinicalCatalogOptions.value.length === 0);
const createClinicalCatalogSelectionMissing = computed(() => createClinicalCatalogSelectionRequired.value && !trimmedFormValue(itemCreateForm.clinicalCatalogItemId));
const itemCreateValidationMessages = computed(() => Array.from(new Set(
    Object.values(itemCreateErrors.value)
        .flat()
        .map((message) => trimmedFormValue(message))
        .filter((message) => message.length > 0),
)).slice(0, 4));

const itemCreateSubmitReason = computed(() => {
    if (itemCreateSubmitting.value) {
        return null;
    }

    if (!canManageItems.value) {
        return 'You do not have permission to create inventory items.';
    }

    if (!trimmedFormValue(itemCreateForm.category)) {
        return 'Select a category first.';
    }

    if (createClinicalCatalogOptionsEmpty.value) {
        return 'Create or activate an approved medicine in Clinical Care Catalogs before saving pharmaceutical inventory.';
    }

    if (createClinicalCatalogSelectionMissing.value) {
        return 'Select the approved medicine first so inventory inherits the catalog definition.';
    }

    if (!trimmedFormValue(itemCreateForm.itemCode) || !trimmedFormValue(itemCreateForm.itemName)) {
        return 'Item code and item name are required.';
    }

    if (!trimmedFormValue(itemCreateForm.unit)) {
        return 'Stock unit is required.';
    }

    if (selectedCreateCategory.value?.supportsStorageFields && (selectedCreateCategory.value.requiresExpiryTracking || itemCreateForm.requiresColdChain) && !trimmedFormValue(itemCreateForm.storageConditions)) {
        return 'Storage conditions are required for this item.';
    }

    if (selectedCreateCategory.value?.controlledSubstanceEligible && itemCreateForm.isControlledSubstance && !trimmedFormValue(itemCreateForm.controlledSubstanceSchedule)) {
        return 'Select the controlled substance schedule before saving.';
    }

    return null;
});
const itemCreateSubmitDisabled = computed(() => itemCreateSubmitting.value || itemCreateSubmitReason.value !== null);

const {
    confirmOpen: inventoryWorkflowLeaveConfirmOpen,
    confirmLeave: confirmPendingInventoryWorkflowLeave,
    cancelLeave: cancelPendingInventoryWorkflowLeave,
} = usePendingWorkflowLeaveGuard({
    shouldBlock: computed(() => (
        (createItemDialogOpen.value && hasPendingCreateItemWorkflow.value)
        || (createProcurementDialogOpen.value && hasPendingProcurementWorkflow.value)
        || (itemDetailsOpen.value && hasPendingItemDetailsWorkflow.value)
    )),
    isSubmitting: isSubmittingInventoryWorkflow,
    blockBrowserUnload: false,
});

function selectClinicalCatalogItem(form: InventoryItemFormState, itemId: string): void {
    form.clinicalCatalogItemId = itemId;
    const item = clinicalCatalogItems.value.find((entry) => entry.id === itemId);
    if (!item) {
        return;
    }

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
        if (name) {
            form.genericName = genericNameFromClinicalName(name, strength);
        }
        form.dispensingUnit = unit || form.dispensingUnit;
        form.dosageForm = dosageForm || form.dosageForm;
        form.strength = strength || form.strength;
    }

    form.subcategory = category || form.subcategory;
    form.unit = unit || form.unit;
    form.msdCode = msdCode || form.msdCode;
    form.nhifCode = nhifCode || form.nhifCode;
}

function hasSubcategoryOption(options: SearchableSelectOption[], value: string): boolean {
    const normalizedValue = value.trim().toLowerCase();
    return options.some((option) => option.value.trim().toLowerCase() === normalizedValue);
}

function clearStalePresetSubcategory(form: InventoryItemFormState, oldCategory: string | undefined, newCategory: string): void {
    const currentSubcategory = form.subcategory.trim();
    if (!currentSubcategory || oldCategory === newCategory) {
        return;
    }

    const wasPresetForOldCategory = hasSubcategoryOption(subcategoryOptionsForCategory(oldCategory), currentSubcategory);
    const isPresetForNewCategory = hasSubcategoryOption(subcategoryOptionsForCategory(newCategory), currentSubcategory);

    if (wasPresetForOldCategory && !isPresetForNewCategory) {
        form.subcategory = '';
    }
}

function defaultStorageConditionsForCategory(category: InventoryCategoryOption): string {
    if (!category.supportsStorageFields) {
        return '';
    }

    if (category.requiresColdChain) {
        return 'refrigerated_2_8c';
    }

    return DEFAULT_STORAGE_CONDITIONS_BY_CATEGORY[category.value] ?? 'room_temperature';
}

function applyItemCategoryRules(form: InventoryItemFormState): void {
    const category = resolveCategoryOption(form.category);
    if (!category) {
        return;
    }

    if (clinicalCatalogTypeForCategory(category).length === 0) {
        form.clinicalCatalogItemId = '';
    }

    if (!category.supportsMedicineDetails) {
        form.genericName = '';
        form.dosageForm = '';
        form.strength = '';
        form.dispensingUnit = '';
        form.conversionFactor = '';
    }

    if (!category.supportsClinicalClassification) {
        form.venClassification = '';
        form.abcClassification = '';
        form.nhifCode = '';
    }

    if (!category.supportsStorageFields) {
        form.storageConditions = '';
        form.requiresColdChain = false;
    } else if (!form.storageConditions) {
        form.storageConditions = defaultStorageConditionsForCategory(category);
    }

    if (!category.controlledSubstanceEligible) {
        form.isControlledSubstance = false;
        form.controlledSubstanceSchedule = '';
    }

    if (category.requiresColdChain) {
        form.requiresColdChain = true;
        if (!form.storageConditions) {
            form.storageConditions = 'refrigerated_2_8c';
        }
    }
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

async function loadReferenceData() {
    if (!canRead.value) return;

    try {
        const response = await apiRequest<InventoryReferenceDataResponse>('GET', '/inventory-procurement/reference-data');

        if (Array.isArray(response.categoryOptions) && response.categoryOptions.length > 0) {
            itemCategoryOptions.value = response.categoryOptions;
        } else if (response.categories) {
            itemCategoryOptions.value = Object.entries(response.categories).map(([value, label]) => fallbackCategoryOption(value, label));
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
            storageConditionOptions.value = selectOptionsFromValues(response.storageConditions);
        }

        if (Array.isArray(response.controlledSubstanceScheduleOptions) && response.controlledSubstanceScheduleOptions.length > 0) {
            controlledSubstanceScheduleOptions.value = response.controlledSubstanceScheduleOptions;
        } else if (Array.isArray(response.controlledSubstanceSchedules) && response.controlledSubstanceSchedules.length > 0) {
            controlledSubstanceScheduleOptions.value = selectOptionsFromValues(response.controlledSubstanceSchedules);
        }

        const clinicalItems = Array.isArray(response.clinicalCatalogItems)
            ? response.clinicalCatalogItems
            : response.formularyCatalogItems;
        clinicalCatalogItems.value = Array.isArray(clinicalItems)
            ? clinicalItems.filter((item) => typeof item?.id === 'string' && item.id.trim().length > 0)
            : [];
    } catch {
        itemCategoryOptions.value = [...DEFAULT_ITEM_CATEGORIES];
        venClassificationOptions.value = [...VEN_CLASSIFICATIONS];
        abcClassificationOptions.value = [...ABC_CLASSIFICATIONS];
        storageConditionOptions.value = [...STORAGE_CONDITIONS];
        controlledSubstanceScheduleOptions.value = [...CONTROLLED_SUBSTANCE_SCHEDULES];
        clinicalCatalogItems.value = [];
    }
}

const selectedCreateCategory = computed(() => resolveCategoryOption(itemCreateForm.category));
const selectedUpdateCategory = computed(() => resolveCategoryOption(itemUpdateForm.category));
const createSubcategoryOptions = computed(() => subcategoryOptionsForCategory(itemCreateForm.category));
const updateSubcategoryOptions = computed(() => subcategoryOptionsForCategory(itemUpdateForm.category));
const receiveTrackedCategory = computed(() => resolveCategoryOption(String(receiveRequest.value?.itemCategory ?? '')));
const receiveRequiresBatchTracking = computed(() => Boolean(receiveTrackedCategory.value?.requiresExpiryTracking));

const createIdentityLockedToCatalog = computed(() => Boolean(
    itemCreateForm.clinicalCatalogItemId.trim()
    && selectedCreateCategory.value?.supportsMedicineDetails,
));

const createSelectedCatalogItem = computed(() => {
    const id = itemCreateForm.clinicalCatalogItemId.trim();
    if (!id) return null;
    return clinicalCatalogItems.value.find((entry) => entry.id === id) ?? null;
});

const updateIdentityLockedToCatalog = computed(() => Boolean(
    itemUpdateForm.clinicalCatalogItemId.trim()
    && selectedUpdateCategory.value?.supportsMedicineDetails,
));

const updateSelectedCatalogItem = computed(() => {
    const id = itemUpdateForm.clinicalCatalogItemId.trim();
    if (!id) return null;
    return clinicalCatalogItems.value.find((entry) => entry.id === id) ?? null;
});

const createCategoryWorkflowBadges = computed(() => {
    const category = selectedCreateCategory.value;
    if (!category) return [];

    return [
        categoryTemplateLabel(category.template),
        ...(category.requiresExpiryTracking ? ['Batch + expiry tracking'] : []),
        ...(category.requiresColdChain ? ['Cold chain enforced'] : []),
        ...(category.controlledSubstanceEligible ? ['Controlled-substance capable'] : []),
    ];
});

const updateCategoryWorkflowBadges = computed(() => {
    const category = selectedUpdateCategory.value;
    if (!category) return [];

    return [
        categoryTemplateLabel(category.template),
        ...(category.requiresExpiryTracking ? ['Batch + expiry tracking'] : []),
        ...(category.requiresColdChain ? ['Cold chain enforced'] : []),
        ...(category.controlledSubstanceEligible ? ['Controlled-substance capable'] : []),
    ];
});

const itemDetailsSummaryCards = computed(() => {
    const item = itemDetails.value;
    if (!item) return [];

    const unitLabel = item.unit ?? 'units';
    const currentStockLabel = item.currentStock != null
        ? `${formatAmount(item.currentStock)} ${unitLabel}`
        : `0.00 ${unitLabel}`;
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
        {
            key: 'status',
            label: 'Current status',
            value: formatEnumLabel(item.status ?? 'n/a'),
            helper: item.statusReason ? String(item.statusReason) : 'No reason recorded',
        },
        {
            key: 'stock',
            label: 'Store stock',
            value: stockValue,
            helper: `Reorder ${reorderLevelLabel} | Max ${maxStockLevelLabel}`,
        },
        {
            key: 'openingStock',
            label: 'Opening stock',
            value: inventoryItemHasOpeningStock(item)
                ? `${formatAmount(item.openingStockMovementCount)} entry(ies)`
                : 'Not set',
            helper: inventoryItemHasOpeningStock(item)
                ? 'Correct from the action bar above'
                : 'Use "Set Opening Stock" after creating the item',
        },
        (() => {
            const price = unitPrices.value?.[0];
            const priceLabel = price
                ? `${price.currencyCode} ${Number(price.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : null;
            return {
                key: 'billingPrice',
                label: 'Billing price',
                value: priceLabel ?? 'Not set',
                helper: priceLabel
                    ? `${price.priceType.replace('_', ' ')} · per ${unitLabel}`
                    : 'No active unit price configured',
                valueClass: priceLabel ? 'text-emerald-600 dark:text-emerald-400' : '',
            };
        })(),
        {
            key: 'classification',
            label: 'Inventory class',
            value: item.category ? formatEnumLabel(item.category) : 'Unclassified',
            helper: classificationHelper || 'No extra classification recorded',
        },
    ];
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
watch(() => stockMovementForm.movementType, (value) => {
    if (value !== 'adjust') {
        stockMovementForm.adjustmentDirection = 'increase';
    }
});
watch(() => stockMovementForm.itemId, (value) => {
    stockMovementForm.batchId = '';
    stockMovementForm.batchNumber = '';
    stockMovementForm.lotNumber = '';
    stockMovementForm.manufactureDate = '';
    stockMovementForm.expiryDate = '';
    stockMovementForm.binLocation = '';

    if (!value.trim()) {
        stockMovementSelectedItem.value = null;
        stockMovementBatchOptions.value = [];
        return;
    }

    void loadStockMovementBatchOptions(value.trim());
});
watch(() => stockMovementForm.category, (value, previousValue) => {
    if (stockMovementSelectionResetLocked || value === previousValue) {
        return;
    }

    stockMovementForm.subcategory = '';
    stockMovementForm.itemId = '';
    stockMovementSelectedItem.value = null;
    stockMovementBatchOptions.value = [];
});
watch(() => stockMovementForm.subcategory, (value, previousValue) => {
    if (stockMovementSelectionResetLocked || value === previousValue) {
        return;
    }

    stockMovementForm.itemId = '';
    stockMovementSelectedItem.value = null;
    stockMovementBatchOptions.value = [];
});
watch(() => stockMovementForm.sourceWarehouseId, () => {
    stockMovementForm.batchId = '';
});
watch(() => stockReconciliationForm.itemId, (value) => {
    stockReconciliationForm.batchId = '';
    stockReconciliationForm.countedBatchQuantity = '';

    if (!value.trim()) {
        stockReconciliationSelectedItem.value = null;
        stockReconciliationBatchOptions.value = [];
        return;
    }

    void loadStockReconciliationBatchOptions(value.trim());
});
function resolveStockStateForPreview(currentStock: number, reorderLevel: number): 'out_of_stock' | 'low_stock' | 'healthy' {
    if (currentStock <= 0) {
        return 'out_of_stock';
    }

    if (currentStock <= reorderLevel) {
        return 'low_stock';
    }

    return 'healthy';
}

const selectedStockMovementTypeMeta = computed(() => stockMovementTypeMeta[stockMovementForm.movementType as keyof typeof stockMovementTypeMeta]);
const stockMovementSubcategoryOptions = computed(() => (
    stockMovementForm.category.trim() ? subcategoryOptionsForCategory(stockMovementForm.category) : []
));
const stockMovementLookupBlockedReason = computed(() => {
    if (stockMovementForm.itemId.trim()) {
        return null;
    }

    if (!stockMovementForm.category.trim()) {
        return 'Select an item category first.';
    }

    return null;
});
const stockMovementLookupHelperText = computed(() => {
    if (stockMovementLookupBlockedReason.value) {
        return stockMovementLookupBlockedReason.value;
    }

    if (stockMovementItem.value) {
        return 'Item locked. Change category or subcategory if you need a different stock record.';
    }

    if (stockMovementForm.subcategory.trim()) {
        return 'Search within the selected category and subcategory.';
    }

    return 'Search within the selected category. Subcategory is optional when you are not sure how the item was classified.';
});

function inventoryItemMovementCount(item: StockMovementLookupItem | Record<string, unknown> | null | undefined): number {
    const numeric = Number(item?.movementCount ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
}

function inventoryItemNeedsOpeningStock(item: StockMovementLookupItem | Record<string, unknown> | null | undefined): boolean {
    return Boolean(item) && inventoryItemMovementCount(item) <= 0;
}

function inventoryItemHasOpeningStock(item: StockMovementLookupItem | Record<string, unknown> | null | undefined): boolean {
    return Boolean(item) && (Number(item?.openingStockMovementCount ?? 0) > 0);
}

function inventoryItemStockActionLabel(item: StockMovementLookupItem | Record<string, unknown>): string {
    return inventoryItemNeedsOpeningStock(item) ? 'Set Opening Stock' : 'Record Item Movement';
}

function inventoryItemListMeta(item: Record<string, unknown>): string {
    const category = item.category ? formatEnumLabel(String(item.category)) : 'Uncategorized';
    const unit = String(item.unit ?? 'No unit');

    const medParts: string[] = [];
    if (item.genericName) medParts.push(String(item.genericName));
    if (item.strength) medParts.push(String(item.strength));
    if (item.dosageForm) medParts.push(String(item.dosageForm));
    const medicineInfo = medParts.length > 0 ? medParts.join(' · ') : null;

    const conversionFactor = Number(item.conversionFactor ?? 0);
    const dispensingUnit = item.dispensingUnit ? String(item.dispensingUnit) : null;
    const canConvert = item.currentStock != null && conversionFactor > 0 && dispensingUnit !== null && dispensingUnit.toLowerCase() !== unit.toLowerCase();

    const stockDisplay = canConvert
        ? `Store ${formatAmount(Number(item.currentStock))} ${unit} (${formatAmount(Number(item.currentStock) * conversionFactor)} ${dispensingUnit}s)`
        : `Store ${item.currentStock != null ? formatAmount(Number(item.currentStock)) : '—'}`;

    const reorder = item.reorderLevel != null ? formatAmount(Number(item.reorderLevel)) : '—';

    const parts = [category];
    if (medicineInfo) parts.push(medicineInfo);
    parts.push(unit, stockDisplay, `Reorder ${reorder}`);

    return parts.join(' · ');
}

const stockMovementItem = computed<StockMovementLookupItem | null>(() => {
    if (stockMovementSelectedItem.value?.id === stockMovementForm.itemId) {
        return stockMovementSelectedItem.value;
    }

    return items.value.find((item) => item.id === stockMovementForm.itemId) ?? stockMovementSelectedItem.value ?? null;
});
const stockMovementCategoryOption = computed(() => resolveCategoryOption(
    stockMovementItem.value?.category ?? stockMovementForm.category,
));
const stockMovementCategoryLabel = computed(() => (
    stockMovementCategoryOption.value?.label ?? (stockMovementForm.category ? formatEnumLabel(stockMovementForm.category) : 'Inventory items')
));
const stockMovementSubcategoryLabel = computed(() => (
    stockMovementForm.subcategory.trim() ? formatEnumLabel(stockMovementForm.subcategory) : 'subcategory'
));
const stockMovementUsesBatchTracking = computed(() => Boolean(stockMovementCategoryOption.value?.requiresExpiryTracking) || stockMovementBatchOptions.value.length > 0);
const stockMovementRequiresBatchSelection = computed(() => (
    stockMovementUsesBatchTracking.value
    && (
        stockMovementForm.movementType === 'issue'
        || stockMovementForm.movementType === 'transfer'
        || (stockMovementForm.movementType === 'adjust' && stockMovementForm.adjustmentDirection === 'decrease')
    )
));
const stockMovementRequiresBatchReceiptFields = computed(() => (
    stockMovementUsesBatchTracking.value
    && (
        stockMovementForm.movementType === 'receive'
        || (stockMovementForm.movementType === 'adjust' && stockMovementForm.adjustmentDirection === 'increase')
    )
));
const stockMovementFilteredBatches = computed(() => stockMovementBatchOptions.value.filter((batch) => {
    if (!stockMovementForm.sourceWarehouseId) {
        return true;
    }

    return batch.warehouseId === stockMovementForm.sourceWarehouseId;
}));
const selectedStockMovementBatch = computed(() => stockMovementFilteredBatches.value.find((batch) => batch.id === stockMovementForm.batchId) ?? null);
const stockMovementQuantityValue = computed<number | null>(() => {
    const numeric = Number(stockMovementForm.quantity);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
});
const stockMovementSignedDelta = computed<number | null>(() => {
    const quantity = stockMovementQuantityValue.value;
    if (quantity === null) {
        return null;
    }

    switch (stockMovementForm.movementType) {
        case 'receive':
            return quantity;
        case 'issue':
        case 'transfer':
            return -1 * quantity;
        case 'adjust':
            return stockMovementForm.adjustmentDirection === 'decrease' ? -1 * quantity : quantity;
        default:
            return null;
    }
});
const stockMovementProjectedStock = computed<number | null>(() => {
    const item = stockMovementItem.value;
    const delta = stockMovementSignedDelta.value;

    if (!item || delta === null) {
        return null;
    }

    const currentStock = Number(item.currentStock ?? 0);
    if (Number.isNaN(currentStock)) {
        return null;
    }

    return currentStock + delta;
});
const stockMovementProjectedState = computed<string | null>(() => {
    const projectedStock = stockMovementProjectedStock.value;
    const item = stockMovementItem.value;

    if (projectedStock === null || !item) {
        return null;
    }

    const reorderLevel = Number(item.reorderLevel ?? 0);
    return resolveStockStateForPreview(projectedStock, Number.isNaN(reorderLevel) ? 0 : reorderLevel);
});
const stockMovementProjectedNegative = computed(() => stockMovementProjectedStock.value !== null && stockMovementProjectedStock.value < 0);
const stockMovementUnitLabel = computed(() => {
    const unit = stockMovementItem.value?.unit;
    return typeof unit === 'string' && unit.trim() ? unit.trim() : 'units';
});
const stockMovementOpeningBalanceMode = computed(() => inventoryItemNeedsOpeningStock(stockMovementItem.value));
const stockMovementSheetTitle = computed(() => (
    stockMovementOpeningBalanceMode.value ? 'Set Opening Stock' : 'Record Stock Movement'
));
const stockMovementSheetDescription = computed(() => (
    stockMovementOpeningBalanceMode.value
        ? 'Load day-0 counted stock for this item without pretending a new purchase, expense, or department requisition happened.'
        : 'Capture a stock movement with item context, live balance preview, and accurate event timing.'
));
const stockMovementSubmitLabel = computed(() => (
    stockMovementOpeningBalanceMode.value ? 'Save Opening Stock' : 'Record Movement'
));
const stockMovementSuccessMessage = computed(() => (
    stockMovementOpeningBalanceMode.value ? 'Opening stock recorded.' : 'Stock movement recorded.'
));
const stockMovementReasonPlaceholder = computed(() => (
    stockMovementOpeningBalanceMode.value
        ? 'Opening balance count sheet, legacy register, or go-live reference'
        : selectedStockMovementTypeMeta.value.reasonPlaceholder
));
const stockMovementReasonRequired = computed(() => (
    stockMovementOpeningBalanceMode.value || ['issue', 'adjust', 'transfer'].includes(stockMovementForm.movementType)
));
const stockMovementSubmitDisabled = computed(() => {
    if (stockMovementSubmitting.value || !canCreateMovement.value) {
        return true;
    }

    if (!stockMovementForm.itemId.trim() || stockMovementQuantityValue.value === null) {
        return true;
    }

    if (stockMovementReasonRequired.value && !(stockMovementOpeningBalanceMode.value ? stockMovementForm.reasonCode.trim() : stockMovementForm.reason.trim())) {
        return true;
    }

    if (stockMovementRequiresBatchSelection.value && !stockMovementForm.batchId.trim()) {
        return true;
    }

    if (stockMovementRequiresBatchReceiptFields.value && !stockMovementForm.batchNumber.trim()) {
        return true;
    }

    return stockMovementProjectedNegative.value;
});

const stockReconciliationItem = computed<StockMovementLookupItem | null>(() => {
    if (stockReconciliationSelectedItem.value?.id === stockReconciliationForm.itemId) {
        return stockReconciliationSelectedItem.value;
    }

    return items.value.find((item) => item.id === stockReconciliationForm.itemId) ?? stockReconciliationSelectedItem.value ?? null;
});
const stockReconciliationCategoryOption = computed(() => resolveCategoryOption(stockReconciliationItem.value?.category ?? ''));
const stockReconciliationUsesBatchTracking = computed(() => Boolean(stockReconciliationCategoryOption.value?.requiresExpiryTracking) || stockReconciliationBatchOptions.value.length > 0);
const selectedStockReconciliationBatch = computed(() => stockReconciliationBatchOptions.value.find((batch) => batch.id === stockReconciliationForm.batchId) ?? null);
const stockReconciliationSubmitDisabled = computed(() => {
    if (stockReconciliationSubmitting.value || !canReconcileStock.value) {
        return true;
    }

    if (!stockReconciliationForm.itemId.trim() || !stockReconciliationForm.reason.trim()) {
        return true;
    }

    if (stockReconciliationUsesBatchTracking.value) {
        return !stockReconciliationForm.batchId.trim() || stockReconciliationForm.countedBatchQuantity.trim() === '';
    }

    return stockReconciliationForm.countedStock.trim() === '';
});

function transferLineItem(line: { itemId: string }): StockMovementLookupItem | null {
    return items.value.find((item) => item.id === line.itemId) ?? null;
}

function transferLineBatches(line: { itemId: string }): any[] {
    const allBatches = transferBatchOptionsByItemId.value[line.itemId] ?? [];
    if (!transferForm.sourceWarehouseId) {
        return allBatches;
    }

    return allBatches.filter((batch) => batch.warehouseId === transferForm.sourceWarehouseId);
}

function transferLineUsesBatchTracking(line: { itemId: string }): boolean {
    const category = resolveCategoryOption(transferLineItem(line)?.category ?? '');
    return Boolean(category?.requiresExpiryTracking) || transferLineBatches(line).length > 0;
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

function procurementSourceLabel(request: any | null | undefined): string | null {
    if (!request?.sourceDepartmentRequisitionId) return null;

    const requestNumber = request.sourceDepartmentRequisitionNumber || request.sourceDepartmentRequisitionId;
    const department = request.sourceDepartmentName ? ` | ${request.sourceDepartmentName}` : '';

    return `${requestNumber}${department}`;
}

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

        const existingIndex = deptRequisitions.value.findIndex((entry) => entry.id === sourceId);
        if (existingIndex >= 0) {
            deptRequisitions.value.splice(existingIndex, 1, requisition);
        }

        detailsOpen.value = false;
        activeTab.value = 'requisitions';
        openRequisitionDetails(requisition);
    } catch (error) {
        notifyError('Source requisition was not found in the current facility scope.');
    } finally {
        sourceRequisitionOpeningId.value = null;
    }
}

const statusDialogOpen = ref(false);
const statusRequest = ref<any | null>(null);
const statusValue = ref('approved');
const statusReason = ref('');
const statusSubmitting = ref(false);
const statusError = ref<string | null>(null);

const placeOrderDialogOpen = ref(false);
const placeOrderRequest = ref<any | null>(null);
const placeOrderSubmitting = ref(false);
const placeOrderError = ref<string | null>(null);
const placeOrderErrors = ref<Record<string, string[]>>({});
const placeOrderForm = reactive({
    purchaseOrderNumber: '',
    orderedQuantity: '',
    unitCostEstimate: '',
    neededBy: '',
    supplierId: '',
    notes: '',
});

const receiveDialogOpen = ref(false);
const receiveRequest = ref<any | null>(null);
const receiveSubmitting = ref(false);
const receiveError = ref<string | null>(null);
const receiveErrors = ref<Record<string, string[]>>({});
const receiveForm = reactive({
    receivedQuantity: '',
    receivedUnitCost: '',
    warehouseId: '',
    batchNumber: '',
    lotNumber: '',
    manufactureDate: '',
    expiryDate: '',
    binLocation: '',
    reason: '',
    notes: '',
    occurredAt: '',
});

const detailsOpen = ref(false);
const detailsRequest = ref<any | null>(null);
const detailsAuditLogs = ref<any[]>([]);
const detailsAuditLoading = ref(false);
const detailsAuditError = ref<string | null>(null);
const detailsAuditExporting = ref(false);
const detailsAuditMeta = ref<{ currentPage: number; lastPage: number; total: number; perPage: number } | null>(null);
const detailsAuditFilters = reactive({
    q: '',
    action: '',
    actorType: '',
    actorId: '',
    from: '',
    to: '',
    page: 1,
    perPage: 20,
});

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function formatDateOnly(value: string | null | undefined): string {
    if (!value) return '—';

    const normalized = String(value);
    const datePart = normalized.includes('T') ? normalized.split('T')[0] : normalized;
    const date = new Date(`${datePart}T00:00:00`);

    if (Number.isNaN(date.getTime())) return normalized;

    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

function formatBatchDate(value: string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

function batchOptionLabel(batch: any): string {
    const parts = [
        batch?.batchNumber ? `Batch ${batch.batchNumber}` : 'Batch',
        batch?.quantity != null ? `${formatAmount(batch.quantity)} available` : null,
        batch?.expiryDate ? `Exp ${formatBatchDate(batch.expiryDate)}` : null,
    ].filter((value): value is string => Boolean(value && String(value).trim()));

    return parts.join(' • ');
}

function stockMovementSourceSummary(movement: Record<string, unknown>): string {
    const parts = [
        typeof movement.sourceLabel === 'string' ? movement.sourceLabel : null,
        typeof movement.sourceReference === 'string' ? movement.sourceReference : null,
        typeof movement.sourceDetail === 'string' ? movement.sourceDetail : null,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    return parts.join(' | ');
}

function formatAmount(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return 'N/A';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return String(value);
    return numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fieldError(errors: Record<string, string[]>, key: string): string | null {
    return errors[key]?.[0] ?? null;
}

function trimmedFormValue(value: unknown): string {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (value === null || value === undefined) {
        return '';
    }

    return String(value).trim();
}

function nullableTrimmedFormValue(value: unknown): string | null {
    const trimmed = trimmedFormValue(value);

    return trimmed === '' ? null : trimmed;
}

function nullableNumericFormValue(value: unknown): number | null {
    const trimmed = trimmedFormValue(value);
    if (trimmed === '') {
        return null;
    }

    const numeric = Number(trimmed);

    return Number.isFinite(numeric) ? numeric : null;
}

async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, opts?: { query?: Record<string, string | number | null>; body?: Record<string, unknown>; meta?: Record<string, unknown> }): Promise<T> {
    return apiRequestJson<T>(method, path, opts);
}

const { requestPipelineCounts, loadRequestPipelineCounts } = useRequestPipelineCounts(apiRequest);

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
        canReconcileStock.value = hasSuperAdminAccess
            || permissionSet.has('inventory.procurement.reconcile-stock')
            || permissionSet.has('inventory.procurement.create-movement');
        canCreateRequest.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.create-request');
        canUpdateRequestStatus.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.update-request-status');
        canViewAudit.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.view-audit-logs');
        canApproveRequisitions.value = hasSuperAdminAccess || permissionSet.has('inventory.approve-requisition-own-department');
        canManageSuppliers.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.manage-suppliers');
        canManageWarehouses.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.manage-warehouses');
    };

    applyResolvedPermissions(sharedPermissionNames.value ?? [], isFacilitySuperAdmin.value);

    try {
        const response = await apiRequest<{ data?: Array<{ name?: string }> }>('GET', '/auth/me/permissions');
        applyResolvedPermissions(
            (response.data ?? []).map((item) => item.name ?? ''),
            isFacilitySuperAdmin.value,
        );
    } catch {
        applyResolvedPermissions(sharedPermissionNames.value ?? [], isFacilitySuperAdmin.value);
    }

    syncActiveTabWithAccess();
}

async function loadItems() {
    if (!canRead.value) return;

    if (isDepartmentRequester.value && requisitionContext.value === null) {
        await loadSuppliersAndWarehouses();
    }

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
            total: 0,
            receive: 0,
            issue: 0,
            adjust: 0,
            transfer: 0,
            reconciliationAdjustments: 0,
            reconciliationIncreases: 0,
            reconciliationDecreases: 0,
            distinctItems: 0,
            netQuantityDelta: 0,
        };
    } catch {
        stockMovements.value = [];
        stockMovementPagination.value = null;
        stockLedgerSummary.value = {
            total: 0,
            receive: 0,
            issue: 0,
            adjust: 0,
            transfer: 0,
            reconciliationAdjustments: 0,
            reconciliationIncreases: 0,
            reconciliationDecreases: 0,
            distinctItems: 0,
            netQuantityDelta: 0,
        };
    } finally {
        stockLedgerLoading.value = false;
    }
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

async function loadDepartmentStock() {
    if (!canRead.value) return;
    departmentStockLoading.value = true;
    try {
        const response = await apiRequest<{
            data: any[];
            summary?: typeof departmentStockSummary.value;
            meta: { currentPage: number; lastPage: number; total?: number };
        }>('GET', '/inventory-procurement/department-stock', {
            query: departmentStockQuery(),
        });
        departmentStock.value = response.data ?? [];
        departmentStockSummary.value = response.summary ?? {
            totalRows: 0,
            departments: 0,
            items: 0,
            totalIssuedQuantity: 0,
            lastIssuedAt: null,
        };
        departmentStockPagination.value = response.meta ?? null;
    } catch {
        departmentStock.value = [];
        departmentStockPagination.value = null;
        departmentStockSummary.value = {
            totalRows: 0,
            departments: 0,
            items: 0,
            totalIssuedQuantity: 0,
            lastIssuedAt: null,
        };
    } finally {
        departmentStockLoading.value = false;
    }
}

function applyDepartmentStockFilters() {
    departmentStockFilters.page = 1;
    void loadDepartmentStock();
}

function resetDepartmentStockFilters() {
    departmentStockFilters.q = '';
    departmentStockFilters.departmentId = normalizeScopedDepartmentFilter('');
    departmentStockFilters.itemId = '';
    departmentStockScopedItem.value = null;
    departmentStockFilters.page = 1;
    departmentStockFilters.perPage = 20;
    void loadDepartmentStock();
}

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

function clearDepartmentStockItemScope(): void {
    departmentStockFilters.itemId = '';
    departmentStockScopedItem.value = null;
    departmentStockFilters.page = 1;
    void loadDepartmentStock();
}

function applyStockLedgerFilters() {
    stockLedgerFilters.page = 1;
    void loadStockLedger();
}

function resetStockLedgerFilters() {
    stockLedgerFilters.q = '';
    stockLedgerFilters.itemId = '';
    stockLedgerFilters.movementType = '';
    stockLedgerFilters.sourceKey = '';
    stockLedgerFilters.actorType = '';
    stockLedgerFilters.actorId = '';
    stockLedgerFilters.from = '';
    stockLedgerFilters.to = '';
    stockLedgerFilters.page = 1;
    stockLedgerFilters.perPage = 20;
    void loadStockLedger();
}

function hydrateStockLedgerFiltersFromUrl(): boolean {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const shouldFocusStockLedger =
        (params.get('section') ?? '').trim().toLowerCase() === 'stock-ledger' ||
        !!params.get('itemId') ||
        !!params.get('movementType');

    if (!shouldFocusStockLedger) {
        return false;
    }

    stockLedgerFilters.q = params.get('q')?.trim() ?? '';
    stockLedgerFilters.itemId = params.get('itemId')?.trim() ?? '';
    stockLedgerFilters.movementType = params.get('movementType')?.trim() ?? '';
    stockLedgerFilters.actorType = params.get('actorType')?.trim() ?? '';
    stockLedgerFilters.actorId = params.get('actorId')?.trim() ?? '';
    stockLedgerFilters.from = params.get('from')?.trim() ?? '';
    stockLedgerFilters.to = params.get('to')?.trim() ?? '';
    stockLedgerFilters.page = 1;

    const perPage = Number(params.get('perPage') ?? '');
    stockLedgerFilters.perPage = Number.isFinite(perPage) && perPage > 0 ? perPage : 20;

    return true;
}

function hydrateWorkspaceTabFromUrl(): void {
    const section = (new URL(window.location.href).searchParams.get('section') ?? '').trim().toLowerCase();
    if (!section || section === 'stock-ledger') {
        return;
    }

    const nextTab = normalizeInventoryWorkspaceTab(section);
    activeTab.value = nextTab;
}

function goToStockLedgerPage(page: number) {
    stockLedgerFilters.page = Math.max(page, 1);
    void loadStockLedger();
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

function exportInventoryItemsCsv() {
    const url = new URL('/api/v1/inventory-procurement/items/export', window.location.origin);
    Object.entries(itemQuery()).forEach(([key, value]) => {
        if (value === null || value === '') return;
        if (key === 'page' || key === 'perPage') return;
        url.searchParams.set(key, String(value));
    });
    window.open(url.toString(), '_blank', 'noopener');
}

function exportDepartmentStockCsv() {
    const url = new URL('/api/v1/inventory-procurement/department-stock/export', window.location.origin);
    Object.entries(departmentStockQuery()).forEach(([key, value]) => {
        if (value === null || value === '') return;
        if (key === 'page' || key === 'perPage') return;
        url.searchParams.set(key, String(value));
    });
    window.open(url.toString(), '_blank', 'noopener');
}

function printCurrentView() {
    window.print();
}

// --- Batch Management ---
const itemBatches = ref<any[]>([]);
const itemBatchesLoading = ref(false);
const createBatchDialogOpen = ref(false);

// --- Unit Management ---
const itemUnits = ref<any[]>([]);
const itemUnitsLoading = ref(false);
const unitPrices = ref<any[]>([]);
const unitPricesLoading = ref(false);
const createUnitDialogOpen = ref(false);
const createPriceDialogOpen = ref(false);
const unitForm = reactive({
    unitName: '',
    unitCode: '',
    baseQuantity: '',
    isDefaultSalesUnit: false,
    isDefaultPurchaseUnit: false,
    barcode: '',
});
const unitFormErrors = ref<Record<string, string[]>>({});
const unitFormSubmitting = ref(false);
const editingUnitId = ref<string | null>(null);
const batchCreateSubmitting = ref(false);
const batchCreateErrors = ref<Record<string, string[]>>({});
const batchForm = reactive({
    batchNumber: '',
    lotNumber: '',
    manufactureDate: '',
    expiryDate: '',
    quantity: '',
    unitCost: '',
    binLocation: '',
    supplierId: '',
    warehouseId: '',
});

function resetBatchForm() {
    batchForm.batchNumber = '';
    batchForm.lotNumber = '';
    batchForm.manufactureDate = '';
    batchForm.expiryDate = '';
    batchForm.quantity = '';
    batchForm.unitCost = '';
    batchForm.binLocation = '';
    batchForm.supplierId = '';
    batchForm.warehouseId = '';
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
    if (!itemId.trim()) {
        itemUnits.value = [];
        return;
    }
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
    if (!itemId.trim()) {
        unitPrices.value = [];
        return;
    }
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

function resetUnitForm(): void {
    unitForm.unitName = '';
    unitForm.unitCode = '';
    unitForm.baseQuantity = '';
    unitForm.isDefaultSalesUnit = false;
    unitForm.isDefaultPurchaseUnit = false;
    unitForm.barcode = '';
    unitFormErrors.value = {};
    editingUnitId.value = null;
}

function openCreateUnitDialog(): void {
    if (!itemDetails.value) return;
    resetUnitForm();
    editingUnitId.value = null;
    // Default to item's base unit name suggestion
    unitForm.unitName = String(itemDetails.value.unit ?? '');
    createUnitDialogOpen.value = true;
}

async function openEditUnitDialog(unit: any): Promise<void> {
    if (!itemDetails.value) return;
    editingUnitId.value = String(unit.id ?? '');
    unitForm.unitName = String(unit.unitName ?? unit.unitCode ?? '');
    unitForm.unitCode = String(unit.unitCode ?? '');
    unitForm.baseQuantity = String(unit.baseQuantity ?? '');
    unitForm.isDefaultSalesUnit = Boolean(unit.isDefaultSalesUnit);
    unitForm.isDefaultPurchaseUnit = Boolean(unit.isDefaultPurchaseUnit);
    unitForm.barcode = String(unit.barcode ?? '');
    unitFormErrors.value = {};
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

        if (unitForm.unitCode.trim()) {
            body.unit_code = unitForm.unitCode.trim();
        }
        if (unitForm.barcode.trim()) {
            body.barcode = unitForm.barcode.trim();
        }

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

async function submitCreateUnitPrice() {
    if (!itemDetails.value || createPriceDialogOpen.value === false) return;
    // Placeholder for unit price creation form submission — extend when price create sheet is added.
    notifyError('Unit price creation form is not yet implemented in this workspace.');
}

async function fetchItemBatchOptions(itemId: string): Promise<any[]> {
    if (!itemId.trim()) {
        return [];
    }

    const response = await apiRequest<{ data: any[] }>('GET', '/inventory-procurement/batches', {
        query: { itemId, perPage: 50 },
    });

    return response.data ?? [];
}

async function loadStockMovementBatchOptions(itemId: string): Promise<void> {
    if (!itemId.trim()) {
        stockMovementBatchOptions.value = [];
        return;
    }

    stockMovementBatchesLoading.value = true;
    try {
        stockMovementBatchOptions.value = await fetchItemBatchOptions(itemId);
    } catch {
        stockMovementBatchOptions.value = [];
    } finally {
        stockMovementBatchesLoading.value = false;
    }
}

async function loadStockReconciliationBatchOptions(itemId: string): Promise<void> {
    if (!itemId.trim()) {
        stockReconciliationBatchOptions.value = [];
        return;
    }

    stockReconciliationBatchesLoading.value = true;
    try {
        stockReconciliationBatchOptions.value = await fetchItemBatchOptions(itemId);
    } catch {
        stockReconciliationBatchOptions.value = [];
    } finally {
        stockReconciliationBatchesLoading.value = false;
    }
}

async function ensureTransferBatchOptions(itemId: string): Promise<void> {
    if (!itemId.trim() || transferBatchOptionsByItemId.value[itemId]) {
        return;
    }

    transferBatchLoadingByItemId.value = {
        ...transferBatchLoadingByItemId.value,
        [itemId]: true,
    };

    try {
        transferBatchOptionsByItemId.value = {
            ...transferBatchOptionsByItemId.value,
            [itemId]: await fetchItemBatchOptions(itemId),
        };
    } catch {
        transferBatchOptionsByItemId.value = {
            ...transferBatchOptionsByItemId.value,
            [itemId]: [],
        };
    } finally {
        transferBatchLoadingByItemId.value = {
            ...transferBatchLoadingByItemId.value,
            [itemId]: false,
        };
    }
}

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
                quantity: batchForm.quantity.trim() === '' ? null : Number(batchForm.quantity),
                unitCost: batchForm.unitCost.trim() === '' ? null : Number(batchForm.unitCost),
                binLocation: batchForm.binLocation.trim() || null,
                supplierId: batchForm.supplierId.trim() || null,
                warehouseId: batchForm.warehouseId.trim() || null,
            },
        });
        notifySuccess('Batch created.');
        createBatchDialogOpen.value = false;
        resetBatchForm();
        await loadItemBatches(String(itemDetails.value.id));
    } catch (error) {
        batchCreateErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to create batch.'));
    } finally {
        batchCreateSubmitting.value = false;
    }
}

function expiryBadgeClass(state: string): string {
    switch (state) {
        case 'expired': return 'bg-destructive text-destructive-foreground';
        case 'critical': return 'bg-orange-600 text-white';
        case 'warning': return 'bg-yellow-500 text-black';
        default: return 'bg-green-600 text-white';
    }
}

// --- Department Requisitions ---
const deptRequisitions = ref<any[]>([]);
const deptReqLoading = ref(false);
const deptReqPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const deptReqSearch = reactive({ q: '', status: '', departmentId: '', page: 1, perPage: 20 });
const createRequisitionDialogOpen = ref(false);
const requisitionDetailsOpen = ref(false);
const selectedRequisition = ref<any | null>(null);
const requisitionLineDecisionDrafts = ref<Array<{ id: string; approvedQuantity: string; issuedQuantity: string }>>([]);
const requisitionStatusSubmitting = ref(false);
const sourceRequisitionOpeningId = ref<string | null>(null);
const reqCreateSubmitting = ref(false);
const reqCreateErrors = ref<Record<string, string[]>>({});

// --- Shortage Queue ---
const shortageQueueItems = ref<any[]>([]);
const shortageQueueLoading = ref(false);
const shortageQueueError = ref<string | null>(null);
const shortageQueueMeta = ref<{
    currentPage: number;
    lastPage: number;
    total: number;
    readyLineCount: number;
    waitingLineCount: number;
    readiness: string;
} | null>(null);
const shortageQueueFilters = reactive({ q: '', departmentId: '', readiness: 'all', page: 1, perPage: 50 });
const shortageQueueReplenishmentBanner = ref<{ itemId: string | null; pendingLineCount: number } | null>(null);
const reqForm = reactive({
    requestingDepartment: '',
    requestingDepartmentId: '',
    issuingWarehouseId: '',
    priority: 'normal',
    neededBy: '',
    notes: '',
    lines: [{ itemId: '', requestedQuantity: '', unit: '', notes: '' }] as Array<{ itemId: string; requestedQuantity: string; unit: string; notes: string }>,
});

const canSelectAnyRequisitionDepartment = computed(() => requisitionContext.value?.canSelectAnyDepartment ?? isFacilitySuperAdmin.value);
const lockedRequisitionDepartment = computed(() => requisitionContext.value?.lockedDepartment ?? null);

const workspaceDepartmentName = computed(() => departmentDisplayName(requisitionContext.value));
const workspaceHeaderDescription = computed(() =>
    isDepartmentRequester.value
        ? departmentRequesterHeaderDescription(requisitionContext.value)
        : 'Supervisor control center for requisitions, shortages, stock, procurement, MSD, and governance.',
);
const showDepartmentInWorkspaceHeader = computed(
    () => isDepartmentRequester.value && canCreateRequest.value,
);
const workspaceDepartmentHeaderLoading = computed(
    () => showDepartmentInWorkspaceHeader.value && workspaceDepartmentName.value === null && loading.value,
);
const requisitionDepartmentOptions = computed(() => {
    const options = [...departments.value];
    const lockedDepartment = lockedRequisitionDepartment.value;

    if (lockedDepartment && !options.some((department) => department.id === lockedDepartment.id)) {
        options.unshift(lockedDepartment);
    }

    return options;
});
const departmentFilterOptions = computed(() => {
    if (canSelectAnyRequisitionDepartment.value) {
        return requisitionDepartmentOptions.value;
    }

    return lockedRequisitionDepartment.value ? [lockedRequisitionDepartment.value] : [];
});
const selectedRequisitionDepartment = computed(() => {
    const selectedId = reqForm.requestingDepartmentId.trim();
    if (selectedId) {
        return requisitionDepartmentOptions.value.find((department) => department.id === selectedId) ?? lockedRequisitionDepartment.value;
    }

    return lockedRequisitionDepartment.value;
});
const selectedRequisitionDepartmentId = computed(() => (selectedRequisitionDepartment.value?.id ?? reqForm.requestingDepartmentId.trim()) || null);
const inventoryItemRequestingDepartmentId = computed(() => {
    if (!isDepartmentRequester.value) {
        return null;
    }

    if (!canSelectAnyRequisitionDepartment.value) {
        return lockedRequisitionDepartment.value?.id ?? null;
    }

    return selectedRequisitionDepartmentId.value;
});
const selectedRequisitionWarehouse = computed(() => {
    const selectedId = reqForm.issuingWarehouseId.trim();

    return selectedId ? warehouses.value.find((warehouse) => warehouse.id === selectedId) ?? null : null;
});
const requisitionDepartmentHelperText = computed(() => {
    if (!canSelectAnyRequisitionDepartment.value && lockedRequisitionDepartment.value) {
        return `Locked to ${lookupOptionText(lockedRequisitionDepartment.value)} from your staff profile.`;
    }

    if (!canSelectAnyRequisitionDepartment.value) {
        return 'Your staff profile must be linked to an active department before requesting stock.';
    }

    return 'Uses the active department registry.';
});

function applyLockedRequisitionDepartment(): void {
    const lockedDepartment = lockedRequisitionDepartment.value;
    if (canSelectAnyRequisitionDepartment.value || !lockedDepartment) return;

    reqForm.requestingDepartmentId = lockedDepartment.id;
    reqForm.requestingDepartment = lockedDepartment.name;
}

function applyLockedDeptReqFilter(): void {
    const lockedDepartment = lockedRequisitionDepartment.value;
    if (canSelectAnyRequisitionDepartment.value || !lockedDepartment) return;

    deptReqSearch.departmentId = lockedDepartment.id;
}

function normalizeScopedDepartmentFilter(departmentId: string): string {
    const lockedDepartment = lockedRequisitionDepartment.value;
    if (!canSelectAnyRequisitionDepartment.value) {
        return lockedDepartment?.id ?? '';
    }

    return fromSelectValue(departmentId);
}

function setDeptReqDepartmentFilter(departmentId: string): void {
    deptReqSearch.departmentId = normalizeScopedDepartmentFilter(departmentId);
}

function setShortageQueueDepartmentFilter(departmentId: string): void {
    shortageQueueFilters.departmentId = normalizeScopedDepartmentFilter(departmentId);
}

function setDepartmentStockDepartmentFilter(departmentId: string): void {
    departmentStockFilters.departmentId = normalizeScopedDepartmentFilter(departmentId);
}

function applyLockedDepartmentFilters(): void {
    const lockedDepartment = lockedRequisitionDepartment.value;
    if (canSelectAnyRequisitionDepartment.value || !lockedDepartment) return;

    deptReqSearch.departmentId = lockedDepartment.id;
    shortageQueueFilters.departmentId = lockedDepartment.id;
    departmentStockFilters.departmentId = lockedDepartment.id;
}

watch(inventoryItemRequestingDepartmentId, (newDepartmentId, oldDepartmentId) => {
    if (!canRead.value) return;
    if (newDepartmentId === oldDepartmentId) return;
    if (activeTab.value === 'inventory' || activeTab.value === 'overview' || activeTab.value === 'msd-orders') {
        void loadItems();
    }
});

function updateRequisitionDepartment(departmentId: string): void {
    const normalizedId = fromSelectValue(departmentId);
        const selectedDepartment = requisitionDepartmentOptions.value.find((department) => department.id === normalizedId) ?? null;

    reqForm.requestingDepartmentId = selectedDepartment?.id ?? '';
    reqForm.requestingDepartment = selectedDepartment?.name ?? '';
    reqForm.lines = reqForm.lines.map((line) => ({ ...line, itemId: '', unit: '' }));
}

function resetReqForm() {
    reqForm.requestingDepartment = '';
    reqForm.requestingDepartmentId = '';
    // Auto-select the department's preferred warehouse, fallback to sole warehouse
    const preferredWarehouse = requisitionContext.value?.preferredWarehouseId ?? null;
    const warehouseOptions = warehouses.value;
    reqForm.issuingWarehouseId = preferredWarehouse
        || (warehouseOptions.length === 1 ? warehouseOptions[0]?.id ?? '' : '');
    reqForm.priority = 'normal';
    reqForm.neededBy = '';
    reqForm.notes = '';
    reqForm.lines = [{ itemId: '', requestedQuantity: '', unit: '', notes: '' }];
    applyLockedRequisitionDepartment();
}

function openCreateRequisitionDialog(): void {
    resetReqForm();
    createRequisitionDialogOpen.value = true;
}

function openRequisitionDetails(req: any): void {
    const pendingByLineId = new Map((req?.pendingLines ?? []).map((line: any) => [String(line?.id ?? ''), line]));
    const enrichedReq = {
        ...req,
        lines: (req?.lines ?? []).map((line: any) => ({
            ...line,
            ...(pendingByLineId.get(String(line?.id ?? '')) ?? {}),
        })),
    };

    selectedRequisition.value = enrichedReq;
    requisitionLineDecisionDrafts.value = buildRequisitionLineDecisionDrafts(enrichedReq);
    requisitionDetailsOpen.value = true;
}

function onRequisitionDetailsOpenChange(value: boolean): void {
    requisitionDetailsOpen.value = value;
    if (!value) {
        selectedRequisition.value = null;
        requisitionLineDecisionDrafts.value = [];
    }
}

function addReqLine() {
    reqForm.lines.push({ itemId: '', requestedQuantity: '', unit: '', notes: '' });
}

function removeReqLine(index: number) {
    if (reqForm.lines.length > 1) reqForm.lines.splice(index, 1);
}

function handleReqLineItemSelected(index: number, item: RequisitionInventorySelection): void {
    const line = reqForm.lines[index];
    if (!line || !item) return;

    if (!line.unit.trim() && item.unit) {
        line.unit = item.unit;
    }
}

async function loadDeptRequisitions() {
    deptReqLoading.value = true;
    try {
        const query: Record<string, string | number | null> = {
            page: deptReqSearch.page,
            perPage: deptReqSearch.perPage,
        };
        if (deptReqSearch.q) query.q = deptReqSearch.q;
        if (deptReqSearch.status) query.status = deptReqSearch.status;
        if (deptReqSearch.departmentId) query.departmentId = deptReqSearch.departmentId;
        const response = await apiRequest<{ data: any[]; meta: { currentPage: number; lastPage: number; total?: number } }>('GET', '/inventory-procurement/department-requisitions', { query });
        deptRequisitions.value = response.data ?? [];
        deptReqPagination.value = response.meta ?? null;
    } catch {
        deptRequisitions.value = [];
        deptReqPagination.value = null;
    } finally {
        deptReqLoading.value = false;
    }
}

async function loadShortageQueue() {
    if (!canRead.value) return;
    shortageQueueLoading.value = true;
    shortageQueueError.value = null;
    try {
        const query: Record<string, string | number> = {
            page: shortageQueueFilters.page,
            perPage: shortageQueueFilters.perPage,
            readiness: shortageQueueFilters.readiness,
        };
        if (shortageQueueFilters.q) query.q = shortageQueueFilters.q;
        if (shortageQueueFilters.departmentId) query.departmentId = shortageQueueFilters.departmentId;
        const response = await apiRequest<{
            data: any[];
            meta: { currentPage: number; lastPage: number; total: number; readyLineCount: number; waitingLineCount: number; readiness: string };
        }>('GET', '/inventory-procurement/shortage-queue', { query });
        shortageQueueItems.value = response.data ?? [];
        shortageQueueMeta.value = response.meta ?? null;
    } catch (error) {
        shortageQueueError.value = messageFromUnknown(error, 'Unable to load shortage queue.');
        shortageQueueItems.value = [];
        shortageQueueMeta.value = null;
    } finally {
        shortageQueueLoading.value = false;
    }
}

async function submitCreateRequisition() {
    if (reqCreateSubmitting.value) return;
    reqCreateSubmitting.value = true;
    reqCreateErrors.value = {};
    try {
        await apiRequest('POST', '/inventory-procurement/department-requisitions', {
            body: {
                requestingDepartment: reqForm.requestingDepartment.trim(),
                requestingDepartmentId: reqForm.requestingDepartmentId.trim() || null,
                issuingStore: selectedRequisitionWarehouse.value?.name ?? null,
                issuingWarehouseId: reqForm.issuingWarehouseId.trim() || null,
                priority: reqForm.priority,
                neededBy: reqForm.neededBy || null,
                notes: reqForm.notes.trim() || null,
                lines: reqForm.lines.map(l => ({
                    itemId: l.itemId.trim(),
                    requestedQuantity: Number(l.requestedQuantity),
                    unit: l.unit.trim() || null,
                    notes: l.notes.trim() || null,
                })),
            },
        });
        notifySuccess('Department requisition created.');
        createRequisitionDialogOpen.value = false;
        resetReqForm();
        await loadDeptRequisitions();
    } catch (error) {
        reqCreateErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to create requisition.'));
    } finally {
        reqCreateSubmitting.value = false;
    }
}

function requisitionStatusLinePayload(req: any | null, status: string): Array<{ id: string; approvedQuantity?: number; issuedQuantity?: number }> {
    const sourceLines = req?.lines ?? [];

    if (!['approved', 'issued', 'partially_issued'].includes(status)) {
        return [];
    }

    return sourceLines
        .map((line: any) => {
            const draft = requisitionLineDecisionDrafts.value.find((entry) => entry.id === line.id);
            const approvedQuantity = Number(draft?.approvedQuantity || line.approvedQuantity || line.requestedQuantity || 0);
            const issuedQuantity = Number(draft?.issuedQuantity || line.issuedQuantity || line.approvedQuantity || line.requestedQuantity || 0);

            return {
                id: line.id,
                ...(status === 'approved' ? { approvedQuantity } : {}),
                ...(status === 'issued' || status === 'partially_issued' ? { issuedQuantity } : {}),
            };
        })
        .filter((line: { id?: string }) => Boolean(line.id));
}

function buildRequisitionLineDecisionDrafts(req: any | null): Array<{ id: string; approvedQuantity: string; issuedQuantity: string }> {
    return (req?.lines ?? []).map((line: any) => {
        const approvedQuantity = numericDecisionValue(line?.approvedQuantity ?? line?.requestedQuantity, 0);
        const previousIssuedQuantity = numericDecisionValue(line?.issuedQuantity, 0);
        const availableStock = requisitionLineAvailableStock(line);
        const remainingApprovedQuantity = Math.max(approvedQuantity - previousIssuedQuantity, 0);
        const safeIssueQuantity = previousIssuedQuantity + Math.min(remainingApprovedQuantity, availableStock);

        return {
            id: String(line.id ?? ''),
            approvedQuantity: String(line?.approvedQuantity ?? line?.requestedQuantity ?? ''),
            issuedQuantity: ['approved', 'partially_issued'].includes(req?.status)
                ? String(safeIssueQuantity)
                : String(line?.issuedQuantity ?? line?.approvedQuantity ?? line?.requestedQuantity ?? ''),
        };
    });
}

function requisitionLineDecisionDraft(line: any): { id: string; approvedQuantity: string; issuedQuantity: string } {
    const lineId = String(line?.id ?? '');
    let draft = requisitionLineDecisionDrafts.value.find((entry) => entry.id === lineId);

    if (!draft) {
        draft = {
            id: lineId,
            approvedQuantity: String(line?.approvedQuantity ?? line?.requestedQuantity ?? ''),
            issuedQuantity: String(line?.issuedQuantity ?? line?.approvedQuantity ?? line?.requestedQuantity ?? ''),
        };
        requisitionLineDecisionDrafts.value.push(draft);
    }

    return draft;
}

function numericDecisionValue(value: unknown, fallback = 0): number {
    const numeric = Number(value);

    return Number.isFinite(numeric) ? numeric : fallback;
}

function requisitionApprovedDecisionQuantity(line: any): number {
    const draft = requisitionLineDecisionDraft(line);

    return numericDecisionValue(draft.approvedQuantity || line?.approvedQuantity || line?.requestedQuantity, 0);
}

function requisitionIssuedDecisionQuantity(line: any): number {
    const draft = requisitionLineDecisionDraft(line);

    return numericDecisionValue(draft.issuedQuantity || line?.issuedQuantity || line?.approvedQuantity || line?.requestedQuantity, 0);
}

function requisitionLineAvailableStock(line: any): number {
    return numericDecisionValue(line?.itemCurrentStock, 0);
}

function requisitionLineAdditionalIssueQuantity(line: any): number {
    return Math.max(requisitionIssuedDecisionQuantity(line) - numericDecisionValue(line?.issuedQuantity, 0), 0);
}

function requisitionLineIssueProblem(line: any): string | null {
    const approvedQuantity = requisitionApprovedDecisionQuantity(line);
    const issuedQuantity = requisitionIssuedDecisionQuantity(line);
    const previousIssuedQuantity = numericDecisionValue(line?.issuedQuantity, 0);
    const additionalIssueQuantity = requisitionLineAdditionalIssueQuantity(line);
    const availableStock = requisitionLineAvailableStock(line);
    const label = requisitionLineItemLabel(line);

    if (issuedQuantity < previousIssuedQuantity) {
        return `${label}: issued quantity cannot be lower than what was already issued.`;
    }

    if (issuedQuantity > approvedQuantity) {
        return `${label}: issued quantity cannot exceed approved quantity.`;
    }

    if (additionalIssueQuantity > availableStock) {
        return `${label}: only ${formatAmount(availableStock)} available for issue.`;
    }

    return null;
}

function requisitionLineShortageSummary(line: any): string | null {
    const approvedQuantity = requisitionApprovedDecisionQuantity(line);
    const issuedQuantity = requisitionIssuedDecisionQuantity(line);
    const shortageQuantity = Math.max(approvedQuantity - issuedQuantity, 0);

    if (shortageQuantity <= 0) return null;

    return `${requisitionLineItemLabel(line)}: ${formatAmount(shortageQuantity)} ${line?.unit ?? ''} will remain short.`;
}

function requisitionLineShortageQuantity(line: any): number {
    return Math.max(requisitionApprovedDecisionQuantity(line) - requisitionIssuedDecisionQuantity(line), 0);
}

function shortageLineProcurementRequest(line: any): any | null {
    return line?.procurementRequest ?? null;
}

function shortageLineHasActiveProcurement(line: any): boolean {
    const request = shortageLineProcurementRequest(line);

    return Boolean(request && ACTIVE_SOURCE_PROCUREMENT_STATUSES.includes(String(request.status ?? '')));
}

function canCreateProcurementFromRequisitionLine(line: any, req: any | null = selectedRequisition.value): boolean {
    return canCreateRequest.value
        && Boolean(req)
        && ['approved', 'partially_issued'].includes(req?.status)
        && requisitionLineShortageQuantity(line) > 0
        && Boolean(line?.itemId)
        && !shortageLineHasActiveProcurement(line);
}

function requisitionIssueTargetStatus(req: any | null): 'issued' | 'partially_issued' {
    const lines = req?.lines ?? [];
    const hasPartialLine = lines.some((line: any) => requisitionIssuedDecisionQuantity(line) < requisitionApprovedDecisionQuantity(line));

    return hasPartialLine ? 'partially_issued' : 'issued';
}

const selectedRequisitionIssueBlockingProblems = computed(() => {
    const req = selectedRequisition.value;
    if (!req || !['approved', 'partially_issued'].includes(req.status)) return [];

    const lines = req.lines ?? [];
    if (lines.length === 0) return ['No requisition lines are available to issue.'];

    return lines
        .map((line: any) => requisitionLineIssueProblem(line))
        .filter((problem: string | null): problem is string => Boolean(problem));
});

const selectedRequisitionIssueShortageSummaries = computed(() => {
    const req = selectedRequisition.value;
    if (!req || !['approved', 'partially_issued'].includes(req.status)) return [];

    return (req.lines ?? [])
        .map((line: any) => requisitionLineShortageSummary(line))
        .filter((summary: string | null): summary is string => Boolean(summary));
});

const selectedRequisitionHasAnyAdditionalIssue = computed(() => {
    const req = selectedRequisition.value;
    if (!req || !['approved', 'partially_issued'].includes(req.status)) return false;

    return (req.lines ?? []).some((line: any) => requisitionLineAdditionalIssueQuantity(line) > 0);
});

const selectedRequisitionIssueBlockedReason = computed(() => {
    const req = selectedRequisition.value;
    if (!req || !['approved', 'partially_issued'].includes(req.status)) return null;

    if (selectedRequisitionIssueBlockingProblems.value.length > 0) {
        return selectedRequisitionIssueBlockingProblems.value[0] ?? null;
    }

    return null;
});

const selectedRequisitionIssueUnavailableReason = computed(() => {
    const req = selectedRequisition.value;
    if (!req || !['approved', 'partially_issued'].includes(req.status)) return null;
    if (selectedRequisitionIssueBlockedReason.value || selectedRequisitionHasAnyAdditionalIssue.value) return null;

    return 'No additional stock is available to issue right now.';
});

const selectedRequisitionIssueTargetStatus = computed(() => requisitionIssueTargetStatus(selectedRequisition.value));

async function updateRequisitionStatus(reqId: string, status: string, extra?: { rejectionReason?: string }) {
    if (requisitionStatusSubmitting.value) return;
    requisitionStatusSubmitting.value = true;

    try {
        const req = selectedRequisition.value?.id === reqId
            ? selectedRequisition.value
            : deptRequisitions.value.find((entry) => entry.id === reqId) ?? null;
        const effectiveStatus = status === 'issued' && req ? requisitionIssueTargetStatus(req) : status;
        const linePayload = requisitionStatusLinePayload(req, effectiveStatus);

        await apiRequest('PATCH', `/inventory-procurement/department-requisitions/${reqId}/status`, {
            body: { status: effectiveStatus, ...(linePayload.length ? { lines: linePayload } : {}), ...extra },
        });
        notifySuccess(`Requisition ${effectiveStatus}.`);
        await loadDeptRequisitions();
        if (selectedRequisition.value?.id === reqId) {
            selectedRequisition.value = deptRequisitions.value.find((req) => req.id === reqId) ?? selectedRequisition.value;
            requisitionLineDecisionDrafts.value = buildRequisitionLineDecisionDrafts(selectedRequisition.value);
        }
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to update requisition status.'));
    } finally {
        requisitionStatusSubmitting.value = false;
    }
}

async function confirmSelectedRequisitionIssue(): Promise<void> {
    const req = selectedRequisition.value;
    if (!req || !['approved', 'partially_issued'].includes(req.status)) return;

    if (selectedRequisitionIssueBlockedReason.value) {
        notifyError(selectedRequisitionIssueBlockedReason.value);
        return;
    }

    if (selectedRequisitionIssueUnavailableReason.value) {
        notifyError(selectedRequisitionIssueUnavailableReason.value);
        return;
    }

    await updateRequisitionStatus(req.id, selectedRequisitionIssueTargetStatus.value);
}

function requisitionPrimaryActionLabel(req: any): string {
    return req?.status === 'submitted' ? 'Review' : 'View';
}

function requisitionLineItemLabel(line: any): string {
    const localItem = items.value.find((item) => item.id === line?.itemId) ?? null;
    const name = String(line?.itemName ?? localItem?.itemName ?? '').trim();
    const code = String(line?.itemCode ?? localItem?.itemCode ?? '').trim();

    if (name && code) return `${name} (${code})`;
    if (name) return name;
    if (code) return code;

    return 'Inventory item';
}

function requisitionStatusHelper(status: string | null | undefined): string {
    switch (status) {
        case 'draft':
            return 'Draft can still be corrected before the department sends it to stores.';
        case 'submitted':
            return 'Submitted requests are ready for store review, approval, or rejection.';
        case 'approved':
            return 'Approved requests are authorized for stock issue from the selected warehouse.';
        case 'partially_issued':
            return 'Some approved quantities have been issued; remaining lines still need fulfillment or closure.';
        case 'issued':
            return 'Issued requests are fulfilled and should now be visible in stock movement and audit history.';
        case 'rejected':
            return 'Rejected requests are closed unless the department creates a corrected requisition.';
        case 'cancelled':
            return 'Cancelled requests are closed and should not affect stock.';
        default:
            return 'Review the current requisition state before taking the next workflow action.';
    }
}

function reqStatusBadgeClass(status: string): string {
    switch (status) {
        case 'draft': return 'bg-muted text-muted-foreground';
        case 'submitted': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        case 'partially_issued': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        case 'issued': return 'bg-green-600 text-white';
        case 'rejected': return 'bg-destructive text-destructive-foreground';
        case 'cancelled': return 'bg-muted text-muted-foreground line-through';
        default: return 'bg-muted text-muted-foreground';
    }
}

// --- Supplier Lead Times ---
const leadTimes = ref<any[]>([]);
const leadTimeLoading = ref(false);
const leadTimePagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const leadTimeSearch = reactive({ supplierId: '', page: 1, perPage: 15 });
const createLeadTimeDialogOpen = ref(false);
const leadTimeSubmitting = ref(false);
const leadTimeErrors = ref<Record<string, string[]>>({});
const leadTimeForm = reactive({
    supplierId: '',
    itemId: '',
    orderDate: '',
    expectedDeliveryDate: '',
    quantityOrdered: '',
    notes: '',
});
const recordDeliveryDialogOpen = ref(false);
const deliverySubmitting = ref(false);
const deliveryErrors = ref<Record<string, string[]>>({});
const deliveryForm = reactive({ leadTimeId: '', actualDeliveryDate: '', quantityReceived: '' });
const supplierPerformance = ref<any>(null);

function resetLeadTimeForm() {
    leadTimeForm.supplierId = '';
    leadTimeForm.itemId = '';
    leadTimeForm.orderDate = '';
    leadTimeForm.expectedDeliveryDate = '';
    leadTimeForm.quantityOrdered = '';
    leadTimeForm.notes = '';
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

async function loadSupplierPerformance(supplierId: string) {
    try {
        const response = await apiRequest<{ data: any }>('GET', `/inventory-procurement/suppliers/${supplierId}/performance`);
        supplierPerformance.value = response.data ?? null;
    } catch { supplierPerformance.value = null; }
}

watch(() => leadTimeSearch.supplierId, async (supplierId) => {
    leadTimeSearch.page = 1;
    supplierPerformance.value = null;
    await loadLeadTimes();

    if (supplierId) {
        await loadSupplierPerformance(supplierId);
    }
});

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
        if (leadTimeSearch.supplierId) { await loadLeadTimes(); await loadSupplierPerformance(leadTimeSearch.supplierId); }
    } catch (error: any) {
        if (error?.errors) leadTimeErrors.value = error.errors;
        else notifyError(messageFromUnknown(error, 'Failed to create lead time record.'));
    } finally { leadTimeSubmitting.value = false; }
}

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
        if (leadTimeSearch.supplierId) { await loadLeadTimes(); await loadSupplierPerformance(leadTimeSearch.supplierId); }
    } catch (error: any) {
        if (error?.errors) deliveryErrors.value = error.errors;
        else notifyError(messageFromUnknown(error, 'Failed to record delivery.'));
    } finally { deliverySubmitting.value = false; }
}

function openRecordDelivery(lt: any) {
    deliveryForm.leadTimeId = lt.id;
    deliveryForm.actualDeliveryDate = '';
    deliveryForm.quantityReceived = '';
    recordDeliveryDialogOpen.value = true;
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

// --- Warehouse Transfers ---
const transfers = ref<any[]>([]);
const transferLoading = ref(false);
const transferPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const transferSearch = reactive({ q: '', status: '', varianceReview: '', page: 1, perPage: 15 });
const createTransferDialogOpen = ref(false);
const transferSubmitting = ref(false);
const transferErrors = ref<Record<string, string[]>>({});
const transferForm = reactive({
    sourceWarehouseId: '',
    destinationWarehouseId: '',
    priority: 'normal',
    reason: '',
    notes: '',
    lines: [{ itemId: '', batchId: '', requestedQuantity: '', unit: '', notes: '' }] as Array<{ itemId: string; batchId: string; requestedQuantity: string; unit: string; notes: string }>,
});
const transferStatusDialogOpen = ref(false);
const transferStatusSubmitting = ref(false);
const transferStatusContextLoading = ref(false);
const transferStatusErrors = ref<Record<string, string[]>>({});
const transferStatusSelectedTransfer = ref<any | null>(null);
const transferVarianceReviewDialogOpen = ref(false);
const transferVarianceReviewSubmitting = ref(false);
const transferVarianceReviewLoading = ref(false);
const transferVarianceReviewErrors = ref<Record<string, string[]>>({});
const transferVarianceReviewSelectedTransfer = ref<any | null>(null);
const transferVarianceReviewForm = reactive({
    transferId: '',
    reviewNotes: '',
});
const transferStatusForm = reactive({
    transferId: '',
    currentStatus: '',
    newStatus: '',
    rejectionReason: '',
    packNotes: '',
    receivingNotes: '',
    revalidateReservation: false,
    packedQuantities: {} as Record<string, string>,
    dispatchedQuantities: {} as Record<string, string>,
    receivedQuantities: {} as Record<string, string>,
    receiptVarianceTypes: {} as Record<string, string>,
    receiptVarianceQuantities: {} as Record<string, string>,
    receiptVarianceReasons: {} as Record<string, string>,
});

const TRANSFER_STATUSES = [
    { value: 'draft', label: 'Draft' },
    { value: 'pending_approval', label: 'Pending Approval' },
    { value: 'approved', label: 'Approved' },
    { value: 'packed', label: 'Packed' },
    { value: 'in_transit', label: 'In Transit' },
    { value: 'received', label: 'Received' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'rejected', label: 'Rejected' },
] as const;

const TRANSFER_ACTION_TRANSITIONS: Record<string, string[]> = {
    draft: ['pending_approval', 'cancelled'],
    pending_approval: ['approved', 'rejected', 'cancelled'],
    approved: ['packed', 'cancelled'],
    packed: ['in_transit', 'cancelled'],
    in_transit: ['received'],
    received: [],
    cancelled: [],
    rejected: ['draft'],
};

const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
] as const;

const TRANSFER_RECEIPT_VARIANCE_OPTIONS = [
    { value: 'full', label: 'Full match' },
    { value: 'short', label: 'Short received' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'wrong_batch', label: 'Wrong batch' },
    { value: 'excess', label: 'Excess delivered' },
] as const;

const TRANSFER_VARIANCE_REVIEW_FILTER_OPTIONS = [
    { value: '', label: 'All reviews' },
    { value: 'pending', label: 'Needs review' },
    { value: 'reviewed', label: 'Reviewed' },
] as const;

watch(() => transferForm.sourceWarehouseId, () => {
    transferForm.lines.forEach((line) => {
        line.batchId = '';
    });
});

function resetTransferForm() {
    transferForm.sourceWarehouseId = '';
    transferForm.destinationWarehouseId = '';
    transferForm.priority = 'normal';
    transferForm.reason = '';
    transferForm.notes = '';
    transferForm.lines = [{ itemId: '', batchId: '', requestedQuantity: '', unit: '', notes: '' }];
    transferBatchOptionsByItemId.value = {};
    transferBatchLoadingByItemId.value = {};
}

function resetTransferStatusForm() {
    transferStatusForm.transferId = '';
    transferStatusForm.currentStatus = '';
    transferStatusForm.newStatus = '';
    transferStatusForm.rejectionReason = '';
    transferStatusForm.packNotes = '';
    transferStatusForm.receivingNotes = '';
    transferStatusForm.revalidateReservation = false;
    transferStatusForm.packedQuantities = {};
    transferStatusForm.dispatchedQuantities = {};
    transferStatusForm.receivedQuantities = {};
    transferStatusForm.receiptVarianceTypes = {};
    transferStatusForm.receiptVarianceQuantities = {};
    transferStatusForm.receiptVarianceReasons = {};
    transferStatusErrors.value = {};
    transferStatusSelectedTransfer.value = null;
    transferStatusContextLoading.value = false;
}

function resetTransferVarianceReviewForm() {
    transferVarianceReviewForm.transferId = '';
    transferVarianceReviewForm.reviewNotes = '';
    transferVarianceReviewErrors.value = {};
    transferVarianceReviewSelectedTransfer.value = null;
    transferVarianceReviewLoading.value = false;
}

function onTransferStatusDialogOpenChange(value: boolean): void {
    transferStatusDialogOpen.value = value;
    if (!value) {
        resetTransferStatusForm();
    }
}

function onTransferVarianceReviewDialogOpenChange(value: boolean): void {
    transferVarianceReviewDialogOpen.value = value;
    if (!value) {
        resetTransferVarianceReviewForm();
    }
}

function addTransferLine() {
    transferForm.lines.push({ itemId: '', batchId: '', requestedQuantity: '', unit: '', notes: '' });
}

function removeTransferLine(index: number) {
    if (transferForm.lines.length > 1) transferForm.lines.splice(index, 1);
}

async function handleTransferLineItemChange(index: number, value: string): Promise<void> {
    const line = transferForm.lines[index];
    if (!line) return;

    line.itemId = fromSelectValue(value);
    line.batchId = '';

    const selectedItem = transferLineItem(line);
    line.unit = typeof selectedItem?.unit === 'string' && selectedItem.unit.trim()
        ? selectedItem.unit
        : line.unit;

    if (line.itemId) {
        await ensureTransferBatchOptions(line.itemId);
    }
}

async function loadWarehouseTransfers() {
    transferLoading.value = true;
    try {
        const query: Record<string, string | number> = { page: transferSearch.page, perPage: transferSearch.perPage };
        if (transferSearch.q) query.query = transferSearch.q;
        if (transferSearch.status) query.status = transferSearch.status;
        if (transferSearch.varianceReview) query.varianceReview = transferSearch.varianceReview;
        const response = await apiRequest<{ data: any[]; meta: any }>('GET', '/inventory-procurement/warehouse-transfers', { query });
        transfers.value = response.data ?? [];
        transferPagination.value = response.meta ?? null;
    } catch { transfers.value = []; transferPagination.value = null; } finally { transferLoading.value = false; }
}

async function submitCreateTransfer() {
    if (transferSubmitting.value) return;
    transferSubmitting.value = true;
    transferErrors.value = {};
    try {
        await apiRequest('POST', '/inventory-procurement/warehouse-transfers', {
            body: {
                sourceWarehouseId: transferForm.sourceWarehouseId,
                destinationWarehouseId: transferForm.destinationWarehouseId,
                priority: transferForm.priority,
                reason: transferForm.reason || null,
                notes: transferForm.notes || null,
                lines: transferForm.lines.map(l => ({
                    itemId: l.itemId,
                    batchId: l.batchId || null,
                    requestedQuantity: Number(l.requestedQuantity),
                    unit: l.unit || null,
                    notes: l.notes || null,
                })),
            },
        });
        createTransferDialogOpen.value = false;
        resetTransferForm();
        notifySuccess('Warehouse transfer created.');
        await loadWarehouseTransfers();
    } catch (error) {
        transferErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Failed to create transfer.'));
    } finally { transferSubmitting.value = false; }
}

function transferActionLabel(status: string): string {
    switch (status) {
        case 'pending_approval': return 'Submit for Approval';
        case 'approved': return 'Approve Transfer';
        case 'packed': return 'Confirm Pack';
        case 'in_transit': return 'Dispatch Transfer';
        case 'received': return 'Confirm Receipt';
        case 'cancelled': return 'Cancel Transfer';
        case 'rejected': return 'Reject Transfer';
        case 'draft': return 'Return to Draft';
        default: return status.replace(/_/g, ' ');
    }
}

function transferVarianceReviewState(transfer: any): string {
    return String(transfer?.varianceReview?.state ?? 'not_required');
}

function transferVarianceReviewStateLabel(state: string): string {
    switch (state) {
        case 'pending': return 'Needs review';
        case 'reviewed': return 'Reviewed';
        default: return 'No review';
    }
}

function transferVarianceReviewBadgeClass(state: string): string {
    switch (state) {
        case 'pending': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
        case 'reviewed': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
        default: return 'bg-muted text-muted-foreground';
    }
}

function transferHasReceiptVariance(transfer: any): boolean {
    return Number(transfer?.receiptVarianceSummary?.lineCount ?? 0) > 0;
}

function transferCanOpenVarianceReview(transfer: any): boolean {
    return transferHasReceiptVariance(transfer) && transfer?.varianceReview?.canReview === true;
}

function transferVarianceReviewButtonLabel(transfer: any): string {
    return transferVarianceReviewState(transfer) === 'reviewed' ? 'View Review' : 'Review Variance';
}

function transferReservationStateLabel(state: string | null | undefined): string {
    switch ((state ?? '').trim().toLowerCase()) {
        case 'held': return 'Held';
        case 'stale': return 'Hold expired';
        case 'refresh_required': return 'Refresh hold';
        case 'consumed': return 'Consumed';
        case 'released': return 'Released';
        case 'partial': return 'Partial';
        default: return 'No hold';
    }
}

function transferReservationStateBadgeClass(state: string | null | undefined): string {
    switch ((state ?? '').trim().toLowerCase()) {
        case 'held': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        case 'stale': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
        case 'refresh_required': return 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200';
        case 'consumed': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
        case 'released': return 'bg-muted text-muted-foreground';
        case 'partial': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
        default: return 'bg-muted text-muted-foreground';
    }
}

function formatTransferQuantity(value: unknown): string {
    const numeric = Number(value ?? 0);
    if (Number.isNaN(numeric)) return '0';
    return numeric.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function transferLineLabel(line: any): string {
    const itemName = String(line?.itemName ?? '').trim();
    const itemCode = String(line?.itemCode ?? '').trim();
    if (itemName && itemCode) {
        return `${itemName} (${itemCode})`;
    }

    return itemName || itemCode || 'Transfer line';
}

function syncTransferStatusQuantities(transfer: any | null, newStatus: string): void {
    transferStatusForm.packedQuantities = {};
    transferStatusForm.dispatchedQuantities = {};
    transferStatusForm.receivedQuantities = {};
    transferStatusForm.receiptVarianceTypes = {};
    transferStatusForm.receiptVarianceQuantities = {};
    transferStatusForm.receiptVarianceReasons = {};

    for (const line of transfer?.lines ?? []) {
        if (!line?.id) continue;

        if (newStatus === 'packed') {
            transferStatusForm.packedQuantities[line.id] = String(
                line.packRemainingQuantity ?? line.requested_quantity ?? '',
            );
        }

        if (newStatus === 'in_transit') {
            transferStatusForm.dispatchedQuantities[line.id] = String(
                line.dispatchRemainingQuantity ?? line.packedQuantity ?? line.requested_quantity ?? '',
            );
        }

        if (newStatus === 'received') {
            transferStatusForm.receivedQuantities[line.id] = String(
                line.receiptRemainingQuantity ?? line.dispatched_quantity ?? line.requested_quantity ?? '',
            );
            transferStatusForm.receiptVarianceTypes[line.id] = String(line.receiptVarianceType ?? 'full');
            transferStatusForm.receiptVarianceQuantities[line.id] = Number(line.receiptVarianceQuantity ?? 0) > 0
                ? String(line.receiptVarianceQuantity)
                : '';
            transferStatusForm.receiptVarianceReasons[line.id] = String(line.receiptVarianceReason ?? '');
        }
    }
}

function transferReservationSummaryLabel(transfer: any): string {
    const summary = transfer?.reservationSummary;
    if (!summary) return 'No reservation summary';

    const stateLabel = transferReservationStateLabel(summary.state);
    const activeQuantity = Number(summary.activeQuantity ?? 0);
    const staleQuantity = Number(summary.staleQuantity ?? 0);
    const refreshQuantity = Number(summary.expiredReleasedQuantity ?? 0);
    const consumedQuantity = Number(summary.consumedQuantity ?? 0);
    const releasedQuantity = Number(summary.releasedQuantity ?? 0);

    if (staleQuantity > 0) {
        return `${stateLabel}: ${formatTransferQuantity(staleQuantity)} awaiting refresh`;
    }

    if (refreshQuantity > 0) {
        return `${stateLabel}: ${formatTransferQuantity(refreshQuantity)} to re-hold`;
    }

    if (activeQuantity > 0) {
        return `${stateLabel}: ${formatTransferQuantity(activeQuantity)} held`;
    }

    if (consumedQuantity > 0) {
        return `${stateLabel}: ${formatTransferQuantity(consumedQuantity)} dispatched`;
    }

    if (releasedQuantity > 0) {
        return `${stateLabel}: ${formatTransferQuantity(releasedQuantity)} released`;
    }

    return stateLabel;
}

function transferDispatchNeedsRevalidation(): boolean {
    return (transferStatusForm.newStatus === 'packed' || transferStatusForm.newStatus === 'in_transit')
        && transferStatusSelectedTransfer.value?.reservationSummary?.dispatchRequiresRevalidation === true;
}

function transferAttentionSignals(transfer: any): Array<Record<string, any>> {
    return Array.isArray(transfer?.attentionSignals) ? transfer.attentionSignals : [];
}

function transferAttentionBadgeClass(signal: any): string {
    switch (String(signal?.severity ?? '').toLowerCase()) {
        case 'high':
            return 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200';
        case 'medium':
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
        default:
            return 'bg-muted text-muted-foreground';
    }
}

const transferAttentionSummary = computed(() => {
    const counts: Record<string, { label: string; count: number; severity: string }> = {
        hold_refresh_required: { label: 'Hold refresh', count: 0, severity: 'high' },
        approval_stale: { label: 'Approval stale', count: 0, severity: 'medium' },
        pick_overdue: { label: 'Pick overdue', count: 0, severity: 'medium' },
        receive_overdue: { label: 'Receive overdue', count: 0, severity: 'medium' },
        variance_review_pending: { label: 'Variance review', count: 0, severity: 'high' },
    };

    for (const transfer of transfers.value) {
        for (const signal of transferAttentionSignals(transfer)) {
            const key = String(signal?.key ?? '');
            if (counts[key]) {
                counts[key].count += 1;
            }
        }
    }

    return Object.values(counts).filter(entry => entry.count > 0);
});

function transferPickSummaryLabel(transfer: any): string {
    const summary = transfer?.pickingSummary;
    if (!summary) return 'No pick summary';
    const receiptVarianceSummary = transfer?.receiptVarianceSummary;

    if (Number(receiptVarianceSummary?.lineCount ?? 0) > 0 && String(transfer?.status ?? '') === 'received') {
        return `${formatTransferQuantity(summary.receivedQuantity)} accepted with ${formatTransferQuantity(receiptVarianceSummary.quantity)} variance`;
    }

    if (Number(summary.remainingToReceive ?? 0) > 0) {
        return `${formatTransferQuantity(summary.receivedQuantity)} received of ${formatTransferQuantity(summary.dispatchedQuantity)} dispatched`;
    }

    if (Number(summary.remainingToDispatch ?? 0) > 0 && Number(summary.packedQuantity ?? 0) > 0) {
        return `${formatTransferQuantity(summary.packedQuantity)} packed of ${formatTransferQuantity(summary.requestedQuantity)} requested`;
    }

    if (Number(summary.dispatchedQuantity ?? 0) > 0) {
        return `${formatTransferQuantity(summary.dispatchedQuantity)} dispatched of ${formatTransferQuantity(summary.requestedQuantity)} requested`;
    }

    return `${formatTransferQuantity(summary.requestedQuantity)} requested`;
}

function transferPickSlipUrl(transferId: string): string {
    return `/inventory-procurement/warehouse-transfers/${transferId}/pick-slip`;
}

function transferDispatchNoteUrl(transferId: string): string {
    return `/inventory-procurement/warehouse-transfers/${transferId}/dispatch-note`;
}

function transferCanOpenPickSlip(transfer: any): boolean {
    return ['approved', 'packed', 'in_transit', 'received'].includes(String(transfer?.status ?? ''));
}

function transferCanOpenDispatchNote(transfer: any): boolean {
    return ['packed', 'in_transit', 'received'].includes(String(transfer?.status ?? ''));
}

function transferReceiptVarianceType(lineId: string): string {
    return transferStatusForm.receiptVarianceTypes[lineId] || 'full';
}

function transferReceiptVarianceNeedsDetails(lineId: string): boolean {
    return transferReceiptVarianceType(lineId) !== 'full';
}

function handleTransferReceiptVarianceTypeChange(line: any, value: string): void {
    const normalized = fromSelectValue(value) || 'full';

    transferStatusForm.receiptVarianceTypes[line.id] = normalized;

    if (normalized === 'full') {
        transferStatusForm.receiptVarianceQuantities[line.id] = '';
        transferStatusForm.receiptVarianceReasons[line.id] = '';
        transferStatusForm.receivedQuantities[line.id] = String(
            line.dispatched_quantity ?? line.requested_quantity ?? transferStatusForm.receivedQuantities[line.id] ?? '',
        );
        return;
    }

    if (normalized === 'excess') {
        transferStatusForm.receivedQuantities[line.id] = String(
            line.dispatched_quantity ?? line.requested_quantity ?? transferStatusForm.receivedQuantities[line.id] ?? '',
        );
    }
}

function openTransferPickSlip(transfer: any): void {
    if (!transferCanOpenPickSlip(transfer)) return;

    window.open(transferPickSlipUrl(transfer.id), '_blank', 'noopener,noreferrer');
}

function openTransferDispatchNote(transfer: any): void {
    if (!transferCanOpenDispatchNote(transfer)) return;

    window.open(transferDispatchNoteUrl(transfer.id), '_blank', 'noopener,noreferrer');
}

function transferVarianceReviewLines(transfer: any): any[] {
    return Array.isArray(transfer?.lines)
        ? transfer.lines.filter((line: any) => Number(line?.receiptVarianceQuantity ?? 0) > 0)
        : [];
}

function syncTransferVarianceReviewForm(transfer: any | null): void {
    transferVarianceReviewForm.reviewNotes = String(transfer?.varianceReview?.notes ?? '');
}

async function openTransferVarianceReviewDialog(transfer: any): Promise<void> {
    if (!transferCanOpenVarianceReview(transfer)) return;

    transferVarianceReviewForm.transferId = transfer.id;
    transferVarianceReviewErrors.value = {};
    transferVarianceReviewSelectedTransfer.value = transfer;
    syncTransferVarianceReviewForm(transfer);
    transferVarianceReviewDialogOpen.value = true;

    transferVarianceReviewLoading.value = true;
    try {
        const response = await apiRequest<{ data: any }>('GET', `/inventory-procurement/warehouse-transfers/${transfer.id}`);
        transferVarianceReviewSelectedTransfer.value = response.data ?? transfer;
        syncTransferVarianceReviewForm(transferVarianceReviewSelectedTransfer.value);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Failed to load the latest variance review details. Using the current list snapshot.'));
    } finally {
        transferVarianceReviewLoading.value = false;
    }
}

async function submitTransferVarianceReview(): Promise<void> {
    if (transferVarianceReviewSubmitting.value) return;

    transferVarianceReviewSubmitting.value = true;
    transferVarianceReviewErrors.value = {};

    try {
        await apiRequest('PATCH', `/inventory-procurement/warehouse-transfers/${transferVarianceReviewForm.transferId}/receipt-variance-review`, {
            body: {
                reviewStatus: 'reviewed',
                reviewNotes: transferVarianceReviewForm.reviewNotes.trim() || null,
            },
        });

        transferVarianceReviewDialogOpen.value = false;
        resetTransferVarianceReviewForm();
        notifySuccess('Receipt variance review saved.');
        await loadWarehouseTransfers();
    } catch (error) {
        transferVarianceReviewErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Failed to save the receipt variance review.'));
    } finally {
        transferVarianceReviewSubmitting.value = false;
    }
}

async function openTransferStatusDialog(t: any, newStatus: string) {
    transferStatusForm.transferId = t.id;
    transferStatusForm.currentStatus = t.status;
    transferStatusForm.newStatus = newStatus;
    transferStatusForm.rejectionReason = '';
    transferStatusForm.packNotes = '';
    transferStatusForm.receivingNotes = '';
    transferStatusForm.revalidateReservation = false;
    transferStatusForm.receiptVarianceTypes = {};
    transferStatusForm.receiptVarianceQuantities = {};
    transferStatusForm.receiptVarianceReasons = {};
    transferStatusErrors.value = {};
    transferStatusSelectedTransfer.value = t;
    syncTransferStatusQuantities(t, newStatus);
    transferStatusDialogOpen.value = true;

    transferStatusContextLoading.value = true;
    try {
        const response = await apiRequest<{ data: any }>('GET', `/inventory-procurement/warehouse-transfers/${t.id}`);
        transferStatusSelectedTransfer.value = response.data ?? t;
        syncTransferStatusQuantities(transferStatusSelectedTransfer.value, newStatus);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Failed to load the latest transfer details. Using the current list snapshot.'));
    } finally {
        transferStatusContextLoading.value = false;
    }
}

async function submitTransferStatusUpdate() {
    if (transferStatusSubmitting.value) return;
    transferStatusSubmitting.value = true;
    transferStatusErrors.value = {};
    try {
        await apiRequest('PATCH', `/inventory-procurement/warehouse-transfers/${transferStatusForm.transferId}/status`, {
            body: {
                status: transferStatusForm.newStatus,
                rejectionReason: transferStatusForm.rejectionReason || null,
                packNotes: transferStatusForm.newStatus === 'packed' ? (transferStatusForm.packNotes || null) : null,
                receivingNotes: transferStatusForm.newStatus === 'received' ? (transferStatusForm.receivingNotes || null) : null,
                revalidateReservation: (transferStatusForm.newStatus === 'packed' || transferStatusForm.newStatus === 'in_transit')
                    ? transferStatusForm.revalidateReservation
                    : false,
                packedQuantities: transferStatusForm.newStatus === 'packed'
                    ? Object.fromEntries(
                        Object.entries(transferStatusForm.packedQuantities)
                            .filter(([, value]) => String(value ?? '').trim() !== '')
                            .map(([lineId, value]) => [lineId, Number(value)]),
                    )
                    : null,
                dispatchedQuantities: transferStatusForm.newStatus === 'in_transit'
                    ? Object.fromEntries(
                        Object.entries(transferStatusForm.dispatchedQuantities)
                            .filter(([, value]) => String(value ?? '').trim() !== '')
                            .map(([lineId, value]) => [lineId, Number(value)]),
                    )
                    : null,
                receivedQuantities: transferStatusForm.newStatus === 'received'
                    ? Object.fromEntries(
                        Object.entries(transferStatusForm.receivedQuantities)
                            .filter(([, value]) => String(value ?? '').trim() !== '')
                            .map(([lineId, value]) => [lineId, Number(value)]),
                    )
                    : null,
                receiptVarianceTypes: transferStatusForm.newStatus === 'received'
                    ? Object.fromEntries(
                        Object.entries(transferStatusForm.receiptVarianceTypes)
                            .filter(([, value]) => String(value ?? '').trim() !== '')
                            .map(([lineId, value]) => [lineId, String(value)]),
                    )
                    : null,
                receiptVarianceQuantities: transferStatusForm.newStatus === 'received'
                    ? Object.fromEntries(
                        Object.entries(transferStatusForm.receiptVarianceQuantities)
                            .filter(([, value]) => String(value ?? '').trim() !== '')
                            .map(([lineId, value]) => [lineId, Number(value)]),
                    )
                    : null,
                receiptVarianceReasons: transferStatusForm.newStatus === 'received'
                    ? Object.fromEntries(
                        Object.entries(transferStatusForm.receiptVarianceReasons)
                            .filter(([, value]) => String(value ?? '').trim() !== '')
                            .map(([lineId, value]) => [lineId, String(value).trim()]),
                    )
                    : null,
            },
        });
        transferStatusDialogOpen.value = false;
        notifySuccess(`${transferActionLabel(transferStatusForm.newStatus)} completed.`);
        resetTransferStatusForm();
        await loadWarehouseTransfers();
    } catch (error: any) {
        transferStatusErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Failed to update transfer status.'));
    } finally { transferStatusSubmitting.value = false; }
}

function transferStatusBadgeClass(status: string): string {
    switch (status) {
        case 'draft': return 'bg-muted text-muted-foreground';
        case 'pending_approval': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        case 'packed': return 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200';
        case 'in_transit': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
        case 'received': return 'bg-green-600 text-white';
        case 'cancelled': return 'bg-muted text-muted-foreground line-through';
        case 'rejected': return 'bg-destructive text-destructive-foreground';
        default: return 'bg-muted text-muted-foreground';
    }
}

function transferPriorityBadge(priority: string): string {
    switch (priority) {
        case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
        case 'normal': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        case 'low': return 'bg-muted text-muted-foreground';
        default: return 'bg-muted text-muted-foreground';
    }
}

async function loadSuppliersAndWarehouses() {
    try {
        const [suppliersRes, warehousesRes, deptsRes, requisitionContextRes] = await Promise.all([
            apiRequest<{ data: any[] }>('GET', '/inventory-procurement/suppliers', { query: { perPage: 200 } })
                .catch(() => ({ data: [] })),
            apiRequest<{ data: any[] }>('GET', '/inventory-procurement/warehouses', { query: { perPage: 200 } })
                .catch(() => ({ data: [] })),
            canReadDepartments.value
                ? apiRequest<{ data: any[] }>('GET', '/departments', { query: { perPage: 200, status: 'active' } })
                    .catch(() => ({ data: [] }))
                : Promise.resolve({ data: [] }),
            apiRequest<{ data: DepartmentRequisitionContext }>('GET', '/inventory-procurement/department-requisitions/context')
                .catch(() => ({ data: { canSelectAnyDepartment: isFacilitySuperAdmin.value, lockedDepartment: null, staffDepartmentName: null, preferredWarehouseId: null, hasExplicitItemCatalog: false, departmentProfile: null } })),
        ]);
        suppliers.value = (suppliersRes.data ?? [])
            .map((supplier) => normalizeLookupOption(supplier, ['supplierName', 'name'], ['supplierCode', 'code']))
            .filter((supplier): supplier is LookupOption => supplier !== null);
        warehouses.value = (warehousesRes.data ?? [])
            .map((warehouse) => normalizeLookupOption(warehouse, ['warehouseName', 'name'], ['warehouseCode', 'code']))
            .filter((warehouse): warehouse is LookupOption => warehouse !== null);
        departments.value = (deptsRes.data ?? [])
                            .map((dept) => normalizeLookupOption(dept, ['name'], ['code']))
                            .filter((dept): dept is LookupOption => dept !== null);
        requisitionContext.value = requisitionContextRes.data ?? null;
        applyLockedRequisitionDepartment();
        applyLockedDepartmentFilters();
    } catch {
        suppliers.value = [];
        warehouses.value = [];
        departments.value = [];
        requisitionContext.value = null;
    } finally {
        referenceStructureLoaded.value = true;
    }
}

// --- Dispensing Claim Links (Feature 5: NHIF) ---
const claimLinks = ref<any[]>([]);
const claimLinkLoading = ref(false);
const claimLinkPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const claimLinkSearch = reactive({ q: '', claimStatus: '', page: 1, perPage: 15 });
const createClaimLinkDialogOpen = ref(false);
const claimLinkSubmitting = ref(false);
const claimLinkErrors = ref<Record<string, string[]>>({});
const claimLinkSelectedItem = ref<any | null>(null);
const claimLinkSelectedClaim = ref<any | null>(null);
const claimLinkSelectedInvoice = ref<any | null>(null);
const claimLinkForm = reactive({
    itemId: '', patientId: '', quantityDispensed: '', unit: '', unitCost: '',
    nhifCode: '', payerType: '', payerName: '', insuranceClaimId: '', billingInvoiceId: '', notes: '',
});

const CLAIM_STATUSES = [
    { value: 'pending', label: 'Pending' },
    { value: 'linked', label: 'Linked to Claim' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'partially_approved', label: 'Partially Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' },
] as const;

type ClaimLinkInventoryItemSelection = {
    unit?: string | null;
    dispensingUnit?: string | null;
    nhifCode?: string | null;
};

type ClaimLinkClaimsCaseSelection = {
    patientId?: string | null;
    invoiceId?: string | null;
    payerType?: string | null;
    payerName?: string | null;
};

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

function handleClaimLinkItemSelected(item: ClaimLinkInventoryItemSelection | null) {
    claimLinkSelectedItem.value = item;
    if (!item) return;

    if (!claimLinkForm.unit && (item.dispensingUnit || item.unit)) {
        claimLinkForm.unit = item.dispensingUnit || item.unit || '';
    }

    if (!claimLinkForm.nhifCode && item.nhifCode) {
        claimLinkForm.nhifCode = item.nhifCode;
    }
}

function handleClaimLinkClaimsCaseSelected(claim: ClaimLinkClaimsCaseSelection | null) {
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

const claimLinkContextStatusVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    if (claimLinkForm.insuranceClaimId.trim()) return 'default';
    if (claimLinkForm.billingInvoiceId.trim()) return 'secondary';
    if (claimLinkForm.itemId.trim() && claimLinkForm.patientId.trim()) return 'secondary';
    return 'outline';
});

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

// --- MSD E-Ordering (Feature 6) ---
const msdOrders = ref<any[]>([]);
const msdOrderLoading = ref(false);
const msdOrderPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const msdOrderSearch = reactive({ q: '', status: '', page: 1, perPage: 15 });
const createMsdOrderDialogOpen = ref(false);
const msdOrderSubmitting = ref(false);
const msdOrderErrors = ref<Record<string, string[]>>({});
const msdOrderForm = reactive({
    facilityMsdCode: '', orderDate: '', expectedDeliveryDate: '',
    notes: '', submitImmediately: false,
    lines: [{ msdCode: '', itemName: '', quantity: '', unit: '', unitCost: '' }] as Array<{ msdCode: string; itemName: string; quantity: string; unit: string; unitCost: string }>,
});

type MsdDraftLine = { msdCode: string; itemName: string; quantity: string; unit: string; unitCost: string; source: string };

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

function numericInventoryValue(value: unknown, fallback = 0): number {
    const numeric = Number(value ?? fallback);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function msdCodeForItem(item: Record<string, unknown> | null | undefined): string {
    return String(item?.msdCode ?? item?.msd_code ?? '').trim();
}

function msdDraftQuantityForItem(item: Record<string, unknown>): number {
    const currentStock = numericInventoryValue(item.currentStock);
    const reorderLevel = numericInventoryValue(item.reorderLevel);
    const maxStockLevel = numericInventoryValue(item.maxStockLevel);

    if (maxStockLevel > currentStock) return Math.max(maxStockLevel - currentStock, 1);
    if (reorderLevel > 0) return Math.max(reorderLevel * 2 - currentStock, reorderLevel, 1);

    return Math.max(1 - currentStock, 1);
}

const lowStockMsdDraftLines = computed<MsdDraftLine[]>(() => items.value
    .filter((item) => ['out_of_stock', 'low_stock'].includes(String(item.stockState ?? '')))
    .map((item) => ({
        msdCode: msdCodeForItem(item),
        itemName: String(item.itemName ?? item.name ?? ''),
        quantity: String(msdDraftQuantityForItem(item)),
        unit: String(item.unit ?? 'units'),
        unitCost: '',
        source: stockStateLabel(String(item.stockState ?? 'low_stock')),
    }))
    .filter((line) => line.msdCode !== '' && line.itemName !== '')
    .slice(0, 12));

const shortageMsdDraftLines = computed<MsdDraftLine[]>(() => shortageQueueItems.value
    .flatMap((req) => (req.lines ?? [])
        .filter((line: any) => !line.canIssueNow)
        .map((line: any) => {
            const item = items.value.find((entry) => entry.id === line.itemId) ?? null;
            const shortageQuantity = Math.max(
                numericInventoryValue(line.shortageQuantity, requisitionLineShortageQuantity(line)),
                1,
            );

            return {
                msdCode: msdCodeForItem(item ?? line),
                itemName: String(line.itemName ?? item?.itemName ?? item?.name ?? ''),
                quantity: String(shortageQuantity),
                unit: String(line.unit ?? item?.unit ?? 'units'),
                unitCost: '',
                source: `${req.requisitionNumber ?? 'Shortage'}${req.requestingDepartment ? ` | ${req.requestingDepartment}` : ''}`,
            };
        }))
    .filter((line) => line.msdCode !== '' && line.itemName !== '')
    .slice(0, 12));

const procurementAwaitingReceiptCount = computed(() => procurementRequests.value.filter((request) => String(request.status ?? '') === 'ordered').length);
const procurementNeedsActionCount = computed(() => procurementRequests.value.filter((request) => ['pending_approval', 'approved', 'ordered'].includes(String(request.status ?? ''))).length);
const requisitionsReadyCount = computed(() => shortageQueueMeta.value?.readyLineCount ?? 0);
const requisitionsWaitingCount = computed(() => shortageQueueMeta.value?.waitingLineCount ?? 0);
const stockAlertCount = computed(() => Number(itemCounts.value.outOfStock ?? 0) + Number(itemCounts.value.lowStock ?? 0));
const msdDraftSignalCount = computed(() => shortageMsdDraftLines.value.length + lowStockMsdDraftLines.value.length);
const departmentRequisitionTotal = computed(() => deptReqPagination.value?.total ?? deptRequisitions.value.length);

const workspaceNextActions = computed<WorkspaceNextAction[]>(() => {
    const actions: WorkspaceNextAction[] = [
        {
            key: 'ready-requisitions',
            label: 'Ready to issue',
            value: requisitionsReadyCount.value,
            helper: 'Approved department lines with stock available now.',
            icon: 'clipboard-list',
            tone: requisitionsReadyCount.value > 0 ? 'success' : 'neutral',
            target: 'shortage-queue',
        },
        {
            key: 'awaiting-receipt',
            label: 'Awaiting receipt',
            value: procurementAwaitingReceiptCount.value,
            helper: 'Purchase orders ready for physical goods receipt.',
            icon: 'package',
            tone: procurementAwaitingReceiptCount.value > 0 ? 'warning' : 'neutral',
            target: 'procurement',
        },
        {
            key: 'stock-alerts',
            label: 'Stock alerts',
            value: stockAlertCount.value,
            helper: 'Store items currently out or below reorder level.',
            icon: 'alert-triangle',
            tone: stockAlertCount.value > 0 ? 'danger' : 'neutral',
            target: 'inventory',
        },
        {
            key: 'msd-drafts',
            label: 'MSD draft signals',
            value: msdDraftSignalCount.value,
            helper: 'Shortage or low-stock lines with known MSD codes.',
            icon: 'package',
            tone: msdDraftSignalCount.value > 0 ? 'warning' : 'neutral',
            target: 'msd-orders',
        },
    ];

    return actions.filter((action) => workspaceTabVisible(action.target));
});

const requestPipelineStages = computed<RequestPipelineStage[]>(() => [
    {
        key: 'submitted',
        label: 'Submitted',
        value: requestPipelineCounts.value.submitted,
        helper: 'Departments waiting for store review.',
        icon: 'clipboard-list',
        target: 'requisitions',
        status: 'submitted',
        kind: 'requisition',
    },
    {
        key: 'approved',
        label: 'Approved',
        value: requestPipelineCounts.value.approved,
        helper: 'Ready for stock issue decision.',
        icon: 'check-circle',
        target: 'requisitions',
        status: 'approved',
        kind: 'requisition',
    },
    {
        key: 'shortage',
        label: 'Shortage',
        value: requestPipelineCounts.value.partiallyIssued + requestPipelineCounts.value.shortageWaiting,
        helper: 'Approved demand not fully issued.',
        icon: 'alert-triangle',
        target: 'shortage-queue',
        readiness: 'all',
        kind: 'shortage',
    },
    {
        key: 'procurement',
        label: 'In procurement',
        value: requestPipelineCounts.value.procurementPending + requestPipelineCounts.value.procurementApproved,
        helper: 'Needs approval or purchase order.',
        icon: 'package',
        target: 'procurement',
        status: 'pending_approval',
        kind: 'procurement',
    },
    {
        key: 'ordered',
        label: 'Ordered',
        value: requestPipelineCounts.value.procurementOrdered,
        helper: 'Waiting for supplier/MSD delivery.',
        icon: 'truck',
        target: 'procurement',
        status: 'ordered',
        kind: 'procurement',
    },
    {
        key: 'received',
        label: 'Received',
        value: requestPipelineCounts.value.procurementReceived,
        helper: 'Stock received; complete linked issues.',
        icon: 'archive',
        target: 'procurement',
        status: 'received',
        kind: 'procurement',
    },
    {
        key: 'issued',
        label: 'Issued',
        value: requestPipelineCounts.value.issued,
        helper: 'Departments have received items.',
        icon: 'check-circle',
        target: 'requisitions',
        status: 'issued',
        kind: 'requisition',
    },
]);

function openRequestPipelineStage(stage: RequestPipelineStage): void {
    if (stage.kind === 'requisition') {
        deptReqSearch.status = stage.status ?? '';
        deptReqSearch.page = 1;
        void loadDeptRequisitions();
    } else if (stage.kind === 'shortage') {
        shortageQueueFilters.readiness = stage.readiness ?? 'all';
        shortageQueueFilters.page = 1;
        void loadShortageQueue();
    } else if (stage.kind === 'procurement') {
        procurementSearch.status = stage.status ?? '';
        procurementSearch.page = 1;
        void loadProcurementRequests();
    }

    onTabChange(stage.target);
}

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

async function syncMsdOrderStatus(orderId: string) {
    try {
        await apiRequest('PATCH', `/inventory-procurement/msd-orders/${orderId}/sync-status`);
        notifySuccess('MSD order status synced.');
        await loadMsdOrders();
    } catch (error: any) {
        notifyError(messageFromUnknown(error, 'Failed to sync MSD order status.'));
    }
}

// --- Barcode Scanner (Feature 7) ---
const barcodeScannerOpen = ref(false);
const barcodeInput = ref('');
const barcodeLookupResult = ref<any | null>(null);
const barcodeLookupError = ref('');
const barcodeLookupLoading = ref(false);

async function lookupBarcode() {
    if (!barcodeInput.value.trim()) return;
    barcodeLookupLoading.value = true;
    barcodeLookupError.value = '';
    barcodeLookupResult.value = null;
    try {
        const response = await apiRequest<{ data: any }>('GET', '/inventory-procurement/barcode-lookup', { query: { barcode: barcodeInput.value.trim() } });
        barcodeLookupResult.value = response.data ?? null;
        if (!response.data) barcodeLookupError.value = 'No item found for this barcode.';
    } catch {
        barcodeLookupError.value = 'No item found for this barcode.';
    } finally { barcodeLookupLoading.value = false; }
}

function onBarcodeKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); lookupBarcode(); }
}

// --- Analytics (Feature 8) ---
const analyticsLoading = ref(false);
const consumptionTrends = ref<any[]>([]);
const consumptionGranularity = ref('daily');
const consumptionDays = ref(30);
const abcVenMatrix = ref<any[]>([]);
const abcVenTopItems = ref<any[]>([]);
const expiryWastage = ref<{ summary: any; expired: any[]; critical: any[]; warning: any[] } | null>(null);
const stockTurnover = ref<any[]>([]);

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
        abcVenTopItems.value = response.topItems ?? [];
    } catch { abcVenMatrix.value = []; abcVenTopItems.value = []; }
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

const loadedWorkspaceTabs = new Set<InventoryWorkspaceTab>();

function setWorkspaceTabLoading(tab: InventoryWorkspaceTab, isLoading: boolean): void {
    switch (tab) {
        case 'inventory':
        case 'procurement':
        case 'overview':
            loading.value = isLoading;
            break;
        case 'ledger':
            stockLedgerLoading.value = isLoading;
            break;
        case 'department-stock':
            departmentStockLoading.value = isLoading;
            break;
        case 'requisitions':
            deptReqLoading.value = isLoading;
            break;
        case 'shortage-queue':
            shortageQueueLoading.value = isLoading;
            break;
        case 'lead-times':
            leadTimeLoading.value = isLoading;
            break;
        case 'transfers':
            transferLoading.value = isLoading;
            break;
        case 'claims':
            claimLinkLoading.value = isLoading;
            break;
        case 'msd-orders':
            msdOrderLoading.value = isLoading;
            break;
        case 'analytics':
            analyticsLoading.value = isLoading;
            break;
    }
}

async function loadActiveWorkspaceTab(tab: InventoryWorkspaceTab = activeTab.value, options: { force?: boolean } = {}): Promise<void> {
    if (!canRead.value) return;
    if (!options.force && loadedWorkspaceTabs.has(tab)) return;

    setWorkspaceTabLoading(tab, true);
    try {
    switch (tab) {
        case 'overview':
            await Promise.all([loadItems(), loadProcurementRequests(), loadActiveProcurementRequests(), loadDeptRequisitions(), loadShortageQueue(), loadRequestPipelineCounts()]);
            break;
        case 'inventory':
            await Promise.all([loadItems(), loadSuppliersAndWarehouses(), loadActiveProcurementRequests()]);
            break;
        case 'procurement':
            await Promise.all([loadProcurementRequests(), loadSuppliersAndWarehouses(), loadItems(), loadActiveProcurementRequests()]);
            break;
        case 'ledger':
            await loadStockLedger();
            break;
        case 'department-stock':
            await loadDepartmentStock();
            break;
        case 'requisitions':
            await Promise.all([loadDeptRequisitions(), loadSuppliersAndWarehouses()]);
            break;
        case 'shortage-queue':
            await loadShortageQueue();
            break;
        case 'lead-times':
            await Promise.all([loadSuppliersAndWarehouses(), loadLeadTimes()]);
            break;
        case 'transfers':
            await Promise.all([loadWarehouseTransfers(), loadSuppliersAndWarehouses()]);
            break;
        case 'claims':
            await loadClaimLinks();
            break;
        case 'msd-orders':
            await Promise.all([loadMsdOrders(), loadShortageQueue(), loadItems()]);
            break;
        case 'analytics':
            await loadAllAnalytics();
            break;
    }

    loadedWorkspaceTabs.add(tab);
    } finally {
        setWorkspaceTabLoading(tab, false);
    }
}

// Prefetch data when user hovers over or clicks a tab
async function prefetchTab(tab: InventoryWorkspaceTab): Promise<void> {
    if (!canRead.value || loadedWorkspaceTabs.has(tab)) return;
    // Silently load in background without blocking UI
    try {
        switch (tab) {
            case 'procurement':
                await Promise.all([loadProcurementRequests(), loadSuppliersAndWarehouses(), loadItems(), loadActiveProcurementRequests()]);
                break;
            case 'inventory':
                await Promise.all([loadItems(), loadSuppliersAndWarehouses(), loadActiveProcurementRequests()]);
                break;
            case 'requisitions':
                await Promise.all([loadDeptRequisitions(), loadSuppliersAndWarehouses()]);
                break;
            case 'shortage-queue':
                await loadShortageQueue();
                break;
            case 'transfers':
                await Promise.all([loadWarehouseTransfers(), loadSuppliersAndWarehouses()]);
                break;
            case 'ledger':
                await loadStockLedger();
                break;
            case 'department-stock':
                await loadDepartmentStock();
                break;
            case 'msd-orders':
                await Promise.all([loadMsdOrders(), loadShortageQueue(), loadItems()]);
                break;
            case 'lead-times':
                await Promise.all([loadSuppliersAndWarehouses(), loadLeadTimes()]);
                break;
            case 'analytics':
                await loadAllAnalytics();
                break;
            case 'claims':
                await loadClaimLinks();
                break;
            case 'overview':
                await Promise.all([loadItems(), loadProcurementRequests(), loadActiveProcurementRequests(), loadDeptRequisitions(), loadShortageQueue(), loadRequestPipelineCounts()]);
                break;
        }
        loadedWorkspaceTabs.add(tab);
    } catch {
        // Silently fail - prefetch is non-blocking
    }
}

// Debounce prefetch to avoid excessive calls
let prefetchTimeout: ReturnType<typeof setTimeout> | null = null;
function debouncedPrefetch(tab: InventoryWorkspaceTab): void {
    if (prefetchTimeout) clearTimeout(prefetchTimeout);
    prefetchTimeout = setTimeout(() => {
        void prefetchTab(tab);
    }, 300);
}

async function reloadAll() {
    if (!canRead.value) {
        loading.value = false;
        return;
    }
    loading.value = true;
    queueError.value = null;
    try {
        await loadReferenceData();
        await loadActiveWorkspaceTab(activeTab.value, { force: true });
    } catch (error) {
        queueError.value = messageFromUnknown(error, 'Unable to load inventory/procurement data.');
    } finally {
        loading.value = false;
    }
}

async function refreshInventoryItems(): Promise<void> {
    if (!canRead.value || loading.value) return;
    loading.value = true;
    queueError.value = null;
    try {
        await loadActiveWorkspaceTab('inventory', { force: true });
    } catch (error) {
        queueError.value = messageFromUnknown(error, 'Unable to load inventory items.');
    } finally {
        loading.value = false;
    }
}

function scheduleInventorySearchRefresh(): void {
    if (inventorySearchTimer) {
        clearTimeout(inventorySearchTimer);
    }

    inventorySearchTimer = setTimeout(() => {
        inventorySearchTimer = null;
        if (!canRead.value || activeTab.value !== 'inventory') return;

        itemSearch.page = 1;
        void refreshInventoryItems();
    }, 180);
}

function flushInventorySearch(): void {
    if (inventorySearchTimer) {
        clearTimeout(inventorySearchTimer);
        inventorySearchTimer = null;
    }
    if (!canRead.value || activeTab.value !== 'inventory') return;
    itemSearch.page = 1;
    void refreshInventoryItems();
}

watch(() => itemSearch.q, (newQuery, previousQuery) => {
    if (newQuery === previousQuery) return;

    scheduleInventorySearchRefresh();
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

function toNumericFormValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(numeric) : '';
}

function hydrateItemForms(item: any) {
    itemUpdateForm.clinicalCatalogItemId = item?.clinicalCatalogItemId ?? '';
    itemUpdateForm.itemCode = item?.itemCode ?? '';
    itemUpdateForm.itemName = item?.itemName ?? '';
    itemUpdateForm.genericName = item?.genericName ?? '';
    itemUpdateForm.dosageForm = item?.dosageForm ?? '';
    itemUpdateForm.strength = item?.strength ?? '';
    itemUpdateForm.category = item?.category ?? '';
    itemUpdateForm.subcategory = item?.subcategory ?? '';
    itemUpdateForm.venClassification = item?.venClassification ?? '';
    itemUpdateForm.abcClassification = item?.abcClassification ?? '';
    itemUpdateForm.unit = item?.unit ?? '';
    itemUpdateForm.dispensingUnit = item?.dispensingUnit ?? '';
    itemUpdateForm.conversionFactor = toNumericFormValue(item?.conversionFactor);
    itemUpdateForm.binLocation = item?.binLocation ?? '';
    itemUpdateForm.manufacturer = item?.manufacturer ?? '';
    itemUpdateForm.storageConditions = item?.storageConditions ?? '';
    itemUpdateForm.requiresColdChain = item?.requiresColdChain ?? false;
    itemUpdateForm.isControlledSubstance = item?.isControlledSubstance ?? false;
    itemUpdateForm.controlledSubstanceSchedule = item?.controlledSubstanceSchedule ?? '';
    itemUpdateForm.msdCode = item?.msdCode ?? '';
    itemUpdateForm.nhifCode = item?.nhifCode ?? '';
    itemUpdateForm.barcode = item?.barcode ?? '';
    itemUpdateForm.reorderLevel = toNumericFormValue(item?.reorderLevel);
    itemUpdateForm.maxStockLevel = toNumericFormValue(item?.maxStockLevel);
    itemUpdateForm.defaultWarehouseId = item?.defaultWarehouseId ?? '';
    itemUpdateForm.defaultSupplierId = item?.defaultSupplierId ?? '';
    applyItemCategoryRules(itemUpdateForm);
    itemStatusForm.status = item?.status === 'inactive' ? 'inactive' : 'active';
    itemStatusForm.reason = item?.statusReason ?? '';
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

let pendingItemDetailsCloseAction: (() => void) | null = null;

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
    if (open) {
        itemDetailsOpen.value = true;
        return;
    }

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
        if (canViewAudit.value) {
            await loadItemAuditLogs();
        }
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
            body: {
                status: itemStatusForm.status,
                reason: itemStatusForm.reason.trim() || null,
            },
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
        if (canViewAudit.value) {
            await loadItemAuditLogs();
        }
    } catch (error) {
        itemStatusError.value = messageFromUnknown(error, 'Unable to update item status.');
        notifyError(itemStatusError.value);
    } finally {
        itemStatusSubmitting.value = false;
    }
}

function applyItemAuditFilters() {
    itemAuditFilters.page = 1;
    void loadItemAuditLogs();
}

function resetItemAuditFilters() {
    itemAuditFilters.q = '';
    itemAuditFilters.action = '';
    itemAuditFilters.actorType = '';
    itemAuditFilters.actorId = '';
    itemAuditFilters.from = '';
    itemAuditFilters.to = '';
    itemAuditFilters.page = 1;
    itemAuditFilters.perPage = 20;
    void loadItemAuditLogs();
}

function goToItemAuditPage(page: number) {
    itemAuditFilters.page = Math.max(page, 1);
    void loadItemAuditLogs();
}

async function exportItemAuditLogsCsv() {
    if (!itemDetails.value || !canViewAudit.value || itemAuditExporting.value) {
        return;
    }

    itemAuditExporting.value = true;
    try {
        const url = new URL(
            `/api/v1/inventory-procurement/items/${itemDetails.value.id}/audit-logs/export`,
            window.location.origin,
        );
        Object.entries(itemAuditQuery()).forEach(([key, value]) => {
            if (value === null || value === '') return;
            if (key === 'page' || key === 'perPage') return;
            url.searchParams.set(key, String(value));
        });
        window.open(url.toString(), '_blank', 'noopener');
    } finally {
        itemAuditExporting.value = false;
    }
}

function requiresAdjustmentDirection(): boolean {
    return stockMovementForm.movementType === 'adjust';
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

function resetProcurementForm() {
    selectedProcurementItem.value = null;
    procurementForm.itemId = '';
    procurementForm.itemName = '';
    procurementForm.category = '';
    procurementForm.unit = '';
    procurementForm.reorderLevel = '';
    procurementForm.requestedQuantity = '';
    procurementForm.unitCostEstimate = '';
    procurementForm.neededBy = '';
    procurementForm.supplierId = '';
    procurementForm.sourceDepartmentRequisitionId = '';
    procurementForm.sourceDepartmentRequisitionLineId = '';
    procurementForm.sourceSummary = '';
    procurementForm.notes = '';
}

function openProcurementFromShortage(req: any | null, line: any): void {
    if (!req || !canCreateProcurementFromRequisitionLine(line, req)) return;

    const item = items.value.find((entry) => entry.id === line.itemId) ?? null;
    const shortageQuantity = requisitionLineShortageQuantity(line);
    resetProcurementForm();
    procurementErrors.value = {};
    procurementForm.itemId = String(line.itemId ?? '');
    procurementForm.itemName = String(line.itemName ?? item?.itemName ?? '');
    procurementForm.category = String(line.itemCategory ?? item?.category ?? '');
    procurementForm.unit = String(line.unit ?? item?.unit ?? '');
    procurementForm.reorderLevel = item?.reorderLevel != null ? String(item.reorderLevel) : '';
    procurementForm.requestedQuantity = String(shortageQuantity);
    procurementForm.neededBy = req.neededBy ? String(req.neededBy).split('T')[0] : '';
    procurementForm.supplierId = item?.defaultSupplierId ?? '';
    procurementForm.sourceDepartmentRequisitionId = String(req.id ?? '');
    procurementForm.sourceDepartmentRequisitionLineId = String(line.id ?? '');
    procurementForm.sourceSummary = `${req.requisitionNumber ?? 'Department requisition'} | ${req.requestingDepartment ?? 'Department'} | ${requisitionLineItemLabel(line)}`;
    procurementForm.notes = [
        `Shortage raised from ${req.requisitionNumber ?? 'department requisition'} for ${req.requestingDepartment ?? 'department'}.`,
        `Approved ${formatAmount(requisitionApprovedDecisionQuantity(line))} ${line?.unit ?? ''}; issued ${formatAmount(requisitionIssuedDecisionQuantity(line))} ${line?.unit ?? ''}; shortage ${formatAmount(shortageQuantity)} ${line?.unit ?? ''}.`,
    ].join('\n');
    selectedProcurementItem.value = {
        id: String(line.itemId ?? ''),
        itemCode: item?.itemCode ?? line.itemCode ?? null,
        itemName: String(line.itemName ?? item?.itemName ?? ''),
        category: String(line.itemCategory ?? item?.category ?? ''),
        unit: String(line.unit ?? item?.unit ?? ''),
        reorderLevel: item?.reorderLevel ?? line.reorderLevel ?? null,
        currentStock: item?.currentStock ?? null,
    };
    void loadActiveProcurementRequests();
    createProcurementDialogOpen.value = true;
}

function openProcurementFromRequisitionShortage(line: any): void {
    openProcurementFromShortage(selectedRequisition.value, line);
}

function openProcurementFromQueueShortage(req: any, line: any): void {
    openProcurementFromShortage(req, line);
}

async function submitProcurementRequest() {
    if (!canCreateRequest.value || procurementSubmitDisabled.value) return;

    if (!procurementForm.itemId.trim()) {
        procurementErrors.value = { itemId: ['Select an inventory item from master data.'] };
        notifyError('Select an inventory item before creating a procurement request.');
        return;
    }

    procurementSubmitting.value = true;
    procurementErrors.value = {};
    try {
        await apiRequest('POST', '/inventory-procurement/procurement-requests', {
            body: {
                itemId: procurementForm.itemId.trim(),
                requestedQuantity: Number(procurementForm.requestedQuantity),
                unitCostEstimate: procurementForm.unitCostEstimate.trim() === '' ? null : Number(procurementForm.unitCostEstimate),
                neededBy: procurementForm.neededBy || null,
                supplierId: procurementForm.supplierId.trim() || null,
                sourceDepartmentRequisitionId: procurementForm.sourceDepartmentRequisitionId.trim() || null,
                sourceDepartmentRequisitionLineId: procurementForm.sourceDepartmentRequisitionLineId.trim() || null,
                notes: procurementForm.notes.trim() || null,
            },
        });
        notifySuccess('Procurement request created.');
        createProcurementDialogOpen.value = false;
        resetProcurementForm();
        await reloadAll();
    } catch (error) {
        procurementErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to create procurement request.'));
    } finally {
        procurementSubmitting.value = false;
    }
}

function openStatusDialog(request: any, status: string) {
    statusRequest.value = request;
    statusValue.value = status;
    statusReason.value = '';
    statusError.value = null;
    statusDialogOpen.value = true;
}

async function submitStatusUpdate() {
    if (!statusRequest.value || !canUpdateRequestStatus.value || statusSubmitting.value) return;
    statusSubmitting.value = true;
    statusError.value = null;
    try {
        await apiRequest('PATCH', `/inventory-procurement/procurement-requests/${statusRequest.value.id}/status`, {
            body: {
                status: statusValue.value,
                reason: statusReason.value.trim() || null,
            },
        });
        statusDialogOpen.value = false;
        notifySuccess('Procurement request status updated.');
        flashRequest(statusRequest.value.id);
        await loadProcurementRequests();
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update status.');
        notifyError(statusError.value);
    } finally {
        statusSubmitting.value = false;
    }
}

function openPlaceOrderDialog(request: any) {
    placeOrderRequest.value = request;
    placeOrderError.value = null;
    placeOrderErrors.value = {};
    placeOrderForm.purchaseOrderNumber = request?.purchaseOrderNumber ?? '';
    placeOrderForm.orderedQuantity = String(request?.orderedQuantity ?? request?.requestedQuantity ?? '');
    placeOrderForm.unitCostEstimate = request?.unitCostEstimate !== null && request?.unitCostEstimate !== undefined
        ? String(request.unitCostEstimate)
        : '';
    placeOrderForm.neededBy = request?.neededBy ?? '';
    placeOrderForm.supplierId = request?.supplierId ?? '';
    placeOrderForm.notes = request?.notes ?? '';
    placeOrderDialogOpen.value = true;
}

async function submitPlaceOrder() {
    if (!placeOrderRequest.value || !canUpdateRequestStatus.value || placeOrderSubmitting.value) return;
    placeOrderSubmitting.value = true;
    placeOrderError.value = null;
    placeOrderErrors.value = {};
    try {
        await apiRequest('POST', `/inventory-procurement/procurement-requests/${placeOrderRequest.value.id}/place-order`, {
            body: {
                purchaseOrderNumber: placeOrderForm.purchaseOrderNumber.trim(),
                orderedQuantity: Number(placeOrderForm.orderedQuantity),
                unitCostEstimate: placeOrderForm.unitCostEstimate.trim() === '' ? null : Number(placeOrderForm.unitCostEstimate),
                neededBy: placeOrderForm.neededBy || null,
                supplierId: placeOrderForm.supplierId.trim() || null,
                notes: placeOrderForm.notes.trim() || null,
            },
        });
        placeOrderDialogOpen.value = false;
        notifySuccess('Purchase order placed.');
        flashRequest(placeOrderRequest.value.id);
        await reloadAll();
    } catch (error) {
        placeOrderErrors.value = (error as ApiError).payload?.errors ?? {};
        placeOrderError.value = messageFromUnknown(error, 'Unable to place purchase order.');
        notifyError(placeOrderError.value);
    } finally {
        placeOrderSubmitting.value = false;
    }
}

function openReceiveDialog(request: any) {
    receiveRequest.value = request;
    receiveError.value = null;
    receiveErrors.value = {};
    receiveForm.receivedQuantity = String(request?.orderedQuantity ?? request?.requestedQuantity ?? '');
    receiveForm.receivedUnitCost = request?.unitCostEstimate !== null && request?.unitCostEstimate !== undefined
        ? String(request.unitCostEstimate)
        : '';
    receiveForm.warehouseId = request?.receivingWarehouseId ?? '';
    receiveForm.batchNumber = '';
    receiveForm.lotNumber = '';
    receiveForm.manufactureDate = '';
    receiveForm.expiryDate = '';
    receiveForm.binLocation = '';
    receiveForm.reason = '';
    receiveForm.notes = request?.receivingNotes ?? '';
    receiveForm.occurredAt = '';
    receiveDialogOpen.value = true;
}

async function submitReceiveGoods() {
    if (!receiveRequest.value || !canUpdateRequestStatus.value || !canCreateMovement.value || receiveSubmitting.value) return;
    receiveSubmitting.value = true;
    receiveError.value = null;
    receiveErrors.value = {};
    try {
        const receiveResponse = await apiRequest<{
            data: any;
            meta?: { replenishment?: { itemId: string | null; pendingLineCount: number } };
        }>('POST', `/inventory-procurement/procurement-requests/${receiveRequest.value.id}/receive`, {
            body: {
                receivedQuantity: Number(receiveForm.receivedQuantity),
                receivedUnitCost: receiveForm.receivedUnitCost.trim() === '' ? null : Number(receiveForm.receivedUnitCost),
                warehouseId: receiveForm.warehouseId.trim() || null,
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
        receiveDialogOpen.value = false;
        const replenishment = receiveResponse.meta?.replenishment ?? null;
        const pendingCount = replenishment?.pendingLineCount ?? 0;
        if (pendingCount > 0) {
            shortageQueueReplenishmentBanner.value = replenishment;
            notifySuccess(`Goods received. ${pendingCount} shortage line${pendingCount === 1 ? '' : 's'} for this item can now be reviewed in Shortages.`);
        } else {
            notifySuccess(receiveRequest.value.sourceDepartmentRequisitionId
                ? 'Goods received into store. Source requisition can now be completed if stock is sufficient.'
                : 'Goods received and stock updated.');
        }
        flashRequest(receiveRequest.value.id);
        await reloadAll();
    } catch (error) {
        receiveErrors.value = (error as ApiError).payload?.errors ?? {};
        receiveError.value = messageFromUnknown(error, 'Unable to receive goods.');
        notifyError(receiveError.value);
    } finally {
        receiveSubmitting.value = false;
    }
}

async function openDetails(request: any) {
    detailsRequest.value = request;
    detailsOpen.value = true;
    detailsAuditLogs.value = [];
    detailsAuditError.value = null;
    detailsAuditMeta.value = null;
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    if (!canViewAudit.value) return;
    await loadDetailsAuditLogs();
}

function detailsAuditQuery() {
    return {
        q: detailsAuditFilters.q.trim() || null,
        action: detailsAuditFilters.action.trim() || null,
        actorType: detailsAuditFilters.actorType || null,
        actorId: detailsAuditFilters.actorId.trim() || null,
        from: detailsAuditFilters.from || null,
        to: detailsAuditFilters.to || null,
        page: detailsAuditFilters.page,
        perPage: detailsAuditFilters.perPage,
    };
}

function auditActorLabel(log: any): string {
    return log?.actorId === null || log?.actorId === undefined
        ? 'System'
        : `User #${log.actorId}`;
}

async function loadDetailsAuditLogs() {
    if (!canViewAudit.value || !detailsRequest.value) return;
    detailsAuditLoading.value = true;
    detailsAuditError.value = null;
    try {
        const response = await apiRequest<{
            data: any[];
            meta?: { currentPage?: number; lastPage?: number; total?: number; perPage?: number };
        }>('GET', `/inventory-procurement/procurement-requests/${detailsRequest.value.id}/audit-logs`, {
            query: detailsAuditQuery(),
        });
        detailsAuditLogs.value = response.data ?? [];
        detailsAuditMeta.value = {
            currentPage: response.meta?.currentPage ?? detailsAuditFilters.page,
            lastPage: response.meta?.lastPage ?? 1,
            total: response.meta?.total ?? detailsAuditLogs.value.length,
            perPage: response.meta?.perPage ?? detailsAuditFilters.perPage,
        };
    } catch (error) {
        detailsAuditError.value = messageFromUnknown(error, 'Unable to load request audit logs.');
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
    } finally {
        detailsAuditLoading.value = false;
    }
}

function applyDetailsAuditFilters() {
    detailsAuditFilters.page = 1;
    void loadDetailsAuditLogs();
}

function resetDetailsAuditFilters() {
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    void loadDetailsAuditLogs();
}

function goToDetailsAuditPage(page: number) {
    detailsAuditFilters.page = Math.max(page, 1);
    void loadDetailsAuditLogs();
}

async function exportDetailsAuditLogsCsv() {
    if (!detailsRequest.value || !canViewAudit.value || detailsAuditExporting.value) {
        return;
    }

    detailsAuditExporting.value = true;
    try {
        const url = new URL(
            `/api/v1/inventory-procurement/procurement-requests/${detailsRequest.value.id}/audit-logs/export`,
            window.location.origin,
        );
        Object.entries(detailsAuditQuery()).forEach(([key, value]) => {
            if (value === null || value === '') return;
            if (key === 'page' || key === 'perPage') return;
            url.searchParams.set(key, String(value));
        });
        window.open(url.toString(), '_blank', 'noopener');
    } finally {
        detailsAuditExporting.value = false;
    }
}

// --- Flash helpers ---
function flashItem(itemId: string) {
    if (flashedItemTimer) clearTimeout(flashedItemTimer);
    flashedItemId.value = itemId;
    flashedItemTimer = setTimeout(() => { flashedItemId.value = null; flashedItemTimer = null; }, 1500);
}
function flashRequest(requestId: string) {
    if (flashedRequestTimer) clearTimeout(flashedRequestTimer);
    flashedRequestId.value = requestId;
    flashedRequestTimer = setTimeout(() => { flashedRequestId.value = null; flashedRequestTimer = null; }, 1500);
}

// --- Stock alert color classes ---
function stockAlertBadgeClass(state: string): string {
    if (state === 'out_of_stock') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300';
    if (state === 'low_stock') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300';
    if (state === 'healthy') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
    return '';
}

function stockStateDotClass(state: string | null | undefined): string {
    if (state === 'out_of_stock') return 'bg-rose-500';
    if (state === 'low_stock') return 'bg-amber-500';
    if (state === 'healthy') return 'bg-emerald-500';

    return 'bg-muted-foreground/40';
}

function stockStateLabel(state: string | null | undefined): string {
    if (state === 'out_of_stock') return 'Store out';
    if (state === 'low_stock') return 'Store low';
    if (state === 'healthy') return 'Store healthy';

    return formatEnumLabel(state || 'n/a');
}

function stockAlertCountClass(key: 'outOfStock' | 'lowStock' | 'healthy' | 'total'): string {
    if (key === 'outOfStock') return 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950';
    if (key === 'lowStock') return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950';
    if (key === 'healthy') return 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950';
    return '';
}

// --- Procurement row action helpers ---
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

// --- Pagination computeds ---
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
const procurementPages = computed(() => buildPageList(procurementPagination.value?.currentPage ?? 1, procurementPagination.value?.lastPage ?? 1));
const stockLedgerPages = computed(() => buildPageList(stockMovementPagination.value?.currentPage ?? 1, stockMovementPagination.value?.lastPage ?? 1));
const departmentStockPages = computed(() => buildPageList(departmentStockPagination.value?.currentPage ?? 1, departmentStockPagination.value?.lastPage ?? 1));

function goToItemPage(page: number) {
    const last = itemPagination.value?.lastPage ?? 1;
    const target = Math.max(1, Math.min(page, last));
    if (target === (itemPagination.value?.currentPage ?? 1)) return;
    itemSearch.page = target;
    void refreshInventoryItems();
}

function goToProcurementPage(page: number) {
    const last = procurementPagination.value?.lastPage ?? 1;
    const target = Math.max(1, Math.min(page, last));
    if (target === (procurementPagination.value?.currentPage ?? 1)) return;
    procurementSearch.page = target;
    void loadProcurementRequests();
}

function goToDepartmentStockPage(page: number) {
    const last = departmentStockPagination.value?.lastPage ?? 1;
    const target = Math.max(1, Math.min(page, last));
    if (target === (departmentStockPagination.value?.currentPage ?? 1)) return;
    departmentStockFilters.page = target;
    void loadDepartmentStock();
}

// --- Empty state filter chips ---
const itemFilterChips = computed<string[]>(() => {
    const chips: string[] = [];
    if (itemSearch.q) chips.push(`Search: "${itemSearch.q}"`);
    if (itemSearch.category) chips.push(`Category: ${itemSearch.category}`);
    if (itemSearch.stockState) chips.push(`Store stock: ${stockStateLabel(itemSearch.stockState)}`);
    if (itemSearch.sortBy !== 'itemName' || itemSearch.sortDir !== 'asc') chips.push(`Sort: ${formatEnumLabel(itemSearch.sortBy)} ${itemSearch.sortDir.toUpperCase()}`);
    if (itemSearch.perPage !== 20) chips.push(`${itemSearch.perPage} per page`);
    return chips;
});
const hasAnyItemFilters = computed(() => itemFilterChips.value.length > 0);
const procurementFilterChips = computed<string[]>(() => {
    const chips: string[] = [];
    if (procurementSearch.q) chips.push(`Search: "${procurementSearch.q}"`);
    if (procurementSearch.status) chips.push(`Status: ${formatEnumLabel(procurementSearch.status)}`);
    return chips;
});
const hasAnyProcurementFilters = computed(() => procurementFilterChips.value.length > 0);
const deptReqFilterChips = computed<string[]>(() => {
    const chips: string[] = [];
    if (deptReqSearch.q) chips.push(`Search: "${deptReqSearch.q}"`);
    if (deptReqSearch.status) chips.push(`Status: ${formatEnumLabel(deptReqSearch.status)}`);
    if (deptReqSearch.departmentId) {
        const department = requisitionDepartmentOptions.value.find((item) => item.id === deptReqSearch.departmentId);
        chips.push(`Department: ${department ? lookupOptionText(department) : deptReqSearch.departmentId}`);
    }
    return chips;
});
const hasAnyDeptReqFilters = computed(() => deptReqFilterChips.value.length > 0);

// --- Item reset helpers ---
function resetItemFilters() {
    itemSearch.q = '';
    itemSearch.category = '';
    itemSearch.stockState = '';
    itemSearch.sortBy = 'itemName';
    itemSearch.sortDir = 'asc';
    itemSearch.page = 1;
    void refreshInventoryItems();
}
function resetProcurementFilters() {
    procurementSearch.q = '';
    procurementSearch.status = '';
    procurementSearch.sortBy = 'createdAt';
    procurementSearch.sortDir = 'desc';
    procurementSearch.page = 1;
    void loadProcurementRequests();
}

function resetDeptReqFilters() {
    deptReqSearch.q = '';
    deptReqSearch.status = '';
    deptReqSearch.departmentId = '';
    applyLockedDeptReqFilter();
    deptReqSearch.page = 1;
    void loadDeptRequisitions();
}

// --- Mobile drawer helpers for procurement & ledger ---
function submitProcurementSearchFromMobileDrawer() {
    mobileProcurementDrawerOpen.value = false;
    procurementSearch.page = 1;
    void loadProcurementRequests();
}
function resetProcurementFiltersFromMobileDrawer() {
    procurementSearch.q = '';
    procurementSearch.status = '';
    procurementSearch.sortBy = 'createdAt';
    procurementSearch.sortDir = 'desc';
    procurementSearch.page = 1;
    mobileProcurementDrawerOpen.value = false;
    void loadProcurementRequests();
}
function submitLedgerSearchFromMobileDrawer() {
    mobileLedgerDrawerOpen.value = false;
    stockLedgerFilters.page = 1;
    void loadStockLedger();
}
function resetLedgerFiltersFromMobileDrawer() {
    mobileLedgerDrawerOpen.value = false;
    resetStockLedgerFilters();
}

// --- Inventory auto-refresh ---
function applyInventoryAutoRefresh() {
    stopPolling();
    const ms = INVENTORY_AUTO_REFRESH_INTERVAL_MS[inventoryAutoRefreshInterval.value] ?? 0;
    if (ms > 0) {
        pollingTimer = setInterval(() => {
            if (document.hidden || loading.value || !canRead.value || activeTab.value !== 'inventory') return;
            void refreshInventoryItems();
        }, ms);
    }
}
function stopPolling() {
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
}

watch(inventoryAutoRefreshInterval, () => {
    applyInventoryAutoRefresh();
});

// --- Keyboard shortcuts ---
function handleKeyboardShortcut(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;

    const key = e.key;
    // / — focus search
    if (key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const searchEl = document.getElementById('inv-items-q') as HTMLInputElement | null;
        searchEl?.focus();
        return;
    }
    // r — refresh
    if (key === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!loading.value) void reloadAll();
        return;
    }
    // n — new item
    if (key === 'n' && !e.ctrlKey && !e.metaKey && canManageItems.value) {
        openCreateItemDialog();
        return;
    }
    // m — stock movement
    if (key === 'm' && !e.ctrlKey && !e.metaKey && canCreateMovement.value) {
        openStockMovementDialog();
        return;
    }
    // p — procurement request
    if (key === 'p' && !e.ctrlKey && !e.metaKey && canCreateRequest.value) {
        openCreateProcurementDialog();
        return;
    }
    // l — stock ledger
    if (key === 'l' && !e.ctrlKey && !e.metaKey) {
        switchToStockLedger();
        return;
    }
    // b — barcode scanner
    if (key === 'b' && !e.ctrlKey && !e.metaKey) {
        barcodeScannerOpen.value = true;
        return;
    }
}

bindInventoryWorkspace({
    canRead,
    canCreateRequest,
    canManageItems,
    canCreateMovement,
    canSetOpeningStock,
    canApproveRequisitions,
    canLaunchCreateItem,
    canLaunchStockMovement,
    canLaunchOpeningStock,
    canLaunchProcurementRequest,
    canSyncFromCatalog,
    headerActions,
    loading,
    deptReqSearch,
    deptReqLoading,
    deptRequisitions,
    deptReqPagination,
    deptReqFilterChips,
    hasAnyDeptReqFilters,
    REQUISITION_STATUSES,
    EMPTY_SELECT_VALUE,
    requisitionDepartmentOptions,
    departmentFilterOptions,
    canSelectAnyRequisitionDepartment,
    setDeptReqDepartmentFilter,
    setShortageQueueDepartmentFilter,
    setDepartmentStockDepartmentFilter,
    loadDeptRequisitions,
    resetDeptReqFilters,
    openCreateRequisitionDialog,
    openRequisitionDetails,
    updateRequisitionStatus,
    requisitionPrimaryActionLabel,
    reqStatusBadgeClass,
    warehouseLabel,
    formatDateOnly,
    formatDateTime,
    formatEnumLabel,
    toSelectValue,
    fromSelectValue,
    lookupOptionText,
    claimLinks,
    claimLinkPagination,
    claimLinkLoading,
    claimLinkSearch,
    CLAIM_STATUSES,
    createClaimLinkDialogOpen,
    loadClaimLinks,
    claimStatusBadgeClass,
    formatAmount,
    openItemDetails,
    msdOrders,
    msdOrderPagination,
    msdOrderLoading,
    msdOrderSearch,
    MSD_ORDER_STATUSES,
    shortageMsdDraftLines,
    lowStockMsdDraftLines,
    openMsdOrderFromDraft,
    openBlankMsdOrder,
    loadMsdOrders,
    msdStatusBadgeClass,
    syncMsdOrderStatus,
    leadTimeSearch,
    leadTimeLoading,
    leadTimes,
    leadTimePagination,
    suppliers,
    supplierPerformance,
    supplierLabel,
    createLeadTimeDialogOpen,
    loadLeadTimes,
    deliveryStatusBadge,
    openRecordDelivery,
    shortageQueueReplenishmentBanner,
    shortageQueueMeta,
    shortageQueueItems,
    shortageQueueLoading,
    shortageQueueError,
    shortageQueueFilters,
    departments,
    loadShortageQueue,
    canCreateProcurementFromRequisitionLine,
    openProcurementFromQueueShortage,
    shortageLineProcurementRequest,
    transferAttentionSummary,
    transferAttentionBadgeClass,
    createTransferDialogOpen,
    transferSearch,
    TRANSFER_STATUSES,
    TRANSFER_VARIANCE_REVIEW_FILTER_OPTIONS,
    transferLoading,
    transfers,
    transferPagination,
    loadWarehouseTransfers,
    transferStatusBadgeClass,
    transferPriorityBadge,
    transferReservationStateBadgeClass,
    transferReservationSummaryLabel,
    transferCanOpenVarianceReview,
    transferVarianceReviewState,
    transferVarianceReviewBadgeClass,
    transferVarianceReviewStateLabel,
    transferPickSummaryLabel,
    transferAttentionSignals,
    TRANSFER_ACTION_TRANSITIONS,
    openTransferStatusDialog,
    transferActionLabel,
    openTransferVarianceReviewDialog,
    transferVarianceReviewButtonLabel,
    transferCanOpenPickSlip,
    transferCanOpenDispatchNote,
    openTransferPickSlip,
    openTransferDispatchNote,
    itemCounts,
    inventoryAutoRefreshInterval,
    INVENTORY_AUTO_REFRESH_LABEL,
    refreshInventoryItems,
    flushInventorySearch,
    catalogSyncDialogOpen,
    openCatalogSyncDialog,
    importItemsCsvDialogOpen,
    importItemsCsvSubmitting,
    importItemsCsvFile,
    importItemsCsvInputKey,
    importItemsCsvResult,
    openImportItemsCsvDialog,
    closeImportItemsCsvDialog,
    submitImportItemsCsv,
    openCreateItemDialog,
    itemSearch,
    hasAnyItemFilters,
    itemFilterChips,
    items,
    inventoryItemSetupBlockedReason,
    resetItemFilters,
    stockStateDotClass,
    stockStateLabel,
    flashedItemId,
    inventoryItemNeedsOpeningStock,
    inventoryItemHasOpeningStock,
    stockAlertBadgeClass,
    openStockMovementDialog,
    inventoryItemStockActionLabel,
    inventoryItemListMeta,
    openDepartmentStockForItem,
    itemPagination,
    itemPages,
    goToItemPage,
    reloadAll,
    departmentStockSummary,
    departmentStockFiltersOpen,
    departmentStockScopedItem,
    departmentStockLoading,
    clearDepartmentStockItemScope,
    departmentStockFilters,
    applyDepartmentStockFilters,
    resetDepartmentStockFilters,
    departmentStock,
    goToDepartmentStockPage,
    departmentStockPagination,
    departmentStockPages,
    mobileProcurementDrawerOpen,
    openCreateProcurementDialog,
    procurementSearch,
    procurementStatusOptions,
    hasAnyProcurementFilters,
    procurementFilterChips,
    resetProcurementFilters,
    procurementRequests,
    flashedRequestId,
    openDetails,
    procurementSourceLabel,
    sourceRequisitionOpeningId,
    openSourceRequisitionFromProcurement,
    procurementPrimaryAction,
    procurementOverflowActions,
    procurementPagination,
    procurementPages,
    goToProcurementPage,
    loadProcurementRequests,
    loadActiveProcurementRequests,
    stockLedgerSummary,
    stockLedgerLoading,
    stockLedgerFiltersOpen,
    exportStockLedgerCsv,
    exportInventoryItemsCsv,
    exportDepartmentStockCsv,
    printCurrentView,
    stockLedgerFilters,
    movementTypeOptions,
    stockLedgerSourceOptions,
    applyStockLedgerFilters,
    auditActorTypeOptions,
    resetStockLedgerFilters,
    stockMovements,
    stockMovementPagination,
    stockMovementSourceSummary,
    stockLedgerPages,
    goToStockLedgerPage,
    analyticsLoading,
    loadAllAnalytics,
    consumptionTrends,
    abcVenMatrix,
    expiryWastage,
    stockTurnover,
    consumptionGranularity,
    consumptionDays,
    loadConsumptionTrends,
    itemCategoryOptions,
    stockStateOptions,
    submitProcurementSearchFromMobileDrawer,
    resetProcurementFiltersFromMobileDrawer,
    mobileLedgerDrawerOpen,
    submitLedgerSearchFromMobileDrawer,
    resetLedgerFiltersFromMobileDrawer,
    createBatchDialogOpen,
    batchForm,
    batchCreateSubmitting,
    batchCreateErrors,
    fieldError,
    itemDetails,
    submitCreateBatch,
    createUnitDialogOpen,
    openCreateUnitDialog,
    createPriceDialogOpen,
    unitForm,
    unitFormErrors,
    unitFormSubmitting,
    editingUnitId,
    submitCreateUnit,
    submitDeactivateUnit,
    openEditUnitDialog,
    itemUnits,
    itemUnitsLoading,
    loadItemUnits,
    resetUnitForm,
    unitPrices,
    unitPricesLoading,
    loadItemUnitPrices,
    leadTimeForm,
    leadTimeErrors,
    leadTimeSubmitting,
    submitCreateLeadTime,
    recordDeliveryDialogOpen,
    deliveryForm,
    deliveryErrors,
    deliverySubmitting,
    submitRecordDelivery,
    barcodeScannerOpen,
    barcodeInput,
    barcodeLookupLoading,
    barcodeLookupError,
    barcodeLookupResult,
    onBarcodeKeydown,
    lookupBarcode,
    transferForm,
    transferErrors,
    transferSubmitting,
    PRIORITY_OPTIONS,
    warehouses,
    handleTransferLineItemChange,
    transferLineUsesBatchTracking,
    transferBatchLoadingByItemId,
    transferLineBatches,
    batchOptionLabel,
    addTransferLine,
    removeTransferLine,
    submitCreateTransfer,
    transferStatusDialogOpen,
    transferStatusForm,
    transferStatusSelectedTransfer,
    transferStatusContextLoading,
    transferStatusErrors,
    transferStatusSubmitting,
    onTransferStatusDialogOpenChange,
    submitTransferStatusUpdate,
    transferDispatchNeedsRevalidation,
    transferLineLabel,
    formatTransferQuantity,
    transferReservationStateLabel,
    transferReceiptVarianceType,
    transferReceiptVarianceNeedsDetails,
    TRANSFER_RECEIPT_VARIANCE_OPTIONS,
    transferVarianceReviewDialogOpen,
    transferVarianceReviewForm,
    transferVarianceReviewSelectedTransfer,
    transferVarianceReviewLoading,
    transferVarianceReviewErrors,
    transferVarianceReviewSubmitting,
    onTransferVarianceReviewDialogOpenChange,
    submitTransferVarianceReview,
    transferVarianceReviewLines,
    createRequisitionDialogOpen,
    createProcurementDialogOpen,
    procurementRequestKey,
    closeCreateProcurementDialog,
    handleProcurementDialogOpenChange,
    requestCreateProcurementOpenChange,
    requisitionDepartmentHelperText,
    reqCreateErrors,
    reqCreateSubmitting,
    reqForm,
    updateRequisitionDepartment,
    selectedRequisitionDepartment,
    selectedRequisitionWarehouse,
    selectedRequisitionDepartmentId,
    REQUISITION_PRIORITIES,
    handleReqLineItemSelected,
    addReqLine,
    removeReqLine,
    submitCreateRequisition,
    procurementForm,
    procurementErrors,
    procurementSubmitting,
    procurementSubmitDisabled,
    procurementUsesExistingItem,
    procurementLockedToSource,
    selectedProcurementItem,
    handleProcurementItemSelected,
    activeRequestsForItem,
    submitProcurementRequest,
    createItemDialogOpen,
    hasCreateItemDraftContent,
    restoredCreateItemDraft,
    discardCreateItemDraft,
    itemCreateForm,
    itemCreateErrors,
    itemCreateSubmitting,
    selectedCreateCategory,
    createSubcategoryOptions,
    createClinicalCatalogOptions,
    createClinicalCatalogSelectionRequired,
    createIdentityLockedToCatalog,
    createSelectedCatalogItem,
    selectClinicalCatalogItem,
    createCategoryWorkflowBadges,
    DOSAGE_FORM_OPTIONS,
    storageConditionOptions,
    controlledSubstanceScheduleOptions,
    venClassificationOptions,
    abcClassificationOptions,
    createItemWarehouseOpen,
    createItemSupplierOpen,
    itemCreateRequestError,
    itemCreateValidationMessages,
    itemCreateSubmitReason,
    itemCreateSubmitDisabled,
    submitCreateItem,
    stockMovementDialogOpen,
    stockMovementSheetTitle,
    stockMovementSheetDescription,
    stockMovementOpeningBalanceMode,
    stockMovementForm,
    stockMovementErrors,
    stockMovementSubmitting,
    stockMovementSubcategoryOptions,
    stockMovementLookupBlockedReason,
    stockMovementCategoryLabel,
    stockMovementSubcategoryLabel,
    stockMovementLookupHelperText,
    handleStockMovementItemSelected,
    stockMovementItem,
    stockMovementSignedDelta,
    stockMovementProjectedNegative,
    stockMovementProjectedStock,
    stockMovementProjectedState,
    stockMovementTypeMeta,
    selectedStockMovementTypeMeta,
    stockMovementReasonOptions,
    correctionReasonOptions,
    stockMovementCorrectionDialogOpen,
    stockMovementCorrectionSubmitting,
    stockMovementCorrectionErrors,
    stockMovementCorrectionItem,
    stockMovementCorrectionMovement,
    stockMovementCorrectionForm,
    resetStockMovementCorrectionForm,
    openStockMovementCorrection,
    submitStockMovementCorrection,
    requiresAdjustmentDirection,
    stockMovementUnitLabel,
    stockMovementRequiresBatchSelection,
    stockMovementBatchesLoading,
    selectedStockMovementBatch,
    stockMovementFilteredBatches,
    stockMovementRequiresBatchReceiptFields,
    stockMovementReasonRequired,
    stockMovementReasonPlaceholder,
    stockMovementSubmitDisabled,
    stockMovementSubmitLabel,
    submitStockMovement,
    reconcileDialogOpen,
    stockReconciliationForm,
    stockReconciliationErrors,
    stockReconciliationSubmitting,
    handleStockReconciliationItemSelected,
    stockReconciliationUsesBatchTracking,
    stockReconciliationBatchesLoading,
    selectedStockReconciliationBatch,
    stockReconciliationBatchOptions,
    stockReconciliationSubmitDisabled,
    submitStockReconciliation,
    requisitionDetailsOpen,
    onRequisitionDetailsOpenChange,
    selectedRequisition,
    requisitionStatusHelper,
    requisitionLineItemLabel,
    requisitionLineDecisionDraft,
    requisitionLineAvailableStock,
    requisitionLineIssueProblem,
    requisitionLineShortageSummary,
    requisitionApprovedDecisionQuantity,
    requisitionIssuedDecisionQuantity,
    openProcurementFromRequisitionShortage,
    selectedRequisitionIssueBlockingProblems,
    selectedRequisitionHasAnyAdditionalIssue,
    selectedRequisitionIssueShortageSummaries,
    selectedRequisitionIssueUnavailableReason,
    requisitionStatusSubmitting,
    selectedRequisitionIssueBlockedReason,
    confirmSelectedRequisitionIssue,
    selectedRequisitionIssueTargetStatus,
    placeOrderDialogOpen,
    placeOrderRequest,
    placeOrderForm,
    placeOrderErrors,
    placeOrderError,
    placeOrderSubmitting,
    submitPlaceOrder,
    receiveDialogOpen,
    receiveRequest,
    receiveForm,
    receiveErrors,
    receiveError,
    receiveSubmitting,
    receiveRequiresBatchTracking,
    receiveTrackedCategory,
    submitReceiveGoods,
    statusDialogOpen,
    statusRequest,
    statusValue,
    statusReason,
    statusError,
    statusSubmitting,
    procurementManualStatusOptions,
    submitStatusUpdate,
    detailsOpen,
    detailsRequest,
    canViewAudit,
    detailsAuditFilters,
    detailsAuditLoading,
    detailsAuditExporting,
    detailsAuditError,
    detailsAuditLogs,
    detailsAuditMeta,
    applyDetailsAuditFilters,
    resetDetailsAuditFilters,
    exportDetailsAuditLogsCsv,
    auditActorLabel,
    goToDetailsAuditPage,
    itemDetailsOpen,
    itemDetailsLoading,
    itemDetailsError,
    itemDetailsTab,
    itemDetailsSummaryCards,
    itemUpdateForm,
    itemUpdateErrors,
    itemUpdateSubmitting,
    selectedUpdateCategory,
    updateSubcategoryOptions,
    updateClinicalCatalogOptions,
    updateIdentityLockedToCatalog,
    updateSelectedCatalogItem,
    updateCategoryWorkflowBadges,
    updateItemWarehouseOpen,
    updateItemSupplierOpen,
    submitItemUpdate,
    itemStatusForm,
    itemStatusOptions,
    itemStatusSubmitting,
    itemStatusError,
    submitItemStatus,
    itemBatches,
    itemBatchesLoading,
    loadItemBatches,
    expiryBadgeClass,
    clinicalCatalogLabel,
    itemAuditFilters,
    itemAuditLoading,
    itemAuditError,
    itemAuditExporting,
    itemAuditLogs,
    itemAuditMeta,
    applyItemAuditFilters,
    resetItemAuditFilters,
    exportItemAuditLogsCsv,
    goToItemAuditPage,
    claimLinkForm,
    claimLinkErrors,
    claimLinkSubmitting,
    claimLinkPatientContextLabel,
    claimLinkPatientContextMeta,
    claimLinkItemContextLabel,
    claimLinkItemContextMeta,
    claimLinkWorkflowContextMeta,
    claimLinkWorkflowContextLabel,
    claimLinkContextStatusLabel,
    claimLinkContextStatusVariant,
    handleClaimLinkItemSelected,
    handleClaimLinkClaimsCaseSelected,
    handleClaimLinkInvoiceSelected,
    submitCreateClaimLink,
    createMsdOrderDialogOpen,
    msdOrderForm,
    msdOrderErrors,
    msdOrderSubmitting,
    addMsdOrderLine,
    removeMsdOrderLine,
    submitCreateMsdOrder,
});

onBeforeUnmount(() => {
    stopPolling();
    if (flashedItemTimer) clearTimeout(flashedItemTimer);
    if (flashedRequestTimer) clearTimeout(flashedRequestTimer);
    if (inventorySearchTimer) clearTimeout(inventorySearchTimer);
    document.removeEventListener('keydown', handleKeyboardShortcut);
    clearInventoryWorkspace();
});

onMounted(async () => {
    document.addEventListener('keydown', handleKeyboardShortcut);
    const shouldFocusStockLedger = hydrateStockLedgerFiltersFromUrl();
    hydrateWorkspaceTabFromUrl();
    syncWorkspaceUrl(activeTab.value);
    await loadPermissions();

    if (shouldFocusStockLedger && workspaceTabVisible('ledger')) {
        await nextTick();
        switchToStockLedger();
    } else {
        syncActiveTabWithAccess();
    }

    await reloadAll();
    applyInventoryAutoRefresh();
});
</script>

<template>
    <Head title="Supply chain workspace" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">

            <FacilityWorkspacePageHeader
                title="Workspace"
                :description="workspaceHeaderDescription"
                icon="package"
                :department-name="showDepartmentInWorkspaceHeader ? workspaceDepartmentName : null"
                :department-loading="workspaceDepartmentHeaderLoading"
                :back-href="null"
            >
                <template #actions>
                    <template v-if="activeWorkspaceArea.id === 'stock-control'">
                        <template v-for="action in headerActions" :key="action.key">
                            <Select v-if="action.isDropdown" :model-value="action.dropdownValue" @update:model-value="action.onDropdownChange">
                                <SelectTrigger
                                    class="h-8 w-[8rem] rounded-lg text-xs data-[size=default]:h-8"
                                    :title="action.dropdownValue !== 'off' ? `Auto-refresh every ${action.dropdownValue}` : 'Auto-refresh off'"
                                >
                                    <SelectValue placeholder="Auto" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        v-for="opt in action.dropdownOptions"
                                        :key="opt.value"
                                        :value="opt.value"
                                    >
                                        {{ opt.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <DropdownMenu v-else-if="action.isMenuDropdown">
                                <DropdownMenuTrigger as-child>
                                    <Button
                                        :size="'sm'"
                                        :variant="action.variant ?? 'outline'"
                                        :class="[action.class ?? '', 'h-8', action.iconOnly ? 'w-8 p-0' : 'gap-1.5']"
                                        :disabled="action.disabled || action.loading"
                                    >
                                        <AppIcon :name="action.icon" class="size-3.5" :class="{ 'animate-spin': action.loading }" />
                                        <span v-if="!action.iconOnly">{{ action.label }}</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        v-for="item in action.menuItems"
                                        :key="item.key"
                                        :disabled="item.disabled"
                                        @click="item.onClick"
                                    >
                                        <AppIcon :name="item.icon" class="mr-2 size-3.5" />
                                        {{ item.label }}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                                v-else
                                :size="'sm'"
                                :variant="action.variant ?? 'outline'"
                                :class="[action.class ?? '', 'h-8', action.iconOnly ? 'w-8 p-0' : 'gap-1.5']"
                                :disabled="action.disabled || action.loading"
                                @click="action?.onClick"
                            >
                                <AppIcon :name="action.icon" class="size-3.5" :class="{ 'animate-spin': action.loading }" />
                                <span v-if="!action.iconOnly">{{ action.label }}</span>
                            </Button>
                        </template>
                    </template>
                    <template v-else>
                        <Button v-if="canReconcileStock" size="sm" variant="outline" class="h-8 gap-1.5" :disabled="!canLaunchReconciliation" @click="openReconcileDialog">
                            <AppIcon name="shield-check" class="size-3.5" />
                            Reconcile stock
                        </Button>
                        <Button v-if="isStoreOperations" size="sm" variant="outline" class="h-8 gap-1.5" @click="barcodeScannerOpen = true">
                            <AppIcon name="search" class="size-3.5" />
                            Barcode
                        </Button>
                    </template>
                    <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                            <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                                <AppIcon name="ellipsis-vertical" class="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="w-48">
                            <DropdownMenuItem as-child>
                                <Link href="/platform/admin/clinical-catalogs" class="gap-2">
                                    <AppIcon name="book-open" class="size-4" />
                                    Clinical catalog
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem as-child>
                                <Link href="/billing-service-catalog" class="gap-2">
                                    <AppIcon name="receipt" class="size-4" />
                                    Tariffs & services
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem @click="barcodeScannerOpen = true">
                                <AppIcon name="search" class="size-4" />
                                Barcode lookup
                            </DropdownMenuItem>
                            <DropdownMenuItem @click="openReconcileDialog" :disabled="!canLaunchReconciliation">
                                <AppIcon name="shield-check" class="size-4" />
                                Reconcile stock
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </template>
            </FacilityWorkspacePageHeader>

            <Alert v-if="isDepartmentRequester" class="border-primary/30 bg-primary/5">
                <AlertTitle>Department supply workspace</AlertTitle>
                <AlertDescription>
                    Tabs are limited to what your role can do: requisitions, procurement requests, item lookup, and department stock. Store receive, issue, and cycle count are not available for lab users.
                </AlertDescription>
            </Alert>

            <!-- Errors -->
            <Alert v-if="queueError" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="circle-x" class="size-4" />
                    Request error
                </AlertTitle>
                <AlertDescription>{{ queueError }}</AlertDescription>
            </Alert>

            <!-- Tab layout -->
            <Tabs :model-value="activeTab" class="flex min-h-0 flex-1 flex-col gap-4" @update:model-value="onTabChange">
                <div
                    class="grid gap-2"
                    :style="{ gridTemplateColumns: `repeat(${Math.min(visibleWorkspaceAreas.length, 4)}, minmax(0, 1fr))` }"
                >
                    <button
                        v-for="area in visibleWorkspaceAreas"
                        :key="area.id"
                        type="button"
                        :class="[
                            'flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition',
                            area.id === activeWorkspaceArea.id
                                ? area.activeClass
                                : 'border-transparent bg-muted/30 text-muted-foreground hover:border-border hover:bg-background hover:text-foreground'
                        ]"
                        @click="switchWorkspaceArea(area.id)"
                    >
                        <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-background/70">
                            <AppIcon :name="area.icon" class="size-4" />
                        </span>
                        <span class="min-w-0">
                            <span class="block truncate font-medium leading-tight">{{ area.label }}</span>
                            <span class="hidden truncate text-xs opacity-75 lg:block">{{ area.description }}</span>
                        </span>
                    </button>
                </div>

                <TabsList class="flex h-auto w-full flex-wrap justify-start gap-2 rounded-lg bg-muted/30 p-1">
                    <TabsTrigger v-if="activeWorkspaceAreaTabs.includes('inventory')" value="inventory" class="gap-1.5" @mouseenter="() => debouncedPrefetch('inventory')">
                        <AppIcon name="package" class="size-3.5" />
                        Items
                    </TabsTrigger>
                    <TabsTrigger v-if="activeWorkspaceAreaTabs.includes('ledger')" value="ledger" class="gap-1.5" @mouseenter="() => debouncedPrefetch('ledger')">
                        <AppIcon name="activity" class="size-3.5" />
                        Ledger
                    </TabsTrigger>
                    <TabsTrigger v-if="activeWorkspaceAreaTabs.includes('department-stock')" value="department-stock" class="gap-1.5" @mouseenter="() => debouncedPrefetch('department-stock')">
                        <AppIcon name="building-2" class="size-3.5" />
                        Department Stock
                    </TabsTrigger>
                    <TabsTrigger v-if="activeWorkspaceAreaTabs.includes('procurement')" value="procurement" class="gap-1.5" @mouseenter="() => debouncedPrefetch('procurement')">
                        <AppIcon name="clipboard-list" class="size-3.5" />
                        Purchase Requests
                    </TabsTrigger>
                    <TabsTrigger v-if="activeWorkspaceAreaTabs.includes('msd-orders')" value="msd-orders" class="gap-1.5" @mouseenter="() => debouncedPrefetch('msd-orders')">
                        <AppIcon name="package" class="size-3.5" />
                        MSD Orders
                    </TabsTrigger>
                    <TabsTrigger v-if="activeWorkspaceAreaTabs.includes('lead-times')" value="lead-times" class="gap-1.5" @mouseenter="() => debouncedPrefetch('lead-times')">
                        <AppIcon name="activity" class="size-3.5" />
                        Lead Times
                    </TabsTrigger>
                    <TabsTrigger v-if="activeWorkspaceAreaTabs.includes('overview')" value="overview" class="gap-1.5" @mouseenter="() => debouncedPrefetch('overview')">
                        <AppIcon name="alert-triangle" class="size-3.5" />
                        Priorities
                    </TabsTrigger>
                    <TabsTrigger v-if="activeWorkspaceAreaTabs.includes('requisitions')" value="requisitions" class="gap-1.5" @mouseenter="() => debouncedPrefetch('requisitions')">
                        <AppIcon name="clipboard-list" class="size-3.5" />
                        Department Requests
                    </TabsTrigger>
                    <TabsTrigger v-if="activeWorkspaceAreaTabs.includes('shortage-queue')" value="shortage-queue" class="gap-1.5" @mouseenter="() => debouncedPrefetch('shortage-queue')">
                        <AppIcon name="alert-triangle" class="size-3.5" />
                        Shortages
                        <Badge
                            v-if="(shortageQueueMeta?.readyLineCount ?? 0) > 0"
                            variant="destructive"
                            class="h-4 min-w-4 rounded-full px-1 text-[10px] font-semibold leading-none"
                        >
                            {{ shortageQueueMeta!.readyLineCount }}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger v-if="activeWorkspaceAreaTabs.includes('transfers')" value="transfers" class="gap-1.5" @mouseenter="() => debouncedPrefetch('transfers')">
                        <AppIcon name="activity" class="size-3.5" />
                        Transfers
                    </TabsTrigger>
                    <TabsTrigger v-if="activeWorkspaceAreaTabs.includes('claims')" value="claims" class="gap-1.5" @mouseenter="() => debouncedPrefetch('claims')">
                        <AppIcon name="shield-check" class="size-3.5" />
                        Claims
                    </TabsTrigger>
                    <TabsTrigger v-if="activeWorkspaceAreaTabs.includes('analytics')" value="analytics" class="gap-1.5" @mouseenter="() => debouncedPrefetch('analytics')">
                        <AppIcon name="activity" class="size-3.5" />
                        Analytics
                    </TabsTrigger>
                </TabsList>

            <div class="flex min-w-0 flex-col gap-4">
                <TabsContent value="overview" class="mt-0 flex flex-col gap-4">
                    <WorkspaceOverviewTab
                        :workspace-next-actions="workspaceNextActions"
                        :request-pipeline-stages="requestPipelineStages"
                        :requisitions-ready-count="requisitionsReadyCount"
                        :requisitions-waiting-count="requisitionsWaitingCount"
                        :department-requisition-total="departmentRequisitionTotal"
                        @change-tab="onTabChange"
                        @refresh-pipeline="loadRequestPipelineCounts"
                        @open-pipeline-stage="openRequestPipelineStage"
                    />
                </TabsContent>

                <!-- Department Requisitions tab -->
                <TabsContent value="requisitions" class="mt-0 flex flex-col gap-4">
                    <WorkspaceRequisitionsTab />
                </TabsContent>
                <!-- ─── Shortage Queue Tab ─── -->
                <TabsContent value="shortage-queue" class="mt-0 flex flex-col gap-4">
                    <WorkspaceShortageQueueTab />
                </TabsContent>

                <!-- Warehouse Transfers Tab -->
                <!-- ─── Warehouse Transfers Tab ─── -->
                <TabsContent value="transfers" class="mt-0 flex flex-col gap-4">
                    <WorkspaceTransfersTab />
                </TabsContent>
                <TabsContent value="inventory" class="mt-0 flex flex-col gap-4">
                    <WorkspaceInventoryTab />
                </TabsContent>

                <TabsContent value="ledger" class="mt-0 flex flex-col gap-4">
                    <WorkspaceLedgerTab />
                </TabsContent>

                <TabsContent value="department-stock" class="mt-0 flex flex-col gap-4">
                    <WorkspaceDepartmentStockTab />
                </TabsContent>

                <TabsContent value="procurement" class="mt-0 flex flex-col gap-4">
                    <WorkspaceProcurementTab />
                </TabsContent>

                <!-- MSD Orders Tab (Feature 6) -->
                <TabsContent value="msd-orders" class="mt-0 flex flex-col gap-4">
                    <WorkspaceMsdOrdersTab />
                </TabsContent>
                <!-- Supplier Lead Times Tab -->
                <TabsContent value="lead-times" class="mt-0 flex flex-col gap-4">
                    <WorkspaceLeadTimesTab />
                </TabsContent>
                <TabsContent value="claims" class="mt-0 flex flex-col gap-4">
                    <WorkspaceClaimsTab />
                </TabsContent>
                <!-- Analytics Tab (Feature 8) -->
                <TabsContent value="analytics" class="mt-0 flex flex-col gap-4">
                    <WorkspaceAnalyticsTab />
                </TabsContent>

            </div>
            </Tabs>

            <WorkspaceFilterOverlays />
        </div>
    </AppLayout>

    <WorkspaceAuxiliarySheets />
    <WorkspaceTransferSheets />
    <WorkspaceRequestEntrySheets />
    <WorkspaceInventoryOpsSheets />
    <WorkspaceRequisitionDetailsSheet />
    <WorkspaceProcurementLifecycleSheets />
    <WorkspaceItemDetailsSheet />
    <WorkspaceClaimsAndMsdSheets />
    <WorkspaceCatalogSyncDialog />
    <WorkspaceInventoryImportCsvDialog />

    <!-- Create / Edit Unit Sheet -->
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

<style scoped>
.animate-inv-row-flash {
    animation: inv-row-flash 1.5s ease-out;
}

@keyframes inv-row-flash {
    0% {
        background-color: hsl(var(--primary) / 0.15);
    }
    100% {
        background-color: transparent;
    }
}
</style>
