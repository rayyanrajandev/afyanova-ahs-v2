import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

/**
 * Matches AppointmentReferralResponseTransformer 1:1
 * (app/Modules/Appointment/Presentation/Http/Transformers/AppointmentReferralResponseTransformer.php).
 */
export type AppointmentReferral = {
    id: string;
    appointmentId: string;
    referralNumber: string | null;
    referralType: 'internal' | 'external' | null;
    priority: 'routine' | 'urgent' | 'critical' | null;
    targetDepartment: string | null;
    targetFacilityId: string | null;
    targetFacilityCode: string | null;
    targetFacilityName: string | null;
    targetClinicianUserId: number | null;
    referralReason: string | null;
    clinicalNotes: string | null;
    handoffNotes: string | null;
    requestedAt: string | null;
    acceptedAt: string | null;
    handedOffAt: string | null;
    completedAt: string | null;
    status: 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'rejected' | null;
    statusReason: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type AppointmentReferralListResponse = {
    data: AppointmentReferral[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

/**
 * GET /appointments/{id}/referrals (ListAppointmentReferralsUseCase) — same
 * "all referrals for this visit, rarely more than a few" scope the legacy
 * appointments/Index.vue's referrals tab already used (perPage 20, page 1,
 * no filter UI): reports/appointments-scheduling-workspace-modernization-
 * plan.md's Phase 5 extraction deliberately doesn't add pagination/filter UI
 * that never existed. Scoped by a Ref so ReferralManagementSheet.vue can
 * point it at whichever appointment is currently open, disabled entirely
 * when nothing is open.
 */
export function useAppointmentReferrals(
    appointmentId: Ref<string | null>,
): UseQueryReturnType<AppointmentReferralListResponse, Error> {
    return useQuery({
        queryKey: ['appointment-referrals', appointmentId],
        queryFn: async () => {
            const response = await apiGet<AppointmentReferralListResponse>(`/appointments/${appointmentId.value}/referrals`, {
                perPage: 20,
                page: 1,
            });
            return response;
        },
        enabled: computed(() => appointmentId.value !== null),
    });
}
