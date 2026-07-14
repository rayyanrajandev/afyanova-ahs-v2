import { useEcho, useConnectionStatus } from '@laravel/echo-vue';
import { useQueryClient, type QueryKey } from '@tanstack/vue-query';
import { useDebounceFn } from '@vueuse/core';
import { computed, type ComputedRef } from 'vue';
import { usePlatformAccess } from '@/composables/usePlatformAccess';

/**
 * Patient-Flow Board Phase 2/3: subscribes to the current facility's private
 * `patient-flow.{facilityId}` channel and listens for exactly one event,
 * `.board.updated` — PatientFlowBoardUpdated is the only broadcast event
 * across the whole feature (see its backend docblock). The domain events
 * that can trigger it (check-in, appointment status change,
 * lab/pharmacy/radiology completion, direct-service status change) are all
 * translated into this one event server-side, so this composable has zero
 * knowledge of which module's action caused the update.
 *
 * Generalized from the Patient-Flow Board's own live-update logic (Phase 2)
 * so Phase 3's other consumers (Reception Queue, Direct-Service Requests —
 * both of which read data this same channel already reports changes for)
 * don't each reimplement the same subscribe+debounce+invalidate mechanics.
 * The only thing that differs per consumer is *which* query keys to
 * invalidate, hence the parameter.
 *
 * On receipt, invalidates the caller's query cache rather than merging a
 * pushed payload — reuses each page's own existing fetch/transform pipeline
 * instead of a second, potentially-drifting data shape (the same "nothing
 * computed here can drift" principle GetActiveVisitJourneyUseCase's own
 * docblock states). Debounced ~500ms to absorb bursts from bulk actions.
 *
 * Each consumer's own refetchInterval: 30_000 is NOT removed by this
 * composable — it stays as the resilience fallback if Reverb/the queue
 * worker is down, a message is missed, or a record has no facility_id.
 *
 * isLive reflects the real Echo connection state (useConnectionStatus from
 * @laravel/echo-vue) — an honest signal, not a guess, matching the
 * honest-null convention already used for stepEnteredAt/allergies/
 * billingStatus.
 */
export function useFacilityLiveUpdates(queryKeysToInvalidate: QueryKey[]): { isLive: ComputedRef<boolean> } {
    const { scope } = usePlatformAccess();
    const facilityId = computed(() => scope.value?.facility?.id ?? null);

    const queryClient = useQueryClient();
    const invalidate = useDebounceFn(() => {
        for (const queryKey of queryKeysToInvalidate) {
            void queryClient.invalidateQueries({ queryKey });
        }
    }, 500);

    useEcho(
        `patient-flow.${facilityId.value ?? 'unresolved'}`,
        '.board.updated',
        () => invalidate(),
        [facilityId.value],
    );

    const connectionStatus = useConnectionStatus();
    const isLive = computed(() => connectionStatus.value === 'connected');

    return { isLive };
}
