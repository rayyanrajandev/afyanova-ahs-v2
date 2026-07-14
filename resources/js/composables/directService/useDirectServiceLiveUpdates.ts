import { useFacilityLiveUpdates } from '@/composables/useFacilityLiveUpdates';
import { type ComputedRef } from 'vue';

/**
 * Phase 3: Direct-Service Requests reads the same ServiceRequestModel data
 * the Patient-Flow Board's own waiting_direct_service/in_direct_service
 * columns do — the new ServiceRequestStatusChanged event (added this phase
 * to close a gap in the board itself) feeds the same
 * `patient-flow.{facilityId}` channel this page now also subscribes to.
 * Invalidates both useDirectServiceRequests's and
 * useDirectServiceStatusCounts's query keys.
 */
export function useDirectServiceLiveUpdates(): { isLive: ComputedRef<boolean> } {
    return useFacilityLiveUpdates([['direct-service-requests'], ['direct-service-status-counts']]);
}
