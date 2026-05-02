<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCareQuickStrip } from '@/composables/useCareQuickStrip';
const open = ref(false);
const { showStrip, quickLinks, hasLinks } = useCareQuickStrip();
</script>

<template>
    <div
        v-if="showStrip && hasLinks"
        class="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] sm:bottom-6 sm:right-6"
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
