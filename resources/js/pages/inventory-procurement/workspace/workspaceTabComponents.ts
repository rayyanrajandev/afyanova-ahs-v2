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
