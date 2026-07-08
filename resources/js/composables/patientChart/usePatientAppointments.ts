import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type PatientChartAppointment = {
    id: string;
    appointmentNumber: string | null;
    department: string | null;
    scheduledAt: string | null;
    durationMinutes: number | null;
    reason: string | null;
    triageVitalsSummary: string | null;
    status: string | null;
};

export type PatientChartAppointmentListResponse = {
    data: PatientChartAppointment[];
    meta?: { total?: number };
};

export function usePatientAppointments(
    patientId: Ref<string>,
    enabled: Ref<boolean>,
): UseQueryReturnType<PatientChartAppointmentListResponse, Error> {
    return useQuery({
        queryKey: ['patient-chart-appointments', patientId],
        queryFn: () =>
            apiGet<PatientChartAppointmentListResponse>('/appointments', {
                patientId: patientId.value,
                sortBy: 'scheduledAt',
                sortDir: 'desc',
                perPage: 6,
            }),
        enabled: computed(() => enabled.value && patientId.value.trim() !== ''),
    });
}
