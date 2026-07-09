<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import VisitJourneyBoard from '@/components/patient-flow/VisitJourneyBoard.vue';
import { useVisitJourneyBoard, type VisitJourneyStep } from '@/composables/patient-flow/useVisitJourneyBoard';
import { useOrderCompletionBadge } from '@/composables/patient-flow/useOrderCompletionBadge';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { type BreadcrumbItem } from '@/types';

/**
 * Phase 4 (Mode B) of reports/queue-based-workflow-modernization-plan.md.
 *
 * Scope was narrowed after an explicit duplication audit: this board only
 * shows with_clinician/waiting_lab/in_lab/waiting_pharmacy plus (Phase 1b)
 * waiting_direct_service/in_direct_service for walk-ins that bypass the
 * clinician entirely (patients/Index.vue's "Direct services" handoff mode)
 * — the segments reports/queue-based-workflow-audit.md found had zero
 * cross-module visibility. waiting_triage/in_triage/waiting_clinician/
 * waiting_clinician_review are deliberately excluded from the board
 * component and instead surfaced as a single count linking to
 * /reception/queue, which already owns that segment.
 *
 * Follows the established V2 surface conventions, checked directly against
 * patients/chart/ShowV2.vue and encounters/WorkspaceV2.vue rather than
 * assumed: <Head> title, an in-page usePlatformAccess() gate (defense in
 * depth alongside server-side route middleware), a sticky header (title +
 * informational KPI mini-stats) pinned inside a bounded, independently-
 * scrolling container — not the page-level scroll a plain list page like
 * medical-records/IndexV2.vue uses — since this is a board a user is
 * expected to scroll within while keeping counts and the reception-queue
 * link in view, the same reasoning ShowV2.vue/WorkspaceV2.vue apply to their
 * own tall, tabbed content.
 *
 * The notification section renders whatever GET /patient-flow/notifications
 * returns — empty when Mode B is disabled
 * (config/patient_flow_automation.php, default off). This page has no
 * opinion on that flag; it lives entirely in application code.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canReadAppointments = computed(() => hasAccess('appointments.read'));

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Patient flow board', href: '/patient-flow/board' },
]);

const board = useVisitJourneyBoard();
const notifications = useOrderCompletionBadge();

const EARLIER_STAGE_STEPS: VisitJourneyStep[] = [
    'waiting_triage',
    'in_triage',
    'waiting_clinician',
    'waiting_clinician_review',
];
const BOARD_STEPS: VisitJourneyStep[] = [
    'with_clinician',
    'waiting_lab',
    'in_lab',
    'waiting_pharmacy',
    'waiting_direct_service',
    'in_direct_service',
];

const entries = computed(() => board.data.value ?? []);
const earlierStageCount = computed(
    () => entries.value.filter((entry) => EARLIER_STAGE_STEPS.includes(entry.step)).length,
);

const KPI_LABELS: Record<VisitJourneyStep, string> = {
    waiting_triage: 'Waiting for triage',
    in_triage: 'In triage',
    waiting_clinician: 'Waiting for clinician',
    waiting_clinician_review: 'Waiting for clinician review',
    with_clinician: 'With clinician',
    waiting_lab: 'Waiting for lab',
    in_lab: 'In lab',
    waiting_pharmacy: 'Waiting for pharmacy',
    waiting_direct_service: 'Waiting (direct service)',
    in_direct_service: 'In progress (direct service)',
};

const kpis = computed(() =>
    BOARD_STEPS.map((step) => ({
        step,
        label: KPI_LABELS[step],
        count: entries.value.filter((entry) => entry.step === step).length,
    })),
);

function formatCompletedAt(value: string | null): string {
    if (!value) return '';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Same bounded-scroll-container pattern as ShowV2.vue/WorkspaceV2.vue: the
// container's height is the viewport minus whatever AppLayout chrome sits
// above it, recomputed on resize, so the sticky header pins inside this
// element rather than the browser window.
const scrollContainerRef = useTemplateRef<HTMLDivElement>('scrollContainer');
const scrollContainerHeight = ref('98dvh');

function updateScrollContainerHeight(): void {
    const el = scrollContainerRef.value;
    if (!el) return;
    scrollContainerHeight.value = `calc(98dvh - ${el.getBoundingClientRect().top}px)`;
}

onMounted(() => {
    updateScrollContainerHeight();
    window.addEventListener('resize', updateScrollContainerHeight);
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', updateScrollContainerHeight);
});
</script>

<template>
    <Head title="Patient Flow Board" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">Patient Flow Board</h1>
                        <p class="text-xs text-muted-foreground">
                            Where each active visit stands from consultation onward, plus walk-ins going straight to a service.
                        </p>
                    </div>
                    <Link
                        href="/reception/queue"
                        class="inline-flex h-8 shrink-0 items-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        {{ earlierStageCount }} waiting for triage/clinician — open reception queue
                    </Link>
                </div>

                <div v-if="canReadAppointments" class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <div v-for="kpi in kpis" :key="kpi.step" class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{{ kpi.label }}</p>
                        <p class="text-sm font-bold tabular-nums">{{ kpi.count }}</p>
                    </div>
                </div>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canReadAppointments" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing the patient flow board requires <code>appointments.read</code>.</AlertDescription>
                </Alert>

                <template v-else>
                    <div
                        v-if="notifications.data.value && notifications.data.value.length > 0"
                        class="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-6"
                    >
                        <p class="text-sm font-medium text-foreground">
                            {{ notifications.data.value.length }} of your orders completed and ready for review
                        </p>
                        <ul class="mt-2 space-y-1">
                            <li
                                v-for="notification in notifications.data.value"
                                :key="`${notification.orderType}-${notification.orderId}`"
                                class="flex items-center justify-between text-xs text-muted-foreground"
                            >
                                <span>{{ notification.patientName ?? 'Unknown patient' }} — {{ notification.label ?? notification.orderType }}</span>
                                <span>{{ formatCompletedAt(notification.completedAt) }}</span>
                            </li>
                        </ul>
                    </div>

                    <div v-if="board.isPending.value" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        <Skeleton class="h-40 w-full" />
                        <Skeleton class="h-40 w-full" />
                        <Skeleton class="h-40 w-full" />
                        <Skeleton class="h-40 w-full" />
                        <Skeleton class="h-40 w-full" />
                        <Skeleton class="h-40 w-full" />
                    </div>

                    <Alert v-else-if="board.isError.value" variant="destructive">
                        <AlertTitle>Unable to load the patient flow board</AlertTitle>
                        <AlertDescription>
                            {{ board.error.value?.message ?? 'Unknown error.' }}
                        </AlertDescription>
                    </Alert>

                    <VisitJourneyBoard v-else :entries="entries" />
                </template>
            </div>
        </div>
    </AppLayout>
</template>
