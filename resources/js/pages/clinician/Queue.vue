<script setup lang="ts">
import { Head, router, usePage } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppointmentClosureDialog, { type AppointmentClosureTarget } from '@/components/appointments/AppointmentClosureDialog.vue';
import ReferralManagementSheet from '@/components/clinician/ReferralManagementSheet.vue';
import SendToTriageDialog, { type SendToTriageTarget } from '@/components/clinician/SendToTriageDialog.vue';
import TakeoverConsultationDialog, { type TakeoverTarget } from '@/components/clinician/TakeoverConsultationDialog.vue';
import ReceptionQueueList from '@/components/reception/ReceptionQueueList.vue';
import { useClinicianQueueStatusCounts } from '@/composables/clinician/useClinicianQueueStatusCounts';
import { useProviderWorkflow } from '@/composables/clinician/useProviderWorkflow';
import { useStartConsultation } from '@/composables/clinician/useStartConsultation';
import {
    useReceptionQueue,
    useReceptionQueueFilters,
    type ReceptionQueueEntry,
} from '@/composables/reception/useReceptionQueue';
import { useReceptionQueueLiveUpdates } from '@/composables/reception/useReceptionQueueLiveUpdates';
import { useClinicianDirectory } from '@/composables/triage/useClinicianDirectory';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { encounterWorkspaceLegacyAppointmentHref } from '@/lib/encounterWorkspace';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

/**
 * Phase 4 of reports/appointments-scheduling-workspace-modernization-plan.md
 * — a dedicated, clinician-scoped queue: consultation ownership/takeover and
 * provider workflow (hold, send back to triage, complete). Same reasoning
 * as triage/Queue.vue's own split from reception/Queue.vue: this is
 * clinical work, not front-desk work, and shares the read model
 * (GetReceptionQueueUseCase) rather than duplicating it — the queue itself
 * is one underlying fact, only the page that ACTS on it is split out.
 *
 * Covers both waiting_provider (never yet seen a provider, or on hold —
 * sent back for labs/pharmacy, will return) and in_consultation. Two
 * separate useReceptionQueue() calls, not one, matching
 * reception/Queue.vue's own two-stage precedent (triageFilters/
 * providerFilters) — each stage is independently cached and refetched.
 *
 * usePlatformAccess()-based computed() permission checks, <Head>/access-
 * gate/sticky-header-in-bounded-scroll-container conventions matching every
 * other V2 page, including the KPI-card-row-plus-Tabs-filter shape
 * triage/Queue.vue established.
 *
 * Four KPI cards, backed by useClinicianQueueStatusCounts.ts /
 * GetClinicianQueueStatusCountsUseCase — see that use case's docblock for
 * the full reasoning. "On Hold" only became a real, distinguishable signal
 * after fixing a bug in AppointmentController::updateProviderWorkflow(),
 * which previously nulled consultation_started_at unconditionally on every
 * exit from in_consultation — that fix shipped alongside this page, not
 * separately. No "Called" card — no backend representation exists (no
 * column, no paging/notification mechanism) — confirmed by investigation
 * before building, not assumed.
 *
 * Row actions depend on each entry's status and consultation ownership:
 * - waiting_provider, never seen a provider: "Start consultation".
 * - waiting_provider, on hold (consultationStartedAt set): "Resume
 *   consultation" — the same start-consultation endpoint; the backend
 *   treats start/resume as one action and preserves the original
 *   consultation_started_at this time (see the fix above).
 * - in_consultation, unowned (an edge case — normally start-consultation
 *   always sets an owner): "Claim".
 * - in_consultation, owned by the current user: "Hold", "Send to triage"
 *   (SendToTriageDialog.vue, reason required), "Complete".
 * - in_consultation, owned by someone else: "Claimed by {name}" +
 *   "Take over" (TakeoverConsultationDialog.vue, reason required,
 *   resolves the 409 CONSULTATION_OWNER_CONFLICT).
 * - Cancel (AppointmentClosureDialog.vue, reused as-is from
 *   appointments/IndexV2.vue/triage/Queue.vue): both waiting_provider and
 *   in_consultation can transition to cancelled
 *   (AppointmentStatus::allowedForwardTransitions()).
 * - Referrals (ReferralManagementSheet.vue, Phase 5) — "Referrals" on
 *   in_consultation rows, gated `appointments.manage-referrals` (a pure
 *   permission check, not tied to consultation ownership — matches the
 *   legacy appointments/Index.vue's own gate exactly). Extracted from that
 *   page's referrals tab + create/status dialogs, not rewritten; see the
 *   sheet's own docblock for what was deliberately left out (referral
 *   notes sub-feature, admission-prefill, the never-wired-up referral
 *   network browse endpoint).
 *
 * "✓ Note signed" on in_consultation rows (entry.hasSignedConsultationNote,
 * GetReceptionQueueUseCase's batched call to
 * MedicalRecordRepositoryInterface::hasSignedConsultationNoteForAppointments())
 * — added after an audit found that "In Progress" reflects the appointment's
 * own coarse status honestly, but that status has no relationship to
 * whether documentation is actually done: finalizing a consultation note
 * never touches appointments.status (a clinician has to separately click
 * Complete), so a fully-signed visit can sit at in_consultation indefinitely
 * with no reminder — the same no-timeout gap already found for
 * waiting_triage/waiting_provider. This indicator doesn't fix that gap, but
 * makes it visible: a clinician considering "Take over" can now see whether
 * the previous owner already finished writing up the visit.
 *
 * The second gap that same audit found — the appointment not reflecting the
 * patient's real physical location once sent to lab/pharmacy mid-
 * consultation — is now also closed: entry.consultationStep
 * ('waiting_lab'/'waiting_imaging'/'waiting_lab_and_imaging'/'in_lab'/
 * 'in_imaging'/'in_lab_and_imaging'/'waiting_pharmacy'/'with_clinician') is
 * GetActiveVisitJourneyUseCase's own derived signal
 * (ResolveConsultationDiagnosticStepsUseCase, extracted from that use case
 * so both consumers share one batched Laboratory/Pharmacy/Radiology lookup
 * rather than a second, potentially-drifting copy), shown via
 * consultationStepLabel() as a small line on in_consultation rows —
 * 'with_clinician' (the unremarkable default) deliberately shows nothing.
 *
 * Start/Resume/Claim/Take over all now navigate straight into the Encounter
 * Workspace after their mutation succeeds — this page previously only
 * changed appointment status and left the clinician stranded on the queue
 * with no way to actually write notes, order labs/pharmacy/radiology,
 * prescribe, or record diagnoses. See openEncounterWorkspace()'s own
 * docblock for the fix and what it restores from the legacy page.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canRead = computed(() => hasAccess('appointments.read'));
const canStartConsultation = computed(() => hasAccess('appointments.start-consultation'));
const canManageProviderSession = computed(() => hasAccess('appointments.manage-provider-session'));
const canCancelVisit = computed(() => hasAccess('appointments.update-status'));
/**
 * Matches the legacy appointments/Index.vue's own gate exactly
 * (canManageReferrals, Index.vue:762) — a pure permission check, not tied
 * to consultation ownership the way Hold/Send to triage/Complete are, since
 * that's how the legacy page gated it too.
 */
const canManageReferrals = computed(() => hasAccess('appointments.manage-referrals'));

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
    { title: 'Clinician queue', href: '/clinician/queue' },
]);

// P2+P5 gave GetReceptionQueueUseCase real pagination for Reception's own
// page, but this page still needs its full live population in one response
// to compute the waiting/on_hold/in_progress client-side split above — a
// high perPage preserves that, deliberately not adopting real pagination
// here (out of scope for this phase, see the audit plan's P2+P5 section).
const waitingProviderFilters = useReceptionQueueFilters();
waitingProviderFilters.stage = 'waiting_provider';
waitingProviderFilters.perPage = 200;
const inConsultationFilters = useReceptionQueueFilters();
inConsultationFilters.stage = 'in_consultation';
inConsultationFilters.perPage = 200;

const waitingProviderQueue = useReceptionQueue(waitingProviderFilters);
const inConsultationQueue = useReceptionQueue(inConsultationFilters);
const statusCounts = useClinicianQueueStatusCounts();
const { isLive } = useReceptionQueueLiveUpdates([['clinician-queue-status-counts']]);
const clinicianDirectory = useClinicianDirectory();

function clinicianDisplayName(userId: number | null): string | null {
    if (!userId) return null;
    const clinician = clinicianDirectory.data.value?.find((row) => row.userId === userId);
    return clinician?.userName || `Clinician #${userId}`;
}

/**
 * ResolveConsultationDiagnosticStepsUseCase's values. 'with_clinician'
 * (the patient is, as far as anyone can tell, actually with the doctor
 * right now) deliberately returns null — it's the unremarkable default
 * state, not worth a label on every single row.
 */
function consultationStepLabel(step: string | null): string | null {
    switch (step) {
        case 'waiting_lab':
            return 'Waiting for lab';
        case 'waiting_imaging':
            return 'Waiting for imaging';
        case 'waiting_lab_and_imaging':
            return 'Waiting for lab and imaging';
        case 'in_lab':
            return 'Currently in lab';
        case 'in_imaging':
            return 'Currently in imaging';
        case 'in_lab_and_imaging':
            return 'Currently in lab and imaging';
        case 'waiting_pharmacy':
            return 'Waiting at pharmacy';
        default:
            return null;
    }
}

/**
 * Mirrors AppointmentController::resolvedConsultationOwnerUserId() — an
 * in_consultation visit with no explicit consultation_owner_user_id (an
 * edge case: transitioned via the generic status endpoint, bypassing
 * start-consultation) still falls back to the originally assigned
 * clinician for ownership purposes. Kept in sync with that server-side
 * resolution so the UI's Claim/Hold/Take-over branching matches what the
 * backend will actually accept.
 */
function effectiveOwnerUserId(entry: ReceptionQueueEntry): number | null {
    if (entry.consultationOwnerUserId) return entry.consultationOwnerUserId;
    return entry.status === 'in_consultation' ? entry.clinicianUserId : null;
}

const allEntries = computed<ReceptionQueueEntry[]>(() => [
    ...(waitingProviderQueue.data.value?.data ?? []),
    ...(inConsultationQueue.data.value?.data ?? []),
]);
const totalInQueue = computed(() => allEntries.value.length);

const activeTab = ref<'all' | 'waiting' | 'on_hold' | 'in_progress'>('all');

const filteredEntries = computed<ReceptionQueueEntry[]>(() => {
    if (activeTab.value === 'waiting') {
        return (waitingProviderQueue.data.value?.data ?? []).filter((entry) => !entry.consultationStartedAt);
    }
    if (activeTab.value === 'on_hold') {
        return (waitingProviderQueue.data.value?.data ?? []).filter((entry) => Boolean(entry.consultationStartedAt));
    }
    if (activeTab.value === 'in_progress') {
        return inConsultationQueue.data.value?.data ?? [];
    }
    return allEntries.value;
});

const isPending = computed(() => waitingProviderQueue.isPending.value || inConsultationQueue.isPending.value);
const isError = computed(() => waitingProviderQueue.isError.value || inConsultationQueue.isError.value);
const loadError = computed(() => waitingProviderQueue.error.value ?? inConsultationQueue.error.value);

const queryClient = useQueryClient();

async function invalidateQueueAndCounts(): Promise<void> {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reception-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['clinician-queue-status-counts'] }),
    ]);
}

// --- Start / resume / claim consultation -----------------------------------

const startConsultation = useStartConsultation();

/**
 * Bug fix: this page previously only flipped appointment status to
 * in_consultation and left the clinician on the queue with no way to
 * actually do clinical work — no notes, diagnoses, orders, prescriptions,
 * or vitals review anywhere. The legacy appointments/Index.vue's own
 * "Start consultation" (visitAppointmentEncounter(), Index.vue:4513) always
 * navigated into the Encounter Workspace immediately after starting — that
 * step was dropped when this V2 page was built (Phase 4 of
 * reports/appointments-scheduling-workspace-modernization-plan.md never
 * mentions it).
 *
 * encounterWorkspaceLegacyAppointmentHref() (despite its name — kept as-is,
 * see resources/js/lib/encounterWorkspace.ts's own note) builds a URL to
 * routes/web.php's `encounters/by-appointment/{appointmentId}` route, which
 * itself had a real, separate bug: it rendered the pre-cutover
 * encounters/Show.vue page directly instead of resolving the encounter and
 * redirecting to the already-fully-cut-over encounters/{encounterId} route
 * (encounters/WorkspaceV2.vue) — fixed at the route level, so every caller
 * of this helper (not just this page) now correctly lands on WorkspaceV2.
 * encounters/Show.vue and encounters/Workspace.vue (the pre-cutover
 * implementation) have been deleted outright.
 */
function openEncounterWorkspace(appointmentId: string): void {
    router.visit(encounterWorkspaceLegacyAppointmentHref(appointmentId, { from: 'clinician-queue' }), {
        preserveScroll: false,
    });
}

/**
 * Direct, in-context path to the patient's longitudinal chart from wherever
 * a clinician already has that patient in view — previously the only route
 * was via the Patient registry, a completely separate cross-patient starting
 * point (see reports/medical-record-encounter-note-modeling-decision.md §3).
 */
function viewPatientChart(patientId: string | null): void {
    if (!patientId) return;
    router.visit(`/patients/${patientId}/chart`);
}

async function startOrResume(entry: ReceptionQueueEntry): Promise<void> {
    try {
        await startConsultation.mutateAsync({ appointmentId: entry.appointmentId });
        notifySuccess('Consultation started. Opening chart.');
        await invalidateQueueAndCounts();
        openEncounterWorkspace(entry.appointmentId);
    } catch (error) {
        const apiError = error as { payload?: { code?: string; message?: string } };
        if (apiError.payload?.code === 'CONSULTATION_OWNER_CONFLICT') {
            notifyError(apiError.payload.message ?? 'Already claimed by another clinician.');
            await invalidateQueueAndCounts();
            return;
        }
        notifyError(messageFromUnknown(error, 'Unable to start this consultation.'));
    }
}

// --- Hold / complete ---------------------------------------------------------

const providerWorkflow = useProviderWorkflow();

async function holdEntry(entry: ReceptionQueueEntry): Promise<void> {
    try {
        await providerWorkflow.mutateAsync({ appointmentId: entry.appointmentId, status: 'waiting_provider' });
        notifySuccess('Visit put on hold — sent back to waiting for provider.');
        await invalidateQueueAndCounts();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to put this visit on hold.'));
    }
}

async function completeEntry(entry: ReceptionQueueEntry): Promise<void> {
    try {
        await providerWorkflow.mutateAsync({ appointmentId: entry.appointmentId, status: 'completed' });
        notifySuccess('Visit completed.');
        await invalidateQueueAndCounts();
    } catch (error) {
        const apiError = error as { payload?: { context?: { requiresFinalizedConsultationNote?: boolean }; message?: string } };
        if (apiError.payload?.context?.requiresFinalizedConsultationNote) {
            notifyError(apiError.payload.message ?? 'Finalize the consultation note before closing this visit.');
            return;
        }
        notifyError(messageFromUnknown(error, 'Unable to complete this visit.'));
    }
}

// --- Send to triage -----------------------------------------------------------

const sendToTriageDialogOpen = ref(false);
const sendToTriageTarget = ref<SendToTriageTarget | null>(null);

function openSendToTriage(entry: ReceptionQueueEntry): void {
    sendToTriageTarget.value = { id: entry.appointmentId, appointmentNumber: entry.appointmentNumber };
    sendToTriageDialogOpen.value = true;
}

async function onSentToTriage(): Promise<void> {
    notifySuccess('Sent back to triage.');
    await invalidateQueueAndCounts();
}

// --- Take over -----------------------------------------------------------------

const takeoverDialogOpen = ref(false);
const takeoverTarget = ref<TakeoverTarget | null>(null);

function openTakeover(entry: ReceptionQueueEntry): void {
    takeoverTarget.value = {
        id: entry.appointmentId,
        appointmentNumber: entry.appointmentNumber,
        claimedByName: clinicianDisplayName(effectiveOwnerUserId(entry)),
    };
    takeoverDialogOpen.value = true;
}

async function onTakenOver(): Promise<void> {
    notifySuccess('Consultation taken over. Opening chart.');
    const appointmentId = takeoverTarget.value?.id ?? null;
    await invalidateQueueAndCounts();
    if (appointmentId) {
        openEncounterWorkspace(appointmentId);
    }
}

// --- Referrals -----------------------------------------------------------------

const referralSheetOpen = ref(false);
const referralSheetAppointmentId = ref<string | null>(null);
const referralSheetAppointmentNumber = ref<string | null>(null);

function openReferralSheet(entry: ReceptionQueueEntry): void {
    referralSheetAppointmentId.value = entry.appointmentId;
    referralSheetAppointmentNumber.value = entry.appointmentNumber;
    referralSheetOpen.value = true;
}

// --- Cancel -----------------------------------------------------------------

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
    <Head title="Clinician Queue" />
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
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Clinician Queue</h1>
                            <span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <span class="size-1.5 rounded-full" :class="isLive ? 'bg-emerald-500' : 'bg-muted-foreground/40'" aria-hidden="true" />
                                {{ isLive ? 'Live' : 'Polling' }}
                            </span>
                        </div>
                        <p class="text-xs text-muted-foreground">Your patients waiting for review or already in consultation.</p>
                    </div>
                    <Badge variant="secondary">{{ totalInQueue }} in queue</Badge>
                </div>

                <div v-if="canRead" class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Waiting</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.waiting ?? '—' }}</p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">On hold</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.onHold ?? '—' }}</p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">In progress</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.inProgress ?? '—' }}</p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Completed today</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.completed ?? '—' }}</p>
                    </div>
                </div>

                <Tabs v-if="canRead" v-model="activeTab" class="mt-3">
                    <TabsList class="grid w-full grid-cols-4">
                        <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                            All
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ totalInQueue }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="waiting" class="inline-flex items-center gap-1.5">
                            Waiting
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.waiting ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="on_hold" class="inline-flex items-center gap-1.5">
                            On hold
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.onHold ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="in_progress" class="inline-flex items-center gap-1.5">
                            In progress
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.inProgress ?? '—' }}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canRead" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing the clinician queue requires <code>appointments.read</code>.</AlertDescription>
                </Alert>

                <template v-else>

                    <div v-if="isPending" class="space-y-2">
                        <Skeleton class="h-16 w-full" />
                        <Skeleton class="h-16 w-full" />
                    </div>

                    <Alert v-else-if="isError" variant="destructive">
                        <AlertTitle>Unable to load the queue</AlertTitle>
                        <AlertDescription>{{ loadError?.message ?? 'Unknown error.' }}</AlertDescription>
                    </Alert>

                    <ReceptionQueueList v-else :entries="filteredEntries">
                        <template #actions="{ entry }">
                            <p
                                v-if="entry.status === 'in_consultation' && effectiveOwnerUserId(entry) && effectiveOwnerUserId(entry) !== currentUserId"
                                class="text-[11px] text-muted-foreground"
                            >
                                Claimed by {{ clinicianDisplayName(effectiveOwnerUserId(entry)) }}
                            </p>
                            <Badge
                                v-else-if="entry.status === 'waiting_provider' && entry.consultationStartedAt"
                                class="bg-amber-100 text-[11px] text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                            >
                                On hold
                            </Badge>
                            <Badge
                                v-if="entry.status === 'in_consultation' && consultationStepLabel(entry.consultationStep)"
                                class="bg-sky-100 text-[11px] text-sky-800 dark:bg-sky-900 dark:text-sky-200"
                            >
                                {{ consultationStepLabel(entry.consultationStep) }}
                            </Badge>
                            <Badge
                                v-if="entry.status === 'in_consultation' && entry.hasSignedConsultationNote"
                                class="bg-emerald-100 text-[11px] text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                            >
                                ✓ Note signed
                            </Badge>
                            <div class="flex items-center gap-1">
                                <Button
                                    v-if="canStartConsultation && entry.status === 'waiting_provider' && !entry.consultationStartedAt"
                                    size="sm"
                                    variant="outline"
                                    class="h-7 px-2 text-xs"
                                    :disabled="startConsultation.isPending.value"
                                    @click="startOrResume(entry)"
                                >
                                    Start consultation
                                </Button>
                                <Button
                                    v-if="canStartConsultation && entry.status === 'waiting_provider' && entry.consultationStartedAt"
                                    size="sm"
                                    variant="outline"
                                    class="h-7 px-2 text-xs"
                                    :disabled="startConsultation.isPending.value"
                                    @click="startOrResume(entry)"
                                >
                                    Resume consultation
                                </Button>
                                <Button
                                    v-if="canStartConsultation && entry.status === 'in_consultation' && !effectiveOwnerUserId(entry)"
                                    size="sm"
                                    variant="outline"
                                    class="h-7 px-2 text-xs"
                                    :disabled="startConsultation.isPending.value"
                                    @click="startOrResume(entry)"
                                >
                                    Claim
                                </Button>
                                <template v-if="entry.status === 'in_consultation' && effectiveOwnerUserId(entry) === currentUserId">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        class="h-7 px-2 text-xs"
                                        @click="openEncounterWorkspace(entry.appointmentId)"
                                    >
                                        Open clinical workspace
                                    </Button>
                                    <Button
                                        v-if="canManageProviderSession"
                                        size="sm"
                                        variant="ghost"
                                        class="h-7 px-2 text-xs"
                                        :disabled="providerWorkflow.isPending.value"
                                        @click="holdEntry(entry)"
                                    >
                                        Hold
                                    </Button>
                                    <Button
                                        v-if="canManageProviderSession"
                                        size="sm"
                                        variant="ghost"
                                        class="h-7 px-2 text-xs"
                                        @click="openSendToTriage(entry)"
                                    >
                                        Send to triage
                                    </Button>
                                    <Button
                                        v-if="canManageProviderSession"
                                        size="sm"
                                        variant="outline"
                                        class="h-7 px-2 text-xs"
                                        :disabled="providerWorkflow.isPending.value"
                                        @click="completeEntry(entry)"
                                    >
                                        Complete visit
                                    </Button>
                                </template>
                                <Button
                                    v-if="
                                        canStartConsultation &&
                                        entry.status === 'in_consultation' &&
                                        effectiveOwnerUserId(entry) &&
                                        effectiveOwnerUserId(entry) !== currentUserId
                                    "
                                    size="sm"
                                    variant="ghost"
                                    class="h-7 px-2 text-xs"
                                    @click="openTakeover(entry)"
                                >
                                    Take over
                                </Button>
                                <Button
                                    v-if="entry.patientId"
                                    size="sm"
                                    variant="ghost"
                                    class="h-7 px-2 text-xs"
                                    @click="viewPatientChart(entry.patientId)"
                                >
                                    View chart
                                </Button>
                                <Button
                                    v-if="canManageReferrals && entry.status === 'in_consultation'"
                                    size="sm"
                                    variant="ghost"
                                    class="h-7 px-2 text-xs"
                                    @click="openReferralSheet(entry)"
                                >
                                    Referrals
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

        <SendToTriageDialog v-model:open="sendToTriageDialogOpen" :appointment="sendToTriageTarget" @sent="onSentToTriage" />

        <TakeoverConsultationDialog v-model:open="takeoverDialogOpen" :appointment="takeoverTarget" @taken-over="onTakenOver" />

        <ReferralManagementSheet
            v-model:open="referralSheetOpen"
            :appointment-id="referralSheetAppointmentId"
            :appointment-number="referralSheetAppointmentNumber"
        />

        <AppointmentClosureDialog
            v-model:open="closureDialogOpen"
            :appointment="cancellingTarget"
            status="cancelled"
            @closed="onVisitCancelled"
        />
    </AppLayout>
</template>
