import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { Admission } from './useAdmissions';

/**
 * PATCH /admissions/{id}/status (UpdateAdmissionStatusUseCase), reused for
 * discharge/transfer/cancel — same one-endpoint-three-transitions shape
 * this codebase already uses elsewhere (Appointment/ServiceRequest status
 * endpoints). `receivingBedResourceId` is the only transfer-placement field
 * this V2 form exposes (see useCreateAdmission.ts's docblock for the same
 * "V2 only uses the real bed picker" reasoning).
 */
export type AdmissionStatusTarget = 'discharged' | 'transferred' | 'cancelled';

export type UpdateAdmissionStatusPayload = {
    admissionId: string;
    status: AdmissionStatusTarget;
    reason?: string | null;
    dischargeDestination?: string | null;
    followUpPlan?: string | null;
    receivingBedResourceId?: string | null;
};

type UpdateAdmissionStatusResponse = { data: Admission };

export function useUpdateAdmissionStatus(): UseMutationReturnType<Admission, Error, UpdateAdmissionStatusPayload, unknown> {
    return useMutation({
        mutationFn: async ({ admissionId, ...payload }: UpdateAdmissionStatusPayload): Promise<Admission> => {
            const response = await apiPatch<UpdateAdmissionStatusResponse>(`/admissions/${admissionId}/status`, { body: payload });
            return response.data;
        },
    });
}
