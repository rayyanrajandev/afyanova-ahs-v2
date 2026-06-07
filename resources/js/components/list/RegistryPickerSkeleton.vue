<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton';

withDefaults(
    defineProps<{
        count?: number;
        compact?: boolean;
    }>(),
    {
        count: 6,
        compact: false,
    },
);
</script>

<template>
    <div class="space-y-2 pb-3">
        <div
            v-for="index in count"
            :key="`registry-picker-skeleton-${index}`"
            class="flex w-full items-center gap-3 rounded-lg border border-border/70 bg-background px-3"
            :class="compact ? 'py-2' : 'py-2.5'"
        >
            <Skeleton class="size-2 shrink-0 rounded-full" />
            <div class="min-w-0 flex-1 space-y-1.5">
                <Skeleton class="h-3.5 w-44 max-w-[90%]" />
                <Skeleton class="h-3 w-full max-w-[22rem]" />
            </div>
            <Skeleton class="size-4 shrink-0 rounded-sm" />
        </div>
    </div>
</template>
