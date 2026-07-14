<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { type PatientSummaryDetails } from '@/composables/patientSummary/usePatientSummary';
import { deriveAgeFromDateOfBirth, formatAgeLabel } from '@/lib/patientAge';

/**
 * Pure presentation — reports/patient-summary-module-plan.md §4. No
 * fetching of its own; the consumer wires usePatientSummary() (directly,
 * or via PatientSummaryPopover.vue) and passes the result in. The `actions`
 * slot is this component's only extension point, matching
 * RegistryListRow.vue's established pattern ($slots.actions gating rather
 * than a fixed prop-driven action list) — a consuming page decides what
 * "quick actions" mean for it (view chart, start encounter, etc.), this
 * component doesn't know or guess.
 *
 * Deliberately does not render deep history (full encounter list, lab/
 * imaging history, documents, audit log) — that's patients/chart/ShowV2.vue's
 * job. This is "enough to decide what to do next," not the chart itself.
 */
const props = defineProps<{
    summary: PatientSummaryDetails | null;
    isPending?: boolean;
    error?: Error | null;
}>();

const emit = defineEmits<{
    expand: [];
}>();

defineSlots<{
    actions?: () => unknown;
}>();

const patientName = computed(() => {
    const patient = props.summary?.patient;
    if (!patient) return '';
    return [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ') || 'Unnamed patient';
});

const patientInitials = computed(() => {
    const patient = props.summary?.patient;
    const first = patient?.firstName?.trim()?.[0] ?? '';
    const last = patient?.lastName?.trim()?.[0] ?? '';
    return (first + last).toUpperCase() || '?';
});

const ageLabel = computed(() => {
    const dob = props.summary?.patient.dateOfBirth;
    if (!dob) return null;
    const age = deriveAgeFromDateOfBirth(dob);
    return age ? formatAgeLabel(age) : null;
});

function statusVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    if (status === 'active') return 'default';
    if (status === 'inactive') return 'outline';
    return 'secondary';
}

function severityVariant(severity: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    if (severity === 'severe' || severity === 'life_threatening') return 'destructive';
    if (severity === 'moderate') return 'default';
    return 'secondary';
}

const WORKFLOW_STEP_LABELS: Record<string, string> = {
    waiting_triage: 'Waiting triage',
    in_triage: 'In triage',
    waiting_clinician: 'Waiting clinician',
    waiting_clinician_review: 'Waiting clinician review',
    with_clinician: 'With clinician',
    waiting_lab: 'Waiting lab',
    waiting_imaging: 'Waiting imaging',
    waiting_lab_and_imaging: 'Waiting lab and imaging',
    in_lab: 'In lab',
    in_imaging: 'In imaging',
    in_lab_and_imaging: 'In lab and imaging',
    waiting_pharmacy: 'Waiting pharmacy',
    waiting_direct_service: 'Waiting direct service',
    in_direct_service: 'In direct service',
};

function workflowStepLabel(step: string): string {
    return WORKFLOW_STEP_LABELS[step] ?? step;
}

function formatDate(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

const activeOrdersTotal = computed(() => {
    const orders = props.summary?.activeOrders;
    if (!orders) return 0;
    return orders.labActive + orders.pharmacyActive + orders.imagingActive + orders.procedureActive;
});
</script>

<template>
    <div class="w-80 max-w-full space-y-3 p-3">
        <div v-if="isPending" class="space-y-2">
            <Skeleton class="h-5 w-2/3" />
            <Skeleton class="h-4 w-1/2" />
            <Skeleton class="h-16 w-full" />
        </div>

        <Alert v-else-if="error" variant="destructive">
            <AlertTitle>Unable to load patient summary</AlertTitle>
            <AlertDescription>{{ error.message }}</AlertDescription>
        </Alert>

        <template v-else-if="summary">
            <div class="flex items-start justify-between gap-2">
                <div class="flex min-w-0 items-center gap-2.5">
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {{ patientInitials }}
                    </div>
                    <div class="min-w-0">
                        <p class="truncate text-sm font-semibold text-foreground">{{ patientName }}</p>
                        <p class="truncate text-xs text-muted-foreground">{{ summary.patient.patientNumber || 'No MRN assigned' }}</p>
                    </div>
                </div>
                <Badge :variant="statusVariant(summary.patient.status)" class="shrink-0">{{ summary.patient.status || 'unknown' }}</Badge>
            </div>

            <p class="text-xs text-muted-foreground">
                {{ [summary.patient.gender, ageLabel, summary.patient.phone].filter(Boolean).join(' · ') || 'No demographic details' }}
            </p>

            <div v-if="summary.workflowStatus" class="flex items-center gap-1.5 rounded-md bg-muted/30 px-2.5 py-1.5">
                <AppIcon name="activity" class="size-3.5 text-muted-foreground" />
                <span class="text-xs font-medium">{{ workflowStepLabel(summary.workflowStatus.step) }}</span>
                <span v-if="summary.workflowStatus.department" class="text-xs text-muted-foreground">· {{ summary.workflowStatus.department }}</span>
            </div>

            <div v-if="summary.alerts.length > 0" class="space-y-1">
                <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Alerts</p>
                <div class="flex flex-wrap gap-1">
                    <Badge
                        v-for="alert in summary.alerts"
                        :key="alert.id"
                        :variant="severityVariant(alert.severity)"
                        class="gap-1"
                    >
                        <AppIcon name="alert-triangle" class="size-3" />
                        {{ alert.substanceName || 'Unknown substance' }}
                    </Badge>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                    <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Latest visit</p>
                    <p v-if="summary.latestEncounter" class="font-medium">{{ formatDate(summary.latestEncounter.openedAt) }}</p>
                    <p v-else class="text-muted-foreground">None on record</p>
                </div>
                <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                    <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Active orders</p>
                    <p class="font-medium">{{ activeOrdersTotal }}</p>
                </div>
            </div>

            <div v-if="summary.insurance" class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AppIcon name="shield-check" class="size-3.5" />
                <span>{{ summary.insurance.insuranceProvider || summary.insurance.insuranceType || 'Insured' }}</span>
                <Badge v-if="summary.insurance.verificationStatus" variant="outline" class="text-[10px]">
                    {{ summary.insurance.verificationStatus }}
                </Badge>
            </div>

            <div class="flex items-center justify-between gap-1.5 border-t pt-2">
                <button type="button" class="text-xs font-medium text-primary hover:underline" @click="emit('expand')">
                    View full summary
                </button>
                <div v-if="$slots.actions" class="flex items-center gap-1.5">
                    <slot name="actions" />
                </div>
            </div>
        </template>
    </div>
</template>
