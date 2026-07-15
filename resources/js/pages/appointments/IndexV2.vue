<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppointmentClosureDialog from '@/components/appointments/AppointmentClosureDialog.vue';
import AppointmentCreateSheet from '@/components/appointments/AppointmentCreateSheet.vue';
import AppointmentEditSheet from '@/components/appointments/AppointmentEditSheet.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import PatientSummaryPopover from '@/components/patients/summary/PatientSummaryPopover.vue';
import { type AppointmentClosureStatus } from '@/composables/appointmentsIndex/useAppointmentStatusAction';
import { useAppointmentDepartmentOptions } from '@/composables/appointmentsIndex/useAppointmentDepartmentOptions';
import { useAppointmentList, type AppointmentListItem } from '@/composables/appointmentsIndex/useAppointmentList';
import { useAppointmentListFilters } from '@/composables/appointmentsIndex/useAppointmentListFilters';
import { useAppointmentPatientDirectory } from '@/composables/appointmentsIndex/useAppointmentPatientDirectory';
import { useAppointmentStatusCounts, type AppointmentStatusCounts } from '@/composables/appointmentsIndex/useAppointmentStatusCounts';
import { useClinicianDirectory } from '@/composables/triage/useClinicianDirectory';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

/**
 * Phase 0 (foundation) + Phase 1 (list/filters/create) + Phase 2
 * (edit/reschedule/cancel/no-show) of
 * reports/appointments-scheduling-workspace-modernization-plan.md.
 *
 * Deliberately scheduling-only, per the plan's §2.1 responsibility split:
 * list, search/filter, create, edit/reschedule, and the two closure-only
 * status transitions a not-yet-arrived visit can take (cancelled/no_show).
 * No check-in, triage, consultation, provider-workflow, or referral UI
 * here — those move to reception/Queue.vue in later phases.
 *
 * usePlatformAccess()-based computed() permission checks, no redundant
 * GET /auth/me/permissions call, <Head>/access-gate/sticky-header-in-
 * bounded-scroll-container conventions matching ShowV2.vue/patients/IndexV2.vue.
 *
 * Sticky header cards are informational only (patients/IndexV2.vue's mini-
 * stat-card treatment); status filtering is a real Tabs control in the
 * scrolling body (patients/IndexV2.vue's TabsList/TabsTrigger pattern) —
 * the two are deliberately not the same control, matching the correction
 * already applied to reception/Queue.vue and patients/IndexV2.vue. Status
 * is scoped to this page's four scheduling-relevant values (scheduled,
 * completed, cancelled, no_show) plus "All" — waiting_triage/
 * waiting_provider/in_consultation are operational states this page
 * doesn't manage.
 *
 * Phase 6 (cutover): /appointments now renders this page directly
 * (reports/appointments-scheduling-workspace-modernization-plan.md §3.3);
 * the pre-cutover page remains reachable at /appointments/legacy for
 * rollback. Phase 4 (Clinician Queue) and Phase 5 (Referrals) are not
 * built yet — this cutover is scoped to what this page actually covers
 * today; the legacy page's other actions already live on their own pages
 * (triage/Queue.vue) or don't have a V2 home yet (consultation, referrals).
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canRead = computed(() => hasAccess('appointments.read'));
const canCreate = computed(() => hasAccess('appointments.create'));
const canUpdate = computed(() => hasAccess('appointment.reschedule'));
const canUpdateStatus = computed(() => hasAccess('appointment.check-in'));
const canShowRowActions = computed(() => canUpdate.value || canUpdateStatus.value);

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Appointments', href: '/appointments' },
]);

const filters = useAppointmentListFilters();
const list = useAppointmentList(filters);
const statusCounts = useAppointmentStatusCounts(filters);
const departmentOptions = useAppointmentDepartmentOptions();

const appointments = computed(() => list.data.value?.data ?? []);
const meta = computed(() => list.data.value?.meta ?? null);

const patientIds = computed(() => appointments.value.map((appointment) => appointment.patientId ?? '').filter(Boolean));
const patientDirectory = useAppointmentPatientDirectory(patientIds);

// Reused as-is from triage/Queue.vue's Phase 3 work — role/page-neutral by
// design (useClinicianDirectory.ts's own docblock), one shared roster
// query, not a duplicate fetch.
const clinicianDirectory = useClinicianDirectory();

function clinicianDisplayName(clinicianUserId: number | null): string {
    if (!clinicianUserId) return 'Unassigned';
    const clinician = clinicianDirectory.data.value?.find((row) => row.userId === clinicianUserId);
    return clinician?.userName || `Clinician #${clinicianUserId}`;
}

const departmentFilterValue = computed({
    get: () => filters.department,
    set: (value: string) => {
        filters.department = value;
        filters.page = 1;
    },
});

function statusTabCount(value: keyof AppointmentStatusCounts): number | null {
    return statusCounts.data.value?.[value] ?? null;
}

function setStatus(value: string | number): void {
    filters.status = value === 'all' ? '' : String(value);
    filters.page = 1;
}

function submitSearch(): void {
    filters.page = 1;
}

function statusVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    if (status === 'scheduled') return 'default';
    if (status === 'completed') return 'secondary';
    if (status === 'cancelled' || status === 'no_show') return 'destructive';
    return 'outline';
}

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function goToPage(page: number): void {
    if (!meta.value) return;
    filters.page = Math.min(Math.max(page, 1), meta.value.lastPage);
}

const createSheetOpen = ref(false);
const queryClient = useQueryClient();

function onAppointmentCreated(appointment: AppointmentListItem): void {
    void queryClient.invalidateQueries({ queryKey: ['appointments-index'] });
    // A same-day booking made here should also surface on Reception
    // Queue's "Scheduled today" tab (useTodaysScheduledAppointments.ts) —
    // that query has its own cache key since it's a different filtered
    // view of the same /appointments endpoint, so it needs its own
    // invalidation, not just this page's own list.
    void queryClient.invalidateQueries({ queryKey: ['reception-todays-scheduled-appointments'] });
    notifySuccess(`Appointment ${appointment.appointmentNumber ?? ''} scheduled.`);
}

const editSheetOpen = ref(false);
const editingAppointment = ref<AppointmentListItem | null>(null);

function openEditSheet(appointment: AppointmentListItem): void {
    editingAppointment.value = appointment;
    editSheetOpen.value = true;
}

function onAppointmentUpdated(appointment: AppointmentListItem): void {
    void queryClient.invalidateQueries({ queryKey: ['appointments-index'] });
    notifySuccess(`Appointment ${appointment.appointmentNumber ?? ''} updated.`);
}

const closureDialogOpen = ref(false);
const closingAppointment = ref<AppointmentListItem | null>(null);
const closureStatus = ref<AppointmentClosureStatus>('cancelled');

function openClosureDialog(appointment: AppointmentListItem, status: AppointmentClosureStatus): void {
    closingAppointment.value = appointment;
    closureStatus.value = status;
    closureDialogOpen.value = true;
}

function onAppointmentClosed(appointment: AppointmentListItem): void {
    void queryClient.invalidateQueries({ queryKey: ['appointments-index'] });
    notifySuccess(
        appointment.status === 'cancelled'
            ? `Appointment ${appointment.appointmentNumber ?? ''} cancelled.`
            : `No-show recorded for ${appointment.appointmentNumber ?? ''}.`,
    );
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Appointments" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">Appointments</h1>
                        <p class="text-xs text-muted-foreground">Scheduling only — live visit progress is on the Reception Queue.</p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <Badge v-if="meta" variant="secondary">{{ meta.total }} appointments</Badge>
                        <Button v-if="canCreate" size="sm" class="h-8 gap-1.5" @click="createSheetOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            Schedule appointment
                        </Button>
                    </div>
                </div>

                <div v-if="canRead" class="mt-3 grid grid-cols-5 gap-2">
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Scheduled</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusTabCount('scheduled') ?? '—' }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Completed</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusTabCount('completed') ?? '—' }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Cancelled</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusTabCount('cancelled') ?? '—' }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">No-show</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusTabCount('no_show') ?? '—' }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusTabCount('total') ?? '—' }}</p>
                    </div>
                </div>

                <Tabs v-if="canRead" :model-value="filters.status || 'all'" class="mt-3" @update:model-value="setStatus">
                    <TabsList class="grid w-full grid-cols-5">
                        <TabsTrigger value="scheduled" class="inline-flex items-center gap-1.5">
                            Scheduled
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusTabCount('scheduled') ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="completed" class="inline-flex items-center gap-1.5">
                            Completed
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusTabCount('completed') ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="cancelled" class="inline-flex items-center gap-1.5">
                            Cancelled
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusTabCount('cancelled') ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="no_show" class="inline-flex items-center gap-1.5">
                            No-show
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusTabCount('no_show') ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                            All
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusTabCount('total') ?? '—' }}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canRead" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing appointments requires <code>appointments.read</code>.</AlertDescription>
                </Alert>

                <template v-else>
                    <div class="flex flex-wrap items-start gap-2">
                        <div class="relative min-w-72 flex-1">
                            <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                v-model="filters.q"
                                placeholder="Search patient, appointment #, or reason…"
                                class="h-9 pl-9"
                                @keyup.enter="submitSearch"
                            />
                        </div>
                        <div class="w-56">
                            <SearchableSelectField
                                v-model="departmentFilterValue"
                                input-id="appointment-filter-department"
                                label=""
                                :options="departmentOptions.data.value ?? []"
                                placeholder="All departments"
                                allow-custom-value
                                trigger-class="h-9"
                            />
                        </div>
                        <Input v-model="filters.from" type="date" class="h-9 w-40" />
                        <Input v-model="filters.to" type="date" class="h-9 w-40" />
                    </div>

                    <div v-if="list.isPending.value" class="space-y-2">
                        <Skeleton class="h-14 w-full" />
                        <Skeleton class="h-14 w-full" />
                        <Skeleton class="h-14 w-full" />
                    </div>

                    <Alert v-else-if="list.isError.value" variant="destructive">
                        <AlertTitle>Unable to load appointments</AlertTitle>
                        <AlertDescription>{{ (list.error.value as Error | null)?.message ?? 'Unknown error.' }}</AlertDescription>
                    </Alert>

                    <div v-else-if="appointments.length === 0" class="rounded-lg border border-dashed bg-card px-5 py-5">
                        <p class="text-sm font-medium text-foreground">No appointments found</p>
                        <p class="mt-1 text-xs text-muted-foreground">Try adjusting the search query, status, or date range.</p>
                    </div>

                    <div v-else class="overflow-x-auto rounded-lg border bg-card">
                        <table class="w-full text-sm">
                            <thead class="border-b bg-muted/30 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th class="px-3 py-2 text-left">Patient</th>
                                    <th class="px-3 py-2 text-left">Appointment #</th>
                                    <th class="px-3 py-2 text-left">Clinician</th>
                                    <th class="px-3 py-2 text-left">Department</th>
                                    <th class="px-3 py-2 text-left">Scheduled for</th>
                                    <th class="px-3 py-2 text-left">Duration</th>
                                    <th class="px-3 py-2 text-left">Type</th>
                                    <th class="px-3 py-2 text-left">Status</th>
                                    <th class="px-3 py-2 text-left">Reason</th>
                                    <th v-if="canShowRowActions" class="px-3 py-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="appointment in appointments" :key="appointment.id" class="border-b last:border-b-0 hover:bg-muted/20">
                                    <td class="px-3 py-2">
                                        <div class="min-w-0">
                                            <PatientSummaryPopover v-if="appointment.patientId" :patient-id="appointment.patientId">
                                                <template #trigger>
                                                    <button type="button" class="truncate text-left font-medium text-foreground hover:underline">
                                                        {{ patientDirectory.displayName(appointment.patientId) }}
                                                    </button>
                                                </template>
                                                <template #actions>
                                                    <a :href="`/patients/${appointment.patientId}/chart`" class="text-xs font-medium text-primary hover:underline">
                                                        View chart
                                                    </a>
                                                </template>
                                            </PatientSummaryPopover>
                                            <p v-else class="font-medium text-foreground">{{ patientDirectory.displayName(appointment.patientId) }}</p>
                                            <p class="truncate text-xs text-muted-foreground">{{ patientDirectory.patientNumber(appointment.patientId) || 'No MRN assigned' }}</p>
                                        </div>
                                    </td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ appointment.appointmentNumber || '—' }}</td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ clinicianDisplayName(appointment.clinicianUserId) }}</td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ appointment.department || '—' }}</td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ formatDateTime(appointment.scheduledAt) }}</td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ appointment.durationMinutes ? `${appointment.durationMinutes} min` : '—' }}</td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ appointment.appointmentType || '—' }}</td>
                                    <td class="px-3 py-2">
                                        <Badge :variant="statusVariant(appointment.status)">{{ appointment.status || 'unknown' }}</Badge>
                                    </td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ appointment.reason || '—' }}</td>
                                    <td v-if="canShowRowActions" class="px-3 py-2">
                                        <div class="flex items-center justify-end gap-1">
                                            <Button
                                                v-if="canUpdate && appointment.status === 'scheduled'"
                                                size="sm"
                                                variant="ghost"
                                                class="h-7 gap-1 px-2 text-xs"
                                                @click="openEditSheet(appointment)"
                                            >
                                                <AppIcon name="pencil" class="size-3.5" />Edit
                                            </Button>
                                            <Button
                                                v-if="canUpdateStatus && appointment.status === 'scheduled'"
                                                size="sm"
                                                variant="ghost"
                                                class="h-7 gap-1 px-2 text-xs"
                                                @click="openClosureDialog(appointment, 'no_show')"
                                            >
                                                No-show
                                            </Button>
                                            <Button
                                                v-if="canUpdateStatus && appointment.status === 'scheduled'"
                                                size="sm"
                                                variant="ghost"
                                                class="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                                                @click="openClosureDialog(appointment, 'cancelled')"
                                            >
                                                Cancel
                                            </Button>
                                            <span v-if="appointment.status !== 'scheduled'" class="text-xs text-muted-foreground">—</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div v-if="meta && meta.lastPage > 1" class="flex items-center justify-between text-sm text-muted-foreground">
                        <p>Page {{ meta.currentPage }} of {{ meta.lastPage }} ({{ meta.total }} total)</p>
                        <div class="flex gap-2">
                            <Button size="sm" variant="outline" :disabled="meta.currentPage <= 1" @click="goToPage(meta.currentPage - 1)">
                                <AppIcon name="chevron-left" class="size-3.5" />Previous
                            </Button>
                            <Button size="sm" variant="outline" :disabled="meta.currentPage >= meta.lastPage" @click="goToPage(meta.currentPage + 1)">
                                Next<AppIcon name="chevron-right" class="size-3.5" />
                            </Button>
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <AppointmentCreateSheet v-model:open="createSheetOpen" @created="onAppointmentCreated" />
        <AppointmentEditSheet v-model:open="editSheetOpen" :appointment="editingAppointment" @updated="onAppointmentUpdated" />
        <AppointmentClosureDialog
            v-model:open="closureDialogOpen"
            :appointment="closingAppointment"
            :status="closureStatus"
            @closed="onAppointmentClosed"
        />
    </AppLayout>
</template>
