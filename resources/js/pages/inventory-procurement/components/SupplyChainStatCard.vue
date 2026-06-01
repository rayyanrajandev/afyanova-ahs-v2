<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Card, CardContent } from '@/components/ui/card';
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        label: string;
        value: string | number;
        icon?: 'package' | 'clipboard-list' | 'activity' | 'check-circle' | 'alert-triangle' | 'building-2';
        tone?: 'default' | 'primary' | 'destructive' | 'amber' | 'green';
    }>(),
    {
        icon: 'package',
        tone: 'default',
    },
);

const toneClasses = {
    default: {
        card: 'border-border/80 bg-card shadow-none',
        iconWrap: 'bg-muted/80 text-muted-foreground ring-border/80',
        label: 'text-muted-foreground',
        value: 'text-foreground',
    },
    primary: {
        card: 'border-primary/20 bg-primary/[0.04] shadow-none',
        iconWrap: 'bg-primary/10 text-primary ring-primary/20',
        label: 'text-muted-foreground',
        value: 'text-primary',
    },
    destructive: {
        card: 'border-destructive/35 bg-destructive/[0.06] shadow-none',
        iconWrap: 'bg-destructive/12 text-destructive ring-destructive/25',
        label: 'text-destructive/85',
        value: 'text-destructive',
    },
    amber: {
        card: 'border-amber-300/60 bg-amber-50/50 shadow-none dark:border-amber-800/50 dark:bg-amber-950/25',
        iconWrap: 'bg-amber-100 text-amber-700 ring-amber-200/80 dark:bg-amber-950/60 dark:text-amber-400 dark:ring-amber-800/60',
        label: 'text-amber-800/90 dark:text-amber-400/90',
        value: 'text-amber-900 dark:text-amber-300',
    },
    green: {
        card: 'border-green-300/60 bg-green-50/50 shadow-none dark:border-green-800/50 dark:bg-green-950/25',
        iconWrap: 'bg-green-100 text-green-700 ring-green-200/80 dark:bg-green-950/60 dark:text-green-400 dark:ring-green-800/60',
        label: 'text-green-800/90 dark:text-green-400/90',
        value: 'text-green-900 dark:text-green-300',
    },
} as const;

const classes = computed(() => toneClasses[props.tone]);
</script>

<template>
    <Card :class="['min-w-0 w-full rounded-md', classes.card]">
        <CardContent class="flex min-w-0 items-center gap-2.5 px-2.5 py-2">
            <div
                class="flex size-8 shrink-0 items-center justify-center rounded-md ring-1 ring-inset"
                :class="classes.iconWrap"
                aria-hidden="true"
            >
                <AppIcon :name="props.icon" class="size-4" />
            </div>
            <div class="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                <span class="truncate text-xs font-medium leading-tight" :class="classes.label">{{ props.label }}</span>
                <span class="shrink-0 text-base font-semibold tabular-nums leading-none" :class="classes.value">{{ props.value }}</span>
            </div>
        </CardContent>
    </Card>
</template>
