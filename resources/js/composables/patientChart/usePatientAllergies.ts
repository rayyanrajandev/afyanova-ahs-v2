import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type PatientChartAllergy = {
    id: string;
    substanceCode: string | null;
    substanceName: string | null;
    reaction: string | null;
    severity: string | null;
    status: string | null;
    notedAt: string | null;
    lastReactionAt: string | null;
    notes: string | null;
};

export type PatientChartAllergyListResponse = {
    data: PatientChartAllergy[];
    meta?: { total?: number };
};

/** Backs the Overview "Allergy safety" tile and the Medications tab's allergy workspace. */
export function usePatientAllergies(
    patientId: Ref<string>,
): UseQueryReturnType<PatientChartAllergyListResponse, Error> {
    return useQuery({
        queryKey: ['patient-chart-allergies', patientId],
        queryFn: () =>
            apiGet<PatientChartAllergyListResponse>(`/patients/${patientId.value}/allergies`, {
                status: 'active',
                perPage: 50,
            }),
        enabled: computed(() => patientId.value.trim() !== ''),
    });
}
