<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    fetchPatientMedicationSafetySummary,
    type PatientMedicationSafetySummary,
} from '@/lib/encounterInlineOrders';
import { messageFromUnknown } from '@/lib/notify';

const props = defineProps<{
    patientId?: string | null;
    appointmentId?: string | null;
    admissionId?: string | null;
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const summary = ref<PatientMedicationSafetySummary | null>(null);

const blockerCount = computed(() => summary.value?.blockers.length ?? 0);
const warningCount = computed(() => summary.value?.warnings.length ?? 0);
const hasSafetySignals = computed(
    () => blockerCount.value > 0 || warningCount.value > 0,
);
const isVisible = computed(
    () =>
        Boolean((props.patientId ?? '').trim()) &&
        (loading.value || error.value || hasSafetySignals.value),
);

async function loadSummary() {
    const patientId = (props.patientId ?? '').trim();
    if (!patientId) {
        summary.value = null;
        error.value = null;
        loading.value = false;
        return;
    }

    loading.value = true;
    error.value = null;

    try {
        summary.value = await fetchPatientMedicationSafetySummary({
            patientId,
            appointmentId: props.appointmentId,
            admissionId: props.admissionId,
        });
    } catch (loadError) {
        summary.value = null;
        error.value = messageFromUnknown(
            loadError,
            'Unable to load medication safety summary.',
        );
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    void loadSummary();
});

watch(
    () =>
        [
            props.patientId,
            props.appointmentId,
            props.admissionId,
        ] as const,
    () => {
        void loadSummary();
    },
);
</script>

<template>
    <section
        v-if="isVisible"
        class="space-y-3 rounded-lg border bg-background p-4"
    >
        <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="space-y-1">
                <p class="text-sm font-medium">Medication safety</p>
                <p class="text-xs text-muted-foreground">
                    Allergy and interaction signals for this patient in this visit.
                </p>
            </div>
            <div class="flex flex-wrap gap-1.5">
                <Badge
                    v-if="blockerCount > 0"
                    variant="destructive"
                    class="text-[11px]"
                >
                    {{ blockerCount }} blocker{{ blockerCount === 1 ? '' : 's' }}
                </Badge>
                <Badge
                    v-if="warningCount > 0"
                    variant="outline"
                    class="text-[11px]"
                >
                    {{ warningCount }} warning{{ warningCount === 1 ? '' : 's' }}
                </Badge>
            </div>
        </div>

        <div v-if="loading" class="space-y-2">
            <Skeleton class="h-14 w-full rounded-md" />
        </div>

        <Alert v-else-if="error" variant="destructive">
            <AlertTitle>Medication safety unavailable</AlertTitle>
            <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <template v-else-if="summary">
            <Alert v-if="summary.blockers.length > 0" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="shield-alert" class="size-4" />
                    Prescribing blockers
                </AlertTitle>
                <AlertDescription>
                    <ul class="mt-2 list-disc space-y-1 pl-4">
                        <li v-for="blocker in summary.blockers" :key="blocker">
                            {{ blocker }}
                        </li>
                    </ul>
                </AlertDescription>
            </Alert>

            <Alert
                v-if="summary.warnings.length > 0"
                class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
            >
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="triangle-alert" class="size-4" />
                    Review before prescribing
                </AlertTitle>
                <AlertDescription>
                    <ul class="mt-2 list-disc space-y-1 pl-4">
                        <li v-for="warning in summary.warnings" :key="warning">
                            {{ warning }}
                        </li>
                    </ul>
                </AlertDescription>
            </Alert>
        </template>
    </section>
</template>
