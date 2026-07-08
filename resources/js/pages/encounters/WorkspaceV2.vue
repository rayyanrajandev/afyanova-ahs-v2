<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import NoteComposerShell from '@/components/clinical/note-composer/NoteComposerShell.vue';
import EncounterOrdersCommandCenter from '@/components/domain/clinical/EncounterOrdersCommandCenter.vue';
import EncounterWorkflowCareStreams from '@/components/domain/clinical/EncounterWorkflowCareStreams.vue';
import EncounterLifecycleDialog from '@/components/domain/clinical/EncounterLifecycleDialog.vue';
import EncounterCloseChecklistDialog from '@/components/domain/clinical/EncounterCloseChecklistDialog.vue';
import EncounterHistorySheet from '@/components/clinical/panels/EncounterHistorySheet.vue';
import TheatreInlineOrderForm from '@/components/clinical/panels/TheatreInlineOrderForm.vue';
import { useEncounterWorkspace } from '@/composables/useEncounterWorkspace';
import { usePermissions } from '@/composables/usePermissions';
import {
    formatDateTime,
    useEncounterOrdering,
} from '@/composables/clinical/useEncounterOrdering';
import { useEncounterClose } from '@/composables/clinical/useEncounterClose';
import { useEncounterDiagnoses } from '@/composables/clinical/useEncounterDiagnoses';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { medicalRecordNoteTypeLabel } from '@/pages/medical-records/noteTypes';
import { formatEnumLabel } from '@/lib/labels';
import type {
    EncounterCareLaboratoryOrder,
    EncounterCarePharmacyOrder,
    EncounterCareRadiologyOrder,
    EncounterCareTheatreProcedure,
} from '@/lib/encounterWorkspaceCare';
import { type EncounterCloseReadiness } from '@/lib/encounterCloseReadiness';
import { type MedicalRecordResponse } from '@/types/medicalRecord';
import { type BreadcrumbItem } from '@/types';

/**
 * Rebuild preview page (reports/clinical-notes-frontend-rebuild-plan.md).
 * Phase 1 proved the foundation end-to-end; Phase 2 added the real note
 * composer; Phase 3 adds ordering. Ordering reuses the existing, proven
 * EncounterOrdersCommandCenter / EncounterInlineOrderPanel /
 * EncounterWorkflowCareStreams / EncounterLifecycleDialog components as-is
 * (see useEncounterOrdering.ts) rather than rebuilding them — investigation
 * found they were already modern and well-isolated, unlike the note composer
 * this page replaced. Reachable only via /encounters/{id}/v2 when
 * FRONTEND_WORKSPACE_V2_ENABLED=true; the existing encounters/{id} Workspace
 * page is completely unaffected.
 */
const props = defineProps<{
    encounterId: string;
}>();

const workspace = useEncounterWorkspace(computed(() => props.encounterId));
const permissions = usePermissions();

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Encounters', href: '/medical-records' },
    {
        title: 'Note & Orders',
        href: `/encounters/${props.encounterId}/v2`,
    },
]);

const encounterStatus = computed(
    () =>
        (workspace.data.value?.encounter?.status as string | undefined) ??
        'unknown',
);

const patientId = computed(
    () =>
        (workspace.data.value?.encounter?.patientId as string | undefined) ??
        '',
);

const patientSummary = computed(() => workspace.data.value?.patient ?? null);
const patientName = computed(() => {
    const patient = patientSummary.value;
    if (!patient) return null;

    return (
        [patient.firstName, patient.middleName, patient.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || null
    );
});

/** Matches the "gender | DOB (age y)" convention already used in PatientLookupField.vue. */
function ageFromDateOfBirth(value: string | null | undefined): number | null {
    if (!value) return null;

    const dob = new Date(value);
    if (Number.isNaN(dob.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const dayDiff = today.getDate() - dob.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age -= 1;
    }

    return age >= 0 ? age : null;
}

const patientDemographics = computed(() => {
    const patient = patientSummary.value;
    if (!patient) return null;

    const parts: string[] = [];
    if (patient.gender) parts.push(patient.gender);

    const age = ageFromDateOfBirth(patient.dateOfBirth);
    if (patient.dateOfBirth && age !== null) {
        parts.push(`${patient.dateOfBirth} (${age}y)`);
    } else if (patient.dateOfBirth) {
        parts.push(patient.dateOfBirth);
    }

    if (patient.patientNumber) parts.push(patient.patientNumber);

    return parts.length > 0 ? parts.join(' · ') : null;
});
const appointmentId = computed(
    () =>
        (workspace.data.value?.encounter?.appointmentId as
            | string
            | null
            | undefined) ?? null,
);
const admissionId = computed(
    () =>
        (workspace.data.value?.encounter?.admissionId as
            | string
            | null
            | undefined) ?? null,
);
const existingRecord = computed<MedicalRecordResponse | null>(
    () =>
        (workspace.data.value
            ?.primaryMedicalRecord as MedicalRecordResponse | null) ?? null,
);

const encounterType = computed(
    () =>
        (workspace.data.value?.encounter?.type as string | null | undefined) ??
        null,
);
const encounterDisposition = computed(
    () =>
        (workspace.data.value?.encounter?.disposition as
            | string
            | null
            | undefined) ?? null,
);

/** Admission-based encounters show ward/bed; appointment-based ones show department — no dedicated Location entity exists (see reports/patient-chart-rebuild-plan.md's Encounter entity follow-on work). */
const locationLabel = computed(() => {
    const admission = workspace.data.value?.admission;
    if (admission && (admission.ward || admission.bed)) {
        return [admission.ward, admission.bed].filter(Boolean).join(', Bed ');
    }

    const department = workspace.data.value?.appointment?.department as
        | string
        | null
        | undefined;
    return department ?? null;
});

const diagnoses = computed(() => workspace.data.value?.diagnoses ?? []);
const canManageDiagnoses = computed(() => permissions.has('medical.records.create'));

const encounterDiagnoses = useEncounterDiagnoses(
    () => props.encounterId,
    () => void workspace.refetch(),
);

const laboratoryOrders = computed(
    () =>
        (workspace.data.value?.laboratoryOrders ??
            []) as EncounterCareLaboratoryOrder[],
);
const pharmacyOrders = computed(
    () =>
        (workspace.data.value?.pharmacyOrders ??
            []) as EncounterCarePharmacyOrder[],
);
const radiologyOrders = computed(
    () =>
        (workspace.data.value?.radiologyOrders ??
            []) as EncounterCareRadiologyOrder[],
);
const theatreProcedures = computed(
    () =>
        (workspace.data.value?.theatreProcedures ??
            []) as EncounterCareTheatreProcedure[],
);

const ordering = useEncounterOrdering({
    encounterId: () => props.encounterId,
    patientId: () => patientId.value,
    appointmentId: () => appointmentId.value,
    admissionId: () => admissionId.value,
    isLoading: () => workspace.isPending.value,
    loadError: () =>
        workspace.isError.value
            ? (workspace.error.value?.message ?? 'Unable to load orders.')
            : null,
    laboratoryOrders: () => laboratoryOrders.value,
    pharmacyOrders: () => pharmacyOrders.value,
    radiologyOrders: () => radiologyOrders.value,
    theatreProcedures: () => theatreProcedures.value,
    onOrderChanged: () => void workspace.refetch(),
});

const theatreInlineOrderOpen = ref(false);
const theatreInlineOrderContext = computed(() => ({
    patientId: patientId.value,
    appointmentId: appointmentId.value ?? undefined,
    admissionId: admissionId.value ?? undefined,
}));

function handleTheatreInlineOrderCreated(): void {
    theatreInlineOrderOpen.value = false;
    ordersTab.value = 'streams';
    void workspace.refetch();
}

/**
 * Orders pane sub-tab (reports/clinical-notes-frontend-rebuild-plan.md
 * layout plan, step 5): "Place order" hosts the command center + inline
 * forms, "Order streams" shows what's already linked. Opening any inline
 * form switches here to "place" so the form is actually visible regardless
 * of which sub-tab triggered it (e.g. a reorder/add-on action from an order
 * row in "Order streams"); a successful creation switches back to "streams"
 * so the new order shows up where the user can see it, matching the old
 * page's own convention of focusing the relevant stream after placing an
 * order.
 */
const ordersTab = ref<'place' | 'streams'>('place');

function openInlineOrder(
    type: Parameters<typeof ordering.openInlineOrder>[0],
    linkage?: Parameters<typeof ordering.openInlineOrder>[1],
): void {
    ordering.openInlineOrder(type, linkage);
    ordersTab.value = 'place';
}

function handleInlineOrderCreated(
    type: Parameters<typeof ordering.handleInlineOrderCreated>[0],
): void {
    ordering.handleInlineOrderCreated(type);
    ordersTab.value = 'streams';
}

function openTheatreInline(): void {
    theatreInlineOrderOpen.value = true;
    ordersTab.value = 'place';
}

const noteComposerRef =
    useTemplateRef<InstanceType<typeof NoteComposerShell>>('noteComposer');
const activeRecord = computed<MedicalRecordResponse | null>(
    () => noteComposerRef.value?.activeRecord ?? null,
);
const activeRecordId = computed(() => activeRecord.value?.id ?? null);
const draftBannerDismissed = ref(false);
const showResumedDraftBanner = computed(
    () =>
        !draftBannerDismissed.value &&
        (noteComposerRef.value?.resumedExistingDraft ?? false),
);
const canAttestMedicalRecords = computed(() =>
    permissions.has('medical.records.attest'),
);
const canAttestActiveRecord = computed(
    () =>
        canAttestMedicalRecords.value &&
        ['finalized', 'amended'].includes(activeRecord.value?.status ?? ''),
);
const canViewAuditLogs = computed(() =>
    permissions.has('medical-records.view-audit-logs'),
);

const closeReadiness = computed<EncounterCloseReadiness | null>(
    () =>
        (workspace.data.value?.closeReadiness as
            | EncounterCloseReadiness
            | undefined) ?? null,
);
const encounterClose = useEncounterClose({
    encounterId: () => props.encounterId,
    readiness: () => closeReadiness.value,
    appointmentId: () => appointmentId.value,
    canCompleteAppointmentVisit: () =>
        permissions.has('appointments.manage-provider-session'),
    onClosed: () => void workspace.refetch(),
});
const canCloseEncounter = computed(
    () =>
        permissions.has('medical.records.finalize') &&
        encounterStatus.value !== 'closed' &&
        ['finalized', 'amended'].includes(activeRecord.value?.status ?? ''),
);
const closeButtonDisabledReason = computed<string | null>(() => {
    if (canCloseEncounter.value) return null;
    if (encounterStatus.value === 'closed')
        return 'This encounter is already closed.';
    if (!['finalized', 'amended'].includes(activeRecord.value?.status ?? '')) {
        return 'Finalize or amend the consultation note before closing this encounter.';
    }
    return null;
});

const encounterStatusVariant = computed(() => {
    switch (encounterStatus.value) {
        case 'closed':
            return 'secondary' as const;
        case 'cancelled':
            return 'destructive' as const;
        default:
            return 'outline' as const;
    }
});

/** Matches the status→variant convention used across the note composer and the old page's statusVariant(). */
const noteStatusVariant = computed(() => {
    switch (activeRecord.value?.status) {
        case 'finalized':
            return 'default' as const;
        case 'amended':
            return 'secondary' as const;
        case 'archived':
            return 'destructive' as const;
        default:
            return 'outline' as const;
    }
});

/**
 * A simple pass/total ratio over the close-readiness checklist items, purely
 * for the header's at-a-glance progress bar — not a substitute for the
 * checklist dialog's actual blocking/warning distinction.
 */
const closeReadinessPercent = computed(() => {
    const readiness = closeReadiness.value;
    if (!readiness) return 0;
    if (!readiness.items.length) return readiness.canClose ? 100 : 0;

    const passed = readiness.items.filter(
        (item) => item.status === 'pass',
    ).length;
    return Math.round((passed / readiness.items.length) * 100);
});
const closeReadinessBarClass = computed(() => {
    const readiness = closeReadiness.value;
    if (!readiness) return 'bg-muted-foreground/40';
    if (readiness.blockingCount > 0) return 'bg-destructive';
    if (readiness.requiresAcknowledgement) return 'bg-amber-500';
    return 'bg-emerald-500';
});

/**
 * Two-pane workspace focus (reports/clinical-notes-frontend-rebuild-plan.md
 * layout plan, step 2). At the xl breakpoint and above both panes always
 * show side by side regardless of this value — the toggle only matters
 * below that, where there's room for one pane at a time. Panes stay
 * mounted (hidden via class, not v-if) so NoteComposerShell's autosave
 * state/timers never get torn down by switching focus.
 */
type WorkspacePaneFocus = 'note' | 'split' | 'orders';
const paneFocus = ref<WorkspacePaneFocus>('split');
const notePaneClass = computed(() =>
    paneFocus.value === 'orders' ? 'hidden xl:block' : '',
);
const ordersPaneClass = computed(() =>
    paneFocus.value === 'note' ? 'hidden xl:block' : '',
);

const historyOpen = ref(false);
const historyTab = ref('versions');

/**
 * The shared app shell (AppSidebarLayout.vue) never bounds its content area
 * to the viewport — it grows with content and lets the window scroll, so
 * there's no ancestor this page can lean on for a real scroll container.
 * Hardcoding a height like `calc(100dvh - 4rem)` assumes nothing else (e.g.
 * the facility subscription banner) renders above this page, which isn't
 * always true and produces a double scrollbar when it's wrong. Measuring
 * this element's actual distance from the top of the viewport avoids that
 * assumption entirely — the height is always exactly "the rest of the
 * viewport", regardless of what renders above it.
 */
const scrollContainerRef = useTemplateRef<HTMLDivElement>('scrollContainer');
const scrollContainerHeight = ref('100dvh');

function updateScrollContainerHeight(): void {
    const el = scrollContainerRef.value;
    if (!el) return;
    scrollContainerHeight.value = `calc(100dvh - ${el.getBoundingClientRect().top}px)`;
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
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div
                v-if="workspace.data.value"
                class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            >
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <div
                            v-if="patientName"
                            class="flex flex-wrap items-baseline gap-2"
                        >
                            <h1
                                class="text-lg font-bold tracking-tight md:text-xl"
                            >
                                {{ patientName }}
                            </h1>
                            <span
                                v-if="patientDemographics"
                                class="text-xs text-muted-foreground"
                                >{{ patientDemographics }}</span
                            >
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            <component
                                :is="patientName ? 'p' : 'h1'"
                                :class="
                                    patientName
                                        ? 'text-sm font-medium text-muted-foreground md:text-base'
                                        : 'text-base font-semibold tracking-tight md:text-lg'
                                "
                            >
                                Encounter
                                {{
                                    workspace.data.value.encounter
                                        ?.encounterNumber
                                }}
                            </component>
                            <Badge :variant="encounterStatusVariant">{{
                                encounterStatus
                            }}</Badge>
                        </div>
                        <div
                            v-if="activeRecord"
                            class="flex flex-wrap items-center gap-2"
                        >
                            <p class="text-sm font-medium text-foreground">
                                {{
                                    medicalRecordNoteTypeLabel(
                                        activeRecord.recordType,
                                    )
                                }}
                                <span
                                    v-if="activeRecord.recordNumber"
                                    class="font-normal text-muted-foreground"
                                    >· {{ activeRecord.recordNumber }}</span
                                >
                            </p>
                            <Badge
                                :variant="noteStatusVariant"
                                class="text-[10px]"
                                >{{ activeRecord.status }}</Badge
                            >
                        </div>
                        <p v-else class="text-sm text-muted-foreground">
                            No clinical note started yet
                        </p>
                        <p class="text-xs text-muted-foreground">
                            {{
                                closeReadiness?.canClose
                                    ? 'Ready to close'
                                    : 'Not ready to close yet'
                            }}
                        </p>
                    </div>
                    <div class="flex shrink-0 flex-wrap items-center gap-2">
                        <TooltipProvider :delay-duration="150">
                            <Tooltip>
                                <TooltipTrigger as-child>
                                    <span tabindex="0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            :disabled="!activeRecordId"
                                            @click="historyOpen = true"
                                        >
                                            History
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent v-if="!activeRecordId">
                                    Save the note first.
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider
                            v-if="permissions.has('medical.records.finalize')"
                            :delay-duration="150"
                        >
                            <Tooltip>
                                <TooltipTrigger as-child>
                                    <span tabindex="0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            :disabled="!canCloseEncounter"
                                            @click="
                                                encounterClose.requestClose()
                                            "
                                        >
                                            Close encounter
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent
                                    v-if="closeButtonDisabledReason"
                                >
                                    {{ closeButtonDisabledReason }}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

                <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p
                            class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
                        >
                            Lab orders
                        </p>
                        <p class="text-sm font-bold tabular-nums">
                            {{ laboratoryOrders.length }}
                        </p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p
                            class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
                        >
                            Pharmacy
                        </p>
                        <p class="text-sm font-bold tabular-nums">
                            {{ pharmacyOrders.length }}
                        </p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p
                            class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
                        >
                            Imaging
                        </p>
                        <p class="text-sm font-bold tabular-nums">
                            {{ radiologyOrders.length }}
                        </p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p
                            class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
                        >
                            Theatre
                        </p>
                        <p class="text-sm font-bold tabular-nums">
                            {{ theatreProcedures.length }}
                        </p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p
                            class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
                        >
                            Close readiness
                        </p>
                        <div class="mt-1 flex items-center gap-2">
                            <div
                                class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                            >
                                <div
                                    class="h-full rounded-full transition-all"
                                    :class="closeReadinessBarClass"
                                    :style="{
                                        width: `${closeReadinessPercent}%`,
                                    }"
                                />
                            </div>
                            <span class="text-xs font-bold tabular-nums"
                                >{{ closeReadinessPercent }}%</span
                            >
                        </div>
                    </div>
                </div>
            </div>

            <div class="space-y-4 p-4 md:p-6">
                <Alert
                    v-if="showResumedDraftBanner"
                    class="border-primary/20 bg-primary/5"
                >
                    <AlertTitle>Continuing an existing draft note</AlertTitle>
                    <AlertDescription class="space-y-2">
                        <p>
                            A draft note already existed for this visit — its
                            saved content has been loaded below rather than
                            starting blank.
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            @click="draftBannerDismissed = true"
                        >
                            Got it
                        </Button>
                    </AlertDescription>
                </Alert>

                <div v-if="workspace.isPending.value" class="space-y-2">
                    <Skeleton class="h-6 w-1/2" />
                    <Skeleton class="h-24 w-full" />
                </div>

                <Alert
                    v-else-if="workspace.isError.value"
                    variant="destructive"
                >
                    <AlertTitle>Unable to load this encounter</AlertTitle>
                    <AlertDescription>
                        {{ workspace.error.value?.message ?? 'Unknown error.' }}
                    </AlertDescription>
                </Alert>

                <div
                    v-if="workspace.data.value && patientId"
                    class="rounded-lg border bg-background p-4"
                >
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0 space-y-1.5">
                            <p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                Administrative
                            </p>
                            <div class="flex flex-wrap items-center gap-2">
                                <Badge v-if="encounterType" variant="outline">{{ formatEnumLabel(encounterType) }}</Badge>
                                <span v-if="locationLabel" class="text-sm text-muted-foreground">{{ locationLabel }}</span>
                                <Badge v-if="encounterDisposition" variant="secondary">{{ formatEnumLabel(encounterDisposition) }}</Badge>
                            </div>
                        </div>
                        <div class="min-w-0 flex-1 space-y-1.5 sm:max-w-md">
                            <div class="flex items-center justify-between gap-2">
                                <p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                    Diagnoses
                                </p>
                                <Button
                                    v-if="canManageDiagnoses"
                                    size="sm"
                                    variant="outline"
                                    class="h-7 gap-1 px-2 text-xs"
                                    @click="encounterDiagnoses.openDialog()"
                                >
                                    <AppIcon name="plus" class="size-3" />Add
                                </Button>
                            </div>
                            <p v-if="diagnoses.length === 0" class="text-xs text-muted-foreground">
                                No diagnoses recorded for this encounter yet.
                            </p>
                            <div v-else class="flex flex-wrap gap-1.5">
                                <span
                                    v-for="diagnosis in diagnoses"
                                    :key="diagnosis.id"
                                    class="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-xs"
                                >
                                    <Badge :variant="diagnosis.diagnosisType === 'primary' ? 'default' : 'outline'" class="text-[10px]">
                                        {{ diagnosis.diagnosisType === 'primary' ? 'Primary' : 'Secondary' }}
                                    </Badge>
                                    {{ diagnosis.diagnosisCode }}
                                    <span v-if="diagnosis.diagnosisDescription" class="text-muted-foreground">— {{ diagnosis.diagnosisDescription }}</span>
                                    <button
                                        v-if="canManageDiagnoses"
                                        type="button"
                                        class="text-muted-foreground hover:text-destructive"
                                        :disabled="encounterDiagnoses.removingId.value === diagnosis.id"
                                        @click="encounterDiagnoses.removeDiagnosis(diagnosis.id)"
                                    >
                                        <AppIcon name="x" class="size-3" />
                                    </button>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    v-if="workspace.data.value && patientId"
                    class="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 xl:hidden"
                >
                    <Button
                        type="button"
                        size="sm"
                        :variant="paneFocus === 'note' ? 'secondary' : 'ghost'"
                        class="flex-1"
                        @click="paneFocus = 'note'"
                    >
                        Note
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        :variant="paneFocus === 'split' ? 'secondary' : 'ghost'"
                        class="flex-1"
                        @click="paneFocus = 'split'"
                    >
                        Both
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        :variant="
                            paneFocus === 'orders' ? 'secondary' : 'ghost'
                        "
                        class="flex-1"
                        @click="paneFocus = 'orders'"
                    >
                        Orders
                    </Button>
                </div>

                <div
                    v-if="workspace.data.value && patientId"
                    class="grid items-start gap-4 xl:grid-cols-[3fr_2fr]"
                >
                    <div :class="['rounded-lg border p-4', notePaneClass]">
                        <NoteComposerShell
                            ref="noteComposer"
                            :key="existingRecord?.id ?? 'new'"
                            :patient-id="patientId"
                            :encounter-id="encounterId"
                            :appointment-id="appointmentId"
                            :admission-id="admissionId"
                            :encounter-at="
                                (workspace.data.value.encounter?.openedAt as
                                    | string
                                    | undefined) ?? new Date().toISOString()
                            "
                            :existing-record="existingRecord"
                            :can-finalize="
                                permissions.has('medical.records.finalize')
                            "
                            :can-amend="
                                permissions.has('medical.records.amend')
                            "
                            :can-archive="
                                permissions.has('medical.records.archive')
                            "
                            :encounter-diagnoses="diagnoses"
                            :can-manage-encounter-diagnoses="canManageDiagnoses"
                            @status-changed="void workspace.refetch()"
                            @open-add-encounter-diagnosis="encounterDiagnoses.openDialog()"
                        />
                    </div>

                    <div :class="['space-y-4', ordersPaneClass]">
                        <Tabs v-model="ordersTab">
                            <TabsList class="grid w-full grid-cols-2">
                                <TabsTrigger
                                    value="place"
                                    class="inline-flex items-center gap-1.5"
                                >
                                    <AppIcon name="plus" class="size-3.5" />
                                    Place order
                                </TabsTrigger>
                                <TabsTrigger
                                    value="streams"
                                    class="inline-flex items-center gap-1.5"
                                >
                                    <AppIcon name="layers" class="size-3.5" />
                                    Order streams
                                    <Badge
                                        v-if="ordering.careActiveCount.value"
                                        variant="secondary"
                                        class="h-4 min-w-4 px-1 text-[10px]"
                                    >
                                        {{ ordering.careActiveCount.value }}
                                    </Badge>
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="place" class="space-y-4">
                                <EncounterOrdersCommandCenter
                                    :patient-id="patientId"
                                    :has-workflow-actions="
                                        ordering.hasWorkflowActions.value
                                    "
                                    :can-show-care="ordering.canShowCare.value"
                                    :has-care-context="
                                        Boolean(appointmentId || admissionId)
                                    "
                                    :care-count-label="
                                        ordering.careCountLabel.value
                                    "
                                    :active-stream-count="
                                        ordering.careActiveCount.value
                                    "
                                    :summaries="ordering.careSummaries.value"
                                    :inline-order-type="
                                        ordering.inlineOrderType.value
                                    "
                                    :inline-order-linkage="
                                        ordering.inlineOrderLinkage.value
                                    "
                                    :inline-order-context="
                                        ordering.inlineOrderContext.value
                                    "
                                    :can-use-inline-orders="
                                        ordering.canUseInlineOrders()
                                    "
                                    :can-open-laboratory-workflow="
                                        ordering.canOpenLaboratoryWorkflow.value
                                    "
                                    :can-open-pharmacy-workflow="
                                        ordering.canOpenPharmacyWorkflow.value
                                    "
                                    :can-open-radiology-workflow="
                                        ordering.canOpenRadiologyWorkflow.value
                                    "
                                    :can-open-theatre-workflow="
                                        ordering.canOpenTheatreWorkflow.value
                                    "
                                    :can-open-billing-workflow="
                                        ordering.canOpenBillingWorkflow.value
                                    "
                                    :context-create-href="
                                        ordering.contextCreateHref
                                    "
                                    :can-open-theatre-inline="true"
                                    :theatre-inline-open="
                                        theatreInlineOrderOpen
                                    "
                                    :hide-billing-link="true"
                                    @close-inline-order="
                                        ordering.closeInlineOrder()
                                    "
                                    @created-inline-order="
                                        handleInlineOrderCreated($event)
                                    "
                                    @open-inline-order="openInlineOrder($event)"
                                    @open-theatre-inline="openTheatreInline()"
                                />

                                <TheatreInlineOrderForm
                                    v-if="theatreInlineOrderOpen"
                                    :context="theatreInlineOrderContext"
                                    @close="theatreInlineOrderOpen = false"
                                    @created="handleTheatreInlineOrderCreated()"
                                />
                                <div
                                    v-if="
                                        (!theatreInlineOrderOpen &&
                                            ordering.canOpenTheatreWorkflow
                                                .value) ||
                                        ordering.canOpenBillingWorkflow.value
                                    "
                                    class="flex flex-wrap justify-end gap-2 border-t pt-3"
                                >
                                    <p
                                        class="mr-auto self-center text-xs text-muted-foreground"
                                    >
                                        Not clinical ordering — handled on their
                                        own pages:
                                    </p>
                                    <Button
                                        v-if="
                                            !theatreInlineOrderOpen &&
                                            ordering.canOpenTheatreWorkflow
                                                .value
                                        "
                                        variant="outline"
                                        size="sm"
                                        as-child
                                    >
                                        <Link
                                            :href="
                                                ordering.contextCreateHref(
                                                    '/theatre-procedures',
                                                    { includeTabNew: true },
                                                )
                                            "
                                        >
                                            Book on full theatre page
                                        </Link>
                                    </Button>
                                    <Button
                                        v-if="
                                            ordering.canOpenBillingWorkflow
                                                .value
                                        "
                                        variant="outline"
                                        size="sm"
                                        as-child
                                    >
                                        <Link
                                            :href="
                                                ordering.contextCreateHref(
                                                    '/billing-invoices',
                                                    { includeTabNew: true },
                                                )
                                            "
                                        >
                                            Billing charges
                                        </Link>
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="streams">
                                <section
                                    v-if="ordering.canShowCare.value"
                                    class="space-y-3 rounded-lg border bg-card p-4 shadow-sm"
                                >
                                    <div
                                        v-if="
                                            !ordering.visibleCareSummaries.value
                                                .length
                                        "
                                        class="rounded-lg bg-muted/25 px-4 py-3 text-sm text-muted-foreground ring-1 ring-border/30"
                                    >
                                        No orders linked yet. Use the command
                                        center above to place the first order.
                                    </div>
                                    <EncounterWorkflowCareStreams
                                        v-else
                                        v-model="ordering.careTab.value"
                                        :visible-summaries="
                                            ordering.visibleCareSummaries.value
                                        "
                                        :laboratory-orders="laboratoryOrders"
                                        :pharmacy-orders="pharmacyOrders"
                                        :radiology-orders="radiologyOrders"
                                        :theatre-procedures="theatreProcedures"
                                        :laboratory-loading="
                                            workspace.isPending.value
                                        "
                                        :pharmacy-loading="
                                            workspace.isPending.value
                                        "
                                        :radiology-loading="
                                            workspace.isPending.value
                                        "
                                        :theatre-loading="
                                            workspace.isPending.value
                                        "
                                        :laboratory-error="null"
                                        :pharmacy-error="null"
                                        :radiology-error="null"
                                        :theatre-error="null"
                                        :can-open-laboratory-workflow="
                                            ordering.canOpenLaboratoryWorkflow
                                                .value
                                        "
                                        :can-open-pharmacy-workflow="
                                            ordering.canOpenPharmacyWorkflow
                                                .value
                                        "
                                        :can-open-radiology-workflow="
                                            ordering.canOpenRadiologyWorkflow
                                                .value
                                        "
                                        :can-open-theatre-workflow="
                                            ordering.canOpenTheatreWorkflow
                                                .value
                                        "
                                        :can-create-laboratory-orders="
                                            ordering.canCreateLaboratoryOrders
                                                .value
                                        "
                                        :can-create-pharmacy-orders="
                                            ordering.canCreatePharmacyOrders
                                                .value
                                        "
                                        :can-create-radiology-orders="
                                            ordering.canCreateRadiologyOrders
                                                .value
                                        "
                                        :can-create-theatre-procedures="
                                            ordering.canCreateTheatreProcedures
                                                .value
                                        "
                                        :can-use-inline-orders="
                                            ordering.canUseInlineOrders()
                                        "
                                        :context-create-href="
                                            ordering.contextCreateHref
                                        "
                                        :format-date-time="formatDateTime"
                                        @lifecycle="
                                            ordering.openLifecycleDialog(
                                                $event.kind,
                                                $event.id,
                                                $event.action,
                                                $event.defaultReason,
                                            )
                                        "
                                        @open-inline-order="
                                            openInlineOrder(
                                                $event.type,
                                                $event.linkage,
                                            )
                                        "
                                    />
                                </section>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>

            <EncounterHistorySheet
                v-model:open="historyOpen"
                v-model:tab="historyTab"
                :record-id="activeRecordId"
                :can-create-attestation="canAttestActiveRecord"
                :can-view-audit-logs="canViewAuditLogs"
            />

            <EncounterLifecycleDialog
                v-model:open="ordering.lifecycleDialogOpen.value"
                v-model:reason="ordering.lifecycleReason.value"
                :action="ordering.lifecycleAction.value"
                :target-name="ordering.lifecycleTargetName()"
                :error="ordering.lifecycleError.value"
                :submitting="ordering.lifecycleSubmitting.value"
                @close="ordering.closeLifecycleDialog()"
                @submit="void ordering.submitLifecycleDialog()"
            />

            <EncounterCloseChecklistDialog
                :open="encounterClose.dialogOpen.value"
                :readiness="closeReadiness"
                :reason="encounterClose.reason.value"
                :disposition="encounterClose.disposition.value"
                :disposition-notes="encounterClose.dispositionNotes.value"
                :submitting="encounterClose.submitting.value"
                :error="encounterClose.error.value"
                @update:open="
                    (value) =>
                        value ? undefined : encounterClose.closeDialog()
                "
                @update:reason="
                    (value) => (encounterClose.reason.value = value)
                "
                @update:disposition="
                    (value) => (encounterClose.disposition.value = value)
                "
                @update:disposition-notes="
                    (value) => (encounterClose.dispositionNotes.value = value)
                "
                @confirm="void encounterClose.submitDialog()"
            />

            <Dialog
                :open="encounterDiagnoses.dialogOpen.value"
                @update:open="(value) => (value ? undefined : encounterDiagnoses.closeDialog())"
            >
                <DialogContent class="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add diagnosis</DialogTitle>
                        <DialogDescription>
                            Record a diagnosis for this encounter. Adding a new primary diagnosis demotes the existing one to secondary.
                        </DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-4">
                        <div class="grid gap-2">
                            <Label for="encounter-diagnosis-code">Diagnosis code</Label>
                            <Input id="encounter-diagnosis-code" v-model="encounterDiagnoses.form.diagnosisCode" placeholder="e.g. R52" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="encounter-diagnosis-description">Description</Label>
                            <Input id="encounter-diagnosis-description" v-model="encounterDiagnoses.form.diagnosisDescription" placeholder="Optional" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="encounter-diagnosis-type">Type</Label>
                            <select
                                id="encounter-diagnosis-type"
                                v-model="encounterDiagnoses.form.diagnosisType"
                                class="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="secondary">Secondary</option>
                                <option value="primary">Primary</option>
                            </select>
                        </div>
                        <p v-if="encounterDiagnoses.error.value" class="text-sm text-destructive">
                            {{ encounterDiagnoses.error.value }}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" :disabled="encounterDiagnoses.submitting.value" @click="encounterDiagnoses.closeDialog()">
                            Cancel
                        </Button>
                        <Button
                            :disabled="encounterDiagnoses.submitting.value || !encounterDiagnoses.form.diagnosisCode.trim()"
                            @click="void encounterDiagnoses.submitDialog()"
                        >
                            {{ encounterDiagnoses.submitting.value ? 'Saving...' : 'Add diagnosis' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>
