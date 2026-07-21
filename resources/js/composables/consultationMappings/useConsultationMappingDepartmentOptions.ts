import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type ComputedRef } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { SearchableSelectOption } from '@/lib/patientLocations';

type DepartmentOptionsResponse = { data: SearchableSelectOption[] };

/**
 * GET /appointments/department-options — the same appointment-facing
 * department list used when scheduling appointments. `value` is the exact
 * department name, matching what AutoCaptureConsultationFeeUseCase compares
 * against `appointments.department` (must NOT be swapped for the generic
 * /departments list, which isn't filtered to appointmentable departments).
 */
export function useConsultationMappingDepartmentOptions(): {
    options: ComputedRef<SearchableSelectOption[]>;
    query: UseQueryReturnType<SearchableSelectOption[], Error>;
} {
    const query = useQuery({
        queryKey: ['consultation-mapping-department-options'],
        queryFn: async () => {
            const response = await apiGet<DepartmentOptionsResponse>('/appointments/department-options');
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const options = computed<SearchableSelectOption[]>(() => query.data.value ?? []);

    return { options, query };
}
