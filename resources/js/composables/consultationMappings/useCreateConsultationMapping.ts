import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import { toConsultationMapping, type ConsultationMapping, type RawConsultationMapping } from './useConsultationMappings';

export type CreateConsultationMappingPayload = {
    clinicianTier: string;
    department: string;
    billingServiceCatalogItemId: string;
};

type CreateConsultationMappingResponse = { success: boolean; data: RawConsultationMapping };

export function useCreateConsultationMapping(): UseMutationReturnType<ConsultationMapping, Error, CreateConsultationMappingPayload, unknown> {
    return useMutation({
        mutationFn: async (payload: CreateConsultationMappingPayload) => {
            const response = await apiPost<CreateConsultationMappingResponse>('/consultation-mappings', {
                body: {
                    clinician_tier: payload.clinicianTier,
                    department: payload.department,
                    billing_service_catalog_item_id: payload.billingServiceCatalogItemId,
                },
            });
            return toConsultationMapping(response.data);
        },
    });
}
