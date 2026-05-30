<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ScrollArea } from '@/components/ui/scroll-area';

const notePaneRef = ref<InstanceType<typeof ScrollArea> | null>(null);
const actionRailStyle = ref<Record<string, string>>({
    display: 'none',
});

let resizeObserver: ResizeObserver | null = null;

function notePaneElement(): HTMLElement | null {
    return (notePaneRef.value?.$el as HTMLElement | undefined) ?? null;
}

function updateActionRailBounds(): void {
    const notePane = notePaneElement();

    if (!notePane) {
        actionRailStyle.value = { display: 'none' };
        return;
    }

    const rect = notePane.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0;

    actionRailStyle.value = isVisible
        ? {
              display: 'block',
              left: `${Math.max(rect.left, 0)}px`,
              width: `${rect.width}px`,
          }
        : { display: 'none' };
}

onMounted(() => {
    void nextTick(updateActionRailBounds);

    const notePane = notePaneElement();

    if (notePane) {
        resizeObserver = new ResizeObserver(updateActionRailBounds);
        resizeObserver.observe(notePane);
    }

    window.addEventListener('resize', updateActionRailBounds);
    window.addEventListener('scroll', updateActionRailBounds, true);
});

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    window.removeEventListener('resize', updateActionRailBounds);
    window.removeEventListener('scroll', updateActionRailBounds, true);
});
</script>

<template>
    <ScrollArea
        ref="notePaneRef"
        class="mt-0 min-h-0 flex-1 max-lg:data-[state=inactive]:hidden"
        data-test="encounter-workspace-pane-note-panel"
    >
        <div
            class="space-y-5 pt-4"
            :class="$slots.footer ? 'pb-36 md:pb-32' : 'pb-5 md:pb-6'"
        >
            <slot />
        </div>
    </ScrollArea>
    <div
        v-if="$slots.footer"
        class="fixed bottom-0 z-40 border-t border-border/50 bg-background/95 py-3 shadow-[0_-12px_32px_-20px_hsl(var(--foreground)/0.35)] backdrop-blur supports-[backdrop-filter]:bg-background/90"
        :style="actionRailStyle"
        data-test="encounter-workspace-note-action-rail"
    >
        <slot name="footer" />
    </div>
</template>
