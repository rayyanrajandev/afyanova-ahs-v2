import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { apiGet } from '@/lib/apiClient';
import {
    CLINICAL_CATALOG_SOURCES,
    type ClinicalCatalogLookupItem,
    type ClinicalCatalogLookupListResponse,
} from '@/lib/billingServiceCatalog';

async function loadSource(source: (typeof CLINICAL_CATALOG_SOURCES)[number]): Promise<ClinicalCatalogLookupItem[]> {
    const results: ClinicalCatalogLookupItem[] = [];
    let page = 1;
    let lastPage = 1;

    do {
        const response = await apiGet<ClinicalCatalogLookupListResponse>(source.path, {
            status: 'active',
            page,
            perPage: 100,
        });

        results.push(...(response.data ?? []).map((item) => ({ ...item, catalogType: item.catalogType ?? source.type })));
        lastPage = Math.max(response.meta?.lastPage ?? 1, 1);
        page += 1;
    } while (page <= lastPage);

    return results;
}

/**
 * Active lab/radiology/theatre/formulary definitions available to link a new
 * tariff to. Same 4-source fan-out as ServiceCatalog.vue's legacy
 * loadClinicalCatalogLookupItems() — kept as one query (not per-source)
 * since the create sheet always needs the combined list.
 */
export function useServiceCatalogClinicalCatalogOptions(): UseQueryReturnType<ClinicalCatalogLookupItem[], Error> {
    return useQuery({
        queryKey: ['service-catalog-clinical-catalog-options'],
        queryFn: async () => (await Promise.all(CLINICAL_CATALOG_SOURCES.map(loadSource))).flat(),
        staleTime: 5 * 60 * 1000,
    });
}
