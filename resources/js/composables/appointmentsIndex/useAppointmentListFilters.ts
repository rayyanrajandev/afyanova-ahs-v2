import { reactive } from 'vue';

/**
 * Filters for the scheduling-only appointments list — matches
 * ListAppointmentsUseCase's filter shape 1:1
 * (app/Modules/Appointment/Application/UseCases/ListAppointmentsUseCase.php):
 * q, department, status, from/to, sortBy, sortDir, page, perPage. Same
 * pattern as usePatientListFilters.ts.
 *
 * clinicianUserId/unassignedClinician/triageCategory are deliberately
 * omitted — those are operational-queue filters (who's this visit currently
 * with), not scheduling ones; reports/appointments-scheduling-workspace-
 * modernization-plan.md §2.1 moves that concern to Reception Queue.
 *
 * status defaults to 'scheduled' — this view's primary job is "what still
 * needs scheduling attention," not the full operational history — but the
 * filter itself accepts any value ListAppointmentsUseCase does, so
 * completed/cancelled/no_show history stays reachable.
 */
export function useAppointmentListFilters() {
    return reactive({
        q: '',
        department: '',
        status: 'scheduled' as string,
        from: '',
        to: '',
        page: 1,
        perPage: 10,
        sortBy: 'scheduledAt' as string,
        sortDir: 'asc' as 'asc' | 'desc',
    });
}

export type AppointmentListFilters = ReturnType<typeof useAppointmentListFilters>;
