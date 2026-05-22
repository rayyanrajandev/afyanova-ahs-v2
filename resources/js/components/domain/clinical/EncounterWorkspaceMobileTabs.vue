<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';

defineProps<{
    completedSections: number;
    totalSections: number;
    careTotalCount: number;
    showWorkflowTab: boolean;
}>();
</script>

<template>
    <TabsList
        v-if="showWorkflowTab"
        class="grid h-auto shrink-0 grid-cols-2 gap-1 rounded-none border-b border-border/40 bg-muted/20 p-2 lg:hidden"
        data-test="encounter-workspace-mobile-tabs"
    >
        <TabsTrigger
            value="note"
            class="h-9 w-full gap-1.5 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
            <AppIcon name="file-text" class="size-3.5 shrink-0" aria-hidden="true" />
            Clinical note
            <span
                class="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground"
            >
                {{ completedSections }}/{{ totalSections }}
            </span>
        </TabsTrigger>
        <TabsTrigger
            value="workflow"
            class="h-9 w-full gap-1.5 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
            <AppIcon name="activity" class="size-3.5 shrink-0" aria-hidden="true" />
            Orders &amp; results
            <span
                v-if="careTotalCount > 0"
                class="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground"
            >
                {{ careTotalCount }}
            </span>
        </TabsTrigger>
    </TabsList>
</template>
