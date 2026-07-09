<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { useDebounceFn } from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import ReceptionQueueList from '@/components/reception/ReceptionQueueList.vue';
import {
    useReceptionQueue,
    type ReceptionQueueFilters,
    type ReceptionQueueStage,
} from '@/composables/reception/useReceptionQueue';
import { useWalkInCheckIn, type WalkInArrivalMode } from '@/composables/reception/useWalkInCheckIn';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { apiGet } from '@/lib/apiClient';
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
 * rather than assumed — alongside patient-flow/Board.vue during the
 * duplication/convention audit that also scoped that board down to
 * with_clinician-onward only: this page remains the owner of the
 * waiting_triage/waiting_provider segment. <Head> title, usePlatformAccess()
 * in-page gate, clickable KPI stage-switcher cards inside a sticky header
 * pinned inside a bounded, independently-scrolling container (not
 * page-level scroll) — the walk-in form and queue list can grow long, and
 * the header/stage-switcher should stay visible while scrolling through them.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canReadAppointments = computed(() => hasAccess('appointments.read'));

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Reception queue', href: '/reception/queue' },
]);

const selectedStage = ref<ReceptionQueueStage>('waiting_triage');

// Two independently-pinned queries, not one — this is what makes the KPI
// cards below show both stages' counts at once. TanStack Query dedupes by
// queryKey, so selecting a stage that matches one of these two never
// triggers a third network call: the "current" list just reads whichever
// of these two query objects matches selectedStage.
const triageFilters = reactive<ReceptionQueueFilters>({ stage: 'waiting_triage' });
const providerFilters = reactive<ReceptionQueueFilters>({ stage: 'waiting_provider' });
const triageQueue = useReceptionQueue(triageFilters);
const providerQueue = useReceptionQueue(providerFilters);

const queue = computed(() => (selectedStage.value === 'waiting_triage' ? triageQueue : providerQueue));

const kpis = computed(() => [
    { value: 'waiting_triage' as const, label: 'Waiting for triage', count: triageQueue.data.value?.length ?? null },
    { value: 'waiting_provider' as const, label: 'Waiting for provider', count: providerQueue.data.value?.length ?? null },
]);

function setStage(stage: ReceptionQueueStage): void {
    selectedStage.value = stage;
}

// --- Walk-in registration -------------------------------------------------
// Deliberately inline here rather than a shared component: this is a small,
// self-contained search-and-select, not the full ArrivalHandoffSheet.vue the
// plan describes extracting from patients/Index.vue later.

type PatientSearchResult = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    patientNumber: string | null;
};

const patientQuery = ref('');
const patientResults = ref<PatientSearchResult[]>([]);
const patientSearchPending = ref(false);
const selectedPatient = ref<PatientSearchResult | null>(null);
const arrivalMode = ref<WalkInArrivalMode>('walk_in');
const reason = ref('');

const searchPatients = useDebounceFn(async (query: string) => {
    if (query.trim().length < 2) {
        patientResults.value = [];
        return;
    }

    patientSearchPending.value = true;
    try {
        const response = await apiGet<{ data: PatientSearchResult[] }>('/patients', {
            q: query.trim(),
            perPage: 5,
        });
        patientResults.value = response.data;
    } finally {
        patientSearchPending.value = false;
    }
}, 300);

function onPatientQueryInput(): void {
    selectedPatient.value = null;
    void searchPatients(patientQuery.value);
}

function patientDisplayName(patient: PatientSearchResult): string {
    return [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Unnamed patient';
}

function selectPatient(patient: PatientSearchResult): void {
    selectedPatient.value = patient;
    patientQuery.value = patientDisplayName(patient);
    patientResults.value = [];
}

const walkIn = useWalkInCheckIn();
const canSubmitWalkIn = computed(() => selectedPatient.value !== null && !walkIn.isPending.value);
const queryClient = useQueryClient();

async function submitWalkIn(): Promise<void> {
    if (!selectedPatient.value) return;

    await walkIn.mutateAsync({
        patientId: selectedPatient.value.id,
        arrivalMode: arrivalMode.value,
        reason: reason.value.trim() || null,
    });

    selectedPatient.value = null;
    patientQuery.value = '';
    reason.value = '';
    arrivalMode.value = 'walk_in';
    await queryClient.invalidateQueries({ queryKey: ['reception-queue'] });
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
    <Head title="Reception Queue" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="min-w-0 space-y-0.5">
                    <h1 class="text-lg font-bold tracking-tight md:text-xl">Reception Queue</h1>
                    <p class="text-xs text-muted-foreground">
                        Emergency arrivals first, then scheduled, then walk-in — oldest wait first within each group.
                    </p>
                </div>

                <div v-if="canReadAppointments" class="mt-3 grid grid-cols-2 gap-2 sm:w-96">
                    <button
                        v-for="kpi in kpis"
                        :key="kpi.value"
                        type="button"
                        :class="[
                            'rounded-md px-2.5 py-1.5 text-left transition',
                            selectedStage === kpi.value ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted/30 hover:bg-muted/50',
                        ]"
                        @click="setStage(kpi.value)"
                    >
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{{ kpi.label }}</p>
                        <p class="text-sm font-bold tabular-nums">{{ kpi.count ?? '—' }}</p>
                    </button>
                </div>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canReadAppointments" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing the reception queue requires <code>appointments.read</code>.</AlertDescription>
                </Alert>

                <template v-else>
                    <div class="rounded-lg border bg-card p-3 shadow-sm">
                        <h2 class="text-sm font-medium">Register walk-in</h2>
                        <div class="mt-2 flex flex-wrap items-start gap-2">
                            <div class="relative w-64">
                                <Input
                                    v-model="patientQuery"
                                    placeholder="Search patient by name, MRN, or phone…"
                                    class="h-9"
                                    @update:model-value="onPatientQueryInput"
                                />
                                <ul
                                    v-if="patientResults.length > 0"
                                    class="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md"
                                >
                                    <li
                                        v-for="patient in patientResults"
                                        :key="patient.id"
                                        class="cursor-pointer px-3 py-2 text-sm hover:bg-muted"
                                        @click="selectPatient(patient)"
                                    >
                                        {{ patientDisplayName(patient) }}
                                        <span v-if="patient.patientNumber" class="text-xs text-muted-foreground">
                                            · {{ patient.patientNumber }}
                                        </span>
                                    </li>
                                </ul>
                            </div>

                            <select
                                v-model="arrivalMode"
                                class="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none"
                            >
                                <option value="walk_in">Walk-in (OPD)</option>
                                <option value="emergency">Emergency</option>
                            </select>

                            <Input v-model="reason" placeholder="Reason (optional)" class="h-9 w-56" />

                            <Button :disabled="!canSubmitWalkIn" @click="submitWalkIn">
                                {{ walkIn.isPending.value ? 'Registering…' : 'Check in' }}
                            </Button>
                        </div>

                        <p v-if="selectedPatient" class="mt-2 text-xs text-muted-foreground">
                            Selected: {{ patientDisplayName(selectedPatient) }}
                        </p>
                        <p v-if="walkIn.error.value" class="mt-2 text-sm text-destructive">
                            {{ walkIn.error.value.message }}
                        </p>
                    </div>

                    <div v-if="queue.isPending.value" class="space-y-2">
                        <Skeleton class="h-16 w-full" />
                        <Skeleton class="h-16 w-full" />
                    </div>

                    <Alert v-else-if="queue.isError.value" variant="destructive">
                        <AlertTitle>Unable to load the queue</AlertTitle>
                        <AlertDescription>
                            {{ queue.error.value?.message ?? 'Unknown error.' }}
                        </AlertDescription>
                    </Alert>

                    <ReceptionQueueList v-else :entries="queue.data.value ?? []" />
                </template>
            </div>
        </div>
    </AppLayout>
</template>
