import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { apiGet } from '@/lib/apiClient';

/**
 * Matches GetTriageQueueStatusCountsUseCase's return shape exactly
 * (app/Modules/Reception/Application/UseCases/GetTriageQueueStatusCountsUseCase.php).
 * Not the same shape as AppointmentStatusCounts (appointments/status-counts)
 * on purpose — waiting/inProgress are a live split of the current
 * waiting_triage population by triage-claim ownership, while
 * completed/cancelled are today's totals, not "of the current queue" (an
 * appointment leaves waiting_triage the moment either happens). See the use
 * case's own docblock for the full reasoning, including why no_show has no
 * card here at all (structurally unreachable from waiting_triage).
 */
export type TriageQueueStatusCounts = {
    waiting: number;
    inProgress: number;
    completed: number;
    cancelled: number;
};

type TriageQueueStatusCountsResponse = { data: TriageQueueStatusCounts };

export function useTriageQueueStatusCounts(): UseQueryReturnType<TriageQueueStatusCounts, Error> {
    return useQuery({
        queryKey: ['triage-queue-status-counts'],
        queryFn: async () => {
            const response = await apiGet<TriageQueueStatusCountsResponse>('/reception/triage-queue/status-counts');
            return response.data;
        },
    });
}
