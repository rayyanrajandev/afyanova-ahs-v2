<script setup lang="ts">
import EncounterWorkspaceMobileTabs from '@/components/domain/clinical/EncounterWorkspaceMobileTabs.vue';
import EncounterWorkspacePaneToolbar from '@/components/domain/clinical/EncounterWorkspacePaneToolbar.vue';
import type { EncounterWorkspacePaneFocus } from '@/types/encounterWorkspace';

const paneFocus = defineModel<EncounterWorkspacePaneFocus>({ required: true });

defineProps<{
    showWorkflowWorkspace: boolean;
    completedSections: number;
    totalSections: number;
    careTotalCount: number;
    showMobileTabs?: boolean;
}>();
</script>

<template>
    <div
        v-if="showWorkflowWorkspace"
        class="z-10 shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90"
        data-test="encounter-workspace-nav-bar"
    >
        <EncounterWorkspaceMobileTabs
            v-if="showMobileTabs !== false"
            :show-workflow-tab="showWorkflowWorkspace"
            :completed-sections="completedSections"
            :total-sections="totalSections"
            :care-total-count="careTotalCount"
        />
        <div
            class="hidden items-center justify-between gap-3 py-2 lg:flex"
        >
            <p class="text-xs text-muted-foreground">
                Choose a layout for charting and orders side by side.
            </p>
            <EncounterWorkspacePaneToolbar v-model="paneFocus" />
        </div>
    </div>
</template>
