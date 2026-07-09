<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { usePatientSummary } from '@/composables/patientSummary/usePatientSummary';
import { type AppIconName } from '@/lib/icons';
import { deriveAgeFromDateOfBirth, formatAgeLabel } from '@/lib/patientAge';

/**
 * The second, deliberate-click tier of the reusable Patient Summary module
 * (reports/patient-summary-module-plan.md's Sheet follow-up) — richer than
 * PatientSummaryCard.vue's glanceable Popover, still deliberately short of
 * patients/chart/ShowV2.vue's full deep history (complete encounter list,
 * lab/imaging history, documents, audit log stay there). A hover/click
 * popover is the wrong mechanism for this much information — hover is
 * unreliable on touch and accidental on desktop, so more detail belongs
 * behind an intentional click, which is exactly what a Sheet is for.
 *
 * Same usePatientSummary() query as the Popover tier (same queryKey), so
 * opening this right after the Popover for the same patient is a cache
 * hit, not a second request.
 *
 * Owns its own fetch (unlike PatientSummaryCard.vue, which is pure
 * presentational) so it works standalone too — a page can open this
 * directly without going through the Popover first.
 */
const props = defineProps<{
    patientId: string | null;
}>();

const open = defineModel<boolean>('open', { required: true });

defineSlots<{
    actions?: () => unknown;
}>();

const patientId = computed(() => props.patientId);
const summary = usePatientSummary(patientId, { enabled: open });

const patientName = computed(() => {
    const patient = summary.data.value?.patient;
    if (!patient) return '';
    return [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ') || 'Unnamed patient';
});

const patientInitials = computed(() => {
    const patient = summary.data.value?.patient;
    const first = patient?.firstName?.trim()?.[0] ?? '';
    const last = patient?.lastName?.trim()?.[0] ?? '';
    return (first + last).toUpperCase() || '?';
});

const ageLabel = computed(() => {
    const dob = summary.data.value?.patient.dateOfBirth;
    if (!dob) return null;
    const age = deriveAgeFromDateOfBirth(dob);
    return age ? formatAgeLabel(age) : null;
});

function statusVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    if (status === 'active') return 'default';
    if (status === 'inactive') return 'outline';
    if (status === 'deceased') return 'destructive';
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
    in_lab: 'In lab',
    waiting_pharmacy: 'Waiting pharmacy',
    waiting_direct_service: 'Waiting direct service',
    in_direct_service: 'In direct service',
};

function workflowStepLabel(step: string): string {
    return WORKFLOW_STEP_LABELS[step] ?? step;
}

const ACTIVITY_ICONS: Record<string, AppIconName> = {
    encounter: 'stethoscope',
    laboratory: 'flask-conical',
    pharmacy: 'pill',
    billing: 'receipt',
};

function activityIcon(type: string | null): AppIconName {
    return ACTIVITY_ICONS[type ?? ''] ?? 'activity';
}

function formatDate(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
        date,
    );
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="workspace" size="lg">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>Patient summary</SheetTitle>
                <SheetDescription>Enough context to decide what's next — full history lives on the patient chart.</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <div v-if="summary.isPending.value" class="space-y-3">
                    <Skeleton class="h-8 w-2/3" />
                    <Skeleton class="h-4 w-1/2" />
                    <Skeleton class="h-24 w-full" />
                    <Skeleton class="h-24 w-full" />
                </div>

                <Alert v-else-if="summary.error.value" variant="destructive">
                    <AlertTitle>Unable to load patient summary</AlertTitle>
                    <AlertDescription>{{ (summary.error.value as Error).message }}</AlertDescription>
                </Alert>

                <template v-else-if="summary.data.value">
                    <!-- Identity -->
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex min-w-0 items-center gap-3">
                            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                {{ patientInitials }}
                            </div>
                            <div class="min-w-0">
                                <p class="truncate text-base font-semibold text-foreground">{{ patientName }}</p>
                                <p class="text-xs text-muted-foreground">
                                    {{ summary.data.value.patient.patientNumber || 'No MRN assigned' }}
                                    <span v-if="ageLabel"> · {{ ageLabel }}</span>
                                    <span v-if="summary.data.value.patient.gender"> · {{ summary.data.value.patient.gender }}</span>
                                </p>
                            </div>
                        </div>
                        <Badge :variant="statusVariant(summary.data.value.patient.status)" class="shrink-0">
                            {{ summary.data.value.patient.status || 'unknown' }}
                        </Badge>
                    </div>

                    <!-- Contact -->
                    <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border bg-muted/20 p-3 text-xs">
                        <div class="col-span-2 flex items-center gap-1.5 text-muted-foreground">
                            <AppIcon name="phone" class="size-3.5" />
                            {{ summary.data.value.patient.phone || 'No phone on file' }}
                        </div>
                        <div v-if="summary.data.value.contact.email" class="col-span-2 flex items-center gap-1.5 text-muted-foreground">
                            <AppIcon name="mail" class="size-3.5" />
                            {{ summary.data.value.contact.email }}
                        </div>
                        <div v-if="summary.data.value.contact.addressLine" class="col-span-2 flex items-center gap-1.5 text-muted-foreground">
                            <AppIcon name="map-pin" class="size-3.5" />
                            {{ [summary.data.value.contact.addressLine, summary.data.value.patient.district, summary.data.value.patient.region].filter(Boolean).join(', ') }}
                        </div>
                        <div v-if="summary.data.value.contact.nextOfKinName" class="col-span-2 flex items-center gap-1.5 text-muted-foreground">
                            <AppIcon name="user" class="size-3.5" />
                            Next of kin: {{ summary.data.value.contact.nextOfKinName }}
                            <span v-if="summary.data.value.contact.nextOfKinPhone">({{ summary.data.value.contact.nextOfKinPhone }})</span>
                        </div>
                    </div>

                    <!-- Alerts -->
                    <div v-if="summary.data.value.alerts.length > 0" class="space-y-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Alerts</p>
                        <div class="flex flex-wrap gap-1.5">
                            <Badge
                                v-for="alert in summary.data.value.alerts"
                                :key="alert.id"
                                :variant="severityVariant(alert.severity)"
                                class="gap-1"
                            >
                                <AppIcon name="alert-triangle" class="size-3" />
                                {{ alert.substanceName || 'Unknown substance' }}
                                <span v-if="alert.reaction" class="font-normal opacity-80">— {{ alert.reaction }}</span>
                            </Badge>
                        </div>
                    </div>

                    <!-- Current admission (urgent context, shown prominently) -->
                    <Alert v-if="summary.data.value.currentAdmission" class="border-amber-500/40 bg-amber-500/10">
                        <AlertTitle class="flex items-center gap-1.5">
                            <AppIcon name="bed-double" class="size-3.5" />
                            Currently admitted
                        </AlertTitle>
                        <AlertDescription>
                            {{ summary.data.value.currentAdmission.ward || 'Ward not set' }}, bed {{ summary.data.value.currentAdmission.bed || '—' }}
                            · since {{ formatDateTime(summary.data.value.currentAdmission.admittedAt) }}
                        </AlertDescription>
                    </Alert>

                    <!-- Active workflow status -->
                    <div v-if="summary.data.value.workflowStatus" class="flex items-center gap-1.5 rounded-md bg-muted/30 px-2.5 py-1.5 text-xs">
                        <AppIcon name="activity" class="size-3.5 text-muted-foreground" />
                        <span class="font-medium">{{ workflowStepLabel(summary.data.value.workflowStatus.step) }}</span>
                        <span v-if="summary.data.value.workflowStatus.department" class="text-muted-foreground">
                            · {{ summary.data.value.workflowStatus.department }}
                        </span>
                    </div>

                    <!-- Upcoming appointment -->
                    <div v-if="summary.data.value.upcomingAppointment" class="rounded-lg border p-3 text-xs">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Upcoming appointment</p>
                        <p class="mt-1 font-medium">{{ formatDateTime(summary.data.value.upcomingAppointment.scheduledAt) }}</p>
                        <p class="text-muted-foreground">
                            {{ [summary.data.value.upcomingAppointment.department, summary.data.value.upcomingAppointment.reason].filter(Boolean).join(' · ') || 'No details' }}
                        </p>
                    </div>

                    <!-- Latest encounter -->
                    <div class="rounded-lg border p-3 text-xs">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Last visit</p>
                        <template v-if="summary.data.value.latestEncounter">
                            <p class="mt-1 font-medium">{{ formatDate(summary.data.value.latestEncounter.openedAt) }}</p>
                            <p class="text-muted-foreground">
                                {{ summary.data.value.latestEncounter.encounterNumber }} · {{ summary.data.value.latestEncounter.status }}
                            </p>
                        </template>
                        <p v-else class="mt-1 text-muted-foreground">No visits on record</p>
                    </div>

                    <!-- Insurance -->
                    <div v-if="summary.data.value.insurance" class="flex items-center gap-1.5 rounded-md bg-muted/30 px-2.5 py-1.5 text-xs">
                        <AppIcon name="shield-check" class="size-3.5 text-muted-foreground" />
                        <span class="font-medium">{{ summary.data.value.insurance.insuranceProvider || summary.data.value.insurance.insuranceType || 'Insured' }}</span>
                        <span v-if="summary.data.value.insurance.memberId" class="text-muted-foreground">· {{ summary.data.value.insurance.memberId }}</span>
                        <Badge v-if="summary.data.value.insurance.verificationStatus" variant="outline" class="ml-auto text-[10px]">
                            {{ summary.data.value.insurance.verificationStatus }}
                        </Badge>
                    </div>

                    <!-- Quick statistics -->
                    <div class="grid grid-cols-3 gap-2">
                        <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Visits</p>
                            <p class="text-sm font-bold tabular-nums">{{ summary.data.value.stats.totalVisits }}</p>
                        </div>
                        <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Encounters</p>
                            <p class="text-sm font-bold tabular-nums">{{ summary.data.value.stats.totalEncounters }}</p>
                        </div>
                        <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Outstanding</p>
                            <p class="text-sm font-bold tabular-nums">{{ summary.data.value.stats.outstandingInvoices }}</p>
                        </div>
                    </div>

                    <!-- Recent activity -->
                    <div v-if="summary.data.value.recentActivity.length > 0" class="space-y-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Recent activity</p>
                        <ul class="space-y-1.5">
                            <li
                                v-for="(entry, index) in summary.data.value.recentActivity"
                                :key="index"
                                class="flex items-center gap-2 text-xs"
                            >
                                <AppIcon :name="activityIcon(entry.type)" class="size-3.5 shrink-0 text-muted-foreground" />
                                <span class="min-w-0 flex-1 truncate">{{ entry.label }}</span>
                                <span class="shrink-0 text-muted-foreground">{{ formatDate(entry.occurredAt) }}</span>
                            </li>
                        </ul>
                    </div>
                </template>
            </div>

            <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <slot name="actions" />
            </div>
        </SheetContent>
    </Sheet>
</template>
