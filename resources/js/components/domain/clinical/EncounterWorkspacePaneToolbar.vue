<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import type { EncounterWorkspacePaneFocus } from '@/types/encounterWorkspace';

const paneFocus = defineModel<EncounterWorkspacePaneFocus>({ required: true });

const options: Array<{
    value: EncounterWorkspacePaneFocus;
    label: string;
    icon: string;
    testId: string;
    shortcut: string;
}> = [
    {
        value: 'note',
        label: 'Notes focus',
        icon: 'file-text',
        testId: 'encounter-workspace-pane-note',
        shortcut: 'Alt+1',
    },
    {
        value: 'care',
        label: 'Orders focus',
        icon: 'activity',
        testId: 'encounter-workspace-pane-care',
        shortcut: 'Alt+2',
    },
    {
        value: 'both',
        label: 'Split view',
        icon: 'layout-grid',
        testId: 'encounter-workspace-pane-both',
        shortcut: 'Alt+3',
    },
];
</script>

<template>
    <div
        class="hidden items-center gap-1 rounded-lg border bg-muted/20 p-1 lg:inline-flex"
        role="group"
        aria-label="Workspace pane layout"
        data-test="encounter-workspace-pane-toolbar"
    >
        <Button
            v-for="option in options"
            :key="option.value"
            type="button"
            size="sm"
            :variant="paneFocus === option.value ? 'secondary' : 'ghost'"
            class="h-7 gap-1.5 px-2.5 text-xs"
            :aria-pressed="paneFocus === option.value"
            :aria-keyshortcuts="option.shortcut"
            :data-test="option.testId"
            :title="`${option.label} (${option.shortcut})`"
            @click="paneFocus = option.value"
        >
            <AppIcon :name="option.icon" class="size-3.5" aria-hidden="true" />
            {{ option.label }}
        </Button>
    </div>
</template>
