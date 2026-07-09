import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { apiGet } from '@/lib/apiClient';

export type VisitJourneyStep =
    | 'waiting_triage'
    | 'in_triage'
    | 'waiting_clinician'
    | 'waiting_clinician_review'
    | 'with_clinician'
    | 'waiting_lab'
    | 'in_lab'
    | 'waiting_pharmacy';

export type VisitJourneyEntry = {
    appointmentId: string;
    patientId: string | null;
    patientName: string | null;
    patientNumber: string | null;
    department: string | null;
    clinicianUserId: number | null;
    appointmentStatus: string | null;
    step: VisitJourneyStep;
};

type VisitJourneyBoardResponse = { data: VisitJourneyEntry[] };

/**
 * GET /patient-flow/board (Phase 4 of
 * reports/queue-based-workflow-modernization-plan.md) — not flag-gated,
 * unlike the notification badge: this is read-only visibility into data
 * that's already visible elsewhere (appointment/order status), not a new
 * automated behavior.
 */
export function useVisitJourneyBoard(): UseQueryReturnType<VisitJourneyEntry[], Error> {
    return useQuery({
        queryKey: ['patient-flow-board'],
        queryFn: async () => {
            const response = await apiGet<VisitJourneyBoardResponse>('/patient-flow/board');
            return response.data;
        },
        refetchInterval: 30_000,
    });
}
