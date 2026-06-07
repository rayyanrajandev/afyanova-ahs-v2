"""Extract inventory workspace tab markup into lazy-loaded tab components."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path('resources/js/pages/inventory-procurement')
WORKSPACE = ROOT / 'Workspace.vue'
OUT_DIR = ROOT / 'workspace'

TAB_IMPORTS = {
    'WorkspaceShortageQueueTab': [
        "import { Transition } from 'vue';",
        "import AppIcon from '@/components/AppIcon.vue';",
        "import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';",
        "import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';",
        "import { Badge } from '@/components/ui/badge';",
        "import { Button } from '@/components/ui/button';",
        "import { Card, CardContent } from '@/components/ui/card';",
        "import { SearchInput } from '@/components/ui/input';",
        "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
        "import { formatEnumLabel } from '@/lib/labels';",
        "import { shortageReadinessStripeClass } from '@/lib/listRows';",
        "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
    ],
    'WorkspaceTransfersTab': [
        "import AppIcon from '@/components/AppIcon.vue';",
        "import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';",
        "import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';",
        "import { Button } from '@/components/ui/button';",
        "import { Card } from '@/components/ui/card';",
        "import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';",
        "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
        "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
    ],
    'WorkspaceInventoryTab': [
        "import AppIcon from '@/components/AppIcon.vue';",
        "import InventoryEmptyState from '@/components/inventory/InventoryEmptyState.vue';",
        "import RegistryListRow from '@/components/list/RegistryListRow.vue';",
        "import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';",
        "import { Badge } from '@/components/ui/badge';",
        "import { Button } from '@/components/ui/button';",
        "import { Card, CardContent } from '@/components/ui/card';",
        "import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';",
        "import { SearchInput } from '@/components/ui/input';",
        "import { ScrollArea } from '@/components/ui/scroll-area';",
        "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
        "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
    ],
    'WorkspaceDepartmentStockTab': [
        "import AppIcon from '@/components/AppIcon.vue';",
        "import RegistryListRow from '@/components/list/RegistryListRow.vue';",
        "import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';",
        "import { Badge } from '@/components/ui/badge';",
        "import { Button } from '@/components/ui/button';",
        "import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';",
        "import { Label } from '@/components/ui/label';",
        "import { SearchInput } from '@/components/ui/input';",
        "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
        "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
    ],
    'WorkspaceProcurementTab': [
        "import AppIcon from '@/components/AppIcon.vue';",
        "import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';",
        "import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';",
        "import { Button } from '@/components/ui/button';",
        "import { Card } from '@/components/ui/card';",
        "import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';",
        "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
        "import { formatEnumLabel } from '@/lib/labels';",
        "import { procurementRequestStripeClass } from '@/lib/listRows';",
        "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
    ],
    'WorkspaceLedgerTab': [
        "import AppIcon from '@/components/AppIcon.vue';",
        "import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';",
        "import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';",
        "import { Button } from '@/components/ui/button';",
        "import { Card } from '@/components/ui/card';",
        "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
        "import { formatEnumLabel } from '@/lib/labels';",
        "import { stockMovementStripeClass } from '@/lib/listRows';",
        "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
    ],
    'WorkspaceAnalyticsTab': [
        "import AppIcon from '@/components/AppIcon.vue';",
        "import { Badge } from '@/components/ui/badge';",
        "import { Button } from '@/components/ui/button';",
        "import { Card, CardContent } from '@/components/ui/card';",
        "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
        "import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';",
        "import { formatEnumLabel } from '@/lib/labels';",
        "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
    ],
}

BINDINGS = sorted({
    'canRead', 'canCreateRequest', 'canManageItems', 'canCreateMovement', 'canUpdateRequestStatus',
    'canLaunchCreateItem', 'canLaunchStockMovement', 'canLaunchProcurementRequest',
    'canSelectAnyRequisitionDepartment', 'loading', 'deptReqSearch', 'deptReqLoading',
    'deptRequisitions', 'deptReqPagination', 'deptReqFilterChips', 'hasAnyDeptReqFilters',
    'REQUISITION_STATUSES', 'EMPTY_SELECT_VALUE', 'requisitionDepartmentOptions',
    'loadDeptRequisitions', 'resetDeptReqFilters', 'openCreateRequisitionDialog',
    'openRequisitionDetails', 'updateRequisitionStatus', 'requisitionPrimaryActionLabel',
    'reqStatusBadgeClass', 'warehouseLabel', 'formatDateOnly', 'formatDateTime', 'formatEnumLabel',
    'toSelectValue', 'fromSelectValue', 'lookupOptionText', 'claimLinks', 'claimLinkPagination',
    'claimLinkLoading', 'claimLinkSearch', 'CLAIM_STATUSES', 'createClaimLinkDialogOpen',
    'loadClaimLinks', 'claimStatusBadgeClass', 'formatAmount', 'openItemDetails', 'msdOrders',
    'msdOrderPagination', 'msdOrderLoading', 'msdOrderSearch', 'MSD_ORDER_STATUSES',
    'shortageMsdDraftLines', 'lowStockMsdDraftLines', 'openMsdOrderFromDraft', 'openBlankMsdOrder',
    'loadMsdOrders', 'msdStatusBadgeClass', 'syncMsdOrderStatus', 'leadTimeSearch', 'leadTimeLoading',
    'leadTimes', 'leadTimePagination', 'suppliers', 'supplierPerformance', 'supplierLabel',
    'createLeadTimeDialogOpen', 'loadLeadTimes', 'deliveryStatusBadge', 'openRecordDelivery',
    'shortageQueueReplenishmentBanner', 'shortageQueueMeta', 'shortageQueueItems',
    'shortageQueueLoading', 'shortageQueueError', 'shortageQueueFilters', 'departments',
    'loadShortageQueue', 'canCreateProcurementFromRequisitionLine', 'openProcurementFromQueueShortage',
    'shortageLineProcurementRequest', 'transferAttentionSummary', 'transferAttentionBadgeClass',
    'createTransferDialogOpen', 'transferSearch', 'TRANSFER_STATUSES',
    'TRANSFER_VARIANCE_REVIEW_FILTER_OPTIONS', 'transferLoading', 'transfers', 'transferPagination',
    'loadWarehouseTransfers', 'transferStatusBadgeClass', 'transferPriorityBadge',
    'transferReservationStateBadgeClass', 'transferReservationSummaryLabel',
    'transferCanOpenVarianceReview', 'transferVarianceReviewState', 'transferVarianceReviewBadgeClass',
    'transferVarianceReviewStateLabel', 'transferPickSummaryLabel', 'transferAttentionSignals',
    'TRANSFER_ACTION_TRANSITIONS', 'openTransferStatusDialog', 'transferActionLabel',
    'openTransferVarianceReviewDialog', 'transferVarianceReviewButtonLabel',
    'transferCanOpenPickSlip', 'transferCanOpenDispatchNote', 'openTransferPickSlip',
    'openTransferDispatchNote', 'itemCounts', 'inventoryAutoRefreshInterval',
    'INVENTORY_AUTO_REFRESH_LABEL', 'refreshInventoryItems', 'openCreateItemDialog', 'itemSearch',
    'itemFiltersSheetOpen', 'hasAnyItemFilters', 'itemFilterChips', 'items', 'inventoryItemSetupBlockedReason',
    'resetItemFilters', 'stockStateDotClass', 'stockStateLabel', 'flashedItemId',
    'inventoryItemNeedsOpeningStock', 'stockAlertBadgeClass', 'openStockMovementDialog',
    'inventoryItemStockActionLabel', 'openDepartmentStockForItem', 'itemPagination', 'itemPages',
    'goToItemPage', 'reloadAll', 'departmentStockSummary', 'departmentStockFiltersOpen',
    'departmentStockScopedItem', 'departmentStockLoading', 'clearDepartmentStockItemScope',
    'departmentStockFilters', 'applyDepartmentStockFilters', 'resetDepartmentStockFilters',
    'departmentStock', 'goToDepartmentStockPage', 'departmentStockPagination', 'departmentStockPages',
    'mobileProcurementDrawerOpen', 'openCreateProcurementDialog', 'procurementSearch',
    'procurementStatusOptions', 'hasAnyProcurementFilters', 'procurementFilterChips',
    'resetProcurementFilters', 'procurementRequests', 'flashedRequestId', 'openDetails',
    'procurementSourceLabel', 'supplierLabel', 'sourceRequisitionOpeningId',
    'openSourceRequisitionFromProcurement', 'procurementPrimaryAction', 'procurementOverflowActions',
    'procurementPagination', 'procurementPages', 'goToProcurementPage', 'loadProcurementRequests',
    'stockLedgerSummary', 'stockLedgerLoading', 'stockLedgerFiltersOpen', 'exportStockLedgerCsv',
    'stockLedgerFilters', 'movementTypeOptions', 'stockLedgerSourceOptions', 'applyStockLedgerFilters',
    'auditActorTypeOptions', 'resetStockLedgerFilters', 'stockMovements', 'stockMovementPagination',
    'stockMovementSourceSummary', 'stockLedgerPages', 'goToStockLedgerPage',
    'analyticsLoading', 'loadAllAnalytics', 'consumptionTrends', 'abcVenMatrix', 'expiryWastage',
    'stockTurnover',     'consumptionGranularity', 'consumptionDays', 'loadConsumptionTrends',
    'submitItemFiltersFromSheet', 'resetItemFiltersFromSheet', 'itemCategoryOptions',
    'stockStateOptions', 'submitProcurementSearchFromMobileDrawer',
    'resetProcurementFiltersFromMobileDrawer', 'mobileLedgerDrawerOpen',
    'submitLedgerSearchFromMobileDrawer', 'resetLedgerFiltersFromMobileDrawer',
    'createBatchDialogOpen', 'batchForm', 'batchCreateSubmitting', 'batchCreateErrors',
    'fieldError', 'itemDetails', 'submitCreateBatch', 'leadTimeForm', 'leadTimeErrors',
    'leadTimeSubmitting', 'submitCreateLeadTime', 'recordDeliveryDialogOpen', 'deliveryForm',
    'deliveryErrors', 'deliverySubmitting', 'submitRecordDelivery', 'barcodeScannerOpen',
    'barcodeInput', 'barcodeLookupLoading', 'barcodeLookupError', 'barcodeLookupResult',
    'onBarcodeKeydown', 'lookupBarcode',
    'transferForm', 'transferErrors', 'transferSubmitting', 'PRIORITY_OPTIONS', 'warehouses',
    'handleTransferLineItemChange', 'transferLineUsesBatchTracking', 'transferBatchLoadingByItemId',
    'transferLineBatches', 'batchOptionLabel', 'addTransferLine', 'removeTransferLine',
    'submitCreateTransfer', 'transferStatusDialogOpen', 'transferStatusForm',
    'transferStatusSelectedTransfer', 'transferStatusContextLoading', 'transferStatusErrors',
    'transferStatusSubmitting', 'onTransferStatusDialogOpenChange', 'submitTransferStatusUpdate',
    'transferDispatchNeedsRevalidation', 'transferLineLabel', 'formatTransferQuantity',
    'transferReservationStateLabel', 'transferReceiptVarianceType', 'transferReceiptVarianceNeedsDetails',
    'transferVarianceReviewDialogOpen', 'transferVarianceReviewForm', 'transferVarianceReviewSelectedTransfer',
    'transferVarianceReviewLoading', 'transferVarianceReviewErrors', 'transferVarianceReviewSubmitting',
    'onTransferVarianceReviewDialogOpenChange', 'submitTransferVarianceReview', 'transferVarianceReviewLines',
    'TRANSFER_RECEIPT_VARIANCE_OPTIONS',
    'createRequisitionDialogOpen', 'requisitionDepartmentHelperText', 'reqCreateErrors',
    'reqCreateSubmitting', 'reqForm', 'updateRequisitionDepartment', 'selectedRequisitionDepartment',
    'selectedRequisitionWarehouse', 'selectedRequisitionDepartmentId', 'REQUISITION_PRIORITIES',
    'handleReqLineItemSelected', 'addReqLine', 'removeReqLine', 'submitCreateRequisition',
    'procurementForm', 'procurementErrors', 'procurementSubmitting', 'procurementUsesExistingItem',
    'procurementLockedToSource', 'submitProcurementRequest',
    'createItemDialogOpen', 'hasCreateItemDraftContent', 'restoredCreateItemDraft', 'discardCreateItemDraft',
    'itemCreateForm', 'itemCreateErrors', 'itemCreateSubmitting', 'selectedCreateCategory',
    'createSubcategoryOptions', 'createClinicalCatalogOptions', 'createClinicalCatalogSelectionRequired',
    'selectClinicalCatalogItem', 'createCategoryWorkflowBadges', 'DOSAGE_FORM_OPTIONS',
    'storageConditionOptions', 'controlledSubstanceScheduleOptions', 'venClassificationOptions',
    'abcClassificationOptions', 'createItemWarehouseOpen', 'createItemSupplierOpen',
    'itemCreateRequestError', 'itemCreateValidationMessages', 'itemCreateSubmitReason',
    'itemCreateSubmitDisabled', 'submitCreateItem',
    'stockMovementDialogOpen', 'stockMovementSheetTitle', 'stockMovementSheetDescription',
    'stockMovementOpeningBalanceMode', 'stockMovementForm', 'stockMovementErrors', 'stockMovementSubmitting',
    'stockMovementSubcategoryOptions', 'stockMovementLookupBlockedReason', 'stockMovementCategoryLabel',
    'stockMovementSubcategoryLabel', 'stockMovementLookupHelperText', 'handleStockMovementItemSelected',
    'stockMovementItem', 'stockMovementSignedDelta', 'stockMovementProjectedNegative',
    'stockMovementProjectedStock', 'stockMovementProjectedState', 'stockMovementTypeMeta',
    'selectedStockMovementTypeMeta', 'requiresAdjustmentDirection', 'stockMovementUnitLabel',
    'stockMovementRequiresBatchSelection', 'stockMovementBatchesLoading', 'selectedStockMovementBatch',
    'stockMovementFilteredBatches', 'stockMovementRequiresBatchReceiptFields', 'stockMovementReasonRequired',
    'stockMovementReasonPlaceholder', 'stockMovementSubmitDisabled', 'stockMovementSubmitLabel',
    'submitStockMovement',
    'reconcileDialogOpen', 'stockReconciliationForm', 'stockReconciliationErrors',
    'stockReconciliationSubmitting', 'handleStockReconciliationItemSelected',
    'stockReconciliationUsesBatchTracking', 'stockReconciliationBatchesLoading',
    'selectedStockReconciliationBatch', 'stockReconciliationBatchOptions', 'stockReconciliationSubmitDisabled',
    'submitStockReconciliation',
    'requisitionDetailsOpen', 'onRequisitionDetailsOpenChange', 'selectedRequisition',
    'requisitionStatusHelper', 'requisitionLineItemLabel', 'requisitionLineDecisionDraft',
    'requisitionLineAvailableStock', 'requisitionLineIssueProblem', 'requisitionLineShortageSummary',
    'requisitionApprovedDecisionQuantity', 'requisitionIssuedDecisionQuantity',
    'openProcurementFromRequisitionShortage', 'selectedRequisitionIssueBlockingProblems',
    'selectedRequisitionHasAnyAdditionalIssue', 'selectedRequisitionIssueShortageSummaries',
    'selectedRequisitionIssueUnavailableReason', 'requisitionStatusSubmitting',
    'selectedRequisitionIssueBlockedReason', 'confirmSelectedRequisitionIssue',
    'selectedRequisitionIssueTargetStatus',
    'placeOrderDialogOpen', 'placeOrderRequest', 'placeOrderForm', 'placeOrderErrors',
    'placeOrderError', 'placeOrderSubmitting', 'submitPlaceOrder',
    'receiveDialogOpen', 'receiveRequest', 'receiveForm', 'receiveErrors', 'receiveError',
    'receiveSubmitting', 'receiveRequiresBatchTracking', 'receiveTrackedCategory', 'submitReceiveGoods',
    'statusDialogOpen', 'statusRequest', 'statusValue', 'statusReason', 'statusError',
    'statusSubmitting', 'procurementManualStatusOptions', 'submitStatusUpdate',
    'detailsOpen', 'detailsRequest', 'canViewAudit', 'detailsAuditFilters', 'detailsAuditLoading',
    'detailsAuditExporting', 'detailsAuditError', 'detailsAuditLogs', 'detailsAuditMeta',
    'applyDetailsAuditFilters', 'resetDetailsAuditFilters', 'exportDetailsAuditLogsCsv',
    'auditActorLabel', 'goToDetailsAuditPage',
    'itemDetailsOpen', 'itemDetailsLoading', 'itemDetailsError', 'itemDetailsTab',
    'itemDetailsSummaryCards', 'itemUpdateForm', 'itemUpdateErrors', 'itemUpdateSubmitting',
    'selectedUpdateCategory', 'updateSubcategoryOptions', 'updateClinicalCatalogOptions',
    'updateCategoryWorkflowBadges', 'updateItemWarehouseOpen', 'updateItemSupplierOpen',
    'submitItemUpdate', 'itemStatusForm', 'itemStatusOptions', 'itemStatusSubmitting',
    'itemStatusError', 'submitItemStatus', 'itemBatches', 'itemBatchesLoading',
    'loadItemBatches', 'expiryBadgeClass', 'clinicalCatalogLabel', 'itemAuditFilters',
    'itemAuditLoading', 'itemAuditError', 'itemAuditExporting', 'itemAuditLogs',
    'itemAuditMeta', 'applyItemAuditFilters', 'resetItemAuditFilters',
    'exportItemAuditLogsCsv', 'goToItemAuditPage',
    'claimLinkForm', 'claimLinkErrors', 'claimLinkSubmitting', 'claimLinkPatientContextLabel',
    'claimLinkPatientContextMeta', 'claimLinkItemContextLabel', 'claimLinkItemContextMeta',
    'claimLinkWorkflowContextMeta', 'claimLinkWorkflowContextLabel', 'claimLinkContextStatusLabel',
    'claimLinkContextStatusVariant', 'handleClaimLinkItemSelected', 'handleClaimLinkClaimsCaseSelected',
    'handleClaimLinkInvoiceSelected', 'submitCreateClaimLink',
    'createMsdOrderDialogOpen', 'msdOrderForm', 'msdOrderErrors', 'msdOrderSubmitting',
    'addMsdOrderLine', 'removeMsdOrderLine', 'submitCreateMsdOrder',
}, key=len, reverse=True)

CLAIMS_MSD_SHEET_MARKERS = [
    '<!-- Create Dispensing Claim Link Dialog (Feature 5) -->',
    '<!-- Create MSD Order Dialog (Feature 6) -->',
]

CLAIMS_MSD_SHEET_IMPORTS = [
    "import BillingInvoiceLookupField from '@/components/billing/BillingInvoiceLookupField.vue';",
    "import ClaimsInsuranceCaseLookupField from '@/components/claims/ClaimsInsuranceCaseLookupField.vue';",
    "import ClinicalContextBanner from '@/components/domain/clinical/ClinicalContextBanner.vue';",
    "import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';",
    "import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';",
    "import PatientLookupField from '@/components/patients/PatientLookupField.vue';",
    "import { Button } from '@/components/ui/button';",
    "import { Input } from '@/components/ui/input';",
    "import { Label } from '@/components/ui/label';",
    "import { ScrollArea } from '@/components/ui/scroll-area';",
    "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
    "import { Separator } from '@/components/ui/separator';",
    "import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';",
    "import { Textarea } from '@/components/ui/textarea';",
    "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
]

ITEM_DETAILS_SHEET_MARKERS = [
    '<!-- Inventory Item Details Sheet -->',
]

ITEM_DETAILS_SHEET_IMPORTS = [
    "import AppIcon from '@/components/AppIcon.vue';",
    "import FormFieldShell from '@/components/forms/FormFieldShell.vue';",
    "import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';",
    "import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';",
    "import { Badge } from '@/components/ui/badge';",
    "import { Button } from '@/components/ui/button';",
    "import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';",
    "import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';",
    "import { Input } from '@/components/ui/input';",
    "import { Label } from '@/components/ui/label';",
    "import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';",
    "import { ScrollArea } from '@/components/ui/scroll-area';",
    "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
    "import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';",
    "import { Skeleton } from '@/components/ui/skeleton';",
    "import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';",
    "import { formatEnumLabel } from '@/lib/labels';",
    "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
]

PROCUREMENT_LIFECYCLE_SHEET_MARKERS = [
    '<!-- Place Purchase Order Dialog -->',
    '<!-- Receive Goods Dialog -->',
    '<!-- Update Procurement Status Dialog -->',
    '<!-- Procurement Request Details Dialog -->',
]

PROCUREMENT_LIFECYCLE_SHEET_IMPORTS = [
    "import AppIcon from '@/components/AppIcon.vue';",
    "import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';",
    "import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';",
    "import { Badge } from '@/components/ui/badge';",
    "import { Button } from '@/components/ui/button';",
    "import { Input } from '@/components/ui/input';",
    "import { Label } from '@/components/ui/label';",
    "import { ScrollArea } from '@/components/ui/scroll-area';",
    "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
    "import { Separator } from '@/components/ui/separator';",
    "import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';",
    "import { Textarea } from '@/components/ui/textarea';",
    "import { formatEnumLabel } from '@/lib/labels';",
    "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
]

REQUISITION_DETAILS_SHEET_MARKERS = [
    '<!-- Department Requisition Details -->',
]

REQUISITION_DETAILS_SHEET_IMPORTS = [
    "import AppIcon from '@/components/AppIcon.vue';",
    "import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';",
    "import { Badge } from '@/components/ui/badge';",
    "import { Button } from '@/components/ui/button';",
    "import { Input } from '@/components/ui/input';",
    "import { ScrollArea } from '@/components/ui/scroll-area';",
    "import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';",
    "import { formatEnumLabel } from '@/lib/labels';",
    "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
]

INVENTORY_OPS_SHEET_MARKERS = [
    '<!-- Create Inventory Item Dialog -->',
    '<!-- Record Stock Movement Dialog -->',
    '<!-- Reconcile Stock Count Dialog -->',
]

INVENTORY_OPS_SHEET_IMPORTS = [
    "import { Link } from '@inertiajs/vue3';",
    "import AppIcon from '@/components/AppIcon.vue';",
    "import ComboboxField from '@/components/forms/ComboboxField.vue';",
    "import FormFieldShell from '@/components/forms/FormFieldShell.vue';",
    "import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';",
    "import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';",
    "import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';",
    "import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';",
    "import { Badge } from '@/components/ui/badge';",
    "import { Button } from '@/components/ui/button';",
    "import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';",
    "import { Input } from '@/components/ui/input';",
    "import { Label } from '@/components/ui/label';",
    "import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';",
    "import { ScrollArea } from '@/components/ui/scroll-area';",
    "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
    "import { Separator } from '@/components/ui/separator';",
    "import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';",
    "import { Textarea } from '@/components/ui/textarea';",
    "import { formatEnumLabel } from '@/lib/labels';",
    "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
]

REQUEST_ENTRY_SHEET_MARKERS = [
    '<!-- Create Department Requisition Dialog -->',
    '<!-- Create Procurement Request Dialog -->',
]

REQUEST_ENTRY_SHEET_IMPORTS = [
    "import AppIcon from '@/components/AppIcon.vue';",
    "import FormFieldShell from '@/components/forms/FormFieldShell.vue';",
    "import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';",
    "import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';",
    "import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';",
    "import { Button } from '@/components/ui/button';",
    "import { Input } from '@/components/ui/input';",
    "import { Label } from '@/components/ui/label';",
    "import { ScrollArea } from '@/components/ui/scroll-area';",
    "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
    "import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';",
    "import { Textarea } from '@/components/ui/textarea';",
    "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
]

TRANSFER_SHEET_MARKERS = [
    '<!-- Create Warehouse Transfer Dialog -->',
    '<!-- Update Transfer Status Dialog -->',
]

TRANSFER_SHEET_IMPORTS = [
    "import AppIcon from '@/components/AppIcon.vue';",
    "import { Badge } from '@/components/ui/badge';",
    "import { Button } from '@/components/ui/button';",
    "import { Input } from '@/components/ui/input';",
    "import { Label } from '@/components/ui/label';",
    "import { ScrollArea } from '@/components/ui/scroll-area';",
    "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
    "import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';",
    "import { Textarea } from '@/components/ui/textarea';",
    "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
]

AUX_SHEET_MARKERS = [
    '<!-- Create Batch Dialog -->',
    '<!-- Record Lead Time Dialog -->',
    '<!-- Record Delivery Dialog -->',
    '<!-- Barcode Scanner Dialog (Feature 7) -->',
]

AUX_SHEET_IMPORTS = [
    "import AppIcon from '@/components/AppIcon.vue';",
    "import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';",
    "import { Alert, AlertDescription } from '@/components/ui/alert';",
    "import { Badge } from '@/components/ui/badge';",
    "import { Button } from '@/components/ui/button';",
    "import { Card, CardContent } from '@/components/ui/card';",
    "import { Input } from '@/components/ui/input';",
    "import { Label } from '@/components/ui/label';",
    "import { ScrollArea } from '@/components/ui/scroll-area';",
    "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
    "import { Separator } from '@/components/ui/separator';",
    "import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';",
    "import { formatEnumLabel } from '@/lib/labels';",
    "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
]

OVERLAY_IMPORTS = [
    "import AppIcon from '@/components/AppIcon.vue';",
    "import { Button } from '@/components/ui/button';",
    "import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';",
    "import { Input } from '@/components/ui/input';",
    "import { Label } from '@/components/ui/label';",
    "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';",
    "import { Separator } from '@/components/ui/separator';",
    "import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';",
    "import { formatEnumLabel } from '@/lib/labels';",
    "import { useInventoryWorkspace } from './inventoryWorkspaceApi';",
]

SKIP_WS_PREFIX = {
    'true', 'false', 'null', 'undefined', 'String', 'Number', 'Math', 'Date', 'Array', 'Object',
    'typeof', 'new', 'if', 'else', 'template', 'slot', 'key', 'class', 'style', 'name', 'type',
    'button', 'span', 'div', 'p', 'input', 'option', 'value', 'label', 'icon', 'variant', 'size',
    'align', 'as-child', 'aria-label', 'title', 'placeholder', 'disabled', 'id', 'for', 'rows',
    'cols', 'sm', 'md', 'lg', 'xl', 'flex', 'grid', 'gap', 'px', 'py', 'mt', 'mb', 'ml', 'mr',
    'min', 'max', 'w', 'h', 'text', 'bg', 'border', 'rounded', 'shadow', 'ring', 'inset', 'dark',
    'hover', 'focus', 'active', 'group', 'transition', 'opacity', 'truncate', 'shrink', 'self',
    'items', 'justify', 'center', 'start', 'end', 'between', 'wrap', 'col', 'row', 'relative',
    'absolute', 'inset', 'left', 'right', 'top', 'bottom', 'font', 'semibold', 'medium', 'bold',
    'mono', 'xs', 'sm', 'base', 'xl', 'leading', 'tracking', 'uppercase', 'capitalize', 'normal',
    'muted', 'foreground', 'primary', 'destructive', 'secondary', 'outline', 'default', 'ghost',
    'card', 'sidebar', 'amber', 'green', 'blue', 'red', 'sky', 'emerald', 'orange', 'destructive',
    'AppIcon', 'Badge', 'Button', 'Card', 'CardContent', 'CardHeader', 'CardTitle', 'CardDescription',
    'SearchInput', 'Select', 'SelectTrigger', 'SelectContent', 'SelectItem', 'SelectValue',
    'WorkflowQueueRow', 'WorkflowQueueSkeleton', 'RegistryListRow', 'RegistryListSkeleton',
    'InventoryEmptyState', 'DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuContent',
    'DropdownMenuItem', 'ScrollArea', 'Label', 'Transition', 'formatEnumLabel',
    'departmentRequisitionStripeClass', 'shortageReadinessStripeClass', 'procurementRequestStripeClass',
    'req', 'request', 'item', 'row', 't', 'line', 'order', 'link', 'lt', 'pg', 'chip', 'signal',
    'act', 's', 'dept', 'department', 'opt', 'ns', 'key', 'index', 'n', 'pg', 'chip', 'signal',
    'ready', 'waiting', 'all', 'off', '30s', '1m', '5m', 'createdAt', 'neededBy', 'requestedQuantity',
    'status', 'supplierName', 'Prev', 'Next', 'Previous', 'Details', 'View', 'Issue', 'Procure',
    'Refresh', 'Search', 'Filters', 'Apply', 'Reset', 'Clear', 'Create', 'Show', 'Opening',
    'source_warehouse_id', 'destination_warehouse_id', 'transfer_number', 'created_at', 'claim_status',
    'nhif_code', 'payer_name', 'payer_type', 'quantity_dispensed', 'unit', 'item_id', 'patient_id',
    'created_at', 'order_date', 'actual_delivery_date', 'expected_delivery_date', 'delivery_status',
    'pending', 'draft', 'submitted', 'approved', 'issued', 'cancelled', 'rejected', 'ordered',
    'received', 'partially_issued', 'urgent', 'high', 'ready', 'waiting', 'n/a', 'PRQ', 'Dept',
    'shortage', 'payer', 'TZS', 'N/A', 'Store', 'Qty', 'Unit', 'Total', 'Needed', 'Page', 'Showing',
    'results', 'total', 'of', 'lines', 'line', 'movement', 'movements', 'Overdue', 'Needed',
    'warehouse', 'layers', 'clock', 'calendar', 'arrow-right', 'check', 'check-circle', 'alert-circle',
    'alert-triangle', 'package', 'clipboard-list', 'activity', 'list', 'clock', 'search', 'refresh-cw',
    'chevron-left', 'chevron-right', 'plus', 'x', 'sliders-horizontal', 'ellipsis-vertical',
    'building-2', 'pencil', 'shield-check', 'layout-list', 'info', 'lock', 'file-text', 'circle-x',
    'inventory', 'procurement', 'requisitions', 'shortage-queue', 'transfers', 'department-stock',
    'msd-orders', 'lead-times', 'claims', 'analytics', 'overview', 'ledger', 'consumption',
    'classification', 'expiry', 'turnover', 'maintenance', 'stock', 'layout-grid', 'log-in',
    'arrow-up-right', 'review', 'sync', 'pick', 'slip', 'dispatch', 'note', 'variance', 'reviewed',
    'partial', 'all', 'ready', 'waiting', 'clear', 'item', 'trace', 'permission', 'restricted',
    'access', 'code', 'inventory.procurement.read', 'Request', 'error', 'Dept', 'shortage',
    'Source', 'Req', 'Opening', 'est', 'est.', 'Total', 'est', 'Unit', 'est', 'Source', 'Req',
    'Opening...', 'Source', 'Req.', 'Dept', 'shortage', 'Partial', 'All', 'ready', 'Waiting',
    'View', 'Issue', 'now', 'Procure', 'Show', 'ready', 'Retry', 'Failed', 'load', 'shortage',
    'queue', 'Stock', 'received', 'may', 'now', 'be', 'fulfillable', 'check', 'the', 'below',
    'In', 'queue', 'Ready', 'to', 'issue', 'Awaiting', 'stock', 'All', 'statuses', 'All',
    'departments', 'Search', 'requisition', 'or', 'department', 'No', 'items', 'are', 'ready',
    'to', 'issue', 'Nothing', 'waiting', 'for', 'stock', 'Shortage', 'queue', 'is', 'clear',
    'Stock', 'for', 'pending', 'lines', 'hasn', 't', 'arrived', 'yet', 'Switch', 'to', 'Waiting',
    'to', 'see', 'what', 's', 'outstanding', 'All', 'pending', 'lines', 'have', 'sufficient',
    'stock', 'available', 'All', 'partially', 'issued', 'requisitions', 'have', 'been',
    'fulfilled', 'or', 'none', 'exist', 'yet', 'Internal', 'requests', 'from', 'hospital',
    'departments', 'for', 'inventory', 'items', 'New', 'Requisition', 'Req', 'department',
    'Warehouse', 'Transfers', 'Inter-store', 'stock', 'movement', 'pick', 'dispatch', 'and',
    'receipt', 'tracking', 'New', 'Transfer', 'transfer', 'number', 'Review', 'queue', 'No',
    'warehouse', 'transfers', 'found', 'Transfers', 'appear', 'after', 'stock', 'is',
    'requested', 'packed', 'dispatched', 'and', 'received', 'between', 'store', 'locations',
    'Inventory', 'Items', 'Physical', 'stock', 'master', 'with', 'category', 'reorder', 'policy',
    'opening', 'stock', 'and', 'warehouse', 'operations', 'Auto', 'Create', 'Item', 'Item',
    'code', 'name', 'category', 'No', 'inventory', 'items', 'found', 'Register', 'the', 'first',
    'physical', 'stock', 'item', 'here', 'after', 'warehouses', 'and', 'suppliers', 'are',
    'ready', 'Medicines', 'should', 'already', 'exist', 'in', 'Clinical', 'Care', 'Catalog',
    'before', 'you', 'link', 'them', 'to', 'inventory', 'Create', 'first', 'item', 'View',
    'details', 'Where', 'issued', 'Edit', 'Status', 'More', 'item', 'actions', 'Department',
    'Stock', 'Stock', 'issued', 'out', 'of', 'the', 'store', 'and', 'held', 'by', 'departments',
    'for', 'local', 'use', 'Hide', 'filters', 'Department', 'item', 'category', 'warehouse',
    'Applying', 'Store', 'stock', 'and', 'department', 'stock', 'are', 'intentionally',
    'separate', 'This', 'view', 'shows', 'where', 'issued', 'stock', 'went', 'consumption',
    'returns', 'and', 'wastage', 'come', 'in', 'the', 'next', 'operational', 'layer', 'No',
    'department', 'stock', 'recorded', 'yet', 'Department', 'stock', 'appears', 'after', 'a',
    'requisition', 'is', 'issued', 'from', 'the', 'store', 'to', 'a', 'department', 'View',
    'item', 'Department', 'stock', 'access', 'is', 'permission', 'restricted', 'Access',
    'restricted', 'permission', 'Procurement', 'Requests', 'Track', 'supplier', 'orders',
    'from', 'request', 'through', 'receipt', 'Filters', 'New', 'Request', 'Request', 'number',
    'supplier', 'item', 'Sort', 'by', 'Created', 'Quantity', 'Supplier', 'No', 'requests',
    'match', 'the', 'current', 'filters', 'No', 'procurement', 'requests', 'yet', 'Try',
    'adjusting', 'or', 'clearing', 'your', 'filters', 'Create', 'requests', 'after', 'stock',
    'demand', 'or', 'low-stock', 'need', 'is', 'identified', 'Clear', 'filters', 'Create',
    'request', 'Details', 'Source', 'Req', 'Opening...', 'Prev', 'Next',
}

def prefix_bindings(template: str) -> str:
    for binding in BINDINGS:
        if binding in SKIP_WS_PREFIX:
            continue
        template = re.sub(
            rf'(?<!ws\.)(?<![\w.]){re.escape(binding)}\b',
            f'ws.{binding}',
            template,
        )
    # undo double prefixes and import/helper false positives
    template = template.replace('ws.ws.', 'ws.')
    template = template.replace('ws.formatEnumLabel', 'formatEnumLabel')
    template = template.replace('ws.departmentRequisitionStripeClass', 'departmentRequisitionStripeClass')
    template = template.replace('ws.shortageReadinessStripeClass', 'shortageReadinessStripeClass')
    template = template.replace('ws.procurementRequestStripeClass', 'procurementRequestStripeClass')
    template = template.replace('ws.AppIcon', 'AppIcon')
    template = template.replace('ws.Badge', 'Badge')
    template = template.replace('ws.Button', 'Button')
    template = template.replace('ws.Card', 'Card')
    template = template.replace('ws.CardContent', 'CardContent')
    template = template.replace('ws.CardHeader', 'CardHeader')
    template = template.replace('ws.CardTitle', 'CardTitle')
    template = template.replace('ws.CardDescription', 'CardDescription')
    template = template.replace('ws.SearchInput', 'SearchInput')
    template = template.replace('ws.Select', 'Select')
    template = template.replace('ws.SelectTrigger', 'SelectTrigger')
    template = template.replace('ws.SelectContent', 'SelectContent')
    template = template.replace('ws.SelectItem', 'SelectItem')
    template = template.replace('ws.SelectValue', 'SelectValue')
    template = template.replace('ws.WorkflowQueueRow', 'WorkflowQueueRow')
    template = template.replace('ws.WorkflowQueueSkeleton', 'WorkflowQueueSkeleton')
    template = template.replace('ws.RegistryListRow', 'RegistryListRow')
    template = template.replace('ws.RegistryListSkeleton', 'RegistryListSkeleton')
    template = template.replace('ws.InventoryEmptyState', 'InventoryEmptyState')
    template = template.replace('ws.DropdownMenu', 'DropdownMenu')
    template = template.replace('ws.DropdownMenuTrigger', 'DropdownMenuTrigger')
    template = template.replace('ws.DropdownMenuContent', 'DropdownMenuContent')
    template = template.replace('ws.DropdownMenuItem', 'DropdownMenuItem')
    template = template.replace('ws.ScrollArea', 'ScrollArea')
    template = template.replace('ws.Label', 'Label')
    template = template.replace('ws.Input', 'Input')
    template = template.replace('ws.Separator', 'Separator')
    template = template.replace('ws.Sheet', 'Sheet')
    template = template.replace('ws.SheetContent', 'SheetContent')
    template = template.replace('ws.SheetDescription', 'SheetDescription')
    template = template.replace('ws.SheetFooter', 'SheetFooter')
    template = template.replace('ws.SheetHeader', 'SheetHeader')
    template = template.replace('ws.SheetTitle', 'SheetTitle')
    template = template.replace('ws.Drawer', 'Drawer')
    template = template.replace('ws.DrawerContent', 'DrawerContent')
    template = template.replace('ws.DrawerDescription', 'DrawerDescription')
    template = template.replace('ws.DrawerFooter', 'DrawerFooter')
    template = template.replace('ws.DrawerHeader', 'DrawerHeader')
    template = template.replace('ws.DrawerTitle', 'DrawerTitle')
    template = template.replace('ws.Textarea', 'Textarea')
    template = template.replace('ws.SingleDatePopoverField', 'SingleDatePopoverField')
    template = template.replace('ws.AlertDescription', 'AlertDescription')
    template = template.replace('ws.AlertTitle', 'AlertTitle')
    template = template.replace('ws.Alert', 'Alert')
    template = template.replace('ws.FormFieldShell', 'FormFieldShell')
    template = template.replace('ws.ComboboxField', 'ComboboxField')
    template = template.replace('ws.SearchableSelectField', 'SearchableSelectField')
    template = template.replace('ws.InventoryItemLookupField', 'InventoryItemLookupField')
    template = template.replace('ws.ClinicalContextBanner', 'ClinicalContextBanner')
    template = template.replace('ws.BillingInvoiceLookupField', 'BillingInvoiceLookupField')
    template = template.replace('ws.ClaimsInsuranceCaseLookupField', 'ClaimsInsuranceCaseLookupField')
    template = template.replace('ws.PatientLookupField', 'PatientLookupField')
    template = template.replace('ws.Link', 'Link')
    template = template.replace('ws.Popover', 'Popover')
    template = template.replace('ws.PopoverTrigger', 'PopoverTrigger')
    template = template.replace('ws.PopoverContent', 'PopoverContent')
    template = template.replace('ws.Command', 'Command')
    template = template.replace('ws.CommandInput', 'CommandInput')
    template = template.replace('ws.CommandList', 'CommandList')
    template = template.replace('ws.CommandEmpty', 'CommandEmpty')
    template = template.replace('ws.CommandGroup', 'CommandGroup')
    template = template.replace('ws.CommandItem', 'CommandItem')
    template = template.replace('ws.Skeleton', 'Skeleton')
    template = template.replace('ws.Transition', 'Transition')
    template = template.replace('ws.Tabs', 'Tabs')
    template = template.replace('ws.TabsContent', 'TabsContent')
    template = template.replace('ws.TabsList', 'TabsList')
    template = template.replace('ws.TabsTrigger', 'TabsTrigger')
    template = template.replace('ws.stockMovementStripeClass', 'stockMovementStripeClass')
    # bindings skipped to protect Tailwind `items-*` classes
    template = template.replace('inventory ws.items', 'inventory items')
    template = re.sub(r'(?<!ws\.)(?<![\w.])items\b(?!\s*[-:])', 'ws.items', template)
    template = re.sub(r'(?<!ws\.)(?<![\w.])transfers\b', 'ws.transfers', template)
    template = re.sub(r'(?<!ws\.)(?<![\w.])stockMovements\b', 'ws.stockMovements', template)
    template = re.sub(r'v-for="dept in departments"', 'v-for="dept in ws.departments"', template)
    template = template.replace('...consumptionTrends.map', '...ws.consumptionTrends.map')
    template = re.sub(r'\(suppliers \?\? \[\]\)', '(ws.suppliers ?? [])', template)
    template = re.sub(r'\(ws\.suppliers \?\? \[\]\)', '(ws.suppliers ?? [])', template)
    template = re.sub(r'\(warehouses \?\? \[\]\)', '(ws.warehouses ?? [])', template)
    template = re.sub(
        r'v-for="department in requisitionDepartmentOptions"',
        'v-for="department in ws.requisitionDepartmentOptions"',
        template,
    )
    template = re.sub(
        r'v-for="warehouse in warehouses"',
        'v-for="warehouse in ws.warehouses"',
        template,
    )
    template = re.sub(
        r'v-for="s in suppliers"',
        'v-for="s in ws.suppliers"',
        template,
    )
    template = re.sub(
        r'v-for="supplier in suppliers"',
        'v-for="supplier in ws.suppliers"',
        template,
    )
    template = re.sub(
        r'v-for="w in warehouses"',
        'v-for="w in ws.warehouses"',
        template,
    )
    template = re.sub(
        r'v-for="batch in itemBatches"',
        'v-for="batch in ws.itemBatches"',
        template,
    )
    template = re.sub(
        r'v-for="log in itemAuditLogs"',
        'v-for="log in ws.itemAuditLogs"',
        template,
    )
    template = re.sub(
        r'v-for="card in itemDetailsSummaryCards"',
        'v-for="card in ws.itemDetailsSummaryCards"',
        template,
    )
    return template

def build_component(name: str, inner: str) -> str:
    imports = '\n'.join(TAB_IMPORTS[name])
    body = prefix_bindings(inner.strip())
    return (
        '<script setup lang="ts">\n'
        f'{imports}\n\n'
        'const ws = useInventoryWorkspace();\n'
        '</script>\n\n'
        '<template>\n'
        f'{body}\n'
        '</template>\n'
    )

def extract_tab(content: str, value: str) -> tuple[str, str]:
    if value == 'analytics':
        pattern = (
            r'<TabsContent value="analytics" class="mt-0 flex flex-col gap-4">'
            r'(.*?</Tabs>)'
            r'\s*</TabsContent>'
        )
    else:
        pattern = (
            rf'<TabsContent value="{re.escape(value)}" class="mt-0 flex flex-col gap-4">'
            r'(.*?)'
            r'</TabsContent>'
        )
    match = re.search(pattern, content, flags=re.DOTALL)
    if not match:
        raise SystemExit(f'Tab not found: {value}')
    inner = match.group(1)
    full = match.group(0)
    return inner, full

def extract_sheet_block(content: str, comment: str) -> tuple[str, str]:
    pattern = rf'    {re.escape(comment)}\s*\n(    <Sheet.*?</Sheet>)'
    match = re.search(pattern, content, flags=re.DOTALL)
    if not match:
        raise SystemExit(f'Sheet block not found: {comment}')
    return match.group(0), match.group(1)


def extract_auxiliary_sheets() -> None:
    content = WORKSPACE.read_text(encoding='utf-8')
    sheet_bodies: list[str] = []
    for comment in AUX_SHEET_MARKERS:
        full, body = extract_sheet_block(content, comment)
        sheet_bodies.append(body.strip())
        content = content.replace(full, '', 1)

    combined = '\n\n'.join(sheet_bodies)
    body = prefix_bindings(combined)
    imports = '\n'.join(AUX_SHEET_IMPORTS)
    component = (
        '<script setup lang="ts">\n'
        f'{imports}\n\n'
        'const ws = useInventoryWorkspace();\n'
        '</script>\n\n'
        '<template>\n'
        f'{body}\n'
        '</template>\n'
    )
    OUT_DIR.joinpath('WorkspaceAuxiliarySheets.vue').write_text(component, encoding='utf-8')
    insert_after = '    </AppLayout>\n'
    if insert_after not in content:
        raise SystemExit('AppLayout closing tag not found')
    content = content.replace(
        insert_after,
        insert_after + '\n    <WorkspaceAuxiliarySheets />\n',
        1,
    )
    import_line = "import WorkspaceAuxiliarySheets from '@/pages/inventory-procurement/workspace/WorkspaceAuxiliarySheets.vue';"
    if import_line not in content:
        marker = "import WorkspaceFilterOverlays from '@/pages/inventory-procurement/workspace/WorkspaceFilterOverlays.vue';"
        content = content.replace(marker, marker + '\n' + import_line, 1)
    WORKSPACE.write_text(content, encoding='utf-8')
    print('extracted WorkspaceAuxiliarySheets')
    print('updated Workspace.vue')


def extract_claims_msd_sheets() -> None:
    content = WORKSPACE.read_text(encoding='utf-8')
    sheet_bodies: list[str] = []
    for comment in CLAIMS_MSD_SHEET_MARKERS:
        full, body = extract_sheet_block(content, comment)
        sheet_bodies.append(body.strip())
        content = content.replace(full, '', 1)

    combined = '\n\n'.join(sheet_bodies)
    body = prefix_bindings(combined)
    imports = '\n'.join(CLAIMS_MSD_SHEET_IMPORTS)
    component = (
        '<script setup lang="ts">\n'
        f'{imports}\n\n'
        'const ws = useInventoryWorkspace();\n'
        '</script>\n\n'
        '<template>\n'
        f'{body}\n'
        '</template>\n'
    )
    OUT_DIR.joinpath('WorkspaceClaimsAndMsdSheets.vue').write_text(component, encoding='utf-8')
    insert_marker = '    <WorkspaceItemDetailsSheet />\n'
    if insert_marker not in content:
        raise SystemExit('WorkspaceItemDetailsSheet marker not found')
    content = content.replace(
        insert_marker,
        insert_marker + '    <WorkspaceClaimsAndMsdSheets />\n',
        1,
    )
    import_line = "import WorkspaceClaimsAndMsdSheets from '@/pages/inventory-procurement/workspace/WorkspaceClaimsAndMsdSheets.vue';"
    if import_line not in content:
        marker = "import WorkspaceItemDetailsSheet from '@/pages/inventory-procurement/workspace/WorkspaceItemDetailsSheet.vue';"
        content = content.replace(marker, marker + '\n' + import_line, 1)
    WORKSPACE.write_text(content, encoding='utf-8')
    print('extracted WorkspaceClaimsAndMsdSheets')
    print('updated Workspace.vue')


def extract_item_details_sheet() -> None:
    content = WORKSPACE.read_text(encoding='utf-8')
    sheet_bodies: list[str] = []
    for comment in ITEM_DETAILS_SHEET_MARKERS:
        full, body = extract_sheet_block(content, comment)
        sheet_bodies.append(body.strip())
        content = content.replace(full, '', 1)

    combined = '\n\n'.join(sheet_bodies)
    body = prefix_bindings(combined)
    imports = '\n'.join(ITEM_DETAILS_SHEET_IMPORTS)
    component = (
        '<script setup lang="ts">\n'
        f'{imports}\n\n'
        'const ws = useInventoryWorkspace();\n'
        '</script>\n\n'
        '<template>\n'
        f'{body}\n'
        '</template>\n'
    )
    OUT_DIR.joinpath('WorkspaceItemDetailsSheet.vue').write_text(component, encoding='utf-8')
    insert_marker = '    <WorkspaceProcurementLifecycleSheets />\n'
    if insert_marker not in content:
        raise SystemExit('WorkspaceProcurementLifecycleSheets marker not found')
    content = content.replace(
        insert_marker,
        insert_marker + '    <WorkspaceItemDetailsSheet />\n',
        1,
    )
    import_line = "import WorkspaceItemDetailsSheet from '@/pages/inventory-procurement/workspace/WorkspaceItemDetailsSheet.vue';"
    if import_line not in content:
        marker = "import WorkspaceProcurementLifecycleSheets from '@/pages/inventory-procurement/workspace/WorkspaceProcurementLifecycleSheets.vue';"
        content = content.replace(marker, marker + '\n' + import_line, 1)
    WORKSPACE.write_text(content, encoding='utf-8')
    print('extracted WorkspaceItemDetailsSheet')
    print('updated Workspace.vue')


def extract_procurement_lifecycle_sheets() -> None:
    content = WORKSPACE.read_text(encoding='utf-8')
    sheet_bodies: list[str] = []
    for comment in PROCUREMENT_LIFECYCLE_SHEET_MARKERS:
        full, body = extract_sheet_block(content, comment)
        sheet_bodies.append(body.strip())
        content = content.replace(full, '', 1)

    combined = '\n\n'.join(sheet_bodies)
    body = prefix_bindings(combined)
    imports = '\n'.join(PROCUREMENT_LIFECYCLE_SHEET_IMPORTS)
    component = (
        '<script setup lang="ts">\n'
        f'{imports}\n\n'
        'const ws = useInventoryWorkspace();\n'
        '</script>\n\n'
        '<template>\n'
        f'{body}\n'
        '</template>\n'
    )
    OUT_DIR.joinpath('WorkspaceProcurementLifecycleSheets.vue').write_text(component, encoding='utf-8')
    insert_marker = '    <WorkspaceRequisitionDetailsSheet />\n'
    if insert_marker not in content:
        raise SystemExit('WorkspaceRequisitionDetailsSheet marker not found')
    content = content.replace(
        insert_marker,
        insert_marker + '    <WorkspaceProcurementLifecycleSheets />\n',
        1,
    )
    import_line = "import WorkspaceProcurementLifecycleSheets from '@/pages/inventory-procurement/workspace/WorkspaceProcurementLifecycleSheets.vue';"
    if import_line not in content:
        marker = "import WorkspaceRequisitionDetailsSheet from '@/pages/inventory-procurement/workspace/WorkspaceRequisitionDetailsSheet.vue';"
        content = content.replace(marker, marker + '\n' + import_line, 1)
    WORKSPACE.write_text(content, encoding='utf-8')
    print('extracted WorkspaceProcurementLifecycleSheets')
    print('updated Workspace.vue')


def extract_requisition_details_sheet() -> None:
    content = WORKSPACE.read_text(encoding='utf-8')
    sheet_bodies: list[str] = []
    for comment in REQUISITION_DETAILS_SHEET_MARKERS:
        full, body = extract_sheet_block(content, comment)
        sheet_bodies.append(body.strip())
        content = content.replace(full, '', 1)

    combined = '\n\n'.join(sheet_bodies)
    body = prefix_bindings(combined)
    imports = '\n'.join(REQUISITION_DETAILS_SHEET_IMPORTS)
    component = (
        '<script setup lang="ts">\n'
        f'{imports}\n\n'
        'const ws = useInventoryWorkspace();\n'
        '</script>\n\n'
        '<template>\n'
        f'{body}\n'
        '</template>\n'
    )
    OUT_DIR.joinpath('WorkspaceRequisitionDetailsSheet.vue').write_text(component, encoding='utf-8')
    insert_marker = '    <WorkspaceInventoryOpsSheets />\n'
    if insert_marker not in content:
        raise SystemExit('WorkspaceInventoryOpsSheets marker not found')
    content = content.replace(
        insert_marker,
        insert_marker + '    <WorkspaceRequisitionDetailsSheet />\n',
        1,
    )
    import_line = "import WorkspaceRequisitionDetailsSheet from '@/pages/inventory-procurement/workspace/WorkspaceRequisitionDetailsSheet.vue';"
    if import_line not in content:
        marker = "import WorkspaceInventoryOpsSheets from '@/pages/inventory-procurement/workspace/WorkspaceInventoryOpsSheets.vue';"
        content = content.replace(marker, marker + '\n' + import_line, 1)
    WORKSPACE.write_text(content, encoding='utf-8')
    print('extracted WorkspaceRequisitionDetailsSheet')
    print('updated Workspace.vue')


def extract_inventory_ops_sheets() -> None:
    content = WORKSPACE.read_text(encoding='utf-8')
    sheet_bodies: list[str] = []
    for comment in INVENTORY_OPS_SHEET_MARKERS:
        full, body = extract_sheet_block(content, comment)
        sheet_bodies.append(body.strip())
        content = content.replace(full, '', 1)

    combined = '\n\n'.join(sheet_bodies)
    body = prefix_bindings(combined)
    imports = '\n'.join(INVENTORY_OPS_SHEET_IMPORTS)
    component = (
        '<script setup lang="ts">\n'
        f'{imports}\n\n'
        'const ws = useInventoryWorkspace();\n'
        '</script>\n\n'
        '<template>\n'
        f'{body}\n'
        '</template>\n'
    )
    OUT_DIR.joinpath('WorkspaceInventoryOpsSheets.vue').write_text(component, encoding='utf-8')
    insert_marker = '    <WorkspaceRequestEntrySheets />\n'
    if insert_marker not in content:
        raise SystemExit('WorkspaceRequestEntrySheets marker not found')
    content = content.replace(
        insert_marker,
        insert_marker + '    <WorkspaceInventoryOpsSheets />\n',
        1,
    )
    import_line = "import WorkspaceInventoryOpsSheets from '@/pages/inventory-procurement/workspace/WorkspaceInventoryOpsSheets.vue';"
    if import_line not in content:
        marker = "import WorkspaceRequestEntrySheets from '@/pages/inventory-procurement/workspace/WorkspaceRequestEntrySheets.vue';"
        content = content.replace(marker, marker + '\n' + import_line, 1)
    WORKSPACE.write_text(content, encoding='utf-8')
    print('extracted WorkspaceInventoryOpsSheets')
    print('updated Workspace.vue')


def extract_request_entry_sheets() -> None:
    content = WORKSPACE.read_text(encoding='utf-8')
    sheet_bodies: list[str] = []
    for comment in REQUEST_ENTRY_SHEET_MARKERS:
        full, body = extract_sheet_block(content, comment)
        sheet_bodies.append(body.strip())
        content = content.replace(full, '', 1)

    combined = '\n\n'.join(sheet_bodies)
    body = prefix_bindings(combined)
    imports = '\n'.join(REQUEST_ENTRY_SHEET_IMPORTS)
    component = (
        '<script setup lang="ts">\n'
        f'{imports}\n\n'
        'const ws = useInventoryWorkspace();\n'
        '</script>\n\n'
        '<template>\n'
        f'{body}\n'
        '</template>\n'
    )
    OUT_DIR.joinpath('WorkspaceRequestEntrySheets.vue').write_text(component, encoding='utf-8')
    insert_marker = '    <WorkspaceTransferSheets />\n'
    if insert_marker not in content:
        raise SystemExit('WorkspaceTransferSheets marker not found')
    content = content.replace(
        insert_marker,
        insert_marker + '    <WorkspaceRequestEntrySheets />\n',
        1,
    )
    import_line = "import WorkspaceRequestEntrySheets from '@/pages/inventory-procurement/workspace/WorkspaceRequestEntrySheets.vue';"
    if import_line not in content:
        marker = "import WorkspaceTransferSheets from '@/pages/inventory-procurement/workspace/WorkspaceTransferSheets.vue';"
        content = content.replace(marker, marker + '\n' + import_line, 1)
    WORKSPACE.write_text(content, encoding='utf-8')
    print('extracted WorkspaceRequestEntrySheets')
    print('updated Workspace.vue')


def extract_transfer_variance_block(content: str) -> tuple[str, str]:
    pattern = r'    <Sheet :open="transferVarianceReviewDialogOpen".*?</Sheet>'
    match = re.search(pattern, content, flags=re.DOTALL)
    if not match:
        raise SystemExit('Transfer variance review sheet not found')
    return match.group(0), match.group(0)


def extract_transfer_sheets() -> None:
    content = WORKSPACE.read_text(encoding='utf-8')
    sheet_bodies: list[str] = []
    for comment in TRANSFER_SHEET_MARKERS:
        full, body = extract_sheet_block(content, comment)
        sheet_bodies.append(body.strip())
        content = content.replace(full, '', 1)

    full, body = extract_transfer_variance_block(content)
    sheet_bodies.append(body.strip())
    content = content.replace(full, '', 1)

    combined = '\n\n'.join(sheet_bodies)
    body = prefix_bindings(combined)
    imports = '\n'.join(TRANSFER_SHEET_IMPORTS)
    component = (
        '<script setup lang="ts">\n'
        f'{imports}\n\n'
        'const ws = useInventoryWorkspace();\n'
        '</script>\n\n'
        '<template>\n'
        f'{body}\n'
        '</template>\n'
    )
    OUT_DIR.joinpath('WorkspaceTransferSheets.vue').write_text(component, encoding='utf-8')
    insert_marker = '    <WorkspaceAuxiliarySheets />\n'
    if insert_marker not in content:
        raise SystemExit('WorkspaceAuxiliarySheets marker not found')
    content = content.replace(
        insert_marker,
        insert_marker + '    <WorkspaceTransferSheets />\n',
        1,
    )
    import_line = "import WorkspaceTransferSheets from '@/pages/inventory-procurement/workspace/WorkspaceTransferSheets.vue';"
    if import_line not in content:
        marker = "import WorkspaceAuxiliarySheets from '@/pages/inventory-procurement/workspace/WorkspaceAuxiliarySheets.vue';"
        content = content.replace(marker, marker + '\n' + import_line, 1)
    WORKSPACE.write_text(content, encoding='utf-8')
    print('extracted WorkspaceTransferSheets')
    print('updated Workspace.vue')


def extract_filter_overlays() -> None:
    content = WORKSPACE.read_text(encoding='utf-8')
    start = '            <!-- Inventory filters sheet -->'
    end = '            </Drawer>\n        </div>'
    start_idx = content.find(start)
    end_idx = content.find(end)
    if start_idx < 0 or end_idx < 0:
        raise SystemExit('Filter overlay block not found')
    block = content[start_idx:end_idx + len('            </Drawer>')]
    body = prefix_bindings(block.strip())
    imports = '\n'.join(OVERLAY_IMPORTS)
    component = (
        '<script setup lang="ts">\n'
        f'{imports}\n\n'
        'const ws = useInventoryWorkspace();\n'
        '</script>\n\n'
        '<template>\n'
        f'{body}\n'
        '</template>\n'
    )
    OUT_DIR.joinpath('WorkspaceFilterOverlays.vue').write_text(component, encoding='utf-8')
    replacement = '            <WorkspaceFilterOverlays />'
    content = content[:start_idx] + replacement + content[end_idx + len('            </Drawer>'):]
    if "import WorkspaceFilterOverlays from '@/pages/inventory-procurement/workspace/WorkspaceFilterOverlays.vue';" not in content:
        marker = "} from '@/pages/inventory-procurement/workspace/workspaceTabComponents';"
        content = content.replace(
            marker,
            "} from '@/pages/inventory-procurement/workspace/workspaceTabComponents';\n"
            "import WorkspaceFilterOverlays from '@/pages/inventory-procurement/workspace/WorkspaceFilterOverlays.vue';",
            1,
        )
    WORKSPACE.write_text(content, encoding='utf-8')
    print('extracted WorkspaceFilterOverlays')
    print('updated Workspace.vue')


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == '--overlays':
        extract_filter_overlays()
        return
    if len(sys.argv) > 1 and sys.argv[1] == '--aux-sheets':
        extract_auxiliary_sheets()
        return
    if len(sys.argv) > 1 and sys.argv[1] == '--transfer-sheets':
        extract_transfer_sheets()
        return
    if len(sys.argv) > 1 and sys.argv[1] == '--request-entry-sheets':
        extract_request_entry_sheets()
        return
    if len(sys.argv) > 1 and sys.argv[1] == '--inventory-ops-sheets':
        extract_inventory_ops_sheets()
        return
    if len(sys.argv) > 1 and sys.argv[1] == '--requisition-details-sheet':
        extract_requisition_details_sheet()
        return
    if len(sys.argv) > 1 and sys.argv[1] == '--procurement-lifecycle-sheets':
        extract_procurement_lifecycle_sheets()
        return
    if len(sys.argv) > 1 and sys.argv[1] == '--item-details-sheet':
        extract_item_details_sheet()
        return
    if len(sys.argv) > 1 and sys.argv[1] == '--claims-msd-sheets':
        extract_claims_msd_sheets()
        return

    content = WORKSPACE.read_text(encoding='utf-8')
    tabs = [
        ('ledger', 'WorkspaceLedgerTab'),
        ('analytics', 'WorkspaceAnalyticsTab'),
    ]

    for value, component in tabs:
        inner, full = extract_tab(content, value)
        OUT_DIR.joinpath(f'{component}.vue').write_text(build_component(component, inner), encoding='utf-8')
        replacement = (
            f'<TabsContent value="{value}" class="mt-0 flex flex-col gap-4">\n'
            f'                    <{component} v-if="activeTab === \'{value}\'" />\n'
            f'                </TabsContent>'
        )
        content = content.replace(full, replacement, 1)
        print(f'extracted {component}')

    WORKSPACE.write_text(content, encoding='utf-8')
    print('updated Workspace.vue')

if __name__ == '__main__':
    main()
