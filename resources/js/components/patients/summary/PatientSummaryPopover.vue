<script setup lang="ts">
import { computed, ref } from 'vue';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePatientSummary } from '@/composables/patientSummary/usePatientSummary';
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
 */
const props = defineProps<{
    patientId: string;
}>();

defineSlots<{
    trigger?: () => unknown;
    actions?: () => unknown;
}>();

const open = ref(false);
const patientId = computed(() => props.patientId);
const summary = usePatientSummary(patientId, { enabled: open });
</script>

<template>
    <Popover v-model:open="open">
        <PopoverTrigger as-child>
            <slot name="trigger" />
        </PopoverTrigger>
        <PopoverContent align="start" class="w-auto p-0">
            <PatientSummaryCard :summary="summary.data.value ?? null" :is-pending="summary.isPending.value" :error="(summary.error.value as Error | null)">
                <template v-if="$slots.actions" #actions>
                    <slot name="actions" />
                </template>
            </PatientSummaryCard>
        </PopoverContent>
    </Popover>
</template>
