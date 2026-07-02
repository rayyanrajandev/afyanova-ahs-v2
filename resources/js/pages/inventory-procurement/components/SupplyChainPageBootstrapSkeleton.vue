<script setup lang="ts">
withDefaults(defineProps<{
    tabCount?: number;
    summaryCount?: number;
    rowCount?: number;
}>(), {
    tabCount: 3,
    summaryCount: 3,
    rowCount: 4,
});
</script>

<template>
    <Card class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70 shadow-sm">
        <CardHeader class="gap-4 border-b pb-4">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div class="min-w-0 space-y-2">
                    <Skeleton class="h-5 w-32" />
                    <Skeleton class="h-4 w-80 max-w-full" />
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Skeleton class="h-8 w-20 rounded-md" />
                    <Skeleton class="h-8 w-24 rounded-md" />
                    <Skeleton class="h-8 w-8 rounded-md" />
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <Skeleton
                    v-for="index in tabCount"
                    :key="`supply-chain-tab-skeleton-${index}`"
                    class="h-8 w-28 rounded-md"
                />
            </div>

            <div class="flex flex-col gap-2 lg:flex-row lg:items-center">
                <Skeleton class="h-8 flex-1 rounded-lg" />
                <Skeleton class="h-8 w-full rounded-lg lg:w-28" />
                <Skeleton class="h-8 w-full rounded-lg lg:w-24" />
            </div>
        </CardHeader>

        <CardContent class="space-y-3 p-4">
            <div class="grid gap-3 md:grid-cols-3">
                <div
                    v-for="index in summaryCount"
                    :key="`supply-chain-summary-skeleton-${index}`"
                    class="space-y-2 rounded-lg border bg-muted/20 p-3"
                >
                    <Skeleton class="h-3 w-24" />
                    <Skeleton class="h-5 w-20" />
                </div>
            </div>

            <div
                v-for="index in rowCount"
                :key="`supply-chain-row-skeleton-${index}`"
                class="rounded-lg border p-3"
            >
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div class="min-w-0 space-y-2">
                        <Skeleton class="h-4 w-48 max-w-full" />
                        <Skeleton class="h-3 w-72 max-w-full" />
                        <Skeleton class="h-3 w-56 max-w-full" />
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <Skeleton class="h-7 w-20 rounded-full" />
                        <Skeleton class="h-8 w-20 rounded-md" />
                        <Skeleton class="h-8 w-8 rounded-md" />
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
</template>

<script lang="ts">
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
</script>