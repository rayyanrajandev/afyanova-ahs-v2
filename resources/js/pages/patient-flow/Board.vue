<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, ref, watch } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import AppIcon from '@/components/AppIcon.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { isUrgentPriority } from '@/lib/patientFlowPriority';
import VisitJourneyBoard from '@/components/patient-flow/VisitJourneyBoard.vue';
import { useElapsedTime } from '@/composables/useElapsedTime';
import { useVisitJourneyBoard, type VisitJourneyStep } from '@/composables/patient-flow/useVisitJourneyBoard';
import { useVisitJourneyFilters } from '@/composables/patient-flow/useVisitJourneyFilters';
import { usePatientFlowBoardLiveUpdates } from '@/composables/patient-flow/usePatientFlowBoardLiveUpdates';
import { usePatientFlowClinicianDirectory } from '@/composables/patient-flow/usePatientFlowClinicianDirectory';
import { useOrderCompletionBadge } from '@/composables/patient-flow/useOrderCompletionBadge';
import { useOverdueVisits } from '@/composables/patient-flow/useOverdueVisits';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
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

const filters = useVisitJourneyFilters();
const board = useVisitJourneyBoard(filters);
const notifications = useOrderCompletionBadge();
const { isLive } = usePatientFlowBoardLiveUpdates();
const { nameById: clinicianNameById } = usePatientFlowClinicianDirectory();

const clinicianUserIdText = computed<string>({
    get: () => (filters.clinicianUserId === null ? '' : String(filters.clinicianUserId)),
    set: (value) => {
        filters.clinicianUserId = value ? Number(value) : null;
    },
});
const departmentValue = computed<string>({
    get: () => filters.department ?? '',
    set: (value) => {
        filters.department = value || null;
    },
});

const clinicianOptions = computed<SearchableSelectOption[]>(() =>
    Object.entries(clinicianNameById.value).map(([userId, name]) => ({ value: userId, label: name })),
);

/**
 * Accumulated across every board fetch (not just the current, possibly
 * department-filtered one) — deriving options from only the currently
 * filtered entries would shrink the list to one department the moment a
 * filter is applied, making it impossible to switch back. No new lookup:
 * still sourced entirely from the board's own already-fetched entries.
 */
const seenDepartments = ref(new Set<string>());
watch(
    () => board.data.value,
    (data) => {
        for (const entry of data ?? []) {
            if (entry.department) seenDepartments.value.add(entry.department);
        }
    },
    { immediate: true },
);
const departmentOptions = computed<SearchableSelectOption[]>(() =>
    [...seenDepartments.value].sort().map((department) => ({ value: department, label: department })),
);

const EARLIER_STAGE_STEPS: VisitJourneyStep[] = [
    'waiting_triage',
    'in_triage',
    'waiting_clinician',
    'waiting_clinician_review',
];
const BOARD_STEPS: VisitJourneyStep[] = [
    'with_clinician',
    'waiting_lab',
    'waiting_imaging',
    'waiting_lab_and_imaging',
    'in_lab',
    'in_imaging',
    'in_lab_and_imaging',
    'waiting_pharmacy',
    'waiting_direct_service',
    'in_direct_service',
];

/**
 * Client-side quick filter, not sent to the server — unlike
 * department/clinicianUserId/q, "urgent" isn't a concept the backend knows
 * about; it's a derived UI notion (P1/P2 priority or an active allergy).
 * Narrows the same `entries` everything else on this page reads from (KPI
 * counts, the overdue banner, the board itself), so switching it on doesn't
 * leave the KPI row and the cards showing inconsistent counts.
 */
const urgentOnly = ref(false);
const entries = computed(() => {
    const all = board.data.value ?? [];
    if (!urgentOnly.value) return all;
    return all.filter((entry) => isUrgentPriority(entry.priority) || entry.allergies.length > 0);
});
const earlierStageCount = computed(
    () => entries.value.filter((entry) => EARLIER_STAGE_STEPS.includes(entry.step)).length,
);

const { overdueEntries } = useOverdueVisits(entries);

/**
 * Makes the Live/Polling badge's freshness legible instead of implicit —
 * reuses useElapsedTime's own minute math/formatting rather than a second
 * "time ago" implementation.
 */
const lastUpdatedAt = computed(() => (board.dataUpdatedAt.value ? new Date(board.dataUpdatedAt.value).toISOString() : null));
const lastUpdatedElapsed = useElapsedTime(lastUpdatedAt);
const lastUpdatedLabel = computed(() => {
    if (lastUpdatedElapsed.value.minutes === null) return null;
    return lastUpdatedElapsed.value.minutes < 1 ? 'Updated just now' : `Updated ${lastUpdatedElapsed.value.label} ago`;
});

/**
 * Screen-reader-only announcement — a live push (Phase 2) can silently
 * rearrange the board with no visual cue for a non-sighted user (sighted
 * users get VisitJourneyBoard.vue's own highlight-pulse instead). Skips the
 * very first load so it doesn't announce on every page visit, only on
 * actual subsequent refreshes.
 */
const boardAnnouncement = ref('');
let isFirstBoardLoad = true;
watch(
    () => board.dataUpdatedAt.value,
    () => {
        if (isFirstBoardLoad) {
            isFirstBoardLoad = false;
            return;
        }
        boardAnnouncement.value = `Patient flow board updated. ${entries.value.length} active visits.`;
    },
);

const KPI_LABELS: Record<VisitJourneyStep, string> = {
    waiting_triage: 'Waiting for triage',
    in_triage: 'In triage',
    waiting_clinician: 'Waiting for clinician',
    waiting_clinician_review: 'Waiting for clinician review',
    with_clinician: 'With clinician',
    waiting_lab: 'Waiting for lab',
    waiting_imaging: 'Waiting for imaging',
    waiting_lab_and_imaging: 'Waiting for lab and imaging',
    in_lab: 'In lab',
    in_imaging: 'In imaging',
    in_lab_and_imaging: 'In lab and imaging',
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

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Patient Flow Board" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="sr-only" role="status" aria-live="polite">{{ boardAnnouncement }}</div>
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <div class="flex items-center gap-2">
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Patient Flow Board</h1>
                            <span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <span class="size-1.5 rounded-full" :class="isLive ? 'bg-emerald-500' : 'bg-muted-foreground/40'" aria-hidden="true" />
                                {{ isLive ? 'Live' : 'Polling' }}
                            </span>
                        </div>
                        <p class="text-xs text-muted-foreground">
                            Where each active visit stands from consultation onward, plus walk-ins going straight to a service.
                            <span v-if="lastUpdatedLabel">· {{ lastUpdatedLabel }}</span>
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
                    <div v-for="kpi in kpis" :key="kpi.step" class="rounded-md border bg-muted/50 px-2.5 py-1.5">
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
                    <div class="flex flex-wrap items-start gap-2">
                        <div class="relative min-w-72 flex-1">
                            <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input v-model="filters.q" placeholder="Search patient name or number…" class="h-9 pl-9" />
                        </div>
                        <div class="w-56">
                            <SearchableSelectField
                                v-model="departmentValue"
                                input-id="patient-flow-board-filter-department"
                                label=""
                                :options="departmentOptions"
                                placeholder="All departments"
                                empty-text="No departments seen yet."
                            />
                        </div>
                        <div class="w-56">
                            <SearchableSelectField
                                v-model="clinicianUserIdText"
                                input-id="patient-flow-board-filter-clinician"
                                label=""
                                :options="clinicianOptions"
                                placeholder="All clinicians"
                                empty-text="No matching clinician found."
                            />
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            :variant="urgentOnly ? 'default' : 'outline'"
                            class="h-9"
                            @click="urgentOnly = !urgentOnly"
                        >
                            Urgent only
                        </Button>
                    </div>

                    <div
                        v-if="overdueEntries.length > 0"
                        class="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-3"
                    >
                        <p class="text-sm font-medium text-rose-700 dark:text-rose-300">
                            ⚠ {{ overdueEntries.length }} patient{{ overdueEntries.length === 1 ? '' : 's' }} waiting more than 90 minutes
                        </p>
                        <p class="mt-2 flex flex-wrap gap-x-1 gap-y-1 text-xs text-muted-foreground">
                            <span
                                v-for="(entry, index) in overdueEntries"
                                :key="entry.appointmentId ?? entry.serviceRequestId ?? undefined"
                            >
                                {{ entry.patientName ?? 'Unknown patient' }} — {{ entry.department ?? 'No department set' }}<span v-if="index < overdueEntries.length - 1">,</span>
                            </span>
                        </p>
                    </div>

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
