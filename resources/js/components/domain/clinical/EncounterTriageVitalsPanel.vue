<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { formatEnumLabel } from '@/lib/labels';

const props = defineProps<{
    variant?: 'card' | 'compact';
    loading?: boolean;
    error?: string | null;
    triageVitalsSummary?: string | null;
    triageNotes?: string | null;
    triageCategory?: string | null;
    triagedAt?: string | null;
    formatDateTime: (value: string | null | undefined) => string;
}>();

const triageVitalsSummaryText = computed(() =>
    (props.triageVitalsSummary ?? '').trim(),
);
const triageNotesText = computed(() => (props.triageNotes ?? '').trim());
const triagedAtLabel = computed(() =>
    (props.triagedAt ?? '').trim()
        ? `Triaged ${props.formatDateTime(props.triagedAt)}`
        : '',
);

const hasTriageContent = computed(
    () =>
        Boolean(
            triageVitalsSummaryText.value ||
                triageNotesText.value ||
                triagedAtLabel.value ||
                (props.triageCategory ?? '').trim(),
        ),
);

const triageCategoryVariant = computed(() => {
    const category = (props.triageCategory ?? '').trim().toUpperCase();
    if (category === 'P1' || category === 'P2') return 'destructive';
    if (category === 'P3') return 'default';
    return 'secondary';
});
</script>

<template>
    <div
        v-if="variant === 'compact'"
        class="rounded-lg bg-muted/20 px-3 py-2 ring-1 ring-border/40"
        aria-label="Triage and vitals"
    >
        <div class="flex flex-wrap items-center gap-1.5 text-xs leading-5">
            <span class="mr-1 font-medium text-foreground">Triage and vitals</span>
            <span class="mr-1 text-muted-foreground">
                Intake summary captured before this consultation started.
            </span>
            <Badge
                v-if="triageCategory"
                :variant="triageCategoryVariant"
                class="h-5 rounded-full px-2 text-[10px] font-semibold"
            >
                {{ triageCategory }}
            </Badge>
            <span v-if="loading" class="text-muted-foreground">
                Loading triage summary.
            </span>
            <span v-else-if="error" class="text-destructive">{{ error }}</span>
            <template v-else-if="hasTriageContent">
                <Badge
                    v-if="triageVitalsSummaryText"
                    variant="outline"
                    class="h-auto min-h-5 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-medium"
                >
                    Vitals: {{ triageVitalsSummaryText }}
                </Badge>
                <Badge
                    v-if="triageNotesText"
                    variant="outline"
                    class="h-auto min-h-5 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-medium"
                >
                    Notes: {{ triageNotesText }}
                </Badge>
                <Badge
                    v-if="triagedAtLabel"
                    variant="secondary"
                    class="h-auto min-h-5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                >
                    {{ triagedAtLabel }}
                </Badge>
            </template>
            <span v-else class="text-muted-foreground">
                No triage or vitals summary recorded.
            </span>
        </div>
    </div>

    <div v-else class="space-y-3 rounded-lg border bg-background p-4">
        <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="space-y-1">
                <p class="text-sm font-medium">Triage and vitals</p>
                <p class="text-xs text-muted-foreground">
                    Intake summary captured before this consultation started.
                </p>
            </div>
            <Badge
                v-if="triageCategory"
                :variant="triageCategoryVariant"
                class="text-[11px]"
            >
                {{ triageCategory }}
            </Badge>
        </div>

        <div
            v-if="loading"
            class="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-3 text-sm text-muted-foreground"
        >
            Loading triage summary.
        </div>

        <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>

        <div
            v-else-if="!hasTriageContent"
            class="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-3 text-sm text-muted-foreground"
        >
            No triage or vitals summary has been recorded for this visit yet.
        </div>

        <div v-else class="space-y-3">
            <div
                v-if="triageVitalsSummaryText"
                class="rounded-md border bg-muted/20 p-3"
            >
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Vitals summary
                </p>
                <p class="mt-1 text-sm leading-6 text-foreground">
                    {{ triageVitalsSummaryText }}
                </p>
            </div>

            <div
                v-if="triageNotesText"
                class="rounded-md border bg-muted/20 p-3"
            >
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Triage notes
                </p>
                <p class="mt-1 text-sm leading-6 text-foreground">
                    {{ triageNotesText }}
                </p>
            </div>

            <p
                v-if="triagedAtLabel"
                class="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
                <AppIcon name="calendar-clock" class="size-3.5 opacity-70" />
                {{ triagedAtLabel }}
                <span v-if="triageCategory">
                    &middot; {{ formatEnumLabel(triageCategory) }}
                </span>
            </p>
        </div>
    </div>
</template>
