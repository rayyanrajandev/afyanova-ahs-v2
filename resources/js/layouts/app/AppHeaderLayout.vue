<script setup lang="ts">
import AppContent from '@/components/AppContent.vue';
import AppHeader from '@/components/AppHeader.vue';
import AppShell from '@/components/AppShell.vue';
import ThemeSettingsFloatingButton from '@/components/ThemeSettingsFloatingButton.vue';
import CareQuickLauncher from '@/components/workspace/CareQuickLauncher.vue';
import type { BreadcrumbItem } from '@/types';

type Props = {
    breadcrumbs?: BreadcrumbItem[];
};

withDefaults(defineProps<Props>(), {
    breadcrumbs: () => [],
});
</script>

<template>
    <AppShell class="flex-col">
        <AppHeader :breadcrumbs="breadcrumbs" />
        <AppContent>
            <slot />
        </AppContent>
        <ThemeSettingsFloatingButton />
        <CareQuickLauncher />
    </AppShell>
</template>
