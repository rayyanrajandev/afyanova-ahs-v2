<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton';

withDefaults(
    defineProps<{
        count?: number;
        showBadge?: boolean;
        showAction?: boolean;
    }>(),
    {
        count: 6,
        showBadge: true,
        showAction: true,
    },
);
</script>

<template>
    <div class="divide-y px-4">
        <div v-for="index in count" :key="`registry-skeleton-${index}`" class="flex items-center gap-3 py-3">
            <Skeleton class="size-2 shrink-0 rounded-full" />
            <div class="min-w-0 flex-1 space-y-2">
                <Skeleton class="h-4 w-48" />
                <Skeleton class="h-3.5 w-64 max-w-full" />
            </div>
            <Skeleton v-if="showBadge" class="hidden h-5 w-20 shrink-0 rounded-full sm:block" />
            <Skeleton v-if="showAction" class="h-8 w-24 shrink-0 rounded-md" />
        </div>
    </div>
</template>
