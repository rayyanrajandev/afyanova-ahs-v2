import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { WardBed } from './useWardBeds';

export type UpdateWardBedStatusPayload = {
    id: string;
    status: 'active' | 'inactive';
    reason?: string | null;
};

type UpdateWardBedStatusResponse = { data: WardBed };

/**
 * PATCH /platform/admin/ward-beds/{id}/status
 * (FacilityResourceRegistryController::updateWardBedStatus()) — hard-blocked
 * with a 422 when deactivating a bed that has an active admission, per the
 * occupancy-visibility follow-through to the Reception/Emergency/Admission/
 * Bed-Management audit.
 */
export function useUpdateWardBedStatus(): UseMutationReturnType<WardBed, Error, UpdateWardBedStatusPayload, unknown> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: UpdateWardBedStatusPayload): Promise<WardBed> => {
            const response = await apiPatch<UpdateWardBedStatusResponse>(`/platform/admin/ward-beds/${id}/status`, { body: payload });
            return response.data;
        },
    });
}
