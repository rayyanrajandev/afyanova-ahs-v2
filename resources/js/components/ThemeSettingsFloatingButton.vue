<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import AppSettingsDialog from '@/components/AppSettingsDialog.vue';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

const isSettingsDialogOpen = ref(false);
</script>

<template>
    <div
        class="pointer-events-none fixed bottom-24 right-4 z-40 print:hidden sm:bottom-auto sm:right-0 sm:top-1/2 sm:-translate-y-1/2"
    >
        <TooltipProvider :delay-duration="150">
            <Tooltip>
                <TooltipTrigger :as-child="true">
                    <Button
                        type="button"
                        size="icon"
                        class="pointer-events-auto size-11 rounded-full border border-border/70 bg-card text-foreground shadow-lg transition hover:scale-[1.02] hover:bg-muted active:scale-[0.98] sm:h-12 sm:w-10 sm:rounded-l-full sm:rounded-r-none sm:border-r-0"
                        aria-label="Open theme settings"
                        aria-haspopup="dialog"
                        @click="isSettingsDialogOpen = true"
                    >
                        <AppIcon name="sliders-horizontal" class="size-5" />
                        <span class="sr-only">Open theme settings</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="left" align="center">
                    <p>Theme settings</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    </div>

    <AppSettingsDialog v-model:open="isSettingsDialogOpen" />
</template>
