<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FacilityAdminSetupGuide from '@/components/setup/FacilityAdminSetupGuide.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMasterDataSetupReadiness } from '@/composables/useMasterDataSetupReadiness';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { hasRouteAccess } from '@/lib/routeAccess';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Setup Center', href: '/setup-center' },
];

const refreshing = ref(false);
const { permissionNames, hasUniversalAdminAccess, facilityEntitlementNames } = usePlatformAccess();

const wardBedSetupRequired = computed(() =>
    ['inpatient.ward', 'inpatient.tasks', 'inpatient.care_plans'].some((entitlement) =>
        facilityEntitlementNames.value.includes(entitlement),
    ),
);

const { loading, steps, loadSetupReadiness } = useMasterDataSetupReadiness({ includeWardBeds: wardBedSetupRequired });

const visibleSteps = computed(() =>
    steps.value.filter((step) => {
        if (step.key === 'ward_beds' && !wardBedSetupRequired.value) return false;
        return hasRouteAccess(step.href, permissionNames.value, hasUniversalAdminAccess.value);
    }),
);
const visibleStepKeys = computed(() => visibleSteps.value.map((step) => step.key));
const visibleReadyStepCount = computed(() => visibleSteps.value.filter((step) => step.ready).length);
const readinessPercent = computed(() => {
    if (visibleSteps.value.length === 0) return 0;
    return Math.round((visibleReadyStepCount.value / visibleSteps.value.length) * 100);
});

async function refreshSetup(): Promise<void> {
    if (refreshing.value) return;
    refreshing.value = true;
    try {
        await loadSetupReadiness(visibleStepKeys.value);
    } finally {
        refreshing.value = false;
    }
}

onMounted(async () => {
    await loadSetupReadiness(visibleStepKeys.value);
});
</script>

<template>
    <Head title="Setup Center" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-5 overflow-x-hidden p-4 md:p-6">

            <!-- Page header -->
            <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-semibold tracking-tight">Set up your facility</h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Complete steps in order. Departments and service points unlock patient registration.
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    <Badge :variant="readinessPercent === 100 ? 'secondary' : 'outline'">
                        {{ readinessPercent }}% ready
                    </Badge>
                    <Button size="sm" variant="outline" class="gap-1.5" :disabled="loading || refreshing" @click="refreshSetup">
                        <AppIcon name="activity" class="size-3.5" />
                        {{ refreshing ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                </div>
            </div>

            <!-- Single checklist component -->
            <FacilityAdminSetupGuide
                :steps="visibleSteps"
                :loading="loading || refreshing"
                :ward-bed-setup-required="wardBedSetupRequired"
            />
        </div>
    </AppLayout>
</template>
