<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import PatientSummaryPopover from '@/components/patients/summary/PatientSummaryPopover.vue';
import { type ReceptionQueueEntry } from '@/composables/reception/useReceptionQueue';

/**
 * Deliberately neutral and role-agnostic — a pure entries renderer, no
 * baked-in action of any kind. It's consumed by both reception/Queue.vue
 * (front-desk visibility) and triage/Queue.vue (nurse triage recording);
 * whoever mounts it supplies row actions via the #actions scoped slot,
 * rather than this component deciding what any particular role should be
 * able to do. An earlier version baked a "Record triage" button directly
 * into this component gated by a `stage` prop — reverted: that made a
 * front-desk-named page ("Reception Queue") the place nurses record
 * triage, conflating "this screen can show a queue segment" with "this
 * screen should own that segment's actions." See
 * reports/appointments-scheduling-workspace-modernization-plan.md's
 * Phase 3 correction note for the full reasoning.
 */
defineProps<{
    entries: ReceptionQueueEntry[];
}>();

defineSlots<{
    actions?: (props: { entry: ReceptionQueueEntry }) => unknown;
}>();

/**
 * Mirrors GetReceptionQueueUseCase::ARRIVAL_MODE_TIERS
 * (app/Modules/Reception/Application/UseCases/GetReceptionQueueUseCase.php) —
 * display labels only, the actual ordering already happened server-side.
 */
function arrivalModeLabel(mode: string | null): string {
    switch (mode) {
        case 'emergency':
            return 'Emergency';
        case 'scheduled_checkin':
            return 'Scheduled';
        case 'walk_in':
            return 'Walk-in';
        default:
            // No ArrivalEventModel row for this appointment — reached this
            // stage without going through check-in (e.g. bounced between
            // triage/provider a few times, or data older than arrival
            // tracking). "Arrival unknown", not a bare "Unknown", so it
            // reads as "we don't know how they arrived," not as some other
            // kind of missing/broken data.
            return 'Arrival unknown';
    }
}

function arrivalModeVariant(mode: string | null) {
    return mode === 'emergency' ? ('destructive' as const) : ('outline' as const);
}

/**
 * `status === 'in_consultation'` entries carry consultation duration in
 * waitMinutes (see GetReceptionQueueUseCase's docblock), not a wait-for-
 * something time — labeling that "46h 29m wait" is actively misleading, as
 * if the patient were still waiting rather than already being seen. Every
 * other stage (waiting_triage, waiting_provider) is a genuine wait.
 */
function waitLabel(rawMinutes: number | null, status: string | null, consultationStep: string | null = null): string {
    const isConsultation = status === 'in_consultation';
    // A diagnostic step (waiting_lab/in_lab/waiting_pharmacy) means the patient has
    // stepped away from the clinician — "X in consultation" would directly contradict
    // the "Waiting on lab" sub-label shown alongside it, so this drops the "in
    // consultation" framing in favor of a neutral elapsed-time phrasing.
    const awayFromClinician = isConsultation && consultationStep !== null;

    if (rawMinutes === null) return isConsultation ? 'Consultation duration unknown' : 'Wait time unknown';
    // Defensive floor, not just a display trust in the API's own (int) cast:
    // a stray float here previously rendered as "16h 42.178472083333304m wait".
    const minutes = Math.floor(rawMinutes);
    const suffix = awayFromClinician ? 'since consultation started' : isConsultation ? 'in consultation' : 'wait';

    if (minutes < 1) return isConsultation ? 'Just started' : 'Just arrived';
    if (minutes < 60) return `${minutes} min ${suffix}`;

    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return `${hours}h ${remainder}m ${suffix}`;
}
</script>

<template>
    <div
        v-if="entries.length === 0"
        class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
    >
        No one is waiting.
    </div>

    <ul v-else class="space-y-2">
        <li
            v-for="entry in entries"
            :key="entry.appointmentId"
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-sm"
            :class="entry.arrivalMode === 'emergency' ? 'border-destructive/40 bg-destructive/5' : ''"
        >
            <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                    <PatientSummaryPopover v-if="entry.patientId" :patient-id="entry.patientId">
                        <template #trigger>
                            <button type="button" class="font-medium text-foreground hover:underline">
                                {{ entry.patientName ?? 'Unknown patient' }}
                            </button>
                        </template>
                        <template #actions>
                            <a :href="`/patients/${entry.patientId}/chart`" class="text-xs font-medium text-primary hover:underline">
                                View chart
                            </a>
                        </template>
                    </PatientSummaryPopover>
                    <p v-else class="font-medium text-foreground">
                        {{ entry.patientName ?? 'Unknown patient' }}
                    </p>
                    <span v-if="entry.patientNumber" class="text-xs text-muted-foreground">
                        {{ entry.patientNumber }}
                    </span>
                </div>
                <p class="text-xs text-muted-foreground">
                    {{ entry.department ?? 'No department set' }}
                </p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1">
                <Badge :variant="arrivalModeVariant(entry.arrivalMode)">
                    {{ arrivalModeLabel(entry.arrivalMode) }}
                </Badge>
                <p class="text-[11px] text-muted-foreground">
                    {{ waitLabel(entry.waitMinutes, entry.status, entry.consultationStep) }}
                </p>
                <slot name="actions" :entry="entry" />
            </div>
        </li>
    </ul>
</template>
