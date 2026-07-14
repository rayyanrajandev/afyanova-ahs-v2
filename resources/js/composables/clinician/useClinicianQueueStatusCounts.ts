import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { apiGet } from '@/lib/apiClient';

/**
 * Matches GetClinicianQueueStatusCountsUseCase's return shape exactly
 * (app/Modules/Reception/Application/UseCases/GetClinicianQueueStatusCountsUseCase.php).
 * See that use case's docblock for the full reasoning: waiting/onHold are a
 * live split of the waiting_provider population by whether
 * consultation_started_at has ever been set; inProgress is in_consultation;
 * completed is today's totals scoped to visits that actually went through a
 * consultation (not administrative closures).
 */
export type ClinicianQueueStatusCounts = {
    waiting: number;
    onHold: number;
    inProgress: number;
    completed: number;
};

type ClinicianQueueStatusCountsResponse = { data: ClinicianQueueStatusCounts };

export function useClinicianQueueStatusCounts(): UseQueryReturnType<ClinicianQueueStatusCounts, Error> {
    return useQuery({
        queryKey: ['clinician-queue-status-counts'],
        queryFn: async () => {
            const response = await apiGet<ClinicianQueueStatusCountsResponse>('/reception/clinician-queue/status-counts');
            return response.data;
        },
    });
}
