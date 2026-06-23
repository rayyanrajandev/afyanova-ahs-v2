<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FacilityWorkspacePageHeader from '@/components/layout/FacilityWorkspacePageHeader.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import {
    type DepartmentRequisitionContext,
    departmentCardDescription,
    departmentDisplayName,
    departmentRequesterHeaderDescription,
} from '@/lib/departmentRequisitionContext';
import {
    INVENTORY_PROCUREMENT_COUNT_PATH,
    INVENTORY_PROCUREMENT_HOME_PATH,
    INVENTORY_PROCUREMENT_ISSUE_PATH,
    INVENTORY_PROCUREMENT_RECEIVE_PATH,
    INVENTORY_PROCUREMENT_WORKSPACE_PATH,
    inventoryWorkspaceHref,
    inventoryWorkspaceSectionLabels,
    type InventoryWorkspaceSection,
} from '@/lib/inventoryProcurement';
import {
    isInventoryDepartmentRequester,
    isInventoryStoreOperations,
    visibleInventoryWorkspaceSections,
    type InventoryProcurementAccess,
} from '@/lib/inventoryProcurementAccess';
import { messageFromUnknown } from '@/lib/notify';
import SupplyChainStatCard from '@/pages/inventory-procurement/components/SupplyChainStatCard.vue';
import SupplyChainStatGrid from '@/pages/inventory-procurement/components/SupplyChainStatGrid.vue';
import type { BreadcrumbItem } from '@/types';

type StockAlertCounts = {
    outOfStock: number;
    lowStock: number;
    healthy: number;
    total: number;
};

type ShortageQueueMeta = {
    total?: number;
    readyLineCount?: number;
    waitingLineCount?: number;
};

type TaskCard = {
    id: string;
    title: string;
    description: string;
    icon: 'package' | 'clipboard-list' | 'activity' | 'alert-triangle' | 'building-2' | 'shield-check' | 'search' | 'check-circle';
    href: string;
    badge?: string | number | null;
    badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
    permission?: boolean;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Supply chain', href: INVENTORY_PROCUREMENT_HOME_PATH },
];

const { permissionNames: sharedPermissionNames, isFacilitySuperAdmin, scope } = usePlatformAccess();

const loading = ref(true);
const error = ref<string | null>(null);
const dashboardWarnings = ref<string[]>([]);

const canRead = ref(false);
const canManageItems = ref(false);
const canCreateMovement = ref(false);
const canCreateRequest = ref(false);
const canUpdateRequestStatus = ref(false);
const canManageSuppliers = ref(false);
const canManageWarehouses = ref(false);
const canReconcileStock = ref(false);
const canViewAudit = ref(false);

const stockCounts = ref<StockAlertCounts>({ outOfStock: 0, lowStock: 0, healthy: 0, total: 0 });
const shortageMeta = ref<ShortageQueueMeta | null>(null);
const pendingApprovalCount = ref(0);
const approvedAwaitingOrderCount = ref(0);

const supplyChainPageTitle = computed(() => {
    const facilityName = String(scope.value?.facility?.name ?? '').trim();
    const facilityCode = String(scope.value?.facility?.code ?? '').trim().toUpperCase();

    if (facilityName) return `${facilityName} supply chain`;
    if (facilityCode) return `${facilityCode} supply chain`;

    return 'Supply chain';
});

function resolvePermissions(names: Iterable<string>, hasSuperAdmin: boolean): void {
    const set = new Set(
        Array.from(names)
            .map((name) => String(name ?? '').trim())
            .filter((name) => name.length > 0),
    );

    canRead.value = hasSuperAdmin || set.has('inventory.procurement.read');
    canManageItems.value = hasSuperAdmin || set.has('inventory.procurement.manage-items');
    canCreateMovement.value = hasSuperAdmin || set.has('inventory.procurement.create-movement');
    canCreateRequest.value = hasSuperAdmin || set.has('inventory.procurement.create-request');
    canUpdateRequestStatus.value = hasSuperAdmin || set.has('inventory.procurement.update-request-status');
    canManageSuppliers.value = hasSuperAdmin || set.has('inventory.procurement.manage-suppliers');
    canManageWarehouses.value = hasSuperAdmin || set.has('inventory.procurement.manage-warehouses');
    canReconcileStock.value = hasSuperAdmin
        || set.has('inventory.procurement.reconcile-stock')
        || set.has('inventory.procurement.create-movement');
    canViewAudit.value = hasSuperAdmin || set.has('inventory.procurement.view-audit-logs');
}

async function loadPermissions(): Promise<void> {
    resolvePermissions(sharedPermissionNames.value ?? [], isFacilitySuperAdmin.value);

    try {
        const response = await apiRequestJson<{ data?: Array<{ name?: string }> }>('GET', '/auth/me/permissions');
        resolvePermissions(
            (response.data ?? []).map((item) => item.name ?? ''),
            isFacilitySuperAdmin.value,
        );
    } catch {
        resolvePermissions(sharedPermissionNames.value ?? [], isFacilitySuperAdmin.value);
    }
}

async function loadDashboard(): Promise<void> {
    if (!canRead.value) {
        return;
    }

    loading.value = true;
    error.value = null;
    dashboardWarnings.value = [];

    const results = await Promise.allSettled([
        apiRequestJson<{ data: StockAlertCounts }>('GET', '/inventory-procurement/stock-alert-counts', {
            query: { limit: 1 },
        }),
        apiRequestJson<{ data: unknown[]; meta: ShortageQueueMeta }>('GET', '/inventory-procurement/shortage-queue', {
            query: { page: 1, perPage: 1, readiness: 'all' },
        }),
        apiRequestJson<{ data: unknown[]; meta: { total?: number } }>('GET', '/inventory-procurement/procurement-requests', {
            query: { status: 'pending_approval', page: 1, perPage: 1 },
        }),
        apiRequestJson<{ data: unknown[]; meta: { total?: number } }>('GET', '/inventory-procurement/procurement-requests', {
            query: { status: 'approved', page: 1, perPage: 1 },
        }),
    ] as const);

    const warnings: string[] = [];
    const [countsResult, shortageResult, pendingResult, approvedResult] = results;

    if (countsResult.status === 'fulfilled') {
        stockCounts.value = countsResult.value.data ?? stockCounts.value;
    } else {
        warnings.push(`Stock alerts: ${messageFromUnknown(countsResult.reason, 'Unavailable')}`);
    }

    if (shortageResult.status === 'fulfilled') {
        shortageMeta.value = shortageResult.value.meta ?? null;
    } else {
        shortageMeta.value = null;
        warnings.push(`Shortage queue: ${messageFromUnknown(shortageResult.reason, 'Unavailable')}`);
    }

    if (pendingResult.status === 'fulfilled') {
        pendingApprovalCount.value = pendingResult.value.meta?.total ?? 0;
    } else {
        pendingApprovalCount.value = 0;
        warnings.push(`Pending approvals: ${messageFromUnknown(pendingResult.reason, 'Unavailable')}`);
    }

    if (approvedResult.status === 'fulfilled') {
        approvedAwaitingOrderCount.value = approvedResult.value.meta?.total ?? 0;
    } else {
        approvedAwaitingOrderCount.value = 0;
        warnings.push(`Approved orders: ${messageFromUnknown(approvedResult.reason, 'Unavailable')}`);
    }

    dashboardWarnings.value = warnings;
    if (warnings.length === results.length) {
        error.value = 'All supply chain overview services returned an error.';
    }

    loading.value = false;
}

function workspaceSection(section: InventoryWorkspaceSection, extra: Record<string, string> = {}): string {
    return inventoryWorkspaceHref({ section, ...extra });
}

const storeTasks = computed<TaskCard[]>(() => [
    {
        id: 'receive',
        title: 'Receive deliveries',
        description: 'Step-by-step receipt from purchase orders or direct delivery into store.',
        icon: 'clipboard-list',
        href: INVENTORY_PROCUREMENT_RECEIVE_PATH,
        permission: canCreateMovement.value,
    },
    {
        id: 'issue',
        title: 'Issue to ward',
        description: 'Issue stock to departments with reason and traceability.',
        icon: 'package',
        href: INVENTORY_PROCUREMENT_ISSUE_PATH,
        permission: canCreateMovement.value,
    },
    {
        id: 'count',
        title: 'Cycle count',
        description: 'Physical count and post variance to match store on-hand.',
        icon: 'check-circle',
        href: INVENTORY_PROCUREMENT_COUNT_PATH,
        permission: canReconcileStock.value,
    },
    {
        id: 'pending-approvals',
        title: 'Pending approvals',
        description: 'Review and approve department requisitions in the approval queue.',
        icon: 'shield-check',
        href: '/inventory-procurement/pending-approvals',
        badge: pendingApprovalCount.value > 0 ? pendingApprovalCount.value : null,
        badgeVariant: pendingApprovalCount.value > 0 ? 'destructive' : 'outline',
        permission: canUpdateRequestStatus.value,
    },
    {
        id: 'shortage',
        title: 'Shortage queue',
        description: 'Prioritise VEN-sensitive lines waiting for replenishment or procurement.',
        icon: 'alert-triangle',
        href: workspaceSection('shortage-queue'),
        badge: shortageMeta.value?.readyLineCount ?? null,
        badgeVariant: 'destructive',
        permission: canRead.value,
    },
    {
        id: 'ledger',
        title: 'Stock ledger',
        description: 'Full movement history, exports, and clinical consumption trace.',
        icon: 'activity',
        href: workspaceSection('ledger'),
        permission: canRead.value,
    },
]);

const inventoryAccess = computed<InventoryProcurementAccess>(() => ({
    canRead: canRead.value,
    canManageItems: canManageItems.value,
    canCreateMovement: canCreateMovement.value,
    canReconcileStock: canReconcileStock.value,
    canCreateRequest: canCreateRequest.value,
    canUpdateRequestStatus: canUpdateRequestStatus.value,
    canViewAudit: canViewAudit.value,
    canManageSuppliers: canManageSuppliers.value,
    canManageWarehouses: canManageWarehouses.value,
}));

const isStoreOperations = computed(() => isInventoryStoreOperations(inventoryAccess.value));
const isDepartmentRequester = computed(() => isInventoryDepartmentRequester(inventoryAccess.value));

const departmentTasks = computed<TaskCard[]>(() => [
    {
        id: 'requisitions',
        title: 'Department requisitions',
        description: 'Request lab consumables and supplies for your unit.',
        icon: 'clipboard-list',
        href: workspaceSection('requisitions'),
        permission: canCreateRequest.value,
    },
    {
        id: 'procurement',
        title: 'Procurement requests',
        description: 'Raise purchase requests when central store approval is required.',
        icon: 'package',
        href: workspaceSection('procurement'),
        permission: canCreateRequest.value,
    },
    {
        id: 'dept-stock',
        title: 'Department stock',
        description: 'See on-hand balances allocated to your department.',
        icon: 'building-2',
        href: workspaceSection('department-stock'),
        permission: canRead.value,
    },
    {
        id: 'item-lookup',
        title: 'Find items',
        description: 'Search the item catalog to pick the right product code.',
        icon: 'package',
        href: workspaceSection('inventory'),
        permission: canRead.value,
    },
]);

const masterDataTasks = computed<TaskCard[]>(() => [
    {
        id: 'items',
        title: 'Item master',
        description: 'Create consumables, medicines, lab reagents, and set reorder defaults.',
        icon: 'package',
        href: workspaceSection('inventory'),
        permission: canRead.value && (canManageItems.value || isStoreOperations.value),
    },
    {
        id: 'suppliers',
        title: 'Suppliers',
        description: 'Vendor registry, contacts, and supplier performance.',
        icon: 'building-2',
        href: '/inventory-procurement/suppliers',
        permission: canManageSuppliers.value,
    },
    {
        id: 'warehouses',
        title: 'Warehouses',
        description: 'Store locations, transfers, and warehouse lifecycle.',
        icon: 'building-2',
        href: '/inventory-procurement/warehouses',
        permission: canManageWarehouses.value,
    },
]);

const planningTasks = computed<TaskCard[]>(() => [
    {
        id: 'msd',
        title: 'MSD orders',
        description: 'National Medical Store e-ordering and delivery sync.',
        icon: 'clipboard-list',
        href: workspaceSection('msd-orders'),
        permission: canCreateRequest.value,
    },
    {
        id: 'analytics',
        title: 'Analytics',
        description: 'ABC/VEN matrix, expiry wastage, turnover, and consumption trends.',
        icon: 'activity',
        href: workspaceSection('analytics'),
        permission: isStoreOperations.value,
    },
    {
        id: 'transfers',
        title: 'Transfers',
        description: 'Move stock between warehouses with pick slips and variance review.',
        icon: 'package',
        href: workspaceSection('transfers'),
        permission: canCreateMovement.value,
    },
]);

const sectionQuickLinks = computed(() =>
    visibleInventoryWorkspaceSections(inventoryAccess.value).map((section) => ({
        section,
        label: inventoryWorkspaceSectionLabels[section],
        href: workspaceSection(section),
    })),
);

const visibleStoreTasks = computed(() => storeTasks.value.filter((entry) => entry.permission));

const showMasterDataCard = computed(() => masterDataTasks.value.some((entry) => entry.permission));
const showPlanningCard = computed(() => planningTasks.value.some((entry) => entry.permission));

const registryRowGridClass = computed(() =>
    showMasterDataCard.value && showPlanningCard.value ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4 grid-cols-1',
);

const showPrimaryOperationsCard = computed(
    () => isDepartmentRequester.value || visibleStoreTasks.value.length > 0,
);
const showProcurementSignalsCard = computed(() => isStoreOperations.value || canCreateRequest.value);

const operationsRowGridClass = computed(() =>
    showPrimaryOperationsCard.value && showProcurementSignalsCard.value
        ? 'grid gap-4 lg:grid-cols-3'
        : 'grid gap-4 grid-cols-1',
);

const primaryOperationsCardClass = computed(() =>
    showProcurementSignalsCard.value && showPrimaryOperationsCard.value ? 'lg:col-span-2' : '',
);

function storeTaskGridClass(index: number, total: number): string {
    const isLastOdd = total % 2 === 1 && index === total - 1;

    return isLastOdd ? 'sm:col-span-2' : '';
}

const departmentContext = ref<DepartmentRequisitionContext | null>(null);
const departmentContextLoading = ref(false);

const resolvedDepartmentName = computed(() => departmentDisplayName(departmentContext.value));

const departmentSectionTitle = computed(() => resolvedDepartmentName.value ?? 'Your department');

const departmentSectionDescription = computed(() => departmentCardDescription(departmentContext.value));

const headerDescription = computed(() =>
    isDepartmentRequester.value
        ? departmentRequesterHeaderDescription(departmentContext.value)
        : 'Stores, procurement, and clinical consumables — start with a task below or open the full workspace.',
);

const showDepartmentInHeader = computed(
    () => isDepartmentRequester.value && canCreateRequest.value,
);

async function loadDepartmentContext(): Promise<void> {
    if (!canCreateRequest.value) {
        departmentContext.value = null;

        return;
    }

    try {
        const response = await apiRequestJson<{ data: DepartmentRequisitionContext }>(
            'GET',
            '/inventory-procurement/department-requisitions/context',
        );
        departmentContext.value = response.data ?? null;
    } catch {
        departmentContext.value = null;
    }
}

onMounted(async () => {
    await loadPermissions();

    if (showDepartmentInHeader.value) {
        departmentContextLoading.value = true;
        try {
            await loadDepartmentContext();
        } finally {
            departmentContextLoading.value = false;
        }
    } else {
        departmentContextLoading.value = false;
        if (canCreateRequest.value) {
            void loadDepartmentContext();
        }
    }

    await loadDashboard();
});
</script>

<template>
    <Head title="Supply chain" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <FacilityWorkspacePageHeader
                :title="supplyChainPageTitle"
                :description="headerDescription"
                icon="package"
                :department-name="showDepartmentInHeader ? resolvedDepartmentName : null"
                :department-loading="showDepartmentInHeader && departmentContextLoading"
            >
                <template #actions>
                    <Button
                        variant="outline"
                        size="sm"
                        class="h-8 min-w-0 gap-1.5 max-md:flex-1"
                        :disabled="loading"
                        @click="loadDashboard"
                    >
                        <AppIcon name="refresh-cw" class="size-3.5" />
                        {{ loading ? 'Refreshing…' : 'Refresh' }}
                    </Button>
                    <Button v-if="canRead" size="sm" class="h-8 min-w-0 gap-1.5 max-md:flex-1" as-child>
                        <Link
                            :href="INVENTORY_PROCUREMENT_WORKSPACE_PATH"
                            class="inline-flex min-w-0 items-center justify-center gap-1.5 max-md:w-full"
                        >
                            <AppIcon name="layout-grid" class="size-3.5" />
                            Full workspace
                        </Link>
                    </Button>
                </template>
            </FacilityWorkspacePageHeader>

            <Alert v-if="!canRead && !loading" variant="destructive">
                <AlertTitle>Access restricted</AlertTitle>
                <AlertDescription>You do not have permission to view hospital supply chain data.</AlertDescription>
            </Alert>

            <Alert v-else-if="error" variant="destructive">
                <AlertTitle>Overview unavailable</AlertTitle>
                <AlertDescription>
                    <span class="block">{{ error }}</span>
                    <span
                        v-for="warning in dashboardWarnings"
                        :key="warning"
                        class="block"
                    >
                        {{ warning }}
                    </span>
                </AlertDescription>
            </Alert>

            <template v-if="canRead">
                <Alert v-if="dashboardWarnings.length > 0 && !error" class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <AlertTitle>Some supply chain signals are unavailable</AlertTitle>
                    <AlertDescription>
                        <span class="block" v-for="warning in dashboardWarnings" :key="warning">{{ warning }}</span>
                    </AlertDescription>
                </Alert>

                <SupplyChainStatGrid :loading="loading">
                    <SupplyChainStatCard
                        label="Store out"
                        :value="stockCounts.outOfStock"
                        icon="alert-triangle"
                        :tone="stockCounts.outOfStock > 0 ? 'destructive' : 'green'"
                    />
                    <SupplyChainStatCard
                        label="Store low"
                        :value="stockCounts.lowStock"
                        icon="activity"
                        :tone="stockCounts.lowStock > 0 ? 'amber' : 'green'"
                    />
                    <SupplyChainStatCard
                        label="Store healthy"
                        :value="stockCounts.healthy"
                        icon="check-circle"
                        tone="green"
                    />
                    <SupplyChainStatCard
                        label="Active items"
                        :value="stockCounts.total"
                        icon="package"
                        tone="primary"
                    />
                </SupplyChainStatGrid>

                <Alert v-if="isDepartmentRequester" class="border-primary/30 bg-primary/5">
                    <AlertTitle>Department supply access</AlertTitle>
                    <AlertDescription>
                        You can request stock for your unit. Central store tasks such as receive, issue, and cycle count are reserved for storekeepers.
                    </AlertDescription>
                </Alert>

                <div :class="operationsRowGridClass">
                    <Card v-if="isDepartmentRequester" class="rounded-lg shadow-sm" :class="primaryOperationsCardClass">
                        <CardHeader class="pb-2">
                            <CardTitle class="text-base">
                                <Skeleton v-if="departmentContextLoading" class="h-5 w-32" />
                                <template v-else>{{ departmentSectionTitle }}</template>
                            </CardTitle>
                            <CardDescription>
                                <Skeleton v-if="departmentContextLoading" class="mt-1 h-4 w-full max-w-md" />
                                <template v-else>{{ departmentSectionDescription }}</template>
                            </CardDescription>
                        </CardHeader>
                        <CardContent class="grid gap-3 sm:grid-cols-2">
                            <Link
                                v-for="(task, index) in departmentTasks.filter((entry) => entry.permission)"
                                :key="task.id"
                                :href="task.href"
                                :class="[
                                    'group flex flex-col rounded-lg border bg-muted/15 p-3 transition-colors hover:border-primary/40 hover:bg-muted/30',
                                    storeTaskGridClass(index, departmentTasks.filter((entry) => entry.permission).length),
                                ]"
                            >
                                <div class="flex items-start justify-between gap-2">
                                    <div class="flex items-center gap-2">
                                        <AppIcon :name="task.icon" class="size-4 text-muted-foreground group-hover:text-primary" />
                                        <span class="text-sm font-medium">{{ task.title }}</span>
                                    </div>
                                </div>
                                <p class="mt-2 text-xs leading-relaxed text-muted-foreground">{{ task.description }}</p>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card v-else-if="visibleStoreTasks.length > 0" class="rounded-lg shadow-sm" :class="primaryOperationsCardClass">
                        <CardHeader class="pb-2">
                            <CardTitle class="text-base">Store operations</CardTitle>
                            <CardDescription>Daily tasks for storekeepers and issuing clerks.</CardDescription>
                        </CardHeader>
                        <CardContent class="grid gap-3 sm:grid-cols-2">
                            <Link
                                v-for="(task, index) in visibleStoreTasks"
                                :key="task.id"
                                :href="task.href"
                                :class="[
                                    'group flex flex-col rounded-lg border bg-muted/15 p-3 transition-colors hover:border-primary/40 hover:bg-muted/30',
                                    storeTaskGridClass(index, visibleStoreTasks.length),
                                ]"
                            >
                                <div class="flex items-start justify-between gap-2">
                                    <div class="flex items-center gap-2">
                                        <AppIcon :name="task.icon" class="size-4 text-muted-foreground group-hover:text-primary" />
                                        <span class="text-sm font-medium">{{ task.title }}</span>
                                    </div>
                                    <Badge v-if="task.badge != null && task.badge !== 0" :variant="task.badgeVariant ?? 'secondary'" class="h-5 min-w-5 justify-center px-1.5 text-[10px]">
                                        {{ task.badge }}
                                    </Badge>
                                </div>
                                <p class="mt-2 text-xs leading-relaxed text-muted-foreground">{{ task.description }}</p>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card v-if="showProcurementSignalsCard" class="rounded-lg shadow-sm">
                        <CardHeader class="pb-2">
                            <CardTitle class="text-base">{{ isDepartmentRequester ? 'Request status' : 'Procurement signals' }}</CardTitle>
                            <CardDescription>
                                {{ isDepartmentRequester ? 'Track procurement queues that affect your department.' : 'Queues needing officer attention.' }}
                            </CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-3 text-sm">
                            <Link v-if="canUpdateRequestStatus" href="/inventory-procurement/pending-approvals" class="flex items-center justify-between rounded-md border px-3 py-2 transition-colors hover:bg-muted/50">
                                <span class="text-muted-foreground">Pending approval</span>
                                <Badge :variant="pendingApprovalCount > 0 ? 'destructive' : 'outline'">{{ pendingApprovalCount }}</Badge>
                            </Link>
                            <div v-if="canUpdateRequestStatus" class="flex items-center justify-between rounded-md border px-3 py-2">
                                <span class="text-muted-foreground">Approved — place order</span>
                                <Badge variant="secondary">{{ approvedAwaitingOrderCount }}</Badge>
                            </div>
                            <div v-if="isStoreOperations" class="flex items-center justify-between rounded-md border px-3 py-2">
                                <span class="text-muted-foreground">Shortage — ready lines</span>
                                <Badge :variant="(shortageMeta?.readyLineCount ?? 0) > 0 ? 'destructive' : 'outline'">
                                    {{ shortageMeta?.readyLineCount ?? 0 }}
                                </Badge>
                            </div>
                            <Button v-if="canCreateRequest" size="sm" variant="outline" class="mt-1 w-full gap-1.5" as-child>
                                <Link :href="workspaceSection('procurement')">
                                    <AppIcon name="plus" class="size-3.5" />
                                    Procurement workspace
                                </Link>
                            </Button>
                            <Button v-if="canCreateMovement" size="sm" variant="outline" class="w-full gap-1.5" as-child>
                                <Link :href="INVENTORY_PROCUREMENT_RECEIVE_PATH">
                                    <AppIcon name="package" class="size-3.5" />
                                    Receive wizard
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div v-if="showMasterDataCard || showPlanningCard" :class="registryRowGridClass">
                    <Card v-if="showMasterDataCard" class="rounded-lg shadow-sm">
                        <CardHeader class="pb-2">
                            <CardTitle class="text-base">Master data</CardTitle>
                            <CardDescription>Items, suppliers, and warehouses.</CardDescription>
                        </CardHeader>
                        <CardContent class="grid gap-3 sm:grid-cols-3">
                            <Link
                                v-for="task in masterDataTasks.filter((entry) => entry.permission)"
                                :key="task.id"
                                :href="task.href"
                                class="rounded-lg border bg-muted/10 p-3 text-sm transition-colors hover:border-primary/40 hover:bg-muted/25"
                            >
                                <AppIcon :name="task.icon" class="mb-2 size-4 text-muted-foreground" />
                                <p class="font-medium">{{ task.title }}</p>
                                <p class="mt-1 text-xs text-muted-foreground">{{ task.description }}</p>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card v-if="showPlanningCard" class="rounded-lg shadow-sm">
                        <CardHeader class="pb-2">
                            <CardTitle class="text-base">Planning & national supply</CardTitle>
                            <CardDescription>MSD, analytics, and inter-store transfers.</CardDescription>
                        </CardHeader>
                        <CardContent class="grid gap-3 sm:grid-cols-3">
                            <Link
                                v-for="task in planningTasks.filter((entry) => entry.permission)"
                                :key="task.id"
                                :href="task.href"
                                class="rounded-lg border bg-muted/10 p-3 text-sm transition-colors hover:border-primary/40 hover:bg-muted/25"
                            >
                                <AppIcon :name="task.icon" class="mb-2 size-4 text-muted-foreground" />
                                <p class="font-medium">{{ task.title }}</p>
                                <p class="mt-1 text-xs text-muted-foreground">{{ task.description }}</p>
                            </Link>
                        </CardContent>
                    </Card>
                </div>

                <div
                    v-if="sectionQuickLinks.length > 0"
                    class="grid w-full gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,9.5rem),1fr))]"
                >
                    <Button
                        v-for="link in sectionQuickLinks"
                        :key="link.section"
                        variant="outline"
                        size="sm"
                        class="h-8 w-full min-w-0 justify-center px-2"
                        as-child
                    >
                        <Link :href="link.href" class="truncate">{{ link.label }}</Link>
                    </Button>
                </div>
            </template>
        </div>
    </AppLayout>
</template>
