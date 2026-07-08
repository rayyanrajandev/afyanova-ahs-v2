import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type PatientChartMedicalRecord = {
    id: string;
    recordNumber: string | null;
    appointmentId: string | null;
    encounterId: string | null;
    admissionId: string | null;
    encounterAt: string | null;
    recordType: string | null;
    assessment: string | null;
    plan: string | null;
    diagnosisCode: string | null;
    status: string | null;
};

export type PatientChartMedicalRecordListResponse = {
    data: PatientChartMedicalRecord[];
    meta?: { total?: number };
};

export function usePatientMedicalRecords(
    patientId: Ref<string>,
    enabled: Ref<boolean>,
): UseQueryReturnType<PatientChartMedicalRecordListResponse, Error> {
    return useQuery({
        queryKey: ['patient-chart-medical-records', patientId],
        queryFn: () =>
            apiGet<PatientChartMedicalRecordListResponse>('/medical-records', {
                patientId: patientId.value,
                sortBy: 'encounterAt',
                sortDir: 'desc',
                perPage: 10,
            }),
        enabled: computed(() => enabled.value && patientId.value.trim() !== ''),
    });
}
