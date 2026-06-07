<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton';

withDefaults(
    defineProps<{
        count?: number;
        showTrailing?: boolean;
    }>(),
    {
        count: 4,
        showTrailing: true,
    },
);
</script>

<template>
    <div class="divide-y">
        <div v-for="index in count" :key="`workflow-skeleton-${index}`" class="flex items-start gap-3 px-4 py-3.5">
            <Skeleton class="h-full w-[3px] shrink-0 self-stretch rounded-full" />
            <div class="min-w-0 flex-1 space-y-2">
                <Skeleton class="h-3.5 w-1/3 max-w-[12rem]" />
                <Skeleton class="h-3 w-2/3 max-w-md" />
            </div>
            <Skeleton v-if="showTrailing" class="h-8 w-16 shrink-0 rounded-lg" />
        </div>
    </div>
</template>
