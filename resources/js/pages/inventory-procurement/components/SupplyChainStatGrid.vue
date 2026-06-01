<script setup lang="ts">
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

withDefaults(
    defineProps<{
        loading?: boolean;
        skeletonCount?: number;
        columnsClass?: string;
    }>(),
    {
        loading: false,
        skeletonCount: 4,
        columnsClass:
            'grid w-full gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,9.5rem),1fr))]',
    },
);
</script>

<template>
    <div :class="columnsClass">
        <template v-if="loading">
            <Card v-for="n in skeletonCount" :key="n" class="min-w-0 w-full rounded-md border shadow-none">
                <CardContent class="flex items-center gap-2.5 px-2.5 py-2">
                    <Skeleton class="size-8 shrink-0 rounded-md" />
                    <div class="flex flex-1 items-center justify-between gap-2">
                        <Skeleton class="h-3 w-20" />
                        <Skeleton class="h-5 w-10" />
                    </div>
                </CardContent>
            </Card>
        </template>
        <slot v-else />
    </div>
</template>
