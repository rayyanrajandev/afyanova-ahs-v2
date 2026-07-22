<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { Head, Link } from '@inertiajs/vue3';
import { computed, nextTick, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/AppLayout.vue';
import EncounterLifecycleDialog from '@/components/domain/clinical/EncounterLifecycleDialog.vue';
import LaboratoryOrderDetailSheet from '@/components/laboratoryOrders/LaboratoryOrderDetailSheet.vue';
import PatientChartOrdersDomainSection from '@/components/patient-chart/PatientChartOrdersDomainSection.vue';
import PatientEditSheet from '@/components/patients/PatientEditSheet.vue';
import { apiGet } from '@/lib/apiClient';
import { formatEnumLabel } from '@/lib/labels';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { usePatientMedicalRecords } from '@/composables/patientChart/usePatientMedicalRecords';
import { usePatientAppointments } from '@/composables/patientChart/usePatientAppointments';
import { usePatientEncounters } from '@/composables/patientChart/usePatientEncounters';
import { usePatientChartOrderStream } from '@/composables/patientChart/usePatientChartOrderStream';
import { usePatientBillingInvoices } from '@/composables/patientChart/usePatientBillingInvoices';
import { usePatientAllergies } from '@/composables/patientChart/usePatientAllergies';
import { usePatientAllergyDialog } from '@/composables/patientChart/usePatientAllergyDialog';
import { usePatientMedicationProfile } from '@/composables/patientChart/usePatientMedicationProfile';
import { usePatientMedicationProfileDialog } from '@/composables/patientChart/usePatientMedicationProfileDialog';
import { usePatientMedicationReconciliation } from '@/composables/patientChart/usePatientMedicationReconciliation';
import { useVisitScope } from '@/composables/patientChart/useVisitScope';
import { usePatientChartOrderLifecycle } from '@/composables/patientChart/usePatientChartOrderLifecycle';
import { useLaboratoryOrder } from '@/composables/laboratoryOrders/useLaboratoryOrder';
import { usePatientInsuranceRecords } from '@/composables/patientChart/usePatientInsuranceRecords';
import { usePatientInsuranceDialog } from '@/composables/patientChart/usePatientInsuranceDialog';
import { exportPatientAuditLogsCsv, usePatientAuditLogs } from '@/composables/patientChart/usePatientAuditLogs';
import {
    formatDate,
    formatDateTime,
    formatMoney,
    timelineCategoryLabel,
    truncatePlainText,
    usePatientChartTimeline,
    workflowStatusVariant,
    appointmentStatusVariant,
} from '@/composables/patientChart/usePatientChartTimeline';
import {
    appointmentPrimaryActionHref,
    appointmentPrimaryActionIcon,
    appointmentPrimaryActionLabel,
    resolvePrimaryVisit,
} from '@/composables/patientChart/patientChartAppointmentAction';
import {
    isCurrentLaboratoryOrder,
    isCurrentPharmacyOrder,
    isCurrentRadiologyOrder,
    isCurrentTheatreProcedure,
    laboratoryClinicalSignal,
    laboratoryCurrentPriority,
    laboratoryCurrentRecency,
    pharmacyCurrentPriority,
    pharmacyCurrentRecency,
    radiologyCurrentPriority,
    radiologyCurrentRecency,
    sortCurrentItems,
    theatreCurrentPriority,
    theatreCurrentRecency,
} from '@/composables/patientChart/patientChartCurrentCare';
import {
    laboratoryOrderCardViewModel,
    pharmacyOrderCardViewModel,
    radiologyOrderCardViewModel,
    theatreProcedureCardViewModel,
} from '@/composables/patientChart/patientChartOrderCardViewModel';
import { patientChartModuleHref } from '@/composables/patientChart/patientChartModuleHref';
import { usePatientVitals } from '@/composables/patientChart/usePatientVitals';
import type {
    PatientChartLaboratoryOrder,
    PatientChartLaboratoryOrderStatusCounts,
    PatientChartPharmacyOrder,
    PatientChartPharmacyOrderStatusCounts,
    PatientChartRadiologyOrder,
    PatientChartRadiologyOrderStatusCounts,
    PatientChartTheatreProcedure,
    PatientChartTheatreProcedureStatusCounts,
} from '@/composables/patientChart/patientChartOrderTypes';
import { type BreadcrumbItem } from '@/types';
import VitalsEditSheet from '@/components/patient-chart/VitalsEditSheet.vue';
import { vitalsDisplayRows, vitalsSummaryLine } from '@/lib/vitalsDisplay';

/**
 * Full Patient Chart rebuild (reports/patient-chart-rebuild-plan.md):
 * Overview, Timeline, Visits, Orders & Results, Medications, Billing, and
 * Records tabs. Reachable only via /patients/{id}/chart/v2 when
 * FRONTEND_PATIENT_CHART_V2_ENABLED=true; the existing patients/{id}/chart
 * Show.vue page is completely unaffected.
 */
const props = defineProps<{
    patientId: string;
}>();

const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canReadAppointments = computed(() => hasAccess('appointments.read'));
const canReadMedicalRecords = computed(() => hasAccess('medical.records.read'));
const canReadLaboratoryOrders = computed(() => hasAccess('laboratory.orders.read'));
const canReadPharmacyOrders = computed(() => hasAccess('pharmacy.orders.read'));
const canReadRadiologyOrders = computed(() => hasAccess('radiology.orders.read'));
const canReadTheatreProcedures = computed(() => hasAccess('theatre.procedures.read'));
const canReadBillingInvoices = computed(() => hasAccess('billing.invoices.read'));
const canCreateLaboratoryOrders = computed(() => hasAccess('lab.order'));
const canCreatePharmacyOrders = computed(() => hasAccess('medication.prescribe'));
const canCreateRadiologyOrders = computed(() => hasAccess('imaging.order'));
const canCreateTheatreProcedures = computed(() => hasAccess('theatre.procedures.create'));
const canCreateBillingInvoices = computed(() => hasAccess('billing.invoices.create'));
const canUpdatePatients = computed(() => hasAccess('patient.demographics.update'));
const canRecordOpdTriage = computed(() => isFacilitySuperAdmin.value || hasPermission('emergency.triage.create') || hasPermission('emergency.triage.update-status'));
const canStartConsultation = computed(() => hasAccess('appointments.start-consultation'));
const hasOrdersAndResultsAccess = computed(
    () => canReadLaboratoryOrders.value || canReadPharmacyOrders.value || canReadRadiologyOrders.value || canReadTheatreProcedures.value,
);
const hasMedicationWorkspaceAccess = computed(() => canUpdatePatients.value || canReadPharmacyOrders.value || canCreatePharmacyOrders.value);
const hasBillingAccess = computed(() => canReadBillingInvoices.value || canCreateBillingInvoices.value);
const canReadPatientInsurance = computed(() => hasAccess('patients.insurance.read'));
const canManagePatientInsurance = computed(() => hasAccess('patients.insurance.manage'));
const canVerifyPatientInsurance = computed(() => hasAccess('patients.insurance.verify'));
const canViewPatientAuditLogs = computed(() => hasAccess('patients.view-audit-logs'));

const patientIdRef = computed(() => props.patientId);

const vitalsQuery = usePatientVitals(patientIdRef);
const structuredVitals = computed(() => vitalsQuery.latest.value);
const vitalsHistory = computed(() => vitalsQuery.history.value);
const editVitalsOpen = ref(false);
const recordVitalsOpen = ref(false);
const showVitalsHistory = ref(false);

const vitalsLine = computed(() => {
    if (structuredVitals.value) return vitalsSummaryLine(structuredVitals.value);
    return timeline.primaryVisit.value?.triageVitalsSummary ?? null;
});

const vitalsRows = computed(() => {
    if (!structuredVitals.value) return [];
    return vitalsDisplayRows(structuredVitals.value);
});

function onVitalsUpdated(): void {
    void vitalsQuery.query.refetch();
}

type Patient = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    phone: string | null;
    email: string | null;
    nationalId: string | null;
    countryCode: string | null;
    region: string | null;
    district: string | null;
    addressLine: string | null;
    nextOfKinName: string | null;
    nextOfKinPhone: string | null;
    status: string | null;
    statusReason: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    activeRoutingTickets?: {
        id: string;
        requestNumber: string | null;
        serviceType: string | null;
        priority: string | null;
        status: string | null;
        linkedOrderNumber?: string | null;
    }[];
};

const patientQuery = useQuery({
    queryKey: ['patient-chart-patient', patientIdRef],
    queryFn: () => apiGet<{ data: Patient }>(`/patients/${props.patientId}`).then((r) => r.data),
});
const patient = computed(() => patientQuery.data.value ?? null);

const focusedAppointmentId = ref('');

const editSheetOpen = ref(false);

function onPatientUpdated(): void {
    void patientQuery.refetch();
}

const recordsQuery = usePatientMedicalRecords(patientIdRef, canReadMedicalRecords);
const records = computed(() => recordsQuery.data.value?.data ?? []);
const recordsTotal = computed(
    () => recordsQuery.data.value?.meta?.total ?? records.value.length,
);

const appointmentsQuery = usePatientAppointments(patientIdRef, canReadAppointments);
const appointments = computed(() => appointmentsQuery.data.value?.data ?? []);

const laboratory = usePatientChartOrderStream<
    PatientChartLaboratoryOrder,
    PatientChartLaboratoryOrderStatusCounts
>('/laboratory-orders', { patientId: patientIdRef, enabled: canReadLaboratoryOrders });
const laboratoryOrders = computed(() => laboratory.items.data.value?.data ?? []);

const radiology = usePatientChartOrderStream<
    PatientChartRadiologyOrder,
    PatientChartRadiologyOrderStatusCounts
>('/radiology-orders', { patientId: patientIdRef, enabled: canReadRadiologyOrders });
const radiologyOrders = computed(() => radiology.items.data.value?.data ?? []);

const pharmacy = usePatientChartOrderStream<
    PatientChartPharmacyOrder,
    PatientChartPharmacyOrderStatusCounts
>('/pharmacy-orders', { patientId: patientIdRef, enabled: canReadPharmacyOrders });
const pharmacyOrders = computed(() => pharmacy.items.data.value?.data ?? []);

const theatre = usePatientChartOrderStream<
    PatientChartTheatreProcedure,
    PatientChartTheatreProcedureStatusCounts
>('/theatre-procedures', { patientId: patientIdRef, enabled: canReadTheatreProcedures });
const theatreProcedures = computed(() => theatre.items.data.value?.data ?? []);

const billing = usePatientBillingInvoices(patientIdRef, canReadBillingInvoices);
const billingInvoices = computed(() => billing.items.data.value?.data ?? []);

const allergiesQuery = usePatientAllergies(patientIdRef);
const patientAllergies = computed(() => allergiesQuery.data.value?.data ?? []);

const medicationProfileQuery = usePatientMedicationProfile(patientIdRef);
const medicationProfile = computed(() => medicationProfileQuery.data.value?.data ?? []);

const medicationReconciliationQuery = usePatientMedicationReconciliation(patientIdRef);
const medicationReconciliation = computed(() => medicationReconciliationQuery.data.value ?? null);

function reloadMedicationWorkspace(): void {
    void allergiesQuery.refetch();
    void medicationProfileQuery.refetch();
    void medicationReconciliationQuery.refetch();
    void pharmacy.items.refetch();
    void pharmacy.counts.refetch();
}

const allergyDialog = usePatientAllergyDialog(patientIdRef, reloadMedicationWorkspace);
const medicationProfileDialog = usePatientMedicationProfileDialog(patientIdRef, medicationProfile, reloadMedicationWorkspace);

const insuranceQuery = usePatientInsuranceRecords(patientIdRef, canReadPatientInsurance);
const insuranceRecords = computed(() => insuranceQuery.data.value ?? []);
const insuranceDialog = usePatientInsuranceDialog(patientIdRef, () => void insuranceQuery.refetch());

const auditLogPage = ref(1);
const auditLogQuery = usePatientAuditLogs(patientIdRef, auditLogPage, canViewPatientAuditLogs);
const auditLogs = computed(() => auditLogQuery.data.value?.data ?? []);

const encountersQuery = usePatientEncounters(patientIdRef);
const encounters = computed(() => encountersQuery.data.value?.data ?? []);

const primaryVisit = computed(() => resolvePrimaryVisit(appointments.value, focusedAppointmentId.value));

const visitScope = useVisitScope({
    canReadAppointments,
    hasOrdersAndResultsAccess,
    primaryVisit,
    appointmentsLoading: computed(() => appointmentsQuery.isPending.value),
    appointmentsCount: computed(() => appointments.value.length),
    encounters,
});

const timeline = usePatientChartTimeline({
    patientId: patientIdRef,
    primaryVisit,
    focusedEncounterId: visitScope.focusedEncounterId,
    canReadAppointments,
    canRecordOpdTriage,
    canStartConsultation,
    canReadMedicalRecords,
    canReadLaboratoryOrders,
    canReadRadiologyOrders,
    canReadPharmacyOrders,
    canReadTheatreProcedures,
    canReadBillingInvoices,
    appointments,
    records,
    recordsTotal,
    laboratoryOrders,
    radiologyOrders,
    pharmacyOrders,
    theatreProcedures,
    billingInvoices,
    laboratoryOrderCounts: laboratory.counts.data,
    radiologyOrderCounts: radiology.counts.data,
    pharmacyOrderCounts: pharmacy.counts.data,
    theatreProcedureCounts: theatre.counts.data,
    billingInvoiceCounts: billing.counts.data,
});

const orderLifecycle = usePatientChartOrderLifecycle({
    laboratoryOrders,
    pharmacyOrders,
    radiologyOrders,
    theatreProcedures,
    onChanged: () => {
        void laboratory.items.refetch();
        void laboratory.counts.refetch();
        void radiology.items.refetch();
        void radiology.counts.refetch();
        void pharmacy.items.refetch();
        void pharmacy.counts.refetch();
        void theatre.items.refetch();
        void theatre.counts.refetch();
    },
});

// Inline "review result" — opens LaboratoryOrderDetailSheet.vue directly
// on this page instead of navigating to the Laboratory Orders module (the
// nextActionHref path every other order kind/action here still uses).
const reviewLabOrderId = ref<string | null>(null);
const reviewLabSheetOpen = ref(false);
const reviewLabOrderQuery = useLaboratoryOrder(reviewLabOrderId);

function openLabResultReview(id: string): void {
    reviewLabOrderId.value = id;
    reviewLabSheetOpen.value = true;
}

const viewModelContext = computed(() => ({
    patientId: props.patientId,
    appointmentId: primaryVisit.value?.id ?? null,
    canReadLaboratoryOrders: canReadLaboratoryOrders.value,
    canReadRadiologyOrders: canReadRadiologyOrders.value,
    canReadPharmacyOrders: canReadPharmacyOrders.value,
    canReadTheatreProcedures: canReadTheatreProcedures.value,
    canCreateLaboratoryOrders: canCreateLaboratoryOrders.value,
    canCreateRadiologyOrders: canCreateRadiologyOrders.value,
    canCreatePharmacyOrders: canCreatePharmacyOrders.value,
    canCreateTheatreProcedures: canCreateTheatreProcedures.value,
}));

function scopedOrders<T extends { encounterId: string | null }>(
    items: T[],
    isCurrent: (item: T) => boolean,
    sortForCurrent: (items: T[]) => T[],
): T[] {
    if (visitScope.useFocusedVisitOrdersScope.value) {
        return visitScope.focusedEncounterId.value
            ? items.filter((item) => item.encounterId === visitScope.focusedEncounterId.value)
            : [];
    }
    if (visitScope.useCurrentOrdersScope.value) {
        return sortForCurrent(items.filter(isCurrent));
    }
    return items;
}

function scopeLabelFor(domainLabel: string): string {
    if (visitScope.useFocusedVisitOrdersScope.value) return 'Focused visit orders';
    if (visitScope.useCurrentOrdersScope.value) return `Current ${domainLabel} work`;
    return `Recent ${domainLabel} orders`;
}
function scopeDescriptionFor(domainLabel: string, currentWorkDescription: string): string {
    if (visitScope.useFocusedVisitOrdersScope.value) {
        return 'Only orders linked to the visit currently in chart focus are shown here.';
    }
    if (visitScope.useCurrentOrdersScope.value) {
        return currentWorkDescription;
    }
    return `The most recent ${domainLabel} orders across the patient history are shown here.`;
}

const scopedLaboratoryOrders = computed(() => scopedOrders(laboratoryOrders.value, isCurrentLaboratoryOrder, (items) => sortCurrentItems(items, laboratoryCurrentPriority, laboratoryCurrentRecency)));
const displayedLaboratoryOrders = computed(() => scopedLaboratoryOrders.value.slice(0, 5));
const laboratoryCards = computed(() => displayedLaboratoryOrders.value.map((order) => laboratoryOrderCardViewModel(order, viewModelContext.value)));
const hasCriticalLaboratoryResult = computed(() => displayedLaboratoryOrders.value.some((order) => laboratoryClinicalSignal(order).label === 'Critical result'));

const scopedRadiologyOrders = computed(() => scopedOrders(radiologyOrders.value, isCurrentRadiologyOrder, (items) => sortCurrentItems(items, radiologyCurrentPriority, radiologyCurrentRecency)));
const displayedRadiologyOrders = computed(() => scopedRadiologyOrders.value.slice(0, 5));
const radiologyCards = computed(() => displayedRadiologyOrders.value.map((order) => radiologyOrderCardViewModel(order, viewModelContext.value)));

const scopedPharmacyOrders = computed(() => scopedOrders(pharmacyOrders.value, isCurrentPharmacyOrder, (items) => sortCurrentItems(items, pharmacyCurrentPriority, pharmacyCurrentRecency)));
const displayedPharmacyOrders = computed(() => scopedPharmacyOrders.value.slice(0, 5));
const pharmacyCards = computed(() => displayedPharmacyOrders.value.map((order) => pharmacyOrderCardViewModel(order, viewModelContext.value)));

const scopedTheatreProcedures = computed(() => scopedOrders(theatreProcedures.value, isCurrentTheatreProcedure, (items) => sortCurrentItems(items, theatreCurrentPriority, theatreCurrentRecency)));
const displayedTheatreProcedures = computed(() => scopedTheatreProcedures.value.slice(0, 5));
const theatreCards = computed(() => displayedTheatreProcedures.value.map((procedure) => theatreProcedureCardViewModel(procedure, viewModelContext.value)));

const ordersWorkspaceTab = ref<'laboratory' | 'imaging' | 'pharmacy' | 'procedures'>('laboratory');

function patientName(target: Patient | null): string {
    if (!target) return '';
    return (
        [target.firstName, target.middleName, target.lastName].filter(Boolean).join(' ').trim() ||
        target.patientNumber ||
        target.id
    );
}

function ageLabel(value: string | null | undefined): string {
    if (!value) return 'Age not recorded';
    const dob = new Date(value);
    if (Number.isNaN(dob.getTime())) return 'Age not recorded';
    const today = new Date();
    let years = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const dayDiff = today.getDate() - dob.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) years -= 1;
    return years >= 0 ? `${years}y` : 'Age not recorded';
}

function medicationProfileLine(profile: { dose: string | null; route: string | null; frequency: string | null }): string {
    return [profile.dose, profile.route ? formatEnumLabel(profile.route) : null, profile.frequency ? formatEnumLabel(profile.frequency) : null]
        .filter(Boolean)
        .join(' | ') || 'Schedule not recorded';
}

function allergySeverityVariant(severity: string | null | undefined): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch ((severity ?? '').toLowerCase()) {
        case 'life_threatening':
        case 'severe':
            return 'destructive';
        case 'moderate':
            return 'secondary';
        default:
            return 'outline';
    }
}

const recordsListHref = computed(() => `/medical-records?${new URLSearchParams({ patientId: props.patientId }).toString()}`);

function recordStatusVariant(status: string | null | undefined): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'finalized':
            return 'secondary';
        case 'amended':
            return 'default';
        default:
            return 'outline';
    }
}

const medicationWorkspaceSectionIds = {
    allergies: 'patient-chart-v2-medication-allergies',
    profile: 'patient-chart-v2-medication-profile',
    reconciliation: 'patient-chart-v2-medication-reconciliation',
};

function scrollToMedicationWorkspaceSection(section: keyof typeof medicationWorkspaceSectionIds): void {
    if (typeof document === 'undefined') return;
    document.getElementById(medicationWorkspaceSectionIds[section])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Overview quick-stat tiles glance at data that lives on another tab —
 * clicking one should take the user there, same as "Next step" already
 * does for the timeline. Waits a tick so the target TabsContent (kept in
 * the DOM but hidden while inactive) is visible before scrollIntoView runs.
 */
function openOverviewSummaryTab(
    tab: 'medications' | 'orders' | 'records',
    section?: keyof typeof medicationWorkspaceSectionIds,
): void {
    activeTab.value = tab;
    if (section) {
        nextTick(() => scrollToMedicationWorkspaceSection(section));
    }
}

const patientDemographics = computed(() => {
    if (!patient.value) return null;
    return [patient.value.gender || 'Gender not recorded', ageLabel(patient.value.dateOfBirth), patient.value.patientNumber]
        .filter(Boolean)
        .join(' · ');
});

const pageTitle = computed(() => (patient.value ? `${patientName(patient.value)} | Patient Chart` : 'Patient Chart'));

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Patients', href: '/patients' },
    {
        title: patient.value ? patientName(patient.value) : 'Patient Chart',
        href: `/patients/${props.patientId}/chart/v2`,
    },
]);

const activeTab = ref<
    'overview' | 'timeline' | 'visits' | 'medications' | 'orders' | 'billing' | 'records' | 'insurance' | 'audit'
>('overview');

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head :title="pageTitle" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <Tabs v-model="activeTab" class="contents">
            <div
                v-if="patient"
                class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            >
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <div class="flex flex-wrap items-baseline gap-2">
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">{{ patientName(patient) }}</h1>
                            <span v-if="patientDemographics" class="text-xs text-muted-foreground">{{ patientDemographics }}</span>
                        </div>
                        <p class="text-xs text-muted-foreground">
                            {{ timeline.primaryVisit.value ? `Focused: ${timeline.primaryVisit.value.appointmentNumber || 'Current visit'}` : 'Longitudinal patient chart' }}
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <Button v-if="canUpdatePatients" variant="outline" size="sm" class="gap-1.5" @click="editSheetOpen = true">
                            <AppIcon name="pencil" class="size-3.5" />Update Profile
                        </Button>
                        <Badge v-if="patient.status" variant="outline">{{ formatEnumLabel(patient.status) }}</Badge>
                    </div>
                </div>

                <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Visits</p>
                        <p class="text-sm font-bold tabular-nums">{{ timeline.chartCounts.value.visits }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Active orders</p>
                        <p class="text-sm font-bold tabular-nums">
                            {{ timeline.careCounts.value.labActive + timeline.careCounts.value.imagingActive + timeline.careCounts.value.pharmacyActive + timeline.careCounts.value.procedureActive }}
                        </p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Consultation notes</p>
                        <p class="text-sm font-bold tabular-nums">{{ timeline.chartCounts.value.records }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Open invoices</p>
                        <p class="text-sm font-bold tabular-nums">{{ timeline.careCounts.value.billingOpen }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Timeline events</p>
                        <p class="text-sm font-bold tabular-nums">{{ timeline.chartCounts.value.timelineEvents }}</p>
                    </div>
                </div>

                <TabsList class="mt-3 flex w-full flex-wrap justify-start gap-1">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="timeline" class="inline-flex items-center gap-1.5">
                        Timeline
                        <Badge v-if="timeline.chartCounts.value.timelineEvents" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                            {{ timeline.chartCounts.value.timelineEvents }}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger v-if="canReadAppointments" value="visits" class="inline-flex items-center gap-1.5">
                        Visits
                        <Badge v-if="timeline.chartCounts.value.activeVisits" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                            {{ timeline.chartCounts.value.activeVisits }}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger v-if="hasMedicationWorkspaceAccess" value="medications" class="inline-flex items-center gap-1.5">
                        Medications
                        <Badge v-if="medicationReconciliation && medicationReconciliation.counts.unreconciledDispensedOrders > 0" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                            {{ medicationReconciliation.counts.unreconciledDispensedOrders }}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger v-if="hasOrdersAndResultsAccess" value="orders" class="inline-flex items-center gap-1.5">
                        Orders &amp; Results
                    </TabsTrigger>
                    <TabsTrigger v-if="hasBillingAccess" value="billing" class="inline-flex items-center gap-1.5">
                        Billing
                        <Badge v-if="timeline.careCounts.value.billingOpen" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                            {{ timeline.careCounts.value.billingOpen }}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger v-if="canReadMedicalRecords" value="records" class="inline-flex items-center gap-1.5">
                        Notes
                        <Badge v-if="timeline.chartCounts.value.records" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                            {{ timeline.chartCounts.value.records }}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger v-if="canReadPatientInsurance" value="insurance" class="inline-flex items-center gap-1.5">
                        Insurance
                        <Badge v-if="insuranceRecords.length" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                            {{ insuranceRecords.length }}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger v-if="canViewPatientAuditLogs" value="audit" class="inline-flex items-center gap-1.5">
                        Audit
                    </TabsTrigger>
                </TabsList>
            </div>

            <div class="space-y-4 p-4 md:p-6">
                <div v-if="patientQuery.isPending.value" class="space-y-2">
                    <Skeleton class="h-6 w-1/2" />
                    <Skeleton class="h-24 w-full" />
                </div>

                <Alert v-else-if="patientQuery.isError.value" variant="destructive">
                    <AlertTitle>Unable to load this patient chart</AlertTitle>
                    <AlertDescription>{{ (patientQuery.error.value as Error | null)?.message ?? 'Unknown error.' }}</AlertDescription>
                </Alert>

                <template v-else-if="patient">
                    <TabsContent value="overview" class="space-y-6">
                        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <button
                                type="button"
                                class="rounded-lg border bg-background px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-background"
                                :disabled="!hasMedicationWorkspaceAccess"
                                @click="openOverviewSummaryTab('medications', 'allergies')"
                            >
                                <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Allergy safety</p>
                                <p class="mt-2 text-sm font-medium text-foreground">
                                    <template v-if="allergiesQuery.isPending.value">Loading…</template>
                                    <template v-else-if="patientAllergies.length === 0">No allergies on record</template>
                                    <template v-else>{{ patientAllergies.length }} allerg{{ patientAllergies.length === 1 ? 'y' : 'ies' }} recorded</template>
                                </p>
                            </button>
                            <button
                                type="button"
                                class="rounded-lg border bg-background px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-background"
                                :disabled="!hasOrdersAndResultsAccess"
                                @click="openOverviewSummaryTab('orders')"
                            >
                                <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Active care</p>
                                <p class="mt-2 text-sm font-medium text-foreground">
                                    {{ timeline.careCounts.value.labActive + timeline.careCounts.value.imagingActive + timeline.careCounts.value.pharmacyActive + timeline.careCounts.value.procedureActive }}
                                    active order{{ (timeline.careCounts.value.labActive + timeline.careCounts.value.imagingActive + timeline.careCounts.value.pharmacyActive + timeline.careCounts.value.procedureActive) === 1 ? '' : 's' }}
                                </p>
                            </button>
                            <button
                                type="button"
                                class="rounded-lg border bg-background px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-background"
                                :disabled="!canReadMedicalRecords"
                                @click="openOverviewSummaryTab('records')"
                            >
                                <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Problem focus</p>
                                <p class="mt-2 text-sm text-foreground">
                                    {{ timeline.latestRecord.value ? timeline.recordProblem(timeline.latestRecord.value) : 'No problem focus recorded yet.' }}
                                </p>
                            </button>
                            <button
                                type="button"
                                class="rounded-lg border bg-background px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                                @click="activeTab = 'timeline'"
                            >
                                <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Next step</p>
                                <p class="mt-2 text-sm text-foreground">{{ timeline.nextDocumentedStep.value }}</p>
                                <span class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                                    <AppIcon name="activity" class="size-3.5" />Open timeline
                                </span>
                            </button>
                        </div>

                        <Card v-if="canReadAppointments && timeline.visitFocusOptions.value.length > 0" class="rounded-lg">
                            <CardHeader class="pb-3">
                                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <CardTitle>Encounter focus</CardTitle>
                                        <p class="mt-1 text-sm text-muted-foreground">
                                            Keep the chart anchored to the visit you mean before opening downstream care.
                                        </p>
                                    </div>
                                    <Button v-if="focusedAppointmentId" size="sm" variant="ghost" @click="focusedAppointmentId = ''">
                                        Auto-select visit
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent class="space-y-3">
                                <div class="flex flex-wrap gap-2">
                                    <Button
                                        v-for="appointment in timeline.visitFocusOptions.value"
                                        :key="appointment.id"
                                        size="sm"
                                        :variant="timeline.primaryVisit.value?.id === appointment.id ? 'default' : 'outline'"
                                        class="gap-1.5"
                                        @click="focusedAppointmentId = appointment.id"
                                    >
                                        <AppIcon name="calendar-clock" class="size-3.5" />
                                        {{ appointment.appointmentNumber || formatDateTime(appointment.scheduledAt) }}
                                    </Button>
                                </div>
                                <p class="text-xs text-muted-foreground">
                                    Current chart focus:
                                    {{
                                        timeline.primaryVisit.value
                                            ? `${timeline.primaryVisit.value.appointmentNumber || 'Visit'} | ${timeline.primaryVisit.value.department || 'Department pending'} | ${formatEnumLabel(timeline.primaryVisit.value.status || 'scheduled')}`
                                            : 'Automatic selection based on active visit state.'
                                    }}
                                </p>
                            </CardContent>
                        </Card>

                        <Card class="rounded-lg">
                            <CardHeader class="pb-3">
                                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <CardTitle>Recent care timeline</CardTitle>
                                        <p class="mt-1 text-sm text-muted-foreground">
                                            The latest patient events across visits, consultation notes, results, medication, and billing.
                                        </p>
                                    </div>
                                    <Button size="sm" variant="outline" class="gap-1.5" @click="activeTab = 'timeline'">
                                        <AppIcon name="activity" class="size-3.5" />Open full timeline
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div v-if="timeline.timelinePreview.value.length === 0" class="rounded-lg border border-dashed px-4 py-4">
                                    <p class="text-sm font-medium text-foreground">No timeline events recorded yet</p>
                                    <p class="mt-1 text-sm text-muted-foreground">
                                        Visits, consultation notes, results, and billing signals will appear here as care progresses.
                                    </p>
                                </div>
                                <div v-else class="space-y-3">
                                    <div
                                        v-for="event in timeline.timelinePreview.value"
                                        :key="event.id"
                                        :class="['rounded-lg border border-l-4 px-4 py-4', event.accentClass]"
                                    >
                                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div class="min-w-0 space-y-2">
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <Badge variant="secondary">{{ timelineCategoryLabel(event.category) }}</Badge>
                                                    <Badge v-if="event.status" :variant="workflowStatusVariant(event.status)">{{ formatEnumLabel(event.status) }}</Badge>
                                                    <span class="text-xs text-muted-foreground">{{ formatDateTime(event.occurredAt) }}</span>
                                                </div>
                                                <div class="flex items-start gap-3">
                                                    <div class="rounded-lg bg-muted/40 p-2 text-muted-foreground">
                                                        <AppIcon :name="event.icon" class="size-4" />
                                                    </div>
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-sm font-semibold text-foreground">{{ event.title }}</p>
                                                        <p class="text-xs text-muted-foreground">{{ event.subtitle }}</p>
                                                        <p class="text-sm text-foreground">{{ event.summary }}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button v-if="event.href && event.actionLabel" size="sm" variant="outline" class="gap-1.5" as-child>
                                                <Link :href="event.href"><AppIcon :name="event.icon" class="size-3.5" />{{ event.actionLabel }}</Link>
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div class="mt-3 rounded-lg border-l-4 border-l-info bg-muted/20 px-4 py-3">
                                    <div class="flex items-center justify-between gap-2">
                                        <div class="flex items-center gap-2 text-sm font-semibold text-foreground">
                                            <AppIcon name="activity" class="size-4 text-info" aria-hidden="true" />
                                            Vitals
                                        </div>
                                        <div v-if="canRecordOpdTriage" class="flex items-center gap-1">
                                            <Button v-if="structuredVitals" size="sm" variant="ghost" class="h-6 gap-1 px-1.5 text-xs" @click="editVitalsOpen = true">
                                                <AppIcon name="pencil" class="size-3" />Edit
                                            </Button>
                                            <Button size="sm" variant="outline" class="h-6 gap-1 px-1.5 text-xs" @click="recordVitalsOpen = true">
                                                <AppIcon name="plus" class="size-3" />Record vitals
                                            </Button>
                                        </div>
                                    </div>
                                    <template v-if="structuredVitals">
                                        <div class="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 sm:grid-cols-6">
                                            <div v-for="row in vitalsRows" :key="row.label" class="space-y-0">
                                                <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{{ row.label }}</p>
                                                <p class="text-sm font-semibold tabular-nums text-foreground">{{ row.value ?? '—' }} <span class="text-xs font-normal text-muted-foreground">{{ row.unit }}</span></p>
                                            </div>
                                        </div>
                                        <p class="mt-1 text-[10px] text-muted-foreground">{{ formatDateTime(structuredVitals.recordedAt) }}</p>
                                        <div v-if="vitalsHistory.length" class="mt-2">
                                            <button
                                                type="button"
                                                class="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                                                :aria-expanded="showVitalsHistory"
                                                @click="showVitalsHistory = !showVitalsHistory"
                                            >
                                                <AppIcon :name="showVitalsHistory ? 'chevron-down' : 'chevron-right'" class="size-3" />
                                                {{ vitalsHistory.length }} previous set{{ vitalsHistory.length === 1 ? '' : 's' }}
                                            </button>
                                            <div v-if="showVitalsHistory" class="mt-2 space-y-2">
                                                <div v-for="set in vitalsHistory" :key="set.id" class="rounded-md border bg-muted/10 px-3 py-2">
                                                    <div class="grid grid-cols-3 gap-x-4 gap-y-1 sm:grid-cols-6">
                                                        <div v-for="row in vitalsDisplayRows(set)" :key="row.label" class="space-y-0">
                                                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{{ row.label }}</p>
                                                            <p class="text-xs font-semibold tabular-nums text-foreground">{{ row.value ?? '—' }} <span class="text-[10px] font-normal text-muted-foreground">{{ row.unit }}</span></p>
                                                        </div>
                                                    </div>
                                                    <p class="mt-1 text-[10px] text-muted-foreground">{{ formatDateTime(set.recordedAt) }}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                    <p v-else class="mt-1 text-sm text-muted-foreground">{{ vitalsLine || 'No vitals recorded yet.' }}</p>
                                </div>

                            </CardContent>
                        </Card>

                        <section
                            v-if="patient.activeRoutingTickets?.length"
                            class="rounded-lg border bg-background px-4 py-3"
                        >
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div class="flex min-w-0 items-center gap-3">
                                    <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-border">
                                        <AppIcon name="arrow-right" class="size-4" />
                                    </span>
                                    <div class="min-w-0">
                                        <p class="text-sm font-semibold text-foreground">Active handoffs</p>
                                        <p class="text-xs text-muted-foreground">
                                            {{ patient.activeRoutingTickets.length }} service request{{ patient.activeRoutingTickets.length === 1 ? '' : 's' }} already moving for this patient.
                                        </p>
                                    </div>
                                </div>
                                <div class="grid gap-2 lg:min-w-[28rem] lg:grid-cols-2">
                                    <div
                                        v-for="ticket in patient.activeRoutingTickets"
                                        :key="ticket.id"
                                        class="rounded-md border bg-muted/20 px-3 py-2"
                                    >
                                        <div class="flex items-start justify-between gap-2">
                                            <div class="min-w-0">
                                                <p class="truncate text-sm font-medium text-foreground">
                                                    {{ ticket.requestNumber || formatEnumLabel(ticket.serviceType || 'service_request') }}
                                                </p>
                                                <p class="mt-0.5 text-xs text-muted-foreground">{{ formatEnumLabel(ticket.serviceType || 'service_request') }}</p>
                                            </div>
                                            <Badge variant="outline">{{ formatEnumLabel(ticket.status || 'waiting') }}</Badge>
                                        </div>
                                        <div class="mt-2 flex flex-wrap gap-1.5">
                                            <Badge v-if="ticket.priority" variant="secondary">{{ formatEnumLabel(ticket.priority) }}</Badge>
                                            <Badge v-if="ticket.linkedOrderNumber" variant="outline">{{ ticket.linkedOrderNumber }}</Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </TabsContent>

                    <TabsContent value="timeline" class="space-y-6">
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div class="space-y-1">
                                <p class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Timeline</p>
                                <p class="text-sm text-muted-foreground">
                                    Read this patient chart as one continuous care story across visit flow, consultation, results, medication, and billing.
                                </p>
                            </div>
                        </div>

                        <div v-if="timeline.timelineEvents.value.length === 0" class="rounded-lg border border-dashed bg-card px-5 py-5">
                            <p class="text-base font-medium text-foreground">No timeline events recorded yet</p>
                            <p class="mt-1 text-sm text-muted-foreground">
                                This chart will start building a patient story as visits, notes, results, medication, and billing items are recorded.
                            </p>
                        </div>

                        <div v-else class="space-y-6">
                            <div :class="['grid gap-2', timeline.latestClinicalSignal.value ? 'xl:grid-cols-3' : 'xl:grid-cols-2']">
                                <div class="flex min-h-20 items-start gap-3 rounded-lg border bg-muted/30 px-3 py-3">
                                    <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
                                        <AppIcon name="calendar-clock" class="size-4" />
                                    </span>
                                    <div class="min-w-0 space-y-1">
                                        <p class="text-xs font-medium text-muted-foreground">Care status</p>
                                        <p class="text-sm font-semibold text-foreground">{{ timeline.handoffSummary.value.title }}</p>
                                        <p class="line-clamp-2 text-xs text-muted-foreground">{{ timeline.handoffSummary.value.summary }}</p>
                                        <p class="truncate text-xs text-muted-foreground">{{ timeline.handoffSummary.value.meta }}</p>
                                    </div>
                                </div>

                                <div
                                    v-if="timeline.latestClinicalSignal.value"
                                    class="flex min-h-20 items-start gap-3 rounded-lg border bg-muted/30 px-3 py-3"
                                >
                                    <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
                                        <AppIcon :name="timeline.latestClinicalSignal.value.icon" class="size-4" />
                                    </span>
                                    <div class="min-w-0 space-y-1">
                                        <p class="text-xs font-medium text-muted-foreground">Latest clinical signal</p>
                                        <p class="truncate text-sm font-semibold text-foreground">{{ timeline.latestClinicalSignal.value.title }}</p>
                                        <p class="line-clamp-2 text-xs text-muted-foreground">{{ timeline.latestClinicalSignal.value.summary }}</p>
                                        <p class="truncate text-xs text-muted-foreground">
                                            {{ `${timelineCategoryLabel(timeline.latestClinicalSignal.value.category)} | ${formatDateTime(timeline.latestClinicalSignal.value.occurredAt)}` }}
                                        </p>
                                    </div>
                                </div>

                                <div class="flex min-h-20 items-start gap-3 rounded-lg border bg-muted/30 px-3 py-3">
                                    <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
                                        <AppIcon name="arrow-right" class="size-4" />
                                    </span>
                                    <div class="min-w-0 space-y-2">
                                        <div class="space-y-1">
                                            <p class="text-xs font-medium text-muted-foreground">Next documented step</p>
                                            <p class="line-clamp-3 text-sm font-semibold text-foreground">{{ timeline.nextDocumentedStep.value }}</p>
                                        </div>
                                        <Button
                                            v-if="canReadAppointments && timeline.primaryVisit.value"
                                            size="sm"
                                            variant="outline"
                                            class="h-8 gap-1.5"
                                            as-child
                                        >
                                            <Link :href="timeline.visitPrimaryActionHref.value">
                                                <AppIcon :name="timeline.visitPrimaryActionIcon.value" class="size-3.5" />{{ timeline.visitPrimaryActionLabel.value }}
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <Card v-if="timeline.primaryVisit.value" class="rounded-lg">
                                <CardHeader class="pb-3">
                                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <CardTitle>Visit in focus</CardTitle>
                                            <div class="mt-2 flex flex-wrap gap-2">
                                                <Badge variant="secondary">{{ timeline.primaryVisit.value.appointmentNumber || 'Current visit' }}</Badge>
                                                <Badge variant="outline">{{ timeline.primaryVisit.value.department || 'Department pending' }}</Badge>
                                                <Badge :variant="appointmentStatusVariant(timeline.primaryVisit.value.status)">
                                                    {{ formatEnumLabel(timeline.primaryVisit.value.status || 'scheduled') }}
                                                </Badge>
                                                <Badge variant="outline">{{ formatDateTime(timeline.primaryVisit.value.scheduledAt) }}</Badge>
                                            </div>
                                        </div>
                                        <div class="flex flex-wrap gap-2">
                                            <Button size="sm" variant="outline" class="gap-1.5" as-child>
                                                <Link :href="timeline.appointmentDetailsHref(timeline.primaryVisit.value)">
                                                    <AppIcon name="calendar-clock" class="size-3.5" />Open visit
                                                </Link>
                                            </Button>
                                            <Button v-if="focusedAppointmentId" size="sm" variant="ghost" @click="focusedAppointmentId = ''">
                                                Auto-select visit
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent class="space-y-3">
                                    <div class="flex flex-wrap gap-2">
                                        <Badge variant="secondary">{{ timeline.focusedEncounterCounts.value.total }} linked events</Badge>
                                        <Badge variant="outline">{{ timeline.focusedEncounterCounts.value.notes }} notes</Badge>
                                        <Badge variant="outline">{{ timeline.focusedEncounterCounts.value.orders }} orders/results</Badge>
                                        <Badge variant="outline">{{ timeline.focusedEncounterCounts.value.billing }} billing</Badge>
                                    </div>

                                    <div class="flex items-start gap-3 rounded-lg border bg-muted/20 px-3 py-3">
                                        <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
                                            <AppIcon :name="timeline.focusedEncounterLatestEvent.value ? timeline.focusedEncounterLatestEvent.value.icon : 'book-open'" class="size-4" />
                                        </span>
                                        <div class="min-w-0 space-y-1">
                                            <p class="text-xs font-medium text-muted-foreground">Latest encounter signal</p>
                                            <p class="truncate text-sm font-semibold text-foreground">
                                                {{ timeline.focusedEncounterLatestEvent.value ? timeline.focusedEncounterLatestEvent.value.title : 'No linked encounter signal' }}
                                            </p>
                                            <p class="line-clamp-2 text-sm text-foreground">
                                                {{ timeline.focusedEncounterLatestEvent.value ? timeline.focusedEncounterLatestEvent.value.summary : 'This visit is in chart focus, but no consultation note, order, result, or billing item has been linked to it yet.' }}
                                            </p>
                                            <p class="truncate text-xs text-muted-foreground">
                                                {{ timeline.focusedEncounterLatestEvent.value ? timelineCategoryLabel(timeline.focusedEncounterLatestEvent.value.category) + ' | ' + formatDateTime(timeline.focusedEncounterLatestEvent.value.occurredAt) : 'The focused encounter stream will fill as care is recorded.' }}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div class="space-y-5">
                                <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <p class="text-sm font-semibold text-foreground">Patient timeline</p>
                                        <p class="text-xs text-muted-foreground">{{ timeline.timelineEvents.value.length }} event{{ timeline.timelineEvents.value.length === 1 ? '' : 's' }} across this chart.</p>
                                    </div>
                                </div>
                                <div v-for="section in timeline.timelineSections.value" :key="section.key" class="space-y-3">
                                    <div class="flex items-center gap-2 text-xs text-muted-foreground">
                                        <div class="h-px flex-1 bg-border"></div>
                                        <span class="font-medium tracking-[0.12em] uppercase">{{ section.label }}</span>
                                        <div class="h-px flex-1 bg-border"></div>
                                    </div>

                                    <div class="space-y-2">
                                        <template v-for="event in section.events" :key="event.id">
                                            <div v-if="!event.actionLabel" :class="['flex items-center gap-3 rounded-lg border border-l-4 px-3 py-2', event.accentClass]">
                                                <div class="min-w-0 flex-1">
                                                    <span class="text-sm font-medium text-foreground">{{ event.title }}</span>
                                                    <span v-if="event.subtitle" class="ml-1.5 text-xs text-muted-foreground">{{ event.subtitle }}</span>
                                                </div>
                                                <div class="flex shrink-0 items-center gap-1.5">
                                                    <Badge v-if="event.status" :variant="workflowStatusVariant(event.status)" class="text-xs">{{ formatEnumLabel(event.status) }}</Badge>
                                                    <span class="text-xs text-muted-foreground">{{ formatDateTime(event.occurredAt) }}</span>
                                                </div>
                                            </div>
                                            <div v-else :class="['rounded-lg border border-l-4 px-4 py-4', event.accentClass]">
                                                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                    <div class="min-w-0 space-y-2">
                                                        <div class="flex flex-wrap items-center gap-2">
                                                            <Badge variant="secondary">{{ timelineCategoryLabel(event.category) }}</Badge>
                                                            <Badge v-if="event.status" :variant="workflowStatusVariant(event.status)">{{ formatEnumLabel(event.status) }}</Badge>
                                                            <span class="text-xs text-muted-foreground">{{ formatDateTime(event.occurredAt) }}</span>
                                                        </div>
                                                        <div class="flex items-start gap-3">
                                                            <div class="rounded-lg bg-muted/40 p-2 text-muted-foreground">
                                                                <AppIcon :name="event.icon" class="size-4" />
                                                            </div>
                                                            <div class="min-w-0 space-y-1">
                                                                <p class="text-sm font-semibold text-foreground">{{ event.title }}</p>
                                                                <p class="text-xs text-muted-foreground">{{ event.subtitle }}</p>
                                                                <p class="text-sm text-foreground">{{ event.summary }}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button size="sm" variant="outline" class="gap-1.5" as-child>
                                                        <Link :href="event.href!"><AppIcon :name="event.icon" class="size-3.5" />{{ event.actionLabel }}</Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        </template>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent v-if="canReadAppointments" value="visits" class="space-y-6">
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div class="space-y-1">
                                <p class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Visits</p>
                                <p class="text-sm text-muted-foreground">Review current and recent visit context without leaving the patient chart.</p>
                            </div>
                            <Button size="sm" class="gap-1.5" as-child>
                                <Link :href="timeline.visitPrimaryActionHref.value"><AppIcon :name="timeline.visitPrimaryActionIcon.value" class="size-3.5" />{{ timeline.visitPrimaryActionLabel.value }}</Link>
                            </Button>
                        </div>

                        <div v-if="appointmentsQuery.isPending.value" class="space-y-3">
                            <Skeleton class="h-28 w-full rounded-lg" />
                            <Skeleton class="h-28 w-full rounded-lg" />
                        </div>

                        <Alert v-else-if="appointmentsQuery.isError.value" variant="destructive">
                            <AlertTitle>Visits unavailable</AlertTitle>
                            <AlertDescription>{{ (appointmentsQuery.error.value as Error | null)?.message ?? 'Unable to load visits.' }}</AlertDescription>
                        </Alert>

                        <div v-else-if="appointments.length === 0" class="rounded-lg border border-dashed bg-card px-5 py-5">
                            <p class="text-base font-medium text-foreground">No visits recorded for this patient yet</p>
                            <p class="mt-1 text-sm text-muted-foreground">Schedule the first appointment when this patient is entering the outpatient workflow.</p>
                        </div>

                        <div v-else class="space-y-4">
                            <div v-if="timeline.primaryVisit.value" class="rounded-lg border border-primary/30 bg-primary/5 px-4 py-4">
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="min-w-0 space-y-2">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="text-sm font-semibold text-foreground">Focused visit</p>
                                            <Badge :variant="appointmentStatusVariant(timeline.primaryVisit.value.status)">{{ formatEnumLabel(timeline.primaryVisit.value.status || 'scheduled') }}</Badge>
                                            <Badge v-if="timeline.primaryVisit.value.department" variant="outline">{{ timeline.primaryVisit.value.department }}</Badge>
                                        </div>
                                        <p class="text-sm text-foreground">
                                            {{ timeline.primaryVisit.value.appointmentNumber || 'Visit pending number' }} scheduled {{ formatDateTime(timeline.primaryVisit.value.scheduledAt) }}
                                        </p>
                                        <p class="text-xs text-muted-foreground">{{ timeline.primaryVisit.value.reason || 'No visit reason recorded yet.' }}</p>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Button v-if="focusedAppointmentId" size="sm" variant="ghost" @click="focusedAppointmentId = ''">Auto-select</Button>
                                        <Button size="sm" class="gap-1.5" as-child>
                                            <Link :href="appointmentPrimaryActionHref(timeline.primaryVisit.value, canRecordOpdTriage, canStartConsultation)">
                                                <AppIcon :name="appointmentPrimaryActionIcon(timeline.primaryVisit.value, canRecordOpdTriage, canStartConsultation)" class="size-3.5" />{{ appointmentPrimaryActionLabel(timeline.primaryVisit.value, canRecordOpdTriage, canStartConsultation) }}
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div
                                v-for="appointment in appointments"
                                :key="appointment.id"
                                :class="['rounded-lg border px-4 py-4', timeline.primaryVisit.value?.id === appointment.id ? 'border-primary bg-primary/5' : 'bg-background']"
                            >
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="space-y-2">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="text-sm font-semibold text-foreground">{{ appointment.appointmentNumber || 'Visit pending number' }}</p>
                                            <Badge :variant="appointmentStatusVariant(appointment.status)">{{ formatEnumLabel(appointment.status || 'scheduled') }}</Badge>
                                            <Badge v-if="appointment.department" variant="outline">{{ appointment.department }}</Badge>
                                        </div>
                                        <p class="text-xs text-muted-foreground">
                                            Scheduled {{ formatDateTime(appointment.scheduledAt) }}
                                            <template v-if="appointment.durationMinutes">| {{ appointment.durationMinutes }} min</template>
                                        </p>
                                        <p class="text-sm text-foreground">{{ appointment.reason || 'No reason recorded' }}</p>
                                        <p v-if="appointment.triageVitalsSummary" class="text-xs text-muted-foreground">Triage: {{ appointment.triageVitalsSummary }}</p>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            :variant="timeline.primaryVisit.value?.id === appointment.id ? 'default' : 'outline'"
                                            class="gap-1.5"
                                            @click="focusedAppointmentId = appointment.id"
                                        >
                                            <AppIcon name="book-open" class="size-3.5" />
                                            {{ timeline.primaryVisit.value?.id === appointment.id ? 'In chart focus' : 'Focus in chart' }}
                                        </Button>
                                        <Button size="sm" variant="outline" class="gap-1.5" as-child>
                                            <Link :href="appointmentPrimaryActionHref(appointment, canRecordOpdTriage, canStartConsultation)">
                                                <AppIcon :name="appointmentPrimaryActionIcon(appointment, canRecordOpdTriage, canStartConsultation)" class="size-3.5" />{{ appointmentPrimaryActionLabel(appointment, canRecordOpdTriage, canStartConsultation) }}
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent v-if="hasOrdersAndResultsAccess" value="orders" class="space-y-6">
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div class="space-y-1">
                                <p class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Orders &amp; Results</p>
                                <p class="text-sm text-muted-foreground">Track downstream care from this chart without losing patient or visit context.</p>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <Button v-if="canCreateLaboratoryOrders" size="sm" class="gap-1.5" as-child>
                                    <Link :href="patientChartModuleHref('/laboratory-orders/legacy', props.patientId, primaryVisit?.id ?? null, { includeTabNew: true })"><AppIcon name="flask-conical" class="size-3.5" />Order lab</Link>
                                </Button>
                                <Button v-if="canCreateRadiologyOrders" size="sm" variant="outline" class="gap-1.5" as-child>
                                    <Link :href="patientChartModuleHref('/radiology-orders/legacy', props.patientId, primaryVisit?.id ?? null, { includeTabNew: true })"><AppIcon name="activity" class="size-3.5" />Order imaging</Link>
                                </Button>
                                <Button v-if="canCreatePharmacyOrders" size="sm" variant="outline" class="gap-1.5" as-child>
                                    <Link :href="patientChartModuleHref('/pharmacy-orders/legacy', props.patientId, primaryVisit?.id ?? null, { includeTabNew: true })"><AppIcon name="pill" class="size-3.5" />Order pharmacy</Link>
                                </Button>
                                <Button v-if="canCreateTheatreProcedures" size="sm" variant="outline" class="gap-1.5" as-child>
                                    <Link :href="patientChartModuleHref('/theatre-procedures/legacy', props.patientId, primaryVisit?.id ?? null, { includeTabNew: true })"><AppIcon name="scissors" class="size-3.5" />Schedule procedure</Link>
                                </Button>
                            </div>
                        </div>

                        <div class="rounded-lg border bg-background px-4 py-3">
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div class="space-y-1">
                                    <p class="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">View scope</p>
                                    <p class="text-sm text-foreground">{{ visitScope.ordersWorkspaceScopeSummary.value }}</p>
                                    <p class="text-xs text-muted-foreground">{{ visitScope.ordersWorkspaceScopeHint.value }}</p>
                                </div>
                                <div class="inline-flex w-full rounded-lg border bg-muted/20 p-1 sm:w-auto">
                                    <Button
                                        v-if="visitScope.availableOrdersWorkspaceScopes.value.includes('focused')"
                                        size="sm"
                                        :variant="visitScope.ordersWorkspaceScope.value === 'focused' ? 'default' : 'ghost'"
                                        class="flex-1 gap-1.5 rounded-md sm:flex-none"
                                        @click="visitScope.ordersWorkspaceScope.value = 'focused'"
                                    >
                                        <AppIcon name="calendar-clock" class="size-3.5" />Focused visit
                                    </Button>
                                    <Button
                                        v-if="visitScope.availableOrdersWorkspaceScopes.value.includes('current')"
                                        size="sm"
                                        :variant="visitScope.ordersWorkspaceScope.value === 'current' ? 'default' : 'ghost'"
                                        class="flex-1 gap-1.5 rounded-md sm:flex-none"
                                        @click="visitScope.ordersWorkspaceScope.value = 'current'"
                                    >
                                        <AppIcon name="stethoscope" class="size-3.5" />Current care
                                    </Button>
                                    <Button
                                        v-if="visitScope.availableOrdersWorkspaceScopes.value.includes('history')"
                                        size="sm"
                                        :variant="visitScope.ordersWorkspaceScope.value === 'history' ? 'default' : 'ghost'"
                                        class="flex-1 gap-1.5 rounded-md sm:flex-none"
                                        @click="visitScope.ordersWorkspaceScope.value = 'history'"
                                    >
                                        <AppIcon name="book-open" class="size-3.5" />All visits
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <Tabs v-model="ordersWorkspaceTab" class="space-y-4">
                            <TabsList class="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 xl:grid-cols-4">
                                <TabsTrigger v-if="canReadLaboratoryOrders" value="laboratory" class="h-auto flex-col items-start rounded-lg border bg-muted/20 px-3 py-3 text-left data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5">
                                    <span class="flex items-center gap-1.5 text-sm font-medium text-foreground"><AppIcon name="flask-conical" class="size-3.5" />Laboratory</span>
                                    <span class="mt-1 text-xs text-muted-foreground">{{ timeline.careCounts.value.labActive }} active | {{ timeline.careCounts.value.labCompleted }} completed</span>
                                </TabsTrigger>
                                <TabsTrigger v-if="canReadRadiologyOrders" value="imaging" class="h-auto flex-col items-start rounded-lg border bg-muted/20 px-3 py-3 text-left data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5">
                                    <span class="flex items-center gap-1.5 text-sm font-medium text-foreground"><AppIcon name="activity" class="size-3.5" />Imaging</span>
                                    <span class="mt-1 text-xs text-muted-foreground">{{ timeline.careCounts.value.imagingActive }} active | {{ timeline.careCounts.value.imagingCompleted }} reported</span>
                                </TabsTrigger>
                                <TabsTrigger v-if="canReadPharmacyOrders" value="pharmacy" class="h-auto flex-col items-start rounded-lg border bg-muted/20 px-3 py-3 text-left data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5">
                                    <span class="flex items-center gap-1.5 text-sm font-medium text-foreground"><AppIcon name="pill" class="size-3.5" />Pharmacy</span>
                                    <span class="mt-1 text-xs text-muted-foreground">{{ timeline.careCounts.value.pharmacyActive }} active | {{ timeline.careCounts.value.pharmacyDispensed }} dispensed</span>
                                </TabsTrigger>
                                <TabsTrigger v-if="canReadTheatreProcedures" value="procedures" class="h-auto flex-col items-start rounded-lg border bg-muted/20 px-3 py-3 text-left data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5">
                                    <span class="flex items-center gap-1.5 text-sm font-medium text-foreground"><AppIcon name="scissors" class="size-3.5" />Procedures</span>
                                    <span class="mt-1 text-xs text-muted-foreground">{{ timeline.careCounts.value.procedureActive }} active | {{ timeline.careCounts.value.procedureCompleted }} completed</span>
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent v-if="canReadLaboratoryOrders" value="laboratory" class="mt-0">
                                <PatientChartOrdersDomainSection
                                    title="Laboratory"
                                    :active-count="timeline.careCounts.value.labActive"
                                    :completed-count="timeline.careCounts.value.labCompleted"
                                    active-label="Active"
                                    completed-label="Completed"
                                    :is-loading="laboratory.items.isPending.value"
                                    :error="laboratory.items.isError.value ? ((laboratory.items.error.value as Error | null)?.message ?? 'Unable to load laboratory orders.') : null"
                                    :empty-title="visitScope.useFocusedVisitOrdersScope.value ? 'No laboratory orders linked to this visit yet' : visitScope.useCurrentOrdersScope.value ? 'No current laboratory work' : 'No laboratory orders yet'"
                                    :empty-description="visitScope.useFocusedVisitOrdersScope.value ? 'Switch to All visits if you need prior laboratory work while this visit is still being built.' : visitScope.useCurrentOrdersScope.value ? 'Recent or active laboratory work will surface here once investigations are ordered or results are recorded.' : 'Order investigations from the active visit when the clinician needs lab support.'"
                                    :scope-label="scopeLabelFor('laboratory')"
                                    :scope-description="scopeDescriptionFor('laboratory', 'Critical, abnormal, pending, and recent laboratory work is shown first.')"
                                    :cards="laboratoryCards"
                                    :critical-alert-title="hasCriticalLaboratoryResult ? 'Critical laboratory result' : null"
                                    critical-alert-description="One or more laboratory results in this view are flagged as critical and require immediate clinical review."
                                    :create-href="canCreateLaboratoryOrders ? patientChartModuleHref('/laboratory-orders/legacy', props.patientId, primaryVisit?.id ?? null, { includeTabNew: true }) : null"
                                    create-label="Order lab"
                                    create-icon="flask-conical"
                                    @lifecycle-action="(...args) => orderLifecycle.openDialog(...args)"
                                    @review-lab-result="openLabResultReview"
                                />
                            </TabsContent>

                            <TabsContent v-if="canReadRadiologyOrders" value="imaging" class="mt-0">
                                <PatientChartOrdersDomainSection
                                    title="Imaging"
                                    :active-count="timeline.careCounts.value.imagingActive"
                                    :completed-count="timeline.careCounts.value.imagingCompleted"
                                    active-label="Active"
                                    completed-label="Reported"
                                    :is-loading="radiology.items.isPending.value"
                                    :error="radiology.items.isError.value ? ((radiology.items.error.value as Error | null)?.message ?? 'Unable to load imaging orders.') : null"
                                    :empty-title="visitScope.useFocusedVisitOrdersScope.value ? 'No imaging orders linked to this visit yet' : visitScope.useCurrentOrdersScope.value ? 'No current imaging work' : 'No imaging orders yet'"
                                    :empty-description="visitScope.useFocusedVisitOrdersScope.value ? 'Switch to All visits if you need prior imaging work while this visit is still being built.' : visitScope.useCurrentOrdersScope.value ? 'Recent or active imaging work will surface here once studies are ordered or reports are recorded.' : 'Order imaging from the active visit when the clinician needs radiology support.'"
                                    :scope-label="scopeLabelFor('imaging')"
                                    :scope-description="scopeDescriptionFor('imaging', 'Critical, abnormal, pending, and recent imaging work is shown first.')"
                                    :cards="radiologyCards"
                                    :create-href="canCreateRadiologyOrders ? patientChartModuleHref('/radiology-orders/legacy', props.patientId, primaryVisit?.id ?? null, { includeTabNew: true }) : null"
                                    create-label="Order imaging"
                                    create-icon="activity"
                                    @lifecycle-action="(...args) => orderLifecycle.openDialog(...args)"
                                />
                            </TabsContent>

                            <TabsContent v-if="canReadPharmacyOrders" value="pharmacy" class="mt-0">
                                <PatientChartOrdersDomainSection
                                    title="Pharmacy"
                                    :active-count="timeline.careCounts.value.pharmacyActive"
                                    :completed-count="timeline.careCounts.value.pharmacyDispensed"
                                    active-label="Active"
                                    completed-label="Dispensed"
                                    :is-loading="pharmacy.items.isPending.value"
                                    :error="pharmacy.items.isError.value ? ((pharmacy.items.error.value as Error | null)?.message ?? 'Unable to load pharmacy orders.') : null"
                                    :empty-title="visitScope.useFocusedVisitOrdersScope.value ? 'No pharmacy orders linked to this visit yet' : visitScope.useCurrentOrdersScope.value ? 'No current medication work' : 'No pharmacy orders yet'"
                                    :empty-description="visitScope.useFocusedVisitOrdersScope.value ? 'Switch to All visits if you need prior medication orders while this visit is still being built.' : visitScope.useCurrentOrdersScope.value ? 'Verification, reconciliation, and active medication orders will surface here.' : 'Order medications from the active visit when the clinician needs pharmacy support.'"
                                    :scope-label="scopeLabelFor('pharmacy')"
                                    :scope-description="scopeDescriptionFor('pharmacy', 'Verification, reconciliation, active medication orders, and recent pharmacy work are shown first.')"
                                    :cards="pharmacyCards"
                                    :create-href="canCreatePharmacyOrders ? patientChartModuleHref('/pharmacy-orders/legacy', props.patientId, primaryVisit?.id ?? null, { includeTabNew: true }) : null"
                                    create-label="Order pharmacy"
                                    create-icon="pill"
                                    @lifecycle-action="(...args) => orderLifecycle.openDialog(...args)"
                                />
                            </TabsContent>

                            <TabsContent v-if="canReadTheatreProcedures" value="procedures" class="mt-0">
                                <PatientChartOrdersDomainSection
                                    title="Procedures"
                                    :active-count="timeline.careCounts.value.procedureActive"
                                    :completed-count="timeline.careCounts.value.procedureCompleted"
                                    active-label="Active"
                                    completed-label="Completed"
                                    :is-loading="theatre.items.isPending.value"
                                    :error="theatre.items.isError.value ? ((theatre.items.error.value as Error | null)?.message ?? 'Unable to load theatre procedures.') : null"
                                    :empty-title="visitScope.useFocusedVisitOrdersScope.value ? 'No procedures linked to this visit yet' : visitScope.useCurrentOrdersScope.value ? 'No current procedures' : 'No theatre procedures yet'"
                                    :empty-description="visitScope.useFocusedVisitOrdersScope.value ? 'Switch to All visits if you need prior procedures while this visit is still being built.' : visitScope.useCurrentOrdersScope.value ? 'In-progress, upcoming, and recently completed procedures will surface here.' : 'Schedule a procedure from the active visit when the clinician needs theatre support.'"
                                    :scope-label="scopeLabelFor('procedure')"
                                    :scope-description="scopeDescriptionFor('procedure', 'In-progress, upcoming, and recently completed procedures are shown first.')"
                                    :cards="theatreCards"
                                    :create-href="canCreateTheatreProcedures ? patientChartModuleHref('/theatre-procedures/legacy', props.patientId, primaryVisit?.id ?? null, { includeTabNew: true }) : null"
                                    create-label="Schedule procedure"
                                    create-icon="scissors"
                                    @lifecycle-action="(...args) => orderLifecycle.openDialog(...args)"
                                />
                            </TabsContent>
                        </Tabs>
                    </TabsContent>

                    <TabsContent v-if="hasMedicationWorkspaceAccess" value="medications" class="space-y-6">
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div class="space-y-1">
                                <p class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Medications</p>
                                <p class="text-sm text-muted-foreground">Maintain patient allergies, the current medication list, and reconciliation follow-up in one place.</p>
                            </div>
                        </div>

                        <div :class="['grid gap-2', canReadPharmacyOrders ? 'md:grid-cols-4' : 'md:grid-cols-3']">
                            <button
                                type="button"
                                class="group flex min-h-14 items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                                :disabled="!canUpdatePatients"
                                @click="allergyDialog.openDialog()"
                            >
                                <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border group-hover:text-primary">
                                    <AppIcon name="alert-triangle" class="size-4" />
                                </span>
                                <span class="min-w-0">
                                    <span class="block text-xs font-medium text-muted-foreground">Allergy safety</span>
                                    <span class="mt-0.5 block truncate text-sm font-semibold text-foreground">
                                        <template v-if="(medicationReconciliation?.counts.activeAllergies ?? patientAllergies.length) > 0">
                                            {{ medicationReconciliation?.counts.activeAllergies ?? patientAllergies.length }} active
                                        </template>
                                        <template v-else>Not recorded</template>
                                    </span>
                                </span>
                            </button>

                            <button
                                type="button"
                                class="group flex min-h-14 items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                                :disabled="!canUpdatePatients"
                                @click="medicationProfileDialog.openDialog()"
                            >
                                <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border group-hover:text-primary">
                                    <AppIcon name="pill" class="size-4" />
                                </span>
                                <span class="min-w-0">
                                    <span class="block text-xs font-medium text-muted-foreground">Medication profile</span>
                                    <span class="mt-0.5 block truncate text-sm font-semibold text-foreground">
                                        <template v-if="(medicationReconciliation?.counts.activeMedicationProfile ?? medicationProfile.length) > 0">
                                            {{ medicationReconciliation?.counts.activeMedicationProfile ?? medicationProfile.length }} current
                                        </template>
                                        <template v-else>No current meds</template>
                                    </span>
                                </span>
                            </button>

                            <button
                                type="button"
                                class="group flex min-h-14 items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                                @click="scrollToMedicationWorkspaceSection('reconciliation')"
                            >
                                <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border group-hover:text-primary">
                                    <AppIcon name="check-circle" class="size-4" />
                                </span>
                                <span class="min-w-0">
                                    <span class="block text-xs font-medium text-muted-foreground">Reconciliation</span>
                                    <span class="mt-0.5 block truncate text-sm font-semibold text-foreground">
                                        <template v-if="(medicationReconciliation?.counts.unreconciledDispensedOrders ?? 0) > 0">
                                            {{ medicationReconciliation?.counts.unreconciledDispensedOrders ?? 0 }} to review
                                        </template>
                                        <template v-else>Up to date</template>
                                    </span>
                                </span>
                            </button>

                            <Button
                                v-if="canReadPharmacyOrders"
                                variant="outline"
                                class="group flex min-h-14 items-center justify-start gap-3 rounded-lg border-border bg-muted/30 px-3 py-2 text-left hover:border-primary/40 hover:bg-primary/5"
                                as-child
                            >
                                <Link :href="patientChartModuleHref('/pharmacy-orders', props.patientId, primaryVisit?.id ?? null, { includeAppointment: false })">
                                    <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border group-hover:text-primary">
                                        <AppIcon name="book-open" class="size-4" />
                                    </span>
                                    <span class="min-w-0">
                                        <span class="block text-xs font-medium text-muted-foreground">Pharmacy history</span>
                                        <span class="mt-0.5 block truncate text-sm font-semibold text-foreground">
                                            <template v-if="(medicationReconciliation?.counts.activeDispensedOrders ?? 0) > 0">
                                                {{ medicationReconciliation?.counts.activeDispensedOrders ?? 0 }} dispensed
                                            </template>
                                            <template v-else>No dispenses</template>
                                        </span>
                                    </span>
                                </Link>
                            </Button>
                        </div>

                        <p v-if="!canUpdatePatients" class="text-xs text-muted-foreground">
                            Recording allergies and current medication entries requires <code>patient.demographics.update</code>.
                        </p>

                        <div class="grid gap-6 xl:grid-cols-3">
                            <Card :id="medicationWorkspaceSectionIds.allergies" class="rounded-lg scroll-mt-24">
                                <CardHeader class="pb-3">
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <CardTitle>Allergies &amp; intolerances</CardTitle>
                                            <CardDescription>Keep active reactions visible before ordering or dispensing more therapy.</CardDescription>
                                        </div>
                                        <Button v-if="canUpdatePatients" size="sm" variant="outline" class="gap-1.5" @click="allergyDialog.openDialog()">
                                            <AppIcon name="plus" class="size-3.5" />Record
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent class="space-y-3">
                                    <div v-if="allergiesQuery.isPending.value" class="space-y-3">
                                        <Skeleton class="h-20 w-full rounded-lg" />
                                        <Skeleton class="h-20 w-full rounded-lg" />
                                    </div>
                                    <Alert v-else-if="allergiesQuery.isError.value" variant="destructive">
                                        <AlertTitle>Allergy workspace unavailable</AlertTitle>
                                        <AlertDescription>{{ (allergiesQuery.error.value as Error | null)?.message ?? 'Unable to load allergies.' }}</AlertDescription>
                                    </Alert>
                                    <div v-else-if="patientAllergies.length === 0" class="rounded-lg border border-dashed px-4 py-4">
                                        <p class="text-sm font-medium text-foreground">No active allergies recorded</p>
                                        <p class="mt-1 text-sm text-muted-foreground">Record allergies or intolerances here so downstream order safety checks stay patient-aware.</p>
                                    </div>
                                    <div v-else class="space-y-3">
                                        <div v-for="allergy in patientAllergies" :key="allergy.id" class="rounded-lg border bg-background px-4 py-3">
                                            <div class="flex items-start justify-between gap-3">
                                                <div class="min-w-0 space-y-2">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <p class="text-sm font-semibold text-foreground">{{ allergy.substanceName || 'Allergy entry' }}</p>
                                                        <Badge :variant="allergySeverityVariant(allergy.severity)">{{ formatEnumLabel(allergy.severity || 'unknown') }}</Badge>
                                                        <Badge variant="outline">{{ formatEnumLabel(allergy.status || 'active') }}</Badge>
                                                    </div>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{ allergy.reaction || 'Reaction not recorded' }}
                                                        <template v-if="allergy.lastReactionAt">| Last reaction {{ formatDate(allergy.lastReactionAt) }}</template>
                                                    </p>
                                                    <p v-if="allergy.notes" class="text-sm text-foreground">{{ allergy.notes }}</p>
                                                </div>
                                                <Button v-if="canUpdatePatients" size="sm" variant="ghost" class="gap-1.5" @click="allergyDialog.openDialog(allergy)">
                                                    <AppIcon name="pencil" class="size-3.5" />Edit
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card :id="medicationWorkspaceSectionIds.profile" class="rounded-lg scroll-mt-24 xl:col-span-2">
                                <CardHeader class="pb-3">
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <CardTitle>Current medications</CardTitle>
                                            <CardDescription>Track what the patient is currently taking outside the encounter-level order workflow.</CardDescription>
                                        </div>
                                        <Button v-if="canUpdatePatients" size="sm" variant="outline" class="gap-1.5" @click="medicationProfileDialog.openDialog()">
                                            <AppIcon name="plus" class="size-3.5" />Add medication
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent class="space-y-3">
                                    <div v-if="medicationProfileQuery.isPending.value" class="space-y-3">
                                        <Skeleton class="h-20 w-full rounded-lg" />
                                        <Skeleton class="h-20 w-full rounded-lg" />
                                    </div>
                                    <Alert v-else-if="medicationProfileQuery.isError.value" variant="destructive">
                                        <AlertTitle>Current medication list unavailable</AlertTitle>
                                        <AlertDescription>{{ (medicationProfileQuery.error.value as Error | null)?.message ?? 'Unable to load current medications.' }}</AlertDescription>
                                    </Alert>
                                    <div v-else-if="medicationProfile.length === 0" class="rounded-lg border border-dashed px-4 py-4">
                                        <p class="text-sm font-medium text-foreground">No current medications recorded yet</p>
                                        <p class="mt-1 text-sm text-muted-foreground">Use this list for active home medication, chronic therapy, discharge medication, and ongoing treatment context.</p>
                                    </div>
                                    <div v-else class="space-y-3">
                                        <div v-for="profile in medicationProfile" :key="profile.id" class="rounded-lg border bg-background px-4 py-3">
                                            <div class="flex items-start justify-between gap-3">
                                                <div class="min-w-0 space-y-2">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <p class="text-sm font-semibold text-foreground">{{ profile.medicationName || 'Medication entry' }}</p>
                                                        <Badge :variant="workflowStatusVariant(profile.status)">{{ formatEnumLabel(profile.status || 'active') }}</Badge>
                                                        <Badge variant="outline">{{ formatEnumLabel(profile.source || 'manual_entry') }}</Badge>
                                                    </div>
                                                    <p class="text-xs text-muted-foreground">{{ medicationProfileLine(profile) }}</p>
                                                    <p v-if="profile.indication" class="text-xs text-muted-foreground">Indication: {{ profile.indication }}</p>
                                                    <p v-if="profile.notes" class="text-sm text-foreground">{{ profile.notes }}</p>
                                                </div>
                                                <Button v-if="canUpdatePatients" size="sm" variant="ghost" class="gap-1.5" @click="medicationProfileDialog.openDialog(profile)">
                                                    <AppIcon name="pencil" class="size-3.5" />Edit
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card :id="medicationWorkspaceSectionIds.reconciliation" class="rounded-lg scroll-mt-24">
                            <CardHeader class="pb-3">
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <CardTitle>Medication reconciliation</CardTitle>
                                        <CardDescription>Review what is on the current medication list, what has been dispensed, and what still needs reconciliation follow-up.</CardDescription>
                                    </div>
                                    <div v-if="medicationReconciliation" class="flex flex-wrap gap-2 text-xs">
                                        <Badge variant="outline">{{ medicationReconciliation.unreconciledDispensedOrders.length }} unreconciled</Badge>
                                        <Badge variant="outline">{{ medicationReconciliation.continueCandidates.length }} continue</Badge>
                                        <Badge variant="outline">{{ medicationReconciliation.profileWithoutDispensedOrders.length + medicationReconciliation.newOrdersToProfile.length }} list review</Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent class="space-y-4">
                                <div v-if="medicationReconciliationQuery.isPending.value" class="space-y-3">
                                    <Skeleton class="h-24 w-full rounded-lg" />
                                    <Skeleton class="h-24 w-full rounded-lg" />
                                </div>
                                <Alert v-else-if="medicationReconciliationQuery.isError.value" variant="destructive">
                                    <AlertTitle>Reconciliation workspace unavailable</AlertTitle>
                                    <AlertDescription>{{ (medicationReconciliationQuery.error.value as Error | null)?.message ?? 'Unable to load reconciliation.' }}</AlertDescription>
                                </Alert>
                                <template v-else-if="medicationReconciliation">
                                    <Alert v-if="medicationReconciliation.suggestedActions.length > 0">
                                        <AlertTitle>Reconciliation focus</AlertTitle>
                                        <AlertDescription>{{ medicationReconciliation.suggestedActions[0] }}</AlertDescription>
                                    </Alert>

                                    <div class="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
                                        <div class="space-y-3 rounded-lg border bg-background px-4 py-4">
                                            <div>
                                                <p class="text-sm font-semibold text-foreground">Unreconciled dispensed orders</p>
                                                <p class="mt-1 text-xs text-muted-foreground">Released therapy that still needs current medication list reconciliation.</p>
                                            </div>
                                            <div v-if="medicationReconciliation.unreconciledDispensedOrders.length === 0" class="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                                                No unreconciled dispensed orders.
                                            </div>
                                            <div v-else class="space-y-2">
                                                <div v-for="order in medicationReconciliation.unreconciledDispensedOrders" :key="`recon-order-${order.id}`" class="rounded-lg border bg-muted/10 px-3 py-3">
                                                    <div class="flex items-start justify-between gap-3">
                                                        <div class="min-w-0">
                                                            <p class="text-sm font-medium text-foreground">{{ order.medicationName || 'Medication order' }}</p>
                                                            <p class="mt-1 text-xs text-muted-foreground">{{ order.orderNumber || 'Order pending number' }} | Dispensed {{ formatDateTime(order.dispensedAt) }}</p>
                                                        </div>
                                                        <Button v-if="canUpdatePatients" size="sm" variant="outline" class="h-9 gap-1.5 px-2.5 text-xs" @click="medicationProfileDialog.openDialogFromOrder(order, 'add')">
                                                            <AppIcon name="pill" class="size-3.5" />Update list
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="space-y-3 rounded-lg border bg-background px-4 py-4">
                                            <div>
                                                <p class="text-sm font-semibold text-foreground">Continue candidates</p>
                                                <p class="mt-1 text-xs text-muted-foreground">Recently dispensed therapy that likely continues on the current medication list.</p>
                                            </div>
                                            <div v-if="medicationReconciliation.continueCandidates.length === 0" class="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                                                No continue candidates are waiting.
                                            </div>
                                            <div v-else class="space-y-2">
                                                <div v-for="order in medicationReconciliation.continueCandidates" :key="`recon-continue-order-${order.id}`" class="rounded-lg border bg-muted/10 px-3 py-3">
                                                    <div class="flex items-start justify-between gap-3">
                                                        <div class="min-w-0">
                                                            <p class="text-sm font-medium text-foreground">{{ order.medicationName || 'Medication order' }}</p>
                                                            <p class="mt-1 text-xs text-muted-foreground">
                                                                {{ order.orderNumber || 'Order pending number' }}
                                                                <template v-if="order.dosageInstruction">| {{ order.dosageInstruction }}</template>
                                                            </p>
                                                        </div>
                                                        <Button v-if="canUpdatePatients" size="sm" variant="outline" class="h-9 gap-1.5 px-2.5 text-xs" @click="medicationProfileDialog.openDialogFromOrder(order, 'continue')">
                                                            <AppIcon name="refresh-cw" class="size-3.5" />Continue on list
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="space-y-3 rounded-lg border bg-background px-4 py-4">
                                            <div>
                                                <p class="text-sm font-semibold text-foreground">Current medication entries without dispensed match</p>
                                                <p class="mt-1 text-xs text-muted-foreground">Active list items that should be reviewed against current therapy.</p>
                                            </div>
                                            <div v-if="medicationReconciliation.profileWithoutDispensedOrders.length === 0" class="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                                                No unmatched active current medication entries.
                                            </div>
                                            <div v-else class="space-y-2">
                                                <div v-for="profile in medicationReconciliation.profileWithoutDispensedOrders" :key="`recon-profile-${profile.id}`" class="rounded-lg border bg-muted/10 px-3 py-3">
                                                    <div class="flex items-start justify-between gap-3">
                                                        <div class="min-w-0">
                                                            <p class="text-sm font-medium text-foreground">{{ profile.medicationName || 'Profile entry' }}</p>
                                                            <p class="mt-1 text-xs text-muted-foreground">{{ medicationProfileLine(profile) }}</p>
                                                        </div>
                                                        <Button
                                                            v-if="canUpdatePatients"
                                                            size="sm"
                                                            variant="outline"
                                                            class="h-9 gap-1.5 px-2.5 text-xs"
                                                            :disabled="medicationProfileDialog.isQuickReconcileLoading(profile)"
                                                            @click="medicationProfileDialog.quickReconcile(profile)"
                                                        >
                                                            <AppIcon name="check-circle" class="size-3.5" />
                                                            {{ medicationProfileDialog.isQuickReconcileLoading(profile) ? 'Saving...' : 'Mark list reviewed' }}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="space-y-3 rounded-lg border bg-background px-4 py-4">
                                            <div>
                                                <p class="text-sm font-semibold text-foreground">New dispensed therapy to add</p>
                                                <p class="mt-1 text-xs text-muted-foreground">Dispensed orders that are not yet reflected in the current medication list.</p>
                                            </div>
                                            <div v-if="medicationReconciliation.newOrdersToProfile.length === 0" class="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                                                No newly dispensed therapy needs list addition.
                                            </div>
                                            <div v-else class="space-y-2">
                                                <div v-for="order in medicationReconciliation.newOrdersToProfile" :key="`recon-new-order-${order.id}`" class="rounded-lg border bg-muted/10 px-3 py-3">
                                                    <div class="flex items-start justify-between gap-3">
                                                        <div class="min-w-0">
                                                            <p class="text-sm font-medium text-foreground">{{ order.medicationName || 'Medication order' }}</p>
                                                            <p class="mt-1 text-xs text-muted-foreground">{{ order.orderNumber || 'Order pending number' }} | Dispensed {{ formatDateTime(order.dispensedAt) }}</p>
                                                        </div>
                                                        <Button v-if="canUpdatePatients" size="sm" variant="outline" class="h-9 gap-1.5 px-2.5 text-xs" @click="medicationProfileDialog.openDialogFromOrder(order, 'add')">
                                                            <AppIcon name="plus" class="size-3.5" />Add to list
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </template>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent v-if="hasBillingAccess" value="billing" class="space-y-6">
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div class="space-y-1">
                                <p class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Billing</p>
                                <p class="text-sm text-muted-foreground">Review patient invoices without crowding the clinical orders workspace.</p>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <Button v-if="canCreateBillingInvoices" size="sm" class="gap-1.5" as-child>
                                    <Link :href="patientChartModuleHref('/billing', props.patientId, primaryVisit?.id ?? null, { includeTabNew: true })"><AppIcon name="receipt" class="size-3.5" />Create invoice</Link>
                                </Button>
                                <Button v-if="canReadBillingInvoices" size="sm" variant="outline" class="gap-1.5" as-child>
                                    <Link :href="patientChartModuleHref('/billing', props.patientId, primaryVisit?.id ?? null, { includeAppointment: false })"><AppIcon name="book-open" class="size-3.5" />Open billing list</Link>
                                </Button>
                            </div>
                        </div>

                        <Alert v-if="!canReadBillingInvoices" variant="default">
                            <AlertTitle>Invoice history is limited</AlertTitle>
                            <AlertDescription>You can launch new billing work from this chart, but invoice history and balances require <code>billing.invoices.read</code>.</AlertDescription>
                        </Alert>

                        <Card v-if="canReadBillingInvoices" class="rounded-lg">
                            <CardHeader class="pb-3">
                                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <CardTitle>Invoice activity</CardTitle>
                                        <CardDescription>The most recent invoices for this patient.</CardDescription>
                                    </div>
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                            <p class="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">Open</p>
                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ timeline.careCounts.value.billingOpen }}</p>
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                            <p class="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">Paid</p>
                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ timeline.careCounts.value.billingSettled }}</p>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent class="space-y-4">
                                <div class="rounded-lg border bg-muted/10 px-3 py-3">
                                    <template v-if="billing.items.isPending.value">
                                        <Skeleton class="h-4 w-40 rounded-lg" />
                                        <Skeleton class="mt-2 h-3 w-full rounded-lg" />
                                    </template>
                                    <template v-else-if="billing.items.isError.value">
                                        <p class="text-sm text-destructive">{{ (billing.items.error.value as Error | null)?.message ?? 'Unable to load billing invoices.' }}</p>
                                    </template>
                                    <template v-else-if="billingInvoices.length === 0">
                                        <p class="text-sm font-medium text-foreground">No invoices yet</p>
                                        <p class="mt-1 text-xs text-muted-foreground">Billing follow-up will appear once services are invoiced for this patient.</p>
                                    </template>
                                    <template v-else>
                                        <div class="grid gap-2">
                                            <Link
                                                v-for="invoice in billingInvoices"
                                                :key="`chart-billing-invoice-${invoice.id}`"
                                                :href="patientChartModuleHref('/billing', props.patientId, primaryVisit?.id ?? null, { includeAppointment: false, focusInvoiceId: invoice.id })"
                                                class="block rounded-lg border bg-background px-3 py-2.5 transition hover:border-primary/40 hover:bg-primary/5"
                                            >
                                                <div class="flex items-start justify-between gap-2">
                                                    <div class="min-w-0">
                                                        <p class="truncate text-sm font-medium text-foreground">{{ invoice.invoiceNumber || 'Invoice pending number' }}</p>
                                                        <p class="mt-1 text-xs text-muted-foreground">
                                                            Issued {{ formatDateTime(invoice.invoiceDate) }}
                                                            <span v-if="invoice.currencyCode">| {{ invoice.currencyCode }}</span>
                                                        </p>
                                                    </div>
                                                    <Badge :variant="workflowStatusVariant(invoice.status)">{{ formatEnumLabel(invoice.status || 'draft') }}</Badge>
                                                </div>
                                                <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                    <span>Total {{ formatMoney(invoice.totalAmount, invoice.currencyCode) }}</span>
                                                    <span>Balance {{ formatMoney(invoice.balanceAmount, invoice.currencyCode) }}</span>
                                                </div>
                                                <p v-if="invoice.notes" class="mt-2 text-xs text-muted-foreground">{{ truncatePlainText(invoice.notes, 220) }}</p>
                                            </Link>
                                        </div>
                                    </template>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent v-if="canReadMedicalRecords" value="records" class="space-y-6">
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div class="space-y-1">
                                <p class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Consultation Notes</p>
                                <p class="text-sm text-muted-foreground">{{ recordsTotal }} notes in this patient chart.</p>
                            </div>
                            <Button size="sm" variant="outline" class="gap-1.5" as-child>
                                <Link :href="recordsListHref"><AppIcon name="search" class="size-3.5" />Open clinical records</Link>
                            </Button>
                        </div>

                        <div v-if="recordsQuery.isPending.value" class="space-y-3">
                            <Skeleton class="h-32 w-full rounded-lg" />
                            <Skeleton class="h-32 w-full rounded-lg" />
                        </div>

                        <Alert v-else-if="recordsQuery.isError.value" variant="destructive">
                            <AlertTitle>Consultation records unavailable</AlertTitle>
                            <AlertDescription>{{ (recordsQuery.error.value as Error | null)?.message ?? 'Unable to load records.' }}</AlertDescription>
                        </Alert>

                        <div v-else-if="records.length === 0" class="rounded-lg border border-dashed bg-card px-5 py-5">
                            <p class="text-base font-medium text-foreground">No consultation records yet</p>
                            <p class="mt-1 text-sm text-muted-foreground">Start the first consultation from this chart when you want the note to stay anchored to this patient workspace.</p>
                        </div>

                        <div v-else class="space-y-4">
                            <div v-if="timeline.latestRecord.value" class="rounded-lg border bg-background px-4 py-4">
                                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div class="min-w-0 space-y-2">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="text-sm font-semibold text-foreground">Latest consultation</p>
                                            <Badge :variant="recordStatusVariant(timeline.latestRecord.value.status)">{{ formatEnumLabel(timeline.latestRecord.value.status || 'draft') }}</Badge>
                                            <Badge variant="outline">{{ formatEnumLabel(timeline.latestRecord.value.recordType || 'consultation_note') }}</Badge>
                                        </div>
                                        <p class="text-xs text-muted-foreground">{{ formatDateTime(timeline.latestRecord.value.encounterAt) }}</p>
                                        <p class="text-sm text-foreground">{{ timeline.recordProblem(timeline.latestRecord.value) }}</p>
                                        <p class="text-sm text-muted-foreground">{{ timeline.recordNextStep(timeline.latestRecord.value) }}</p>
                                    </div>
                                    <Button size="sm" class="gap-1.5" as-child>
                                        <Link :href="timeline.recordRegistryHref(timeline.latestRecord.value)"><AppIcon name="file-text" class="size-3.5" />Open latest note</Link>
                                    </Button>
                                </div>
                            </div>
                            <div v-for="record in records" :key="record.id" class="rounded-lg border bg-background px-4 py-4">
                                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div class="space-y-2">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="text-sm font-semibold text-foreground">{{ record.recordNumber || 'Medical record' }}</p>
                                            <Badge :variant="recordStatusVariant(record.status)">{{ formatEnumLabel(record.status || 'draft') }}</Badge>
                                            <Badge variant="outline">{{ formatEnumLabel(record.recordType || 'consultation_note') }}</Badge>
                                        </div>
                                        <p class="text-xs text-muted-foreground">Encounter: {{ formatDateTime(record.encounterAt) }} | Diagnosis: {{ record.diagnosisCode || 'N/A' }}</p>
                                    </div>
                                    <Button size="sm" variant="outline" class="gap-1.5" as-child>
                                        <Link :href="timeline.recordRegistryHref(record)"><AppIcon name="file-text" class="size-3.5" />Open in records</Link>
                                    </Button>
                                </div>
                                <div class="mt-3 grid gap-3 lg:grid-cols-2">
                                    <div class="rounded-lg border bg-muted/20 px-3 py-3">
                                        <p class="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">Problem focus</p>
                                        <p class="mt-1.5 text-sm text-foreground">{{ timeline.recordProblem(record) }}</p>
                                    </div>
                                    <div class="rounded-lg border bg-muted/20 px-3 py-3">
                                        <p class="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">Next step</p>
                                        <p class="mt-1.5 text-sm text-foreground">{{ timeline.recordNextStep(record) }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent v-if="canReadPatientInsurance" value="insurance" class="space-y-6">
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div class="space-y-1">
                                <p class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Insurance</p>
                                <p class="text-sm text-muted-foreground">Manage coverage records and verification status for this patient.</p>
                            </div>
                            <Button v-if="canManagePatientInsurance" size="sm" class="gap-1.5" @click="insuranceDialog.openDialog()">
                                <AppIcon name="plus" class="size-3.5" />Add insurance
                            </Button>
                        </div>

                        <div class="rounded-lg border bg-muted/10 px-3 py-3">
                            <template v-if="insuranceQuery.isPending.value">
                                <Skeleton class="h-4 w-40 rounded-lg" />
                                <Skeleton class="mt-2 h-3 w-full rounded-lg" />
                            </template>
                            <template v-else-if="insuranceQuery.isError.value">
                                <p class="text-sm text-destructive">{{ (insuranceQuery.error.value as Error | null)?.message ?? 'Unable to load insurance records.' }}</p>
                            </template>
                            <template v-else-if="insuranceRecords.length === 0">
                                <p class="text-sm font-medium text-foreground">No insurance on file</p>
                                <p class="mt-1 text-xs text-muted-foreground">Add a coverage record to enable insurance-routed billing for this patient.</p>
                            </template>
                            <template v-else>
                                <div class="grid gap-2">
                                    <div v-for="record in insuranceRecords" :key="record.id" class="rounded-lg border bg-background px-3 py-2.5">
                                        <div class="flex items-start justify-between gap-2">
                                            <div class="min-w-0">
                                                <p class="truncate text-sm font-medium text-foreground">{{ record.insuranceProvider || 'Provider not set' }}</p>
                                                <p class="mt-1 text-xs text-muted-foreground">
                                                    {{ [record.planName, record.memberId ? `Member ${record.memberId}` : null, record.cardNumber ? `Card ${record.cardNumber}` : null].filter(Boolean).join(' · ') || 'No plan details' }}
                                                </p>
                                            </div>
                                            <div class="flex shrink-0 flex-col items-end gap-1.5">
                                                <Badge :variant="workflowStatusVariant(record.verificationStatus)">{{ formatEnumLabel(record.verificationStatus || 'unverified') }}</Badge>
                                                <div v-if="canVerifyPatientInsurance && record.verificationStatus !== 'verified'" class="flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        class="h-6 px-2 text-[11px]"
                                                        :disabled="insuranceDialog.verifyingId.value === record.id"
                                                        @click="insuranceDialog.verifyRecord(record.id, 'verified')"
                                                    >
                                                        Verify
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        class="h-6 px-2 text-[11px]"
                                                        :disabled="insuranceDialog.verifyingId.value === record.id"
                                                        @click="insuranceDialog.verifyRecord(record.id, 'failed')"
                                                    >
                                                        Mark failed
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                            <span v-if="record.effectiveDate">Effective {{ formatDateTime(record.effectiveDate) }}</span>
                                            <span v-if="record.expiryDate">Expires {{ formatDateTime(record.expiryDate) }}</span>
                                            <span v-if="record.coverageLevel">{{ record.coverageLevel }}</span>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </TabsContent>

                    <TabsContent v-if="canViewPatientAuditLogs" value="audit" class="space-y-6">
                        <div class="flex items-start justify-between gap-2">
                            <div class="space-y-1">
                                <p class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Audit log</p>
                                <p class="text-sm text-muted-foreground">Who changed what, and when, for this patient's record.</p>
                            </div>
                            <Button size="sm" variant="outline" class="h-7 shrink-0 px-2 text-xs" @click="exportPatientAuditLogsCsv(props.patientId)">
                                Export CSV
                            </Button>
                        </div>

                        <div class="rounded-lg border bg-muted/10 px-3 py-3">
                            <template v-if="auditLogQuery.isPending.value">
                                <Skeleton class="h-4 w-40 rounded-lg" />
                                <Skeleton class="mt-2 h-3 w-full rounded-lg" />
                            </template>
                            <template v-else-if="auditLogQuery.isError.value">
                                <p class="text-sm text-destructive">{{ (auditLogQuery.error.value as Error | null)?.message ?? 'Unable to load the audit log.' }}</p>
                            </template>
                            <template v-else-if="auditLogs.length === 0">
                                <p class="text-sm font-medium text-foreground">No audit history yet</p>
                                <p class="mt-1 text-xs text-muted-foreground">Changes to this patient's record will appear here.</p>
                            </template>
                            <template v-else>
                                <div class="grid gap-2">
                                    <div v-for="log in auditLogs" :key="log.id" class="rounded-lg border bg-background px-3 py-2.5">
                                        <div class="flex items-start justify-between gap-2">
                                            <p class="truncate text-sm font-medium text-foreground">{{ log.actionLabel || log.action || 'Unknown action' }}</p>
                                            <span class="shrink-0 text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }}</span>
                                        </div>
                                        <p v-if="log.actorId" class="mt-1 text-xs text-muted-foreground">By user #{{ log.actorId }}</p>
                                    </div>
                                </div>
                                <div v-if="auditLogQuery.data.value && auditLogQuery.data.value.meta.lastPage > 1" class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                                    <p>Page {{ auditLogQuery.data.value.meta.currentPage }} of {{ auditLogQuery.data.value.meta.lastPage }}</p>
                                    <div class="flex gap-2">
                                        <Button size="sm" variant="outline" class="h-7 px-2" :disabled="auditLogPage <= 1" @click="auditLogPage = Math.max(1, auditLogPage - 1)">
                                            Previous
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            class="h-7 px-2"
                                            :disabled="auditLogPage >= auditLogQuery.data.value.meta.lastPage"
                                            @click="auditLogPage = auditLogPage + 1"
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </TabsContent>
                </template>

                <EncounterLifecycleDialog
                    v-model:open="orderLifecycle.dialogOpen.value"
                    v-model:reason="orderLifecycle.reason.value"
                    :action="orderLifecycle.action.value"
                    :target-name="orderLifecycle.targetName()"
                    :error="orderLifecycle.error.value"
                    :submitting="orderLifecycle.submitting.value"
                    @submit="orderLifecycle.submitDialog()"
                    @close="orderLifecycle.closeDialog()"
                />

                <Dialog :open="allergyDialog.open.value" @update:open="(isOpen) => (isOpen ? (allergyDialog.open.value = true) : allergyDialog.closeDialog())">
                    <DialogContent variant="form" size="xl">
                        <div class="flex h-full max-h-[90vh] flex-col">
                            <DialogHeader class="shrink-0 border-b bg-background px-6 py-4">
                                <DialogTitle>{{ allergyDialog.editingId.value ? 'Edit allergy' : 'Add allergy' }}</DialogTitle>
                                <DialogDescription>Record clinically relevant allergies or intolerances so downstream order checks can use real patient context.</DialogDescription>
                            </DialogHeader>
                            <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                                <div class="grid gap-4">
                                    <div class="grid gap-2">
                                        <Label for="patient-chart-v2-allergy-name">Substance</Label>
                                        <Input id="patient-chart-v2-allergy-name" v-model="allergyDialog.form.substanceName" placeholder="Medicine or substance name" />
                                        <p v-if="allergyDialog.formErrors.value.substanceName?.length" class="text-sm text-destructive">{{ allergyDialog.formErrors.value.substanceName[0] }}</p>
                                    </div>
                                    <div class="grid gap-4 sm:grid-cols-2">
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-allergy-code">Code</Label>
                                            <Input id="patient-chart-v2-allergy-code" v-model="allergyDialog.form.substanceCode" placeholder="Optional code" />
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-allergy-reaction">Reaction</Label>
                                            <Input id="patient-chart-v2-allergy-reaction" v-model="allergyDialog.form.reaction" placeholder="e.g. Rash, anaphylaxis" />
                                        </div>
                                    </div>
                                    <div class="grid gap-4 sm:grid-cols-3">
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-allergy-severity">Severity</Label>
                                            <select
                                                id="patient-chart-v2-allergy-severity"
                                                v-model="allergyDialog.form.severity"
                                                class="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="unknown">Unknown</option>
                                                <option value="mild">Mild</option>
                                                <option value="moderate">Moderate</option>
                                                <option value="severe">Severe</option>
                                                <option value="life_threatening">Life threatening</option>
                                            </select>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-allergy-status">Status</Label>
                                            <select
                                                id="patient-chart-v2-allergy-status"
                                                v-model="allergyDialog.form.status"
                                                class="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                                <option value="entered_in_error">Entered in error</option>
                                            </select>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-allergy-last-reaction">Last reaction</Label>
                                            <Input id="patient-chart-v2-allergy-last-reaction" v-model="allergyDialog.form.lastReactionAt" type="date" />
                                        </div>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="patient-chart-v2-allergy-notes">Notes</Label>
                                        <Textarea id="patient-chart-v2-allergy-notes" v-model="allergyDialog.form.notes" rows="3" placeholder="Clinical context, source, and confirmation details" />
                                    </div>
                                    <p v-if="allergyDialog.error.value" class="text-sm text-destructive">{{ allergyDialog.error.value }}</p>
                                </div>
                            </div>
                            <DialogFooter class="shrink-0 gap-2 border-t px-6 py-4">
                                <Button variant="outline" @click="allergyDialog.closeDialog()">Cancel</Button>
                                <Button :disabled="allergyDialog.submitting.value" @click="allergyDialog.submitDialog()">
                                    {{ allergyDialog.submitting.value ? 'Saving...' : allergyDialog.editingId.value ? 'Save changes' : 'Add allergy' }}
                                </Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog :open="insuranceDialog.open.value" @update:open="(isOpen) => (isOpen ? (insuranceDialog.open.value = true) : insuranceDialog.closeDialog())">
                    <DialogContent variant="form" size="xl">
                        <div class="flex h-full max-h-[90vh] flex-col">
                            <DialogHeader class="shrink-0 border-b bg-background px-6 py-4">
                                <DialogTitle>Add insurance</DialogTitle>
                                <DialogDescription>Record a coverage entry so insurance-routed billing has real details to work with.</DialogDescription>
                            </DialogHeader>
                            <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                                <div class="grid gap-4">
                                    <div class="grid gap-4 sm:grid-cols-2">
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-insurance-provider">Provider</Label>
                                            <Input id="patient-chart-v2-insurance-provider" v-model="insuranceDialog.form.insuranceProvider" placeholder="e.g. NHIF" />
                                            <p v-if="insuranceDialog.formErrors.value.insuranceProvider?.length" class="text-sm text-destructive">{{ insuranceDialog.formErrors.value.insuranceProvider[0] }}</p>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-insurance-type">Type</Label>
                                            <select
                                                id="patient-chart-v2-insurance-type"
                                                v-model="insuranceDialog.form.insuranceType"
                                                class="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="insurance">Insurance</option>
                                                <option value="government">Government</option>
                                                <option value="employer">Employer</option>
                                                <option value="donor">Donor</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="grid gap-4 sm:grid-cols-2">
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-insurance-member-id">Member ID</Label>
                                            <Input id="patient-chart-v2-insurance-member-id" v-model="insuranceDialog.form.memberId" placeholder="Required if no card number" />
                                            <p v-if="insuranceDialog.formErrors.value.memberId?.length" class="text-sm text-destructive">{{ insuranceDialog.formErrors.value.memberId[0] }}</p>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-insurance-card-number">Card number</Label>
                                            <Input id="patient-chart-v2-insurance-card-number" v-model="insuranceDialog.form.cardNumber" placeholder="Required if no member ID" />
                                            <p v-if="insuranceDialog.formErrors.value.cardNumber?.length" class="text-sm text-destructive">{{ insuranceDialog.formErrors.value.cardNumber[0] }}</p>
                                        </div>
                                    </div>
                                    <div class="grid gap-4 sm:grid-cols-2">
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-insurance-plan">Plan name</Label>
                                            <Input id="patient-chart-v2-insurance-plan" v-model="insuranceDialog.form.planName" />
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-insurance-policy">Policy number</Label>
                                            <Input id="patient-chart-v2-insurance-policy" v-model="insuranceDialog.form.policyNumber" />
                                        </div>
                                    </div>
                                    <div class="grid gap-4 sm:grid-cols-2">
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-insurance-effective">Effective date</Label>
                                            <Input id="patient-chart-v2-insurance-effective" v-model="insuranceDialog.form.effectiveDate" type="date" />
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-insurance-expiry">Expiry date</Label>
                                            <Input id="patient-chart-v2-insurance-expiry" v-model="insuranceDialog.form.expiryDate" type="date" />
                                        </div>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="patient-chart-v2-insurance-notes">Notes</Label>
                                        <Textarea id="patient-chart-v2-insurance-notes" v-model="insuranceDialog.form.notes" rows="3" />
                                    </div>
                                    <p v-if="insuranceDialog.error.value" class="text-sm text-destructive">{{ insuranceDialog.error.value }}</p>
                                </div>
                            </div>
                            <DialogFooter class="shrink-0 gap-2 border-t px-6 py-4">
                                <Button variant="outline" @click="insuranceDialog.closeDialog()">Cancel</Button>
                                <Button :disabled="insuranceDialog.submitting.value" @click="insuranceDialog.submitDialog()">
                                    {{ insuranceDialog.submitting.value ? 'Saving...' : 'Add insurance' }}
                                </Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog :open="medicationProfileDialog.open.value" @update:open="(isOpen) => (isOpen ? (medicationProfileDialog.open.value = true) : medicationProfileDialog.closeDialog())">
                    <DialogContent variant="form" size="2xl">
                        <div class="flex h-full max-h-[90vh] flex-col">
                            <DialogHeader class="shrink-0 border-b bg-background px-6 py-4">
                                <DialogTitle>{{ medicationProfileDialog.editingId.value ? 'Edit current medication entry' : 'Add current medication entry' }}</DialogTitle>
                                <DialogDescription>Maintain the longitudinal current medication list used for reconciliation and prescribing review.</DialogDescription>
                            </DialogHeader>
                            <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                                <div class="grid gap-4">
                                    <div class="grid gap-2">
                                        <Label for="patient-chart-v2-medprofile-name">Medication</Label>
                                        <Input id="patient-chart-v2-medprofile-name" v-model="medicationProfileDialog.form.medicationName" placeholder="Medication name" />
                                        <p v-if="medicationProfileDialog.formErrors.value.medicationName?.length" class="text-sm text-destructive">{{ medicationProfileDialog.formErrors.value.medicationName[0] }}</p>
                                    </div>
                                    <div class="grid gap-4 sm:grid-cols-2">
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-medprofile-code">Code</Label>
                                            <Input id="patient-chart-v2-medprofile-code" v-model="medicationProfileDialog.form.medicationCode" placeholder="Optional code" />
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-medprofile-dose">Dose</Label>
                                            <Input id="patient-chart-v2-medprofile-dose" v-model="medicationProfileDialog.form.dose" placeholder="e.g. 500 mg" />
                                        </div>
                                    </div>
                                    <div class="grid gap-4 sm:grid-cols-3">
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-medprofile-route">Route</Label>
                                            <Input id="patient-chart-v2-medprofile-route" v-model="medicationProfileDialog.form.route" placeholder="e.g. oral" />
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-medprofile-frequency">Frequency</Label>
                                            <Input id="patient-chart-v2-medprofile-frequency" v-model="medicationProfileDialog.form.frequency" placeholder="e.g. twice_daily" />
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-medprofile-source">Source</Label>
                                            <select
                                                id="patient-chart-v2-medprofile-source"
                                                v-model="medicationProfileDialog.form.source"
                                                class="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="home_medication">Home medication</option>
                                                <option value="chronic_therapy">Chronic therapy</option>
                                                <option value="external_prescription">External prescription</option>
                                                <option value="discharge_medication">Discharge medication</option>
                                                <option value="manual_entry">Manual entry</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="grid gap-4 sm:grid-cols-3">
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-medprofile-status">Status</Label>
                                            <select
                                                id="patient-chart-v2-medprofile-status"
                                                v-model="medicationProfileDialog.form.status"
                                                class="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="active">Active</option>
                                                <option value="stopped">Stopped</option>
                                                <option value="completed">Completed</option>
                                                <option value="entered_in_error">Entered in error</option>
                                            </select>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-medprofile-started">Started</Label>
                                            <Input id="patient-chart-v2-medprofile-started" v-model="medicationProfileDialog.form.startedAt" type="date" />
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="patient-chart-v2-medprofile-stopped">Stopped</Label>
                                            <Input id="patient-chart-v2-medprofile-stopped" v-model="medicationProfileDialog.form.stoppedAt" type="date" />
                                        </div>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="patient-chart-v2-medprofile-indication">Indication</Label>
                                        <Input id="patient-chart-v2-medprofile-indication" v-model="medicationProfileDialog.form.indication" placeholder="Clinical indication" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="patient-chart-v2-medprofile-notes">Notes</Label>
                                        <Textarea id="patient-chart-v2-medprofile-notes" v-model="medicationProfileDialog.form.notes" rows="3" placeholder="Source, adherence context, and supporting notes" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="patient-chart-v2-medprofile-reconciliation-note">Reconciliation note</Label>
                                        <Textarea id="patient-chart-v2-medprofile-reconciliation-note" v-model="medicationProfileDialog.form.reconciliationNote" rows="2" placeholder="Optional reconciliation note" />
                                    </div>
                                    <p v-if="medicationProfileDialog.error.value" class="text-sm text-destructive">{{ medicationProfileDialog.error.value }}</p>
                                </div>
                            </div>
                            <DialogFooter class="shrink-0 gap-2 border-t px-6 py-4">
                                <Button variant="outline" @click="medicationProfileDialog.closeDialog()">Cancel</Button>
                                <Button :disabled="medicationProfileDialog.submitting.value" @click="medicationProfileDialog.submitDialog()">
                                    {{ medicationProfileDialog.submitting.value ? 'Saving...' : medicationProfileDialog.editingId.value ? 'Save changes' : 'Add medication' }}
                                </Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            </Tabs>
        </div>

        <LaboratoryOrderDetailSheet
            v-model:open="reviewLabSheetOpen"
            :order="reviewLabOrderQuery.data.value?.data ?? null"
            :loading="reviewLabOrderQuery.isPending.value"
            :load-error="reviewLabOrderQuery.isError.value ? ((reviewLabOrderQuery.error.value as Error | null)?.message ?? 'Unable to load this result.') : null"
            :can-create="false"
        />
        <PatientEditSheet v-model:open="editSheetOpen" :patient="patient" @updated="onPatientUpdated" />
        <VitalsEditSheet v-model:open="editVitalsOpen" :patient-id="props.patientId" :vitals="structuredVitals" @updated="onVitalsUpdated" />
        <VitalsEditSheet v-model:open="recordVitalsOpen" :patient-id="props.patientId" :vitals="null" @updated="onVitalsUpdated" />
    </AppLayout>
</template>
