import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { FacilityResource } from './useFacilityResources';

export type UpdateFacilityResourceStatusPayload = {
    id: string;
    status: 'active' | 'inactive';
    reason?: string | null;
};

type UpdateFacilityResourceStatusResponse = { data: FacilityResource };

/**
 * Generic counterpart to useUpdateWardBedStatus.ts. Same hard-block
 * semantics apply server-side for both ward-beds and observation-rooms
 * (occupied resource can't be deactivated) — see updateWardBedStatus()/
 * updateObservationRoomStatus() on FacilityResourceRegistryController.
 */
export function useUpdateFacilityResourceStatus(
    basePath: string,
): UseMutationReturnType<FacilityResource, Error, UpdateFacilityResourceStatusPayload, unknown> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: UpdateFacilityResourceStatusPayload): Promise<FacilityResource> => {
            const response = await apiPatch<UpdateFacilityResourceStatusResponse>(`/platform/admin/${basePath}/${id}/status`, {
                body: payload,
            });
            return response.data;
        },
    });
}
