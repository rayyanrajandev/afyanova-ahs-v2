<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import { type ReceptionQueueEntry } from '@/composables/reception/useReceptionQueue';

defineProps<{
    entries: ReceptionQueueEntry[];
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
            return 'Unknown';
    }
}

function arrivalModeVariant(mode: string | null) {
    return mode === 'emergency' ? ('destructive' as const) : ('outline' as const);
}

function waitLabel(minutes: number | null): string {
    if (minutes === null) return 'Wait time unknown';
    if (minutes < 1) return 'Just arrived';
    if (minutes < 60) return `${minutes} min wait`;

    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return `${hours}h ${remainder}m wait`;
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
                    <p class="font-medium text-foreground">
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
                    {{ waitLabel(entry.waitMinutes) }}
                </p>
            </div>
        </li>
    </ul>
</template>
