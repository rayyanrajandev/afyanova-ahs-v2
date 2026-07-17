<script setup lang="ts">
import { computed, ref } from 'vue';
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
 * Negative/Absent/None Seen in green) instead of a raw text dump.
 *
 * This is the single result entry point on a card: the glance lives in
 * the popover, and when `showViewFull` is set a "View full result" link
 * at the bottom emits `view-full-result` so the parent can open the
 * complete sectioned report (LaboratoryOrderDetailSheet.vue) — one
 * button, progressive disclosure, instead of a separate "Review result"
 * button sitting next to this one.
 */
const props = withDefaults(
    defineProps<{
        resultSummary: string | null;
        triggerLabel?: string;
        /** Applied to the trigger button — Popover's root has no DOM
         * element of its own, so plain attribute fallthrough from a
         * parent's `class="..."` wouldn't reach the visible trigger. */
        triggerClass?: string;
        /** Show the in-popover "View full result" link. Only surfaces that
         * wire a detail sheet (patient chart, encounter workspace) pass
         * this; list/summary surfaces without a sheet leave it off. */
        showViewFull?: boolean;
    }>(),
    {
        triggerLabel: 'Result summary',
        triggerClass: '',
        showViewFull: false,
    },
);

const emit = defineEmits<{ 'view-full-result': [] }>();

const open = ref(false);

function viewFullResult(): void {
    // Close the glance before the sheet animates in — leaving the popover
    // mounted behind the sheet overlay reads as a stuck layer.
    open.value = false;
    emit('view-full-result');
}

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
    <Popover v-model:open="open">
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

            <div v-if="showViewFull" class="mt-3 border-t pt-2">
                <button
                    type="button"
                    class="flex w-full items-center justify-between gap-2 rounded-sm px-1 py-1 text-xs font-medium text-primary hover:bg-muted"
                    @click="viewFullResult"
                >
                    View full result
                    <AppIcon name="arrow-right" class="size-3.5" />
                </button>
            </div>
        </PopoverContent>
    </Popover>
</template>
