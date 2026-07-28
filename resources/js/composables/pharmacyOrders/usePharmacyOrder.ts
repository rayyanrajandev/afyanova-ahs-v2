import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { PharmacyOrder } from './usePharmacyOrders';

type PharmacyOrderResponse = { data: PharmacyOrder };

export function usePharmacyOrder(
    orderId: MaybeRefOrGetter<string | null | undefined>,
): UseQueryReturnType<PharmacyOrderResponse, Error> {
    return useQuery({
        queryKey: ['pharmacy-order', computed(() => toValue(orderId))],
        queryFn: () => {
            const id = toValue(orderId);
            if (!id) {
                throw new Error('A pharmacy order id is required.');
            }

            return apiGet<PharmacyOrderResponse>(`/pharmacy-orders/${id}`);
        },
        enabled: computed(() => Boolean(toValue(orderId))),
    });
}
