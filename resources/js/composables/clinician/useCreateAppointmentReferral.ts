import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { AppointmentReferral } from './useAppointmentReferrals';

/**
 * POST /appointments/{id}/referrals (StoreAppointmentReferralRequest), gated
 * appointments.manage-referrals. Field set matches exactly what the legacy
 * appointments/Index.vue's create dialog actually sends (referralForm,
 * Index.vue:673-681) — referralType/priority always chosen, everything else
 * optional free text. Deliberately excludes targetFacilityId (the legacy
 * form never sent it either — it's populated by the "referral network"
 * facility-browse endpoint, which the legacy UI never wired up) and status/
 * requestedAt/metadata (create-time-only fields the legacy form doesn't
 * expose; status defaults server-side to 'requested').
 */
export type CreateAppointmentReferralPayload = {
    referralType: 'internal' | 'external';
    priority: 'routine' | 'urgent' | 'critical';
    targetDepartment?: string | null;
    targetFacilityCode?: string | null;
    targetFacilityName?: string | null;
    targetClinicianUserId?: number | null;
    referralReason?: string | null;
    clinicalNotes?: string | null;
    handoffNotes?: string | null;
};

type CreateAppointmentReferralResponse = { data: AppointmentReferral };

export function useCreateAppointmentReferral(): UseMutationReturnType<
    AppointmentReferral,
    Error,
    { appointmentId: string; payload: CreateAppointmentReferralPayload },
    unknown
> {
    return useMutation({
        mutationFn: async ({ appointmentId, payload }): Promise<AppointmentReferral> => {
            const response = await apiPost<CreateAppointmentReferralResponse>(`/appointments/${appointmentId}/referrals`, { body: payload });
            return response.data;
        },
    });
}
