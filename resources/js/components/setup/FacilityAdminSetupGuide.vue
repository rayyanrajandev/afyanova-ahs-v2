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
    <!-- Hidden state — compact dismissible banner -->
    <Card class="rounded-lg border-sidebar-border/70 shadow-sm" :class="launchGuideHidden ? 'bg-muted/20' : 'overflow-hidden'">
        <CardContent v-if="launchGuideHidden" class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex min-w-0 items-center gap-3">
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
                    <AppIcon name="clipboard-list" class="size-4" />
                </div>
                <div class="min-w-0">
                    <p class="text-sm font-semibold">Launch checklist hidden</p>
                    <p class="truncate text-xs text-muted-foreground">
                        {{ nextPendingTask ? `Next: ${nextPendingTask.title}` : 'All measurable steps complete' }}
                    </p>
                </div>
            </div>
            <Button type="button" size="sm" variant="outline" class="h-8 shrink-0 gap-1.5" @click="launchGuideHidden = false">
                <AppIcon name="eye" class="size-3.5" />
                Show
            </Button>
        </CardContent>

        <!-- Full checklist -->
        <CardContent v-else class="p-0">

            <!-- ── Header row ───────────────────────────────────── -->
            <div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                <div class="flex min-w-0 items-center gap-3">
                    <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <AppIcon name="clipboard-list" class="size-4" />
                    </div>
                    <div class="min-w-0">
                        <h2 class="text-base font-semibold leading-none">Launch checklist</h2>
                        <p class="mt-1 text-xs text-muted-foreground">First login → first patient, in order</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <!-- Inline progress bar (hidden on very small screens) -->
                    <div class="hidden w-36 sm:block">
                        <div class="flex items-center justify-between text-xs">
                            <span class="text-muted-foreground">Progress</span>
                            <span class="font-semibold">{{ progressPercent }}%</span>
                        </div>
                        <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                                class="h-full rounded-full bg-primary transition-all duration-500"
                                :style="{ width: `${progressPercent}%` }"
                            />
                        </div>
                    </div>
                    <Badge :variant="nextPendingTask ? 'outline' : 'secondary'">
                        {{ readyTaskCount }}/{{ measurableTasks.length }} done
                    </Badge>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        class="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                        @click="launchGuideHidden = true"
                    >
                        <AppIcon name="eye-off" class="size-3.5" />
                        Hide
                    </Button>
                </div>
            </div>

            <!-- ── Critical path banner ─────────────────────────── -->
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-primary/5 px-5 py-3">
                <p class="shrink-0 text-xs font-semibold text-primary">Minimum to register first patient:</p>
                <div class="flex flex-wrap items-center gap-2">
                    <Link
                        href="/platform/admin/departments"
                        class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted/50"
                    >
                        <AppIcon name="building-2" class="size-3 text-muted-foreground" />
                        1. Department
                    </Link>
                    <AppIcon name="chevron-right" class="size-3 text-muted-foreground/60" />
                    <Link
                        href="/platform/admin/service-points"
                        class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted/50"
                    >
                        <AppIcon name="map-pin" class="size-3 text-muted-foreground" />
                        2. Service point
                    </Link>
                    <AppIcon name="chevron-right" class="size-3 text-muted-foreground/60" />
                    <Link
                        href="/patients"
                        class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted/50"
                    >
                        <AppIcon name="users" class="size-3 text-muted-foreground" />
                        3. Register patient
                    </Link>
                </div>
            </div>

            <!-- ── Main layout: phase list + action panel ───────── -->
            <div class="grid xl:grid-cols-[1fr_17rem]">

                <!-- Phase timeline -->
                <div class="divide-y">
                    <div v-for="(phase, phaseIndex) in phases" :key="phase.title" class="px-5 py-4">

                        <!-- Phase header -->
                        <div class="mb-2 flex items-center gap-2.5">
                            <span
                                class="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold tabular-nums text-muted-foreground"
                            >{{ phaseIndex + 1 }}</span>
                            <h3 class="text-sm font-semibold">{{ phase.title }}</h3>
                            <Badge variant="secondary" class="ml-auto h-5 px-2 text-[10px]">{{ phase.badge }}</Badge>
                        </div>

                        <!-- Task rows — flat, no nested cards -->
                        <div class="ml-7 space-y-0.5">
                            <component
                                :is="taskLinkEnabled(task) ? Link : 'div'"
                                v-for="task in phase.tasks"
                                :key="task.title"
                                :href="taskLinkEnabled(task) ? task.href : undefined"
                                class="group flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                                :class="taskLinkEnabled(task) ? 'hover:bg-muted/40 cursor-pointer' : 'cursor-default opacity-50'"
                            >
                                <!-- Status icon -->
                                <div
                                    class="flex size-7 shrink-0 items-center justify-center rounded-md border"
                                    :class="taskReady(task) ? 'border-primary/25 bg-primary/10 text-primary' : 'bg-muted/40 text-muted-foreground'"
                                >
                                    <AppIcon :name="task.icon" class="size-3.5" />
                                </div>

                                <!-- Label + outcome -->
                                <div class="min-w-0 flex-1">
                                    <p class="truncate text-sm font-medium leading-none">{{ task.title }}</p>
                                    <p class="mt-0.5 truncate text-[11px] text-muted-foreground">{{ task.outcome }}</p>
                                </div>

                                <!-- Meta + badge + chevron -->
                                <div class="flex shrink-0 items-center gap-2">
                                    <span
                                        v-if="taskTotal(task) !== null"
                                        class="text-[11px] tabular-nums text-muted-foreground"
                                    >{{ taskTotal(task) }}</span>
                                    <Badge :variant="taskVariant(task)" class="h-5 px-2 text-[10px]">
                                        {{ taskStateLabel(task) }}
                                    </Badge>
                                    <AppIcon
                                        v-if="taskLinkEnabled(task)"
                                        name="chevron-right"
                                        class="size-3.5 text-muted-foreground/40 transition-colors group-hover:text-primary"
                                    />
                                </div>
                            </component>
                        </div>
                    </div>
                </div>

                <!-- ── Right: sticky "You are here" panel ──────── -->
                <div class="border-t bg-muted/20 p-4 xl:border-l xl:border-t-0">
                    <div class="sticky top-4 flex flex-col gap-4 rounded-lg border bg-background p-4">

                        <!-- Next action -->
                        <div class="flex items-start gap-3">
                            <div class="rounded-lg bg-primary/10 p-2 text-primary">
                                <AppIcon :name="nextPendingTask?.icon ?? 'shield-check'" class="size-4" />
                            </div>
                            <div class="min-w-0">
                                <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Next action</p>
                                <p class="mt-0.5 text-sm font-semibold leading-snug">
                                    {{ nextPendingTask?.title ?? 'Setup complete' }}
                                </p>
                            </div>
                        </div>

                        <p class="text-xs leading-5 text-muted-foreground">
                            <template v-if="nextPendingTask">
                                Complete this step before moving on. It prevents broken downstream workflows.
                            </template>
                            <template v-else>
                                All measurable setup steps are done. You can now test patient registration, orders, billing, and live operations.
                            </template>
                        </p>

                        <!-- Progress -->
                        <div>
                            <div class="mb-1.5 flex items-center justify-between text-xs">
                                <span class="text-muted-foreground">Overall progress</span>
                                <span class="font-semibold">{{ progressPercent }}%</span>
                            </div>
                            <div class="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                    class="h-full rounded-full bg-primary transition-all duration-500"
                                    :style="{ width: `${progressPercent}%` }"
                                />
                            </div>
                            <p class="mt-1.5 text-[11px] text-muted-foreground">
                                {{ readyTaskCount }} of {{ measurableTasks.length }} steps complete
                            </p>
                        </div>

                        <!-- CTA -->
                        <Button
                            v-if="nextPendingTask && taskAccessible(nextPendingTask)"
                            as-child
                            size="sm"
                            class="w-full gap-1.5"
                        >
                            <Link :href="nextPendingTask.href">
                                <AppIcon :name="nextPendingTask.icon" class="size-3.5" />
                                Open next step
                            </Link>
                        </Button>
                        <Badge v-else variant="secondary" class="w-fit">Ready for testing</Badge>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
</template>
