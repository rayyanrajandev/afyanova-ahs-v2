import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type DepartmentCatalogItem = {
    id: string;
    code: string | null;
    name: string | null;
    catalogType: string | null;
    category: string | null;
    unit: string | null;
    status: string | null;
};

type DepartmentCatalogResponse = {
    data: DepartmentCatalogItem[];
};

export function useServiceRequestItemCatalog(
    departmentId: Ref<string | null>,
): UseQueryReturnType<DepartmentCatalogItem[], Error> {
    const resolvedId = computed(() => departmentId.value);

    return useQuery({
        queryKey: ['department-catalog-items', resolvedId],
        queryFn: async () => {
            if (!resolvedId.value) return [];
            const response = await apiGet<DepartmentCatalogResponse>(
                `/platform/catalog/by-department/${resolvedId.value}`,
                { status: 'active' },
            );
            return response.data;
        },
        enabled: computed(() => !!resolvedId.value),
        staleTime: 5 * 60 * 1000,
    });
}
