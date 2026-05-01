<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FacilityAdminSetupGuide from '@/components/setup/FacilityAdminSetupGuide.vue';
import MasterDataSetupGuide from '@/components/setup/MasterDataSetupGuide.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const {
    loading,
    steps,
    loadSetupReadiness,
    departmentReady,
    servicePointReady,
    wardBedReady,
    staffReady,
    clinicalReady,
    pricingReady,
    inventoryReady,
} = useMasterDataSetupReadiness({ includeWardBeds: wardBedSetupRequired });

const visibleSteps = computed(() =>
    steps.value.filter((step) => {
        if (step.key === 'ward_beds' && !wardBedSetupRequired.value) return false;

        return hasRouteAccess(step.href, permissionNames.value, hasUniversalAdminAccess.value);
    }),
);
const visibleStepKeys = computed(() => visibleSteps.value.map((step) => step.key));
const visibleReadyStepCount = computed(() => visibleSteps.value.filter((step) => step.ready).length);
const visibleRecommendedNextStep = computed(() => visibleSteps.value.find((step) => !step.ready) ?? null);
const setupComplete = computed(() => visibleSteps.value.length > 0 && visibleReadyStepCount.value === visibleSteps.value.length);
const currentStep = computed(() => visibleRecommendedNextStep.value?.key ?? visibleSteps.value[0]?.key ?? 'inventory');
const readinessPercent = computed(() => {
    if (visibleSteps.value.length === 0) return 0;

    return Math.round((visibleReadyStepCount.value / visibleSteps.value.length) * 100);
});
const nextStepLabel = computed(() => visibleRecommendedNextStep.value?.label ?? 'Operational workflows');

const semanticLayers = computed<Array<{
    title: string;
    description: string;
    principle: string;
    icon: string;
    state: string;
    tone: 'outline' | 'secondary';
    href: string;
}>>(() => [
    {
        title: 'Facility Operating Map',
        description: wardBedSetupRequired.value
            ? 'This is the local structure layer. Departments, service points, wards, beds, and accountable staff come before patient-flow testing.'
            : 'This is the local structure layer. Departments, service points, and accountable staff come before patient-flow testing; wards and beds activate only when the plan includes ward operations.',
        principle: 'Map the hospital first',
        icon: 'building-2',
        state: departmentReady.value && servicePointReady.value && staffReady.value && (!wardBedSetupRequired.value || wardBedReady.value) ? 'Ready' : 'Pending',
        tone: departmentReady.value && servicePointReady.value && staffReady.value && (!wardBedSetupRequired.value || wardBedReady.value) ? 'secondary' : 'outline',
        href: '/platform/admin/departments',
    },
    {
        title: 'Clinical Care Catalog',
        description: 'This is the care-definition layer. Clinicians and cashiers select tests, procedures, and medicines from here.',
        principle: 'Define care once',
        icon: 'book-open',
        state: clinicalReady.value ? 'Ready' : 'Pending',
        tone: clinicalReady.value ? 'secondary' : 'outline',
        href: '/platform/admin/clinical-catalogs',
    },
    {
        title: 'Billable Service Catalog',
        description: 'This is the charging layer. Finance should price linked catalog items instead of retyping names and codes.',
        principle: 'Charge linked services',
        icon: 'receipt',
        state: pricingReady.value ? 'Ready' : 'Pending',
        tone: pricingReady.value ? 'secondary' : 'outline',
        href: '/billing-service-catalog',
    },
    {
        title: 'Inventory Items',
        description: 'This is the physical-stock layer. Opening stock loads counted balances; live demand starts later through requisitions and procurement.',
        principle: 'Own physical stock',
        icon: 'package',
        state: inventoryReady.value ? 'Ready' : 'Pending',
        tone: inventoryReady.value ? 'secondary' : 'outline',
        href: '/inventory-procurement',
    },
].filter((layer) => hasRouteAccess(layer.href, permissionNames.value, hasUniversalAdminAccess.value)));


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
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden p-4 md:p-6">
            <section class="relative overflow-hidden rounded-lg border bg-card p-4 shadow-sm md:p-6">
                <div class="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.36fr)]">
                    <div class="min-w-0 space-y-4">
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">Setup Center</Badge>
                            <Badge variant="outline">{{ readinessPercent }}% ready</Badge>
                            <Badge variant="outline">Facility Admin Guide</Badge>
                            <Badge :variant="setupComplete ? 'secondary' : 'outline'">
                                {{ setupComplete ? 'Ready for live workflow testing' : 'Guided setup active' }}
                            </Badge>
                        </div>
                        <div class="space-y-2">
                            <h1 class="max-w-4xl text-2xl font-semibold tracking-tight md:text-3xl">
                                Set up your facility
                            </h1>
                            <p class="max-w-3xl text-sm leading-6 text-muted-foreground">
                                Complete each step in order. Departments and service points unlock patient registration. Everything else builds on that foundation.
                            </p>
                        </div>

                    </div>

                    <div class="rounded-lg border bg-background/85 p-4 shadow-sm backdrop-blur">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <p class="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Next step</p>
                                <p class="mt-1 text-lg font-semibold">{{ nextStepLabel }}</p>
                            </div>
                            <div class="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <AppIcon name="arrow-right" class="size-5" />
                            </div>
                        </div>
                        <p class="mt-3 text-sm text-muted-foreground">
                            <template v-if="visibleRecommendedNextStep">
                                Open the next step from here, complete the minimum record, then return to refresh readiness.
                            </template>
                            <template v-else>
                                Setup is ready. Move into patient, order, billing, POS, transfer, reporting, and audit workflows.
                            </template>
                        </p>
                        <div class="mt-4 flex flex-col gap-2">
                            <Button v-if="visibleRecommendedNextStep" as-child class="w-full gap-1.5">
                                <Link :href="visibleRecommendedNextStep.href">
                                    <AppIcon name="arrow-right" class="size-3.5" />
                                    Open {{ visibleRecommendedNextStep.label }}
                                </Link>
                            </Button>
                            <Button variant="outline" class="w-full gap-1.5" :disabled="loading || refreshing" @click="refreshSetup">
                                <AppIcon name="activity" class="size-3.5" />
                                {{ refreshing ? 'Refreshing readiness...' : 'Refresh readiness' }}
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            <FacilityAdminSetupGuide
                :steps="visibleSteps"
                :loading="loading || refreshing"
                :ward-bed-setup-required="wardBedSetupRequired"
            />

            <MasterDataSetupGuide
                :current-step="currentStep"
                :steps="visibleSteps"
                :recommended-next-step="visibleRecommendedNextStep"
                :loading="loading || refreshing"
            />
        </div>
    </AppLayout>
</template>
