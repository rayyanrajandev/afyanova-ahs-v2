import { useEcho, useConnectionStatus } from '@laravel/echo-vue';
import { useQueryClient, type QueryKey } from '@tanstack/vue-query';
import { useDebounceFn } from '@vueuse/core';
import { computed, type ComputedRef } from 'vue';
import { usePlatformAccess } from '@/composables/usePlatformAccess';

/**
 * Mirrors useFacilityLiveUpdates.ts's subscribe+debounce+invalidate
 * mechanics, but against the billing cashier queue's own private channel
 * (BillingCashierQueueUpdated → billing-queue.{facilityId} / .queue.updated)
 * rather than the Patient-Flow Board's — billing invoice/payment activity
 * isn't one of PatientFlowBoardUpdated's triggers, so there's nothing to
 * subscribe to on that channel.
 *
 * Each consumer's own refetchInterval: 30_000 (useBillingCashierQueue.ts,
 * useBillingCashierQueueStatusCounts.ts) is NOT removed by this composable —
 * it stays as the resilience fallback if Reverb/the queue worker is down, a
 * message is missed, or a record has no facility_id.
 *
 * isLive reflects the real Echo connection state (useConnectionStatus from
 * @laravel/echo-vue) — an honest signal, not a guess.
 */
export function useBillingCashierQueueLiveUpdates(queryKeysToInvalidate: QueryKey[]): { isLive: ComputedRef<boolean> } {
    const { scope } = usePlatformAccess();
    const facilityId = computed(() => scope.value?.facility?.id ?? null);

    const queryClient = useQueryClient();
    const invalidate = useDebounceFn(() => {
        for (const queryKey of queryKeysToInvalidate) {
            void queryClient.invalidateQueries({ queryKey });
        }
    }, 500);

    useEcho(
        `billing-queue.${facilityId.value ?? 'unresolved'}`,
        '.queue.updated',
        () => invalidate(),
        [facilityId.value],
    );

    const connectionStatus = useConnectionStatus();
    const isLive = computed(() => connectionStatus.value === 'connected');

    return { isLive };
}
