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
 * GET /departments, gated by the caller checking departments.read — no
 * reusable composable existed for this anywhere in the codebase (checked),
 * so this is net-new. Replaces ward-beds/Index.vue's manual loadDepartments().
 */
export function useWardBedDepartmentOptions(): {
    departments: ComputedRef<Department[]>;
    options: ComputedRef<SearchableSelectOption[]>;
    query: UseQueryReturnType<Department[], Error>;
} {
    const query = useQuery({
        queryKey: ['ward-bed-department-options'],
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
