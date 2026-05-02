<script setup lang="ts">
import AppContent from '@/components/AppContent.vue';
import AppFacilityScopeNotice from '@/components/AppFacilityScopeNotice.vue';
import AppShell from '@/components/AppShell.vue';
import AppSidebar from '@/components/AppSidebar.vue';
import AppSidebarHeader from '@/components/AppSidebarHeader.vue';
import FacilitySubscriptionBanner from '@/components/facility/FacilitySubscriptionBanner.vue';
import CareQuickStrip from '@/components/workspace/CareQuickStrip.vue';
import type { BreadcrumbItem } from '@/types';

type Props = {
    breadcrumbs?: BreadcrumbItem[];
};

withDefaults(defineProps<Props>(), {
    breadcrumbs: () => [],
});
</script>

<template>
    <AppShell variant="sidebar">
        <a
            href="#main-content"
            class="sr-only-focusable fixed left-2 top-2 z-[9999] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
            Skip to main content
        </a>
        <AppSidebar />
        <AppContent variant="sidebar" class="overflow-x-hidden">
            <AppSidebarHeader :breadcrumbs="breadcrumbs" />
            <div class="mx-4 mt-3 space-y-3 lg:mx-6">
                <FacilitySubscriptionBanner />
                <CareQuickStrip />
            </div>
            <AppFacilityScopeNotice />
            <slot />
        </AppContent>
    </AppShell>
</template>
