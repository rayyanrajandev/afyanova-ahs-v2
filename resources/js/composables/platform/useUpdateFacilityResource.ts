import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { FacilityResource } from './useFacilityResources';

type UpdateFacilityResourceResponse = { data: FacilityResource };

/**
 * Generic counterpart to useUpdateWardBed.ts. TPayload must include `id`;
 * everything else is forwarded as the PATCH body.
 */
export function useUpdateFacilityResource<TPayload extends { id: string }>(
    basePath: string,
): UseMutationReturnType<FacilityResource, Error, TPayload, unknown> {
    return useMutation({
        mutationFn: async ({ id, ...payload }: TPayload): Promise<FacilityResource> => {
            const response = await apiPatch<UpdateFacilityResourceResponse>(`/platform/admin/${basePath}/${id}`, { body: payload });
            return response.data;
        },
    });
}
