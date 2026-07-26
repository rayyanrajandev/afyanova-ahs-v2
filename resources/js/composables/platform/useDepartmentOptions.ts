import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type ComputedRef } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { SearchableSelectOption } from '@/lib/patientLocations';

export type Department = { id: string | null; code: string | null; name: string | null };

type DepartmentListResponse = { data: Department[] };

function departmentLabel(department: Department): string {
    if (department.code && department.name) return `${department.code} - ${department.name}`;
    return department.name || department.code || String(department.id ?? '');
}

/**
 * GET /departments — generic department-picker composable, used by the
 * observation-rooms admin page. useWardBedDepartmentOptions.ts is the same
 * query under a resource-specific name kept as-is on ward-beds/IndexV2.vue
 * (deliberately left untouched, see the observation-room implementation
 * plan) rather than renamed in place.
 */
export function useDepartmentOptions(): {
    departments: ComputedRef<Department[]>;
    options: ComputedRef<SearchableSelectOption[]>;
    query: UseQueryReturnType<Department[], Error>;
} {
    const query = useQuery({
        queryKey: ['department-options'],
        queryFn: async () => {
            const response = await apiGet<DepartmentListResponse>('/departments', {
                page: 1,
                perPage: 100,
                sortBy: 'name',
                sortDir: 'asc',
            });
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const departments = computed<Department[]>(() => query.data.value ?? []);

    const options = computed<SearchableSelectOption[]>(() =>
        departments.value
            .map((department) => {
                const value = String(department.id ?? '').trim();
                if (!value) return null;
                return {
                    value,
                    label: departmentLabel(department),
                    description: department.code || undefined,
                    keywords: [department.code, department.name].filter(Boolean) as string[],
                } satisfies SearchableSelectOption;
            })
            .filter((option): option is SearchableSelectOption => option !== null),
    );

    return { departments, options, query };
}
