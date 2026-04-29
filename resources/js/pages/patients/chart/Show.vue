<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { patientChartHref } from '@/lib/patientChart';
import { type BreadcrumbItem } from '@/types';

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
    region: string | null;
    district: string | null;
    addressLine: string | null;
    status: string | null;
};

type MedicalRecord = {
    id: string;
    recordNumber: string | null;
    appointmentId: string | null;
    admissionId: string | null;
    encounterAt: string | null;
    recordType: string | null;
    assessment: string | null;
    plan: string | null;
    diagnosisCode: string | null;
    status: string | null;
};

type Appointment = {
    id: string;
    appointmentNumber: string | null;
    department: string | null;
    scheduledAt: string | null;
    durationMinutes: number | null;
    reason: string | null;
    triageVitalsSummary: string | null;
    status: string | null;
};

type CurrentCareFlags = {
    isCurrent: boolean;
    requiresReview: boolean;
    priorityRank: number;
    workflowHint?: string | null;
    nextAction?: CurrentCareNextAction | null;
};

type CurrentCareNextAction = {
    key: string;
    label: string;
    emphasis?: 'primary' | 'secondary' | 'warning';
};

type LaboratoryCurrentCareFlags = CurrentCareFlags & {
    isPending?: boolean;
    hasCriticalResult?: boolean;
    hasAbnormalResult?: boolean;
    isRecentlyCompleted?: boolean;
};

type PharmacyCurrentCareFlags = CurrentCareFlags & {
    isActiveWorkflow?: boolean;
    awaitingVerification?: boolean;
    awaitingReconciliation?: boolean;
    hasPolicyIssue?: boolean;
    wasRecentlyDispensed?: boolean;
};

type RadiologyCurrentCareFlags = CurrentCareFlags & {
    isPending?: boolean;
    hasCriticalReport?: boolean;
    hasAbnormalReport?: boolean;
    isRecentlyCompleted?: boolean;
};

type TheatreCurrentCareFlags = CurrentCareFlags & {
    isInProgress?: boolean;
    isUpcoming?: boolean;
    wasRecentlyCompleted?: boolean;
};

type LaboratoryOrder = {
    id: string;
    orderNumber: string | null;
    appointmentId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    orderedAt: string | null;
    testName: string | null;
    priority: string | null;
    resultSummary: string | null;
    resultedAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    currentCare?: LaboratoryCurrentCareFlags | null;
};

type LaboratoryOrderStatusCounts = {
    ordered: number;
    collected: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    total: number;
};

type LaboratoryOrderStatusCountsResponse = { data: LaboratoryOrderStatusCounts };

type PharmacyOrder = {
    id: string;
    orderNumber: string | null;
    appointmentId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    orderedAt: string | null;
    medicationCode: string | null;
    medicationName: string | null;
    dosageInstruction: string | null;
    quantityPrescribed: string | number | null;
    quantityDispensed: string | number | null;
    dispensedAt: string | null;
    reconciliationStatus: string | null;
    reconciliationNote: string | null;
    reconciledAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    currentCare?: PharmacyCurrentCareFlags | null;
};

type PharmacyOrderStatusCounts = {
    pending: number;
    in_preparation: number;
    partially_dispensed: number;
    dispensed: number;
    cancelled: number;
    total: number;
};

type PharmacyOrderStatusCountsResponse = { data: PharmacyOrderStatusCounts };

type RadiologyOrder = {
    id: string;
    orderNumber: string | null;
    appointmentId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    orderedAt: string | null;
    modality: string | null;
    studyDescription: string | null;
    reportSummary: string | null;
    completedAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    currentCare?: RadiologyCurrentCareFlags | null;
};

type RadiologyOrderStatusCounts = {
    ordered: number;
    scheduled: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    other: number;
    total: number;
};

type RadiologyOrderStatusCountsResponse = { data: RadiologyOrderStatusCounts };

type TheatreProcedure = {
    id: string;
    procedureNumber: string | null;
    appointmentId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    scheduledAt: string | null;
    procedureType: string | null;
    procedureName: string | null;
    theatreRoomName: string | null;
    completedAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    notes: string | null;
    currentCare?: TheatreCurrentCareFlags | null;
};

type EncounterLifecycleTargetKind = 'laboratory' | 'pharmacy' | 'radiology' | 'theatre';
type EncounterLifecycleAction = 'cancel' | 'discontinue' | 'entered_in_error';

type TheatreProcedureStatusCounts = {
    planned: number;
    in_preop: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    other: number;
    total: number;
};

type TheatreProcedureStatusCountsResponse = { data: TheatreProcedureStatusCounts };

type BillingInvoice = {
    id: string;
    invoiceNumber: string | null;
    appointmentId: string | null;
    invoiceDate: string | null;
    currencyCode: string | null;
    totalAmount: string | number | null;
    balanceAmount: string | number | null;
    notes: string | null;
    status: string | null;
};

type BillingInvoiceStatusCounts = {
    draft: number;
    issued: number;
    partially_paid: number;
    paid: number;
    cancelled: number;
    voided: number;
    other: number;
    total: number;
};

type BillingInvoiceStatusCountsResponse = { data: BillingInvoiceStatusCounts };
type ApiItemResponse<T> = { data: T };
type ApiListResponse<T> = { data: T[]; meta?: { total?: number } };
type ValidationErrorResponse = { message?: string; errors?: Record<string, string[]> };

type PatientAllergy = {
    id: string;
    patientId: string | null;
    substanceCode: string | null;
    substanceName: string | null;
    reaction: string | null;
    severity: string | null;
    status: string | null;
    notedAt: string | null;
    lastReactionAt: string | null;
    notes: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type PatientMedicationProfile = {
    id: string;
    patientId: string | null;
    medicationCode: string | null;
    medicationName: string | null;
    dose: string | null;
    route: string | null;
    frequency: string | null;
    source: string | null;
    status: string | null;
    startedAt: string | null;
    stoppedAt: string | null;
    indication: string | null;
    notes: string | null;
    lastReconciledAt: string | null;
    reconciliationNote: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type PatientMedicationReconciliation = {
    counts: {
        activeAllergies: number;
        activeMedicationProfile: number;
        activeDispensedOrders: number;
        unreconciledDispensedOrders: number;
        continueCandidates: number;
        reviewRequired: number;
    };
    activeAllergies: PatientAllergy[];
    activeMedicationProfile: PatientMedicationProfile[];
    activeDispensedOrders: PharmacyOrder[];
    unreconciledDispensedOrders: PharmacyOrder[];
    continueCandidates: PharmacyOrder[];
    profileWithoutDispensedOrders: PatientMedicationProfile[];
    newOrdersToProfile: PharmacyOrder[];
    suggestedActions: string[];
};

type PatientMedicationReconciliationResponse = { data: PatientMedicationReconciliation };
type PatientChartTab =
    | 'overview'
    | 'timeline'
    | 'visits'
    | 'medications'
    | 'orders'
    | 'billing'
    | 'records';
type PatientChartTabDefinition = {
    value: PatientChartTab;
    label: string;
    visible: boolean;
    count?: number;
    hasAlert?: boolean;
};
type OrdersWorkspaceLane = 'laboratory' | 'imaging' | 'pharmacy' | 'procedures';
type OrdersWorkspaceScope = 'focused' | 'current' | 'history';

type PatientAllergyForm = {
    substanceCode: string;
    substanceName: string;
    reaction: string;
    severity: string;
    status: string;
    notedAt: string;
    lastReactionAt: string;
    notes: string;
};

type PatientMedicationProfileForm = {
    medicationCode: string;
    medicationName: string;
    dose: string;
    route: string;
    frequency: string;
    source: string;
    status: string;
    startedAt: string;
    stoppedAt: string;
    indication: string;
    notes: string;
    lastReconciledAt: string;
    reconciliationNote: string;
};

type MedicationWorkspaceSection = 'allergies' | 'profile' | 'reconciliation';

type ChartTimelineEvent = {
    id: string;
    category: 'visit' | 'consultation' | 'laboratory' | 'imaging' | 'pharmacy' | 'procedure' | 'billing';
    occurredAt: string | null;
    title: string;
    subtitle: string;
    summary: string;
    status: string | null;
    appointmentId: string | null;
    href: string | null;
    actionLabel: string | null;
    accentClass: string;
    icon: string;
};

const props = defineProps<{ patientId: string }>();

const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

const patient = ref<Patient | null>(null);
const patientLoading = ref(true);
const patientError = ref<string | null>(null);

const records = ref<MedicalRecord[]>([]);
const recordsTotal = ref(0);
const recordsLoading = ref(false);
const recordsError = ref<string | null>(null);

const appointments = ref<Appointment[]>([]);
const appointmentsLoading = ref(false);
const appointmentsError = ref<string | null>(null);

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

const canReadMedicalRecords = computed(
    () => isFacilitySuperAdmin.value || hasPermission('medical.records.read'),
);
const canReadAppointments = computed(
    () => isFacilitySuperAdmin.value || hasPermission('appointments.read'),
);
const canUpdatePatients = computed(
    () => isFacilitySuperAdmin.value || hasPermission('patients.update'),
);
const canReadLaboratoryOrders = computed(
    () => isFacilitySuperAdmin.value || hasPermission('laboratory.orders.read'),
);
const canCreateLaboratoryOrders = computed(
    () => isFacilitySuperAdmin.value || hasPermission('laboratory.orders.create'),
);
const canReadPharmacyOrders = computed(
    () => isFacilitySuperAdmin.value || hasPermission('pharmacy.orders.read'),
);
const canCreatePharmacyOrders = computed(
    () => isFacilitySuperAdmin.value || hasPermission('pharmacy.orders.create'),
);
const canReadRadiologyOrders = computed(
    () => isFacilitySuperAdmin.value || hasPermission('radiology.orders.read'),
);
const canCreateRadiologyOrders = computed(
    () => isFacilitySuperAdmin.value || hasPermission('radiology.orders.create'),
);
const canReadTheatreProcedures = computed(
    () => isFacilitySuperAdmin.value || hasPermission('theatre.procedures.read'),
);
const canCreateTheatreProcedures = computed(
    () => isFacilitySuperAdmin.value || hasPermission('theatre.procedures.create'),
);
const canReadBillingInvoices = computed(
    () => isFacilitySuperAdmin.value || hasPermission('billing.invoices.read'),
);
const canCreateBillingInvoices = computed(
    () => isFacilitySuperAdmin.value || hasPermission('billing.invoices.create'),
);
const handoffSource = queryParam('from');
const handoffAppointmentId = queryParam('appointmentId');
const focusedAppointmentId = ref(handoffAppointmentId);
const highlightedRecordId = queryParam('recordId');
const initialTab = queryParam('tab');
const activeTab = ref<PatientChartTab>(
    initialTab === 'visits'
        ? 'visits'
        : initialTab === 'timeline'
          ? 'timeline'
          : initialTab === 'medications'
            ? 'medications'
          : initialTab === 'orders'
            ? 'orders'
            : initialTab === 'billing'
              ? 'billing'
            : initialTab === 'records' || highlightedRecordId !== ''
              ? 'records'
              : 'overview',
);
const ordersWorkspaceTab = ref<OrdersWorkspaceLane>('laboratory');
const ordersWorkspaceScope = ref<OrdersWorkspaceScope>('focused');

const activeVisitStatuses = ['waiting_triage', 'waiting_provider', 'in_consultation'];
const openVisitStatuses = ['scheduled', ...activeVisitStatuses];

const primaryVisit = computed(() => {
    if (focusedAppointmentId.value) {
        return (
            appointments.value.find(
                (appointment) => appointment.id === focusedAppointmentId.value,
            ) ?? null
        );
    }

    return (
        appointments.value.find((appointment) =>
            activeVisitStatuses.includes(appointment.status || ''),
        ) ??
        appointments.value.find(
            (appointment) => appointment.status === 'scheduled',
        ) ??
        appointments.value[0] ??
        null
    );
});

const latestRecord = computed(() => records.value[0] ?? null);
const visitFocusOptions = computed(() => appointments.value.slice(0, 4));
const patientLocationLabel = computed(() => {
    if (!patient.value) return 'Location not recorded';
    return (
        [
            patient.value.addressLine,
            patient.value.district,
            patient.value.region,
        ]
            .filter(Boolean)
            .join(', ') || 'Location not recorded'
    );
});
const chartCounts = computed(() => ({
    visits: appointments.value.length,
    activeVisits: appointments.value.filter((appointment) =>
        activeVisitStatuses.includes(appointment.status || ''),
    ).length,
    records: recordsTotal.value,
    timelineEvents: timelineEvents.value.length,
}));

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Patients', href: '/patients' },
    {
        title: patientName(patient.value) || 'Patient Chart',
        href: patientChartHref(props.patientId, {
            tab: activeTab.value === 'overview' ? null : activeTab.value,
            appointmentId: focusedAppointmentId.value || null,
            from: handoffSource || null,
        }),
    },
]);

const pageTitle = computed(() =>
    patient.value
        ? `${patientName(patient.value)} | Patient Chart`
        : 'Patient Chart',
);

const appointmentsWorkspaceHref = computed(() => {
    if (primaryVisit.value) {
        return appointmentWorkspaceHref(primaryVisit.value);
    }

    return `/appointments?patientId=${encodeURIComponent(props.patientId)}`;
});
const scheduleAppointmentHref = computed(() => {
    const params = new URLSearchParams({
        patientId: props.patientId,
        open: 'schedule',
        from: 'patient-chart',
    });

    if (patient.value) {
        params.set('patientName', patientName(patient.value));
        if (patient.value.patientNumber) {
            params.set('patientNumber', patient.value.patientNumber);
        }
    }

    return `/appointments?${params.toString()}`;
});
const hasOpenVisitInChart = computed(() =>
    Boolean(primaryVisit.value && openVisitStatuses.includes(primaryVisit.value.status || '')),
);
const visitPrimaryActionHref = computed(() =>
    hasOpenVisitInChart.value ? appointmentsWorkspaceHref.value : scheduleAppointmentHref.value,
);
const visitPrimaryActionLabel = computed(() => {
    if (!hasOpenVisitInChart.value || !primaryVisit.value) return 'Schedule appointment';

    switch (primaryVisit.value.status) {
        case 'in_consultation':
            return 'Resume consultation';
        case 'waiting_provider':
            return 'Start consultation';
        case 'waiting_triage':
            return 'Open triage';
        case 'scheduled':
            return 'Open scheduled visit';
        default:
            return 'Open current visit';
    }
});
const visitPrimaryActionIcon = computed(() =>
    hasOpenVisitInChart.value ? 'calendar-clock' : 'calendar-plus-2',
);
const visitWorkspaceActionLabel = computed(() =>
    hasOpenVisitInChart.value ? 'Open visit workspace' : 'Open visits',
);
const timelineAppointmentActionHref = computed(() => visitPrimaryActionHref.value);
const timelineAppointmentActionLabel = computed(() => visitPrimaryActionLabel.value);
const recordsRegistryHref = computed(() => {
    const params = new URLSearchParams({ patientId: props.patientId });
    if (highlightedRecordId) params.set('recordId', highlightedRecordId);
    if (focusedAppointmentId.value) {
        params.set('appointmentId', focusedAppointmentId.value);
    } else if (primaryVisit.value?.id) {
        params.set('appointmentId', primaryVisit.value.id);
    }
    return `/medical-records?${params.toString()}`;
});

const laboratoryOrders = ref<LaboratoryOrder[]>([]);
const laboratoryOrderCounts = ref<LaboratoryOrderStatusCounts | null>(null);
const laboratoryOrdersLoading = ref(false);
const laboratoryOrdersError = ref<string | null>(null);

const pharmacyOrders = ref<PharmacyOrder[]>([]);
const pharmacyOrderCounts = ref<PharmacyOrderStatusCounts | null>(null);
const pharmacyOrdersLoading = ref(false);
const pharmacyOrdersError = ref<string | null>(null);

const patientAllergies = ref<PatientAllergy[]>([]);
const patientAllergiesLoading = ref(false);
const patientAllergiesError = ref<string | null>(null);

const patientMedicationProfile = ref<PatientMedicationProfile[]>([]);
const patientMedicationProfileLoading = ref(false);
const patientMedicationProfileError = ref<string | null>(null);

const patientMedicationReconciliation = ref<PatientMedicationReconciliation | null>(null);
const patientMedicationReconciliationLoading = ref(false);
const patientMedicationReconciliationError = ref<string | null>(null);

const allergyDialogOpen = ref(false);
const allergyDialogSubmitting = ref(false);
const allergyDialogError = ref<string | null>(null);
const editingAllergyId = ref('');
const allergyFormErrors = ref<Record<string, string[]>>({});
const allergyForm = reactive<PatientAllergyForm>({
    substanceCode: '',
    substanceName: '',
    reaction: '',
    severity: 'unknown',
    status: 'active',
    notedAt: '',
    lastReactionAt: '',
    notes: '',
});

const medicationProfileDialogOpen = ref(false);
const medicationProfileDialogSubmitting = ref(false);
const medicationProfileDialogError = ref<string | null>(null);
const editingMedicationProfileId = ref('');
const medicationProfileFormErrors = ref<Record<string, string[]>>({});
const medicationWorkspaceActionKey = ref('');
const medicationWorkspaceSectionIds: Record<MedicationWorkspaceSection, string> = {
    allergies: 'patient-chart-medication-allergies',
    profile: 'patient-chart-medication-profile',
    reconciliation: 'patient-chart-medication-reconciliation',
};
const medicationProfileForm = reactive<PatientMedicationProfileForm>({
    medicationCode: '',
    medicationName: '',
    dose: '',
    route: '',
    frequency: '',
    source: 'home_medication',
    status: 'active',
    startedAt: '',
    stoppedAt: '',
    indication: '',
    notes: '',
    lastReconciledAt: '',
    reconciliationNote: '',
});

const radiologyOrders = ref<RadiologyOrder[]>([]);
const radiologyOrderCounts = ref<RadiologyOrderStatusCounts | null>(null);
const radiologyOrdersLoading = ref(false);
const radiologyOrdersError = ref<string | null>(null);

const theatreProcedures = ref<TheatreProcedure[]>([]);
const theatreProcedureCounts = ref<TheatreProcedureStatusCounts | null>(null);
const theatreProceduresLoading = ref(false);
const theatreProceduresError = ref<string | null>(null);
const encounterLifecycleDialogOpen = ref(false);
const encounterLifecycleSubmitting = ref(false);
const encounterLifecycleError = ref<string | null>(null);
const encounterLifecycleTargetKind = ref<EncounterLifecycleTargetKind | null>(null);
const encounterLifecycleTargetId = ref('');
const encounterLifecycleAction = ref<EncounterLifecycleAction | null>(null);
const encounterLifecycleReason = ref('');

const billingInvoices = ref<BillingInvoice[]>([]);
const billingInvoiceCounts = ref<BillingInvoiceStatusCounts | null>(null);
const billingInvoicesLoading = ref(false);
const billingInvoicesError = ref<string | null>(null);

const hasOrdersAndResultsAccess = computed(
    () =>
        canReadLaboratoryOrders.value ||
        canReadPharmacyOrders.value ||
        canReadRadiologyOrders.value ||
        canReadTheatreProcedures.value,
);
const hasMedicationWorkspaceAccess = computed(
    () => canUpdatePatients.value || canReadPharmacyOrders.value || canCreatePharmacyOrders.value,
);
const hasFocusedVisitInChart = computed(() => Boolean(primaryVisit.value?.id));
const canUseFocusedVisitOrdersScope = computed(
    () => canReadAppointments.value && hasFocusedVisitInChart.value,
);
const useFocusedVisitOrdersScope = computed(
    () => ordersWorkspaceScope.value === 'focused' && canUseFocusedVisitOrdersScope.value,
);
const useCurrentOrdersScope = computed(
    () => ordersWorkspaceScope.value === 'current' && hasOrdersAndResultsAccess.value,
);
const hasBillingAccess = computed(
    () => canReadBillingInvoices.value || canCreateBillingInvoices.value,
);
const patientChartTabs = computed<PatientChartTabDefinition[]>(() => {
    const ordersActive =
        careCounts.value.labActive +
        careCounts.value.imagingActive +
        careCounts.value.pharmacyActive +
        careCounts.value.procedureActive;
    const unreconciledMeds =
        patientMedicationReconciliation.value?.counts.unreconciledDispensedOrders ?? 0;
    return [
        { value: 'overview', label: 'Overview', visible: true },
        {
            value: 'timeline',
            label: 'Timeline',
            visible: true,
            count: timelineEvents.value.length || undefined,
        },
        {
            value: 'visits',
            label: 'Visits',
            visible: canReadAppointments.value,
            count: chartCounts.value.activeVisits || undefined,
            hasAlert: chartCounts.value.activeVisits > 0,
        },
        {
            value: 'medications',
            label: 'Medications',
            visible: hasMedicationWorkspaceAccess.value,
            count: unreconciledMeds > 0 ? unreconciledMeds : undefined,
            hasAlert: unreconciledMeds > 0,
        },
        {
            value: 'orders',
            label: 'Orders & Results',
            visible: hasOrdersAndResultsAccess.value,
            count: ordersActive || undefined,
            hasAlert: ordersActive > 0,
        },
        {
            value: 'billing',
            label: 'Billing',
            visible: hasBillingAccess.value,
            count: careCounts.value.billingOpen || undefined,
            hasAlert: careCounts.value.billingOpen > 0,
        },
        {
            value: 'records',
            label: 'Consultation Notes',
            visible: canReadMedicalRecords.value,
            count: chartCounts.value.records || undefined,
        },
    ].filter((tab) => tab.visible);
});
const patientChartTabsGridClass = computed(() => {
    const count = patientChartTabs.value.length;

    if (count <= 2) return 'sm:grid-cols-2';
    if (count === 3) return 'sm:grid-cols-3';
    if (count === 4) return 'sm:grid-cols-4';
    if (count === 5) return 'sm:grid-cols-5';
    if (count === 6) return 'sm:grid-cols-6';

    return 'sm:grid-cols-7';
});
const availableOrdersWorkspaceLanes = computed<OrdersWorkspaceLane[]>(() => {
    const lanes: OrdersWorkspaceLane[] = [];

    if (canReadLaboratoryOrders.value) lanes.push('laboratory');
    if (canReadRadiologyOrders.value) lanes.push('imaging');
    if (canReadPharmacyOrders.value) lanes.push('pharmacy');
    if (canReadTheatreProcedures.value) lanes.push('procedures');

    return lanes;
});

const availableOrdersWorkspaceScopes = computed<OrdersWorkspaceScope[]>(() => {
    const scopes: OrdersWorkspaceScope[] = [];

    if (canUseFocusedVisitOrdersScope.value) scopes.push('focused');
    if (hasOrdersAndResultsAccess.value) scopes.push('current');
    scopes.push('history');

    return Array.from(new Set(scopes));
});

const defaultOrdersWorkspaceScope = computed<OrdersWorkspaceScope>(() => {
    if (canUseFocusedVisitOrdersScope.value) {
        return 'focused';
    }

    if (hasOrdersAndResultsAccess.value) {
        return 'current';
    }

    return 'history';
});

watch(
    availableOrdersWorkspaceScopes,
    (scopes) => {
        if (!scopes.includes(ordersWorkspaceScope.value)) {
            ordersWorkspaceScope.value = defaultOrdersWorkspaceScope.value;
        }
    },
    { immediate: true },
);

const ordersWorkspaceScopeSummary = computed(() => {
    if (appointmentsLoading.value && canReadAppointments.value && appointments.value.length === 0) {
        return 'Current view: checking visit context...';
    }

    if (useFocusedVisitOrdersScope.value && primaryVisit.value) {
        return `Current view: focused visit (${primaryVisit.value.appointmentNumber || 'Visit'})`;
    }

    if (useCurrentOrdersScope.value) {
        return 'Current view: current care';
    }

    return 'Current view: all visits';
});

const ordersWorkspaceScopeHint = computed(() => {
    if (appointmentsLoading.value && canReadAppointments.value && appointments.value.length === 0) {
        return 'The chart is checking whether there is an active or scheduled visit to focus.';
    }

    if (useFocusedVisitOrdersScope.value) {
        return 'Only orders and results linked to this visit are shown.';
    }

    if (useCurrentOrdersScope.value) {
        return 'Active orders, unreconciled medication work, and recent results are shown first.';
    }

    if (!canReadAppointments.value && hasOrdersAndResultsAccess.value) {
        return 'This role works from current clinical activity or full patient history, not visit-by-visit encounter focus.';
    }

    if (canUseFocusedVisitOrdersScope.value) {
        return 'Orders and results from all visits are shown. Switch to Focused visit or Current care to narrow the workspace.';
    }

    return 'No active or scheduled visit is available to focus, so the chart is showing the patient history.';
});

const careCounts = computed(() => ({
    labActive:
        (laboratoryOrderCounts.value?.ordered ?? 0) +
        (laboratoryOrderCounts.value?.collected ?? 0) +
        (laboratoryOrderCounts.value?.in_progress ?? 0),
    labCompleted: laboratoryOrderCounts.value?.completed ?? 0,
    imagingActive:
        (radiologyOrderCounts.value?.ordered ?? 0) +
        (radiologyOrderCounts.value?.scheduled ?? 0) +
        (radiologyOrderCounts.value?.in_progress ?? 0),
    imagingCompleted: radiologyOrderCounts.value?.completed ?? 0,
    procedureActive:
        (theatreProcedureCounts.value?.planned ?? 0) +
        (theatreProcedureCounts.value?.in_preop ?? 0) +
        (theatreProcedureCounts.value?.in_progress ?? 0),
    procedureCompleted: theatreProcedureCounts.value?.completed ?? 0,
    pharmacyActive:
        (pharmacyOrderCounts.value?.pending ?? 0) +
        (pharmacyOrderCounts.value?.in_preparation ?? 0) +
        (pharmacyOrderCounts.value?.partially_dispensed ?? 0),
    pharmacyDispensed: pharmacyOrderCounts.value?.dispensed ?? 0,
    billingOpen:
        (billingInvoiceCounts.value?.draft ?? 0) +
        (billingInvoiceCounts.value?.issued ?? 0) +
        (billingInvoiceCounts.value?.partially_paid ?? 0),
    billingSettled: billingInvoiceCounts.value?.paid ?? 0,
}));

const latestLaboratoryResult = computed(
    () =>
        laboratoryOrders.value.find(
            (order) =>
                (order.status ?? '').toLowerCase() === 'completed' &&
                ((order.resultSummary ?? '').trim() !== '' || (order.resultedAt ?? '').trim() !== ''),
        ) ?? null,
);
const focusedEncounterLaboratoryOrders = computed(() => {
    const appointmentId = primaryVisit.value?.id;
    if (!appointmentId) {
        return [];
    }

    return laboratoryOrders.value.filter(
        (order) => order.appointmentId === appointmentId,
    );
});
const currentLaboratoryOrders = computed(() =>
    laboratoryOrders.value.filter((order) => isCurrentLaboratoryOrder(order)),
);
const prioritizedCurrentLaboratoryOrders = computed(() =>
    sortCurrentItems(
        currentLaboratoryOrders.value,
        laboratoryCurrentPriority,
        laboratoryCurrentRecency,
    ),
);
const scopedLaboratoryOrders = computed(() =>
    useFocusedVisitOrdersScope.value
        ? focusedEncounterLaboratoryOrders.value
        : useCurrentOrdersScope.value
          ? prioritizedCurrentLaboratoryOrders.value
        : laboratoryOrders.value,
);
const displayedLaboratoryOrders = computed(() =>
    scopedLaboratoryOrders.value.slice(0, 5),
);
const displayedLaboratoryOrdersScopeLabel = computed(() =>
    useFocusedVisitOrdersScope.value
        ? 'Focused visit orders'
        : useCurrentOrdersScope.value
          ? 'Current laboratory work'
        : 'Recent laboratory orders',
);
const displayedLaboratoryOrdersScopeDescription = computed(() => {
    if (useFocusedVisitOrdersScope.value) {
        return 'Only laboratory orders linked to the visit currently in chart focus are shown here.';
    }

    if (useCurrentOrdersScope.value) {
        return 'Critical, abnormal, pending, and recent laboratory work is shown first.';
    }

    return 'The most recent laboratory orders across the patient history are shown here.';
});
const latestRadiologyReport = computed(
    () =>
        radiologyOrders.value.find(
            (order) =>
                (order.status ?? '').toLowerCase() === 'completed' &&
                ((order.reportSummary ?? '').trim() !== '' || (order.completedAt ?? '').trim() !== ''),
        ) ?? null,
);
const focusedEncounterRadiologyOrders = computed(() => {
    const appointmentId = primaryVisit.value?.id;
    if (!appointmentId) {
        return [];
    }

    return radiologyOrders.value.filter(
        (order) => order.appointmentId === appointmentId,
    );
});
const currentRadiologyOrders = computed(() =>
    radiologyOrders.value.filter((order) => isCurrentRadiologyOrder(order)),
);
const prioritizedCurrentRadiologyOrders = computed(() =>
    sortCurrentItems(
        currentRadiologyOrders.value,
        radiologyCurrentPriority,
        radiologyCurrentRecency,
    ),
);
const scopedRadiologyOrders = computed(() =>
    useFocusedVisitOrdersScope.value
        ? focusedEncounterRadiologyOrders.value
        : useCurrentOrdersScope.value
          ? prioritizedCurrentRadiologyOrders.value
        : radiologyOrders.value,
);
const displayedRadiologyOrders = computed(() =>
    scopedRadiologyOrders.value.slice(0, 5),
);
const displayedRadiologyOrdersScopeLabel = computed(() =>
    useFocusedVisitOrdersScope.value
        ? 'Focused visit orders'
        : useCurrentOrdersScope.value
          ? 'Current imaging work'
        : 'Recent imaging orders',
);
const displayedRadiologyOrdersScopeDescription = computed(() => {
    if (useFocusedVisitOrdersScope.value) {
        return 'Only imaging orders linked to the visit currently in chart focus are shown here.';
    }

    if (useCurrentOrdersScope.value) {
        return 'Critical, abnormal, pending, and recent imaging work is shown first.';
    }

    return 'The most recent imaging orders across the patient history are shown here.';
});
const focusedEncounterPharmacyOrders = computed(() => {
    const appointmentId = primaryVisit.value?.id;
    if (!appointmentId) {
        return [];
    }

    return pharmacyOrders.value.filter(
        (order) => order.appointmentId === appointmentId,
    );
});
const currentPharmacyOrders = computed(() =>
    pharmacyOrders.value.filter((order) => isCurrentPharmacyOrder(order)),
);
const prioritizedCurrentPharmacyOrders = computed(() =>
    sortCurrentItems(
        currentPharmacyOrders.value,
        pharmacyCurrentPriority,
        pharmacyCurrentRecency,
    ),
);
const scopedPharmacyOrders = computed(() =>
    useFocusedVisitOrdersScope.value
        ? focusedEncounterPharmacyOrders.value
        : useCurrentOrdersScope.value
          ? prioritizedCurrentPharmacyOrders.value
        : pharmacyOrders.value,
);
const displayedPharmacyOrders = computed(() =>
    scopedPharmacyOrders.value.slice(0, 5),
);
const displayedPharmacyOrdersScopeLabel = computed(() =>
    useFocusedVisitOrdersScope.value
        ? 'Focused visit orders'
        : useCurrentOrdersScope.value
          ? 'Current medication work'
        : 'Recent pharmacy orders',
);
const displayedPharmacyOrdersScopeDescription = computed(() => {
    if (useFocusedVisitOrdersScope.value) {
        return 'Only medication orders linked to the visit currently in chart focus are shown here.';
    }

    if (useCurrentOrdersScope.value) {
        return 'Verification, reconciliation, active medication orders, and recent pharmacy work are shown first.';
    }

    return 'The most recent pharmacy orders across the patient history are shown here.';
});
const focusedEncounterTheatreProcedures = computed(() => {
    const appointmentId = primaryVisit.value?.id;
    if (!appointmentId) {
        return [];
    }

    return theatreProcedures.value.filter(
        (procedure) => procedure.appointmentId === appointmentId,
    );
});
const currentTheatreProcedures = computed(() =>
    theatreProcedures.value.filter((procedure) => isCurrentTheatreProcedure(procedure)),
);
const prioritizedCurrentTheatreProcedures = computed(() =>
    sortCurrentItems(
        currentTheatreProcedures.value,
        theatreCurrentPriority,
        theatreCurrentRecency,
    ),
);
const scopedTheatreProcedures = computed(() =>
    useFocusedVisitOrdersScope.value
        ? focusedEncounterTheatreProcedures.value
        : useCurrentOrdersScope.value
          ? prioritizedCurrentTheatreProcedures.value
        : theatreProcedures.value,
);
const displayedTheatreProcedures = computed(() =>
    scopedTheatreProcedures.value.slice(0, 5),
);
const displayedTheatreProceduresScopeLabel = computed(() =>
    useFocusedVisitOrdersScope.value
        ? 'Focused visit procedures'
        : useCurrentOrdersScope.value
          ? 'Current procedures'
        : 'Recent theatre procedures',
);
const displayedTheatreProceduresScopeDescription = computed(() => {
    if (useFocusedVisitOrdersScope.value) {
        return 'Only theatre procedures linked to the visit currently in chart focus are shown here.';
    }

    if (useCurrentOrdersScope.value) {
        return 'In-progress, upcoming, and recently completed procedures are shown first.';
    }

    return 'The most recent theatre procedures across the patient history are shown here.';
});
const focusedEncounterBillingInvoices = computed(() => {
    const appointmentId = primaryVisit.value?.id;
    if (!appointmentId) {
        return [];
    }

    return billingInvoices.value.filter(
        (invoice) => invoice.appointmentId === appointmentId,
    );
});
const displayedBillingInvoices = computed(() =>
    (
        focusedEncounterBillingInvoices.value.length > 0
            ? focusedEncounterBillingInvoices.value
            : billingInvoices.value
    ).slice(0, 5),
);
const displayedBillingInvoicesScopeLabel = computed(() =>
    focusedEncounterBillingInvoices.value.length > 0
        ? 'Focused encounter invoices'
        : 'Recent billing invoices',
);
const displayedBillingInvoicesScopeDescription = computed(() => {
    if (focusedEncounterBillingInvoices.value.length > 0) {
        return 'These invoices are already linked to the visit currently in chart focus.';
    }

    if (primaryVisit.value?.id) {
        return 'No invoice has been linked to the focused visit yet, so this summary falls back to the most recent patient billing activity.';
    }

    return 'The latest invoices for this patient will appear here as soon as billing activity is recorded.';
});
const latestBillingInvoice = computed(() => displayedBillingInvoices.value[0] ?? null);
const timelineEvents = computed<ChartTimelineEvent[]>(() => {
    const appointmentEvents = appointments.value.map<ChartTimelineEvent>((appointment) => ({
        id: `visit-${appointment.id}`,
        category: 'visit',
        occurredAt: appointment.scheduledAt,
        title: appointment.department || appointment.appointmentNumber || 'Visit scheduled',
        subtitle: appointment.appointmentNumber || 'Visit',
        summary:
            [
                appointment.reason || 'No visit reason recorded.',
                appointment.triageVitalsSummary ? `Triage: ${appointment.triageVitalsSummary}` : null,
            ]
                .filter(Boolean)
                .join(' | ') || 'Visit context recorded in the appointment workspace.',
        status: appointment.status || 'scheduled',
        appointmentId: appointment.id,
        href: canReadAppointments.value ? appointmentDetailsHref(appointment) : null,
        actionLabel: canReadAppointments.value ? 'Open visit' : null,
        accentClass: 'border-l-sky-500/70',
        icon: 'calendar-clock',
    }));

    const recordEvents = records.value.map<ChartTimelineEvent>((record) => ({
        id: `record-${record.id}`,
        category: 'consultation',
        occurredAt: record.encounterAt,
        title: record.recordNumber || 'Consultation note',
        subtitle: formatEnumLabel(record.recordType || 'consultation_note'),
        summary: [recordProblem(record), recordNextStep(record)].filter(Boolean).join(' Next: '),
        status: record.status || 'draft',
        appointmentId: record.appointmentId,
        href: canReadMedicalRecords.value ? recordRegistryHref(record) : null,
        actionLabel: canReadMedicalRecords.value ? 'Open note' : null,
        accentClass: 'border-l-emerald-500/70',
        icon: 'file-text',
    }));

    const laboratoryEvents = laboratoryOrders.value.map<ChartTimelineEvent>((order) => ({
        id: `lab-${order.id}`,
        category: 'laboratory',
        occurredAt: order.resultedAt || order.orderedAt,
        title: order.testName || 'Laboratory order',
        subtitle: (order.status ?? '').toLowerCase() === 'completed' ? 'Laboratory result' : 'Laboratory order',
        summary:
            truncatePlainText(order.resultSummary, 180) ||
            (order.priority ? `Priority: ${formatEnumLabel(order.priority)}` : 'Awaiting laboratory processing.'),
        status: order.status || 'ordered',
        appointmentId: order.appointmentId,
        href: canReadLaboratoryOrders.value ? currentCareNextActionHref('laboratory', order) : null,
        actionLabel: canReadLaboratoryOrders.value ? serviceTimelineActionLabel('laboratory', order) : null,
        accentClass: 'border-l-violet-500/70',
        icon: 'flask-conical',
    }));

    const imagingEvents = radiologyOrders.value.map<ChartTimelineEvent>((order) => ({
        id: `imaging-${order.id}`,
        category: 'imaging',
        occurredAt: order.completedAt || order.orderedAt,
        title: order.studyDescription || 'Imaging order',
        subtitle: (order.status ?? '').toLowerCase() === 'completed' ? 'Imaging report' : 'Imaging order',
        summary:
            truncatePlainText(order.reportSummary, 180) ||
            (order.modality ? `Modality: ${formatEnumLabel(order.modality)}` : 'Awaiting imaging workflow update.'),
        status: order.status || 'ordered',
        appointmentId: order.appointmentId,
        href: canReadRadiologyOrders.value ? currentCareNextActionHref('radiology', order) : null,
        actionLabel: canReadRadiologyOrders.value ? serviceTimelineActionLabel('radiology', order) : null,
        accentClass: 'border-l-amber-500/70',
        icon: 'activity',
    }));

    const pharmacyEvents = pharmacyOrders.value.map<ChartTimelineEvent>((order) => ({
        id: `pharmacy-${order.id}`,
        category: 'pharmacy',
        occurredAt: order.dispensedAt || order.orderedAt,
        title: order.medicationName || 'Pharmacy order',
        subtitle: (order.status ?? '').toLowerCase() === 'dispensed' ? 'Medication dispensed' : 'Medication order',
        summary: truncatePlainText(order.dosageInstruction, 180) || 'Medication instructions not recorded.',
        status: order.status || 'pending',
        appointmentId: order.appointmentId,
        href: canReadPharmacyOrders.value ? currentCareNextActionHref('pharmacy', order) : null,
        actionLabel: canReadPharmacyOrders.value ? serviceTimelineActionLabel('pharmacy', order) : null,
        accentClass: 'border-l-fuchsia-500/70',
        icon: 'pill',
    }));

    const theatreEvents = theatreProcedures.value.map<ChartTimelineEvent>((procedure) => ({
        id: `procedure-${procedure.id}`,
        category: 'procedure',
        occurredAt: procedure.completedAt || procedure.scheduledAt,
        title: procedure.procedureName || procedure.procedureType || 'Theatre procedure',
        subtitle: (procedure.status ?? '').toLowerCase() === 'completed' ? 'Procedure completed' : 'Procedure scheduled',
        summary:
            truncatePlainText(procedure.notes, 180) ||
            truncatePlainText(procedure.statusReason, 180) ||
            (procedure.theatreRoomName ? `Room: ${procedure.theatreRoomName}` : 'Awaiting theatre progression.'),
        status: procedure.status || 'planned',
        appointmentId: procedure.appointmentId,
        href: canReadTheatreProcedures.value ? currentCareNextActionHref('theatre', procedure) : null,
        actionLabel: canReadTheatreProcedures.value ? serviceTimelineActionLabel('theatre', procedure) : null,
        accentClass: 'border-l-cyan-500/70',
        icon: 'scissors',
    }));

    const billingEvents = billingInvoices.value.map<ChartTimelineEvent>((invoice) => ({
        id: `billing-${invoice.id}`,
        category: 'billing',
        occurredAt: invoice.invoiceDate,
        title: invoice.invoiceNumber || 'Billing invoice',
        subtitle: 'Billing',
        summary: `Balance ${formatMoney(invoice.balanceAmount, invoice.currencyCode)}`,
        status: invoice.status || 'draft',
        appointmentId: invoice.appointmentId,
        href: canReadBillingInvoices.value
            ? clinicalModuleHref('/billing-invoices', {
                includeAppointment: false,
                focusInvoiceId: invoice.id,
            })
            : null,
        actionLabel: canReadBillingInvoices.value ? 'Open invoice' : null,
        accentClass: 'border-l-rose-500/70',
        icon: 'receipt',
    }));

    return [
        ...appointmentEvents,
        ...recordEvents,
        ...laboratoryEvents,
        ...imagingEvents,
        ...pharmacyEvents,
        ...theatreEvents,
        ...billingEvents,
    ].sort((left, right) => {
        const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
        const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
        return rightTime - leftTime;
    });
});
const timelinePreview = computed(() => timelineEvents.value.slice(0, 4));
const timelineSections = computed(() => {
    const sections = new Map<string, { label: string; events: ChartTimelineEvent[] }>();

    timelineEvents.value.forEach((event) => {
        const key = timelineSectionKey(event.occurredAt);
        const label = timelineSectionLabel(event.occurredAt);
        const existing = sections.get(key);

        if (existing) {
            existing.events.push(event);
            return;
        }

        sections.set(key, { label, events: [event] });
    });

    return Array.from(sections.entries()).map(([key, value]) => ({
        key,
        label: value.label,
        events: value.events,
    }));
});
const latestClinicalSignal = computed(
    () =>
        timelineEvents.value.find((event) =>
            ['consultation', 'laboratory', 'imaging'].includes(event.category),
        ) ?? null,
);
const handoffSummary = computed(() => {
    if (!primaryVisit.value) {
        return {
            title: 'No active encounter',
            summary: 'This patient has no active outpatient visit in chart context right now.',
            meta: 'Use schedule appointment when the next visit is being arranged.',
        };
    }

    switch (primaryVisit.value.status) {
        case 'waiting_triage':
            return {
                title: 'Nurse triage pending',
                summary: primaryVisit.value.triageVitalsSummary || 'The patient is checked in and waiting for nurse triage to be completed.',
                meta: `${primaryVisit.value.department || 'Department pending'} | Scheduled ${formatDateTime(primaryVisit.value.scheduledAt)}`,
            };
        case 'waiting_provider':
            return {
                title: 'Ready for clinician review',
                summary: primaryVisit.value.triageVitalsSummary || primaryVisit.value.reason || 'Triage is complete and the patient is ready for provider handoff.',
                meta: `${primaryVisit.value.department || 'Department pending'} | ${formatEnumLabel(primaryVisit.value.status || 'waiting_provider')}`,
            };
        case 'in_consultation':
            return {
                title: 'Consultation in progress',
                summary: primaryVisit.value.reason || 'An active consultation session is already underway for this visit.',
                meta: `${primaryVisit.value.department || 'Department pending'} | Resume the focused visit workspace from this chart.`,
            };
        default:
            return {
                title: 'Visit scheduled',
                summary: primaryVisit.value.reason || 'The next booked visit is visible in this patient chart.',
                meta: `${primaryVisit.value.department || 'Department pending'} | Scheduled ${formatDateTime(primaryVisit.value.scheduledAt)}`,
            };
    }
});
const nextDocumentedStep = computed(() => {
    if (latestRecord.value) {
        return recordNextStep(latestRecord.value);
    }

    if (primaryVisit.value?.status === 'waiting_triage') {
        return 'Record nurse triage and hand the patient to the provider queue.';
    }

    if (primaryVisit.value?.status === 'waiting_provider') {
        return 'Start consultation from the provider queue when the clinician is ready.';
    }

    if (primaryVisit.value?.status === 'in_consultation') {
        return 'Continue documentation, place orders if needed, then complete the visit.';
    }

    if (primaryVisit.value) {
        return 'Open the visit workspace to continue the patient flow for this appointment.';
    }

    return 'Schedule or launch the next encounter when this patient re-enters care.';
});
const focusedEncounterEvents = computed(() => {
    if (!primaryVisit.value?.id) {
        return [];
    }

    return timelineEvents.value.filter(
        (event) => event.appointmentId === primaryVisit.value?.id,
    );
});
const focusedEncounterCounts = computed(() => ({
    total: focusedEncounterEvents.value.length,
    notes: focusedEncounterEvents.value.filter((event) => event.category === 'consultation').length,
    orders: focusedEncounterEvents.value.filter((event) =>
        ['laboratory', 'imaging', 'pharmacy'].includes(event.category),
    ).length,
    billing: focusedEncounterEvents.value.filter((event) => event.category === 'billing').length,
}));
const focusedEncounterLatestEvent = computed(
    () => focusedEncounterEvents.value[0] ?? null,
);

const careWorkspaceContext = computed(() => {
    if (primaryVisit.value) {
        return {
            title: 'Encounter-linked care actions are active',
            summary:
                (primaryVisit.value.appointmentNumber || 'Current visit') +
                ' | ' +
                (primaryVisit.value.department || 'Department pending') +
                ' | ' +
                formatEnumLabel(primaryVisit.value.status || 'scheduled'),
            meta: 'Lab, imaging, pharmacy, and billing actions from this chart will carry the patient and the focused encounter together.',
        };
    }

    return {
        title: 'Patient-linked care actions are active',
        summary: 'No visit is currently in chart focus, so downstream actions will open with the patient linked but no specific appointment attached.',
        meta: 'Use Encounter focus or the Visits tab when you want orders and invoices attached to one visit.',
    };
});

function clinicalModuleHref(
    path: string,
    options?: {
        includeAppointment?: boolean;
        includeTabNew?: boolean;
        reorderOfId?: string | null;
        addOnToOrderId?: string | null;
        focusOrderId?: string | null;
        focusProcedureId?: string | null;
        focusInvoiceId?: string | null;
    },
): string {
    const params = new URLSearchParams({ patientId: props.patientId, from: 'patient-chart' });
    if (options?.includeTabNew) {
        params.set('tab', 'new');
    }

    if ((options?.includeAppointment ?? true) && primaryVisit.value?.id) {
        params.set('appointmentId', primaryVisit.value.id);
    }

    if (options?.reorderOfId?.trim()) {
        params.set('reorderOfId', options.reorderOfId.trim());
    }

    if (options?.addOnToOrderId?.trim()) {
        params.set('addOnToOrderId', options.addOnToOrderId.trim());
    }

    if (options?.focusOrderId?.trim()) {
        params.set('focusOrderId', options.focusOrderId.trim());
    }

    if (options?.focusProcedureId?.trim()) {
        params.set('focusProcedureId', options.focusProcedureId.trim());
    }

    if (options?.focusInvoiceId?.trim()) {
        params.set('focusInvoiceId', options.focusInvoiceId.trim());
    }

    return `${path}?${params.toString()}`;
}
async function apiRequest<T>(
    path: string,
    query?: Record<string, string | number | null | undefined>,
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(query ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    });

    const payload = (await response.json().catch(() => ({}))) as ValidationErrorResponse;
    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload as T;
}

function csrfToken(): string {
    return (
        document
            .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.getAttribute('content')
            ?.trim() ?? ''
    );
}

async function apiPost<T>(
    path: string,
    body?: Record<string, unknown>,
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
    };
    const token = csrfToken();
    if (token) headers['X-CSRF-TOKEN'] = token;

    const response = await fetch(url.toString(), {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify(body ?? {}),
    });

    const payload = (await response.json().catch(() => ({}))) as ValidationErrorResponse;
    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload as T;
}

async function apiPatch<T>(
    path: string,
    body?: Record<string, unknown>,
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
    };
    const token = csrfToken();
    if (token) headers['X-CSRF-TOKEN'] = token;

    const response = await fetch(url.toString(), {
        method: 'PATCH',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify(body ?? {}),
    });

    const payload = (await response.json().catch(() => ({}))) as ValidationErrorResponse;
    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload as T;
}

async function loadPatient() {
    patientLoading.value = true;
    patientError.value = null;

    try {
        const response = await apiRequest<ApiItemResponse<Patient>>(
            `/patients/${props.patientId}`,
        );
        patient.value = response.data;
    } catch (error) {
        patientError.value = error instanceof Error ? error.message : 'Unable to load patient chart.';
    } finally {
        patientLoading.value = false;
    }
}

async function loadRecords() {
    if (!canReadMedicalRecords.value) return;

    recordsLoading.value = true;
    recordsError.value = null;
    try {
        const response = await apiRequest<ApiListResponse<MedicalRecord>>('/medical-records', {
            patientId: props.patientId,
            sortBy: 'encounterAt',
            sortDir: 'desc',
            perPage: 10,
        });
        records.value = response.data ?? [];
        recordsTotal.value = Number(response.meta?.total ?? response.data?.length ?? 0);
    } catch (error) {
        recordsError.value = error instanceof Error ? error.message : 'Unable to load consultation records.';
    } finally {
        recordsLoading.value = false;
    }
}

async function loadAppointments() {
    if (!canReadAppointments.value) return;

    appointmentsLoading.value = true;
    appointmentsError.value = null;
    try {
        const response = await apiRequest<ApiListResponse<Appointment>>('/appointments', {
            patientId: props.patientId,
            sortBy: 'scheduledAt',
            sortDir: 'desc',
            perPage: 6,
        });
        appointments.value = response.data ?? [];
    } catch (error) {
        appointmentsError.value = error instanceof Error ? error.message : 'Unable to load visit context.';
    } finally {
        appointmentsLoading.value = false;
    }
}

async function loadLaboratoryOrders() {
    if (!canReadLaboratoryOrders.value) {
        laboratoryOrders.value = [];
        laboratoryOrderCounts.value = null;
        laboratoryOrdersError.value = null;
        return;
    }

    laboratoryOrdersLoading.value = true;
    laboratoryOrdersError.value = null;
    try {
        const [listResponse, countsResponse] = await Promise.all([
            apiRequest<ApiListResponse<LaboratoryOrder>>('/laboratory-orders', {
                patientId: props.patientId,
                sortBy: 'orderedAt',
                sortDir: 'desc',
                perPage: 25,
            }),
            apiRequest<LaboratoryOrderStatusCountsResponse>('/laboratory-orders/status-counts', {
                patientId: props.patientId,
            }),
        ]);
        laboratoryOrders.value = listResponse.data ?? [];
        laboratoryOrderCounts.value = countsResponse.data;
    } catch (error) {
        laboratoryOrders.value = [];
        laboratoryOrderCounts.value = null;
        laboratoryOrdersError.value =
            error instanceof Error ? error.message : 'Unable to load laboratory orders.';
    } finally {
        laboratoryOrdersLoading.value = false;
    }
}

async function loadPharmacyOrders() {
    if (!canReadPharmacyOrders.value) {
        pharmacyOrders.value = [];
        pharmacyOrderCounts.value = null;
        pharmacyOrdersError.value = null;
        return;
    }

    pharmacyOrdersLoading.value = true;
    pharmacyOrdersError.value = null;
    try {
        const [listResponse, countsResponse] = await Promise.all([
            apiRequest<ApiListResponse<PharmacyOrder>>('/pharmacy-orders', {
                patientId: props.patientId,
                sortBy: 'orderedAt',
                sortDir: 'desc',
                perPage: 25,
            }),
            apiRequest<PharmacyOrderStatusCountsResponse>('/pharmacy-orders/status-counts', {
                patientId: props.patientId,
            }),
        ]);
        pharmacyOrders.value = listResponse.data ?? [];
        pharmacyOrderCounts.value = countsResponse.data;
    } catch (error) {
        pharmacyOrders.value = [];
        pharmacyOrderCounts.value = null;
        pharmacyOrdersError.value =
            error instanceof Error ? error.message : 'Unable to load pharmacy orders.';
    } finally {
        pharmacyOrdersLoading.value = false;
    }
}

async function loadRadiologyOrders() {
    if (!canReadRadiologyOrders.value) {
        radiologyOrders.value = [];
        radiologyOrderCounts.value = null;
        radiologyOrdersError.value = null;
        return;
    }

    radiologyOrdersLoading.value = true;
    radiologyOrdersError.value = null;
    try {
        const [listResponse, countsResponse] = await Promise.all([
            apiRequest<ApiListResponse<RadiologyOrder>>('/radiology-orders', {
                patientId: props.patientId,
                sortBy: 'orderedAt',
                sortDir: 'desc',
                perPage: 25,
            }),
            apiRequest<RadiologyOrderStatusCountsResponse>('/radiology-orders/status-counts', {
                patientId: props.patientId,
            }),
        ]);
        radiologyOrders.value = listResponse.data ?? [];
        radiologyOrderCounts.value = countsResponse.data;
    } catch (error) {
        radiologyOrders.value = [];
        radiologyOrderCounts.value = null;
        radiologyOrdersError.value =
            error instanceof Error ? error.message : 'Unable to load imaging orders.';
    } finally {
        radiologyOrdersLoading.value = false;
    }
}

async function loadTheatreProcedures() {
    if (!canReadTheatreProcedures.value) {
        theatreProcedures.value = [];
        theatreProcedureCounts.value = null;
        theatreProceduresError.value = null;
        return;
    }

    theatreProceduresLoading.value = true;
    theatreProceduresError.value = null;
    try {
        const [listResponse, countsResponse] = await Promise.all([
            apiRequest<ApiListResponse<TheatreProcedure>>('/theatre-procedures', {
                patientId: props.patientId,
                sortBy: 'scheduledAt',
                sortDir: 'desc',
                perPage: 25,
            }),
            apiRequest<TheatreProcedureStatusCountsResponse>('/theatre-procedures/status-counts', {
                patientId: props.patientId,
            }),
        ]);
        theatreProcedures.value = listResponse.data ?? [];
        theatreProcedureCounts.value = countsResponse.data;
    } catch (error) {
        theatreProcedures.value = [];
        theatreProcedureCounts.value = null;
        theatreProceduresError.value =
            error instanceof Error ? error.message : 'Unable to load theatre procedures.';
    } finally {
        theatreProceduresLoading.value = false;
    }
}

async function loadBillingInvoices() {
    if (!canReadBillingInvoices.value) {
        billingInvoices.value = [];
        billingInvoiceCounts.value = null;
        billingInvoicesError.value = null;
        return;
    }

    billingInvoicesLoading.value = true;
    billingInvoicesError.value = null;
    try {
        const [listResponse, countsResponse] = await Promise.all([
            apiRequest<ApiListResponse<BillingInvoice>>('/billing-invoices', {
                patientId: props.patientId,
                sortBy: 'invoiceDate',
                sortDir: 'desc',
                perPage: 3,
            }),
            apiRequest<BillingInvoiceStatusCountsResponse>('/billing-invoices/status-counts', {
                patientId: props.patientId,
            }),
        ]);
        billingInvoices.value = listResponse.data ?? [];
        billingInvoiceCounts.value = countsResponse.data;
    } catch (error) {
        billingInvoices.value = [];
        billingInvoiceCounts.value = null;
        billingInvoicesError.value =
            error instanceof Error ? error.message : 'Unable to load billing invoices.';
    } finally {
        billingInvoicesLoading.value = false;
    }
}

async function loadPatientAllergies() {
    patientAllergiesLoading.value = true;
    patientAllergiesError.value = null;

    try {
        const response = await apiRequest<ApiListResponse<PatientAllergy>>(
            `/patients/${props.patientId}/allergies`,
            { status: 'active', perPage: 50 },
        );
        patientAllergies.value = response.data ?? [];
    } catch (error) {
        patientAllergiesError.value =
            error instanceof Error ? error.message : 'Unable to load patient allergies.';
    } finally {
        patientAllergiesLoading.value = false;
    }
}

async function loadPatientMedicationProfile() {
    patientMedicationProfileLoading.value = true;
    patientMedicationProfileError.value = null;

    try {
        const response = await apiRequest<ApiListResponse<PatientMedicationProfile>>(
            `/patients/${props.patientId}/medication-profile`,
            { perPage: 50 },
        );
        patientMedicationProfile.value = response.data ?? [];
    } catch (error) {
        patientMedicationProfileError.value =
            error instanceof Error ? error.message : 'Unable to load current medication list.';
    } finally {
        patientMedicationProfileLoading.value = false;
    }
}

async function loadPatientMedicationReconciliation() {
    patientMedicationReconciliationLoading.value = true;
    patientMedicationReconciliationError.value = null;

    try {
        const response = await apiRequest<PatientMedicationReconciliationResponse>(
            `/patients/${props.patientId}/medication-reconciliation`,
        );
        patientMedicationReconciliation.value = response.data;
    } catch (error) {
        patientMedicationReconciliationError.value =
            error instanceof Error ? error.message : 'Unable to load medication reconciliation workspace.';
    } finally {
        patientMedicationReconciliationLoading.value = false;
    }
}

async function reloadMedicationWorkspace(): Promise<void> {
    await Promise.all([
        loadPatientAllergies(),
        loadPatientMedicationProfile(),
        loadPatientMedicationReconciliation(),
        loadPharmacyOrders(),
    ]);
}

function validationErrorsFromError(error: unknown): Record<string, string[]> {
    if (
        typeof error === 'object'
        && error !== null
        && 'payload' in error
        && typeof (error as { payload?: ValidationErrorResponse }).payload === 'object'
        && (error as { payload?: ValidationErrorResponse }).payload !== null
    ) {
        return (error as { payload?: ValidationErrorResponse }).payload?.errors ?? {};
    }

    return {};
}

function resetAllergyForm(): void {
    editingAllergyId.value = '';
    allergyDialogError.value = null;
    allergyFormErrors.value = {};
    allergyForm.substanceCode = '';
    allergyForm.substanceName = '';
    allergyForm.reaction = '';
    allergyForm.severity = 'unknown';
    allergyForm.status = 'active';
    allergyForm.notedAt = '';
    allergyForm.lastReactionAt = '';
    allergyForm.notes = '';
}

function openAllergyDialog(allergy?: PatientAllergy | null): void {
    resetAllergyForm();

    if (allergy) {
        editingAllergyId.value = allergy.id;
        allergyForm.substanceCode = allergy.substanceCode ?? '';
        allergyForm.substanceName = allergy.substanceName ?? '';
        allergyForm.reaction = allergy.reaction ?? '';
        allergyForm.severity = allergy.severity ?? 'unknown';
        allergyForm.status = allergy.status ?? 'active';
        allergyForm.notedAt = allergy.notedAt ? String(allergy.notedAt).slice(0, 10) : '';
        allergyForm.lastReactionAt = allergy.lastReactionAt ?? '';
        allergyForm.notes = allergy.notes ?? '';
    }

    allergyDialogOpen.value = true;
}

function closeAllergyDialog(): void {
    allergyDialogOpen.value = false;
    resetAllergyForm();
}

async function submitAllergyDialog(): Promise<void> {
    allergyDialogSubmitting.value = true;
    allergyDialogError.value = null;
    allergyFormErrors.value = {};

    const payload = {
        substanceCode: allergyForm.substanceCode.trim() || null,
        substanceName: allergyForm.substanceName.trim(),
        reaction: allergyForm.reaction.trim() || null,
        severity: allergyForm.severity,
        status: allergyForm.status,
        notedAt: allergyForm.notedAt || null,
        lastReactionAt: allergyForm.lastReactionAt || null,
        notes: allergyForm.notes.trim() || null,
    };

    try {
        if (editingAllergyId.value) {
            await apiPatch<ApiItemResponse<PatientAllergy>>(
                `/patients/${props.patientId}/allergies/${editingAllergyId.value}`,
                payload,
            );
            notifySuccess('Patient allergy updated.');
        } else {
            await apiPost<ApiItemResponse<PatientAllergy>>(
                `/patients/${props.patientId}/allergies`,
                payload,
            );
            notifySuccess('Patient allergy recorded.');
        }

        closeAllergyDialog();
        await reloadMedicationWorkspace();
    } catch (error) {
        allergyFormErrors.value = validationErrorsFromError(error);
        allergyDialogError.value =
            error instanceof Error ? error.message : 'Unable to save patient allergy.';
        notifyError(allergyDialogError.value);
    } finally {
        allergyDialogSubmitting.value = false;
    }
}

function resetMedicationProfileForm(): void {
    editingMedicationProfileId.value = '';
    medicationProfileDialogError.value = null;
    medicationProfileFormErrors.value = {};
    medicationProfileForm.medicationCode = '';
    medicationProfileForm.medicationName = '';
    medicationProfileForm.dose = '';
    medicationProfileForm.route = '';
    medicationProfileForm.frequency = '';
    medicationProfileForm.source = 'home_medication';
    medicationProfileForm.status = 'active';
    medicationProfileForm.startedAt = '';
    medicationProfileForm.stoppedAt = '';
    medicationProfileForm.indication = '';
    medicationProfileForm.notes = '';
    medicationProfileForm.lastReconciledAt = '';
    medicationProfileForm.reconciliationNote = '';
}

function todayDateValue(): string {
    return new Date().toISOString().slice(0, 10);
}

function normalizedMedicationText(value: string | null | undefined): string {
    return String(value ?? '').trim().toLowerCase();
}

function appendReconciliationNote(
    existing: string | null | undefined,
    addition: string,
): string {
    const baseline = String(existing ?? '').trim();
    if (baseline === '') {
        return addition;
    }

    return baseline.includes(addition) ? baseline : `${baseline}\n${addition}`;
}

function isMedicationWorkspaceActionLoading(key: string): boolean {
    return medicationWorkspaceActionKey.value === key;
}

function scrollToMedicationWorkspaceSection(section: MedicationWorkspaceSection): void {
    if (typeof document === 'undefined') return;

    document
        .getElementById(medicationWorkspaceSectionIds[section])
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function matchingMedicationProfileForOrder(
    order: PharmacyOrder,
): PatientMedicationProfile | null {
    const medicationCode = normalizedMedicationText(order.medicationCode);
    const medicationName = normalizedMedicationText(order.medicationName);

    return (
        patientMedicationProfile.value.find((profile) => {
            const profileCode = normalizedMedicationText(profile.medicationCode);
            const profileName = normalizedMedicationText(profile.medicationName);

            if (medicationCode !== '' && profileCode !== '') {
                return medicationCode === profileCode;
            }

            return medicationName !== '' && profileName !== '' && medicationName === profileName;
        }) ?? null
    );
}

function openMedicationProfileDialogFromOrder(
    order: PharmacyOrder,
    mode: 'continue' | 'add',
): void {
    const matchingProfile = matchingMedicationProfileForOrder(order);
    const today = todayDateValue();
    const orderLabel = order.orderNumber || `order ${shortId(order.id)}`;
    const reconciliationText =
        mode === 'continue'
            ? `Therapy reviewed from ${orderLabel} in the medication reconciliation workspace.`
            : `Current medication list updated from dispensed ${orderLabel} in the medication reconciliation workspace.`;

    if (matchingProfile) {
        openMedicationProfileDialog(matchingProfile);
        medicationProfileForm.lastReconciledAt =
            medicationProfileForm.lastReconciledAt || today;
        medicationProfileForm.reconciliationNote = appendReconciliationNote(
            medicationProfileForm.reconciliationNote,
            reconciliationText,
        );
        medicationProfileForm.notes = appendReconciliationNote(
            medicationProfileForm.notes,
            `Linked pharmacy order: ${orderLabel}.`,
        );
        return;
    }

    openMedicationProfileDialog();
    medicationProfileForm.medicationCode = order.medicationCode ?? '';
    medicationProfileForm.medicationName = order.medicationName ?? '';
    medicationProfileForm.dose = order.dosageInstruction ?? '';
    medicationProfileForm.source = 'manual_entry';
    medicationProfileForm.status = 'active';
    medicationProfileForm.startedAt = today;
    medicationProfileForm.lastReconciledAt = today;
    medicationProfileForm.reconciliationNote = reconciliationText;
    medicationProfileForm.notes = `Linked pharmacy order: ${orderLabel}.`;
}

function openMedicationProfileDialog(profile?: PatientMedicationProfile | null): void {
    resetMedicationProfileForm();

    if (profile) {
        editingMedicationProfileId.value = profile.id;
        medicationProfileForm.medicationCode = profile.medicationCode ?? '';
        medicationProfileForm.medicationName = profile.medicationName ?? '';
        medicationProfileForm.dose = profile.dose ?? '';
        medicationProfileForm.route = profile.route ?? '';
        medicationProfileForm.frequency = profile.frequency ?? '';
        medicationProfileForm.source = profile.source ?? 'home_medication';
        medicationProfileForm.status = profile.status ?? 'active';
        medicationProfileForm.startedAt = profile.startedAt ? String(profile.startedAt).slice(0, 10) : '';
        medicationProfileForm.stoppedAt = profile.stoppedAt ? String(profile.stoppedAt).slice(0, 10) : '';
        medicationProfileForm.indication = profile.indication ?? '';
        medicationProfileForm.notes = profile.notes ?? '';
        medicationProfileForm.lastReconciledAt = profile.lastReconciledAt ? String(profile.lastReconciledAt).slice(0, 10) : '';
        medicationProfileForm.reconciliationNote = profile.reconciliationNote ?? '';
    }

    medicationProfileDialogOpen.value = true;
}

function closeMedicationProfileDialog(): void {
    medicationProfileDialogOpen.value = false;
    resetMedicationProfileForm();
}

async function submitMedicationProfileDialog(): Promise<void> {
    medicationProfileDialogSubmitting.value = true;
    medicationProfileDialogError.value = null;
    medicationProfileFormErrors.value = {};

    const payload = {
        medicationCode: medicationProfileForm.medicationCode.trim() || null,
        medicationName: medicationProfileForm.medicationName.trim(),
        dose: medicationProfileForm.dose.trim() || null,
        route: medicationProfileForm.route.trim() || null,
        frequency: medicationProfileForm.frequency.trim() || null,
        source: medicationProfileForm.source,
        status: medicationProfileForm.status,
        startedAt: medicationProfileForm.startedAt || null,
        stoppedAt: medicationProfileForm.stoppedAt || null,
        indication: medicationProfileForm.indication.trim() || null,
        notes: medicationProfileForm.notes.trim() || null,
        lastReconciledAt: medicationProfileForm.lastReconciledAt || null,
        reconciliationNote: medicationProfileForm.reconciliationNote.trim() || null,
    };

    try {
        if (editingMedicationProfileId.value) {
            await apiPatch<ApiItemResponse<PatientMedicationProfile>>(
                `/patients/${props.patientId}/medication-profile/${editingMedicationProfileId.value}`,
                payload,
            );
            notifySuccess('Current medication entry updated.');
        } else {
            await apiPost<ApiItemResponse<PatientMedicationProfile>>(
                `/patients/${props.patientId}/medication-profile`,
                payload,
            );
            notifySuccess('Current medication entry recorded.');
        }

        closeMedicationProfileDialog();
        await reloadMedicationWorkspace();
    } catch (error) {
        medicationProfileFormErrors.value = validationErrorsFromError(error);
        medicationProfileDialogError.value =
            error instanceof Error ? error.message : 'Unable to save current medication entry.';
        notifyError(medicationProfileDialogError.value);
    } finally {
        medicationProfileDialogSubmitting.value = false;
    }
}

async function quickReconcileMedicationProfile(
    profile: PatientMedicationProfile,
): Promise<void> {
    const actionKey = `profile-review:${profile.id}`;
    medicationWorkspaceActionKey.value = actionKey;

    try {
        await apiPatch<ApiItemResponse<PatientMedicationProfile>>(
            `/patients/${props.patientId}/medication-profile/${profile.id}`,
            {
                lastReconciledAt: todayDateValue(),
                reconciliationNote: appendReconciliationNote(
                    profile.reconciliationNote,
                    'Reviewed from the patient chart medication reconciliation workspace.',
                ),
            },
        );
        notifySuccess('Current medication review recorded.');
        await reloadMedicationWorkspace();
    } catch (error) {
        notifyError(
            error instanceof Error
                ? error.message
                : 'Unable to record current medication review.',
        );
    } finally {
        medicationWorkspaceActionKey.value = '';
    }
}
function patientName(target: Patient | null): string {
    if (!target) return '';
    return [target.firstName, target.middleName, target.lastName].filter(Boolean).join(' ').trim() || target.patientNumber || target.id;
}

function formatDate(value: string | null | undefined): string {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function shortId(value: string | null | undefined): string {
    const normalized = String(value ?? '').trim();
    if (normalized === '') return 'N/A';
    return normalized.length > 10 ? `${normalized.slice(0, 8)}...` : normalized;
}

function lifecycleLinkageText(
    entry: { replacesOrderId?: string | null; addOnToOrderId?: string | null },
    label: string,
): string | null {
    const replacesOrderId = String(entry.replacesOrderId ?? '').trim();
    if (replacesOrderId !== '') {
        return `Replacement for ${label} ${shortId(replacesOrderId)}.`;
    }

    const addOnToOrderId = String(entry.addOnToOrderId ?? '').trim();
    if (addOnToOrderId !== '') {
        return `Linked follow-up to ${label} ${shortId(addOnToOrderId)}.`;
    }

    return null;
}

function isEncounterOrderEnteredInError(
    entry: { enteredInErrorAt?: string | null; lifecycleReasonCode?: string | null } | null,
): boolean {
    if (!entry) return false;

    return Boolean(
        String(entry.enteredInErrorAt ?? '').trim()
        || String(entry.lifecycleReasonCode ?? '').trim().toLowerCase() === 'entered_in_error',
    );
}

function canApplyLaboratoryEncounterLifecycleAction(
    order: LaboratoryOrder | null,
    action: 'cancel' | 'entered_in_error',
): boolean {
    if (!order || !canCreateLaboratoryOrders.value || isEncounterOrderEnteredInError(order)) {
        return false;
    }

    if (action === 'cancel') {
        return order.status !== 'cancelled' && order.status !== 'completed';
    }

    return true;
}

function canCreateLaboratoryEncounterFollowOnOrder(
    order: LaboratoryOrder | null,
): boolean {
    return Boolean(
        order
        && canCreateLaboratoryOrders.value
        && order.patientId?.trim()
        && !isEncounterOrderEnteredInError(order),
    );
}

function hasLaboratoryEncounterMoreActions(order: LaboratoryOrder | null): boolean {
    return canApplyLaboratoryEncounterLifecycleAction(order, 'cancel')
        || canApplyLaboratoryEncounterLifecycleAction(order, 'entered_in_error');
}

type CurrentCareLaneKind = 'laboratory' | 'pharmacy' | 'radiology' | 'theatre';

function currentCareNextAction(
    kind: CurrentCareLaneKind,
    item: LaboratoryOrder | PharmacyOrder | RadiologyOrder | TheatreProcedure | null,
): CurrentCareNextAction | null {
    const nextAction = item?.currentCare?.nextAction;
    if (nextAction?.label?.trim()) {
        return nextAction;
    }

    if (!item) return null;

    if (kind === 'laboratory') {
        return {
            key: 'review_order',
            label: (item as LaboratoryOrder).resultedAt ? 'Review result' : 'Review order',
            emphasis: 'secondary',
        };
    }

    if (kind === 'radiology') {
        return {
            key: 'review_order',
            label: (item as RadiologyOrder).completedAt ? 'Review report' : 'Review order',
            emphasis: 'secondary',
        };
    }

    if (kind === 'pharmacy') {
        return {
            key: 'open_order',
            label: 'Open order',
            emphasis: 'secondary',
        };
    }

    return {
        key: 'review_case',
        label: 'Review case',
        emphasis: 'secondary',
    };
}

function currentCareNextActionHref(
    kind: CurrentCareLaneKind,
    item: LaboratoryOrder | PharmacyOrder | RadiologyOrder | TheatreProcedure,
): string {
    const href = kind === 'theatre'
        ? clinicalModuleHref('/theatre-procedures', {
            includeAppointment: false,
            focusProcedureId: item.id,
        })
        : clinicalModuleHref(
            kind === 'laboratory'
                ? '/laboratory-orders'
                : kind === 'radiology'
                  ? '/radiology-orders'
                  : '/pharmacy-orders',
            {
                includeAppointment: false,
                focusOrderId: item.id,
            },
        );

    const actionKey = String(item.currentCare?.nextAction?.key ?? '').trim();
    if (actionKey === '' || actionKey === 'open_order') {
        return href;
    }

    const url = new URL(href, window.location.origin);
    url.searchParams.set('focusWorkflowActionKey', actionKey);

    return `${url.pathname}${url.search}${url.hash}`;
}

function serviceTimelineActionLabel(
    kind: CurrentCareLaneKind,
    item: LaboratoryOrder | PharmacyOrder | RadiologyOrder | TheatreProcedure,
): string {
    const nextAction = currentCareNextAction(kind, item);
    if (nextAction?.label) {
        return nextAction.label;
    }

    const status = String(item.status ?? '').toLowerCase();
    if (kind === 'laboratory') {
        return status === 'completed' ? 'Open result' : 'Open lab order';
    }
    if (kind === 'radiology') {
        return status === 'completed' ? 'Open report' : 'Open imaging order';
    }
    if (kind === 'pharmacy') {
        return status === 'dispensed' ? 'Open dispense' : 'Open pharmacy order';
    }

    return status === 'completed' ? 'Open case' : 'Open procedure';
}

function currentCareNextActionIcon(kind: CurrentCareLaneKind): string {
    if (kind === 'laboratory') return 'flask-conical';
    if (kind === 'radiology') return 'scan-line';
    if (kind === 'pharmacy') return 'pill';
    return 'scissors';
}

function currentCareNextActionVariant(
    action: CurrentCareNextAction | null,
): 'default' | 'outline' {
    return action?.emphasis === 'secondary' ? 'outline' : 'default';
}

function currentCareWorkflowHint(
    item: LaboratoryOrder | PharmacyOrder | RadiologyOrder | TheatreProcedure | null,
): string | null {
    const hint = String(item?.currentCare?.workflowHint ?? '').trim();
    return hint === '' ? null : hint;
}

function canApplyPharmacyEncounterLifecycleAction(
    order: PharmacyOrder | null,
    action: 'cancel' | 'discontinue' | 'entered_in_error',
): boolean {
    if (!order || !canCreatePharmacyOrders.value || isEncounterOrderEnteredInError(order)) {
        return false;
    }

    const quantityDispensed = Number(order.quantityDispensed ?? 0);
    if (action === 'cancel') {
        return order.status !== 'cancelled' && order.status !== 'dispensed' && quantityDispensed <= 0;
    }

    if (action === 'discontinue') {
        return order.status !== 'cancelled' && order.status !== 'dispensed';
    }

    return true;
}

function canCreatePharmacyEncounterFollowOnOrder(
    order: PharmacyOrder | null,
): boolean {
    return Boolean(
        order
        && canCreatePharmacyOrders.value
        && order.patientId?.trim()
        && !isEncounterOrderEnteredInError(order),
    );
}

function hasPharmacyEncounterMoreActions(order: PharmacyOrder | null): boolean {
    return canApplyPharmacyEncounterLifecycleAction(order, 'cancel')
        || canApplyPharmacyEncounterLifecycleAction(order, 'discontinue')
        || canApplyPharmacyEncounterLifecycleAction(order, 'entered_in_error');
}

function canApplyRadiologyEncounterLifecycleAction(
    order: RadiologyOrder | null,
    action: 'cancel' | 'entered_in_error',
): boolean {
    if (!order || !canCreateRadiologyOrders.value || isEncounterOrderEnteredInError(order)) {
        return false;
    }

    if (action === 'cancel') {
        return order.status !== 'cancelled' && order.status !== 'completed';
    }

    return true;
}

function canCreateRadiologyEncounterFollowOnOrder(
    order: RadiologyOrder | null,
): boolean {
    return Boolean(
        order
        && canCreateRadiologyOrders.value
        && order.patientId?.trim()
        && !isEncounterOrderEnteredInError(order),
    );
}

function hasRadiologyEncounterMoreActions(order: RadiologyOrder | null): boolean {
    return canApplyRadiologyEncounterLifecycleAction(order, 'cancel')
        || canApplyRadiologyEncounterLifecycleAction(order, 'entered_in_error');
}

function canApplyTheatreEncounterLifecycleAction(
    procedure: TheatreProcedure | null,
    action: 'cancel' | 'entered_in_error',
): boolean {
    if (!procedure || !canCreateTheatreProcedures.value || isEncounterOrderEnteredInError(procedure)) {
        return false;
    }

    if (action === 'cancel') {
        return procedure.status !== 'cancelled' && procedure.status !== 'completed';
    }

    return true;
}

function canCreateTheatreEncounterFollowOnOrder(
    procedure: TheatreProcedure | null,
): boolean {
    return Boolean(
        procedure
        && canCreateTheatreProcedures.value
        && procedure.patientId?.trim()
        && !isEncounterOrderEnteredInError(procedure),
    );
}

function hasTheatreEncounterMoreActions(procedure: TheatreProcedure | null): boolean {
    return canApplyTheatreEncounterLifecycleAction(procedure, 'cancel')
        || canApplyTheatreEncounterLifecycleAction(procedure, 'entered_in_error');
}

function encounterLifecycleActionLabel(action: EncounterLifecycleAction | null): string {
    if (action === 'cancel') return 'Cancel';
    if (action === 'discontinue') return 'Discontinue';
    if (action === 'entered_in_error') return 'Mark entered in error';
    return 'Apply';
}

function encounterLifecycleActionSuccessMessage(action: EncounterLifecycleAction | null): string {
    if (action === 'cancel') return 'Order cancelled.';
    if (action === 'discontinue') return 'Order discontinued.';
    if (action === 'entered_in_error') return 'Order marked entered in error.';
    return 'Lifecycle action applied.';
}

function encounterLifecycleActionPath(
    kind: EncounterLifecycleTargetKind,
    id: string,
): string {
    if (kind === 'laboratory') return `/laboratory-orders/${id}/lifecycle`;
    if (kind === 'pharmacy') return `/pharmacy-orders/${id}/lifecycle`;
    if (kind === 'radiology') return `/radiology-orders/${id}/lifecycle`;
    return `/theatre-procedures/${id}/lifecycle`;
}

function openEncounterLifecycleDialog(
    kind: EncounterLifecycleTargetKind,
    id: string,
    action: EncounterLifecycleAction,
    defaultReason?: string | null,
): void {
    encounterLifecycleTargetKind.value = kind;
    encounterLifecycleTargetId.value = id;
    encounterLifecycleAction.value = action;
    encounterLifecycleReason.value = String(defaultReason ?? '').trim();
    encounterLifecycleError.value = null;
    encounterLifecycleDialogOpen.value = true;
}

function closeEncounterLifecycleDialog(): void {
    encounterLifecycleDialogOpen.value = false;
    encounterLifecycleTargetKind.value = null;
    encounterLifecycleTargetId.value = '';
    encounterLifecycleAction.value = null;
    encounterLifecycleReason.value = '';
    encounterLifecycleError.value = null;
}

function replaceEncounterOrderInCollections(
    kind: EncounterLifecycleTargetKind,
    updated: LaboratoryOrder | PharmacyOrder | RadiologyOrder | TheatreProcedure,
): void {
    if (kind === 'laboratory') {
        laboratoryOrders.value = laboratoryOrders.value.map((order) =>
            order.id === updated.id ? (updated as LaboratoryOrder) : order,
        );
        return;
    }

    if (kind === 'pharmacy') {
        pharmacyOrders.value = pharmacyOrders.value.map((order) =>
            order.id === updated.id ? (updated as PharmacyOrder) : order,
        );
        return;
    }

    if (kind === 'radiology') {
        radiologyOrders.value = radiologyOrders.value.map((order) =>
            order.id === updated.id ? (updated as RadiologyOrder) : order,
        );
        return;
    }

    theatreProcedures.value = theatreProcedures.value.map((procedure) =>
        procedure.id === updated.id ? (updated as TheatreProcedure) : procedure,
    );
}

function encounterLifecycleTargetName(): string {
    if (!encounterLifecycleTargetKind.value || !encounterLifecycleTargetId.value) {
        return 'this order';
    }

    if (encounterLifecycleTargetKind.value === 'laboratory') {
        const target = laboratoryOrders.value.find((order) => order.id === encounterLifecycleTargetId.value);
        return target?.testName?.trim() || target?.orderNumber?.trim() || 'this laboratory order';
    }

    if (encounterLifecycleTargetKind.value === 'pharmacy') {
        const target = pharmacyOrders.value.find((order) => order.id === encounterLifecycleTargetId.value);
        return target?.medicationName?.trim() || target?.orderNumber?.trim() || 'this medication order';
    }

    if (encounterLifecycleTargetKind.value === 'radiology') {
        const target = radiologyOrders.value.find((order) => order.id === encounterLifecycleTargetId.value);
        return target?.studyDescription?.trim() || target?.orderNumber?.trim() || 'this imaging order';
    }

    const target = theatreProcedures.value.find((procedure) => procedure.id === encounterLifecycleTargetId.value);
    return (
        target?.procedureName?.trim()
        || target?.procedureType?.trim()
        || target?.procedureNumber?.trim()
        || 'this procedure booking'
    );
}

async function submitEncounterLifecycleDialog(): Promise<void> {
    if (
        !encounterLifecycleTargetKind.value
        || !encounterLifecycleTargetId.value
        || !encounterLifecycleAction.value
    ) {
        return;
    }

    const reason = encounterLifecycleReason.value.trim();
    if (!reason) {
        encounterLifecycleError.value = 'Clinical reason is required.';
        return;
    }

    encounterLifecycleSubmitting.value = true;
    encounterLifecycleError.value = null;

    try {
        const response = await apiPost<{
            data: LaboratoryOrder | PharmacyOrder | RadiologyOrder | TheatreProcedure;
        }>(
            encounterLifecycleActionPath(
                encounterLifecycleTargetKind.value,
                encounterLifecycleTargetId.value,
            ),
            {
                action: encounterLifecycleAction.value,
                reason,
            },
        );

        replaceEncounterOrderInCollections(
            encounterLifecycleTargetKind.value,
            response.data,
        );
        notifySuccess(encounterLifecycleActionSuccessMessage(encounterLifecycleAction.value));
        closeEncounterLifecycleDialog();
    } catch (error) {
        encounterLifecycleError.value = messageFromUnknown(
            error,
            'Unable to apply lifecycle action.',
        );
        notifyError(encounterLifecycleError.value);
    } finally {
        encounterLifecycleSubmitting.value = false;
    }
}

function timelineSectionKey(value: string | null | undefined): string {
    if (!value) return 'undated';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'undated';
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function timelineSectionLabel(value: string | null | undefined): string {
    if (!value) return 'Undated';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Undated';

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

    if (current === startOfToday) return 'Today';
    if (current === startOfYesterday) return 'Yesterday';
    return formatDate(value);
}

function formatMoney(value: string | number | null | undefined, currencyCode?: string | null): string {
    if (value === null || value === undefined || value === '') return 'Amount not recorded';
    const amount = Number(value);
    if (!Number.isFinite(amount)) return String(value);
    const currency = currencyCode?.trim().toUpperCase() || 'TZS';
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${currency} ${amount.toLocaleString()}`;
    }
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

function plainTextFromHtml(value: string | null | undefined): string {
    if (!value) return '';

    return value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p>/gi, '\n\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+\n/g, '\n')
        .replace(/\n\s+/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function truncatePlainText(value: string | null | undefined, max = 160): string {
    const plain = plainTextFromHtml(value);
    if (!plain) return '';
    if (plain.length <= max) return plain;
    return `${plain.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function recordProblem(record: MedicalRecord): string {
    return truncatePlainText(record.assessment, 160) || 'No problem focus recorded.';
}

function recordNextStep(record: MedicalRecord): string {
    return truncatePlainText(record.plan, 160) || 'No follow-up plan recorded.';
}

function recordRegistryHref(record: MedicalRecord): string {
    const params = new URLSearchParams({ patientId: props.patientId, recordId: record.id });
    if (record.appointmentId) params.set('appointmentId', record.appointmentId);
    if (record.admissionId) params.set('admissionId', record.admissionId);
    return `/medical-records?${params.toString()}`;
}


function appointmentWorkspaceHref(appointment: Appointment): string {
    const params = new URLSearchParams({
        focusAppointmentId: appointment.id,
    });
    const normalizedStatus = String(appointment.status ?? '').trim();
    if (
        normalizedStatus === 'scheduled'
        || normalizedStatus === 'waiting_triage'
        || normalizedStatus === 'waiting_provider'
        || normalizedStatus === 'in_consultation'
        || normalizedStatus === 'completed'
    ) {
        params.set('status', normalizedStatus);
    }
    return `/appointments?${params.toString()}`;
}

function appointmentDetailsHref(appointment: Appointment): string {
    return appointmentWorkspaceHref(appointment);
}

function consultationHrefForAppointment(appointment: Appointment | null): string {
    if (appointment) {
        return appointmentWorkspaceHref(appointment);
    }

    return `/appointments?patientId=${encodeURIComponent(props.patientId)}&from=patient-chart`;
}

function appointmentStatusVariant(status: string | null | undefined): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'in_consultation':
            return 'default';
        case 'waiting_provider':
            return 'secondary';
        case 'cancelled':
        case 'no_show':
            return 'destructive';
        default:
            return 'outline';
    }
}

function workflowStatusVariant(status: string | null | undefined): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch ((status ?? '').toLowerCase()) {
        case 'active':
        case 'completed':
        case 'dispensed':
        case 'paid':
        case 'finalized':
            return 'default';
        case 'ordered':
        case 'collected':
        case 'planned':
        case 'in_preop':
        case 'in_progress':
        case 'scheduled':
        case 'pending':
        case 'in_preparation':
        case 'partially_dispensed':
        case 'issued':
        case 'partially_paid':
            return 'secondary';
        case 'cancelled':
        case 'voided':
        case 'no_show':
        case 'entered_in_error':
            return 'destructive';
        default:
            return 'outline';
    }
}

type ClinicalSignalDescriptor = {
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    surfaceClass: string;
};

function extractLaboratoryResultFlag(resultSummary: string | null): 'critical' | 'abnormal' | 'inconclusive' | 'normal' | null {
    const normalized = (resultSummary ?? '').trim().toLowerCase();
    if (normalized === '') {
        return null;
    }

    const match = normalized.match(/result flag:\s*([a-z _-]+)/i);
    const token = match?.[1]?.trim().replace(/\s+/g, '_') ?? '';

    if (token.includes('critical')) return 'critical';
    if (token.includes('abnormal')) return 'abnormal';
    if (token.includes('inconclusive')) return 'inconclusive';
    if (token.includes('normal')) return 'normal';

    return null;
}

function laboratoryClinicalSignal(order: LaboratoryOrder): ClinicalSignalDescriptor {
    const status = (order.status ?? '').trim().toLowerCase();
    const resultFlag = extractLaboratoryResultFlag(order.resultSummary);

    if (status === 'completed') {
        if (resultFlag === 'critical') {
            return {
                label: 'Critical result',
                variant: 'destructive',
                surfaceClass: 'border-destructive/30 bg-destructive/5',
            };
        }

        if (resultFlag === 'abnormal' || resultFlag === 'inconclusive') {
            return {
                label: resultFlag === 'inconclusive' ? 'Inconclusive result' : 'Abnormal result',
                variant: 'secondary',
                surfaceClass: 'border-amber-500/30 bg-amber-500/5',
            };
        }

        return {
            label: 'Result complete',
            variant: 'default',
            surfaceClass: 'border-emerald-500/25 bg-emerald-500/5',
        };
    }

    if (status === 'ordered' || status === 'collected' || status === 'in_progress') {
        return {
            label: 'Pending result',
            variant: 'secondary',
            surfaceClass: 'border-border bg-background',
        };
    }

    if (status === 'cancelled' || status === 'entered_in_error') {
        return {
            label: formatEnumLabel(status),
            variant: 'destructive',
            surfaceClass: 'border-destructive/20 bg-destructive/5',
        };
    }

    return {
        label: 'In workflow',
        variant: workflowStatusVariant(order.status),
        surfaceClass: 'border-border bg-background',
    };
}

function radiologyClinicalSignal(order: RadiologyOrder): ClinicalSignalDescriptor {
    const status = (order.status ?? '').trim().toLowerCase();
    const summary = (order.reportSummary ?? '').trim().toLowerCase();

    if (status === 'completed') {
        if (
            summary.includes('critical finding')
            || summary.includes('urgent review')
            || summary.includes('immediate clinical action')
            || summary.includes('escalate')
        ) {
            return {
                label: 'Critical report',
                variant: 'destructive',
                surfaceClass: 'border-destructive/30 bg-destructive/5',
            };
        }

        if (summary !== '') {
            const looksNormal =
                summary.includes('no acute abnormality')
                || summary.includes('no acute ')
                || summary.includes('normal study')
                || summary.includes('unremarkable');

            if (looksNormal) {
                return {
                    label: 'Report complete',
                    variant: 'default',
                    surfaceClass: 'border-emerald-500/25 bg-emerald-500/5',
                };
            }

            return {
                label: 'Abnormal report',
                variant: 'secondary',
                surfaceClass: 'border-amber-500/30 bg-amber-500/5',
            };
        }

        return {
            label: 'Report complete',
            variant: 'default',
            surfaceClass: 'border-emerald-500/25 bg-emerald-500/5',
        };
    }

    if (status === 'ordered' || status === 'scheduled' || status === 'in_progress') {
        return {
            label: 'Pending report',
            variant: 'secondary',
            surfaceClass: 'border-border bg-background',
        };
    }

    if (status === 'cancelled' || status === 'entered_in_error') {
        return {
            label: formatEnumLabel(status),
            variant: 'destructive',
            surfaceClass: 'border-destructive/20 bg-destructive/5',
        };
    }

    return {
        label: 'In workflow',
        variant: workflowStatusVariant(order.status),
        surfaceClass: 'border-border bg-background',
    };
}

function parseClinicalDate(value: string | null | undefined): number | null {
    if (!value) return null;

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function isClinicalDateWithinDays(value: string | null | undefined, days: number): boolean {
    const parsed = parseClinicalDate(value);
    if (parsed === null) return false;

    const ageMs = Date.now() - parsed;
    return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
}

function isCurrentLaboratoryOrder(order: LaboratoryOrder): boolean {
    if (typeof order.currentCare?.isCurrent === 'boolean') {
        return order.currentCare.isCurrent;
    }

    const status = (order.status ?? '').trim().toLowerCase();
    if (['ordered', 'collected', 'in_progress'].includes(status)) {
        return true;
    }

    if (status === 'completed') {
        const signal = extractLaboratoryResultFlag(order.resultSummary);
        return signal === 'critical'
            || signal === 'abnormal'
            || signal === 'inconclusive'
            || isClinicalDateWithinDays(order.resultedAt ?? order.orderedAt, 14);
    }

    return false;
}

function isCurrentRadiologyOrder(order: RadiologyOrder): boolean {
    if (typeof order.currentCare?.isCurrent === 'boolean') {
        return order.currentCare.isCurrent;
    }

    const status = (order.status ?? '').trim().toLowerCase();
    if (['ordered', 'scheduled', 'in_progress'].includes(status)) {
        return true;
    }

    if (status === 'completed') {
        const signal = radiologyClinicalSignal(order).label;
        return signal === 'Critical report'
            || signal === 'Abnormal report'
            || isClinicalDateWithinDays(order.completedAt ?? order.orderedAt, 14);
    }

    return false;
}

function isCurrentPharmacyOrder(order: PharmacyOrder): boolean {
    if (typeof order.currentCare?.isCurrent === 'boolean') {
        return order.currentCare.isCurrent;
    }

    const status = (order.status ?? '').trim().toLowerCase();
    if (['pending', 'in_preparation', 'partially_dispensed'].includes(status)) {
        return true;
    }

    if (status === 'dispensed') {
        return !['completed', 'reconciled'].includes((order.reconciliationStatus ?? '').trim().toLowerCase())
            || isClinicalDateWithinDays(order.dispensedAt ?? order.orderedAt, 30);
    }

    return false;
}

function isCurrentTheatreProcedure(procedure: TheatreProcedure): boolean {
    if (typeof procedure.currentCare?.isCurrent === 'boolean') {
        return procedure.currentCare.isCurrent;
    }

    const status = (procedure.status ?? '').trim().toLowerCase();
    if (['planned', 'in_preop', 'in_progress'].includes(status)) {
        return true;
    }

    if (status === 'completed') {
        return isClinicalDateWithinDays(procedure.completedAt ?? procedure.scheduledAt, 30);
    }

    return false;
}

function sortCurrentItems<T>(
    items: T[],
    getPriority: (item: T) => number,
    getRecency: (item: T) => number,
): T[] {
    return [...items].sort((left, right) => {
        const priorityDelta = getPriority(right) - getPriority(left);
        if (priorityDelta !== 0) {
            return priorityDelta;
        }

        return getRecency(right) - getRecency(left);
    });
}

function laboratoryCurrentPriority(order: LaboratoryOrder): number {
    if (typeof order.currentCare?.priorityRank === 'number') {
        return order.currentCare.priorityRank;
    }

    const status = (order.status ?? '').trim().toLowerCase();
    const resultFlag = extractLaboratoryResultFlag(order.resultSummary);

    if (status === 'completed' && resultFlag === 'critical') return 500;
    if (status === 'completed' && (resultFlag === 'abnormal' || resultFlag === 'inconclusive')) return 450;
    if (status === 'in_progress') return 400;
    if (status === 'collected') return 380;
    if (status === 'ordered') return 360;
    if (status === 'completed') return 300;

    return 0;
}

function laboratoryCurrentRecency(order: LaboratoryOrder): number {
    return parseClinicalDate(order.resultedAt) ?? parseClinicalDate(order.orderedAt) ?? 0;
}

function radiologyCurrentPriority(order: RadiologyOrder): number {
    if (typeof order.currentCare?.priorityRank === 'number') {
        return order.currentCare.priorityRank;
    }

    const status = (order.status ?? '').trim().toLowerCase();
    const signal = radiologyClinicalSignal(order).label;

    if (signal === 'Critical report') return 500;
    if (signal === 'Abnormal report') return 450;
    if (status === 'in_progress') return 400;
    if (status === 'scheduled') return 380;
    if (status === 'ordered') return 360;
    if (status === 'completed') return 300;

    return 0;
}

function radiologyCurrentRecency(order: RadiologyOrder): number {
    return parseClinicalDate(order.completedAt) ?? parseClinicalDate(order.orderedAt) ?? 0;
}

function pharmacyCurrentPriority(order: PharmacyOrder): number {
    if (typeof order.currentCare?.priorityRank === 'number') {
        return order.currentCare.priorityRank;
    }

    const status = (order.status ?? '').trim().toLowerCase();
    const reconciliationStatus = (order.reconciliationStatus ?? '').trim().toLowerCase();

    if (status === 'dispensed' && !['completed', 'reconciled'].includes(reconciliationStatus)) return 520;
    if (status === 'partially_dispensed') return 500;
    if (status === 'in_preparation') return 480;
    if (status === 'pending') return 460;
    if (status === 'dispensed') return 320;

    return 0;
}

function pharmacyCurrentRecency(order: PharmacyOrder): number {
    return (
        parseClinicalDate(order.reconciledAt)
        ?? parseClinicalDate(order.dispensedAt)
        ?? parseClinicalDate(order.orderedAt)
        ?? 0
    );
}

function theatreCurrentPriority(procedure: TheatreProcedure): number {
    if (typeof procedure.currentCare?.priorityRank === 'number') {
        return procedure.currentCare.priorityRank;
    }

    const status = (procedure.status ?? '').trim().toLowerCase();

    if (status === 'in_progress') return 500;
    if (status === 'in_preop') return 450;
    if (status === 'planned') return 400;
    if (status === 'completed') return 300;

    return 0;
}

function theatreCurrentRecency(procedure: TheatreProcedure): number {
    return parseClinicalDate(procedure.completedAt) ?? parseClinicalDate(procedure.scheduledAt) ?? 0;
}

function pharmacyOrderQuantityLabel(
    quantity: string | number | null | undefined,
): string | null {
    if (quantity === null || quantity === undefined) return null;

    const normalized = String(quantity).trim();
    if (normalized === '') return null;

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return `Qty ${normalized}`;

    return `Qty ${Number.isInteger(parsed) ? parsed.toString() : parsed.toString()}`;
}

function allergySeverityVariant(
    severity: string | null | undefined,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch ((severity ?? '').toLowerCase()) {
        case 'life_threatening':
        case 'severe':
            return 'destructive';
        case 'moderate':
            return 'secondary';
        case 'mild':
            return 'outline';
        default:
            return 'outline';
    }
}

function medicationProfileLine(profile: PatientMedicationProfile): string {
    return [
        profile.dose,
        profile.route ? formatEnumLabel(profile.route) : null,
        profile.frequency ? formatEnumLabel(profile.frequency) : null,
    ]
        .filter(Boolean)
        .join(' | ') || 'Schedule not recorded';
}
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

function appointmentActionLabel(appointment: Appointment | null): string {
    switch (appointment?.status) {
        case 'in_consultation':
            return 'Resume consultation';
        case 'waiting_provider':
            return 'Start consultation';
        case 'waiting_triage':
            return 'Open triage';
        default:
            return 'Open care workflow';
    }
}

function shouldShowAppointmentCareAction(appointment: Appointment | null): boolean {
    return Boolean(appointment && activeVisitStatuses.includes(appointment.status || ''));
}

function appointmentPrimaryActionHref(appointment: Appointment): string {
    return canReadMedicalRecords.value && shouldShowAppointmentCareAction(appointment)
        ? consultationHrefForAppointment(appointment)
        : appointmentDetailsHref(appointment);
}

function appointmentPrimaryActionLabel(appointment: Appointment): string {
    return canReadMedicalRecords.value && shouldShowAppointmentCareAction(appointment)
        ? appointmentActionLabel(appointment)
        : 'Open visit';
}

function appointmentPrimaryActionIcon(appointment: Appointment): string {
    return canReadMedicalRecords.value && shouldShowAppointmentCareAction(appointment)
        ? 'stethoscope'
        : 'calendar-clock';
}

function timelineCategoryLabel(category: ChartTimelineEvent['category']): string {
    switch (category) {
        case 'visit':
            return 'Visit';
        case 'consultation':
            return 'Consultation';
        case 'laboratory':
            return 'Lab';
        case 'imaging':
            return 'Imaging';
        case 'pharmacy':
            return 'Pharmacy';
        case 'billing':
            return 'Billing';
        default:
            return 'Timeline';
    }
}

function syncChartUrl(): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (activeTab.value === 'overview') {
        url.searchParams.delete('tab');
    } else {
        url.searchParams.set('tab', activeTab.value);
    }

    if (focusedAppointmentId.value) {
        url.searchParams.set('appointmentId', focusedAppointmentId.value);
    } else {
        url.searchParams.delete('appointmentId');
    }

    window.history.replaceState({}, '', url.toString());
}

watch(
    patientChartTabs,
    (tabs) => {
        if (tabs.some((tab) => tab.value === activeTab.value)) return;

        activeTab.value = tabs[0]?.value ?? 'overview';
        syncChartUrl();
    },
    { immediate: true },
);

watch(activeTab, () => {
    syncChartUrl();
});

watch(
    availableOrdersWorkspaceLanes,
    (lanes) => {
        if (lanes.length === 0) return;
        if (!lanes.includes(ordersWorkspaceTab.value)) {
            ordersWorkspaceTab.value = lanes[0];
        }
    },
    { immediate: true },
);

watch(focusedAppointmentId, () => {
    syncChartUrl();
});

onMounted(() => {
    void loadPatient();
    void loadRecords();
    void loadAppointments();
    void loadPatientAllergies();
    void loadPatientMedicationProfile();
    void loadPatientMedicationReconciliation();
    void loadLaboratoryOrders();
    void loadPharmacyOrders();
    void loadRadiologyOrders();
    void loadTheatreProcedures();
    void loadBillingInvoices();
});
</script>

<template>
    <AppLayout :breadcrumbs="breadcrumbs">
        <Head :title="pageTitle" />

        <div class="space-y-6 px-4 py-4 md:px-6 md:py-6">
            <Card class="rounded-lg">
                <CardContent class="p-0">
                    <div v-if="patientLoading" class="space-y-4 px-6 py-5">
                        <Skeleton class="h-6 w-40 rounded-lg" />
                        <Skeleton class="h-8 w-80 rounded-lg" />
                        <Skeleton class="h-24 w-full rounded-lg" />
                    </div>

                    <Alert v-else-if="patientError" variant="destructive" class="m-6">
                        <AlertTitle>Patient chart unavailable</AlertTitle>
                        <AlertDescription>{{ patientError }}</AlertDescription>
                    </Alert>

                    <template v-else-if="patient">
                        <div class="flex flex-col gap-4 border-b px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
                            <div class="min-w-0 space-y-3">
                                <div class="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">Patient chart</Badge>
                                    <Badge variant="outline">{{ handoffSource === 'appointments' ? 'Appointment handoff' : 'Direct chart access' }}</Badge>
                                    <Badge v-if="patient.status" variant="outline">{{ formatEnumLabel(patient.status) }}</Badge>
                                    <Badge v-if="primaryVisit" :variant="appointmentStatusVariant(primaryVisit.status)">{{ formatEnumLabel(primaryVisit.status || 'scheduled') }}</Badge>
                                </div>
                                <div class="space-y-1">
                                    <h1 class="text-2xl font-semibold tracking-tight text-foreground">{{ patientName(patient) }}</h1>
                                    <p class="text-sm text-muted-foreground">
                                        Patient No. {{ patient.patientNumber || 'Not assigned' }}
                                        <span class="mx-1">|</span>
                                        {{ patient.gender || 'Gender not recorded' }}
                                        <span class="mx-1">|</span>
                                        {{ ageLabel(patient.dateOfBirth) }}
                                    </p>
                                </div>
                                <div class="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                    <span>Phone: {{ patient.phone || 'Not recorded' }}</span>
                                    <span>Email: {{ patient.email || 'Not recorded' }}</span>
                                    <span class="inline-flex items-center gap-1.5"><AppIcon name="map-pin" class="size-3.5" />{{ patientLocationLabel }}</span>
                                </div>
                            </div>

                            <div class="flex flex-wrap gap-2">
                                <Button v-if="canReadAppointments" size="sm" class="gap-1.5" as-child>
                                    <Link :href="visitPrimaryActionHref"><AppIcon :name="visitPrimaryActionIcon" class="size-3.5" />{{ visitPrimaryActionLabel }}</Link>
                                </Button>
                                <Button v-if="canReadMedicalRecords" size="sm" variant="outline" class="gap-1.5" as-child>
                                    <Link :href="recordsRegistryHref"><AppIcon name="search" class="size-3.5" />Records registry</Link>
                                </Button>
                                <Button size="sm" variant="ghost" class="gap-1.5" as-child>
                                    <Link href="/patients"><AppIcon name="chevron-left" class="size-3.5" />Back to patients</Link>
                                </Button>
                            </div>
                        </div>

                        <div v-if="handoffSource === 'appointments'" class="border-b px-6 py-4">
                            <Alert>
                                <AlertTitle>Appointment handoff is active</AlertTitle>
                                <AlertDescription>Review chart history here, then return to the focused visit workspace when you are ready to continue the encounter.</AlertDescription>
                            </Alert>
                        </div>

                        <div class="border-b bg-muted/10 px-6 py-4">
                            <div class="grid gap-3 lg:grid-cols-3">
                                <div class="rounded-lg border bg-background px-4 py-3">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Current visit</p>
                                    <p class="mt-1.5 text-sm font-medium text-foreground">{{ primaryVisit ? `${primaryVisit.department || 'Department pending'} | ${formatEnumLabel(primaryVisit.status || 'scheduled')}` : 'No active visit in chart context' }}</p>
                                    <p class="mt-1 text-xs text-muted-foreground">{{ primaryVisit ? `Scheduled ${formatDateTime(primaryVisit.scheduledAt)}` : 'Use the visits tab or appointments workspace when a visit is booked.' }}</p>
                                </div>
                                <div class="rounded-lg border bg-background px-4 py-3">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Latest note</p>
                                    <p class="mt-1.5 text-sm font-medium text-foreground">{{ latestRecord ? formatDateTime(latestRecord.encounterAt) : 'No consultation recorded yet' }}</p>
                                    <p class="mt-1 text-xs text-muted-foreground">{{ latestRecord ? recordProblem(latestRecord) : 'Start the first chart note from this patient workspace.' }}</p>
                                </div>
                                <div class="rounded-lg border bg-background px-4 py-3">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Chart scope</p>
                                    <p class="mt-1.5 text-sm font-medium text-foreground">{{ chartCounts.records }} records | {{ chartCounts.visits }} visits | {{ chartCounts.timelineEvents }} events</p>
                                    <p class="mt-1 text-xs text-muted-foreground">{{ chartCounts.activeVisits }} active visit{{ chartCounts.activeVisits === 1 ? '' : 's' }} currently visible in this chart context.</p>
                                </div>
                            </div>
                        </div>

                        <div class="px-6 py-5">
                            <Tabs v-model="activeTab" class="space-y-6">
                                <div class="sticky top-0 z-20 -mx-6 border-b bg-background/95 px-6 pb-3 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                    <div class="mb-2 flex items-center justify-between gap-3">
                                        <div class="flex min-w-0 items-center gap-2 text-sm">
                                            <span class="truncate font-semibold text-foreground">{{ patientName(patient) }}</span>
                                            <span class="shrink-0 text-muted-foreground">·</span>
                                            <span class="shrink-0 text-xs text-muted-foreground">{{ patient.patientNumber || '' }}</span>
                                            <Badge v-if="primaryVisit" :variant="appointmentStatusVariant(primaryVisit.status)" class="h-4 shrink-0 px-1 text-[10px]">{{ formatEnumLabel(primaryVisit.status || 'scheduled') }}</Badge>
                                        </div>
                                        <Button v-if="canReadAppointments" size="sm" class="h-7 shrink-0 gap-1.5 px-2.5 text-xs" as-child>
                                            <Link :href="visitPrimaryActionHref"><AppIcon :name="visitPrimaryActionIcon" class="size-3" />{{ visitPrimaryActionLabel }}</Link>
                                        </Button>
                                    </div>
                                    <TabsList :class="['grid h-auto w-full grid-cols-2 sm:w-auto', patientChartTabsGridClass]">
                                        <TabsTrigger
                                            v-for="tab in patientChartTabs"
                                            :key="tab.value"
                                            :value="tab.value"
                                            class="gap-1"
                                        >
                                            {{ tab.label }}
                                            <span
                                                v-if="tab.count"
                                                :class="[
                                                    'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums',
                                                    tab.hasAlert ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                                                ]"
                                            >{{ tab.count > 99 ? '99+' : tab.count }}</span>
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="overview" class="space-y-6">
                                    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_19rem]">
                                        <div class="min-w-0 space-y-6">
                                            <div class="grid gap-4 md:grid-cols-2">
                                                <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Allergy safety</p>
                                                    <p class="mt-2 text-sm font-medium text-foreground">
                                                        <template v-if="patientAllergiesLoading">Loading&hellip;</template>
                                                        <template v-else-if="patientAllergies.length === 0">No allergies on record</template>
                                                        <template v-else>{{ patientAllergies.length }} allerg{{ patientAllergies.length === 1 ? 'y' : 'ies' }} recorded</template>
                                                    </p>
                                                    <button type="button" class="mt-2 text-xs text-primary hover:underline" @click="activeTab = 'medications'">
                                                        {{ patientAllergies.length > 0 ? 'Review in Medications' : 'Add in Medications' }}
                                                    </button>
                                                </div>
                                                <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active care</p>
                                                    <p class="mt-2 text-sm font-medium text-foreground">
                                                        {{ careCounts.labActive + careCounts.imagingActive + careCounts.pharmacyActive + careCounts.procedureActive }}
                                                        active order{{ (careCounts.labActive + careCounts.imagingActive + careCounts.pharmacyActive + careCounts.procedureActive) === 1 ? '' : 's' }}
                                                    </p>
                                                    <button type="button" class="mt-2 text-xs text-primary hover:underline" @click="activeTab = 'orders'">
                                                        {{ (careCounts.labActive + careCounts.imagingActive + careCounts.pharmacyActive + careCounts.procedureActive) > 0 ? 'Open Orders &amp; Results' : 'Start ordering' }}
                                                    </button>
                                                </div>
                                                <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Problem focus</p>
                                                    <p class="mt-2 text-sm text-foreground">{{ latestRecord ? recordProblem(latestRecord) : 'No problem focus recorded yet.' }}</p>
                                                </div>
                                                <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next step</p>
                                                    <p class="mt-2 text-sm text-foreground">{{ latestRecord ? recordNextStep(latestRecord) : 'No follow-up plan recorded yet.' }}</p>
                                                </div>
                                            </div>


                                            <Card v-if="canReadAppointments && appointments.length > 0" class="rounded-lg">
                                                <CardHeader class="pb-3">
                                                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                        <div>
                                                            <CardTitle>Encounter focus</CardTitle>
                                                            <p class="mt-1 text-sm text-muted-foreground">Keep the chart anchored to the visit you mean before launching consultation, records, or downstream care.</p>
                                                        </div>
                                                        <Button v-if="focusedAppointmentId" size="sm" variant="ghost" @click="focusedAppointmentId = ''">
                                                            Auto-select visit
                                                        </Button>
                                                    </div>
                                                </CardHeader>
                                                <CardContent class="space-y-3">
                                                    <div class="flex flex-wrap gap-2">
                                                        <Button
                                                            v-for="appointment in visitFocusOptions"
                                                            :key="appointment.id"
                                                            size="sm"
                                                            :variant="primaryVisit?.id === appointment.id ? 'default' : 'outline'"
                                                            class="gap-1.5"
                                                            @click="focusedAppointmentId = appointment.id"
                                                        >
                                                            <AppIcon name="calendar-clock" class="size-3.5" />
                                                            {{ appointment.appointmentNumber || formatDateTime(appointment.scheduledAt) }}
                                                        </Button>
                                                    </div>
                                                    <p class="text-xs text-muted-foreground">
                                                        Current chart focus:
                                                        {{ primaryVisit ? `${primaryVisit.appointmentNumber || 'Visit'} | ${primaryVisit.department || 'Department pending'} | ${formatEnumLabel(primaryVisit.status || 'scheduled')}` : 'Automatic selection based on active visit state.' }}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                            <Alert v-if="appointmentsError" variant="destructive">
                                                <AlertTitle>Visit context unavailable</AlertTitle>
                                                <AlertDescription>{{ appointmentsError }}</AlertDescription>
                                            </Alert>

                                            <Card class="rounded-lg">
                                                <CardHeader class="pb-3">
                                                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                        <div>
                                                            <CardTitle>Recent care timeline</CardTitle>
                                                            <p class="mt-1 text-sm text-muted-foreground">The latest patient events across visits, consultation notes, results, medication, and billing.</p>
                                                        </div>
                                                        <Button size="sm" variant="outline" class="gap-1.5" @click="activeTab = 'timeline'">
                                                            <AppIcon name="activity" class="size-3.5" />Open full timeline
                                                        </Button>
                                                    </div>
                                                </CardHeader>
                                                <CardContent>
                                                    <div v-if="timelinePreview.length === 0" class="rounded-lg border border-dashed px-4 py-4">
                                                        <p class="text-sm font-medium text-foreground">No timeline events recorded yet</p>
                                                        <p class="mt-1 text-sm text-muted-foreground">Visits, consultation notes, results, and billing signals will appear here as care progresses.</p>
                                                    </div>
                                                    <div v-else class="space-y-3">
                                                        <div v-for="event in timelinePreview" :key="event.id" :class="['rounded-lg border border-l-4 px-4 py-4', event.accentClass]">
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
                                                </CardContent>
                                            </Card>
                                        </div>

                                        <div class="min-w-0 space-y-4">
                                            <Card class="rounded-lg">
                                                <CardHeader class="px-4 pb-2 pt-4">
                                                    <CardTitle class="text-base">Patient details</CardTitle>
                                                </CardHeader>
                                                <CardContent class="space-y-2.5 px-4 pb-4 text-sm">
                                                    <div>
                                                        <p class="text-xs uppercase tracking-wide text-muted-foreground">Date of birth</p>
                                                        <p class="mt-1 font-medium text-foreground">{{ formatDate(patient.dateOfBirth) }}</p>
                                                    </div>
                                                    <Separator />
                                                    <div>
                                                        <p class="text-xs uppercase tracking-wide text-muted-foreground">National ID</p>
                                                        <p class="mt-1 font-medium text-foreground">{{ patient.nationalId || 'Not recorded' }}</p>
                                                    </div>
                                                    <Separator />
                                                    <div>
                                                        <p class="text-xs uppercase tracking-wide text-muted-foreground">Address</p>
                                                        <p class="mt-1 font-medium text-foreground">{{ patientLocationLabel }}</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            <Card class="rounded-lg">
                                                <CardHeader class="px-4 pb-2 pt-4">
                                                    <CardTitle class="text-base">Chart actions</CardTitle>
                                                </CardHeader>
                                                <CardContent class="flex flex-col gap-2 px-4 pb-4">
                                                    <Button v-if="canReadAppointments" size="sm" class="justify-start gap-1.5" as-child>
                                                        <Link :href="visitPrimaryActionHref"><AppIcon :name="visitPrimaryActionIcon" class="size-3.5" />{{ visitPrimaryActionLabel }}</Link>
                                                    </Button>
                                                    <Button size="sm" variant="outline" class="justify-start gap-1.5" @click="activeTab = 'timeline'">
                                                        <AppIcon name="activity" class="size-3.5" />Open chart timeline
                                                    </Button>
                                                    <Button v-if="canReadMedicalRecords" size="sm" variant="ghost" class="justify-start gap-1.5" as-child>
                                                        <Link :href="recordsRegistryHref"><AppIcon name="search" class="size-3.5" />Open records registry</Link>
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="timeline" class="space-y-6">
                                    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Timeline</p>
                                            <p class="text-sm text-muted-foreground">Read this patient chart as one continuous care story across visit flow, consultation, results, medication, and billing.</p>
                                        </div>
                                        <div class="flex flex-wrap gap-2">
                                            <Button v-if="canReadAppointments" size="sm" class="gap-1.5" as-child>
                                                <Link :href="timelineAppointmentActionHref"><AppIcon :name="visitPrimaryActionIcon" class="size-3.5" />{{ timelineAppointmentActionLabel }}</Link>
                                            </Button>
                                        </div>
                                    </div>

                                    <div v-if="timelineEvents.length === 0" class="rounded-lg border border-dashed px-5 py-5">
                                        <p class="text-base font-medium text-foreground">No timeline events recorded yet</p>
                                        <p class="mt-1 text-sm text-muted-foreground">This chart will start building a patient story as visits, notes, results, medication, and billing items are recorded.</p>
                                    </div>

                                    <div v-else class="space-y-6">
                                        <div class="grid gap-4 xl:grid-cols-3">
                                            <div class="rounded-lg border bg-muted/10 px-4 py-4">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Current handoff</p>
                                                <p class="mt-2 text-sm font-semibold text-foreground">{{ handoffSummary.title }}</p>
                                                <p class="mt-2 text-sm text-foreground">{{ handoffSummary.summary }}</p>
                                                <p class="mt-2 text-xs text-muted-foreground">{{ handoffSummary.meta }}</p>
                                            </div>
                                            <div class="rounded-lg border bg-muted/10 px-4 py-4">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Latest clinical signal</p>
                                                <p class="mt-2 text-sm font-semibold text-foreground">{{ latestClinicalSignal ? latestClinicalSignal.title : 'No recent clinical signal' }}</p>
                                                <p class="mt-2 text-sm text-foreground">{{ latestClinicalSignal ? latestClinicalSignal.summary : 'Consultation notes, lab results, and imaging reports will surface here.' }}</p>
                                                <p class="mt-2 text-xs text-muted-foreground">{{ latestClinicalSignal ? `${timelineCategoryLabel(latestClinicalSignal.category)} | ${formatDateTime(latestClinicalSignal.occurredAt)}` : 'Timeline follows the most recent patient activity.' }}</p>
                                            </div>
                                            <div class="rounded-lg border bg-muted/10 px-4 py-4">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Next documented step</p>
                                                <p class="mt-2 text-sm text-foreground">{{ nextDocumentedStep }}</p>
                                                <p class="mt-2 text-xs text-muted-foreground">Use this together with the current handoff card to keep the patient moving through care.</p>
                                            </div>
                                        </div>

                                        <Card v-if="primaryVisit" class="rounded-lg">
                                            <CardHeader class="pb-3">
                                                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <CardTitle>Focused encounter stream</CardTitle>
                                                        <p class="mt-1 text-sm text-muted-foreground">{{ primaryVisit.appointmentNumber || 'Current visit' }} linked activity across consultation, orders, results, and billing.</p>
                                                    </div>
                                                    <div class="flex flex-wrap gap-2">
                                                        <Button size="sm" variant="outline" class="gap-1.5" as-child>
                                                            <Link :href="appointmentDetailsHref(primaryVisit)"><AppIcon name="calendar-clock" class="size-3.5" />Open visit</Link>
                                                        </Button>
                                                        <Button v-if="focusedAppointmentId" size="sm" variant="ghost" @click="focusedAppointmentId = ''">
                                                            Auto-select visit
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-4">
                                                <div class="grid gap-3 md:grid-cols-4">
                                                    <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Linked events</p>
                                                        <p class="mt-2 text-lg font-semibold text-foreground">{{ focusedEncounterCounts.total }}</p>
                                                        <p class="mt-1 text-xs text-muted-foreground">All timeline items tied to this visit.</p>
                                                    </div>
                                                    <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Consultation notes</p>
                                                        <p class="mt-2 text-lg font-semibold text-foreground">{{ focusedEncounterCounts.notes }}</p>
                                                        <p class="mt-1 text-xs text-muted-foreground">Documentation linked to this encounter.</p>
                                                    </div>
                                                    <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Orders &amp; results</p>
                                                        <p class="mt-2 text-lg font-semibold text-foreground">{{ focusedEncounterCounts.orders }}</p>
                                                        <p class="mt-1 text-xs text-muted-foreground">Lab, imaging, and pharmacy activity for this visit.</p>
                                                    </div>
                                                    <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Billing items</p>
                                                        <p class="mt-2 text-lg font-semibold text-foreground">{{ focusedEncounterCounts.billing }}</p>
                                                        <p class="mt-1 text-xs text-muted-foreground">Invoices and financial follow-up linked to the visit.</p>
                                                    </div>
                                                </div>

                                                <div class="rounded-lg border bg-muted/10 px-4 py-3">
                                                    <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Latest encounter signal</p>
                                                    <p class="mt-2 text-sm font-semibold text-foreground">{{ focusedEncounterLatestEvent ? focusedEncounterLatestEvent.title : 'No linked encounter signal' }}</p>
                                                    <p class="mt-1 text-sm text-foreground">{{ focusedEncounterLatestEvent ? focusedEncounterLatestEvent.summary : 'This visit is in chart focus, but no consultation note, order, result, or billing item has been linked to it yet.' }}</p>
                                                    <p class="mt-2 text-xs text-muted-foreground">{{ focusedEncounterLatestEvent ? timelineCategoryLabel(focusedEncounterLatestEvent.category) + ' | ' + formatDateTime(focusedEncounterLatestEvent.occurredAt) : 'The focused encounter stream will fill as care is recorded.' }}</p>
                                                </div>

                                                <p class="text-xs text-muted-foreground">
                                                    {{ focusedEncounterCounts.total === 0 ? 'No linked encounter activity yet. Use the visit, consultation, and ordering workflows to start building this encounter stream.' : 'Use the full patient timeline below for longitudinal context across older visits and cross-encounter history.' }}
                                                </p>
                                            </CardContent>
                                        </Card>

                                        <div class="space-y-5">
                                            <div v-for="section in timelineSections" :key="section.key" class="space-y-3">
                                                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <div class="h-px flex-1 bg-border"></div>
                                                    <span class="font-medium uppercase tracking-[0.12em]">{{ section.label }}</span>
                                                    <div class="h-px flex-1 bg-border"></div>
                                                </div>

                                                <div class="space-y-2">
                                                    <template v-for="event in section.events" :key="event.id">
                                                        <div v-if="!event.actionLabel" :class="['flex items-center gap-3 rounded-lg border border-l-4 px-3 py-2', event.accentClass]">
                                                            <AppIcon :name="event.icon" class="size-3.5 shrink-0 text-muted-foreground" />
                                                            <div class="min-w-0 flex-1">
                                                                <span class="text-sm font-medium text-foreground">{{ event.title }}</span>
                                                                <span v-if="event.subtitle" class="ml-1.5 text-xs text-muted-foreground">{{ event.subtitle }}</span>
                                                            </div>
                                                            <div class="flex shrink-0 items-center gap-1.5">
                                                                <Badge v-if="event.status" :variant="workflowStatusVariant(event.status)" class="text-[10px]">{{ formatEnumLabel(event.status) }}</Badge>
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

                                <TabsContent value="visits" class="space-y-6">
                                    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Visits</p>
                                            <p class="text-sm text-muted-foreground">Review current and recent visit context without leaving the patient chart.</p>
                                        </div>
                                        <Button size="sm" class="gap-1.5" as-child>
                                            <Link :href="visitPrimaryActionHref"><AppIcon :name="visitPrimaryActionIcon" class="size-3.5" />{{ visitPrimaryActionLabel }}</Link>
                                        </Button>
                                    </div>

                                    <Alert v-if="!canReadAppointments" variant="default">
                                        <AlertTitle>Appointments access required</AlertTitle>
                                        <AlertDescription>This patient chart is available, but the visits stream requires <code>appointments.read</code>.</AlertDescription>
                                    </Alert>

                                    <div v-else-if="appointmentsLoading" class="space-y-3">
                                        <Skeleton class="h-28 w-full rounded-lg" />
                                        <Skeleton class="h-28 w-full rounded-lg" />
                                    </div>

                                    <Alert v-else-if="appointmentsError" variant="destructive">
                                        <AlertTitle>Visits unavailable</AlertTitle>
                                        <AlertDescription>{{ appointmentsError }}</AlertDescription>
                                    </Alert>

                                    <div v-else-if="appointments.length === 0" class="rounded-lg border border-dashed px-5 py-5">
                                        <p class="text-base font-medium text-foreground">No visits recorded for this patient yet</p>
                                        <p class="mt-1 text-sm text-muted-foreground">Schedule the first appointment when this patient is entering the outpatient workflow.</p>
                                    </div>

                                    <div v-else class="space-y-4">
                                        <div v-for="appointment in appointments" :key="appointment.id" :class="['rounded-lg border px-4 py-4', primaryVisit?.id === appointment.id ? 'border-primary bg-primary/5' : 'bg-background']">
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
                                                        :variant="primaryVisit?.id === appointment.id ? 'default' : 'outline'"
                                                        class="gap-1.5"
                                                        @click="focusedAppointmentId = appointment.id"
                                                    >
                                                        <AppIcon name="book-open" class="size-3.5" />
                                                        {{ primaryVisit?.id === appointment.id ? 'In chart focus' : 'Focus in chart' }}
                                                    </Button>
                                                    <Button size="sm" variant="outline" class="gap-1.5" as-child>
                                                        <Link :href="appointmentPrimaryActionHref(appointment)"><AppIcon :name="appointmentPrimaryActionIcon(appointment)" class="size-3.5" />{{ appointmentPrimaryActionLabel(appointment) }}</Link>
                                                    </Button>
                                                </div>
                                                </div>
                                            </div>
                                        </div>
                                </TabsContent>

                                <TabsContent value="medications" class="space-y-6">
                                    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Medications</p>
                                            <p class="text-sm text-muted-foreground">Maintain patient allergies, the current medication list, and reconciliation follow-up in one place.</p>
                                        </div>
                                        <div class="flex flex-wrap gap-2">
                                            <Button size="sm" variant="outline" class="gap-1.5" as-child>
                                                <Link :href="clinicalModuleHref('/pharmacy-orders', { includeAppointment: false })"><AppIcon name="book-open" class="size-3.5" />Open pharmacy queue</Link>
                                            </Button>
                                        </div>
                                    </div>

                                    <div class="rounded-lg border bg-muted/10 px-4 py-4">
                                        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Start here</p>
                                                <p class="text-sm font-medium text-foreground">Build the patient medication picture in three steps.</p>
                                                <p class="text-sm text-muted-foreground">Record allergies first, keep the current medication list up to date, then review reconciliation follow-up from dispensed orders.</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                class="gap-1.5 self-start"
                                                @click="scrollToMedicationWorkspaceSection('reconciliation')"
                                            >
                                                <AppIcon name="check" class="size-3.5" />Review reconciliation
                                            </Button>
                                        </div>

                                        <div class="mt-4 grid gap-3 lg:grid-cols-3">
                                            <button
                                                type="button"
                                                class="rounded-lg border bg-background px-4 py-4 text-left transition hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                                                :disabled="!canUpdatePatients"
                                                @click="openAllergyDialog()"
                                            >
                                                <div class="flex items-start gap-3">
                                                    <div class="rounded-lg bg-primary/10 p-2 text-primary">
                                                        <AppIcon name="shield-alert" class="size-4" />
                                                    </div>
                                                    <div class="space-y-1">
                                                        <div class="flex items-center gap-2">
                                                            <p class="text-sm font-semibold text-foreground">1. Record allergy</p>
                                                            <span class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium tabular-nums text-muted-foreground">{{ patientAllergies.length }}</span>
                                                        </div>
                                                        <p class="text-xs text-muted-foreground">Add medicine or substance reactions before more therapy is ordered or dispensed.</p>
                                                    </div>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                class="rounded-lg border bg-background px-4 py-4 text-left transition hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                                                :disabled="!canUpdatePatients"
                                                @click="openMedicationProfileDialog()"
                                            >
                                                <div class="flex items-start gap-3">
                                                    <div class="rounded-lg bg-primary/10 p-2 text-primary">
                                                        <AppIcon name="pill" class="size-4" />
                                                    </div>
                                                    <div class="space-y-1">
                                                        <div class="flex items-center gap-2">
                                                            <p class="text-sm font-semibold text-foreground">2. Add current medication</p>
                                                            <span class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium tabular-nums text-muted-foreground">{{ patientMedicationProfile.length }}</span>
                                                        </div>
                                                        <p class="text-xs text-muted-foreground">Use this for home meds, chronic therapy, discharge medication, or external prescriptions.</p>
                                                    </div>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                class="rounded-lg border bg-background px-4 py-4 text-left transition hover:border-primary/30 hover:bg-primary/5"
                                                @click="scrollToMedicationWorkspaceSection('reconciliation')"
                                            >
                                                <div class="flex items-start gap-3">
                                                    <div class="rounded-lg bg-primary/10 p-2 text-primary">
                                                        <AppIcon name="check" class="size-4" />
                                                    </div>
                                                    <div class="space-y-1">
                                                        <div class="flex items-center gap-2">
                                                            <p class="text-sm font-semibold text-foreground">3. Review reconciliation</p>
                                                            <span v-if="(patientMedicationReconciliation?.counts.unreconciledDispensedOrders ?? 0) > 0" class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-medium tabular-nums text-primary">{{ patientMedicationReconciliation!.counts.unreconciledDispensedOrders }}</span>
                                                        </div>
                                                        <p class="text-xs text-muted-foreground">Compare dispensed therapy with the active profile and close follow-up that still needs review.</p>
                                                    </div>
                                                </div>
                                            </button>
                                        </div>

                                        <p
                                            v-if="!canUpdatePatients"
                                            class="mt-3 text-xs text-muted-foreground"
                                        >
                                            Recording allergies and current medication entries requires
                                            <code>patients.update</code>.
                                        </p>
                                    </div>

                                    <div class="grid gap-4 xl:grid-cols-4">
                                        <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Active allergies</p>
                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ patientMedicationReconciliation?.counts.activeAllergies ?? patientAllergies.length }}</p>
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Current medications</p>
                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ patientMedicationReconciliation?.counts.activeMedicationProfile ?? patientMedicationProfile.length }}</p>
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Dispensed orders</p>
                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ patientMedicationReconciliation?.counts.activeDispensedOrders ?? 0 }}</p>
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Reconciliation attention</p>
                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ patientMedicationReconciliation?.counts.unreconciledDispensedOrders ?? 0 }}</p>
                                        </div>
                                    </div>

                                    <div class="grid gap-6 xl:grid-cols-3">
                                        <Card
                                            :id="medicationWorkspaceSectionIds.allergies"
                                            class="rounded-lg scroll-mt-24"
                                        >
                                            <CardHeader class="pb-3">
                                                <div class="flex items-start justify-between gap-3">
                                                    <div>
                                                        <CardTitle>Allergies &amp; intolerances</CardTitle>
                                                        <CardDescription>Keep active reactions visible before ordering or dispensing more therapy.</CardDescription>
                                                    </div>
                                                    <Button
                                                        v-if="canUpdatePatients"
                                                        size="sm"
                                                        variant="outline"
                                                        class="gap-1.5"
                                                        @click="openAllergyDialog()"
                                                    >
                                                        <AppIcon name="plus" class="size-3.5" />Record
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-3">
                                                <div v-if="patientAllergiesLoading" class="space-y-3">
                                                    <Skeleton class="h-20 w-full rounded-lg" />
                                                    <Skeleton class="h-20 w-full rounded-lg" />
                                                </div>
                                                <Alert v-else-if="patientAllergiesError" variant="destructive">
                                                    <AlertTitle>Allergy workspace unavailable</AlertTitle>
                                                    <AlertDescription>{{ patientAllergiesError }}</AlertDescription>
                                                </Alert>
                                                <div v-else-if="patientAllergies.length === 0" class="rounded-lg border border-dashed px-4 py-4">
                                                    <p class="text-sm font-medium text-foreground">No active allergies recorded</p>
                                                    <p class="mt-1 text-sm text-muted-foreground">Record allergies or intolerances here so downstream order safety checks stay patient-aware.</p>
                                                </div>
                                                <div v-else class="space-y-3">
                                                    <div
                                                        v-for="allergy in patientAllergies"
                                                        :key="allergy.id"
                                                        class="rounded-lg border bg-background px-4 py-3"
                                                    >
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
                                                            <Button
                                                                v-if="canUpdatePatients"
                                                                size="sm"
                                                                variant="ghost"
                                                                class="gap-1.5"
                                                                @click="openAllergyDialog(allergy)"
                                                            >
                                                                <AppIcon name="pencil" class="size-3.5" />Edit
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card
                                            :id="medicationWorkspaceSectionIds.profile"
                                            class="rounded-lg xl:col-span-2 scroll-mt-24"
                                        >
                                            <CardHeader class="pb-3">
                                                <div class="flex items-start justify-between gap-3">
                                                    <div>
                                                        <CardTitle>Current medications</CardTitle>
                                                        <CardDescription>Track what the patient is currently taking outside the encounter-level order workflow.</CardDescription>
                                                    </div>
                                                    <Button
                                                        v-if="canUpdatePatients"
                                                        size="sm"
                                                        variant="outline"
                                                        class="gap-1.5"
                                                        @click="openMedicationProfileDialog()"
                                                    >
                                                        <AppIcon name="plus" class="size-3.5" />Add medication
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-3">
                                                <div v-if="patientMedicationProfileLoading" class="space-y-3">
                                                    <Skeleton class="h-20 w-full rounded-lg" />
                                                    <Skeleton class="h-20 w-full rounded-lg" />
                                                </div>
                                                <Alert v-else-if="patientMedicationProfileError" variant="destructive">
                                                    <AlertTitle>Current medication list unavailable</AlertTitle>
                                                    <AlertDescription>{{ patientMedicationProfileError }}</AlertDescription>
                                                </Alert>
                                                <div v-else-if="patientMedicationProfile.length === 0" class="rounded-lg border border-dashed px-4 py-4">
                                                    <p class="text-sm font-medium text-foreground">No current medications recorded yet</p>
                                                    <p class="mt-1 text-sm text-muted-foreground">Use this list for active home medication, chronic therapy, discharge medication, and ongoing treatment context.</p>
                                                </div>
                                                <div v-else class="space-y-3">
                                                    <div
                                                        v-for="profile in patientMedicationProfile"
                                                        :key="profile.id"
                                                        class="rounded-lg border bg-background px-4 py-3"
                                                    >
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
                                                            <Button
                                                                v-if="canUpdatePatients"
                                                                size="sm"
                                                                variant="ghost"
                                                                class="gap-1.5"
                                                                @click="openMedicationProfileDialog(profile)"
                                                            >
                                                                <AppIcon name="pencil" class="size-3.5" />Edit
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <Card
                                        :id="medicationWorkspaceSectionIds.reconciliation"
                                        class="rounded-lg scroll-mt-24"
                                    >
                                        <CardHeader class="pb-3">
                                            <CardTitle>Medication reconciliation</CardTitle>
                                            <CardDescription>Review what is on the current medication list, what has been dispensed, and what still needs reconciliation follow-up.</CardDescription>
                                        </CardHeader>
                                        <CardContent class="space-y-4">
                                            <div v-if="patientMedicationReconciliationLoading" class="space-y-3">
                                                <Skeleton class="h-24 w-full rounded-lg" />
                                                <Skeleton class="h-24 w-full rounded-lg" />
                                            </div>
                                            <Alert v-else-if="patientMedicationReconciliationError" variant="destructive">
                                                <AlertTitle>Reconciliation workspace unavailable</AlertTitle>
                                                <AlertDescription>{{ patientMedicationReconciliationError }}</AlertDescription>
                                            </Alert>
                                            <template v-else-if="patientMedicationReconciliation">
                                                <Alert v-if="patientMedicationReconciliation.suggestedActions.length > 0">
                                                    <AlertTitle>Reconciliation focus</AlertTitle>
                                                    <AlertDescription>
                                                        {{ patientMedicationReconciliation.suggestedActions[0] }}
                                                    </AlertDescription>
                                                </Alert>

                                                <div class="grid gap-4 xl:grid-cols-3">
                                                    <div class="rounded-lg border bg-muted/10 px-4 py-3">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Unreconciled dispensed orders</p>
                                                        <p class="mt-1.5 text-lg font-semibold text-foreground">{{ patientMedicationReconciliation.unreconciledDispensedOrders.length }}</p>
                                                    </div>
                                                    <div class="rounded-lg border bg-muted/10 px-4 py-3">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Continue candidates</p>
                                                        <p class="mt-1.5 text-lg font-semibold text-foreground">{{ patientMedicationReconciliation.continueCandidates.length }}</p>
                                                    </div>
                                                    <div class="rounded-lg border bg-muted/10 px-4 py-3">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">List review needed</p>
                                                        <p class="mt-1.5 text-lg font-semibold text-foreground">{{ patientMedicationReconciliation.profileWithoutDispensedOrders.length + patientMedicationReconciliation.newOrdersToProfile.length }}</p>
                                                    </div>
                                                </div>

                                                <div class="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
                                                    <div class="space-y-3 rounded-lg border bg-background px-4 py-4">
                                                        <div>
                                                            <p class="text-sm font-semibold text-foreground">Unreconciled dispensed orders</p>
                                                            <p class="mt-1 text-xs text-muted-foreground">Released therapy that still needs current medication list reconciliation.</p>
                                                        </div>
                                                        <div v-if="patientMedicationReconciliation.unreconciledDispensedOrders.length === 0" class="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                                                            No unreconciled dispensed orders.
                                                        </div>
                                                        <div v-else class="space-y-2">
                                                            <div
                                                                v-for="order in patientMedicationReconciliation.unreconciledDispensedOrders"
                                                                :key="`recon-order-${order.id}`"
                                                                class="rounded-lg border bg-muted/10 px-3 py-3"
                                                            >
                                                                <div class="flex items-start justify-between gap-3">
                                                                    <div class="min-w-0">
                                                                        <p class="text-sm font-medium text-foreground">{{ order.medicationName || 'Medication order' }}</p>
                                                                        <p class="mt-1 text-xs text-muted-foreground">{{ order.orderNumber || 'Order pending number' }} | Dispensed {{ formatDateTime(order.dispensedAt) }}</p>
                                                                    </div>
                                                                    <Button
                                                                        v-if="canUpdatePatients"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                        @click="openMedicationProfileDialogFromOrder(order, 'add')"
                                                                    >
                                                                        <AppIcon name="pill" class="size-3.5" />
                                                                        Update list
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
                                                        <div v-if="patientMedicationReconciliation.continueCandidates.length === 0" class="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                                                            No continue candidates are waiting.
                                                        </div>
                                                        <div v-else class="space-y-2">
                                                            <div
                                                                v-for="order in patientMedicationReconciliation.continueCandidates"
                                                                :key="`recon-continue-order-${order.id}`"
                                                                class="rounded-lg border bg-muted/10 px-3 py-3"
                                                            >
                                                                <div class="flex items-start justify-between gap-3">
                                                                    <div class="min-w-0">
                                                                        <p class="text-sm font-medium text-foreground">{{ order.medicationName || 'Medication order' }}</p>
                                                                        <p class="mt-1 text-xs text-muted-foreground">
                                                                            {{ order.orderNumber || 'Order pending number' }}
                                                                            <template v-if="order.dosageInstruction">
                                                                                | {{ order.dosageInstruction }}
                                                                            </template>
                                                                        </p>
                                                                    </div>
                                                                    <Button
                                                                        v-if="canUpdatePatients"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                        @click="openMedicationProfileDialogFromOrder(order, 'continue')"
                                                                    >
                                                                        <AppIcon name="refresh-cw" class="size-3.5" />
                                                                        Continue on list
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
                                                        <div v-if="patientMedicationReconciliation.profileWithoutDispensedOrders.length === 0" class="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                                                            No unmatched active current medication entries.
                                                        </div>
                                                        <div v-else class="space-y-2">
                                                            <div
                                                                v-for="profile in patientMedicationReconciliation.profileWithoutDispensedOrders"
                                                                :key="`recon-profile-${profile.id}`"
                                                                class="rounded-lg border bg-muted/10 px-3 py-3"
                                                            >
                                                                <div class="flex items-start justify-between gap-3">
                                                                    <div class="min-w-0">
                                                                        <p class="text-sm font-medium text-foreground">{{ profile.medicationName || 'Profile entry' }}</p>
                                                                        <p class="mt-1 text-xs text-muted-foreground">{{ medicationProfileLine(profile) }}</p>
                                                                    </div>
                                                                    <Button
                                                                        v-if="canUpdatePatients"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                        :disabled="isMedicationWorkspaceActionLoading(`profile-review:${profile.id}`)"
                                                                        @click="quickReconcileMedicationProfile(profile)"
                                                                    >
                                                                        <AppIcon name="check" class="size-3.5" />
                                                                        {{
                                                                            isMedicationWorkspaceActionLoading(`profile-review:${profile.id}`)
                                                                                ? 'Saving...'
                                                                                : 'Mark list reviewed'
                                                                        }}
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
                                                        <div v-if="patientMedicationReconciliation.newOrdersToProfile.length === 0" class="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                                                            No newly dispensed therapy needs list addition.
                                                        </div>
                                                        <div v-else class="space-y-2">
                                                            <div
                                                                v-for="order in patientMedicationReconciliation.newOrdersToProfile"
                                                                :key="`recon-new-order-${order.id}`"
                                                                class="rounded-lg border bg-muted/10 px-3 py-3"
                                                            >
                                                                <div class="flex items-start justify-between gap-3">
                                                                    <div class="min-w-0">
                                                                        <p class="text-sm font-medium text-foreground">{{ order.medicationName || 'Medication order' }}</p>
                                                                        <p class="mt-1 text-xs text-muted-foreground">{{ order.orderNumber || 'Order pending number' }} | Dispensed {{ formatDateTime(order.dispensedAt) }}</p>
                                                                    </div>
                                                                    <Button
                                                                        v-if="canUpdatePatients"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                        @click="openMedicationProfileDialogFromOrder(order, 'add')"
                                                                    >
                                                                        <AppIcon name="plus" class="size-3.5" />
                                                                        Add to list
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

                                <TabsContent value="orders" class="space-y-6">
                                    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Orders &amp; Results</p>
                                            <p class="text-sm text-muted-foreground">Track downstream care from this chart without losing patient or visit context.</p>
                                        </div>
                                        <div class="flex flex-wrap gap-2">
                                            <Button v-if="canCreateLaboratoryOrders" size="sm" class="gap-1.5" as-child>
                                                <Link :href="clinicalModuleHref('/laboratory-orders', { includeTabNew: true })"><AppIcon name="flask-conical" class="size-3.5" />Order lab</Link>
                                            </Button>
                                            <Button v-if="canCreateRadiologyOrders" size="sm" variant="outline" class="gap-1.5" as-child>
                                                <Link :href="clinicalModuleHref('/radiology-orders', { includeTabNew: true })"><AppIcon name="activity" class="size-3.5" />Order imaging</Link>
                                            </Button>
                                            <Button v-if="canCreatePharmacyOrders" size="sm" variant="outline" class="gap-1.5" as-child>
                                                <Link :href="clinicalModuleHref('/pharmacy-orders', { includeTabNew: true })"><AppIcon name="pill" class="size-3.5" />Order pharmacy</Link>
                                            </Button>
                                            <Button v-if="canCreateTheatreProcedures" size="sm" variant="outline" class="gap-1.5" as-child>
                                                <Link :href="clinicalModuleHref('/theatre-procedures', { includeTabNew: true })"><AppIcon name="scissors" class="size-3.5" />Schedule procedure</Link>
                                            </Button>
                                        </div>
                                    </div>

                                    <Alert>
                                        <AlertTitle>{{ careWorkspaceContext.title }}</AlertTitle>
                                        <AlertDescription>{{ careWorkspaceContext.summary }}</AlertDescription>
                                    </Alert>

                                    <div class="rounded-lg border bg-muted/10 px-4 py-3">
                                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div class="space-y-1">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Care launch context</p>
                                                <p class="text-sm text-foreground">{{ careWorkspaceContext.meta }}</p>
                                            </div>
                                            <div v-if="canReadAppointments" class="flex flex-wrap gap-2">
                                                <Button size="sm" variant="outline" class="gap-1.5" @click="activeTab = 'visits'">
                                                    <AppIcon name="calendar-clock" class="size-3.5" />Review encounter focus
                                                </Button>
                                                <Button size="sm" variant="ghost" class="gap-1.5" as-child>
                                                    <Link :href="appointmentsWorkspaceHref"><AppIcon name="book-open" class="size-3.5" />{{ visitWorkspaceActionLabel }}</Link>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="rounded-lg border bg-background px-4 py-3">
                                        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div class="space-y-1">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">View scope</p>
                                                <p class="text-sm text-foreground">{{ ordersWorkspaceScopeSummary }}</p>
                                                <p class="text-xs text-muted-foreground">{{ ordersWorkspaceScopeHint }}</p>
                                            </div>
                                            <div class="inline-flex w-full rounded-lg border bg-muted/20 p-1 sm:w-auto">
                                                <template v-if="availableOrdersWorkspaceScopes.length > 1">
                                                    <Button
                                                        v-if="availableOrdersWorkspaceScopes.includes('focused')"
                                                        size="sm"
                                                        :variant="ordersWorkspaceScope === 'focused' ? 'default' : 'ghost'"
                                                        class="flex-1 gap-1.5 rounded-md sm:flex-none"
                                                        @click="ordersWorkspaceScope = 'focused'"
                                                    >
                                                        <AppIcon name="calendar-clock" class="size-3.5" />
                                                        Focused visit
                                                    </Button>
                                                    <Button
                                                        v-if="availableOrdersWorkspaceScopes.includes('current')"
                                                        size="sm"
                                                        :variant="ordersWorkspaceScope === 'current' ? 'default' : 'ghost'"
                                                        class="flex-1 gap-1.5 rounded-md sm:flex-none"
                                                        @click="ordersWorkspaceScope = 'current'"
                                                    >
                                                        <AppIcon name="stethoscope" class="size-3.5" />
                                                        Current care
                                                    </Button>
                                                    <Button
                                                        v-if="availableOrdersWorkspaceScopes.includes('history')"
                                                        size="sm"
                                                        :variant="ordersWorkspaceScope === 'history' ? 'default' : 'ghost'"
                                                        class="flex-1 gap-1.5 rounded-md sm:flex-none"
                                                        @click="ordersWorkspaceScope = 'history'"
                                                    >
                                                        <AppIcon name="book-open" class="size-3.5" />
                                                        All visits
                                                    </Button>
                                                </template>
                                                <div
                                                    v-else
                                                    class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground"
                                                >
                                                    <AppIcon
                                                        :name="availableOrdersWorkspaceScopes[0] === 'current' ? 'stethoscope' : availableOrdersWorkspaceScopes[0] === 'focused' ? 'calendar-clock' : 'book-open'"
                                                        class="size-3.5"
                                                    />
                                                    {{
                                                        availableOrdersWorkspaceScopes[0] === 'current'
                                                            ? 'Current care only'
                                                            : availableOrdersWorkspaceScopes[0] === 'focused'
                                                              ? 'Focused visit only'
                                                              : 'All visits only'
                                                    }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <Alert v-if="!hasOrdersAndResultsAccess" variant="default">
                                        <AlertTitle>Orders workspace permissions required</AlertTitle>
                                        <AlertDescription>This chart can still show visits and notes, but the clinical orders workspace requires at least one read permission for laboratory, radiology, pharmacy, or theatre procedures.</AlertDescription>
                                    </Alert>

                                    <div v-else class="space-y-6">
                                        <Tabs v-model="ordersWorkspaceTab" class="space-y-4">
                                            <TabsList class="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 xl:grid-cols-4">
                                                <TabsTrigger
                                                    v-if="canReadLaboratoryOrders"
                                                    value="laboratory"
                                                    class="h-auto flex-col items-start rounded-lg border bg-muted/20 px-3 py-3 text-left data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5"
                                                >
                                                    <span class="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                                        <AppIcon name="flask-conical" class="size-3.5" />
                                                        Laboratory
                                                    </span>
                                                    <span class="mt-1 text-xs text-muted-foreground">
                                                        {{ careCounts.labActive }} active | {{ careCounts.labCompleted }} completed
                                                    </span>
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    v-if="canReadRadiologyOrders"
                                                    value="imaging"
                                                    class="h-auto flex-col items-start rounded-lg border bg-muted/20 px-3 py-3 text-left data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5"
                                                >
                                                    <span class="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                                        <AppIcon name="activity" class="size-3.5" />
                                                        Imaging
                                                    </span>
                                                    <span class="mt-1 text-xs text-muted-foreground">
                                                        {{ careCounts.imagingActive }} active | {{ careCounts.imagingCompleted }} reported
                                                    </span>
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    v-if="canReadPharmacyOrders"
                                                    value="pharmacy"
                                                    class="h-auto flex-col items-start rounded-lg border bg-muted/20 px-3 py-3 text-left data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5"
                                                >
                                                    <span class="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                                        <AppIcon name="pill" class="size-3.5" />
                                                        Pharmacy
                                                    </span>
                                                    <span class="mt-1 text-xs text-muted-foreground">
                                                        {{ careCounts.pharmacyActive }} active | {{ careCounts.pharmacyDispensed }} dispensed
                                                    </span>
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    v-if="canReadTheatreProcedures"
                                                    value="procedures"
                                                    class="h-auto flex-col items-start rounded-lg border bg-muted/20 px-3 py-3 text-left data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5"
                                                >
                                                    <span class="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                                        <AppIcon name="scissors" class="size-3.5" />
                                                        Procedures
                                                    </span>
                                                    <span class="mt-1 text-xs text-muted-foreground">
                                                        {{ careCounts.procedureActive }} active | {{ careCounts.procedureCompleted }} completed
                                                    </span>
                                                </TabsTrigger>
                                            </TabsList>

                                            <TabsContent v-if="canReadLaboratoryOrders" value="laboratory" class="mt-0">
                                                <Card class="rounded-lg">
                                                <CardHeader class="pb-3">
                                                    <CardTitle>Laboratory</CardTitle>
                                                </CardHeader>
                                                <CardContent class="space-y-4">
                                                    <div class="grid gap-3 sm:grid-cols-2">
                                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Active</p>
                                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ careCounts.labActive }}</p>
                                                        </div>
                                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Completed</p>
                                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ careCounts.labCompleted }}</p>
                                                        </div>
                                                    </div>
                                                    <div class="rounded-lg border bg-muted/10 px-3 py-3">
                                                        <template v-if="laboratoryOrdersLoading">
                                                            <Skeleton class="h-4 w-40 rounded-lg" />
                                                            <Skeleton class="mt-2 h-3 w-full rounded-lg" />
                                                        </template>
                                                        <template v-else-if="laboratoryOrdersError">
                                                            <p class="text-sm text-destructive">{{ laboratoryOrdersError }}</p>
                                                        </template>
                                                        <template v-else-if="scopedLaboratoryOrders.length === 0">
                                                            <p class="text-sm font-medium text-foreground">
                                                                {{
                                                                    useFocusedVisitOrdersScope
                                                                        ? 'No laboratory orders linked to this visit yet'
                                                                        : useCurrentOrdersScope
                                                                          ? 'No current laboratory work'
                                                                          : 'No laboratory orders yet'
                                                                }}
                                                            </p>
                                                            <p class="mt-1 text-xs text-muted-foreground">
                                                                {{
                                                                    useFocusedVisitOrdersScope
                                                                        ? 'Switch to All visits if you need prior laboratory work while this visit is still being built.'
                                                                        : useCurrentOrdersScope
                                                                          ? 'Recent or active laboratory work will surface here once investigations are ordered or results are recorded.'
                                                                          : 'Order investigations from the active visit when the clinician needs lab support.'
                                                                }}
                                                            </p>
                                                        </template>
                                                        <template v-else>
                                                            <div class="space-y-3">
                                                                <div>
                                                                    <p class="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                                                        {{ displayedLaboratoryOrdersScopeLabel }}
                                                                    </p>
                                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                                        {{ displayedLaboratoryOrdersScopeDescription }}
                                                                    </p>
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <div
                                                                        v-for="order in displayedLaboratoryOrders"
                                                                        :key="`chart-lab-order-${order.id}`"
                                                                        :class="['rounded-lg border px-3 py-2.5', laboratoryClinicalSignal(order).surfaceClass]"
                                                                    >
                                                                        <div class="flex items-start justify-between gap-2">
                                                                            <div class="min-w-0">
                                                                                <p class="truncate text-sm font-medium text-foreground">
                                                                                    {{ order.testName || 'Laboratory order' }}
                                                                                </p>
                                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                                    {{ order.orderNumber || 'Order number pending' }}
                                                                                    |
                                                                                    Ordered {{ formatDateTime(order.orderedAt) }}
                                                                                </p>
                                                                            </div>
                                                                            <Badge :variant="workflowStatusVariant(order.status)">
                                                                                {{ formatEnumLabel(order.status || 'ordered') }}
                                                                            </Badge>
                                                                        </div>
                                                                        <div class="mt-2 flex flex-wrap items-center gap-2">
                                                                            <Badge :variant="laboratoryClinicalSignal(order).variant">
                                                                                {{ laboratoryClinicalSignal(order).label }}
                                                                            </Badge>
                                                                            <span class="text-[11px] text-muted-foreground">
                                                                                {{
                                                                                    order.resultedAt
                                                                                        ? `Resulted ${formatDateTime(order.resultedAt)}`
                                                                                        : order.priority
                                                                                          ? `Priority: ${formatEnumLabel(order.priority)}`
                                                                                          : 'Routine queue unless marked urgent.'
                                                                                }}
                                                                            </span>
                                                                        </div>
                                                                        <p class="mt-2 text-xs text-muted-foreground">
                                                                            {{
                                                                                order.resultSummary
                                                                                    ? truncatePlainText(order.resultSummary, 220)
                                                                                    : 'Awaiting result entry or verification.'
                                                                            }}
                                                                        </p>
                                                                        <p
                                                                            v-if="lifecycleLinkageText(order, 'laboratory order')"
                                                                            class="mt-1 text-[11px] text-muted-foreground"
                                                                        >
                                                                            {{ lifecycleLinkageText(order, 'laboratory order') }}
                                                                        </p>
                                                                        <div
                                                                            v-if="
                                                                                (canReadLaboratoryOrders && currentCareNextAction('laboratory', order))
                                                                                || canCreateLaboratoryEncounterFollowOnOrder(order)
                                                                                || hasLaboratoryEncounterMoreActions(order)
                                                                            "
                                                                            class="mt-3 flex flex-wrap items-center gap-2"
                                                                        >
                                                                            <Button
                                                                                v-if="canReadLaboratoryOrders && currentCareNextAction('laboratory', order)"
                                                                                size="sm"
                                                                                :variant="currentCareNextActionVariant(currentCareNextAction('laboratory', order))"
                                                                                as-child
                                                                                class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            >
                                                                                <Link :href="currentCareNextActionHref('laboratory', order)">
                                                                                    <AppIcon :name="currentCareNextActionIcon('laboratory')" class="size-3.5" />
                                                                                    {{ currentCareNextAction('laboratory', order)?.label }}
                                                                                </Link>
                                                                            </Button>
                                                                            <Button
                                                                                v-if="canCreateLaboratoryEncounterFollowOnOrder(order)"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                as-child
                                                                                class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            >
                                                                                <Link
                                                                                    :href="clinicalModuleHref('/laboratory-orders', {
                                                                                        includeTabNew: true,
                                                                                        reorderOfId: order.id,
                                                                                    })"
                                                                                >
                                                                                    Reorder
                                                                                </Link>
                                                                            </Button>
                                                                            <Button
                                                                                v-if="canCreateLaboratoryEncounterFollowOnOrder(order)"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                as-child
                                                                                class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            >
                                                                                <Link
                                                                                    :href="clinicalModuleHref('/laboratory-orders', {
                                                                                        includeTabNew: true,
                                                                                        addOnToOrderId: order.id,
                                                                                    })"
                                                                                >
                                                                                    Add linked test
                                                                                </Link>
                                                                            </Button>
                                                                            <DropdownMenu v-if="hasLaboratoryEncounterMoreActions(order)">
                                                                                <DropdownMenuTrigger as-child>
                                                                                    <Button size="sm" variant="outline" class="h-7 gap-1.5 px-2.5 text-[11px]">
                                                                                        More
                                                                                    </Button>
                                                                                </DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="start" class="w-48">
                                                                                    <DropdownMenuItem
                                                                                        v-if="canApplyLaboratoryEncounterLifecycleAction(order, 'cancel')"
                                                                                        class="cursor-pointer text-sm"
                                                                                        @select="openEncounterLifecycleDialog('laboratory', order.id, 'cancel', order.statusReason)"
                                                                                    >
                                                                                        {{ encounterLifecycleActionLabel('cancel') }}
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuSeparator
                                                                                        v-if="
                                                                                            canApplyLaboratoryEncounterLifecycleAction(order, 'cancel')
                                                                                            && canApplyLaboratoryEncounterLifecycleAction(order, 'entered_in_error')
                                                                                        "
                                                                                    />
                                                                                    <DropdownMenuItem
                                                                                        v-if="canApplyLaboratoryEncounterLifecycleAction(order, 'entered_in_error')"
                                                                                        class="cursor-pointer text-sm"
                                                                                        @select="openEncounterLifecycleDialog('laboratory', order.id, 'entered_in_error')"
                                                                                    >
                                                                                        {{ encounterLifecycleActionLabel('entered_in_error') }}
                                                                                    </DropdownMenuItem>
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        </div>
                                                                        <p
                                                                            v-if="currentCareWorkflowHint(order)"
                                                                            class="mt-2 text-[11px] leading-4 text-muted-foreground"
                                                                        >
                                                                            {{ currentCareWorkflowHint(order) }}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </template>
                                                    </div>
                                                    <div class="flex flex-wrap gap-2 border-t pt-3">
                                                        <Button v-if="canCreateLaboratoryOrders" size="sm" class="gap-1.5" as-child>
                                                            <Link :href="clinicalModuleHref('/laboratory-orders', { includeTabNew: true })"><AppIcon name="flask-conical" class="size-3.5" />Order lab</Link>
                                                        </Button>
                                                        <Button v-if="canReadLaboratoryOrders" size="sm" variant="outline" class="gap-1.5" as-child>
                                                            <Link :href="clinicalModuleHref('/laboratory-orders', { includeAppointment: false })"><AppIcon name="book-open" class="size-3.5" />Open lab list</Link>
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                        </TabsContent>

                                        <TabsContent v-if="canReadRadiologyOrders" value="imaging" class="mt-0">

                                            <Card class="rounded-lg">
                                                <CardHeader class="pb-3">
                                                    <CardTitle>Imaging</CardTitle>
                                                </CardHeader>
                                                <CardContent class="space-y-4">
                                                    <div class="grid gap-3 sm:grid-cols-2">
                                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Active</p>
                                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ careCounts.imagingActive }}</p>
                                                        </div>
                                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Reported</p>
                                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ careCounts.imagingCompleted }}</p>
                                                        </div>
                                                    </div>
                                                    <div class="rounded-lg border bg-muted/10 px-3 py-3">
                                                        <template v-if="radiologyOrdersLoading">
                                                            <Skeleton class="h-4 w-40 rounded-lg" />
                                                            <Skeleton class="mt-2 h-3 w-full rounded-lg" />
                                                        </template>
                                                        <template v-else-if="radiologyOrdersError">
                                                            <p class="text-sm text-destructive">{{ radiologyOrdersError }}</p>
                                                        </template>
                                                        <template v-else-if="scopedRadiologyOrders.length === 0">
                                                            <p class="text-sm font-medium text-foreground">
                                                                {{
                                                                    useFocusedVisitOrdersScope
                                                                        ? 'No imaging orders linked to this visit yet'
                                                                        : useCurrentOrdersScope
                                                                          ? 'No current imaging work'
                                                                          : 'No imaging orders yet'
                                                                }}
                                                            </p>
                                                            <p class="mt-1 text-xs text-muted-foreground">
                                                                {{
                                                                    useFocusedVisitOrdersScope
                                                                        ? 'Switch to All visits if you need older imaging context while this visit is still being built.'
                                                                        : useCurrentOrdersScope
                                                                          ? 'Recent or active imaging requests and reports will surface here once imaging work is underway.'
                                                                          : 'Use imaging when the patient needs a study during the current encounter.'
                                                                }}
                                                            </p>
                                                        </template>
                                                        <template v-else>
                                                            <div class="space-y-3">
                                                                <div>
                                                                    <p class="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                                                        {{ displayedRadiologyOrdersScopeLabel }}
                                                                    </p>
                                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                                        {{ displayedRadiologyOrdersScopeDescription }}
                                                                    </p>
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <div
                                                                        v-for="order in displayedRadiologyOrders"
                                                                        :key="`chart-radiology-order-${order.id}`"
                                                                        :class="['rounded-lg border px-3 py-2.5', radiologyClinicalSignal(order).surfaceClass]"
                                                                    >
                                                                        <div class="flex items-start justify-between gap-2">
                                                                            <div class="min-w-0">
                                                                                <p class="truncate text-sm font-medium text-foreground">
                                                                                    {{ order.studyDescription || 'Imaging order' }}
                                                                                </p>
                                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                                    {{ order.orderNumber || 'Order number pending' }}
                                                                                    |
                                                                                    Ordered {{ formatDateTime(order.orderedAt) }}
                                                                                </p>
                                                                            </div>
                                                                            <Badge :variant="workflowStatusVariant(order.status)">
                                                                                {{ formatEnumLabel(order.status || 'ordered') }}
                                                                            </Badge>
                                                                        </div>
                                                                        <div class="mt-2 flex flex-wrap items-center gap-2">
                                                                            <Badge :variant="radiologyClinicalSignal(order).variant">
                                                                                {{ radiologyClinicalSignal(order).label }}
                                                                            </Badge>
                                                                            <span class="text-[11px] text-muted-foreground">
                                                                                {{
                                                                                    order.completedAt
                                                                                        ? `Reported ${formatDateTime(order.completedAt)}`
                                                                                        : order.modality
                                                                                          ? `Modality: ${formatEnumLabel(order.modality)}`
                                                                                          : 'Awaiting imaging scheduling or execution.'
                                                                                }}
                                                                            </span>
                                                                        </div>
                                                                        <p class="mt-2 text-xs text-muted-foreground">
                                                                            {{
                                                                                order.reportSummary
                                                                                    ? truncatePlainText(order.reportSummary, 220)
                                                                                    : 'Awaiting imaging scheduling, execution, or report entry.'
                                                                            }}
                                                                        </p>
                                                                        <p
                                                                            v-if="lifecycleLinkageText(order, 'imaging order')"
                                                                            class="mt-1 text-[11px] text-muted-foreground"
                                                                        >
                                                                            {{ lifecycleLinkageText(order, 'imaging order') }}
                                                                        </p>
                                                                        <div
                                                                            v-if="
                                                                                (canReadRadiologyOrders && currentCareNextAction('radiology', order))
                                                                                || canCreateRadiologyEncounterFollowOnOrder(order)
                                                                                || hasRadiologyEncounterMoreActions(order)
                                                                            "
                                                                            class="mt-3 flex flex-wrap items-center gap-2"
                                                                        >
                                                                            <Button
                                                                                v-if="canReadRadiologyOrders && currentCareNextAction('radiology', order)"
                                                                                size="sm"
                                                                                :variant="currentCareNextActionVariant(currentCareNextAction('radiology', order))"
                                                                                as-child
                                                                                class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            >
                                                                                <Link :href="currentCareNextActionHref('radiology', order)">
                                                                                    <AppIcon :name="currentCareNextActionIcon('radiology')" class="size-3.5" />
                                                                                    {{ currentCareNextAction('radiology', order)?.label }}
                                                                                </Link>
                                                                            </Button>
                                                                            <Button
                                                                                v-if="canCreateRadiologyEncounterFollowOnOrder(order)"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                as-child
                                                                                class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            >
                                                                                <Link
                                                                                    :href="clinicalModuleHref('/radiology-orders', {
                                                                                        includeTabNew: true,
                                                                                        reorderOfId: order.id,
                                                                                    })"
                                                                                >
                                                                                    Reorder
                                                                                </Link>
                                                                            </Button>
                                                                            <Button
                                                                                v-if="canCreateRadiologyEncounterFollowOnOrder(order)"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                as-child
                                                                                class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            >
                                                                                <Link
                                                                                    :href="clinicalModuleHref('/radiology-orders', {
                                                                                        includeTabNew: true,
                                                                                        addOnToOrderId: order.id,
                                                                                    })"
                                                                                >
                                                                                    Add linked study
                                                                                </Link>
                                                                            </Button>
                                                                            <DropdownMenu v-if="hasRadiologyEncounterMoreActions(order)">
                                                                                <DropdownMenuTrigger as-child>
                                                                                    <Button size="sm" variant="outline" class="h-7 gap-1.5 px-2.5 text-[11px]">
                                                                                        More
                                                                                    </Button>
                                                                                </DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="start" class="w-48">
                                                                                    <DropdownMenuItem
                                                                                        v-if="canApplyRadiologyEncounterLifecycleAction(order, 'cancel')"
                                                                                        class="cursor-pointer text-sm"
                                                                                        @select="openEncounterLifecycleDialog('radiology', order.id, 'cancel', order.statusReason)"
                                                                                    >
                                                                                        {{ encounterLifecycleActionLabel('cancel') }}
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuSeparator
                                                                                        v-if="
                                                                                            canApplyRadiologyEncounterLifecycleAction(order, 'cancel')
                                                                                            && canApplyRadiologyEncounterLifecycleAction(order, 'entered_in_error')
                                                                                        "
                                                                                    />
                                                                                    <DropdownMenuItem
                                                                                        v-if="canApplyRadiologyEncounterLifecycleAction(order, 'entered_in_error')"
                                                                                        class="cursor-pointer text-sm"
                                                                                        @select="openEncounterLifecycleDialog('radiology', order.id, 'entered_in_error')"
                                                                                    >
                                                                                        {{ encounterLifecycleActionLabel('entered_in_error') }}
                                                                                    </DropdownMenuItem>
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        </div>
                                                                        <p
                                                                            v-if="currentCareWorkflowHint(order)"
                                                                            class="mt-2 text-[11px] leading-4 text-muted-foreground"
                                                                        >
                                                                            {{ currentCareWorkflowHint(order) }}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </template>
                                                    </div>
                                                    <div class="flex flex-wrap gap-2 border-t pt-3">
                                                        <Button v-if="canCreateRadiologyOrders" size="sm" class="gap-1.5" as-child>
                                                            <Link :href="clinicalModuleHref('/radiology-orders', { includeTabNew: true })"><AppIcon name="activity" class="size-3.5" />Order imaging</Link>
                                                        </Button>
                                                        <Button v-if="canReadRadiologyOrders" size="sm" variant="outline" class="gap-1.5" as-child>
                                                            <Link :href="clinicalModuleHref('/radiology-orders', { includeAppointment: false })"><AppIcon name="book-open" class="size-3.5" />Open imaging list</Link>
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </TabsContent>

                                        <TabsContent v-if="canReadTheatreProcedures" value="procedures" class="mt-0">
                                            <Card class="rounded-lg">
                                                <CardHeader class="pb-3">
                                                    <CardTitle>Procedures</CardTitle>
                                                </CardHeader>
                                                <CardContent class="space-y-4">
                                                    <div class="grid gap-3 sm:grid-cols-2">
                                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Active</p>
                                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ careCounts.procedureActive }}</p>
                                                        </div>
                                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Completed</p>
                                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ careCounts.procedureCompleted }}</p>
                                                        </div>
                                                    </div>
                                                    <div class="rounded-lg border bg-muted/10 px-3 py-3">
                                                        <template v-if="theatreProceduresLoading">
                                                            <Skeleton class="h-4 w-40 rounded-lg" />
                                                            <Skeleton class="mt-2 h-3 w-full rounded-lg" />
                                                        </template>
                                                        <template v-else-if="theatreProceduresError">
                                                            <p class="text-sm text-destructive">{{ theatreProceduresError }}</p>
                                                        </template>
                                                        <template v-else-if="scopedTheatreProcedures.length === 0">
                                                            <p class="text-sm font-medium text-foreground">
                                                                {{
                                                                    useFocusedVisitOrdersScope
                                                                        ? 'No procedures linked to this visit yet'
                                                                        : useCurrentOrdersScope
                                                                          ? 'No current procedures'
                                                                          : 'No procedures yet'
                                                                }}
                                                            </p>
                                                            <p class="mt-1 text-xs text-muted-foreground">
                                                                {{
                                                                    useFocusedVisitOrdersScope
                                                                        ? 'Switch to All visits if you need prior procedure context while this visit is still being built.'
                                                                        : useCurrentOrdersScope
                                                                          ? 'Planned, active, or recently completed procedures will surface here once procedural care is underway.'
                                                                          : 'Schedule a theatre procedure when the patient needs operative or procedure-room care during the current encounter.'
                                                                }}
                                                            </p>
                                                        </template>
                                                        <template v-else>
                                                            <div class="space-y-3">
                                                                <div>
                                                                    <p class="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                                                        {{ displayedTheatreProceduresScopeLabel }}
                                                                    </p>
                                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                                        {{ displayedTheatreProceduresScopeDescription }}
                                                                    </p>
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <div
                                                                        v-for="procedure in displayedTheatreProcedures"
                                                                        :key="`chart-theatre-procedure-${procedure.id}`"
                                                                        class="rounded-lg border bg-background px-3 py-2.5"
                                                                    >
                                                                        <div class="flex items-start justify-between gap-2">
                                                                            <div class="min-w-0">
                                                                                <p class="truncate text-sm font-medium text-foreground">
                                                                                    {{ procedure.procedureName || procedure.procedureType || 'Theatre procedure' }}
                                                                                </p>
                                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                                    {{ procedure.procedureNumber || 'Procedure number pending' }}
                                                                                    |
                                                                                    Scheduled {{ formatDateTime(procedure.scheduledAt) }}
                                                                                </p>
                                                                            </div>
                                                                            <Badge :variant="workflowStatusVariant(procedure.status)">
                                                                                {{ formatEnumLabel(procedure.status || 'planned') }}
                                                                            </Badge>
                                                                        </div>
                                                                        <p class="mt-2 text-xs text-muted-foreground">
                                                                            {{
                                                                                procedure.statusReason
                                                                                    ? procedure.statusReason
                                                                                    : procedure.notes
                                                                                      ? procedure.notes
                                                                                      : procedure.theatreRoomName
                                                                                        ? `Room: ${procedure.theatreRoomName}`
                                                                                        : 'Awaiting theatre progression.'
                                                                            }}
                                                                        </p>
                                                                        <p
                                                                            v-if="lifecycleLinkageText(procedure, 'procedure booking')"
                                                                            class="mt-1 text-[11px] text-muted-foreground"
                                                                        >
                                                                            {{ lifecycleLinkageText(procedure, 'procedure booking') }}
                                                                        </p>
                                                                        <div
                                                                            v-if="
                                                                                (canReadTheatreProcedures && currentCareNextAction('theatre', procedure))
                                                                                || canCreateTheatreEncounterFollowOnOrder(procedure)
                                                                                || hasTheatreEncounterMoreActions(procedure)
                                                                            "
                                                                            class="mt-3 flex flex-wrap items-center gap-2"
                                                                        >
                                                                            <Button
                                                                                v-if="canReadTheatreProcedures && currentCareNextAction('theatre', procedure)"
                                                                                size="sm"
                                                                                :variant="currentCareNextActionVariant(currentCareNextAction('theatre', procedure))"
                                                                                as-child
                                                                                class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            >
                                                                                <Link :href="currentCareNextActionHref('theatre', procedure)">
                                                                                    <AppIcon :name="currentCareNextActionIcon('theatre')" class="size-3.5" />
                                                                                    {{ currentCareNextAction('theatre', procedure)?.label }}
                                                                                </Link>
                                                                            </Button>
                                                                            <Button
                                                                                v-if="canCreateTheatreEncounterFollowOnOrder(procedure)"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                as-child
                                                                                class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            >
                                                                                <Link
                                                                                    :href="clinicalModuleHref('/theatre-procedures', {
                                                                                        includeTabNew: true,
                                                                                        reorderOfId: procedure.id,
                                                                                    })"
                                                                                >
                                                                                    Reorder
                                                                                </Link>
                                                                            </Button>
                                                                            <Button
                                                                                v-if="canCreateTheatreEncounterFollowOnOrder(procedure)"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                as-child
                                                                                class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            >
                                                                                <Link
                                                                                    :href="clinicalModuleHref('/theatre-procedures', {
                                                                                        includeTabNew: true,
                                                                                        addOnToOrderId: procedure.id,
                                                                                    })"
                                                                                >
                                                                                    Add linked procedure
                                                                                </Link>
                                                                            </Button>
                                                                            <DropdownMenu v-if="hasTheatreEncounterMoreActions(procedure)">
                                                                                <DropdownMenuTrigger as-child>
                                                                                    <Button size="sm" variant="outline" class="h-7 gap-1.5 px-2.5 text-[11px]">
                                                                                        More
                                                                                    </Button>
                                                                                </DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="start" class="w-48">
                                                                                    <DropdownMenuItem
                                                                                        v-if="canApplyTheatreEncounterLifecycleAction(procedure, 'cancel')"
                                                                                        class="cursor-pointer text-sm"
                                                                                        @select="openEncounterLifecycleDialog('theatre', procedure.id, 'cancel', procedure.statusReason)"
                                                                                    >
                                                                                        {{ encounterLifecycleActionLabel('cancel') }}
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuSeparator
                                                                                        v-if="
                                                                                            canApplyTheatreEncounterLifecycleAction(procedure, 'cancel')
                                                                                            && canApplyTheatreEncounterLifecycleAction(procedure, 'entered_in_error')
                                                                                        "
                                                                                    />
                                                                                    <DropdownMenuItem
                                                                                        v-if="canApplyTheatreEncounterLifecycleAction(procedure, 'entered_in_error')"
                                                                                        class="cursor-pointer text-sm"
                                                                                        @select="openEncounterLifecycleDialog('theatre', procedure.id, 'entered_in_error')"
                                                                                    >
                                                                                        {{ encounterLifecycleActionLabel('entered_in_error') }}
                                                                                    </DropdownMenuItem>
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        </div>
                                                                        <p
                                                                            v-if="currentCareWorkflowHint(procedure)"
                                                                            class="mt-2 text-[11px] leading-4 text-muted-foreground"
                                                                        >
                                                                            {{ currentCareWorkflowHint(procedure) }}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </template>
                                                    </div>
                                                    <div class="flex flex-wrap gap-2 border-t pt-3">
                                                        <Button v-if="canCreateTheatreProcedures" size="sm" class="gap-1.5" as-child>
                                                            <Link :href="clinicalModuleHref('/theatre-procedures', { includeTabNew: true })"><AppIcon name="scissors" class="size-3.5" />Schedule procedure</Link>
                                                        </Button>
                                                        <Button v-if="canReadTheatreProcedures" size="sm" variant="outline" class="gap-1.5" as-child>
                                                            <Link :href="clinicalModuleHref('/theatre-procedures', { includeAppointment: false })"><AppIcon name="book-open" class="size-3.5" />Open theatre list</Link>
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </TabsContent>

                                        <TabsContent v-if="canReadPharmacyOrders" value="pharmacy" class="mt-0">
                                            <Card class="rounded-lg">
                                                <CardHeader class="pb-3">
                                                    <CardTitle>Pharmacy</CardTitle>
                                                </CardHeader>
                                                <CardContent class="space-y-4">
                                                    <div class="grid gap-3 sm:grid-cols-2">
                                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Active</p>
                                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ careCounts.pharmacyActive }}</p>
                                                        </div>
                                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Dispensed</p>
                                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ careCounts.pharmacyDispensed }}</p>
                                                        </div>
                                                    </div>
                                                    <div class="rounded-lg border bg-muted/10 px-3 py-3">
                                                        <template v-if="pharmacyOrdersLoading">
                                                            <Skeleton class="h-4 w-40 rounded-lg" />
                                                            <Skeleton class="mt-2 h-3 w-full rounded-lg" />
                                                        </template>
                                                        <template v-else-if="pharmacyOrdersError">
                                                            <p class="text-sm text-destructive">{{ pharmacyOrdersError }}</p>
                                                        </template>
                                                        <template v-else-if="scopedPharmacyOrders.length === 0">
                                                            <p class="text-sm font-medium text-foreground">
                                                                {{
                                                                    useFocusedVisitOrdersScope
                                                                        ? 'No pharmacy orders linked to this visit yet'
                                                                        : useCurrentOrdersScope
                                                                          ? 'No current medication work'
                                                                          : 'No pharmacy orders yet'
                                                                }}
                                                            </p>
                                                            <p class="mt-1 text-xs text-muted-foreground">
                                                                {{
                                                                    useFocusedVisitOrdersScope
                                                                        ? 'Switch to All visits if you need older medication context while this visit is still being built.'
                                                                        : useCurrentOrdersScope
                                                                          ? 'Active medication orders, recent dispenses, and unreconciled medication work will surface here once prescribing begins.'
                                                                          : 'Medication orders will appear here once prescribed for this patient.'
                                                                }}
                                                            </p>
                                                        </template>
                                                        <template v-else>
                                                            <div class="space-y-3">
                                                                <div>
                                                                    <p class="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                                                        {{ displayedPharmacyOrdersScopeLabel }}
                                                                    </p>
                                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                                        {{ displayedPharmacyOrdersScopeDescription }}
                                                                    </p>
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <div
                                                                        v-for="order in displayedPharmacyOrders"
                                                                        :key="`chart-pharmacy-order-${order.id}`"
                                                                        class="rounded-lg border bg-background px-3 py-2.5"
                                                                    >
                                                                        <div class="flex items-start justify-between gap-2">
                                                                            <div class="min-w-0">
                                                                                <p class="truncate text-sm font-medium text-foreground">
                                                                                    {{ order.medicationName || 'Pharmacy order' }}
                                                                                </p>
                                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                                    {{ order.orderNumber || 'Order number pending' }}
                                                                                    <span
                                                                                        v-if="pharmacyOrderQuantityLabel(order.quantityPrescribed)"
                                                                                    >
                                                                                        |
                                                                                        {{ pharmacyOrderQuantityLabel(order.quantityPrescribed) }}
                                                                                    </span>
                                                                                    |
                                                                                    Ordered {{ formatDateTime(order.orderedAt) }}
                                                                                </p>
                                                                            </div>
                                                                            <Badge :variant="workflowStatusVariant(order.status)">
                                                                                {{ formatEnumLabel(order.status || 'pending') }}
                                                                            </Badge>
                                                                        </div>
                                                                        <p class="mt-2 text-xs text-muted-foreground">
                                                                            {{
                                                                                order.dosageInstruction
                                                                                    ? order.dosageInstruction
                                                                                    : order.dispensedAt
                                                                                      ? `Dispensed ${formatDateTime(order.dispensedAt)}`
                                                                                      : 'Awaiting pharmacy preparation.'
                                                                            }}
                                                                        </p>
                                                                        <div
                                                                            v-if="
                                                                                order.currentCare?.awaitingVerification
                                                                                || order.currentCare?.awaitingReconciliation
                                                                                || order.currentCare?.hasPolicyIssue
                                                                            "
                                                                            class="mt-2 flex flex-wrap items-center gap-2"
                                                                        >
                                                                            <Badge
                                                                                v-if="order.currentCare?.awaitingVerification"
                                                                                variant="secondary"
                                                                            >
                                                                                Awaiting verification
                                                                            </Badge>
                                                                            <Badge
                                                                                v-if="order.currentCare?.awaitingReconciliation"
                                                                                variant="secondary"
                                                                            >
                                                                                Awaiting reconciliation
                                                                            </Badge>
                                                                            <Badge
                                                                                v-if="order.currentCare?.hasPolicyIssue"
                                                                                variant="outline"
                                                                            >
                                                                                Policy review
                                                                            </Badge>
                                                                        </div>
                                                                        <p
                                                                            v-if="lifecycleLinkageText(order, 'medication order')"
                                                                            class="mt-1 text-[11px] text-muted-foreground"
                                                                        >
                                                                            {{ lifecycleLinkageText(order, 'medication order') }}
                                                                        </p>
                                                                        <div
                                                                            v-if="
                                                                                (canReadPharmacyOrders && currentCareNextAction('pharmacy', order))
                                                                                || canCreatePharmacyEncounterFollowOnOrder(order)
                                                                                || hasPharmacyEncounterMoreActions(order)
                                                                            "
                                                                            class="mt-3 flex flex-wrap items-center gap-2"
                                                                        >
                                                                            <Button
                                                                                v-if="canReadPharmacyOrders && currentCareNextAction('pharmacy', order)"
                                                                                size="sm"
                                                                                :variant="currentCareNextActionVariant(currentCareNextAction('pharmacy', order))"
                                                                                as-child
                                                                                class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            >
                                                                                <Link :href="currentCareNextActionHref('pharmacy', order)">
                                                                                    <AppIcon :name="currentCareNextActionIcon('pharmacy')" class="size-3.5" />
                                                                                    {{ currentCareNextAction('pharmacy', order)?.label }}
                                                                                </Link>
                                                                            </Button>
                                                                            <Button
                                                                                v-if="canCreatePharmacyEncounterFollowOnOrder(order)"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                as-child
                                                                                class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            >
                                                                                <Link
                                                                                    :href="clinicalModuleHref('/pharmacy-orders', {
                                                                                        includeTabNew: true,
                                                                                        reorderOfId: order.id,
                                                                                    })"
                                                                                >
                                                                                    Reorder
                                                                                </Link>
                                                                            </Button>
                                                                            <Button
                                                                                v-if="canCreatePharmacyEncounterFollowOnOrder(order)"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                as-child
                                                                                class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            >
                                                                                <Link
                                                                                    :href="clinicalModuleHref('/pharmacy-orders', {
                                                                                        includeTabNew: true,
                                                                                        addOnToOrderId: order.id,
                                                                                    })"
                                                                                >
                                                                                    Add linked medication
                                                                                </Link>
                                                                            </Button>
                                                                            <DropdownMenu v-if="hasPharmacyEncounterMoreActions(order)">
                                                                                <DropdownMenuTrigger as-child>
                                                                                    <Button size="sm" variant="outline" class="h-7 gap-1.5 px-2.5 text-[11px]">
                                                                                        More
                                                                                    </Button>
                                                                                </DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="start" class="w-48">
                                                                                    <DropdownMenuItem
                                                                                        v-if="canApplyPharmacyEncounterLifecycleAction(order, 'cancel')"
                                                                                        class="cursor-pointer text-sm"
                                                                                        @select="openEncounterLifecycleDialog('pharmacy', order.id, 'cancel', order.statusReason)"
                                                                                    >
                                                                                        {{ encounterLifecycleActionLabel('cancel') }}
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuItem
                                                                                        v-if="canApplyPharmacyEncounterLifecycleAction(order, 'discontinue')"
                                                                                        class="cursor-pointer text-sm"
                                                                                        @select="openEncounterLifecycleDialog('pharmacy', order.id, 'discontinue')"
                                                                                    >
                                                                                        {{ encounterLifecycleActionLabel('discontinue') }}
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuSeparator
                                                                                        v-if="
                                                                                            (
                                                                                                canApplyPharmacyEncounterLifecycleAction(order, 'cancel')
                                                                                                || canApplyPharmacyEncounterLifecycleAction(order, 'discontinue')
                                                                                            )
                                                                                            && canApplyPharmacyEncounterLifecycleAction(order, 'entered_in_error')
                                                                                        "
                                                                                    />
                                                                                    <DropdownMenuItem
                                                                                        v-if="canApplyPharmacyEncounterLifecycleAction(order, 'entered_in_error')"
                                                                                        class="cursor-pointer text-sm"
                                                                                        @select="openEncounterLifecycleDialog('pharmacy', order.id, 'entered_in_error')"
                                                                                    >
                                                                                        {{ encounterLifecycleActionLabel('entered_in_error') }}
                                                                                    </DropdownMenuItem>
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        </div>
                                                                        <p
                                                                            v-if="currentCareWorkflowHint(order)"
                                                                            class="mt-2 text-[11px] leading-4 text-muted-foreground"
                                                                        >
                                                                            {{ currentCareWorkflowHint(order) }}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </template>
                                                    </div>
                                                    <div class="flex flex-wrap gap-2 border-t pt-3">
                                                        <Button v-if="canCreatePharmacyOrders" size="sm" class="gap-1.5" as-child>
                                                            <Link :href="clinicalModuleHref('/pharmacy-orders', { includeTabNew: true })"><AppIcon name="pill" class="size-3.5" />Order pharmacy</Link>
                                                        </Button>
                                                        <Button v-if="canReadPharmacyOrders" size="sm" variant="outline" class="gap-1.5" as-child>
                                                            <Link :href="clinicalModuleHref('/pharmacy-orders', { includeAppointment: false })"><AppIcon name="book-open" class="size-3.5" />Open pharmacy list</Link>
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </TabsContent>
                                        </Tabs>

                                        <Card class="rounded-lg">
                                            <CardHeader class="pb-3">
                                                <CardTitle>Latest results &amp; reports</CardTitle>
                                            </CardHeader>
                                            <CardContent class="grid gap-4 lg:grid-cols-2">
                                                <div class="rounded-lg border bg-muted/10 px-4 py-4">
                                                    <div class="flex items-start justify-between gap-2">
                                                        <div>
                                                            <p class="text-sm font-medium text-foreground">Laboratory result</p>
                                                            <p class="mt-1 text-xs text-muted-foreground">Most recent completed laboratory signal in this chart.</p>
                                                        </div>
                                                        <Badge v-if="latestLaboratoryResult" :variant="workflowStatusVariant(latestLaboratoryResult.status)">{{ formatEnumLabel(latestLaboratoryResult.status || 'completed') }}</Badge>
                                                    </div>
                                                    <template v-if="latestLaboratoryResult">
                                                        <p class="mt-3 text-sm font-medium text-foreground">{{ latestLaboratoryResult.testName || 'Laboratory result summary' }}</p>
                                                        <p class="mt-1 text-xs text-muted-foreground">Resulted {{ formatDateTime(latestLaboratoryResult.resultedAt || latestLaboratoryResult.orderedAt) }}</p>
                                                        <p class="mt-3 text-sm text-foreground">{{ truncatePlainText(latestLaboratoryResult.resultSummary, 220) || 'No result summary recorded.' }}</p>
                                                    </template>
                                                    <template v-else>
                                                        <p class="mt-3 text-sm text-muted-foreground">No completed laboratory result has been recorded for this patient yet.</p>
                                                    </template>
                                                </div>
                                                <div class="rounded-lg border bg-muted/10 px-4 py-4">
                                                    <div class="flex items-start justify-between gap-2">
                                                        <div>
                                                            <p class="text-sm font-medium text-foreground">Imaging report</p>
                                                            <p class="mt-1 text-xs text-muted-foreground">Most recent completed imaging report in this chart.</p>
                                                        </div>
                                                        <Badge v-if="latestRadiologyReport" :variant="workflowStatusVariant(latestRadiologyReport.status)">{{ formatEnumLabel(latestRadiologyReport.status || 'completed') }}</Badge>
                                                    </div>
                                                    <template v-if="latestRadiologyReport">
                                                        <p class="mt-3 text-sm font-medium text-foreground">{{ latestRadiologyReport.studyDescription || 'Imaging report summary' }}</p>
                                                        <p class="mt-1 text-xs text-muted-foreground">Reported {{ formatDateTime(latestRadiologyReport.completedAt || latestRadiologyReport.orderedAt) }}</p>
                                                        <p class="mt-3 text-sm text-foreground">{{ truncatePlainText(latestRadiologyReport.reportSummary, 220) || 'No imaging report summary recorded.' }}</p>
                                                    </template>
                                                    <template v-else>
                                                        <p class="mt-3 text-sm text-muted-foreground">No completed imaging report has been recorded for this patient yet.</p>
                                                    </template>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>
                                <TabsContent value="billing" class="space-y-6">
                                    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Billing</p>
                                            <p class="text-sm text-muted-foreground">Review patient invoices without crowding the clinical orders workspace.</p>
                                        </div>
                                        <div class="flex flex-wrap gap-2">
                                            <Button v-if="canCreateBillingInvoices" size="sm" class="gap-1.5" as-child>
                                                <Link :href="clinicalModuleHref('/billing-invoices', { includeTabNew: true })"><AppIcon name="receipt" class="size-3.5" />Create invoice</Link>
                                            </Button>
                                            <Button v-if="canReadBillingInvoices" size="sm" variant="outline" class="gap-1.5" as-child>
                                                <Link :href="clinicalModuleHref('/billing-invoices', { includeAppointment: false })"><AppIcon name="book-open" class="size-3.5" />Open billing list</Link>
                                            </Button>
                                        </div>
                                    </div>

                                    <div class="rounded-lg border bg-muted/10 px-4 py-3">
                                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div class="space-y-1">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Billing context</p>
                                                <p class="text-sm text-foreground">Invoices launched from this chart stay linked to the patient and the visit currently in chart focus when one is available.</p>
                                            </div>
                                            <div v-if="canReadAppointments" class="flex flex-wrap gap-2">
                                                <Button size="sm" variant="outline" class="gap-1.5" @click="activeTab = 'visits'">
                                                    <AppIcon name="calendar-clock" class="size-3.5" />Review encounter focus
                                                </Button>
                                                <Button size="sm" variant="ghost" class="gap-1.5" as-child>
                                                    <Link :href="appointmentsWorkspaceHref"><AppIcon name="book-open" class="size-3.5" />{{ visitWorkspaceActionLabel }}</Link>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <Alert v-if="!hasBillingAccess" variant="default">
                                        <AlertTitle>Billing workspace permissions required</AlertTitle>
                                        <AlertDescription>This chart can still show visits and clinical activity, but billing actions require invoice read or create permission.</AlertDescription>
                                    </Alert>

                                    <div v-else class="space-y-6">
                                        <Alert v-if="!canReadBillingInvoices" variant="default">
                                            <AlertTitle>Invoice history is limited</AlertTitle>
                                            <AlertDescription>You can launch new billing work from this chart, but invoice history and balances require <code>billing.invoices.read</code>.</AlertDescription>
                                        </Alert>

                                        <Card v-if="canReadBillingInvoices" class="rounded-lg">
                                            <CardHeader class="pb-3">
                                                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <CardTitle>Invoice activity</CardTitle>
                                                        <CardDescription>
                                                            {{ displayedBillingInvoicesScopeDescription }}
                                                        </CardDescription>
                                                    </div>
                                                    <div class="grid gap-3 sm:grid-cols-2">
                                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Open</p>
                                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ careCounts.billingOpen }}</p>
                                                        </div>
                                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Paid</p>
                                                            <p class="mt-1.5 text-lg font-semibold text-foreground">{{ careCounts.billingSettled }}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-4">
                                                <div class="rounded-lg border bg-muted/10 px-3 py-3">
                                                    <template v-if="billingInvoicesLoading">
                                                        <Skeleton class="h-4 w-40 rounded-lg" />
                                                        <Skeleton class="mt-2 h-3 w-full rounded-lg" />
                                                    </template>
                                                    <template v-else-if="billingInvoicesError">
                                                        <p class="text-sm text-destructive">{{ billingInvoicesError }}</p>
                                                    </template>
                                                    <template v-else-if="billingInvoices.length === 0">
                                                        <p class="text-sm font-medium text-foreground">No invoices yet</p>
                                                        <p class="mt-1 text-xs text-muted-foreground">Billing follow-up will appear once services are invoiced for this patient.</p>
                                                    </template>
                                                    <template v-else>
                                                        <div class="space-y-3">
                                                            <div>
                                                                <p class="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                                                    {{ displayedBillingInvoicesScopeLabel }}
                                                                </p>
                                                            </div>
                                                            <div class="grid gap-2">
                                                                <div
                                                                    v-for="invoice in displayedBillingInvoices"
                                                                    :key="`chart-billing-invoice-${invoice.id}`"
                                                                    class="rounded-lg border bg-background px-3 py-2.5"
                                                                >
                                                                    <div class="flex items-start justify-between gap-2">
                                                                        <div class="min-w-0">
                                                                            <p class="truncate text-sm font-medium text-foreground">
                                                                                {{ invoice.invoiceNumber || 'Invoice pending number' }}
                                                                            </p>
                                                                            <p class="mt-1 text-xs text-muted-foreground">
                                                                                Issued {{ formatDateTime(invoice.invoiceDate) }}
                                                                                <span v-if="invoice.currencyCode">
                                                                                    |
                                                                                    {{ invoice.currencyCode }}
                                                                                </span>
                                                                            </p>
                                                                        </div>
                                                                        <Badge :variant="workflowStatusVariant(invoice.status)">
                                                                            {{ formatEnumLabel(invoice.status || 'draft') }}
                                                                        </Badge>
                                                                    </div>
                                                                    <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                                        <span>Total {{ formatMoney(invoice.totalAmount, invoice.currencyCode) }}</span>
                                                                        <span>Balance {{ formatMoney(invoice.balanceAmount, invoice.currencyCode) }}</span>
                                                                    </div>
                                                                    <p v-if="invoice.notes" class="mt-2 text-xs text-muted-foreground">
                                                                        {{ truncatePlainText(invoice.notes, 220) }}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </template>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>
                                <TabsContent value="records" class="space-y-6">
                                    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Consultation Notes</p>
                                            <p class="text-sm text-muted-foreground">{{ recordsTotal }} notes in this patient chart.</p>
                                        </div>
                                        <Button v-if="canReadMedicalRecords" size="sm" variant="outline" class="gap-1.5" as-child>
                                            <Link :href="recordsRegistryHref"><AppIcon name="search" class="size-3.5" />Open full registry</Link>
                                        </Button>
                                    </div>

                                    <Alert v-if="!canReadMedicalRecords" variant="default">
                                        <AlertTitle>Medical records access required</AlertTitle>
                                        <AlertDescription>This chart stays available for patient review, but the consultation stream requires <code>medical.records.read</code>.</AlertDescription>
                                    </Alert>

                                    <div v-else-if="recordsLoading" class="space-y-3">
                                        <Skeleton class="h-32 w-full rounded-lg" />
                                        <Skeleton class="h-32 w-full rounded-lg" />
                                    </div>

                                    <Alert v-else-if="recordsError" variant="destructive">
                                        <AlertTitle>Consultation records unavailable</AlertTitle>
                                        <AlertDescription>{{ recordsError }}</AlertDescription>
                                    </Alert>

                                    <div v-else-if="records.length === 0" class="rounded-lg border border-dashed px-5 py-5">
                                        <p class="text-base font-medium text-foreground">No consultation records yet</p>
                                        <p class="mt-1 text-sm text-muted-foreground">Start the first consultation from this chart when you want the note to stay anchored to this patient workspace.</p>
                                    </div>

                                    <div v-else class="space-y-4">
                                        <div v-for="record in records" :key="record.id" :class="['rounded-lg border px-4 py-4', highlightedRecordId === record.id ? 'border-primary bg-primary/5' : 'bg-background']">
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
                                                    <Link :href="recordRegistryHref(record)"><AppIcon name="file-text" class="size-3.5" />Open in records</Link>
                                                </Button>
                                            </div>

                                            <div class="mt-3 grid gap-3 lg:grid-cols-2">
                                                <div class="rounded-lg border bg-muted/20 px-3 py-3">
                                                    <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Problem focus</p>
                                                    <p class="mt-1.5 text-sm text-foreground">{{ recordProblem(record) }}</p>
                                                </div>
                                                <div class="rounded-lg border bg-muted/20 px-3 py-3">
                                                    <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Next step</p>
                                                    <p class="mt-1.5 text-sm text-foreground">{{ recordNextStep(record) }}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </template>
                </CardContent>
            </Card>

            <Dialog
                :open="allergyDialogOpen"
                @update:open="(open) => (open ? (allergyDialogOpen = true) : closeAllergyDialog())"
            >
                <DialogContent variant="form" size="xl">
                    <div class="flex h-full max-h-[90vh] flex-col">
                        <DialogHeader class="shrink-0 border-b bg-background px-6 py-4">
                            <DialogTitle>{{ editingAllergyId ? 'Edit allergy' : 'Add allergy' }}</DialogTitle>
                            <DialogDescription>Record clinically relevant allergies or intolerances so downstream order checks can use real patient context.</DialogDescription>
                        </DialogHeader>
                        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                            <div class="grid gap-4">
                                <div class="grid gap-2">
                                    <Label for="patient-medication-allergy-name">Substance</Label>
                                    <Input id="patient-medication-allergy-name" v-model="allergyForm.substanceName" placeholder="Medicine or substance name" />
                                    <p v-if="allergyFormErrors.substanceName?.length" class="text-sm text-destructive">{{ allergyFormErrors.substanceName[0] }}</p>
                                </div>
                                <div class="grid gap-4 sm:grid-cols-2">
                                    <div class="grid gap-2">
                                        <Label for="patient-medication-allergy-code">Code</Label>
                                        <Input id="patient-medication-allergy-code" v-model="allergyForm.substanceCode" placeholder="Optional code" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="patient-medication-allergy-reaction">Reaction</Label>
                                        <Input id="patient-medication-allergy-reaction" v-model="allergyForm.reaction" placeholder="e.g. Rash, anaphylaxis" />
                                    </div>
                                </div>
                                <div class="grid gap-4 sm:grid-cols-3">
                                    <div class="grid gap-2">
                                        <Label for="patient-medication-allergy-severity">Severity</Label>
                                        <Select v-model="allergyForm.severity">
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem value="unknown">Unknown</SelectItem>
                                            <SelectItem value="mild">Mild</SelectItem>
                                            <SelectItem value="moderate">Moderate</SelectItem>
                                            <SelectItem value="severe">Severe</SelectItem>
                                            <SelectItem value="life_threatening">Life threatening</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="patient-medication-allergy-status">Status</Label>
                                        <Select v-model="allergyForm.status">
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                            <SelectItem value="entered_in_error">Entered in error</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="patient-medication-allergy-last-reaction">Last reaction</Label>
                                        <Input id="patient-medication-allergy-last-reaction" v-model="allergyForm.lastReactionAt" type="date" />
                                    </div>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="patient-medication-allergy-notes">Notes</Label>
                                    <Textarea id="patient-medication-allergy-notes" v-model="allergyForm.notes" rows="3" placeholder="Clinical context, source, and confirmation details" />
                                </div>
                                <p v-if="allergyDialogError" class="text-sm text-destructive">{{ allergyDialogError }}</p>
                            </div>
                        </div>
                        <DialogFooter class="shrink-0 gap-2 border-t px-6 py-4">
                            <Button variant="outline" @click="closeAllergyDialog">Cancel</Button>
                            <Button :disabled="allergyDialogSubmitting" @click="submitAllergyDialog">
                                {{ allergyDialogSubmitting ? 'Saving...' : editingAllergyId ? 'Save changes' : 'Add allergy' }}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                :open="medicationProfileDialogOpen"
                @update:open="(open) => (open ? (medicationProfileDialogOpen = true) : closeMedicationProfileDialog())"
            >
                <DialogContent variant="form" size="2xl">
                    <div class="flex h-full max-h-[90vh] flex-col">
                        <DialogHeader class="shrink-0 border-b bg-background px-6 py-4">
                            <DialogTitle>{{ editingMedicationProfileId ? 'Edit current medication entry' : 'Add current medication entry' }}</DialogTitle>
                            <DialogDescription>Maintain the longitudinal current medication list used for reconciliation and prescribing review.</DialogDescription>
                        </DialogHeader>
                        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                            <div class="grid gap-4">
                                <div class="grid gap-2">
                                    <Label for="patient-medication-profile-name">Medication</Label>
                                    <Input id="patient-medication-profile-name" v-model="medicationProfileForm.medicationName" placeholder="Medication name" />
                                    <p v-if="medicationProfileFormErrors.medicationName?.length" class="text-sm text-destructive">{{ medicationProfileFormErrors.medicationName[0] }}</p>
                                </div>
                                <div class="grid gap-4 sm:grid-cols-2">
                                    <div class="grid gap-2">
                                        <Label for="patient-medication-profile-code">Code</Label>
                                        <Input id="patient-medication-profile-code" v-model="medicationProfileForm.medicationCode" placeholder="Optional code" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="patient-medication-profile-dose">Dose</Label>
                                        <Input id="patient-medication-profile-dose" v-model="medicationProfileForm.dose" placeholder="e.g. 500 mg" />
                                    </div>
                                </div>
                                <div class="grid gap-4 sm:grid-cols-3">
                                    <div class="grid gap-2">
                                        <Label for="patient-medication-profile-route">Route</Label>
                                        <Input id="patient-medication-profile-route" v-model="medicationProfileForm.route" placeholder="e.g. oral" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="patient-medication-profile-frequency">Frequency</Label>
                                        <Input id="patient-medication-profile-frequency" v-model="medicationProfileForm.frequency" placeholder="e.g. twice_daily" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="patient-medication-profile-source">Source</Label>
                                        <Select v-model="medicationProfileForm.source">
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem value="home_medication">Home medication</SelectItem>
                                            <SelectItem value="chronic_therapy">Chronic therapy</SelectItem>
                                            <SelectItem value="external_prescription">External prescription</SelectItem>
                                            <SelectItem value="discharge_medication">Discharge medication</SelectItem>
                                            <SelectItem value="manual_entry">Manual entry</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div class="grid gap-4 sm:grid-cols-3">
                                    <div class="grid gap-2">
                                        <Label for="patient-medication-profile-status">Status</Label>
                                        <Select v-model="medicationProfileForm.status">
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="stopped">Stopped</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                            <SelectItem value="entered_in_error">Entered in error</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="patient-medication-profile-started">Started</Label>
                                        <Input id="patient-medication-profile-started" v-model="medicationProfileForm.startedAt" type="date" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="patient-medication-profile-stopped">Stopped</Label>
                                        <Input id="patient-medication-profile-stopped" v-model="medicationProfileForm.stoppedAt" type="date" />
                                    </div>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="patient-medication-profile-indication">Indication</Label>
                                    <Input id="patient-medication-profile-indication" v-model="medicationProfileForm.indication" placeholder="Clinical indication" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="patient-medication-profile-notes">Notes</Label>
                                    <Textarea id="patient-medication-profile-notes" v-model="medicationProfileForm.notes" rows="3" placeholder="Source, adherence context, and supporting notes" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="patient-medication-profile-reconciliation-note">Reconciliation note</Label>
                                    <Textarea id="patient-medication-profile-reconciliation-note" v-model="medicationProfileForm.reconciliationNote" rows="2" placeholder="Optional reconciliation note" />
                                </div>
                                <p v-if="medicationProfileDialogError" class="text-sm text-destructive">{{ medicationProfileDialogError }}</p>
                            </div>
                        </div>
                        <DialogFooter class="shrink-0 gap-2 border-t px-6 py-4">
                            <Button variant="outline" @click="closeMedicationProfileDialog">Cancel</Button>
                            <Button :disabled="medicationProfileDialogSubmitting" @click="submitMedicationProfileDialog">
                                {{ medicationProfileDialogSubmitting ? 'Saving...' : editingMedicationProfileId ? 'Save changes' : 'Add medication' }}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                :open="encounterLifecycleDialogOpen"
                @update:open="(open) => (open ? (encounterLifecycleDialogOpen = true) : closeEncounterLifecycleDialog())"
            >
                <DialogContent variant="action" size="lg">
                    <DialogHeader>
                        <DialogTitle>{{ encounterLifecycleActionLabel(encounterLifecycleAction) }}</DialogTitle>
                        <DialogDescription>
                            Apply this lifecycle action to <span class="font-medium text-foreground">{{ encounterLifecycleTargetName() }}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-2">
                        <Label for="patient-chart-encounter-lifecycle-reason">Clinical reason</Label>
                        <Input
                            id="patient-chart-encounter-lifecycle-reason"
                            v-model="encounterLifecycleReason"
                            placeholder="Document the clinical reason for this lifecycle action."
                        />
                        <p v-if="encounterLifecycleError" class="text-sm text-destructive">
                            {{ encounterLifecycleError }}
                        </p>
                    </div>
                    <DialogFooter class="gap-2">
                        <Button variant="outline" @click="closeEncounterLifecycleDialog">
                            Keep current order
                        </Button>
                        <Button :disabled="encounterLifecycleSubmitting" @click="submitEncounterLifecycleDialog">
                            {{
                                encounterLifecycleSubmitting
                                    ? 'Applying...'
                                    : encounterLifecycleActionLabel(encounterLifecycleAction)
                            }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>

























