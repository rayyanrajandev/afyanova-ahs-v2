<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { useCareQuickStrip } from '@/composables/useCareQuickStrip';

const { showStrip, quickLinks, hasLinks } = useCareQuickStrip();
</script>

<template>
    <div
        v-if="showStrip && hasLinks"
        class="rounded-lg border border-border/70 bg-gradient-to-r from-muted/40 via-muted/25 to-transparent p-2.5 shadow-sm dark:from-muted/20"
        role="region"
        aria-label="Quick patient workflows"
    >
        <div class="mb-2 flex items-center justify-between gap-2 px-0.5">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick access</p>
            <span class="hidden text-[11px] text-muted-foreground sm:inline">Jump to high-traffic queues</span>
        </div>
        <div class="flex flex-wrap gap-2">
            <Link
                v-for="item in quickLinks"
                :key="item.href"
                :href="item.href"
                class="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border/80 bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <AppIcon :name="item.icon" class="size-4 shrink-0 opacity-80" />
                {{ item.label }}
            </Link>
        </div>
    </div>
</template>
