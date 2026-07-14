import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { AppointmentReferral } from './useAppointmentReferrals';

/**
 * PATCH /appointments/{id}/referrals/{referralId}/status
 * (UpdateAppointmentReferralStatusRequest), gated appointments.manage-referrals.
 * `reason` required server-side when status is cancelled/rejected
 * (required_if:status,cancelled,rejected) — enforced client-side too by
 * ReferralManagementSheet.vue, matching AppointmentClosureDialog.vue's
 * convention. Deliberately typed to only the five transition targets the
 * legacy UI ever offered (Index.vue:7809-7813) — 'requested' itself is
 * never a target, only the terminal/forward states a referral can move to.
 */
export type AppointmentReferralStatusTarget = 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'rejected';

export type UpdateAppointmentReferralStatusPayload = {
    appointmentId: string;
    referralId: string;
    status: AppointmentReferralStatusTarget;
    reason?: string | null;
    handoffNotes?: string | null;
};

type UpdateAppointmentReferralStatusResponse = { data: AppointmentReferral };

export function useUpdateAppointmentReferralStatus(): UseMutationReturnType<
    AppointmentReferral,
    Error,
    UpdateAppointmentReferralStatusPayload,
    unknown
> {
    return useMutation({
        mutationFn: async ({ appointmentId, referralId, status, reason, handoffNotes }): Promise<AppointmentReferral> => {
            const response = await apiPatch<UpdateAppointmentReferralStatusResponse>(
                `/appointments/${appointmentId}/referrals/${referralId}/status`,
                { body: { status, reason: reason ?? null, handoffNotes: handoffNotes ?? null } },
            );
            return response.data;
        },
    });
}
