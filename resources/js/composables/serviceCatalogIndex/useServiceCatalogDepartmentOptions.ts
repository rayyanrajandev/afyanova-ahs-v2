import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type ComputedRef } from 'vue';
import { apiGet } from '@/lib/apiClient';
import { buildDepartmentOptions, type Department, type DepartmentListResponse } from '@/lib/billingServiceCatalog';
import type { SearchableSelectOption } from '@/lib/patientLocations';

/** GET /departments — same source ServiceCatalog.vue's legacy loadDepartments() used. */
export function useServiceCatalogDepartmentOptions(): {
    departments: ComputedRef<Department[]>;
    optionsFor: (preferredServiceType?: string) => SearchableSelectOption[];
    filterOptions: ComputedRef<SearchableSelectOption[]>;
    query: UseQueryReturnType<Department[], Error>;
} {
    const query = useQuery({
        queryKey: ['service-catalog-department-options'],
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

    function optionsFor(preferredServiceType = ''): SearchableSelectOption[] {
        return buildDepartmentOptions(departments.value, preferredServiceType);
    }

    // EloquentBillingServiceCatalogItemRepository::applyDepartmentFilter() only matches on
    // `department_id` when most catalog items were never backfilled with one — nearly all
    // existing rows only carry the legacy `department` NAME string, matched by exact equality.
    // The list/browse filter must send that name (not the department id `optionsFor()` uses for
    // the create form, where new items do get a real department_id), or every filter selection
    // returns zero rows.
    const filterOptions = computed<SearchableSelectOption[]>(() =>
        departments.value
            .map((department): SearchableSelectOption | null => {
                const name = String(department.name ?? '').trim();
                if (!name) return null;
                const code = String(department.code ?? '').trim();
                return {
                    value: name,
                    label: code ? `${code} - ${name}` : name,
                    keywords: [name, code].filter((entry) => entry.length > 0),
                };
            })
            .filter((option): option is SearchableSelectOption => option !== null),
    );

    return { departments, optionsFor, filterOptions, query };
}
