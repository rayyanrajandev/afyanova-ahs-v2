import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { apiGet } from '@/lib/apiClient';
import type { SearchableSelectOption } from '@/lib/patientLocations';

type DepartmentOptionsResponse = { data: SearchableSelectOption[] };

/**
 * GET /appointments/department-options (ListAppointmentDepartmentOptionsUseCase)
 * — already SearchableSelectOption-shaped server-side, feeds both the create
 * form's department field and the list filter's department field directly
 * into SearchableSelectField.vue, no new select-option convention invented.
 */
export function useAppointmentDepartmentOptions(): UseQueryReturnType<SearchableSelectOption[], Error> {
    return useQuery({
        queryKey: ['appointments-department-options'],
        queryFn: async () => {
            const response = await apiGet<DepartmentOptionsResponse>('/appointments/department-options');
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}
