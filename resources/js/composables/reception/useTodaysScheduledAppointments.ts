import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { apiGet } from '@/lib/apiClient';
import type { AppointmentListItem } from '@/composables/appointmentsIndex/useAppointmentList';

type AppointmentListResponse = { data: AppointmentListItem[] };

function todayDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * GET /appointments filtered to status=scheduled for today only — closes the
 * gap where a patient booked ahead (via /appointments, Scheduling V2) never
 * surfaced anywhere reception staff look. Reuses the existing list endpoint
 * (ListAppointmentsUseCase already supports status/from/to) — no backend
 * change. Pairs with useCheckIn.ts, previously an orphaned mutation with no
 * caller.
 *
 * `to` MUST carry an end-of-day time, not a bare date: the backend does
 * `where('scheduled_at', '<=', $to)`, and a bare "YYYY-MM-DD" string
 * parses as midnight — so `to: today` silently excluded every appointment
 * scheduled later than 00:00:00 today (i.e. almost all of them). This was
 * a real, previously-shipped bug, not just a caching gap.
 */
export function useTodaysScheduledAppointments(): UseQueryReturnType<AppointmentListItem[], Error> {
    return useQuery({
        queryKey: ['reception-todays-scheduled-appointments'],
        queryFn: async () => {
            const today = todayDateString();
            const response = await apiGet<AppointmentListResponse>('/appointments', {
                status: 'scheduled',
                from: `${today}T00:00:00`,
                to: `${today}T23:59:59`,
                perPage: 100,
                sortBy: 'scheduledAt',
                sortDir: 'asc',
            });
            return response.data;
        },
        refetchInterval: 30_000,
    });
}
