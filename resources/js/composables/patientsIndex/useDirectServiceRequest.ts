import { useMutation, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { ServiceRequestItemInput } from '@/types/serviceRequestItem';

export type DirectServiceType = 'laboratory' | 'pharmacy' | 'radiology' | 'theatre_procedure' | 'clinical_procedure';

export type DirectServiceRequestVariables = {
    patientId: string;
    serviceType: DirectServiceType;
    departmentId?: string | null;
    priority?: 'routine' | 'urgent';
    notes?: string | null;
    items?: ServiceRequestItemInput[];
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
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (variables: DirectServiceRequestVariables): Promise<DirectServiceRequestResult> => {
            const response = await apiPost<DirectServiceRequestResponse>('/service-requests', {
                body: {
                    patientId: variables.patientId,
                    serviceType: variables.serviceType,
                    departmentId: variables.departmentId || null,
                    priority: variables.priority ?? 'routine',
                    notes: variables.notes?.trim() || null,
                    items: variables.items?.length ? variables.items.map((item) => ({
                        catalogItemId: item.catalogItemId,
                        itemName: item.itemName,
                        itemCode: item.itemCode,
                        quantity: item.quantity,
                        clinicalIndication: item.clinicalIndication || null,
                        instructions: item.instructions || null,
                    })) : undefined,
                },
            });
            return response.data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['direct-service-requests'] });
            void queryClient.invalidateQueries({ queryKey: ['direct-service-status-counts'] });
        },
    });
}
