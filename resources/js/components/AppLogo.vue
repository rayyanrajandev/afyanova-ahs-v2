<script setup lang="ts">
import { computed } from 'vue';
import AppBrandMark from '@/components/AppBrandMark.vue';
import { useBranding } from '@/composables/useBranding';

const { branding, displayName, hasCustomLogo } = useBranding();

const logoShellClass = computed(() =>
    hasCustomLogo.value
        ? 'flex aspect-square size-9 items-center justify-center overflow-hidden rounded-lg border border-sidebar-border/70 bg-white p-1 shadow-sm dark:bg-sidebar-accent/30'
        : 'flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground',
);

const logoMarkClass = computed(() =>
    hasCustomLogo.value
        ? 'size-full object-contain'
        : 'size-5 fill-current text-white dark:text-black',
);
</script>

<template>
    <div :class="logoShellClass">
        <AppBrandMark :branding="branding" :class-name="logoMarkClass" />
    </div>
    <div class="ml-1 grid flex-1 text-left text-sm">
        <span class="mb-0.5 truncate leading-tight font-semibold">
            {{ displayName }}
        </span>
    </div>
</template>
