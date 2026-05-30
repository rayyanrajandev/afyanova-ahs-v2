<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCareQuickStrip } from '@/composables/useCareQuickStrip';
const open = ref(false);
const { showStrip, quickLinks } = useCareQuickStrip();

const launcherBottom = ref('calc(1rem + env(safe-area-inset-bottom))');

let observer: MutationObserver | null = null;

function baseLauncherGap(): number {
    return window.matchMedia('(min-width: 640px)').matches ? 24 : 16;
}

function updateLauncherPosition(): void {
    const actionRail = document.querySelector<HTMLElement>(
        '[data-test="encounter-workspace-note-action-rail"]',
    );
    const baseGap = baseLauncherGap();

    if (!actionRail || window.getComputedStyle(actionRail).display === 'none') {
        launcherBottom.value = `calc(${baseGap}px + env(safe-area-inset-bottom))`;
        return;
    }

    const rect = actionRail.getBoundingClientRect();
    const overlapsViewportBottom = rect.height > 0 && rect.bottom >= window.innerHeight - 1;

    launcherBottom.value = overlapsViewportBottom
        ? `calc(${Math.ceil(rect.height) + baseGap}px + env(safe-area-inset-bottom))`
        : `calc(${baseGap}px + env(safe-area-inset-bottom))`;
}

onMounted(() => {
    void nextTick(updateLauncherPosition);

    observer = new MutationObserver(updateLauncherPosition);
    observer.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true,
    });

    window.addEventListener('resize', updateLauncherPosition);
    window.addEventListener('scroll', updateLauncherPosition, true);
});

onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
    window.removeEventListener('resize', updateLauncherPosition);
    window.removeEventListener('scroll', updateLauncherPosition, true);
});
</script>

<template>
    <div
        v-if="showStrip"
        class="pointer-events-none fixed right-4 z-50 flex flex-col items-end gap-2 pr-[env(safe-area-inset-right)] transition-[bottom] duration-200 sm:right-6"
        :style="{ bottom: launcherBottom }"
    >
        <Popover v-model:open="open">
            <PopoverTrigger as-child>
                <Button
                    type="button"
                    size="icon"
                    class="pointer-events-auto h-12 w-12 rounded-full shadow-lg ring-1 ring-border/60 transition hover:scale-[1.02] active:scale-[0.98]"
                    aria-label="Open quick patient workflows"
                    aria-haspopup="dialog"
                >
                    <AppIcon name="layout-grid" class="size-6" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                class="w-[min(18rem,calc(100vw-2rem))] p-2"
                side="top"
                align="end"
                :side-offset="10"
            >
                <p class="mb-1.5 px-2 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Quick access
                </p>
                <nav class="flex flex-col gap-0.5" aria-label="Quick patient workflows">
                    <Link
                        v-for="item in quickLinks"
                        :key="item.href"
                        :href="item.href"
                        class="flex min-h-10 items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        @click="open = false"
                    >
                        <AppIcon :name="item.icon" class="size-4 shrink-0 opacity-80" />
                        <span class="min-w-0 truncate">{{ item.label }}</span>
                    </Link>
                </nav>
            </PopoverContent>
        </Popover>
    </div>
</template>
