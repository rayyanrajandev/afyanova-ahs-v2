import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { CatalogItem, CatalogResponse, CatalogStatus } from '@/lib/billingServiceCatalog';

export type UpdateServiceCatalogStatusPayload = {
    itemId: string;
    status: CatalogStatus;
    reason: string | null;
    idempotencyKey: string;
};

export function useUpdateServiceCatalogStatus(): UseMutationReturnType<CatalogItem, Error, UpdateServiceCatalogStatusPayload, unknown> {
    return useMutation({
        mutationFn: async ({ itemId, idempotencyKey, ...payload }: UpdateServiceCatalogStatusPayload) => {
            const response = await apiPatch<CatalogResponse>(`/billing-service-catalog/items/${itemId}/status`, {
                body: payload,
                entitlementContext: 'Billing service catalog status update',
                idempotencyKey,
                requestId: idempotencyKey,
            });
            return response.data;
        },
    });
}
