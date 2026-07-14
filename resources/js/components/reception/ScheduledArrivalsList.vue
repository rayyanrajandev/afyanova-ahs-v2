<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PatientSummaryPopover from '@/components/patients/summary/PatientSummaryPopover.vue';
import type { AppointmentListItem } from '@/composables/appointmentsIndex/useAppointmentList';

/**
 * Renders today's still-scheduled (not yet checked in) appointments —
 * see useTodaysScheduledAppointments.ts. Distinct from ReceptionQueueList.vue
 * (which renders post-check-in stages, waiting_triage/waiting_provider):
 * these rows haven't arrived yet, so the only action is "Check in", not
 * "take over"/"claim"/status transitions. Baked in directly rather than a
 * slot-based #actions API like ReceptionQueueList.vue — this list has
 * exactly one consumer (reception/Queue.vue) and exactly one action, so a
 * generic slot would be indirection with no second caller to justify it.
 */
const props = defineProps<{
    entries: AppointmentListItem[];
    patientDisplayName: (patientId: string | null | undefined) => string;
    patientNumber: (patientId: string | null | undefined) => string;
    clinicianDisplayName: (clinicianUserId: number | null) => string;
    checkingInId: string | null;
}>();

const emit = defineEmits<{
    'check-in': [appointmentId: string];
}>();

function scheduledTimeLabel(scheduledAt: string | null): string {
    if (!scheduledAt) return 'Time unknown';
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime())) return 'Time unknown';
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
</script>

<template>
    <div
        v-if="props.entries.length === 0"
        class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
    >
        No scheduled arrivals remaining for today.
    </div>

    <ul v-else class="space-y-2">
        <li
            v-for="entry in props.entries"
            :key="entry.id"
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-sm"
        >
            <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                    <PatientSummaryPopover v-if="entry.patientId" :patient-id="entry.patientId">
                        <template #trigger>
                            <button type="button" class="font-medium text-foreground hover:underline">
                                {{ props.patientDisplayName(entry.patientId) }}
                            </button>
                        </template>
                        <template #actions>
                            <a :href="`/patients/${entry.patientId}/chart`" class="text-xs font-medium text-primary hover:underline">
                                View chart
                            </a>
                        </template>
                    </PatientSummaryPopover>
                    <p v-else class="font-medium text-foreground">{{ props.patientDisplayName(entry.patientId) }}</p>
                    <span v-if="props.patientNumber(entry.patientId)" class="text-xs text-muted-foreground">
                        {{ props.patientNumber(entry.patientId) }}
                    </span>
                </div>
                <p class="text-xs text-muted-foreground">
                    {{ entry.department ?? 'No department set' }} · {{ props.clinicianDisplayName(entry.clinicianUserId) }}
                </p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="outline">{{ scheduledTimeLabel(entry.scheduledAt) }}</Badge>
                <Button size="sm" :disabled="props.checkingInId === entry.id" @click="emit('check-in', entry.id)">
                    {{ props.checkingInId === entry.id ? 'Checking in…' : 'Check in' }}
                </Button>
            </div>
        </li>
    </ul>
</template>
