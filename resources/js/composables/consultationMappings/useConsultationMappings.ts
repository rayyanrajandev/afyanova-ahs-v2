import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { apiGet } from '@/lib/apiClient';

export const CLINICIAN_TIER_OPTIONS = [
    { value: 'CO', label: 'Clinical Officer' },
    { value: 'AMO', label: 'Assistant Medical Officer' },
    { value: 'MD', label: 'Medical Doctor' },
    { value: 'SPECIALIST', label: 'Specialist' },
] as const;

export type ConsultationMappingCatalogItem = {
    id: string;
    serviceCode: string | null;
    serviceName: string | null;
    basePrice: string | number | null;
    status: string | null;
};

export type ConsultationMapping = {
    id: string;
    clinicianTier: string;
    department: string;
    billingServiceCatalogItemId: string;
    catalogItem: ConsultationMappingCatalogItem | null;
    createdAt: string | null;
    updatedAt: string | null;
};

export type RawConsultationMappingCatalogItem = {
    id: string;
    service_code: string | null;
    service_name: string | null;
    base_price: string | number | null;
    status: string | null;
};

export type RawConsultationMapping = {
    id: string;
    clinician_tier: string;
    department: string;
    billing_service_catalog_item_id: string;
    catalog_item: RawConsultationMappingCatalogItem | null;
    created_at: string | null;
    updated_at: string | null;
};

type ConsultationMappingListResponse = { success: boolean; data: RawConsultationMapping[] };

export function toConsultationMapping(raw: RawConsultationMapping): ConsultationMapping {
    return {
        id: raw.id,
        clinicianTier: raw.clinician_tier,
        department: raw.department,
        billingServiceCatalogItemId: raw.billing_service_catalog_item_id,
        catalogItem: raw.catalog_item === null ? null : {
            id: raw.catalog_item.id,
            serviceCode: raw.catalog_item.service_code,
            serviceName: raw.catalog_item.service_name,
            basePrice: raw.catalog_item.base_price,
            status: raw.catalog_item.status,
        },
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
    };
}

export function useConsultationMappings(): UseQueryReturnType<ConsultationMapping[], Error> {
    return useQuery({
        queryKey: ['consultation-mappings'],
        queryFn: async () => {
            const response = await apiGet<ConsultationMappingListResponse>('/consultation-mappings');
            return response.data.map(toConsultationMapping);
        },
    });
}
