<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatEnumLabel } from '@/lib/labels';

const props = defineProps<{
    loading?: boolean;
    error?: string | null;
    triageVitalsSummary?: string | null;
    triageNotes?: string | null;
    triageCategory?: string | null;
    triagedAt?: string | null;
    formatDateTime: (value: string | null | undefined) => string;
}>();

const hasTriageContent = computed(
    () =>
        Boolean(
            (props.triageVitalsSummary ?? '').trim() ||
                (props.triageNotes ?? '').trim() ||
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
    <section class="space-y-3 rounded-lg border bg-background p-4">
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

        <div v-if="loading" class="space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-16 w-full rounded-md" />
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
                v-if="(triageVitalsSummary ?? '').trim()"
                class="rounded-md border bg-muted/20 p-3"
            >
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Vitals summary
                </p>
                <p class="mt-1 text-sm leading-6 text-foreground">
                    {{ triageVitalsSummary }}
                </p>
            </div>

            <div
                v-if="(triageNotes ?? '').trim()"
                class="rounded-md border bg-muted/20 p-3"
            >
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Triage notes
                </p>
                <p class="mt-1 text-sm leading-6 text-foreground">
                    {{ triageNotes }}
                </p>
            </div>

            <p
                v-if="(triagedAt ?? '').trim()"
                class="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
                <AppIcon name="calendar-clock" class="size-3.5 opacity-70" />
                Triaged {{ formatDateTime(triagedAt) }}
                <span v-if="triageCategory">
                    · {{ formatEnumLabel(triageCategory) }}
                </span>
            </p>
        </div>
    </section>
</template>
