import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';

/**
 * Phase 5 of reports/patients-index-modernization-plan.md — the
 * "direct-services" mode of the Visit Handoff sheet: a walk-in patient who
 * needs only a lab/pharmacy/radiology/theatre service, not a doctor visit,
 * per patient-flow's own waiting_direct_service/in_direct_service steps
 * (GetActiveVisitJourneyUseCase — the resulting ServiceRequest is already
 * visible there once created, no separate visibility work needed).
 */
export type DirectServiceType = 'laboratory' | 'pharmacy' | 'radiology' | 'theatre_procedure';

export type DirectServiceRequestVariables = {
    patientId: string;
    serviceType: DirectServiceType;
    departmentId?: string | null;
    priority?: 'routine' | 'urgent';
    notes?: string | null;
};

export type DirectServiceRequestResult = {
    id: string;
    requestNumber: string | null;
    serviceType: string | null;
    status: string | null;
};

type DirectServiceRequestResponse = { data: DirectServiceRequestResult };

export function useDirectServiceRequest(): UseMutationReturnType<
    DirectServiceRequestResult,
    Error,
    DirectServiceRequestVariables,
    unknown
> {
    return useMutation({
        mutationFn: async (variables: DirectServiceRequestVariables): Promise<DirectServiceRequestResult> => {
            const response = await apiPost<DirectServiceRequestResponse>('/service-requests', {
                body: {
                    patientId: variables.patientId,
                    serviceType: variables.serviceType,
                    departmentId: variables.departmentId || null,
                    priority: variables.priority ?? 'routine',
                    notes: variables.notes?.trim() || null,
                },
            });
            return response.data;
        },
    });
}
