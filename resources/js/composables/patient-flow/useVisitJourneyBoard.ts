import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import { type VisitJourneyFilters } from '@/composables/patient-flow/useVisitJourneyFilters';

export type VisitJourneyStep =
    | 'waiting_triage'
    | 'in_triage'
    | 'waiting_clinician'
    | 'waiting_clinician_review'
    | 'with_clinician'
    | 'waiting_lab'
    | 'waiting_imaging'
    | 'waiting_lab_and_imaging'
    | 'in_lab'
    | 'in_imaging'
    | 'in_lab_and_imaging'
    | 'waiting_pharmacy'
    | 'waiting_direct_service'
    | 'in_direct_service';

export type VisitJourneyEntry = {
    /** Null for a direct-service walk-in with no linked appointment. */
    appointmentId: string | null;
    /** Set only for entries sourced from a ServiceRequest (Phase 1b). */
    serviceRequestId: string | null;
    patientId: string | null;
    patientName: string | null;
    patientNumber: string | null;
    department: string | null;
    clinicianUserId: number | null;
    appointmentStatus: string | null;
    step: VisitJourneyStep;
    /**
     * When the patient entered their CURRENT step — sourced per-step from
     * whichever column actually marks that transition (see
     * GetActiveVisitJourneyUseCase's docblock). Null for
     * waiting_clinician/waiting_clinician_review: no column marks either
     * transition, so this is honestly absent rather than approximated.
     */
    stepEnteredAt: string | null;
    /** P1-P5 Manchester-Triage-style acuity; null for direct-service walk-ins, which never see triage. */
    priority: string | null;
    /** Every open lab/imaging/pharmacy order for this visit, not just the one determining the step. */
    openOrders: Array<{ type: 'lab' | 'imaging' | 'pharmacy'; label: string }>;
    /** Active allergies for this patient; empty array (not null) when there are none. */
    allergies: Array<{ substanceName: string; severity: string }>;
    /** 'pending' when an issued/partially_paid invoice exists for this patient, else null — a glance signal, not a mini billing view. */
    billingStatus: 'pending' | null;
};

type VisitJourneyBoardResponse = { data: VisitJourneyEntry[] };

/**
 * GET /patient-flow/board (Phase 4 of
 * reports/queue-based-workflow-modernization-plan.md) — not flag-gated,
 * unlike the notification badge: this is read-only visibility into data
 * that's already visible elsewhere (appointment/order status), not a new
 * automated behavior.
 *
 * Phase 1 card-enrichment pass: accepts the board's reactive filters
 * (useVisitJourneyFilters) and forwards them as query params, matching
 * useAppointmentList()'s own `['key', computed(() => ({...filters}))]`
 * convention — pushed into the query key so switching filters refetches
 * rather than filtering stale client-side data.
 */
export function useVisitJourneyBoard(filters?: VisitJourneyFilters): UseQueryReturnType<VisitJourneyEntry[], Error> {
    return useQuery({
        queryKey: ['patient-flow-board', computed(() => (filters ? { ...filters } : null))],
        queryFn: () =>
            apiGet<VisitJourneyBoardResponse>('/patient-flow/board', {
                department: filters?.department ?? null,
                clinicianUserId: filters?.clinicianUserId ?? null,
                q: filters?.q.trim() || null,
            }).then((response) => response.data),
        refetchInterval: 30_000,
    });
}
