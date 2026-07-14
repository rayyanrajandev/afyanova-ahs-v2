import { useFacilityLiveUpdates } from '@/composables/useFacilityLiveUpdates';
import type { QueryKey } from '@tanstack/vue-query';
import { type ComputedRef } from 'vue';

/**
 * Phase 3: Reception/Triage/Clinician Queue pages all read the exact same
 * `appointments` table/status that AppointmentStatusChanged/
 * AppointmentCheckedIn already broadcast on for the Patient-Flow Board — no
 * new backend event needed, just a second frontend subscriber to the same
 * `patient-flow.{facilityId}` channel. All three share the same
 * `useReceptionQueue` list query (`'reception-queue'`), but each has its own
 * status-counts composable/key (`useReceptionQueueStatusCounts`,
 * `useTriageQueueStatusCounts`, `useClinicianQueueStatusCounts`), so the
 * caller passes its own status-counts key(s) in.
 */
export function useReceptionQueueLiveUpdates(additionalQueryKeys: QueryKey[] = []): { isLive: ComputedRef<boolean> } {
    return useFacilityLiveUpdates([['reception-queue'], ...additionalQueryKeys]);
}
