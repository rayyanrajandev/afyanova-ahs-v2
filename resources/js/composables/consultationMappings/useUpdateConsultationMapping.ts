import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import { toConsultationMapping, type ConsultationMapping, type RawConsultationMapping } from './useConsultationMappings';

export type UpdateConsultationMappingPayload = {
    id: string;
    clinicianTier: string;
    department: string;
    chargeableItemId: string;
};

type UpdateConsultationMappingResponse = { success: boolean; data: RawConsultationMapping };

export function useUpdateConsultationMapping(): UseMutationReturnType<ConsultationMapping, Error, UpdateConsultationMappingPayload, unknown> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: UpdateConsultationMappingPayload) => {
            const response = await apiPatch<UpdateConsultationMappingResponse>(`/consultation-mappings/${id}`, {
                body: {
                    clinician_tier: payload.clinicianTier,
                    department: payload.department,
                    chargeable_item_id: payload.chargeableItemId,
                },
            });
            return toConsultationMapping(response.data);
        },
    });
}
