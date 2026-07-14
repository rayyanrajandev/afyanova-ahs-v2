<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdmissionAdtTimeline } from '@/composables/admissions/useAdmissionAdtTimeline';
import type { Admission } from '@/composables/admissions/useAdmissions';
import { formatDateTime } from '@/composables/clinical/useEncounterOrdering';

/**
 * AdmA of the Admission V2 full-parity plan — lives inside an admission
 * row's expanded Collapsible content (admissions/IndexV2.vue), so its own
 * setup() only runs while that row is expanded: useAdmissionAdtTimeline
 * only fetches while this component is mounted, same lazy lifecycle as
 * EmergencyCaseTransfersPanel.vue.
 */
const props = defineProps<{
    admission: Admission;
}>();

const { timeline, isPending, isError } = useAdmissionAdtTimeline(computed(() => props.admission));
</script>

<template>
    <div class="space-y-2">
        <p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Admission timeline</p>

        <Skeleton v-if="isPending" class="h-10 w-full" />
        <p v-else-if="isError" class="text-xs text-destructive">Unable to load the full audit trail — showing current state only.</p>

        <ol v-if="timeline.length > 0" class="space-y-1.5">
            <li v-for="event in timeline" :key="event.key" class="flex items-start gap-2 rounded-md border bg-background px-2 py-1.5">
                <AppIcon :name="event.icon" class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div class="min-w-0 flex-1 space-y-0.5">
                    <div class="flex flex-wrap items-center gap-1.5">
                        <Badge :variant="event.variant" class="text-[10px]">{{ event.title }}</Badge>
                        <span class="text-[11px] text-muted-foreground">{{ formatDateTime(event.timestamp) }}</span>
                        <span v-if="event.source === 'current-state'" class="text-[10px] text-muted-foreground italic">(inferred)</span>
                    </div>
                    <p class="text-xs text-foreground">{{ event.description }}</p>
                    <p v-if="event.reason" class="text-[11px] text-muted-foreground">Reason: {{ event.reason }}</p>
                    <p v-if="event.handoffSummary" class="text-[11px] text-muted-foreground">{{ event.handoffSummary }}</p>
                </div>
            </li>
        </ol>
    </div>
</template>
