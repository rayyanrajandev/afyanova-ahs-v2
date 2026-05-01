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
    icon: AppIconName;
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
        title: 'Confirm scope',
        description: 'Verify organization, facility plan, and active status before creating any operational data.',
        badge: 'Scope',
        icon: 'shield-check',
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
        description: 'Create departments, service points, and staff before records that depend on them.',
        badge: 'Structure',
        icon: 'building-2',
        tasks: [
            {
                title: 'Create departments',
                description: 'Add OPD, reception, laboratory, pharmacy, billing, and any clinical departments the facility uses.',
                href: '/platform/admin/departments',
                icon: 'building-2',
                readinessKey: 'departments',
                outcome: 'Departments exist',
            },
            {
                title: 'Create service points',
                description: 'Add reception desks, treatment rooms, and billing counters where patients are received and served.',
                href: '/platform/admin/service-points',
                icon: 'map-pin',
                readinessKey: 'service_points',
                outcome: 'Work areas exist',
            },
            {
                title: 'Create wards and beds',
                description: 'Add wards and bed numbers only when the active plan includes inpatient or ward operations.',
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
        description: 'Define what the facility provides, how it charges, and what physical stock exists.',
        badge: 'Services',
        icon: 'layers',
        tasks: [
            {
                title: 'Define clinical care catalog',
                description: 'Add lab tests, procedures, formulary items, and clinical definitions used during ordering and care delivery.',
                href: '/platform/admin/clinical-catalogs',
                icon: 'book-open',
                readinessKey: 'clinical',
                outcome: 'Care options exist',
            },
            {
                title: 'Create billable service catalog',
                description: 'Link billable items to clinical definitions and set prices, tax posture, and claims-ready codes.',
                href: '/billing-service-catalog',
                icon: 'receipt',
                readinessKey: 'pricing',
                outcome: 'Charging is ready',
            },
            {
                title: 'Create warehouses',
                description: 'Add stores before item masters, opening balances, requisitions, or procurement are tested.',
                href: '/inventory-procurement/warehouses',
                icon: 'package',
                readinessKey: 'warehouses',
                outcome: 'Stores exist',
            },
            {
                title: 'Create suppliers',
                description: 'Register active suppliers before procurement and default sourcing rely on master data.',
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
                description: 'Load day-0 counted balances as opening stock — not as a purchase, expense, or adjustment.',
                href: '/inventory-procurement?section=inventory',
                icon: 'activity',
                readinessKey: 'opening_stock',
                outcome: 'Day-0 balances exist',
            },
        ],
    },
    {
        title: 'Run first live workflow tests',
        description: 'Prove the first patient journey and the first controlled supply-chain movement.',
        badge: 'Go-live',
        icon: 'rocket',
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
                description: 'Use appointments to prove front-desk to clinical handoff and queue visibility.',
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

// ── Task helpers ──────────────────────────────────────────────────
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
    if (props.loading && task.readinessKey) return 'Checking…';
    if (taskReady(task)) return 'Done';
    if (task.readinessKey) return 'Pending';
    return 'Guide';
}

// ── Progress computeds ────────────────────────────────────────────
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

// ── Phase-level helpers ───────────────────────────────────────────
function phaseMeasurableTasks(phase: LaunchPhase): LaunchTask[] {
    return phase.tasks.filter(
        (t) => t.readinessKey && !taskPlanControlledAndInactive(t) && taskAccessible(t),
    );
}

function phaseReadyCount(phase: LaunchPhase): number {
    return phaseMeasurableTasks(phase).filter((t) => taskReady(t)).length;
}

function phaseAllDone(phase: LaunchPhase): boolean {
    const measurable = phaseMeasurableTasks(phase);
    return measurable.length > 0 && measurable.every((t) => taskReady(t));
}

const currentPhaseIndex = computed(() => {
    if (!nextPendingTask.value) return phases.length; // all done
    const idx = phases.findIndex((phase) =>
        phase.tasks.some((t) => t.readinessKey === nextPendingTask.value?.readinessKey && t.href === nextPendingTask.value?.href),
    );
    return idx === -1 ? 0 : idx;
});

function isNextTask(task: LaunchTask): boolean {
    return !!task.readinessKey && task.readinessKey === nextPendingTask.value?.readinessKey && task.href === nextPendingTask.value?.href;
}

// ── Critical path readiness ───────────────────────────────────────
const departmentsReady = computed(() => readinessByKey.value.get('departments')?.ready === true);
const servicePointsReady = computed(() => readinessByKey.value.get('service_points')?.ready === true);
const patientsReady = computed(() => readinessByKey.value.get('patients')?.ready === true);

// ── Next phase name for right panel ──────────────────────────────
const currentPhaseName = computed(() => phases[currentPhaseIndex.value]?.badge ?? '');
const nextPendingTaskDescription = computed(() => nextPendingTask.value?.description ?? '');
const nextPendingTaskOutcome = computed(() => nextPendingTask.value?.outcome ?? '');
</script>

<template>
    <!-- Collapsed state -->
    <Card class="rounded-lg border-sidebar-border/70">
        <CardContent v-if="launchGuideHidden" class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex min-w-0 items-center gap-3">
                <div class="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
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

        <CardContent v-else class="p-0">
            <!-- ── Header ─────────────────────────────────────────────────── -->
            <div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                <div class="flex items-center gap-2.5">
                    <div class="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <AppIcon name="clipboard-list" class="size-3.5" />
                    </div>
                    <h2 class="text-sm font-semibold">Launch checklist</h2>
                </div>
                <div class="flex items-center gap-2">
                    <Badge :variant="nextPendingTask ? 'outline' : 'secondary'" class="tabular-nums text-xs">
                        {{ readyTaskCount }}/{{ measurableTasks.length }} done
                    </Badge>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        class="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                        @click="launchGuideHidden = true"
                    >
                        <AppIcon name="eye-off" class="size-3.5" />
                        Hide
                    </Button>
                </div>
            </div>

            <!-- ── Phase list ─────────────────────────────────────────────── -->
            <div class="divide-y">
                <div
                    v-for="(phase, phaseIndex) in phases"
                    :key="phase.title"
                    class="relative px-5 py-4"
                >
                    <!-- Left accent bar -->
                    <div
                        class="absolute inset-y-0 left-0 w-0.5 rounded-r-full transition-colors"
                        :class="phaseAllDone(phase) ? 'bg-emerald-500' : phaseIndex === currentPhaseIndex ? 'bg-primary' : 'bg-transparent'"
                    />

                    <!-- Phase header -->
                    <div class="mb-2.5 flex items-center gap-2.5">
                        <div
                            class="flex size-6 shrink-0 items-center justify-center rounded-md transition-colors"
                            :class="phaseAllDone(phase) ? 'bg-emerald-500/15 text-emerald-600' : phaseIndex === currentPhaseIndex ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'"
                        >
                            <AppIcon :name="phase.icon" class="size-3.5" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <span class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                {{ phase.badge }}
                            </span>
                            <h3 class="text-sm font-semibold leading-tight">{{ phase.title }}</h3>
                        </div>
                        <span
                            class="shrink-0 text-xs tabular-nums"
                            :class="phaseAllDone(phase) ? 'text-emerald-600 font-medium' : 'text-muted-foreground'"
                        >
                            {{ phaseReadyCount(phase) }}/{{ phaseMeasurableTasks(phase).length }}
                        </span>
                    </div>

                    <!-- Task rows -->
                    <div class="ml-9 space-y-px">
                        <component
                            :is="taskLinkEnabled(task) ? Link : 'div'"
                            v-for="task in phase.tasks"
                            :key="task.title"
                            :href="taskLinkEnabled(task) ? task.href : undefined"
                            class="group flex min-w-0 items-start gap-3 rounded-lg px-3 py-2.5 transition-colors"
                            :class="[
                                taskLinkEnabled(task) ? 'hover:bg-muted/60' : 'cursor-default opacity-40',
                                isNextTask(task) ? 'bg-primary/5 ring-1 ring-inset ring-primary/15' : '',
                            ]"
                        >
                            <!-- Status indicator -->
                            <div
                                class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full transition-colors"
                                :class="
                                    taskReady(task)
                                        ? 'bg-emerald-500 text-white'
                                        : isNextTask(task)
                                          ? 'bg-primary text-primary-foreground'
                                          : taskPlanControlledAndInactive(task)
                                            ? 'border border-dashed border-muted-foreground/30 text-muted-foreground/30'
                                            : 'border border-muted-foreground/20 text-muted-foreground/40'
                                "
                            >
                                <AppIcon v-if="taskReady(task)" name="check" class="size-3" />
                                <AppIcon v-else-if="isNextTask(task)" :name="task.icon" class="size-3" />
                                <AppIcon v-else-if="taskPlanControlledAndInactive(task)" name="lock" class="size-3" />
                                <AppIcon v-else :name="task.icon" class="size-3" />
                            </div>

                            <!-- Text -->
                            <div class="min-w-0 flex-1">
                                <p class="text-sm font-medium leading-none">{{ task.title }}</p>
                                <p class="mt-1 text-xs leading-4 text-muted-foreground">{{ task.description }}</p>
                                <p v-if="taskReady(task)" class="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                                    <AppIcon name="check" class="size-3" />
                                    {{ task.outcome }}
                                </p>
                            </div>

                            <!-- Count + chevron -->
                            <div class="flex shrink-0 items-center gap-1.5 pt-0.5">
                                <span
                                    v-if="taskTotal(task) !== null"
                                    class="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground"
                                >{{ taskTotal(task) }}</span>
                                <AppIcon
                                    v-if="taskLinkEnabled(task)"
                                    name="chevron-right"
                                    class="size-3.5 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground"
                                />
                            </div>
                        </component>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
</template>
