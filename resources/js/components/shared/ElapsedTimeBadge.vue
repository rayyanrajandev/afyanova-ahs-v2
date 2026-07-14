<script setup lang="ts">
import { computed } from 'vue';
import { Badge } from '@/components/ui/badge';
import { useElapsedTime } from '@/composables/useElapsedTime';

/**
 * Shared color-escalating "time since X" pill — see useElapsedTime.ts for
 * the rationale. Renders nothing when `since` is null/unparseable: honest
 * about missing data rather than fabricating a "0m".
 */
const props = withDefaults(
    defineProps<{
        since: string | null | undefined;
        warningMinutes?: number;
        criticalMinutes?: number;
        class?: string;
    }>(),
    {
        warningMinutes: 30,
        criticalMinutes: 60,
        class: '',
    },
);

const elapsed = useElapsedTime(
    computed(() => props.since),
    computed(() => props.warningMinutes),
    computed(() => props.criticalMinutes),
);

// Matches this codebase's established stock-state color convention
// (rose/amber/emerald, inventory-procurement/stock-control/Index.vue),
// reused here rather than inventing a fourth color scheme.
const levelClass = computed(() => {
    switch (elapsed.value.level) {
        case 'critical':
            return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300';
        case 'warning':
            return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300';
        default:
            return 'border-border bg-muted/40 text-muted-foreground';
    }
});
</script>

<template>
    <Badge v-if="elapsed.minutes !== null" variant="outline" :class="[levelClass, props.class]">
        {{ elapsed.label }}
    </Badge>
</template>
