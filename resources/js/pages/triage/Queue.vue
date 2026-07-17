<script setup lang="ts">
import { Head, usePage } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppointmentClosureDialog, { type AppointmentClosureTarget } from '@/components/appointments/AppointmentClosureDialog.vue';
import PatientSummaryPopover from '@/components/patients/summary/PatientSummaryPopover.vue';
import ReceptionQueueList from '@/components/reception/ReceptionQueueList.vue';
import TriageRecordSheet from '@/components/triage/TriageRecordSheet.vue';
import {
    useReceptionQueue,
    useReceptionQueueFilters,
    type ReceptionQueueEntry,
} from '@/composables/reception/useReceptionQueue';
import { useClaimTriage } from '@/composables/triage/useClaimTriage';
import { useClinicianDirectory } from '@/composables/triage/useClinicianDirectory';
import { useReleaseTriageClaim } from '@/composables/triage/useReleaseTriageClaim';
import { useTriageCompletedToday } from '@/composables/triage/useTriageCompletedToday';
import { useTriageQueueStatusCounts } from '@/composables/triage/useTriageQueueStatusCounts';
import { useReceptionQueueLiveUpdates } from '@/composables/reception/useReceptionQueueLiveUpdates';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

/**
 * Phase 3 (corrected) of reports/appointments-scheduling-workspace-
 * modernization-plan.md — a dedicated, nurse-scoped Triage Queue, separate
 * from reception/Queue.vue on purpose: triage recording is clinical work,
 * not front-desk work, and putting it behind a page named "Reception" was
 * the wrong call (see the plan's Phase 3 correction note). This page reuses
 * the exact same read model reception/Queue.vue does
 * (GetReceptionQueueUseCase via useReceptionQueue) — the queue itself is
 * shared, correctly, since it's one underlying fact ("who's waiting for
 * triage right now"); only the page that ACTS on it is split out.
 *
 * Only shows the waiting_triage segment, not waiting_provider — that
 * belongs to a future Clinician Queue page (Phase 4), not this one.
 *
 * usePlatformAccess()-based computed() permission checks, no redundant
 * GET /auth/me/permissions call, <Head>/access-gate/sticky-header-in-
 * bounded-scroll-container conventions matching every other V2 page.
 *
 * Sticky header follows appointments/IndexV2.vue's/reception/Queue.vue's
 * exact shape: title+subtitle on the left in a `min-w-0 space-y-0.5` block,
 * a count Badge on the right (total currently in the live queue — waiting +
 * in progress combined), and a non-interactive KPI mini-stat-card row below
 * (`mt-3 grid ... gap-2`, `rounded-md bg-muted/30` cards) — brought in line
 * after initially shipping with just a bare title/subtitle, no KPI row.
 *
 * Four KPI cards, backed by useTriageQueueStatusCounts.ts /
 * GetTriageQueueStatusCountsUseCase — see that use case's docblock for the
 * full reasoning: Waiting/In progress are a live split of the current
 * waiting_triage population by triage-claim ownership (not date-scoped);
 * Completed/Cancelled are today's totals, not "of the current queue" (an
 * appointment leaves waiting_triage the instant either happens, so there's
 * nothing to count "of the queue" for those two). No "No show" card — it's
 * structurally unreachable from waiting_triage
 * (AppointmentStatus::allowedForwardTransitions() only allows no_show from
 * scheduled), so it would always read 0, not a real signal.
 *
 * Tabs (All/Waiting/In progress) filter the already-loaded queue
 * client-side by triageOwnerUserId — the point of exposing that field on
 * ReceptionQueueEntry at all. Claim/Release wire up
 * ClaimAppointmentTriageUseCase/ReleaseAppointmentTriageClaimUseCase, which
 * existed in the backend (Phase 2 of
 * reports/queue-based-workflow-modernization-plan.md) with zero frontend
 * consumer until now — without them, "In progress" could never actually
 * populate. Cancel reuses AppointmentClosureDialog.vue as-is
 * (WAITING_TRIAGE -> CANCELLED is a real, allowed transition) — this is the
 * answer to "what happens when a checked-in patient never reaches triage":
 * there is no automatic timeout anywhere in this codebase, so a manual
 * cancel here is the only way such a visit ever leaves the queue.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canRead = computed(() => hasAccess('appointments.read'));

/**
 * `appointments.record-triage` is a backend-only Gate::define() closure
 * (app/Providers/AppServiceProvider.php:80-91, resolving to
 * emergency.triage.create/.update/.update-status), not a directly-grantable
 * permission — but it IS deliberately mirrored into the frontend's
 * permission list by EffectivePermissionNameResolver
 * (app/Support/Auth/EffectivePermissionNameResolver.php), which calls
 * Gate::forUser($user)->allows() for exactly this ability (and two others)
 * and injects the result. So checking it directly here is correct — this
 * was reverted to the wrong thing once already; verified against the
 * resolver's source before settling here a second time.
 */
const canRecordTriage = computed(() => hasAccess('appointments.record-triage'));

/**
 * Cancel reuses appointments/IndexV2.vue's own gate — `appointments.update-status`
 * — not `appointments.record-triage`, matching UpdateAppointmentStatusRequest's
 * real authorization (`can('appointment.check-in')`). A nurse without
 * this permission simply won't see the button; that's the role boundary
 * already enforced server-side, not a new restriction invented here.
 */
const canCancelVisit = computed(() => hasAccess('appointment.check-in'));

const page = usePage<{
    auth?: {
        user?: {
            id?: number | string | null;
        } | null;
    } | null;
}>();
const currentUserId = computed<number | null>(() => {
    const normalized = Number(page.props.auth?.user?.id ?? 0);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
});

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Triage queue', href: '/triage/queue' },
]);

// P2+P5 gave GetReceptionQueueUseCase real pagination for Reception's own
// page, but this page still needs its full live population in one response
// for the client-side waiting/in_progress split below — a high perPage
// preserves that, deliberately not adopting real pagination here (out of
// scope for this phase, see the audit plan's P2+P5 section).
const filters = useReceptionQueueFilters();
filters.stage = 'waiting_triage';
filters.perPage = 200;
const queue = useReceptionQueue(filters);
const statusCounts = useTriageQueueStatusCounts();
const { isLive } = useReceptionQueueLiveUpdates([['triage-queue-status-counts']]);
const clinicianDirectory = useClinicianDirectory();

function clinicianDisplayName(userId: number | null): string | null {
    if (!userId) return null;
    const clinician = clinicianDirectory.data.value?.find((row) => row.userId === userId);
    return clinician?.userName || `Clinician #${userId}`;
}

/**
 * Client-side filter over the already-loaded queue, not a new query param —
 * the backend has no `claimed` filter on GET /reception/queue and doesn't
 * need one for a list this size (a single facility's live waiting_triage
 * population, already fetched in full for the KPI Waiting+In progress split
 * to even be computable client-side alongside it).
 */
const activeTab = ref<'all' | 'waiting' | 'in_progress' | 'completed'>('all');

const filteredEntries = computed<ReceptionQueueEntry[]>(() => {
    const entries = queue.data.value?.data ?? [];
    if (activeTab.value === 'waiting') return entries.filter((entry) => entry.triageOwnerUserId === null);
    if (activeTab.value === 'in_progress') return entries.filter((entry) => entry.triageOwnerUserId !== null);
    return entries;
});

// Lazy — only fetches while this tab is actually open (see
// useTriageCompletedToday.ts's own docblock). Deliberately a separate query,
// not a client-side filter over `queue` above: an appointment leaves
// waiting_triage the instant triage is recorded, so completed-today rows
// were never part of that live population to begin with.
const completedPage = ref(1);
const completedToday = useTriageCompletedToday(
    computed(() => activeTab.value === 'completed'),
    completedPage,
);

function completedStatusLabel(status: string | null): string {
    return formatEnumLabel(status);
}

function completedStatusVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'in_consultation':
            return 'default';
        case 'waiting_provider':
            return 'outline';
        case 'completed':
            return 'secondary';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function formatTriagedAt(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const triageSheetOpen = ref(false);
const triageTargetEntry = ref<ReceptionQueueEntry | null>(null);
const queryClient = useQueryClient();

function openTriageSheet(entry: ReceptionQueueEntry): void {
    triageTargetEntry.value = entry;
    triageSheetOpen.value = true;
}

// Auto-open triage sheet from ?triage=appointmentId query param
const triageParam = new URLSearchParams(window.location.search).get('triage');
if (triageParam) {
    const unwatch = watch(queue.data, (result) => {
        if (!result) return;
        const match = result.data.find((entry) => entry.appointmentId === triageParam);
        if (match) {
            openTriageSheet(match);
            unwatch();
            // Clean URL without reload
            const url = new URL(window.location.href);
            url.searchParams.delete('triage');
            window.history.replaceState({}, '', url.toString());
        }
    }, { immediate: true });
}

async function invalidateQueueAndCounts(): Promise<void> {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reception-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['triage-queue-status-counts'] }),
    ]);
}

async function onTriageRecorded(): Promise<void> {
    notifySuccess('Triage recorded. Patient is now ready for provider review.');
    await invalidateQueueAndCounts();
}

// --- Claim / release ------------------------------------------------------

const claimTriage = useClaimTriage();
const releaseTriageClaim = useReleaseTriageClaim();

async function claimEntry(entry: ReceptionQueueEntry): Promise<void> {
    try {
        await claimTriage.mutateAsync({ appointmentId: entry.appointmentId });
        notifySuccess('Claimed. This patient is now in progress for you.');
        await invalidateQueueAndCounts();
    } catch (error) {
        const apiError = error as { payload?: { code?: string; message?: string } };
        if (apiError.payload?.code === 'TRIAGE_CLAIM_CONFLICT') {
            notifyError(apiError.payload.message ?? 'Already claimed by another nurse.');
            await invalidateQueueAndCounts();
            return;
        }
        notifyError(messageFromUnknown(error, 'Unable to claim this patient.'));
    }
}

async function releaseEntry(entry: ReceptionQueueEntry): Promise<void> {
    try {
        await releaseTriageClaim.mutateAsync({ appointmentId: entry.appointmentId });
        notifySuccess('Released back to the queue.');
        await invalidateQueueAndCounts();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to release this claim.'));
    }
}

// --- Cancel -----------------------------------------------------------------
// Reuses AppointmentClosureDialog.vue as-is (appointments/IndexV2.vue's own
// Cancel action) — WAITING_TRIAGE -> CANCELLED is a real, allowed transition
// (AppointmentStatus::allowedForwardTransitions()), and this is the answer to
// "what happens if a checked-in patient never reaches triage": there's no
// automatic timeout anywhere in the backend, so a nurse or front-desk staff
// closing it out manually is the only way it ever leaves the queue.

const closureDialogOpen = ref(false);
const cancellingTarget = ref<AppointmentClosureTarget | null>(null);

function openCancelDialog(entry: ReceptionQueueEntry): void {
    cancellingTarget.value = { id: entry.appointmentId, appointmentNumber: entry.appointmentNumber };
    closureDialogOpen.value = true;
}

async function onVisitCancelled(): Promise<void> {
    notifySuccess('Appointment cancelled.');
    await invalidateQueueAndCounts();
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Triage Queue" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <div class="flex items-center gap-2">
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Triage Queue</h1>
                            <span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <span class="size-1.5 rounded-full" :class="isLive ? 'bg-emerald-500' : 'bg-muted-foreground/40'" aria-hidden="true" />
                                {{ isLive ? 'Live' : 'Polling' }}
                            </span>
                        </div>
                        <p class="text-xs text-muted-foreground">Checked-in patients waiting for nurse assessment.</p>
                    </div>
                    <Badge v-if="queue.data.value" variant="secondary">{{ queue.data.value.data.length }} waiting</Badge>
                </div>

                <Tabs v-if="canRead" v-model="activeTab" class="mt-3">
                    <TabsList class="grid w-full grid-cols-4">
                        <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                            All
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ queue.data.value?.data.length ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="waiting" class="inline-flex items-center gap-1.5">
                            Waiting
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.waiting ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="in_progress" class="inline-flex items-center gap-1.5">
                            In progress
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.inProgress ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="completed" class="inline-flex items-center gap-1.5">
                            Completed
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.completed ?? '—' }}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canRead" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing the triage queue requires <code>appointments.read</code>.</AlertDescription>
                </Alert>

                <template v-else>

                    <template v-if="activeTab === 'completed'">
                        <div v-if="completedToday.isPending.value" class="space-y-2">
                            <Skeleton class="h-16 w-full" />
                            <Skeleton class="h-16 w-full" />
                        </div>

                        <Alert v-else-if="completedToday.isError.value" variant="destructive">
                            <AlertTitle>Unable to load completed triage entries</AlertTitle>
                            <AlertDescription>{{ completedToday.error.value?.message ?? 'Unknown error.' }}</AlertDescription>
                        </Alert>

                        <div
                            v-else-if="!completedToday.data.value?.data.length"
                            class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
                        >
                            No one has been triaged yet today.
                        </div>

                        <template v-else>
                            <ul class="space-y-2">
                                <li
                                    v-for="entry in completedToday.data.value.data"
                                    :key="entry.appointmentId"
                                    class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-sm"
                                >
                                    <div class="min-w-0 space-y-1">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <PatientSummaryPopover v-if="entry.patientId" :patient-id="entry.patientId">
                                                <template #trigger>
                                                    <button type="button" class="font-medium text-foreground hover:underline">
                                                        {{ entry.patientName ?? 'Unknown patient' }}
                                                    </button>
                                                </template>
                                                <template #actions>
                                                    <a :href="`/patients/${entry.patientId}/chart`" class="text-xs font-medium text-primary hover:underline">
                                                        View chart
                                                    </a>
                                                </template>
                                            </PatientSummaryPopover>
                                            <p v-else class="font-medium text-foreground">{{ entry.patientName ?? 'Unknown patient' }}</p>
                                            <span v-if="entry.patientNumber" class="text-xs text-muted-foreground">{{ entry.patientNumber }}</span>
                                        </div>
                                        <p class="text-xs text-muted-foreground">{{ entry.department ?? 'No department set' }}</p>
                                    </div>
                                    <div class="flex shrink-0 flex-col items-end gap-1">
                                        <Badge :variant="completedStatusVariant(entry.status)">{{ completedStatusLabel(entry.status) }}</Badge>
                                        <p class="text-[11px] text-muted-foreground">Triaged {{ formatTriagedAt(entry.triagedAt) }}</p>
                                    </div>
                                </li>
                            </ul>

                            <div
                                v-if="completedToday.data.value.meta.lastPage > 1"
                                class="flex items-center justify-between text-sm text-muted-foreground"
                            >
                                <p>Page {{ completedToday.data.value.meta.currentPage }} of {{ completedToday.data.value.meta.lastPage }}
                                    ({{ completedToday.data.value.meta.total }} total)</p>
                                <div class="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        :disabled="completedToday.data.value.meta.currentPage <= 1"
                                        @click="completedPage -= 1"
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        :disabled="completedToday.data.value.meta.currentPage >= completedToday.data.value.meta.lastPage"
                                        @click="completedPage += 1"
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </template>
                    </template>

                    <div v-else-if="queue.isPending.value" class="space-y-2">
                        <Skeleton class="h-16 w-full" />
                        <Skeleton class="h-16 w-full" />
                    </div>

                    <Alert v-else-if="queue.isError.value" variant="destructive">
                        <AlertTitle>Unable to load the queue</AlertTitle>
                        <AlertDescription>{{ queue.error.value?.message ?? 'Unknown error.' }}</AlertDescription>
                    </Alert>

                    <ReceptionQueueList v-else :entries="filteredEntries">
                        <template #actions="{ entry }">
                            <p v-if="entry.triageOwnerUserId && entry.triageOwnerUserId !== currentUserId" class="text-[11px] text-muted-foreground">
                                Claimed by {{ clinicianDisplayName(entry.triageOwnerUserId) }}
                            </p>
                            <div class="flex items-center gap-1">
                                <Button
                                    v-if="canRecordTriage && entry.triageOwnerUserId === null"
                                    size="sm"
                                    variant="outline"
                                    class="h-7 px-2 text-xs"
                                    :disabled="claimTriage.isPending.value"
                                    @click="claimEntry(entry)"
                                >
                                    Claim
                                </Button>
                                <Button
                                    v-if="canRecordTriage && entry.triageOwnerUserId === currentUserId"
                                    size="sm"
                                    variant="ghost"
                                    class="h-7 px-2 text-xs"
                                    :disabled="releaseTriageClaim.isPending.value"
                                    @click="releaseEntry(entry)"
                                >
                                    Release
                                </Button>
                                <Button v-if="canRecordTriage" size="sm" variant="outline" class="h-7 px-2 text-xs" @click="openTriageSheet(entry)">
                                    Record triage
                                </Button>
                                <Button
                                    v-if="canCancelVisit"
                                    size="sm"
                                    variant="ghost"
                                    class="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                    @click="openCancelDialog(entry)"
                                >
                                    Cancel visit
                                </Button>
                            </div>
                        </template>
                    </ReceptionQueueList>
                </template>
            </div>
        </div>

        <TriageRecordSheet v-model:open="triageSheetOpen" :entry="triageTargetEntry" @recorded="onTriageRecorded" />

        <AppointmentClosureDialog
            v-model:open="closureDialogOpen"
            :appointment="cancellingTarget"
            status="cancelled"
            @closed="onVisitCancelled"
        />
    </AppLayout>
</template>
