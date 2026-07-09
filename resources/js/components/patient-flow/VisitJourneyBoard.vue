<script setup lang="ts">
import { computed } from 'vue';
import { Badge } from '@/components/ui/badge';
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
    'in_lab',
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
    in_lab: 'In lab',
    waiting_pharmacy: 'Waiting for pharmacy',
    waiting_direct_service: 'Waiting (direct service)',
    in_direct_service: 'In progress (direct service)',
};

const columns = computed(() =>
    STEP_ORDER.map((step) => ({
        step,
        label: STEP_LABELS[step],
        entries: props.entries.filter((entry) => entry.step === step),
    })),
);
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

            <p
                v-if="column.entries.length === 0"
                class="rounded-md bg-background/60 px-2 py-3 text-center text-xs text-muted-foreground"
            >
                Empty
            </p>

            <div
                v-for="entry in column.entries"
                :key="entry.appointmentId ?? entry.serviceRequestId ?? undefined"
                class="rounded-md border bg-background px-2.5 py-2 shadow-sm"
            >
                <p class="truncate text-sm font-medium text-foreground">
                    {{ entry.patientName ?? 'Unknown patient' }}
                </p>
                <p class="truncate text-xs text-muted-foreground">
                    {{ entry.department ?? 'No department set' }}
                </p>
            </div>
        </div>
    </div>
</template>
