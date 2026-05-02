<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { useCareQuickStrip } from '@/composables/useCareQuickStrip';

const props = withDefaults(
    defineProps<{
        /** Use in main column (default) or left sidebar footer (no card chrome; sidebar colors). */
        placement?: 'inline' | 'sidebar';
    }>(),
    { placement: 'inline' },
);

const { showStrip, quickLinks, hasLinks } = useCareQuickStrip();

const linkClass = computed(() =>
    props.placement === 'sidebar'
        ? 'inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-sidebar-border/80 bg-sidebar-accent/30 px-2 text-xs font-medium text-sidebar-foreground shadow-none transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring sm:gap-1.5 sm:px-2.5 sm:text-sm'
        : 'inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border/70 bg-background px-2 text-xs font-medium text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-1.5 sm:px-2.5 sm:text-sm',
);

const navClass = computed(() =>
    props.placement === 'sidebar'
        ? 'flex max-w-full flex-col gap-1.5'
        : 'flex max-w-full flex-wrap items-center gap-1.5',
);
</script>

<template>
    <nav
        v-if="showStrip && hasLinks"
        :class="navClass"
        aria-label="Quick patient workflows"
    >
        <template v-if="placement === 'sidebar'">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/70">
                Quick access
            </p>
        </template>
        <div :class="placement === 'sidebar' ? 'flex flex-col gap-1' : 'contents'">
            <Link
                v-for="item in quickLinks"
                :key="item.href"
                :href="item.href"
                :class="linkClass"
                :title="item.label"
            >
                <AppIcon :name="item.icon" class="size-3.5 shrink-0 opacity-80 sm:size-4" />
                <span class="min-w-0 truncate">{{ item.label }}</span>
            </Link>
        </div>
    </nav>
</template>
