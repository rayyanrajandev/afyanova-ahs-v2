<script setup lang="ts">
import { computed } from 'vue';
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import type { MasterDataSetupStep, MasterDataSetupStepKey } from '@/composables/useMasterDataSetupReadiness';
import type { AppIconName } from '@/lib/icons';
import { hasRouteAccess } from '@/lib/routeAccess';

type LaunchTask = {
    title: string;
    description: string;
    href: string;
    icon: AppIconName;
    readinessKey?: MasterDataSetupStepKey;
    outcome: string;
};

type LaunchPhase = {
    title: string;
    description: string;
    badge: string;
    tasks: LaunchTask[];
};

const props = defineProps<{
    steps: MasterDataSetupStep[];
    loading?: boolean;
    wardBedSetupRequired?: boolean;
}>();

const { permissionNames, hasUniversalAdminAccess } = usePlatformAccess();
const launchGuideHidden = useLocalStorageBoolean('facilityAdminLaunchGuide.hidden', false);

const phases: LaunchPhase[] = [
    {
        title: 'Confirm the assigned facility',
        description: 'Start by confirming that the admin is working inside the right organization, facility, plan, and scope.',
        badge: 'Scope',
        tasks: [
            {
                title: 'Review facility profile',
                description: 'Confirm facility name, code, type, timezone, owners, active status, and subscription before any local setup begins.',
                href: '/platform/admin/facility-config',
                icon: 'building-2',
                outcome: 'Facility identity is trusted',
            },
            {
                title: 'Open the setup center',
                description: 'Use this page as the control room. Return here after each setup step and refresh readiness.',
                href: '/setup-center',
                icon: 'layout-list',
                outcome: 'Setup path is visible',
            },
        ],
    },
    {
        title: 'Build the operating structure',
        description: 'Create the hospital map before creating records that depend on departments, locations, and accountable staff.',
        badge: 'Structure',
        tasks: [
            {
                title: 'Create departments',
                description: 'Add OPD, reception, laboratory, pharmacy, billing, store, and any clinical departments used by the facility.',
                href: '/platform/admin/departments',
                icon: 'building-2',
                readinessKey: 'departments',
                outcome: 'Departments exist',
            },
            {
                title: 'Create service points',
                description: 'Add the desks, rooms, counters, and service areas where patients are received, treated, billed, or served.',
                href: '/platform/admin/service-points',
                icon: 'map-pin',
                readinessKey: 'service_points',
                outcome: 'Work areas exist',
            },
            {
                title: 'Create wards and beds',
                description: 'Add wards and bed numbers when the active facility plan includes inpatient or ward operations. This is plan-controlled, not facility-name controlled.',
                href: '/platform/admin/ward-beds',
                icon: 'bed-double',
                readinessKey: 'ward_beds',
                outcome: 'Bed board is prepared',
            },
            {
                title: 'Create staff profiles',
                description: 'Create staff profiles, link verified users, and keep job roles separate from platform permissions.',
                href: '/staff',
                icon: 'users',
                readinessKey: 'staff',
                outcome: 'People are accountable',
            },
        ],
    },
    {
        title: 'Prepare services, pricing, and stock',
        description: 'Define what the facility provides, how it charges, and what physical stock exists before live patient work.',
        badge: 'Services',
        tasks: [
            {
                title: 'Define clinical care catalog',
                description: 'Add tests, procedures, formulary items, and clinical definitions used during ordering and care delivery.',
                href: '/platform/admin/clinical-catalogs',
                icon: 'book-open',
                readinessKey: 'clinical',
                outcome: 'Care options exist',
            },
            {
                title: 'Create billable service catalog',
                description: 'Link billable items to clinical definitions and set prices, tax posture, and claims-ready codes where needed.',
                href: '/billing-service-catalog',
                icon: 'receipt',
                readinessKey: 'pricing',
                outcome: 'Charging is ready',
            },
            {
                title: 'Create warehouses',
                description: 'Add stores before item masters, opening balances, requisitions, transfers, or procurement are tested.',
                href: '/inventory-procurement/warehouses',
                icon: 'package',
                readinessKey: 'warehouses',
                outcome: 'Stores exist',
            },
            {
                title: 'Create suppliers',
                description: 'Register active suppliers before procurement and default sourcing start relying on master data.',
                href: '/inventory-procurement/suppliers',
                icon: 'package',
                readinessKey: 'suppliers',
                outcome: 'Supplier trail exists',
            },
            {
                title: 'Create inventory items',
                description: 'Register physical stock items after warehouse, supplier, and care catalog foundations are ready.',
                href: '/inventory-procurement',
                icon: 'package',
                readinessKey: 'inventory',
                outcome: 'Item master exists',
            },
            {
                title: 'Load opening stock',
                description: 'Load day-0 counted balances as opening stock, not as a fake purchase or hidden stock adjustment.',
                href: '/inventory-procurement?section=inventory',
                icon: 'activity',
                readinessKey: 'opening_stock',
                outcome: 'Day-0 balances exist',
            },
        ],
    },
    {
        title: 'Run first live workflow tests',
        description: 'After the foundation is ready, prove the first patient journey and the first controlled supply-chain movement.',
        badge: 'Go-live',
        tasks: [
            {
                title: 'Register the first patient',
                description: 'Start patient registration only after the facility, departments, and minimum service setup are ready.',
                href: '/patients',
                icon: 'users',
                readinessKey: 'patients',
                outcome: 'Patient registration proven',
            },
            {
                title: 'Book or check in a patient',
                description: 'Use appointments to prove front desk to clinical handoff and queue visibility.',
                href: '/appointments',
                icon: 'calendar-clock',
                outcome: 'Patient flow is visible',
            },
            {
                title: 'Create the first bill',
                description: 'Create a test invoice or cash billing workflow after patient and service catalog setup are in place.',
                href: '/billing-invoices',
                icon: 'receipt',
                outcome: 'Revenue flow is tested',
            },
            {
                title: 'Create a department requisition',
                description: 'Create the first department request so stock demand is auditable from the beginning.',
                href: '/inventory-procurement?section=requisitions',
                icon: 'clipboard-list',
                readinessKey: 'department_requisitions',
                outcome: 'Internal demand is tested',
            },
            {
                title: 'Create a procurement request',
                description: 'Create procurement only after live demand or low-stock need is visible and auditable.',
                href: '/inventory-procurement?section=procurement',
                icon: 'package',
                readinessKey: 'procurement_requests',
                outcome: 'Supplier demand is tested',
            },
        ],
    },
];

const readinessByKey = computed(() => {
    const entries = props.steps.map((step) => [step.key, step] as const);

    return new Map<MasterDataSetupStepKey, MasterDataSetupStep>(entries);
});

function taskAccessible(task: LaunchTask): boolean {
    return hasRouteAccess(task.href, permissionNames.value, hasUniversalAdminAccess.value);
}

function taskPlanControlledAndInactive(task: LaunchTask): boolean {
    return task.readinessKey === 'ward_beds' && props.wardBedSetupRequired !== true;
}

function taskLinkEnabled(task: LaunchTask): boolean {
    return taskAccessible(task) && !taskPlanControlledAndInactive(task);
}

function taskReady(task: LaunchTask): boolean {
    if (taskPlanControlledAndInactive(task)) return false;
    if (!task.readinessKey) return false;

    return readinessByKey.value.get(task.readinessKey)?.ready === true;
}

function taskTotal(task: LaunchTask): number | null {
    if (taskPlanControlledAndInactive(task)) return null;
    if (!task.readinessKey) return null;

    return readinessByKey.value.get(task.readinessKey)?.total ?? null;
}

function taskStateLabel(task: LaunchTask): string {
    if (taskPlanControlledAndInactive(task)) return 'Plan controlled';
    if (!taskAccessible(task)) return 'Needs access';
    if (props.loading && task.readinessKey) return 'Checking';
    if (taskReady(task)) return 'Ready';
    if (task.readinessKey) return 'Pending';

    return 'Guide';
}

function taskVariant(task: LaunchTask): 'default' | 'secondary' | 'outline' | 'destructive' {
    if (taskPlanControlledAndInactive(task)) return 'outline';
    if (!taskAccessible(task)) return 'destructive';
    if (taskReady(task)) return 'secondary';
    if (task.readinessKey) return 'outline';

    return 'outline';
}

const measurableTasks = computed(() =>
    phases.flatMap((phase) => phase.tasks).filter((task) =>
        task.readinessKey && !taskPlanControlledAndInactive(task) && taskAccessible(task),
    ),
);

const readyTaskCount = computed(() =>
    measurableTasks.value.filter((task) => taskReady(task)).length,
);

const progressPercent = computed(() => {
    if (measurableTasks.value.length === 0) return 0;

    return Math.round((readyTaskCount.value / measurableTasks.value.length) * 100);
});

const nextPendingTask = computed(() =>
    measurableTasks.value.find((task) => !taskReady(task)) ?? null,
);
</script>

<template>
    <Card v-if="launchGuideHidden" class="rounded-lg border-sidebar-border/70 bg-muted/20 shadow-sm">
        <CardContent class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex min-w-0 items-center gap-3">
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
                    <AppIcon name="shield-check" class="size-4" />
                </div>
                <div class="min-w-0">
                    <p class="text-sm font-semibold">Facility admin launch guide hidden</p>
                    <p class="truncate text-xs text-muted-foreground">
                        {{ nextPendingTask ? `Next: ${nextPendingTask.title}` : 'Facility setup path is complete' }}
                    </p>
                </div>
            </div>
            <Button type="button" size="sm" variant="outline" class="h-8 shrink-0 gap-1.5" @click="launchGuideHidden = false">
                <AppIcon name="eye" class="size-3.5" />
                Show guide
            </Button>
        </CardContent>
    </Card>

    <Card v-else class="overflow-hidden rounded-lg border-sidebar-border/70 shadow-sm">
        <CardContent class="p-0">
            <div class="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.32fr)]">
                <div class="space-y-4 p-4 md:p-5">
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div class="space-y-2">
                            <div class="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">Facility Admin First Login</Badge>
                                <Badge variant="outline">{{ readyTaskCount }}/{{ measurableTasks.length }} measurable steps ready</Badge>
                                <Badge :variant="nextPendingTask ? 'outline' : 'secondary'">
                                    {{ nextPendingTask ? 'Setup in progress' : 'Ready for workflow testing' }}
                                </Badge>
                            </div>
                            <div class="space-y-1">
                                <h2 class="text-lg font-semibold tracking-tight">Start here before DSK goes live with patient registration.</h2>
                                <p class="max-w-3xl text-sm leading-6 text-muted-foreground">
                                    This is the facility admin path from first login to first patient test: verify scope, build the facility map, prepare services and stock, then prove patient registration and handoffs.
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            class="h-8 w-fit shrink-0 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                            @click="launchGuideHidden = true"
                        >
                            <AppIcon name="eye-off" class="size-3.5" />
                            Hide guide
                        </Button>
                    </div>

                    <div class="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Minimum path to first patient</p>
                        <div class="mt-2 flex flex-wrap items-center gap-2">
                            <Link href="/platform/admin/departments" class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted/50">
                                <AppIcon name="building-2" class="size-3 text-muted-foreground" />
                                1. Create a department
                            </Link>
                            <AppIcon name="arrow-right" class="size-3 text-muted-foreground" />
                            <Link href="/platform/admin/service-points" class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted/50">
                                <AppIcon name="map-pin" class="size-3 text-muted-foreground" />
                                2. Create a service point
                            </Link>
                            <AppIcon name="arrow-right" class="size-3 text-muted-foreground" />
                            <Link href="/patients" class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted/50">
                                <AppIcon name="users" class="size-3 text-muted-foreground" />
                                3. Register first patient
                            </Link>
                        </div>
                        <p class="mt-2 text-xs text-muted-foreground">Everything else (staff, catalogs, billing, inventory) can be set up after the first patient is registered.</p>
                    </div>

                    <div class="grid gap-3 lg:grid-cols-2">
                        <section
                            v-for="(phase, phaseIndex) in phases"
                            :key="phase.title"
                            class="rounded-lg border bg-muted/10 p-3"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline">{{ phaseIndex + 1 }}</Badge>
                                        <Badge variant="secondary">{{ phase.badge }}</Badge>
                                    </div>
                                    <h3 class="mt-2 text-sm font-semibold">{{ phase.title }}</h3>
                                    <p class="mt-1 text-xs leading-5 text-muted-foreground">{{ phase.description }}</p>
                                </div>
                            </div>

                            <div class="mt-3 grid gap-2">
                                <component
                                    :is="taskLinkEnabled(task) ? Link : 'div'"
                                    v-for="task in phase.tasks"
                                    :key="task.title"
                                    :href="taskLinkEnabled(task) ? task.href : undefined"
                                    class="group grid min-w-0 gap-2 rounded-lg border bg-background px-3 py-2.5 transition-colors"
                                    :class="taskLinkEnabled(task) ? 'hover:bg-muted/30' : 'opacity-75'"
                                >
                                    <div class="flex items-start gap-3">
                                        <div
                                            class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border"
                                            :class="taskReady(task) ? 'border-primary/20 bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
                                        >
                                            <AppIcon :name="task.icon" class="size-3.5" />
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <div class="flex flex-wrap items-center justify-between gap-2">
                                                <p class="text-sm font-semibold">{{ task.title }}</p>
                                                <Badge :variant="taskVariant(task)" class="h-5 px-2 text-[10px]">
                                                    {{ taskStateLabel(task) }}
                                                </Badge>
                                            </div>
                                            <p class="mt-1 text-xs leading-5 text-muted-foreground">{{ task.description }}</p>
                                            <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                <span>{{ task.outcome }}</span>
                                                <span v-if="taskTotal(task) !== null">| {{ taskTotal(task) }} records</span>
                                            </div>
                                        </div>
                                    </div>
                                </component>
                            </div>
                        </section>
                    </div>
                </div>

                <aside class="border-t bg-muted/20 p-4 xl:border-l xl:border-t-0 md:p-5">
                    <div class="flex h-full flex-col justify-between gap-4 rounded-lg border bg-background/80 p-4">
                        <div class="space-y-3">
                            <div class="flex items-center gap-2">
                                <div class="rounded-lg bg-primary/10 p-2 text-primary">
                                    <AppIcon :name="nextPendingTask?.icon ?? 'shield-check'" class="size-4" />
                                </div>
                                <div>
                                    <p class="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Next facility-admin action</p>
                                    <p class="text-sm font-semibold">{{ nextPendingTask?.title ?? 'Facility setup ready' }}</p>
                                </div>
                            </div>
                            <p class="text-sm leading-6 text-muted-foreground">
                                <template v-if="nextPendingTask">
                                    Complete this next so the facility grows in a controlled order instead of creating patient, billing, and stock records on weak foundations.
                                </template>
                                <template v-else>
                                    The first-login measurable setup path is complete. Keep using the audit trails and dashboard while testing live workflows.
                                </template>
                            </p>
                            <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                <div class="flex items-center justify-between gap-3">
                                    <span class="text-xs font-medium text-muted-foreground">Measured progress</span>
                                    <span class="text-sm font-semibold">{{ progressPercent }}%</span>
                                </div>
                                <div class="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                                    <div
                                        class="h-full rounded-full bg-primary transition-all duration-500"
                                        :style="{ width: `${progressPercent}%` }"
                                    />
                                </div>
                            </div>
                        </div>

                        <Button v-if="nextPendingTask && taskAccessible(nextPendingTask)" as-child size="sm" class="w-full gap-1.5">
                            <Link :href="nextPendingTask.href">
                                <AppIcon :name="nextPendingTask.icon" class="size-3.5" />
                                Open next step
                            </Link>
                        </Button>
                        <Badge v-else variant="secondary" class="w-fit">Ready for testing</Badge>
                    </div>
                </aside>
            </div>
        </CardContent>
    </Card>
</template>
