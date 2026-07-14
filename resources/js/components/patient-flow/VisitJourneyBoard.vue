<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useNow } from '@vueuse/core';
import { Link } from '@inertiajs/vue3';
import { Badge } from '@/components/ui/badge';
import ElapsedTimeBadge from '@/components/shared/ElapsedTimeBadge.vue';
import { elapsedMinutesSince, formatMinutes } from '@/composables/useElapsedTime';
import { usePatientFlowClinicianDirectory } from '@/composables/patient-flow/usePatientFlowClinicianDirectory';
import { directServicePatientWorklistHref, type DirectServiceModuleKey } from '@/lib/directServicePatientWorklist';
import { patientChartHref } from '@/lib/patientChart';
import { isUrgentPriority, URGENT_PRIORITIES } from '@/lib/patientFlowPriority';
import { type VisitJourneyEntry, type VisitJourneyStep } from '@/composables/patient-flow/useVisitJourneyBoard';

const props = defineProps<{
    entries: VisitJourneyEntry[];
}>();

/**
 * Deliberately excludes waiting_triage/in_triage/waiting_clinician/
 * waiting_clinician_review — those duplicate reception/Queue.vue's own
 * waiting_triage/waiting_provider stages (see useVisitJourneyBoard's
 * earlierStageCount). Board.vue links to /reception/queue for those.
 *
 * waiting_direct_service/in_direct_service (Phase 1b) are a genuinely
 * distinct situation from waiting_lab/in_lab, not folded into them: a
 * direct-service walk-in never saw a clinician at all, so showing it in
 * the same column as a clinician-ordered lab result in progress would
 * misrepresent where the patient actually is.
 */
const STEP_ORDER: VisitJourneyStep[] = [
    'with_clinician',
    'waiting_lab',
    'waiting_imaging',
    'waiting_lab_and_imaging',
    'in_lab',
    'in_imaging',
    'in_lab_and_imaging',
    'waiting_pharmacy',
    'waiting_direct_service',
    'in_direct_service',
];

const STEP_LABELS: Record<VisitJourneyStep, string> = {
    waiting_triage: 'Waiting for triage',
    in_triage: 'In triage',
    waiting_clinician: 'Waiting for clinician',
    waiting_clinician_review: 'Waiting for clinician review',
    with_clinician: 'With clinician',
    waiting_lab: 'Waiting for lab',
    waiting_imaging: 'Waiting for imaging',
    waiting_lab_and_imaging: 'Waiting for lab and imaging',
    in_lab: 'In lab',
    in_imaging: 'In imaging',
    in_lab_and_imaging: 'In lab and imaging',
    waiting_pharmacy: 'Waiting for pharmacy',
    waiting_direct_service: 'Waiting (direct service)',
    in_direct_service: 'In progress (direct service)',
};

/** P1/P2 (URGENT_PRIORITIES, shared with Board.vue's "Urgent only" filter) are the acute-priority tiers worth a color callout; P3-P5/null are routine — no badge, matching this board's own "don't badge the default case" convention (see ElapsedTimeBadge's normal-level). */
const AMBER_PRIORITIES = ['P3'];

function priorityClass(priority: string): string {
    if (URGENT_PRIORITIES.includes(priority)) {
        return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300';
    }
    if (AMBER_PRIORITIES.includes(priority)) {
        return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300';
    }
    return 'border-border bg-muted/40 text-muted-foreground';
}

function showPriority(priority: string | null): boolean {
    return isUrgentPriority(priority) || AMBER_PRIORITIES.includes(priority ?? '');
}

const { nameById: clinicianNameById } = usePatientFlowClinicianDirectory();

function clinicianLabel(clinicianUserId: number | null): string | null {
    if (clinicianUserId === null) return null;
    return clinicianNameById.value[clinicianUserId] ?? `Dr. #${clinicianUserId}`;
}

function orderWorklistHref(order: { type: 'lab' | 'imaging' | 'pharmacy' }, patientId: string | null): string | null {
    if (patientId === null) return null;
    const moduleKey: DirectServiceModuleKey = order.type === 'lab' ? 'laboratory' : order.type === 'imaging' ? 'radiology' : 'pharmacy';
    return directServicePatientWorklistHref(moduleKey, patientId);
}

function entryKey(entry: VisitJourneyEntry): string {
    return entry.appointmentId ?? entry.serviceRequestId ?? '';
}

// Reuses useElapsedTime.ts's own minute math (elapsedMinutesSince) rather
// than a second copy — ticks alongside every card's own ElapsedTimeBadge.
const now = useNow({ interval: 30_000 });

/**
 * Longest-waiting-first within each column — otherwise the most overdue
 * patient in, say, "Waiting for Lab" could render below several others that
 * arrived after them, purely because of whatever order the API happened to
 * return rows in. Entries with no stepEnteredAt (waiting_clinician /
 * waiting_clinician_review — no column marks that transition, see
 * GetActiveVisitJourneyUseCase's docblock) sort last: there's no timestamp
 * to judge urgency by, so they're neither promoted nor demoted by guesswork.
 */
const columns = computed(() =>
    STEP_ORDER.map((step) => ({
        step,
        label: STEP_LABELS[step],
        entries: props.entries
            .filter((entry) => entry.step === step)
            .slice()
            .sort((a, b) => {
                const aMinutes = elapsedMinutesSince(a.stepEnteredAt, now.value);
                const bMinutes = elapsedMinutesSince(b.stepEnteredAt, now.value);
                if (aMinutes === null && bMinutes === null) return 0;
                if (aMinutes === null) return 1;
                if (bMinutes === null) return -1;
                return bMinutes - aMinutes;
            }),
    })),
);

/**
 * Briefly highlights a card when it first appears or its step changes —
 * without this, a live push (Phase 2) can silently rearrange the board and a
 * viewer has no visual cue anything happened. Diffs by entry key + step
 * across refetches (a plain `key` change on `props.entries` isn't enough:
 * TanStack Query hands back a new array reference on every refetch even
 * when nothing actually changed). The very first render populates the
 * baseline without highlighting anything — only real changes after that
 * pulse.
 */
const recentlyChangedKeys = ref(new Set<string>());
const previousStepByKey = new Map<string, VisitJourneyStep>();
const highlightTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
let isFirstEntriesRender = true;

watch(
    () => props.entries,
    (entries) => {
        const seenKeys = new Set<string>();

        for (const entry of entries) {
            const key = entryKey(entry);
            if (!key) continue;
            seenKeys.add(key);

            const previousStep = previousStepByKey.get(key);
            previousStepByKey.set(key, entry.step);

            if (isFirstEntriesRender || previousStep === entry.step) continue;

            recentlyChangedKeys.value.add(key);
            const existingTimeout = highlightTimeouts.get(key);
            if (existingTimeout) clearTimeout(existingTimeout);
            highlightTimeouts.set(
                key,
                setTimeout(() => {
                    recentlyChangedKeys.value.delete(key);
                    highlightTimeouts.delete(key);
                }, 2500),
            );
        }

        for (const key of previousStepByKey.keys()) {
            if (!seenKeys.has(key)) previousStepByKey.delete(key);
        }

        isFirstEntriesRender = false;
    },
    { immediate: true },
);

onBeforeUnmount(() => {
    highlightTimeouts.forEach((timeout) => clearTimeout(timeout));
});

function columnStats(entries: VisitJourneyEntry[]): { averageLabel: string; longestLabel: string } | null {
    const minutes = entries
        .map((entry) => elapsedMinutesSince(entry.stepEnteredAt, now.value))
        .filter((value): value is number => value !== null);

    if (minutes.length === 0) return null;

    const average = Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length);
    const longest = Math.max(...minutes);

    return { averageLabel: formatMinutes(average), longestLabel: formatMinutes(longest) };
}
</script>

<template>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div
            v-for="column in columns"
            :key="column.step"
            class="flex flex-col gap-2 rounded-lg border bg-muted/10 p-2"
        >
            <div class="flex items-center justify-between px-1">
                <h3 class="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {{ column.label }}
                </h3>
                <Badge variant="outline">{{ column.entries.length }}</Badge>
            </div>
            <p v-if="columnStats(column.entries)" class="px-1 text-[10px] text-muted-foreground">
                avg {{ columnStats(column.entries)!.averageLabel }} · longest {{ columnStats(column.entries)!.longestLabel }}
            </p>

            <p
                v-if="column.entries.length === 0"
                class="rounded-md bg-background/60 px-2 py-3 text-center text-xs text-muted-foreground"
            >
                Empty
            </p>

            <div
                v-for="entry in column.entries"
                :key="entryKey(entry)"
                class="rounded-md border bg-background px-2.5 py-2 shadow-sm transition-colors duration-1000"
                :class="recentlyChangedKeys.has(entryKey(entry)) ? 'ring-2 ring-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30' : ''"
            >
                <div class="flex items-start justify-between gap-2">
                    <Link
                        v-if="entry.patientId"
                        :href="patientChartHref(entry.patientId, { from: 'patient-flow-board', appointmentId: entry.appointmentId ?? undefined })"
                        class="truncate text-sm font-medium text-foreground hover:underline"
                    >
                        {{ entry.patientName ?? 'Unknown patient' }}
                    </Link>
                    <p v-else class="truncate text-sm font-medium text-foreground">
                        {{ entry.patientName ?? 'Unknown patient' }}
                    </p>
                    <div class="flex shrink-0 items-center gap-1">
                        <Badge v-if="showPriority(entry.priority)" variant="outline" :class="priorityClass(entry.priority!)">
                            {{ entry.priority }}
                        </Badge>
                        <ElapsedTimeBadge :since="entry.stepEnteredAt" :warning-minutes="45" :critical-minutes="90" />
                    </div>
                </div>
                <p class="truncate text-xs text-muted-foreground">
                    {{ entry.department ?? 'No department set' }}
                </p>

                <Link
                    v-if="entry.clinicianUserId !== null"
                    :href="`/clinician/queue?clinicianUserId=${entry.clinicianUserId}`"
                    class="mt-1 block truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                    {{ clinicianLabel(entry.clinicianUserId) }}
                </Link>

                <p
                    v-if="entry.allergies.length > 0"
                    class="mt-1 flex items-center gap-1 truncate text-xs text-rose-700 dark:text-rose-300"
                >
                    <span aria-hidden="true">⚠</span>
                    {{ entry.allergies.map((allergy) => allergy.substanceName).join(', ') }}
                </p>

                <div v-if="entry.openOrders.length > 0" class="mt-1 flex flex-wrap gap-1">
                    <Link
                        v-for="(order, index) in entry.openOrders"
                        :key="`${order.type}-${index}`"
                        :href="orderWorklistHref(order, entry.patientId) ?? '#'"
                        class="rounded border border-input bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                        {{ order.label }}
                    </Link>
                </div>

                <Link
                    v-if="entry.billingStatus === 'pending'"
                    :href="entry.patientId ? `/billing-invoices?patientId=${entry.patientId}` : '/billing-invoices'"
                    class="mt-1 inline-flex items-center gap-1 text-xs text-amber-700 hover:underline dark:text-amber-300"
                >
                    <span aria-hidden="true">💰</span> Billing pending
                </Link>
            </div>
        </div>
    </div>
</template>
