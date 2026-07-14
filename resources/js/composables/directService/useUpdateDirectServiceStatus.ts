import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { DirectServiceRequest } from './useDirectServiceRequests';

/**
 * PATCH /service-requests/{id}/status (UpdateServiceRequestStatusUseCase),
 * gated `service.requests.update-status` and hard department-scoped
 * (ServiceRequestDepartmentScopeResolver — a 403 with code
 * DEPARTMENT_SCOPE_FORBIDDEN comes back for a cross-department attempt).
 * ServiceRequestStatus::allowedForwardTransitions() only allows pending ->
 * {in_progress, cancelled} and in_progress -> {completed, cancelled} —
 * 'pending' itself is never a PATCH target (it's the only starting state).
 * statusReason is required server-side for completed/cancelled
 * (UpdateServiceRequestStatusRequest.php).
 */
export type DirectServiceStatusTarget = 'in_progress' | 'completed' | 'cancelled';

export type UpdateDirectServiceStatusPayload = {
    requestId: string;
    status: DirectServiceStatusTarget;
    statusReason?: string | null;
};

type UpdateDirectServiceStatusResponse = { data: DirectServiceRequest };

export function useUpdateDirectServiceStatus(): UseMutationReturnType<
    DirectServiceRequest,
    Error,
    UpdateDirectServiceStatusPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ requestId, status, statusReason }): Promise<DirectServiceRequest> => {
            const response = await apiPatch<UpdateDirectServiceStatusResponse>(`/service-requests/${requestId}/status`, {
                body: { status, statusReason: statusReason ?? null },
            });
            return response.data;
        },
    });
}
