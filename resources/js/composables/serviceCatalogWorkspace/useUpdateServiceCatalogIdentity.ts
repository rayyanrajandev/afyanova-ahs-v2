import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { CatalogItem, CatalogResponse, StandardsCodes } from '@/lib/billingServiceCatalog';

export type UpdateServiceCatalogIdentityPayload = {
    itemId: string;
    serviceCode: string;
    serviceName: string;
    serviceType: string | null;
    departmentId: string | null;
    unit: string | null;
    facilityTier: string | null;
    codes: StandardsCodes | null;
    idempotencyKey: string;
};

export function useUpdateServiceCatalogIdentity(): UseMutationReturnType<CatalogItem, Error, UpdateServiceCatalogIdentityPayload, unknown> {
    return useMutation({
        mutationFn: async ({ itemId, idempotencyKey, ...payload }: UpdateServiceCatalogIdentityPayload) => {
            const response = await apiPatch<CatalogResponse>(`/billing-service-catalog/items/${itemId}`, {
                body: payload,
                entitlementContext: 'Billing service catalog identity update',
                idempotencyKey,
                requestId: idempotencyKey,
            });
            return response.data;
        },
    });
}
