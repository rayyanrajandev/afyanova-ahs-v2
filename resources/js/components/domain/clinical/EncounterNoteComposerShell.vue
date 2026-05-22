<script setup lang="ts">
import { ScrollArea } from '@/components/ui/scroll-area';
</script>

<template>
    <div
        class="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden max-lg:data-[state=inactive]:hidden"
        data-test="encounter-workspace-pane-note-panel"
    >
        <ScrollArea class="min-h-0 flex-1">
            <div class="space-y-5 px-4 pb-5 pt-4 md:px-6 md:pb-6">
                <slot />
            </div>
        </ScrollArea>
    </div>
</template>
