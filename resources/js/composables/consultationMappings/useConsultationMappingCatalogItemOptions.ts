import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type ComputedRef } from 'vue';
import { apiGet } from '@/lib/apiClient';
import { formatMoney, type CatalogItem, type CatalogListResponse } from '@/lib/billingServiceCatalog';
import type { SearchableSelectOption } from '@/lib/patientLocations';

/**
 * GET /billing-service-catalog/items?status=active&serviceType=consultation
 * — reuses the existing catalog endpoint, filtered to consultation-type
 * services only. Consultation mappings exist purely to auto-bill
 * consultations; showing lab/radiology/pharmacy/etc. items in this picker
 * would let an admin wire a mapping to a service that
 * AutoCaptureConsultationFeeUseCase would never sensibly charge for.
 */
export function useConsultationMappingCatalogItemOptions(): {
    options: ComputedRef<SearchableSelectOption[]>;
    query: UseQueryReturnType<CatalogItem[], Error>;
} {
    const query = useQuery({
        queryKey: ['consultation-mapping-catalog-item-options'],
        queryFn: async () => {
            const response = await apiGet<CatalogListResponse>('/billing-service-catalog/items', {
                status: 'active',
                serviceType: 'consultation',
                perPage: 200,
                sortBy: 'service_name',
                sortDir: 'asc',
            });
            return response.data;
        },
        staleTime: 60 * 1000,
    });

    const options = computed<SearchableSelectOption[]>(() =>
        (query.data.value ?? [])
            .map((item): SearchableSelectOption | null => {
                const value = item.id?.trim();
                if (!value) return null;
                return {
                    value,
                    label: item.serviceCode ? `${item.serviceCode} — ${item.serviceName ?? 'Unnamed service'}` : (item.serviceName ?? 'Unnamed service'),
                    description: formatMoney(item.basePrice, item.currencyCode),
                    group: item.department ?? null,
                };
            })
            .filter((option): option is SearchableSelectOption => option !== null),
    );

    return { options, query };
}
