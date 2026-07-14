import { useFacilityLiveUpdates } from '@/composables/useFacilityLiveUpdates';
import { type ComputedRef } from 'vue';

/**
 * Patient-Flow Board Phase 2: thin wrapper over the generalized
 * useFacilityLiveUpdates (Phase 3 extracted the shared mechanism once
 * Reception Queue and Direct-Service Requests needed the same thing) —
 * invalidates the board's own query cache, same name/behavior as before so
 * Board.vue needed no changes when this was generalized.
 */
export function usePatientFlowBoardLiveUpdates(): { isLive: ComputedRef<boolean> } {
    return useFacilityLiveUpdates([['patient-flow-board']]);
}
