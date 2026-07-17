<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed, ref, useTemplateRef, watch } from 'vue';
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
import EncounterOrderSheet from '@/components/domain/clinical/EncounterOrderSheet.vue';
import EncounterWorkflowCareStreams from '@/components/domain/clinical/EncounterWorkflowCareStreams.vue';
import EncounterLifecycleDialog from '@/components/domain/clinical/EncounterLifecycleDialog.vue';
import EncounterCloseChecklistDialog from '@/components/domain/clinical/EncounterCloseChecklistDialog.vue';
import EncounterHistorySheet from '@/components/clinical/panels/EncounterHistorySheet.vue';
import LaboratoryOrderDetailSheet from '@/components/laboratoryOrders/LaboratoryOrderDetailSheet.vue';
import LabResultSummaryPopover from '@/components/laboratoryOrders/LabResultSummaryPopover.vue';
import TheatreInlineOrderForm from '@/components/clinical/panels/TheatreInlineOrderForm.vue';
import ReferralManagementSheet from '@/components/clinician/ReferralManagementSheet.vue';
import { useEncounterWorkspace } from '@/composables/useEncounterWorkspace';
import { usePermissions } from '@/composables/usePermissions';
import {
    formatDateTime,
    useEncounterOrdering,
} from '@/composables/clinical/useEncounterOrdering';
import { useEncounterClose } from '@/composables/clinical/useEncounterClose';
import { useEncounterDiagnoses } from '@/composables/clinical/useEncounterDiagnoses';
import { useEncounterNotes } from '@/composables/clinical/useEncounterNotes';
import { useLaboratoryOrder } from '@/composables/laboratoryOrders/useLaboratoryOrder';
import { useEncounterCharges } from '@/composables/clinical/useEncounterCharges';
import { useAppointmentReferrals } from '@/composables/clinician/useAppointmentReferrals';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { medicalRecordNoteTypeLabel } from '@/pages/medical-records/noteTypes';
import { formatEnumLabel } from '@/lib/labels';
import {
    laboratoryOrderStatusVariant,
    radiologyOrderStatusVariant,
    pharmacyOrderStatusVariant,
    pharmacyOrderQuantityLabel,
    type EncounterCareLaboratoryOrder,
    type EncounterCarePharmacyOrder,
    type EncounterCareRadiologyOrder,
    type EncounterCareTheatreProcedure,
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
    { title: 'Encounters', href: '/encounters' },
    {
        title: encounterNumber.value
            ? `Encounter ${encounterNumber.value}`
            : 'Encounter',
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
const appointmentNumber = computed(
    () =>
        (workspace.data.value?.appointment?.appointmentNumber as
            | string
            | null
            | undefined) ?? null,
);
const patientChartHref = computed(() =>
    patientId.value ? `/patients/${patientId.value}/chart` : null,
);
const canManageReferrals = computed(() =>
    permissions.has('appointments.manage-referrals'),
);
const referralSheetOpen = ref(false);
const encounterNumber = computed(
    () =>
        (workspace.data.value?.encounter?.encounterNumber as
            | string
            | null
            | undefined) ?? null,
);

/**
 * Encounter-workspace activity tabs (Epic/Cerner-style): the encounter is the
 * page; Notes, Orders, Results, and Medications are distinct activities within
 * it. Notes is the default so the Start-Consultation → document loop is
 * unbroken. See reports/... encounter redesign.
 */
const activeTab = ref<
    | 'overview'
    | 'notes'
    | 'orders'
    | 'results'
    | 'medications'
    | 'diagnoses'
    | 'referrals'
    | 'charges'
>('notes');

// Referrals for this visit — appointment-scoped, so the tab only exists when
// an appointment is linked and the user can manage referrals.
const referrals = useAppointmentReferrals(appointmentId);
const showReferralsTab = computed(
    () => Boolean(appointmentId.value) && canManageReferrals.value,
);

// Charges: every billable service captured on this encounter, reusing the
// existing encounter-scoped charge-capture endpoint (gated by its own
// billing.invoices.create permission).
const canViewCharges = computed(() =>
    permissions.has('billing.invoices.create'),
);
const charges = useEncounterCharges(
    () => patientId.value,
    () => props.encounterId,
    () => canViewCharges.value,
);
const chargesTotal = computed(() =>
    (charges.data.value?.data ?? []).reduce(
        (sum, row) => sum + (Number(row.lineTotal) || 0),
        0,
    ),
);
const chargesCurrency = computed(
    () => charges.data.value?.meta?.currencyCode ?? '',
);
/**
 * Notes panel (§6 of the medical-record-encounter-note-modeling-decision
 * report): the Workspace previously only ever loaded the encounter's single
 * "primary" note. GET /medical-records?encounterId=X already returns every
 * note for the encounter, so the panel below lists them all and lets a
 * clinician switch between them — `selectedRecordId` overrides the primary
 * record when set, `startingNewNote` overrides it to a blank draft.
 */
const encounterNotes = useEncounterNotes(() => props.encounterId);
const encounterNoteRecords = computed(() => encounterNotes.data.value?.data ?? []);
const selectedRecordId = ref<string | null>(null);
const startingNewNote = ref(false);

const existingRecord = computed<MedicalRecordResponse | null>(() => {
    if (startingNewNote.value) return null;

    if (selectedRecordId.value) {
        const selected = encounterNoteRecords.value.find(
            (record) => record.id === selectedRecordId.value,
        );
        if (selected) return selected;
    }

    return (
        (workspace.data.value
            ?.primaryMedicalRecord as MedicalRecordResponse | null) ?? null
    );
});

function selectNote(recordId: string): void {
    startingNewNote.value = false;
    selectedRecordId.value = recordId;
}

function startNewNote(): void {
    startingNewNote.value = true;
    selectedRecordId.value = null;
}

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

// Results tab: only orders that have a reported result/report (free-text —
// this system stores a single resultSummary/reportSummary per order, not
// structured values; see the encounter-workspace redesign plan).
const resultedLabOrders = computed(() =>
    laboratoryOrders.value.filter(
        (order) => (order.resultSummary ?? '').trim() !== '',
    ),
);
const reportedRadiologyOrders = computed(() =>
    radiologyOrders.value.filter(
        (order) => (order.reportSummary ?? '').trim() !== '',
    ),
);
const hasAnyResults = computed(
    () =>
        resultedLabOrders.value.length > 0 ||
        reportedRadiologyOrders.value.length > 0,
);
const pendingResultCount = computed(
    () =>
        laboratoryOrders.value.length -
        resultedLabOrders.value.length +
        (radiologyOrders.value.length - reportedRadiologyOrders.value.length),
);

// "View full result" opens the same structured detail sheet used on the
// Laboratory Orders list and Patient Chart — the resultSummary shown inline
// above is just the flattened narrative; the sectioned/structured result
// (if the test used one) only lives behind this fetch.
const reviewLabOrderId = ref<string | null>(null);
const reviewLabSheetOpen = ref(false);
const reviewLabOrderQuery = useLaboratoryOrder(reviewLabOrderId);

function openLabResultReview(id: string): void {
    reviewLabOrderId.value = id;
    reviewLabSheetOpen.value = true;
}

// Medications: pharmacy orders are combined prescription+dispense records.
// "Active" is derived from status (no dedicated active-meds concept exists).
const activeMedications = computed(() =>
    pharmacyOrders.value.filter(
        (order) =>
            !['cancelled', 'reconciliation_exception'].includes(
                (order.status ?? '').toLowerCase(),
            ),
    ),
);

const triageVitalsSummary = computed(
    () =>
        (workspace.data.value?.appointment?.triageVitalsSummary as
            | string
            | null
            | undefined) ?? null,
);
const visitReason = computed(
    () =>
        (workspace.data.value?.appointment?.reason as
            | string
            | null
            | undefined) ??
        (workspace.data.value?.encounter?.reason as
            | string
            | null
            | undefined) ??
        null,
);
const openedAt = computed(
    () =>
        (workspace.data.value?.encounter?.openedAt as
            | string
            | null
            | undefined) ?? null,
);
const closedAt = computed(
    () =>
        (workspace.data.value?.encounter?.closedAt as
            | string
            | null
            | undefined) ?? null,
);
const primaryDiagnosis = computed(
    () =>
        diagnoses.value.find((d) => d.diagnosisType === 'primary') ?? null,
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
    activeTab.value = 'orders';
    void workspace.refetch();
}

/**
 * Ordering (command center + inline forms) and order tracking both live in the
 * "Orders" tab. Placing/creating an order keeps the user on Orders so the new
 * order appears in the tracking stream right below the command center.
 */
function openInlineOrder(
    type: Parameters<typeof ordering.openInlineOrder>[0],
    linkage?: Parameters<typeof ordering.openInlineOrder>[1],
): void {
    ordering.openInlineOrder(type, linkage);
    activeTab.value = 'orders';
}

function handleInlineOrderCreated(
    type: Parameters<typeof ordering.handleInlineOrderCreated>[0],
): void {
    ordering.handleInlineOrderCreated(type);
    activeTab.value = 'orders';
}

function openTheatreInline(): void {
    theatreInlineOrderOpen.value = true;
    activeTab.value = 'orders';
}

const noteComposerRef =
    useTemplateRef<InstanceType<typeof NoteComposerShell>>('noteComposer');
const activeRecord = computed<MedicalRecordResponse | null>(
    () => noteComposerRef.value?.activeRecord ?? null,
);
const activeRecordId = computed(() => activeRecord.value?.id ?? null);

/**
 * Once a "New note" draft actually gets an id (first autosave), adopt it as
 * the selected note instead of staying in the ephemeral "new" state — keeps
 * the Notes panel highlighting the right row and prevents a stray reload
 * from silently reverting to a second blank draft.
 */
watch(activeRecordId, (id) => {
    if (id && startingNewNote.value) {
        startingNewNote.value = false;
        selectedRecordId.value = id;
        void encounterNotes.refetch();
    }
});

function handleNoteStatusChanged(): void {
    void workspace.refetch();
    void encounterNotes.refetch();
}

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

// 100dvh, not the usual 98dvh default — see useStickyScrollContainer's docblock.
const { scrollContainerHeight } = useStickyScrollContainer('100dvh');
</script>

<template>
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <Tabs v-model="activeTab" class="contents">
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
                            <Button
                                v-if="patientChartHref"
                                variant="ghost"
                                size="sm"
                                class="h-6 gap-1 px-2 text-xs"
                                as-child
                            >
                                <Link :href="patientChartHref">
                                    <AppIcon name="file-text" class="size-3" />
                                    View chart
                                </Link>
                            </Button>
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
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p
                            class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
                        >
                            Active orders
                        </p>
                        <p class="text-sm font-bold tabular-nums">
                            {{ ordering.careActiveCount.value }}
                        </p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p
                            class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
                        >
                            Results pending
                        </p>
                        <p class="text-sm font-bold tabular-nums">
                            {{ pendingResultCount }}
                        </p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p
                            class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
                        >
                            Medications
                        </p>
                        <p class="text-sm font-bold tabular-nums">
                            {{ activeMedications.length }}
                        </p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p
                            class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
                        >
                            Diagnoses
                        </p>
                        <p class="text-sm font-bold tabular-nums">
                            {{ diagnoses.length }}
                        </p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
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

                <TabsList v-if="patientId" class="mt-3 flex w-full flex-wrap justify-start gap-1">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="notes" class="inline-flex items-center gap-1.5">
                        Notes
                        <Badge v-if="encounterNoteRecords.length" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ encounterNoteRecords.length }}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="orders" class="inline-flex items-center gap-1.5">
                        Orders
                        <Badge v-if="ordering.careActiveCount.value" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ ordering.careActiveCount.value }}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="results" class="inline-flex items-center gap-1.5">
                        Results
                        <Badge v-if="resultedLabOrders.length + reportedRadiologyOrders.length" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ resultedLabOrders.length + reportedRadiologyOrders.length }}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="medications" class="inline-flex items-center gap-1.5">
                        Medications
                        <Badge v-if="activeMedications.length" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ activeMedications.length }}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="diagnoses" class="inline-flex items-center gap-1.5">
                        Diagnoses
                        <Badge v-if="diagnoses.length" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ diagnoses.length }}</Badge>
                    </TabsTrigger>
                    <TabsTrigger v-if="showReferralsTab" value="referrals" class="inline-flex items-center gap-1.5">
                        Referrals
                        <Badge v-if="referrals.data.value?.meta.total" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ referrals.data.value?.meta.total }}</Badge>
                    </TabsTrigger>
                    <TabsTrigger v-if="canViewCharges" value="charges" class="inline-flex items-center gap-1.5">
                        Charges
                        <Badge v-if="charges.data.value?.meta?.total" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ charges.data.value?.meta.total }}</Badge>
                    </TabsTrigger>
                </TabsList>
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

                <template v-else-if="workspace.data.value && patientId">

                    <TabsContent value="overview" class="space-y-4">
                        <!-- Visit summary -->
                        <div class="rounded-lg border bg-card p-4">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">Visit</p>
                                <Badge :variant="encounterStatusVariant">{{ formatEnumLabel(encounterStatus) }}</Badge>
                            </div>
                            <div class="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                                <div class="flex justify-between gap-3"><span class="text-muted-foreground">Type</span><span class="font-medium">{{ encounterType ? formatEnumLabel(encounterType) : '—' }}</span></div>
                                <div class="flex justify-between gap-3"><span class="text-muted-foreground">Location</span><span class="font-medium">{{ locationLabel ?? '—' }}</span></div>
                                <div class="flex justify-between gap-3"><span class="text-muted-foreground">Opened</span><span class="font-medium">{{ openedAt ? formatDateTime(openedAt) : '—' }}</span></div>
                                <div class="flex justify-between gap-3"><span class="text-muted-foreground">Closed</span><span class="font-medium">{{ closedAt ? formatDateTime(closedAt) : '—' }}</span></div>
                                <div class="flex justify-between gap-3"><span class="text-muted-foreground">Disposition</span><span class="font-medium">{{ encounterDisposition ? formatEnumLabel(encounterDisposition) : '—' }}</span></div>
                                <div class="flex justify-between gap-3"><span class="text-muted-foreground">Reason</span><span class="font-medium">{{ visitReason ?? '—' }}</span></div>
                            </div>
                            <div v-if="triageVitalsSummary" class="mt-3 rounded-md bg-muted/25 px-3 py-2 text-xs">
                                <span class="font-medium text-muted-foreground">Triage vitals: </span>{{ triageVitalsSummary }}
                            </div>
                        </div>

                        <!-- Counts -->
                        <div class="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                            <button type="button" class="rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/30" @click="activeTab = 'notes'">
                                <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Notes</p>
                                <p class="text-lg font-bold tabular-nums">{{ encounterNoteRecords.length }}</p>
                            </button>
                            <button type="button" class="rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/30" @click="activeTab = 'orders'">
                                <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Orders</p>
                                <p class="text-lg font-bold tabular-nums">{{ laboratoryOrders.length + radiologyOrders.length + theatreProcedures.length }}</p>
                            </button>
                            <button type="button" class="rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/30" @click="activeTab = 'results'">
                                <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Results</p>
                                <p class="text-lg font-bold tabular-nums">{{ resultedLabOrders.length + reportedRadiologyOrders.length }}<span v-if="pendingResultCount > 0" class="text-xs font-normal text-muted-foreground"> · {{ pendingResultCount }} pending</span></p>
                            </button>
                            <button type="button" class="rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/30" @click="activeTab = 'medications'">
                                <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Medications</p>
                                <p class="text-lg font-bold tabular-nums">{{ activeMedications.length }}</p>
                            </button>
                            <button type="button" class="rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/30" @click="activeTab = 'diagnoses'">
                                <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Diagnoses</p>
                                <p class="text-lg font-bold tabular-nums">{{ diagnoses.length }}</p>
                            </button>
                            <button v-if="canViewCharges" type="button" class="rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/30" @click="activeTab = 'charges'">
                                <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Charges</p>
                                <p class="text-lg font-bold tabular-nums">{{ chargesCurrency }} {{ chargesTotal.toLocaleString() }}</p>
                            </button>
                        </div>

                        <div class="grid gap-4 lg:grid-cols-2">
                            <!-- Diagnoses -->
                            <div class="rounded-lg border bg-card p-4">
                                <div class="flex items-center justify-between gap-2">
                                    <p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">Diagnoses</p>
                                    <button type="button" class="text-xs font-medium text-primary hover:underline" @click="activeTab = 'diagnoses'">Open</button>
                                </div>
                                <p v-if="diagnoses.length === 0" class="mt-1.5 text-xs text-muted-foreground">No diagnoses recorded yet.</p>
                                <div v-else class="mt-1.5 flex flex-wrap gap-1.5">
                                    <span
                                        v-for="diagnosis in diagnoses"
                                        :key="diagnosis.id"
                                        class="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-xs"
                                    >
                                        <Badge :variant="diagnosis.diagnosisType === 'primary' ? 'default' : 'outline'" class="text-[10px]">{{ diagnosis.diagnosisType === 'primary' ? 'Primary' : 'Secondary' }}</Badge>
                                        {{ diagnosis.diagnosisCode }}
                                        <span v-if="diagnosis.diagnosisDescription" class="text-muted-foreground">— {{ diagnosis.diagnosisDescription }}</span>
                                    </span>
                                </div>
                            </div>

                            <!-- Active medications -->
                            <div class="rounded-lg border bg-card p-4">
                                <div class="flex items-center justify-between gap-2">
                                    <p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">Medications</p>
                                    <button type="button" class="text-xs font-medium text-primary hover:underline" @click="activeTab = 'medications'">Open</button>
                                </div>
                                <p v-if="activeMedications.length === 0" class="mt-1.5 text-xs text-muted-foreground">No active medications.</p>
                                <ul v-else class="mt-1.5 space-y-1 text-sm">
                                    <li v-for="med in activeMedications.slice(0, 5)" :key="med.id" class="flex items-center justify-between gap-2">
                                        <span class="font-medium">{{ med.medicationName || 'Medication' }}</span>
                                        <span class="text-xs text-muted-foreground">{{ med.dosageInstruction || formatEnumLabel(med.status) }}</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <!-- Close readiness -->
                        <div class="rounded-lg border bg-card p-4">
                            <p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">Close readiness</p>
                            <div class="mt-2 flex items-center gap-3">
                                <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div class="h-full rounded-full transition-all" :class="closeReadinessBarClass" :style="{ width: `${closeReadinessPercent}%` }" />
                                </div>
                                <span class="text-xs font-bold tabular-nums">{{ closeReadinessPercent }}%</span>
                            </div>
                            <p class="mt-2 text-xs text-muted-foreground">
                                {{ closeReadiness?.canClose ? 'Ready to close.' : 'Not ready to close yet.' }}
                                <span v-if="closeReadiness && closeReadiness.blockingCount > 0">{{ closeReadiness.blockingCount }} blocking item(s).</span>
                                <span v-else-if="closeReadiness && closeReadiness.warningCount > 0">{{ closeReadiness.warningCount }} warning(s) to acknowledge.</span>
                            </p>
                        </div>
                    </TabsContent>

                    <TabsContent value="notes" force-mount class="space-y-4 data-[state=inactive]:hidden">
                        <div
                            v-if="encounterNoteRecords.length || permissions.has('medical.records.create')"
                            class="flex flex-wrap items-center gap-1.5"
                        >
                            <button
                                v-for="record in encounterNoteRecords"
                                :key="record.id"
                                type="button"
                                class="rounded-md border px-2.5 py-1 text-xs transition-colors"
                                :class="record.id === existingRecord?.id ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'"
                                @click="selectNote(record.id)"
                            >
                                {{ medicalRecordNoteTypeLabel(record.recordType) }} · {{ record.status }}
                            </button>
                            <Button
                                v-if="permissions.has('medical.records.create')"
                                variant="outline"
                                size="sm"
                                class="h-7 gap-1.5 text-xs"
                                @click="startNewNote()"
                            >
                                <AppIcon name="plus" class="size-3" />New note
                            </Button>
                        </div>

                        <div class="rounded-lg border p-4">
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
                            @status-changed="handleNoteStatusChanged()"
                            @open-add-encounter-diagnosis="encounterDiagnoses.openDialog()"
                        />
                        </div>
                    </TabsContent>

                    <TabsContent value="orders" class="space-y-4">
                        <div class="space-y-4">
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
                                    @open-inline-order="openInlineOrder($event)"
                                    @open-theatre-inline="openTheatreInline()"
                                />

                                <EncounterOrderSheet
                                    :open="ordering.inlineOrderType.value !== null"
                                    :order-type="ordering.inlineOrderType.value"
                                    :linkage="ordering.inlineOrderLinkage.value"
                                    :context="ordering.inlineOrderContext.value"
                                    @close="ordering.closeInlineOrder()"
                                    @created="handleInlineOrderCreated($event)"
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
                        </div>

                        <div
                            v-if="!ordering.canShowCare.value"
                            class="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
                        >
                            No orders placed for this encounter yet.
                        </div>
                        <section
                            v-else
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

                    <TabsContent value="results" class="space-y-3">
                        <p class="text-xs text-muted-foreground">
                            Reported lab results and imaging reports for this encounter. Results are the narrative summary entered by the lab/imaging team; order status and pending items are on the Orders tab.
                        </p>
                        <div
                            v-if="!hasAnyResults"
                            class="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
                        >
                            No results reported yet.
                            <span v-if="pendingResultCount > 0">{{ pendingResultCount }} order(s) still pending on the Orders tab.</span>
                        </div>
                        <template v-else>
                            <div v-if="resultedLabOrders.length" class="rounded-lg border bg-card p-4">
                                <p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">Laboratory</p>
                                <div class="mt-2 space-y-2">
                                    <div v-for="order in resultedLabOrders" :key="order.id" class="rounded-md border bg-muted/20 p-3">
                                        <div class="flex flex-wrap items-center justify-between gap-2">
                                            <span class="text-sm font-medium">{{ order.testName || order.orderNumber || 'Lab test' }}</span>
                                            <div class="flex items-center gap-2">
                                                <Badge :variant="laboratoryOrderStatusVariant(order.status)" class="text-[10px]">{{ formatEnumLabel(order.status) }}</Badge>
                                                <span v-if="order.resultedAt" class="text-xs text-muted-foreground">{{ formatDateTime(order.resultedAt) }}</span>
                                            </div>
                                        </div>
                                        <div class="mt-2">
                                            <LabResultSummaryPopover
                                                :result-summary="order.resultSummary"
                                                show-view-full
                                                @view-full-result="openLabResultReview(order.id)"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-if="reportedRadiologyOrders.length" class="rounded-lg border bg-card p-4">
                                <p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">Imaging</p>
                                <div class="mt-2 space-y-2">
                                    <div v-for="order in reportedRadiologyOrders" :key="order.id" class="rounded-md border bg-muted/20 p-3">
                                        <div class="flex flex-wrap items-center justify-between gap-2">
                                            <span class="text-sm font-medium">{{ order.studyDescription || order.orderNumber || 'Imaging study' }}</span>
                                            <div class="flex items-center gap-2">
                                                <Badge :variant="radiologyOrderStatusVariant(order.status)" class="text-[10px]">{{ formatEnumLabel(order.status) }}</Badge>
                                                <span v-if="order.completedAt" class="text-xs text-muted-foreground">{{ formatDateTime(order.completedAt) }}</span>
                                            </div>
                                        </div>
                                        <p class="mt-1 text-sm whitespace-pre-line">{{ order.reportSummary }}</p>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </TabsContent>

                    <TabsContent value="medications" class="space-y-3">
                        <div class="rounded-lg border bg-card p-4">
                            <p class="text-sm font-medium">Medications</p>
                            <p class="mt-0.5 text-xs text-muted-foreground">Prescriptions and dispensing for this encounter. Manage in the Pharmacy workflow.</p>
                            <p v-if="pharmacyOrders.length === 0" class="mt-3 text-sm text-muted-foreground">No medications prescribed for this encounter yet.</p>
                            <div v-else class="mt-3 space-y-2">
                                <div v-for="med in pharmacyOrders" :key="med.id" class="rounded-md border bg-muted/20 p-3">
                                    <div class="flex flex-wrap items-center justify-between gap-2">
                                        <span class="text-sm font-medium">{{ med.medicationName || 'Medication' }}</span>
                                        <Badge :variant="pharmacyOrderStatusVariant(med.status)" class="text-[10px]">{{ formatEnumLabel(med.status) }}</Badge>
                                    </div>
                                    <p v-if="med.dosageInstruction" class="mt-1 text-sm">{{ med.dosageInstruction }}</p>
                                    <p class="mt-1 text-xs text-muted-foreground">
                                        <span v-if="pharmacyOrderQuantityLabel(med.quantityPrescribed)">Prescribed {{ pharmacyOrderQuantityLabel(med.quantityPrescribed) }}</span>
                                        <span v-if="med.quantityDispensed"> · Dispensed {{ pharmacyOrderQuantityLabel(med.quantityDispensed) }}</span>
                                        <span v-if="med.dispensedAt"> · {{ formatDateTime(med.dispensedAt) }}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="diagnoses" class="space-y-3">
                        <div class="rounded-lg border bg-card p-4">
                            <div class="flex items-center justify-between gap-2">
                                <p class="text-sm font-medium">Encounter diagnoses</p>
                                <Button
                                    v-if="canManageDiagnoses"
                                    size="sm"
                                    variant="outline"
                                    class="h-8 gap-1.5"
                                    @click="encounterDiagnoses.openDialog()"
                                >
                                    <AppIcon name="plus" class="size-3.5" />Add diagnosis
                                </Button>
                            </div>
                            <p v-if="diagnoses.length === 0" class="mt-2 text-sm text-muted-foreground">
                                No diagnoses recorded for this encounter yet.
                            </p>
                            <div v-else class="mt-3 space-y-2">
                                <div
                                    v-for="diagnosis in diagnoses"
                                    :key="diagnosis.id"
                                    class="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2"
                                >
                                    <div class="flex flex-wrap items-center gap-2 text-sm">
                                        <Badge :variant="diagnosis.diagnosisType === 'primary' ? 'default' : 'outline'" class="text-[10px]">
                                            {{ diagnosis.diagnosisType === 'primary' ? 'Primary' : 'Secondary' }}
                                        </Badge>
                                        <span class="font-medium">{{ diagnosis.diagnosisCode }}</span>
                                        <span v-if="diagnosis.diagnosisDescription" class="text-muted-foreground">{{ diagnosis.diagnosisDescription }}</span>
                                    </div>
                                    <button
                                        v-if="canManageDiagnoses"
                                        type="button"
                                        class="text-muted-foreground hover:text-destructive"
                                        :disabled="encounterDiagnoses.removingId.value === diagnosis.id"
                                        @click="encounterDiagnoses.removeDiagnosis(diagnosis.id)"
                                    >
                                        <AppIcon name="x" class="size-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent v-if="showReferralsTab" value="referrals" class="space-y-3">
                        <div class="rounded-lg border bg-card p-4">
                            <div class="flex items-center justify-between gap-2">
                                <p class="text-sm font-medium">Referrals for this visit</p>
                                <Button
                                    v-if="canManageReferrals"
                                    size="sm"
                                    variant="outline"
                                    class="h-8 gap-1.5"
                                    @click="referralSheetOpen = true"
                                >
                                    <AppIcon name="arrow-up-right" class="size-3.5" />Manage referrals
                                </Button>
                            </div>
                            <div v-if="referrals.isPending.value" class="mt-3 space-y-2">
                                <Skeleton class="h-14 w-full" />
                                <Skeleton class="h-14 w-full" />
                            </div>
                            <Alert v-else-if="referrals.isError.value" variant="destructive" class="mt-3">
                                <AlertTitle>Unable to load referrals</AlertTitle>
                                <AlertDescription>{{ referrals.error.value?.message ?? 'Unknown error.' }}</AlertDescription>
                            </Alert>
                            <p v-else-if="!referrals.data.value?.data.length" class="mt-2 text-sm text-muted-foreground">
                                No referrals for this visit yet.
                            </p>
                            <div v-else class="mt-3 space-y-2">
                                <div
                                    v-for="referral in referrals.data.value.data"
                                    :key="referral.id"
                                    class="rounded-md border bg-muted/20 px-3 py-2"
                                >
                                    <div class="flex flex-wrap items-center justify-between gap-2">
                                        <div class="flex flex-wrap items-center gap-2 text-sm">
                                            <span class="font-medium">{{ referral.targetDepartment || referral.targetFacilityName || 'Referral' }}</span>
                                            <Badge variant="outline" class="text-[10px]">{{ referral.referralType || '—' }}</Badge>
                                            <Badge v-if="referral.priority" :variant="referral.priority === 'critical' ? 'destructive' : 'secondary'" class="text-[10px]">{{ referral.priority }}</Badge>
                                        </div>
                                        <Badge variant="secondary" class="text-[10px]">{{ referral.status || '—' }}</Badge>
                                    </div>
                                    <p v-if="referral.referralReason" class="mt-1 text-xs text-muted-foreground">{{ referral.referralReason }}</p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent v-if="canViewCharges" value="charges" class="space-y-3">
                        <div class="rounded-lg border bg-card p-4">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <p class="text-sm font-medium">Charges for this visit</p>
                                <span v-if="charges.data.value" class="text-sm font-semibold tabular-nums">
                                    Total: {{ chargesCurrency }} {{ chargesTotal.toLocaleString() }}
                                </span>
                            </div>
                            <p class="mt-0.5 text-xs text-muted-foreground">
                                Billable services captured on this encounter, priced from the service catalog.
                            </p>
                            <div v-if="charges.isPending.value" class="mt-3 space-y-2">
                                <Skeleton class="h-12 w-full" />
                                <Skeleton class="h-12 w-full" />
                            </div>
                            <Alert v-else-if="charges.isError.value" variant="destructive" class="mt-3">
                                <AlertTitle>Unable to load charges</AlertTitle>
                                <AlertDescription>{{ charges.error.value?.message ?? 'Unknown error.' }}</AlertDescription>
                            </Alert>
                            <p v-else-if="!charges.data.value?.data.length" class="mt-2 text-sm text-muted-foreground">
                                No billable services captured for this encounter yet.
                            </p>
                            <div v-else class="mt-3 space-y-2">
                                <div
                                    v-for="charge in charges.data.value.data"
                                    :key="charge.id"
                                    class="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2"
                                >
                                    <div class="min-w-0">
                                        <p class="text-sm font-medium">{{ charge.serviceName }}</p>
                                        <p class="text-xs text-muted-foreground">
                                            {{ formatEnumLabel(charge.serviceType) }}
                                            <span v-if="charge.serviceCode">· {{ charge.serviceCode }}</span>
                                            <span v-if="charge.quantity && charge.quantity !== 1"> · ×{{ charge.quantity }}</span>
                                        </p>
                                    </div>
                                    <div class="flex shrink-0 items-center gap-2">
                                        <Badge v-if="charge.alreadyInvoiced" variant="secondary" class="text-[10px]">
                                            Invoiced{{ charge.invoiceNumber ? ` · ${charge.invoiceNumber}` : '' }}
                                        </Badge>
                                        <Badge v-else variant="outline" class="text-[10px]">Pending</Badge>
                                        <Badge v-if="charge.pricingStatus !== 'priced'" variant="destructive" class="text-[10px]">No price</Badge>
                                        <span class="text-sm font-semibold tabular-nums">{{ charge.currencyCode }} {{ Number(charge.lineTotal).toLocaleString() }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </template>
            </div>
            </Tabs>

            <EncounterHistorySheet
                v-model:open="historyOpen"
                v-model:tab="historyTab"
                :record-id="activeRecordId"
                :can-create-attestation="canAttestActiveRecord"
                :can-view-audit-logs="canViewAuditLogs"
            />

            <LaboratoryOrderDetailSheet
                v-model:open="reviewLabSheetOpen"
                :order="reviewLabOrderQuery.data.value?.data ?? null"
                :loading="reviewLabOrderQuery.isPending.value"
                :load-error="reviewLabOrderQuery.isError.value ? ((reviewLabOrderQuery.error.value as Error | null)?.message ?? 'Unable to load this result.') : null"
                :can-create="false"
            />

            <ReferralManagementSheet
                v-model:open="referralSheetOpen"
                :appointment-id="appointmentId"
                :appointment-number="appointmentNumber"
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
                :readiness="encounterClose.blockedReadiness.value ?? closeReadiness"
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
