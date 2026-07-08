import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type PatientChartEncounterSummary = {
    id: string;
    encounterNumber: string | null;
    appointmentId: string | null;
    admissionId: string | null;
    status: string | null;
    openedAt: string | null;
    closedAt: string | null;
};

type PatientChartEncounterListResponse = {
    data: PatientChartEncounterSummary[];
    meta?: { total?: number };
};

/**
 * Read-only lookup of this patient's encounters, used to resolve the
 * appointmentId the chart is focused on into the real encounterId (see the
 * §4 bug fix in reports/patient-chart-rebuild-plan.md). Deliberately calls
 * GET /encounters?patientId= (no side effects) rather than
 * POST .../resolve-for-appointment, which find-or-creates an encounter —
 * wrong to trigger just from viewing the chart.
 */
export function usePatientEncounters(
    patientId: Ref<string>,
): UseQueryReturnType<PatientChartEncounterListResponse, Error> {
    return useQuery({
        queryKey: ['patient-chart-encounters', patientId],
        queryFn: () =>
            apiGet<PatientChartEncounterListResponse>('/encounters', {
                patientId: patientId.value,
                perPage: 100,
                sortBy: 'openedAt',
                sortDir: 'desc',
            }),
        enabled: computed(() => patientId.value.trim() !== ''),
    });
}
