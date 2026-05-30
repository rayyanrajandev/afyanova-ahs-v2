export type DashboardWorkflowKey =
    | 'front_desk'
    | 'clinician'
    | 'nursing'
    | 'emergency'
    | 'direct_service'
    | 'cashier'
    | 'admin'
    | 'operations'
    | 'records'
    | 'supply'
    | 'theatre';

/** @deprecated Use DashboardWorkflowKey — kept for gradual migration in Dashboard.vue */
export type DashboardPresetKey = DashboardWorkflowKey;

export type DashboardWorkflowWidget = {
    id: string;
    label: string;
    permission: string;
};

export type DashboardWorkflowDefinition = {
    key: DashboardWorkflowKey;
    label: string;
    description: string;
    modules: string[];
    widgets?: DashboardWorkflowWidget[];
};

export type DashboardContextPayload = {
    schemaVersion: string;
    defaultWorkflowKey: DashboardWorkflowKey;
    eligibleWorkflowKeys: DashboardWorkflowKey[];
    workflows: DashboardWorkflowDefinition[];
    canSwitchWorkflow: boolean;
    session: {
        roleCodes: string[];
        permissionCount: number;
    };
};
