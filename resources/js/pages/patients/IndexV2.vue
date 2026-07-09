<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PatientEditSheet from '@/components/patients/PatientEditSheet.vue';
import PatientRegistrationSheet from '@/components/patients/PatientRegistrationSheet.vue';
import PatientStatusDialog from '@/components/patients/PatientStatusDialog.vue';
import PatientVisitActionsMenu from '@/components/patients/PatientVisitActionsMenu.vue';
import PatientSummaryPopover from '@/components/patients/summary/PatientSummaryPopover.vue';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useOfflinePatientQueue } from '@/composables/patientsIndex/useOfflinePatientQueue';
import { usePatientList, usePatientStatusCounts, type PatientListItem } from '@/composables/patientsIndex/usePatientList';
import { usePatientListFilters } from '@/composables/patientsIndex/usePatientListFilters';
import { notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

/**
 * Phase 0 (foundation) + Phase 1 (list/filters/status counts) of
 * reports/patients-index-modernization-plan.md.
 *
 * Foundation (Phase 0): usePlatformAccess()-based computed() permission
 * checks, no redundant GET /auth/me/permissions call, <Head>/access-gate/
 * sticky-header-in-bounded-scroll-container conventions matching
 * ShowV2.vue/WorkspaceV2.vue.
 *
 * Phase 1: usePatientList/usePatientStatusCounts/usePatientListFilters —
 * the list table, status counts, and an inline search+gender+sort filter
 * bar. Deliberately simpler than the legacy page's separate "Filters"
 * sheet — inline filters match medical-records/IndexV2.vue's established
 * shape instead of replicating a legacy UI decision this rebuild isn't
 * obligated to keep.
 *
 * Sticky header cards are informational only (ShowV2.vue's mini-stat-card
 * treatment); the active/inactive/all filter is a real Tabs control in the
 * scrolling body (ShowV2.vue's TabsList/TabsTrigger pattern) — the two are
 * deliberately not the same control, per the correction already applied to
 * reception/Queue.vue.
 * Phase 2: registration, via PatientRegistrationSheet.vue — a thin UI
 * layer over usePatientDuplicateCheck/usePatientRegistration, both backed
 * by the server's authoritative PatientDuplicateDetectionService (decided:
 * reports/patients-index-modernization-plan.md's duplicate-scoring
 * question).
 * Phase 4: row actions — View summary/View chart (via PatientSummaryPopover,
 * added when the Patient Summary module shipped), Edit (PatientEditSheet.vue,
 * canUpdatePatients), Change status (PatientStatusDialog.vue,
 * canUpdatePatientStatus).
 *
 * Route remains unlinked (reports/patients-index-modernization-plan.md
 * §3.3): /patients keeps rendering the legacy page until Phase 6.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canReadPatients = computed(() => hasAccess('patients.read'));
const canCreatePatients = computed(() => hasAccess('patients.create'));
const canUpdatePatients = computed(() => hasAccess('patients.update'));
const canUpdatePatientStatus = computed(() => hasAccess('patients.update-status'));
const canShowVisitActions = computed(
    () =>
        (hasAccess('appointments.create') && hasAccess('appointments.update-status')) ||
        hasAccess('service.requests.create') ||
        hasAccess('billing.invoices.create'),
);
const canShowRowActions = computed(() => canUpdatePatients.value || canUpdatePatientStatus.value || canShowVisitActions.value);

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Patients', href: '/patients/v2' },
]);

const filters = usePatientListFilters();
const list = usePatientList(filters);
const statusCounts = usePatientStatusCounts(filters);

const patients = computed(() => list.data.value?.data ?? []);
const meta = computed(() => list.data.value?.meta ?? null);

/**
 * Quick-pick region suggestions for the registration and edit sheets,
 * ranked by frequency in the currently-loaded page. Deliberately reuses data this
 * page already fetches for the table rather than the legacy page's
 * historicalRegionOptionsForCountry(), which bulk-loaded every patient
 * client-side just to mine this same signal (reports/patients-index-audit.md
 * §1) — a real cost for a "recently common" convenience, not an
 * authoritative list.
 */
const suggestedRegions = computed<string[]>(() => {
    const counts = new Map<string, number>();
    for (const patient of patients.value) {
        const region = patient.region?.trim();
        if (!region) continue;
        counts.set(region, (counts.get(region) ?? 0) + 1);
    }
    return Array.from(counts.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6)
        .map(([region]) => region);
});

const genderSelectValue = computed({
    get: () => filters.gender || 'all',
    set: (value: string | number) => {
        filters.gender = value === 'all' ? '' : String(value);
    },
});

function statusTabCount(value: string): number | null {
    const counts = statusCounts.data.value;
    if (!counts) return null;
    if (value === 'active') return counts.active;
    if (value === 'inactive') return counts.inactive;
    return counts.total;
}

function setStatus(value: string | number): void {
    filters.status = value === 'all' ? '' : String(value);
    filters.page = 1;
}

function submitSearch(): void {
    filters.page = 1;
}

function patientName(patient: PatientListItem): string {
    return [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ') || 'Unnamed patient';
}

function patientInitials(patient: PatientListItem): string {
    const first = patient.firstName?.trim()?.[0] ?? '';
    const last = patient.lastName?.trim()?.[0] ?? '';
    return (first + last).toUpperCase() || '?';
}

function statusVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    if (status === 'active') return 'default';
    if (status === 'inactive') return 'outline';
    return 'secondary';
}

function formatDate(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function goToPage(page: number): void {
    if (!meta.value) return;
    filters.page = Math.min(Math.max(page, 1), meta.value.lastPage);
}

const registerSheetOpen = ref(false);
const queryClient = useQueryClient();

function onPatientRegistered(patient: PatientListItem): void {
    void queryClient.invalidateQueries({ queryKey: ['patients-index'] });
    void queryClient.invalidateQueries({ queryKey: ['patients-index-status-counts'] });
    notifySuccess(`${patientName(patient)} registered (${patient.patientNumber ?? 'MRN pending'}).`);
}

const editSheetOpen = ref(false);
const editingPatient = ref<PatientListItem | null>(null);

function openEditSheet(patient: PatientListItem): void {
    editingPatient.value = patient;
    editSheetOpen.value = true;
}

function onPatientUpdated(patient: PatientListItem): void {
    void queryClient.invalidateQueries({ queryKey: ['patients-index'] });
    notifySuccess(`${patientName(patient)} updated.`);
}

const statusDialogOpen = ref(false);
const statusChangingPatient = ref<PatientListItem | null>(null);

function openStatusDialog(patient: PatientListItem): void {
    statusChangingPatient.value = patient;
    statusDialogOpen.value = true;
}

function onPatientStatusChanged(patient: PatientListItem): void {
    void queryClient.invalidateQueries({ queryKey: ['patients-index'] });
    void queryClient.invalidateQueries({ queryKey: ['patients-index-status-counts'] });
    notifySuccess(`${patientName(patient)} is now ${patient.status ?? 'unknown'}.`);
}

/**
 * Surfaces PatientRegistrationSheet.vue's offline-queue outbox at the page
 * level: pendingCount/syncing are shared module-singleton state (see
 * useOfflinePatientQueue.ts), so a patient saved offline from
 * the sheet immediately shows up here without any prop/event plumbing.
 * This composable stays queryClient-agnostic; invalidating the list on a
 * successful sync is this page's job, not the generic queue's.
 */
const offlineQueue = useOfflinePatientQueue();

async function syncOfflineRegistrationsNow(): Promise<void> {
    const result = await offlineQueue.syncNow();
    if (result.synced > 0) {
        void queryClient.invalidateQueries({ queryKey: ['patients-index'] });
        void queryClient.invalidateQueries({ queryKey: ['patients-index-status-counts'] });
        notifySuccess(`${result.synced} offline patient registration(s) uploaded.`);
    }
    if (result.failed > 0) {
        notifyError('Some offline patient registrations need review before they can upload.');
    }
}

// Same bounded-scroll-container pattern as ShowV2.vue/WorkspaceV2.vue/
// patient-flow/Board.vue/reception/Queue.vue.
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
    <Head title="Patients" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">Patients</h1>
                        <p class="text-xs text-muted-foreground">Rebuild in progress — see reports/patients-index-modernization-plan.md.</p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <Badge v-if="meta" variant="secondary">{{ meta.total }} patients</Badge>
                        <Button
                            v-if="offlineQueue.pendingCount.value > 0"
                            size="sm"
                            variant="outline"
                            class="h-8 gap-1.5"
                            :disabled="!offlineQueue.isOnline.value || offlineQueue.syncing.value"
                            @click="syncOfflineRegistrationsNow"
                        >
                            <AppIcon name="refresh-cw" :class="offlineQueue.syncing.value ? 'size-3.5 animate-spin' : 'size-3.5'" />
                            {{ offlineQueue.syncing.value ? 'Syncing…' : `${offlineQueue.pendingCount.value} saved offline` }}
                        </Button>
                        <Button v-if="canCreatePatients" size="sm" class="h-8 gap-1.5" @click="registerSheetOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            Register Patient
                        </Button>
                    </div>
                </div>

                <div v-if="canReadPatients" class="mt-3 grid grid-cols-3 gap-2">
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Active</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusTabCount('active') ?? '—' }}</p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Inactive</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusTabCount('inactive') ?? '—' }}</p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusTabCount('') ?? '—' }}</p>
                    </div>
                </div>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canReadPatients" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing patients requires <code>patients.read</code>.</AlertDescription>
                </Alert>

                <template v-else>
                    <Tabs :model-value="filters.status || 'all'" @update:model-value="setStatus">
                        <TabsList class="grid w-full grid-cols-3">
                            <TabsTrigger value="active" class="inline-flex items-center gap-1.5">
                                Active
                                <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusTabCount('active') ?? '—' }}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="inactive" class="inline-flex items-center gap-1.5">
                                Inactive
                                <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusTabCount('inactive') ?? '—' }}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                                All
                                <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusTabCount('') ?? '—' }}</Badge>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div class="flex flex-wrap items-center gap-2">
                        <div class="relative min-w-0 flex-1">
                            <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                v-model="filters.q"
                                placeholder="Search name, MRN, phone, email, or ID…"
                                class="h-9 pl-9"
                                @keyup.enter="submitSearch"
                            />
                        </div>
                        <Select v-model="genderSelectValue">
                            <SelectTrigger class="h-9 w-40 bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All genders</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                                <SelectItem value="unknown">Unknown</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select v-model="filters.sortBy">
                            <SelectTrigger class="h-9 w-44 bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="createdAt">Newest first</SelectItem>
                                <SelectItem value="updatedAt">Recently updated</SelectItem>
                                <SelectItem value="firstName">First name</SelectItem>
                                <SelectItem value="lastName">Last name</SelectItem>
                                <SelectItem value="patientNumber">MRN</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div v-if="list.isPending.value" class="space-y-2">
                        <Skeleton class="h-14 w-full" />
                        <Skeleton class="h-14 w-full" />
                        <Skeleton class="h-14 w-full" />
                    </div>

                    <Alert v-else-if="list.isError.value" variant="destructive">
                        <AlertTitle>Unable to load patients</AlertTitle>
                        <AlertDescription>{{ (list.error.value as Error | null)?.message ?? 'Unknown error.' }}</AlertDescription>
                    </Alert>

                    <div v-else-if="patients.length === 0" class="rounded-lg border border-dashed px-5 py-5">
                        <p class="text-sm font-medium text-foreground">No patients found</p>
                        <p class="mt-1 text-xs text-muted-foreground">Try adjusting the search query or status filter.</p>
                    </div>

                    <div v-else class="overflow-x-auto rounded-lg border">
                        <table class="w-full text-sm">
                            <thead class="border-b bg-muted/30 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th class="px-3 py-2 text-left">Patient</th>
                                    <th class="px-3 py-2 text-left">Status</th>
                                    <th class="px-3 py-2 text-left">Gender</th>
                                    <th class="px-3 py-2 text-left">Date of birth</th>
                                    <th class="px-3 py-2 text-left">Phone</th>
                                    <th class="px-3 py-2 text-left">Region / District</th>
                                    <th class="px-3 py-2 text-left">Registered</th>
                                    <th v-if="canShowRowActions" class="px-3 py-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="patient in patients" :key="patient.id" class="border-b last:border-b-0 hover:bg-muted/20">
                                    <td class="px-3 py-2">
                                        <div class="flex items-center gap-2.5">
                                            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                                {{ patientInitials(patient) }}
                                            </div>
                                            <div class="min-w-0">
                                                <PatientSummaryPopover :patient-id="patient.id">
                                                    <template #trigger>
                                                        <button type="button" class="truncate text-left font-medium text-foreground hover:underline">
                                                            {{ patientName(patient) }}
                                                        </button>
                                                    </template>
                                                    <template #actions>
                                                        <a :href="`/patients/${patient.id}/chart`" class="text-xs font-medium text-primary hover:underline">
                                                            View chart
                                                        </a>
                                                        <PatientVisitActionsMenu :patient="patient" />
                                                    </template>
                                                </PatientSummaryPopover>
                                                <p class="truncate text-xs text-muted-foreground">{{ patient.patientNumber || 'No MRN assigned' }}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-3 py-2">
                                        <Badge :variant="statusVariant(patient.status)">{{ patient.status || 'unknown' }}</Badge>
                                    </td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ patient.gender || '—' }}</td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ formatDate(patient.dateOfBirth) }}</td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ patient.phone || '—' }}</td>
                                    <td class="px-3 py-2 text-muted-foreground">
                                        {{ [patient.region, patient.district].filter(Boolean).join(' / ') || '—' }}
                                    </td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ formatDate(patient.createdAt) }}</td>
                                    <td v-if="canShowRowActions" class="px-3 py-2">
                                        <div class="flex items-center justify-end gap-1">
                                            <PatientVisitActionsMenu :patient="patient" />
                                            <Button v-if="canUpdatePatients" size="sm" variant="ghost" class="h-7 gap-1 px-2 text-xs" @click="openEditSheet(patient)">
                                                <AppIcon name="pencil" class="size-3.5" />Edit
                                            </Button>
                                            <Button v-if="canUpdatePatientStatus" size="sm" variant="ghost" class="h-7 gap-1 px-2 text-xs" @click="openStatusDialog(patient)">
                                                <AppIcon name="refresh-cw" class="size-3.5" />Status
                                            </Button>
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

        <PatientRegistrationSheet v-model:open="registerSheetOpen" :suggested-regions="suggestedRegions" @registered="onPatientRegistered" />
        <PatientEditSheet v-model:open="editSheetOpen" :patient="editingPatient" :suggested-regions="suggestedRegions" @updated="onPatientUpdated" />
        <PatientStatusDialog v-model:open="statusDialogOpen" :patient="statusChangingPatient" @changed="onPatientStatusChanged" />
    </AppLayout>
</template>
