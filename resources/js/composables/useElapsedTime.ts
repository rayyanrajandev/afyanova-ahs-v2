import { useNow } from '@vueuse/core';
import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue';

export type ElapsedTimeLevel = 'normal' | 'warning' | 'critical';

export type ElapsedTime = {
    minutes: number | null;
    label: string;
    level: ElapsedTimeLevel;
};

/**
 * Shared "how long has this been true" primitive — the single most
 * recognizable visual element of Epic/Cerner/Oracle Health track boards
 * (reports/queue-ecosystem-epic-cerner-oracle-comparison-audit.md §3.1),
 * previously implemented twice in this codebase (ReceptionQueueList.vue's
 * waitLabel(), legacy laboratory-orders/Index.vue's minutesSince()/
 * formatElapsedMinutes()), neither shared, neither reaching this app's two
 * most track-board-like pages. This is the third implementation and the
 * first meant to be reused.
 *
 * Ticks on a 30s interval via VueUse's useNow() (already a dependency,
 * previously unused) rather than a fourth hand-rolled setInterval+ref pair
 * (existing precedents: TimeoutCountdown.vue, Dashboard.vue's nowTick) —
 * minute-granularity display doesn't need a faster tick.
 *
 * Label formatting reuses the exact "Xm" / "Xh Ym" convention already
 * established by the two prior implementations, so this doesn't introduce
 * a third phrasing convention alongside them.
 *
 * Thresholds are deliberately provisional, not a clinical policy decision —
 * callers pass their own; these defaults are a starting point only.
 */
export function useElapsedTime(
    since: MaybeRefOrGetter<string | null | undefined>,
    warningMinutes: MaybeRefOrGetter<number> = 30,
    criticalMinutes: MaybeRefOrGetter<number> = 60,
): ComputedRef<ElapsedTime> {
    const now = useNow({ interval: 30_000 });

    return computed<ElapsedTime>(() => {
        const rawSince = toValue(since);
        const minutes = elapsedMinutesSince(rawSince, now.value);
        if (minutes === null) {
            return { minutes: null, label: '', level: 'normal' };
        }

        const warning = toValue(warningMinutes);
        const critical = toValue(criticalMinutes);
        const level: ElapsedTimeLevel = minutes >= critical ? 'critical' : minutes >= warning ? 'warning' : 'normal';

        return { minutes, label: formatMinutes(minutes), level };
    });
}

/**
 * Pure "since timestamp -> whole minutes elapsed" math, extracted so
 * per-column average/longest-wait stats (VisitJourneyBoard.vue) can reduce
 * over the same minute calculation this badge uses, rather than a second,
 * potentially-drifting copy.
 */
export function elapsedMinutesSince(since: string | null | undefined, now: Date): number | null {
    if (!since) {
        return null;
    }

    const sinceMs = new Date(since).getTime();
    if (Number.isNaN(sinceMs)) {
        return null;
    }

    return Math.max(0, Math.floor((now.getTime() - sinceMs) / 60_000));
}

export function formatMinutes(minutes: number): string {
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}
