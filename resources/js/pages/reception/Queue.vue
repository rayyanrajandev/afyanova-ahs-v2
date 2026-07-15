<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref, useTemplateRef } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReceptionQueueList from '@/components/reception/ReceptionQueueList.vue';
import ScheduledArrivalsList from '@/components/reception/ScheduledArrivalsList.vue';
import AppointmentCreateSheet from '@/components/appointments/AppointmentCreateSheet.vue';
import PatientDirectServiceDialog from '@/components/patients/PatientDirectServiceDialog.vue';
import PatientQuickSearchField from '@/components/patients/PatientQuickSearchField.vue';
import PatientRegistrationSheet from '@/components/patients/PatientRegistrationSheet.vue';
import { type AppointmentListItem } from '@/composables/appointmentsIndex/useAppointmentList';
import { useAppointmentDepartmentOptions } from '@/composables/appointmentsIndex/useAppointmentDepartmentOptions';
import { type PatientListItem } from '@/composables/patientsIndex/usePatientList';
import { type PatientQuickSearchResult } from '@/composables/patients/usePatientQuickSearch';
import {
    useReceptionQueue,
    useReceptionQueueFilters,
    type ReceptionQueueFilters,
    type ReceptionQueueStage,
} from '@/composables/reception/useReceptionQueue';
import { useReceptionQueueStatusCounts } from '@/composables/reception/useReceptionQueueStatusCounts';
import { useReceptionQueueLiveUpdates } from '@/composables/reception/useReceptionQueueLiveUpdates';
import { useTodaysScheduledAppointments } from '@/composables/reception/useTodaysScheduledAppointments';
import { useCheckIn } from '@/composables/reception/useCheckIn';
import { useWalkInCheckIn } from '@/composables/reception/useWalkInCheckIn';
import { useAppointmentPatientDirectory } from '@/composables/appointmentsIndex/useAppointmentPatientDirectory';
import { useClinicianDirectory } from '@/composables/triage/useClinicianDirectory';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

/**
 * Phase 6 (slice 1) of reports/patient-arrival-checkin-modernization-plan.md:
 * a new, standalone page — no predecessor to replace, so no V2/legacy-fallback
 * ceremony, matching encounters/List.vue's precedent — surfacing the queue
 * read-model (Phase 4) and atomic walk-in registration (Phase 1), both of
 * which had zero frontend consumers before this. Deliberately does not touch
 * appointments/Index.vue or patients/Index.vue's existing handoff panel —
 * that extraction is separately scoped, later work.
 *
 * Brought in line with the established V2 surface conventions — checked
 * directly against patients/chart/ShowV2.vue and encounters/WorkspaceV2.vue
 * rather than assumed. That check found the sticky header in those pages
 * holds only the title and non-interactive KPI mini-stats; stage/tab
 * switching is a separate Tabs (TabsList/TabsTrigger/TabsContent) row
 * living in the normal scrolling body below it, with badge counts on each
 * trigger — an initial pass on this page wrongly folded the stage switcher
 * into the sticky KPI cards themselves. Fixed here to match: sticky header
 * is informational only, and the waiting_triage/waiting_provider switch is
 * a real Tabs component, the same pattern ShowV2.vue uses for its
 * Overview/Timeline/Visits/etc. tabs. The KPI grid and TabsList fill the
 * available width rather than being capped to a fixed size — with only two
 * items each, a narrow fixed-width strip left most of the header empty.
 *
 * "Register walk-in" was renamed to "Check in a walk-in visit": this form
 * only searches for a patient who already exists (POST /reception/walk-ins
 * creates the appointment/arrival, never the patient record), so "register"
 * collided with actual patient registration in patients/Index.vue. Now
 * explicit.
 *
 * Not-found patients no longer force a two-page round-trip (a real
 * friction gap flagged in reports/patient-summary-module-rollout-tracker.md):
 * "Add a new patient" and the empty-search-result state both open
 * PatientRegistrationSheet.vue inline, on this page, instead of navigating
 * to /patients. Its `registered` event carries the new PatientListItem
 * straight into selectedPatient, so the receptionist lands back on this
 * same form with the patient already selected and can hit "Check in"
 * immediately — one flow, not "register, then re-find, then check in."
 * Gated on patients.create; without it, the link still points to /patients
 * (nothing to open inline if the user can't register anyway).
 *
 * "Direct service request" sits alongside the walk-in check-in action for
 * the same selected patient — added per reports/reception-checkin-
 * architecture-audit.md's finding that this is the canonical front-desk
 * workspace, yet a receptionist previously had no way to reach Direct
 * Service (a patient who needs only a lab/pharmacy/radiology/theatre
 * service, not a doctor visit) without leaving for patients/IndexV2.vue.
 * Not a third arrival-mode option — Direct Service isn't an arrival mode
 * at all (it creates a ServiceRequest, not an appointment, and never
 * touches triage), so it's its own action, reusing the same
 * PatientDirectServiceDialog.vue/useDirectServiceRequest.ts
 * PatientVisitActionsMenu.vue already established.
 *
 * Deliberately stays front-desk-scoped: check-in, walk-in registration,
 * arrival visibility across both the waiting_triage and waiting_provider
 * segments (reception staff legitimately want to see where a patient
 * stands, matching patient-flow/Board.vue's own reasoning for why it
 * excludes this segment and points here instead). Nurse/clinician actions
 * on those visits — triage recording, consultation ownership, provider
 * workflow — deliberately do NOT live here; an earlier attempt put "Record
 * triage" on this page and was reverted (see
 * reports/appointments-scheduling-workspace-modernization-plan.md's Phase 3
 * correction note) because a page named Reception is not where nurses
 * should be told to do clinical work, regardless of what permission gates
 * the button. triage/Queue.vue owns that instead.
 *
 * "Scheduled today" tab (patient flow redesign, appointment workflow A1):
 * useCheckIn.ts (PATCH /appointments/{id}/check-in) previously had zero
 * frontend callers — a future-dated appointment booked via /appointments
 * had no page anywhere for reception to check it in against once the
 * patient arrived, only "Check in a walk-in visit" above, which always
 * creates a brand-new appointment rather than finding the existing one.
 * This tab surfaces today's still-`scheduled` appointments
 * (useTodaysScheduledAppointments.ts, reusing the existing /appointments
 * list endpoint — no backend change) and finally wires that endpoint up.
 *
 * "Start a visit" (patient flow redesign, second pass): the first version
 * of this split Walk-in/Emergency into one Select+button and Direct
 * service/Schedule appointment into a separate "More actions" dropdown —
 * four ways to start a visit, spread across two different controls a
 * receptionist had to remember. All four are the same decision ("what is
 * this patient here for today"), so they now live in one RadioGroup
 * (ui/radio-group, a new thin wrapper over reka-ui's RadioGroupRoot/Item,
 * matching every other ui/ primitive's shape — Checkbox.vue/Switch.vue —
 * no prior radio-style primitive existed in this codebase), styled as
 * compact pills rather than a stacked list of description cards so the
 * whole control still fits in the same single flex-wrap row the search
 * box, reason field, and action button already lived in — appearing
 * inline once a patient is selected, not as a new section that pushes the
 * page taller. Selecting an option reveals only the fields that option
 * needs: Walk-in/Emergency show a reason field and check in immediately
 * (useWalkInCheckIn, unchanged); Direct service/Schedule appointment skip
 * straight to a "Continue" button into their existing dedicated
 * dialog/sheet (PatientDirectServiceDialog.vue, AppointmentCreateSheet.vue)
 * rather than duplicating their fields/validation inline —
 * AppointmentCreateSheet.vue's `initialPatientId` prop carries the
 * already-selected patient through so that step never forces a second
 * search.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canReadAppointments = computed(() => hasAccess('appointments.read'));
// Matches PatientVisitActionsMenu.vue's canStartVisit exactly — POST
// /reception/walk-ins both creates the appointment and advances it straight
// to waiting_triage/waiting_provider in one atomic write, so both
// permissions are required, not just appointments.create.
const canStartVisit = computed(() => hasAccess('appointments.create') && hasAccess('appointments.update-status'));
const canCreateServiceRequest = computed(() => hasAccess('service.requests.create'));
const canCreateAppointment = computed(() => hasAccess('appointments.create'));
const canCreatePatients = computed(() => hasAccess('patients.create'));
const canRecordTriage = computed(() => hasAccess('appointments.record-triage'));

const queryClient = useQueryClient();

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Reception queue', href: '/reception/queue' },
]);

type QueueTab = ReceptionQueueStage | 'scheduled_today';

const selectedStage = ref<QueueTab>('waiting_triage');

// Two independently-pinned queries, not one — this is what makes both the
// header KPI cards and the tab badges show both stages' counts at once,
// each TabsContent below reading directly from its own query rather than a
// single "current" one. P2+P5: both now carry the same q/department/
// clinicianUserId filter set (driven by one shared filter row, see the
// watcher below) plus their own independent page/stage.
const triageFilters = useReceptionQueueFilters();
triageFilters.stage = 'waiting_triage';
const providerFilters = useReceptionQueueFilters();
providerFilters.stage = 'waiting_provider';
const triageQueue = useReceptionQueue(triageFilters);
const providerQueue = useReceptionQueue(providerFilters);
// Counts cover all three stages regardless of which filters object reads
// them — status-counts only looks at q/department/clinicianUserId, never
// `.stage`, so reusing triageFilters here isn't a stage-specific narrowing.
const statusCounts = useReceptionQueueStatusCounts(triageFilters);
const { isLive } = useReceptionQueueLiveUpdates([['reception-queue-status-counts']]);

const departmentOptions = useAppointmentDepartmentOptions();
const clinicianDirectory = useClinicianDirectory();
const queueSearchInput = ref('');
const queueDepartment = ref('');
const queueClinicianUserId = ref('');

function applyQueueFilters(): void {
    triageFilters.q = queueSearchInput.value;
    triageFilters.department = queueDepartment.value;
    triageFilters.clinicianUserId = queueClinicianUserId.value;
    triageFilters.page = 1;
    providerFilters.q = queueSearchInput.value;
    providerFilters.department = queueDepartment.value;
    providerFilters.clinicianUserId = queueClinicianUserId.value;
    providerFilters.page = 1;
}

const queueDepartmentValue = computed({
    get: () => queueDepartment.value || 'all',
    set: (value: string) => {
        queueDepartment.value = value === 'all' ? '' : value;
        applyQueueFilters();
    },
});

const queueClinicianValue = computed({
    get: () => queueClinicianUserId.value || 'all',
    set: (value: string) => {
        queueClinicianUserId.value = value === 'all' ? '' : value;
        applyQueueFilters();
    },
});

function goToTriagePage(page: number): void {
    triageFilters.page = page;
}
function goToProviderPage(page: number): void {
    providerFilters.page = page;
}

// A patient with a future-dated appointment (booked via /appointments,
// Scheduling V2) never appeared anywhere reception staff look, and
// useCheckIn.ts (PATCH /appointments/{id}/check-in) had no caller — see
// this session's patient flow redesign plan. This tab and the two queries
// below close that gap; no other stage change accompanies this fix.
const scheduledQuery = useTodaysScheduledAppointments();
const scheduledPatientIds = computed(() => (scheduledQuery.data.value ?? []).map((entry) => entry.patientId).filter((id): id is string => Boolean(id)));
const scheduledPatientDirectory = useAppointmentPatientDirectory(scheduledPatientIds);

function clinicianDisplayName(clinicianUserId: number | null): string {
    if (!clinicianUserId) return 'Unassigned';
    const clinician = clinicianDirectory.data.value?.find((entry) => entry.userId === clinicianUserId);
    return clinician?.userName ?? `Clinician #${clinicianUserId}`;
}

const checkIn = useCheckIn();
const checkingInId = ref<string | null>(null);

async function invalidateReceptionQueueAndCounts(): Promise<void> {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reception-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['reception-queue-status-counts'] }),
    ]);
}

async function handleCheckIn(appointmentId: string): Promise<void> {
    checkingInId.value = appointmentId;
    try {
        await checkIn.mutateAsync({ appointmentId });
        notifySuccess('Patient checked in.');
        await queryClient.invalidateQueries({ queryKey: ['reception-todays-scheduled-appointments'] });
        await invalidateReceptionQueueAndCounts();
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to check in this appointment.');
    } finally {
        checkingInId.value = null;
    }
}

const kpis = computed(() => [
    { value: 'waiting_triage' as const, label: 'Waiting for triage', count: statusCounts.data.value?.waiting_triage ?? null },
    { value: 'waiting_provider' as const, label: 'Waiting for provider', count: statusCounts.data.value?.waiting_provider ?? null },
    { value: 'scheduled_today' as const, label: 'Scheduled today', count: scheduledQuery.data.value?.length ?? null },
]);

// --- Start a visit ----------------------------------------------------
// Patient search itself lives in PatientQuickSearchField.vue /
// usePatientQuickSearch.ts (extracted out of this file — it used to
// duplicate a subset of PatientLookupField.vue's own GET /patients search
// logic inline, without reusing it). This section owns only what's
// specific to "starting a visit": which patient is currently selected and
// what the receptionist wants to do with them.

/**
 * The four ways a visit can start, unified into one choice — see this
 * file's own docblock for why. 'walk_in'/'emergency' match
 * WalkInArrivalMode's values directly (no translation needed when calling
 * useWalkInCheckIn); 'direct_service'/'schedule' are this page's own
 * labels, since those two don't correspond to an arrival mode at all.
 */
type VisitType = 'walk_in' | 'emergency' | 'direct_service' | 'schedule';

type VisitOption = { value: VisitType; label: string; description: string };

const patientQuery = ref('');
const selectedPatient = ref<PatientQuickSearchResult | null>(null);
const visitType = ref<VisitType>('walk_in');
const reason = ref('');
const patientSearchFieldRef = useTemplateRef<InstanceType<typeof PatientQuickSearchField>>('patientSearchField');

const visitOptions = computed<VisitOption[]>(() => {
    const options: VisitOption[] = [];
    if (canStartVisit.value) {
        options.push({ value: 'walk_in', label: 'Walk-in OPD', description: 'Send straight to nurse triage.' });
        options.push({ value: 'emergency', label: 'Emergency', description: 'Send straight to emergency triage.' });
    }
    if (canCreateServiceRequest.value) {
        options.push({ value: 'direct_service', label: 'Direct service', description: 'Lab, pharmacy, radiology, or theatre — no doctor visit.' });
    }
    if (canCreateAppointment.value) {
        options.push({ value: 'schedule', label: 'Book appointment', description: 'Schedule a future visit with a specific doctor.' });
    }
    return options;
});

function onPatientSelected(patient: PatientQuickSearchResult | null): void {
    selectedPatient.value = patient;
    if (patient) {
        visitType.value = visitOptions.value[0]?.value ?? 'walk_in';
        reason.value = '';
    }
}

const registerSheetOpen = ref(false);

function onPatientRegistered(patient: PatientListItem): void {
    const result: PatientQuickSearchResult = {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        patientNumber: patient.patientNumber,
    };
    patientSearchFieldRef.value?.selectExternally(result);
    onPatientSelected(result);

    // PatientRegistrationSheet.vue only emits `registered` — it doesn't
    // toast on the online-registration path itself (only its own offline-
    // save fallback does), matching patients/IndexV2.vue's own
    // onPatientRegistered, which is the only reason a toast shows up there.
    const name = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ') || 'Unnamed patient';
    notifySuccess(`${name} registered (${patient.patientNumber ?? 'MRN pending'}).`);
}

const walkIn = useWalkInCheckIn();
const canSubmitWalkIn = computed(() => selectedPatient.value !== null && !walkIn.isPending.value);

function resetVisitSelection(): void {
    selectedPatient.value = null;
    reason.value = '';
    visitType.value = 'walk_in';
    patientSearchFieldRef.value?.reset();
}

async function submitWalkIn(): Promise<void> {
    if (!selectedPatient.value) return;

    await walkIn.mutateAsync({
        patientId: selectedPatient.value.id,
        arrivalMode: visitType.value === 'emergency' ? 'emergency' : 'walk_in',
        reason: reason.value.trim() || null,
    });

    resetVisitSelection();
    await invalidateReceptionQueueAndCounts();
}

const directServiceDialogOpen = ref(false);
const scheduleAppointmentSheetOpen = ref(false);

function onDirectServiceCreated(requestNumber: string | null): void {
    notifySuccess(`Direct service request ${requestNumber ?? ''} created.`);
    resetVisitSelection();
}

async function onAppointmentScheduled(appointment: AppointmentListItem): Promise<void> {
    notifySuccess(`Appointment ${appointment.appointmentNumber ?? ''} scheduled.`);
    resetVisitSelection();
    await queryClient.invalidateQueries({ queryKey: ['reception-todays-scheduled-appointments'] });
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Reception Queue" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <Tabs v-model="selectedStage" class="contents">
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="min-w-0 space-y-0.5">
                    <div class="flex items-center gap-2">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">Reception Queue</h1>
                        <span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span class="size-1.5 rounded-full" :class="isLive ? 'bg-emerald-500' : 'bg-muted-foreground/40'" aria-hidden="true" />
                            {{ isLive ? 'Live' : 'Polling' }}
                        </span>
                    </div>
                    <p class="text-xs text-muted-foreground">
                        Emergency arrivals first, then scheduled, then walk-in — oldest wait first within each group.
                    </p>
                </div>

                <div v-if="canReadAppointments" class="mt-3 grid grid-cols-3 gap-2">
                    <div v-for="kpi in kpis" :key="kpi.value" class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{{ kpi.label }}</p>
                        <p class="text-sm font-bold tabular-nums">{{ kpi.count ?? '—' }}</p>
                    </div>
                </div>

                <TabsList v-if="canReadAppointments" class="mt-3 grid w-full grid-cols-3">
                    <TabsTrigger value="scheduled_today" class="inline-flex items-center gap-1.5">
                        Scheduled today
                        <Badge v-if="scheduledQuery.data.value?.length" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                            {{ scheduledQuery.data.value.length }}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="waiting_triage" class="inline-flex items-center gap-1.5">
                        Waiting for triage
                        <Badge v-if="statusCounts.data.value?.waiting_triage" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                            {{ statusCounts.data.value.waiting_triage }}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="waiting_provider" class="inline-flex items-center gap-1.5">
                        Waiting for provider
                        <Badge v-if="statusCounts.data.value?.waiting_provider" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                            {{ statusCounts.data.value.waiting_provider }}
                        </Badge>
                    </TabsTrigger>
                </TabsList>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canReadAppointments" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing the reception queue requires <code>appointments.read</code>.</AlertDescription>
                </Alert>

                <template v-else>
                    <div class="rounded-lg border bg-card p-3 shadow-sm">
                        <div class="flex flex-wrap items-baseline justify-between gap-2">
                            <h2 class="text-sm font-medium">Start a visit</h2>
                            <p class="text-xs text-muted-foreground">
                                For a patient already in the system.
                                <button
                                    v-if="canCreatePatients"
                                    type="button"
                                    class="font-medium text-primary underline-offset-2 hover:underline"
                                    @click="registerSheetOpen = true"
                                >
                                    Add a new patient
                                </button>
                                <Link v-else href="/patients" class="font-medium text-primary underline-offset-2 hover:underline">
                                    Add a new patient
                                </Link>
                            </p>
                        </div>

                        <div class="mt-2 flex flex-wrap items-center gap-2">
                            <div class="min-w-72 flex-1">
                                <PatientQuickSearchField
                                    ref="patientSearchField"
                                    v-model:query="patientQuery"
                                    input-id="reception-patient-search"
                                    placeholder="Search existing patient by name, MRN, or phone…"
                                    @selected="onPatientSelected"
                                >
                                    <template #no-match-action>
                                        <button
                                            v-if="canCreatePatients"
                                            type="button"
                                            class="font-medium text-primary underline-offset-2 hover:underline"
                                            @click="registerSheetOpen = true"
                                        >
                                            Register them first
                                        </button>
                                        <Link v-else href="/patients" class="font-medium text-primary underline-offset-2 hover:underline">
                                            Register them first
                                        </Link>
                                    </template>
                                </PatientQuickSearchField>
                            </div>

                            <RadioGroup
                                v-if="selectedPatient && visitOptions.length > 0"
                                v-model="visitType"
                                class="flex flex-wrap items-center gap-1.5"
                            >
                                <Label
                                    v-for="option in visitOptions"
                                    :key="option.value"
                                    :for="`visit-type-${option.value}`"
                                    :title="option.description"
                                    class="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap"
                                    :class="visitType === option.value ? 'border-primary bg-primary/5' : 'border-input'"
                                >
                                    <RadioGroupItem :id="`visit-type-${option.value}`" :value="option.value" />
                                    {{ option.label }}
                                </Label>
                            </RadioGroup>

                            <Input
                                v-if="selectedPatient && (visitType === 'walk_in' || visitType === 'emergency')"
                                v-model="reason"
                                placeholder="Reason (optional)"
                                class="h-9 min-w-48 flex-1"
                            />

                            <Button
                                v-if="selectedPatient && (visitType === 'walk_in' || visitType === 'emergency')"
                                :disabled="!canSubmitWalkIn"
                                @click="submitWalkIn"
                            >
                                {{ walkIn.isPending.value ? 'Checking in…' : 'Check in' }}
                            </Button>
                            <Button v-else-if="selectedPatient && visitType === 'direct_service'" @click="directServiceDialogOpen = true">
                                Continue
                            </Button>
                            <Button v-else-if="selectedPatient && visitType === 'schedule'" @click="scheduleAppointmentSheetOpen = true">
                                Continue
                            </Button>
                        </div>

                        <p v-if="walkIn.error.value" class="mt-2 text-sm text-destructive">
                            {{ walkIn.error.value.message }}
                        </p>
                    </div>

                    <div v-if="selectedStage !== 'scheduled_today'" class="flex flex-wrap items-start gap-2">
                        <div class="relative min-w-72 flex-1">
                            <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                v-model="queueSearchInput"
                                placeholder="Search patient name, MRN, or queue #…"
                                class="h-9 pl-9"
                                @keyup.enter="applyQueueFilters"
                            />
                        </div>
                        <Select v-model="queueDepartmentValue">
                            <SelectTrigger class="h-9 w-48">
                                <SelectValue placeholder="Department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All departments</SelectItem>
                                <SelectItem v-for="option in departmentOptions.data.value ?? []" :key="option.value" :value="option.value">
                                    {{ option.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <Select v-model="queueClinicianValue">
                            <SelectTrigger class="h-9 w-48">
                                <SelectValue placeholder="Provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All providers</SelectItem>
                                <SelectItem
                                    v-for="entry in clinicianDirectory.data.value ?? []"
                                    :key="entry.userId ?? entry.id"
                                    :value="String(entry.userId)"
                                >
                                    {{ entry.userName ?? `Clinician #${entry.userId}` }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>


                        <TabsContent value="scheduled_today">
                            <div v-if="scheduledQuery.isPending.value" class="space-y-2">
                                <Skeleton class="h-16 w-full" />
                                <Skeleton class="h-16 w-full" />
                            </div>

                            <Alert v-else-if="scheduledQuery.isError.value" variant="destructive">
                                <AlertTitle>Unable to load scheduled arrivals</AlertTitle>
                                <AlertDescription>
                                    {{ scheduledQuery.error.value?.message ?? 'Unknown error.' }}
                                </AlertDescription>
                            </Alert>

                            <ScheduledArrivalsList
                                v-else
                                :entries="scheduledQuery.data.value ?? []"
                                :patient-display-name="scheduledPatientDirectory.displayName"
                                :patient-number="scheduledPatientDirectory.patientNumber"
                                :clinician-display-name="clinicianDisplayName"
                                :checking-in-id="checkingInId"
                                @check-in="handleCheckIn"
                            />
                        </TabsContent>

                        <TabsContent value="waiting_triage">
                            <div v-if="triageQueue.isPending.value" class="space-y-2">
                                <Skeleton class="h-16 w-full" />
                                <Skeleton class="h-16 w-full" />
                            </div>

                            <Alert v-else-if="triageQueue.isError.value" variant="destructive">
                                <AlertTitle>Unable to load the queue</AlertTitle>
                                <AlertDescription>
                                    {{ triageQueue.error.value?.message ?? 'Unknown error.' }}
                                </AlertDescription>
                            </Alert>

                            <template v-else>
                                <ReceptionQueueList :entries="triageQueue.data.value?.data ?? []">
                                    <template #actions="{ entry }">
                                        <Link
                                            v-if="canRecordTriage"
                                            :href="`/triage/queue?triage=${entry.appointmentId}`"
                                            class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent"
                                        >
                                            Record triage
                                        </Link>
                                    </template>
                                </ReceptionQueueList>
                                <div
                                    v-if="triageQueue.data.value && triageQueue.data.value.meta.lastPage > 1"
                                    class="mt-2 flex items-center justify-between text-sm text-muted-foreground"
                                >
                                    <p>Page {{ triageQueue.data.value.meta.currentPage }} of {{ triageQueue.data.value.meta.lastPage }} ({{ triageQueue.data.value.meta.total }} total)</p>
                                    <div class="flex gap-2">
                                        <Button size="sm" variant="outline" :disabled="triageQueue.data.value.meta.currentPage <= 1" @click="goToTriagePage(triageQueue.data.value.meta.currentPage - 1)">
                                            <AppIcon name="chevron-left" class="size-3.5" />Previous
                                        </Button>
                                        <Button size="sm" variant="outline" :disabled="triageQueue.data.value.meta.currentPage >= triageQueue.data.value.meta.lastPage" @click="goToTriagePage(triageQueue.data.value.meta.currentPage + 1)">
                                            Next<AppIcon name="chevron-right" class="size-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </template>
                        </TabsContent>

                        <TabsContent value="waiting_provider">
                            <div v-if="providerQueue.isPending.value" class="space-y-2">
                                <Skeleton class="h-16 w-full" />
                                <Skeleton class="h-16 w-full" />
                            </div>

                            <Alert v-else-if="providerQueue.isError.value" variant="destructive">
                                <AlertTitle>Unable to load the queue</AlertTitle>
                                <AlertDescription>
                                    {{ providerQueue.error.value?.message ?? 'Unknown error.' }}
                                </AlertDescription>
                            </Alert>

                            <template v-else>
                                <ReceptionQueueList :entries="providerQueue.data.value?.data ?? []" />
                                <div
                                    v-if="providerQueue.data.value && providerQueue.data.value.meta.lastPage > 1"
                                    class="mt-2 flex items-center justify-between text-sm text-muted-foreground"
                                >
                                    <p>Page {{ providerQueue.data.value.meta.currentPage }} of {{ providerQueue.data.value.meta.lastPage }} ({{ providerQueue.data.value.meta.total }} total)</p>
                                    <div class="flex gap-2">
                                        <Button size="sm" variant="outline" :disabled="providerQueue.data.value.meta.currentPage <= 1" @click="goToProviderPage(providerQueue.data.value.meta.currentPage - 1)">
                                            <AppIcon name="chevron-left" class="size-3.5" />Previous
                                        </Button>
                                        <Button size="sm" variant="outline" :disabled="providerQueue.data.value.meta.currentPage >= providerQueue.data.value.meta.lastPage" @click="goToProviderPage(providerQueue.data.value.meta.currentPage + 1)">
                                            Next<AppIcon name="chevron-right" class="size-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </template>
                        </TabsContent>
                </template>
            </div>
            </Tabs>
        </div>

        <PatientDirectServiceDialog
            v-model:open="directServiceDialogOpen"
            :patient="selectedPatient"
            @created="onDirectServiceCreated"
        />

        <AppointmentCreateSheet
            v-model:open="scheduleAppointmentSheetOpen"
            :initial-patient-id="selectedPatient?.id ?? ''"
            @created="onAppointmentScheduled"
        />

        <PatientRegistrationSheet v-model:open="registerSheetOpen" @registered="onPatientRegistered" />
    </AppLayout>
</template>
