import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type PatientChartMedicationProfile = {
    id: string;
    medicationCode: string | null;
    medicationName: string | null;
    dose: string | null;
    route: string | null;
    frequency: string | null;
    source: string | null;
    status: string | null;
    startedAt: string | null;
    stoppedAt: string | null;
    indication: string | null;
    notes: string | null;
    lastReconciledAt: string | null;
    reconciliationNote: string | null;
};

export type PatientChartMedicationProfileListResponse = {
    data: PatientChartMedicationProfile[];
    meta?: { total?: number };
};

export function usePatientMedicationProfile(
    patientId: Ref<string>,
): UseQueryReturnType<PatientChartMedicationProfileListResponse, Error> {
    return useQuery({
        queryKey: ['patient-chart-medication-profile', patientId],
        queryFn: () =>
            apiGet<PatientChartMedicationProfileListResponse>(`/patients/${patientId.value}/medication-profile`, {
                perPage: 50,
            }),
        enabled: computed(() => patientId.value.trim() !== ''),
    });
}
