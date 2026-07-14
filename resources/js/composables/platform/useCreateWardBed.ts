import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { WardBed } from './useWardBeds';

/**
 * Matches StoreWardBedRequest's field set
 * (app/Modules/Platform/Presentation/Http/Requests/StoreWardBedRequest.php).
 */
export type CreateWardBedPayload = {
    code: string;
    name: string;
    departmentId?: string | null;
    wardName: string;
    bedNumber: string;
    location?: string | null;
    notes?: string | null;
};

type CreateWardBedResponse = { data: WardBed };

export function useCreateWardBed(): UseMutationReturnType<WardBed, Error, CreateWardBedPayload, unknown> {
    return useMutation({
        mutationFn: async (payload: CreateWardBedPayload): Promise<WardBed> => {
            const response = await apiPost<CreateWardBedResponse>('/platform/admin/ward-beds', { body: payload });
            return response.data;
        },
    });
}
