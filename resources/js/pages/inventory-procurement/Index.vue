<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import BillingInvoiceLookupField from '@/components/billing/BillingInvoiceLookupField.vue';
import ClaimsInsuranceCaseLookupField from '@/components/claims/ClaimsInsuranceCaseLookupField.vue';
import ComboboxField from '@/components/forms/ComboboxField.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import InventoryEmptyState from '@/components/inventory/InventoryEmptyState.vue';
import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import MasterDataSetupGuide from '@/components/setup/MasterDataSetupGuide.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input, SearchInput } from '@/components/ui/input';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { useMasterDataSetupReadiness } from '@/composables/useMasterDataSetupReadiness';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useWorkflowDraftPersistence } from '@/composables/useWorkflowDraftPersistence';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
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
    { title: 'Inventory & Procurement', href: '/inventory-procurement' },
];

const POLLING_INTERVAL_MS = 30_000;

const EMPTY_SELECT_VALUE = '__inventory_procurement_empty_select__';
const INVENTORY_ITEM_CREATE_DRAFT_STORAGE_KEY = 'ahs.inventory-procurement.create-item-draft.v1';

function toSelectValue(value: string | null | undefined): string {
    return value == null || value === '' ? EMPTY_SELECT_VALUE : value;
}

function fromSelectValue(value: string): string {
    return value === EMPTY_SELECT_VALUE ? '' : value;
}

const stockStateOptions = ['out_of_stock', 'low_stock', 'healthy'] as const;
const procurementStatusOptions = ['draft', 'pending_approval', 'approved', 'rejected', 'ordered', 'received', 'cancelled'] as const;
const movementTypeOptions = ['receive', 'issue', 'adjust', 'transfer'] as const;
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

const inventoryWorkspaceTabs = ['inventory', 'procurement', 'ledger', 'department-stock', 'requisitions', 'shortage-queue', 'lead-times', 'transfers', 'claims', 'msd-orders', 'analytics'] as const;
type InventoryWorkspaceTab = (typeof inventoryWorkspaceTabs)[number];

function normalizeInventoryWorkspaceTab(value: string): InventoryWorkspaceTab {
    return inventoryWorkspaceTabs.includes(value as InventoryWorkspaceTab) ? (value as InventoryWorkspaceTab) : 'inventory';
}

const activeTab = ref<InventoryWorkspaceTab>('inventory');
const loading = ref(false);
const queueError = ref<string | null>(null);
const {
    steps: setupSteps,
    recommendedNextStep,
    loadSetupReadiness,
    warehouseReady,
    supplierReady,
} = useMasterDataSetupReadiness();

const canRead = ref(false);
const canManageItems = ref(false);
const canCreateMovement = ref(false);
const canReconcileStock = ref(false);
const canCreateRequest = ref(false);
const canUpdateRequestStatus = ref(false);
const canViewAudit = ref(false);
const canManageSuppliers = ref(false);
const canManageWarehouses = ref(false);
const { permissionNames: sharedPermissionNames, isFacilitySuperAdmin } = usePlatformAccess();

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

const compactItemRows = useLocalStorageBoolean('inventory.procurement.items.compact', false);
const compactProcurementRows = useLocalStorageBoolean('inventory.procurement.procurement.compact', false);
const inventoryItemSetupBlockedReason = computed(() => {
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
const canLaunchReconciliation = computed(() => canReconcileStock.value && !stockExecutionBlockedReason.value);
const canLaunchProcurementRequest = computed(() => canCreateRequest.value && !procurementSetupBlockedReason.value);

const itemFiltersSheetOpen = ref(false);
const mobileProcurementDrawerOpen = ref(false);
const mobileLedgerDrawerOpen = ref(false);

const createItemDialogOpen = ref(false);
const createItemWarehouseOpen = ref(false);
const createItemSupplierOpen = ref(false);
const updateItemWarehouseOpen = ref(false);
const updateItemSupplierOpen = ref(false);
const stockMovementDialogOpen = ref(false);
const reconcileDialogOpen = ref(false);
const createProcurementDialogOpen = ref(false);

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
const procurementUsesExistingItem = computed(() => procurementForm.itemId.trim().length > 0);
const procurementLockedToSource = computed(() => procurementForm.sourceDepartmentRequisitionLineId.trim().length > 0);
const ACTIVE_SOURCE_PROCUREMENT_STATUSES = ['pending_approval', 'approved', 'ordered'];

type LookupOption = {
    id: string;
    name: string;
    code: string | null;
};

type DepartmentRequisitionContext = {
    canSelectAnyDepartment: boolean;
    lockedDepartment: LookupOption | null;
    staffDepartmentName: string | null;
};

const suppliers = ref<LookupOption[]>([]);
const warehouses = ref<LookupOption[]>([]);
const departments = ref<LookupOption[]>([]);
const requisitionContext = ref<DepartmentRequisitionContext | null>(null);

type RequisitionInventorySelection = {
    id: string;
    unit?: string | null;
} | null;

const flashedItemId = ref<string | null>(null);
const flashedRequestId = ref<string | null>(null);

let flashedItemTimer: ReturnType<typeof setTimeout> | null = null;
let flashedRequestTimer: ReturnType<typeof setTimeout> | null = null;
let pollingTimer: ReturnType<typeof setInterval> | null = null;
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
    }
    createItemDialogOpen.value = true;
}

function discardCreateItemDraft(): void {
    clearPersistedCreateItemDraft();
    itemCreateErrors.value = {};
    itemCreateRequestError.value = null;
    resetItemForm(itemCreateForm);
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

function openStockMovementDialog(item: StockMovementLookupItem | null = null) {
    if (stockExecutionBlockedReason.value) {
        notifyError(stockExecutionBlockedReason.value);
        return;
    }

    stockMovementErrors.value = {};
    resetStockMovementForm(item);
    stockMovementDialogOpen.value = true;
}

function handleStockMovementItemSelected(item: StockMovementLookupItem | null): void {
    stockMovementSelectedItem.value = item;
    if (inventoryItemNeedsOpeningStock(item)) {
        stockMovementForm.movementType = 'receive';
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
    resetProcurementForm();
    createProcurementDialogOpen.value = true;
}

function onTabChange(value: string) {
    const nextTab = normalizeInventoryWorkspaceTab(value);
    activeTab.value = nextTab;
    if (nextTab === 'ledger') {
        void loadStockLedger();
    }
    if (nextTab === 'department-stock') {
        void loadDepartmentStock();
    }
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
const itemStatusForm = reactive({
    status: 'active',
    reason: '',
});
const itemStatusOptions = ['active', 'inactive'] as const;
const itemStatusSubmitting = ref(false);
const itemStatusError = ref<string | null>(null);

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
            value: currentStockLabel,
            helper: `Reorder ${reorderLevelLabel} | Max ${maxStockLevelLabel}`,
        },
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

const selectedStockMovementTypeMeta = computed(() => stockMovementTypeMeta[stockMovementForm.movementType]);
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

function inventoryItemStockActionLabel(item: StockMovementLookupItem | Record<string, unknown>): string {
    return inventoryItemNeedsOpeningStock(item) ? 'Set Opening Stock' : 'Record Item Movement';
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

    if (stockMovementReasonRequired.value && !stockMovementForm.reason.trim()) {
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

function csrfToken(): string | null {
    const element = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    return element?.content ?? null;
}

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

async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, opts?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> }): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(opts?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    let body: string | undefined;
    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        const token = csrfToken();
        if (token) headers['X-CSRF-TOKEN'] = token;
        body = JSON.stringify(opts?.body ?? {});
    }

    const response = await fetch(url.toString(), { method, credentials: 'same-origin', headers, body });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as ApiError;
        error.payload = payload;
        throw error;
    }

    return payload as T;
}

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
        canReconcileStock.value = hasSuperAdminAccess
            || permissionSet.has('inventory.procurement.reconcile-stock')
            || permissionSet.has('inventory.procurement.create-movement');
        canCreateRequest.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.create-request');
        canUpdateRequestStatus.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.update-request-status');
        canViewAudit.value = hasSuperAdminAccess || permissionSet.has('inventory.procurement.view-audit-logs');
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
                page: itemSearch.page,
                perPage: itemSearch.perPage,
            },
        }),
        apiRequest<{ data: typeof itemCounts.value }>('GET', '/inventory-procurement/stock-alert-counts', {
            query: {
                q: itemSearch.q.trim() || null,
                category: itemSearch.category.trim() || null,
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
    departmentStockFilters.departmentId = '';
    departmentStockFilters.itemId = '';
    departmentStockScopedItem.value = null;
    departmentStockFilters.page = 1;
    departmentStockFilters.perPage = 20;
    void loadDepartmentStock();
}

function openDepartmentStockForItem(item: any | null | undefined): void {
    const itemId = String(item?.id ?? '').trim();
    if (!itemId) return;

    departmentStockScopedItem.value = {
        id: itemId,
        name: String(item?.itemName ?? item?.name ?? itemId),
        code: item?.itemCode ?? item?.code ?? null,
    };
    departmentStockFilters.q = '';
    departmentStockFilters.itemId = itemId;
    departmentStockFilters.page = 1;
    activeTab.value = 'department-stock';
    itemDetailsOpen.value = false;
    void loadDepartmentStock();
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

    activeTab.value = normalizeInventoryWorkspaceTab(section);
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

// --- Batch Management ---
const itemBatches = ref<any[]>([]);
const itemBatchesLoading = ref(false);
const createBatchDialogOpen = ref(false);
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
const requisitionDepartmentOptions = computed(() => {
    const options = [...departments.value];
    const lockedDepartment = lockedRequisitionDepartment.value;

    if (lockedDepartment && !options.some((department) => department.id === lockedDepartment.id)) {
        options.unshift(lockedDepartment);
    }

    return options;
});
const selectedRequisitionDepartment = computed(() => {
    const selectedId = reqForm.requestingDepartmentId.trim();
    if (selectedId) {
        return requisitionDepartmentOptions.value.find((department) => department.id === selectedId) ?? lockedRequisitionDepartment.value;
    }

    return lockedRequisitionDepartment.value;
});
const selectedRequisitionDepartmentId = computed(() => (selectedRequisitionDepartment.value?.id ?? reqForm.requestingDepartmentId.trim()) || null);
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
    reqForm.issuingWarehouseId = warehouses.value.length === 1 ? warehouses.value[0]?.id ?? '' : '';
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
            apiRequest<{ data: any[] }>('GET', '/departments', { query: { perPage: 200, status: 'active' } })
                .catch(() => ({ data: [] })),
            apiRequest<{ data: DepartmentRequisitionContext }>('GET', '/inventory-procurement/department-requisitions/context')
                .catch(() => ({ data: { canSelectAnyDepartment: isFacilitySuperAdmin.value, lockedDepartment: null, staffDepartmentName: null } })),
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
        applyLockedDeptReqFilter();
    } catch {
        suppliers.value = [];
        warehouses.value = [];
        departments.value = [];
        requisitionContext.value = null;
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
}

function handleClaimLinkItemSelected(item: ClaimLinkInventoryItemSelection | null) {
    if (!item) return;

    if (!claimLinkForm.unit && (item.dispensingUnit || item.unit)) {
        claimLinkForm.unit = item.dispensingUnit || item.unit || '';
    }

    if (!claimLinkForm.nhifCode && item.nhifCode) {
        claimLinkForm.nhifCode = item.nhifCode;
    }
}

function handleClaimLinkClaimsCaseSelected(claim: ClaimLinkClaimsCaseSelection | null) {
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

function addMsdOrderLine() {
    msdOrderForm.lines.push({ msdCode: '', itemName: '', quantity: '', unit: '', unitCost: '' });
}

function removeMsdOrderLine(index: number) {
    if (msdOrderForm.lines.length > 1) msdOrderForm.lines.splice(index, 1);
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

async function reloadAll() {
    if (!canRead.value) return;
    loading.value = true;
    queueError.value = null;
    try {
        const tasks = [loadReferenceData(), loadItems(), loadProcurementRequests(), loadStockLedger(), loadDepartmentStock(), loadDeptRequisitions(), loadWarehouseTransfers(), loadSuppliersAndWarehouses(), loadClaimLinks(), loadMsdOrders(), loadSetupReadiness()];
        if (activeTab.value === 'shortage-queue') {
            tasks.push(loadShortageQueue());
        }
        await Promise.all(tasks);
    } catch (error) {
        queueError.value = messageFromUnknown(error, 'Unable to load inventory/procurement data.');
        items.value = [];
        itemPagination.value = null;
        procurementRequests.value = [];
        procurementPagination.value = null;
        stockMovements.value = [];
        stockMovementPagination.value = null;
    } finally {
        loading.value = false;
    }
}

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
        });
        notifySuccess('Inventory item created.');
        clearPersistedCreateItemDraft();
        createItemDialogOpen.value = false;
        resetItemForm(itemCreateForm);
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
        void loadItemBatches(itemId);
    } catch (error) {
        itemDetails.value = null;
        itemDetailsError.value = messageFromUnknown(error, 'Unable to load inventory item details.');
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

async function openItemDetails(item: any) {
    itemDetailsOpen.value = true;
    itemDetailsTab.value = 'overview';
    itemDetails.value = null;
    itemDetailsError.value = null;
    itemUpdateErrors.value = {};
    itemStatusError.value = null;
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
        });
        itemDetails.value = response.data;
        hydrateItemForms(response.data);
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
        });
        itemDetails.value = response.data;
        hydrateItemForms(response.data);
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
                reason: stockMovementForm.reason.trim() || null,
                notes: stockMovementForm.notes.trim() || null,
                occurredAt: stockMovementForm.occurredAt || null,
            },
        });
        notifySuccess(stockMovementSuccessMessage.value);
        stockMovementDialogOpen.value = false;
        resetStockMovementForm();
        await reloadAll();
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
        notifySuccess('Stock reconciliation recorded.');
        reconcileDialogOpen.value = false;
        resetStockReconciliationForm();
        await reloadAll();
    } catch (error) {
        stockReconciliationErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to reconcile stock.'));
    } finally {
        stockReconciliationSubmitting.value = false;
    }
}

function resetProcurementForm() {
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
    createProcurementDialogOpen.value = true;
}

function openProcurementFromRequisitionShortage(line: any): void {
    openProcurementFromShortage(selectedRequisition.value, line);
}

function openProcurementFromQueueShortage(req: any, line: any): void {
    openProcurementFromShortage(req, line);
}

async function submitProcurementRequest() {
    if (!canCreateRequest.value || procurementSubmitting.value) return;
    procurementSubmitting.value = true;
    procurementErrors.value = {};
    try {
        await apiRequest('POST', '/inventory-procurement/procurement-requests', {
            body: {
                itemId: procurementForm.itemId.trim() || null,
                itemName: procurementForm.itemName.trim() || null,
                category: procurementForm.category.trim() || null,
                unit: procurementForm.unit.trim() || null,
                reorderLevel: procurementForm.reorderLevel.trim() === '' ? null : Number(procurementForm.reorderLevel),
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
            notifySuccess(`Goods received. ${pendingCount} shortage line${pendingCount === 1 ? '' : 's'} for this item can now be reviewed in the Shortage Queue.`);
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
    void reloadAll();
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
    void reloadAll();
}
function submitItemFiltersFromSheet() {
    itemFiltersSheetOpen.value = false;
    itemSearch.page = 1;
    void reloadAll();
}
function resetItemFiltersFromSheet() {
    itemFiltersSheetOpen.value = false;
    resetItemFilters();
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

// --- Polling ---
function startPolling() {
    stopPolling();
    pollingTimer = setInterval(() => {
        if (document.hidden || loading.value || !canRead.value) return;
        void reloadAll();
    }, POLLING_INTERVAL_MS);
}
function stopPolling() {
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
}

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

onBeforeUnmount(() => {
    stopPolling();
    if (flashedItemTimer) clearTimeout(flashedItemTimer);
    if (flashedRequestTimer) clearTimeout(flashedRequestTimer);
    document.removeEventListener('keydown', handleKeyboardShortcut);
});

// Load shortage queue on demand when its tab is selected.
watch(activeTab, (tab) => {
    if (tab === 'shortage-queue' && shortageQueueItems.value.length === 0 && !shortageQueueLoading.value) {
        void loadShortageQueue();
    }
});

onMounted(async () => {
    document.addEventListener('keydown', handleKeyboardShortcut);
    const shouldFocusStockLedger = hydrateStockLedgerFiltersFromUrl();
    hydrateWorkspaceTabFromUrl();
    await loadPermissions();
    await reloadAll();
    startPolling();

    if (shouldFocusStockLedger) {
        await nextTick();
        switchToStockLedger();
    }
});
</script>

<template>
    <Head title="Inventory & Procurement" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">

            <!-- Page header -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="package" class="size-7 text-primary" />
                        Inventory & Procurement
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Stock alerting, stock movement ledger, and procurement request lifecycle.
                    </p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" :disabled="loading" class="h-8 gap-1.5" @click="reloadAll()">
                        <AppIcon name="activity" class="size-3.5" />
                        {{ loading ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                    <Button v-if="canManageItems" size="sm" variant="outline" class="h-8 gap-1.5" :disabled="!canLaunchCreateItem" @click="openCreateItemDialog">
                        <AppIcon name="layout-list" class="size-3.5" />
                        Catalog Item
                    </Button>
                    <Button v-if="canCreateMovement" size="sm" variant="outline" class="h-8 gap-1.5" :disabled="!canLaunchStockMovement" @click="openStockMovementDialog">
                        <AppIcon name="arrow-up-down" class="size-3.5" />
                        Record Movement
                    </Button>
                    <Button v-if="canReconcileStock" size="sm" variant="outline" class="h-8 gap-1.5" :disabled="!canLaunchReconciliation" @click="openReconcileDialog">
                        <AppIcon name="shield-check" class="size-3.5" />
                        Reconcile Stock
                    </Button>
                    <Button v-if="canCreateRequest" size="sm" class="h-8 gap-1.5" :disabled="!canLaunchProcurementRequest" @click="openCreateProcurementDialog">
                        <AppIcon name="plus" class="size-3.5" />
                        Procurement Request
                    </Button>
                    <Button size="sm" variant="outline" class="h-8 gap-1.5" @click="barcodeScannerOpen = true">
                        <AppIcon name="search" class="size-3.5" />
                        Barcode
                    </Button>
                    <Popover>
                        <PopoverTrigger as-child>
                            <Button variant="outline" size="sm" class="h-8 gap-1.5">
                                <Kbd class="text-[10px]">?</Kbd>
                                <span class="hidden sm:inline">Shortcuts</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" class="w-64 p-3">
                            <p class="mb-2 text-sm font-medium">Keyboard shortcuts</p>
                            <div class="space-y-1.5 text-xs text-muted-foreground">
                                <div class="flex items-center justify-between"><span>Focus search</span><KbdGroup><Kbd>/</Kbd></KbdGroup></div>
                                <div class="flex items-center justify-between"><span>Refresh</span><KbdGroup><Kbd>R</Kbd></KbdGroup></div>
                                <div class="flex items-center justify-between"><span>New item</span><KbdGroup><Kbd>N</Kbd></KbdGroup></div>
                                <div class="flex items-center justify-between"><span>Stock movement</span><KbdGroup><Kbd>M</Kbd></KbdGroup></div>
                                <div class="flex items-center justify-between"><span>Procurement request</span><KbdGroup><Kbd>P</Kbd></KbdGroup></div>
                                <div class="flex items-center justify-between"><span>Stock ledger</span><KbdGroup><Kbd>L</Kbd></KbdGroup></div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <MasterDataSetupGuide
                current-step="inventory"
                :steps="setupSteps"
                :recommended-next-step="recommendedNextStep"
            />

            <Card v-if="canRead" class="rounded-lg border-sidebar-border/70">
                <CardHeader class="pb-2">
                    <CardTitle class="flex items-center gap-2 text-base">
                        <AppIcon name="layout-grid" class="size-4.5 text-muted-foreground" />
                        Registry Administration
                    </CardTitle>
                    <CardDescription>
                        Open supplier and warehouse registries for inventory master-data maintenance.
                    </CardDescription>
                </CardHeader>
                <CardContent class="grid gap-3 pt-0 md:grid-cols-2">
                    <div class="rounded-lg border bg-muted/20 p-3">
                        <div class="flex items-start gap-2">
                            <AppIcon name="package" class="mt-0.5 size-4 text-muted-foreground" />
                            <div class="min-w-0 flex-1">
                                <p class="text-sm font-medium">Supplier Registry</p>
                                <p class="mt-1 text-xs text-muted-foreground">
                                    Vendor contacts, activation status, and supplier audit trail.
                                </p>
                            </div>
                        </div>
                        <div class="mt-3 flex items-center justify-between gap-2">
                            <Badge variant="outline">{{ canManageSuppliers ? 'Manage access' : 'Read-only access' }}</Badge>
                            <Button size="sm" variant="outline" as-child>
                                <Link href="/inventory-procurement/suppliers">Open</Link>
                            </Button>
                        </div>
                    </div>

                    <div class="rounded-lg border bg-muted/20 p-3">
                        <div class="flex items-start gap-2">
                            <AppIcon name="building-2" class="mt-0.5 size-4 text-muted-foreground" />
                            <div class="min-w-0 flex-1">
                                <p class="text-sm font-medium">Warehouse Registry</p>
                                <p class="mt-1 text-xs text-muted-foreground">
                                    Warehouse locations, lifecycle state, and warehouse audit trail.
                                </p>
                            </div>
                        </div>
                        <div class="mt-3 flex items-center justify-between gap-2">
                            <Badge variant="outline">{{ canManageWarehouses ? 'Manage access' : 'Read-only access' }}</Badge>
                            <Button size="sm" variant="outline" as-child>
                                <Link href="/inventory-procurement/warehouses">Open</Link>
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- Queue bar -->
            <div
                v-if="canRead"
                class="flex min-h-9 flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2"
            >
                <span class="text-xs font-medium text-muted-foreground">Store Stock Alerts:</span>
                <span :class="['flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs', stockAlertCountClass('outOfStock')]">
                    <span class="font-medium text-foreground">{{ itemCounts.outOfStock }}</span>
                    <span class="text-muted-foreground">Store out</span>
                </span>
                <span :class="['flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs', stockAlertCountClass('lowStock')]">
                    <span class="font-medium text-foreground">{{ itemCounts.lowStock }}</span>
                    <span class="text-muted-foreground">Store low</span>
                </span>
                <span :class="['flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs', stockAlertCountClass('healthy')]">
                    <span class="font-medium text-foreground">{{ itemCounts.healthy }}</span>
                    <span class="text-muted-foreground">Store healthy</span>
                </span>
                <span class="flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs">
                    <span class="font-medium text-foreground">{{ itemCounts.total }}</span>
                    <span class="text-muted-foreground">Total</span>
                </span>

                <Separator orientation="vertical" class="mx-1 hidden h-6 sm:block" />
                <span class="text-xs font-medium text-muted-foreground">Store status:</span>
                <Select :model-value="toSelectValue(stockStateSelectValue)" @update:model-value="stockStateSelectValue = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                    <SelectTrigger class="h-8 w-36 shrink-0" size="sm">
                        <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="out_of_stock">Store out</SelectItem>
                        <SelectItem value="low_stock">Store low</SelectItem>
                        <SelectItem value="healthy">Store healthy</SelectItem>
                    </SelectContent>
                </Select>

                <Separator orientation="vertical" class="mx-1 hidden h-6 sm:block" />
                <span class="text-xs font-medium text-muted-foreground">Presets:</span>
                <Button
                    size="sm"
                    class="h-8"
                    :variant="itemSearch.stockState === 'out_of_stock' ? 'default' : 'outline'"
                    @click="itemSearch.stockState = 'out_of_stock'; itemSearch.page = 1; reloadAll()"
                >
                    Store out
                </Button>
                <Button
                    size="sm"
                    class="h-8"
                    :variant="itemSearch.stockState === 'low_stock' ? 'default' : 'outline'"
                    @click="itemSearch.stockState = 'low_stock'; itemSearch.page = 1; reloadAll()"
                >
                    Store low
                </Button>
                <Button
                    size="sm"
                    class="h-8"
                    :variant="itemSearch.stockState === 'healthy' ? 'default' : 'outline'"
                    @click="itemSearch.stockState = 'healthy'; itemSearch.page = 1; reloadAll()"
                >
                    Store healthy
                </Button>
            </div>

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
                <TabsList class="w-full justify-start">
                    <TabsTrigger value="inventory" class="gap-1.5">
                        <AppIcon name="package" class="size-3.5" />
                        Inventory
                    </TabsTrigger>
                    <TabsTrigger value="procurement" class="gap-1.5">
                        <AppIcon name="clipboard-list" class="size-3.5" />
                        Procurement
                    </TabsTrigger>
                    <TabsTrigger value="ledger" class="gap-1.5">
                        <AppIcon name="activity" class="size-3.5" />
                        Stock Ledger
                    </TabsTrigger>
                    <TabsTrigger value="department-stock" class="gap-1.5">
                        <AppIcon name="package" class="size-3.5" />
                        Department Stock
                    </TabsTrigger>
                    <TabsTrigger value="requisitions" class="gap-1.5">
                        <AppIcon name="clipboard-list" class="size-3.5" />
                        Requisitions
                    </TabsTrigger>
                    <TabsTrigger value="shortage-queue" class="gap-1.5">
                        <AppIcon name="alert-triangle" class="size-3.5" />
                        Shortage Queue
                        <Badge
                            v-if="(shortageQueueMeta?.readyLineCount ?? 0) > 0"
                            variant="destructive"
                            class="h-4 min-w-4 rounded-full px-1 text-[10px] font-semibold leading-none"
                        >
                            {{ shortageQueueMeta!.readyLineCount }}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="lead-times" class="gap-1.5">
                        <AppIcon name="activity" class="size-3.5" />
                        Lead Times
                    </TabsTrigger>
                    <TabsTrigger value="transfers" class="gap-1.5">
                        <AppIcon name="activity" class="size-3.5" />
                        Transfers
                    </TabsTrigger>
                    <TabsTrigger value="claims" class="gap-1.5">
                        <AppIcon name="shield-check" class="size-3.5" />
                        Claims
                    </TabsTrigger>
                    <TabsTrigger value="msd-orders" class="gap-1.5">
                        <AppIcon name="package" class="size-3.5" />
                        MSD Orders
                    </TabsTrigger>
                    <TabsTrigger value="analytics" class="gap-1.5">
                        <AppIcon name="activity" class="size-3.5" />
                        Analytics
                    </TabsTrigger>
                </TabsList>

            <div class="flex min-w-0 flex-col gap-4">

                <TabsContent value="inventory" class="mt-0 flex flex-col gap-4">
                    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                <AppIcon name="package" class="size-4 text-muted-foreground" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total Items</p>
                                <p class="text-xl font-bold leading-tight tabular-nums">{{ itemCounts.total }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                                <AppIcon name="alert-triangle" class="size-4 text-destructive" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-destructive/80">Store Out</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-destructive">{{ itemCounts.outOfStock }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-amber-200/70 bg-amber-50/50 px-4 py-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
                                <AppIcon name="activity" class="size-4 text-amber-600 dark:text-amber-400" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-amber-700/70 dark:text-amber-400/70">Store Low</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-amber-700 dark:text-amber-300">{{ itemCounts.lowStock }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-green-200/70 bg-green-50/50 px-4 py-3 shadow-sm dark:border-green-900/40 dark:bg-green-950/20">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
                                <AppIcon name="check-circle" class="size-4 text-green-600 dark:text-green-400" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-green-700/70 dark:text-green-400/70">Store Healthy</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-green-700 dark:text-green-300">{{ itemCounts.healthy }}</p>
                            </div>
                        </div>
                    </div>
                <!-- Inventory Items card -->
                <Card
                    v-if="canRead"
                    class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm"
                >
                    <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                        <div class="min-w-0">
                            <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                <AppIcon name="layout-list" class="size-4 text-muted-foreground" />
                                Inventory Items
                            </h3>
                            <p class="mt-1 text-xs text-muted-foreground">Physical stock master with category, reorder policy, opening stock, and warehouse operations.</p>
                        </div>
                        <Button
                            v-if="canManageItems"
                            size="sm"
                            class="h-9 shrink-0 gap-1.5 rounded-lg text-xs"
                            :disabled="!canLaunchCreateItem"
                            @click="openCreateItemDialog"
                        >
                            <AppIcon name="plus" class="size-3.5" />
                            Create Item
                        </Button>
                    </div>

                    <div class="flex items-center gap-2 border-b px-4 py-3">
                        <SearchInput
                            id="inv-items-q"
                            v-model="itemSearch.q"
                            placeholder="Item code, name, category..."
                            class="min-w-0 flex-1 text-xs"
                            @keyup.enter="itemSearch.page = 1; reloadAll()"
                        />
                        <Button variant="outline" size="sm" class="h-9 gap-1.5 rounded-lg text-xs" @click="itemFiltersSheetOpen = true">
                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                            Filters
                            <Badge v-if="hasAnyItemFilters" variant="secondary" class="ml-1 h-5 px-1.5 text-[10px]">
                                {{ itemFilterChips.length }}
                            </Badge>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            class="hidden h-9 rounded-lg text-xs sm:inline-flex"
                            @click="compactItemRows = !compactItemRows"
                        >
                            {{ compactItemRows ? 'Comfortable Rows' : 'Compact Rows' }}
                        </Button>
                    </div>
                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="min-h-[12rem] p-4" :class="compactItemRows ? 'space-y-2' : 'space-y-3'">
                                <div v-if="loading" class="space-y-2">
                                    <div class="h-20 w-full animate-pulse rounded-lg bg-muted" />
                                    <div class="h-20 w-full animate-pulse rounded-lg bg-muted" />
                                    <div class="h-20 w-full animate-pulse rounded-lg bg-muted" />
                                </div>
                                <InventoryEmptyState
                                    v-else-if="items.length === 0"
                                    icon="package"
                                    title="No inventory items found"
                                    :description="!hasAnyItemFilters ? (inventoryItemSetupBlockedReason || 'Register the first physical stock item here after warehouses and suppliers are ready. Medicines should already exist in Clinical Care Catalog before you link them to inventory.') : 'No inventory items match the current filters.'"
                                    :chips="itemFilterChips"
                                >
                                    <template #actions>
                                        <Button v-if="hasAnyItemFilters" variant="outline" size="sm" @click="resetItemFilters()">
                                            <AppIcon name="x" class="mr-1.5 size-3.5" />
                                            Clear filters
                                        </Button>
                                        <Button v-if="canManageItems" size="sm" :disabled="!canLaunchCreateItem" @click="openCreateItemDialog">
                                            <AppIcon name="plus" class="mr-1.5 size-3.5" />
                                            Create first item
                                        </Button>
                                    </template>
                                </InventoryEmptyState>
                                <div v-else :class="compactItemRows ? 'space-y-2' : 'space-y-3'">
                                    <div
                                        v-for="item in items"
                                        :key="item.id"
                                        class="relative rounded-lg border transition-colors outline-none hover:bg-muted/30"
                                        :class="[
                                            compactItemRows ? 'p-2.5' : 'p-3',
                                            flashedItemId === item.id ? 'animate-inv-row-flash' : '',
                                        ]"
                                    >
                                        <div
                                            class="absolute inset-y-0 left-0 w-[3px] rounded-l-lg"
                                            :class="item.stockState === 'out_of_stock' ? 'bg-destructive' : item.stockState === 'low_stock' ? 'bg-amber-500' : 'bg-green-500'"
                                        />
                                        <div class="flex flex-wrap items-center justify-between gap-2 pl-2">
                                            <div>
                                                <p class="text-sm font-semibold">{{ item.itemName }}</p>
                                                <p class="text-xs text-muted-foreground">{{ item.itemCode }} | {{ item.category || 'Uncategorized' }} | {{ item.unit }}</p>
                                            </div>
                                            <div class="flex flex-wrap items-center gap-1.5">
                                                <Badge v-if="inventoryItemNeedsOpeningStock(item)" variant="outline">Opening stock pending</Badge>
                                                <Badge :class="stockAlertBadgeClass(item.stockState)">{{ stockStateLabel(item.stockState) }}</Badge>
                                            </div>
                                        </div>
                                        <div class="mt-2 grid gap-1 pl-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                                            <p>Store Stock: {{ item.currentStock }}</p>
                                            <p>Reorder Level: {{ item.reorderLevel }}</p>
                                            <p>Status: {{ formatEnumLabel(item.status || 'n/a') }}</p>
                                            <p>Code: {{ item.itemCode || 'N/A' }}</p>
                                        </div>
                                        <div class="mt-3 flex flex-wrap gap-2 pl-2">
                                            <Button v-if="canCreateMovement" size="sm" variant="outline" class="h-8 w-full gap-1.5 rounded-lg text-xs sm:w-auto" :disabled="!canLaunchStockMovement" @click="openStockMovementDialog(item)">
                                                <AppIcon name="arrow-up-down" class="size-3.5" />
                                                {{ inventoryItemStockActionLabel(item) }}
                                            </Button>
                                            <Button size="sm" variant="outline" class="h-8 w-full rounded-lg text-xs sm:w-auto" @click="openItemDetails(item)">Details</Button>
                                            <Button size="sm" variant="outline" class="h-8 w-full gap-1.5 rounded-lg text-xs sm:w-auto" @click="openDepartmentStockForItem(item)">
                                                <AppIcon name="building-2" class="size-3.5" />
                                                Where issued
                                            </Button>
                                            <Button
                                                v-if="canManageItems"
                                                size="sm"
                                                variant="secondary"
                                                class="h-8 w-full rounded-lg text-xs sm:w-auto"
                                                @click="openItemDetails(item)"
                                            >
                                                Edit / Status
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                        <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
                            <p class="text-xs text-muted-foreground">
                                Showing {{ items.length }} of {{ itemPagination?.total ?? items.length }} results &middot; Page {{ itemPagination?.currentPage ?? 1 }} of {{ itemPagination?.lastPage ?? 1 }}
                            </p>
                            <div class="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="!itemPagination || itemPagination.currentPage <= 1 || loading"
                                    @click="itemSearch.page -= 1; reloadAll()"
                                >
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Previous
                                </Button>
                                <template v-for="pg in itemPages" :key="typeof pg === 'number' ? `ip-${pg}` : `ip-e-${Math.random()}`">
                                    <span v-if="pg === '...'" class="px-1 text-xs text-muted-foreground">&hellip;</span>
                                    <Button
                                        v-else
                                        size="sm"
                                        :variant="pg === (itemPagination?.currentPage ?? 1) ? 'default' : 'outline'"
                                        class="h-8 w-8 p-0"
                                        :disabled="loading"
                                        @click="goToItemPage(pg)"
                                    >
                                        {{ pg }}
                                    </Button>
                                </template>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="!itemPagination || itemPagination.currentPage >= itemPagination.lastPage || loading"
                                    @click="itemSearch.page += 1; reloadAll()"
                                >
                                    Next
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>
                </TabsContent>

                <TabsContent value="procurement" class="mt-0 flex flex-col gap-4">

                    <Card v-if="canRead" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">

                        <!-- Header -->
                        <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                            <div class="min-w-0">
                                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                    <AppIcon name="clipboard-list" class="size-4 text-muted-foreground" />
                                    Procurement Requests
                                </h3>
                                <p class="mt-1 text-xs text-muted-foreground">Track supplier orders from request through receipt.</p>
                            </div>
                            <div class="flex shrink-0 items-center gap-2">
                                <!-- Mobile filters -->
                                <Button variant="outline" size="sm" class="h-9 gap-1.5 rounded-lg text-xs md:hidden" @click="mobileProcurementDrawerOpen = true">
                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                    Filters
                                </Button>
                                <Button
                                    v-if="canCreateRequest"
                                    size="sm"
                                    class="h-9 gap-1.5 rounded-lg text-xs"
                                    :disabled="!canLaunchProcurementRequest"
                                    @click="openCreateProcurementDialog"
                                >
                                    <AppIcon name="plus" class="size-3.5" />
                                    New Request
                                </Button>
                            </div>
                        </div>

                        <!-- Toolbar -->
                        <div class="flex items-center gap-2 border-b px-4 py-3">
                            <div class="relative min-w-0 flex-1">
                                <AppIcon name="search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    v-model="procurementSearch.q"
                                    class="h-9 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    placeholder="Request number, supplier, item…"
                                    @keydown.enter="procurementSearch.page = 1; loadProcurementRequests()"
                                />
                            </div>
                            <Select
                                :model-value="toSelectValue(procurementSearch.status)"
                                @update:model-value="procurementSearch.status = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))"
                            >
                                <SelectTrigger class="h-9 w-44 rounded-lg text-xs">
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                    <SelectItem v-for="opt in procurementStatusOptions" :key="`ps-${opt}`" :value="opt">{{ formatEnumLabel(opt) }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select
                                :model-value="toSelectValue(procurementSearch.sortBy)"
                                @update:model-value="procurementSearch.sortBy = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))"
                            >
                                <SelectTrigger class="h-9 w-40 rounded-lg text-xs">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="createdAt">Created</SelectItem>
                                    <SelectItem value="neededBy">Needed By</SelectItem>
                                    <SelectItem value="requestedQuantity">Quantity</SelectItem>
                                    <SelectItem value="status">Status</SelectItem>
                                    <SelectItem value="supplierName">Supplier</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                variant="ghost" size="sm"
                                class="h-9 gap-1.5 rounded-lg text-xs text-muted-foreground"
                                :disabled="loading"
                                @click="procurementSearch.page = 1; loadProcurementRequests()"
                            >
                                <AppIcon name="refresh-cw" class="size-3.5" />
                                Refresh
                            </Button>
                        </div>

                        <!-- Active filter chips -->
                        <div v-if="hasAnyProcurementFilters" class="flex flex-wrap items-center gap-1.5 border-b px-4 py-2">
                            <span class="text-[11px] text-muted-foreground">Filters:</span>
                            <button
                                v-for="chip in procurementFilterChips"
                                :key="chip"
                                class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80"
                                @click="resetProcurementFilters()"
                            >
                                {{ chip }} <AppIcon name="circle-x" class="size-3" />
                            </button>
                            <button class="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline" @click="resetProcurementFilters()">Clear all</button>
                        </div>

                        <!-- Skeleton loader -->
                        <div v-if="loading" class="divide-y">
                            <div v-for="n in 4" :key="`sk-pr-${n}`" class="flex items-start gap-3 px-4 py-4">
                                <div class="mt-0.5 size-1 w-[3px] self-stretch animate-pulse rounded bg-muted" />
                                <div class="min-w-0 flex-1 space-y-2">
                                    <div class="flex items-center gap-2">
                                        <div class="h-3.5 w-28 animate-pulse rounded bg-muted" />
                                        <div class="h-5 w-16 animate-pulse rounded-full bg-muted" />
                                    </div>
                                    <div class="h-3 w-3/4 animate-pulse rounded bg-muted" />
                                    <div class="h-3 w-1/2 animate-pulse rounded bg-muted" />
                                </div>
                                <div class="h-8 w-20 animate-pulse rounded-lg bg-muted" />
                            </div>
                        </div>

                        <!-- Empty state -->
                        <div
                            v-else-if="procurementRequests.length === 0"
                            class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
                        >
                            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                <AppIcon name="clipboard-list" class="size-5 text-muted-foreground/40" />
                            </div>
                            <div>
                                <p class="text-sm font-medium text-muted-foreground">
                                    {{ hasAnyProcurementFilters ? 'No requests match the current filters' : 'No procurement requests yet' }}
                                </p>
                                <p class="mt-0.5 text-xs text-muted-foreground/70">
                                    {{ hasAnyProcurementFilters ? 'Try adjusting or clearing your filters.' : 'Create requests after stock demand or low-stock need is identified.' }}
                                </p>
                            </div>
                            <div class="flex items-center gap-2">
                                <Button v-if="hasAnyProcurementFilters" variant="outline" size="sm" class="h-8 rounded-lg text-xs" @click="resetProcurementFilters()">
                                    Clear filters
                                </Button>
                                <Button v-if="canCreateRequest" size="sm" class="h-8 gap-1.5 rounded-lg text-xs" :disabled="!canLaunchProcurementRequest" @click="openCreateProcurementDialog">
                                    <AppIcon name="plus" class="size-3.5" />
                                    Create request
                                </Button>
                            </div>
                        </div>

                        <!-- Request rows -->
                        <div v-else class="divide-y">
                            <div
                                v-for="request in procurementRequests"
                                :key="request.id"
                                class="relative flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/30"
                                :class="flashedRequestId === request.id ? 'animate-inv-row-flash' : ''"
                            >
                                <!-- Status accent stripe -->
                                <div
                                    class="absolute inset-y-0 left-0 w-[3px] rounded-l"
                                    :class="request.status === 'draft' ? 'bg-muted-foreground/30' : request.status === 'pending_approval' ? 'bg-blue-400' : request.status === 'approved' ? 'bg-green-500' : request.status === 'ordered' ? 'bg-amber-500' : request.status === 'received' ? 'bg-emerald-500' : request.status === 'rejected' ? 'bg-red-500' : request.status === 'cancelled' ? 'bg-muted-foreground/20' : 'bg-muted-foreground/30'"
                                />
                                <!-- Content -->
                                <div class="min-w-0 flex-1">
                                    <!-- Row 1: number + badges -->
                                    <div class="flex flex-wrap items-center gap-2">
                                        <p class="text-sm font-semibold">{{ request.requestNumber }}</p>
                                        <span
                                            class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                                            :class="request.status === 'draft' ? 'bg-muted text-muted-foreground ring-border' : request.status === 'pending_approval' ? 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-500/30' : request.status === 'approved' ? 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/30' : request.status === 'ordered' ? 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-500/30' : request.status === 'received' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-500/30' : request.status === 'rejected' ? 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-500/30' : 'bg-muted text-muted-foreground ring-border'"
                                        >
                                            {{ formatEnumLabel(request.status) }}
                                        </span>
                                        <span v-if="request.sourceDepartmentRequisitionId" class="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-900/30 dark:text-sky-400 dark:ring-sky-500/30">
                                            Dept shortage
                                        </span>
                                    </div>
                                    <!-- Row 2: item · qty · supplier · needed-by -->
                                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                        <span>{{ request.itemName || request.itemId }}</span>
                                        <span>&middot;</span>
                                        <span>Qty: <strong class="text-foreground">{{ request.requestedQuantity }}</strong></span>
                                        <span v-if="request.supplierName || supplierLabel(request.supplierId)">&middot; {{ request.supplierName || supplierLabel(request.supplierId) }}</span>
                                        <span v-if="request.neededBy">&middot; Needed {{ request.neededBy }}</span>
                                    </div>
                                    <!-- Row 3: cost + source -->
                                    <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                        <span v-if="request.unitCostEstimate">Unit: {{ formatAmount(request.unitCostEstimate) }}</span>
                                        <span v-if="request.totalCostEstimate">&middot; Total est: {{ formatAmount(request.totalCostEstimate) }}</span>
                                        <span v-if="request.sourceDepartmentRequisitionId" class="text-muted-foreground/70">&middot; {{ procurementSourceLabel(request) }}</span>
                                    </div>
                                    <!-- CTAs -->
                                    <div class="mt-2.5 flex flex-wrap items-center gap-2">
                                        <Button size="sm" variant="outline" class="h-7 rounded-lg px-2.5 text-xs" @click="openDetails(request)">
                                            Details
                                        </Button>
                                        <Button
                                            v-if="request.sourceDepartmentRequisitionId && request.status !== 'received'"
                                            size="sm" variant="outline"
                                            class="h-7 rounded-lg px-2.5 text-xs"
                                            :disabled="sourceRequisitionOpeningId === String(request.id)"
                                            @click="openSourceRequisitionFromProcurement(request)"
                                        >
                                            {{ sourceRequisitionOpeningId === String(request.id) ? 'Opening...' : 'Source Req.' }}
                                        </Button>
                                        <template v-if="canUpdateRequestStatus">
                                            <Button
                                                v-if="procurementPrimaryAction(request)"
                                                size="sm"
                                                class="h-7 rounded-lg px-2.5 text-xs"
                                                :disabled="sourceRequisitionOpeningId === String(request.id)"
                                                @click="procurementPrimaryAction(request)!.handler()"
                                            >
                                                {{ procurementPrimaryAction(request)!.label }}
                                            </Button>
                                            <DropdownMenu v-if="procurementOverflowActions(request).length">
                                                <DropdownMenuTrigger as-child>
                                                    <Button size="sm" variant="outline" class="h-7 rounded-lg px-2 text-xs">
                                                        <AppIcon name="ellipsis-vertical" class="size-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        v-for="act in procurementOverflowActions(request)"
                                                        :key="act.label"
                                                        @click="act.handler()"
                                                    >
                                                        {{ act.label }}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </template>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Footer pagination -->
                        <footer class="flex shrink-0 items-center justify-between gap-2 border-t bg-muted/20 px-4 py-2.5">
                            <p class="text-xs text-muted-foreground">
                                {{ procurementRequests.length }} of {{ procurementPagination?.total ?? procurementRequests.length }} &middot; Page {{ procurementPagination?.currentPage ?? 1 }}/{{ procurementPagination?.lastPage ?? 1 }}
                            </p>
                            <div class="flex items-center gap-1">
                                <Button
                                    variant="outline" size="sm" class="h-8 gap-1.5 rounded-lg text-xs"
                                    :disabled="!procurementPagination || procurementPagination.currentPage <= 1 || loading"
                                    @click="procurementSearch.page -= 1; loadProcurementRequests()"
                                >
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Prev
                                </Button>
                                <template v-for="pg in procurementPages" :key="typeof pg === 'number' ? `pp-${pg}` : `pp-e-${Math.random()}`">
                                    <span v-if="pg === '...'" class="px-1 text-xs text-muted-foreground">&hellip;</span>
                                    <Button
                                        v-else size="sm"
                                        :variant="pg === (procurementPagination?.currentPage ?? 1) ? 'default' : 'outline'"
                                        class="h-8 w-8 rounded-lg p-0 text-xs"
                                        :disabled="loading"
                                        @click="goToProcurementPage(pg as number)"
                                    >
                                        {{ pg }}
                                    </Button>
                                </template>
                                <Button
                                    variant="outline" size="sm" class="h-8 gap-1.5 rounded-lg text-xs"
                                    :disabled="!procurementPagination || procurementPagination.currentPage >= procurementPagination.lastPage || loading"
                                    @click="procurementSearch.page += 1; loadProcurementRequests()"
                                >
                                    Next
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </footer>
                    </Card>

                </TabsContent>

                <TabsContent value="ledger" class="mt-0 flex flex-col gap-4">

                    <!-- KPI stat strip -->
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                <AppIcon name="activity" class="size-4 text-muted-foreground" />
                            </span>
                            <div>
                                <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Movements</p>
                                <p class="text-xl font-bold leading-tight tabular-nums">{{ stockLedgerSummary.total ?? '—' }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40">
                                <AppIcon name="arrow-right" class="size-4 text-green-600 dark:text-green-400" />
                            </span>
                            <div>
                                <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Receipts</p>
                                <p class="text-xl font-bold leading-tight tabular-nums">{{ stockLedgerSummary.receive ?? '—' }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                                <AppIcon name="package" class="size-4 text-amber-600 dark:text-amber-400" />
                            </span>
                            <div>
                                <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Issues</p>
                                <p class="text-xl font-bold leading-tight tabular-nums">{{ stockLedgerSummary.issue ?? '—' }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                <AppIcon name="activity" class="size-4 text-muted-foreground" />
                            </span>
                            <div>
                                <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Net Qty Δ</p>
                                <p
                                    class="text-xl font-bold leading-tight tabular-nums"
                                    :class="(stockLedgerSummary.netQuantityDelta ?? 0) > 0 ? 'text-green-600 dark:text-green-400' : (stockLedgerSummary.netQuantityDelta ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : ''"
                                >
                                    {{ stockLedgerSummary.netQuantityDelta ?? '—' }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <Card v-if="canRead" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">

                        <!-- Header -->
                        <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                            <div class="min-w-0">
                                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                    <AppIcon name="activity" class="size-4 text-muted-foreground" />
                                    Stock Ledger
                                </h3>
                                <p class="mt-1 text-xs text-muted-foreground">Receive, issue, adjustment, transfer, and reconciliation movements.</p>
                            </div>
                            <div class="flex shrink-0 items-center gap-2">
                                <Button
                                    variant="outline" size="sm"
                                    class="h-9 gap-1.5 rounded-lg text-xs"
                                    :disabled="stockLedgerLoading"
                                    @click="exportStockLedgerCsv"
                                >
                                    <AppIcon name="file-text" class="size-3.5" />
                                    Export CSV
                                </Button>
                                <Button
                                    :variant="stockLedgerFiltersOpen ? 'default' : 'outline'" size="sm"
                                    class="h-9 gap-1.5 rounded-lg text-xs"
                                    :disabled="stockLedgerLoading"
                                    @click="stockLedgerFiltersOpen = !stockLedgerFiltersOpen"
                                >
                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                    Filters
                                </Button>
                            </div>
                        </div>

                        <!-- Main toolbar -->
                        <div class="flex items-center gap-2 border-b px-4 py-3">
                            <div class="relative min-w-0 flex-1">
                                <AppIcon name="search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    v-model="stockLedgerFilters.q"
                                    class="h-9 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    placeholder="Search item, reason, notes, reference…"
                                    @keydown.enter="applyStockLedgerFilters"
                                />
                            </div>
                            <Select
                                :model-value="toSelectValue(stockLedgerFilters.movementType)"
                                @update:model-value="stockLedgerFilters.movementType = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))"
                            >
                                <SelectTrigger class="h-9 w-44 rounded-lg text-xs">
                                    <SelectValue placeholder="All types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="EMPTY_SELECT_VALUE">All types</SelectItem>
                                    <SelectItem v-for="opt in movementTypeOptions" :key="`lt-${opt}`" :value="opt">{{ formatEnumLabel(opt) }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select
                                :model-value="toSelectValue(stockLedgerFilters.sourceKey)"
                                @update:model-value="stockLedgerFilters.sourceKey = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))"
                            >
                                <SelectTrigger class="h-9 w-48 rounded-lg text-xs">
                                    <SelectValue placeholder="All sources" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="option in stockLedgerSourceOptions" :key="`ls-${option.value || 'all'}`" :value="toSelectValue(option.value)">{{ option.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="ghost" size="sm" class="h-9 gap-1.5 rounded-lg text-xs text-muted-foreground" :disabled="stockLedgerLoading" @click="applyStockLedgerFilters">
                                <AppIcon name="refresh-cw" class="size-3.5" />
                                Refresh
                            </Button>
                        </div>

                        <!-- Advanced filters panel (collapsible) -->
                        <div v-if="stockLedgerFiltersOpen" class="grid gap-3 border-b bg-muted/20 px-4 py-3 md:grid-cols-4">
                            <div class="grid gap-1">
                                <label class="text-xs font-medium text-muted-foreground">Item ID</label>
                                <input
                                    v-model="stockLedgerFilters.itemId"
                                    class="h-9 rounded-lg border border-input bg-transparent px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    placeholder="Inventory item UUID"
                                />
                            </div>
                            <div class="grid gap-1">
                                <label class="text-xs font-medium text-muted-foreground">Actor Type</label>
                                <Select
                                    :model-value="toSelectValue(stockLedgerFilters.actorType)"
                                    @update:model-value="stockLedgerFilters.actorType = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))"
                                >
                                    <SelectTrigger class="h-9 rounded-lg text-xs">
                                        <SelectValue placeholder="All actors" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="option in auditActorTypeOptions" :key="`la-${option.value || 'all'}`" :value="toSelectValue(option.value)">{{ option.label }}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-1">
                                <label class="text-xs font-medium text-muted-foreground">From</label>
                                <input
                                    v-model="stockLedgerFilters.from"
                                    type="datetime-local"
                                    class="h-9 rounded-lg border border-input bg-transparent px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                            </div>
                            <div class="grid gap-1">
                                <label class="text-xs font-medium text-muted-foreground">To</label>
                                <input
                                    v-model="stockLedgerFilters.to"
                                    type="datetime-local"
                                    class="h-9 rounded-lg border border-input bg-transparent px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                            </div>
                            <div class="flex items-end gap-2 md:col-span-4">
                                <Button size="sm" class="h-9 rounded-lg text-xs" :disabled="stockLedgerLoading" @click="applyStockLedgerFilters">
                                    {{ stockLedgerLoading ? 'Applying…' : 'Apply Filters' }}
                                </Button>
                                <Button size="sm" variant="outline" class="h-9 rounded-lg text-xs" :disabled="stockLedgerLoading" @click="resetStockLedgerFilters">
                                    Reset
                                </Button>
                            </div>
                        </div>

                        <!-- Active filter chips -->
                        <div
                            v-if="stockLedgerFilters.q || stockLedgerFilters.movementType || stockLedgerFilters.sourceKey || stockLedgerFilters.from || stockLedgerFilters.to || stockLedgerFilters.itemId"
                            class="flex flex-wrap items-center gap-1.5 border-b px-4 py-2"
                        >
                            <span class="text-[11px] text-muted-foreground">Filters:</span>
                            <button v-if="stockLedgerFilters.q" class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80" @click="stockLedgerFilters.q = ''; applyStockLedgerFilters()">
                                "{{ stockLedgerFilters.q }}" <AppIcon name="circle-x" class="size-3" />
                            </button>
                            <button v-if="stockLedgerFilters.movementType" class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80" @click="stockLedgerFilters.movementType = ''; applyStockLedgerFilters()">
                                {{ formatEnumLabel(stockLedgerFilters.movementType) }} <AppIcon name="circle-x" class="size-3" />
                            </button>
                            <button v-if="stockLedgerFilters.sourceKey" class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80" @click="stockLedgerFilters.sourceKey = ''; applyStockLedgerFilters()">
                                {{ stockLedgerSourceOptions.find(o => o.value === stockLedgerFilters.sourceKey)?.label ?? stockLedgerFilters.sourceKey }} <AppIcon name="circle-x" class="size-3" />
                            </button>
                            <button v-if="stockLedgerFilters.from || stockLedgerFilters.to" class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80" @click="stockLedgerFilters.from = ''; stockLedgerFilters.to = ''; applyStockLedgerFilters()">
                                Date range <AppIcon name="circle-x" class="size-3" />
                            </button>
                        </div>

                        <!-- Skeleton loader -->
                        <div v-if="stockLedgerLoading" class="divide-y">
                            <div v-for="n in 5" :key="`sk-sl-${n}`" class="flex items-start gap-3 px-4 py-4">
                                <div class="size-9 shrink-0 animate-pulse rounded-lg bg-muted" />
                                <div class="min-w-0 flex-1 space-y-2">
                                    <div class="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
                                    <div class="h-3 w-2/3 animate-pulse rounded bg-muted" />
                                </div>
                                <div class="h-8 w-14 animate-pulse rounded-lg bg-muted" />
                            </div>
                        </div>

                        <!-- Empty state -->
                        <div
                            v-else-if="stockMovements.length === 0"
                            class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
                        >
                            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                <AppIcon name="activity" class="size-5 text-muted-foreground/40" />
                            </div>
                            <div>
                                <p class="text-sm font-medium text-muted-foreground">No stock movements found</p>
                                <p class="mt-0.5 text-xs text-muted-foreground/70">Movements appear after receipts, issues, adjustments, transfers, or reconciliations.</p>
                            </div>
                            <button class="text-xs text-muted-foreground underline-offset-2 hover:underline" @click="resetStockLedgerFilters">Clear filters</button>
                        </div>

                        <!-- Movement rows -->
                        <div v-else class="divide-y">
                            <div
                                v-for="movement in stockMovements"
                                :key="movement.id"
                                class="relative flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/30"
                            >
                                <!-- Type accent stripe -->
                                <div
                                    class="absolute inset-y-0 left-0 w-[3px] rounded-l"
                                    :class="movement.movementType === 'receive' ? 'bg-green-500' : movement.movementType === 'issue' ? 'bg-amber-500' : movement.movementType === 'adjust' ? 'bg-blue-500' : movement.movementType === 'transfer' ? 'bg-sky-500' : 'bg-muted-foreground/30'"
                                />
                                <!-- Type icon avatar -->
                                <span
                                    class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
                                    :class="movement.movementType === 'receive' ? 'bg-green-100 dark:bg-green-900/40' : movement.movementType === 'issue' ? 'bg-amber-100 dark:bg-amber-900/40' : movement.movementType === 'adjust' ? 'bg-blue-100 dark:bg-blue-900/40' : movement.movementType === 'transfer' ? 'bg-sky-100 dark:bg-sky-900/40' : 'bg-muted/60'"
                                >
                                    <AppIcon
                                        :name="movement.movementType === 'receive' ? 'arrow-right' : movement.movementType === 'issue' ? 'package' : movement.movementType === 'adjust' ? 'sliders-horizontal' : movement.movementType === 'transfer' ? 'arrow-right' : 'activity'"
                                        class="size-4"
                                        :class="movement.movementType === 'receive' ? 'text-green-600 dark:text-green-400' : movement.movementType === 'issue' ? 'text-amber-600 dark:text-amber-400' : movement.movementType === 'adjust' ? 'text-blue-600 dark:text-blue-400' : movement.movementType === 'transfer' ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground'"
                                    />
                                </span>
                                <!-- Main content -->
                                <div class="min-w-0 flex-1">
                                    <div class="flex flex-wrap items-start justify-between gap-2">
                                        <p class="text-sm font-medium leading-tight">{{ movement.item?.itemName || movement.itemId }}</p>
                                        <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                                            <span
                                                class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                                                :class="movement.movementType === 'receive' ? 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/30' : movement.movementType === 'issue' ? 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-500/30' : movement.movementType === 'adjust' ? 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-500/30' : movement.movementType === 'transfer' ? 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-900/30 dark:text-sky-400 dark:ring-sky-500/30' : 'bg-muted text-muted-foreground ring-border'"
                                            >
                                                {{ formatEnumLabel(movement.movementType) }}
                                            </span>
                                            <span v-if="movement.sourceLabel" class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                                {{ movement.sourceLabel }}
                                            </span>
                                        </div>
                                    </div>
                                    <!-- Timestamp + reason -->
                                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                        <span>{{ movement.item?.itemCode || movement.itemId }}</span>
                                        <span>&middot;</span>
                                        <span>{{ formatDateTime(movement.occurredAt || movement.createdAt) }}</span>
                                        <span v-if="movement.reason">&middot; {{ movement.reason }}</span>
                                    </div>
                                    <!-- Stock before/after -->
                                    <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                        <span>Qty: <strong class="text-foreground">{{ movement.quantity }}</strong></span>
                                        <span>Before: <strong class="text-foreground">{{ movement.stockBefore }}</strong></span>
                                        <span>&rarr;</span>
                                        <span>After: <strong class="text-foreground">{{ movement.stockAfter }}</strong></span>
                                        <span v-if="stockMovementSourceSummary(movement)" class="text-muted-foreground/70">&middot; {{ stockMovementSourceSummary(movement) }}</span>
                                    </div>
                                    <!-- Reconciliation detail -->
                                    <div v-if="movement.reconciliation" class="mt-1 text-xs text-muted-foreground">
                                        Expected {{ movement.reconciliation.expectedStock }} &middot; Counted {{ movement.reconciliation.countedStock }} &middot; Variance {{ movement.reconciliation.varianceQuantity }}
                                    </div>
                                    <p v-if="movement.notes" class="mt-1 text-xs italic text-muted-foreground/70">{{ movement.notes }}</p>
                                </div>
                                <!-- Delta pill -->
                                <span
                                    class="mt-0.5 shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums"
                                    :class="(movement.quantityDelta ?? 0) > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : (movement.quantityDelta ?? 0) < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-muted text-muted-foreground'"
                                >
                                    {{ (movement.quantityDelta ?? 0) > 0 ? '+' : '' }}{{ movement.quantityDelta ?? 0 }}
                                </span>
                            </div>
                        </div>

                        <!-- Footer pagination -->
                        <footer class="flex shrink-0 items-center justify-between gap-2 border-t bg-muted/20 px-4 py-2.5">
                            <p class="text-xs text-muted-foreground">
                                {{ stockMovements.length }} of {{ stockMovementPagination?.total ?? stockMovements.length }} &middot; Page {{ stockMovementPagination?.currentPage ?? 1 }}/{{ stockMovementPagination?.lastPage ?? 1 }}
                            </p>
                            <div class="flex items-center gap-1">
                                <Button
                                    variant="outline" size="sm" class="h-8 gap-1.5 rounded-lg text-xs"
                                    :disabled="stockLedgerLoading || !stockMovementPagination || stockMovementPagination.currentPage <= 1"
                                    @click="goToStockLedgerPage((stockMovementPagination?.currentPage ?? 2) - 1)"
                                >
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Prev
                                </Button>
                                <template v-for="pg in stockLedgerPages" :key="typeof pg === 'number' ? `sl-${pg}` : `sl-e-${Math.random()}`">
                                    <span v-if="pg === '...'" class="px-1 text-xs text-muted-foreground">&hellip;</span>
                                    <Button
                                        v-else size="sm"
                                        :variant="pg === (stockMovementPagination?.currentPage ?? 1) ? 'default' : 'outline'"
                                        class="h-8 w-8 rounded-lg p-0 text-xs"
                                        :disabled="stockLedgerLoading"
                                        @click="goToStockLedgerPage(pg as number)"
                                    >
                                        {{ pg }}
                                    </Button>
                                </template>
                                <Button
                                    variant="outline" size="sm" class="h-8 gap-1.5 rounded-lg text-xs"
                                    :disabled="stockLedgerLoading || !stockMovementPagination || stockMovementPagination.currentPage >= stockMovementPagination.lastPage"
                                    @click="goToStockLedgerPage((stockMovementPagination?.currentPage ?? 0) + 1)"
                                >
                                    Next
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </footer>
                    </Card>

                    <!-- Access restricted -->
                    <Card v-else class="rounded-lg border-sidebar-border/70">
                        <div class="flex items-start gap-3 border-b px-4 py-3.5">
                            <AppIcon name="activity" class="mt-0.5 size-4 text-muted-foreground" />
                            <div>
                                <p class="text-sm font-semibold">Stock Ledger</p>
                                <p class="text-xs text-muted-foreground">Stock ledger access is permission restricted.</p>
                            </div>
                        </div>
                        <div class="px-4 py-4">
                            <div class="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                                <AppIcon name="alert-triangle" class="mt-0.5 size-4 shrink-0" />
                                <span>Access restricted — request <code>inventory.procurement.read</code> permission.</span>
                            </div>
                        </div>
                    </Card>

                </TabsContent>

                <TabsContent value="department-stock" class="mt-0 flex flex-col gap-4">

                <!-- KPI stat strip -->
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                            <AppIcon name="package" class="size-4 text-muted-foreground" />
                        </span>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Holdings</p>
                            <p class="text-xl font-bold leading-tight tabular-nums">{{ departmentStockSummary.totalRows ?? '—' }}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                            <AppIcon name="building-2" class="size-4 text-muted-foreground" />
                        </span>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Departments</p>
                            <p class="text-xl font-bold leading-tight tabular-nums">{{ departmentStockSummary.departments ?? '—' }}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                            <AppIcon name="clipboard-list" class="size-4 text-muted-foreground" />
                        </span>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Issued items</p>
                            <p class="text-xl font-bold leading-tight tabular-nums">{{ departmentStockSummary.items ?? '—' }}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                            <AppIcon name="calendar-clock" class="size-4 text-muted-foreground" />
                        </span>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Last issue</p>
                            <p class="text-sm font-bold leading-tight">{{ departmentStockSummary.lastIssuedAt ? formatDateTime(departmentStockSummary.lastIssuedAt) : '—' }}</p>
                        </div>
                    </div>
                </div>

                <Card v-if="canRead" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">

                    <!-- Header -->
                    <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                        <div class="min-w-0">
                            <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                <AppIcon name="package" class="size-4 text-muted-foreground" />
                                Department Stock
                            </h3>
                            <p class="mt-1 text-xs text-muted-foreground">Stock issued out of the store and held by departments for local use.</p>
                        </div>
                        <Button size="sm" variant="outline" class="h-9 shrink-0 gap-1.5 text-xs" :disabled="departmentStockLoading" @click="departmentStockFiltersOpen = !departmentStockFiltersOpen">
                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                            {{ departmentStockFiltersOpen ? 'Hide filters' : 'Filters' }}
                        </Button>
                    </div>

                    <div
                        v-if="departmentStockScopedItem"
                        class="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-2.5"
                    >
                        <div class="min-w-0">
                            <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Item trace</p>
                            <p class="truncate text-sm font-semibold">
                                {{ departmentStockScopedItem.name }}
                                <span v-if="departmentStockScopedItem.code" class="font-mono text-xs text-muted-foreground">({{ departmentStockScopedItem.code }})</span>
                            </p>
                        </div>
                        <Button size="sm" variant="outline" class="h-8 shrink-0 rounded-lg text-xs" :disabled="departmentStockLoading" @click="clearDepartmentStockItemScope">
                            Clear item
                        </Button>
                    </div>

                    <!-- Collapsible filter panel -->
                    <div v-if="departmentStockFiltersOpen" class="grid gap-3 border-b px-4 py-3 sm:grid-cols-4">
                        <div class="sm:col-span-2">
                            <Label for="department-stock-q" class="sr-only">Search</Label>
                            <SearchInput id="department-stock-q" v-model="departmentStockFilters.q" placeholder="Department, item, category, warehouse…" class="w-full" />
                        </div>
                        <div>
                            <Label for="department-stock-department" class="sr-only">Department</Label>
                            <Select :model-value="toSelectValue(departmentStockFilters.departmentId)" @update:model-value="departmentStockFilters.departmentId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                <SelectTrigger class="h-9 w-full text-xs">
                                    <SelectValue placeholder="All departments" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="EMPTY_SELECT_VALUE">All departments</SelectItem>
                                    <SelectItem v-for="department in requisitionDepartmentOptions" :key="`department-stock-${department.id}`" :value="department.id" :text-value="lookupOptionText(department)">
                                        {{ department.name }}<span v-if="department.code" class="text-muted-foreground"> ({{ department.code }})</span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="flex items-center gap-2">
                            <Button size="sm" class="h-9 flex-1 gap-1.5 text-xs" :disabled="departmentStockLoading" @click="applyDepartmentStockFilters">
                                <AppIcon name="search" class="size-3.5" />
                                {{ departmentStockLoading ? 'Applying…' : 'Apply' }}
                            </Button>
                            <Button size="sm" variant="outline" class="h-9 gap-1.5 text-xs" :disabled="departmentStockLoading" @click="resetDepartmentStockFilters">
                                <AppIcon name="x" class="size-3.5" />
                                Reset
                            </Button>
                        </div>
                    </div>

                    <!-- Info banner -->
                    <div class="flex items-start gap-3 border-b bg-sky-50/60 px-4 py-2.5 text-xs text-sky-800 dark:bg-sky-950/20 dark:text-sky-200">
                        <AppIcon name="info" class="mt-0.5 size-3.5 shrink-0 text-sky-500" />
                        <span>Store stock and department stock are intentionally separate. This view shows where issued stock went — consumption, returns and wastage come in the next operational layer.</span>
                    </div>

                    <CardContent class="flex-1 overflow-auto p-0">

                        <!-- Skeleton -->
                        <div v-if="departmentStockLoading" class="divide-y">
                            <div v-for="n in 5" :key="n" class="flex items-start gap-4 px-4 py-4">
                                <div class="flex-1 space-y-2">
                                    <div class="flex items-center gap-2">
                                        <div class="h-3.5 w-36 animate-pulse rounded-md bg-muted/70"></div>
                                        <div class="h-4 w-16 animate-pulse rounded-full bg-muted/50"></div>
                                        <div class="h-4 w-12 animate-pulse rounded-full bg-muted/50"></div>
                                    </div>
                                    <div class="flex gap-3">
                                        <div class="h-3 w-24 animate-pulse rounded-md bg-muted/50"></div>
                                        <div class="h-3 w-28 animate-pulse rounded-md bg-muted/40"></div>
                                        <div class="h-3 w-20 animate-pulse rounded-md bg-muted/40"></div>
                                    </div>
                                </div>
                                <div class="h-7 w-20 animate-pulse rounded-lg bg-muted/60"></div>
                            </div>
                        </div>

                        <!-- Empty -->
                        <div v-else-if="departmentStock.length === 0" class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                <AppIcon name="package" class="size-5 text-muted-foreground/40" />
                            </div>
                            <div class="space-y-1">
                                <p class="text-sm font-semibold">No department stock recorded yet</p>
                                <p class="max-w-xs text-xs text-muted-foreground">Department stock appears after a requisition is issued from the store to a department.</p>
                            </div>
                        </div>

                        <!-- Stock rows -->
                        <div v-else class="divide-y">
                            <div
                                v-for="row in departmentStock"
                                :key="row.id"
                                class="flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-muted/20"
                            >
                                <!-- Main content -->
                                <div class="min-w-0 flex-1 space-y-1.5">
                                    <!-- Row 1: name + dept badge + qty badge -->
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="truncate text-sm font-semibold">{{ row.itemName || row.itemId }}</span>
                                        <Badge variant="secondary" class="shrink-0 text-[11px]">{{ row.departmentName }}</Badge>
                                        <Badge variant="outline" class="shrink-0 font-mono text-[11px]">
                                            {{ formatAmount(row.issuedQuantity) }} {{ row.unit || '' }}
                                        </Badge>
                                    </div>
                                    <!-- Row 2: meta details -->
                                    <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                        <span class="flex items-center gap-1">
                                            <AppIcon name="tag" class="size-3 opacity-60" />
                                            {{ row.itemCode || row.itemId }}
                                            <template v-if="row.category"> · {{ formatEnumLabel(row.category) }}</template>
                                            <template v-if="row.subcategory"> / {{ formatEnumLabel(row.subcategory) }}</template>
                                        </span>
                                        <span class="flex items-center gap-1">
                                            <AppIcon name="warehouse" class="size-3 opacity-60" />
                                            {{ row.sourceWarehouseName || row.sourceWarehouseCode || 'Store not recorded' }}
                                        </span>
                                        <span class="flex items-center gap-1">
                                            <AppIcon name="refresh-cw" class="size-3 opacity-60" />
                                            {{ row.movementCount }} movement{{ row.movementCount === 1 ? '' : 's' }}
                                        </span>
                                        <span class="flex items-center gap-1">
                                            <AppIcon name="clock" class="size-3 opacity-60" />
                                            Last issued {{ formatDateTime(row.lastIssuedAt) }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>

                    <!-- Pagination -->
                    <footer v-if="departmentStockPagination" class="flex shrink-0 items-center justify-between border-t px-4 py-3">
                        <p class="text-xs text-muted-foreground">
                            Showing {{ departmentStock.length }} of {{ departmentStockPagination.total ?? departmentStock.length }}
                            · Page {{ departmentStockPagination.currentPage }} of {{ departmentStockPagination.lastPage }}
                        </p>
                        <div class="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                class="h-8 gap-1.5 text-xs"
                                :disabled="departmentStockLoading || departmentStockPagination.currentPage <= 1"
                                @click="goToDepartmentStockPage(departmentStockPagination.currentPage - 1)"
                            >
                                <AppIcon name="chevron-left" class="size-3.5" />
                                Previous
                            </Button>
                            <template v-for="pg in departmentStockPages" :key="typeof pg === 'number' ? `ds-${pg}` : `ds-e-${Math.random()}`">
                                <span v-if="pg === '...'" class="px-1 text-xs text-muted-foreground">&hellip;</span>
                                <Button
                                    v-else
                                    size="sm"
                                    :variant="pg === departmentStockPagination.currentPage ? 'default' : 'outline'"
                                    class="h-8 w-8 p-0 text-xs"
                                    :disabled="departmentStockLoading"
                                    @click="goToDepartmentStockPage(pg as number)"
                                >{{ pg }}</Button>
                            </template>
                            <Button
                                variant="outline"
                                size="sm"
                                class="h-8 gap-1.5 text-xs"
                                :disabled="departmentStockLoading || departmentStockPagination.currentPage >= departmentStockPagination.lastPage"
                                @click="goToDepartmentStockPage(departmentStockPagination.currentPage + 1)"
                            >
                                Next
                                <AppIcon name="chevron-right" class="size-3.5" />
                            </Button>
                        </div>
                    </footer>
                </Card>

                <Card v-else class="rounded-lg border-sidebar-border/70 shadow-sm">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="package" class="size-5 text-muted-foreground" />
                            Department Stock
                        </CardTitle>
                        <CardDescription>Department stock access is permission restricted.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div class="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                            <AppIcon name="lock" class="mt-0.5 size-4 shrink-0 text-destructive" />
                            <div>
                                <p class="text-sm font-semibold text-destructive">Access restricted</p>
                                <p class="mt-0.5 text-xs text-destructive/80">Request <code class="rounded bg-destructive/10 px-1">inventory.procurement.read</code> permission.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                </TabsContent>

                <!-- Department Requisitions tab -->
                <TabsContent value="requisitions" class="mt-0 flex flex-col gap-4">
                <Card v-if="canRead" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">

                    <!-- Header -->
                    <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                        <div class="min-w-0">
                            <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                <AppIcon name="clipboard-list" class="size-4 text-muted-foreground" />
                                Department Requisitions
                            </h3>
                            <p class="mt-1 text-xs text-muted-foreground">Internal requests from hospital departments for inventory items.</p>
                        </div>
                        <Button v-if="canCreateRequest" size="sm" class="h-9 shrink-0 gap-1.5" @click="openCreateRequisitionDialog">
                            <AppIcon name="plus" class="size-3.5" />
                            New Requisition
                        </Button>
                    </div>

                    <!-- Toolbar -->
                    <div class="flex items-center gap-2 border-b px-4 py-3">
                        <SearchInput
                            id="req-search-q"
                            v-model="deptReqSearch.q"
                            placeholder="Req # or department…"
                            class="min-w-0 flex-1"
                            @keyup.enter="deptReqSearch.page = 1; loadDeptRequisitions()"
                        />
                        <Select :model-value="toSelectValue(deptReqSearch.status)" @update:model-value="deptReqSearch.status = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                            <SelectTrigger class="h-9 w-36 text-xs">
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                <SelectItem v-for="s in REQUISITION_STATUSES" :key="s" :value="s">{{ formatEnumLabel(s) }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            v-if="canSelectAnyRequisitionDepartment"
                            :model-value="toSelectValue(deptReqSearch.departmentId)"
                            @update:model-value="deptReqSearch.departmentId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))"
                        >
                            <SelectTrigger class="h-9 w-44 text-xs" :disabled="!canSelectAnyRequisitionDepartment">
                                <SelectValue placeholder="All departments" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-if="canSelectAnyRequisitionDepartment" :value="EMPTY_SELECT_VALUE">All departments</SelectItem>
                                <SelectItem v-for="department in requisitionDepartmentOptions" :key="department.id" :value="department.id" :text-value="lookupOptionText(department)">
                                    {{ lookupOptionText(department) }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" class="h-9 gap-1.5 text-xs" @click="deptReqSearch.page = 1; loadDeptRequisitions()">
                            <AppIcon name="search" class="size-3.5" />
                            Search
                        </Button>
                        <Button v-if="hasAnyDeptReqFilters" size="sm" variant="ghost" class="h-9 gap-1.5 text-xs text-muted-foreground" @click="resetDeptReqFilters">
                            <AppIcon name="x" class="size-3.5" />
                            Reset
                        </Button>
                    </div>

                    <!-- Active filter chips -->
                    <div v-if="deptReqFilterChips.length" class="flex flex-wrap gap-1.5 border-b px-4 py-2">
                        <Badge v-for="chip in deptReqFilterChips" :key="chip" variant="secondary" class="rounded-md text-xs">
                            {{ chip }}
                        </Badge>
                    </div>

                    <CardContent class="flex-1 overflow-auto p-0">

                        <!-- Skeleton loading -->
                        <div v-if="deptReqLoading" class="divide-y">
                            <div v-for="n in 5" :key="n" class="flex items-center gap-4 px-4 py-4">
                                <div class="h-full w-[3px] shrink-0 self-stretch rounded-full bg-muted/50"></div>
                                <div class="flex-1 space-y-2">
                                    <div class="flex items-center gap-2">
                                        <div class="h-3.5 w-24 animate-pulse rounded-md bg-muted/70"></div>
                                        <div class="h-4 w-14 animate-pulse rounded-full bg-muted/50"></div>
                                        <div class="h-4 w-16 animate-pulse rounded-full bg-muted/50"></div>
                                    </div>
                                    <div class="flex gap-3">
                                        <div class="h-3 w-28 animate-pulse rounded-md bg-muted/50"></div>
                                        <div class="h-3 w-20 animate-pulse rounded-md bg-muted/40"></div>
                                        <div class="h-3 w-20 animate-pulse rounded-md bg-muted/40"></div>
                                    </div>
                                </div>
                                <div class="flex gap-1.5">
                                    <div class="h-7 w-16 animate-pulse rounded-lg bg-muted/60"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Empty state -->
                        <div v-else-if="deptRequisitions.length === 0" class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                <AppIcon name="clipboard-list" class="size-5 text-muted-foreground/40" />
                            </div>
                            <div class="space-y-1">
                                <p class="text-sm font-semibold">No department requisitions found</p>
                                <p class="max-w-xs text-xs text-muted-foreground">
                                    {{ hasAnyDeptReqFilters ? 'No requisitions match the current filters.' : 'Department requisitions start the live demand workflow before store issue or procurement.' }}
                                </p>
                            </div>
                            <div class="flex gap-2">
                                <Button v-if="hasAnyDeptReqFilters" variant="outline" size="sm" class="gap-1.5" @click="resetDeptReqFilters">
                                    <AppIcon name="x" class="size-3.5" />
                                    Clear filters
                                </Button>
                                <Button v-if="canCreateRequest" size="sm" class="gap-1.5" @click="openCreateRequisitionDialog">
                                    <AppIcon name="plus" class="size-3.5" />
                                    New requisition
                                </Button>
                            </div>
                        </div>

                        <!-- Requisition rows -->
                        <div v-else class="divide-y">
                            <div
                                v-for="req in deptRequisitions"
                                :key="req.id"
                                class="group relative flex cursor-pointer items-start transition-colors hover:bg-muted/20"
                                @click="openRequisitionDetails(req)"
                            >
                                <!-- Status accent stripe -->
                                <div
                                    class="absolute inset-y-0 left-0 w-[3px] rounded-r-full"
                                    :class="{
                                        'bg-muted-foreground/30':  req.status === 'draft' || req.status === 'cancelled',
                                        'bg-blue-500':             req.status === 'submitted',
                                        'bg-green-500':            req.status === 'approved',
                                        'bg-amber-400':            req.status === 'partially_issued',
                                        'bg-emerald-600':          req.status === 'issued',
                                        'bg-destructive':          req.status === 'rejected',
                                    }"
                                ></div>

                                <div class="flex w-full items-start gap-4 px-4 py-3.5 pl-6">
                                    <!-- Left: main content -->
                                    <div class="min-w-0 flex-1 space-y-1.5">
                                        <!-- Row 1: Req # + priority + status + dept -->
                                        <div class="flex flex-wrap items-center gap-2">
                                            <span class="font-mono text-xs font-bold tracking-tight">{{ req.requisitionNumber }}</span>
                                            <Badge
                                                v-if="req.priority === 'urgent'"
                                                variant="destructive"
                                                class="h-4 px-1.5 text-[10px] uppercase tracking-wide"
                                            >Urgent</Badge>
                                            <Badge
                                                v-else-if="req.priority === 'high'"
                                                class="h-4 bg-orange-100 px-1.5 text-[10px] uppercase tracking-wide text-orange-800 dark:bg-orange-900/40 dark:text-orange-200"
                                            >High</Badge>
                                            <span
                                                class="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold"
                                                :class="reqStatusBadgeClass(req.status)"
                                            >{{ formatEnumLabel(req.status) }}</span>
                                            <span class="text-xs text-muted-foreground">{{ req.requestingDepartment }}</span>
                                        </div>

                                        <!-- Row 2: meta details -->
                                        <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                            <span class="flex items-center gap-1">
                                                <AppIcon name="warehouse" class="size-3 opacity-60" />
                                                {{ warehouseLabel(req.issuingWarehouseId) ?? req.issuingStore ?? '—' }}
                                            </span>
                                            <span class="flex items-center gap-1">
                                                <AppIcon name="layers" class="size-3 opacity-60" />
                                                {{ req.lines?.length ?? 0 }} line{{ (req.lines?.length ?? 0) === 1 ? '' : 's' }}
                                            </span>
                                            <span v-if="req.neededBy" class="flex items-center gap-1" :class="new Date(req.neededBy) < new Date() && !['issued','cancelled','rejected'].includes(req.status) ? 'font-medium text-red-600 dark:text-red-400' : ''">
                                                <AppIcon name="calendar" class="size-3 opacity-60" />
                                                Needed {{ formatDateOnly(req.neededBy) }}
                                                <span v-if="new Date(req.neededBy) < new Date() && !['issued','cancelled','rejected'].includes(req.status)" class="font-semibold">· Overdue</span>
                                            </span>
                                            <span class="flex items-center gap-1 opacity-70">
                                                <AppIcon name="clock" class="size-3 opacity-60" />
                                                {{ formatDateTime(req.createdAt) }}
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Right: action buttons -->
                                    <div class="flex shrink-0 items-center gap-1.5" @click.stop>
                                        <Button size="sm" variant="ghost" class="h-7 px-2.5 text-xs" @click="openRequisitionDetails(req)">
                                            {{ requisitionPrimaryActionLabel(req) }}
                                        </Button>
                                        <Button v-if="req.status === 'draft'" size="sm" variant="outline" class="h-7 text-xs" @click="updateRequisitionStatus(req.id, 'submitted')">Submit</Button>
                                        <Button v-if="req.status === 'submitted' && canManageItems" size="sm" variant="outline" class="h-7 text-xs" @click="updateRequisitionStatus(req.id, 'approved')">Approve</Button>
                                        <Button v-if="req.status === 'submitted' && canManageItems" size="sm" variant="destructive" class="h-7 text-xs" @click="updateRequisitionStatus(req.id, 'rejected', { rejectionReason: 'Rejected by store manager' })">Reject</Button>
                                        <Button v-if="req.status === 'approved' && canManageItems" size="sm" variant="outline" class="h-7 gap-1.5 text-xs" @click="updateRequisitionStatus(req.id, 'issued')">
                                            <AppIcon name="check" class="size-3" />
                                            Issue
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Pagination -->
                        <footer v-if="deptReqPagination && deptReqPagination.lastPage > 1" class="flex items-center justify-between border-t px-4 py-3">
                            <p class="text-xs text-muted-foreground">
                                Page {{ deptReqPagination.currentPage }} of {{ deptReqPagination.lastPage }}{{ deptReqPagination.total != null ? ` · ${deptReqPagination.total} total` : '' }}
                            </p>
                            <div class="flex items-center gap-1">
                                <Button variant="outline" size="sm" class="h-8 gap-1.5 text-xs" :disabled="deptReqPagination.currentPage <= 1" @click="deptReqSearch.page = deptReqPagination!.currentPage - 1; loadDeptRequisitions()">
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Previous
                                </Button>
                                <Button variant="outline" size="sm" class="h-8 gap-1.5 text-xs" :disabled="deptReqPagination.currentPage >= deptReqPagination.lastPage" @click="deptReqSearch.page = deptReqPagination!.currentPage + 1; loadDeptRequisitions()">
                                    Next
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>
                </TabsContent>

                <!-- â”€â”€â”€ Supplier Lead Times Tab â”€â”€â”€ -->
                <!-- ─── Shortage Queue Tab ─── -->
                <TabsContent value="shortage-queue" class="mt-0 flex flex-col gap-4">

                <!-- Replenishment flash banner — sits above the card, full width -->
                <Transition
                    enter-active-class="transition-all duration-300 ease-out"
                    enter-from-class="-translate-y-2 opacity-0"
                    leave-active-class="transition-all duration-200 ease-in"
                    leave-to-class="-translate-y-2 opacity-0"
                >
                    <div
                        v-if="shortageQueueReplenishmentBanner && shortageQueueReplenishmentBanner.pendingLineCount > 0"
                        class="flex items-center gap-3 rounded-lg border border-green-300/60 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 shadow-sm dark:border-green-800/50 dark:from-green-950/40 dark:to-emerald-950/40"
                    >
                        <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/60">
                            <AppIcon name="check-circle" class="size-4 text-green-600 dark:text-green-400" />
                        </span>
                        <div class="min-w-0 flex-1">
                            <p class="text-sm font-semibold text-green-900 dark:text-green-100">Stock received</p>
                            <p class="text-xs text-green-700 dark:text-green-300">
                                {{ shortageQueueReplenishmentBanner.pendingLineCount }}
                                shortage line{{ shortageQueueReplenishmentBanner.pendingLineCount === 1 ? '' : 's' }} may now be fulfillable — check the queue below.
                            </p>
                        </div>
                        <div class="flex shrink-0 items-center gap-2">
                            <Button
                                size="sm"
                                class="h-7 gap-1.5 bg-green-600 text-xs text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                                @click="shortageQueueReplenishmentBanner = null; shortageQueueFilters.readiness = 'ready'; shortageQueueFilters.page = 1; loadShortageQueue()"
                            >
                                <AppIcon name="arrow-right" class="size-3" />
                                Show ready
                            </Button>
                            <button
                                class="rounded-md p-1 text-green-600 opacity-60 transition-opacity hover:opacity-100 dark:text-green-400"
                                @click="shortageQueueReplenishmentBanner = null"
                            >
                                <AppIcon name="x" class="size-3.5" />
                            </button>
                        </div>
                    </div>
                </Transition>

                <!-- KPI stat strip -->
                <div class="grid grid-cols-3 gap-3">
                    <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                            <AppIcon name="list" class="size-4 text-muted-foreground" />
                        </span>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">In queue</p>
                            <p class="text-xl font-bold leading-tight tabular-nums">
                                <template v-if="shortageQueueMeta">{{ shortageQueueMeta.total ?? shortageQueueItems.length }}</template>
                                <template v-else>—</template>
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 rounded-lg border border-green-200/70 bg-green-50/50 px-4 py-3 shadow-sm dark:border-green-900/40 dark:bg-green-950/20">
                        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
                            <AppIcon name="check-circle" class="size-4 text-green-600 dark:text-green-400" />
                        </span>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-wider text-green-700/70 dark:text-green-400/70">Ready to issue</p>
                            <p class="text-xl font-bold leading-tight tabular-nums text-green-700 dark:text-green-300">
                                <template v-if="shortageQueueMeta">{{ shortageQueueMeta.readyLineCount ?? 0 }}</template>
                                <template v-else>—</template>
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 rounded-lg border border-amber-200/70 bg-amber-50/50 px-4 py-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
                            <AppIcon name="clock" class="size-4 text-amber-600 dark:text-amber-400" />
                        </span>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-wider text-amber-700/70 dark:text-amber-400/70">Awaiting stock</p>
                            <p class="text-xl font-bold leading-tight tabular-nums text-amber-700 dark:text-amber-300">
                                <template v-if="shortageQueueMeta">{{ shortageQueueMeta.waitingLineCount ?? 0 }}</template>
                                <template v-else>—</template>
                            </p>
                        </div>
                    </div>
                </div>

                <Card v-if="canRead" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">

                    <!-- Toolbar -->
                    <div class="flex items-center gap-2 border-b px-4 py-3">
                        <!-- Segmented readiness filter -->
                        <div class="flex rounded-lg border bg-muted/40 p-0.5 text-xs">
                            <button
                                class="flex items-center gap-1.5 rounded-md px-3 py-2 font-medium transition-all"
                                :class="shortageQueueFilters.readiness === 'all'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'"
                                @click="shortageQueueFilters.readiness = 'all'; shortageQueueFilters.page = 1; loadShortageQueue()"
                            >
                                All
                                <span
                                    v-if="shortageQueueMeta"
                                    class="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums"
                                    :class="shortageQueueFilters.readiness === 'all' ? 'bg-muted text-foreground' : 'bg-muted/60 text-muted-foreground'"
                                >{{ (shortageQueueMeta.readyLineCount ?? 0) + (shortageQueueMeta.waitingLineCount ?? 0) }}</span>
                            </button>
                            <button
                                class="flex items-center gap-1.5 rounded-md px-3 py-2 font-medium transition-all"
                                :class="shortageQueueFilters.readiness === 'ready'
                                    ? 'bg-background text-green-700 shadow-sm dark:text-green-300'
                                    : 'text-muted-foreground hover:text-foreground'"
                                @click="shortageQueueFilters.readiness = 'ready'; shortageQueueFilters.page = 1; loadShortageQueue()"
                            >
                                <span class="size-1.5 rounded-full bg-green-500"></span>
                                Ready
                                <span
                                    v-if="shortageQueueMeta && shortageQueueMeta.readyLineCount > 0"
                                    class="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums"
                                    :class="shortageQueueFilters.readiness === 'ready' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-muted/60 text-muted-foreground'"
                                >{{ shortageQueueMeta.readyLineCount }}</span>
                            </button>
                            <button
                                class="flex items-center gap-1.5 rounded-md px-3 py-2 font-medium transition-all"
                                :class="shortageQueueFilters.readiness === 'waiting'
                                    ? 'bg-background text-amber-700 shadow-sm dark:text-amber-300'
                                    : 'text-muted-foreground hover:text-foreground'"
                                @click="shortageQueueFilters.readiness = 'waiting'; shortageQueueFilters.page = 1; loadShortageQueue()"
                            >
                                <span class="size-1.5 rounded-full bg-amber-500"></span>
                                Waiting
                                <span
                                    v-if="shortageQueueMeta && shortageQueueMeta.waitingLineCount > 0"
                                    class="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums"
                                    :class="shortageQueueFilters.readiness === 'waiting' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-muted/60 text-muted-foreground'"
                                >{{ shortageQueueMeta.waitingLineCount }}</span>
                            </button>
                        </div>

                        <div class="flex min-w-0 flex-1 items-center gap-2">
                            <SearchInput
                                v-model="shortageQueueFilters.q"
                                placeholder="Search requisition or department…"
                                class="min-w-0 flex-1 text-xs"
                                @keyup.enter="shortageQueueFilters.page = 1; loadShortageQueue()"
                            />
                            <Select
                                v-if="canSelectAnyRequisitionDepartment"
                                :model-value="toSelectValue(shortageQueueFilters.departmentId)"
                                @update:model-value="(v: string) => { shortageQueueFilters.departmentId = fromSelectValue(v); shortageQueueFilters.page = 1; loadShortageQueue() }"
                            >
                                <SelectTrigger class="h-9 w-44 text-xs">
                                    <SelectValue placeholder="All departments" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="EMPTY_SELECT_VALUE">All departments</SelectItem>
                                    <SelectItem v-for="dept in departments" :key="dept.id" :value="dept.id">{{ dept.name }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            size="sm"
                            variant="ghost"
                            class="h-9 gap-1.5 text-xs text-muted-foreground"
                            :disabled="shortageQueueLoading"
                            @click="shortageQueueFilters.page = 1; loadShortageQueue()"
                        >
                            <AppIcon name="refresh-cw" :class="['size-3.5', shortageQueueLoading && 'animate-spin']" />
                            Refresh
                        </Button>
                    </div>

                    <CardContent class="flex-1 overflow-auto p-0">

                        <!-- Skeleton loading -->
                        <div v-if="shortageQueueLoading" class="divide-y">
                            <div v-for="n in 4" :key="n" class="flex items-start gap-4 px-4 py-4">
                                <div class="mt-0.5 h-full w-1 shrink-0 rounded-full bg-muted/50"></div>
                                <div class="flex-1 space-y-2">
                                    <div class="flex items-center gap-2">
                                        <div class="h-3.5 w-20 animate-pulse rounded-md bg-muted/70"></div>
                                        <div class="h-4 w-12 animate-pulse rounded-full bg-muted/50"></div>
                                    </div>
                                    <div class="h-3 w-32 animate-pulse rounded-md bg-muted/50"></div>
                                    <div class="flex gap-2">
                                        <div class="h-5 w-24 animate-pulse rounded-md bg-muted/40"></div>
                                        <div class="h-5 w-24 animate-pulse rounded-md bg-muted/40"></div>
                                    </div>
                                </div>
                                <div class="mt-1 h-3 w-16 animate-pulse rounded-md bg-muted/50"></div>
                                <div class="h-7 w-20 animate-pulse rounded-lg bg-muted/60"></div>
                            </div>
                        </div>

                        <!-- Error state -->
                        <div v-else-if="shortageQueueError" class="px-6 py-8">
                            <div class="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
                                <div class="flex items-start gap-3">
                                    <AppIcon name="alert-circle" class="mt-0.5 size-5 shrink-0 text-destructive" />
                                    <div>
                                        <p class="text-sm font-semibold text-destructive">Failed to load shortage queue</p>
                                        <p class="mt-0.5 text-xs text-destructive/80">{{ shortageQueueError }}</p>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            class="mt-3 h-7 gap-1.5 text-xs"
                                            @click="shortageQueueFilters.page = 1; loadShortageQueue()"
                                        >
                                            <AppIcon name="refresh-cw" class="size-3" />
                                            Retry
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Empty state -->
                        <div v-else-if="shortageQueueItems.length === 0" class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                <AppIcon
                                    :name="shortageQueueFilters.readiness === 'ready' ? 'check-circle' : shortageQueueFilters.readiness === 'waiting' ? 'clock' : 'package'"
                                    class="size-5 text-muted-foreground/40"
                                />
                            </div>
                            <div class="space-y-1">
                                <p class="text-sm font-semibold text-foreground">
                                    <template v-if="shortageQueueFilters.readiness === 'ready'">No items are ready to issue</template>
                                    <template v-else-if="shortageQueueFilters.readiness === 'waiting'">Nothing waiting for stock</template>
                                    <template v-else>Shortage queue is clear</template>
                                </p>
                                <p class="max-w-xs text-xs text-muted-foreground">
                                    <template v-if="shortageQueueFilters.readiness === 'ready'">
                                        Stock for pending lines hasn't arrived yet. Switch to <button class="font-medium text-amber-600 underline-offset-2 hover:underline dark:text-amber-400" @click="shortageQueueFilters.readiness = 'waiting'; loadShortageQueue()">Waiting</button> to see what's outstanding.
                                    </template>
                                    <template v-else-if="shortageQueueFilters.readiness === 'waiting'">
                                        All pending lines have sufficient stock available.
                                    </template>
                                    <template v-else>
                                        All partially issued requisitions have been fulfilled, or none exist yet.
                                    </template>
                                </p>
                            </div>
                        </div>

                        <!-- Requisition cards -->
                        <div v-else class="divide-y">
                            <div
                                v-for="req in shortageQueueItems"
                                :key="req.id"
                                class="group relative flex items-start gap-0 transition-colors hover:bg-muted/20"
                            >
                                <!-- Readiness accent stripe -->
                                <div
                                    class="absolute inset-y-0 left-0 w-[3px] rounded-r-full transition-colors"
                                    :class="req.readyLineCount > 0 && req.waitingLineCount === 0
                                        ? 'bg-green-500'
                                        : req.readyLineCount > 0
                                            ? 'bg-amber-400'
                                            : 'bg-border'"
                                ></div>

                                <div class="flex w-full cursor-pointer items-start gap-4 px-4 py-4 pl-6" @click="openRequisitionDetails(req)">
                                    <!-- Left: meta -->
                                    <div class="min-w-0 flex-1 space-y-2">
                                        <!-- Row 1: number + priority + department -->
                                        <div class="flex flex-wrap items-center gap-2">
                                            <span class="font-mono text-xs font-bold tracking-tight">{{ req.requisitionNumber ?? '—' }}</span>
                                            <Badge
                                                v-if="req.priority === 'urgent'"
                                                variant="destructive"
                                                class="h-4 px-1.5 text-[10px] uppercase tracking-wide"
                                            >Urgent</Badge>
                                            <Badge
                                                v-else-if="req.priority === 'high'"
                                                class="h-4 bg-orange-100 px-1.5 text-[10px] uppercase tracking-wide text-orange-800 dark:bg-orange-900/40 dark:text-orange-200"
                                            >High</Badge>
                                            <span class="text-xs text-muted-foreground">{{ req.requestingDepartment ?? '—' }}</span>
                                            <span
                                                v-if="req.neededBy"
                                                class="flex items-center gap-1 text-[11px]"
                                                :class="new Date(req.neededBy) < new Date() ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground'"
                                            >
                                                <AppIcon name="calendar" class="size-3" />
                                                {{ String(req.neededBy).split('T')[0] }}
                                                <span v-if="new Date(req.neededBy) < new Date()" class="font-semibold">· Overdue</span>
                                            </span>
                                        </div>

                                        <!-- Row 2: pending lines and shortage actions -->
                                        <div class="grid gap-1">
                                            <div
                                                v-for="line in req.pendingLines"
                                                :key="line.id"
                                                class="min-w-0 rounded-lg border bg-background/70 px-2.5 py-1.5 text-[11px] transition-colors group-hover:border-border/80"
                                                :class="line.canIssueNow ? 'border-green-200/70 dark:border-green-900/50' : 'border-amber-200/70 dark:border-amber-900/50'"
                                            >
                                                <div class="flex min-w-0 items-center justify-between gap-2">
                                                    <div class="flex min-w-0 items-center gap-2">
                                                        <div class="flex min-w-0 items-center gap-1.5">
                                                            <span
                                                                class="size-1.5 shrink-0 rounded-full"
                                                                :class="line.canIssueNow ? 'bg-green-500' : 'bg-amber-500'"
                                                            ></span>
                                                            <span class="min-w-0 truncate font-medium text-foreground">{{ line.itemName ?? line.itemCode ?? line.itemId }}</span>
                                                        </div>
                                                        <span
                                                            class="shrink-0 rounded-md px-1.5 py-0.5 font-medium"
                                                            :class="line.canIssueNow
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300'
                                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'"
                                                        >
                                                            {{ formatAmount(line.pendingQuantity) }} {{ line.unit ?? '' }}
                                                        </span>
                                                    </div>
                                                    <div class="flex shrink-0 items-center gap-1.5">
                                                        <Badge
                                                            v-if="shortageLineProcurementRequest(line)"
                                                            variant="outline"
                                                            class="max-w-40 rounded-lg px-1.5 py-0.5 text-[10px] font-normal"
                                                        >
                                                            <span class="truncate">
                                                                {{ shortageLineProcurementRequest(line).requestNumber ?? 'PRQ' }}
                                                                · {{ formatEnumLabel(shortageLineProcurementRequest(line).status ?? 'n/a') }}
                                                            </span>
                                                        </Badge>
                                                        <Button
                                                            v-if="!line.canIssueNow && canCreateProcurementFromRequisitionLine(line, req)"
                                                            size="sm"
                                                            variant="ghost"
                                                            class="h-6 rounded-lg px-2 text-[11px] text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/50"
                                                            @click.stop="openProcurementFromQueueShortage(req, line)"
                                                        >
                                                            Procure
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Row 3: readiness progress bar -->
                                        <div v-if="(req.readyLineCount ?? 0) + (req.waitingLineCount ?? 0) > 0" class="flex items-center gap-2">
                                            <div class="h-1.5 w-24 overflow-hidden rounded-full bg-muted/60">
                                                <div
                                                    class="h-full rounded-full bg-green-500 transition-all"
                                                    :style="`width: ${Math.round((req.readyLineCount / ((req.readyLineCount ?? 0) + (req.waitingLineCount ?? 0))) * 100)}%`"
                                                ></div>
                                            </div>
                                            <span class="text-[11px] text-muted-foreground">
                                                {{ req.readyLineCount ?? 0 }} of {{ (req.readyLineCount ?? 0) + (req.waitingLineCount ?? 0) }} lines ready
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Right: readiness badge + CTA -->
                                    <div class="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                                        <div
                                            class="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                                            :class="req.readyLineCount > 0 && req.waitingLineCount === 0
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                                                : req.readyLineCount > 0
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                                                    : 'bg-muted text-muted-foreground'"
                                        >
                                            <span
                                                class="size-1.5 rounded-full"
                                                :class="req.readyLineCount > 0 && req.waitingLineCount === 0
                                                    ? 'bg-green-500'
                                                    : req.readyLineCount > 0
                                                        ? 'bg-amber-500'
                                                        : 'bg-muted-foreground/50'"
                                            ></span>
                                            <template v-if="req.readyLineCount > 0 && req.waitingLineCount === 0">All ready</template>
                                            <template v-else-if="req.readyLineCount > 0">Partial</template>
                                            <template v-else>Waiting</template>
                                        </div>
                                        <Button
                                            size="sm"
                                            :variant="req.readyLineCount > 0 ? 'default' : 'outline'"
                                            class="h-7 gap-1.5 text-xs"
                                            @click.stop="openRequisitionDetails(req)"
                                        >
                                            <AppIcon v-if="req.readyLineCount > 0" name="arrow-right" class="size-3" />
                                            {{ req.readyLineCount > 0 ? 'Issue now' : 'View' }}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Pagination -->
                        <footer v-if="shortageQueueMeta && shortageQueueMeta.lastPage > 1" class="flex items-center justify-between border-t px-4 py-3">
                            <p class="text-xs text-muted-foreground">
                                Page {{ shortageQueueMeta.currentPage }} of {{ shortageQueueMeta.lastPage }}
                            </p>
                            <div class="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="h-8 gap-1.5 text-xs"
                                    :disabled="shortageQueueMeta.currentPage <= 1"
                                    @click="shortageQueueFilters.page = shortageQueueMeta!.currentPage - 1; loadShortageQueue()"
                                >
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="h-8 gap-1.5 text-xs"
                                    :disabled="shortageQueueMeta.currentPage >= shortageQueueMeta.lastPage"
                                    @click="shortageQueueFilters.page = shortageQueueMeta!.currentPage + 1; loadShortageQueue()"
                                >
                                    Next
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>
                </TabsContent>

                <TabsContent value="lead-times" class="mt-0 flex flex-col gap-4">

                    <Card v-if="canRead" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">

                        <!-- Header -->
                        <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                            <div class="min-w-0">
                                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                    <AppIcon name="calendar-clock" class="size-4 text-muted-foreground" />
                                    Supplier Lead Times
                                </h3>
                                <p class="mt-1 text-xs text-muted-foreground">Track delivery performance and lead times per supplier.</p>
                            </div>
                            <Button size="sm" class="h-9 gap-1.5 rounded-lg text-xs" @click="createLeadTimeDialogOpen = true">
                                <AppIcon name="plus" class="size-3.5" />
                                Record Order
                            </Button>
                        </div>

                        <!-- Toolbar -->
                        <div class="flex items-center gap-2 border-b px-4 py-3">
                            <Select
                                :model-value="toSelectValue(leadTimeSearch.supplierId)"
                                @update:model-value="leadTimeSearch.supplierId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))"
                            >
                                <SelectTrigger class="h-9 min-w-0 flex-1 rounded-lg text-xs">
                                    <SelectValue placeholder="Select supplier…">
                                        {{ supplierLabel(leadTimeSearch.supplierId) || 'Select supplier…' }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="EMPTY_SELECT_VALUE">All suppliers</SelectItem>
                                    <SelectItem v-for="s in (suppliers ?? [])" :key="s.id" :value="s.id" :text-value="lookupOptionText(s)">{{ s.name }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="ghost" size="sm" class="h-9 gap-1.5 rounded-lg text-xs text-muted-foreground" :disabled="leadTimeLoading" @click="leadTimeSearch.page = 1; loadLeadTimes()">
                                <AppIcon name="refresh-cw" class="size-3.5" />
                                Refresh
                            </Button>
                        </div>

                        <!-- Supplier performance KPI strip -->
                        <div v-if="supplierPerformance" class="grid grid-cols-2 gap-3 border-b px-4 py-3 sm:grid-cols-4">
                            <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-3 py-2.5 shadow-sm">
                                <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                    <AppIcon name="calendar-clock" class="size-3.5 text-muted-foreground" />
                                </span>
                                <div>
                                    <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Avg Lead</p>
                                    <p class="text-base font-bold tabular-nums">{{ supplierPerformance.avgLeadTimeDays ?? '—' }}<span class="ml-0.5 text-xs font-normal text-muted-foreground">d</span></p>
                                </div>
                            </div>
                            <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-3 py-2.5 shadow-sm">
                                <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                    <AppIcon name="check-circle" class="size-3.5 text-muted-foreground" />
                                </span>
                                <div>
                                    <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Fulfillment</p>
                                    <p class="text-base font-bold tabular-nums">{{ supplierPerformance.avgFulfillmentRate != null ? supplierPerformance.avgFulfillmentRate + '%' : '—' }}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Skeleton -->
                        <div v-if="leadTimeLoading" class="divide-y">
                            <div v-for="n in 4" :key="`sk-lt-${n}`" class="flex items-start gap-3 px-4 py-4">
                                <div class="min-w-0 flex-1 space-y-2">
                                    <div class="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
                                    <div class="h-3 w-2/3 animate-pulse rounded bg-muted" />
                                </div>
                                <div class="h-6 w-16 animate-pulse rounded-full bg-muted" />
                            </div>
                        </div>

                        <!-- No supplier selected -->
                        <div
                            v-else-if="!leadTimeSearch.supplierId"
                            class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
                        >
                            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                <AppIcon name="calendar-clock" class="size-5 text-muted-foreground/40" />
                            </div>
                            <div>
                                <p class="text-sm font-medium text-muted-foreground">Select a supplier</p>
                                <p class="mt-0.5 text-xs text-muted-foreground/70">Choose a supplier to review lead-time performance, fulfillment variance, and receiving reliability.</p>
                            </div>
                        </div>

                        <!-- Empty -->
                        <div
                            v-else-if="leadTimes.length === 0"
                            class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
                        >
                            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                <AppIcon name="calendar-clock" class="size-5 text-muted-foreground/40" />
                            </div>
                            <p class="text-sm font-medium text-muted-foreground">No lead time records found</p>
                            <p class="text-xs text-muted-foreground/70">Records appear after supplier orders are received and actual delivery dates are captured.</p>
                        </div>

                        <!-- Lead time rows -->
                        <div v-else class="divide-y">
                            <div v-for="lt in leadTimes" :key="lt.id" class="relative flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/30">
                                <!-- Delivery status stripe -->
                                <div
                                    class="absolute inset-y-0 left-0 w-[3px] rounded-l"
                                    :class="lt.delivery_status === 'on_time' ? 'bg-green-500' : lt.delivery_status === 'late' ? 'bg-red-500' : lt.delivery_status === 'early' ? 'bg-sky-500' : 'bg-muted-foreground/30'"
                                />
                                <div class="min-w-0 flex-1">
                                    <!-- Row 1: dates + status badge -->
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="text-sm font-medium">{{ lt.order_date ? new Date(lt.order_date).toLocaleDateString() : '—' }}</span>
                                        <span class="text-xs text-muted-foreground">→</span>
                                        <span class="text-sm">{{ lt.actual_delivery_date ? new Date(lt.actual_delivery_date).toLocaleDateString() : lt.expected_delivery_date ? new Date(lt.expected_delivery_date).toLocaleDateString() : '—' }}</span>
                                        <span
                                            class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                                            :class="deliveryStatusBadge(lt.delivery_status)"
                                        >
                                            {{ (lt.delivery_status ?? 'pending').replace(/_/g, ' ') }}
                                        </span>
                                    </div>
                                    <!-- Row 2: lead days · qty · fulfillment -->
                                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                        <span>Lead: <strong class="text-foreground">{{ lt.actual_lead_time_days ?? lt.expected_lead_time_days ?? '—' }}d</strong></span>
                                        <span v-if="lt.quantity_ordered != null">&middot; Ordered: <strong class="text-foreground">{{ lt.quantity_ordered }}</strong></span>
                                        <span v-if="lt.quantity_received != null">&middot; Received: <strong class="text-foreground">{{ lt.quantity_received }}</strong></span>
                                        <span v-if="lt.fulfillment_rate != null">&middot; Fulfillment: <strong class="text-foreground">{{ lt.fulfillment_rate }}%</strong></span>
                                    </div>
                                </div>
                                <Button
                                    v-if="lt.delivery_status === 'pending'"
                                    size="sm" variant="outline"
                                    class="h-7 shrink-0 rounded-lg px-2.5 text-xs"
                                    @click="openRecordDelivery(lt)"
                                >
                                    Record delivery
                                </Button>
                            </div>
                        </div>

                        <!-- Footer pagination -->
                        <footer v-if="leadTimePagination && leadTimePagination.lastPage > 1" class="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-2.5">
                            <p class="text-xs text-muted-foreground">Page {{ leadTimePagination.currentPage }}/{{ leadTimePagination.lastPage }}{{ leadTimePagination.total != null ? ` · ${leadTimePagination.total} total` : '' }}</p>
                            <div class="flex gap-1">
                                <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="leadTimePagination.currentPage <= 1" @click="leadTimeSearch.page = leadTimePagination!.currentPage - 1; loadLeadTimes()">
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Prev
                                </Button>
                                <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="leadTimePagination.currentPage >= leadTimePagination.lastPage" @click="leadTimeSearch.page = leadTimePagination!.currentPage + 1; loadLeadTimes()">
                                    Next
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </footer>
                    </Card>

                </TabsContent>

                <!-- â”€â”€â”€ Warehouse Transfers Tab â”€â”€â”€ -->
                <!-- ─── Warehouse Transfers Tab ─── -->
                <TabsContent value="transfers" class="mt-0 flex flex-col gap-4">

                    <!-- Attention summary KPI chips (outside card) -->
                    <div v-if="transferAttentionSummary.length > 0" class="flex flex-wrap gap-2">
                        <span
                            v-for="signal in transferAttentionSummary"
                            :key="signal.label"
                            class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm"
                            :class="transferAttentionBadgeClass(signal)"
                        >
                            {{ signal.label }}
                            <span class="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] tabular-nums font-bold">{{ signal.count }}</span>
                        </span>
                    </div>

                    <Card v-if="canRead" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">

                        <!-- Header -->
                        <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                            <div class="min-w-0">
                                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                    <AppIcon name="package" class="size-4 text-muted-foreground" />
                                    Warehouse Transfers
                                </h3>
                                <p class="mt-1 text-xs text-muted-foreground">Inter-store stock movement, pick, dispatch, and receipt tracking.</p>
                            </div>
                            <Button size="sm" class="h-9 gap-1.5 rounded-lg text-xs" @click="createTransferDialogOpen = true">
                                <AppIcon name="plus" class="size-3.5" />
                                New Transfer
                            </Button>
                        </div>

                        <!-- Toolbar -->
                        <div class="flex items-center gap-2 border-b px-4 py-3">
                            <div class="relative min-w-0 flex-1">
                                <svg class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                <input
                                    v-model="transferSearch.q"
                                    class="h-9 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-xs shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                    placeholder="Search transfer number…"
                                    @keyup.enter="transferSearch.page = 1; loadWarehouseTransfers()"
                                />
                            </div>
                            <Select
                                :model-value="toSelectValue(transferSearch.status)"
                                @update:model-value="val => { transferSearch.status = fromSelectValue(String(val ?? EMPTY_SELECT_VALUE)); transferSearch.page = 1; loadWarehouseTransfers() }"
                            >
                                <SelectTrigger class="h-9 w-36 shrink-0 rounded-lg text-xs">
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                    <SelectItem v-for="s in TRANSFER_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select
                                :model-value="toSelectValue(transferSearch.varianceReview)"
                                @update:model-value="val => { transferSearch.varianceReview = fromSelectValue(String(val ?? EMPTY_SELECT_VALUE)); transferSearch.page = 1; loadWarehouseTransfers() }"
                            >
                                <SelectTrigger class="h-9 w-40 shrink-0 rounded-lg text-xs">
                                    <SelectValue placeholder="Review queue" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        v-for="option in TRANSFER_VARIANCE_REVIEW_FILTER_OPTIONS"
                                        :key="`trf-vr-${option.value || 'all'}`"
                                        :value="option.value || EMPTY_SELECT_VALUE"
                                    >{{ option.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="ghost" size="sm" class="h-9 gap-1.5 shrink-0 rounded-lg text-xs text-muted-foreground" :disabled="transferLoading" @click="transferSearch.page = 1; loadWarehouseTransfers()">
                                <AppIcon name="refresh-cw" class="size-3.5" />
                                Refresh
                            </Button>
                        </div>

                        <!-- Skeleton -->
                        <div v-if="transferLoading" class="divide-y">
                            <div v-for="n in 4" :key="`sk-tr-${n}`" class="flex items-start gap-3 px-4 py-4">
                                <div class="min-w-0 flex-1 space-y-2">
                                    <div class="h-3.5 w-1/4 animate-pulse rounded bg-muted" />
                                    <div class="h-3 w-1/2 animate-pulse rounded bg-muted" />
                                    <div class="flex gap-1.5">
                                        <div class="h-5 w-16 animate-pulse rounded-full bg-muted" />
                                        <div class="h-5 w-20 animate-pulse rounded-full bg-muted" />
                                    </div>
                                </div>
                                <div class="flex gap-1.5">
                                    <div class="h-7 w-20 animate-pulse rounded bg-muted" />
                                </div>
                            </div>
                        </div>

                        <!-- Empty -->
                        <div
                            v-else-if="transfers.length === 0"
                            class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
                        >
                            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                <AppIcon name="package" class="size-5 text-muted-foreground/40" />
                            </div>
                            <div>
                                <p class="text-sm font-medium text-muted-foreground">No warehouse transfers found</p>
                                <p class="mt-0.5 text-xs text-muted-foreground/70">Transfers appear after stock is requested, packed, dispatched, and received between store locations.</p>
                            </div>
                            <Button size="sm" variant="outline" class="mt-1 h-8 gap-1.5 rounded-lg text-xs" @click="createTransferDialogOpen = true">
                                <AppIcon name="plus" class="size-3.5" />
                                New Transfer
                            </Button>
                        </div>

                        <!-- Transfer rows -->
                        <div v-else class="divide-y">
                            <div
                                v-for="t in transfers"
                                :key="t.id"
                                class="relative flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/30"
                            >
                                <!-- Status accent stripe -->
                                <div
                                    class="absolute inset-y-0 left-0 w-[3px] rounded-l"
                                    :class="transferStatusBadgeClass(t.status).includes('green') ? 'bg-green-500'
                                          : transferStatusBadgeClass(t.status).includes('amber') ? 'bg-amber-500'
                                          : transferStatusBadgeClass(t.status).includes('blue') ? 'bg-blue-500'
                                          : transferStatusBadgeClass(t.status).includes('red') ? 'bg-red-500'
                                          : 'bg-muted-foreground/30'"
                                />
                                <div class="min-w-0 flex-1">
                                    <!-- Row 1: number + priority + status badges -->
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="font-mono text-sm font-semibold">{{ t.transfer_number }}</span>
                                        <span
                                            class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                                            :class="transferPriorityBadge(t.priority)"
                                        >{{ t.priority }}</span>
                                        <span
                                            class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                                            :class="transferStatusBadgeClass(t.status)"
                                        >{{ (t.status ?? '').replace(/_/g, ' ') }}</span>
                                        <span
                                            class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                                            :class="transferReservationStateBadgeClass(t.reservationSummary?.state)"
                                        >{{ transferReservationSummaryLabel(t) }}</span>
                                        <span
                                            v-if="transferCanOpenVarianceReview(t) && transferVarianceReviewState(t) === 'reviewed'"
                                            class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                                            :class="transferVarianceReviewBadgeClass(transferVarianceReviewState(t))"
                                        >{{ transferVarianceReviewStateLabel(transferVarianceReviewState(t)) }}</span>
                                    </div>
                                    <!-- Row 2: route + pick summary -->
                                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                        <span class="font-medium text-foreground">{{ warehouseLabel(t.source_warehouse_id) ?? 'Unknown' }} → {{ warehouseLabel(t.destination_warehouse_id) ?? 'Unknown' }}</span>
                                        <span v-if="transferPickSummaryLabel(t)">&middot; {{ transferPickSummaryLabel(t) }}</span>
                                        <span v-if="t.lines?.length">&middot; <strong class="text-foreground">{{ t.lines.length }}</strong> line{{ t.lines.length !== 1 ? 's' : '' }}</span>
                                        <span v-if="t.reason" class="max-w-xs truncate">&middot; {{ t.reason }}</span>
                                        <span>&middot; {{ t.created_at ? new Date(t.created_at).toLocaleDateString() : '—' }}</span>
                                    </div>
                                    <!-- Row 3: attention signals -->
                                    <div v-if="transferAttentionSignals(t).length > 0" class="mt-1.5 flex flex-wrap items-center gap-1">
                                        <span
                                            v-for="signal in transferAttentionSignals(t)"
                                            :key="signal.key"
                                            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                                            :class="transferAttentionBadgeClass(signal)"
                                        >{{ signal.label }}</span>
                                    </div>
                                </div>
                                <!-- Action buttons -->
                                <div class="flex shrink-0 flex-wrap items-start gap-1.5">
                                    <Button
                                        v-for="ns in (TRANSFER_ACTION_TRANSITIONS[t.status] ?? [])"
                                        :key="ns"
                                        size="sm"
                                        variant="outline"
                                        class="h-7 rounded-lg px-2.5 text-xs"
                                        @click="openTransferStatusDialog(t, ns)"
                                    >{{ transferActionLabel(ns) }}</Button>
                                    <Button
                                        v-if="transferCanOpenVarianceReview(t)"
                                        size="sm"
                                        variant="outline"
                                        class="h-7 rounded-lg px-2.5 text-xs"
                                        @click="openTransferVarianceReviewDialog(t)"
                                    >{{ transferVarianceReviewButtonLabel(t) }}</Button>
                                    <DropdownMenu v-if="transferCanOpenPickSlip(t) || transferCanOpenDispatchNote(t)">
                                        <DropdownMenuTrigger as-child>
                                            <Button size="sm" variant="ghost" class="h-7 rounded-lg px-2 text-xs">
                                                <AppIcon name="clipboard-list" class="size-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" class="w-48">
                                            <DropdownMenuItem v-if="transferCanOpenPickSlip(t)" @click="openTransferPickSlip(t)">
                                                <AppIcon name="clipboard-list" class="mr-2 size-3.5" />
                                                Pick slip
                                            </DropdownMenuItem>
                                            <DropdownMenuItem v-if="transferCanOpenDispatchNote(t)" @click="openTransferDispatchNote(t)">
                                                <AppIcon name="file-text" class="mr-2 size-3.5" />
                                                Dispatch note
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </div>

                        <!-- Footer pagination -->
                        <footer v-if="transferPagination && transferPagination.lastPage > 1" class="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-2.5">
                            <p class="text-xs text-muted-foreground">Page {{ transferPagination.currentPage }}/{{ transferPagination.lastPage }}{{ transferPagination.total != null ? ` · ${transferPagination.total} total` : '' }}</p>
                            <div class="flex gap-1">
                                <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="transferPagination.currentPage <= 1" @click="transferSearch.page = transferPagination!.currentPage - 1; loadWarehouseTransfers()">
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Prev
                                </Button>
                                <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="transferPagination.currentPage >= transferPagination.lastPage" @click="transferSearch.page = transferPagination!.currentPage + 1; loadWarehouseTransfers()">
                                    Next
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </footer>
                    </Card>

                </TabsContent>
                <TabsContent value="claims" class="mt-0 flex flex-col gap-4">
                    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                <AppIcon name="receipt" class="size-4 text-muted-foreground" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Claim Links</p>
                                <p class="text-xl font-bold leading-tight tabular-nums">{{ claimLinkPagination?.total ?? claimLinks.length }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-blue-200/70 bg-blue-50/50 px-4 py-3 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                                <AppIcon name="activity" class="size-4 text-blue-600 dark:text-blue-400" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-blue-700/70 dark:text-blue-400/70">Submitted</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-blue-700 dark:text-blue-300">{{ claimLinks.filter((link) => link.claim_status === 'submitted').length }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-green-200/70 bg-green-50/50 px-4 py-3 shadow-sm dark:border-green-900/40 dark:bg-green-950/20">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
                                <AppIcon name="check-circle" class="size-4 text-green-600 dark:text-green-400" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-green-700/70 dark:text-green-400/70">Accepted</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-green-700 dark:text-green-300">{{ claimLinks.filter((link) => ['accepted', 'approved', 'paid'].includes(link.claim_status)).length }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                                <AppIcon name="alert-triangle" class="size-4 text-destructive" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-destructive/80">Rejected</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-destructive">{{ claimLinks.filter((link) => ['rejected', 'failed'].includes(link.claim_status)).length }}</p>
                            </div>
                        </div>
                    </div>
                <!-- â”€â”€â”€ Claims Tab (Feature 5) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
                <Card class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">
                    <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                        <div class="min-w-0">
                            <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                <AppIcon name="receipt" class="size-4 text-muted-foreground" />
                                Dispensing Claim Links
                            </h3>
                            <p class="mt-1 text-xs text-muted-foreground">Connect dispensed stock to payer claims, NHIF references, invoice traceability, and reimbursement follow-up.</p>
                        </div>
                        <Button size="sm" class="h-9 shrink-0 gap-1.5 rounded-lg text-xs" @click="createClaimLinkDialogOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            Link Dispensing
                        </Button>
                    </div>

                    <div class="flex items-center gap-2 border-b px-4 py-3">
                        <SearchInput
                            v-model="claimLinkSearch.q"
                            placeholder="Search NHIF code, payer..."
                            class="min-w-0 flex-1 text-xs"
                            @keyup.enter="claimLinkSearch.page = 1; loadClaimLinks()"
                        />
                        <Select :model-value="toSelectValue(claimLinkSearch.claimStatus)" @update:model-value="val => { claimLinkSearch.claimStatus = fromSelectValue(String(val ?? EMPTY_SELECT_VALUE)); claimLinkSearch.page = 1; loadClaimLinks() }">
                            <SelectTrigger class="h-9 w-44 rounded-lg text-xs">
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                <SelectItem v-for="s in CLAIM_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" class="h-9 gap-1.5 rounded-lg text-xs text-muted-foreground" @click="claimLinkSearch.page = 1; loadClaimLinks()">
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            Refresh
                        </Button>
                    </div>

                    <CardContent class="flex min-h-0 flex-1 flex-col p-0">
                        <div v-if="claimLinkLoading" class="divide-y">
                            <div v-for="n in 4" :key="`claim-skeleton-${n}`" class="flex items-start gap-3 px-4 py-4">
                                <div class="mt-0.5 size-1 w-[3px] self-stretch animate-pulse rounded bg-muted" />
                                <div class="min-w-0 flex-1 space-y-2">
                                    <div class="flex items-center gap-2">
                                        <div class="h-3.5 w-28 animate-pulse rounded bg-muted" />
                                        <div class="h-5 w-16 animate-pulse rounded-full bg-muted" />
                                    </div>
                                    <div class="h-3 w-3/4 animate-pulse rounded bg-muted" />
                                    <div class="h-3 w-1/2 animate-pulse rounded bg-muted" />
                                </div>
                                <div class="h-8 w-20 animate-pulse rounded-lg bg-muted" />
                            </div>
                        </div>
                        <div
                            v-else-if="claimLinks.length === 0"
                            class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
                        >
                            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                <AppIcon name="receipt" class="size-5 text-muted-foreground/40" />
                            </div>
                            <div class="space-y-1">
                                <p class="text-sm font-semibold">No dispensing claim links found</p>
                                <p class="max-w-xs text-xs text-muted-foreground">Claim links appear when dispensed stock is connected to payer, invoice, NHIF, or reimbursement workflows.</p>
                            </div>
                            <Button size="sm" class="mt-1 h-8 gap-1.5 rounded-lg text-xs" @click="createClaimLinkDialogOpen = true">
                                <AppIcon name="plus" class="size-3.5" />
                                Link Dispensing
                            </Button>
                        </div>
                        <div v-else-if="claimLinks.length > 0" class="divide-y">
                            <div v-for="link in claimLinks" :key="link.id" class="relative flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/30 md:flex-row md:items-start md:justify-between">
                                <div class="absolute inset-y-0 left-0 w-[3px]" :class="claimStatusBadgeClass(link.claim_status).includes('red') ? 'bg-destructive' : claimStatusBadgeClass(link.claim_status).includes('green') ? 'bg-green-500' : claimStatusBadgeClass(link.claim_status).includes('blue') ? 'bg-blue-500' : 'bg-muted-foreground/30'" />
                                <div class="min-w-0 flex-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <p class="font-mono text-sm font-semibold">{{ link.nhif_code || link.id }}</p>
                                        <Badge :class="claimStatusBadgeClass(link.claim_status)">{{ formatEnumLabel(link.claim_status) }}</Badge>
                                    </div>
                                    <p class="mt-1 text-xs text-muted-foreground">
                                        {{ link.payer_name || link.payer_type || 'No payer recorded' }} &middot; Qty {{ formatAmount(link.quantity_dispensed) }} {{ link.unit || '' }}
                                    </p>
                                    <div class="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                                        <p>Item <span class="font-mono text-foreground">{{ link.item_id?.substring(0, 8) || 'N/A' }}</span></p>
                                        <p>Patient <span class="font-mono text-foreground">{{ link.patient_id?.substring(0, 8) || 'N/A' }}</span></p>
                                        <p>Created <span class="text-foreground">{{ link.created_at?.substring(0, 10) || 'N/A' }}</span></p>
                                    </div>
                                </div>
                                <div class="flex shrink-0 items-center gap-1.5">
                                    <Badge variant="outline" class="rounded-lg">{{ link.payer_type || 'payer' }}</Badge>
                                </div>
                            </div>
                        </div>
                        <div v-if="false" class="overflow-auto">
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="border-b text-left text-xs text-muted-foreground">
                                        <th class="pb-2 pr-4 font-medium">Item ID</th>
                                        <th class="pb-2 pr-4 font-medium">Patient ID</th>
                                        <th class="pb-2 pr-4 font-medium">NHIF Code</th>
                                        <th class="pb-2 pr-4 font-medium">Qty</th>
                                        <th class="pb-2 pr-4 font-medium">Payer</th>
                                        <th class="pb-2 pr-4 font-medium">Status</th>
                                        <th class="pb-2 pr-4 font-medium">Created</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="link in claimLinks" :key="link.id" class="border-b last:border-0">
                                        <td class="py-2 pr-4 font-mono text-xs">{{ link.item_id?.substring(0, 8) }}...</td>
                                        <td class="py-2 pr-4 font-mono text-xs">{{ link.patient_id?.substring(0, 8) }}...</td>
                                        <td class="py-2 pr-4">{{ link.nhif_code || '—' }}</td>
                                        <td class="py-2 pr-4">{{ link.quantity_dispensed }} {{ link.unit || '' }}</td>
                                        <td class="py-2 pr-4">{{ link.payer_name || link.payer_type || '—' }}</td>
                                        <td class="py-2 pr-4">
                                            <Badge :class="claimStatusBadgeClass(link.claim_status)">{{ formatEnumLabel(link.claim_status) }}</Badge>
                                        </td>
                                        <td class="py-2 pr-4 text-xs text-muted-foreground">{{ link.created_at?.substring(0, 10) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <footer v-if="claimLinkPagination && claimLinkPagination.lastPage > 1" class="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
                            <span>Page {{ claimLinkPagination.currentPage }} of {{ claimLinkPagination.lastPage }}{{ claimLinkPagination.total != null ? ` (${claimLinkPagination.total} total)` : '' }}</span>
                            <div class="flex gap-1">
                                <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="claimLinkPagination.currentPage <= 1" @click="claimLinkSearch.page = claimLinkPagination!.currentPage - 1; loadClaimLinks()">Prev</Button>
                                <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="claimLinkPagination.currentPage >= claimLinkPagination.lastPage" @click="claimLinkSearch.page = claimLinkPagination!.currentPage + 1; loadClaimLinks()">Next</Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>
                </TabsContent>

                <!-- â”€â”€â”€ MSD Orders Tab (Feature 6) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
                <TabsContent value="msd-orders" class="mt-0 flex flex-col gap-4">
                    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                <AppIcon name="package" class="size-4 text-muted-foreground" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">MSD Orders</p>
                                <p class="text-xl font-bold leading-tight tabular-nums">{{ msdOrderPagination?.total ?? msdOrders.length }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-blue-200/70 bg-blue-50/50 px-4 py-3 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                                <AppIcon name="activity" class="size-4 text-blue-600 dark:text-blue-400" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-blue-700/70 dark:text-blue-400/70">Submitted</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-blue-700 dark:text-blue-300">{{ msdOrders.filter((order) => ['submitted', 'acknowledged'].includes(order.status)).length }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-amber-200/70 bg-amber-50/50 px-4 py-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
                                <AppIcon name="clock" class="size-4 text-amber-600 dark:text-amber-400" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-amber-700/70 dark:text-amber-400/70">Pending</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-amber-700 dark:text-amber-300">{{ msdOrders.filter((order) => ['draft', 'pending', 'pending_submission'].includes(order.status)).length }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-green-200/70 bg-green-50/50 px-4 py-3 shadow-sm dark:border-green-900/40 dark:bg-green-950/20">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
                                <AppIcon name="check-circle" class="size-4 text-green-600 dark:text-green-400" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-green-700/70 dark:text-green-400/70">Fulfilled</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-green-700 dark:text-green-300">{{ msdOrders.filter((order) => ['fulfilled', 'received', 'closed'].includes(order.status)).length }}</p>
                            </div>
                        </div>
                    </div>

                <Card class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col shadow-sm">
                    <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                        <div class="min-w-0">
                            <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                <AppIcon name="package" class="size-4 text-muted-foreground" />
                                MSD Electronic Orders
                            </h3>
                            <p class="mt-1 text-xs text-muted-foreground">Create, submit, synchronize, and monitor Medical Stores Department supply orders.</p>
                        </div>
                        <Button size="sm" class="h-9 shrink-0 gap-1.5 rounded-lg text-xs" @click="createMsdOrderDialogOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            New MSD Order
                        </Button>
                    </div>

                    <div class="flex items-center gap-2 border-b px-4 py-3">
                        <SearchInput
                            v-model="msdOrderSearch.q"
                            placeholder="Search order number, reference..."
                            class="min-w-0 flex-1 text-xs"
                            @keyup.enter="msdOrderSearch.page = 1; loadMsdOrders()"
                        />
                        <Select :model-value="toSelectValue(msdOrderSearch.status)" @update:model-value="val => { msdOrderSearch.status = fromSelectValue(String(val ?? EMPTY_SELECT_VALUE)); msdOrderSearch.page = 1; loadMsdOrders() }">
                            <SelectTrigger class="h-9 w-44 rounded-lg text-xs">
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                <SelectItem v-for="s in MSD_ORDER_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" class="h-9 gap-1.5 rounded-lg text-xs text-muted-foreground" @click="msdOrderSearch.page = 1; loadMsdOrders()">
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            Refresh
                        </Button>
                    </div>

                    <CardContent class="flex min-h-0 flex-1 flex-col p-0">
                        <div v-if="msdOrderLoading" class="divide-y">
                            <div v-for="n in 4" :key="`msd-skeleton-${n}`" class="flex items-start gap-3 px-4 py-4">
                                <div class="mt-0.5 size-1 w-[3px] self-stretch animate-pulse rounded bg-muted" />
                                <div class="min-w-0 flex-1 space-y-2">
                                    <div class="flex items-center gap-2">
                                        <div class="h-3.5 w-32 animate-pulse rounded bg-muted" />
                                        <div class="h-5 w-16 animate-pulse rounded-full bg-muted" />
                                    </div>
                                    <div class="h-3 w-3/4 animate-pulse rounded bg-muted" />
                                    <div class="h-3 w-1/2 animate-pulse rounded bg-muted" />
                                </div>
                                <div class="h-8 w-20 animate-pulse rounded-lg bg-muted" />
                            </div>
                        </div>
                        <div
                            v-else-if="msdOrders.length === 0"
                            class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
                        >
                            <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                <AppIcon name="package" class="size-5 text-muted-foreground/40" />
                            </div>
                            <div class="space-y-1">
                                <p class="text-sm font-semibold">No MSD orders found</p>
                                <p class="max-w-xs text-xs text-muted-foreground">MSD orders appear after public-sector procurement orders are created, submitted, or synchronized.</p>
                            </div>
                            <Button size="sm" class="mt-1 h-8 gap-1.5 rounded-lg text-xs" @click="createMsdOrderDialogOpen = true">
                                <AppIcon name="plus" class="size-3.5" />
                                New MSD Order
                            </Button>
                        </div>
                        <div v-else-if="msdOrders.length > 0" class="divide-y">
                            <div v-for="order in msdOrders" :key="order.id" class="relative flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/30 md:flex-row md:items-start md:justify-between">
                                <div class="absolute inset-y-0 left-0 w-[3px]" :class="msdStatusBadgeClass(order.status).includes('red') ? 'bg-destructive' : msdStatusBadgeClass(order.status).includes('green') ? 'bg-green-500' : msdStatusBadgeClass(order.status).includes('amber') ? 'bg-amber-500' : msdStatusBadgeClass(order.status).includes('blue') ? 'bg-blue-500' : 'bg-muted-foreground/30'" />
                                <div class="min-w-0 flex-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <p class="font-mono text-sm font-semibold">{{ order.msd_order_number }}</p>
                                        <Badge :class="msdStatusBadgeClass(order.status)">{{ formatEnumLabel(order.status) }}</Badge>
                                    </div>
                                    <p class="mt-1 text-xs text-muted-foreground">
                                        Facility {{ order.facility_msd_code || 'not set' }} &middot; {{ Array.isArray(order.order_lines) ? order.order_lines.length : 0 }} line{{ Array.isArray(order.order_lines) && order.order_lines.length === 1 ? '' : 's' }}
                                    </p>
                                    <div class="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                                        <p>Order date <span class="text-foreground">{{ order.order_date || 'N/A' }}</span></p>
                                        <p>Total <span class="font-medium text-foreground">TZS {{ order.total_amount != null ? Number(order.total_amount).toLocaleString() : 'N/A' }}</span></p>
                                        <p>Reference <span class="font-mono text-foreground">{{ order.submission_reference || 'Not submitted' }}</span></p>
                                    </div>
                                </div>
                                <div class="flex shrink-0 items-center gap-1.5">
                                    <Button v-if="order.submission_reference" variant="outline" size="sm" class="h-8 gap-1.5 rounded-lg text-xs" @click="syncMsdOrderStatus(order.id)">
                                        <AppIcon name="refresh-cw" class="size-3.5" />
                                        Sync
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div v-if="false" class="overflow-auto">
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="border-b text-left text-xs text-muted-foreground">
                                        <th class="pb-2 pr-4 font-medium">Order #</th>
                                        <th class="pb-2 pr-4 font-medium">Facility Code</th>
                                        <th class="pb-2 pr-4 font-medium">Order Date</th>
                                        <th class="pb-2 pr-4 font-medium">Lines</th>
                                        <th class="pb-2 pr-4 font-medium">Total (TZS)</th>
                                        <th class="pb-2 pr-4 font-medium">Status</th>
                                        <th class="pb-2 pr-4 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="order in msdOrders" :key="order.id" class="border-b last:border-0">
                                        <td class="py-2 pr-4 font-medium">{{ order.msd_order_number }}</td>
                                        <td class="py-2 pr-4 text-xs">{{ order.facility_msd_code || '—' }}</td>
                                        <td class="py-2 pr-4 text-xs">{{ order.order_date }}</td>
                                        <td class="py-2 pr-4 text-xs">{{ Array.isArray(order.order_lines) ? order.order_lines.length : 0 }}</td>
                                        <td class="py-2 pr-4 text-xs">{{ order.total_amount != null ? Number(order.total_amount).toLocaleString() : '—' }}</td>
                                        <td class="py-2 pr-4">
                                            <Badge :class="msdStatusBadgeClass(order.status)">{{ formatEnumLabel(order.status) }}</Badge>
                                        </td>
                                        <td class="py-2 pr-4">
                                            <Button v-if="order.submission_reference" variant="outline" size="sm" class="h-7 text-xs" @click="syncMsdOrderStatus(order.id)">
                                                <AppIcon name="refresh-cw" class="mr-1 size-3" />
                                                Sync
                                            </Button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <footer v-if="msdOrderPagination && msdOrderPagination.lastPage > 1" class="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
                            <span>Page {{ msdOrderPagination.currentPage }} of {{ msdOrderPagination.lastPage }}{{ msdOrderPagination.total != null ? ` (${msdOrderPagination.total} total)` : '' }}</span>
                            <div class="flex gap-1">
                                <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="msdOrderPagination.currentPage <= 1" @click="msdOrderSearch.page = msdOrderPagination!.currentPage - 1; loadMsdOrders()">Prev</Button>
                                <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs" :disabled="msdOrderPagination.currentPage >= msdOrderPagination.lastPage" @click="msdOrderSearch.page = msdOrderPagination!.currentPage + 1; loadMsdOrders()">Next</Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>
                </TabsContent>

                <!-- â”€â”€â”€ Analytics Tab (Feature 8) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
                <TabsContent value="analytics" class="mt-0 flex flex-col gap-4">
                    <div class="flex items-center justify-between gap-4 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3.5 shadow-sm">
                        <div class="min-w-0">
                            <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                <AppIcon name="activity" class="size-4 text-muted-foreground" />
                                Inventory Analytics
                            </h3>
                            <p class="mt-1 text-xs text-muted-foreground">Operational intelligence for consumption, classification, expiry risk, and stock velocity.</p>
                        </div>
                        <Button variant="outline" size="sm" class="h-9 gap-1.5 rounded-lg text-xs" :disabled="analyticsLoading" @click="loadAllAnalytics()">
                            <AppIcon :name="analyticsLoading ? 'loader-2' : 'refresh-cw'" :class="['size-3.5', analyticsLoading && 'animate-spin']" />
                            Refresh
                        </Button>
                    </div>

                    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div class="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                <AppIcon name="activity" class="size-4 text-muted-foreground" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Trend Periods</p>
                                <p class="text-xl font-bold leading-tight tabular-nums">{{ consumptionTrends.length }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-blue-200/70 bg-blue-50/50 px-4 py-3 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                                <AppIcon name="layout-grid" class="size-4 text-blue-600 dark:text-blue-400" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-blue-700/70 dark:text-blue-400/70">ABC/VEN Cells</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-blue-700 dark:text-blue-300">{{ abcVenMatrix.length }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 shadow-sm">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                                <AppIcon name="alert-triangle" class="size-4 text-destructive" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-destructive/80">Expired Batches</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-destructive">{{ expiryWastage?.summary?.expiredCount ?? 0 }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-green-200/70 bg-green-50/50 px-4 py-3 shadow-sm dark:border-green-900/40 dark:bg-green-950/20">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
                                <AppIcon name="package" class="size-4 text-green-600 dark:text-green-400" />
                            </span>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-wider text-green-700/70 dark:text-green-400/70">Turnover Items</p>
                                <p class="text-xl font-bold leading-tight tabular-nums text-green-700 dark:text-green-300">{{ stockTurnover.length }}</p>
                            </div>
                        </div>
                    </div>

                    <Tabs default-value="consumption" class="min-h-0 space-y-3">
                        <TabsList class="flex h-auto w-full flex-wrap justify-start gap-2 rounded-lg bg-muted/30 p-1">
                            <TabsTrigger value="consumption" class="gap-1.5 rounded-md px-3 py-1.5 text-xs">
                                <AppIcon name="activity" class="size-3.5" />
                                Consumption
                            </TabsTrigger>
                            <TabsTrigger value="classification" class="gap-1.5 rounded-md px-3 py-1.5 text-xs">
                                <AppIcon name="layout-grid" class="size-3.5" />
                                ABC/VEN
                            </TabsTrigger>
                            <TabsTrigger value="expiry" class="gap-1.5 rounded-md px-3 py-1.5 text-xs">
                                <AppIcon name="alert-triangle" class="size-3.5" />
                                Expiry Risk
                            </TabsTrigger>
                            <TabsTrigger value="turnover" class="gap-1.5 rounded-md px-3 py-1.5 text-xs">
                                <AppIcon name="package" class="size-3.5" />
                                Turnover
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="consumption" class="mt-0">
                    <Card class="rounded-lg border-sidebar-border/70 shadow-sm">
                        <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                            <div class="min-w-0">
                                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                    <AppIcon name="activity" class="size-4 text-muted-foreground" />
                                    Consumption Trends
                                </h3>
                                <p class="mt-1 text-xs text-muted-foreground">Issue movements aggregated over time.</p>
                            </div>
                        </div>
                        <CardContent class="p-4">
                            <div class="mb-3 flex flex-wrap items-center gap-2">
                                <Select :model-value="toSelectValue(consumptionGranularity)" @update:model-value="consumptionGranularity = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                    <SelectTrigger class="h-9 w-36 rounded-lg text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select :model-value="String(consumptionDays)" @update:model-value="consumptionDays = Number($event)">
                                    <SelectTrigger class="h-9 w-32 rounded-lg text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="7">7 days</SelectItem>
                                    <SelectItem value="30">30 days</SelectItem>
                                    <SelectItem value="90">90 days</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" size="sm" class="h-9 rounded-lg text-xs" @click="loadConsumptionTrends()">Apply</Button>
                            </div>
                            <div v-if="!consumptionTrends.length" class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                                <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                    <AppIcon name="activity" class="size-5 text-muted-foreground/40" />
                                </div>
                                <div class="space-y-1">
                                    <p class="text-sm font-semibold">No consumption data available</p>
                                    <p class="max-w-xs text-xs text-muted-foreground">Click Refresh or post stock issue movements to populate consumption trends.</p>
                                </div>
                            </div>
                            <div v-else class="overflow-auto">
                                <table class="w-full text-sm">
                                    <thead>
                                        <tr class="border-b text-left text-xs text-muted-foreground">
                                            <th class="pb-2 pr-4 font-medium">Period</th>
                                            <th class="pb-2 pr-4 font-medium text-right">Total Issued</th>
                                            <th class="pb-2 pr-4 font-medium text-right">Movements</th>
                                            <th class="pb-2 font-medium">Bar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="row in consumptionTrends" :key="row.period" class="border-b last:border-0">
                                            <td class="py-1.5 pr-4 text-xs font-medium">{{ row.period }}</td>
                                            <td class="py-1.5 pr-4 text-right text-xs">{{ Number(row.totalIssued).toLocaleString() }}</td>
                                            <td class="py-1.5 pr-4 text-right text-xs">{{ row.movementCount }}</td>
                                            <td class="py-1.5">
                                                <div class="h-3 rounded bg-blue-200 dark:bg-blue-800" :style="{ width: Math.min(100, (row.totalIssued / Math.max(...consumptionTrends.map(r => r.totalIssued), 1)) * 100) + '%' }"></div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                        </TabsContent>

                        <TabsContent value="classification" class="mt-0">
                    <Card class="rounded-lg border-sidebar-border/70 shadow-sm">
                        <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                            <div class="min-w-0">
                                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                    <AppIcon name="layout-grid" class="size-4 text-muted-foreground" />
                                    ABC/VEN Matrix
                                </h3>
                                <p class="mt-1 text-xs text-muted-foreground">Items classified by value (ABC) and essentiality (VEN).</p>
                            </div>
                        </div>
                        <CardContent class="p-4">
                            <div v-if="!abcVenMatrix.length" class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                                <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                    <AppIcon name="layout-grid" class="size-5 text-muted-foreground/40" />
                                </div>
                                <div class="space-y-1">
                                    <p class="text-sm font-semibold">No classification data available</p>
                                    <p class="max-w-xs text-xs text-muted-foreground">Click Refresh after inventory items have stock, movement, and essentiality metadata.</p>
                                </div>
                            </div>
                            <div v-else class="overflow-auto">
                                <table class="w-full text-sm">
                                    <thead>
                                        <tr class="border-b text-left text-xs text-muted-foreground">
                                            <th class="pb-2 pr-4 font-medium">ABC</th>
                                            <th class="pb-2 pr-4 font-medium">VEN</th>
                                            <th class="pb-2 pr-4 font-medium text-right">Items</th>
                                            <th class="pb-2 pr-4 font-medium text-right">Total Stock</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(cell, i) in abcVenMatrix" :key="i" class="border-b last:border-0">
                                            <td class="py-1.5 pr-4"><Badge variant="outline">{{ cell.abc }}</Badge></td>
                                            <td class="py-1.5 pr-4"><Badge variant="outline">{{ cell.ven }}</Badge></td>
                                            <td class="py-1.5 pr-4 text-right text-xs font-medium">{{ cell.itemCount }}</td>
                                            <td class="py-1.5 pr-4 text-right text-xs">{{ Number(cell.totalStock).toLocaleString() }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                        </TabsContent>

                        <TabsContent value="expiry" class="mt-0">
                    <Card class="rounded-lg border-sidebar-border/70 shadow-sm">
                        <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                            <div class="min-w-0">
                                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                    <AppIcon name="alert-triangle" class="size-4 text-muted-foreground" />
                                    Expiry Wastage Tracking
                                </h3>
                                <p class="mt-1 text-xs text-muted-foreground">Batches that are expired, near-expiry, or approaching expiry.</p>
                            </div>
                        </div>
                        <CardContent class="p-4">
                            <div v-if="!expiryWastage" class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                                <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                    <AppIcon name="alert-triangle" class="size-5 text-muted-foreground/40" />
                                </div>
                                <div class="space-y-1">
                                    <p class="text-sm font-semibold">No expiry data available</p>
                                    <p class="max-w-xs text-xs text-muted-foreground">Click Refresh after batch, lot, and expiry dates have been captured.</p>
                                </div>
                            </div>
                            <template v-else>
                                <div class="mb-4 grid gap-3 sm:grid-cols-3">
                                    <div class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                                        <p class="text-2xl font-bold text-destructive">{{ expiryWastage.summary.expiredCount }}</p>
                                        <p class="text-xs text-muted-foreground">Expired Batches</p>
                                        <p v-if="expiryWastage.summary.expiredTotalValue" class="mt-1 text-xs font-medium text-destructive">TZS {{ Number(expiryWastage.summary.expiredTotalValue).toLocaleString() }}</p>
                                    </div>
                                    <div class="rounded-lg border border-orange-400/30 bg-orange-50 p-3 text-center dark:bg-orange-950/20">
                                        <p class="text-2xl font-bold text-orange-600 dark:text-orange-400">{{ expiryWastage.summary.criticalCount }}</p>
                                        <p class="text-xs text-muted-foreground">Critical (â‰¤30 days)</p>
                                        <p v-if="expiryWastage.summary.criticalTotalValue" class="mt-1 text-xs font-medium text-orange-600 dark:text-orange-400">TZS {{ Number(expiryWastage.summary.criticalTotalValue).toLocaleString() }}</p>
                                    </div>
                                    <div class="rounded-lg border border-yellow-400/30 bg-yellow-50 p-3 text-center dark:bg-yellow-950/20">
                                        <p class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{{ expiryWastage.summary.warningCount }}</p>
                                        <p class="text-xs text-muted-foreground">Warning (â‰¤90 days)</p>
                                        <p v-if="expiryWastage.summary.warningTotalValue" class="mt-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">TZS {{ Number(expiryWastage.summary.warningTotalValue).toLocaleString() }}</p>
                                    </div>
                                </div>
                                <div v-if="expiryWastage.expired.length" class="mb-3">
                                    <h4 class="mb-2 text-sm font-medium text-destructive">Expired Batches</h4>
                                    <div class="overflow-auto">
                                        <table class="w-full text-xs">
                                            <thead><tr class="border-b text-left text-muted-foreground"><th class="pb-1 pr-3 font-medium">Batch</th><th class="pb-1 pr-3 font-medium">Expiry</th><th class="pb-1 pr-3 font-medium text-right">Qty</th><th class="pb-1 pr-3 font-medium text-right">Waste Value</th></tr></thead>
                                            <tbody>
                                                <tr v-for="b in expiryWastage.expired.slice(0, 20)" :key="b.id" class="border-b last:border-0">
                                                    <td class="py-1 pr-3">{{ b.batchNumber }}</td>
                                                    <td class="py-1 pr-3 text-destructive">{{ b.expiryDate }}</td>
                                                    <td class="py-1 pr-3 text-right">{{ b.quantity }}</td>
                                                    <td class="py-1 pr-3 text-right">{{ b.estimatedWasteValue != null ? Number(b.estimatedWasteValue).toLocaleString() : '—' }}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </template>
                        </CardContent>
                    </Card>
                        </TabsContent>

                        <TabsContent value="turnover" class="mt-0">
                    <Card class="rounded-lg border-sidebar-border/70 shadow-sm">
                        <div class="flex items-center justify-between gap-4 border-b px-4 py-3.5">
                            <div class="min-w-0">
                                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                    <AppIcon name="activity" class="size-4 text-muted-foreground" />
                                    Stock Turnover
                                </h3>
                                <p class="mt-1 text-xs text-muted-foreground">Consumption rate vs. current stock levels over 90 days.</p>
                            </div>
                        </div>
                        <CardContent class="p-4">
                            <div v-if="!stockTurnover.length" class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                                <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                    <AppIcon name="activity" class="size-5 text-muted-foreground/40" />
                                </div>
                                <div class="space-y-1">
                                    <p class="text-sm font-semibold">No turnover data available</p>
                                    <p class="max-w-xs text-xs text-muted-foreground">Click Refresh after stock issues are recorded against inventory items.</p>
                                </div>
                            </div>
                            <div v-else class="overflow-auto">
                                <table class="w-full text-sm">
                                    <thead>
                                        <tr class="border-b text-left text-xs text-muted-foreground">
                                            <th class="pb-2 pr-4 font-medium">Item</th>
                                            <th class="pb-2 pr-4 font-medium">Category</th>
                                            <th class="pb-2 pr-4 font-medium text-right">Stock</th>
                                            <th class="pb-2 pr-4 font-medium text-right">Issued (90d)</th>
                                            <th class="pb-2 pr-4 font-medium text-right">Turnover</th>
                                            <th class="pb-2 pr-4 font-medium text-right">Days of Stock</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="item in stockTurnover.slice(0, 50)" :key="item.itemId" class="border-b last:border-0">
                                            <td class="py-1.5 pr-4">
                                                <div class="text-xs font-medium">{{ item.itemName }}</div>
                                                <div class="text-[10px] text-muted-foreground">{{ item.itemCode }}</div>
                                            </td>
                                            <td class="py-1.5 pr-4 text-xs">{{ item.category ? formatEnumLabel(item.category) : '—' }}</td>
                                            <td class="py-1.5 pr-4 text-right text-xs">{{ Number(item.currentStock).toLocaleString() }}</td>
                                            <td class="py-1.5 pr-4 text-right text-xs">{{ Number(item.totalIssued).toLocaleString() }}</td>
                                            <td class="py-1.5 pr-4 text-right text-xs font-medium">{{ item.turnoverRate }}×</td>
                                            <td class="py-1.5 pr-4 text-right text-xs">{{ item.daysOfStock != null ? item.daysOfStock + 'd' : 'âˆž' }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                        </TabsContent>
                    </Tabs>
                </TabsContent>

            </div>
            </Tabs>

            <!-- Inventory filters sheet -->
            <Sheet v-if="canRead" :open="itemFiltersSheetOpen" @update:open="itemFiltersSheetOpen = $event">
                <SheetContent side="right" variant="form" size="md" class="flex h-full min-h-0 flex-col">
                    <SheetHeader>
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            Inventory Filters
                        </SheetTitle>
                        <SheetDescription>Filter and sort inventory items without crowding the main list.</SheetDescription>
                    </SheetHeader>
                    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        <div class="rounded-lg border p-3">
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="inv-search-q-sheet">Search</Label>
                                    <Input
                                        id="inv-search-q-sheet"
                                        v-model="itemSearch.q"
                                        placeholder="Item code, name, category..."
                                        @keyup.enter="submitItemFiltersFromSheet"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-search-category-sheet">Category</Label>
                                    <Select :model-value="toSelectValue(itemSearch.category)" @update:model-value="itemSearch.category = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem :value="EMPTY_SELECT_VALUE">All Categories</SelectItem>
                                        <SelectItem v-for="cat in itemCategoryOptions" :key="cat.value" :value="cat.value">{{ cat.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-search-stock-state-sheet">Store Stock State</Label>
                                    <Select :model-value="toSelectValue(itemSearch.stockState)" @update:model-value="itemSearch.stockState = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem :value="EMPTY_SELECT_VALUE">All</SelectItem>
                                        <SelectItem v-for="opt in stockStateOptions" :key="opt" :value="opt">{{ stockStateLabel(opt) }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Separator />
                                <div class="grid gap-2">
                                    <Label for="inv-sort-by-sheet">Sort by</Label>
                                    <Select :model-value="toSelectValue(itemSearch.sortBy)" @update:model-value="itemSearch.sortBy = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="itemName">Name</SelectItem>
                                            <SelectItem value="itemCode">Code</SelectItem>
                                            <SelectItem value="currentStock">Store Stock</SelectItem>
                                            <SelectItem value="category">Category</SelectItem>
                                            <SelectItem value="createdAt">Created</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-sort-dir-sheet">Sort direction</Label>
                                    <Select :model-value="toSelectValue(itemSearch.sortDir)" @update:model-value="itemSearch.sortDir = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="asc">Ascending</SelectItem>
                                            <SelectItem value="desc">Descending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-search-per-page-sheet">Results per page</Label>
                                    <Select :model-value="String(itemSearch.perPage)" @update:model-value="itemSearch.perPage = Number($event)">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <SheetFooter class="gap-2 border-t px-4 py-3">
                        <Button :disabled="loading" class="gap-1.5" @click="submitItemFiltersFromSheet">
                            <AppIcon name="search" class="size-3.5" />
                            Apply Filters
                        </Button>
                        <Button variant="outline" :disabled="loading && !hasAnyItemFilters" @click="resetItemFiltersFromSheet">
                            Reset Filters
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Mobile procurement filters drawer -->
            <Drawer v-if="canRead" :open="mobileProcurementDrawerOpen" @update:open="mobileProcurementDrawerOpen = $event">
                <DrawerContent class="max-h-[90vh]">
                    <DrawerHeader>
                        <DrawerTitle class="flex items-center gap-2">
                            <AppIcon name="clipboard-list" class="size-4 text-muted-foreground" />
                            Procurement Filters
                        </DrawerTitle>
                        <DrawerDescription>Filter procurement requests on mobile.</DrawerDescription>
                    </DrawerHeader>
                    <div class="space-y-4 overflow-y-auto px-4 pb-2">
                        <div class="rounded-lg border p-3">
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="inv-proc-q-mobile">Search</Label>
                                    <Input
                                        id="inv-proc-q-mobile"
                                        v-model="procurementSearch.q"
                                        placeholder="Request number, supplier..."
                                        @keyup.enter="submitProcurementSearchFromMobileDrawer"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-proc-status-mobile">Status</Label>
                                    <Select :model-value="toSelectValue(procurementSearch.status)" @update:model-value="procurementSearch.status = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem :value="EMPTY_SELECT_VALUE">All</SelectItem>
                                        <SelectItem v-for="opt in procurementStatusOptions" :key="opt" :value="opt">{{ formatEnumLabel(opt) }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-proc-sort-mobile">Sort by</Label>
                                    <Select :model-value="toSelectValue(procurementSearch.sortBy)" @update:model-value="procurementSearch.sortBy = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="createdAt">Created</SelectItem>
                                        <SelectItem value="neededBy">Needed By</SelectItem>
                                        <SelectItem value="requestedQuantity">Quantity</SelectItem>
                                        <SelectItem value="status">Status</SelectItem>
                                        <SelectItem value="supplierName">Supplier</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-proc-sort-dir-mobile">Sort direction</Label>
                                    <Select :model-value="toSelectValue(procurementSearch.sortDir)" @update:model-value="procurementSearch.sortDir = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="asc">Ascending</SelectItem>
                                        <SelectItem value="desc">Descending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-proc-per-page-mobile">Results per page</Label>
                                    <Select :model-value="String(procurementSearch.perPage)" @update:model-value="procurementSearch.perPage = Number($event)">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DrawerFooter class="gap-2">
                        <Button :disabled="loading" class="gap-1.5" @click="submitProcurementSearchFromMobileDrawer">
                            <AppIcon name="search" class="size-3.5" />
                            Search
                        </Button>
                        <Button variant="outline" :disabled="loading && !hasAnyProcurementFilters" @click="resetProcurementFiltersFromMobileDrawer">
                            Reset Filters
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            <!-- Mobile stock ledger filters drawer -->
            <Drawer v-if="canRead" :open="mobileLedgerDrawerOpen" @update:open="mobileLedgerDrawerOpen = $event">
                <DrawerContent class="max-h-[90vh]">
                    <DrawerHeader>
                        <DrawerTitle class="flex items-center gap-2">
                            <AppIcon name="activity" class="size-4 text-muted-foreground" />
                            Stock Ledger Filters
                        </DrawerTitle>
                        <DrawerDescription>Filter stock movements on mobile.</DrawerDescription>
                    </DrawerHeader>
                    <div class="space-y-4 overflow-y-auto px-4 pb-2">
                        <div class="rounded-lg border p-3">
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="inv-ledger-q-mobile">Search</Label>
                                    <Input id="inv-ledger-q-mobile" v-model="stockLedgerFilters.q" placeholder="Reason, notes, item..." />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-ledger-item-mobile">Item UUID</Label>
                                    <Input id="inv-ledger-item-mobile" v-model="stockLedgerFilters.itemId" placeholder="Item UUID" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-ledger-type-mobile">Movement Type</Label>
                                    <Select :model-value="toSelectValue(stockLedgerFilters.movementType)" @update:model-value="stockLedgerFilters.movementType = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem :value="EMPTY_SELECT_VALUE">All movement types</SelectItem>
                                        <SelectItem v-for="opt in movementTypeOptions" :key="`ledger-m-${opt}`" :value="opt">{{ formatEnumLabel(opt) }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-ledger-source-mobile">Source</Label>
                                    <Select :model-value="toSelectValue(stockLedgerFilters.sourceKey)" @update:model-value="stockLedgerFilters.sourceKey = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem v-for="option in stockLedgerSourceOptions" :key="`ledger-source-mobile-${option.value || 'all'}`" :value="toSelectValue(option.value)">{{ option.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-ledger-from-mobile">From</Label>
                                    <Input id="inv-ledger-from-mobile" v-model="stockLedgerFilters.from" type="datetime-local" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-ledger-to-mobile">To</Label>
                                    <Input id="inv-ledger-to-mobile" v-model="stockLedgerFilters.to" type="datetime-local" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-ledger-per-page-mobile">Results per page</Label>
                                    <Select :model-value="String(stockLedgerFilters.perPage)" @update:model-value="stockLedgerFilters.perPage = Number($event)">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DrawerFooter class="gap-2">
                        <Button :disabled="stockLedgerLoading" class="gap-1.5" @click="submitLedgerSearchFromMobileDrawer">
                            <AppIcon name="search" class="size-3.5" />
                            Apply
                        </Button>
                        <Button variant="outline" :disabled="stockLedgerLoading" @click="resetLedgerFiltersFromMobileDrawer">
                            Reset Filters
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    </AppLayout>

    <!-- Create Batch Dialog -->
    <Sheet :open="createBatchDialogOpen" @update:open="createBatchDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="package" class="size-5 text-muted-foreground" />
                    Add Batch / Lot
                </SheetTitle>
                <SheetDescription>Record a new batch for {{ itemDetails?.itemName ?? 'this item' }}.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-3 sm:grid-cols-2">
                <div class="grid gap-2">
                    <Label for="inv-batch-number">Batch Number</Label>
                    <Input id="inv-batch-number" v-model="batchForm.batchNumber" :disabled="batchCreateSubmitting" />
                    <p v-if="fieldError(batchCreateErrors, 'batchNumber')" class="text-xs text-destructive">{{ fieldError(batchCreateErrors, 'batchNumber') }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="inv-batch-lot">Lot Number</Label>
                    <Input id="inv-batch-lot" v-model="batchForm.lotNumber" :disabled="batchCreateSubmitting" />
                </div>
                <SingleDatePopoverField
                    input-id="inv-batch-manufacture"
                    label="Manufacture Date"
                    v-model="batchForm.manufactureDate"
                    :disabled="batchCreateSubmitting"
                />
                <SingleDatePopoverField
                    input-id="inv-batch-expiry"
                    label="Expiry Date"
                    v-model="batchForm.expiryDate"
                    :disabled="batchCreateSubmitting"
                    :error-message="fieldError(batchCreateErrors, 'expiryDate')"
                />
                <div class="grid gap-2">
                    <Label for="inv-batch-quantity">Quantity</Label>
                    <Input id="inv-batch-quantity" v-model="batchForm.quantity" :disabled="batchCreateSubmitting" type="number" min="0" step="0.001" />
                    <p v-if="fieldError(batchCreateErrors, 'quantity')" class="text-xs text-destructive">{{ fieldError(batchCreateErrors, 'quantity') }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="inv-batch-unit-cost">Unit Cost</Label>
                    <Input id="inv-batch-unit-cost" v-model="batchForm.unitCost" :disabled="batchCreateSubmitting" type="number" min="0" step="0.01" />
                </div>
                <div class="grid gap-2">
                    <Label for="inv-batch-bin">Bin Location</Label>
                    <Input id="inv-batch-bin" v-model="batchForm.binLocation" :disabled="batchCreateSubmitting" placeholder="e.g. A-03-12" />
                </div>
                <div class="grid gap-2">
                    <Label for="inv-batch-warehouse">Warehouse ID</Label>
                    <Input id="inv-batch-warehouse" v-model="batchForm.warehouseId" :disabled="batchCreateSubmitting" placeholder="Optional UUID" />
                </div>
                <div class="grid gap-2 sm:col-span-2">
                    <Label for="inv-batch-supplier">Supplier ID</Label>
                    <Input id="inv-batch-supplier" v-model="batchForm.supplierId" :disabled="batchCreateSubmitting" placeholder="Optional UUID" />
                </div>
            </div>
            </ScrollArea>
            <SheetFooter class="flex-wrap gap-2 shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="createBatchDialogOpen = false">Cancel</Button>
                <Button :disabled="batchCreateSubmitting" class="gap-1.5" @click="submitCreateBatch">
                    <AppIcon name="plus" class="size-3.5" />
                    {{ batchCreateSubmitting ? 'Creating...' : 'Create Batch' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <!-- Create Department Requisition Dialog -->
    <Sheet :open="createRequisitionDialogOpen" @update:open="createRequisitionDialogOpen = $event">
        <SheetContent side="right" variant="form" size="6xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="clipboard-list" class="size-5 text-muted-foreground" />
                    Create Department Requisition
                </SheetTitle>
                <SheetDescription>Submit an internal request for inventory items from a hospital department.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <fieldset class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Request Details</legend>
                    <FormFieldShell
                        input-id="inv-req-dept"
                        label="Requesting Department"
                        :helper-text="requisitionDepartmentHelperText"
                        :error-message="fieldError(reqCreateErrors, 'requestingDepartment')"
                    >
                        <Select :model-value="toSelectValue(reqForm.requestingDepartmentId)" @update:model-value="updateRequisitionDepartment(String($event ?? EMPTY_SELECT_VALUE))">
                            <SelectTrigger id="inv-req-dept" class="w-full" :disabled="reqCreateSubmitting || !canSelectAnyRequisitionDepartment">
                                <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="EMPTY_SELECT_VALUE">Select department</SelectItem>
                                <SelectItem v-for="department in requisitionDepartmentOptions" :key="department.id" :value="department.id" :text-value="lookupOptionText(department)">
                                    {{ lookupOptionText(department) }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                    <FormFieldShell
                        input-id="inv-req-warehouse"
                        label="Issuing Warehouse"
                        helper-text="Store location expected to issue the requested stock."
                        :error-message="fieldError(reqCreateErrors, 'issuingWarehouseId')"
                    >
                        <Select :model-value="toSelectValue(reqForm.issuingWarehouseId)" @update:model-value="reqForm.issuingWarehouseId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                            <SelectTrigger id="inv-req-warehouse" class="w-full" :disabled="reqCreateSubmitting">
                                <SelectValue placeholder="Select warehouse" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="EMPTY_SELECT_VALUE">Select warehouse</SelectItem>
                                <SelectItem v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id" :text-value="lookupOptionText(warehouse)">
                                    {{ lookupOptionText(warehouse) }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                    <FormFieldShell input-id="inv-req-dept-code" label="Department Code">
                        <Input id="inv-req-dept-code" :model-value="selectedRequisitionDepartment?.code ?? 'Not selected'" disabled class="bg-muted/40" />
                    </FormFieldShell>
                    <FormFieldShell input-id="inv-req-warehouse-code" label="Warehouse Code">
                        <Input id="inv-req-warehouse-code" :model-value="selectedRequisitionWarehouse?.code ?? 'Not selected'" disabled class="bg-muted/40" />
                    </FormFieldShell>
                    <FormFieldShell input-id="inv-req-priority" label="Priority">
                        <Select :model-value="toSelectValue(reqForm.priority)" @update:model-value="reqForm.priority = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                            <SelectTrigger id="inv-req-priority" class="w-full" :disabled="reqCreateSubmitting">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem v-for="p in REQUISITION_PRIORITIES" :key="p.value" :value="p.value">{{ p.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                    <SingleDatePopoverField input-id="inv-req-needed-by" label="Needed By" v-model="reqForm.neededBy" :disabled="reqCreateSubmitting" :error-message="fieldError(reqCreateErrors, 'neededBy')" />
                    <FormFieldShell input-id="inv-req-notes" label="Notes" class="sm:col-span-2">
                        <Input id="inv-req-notes" v-model="reqForm.notes" :disabled="reqCreateSubmitting" />
                    </FormFieldShell>
                </fieldset>

                <fieldset class="rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Requested Items</legend>
                    <div class="space-y-2">
                        <div v-for="(line, idx) in reqForm.lines" :key="idx" class="rounded-lg border bg-muted/10 p-3">
                            <div class="grid gap-3 xl:grid-cols-[minmax(24rem,2fr)_7.5rem_7.5rem_minmax(14rem,1fr)_2.5rem] xl:items-start">
                            <div class="min-w-0">
                                <InventoryItemLookupField
                                    :input-id="`inv-req-line-item-${idx}`"
                                    v-model="line.itemId"
                                    :label="idx === 0 ? 'Inventory item' : 'Inventory item'"
                                    placeholder="Search item name, code, barcode..."
                                    helper-text="Search inventory master data."
                                    :error-message="fieldError(reqCreateErrors, `lines.${idx}.itemId`)"
                                    :disabled="reqCreateSubmitting || !selectedRequisitionDepartmentId"
                                    :requesting-department-id="selectedRequisitionDepartmentId"
                                    browse-on-focus
                                    @selected="item => handleReqLineItemSelected(idx, item)"
                                />
                            </div>
                            <FormFieldShell
                                :input-id="`inv-req-line-qty-${idx}`"
                                label="Qty"
                                :error-message="fieldError(reqCreateErrors, `lines.${idx}.requestedQuantity`)"
                            >
                                <Input :id="`inv-req-line-qty-${idx}`" v-model="line.requestedQuantity" :disabled="reqCreateSubmitting" type="number" min="0" step="0.001" class="text-xs" />
                            </FormFieldShell>
                            <FormFieldShell
                                :input-id="`inv-req-line-unit-${idx}`"
                                label="Unit"
                                :error-message="fieldError(reqCreateErrors, `lines.${idx}.unit`)"
                            >
                                <Input :id="`inv-req-line-unit-${idx}`" v-model="line.unit" :disabled="reqCreateSubmitting" placeholder="Auto" class="text-xs" />
                            </FormFieldShell>
                            <FormFieldShell :input-id="`inv-req-line-notes-${idx}`" label="Notes">
                                <Input :id="`inv-req-line-notes-${idx}`" v-model="line.notes" :disabled="reqCreateSubmitting" class="text-xs" />
                            </FormFieldShell>
                            <Button v-if="reqForm.lines.length > 1" size="sm" variant="ghost" class="mt-5 h-9 self-start" @click="removeReqLine(idx)">
                                <AppIcon name="circle-x" class="size-3.5 text-destructive" />
                            </Button>
                            <div v-else class="hidden h-9 w-9 lg:block" />
                            </div>
                        </div>
                        <Button size="sm" variant="outline" class="gap-1" @click="addReqLine">
                            <AppIcon name="plus" class="size-3" />
                            Add Line
                        </Button>
                    </div>
                    <p v-if="fieldError(reqCreateErrors, 'lines')" class="mt-1 text-xs text-destructive">{{ fieldError(reqCreateErrors, 'lines') }}</p>
                </fieldset>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="createRequisitionDialogOpen = false">Cancel</Button>
                <Button :disabled="reqCreateSubmitting" class="gap-1.5" @click="submitCreateRequisition">
                    <AppIcon name="plus" class="size-3.5" />
                    {{ reqCreateSubmitting ? 'Creating...' : 'Create Requisition' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <!-- Department Requisition Details -->
    <Sheet
        :open="requisitionDetailsOpen"
        @update:open="value => { requisitionDetailsOpen = value; if (!value) { selectedRequisition = null; requisitionLineDecisionDrafts = []; } }"
    >
        <SheetContent side="right" variant="workspace" size="5xl" class="flex h-full min-h-0 flex-col">
            <SheetHeader class="shrink-0 border-b bg-background px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="clipboard-list" class="size-5 text-muted-foreground" />
                    {{ selectedRequisition?.status === 'submitted' ? 'Review Department Requisition' : 'Department Requisition Details' }}
                </SheetTitle>
                <SheetDescription>
                    {{ selectedRequisition?.requisitionNumber ?? 'Requisition' }}
                </SheetDescription>
            </SheetHeader>

            <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                <div v-if="selectedRequisition" class="grid gap-4 px-4 py-4">
                    <div class="grid gap-3 rounded-lg border bg-muted/10 p-3 sm:grid-cols-2">
                        <div class="min-w-0">
                            <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Department</p>
                            <p class="mt-1 truncate text-sm font-semibold">{{ selectedRequisition.requestingDepartment ?? 'Not recorded' }}</p>
                        </div>
                        <div class="min-w-0">
                            <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Issuing warehouse</p>
                            <p class="mt-1 truncate text-sm font-semibold">
                                {{ warehouseLabel(selectedRequisition.issuingWarehouseId) ?? selectedRequisition.issuingStore ?? 'Not assigned' }}
                            </p>
                        </div>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Priority</p>
                            <p class="mt-1 text-sm font-semibold">{{ formatEnumLabel(selectedRequisition.priority ?? 'normal') }}</p>
                        </div>
                        <div>
                            <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Needed by</p>
                            <p class="mt-1 text-sm font-semibold">{{ formatDateOnly(selectedRequisition.neededBy) }}</p>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3">
                        <div class="min-w-0">
                            <p class="text-sm font-semibold">Workflow status</p>
                            <p class="text-xs text-muted-foreground">
                                {{ requisitionStatusHelper(selectedRequisition.status) }}
                            </p>
                        </div>
                        <Badge :class="reqStatusBadgeClass(selectedRequisition.status)" class="shrink-0">
                            {{ formatEnumLabel(selectedRequisition.status ?? 'draft') }}
                        </Badge>
                    </div>

                    <div class="rounded-lg border">
                        <div class="border-b px-3 py-2">
                            <p class="text-sm font-semibold">Requested items</p>
                            <p class="text-xs text-muted-foreground">Review quantities before approval or issue.</p>
                        </div>
                        <div class="divide-y">
                            <div
                                v-for="line in selectedRequisition.lines ?? []"
                                :key="line.id ?? line.itemId"
                                class="grid min-w-0 gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_6.5rem_8rem_8rem]"
                            >
                                <div class="min-w-0">
                                    <p class="truncate text-sm font-semibold">{{ requisitionLineItemLabel(line) }}</p>
                                    <p class="truncate text-xs text-muted-foreground">
                                        <template v-if="line.itemCategory">{{ formatEnumLabel(line.itemCategory) }}</template>
                                        <template v-if="line.itemSubcategory"> / {{ formatEnumLabel(line.itemSubcategory) }}</template>
                                        <template v-if="line.notes"> · {{ line.notes }}</template>
                                    </p>
                                </div>
                                <div class="min-w-0">
                                    <p class="text-[11px] text-muted-foreground">Requested</p>
                                    <p class="truncate text-sm font-semibold tabular-nums">{{ formatAmount(line.requestedQuantity) }} {{ line.unit }}</p>
                                </div>
                                <div class="min-w-0">
                                    <p class="text-[11px] text-muted-foreground">Approved</p>
                                    <Input
                                        v-if="selectedRequisition.status === 'submitted'"
                                        v-model="requisitionLineDecisionDraft(line).approvedQuantity"
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        class="mt-1 h-8 text-sm"
                                    />
                                    <p v-else class="text-sm font-semibold tabular-nums">{{ line.approvedQuantity == null ? '—' : formatAmount(line.approvedQuantity) }}</p>
                                </div>
                                <div class="min-w-0">
                                    <p class="text-[11px] text-muted-foreground">Issued</p>
                                    <Input
                                        v-if="['approved', 'partially_issued'].includes(selectedRequisition.status)"
                                        v-model="requisitionLineDecisionDraft(line).issuedQuantity"
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        class="mt-1 h-8 text-sm"
                                    />
                                    <p v-else class="text-sm font-semibold tabular-nums">{{ line.issuedQuantity == null ? '—' : formatAmount(line.issuedQuantity) }}</p>
                                    <p
                                        v-if="['approved', 'partially_issued'].includes(selectedRequisition.status)"
                                        class="mt-1 text-[11px]"
                                        :class="requisitionLineIssueProblem(line) ? 'text-destructive' : 'text-muted-foreground'"
                                    >
                                        Available {{ formatAmount(requisitionLineAvailableStock(line)) }}
                                    </p>
                                    <p
                                        v-if="['approved', 'partially_issued'].includes(selectedRequisition.status) && requisitionLineShortageSummary(line)"
                                        class="mt-1 text-[11px] text-amber-700 dark:text-amber-300"
                                    >
                                        Short {{ formatAmount(requisitionApprovedDecisionQuantity(line) - requisitionIssuedDecisionQuantity(line)) }}
                                    </p>
                                </div>
                                <div
                                    v-if="canCreateProcurementFromRequisitionLine(line) || shortageLineProcurementRequest(line)"
                                    class="flex min-w-0 flex-wrap items-center gap-2 lg:col-span-4 lg:justify-end"
                                >
                                    <Button
                                        v-if="canCreateProcurementFromRequisitionLine(line)"
                                        size="sm"
                                        variant="outline"
                                        class="h-7 max-w-full gap-1.5 rounded-lg px-2 text-[11px]"
                                        @click="openProcurementFromRequisitionShortage(line)"
                                    >
                                        <AppIcon name="plus" class="size-3" />
                                        Procure shortage
                                    </Button>
                                    <Badge
                                        v-else-if="shortageLineProcurementRequest(line)"
                                        variant="outline"
                                        class="max-w-full justify-start rounded-lg px-2 py-1 text-[11px] font-normal"
                                    >
                                        <span class="truncate">
                                            Procurement {{ shortageLineProcurementRequest(line).requestNumber ?? 'request' }}
                                            &middot; {{ formatEnumLabel(shortageLineProcurementRequest(line).status ?? 'n/a') }}
                                        </span>
                                    </Badge>
                                </div>
                            </div>
                            <div v-if="!selectedRequisition.lines?.length" class="px-3 py-6 text-center text-sm text-muted-foreground">
                                No item lines recorded.
                            </div>
                        </div>
                    </div>

                    <Alert v-if="selectedRequisitionIssueBlockingProblems.length > 0" variant="destructive">
                        <AlertTitle>Issue cannot be confirmed yet</AlertTitle>
                        <AlertDescription>
                            <ul class="mt-1 list-disc space-y-1 pl-4">
                                <li v-for="problem in selectedRequisitionIssueBlockingProblems" :key="problem">
                                    {{ problem }}
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <Alert
                        v-else-if="selectedRequisitionHasAnyAdditionalIssue && selectedRequisitionIssueShortageSummaries.length > 0"
                        class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
                    >
                        <AlertTitle>Partial issue will be recorded</AlertTitle>
                        <AlertDescription>
                            <p>Available stock will be issued now. The remaining quantities stay visible for procurement or later fulfillment.</p>
                            <ul class="mt-2 list-disc space-y-1 pl-4">
                                <li v-for="summary in selectedRequisitionIssueShortageSummaries" :key="summary">
                                    {{ summary }}
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <Alert
                        v-else-if="selectedRequisitionIssueUnavailableReason"
                        class="border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100"
                    >
                        <AlertTitle>Waiting for stock replenishment</AlertTitle>
                        <AlertDescription>
                            <p>{{ selectedRequisitionIssueUnavailableReason }} Keep this requisition partially issued until procurement or stock transfer replenishes the shortage.</p>
                            <ul v-if="selectedRequisitionIssueShortageSummaries.length > 0" class="mt-2 list-disc space-y-1 pl-4">
                                <li v-for="summary in selectedRequisitionIssueShortageSummaries" :key="summary">
                                    {{ summary }}
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <div v-if="selectedRequisition.notes || selectedRequisition.rejectionReason" class="grid gap-3">
                        <div v-if="selectedRequisition.notes" class="rounded-lg border bg-background p-3">
                            <p class="text-sm font-semibold">Notes</p>
                            <p class="mt-1 text-sm text-muted-foreground">{{ selectedRequisition.notes }}</p>
                        </div>
                        <div v-if="selectedRequisition.rejectionReason" class="rounded-lg border bg-background p-3">
                            <p class="text-sm font-semibold">Rejection reason</p>
                            <p class="mt-1 text-sm text-muted-foreground">{{ selectedRequisition.rejectionReason }}</p>
                        </div>
                    </div>
                </div>
            </ScrollArea>

            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="requisitionDetailsOpen = false">Close</Button>
                <Button
                    v-if="selectedRequisition?.status === 'draft'"
                    variant="outline"
                    :disabled="requisitionStatusSubmitting"
                    @click="updateRequisitionStatus(selectedRequisition.id, 'submitted')"
                >
                    {{ requisitionStatusSubmitting ? 'Saving...' : 'Submit' }}
                </Button>
                <Button
                    v-if="selectedRequisition?.status === 'submitted' && canManageItems"
                    variant="destructive"
                    :disabled="requisitionStatusSubmitting"
                    @click="updateRequisitionStatus(selectedRequisition.id, 'rejected', { rejectionReason: 'Rejected by store manager' })"
                >
                    Reject
                </Button>
                <Button
                    v-if="selectedRequisition?.status === 'submitted' && canManageItems"
                    :disabled="requisitionStatusSubmitting"
                    @click="updateRequisitionStatus(selectedRequisition.id, 'approved')"
                >
                    {{ requisitionStatusSubmitting ? 'Saving...' : 'Approve' }}
                </Button>
                <Button
                    v-if="['approved', 'partially_issued'].includes(selectedRequisition?.status) && canManageItems"
                    :disabled="requisitionStatusSubmitting"
                    :variant="selectedRequisitionIssueBlockedReason || selectedRequisitionIssueUnavailableReason ? 'outline' : 'default'"
                    :title="selectedRequisitionIssueBlockedReason || selectedRequisitionIssueUnavailableReason || ''"
                    @click="confirmSelectedRequisitionIssue"
                >
                    <template v-if="requisitionStatusSubmitting">Saving...</template>
                    <template v-else>{{ selectedRequisitionIssueTargetStatus === 'partially_issued' ? 'Confirm Partial Issue' : 'Confirm Issue' }}</template>
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <!-- Create Inventory Item Dialog -->
    <Sheet :open="createItemDialogOpen" @update:open="createItemDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                    Create Inventory Item
                </SheetTitle>
                <SheetDescription>Register an item in the catalog with stock policy baseline.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <div
                    v-if="hasCreateItemDraftContent"
                    class="flex flex-col gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                >
                    <div class="min-w-0">
                        <p class="font-medium">{{ restoredCreateItemDraft ? 'Restored saved draft' : 'Draft autosaved' }}</p>
                        <p class="text-muted-foreground">This item draft stays on this device until you create it or start fresh.</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" class="h-7 self-start px-2 sm:self-center" @click="discardCreateItemDraft">
                        Start fresh
                    </Button>
                </div>
                <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Start with category</legend>
                    <FormFieldShell
                        input-id="inv-item-category"
                        label="Category"
                        :error-message="fieldError(itemCreateErrors, 'category')"
                    >
                        <Select :model-value="itemCreateForm.category || undefined" @update:model-value="itemCreateForm.category = String($event ?? '')">
                            <SelectTrigger class="w-full" :disabled="itemCreateSubmitting">
                                <SelectValue placeholder="Select category first" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="cat in itemCategoryOptions" :key="cat.value" :value="cat.value">{{ cat.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                    <SearchableSelectField
                        input-id="inv-item-subcategory"
                        label="Subcategory"
                        v-model="itemCreateForm.subcategory"
                        :options="createSubcategoryOptions"
                        placeholder="Select subcategory"
                        search-placeholder="Search category subcategories"
                        empty-text="No matching subcategory. Type a custom value."
                        :disabled="itemCreateSubmitting || !itemCreateForm.category"
                        :allow-custom-value="true"
                        :error-message="fieldError(itemCreateErrors, 'subcategory')"
                    />
                    <p v-if="!selectedCreateCategory" class="text-xs text-muted-foreground sm:col-span-2">
                        Select a category to reveal only the fields that belong to that physical inventory type.
                    </p>
                </fieldset>
                <!-- Basic Information -->
                <fieldset v-if="selectedCreateCategory" class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Basic Information</legend>
                    <div v-if="selectedCreateCategory && createClinicalCatalogOptions.length > 0" class="sm:col-span-2">
                        <SearchableSelectField
                            input-id="inv-item-clinical-catalog"
                            :label="selectedCreateCategory?.supportsMedicineDetails ? 'Clinical medicine' : 'Clinical catalog item'"
                            :model-value="itemCreateForm.clinicalCatalogItemId"
                            :options="createClinicalCatalogOptions"
                            :placeholder="selectedCreateCategory?.supportsMedicineDetails ? 'Select approved medicine' : 'Select linked clinical definition'"
                            search-placeholder="Search Clinical Care Catalogs"
                            empty-text="Create or activate this definition in Clinical Care Catalogs first."
                            :disabled="itemCreateSubmitting"
                            :required="selectedCreateCategory?.supportsMedicineDetails"
                            :error-message="fieldError(itemCreateErrors, 'clinicalCatalogItemId')"
                            @update:model-value="selectClinicalCatalogItem(itemCreateForm, String($event ?? ''))"
                        />
                    </div>
                    <Alert v-else-if="createClinicalCatalogSelectionRequired" class="sm:col-span-2">
                        <AlertTitle>Clinical medicine is required first</AlertTitle>
                        <AlertDescription class="flex flex-wrap items-center gap-2">
                            <span>
                                No active approved medicines are available in the current scope, so this pharmaceutical item cannot be saved yet.
                            </span>
                            <Link href="/platform/admin/clinical-catalogs" class="font-medium text-primary underline underline-offset-4">
                                Open Clinical Care Catalogs
                            </Link>
                        </AlertDescription>
                    </Alert>
                    <p v-if="selectedCreateCategory?.supportsMedicineDetails && createClinicalCatalogOptions.length > 0" class="sm:col-span-2 text-xs text-muted-foreground">
                        Select the approved medicine first. Code, name, strength, dosage form, dispensing unit, and standards codes load from the catalog.
                    </p>
                    <div class="grid gap-2">
                        <Label for="inv-item-code">Item Code</Label>
                        <Input id="inv-item-code" v-model="itemCreateForm.itemCode" :disabled="itemCreateSubmitting" />
                        <p v-if="fieldError(itemCreateErrors, 'itemCode')" class="text-xs text-destructive">{{ fieldError(itemCreateErrors, 'itemCode') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-item-name">Item Name</Label>
                        <Input id="inv-item-name" v-model="itemCreateForm.itemName" :disabled="itemCreateSubmitting" />
                        <p v-if="fieldError(itemCreateErrors, 'itemName')" class="text-xs text-destructive">{{ fieldError(itemCreateErrors, 'itemName') }}</p>
                    </div>
                    <FormFieldShell
                        input-id="inv-item-manufacturer"
                        label="Manufacturer"
                    >
                        <Input id="inv-item-manufacturer" v-model="itemCreateForm.manufacturer" :disabled="itemCreateSubmitting" />
                    </FormFieldShell>
                    <FormFieldShell
                        input-id="inv-item-barcode"
                        label="Barcode"
                    >
                        <Input id="inv-item-barcode" v-model="itemCreateForm.barcode" :disabled="itemCreateSubmitting" />
                    </FormFieldShell>
                    <Alert v-if="selectedCreateCategory" class="sm:col-span-2">
                        <AlertTitle class="flex flex-wrap items-center gap-2">
                            <span>{{ selectedCreateCategory.label }} workflow</span>
                            <Badge v-for="badge in createCategoryWorkflowBadges" :key="badge" variant="secondary">{{ badge }}</Badge>
                        </AlertTitle>
                        <AlertDescription>{{ selectedCreateCategory.description }}</AlertDescription>
                    </Alert>
                </fieldset>

                <fieldset v-if="selectedCreateCategory?.supportsMedicineDetails" class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Medicine Profile</legend>
                    <div class="grid gap-2">
                        <Label for="inv-item-generic-name">Generic Name</Label>
                        <Input id="inv-item-generic-name" v-model="itemCreateForm.genericName" :disabled="itemCreateSubmitting" placeholder="e.g. Paracetamol" />
                    </div>
                    <ComboboxField
                        input-id="inv-item-dosage-form"
                        label="Dosage Form"
                        v-model="itemCreateForm.dosageForm"
                        :options="DOSAGE_FORM_OPTIONS"
                        placeholder="Select dosage form"
                        search-placeholder="Search tablet, capsule, syrup, injection..."
                        empty-text="No dosage form found."
                        :disabled="itemCreateSubmitting"
                        :error-message="fieldError(itemCreateErrors, 'dosageForm')"
                        :reserve-message-space="false"
                    />
                    <div class="grid gap-2">
                        <Label for="inv-item-strength">Strength</Label>
                        <Input id="inv-item-strength" v-model="itemCreateForm.strength" :disabled="itemCreateSubmitting" placeholder="e.g. 500mg, 250mg/5ml" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-item-dispensing-unit">Dispensing Unit</Label>
                        <Input id="inv-item-dispensing-unit" v-model="itemCreateForm.dispensingUnit" :disabled="itemCreateSubmitting" placeholder="e.g. Tablet, ml" />
                    </div>
                    <div class="grid gap-2 sm:col-span-2">
                        <Label for="inv-item-conversion-factor">Conversion Factor</Label>
                        <Input id="inv-item-conversion-factor" v-model="itemCreateForm.conversionFactor" :disabled="itemCreateSubmitting" type="number" min="0" step="0.001" placeholder="Stock to dispensing conversion" />
                    </div>
                </fieldset>

                <fieldset v-if="selectedCreateCategory?.supportsStorageFields || selectedCreateCategory?.controlledSubstanceEligible" class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Handling &amp; Compliance</legend>
                    <div v-if="selectedCreateCategory?.supportsStorageFields" class="grid gap-2 sm:col-span-2">
                        <Label for="inv-item-storage">Storage Conditions</Label>
                        <Select :model-value="toSelectValue(itemCreateForm.storageConditions)" @update:model-value="itemCreateForm.storageConditions = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                            <SelectTrigger class="w-full" :disabled="itemCreateSubmitting">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem :value="EMPTY_SELECT_VALUE">— Select —</SelectItem>
                            <SelectItem v-for="s in storageConditionOptions" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="fieldError(itemCreateErrors, 'storageConditions')" class="text-xs text-destructive">{{ fieldError(itemCreateErrors, 'storageConditions') }}</p>
                    </div>
                    <div v-if="selectedCreateCategory?.supportsStorageFields" class="grid gap-2">
                        <Label>Temperature Handling</Label>
                        <label class="flex items-center gap-2 text-sm pt-2">
                            <input type="checkbox" v-model="itemCreateForm.requiresColdChain" :disabled="itemCreateSubmitting || Boolean(selectedCreateCategory?.requiresColdChain)" class="accent-primary" />
                            {{ selectedCreateCategory?.requiresColdChain ? 'Cold chain required for this category' : 'Requires cold chain' }}
                        </label>
                        <p v-if="fieldError(itemCreateErrors, 'requiresColdChain')" class="text-xs text-destructive">{{ fieldError(itemCreateErrors, 'requiresColdChain') }}</p>
                    </div>
                    <div v-if="selectedCreateCategory?.controlledSubstanceEligible" class="grid gap-2">
                        <Label>Controlled Substance</Label>
                        <label class="flex items-center gap-2 text-sm pt-2">
                            <input type="checkbox" v-model="itemCreateForm.isControlledSubstance" :disabled="itemCreateSubmitting" class="accent-primary" />
                            Controlled substance stock
                        </label>
                        <p v-if="fieldError(itemCreateErrors, 'isControlledSubstance')" class="text-xs text-destructive">{{ fieldError(itemCreateErrors, 'isControlledSubstance') }}</p>
                    </div>
                    <div v-if="itemCreateForm.isControlledSubstance" class="grid gap-2">
                        <Label for="inv-item-schedule">Schedule</Label>
                        <Select :model-value="toSelectValue(itemCreateForm.controlledSubstanceSchedule)" @update:model-value="itemCreateForm.controlledSubstanceSchedule = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                            <SelectTrigger class="w-full" :disabled="itemCreateSubmitting">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem :value="EMPTY_SELECT_VALUE">— Select —</SelectItem>
                            <SelectItem v-for="schedule in controlledSubstanceScheduleOptions" :key="schedule.value" :value="schedule.value">{{ schedule.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="fieldError(itemCreateErrors, 'controlledSubstanceSchedule')" class="text-xs text-destructive">{{ fieldError(itemCreateErrors, 'controlledSubstanceSchedule') }}</p>
                    </div>
                    <Alert v-if="selectedCreateCategory?.requiresExpiryTracking" class="sm:col-span-2">
                        <AlertTitle>Batch onboarding follows item creation</AlertTitle>
                        <AlertDescription>Save the item first, then record batch or lot, expiry date, supplier, and warehouse on the first receipt.</AlertDescription>
                    </Alert>
                </fieldset>

                <fieldset v-if="selectedCreateCategory" class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Classification &amp; Codes</legend>
                    <div v-if="!selectedCreateCategory || selectedCreateCategory.supportsClinicalClassification" class="grid gap-2">
                        <Label for="inv-item-ven">VEN Classification</Label>
                        <Select :model-value="itemCreateForm.venClassification || undefined" @update:model-value="itemCreateForm.venClassification = String($event ?? '')">
                            <SelectTrigger class="w-full" :disabled="itemCreateSubmitting">
                                <SelectValue placeholder="Select VEN classification" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem v-for="v in venClassificationOptions" :key="v.value" :value="v.value">{{ v.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div v-if="!selectedCreateCategory || selectedCreateCategory.supportsClinicalClassification" class="grid gap-2">
                        <Label for="inv-item-abc">ABC Classification</Label>
                        <Select :model-value="itemCreateForm.abcClassification || undefined" @update:model-value="itemCreateForm.abcClassification = String($event ?? '')">
                            <SelectTrigger class="w-full" :disabled="itemCreateSubmitting">
                                <SelectValue placeholder="Select ABC classification" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem v-for="a in abcClassificationOptions" :key="a.value" :value="a.value">{{ a.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-item-msd">MSD Code</Label>
                        <Input id="inv-item-msd" v-model="itemCreateForm.msdCode" :disabled="itemCreateSubmitting" placeholder="Medical Stores Department code" />
                    </div>
                    <div v-if="!selectedCreateCategory || selectedCreateCategory.supportsClinicalClassification" class="grid gap-2">
                        <Label for="inv-item-nhif">NHIF Code</Label>
                        <Input id="inv-item-nhif" v-model="itemCreateForm.nhifCode" :disabled="itemCreateSubmitting" />
                    </div>
                    <p v-if="selectedCreateCategory && !selectedCreateCategory.supportsClinicalClassification" class="sm:col-span-2 text-xs text-muted-foreground">
                        This category uses operational coding only. Clinical classification and NHIF mapping stay hidden.
                    </p>
                </fieldset>

                <fieldset v-if="selectedCreateCategory" class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Stock Policy &amp; Defaults</legend>
                    <div class="grid gap-2">
                        <Label for="inv-item-unit">Stock Unit</Label>
                        <Input id="inv-item-unit" v-model="itemCreateForm.unit" :disabled="itemCreateSubmitting" placeholder="e.g. Box, Bottle, Piece" />
                        <p v-if="fieldError(itemCreateErrors, 'unit')" class="text-xs text-destructive">{{ fieldError(itemCreateErrors, 'unit') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-item-bin-location">Bin Location</Label>
                        <Input id="inv-item-bin-location" v-model="itemCreateForm.binLocation" :disabled="itemCreateSubmitting" placeholder="e.g. A-03-12" />
                    </div>
                    <div class="grid gap-2">
                        <Label>Default Warehouse</Label>
                        <Popover :open="createItemWarehouseOpen" @update:open="createItemWarehouseOpen = $event">
                            <PopoverTrigger as-child>
                                <Button
                                    type="button"
                                    variant="outline"
                                    :disabled="itemCreateSubmitting"
                                    class="w-full justify-between font-normal"
                                >
                                    <span :class="itemCreateForm.defaultWarehouseId ? '' : 'text-muted-foreground'">
                                        {{ itemCreateForm.defaultWarehouseId ? (warehouses.find(w => w.id === itemCreateForm.defaultWarehouseId)?.name ?? itemCreateForm.defaultWarehouseId) : '— Select warehouse —' }}
                                    </span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground shrink-0 opacity-50"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent class="w-80 p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search warehouse..." />
                                    <CommandList>
                                        <CommandEmpty>No warehouse found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                value="__none__"
                                                @select="() => { itemCreateForm.defaultWarehouseId = ''; createItemWarehouseOpen = false }"
                                            >
                                                <span class="text-muted-foreground">— None —</span>
                                            </CommandItem>
                                            <CommandItem
                                                v-for="warehouse in warehouses"
                                                :key="warehouse.id"
                                                :value="warehouse.id"
                                                @select="() => { itemCreateForm.defaultWarehouseId = warehouse.id; createItemWarehouseOpen = false }"
                                            >
                                                <AppIcon v-if="itemCreateForm.defaultWarehouseId === warehouse.id" name="circle-check-big" class="mr-2 mt-0.5 size-4 shrink-0 text-primary" />
                                                <span v-else class="mr-2 size-4 shrink-0" />
                                                <span class="flex min-w-0 flex-1 flex-col">
                                                    <span class="truncate">{{ warehouse.name }}</span>
                                                    <span v-if="warehouse.code" class="text-xs text-muted-foreground">{{ warehouse.code }}</span>
                                                </span>
                                            </CommandItem>
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <p v-if="fieldError(itemCreateErrors, 'defaultWarehouseId')" class="text-xs text-destructive">{{ fieldError(itemCreateErrors, 'defaultWarehouseId') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label>Default Supplier</Label>
                        <Popover :open="createItemSupplierOpen" @update:open="createItemSupplierOpen = $event">
                            <PopoverTrigger as-child>
                                <Button
                                    type="button"
                                    variant="outline"
                                    :disabled="itemCreateSubmitting"
                                    class="w-full justify-between font-normal"
                                >
                                    <span :class="itemCreateForm.defaultSupplierId ? '' : 'text-muted-foreground'">
                                        {{ itemCreateForm.defaultSupplierId ? (suppliers.find(s => s.id === itemCreateForm.defaultSupplierId)?.name ?? itemCreateForm.defaultSupplierId) : '— Select supplier —' }}
                                    </span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground shrink-0 opacity-50"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent class="w-80 p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search supplier..." />
                                    <CommandList>
                                        <CommandEmpty>No supplier found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                value="__none__"
                                                @select="() => { itemCreateForm.defaultSupplierId = ''; createItemSupplierOpen = false }"
                                            >
                                                <span class="text-muted-foreground">— None —</span>
                                            </CommandItem>
                                            <CommandItem
                                                v-for="supplier in suppliers"
                                                :key="supplier.id"
                                                :value="supplier.id"
                                                @select="() => { itemCreateForm.defaultSupplierId = supplier.id; createItemSupplierOpen = false }"
                                            >
                                                <AppIcon v-if="itemCreateForm.defaultSupplierId === supplier.id" name="circle-check-big" class="mr-2 mt-0.5 size-4 shrink-0 text-primary" />
                                                <span v-else class="mr-2 size-4 shrink-0" />
                                                <span class="flex min-w-0 flex-1 flex-col">
                                                    <span class="truncate">{{ supplier.name }}</span>
                                                    <span v-if="supplier.code" class="text-xs text-muted-foreground">{{ supplier.code }}</span>
                                                </span>
                                            </CommandItem>
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <p v-if="fieldError(itemCreateErrors, 'defaultSupplierId')" class="text-xs text-destructive">{{ fieldError(itemCreateErrors, 'defaultSupplierId') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-item-reorder-level">Reorder Level</Label>
                        <Input id="inv-item-reorder-level" v-model="itemCreateForm.reorderLevel" :disabled="itemCreateSubmitting" type="number" min="0" step="0.001" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-item-max-stock-level">Max Stock Level</Label>
                        <Input id="inv-item-max-stock-level" v-model="itemCreateForm.maxStockLevel" :disabled="itemCreateSubmitting" type="number" min="0" step="0.001" />
                    </div>
                </fieldset>
            </div>
            </ScrollArea>
            <Alert v-if="itemCreateRequestError || itemCreateValidationMessages.length" variant="destructive" class="mx-4 mb-3 shrink-0">
                <AlertTitle>Create item needs attention</AlertTitle>
                <AlertDescription class="space-y-2">
                    <p v-if="itemCreateRequestError">{{ itemCreateRequestError }}</p>
                    <ul v-if="itemCreateValidationMessages.length" class="space-y-1 pl-4 list-disc">
                        <li v-for="message in itemCreateValidationMessages" :key="message" class="text-xs leading-5">
                            {{ message }}
                        </li>
                    </ul>
                </AlertDescription>
            </Alert>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <p v-if="itemCreateSubmitReason && !itemCreateRequestError && itemCreateValidationMessages.length === 0" class="mr-auto text-xs text-muted-foreground">
                    {{ itemCreateSubmitReason }}
                </p>
                <Button type="button" variant="outline" @click="createItemDialogOpen = false">Cancel</Button>
                <Button type="button" :disabled="itemCreateSubmitDisabled" class="gap-1.5" @click="submitCreateItem">
                    <AppIcon name="plus" class="size-3.5" />
                    {{ itemCreateSubmitting ? 'Creating...' : 'Create Item' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <!-- Record Stock Movement Dialog -->
    <Sheet :open="stockMovementDialogOpen" @update:open="stockMovementDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="arrow-up-down" class="size-5 text-muted-foreground" />
                    {{ stockMovementSheetTitle }}
                </SheetTitle>
                <SheetDescription>{{ stockMovementSheetDescription }}</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
                <div class="px-6 py-5 grid gap-6">

                    <!-- Item selection -->
                    <div class="grid gap-4 rounded-lg border p-3">
                        <div class="grid gap-1">
                            <p class="text-sm font-medium">{{ stockMovementOpeningBalanceMode ? 'Opening stock target' : 'Start with category and subcategory' }}</p>
                            <p class="text-xs text-muted-foreground">
                                {{ stockMovementOpeningBalanceMode ? 'This item has no stock ledger yet, so this entry will initialize its day-0 on-hand balance.' : 'Scope the stock record first, then search only within that slice of inventory.' }}
                            </p>
                        </div>
                        <div class="grid gap-3 sm:grid-cols-2">
                            <FormFieldShell
                                input-id="inv-movement-category"
                                label="Category"
                                :error-message="fieldError(stockMovementErrors, 'category')"
                            >
                                <Select :model-value="toSelectValue(stockMovementForm.category)" @update:model-value="stockMovementForm.category = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                    <SelectTrigger class="w-full" :disabled="stockMovementSubmitting">
                                        <SelectValue placeholder="Select category first" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem :value="EMPTY_SELECT_VALUE">Select category first</SelectItem>
                                        <SelectItem v-for="cat in itemCategoryOptions" :key="cat.value" :value="cat.value">{{ cat.label }}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormFieldShell>
                            <SearchableSelectField
                                input-id="inv-movement-subcategory"
                                label="Subcategory (optional)"
                                v-model="stockMovementForm.subcategory"
                                :options="stockMovementSubcategoryOptions"
                                placeholder="Narrow by subcategory"
                                search-placeholder="Search subcategories"
                                empty-text="No matching subcategory. Leave blank to search the whole category."
                                :disabled="stockMovementSubmitting || !stockMovementForm.category"
                                :allow-custom-value="true"
                            />
                        </div>
                        <div class="grid gap-2">
                            <InventoryItemLookupField
                                input-id="inv-movement-item-id"
                                v-model="stockMovementForm.itemId"
                                label="Item"
                                :placeholder="stockMovementLookupBlockedReason ? 'Select category first' : `Search ${stockMovementCategoryLabel}${stockMovementForm.subcategory ? ` / ${stockMovementSubcategoryLabel}` : ''}`"
                                :helper-text="stockMovementLookupHelperText"
                                :category="stockMovementForm.category || null"
                                :subcategory="stockMovementForm.subcategory || null"
                                :browse-on-focus="true"
                                :disabled="stockMovementSubmitting || Boolean(stockMovementLookupBlockedReason)"
                                :error-message="fieldError(stockMovementErrors, 'itemId')"
                                @selected="handleStockMovementItemSelected"
                            />
                        </div>

                        <Alert v-if="stockMovementLookupBlockedReason" class="border-dashed">
                            <AlertTitle>Choose the stock slice first</AlertTitle>
                            <AlertDescription>{{ stockMovementLookupBlockedReason }}</AlertDescription>
                        </Alert>

                        <!-- Selected item context + stock numbers -->
                        <div v-if="stockMovementItem" class="rounded-lg border bg-muted/20 p-4">
                            <div class="flex flex-wrap items-start justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <p class="font-semibold leading-tight">{{ stockMovementItem.itemName || stockMovementItem.itemCode }}</p>
                                    <p class="mt-0.5 text-xs text-muted-foreground">
                                        {{ stockMovementItem.itemCode }}
                                        <template v-if="stockMovementItem.category">&middot; {{ formatEnumLabel(stockMovementItem.category) }}</template>
                                        <template v-if="stockMovementItem.subcategory">&middot; {{ formatEnumLabel(stockMovementItem.subcategory) }}</template>
                                        <template v-if="stockMovementItem.unit">&middot; {{ stockMovementItem.unit }}</template>
                                        <template v-if="stockMovementItem.genericName">&middot; {{ stockMovementItem.genericName }}</template>
                                    </p>
                                </div>
                            <div class="flex shrink-0 gap-1.5">
                                    <Badge v-if="inventoryItemNeedsOpeningStock(stockMovementItem)" variant="outline">Needs opening stock</Badge>
                                    <Badge v-if="stockMovementItem.stockState" :class="stockAlertBadgeClass(stockMovementItem.stockState)">{{ stockStateLabel(stockMovementItem.stockState) }}</Badge>
                                    <Badge v-if="stockMovementItem.status" variant="secondary">{{ formatEnumLabel(stockMovementItem.status) }}</Badge>
                                </div>
                            </div>
                            <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div>
                                    <p class="text-[11px] text-muted-foreground">Store stock</p>
                                    <p class="text-xl font-bold tabular-nums">{{ formatAmount(stockMovementItem.currentStock ?? 0) }}</p>
                                </div>
                                <div>
                                    <p class="text-[11px] text-muted-foreground">Reorder at</p>
                                    <p class="text-xl font-bold tabular-nums text-muted-foreground">{{ formatAmount(stockMovementItem.reorderLevel ?? 0) }}</p>
                                </div>
                                <div>
                                    <p class="text-[11px] text-muted-foreground">Change</p>
                                    <p
                                        class="text-xl font-bold tabular-nums"
                                        :class="{
                                            'text-emerald-600 dark:text-emerald-400': stockMovementSignedDelta !== null && stockMovementSignedDelta > 0,
                                            'text-rose-600 dark:text-rose-400': stockMovementSignedDelta !== null && stockMovementSignedDelta < 0,
                                            'text-muted-foreground': stockMovementSignedDelta === null,
                                        }"
                                    >{{ stockMovementSignedDelta === null ? '—' : `${stockMovementSignedDelta > 0 ? '+' : ''}${formatAmount(stockMovementSignedDelta)}` }}</p>
                                </div>
                                <div>
                                    <p class="text-[11px] text-muted-foreground">Projected</p>
                                    <p
                                        class="text-xl font-bold tabular-nums"
                                        :class="stockMovementProjectedNegative ? 'text-rose-600 dark:text-rose-400' : ''"
                                    >{{ stockMovementProjectedStock === null ? '—' : formatAmount(stockMovementProjectedStock) }}</p>
                                    <Badge v-if="stockMovementProjectedState" :class="stockAlertBadgeClass(stockMovementProjectedState)" class="mt-1">{{ formatEnumLabel(stockMovementProjectedState) }}</Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <!-- Movement type -->
                    <Alert v-if="stockMovementOpeningBalanceMode" class="border-dashed">
                        <AlertTitle>Opening balance mode</AlertTitle>
                        <AlertDescription>
                            The system will post this as a stock receipt for setup only. It will not create a purchase, supplier expense, or department requisition.
                        </AlertDescription>
                    </Alert>

                    <div v-else class="grid gap-3">
                        <Label>Movement Type</Label>
                        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <button
                                v-for="opt in movementTypeOptions"
                                :key="`stock-movement-type-${opt}`"
                                type="button"
                                class="rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-colors"
                                :class="stockMovementForm.movementType === opt
                                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                    : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'"
                                @click="stockMovementForm.movementType = opt"
                            >
                                {{ stockMovementTypeMeta[opt].label }}
                            </button>
                        </div>
                        <div class="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                            <Badge variant="outline" class="shrink-0 mt-0.5">{{ selectedStockMovementTypeMeta.impact }}</Badge>
                            <p class="text-muted-foreground">{{ selectedStockMovementTypeMeta.description }}</p>
                        </div>
                        <p v-if="fieldError(stockMovementErrors, 'movementType')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'movementType') }}</p>
                    </div>

                    <template v-if="stockMovementItem">

                    <!-- Quantity, direction & timing -->
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="inv-movement-quantity">Quantity *</Label>
                            <div class="relative">
                                <Input id="inv-movement-quantity" v-model="stockMovementForm.quantity" :disabled="stockMovementSubmitting" type="number" min="0.001" step="0.001" class="pr-14" />
                                <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{{ stockMovementUnitLabel }}</span>
                            </div>
                            <p v-if="fieldError(stockMovementErrors, 'quantity')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'quantity') }}</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="inv-movement-occurred-at">Occurred At</Label>
                            <Input id="inv-movement-occurred-at" v-model="stockMovementForm.occurredAt" :disabled="stockMovementSubmitting" type="datetime-local" />
                            <p v-if="fieldError(stockMovementErrors, 'occurredAt')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'occurredAt') }}</p>
                        </div>
                        <div v-if="requiresAdjustmentDirection()" class="grid gap-2 sm:col-span-2">
                            <Label>Adjustment Direction</Label>
                            <div class="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    class="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                                    :class="stockMovementForm.adjustmentDirection === 'increase' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'border-border hover:bg-muted/50'"
                                    @click="stockMovementForm.adjustmentDirection = 'increase'"
                                >+ Increase stock</button>
                                <button
                                    type="button"
                                    class="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                                    :class="stockMovementForm.adjustmentDirection === 'decrease' ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'border-border hover:bg-muted/50'"
                                    @click="stockMovementForm.adjustmentDirection = 'decrease'"
                                >− Decrease stock</button>
                            </div>
                            <p v-if="fieldError(stockMovementErrors, 'adjustmentDirection')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'adjustmentDirection') }}</p>
                        </div>
                    </div>

                    <!-- Source & Destination — connected to real system entities -->
                    <!-- RECEIVE: Supplier → Warehouse -->
                    <div v-if="stockMovementForm.movementType === 'receive'" class="grid gap-4 sm:grid-cols-2">
                        <div v-if="!stockMovementOpeningBalanceMode" class="grid gap-2">
                            <Label for="inv-movement-source-supplier">Supplier (Source) <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Select :model-value="toSelectValue(stockMovementForm.sourceSupplierId)" @update:model-value="stockMovementForm.sourceSupplierId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                <SelectTrigger class="w-full" :disabled="stockMovementSubmitting">
                                    <SelectValue placeholder="— Select supplier —">
                                        {{ supplierLabel(stockMovementForm.sourceSupplierId) }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem :value="EMPTY_SELECT_VALUE">— Select supplier —</SelectItem>
                                <SelectItem v-for="s in suppliers" :key="s.id" :value="s.id" :text-value="lookupOptionText(s)">
                                    {{ s.name }}<template v-if="s.code"> ({{ s.code }})</template>
                                </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="fieldError(stockMovementErrors, 'sourceSupplierId')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'sourceSupplierId') }}</p>
                        </div>
                        <div class="grid gap-2" :class="stockMovementOpeningBalanceMode ? 'sm:col-span-2' : ''">
                            <Label for="inv-movement-dest-warehouse">{{ stockMovementOpeningBalanceMode ? 'Counted Into - Warehouse' : 'Stored In - Warehouse (Destination)' }} <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Select :model-value="toSelectValue(stockMovementForm.destinationWarehouseId)" @update:model-value="stockMovementForm.destinationWarehouseId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                <SelectTrigger class="w-full" :disabled="stockMovementSubmitting">
                                    <SelectValue placeholder="— Select warehouse —">
                                        {{ warehouseLabel(stockMovementForm.destinationWarehouseId) }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem :value="EMPTY_SELECT_VALUE">— Select warehouse —</SelectItem>
                                <SelectItem v-for="w in warehouses" :key="w.id" :value="w.id" :text-value="lookupOptionText(w)">
                                    {{ w.name }}<template v-if="w.code"> ({{ w.code }})</template>
                                </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="fieldError(stockMovementErrors, 'destinationWarehouseId')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'destinationWarehouseId') }}</p>
                        </div>
                    </div>

                    <!-- ISSUE: Warehouse → Department -->
                    <div v-else-if="stockMovementForm.movementType === 'issue'" class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="inv-movement-src-warehouse-issue">Issued From — Warehouse (Source) <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Select :model-value="toSelectValue(stockMovementForm.sourceWarehouseId)" @update:model-value="stockMovementForm.sourceWarehouseId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                <SelectTrigger class="w-full" :disabled="stockMovementSubmitting">
                                    <SelectValue placeholder="— Select warehouse —">
                                        {{ warehouseLabel(stockMovementForm.sourceWarehouseId) }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem :value="EMPTY_SELECT_VALUE">— Select warehouse —</SelectItem>
                                <SelectItem v-for="w in warehouses" :key="w.id" :value="w.id" :text-value="lookupOptionText(w)">
                                    {{ w.name }}<template v-if="w.code"> ({{ w.code }})</template>
                                </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="fieldError(stockMovementErrors, 'sourceWarehouseId')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'sourceWarehouseId') }}</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="inv-movement-dest-dept">Issued To — Department (Destination) <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Select :model-value="toSelectValue(stockMovementForm.destinationDepartmentId)" @update:model-value="stockMovementForm.destinationDepartmentId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                <SelectTrigger class="w-full" :disabled="stockMovementSubmitting">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem :value="EMPTY_SELECT_VALUE">— Select department —</SelectItem>
                                <SelectItem v-for="d in departments" :key="d.id" :value="d.id">
                                    {{ d.name }}<template v-if="d.code"> ({{ d.code }})</template>
                                </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="fieldError(stockMovementErrors, 'destinationDepartmentId')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'destinationDepartmentId') }}</p>
                        </div>
                    </div>

                    <!-- TRANSFER: Warehouse → Warehouse -->
                    <div v-else-if="stockMovementForm.movementType === 'transfer'" class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="inv-movement-src-warehouse-transfer">Transfer From — Warehouse (Source) <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Select :model-value="toSelectValue(stockMovementForm.sourceWarehouseId)" @update:model-value="stockMovementForm.sourceWarehouseId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                <SelectTrigger class="w-full" :disabled="stockMovementSubmitting">
                                    <SelectValue placeholder="— Select warehouse —">
                                        {{ warehouseLabel(stockMovementForm.sourceWarehouseId) }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem :value="EMPTY_SELECT_VALUE">— Select warehouse —</SelectItem>
                                <SelectItem v-for="w in warehouses" :key="w.id" :value="w.id" :text-value="lookupOptionText(w)">
                                    {{ w.name }}<template v-if="w.code"> ({{ w.code }})</template>
                                </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="fieldError(stockMovementErrors, 'sourceWarehouseId')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'sourceWarehouseId') }}</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="inv-movement-dest-warehouse-transfer">Transfer To — Warehouse (Destination) <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Select :model-value="toSelectValue(stockMovementForm.destinationWarehouseId)" @update:model-value="stockMovementForm.destinationWarehouseId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                <SelectTrigger class="w-full" :disabled="stockMovementSubmitting">
                                    <SelectValue placeholder="— Select warehouse —">
                                        {{ warehouseLabel(stockMovementForm.destinationWarehouseId) }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem :value="EMPTY_SELECT_VALUE">— Select warehouse —</SelectItem>
                                <SelectItem v-for="w in warehouses" :key="w.id" :value="w.id" :text-value="lookupOptionText(w)">
                                    {{ w.name }}<template v-if="w.code"> ({{ w.code }})</template>
                                </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="fieldError(stockMovementErrors, 'destinationWarehouseId')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'destinationWarehouseId') }}</p>
                        </div>
                    </div>

                    <div v-if="stockMovementRequiresBatchSelection" class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2 sm:col-span-2">
                            <Label for="inv-movement-batch-id">Batch *</Label>
                            <Select :model-value="toSelectValue(stockMovementForm.batchId)" @update:model-value="stockMovementForm.batchId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                <SelectTrigger class="w-full" :disabled="stockMovementSubmitting || stockMovementBatchesLoading">
                                    <SelectValue placeholder="— Select batch —">
                                        {{ selectedStockMovementBatch ? batchOptionLabel(selectedStockMovementBatch) : '' }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="EMPTY_SELECT_VALUE">— Select batch —</SelectItem>
                                    <SelectItem
                                        v-for="batch in stockMovementFilteredBatches"
                                        :key="batch.id"
                                        :value="batch.id"
                                        :text-value="batch.batchNumber ?? batch.id"
                                    >
                                        {{ batchOptionLabel(batch) }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="stockMovementBatchesLoading" class="text-xs text-muted-foreground">Loading tracked batches...</p>
                            <p v-else-if="stockMovementFilteredBatches.length === 0" class="text-xs text-muted-foreground">No eligible batches were found for this item and warehouse.</p>
                            <p v-if="fieldError(stockMovementErrors, 'batchId')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'batchId') }}</p>
                        </div>
                    </div>

                    <div v-else-if="stockMovementRequiresBatchReceiptFields" class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="inv-movement-batch-number">Batch Number *</Label>
                            <Input id="inv-movement-batch-number" v-model="stockMovementForm.batchNumber" :disabled="stockMovementSubmitting" placeholder="Supplier batch number" />
                            <p v-if="fieldError(stockMovementErrors, 'batchNumber')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'batchNumber') }}</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="inv-movement-lot-number">Lot Number</Label>
                            <Input id="inv-movement-lot-number" v-model="stockMovementForm.lotNumber" :disabled="stockMovementSubmitting" placeholder="Optional lot number" />
                            <p v-if="fieldError(stockMovementErrors, 'lotNumber')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'lotNumber') }}</p>
                        </div>
                        <SingleDatePopoverField
                            input-id="inv-movement-manufacture-date"
                            label="Manufacture Date"
                            v-model="stockMovementForm.manufactureDate"
                            :disabled="stockMovementSubmitting"
                            :error-message="fieldError(stockMovementErrors, 'manufactureDate')"
                        />
                        <SingleDatePopoverField
                            input-id="inv-movement-expiry-date"
                            label="Expiry Date"
                            v-model="stockMovementForm.expiryDate"
                            :disabled="stockMovementSubmitting"
                            :error-message="fieldError(stockMovementErrors, 'expiryDate')"
                        />
                        <div class="grid gap-2 sm:col-span-2">
                            <Label for="inv-movement-bin-location">Bin Location</Label>
                            <Input id="inv-movement-bin-location" v-model="stockMovementForm.binLocation" :disabled="stockMovementSubmitting" placeholder="Shelf, rack, or fridge position" />
                            <p v-if="fieldError(stockMovementErrors, 'binLocation')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'binLocation') }}</p>
                        </div>
                    </div>

                    <!-- Reason & notes -->
                    <div class="grid gap-4">
                        <div class="grid gap-2">
                            <Label for="inv-movement-reason">
                                Reason
                                <span v-if="stockMovementReasonRequired" class="ml-1 text-xs text-destructive font-normal">* required</span>
                                <span v-else class="ml-1 text-xs text-muted-foreground font-normal">optional</span>
                            </Label>
                            <Input
                                id="inv-movement-reason"
                                v-model="stockMovementForm.reason"
                                :disabled="stockMovementSubmitting"
                                :placeholder="stockMovementReasonPlaceholder"
                            />
                            <p v-if="fieldError(stockMovementErrors, 'reason')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'reason') }}</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="inv-movement-notes">Notes <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Textarea id="inv-movement-notes" v-model="stockMovementForm.notes" :disabled="stockMovementSubmitting" rows="3" placeholder="Batch reference, delivery note number, or handover context." />
                            <p v-if="fieldError(stockMovementErrors, 'notes')" class="text-xs text-destructive">{{ fieldError(stockMovementErrors, 'notes') }}</p>
                        </div>
                    </div>

                    <!-- Alerts -->
                    <Alert v-if="stockMovementProjectedNegative" variant="destructive">
                        <AlertTitle>Would go negative</AlertTitle>
                        <AlertDescription>Reduce quantity or receive stock first.</AlertDescription>
                    </Alert>

                    <Alert v-else-if="stockMovementForm.movementType === 'transfer'" class="text-sm">
                        <AlertTitle>Transfer-out only</AlertTitle>
                        <AlertDescription>Decreases this store's stock. Use Warehouse Transfer for an approval trail.</AlertDescription>
                    </Alert>
                    </template>

                    <Alert v-else-if="!stockMovementLookupBlockedReason" class="border-dashed">
                        <AlertTitle>Select an inventory item to continue</AlertTitle>
                        <AlertDescription>
                            Quantity, source and destination routing, batch handling, and notes appear after you choose a category and item.
                        </AlertDescription>
                    </Alert>

                </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="stockMovementDialogOpen = false">Cancel</Button>
                <Button :disabled="stockMovementSubmitDisabled" class="gap-1.5" @click="submitStockMovement">
                    <AppIcon name="arrow-up-down" class="size-3.5" />
                    {{ stockMovementSubmitting ? 'Saving...' : stockMovementSubmitLabel }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <!-- Reconcile Stock Count Dialog -->
    <Sheet :open="reconcileDialogOpen" @update:open="reconcileDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="shield-check" class="size-5 text-muted-foreground" />
                    Reconcile Stock Count
                </SheetTitle>
                <SheetDescription>Record physical count variance and automatically post a balanced stock adjustment entry.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-3 sm:grid-cols-2">
                <div class="grid gap-2 sm:col-span-2">
                    <InventoryItemLookupField
                        input-id="inv-reconcile-item-id"
                        v-model="stockReconciliationForm.itemId"
                        label="Item"
                        placeholder="Search by name, code, or barcode"
                        :disabled="stockReconciliationSubmitting"
                        :error-message="fieldError(stockReconciliationErrors, 'itemId')"
                        @selected="handleStockReconciliationItemSelected"
                    />
                </div>
                <div v-if="stockReconciliationUsesBatchTracking" class="grid gap-2">
                    <Label for="inv-reconcile-batch-id">Batch *</Label>
                    <Select :model-value="toSelectValue(stockReconciliationForm.batchId)" @update:model-value="stockReconciliationForm.batchId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                        <SelectTrigger class="w-full" :disabled="stockReconciliationSubmitting || stockReconciliationBatchesLoading">
                            <SelectValue placeholder="— Select batch —">
                                {{ selectedStockReconciliationBatch ? batchOptionLabel(selectedStockReconciliationBatch) : '' }}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem :value="EMPTY_SELECT_VALUE">— Select batch —</SelectItem>
                            <SelectItem
                                v-for="batch in stockReconciliationBatchOptions"
                                :key="batch.id"
                                :value="batch.id"
                                :text-value="batch.batchNumber ?? batch.id"
                            >
                                {{ batchOptionLabel(batch) }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <p v-if="stockReconciliationBatchesLoading" class="text-xs text-muted-foreground">Loading tracked batches...</p>
                    <p v-else-if="stockReconciliationBatchOptions.length === 0" class="text-xs text-muted-foreground">No tracked batches are recorded for this item yet.</p>
                    <p v-if="fieldError(stockReconciliationErrors, 'batchId')" class="text-xs text-destructive">{{ fieldError(stockReconciliationErrors, 'batchId') }}</p>
                </div>
                <div class="grid gap-2">
                    <Label :for="stockReconciliationUsesBatchTracking ? 'inv-reconcile-counted-batch-stock' : 'inv-reconcile-counted-stock'">
                        {{ stockReconciliationUsesBatchTracking ? 'Counted Batch Quantity' : 'Counted Stock' }}
                    </Label>
                    <Input
                        v-if="stockReconciliationUsesBatchTracking"
                        id="inv-reconcile-counted-batch-stock"
                        v-model="stockReconciliationForm.countedBatchQuantity"
                        :disabled="stockReconciliationSubmitting"
                        type="number"
                        min="0"
                        step="0.001"
                    />
                    <Input
                        v-else
                        id="inv-reconcile-counted-stock"
                        v-model="stockReconciliationForm.countedStock"
                        :disabled="stockReconciliationSubmitting"
                        type="number"
                        min="0"
                        step="0.001"
                    />
                    <p v-if="fieldError(stockReconciliationErrors, stockReconciliationUsesBatchTracking ? 'countedBatchQuantity' : 'countedStock')" class="text-xs text-destructive">
                        {{ fieldError(stockReconciliationErrors, stockReconciliationUsesBatchTracking ? 'countedBatchQuantity' : 'countedStock') }}
                    </p>
                </div>
                <div class="grid gap-2">
                    <Label for="inv-reconcile-session-reference">Session Reference</Label>
                    <Input id="inv-reconcile-session-reference" v-model="stockReconciliationForm.sessionReference" :disabled="stockReconciliationSubmitting" placeholder="Cycle count batch or sheet no." />
                </div>
                <div class="grid gap-2">
                    <Label for="inv-reconcile-reason">Reason</Label>
                    <Input id="inv-reconcile-reason" v-model="stockReconciliationForm.reason" :disabled="stockReconciliationSubmitting" placeholder="Physical stock count variance" />
                    <p v-if="fieldError(stockReconciliationErrors, 'reason')" class="text-xs text-destructive">{{ fieldError(stockReconciliationErrors, 'reason') }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="inv-reconcile-occurred-at">Occurred At</Label>
                    <Input id="inv-reconcile-occurred-at" v-model="stockReconciliationForm.occurredAt" :disabled="stockReconciliationSubmitting" type="datetime-local" />
                </div>
                <div class="grid gap-2 sm:col-span-2">
                    <Label for="inv-reconcile-notes">Notes</Label>
                    <Textarea id="inv-reconcile-notes" v-model="stockReconciliationForm.notes" :disabled="stockReconciliationSubmitting" rows="3" />
                </div>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="reconcileDialogOpen = false">Cancel</Button>
                <Button :disabled="stockReconciliationSubmitDisabled" class="gap-1.5" @click="submitStockReconciliation">
                    <AppIcon name="shield-check" class="size-3.5" />
                    {{ stockReconciliationSubmitting ? 'Saving...' : 'Record Reconciliation' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <!-- Create Procurement Request Dialog -->
    <Sheet :open="createProcurementDialogOpen" @update:open="createProcurementDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="plus" class="size-5 text-muted-foreground" />
                    Create Procurement Request
                </SheetTitle>
                <SheetDescription>Request procurement for an existing or new inventory item.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-3 sm:grid-cols-2">
                <Alert v-if="procurementForm.sourceSummary" class="sm:col-span-2 border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <AppIcon name="activity" class="size-4" />
                    <AlertTitle>Raised from department shortage</AlertTitle>
                    <AlertDescription>
                        {{ procurementForm.sourceSummary }}. The linked item and source trace are carried into the procurement request.
                        <span v-if="fieldError(procurementErrors, 'sourceDepartmentRequisitionLineId')" class="mt-1 block font-medium text-destructive">
                            {{ fieldError(procurementErrors, 'sourceDepartmentRequisitionLineId') }}
                        </span>
                    </AlertDescription>
                </Alert>
                <div class="grid gap-2 sm:col-span-2">
                    <Label for="inv-proc-item-id">Existing Inventory Item</Label>
                    <Input id="inv-proc-item-id" v-model="procurementForm.itemId" :disabled="procurementSubmitting || procurementLockedToSource" placeholder="Use existing item UUID if known" />
                    <p v-if="procurementUsesExistingItem" class="text-xs text-muted-foreground">
                        Linked request: item name, category, and unit come from the inventory master and should not be retyped.
                    </p>
                </div>
                <div class="grid gap-2">
                    <Label for="inv-proc-item-name">Item Name</Label>
                    <Input id="inv-proc-item-name" v-model="procurementForm.itemName" :disabled="procurementSubmitting || procurementUsesExistingItem" />
                    <p v-if="fieldError(procurementErrors, 'itemName')" class="text-xs text-destructive">{{ fieldError(procurementErrors, 'itemName') }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="inv-proc-category">Category</Label>
                    <Input id="inv-proc-category" v-model="procurementForm.category" :disabled="procurementSubmitting || procurementUsesExistingItem" />
                </div>
                <div class="grid gap-2">
                    <Label for="inv-proc-unit">Unit</Label>
                    <Input id="inv-proc-unit" v-model="procurementForm.unit" :disabled="procurementSubmitting || procurementUsesExistingItem" />
                </div>
                <div class="grid gap-2">
                    <Label for="inv-proc-reorder-level">Reorder Level</Label>
                    <Input id="inv-proc-reorder-level" v-model="procurementForm.reorderLevel" :disabled="procurementSubmitting || procurementUsesExistingItem" type="number" min="0" step="0.001" />
                </div>
                <div class="grid gap-2">
                    <Label for="inv-proc-req-qty">Requested Quantity</Label>
                    <Input id="inv-proc-req-qty" v-model="procurementForm.requestedQuantity" :disabled="procurementSubmitting" type="number" min="0" step="0.001" />
                    <p v-if="fieldError(procurementErrors, 'requestedQuantity')" class="text-xs text-destructive">{{ fieldError(procurementErrors, 'requestedQuantity') }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="inv-proc-unit-cost">Unit Cost Estimate</Label>
                    <Input id="inv-proc-unit-cost" v-model="procurementForm.unitCostEstimate" :disabled="procurementSubmitting" type="number" min="0" step="0.01" />
                </div>
                <SingleDatePopoverField input-id="inv-proc-needed-by" label="Needed By" v-model="procurementForm.neededBy" :disabled="procurementSubmitting" />
                <div class="grid gap-2">
                    <Label for="inv-proc-supplier">Preferred Supplier</Label>
                    <Select :model-value="toSelectValue(procurementForm.supplierId)" @update:model-value="procurementForm.supplierId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                        <SelectTrigger class="w-full" :disabled="procurementSubmitting">
                            <SelectValue placeholder="— Not specified —">
                                {{ supplierLabel(procurementForm.supplierId) }}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem :value="EMPTY_SELECT_VALUE">— Not specified —</SelectItem>
                        <SelectItem v-for="s in suppliers" :key="s.id" :value="s.id" :text-value="lookupOptionText(s)">{{ s.name }}{{ s.code ? ` (${s.code})` : '' }}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="grid gap-2 sm:col-span-2">
                    <Label for="inv-proc-notes">Notes</Label>
                    <Textarea id="inv-proc-notes" v-model="procurementForm.notes" :disabled="procurementSubmitting" rows="3" />
                </div>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="createProcurementDialogOpen = false">Cancel</Button>
                <Button :disabled="procurementSubmitting" class="gap-1.5" @click="submitProcurementRequest">
                    <AppIcon name="plus" class="size-3.5" />
                    {{ procurementSubmitting ? 'Creating...' : 'Create Request' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <Sheet :open="itemDetailsOpen" @update:open="itemDetailsOpen = $event">
        <SheetContent side="right" variant="workspace" size="4xl" class="flex h-full min-h-0 flex-col">
            <SheetHeader class="shrink-0 border-b bg-background px-4 py-3 text-left pr-12">
                <SheetTitle>{{ itemDetails?.itemCode || 'Inventory item details' }}</SheetTitle>
                <SheetDescription>
                    {{ itemDetails?.itemName || 'Review identity, stock, maintenance, and audit activity for this inventory item.' }}
                </SheetDescription>
                <div v-if="itemDetails" class="mt-2 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" class="h-8 gap-1.5 rounded-lg text-xs" @click="openDepartmentStockForItem(itemDetails)">
                        <AppIcon name="building-2" class="size-3.5" />
                        Where issued?
                    </Button>
                </div>
            </SheetHeader>
            <div class="min-h-0 flex-1 overflow-hidden">
                <div v-if="itemDetailsLoading" class="space-y-2 p-4">
                    <p class="text-sm text-muted-foreground">Loading item details...</p>
                </div>
                <Alert v-else-if="itemDetailsError" variant="destructive" class="m-4">
                    <AlertTitle>Item load failed</AlertTitle>
                    <AlertDescription>{{ itemDetailsError }}</AlertDescription>
                </Alert>
                <Tabs v-else-if="itemDetails" v-model="itemDetailsTab" class="flex h-full min-h-0 flex-col">
                    <div class="shrink-0 border-b bg-muted/5 px-4 py-2.5">
                            <div class="space-y-4">
                            <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                <div
                                    v-for="card in itemDetailsSummaryCards"
                                    :key="card.key"
                                    class="min-w-0 rounded-lg border bg-background/70 px-3 py-1.5"
                                >
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{{ card.label }}</p>
                                    <div class="mt-0.5 space-y-0.5">
                                        <p class="min-w-0 truncate text-sm font-semibold leading-4" :title="card.value">{{ card.value }}</p>
                                        <p
                                            class="min-w-0 text-xs leading-4 text-muted-foreground line-clamp-1"
                                            :title="card.helper"
                                        >
                                            {{ card.helper }}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div class="pb-1">
                                <TabsList class="flex h-auto w-full flex-wrap justify-start gap-2 rounded-lg bg-transparent p-0">
                                    <TabsTrigger value="overview" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Details</TabsTrigger>
                                    <TabsTrigger value="maintenance" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Edit</TabsTrigger>
                                    <TabsTrigger v-if="canManageItems" value="status" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Status</TabsTrigger>
                                    <TabsTrigger value="stock" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Batches</TabsTrigger>
                                    <TabsTrigger v-if="canViewAudit" value="audit" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Audit</TabsTrigger>
                                </TabsList>
                            </div>
                        </div>
                    </div>

                    <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                        <div class="space-y-4 p-4">
                            <TabsContent value="overview" class="mt-0 min-w-0 space-y-4">
                                <Card class="min-w-0">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-base">Master Record</CardTitle>
                                        <CardDescription>Core item identity and how this stock definition is classified in the system.</CardDescription>
                                    </CardHeader>
                                    <CardContent class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Item code</p>
                                            <p class="break-words text-sm font-medium">{{ itemDetails.itemCode || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Item name</p>
                                            <p class="break-words text-sm font-medium">{{ itemDetails.itemName || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Category</p>
                                            <p class="text-sm font-medium">{{ itemDetails.category ? formatEnumLabel(itemDetails.category) : 'Unclassified' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Subcategory</p>
                                            <p class="text-sm font-medium">{{ itemDetails.subcategory ? formatEnumLabel(itemDetails.subcategory) : 'Not assigned' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Stock unit</p>
                                            <p class="text-sm font-medium">{{ itemDetails.unit || 'Not set' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Clinical link</p>
                                            <p class="break-words text-sm font-medium">
                                                {{ itemDetails.clinicalCatalogItemId ? clinicalCatalogLabel(itemDetails.clinicalCatalogItemId) : 'No clinical definition link' }}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card class="min-w-0">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-base">Handling &amp; Routing</CardTitle>
                                        <CardDescription>Storage, manufacturer, and operational routing details used by stores workflows.</CardDescription>
                                    </CardHeader>
                                    <CardContent class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Manufacturer</p>
                                            <p class="break-words text-sm font-medium">{{ itemDetails.manufacturer || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Bin location</p>
                                            <p class="break-words text-sm font-medium">{{ itemDetails.binLocation || 'Not assigned' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Storage conditions</p>
                                            <p class="text-sm font-medium">{{ itemDetails.storageConditions ? formatEnumLabel(itemDetails.storageConditions) : 'Not specified' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Cold chain</p>
                                            <p class="text-sm font-medium">{{ itemDetails.requiresColdChain ? 'Required' : 'Not required' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Controlled substance</p>
                                            <p class="text-sm font-medium">
                                                {{ itemDetails.isControlledSubstance ? (itemDetails.controlledSubstanceSchedule || 'Yes') : 'No' }}
                                            </p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Dispensing unit</p>
                                            <p class="text-sm font-medium">{{ itemDetails.dispensingUnit || 'Not recorded' }}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card class="min-w-0">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-base">Standards &amp; Lifecycle</CardTitle>
                                        <CardDescription>Coding, scanning, and lifecycle timestamps used for finance, supply chain, and governance.</CardDescription>
                                    </CardHeader>
                                    <CardContent class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">VEN</p>
                                            <p class="text-sm font-medium">{{ itemDetails.venClassification ? formatEnumLabel(itemDetails.venClassification) : 'Not set' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">ABC</p>
                                            <p class="text-sm font-medium">{{ itemDetails.abcClassification || 'Not set' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">MSD code</p>
                                            <p class="break-words text-sm font-medium">{{ itemDetails.msdCode || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">NHIF code</p>
                                            <p class="break-words text-sm font-medium">{{ itemDetails.nhifCode || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Barcode</p>
                                            <p class="break-words text-sm font-medium">{{ itemDetails.barcode || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Created</p>
                                            <p class="text-sm font-medium">{{ formatDateTime(itemDetails.createdAt) }}</p>
                                        </div>
                                        <div class="space-y-1 sm:col-span-2 lg:col-span-3">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Last updated</p>
                                            <p class="text-sm font-medium">{{ formatDateTime(itemDetails.updatedAt) }}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card v-if="itemDetails.genericName || itemDetails.dosageForm || itemDetails.strength || itemDetails.dispensingUnit || itemDetails.conversionFactor != null" class="min-w-0">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-base">Medicine Profile</CardTitle>
                                        <CardDescription>Only appears when the item carries medicine-specific formulary data.</CardDescription>
                                    </CardHeader>
                                    <CardContent class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Generic name</p>
                                            <p class="break-words text-sm font-medium">{{ itemDetails.genericName || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Dosage form</p>
                                            <p class="text-sm font-medium">{{ itemDetails.dosageForm || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Strength</p>
                                            <p class="text-sm font-medium">{{ itemDetails.strength || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Dispensing unit</p>
                                            <p class="text-sm font-medium">{{ itemDetails.dispensingUnit || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Conversion factor</p>
                                            <p class="text-sm font-medium">{{ itemDetails.conversionFactor ?? 'Not recorded' }}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="maintenance" class="mt-0 min-w-0 space-y-4">
                                <Alert v-if="!canManageItems">
                                    <AlertTitle>Maintenance access restricted</AlertTitle>
                                    <AlertDescription>You can review this item, but update and status controls require inventory management permission.</AlertDescription>
                                </Alert>

                                <template v-else>
                                    <Card class="min-w-0">
                                        <CardHeader class="pb-3">
                                            <CardTitle class="text-base">Update Record</CardTitle>
                                            <CardDescription>Adjust the master stock definition without leaving the workspace.</CardDescription>
                                        </CardHeader>
                                        <CardContent class="space-y-4">
                                            <Alert v-if="Object.keys(itemUpdateErrors).length > 0" variant="destructive">
                                                <AlertTitle>Item update needs review</AlertTitle>
                                                <AlertDescription>Review the highlighted fields and save again.</AlertDescription>
                                            </Alert>

                                            <div class="grid gap-4">
                                                <fieldset class="grid gap-2 rounded-lg border p-2 sm:grid-cols-2">
                                                    <legend class="px-2 text-xs font-medium text-muted-foreground">Basic Information</legend>
                                                    <FormFieldShell
                                                        input-id="inv-item-edit-category"
                                                        label="Category"
                                                        :error-message="fieldError(itemUpdateErrors, 'category')"
                                                    >
                                                        <Select :model-value="itemUpdateForm.category || undefined" @update:model-value="itemUpdateForm.category = String($event ?? '')">
                                                            <SelectTrigger class="w-full" :disabled="itemUpdateSubmitting">
                                                                <SelectValue placeholder="Select category" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem v-for="cat in itemCategoryOptions" :key="cat.value" :value="cat.value">{{ cat.label }}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormFieldShell>
                                                    <SearchableSelectField
                                                        input-id="inv-item-edit-subcategory"
                                                        label="Subcategory"
                                                        v-model="itemUpdateForm.subcategory"
                                                        :options="updateSubcategoryOptions"
                                                        placeholder="Select subcategory"
                                                        search-placeholder="Search category subcategories"
                                                        empty-text="No matching subcategory. Type a custom value."
                                                        :disabled="itemUpdateSubmitting || !itemUpdateForm.category"
                                                        :allow-custom-value="true"
                                                        :error-message="fieldError(itemUpdateErrors, 'subcategory')"
                                                    />
                                                    <div v-if="selectedUpdateCategory && updateClinicalCatalogOptions.length > 0" class="sm:col-span-2">
                                                        <SearchableSelectField
                                                            input-id="inv-item-edit-clinical-catalog"
                                                            :label="selectedUpdateCategory?.supportsMedicineDetails ? 'Clinical medicine' : 'Clinical catalog item'"
                                                            :model-value="itemUpdateForm.clinicalCatalogItemId"
                                                            :options="updateClinicalCatalogOptions"
                                                            :placeholder="selectedUpdateCategory?.supportsMedicineDetails ? 'Select approved medicine' : 'Select linked clinical definition'"
                                                            search-placeholder="Search Clinical Care Catalogs"
                                                            empty-text="Create or activate this definition in Clinical Care Catalogs first."
                                                            :disabled="itemUpdateSubmitting"
                                                            :required="selectedUpdateCategory?.supportsMedicineDetails"
                                                            :error-message="fieldError(itemUpdateErrors, 'clinicalCatalogItemId')"
                                                            @update:model-value="selectClinicalCatalogItem(itemUpdateForm, String($event ?? ''))"
                                                        />
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-code">Item Code</Label>
                                                        <Input id="inv-item-edit-code" v-model="itemUpdateForm.itemCode" :disabled="itemUpdateSubmitting" />
                                                        <p v-if="fieldError(itemUpdateErrors, 'itemCode')" class="text-xs text-destructive">{{ fieldError(itemUpdateErrors, 'itemCode') }}</p>
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-name">Item Name</Label>
                                                        <Input id="inv-item-edit-name" v-model="itemUpdateForm.itemName" :disabled="itemUpdateSubmitting" />
                                                        <p v-if="fieldError(itemUpdateErrors, 'itemName')" class="text-xs text-destructive">{{ fieldError(itemUpdateErrors, 'itemName') }}</p>
                                                    </div>
                                                    <FormFieldShell
                                                        input-id="inv-item-edit-manufacturer"
                                                        label="Manufacturer"
                                                    >
                                                        <Input id="inv-item-edit-manufacturer" v-model="itemUpdateForm.manufacturer" :disabled="itemUpdateSubmitting" />
                                                    </FormFieldShell>
                                                    <FormFieldShell
                                                        input-id="inv-item-edit-barcode"
                                                        label="Barcode"
                                                    >
                                                        <Input id="inv-item-edit-barcode" v-model="itemUpdateForm.barcode" :disabled="itemUpdateSubmitting" />
                                                    </FormFieldShell>
                                                    <Alert v-if="selectedUpdateCategory" class="sm:col-span-2">
                                                        <AlertTitle class="flex flex-wrap items-center gap-2">
                                                            <span>{{ selectedUpdateCategory.label }} workflow</span>
                                                            <Badge v-for="badge in updateCategoryWorkflowBadges" :key="badge" variant="secondary">{{ badge }}</Badge>
                                                        </AlertTitle>
                                                        <AlertDescription>{{ selectedUpdateCategory.description }}</AlertDescription>
                                                    </Alert>
                                                </fieldset>

                                                <fieldset v-if="selectedUpdateCategory?.supportsMedicineDetails" class="grid gap-2 rounded-lg border p-2 sm:grid-cols-2">
                                                    <legend class="px-2 text-xs font-medium text-muted-foreground">Medicine Profile</legend>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-generic">Generic Name</Label>
                                                        <Input id="inv-item-edit-generic" v-model="itemUpdateForm.genericName" :disabled="itemUpdateSubmitting" />
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-dosage">Dosage Form</Label>
                                                        <Input id="inv-item-edit-dosage" v-model="itemUpdateForm.dosageForm" :disabled="itemUpdateSubmitting" />
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-strength">Strength</Label>
                                                        <Input id="inv-item-edit-strength" v-model="itemUpdateForm.strength" :disabled="itemUpdateSubmitting" />
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-dispensing">Dispensing Unit</Label>
                                                        <Input id="inv-item-edit-dispensing" v-model="itemUpdateForm.dispensingUnit" :disabled="itemUpdateSubmitting" />
                                                    </div>
                                                    <div class="grid gap-1 sm:col-span-2">
                                                        <Label for="inv-item-edit-conversion">Conversion Factor</Label>
                                                        <Input id="inv-item-edit-conversion" v-model="itemUpdateForm.conversionFactor" :disabled="itemUpdateSubmitting" type="number" min="0" step="0.001" />
                                                    </div>
                                                </fieldset>

                                                <fieldset v-if="selectedUpdateCategory?.supportsStorageFields || selectedUpdateCategory?.controlledSubstanceEligible" class="grid gap-2 rounded-lg border p-2 sm:grid-cols-2">
                                                    <legend class="px-2 text-xs font-medium text-muted-foreground">Handling &amp; Compliance</legend>
                                                    <div v-if="selectedUpdateCategory?.supportsStorageFields" class="grid gap-1">
                                                        <Label for="inv-item-edit-storage">Storage Conditions</Label>
                                                        <Select :model-value="toSelectValue(itemUpdateForm.storageConditions)" @update:model-value="itemUpdateForm.storageConditions = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                                            <SelectTrigger :disabled="itemUpdateSubmitting">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem :value="EMPTY_SELECT_VALUE">- Select -</SelectItem>
                                                                <SelectItem v-for="s in storageConditionOptions" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <p v-if="fieldError(itemUpdateErrors, 'storageConditions')" class="text-xs text-destructive">{{ fieldError(itemUpdateErrors, 'storageConditions') }}</p>
                                                    </div>
                                                    <div v-if="selectedUpdateCategory?.supportsStorageFields" class="grid gap-1">
                                                        <Label>Temperature Handling</Label>
                                                        <label class="flex items-center gap-2 pt-2 text-sm">
                                                            <input type="checkbox" v-model="itemUpdateForm.requiresColdChain" :disabled="itemUpdateSubmitting || Boolean(selectedUpdateCategory?.requiresColdChain)" class="accent-primary" />
                                                            {{ selectedUpdateCategory?.requiresColdChain ? 'Cold chain required for this category' : 'Requires cold chain' }}
                                                        </label>
                                                        <p v-if="fieldError(itemUpdateErrors, 'requiresColdChain')" class="text-xs text-destructive">{{ fieldError(itemUpdateErrors, 'requiresColdChain') }}</p>
                                                    </div>
                                                    <div v-if="selectedUpdateCategory?.controlledSubstanceEligible" class="grid gap-1">
                                                        <Label>Controlled Substance</Label>
                                                        <label class="flex items-center gap-2 pt-2 text-sm">
                                                            <input type="checkbox" v-model="itemUpdateForm.isControlledSubstance" :disabled="itemUpdateSubmitting" class="accent-primary" />
                                                            Controlled substance stock
                                                        </label>
                                                        <p v-if="fieldError(itemUpdateErrors, 'isControlledSubstance')" class="text-xs text-destructive">{{ fieldError(itemUpdateErrors, 'isControlledSubstance') }}</p>
                                                    </div>
                                                    <div v-if="itemUpdateForm.isControlledSubstance" class="grid gap-1">
                                                        <Label for="inv-item-edit-schedule">Schedule</Label>
                                                        <Select :model-value="toSelectValue(itemUpdateForm.controlledSubstanceSchedule)" @update:model-value="itemUpdateForm.controlledSubstanceSchedule = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                                            <SelectTrigger :disabled="itemUpdateSubmitting">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem :value="EMPTY_SELECT_VALUE">- Select -</SelectItem>
                                                                <SelectItem v-for="schedule in controlledSubstanceScheduleOptions" :key="schedule.value" :value="schedule.value">{{ schedule.label }}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <p v-if="fieldError(itemUpdateErrors, 'controlledSubstanceSchedule')" class="text-xs text-destructive">{{ fieldError(itemUpdateErrors, 'controlledSubstanceSchedule') }}</p>
                                                    </div>
                                                    <Alert v-if="selectedUpdateCategory?.requiresExpiryTracking" class="sm:col-span-2">
                                                        <AlertTitle>Batch and expiry tracking stay mandatory</AlertTitle>
                                                        <AlertDescription>Make sure the receiving workflow continues to capture batch or lot, expiry date, supplier, and warehouse for this item.</AlertDescription>
                                                    </Alert>
                                                </fieldset>

                                                <fieldset class="grid gap-2 rounded-lg border p-2 sm:grid-cols-2">
                                                    <legend class="px-2 text-xs font-medium text-muted-foreground">Classification &amp; Codes</legend>
                                                    <div v-if="!selectedUpdateCategory || selectedUpdateCategory.supportsClinicalClassification" class="grid gap-1">
                                                        <Label for="inv-item-edit-ven">VEN</Label>
                                                        <Select :model-value="itemUpdateForm.venClassification || undefined" @update:model-value="itemUpdateForm.venClassification = String($event ?? '')">
                                                            <SelectTrigger class="w-full" :disabled="itemUpdateSubmitting">
                                                                <SelectValue placeholder="Select VEN classification" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem v-for="v in venClassificationOptions" :key="v.value" :value="v.value">{{ v.label }}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div v-if="!selectedUpdateCategory || selectedUpdateCategory.supportsClinicalClassification" class="grid gap-1">
                                                        <Label for="inv-item-edit-abc">ABC</Label>
                                                        <Select :model-value="itemUpdateForm.abcClassification || undefined" @update:model-value="itemUpdateForm.abcClassification = String($event ?? '')">
                                                            <SelectTrigger class="w-full" :disabled="itemUpdateSubmitting">
                                                                <SelectValue placeholder="Select ABC classification" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem v-for="a in abcClassificationOptions" :key="a.value" :value="a.value">{{ a.label }}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-msd">MSD Code</Label>
                                                        <Input id="inv-item-edit-msd" v-model="itemUpdateForm.msdCode" :disabled="itemUpdateSubmitting" />
                                                    </div>
                                                    <div v-if="!selectedUpdateCategory || selectedUpdateCategory.supportsClinicalClassification" class="grid gap-1">
                                                        <Label for="inv-item-edit-nhif">NHIF Code</Label>
                                                        <Input id="inv-item-edit-nhif" v-model="itemUpdateForm.nhifCode" :disabled="itemUpdateSubmitting" />
                                                    </div>
                                                    <p v-if="selectedUpdateCategory && !selectedUpdateCategory.supportsClinicalClassification" class="text-xs text-muted-foreground sm:col-span-2">
                                                        This category uses operational coding only. Clinical classification and NHIF mapping stay hidden.
                                                    </p>
                                                </fieldset>

                                                <fieldset class="grid gap-2 rounded-lg border p-2 sm:grid-cols-2">
                                                    <legend class="px-2 text-xs font-medium text-muted-foreground">Stock Policy &amp; Defaults</legend>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-unit">Stock Unit</Label>
                                                        <Input id="inv-item-edit-unit" v-model="itemUpdateForm.unit" :disabled="itemUpdateSubmitting" />
                                                        <p v-if="fieldError(itemUpdateErrors, 'unit')" class="text-xs text-destructive">{{ fieldError(itemUpdateErrors, 'unit') }}</p>
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-bin">Bin Location</Label>
                                                        <Input id="inv-item-edit-bin" v-model="itemUpdateForm.binLocation" :disabled="itemUpdateSubmitting" />
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label>Default Warehouse</Label>
                                                        <Popover :open="updateItemWarehouseOpen" @update:open="updateItemWarehouseOpen = $event">
                                                            <PopoverTrigger as-child>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    :disabled="itemUpdateSubmitting"
                                                                        class="min-w-0 w-full justify-between font-normal"
                                                                    >
                                                                        <span :class="['truncate', itemUpdateForm.defaultWarehouseId ? '' : 'text-muted-foreground']">
                                                                            {{ itemUpdateForm.defaultWarehouseId ? (warehouses.find(w => w.id === itemUpdateForm.defaultWarehouseId)?.name ?? itemUpdateForm.defaultWarehouseId) : '- Select warehouse -' }}
                                                                        </span>
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-muted-foreground opacity-50"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent class="w-80 p-0" align="start">
                                                                <Command>
                                                                    <CommandInput placeholder="Search warehouse..." />
                                                                    <CommandList>
                                                                        <CommandEmpty>No warehouse found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            <CommandItem
                                                                                value="__none__"
                                                                                @select="() => { itemUpdateForm.defaultWarehouseId = ''; updateItemWarehouseOpen = false }"
                                                                            >
                                                                                <span class="text-muted-foreground">- None -</span>
                                                                            </CommandItem>
                                                                            <CommandItem
                                                                                v-for="warehouse in warehouses"
                                                                                :key="warehouse.id"
                                                                                :value="warehouse.id"
                                                                                @select="() => { itemUpdateForm.defaultWarehouseId = warehouse.id; updateItemWarehouseOpen = false }"
                                                                            >
                                                                                <AppIcon v-if="itemUpdateForm.defaultWarehouseId === warehouse.id" name="circle-check-big" class="mr-2 mt-0.5 size-4 shrink-0 text-primary" />
                                                                                <span v-else class="mr-2 size-4 shrink-0" />
                                                                                <span class="flex min-w-0 flex-1 flex-col">
                                                                                    <span class="truncate">{{ warehouse.name }}</span>
                                                                                    <span v-if="warehouse.code" class="text-xs text-muted-foreground">{{ warehouse.code }}</span>
                                                                                </span>
                                                                            </CommandItem>
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                        <p v-if="fieldError(itemUpdateErrors, 'defaultWarehouseId')" class="text-xs text-destructive">{{ fieldError(itemUpdateErrors, 'defaultWarehouseId') }}</p>
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label>Default Supplier</Label>
                                                        <Popover :open="updateItemSupplierOpen" @update:open="updateItemSupplierOpen = $event">
                                                            <PopoverTrigger as-child>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    :disabled="itemUpdateSubmitting"
                                                                        class="min-w-0 w-full justify-between font-normal"
                                                                    >
                                                                        <span :class="['truncate', itemUpdateForm.defaultSupplierId ? '' : 'text-muted-foreground']">
                                                                            {{ itemUpdateForm.defaultSupplierId ? (suppliers.find(s => s.id === itemUpdateForm.defaultSupplierId)?.name ?? itemUpdateForm.defaultSupplierId) : '- Select supplier -' }}
                                                                        </span>
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-muted-foreground opacity-50"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent class="w-80 p-0" align="start">
                                                                <Command>
                                                                    <CommandInput placeholder="Search supplier..." />
                                                                    <CommandList>
                                                                        <CommandEmpty>No supplier found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            <CommandItem
                                                                                value="__none__"
                                                                                @select="() => { itemUpdateForm.defaultSupplierId = ''; updateItemSupplierOpen = false }"
                                                                            >
                                                                                <span class="text-muted-foreground">- None -</span>
                                                                            </CommandItem>
                                                                            <CommandItem
                                                                                v-for="supplier in suppliers"
                                                                                :key="supplier.id"
                                                                                :value="supplier.id"
                                                                                @select="() => { itemUpdateForm.defaultSupplierId = supplier.id; updateItemSupplierOpen = false }"
                                                                            >
                                                                                <AppIcon v-if="itemUpdateForm.defaultSupplierId === supplier.id" name="circle-check-big" class="mr-2 mt-0.5 size-4 shrink-0 text-primary" />
                                                                                <span v-else class="mr-2 size-4 shrink-0" />
                                                                                <span class="flex min-w-0 flex-1 flex-col">
                                                                                    <span class="truncate">{{ supplier.name }}</span>
                                                                                    <span v-if="supplier.code" class="text-xs text-muted-foreground">{{ supplier.code }}</span>
                                                                                </span>
                                                                            </CommandItem>
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                        <p v-if="fieldError(itemUpdateErrors, 'defaultSupplierId')" class="text-xs text-destructive">{{ fieldError(itemUpdateErrors, 'defaultSupplierId') }}</p>
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-reorder">Reorder Level</Label>
                                                        <Input id="inv-item-edit-reorder" v-model="itemUpdateForm.reorderLevel" :disabled="itemUpdateSubmitting" type="number" min="0" step="0.001" />
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-max-stock">Max Stock Level</Label>
                                                        <Input id="inv-item-edit-max-stock" v-model="itemUpdateForm.maxStockLevel" :disabled="itemUpdateSubmitting" type="number" min="0" step="0.001" />
                                                    </div>
                                                </fieldset>
                                            </div>

                                            <div class="flex justify-end">
                                                <Button size="sm" :disabled="itemUpdateSubmitting" @click="submitItemUpdate">
                                                    {{ itemUpdateSubmitting ? 'Saving...' : 'Save Item Changes' }}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>

                                </template>
                            </TabsContent>

                            <TabsContent v-if="canManageItems" value="status" class="mt-0 min-w-0 space-y-4">
                                <Card class="min-w-0">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-base">Status Control</CardTitle>
                                        <CardDescription>Control whether this item remains active for stores, receiving, and downstream workflows.</CardDescription>
                                    </CardHeader>
                                    <CardContent class="space-y-3">
                                        <div class="grid gap-3 sm:grid-cols-2">
                                            <div class="grid gap-1">
                                                <Label for="inv-item-status">Status</Label>
                                                <Select :model-value="toSelectValue(itemStatusForm.status)" @update:model-value="itemStatusForm.status = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                                    <SelectTrigger class="w-full" :disabled="itemStatusSubmitting">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem v-for="status in itemStatusOptions" :key="status" :value="status">
                                                            {{ formatEnumLabel(status) }}
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-1">
                                                <Label for="inv-item-status-reason">Reason</Label>
                                                <Input id="inv-item-status-reason" v-model="itemStatusForm.reason" :disabled="itemStatusSubmitting" placeholder="Required for inactive" />
                                            </div>
                                        </div>
                                        <Alert v-if="itemStatusError" variant="destructive">
                                            <AlertTitle>Status update failed</AlertTitle>
                                            <AlertDescription>{{ itemStatusError }}</AlertDescription>
                                        </Alert>
                                        <div class="flex justify-end">
                                            <Button size="sm" :disabled="itemStatusSubmitting" @click="submitItemStatus">
                                                {{ itemStatusSubmitting ? 'Saving...' : 'Update Status' }}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="stock" class="mt-0 min-w-0 space-y-4">
                                <Card class="min-w-0">
                                    <CardHeader class="pb-3">
                                        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <CardTitle class="text-base">Batch Ledger</CardTitle>
                                                <CardDescription>Review tracked batch lines without leaving the item workspace.</CardDescription>
                                            </div>
                                            <div class="flex flex-wrap items-center gap-2">
                                                <Badge variant="outline">{{ itemBatchesLoading ? 'Loading' : `${itemBatches.length} recorded` }}</Badge>
                                                <Button v-if="canManageItems" size="sm" variant="outline" class="gap-1" @click="createBatchDialogOpen = true; loadItemBatches(String(itemDetails.id))">
                                                    <AppIcon name="plus" class="size-3" />
                                                    Add Batch
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent class="space-y-3">
                                        <p v-if="!canManageItems" class="text-sm text-muted-foreground">Batch history is visible here, but adding or changing tracked stock requires inventory management access.</p>
                                        <div v-if="itemBatchesLoading" class="text-sm text-muted-foreground">Loading batches...</div>
                                        <div v-else-if="itemBatches.length === 0" class="rounded-lg border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
                                            No batches have been recorded for this item yet.
                                        </div>
                                        <div v-else class="space-y-2">
                                            <div
                                                v-for="batch in itemBatches"
                                                :key="batch.id"
                                                class="rounded-lg border bg-background/70 p-3"
                                            >
                                                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Batch #</p>
                                                        <p class="break-words font-mono text-sm">{{ batch.batchNumber }}</p>
                                                    </div>
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Lot #</p>
                                                        <p class="break-words text-sm">{{ batch.lotNumber ?? '-' }}</p>
                                                    </div>
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Quantity</p>
                                                        <p class="text-sm font-medium">{{ batch.quantity }}</p>
                                                    </div>
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Expiry</p>
                                                        <p class="text-sm">{{ batch.expiryDate ?? '-' }}</p>
                                                    </div>
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                                                        <div>
                                                            <span v-if="batch.expiryState" class="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium" :class="expiryBadgeClass(batch.expiryState)">
                                                                {{ batch.expiryState }}
                                                            </span>
                                                            <span v-else class="text-sm text-muted-foreground">{{ formatEnumLabel(batch.status) }}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent v-if="canViewAudit" value="audit" class="mt-0 min-w-0 space-y-4">
                                <Card class="min-w-0">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-base">Audit Trail</CardTitle>
                                        <CardDescription>Filter item changes by actor, time, and action without leaving the sheet.</CardDescription>
                                    </CardHeader>
                                    <CardContent class="space-y-3">
                                        <div class="grid gap-3 rounded-md border p-3 md:grid-cols-2">
                                            <div class="grid gap-1">
                                                <Label for="inv-item-audit-q">Action Text Search</Label>
                                                <Input id="inv-item-audit-q" v-model="itemAuditFilters.q" placeholder="item.updated, status.updated..." />
                                            </div>
                                            <div class="grid gap-1">
                                                <Label for="inv-item-audit-action">Action (exact)</Label>
                                                <Input id="inv-item-audit-action" v-model="itemAuditFilters.action" placeholder="Optional exact action key" />
                                            </div>
                                            <div class="grid gap-1">
                                                <Label for="inv-item-audit-actor-type">Actor Type</Label>
                                                <Select :model-value="toSelectValue(itemAuditFilters.actorType)" @update:model-value="itemAuditFilters.actorType = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem
                                                            v-for="option in auditActorTypeOptions"
                                                            :key="`inv-item-audit-actor-type-${option.value || 'all'}`"
                                                            :value="toSelectValue(option.value)"
                                                        >
                                                            {{ option.label }}
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-1">
                                                <Label for="inv-item-audit-actor-id">Actor ID</Label>
                                                <Input id="inv-item-audit-actor-id" v-model="itemAuditFilters.actorId" inputmode="numeric" placeholder="Optional user id" />
                                            </div>
                                            <div class="grid gap-1">
                                                <Label for="inv-item-audit-from">From</Label>
                                                <Input id="inv-item-audit-from" v-model="itemAuditFilters.from" type="datetime-local" />
                                            </div>
                                            <div class="grid gap-1">
                                                <Label for="inv-item-audit-to">To</Label>
                                                <Input id="inv-item-audit-to" v-model="itemAuditFilters.to" type="datetime-local" />
                                            </div>
                                            <div class="grid gap-1">
                                                <Label for="inv-item-audit-per-page">Rows Per Page</Label>
                                                <Select :model-value="String(itemAuditFilters.perPage)" @update:model-value="itemAuditFilters.perPage = Number($event)">
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="10">10</SelectItem>
                                                        <SelectItem value="20">20</SelectItem>
                                                        <SelectItem value="50">50</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="flex flex-wrap items-end gap-2">
                                                <Button size="sm" :disabled="itemAuditLoading" @click="applyItemAuditFilters">
                                                    {{ itemAuditLoading ? 'Applying...' : 'Apply Filters' }}
                                                </Button>
                                                <Button size="sm" variant="outline" :disabled="itemAuditLoading" @click="resetItemAuditFilters">
                                                    Reset
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    :disabled="itemAuditLoading || itemAuditExporting"
                                                    @click="exportItemAuditLogsCsv"
                                                >
                                                    {{ itemAuditExporting ? 'Preparing...' : 'Export CSV' }}
                                                </Button>
                                            </div>
                                        </div>

                                        <p v-if="itemAuditLoading" class="text-sm text-muted-foreground">Loading audit logs...</p>
                                        <Alert v-else-if="itemAuditError" variant="destructive">
                                            <AlertTitle>Audit load issue</AlertTitle>
                                            <AlertDescription>{{ itemAuditError }}</AlertDescription>
                                        </Alert>
                                        <div v-else-if="itemAuditLogs.length === 0" class="rounded-lg border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
                                            No audit logs found for the current filters.
                                        </div>
                                        <div v-else class="space-y-2">
                                            <div v-for="log in itemAuditLogs" :key="log.id" class="rounded border p-2 text-xs">
                                                <p class="font-medium">{{ log.action }}</p>
                                                <p class="text-muted-foreground">{{ formatDateTime(log.createdAt) }} | {{ auditActorLabel(log) }}</p>
                                            </div>
                                        </div>

                                        <div class="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                :disabled="itemAuditLoading || !itemAuditMeta || itemAuditMeta.currentPage <= 1"
                                                @click="goToItemAuditPage((itemAuditMeta?.currentPage ?? 2) - 1)"
                                            >
                                                Previous
                                            </Button>
                                            <p>
                                                Page {{ itemAuditMeta?.currentPage ?? 1 }} of {{ itemAuditMeta?.lastPage ?? 1 }}
                                                | {{ itemAuditMeta?.total ?? itemAuditLogs.length }} logs
                                            </p>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                :disabled="itemAuditLoading || !itemAuditMeta || itemAuditMeta.currentPage >= itemAuditMeta.lastPage"
                                                @click="goToItemAuditPage((itemAuditMeta?.currentPage ?? 0) + 1)"
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </div>
                    </ScrollArea>
                </Tabs>
            </div>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="itemDetailsOpen = false">Close</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <Sheet :open="placeOrderDialogOpen" @update:open="placeOrderDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Place Purchase Order</SheetTitle>
                <SheetDescription>{{ placeOrderRequest?.requestNumber ?? 'Request' }}</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-5 grid gap-5">
                <Alert v-if="placeOrderRequest?.sourceDepartmentRequisitionId" class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <AppIcon name="activity" class="size-4" />
                    <AlertTitle>Replenishes a department shortage</AlertTitle>
                    <AlertDescription>
                        After receiving this stock into store, reopen {{ procurementSourceLabel(placeOrderRequest) }} and complete the remaining issue to the department.
                    </AlertDescription>
                </Alert>

                <!-- Request context -->
                <div class="rounded-lg border bg-muted/20 p-4 grid gap-2 text-sm">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <p class="font-medium leading-tight">{{ placeOrderRequest?.itemName ?? placeOrderRequest?.item?.itemName ?? 'Item' }}</p>
                            <p class="text-xs text-muted-foreground mt-0.5">{{ placeOrderRequest?.requestNumber ?? '' }}</p>
                        </div>
                        <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">Approved</span>
                    </div>
                    <div class="grid grid-cols-3 gap-3 pt-1 border-t text-xs text-muted-foreground">
                        <div>
                            <p class="font-medium text-foreground">{{ placeOrderRequest?.requestedQuantity ?? '—' }}</p>
                            <p>Requested qty</p>
                        </div>
                        <div>
                            <p class="font-medium text-foreground">{{ placeOrderRequest?.unitCostEstimate != null ? `TZS ${Number(placeOrderRequest.unitCostEstimate).toLocaleString()}` : '—' }}</p>
                            <p>Unit cost est.</p>
                        </div>
                        <div>
                            <p class="font-medium text-foreground">{{ placeOrderRequest?.neededBy ?? '—' }}</p>
                            <p>Needed by</p>
                        </div>
                    </div>
                </div>

                <!-- PO Number + Ordered Quantity -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="grid gap-1.5">
                        <Label for="inv-place-order-number">PO Number <span class="text-destructive">*</span></Label>
                        <Input id="inv-place-order-number" v-model="placeOrderForm.purchaseOrderNumber" placeholder="PO-2026-0001" />
                        <p v-if="fieldError(placeOrderErrors, 'purchaseOrderNumber')" class="text-xs text-destructive">{{ fieldError(placeOrderErrors, 'purchaseOrderNumber') }}</p>
                    </div>
                    <div class="grid gap-1.5">
                        <Label for="inv-place-order-qty">Ordered Quantity <span class="text-destructive">*</span></Label>
                        <Input id="inv-place-order-qty" v-model="placeOrderForm.orderedQuantity" type="number" min="0" step="0.001" />
                        <p v-if="fieldError(placeOrderErrors, 'orderedQuantity')" class="text-xs text-destructive">{{ fieldError(placeOrderErrors, 'orderedQuantity') }}</p>
                    </div>
                </div>

                <!-- Supplier -->
                <div class="grid gap-1.5">
                    <Label for="inv-place-order-supplier">Supplier</Label>
                    <Select :model-value="toSelectValue(placeOrderForm.supplierId)" @update:model-value="placeOrderForm.supplierId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                        <SelectTrigger class="w-full">
                            <SelectValue placeholder="— Not specified —">
                                {{ supplierLabel(placeOrderForm.supplierId) }}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem :value="EMPTY_SELECT_VALUE">— Not specified —</SelectItem>
                        <SelectItem v-for="s in suppliers" :key="s.id" :value="s.id" :text-value="lookupOptionText(s)">{{ s.name }}{{ s.code ? ` (${s.code})` : '' }}</SelectItem>
                        </SelectContent>
                    </Select>
                    <p class="text-xs text-muted-foreground">Pre-filled from the purchase request. Change if directing to a different supplier.</p>
                </div>

                <!-- Unit Cost + Needed By -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="grid gap-1.5">
                        <Label for="inv-place-order-unit-cost">Unit Cost Estimate</Label>
                        <Input id="inv-place-order-unit-cost" v-model="placeOrderForm.unitCostEstimate" type="number" min="0" step="0.01" />
                        <p v-if="fieldError(placeOrderErrors, 'unitCostEstimate')" class="text-xs text-destructive">{{ fieldError(placeOrderErrors, 'unitCostEstimate') }}</p>
                    </div>
                    <SingleDatePopoverField input-id="inv-place-order-needed-by" label="Needed By" v-model="placeOrderForm.neededBy" />
                </div>

                <!-- Notes -->
                <div class="grid gap-1.5">
                    <Label for="inv-place-order-notes">Notes</Label>
                    <Textarea id="inv-place-order-notes" v-model="placeOrderForm.notes" rows="3" />
                </div>

                <Alert v-if="placeOrderError" variant="destructive">
                    <AlertDescription>{{ placeOrderError }}</AlertDescription>
                </Alert>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="placeOrderDialogOpen = false">Cancel</Button>
                <Button :disabled="placeOrderSubmitting" class="gap-1.5" @click="submitPlaceOrder">
                    <AppIcon name="shopping-cart" class="size-3.5" />
                    {{ placeOrderSubmitting ? 'Placing...' : 'Place Order' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <Sheet :open="receiveDialogOpen" @update:open="receiveDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Receive Goods</SheetTitle>
                <SheetDescription>Record physical receipt against procurement request {{ receiveRequest?.requestNumber ?? '' }}</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-5 grid gap-5">
                <Alert v-if="receiveRequest?.sourceDepartmentRequisitionId" class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <AppIcon name="activity" class="size-4" />
                    <AlertTitle>Department shortage handoff</AlertTitle>
                    <AlertDescription>
                        This receipt replenishes {{ procurementSourceLabel(receiveRequest) }}. Once saved, use Complete Issue from the procurement row or Shortage Queue to issue the remaining quantity.
                    </AlertDescription>
                </Alert>

                <!-- Request context -->
                <div class="rounded-lg border bg-muted/20 p-4 grid gap-2 text-sm">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <p class="font-semibold">{{ receiveRequest?.itemName || receiveRequest?.itemId }}</p>
                            <p class="text-xs text-muted-foreground mt-0.5">
                                {{ receiveRequest?.requestNumber }}
                                <template v-if="receiveRequest?.purchaseOrderNumber"> &middot; PO: {{ receiveRequest.purchaseOrderNumber }}</template>
                                <template v-if="receiveRequest?.supplierName"> &middot; {{ receiveRequest.supplierName }}</template>
                            </p>
                        </div>
                        <Badge variant="outline">{{ formatEnumLabel(receiveRequest?.status ?? '') }}</Badge>
                    </div>
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 mt-1">
                        <div>
                            <p class="text-[11px] text-muted-foreground">Ordered Qty</p>
                            <p class="font-semibold tabular-nums">{{ receiveRequest?.orderedQuantity ?? receiveRequest?.requestedQuantity ?? '—' }}</p>
                        </div>
                        <div>
                            <p class="text-[11px] text-muted-foreground">Unit Cost Est.</p>
                            <p class="font-semibold tabular-nums">{{ receiveRequest?.unitCostEstimate ? formatAmount(receiveRequest.unitCostEstimate) : '—' }}</p>
                        </div>
                        <div>
                            <p class="text-[11px] text-muted-foreground">Needed By</p>
                            <p class="font-semibold">{{ receiveRequest?.neededBy ?? '—' }}</p>
                        </div>
                    </div>
                </div>

                <Separator />

                <!-- Received quantity + actual unit cost -->
                <div class="grid gap-4 sm:grid-cols-2">
                    <div class="grid gap-2">
                        <Label for="inv-receive-qty">Received Quantity *</Label>
                        <Input id="inv-receive-qty" v-model="receiveForm.receivedQuantity" type="number" min="0.001" step="0.001" />
                        <p v-if="fieldError(receiveErrors, 'receivedQuantity')" class="text-xs text-destructive">{{ fieldError(receiveErrors, 'receivedQuantity') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-receive-unit-cost">Actual Unit Cost <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                        <Input id="inv-receive-unit-cost" v-model="receiveForm.receivedUnitCost" type="number" min="0" step="0.01" placeholder="Actual cost from delivery note" />
                        <p v-if="fieldError(receiveErrors, 'receivedUnitCost')" class="text-xs text-destructive">{{ fieldError(receiveErrors, 'receivedUnitCost') }}</p>
                    </div>
                </div>

                <!-- Destination warehouse -->
                <div class="grid gap-2">
                    <Label for="inv-receive-warehouse-id">Received Into — Warehouse <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                    <Select :model-value="toSelectValue(receiveForm.warehouseId)" @update:model-value="receiveForm.warehouseId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                        <SelectTrigger class="w-full">
                            <SelectValue placeholder="— Select warehouse —">
                                {{ warehouseLabel(receiveForm.warehouseId) }}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem :value="EMPTY_SELECT_VALUE">— Select warehouse —</SelectItem>
                        <SelectItem v-for="w in warehouses" :key="w.id" :value="w.id" :text-value="lookupOptionText(w)">
                            {{ w.name }}<template v-if="w.code"> ({{ w.code }})</template>
                        </SelectItem>
                        </SelectContent>
                    </Select>
                    <p v-if="fieldError(receiveErrors, 'warehouseId')" class="text-xs text-destructive">{{ fieldError(receiveErrors, 'warehouseId') }}</p>
                </div>

                <div v-if="receiveRequiresBatchTracking" class="grid gap-4 rounded-lg border border-border/70 bg-muted/20 p-4">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <p class="text-sm font-medium">Batch receipt details</p>
                            <p class="text-xs text-muted-foreground">
                                {{ receiveTrackedCategory?.label ?? 'Expiry-sensitive stock' }} must enter stores with batch and expiry traceability.
                            </p>
                        </div>
                        <Badge variant="secondary" class="shrink-0">Batch tracked</Badge>
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="inv-receive-batch-number">Batch Number *</Label>
                            <Input id="inv-receive-batch-number" v-model="receiveForm.batchNumber" placeholder="e.g. BATCH-2026-001" />
                            <p v-if="fieldError(receiveErrors, 'batchNumber')" class="text-xs text-destructive">{{ fieldError(receiveErrors, 'batchNumber') }}</p>
                        </div>
                        <SingleDatePopoverField
                            input-id="inv-receive-expiry-date"
                            label="Expiry Date *"
                            v-model="receiveForm.expiryDate"
                            :error-message="fieldError(receiveErrors, 'expiryDate')"
                        />
                    </div>

                    <div class="grid gap-4 sm:grid-cols-3">
                        <div class="grid gap-2">
                            <Label for="inv-receive-lot-number">Lot Number <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Input id="inv-receive-lot-number" v-model="receiveForm.lotNumber" placeholder="Supplier lot reference" />
                            <p v-if="fieldError(receiveErrors, 'lotNumber')" class="text-xs text-destructive">{{ fieldError(receiveErrors, 'lotNumber') }}</p>
                        </div>
                        <SingleDatePopoverField
                            input-id="inv-receive-manufacture-date"
                            label="Manufacture Date"
                            helper-text="Optional"
                            v-model="receiveForm.manufactureDate"
                            :error-message="fieldError(receiveErrors, 'manufactureDate')"
                        />
                        <div class="grid gap-2">
                            <Label for="inv-receive-bin-location">Bin Location <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Input id="inv-receive-bin-location" v-model="receiveForm.binLocation" placeholder="Rack / shelf / cold-room bin" />
                            <p v-if="fieldError(receiveErrors, 'binLocation')" class="text-xs text-destructive">{{ fieldError(receiveErrors, 'binLocation') }}</p>
                        </div>
                    </div>
                </div>

                <!-- Timing + reason -->
                <div class="grid gap-4 sm:grid-cols-2">
                    <div class="grid gap-2">
                        <Label for="inv-receive-occurred-at">Delivery Date &amp; Time <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                        <Input id="inv-receive-occurred-at" v-model="receiveForm.occurredAt" type="datetime-local" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-receive-reason">Reason <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                        <Input id="inv-receive-reason" v-model="receiveForm.reason" placeholder="e.g. Regular delivery, Emergency supply" />
                    </div>
                </div>

                <!-- Notes -->
                <div class="grid gap-2">
                    <Label for="inv-receive-notes">Notes <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                    <Textarea id="inv-receive-notes" v-model="receiveForm.notes" rows="3" placeholder="Delivery note number, batch reference, condition on receipt..." />
                </div>

                <Alert v-if="receiveError" variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{{ receiveError }}</AlertDescription>
                </Alert>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="receiveDialogOpen = false">Cancel</Button>
                <Button :disabled="receiveSubmitting" class="gap-1.5" @click="submitReceiveGoods">
                    <AppIcon name="package-check" class="size-3.5" />
                    {{ receiveSubmitting ? 'Receiving...' : 'Confirm Receipt' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <Sheet :open="statusDialogOpen" @update:open="statusDialogOpen = $event">
        <SheetContent side="right" variant="action" size="lg">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Update Procurement Status</SheetTitle>
                <SheetDescription>{{ statusRequest?.requestNumber ?? 'Request' }}</SheetDescription>
            </SheetHeader>
            <div class="px-6 py-4 space-y-3">
                <div class="space-y-1">
                    <Label>Status</Label>
                    <Select :model-value="toSelectValue(statusValue)" @update:model-value="statusValue = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem v-for="item in procurementManualStatusOptions" :key="item" :value="item">{{ formatEnumLabel(item) }}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="space-y-1">
                    <Label>Reason</Label>
                    <Input v-model="statusReason" placeholder="Required for rejected/cancelled" />
                </div>
                <p v-if="statusError" class="text-xs text-red-600">{{ statusError }}</p>
            </div>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="statusDialogOpen = false">Close</Button>
                <Button :disabled="statusSubmitting" @click="submitStatusUpdate">{{ statusSubmitting ? 'Saving...' : 'Save' }}</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <Sheet :open="detailsOpen" @update:open="detailsOpen = $event">
        <SheetContent side="right" variant="workspace">
            <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                <SheetTitle>Procurement Request Details</SheetTitle>
                <SheetDescription>{{ detailsRequest?.requestNumber }}</SheetDescription>
            </SheetHeader>
            <div class="px-6 py-4 space-y-4">
                <Alert v-if="detailsRequest?.sourceDepartmentRequisitionId" class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <AppIcon name="activity" class="size-4" />
                    <AlertTitle>Raised from department shortage</AlertTitle>
                    <AlertDescription>
                        {{ procurementSourceLabel(detailsRequest) }} | Line {{ detailsRequest.sourceDepartmentRequisitionLineId || 'N/A' }}
                    </AlertDescription>
                    <Button
                        size="sm"
                        variant="outline"
                        class="mt-3 bg-background/80"
                        :disabled="sourceRequisitionOpeningId === String(detailsRequest?.id)"
                        @click="openSourceRequisitionFromProcurement(detailsRequest)"
                    >
                        {{ sourceRequisitionOpeningId === String(detailsRequest?.id) ? 'Opening...' : 'Open source requisition' }}
                    </Button>
                </Alert>
                <div class="grid gap-2 text-sm sm:grid-cols-2">
                    <p><span class="text-muted-foreground">Request Number:</span> {{ detailsRequest?.requestNumber }}</p>
                    <p><span class="text-muted-foreground">PO Number:</span> {{ detailsRequest?.purchaseOrderNumber || 'N/A' }}</p>
                    <p><span class="text-muted-foreground">Status:</span> {{ formatEnumLabel(detailsRequest?.status ?? 'n/a') }}</p>
                    <p><span class="text-muted-foreground">Item ID:</span> {{ detailsRequest?.itemId }}</p>
                    <p><span class="text-muted-foreground">Requested Qty:</span> {{ detailsRequest?.requestedQuantity }}</p>
                    <p><span class="text-muted-foreground">Ordered Qty:</span> {{ detailsRequest?.orderedQuantity ?? 'N/A' }}</p>
                    <p><span class="text-muted-foreground">Received Qty:</span> {{ detailsRequest?.receivedQuantity ?? 'N/A' }}</p>
                    <p><span class="text-muted-foreground">Unit Cost:</span> {{ formatAmount(detailsRequest?.unitCostEstimate) }}</p>
                    <p><span class="text-muted-foreground">Received Unit Cost:</span> {{ formatAmount(detailsRequest?.receivedUnitCost) }}</p>
                    <p><span class="text-muted-foreground">Total Est:</span> {{ formatAmount(detailsRequest?.totalCostEstimate) }}</p>
                    <p><span class="text-muted-foreground">Needed By:</span> {{ formatDateOnly(detailsRequest?.neededBy) }}</p>
                    <p><span class="text-muted-foreground">Supplier:</span> {{ detailsRequest?.supplierName || supplierLabel(detailsRequest?.supplierId) || 'N/A' }}</p>
                    <p v-if="detailsRequest?.sourceDepartmentRequisitionId"><span class="text-muted-foreground">Source Approved:</span> {{ detailsRequest?.sourceLineApprovedQuantity ?? 'N/A' }} {{ detailsRequest?.sourceLineUnit ?? '' }}</p>
                    <p v-if="detailsRequest?.sourceDepartmentRequisitionId"><span class="text-muted-foreground">Source Issued:</span> {{ detailsRequest?.sourceLineIssuedQuantity ?? 'N/A' }} {{ detailsRequest?.sourceLineUnit ?? '' }}</p>
                    <p><span class="text-muted-foreground">Receiving Warehouse ID:</span> {{ detailsRequest?.receivingWarehouseId || 'N/A' }}</p>
                    <p><span class="text-muted-foreground">Approved At:</span> {{ formatDateTime(detailsRequest?.approvedAt) }}</p>
                    <p><span class="text-muted-foreground">Ordered At:</span> {{ formatDateTime(detailsRequest?.orderedAt) }}</p>
                    <p><span class="text-muted-foreground">Received At:</span> {{ formatDateTime(detailsRequest?.receivedAt) }}</p>
                </div>
                <div class="rounded border p-3 text-sm">
                    <p class="font-medium">Status Reason</p>
                    <p class="text-muted-foreground">{{ detailsRequest?.statusReason || 'N/A' }}</p>
                </div>
                <div class="rounded border p-3 text-sm">
                    <p class="font-medium">Receiving Notes</p>
                    <p class="text-muted-foreground">{{ detailsRequest?.receivingNotes || 'N/A' }}</p>
                </div>
                <div class="rounded border p-3 text-sm">
                    <p class="font-medium">Audit Logs</p>
                    <Alert v-if="!canViewAudit" variant="destructive" class="mt-2">
                        <AlertTitle>Audit Access Restricted</AlertTitle>
                        <AlertDescription>Request <code>inventory.procurement.view-audit-logs</code> permission.</AlertDescription>
                    </Alert>
                    <div v-else class="mt-2 space-y-3">
                        <div class="grid gap-3 rounded-md border p-3 md:grid-cols-2">
                            <div class="grid gap-1">
                                <Label for="inv-details-audit-q">Action Text Search</Label>
                                <Input id="inv-details-audit-q" v-model="detailsAuditFilters.q" placeholder="status.updated, created, approved..." />
                            </div>
                            <div class="grid gap-1">
                                <Label for="inv-details-audit-action">Action (exact)</Label>
                                <Input id="inv-details-audit-action" v-model="detailsAuditFilters.action" placeholder="Optional exact action key" />
                            </div>
                            <div class="grid gap-1">
                                <Label for="inv-details-audit-actor-type">Actor Type</Label>
                                <Select :model-value="toSelectValue(detailsAuditFilters.actorType)" @update:model-value="detailsAuditFilters.actorType = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem
                                        v-for="option in auditActorTypeOptions"
                                        :key="`inv-audit-actor-type-${option.value || 'all'}`"
                                        :value="toSelectValue(option.value)"
                                    >
                                        {{ option.label }}
                                    </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-1">
                                <Label for="inv-details-audit-actor-id">Actor ID</Label>
                                <Input id="inv-details-audit-actor-id" v-model="detailsAuditFilters.actorId" inputmode="numeric" placeholder="Optional user id" />
                            </div>
                            <div class="grid gap-1">
                                <Label for="inv-details-audit-from">From</Label>
                                <Input id="inv-details-audit-from" v-model="detailsAuditFilters.from" type="datetime-local" />
                            </div>
                            <div class="grid gap-1">
                                <Label for="inv-details-audit-to">To</Label>
                                <Input id="inv-details-audit-to" v-model="detailsAuditFilters.to" type="datetime-local" />
                            </div>
                            <div class="grid gap-1">
                                <Label for="inv-details-audit-per-page">Rows Per Page</Label>
                                <Select :model-value="String(detailsAuditFilters.perPage)" @update:model-value="detailsAuditFilters.perPage = Number($event)">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="flex flex-wrap items-end gap-2">
                                <Button size="sm" :disabled="detailsAuditLoading" @click="applyDetailsAuditFilters">
                                    {{ detailsAuditLoading ? 'Applying...' : 'Apply Filters' }}
                                </Button>
                                <Button size="sm" variant="outline" :disabled="detailsAuditLoading" @click="resetDetailsAuditFilters">
                                    Reset
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    :disabled="detailsAuditLoading || detailsAuditExporting"
                                    @click="exportDetailsAuditLogsCsv"
                                >
                                    {{ detailsAuditExporting ? 'Preparing...' : 'Export CSV' }}
                                </Button>
                            </div>
                        </div>
                        <p v-if="detailsAuditLoading" class="text-muted-foreground">Loading audit logs...</p>
                        <p v-else-if="detailsAuditError" class="text-red-600">{{ detailsAuditError }}</p>
                        <p v-else-if="detailsAuditLogs.length === 0" class="text-muted-foreground">No audit logs found for current filters.</p>
                        <div v-else class="space-y-2">
                            <div v-for="log in detailsAuditLogs" :key="log.id" class="rounded border p-2 text-xs">
                                <p class="font-medium">{{ log.action }}</p>
                                <p class="text-muted-foreground">{{ formatDateTime(log.createdAt) }} | {{ auditActorLabel(log) }}</p>
                            </div>
                        </div>
                        <div class="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                            <Button
                                size="sm"
                                variant="outline"
                                :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage <= 1"
                                @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 2) - 1)"
                            >
                                Previous
                            </Button>
                            <p>
                                Page {{ detailsAuditMeta?.currentPage ?? 1 }} of {{ detailsAuditMeta?.lastPage ?? 1 }}
                                | {{ detailsAuditMeta?.total ?? detailsAuditLogs.length }} logs
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage >= detailsAuditMeta.lastPage"
                                @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 0) + 1)"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="detailsOpen = false">Close</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <!-- Record Lead Time Dialog -->
    <Sheet :open="createLeadTimeDialogOpen" @update:open="createLeadTimeDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Record Supplier Order</SheetTitle>
                <SheetDescription>Track a new order to measure supplier lead time.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <div class="grid gap-2">
                    <Label for="lt-supplier">Supplier</Label>
                    <Select :model-value="toSelectValue(leadTimeForm.supplierId)" @update:model-value="leadTimeForm.supplierId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                        <SelectTrigger class="w-full">
                            <SelectValue placeholder="— Select —">
                                {{ supplierLabel(leadTimeForm.supplierId) }}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem :value="EMPTY_SELECT_VALUE">— Select —</SelectItem>
                        <SelectItem v-for="s in (suppliers ?? [])" :key="s.id" :value="s.id" :text-value="lookupOptionText(s)">{{ s.name }}</SelectItem>
                        </SelectContent>
                    </Select>
                    <p v-if="fieldError(leadTimeErrors, 'supplierId')" class="text-xs text-destructive">{{ fieldError(leadTimeErrors, 'supplierId') }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="lt-item">Item (optional)</Label>
                    <Select :model-value="toSelectValue(leadTimeForm.itemId)" @update:model-value="leadTimeForm.itemId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem :value="EMPTY_SELECT_VALUE">— All items —</SelectItem>
                        <SelectItem v-for="it in items" :key="it.id" :value="it.id">{{ it.itemCode }} — {{ it.itemName }}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="grid gap-2 sm:grid-cols-2">
                    <SingleDatePopoverField
                        input-id="lt-order-date"
                        label="Order Date"
                        v-model="leadTimeForm.orderDate"
                        :error-message="fieldError(leadTimeErrors, 'orderDate')"
                    />
                    <SingleDatePopoverField input-id="lt-expected-date" label="Expected Delivery" v-model="leadTimeForm.expectedDeliveryDate" />
                </div>
                <div class="grid gap-2">
                    <Label for="lt-qty-ordered">Quantity Ordered</Label>
                    <Input id="lt-qty-ordered" type="number" step="0.001" min="0" v-model="leadTimeForm.quantityOrdered" />
                </div>
                <div class="grid gap-2">
                    <Label for="lt-notes">Notes</Label>
                    <Input id="lt-notes" v-model="leadTimeForm.notes" placeholder="Optional notes..." />
                </div>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="createLeadTimeDialogOpen = false">Cancel</Button>
                <Button :disabled="leadTimeSubmitting" @click="submitCreateLeadTime">
                    {{ leadTimeSubmitting ? 'Saving...' : 'Record Order' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <!-- Record Delivery Dialog -->
    <Sheet :open="recordDeliveryDialogOpen" @update:open="recordDeliveryDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Record Delivery</SheetTitle>
                <SheetDescription>Record the actual delivery date and received quantity.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <SingleDatePopoverField
                    input-id="del-date"
                    label="Actual Delivery Date"
                    v-model="deliveryForm.actualDeliveryDate"
                    :error-message="fieldError(deliveryErrors, 'actualDeliveryDate')"
                />
                <div class="grid gap-2">
                    <Label for="del-qty">Quantity Received</Label>
                    <Input id="del-qty" type="number" step="0.001" min="0" v-model="deliveryForm.quantityReceived" />
                </div>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="recordDeliveryDialogOpen = false">Cancel</Button>
                <Button :disabled="deliverySubmitting" @click="submitRecordDelivery">
                    {{ deliverySubmitting ? 'Recording...' : 'Record Delivery' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <!-- Create Warehouse Transfer Dialog -->
    <Sheet :open="createTransferDialogOpen" @update:open="createTransferDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Create Warehouse Transfer</SheetTitle>
                <SheetDescription>Move stock between warehouses with approval workflow.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <div class="grid gap-3 sm:grid-cols-2">
                    <div class="grid gap-2">
                        <Label for="trf-source">Source Warehouse</Label>
                        <Select :model-value="toSelectValue(transferForm.sourceWarehouseId)" @update:model-value="transferForm.sourceWarehouseId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                            <SelectTrigger class="w-full">
                                <SelectValue placeholder="— Select —">
                                    {{ warehouseLabel(transferForm.sourceWarehouseId) }}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem :value="EMPTY_SELECT_VALUE">— Select —</SelectItem>
                            <SelectItem v-for="w in (warehouses ?? [])" :key="w.id" :value="w.id" :text-value="lookupOptionText(w)">{{ w.name }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="fieldError(transferErrors, 'sourceWarehouseId')" class="text-xs text-destructive">{{ fieldError(transferErrors, 'sourceWarehouseId') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="trf-dest">Destination Warehouse</Label>
                        <Select :model-value="toSelectValue(transferForm.destinationWarehouseId)" @update:model-value="transferForm.destinationWarehouseId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                            <SelectTrigger class="w-full">
                                <SelectValue placeholder="— Select —">
                                    {{ warehouseLabel(transferForm.destinationWarehouseId) }}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem :value="EMPTY_SELECT_VALUE">— Select —</SelectItem>
                            <SelectItem v-for="w in (warehouses ?? [])" :key="w.id" :value="w.id" :text-value="lookupOptionText(w)">{{ w.name }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="fieldError(transferErrors, 'destinationWarehouseId')" class="text-xs text-destructive">{{ fieldError(transferErrors, 'destinationWarehouseId') }}</p>
                    </div>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                    <div class="grid gap-2">
                        <Label for="trf-priority">Priority</Label>
                        <Select :model-value="toSelectValue(transferForm.priority)" @update:model-value="transferForm.priority = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem v-for="p in PRIORITY_OPTIONS" :key="p.value" :value="p.value">{{ p.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="grid gap-2">
                        <Label for="trf-reason">Reason</Label>
                        <Input id="trf-reason" v-model="transferForm.reason" placeholder="Reason for transfer..." />
                    </div>
                </div>
                <div class="grid gap-2">
                    <Label for="trf-notes">Notes</Label>
                    <Input id="trf-notes" v-model="transferForm.notes" placeholder="Optional notes..." />
                </div>

                <!-- Transfer Lines -->
                <fieldset class="grid gap-3 rounded-lg border p-3">
                    <legend class="text-sm font-medium">Items to Transfer</legend>
                    <div v-for="(line, idx) in transferForm.lines" :key="idx" class="grid gap-2 rounded border p-2 sm:grid-cols-4">
                        <div class="grid gap-1">
                            <Label :for="'trf-line-item-' + idx">Item</Label>
                            <Select :model-value="toSelectValue(line.itemId)" @update:model-value="handleTransferLineItemChange(idx, String($event ?? EMPTY_SELECT_VALUE))">
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem :value="EMPTY_SELECT_VALUE">— Select —</SelectItem>
                                <SelectItem v-for="it in items" :key="it.id" :value="it.id">{{ it.itemCode }} — {{ it.itemName }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="fieldError(transferErrors, `lines.${idx}.itemId`)" class="text-xs text-destructive">{{ fieldError(transferErrors, `lines.${idx}.itemId`) }}</p>
                        </div>
                        <div class="grid gap-1">
                            <Label :for="'trf-line-batch-' + idx">
                                Batch
                                <span v-if="transferLineUsesBatchTracking(line)" class="text-destructive">*</span>
                            </Label>
                            <Select :model-value="toSelectValue(line.batchId)" @update:model-value="line.batchId = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                <SelectTrigger :disabled="Boolean(transferBatchLoadingByItemId[line.itemId])">
                                    <SelectValue placeholder="â€” Select â€”" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="EMPTY_SELECT_VALUE">â€” Select â€”</SelectItem>
                                    <SelectItem
                                        v-for="batch in transferLineBatches(line)"
                                        :key="batch.id"
                                        :value="batch.id"
                                        :text-value="batch.batchNumber ?? batch.id"
                                    >
                                        {{ batchOptionLabel(batch) }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="transferBatchLoadingByItemId[line.itemId]" class="text-xs text-muted-foreground">Loading batches...</p>
                            <p v-else-if="transferLineUsesBatchTracking(line) && transferLineBatches(line).length === 0" class="text-xs text-muted-foreground">No source batches found for this warehouse.</p>
                            <p v-if="fieldError(transferErrors, `lines.${idx}.batchId`)" class="text-xs text-destructive">{{ fieldError(transferErrors, `lines.${idx}.batchId`) }}</p>
                        </div>
                        <div class="grid gap-1">
                            <Label :for="'trf-line-qty-' + idx">Quantity</Label>
                            <Input :id="'trf-line-qty-' + idx" type="number" step="0.001" min="0.001" v-model="line.requestedQuantity" />
                            <p v-if="fieldError(transferErrors, `lines.${idx}.requestedQuantity`)" class="text-xs text-destructive">{{ fieldError(transferErrors, `lines.${idx}.requestedQuantity`) }}</p>
                        </div>
                        <div class="flex items-end gap-1">
                            <div class="grid flex-1 gap-1">
                                <Label :for="'trf-line-unit-' + idx">Unit</Label>
                                <Input :id="'trf-line-unit-' + idx" v-model="line.unit" placeholder="e.g. pcs" />
                            </div>
                            <Button v-if="transferForm.lines.length > 1" size="sm" variant="ghost" class="text-destructive" @click="removeTransferLine(idx)">
                                <AppIcon name="x" class="size-4" />
                            </Button>
                        </div>
                    </div>
                    <Button size="sm" variant="outline" @click="addTransferLine">+ Add Line</Button>
                    <p v-if="fieldError(transferErrors, 'lines')" class="text-xs text-destructive">{{ fieldError(transferErrors, 'lines') }}</p>
                </fieldset>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="createTransferDialogOpen = false">Cancel</Button>
                <Button :disabled="transferSubmitting" @click="submitCreateTransfer">
                    {{ transferSubmitting ? 'Creating...' : 'Create Transfer' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <!-- Update Transfer Status Dialog -->
    <Sheet :open="transferStatusDialogOpen" @update:open="value => { transferStatusDialogOpen = value; if (!value) resetTransferStatusForm(); }">
        <SheetContent side="right" variant="action" size="lg">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>{{ transferActionLabel(transferStatusForm.newStatus || 'status_update') }}</SheetTitle>
                <SheetDescription>
                    <span v-if="transferStatusSelectedTransfer?.transfer_number">
                        {{ transferStatusSelectedTransfer.transfer_number }} •
                    </span>
                    Change status from <strong>{{ (transferStatusForm.currentStatus ?? '').replace(/_/g, ' ') }}</strong> to <strong>{{ (transferStatusForm.newStatus ?? '').replace(/_/g, ' ') }}</strong>.
                </SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
                <div class="px-6 py-4 grid gap-4">
                    <div v-if="transferStatusContextLoading" class="rounded-lg border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                        Loading the latest transfer snapshot...
                    </div>

                    <template v-else>
                        <div v-if="transferStatusSelectedTransfer" class="rounded-lg border bg-muted/20 px-3 py-3 grid gap-3">
                            <div class="flex flex-wrap items-center gap-2">
                                <Badge :class="transferStatusBadgeClass(transferStatusSelectedTransfer.status)" class="text-[11px]">
                                    {{ (transferStatusSelectedTransfer.status ?? '').replace(/_/g, ' ') }}
                                </Badge>
                                <Badge :class="transferReservationStateBadgeClass(transferStatusSelectedTransfer.reservationSummary?.state)" class="text-[11px]">
                                    {{ transferReservationSummaryLabel(transferStatusSelectedTransfer) }}
                                </Badge>
                                <Badge variant="outline" class="text-[11px]">
                                    {{ transferPickSummaryLabel(transferStatusSelectedTransfer) }}
                                </Badge>
                            </div>
                            <div v-if="transferAttentionSignals(transferStatusSelectedTransfer).length > 0" class="flex flex-wrap items-center gap-2">
                                <Badge
                                    v-for="signal in transferAttentionSignals(transferStatusSelectedTransfer)"
                                    :key="signal.key"
                                    :class="transferAttentionBadgeClass(signal)"
                                    class="text-[11px]"
                                >
                                    {{ signal.label }}
                                </Badge>
                            </div>
                            <div class="grid gap-2">
                                <p class="text-sm font-medium">
                                    {{ transferStatusSelectedTransfer.routeLabel ?? `${warehouseLabel(transferStatusSelectedTransfer.source_warehouse_id) ?? 'Unknown'} -> ${warehouseLabel(transferStatusSelectedTransfer.destination_warehouse_id) ?? 'Unknown'}` }}
                                </p>
                                <p v-if="transferStatusSelectedTransfer.reason" class="text-xs text-muted-foreground">
                                    {{ transferStatusSelectedTransfer.reason }}
                                </p>
                                <p v-if="transferStatusSelectedTransfer.dispatchNoteNumber" class="text-xs text-muted-foreground">
                                    Dispatch note {{ transferStatusSelectedTransfer.dispatchNoteNumber }}
                                </p>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                <Button
                                    v-if="transferCanOpenPickSlip(transferStatusSelectedTransfer)"
                                    size="sm"
                                    variant="outline"
                                    class="h-8 gap-1.5"
                                    @click="openTransferPickSlip(transferStatusSelectedTransfer)"
                                >
                                    <AppIcon name="clipboard-list" class="size-3.5" />
                                    Pick slip
                                </Button>
                                <Button
                                    v-if="transferCanOpenDispatchNote(transferStatusSelectedTransfer)"
                                    size="sm"
                                    variant="outline"
                                    class="h-8 gap-1.5"
                                    @click="openTransferDispatchNote(transferStatusSelectedTransfer)"
                                >
                                    <AppIcon name="file-text" class="size-3.5" />
                                    Dispatch note
                                </Button>
                            </div>
                        </div>

                        <div v-if="transferStatusForm.newStatus === 'approved'" class="rounded-lg border bg-blue-50/70 px-3 py-3 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                            <p>Approval will place a stock hold on every transfer line so other workflows cannot claim the same quantity before dispatch.</p>
                            <div v-if="(transferStatusSelectedTransfer?.lines ?? []).length" class="mt-3 grid gap-2">
                                <div
                                    v-for="(line, idx) in (transferStatusSelectedTransfer?.lines ?? [])"
                                    :key="line.id"
                                    class="rounded-md border border-blue-200/70 bg-background/70 px-3 py-2 dark:border-blue-900/60"
                                >
                                    <p class="text-sm font-medium">{{ transferLineLabel(line) }}</p>
                                    <p class="text-xs text-muted-foreground">
                                        Requesting {{ formatTransferQuantity(line.requested_quantity) }} {{ line.unit || 'units' }}
                                        <span v-if="line.batchNumber"> | Batch {{ line.batchNumber }}</span>
                                    </p>
                                    <p v-if="fieldError(transferStatusErrors, `lines.${idx}.requestedQuantity`)" class="mt-1 text-xs text-destructive">
                                        {{ fieldError(transferStatusErrors, `lines.${idx}.requestedQuantity`) }}
                                    </p>
                                    <p v-if="fieldError(transferStatusErrors, `lines.${idx}.batchId`)" class="mt-1 text-xs text-destructive">
                                        {{ fieldError(transferStatusErrors, `lines.${idx}.batchId`) }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div v-if="transferStatusForm.newStatus === 'cancelled'" class="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                            Cancelling this transfer releases any active stock hold and closes the workflow before dispatch.
                        </div>

                        <div v-if="transferStatusForm.newStatus === 'rejected'" class="grid gap-2">
                            <Label for="trf-reject-reason">Rejection Reason</Label>
                            <Input id="trf-reject-reason" v-model="transferStatusForm.rejectionReason" placeholder="Why is this transfer being rejected?" />
                            <p v-if="fieldError(transferStatusErrors, 'rejectionReason')" class="text-xs text-destructive">
                                {{ fieldError(transferStatusErrors, 'rejectionReason') }}
                            </p>
                        </div>

                        <div v-if="transferStatusForm.newStatus === 'packed'" class="grid gap-3">
                            <div class="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                                Confirm what the stores team actually picked and packed. This keeps dispatch working from a verified pack quantity instead of the original request.
                            </div>
                            <div
                                v-if="transferDispatchNeedsRevalidation()"
                                class="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100"
                            >
                                <p class="font-medium">The stock hold for this transfer expired and must be refreshed before packing.</p>
                                <p class="mt-1 text-xs text-amber-800/90 dark:text-amber-200/90">
                                    Packing will re-check live stock and recreate the FEFO hold against current availability.
                                </p>
                                <label class="mt-3 flex items-start gap-2 rounded-md border border-amber-200/80 bg-background/80 px-3 py-2 text-sm text-foreground dark:border-amber-900/60 dark:bg-background/30">
                                    <input v-model="transferStatusForm.revalidateReservation" type="checkbox" class="mt-0.5 accent-primary" />
                                    <span>Refresh the expired stock hold and continue with packing.</span>
                                </label>
                                <p v-if="fieldError(transferStatusErrors, 'revalidateReservation')" class="mt-2 text-xs text-destructive">
                                    {{ fieldError(transferStatusErrors, 'revalidateReservation') }}
                                </p>
                            </div>
                            <div class="grid gap-2">
                                <Label for="trf-pack-notes">Pack Notes</Label>
                                <Textarea id="trf-pack-notes" v-model="transferStatusForm.packNotes" rows="3" placeholder="Short shipment note, packing instructions, or handoff remarks" />
                                <p v-if="fieldError(transferStatusErrors, 'packNotes')" class="text-xs text-destructive">
                                    {{ fieldError(transferStatusErrors, 'packNotes') }}
                                </p>
                            </div>
                            <div class="grid gap-3">
                                <div
                                    v-for="line in (transferStatusSelectedTransfer?.lines ?? [])"
                                    :key="line.id"
                                    class="rounded-lg border px-3 py-3 grid gap-3"
                                >
                                    <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-sm font-medium">{{ transferLineLabel(line) }}</p>
                                            <p class="text-xs text-muted-foreground">
                                                Requested {{ formatTransferQuantity(line.requested_quantity) }} {{ line.unit || 'units' }}
                                                <span v-if="line.batchNumber"> | Batch {{ line.batchNumber }}</span>
                                            </p>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Badge :class="transferReservationStateBadgeClass(line.reservationState)" class="text-[11px]">
                                                {{ transferReservationStateLabel(line.reservationState) }}
                                            </Badge>
                                            <Badge v-if="Number(line.reservedQuantity ?? 0) > 0" variant="outline" class="text-[11px]">
                                                Held {{ formatTransferQuantity(line.reservedQuantity) }}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div class="grid gap-3 md:grid-cols-3">
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Requested</p>
                                            <p class="mt-1 text-sm font-semibold">{{ formatTransferQuantity(line.requested_quantity) }}</p>
                                        </div>
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Held</p>
                                            <p class="mt-1 text-sm font-semibold">{{ formatTransferQuantity(line.reservedQuantity) }}</p>
                                        </div>
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Remaining to Pack</p>
                                            <p class="mt-1 text-sm font-semibold">{{ formatTransferQuantity(line.packRemainingQuantity) }}</p>
                                        </div>
                                    </div>
                                    <div class="grid gap-2 md:max-w-xs">
                                        <Label :for="`trf-pack-${line.id}`">Packed Quantity</Label>
                                        <Input
                                            :id="`trf-pack-${line.id}`"
                                            v-model="transferStatusForm.packedQuantities[line.id]"
                                            type="number"
                                            step="0.001"
                                            min="0"
                                        />
                                        <p v-if="fieldError(transferStatusErrors, `packedQuantities.${line.id}`)" class="text-xs text-destructive">
                                            {{ fieldError(transferStatusErrors, `packedQuantities.${line.id}`) }}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="transferStatusForm.newStatus === 'in_transit'" class="grid gap-3">
                            <div class="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                                Confirm what is actually leaving the source warehouse. Dispatch uses packed quantities when they are available, so the stock ledger matches the prepared handoff.
                            </div>
                            <div
                                v-if="transferDispatchNeedsRevalidation()"
                                class="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100"
                            >
                                <p class="font-medium">The stock hold for this transfer expired and must be refreshed before dispatch.</p>
                                <p class="mt-1 text-xs text-amber-800/90 dark:text-amber-200/90">
                                    Dispatch will re-check live stock and recreate the FEFO hold against current availability.
                                    <span v-if="transferStatusSelectedTransfer?.reservationSummary?.refreshRequiredSince || transferStatusSelectedTransfer?.reservationSummary?.staleSince">
                                        Previous hold expired at {{
                                            formatDateTime(
                                                transferStatusSelectedTransfer.reservationSummary.refreshRequiredSince
                                                || transferStatusSelectedTransfer.reservationSummary.staleSince,
                                            )
                                        }}.
                                    </span>
                                </p>
                                <label class="mt-3 flex items-start gap-2 rounded-md border border-amber-200/80 bg-background/80 px-3 py-2 text-sm text-foreground dark:border-amber-900/60 dark:bg-background/30">
                                    <input v-model="transferStatusForm.revalidateReservation" type="checkbox" class="mt-0.5 accent-primary" />
                                    <span>Refresh the expired stock hold and continue with dispatch.</span>
                                </label>
                                <p v-if="fieldError(transferStatusErrors, 'revalidateReservation')" class="mt-2 text-xs text-destructive">
                                    {{ fieldError(transferStatusErrors, 'revalidateReservation') }}
                                </p>
                            </div>
                            <div class="grid gap-3">
                                <div
                                    v-for="(line, idx) in (transferStatusSelectedTransfer?.lines ?? [])"
                                    :key="line.id"
                                    class="rounded-lg border px-3 py-3 grid gap-3"
                                >
                                    <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-sm font-medium">{{ transferLineLabel(line) }}</p>
                                            <p class="text-xs text-muted-foreground">
                                                Requested {{ formatTransferQuantity(line.requested_quantity) }} {{ line.unit || 'units' }}
                                                <span v-if="line.batchNumber"> | Batch {{ line.batchNumber }}</span>
                                            </p>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Badge :class="transferReservationStateBadgeClass(line.reservationState)" class="text-[11px]">
                                                {{ transferReservationStateLabel(line.reservationState) }}
                                            </Badge>
                                            <Badge v-if="Number(line.reservedQuantity ?? 0) > 0" variant="outline" class="text-[11px]">
                                                Held {{ formatTransferQuantity(line.reservedQuantity) }}
                                            </Badge>
                                            <Badge v-if="Number(line.staleReservedQuantity ?? 0) > 0" class="bg-amber-100 text-[11px] text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                                Expired {{ formatTransferQuantity(line.staleReservedQuantity) }}
                                            </Badge>
                                            <Badge v-if="Number(line.expiredReleasedQuantity ?? 0) > 0" class="bg-rose-100 text-[11px] text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                                                Refresh {{ formatTransferQuantity(line.expiredReleasedQuantity) }}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div class="grid gap-3 md:grid-cols-3">
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Requested</p>
                                            <p class="mt-1 text-sm font-semibold">{{ formatTransferQuantity(line.requested_quantity) }}</p>
                                        </div>
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                                {{ Number(line.packedQuantity ?? 0) > 0 ? 'Packed' : (line.isStaleReservation ? 'Expired Hold' : (line.needsReservationRefresh ? 'Refresh Hold' : 'Held')) }}
                                            </p>
                                            <p class="mt-1 text-sm font-semibold">
                                                {{ formatTransferQuantity(Number(line.packedQuantity ?? 0) > 0 ? line.packedQuantity : (line.isStaleReservation ? line.staleReservedQuantity : (line.needsReservationRefresh ? line.expiredReleasedQuantity : line.reservedQuantity))) }}
                                            </p>
                                            <p v-if="line.isStaleReservation && line.staleSince" class="mt-1 text-[11px] text-muted-foreground">
                                                Expired {{ formatDateTime(line.staleSince) }}
                                            </p>
                                            <p v-else-if="line.needsReservationRefresh && line.refreshRequiredSince" class="mt-1 text-[11px] text-muted-foreground">
                                                Released {{ formatDateTime(line.refreshRequiredSince) }}
                                            </p>
                                        </div>
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Remaining to Dispatch</p>
                                            <p class="mt-1 text-sm font-semibold">{{ formatTransferQuantity(line.dispatchRemainingQuantity) }}</p>
                                        </div>
                                    </div>
                                    <div class="grid gap-2 md:max-w-xs">
                                        <Label :for="`trf-dispatch-${line.id}`">Dispatch Quantity</Label>
                                        <Input
                                            :id="`trf-dispatch-${line.id}`"
                                            v-model="transferStatusForm.dispatchedQuantities[line.id]"
                                            type="number"
                                            step="0.001"
                                            min="0"
                                        />
                                        <p v-if="fieldError(transferStatusErrors, `dispatchedQuantities.${line.id}`)" class="text-xs text-destructive">
                                            {{ fieldError(transferStatusErrors, `dispatchedQuantities.${line.id}`) }}
                                        </p>
                                        <p v-if="fieldError(transferStatusErrors, `lines.${idx}.requestedQuantity`)" class="text-xs text-destructive">
                                            {{ fieldError(transferStatusErrors, `lines.${idx}.requestedQuantity`) }}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="transferStatusForm.newStatus === 'received'" class="grid gap-3">
                            <div class="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                                Confirm what was accepted into destination stock. Any shortage, damage, wrong batch, or excess is captured as variance instead of being silently posted into inventory.
                            </div>
                            <div class="grid gap-2">
                                <Label for="trf-receiving-notes">Receiving Notes</Label>
                                <Textarea id="trf-receiving-notes" v-model="transferStatusForm.receivingNotes" rows="3" placeholder="Condition on arrival, variance notes, or receiving remarks" />
                                <p v-if="fieldError(transferStatusErrors, 'receivingNotes')" class="text-xs text-destructive">
                                    {{ fieldError(transferStatusErrors, 'receivingNotes') }}
                                </p>
                            </div>
                            <div class="grid gap-3">
                                <div
                                    v-for="(line, idx) in (transferStatusSelectedTransfer?.lines ?? [])"
                                    :key="line.id"
                                    class="rounded-lg border px-3 py-3 grid gap-3"
                                >
                                    <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-sm font-medium">{{ transferLineLabel(line) }}</p>
                                            <p class="text-xs text-muted-foreground">
                                                Dispatched {{ formatTransferQuantity(line.dispatched_quantity) }} {{ line.unit || 'units' }}
                                                <span v-if="line.batchNumber"> | Batch {{ line.batchNumber }}</span>
                                            </p>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Badge
                                                v-if="transferReceiptVarianceNeedsDetails(line.id)"
                                                class="bg-amber-100 text-[11px] text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                                            >
                                                {{ transferReceiptVarianceType(line.id).replace(/_/g, ' ') }}
                                            </Badge>
                                            <Badge v-else variant="outline" class="text-[11px]">
                                                Full match
                                            </Badge>
                                        </div>
                                    </div>
                                    <div class="grid gap-3 md:grid-cols-3">
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Dispatched</p>
                                            <p class="mt-1 text-sm font-semibold">{{ formatTransferQuantity(line.dispatched_quantity) }}</p>
                                        </div>
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Accepted to Stock</p>
                                            <p class="mt-1 text-sm font-semibold">{{ formatTransferQuantity(line.received_quantity) }}</p>
                                        </div>
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Reported on Arrival</p>
                                            <p class="mt-1 text-sm font-semibold">{{ formatTransferQuantity(line.reportedReceivedQuantity ?? line.dispatched_quantity) }}</p>
                                        </div>
                                    </div>
                                    <div class="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.2fr)]">
                                        <div class="grid gap-2">
                                            <Label :for="`trf-receive-${line.id}`">Accepted Quantity</Label>
                                            <Input
                                                :id="`trf-receive-${line.id}`"
                                                v-model="transferStatusForm.receivedQuantities[line.id]"
                                                type="number"
                                                step="0.001"
                                                min="0"
                                            />
                                            <p v-if="fieldError(transferStatusErrors, `receivedQuantities.${line.id}`)" class="text-xs text-destructive">
                                                {{ fieldError(transferStatusErrors, `receivedQuantities.${line.id}`) }}
                                            </p>
                                            <p v-if="fieldError(transferStatusErrors, `lines.${idx}.receivedQuantity`)" class="text-xs text-destructive">
                                                {{ fieldError(transferStatusErrors, `lines.${idx}.receivedQuantity`) }}
                                            </p>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label :for="`trf-variance-type-${line.id}`">Variance Type</Label>
                                            <Select
                                                :model-value="toSelectValue(transferReceiptVarianceType(line.id))"
                                                @update:model-value="handleTransferReceiptVarianceTypeChange(line, String($event ?? EMPTY_SELECT_VALUE))"
                                            >
                                                <SelectTrigger :id="`trf-variance-type-${line.id}`">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem
                                                        v-for="option in TRANSFER_RECEIPT_VARIANCE_OPTIONS"
                                                        :key="`trf-receipt-variance-${line.id}-${option.value}`"
                                                        :value="option.value"
                                                    >
                                                        {{ option.label }}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p v-if="fieldError(transferStatusErrors, `receiptVarianceTypes.${line.id}`)" class="text-xs text-destructive">
                                                {{ fieldError(transferStatusErrors, `receiptVarianceTypes.${line.id}`) }}
                                            </p>
                                        </div>
                                        <div v-if="transferReceiptVarianceNeedsDetails(line.id)" class="grid gap-3 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
                                            <div class="grid gap-2">
                                                <Label :for="`trf-variance-qty-${line.id}`">Variance Quantity</Label>
                                                <Input
                                                    :id="`trf-variance-qty-${line.id}`"
                                                    v-model="transferStatusForm.receiptVarianceQuantities[line.id]"
                                                    type="number"
                                                    step="0.001"
                                                    min="0"
                                                />
                                                <p v-if="fieldError(transferStatusErrors, `receiptVarianceQuantities.${line.id}`)" class="text-xs text-destructive">
                                                    {{ fieldError(transferStatusErrors, `receiptVarianceQuantities.${line.id}`) }}
                                                </p>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label :for="`trf-variance-reason-${line.id}`">Variance Reason</Label>
                                                <Input
                                                    :id="`trf-variance-reason-${line.id}`"
                                                    v-model="transferStatusForm.receiptVarianceReasons[line.id]"
                                                    placeholder="Why does this line not match dispatch?"
                                                />
                                                <p v-if="fieldError(transferStatusErrors, `receiptVarianceReasons.${line.id}`)" class="text-xs text-destructive">
                                                    {{ fieldError(transferStatusErrors, `receiptVarianceReasons.${line.id}`) }}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="transferStatusDialogOpen = false">Cancel</Button>
                <Button
                    :disabled="transferStatusSubmitting || transferStatusContextLoading || (transferDispatchNeedsRevalidation() && !transferStatusForm.revalidateReservation)"
                    @click="submitTransferStatusUpdate"
                >
                    {{ transferStatusSubmitting ? 'Saving...' : transferActionLabel(transferStatusForm.newStatus || 'confirm') }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <Sheet :open="transferVarianceReviewDialogOpen" @update:open="value => { transferVarianceReviewDialogOpen = value; if (!value) resetTransferVarianceReviewForm(); }">
        <SheetContent side="right" variant="form" size="3xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>{{ transferVarianceReviewState(transferVarianceReviewSelectedTransfer) === 'reviewed' ? 'Receipt Variance Review' : 'Review Receipt Variance' }}</SheetTitle>
                <SheetDescription>
                    Capture the operational follow-up for received transfer lines that did not match dispatch.
                </SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
                <div class="grid gap-4 px-4 py-4">
                    <div v-if="transferVarianceReviewLoading" class="rounded-lg border bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                        Loading the latest variance details...
                    </div>
                    <template v-else>
                        <div class="rounded-lg border bg-muted/15 px-3 py-3">
                            <div class="flex flex-wrap items-center gap-2">
                                <Badge
                                    v-if="transferCanOpenVarianceReview(transferVarianceReviewSelectedTransfer)"
                                    :class="transferVarianceReviewBadgeClass(transferVarianceReviewState(transferVarianceReviewSelectedTransfer))"
                                    class="text-[11px]"
                                >
                                    {{ transferVarianceReviewStateLabel(transferVarianceReviewState(transferVarianceReviewSelectedTransfer)) }}
                                </Badge>
                                <Badge variant="outline" class="text-[11px]">
                                    {{ transferVarianceReviewSelectedTransfer?.receiptVarianceSummary?.lineCount ?? 0 }} variance lines
                                </Badge>
                                <Badge variant="outline" class="text-[11px]">
                                    {{ formatTransferQuantity(transferVarianceReviewSelectedTransfer?.receiptVarianceSummary?.quantity ?? 0) }} total variance
                                </Badge>
                            </div>
                            <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>{{ transferVarianceReviewSelectedTransfer?.transfer_number ?? 'Transfer' }}</span>
                                <span>{{ transferVarianceReviewSelectedTransfer?.routeLabel ?? 'Unknown route' }}</span>
                                <span v-if="transferVarianceReviewSelectedTransfer?.varianceReview?.reviewedAt">
                                    Reviewed {{ formatDateTime(transferVarianceReviewSelectedTransfer.varianceReview.reviewedAt) }}
                                </span>
                            </div>
                        </div>

                        <div
                            v-if="transferVarianceReviewState(transferVarianceReviewSelectedTransfer) !== 'reviewed'"
                            class="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100"
                        >
                            Close this review after confirming the variance was understood and any store follow-up was handled.
                        </div>
                        <div
                            v-else
                            class="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-3 text-sm text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100"
                        >
                            This transfer variance was already reviewed. You can update the review note without changing the stock outcome.
                        </div>

                        <div class="grid gap-3">
                            <div
                                v-for="line in transferVarianceReviewLines(transferVarianceReviewSelectedTransfer)"
                                :key="line.id"
                                class="rounded-lg border px-3 py-3"
                            >
                                <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="space-y-1">
                                        <p class="text-sm font-medium">{{ transferLineLabel(line) }}</p>
                                        <p class="text-xs text-muted-foreground">
                                            Dispatched {{ formatTransferQuantity(line.dispatched_quantity) }} {{ line.unit || 'units' }}
                                            <span v-if="line.batchNumber"> | Batch {{ line.batchNumber }}</span>
                                        </p>
                                    </div>
                                    <Badge class="bg-amber-100 text-[11px] text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                        {{ String(line.receiptVarianceType ?? 'variance').replace(/_/g, ' ') }}
                                    </Badge>
                                </div>
                                <div class="mt-3 grid gap-3 md:grid-cols-4">
                                    <div class="rounded-md border bg-muted/10 px-3 py-2">
                                        <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Dispatched</p>
                                        <p class="mt-1 text-sm font-semibold">{{ formatTransferQuantity(line.dispatched_quantity) }}</p>
                                    </div>
                                    <div class="rounded-md border bg-muted/10 px-3 py-2">
                                        <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Accepted</p>
                                        <p class="mt-1 text-sm font-semibold">{{ formatTransferQuantity(line.received_quantity) }}</p>
                                    </div>
                                    <div class="rounded-md border bg-muted/10 px-3 py-2">
                                        <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Variance Qty</p>
                                        <p class="mt-1 text-sm font-semibold">{{ formatTransferQuantity(line.receiptVarianceQuantity) }}</p>
                                    </div>
                                    <div class="rounded-md border bg-muted/10 px-3 py-2">
                                        <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Reason</p>
                                        <p class="mt-1 text-sm font-semibold">{{ line.receiptVarianceReason || 'No reason recorded' }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="grid gap-2">
                            <Label for="trf-variance-review-notes">Review Note</Label>
                            <Textarea
                                id="trf-variance-review-notes"
                                v-model="transferVarianceReviewForm.reviewNotes"
                                rows="4"
                                placeholder="Summarize what was checked, who was informed, and any operational follow-up."
                            />
                            <p v-if="fieldError(transferVarianceReviewErrors, 'reviewNotes')" class="text-xs text-destructive">
                                {{ fieldError(transferVarianceReviewErrors, 'reviewNotes') }}
                            </p>
                            <p v-if="fieldError(transferVarianceReviewErrors, 'reviewStatus')" class="text-xs text-destructive">
                                {{ fieldError(transferVarianceReviewErrors, 'reviewStatus') }}
                            </p>
                        </div>
                    </template>
                </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="transferVarianceReviewDialogOpen = false">Close</Button>
                <Button
                    :disabled="transferVarianceReviewSubmitting || transferVarianceReviewLoading"
                    @click="submitTransferVarianceReview"
                >
                    {{
                        transferVarianceReviewSubmitting
                            ? 'Saving...'
                            : (transferVarianceReviewState(transferVarianceReviewSelectedTransfer) === 'reviewed' ? 'Update Review' : 'Mark Reviewed')
                    }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <!-- Create Dispensing Claim Link Dialog (Feature 5) -->
    <Sheet :open="createClaimLinkDialogOpen" @update:open="createClaimLinkDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Link Dispensed Item to Claim</SheetTitle>
                <SheetDescription>Record a dispensed inventory item for NHIF/insurance claim submission.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-2">
                        <InventoryItemLookupField
                            input-id="cl-item-id"
                            v-model="claimLinkForm.itemId"
                            label="Item *"
                            helper-text="Search the inventory catalogue for the dispensed item."
                            :error-message="claimLinkErrors.itemId?.[0] ?? null"
                            @selected="handleClaimLinkItemSelected"
                        />
                    </div>
                    <div class="grid gap-2">
                        <PatientLookupField
                            input-id="cl-patient-id"
                            v-model="claimLinkForm.patientId"
                            label="Patient"
                            helper-text="Search the patient directory for the dispensed patient."
                            :error-message="claimLinkErrors.patientId?.[0] ?? null"
                        />
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-3">
                    <div class="grid gap-2">
                        <Label for="cl-qty">Qty Dispensed *</Label>
                        <Input id="cl-qty" v-model="claimLinkForm.quantityDispensed" type="number" step="0.001" min="0.001" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="cl-unit">Unit</Label>
                        <Input id="cl-unit" v-model="claimLinkForm.unit" placeholder="e.g. tablets" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="cl-cost">Unit Cost</Label>
                        <Input id="cl-cost" v-model="claimLinkForm.unitCost" type="number" step="0.01" min="0" />
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-2">
                        <Label for="cl-nhif">NHIF Code</Label>
                        <Input id="cl-nhif" v-model="claimLinkForm.nhifCode" placeholder="NHIF item code" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="cl-payer-type">Payer Type</Label>
                        <Select :model-value="toSelectValue(claimLinkForm.payerType)" @update:model-value="claimLinkForm.payerType = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem :value="EMPTY_SELECT_VALUE">Select...</SelectItem>
                            <SelectItem value="insurance">Insurance</SelectItem>
                            <SelectItem value="government">Government (NHIF)</SelectItem>
                            <SelectItem value="employer">Employer</SelectItem>
                            <SelectItem value="self_pay">Self Pay</SelectItem>
                            <SelectItem value="donor">Donor</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div class="grid gap-2">
                    <Label for="cl-payer-name">Payer Name</Label>
                    <Input id="cl-payer-name" v-model="claimLinkForm.payerName" placeholder="e.g. NHIF Tanzania" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-2">
                        <ClaimsInsuranceCaseLookupField
                            input-id="cl-claim-id"
                            v-model="claimLinkForm.insuranceClaimId"
                            label="Insurance claim"
                            helper-text="Search an existing claims case to inherit payer and invoice context."
                            @selected="handleClaimLinkClaimsCaseSelected"
                        />
                    </div>
                    <div class="grid gap-2">
                        <BillingInvoiceLookupField
                            input-id="cl-invoice-id"
                            v-model="claimLinkForm.billingInvoiceId"
                            label="Billing invoice"
                            helper-text="Search the billing ledger and link the dispensed item to the matching invoice."
                            :statuses="['issued', 'partially_paid']"
                        />
                    </div>
                </div>
                <div class="grid gap-2">
                    <Label for="cl-notes">Notes</Label>
                    <Textarea id="cl-notes" v-model="claimLinkForm.notes" rows="2" />
                </div>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="createClaimLinkDialogOpen = false">Cancel</Button>
                <Button :disabled="claimLinkSubmitting" @click="submitCreateClaimLink">
                    {{ claimLinkSubmitting ? 'Creating...' : 'Create Link' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <!-- Create MSD Order Dialog (Feature 6) -->
    <Sheet :open="createMsdOrderDialogOpen" @update:open="createMsdOrderDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Create MSD Electronic Order</SheetTitle>
                <SheetDescription>Submit an order to the Medical Stores Department (MSD) e-ordering system.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-2">
                        <Label for="msd-facility">Facility MSD Code</Label>
                        <Input id="msd-facility" v-model="msdOrderForm.facilityMsdCode" placeholder="MSD customer code" />
                    </div>
                    <SingleDatePopoverField
                        input-id="msd-order-date"
                        label="Order Date *"
                        v-model="msdOrderForm.orderDate"
                        :error-message="msdOrderErrors.orderDate?.[0] ?? null"
                    />
                </div>
                <SingleDatePopoverField input-id="msd-expected-date" label="Expected Delivery Date" v-model="msdOrderForm.expectedDeliveryDate" />

                <Separator />
                <div class="flex items-center justify-between">
                    <Label class="text-sm font-medium">Order Lines</Label>
                    <Button variant="outline" size="sm" class="h-7 text-xs" @click="addMsdOrderLine">+ Add Line</Button>
                </div>
                <div v-for="(line, idx) in msdOrderForm.lines" :key="idx" class="grid grid-cols-5 items-end gap-2 rounded border p-2">
                    <div class="grid gap-1">
                        <Label class="text-[10px]">MSD Code *</Label>
                        <Input v-model="line.msdCode" placeholder="MSD code" class="h-8 text-xs" />
                    </div>
                    <div class="grid gap-1">
                        <Label class="text-[10px]">Item Name *</Label>
                        <Input v-model="line.itemName" placeholder="Item name" class="h-8 text-xs" />
                    </div>
                    <div class="grid gap-1">
                        <Label class="text-[10px]">Qty *</Label>
                        <Input v-model="line.quantity" type="number" min="0.001" step="0.001" class="h-8 text-xs" />
                    </div>
                    <div class="grid gap-1">
                        <Label class="text-[10px]">Unit *</Label>
                        <Input v-model="line.unit" placeholder="e.g. packs" class="h-8 text-xs" />
                    </div>
                    <div class="flex items-end gap-1">
                        <div class="grid flex-1 gap-1">
                            <Label class="text-[10px]">Cost</Label>
                            <Input v-model="line.unitCost" type="number" min="0" step="0.01" class="h-8 text-xs" />
                        </div>
                        <Button v-if="msdOrderForm.lines.length > 1" variant="ghost" size="sm" class="h-8 w-8 shrink-0 text-destructive" @click="removeMsdOrderLine(idx)">×</Button>
                    </div>
                </div>

                <div class="grid gap-2">
                    <Label for="msd-notes">Notes</Label>
                    <Textarea id="msd-notes" v-model="msdOrderForm.notes" rows="2" />
                </div>
                <div class="flex items-center gap-2">
                    <input id="msd-submit-now" v-model="msdOrderForm.submitImmediately" type="checkbox" class="rounded border" />
                    <Label for="msd-submit-now" class="text-sm">Submit to MSD immediately</Label>
                </div>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="createMsdOrderDialogOpen = false">Cancel</Button>
                <Button :disabled="msdOrderSubmitting" @click="submitCreateMsdOrder">
                    {{ msdOrderSubmitting ? 'Creating...' : 'Create Order' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <!-- Barcode Scanner Dialog (Feature 7) -->
    <Sheet :open="barcodeScannerOpen" @update:open="barcodeScannerOpen = $event">
        <SheetContent side="right" variant="action" size="md">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="search" class="size-4" />
                    Barcode Lookup
                </SheetTitle>
                <SheetDescription>Scan or type a barcode to look up inventory items.</SheetDescription>
            </SheetHeader>
            <div class="px-6 py-4 grid gap-4">
                <div class="grid gap-2">
                    <Label for="bc-input">Barcode</Label>
                    <div class="flex gap-2">
                        <Input
                            id="bc-input"
                            v-model="barcodeInput"
                            placeholder="Scan or type barcode..."
                            autofocus
                            @keydown="onBarcodeKeydown"
                        />
                        <Button :disabled="barcodeLookupLoading || !barcodeInput.trim()" @click="lookupBarcode">
                            {{ barcodeLookupLoading ? '...' : 'Lookup' }}
                        </Button>
                    </div>
                </div>
                <Alert v-if="barcodeLookupError" variant="destructive">
                    <AlertDescription>{{ barcodeLookupError }}</AlertDescription>
                </Alert>
                <Card v-if="barcodeLookupResult" class="bg-muted/30">
                    <CardContent class="grid gap-2 p-3 text-sm">
                        <div class="flex items-center justify-between">
                            <span class="font-medium">{{ barcodeLookupResult.item_name }}</span>
                            <Badge variant="outline">{{ barcodeLookupResult.item_code }}</Badge>
                        </div>
                        <Separator />
                        <div class="grid grid-cols-2 gap-y-1 text-xs">
                            <span class="text-muted-foreground">Category:</span>
                            <span>{{ barcodeLookupResult.category ? formatEnumLabel(barcodeLookupResult.category) : '—' }}</span>
                            <span class="text-muted-foreground">Store Stock:</span>
                            <span class="font-medium">{{ barcodeLookupResult.current_stock }} {{ barcodeLookupResult.unit || '' }}</span>
                            <span class="text-muted-foreground">Barcode:</span>
                            <span class="font-mono">{{ barcodeLookupResult.barcode }}</span>
                            <span class="text-muted-foreground">NHIF Code:</span>
                            <span>{{ barcodeLookupResult.nhif_code || '—' }}</span>
                            <span class="text-muted-foreground">MSD Code:</span>
                            <span>{{ barcodeLookupResult.msd_code || '—' }}</span>
                            <span class="text-muted-foreground">ABC/VEN:</span>
                            <span>{{ barcodeLookupResult.abc_classification || '—' }}/{{ barcodeLookupResult.ven_classification || '—' }}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="barcodeScannerOpen = false; barcodeInput = ''; barcodeLookupResult = null; barcodeLookupError = ''">Close</Button>
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
