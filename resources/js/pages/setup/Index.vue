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
    openingStockReady,
    patientRegistrationReady,
    departmentRequisitionReady,
    procurementRequestReady,
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

const operationalChecklist = computed(() => [
    {
        title: 'Register first patient',
        description: 'Create the first real or test patient only after the facility structure and minimum service setup are in place.',
        ready: patientRegistrationReady.value,
        icon: 'users',
        href: '/patients',
    },
    {
        title: 'Set opening stock',
        description: 'Load day-0 counted balances into the right warehouse. This is setup stock, not a purchase, expense, or requisition.',
        ready: openingStockReady.value,
        icon: 'activity',
        href: '/inventory-procurement?section=inventory',
    },
    {
        title: 'Create department requisition',
        description: 'Start live store demand from a department request so stock issues are auditable and not hidden as manual adjustments.',
        ready: departmentRequisitionReady.value,
        icon: 'clipboard-list',
        href: '/inventory-procurement?section=requisitions',
    },
    {
        title: 'Create procurement request',
        description: 'Raise supplier procurement only after demand or low-stock need exists, then test approval, order, receipt, cost, and audit trail.',
        ready: procurementRequestReady.value,
        icon: 'package',
        href: '/inventory-procurement?section=procurement',
    },
].filter((item) => hasRouteAccess(item.href, permissionNames.value, hasUniversalAdminAccess.value)));

const setupPrinciples = [
    {
        title: 'Confirm scope first',
        description: 'Facility admins must verify organization, facility, subscription, and active scope before creating operational data.',
        icon: 'shield-check',
    },
    {
        title: 'Map the facility',
        description: 'Departments, service points, and staff form the local operating map. Wards and beds become required only when the facility plan includes ward operations.',
        icon: 'building-2',
    },
    {
        title: 'Define care before prices',
        description: 'Clinical definitions drive selections; finance links to them instead of retyping service names.',
        icon: 'book-open',
    },
    {
        title: 'Separate stock from services',
        description: 'Inventory owns physical items only. Medicines may bridge to formulary; lab tests never become reagents.',
        icon: 'package',
    },
    {
        title: 'Prove live operations',
        description: 'Patient registration, opening stock, requisitions, and procurement prove day-1 controls.',
        icon: 'shield-check',
    },
];

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
                                Guide the facility admin from first login to first patient registration.
                            </h1>
                            <p class="max-w-3xl text-sm leading-6 text-muted-foreground">
                                This center turns setup into a controlled launch path: verify facility scope and plan, build departments and service points, add ward beds only when the plan includes ward operations, prepare staff, catalogs, pricing, and stock, then test patient registration and live operations.
                            </p>
                        </div>
                        <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            <div
                                v-for="principle in setupPrinciples"
                                :key="principle.title"
                                class="min-w-0 rounded-lg border bg-background/70 p-3 backdrop-blur"
                            >
                                <div class="flex items-center gap-2">
                                    <div class="rounded-lg bg-primary/10 p-1.5 text-primary">
                                        <AppIcon :name="principle.icon" class="size-3.5" />
                                    </div>
                                    <p class="truncate text-sm font-semibold">{{ principle.title }}</p>
                                </div>
                                <p class="mt-2 line-clamp-2 text-xs leading-4 text-muted-foreground">
                                    {{ principle.description }}
                                </p>
                            </div>
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

            <div class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <Card class="rounded-lg border-sidebar-border/70">
                    <CardHeader class="pb-3">
                        <CardTitle>Governance Split</CardTitle>
                        <CardDescription>Modern hospital systems keep clinical definitions, charging, and stock ownership separate.</CardDescription>
                    </CardHeader>
                    <CardContent class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div v-for="layer in semanticLayers" :key="layer.title" class="min-w-0 rounded-lg border bg-muted/20 p-3">
                            <div class="flex items-start justify-between gap-2">
                                <div class="min-w-0">
                                    <p class="truncate text-sm font-semibold">{{ layer.title }}</p>
                                    <p class="mt-0.5 text-xs font-medium text-muted-foreground">{{ layer.principle }}</p>
                                </div>
                                <div class="rounded-lg bg-background p-1.5 text-muted-foreground">
                                    <AppIcon :name="layer.icon" class="size-3.5" />
                                </div>
                            </div>
                            <p class="mt-2 line-clamp-3 text-xs leading-4 text-muted-foreground">{{ layer.description }}</p>
                            <Badge :variant="layer.tone" class="mt-3">{{ layer.state }}</Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card class="rounded-lg border-sidebar-border/70">
                    <CardHeader class="pb-3">
                        <CardTitle>Operational Smoke Test</CardTitle>
                        <CardDescription>After master data, prove live stock control with the correct hospital sequence.</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-3">
                        <Link
                            v-for="item in operationalChecklist"
                            :key="item.title"
                            :href="item.href"
                            class="flex min-w-0 items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/30"
                        >
                            <div class="mt-0.5 rounded-lg bg-muted p-1.5 text-muted-foreground">
                                <AppIcon :name="item.icon" class="size-3.5" />
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <p class="text-sm font-semibold">{{ item.title }}</p>
                                    <Badge :variant="item.ready ? 'secondary' : 'outline'">
                                        {{ item.ready ? 'Ready' : 'Pending' }}
                                    </Badge>
                                </div>
                                <p class="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">{{ item.description }}</p>
                            </div>
                        </Link>
                    </CardContent>
                </Card>
            </div>

            <Card class="rounded-lg border-sidebar-border/70">
                <CardHeader class="pb-3">
                    <CardTitle>First-Run Operating Rule</CardTitle>
                    <CardDescription>Use this as the clean-database sequence when testing a new Tanzanian facility.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <Link
                            v-for="(step, index) in visibleSteps"
                            :key="step.key"
                            :href="step.href"
                            class="group flex min-w-0 items-center gap-3 rounded-lg border bg-background/70 px-3 py-2.5 transition-colors hover:bg-muted/30"
                        >
                            <div
                                class="flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold"
                                :class="step.ready ? 'border-primary/20 bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
                            >
                                {{ index + 1 }}
                            </div>
                            <div class="min-w-0 flex-1">
                                <p class="truncate text-sm font-semibold">{{ step.label }}</p>
                                <p class="truncate text-xs text-muted-foreground">
                                    {{ step.ready ? 'Created and available' : 'Create before downstream testing' }}
                                </p>
                            </div>
                            <AppIcon name="arrow-right" class="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    </AppLayout>
</template>
