import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { FacilityResource } from './useFacilityResources';

type CreateFacilityResourceResponse = { data: FacilityResource };

/**
 * Generic counterpart to useCreateWardBed.ts. TPayload is left to the
 * caller (e.g. CreateObservationRoomPayload) since each resource type's
 * StoreXRequest has its own field set.
 */
export function useCreateFacilityResource<TPayload extends Record<string, unknown>>(
    basePath: string,
): UseMutationReturnType<FacilityResource, Error, TPayload, unknown> {
    return useMutation({
        mutationFn: async (payload: TPayload): Promise<FacilityResource> => {
            const response = await apiPost<CreateFacilityResourceResponse>(`/platform/admin/${basePath}`, { body: payload });
            return response.data;
        },
    });
}
