<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { parseFilledResultSummarySections } from '@/lib/resultTemplate';

/**
 * Reusable "fast glance" result popover — same underlying resultSummary
 * text every result surface already has (order lists, patient chart,
 * encounter workspace, ...), rendered as filled-fields-only with
 * color-coded badges on binary findings (Positive/Present in red,
 * Negative/Absent/None Seen in green) instead of a raw text dump. Use
 * anywhere a quick read on a result matters more than the full sectioned
 * report (LaboratoryOrderDetailSheet.vue remains the source for that).
 */
const props = withDefaults(
    defineProps<{
        resultSummary: string | null;
        triggerLabel?: string;
        /** Applied to the trigger button — Popover's root has no DOM
         * element of its own, so plain attribute fallthrough from a
         * parent's `class="..."` wouldn't reach the visible trigger. */
        triggerClass?: string;
    }>(),
    {
        triggerLabel: 'Result summary',
        triggerClass: '',
    },
);

const parsedSections = computed(() =>
    props.resultSummary ? parseFilledResultSummarySections(props.resultSummary) : null,
);

const NOTABLE_VALUES = new Set(['positive', 'present']);
const REASSURING_VALUES = new Set(['negative', 'absent', 'none seen']);

function valueBadgeClass(value: string): string {
    const lower = value.trim().toLowerCase();
    if (NOTABLE_VALUES.has(lower)) {
        return 'border-destructive bg-destructive/10 text-destructive';
    }
    if (REASSURING_VALUES.has(lower)) {
        return 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
    }
    if (lower === 'not done') {
        return 'border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
    }
    return 'border-input text-foreground';
}
</script>

<template>
    <Popover>
        <PopoverTrigger as-child>
            <Button variant="outline" size="sm" :class="['h-7 gap-1.5 px-2 text-xs', triggerClass]">
                <AppIcon name="file-text" class="size-3" />
                {{ triggerLabel }}
            </Button>
        </PopoverTrigger>
        <PopoverContent align="start" class="max-h-80 w-80 overflow-y-auto text-xs">
            <div v-if="!resultSummary" class="text-muted-foreground">
                No result summary recorded.
            </div>
            <div v-else-if="parsedSections" class="space-y-3">
                <div v-if="parsedSections.length === 0" class="text-muted-foreground">
                    No findings recorded yet.
                </div>
                <div v-for="section in parsedSections" :key="section.label">
                    <p class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        {{ section.label }}
                    </p>
                    <div class="mt-1 space-y-1">
                        <div
                            v-for="field in section.fields"
                            :key="field.label"
                            class="flex items-start justify-between gap-2"
                        >
                            <span class="text-muted-foreground">{{ field.label }}</span>
                            <Badge variant="outline" :class="['shrink-0 text-[10px]', valueBadgeClass(field.value)]">
                                {{ field.value }}
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>
            <p v-else class="whitespace-pre-line">{{ resultSummary }}</p>
        </PopoverContent>
    </Popover>
</template>
