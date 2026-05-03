
<script setup lang="ts">
import { Head, Link, router, usePage } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import {
    FINANCIAL_CLASS_OPTIONS,
    compactVisitCoverageSummary,
    financialClassLabel,
    isThirdPartyFinancialClass,
    normalizeFinancialClass,
} from '@/lib/financialCoverage';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { patientChartHref } from '@/lib/patientChart';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import type { BreadcrumbItem } from '@/types';

type WorkspacePreset = 'all' | 'scheduled' | 'waiting_triage' | 'waiting_provider' | 'in_consultation' | 'completed' | 'exceptions';
type QueueMode = 'all' | 'triage' | 'clinical';
type AppointmentStatus = 'scheduled' | 'waiting_triage' | 'waiting_provider' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';
type ReferralType = 'internal' | 'external';
type ReferralPriority = 'routine' | 'urgent' | 'critical';

type Appointment = {
    id: string;
    appointmentNumber: string | null;
    patientId: string | null;
    sourceAdmissionId: string | null;
    clinicianUserId: number | null;
    department: string | null;
    scheduledAt: string | null;
    durationMinutes: number | null;
    reason: string | null;
    notes: string | null;
    appointmentType: string | null;
    financialClass: string | null;
    billingPayerContractId: string | null;
    coverageReference: string | null;
    coverageNotes: string | null;
    triageVitalsSummary: string | null;
    triageNotes: string | null;
    triageCategory: string | null;
    triagedAt: string | null;
    triagedByUserId: number | null;
    consultationStartedAt: string | null;
    consultationOwnerUserId: number | null;
    consultationOwnerAssignedAt: string | null;
    consultationTakeoverCount: number | null;
    status: AppointmentStatus | null;
    statusReason: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type BillingPayerContract = {
    id: string;
    contractCode: string | null;
    contractName: string | null;
    payerType: string | null;
    payerName: string | null;
    payerPlanCode: string | null;
    payerPlanName: string | null;
    currencyCode: string | null;
    status: string | null;
};

type BillingPayerContractListResponse = {
    data: BillingPayerContract[];
    meta?: { currentPage?: number; perPage?: number; total?: number; lastPage?: number };
};

type Referral = {
    id: string;
    appointmentId: string | null;
    referralNumber: string | null;
    referralType: ReferralType | null;
    priority: ReferralPriority | null;
    targetDepartment: string | null;
    targetFacilityId: string | null;
    targetFacilityCode: string | null;
    targetFacilityName: string | null;
    targetClinicianUserId: number | null;
    referralReason: string | null;
    clinicalNotes: string | null;
    handoffNotes: string | null;
    requestedAt: string | null;
    acceptedAt: string | null;
    handedOffAt: string | null;
    completedAt: string | null;
    status: string | null;
    statusReason: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type MedicalRecordSummary = {
    id: string;
    patientId: string | null;
    appointmentId: string | null;
    appointmentReferralId: string | null;
    recordNumber: string | null;
    recordType: string | null;
    status: string | null;
    encounterAt: string | null;
    signedAt: string | null;
    updatedAt: string | null;
};

type AuditLog = {
    id: string;
    action: string | null;
    actorId: number | null;
    actorType?: string | null;
    createdAt: string | null;
    changes?: Record<string, unknown> | unknown[] | null;
    metadata?: Record<string, unknown> | unknown[] | null;
};

type LaboratoryOrder = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
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
};

type PharmacyOrder = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    orderedAt: string | null;
    medicationName: string | null;
    dosageInstruction: string | null;
    quantityPrescribed: string | number | null;
    quantityDispensed: string | number | null;
    dispensedAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
};

type RadiologyOrder = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
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
};

type TheatreProcedure = {
    id: string;
    procedureNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    procedureType: string | null;
    procedureName: string | null;
    theatreRoomName: string | null;
    scheduledAt: string | null;
    completedAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    notes: string | null;
};

type EncounterLifecycleTargetKind = 'laboratory' | 'pharmacy' | 'radiology' | 'theatre';
type EncounterLifecycleAction = 'cancel' | 'discontinue' | 'entered_in_error';

type EncounterCareSectionId = 'laboratory-orders' | 'pharmacy-orders' | 'radiology-orders' | 'theatre-procedures';
type AppointmentDetailsTab = 'summary' | 'workflow' | 'encounter' | 'referrals' | 'audit';
type EncounterCareState = 'loading' | 'issue' | 'active' | 'empty';
type EncounterCareSummary = {
    id: EncounterCareSectionId;
    label: string;
    icon: string;
    singularLabel: string;
    pluralLabel: string;
    count: number;
    state: EncounterCareState;
};

type PatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    phone?: string | null;
};

type AdmissionSummary = {
    id: string;
    admissionNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    attendingClinicianUserId: number | null;
    ward: string | null;
    bed: string | null;
    admittedAt: string | null;
    dischargedAt: string | null;
    admissionReason: string | null;
    dischargeDestination: string | null;
    followUpPlan: string | null;
    notes: string | null;
    status: string | null;
};

type DepartmentOption = SearchableSelectOption;
type DepartmentListResponse = {
    data: DepartmentOption[];
};
type StaffProfileSummary = {
    id: string;
    userId: number | null;
    userName: string | null;
    employeeNumber: string | null;
    department: string | null;
    jobTitle: string | null;
    primarySpecialtyId?: string | null;
    primarySpecialtyCode?: string | null;
    primarySpecialtyName?: string | null;
    status: string | null;
};

type ValidationPayload = {
    code?: string;
    message?: string;
    errors?: Record<string, string[]>;
    context?: Record<string, unknown>;
};

type ApiError = Error & {
    status?: number;
    payload?: ValidationPayload;
};

type ApiItemResponse<T> = { data: T };
type ApiListResponse<T> = {
    data: T[];
    meta?: {
        currentPage?: number;
        lastPage?: number;
        total?: number;
        current_page?: number;
        last_page?: number;
    };
};

const VISIT_REASON_CUSTOM_VALUE = '__custom__';
const COMMON_VISIT_REASON_OPTIONS: SearchableSelectOption[] = [
    { value: 'New consultation', label: 'New consultation', group: 'General clinic', keywords: ['new', 'consultation', 'initial'] },
    { value: 'Follow-up review', label: 'Follow-up review', group: 'General clinic', keywords: ['follow-up', 'review', 'follow up'] },
    { value: 'Results review', label: 'Results review', group: 'General clinic', keywords: ['results', 'review', 'lab', 'imaging'] },
    { value: 'Referral consultation', label: 'Referral consultation', group: 'General clinic', keywords: ['referral', 'consultation'] },
    { value: 'Post-discharge review', label: 'Post-discharge review', group: 'General clinic', keywords: ['post discharge', 'discharge', 'review'] },
    { value: 'Medication refill', label: 'Medication refill', group: 'General clinic', keywords: ['medication', 'refill', 'pharmacy'] },
    { value: 'Chronic clinic review', label: 'Chronic clinic review', group: 'General clinic', keywords: ['chronic', 'clinic', 'review', 'ncd'] },
    { value: 'ANC visit', label: 'ANC visit', group: 'Maternal and child', keywords: ['anc', 'antenatal', 'pregnancy'] },
    { value: 'PNC review', label: 'PNC review', group: 'Maternal and child', keywords: ['pnc', 'postnatal', 'review'] },
    { value: 'Child welfare / immunization', label: 'Child welfare / immunization', group: 'Maternal and child', keywords: ['child welfare', 'immunization', 'clinic', 'under five'] },
    { value: 'Family planning visit', label: 'Family planning visit', group: 'Maternal and child', keywords: ['family planning', 'fp'] },
    { value: 'Dressing / wound care', label: 'Dressing / wound care', group: 'Procedures and support', keywords: ['dressing', 'wound care', 'procedure'] },
    { value: 'Procedure review', label: 'Procedure review', group: 'Procedures and support', keywords: ['procedure', 'review'] },
    { value: 'Lab sample collection', label: 'Lab sample collection', group: 'Diagnostics and support', keywords: ['lab', 'sample', 'collection'] },
    { value: 'Lab results review', label: 'Lab results review', group: 'Diagnostics and support', keywords: ['lab', 'results', 'review'] },
    { value: 'Imaging booking / review', label: 'Imaging booking / review', group: 'Diagnostics and support', keywords: ['imaging', 'xray', 'ultrasound', 'review'] },
    { value: 'Insurance / billing counseling', label: 'Insurance / billing counseling', group: 'Diagnostics and support', keywords: ['insurance', 'billing', 'counseling'] },
];
const GENERAL_VISIT_REASON_VALUES = new Set([
    'New consultation',
    'Follow-up review',
    'Results review',
    'Referral consultation',
    'Post-discharge review',
    'Chronic clinic review',
]);
const VISIT_REASON_DEPARTMENT_RULES = [
    { matchers: ['maternity', 'antenatal', 'anc', 'postnatal', 'pnc', 'reproductive', 'family planning'], values: ['ANC visit', 'PNC review', 'Family planning visit'] },
    { matchers: ['child', 'under five', 'immunization', 'vaccination', 'paediatric', 'pediatric'], values: ['Child welfare / immunization'] },
    { matchers: ['pharmacy', 'dispensary'], values: ['Medication refill'] },
    { matchers: ['laboratory', 'lab'], values: ['Lab sample collection', 'Lab results review'] },
    { matchers: ['radiology', 'imaging', 'xray', 'x-ray', 'ultrasound'], values: ['Imaging booking / review'] },
    { matchers: ['billing', 'cashier', 'insurance', 'claims'], values: ['Insurance / billing counseling'] },
    { matchers: ['procedure', 'dressing', 'wound', 'minor theatre', 'theatre', 'surgery'], values: ['Dressing / wound care', 'Procedure review'] },
];
const THIRD_PARTY_FINANCIAL_CLASS_OPTIONS = FINANCIAL_CLASS_OPTIONS.filter((option) => option.value !== 'self_pay');

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Appointments', href: '/appointments' }];
const compactQueueRows = useLocalStorageBoolean('appointments.queueRows.compact', false);
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();
const page = usePage<{ auth?: { user?: PageAuthUser } }>();

const initialQueryText = queryParam('q').trim();
const initialPatientId = queryParam('patientId').trim();
const initialPatientName = queryParam('patientName').trim();
const initialPatientNumber = queryParam('patientNumber').trim();
const initialClinicianUserId = queryParam('clinicianUserId').trim();
const initialFrom = queryDateFilterParam('from');
const initialTo = queryDateFilterParam('to');
const initialStatusQuery = queryParam('status').trim();
const initialViewQuery = queryParam('view').trim();
const initialTabQuery = queryParam('tab').trim();
const initialOpenQuery = queryParam('open').trim();
const initialPageQuery = queryParam('page').trim();
const initialFocusedAppointmentId = queryParam('focusAppointmentId').trim();
const initialCreateIntent = shouldOpenCreateFromQuery();
const initialCreatePrefill = createPrefillQueryValues();
const hasExplicitQueueIntent = Boolean(
    initialQueryText
    || initialPatientId
    || initialClinicianUserId
    || initialFrom
    || initialTo
    || initialStatusQuery
    || initialViewQuery
    || initialTabQuery
    || initialOpenQuery
    || initialFocusedAppointmentId
    || initialPageQuery,
);

const statusPreset = ref<WorkspacePreset>(queryPresetParam());
const queueMode = ref<QueueMode>(queryQueueModeParam());
const searchForm = reactive({
    q: initialQueryText,
    patientId: initialPatientId,
    clinicianUserId: initialClinicianUserId,
    from: initialFrom,
    to: initialTo,
    page: queryPositiveIntParam('page', 1),
    perPage: queryPerPageParam('perPage', 25, [10, 25, 50]),
});
const advancedFiltersDraft = reactive({
    patientId: searchForm.patientId,
    from: searchForm.from,
    to: searchForm.to,
});

const listLoading = ref(false);
const pageLoading = ref(true);
const queueError = ref<string | null>(null);
const appointments = ref<Appointment[]>([]);
const counts = ref<Record<string, number>>({
    scheduled: 0,
    waiting_triage: 0,
    waiting_provider: 0,
    in_consultation: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
    total: 0,
});
const pagination = ref({ currentPage: 1, lastPage: 1, total: 0 });

const advancedFiltersSheetOpen = ref(false);
const mobileFiltersDrawerOpen = ref(false);
const createSheetOpen = ref(false);
const createResumeAvailable = ref(false);
const createIntentActive = ref(initialCreateIntent);

const createMessage = ref<string | null>(null);
const createErrors = ref<Record<string, string[]>>({});
const createConflictAppointment = ref<Appointment | null>(null);
const createSubmitting = ref(false);
const createPrefillApplied = ref(false);
const createPatientLocked = ref(false);
const createLeaveConfirmOpen = ref(false);
const pendingAppointmentsVisit = ref<any | null>(null);
const createForm = reactive({
    patientId: initialCreatePrefill.patientId || initialPatientId,
    sourceAdmissionId: initialCreatePrefill.sourceAdmissionId || '',
    clinicianUserId: initialCreatePrefill.clinicianUserId || '',
    department: initialCreatePrefill.department || '',
    scheduledAt: initialCreatePrefill.scheduledAt || defaultScheduledAtInput(),
    durationMinutes: initialCreatePrefill.durationMinutes || '30',
    reason: initialCreatePrefill.reason || '',
    notes: initialCreatePrefill.notes || '',
    appointmentType: 'scheduled' as 'scheduled' | 'walk_in' | 'referral',
    financialClass: normalizeFinancialClass(initialCreatePrefill.financialClass),
    billingPayerContractId: initialCreatePrefill.billingPayerContractId || '',
    coverageReference: initialCreatePrefill.coverageReference || '',
    coverageNotes: initialCreatePrefill.coverageNotes || '',
});
const createCustomVisitReason = ref('');
const createClinicianAutoDepartment = ref('');
const createSourceAdmissionSummary = ref<AdmissionSummary | null>(null);
const createSourceAdmissionLoading = ref(false);
const createSourceAdmissionError = ref<string | null>(null);

const detailsOpen = ref(false);
const detailsLoading = ref(false);
const detailsError = ref<string | null>(null);
const detailsAppointment = ref<Appointment | null>(null);
const detailsTab = ref<AppointmentDetailsTab>('summary');
const detailsReferralsLoading = ref(false);
const detailsReferralNotesLoading = ref(false);
const detailsAuditLoading = ref(false);
const detailsLaboratoryOrdersLoading = ref(false);
const detailsLaboratoryOrdersError = ref<string | null>(null);
const detailsPharmacyOrdersLoading = ref(false);
const detailsPharmacyOrdersError = ref<string | null>(null);
const detailsRadiologyOrdersLoading = ref(false);
const detailsRadiologyOrdersError = ref<string | null>(null);
const detailsTheatreProceduresLoading = ref(false);
const detailsTheatreProceduresError = ref<string | null>(null);
const detailsReferrals = ref<Referral[]>([]);
const detailsReferralNotesByReferralId = ref<Record<string, MedicalRecordSummary[]>>({});
const detailsAuditLogs = ref<AuditLog[]>([]);
const detailsLaboratoryOrders = ref<LaboratoryOrder[]>([]);
const detailsPharmacyOrders = ref<PharmacyOrder[]>([]);
const detailsRadiologyOrders = ref<RadiologyOrder[]>([]);
const detailsTheatreProcedures = ref<TheatreProcedure[]>([]);
const detailsEncounterCareOpen = ref<EncounterCareSectionId[]>([]);
const detailsStatusNotice = ref<{ title: string; message: string } | null>(null);
const detailsSourceAdmissionSummary = ref<AdmissionSummary | null>(null);
const detailsSourceAdmissionLoading = ref(false);
const detailsSourceAdmissionError = ref<string | null>(null);
const detailsLifecycleDialogOpen = ref(false);
const detailsLifecycleSubmitting = ref(false);
const detailsLifecycleError = ref<string | null>(null);
const detailsLifecycleAction = ref<EncounterLifecycleAction | null>(null);
const detailsLifecycleTargetKind = ref<EncounterLifecycleTargetKind | null>(null);
const detailsLifecycleTargetId = ref('');
const detailsLifecycleReason = ref('');
let detailsLaboratoryOrdersRequestId = 0;
let detailsPharmacyOrdersRequestId = 0;
let detailsRadiologyOrdersRequestId = 0;
let detailsTheatreProceduresRequestId = 0;
let detailsReferralNotesRequestId = 0;
let createSourceAdmissionRequestId = 0;
let detailsSourceAdmissionRequestId = 0;

const statusDialogOpen = ref(false);
const statusSubmitting = ref(false);
const statusErrors = ref<Record<string, string[]>>({});
const statusTargetAppointment = ref<Appointment | null>(null);
const statusDialogMode = ref<'frontdesk' | 'provider'>('frontdesk');
const statusDialogOrigin = ref<'queue' | 'details'>('queue');
const statusForm = reactive({
    status: 'waiting_triage' as AppointmentStatus,
    reason: '',
});
const triageSheetOpen = ref(false);
const triageSubmitting = ref(false);
const triageErrors = ref<Record<string, string[]>>({});
const triageTargetAppointment = ref<Appointment | null>(null);
const triageForm = reactive({
    triageVitalsSummary: '',
    triageNotes: '',
    triageCategory: '' as '' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5',
});
const rescheduleDialogOpen = ref(false);
const rescheduleSubmitting = ref(false);
const rescheduleErrors = ref<Record<string, string[]>>({});
const rescheduleTargetAppointment = ref<Appointment | null>(null);
const rescheduleForm = reactive({
    scheduledAt: '',
    durationMinutes: '30',
    notes: '',
});

const referralDialogOpen = ref(false);
const referralSubmitting = ref(false);
const referralErrors = ref<Record<string, string[]>>({});
const referralForm = reactive({
    referralType: 'internal' as ReferralType,
    priority: 'routine' as ReferralPriority,
    targetDepartment: '',
    targetFacilityCode: '',
    targetFacilityName: '',
    targetClinicianUserId: '',
    referralReason: '',
    clinicalNotes: '',
    handoffNotes: '',
});
const referralStatusDialogOpen = ref(false);
const referralStatusSubmitting = ref(false);
const referralStatusErrors = ref<Record<string, string[]>>({});
const referralStatusTarget = ref<Referral | null>(null);
const referralStatusForm = reactive({
    status: 'accepted',
    reason: '',
    handoffNotes: '',
});

const consultationLaunchingAppointmentId = ref<string | null>(null);
const consultationTakeoverDialogOpen = ref(false);
const consultationTakeoverTarget = ref<Appointment | null>(null);
const consultationTakeoverReason = ref('');
const consultationTakeoverError = ref<string | null>(null);
const consultationTakeoverSubmitting = ref(false);

const patientDirectory = ref<Record<string, PatientSummary>>({});
const pendingPatientLookupIds = new Set<string>();
const departmentOptionsLoading = ref(false);
const departmentOptions = ref<DepartmentOption[]>([]);
const clinicianDirectoryLoading = ref(false);
const clinicianDirectoryError = ref<string | null>(null);
const clinicianDirectory = ref<StaffProfileSummary[]>([]);
const billingPayerContractsLoading = ref(false);
const billingPayerContractsError = ref<string | null>(null);
const billingPayerContracts = ref<BillingPayerContract[]>([]);
const billingPayerContractsLoaded = ref(false);

let removeAppointmentsNavigationGuard: VoidFunction | null = null;
let bypassAppointmentsNavigationGuard = false;

const canRead = computed(() => isFacilitySuperAdmin.value || hasPermission('appointments.read'));
const canCreate = computed(() => isFacilitySuperAdmin.value || hasPermission('appointments.create'));
const canReadClinicianDirectory = computed(() => isFacilitySuperAdmin.value || hasPermission('staff.clinical-directory.read'));
const canUpdateStatus = computed(() => isFacilitySuperAdmin.value || hasPermission('appointments.update-status'));
const canRecordOpdTriage = computed(() => isFacilitySuperAdmin.value
    || hasPermission('emergency.triage.create')
    || hasPermission('emergency.triage.update-status'));
const canManageReferrals = computed(() => isFacilitySuperAdmin.value || hasPermission('appointments.manage-referrals'));
const canShowReferralTab = computed(() => detailsReferrals.value.length > 0);
const preferredReferralNoteTarget = computed<Referral | null>(() =>
    detailsReferrals.value.find((referral) =>
        ['requested', 'accepted', 'in_progress'].includes(
            String(referral.status ?? '').trim().toLowerCase(),
        ),
    ) ?? detailsReferrals.value[0] ?? null,
);
const canViewAudit = computed(() => isFacilitySuperAdmin.value || hasPermission('appointments.view-audit-logs'));
const canReadMedicalRecords = computed(() => isFacilitySuperAdmin.value || hasPermission('medical.records.read'));
const canCreateMedicalRecords = computed(() =>
    canReadMedicalRecords.value &&
    (isFacilitySuperAdmin.value || hasPermission('medical.records.create')),
);
const canStartConsultation = computed(() => isFacilitySuperAdmin.value || hasPermission('appointments.start-consultation'));
const canManageProviderSession = computed(() => isFacilitySuperAdmin.value || hasPermission('appointments.manage-provider-session'));
const canReadAdmissions = computed(() => isFacilitySuperAdmin.value || hasPermission('admissions.read'));
const canReadLaboratory = computed(() => isFacilitySuperAdmin.value || hasPermission('laboratory.orders.read'));
const canReadPharmacy = computed(() => isFacilitySuperAdmin.value || hasPermission('pharmacy.orders.read'));
const canReadRadiology = computed(() => isFacilitySuperAdmin.value || hasPermission('radiology.orders.read'));
const canReadTheatre = computed(() => isFacilitySuperAdmin.value || hasPermission('theatre.procedures.read'));
const canCreateLaboratory = computed(() => isFacilitySuperAdmin.value || hasPermission('laboratory.orders.create'));
const canCreatePharmacy = computed(() => isFacilitySuperAdmin.value || hasPermission('pharmacy.orders.create'));
const canCreateRadiology = computed(() => isFacilitySuperAdmin.value || hasPermission('radiology.orders.create'));
const canCreateTheatre = computed(() => isFacilitySuperAdmin.value || hasPermission('theatre.procedures.create'));
const canReadBilling = computed(() => isFacilitySuperAdmin.value || hasPermission('billing.invoices.read'));
const canReadBillingPayerContracts = computed(() => isFacilitySuperAdmin.value || hasPermission('billing.payer-contracts.read'));
const currentUserId = computed<number | null>(() => {
    const raw = page.props.auth?.user?.id;
    const normalized = Number(raw ?? 0);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
});
const currentUserName = computed(() => String(page.props.auth?.user?.name ?? '').trim());
const currentUserIsListedClinician = computed(() => {
    if (currentUserId.value === null) return false;
    return clinicianDirectory.value.some((row) => Number(row.userId ?? 0) === currentUserId.value);
});
const canUseMyClinicalQueue = computed(() => {
    if (currentUserId.value === null || !canStartConsultation.value) {
        return false;
    }
    if (!canReadClinicianDirectory.value) {
        return true;
    }
    if (clinicianDirectoryLoading.value) {
        return false;
    }
    return currentUserIsListedClinician.value;
});
const canUseTriageQueue = computed(() => canRecordOpdTriage.value && !canUseMyClinicalQueue.value);

const hasCreateAlerts = computed(() =>
    Boolean(createMessage.value)
    || Object.keys(createErrors.value).length > 0
    || Boolean(createConflictAppointment.value),
);
const createConflictAppointmentHref = computed(() => {
    const appointment = createConflictAppointment.value;
    if (!appointment?.id) return null;

    const url = new URL('/appointments', window.location.origin);
    if (appointment.patientId) url.searchParams.set('patientId', appointment.patientId);
    if (appointment.status) url.searchParams.set('status', appointment.status);
    url.searchParams.set('focusAppointmentId', appointment.id);
    return `${url.pathname}${url.search}`;
});
const hasCreateDraft = computed(() => Boolean(
    createForm.patientId.trim()
    || createForm.sourceAdmissionId.trim()
    || createForm.clinicianUserId.trim()
    || createForm.department.trim()
    || createForm.reason.trim()
    || createForm.notes.trim()
    || createForm.financialClass !== 'self_pay'
    || createForm.billingPayerContractId.trim()
    || createForm.coverageReference.trim()
    || createForm.coverageNotes.trim()
));
const canResumeCreateSheet = computed(() => !createSheetOpen.value && createResumeAvailable.value);
const hasPendingCreateWorkflow = computed(() => createIntentActive.value && (
    createSheetOpen.value
    || createResumeAvailable.value
    || hasCreateDraft.value
));
const createResumeTitle = computed(() => {
    const patientLabel = createForm.patientId.trim() ? patientDisplayName(createForm.patientId) : '';
    return patientLabel && patientLabel !== 'Patient pending'
        ? `Resume scheduling for ${patientLabel}`
        : 'Resume scheduling';
});
const createResumeMeta = computed(() => {
    const parts = [
        createForm.patientId.trim() ? patientMeta(createForm.patientId) : null,
        createForm.department.trim() || null,
        createForm.financialClass !== 'self_pay' ? financialClassLabel(createForm.financialClass) : null,
    ].filter(Boolean);
    return parts.join(' | ');
});

const isMyClinicalQueue = computed(() => queueMode.value === 'clinical');
const isTriageQueue = computed(() => queueMode.value === 'triage');
const queueModeLabel = computed(() => isMyClinicalQueue.value ? 'My patients' : (isTriageQueue.value ? 'Triage queue' : 'All appointments'));
const queueTitle = computed(() => isMyClinicalQueue.value ? 'My clinical queue' : (isTriageQueue.value ? 'Nurse triage queue' : 'Appointments queue'));
const queueDescription = computed(() => isMyClinicalQueue.value
    ? 'Patients already triaged and waiting for your care, plus your active consultation and closed visits.'
    : (isTriageQueue.value
        ? 'Nurse-owned queue for vitals, intake review, and provider handoff.'
        : 'Front-desk scheduling, arrival handling, nurse triage handoff, and provider routing.')
);
const clinicianInFocusLabel = computed(() => {
    if (!searchForm.clinicianUserId.trim()) return '';
    const normalized = Number(searchForm.clinicianUserId);
    return Number.isFinite(normalized) && normalized > 0 ? clinicianDisplayLabel(normalized) : '';
});
const queueSummary = computed(() => {
    const total = pagination.value.total || appointments.value.length;
    if (isMyClinicalQueue.value) return `${total} visits currently in your clinician queue`;
    if (isTriageQueue.value) return `${total} visits currently in nurse triage scope`;
    return `${total} appointments in scope`;
});
const workspaceIntroText = computed(() => isMyClinicalQueue.value
    ? 'Clinician queue for your patients who are waiting for provider review, already in consultation, or recently closed.'
    : (isTriageQueue.value
        ? 'Nurse triage workspace for vitals, intake notes, and provider handoff.'
        : 'Front-desk scheduling, arrival handling, nurse triage handoff, and provider routing.')
);
const showClinicalQueueSuggestion = computed(() => canUseMyClinicalQueue.value && !isMyClinicalQueue.value && !isTriageQueue.value && !hasExplicitQueueIntent);
const showTriageQueueSuggestion = computed(() => canUseTriageQueue.value && !isTriageQueue.value && !isMyClinicalQueue.value && !hasExplicitQueueIntent);
const currentViewSummary = computed(() => `${queueModeLabel.value} -> ${quickPresetLabel(statusPreset.value)}`);
const activeAdvancedFilterCount = computed(() =>
    Number(Boolean(searchForm.patientId))
    + Number(Boolean(searchForm.from))
    + Number(Boolean(searchForm.to)),
);
const createDepartmentOptions = computed(() => mergeSelectedDepartmentOption(departmentOptions.value, createForm.department));
const effectiveCreateDepartment = computed(() => createForm.department.trim() || selectedCreateClinicianDepartment.value);
const filteredVisitReasonValues = computed(() => {
    const departmentText = effectiveCreateDepartment.value.trim().toLowerCase();
    if (departmentText === '') return null;

    const values = new Set<string>();
    GENERAL_VISIT_REASON_VALUES.forEach((value) => values.add(value));

    for (const rule of VISIT_REASON_DEPARTMENT_RULES) {
        if (rule.matchers.some((matcher) => departmentText.includes(matcher))) {
            rule.values.forEach((value) => values.add(value));
        }
    }

    return values.size > 0 ? values : null;
});
const visitReasonOptions = computed<SearchableSelectOption[]>(() => {
    const filteredValues = filteredVisitReasonValues.value;
    const scopedOptions = filteredValues
        ? COMMON_VISIT_REASON_OPTIONS.filter((option) => filteredValues.has(option.value) || option.value === createForm.reason.trim())
        : COMMON_VISIT_REASON_OPTIONS;

    return [
        ...scopedOptions,
        {
            value: VISIT_REASON_CUSTOM_VALUE,
            label: 'Other / custom',
            description: 'Use when none of the common front-desk reasons fit this visit.',
            keywords: ['other', 'custom'],
            group: 'Other',
        },
    ];
});
const createVisitReasonValue = computed({
    get: () => {
        const normalizedReason = createForm.reason.trim();
        if (!normalizedReason) return '';
        return COMMON_VISIT_REASON_OPTIONS.some((option) => option.value === normalizedReason)
            ? normalizedReason
            : VISIT_REASON_CUSTOM_VALUE;
    },
    set: (value: string) => {
        if (!value) {
            createForm.reason = '';
            createCustomVisitReason.value = '';
            return;
        }

        if (value === VISIT_REASON_CUSTOM_VALUE) {
            createForm.reason = createCustomVisitReason.value.trim();
            return;
        }

        createForm.reason = value;
        createCustomVisitReason.value = '';
    },
});
const usingCustomVisitReason = computed(() => createVisitReasonValue.value === VISIT_REASON_CUSTOM_VALUE);
const createCustomVisitReasonValue = computed({
    get: () => createCustomVisitReason.value,
    set: (value: string) => {
        createCustomVisitReason.value = value;
        if (usingCustomVisitReason.value) {
            createForm.reason = value.trim();
        }
    },
});
const selectedCreateClinicianProfile = computed<StaffProfileSummary | null>(() => {
    const clinicianUserId = Number(createForm.clinicianUserId || 0);
    if (!Number.isFinite(clinicianUserId) || clinicianUserId <= 0) return null;
    return clinicianDirectory.value.find((row) => row.userId === clinicianUserId) ?? null;
});
const selectedCreateClinicianDepartment = computed(() =>
    String(selectedCreateClinicianProfile.value?.department ?? '').trim(),
);
const selectedCreateClinicianSpecialty = computed(() =>
    String(selectedCreateClinicianProfile.value?.primarySpecialtyName ?? '').trim(),
);
const selectedCreateClinicianSpecialtyCode = computed(() =>
    String(selectedCreateClinicianProfile.value?.primarySpecialtyCode ?? '').trim(),
);
const selectedCreateClinicianRole = computed(() =>
    String(selectedCreateClinicianProfile.value?.jobTitle ?? '').trim(),
);
const createRoutingSummary = computed(() => {
    const clinician = Number(createForm.clinicianUserId || 0) > 0
        ? clinicianDisplayLabel(Number(createForm.clinicianUserId || 0))
        : '';
    const department = effectiveCreateDepartment.value.trim();
    const specialty = selectedCreateClinicianSpecialty.value;

    if (clinician && specialty && department) {
        return `${clinician} is scheduled through ${department}, with ${specialty} as the current specialty context. Consultation billing will finalize from the clinician who actually owns the visit.`;
    }

    if (clinician && department) {
        return `${clinician} is scheduled through ${department}. Consultation billing will finalize from the clinician who actually owns the visit.`;
    }

    if (department) {
        return `${department} is the routing clinic for this visit. Consultation billing will finalize when the consulting clinician takes ownership.`;
    }

    return 'Choose a clinic/department or clinician to route the visit. Consultation billing finalizes from the actual consulting clinician and visit context.';
});
const createDepartmentHelperText = computed(() => {
    const clinicianDepartment = selectedCreateClinicianDepartment.value;
    if (clinicianDepartment) {
        return `Auto-filled from the selected clinician profile: ${clinicianDepartment}. Change only if the visit should route through a different patient-facing clinic.`;
    }
    return 'Choose the clinic or department that should own front-desk routing for this visit.';
});
const createVisitReasonHelperText = computed(() => {
    const department = effectiveCreateDepartment.value.trim();
    if (department !== '') {
        return `Showing visit reasons that best match ${department}. Use Other / custom if the visit needs something different.`;
    }
    return 'Choose a common front-desk visit reason to save time. Use Other / custom if none fits.';
});
const createClinicianUserIdValue = computed({
    get: () => createForm.clinicianUserId,
    set: (value: string) => {
        createForm.clinicianUserId = value;

        const normalizedDepartment = String(
            clinicianDirectory.value.find((row) => row.userId === Number(value || 0))?.department ?? '',
        ).trim();
        const currentDepartment = createForm.department.trim();
        const previousAutoDepartment = createClinicianAutoDepartment.value.trim();
        const shouldReplaceDepartment = currentDepartment === '' || (previousAutoDepartment !== '' && currentDepartment === previousAutoDepartment);

        if (normalizedDepartment !== '' && shouldReplaceDepartment) {
            createForm.department = normalizedDepartment;
        }

        if (normalizedDepartment === '' && previousAutoDepartment !== '' && currentDepartment === previousAutoDepartment) {
            createForm.department = '';
        }

        createClinicianAutoDepartment.value = normalizedDepartment;
    },
});
const clinicianOptions = computed<SearchableSelectOption[]>(() =>
    clinicianDirectory.value
        .filter((profile) => profile.userId !== null && (profile.status ?? '').trim().toLowerCase() !== 'inactive')
        .map((profile) => {
            const userId = Number(profile.userId);
            const userName = String(profile.userName ?? '').trim();
            const employeeNumber = String(profile.employeeNumber ?? '').trim();
            const jobTitle = String(profile.jobTitle ?? '').trim();
            const department = String(profile.department ?? '').trim();
            const primarySpecialty = String(profile.primarySpecialtyName ?? '').trim();
            const primarySpecialtyCode = String(profile.primarySpecialtyCode ?? '').trim();
            const label = [userName || employeeNumber || `User ${userId}`, jobTitle].filter(Boolean).join(' - ');

            return {
                value: String(userId),
                label: label || `User ${userId}`,
                description: [
                    primarySpecialty || null,
                    department || null,
                    employeeNumber || null,
                    primarySpecialtyCode || null,
                    `User ID ${userId}`,
                ].filter(Boolean).join(' | '),
                keywords: [
                    userName,
                    employeeNumber,
                    jobTitle,
                    department,
                    primarySpecialty,
                    primarySpecialtyCode,
                    String(userId),
                ].filter(Boolean),
                group: primarySpecialty || department || 'Clinical staff',
            } satisfies SearchableSelectOption;
        }),
);
const clinicianDirectoryAvailable = computed(() => clinicianOptions.value.length > 0);
const clinicianHelperText = computed(() => {
    if (clinicianDirectoryLoading.value) {
        return 'Loading active clinician directory.';
    }
    if (!canReadClinicianDirectory.value) {
        return 'Clinician directory access is unavailable. Enter clinician user ID manually.';
    }
    if (clinicianDirectoryError.value) {
        return clinicianDirectoryError.value;
    }
    if (clinicianDirectoryAvailable.value) {
        return 'Select the clinician from active staff profiles. Primary specialty appears when it is configured.';
    }
    return 'No active clinicians with linked user IDs are available. Enter clinician user ID manually.';
});
const statusSelectValue = computed({
    get: () => (statusPreset.value === 'scheduled' || statusPreset.value === 'waiting_triage' || statusPreset.value === 'waiting_provider' || statusPreset.value === 'in_consultation' || statusPreset.value === 'completed'
        ? statusPreset.value
        : 'all'),
    set: (value: string) => {
        statusPreset.value = value === 'all' ? 'all' : value as WorkspacePreset;
        searchForm.page = 1;
        void loadQueue();
    },
});
const hasActiveFilters = computed(() => Boolean(
    searchForm.q.trim() || searchForm.patientId || searchForm.from || searchForm.to || statusPreset.value !== 'all',
));
const activeFilterBadgeLabels = computed(() => {
    const labels: string[] = [];
    if (searchForm.q.trim()) labels.push(`Search: ${searchForm.q.trim()}`);
    if (statusPreset.value !== 'all') labels.push(`Status: ${quickPresetLabel(statusPreset.value)}`);
    if (searchForm.patientId) labels.push(`Patient: ${patientDisplayName(searchForm.patientId)}`);
    if (searchForm.from) labels.push(`From: ${formatDateOnly(searchForm.from)}`);
    if (searchForm.to) labels.push(`To: ${formatDateOnly(searchForm.to)}`);
    return labels;
});

const isProviderStatusDialog = computed(() => statusDialogMode.value === 'provider');

const statusDialogNeedsReason = computed(() =>
    statusForm.status === 'cancelled'
    || statusForm.status === 'no_show'
    || (isProviderStatusDialog.value && statusForm.status === 'waiting_triage'),
);

const statusDialogTitle = computed(() => {
    if (isProviderStatusDialog.value) {
        switch (statusForm.status) {
            case 'waiting_triage':
                return 'Send back to triage';
            case 'waiting_provider':
                return 'Return to provider queue';
            case 'completed':
                return 'Complete visit';
            default:
                return 'Update provider workflow';
        }
    }

    switch (statusForm.status) {
        case 'waiting_triage':
            return 'Mark patient checked in';
        case 'completed':
            return 'Close appointment visit';
        case 'no_show':
            return 'Record no-show';
        case 'cancelled':
            return 'Cancel appointment';
        default:
            return 'Update appointment';
    }
});

const statusDialogDescription = computed(() => {
    if (isProviderStatusDialog.value) {
        switch (statusForm.status) {
            case 'waiting_triage':
                return 'Return this visit to nurse triage when more vitals, prep work, or nursing review is needed before the provider continues.';
            case 'waiting_provider':
                return 'Move this visit back into the provider-ready queue without sending it to nursing triage.';
            case 'completed':
                return 'Close the visit after provider review and charting are complete.';
            default:
                return 'Update the provider workflow.';
        }
    }

    switch (statusForm.status) {
        case 'waiting_triage':
            return 'Confirm the patient has arrived and hand this visit to nursing triage for vitals and intake review.';
        case 'completed':
            return 'Close the appointment after care or handoff is complete.';
        case 'no_show':
            return 'Record that the patient did not arrive for the scheduled visit.';
        case 'cancelled':
            return 'Cancel this appointment and capture the reason when needed.';
        default:
            return 'Update the appointment workflow.';
    }
});

const statusDialogAfterStep = computed(() => {
    if (isProviderStatusDialog.value) {
        switch (statusForm.status) {
            case 'waiting_triage':
                return 'The visit moves back to nurse triage so nursing staff can repeat vitals, reassess intake, or complete additional prep before provider review resumes.';
            case 'waiting_provider':
                return 'The visit leaves active consultation and returns to the provider-ready queue.';
            case 'completed':
                return 'The visit moves to closed history and stays available for downstream follow-up workflows.';
            default:
                return 'Provider workflow updates immediately.';
        }
    }

    switch (statusForm.status) {
        case 'waiting_triage':
            return 'The visit moves into nurse triage so vitals and intake notes can be recorded before provider handoff.';
        case 'completed':
            return 'Appointment moves to closed history.';
        case 'no_show':
            return 'Appointment moves to exceptions for follow-up.';
        case 'cancelled':
            return 'Appointment moves out of active front-desk work.';
        default:
            return 'Appointment workflow updates immediately.';
    }
});

const statusDialogReasonPlaceholder = computed(() => {
    if (isProviderStatusDialog.value && statusForm.status === 'waiting_triage') {
        return 'Explain what nursing staff should recheck or complete before provider review resumes.';
    }
    return statusForm.status === 'no_show'
        ? 'Explain why the patient missed the visit.'
        : 'Explain why the appointment was cancelled.';
});

const referralStatusNeedsReason = computed(() =>
    referralStatusForm.status === 'cancelled' || referralStatusForm.status === 'rejected',
);

const referralStatusDialogTitle = computed(() => {
    switch (referralStatusForm.status) {
        case 'accepted':
            return 'Accept referral';
        case 'in_progress':
            return 'Start handoff';
        case 'completed':
            return 'Complete handoff';
        case 'rejected':
            return 'Reject referral';
        case 'cancelled':
            return 'Cancel referral';
        default:
            return 'Update referral';
    }
});

const referralStatusDialogDescription = computed(() => {
    switch (referralStatusForm.status) {
        case 'accepted':
            return 'Confirm the receiving team has accepted this referral.';
        case 'in_progress':
            return 'Record that the handoff is now actively underway.';
        case 'completed':
            return 'Close the referral after the receiving team takes over.';
        case 'rejected':
            return 'Record why the receiving team rejected this referral.';
        case 'cancelled':
            return 'Cancel the referral and capture the operational reason.';
        default:
            return 'Update the referral workflow.';
    }
});

const referralStatusAfterStep = computed(() => {
    switch (referralStatusForm.status) {
        case 'accepted':
            return 'Referral becomes ready for active handoff.';
        case 'in_progress':
            return 'Handoff becomes the active focus for follow-up.';
        case 'completed':
            return 'Referral moves into completed history.';
        case 'rejected':
            return 'Referral returns to follow-up and needs a new plan.';
        case 'cancelled':
            return 'Referral closes without completing handoff.';
        default:
            return 'Referral workflow updates immediately.';
    }
});

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

function queryPositiveIntParam(name: string, fallback: number): number {
    const parsed = Number.parseInt(queryParam(name), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function queryPerPageParam(name: string, fallback: number, allowed: number[]): number {
    const value = queryPositiveIntParam(name, fallback);
    return allowed.includes(value) ? value : fallback;
}

function queryDateFilterParam(name: string): string {
    const value = queryParam(name).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function queryPresetParam(): WorkspacePreset {
    const raw = queryParam('status');
    if (raw === 'scheduled' || raw === 'waiting_triage' || raw === 'waiting_provider' || raw === 'in_consultation' || raw === 'completed' || raw === 'exceptions') {
        return raw;
    }
    return 'all';
}
function queryQueueModeParam(): QueueMode {
    const raw = queryParam('view');
    if (raw === 'triage' || raw === 'clinical') return raw;
    return 'all';
}
function shouldOpenCreateFromQuery(): boolean {
    return queryParam('tab') === 'new' || queryParam('open') === 'schedule';
}

function createPrefillQueryValues() {
    return {
        patientId: queryParam('patientId').trim(),
        sourceAdmissionId: queryParam('sourceAdmissionId').trim(),
        clinicianUserId: queryParam('createClinicianUserId').trim(),
        department: queryParam('createDepartment').trim(),
        scheduledAt: queryParam('createScheduledAt').trim(),
        durationMinutes: queryParam('createDurationMinutes').trim(),
        reason: queryParam('createReason').trim(),
        notes: queryParam('createNotes').trim(),
        financialClass: queryParam('createFinancialClass').trim(),
        billingPayerContractId: queryParam('createBillingPayerContractId').trim(),
        coverageReference: queryParam('createCoverageReference').trim(),
        coverageNotes: queryParam('createCoverageNotes').trim(),
    };
}

function clearCreateQueryIntent(): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('tab');
    url.searchParams.delete('open');
    url.searchParams.delete('patientName');
    url.searchParams.delete('patientNumber');
    url.searchParams.delete('sourceAdmissionId');
    url.searchParams.delete('createClinicianUserId');
    url.searchParams.delete('createDepartment');
    url.searchParams.delete('createScheduledAt');
    url.searchParams.delete('createDurationMinutes');
    url.searchParams.delete('createReason');
    url.searchParams.delete('createNotes');
    url.searchParams.delete('createFinancialClass');
    url.searchParams.delete('createBillingPayerContractId');
    url.searchParams.delete('createCoverageReference');
    url.searchParams.delete('createCoverageNotes');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function uniqueDepartmentOptions(options: DepartmentOption[]): DepartmentOption[] {
    const seen = new Set<string>();

    return options.filter((option) => {
        const key = option.value.trim().toLowerCase();
        if (key === '' || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function mergeSelectedDepartmentOption(options: DepartmentOption[], selectedValue: string): DepartmentOption[] {
    const value = selectedValue.trim();
    if (value === '') return options;

    const exists = options.some((option) => option.value.trim().toLowerCase() === value.toLowerCase());
    if (exists) return options;

    return [
        {
            value,
            label: `${value} (Current)`,
            group: 'Legacy / uncategorized',
            description: 'Existing appointment department value not yet linked to the registry.',
            keywords: ['legacy'],
        },
        ...options,
    ];
}


function csrfToken(): string | null {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
}

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: {
        query?: Record<string, string | number | null | undefined>;
        body?: Record<string, unknown>;
    },
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);

    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    let body: string | undefined;
    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        const token = csrfToken();
        if (token) headers['X-CSRF-TOKEN'] = token;
        body = JSON.stringify(options?.body ?? {});
    }

    const response = await fetch(url.toString(), {
        method,
        credentials: 'same-origin',
        headers,
        body,
    });

    const payload = (await response.json().catch(() => ({}))) as ValidationPayload;
    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as ApiError;
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload as T;
}

function appointmentFromConflictContext(value: unknown): Appointment | null {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<Appointment>;
    if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
        return null;
    }

    return {
        id: candidate.id,
        appointmentNumber: candidate.appointmentNumber ?? null,
        patientId: candidate.patientId ?? null,
        sourceAdmissionId: candidate.sourceAdmissionId ?? null,
        clinicianUserId: candidate.clinicianUserId ?? null,
        department: candidate.department ?? null,
        scheduledAt: candidate.scheduledAt ?? null,
        durationMinutes: candidate.durationMinutes ?? null,
        reason: candidate.reason ?? null,
        notes: candidate.notes ?? null,
        financialClass: candidate.financialClass ?? null,
        billingPayerContractId: candidate.billingPayerContractId ?? null,
        coverageReference: candidate.coverageReference ?? null,
        coverageNotes: candidate.coverageNotes ?? null,
        triageVitalsSummary: candidate.triageVitalsSummary ?? null,
        triageNotes: candidate.triageNotes ?? null,
        triagedAt: candidate.triagedAt ?? null,
        triagedByUserId: candidate.triagedByUserId ?? null,
        consultationStartedAt: candidate.consultationStartedAt ?? null,
        consultationOwnerUserId: candidate.consultationOwnerUserId ?? null,
        consultationOwnerAssignedAt: candidate.consultationOwnerAssignedAt ?? null,
        consultationTakeoverCount: candidate.consultationTakeoverCount ?? null,
        status: candidate.status ?? null,
        statusReason: candidate.statusReason ?? null,
        createdAt: candidate.createdAt ?? null,
        updatedAt: candidate.updatedAt ?? null,
    };
}

function billingPayerContractById(id: string | null | undefined): BillingPayerContract | null {
    const normalized = String(id ?? '').trim();
    if (!normalized) return null;

    return billingPayerContracts.value.find((contract) => contract.id === normalized) ?? null;
}

function payerContractLabel(contract: BillingPayerContract): string {
    return (contract.contractName ?? contract.contractCode ?? contract.payerName ?? 'Unnamed payer contract').trim();
}

function payerContractDescription(contract: BillingPayerContract): string {
    return [
        contract.contractCode,
        contract.payerName,
        contract.payerPlanName,
        contract.currencyCode,
    ]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join(' | ');
}

function appointmentPayerContractLabel(appointment: Appointment | null | undefined): string {
    if (!appointment?.billingPayerContractId) {
        return isThirdPartyFinancialClass(appointment?.financialClass) ? 'Contract pending' : 'Not needed';
    }

    const contract = billingPayerContractById(appointment.billingPayerContractId);
    if (!contract) {
        return 'Linked contract';
    }

    return payerContractLabel(contract);
}

const createBillingPayerContractOptions = computed<SearchableSelectOption[]>(() =>
    billingPayerContracts.value.map((contract) => ({
        value: contract.id,
        label: payerContractLabel(contract),
        description: payerContractDescription(contract),
        group: financialClassLabel(contract.payerType),
        keywords: [
            contract.contractCode,
            contract.contractName,
            contract.payerName,
            contract.payerPlanCode,
            contract.payerPlanName,
            contract.currencyCode,
            financialClassLabel(contract.payerType),
        ]
            .map((value) => String(value ?? '').trim())
            .filter(Boolean),
    })),
);

const selectedCreateBillingPayerContract = computed(() =>
    billingPayerContractById(createForm.billingPayerContractId),
);
const createCoverageIsThirdParty = computed(() =>
    isThirdPartyFinancialClass(createForm.financialClass),
);
const createCoverageMode = computed<'self_pay' | 'third_party'>({
    get: () => (createCoverageIsThirdParty.value ? 'third_party' : 'self_pay'),
    set: (value) => {
        if (value === 'self_pay') {
            createForm.financialClass = 'self_pay';
            return;
        }

        if (!createCoverageIsThirdParty.value) {
            createForm.financialClass = 'insurance';
        }
    },
});

const createCoverageSummary = computed(() =>
    compactVisitCoverageSummary({
        financialClass: createForm.financialClass,
        billingPayerContractId: createForm.billingPayerContractId,
        coverageReference: createForm.coverageReference,
        coverageNotes: createForm.coverageNotes,
    }),
);
const createCoverageGuidance = computed(() => {
    if (!createCoverageIsThirdParty.value) {
        return 'Self-pay is selected. Billing will open the visit as direct patient payment and charge the actual services recorded during care.';
    }

    const contract = selectedCreateBillingPayerContract.value;
    if (contract) {
        return `${payerContractLabel(contract)} is linked as the current payer path for this visit. Billing and claims will inherit it.`;
    }

    if (!canReadBillingPayerContracts.value) {
        return 'Third-party coverage is selected. Front desk can capture the coverage class here, and Billing can attach the exact payer contract later.';
    }

    return 'Third-party coverage is selected. Choose the active payer contract when known, then capture member or authorization details for claims readiness.';
});

async function loadBillingPayerContracts(): Promise<void> {
    if (!canReadBillingPayerContracts.value) {
        billingPayerContracts.value = [];
        billingPayerContractsError.value = null;
        billingPayerContractsLoading.value = false;
        billingPayerContractsLoaded.value = false;
        return;
    }

    billingPayerContractsLoading.value = true;
    billingPayerContractsError.value = null;

    try {
        const response = await apiRequest<BillingPayerContractListResponse>('GET', '/billing-payer-contracts', {
            query: {
                status: 'active',
                perPage: 200,
                sortBy: 'contractName',
                sortDir: 'asc',
            },
        });
        billingPayerContracts.value = response.data ?? [];
    } catch (error) {
        billingPayerContracts.value = [];
        billingPayerContractsError.value = messageFromUnknown(error, 'Unable to load payer contracts.');
    } finally {
        billingPayerContractsLoading.value = false;
        billingPayerContractsLoaded.value = true;
    }
}

function statusVariant(status: string | null | undefined) {
    switch (status) {
        case 'waiting_provider':
        case 'in_consultation':
            return 'default';
        case 'waiting_triage':
            return 'outline';
        case 'completed':
            return 'secondary';
        case 'cancelled':
        case 'no_show':
            return 'destructive';
        default:
            return 'outline';
    }
}

function medicalRecordStatusVariant(status: string | null | undefined) {
    switch ((status ?? '').toLowerCase()) {
        case 'draft':
            return 'outline';
        case 'finalized':
        case 'amended':
            return 'secondary';
        case 'archived':
            return 'destructive';
        default:
            return 'outline';
    }
}

function laboratoryOrderStatusVariant(status: string | null | undefined) {
    switch ((status ?? '').toLowerCase()) {
        case 'ordered':
        case 'collected':
        case 'in_progress':
            return 'default';
        case 'completed':
            return 'secondary';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function pharmacyOrderStatusVariant(status: string | null | undefined) {
    switch ((status ?? '').toLowerCase()) {
        case 'pending':
        case 'in_preparation':
        case 'partially_dispensed':
            return 'default';
        case 'dispensed':
        case 'reconciliation_completed':
            return 'secondary';
        case 'cancelled':
        case 'reconciliation_exception':
            return 'destructive';
        default:
            return 'outline';
    }
}

function pharmacyOrderSummaryText(order: PharmacyOrder): string {
    if ((order.dosageInstruction ?? '').trim() !== '') {
        return order.dosageInstruction as string;
    }

    if ((order.dispensedAt ?? '').trim() !== '') {
        return `Dispensed ${formatDateTime(order.dispensedAt)}`;
    }

    return 'Awaiting pharmacy preparation.';
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

function radiologyOrderStatusVariant(status: string | null | undefined) {
    switch ((status ?? '').toLowerCase()) {
        case 'scheduled':
        case 'in_progress':
            return 'secondary';
        case 'completed':
            return 'default';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function radiologyOrderSummaryText(order: RadiologyOrder): string {
    if ((order.reportSummary ?? '').trim() !== '') {
        return order.reportSummary as string;
    }

    if ((order.modality ?? '').trim() !== '') {
        return `Modality: ${formatEnumLabel(order.modality)}`;
    }

    if ((order.completedAt ?? '').trim() !== '') {
        return `Reported ${formatDateTime(order.completedAt)}`;
    }

    return 'Awaiting imaging scheduling or execution.';
}

function theatreProcedureStatusVariant(status: string | null | undefined) {
    switch ((status ?? '').toLowerCase()) {
        case 'planned':
        case 'in_preop':
        case 'in_progress':
            return 'default';
        case 'completed':
            return 'secondary';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function theatreProcedureSummaryText(procedure: TheatreProcedure): string {
    if ((procedure.statusReason ?? '').trim() !== '') {
        return procedure.statusReason as string;
    }

    if ((procedure.notes ?? '').trim() !== '') {
        return procedure.notes as string;
    }

    if ((procedure.theatreRoomName ?? '').trim() !== '') {
        return `Room: ${procedure.theatreRoomName}`;
    }

    if ((procedure.completedAt ?? '').trim() !== '') {
        return `Completed ${formatDateTime(procedure.completedAt)}`;
    }

    return 'Awaiting theatre scheduling and case progression.';
}

function detailsEncounterCareState(
    itemCount: number,
    loading: boolean,
    error: string | null | undefined,
): EncounterCareState {
    if (loading) return 'loading';
    if ((error ?? '').trim() !== '') return 'issue';
    if (itemCount > 0) return 'active';
    return 'empty';
}

function detailsEncounterCareStateVariant(state: EncounterCareState) {
    switch (state) {
        case 'loading':
            return 'outline';
        case 'issue':
            return 'destructive';
        case 'active':
            return 'secondary';
        default:
            return 'outline';
    }
}

function detailsEncounterCareStateLabel(state: EncounterCareState): string {
    switch (state) {
        case 'loading':
            return 'Loading';
        case 'issue':
            return 'Issue';
        case 'active':
            return 'Has records';
        default:
            return 'Empty';
    }
}

function availableEncounterCareSectionIds(): EncounterCareSectionId[] {
    const ids: EncounterCareSectionId[] = [];

    if (canReadLaboratory.value) ids.push('laboratory-orders');
    if (canReadPharmacy.value) ids.push('pharmacy-orders');
    if (canReadRadiology.value) ids.push('radiology-orders');
    if (canReadTheatre.value) ids.push('theatre-procedures');

    return ids;
}

function canShowEncounterCareForAppointment(
    appointment: Appointment | null | undefined,
): boolean {
    return Boolean(appointment?.patientId) && availableEncounterCareSectionIds().length > 0;
}

function detailsEncounterCareStateBySectionId(id: EncounterCareSectionId): EncounterCareState {
    switch (id) {
        case 'laboratory-orders':
            return detailsEncounterCareState(
                detailsLaboratoryOrders.value.length,
                detailsLaboratoryOrdersLoading.value,
                detailsLaboratoryOrdersError.value,
            );
        case 'pharmacy-orders':
            return detailsEncounterCareState(
                detailsPharmacyOrders.value.length,
                detailsPharmacyOrdersLoading.value,
                detailsPharmacyOrdersError.value,
            );
        case 'radiology-orders':
            return detailsEncounterCareState(
                detailsRadiologyOrders.value.length,
                detailsRadiologyOrdersLoading.value,
                detailsRadiologyOrdersError.value,
            );
        case 'theatre-procedures':
            return detailsEncounterCareState(
                detailsTheatreProcedures.value.length,
                detailsTheatreProceduresLoading.value,
                detailsTheatreProceduresError.value,
            );
        default:
            return 'empty';
    }
}

const detailsEncounterCareSummaries = computed<EncounterCareSummary[]>(() => {
    const summaries: EncounterCareSummary[] = [];

    if (canReadLaboratory.value) {
        summaries.push({
            id: 'laboratory-orders',
            label: 'Laboratory',
            icon: 'flask-conical',
            singularLabel: 'order',
            pluralLabel: 'orders',
            count: detailsLaboratoryOrders.value.length,
            state: detailsEncounterCareStateBySectionId('laboratory-orders'),
        });
    }

    if (canReadPharmacy.value) {
        summaries.push({
            id: 'pharmacy-orders',
            label: 'Pharmacy',
            icon: 'pill',
            singularLabel: 'order',
            pluralLabel: 'orders',
            count: detailsPharmacyOrders.value.length,
            state: detailsEncounterCareStateBySectionId('pharmacy-orders'),
        });
    }

    if (canReadRadiology.value) {
        summaries.push({
            id: 'radiology-orders',
            label: 'Imaging',
            icon: 'activity',
            singularLabel: 'order',
            pluralLabel: 'orders',
            count: detailsRadiologyOrders.value.length,
            state: detailsEncounterCareStateBySectionId('radiology-orders'),
        });
    }

    if (canReadTheatre.value) {
        summaries.push({
            id: 'theatre-procedures',
            label: 'Theatre',
            icon: 'scissors',
            singularLabel: 'procedure',
            pluralLabel: 'procedures',
            count: detailsTheatreProcedures.value.length,
            state: detailsEncounterCareStateBySectionId('theatre-procedures'),
        });
    }

    return summaries;
});

const detailsEncounterCareTotalCount = computed(() => (
    detailsEncounterCareSummaries.value.reduce((total, summary) => total + summary.count, 0)
));

const detailsEncounterCareActiveCount = computed(() => (
    detailsEncounterCareSummaries.value.filter((summary) => summary.state === 'active').length
));

function syncDetailsEncounterCareOpenState(force = false): void {
    if (!canShowEncounterCareForAppointment(detailsAppointment.value)) {
        detailsEncounterCareOpen.value = [];
        return;
    }

    const available = availableEncounterCareSectionIds();

    if (available.length === 0) {
        detailsEncounterCareOpen.value = [];
        return;
    }

    const sanitized = detailsEncounterCareOpen.value.filter((id) => available.includes(id));

    if (force) {
        detailsEncounterCareOpen.value = [];
        return;
    }

    if (sanitized.length !== detailsEncounterCareOpen.value.length) {
        detailsEncounterCareOpen.value = sanitized;
    }
}

function referralPriorityVariant(priority: string | null | undefined) {
    switch (priority) {
        case 'critical':
            return 'destructive';
        case 'urgent':
            return 'default';
        default:
            return 'outline';
    }
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function formatDateOnly(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

function normalizeLocalDateTimeForApi(value: string): string {
    if (!value) return value;
    const normalized = value.replace('T', ' ');
    return normalized.length === 16 ? `${normalized}:00` : normalized;
}

function normalizeApiDateTimeForInput(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value).replace(' ', 'T').slice(0, 16);
    }
    const pad = (segment: number) => String(segment).padStart(2, '0');
    return [
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    ].join('T');
}

function defaultScheduledAtInput(): string {
    const date = new Date();
    date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
    date.setHours(date.getHours() + 1);
    return normalizeApiDateTimeForInput(date.toISOString());
}

function patientDisplayName(patientId: string | null | undefined): string {
    const normalizedId = String(patientId ?? '').trim();
    if (!normalizedId) return 'Patient pending';
    const patient = patientDirectory.value[normalizedId];
    if (!patient) {
        if (normalizedId === initialPatientId && initialPatientName) return initialPatientName;
        if (normalizedId === initialPatientId && initialPatientNumber) return initialPatientNumber;
        return `Patient ${normalizedId.slice(0, 8)}...`;
    }
    const fullName = [patient.firstName, patient.middleName, patient.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
    return fullName || patient.patientNumber || `Patient ${normalizedId.slice(0, 8)}...`;
}

function patientMeta(patientId: string | null | undefined): string {
    const normalizedId = String(patientId ?? '').trim();
    if (!normalizedId) return 'No patient linked';
    const patient = patientDirectory.value[normalizedId];
    if (!patient) {
        if (normalizedId === initialPatientId) {
            const previewParts = [initialPatientNumber || null].filter(Boolean);
            return previewParts.join(' | ') || 'Chart linked';
        }
        return 'Chart linked';
    }
    const parts = [patient.patientNumber, patient.phone].filter(Boolean);
    return parts.join(' | ') || 'Chart linked';
}

function shortEntityReference(id: string | null | undefined, label: string): string {
    const normalizedId = String(id ?? '').trim();
    if (normalizedId === '') return label;
    return `${label} ${normalizedId.slice(0, 8)}...`;
}

function orderLifecycleLinkageText(
    entry: { replacesOrderId?: string | null; addOnToOrderId?: string | null },
    label: string,
): string | null {
    const replacesOrderId = String(entry.replacesOrderId ?? '').trim();
    if (replacesOrderId !== '') {
        return `Replacement for ${shortEntityReference(replacesOrderId, label)}.`;
    }

    const addOnToOrderId = String(entry.addOnToOrderId ?? '').trim();
    if (addOnToOrderId !== '') {
        return `Linked follow-up to ${shortEntityReference(addOnToOrderId, label)}.`;
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
    if (!order || !canCreateLaboratory.value || isEncounterOrderEnteredInError(order)) {
        return false;
    }

    if (action === 'cancel') {
        return order.status !== 'cancelled' && order.status !== 'completed';
    }

    return true;
}

function canApplyPharmacyEncounterLifecycleAction(
    order: PharmacyOrder | null,
    action: 'cancel' | 'discontinue' | 'entered_in_error',
): boolean {
    if (!order || !canCreatePharmacy.value || isEncounterOrderEnteredInError(order)) {
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

function canApplyRadiologyEncounterLifecycleAction(
    order: RadiologyOrder | null,
    action: 'cancel' | 'entered_in_error',
): boolean {
    if (!order || !canCreateRadiology.value || isEncounterOrderEnteredInError(order)) {
        return false;
    }

    if (action === 'cancel') {
        return order.status !== 'cancelled' && order.status !== 'completed';
    }

    return true;
}

function canApplyTheatreEncounterLifecycleAction(
    procedure: TheatreProcedure | null,
    action: 'cancel' | 'entered_in_error',
): boolean {
    if (!procedure || !canCreateTheatre.value || isEncounterOrderEnteredInError(procedure)) {
        return false;
    }

    if (action === 'cancel') {
        return procedure.status !== 'cancelled' && procedure.status !== 'completed';
    }

    return true;
}

function encounterLifecycleActionLabel(action: EncounterLifecycleAction | null): string {
    if (action === 'cancel') return 'Cancel';
    if (action === 'discontinue') return 'Discontinue';
    if (action === 'entered_in_error') return 'Mark Entered In Error';
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
    detailsLifecycleTargetKind.value = kind;
    detailsLifecycleTargetId.value = id;
    detailsLifecycleAction.value = action;
    detailsLifecycleReason.value = String(defaultReason ?? '').trim();
    detailsLifecycleError.value = null;
    detailsLifecycleDialogOpen.value = true;
}

function closeEncounterLifecycleDialog(): void {
    detailsLifecycleDialogOpen.value = false;
    detailsLifecycleTargetKind.value = null;
    detailsLifecycleTargetId.value = '';
    detailsLifecycleAction.value = null;
    detailsLifecycleReason.value = '';
    detailsLifecycleError.value = null;
}

function replaceEncounterOrderInCollections(
    kind: EncounterLifecycleTargetKind,
    updated: LaboratoryOrder | PharmacyOrder | RadiologyOrder | TheatreProcedure,
): void {
    if (kind === 'laboratory') {
        detailsLaboratoryOrders.value = detailsLaboratoryOrders.value.map((order) =>
            order.id === updated.id ? (updated as LaboratoryOrder) : order,
        );
        return;
    }

    if (kind === 'pharmacy') {
        detailsPharmacyOrders.value = detailsPharmacyOrders.value.map((order) =>
            order.id === updated.id ? (updated as PharmacyOrder) : order,
        );
        return;
    }

    if (kind === 'radiology') {
        detailsRadiologyOrders.value = detailsRadiologyOrders.value.map((order) =>
            order.id === updated.id ? (updated as RadiologyOrder) : order,
        );
        return;
    }

    detailsTheatreProcedures.value = detailsTheatreProcedures.value.map((procedure) =>
        procedure.id === updated.id ? (updated as TheatreProcedure) : procedure,
    );
}

function encounterLifecycleTargetName(): string {
    if (!detailsLifecycleTargetKind.value || !detailsLifecycleTargetId.value) {
        return 'this order';
    }

    if (detailsLifecycleTargetKind.value === 'laboratory') {
        const target = detailsLaboratoryOrders.value.find(
            (order) => order.id === detailsLifecycleTargetId.value,
        );
        return target?.testName?.trim() || target?.orderNumber?.trim() || 'this laboratory order';
    }

    if (detailsLifecycleTargetKind.value === 'pharmacy') {
        const target = detailsPharmacyOrders.value.find(
            (order) => order.id === detailsLifecycleTargetId.value,
        );
        return target?.medicationName?.trim() || target?.orderNumber?.trim() || 'this medication order';
    }

    if (detailsLifecycleTargetKind.value === 'radiology') {
        const target = detailsRadiologyOrders.value.find(
            (order) => order.id === detailsLifecycleTargetId.value,
        );
        return target?.studyDescription?.trim() || target?.orderNumber?.trim() || 'this imaging order';
    }

    const target = detailsTheatreProcedures.value.find(
        (procedure) => procedure.id === detailsLifecycleTargetId.value,
    );
    return (
        target?.procedureName?.trim()
        || target?.procedureType?.trim()
        || target?.procedureNumber?.trim()
        || 'this procedure booking'
    );
}

async function submitEncounterLifecycleDialog(): Promise<void> {
    if (
        !detailsLifecycleTargetKind.value
        || !detailsLifecycleTargetId.value
        || !detailsLifecycleAction.value
    ) {
        return;
    }

    const reason = detailsLifecycleReason.value.trim();
    if (!reason) {
        detailsLifecycleError.value = 'Clinical reason is required.';
        return;
    }

    detailsLifecycleSubmitting.value = true;
    detailsLifecycleError.value = null;

    try {
        const response = await apiRequest<{
            data: LaboratoryOrder | PharmacyOrder | RadiologyOrder | TheatreProcedure;
        }>(
            'POST',
            encounterLifecycleActionPath(
                detailsLifecycleTargetKind.value,
                detailsLifecycleTargetId.value,
            ),
            {
                body: {
                    action: detailsLifecycleAction.value,
                    reason,
                },
            },
        );

        replaceEncounterOrderInCollections(
            detailsLifecycleTargetKind.value,
            response.data,
        );
        notifySuccess(encounterLifecycleActionSuccessMessage(detailsLifecycleAction.value));
        closeEncounterLifecycleDialog();
    } catch (error) {
        detailsLifecycleError.value = messageFromUnknown(
            error,
            'Unable to apply lifecycle action.',
        );
        notifyError(detailsLifecycleError.value);
    } finally {
        detailsLifecycleSubmitting.value = false;
    }
}

function clinicianDisplayLabel(userId: number | null | undefined): string {
    if (userId === null || userId === undefined) return 'Not linked';
    const profile = clinicianDirectory.value.find((row) => row.userId === userId);
    if (!profile) return `User ID ${userId}`;

    const userName = String(profile.userName ?? '').trim();
    const jobTitle = String(profile.jobTitle ?? '').trim();
    const primarySpecialty = String(profile.primarySpecialtyName ?? '').trim();
    const employeeNumber = String(profile.employeeNumber ?? '').trim();
    const primary = userName || employeeNumber || `User ID ${userId}`;
    const secondary = [jobTitle, primarySpecialty].filter(Boolean).join(' - ');

    return [primary, secondary].filter(Boolean).join(' - ');
}

async function hydratePatientSummary(patientId: string | null | undefined): Promise<void> {
    const normalizedId = String(patientId ?? '').trim();
    if (!normalizedId || patientDirectory.value[normalizedId] || pendingPatientLookupIds.has(normalizedId)) return;

    pendingPatientLookupIds.add(normalizedId);
    try {
        const response = await apiRequest<ApiItemResponse<PatientSummary>>('GET', `/patients/${normalizedId}`);
        patientDirectory.value = {
            ...patientDirectory.value,
            [normalizedId]: response.data,
        };
    } catch {
        // Keep appointments usable when patient hydration is unavailable.
    } finally {
        pendingPatientLookupIds.delete(normalizedId);
    }
}

async function requestAdmissionSummary(
    admissionId: string | null | undefined,
): Promise<AdmissionSummary | null> {
    const normalizedId = String(admissionId ?? '').trim();
    if (!normalizedId) return null;

    const response = await apiRequest<ApiItemResponse<AdmissionSummary>>(
        'GET',
        `/admissions/${normalizedId}`,
    );

    return response.data ?? null;
}

async function loadCreateSourceAdmissionSummary(
    admissionId: string | null | undefined,
): Promise<void> {
    const requestId = ++createSourceAdmissionRequestId;
    const normalizedId = String(admissionId ?? '').trim();
    if (!normalizedId || !canReadAdmissions.value) {
        createSourceAdmissionSummary.value = null;
        createSourceAdmissionError.value = null;
        createSourceAdmissionLoading.value = false;
        return;
    }

    createSourceAdmissionLoading.value = true;
    createSourceAdmissionError.value = null;
    try {
        const summary = await requestAdmissionSummary(normalizedId);
        if (requestId !== createSourceAdmissionRequestId) return;
        createSourceAdmissionSummary.value = summary;
    } catch (error) {
        if (requestId !== createSourceAdmissionRequestId) return;
        createSourceAdmissionSummary.value = null;
        createSourceAdmissionError.value = messageFromUnknown(
            error,
            'Unable to load source discharge handoff.',
        );
    } finally {
        if (requestId === createSourceAdmissionRequestId) {
            createSourceAdmissionLoading.value = false;
        }
    }
}

async function loadDetailsSourceAdmissionSummary(
    admissionId: string | null | undefined,
): Promise<void> {
    const requestId = ++detailsSourceAdmissionRequestId;
    const normalizedId = String(admissionId ?? '').trim();
    if (!normalizedId || !canReadAdmissions.value) {
        detailsSourceAdmissionSummary.value = null;
        detailsSourceAdmissionError.value = null;
        detailsSourceAdmissionLoading.value = false;
        return;
    }

    detailsSourceAdmissionLoading.value = true;
    detailsSourceAdmissionError.value = null;
    try {
        const summary = await requestAdmissionSummary(normalizedId);
        if (requestId !== detailsSourceAdmissionRequestId) return;
        detailsSourceAdmissionSummary.value = summary;
    } catch (error) {
        if (requestId !== detailsSourceAdmissionRequestId) return;
        detailsSourceAdmissionSummary.value = null;
        detailsSourceAdmissionError.value = messageFromUnknown(
            error,
            'Unable to load source admission handoff.',
        );
    } finally {
        if (requestId === detailsSourceAdmissionRequestId) {
            detailsSourceAdmissionLoading.value = false;
        }
    }
}

async function hydrateVisiblePatients(rows: Appointment[]): Promise<void> {
    const uniqueIds = [...new Set(rows.map((row) => String(row.patientId ?? '').trim()).filter(Boolean))];
    await Promise.all(uniqueIds.map((id) => hydratePatientSummary(id)));
}

function appointmentQuickCount(preset: WorkspacePreset): number {
    if (preset === 'all') return counts.value.total || 0;
    if (preset === 'exceptions') return (counts.value.cancelled || 0) + (counts.value.no_show || 0);
    return counts.value[preset] || 0;
}

function quickPresetLabel(preset: WorkspacePreset): string {
    switch (preset) {
        case 'waiting_triage':
            return 'Waiting triage';
        case 'waiting_provider':
            return 'Ready for provider';
        case 'in_consultation':
            return 'In consultation';
        case 'completed':
            return 'Closed';
        case 'exceptions':
            return 'Follow-up';
        default:
            return formatEnumLabel(preset);
    }
}

function matchesAppointmentPreset(preset: WorkspacePreset): boolean {
    return statusPreset.value === preset;
}

function setPreset(preset: WorkspacePreset): void {
    statusPreset.value = preset;
    searchForm.page = 1;
    void loadQueue();
}

function updateUrl(): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (queueMode.value !== 'all') params.set('view', queueMode.value);
    if (statusPreset.value !== 'all') params.set('status', statusPreset.value);
    if (searchForm.q.trim()) params.set('q', searchForm.q.trim());
    if (searchForm.patientId) params.set('patientId', searchForm.patientId);
    if (searchForm.clinicianUserId) params.set('clinicianUserId', searchForm.clinicianUserId);
    if (searchForm.from) params.set('from', searchForm.from);
    if (searchForm.to) params.set('to', searchForm.to);
    if (searchForm.page > 1) params.set('page', String(searchForm.page));
    if (searchForm.perPage !== 25) params.set('perPage', String(searchForm.perPage));
    if (detailsOpen.value && detailsAppointment.value?.id) {
        params.set('focusAppointmentId', detailsAppointment.value.id);
        if (detailsTab.value !== 'summary') {
            params.set('detailsTab', detailsTab.value);
        }
    }
    const shouldPersistCreateIntent = createIntentActive.value || createSheetOpen.value || createResumeAvailable.value;
    if (shouldPersistCreateIntent) {
        params.set('open', 'schedule');
        if (createForm.patientId.trim()) params.set('patientId', createForm.patientId.trim());
        if (createForm.sourceAdmissionId.trim()) params.set('sourceAdmissionId', createForm.sourceAdmissionId.trim());
        if (createForm.clinicianUserId.trim()) params.set('createClinicianUserId', createForm.clinicianUserId.trim());
        if (createForm.department.trim()) params.set('createDepartment', createForm.department.trim());
        if (createForm.scheduledAt.trim()) params.set('createScheduledAt', createForm.scheduledAt.trim());
        if (createForm.durationMinutes.trim()) params.set('createDurationMinutes', createForm.durationMinutes.trim());
        if (createForm.reason.trim()) params.set('createReason', createForm.reason.trim());
        if (createForm.notes.trim()) params.set('createNotes', createForm.notes.trim());
        if (createForm.financialClass !== 'self_pay') params.set('createFinancialClass', createForm.financialClass);
        if (createForm.billingPayerContractId.trim()) params.set('createBillingPayerContractId', createForm.billingPayerContractId.trim());
        if (createForm.coverageReference.trim()) params.set('createCoverageReference', createForm.coverageReference.trim());
        if (createForm.coverageNotes.trim()) params.set('createCoverageNotes', createForm.coverageNotes.trim());
    }
    const nextUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState(window.history.state, '', nextUrl);
}

async function loadCounts(): Promise<void> {
    const response = await apiRequest<ApiItemResponse<Record<string, number>>>('GET', '/appointments/status-counts', {
        query: {
            q: searchForm.q.trim() || null,
            patientId: searchForm.patientId || null,
            clinicianUserId: searchForm.clinicianUserId || null,
            from: searchForm.from || null,
            to: searchForm.to || null,
        },
    });
    counts.value = {
        scheduled: Number(response.data.scheduled ?? 0),
        waiting_triage: Number(response.data.waiting_triage ?? 0),
        waiting_provider: Number(response.data.waiting_provider ?? 0),
        in_consultation: Number(response.data.in_consultation ?? 0),
        completed: Number(response.data.completed ?? 0),
        cancelled: Number(response.data.cancelled ?? 0),
        no_show: Number(response.data.no_show ?? 0),
        total: Number(response.data.total ?? 0),
    };
}

async function loadQueue(): Promise<void> {
    if (!canRead.value) {
        pageLoading.value = false;
        return;
    }

    listLoading.value = true;
    queueError.value = null;

    try {
        const response = await apiRequest<ApiListResponse<Appointment>>('GET', '/appointments', {
            query: {
                q: searchForm.q.trim() || null,
                patientId: searchForm.patientId || null,
                clinicianUserId: searchForm.clinicianUserId || null,
                status: statusPreset.value === 'all' ? null : statusPreset.value,
                from: searchForm.from || null,
                to: searchForm.to || null,
                page: searchForm.page,
                perPage: searchForm.perPage,
            },
        });

        appointments.value = response.data ?? [];
        pagination.value = {
            currentPage: Number(response.meta?.currentPage ?? response.meta?.current_page ?? 1),
            lastPage: Number(response.meta?.lastPage ?? response.meta?.last_page ?? 1),
            total: Number(response.meta?.total ?? response.data.length ?? 0),
        };
        await hydrateVisiblePatients(appointments.value);
        await loadCounts();
        updateUrl();
    } catch (error) {
        queueError.value = messageFromUnknown(error, 'Unable to load appointments.');
    } finally {
        listLoading.value = false;
        pageLoading.value = false;
    }
}

async function loadDepartmentOptions(): Promise<void> {
    if (!canCreate.value) {
        departmentOptions.value = [];
        departmentOptionsLoading.value = false;
        return;
    }

    departmentOptionsLoading.value = true;
    try {
        const response = await apiRequest<DepartmentListResponse>('GET', '/appointments/department-options');
        departmentOptions.value = uniqueDepartmentOptions(
            (response.data ?? [])
                .map((row) => {
                    const value = String(row.value ?? '').trim();
                    if (value === '') return null;

                    return {
                        value,
                        label: String(row.label ?? '').trim() || value,
                        group: typeof row.group === 'string' && row.group.trim() ? row.group.trim() : null,
                        description: typeof row.description === 'string' && row.description.trim() ? row.description.trim() : null,
                        keywords: Array.isArray(row.keywords)
                            ? row.keywords.map((keyword) => String(keyword).trim()).filter((keyword) => keyword.length > 0)
                            : undefined,
                    } satisfies DepartmentOption;
                })
                .filter((row): row is DepartmentOption => row !== null),
        );
    } catch {
        departmentOptions.value = [];
    } finally {
        departmentOptionsLoading.value = false;
    }
}

async function loadClinicianDirectory(): Promise<void> {
    if (!canReadClinicianDirectory.value) {
        clinicianDirectory.value = [];
        clinicianDirectoryError.value = null;
        clinicianDirectoryLoading.value = false;
        return;
    }

    clinicianDirectoryLoading.value = true;
    clinicianDirectoryError.value = null;
    try {
        const response = await apiRequest<ApiListResponse<StaffProfileSummary>>('GET', '/staff/clinical-directory', {
            query: {
                status: 'active',
                clinicalOnly: 'true',
                page: 1,
                perPage: 200,
            },
        });
        clinicianDirectory.value = response.data ?? [];
    } catch (error) {
        clinicianDirectory.value = [];
        clinicianDirectoryError.value = messageFromUnknown(error, 'Unable to load active clinician directory.');
    } finally {
        clinicianDirectoryLoading.value = false;
    }
}

function createFieldError(key: string): string | null {
    return createErrors.value[key]?.[0] ?? null;
}

function referralFieldError(key: string): string | null {
    return referralErrors.value[key]?.[0] ?? null;
}

function referralStatusFieldError(key: string): string | null {
    return referralStatusErrors.value[key]?.[0] ?? null;
}

function statusFieldError(key: string): string | null {
    return statusErrors.value[key]?.[0] ?? null;
}

function triageFieldError(key: string): string | null {
    return triageErrors.value[key]?.[0] ?? null;
}

function resetCreateAlerts(): void {
    createMessage.value = null;
    createErrors.value = {};
    createConflictAppointment.value = null;
}

function clearCreateDraft(): void {
    resetCreateAlerts();
    createSourceAdmissionRequestId += 1;
    createIntentActive.value = false;
    createResumeAvailable.value = false;
    createPatientLocked.value = false;
    createForm.patientId = '';
    createForm.sourceAdmissionId = '';
    createForm.clinicianUserId = '';
    createForm.department = '';
    createForm.scheduledAt = defaultScheduledAtInput();
    createForm.durationMinutes = '30';
    createForm.reason = '';
    createCustomVisitReason.value = '';
    createClinicianAutoDepartment.value = '';
    createForm.notes = '';
    createForm.financialClass = 'self_pay';
    createForm.billingPayerContractId = '';
    createForm.coverageReference = '';
    createForm.coverageNotes = '';
    createSourceAdmissionSummary.value = null;
    createSourceAdmissionError.value = null;
    createSourceAdmissionLoading.value = false;
}

function resetCreateForm(): void {
    clearCreateDraft();
    createForm.patientId = searchForm.patientId || queryParam('patientId');
}

function applyCreatePrefillFromQuery(): void {
    const prefill = createPrefillQueryValues();
    if (prefill.patientId) createForm.patientId = prefill.patientId;
    if (prefill.sourceAdmissionId) createForm.sourceAdmissionId = prefill.sourceAdmissionId;
    if (prefill.clinicianUserId) createClinicianUserIdValue.value = prefill.clinicianUserId;
    if (prefill.department) createForm.department = prefill.department;
    if (prefill.scheduledAt) createForm.scheduledAt = prefill.scheduledAt;
    if (prefill.durationMinutes) createForm.durationMinutes = prefill.durationMinutes;
    if (prefill.reason) {
        if (COMMON_VISIT_REASON_OPTIONS.some((option) => option.value === prefill.reason)) {
            createVisitReasonValue.value = prefill.reason;
        } else {
            createVisitReasonValue.value = VISIT_REASON_CUSTOM_VALUE;
            createCustomVisitReasonValue.value = prefill.reason;
        }
    }
    if (prefill.notes) createForm.notes = prefill.notes;
    if (prefill.financialClass) createForm.financialClass = normalizeFinancialClass(prefill.financialClass);
    if (prefill.billingPayerContractId) createForm.billingPayerContractId = prefill.billingPayerContractId;
    if (prefill.coverageReference) createForm.coverageReference = prefill.coverageReference;
    if (prefill.coverageNotes) createForm.coverageNotes = prefill.coverageNotes;
}

function handleCreateSheetOpenChange(open: boolean): void {
    if (open) {
        createIntentActive.value = true;
        createResumeAvailable.value = false;
        createSheetOpen.value = true;
        return;
    }

    createSheetOpen.value = false;
    if (createSubmitting.value) return;

    createResumeAvailable.value = hasCreateDraft.value;
    createIntentActive.value = hasCreateDraft.value;
}

function openCreateSheet(options?: { prefillFromQuery?: boolean }): void {
    if (!canCreate.value) return;
    resetCreateForm();
    if (options?.prefillFromQuery) {
        applyCreatePrefillFromQuery();
        createPatientLocked.value = Boolean(createForm.patientId.trim());
    }
    if (createForm.patientId.trim()) {
        void hydratePatientSummary(createForm.patientId);
    }
    if (createForm.sourceAdmissionId.trim()) {
        void loadCreateSourceAdmissionSummary(createForm.sourceAdmissionId);
    }
    if (departmentOptions.value.length === 0 && !departmentOptionsLoading.value) {
        void loadDepartmentOptions();
    }
    if (clinicianDirectory.value.length === 0 && !clinicianDirectoryLoading.value && canReadClinicianDirectory.value) {
        void loadClinicianDirectory();
    }
    if (!billingPayerContractsLoaded.value && !billingPayerContractsLoading.value) {
        void loadBillingPayerContracts();
    }
    createIntentActive.value = true;
    createResumeAvailable.value = false;
    createSheetOpen.value = true;
}

function resumeCreateSheet(): void {
    if (!canCreate.value) return;
    createIntentActive.value = true;
    createResumeAvailable.value = false;
    if (createForm.patientId.trim()) {
        void hydratePatientSummary(createForm.patientId);
    }
    if (createForm.sourceAdmissionId.trim()) {
        void loadCreateSourceAdmissionSummary(createForm.sourceAdmissionId);
    }
    createResumeAvailable.value = false;
    createSheetOpen.value = true;
}

async function submitCreate(): Promise<void> {
    createSubmitting.value = true;
    createErrors.value = {};
    createMessage.value = null;

    try {
        const response = await apiRequest<ApiItemResponse<Appointment>>('POST', '/appointments', {
            body: {
                patientId: createForm.patientId || null,
                sourceAdmissionId: createForm.sourceAdmissionId || null,
                clinicianUserId: createForm.clinicianUserId ? Number(createForm.clinicianUserId) : null,
                department: createForm.department || null,
                scheduledAt: normalizeLocalDateTimeForApi(createForm.scheduledAt),
                durationMinutes: createForm.durationMinutes ? Number(createForm.durationMinutes) : null,
                reason: createForm.reason || null,
                notes: createForm.notes || null,
                appointmentType: createForm.appointmentType || 'scheduled',
                financialClass: createForm.financialClass || 'self_pay',
                billingPayerContractId: createForm.billingPayerContractId || null,
                coverageReference: createForm.coverageReference || null,
                coverageNotes: createForm.coverageNotes || null,
            },
        });

        notifySuccess('Appointment scheduled.');
        clearCreateDraft();
        createSheetOpen.value = false;
        appointments.value = [response.data, ...appointments.value];
        await hydratePatientSummary(response.data.patientId);
        await loadQueue();
        await openDetails(response.data);
    } catch (error) {
        const apiError = error as ApiError;
        createErrors.value = apiError.payload?.errors ?? {};
        createConflictAppointment.value = appointmentFromConflictContext(
            apiError.payload?.context?.activeAppointmentConflict,
        );
        createMessage.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to schedule appointment.');
        notifyError(createMessage.value);
    } finally {
        createSubmitting.value = false;
    }
}

function openStatusDialog(
    appointment: Appointment,
    nextStatus: AppointmentStatus,
    origin: 'queue' | 'details' = 'queue',
): void {
    statusDialogMode.value = 'frontdesk';
    statusTargetAppointment.value = appointment;
    statusDialogOrigin.value = origin;
    statusForm.status = nextStatus;
    statusForm.reason = '';
    statusErrors.value = {};
    statusDialogOpen.value = true;
}

function closeStatusDialog(): void {
    statusDialogOpen.value = false;
    statusSubmitting.value = false;
    statusTargetAppointment.value = null;
    statusDialogMode.value = 'frontdesk';
    statusDialogOrigin.value = 'queue';
    statusForm.status = 'waiting_triage';
    statusForm.reason = '';
    statusErrors.value = {};
}

function openProviderStatusDialog(appointment: Appointment, nextStatus: Extract<AppointmentStatus, 'waiting_triage' | 'waiting_provider' | 'completed'>): void {
    statusDialogMode.value = 'provider';
    statusTargetAppointment.value = appointment;
    statusForm.status = nextStatus;
    statusForm.reason = '';
    statusErrors.value = {};
    statusDialogOpen.value = true;
}

async function submitStatusUpdate(): Promise<void> {
    if (!statusTargetAppointment.value) return;
    const statusOrigin = statusDialogOrigin.value;
    const nextStatus = statusForm.status;
    statusSubmitting.value = true;
    statusErrors.value = {};

    try {
        const endpoint = isProviderStatusDialog.value
            ? '/appointments/' + statusTargetAppointment.value.id + '/provider-workflow'
            : '/appointments/' + statusTargetAppointment.value.id + '/status';
        const response = await apiRequest<ApiItemResponse<Appointment>>(
            'PATCH',
            endpoint,
            {
                body: {
                    status: statusForm.status,
                    reason: statusForm.reason || null,
                },
            },
        );

        replaceAppointmentInState(response.data);
        closeStatusDialog();
        if (statusOrigin === 'details' && nextStatus === 'waiting_triage') {
            detailsStatusNotice.value = {
                title: 'Patient checked in',
                message: 'Check-in was recorded successfully. This visit is now waiting for nurse triage.',
            };
        }
        notifySuccess(isProviderStatusDialog.value ? 'Provider workflow updated.' : 'Appointment updated.');
        await loadQueue();
    } catch (error) {
        const apiError = error as ApiError;
        statusErrors.value = apiError.payload?.errors ?? {};
        notifyError(apiError.payload?.message ?? messageFromUnknown(error, 'Unable to update appointment.'));
    } finally {
        statusSubmitting.value = false;
    }
}

function openTriageSheet(appointment: Appointment): void {
    triageTargetAppointment.value = appointment;
    triageForm.triageVitalsSummary = appointment.triageVitalsSummary || '';
    triageForm.triageNotes = appointment.triageNotes || '';
    triageForm.triageCategory = (appointment.triageCategory as '' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5') || '';
    triageErrors.value = {};
    triageSheetOpen.value = true;
}

function closeTriageSheet(): void {
    triageSheetOpen.value = false;
    triageSubmitting.value = false;
    triageErrors.value = {};
    triageTargetAppointment.value = null;
    triageForm.triageVitalsSummary = '';
    triageForm.triageNotes = '';
    triageForm.triageCategory = '';
}

async function submitTriage(): Promise<void> {
    if (!triageTargetAppointment.value) return;

    triageErrors.value = {};
    if (!triageForm.triageVitalsSummary.trim()) {
        triageErrors.value = {
            triageVitalsSummary: ['Record at least a brief vitals or intake summary before sending the patient to the provider queue.'],
        };
        return;
    }

    triageSubmitting.value = true;

    try {
        const response = await apiRequest<ApiItemResponse<Appointment>>(
            'PATCH',
            `/appointments/${triageTargetAppointment.value.id}/triage`,
            {
                body: {
                    triageVitalsSummary: triageForm.triageVitalsSummary.trim(),
                    triageNotes: triageForm.triageNotes.trim() || null,
                    triageCategory: triageForm.triageCategory || null,
                },
            },
        );
        replaceAppointmentInState(response.data);
        closeTriageSheet();
        notifySuccess('Triage recorded. Patient is now ready for provider review.');
        await loadQueue();
    } catch (error) {
        const apiError = error as ApiError;
        triageErrors.value = apiError.payload?.errors ?? {};
        notifyError(apiError.payload?.message ?? messageFromUnknown(error, 'Unable to record triage.'));
    } finally {
        triageSubmitting.value = false;
    }
}

function isLaunchingConsultation(appointment: Appointment | null | undefined): boolean {
    return Boolean(appointment?.id) && consultationLaunchingAppointmentId.value === appointment?.id;
}

function openConsultationTakeoverDialog(
    appointment: Appointment,
    ownerUserIdOverride: number | null = null,
): void {
    consultationTakeoverTarget.value = ownerUserIdOverride === null
        ? appointment
        : {
            ...appointment,
            consultationOwnerUserId: ownerUserIdOverride,
        };
    consultationTakeoverReason.value = '';
    consultationTakeoverError.value = null;
    consultationTakeoverDialogOpen.value = true;
}

function closeConsultationTakeoverDialog(): void {
    consultationTakeoverDialogOpen.value = false;
    consultationTakeoverTarget.value = null;
    consultationTakeoverReason.value = '';
    consultationTakeoverError.value = null;
    consultationTakeoverSubmitting.value = false;
}

async function submitConsultationTakeover(): Promise<void> {
    const appointment = consultationTakeoverTarget.value;
    if (!appointment || !appointment.id || !appointment.patientId) return;

    consultationTakeoverSubmitting.value = true;
    consultationTakeoverError.value = null;

    try {
        const response = await apiRequest<ApiItemResponse<Appointment>>(
            'PATCH',
            '/appointments/' + appointment.id + '/start-consultation',
            {
                body: {
                    forceTakeover: true,
                    takeoverReason: consultationTakeoverReason.value.trim() || null,
                },
            },
        );

        replaceAppointmentInState(response.data);
        await loadQueue();
        closeConsultationTakeoverDialog();
        notifySuccess('Consultation takeover confirmed. Opening chart.');
        router.visit(consultationWorkflowHref(response.data));
    } catch (error) {
        const apiError = error as ApiError;
        consultationTakeoverError.value = apiError.payload?.errors?.takeoverReason?.[0]
            ?? apiError.payload?.message
            ?? messageFromUnknown(error, 'Unable to take over this consultation session.');
    } finally {
        consultationTakeoverSubmitting.value = false;
    }
}

async function launchConsultationWorkflow(appointment: Appointment): Promise<void> {
    if (!appointment.patientId || isLaunchingConsultation(appointment)) return;

    if (consultationOwnedByAnotherClinician(appointment)) {
        openConsultationTakeoverDialog(appointment);
        return;
    }

    if (appointment.status === 'in_consultation' && consultationOwnedByCurrentClinician(appointment)) {
        router.visit(consultationWorkflowHref(appointment));
        return;
    }

    consultationLaunchingAppointmentId.value = appointment.id;

    try {
        let nextAppointment = appointment;
        const requiresConsultationHandshake = appointment.status === 'waiting_provider'
            || (appointment.status === 'in_consultation' && consultationOwnershipRequiresVerification(appointment));

        if (requiresConsultationHandshake && canStartConsultation.value) {
            const response = await apiRequest<ApiItemResponse<Appointment>>(
                'PATCH',
                '/appointments/' + appointment.id + '/start-consultation',
                {
                    body: {
                        status: 'in_consultation',
                        reason: null,
                    },
                },
            );

            nextAppointment = response.data;
            replaceAppointmentInState(nextAppointment);
            void loadQueue();

            if (appointment.status === 'waiting_provider') {
                notifySuccess('Consultation started. Chart opened with visit context.');
            } else if (appointment.status === 'in_consultation') {
                notifySuccess('Consultation ownership confirmed. Chart opened with visit context.');
            }
        }

        router.visit(consultationWorkflowHref(nextAppointment));
    } catch (error) {
        const apiError = error as ApiError;
        if (apiError.status === 409 && apiError.payload?.code === 'CONSULTATION_OWNER_CONFLICT') {
            openConsultationTakeoverDialog(
                appointment,
                consultationOwnerUserIdFromPayload(apiError.payload),
            );
            return;
        }
        notifyError(apiError.payload?.message ?? messageFromUnknown(error, 'Unable to open consultation.'));
    } finally {
        consultationLaunchingAppointmentId.value = null;
    }
}

function replaceAppointmentInState(updated: Appointment): void {
    appointments.value = appointments.value.map((appointment) =>
        appointment.id === updated.id ? updated : appointment,
    );
    if (detailsAppointment.value?.id === updated.id) {
        detailsAppointment.value = updated;
    }
}

function rescheduleFieldError(field: string): string | null {
    return rescheduleErrors.value[field]?.[0] ?? null;
}

function openRescheduleDialog(appointment: Appointment): void {
    rescheduleTargetAppointment.value = appointment;
    rescheduleForm.scheduledAt = normalizeApiDateTimeForInput(appointment.scheduledAt);
    rescheduleForm.durationMinutes = appointment.durationMinutes ? String(appointment.durationMinutes) : '30';
    rescheduleForm.notes = appointment.notes || '';
    rescheduleErrors.value = {};
    rescheduleDialogOpen.value = true;
}

function closeRescheduleDialog(): void {
    rescheduleDialogOpen.value = false;
    rescheduleSubmitting.value = false;
    rescheduleErrors.value = {};
    rescheduleTargetAppointment.value = null;
    rescheduleForm.scheduledAt = '';
    rescheduleForm.durationMinutes = '30';
    rescheduleForm.notes = '';
}

async function submitRescheduleUpdate(): Promise<void> {
    if (!rescheduleTargetAppointment.value) return;
    rescheduleSubmitting.value = true;
    rescheduleErrors.value = {};

    try {
        const response = await apiRequest<ApiItemResponse<Appointment>>(
            'PATCH',
            `/appointments/${rescheduleTargetAppointment.value.id}`,
            {
                body: {
                    scheduledAt: normalizeLocalDateTimeForApi(rescheduleForm.scheduledAt),
                    durationMinutes: rescheduleForm.durationMinutes ? Number(rescheduleForm.durationMinutes) : null,
                    notes: rescheduleForm.notes || null,
                },
            },
        );

        replaceAppointmentInState(response.data);
        closeRescheduleDialog();
        notifySuccess('Appointment rescheduled.');
        await loadQueue();
    } catch (error) {
        const apiError = error as ApiError;
        rescheduleErrors.value = apiError.payload?.errors ?? {};
        notifyError(apiError.payload?.message ?? messageFromUnknown(error, 'Unable to reschedule appointment.'));
    } finally {
        rescheduleSubmitting.value = false;
    }
}


function referralFocusText(referral: Referral): string {
    if (referral.status === 'requested') return 'Waiting for receiving team response.';
    if (referral.status === 'accepted') return 'Accepted and ready for handoff.';
    if (referral.status === 'in_progress') return 'Handoff is active between teams.';
    if (referral.status === 'completed') return 'Referral was completed.';
    if (referral.status === 'rejected') return 'Referral was rejected and needs review.';
    if (referral.status === 'cancelled') return 'Referral was cancelled.';
    return 'Referral workflow recorded.';
}

function referralNoteRecords(referral: Referral | null | undefined): MedicalRecordSummary[] {
    const referralId = String(referral?.id ?? '').trim();
    if (!referralId) return [];
    return detailsReferralNotesByReferralId.value[referralId] ?? [];
}

function latestReferralNote(referral: Referral | null | undefined): MedicalRecordSummary | null {
    return referralNoteRecords(referral)[0] ?? null;
}

function draftReferralNote(referral: Referral | null | undefined): MedicalRecordSummary | null {
    return referralNoteRecords(referral).find((record) =>
        String(record.status ?? '').trim().toLowerCase() === 'draft',
    ) ?? null;
}

function referralNoteSummaryText(referral: Referral): string {
    if (detailsReferralNotesLoading.value) {
        return 'Loading linked referral notes...';
    }

    const records = referralNoteRecords(referral);
    if (!records.length) {
        return 'No formal referral note is linked yet. Start one to capture the handoff narrative.';
    }

    const latest = records[0];
    const parts = [
        `${records.length} note${records.length === 1 ? '' : 's'} linked`,
        latest.recordNumber || 'Latest note number pending',
        latest.updatedAt || latest.encounterAt || latest.signedAt
            ? `updated ${formatDateTime(latest.updatedAt || latest.encounterAt || latest.signedAt)}`
            : null,
    ].filter(Boolean);

    const draftCount = records.filter((record) =>
        String(record.status ?? '').trim().toLowerCase() === 'draft',
    ).length;
    if (draftCount > 0) {
        parts.push(`${draftCount} draft${draftCount === 1 ? '' : 's'}`);
    }

    return parts.join(' | ');
}

function referralStatusActionLabel(status: string): string {
    switch (status) {
        case 'accepted':
            return 'Accept referral';
        case 'in_progress':
            return 'Start handoff';
        case 'completed':
            return 'Complete handoff';
        case 'rejected':
            return 'Reject referral';
        case 'cancelled':
            return 'Cancel referral';
        default:
            return 'Update referral';
    }
}

function openReferralStatusDialog(referral: Referral, nextStatus: string): void {
    if (!detailsAppointment.value || !canManageReferrals.value) return;
    referralStatusTarget.value = referral;
    referralStatusForm.status = nextStatus;
    referralStatusForm.reason = '';
    referralStatusForm.handoffNotes = referral.handoffNotes || '';
    referralStatusErrors.value = {};
    referralStatusDialogOpen.value = true;
}

function closeReferralStatusDialog(): void {
    referralStatusDialogOpen.value = false;
    referralStatusSubmitting.value = false;
    referralStatusTarget.value = null;
    referralStatusForm.status = 'accepted';
    referralStatusForm.reason = '';
    referralStatusForm.handoffNotes = '';
    referralStatusErrors.value = {};
}

function resetReferralForm(): void {
    referralErrors.value = {};
    referralForm.referralType = 'internal';
    referralForm.priority = 'routine';
    referralForm.targetDepartment = '';
    referralForm.targetFacilityCode = '';
    referralForm.targetFacilityName = '';
    referralForm.targetClinicianUserId = '';
    referralForm.referralReason = '';
    referralForm.clinicalNotes = '';
    referralForm.handoffNotes = '';
}

function openReferralDialog(): void {
    if (!detailsAppointment.value || !canManageReferrals.value) return;
    resetReferralForm();
    if (detailsAppointment.value.sourceAdmissionId?.trim()) {
        const summary = detailsSourceAdmissionSummary.value;
        referralForm.referralReason =
            summary?.followUpPlan?.trim()
            || detailsAppointment.value.reason?.trim()
            || 'Post-discharge follow-up referral';
        referralForm.clinicalNotes = [
            summary?.followUpPlan?.trim()
                ? `Discharge follow-up plan: ${summary.followUpPlan.trim()}`
                : null,
            summary?.dischargeDestination?.trim()
                ? `Discharged to: ${summary.dischargeDestination.trim()}`
                : null,
            summary?.admissionNumber?.trim()
                ? `Source admission: ${summary.admissionNumber.trim()}`
                : null,
        ].filter((value): value is string => Boolean(value)).join('\n');
        referralForm.handoffNotes = summary?.admissionNumber?.trim()
            ? `Post-discharge follow-up requested from ${summary.admissionNumber.trim()}.`
            : 'Post-discharge follow-up requested from the source inpatient stay.';
    }
    referralDialogOpen.value = true;
}

function closeReferralDialog(): void {
    referralDialogOpen.value = false;
    referralSubmitting.value = false;
    resetReferralForm();
}

async function submitReferral(): Promise<void> {
    if (!detailsAppointment.value) return;
    referralSubmitting.value = true;
    referralErrors.value = {};

    try {
        await apiRequest<ApiItemResponse<Referral>>('POST', `/appointments/${detailsAppointment.value.id}/referrals`, {
            body: {
                referralType: referralForm.referralType,
                priority: referralForm.priority,
                targetDepartment: referralForm.targetDepartment || null,
                targetFacilityCode: referralForm.targetFacilityCode || null,
                targetFacilityName: referralForm.targetFacilityName || null,
                targetClinicianUserId: referralForm.targetClinicianUserId ? Number(referralForm.targetClinicianUserId) : null,
                referralReason: referralForm.referralReason || null,
                clinicalNotes: referralForm.clinicalNotes || null,
                handoffNotes: referralForm.handoffNotes || null,
            },
        });

        closeReferralDialog();
        notifySuccess('Referral request created.');
        await loadDetailsReferrals(detailsAppointment.value.id);
        if (detailsReferrals.value.length > 0) {
            detailsTab.value = 'referrals';
        }
    } catch (error) {
        const apiError = error as ApiError;
        referralErrors.value = apiError.payload?.errors ?? {};
        notifyError(apiError.payload?.message ?? messageFromUnknown(error, 'Unable to create referral.'));
    } finally {
        referralSubmitting.value = false;
    }
}

async function submitReferralStatusUpdate(): Promise<void> {
    if (!detailsAppointment.value || !referralStatusTarget.value) return;
    referralStatusSubmitting.value = true;
    referralStatusErrors.value = {};

    try {
        await apiRequest<ApiItemResponse<Referral>>(
            'PATCH',
            `/appointments/${detailsAppointment.value.id}/referrals/${referralStatusTarget.value.id}/status`,
            {
                body: {
                    status: referralStatusForm.status,
                    reason: referralStatusForm.reason || null,
                    handoffNotes: referralStatusForm.handoffNotes || null,
                },
            },
        );

        closeReferralStatusDialog();
        notifySuccess('Referral updated.');
        await loadDetailsReferrals(detailsAppointment.value.id);
    } catch (error) {
        const apiError = error as ApiError;
        referralStatusErrors.value = apiError.payload?.errors ?? {};
        notifyError(apiError.payload?.message ?? messageFromUnknown(error, 'Unable to update referral.'));
    } finally {
        referralStatusSubmitting.value = false;
    }
}

async function loadDetailsReferrals(appointmentId: string): Promise<void> {
    detailsReferralsLoading.value = true;
    try {
        const response = await apiRequest<ApiListResponse<Referral>>('GET', `/appointments/${appointmentId}/referrals`, {
            query: { perPage: 20, page: 1 },
        });
        detailsReferrals.value = response.data ?? [];
    } catch {
        detailsReferrals.value = [];
    } finally {
        detailsReferralsLoading.value = false;
    }
}

async function loadDetailsReferralNotes(referrals: Referral[]): Promise<void> {
    const requestId = ++detailsReferralNotesRequestId;
    const referralIds = referrals
        .map((referral) => String(referral.id ?? '').trim())
        .filter(Boolean);

    if (!canReadMedicalRecords.value || referralIds.length === 0) {
        detailsReferralNotesByReferralId.value = {};
        detailsReferralNotesLoading.value = false;
        return;
    }

    detailsReferralNotesLoading.value = true;

    try {
        const settled = await Promise.allSettled(
            referrals.map(async (referral) => {
                const response = await apiRequest<ApiListResponse<MedicalRecordSummary>>(
                    'GET',
                    '/medical-records',
                    {
                        query: {
                            appointmentReferralId: referral.id,
                            recordType: 'referral_note',
                            page: 1,
                            perPage: 25,
                            sortBy: 'updatedAt',
                            sortDir: 'desc',
                        },
                    },
                );

                return [referral.id, response.data ?? []] as const;
            }),
        );

        if (requestId !== detailsReferralNotesRequestId) {
            return;
        }

        const next: Record<string, MedicalRecordSummary[]> = {};
        settled.forEach((result, index) => {
            const referralId = referrals[index]?.id;
            if (!referralId) return;
            next[referralId] =
                result.status === 'fulfilled' ? [...result.value[1]] : [];
        });

        detailsReferralNotesByReferralId.value = next;
    } finally {
        if (requestId === detailsReferralNotesRequestId) {
            detailsReferralNotesLoading.value = false;
        }
    }
}

watch(
    [
        detailsTab,
        () => detailsOpen.value,
        () => canReadMedicalRecords.value,
        () => detailsReferrals.value.map((referral) => referral.id).join('|'),
    ],
    ([tab, open, canRead]) => {
        if (!open || tab !== 'referrals') {
            return;
        }

        if (!canRead) {
            detailsReferralNotesByReferralId.value = {};
            detailsReferralNotesLoading.value = false;
            return;
        }

        if (detailsReferrals.value.length === 0) {
            detailsReferralNotesByReferralId.value = {};
            detailsReferralNotesLoading.value = false;
            return;
        }

        void loadDetailsReferralNotes(detailsReferrals.value);
    },
);

async function loadDetailsAudit(appointmentId: string): Promise<void> {
    if (!canViewAudit.value) {
        detailsAuditLogs.value = [];
        return;
    }

    detailsAuditLoading.value = true;
    try {
        const response = await apiRequest<ApiListResponse<AuditLog>>('GET', `/appointments/${appointmentId}/audit-logs`, {
            query: { perPage: 20, page: 1 },
        });
        detailsAuditLogs.value = response.data ?? [];
    } catch {
        detailsAuditLogs.value = [];
    } finally {
        detailsAuditLoading.value = false;
    }
}

async function loadDetailsLaboratoryOrders(
    appointment: Appointment | null,
): Promise<void> {
    const requestId = ++detailsLaboratoryOrdersRequestId;

    if (!canReadLaboratory.value || !appointment?.id || !appointment.patientId) {
        detailsLaboratoryOrders.value = [];
        detailsLaboratoryOrdersError.value = null;
        detailsLaboratoryOrdersLoading.value = false;
        return;
    }

    detailsLaboratoryOrdersLoading.value = true;
    detailsLaboratoryOrdersError.value = null;

    try {
        const response = await apiRequest<ApiListResponse<LaboratoryOrder>>(
            'GET',
            '/laboratory-orders',
            {
                query: {
                    patientId: appointment.patientId,
                    appointmentId: appointment.id,
                    sortBy: 'orderedAt',
                    sortDir: 'desc',
                    perPage: 6,
                },
            },
        );

        if (requestId !== detailsLaboratoryOrdersRequestId) return;

        detailsLaboratoryOrders.value = response.data ?? [];
    } catch (error) {
        if (requestId !== detailsLaboratoryOrdersRequestId) return;

        detailsLaboratoryOrders.value = [];
        detailsLaboratoryOrdersError.value = messageFromUnknown(
            error,
            'Unable to load linked laboratory orders.',
        );
    } finally {
        if (requestId === detailsLaboratoryOrdersRequestId) {
            detailsLaboratoryOrdersLoading.value = false;
        }
    }
}

async function loadDetailsPharmacyOrders(
    appointment: Appointment | null,
): Promise<void> {
    const requestId = ++detailsPharmacyOrdersRequestId;

    if (!canReadPharmacy.value || !appointment?.id || !appointment.patientId) {
        detailsPharmacyOrders.value = [];
        detailsPharmacyOrdersError.value = null;
        detailsPharmacyOrdersLoading.value = false;
        return;
    }

    detailsPharmacyOrdersLoading.value = true;
    detailsPharmacyOrdersError.value = null;

    try {
        const response = await apiRequest<ApiListResponse<PharmacyOrder>>(
            'GET',
            '/pharmacy-orders',
            {
                query: {
                    patientId: appointment.patientId,
                    appointmentId: appointment.id,
                    sortBy: 'orderedAt',
                    sortDir: 'desc',
                    perPage: 6,
                },
            },
        );

        if (requestId !== detailsPharmacyOrdersRequestId) return;

        detailsPharmacyOrders.value = response.data ?? [];
    } catch (error) {
        if (requestId !== detailsPharmacyOrdersRequestId) return;

        detailsPharmacyOrders.value = [];
        detailsPharmacyOrdersError.value = messageFromUnknown(
            error,
            'Unable to load linked pharmacy orders.',
        );
    } finally {
        if (requestId === detailsPharmacyOrdersRequestId) {
            detailsPharmacyOrdersLoading.value = false;
        }
    }
}

async function loadDetailsRadiologyOrders(
    appointment: Appointment | null,
): Promise<void> {
    const requestId = ++detailsRadiologyOrdersRequestId;

    if (!canReadRadiology.value || !appointment?.id || !appointment.patientId) {
        detailsRadiologyOrders.value = [];
        detailsRadiologyOrdersError.value = null;
        detailsRadiologyOrdersLoading.value = false;
        return;
    }

    detailsRadiologyOrdersLoading.value = true;
    detailsRadiologyOrdersError.value = null;

    try {
        const response = await apiRequest<ApiListResponse<RadiologyOrder>>(
            'GET',
            '/radiology-orders',
            {
                query: {
                    patientId: appointment.patientId,
                    appointmentId: appointment.id,
                    sortBy: 'orderedAt',
                    sortDir: 'desc',
                    perPage: 6,
                },
            },
        );

        if (requestId !== detailsRadiologyOrdersRequestId) return;

        detailsRadiologyOrders.value = response.data ?? [];
    } catch (error) {
        if (requestId !== detailsRadiologyOrdersRequestId) return;

        detailsRadiologyOrders.value = [];
        detailsRadiologyOrdersError.value = messageFromUnknown(
            error,
            'Unable to load linked imaging orders.',
        );
    } finally {
        if (requestId === detailsRadiologyOrdersRequestId) {
            detailsRadiologyOrdersLoading.value = false;
        }
    }
}

async function loadDetailsTheatreProcedures(
    appointment: Appointment | null,
): Promise<void> {
    const requestId = ++detailsTheatreProceduresRequestId;

    if (!canReadTheatre.value || !appointment?.id || !appointment.patientId) {
        detailsTheatreProcedures.value = [];
        detailsTheatreProceduresError.value = null;
        detailsTheatreProceduresLoading.value = false;
        return;
    }

    detailsTheatreProceduresLoading.value = true;
    detailsTheatreProceduresError.value = null;

    try {
        const response = await apiRequest<ApiListResponse<TheatreProcedure>>(
            'GET',
            '/theatre-procedures',
            {
                query: {
                    patientId: appointment.patientId,
                    appointmentId: appointment.id,
                    sortBy: 'scheduledAt',
                    sortDir: 'desc',
                    perPage: 6,
                },
            },
        );

        if (requestId !== detailsTheatreProceduresRequestId) return;

        detailsTheatreProcedures.value = response.data ?? [];
    } catch (error) {
        if (requestId !== detailsTheatreProceduresRequestId) return;

        detailsTheatreProcedures.value = [];
        detailsTheatreProceduresError.value = messageFromUnknown(
            error,
            'Unable to load linked theatre procedures.',
        );
    } finally {
        if (requestId === detailsTheatreProceduresRequestId) {
            detailsTheatreProceduresLoading.value = false;
        }
    }
}

function closeDetails(): void {
    detailsLaboratoryOrdersRequestId += 1;
    detailsPharmacyOrdersRequestId += 1;
    detailsRadiologyOrdersRequestId += 1;
    detailsTheatreProceduresRequestId += 1;
    detailsReferralNotesRequestId += 1;
    detailsSourceAdmissionRequestId += 1;
    detailsOpen.value = false;
    detailsLoading.value = false;
    detailsError.value = null;
    detailsStatusNotice.value = null;
    detailsAppointment.value = null;
    detailsSourceAdmissionSummary.value = null;
    detailsSourceAdmissionLoading.value = false;
    detailsSourceAdmissionError.value = null;
    detailsTab.value = 'summary';
    detailsReferralsLoading.value = false;
    detailsReferralNotesLoading.value = false;
    detailsAuditLoading.value = false;
    detailsLaboratoryOrdersLoading.value = false;
    detailsLaboratoryOrdersError.value = null;
    detailsPharmacyOrdersLoading.value = false;
    detailsPharmacyOrdersError.value = null;
    detailsRadiologyOrdersLoading.value = false;
    detailsRadiologyOrdersError.value = null;
    detailsTheatreProceduresLoading.value = false;
    detailsTheatreProceduresError.value = null;
    detailsReferrals.value = [];
    detailsReferralNotesByReferralId.value = {};
    detailsAuditLogs.value = [];
    detailsLaboratoryOrders.value = [];
    detailsPharmacyOrders.value = [];
    detailsRadiologyOrders.value = [];
    detailsTheatreProcedures.value = [];
    detailsEncounterCareOpen.value = [];
}

function appointmentDetailsPlaceholder(appointmentId: string): Appointment {
    return {
        id: appointmentId,
        appointmentNumber: null,
        patientId: null,
        sourceAdmissionId: null,
        clinicianUserId: null,
        department: null,
        scheduledAt: null,
        durationMinutes: null,
        reason: null,
        notes: null,
        triageVitalsSummary: null,
        triageNotes: null,
        triagedAt: null,
        triagedByUserId: null,
        status: null,
        statusReason: null,
        createdAt: null,
        updatedAt: null,
    };
}

function detailsTabFromUrl(appointment?: Appointment | null): AppointmentDetailsTab {
    const normalizedAppointmentId = (appointment?.id ?? '').trim();
    if (!normalizedAppointmentId) return 'summary';
    if (queryParam('focusAppointmentId').trim() !== normalizedAppointmentId) {
        return 'summary';
    }

    const requestedTab = queryParam('detailsTab').trim();
    if (requestedTab === 'overview') return 'summary';
    if (requestedTab === 'referrals') return canShowReferralTab.value ? 'referrals' : 'workflow';
    if (requestedTab === 'audit' && canViewAudit.value) return 'audit';
    if (requestedTab === 'workflow') return 'workflow';
    if (requestedTab === 'encounter' && canShowEncounterCareForAppointment(appointment)) return 'encounter';

    return 'summary';
}

function sourceAdmissionWorkflowHref(
    patientId: string | null | undefined,
    admissionId: string | null | undefined,
): string {
    const url = new URL('/admissions', window.location.origin);
    if (patientId) url.searchParams.set('patientId', patientId);
    if (admissionId) url.searchParams.set('focusAdmissionId', admissionId);
    return `${url.pathname}${url.search}`;
}

function sourceAdmissionMedicalRecordsHref(
    patientId: string | null | undefined,
    admissionId: string | null | undefined,
): string {
    const url = new URL('/medical-records', window.location.origin);
    if (patientId) url.searchParams.set('patientId', patientId);
    if (admissionId) url.searchParams.set('admissionId', admissionId);
    url.searchParams.set('tab', 'list');
    return `${url.pathname}${url.search}`;
}

async function openDetails(appointment: Appointment): Promise<void> {
    detailsOpen.value = true;
    detailsLoading.value = true;
    detailsError.value = null;
    detailsStatusNotice.value = null;
    detailsAppointment.value = appointment;
    detailsSourceAdmissionSummary.value = null;
    detailsSourceAdmissionLoading.value = false;
    detailsSourceAdmissionError.value = null;
    detailsTab.value = detailsTabFromUrl(appointment);
    detailsReferrals.value = [];
    detailsReferralNotesByReferralId.value = {};
    detailsAuditLogs.value = [];
    detailsLaboratoryOrders.value = [];
    detailsLaboratoryOrdersError.value = null;
    detailsPharmacyOrders.value = [];
    detailsPharmacyOrdersError.value = null;
    detailsRadiologyOrders.value = [];
    detailsRadiologyOrdersError.value = null;
    detailsTheatreProcedures.value = [];
    detailsTheatreProceduresError.value = null;
    detailsEncounterCareOpen.value = [];

    if (canReadBillingPayerContracts.value && !billingPayerContractsLoaded.value && !billingPayerContractsLoading.value) {
        void loadBillingPayerContracts();
    }

    try {
        const response = await apiRequest<ApiItemResponse<Appointment>>('GET', `/appointments/${appointment.id}`);
        detailsAppointment.value = response.data;
        replaceAppointmentInState(response.data);
        await hydratePatientSummary(response.data.patientId);
        if (response.data.sourceAdmissionId?.trim()) {
            void loadDetailsSourceAdmissionSummary(response.data.sourceAdmissionId);
        }
        await Promise.all([
            loadDetailsReferrals(appointment.id),
            loadDetailsAudit(appointment.id),
            loadDetailsLaboratoryOrders(response.data),
            loadDetailsPharmacyOrders(response.data),
            loadDetailsRadiologyOrders(response.data),
            loadDetailsTheatreProcedures(response.data),
        ]);
        if (queryParam('detailsTab').trim() === 'referrals' && detailsReferrals.value.length > 0) {
            detailsTab.value = 'referrals';
        }
        syncDetailsEncounterCareOpenState(true);
    } catch (error) {
        detailsError.value = messageFromUnknown(error, 'Unable to load appointment details.');
    } finally {
        detailsLoading.value = false;
    }
}

function relatedWorkflowHref(base: string, patientId: string | null | undefined): string {
    const url = new URL(base, window.location.origin);
    if (patientId) url.searchParams.set('patientId', patientId);
    return `${url.pathname}${url.search}`;
}

function relatedCreateWorkflowHref(
    base: string,
    appointment: Appointment,
    options?: {
        reorderOfId?: string | null;
        addOnToOrderId?: string | null;
        extraQuery?: Record<string, string | null | undefined>;
    },
): string {
    const url = new URL(base, window.location.origin);
    if (appointment.patientId) url.searchParams.set('patientId', appointment.patientId);
    url.searchParams.set('appointmentId', appointment.id);
    url.searchParams.set('from', 'appointments');
    url.searchParams.set('tab', 'new');
    if (options?.reorderOfId?.trim()) url.searchParams.set('reorderOfId', options.reorderOfId.trim());
    if (options?.addOnToOrderId?.trim()) url.searchParams.set('addOnToOrderId', options.addOnToOrderId.trim());
    Object.entries(options?.extraQuery ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        url.searchParams.set(key, value);
    });
    return `${url.pathname}${url.search}`;
}

function referralNoteWorkflowHref(
    appointment: Appointment,
    referral?: Referral | null,
): string {
    return relatedCreateWorkflowHref('/medical-records', appointment, {
        extraQuery: {
            createRecordType: 'referral_note',
            referralId: referral?.id ?? null,
        },
    });
}

function referralNoteHistoryHref(
    appointment: Appointment,
    referral: Referral,
    options?: {
        recordId?: string | null;
    },
): string {
    const url = new URL('/medical-records', window.location.origin);
    if (appointment.patientId) url.searchParams.set('patientId', appointment.patientId);
    url.searchParams.set('tab', 'list');
    url.searchParams.set('from', 'appointments');
    url.searchParams.set('createRecordType', 'referral_note');
    url.searchParams.set('recordType', 'referral_note');
    url.searchParams.set('appointmentReferralId', referral.id);
    if (appointment.id) url.searchParams.set('appointmentId', appointment.id);
    if ((options?.recordId ?? '').trim()) {
        url.searchParams.set('recordId', (options?.recordId ?? '').trim());
    }
    return `${url.pathname}${url.search}`;
}

function canUseReferralNotePrimaryAction(referral: Referral): boolean {
    if (canReadMedicalRecords.value && detailsReferralNotesLoading.value) {
        return false;
    }

    return referralNoteRecords(referral).length > 0
        ? canReadMedicalRecords.value
        : canCreateMedicalRecords.value;
}

function referralNotePrimaryHref(appointment: Appointment, referral: Referral): string {
    const draft = draftReferralNote(referral);
    if (draft) {
        return referralNoteHistoryHref(appointment, referral, { recordId: draft.id });
    }

    const latest = latestReferralNote(referral);
    if (latest) {
        return referralNoteHistoryHref(appointment, referral, { recordId: latest.id });
    }

    return referralNoteWorkflowHref(appointment, referral);
}

function referralNotePrimaryLabel(referral: Referral): string {
    if (draftReferralNote(referral)) return 'Open draft note';
    if (latestReferralNote(referral)) return 'Open latest note';
    return 'Start note';
}

function consultationWorkflowHref(appointment: Appointment): string {
    const url = new URL('/medical-records', window.location.origin);

    if (appointment.patientId) {
        url.searchParams.set('patientId', appointment.patientId);
    }

    url.searchParams.set('appointmentId', appointment.id);
    url.searchParams.set('from', 'appointments');
    url.searchParams.set(
        'tab',
        ['waiting_provider', 'in_consultation'].includes(appointment.status || '') ? 'new' : 'list',
    );

    return `${url.pathname}${url.search}`;
}

function consultationOwnerUserId(appointment: Appointment): number | null {
    const normalized = Number(appointment.consultationOwnerUserId ?? 0);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function effectiveConsultationOwnerUserId(appointment: Appointment): number | null {
    const explicitOwnerUserId = consultationOwnerUserId(appointment);
    if (explicitOwnerUserId !== null) {
        return explicitOwnerUserId;
    }

    if ((appointment.status ?? '') !== 'in_consultation') {
        return null;
    }

    const assignedClinicianUserId = Number(appointment.clinicianUserId ?? 0);

    return Number.isFinite(assignedClinicianUserId) && assignedClinicianUserId > 0
        ? assignedClinicianUserId
        : null;
}

function consultationOwnedByAnotherClinician(appointment: Appointment): boolean {
    if ((appointment.status ?? '') !== 'in_consultation') {
        return false;
    }

    const ownerUserId = effectiveConsultationOwnerUserId(appointment);
    if (ownerUserId === null) {
        return false;
    }

    return currentUserId.value !== null && ownerUserId !== currentUserId.value;
}

function consultationOwnedByCurrentClinician(appointment: Appointment): boolean {
    if ((appointment.status ?? '') !== 'in_consultation') {
        return false;
    }

    const ownerUserId = effectiveConsultationOwnerUserId(appointment);
    if (ownerUserId === null || currentUserId.value === null) {
        return false;
    }

    return ownerUserId === currentUserId.value;
}

function consultationOwnershipRequiresVerification(appointment: Appointment): boolean {
    if ((appointment.status ?? '') !== 'in_consultation') {
        return false;
    }

    return effectiveConsultationOwnerUserId(appointment) === null;
}

function consultationOwnerDisplay(appointment: Appointment): string {
    const ownerUserId = effectiveConsultationOwnerUserId(appointment);
    if (ownerUserId === null) {
        return 'another clinician';
    }

    const label = clinicianDisplayLabel(ownerUserId).trim();
    return label !== '' ? label : `User ${ownerUserId}`;
}

function consultationOwnerUserIdFromPayload(payload: ValidationPayload | undefined): number | null {
    const ownerUserId = Number(payload?.context?.consultationOwnerUserId ?? 0);
    return Number.isFinite(ownerUserId) && ownerUserId > 0 ? ownerUserId : null;
}

function canStartConsultationSession(appointment: Appointment): boolean {
    return appointment.status === 'waiting_provider'
        && canStartConsultation.value
        && Boolean(appointment.patientId);
}

function canAccessConsultationWorkflow(appointment: Appointment): boolean {
    if (!appointment.patientId) {
        return false;
    }

    if (appointment.status === 'completed') {
        return canReadMedicalRecords.value;
    }

    return ['waiting_provider', 'in_consultation'].includes(appointment.status || '')
        && canStartConsultation.value;
}

function consultationWorkflowLabel(appointment: Appointment): string {
    switch (appointment.status) {
        case 'waiting_provider':
            return canStartConsultationSession(appointment) ? 'Start consultation' : 'Waiting for provider';
        case 'in_consultation':
            if (!canStartConsultation.value) {
                return 'Provider consultation in progress';
            }
            if (consultationOwnedByAnotherClinician(appointment) && canStartConsultation.value) {
                return 'Take over consultation';
            }
            if (
                consultationOwnedByCurrentClinician(appointment)
                || effectiveConsultationOwnerUserId(appointment) !== null
            ) {
                return 'Resume consultation';
            }
            return 'Open consultation';
        case 'completed':
            return 'Review consultation';
        default:
            return 'Consultation records';
    }
}

function consultationWorkflowHelpText(appointment: Appointment): string {
    switch (appointment.status) {
        case 'waiting_provider':
            return canStartConsultationSession(appointment)
                ? 'Claim this patient into an active provider session and open the chart with triage context preserved.'
                : 'Nursing handoff is complete. This visit is waiting in the provider queue for a clinician to begin consultation.';
        case 'in_consultation':
            if (consultationOwnedByAnotherClinician(appointment)) {
                return canStartConsultation.value
                    ? `This session is owned by ${consultationOwnerDisplay(appointment)}. Take over with a handoff reason before continuing.`
                    : `This session is currently owned by ${consultationOwnerDisplay(appointment)}.`;
            }
            if (consultationOwnedByCurrentClinician(appointment)) {
                return canStartConsultation.value
                    ? 'Resume the active provider session with patient and visit context preserved.'
                    : 'A clinician is actively charting this visit.';
            }
            if (consultationOwnershipRequiresVerification(appointment)) {
                return canStartConsultation.value
                    ? 'Open consultation to verify session ownership and continue care safely.'
                    : 'A clinician is currently managing this consultation.';
            }
            return canStartConsultation.value
                ? 'Resume the active provider session with patient and visit context preserved.'
                : 'A clinician is actively charting this visit.';
        case 'waiting_triage':
            return 'A nurse still needs to record vitals and intake notes before the provider handoff can begin.';
        case 'scheduled':
            return 'Check in the patient first, then complete triage before consultation starts.';
        case 'completed':
            return 'Review consultation notes and linked clinical context for this closed visit.';
        default:
            return 'Open consultation history with this visit attached as context.';
    }
}

function canLaunchClinicalHandoff(appointment: Appointment): boolean {
    return ['waiting_provider', 'in_consultation', 'completed'].includes(appointment.status || '');
}

function appointmentFocusLabel(appointment: Appointment): string {
    switch (appointment.status) {
        case 'scheduled':
            return 'Awaiting arrival';
        case 'waiting_triage':
            return 'Waiting for triage';
        case 'waiting_provider':
            return 'Ready for provider';
        case 'in_consultation':
            return 'In consultation';
        case 'completed':
            return 'Visit closed';
        case 'no_show':
            return 'Follow-up needed';
        case 'cancelled':
            return 'Cancelled';
        default:
            return 'Appointment active';
    }
}

function appointmentNextStep(appointment: Appointment): string {
    switch (appointment.status) {
        case 'scheduled':
            return 'Check in first, or reschedule, record no-show, or cancel if the plan changes.';
        case 'waiting_triage':
            return 'Record vitals and nursing intake, then send the patient to the provider queue.';
        case 'waiting_provider':
            return canStartConsultationSession(appointment)
                ? 'Start the consultation session now, then complete the visit after care is finished.'
                : 'Nursing handoff is complete. The patient is now waiting for a clinician in the provider queue.';
        case 'in_consultation':
            if (consultationOwnedByAnotherClinician(appointment)) {
                return canStartConsultation.value
                    ? `This session is owned by ${consultationOwnerDisplay(appointment)}. Confirm takeover before continuing care.`
                    : `This session is currently owned by ${consultationOwnerDisplay(appointment)}.`;
            }
            if (consultationOwnershipRequiresVerification(appointment)) {
                return canStartConsultation.value
                    ? 'Open consultation to verify ownership before charting continues.'
                    : 'A clinician is currently managing this consultation.';
            }
            return canStartConsultation.value
                ? 'Continue charting, complete care decisions, then close the visit.'
                : 'A clinician is currently managing this consultation.';
        case 'completed':
            return 'Use related workflows for downstream care and follow-up.';
        case 'no_show':
            return 'Reschedule or contact the patient.';
        case 'cancelled':
            return 'Review cancellation reason if follow-up is needed.';
        default:
            return 'Review appointment details.';
    }
}

function appointmentStatusNoteLabel(appointment: Appointment): string {
    switch (appointment.status) {
        case 'waiting_triage':
        case 'waiting_provider':
        case 'in_consultation':
            return 'Triage note';
        case 'no_show':
        case 'cancelled':
            return 'Exception note';
        default:
            return 'Status note';
    }
}

function appointmentStatusNoteText(appointment: Appointment): string {
    const statusNote = String(appointment.statusReason ?? '').trim();
    const triageSummary = String(appointment.triageVitalsSummary ?? '').trim();
    const triageNotes = String(appointment.triageNotes ?? '').trim();
    if (statusNote !== '') return statusNote;
    if (triageSummary !== '') return triageNotes !== '' ? `${triageSummary} | ${triageNotes}` : triageSummary;
    if (triageNotes !== '') return triageNotes;

    switch (appointment.status) {
        case 'scheduled':
            return 'No additional status note is needed while the appointment is still awaiting arrival.';
        case 'waiting_triage':
            return 'Arrival is complete. Nurse triage and vitals are still pending.';
        case 'waiting_provider':
            return 'Triage is complete and the patient is waiting for provider review.';
        case 'in_consultation':
            return 'Provider review is active for this visit.';
        case 'completed':
            return 'No completion exception note was recorded for this closed visit.';
        case 'no_show':
            return 'No no-show note was recorded.';
        case 'cancelled':
            return 'No cancellation note was recorded.';
        default:
            return 'No additional status note was recorded.';
    }
}

function hasRecordedTriage(appointment: Appointment | null | undefined): boolean {
    if (!appointment) return false;
    return Boolean(String(appointment.triageVitalsSummary ?? '').trim() || String(appointment.triageNotes ?? '').trim() || appointment.triagedAt);
}

function triageSummaryPreview(appointment: Appointment | null | undefined): string {
    if (!appointment) return "No triage record has been captured yet.";
    const summary = String(appointment.triageVitalsSummary ?? "").trim();
    const notes = String(appointment.triageNotes ?? "").trim();
    if (summary && notes) return `${summary} | ${notes}`;
    if (summary) return summary;
    if (notes) return notes;
    return appointment.status === "waiting_triage"
        ? "Triage is still pending for this visit."
        : "No triage record has been captured yet.";
}

function triageRecordedByLabel(appointment: Appointment | null | undefined): string {
    if (!appointment?.triagedByUserId) return "Nursing staff";
    if (currentUserId.value !== null && appointment.triagedByUserId === currentUserId.value && currentUserName.value) {
        return currentUserName.value;
    }
    return clinicianDisplayLabel(appointment.triagedByUserId);
}

function triageRecordedAtLabel(appointment: Appointment | null | undefined): string {
    if (!appointment?.triagedAt) return appointment?.status === "waiting_triage" ? "Pending" : "Not recorded";
    return formatDateTime(appointment.triagedAt);
}

function statusActionLabel(status: AppointmentStatus): string {
    switch (status) {
        case 'waiting_triage':
            return 'Check in';
        case 'completed':
            return 'Complete visit';
        case 'no_show':
            return 'Record no-show';
        case 'cancelled':
            return 'Cancel appointment';
        default:
            return formatEnumLabel(status);
    }
}

function auditActorLabel(log: AuditLog): string {
    if (log.actorType === 'system' || log.actorId === null) return 'System';
    return `User ID ${log.actorId}`;
}

function dismissCreateAlerts(): void {
    resetCreateAlerts();
}

async function openCreateConflictAppointment(): Promise<void> {
    const appointment = createConflictAppointment.value;
    if (!appointment) return;

    createSheetOpen.value = false;
    createResumeAvailable.value = false;
    createIntentActive.value = false;
    await openDetails(appointment);
}

function syncAdvancedFiltersDraftFromSearch(): void {
    advancedFiltersDraft.patientId = searchForm.patientId;
    advancedFiltersDraft.from = searchForm.from;
    advancedFiltersDraft.to = searchForm.to;
}

function applyAdvancedFilters(): void {
    searchForm.patientId = advancedFiltersDraft.patientId.trim();
    searchForm.from = advancedFiltersDraft.from.trim();
    searchForm.to = advancedFiltersDraft.to.trim();
    searchForm.page = 1;
    advancedFiltersSheetOpen.value = false;
    void loadQueue();
}

function resetAdvancedFilters(): void {
    advancedFiltersDraft.patientId = '';
    advancedFiltersDraft.from = '';
    advancedFiltersDraft.to = '';
    searchForm.patientId = '';
    searchForm.from = '';
    searchForm.to = '';
    searchForm.page = 1;
    advancedFiltersSheetOpen.value = false;
    void loadQueue();
}

function resetFilters(): void {
    searchForm.q = '';
    searchForm.patientId = '';
    searchForm.clinicianUserId = '';
    searchForm.from = '';
    searchForm.to = '';
    searchForm.page = 1;
    queueMode.value = 'all';
    statusPreset.value = 'all';
    syncAdvancedFiltersDraftFromSearch();
    void loadQueue();
}

function openAllAppointmentsQueue(): void {
    resetFilters();
}

function openTriageQueue(): void {
    queueMode.value = 'triage';
    searchForm.q = '';
    searchForm.patientId = '';
    searchForm.clinicianUserId = '';
    searchForm.from = '';
    searchForm.to = '';
    searchForm.page = 1;
    statusPreset.value = 'waiting_triage';
    syncAdvancedFiltersDraftFromSearch();
    void loadQueue();
}

function openMyClinicalQueue(): void {
    if (currentUserId.value === null) return;
    queueMode.value = 'clinical';
    searchForm.q = '';
    searchForm.patientId = '';
    searchForm.clinicianUserId = String(currentUserId.value);
    searchForm.from = '';
    searchForm.to = '';
    searchForm.page = 1;
    statusPreset.value = 'waiting_provider';
    syncAdvancedFiltersDraftFromSearch();
    void loadQueue();
}

function leaveMyClinicalQueue(): void {
    openAllAppointmentsQueue();
}

watch(canUseMyClinicalQueue, (allowed) => {
    if (!allowed && isMyClinicalQueue.value) {
        openAllAppointmentsQueue();
    }
});

watch(canUseTriageQueue, (allowed) => {
    if (!allowed && isTriageQueue.value) {
        openAllAppointmentsQueue();
    }
});

watch(
    [
        () => createIntentActive.value,
        () => createSheetOpen.value,
        () => createResumeAvailable.value,
        () => createForm.patientId,
        () => createForm.sourceAdmissionId,
        () => createForm.clinicianUserId,
        () => createForm.department,
        () => createForm.scheduledAt,
        () => createForm.durationMinutes,
        () => createForm.reason,
        () => createForm.notes,
        () => createForm.financialClass,
        () => createForm.billingPayerContractId,
        () => createForm.coverageReference,
        () => createForm.coverageNotes,
    ],
    () => {
        updateUrl();
    },
);

watch(
    () => selectedCreateBillingPayerContract.value?.payerType ?? '',
    (payerType) => {
        const normalized = String(payerType ?? '').trim();
        if (!normalized) return;

        createForm.financialClass = normalizeFinancialClass(normalized);
    },
);

watch(
    () => createForm.financialClass,
    (financialClass, previousFinancialClass) => {
        if (isThirdPartyFinancialClass(financialClass)) {
            return;
        }

        if (isThirdPartyFinancialClass(previousFinancialClass)) {
            createForm.billingPayerContractId = '';
            createForm.coverageReference = '';
            createForm.coverageNotes = '';
        }
    },
);

watch(canReadBillingPayerContracts, (allowed) => {
    if (!allowed) {
        billingPayerContracts.value = [];
        billingPayerContractsError.value = null;
        billingPayerContractsLoaded.value = false;
        return;
    }

    if (createSheetOpen.value && !billingPayerContractsLoaded.value && !billingPayerContractsLoading.value) {
        void loadBillingPayerContracts();
    }
});

watch(
    [
        () => detailsOpen.value,
        () => detailsAppointment.value?.id ?? '',
        () => detailsTab.value,
        () => canViewAudit.value,
    ],
    () => {
        updateUrl();
    },
);

watch(canViewAudit, (allowed) => {
    if (!allowed && detailsTab.value === 'audit') {
        detailsTab.value = 'summary';
    }
});

watch(canShowReferralTab, (visible) => {
    if (!visible && detailsTab.value === 'referrals') {
        detailsTab.value = 'workflow';
    }
});

watch(
    () => detailsTab.value,
    (tab) => {
        if (tab === 'encounter' && !canShowEncounterCareForAppointment(detailsAppointment.value)) {
            detailsTab.value = 'summary';
        } else if (tab === 'referrals' && !canShowReferralTab.value) {
            detailsTab.value = 'workflow';
        }
    },
);

function applyAdvancedFiltersFromDrawer(): void {
    searchForm.patientId = advancedFiltersDraft.patientId.trim();
    searchForm.from = advancedFiltersDraft.from.trim();
    searchForm.to = advancedFiltersDraft.to.trim();
    searchForm.page = 1;
    mobileFiltersDrawerOpen.value = false;
    void loadQueue();
}


const APPOINTMENTS_CREATE_LEAVE_TITLE = 'Leave scheduling flow?';
const APPOINTMENTS_CREATE_LEAVE_DESCRIPTION = 'Scheduling is still in progress. Stay here to finish booking, or leave this page and restart the scheduling flow later.';

function confirmPendingCreateWorkflowLeave(): void {
    const visit = pendingAppointmentsVisit.value;
    createLeaveConfirmOpen.value = false;
    pendingAppointmentsVisit.value = null;

    if (!visit) return;

    bypassAppointmentsNavigationGuard = true;
    router.visit(visit.url, visit);
    bypassAppointmentsNavigationGuard = false;
}

function cancelPendingCreateWorkflowLeave(): void {
    createLeaveConfirmOpen.value = false;
    pendingAppointmentsVisit.value = null;
}

function handleAppointmentsBeforeUnload(event: BeforeUnloadEvent): void {
    if (!hasPendingCreateWorkflow.value || createSubmitting.value) return;
    event.preventDefault();
    event.returnValue = '';
}

onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleAppointmentsBeforeUnload);
    removeAppointmentsNavigationGuard?.();
    removeAppointmentsNavigationGuard = null;
});

onMounted(async () => {
    window.addEventListener('beforeunload', handleAppointmentsBeforeUnload);
    removeAppointmentsNavigationGuard = router.on('before', (event) => {
        if (
            bypassAppointmentsNavigationGuard
            || !hasPendingCreateWorkflow.value
            || createSubmitting.value
        ) {
            return;
        }

        pendingAppointmentsVisit.value = event.detail.visit;
        createLeaveConfirmOpen.value = true;
        event.preventDefault();
        return false;
    });
    await Promise.all([
        loadQueue(),
        loadDepartmentOptions(),
        loadClinicianDirectory(),
        initialPatientId ? hydratePatientSummary(initialPatientId) : Promise.resolve(),
    ]);
    if (initialCreateIntent && canCreate.value && !createPrefillApplied.value) {
        createPrefillApplied.value = true;
        openCreateSheet({ prefillFromQuery: true });
        return;
    }
    if (initialFocusedAppointmentId) {
        await openDetails(
            appointmentDetailsPlaceholder(initialFocusedAppointmentId),
        );
        return;
    }

    if (!hasExplicitQueueIntent) {
        if (canUseMyClinicalQueue.value && !isMyClinicalQueue.value) {
            openMyClinicalQueue();
            return;
        }
        if (canUseTriageQueue.value && !isTriageQueue.value) {
            openTriageQueue();
        }
    }
});

function submitSearch(): void {
    searchForm.page = 1;
    void loadQueue();
}
</script>
<template>
    <Head title="Appointments" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <section class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="calendar-clock" class="size-7 text-primary" />
                        Appointments
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        {{ workspaceIntroText }}
                    </p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Button
                        v-if="canUseTriageQueue"
                        :variant="isTriageQueue ? 'default' : 'outline'"
                        class="gap-1.5"
                        @click="isTriageQueue ? openAllAppointmentsQueue() : openTriageQueue()"
                    >
                        <AppIcon :name="isTriageQueue ? 'list-restart' : 'heart-pulse'" class="size-3.5" />
                        {{ isTriageQueue ? 'Back to all appointments' : 'Triage queue' }}
                    </Button>
                    <Button
                        v-if="canUseMyClinicalQueue"
                        :variant="isMyClinicalQueue ? 'default' : 'outline'"
                        class="gap-1.5"
                        @click="isMyClinicalQueue ? leaveMyClinicalQueue() : openMyClinicalQueue()"
                    >
                        <AppIcon :name="isMyClinicalQueue ? 'list-restart' : 'stethoscope'" class="size-3.5" />
                        {{ isMyClinicalQueue ? 'Back to all appointments' : 'My patients' }}
                    </Button>
                    <Button variant="outline" class="gap-1.5" @click="loadQueue">
                        <AppIcon name="refresh-cw" class="size-3.5" />
                        Refresh
                    </Button>
                    <Button v-if="canCreate" class="gap-1.5" @click="canResumeCreateSheet ? resumeCreateSheet() : openCreateSheet()">
                        <AppIcon :name="canResumeCreateSheet ? 'clipboard-list' : 'calendar-plus-2'" class="size-3.5" />
                        {{ canResumeCreateSheet ? 'Resume scheduling' : 'Schedule appointment' }}
                    </Button>
                </div>
            </section>
            <Alert v-if="canResumeCreateSheet" class="border-primary/20 bg-primary/5 px-3 py-2 rounded-md">
                <AppIcon name="clipboard-list" class="size-3.5 text-primary" />
                <AlertTitle class="text-sm">{{ createResumeTitle }}</AlertTitle>
                <AlertDescription class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div class="min-w-0">
                        <p class="text-xs text-foreground">The schedule sheet was closed. You can continue from here.</p>
                        <p v-if="createResumeMeta" class="text-[11px] text-muted-foreground">{{ createResumeMeta }}</p>
                    </div>
                    <Button size="sm" class="h-8 gap-1.5 self-start sm:self-center" @click="resumeCreateSheet">
                        <AppIcon name="arrow-up-right" class="size-3.5" />
                        Resume scheduling
                    </Button>
                </AlertDescription>
            </Alert>

            <div class="rounded-lg border bg-muted/30 px-3 py-2">
                <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div class="flex flex-col gap-2">
                        <div class="flex flex-wrap items-center gap-2">
                            <Button
                                size="sm"
                                :variant="!isMyClinicalQueue && !isTriageQueue ? 'default' : 'outline'"
                                class="h-8 gap-1.5"
                                @click="leaveMyClinicalQueue()"
                            >
                                <AppIcon name="layout-list" class="size-3.5" />
                                All appointments
                            </Button>
                            <Button
                                v-if="canUseTriageQueue"
                                size="sm"
                                :variant="isTriageQueue ? 'default' : 'outline'"
                                class="h-8 gap-1.5"
                                @click="openTriageQueue()"
                            >
                                <AppIcon name="heart-pulse" class="size-3.5" />
                                Triage queue
                            </Button>
                            <Button
                                v-if="canUseMyClinicalQueue"
                                size="sm"
                                :variant="isMyClinicalQueue ? 'default' : 'outline'"
                                class="h-8 gap-1.5"
                                @click="openMyClinicalQueue()"
                            >
                                <AppIcon name="stethoscope" class="size-3.5" />
                                My patients
                            </Button>
                        </div>
                        <p class="text-xs text-muted-foreground">Current view: {{ currentViewSummary }}</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <Button
                            v-for="preset in ['all', 'scheduled', 'waiting_triage', 'waiting_provider', 'in_consultation', 'completed'] as WorkspacePreset[]"
                            :key="preset"
                            size="sm"
                            :variant="matchesAppointmentPreset(preset) ? 'default' : 'outline'"
                            class="h-8 gap-1.5"
                            @click="setPreset(preset)"
                        >
                            <span class="font-medium">{{ appointmentQuickCount(preset) }}</span>
                            <span>{{ quickPresetLabel(preset) }}</span>
                        </Button>
                        <Button
                            size="sm"
                            :variant="matchesAppointmentPreset('exceptions') ? 'default' : 'outline'"
                            class="h-8 gap-1.5"
                            @click="setPreset('exceptions')"
                        >
                            <span class="font-medium">{{ appointmentQuickCount('exceptions') }}</span>
                            <span>{{ quickPresetLabel('exceptions') }}</span>
                        </Button>
                    </div>
                </div>
            </div>

            <Alert v-if="showClinicalQueueSuggestion" class="border-primary/20 bg-primary/5 px-3 py-2 rounded-md">
                <AppIcon name="stethoscope" class="size-3.5 text-primary" />
                <AlertTitle class="text-sm">Clinician shortcut available</AlertTitle>
                <AlertDescription class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div class="min-w-0">
                        <p class="text-xs text-foreground">Use <span class="font-medium">My patients</span> for visits that are already triaged and waiting for provider review. Keep <span class="font-medium">All appointments</span> for front-desk arrival and triage handoff work.</p>
                    </div>
                    <Button size="sm" variant="outline" class="h-8 gap-1.5 self-start sm:self-center" @click="openMyClinicalQueue()">
                        <AppIcon name="arrow-up-right" class="size-3.5" />
                        Go to my patients
                    </Button>
                </AlertDescription>
            </Alert>

            <Alert v-if="showTriageQueueSuggestion" class="border-emerald-500/20 bg-emerald-500/5 px-3 py-2 rounded-md">
                <AppIcon name="heart-pulse" class="size-3.5 text-emerald-600" />
                <AlertTitle class="text-sm">Nurse triage shortcut available</AlertTitle>
                <AlertDescription class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div class="min-w-0">
                        <p class="text-xs text-foreground">Use <span class="font-medium">Triage queue</span> for vitals, intake review, and provider handoff. Keep <span class="font-medium">All appointments</span> for front-desk arrival and scheduling work.</p>
                    </div>
                    <Button size="sm" variant="outline" class="h-8 gap-1.5 self-start sm:self-center" @click="openTriageQueue()">
                        <AppIcon name="arrow-up-right" class="size-3.5" />
                        Go to triage queue
                    </Button>
                </AlertDescription>
            </Alert>

            <section v-if="isTriageQueue" class="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-3">
                <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge variant="default">Nurse triage view</Badge>
                            <p class="text-sm font-medium text-foreground">Vitals, intake notes, and provider handoff are in focus here.</p>
                        </div>
                        <p class="mt-1 text-xs text-muted-foreground">
                            We are showing triage-ready visits by default so nursing staff can move the queue forward without front-desk noise.
                        </p>
                    </div>
                    <Button size="sm" variant="outline" class="h-8 gap-1.5 self-start" @click="openAllAppointmentsQueue()">
                        <AppIcon name="list-restart" class="size-3.5" />
                        Back to all appointments
                    </Button>
                </div>
                <div class="mt-3 grid gap-2 sm:grid-cols-3">
                    <div class="rounded-lg border bg-background/90 px-3 py-2.5">
                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Waiting triage</p>
                        <p class="mt-1 text-lg font-semibold text-foreground">{{ counts.waiting_triage }}</p>
                    </div>
                    <div class="rounded-lg border bg-background/90 px-3 py-2.5">
                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Ready for provider</p>
                        <p class="mt-1 text-lg font-semibold text-foreground">{{ counts.waiting_provider }}</p>
                    </div>
                    <div class="rounded-lg border bg-background/90 px-3 py-2.5">
                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Closed</p>
                        <p class="mt-1 text-lg font-semibold text-foreground">{{ counts.completed }}</p>
                    </div>
                </div>
            </section>

            <section v-if="isMyClinicalQueue" class="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
                <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge variant="default">Signed-in clinician view</Badge>
                            <p class="text-sm font-medium text-foreground">{{ currentUserName || 'Your' }} queue is filtered and ready for consultation handoff.</p>
                        </div>
                        <p class="mt-1 text-xs text-muted-foreground">
                            We are showing provider-ready visits assigned to you by default, with active consultation and scheduled workload still visible for quick awareness.
                        </p>
                    </div>
                    <Button size="sm" variant="outline" class="h-8 gap-1.5 self-start" @click="leaveMyClinicalQueue()">
                        <AppIcon name="list-restart" class="size-3.5" />
                        Back to all appointments
                    </Button>
                </div>
                <div class="mt-3 grid gap-2 sm:grid-cols-3">
                    <div class="rounded-lg border bg-background/90 px-3 py-2.5">
                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Ready for provider</p>
                        <p class="mt-1 text-lg font-semibold text-foreground">{{ counts.waiting_provider }}</p>
                    </div>
                    <div class="rounded-lg border bg-background/90 px-3 py-2.5">
                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">In consultation</p>
                        <p class="mt-1 text-lg font-semibold text-foreground">{{ counts.in_consultation }}</p>
                    </div>
                    <div class="rounded-lg border bg-background/90 px-3 py-2.5">
                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Closed</p>
                        <p class="mt-1 text-lg font-semibold text-foreground">{{ counts.completed }}</p>
                    </div>
                </div>
            </section>

            <Card id="appointments-queue" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col">
                <CardHeader class="shrink-0 gap-3 pb-3">
                    <div class="min-w-0 space-y-1">
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                            {{ queueTitle }}
                        </CardTitle>
                        <CardDescription>
                            {{ queueSummary }} &middot; Page {{ pagination.currentPage }} of {{ pagination.lastPage }}
                        </CardDescription>
                        <div class="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{{ quickPresetLabel(statusPreset) }}</Badge>
                            <Badge v-if="isMyClinicalQueue" variant="outline">Assigned to you</Badge>
                            <Badge v-if="activeAdvancedFilterCount" variant="outline">{{ activeAdvancedFilterCount }} filters</Badge>
                        </div>
                        <p class="text-xs text-muted-foreground">{{ queueDescription }}</p>
                        <p v-if="searchForm.patientId" class="text-xs text-muted-foreground">
                            Patient in focus: {{ patientDisplayName(searchForm.patientId) }} | {{ patientMeta(searchForm.patientId) }}
                        </p>
                        <p v-if="clinicianInFocusLabel" class="text-xs text-muted-foreground">
                            Clinician in focus: {{ clinicianInFocusLabel }}
                        </p>
                    </div>

                    <div class="flex w-full flex-col gap-2">
                        <div class="flex w-full flex-col gap-2 xl:flex-row xl:items-center">
                            <div class="relative min-w-0 flex-1">
                                <AppIcon
                                    name="search"
                                    class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                                />
                                <Input
                                    id="appointments-q"
                                    v-model="searchForm.q"
                                    class="h-9 pl-9"
                                    placeholder="Search appointment number, department, or reason"
                                    @keyup.enter="submitSearch"
                                />
                            </div>
                            <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap">
                                <Select v-model="statusSelectValue">
                                    <SelectTrigger class="h-9 w-full bg-background sm:w-44">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="all">All statuses</SelectItem>
                                    <SelectItem value="scheduled">Scheduled</SelectItem>
                                    <SelectItem value="waiting_triage">Waiting triage</SelectItem>
                                    <SelectItem value="waiting_provider">Ready for provider</SelectItem>
                                    <SelectItem value="in_consultation">In consultation</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="hidden h-9 gap-1.5 md:inline-flex"
                                    @click="syncAdvancedFiltersDraftFromSearch(); advancedFiltersSheetOpen = true"
                                >
                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                    All filters
                                    <Badge v-if="activeAdvancedFilterCount" variant="secondary" class="ml-1 text-[10px]">
                                        {{ activeAdvancedFilterCount }}
                                    </Badge>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="h-9 gap-1.5 md:hidden"
                                    @click="syncAdvancedFiltersDraftFromSearch(); mobileFiltersDrawerOpen = true"
                                >
                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                    All filters
                                </Button>
                                <Popover>
                                    <PopoverTrigger as-child>
                                        <Button variant="outline" size="sm" class="h-9 gap-1.5">
                                            <AppIcon name="eye" class="size-3.5" />
                                            View
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" class="w-72 space-y-4">
                                        <div class="grid gap-2">
                                            <Label for="appt-per-page-view">Results per page</Label>
                                            <Select :model-value="searchForm.perPage" @update:model-value="val => { searchForm.perPage = val; submitSearch }">
                                                <SelectTrigger class="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="25">25</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label>Row density</Label>
                                            <div class="grid grid-cols-2 gap-2">
                                                <Button size="sm" :variant="compactQueueRows ? 'outline' : 'default'" @click="compactQueueRows = false">
                                                    Comfortable
                                                </Button>
                                                <Button size="sm" :variant="compactQueueRows ? 'default' : 'outline'" @click="compactQueueRows = true">
                                                    Compact
                                                </Button>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <Button
                                    v-if="hasActiveFilters"
                                    variant="ghost"
                                    size="sm"
                                    class="h-9 gap-1.5"
                                    :disabled="listLoading"
                                    @click="resetFilters"
                                >
                                    Reset
                                </Button>
                            </div>
                        </div>

                        <div v-if="activeFilterBadgeLabels.length" class="flex flex-wrap items-center gap-1.5 pt-1">
                            <Badge
                                v-for="label in activeFilterBadgeLabels"
                                :key="label"
                                variant="outline"
                                class="h-6 rounded-full px-2.5 text-[10px] font-medium"
                            >
                                {{ label }}
                            </Badge>
                            <Button
                                variant="ghost"
                                size="sm"
                                class="h-6 px-2 text-[11px]"
                                :disabled="listLoading"
                                @click="resetFilters"
                            >
                                Reset
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="min-h-[12rem] p-4" :class="compactQueueRows ? 'space-y-2' : 'space-y-3'">
                            <div v-if="pageLoading || listLoading" class="space-y-2">
                                <Skeleton class="h-24 w-full" />
                                <Skeleton class="h-24 w-full" />
                                <Skeleton class="h-24 w-full" />
                            </div>
                            <Alert v-else-if="queueError" variant="destructive">
                                <AlertTitle>Queue unavailable</AlertTitle>
                                <AlertDescription>{{ queueError }}</AlertDescription>
                            </Alert>
                            <div
                                v-else-if="!appointments.length"
                                class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
                            >
                                No appointments found for the current filters.
                            </div>
                            <div v-else :class="compactQueueRows ? 'space-y-2' : 'space-y-3'">
                                <div
                                    v-for="appointment in appointments"
                                    :key="appointment.id"
                                    class="rounded-lg border transition-colors"
                                    :class="compactQueueRows ? 'p-2.5' : 'p-3'"
                                >
                                    <div
                                        :class="compactQueueRows
                                            ? 'flex flex-col gap-2 md:flex-row md:items-start md:justify-between'
                                            : 'flex flex-col gap-3 md:flex-row md:items-start md:justify-between'"
                                    >
                                        <div :class="compactQueueRows ? 'space-y-1.5' : 'space-y-2'">
                                            <div class="flex flex-wrap items-center gap-2">
                                                <p class="text-sm font-semibold">
                                                    {{ appointment.appointmentNumber || 'Appointment pending number' }}
                                                </p>
                                                <Badge :variant="statusVariant(appointment.status)">
                                                    {{ formatEnumLabel(appointment.status || 'scheduled') }}
                                                </Badge>
                                            </div>
                                            <p class="text-sm font-medium text-foreground">
                                                {{ patientDisplayName(appointment.patientId) }}
                                            </p>
                                            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                <span v-if="patientMeta(appointment.patientId)" class="inline-flex items-center gap-1">
                                                    <span class="inline-flex size-1 rounded-full bg-muted-foreground/40"></span>
                                                    {{ patientMeta(appointment.patientId) }}
                                                </span>
                                                <span v-if="appointment.department" class="inline-flex items-center gap-1">
                                                    <span class="inline-flex size-1 rounded-full bg-muted-foreground/40"></span>
                                                    {{ appointment.department }}
                                                </span>
                                                <span class="inline-flex items-center gap-1">
                                                    <span class="inline-flex size-1 rounded-full bg-muted-foreground/40"></span>
                                                    Scheduled {{ formatDateTime(appointment.scheduledAt) }}
                                                </span>
                                                <span v-if="appointment.durationMinutes" class="inline-flex items-center gap-1">
                                                    <span class="inline-flex size-1 rounded-full bg-muted-foreground/40"></span>
                                                    {{ appointment.durationMinutes }} min
                                                </span>
                                            </div>
                                            <p v-if="appointment.reason" class="line-clamp-1 text-xs text-muted-foreground">
                                                <span class="font-medium text-foreground">Reason:</span>
                                                {{ appointment.reason }}
                                            </p>
                                            <div class="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs">
                                                <Badge variant="outline" class="h-5 px-1.5 text-[10px]">
                                                    {{ appointmentFocusLabel(appointment) }}
                                                </Badge>
                                                <span class="text-muted-foreground">
                                                    {{ appointmentNextStep(appointment) }}
                                                </span>
                                            </div>
                                            <div v-if="hasRecordedTriage(appointment)" class="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2 text-xs">
                                                <p class="font-medium text-foreground">Triage recorded {{ triageRecordedAtLabel(appointment) }}</p>
                                                <p class="mt-1 text-muted-foreground">{{ triageSummaryPreview(appointment) }}</p>
                                            </div>
                                        </div>
                                        <div
                                            :class="compactQueueRows
                                                ? 'flex flex-col items-stretch gap-1.5 md:flex-row md:flex-wrap md:items-start md:max-w-[360px] md:justify-end'
                                                : 'flex flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-start md:max-w-[360px] md:justify-end'"
                                        >
                                            <Button
                                                v-if="!isTriageQueue && canAccessConsultationWorkflow(appointment)"
                                                size="sm"
                                                :variant="['waiting_provider', 'in_consultation'].includes(appointment.status || '') ? 'default' : 'outline'"
                                                class="w-full gap-1.5 sm:w-auto"
                                                :disabled="isLaunchingConsultation(appointment)"
                                                @click="void launchConsultationWorkflow(appointment)"
                                            >
                                                <AppIcon name="stethoscope" class="size-3.5" />
                                                {{ isLaunchingConsultation(appointment) ? 'Opening...' : consultationWorkflowLabel(appointment) }}
                                            </Button>
                                            <Button size="sm" variant="outline" class="w-full gap-1.5 sm:w-auto" @click="void openDetails(appointment)">
                                                <AppIcon name="panel-right-open" class="size-3.5" />
                                                Open appointment
                                            </Button>
                                            <Button
                                                v-if="appointment.patientId"
                                                size="sm"
                                                variant="outline"
                                                class="w-full gap-1.5 sm:w-auto"
                                                as-child
                                            >
                                                <Link :href="patientChartHref(appointment.patientId, { appointmentId: appointment.id, from: 'appointments' })">
                                                    <AppIcon name="book-open" class="size-3.5" />
                                                    Open chart
                                                </Link>
                                            </Button>
                                            <Button
                                                v-if="!isTriageQueue && canManageProviderSession && appointment.status === 'waiting_provider'"
                                                size="sm"
                                                variant="outline"
                                                class="w-full gap-1.5 sm:w-auto"
                                                @click="openProviderStatusDialog(appointment, 'waiting_triage')"
                                            >
                                                <AppIcon name="rotate-ccw" class="size-3.5" />
                                                Send back to triage
                                            </Button>
                                            <Button
                                                v-if="!isTriageQueue && canManageProviderSession && appointment.status === 'in_consultation'"
                                                size="sm"
                                                variant="outline"
                                                class="w-full gap-1.5 sm:w-auto"
                                                @click="openProviderStatusDialog(appointment, 'waiting_provider')"
                                            >
                                                <AppIcon name="undo-2" class="size-3.5" />
                                                Return to queue
                                            </Button>
                                            <Button
                                                v-if="!isTriageQueue && canManageProviderSession && appointment.status === 'in_consultation'"
                                                size="sm"
                                                variant="outline"
                                                class="w-full gap-1.5 sm:w-auto"
                                                @click="openProviderStatusDialog(appointment, 'completed')"
                                            >
                                                <AppIcon name="circle-check-big" class="size-3.5" />
                                                Complete visit
                                            </Button>
                                            <template v-if="!isMyClinicalQueue && !isTriageQueue">
                                                <Button
                                                    v-if="canUpdateStatus && appointment.status === 'scheduled'"
                                                    size="sm"
                                                    class="w-full gap-1.5 sm:w-auto"
                                                    @click="openStatusDialog(appointment, 'waiting_triage')"
                                                >
                                                    {{ statusActionLabel('waiting_triage') }}
                                                </Button>
                                                <Button
                                                    v-if="canRecordOpdTriage && appointment.status === 'waiting_triage'"
                                                    size="sm"
                                                    class="w-full gap-1.5 sm:w-auto"
                                                    @click="openTriageSheet(appointment)"
                                                >
                                                    <AppIcon name="heart-pulse" class="size-3.5" />
                                                    Record triage
                                                </Button>
                                                <Button
                                                    v-if="canUpdateStatus && appointment.status === 'scheduled'"
                                                    size="sm"
                                                    variant="outline"
                                                    class="w-full gap-1.5 sm:w-auto"
                                                    @click="openStatusDialog(appointment, 'no_show')"
                                                >
                                                    {{ statusActionLabel('no_show') }}
                                                </Button>
                                                <Button
                                                    v-if="canUpdateStatus && ['scheduled', 'waiting_triage'].includes(appointment.status || '')"
                                                    size="sm"
                                                    variant="outline"
                                                    class="w-full gap-1.5 sm:w-auto"
                                                    @click="openStatusDialog(appointment, 'cancelled')"
                                                >
                                                    {{ statusActionLabel('cancelled') }}
                                                </Button>
                                            </template>
                                            <template v-if="isTriageQueue">
                                                <Button
                                                    v-if="canRecordOpdTriage && appointment.status === 'waiting_triage'"
                                                    size="sm"
                                                    class="w-full gap-1.5 sm:w-auto"
                                                    @click="openTriageSheet(appointment)"
                                                >
                                                    <AppIcon name="heart-pulse" class="size-3.5" />
                                                    Record triage
                                                </Button>
                                            </template>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
                        <p class="text-xs text-muted-foreground">
                            Showing {{ appointments.length }} of {{ pagination.total ?? appointments.length }} results &middot; Page {{ pagination.currentPage }} of {{ pagination.lastPage }}
                        </p>
                        <div class="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                class="gap-1.5"
                                :disabled="pagination.currentPage <= 1 || listLoading"
                                @click="setPage(pagination.currentPage - 1)"
                            >
                                <AppIcon name="chevron-left" class="size-3.5" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                class="gap-1.5"
                                :disabled="pagination.currentPage >= pagination.lastPage || listLoading"
                                @click="setPage(pagination.currentPage + 1)"
                            >
                                <AppIcon name="chevron-right" class="size-3.5" />
                                Next
                            </Button>
                        </div>
                    </footer>
                </CardContent>
            </Card>

            <Sheet :open="advancedFiltersSheetOpen" @update:open="advancedFiltersSheetOpen = $event">
                <SheetContent side="right" variant="action" size="lg">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            All filters
                        </SheetTitle>
                        <SheetDescription>
                            Refine the appointment queue by patient and scheduled date range.
                        </SheetDescription>
                    </SheetHeader>
                    <div class="grid gap-4 px-4 py-4">
                        <PatientLookupField
                            input-id="appointments-filter-patient-id-sheet"
                            v-model="advancedFiltersDraft.patientId"
                            label="Patient filter"
                            mode="filter"
                            placeholder="Patient name or number"
                            helper-text="Optional exact patient filter for queue review."
                        />
                        <DateRangeFilterPopover
                            input-base-id="appointments-scheduled-date-range-sheet"
                            title="Scheduled date range"
                            helper-text="From / to for appointment queue review."
                            from-label="From"
                            to-label="To"
                            inline
                            :number-of-months="1"
                            v-model:from="advancedFiltersDraft.from"
                            v-model:to="advancedFiltersDraft.to"
                        />
                    </div>
                    <SheetFooter class="gap-2">
                        <Button variant="outline" @click="resetAdvancedFilters">Reset all</Button>
                        <Button :disabled="listLoading" @click="applyAdvancedFilters">Apply filters</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Drawer :open="mobileFiltersDrawerOpen" @update:open="mobileFiltersDrawerOpen = $event">
                <DrawerContent class="max-h-[90vh]">
                    <DrawerHeader>
                        <DrawerTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            All filters
                        </DrawerTitle>
                        <DrawerDescription>
                            Filter the queue and adjust the result view without leaving the list.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div class="space-y-4 overflow-y-auto px-4 pb-2">
                        <div class="rounded-lg border p-3">
                            <div class="mb-3">
                                <p class="text-sm font-medium">Advanced filters</p>
                                <p class="text-xs text-muted-foreground">
                                    Narrow appointments by patient and scheduled date range.
                                </p>
                            </div>
                            <div class="grid gap-3">
                                <PatientLookupField
                                    input-id="appointments-filter-patient-id-mobile"
                                    v-model="advancedFiltersDraft.patientId"
                                    label="Patient filter"
                                    mode="filter"
                                    placeholder="Patient name or number"
                                />
                                <DateRangeFilterPopover
                                    input-base-id="appointments-scheduled-date-range-mobile"
                                    title="Scheduled date range"
                                    helper-text="From / to for appointment queue review."
                                    from-label="From"
                                    to-label="To"
                                    inline
                                    :number-of-months="1"
                                    v-model:from="advancedFiltersDraft.from"
                                    v-model:to="advancedFiltersDraft.to"
                                />
                            </div>
                        </div>

                        <div class="rounded-lg border p-3">
                            <div class="mb-2">
                                <p class="text-sm font-medium">Results & view</p>
                                <p class="text-xs text-muted-foreground">
                                    Adjust result count and queue density for front-desk work.
                                </p>
                            </div>
                            <div class="grid gap-2">
                                <Label for="appointments-per-page-mobile">Results per page</Label>
                                <Select v-model="searchForm.perPage">
                                    <SelectTrigger class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="mt-3 grid gap-2">
                                <Label>Row density</Label>
                                <div class="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        :variant="compactQueueRows ? 'outline' : 'default'"
                                        @click="compactQueueRows = false"
                                    >
                                        Comfortable
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        :variant="compactQueueRows ? 'default' : 'outline'"
                                        @click="compactQueueRows = true"
                                    >
                                        Compact
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DrawerFooter class="gap-2">
                        <Button :disabled="listLoading" @click="applyAdvancedFiltersFromDrawer">Apply filters</Button>
                        <Button variant="outline" @click="resetAdvancedFiltersFromDrawer">Reset</Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            <Sheet :open="createSheetOpen" @update:open="handleCreateSheetOpenChange">

                <SheetContent side="right" variant="form" size="4xl" class="appointments-create-sheet" @open-auto-focus.prevent>
                    <div class="flex h-full flex-col overflow-hidden">
                        <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                            <SheetTitle class="flex items-center gap-2">
                                <AppIcon name="calendar-plus-2" class="size-4 text-primary" />
                                {{ createForm.sourceAdmissionId.trim() ? 'Schedule post-discharge follow-up' : 'Schedule appointment' }}
                            </SheetTitle>
                            <SheetDescription>
                                {{
                                    createForm.sourceAdmissionId.trim()
                                        ? 'Carry the discharged inpatient stay into a follow-up appointment and keep referral handoff available from the new visit.'
                                        : 'Capture patient, clinic routing, schedule, and visit coverage in one front-desk workflow.'
                                }}
                            </SheetDescription>
                            <div
                                v-if="createPatientLocked && createForm.patientId"
                                class="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                            >
                                <Badge variant="outline">Patient locked</Badge>
                                <span class="font-medium text-foreground">{{ patientDisplayName(createForm.patientId) }}</span>
                                <span class="text-muted-foreground">{{ patientMeta(createForm.patientId) }}</span>
                            </div>
                        </SheetHeader>

                        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                            <div class="space-y-6">
                                <Alert v-if="createMessage" variant="destructive">
                                    <AlertTitle>Schedule access issue</AlertTitle>
                                    <AlertDescription>{{ createMessage }}</AlertDescription>
                                </Alert>

                                <Alert v-if="createConflictAppointment" class="border-amber-300 bg-amber-50">
                                    <AlertTitle class="text-amber-900">Use the existing active visit</AlertTitle>
                                    <AlertDescription class="space-y-3 text-amber-900">
                                        <p>
                                            This patient already has
                                            {{ createConflictAppointment.appointmentNumber || 'an active appointment' }}
                                            <template v-if="createConflictAppointment.scheduledAt">
                                                scheduled {{ formatDateTime(createConflictAppointment.scheduledAt) }}
                                            </template>
                                            <template v-if="createConflictAppointment.department">
                                                in {{ createConflictAppointment.department }}
                                            </template>
                                            . Continue that visit instead of creating a duplicate encounter.
                                        </p>
                                        <div class="flex flex-wrap gap-2">
                                            <Button size="sm" class="gap-1.5" @click="void openCreateConflictAppointment()">
                                                <AppIcon name="calendar-clock" class="size-3.5" />
                                                Open existing visit
                                            </Button>
                                            <Button
                                                v-if="createConflictAppointmentHref"
                                                size="sm"
                                                variant="outline"
                                                as-child
                                                class="gap-1.5 border-amber-300 bg-white/70 text-amber-950 hover:bg-white"
                                            >
                                                <Link :href="createConflictAppointmentHref">
                                                    <AppIcon name="arrow-up-right" class="size-3.5" />
                                                    Open in queue
                                                </Link>
                                            </Button>
                                        </div>
                                    </AlertDescription>
                                </Alert>

                                <section
                                    v-if="createForm.sourceAdmissionId.trim()"
                                    class="space-y-3 rounded-lg border bg-muted/20 p-4"
                                >
                                    <div class="flex flex-wrap items-start justify-between gap-3">
                                        <div class="space-y-1">
                                            <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Post-discharge handoff</p>
                                            <p class="text-sm font-medium text-foreground">
                                                {{
                                                    createSourceAdmissionSummary?.admissionNumber
                                                        || `Admission ${createForm.sourceAdmissionId.slice(0, 8)}`
                                                }}
                                            </p>
                                            <p class="text-sm text-muted-foreground">
                                                {{
                                                    createSourceAdmissionLoading
                                                        ? 'Loading discharge handoff context...'
                                                        : (createSourceAdmissionError
                                                            || 'This follow-up appointment remains linked to the discharged inpatient stay.')
                                                }}
                                            </p>
                                        </div>
                                        <Badge variant="secondary">Discharge follow-up</Badge>
                                    </div>
                                    <div class="grid gap-3 md:grid-cols-2">
                                        <div class="space-y-1">
                                            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Destination</p>
                                            <p class="text-sm text-foreground">
                                                {{ createSourceAdmissionSummary?.dischargeDestination || 'Not recorded' }}
                                            </p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Follow-up plan</p>
                                            <p class="text-sm leading-6 text-foreground">
                                                {{ createSourceAdmissionSummary?.followUpPlan || 'No follow-up plan recorded.' }}
                                            </p>
                                        </div>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Button
                                            v-if="canReadAdmissions"
                                            size="sm"
                                            variant="outline"
                                            as-child
                                            class="gap-1.5"
                                        >
                                            <Link :href="sourceAdmissionWorkflowHref(createForm.patientId, createForm.sourceAdmissionId)">
                                                <AppIcon name="bed-double" class="size-3.5" />
                                                Open source admission
                                            </Link>
                                        </Button>
                                        <Button
                                            v-if="canReadMedicalRecords"
                                            size="sm"
                                            variant="outline"
                                            as-child
                                            class="gap-1.5"
                                        >
                                            <Link :href="sourceAdmissionMedicalRecordsHref(createForm.patientId, createForm.sourceAdmissionId)">
                                                <AppIcon name="file-text" class="size-3.5" />
                                                Open source clinical records
                                            </Link>
                                        </Button>
                                    </div>
                                </section>

                                <!-- Visit type toggle: scheduled vs walk-in -->
                                <section v-if="!createForm.sourceAdmissionId.trim()" class="space-y-3 border-t pt-5">
                                    <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Arrival type</p>
                                    <div class="flex gap-2">
                                        <button
                                            type="button"
                                            class="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors"
                                            :class="createForm.appointmentType === 'scheduled' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted/40'"
                                            @click="createForm.appointmentType = 'scheduled'"
                                        >
                                            <AppIcon name="calendar" class="size-3.5" />
                                            Scheduled
                                        </button>
                                        <button
                                            type="button"
                                            class="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors"
                                            :class="createForm.appointmentType === 'walk_in' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted/40'"
                                            @click="createForm.appointmentType = 'walk_in'"
                                        >
                                            <AppIcon name="log-in" class="size-3.5" />
                                            Walk-in
                                        </button>
                                    </div>
                                    <p v-if="createForm.appointmentType === 'walk_in'" class="text-xs text-muted-foreground">
                                        Walk-in arrivals are unscheduled. The scheduled time will be set to now and the visit will be counted separately in front-desk metrics.
                                    </p>
                                </section>

                                <!-- Patient -->
                                <section v-if="!createPatientLocked" class="space-y-3">
                                    <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Patient</p>
                                    <PatientLookupField
                                        input-id="appointment-create-patient-id"
                                        v-model="createForm.patientId"
                                        label="Patient"
                                        placeholder="Search patient by name, patient number, phone, email, or national ID"
                                        :error-message="createFieldError('patientId')"
                                        @selected="(patient) => patient && hydratePatientSummary(patient.id)"
                                    />
                                </section>

                                <!-- Visit routing -->
                                <section class="space-y-3 border-t pt-5">
                                    <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Visit routing</p>
                                    <div class="grid gap-4 xl:grid-cols-2">
                                        <div class="grid gap-2">
                                            <template v-if="canReadClinicianDirectory && clinicianDirectoryAvailable">
                                                <SearchableSelectField
                                                    input-id="appointment-create-clinician-user-id"
                                                    v-model="createClinicianUserIdValue"
                                                    label="Preferred clinician"
                                                    :options="clinicianOptions"
                                                    placeholder="Select clinician"
                                                    search-placeholder="Search by name, employee number, role, specialty, department, or user ID"
                                                    :helper-text="clinicianHelperText"
                                                    :error-message="createFieldError('clinicianUserId')"
                                                    empty-text="No active clinician matched that search."
                                                    :disabled="clinicianDirectoryLoading || createSubmitting"
                                                />
                                            </template>
                                            <template v-else>
                                                <FormFieldShell
                                                    input-id="appointment-create-clinician-user-id"
                                                    label="Preferred clinician user ID"
                                                    :helper-text="clinicianHelperText"
                                                    :error-message="createFieldError('clinicianUserId')"
                                                >
                                                    <Input
                                                        id="appointment-create-clinician-user-id"
                                                        v-model="createClinicianUserIdValue"
                                                        inputmode="numeric"
                                                        placeholder="Optional clinician user ID"
                                                    />
                                                </FormFieldShell>
                                            </template>
                                        </div>
                                        <SearchableSelectField
                                            input-id="appointment-create-department"
                                            v-model="createForm.department"
                                            label="Clinic / department"
                                            :options="createDepartmentOptions"
                                            placeholder="Select clinic or department"
                                            search-placeholder="Search clinics and departments"
                                            :helper-text="createDepartmentHelperText"
                                            :error-message="createFieldError('department')"
                                            :disabled="departmentOptionsLoading || createSubmitting"
                                        />
                                    </div>
                                    <div class="rounded-md border bg-muted/20 px-3 py-2.5">
                                        <p class="text-sm text-muted-foreground">{{ createRoutingSummary }}</p>
                                        <div
                                            v-if="selectedCreateClinicianSpecialty || selectedCreateClinicianRole || selectedCreateClinicianSpecialtyCode"
                                            class="mt-2 flex flex-wrap items-center gap-1.5"
                                        >
                                            <Badge v-if="selectedCreateClinicianSpecialty" variant="outline" class="text-[11px]">{{ selectedCreateClinicianSpecialty }}</Badge>
                                            <Badge v-if="selectedCreateClinicianRole" variant="outline" class="text-[11px]">{{ selectedCreateClinicianRole }}</Badge>
                                            <Badge v-if="selectedCreateClinicianSpecialtyCode" variant="outline" class="text-[11px]">{{ selectedCreateClinicianSpecialtyCode }}</Badge>
                                        </div>
                                    </div>
                                </section>

                                <!-- Schedule -->
                                <section class="space-y-3 border-t pt-5">
                                    <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Schedule</p>
                                    <div class="grid gap-4 xl:grid-cols-2">
                                        <FormFieldShell
                                            input-id="appointment-create-scheduled-at"
                                            label="Scheduled date & time"
                                            :error-message="createFieldError('scheduledAt')"
                                            container-class="gap-2"
                                        >
                                            <Input
                                                id="appointment-create-scheduled-at"
                                                v-model="createForm.scheduledAt"
                                                type="datetime-local"
                                            />
                                        </FormFieldShell>
                                        <FormFieldShell
                                            input-id="appointment-create-duration"
                                            label="Planned duration (minutes)"
                                            :error-message="createFieldError('durationMinutes')"
                                            container-class="gap-2"
                                        >
                                            <Input
                                                id="appointment-create-duration"
                                                v-model="createForm.durationMinutes"
                                                inputmode="numeric"
                                                placeholder="30"
                                            />
                                        </FormFieldShell>
                                    </div>
                                    <div class="grid gap-3">
                                        <SearchableSelectField
                                            input-id="appointment-create-reason"
                                            v-model="createVisitReasonValue"
                                            label="Visit reason"
                                            :options="visitReasonOptions"
                                            placeholder="Select visit reason"
                                            search-placeholder="Search common visit reasons"
                                            :helper-text="createVisitReasonHelperText"
                                            :error-message="createFieldError('reason')"
                                            :disabled="createSubmitting"
                                            empty-text="No common visit reason matched that search."
                                        />
                                        <FormFieldShell
                                            v-if="usingCustomVisitReason"
                                            input-id="appointment-create-custom-reason"
                                            label="Custom visit reason"
                                            container-class="gap-2"
                                        >
                                            <Input
                                                id="appointment-create-custom-reason"
                                                v-model="createCustomVisitReasonValue"
                                                placeholder="Enter the visit reason"
                                            />
                                        </FormFieldShell>
                                    </div>
                                </section>

                                <!-- Payment coverage -->
                                <section class="space-y-3 border-t pt-5">
                                    <div class="flex items-center justify-between gap-2">
                                        <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Payment coverage</p>
                                        <Badge variant="outline" class="text-[11px]">Visit-level</Badge>
                                    </div>
                                    <div class="flex rounded-lg border p-1 gap-1">
                                        <button
                                            type="button"
                                            :class="['flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors', createCoverageMode === 'self_pay' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground']"
                                            @click="createCoverageMode = 'self_pay'"
                                        >
                                            Self-pay / cash
                                        </button>
                                        <button
                                            type="button"
                                            :class="['flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors', createCoverageMode === 'third_party' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground']"
                                            @click="createCoverageMode = 'third_party'"
                                        >
                                            Insurance / sponsor
                                        </button>
                                    </div>
                                    <div class="rounded-md border bg-muted/20 px-3 py-2.5">
                                        <p class="text-sm font-medium">{{ createCoverageSummary }}</p>
                                        <p class="mt-0.5 text-xs text-muted-foreground">{{ createCoverageGuidance }}</p>
                                    </div>
                                    <div v-if="createCoverageIsThirdParty" class="grid gap-4">
                                        <div class="grid gap-3 md:grid-cols-2">
                                            <SearchableSelectField
                                                input-id="appointment-create-financial-class"
                                                v-model="createForm.financialClass"
                                                label="Coverage type"
                                                :options="THIRD_PARTY_FINANCIAL_CLASS_OPTIONS"
                                                placeholder="Select third-party coverage"
                                                search-placeholder="Search insurance, employer, government, donor..."
                                                helper-text="Choose the sponsor class first, then link the exact payer contract when known."
                                                :error-message="createFieldError('financialClass')"
                                                :disabled="createSubmitting"
                                            />
                                            <SearchableSelectField
                                                v-if="canReadBillingPayerContracts"
                                                input-id="appointment-create-payer-contract"
                                                v-model="createForm.billingPayerContractId"
                                                label="Payer contract"
                                                :options="createBillingPayerContractOptions"
                                                placeholder="Select active payer contract"
                                                search-placeholder="Search payer, plan, or contract code"
                                                :helper-text="billingPayerContractsLoading ? 'Loading active payer contracts...' : 'Select the payer contract used for this visit when it is already known.'"
                                                :error-message="createFieldError('billingPayerContractId')"
                                                :disabled="billingPayerContractsLoading || createSubmitting"
                                                empty-text="No active payer contract matched that search."
                                            />
                                            <p v-else class="text-xs text-muted-foreground pt-1">Payer contract access unavailable — Billing can attach the exact contract later.</p>
                                        </div>
                                        <Alert v-if="canReadBillingPayerContracts && billingPayerContractsError" variant="destructive" class="py-2">
                                            <AlertTitle>Payer contracts unavailable</AlertTitle>
                                            <AlertDescription>{{ billingPayerContractsError }}</AlertDescription>
                                        </Alert>
                                        <div class="grid gap-3 md:grid-cols-2">
                                            <FormFieldShell
                                                input-id="appointment-create-coverage-reference"
                                                label="Member / authorization reference"
                                                :error-message="createFieldError('coverageReference')"
                                                container-class="gap-2"
                                            >
                                                <Input
                                                    id="appointment-create-coverage-reference"
                                                    v-model="createForm.coverageReference"
                                                    placeholder="Policy, member, card, or authorization number"
                                                />
                                            </FormFieldShell>
                                            <FormFieldShell
                                                input-id="appointment-create-coverage-notes"
                                                label="Coverage notes"
                                                :error-message="createFieldError('coverageNotes')"
                                                container-class="gap-2"
                                            >
                                                <Textarea
                                                    id="appointment-create-coverage-notes"
                                                    v-model="createForm.coverageNotes"
                                                    placeholder="Eligibility notes, card details, sponsor limits, or payer instructions."
                                                    rows="3"
                                                />
                                            </FormFieldShell>
                                        </div>
                                    </div>
                                </section>

                                <!-- Front-desk notes -->
                                <section class="space-y-3 border-t pt-5">
                                    <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Front-desk notes</p>
                                    <FormFieldShell
                                        input-id="appointment-create-notes"
                                        label="Notes"
                                        :error-message="createFieldError('notes')"
                                        container-class="gap-2"
                                    >
                                        <Textarea
                                            id="appointment-create-notes"
                                            v-model="createForm.notes"
                                            placeholder="Add arrival notes, queue context, or handoff details for the team."
                                            rows="4"
                                        />
                                    </FormFieldShell>
                                </section>
                            </div>
                        </div>

                        <SheetFooter class="shrink-0 gap-2 border-t bg-background px-6 py-4">
                            <Button v-if="hasCreateAlerts" variant="outline" @click="dismissCreateAlerts">
                                Dismiss alerts
                            </Button>
                            <Button variant="outline" @click="handleCreateSheetOpenChange(false)">Close</Button>
                            <Button :disabled="createSubmitting" @click="submitCreate">
                                <AppIcon v-if="!createSubmitting" name="calendar-clock" class="mr-1.5 size-3.5" />
                                {{ createSubmitting ? 'Scheduling...' : 'Schedule appointment' }}
                            </Button>
                        </SheetFooter>
                    </div>
                </SheetContent>
            </Sheet>

            <Sheet :open="detailsOpen" @update:open="(open) => (open ? (detailsOpen = true) : closeDetails())">
                <SheetContent side="right" variant="workspace">
                    <div class="flex h-full flex-col overflow-hidden">
                        <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0 space-y-1">
                                    <p class="text-[11px] font-medium text-muted-foreground">
                                        {{ detailsAppointment?.appointmentNumber || 'Appointment' }}
                                    </p>
                                    <SheetTitle class="text-base leading-tight">
                                        {{ detailsAppointment?.patientId ? patientDisplayName(detailsAppointment.patientId) : 'Appointment details' }}
                                    </SheetTitle>
                                    <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        <Badge v-if="detailsAppointment?.status" :variant="statusVariant(detailsAppointment.status)" class="text-[11px]">
                                            {{ formatEnumLabel(detailsAppointment.status) }}
                                        </Badge>
                                        <span class="text-[11px] text-muted-foreground">
                                            {{ detailsAppointment?.department || 'No department' }}
                                            <template v-if="detailsAppointment?.scheduledAt"> · {{ formatDateTime(detailsAppointment.scheduledAt) }}</template>
                                            <template v-if="detailsAppointment?.durationMinutes"> · {{ detailsAppointment.durationMinutes }} min</template>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </SheetHeader>
                        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <ScrollArea class="min-h-0 flex-1" viewport-class="pb-12">
                                <div class="space-y-6 px-6 py-5 pb-16">
                                    <div v-if="detailsLoading" class="space-y-4">
                                        <Skeleton class="h-28 rounded-lg" />
                                        <Skeleton class="h-80 rounded-lg" />
                                        <Skeleton class="h-56 rounded-lg" />
                                    </div>

                                    <Alert v-else-if="detailsError" variant="destructive">
                                        <AlertTitle>Details unavailable</AlertTitle>
                                        <AlertDescription>{{ detailsError }}</AlertDescription>
                                    </Alert>

                                    <Alert v-else-if="!detailsAppointment" variant="default">
                                        <AlertTitle>No appointment selected</AlertTitle>
                                        <AlertDescription>Select an appointment from the queue to review details.</AlertDescription>
                                    </Alert>

                                    <Tabs v-else v-model="detailsTab" class="space-y-6">
                                        <Alert v-if="detailsStatusNotice" variant="default">
                                            <AlertTitle>{{ detailsStatusNotice.title }}</AlertTitle>
                                            <AlertDescription>{{ detailsStatusNotice.message }}</AlertDescription>
                                        </Alert>

                                        <div class="overflow-x-auto">
                                            <TabsList class="!inline-flex !h-auto min-h-9 flex-nowrap gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
                                                <TabsTrigger value="summary" class="!h-8 shrink-0 px-3">Summary</TabsTrigger>
                                                <TabsTrigger value="workflow" class="!h-8 shrink-0 px-3">Workflow</TabsTrigger>
                                                <TabsTrigger
                                                    v-if="canShowEncounterCareForAppointment(detailsAppointment)"
                                                    value="encounter"
                                                    class="!h-8 shrink-0 px-3"
                                                >
                                                    Encounter
                                                </TabsTrigger>
                                                <TabsTrigger v-if="canShowReferralTab" value="referrals" class="!h-8 shrink-0 px-3">Referrals</TabsTrigger>
                                                <TabsTrigger v-if="canViewAudit" value="audit" class="!h-8 shrink-0 px-3">Audit</TabsTrigger>
                                            </TabsList>
                                        </div>

                                        <TabsContent value="summary" class="pb-10">
                                            <div class="space-y-8">
                                                <div class="rounded-lg border bg-background p-5">
                                                    <div class="space-y-8">
                                                        <div class="space-y-8">
                                                            <section class="space-y-4">
                                                                <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">People & assignment</p>

                                                                <div class="overflow-hidden rounded-lg border border-border/60 bg-muted/10">
                                                                    <div class="flex flex-col gap-4 p-4 sm:p-5">
                                                                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                                            <div class="min-w-0 space-y-1.5">
                                                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Patient</p>
                                                                                <p class="text-base font-semibold text-foreground">{{ patientDisplayName(detailsAppointment.patientId) }}</p>
                                                                                <p class="text-sm text-muted-foreground">{{ patientMeta(detailsAppointment.patientId) }}</p>
                                                                            </div>
                                                                            <Button v-if="detailsAppointment.patientId" size="sm" variant="outline" class="justify-start gap-1.5 sm:shrink-0" as-child>
                                                                                <Link :href="patientChartHref(detailsAppointment.patientId, { appointmentId: detailsAppointment.id, from: 'appointments' })">
                                                                                    <AppIcon name="book-open" class="size-3.5" />
                                                                                    Open patient chart
                                                                                </Link>
                                                                            </Button>
                                                                        </div>
                                                                    </div>

                                                                    <dl class="divide-y divide-border/50">
                                                                        <div class="grid gap-1 px-4 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4 sm:px-5">
                                                                            <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Clinician</dt>
                                                                            <div class="min-w-0">
                                                                                <dd class="text-sm font-medium leading-relaxed text-foreground">{{ clinicianDisplayLabel(detailsAppointment.clinicianUserId) }}</dd>
                                                                                <dd v-if="detailsAppointment.clinicianUserId" class="mt-1 text-xs text-muted-foreground">User ID {{ detailsAppointment.clinicianUserId }}</dd>
                                                                            </div>
                                                                        </div>

                                                                        <div class="grid gap-1 px-4 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4 sm:px-5">
                                                                            <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</dt>
                                                                            <dd class="text-sm font-medium text-foreground">{{ detailsAppointment.department || 'Not assigned' }}</dd>
                                                                        </div>
                                                                    </dl>
                                                                </div>
                                                            </section>

                                                            <section class="space-y-4 border-t border-border/50 pt-6">
                                                                <div>
                                                                    <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visit documentation</p>
                                                                    <p class="mt-1 text-sm text-muted-foreground">What was booked for this visit and what front desk recorded when the appointment was created.</p>
                                                                </div>

                                                                <dl class="space-y-4">
                                                                    <div class="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                                                                        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason for visit</dt>
                                                                        <dd class="text-sm font-medium leading-relaxed text-foreground">
                                                                            {{ detailsAppointment.reason || 'No visit reason was recorded.' }}
                                                                        </dd>
                                                                    </div>

                                                                    <div class="grid gap-1 border-t border-border/40 pt-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                                                                        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scheduling notes</dt>
                                                                        <dd class="text-sm leading-relaxed text-foreground">
                                                                            {{ detailsAppointment.notes || 'No front-desk notes were recorded.' }}
                                                                        </dd>
                                                                    </div>
                                                                </dl>
                                                            </section>

                                                            <section
                                                                v-if="detailsAppointment.sourceAdmissionId"
                                                                class="space-y-4 border-t border-border/50 pt-6"
                                                            >
                                                                <div>
                                                                    <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Post-discharge handoff</p>
                                                                    <p class="mt-1 text-sm text-muted-foreground">
                                                                        This follow-up appointment was scheduled from a discharged inpatient stay.
                                                                    </p>
                                                                </div>
                                                                <dl class="space-y-4">
                                                                    <div class="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                                                                        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source admission</dt>
                                                                        <dd class="text-sm font-medium leading-relaxed text-foreground">
                                                                            {{
                                                                                detailsSourceAdmissionSummary?.admissionNumber
                                                                                    || `Admission ${detailsAppointment.sourceAdmissionId.slice(0, 8)}`
                                                                            }}
                                                                        </dd>
                                                                    </div>

                                                                    <div class="grid gap-1 border-t border-border/40 pt-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                                                                        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Discharge destination</dt>
                                                                        <dd class="text-sm leading-relaxed text-foreground">
                                                                            {{ detailsSourceAdmissionSummary?.dischargeDestination || 'Not recorded' }}
                                                                        </dd>
                                                                    </div>

                                                                    <div class="grid gap-1 border-t border-border/40 pt-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                                                                        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Follow-up plan</dt>
                                                                        <div>
                                                                            <dd class="text-sm leading-relaxed text-foreground">
                                                                                {{ detailsSourceAdmissionSummary?.followUpPlan || 'No follow-up plan recorded.' }}
                                                                            </dd>
                                                                            <p class="mt-1 text-xs text-muted-foreground">
                                                                                {{
                                                                                    detailsSourceAdmissionLoading
                                                                                        ? 'Loading source admission details...'
                                                                                        : (detailsSourceAdmissionError || 'The follow-up plan stays linked to the source discharge workflow.')
                                                                                }}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </dl>
                                                            </section>

                                                            <section class="space-y-3 border-t border-border/50 pt-6">
                                                                <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Triage & intake</p>
                                                                <div>
                                                                    <p class="text-sm font-medium text-foreground">{{ hasRecordedTriage(detailsAppointment) ? triageSummaryPreview(detailsAppointment) : appointmentStatusNoteText(detailsAppointment) }}</p>
                                                                    <p class="mt-1 text-sm text-muted-foreground">
                                                                        {{ hasRecordedTriage(detailsAppointment)
                                                                            ? `${triageRecordedByLabel(detailsAppointment)} - ${triageRecordedAtLabel(detailsAppointment)}`
                                                                            : 'No triage record has been captured yet.' }}
                                                                    </p>
                                                                </div>
                                                            </section>
                                                        </div>

                                                        <div class="space-y-8 border-t border-border/50 pt-6">
                                                            <section class="space-y-4">
                                                                <div>
                                                                    <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visit payment coverage</p>
                                                                    <p class="mt-1 text-sm text-muted-foreground">
                                                                        Coverage captured at scheduling/check-in and inherited by Billing for invoice creation.
                                                                    </p>
                                                                </div>
                                                                <dl class="space-y-4">
                                                                    <div class="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                                                                        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coverage</dt>
                                                                        <dd class="text-sm font-medium text-foreground">
                                                                            {{ financialClassLabel(detailsAppointment.financialClass) }}
                                                                        </dd>
                                                                    </div>

                                                                    <div class="grid gap-1 border-t border-border/40 pt-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                                                                        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payer contract</dt>
                                                                        <dd class="text-sm font-medium text-foreground">
                                                                            {{ appointmentPayerContractLabel(detailsAppointment) }}
                                                                        </dd>
                                                                    </div>

                                                                    <div class="grid gap-1 border-t border-border/40 pt-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                                                                        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Member / authorization reference</dt>
                                                                        <dd class="text-sm font-medium text-foreground">
                                                                            {{ detailsAppointment.coverageReference || 'Not recorded' }}
                                                                        </dd>
                                                                    </div>

                                                                    <div class="grid gap-1 border-t border-border/40 pt-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                                                                        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coverage notes</dt>
                                                                        <dd class="text-sm leading-relaxed text-foreground">
                                                                            {{ detailsAppointment.coverageNotes || 'No coverage notes were recorded.' }}
                                                                        </dd>
                                                                    </div>
                                                                </dl>
                                                            </section>

                                                            <section class="space-y-4 border-t border-border/50 pt-6">
                                                                <div>
                                                                    <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timestamps</p>
                                                                    <p class="mt-1 text-sm text-muted-foreground">Booking, schedule, updates, and triage time for this appointment.</p>
                                                                </div>
                                                                <dl class="space-y-4">
                                                                    <div class="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                                                                        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Booked</dt>
                                                                        <dd class="text-sm font-medium text-foreground">{{ formatDateTime(detailsAppointment.createdAt) }}</dd>
                                                                    </div>

                                                                    <div class="grid gap-1 border-t border-border/40 pt-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                                                                        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scheduled for</dt>
                                                                        <dd class="text-sm font-medium text-foreground">{{ formatDateTime(detailsAppointment.scheduledAt) }}</dd>
                                                                    </div>

                                                                    <div class="grid gap-1 border-t border-border/40 pt-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                                                                        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last updated</dt>
                                                                        <dd class="text-sm font-medium text-foreground">{{ formatDateTime(detailsAppointment.updatedAt) }}</dd>
                                                                    </div>

                                                                    <div class="grid gap-1 border-t border-border/40 pt-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                                                                        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Triaged</dt>
                                                                        <div>
                                                                            <dd class="text-sm font-medium text-foreground">{{ triageRecordedAtLabel(detailsAppointment) }}</dd>
                                                                            <dd class="mt-1 text-xs text-muted-foreground">{{ triageRecordedByLabel(detailsAppointment) }}</dd>
                                                                        </div>
                                                                    </div>
                                                                </dl>
                                                            </section>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="workflow" class="pb-10">
                                            <div class="rounded-lg border bg-background p-5 space-y-8">
                                                <div class="space-y-8">
                                                    <section class="space-y-3">
                                                        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current status</p>
                                                        <p class="text-sm text-muted-foreground">
                                                            {{ isMyClinicalQueue ? 'Your queue context.' : (isTriageQueue ? 'Nursing handoff context.' : 'Front-desk queue context.') }}
                                                        </p>
                                                        <p class="text-lg font-semibold leading-snug text-foreground">{{ appointmentFocusLabel(detailsAppointment) }}</p>
                                                        <p class="text-sm text-muted-foreground">{{ appointmentNextStep(detailsAppointment) }}</p>
                                                    </section>

                                                    <section
                                                        v-if="detailsAppointment.sourceAdmissionId"
                                                        class="space-y-4 rounded-lg border bg-muted/20 p-4"
                                                    >
                                                        <div class="flex flex-wrap items-start justify-between gap-3">
                                                            <div class="space-y-1">
                                                                <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Post-discharge handoff</p>
                                                                <p class="text-base font-semibold text-foreground">
                                                                    {{
                                                                        detailsSourceAdmissionSummary?.admissionNumber
                                                                            || `Admission ${detailsAppointment.sourceAdmissionId.slice(0, 8)}`
                                                                    }}
                                                                </p>
                                                                <p class="text-sm text-muted-foreground">
                                                                    {{
                                                                        detailsSourceAdmissionLoading
                                                                            ? 'Loading source discharge context...'
                                                                            : (detailsSourceAdmissionError
                                                                                || 'Use this visit to continue the discharge plan, referral routing, and clinic review from the inpatient stay.')
                                                                    }}
                                                                </p>
                                                            </div>
                                                            <Badge variant="secondary">Discharge follow-up</Badge>
                                                        </div>
                                                        <div class="grid gap-3 md:grid-cols-2">
                                                            <div class="space-y-1">
                                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Destination</p>
                                                                <p class="text-sm text-foreground">
                                                                    {{ detailsSourceAdmissionSummary?.dischargeDestination || 'Not recorded' }}
                                                                </p>
                                                            </div>
                                                            <div class="space-y-1">
                                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Follow-up plan</p>
                                                                <p class="text-sm leading-6 text-foreground">
                                                                    {{ detailsSourceAdmissionSummary?.followUpPlan || 'No follow-up plan recorded.' }}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div class="flex flex-wrap gap-2">
                                                            <Button
                                                                v-if="canReadAdmissions"
                                                                size="sm"
                                                                variant="outline"
                                                                as-child
                                                                class="gap-1.5"
                                                            >
                                                                <Link :href="sourceAdmissionWorkflowHref(detailsAppointment.patientId, detailsAppointment.sourceAdmissionId)">
                                                                    <AppIcon name="bed-double" class="size-3.5" />
                                                                    Open source admission
                                                                </Link>
                                                            </Button>
                                                            <Button
                                                                v-if="canReadMedicalRecords"
                                                                size="sm"
                                                                variant="outline"
                                                                as-child
                                                                class="gap-1.5"
                                                            >
                                                                <Link :href="sourceAdmissionMedicalRecordsHref(detailsAppointment.patientId, detailsAppointment.sourceAdmissionId)">
                                                                    <AppIcon name="file-text" class="size-3.5" />
                                                                    Open source clinical records
                                                                </Link>
                                                            </Button>
                                                            <Button
                                                                v-if="canManageReferrals && !canShowReferralTab"
                                                                size="sm"
                                                                class="gap-1.5"
                                                                @click="openReferralDialog"
                                                            >
                                                                <AppIcon name="plus" class="size-3.5" />
                                                                Create referral
                                                            </Button>
                                                            <Button
                                                                v-else-if="canShowReferralTab"
                                                                size="sm"
                                                                variant="outline"
                                                                class="gap-1.5"
                                                                @click="detailsTab = 'referrals'"
                                                            >
                                                                <AppIcon name="arrow-up-right" class="size-3.5" />
                                                                Open referrals
                                                            </Button>
                                                        </div>
                                                    </section>
                                                </div>

                                                <div class="space-y-8 border-t border-border/50 pt-6">
                                                    <section class="space-y-4">
                                                        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clinical path</p>
                                                        <div>
                                                            <p class="text-xs font-medium text-muted-foreground">Recommended next step</p>
                                                            <p class="mt-1 text-base font-semibold text-foreground">
                                                                {{ detailsAppointment ? consultationWorkflowLabel(detailsAppointment) : 'Consultation workflow' }}
                                                            </p>
                                                            <p class="mt-1 text-sm text-muted-foreground">
                                                                {{ detailsAppointment ? consultationWorkflowHelpText(detailsAppointment) : 'Open the linked consultation workflow for this patient.' }}
                                                            </p>
                                                        </div>
                                                        <div v-if="hasRecordedTriage(detailsAppointment)" class="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4">
                                                            <p class="text-xs font-medium text-muted-foreground">Triage on file</p>
                                                            <p class="mt-1 text-sm font-medium text-foreground">{{ triageSummaryPreview(detailsAppointment) }}</p>
                                                            <p class="mt-1 text-xs text-muted-foreground">{{ triageRecordedByLabel(detailsAppointment) }} - {{ triageRecordedAtLabel(detailsAppointment) }}</p>
                                                        </div>
                                                        <Alert v-if="detailsAppointment.status === 'scheduled'" variant="default">
                                                            <AlertTitle>Arrival pending</AlertTitle>
                                                            <AlertDescription>
                                                                {{ isMyClinicalQueue ? 'Front desk still needs to check this patient in before consultation can start from your queue.' : (isTriageQueue ? 'Front desk still needs to complete arrival check-in before nurse triage can start.' : 'Check the patient in first. Consultation and downstream orders stay behind that arrival step so the front desk has one obvious next action.') }}
                                                            </AlertDescription>
                                                        </Alert>
                                                        <Alert v-else-if="detailsAppointment.status === 'waiting_triage'" variant="default">
                                                            <AlertTitle>Triage active</AlertTitle>
                                                            <AlertDescription>
                                                                {{ isMyClinicalQueue ? 'Nurse triage still needs to record vitals and intake notes before this visit enters your provider queue.' : (isTriageQueue ? 'Record vitals and intake here, then send the patient to the provider queue.' : 'Record triage and vitals here, then send the patient to the provider queue.') }}
                                                            </AlertDescription>
                                                        </Alert>
                                                    </section>

                                                    <section class="space-y-4 border-t border-border/50 pt-6">
                                                        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Primary actions</p>
                                                        <div v-if="detailsAppointment.status === 'scheduled' && !isMyClinicalQueue && !isTriageQueue" class="space-y-3">
                                                            <div class="flex items-center gap-2">
                                                                <Button v-if="canUpdateStatus" class="gap-1.5" @click="openStatusDialog(detailsAppointment, 'waiting_triage', 'details')">
                                                                    <AppIcon name="check-circle" class="size-3.5" />
                                                                    Check in patient
                                                                </Button>
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger as-child>
                                                                        <Button variant="outline" size="sm" class="gap-1">
                                                                            More
                                                                            <AppIcon name="chevron-down" class="size-3.5" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuItem @click="openRescheduleDialog(detailsAppointment)">
                                                                            <AppIcon name="calendar" class="mr-2 size-3.5" />
                                                                            Reschedule
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem v-if="canUpdateStatus" @click="openStatusDialog(detailsAppointment, 'no_show', 'details')">
                                                                            <AppIcon name="user-x" class="mr-2 size-3.5" />
                                                                            No-show
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem v-if="canUpdateStatus" class="text-destructive focus:text-destructive" @click="openStatusDialog(detailsAppointment, 'cancelled', 'details')">
                                                                            <AppIcon name="circle-x" class="mr-2 size-3.5" />
                                                                            Cancel
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                            <p class="text-xs text-muted-foreground">
                                                                <span class="font-medium text-foreground">Arrival step.</span>
                                                                Check-in moves the patient into triage and unlocks the rest of the encounter workflow.
                                                            </p>
                                                        </div>
                                                        <div v-else-if="detailsAppointment.status === 'waiting_triage' && !isMyClinicalQueue" class="space-y-3">
                                                            <div class="flex items-center gap-2">
                                                                <Button v-if="canRecordOpdTriage" class="gap-1.5" @click="openTriageSheet(detailsAppointment)">
                                                                    <AppIcon name="activity" class="size-3.5" />
                                                                    Record triage
                                                                </Button>
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger as-child>
                                                                        <Button variant="outline" size="sm" class="gap-1">
                                                                            More
                                                                            <AppIcon name="chevron-down" class="size-3.5" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuItem v-if="canUpdateStatus" class="text-destructive focus:text-destructive" @click="openStatusDialog(detailsAppointment, 'cancelled', 'details')">
                                                                            <AppIcon name="circle-x" class="mr-2 size-3.5" />
                                                                            Cancel
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                            <p class="text-xs text-muted-foreground">
                                                                <span class="font-medium text-foreground">Nursing step.</span>
                                                                Capture vitals and intake here, then move the visit into the provider queue.
                                                            </p>
                                                        </div>
                                                        <div v-else-if="detailsAppointment.status === 'scheduled'" class="rounded-md bg-muted/30 p-4">
                                                            <p class="text-sm font-medium text-foreground">Waiting for front desk</p>
                                                            <p class="mt-1 text-sm text-muted-foreground">This visit advances automatically after check-in.</p>
                                                        </div>
                                                        <div v-else-if="detailsAppointment.status === 'waiting_triage'" class="rounded-md bg-muted/30 p-4">
                                                            <p class="text-sm font-medium text-foreground">Waiting for nurse triage</p>
                                                            <p class="mt-1 text-sm text-muted-foreground">Vitals and notes move this visit into the provider queue.</p>
                                                        </div>
                                                        <div v-else class="space-y-3">
                                                            <Button
                                                                v-if="canAccessConsultationWorkflow(detailsAppointment)"
                                                                :variant="['waiting_provider', 'in_consultation'].includes(detailsAppointment.status || '') ? 'default' : 'outline'"
                                                                class="justify-start gap-1.5"
                                                                :disabled="isLaunchingConsultation(detailsAppointment)"
                                                                @click="void launchConsultationWorkflow(detailsAppointment)"
                                                            >
                                                                <AppIcon name="stethoscope" class="size-3.5" />
                                                                {{ isLaunchingConsultation(detailsAppointment) ? 'Opening...' : consultationWorkflowLabel(detailsAppointment) }}
                                                            </Button>
                                                            <p v-if="detailsAppointment.status === 'waiting_provider'" class="text-xs text-muted-foreground">
                                                                <span class="font-medium text-foreground">Session start.</span>
                                                                Marks the visit in provider care and opens the chart with triage context.
                                                            </p>
                                                            <p v-else-if="detailsAppointment.status === 'in_consultation'" class="text-xs text-muted-foreground">
                                                                <span class="font-medium text-foreground">After consultation.</span>
                                                                Use close-out and related modules when the encounter is finished.
                                                            </p>
                                                            <div class="flex flex-wrap gap-2">
                                                                <Button v-if="canManageProviderSession && detailsAppointment.status === 'waiting_provider'" variant="outline" size="sm" class="gap-1.5" @click="openProviderStatusDialog(detailsAppointment, 'waiting_triage')">
                                                                    <AppIcon name="activity" class="size-3.5" />
                                                                    Send back to triage
                                                                </Button>
                                                                <Button v-if="canManageProviderSession && detailsAppointment.status === 'in_consultation'" variant="outline" size="sm" class="gap-1.5" @click="openProviderStatusDialog(detailsAppointment, 'waiting_provider')">
                                                                    <AppIcon name="clipboard-list" class="size-3.5" />
                                                                    Return to provider queue
                                                                </Button>
                                                                <Button v-if="canManageProviderSession && detailsAppointment.status === 'in_consultation'" variant="outline" size="sm" class="gap-1.5" @click="openProviderStatusDialog(detailsAppointment, 'waiting_triage')">
                                                                    <AppIcon name="activity" class="size-3.5" />
                                                                    Send back to triage
                                                                </Button>
                                                                <Button v-if="canManageProviderSession && detailsAppointment.status === 'in_consultation'" variant="outline" size="sm" class="gap-1.5" @click="openProviderStatusDialog(detailsAppointment, 'completed')">
                                                                    <AppIcon name="check-circle" class="size-3.5" />
                                                                    Complete visit
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </section>

                                                    <section v-if="detailsAppointment.patientId && canLaunchClinicalHandoff(detailsAppointment)" class="space-y-3 border-t border-border/50 pt-6">
                                                        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Related workflows</p>
                                                        <div class="flex flex-wrap items-center gap-2">
                                                            <Button v-if="canManageReferrals && !canShowReferralTab" size="sm" class="gap-1.5" @click="openReferralDialog">
                                                                <AppIcon name="plus" class="size-3.5" />
                                                                Create referral
                                                            </Button>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger as-child>
                                                                    <Button variant="outline" size="sm" class="gap-1">
                                                                        Open in
                                                                        <AppIcon name="chevron-down" class="size-3.5" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="start">
                                                                    <DropdownMenuItem v-if="canReadAdmissions" as-child>
                                                                        <Link :href="relatedWorkflowHref('/admissions', detailsAppointment.patientId)" class="flex items-center gap-2">
                                                                            <AppIcon name="bed-double" class="size-3.5" />
                                                                            Admissions
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem v-if="canReadLaboratory" as-child>
                                                                        <Link :href="relatedCreateWorkflowHref('/laboratory-orders', detailsAppointment)" class="flex items-center gap-2">
                                                                            <AppIcon name="flask-conical" class="size-3.5" />
                                                                            Lab orders
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem v-if="canReadPharmacy" as-child>
                                                                        <Link :href="relatedCreateWorkflowHref('/pharmacy-orders', detailsAppointment)" class="flex items-center gap-2">
                                                                            <AppIcon name="pill" class="size-3.5" />
                                                                            Pharmacy
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem v-if="canReadRadiology" as-child>
                                                                        <Link :href="relatedCreateWorkflowHref('/radiology-orders', detailsAppointment)" class="flex items-center gap-2">
                                                                            <AppIcon name="activity" class="size-3.5" />
                                                                            Imaging
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem v-if="canReadTheatre && canCreateTheatre" as-child>
                                                                        <Link :href="relatedCreateWorkflowHref('/theatre-procedures', detailsAppointment)" class="flex items-center gap-2">
                                                                            <AppIcon name="scissors" class="size-3.5" />
                                                                            Theatre
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem v-if="canReadBilling" as-child>
                                                                        <Link :href="relatedCreateWorkflowHref('/billing-invoices', detailsAppointment)" class="flex items-center gap-2">
                                                                            <AppIcon name="receipt" class="size-3.5" />
                                                                            Billing
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </section>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent
                                            v-if="canShowEncounterCareForAppointment(detailsAppointment)"
                                            value="encounter"
                                            class="space-y-8 pb-12"
                                        >
                                                <div class="rounded-lg border bg-background p-5">
                                                <section class="space-y-3 pb-6">
                                                    <div class="flex items-center justify-between gap-2">
                                                        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details by area</p>
                                                        <p class="text-xs text-muted-foreground">
                                                            {{ detailsEncounterCareTotalCount }} items across {{ detailsEncounterCareActiveCount }} {{ detailsEncounterCareActiveCount === 1 ? 'stream' : 'streams' }}
                                                        </p>
                                                    </div>
                                                    <Accordion
                                                        v-model="detailsEncounterCareOpen"
                                                        type="multiple"
                                                        class="w-full space-y-3 pb-8"
                                                    >
                                                    <AccordionItem
                                                        v-if="canReadLaboratory"
                                                        value="laboratory-orders"
                                                        class="overflow-hidden rounded-lg border border-border/50 bg-background px-5 last:mb-2 last:border-b"
                                                    >
                                                        <AccordionTrigger class="py-4 hover:no-underline">
                                                            <div class="flex min-w-0 flex-1 items-start justify-between gap-3 pr-2">
                                                                <div class="min-w-0">
                                                                    <div class="flex flex-wrap items-center gap-2">
                                                                        <p class="text-sm font-medium text-foreground">
                                                                            Laboratory orders
                                                                        </p>
                                                                        <Badge
                                                                            v-if="detailsLaboratoryOrders.length"
                                                                            variant="secondary"
                                                                            class="text-[10px]"
                                                                        >
                                                                            {{ detailsLaboratoryOrders.length }}
                                                                            {{
                                                                                detailsLaboratoryOrders.length === 1
                                                                                    ? 'order'
                                                                                    : 'orders'
                                                                            }}
                                                                        </Badge>
                                                                    </div>
                                                                    <p class="mt-1 text-xs text-muted-foreground">Linked lab requests and result lines for this visit.</p>
                                                                </div>
                                                                <Badge
                                                                    :variant="detailsEncounterCareStateVariant(detailsEncounterCareState(detailsLaboratoryOrders.length, detailsLaboratoryOrdersLoading, detailsLaboratoryOrdersError))"
                                                                    class="mt-0.5 shrink-0 text-[10px]"
                                                                >
                                                                    {{
                                                                        detailsEncounterCareStateLabel(
                                                                            detailsEncounterCareState(
                                                                                detailsLaboratoryOrders.length,
                                                                                detailsLaboratoryOrdersLoading,
                                                                                detailsLaboratoryOrdersError,
                                                                            ),
                                                                        )
                                                                    }}
                                                                </Badge>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent class="pb-5">
                                                            <div
                                                                v-if="detailsLaboratoryOrdersLoading"
                                                                class="space-y-2"
                                                            >
                                                                <Skeleton class="h-14 w-full rounded-lg" />
                                                                <Skeleton class="h-14 w-full rounded-lg" />
                                                            </div>
                                                            <p
                                                                v-else-if="detailsLaboratoryOrdersError"
                                                                class="text-sm text-destructive"
                                                            >
                                                                {{ detailsLaboratoryOrdersError }}
                                                            </p>
                                                            <p
                                                                v-else-if="detailsLaboratoryOrders.length === 0"
                                                                class="text-sm text-muted-foreground"
                                                            >
                                                                No laboratory orders have been linked to this visit yet.
                                                            </p>
                                                            <div
                                                                v-else
                                                                class="max-h-80 divide-y divide-border/50 overflow-y-auto pr-1"
                                                            >
                                                                <div
                                                                    v-for="order in detailsLaboratoryOrders"
                                                                    :key="`appointment-lab-order-${order.id}`"
                                                                    class="py-3 first:pt-0"
                                                                >
                                                                    <div class="flex items-start justify-between gap-3">
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
                                                                        <Badge :variant="laboratoryOrderStatusVariant(order.status)">
                                                                            {{ formatEnumLabel(order.status || 'ordered') }}
                                                                        </Badge>
                                                                    </div>
                                                                    <p class="mt-2 text-xs text-muted-foreground">
                                                                        {{
                                                                            order.resultSummary
                                                                                ? order.resultSummary
                                                                                : order.priority
                                                                                  ? `Priority: ${formatEnumLabel(order.priority)}`
                                                                                  : 'Awaiting laboratory processing.'
                                                                        }}
                                                                    </p>
                                                                    <p
                                                                        v-if="orderLifecycleLinkageText(order, 'laboratory order')"
                                                                        class="mt-1 text-[11px] text-muted-foreground"
                                                                    >
                                                                        {{ orderLifecycleLinkageText(order, 'laboratory order') }}
                                                                    </p>
                                                                    <div
                                                                        v-if="canCreateLaboratory && detailsAppointment"
                                                                        class="mt-3 flex flex-wrap gap-2"
                                                                    >
                                                                        <Button size="sm" variant="outline" as-child class="h-7 gap-1.5 px-2.5 text-[11px]">
                                                                            <Link
                                                                                :href="relatedCreateWorkflowHref('/laboratory-orders', detailsAppointment, {
                                                                                    reorderOfId: order.id,
                                                                                })"
                                                                            >
                                                                                Reorder
                                                                            </Link>
                                                                        </Button>
                                                                        <Button size="sm" variant="outline" as-child class="h-7 gap-1.5 px-2.5 text-[11px]">
                                                                            <Link
                                                                                :href="relatedCreateWorkflowHref('/laboratory-orders', detailsAppointment, {
                                                                                    addOnToOrderId: order.id,
                                                                                })"
                                                                            >
                                                                                Add Linked Test
                                                                            </Link>
                                                                        </Button>
                                                                        <Button
                                                                            v-if="canApplyLaboratoryEncounterLifecycleAction(order, 'cancel')"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            @click="openEncounterLifecycleDialog('laboratory', order.id, 'cancel', order.statusReason)"
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                        <Button
                                                                            v-if="canApplyLaboratoryEncounterLifecycleAction(order, 'entered_in_error')"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            @click="openEncounterLifecycleDialog('laboratory', order.id, 'entered_in_error')"
                                                                        >
                                                                            Entered in error
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                    <AccordionItem
                                                        v-if="canReadPharmacy"
                                                        value="pharmacy-orders"
                                                        class="overflow-hidden rounded-lg border border-border/50 bg-background px-5 last:mb-2 last:border-b"
                                                    >
                                                        <AccordionTrigger class="py-4 hover:no-underline">
                                                            <div class="flex min-w-0 flex-1 items-start justify-between gap-3 pr-2">
                                                                <div class="min-w-0">
                                                                    <div class="flex flex-wrap items-center gap-2">
                                                                        <p class="text-sm font-medium text-foreground">
                                                                            Pharmacy orders
                                                                        </p>
                                                                        <Badge
                                                                            v-if="detailsPharmacyOrders.length"
                                                                            variant="secondary"
                                                                            class="text-[10px]"
                                                                        >
                                                                            {{ detailsPharmacyOrders.length }}
                                                                            {{
                                                                                detailsPharmacyOrders.length === 1
                                                                                    ? 'order'
                                                                                    : 'orders'
                                                                            }}
                                                                        </Badge>
                                                                    </div>
                                                                    <p class="mt-1 text-xs text-muted-foreground">Medications ordered from this encounter.</p>
                                                                </div>
                                                                <Badge
                                                                    :variant="detailsEncounterCareStateVariant(detailsEncounterCareState(detailsPharmacyOrders.length, detailsPharmacyOrdersLoading, detailsPharmacyOrdersError))"
                                                                    class="mt-0.5 shrink-0 text-[10px]"
                                                                >
                                                                    {{
                                                                        detailsEncounterCareStateLabel(
                                                                            detailsEncounterCareState(
                                                                                detailsPharmacyOrders.length,
                                                                                detailsPharmacyOrdersLoading,
                                                                                detailsPharmacyOrdersError,
                                                                            ),
                                                                        )
                                                                    }}
                                                                </Badge>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent class="pb-5">
                                                            <div
                                                                v-if="detailsPharmacyOrdersLoading"
                                                                class="space-y-2"
                                                            >
                                                                <Skeleton class="h-14 w-full rounded-lg" />
                                                                <Skeleton class="h-14 w-full rounded-lg" />
                                                            </div>
                                                            <p
                                                                v-else-if="detailsPharmacyOrdersError"
                                                                class="text-sm text-destructive"
                                                            >
                                                                {{ detailsPharmacyOrdersError }}
                                                            </p>
                                                            <p
                                                                v-else-if="detailsPharmacyOrders.length === 0"
                                                                class="text-sm text-muted-foreground"
                                                            >
                                                                No pharmacy orders have been linked to this visit yet.
                                                            </p>
                                                            <div
                                                                v-else
                                                                class="max-h-80 divide-y divide-border/50 overflow-y-auto pr-1"
                                                            >
                                                                <div
                                                                    v-for="order in detailsPharmacyOrders"
                                                                    :key="`appointment-pharmacy-order-${order.id}`"
                                                                    class="py-3 first:pt-0"
                                                                >
                                                                    <div class="flex items-start justify-between gap-3">
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
                                                                        <Badge :variant="pharmacyOrderStatusVariant(order.status)">
                                                                            {{ formatEnumLabel(order.status || 'pending') }}
                                                                        </Badge>
                                                                    </div>
                                                                    <p class="mt-2 text-xs text-muted-foreground">
                                                                        {{ pharmacyOrderSummaryText(order) }}
                                                                    </p>
                                                                    <p
                                                                        v-if="orderLifecycleLinkageText(order, 'medication order')"
                                                                        class="mt-1 text-[11px] text-muted-foreground"
                                                                    >
                                                                        {{ orderLifecycleLinkageText(order, 'medication order') }}
                                                                    </p>
                                                                    <div
                                                                        v-if="canCreatePharmacy && detailsAppointment"
                                                                        class="mt-3 flex flex-wrap gap-2"
                                                                    >
                                                                        <Button size="sm" variant="outline" as-child class="h-7 gap-1.5 px-2.5 text-[11px]">
                                                                            <Link
                                                                                :href="relatedCreateWorkflowHref('/pharmacy-orders', detailsAppointment, {
                                                                                    reorderOfId: order.id,
                                                                                })"
                                                                            >
                                                                                Reorder
                                                                            </Link>
                                                                        </Button>
                                                                        <Button size="sm" variant="outline" as-child class="h-7 gap-1.5 px-2.5 text-[11px]">
                                                                            <Link
                                                                                :href="relatedCreateWorkflowHref('/pharmacy-orders', detailsAppointment, {
                                                                                    addOnToOrderId: order.id,
                                                                                })"
                                                                            >
                                                                                Add Linked Medication
                                                                            </Link>
                                                                        </Button>
                                                                        <Button
                                                                            v-if="canApplyPharmacyEncounterLifecycleAction(order, 'cancel')"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            @click="openEncounterLifecycleDialog('pharmacy', order.id, 'cancel', order.statusReason)"
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                        <Button
                                                                            v-if="canApplyPharmacyEncounterLifecycleAction(order, 'discontinue')"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            @click="openEncounterLifecycleDialog('pharmacy', order.id, 'discontinue')"
                                                                        >
                                                                            Discontinue
                                                                        </Button>
                                                                        <Button
                                                                            v-if="canApplyPharmacyEncounterLifecycleAction(order, 'entered_in_error')"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            @click="openEncounterLifecycleDialog('pharmacy', order.id, 'entered_in_error')"
                                                                        >
                                                                            Entered in error
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                    <AccordionItem
                                                        v-if="canReadRadiology"
                                                        value="radiology-orders"
                                                        class="overflow-hidden rounded-lg border border-border/50 bg-background px-5 last:mb-2 last:border-b"
                                                    >
                                                        <AccordionTrigger class="py-4 hover:no-underline">
                                                            <div class="flex min-w-0 flex-1 items-start justify-between gap-3 pr-2">
                                                                <div class="min-w-0">
                                                                    <div class="flex flex-wrap items-center gap-2">
                                                                        <p class="text-sm font-medium text-foreground">
                                                                            Imaging orders
                                                                        </p>
                                                                        <Badge
                                                                            v-if="detailsRadiologyOrders.length"
                                                                            variant="secondary"
                                                                            class="text-[10px]"
                                                                        >
                                                                            {{ detailsRadiologyOrders.length }}
                                                                            {{
                                                                                detailsRadiologyOrders.length === 1
                                                                                    ? 'order'
                                                                                    : 'orders'
                                                                            }}
                                                                        </Badge>
                                                                    </div>
                                                                    <p class="mt-1 text-xs text-muted-foreground">Imaging requests and reporting status for this visit.</p>
                                                                </div>
                                                                <Badge
                                                                    :variant="detailsEncounterCareStateVariant(detailsEncounterCareState(detailsRadiologyOrders.length, detailsRadiologyOrdersLoading, detailsRadiologyOrdersError))"
                                                                    class="mt-0.5 shrink-0 text-[10px]"
                                                                >
                                                                    {{
                                                                        detailsEncounterCareStateLabel(
                                                                            detailsEncounterCareState(
                                                                                detailsRadiologyOrders.length,
                                                                                detailsRadiologyOrdersLoading,
                                                                                detailsRadiologyOrdersError,
                                                                            ),
                                                                        )
                                                                    }}
                                                                </Badge>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent class="pb-5">
                                                            <div
                                                                v-if="detailsRadiologyOrdersLoading"
                                                                class="space-y-2"
                                                            >
                                                                <Skeleton class="h-14 w-full rounded-lg" />
                                                                <Skeleton class="h-14 w-full rounded-lg" />
                                                            </div>
                                                            <p
                                                                v-else-if="detailsRadiologyOrdersError"
                                                                class="text-sm text-destructive"
                                                            >
                                                                {{ detailsRadiologyOrdersError }}
                                                            </p>
                                                            <p
                                                                v-else-if="detailsRadiologyOrders.length === 0"
                                                                class="text-sm text-muted-foreground"
                                                            >
                                                                No imaging orders have been linked to this visit yet.
                                                            </p>
                                                            <div
                                                                v-else
                                                                class="max-h-80 divide-y divide-border/50 overflow-y-auto pr-1"
                                                            >
                                                                <div
                                                                    v-for="order in detailsRadiologyOrders"
                                                                    :key="`appointment-radiology-order-${order.id}`"
                                                                    class="py-3 first:pt-0"
                                                                >
                                                                    <div class="flex items-start justify-between gap-3">
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
                                                                        <Badge :variant="radiologyOrderStatusVariant(order.status)">
                                                                            {{ formatEnumLabel(order.status || 'ordered') }}
                                                                        </Badge>
                                                                    </div>
                                                                    <p class="mt-2 text-xs text-muted-foreground">
                                                                        {{ radiologyOrderSummaryText(order) }}
                                                                    </p>
                                                                    <p
                                                                        v-if="orderLifecycleLinkageText(order, 'imaging order')"
                                                                        class="mt-1 text-[11px] text-muted-foreground"
                                                                    >
                                                                        {{ orderLifecycleLinkageText(order, 'imaging order') }}
                                                                    </p>
                                                                    <div
                                                                        v-if="canCreateRadiology && detailsAppointment"
                                                                        class="mt-3 flex flex-wrap gap-2"
                                                                    >
                                                                        <Button size="sm" variant="outline" as-child class="h-7 gap-1.5 px-2.5 text-[11px]">
                                                                            <Link
                                                                                :href="relatedCreateWorkflowHref('/radiology-orders', detailsAppointment, {
                                                                                    reorderOfId: order.id,
                                                                                })"
                                                                            >
                                                                                Reorder
                                                                            </Link>
                                                                        </Button>
                                                                        <Button size="sm" variant="outline" as-child class="h-7 gap-1.5 px-2.5 text-[11px]">
                                                                            <Link
                                                                                :href="relatedCreateWorkflowHref('/radiology-orders', detailsAppointment, {
                                                                                    addOnToOrderId: order.id,
                                                                                })"
                                                                            >
                                                                                Add Linked Study
                                                                            </Link>
                                                                        </Button>
                                                                        <Button
                                                                            v-if="canApplyRadiologyEncounterLifecycleAction(order, 'cancel')"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            @click="openEncounterLifecycleDialog('radiology', order.id, 'cancel', order.statusReason)"
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                        <Button
                                                                            v-if="canApplyRadiologyEncounterLifecycleAction(order, 'entered_in_error')"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            @click="openEncounterLifecycleDialog('radiology', order.id, 'entered_in_error')"
                                                                        >
                                                                            Entered in error
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                    <AccordionItem
                                                        v-if="canReadTheatre"
                                                        value="theatre-procedures"
                                                        class="overflow-hidden rounded-lg border border-border/50 bg-background px-5 last:mb-2 last:border-b"
                                                    >
                                                        <AccordionTrigger class="py-4 hover:no-underline">
                                                            <div class="flex min-w-0 flex-1 items-start justify-between gap-3 pr-2">
                                                                <div class="min-w-0">
                                                                    <div class="flex flex-wrap items-center gap-2">
                                                                        <p class="text-sm font-medium text-foreground">
                                                                            Theatre procedures
                                                                        </p>
                                                                        <Badge
                                                                            v-if="detailsTheatreProcedures.length"
                                                                            variant="secondary"
                                                                            class="text-[10px]"
                                                                        >
                                                                            {{ detailsTheatreProcedures.length }}
                                                                            {{
                                                                                detailsTheatreProcedures.length === 1
                                                                                    ? 'procedure'
                                                                                    : 'procedures'
                                                                            }}
                                                                        </Badge>
                                                                    </div>
                                                                    <p class="mt-1 text-xs text-muted-foreground">Theatre bookings and case progression for this visit.</p>
                                                                </div>
                                                                <Badge
                                                                    :variant="detailsEncounterCareStateVariant(detailsEncounterCareState(detailsTheatreProcedures.length, detailsTheatreProceduresLoading, detailsTheatreProceduresError))"
                                                                    class="mt-0.5 shrink-0 text-[10px]"
                                                                >
                                                                    {{
                                                                        detailsEncounterCareStateLabel(
                                                                            detailsEncounterCareState(
                                                                                detailsTheatreProcedures.length,
                                                                                detailsTheatreProceduresLoading,
                                                                                detailsTheatreProceduresError,
                                                                            ),
                                                                        )
                                                                    }}
                                                                </Badge>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent class="pb-5">
                                                            <div
                                                                v-if="detailsTheatreProceduresLoading"
                                                                class="space-y-2"
                                                            >
                                                                <Skeleton class="h-14 w-full rounded-lg" />
                                                                <Skeleton class="h-14 w-full rounded-lg" />
                                                            </div>
                                                            <p
                                                                v-else-if="detailsTheatreProceduresError"
                                                                class="text-sm text-destructive"
                                                            >
                                                                {{ detailsTheatreProceduresError }}
                                                            </p>
                                                            <p
                                                                v-else-if="detailsTheatreProcedures.length === 0"
                                                                class="text-sm text-muted-foreground"
                                                            >
                                                                No theatre procedures have been linked to this visit yet.
                                                            </p>
                                                            <div
                                                                v-else
                                                                class="max-h-80 divide-y divide-border/50 overflow-y-auto pr-1"
                                                            >
                                                                <div
                                                                    v-for="procedure in detailsTheatreProcedures"
                                                                    :key="`appointment-theatre-procedure-${procedure.id}`"
                                                                    class="py-3 first:pt-0"
                                                                >
                                                                    <div class="flex items-start justify-between gap-3">
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
                                                                        <Badge :variant="theatreProcedureStatusVariant(procedure.status)">
                                                                            {{ formatEnumLabel(procedure.status || 'planned') }}
                                                                        </Badge>
                                                                    </div>
                                                                    <p class="mt-2 text-xs text-muted-foreground">
                                                                        {{ theatreProcedureSummaryText(procedure) }}
                                                                    </p>
                                                                    <p
                                                                        v-if="orderLifecycleLinkageText(procedure, 'procedure booking')"
                                                                        class="mt-1 text-[11px] text-muted-foreground"
                                                                    >
                                                                        {{ orderLifecycleLinkageText(procedure, 'procedure booking') }}
                                                                    </p>
                                                                    <div
                                                                        v-if="canCreateTheatre && detailsAppointment"
                                                                        class="mt-3 flex flex-wrap gap-2"
                                                                    >
                                                                        <Button size="sm" variant="outline" as-child class="h-7 gap-1.5 px-2.5 text-[11px]">
                                                                            <Link
                                                                                :href="relatedCreateWorkflowHref('/theatre-procedures', detailsAppointment, {
                                                                                    reorderOfId: procedure.id,
                                                                                })"
                                                                            >
                                                                                Reorder
                                                                            </Link>
                                                                        </Button>
                                                                        <Button size="sm" variant="outline" as-child class="h-7 gap-1.5 px-2.5 text-[11px]">
                                                                            <Link
                                                                                :href="relatedCreateWorkflowHref('/theatre-procedures', detailsAppointment, {
                                                                                    addOnToOrderId: procedure.id,
                                                                                })"
                                                                            >
                                                                                Add Linked Procedure
                                                                            </Link>
                                                                        </Button>
                                                                        <Button
                                                                            v-if="canApplyTheatreEncounterLifecycleAction(procedure, 'cancel')"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            @click="openEncounterLifecycleDialog('theatre', procedure.id, 'cancel', procedure.statusReason)"
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                        <Button
                                                                            v-if="canApplyTheatreEncounterLifecycleAction(procedure, 'entered_in_error')"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            class="h-7 gap-1.5 px-2.5 text-[11px]"
                                                                            @click="openEncounterLifecycleDialog('theatre', procedure.id, 'entered_in_error')"
                                                                        >
                                                                            Entered in error
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                </Accordion>
                                                <div class="h-4" aria-hidden="true" />
                                                </section>
                                            </div>
                                        </TabsContent>

                                        <TabsContent v-if="canShowReferralTab" value="referrals" class="space-y-8 pb-8">
                                            <header class="flex flex-wrap items-start justify-between gap-4 border-b border-border/50 pb-5">
                                                <div class="min-w-0 space-y-1">
                                                    <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Referrals</p>
                                                    <h3 class="text-base font-semibold text-foreground">Outgoing handoffs</h3>
                                                    <p class="text-sm text-muted-foreground">Each row is one referral. Status and priority are always visible at the top.</p>
                                                </div>
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <Button
                                                        v-if="detailsAppointment && ((preferredReferralNoteTarget && canUseReferralNotePrimaryAction(preferredReferralNoteTarget)) || (!preferredReferralNoteTarget && canCreateMedicalRecords))"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="shrink-0 gap-1.5"
                                                    >
                                                        <Link :href="preferredReferralNoteTarget ? referralNotePrimaryHref(detailsAppointment, preferredReferralNoteTarget) : referralNoteWorkflowHref(detailsAppointment, preferredReferralNoteTarget)">
                                                            <AppIcon name="file-text" class="size-3.5" />
                                                            {{ preferredReferralNoteTarget ? referralNotePrimaryLabel(preferredReferralNoteTarget) : 'Referral note' }}
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        v-if="detailsAppointment && preferredReferralNoteTarget && canReadMedicalRecords && referralNoteRecords(preferredReferralNoteTarget).length > 0"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="shrink-0 gap-1.5"
                                                    >
                                                        <Link :href="referralNoteHistoryHref(detailsAppointment, preferredReferralNoteTarget)">
                                                            <AppIcon name="history" class="size-3.5" />
                                                            Note history
                                                        </Link>
                                                    </Button>
                                                    <Button v-if="canManageReferrals" size="sm" class="shrink-0 gap-1.5" @click="openReferralDialog">
                                                        <AppIcon name="plus" class="size-3.5" />
                                                        New referral
                                                    </Button>
                                                </div>
                                            </header>

                                            <div v-if="detailsReferralsLoading" class="space-y-3">
                                                <Skeleton class="h-24 rounded-lg" />
                                                <Skeleton class="h-24 rounded-lg" />
                                            </div>

                                            <Alert v-else-if="!detailsReferrals.length" variant="default">
                                                <AlertTitle>No referrals</AlertTitle>
                                                <AlertDescription>
                                                    Nothing recorded for this appointment yet. Create one when you need a formal handoff to another team or facility.
                                                </AlertDescription>
                                            </Alert>

                                            <div v-else class="space-y-6">
                                                <section class="space-y-2">
                                                    <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pipeline summary</p>
                                                    <div class="flex flex-wrap gap-x-10 gap-y-3 text-sm">
                                                        <div>
                                                            <p class="text-muted-foreground">Active</p>
                                                            <p class="text-lg font-semibold tabular-nums text-foreground">{{ detailsReferrals.filter((referral) => ['requested', 'accepted', 'in_progress'].includes(referral.status || '')).length }}</p>
                                                        </div>
                                                        <div>
                                                            <p class="text-muted-foreground">Done</p>
                                                            <p class="text-lg font-semibold tabular-nums text-foreground">{{ detailsReferrals.filter((referral) => referral.status === 'completed').length }}</p>
                                                        </div>
                                                        <div>
                                                            <p class="text-muted-foreground">Stopped</p>
                                                            <p class="text-lg font-semibold tabular-nums text-foreground">{{ detailsReferrals.filter((referral) => ['rejected', 'cancelled'].includes(referral.status || '')).length }}</p>
                                                        </div>
                                                    </div>
                                                </section>

                                                <section class="space-y-0 divide-y divide-border/50">
                                                    <p class="pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">All referrals</p>
                                                    <article v-for="referral in detailsReferrals" :key="referral.id" class="py-5 first:pt-4">
                                                        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                            <div class="min-w-0 flex-1 space-y-3">
                                                                <div class="flex flex-wrap items-center gap-2">
                                                                    <span class="font-mono text-sm font-semibold text-foreground">{{ referral.referralNumber || 'Referral' }}</span>
                                                                    <Badge :variant="statusVariant(referral.status)">{{ formatEnumLabel(referral.status || 'requested') }}</Badge>
                                                                    <Badge :variant="referralPriorityVariant(referral.priority)">{{ formatEnumLabel(referral.priority || 'routine') }}</Badge>
                                                                </div>
                                                                <dl class="grid gap-3 text-sm sm:grid-cols-2">
                                                                    <div>
                                                                        <dt class="text-xs font-medium text-muted-foreground">Destination</dt>
                                                                        <dd class="mt-0.5 font-medium text-foreground">{{ referral.targetDepartment || referral.targetFacilityName || 'Pending' }}</dd>
                                                                    </div>
                                                                    <div>
                                                                        <dt class="text-xs font-medium text-muted-foreground">Type</dt>
                                                                        <dd class="mt-0.5 text-foreground">{{ formatEnumLabel(referral.referralType || 'internal') }}</dd>
                                                                    </div>
                                                                    <div>
                                                                        <dt class="text-xs font-medium text-muted-foreground">Requested</dt>
                                                                        <dd class="mt-0.5 text-foreground">{{ formatDateTime(referral.requestedAt || referral.createdAt) }}</dd>
                                                                    </div>
                                                                    <div v-if="referral.completedAt">
                                                                        <dt class="text-xs font-medium text-muted-foreground">Completed</dt>
                                                                        <dd class="mt-0.5 text-foreground">{{ formatDateTime(referral.completedAt) }}</dd>
                                                                    </div>
                                                                </dl>
                                                                <p class="text-sm leading-relaxed text-muted-foreground">{{ referralFocusText(referral) }}</p>
                                                                <div
                                                                    v-if="canReadMedicalRecords || canCreateMedicalRecords"
                                                                    class="rounded-lg border bg-muted/20 p-3"
                                                                >
                                                                    <div class="flex flex-wrap items-center gap-2">
                                                                        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                                            Referral note workflow
                                                                        </p>
                                                                        <Badge
                                                                            v-if="latestReferralNote(referral)"
                                                                            :variant="medicalRecordStatusVariant(latestReferralNote(referral)?.status)"
                                                                        >
                                                                            {{ formatEnumLabel(latestReferralNote(referral)?.status || 'draft') }}
                                                                        </Badge>
                                                                    </div>
                                                                    <p class="mt-2 text-sm text-foreground">
                                                                        {{ referralNoteSummaryText(referral) }}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div v-if="canReadMedicalRecords || canCreateMedicalRecords || canManageReferrals" class="flex flex-shrink-0 flex-wrap gap-2 lg:max-w-[14rem] lg:flex-col">
                                                                <Button
                                                                    v-if="detailsAppointment && canUseReferralNotePrimaryAction(referral)"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    as-child
                                                                    class="gap-1.5"
                                                                >
                                                                    <Link :href="referralNotePrimaryHref(detailsAppointment, referral)">
                                                                        {{ referralNotePrimaryLabel(referral) }}
                                                                    </Link>
                                                                </Button>
                                                                <Button
                                                                    v-if="detailsAppointment && canReadMedicalRecords && referralNoteRecords(referral).length > 0"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    as-child
                                                                    class="gap-1.5"
                                                                >
                                                                    <Link :href="referralNoteHistoryHref(detailsAppointment, referral)">
                                                                        Note history
                                                                    </Link>
                                                                </Button>
                                                                <Button v-if="referral.status === 'requested'" size="sm" class="gap-1.5" @click="openReferralStatusDialog(referral, 'accepted')">Accept</Button>
                                                                <Button v-if="referral.status === 'accepted'" size="sm" class="gap-1.5" @click="openReferralStatusDialog(referral, 'in_progress')">Start handoff</Button>
                                                                <Button v-if="referral.status === 'in_progress'" size="sm" class="gap-1.5" @click="openReferralStatusDialog(referral, 'completed')">Complete</Button>
                                                                <Button v-if="['requested', 'accepted', 'in_progress'].includes(referral.status || '')" size="sm" variant="outline" class="gap-1.5" @click="openReferralStatusDialog(referral, 'cancelled')">Cancel</Button>
                                                                <Button v-if="referral.status === 'requested'" size="sm" variant="outline" class="gap-1.5" @click="openReferralStatusDialog(referral, 'rejected')">Reject</Button>
                                                            </div>
                                                        </div>
                                                    </article>
                                                </section>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="audit" class="space-y-8 pb-10">
                                            <Alert v-if="!canViewAudit" variant="default">
                                                <AlertTitle>Audit access limited</AlertTitle>
                                                <AlertDescription>
                                                    This user can review the appointment but cannot open audit logs.
                                                </AlertDescription>
                                            </Alert>

                                            <div v-else-if="detailsAuditLoading" class="space-y-3">
                                                <Skeleton class="h-20 rounded-lg" />
                                                <Skeleton class="h-20 rounded-lg" />
                                            </div>

                                            <Alert v-else-if="!detailsAuditLogs.length" variant="default">
                                                <AlertTitle>No audit events</AlertTitle>
                                                <AlertDescription>
                                                    No changes have been recorded for this appointment yet.
                                                </AlertDescription>
                                            </Alert>

                                            <div v-else class="space-y-6">
                                                <section
                                                    v-if="detailsAppointment.sourceAdmissionId"
                                                    class="space-y-4 rounded-lg border bg-muted/20 p-4"
                                                >
                                                    <div class="flex flex-wrap items-start justify-between gap-3">
                                                        <div class="space-y-1">
                                                            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Post-discharge handoff</p>
                                                            <p class="text-base font-semibold text-foreground">
                                                                {{
                                                                    detailsSourceAdmissionSummary?.admissionNumber
                                                                        || `Admission ${detailsAppointment.sourceAdmissionId.slice(0, 8)}`
                                                                }}
                                                            </p>
                                                            <p class="text-sm text-muted-foreground">
                                                                {{
                                                                    detailsSourceAdmissionLoading
                                                                        ? 'Loading source discharge context...'
                                                                        : (detailsSourceAdmissionError
                                                                            || 'This appointment stays traceable to the discharged inpatient stay, its destination, and the original follow-up plan.')
                                                                }}
                                                            </p>
                                                        </div>
                                                        <Badge variant="secondary">Discharge follow-up</Badge>
                                                    </div>
                                                    <div class="grid gap-3 md:grid-cols-2">
                                                        <div class="space-y-1">
                                                            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Discharge destination</p>
                                                            <p class="text-sm text-foreground">
                                                                {{ detailsSourceAdmissionSummary?.dischargeDestination || 'Not recorded' }}
                                                            </p>
                                                        </div>
                                                        <div class="space-y-1">
                                                            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Follow-up plan</p>
                                                            <p class="text-sm leading-6 text-foreground">
                                                                {{ detailsSourceAdmissionSummary?.followUpPlan || 'No follow-up plan recorded.' }}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div class="flex flex-wrap gap-2">
                                                        <Button
                                                            v-if="canReadAdmissions"
                                                            size="sm"
                                                            variant="outline"
                                                            as-child
                                                            class="gap-1.5"
                                                        >
                                                            <Link :href="sourceAdmissionWorkflowHref(detailsAppointment.patientId, detailsAppointment.sourceAdmissionId)">
                                                                <AppIcon name="bed-double" class="size-3.5" />
                                                                Open source admission
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            v-if="canReadMedicalRecords"
                                                            size="sm"
                                                            variant="outline"
                                                            as-child
                                                            class="gap-1.5"
                                                        >
                                                            <Link :href="sourceAdmissionMedicalRecordsHref(detailsAppointment.patientId, detailsAppointment.sourceAdmissionId)">
                                                                <AppIcon name="file-text" class="size-3.5" />
                                                                Open source clinical records
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                </section>

                                                <header class="space-y-4 border-b border-border/50 pb-5">
                                                    <div>
                                                        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audit trail</p>
                                                        <p class="mt-1 text-sm text-muted-foreground">Newest events appear first in the list below.</p>
                                                    </div>
                                                    <div class="flex flex-wrap gap-x-10 gap-y-3 text-sm">
                                                        <div>
                                                            <p class="text-muted-foreground">Total</p>
                                                            <p class="text-lg font-semibold tabular-nums text-foreground">{{ detailsAuditLogs.length }}</p>
                                                        </div>
                                                        <div>
                                                            <p class="text-muted-foreground">By users</p>
                                                            <p class="text-lg font-semibold tabular-nums text-foreground">{{ detailsAuditLogs.filter((log) => log.actorId !== null).length }}</p>
                                                        </div>
                                                        <div>
                                                            <p class="text-muted-foreground">System</p>
                                                            <p class="text-lg font-semibold tabular-nums text-foreground">{{ detailsAuditLogs.filter((log) => log.actorId === null).length }}</p>
                                                        </div>
                                                    </div>
                                                </header>

                                                <section class="space-y-0 divide-y divide-border/50">
                                                    <p class="pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event log</p>
                                                    <article v-for="log in detailsAuditLogs" :key="log.id" class="py-4 first:pt-3">
                                                        <div class="flex flex-col gap-3 sm:flex-row sm:gap-6">
                                                            <div class="w-full shrink-0 text-xs text-muted-foreground sm:w-40">
                                                                <p class="font-medium text-foreground">{{ formatDateTime(log.createdAt) }}</p>
                                                            </div>
                                                            <div class="min-w-0 flex-1">
                                                                <p class="text-sm font-semibold text-foreground">{{ formatEnumLabel(log.action || 'updated') }}</p>
                                                                <p class="mt-1 text-xs text-muted-foreground">{{ auditActorLabel(log) }}</p>
                                                            </div>
                                                            <Badge variant="outline" class="h-fit shrink-0 self-start">Event</Badge>
                                                        </div>
                                                    </article>
                                                </section>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                    <SheetFooter v-if="detailsAppointment" class="shrink-0 border-t px-6 py-3 flex flex-row items-center justify-between gap-2">
                        <Button variant="ghost" size="sm" @click="closeDetails">Close</Button>
                        <Button v-if="detailsAppointment.patientId" size="sm" as-child>
                            <Link :href="patientChartHref(detailsAppointment.patientId, { appointmentId: detailsAppointment.id, from: 'appointments' })">
                                Open patient chart
                            </Link>
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Dialog :open="consultationTakeoverDialogOpen" @update:open="(open) => (open ? (consultationTakeoverDialogOpen = true) : closeConsultationTakeoverDialog())">
                <DialogContent variant="action">
                    <DialogHeader>
                        <DialogTitle>Take over active consultation?</DialogTitle>
                        <DialogDescription>
                            This visit is currently owned by
                            <span class="font-medium text-foreground">
                                {{ consultationTakeoverTarget ? consultationOwnerDisplay(consultationTakeoverTarget) : 'another clinician' }}
                            </span>.
                            Confirm takeover and record a short handoff reason.
                        </DialogDescription>
                    </DialogHeader>

                    <div class="space-y-2">
                        <Label for="consultation-takeover-reason">Handoff reason</Label>
                        <Textarea
                            id="consultation-takeover-reason"
                            v-model="consultationTakeoverReason"
                            rows="3"
                            placeholder="Example: Clinician stepped out; I am continuing this encounter for continuity of care."
                        />
                        <p v-if="consultationTakeoverError" class="text-sm text-destructive">
                            {{ consultationTakeoverError }}
                        </p>
                    </div>

                    <DialogFooter class="gap-2 sm:justify-end">
                        <Button variant="outline" :disabled="consultationTakeoverSubmitting" @click="closeConsultationTakeoverDialog">
                            Cancel
                        </Button>
                        <Button :disabled="consultationTakeoverSubmitting" @click="submitConsultationTakeover">
                            {{ consultationTakeoverSubmitting ? 'Taking over...' : 'Confirm takeover' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Sheet :open="triageSheetOpen" @update:open="(open) => (open ? (triageSheetOpen = true) : closeTriageSheet())">
                <SheetContent side="right" variant="form" size="4xl">
                    <div class="flex h-full min-h-0 flex-col">
                        <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                            <SheetTitle>Record nurse triage</SheetTitle>
                            <SheetDescription>
                                Capture vitals and intake notes, then move the patient into the provider queue.
                            </SheetDescription>
                        </SheetHeader>
                        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                            <div class="space-y-4">
                                <div v-if="triageTargetAppointment" class="rounded-lg border px-4 py-3.5">
                                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-sm font-semibold text-foreground">{{ patientDisplayName(triageTargetAppointment.patientId) }}</p>
                                            <p class="text-xs text-muted-foreground">{{ patientMeta(triageTargetAppointment.patientId) }}</p>
                                            <p class="text-xs text-muted-foreground">{{ triageTargetAppointment.appointmentNumber || 'Appointment pending number' }}</p>
                                        </div>
                                        <Badge :variant="statusVariant(triageTargetAppointment.status)">{{ formatEnumLabel(triageTargetAppointment.status || 'waiting_triage') }}</Badge>
                                    </div>
                                    <div class="mt-3 grid gap-3 sm:grid-cols-3">
                                        <div class="rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-muted/30">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current step</p>
                                            <p class="mt-1 text-sm font-medium">{{ appointmentFocusLabel(triageTargetAppointment) }}</p>
                                        </div>
                                        <div class="rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-muted/30">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scheduled</p>
                                            <p class="mt-1 text-sm font-medium">{{ formatDateTime(triageTargetAppointment.scheduledAt) }}</p>
                                        </div>
                                        <div class="rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-muted/30">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</p>
                                            <p class="mt-1 text-sm font-medium">{{ triageTargetAppointment.department || 'Not assigned' }}</p>
                                        </div>
                                    </div>
                                </div>
                                <Alert variant="default">
                                    <AlertTitle>Triage handoff</AlertTitle>
                                    <AlertDescription>
                                        This step should capture a brief vitals summary and any nursing intake note before the visit moves to provider review.
                                    </AlertDescription>
                                </Alert>
                                <div class="grid gap-2">
                                    <Label for="appointment-triage-category">Triage category (MTS)</Label>
                                    <select
                                        id="appointment-triage-category"
                                        v-model="triageForm.triageCategory"
                                        class="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                                    >
                                        <option value="">Not assigned</option>
                                        <option value="P1">P1 — Resuscitation (immediate)</option>
                                        <option value="P2">P2 — Emergent (&le; 10 min)</option>
                                        <option value="P3">P3 — Urgent (&le; 30 min)</option>
                                        <option value="P4">P4 — Semi-urgent (&le; 60 min)</option>
                                        <option value="P5">P5 — Non-urgent (&le; 120 min)</option>
                                    </select>
                                    <p v-if="triageFieldError('triageCategory')" class="text-sm text-destructive">{{ triageFieldError('triageCategory') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="appointment-triage-vitals">Vitals / intake summary</Label>
                                    <Textarea id="appointment-triage-vitals" v-model="triageForm.triageVitalsSummary" rows="4" placeholder="Example: BP 118/74, Pulse 82, Temp 37.1 C, complaint reviewed and stable for provider." />
                                    <p v-if="triageFieldError('triageVitalsSummary')" class="text-sm text-destructive">{{ triageFieldError('triageVitalsSummary') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="appointment-triage-notes">Nursing notes</Label>
                                    <Textarea id="appointment-triage-notes" v-model="triageForm.triageNotes" rows="5" placeholder="Add any triage concerns, prep steps, or instructions for the provider." />
                                    <p v-if="triageFieldError('triageNotes')" class="text-sm text-destructive">{{ triageFieldError('triageNotes') }}</p>
                                </div>
                            </div>
                        </div>
                        <SheetFooter class="shrink-0 gap-2 border-t bg-background px-6 py-4">
                            <Button variant="outline" @click="closeTriageSheet">Close</Button>
                            <Button :disabled="triageSubmitting" @click="submitTriage">
                                {{ triageSubmitting ? 'Saving...' : 'Send to provider queue' }}
                            </Button>
                        </SheetFooter>
                    </div>
                </SheetContent>
            </Sheet>

            <Dialog
                :open="createLeaveConfirmOpen"
                @update:open="(open) => (open ? (createLeaveConfirmOpen = true) : cancelPendingCreateWorkflowLeave())"
            >
                <DialogContent variant="action">
                    <DialogHeader>
                        <DialogTitle>{{ APPOINTMENTS_CREATE_LEAVE_TITLE }}</DialogTitle>
                        <DialogDescription>
                            {{ APPOINTMENTS_CREATE_LEAVE_DESCRIPTION }}
                        </DialogDescription>
                    </DialogHeader>
                    <div class="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                        The current appointment is not scheduled yet. Stay here to keep working, or leave this page and start the scheduling handoff again later.
                    </div>
                    <DialogFooter class="gap-2">
                        <Button variant="outline" @click="cancelPendingCreateWorkflowLeave">
                            Stay on scheduling
                        </Button>
                        <Button class="gap-1.5" @click="confirmPendingCreateWorkflowLeave">
                            <AppIcon name="arrow-right" class="size-3.5" />
                            Leave page
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                :open="detailsLifecycleDialogOpen"
                @update:open="(open) => (open ? (detailsLifecycleDialogOpen = true) : closeEncounterLifecycleDialog())"
            >
                <DialogContent variant="action">
                    <DialogHeader>
                        <DialogTitle>{{ encounterLifecycleActionLabel(detailsLifecycleAction) }}</DialogTitle>
                        <DialogDescription>
                            Apply this lifecycle action to <span class="font-medium text-foreground">{{ encounterLifecycleTargetName() }}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div class="space-y-2">
                        <Label for="appointment-lifecycle-reason">Clinical reason</Label>
                        <Textarea
                            id="appointment-lifecycle-reason"
                            v-model="detailsLifecycleReason"
                            rows="4"
                            placeholder="Document the clinical reason for this lifecycle action."
                        />
                        <p v-if="detailsLifecycleError" class="text-sm text-destructive">
                            {{ detailsLifecycleError }}
                        </p>
                    </div>
                    <DialogFooter class="gap-2">
                        <Button variant="outline" @click="closeEncounterLifecycleDialog">
                            Keep current order
                        </Button>
                        <Button :disabled="detailsLifecycleSubmitting" @click="submitEncounterLifecycleDialog">
                            {{
                                detailsLifecycleSubmitting
                                    ? 'Applying...'
                                    : encounterLifecycleActionLabel(detailsLifecycleAction)
                            }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog :open="statusDialogOpen" @update:open="(open) => (open ? (statusDialogOpen = true) : closeStatusDialog())">
                <DialogContent variant="form" size="2xl">
                    <div class="flex h-full max-h-[90vh] flex-col">
                        <DialogHeader class="sticky top-0 z-10 shrink-0 border-b bg-background px-6 py-4">
                            <DialogTitle>{{ statusDialogTitle }}</DialogTitle>
                            <DialogDescription>{{ statusDialogDescription }}</DialogDescription>
                        </DialogHeader>

                        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                            <div class="space-y-4">
                                <div v-if="statusTargetAppointment" class="rounded-lg border p-4">
                                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-sm font-semibold text-foreground">{{ patientDisplayName(statusTargetAppointment.patientId) }}</p>
                                            <p class="text-xs text-muted-foreground">{{ patientMeta(statusTargetAppointment.patientId) }}</p>
                                            <p class="text-xs text-muted-foreground">{{ statusTargetAppointment.appointmentNumber || 'Appointment pending number' }}</p>
                                        </div>
                                        <Badge :variant="statusVariant(statusTargetAppointment.status)">{{ formatEnumLabel(statusTargetAppointment.status) }}</Badge>
                                    </div>
                                    <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        <div class="rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-muted/30">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current step</p>
                                            <p class="mt-1 text-sm font-medium">{{ appointmentFocusLabel(statusTargetAppointment) }}</p>
                                        </div>
                                        <div class="rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-muted/30">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scheduled</p>
                                            <p class="mt-1 text-sm font-medium">{{ formatDateTime(statusTargetAppointment.scheduledAt) }}</p>
                                        </div>
                                        <div class="rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-muted/30">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</p>
                                            <p class="mt-1 text-sm font-medium">{{ statusTargetAppointment.department || 'Not assigned' }}</p>
                                        </div>
                                        <div class="rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-muted/30">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">This action</p>
                                            <p class="mt-1 text-sm font-medium">{{ statusDialogTitle }}</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="rounded-lg bg-muted/50 px-4 py-3 dark:bg-muted/30">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">After this step</p>
                                    <p class="mt-1 text-sm font-medium">{{ statusDialogAfterStep }}</p>
                                </div>

                                <Alert v-if="statusForm.status === 'waiting_triage'" variant="default">
                                    <AlertTitle>{{ isProviderStatusDialog ? 'Returning to nurse triage' : 'Ready for nurse triage' }}</AlertTitle>
                                    <AlertDescription>
                                        {{ isProviderStatusDialog
                                            ? 'Use this when nursing staff need to repeat vitals, reassess intake, or complete more prep before the provider continues.'
                                            : 'After arrival check-in, this visit moves into nurse triage so vitals and intake notes can be recorded before provider handoff.' }}
                                    </AlertDescription>
                                </Alert>
                                <Alert v-else-if="isProviderStatusDialog && statusForm.status === 'waiting_provider'" variant="default">
                                    <AlertTitle>Returning to provider queue</AlertTitle>
                                    <AlertDescription>
                                        Use this when the clinician session pauses but the patient should stay in the provider-ready flow instead of going back to nursing triage.
                                    </AlertDescription>
                                </Alert>
                                <Alert v-else-if="isProviderStatusDialog && statusForm.status === 'completed'" variant="default">
                                    <AlertTitle>Closing provider visit</AlertTitle>
                                    <AlertDescription>
                                        Complete the visit only after consultation work and the immediate care decision are finished.
                                    </AlertDescription>
                                </Alert>
                                <div v-if="statusDialogNeedsReason" class="grid gap-2">
                                    <Label for="appointment-status-reason">Reason</Label>
                                    <Textarea id="appointment-status-reason" v-model="statusForm.reason" rows="4" :placeholder="statusDialogReasonPlaceholder" />
                                    <p v-if="statusFieldError('reason')" class="text-sm text-destructive">{{ statusFieldError('reason') }}</p>
                                </div>
                            </div>
                        </div>

                        <DialogFooter class="sticky bottom-0 z-10 shrink-0 border-t bg-background px-6 py-4">
                            <Button variant="outline" @click="closeStatusDialog">Close</Button>
                            <Button :disabled="statusSubmitting" @click="submitStatusUpdate">
                                {{ statusSubmitting ? 'Saving...' : statusDialogTitle }}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog :open="rescheduleDialogOpen" @update:open="(open) => (open ? (rescheduleDialogOpen = true) : closeRescheduleDialog())">
                <DialogContent variant="form" size="2xl">
                    <div class="flex h-full max-h-[90vh] flex-col">
                        <DialogHeader class="sticky top-0 z-10 shrink-0 border-b bg-background px-6 py-4">
                            <DialogTitle>Reschedule appointment</DialogTitle>
                            <DialogDescription>
                                Adjust the booked time without losing the existing patient and visit context.
                            </DialogDescription>
                        </DialogHeader>

                        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                            <div class="space-y-4">
                                <div v-if="rescheduleTargetAppointment" class="rounded-lg border p-4">
                                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-sm font-semibold text-foreground">{{ patientDisplayName(rescheduleTargetAppointment.patientId) }}</p>
                                            <p class="text-xs text-muted-foreground">{{ patientMeta(rescheduleTargetAppointment.patientId) }}</p>
                                            <p class="text-xs text-muted-foreground">{{ rescheduleTargetAppointment.appointmentNumber || 'Appointment pending number' }}</p>
                                        </div>
                                        <Badge :variant="statusVariant(rescheduleTargetAppointment.status)">{{ formatEnumLabel(rescheduleTargetAppointment.status) }}</Badge>
                                    </div>
                                    <div class="mt-3 grid gap-3 sm:grid-cols-3">
                                        <div class="rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-muted/30">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current booking</p>
                                            <p class="mt-1 text-sm font-medium">{{ formatDateTime(rescheduleTargetAppointment.scheduledAt) }}</p>
                                        </div>
                                        <div class="rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-muted/30">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Duration</p>
                                            <p class="mt-1 text-sm font-medium">{{ rescheduleTargetAppointment.durationMinutes ? `${rescheduleTargetAppointment.durationMinutes} min` : 'Not set' }}</p>
                                        </div>
                                        <div class="rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-muted/30">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</p>
                                            <p class="mt-1 text-sm font-medium">{{ rescheduleTargetAppointment.department || 'Not assigned' }}</p>
                                        </div>
                                    </div>
                                </div>

                                <div class="grid gap-4 sm:grid-cols-2">
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="appointment-reschedule-scheduled-at">New scheduled date & time</Label>
                                        <Input id="appointment-reschedule-scheduled-at" v-model="rescheduleForm.scheduledAt" type="datetime-local" />
                                        <p v-if="rescheduleFieldError('scheduledAt')" class="text-sm text-destructive">{{ rescheduleFieldError('scheduledAt') }}</p>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="appointment-reschedule-duration">Duration (minutes)</Label>
                                        <Input id="appointment-reschedule-duration" v-model="rescheduleForm.durationMinutes" inputmode="numeric" placeholder="30" />
                                        <p v-if="rescheduleFieldError('durationMinutes')" class="text-sm text-destructive">{{ rescheduleFieldError('durationMinutes') }}</p>
                                    </div>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="appointment-reschedule-notes">Front-desk notes</Label>
                                        <Textarea id="appointment-reschedule-notes" v-model="rescheduleForm.notes" rows="4" placeholder="Add any updated scheduling notes for the team." />
                                        <p v-if="rescheduleFieldError('notes')" class="text-sm text-destructive">{{ rescheduleFieldError('notes') }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter class="sticky bottom-0 z-10 shrink-0 border-t bg-background px-6 py-4">
                            <Button variant="outline" @click="closeRescheduleDialog">Close</Button>
                            <Button :disabled="rescheduleSubmitting" @click="submitRescheduleUpdate">
                                {{ rescheduleSubmitting ? 'Saving...' : 'Save new schedule' }}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog :open="referralDialogOpen" @update:open="(open) => (open ? (referralDialogOpen = true) : closeReferralDialog())">
                <DialogContent variant="form" size="2xl">
                    <div class="flex h-full max-h-[90vh] flex-col">
                        <DialogHeader class="sticky top-0 z-10 shrink-0 border-b bg-background px-6 py-4">
                            <DialogTitle>Request referral</DialogTitle>
                            <DialogDescription>
                                Create the receiving-team handoff directly from this appointment.
                            </DialogDescription>
                        </DialogHeader>

                        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                            <div class="grid gap-4">
                                <div class="grid gap-2">
                                    <Label for="appointment-referral-type">Referral type</Label>
                                    <Select v-model="referralForm.referralType">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="internal">Internal</SelectItem>
                                        <SelectItem value="external">External</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p v-if="referralFieldError('referralType')" class="text-sm text-destructive">{{ referralFieldError('referralType') }}</p>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="appointment-referral-priority">Priority</Label>
                                    <Select v-model="referralForm.priority">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="routine">Routine</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p v-if="referralFieldError('priority')" class="text-sm text-destructive">{{ referralFieldError('priority') }}</p>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="appointment-referral-target-department">Target department</Label>
                                    <Input id="appointment-referral-target-department" v-model="referralForm.targetDepartment" placeholder="Receiving clinic or department" />
                                    <p v-if="referralFieldError('targetDepartment')" class="text-sm text-destructive">{{ referralFieldError('targetDepartment') }}</p>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="appointment-referral-target-facility-code">Target facility code</Label>
                                    <Input id="appointment-referral-target-facility-code" v-model="referralForm.targetFacilityCode" placeholder="Optional facility code" />
                                </div>

                                <div class="grid gap-2">
                                    <Label for="appointment-referral-target-facility-name">Target facility name</Label>
                                    <Input id="appointment-referral-target-facility-name" v-model="referralForm.targetFacilityName" placeholder="Optional receiving facility name" />
                                </div>

                                <div class="grid gap-2">
                                    <Label for="appointment-referral-target-clinician">Target clinician user ID</Label>
                                    <Input id="appointment-referral-target-clinician" v-model="referralForm.targetClinicianUserId" inputmode="numeric" placeholder="Optional clinician user ID" />
                                </div>

                                <div class="grid gap-2">
                                    <Label for="appointment-referral-reason">Referral reason</Label>
                                    <Input id="appointment-referral-reason" v-model="referralForm.referralReason" placeholder="Why the patient is being referred" />
                                    <p v-if="referralFieldError('referralReason')" class="text-sm text-destructive">{{ referralFieldError('referralReason') }}</p>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="appointment-referral-clinical-notes">Clinical handoff notes</Label>
                                    <Textarea id="appointment-referral-clinical-notes" v-model="referralForm.clinicalNotes" rows="5" placeholder="Summarize the clinical context for the receiving team." />
                                </div>

                                <div class="grid gap-2">
                                    <Label for="appointment-referral-handoff-notes">Operational notes</Label>
                                    <Textarea id="appointment-referral-handoff-notes" v-model="referralForm.handoffNotes" rows="4" placeholder="Add transport, communication, or scheduling notes." />
                                </div>
                            </div>
                        </div>

                        <DialogFooter class="sticky bottom-0 z-10 shrink-0 border-t bg-background px-6 py-4">
                            <Button variant="outline" @click="closeReferralDialog">Close</Button>
                            <Button :disabled="referralSubmitting" @click="submitReferral">
                                {{ referralSubmitting ? 'Saving...' : 'Request referral' }}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog :open="referralStatusDialogOpen" @update:open="(open) => (open ? (referralStatusDialogOpen = true) : closeReferralStatusDialog())">
                <DialogContent variant="form" size="2xl">
                    <div class="flex h-full max-h-[90vh] flex-col">
                        <DialogHeader class="sticky top-0 z-10 shrink-0 border-b bg-background px-6 py-4">
                            <DialogTitle>{{ referralStatusDialogTitle }}</DialogTitle>
                            <DialogDescription>{{ referralStatusDialogDescription }}</DialogDescription>
                        </DialogHeader>

                        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                            <div class="space-y-4">
                                <div class="grid gap-3 sm:grid-cols-3">
                                    <div class="rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-muted/30">
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current step</p>
                                        <p class="mt-1 text-sm font-medium">{{ referralStatusTarget ? formatEnumLabel(referralStatusTarget.status || 'requested') : 'Not selected' }}</p>
                                    </div>
                                    <div class="rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-muted/30">
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">This action</p>
                                        <p class="mt-1 text-sm font-medium">{{ referralStatusDialogTitle }}</p>
                                    </div>
                                    <div class="rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-muted/30">
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">After this step</p>
                                        <p class="mt-1 text-sm font-medium">{{ referralStatusAfterStep }}</p>
                                    </div>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="appointment-referral-status-handoff-notes">Handoff notes</Label>
                                    <Textarea id="appointment-referral-status-handoff-notes" v-model="referralStatusForm.handoffNotes" rows="4" placeholder="Add transfer, communication, or receiving-team notes." />
                                    <p v-if="referralStatusFieldError('handoffNotes')" class="text-sm text-destructive">{{ referralStatusFieldError('handoffNotes') }}</p>
                                </div>

                                <div v-if="referralStatusNeedsReason" class="grid gap-2">
                                    <Label for="appointment-referral-status-reason">Reason</Label>
                                    <Textarea id="appointment-referral-status-reason" v-model="referralStatusForm.reason" rows="4" :placeholder="referralStatusForm.status === 'rejected' ? 'Explain why the referral was rejected.' : 'Explain why the referral was cancelled.'" />
                                    <p v-if="referralStatusFieldError('reason')" class="text-sm text-destructive">{{ referralStatusFieldError('reason') }}</p>
                                </div>
                            </div>
                        </div>

                        <DialogFooter class="sticky bottom-0 z-10 shrink-0 border-t bg-background px-6 py-4">
                            <Button variant="outline" @click="closeReferralStatusDialog">Close</Button>
                            <Button :disabled="referralStatusSubmitting" @click="submitReferralStatusUpdate">
                                {{ referralStatusSubmitting ? 'Saving...' : referralStatusActionLabel(referralStatusForm.status) }}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>

<style scoped>
:deep(.appointments-create-sheet .rounded-md),
:deep(.appointments-create-sheet .rounded-lg),
:deep(.appointments-create-sheet .rounded-lg),
:deep(.appointments-create-sheet .rounded-lg),
:deep(.appointments-create-sheet .rounded-lg) {
    border-radius: 0.5rem;
}
</style>
