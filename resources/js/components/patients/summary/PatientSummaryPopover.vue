<script setup lang="ts">
import { computed, ref } from 'vue';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePatientSummary } from '@/composables/patientSummary/usePatientSummary';
import PatientDetailSheet from './PatientDetailSheet.vue';
import PatientSummaryCard from './PatientSummaryCard.vue';

/**
 * The actual drop-in piece most consuming pages import — combines
 * usePatientSummary() + PatientSummaryCard.vue inside a Popover, so
 * "click a patient's name to see quick context" works without any page
 * wiring the composable itself. Pages that need a different layout (e.g.
 * always-visible, not popover-triggered) can still use the composable and
 * card directly (reports/patient-summary-module-plan.md §4).
 *
 * Fetches nothing until opened — usePatientSummary's `enabled` option is
 * bound to this popover's own open state, so a page with many trigger
 * elements (a queue, a search result list) costs nothing until one is
 * actually clicked.
 *
 * Owns the transition to the second, deliberate-click tier too: the card's
 * "View full summary" closes the popover and opens PatientDetailSheet.vue
 * for the same patient — same query, same cache, so this costs nothing
 * extra. A consumer that only wants the Popover trigger gets both tiers
 * for free; no page wiring needed for the expand step either. The same
 * `actions` slot content is offered to both the card and the sheet, since
 * a page's quick actions (view chart, register visit, etc.) are relevant
 * at either depth.
 */
const props = defineProps<{
    patientId: string;
}>();

defineSlots<{
    trigger?: () => unknown;
    actions?: () => unknown;
}>();

const open = ref(false);
const detailSheetOpen = ref(false);
const patientId = computed(() => props.patientId);
const summary = usePatientSummary(patientId, { enabled: open });

function expand(): void {
    open.value = false;
    detailSheetOpen.value = true;
}
</script>

<template>
    <Popover v-model:open="open">
        <PopoverTrigger as-child>
            <slot name="trigger" />
        </PopoverTrigger>
        <PopoverContent align="start" class="w-auto p-0">
            <PatientSummaryCard
                :summary="summary.data.value ?? null"
                :is-pending="summary.isPending.value"
                :error="(summary.error.value as Error | null)"
                @expand="expand"
            >
                <template v-if="$slots.actions" #actions>
                    <slot name="actions" />
                </template>
            </PatientSummaryCard>
        </PopoverContent>
    </Popover>

    <PatientDetailSheet v-model:open="detailSheetOpen" :patient-id="patientId">
        <template v-if="$slots.actions" #actions>
            <slot name="actions" />
        </template>
    </PatientDetailSheet>
</template>
