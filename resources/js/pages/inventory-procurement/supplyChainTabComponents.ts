import { defineAsyncComponent } from 'vue';

export const SupplyChainOverviewTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/components/SupplyChainOverviewTab.vue'),
);

export const SupplyChainRequisitionsTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/components/SupplyChainRequisitionsTab.vue'),
);

export const SupplyChainClaimsTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/components/SupplyChainClaimsTab.vue'),
);

export const SupplyChainMsdOrdersTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/components/SupplyChainMsdOrdersTab.vue'),
);

export const SupplyChainLeadTimesTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/components/SupplyChainLeadTimesTab.vue'),
);

export const SupplyChainShortageQueueTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/components/SupplyChainShortageQueueTab.vue'),
);

export const SupplyChainTransfersTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/components/SupplyChainTransfersTab.vue'),
);

export const SupplyChainInventoryTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/components/SupplyChainInventoryTab.vue'),
);

export const SupplyChainDepartmentStockTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/components/SupplyChainDepartmentStockTab.vue'),
);

export const SupplyChainProcurementTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/components/SupplyChainProcurementTab.vue'),
);

export const SupplyChainLedgerTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/components/SupplyChainLedgerTab.vue'),
);

export const SupplyChainAnalyticsTab = defineAsyncComponent(
    () => import('@/pages/inventory-procurement/components/SupplyChainAnalyticsTab.vue'),
);


