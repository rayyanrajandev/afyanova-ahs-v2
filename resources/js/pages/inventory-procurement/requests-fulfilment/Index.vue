<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, ref, nextTick, onBeforeUnmount, onMounted, reactive, watch, type Ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import type { AppIconName } from '@/lib/icons';
import ComboboxField from '@/components/forms/ComboboxField.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import InventoryEmptyState from '@/components/inventory/InventoryEmptyState.vue';
import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import WorkflowQueueRow from '@/components/list/WorkflowQueueRow.vue';
import WorkflowQueueSkeleton from '@/components/list/WorkflowQueueSkeleton.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import ClinicalContextBanner from '@/components/domain/clinical/ClinicalContextBanner.vue';
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
import { departmentDisplayName, departmentRequesterHeaderDescription } from '@/lib/departmentRequisitionContext';
import { generateRequestKey } from '@/lib/idempotency';
import { INVENTORY_PROCUREMENT_HOME_PATH } from '@/lib/inventoryProcurement';
import { isInventoryDepartmentRequester, isInventoryStoreOperations, type InventoryProcurementAccess } from '@/lib/inventoryProcurementAccess';
import { formatEnumLabel } from '@/lib/labels';
import { departmentRequisitionStripeClass, shortageReadinessStripeClass } from '@/lib/listRows';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { EMPTY_SELECT_VALUE, fromSelectValue, toSelectValue, auditActorLabel } from '@/pages/inventory-procurement/constants';
import { clearSupplyChainPageApi } from '@/pages/inventory-procurement/supplyChainPageApi';
import { bindSupplyChainPageApi } from '@/pages/inventory-procurement/registerSupplyChainPageApi';
import { useRequestPipelineCounts } from '@/pages/inventory-procurement/composables/useRequestPipelineCounts';
import { type RequestPipelineStage, type SupplyChainNextAction } from '@/pages/inventory-procurement/supplyChainOverview';
import SupplyChainProcurementLifecycleSheets from '@/pages/inventory-procurement/components/SupplyChainProcurementLifecycleSheets.vue';
import SupplyChainRequisitionDetailsSheet from '@/pages/inventory-procurement/components/SupplyChainRequisitionDetailsSheet.vue';
import SupplyChainRequestEntrySheets from '@/pages/inventory-procurement/components/SupplyChainRequestEntrySheets.vue';
import SupplyChainTransferSheets from '@/pages/inventory-procurement/components/SupplyChainTransferSheets.vue';
import SupplyChainFilterPopover from '@/pages/inventory-procurement/components/SupplyChainFilterPopover.vue';
import {
    SupplyChainOverviewTab,
    SupplyChainRequisitionsTab,
    SupplyChainShortageQueueTab,
    SupplyChainTransfersTab,
} from '@/pages/inventory-procurement/supplyChainTabComponents';
import { type BreadcrumbItem } from '@/types';

type ApiError = Error & { payload?: { message?: string; errors?: Record<string, string[]> } };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Supply chain', href: INVENTORY_PROCUREMENT_HOME_PATH },
    { title: 'Requests & Fulfilment', href: '/inventory-procurement/requests-fulfilment' },
];

type RFTab = 'overview' | 'requisitions' | 'shortage-queue' | 'transfers';
const rfTabs: RFTab[] = ['overview', 'requisitions', 'shortage-queue', 'transfers'];

const { permissionNames: sharedPermissionNames, isFacilitySuperAdmin, hasPermission, permissionState, scope: platformScope } = usePlatformAccess();
const permissionsResolved = computed(() => sharedPermissionNames.value !== null);
const canReadDepartments = computed(() => isFacilitySuperAdmin.value || hasPermission('departments.read'));

const canRead = ref(false);
const canManageItems = ref(false);
const canCreateMovement = ref(false);
const canCreateRequest = ref(false);
const canUpdateRequestStatus = ref(false);
const canViewAudit = ref(false);
const canReconcileStock = ref(false);
const canSetOpeningStock = ref(false);
const canApproveRequisitions = ref(false);
const canManageSuppliers = ref(false);
const canManageWarehouses = ref(false);

const inventoryAccess = computed<InventoryProcurementAccess>(() => ({
    canRead: canRead.value, canManageItems: canManageItems.value, canCreateMovement: canCreateMovement.value,
    canSetOpeningStock: canSetOpeningStock.value, canReconcileStock: canReconcileStock.value,
    canCreateRequest: canCreateRequest.value, canUpdateRequestStatus: canUpdateRequestStatus.value,
    canViewAudit: canViewAudit.value, canApproveRequisitions: canApproveRequisitions.value,
    canManageSuppliers: canManageSuppliers.value, canManageWarehouses: canManageWarehouses.value,
}));

const isDepartmentRequester = computed(() => isInventoryDepartmentRequester(inventoryAccess.value));
const isStoreOperations = computed(() => isInventoryStoreOperations(inventoryAccess.value));

const activeTab = ref<RFTab>('overview');
const loading = ref(true);
const referenceStructureLoaded = ref(false);
const rfUrlStateHydrated = ref(false);
const { setQueryParam, replaceUrlQuery } = useUrlQueryState();

function hydrateRfStateFromUrl(): void {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    const tab = (params.get('tab') ?? '').trim().toLowerCase();
    const section = (params.get('section') ?? '').trim().toLowerCase();

    if (rfTabs.includes(tab as RFTab)) {
        activeTab.value = tab as RFTab;
    } else if (rfTabs.includes(section as RFTab)) {
        activeTab.value = section as RFTab;
    }

    if (activeTab.value === 'requisitions') {
        deptReqSearch.q = params.get('q')?.trim() ?? '';
        deptReqSearch.status = params.get('status')?.trim() ?? '';
        deptReqSearch.departmentId = params.get('departmentId')?.trim() ?? '';
        deptReqSearch.page = Number.isFinite(Number(params.get('page') ?? '')) && Number(params.get('page')) > 0
            ? Number(params.get('page'))
            : 1;
        deptReqSearch.perPage = Number.isFinite(Number(params.get('perPage') ?? '')) && Number(params.get('perPage')) > 0
            ? Number(params.get('perPage'))
            : 50;
    }

    if (activeTab.value === 'shortage-queue') {
        shortageQueueFilters.q = params.get('q')?.trim() ?? '';
        shortageQueueFilters.departmentId = params.get('departmentId')?.trim() ?? '';
        shortageQueueFilters.readiness = params.get('readiness')?.trim() || 'all';
        shortageQueueFilters.page = Number.isFinite(Number(params.get('page') ?? '')) && Number(params.get('page')) > 0
            ? Number(params.get('page'))
            : 1;
        shortageQueueFilters.perPage = Number.isFinite(Number(params.get('perPage') ?? '')) && Number(params.get('perPage')) > 0
            ? Number(params.get('perPage'))
            : 50;
    }

    if (activeTab.value === 'transfers') {
        transferSearch.q = params.get('q')?.trim() ?? '';
        transferSearch.status = params.get('status')?.trim() ?? '';
        transferSearch.varianceReview = params.get('varianceReview')?.trim() ?? '';
        transferSearch.page = Number.isFinite(Number(params.get('page') ?? '')) && Number(params.get('page')) > 0
            ? Number(params.get('page'))
            : 1;
        transferSearch.perPage = Number.isFinite(Number(params.get('perPage') ?? '')) && Number(params.get('perPage')) > 0
            ? Number(params.get('perPage'))
            : 50;
    }

    rfUrlStateHydrated.value = true;
}

function syncRfStateToUrl(): void {
    if (!rfUrlStateHydrated.value || typeof window === 'undefined') return;

    replaceUrlQuery((params) => {
        params.delete('section');
        setQueryParam(params, 'tab', activeTab.value);

        const allStateKeys = ['q', 'status', 'departmentId', 'readiness', 'varianceReview', 'page', 'perPage'];
        for (const key of allStateKeys) params.delete(key);

        if (activeTab.value === 'requisitions') {
            setQueryParam(params, 'q', deptReqSearch.q);
            setQueryParam(params, 'status', deptReqSearch.status);
            setQueryParam(params, 'departmentId', deptReqSearch.departmentId);
            if (deptReqSearch.page > 1) setQueryParam(params, 'page', deptReqSearch.page);
            if (deptReqSearch.perPage !== 50) setQueryParam(params, 'perPage', deptReqSearch.perPage);
        }

        if (activeTab.value === 'shortage-queue') {
            setQueryParam(params, 'q', shortageQueueFilters.q);
            setQueryParam(params, 'departmentId', shortageQueueFilters.departmentId);
            if (shortageQueueFilters.readiness !== 'all') setQueryParam(params, 'readiness', shortageQueueFilters.readiness);
            if (shortageQueueFilters.page > 1) setQueryParam(params, 'page', shortageQueueFilters.page);
            if (shortageQueueFilters.perPage !== 50) setQueryParam(params, 'perPage', shortageQueueFilters.perPage);
        }

        if (activeTab.value === 'transfers') {
            setQueryParam(params, 'q', transferSearch.q);
            setQueryParam(params, 'status', transferSearch.status);
            setQueryParam(params, 'varianceReview', transferSearch.varianceReview);
            if (transferSearch.page > 1) setQueryParam(params, 'page', transferSearch.page);
            if (transferSearch.perPage !== 50) setQueryParam(params, 'perPage', transferSearch.perPage);
        }
    });
}

// ── Overview tab state ──
const pageHeaderDescription = computed(() => {
    if (isDepartmentRequester.value) return 'View and manage department requests, stock issues, and procurement tracking';
    const base = 'Priorities, department requests, shortages, and warehouse transfers';
    return base;
});

const { requestPipelineCounts, loadRequestPipelineCounts } = useRequestPipelineCounts(apiRequest);

const requisitionsReadyCount = computed(() => shortageQueueMeta.value?.readyLineCount ?? 0);
const requisitionsWaitingCount = computed(() => shortageQueueMeta.value?.waitingLineCount ?? 0);
const departmentRequisitionTotal = computed(() => deptReqPagination.value?.total ?? deptRequisitions.value.length);

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
        helper: 'Goods received, pending stock entry.',
        icon: 'package-check',
        target: 'procurement',
        status: 'received',
        kind: 'procurement',
    },
    {
        key: 'issued',
        label: 'Issued',
        value: requestPipelineCounts.value.issued,
        helper: 'Completed requisitions.',
        icon: 'check',
        target: 'requisitions',
        status: 'issued',
        kind: 'requisition',
    },
]);

const nextActions = ref<SupplyChainNextAction[]>([]);
const openRequestPipelineStage = (stage: RequestPipelineStage, e?: MouseEvent) => {};

// ── Department Requisitions tab state ──
type LookupOption = { id: string; name: string; code: string | null };
type DepartmentRequisitionContext = {
    canSelectAnyDepartment: boolean; lockedDepartment: LookupOption | null; staffDepartmentName: string | null;
    preferredWarehouseId: string | null; hasExplicitItemCatalog: boolean; departmentProfile: string | null;
};
const requisitionContext = ref<DepartmentRequisitionContext | null>(null);
const departments = ref<LookupOption[]>([]);
const warehouses = ref<LookupOption[]>([]);
const suppliers = ref<LookupOption[]>([]);
const supplierReady = computed(() => suppliers.value.length > 0);
const warehouseReady = computed(() => warehouses.value.length > 0);

const deptRequisitions = ref<any[]>([]);
const deptReqPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const deptReqLoading = ref(false);
const deptReqSearch = reactive({ q: '', status: '', departmentId: '', page: 1, perPage: 50 });
const REQUISITION_STATUSES = ['draft', 'submitted', 'approved', 'partially_issued', 'issued', 'rejected', 'cancelled'] as const;
const REQUISITION_PRIORITIES = [{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Routine' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }] as const;

type RequisitionInventorySelection = { id?: string; unit?: string | null };

const lockedRequisitionDepartment = computed(() => requisitionContext.value?.lockedDepartment ?? null);

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

const canSelectAnyRequisitionDepartment = computed(() => requisitionContext.value?.canSelectAnyDepartment ?? isFacilitySuperAdmin.value);

function normalizeLookupOption(value: any, nameKeys: string[], codeKeys: string[] = []): LookupOption | null {
    const id = String(value?.id ?? '').trim();
    if (!id) return null;
    let name = '';
    for (const key of nameKeys) {
        const candidate = String(value?.[key] ?? '').trim();
        if (candidate) { name = candidate; break; }
    }
    let code: string | null = null;
    for (const key of codeKeys) {
        const candidate = String(value?.[key] ?? '').trim();
        if (candidate) { code = candidate; break; }
    }
    return { id, name: name || id, code };
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

function normalizeScopedDepartmentFilter(departmentId: string): string {
    const lockedDepartment = lockedRequisitionDepartment.value;
    if (!canSelectAnyRequisitionDepartment.value) {
        return lockedDepartment?.id ?? '';
    }
    return fromSelectValue(departmentId);
}

function setDeptReqDepartmentFilter(departmentId: string): void {
    deptReqSearch.departmentId = normalizeScopedDepartmentFilter(departmentId);
    deptReqSearch.page = 1;
}

function setShortageQueueDepartmentFilter(departmentId: string): void {
    shortageQueueFilters.departmentId = normalizeScopedDepartmentFilter(departmentId);
}

function applyLockedDeptReqFilter(): void {
    const lockedDepartment = lockedRequisitionDepartment.value;
    if (canSelectAnyRequisitionDepartment.value || !lockedDepartment) return;
    deptReqSearch.departmentId = lockedDepartment.id;
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

// ── Create requisition state ──
const createRequisitionDialogOpen = ref(false);
const reqCreateErrors = ref<Record<string, string[]>>({});
const reqCreateSubmitting = ref(false);
const reqForm = reactive({
    requestingDepartment: '', requestingDepartmentId: '', issuingWarehouseId: '',
    priority: 'normal', neededBy: '', notes: '',
    lines: [{ itemId: '', requestedQuantity: '', unit: '', notes: '' }] as Array<{ itemId: string; requestedQuantity: string; unit: string; notes: string }>,
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

function resetReqForm() {
    reqForm.requestingDepartment = '';
    reqForm.requestingDepartmentId = '';
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

function updateRequisitionDepartment(departmentId: string): void {
    const normalizedId = fromSelectValue(departmentId);
    const selectedDepartment = requisitionDepartmentOptions.value.find((department) => department.id === normalizedId) ?? null;
    reqForm.requestingDepartmentId = selectedDepartment?.id ?? '';
    reqForm.requestingDepartment = selectedDepartment?.name ?? '';
    reqForm.lines = reqForm.lines.map((line) => ({ ...line, itemId: '', unit: '' }));
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

// ── Requisition details state ──
const requisitionDetailsOpen = ref(false);
const selectedRequisition = ref<any>(null);
const requisitionLineDecisionDrafts = ref<Array<{ id: string; approvedQuantity: string; issuedQuantity: string }>>([]);
const requisitionStatusSubmitting = ref(false);

function numericDecisionValue(value: unknown, fallback = 0): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
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

function requisitionLineAvailableStock(line: any): number {
    return numericDecisionValue(line?.itemCurrentStock, 0);
}

function requisitionLineAdditionalIssueQuantity(line: any): number {
    return Math.max(requisitionIssuedDecisionQuantity(line) - numericDecisionValue(line?.issuedQuantity, 0), 0);
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

function requisitionApprovedDecisionQuantity(line: any): number {
    const draft = requisitionLineDecisionDraft(line);
    return numericDecisionValue(draft.approvedQuantity || line?.approvedQuantity || line?.requestedQuantity, 0);
}

function requisitionIssuedDecisionQuantity(line: any): number {
    const draft = requisitionLineDecisionDraft(line);
    return numericDecisionValue(draft.issuedQuantity || line?.issuedQuantity || line?.approvedQuantity || line?.requestedQuantity, 0);
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

const ACTIVE_SOURCE_PROCUREMENT_STATUSES = ['pending_approval', 'approved', 'ordered'];

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

function requisitionStatusLinePayload(req: any | null, status: string): Array<{ id: string; approvedQuantity?: number; issuedQuantity?: number }> {
    const sourceLines = req?.lines ?? [];
    if (!['approved', 'issued', 'partially_issued'].includes(status)) return [];
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

function onRequisitionDetailsOpenChange(value: boolean): void {
    requisitionDetailsOpen.value = value;
    if (!value) {
        selectedRequisition.value = null;
        requisitionLineDecisionDrafts.value = [];
    }
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

function requisitionStatusHelper(status: string | null | undefined): string {
    switch (status) {
        case 'draft': return 'Draft can still be corrected before the department sends it to stores.';
        case 'submitted': return 'Submitted requests are ready for store review, approval, or rejection.';
        case 'approved': return 'Approved requests are authorized for stock issue from the selected warehouse.';
        case 'partially_issued': return 'Some approved quantities have been issued; remaining lines still need fulfillment or closure.';
        case 'issued': return 'Issued requests are fulfilled and should now be visible in stock movement and audit history.';
        case 'rejected': return 'Rejected requests are closed unless the department creates a corrected requisition.';
        case 'cancelled': return 'Cancelled requests are closed and should not affect stock.';
        default: return 'Review the current requisition state before taking the next workflow action.';
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

// ── Shortage queue state ──
const shortageQueueReplenishmentBanner = ref<any>(null);
const shortageQueueMeta = ref<{ readyLineCount: number; total: number; waitingLineCount?: number } | null>({ readyLineCount: 0, total: 0 });
const shortageQueueItems = ref<any[]>([]);
const shortageQueueLoading = ref(false);
const shortageQueueError = ref<string | null>(null);
const shortageQueueFilters = reactive({ q: '', departmentId: '', readiness: 'all', page: 1, perPage: 50 });

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

const shortageQueueDepartmentFilterOptions = computed(() => departmentFilterOptions.value);

// ── Procurement from shortage linking ──
const procurementSetupBlockedReason = computed(() => null);
const procurementForm = reactive({ itemId: '', itemName: '', category: '', unit: '', reorderLevel: '', requestedQuantity: '', unitCostEstimate: '', neededBy: '', supplierId: '', sourceDepartmentRequisitionId: '', sourceDepartmentRequisitionLineId: '', sourceSummary: '', notes: '' });
const procurementErrors = ref<Record<string, string[]>>({});
const procurementSubmitting = ref(false);
const procurementSubmitDisabled = computed(() => (
    procurementSubmitting.value
    || !procurementForm.itemId.trim()
    || procurementForm.requestedQuantity.trim() === ''
    || Number(procurementForm.requestedQuantity) <= 0
));
const selectedProcurementItem = ref<any>(null);
const createProcurementDialogOpen = ref(false);
const procurementRequestKey = ref(generateRequestKey('inventory-procurement-request-create'));
const procurementLockedToSource = computed(() => procurementForm.sourceDepartmentRequisitionLineId.trim().length > 0);
const procurementUsesExistingItem = computed(() => procurementForm.itemId.trim().length > 0);
const activeRequests = ref<any[]>([]);
const activeRequestsForItem = computed(() => []);

function handleProcurementItemSelected(item: any): void {
    selectedProcurementItem.value = item;
    if (!item) return;
    procurementForm.itemId = String(item.id ?? '');
    procurementForm.itemName = String(item.itemName ?? item.name ?? '');
    procurementForm.category = String(item.category ?? '');
    procurementForm.unit = String(item.unit ?? item.dispensingUnit ?? '');
}

function submitProcurementRequest(): Promise<void> { return Promise.resolve(); }
function closeCreateProcurementDialog(): void { createProcurementDialogOpen.value = false; }
function handleProcurementDialogOpenChange(open: boolean): void { if (open) createProcurementDialogOpen.value = true; else closeCreateProcurementDialog(); }

function openProcurementFromShortage(req: any | null, line: any): void {
    if (!req) return;
    procurementErrors.value = {};
    procurementForm.itemId = String(line.itemId ?? '');
    procurementForm.itemName = String(line.itemName ?? '');
    procurementForm.category = String(line.itemCategory ?? '');
    procurementForm.unit = String(line.unit ?? '');
    procurementForm.requestedQuantity = String(requisitionLineShortageQuantity(line));
    procurementForm.supplierId = '';
    procurementForm.sourceDepartmentRequisitionId = String(req.id ?? '');
    procurementForm.sourceDepartmentRequisitionLineId = String(line.id ?? '');
    procurementForm.sourceSummary = `${req.requisitionNumber ?? 'Requisition'} | ${req.requestingDepartment ?? ''} | ${requisitionLineItemLabel(line)}`;
    procurementForm.notes = `Shortage from ${req.requisitionNumber ?? 'requisition'}.`;
    createProcurementDialogOpen.value = true;
}

function openProcurementFromRequisitionShortage(line: any): void { openProcurementFromShortage(selectedRequisition.value, line); }
function openProcurementFromQueueShortage(req: any, line: any): void { openProcurementFromShortage(req, line); }

// ── Transfer state ──
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

const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
] as const;

const createTransferDialogOpen = ref(false);
const transfers = ref<any[]>([]);
const transferPagination = ref<{ currentPage: number; lastPage: number; total?: number } | null>(null);
const transferSearch = reactive({ q: '', status: '', varianceReview: '', page: 1, perPage: 50 });
const transferLoading = ref(false);

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

const transferForm = reactive({
    sourceWarehouseId: '',
    destinationWarehouseId: '',
    priority: 'normal',
    reason: '',
    notes: '',
    lines: [{ itemId: '', batchId: '', requestedQuantity: '', unit: '', notes: '' }] as Array<{ itemId: string; batchId: string; requestedQuantity: string; unit: string; notes: string }>,
});
const transferErrors = ref<Record<string, string[]>>({});
const transferSubmitting = ref(false);

const transferStatusDialogOpen = ref(false);
const transferStatusSubmitting = ref(false);
const transferStatusContextLoading = ref(false);
const transferStatusErrors = ref<Record<string, string[]>>({});
const transferStatusSelectedTransfer = ref<any | null>(null);
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

const transferVarianceReviewDialogOpen = ref(false);
const transferVarianceReviewSubmitting = ref(false);
const transferVarianceReviewLoading = ref(false);
const transferVarianceReviewErrors = ref<Record<string, string[]>>({});
const transferVarianceReviewSelectedTransfer = ref<any | null>(null);
const transferVarianceReviewForm = reactive({ transferId: '', reviewNotes: '' });
const transferVarianceReviewLines = ref<any[]>([]);

const transferBatchOptionsByItemId = ref<Record<string, any[]>>({});

async function fetchItemBatchOptions(itemId: string): Promise<any[]> {
    if (!itemId.trim()) return [];
    const response = await apiRequest<{ data: any[] }>('GET', '/inventory-procurement/batches', {
        query: { itemId, perPage: 50 },
    });
    return response.data ?? [];
}

function transferLineItem(line: { itemId: string }): any | null {
    return items.value.find((item) => item.id === line.itemId) ?? null;
}

function transferLineBatches(line: { itemId: string }): any[] {
    const allBatches = transferBatchOptionsByItemId.value[line.itemId] ?? [];
    if (!transferForm.sourceWarehouseId) return allBatches;
    return allBatches.filter((batch) => batch.warehouseId === transferForm.sourceWarehouseId);
}

function transferLineUsesBatchTracking(line: { itemId: string }): boolean {
    const item = transferLineItem(line);
    const category = String(item?.category ?? '');
    const categoryOption = categoryOptions.find((c) => c.value === category);
    return Boolean(categoryOption?.requiresExpiryTracking) || transferLineBatches(line).length > 0;
}

const categoryOptions: Array<{ value: string; requiresExpiryTracking?: boolean }> = [];

async function ensureTransferBatchOptions(itemId: string): Promise<void> {
    if (!itemId.trim() || transferBatchOptionsByItemId.value[itemId]) return;
    transferBatchLoadingByItemId.value = { ...transferBatchLoadingByItemId.value, [itemId]: true };
    try {
        transferBatchOptionsByItemId.value = {
            ...transferBatchOptionsByItemId.value,
            [itemId]: await fetchItemBatchOptions(itemId),
        };
    } catch {
        transferBatchOptionsByItemId.value = { ...transferBatchOptionsByItemId.value, [itemId]: [] };
    } finally {
        transferBatchLoadingByItemId.value = { ...transferBatchLoadingByItemId.value, [itemId]: false };
    }
}

const transferBatchLoadingByItemId = ref<Record<string, boolean>>({});

function batchOptionLabel(batch: any): string {
    const parts = [
        batch?.batchNumber ? `Batch ${batch.batchNumber}` : 'Batch',
        batch?.quantity != null ? `${formatAmount(batch.quantity)} available` : null,
        batch?.expiryDate ? `Exp ${formatBatchDate(batch.expiryDate)}` : null,
    ].filter((value): value is string => Boolean(value && String(value).trim()));
    return parts.join(' • ');
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
    if (!value) resetTransferStatusForm();
}

function onTransferVarianceReviewDialogOpenChange(value: boolean): void {
    transferVarianceReviewDialogOpen.value = value;
    if (!value) resetTransferVarianceReviewForm();
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
    if (itemName && itemCode) return `${itemName} (${itemCode})`;
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
            transferStatusForm.packedQuantities[line.id] = String(line.packRemainingQuantity ?? line.requested_quantity ?? '');
        }
        if (newStatus === 'in_transit') {
            transferStatusForm.dispatchedQuantities[line.id] = String(line.dispatchRemainingQuantity ?? line.packedQuantity ?? line.requested_quantity ?? '');
        }
        if (newStatus === 'received') {
            transferStatusForm.receivedQuantities[line.id] = String(line.receiptRemainingQuantity ?? line.dispatched_quantity ?? line.requested_quantity ?? '');
            transferStatusForm.receiptVarianceTypes[line.id] = String(line.receiptVarianceType ?? 'full');
            transferStatusForm.receiptVarianceQuantities[line.id] = Number(line.receiptVarianceQuantity ?? 0) > 0 ? String(line.receiptVarianceQuantity) : '';
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
    if (staleQuantity > 0) return `${stateLabel}: ${formatTransferQuantity(staleQuantity)} awaiting refresh`;
    if (refreshQuantity > 0) return `${stateLabel}: ${formatTransferQuantity(refreshQuantity)} to re-hold`;
    if (activeQuantity > 0) return `${stateLabel}: ${formatTransferQuantity(activeQuantity)} held`;
    if (consumedQuantity > 0) return `${stateLabel}: ${formatTransferQuantity(consumedQuantity)} dispatched`;
    if (releasedQuantity > 0) return `${stateLabel}: ${formatTransferQuantity(releasedQuantity)} released`;
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
        case 'high': return 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200';
        case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
        default: return 'bg-muted text-muted-foreground';
    }
}

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

function openTransferPickSlip(transfer: any): void {
    if (!transferCanOpenPickSlip(transfer)) return;
    window.open(transferPickSlipUrl(transfer.id), '_blank', 'noopener,noreferrer');
}

function openTransferDispatchNote(transfer: any): void {
    if (!transferCanOpenDispatchNote(transfer)) return;
    window.open(transferDispatchNoteUrl(transfer.id), '_blank', 'noopener,noreferrer');
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

// ── Item state (needed for shortage/procurement linking) ──
const items = ref<any[]>([]);
const itemCounts = ref({ outOfStock: 0, lowStock: 0, healthy: 0, total: 0 });
const inventoryItemRequestingDepartmentId = ref<string | null>(null);

// ── Misc ──
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

function formatAmount(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return 'N/A';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return String(value);
    return numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const filterCount = computed(() => {
    if (activeTab.value === 'requisitions') {
        let count = 0;
        if (deptReqSearch.q) count++;
        if (deptReqSearch.status) count++;
        if (deptReqSearch.departmentId) count++;
        if (deptReqSearch.perPage !== 50) count++;
        return count;
    }
    if (activeTab.value === 'shortage-queue') {
        let count = 0;
        if (shortageQueueFilters.q) count++;
        if (shortageQueueFilters.readiness !== 'all') count++;
        if (shortageQueueFilters.departmentId) count++;
        if (shortageQueueFilters.perPage !== 50) count++;
        return count;
    }
    if (activeTab.value === 'transfers') {
        let count = 0;
        if (transferSearch.q) count++;
        if (transferSearch.status) count++;
        if (transferSearch.varianceReview) count++;
        if (transferSearch.perPage !== 50) count++;
        return count;
    }
    return 0;
});

interface HeaderAction {
    key: string;
    label: string;
    icon: string;
    variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
    show: boolean;
    disabled?: boolean;
    onClick?: () => void;
}

const headerActions = computed<HeaderAction[]>(() => {
    const actions: HeaderAction[] = [];
    if (activeTab.value === 'overview') {
        actions.push({ key: 'refresh-pipeline', label: 'Refresh Pipeline', icon: 'refresh-cw', variant: 'outline', show: true, onClick: () => loadRequestPipelineCounts() });
    } else if (activeTab.value === 'requisitions') {
        actions.push({ key: 'new-requisition', label: 'New Requisition', icon: 'plus', variant: 'default', show: canCreateRequest.value, onClick: () => openCreateRequisitionDialog() });
    } else if (activeTab.value === 'transfers') {
        actions.push({ key: 'new-transfer', label: 'New Transfer', icon: 'plus', variant: 'default', show: true, onClick: () => { createTransferDialogOpen.value = true; } });
    }
    actions.push({ key: 'export', label: 'Export', icon: 'download', variant: 'outline', show: true, onClick: () => {} });
    actions.push({ key: 'print', label: 'Print', icon: 'printer', variant: 'outline', show: true, onClick: () => { if (typeof window !== 'undefined') window.print(); } });
    return actions.filter((action) => action.show);
});

function resetAllFilters() {
    if (activeTab.value === 'requisitions') {
        resetDeptReqFilters();
    } else if (activeTab.value === 'shortage-queue') {
        shortageQueueFilters.q = '';
        shortageQueueFilters.departmentId = '';
        shortageQueueFilters.readiness = 'all';
        shortageQueueFilters.page = 1;
        loadShortageQueue();
    } else if (activeTab.value === 'transfers') {
        transferSearch.q = '';
        transferSearch.status = '';
        transferSearch.varianceReview = '';
        transferSearch.page = 1;
        loadWarehouseTransfers();
    }
}

function applyFilters() {
    if (activeTab.value === 'requisitions') {
        deptReqSearch.page = 1;
        loadDeptRequisitions();
    } else if (activeTab.value === 'shortage-queue') {
        shortageQueueFilters.page = 1;
        loadShortageQueue();
    } else if (activeTab.value === 'transfers') {
        transferSearch.page = 1;
        loadWarehouseTransfers();
    }
}

const deptReqFilterChips = computed(() => {
    const chips: string[] = [];
    if (deptReqSearch.q) chips.push(`Search: "${deptReqSearch.q}"`);
    if (deptReqSearch.status) chips.push(`Status: ${formatEnumLabel(deptReqSearch.status)}`);
    if (deptReqSearch.departmentId) chips.push(`Department: ${deptReqSearch.departmentId}`);
    return chips;
});
const hasAnyDeptReqFilters = computed(() => deptReqFilterChips.value.length > 0);

function resetDeptReqFilters(): void {
    deptReqSearch.q = '';
    deptReqSearch.status = '';
    deptReqSearch.departmentId = '';
    applyLockedDeptReqFilter();
    deptReqSearch.page = 1;
    void loadDeptRequisitions();
}

function formatEnumLabelFn(v: string): string { return formatEnumLabel(v); }

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

function reloadAll(): void {
    void loadDeptRequisitions();
    void loadShortageQueue();
    void loadWarehouseTransfers();
}

bindSupplyChainPageApi({
    canRead, canCreateRequest, canManageItems, canCreateMovement, canUpdateRequestStatus,
    canApproveRequisitions, canViewAudit, canReconcileStock, canSetOpeningStock,
    canLaunchCreateItem: computed(() => false), canLaunchStockMovement: computed(() => false),
    canLaunchOpeningStock: computed(() => false), canLaunchProcurementRequest: computed(() => false),
    canSyncFromCatalog: computed(() => false), headerActions: computed(() => []),
    loading, departments, warehouses, suppliers, items, itemCounts,
    deptReqSearch, deptReqLoading, deptRequisitions, deptReqPagination, deptReqFilterChips,
    hasAnyDeptReqFilters, REQUISITION_STATUSES, EMPTY_SELECT_VALUE, requisitionDepartmentOptions,
    departmentFilterOptions, canSelectAnyRequisitionDepartment, setDeptReqDepartmentFilter,
    setShortageQueueDepartmentFilter, setDepartmentStockDepartmentFilter: () => {},
    loadDeptRequisitions, resetDeptReqFilters, openCreateRequisitionDialog,
    openRequisitionDetails, updateRequisitionStatus, requisitionPrimaryActionLabel,
    reqStatusBadgeClass, warehouseLabel, formatDateOnly, formatDateTime, formatEnumLabel: formatEnumLabelFn,
    toSelectValue, fromSelectValue, lookupOptionText, isDepartmentRequester, isStoreOperations,
    shortageQueueReplenishmentBanner, shortageQueueMeta, shortageQueueItems, shortageQueueLoading,
    shortageQueueError, shortageQueueFilters, loadShortageQueue,
    canCreateProcurementFromRequisitionLine, openProcurementFromQueueShortage,
    shortageLineProcurementRequest,
    transferAttentionSummary, transferAttentionBadgeClass, createTransferDialogOpen,
    transferSearch, TRANSFER_STATUSES, TRANSFER_VARIANCE_REVIEW_FILTER_OPTIONS,
    transferLoading, transfers, transferPagination, loadWarehouseTransfers,
    transferStatusBadgeClass, transferPriorityBadge, transferReservationStateBadgeClass,
    transferReservationSummaryLabel, transferCanOpenVarianceReview, transferVarianceReviewState,
    transferVarianceReviewBadgeClass, transferVarianceReviewStateLabel, transferPickSummaryLabel,
    transferAttentionSignals, TRANSFER_ACTION_TRANSITIONS, openTransferStatusDialog,
    transferActionLabel, openTransferVarianceReviewDialog, transferVarianceReviewButtonLabel,
    transferCanOpenPickSlip, transferCanOpenDispatchNote, openTransferPickSlip, openTransferDispatchNote,
    inventoryItemSetupBlockedReason: computed(() => null),
    reloadAll,
    createProcurementDialogOpen, closeCreateProcurementDialog, handleProcurementDialogOpenChange,
    procurementRequestKey, procurementForm, procurementErrors, procurementSubmitting,
    procurementSubmitDisabled, procurementUsesExistingItem, procurementLockedToSource,
    selectedProcurementItem, handleProcurementItemSelected, activeRequestsForItem,
    submitProcurementRequest,
    requisitionDetailsOpen, onRequisitionDetailsOpenChange, selectedRequisition,
    requisitionStatusHelper, requisitionLineItemLabel, requisitionLineDecisionDraft,
    requisitionLineAvailableStock, requisitionLineIssueProblem, requisitionLineShortageSummary,
    requisitionApprovedDecisionQuantity, requisitionIssuedDecisionQuantity,
    openProcurementFromRequisitionShortage, selectedRequisitionIssueBlockingProblems,
    selectedRequisitionHasAnyAdditionalIssue, selectedRequisitionIssueShortageSummaries,
    selectedRequisitionIssueUnavailableReason, requisitionStatusSubmitting,
    selectedRequisitionIssueBlockedReason, confirmSelectedRequisitionIssue,
    selectedRequisitionIssueTargetStatus, formatAmount, auditActorLabel,
    transferForm, transferErrors, transferSubmitting, PRIORITY_OPTIONS,
    handleTransferLineItemChange, transferLineUsesBatchTracking, transferBatchLoadingByItemId,
    transferLineBatches, batchOptionLabel, addTransferLine, removeTransferLine, submitCreateTransfer,
    transferStatusDialogOpen, transferStatusSelectedTransfer, transferStatusContextLoading,
    transferStatusErrors, transferStatusSubmitting, onTransferStatusDialogOpenChange,
    submitTransferStatusUpdate, transferDispatchNeedsRevalidation: computed(() => transferDispatchNeedsRevalidation()),
    transferLineLabel, formatTransferQuantity,
    transferReservationStateLabel, transferReceiptVarianceType,
    transferReceiptVarianceNeedsDetails, TRANSFER_RECEIPT_VARIANCE_OPTIONS,
    transferVarianceReviewDialogOpen, transferVarianceReviewForm,
    transferVarianceReviewSelectedTransfer, transferVarianceReviewLoading,
    transferVarianceReviewErrors, transferVarianceReviewSubmitting,
    onTransferVarianceReviewDialogOpenChange,
    submitTransferVarianceReview, transferVarianceReviewLines,
    createRequisitionDialogOpen, reqCreateErrors, reqCreateSubmitting, reqForm,
    updateRequisitionDepartment, selectedRequisitionDepartment, selectedRequisitionWarehouse,
    selectedRequisitionDepartmentId, REQUISITION_PRIORITIES, handleReqLineItemSelected,
    addReqLine, removeReqLine, submitCreateRequisition, requisitionDepartmentHelperText,
    createItemDialogOpen: ref(false), openCreateItemDialog: () => {}, closeCreateItemDialog: () => {},
    stockMovementDialogOpen: ref(false), openStockMovementDialog: () => {},
    catalogueSyncDialogOpen: ref(false), openCatalogSyncDialog: () => {},
    createBatchDialogOpen: ref(false), batchForm: reactive({}), batchCreateSubmitting: ref(false),
    batchCreateErrors: ref({}), submitCreateBatch: () => Promise.resolve(),
    createUnitDialogOpen: ref(false), openCreateUnitDialog: () => {},
    unitForm: reactive({}), unitFormErrors: ref({}), unitFormSubmitting: ref(false),
    submitCreateUnit: () => Promise.resolve(), submitDeactivateUnit: () => Promise.resolve(),
    editingUnitId: ref(null), openEditUnitDialog: () => {}, itemUnits: ref([]),
    itemUnitsLoading: ref(false), loadItemUnits: () => Promise.resolve(), resetUnitForm: () => {},
    unitPrices: ref([]), unitPricesLoading: ref(false), loadItemUnitPrices: () => Promise.resolve(),
    itemDetailsOpen: ref(false), itemDetailsLoading: ref(false), itemDetailsError: ref(null),
    itemDetailsTab: ref('overview'), itemDetails: ref(null), itemUpdateForm: reactive({} as any),
    itemUpdateErrors: ref({}), itemUpdateSubmitting: ref(false), submitItemUpdate: () => Promise.resolve(),
    itemStatusForm: reactive({}), itemStatusSubmitting: ref(false), itemStatusError: ref(null),
    submitItemStatus: () => Promise.resolve(), itemBatches: ref([]), itemBatchesLoading: ref(false),
    loadItemBatches: () => Promise.resolve(), expiryBadgeClass: () => '',
    clinicalCatalogLabel: () => '', itemAuditLogs: ref([]), itemAuditLoading: ref(false),
    itemAuditError: ref(null), itemAuditMeta: ref(null), itemAuditFilters: reactive({}),
    inventoryAccess, referenceStructureLoaded: ref(true), barcodeScannerOpen: ref(false),
    barcodeInput: ref(''), barcodeLookupLoading: ref(false), barcodeLookupError: ref(null),
    barcodeLookupResult: ref(null), onBarcodeKeydown: () => {}, lookupBarcode: () => Promise.resolve(),
    applyDetailsAuditFilters: () => {}, resetDetailsAuditFilters: () => {},
    auditActorTypeOptions: computed(() => [
        { value: 'user', label: 'User' }, { value: 'system', label: 'System' },
    ]),
    detailsAuditError: ref(null), detailsAuditExporting: ref(false),
    detailsAuditFilters: reactive({ q: '', action: '', actorType: '', actorId: '', from: '', to: '', page: 1, perPage: 20 }),
    detailsAuditLoading: ref(false), detailsAuditLogs: ref([]), detailsAuditMeta: ref(null),
    detailsOpen: ref(false), detailsRequest: ref(null),
    exportDetailsAuditLogsCsv: () => Promise.resolve(),
    goToDetailsAuditPage: () => {},
    openSourceRequisitionFromProcurement: () => {},
    placeOrderDialogOpen: ref(false), placeOrderError: ref(null),
    placeOrderErrors: ref({} as Record<string, string>),
    placeOrderForm: reactive({ supplierId: '', notes: '' }),
    placeOrderRequest: ref(null), placeOrderSubmitting: ref(false),
    submitPlaceOrder: () => Promise.resolve(), openPlaceOrderDialog: () => {},
    procurementManualStatusOptions: computed(() => []),
    procurementSourceLabel: () => null,
    receiveDialogOpen: ref(false), receiveError: ref(null),
    receiveErrors: ref({} as Record<string, string>),
    receiveForm: reactive({ warehouseId: '', notes: '', receivedAt: '' }),
    receiveItemUnits: computed(() => []),
    receiveRequest: ref(null), receiveRequiresBatchTracking: computed(() => false),
    receiveSubmitting: ref(false), receiveTrackedCategory: computed(() => null),
    submitReceiveGoods: () => Promise.resolve(), openReceiveDialog: () => {},
    sourceRequisitionOpeningId: ref(null),
    statusDialogOpen: ref(false), statusError: ref(null),
    statusReason: ref(''), statusRequest: ref(null),
    statusSubmitting: ref(false), statusValue: ref(''),
    submitStatusUpdate: () => Promise.resolve(), openStatusDialog: () => {},
    supplierLabel: (id: string | null | undefined) => id ?? null,
    transferStatusForm: reactive({ status: '', reason: '' }),
    createPriceDialogOpen: ref(false),
    itemStatusOptions: computed(() => ['active', 'inactive'] as const),
    stockMovementOpeningBalanceMode: computed(() => false),
    stockMovementSheetTitle: computed(() => 'Stock Movement'),
    stockMovementSheetDescription: computed(() => 'Record a stock movement'),
    openDepartmentStockForItem: () => {},
    resetStockLedgerFilters: () => {},
    stockLedgerSummary: ref({ total: 0, receive: 0, issue: 0, adjust: 0, transfer: 0 }),
    exportStockLedgerCsv: () => {},
    exportInventoryItemsCsv: () => {},
    exportDepartmentStockCsv: () => {},
    printCurrentView: () => {},
    departmentStockSummary: ref({ totalRows: 0, departments: 0, items: 0, totalIssuedQuantity: 0, lastIssuedAt: null }),
    departmentStockFiltersOpen: ref(false),
    departmentStockScopedItem: ref(null),
    departmentStockLoading: ref(false),
    clearDepartmentStockItemScope: () => {},
    departmentStockFilters: reactive({ q: '', departmentId: '', page: 1, perPage: 20 }),
    applyDepartmentStockFilters: () => {},
    resetDepartmentStockFilters: () => {},
    departmentStock: ref([]), goToDepartmentStockPage: () => {},
    departmentStockPagination: ref(null), departmentStockPages: computed(() => 1),
    itemFilterChips: computed(() => []), hasAnyItemFilters: computed(() => false),
    stockStateDotClass: () => '', stockStateLabel: () => '',
    inventoryItemStockActionLabel: () => '', inventoryItemListMeta: () => '',
    inventoryItemNeedsOpeningStock: () => false, inventoryItemHasOpeningStock: () => false,
    stockAlertBadgeClass: () => '',
    isSubmittingInventoryWorkflow: computed(() => false),
    hasPendingCreateItemWorkflow: computed(() => false),
    hasPendingItemDetailsWorkflow: computed(() => false),
    itemCreateValidationMessages: computed(() => []),
    createItemRequestKey: ref(''), itemUpdateRequestKey: ref(''), itemStatusRequestKey: ref(''),
    createItemDiscardConfirmOpen: ref(false), itemDetailsDiscardConfirmOpen: ref(false),
    requestCreateItemOpenChange: () => {}, confirmCreateItemDiscard: () => {},
    restoredCreateItemDraft: { value: false }, discardCreateItemDraft: () => {},
    clearPersistedCreateItemDraft: () => {},
    stockMovementSelectionResetLocked: ref(false),
    refreshInventoryItems: () => {},
    flushInventorySearch: () => {},
    openImportItemsCsvDialog: () => {},
    importItemsCsvDialogOpen: ref(false), importItemsCsvSubmitting: ref(false),
    importItemsCsvFile: ref(null), importItemsCsvInputKey: ref(0), importItemsCsvResult: ref(null),
    closeImportItemsCsvDialog: () => {},
    submitImportItemsCsv: () => Promise.resolve(),
    stockStateOptions: ['out_of_stock', 'low_stock', 'healthy'] as const,
    itemCategoryOptions: ref([]),
    resetItemFilters: () => {},
    canLaunchReconciliation: computed(() => false),
    itemPages: computed(() => 1), goToItemPage: () => {},
    itemSearch: reactive({ q: '', category: '', stockState: '', sortBy: 'itemName', sortDir: 'asc', page: 1, perPage: 50 }),
    selectedUpdateCategory: computed(() => null), updateSubcategoryOptions: computed(() => []),
    updateClinicalCatalogOptions: computed(() => []),
    updateIdentityLockedToCatalog: computed(() => false),
    updateSelectedCatalogItem: computed(() => null),
    updateCategoryWorkflowBadges: computed(() => []),
    updateItemWarehouseOpen: ref(false), updateItemSupplierOpen: ref(false),
    itemCreateRequestError: ref(null), itemCreateSubmitReason: computed(() => null),
    itemCreateSubmitDisabled: computed(() => true),
});
let deptReqSearchTimer: ReturnType<typeof setTimeout> | null = null;
let shortageQueueSearchTimer: ReturnType<typeof setTimeout> | null = null;
let transferSearchTimer: ReturnType<typeof setTimeout> | null = null;

onBeforeUnmount(() => {
    if (deptReqSearchTimer) clearTimeout(deptReqSearchTimer);
    if (shortageQueueSearchTimer) clearTimeout(shortageQueueSearchTimer);
    if (transferSearchTimer) clearTimeout(transferSearchTimer);
    clearSupplyChainPageApi();
});

watch(() => deptReqSearch.q, () => {
    if (deptReqSearchTimer) clearTimeout(deptReqSearchTimer);
    deptReqSearchTimer = setTimeout(() => {
        deptReqSearchTimer = null;
        if (!canRead.value) return;
        deptReqSearch.page = 1;
        void loadDeptRequisitions();
    }, 180);
});
watch(() => deptReqSearch.status, () => { deptReqSearch.page = 1; void loadDeptRequisitions(); });
watch(() => deptReqSearch.departmentId, () => { deptReqSearch.page = 1; void loadDeptRequisitions(); });
watch(() => shortageQueueFilters.q, () => {
    if (shortageQueueSearchTimer) clearTimeout(shortageQueueSearchTimer);
    shortageQueueSearchTimer = setTimeout(() => {
        shortageQueueSearchTimer = null;
        if (!canRead.value) return;
        shortageQueueFilters.page = 1;
        void loadShortageQueue();
    }, 180);
});
watch(() => shortageQueueFilters.readiness, () => { shortageQueueFilters.page = 1; void loadShortageQueue(); });
watch(() => shortageQueueFilters.departmentId, () => { shortageQueueFilters.page = 1; void loadShortageQueue(); });
watch(() => transferSearch.q, () => {
    if (transferSearchTimer) clearTimeout(transferSearchTimer);
    transferSearchTimer = setTimeout(() => {
        transferSearchTimer = null;
        if (!canRead.value) return;
        transferSearch.page = 1;
        void loadWarehouseTransfers();
    }, 180);
});
watch(() => transferSearch.status, () => { transferSearch.page = 1; void loadWarehouseTransfers(); });
watch(() => transferSearch.varianceReview, () => { transferSearch.page = 1; void loadWarehouseTransfers(); });

watch(() => activeTab.value, () => { syncRfStateToUrl(); });
watch(() => [deptReqSearch.q, deptReqSearch.status, deptReqSearch.departmentId, deptReqSearch.page, deptReqSearch.perPage], () => {
    syncRfStateToUrl();
});
watch(() => [shortageQueueFilters.q, shortageQueueFilters.departmentId, shortageQueueFilters.readiness, shortageQueueFilters.page, shortageQueueFilters.perPage], () => {
    syncRfStateToUrl();
});
watch(() => [transferSearch.q, transferSearch.status, transferSearch.varianceReview, transferSearch.page, transferSearch.perPage], () => {
    syncRfStateToUrl();
});

onMounted(async () => {
    hydrateRfStateFromUrl();
    await loadPermissions();
    await Promise.allSettled([
        loadDeptRequisitions(),
        loadShortageQueue(),
        loadWarehouseTransfers(),
    ]);
    loading.value = false;
});
</script>

<template>
    <Head title="Requests &amp; Fulfilment" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="activity" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">Requests &amp; Fulfilment</h1>
                                <Badge v-if="permissionsResolved && !canRead" variant="outline" class="h-5 px-1.5 text-[10px] font-medium">
                                    View only
                                </Badge>
                            </div>
                            <p class="truncate text-xs text-muted-foreground">{{ pageHeaderDescription }}</p>
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
                        <Button v-for="action in headerActions" :key="action.key" :size="'sm'" :variant="action.variant ?? 'outline'" class="h-8 gap-1.5" :disabled="action.disabled" @click="action.onClick?.()">
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
                    <AlertDescription>You do not have `inventory-procurement.read` permission, so this page cannot load the requests data.</AlertDescription>
                </Alert>
            </template>

            <template v-else>
                <Alert v-if="isDepartmentRequester" class="border-primary/30 bg-primary/5">
                    <AlertTitle>Department supply operations</AlertTitle>
                    <AlertDescription>
                        Tabs are limited to what your role can do: requisitions, procurement requests, item lookup, and department stock.
                    </AlertDescription>
                </Alert>

                <Card class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                    <Tabs :model-value="activeTab" :unmount-on-hide="false" class="flex h-full min-h-0 flex-col" @update:model-value="(v) => { activeTab = v as RFTab; }">
                        <div class="flex flex-col gap-3 border-b px-4 py-3">
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div class="min-w-0 shrink-0">
                                    <h3 class="flex items-center gap-2 text-sm font-semibold leading-none whitespace-nowrap">
                                        <AppIcon name="activity" class="size-4 text-primary" />
                                        Requests &amp; Fulfilment
                                    </h3>
                                    <p class="mt-1 text-xs text-muted-foreground">Priorities, department requests, shortages, and warehouse transfers</p>
                                </div>
                            </div>

                            <!-- Toolbar row: search + filters (hidden on overview tab) -->
                            <div v-if="activeTab !== 'overview'" class="flex items-center gap-2">
                                <template v-if="activeTab === 'requisitions'">
                                    <div class="relative min-w-0 flex-1 lg:flex-none">
                                        <AppIcon name="search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            v-model="deptReqSearch.q"
                                            class="h-8 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-72"
                                            placeholder="Req # or department…"
                                            @keydown.enter="deptReqSearch.page = 1; loadDeptRequisitions()"
                                        />
                                    </div>
                                </template>
                                <template v-else-if="activeTab === 'shortage-queue'">
                                    <div class="relative min-w-0 flex-1 lg:flex-none">
                                        <AppIcon name="search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            v-model="shortageQueueFilters.q"
                                            class="h-8 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-72"
                                            placeholder="Search requisition or department…"
                                            @keydown.enter="shortageQueueFilters.page = 1; loadShortageQueue()"
                                        />
                                    </div>
                                </template>
                                <template v-else-if="activeTab === 'transfers'">
                                    <div class="relative min-w-0 flex-1 lg:flex-none">
                                        <AppIcon name="search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            v-model="transferSearch.q"
                                            class="h-8 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-72"
                                            placeholder="Search transfer number…"
                                            @keydown.enter="transferSearch.page = 1; loadWarehouseTransfers()"
                                        />
                                    </div>
                                </template>
                                <SupplyChainFilterPopover :filter-count="filterCount" @apply="applyFilters" @reset="resetAllFilters">
                                    <template v-if="activeTab === 'requisitions'">
                                        <div class="grid gap-2">
                                            <Label>Status</Label>
                                            <Select :model-value="toSelectValue(deptReqSearch.status)" @update:model-value="deptReqSearch.status = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                                <SelectTrigger class="w-full"><SelectValue placeholder="All statuses" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem :value="EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                                    <SelectItem v-for="s in REQUISITION_STATUSES" :key="s" :value="s">{{ formatEnumLabel(s) }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div v-if="canSelectAnyRequisitionDepartment" class="grid gap-2">
                                            <Label>Department</Label>
                                            <Select :model-value="toSelectValue(deptReqSearch.departmentId)" @update:model-value="setDeptReqDepartmentFilter(String($event ?? EMPTY_SELECT_VALUE))">
                                                <SelectTrigger class="w-full"><SelectValue placeholder="All departments" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem :value="EMPTY_SELECT_VALUE">All departments</SelectItem>
                                                    <SelectItem v-for="dept in departmentFilterOptions" :key="dept.id" :value="dept.id">{{ lookupOptionText(dept) }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </template>
                                    <template v-else-if="activeTab === 'shortage-queue'">
                                        <div class="grid gap-2">
                                            <Label>Readiness</Label>
                                            <Select :model-value="toSelectValue(shortageQueueFilters.readiness)" @update:model-value="shortageQueueFilters.readiness = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE)); shortageQueueFilters.page = 1; loadShortageQueue()">
                                                <SelectTrigger class="w-full"><SelectValue placeholder="All" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem :value="EMPTY_SELECT_VALUE">All</SelectItem>
                                                    <SelectItem value="ready">Ready</SelectItem>
                                                    <SelectItem value="waiting">Waiting</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div v-if="canSelectAnyRequisitionDepartment" class="grid gap-2">
                                            <Label>Department</Label>
                                            <Select :model-value="toSelectValue(shortageQueueFilters.departmentId)" @update:model-value="(v) => { setShortageQueueDepartmentFilter(String(v ?? EMPTY_SELECT_VALUE)); shortageQueueFilters.page = 1; loadShortageQueue() }">
                                                <SelectTrigger class="w-full"><SelectValue placeholder="All departments" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem :value="EMPTY_SELECT_VALUE">All departments</SelectItem>
                                                    <SelectItem v-for="dept in departmentFilterOptions" :key="dept.id" :value="dept.id">{{ lookupOptionText(dept) }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </template>
                                    <template v-else-if="activeTab === 'transfers'">
                                        <div class="grid gap-2">
                                            <Label>Status</Label>
                                            <Select :model-value="toSelectValue(transferSearch.status)" @update:model-value="transferSearch.status = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE)); transferSearch.page = 1; loadWarehouseTransfers()">
                                                <SelectTrigger class="w-full"><SelectValue placeholder="All statuses" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem :value="EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                                    <SelectItem v-for="s in TRANSFER_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label>Review queue</Label>
                                            <Select :model-value="toSelectValue(transferSearch.varianceReview)" @update:model-value="transferSearch.varianceReview = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE)); transferSearch.page = 1; loadWarehouseTransfers()">
                                                <SelectTrigger class="w-full"><SelectValue placeholder="All reviews" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem v-for="option in TRANSFER_VARIANCE_REVIEW_FILTER_OPTIONS" :key="`trf-vr-${option.value || 'all'}`" :value="option.value || EMPTY_SELECT_VALUE">{{ option.label }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </template>
                                </SupplyChainFilterPopover>
                            </div>

                            <TabsList class="grid h-9 w-full grid-cols-4 gap-1 bg-muted/40 p-1">
                                <TabsTrigger value="overview" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <span class="flex items-center gap-1 leading-none">
                                        <AppIcon name="alert-triangle" class="size-3" />
                                        Request Priorities
                                    </span>
                                </TabsTrigger>
                                <TabsTrigger value="requisitions" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <span class="flex items-center gap-1 leading-none">
                                        <AppIcon name="clipboard-list" class="size-3" />
                                        Stock Requests
                                    </span>
                                </TabsTrigger>
                                <TabsTrigger value="shortage-queue" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <span class="flex items-center gap-1 leading-none">
                                        <AppIcon name="alert-triangle" class="size-3" />
                                        Stock Shortages
                                    </span>
                                    <Badge v-if="(shortageQueueMeta?.readyLineCount ?? 0) > 0" variant="secondary" class="h-5 min-w-5 justify-center px-1 text-[10px] tabular-nums">{{ shortageQueueMeta!.readyLineCount }}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="transfers" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <span class="flex items-center gap-1 leading-none">
                                        <AppIcon name="activity" class="size-3" />
                                        Transfers
                                    </span>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <TabsContent value="overview" class="m-0 flex min-h-0 flex-1 flex-col">
                                <SupplyChainOverviewTab
                                    :next-actions="nextActions"
                                    :request-pipeline-stages="requestPipelineStages"
                                    :requisitions-ready-count="requisitionsReadyCount"
                                    :requisitions-waiting-count="requisitionsWaitingCount"
                                    :department-requisition-total="departmentRequisitionTotal"
                                    @change-tab="(v: string) => { activeTab = v as RFTab; }"
                                    @refresh-pipeline="loadRequestPipelineCounts"
                                    @open-pipeline-stage="openRequestPipelineStage"
                                />
                            </TabsContent>
                            <TabsContent value="requisitions" class="m-0 flex min-h-0 flex-1 flex-col">
                                <SupplyChainRequisitionsTab />
                            </TabsContent>
                            <TabsContent value="shortage-queue" class="m-0 flex min-h-0 flex-1 flex-col">
                                <SupplyChainShortageQueueTab />
                            </TabsContent>
                            <TabsContent value="transfers" class="m-0 flex min-h-0 flex-1 flex-col">
                                <SupplyChainTransfersTab />
                            </TabsContent>
                        </div>
                    </Tabs>
                </Card>
            </template>
        </div>
    </AppLayout>

    <SupplyChainRequestEntrySheets />
    <SupplyChainRequisitionDetailsSheet />
    <SupplyChainTransferSheets />
    <SupplyChainProcurementLifecycleSheets />
</template>



