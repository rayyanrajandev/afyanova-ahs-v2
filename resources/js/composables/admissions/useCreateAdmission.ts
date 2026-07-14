import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { Admission } from './useAdmissions';

/**
 * Matches StoreAdmissionRequest's field set
 * (app/Modules/Admission/Presentation/Http/Requests/StoreAdmissionRequest.php).
 * `bedResourceId` is the only placement field this V2 form exposes — the
 * legacy free-text `ward`/`bed` pair still works server-side but isn't
 * offered here; see CreateAdmissionSheet.vue's own docblock.
 * billingPayerContractId/coverageReference/coverageNotes are deliberately
 * not sent by the V2 form (coverage inherits from the linked appointment
 * only, per this phase's non-goals) but stay in the payload type since the
 * backend already accepts them.
 */
export type CreateAdmissionPayload = {
    patientId: string;
    appointmentId?: string | null;
    attendingClinicianUserId?: number | null;
    bedResourceId?: string | null;
    admittedAt: string;
    admissionReason?: string | null;
    notes?: string | null;
    financialClass?: string | null;
    billingPayerContractId?: string | null;
    coverageReference?: string | null;
    coverageNotes?: string | null;
};

type CreateAdmissionResponse = { data: Admission };

export function useCreateAdmission(): UseMutationReturnType<Admission, Error, CreateAdmissionPayload, unknown> {
    return useMutation({
        mutationFn: async (payload: CreateAdmissionPayload): Promise<Admission> => {
            const response = await apiPost<CreateAdmissionResponse>('/admissions', { body: payload });
            return response.data;
        },
    });
}
