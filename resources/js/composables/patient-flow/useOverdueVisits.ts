import { useNow } from '@vueuse/core';
import { computed, type ComputedRef, type Ref } from 'vue';
import { elapsedMinutesSince } from '@/composables/useElapsedTime';
import { type VisitJourneyEntry } from '@/composables/patient-flow/useVisitJourneyBoard';

/**
 * Board-wide "N patients waiting too long" alert — a summary signal on top
 * of the per-card ElapsedTimeBadge, not a replacement for it. Default
 * threshold (90 minutes) deliberately matches ElapsedTimeBadge's own
 * `critical-minutes` default already used on this board, so the banner's
 * count is literally "how many cards are currently showing critical," not a
 * second, independently-tuned number.
 *
 * Entries with no stepEnteredAt (waiting_clinician/waiting_clinician_review
 * — no column marks that transition) never count as overdue: there's no
 * timestamp to judge against, so they're honestly excluded rather than
 * guessed at.
 */
export function useOverdueVisits(
    entries: Ref<VisitJourneyEntry[]> | ComputedRef<VisitJourneyEntry[]>,
    thresholdMinutes: number = 90,
): { overdueEntries: ComputedRef<VisitJourneyEntry[]> } {
    const now = useNow({ interval: 30_000 });

    const overdueEntries = computed(() =>
        entries.value.filter((entry) => {
            const minutes = elapsedMinutesSince(entry.stepEnteredAt, now.value);
            return minutes !== null && minutes >= thresholdMinutes;
        }),
    );

    return { overdueEntries };
}
