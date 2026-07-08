<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { useDebounceFn } from '@vueuse/core';
import { computed, ref } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import ReceptionQueueList from '@/components/reception/ReceptionQueueList.vue';
import {
    useReceptionQueue,
    useReceptionQueueFilters,
    type ReceptionQueueStage,
} from '@/composables/reception/useReceptionQueue';
import { useWalkInCheckIn, type WalkInArrivalMode } from '@/composables/reception/useWalkInCheckIn';
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
 */
const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Reception queue', href: '/reception/queue' },
]);

const filters = useReceptionQueueFilters();
const queue = useReceptionQueue(filters);
const queryClient = useQueryClient();

const stageOptions: { value: ReceptionQueueStage; label: string }[] = [
    { value: 'waiting_triage', label: 'Waiting for triage' },
    { value: 'waiting_provider', label: 'Waiting for provider' },
];

function setStage(stage: ReceptionQueueStage): void {
    filters.stage = stage;
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
</script>

<template>
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-4 p-4 md:p-6">
            <div>
                <h1 class="text-lg font-semibold tracking-tight">Reception queue</h1>
                <p class="text-sm text-muted-foreground">
                    Emergency arrivals first, then scheduled, then walk-in — oldest wait first within each group.
                </p>
            </div>

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

            <div class="flex flex-wrap gap-2">
                <button
                    v-for="option in stageOptions"
                    :key="option.value"
                    type="button"
                    class="rounded-md border px-3 py-1.5 text-sm transition-colors"
                    :class="
                        filters.stage === option.value
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                    "
                    @click="setStage(option.value)"
                >
                    {{ option.label }}
                </button>
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
        </div>
    </AppLayout>
</template>
