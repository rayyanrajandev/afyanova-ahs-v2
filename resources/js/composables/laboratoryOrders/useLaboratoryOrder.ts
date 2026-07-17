import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { LaboratoryOrder } from './useLaboratoryOrders';

type LaboratoryOrderResponse = { data: LaboratoryOrder };

/**
 * Fetches a single laboratory order by id — for opening
 * LaboratoryOrderDetailSheet.vue from a page that doesn't already have the
 * order in a loaded list (e.g. the patient chart), without navigating to
 * the Laboratory Orders module first. GET /laboratory-orders/{id} matches
 * LaboratoryOrderResponseTransformer::transform() exactly, same shape the
 * list endpoint returns (see useLaboratoryOrders.ts).
 */
export function useLaboratoryOrder(
    orderId: MaybeRefOrGetter<string | null | undefined>,
): UseQueryReturnType<LaboratoryOrderResponse, Error> {
    return useQuery({
        queryKey: ['laboratory-order', computed(() => toValue(orderId))],
        queryFn: () => {
            const id = toValue(orderId);
            if (!id) {
                throw new Error('A laboratory order id is required.');
            }

            return apiGet<LaboratoryOrderResponse>(`/laboratory-orders/${id}`);
        },
        enabled: computed(() => Boolean(toValue(orderId))),
    });
}
