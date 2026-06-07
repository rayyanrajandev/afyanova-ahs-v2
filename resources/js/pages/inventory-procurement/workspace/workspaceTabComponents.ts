import { defineAsyncComponent } from 'vue';

export const WorkspaceOverviewTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/workspace/WorkspaceOverviewTab.vue'),
);

export const WorkspaceRequisitionsTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/workspace/WorkspaceRequisitionsTab.vue'),
);

export const WorkspaceClaimsTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/workspace/WorkspaceClaimsTab.vue'),
);

export const WorkspaceMsdOrdersTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/workspace/WorkspaceMsdOrdersTab.vue'),
);

export const WorkspaceLeadTimesTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/workspace/WorkspaceLeadTimesTab.vue'),
);

export const WorkspaceShortageQueueTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/workspace/WorkspaceShortageQueueTab.vue'),
);

export const WorkspaceTransfersTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/workspace/WorkspaceTransfersTab.vue'),
);

export const WorkspaceInventoryTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/workspace/WorkspaceInventoryTab.vue'),
);

export const WorkspaceDepartmentStockTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/workspace/WorkspaceDepartmentStockTab.vue'),
);

export const WorkspaceProcurementTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/workspace/WorkspaceProcurementTab.vue'),
);

export const WorkspaceLedgerTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/workspace/WorkspaceLedgerTab.vue'),
);

export const WorkspaceAnalyticsTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/workspace/WorkspaceAnalyticsTab.vue'),
);
