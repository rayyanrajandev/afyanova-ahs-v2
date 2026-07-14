import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { apiGet } from '@/lib/apiClient';
import type { SearchableSelectOption } from '@/lib/patientLocations';

type DischargeDestinationOptionsResponse = { data: SearchableSelectOption[] };

/**
 * GET /admissions/discharge-destination-options
 * (ListAdmissionDischargeDestinationOptionsUseCase) — already
 * SearchableSelectOption-shaped server-side, same reuse pattern as
 * useAppointmentDepartmentOptions.ts.
 */
export function useAdmissionDischargeDestinationOptions(): UseQueryReturnType<SearchableSelectOption[], Error> {
    return useQuery({
        queryKey: ['admissions-discharge-destination-options'],
        queryFn: async () => {
            const response = await apiGet<DischargeDestinationOptionsResponse>('/admissions/discharge-destination-options');
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}
