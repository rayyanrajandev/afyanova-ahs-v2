import { defineAsyncComponent } from 'vue';

export const WorkspaceProfileTab = defineAsyncComponent(
    () => import('@/pages/platform/admin/facility-config/WorkspaceProfileTab.vue'),
);

export const WorkspaceSubscriptionTab = defineAsyncComponent(
    () => import('@/pages/platform/admin/facility-config/WorkspaceSubscriptionTab.vue'),
);

export const WorkspaceAuditTab = defineAsyncComponent(
    () => import('@/pages/platform/admin/facility-config/WorkspaceAuditTab.vue'),
);