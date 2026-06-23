import { apiRequestJson } from '@/lib/apiClient';

export type ApprovalInstance = {
    id: string;
    requisition_id: string;
    requisition_number: string;
    requesting_department: string;
    workflow_status: string;
    current_step: number;
    total_steps: number;
    created_at: string | null;
};

export type ApprovalDecisionResponse = {
    success: boolean;
    workflow_instance: {
        id: string;
        status: string;
        current_step: string;
        step_number: number;
    };
};

export type RecallResponse = {
    success: boolean;
    workflow_instance: {
        id: string;
        status: string;
        recalled_decision_id: string | null;
        recall_reason: string | null;
    };
};

export async function fetchPendingApprovals(): Promise<ApprovalInstance[]> {
    const response = await apiRequestJson<{ data: ApprovalInstance[] }>('GET', '/inventory-department/approvals/pending');
    return response.data;
}

export async function approveRequisition(
    workflowInstanceId: string,
    comments?: string,
): Promise<ApprovalDecisionResponse> {
    return apiRequestJson<ApprovalDecisionResponse>(
        'POST',
        `/inventory-department/approvals/${workflowInstanceId}/approve`,
        { body: { decision: 'approved', comments: comments ?? null } },
    );
}

export async function rejectRequisition(
    workflowInstanceId: string,
    comments: string,
): Promise<ApprovalDecisionResponse> {
    return apiRequestJson<ApprovalDecisionResponse>(
        'POST',
        `/inventory-department/approvals/${workflowInstanceId}/reject`,
        { body: { decision: 'rejected', comments } },
    );
}

export async function recallRequisition(
    workflowInstanceId: string,
    reason?: string,
): Promise<RecallResponse> {
    return apiRequestJson<RecallResponse>(
        'POST',
        `/inventory-department/approvals/${workflowInstanceId}/recall`,
        { body: { reason: reason ?? null } },
    );
}
