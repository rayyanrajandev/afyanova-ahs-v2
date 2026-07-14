import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { SearchableSelectOption } from '@/lib/patientLocations';

type DepartmentOptionsResponse = { data: SearchableSelectOption[] };

/**
 * GET /service-requests/department-options (ListWalkInDepartmentOptionsUseCase)
 * — already SearchableSelectOption-shaped server-side, same endpoint
 * PatientDirectServiceDialog.vue's intake picker uses (B4). Shared here
 * rather than duplicated so the queue page's department filter and
 * Reception's intake picker never drift from the same department list.
 * `serviceType` accepts a plain string (static, e.g. the queue page's
 * unfiltered "all departments" list) or a Ref so a caller like the intake
 * dialog can refetch as the user changes their service-type selection.
 */
export function useDirectServiceDepartmentOptions(
    serviceType?: string | Ref<string>,
): UseQueryReturnType<SearchableSelectOption[], Error> {
    const resolvedServiceType = computed(() => (typeof serviceType === 'string' ? serviceType : serviceType?.value) || null);

    return useQuery({
        queryKey: ['direct-service-department-options', resolvedServiceType],
        queryFn: async () => {
            const response = await apiGet<DepartmentOptionsResponse>('/service-requests/department-options', {
                serviceType: resolvedServiceType.value,
            });
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}
