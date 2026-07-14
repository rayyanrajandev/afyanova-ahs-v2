import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { WardBed } from './useWardBeds';

/**
 * Matches UpdateWardBedRequest's field set — same fields as create, minus
 * status/statusReason (those go through useUpdateWardBedStatus.ts, matching
 * the backend's own "rejects lifecycle status fields on detail update
 * endpoint" rule).
 */
export type UpdateWardBedPayload = {
    id: string;
    code: string;
    name: string;
    departmentId?: string | null;
    wardName: string;
    bedNumber: string;
    location?: string | null;
    notes?: string | null;
};

type UpdateWardBedResponse = { data: WardBed };

export function useUpdateWardBed(): UseMutationReturnType<WardBed, Error, UpdateWardBedPayload, unknown> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: UpdateWardBedPayload): Promise<WardBed> => {
            const response = await apiPatch<UpdateWardBedResponse>(`/platform/admin/ward-beds/${id}`, { body: payload });
            return response.data;
        },
    });
}
