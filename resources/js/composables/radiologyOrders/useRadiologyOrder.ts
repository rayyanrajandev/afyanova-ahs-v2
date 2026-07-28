import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { RadiologyOrder } from './useRadiologyOrders';

type RadiologyOrderResponse = { data: RadiologyOrder };

export function useRadiologyOrder(
    orderId: MaybeRefOrGetter<string | null | undefined>,
): UseQueryReturnType<RadiologyOrderResponse, Error> {
    return useQuery({
        queryKey: ['radiology-order', computed(() => toValue(orderId))],
        queryFn: () => {
            const id = toValue(orderId);
            if (!id) {
                throw new Error('A radiology order id is required.');
            }

            return apiGet<RadiologyOrderResponse>(`/radiology-orders/${id}`);
        },
        enabled: computed(() => Boolean(toValue(orderId))),
    });
}
