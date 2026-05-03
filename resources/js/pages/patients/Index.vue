<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    usePlatformAccess,
    type PermissionState,
} from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiPost, isApiClientError } from '@/lib/apiClient';
import { createLocaleTranslator } from '@/lib/locale';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { patientChartHref } from '@/lib/patientChart';
import {
    districtPresetOptionsForRegion,
    freeTextLocationOption,
    mergeSearchableOptions,
    normalizeLocationToken,
    regionPresetOptions,
    type PatientLocationPreset,
    type SearchableSelectOption,
} from '@/lib/patientLocations';
import { type BreadcrumbItem } from '@/types';

type ScopeData = {
    resolvedFrom: string;
    tenant: { code: string; name: string; countryCode?: string | null } | null;
    facility: { code: string; name: string } | null;
    userAccess?: { accessibleFacilityCount?: number };
};

type CountryProfileApiProfile = {
    code?: string | null;
    name?: string | null;
    patientAddressing?: {
        regionLabel?: string | null;
        districtLabel?: string | null;
        regionPlaceholder?: string | null;
        districtPlaceholder?: string | null;
        addressLabel?: string | null;
        addressPlaceholder?: string | null;
    } | null;
    patientLocations?: PatientLocationPreset[] | null;
};

type CountryProfileResponse = {
    data?: {
        activeCode?: string | null;
        requestedCode?: string | null;
        profile?: CountryProfileApiProfile | null;
        availableProfiles?: CountryProfileApiProfile[] | null;
    } | null;
};

type PatientCountryOption = {
    code: string;
    name: string;
    regionLabel: string;
    districtLabel: string;
    regionPlaceholder: string;
    districtPlaceholder: string;
    addressLabel: string;
    addressPlaceholder: string;
};

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
    /** Active direct-service walk-in handoff. */
    routingHandoffSummary?: string | null;
    activeRoutingTickets?: ActiveRoutingTicket[];
};

type ActiveRoutingTicket = {
    id: string;
    requestNumber: string | null;
    serviceType: DirectServiceRequestType | string | null;
    priority: string | null;
    status: string | null;
    requestedAt?: string | null;
    linkedOrderNumber?: string | null;
};

type DirectServiceRequestType = 'laboratory' | 'radiology' | 'pharmacy' | 'theatre_procedure';

type PatientListResponse = {
    data: Patient[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type PatientStatusCounts = {
    active: number;
    inactive: number;
    other: number;
    total: number;
};

type PatientStatusCountsResponse = {
    data: PatientStatusCounts;
};

type PatientWarning = {
    code: string;
    message?: string;
    matches?: Array<{ id: string; patientNumber?: string | null }>;
};

type PatientStoreResponse = {
    data: Patient;
    warnings: PatientWarning[];
};

type PatientTimelineAppointment = {
    id: string;
    appointmentNumber: string | null;
    patientId: string | null;
    department: string | null;
    scheduledAt: string | null;
    reason: string | null;
    status: string | null;
};

type PatientTimelineAdmission = {
    id: string;
    admissionNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    ward: string | null;
    admittedAt: string | null;
    dischargedAt: string | null;
    status: string | null;
};

type PatientTimelineMedicalRecord = {
    id: string;
    recordNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    admissionId: string | null;
    encounterAt: string | null;
    recordType: string | null;
    status: string | null;
};

type PatientTimelineListResponse<T> = {
    data: T[];
};

type PatientTimelineCategory =
    | 'profile'
    | 'appointment'
    | 'admission'
    | 'medicalRecord';

type PatientTimelineEvent = {
    id: string;
    occurredAt: string | null;
    title: string;
    description: string;
    href: string | null;
    badge: string;
    category: PatientTimelineCategory;
};

type PatientWorkflowRecommendation = {
    title: string;
    description: string;
    primaryLabel: string | null;
    primaryHref: string | null;
    primaryIcon: string;
};

type PatientVisitHandoffMode = 'outpatient' | 'emergency' | 'direct-services' | 'billing' | 'chart';

type PatientVisitHandoffSource = 'post-registration' | 'list' | 'details';

type PatientAuditLog = {
    id: string;
    patientId: string | null;
    actorId: number | null;
    actorType?: 'user' | 'system' | string | null;
    actor?: {
        id: number | null;
        name: string | null;
        email: string | null;
        displayName: string;
    } | null;
    action: string | null;
    actionLabel?: string | null;
    changes: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    createdAt: string | null;
};

type PatientAuditLogListResponse = {
    data: PatientAuditLog[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type PatientInsuranceRecord = {
    id: string;
    billingPayerContractId: string | null;
    insuranceType: string | null;
    insuranceProvider: string | null;
    providerCode: string | null;
    planName: string | null;
    policyNumber: string | null;
    memberId: string | null;
    principalMemberName: string | null;
    relationshipToPrincipal: string | null;
    cardNumber: string | null;
    effectiveDate: string | null;
    expiryDate: string | null;
    coverageLevel: string | null;
    copayPercent: string | number | null;
    coverageLimitAmount: string | number | null;
    status: string | null;
    verificationStatus: string | null;
    verificationReference: string | null;
    lastVerifiedAt: string | null;
};

type PatientInsuranceListResponse = {
    data: PatientInsuranceRecord[];
};

type PatientInsuranceOptionResponse = {
    data: {
        providerPresets: Array<{ code: string; name: string; category: string }>;
        payerContracts: Array<{
            id: string;
            contractCode: string | null;
            contractName: string | null;
            payerName: string | null;
            payerPlanName: string | null;
        }>;
    };
};

type PatientInsuranceForm = {
    billingPayerContractId: string;
    insuranceType: string;
    insuranceProvider: string;
    providerCode: string;
    planName: string;
    policyNumber: string;
    memberId: string;
    cardNumber: string;
    effectiveDate: string;
    expiryDate: string;
    coverageLevel: string;
    copayPercent: string;
    verificationStatus: string;
    verificationReference: string;
    notes: string;
};

type ValidationErrorResponse = {
    message?: string;
    errors?: Record<string, string[]>;
    code?: string;
};

type AuthPermissionsResponse = {
    data?: Array<{ name?: string | null }>;
};

type SearchForm = {
    q: string;
    status: string;
    gender: string;
    region: string;
    district: string;
    sortBy: string;
    sortDir: string;
    perPage: number;
    page: number;
};

type PatientRegistrationForm = {
    firstName: string;
    middleName: string;
    lastName: string;
    gender: 'male' | 'female' | 'other' | 'unknown';
    dateOfBirth: string;
    ageYears: string;
    ageMonths: string;
    phone: string;
    email: string;
    nationalId: string;
    countryCode: string;
    region: string;
    district: string;
    addressLine: string;
    nextOfKinName: string;
    nextOfKinPhone: string;
};

type RegistrationBirthInputMode = 'estimated' | 'exact';

type PatientEditForm = {
    firstName: string;
    middleName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    ageYears: string;
    ageMonths: string;
    phone: string;
    email: string;
    nationalId: string;
    countryCode: string;
    region: string;
    district: string;
    addressLine: string;
    nextOfKinName: string;
    nextOfKinPhone: string;
};

type PatientStatusForm = {
    status: string;
    reason: string;
};

const patientW2En = {
    'validation.firstNameRequired': 'First name is required.',
    'validation.lastNameRequired': 'Last name is required.',
    'validation.genderRequired': 'Gender is required.',
    'validation.dateOfBirthRequired': 'Date of birth is required.',
    'validation.dateOfBirthOrAgeRequired': 'Provide exact date of birth or estimated age.',
    'validation.dateOfBirthInvalid': 'Enter a valid date of birth.',
    'validation.dateOfBirthFuture': 'Date of birth cannot be in the future.',
    'validation.ageYearsInvalid': 'Age must be a whole number between 0 and 130.',
    'validation.ageMonthsInvalid': 'Age months must be a whole number between 0 and 11.',
    'validation.phoneRequired': 'Phone is required.',
    'validation.phoneTooShort': 'Phone must be at least 7 characters.',
    'validation.countryCodeRequired': 'Country is required.',
    'validation.countryCodeInvalid': 'Country selection is invalid.',
    'validation.regionRequired': 'Region is required.',
    'validation.districtRequired': 'District is required.',
    'validation.addressLineRequired': 'Address is required.',
    'validation.summaryTitle': 'Check the highlighted fields.',
    'validation.summaryDescription': 'Resolve the following issues before continuing.',
    'duplicate.precheckFailedSubmitStillAllowed':
        'Duplicate pre-check could not be completed. You can still submit.',
    'create.successWithNumber': 'Patient {patientNumber} created successfully.',
    'create.success': 'Patient created successfully.',
    'timeline.profileRegisteredTitle': 'Patient registered',
    'timeline.profileRegisteredDescriptionWithNumber':
        'Patient number {patientNumber} issued.',
    'timeline.profileRegisteredDescriptionDefault': 'Patient profile created.',
    'timeline.demographicsUpdatedTitle': 'Demographics updated',
    'timeline.demographicsUpdatedDescription':
        'Patient identity or contact data was updated.',
    'timeline.statusChangedTitle': 'Status changed to {status}',
    'timeline.statusChangedDescription': 'Status was updated.',
    'timeline.eventTitleAppointmentWithNumber': 'Appointment {appointmentNumber}',
    'timeline.eventTitleAppointment': 'Appointment',
    'timeline.eventTitleAdmissionWithNumber': 'Admission {admissionNumber}',
    'timeline.eventTitleAdmission': 'Admission',
    'timeline.eventTitleRecordWithNumber': 'Record {recordNumber}',
    'timeline.eventTitleMedicalRecord': 'Medical record',
    'timeline.eventDepartmentFallback': 'Department N/A',
    'timeline.eventWardFallback': 'Ward N/A',
    'timeline.eventRecordTypeFallback': 'General note',
    'timeline.eventUnknownStatus': 'unknown',
    'timeline.badgeProfile': 'Profile',
    'timeline.badgeStatus': 'Status',
    'timeline.badgeAppointment': 'Appointment',
    'timeline.badgeAdmission': 'Admission',
    'timeline.badgeMedicalRecord': 'Medical Record',
    'timeline.loadFailureAppointments': 'appointments',
    'timeline.loadFailureAdmissions': 'admissions',
    'timeline.loadFailureMedicalRecords': 'medical records',
    'timeline.loadFailureSummary':
        'Some timeline sections failed to load ({sections}).',
    'dialog.registerNewPatient': 'Register New Patient',
    'dialog.registerDescription':
        'Quick registration captures required details first. Add optional demographics only when needed.',
    'duplicate.title': 'Possible duplicate patient',
    'duplicate.description':
        'A similar active patient record exists. Review before final submit.',
    'duplicate.viewExistingPatient': 'View existing patient',
    'duplicate.reviewForm': 'Review form',
    'duplicate.confirmNewPatient': 'This is a new patient',
    'duplicate.precheckUnavailable': 'Duplicate pre-check unavailable',
    'registration.additionalDetailsOptional': 'Additional details (optional)',
    'common.hide': 'Hide',
    'common.show': 'Show',
    'action.creating': 'Creating...',
    'action.checkingDuplicates': 'Checking duplicates...',
    'action.registerPatient': 'Register Patient',
    'tabs.timeline': 'Timeline',
    'timeline.loadIssue': 'Timeline load issue',
    'timeline.emptyAll': 'No timeline events available for this patient yet.',
    'timeline.sectionProfile': 'Profile milestones',
    'timeline.sectionAppointments': 'Appointments',
    'timeline.sectionAdmissions': 'Admissions',
    'timeline.sectionMedicalRecords': 'Medical records',
    'timeline.emptyProfile': 'No profile events.',
    'timeline.emptyAppointments': 'No appointments found.',
    'timeline.emptyAdmissions': 'No admissions found.',
    'timeline.emptyMedicalRecords': 'No medical records found.',
    'timeline.openAppointments': 'Open in appointments',
    'timeline.openAdmissions': 'Open in admissions',
    'timeline.openMedicalRecords': 'Open in patient chart',
} as const;

type PatientW2Key = keyof typeof patientW2En;

const tW2 = createLocaleTranslator<PatientW2Key>({
    en: patientW2En,
    sw: {
        'validation.firstNameRequired': 'Jina la kwanza linahitajika.',
        'validation.lastNameRequired': 'Jina la mwisho linahitajika.',
        'validation.genderRequired': 'Jinsia inahitajika.',
        'validation.dateOfBirthRequired': 'Tarehe ya kuzaliwa inahitajika.',
        'validation.dateOfBirthOrAgeRequired':
            'Weka tarehe kamili ya kuzaliwa au makadirio ya umri.',
        'validation.dateOfBirthInvalid': 'Weka tarehe sahihi ya kuzaliwa.',
        'validation.dateOfBirthFuture':
            'Tarehe ya kuzaliwa haiwezi kuwa siku zijazo.',
        'validation.ageYearsInvalid':
            'Umri lazima uwe namba kamili kati ya 0 na 130.',
        'validation.ageMonthsInvalid':
            'Miezi ya umri lazima iwe namba kamili kati ya 0 na 11.',
        'validation.phoneRequired': 'Namba ya simu inahitajika.',
        'validation.phoneTooShort':
            'Namba ya simu lazima iwe na angalau herufi 7.',
        'validation.countryCodeRequired': 'Nchi inahitajika.',
        'validation.countryCodeInvalid':
            'Chaguo la nchi si sahihi.',
        'validation.regionRequired': 'Mkoa unahitajika.',
        'validation.districtRequired': 'Wilaya inahitajika.',
        'validation.addressLineRequired': 'Anwani inahitajika.',
        'validation.summaryTitle': 'Kagua sehemu zilizoonyeshwa kosa.',
        'validation.summaryDescription':
            'Tatua matatizo yafuatayo kabla ya kuendelea.',
        'duplicate.precheckFailedSubmitStillAllowed':
            'Ukaguzi wa marudio haujakamilika. Bado unaweza kuwasilisha.',
        'create.successWithNumber':
            'Mgonjwa {patientNumber} amesajiliwa kwa mafanikio.',
        'create.success': 'Mgonjwa amesajiliwa kwa mafanikio.',
        'timeline.profileRegisteredTitle': 'Mgonjwa amesajiliwa',
        'timeline.profileRegisteredDescriptionWithNumber':
            'Namba ya mgonjwa {patientNumber} imetolewa.',
        'timeline.profileRegisteredDescriptionDefault':
            'Wasifu wa mgonjwa umeundwa.',
        'timeline.demographicsUpdatedTitle':
            'Taarifa za utambulisho zimesasishwa',
        'timeline.demographicsUpdatedDescription':
            'Taarifa za utambulisho au mawasiliano zimesasishwa.',
        'timeline.statusChangedTitle': 'Hali imebadilishwa kuwa {status}',
        'timeline.statusChangedDescription': 'Hali imesasishwa.',
        'timeline.eventTitleAppointmentWithNumber':
            'Miadi {appointmentNumber}',
        'timeline.eventTitleAppointment': 'Miadi',
        'timeline.eventTitleAdmissionWithNumber': 'Kulazwa {admissionNumber}',
        'timeline.eventTitleAdmission': 'Kulazwa',
        'timeline.eventTitleRecordWithNumber': 'Rekodi {recordNumber}',
        'timeline.eventTitleMedicalRecord': 'Rekodi ya matibabu',
        'timeline.eventDepartmentFallback': 'Idara haijajazwa',
        'timeline.eventWardFallback': 'Wodi haijajazwa',
        'timeline.eventRecordTypeFallback': 'Dokezo la kawaida',
        'timeline.eventUnknownStatus': 'haijulikani',
        'timeline.badgeProfile': 'Wasifu',
        'timeline.badgeStatus': 'Hali',
        'timeline.badgeAppointment': 'Miadi',
        'timeline.badgeAdmission': 'Kulazwa',
        'timeline.badgeMedicalRecord': 'Rekodi ya Matibabu',
        'timeline.loadFailureAppointments': 'miadi',
        'timeline.loadFailureAdmissions': 'kulazwa',
        'timeline.loadFailureMedicalRecords': 'rekodi za matibabu',
        'timeline.loadFailureSummary':
            'Baadhi ya sehemu za muda hazikupakiwa ({sections}).',
        'dialog.registerNewPatient': 'Sajili Mgonjwa Mpya',
        'dialog.registerDescription':
            'Usajili wa haraka hukusanya taarifa muhimu kwanza. Ongeza taarifa za ziada pale inapohitajika.',
        'duplicate.title': 'Inawezekana ni mgonjwa aliyepo tayari',
        'duplicate.description':
            'Kuna rekodi inayofanana ya mgonjwa hai. Kagua kabla ya kuwasilisha mwisho.',
        'duplicate.viewExistingPatient': 'Tazama mgonjwa aliyepo',
        'duplicate.reviewForm': 'Kagua fomu',
        'duplicate.confirmNewPatient': 'Huyu ni mgonjwa mpya',
        'duplicate.precheckUnavailable': 'Ukaguzi wa marudio haupatikani',
        'registration.additionalDetailsOptional': 'Taarifa za ziada (hiari)',
        'common.hide': 'Ficha',
        'common.show': 'Onyesha',
        'action.creating': 'Inaunda...',
        'action.checkingDuplicates': 'Inakagua marudio...',
        'action.registerPatient': 'Sajili Mgonjwa',
        'tabs.timeline': 'Muda',
        'timeline.loadIssue': 'Hitilafu ya kupakia muda',
        'timeline.emptyAll':
            'Hakuna matukio ya muda yaliyopatikana kwa mgonjwa huyu bado.',
        'timeline.sectionProfile': 'Hatua za wasifu',
        'timeline.sectionAppointments': 'Miadi',
        'timeline.sectionAdmissions': 'Kulazwa',
        'timeline.sectionMedicalRecords': 'Rekodi za matibabu',
        'timeline.emptyProfile': 'Hakuna matukio ya wasifu.',
        'timeline.emptyAppointments': 'Hakuna miadi iliyopatikana.',
        'timeline.emptyAdmissions': 'Hakuna kulazwa kulikopatikana.',
        'timeline.emptyMedicalRecords':
            'Hakuna rekodi za matibabu zilizopatikana.',
        'timeline.openAppointments': 'Fungua kwenye miadi',
        'timeline.openAdmissions': 'Fungua kwenye kulazwa',
        'timeline.openMedicalRecords':
            'Fungua kwenye chati ya mgonjwa',
    },
});

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Patients', href: '/patients' },
];

const fallbackPatientCountryOption: PatientCountryOption = {
    code: 'ZZ',
    name: 'Other Country',
    regionLabel: 'State / Region',
    districtLabel: 'District / City',
    regionPlaceholder: 'State, province, or region',
    districtPlaceholder: 'District, county, or city',
    addressLabel: 'Address',
    addressPlaceholder: 'Street, area, village, or landmark',
};

const loading = ref(true);
const listLoading = ref(false);
const createLoading = ref(false);
const listErrors = ref<string[]>([]);
const createErrors = ref<Record<string, string[]>>({});
const createMessage = ref<string | null>(null);
const createdWarnings = ref<PatientWarning[]>([]);
const {
    permissionState,
    hasPermission,
    hasFacilityEntitlement,
    scope: sharedScope,
    multiTenantIsolationEnabled,
} = usePlatformAccess();
const scope = ref<ScopeData | null>((sharedScope.value as ScopeData | null) ?? null);
const activePlatformCountryCode = ref('TZ');
const countryProfileCatalog = ref<CountryProfileApiProfile[]>([]);
const patients = ref<Patient[]>([]);
const pagination = ref<PatientListResponse['meta'] | null>(null);
const patientStatusCounts = ref<PatientStatusCounts | null>(null);
const patientReadPermissionState = ref<PermissionState>(permissionState('patients.read'));
const canReadPatients = computed(() => patientReadPermissionState.value === 'allowed');
const isPatientReadPermissionResolved = computed(() => patientReadPermissionState.value !== 'unknown');
const canViewPatientAudit = ref(hasPermission('patients.view-audit-logs'));
const canReadAppointments = ref(hasPermission('appointments.read'));
const canCreateAppointments = ref(hasPermission('appointments.create'));
const canUpdateAppointmentsStatus = ref(hasPermission('appointments.update-status'));
const canReadAdmissions = ref(hasPermission('admissions.read'));
const canReadMedicalRecords = ref(hasPermission('medical.records.read'));
/** With permission only, API still requires plan SKU `medical_records.core` via subscription middleware. */
const canFetchMedicalRecordsForTimeline = computed(
    () => canReadMedicalRecords.value && hasFacilityEntitlement('medical_records.core'),
);
const canCreateBillingInvoices = ref(hasPermission('billing.invoices.create'));
const canCreatePatients = ref(hasPermission('patients.create'));
const canUpdatePatients = ref(hasPermission('patients.update'));
const canUpdatePatientStatus = ref(hasPermission('patients.update-status'));
const canReadPatientInsurance = ref(hasPermission('patients.insurance.read'));
const canManagePatientInsurance = ref(hasPermission('patients.insurance.manage'));
const canVerifyPatientInsurance = ref(hasPermission('patients.insurance.verify'));
const canRecordOpdTriage = ref(
    hasPermission('emergency.triage.create') || hasPermission('emergency.triage.update-status'),
);
const canCreateLaboratoryOrders = ref(hasPermission('laboratory.orders.create'));
const canCreatePharmacyOrders = ref(hasPermission('pharmacy.orders.create'));
const canCreateRadiologyOrders = ref(hasPermission('radiology.orders.create'));
const canCreateTheatreProcedures = ref(hasPermission('theatre.procedures.create'));
const canCreateServiceRequests = ref(hasPermission('service.requests.create'));
const canManageProviderSession = computed(() => canReadAppointments.value && canReadMedicalRecords.value);
const tenantIsolationEnabled = ref(multiTenantIsolationEnabled.value);
const SELECT_ALL_VALUE = '__all__';
const SELECT_NONE_VALUE = '__none__';
const patientVisitActiveStatuses = new Set([
    'scheduled',
    'waiting_triage',
    'waiting_provider',
    'in_consultation',
]);
const auditActorTypeOptions = [
    { value: SELECT_ALL_VALUE, label: 'All actors' },
    { value: 'user', label: 'User only' },
    { value: 'system', label: 'System only' },
];
const patientFiltersSheetOpen = ref(false);
const registerDialogOpen = ref(false);
const registerOptionalDetailsOpen = ref(false);
const registrationErrorSummaryRef = ref<HTMLElement | null>(null);
const registrationBirthInputMode = ref<RegistrationBirthInputMode>('estimated');
const preSubmitDuplicateCheckLoading = ref(false);
const preSubmitDuplicateCheckError = ref<string | null>(null);
const preSubmitDuplicateMatches = ref<Patient[]>([]);
const preSubmitDuplicateConfirmed = ref(false);
const postRegistrationDialogOpen = ref(false);
const postRegistrationPatient = ref<Patient | null>(null);
const visitHandoffSheetOpen = ref(false);
const visitHandoffPatient = ref<Patient | null>(null);
const visitHandoffSource = ref<PatientVisitHandoffSource>('list');
const visitHandoffMode = ref<PatientVisitHandoffMode>('outpatient');
const visitHandoffAppointments = ref<PatientTimelineAppointment[]>([]);
const visitHandoffLoading = ref(false);
const visitHandoffSubmitting = ref(false);
const visitHandoffError = ref<string | null>(null);
const visitHandoffActionError = ref<string | null>(null);
let visitHandoffRequestToken = 0;
const directServiceSending = ref<string | null>(null);
const directServiceSentMap = ref<Record<string, { serviceType: DirectServiceRequestType; requestNumber: string }>>({});
const detailsSheetOpen = ref(false);
const detailsSheetPatient = ref<Patient | null>(null);
const detailsSheetTab = ref('overview');
const detailsTimelineLoading = ref(false);
const detailsTimelineError = ref<string | null>(null);
const detailsTimelineProfileEvents = ref<PatientTimelineEvent[]>([]);
const detailsTimelineAppointmentEvents = ref<PatientTimelineEvent[]>([]);
const detailsTimelineAppointments = ref<PatientTimelineAppointment[]>([]);
const detailsTimelineAdmissionEvents = ref<PatientTimelineEvent[]>([]);
const detailsTimelineMedicalRecordEvents = ref<PatientTimelineEvent[]>([]);
let timelineRequestToken = 0;
const detailsAuditLoading = ref(false);
const detailsAuditError = ref<string | null>(null);
const detailsAuditLogs = ref<PatientAuditLog[]>([]);
const detailsAuditMeta = ref<PatientAuditLogListResponse['meta'] | null>(null);
const detailsAuditExporting = ref(false);
const detailsAuditFiltersOpen = ref(false);
const detailsAuditFilters = reactive({
    q: '',
    action: '',
    actorType: '',
    actorId: '',
    from: '',
    to: '',
    page: 1,
    perPage: 20,
});
const detailsInsuranceLoading = ref(false);
const detailsInsuranceSaving = ref(false);
const detailsInsuranceOptionsLoading = ref(false);
const detailsInsuranceError = ref<string | null>(null);
const detailsInsuranceRecords = ref<PatientInsuranceRecord[]>([]);
const patientInsuranceProviderPresets = ref<PatientInsuranceOptionResponse['data']['providerPresets']>([]);
const patientInsurancePayerContracts = ref<PatientInsuranceOptionResponse['data']['payerContracts']>([]);
const insuranceFormOpen = ref(false);
const insuranceForm = reactive<PatientInsuranceForm>({
    billingPayerContractId: '',
    insuranceType: 'insurance',
    insuranceProvider: '',
    providerCode: '',
    planName: '',
    policyNumber: '',
    memberId: '',
    cardNumber: '',
    effectiveDate: '',
    expiryDate: '',
    coverageLevel: '',
    copayPercent: '',
    verificationStatus: 'unverified',
    verificationReference: '',
    notes: '',
});

function normalizeCountryCode(value: string | null | undefined): string {
    return (value ?? '').trim().toUpperCase();
}

function patientCountryOptionFromProfile(
    profile: CountryProfileApiProfile | null | undefined,
): PatientCountryOption | null {
    const code = normalizeCountryCode(profile?.code);
    if (!code) return null;

    return {
        code,
        name: (profile?.name ?? '').trim() || code,
        regionLabel:
            (profile?.patientAddressing?.regionLabel ?? '').trim() ||
            fallbackPatientCountryOption.regionLabel,
        districtLabel:
            (profile?.patientAddressing?.districtLabel ?? '').trim() ||
            fallbackPatientCountryOption.districtLabel,
        regionPlaceholder:
            (profile?.patientAddressing?.regionPlaceholder ?? '').trim() ||
            fallbackPatientCountryOption.regionPlaceholder,
        districtPlaceholder:
            (profile?.patientAddressing?.districtPlaceholder ?? '').trim() ||
            fallbackPatientCountryOption.districtPlaceholder,
        addressLabel:
            (profile?.patientAddressing?.addressLabel ?? '').trim() ||
            fallbackPatientCountryOption.addressLabel,
        addressPlaceholder:
            (profile?.patientAddressing?.addressPlaceholder ?? '').trim() ||
            fallbackPatientCountryOption.addressPlaceholder,
    };
}

const availablePatientCountryOptions = computed(() =>
    countryProfileCatalog.value
        .map((profile) => patientCountryOptionFromProfile(profile))
        .filter((option): option is PatientCountryOption => option !== null),
);

function patientCountryOption(code: string | null | undefined): PatientCountryOption {
    const normalized = normalizeCountryCode(code);
    return (
        availablePatientCountryOptions.value.find((option) => option.code === normalized) ??
        (normalized
            ? {
                  ...fallbackPatientCountryOption,
                  code: normalized,
                  name: normalized,
              }
            : fallbackPatientCountryOption)
    );
}

function countryProfile(code: string | null | undefined): CountryProfileApiProfile | null {
    const normalized = normalizeCountryCode(code);
    if (!normalized) return null;

    return (
        countryProfileCatalog.value.find((profile) => normalizeCountryCode(profile.code) === normalized) ??
        null
    );
}

function patientCountryOptionsForSelect(currentCode: string | null | undefined): PatientCountryOption[] {
    const current = normalizeCountryCode(currentCode);
    const baseOptions = availablePatientCountryOptions.value;

    if (!current || baseOptions.some((option) => option.code === current)) {
        return baseOptions;
    }

    return [
        {
            ...fallbackPatientCountryOption,
            code: current,
            name: current,
        },
        ...baseOptions,
    ];
}

function countryDisplayLabel(code: string | null | undefined): string {
    const normalized = normalizeCountryCode(code);
    if (!normalized) return '';
    return patientCountryOption(normalized).name;
}
const detailsTimelineEvents = computed(() =>
    sortTimelineEvents([
        ...detailsTimelineProfileEvents.value,
        ...detailsTimelineAppointmentEvents.value,
        ...detailsTimelineAdmissionEvents.value,
        ...detailsTimelineMedicalRecordEvents.value,
    ]),
);
const detailsTimelineSummary = computed(() =>
    [
        {
            key: 'profile',
            label: tW2('timeline.sectionProfile'),
            count: detailsTimelineProfileEvents.value.length,
            icon: 'user',
        },
        {
            key: 'appointment',
            label: tW2('timeline.sectionAppointments'),
            count: detailsTimelineAppointmentEvents.value.length,
            icon: 'calendar-clock',
        },
        {
            key: 'admission',
            label: tW2('timeline.sectionAdmissions'),
            count: detailsTimelineAdmissionEvents.value.length,
            icon: 'bed-double',
        },
        {
            key: 'medical-record',
            label: tW2('timeline.sectionMedicalRecords'),
            count: detailsTimelineMedicalRecordEvents.value.length,
            icon: 'stethoscope',
        },
    ].filter((section) => {
        if (section.key === 'appointment') return canReadAppointments.value;
        if (section.key === 'admission') return canReadAdmissions.value;
        if (section.key === 'medical-record') return canFetchMedicalRecordsForTimeline.value;
        return true;
    }),
);
const detailsCurrentAppointment = computed<PatientTimelineAppointment | null>(() => {
    if (detailsTimelineAppointments.value.length === 0) return null;

    return [...detailsTimelineAppointments.value].sort((left, right) => {
        const priorityDifference =
            patientAppointmentWorkflowPriority(right.status)
            - patientAppointmentWorkflowPriority(left.status);

        if (priorityDifference !== 0) {
            return priorityDifference;
        }

        return patientTimelineTimestamp(right.scheduledAt) - patientTimelineTimestamp(left.scheduledAt);
    })[0] ?? null;
});
const detailsWorkflowRecommendation = computed<PatientWorkflowRecommendation | null>(() => {
    const patient = detailsSheetPatient.value;
    if (!patient) return null;

    if (detailsTimelineLoading.value && canReadAppointments.value) {
        return {
            title: 'Loading current visit',
            description:
                'Checking the latest appointment and queue state for this patient before recommending the next workflow step.',
            primaryLabel: null,
            primaryHref: null,
            primaryIcon: 'calendar-clock',
        };
    }

    const appointment = detailsCurrentAppointment.value;
    if (!appointment) {
        if (canCreateAppointments.value) {
            return {
                title: 'Schedule appointment',
                description:
                    'No active appointment is linked to this patient. Start the standard outpatient flow with scheduling first.',
                primaryLabel: 'Schedule appointment',
                primaryHref: patientContextHref('/appointments', patient, { openSchedule: true }),
                primaryIcon: 'calendar-clock',
            };
        }

        if (canReadAppointments.value) {
            return {
                title: 'Open appointments',
                description:
                    'Review this patient in the appointments workspace to confirm whether a visit is pending or a new booking is needed.',
                primaryLabel: 'Open appointments',
                primaryHref: patientContextHref('/appointments', patient),
                primaryIcon: 'calendar-clock',
            };
        }

        return {
            title: 'Open patient chart',
            description:
                'Review the chart history first. Appointment workflow is not directly available from this account.',
            primaryLabel: 'Open patient chart',
            primaryHref: patientChartContextHref(patient, { from: 'patients' }),
            primaryIcon: 'book-open',
        };
    }

    const appointmentHref = canReadAppointments.value
        ? patientAppointmentWorkflowHref(patient, appointment)
        : null;

    switch (appointment.status) {
        case 'scheduled':
            return {
                title: 'Check in patient',
                description:
                    'Appointment already exists. Front desk should complete arrival check-in before triage and consultation.',
                primaryLabel: appointmentHref ? 'Open appointment' : null,
                primaryHref: appointmentHref,
                primaryIcon: 'calendar-clock',
            };
        case 'waiting_triage':
            return {
                title: canRecordOpdTriage.value ? 'Record triage' : 'Patient waiting for triage',
                description: canRecordOpdTriage.value
                    ? 'Arrival is complete. Record vitals and nursing intake, then send the patient to the provider queue.'
                    : 'Arrival is complete and the patient is waiting in the nurse triage queue.',
                primaryLabel: appointmentHref
                    ? (canRecordOpdTriage.value ? 'Open triage workflow' : 'Open appointment')
                    : null,
                primaryHref: appointmentHref,
                primaryIcon: 'activity',
            };
        case 'waiting_provider':
            return {
                title: 'Ready for provider',
                description: canManageProviderSession.value
                    ? 'Triage is complete. Continue this visit from the provider workflow.'
                    : 'Triage is complete and the patient is waiting for provider review.',
                primaryLabel: appointmentHref
                    ? (canManageProviderSession.value ? 'Open provider workflow' : 'Open appointment')
                    : null,
                primaryHref: appointmentHref,
                primaryIcon: 'book-open',
            };
        case 'in_consultation':
            return {
                title: 'Resume consultation',
                description:
                    'Provider review is already active for this visit. Continue from the linked appointment workflow.',
                primaryLabel: appointmentHref ? 'Open consultation' : null,
                primaryHref: appointmentHref,
                primaryIcon: 'book-open',
            };
        case 'completed':
            return {
                title: 'Review completed visit',
                description:
                    'This visit is already closed. Review the completed appointment and linked charting before starting any new downstream work.',
                primaryLabel: appointmentHref ? 'Open completed visit' : null,
                primaryHref: appointmentHref,
                primaryIcon: 'calendar-clock',
            };
        case 'no_show':
            return {
                title: 'Review missed appointment',
                description:
                    'This appointment was marked as no-show. Review follow-up or rescheduling from the appointments workspace.',
                primaryLabel: appointmentHref ? 'Open appointment' : null,
                primaryHref: appointmentHref,
                primaryIcon: 'calendar-clock',
            };
        case 'cancelled':
            return {
                title: 'Review cancelled appointment',
                description:
                    'This appointment was cancelled. Review the cancellation details before creating a replacement visit.',
                primaryLabel: appointmentHref ? 'Open appointment' : null,
                primaryHref: appointmentHref,
                primaryIcon: 'calendar-clock',
            };
        default:
            return {
                title: 'Open appointment',
                description:
                    'Continue from the linked outpatient visit so the next care step stays aligned with the actual queue state.',
                primaryLabel: appointmentHref ? 'Open appointment' : null,
                primaryHref: appointmentHref,
                primaryIcon: 'calendar-clock',
            };
    }
});
const visitHandoffActiveAppointment = computed<PatientTimelineAppointment | null>(() => {
    const patientId = visitHandoffPatient.value?.id ?? null;
    if (!patientId) return null;

    return [...visitHandoffAppointments.value]
        .filter((appointment) =>
            appointment.patientId === patientId &&
            patientVisitActiveStatuses.has(String(appointment.status ?? '').trim()),
        )
        .sort((left, right) => {
            const priorityDifference =
                patientAppointmentWorkflowPriority(right.status)
                - patientAppointmentWorkflowPriority(left.status);

            if (priorityDifference !== 0) {
                return priorityDifference;
            }

            return patientTimelineTimestamp(right.scheduledAt) - patientTimelineTimestamp(left.scheduledAt);
        })[0] ?? null;
});
const visitHandoffExistingVisitHref = computed(() => {
    const patient = visitHandoffPatient.value;
    const appointment = visitHandoffActiveAppointment.value;
    if (!patient || !appointment || !canReadAppointments.value) return null;

    return patientAppointmentWorkflowHref(patient, appointment);
});
const visitHandoffCanCheckIn = computed(() =>
    visitHandoffMode.value === 'outpatient'
    && visitHandoffPatient.value?.status === 'active'
    && visitHandoffActiveAppointment.value?.status === 'scheduled'
    && canUpdateAppointmentsStatus.value,
);
const visitHandoffPrimaryHref = computed(() => {
    const patient = visitHandoffPatient.value;
    if (!patient) return null;

    if (visitHandoffMode.value === 'outpatient') {
        return visitHandoffExistingVisitHref.value
            ?? (canCreateAppointments.value ? patientContextHref('/appointments', patient, { openSchedule: true }) : null);
    }

    if (visitHandoffMode.value === 'emergency') {
        return patientContextHref('/emergency-triage', patient, { includeTabNew: true });
    }

    if (visitHandoffMode.value === 'billing') {
        const appointment = visitHandoffActiveAppointment.value;
        return patientTimelineHref('/billing-invoices', patient.id, {
            appointmentId: appointment?.id ?? null,
        });
    }

    if (visitHandoffMode.value === 'direct-services') {
        return null;
    }

    return patientChartContextHref(patient, {
        appointmentId: visitHandoffActiveAppointment.value?.id ?? null,
        from: 'patients',
    });
});
const visitHandoffPrimaryLabel = computed(() => {
    const appointment = visitHandoffActiveAppointment.value;

    if (visitHandoffMode.value === 'outpatient') {
        if (!appointment) return 'Schedule outpatient visit';
        switch (appointment.status) {
            case 'scheduled':
                return canUpdateAppointmentsStatus.value ? 'Check in patient' : 'Open check-in';
            case 'waiting_triage':
                return canRecordOpdTriage.value ? 'Open triage workflow' : 'Open current visit';
            case 'waiting_provider':
                return canManageProviderSession.value ? 'Open provider workflow' : 'Open current visit';
            case 'in_consultation':
                return 'Open consultation';
            default:
                return 'Open current visit';
        }
    }

    if (visitHandoffMode.value === 'emergency') return 'Start emergency triage';
    if (visitHandoffMode.value === 'billing') return 'Create invoice';
    if (visitHandoffMode.value === 'direct-services') return 'Direct services';
    return 'Open patient chart';
});
const visitHandoffPrimaryIcon = computed(() => {
    if (visitHandoffMode.value === 'emergency') return 'activity';
    if (visitHandoffMode.value === 'billing') return 'receipt';
    if (visitHandoffMode.value === 'direct-services') return 'flask-conical';
    if (visitHandoffMode.value === 'chart') return 'book-open';
    return visitHandoffActiveAppointment.value ? 'calendar-clock' : 'calendar-plus-2';
});
const visitHandoffPrimaryDisabledReason = computed(() => {
    const patient = visitHandoffPatient.value;
    if (!patient) return 'Select a patient first.';

    if (patient.status && patient.status !== 'active') {
        return 'Patient must be active before a new visit handoff can start.';
    }

    if (visitHandoffMode.value === 'outpatient') {
        if (visitHandoffActiveAppointment.value && !canReadAppointments.value) {
            return 'This account cannot open the appointment workspace. Ask scheduling, or use Chart only if you only need to review details.';
        }
        if (!visitHandoffActiveAppointment.value && !canCreateAppointments.value) {
            return 'This account cannot create visits. Ask scheduling to book, or choose another handoff route.';
        }
    }

    if (visitHandoffMode.value === 'emergency' && !canRecordOpdTriage.value) {
        return null;
    }

    if (visitHandoffMode.value === 'billing' && !canCreateBillingInvoices.value) {
        return 'This account cannot create invoices. Ask billing or cashier staff, or choose another route.';
    }

    if (visitHandoffMode.value === 'chart' && !canReadPatients.value) {
        return 'This account cannot open the chart. Ask a clinician or supervisor for access.';
    }

    return null;
});
const visitHandoffHasAnyDirectServiceRight = computed(() =>
    canCreateLaboratoryOrders.value
    || canCreatePharmacyOrders.value
    || canCreateRadiologyOrders.value
    || canCreateTheatreProcedures.value
    || canCreateBillingInvoices.value,
);

/** Walk-in handoff when reception can queue or staff can open order workspaces. */
const visitHandoffCanUseDirectServicesRoute = computed(
    () =>
        canReadPatients.value
        && (
            canCreateServiceRequests.value
            || visitHandoffHasAnyDirectServiceRight.value
        ),
);

const visitHandoffPrimaryDescription = computed(() => {
    const appointment = visitHandoffActiveAppointment.value;

    if (visitHandoffMode.value === 'outpatient') {
        if (!appointment) {
            return 'Create the visit shell first so check-in, triage, consultation, orders, and billing share one encounter context.';
        }

        if (appointment.status === 'scheduled' && canUpdateAppointmentsStatus.value) {
            return 'Record arrival now and move this visit into the nurse triage queue without leaving the patient handoff.';
        }

        return `Use ${appointment.appointmentNumber || 'the existing active visit'} instead of creating another same-day workflow.`;
    }

    if (visitHandoffMode.value === 'emergency') {
        if (!canRecordOpdTriage.value) {
            return 'Use this when the patient should go to emergency or triage. You can register and direct them; triage staff complete urgent intake in the system.';
        }

        return 'Use urgent intake when the patient needs immediate nursing assessment or emergency routing.';
    }

    if (visitHandoffMode.value === 'billing') {
        return 'Use billing-first only for registration fees, deposits, or cashier workflows that happen before clinical care.';
    }

    if (visitHandoffMode.value === 'direct-services') {
        if (!visitHandoffCanUseDirectServicesRoute.value) {
            return 'You need walk-in queue permission (service.requests.create) or departmental order access to use this lane. Choose another route or ask a supervisor.';
        }
        if (visitHandoffHasAnyDirectServiceRight.value) {
            return 'Open the department workspace below; the patient is attached so you can enter the order there.';
        }
        if (canCreateServiceRequests.value) {
            return 'Tap a counter to add one walk-in ticket to that department queue.';
        }
        return 'Choose an action below.';
    }

    return 'Open chart-only when staff need context without starting a new visit.';
});

const visitHandoffDirectServiceSessionTickets = computed(() => {
    const patient = visitHandoffPatient.value;
    if (!patient) return [];
    const defs: ReadonlyArray<{ key: DirectServiceRequestType; label: string }> = [
        { key: 'laboratory', label: 'Lab' },
        { key: 'radiology', label: 'Imaging' },
        { key: 'pharmacy', label: 'Pharmacy' },
        { key: 'theatre_procedure', label: 'Procedure' },
    ];
    const out: Array<{ key: DirectServiceRequestType; label: string; requestNumber: string }> = [];
    for (const row of defs) {
        const rec = directServiceSentMap.value[`${patient.id}:${row.key}`];
        if (rec) {
            out.push({ ...row, requestNumber: rec.requestNumber });
        }
    }
    return out;
});

const visitHandoffEmergencyNeedsTriageStaff = computed(
    () => visitHandoffMode.value === 'emergency'
        && Boolean(visitHandoffPatient.value)
        && visitHandoffPatient.value!.status === 'active'
        && !canRecordOpdTriage.value,
);

const visitHandoffSourceLabel = computed(() => {
    if (visitHandoffSource.value === 'post-registration') return 'Post registration';
    if (visitHandoffSource.value === 'details') return 'Patient details';
    return 'Patient list';
});
const detailsAuditTotalEntries = computed(
    () => detailsAuditMeta.value?.total ?? detailsAuditLogs.value.length,
);
const detailsAuditSummary = computed(() => {
    const total = detailsAuditMeta.value?.total ?? detailsAuditLogs.value.length;
    let changedEntries = 0;
    let userEntries = 0;
    let systemEntries = 0;

    for (const log of detailsAuditLogs.value) {
        if (auditLogChangeKeys(log).length > 0) changedEntries += 1;
        if (auditLogActorTypeLabel(log) === 'System') {
            systemEntries += 1;
        } else {
            userEntries += 1;
        }
    }

    return {
        total,
        changedEntries,
        userEntries,
        systemEntries,
    };
});
const detailsAuditActiveFilters = computed(() => {
    const filters: Array<{ key: string; label: string }> = [];
    const q = detailsAuditFilters.q.trim();
    const action = detailsAuditFilters.action.trim();
    const actorId = detailsAuditFilters.actorId.trim();

    if (q) filters.push({ key: 'q', label: `Search: ${q}` });
    if (action) filters.push({ key: 'action', label: `Exact action: ${action}` });
    if (detailsAuditFilters.actorType) {
        filters.push({
            key: 'actorType',
            label: `Actor type: ${auditFieldLabel(detailsAuditFilters.actorType)}`,
        });
    }
    if (actorId) filters.push({ key: 'actorId', label: `Actor user ID: ${actorId}` });
    if (detailsAuditFilters.from) {
        filters.push({
            key: 'from',
            label: `From: ${formatDateTime(detailsAuditFilters.from)}`,
        });
    }
    if (detailsAuditFilters.to) {
        filters.push({
            key: 'to',
            label: `To: ${formatDateTime(detailsAuditFilters.to)}`,
        });
    }
    if (detailsAuditFilters.perPage !== 20) {
        filters.push({
            key: 'perPage',
            label: `Rows per page: ${detailsAuditFilters.perPage}`,
        });
    }

    return filters;
});

// Edit demographics state
const editSheetOpen = ref(false);
const editTargetPatient = ref<Patient | null>(null);
const editLoading = ref(false);
const editErrors = ref<Record<string, string[]>>({});
const editOptionalDetailsOpen = ref(false);
const editErrorSummaryRef = ref<HTMLElement | null>(null);
const editBirthInputMode = ref<RegistrationBirthInputMode>('exact');
const editForm = reactive<PatientEditForm>({
    firstName: '',
    middleName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    ageYears: '',
    ageMonths: '',
    phone: '',
    email: '',
    nationalId: '',
    countryCode: '',
    region: '',
    district: '',
    addressLine: '',
    nextOfKinName: '',
    nextOfKinPhone: '',
});

// Status change state
const statusDialogOpen = ref(false);
const statusTargetPatient = ref<Patient | null>(null);
const statusLoading = ref(false);
const statusErrors = ref<string[]>([]);
const statusForm = reactive<PatientStatusForm>({
    status: '',
    reason: '',
});

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

function queryNumberParam(
    name: string,
    fallback: number,
    options?: { min?: number; allowed?: number[] },
): number {
    const parsed = Number.parseInt(queryParam(name), 10);
    if (!Number.isFinite(parsed)) return fallback;

    if (options?.allowed && !options.allowed.includes(parsed)) return fallback;
    if (typeof options?.min === 'number' && parsed < options.min) return fallback;

    return parsed;
}

function queryStatusParam(): string {
    if (typeof window === 'undefined') return 'active';
    const params = new URLSearchParams(window.location.search);
    if (!params.has('status')) return 'active';

    const status = (params.get('status') ?? '').trim().toLowerCase();
    if (status === 'active' || status === 'inactive') return status;
    if (status === 'all' || status === '') return '';

    return 'active';
}

function queryAllowedParam(name: string, allowed: string[], fallback = ''): string {
    const value = queryParam(name);
    return allowed.find((option) => option.toLowerCase() === value.toLowerCase()) ?? fallback;
}

const searchForm = reactive<SearchForm>({
    q: queryParam('q'),
    status: queryStatusParam(),
    gender: queryAllowedParam('gender', ['male', 'female', 'other', 'unknown']),
    region: queryParam('region'),
    district: queryParam('district'),
    sortBy: queryAllowedParam(
        'sortBy',
        ['createdAt', 'updatedAt', 'patientNumber', 'firstName', 'lastName'],
        'createdAt',
    ),
    sortDir: queryAllowedParam('sortDir', ['asc', 'desc'], 'desc'),
    perPage: queryNumberParam('perPage', 10, { allowed: [10, 25, 50] }),
    page: queryNumberParam('page', 1, { min: 1 }),
});

const registrationForm = reactive<PatientRegistrationForm>({
    firstName: '',
    middleName: '',
    lastName: '',
    gender: 'female',
    dateOfBirth: '',
    ageYears: '',
    ageMonths: '',
    phone: '',
    email: '',
    nationalId: '',
    countryCode: '',
    region: '',
    district: '',
    addressLine: '',
    nextOfKinName: '',
    nextOfKinPhone: '',
});

const defaultPatientCountryCode = computed(
    () =>
        normalizeCountryCode(scope.value?.tenant?.countryCode) ||
        normalizeCountryCode(activePlatformCountryCode.value) ||
        'TZ',
);
const registrationCountryUi = computed(() =>
    patientCountryOption(registrationForm.countryCode || defaultPatientCountryCode.value),
);
const registrationCountryOptions = computed(() =>
    patientCountryOptionsForSelect(
        registrationForm.countryCode || defaultPatientCountryCode.value,
    ),
);
const editCountryUi = computed(() =>
    patientCountryOption(editForm.countryCode || defaultPatientCountryCode.value),
);
const editCountryOptions = computed(() =>
    patientCountryOptionsForSelect(editForm.countryCode || defaultPatientCountryCode.value),
);
const registrationCountryCode = computed(
    () => registrationForm.countryCode || defaultPatientCountryCode.value,
);
const editCountryCode = computed(
    () => editForm.countryCode || defaultPatientCountryCode.value,
);
const patientFilterCountryCode = computed(() => defaultPatientCountryCode.value);
const patientFilterCountryUi = computed(() =>
    patientCountryOption(patientFilterCountryCode.value),
);

function patientLocationValueOption(
    value: string | null | undefined,
): SearchableSelectOption | null {
    return freeTextLocationOption(value);
}

function patientLocationPresetsForCountry(
    countryCode: string | null | undefined,
): PatientLocationPreset[] {
    const presets = countryProfile(countryCode)?.patientLocations;

    return Array.isArray(presets) ? presets : [];
}

function historicalRegionOptionsForCountry(countryCode: string): SearchableSelectOption[] {
    const normalizedCountry = normalizeCountryCode(countryCode);
    if (!normalizedCountry) return [];

    return mergeSearchableOptions(
        patients.value
            .filter(
                (patient) =>
                    normalizeCountryCode(patient.countryCode) === normalizedCountry,
            )
            .map((patient) => patientLocationValueOption(patient.region))
            .filter(
                (option): option is SearchableSelectOption => option !== null,
            ),
    );
}

function historicalDistrictOptionsForCountryAndRegion(
    countryCode: string,
    region: string,
): SearchableSelectOption[] {
    const normalizedCountry = normalizeCountryCode(countryCode);
    const normalizedRegion = normalizeLocationToken(region);
    if (!normalizedCountry || !normalizedRegion) return [];

    return mergeSearchableOptions(
        patients.value
            .filter(
                (patient) =>
                    normalizeCountryCode(patient.countryCode) === normalizedCountry &&
                    normalizeLocationToken(patient.region) === normalizedRegion,
            )
            .map((patient) => patientLocationValueOption(patient.district))
            .filter(
                (option): option is SearchableSelectOption => option !== null,
            ),
    );
}

const registrationRegionOptions = computed(() =>
    mergeSearchableOptions(
        regionPresetOptions(patientLocationPresetsForCountry(registrationCountryCode.value)),
        historicalRegionOptionsForCountry(registrationCountryCode.value),
    ),
);
const registrationDistrictOptions = computed(() =>
    mergeSearchableOptions(
        districtPresetOptionsForRegion(
            patientLocationPresetsForCountry(registrationCountryCode.value),
            registrationForm.region,
        ),
        historicalDistrictOptionsForCountryAndRegion(
            registrationCountryCode.value,
            registrationForm.region,
        ),
    ),
);
const registrationDistrictPlaceholder = computed(() =>
    registrationForm.region.trim()
        ? registrationCountryUi.value.districtPlaceholder
        : `Select ${registrationCountryUi.value.regionLabel.toLowerCase()} first`,
);
const registrationDistrictHelperText = computed(() =>
    registrationForm.region.trim()
        ? ''
        : `Choose ${registrationCountryUi.value.regionLabel.toLowerCase()} before ${registrationCountryUi.value.districtLabel.toLowerCase()}.`,
);
const editRegionOptions = computed(() =>
    mergeSearchableOptions(
        regionPresetOptions(patientLocationPresetsForCountry(editCountryCode.value)),
        historicalRegionOptionsForCountry(editCountryCode.value),
    ),
);
const editDistrictOptions = computed(() =>
    mergeSearchableOptions(
        districtPresetOptionsForRegion(
            patientLocationPresetsForCountry(editCountryCode.value),
            editForm.region,
        ),
        historicalDistrictOptionsForCountryAndRegion(
            editCountryCode.value,
            editForm.region,
        ),
    ),
);
const editDistrictPlaceholder = computed(() =>
    editForm.region.trim()
        ? editCountryUi.value.districtPlaceholder
        : `Select ${editCountryUi.value.regionLabel.toLowerCase()} first`,
);
const editDistrictHelperText = computed(() =>
    editForm.region.trim()
        ? ''
        : `Choose ${editCountryUi.value.regionLabel.toLowerCase()} before ${editCountryUi.value.districtLabel.toLowerCase()}.`,
);
const patientFilterRegionOptions = computed(() =>
    mergeSearchableOptions(
        regionPresetOptions(patientLocationPresetsForCountry(patientFilterCountryCode.value)),
        historicalRegionOptionsForCountry(patientFilterCountryCode.value),
    ),
);
const patientFilterDistrictOptions = computed(() =>
    mergeSearchableOptions(
        districtPresetOptionsForRegion(
            patientLocationPresetsForCountry(patientFilterCountryCode.value),
            searchForm.region,
        ),
        historicalDistrictOptionsForCountryAndRegion(
            patientFilterCountryCode.value,
            searchForm.region,
        ),
    ),
);
const patientFilterDistrictPlaceholder = computed(() =>
    searchForm.region.trim()
        ? patientFilterCountryUi.value.districtPlaceholder
        : `Select ${patientFilterCountryUi.value.regionLabel.toLowerCase()} first`,
);
const patientFilterDistrictHelperText = computed(() =>
    searchForm.region.trim()
        ? ''
        : `Choose ${patientFilterCountryUi.value.regionLabel.toLowerCase()} before ${patientFilterCountryUi.value.districtLabel.toLowerCase()}.`,
);
const registrationErrorSummary = computed(() => {
    const seen = new Set<string>();

    return Object.values(createErrors.value)
        .flatMap((messages) => messages ?? [])
        .map((message) => message.trim())
        .filter((message) => {
            if (!message || seen.has(message)) return false;
            seen.add(message);
            return true;
        });
});

const editErrorSummary = computed(() => {
    const seen = new Set<string>();

    return Object.values(editErrors.value)
        .flatMap((messages) => messages ?? [])
        .map((message) => message.trim())
        .filter((message) => {
            if (!message || seen.has(message)) return false;
            seen.add(message);
            return true;
        });
});

const registrationDerivedDateOfBirth = computed(() =>
    deriveDateOfBirthFromAgeParts(
        asTrimmedString(registrationForm.ageYears),
        asTrimmedString(registrationForm.ageMonths),
    ),
);

const registrationPatientNamePreview = computed(() => {
    const name = [
        registrationForm.firstName,
        registrationForm.middleName,
        registrationForm.lastName,
    ]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(' ');

    return name || 'New patient';
});

const registrationAgeSummary = computed(() => {
    if (registrationBirthInputMode.value === 'estimated') {
        if (registrationDerivedDateOfBirth.value) {
            return `Estimated DOB ${formatDate(registrationDerivedDateOfBirth.value)}`;
        }

        return 'Age pending';
    }

    if (registrationForm.dateOfBirth) {
        return `${formatDate(registrationForm.dateOfBirth)} | ${formatAge(registrationForm.dateOfBirth) || 'Age pending'}`;
    }

    return 'DOB pending';
});

const registrationDuplicateDateOfBirth = computed(() =>
    asTrimmedString(registrationForm.dateOfBirth) ||
    registrationDerivedDateOfBirth.value ||
    '',
);

const registrationDuplicateLocation = computed(() =>
    [
        registrationForm.district,
        registrationForm.region,
        countryDisplayLabel(registrationForm.countryCode) ||
            registrationForm.countryCode,
    ]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(', '),
);

const registrationRequiredReadiness = computed(() => {
    const hasAgeOrDob = Boolean(
        registrationForm.dateOfBirth.trim() ||
            registrationForm.ageYears.trim() ||
            registrationForm.ageMonths.trim(),
    );

    const items = [
        { key: 'name', complete: Boolean(registrationForm.firstName.trim() && registrationForm.lastName.trim()) },
        { key: 'gender', complete: Boolean(registrationForm.gender) },
        { key: 'birth', complete: hasAgeOrDob },
        { key: 'phone', complete: Boolean(registrationForm.phone.trim()) },
        { key: 'location', complete: Boolean(registrationForm.region.trim() && registrationForm.district.trim()) },
        { key: 'address', complete: Boolean(registrationForm.addressLine.trim()) },
    ];

    return {
        complete: items.filter((item) => item.complete).length,
        total: items.length,
    };
});

const editDerivedDateOfBirth = computed(() =>
    deriveDateOfBirthFromAgeParts(
        asTrimmedString(editForm.ageYears),
        asTrimmedString(editForm.ageMonths),
    ),
);

let searchDebounceTimer: number | null = null;

function xsrfCookieToken(): string | null {
    const cookieValue = document.cookie
        .split(';')
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);

    if (cookieValue) {
        return decodeURIComponent(cookieValue);
    }

    return null;
}

function csrfMetaToken(): string | null {
    const element = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    return element?.content ?? null;
}

function csrfRequestHeaders(): Record<string, string> {
    const cookieToken = xsrfCookieToken();
    if (cookieToken) {
        return { 'X-XSRF-TOKEN': cookieToken };
    }

    const metaToken = csrfMetaToken();
    if (metaToken) {
        return { 'X-CSRF-TOKEN': metaToken };
    }

    return {};
}

function setCsrfToken(token: string | null | undefined): void {
    const normalized = token?.trim() ?? '';
    if (!normalized) return;

    const element = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    if (element) {
        element.content = normalized;
    }
}

async function refreshCsrfToken(): Promise<void> {
    const response = await fetch('/api/v1/auth/csrf-token', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Cache-Control': 'no-cache',
        },
    });

    const payload = (await response.json().catch(() => ({}))) as {
        token?: string | null;
    };

    if (!response.ok) {
        throw new Error(
            typeof payload.token === 'string' && payload.token.trim() !== ''
                ? payload.token
                : `Unable to refresh CSRF token (${response.status}).`,
        );
    }

    setCsrfToken(payload.token);
}

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: {
        query?: Record<string, string | number | null | undefined>;
        body?: Record<string, unknown>;
    },
    retryOnCsrfMismatch = true,
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
        Object.assign(headers, csrfRequestHeaders());

        body = JSON.stringify(options?.body ?? {});
    }

    const response = await fetch(url.toString(), {
        method,
        credentials: 'same-origin',
        headers,
        body,
    });

    if (response.status === 419 && method !== 'GET' && retryOnCsrfMismatch) {
        await refreshCsrfToken();
        return apiRequest<T>(method, path, options, false);
    }

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

function patientName(patient: Patient): string {
    return [patient.firstName, patient.middleName, patient.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || patient.patientNumber || 'Unnamed patient';
}

function patientInitials(patient: Patient): string {
    const first = (patient.firstName ?? '').charAt(0).toUpperCase();
    const last = (patient.lastName ?? '').charAt(0).toUpperCase();
    return (first + last) || '?';
}

function patientStatusActionLabel(patient: Patient): string {
    return patient.status === 'active' ? 'Mark Inactive' : 'Mark Active';
}

function patientStatusActionIcon(patient: Patient): string {
    return patient.status === 'active' ? 'user-x' : 'user-check';
}

function patientContextHref(
    path: string,
    patient: Patient,
    options?: { includeTabNew?: boolean; openSchedule?: boolean },
) {
    const params = new URLSearchParams();
    if (options?.includeTabNew) params.set('tab', 'new');
    if (options?.openSchedule) params.set('open', 'schedule');
    params.set('patientId', patient.id);
    if (options?.openSchedule) {
        params.set('patientName', patientName(patient));
        if (patient.patientNumber) params.set('patientNumber', patient.patientNumber);
    }
    const query = params.toString();
    return query ? `${path}?${query}` : path;
}

function patientChartContextHref(
    patient: Patient,
    options?: {
        tab?: string | null;
        recordId?: string | null;
        appointmentId?: string | null;
        admissionId?: string | null;
        from?: string | null;
    },
) {
    return patientChartHref(patient.id, options);
}

function patientTimelineHref(
    path: string,
    patientId: string,
    extra?: Record<string, string | null | undefined>,
    options?: { includePatientId?: boolean },
): string {
    const params = new URLSearchParams();
    if (options?.includePatientId !== false) {
        params.set('patientId', patientId);
    }
    params.set('from', 'patients');
    Object.entries(extra ?? {}).forEach(([key, value]) => {
        if (!value) return;
        params.set(key, value);
    });
    return `${path}?${params.toString()}`;
}

function patientAppointmentWorkflowHref(
    patient: Patient,
    appointment: PatientTimelineAppointment,
): string {
    const extra: Record<string, string | null | undefined> = {
        focusAppointmentId: appointment.id,
        status: appointment.status,
    };

    if (appointment.status === 'waiting_triage' && canRecordOpdTriage.value) {
        extra.view = 'triage';
    } else if (
        (appointment.status === 'waiting_provider' || appointment.status === 'in_consultation')
        && canManageProviderSession.value
    ) {
        extra.view = 'clinical';
    }

    return patientTimelineHref('/appointments', patient.id, extra, { includePatientId: false });
}

function visitHandoffDefaultMode(): PatientVisitHandoffMode {
    if (
        (visitHandoffActiveAppointment.value && canReadAppointments.value)
        || canCreateAppointments.value
    ) {
        return 'outpatient';
    }

    if (canRecordOpdTriage.value) {
        return 'emergency';
    }

    if (
        canCreateLaboratoryOrders.value
        || canCreatePharmacyOrders.value
        || canCreateRadiologyOrders.value
        || canCreateTheatreProcedures.value
    ) {
        return 'direct-services';
    }

    if (canCreateBillingInvoices.value) {
        return 'billing';
    }

    return 'chart';
}

function isFacilityPlan403Error(error: unknown): boolean {
    if (!isApiClientError(error) || error.status !== 403) {
        return false;
    }
    const payload = error.payload;
    if (!payload || typeof payload !== 'object') {
        return false;
    }
    const code = (payload as { code?: string }).code;
    return (
        code === 'FACILITY_ENTITLEMENT_REQUIRED'
        || code === 'FACILITY_SUBSCRIPTION_REQUIRED'
        || code === 'FACILITY_SUBSCRIPTION_EXPIRED'
        || code === 'FACILITY_SUBSCRIPTION_RESTRICTED'
    );
}

async function createDirectServiceRequest(serviceType: DirectServiceRequestType): Promise<void> {
    const patient = visitHandoffPatient.value;
    if (!patient || directServiceSending.value !== null) return;

    const ticketKey = `${patient.id}:${serviceType}`;
    if (directServiceSentMap.value[ticketKey]) return;

    directServiceSending.value = serviceType;
    const labelMap = { laboratory: 'Lab', pharmacy: 'Pharmacy', radiology: 'Imaging', theatre_procedure: 'Procedure' } as const;

    const appointment = visitHandoffActiveAppointment.value;

    type ServiceRequestResponse = { data: { requestNumber: string; serviceType: string } };

    try {
        let response: ServiceRequestResponse;
        try {
            response = await apiPost<ServiceRequestResponse>('/service-requests', {
                body: {
                    patientId: patient.id,
                    serviceType,
                    priority: 'routine',
                    ...(appointment ? { appointmentId: appointment.id } : {}),
                },
                entitlementContext: 'Walk-in service request',
            });
        } catch (firstError: unknown) {
            if (isApiClientError(firstError) && firstError.status === 419) {
                await refreshCsrfToken();
                response = await apiPost<ServiceRequestResponse>('/service-requests', {
                    body: {
                        patientId: patient.id,
                        serviceType,
                        priority: 'routine',
                        ...(appointment ? { appointmentId: appointment.id } : {}),
                    },
                    entitlementContext: 'Walk-in service request',
                });
            } else {
                throw firstError;
            }
        }

        const requestNumber = response.data?.requestNumber;
        if (!requestNumber) {
            notifyError('Walk-in ticket was created but the response did not include a ticket number. Refresh and check the department queue.');
            return;
        }

        directServiceSentMap.value = {
            ...directServiceSentMap.value,
            [`${patient.id}:${serviceType}`]: {
                serviceType,
                requestNumber,
            },
        };
        notifySuccess(
            `Done — ${labelMap[serviceType]} walk-in ticket ${requestNumber} created for ${patient.firstName} ${patient.lastName}. This patient is listed on that department's queue.`,
        );
    } catch (error: unknown) {
        if (isFacilityPlan403Error(error)) {
            return;
        }

        const fallback = `Could not send patient to ${labelMap[serviceType].toLowerCase()} queue. Try again or notify the department directly.`;

        if (isApiClientError(error)) {
            const payload = error.payload;
            if (payload && typeof payload === 'object') {
                const msg = (payload as { message?: string }).message;
                if (typeof msg === 'string' && msg.trim() !== '') {
                    notifyError(msg);
                    return;
                }
            }
            if (error.message.trim() !== '') {
                notifyError(error.message);
                return;
            }
        }

        notifyError(messageFromUnknown(error, fallback));
    } finally {
        directServiceSending.value = null;
    }
}

async function copyVisitHandoffEmergencyTriageLink(): Promise<void> {
    const patient = visitHandoffPatient.value;
    if (!patient) return;
    const path = patientContextHref('/emergency-triage', patient, { includeTabNew: true });
    const absolute = typeof window !== 'undefined' ? new URL(path, window.location.origin).href : path;
    try {
        await navigator.clipboard.writeText(absolute);
        notifySuccess('Link copied. Share it with triage or emergency staff so they can start intake.');
    } catch {
        notifyError('Could not copy automatically. Open Emergency Triage from the sidebar and search for this patient.');
    }
}

function directServiceQueueHref(serviceType: DirectServiceRequestType): string {
    const params = new URLSearchParams({ serviceType, status: 'pending' });
    return `/walk-in-service-requests?${params.toString()}`;
}

async function copyDirectServiceTicket(ticket: { label: string; requestNumber: string }): Promise<void> {
    try {
        await navigator.clipboard.writeText(`${ticket.label} walk-in ticket ${ticket.requestNumber}`);
        notifySuccess('Ticket number copied.');
    } catch {
        notifyError('Could not copy the ticket number automatically.');
    }
}

function closePatientVisitHandoff() {
    visitHandoffRequestToken += 1;
    visitHandoffSheetOpen.value = false;
    visitHandoffLoading.value = false;
    visitHandoffSubmitting.value = false;
    visitHandoffError.value = null;
    visitHandoffActionError.value = null;
    visitHandoffAppointments.value = [];
    visitHandoffPatient.value = null;
    visitHandoffMode.value = 'outpatient';
}

async function loadVisitHandoffContext(patient: Patient) {
    const requestToken = ++visitHandoffRequestToken;
    visitHandoffLoading.value = canReadAppointments.value;
    visitHandoffError.value = null;
    visitHandoffActionError.value = null;
    visitHandoffAppointments.value = [];

    if (!canReadAppointments.value) {
        visitHandoffMode.value = visitHandoffDefaultMode();
        visitHandoffLoading.value = false;
        return;
    }

    try {
        const response = await apiRequest<PatientTimelineListResponse<PatientTimelineAppointment>>('GET', '/appointments', {
            query: {
                patientId: patient.id,
                page: 1,
                perPage: 8,
                sortBy: 'scheduledAt',
                sortDir: 'desc',
            },
        });

        if (requestToken !== visitHandoffRequestToken) return;
        visitHandoffAppointments.value = response.data ?? [];
        visitHandoffMode.value = visitHandoffDefaultMode();
    } catch (error) {
        if (requestToken !== visitHandoffRequestToken) return;
        visitHandoffError.value = messageFromUnknown(error, 'Unable to check current visit context.');
        visitHandoffMode.value = visitHandoffDefaultMode();
    } finally {
        if (requestToken === visitHandoffRequestToken) {
            visitHandoffLoading.value = false;
        }
    }
}

function openPatientVisitHandoff(
    patient: Patient,
    source: PatientVisitHandoffSource = 'list',
) {
    visitHandoffPatient.value = patient;
    visitHandoffSource.value = source;
    visitHandoffMode.value = 'outpatient';
    visitHandoffAppointments.value = [];
    visitHandoffError.value = null;
    visitHandoffSheetOpen.value = true;
    if (source === 'post-registration') {
        postRegistrationDialogOpen.value = false;
    }
    if (source === 'details') {
        closePatientDetailsSheet();
    }
    void loadVisitHandoffContext(patient);
}

function replaceVisitHandoffAppointment(updated: PatientTimelineAppointment) {
    const existingIndex = visitHandoffAppointments.value.findIndex((appointment) => appointment.id === updated.id);

    if (existingIndex === -1) {
        visitHandoffAppointments.value = [updated, ...visitHandoffAppointments.value];
    } else {
        visitHandoffAppointments.value = visitHandoffAppointments.value.map((appointment, index) =>
            index === existingIndex ? { ...appointment, ...updated } : appointment,
        );
    }

    detailsTimelineAppointments.value = detailsTimelineAppointments.value.map((appointment) =>
        appointment.id === updated.id ? { ...appointment, ...updated } : appointment,
    );
}

async function checkInVisitFromHandoff() {
    const appointment = visitHandoffActiveAppointment.value;
    if (!appointment || appointment.status !== 'scheduled' || !canUpdateAppointmentsStatus.value) {
        return;
    }

    visitHandoffSubmitting.value = true;
    visitHandoffActionError.value = null;

    try {
        const response = await apiRequest<{ data: PatientTimelineAppointment }>('PATCH', `/appointments/${appointment.id}/status`, {
            body: {
                status: 'waiting_triage',
                reason: null,
            },
        });

        replaceVisitHandoffAppointment(response.data);
        visitHandoffMode.value = 'outpatient';
        notifySuccess('Patient checked in. Visit is now waiting for nurse triage.');
    } catch (error) {
        const apiError = error as Error & { payload?: ValidationErrorResponse };
        visitHandoffActionError.value =
            apiError.payload?.message ?? messageFromUnknown(error, 'Unable to check in patient.');
        notifyError(visitHandoffActionError.value);
    } finally {
        visitHandoffSubmitting.value = false;
    }
}

function visitHandoffModeAvailable(mode: PatientVisitHandoffMode): boolean {
    if (mode === 'outpatient') {
        return canCreateAppointments.value || canReadAppointments.value;
    }

    if (mode === 'emergency') {
        return true;
    }

    if (mode === 'direct-services') {
        return canReadPatients.value;
    }

    if (mode === 'billing') {
        return canCreateBillingInvoices.value;
    }

    return canReadPatients.value;
}

function visitHandoffModeButtonClass(mode: PatientVisitHandoffMode): string {
    return [
        'flex min-h-[92px] min-w-0 max-w-full flex-[1_1_15rem] items-start gap-3 rounded-lg border p-3 text-left transition-colors',
        'min-w-[min(100%,15rem)]',
        visitHandoffMode.value === mode
            ? 'border-primary/50 bg-primary/5'
            : 'bg-background hover:border-primary/30 hover:bg-muted/20',
        visitHandoffModeAvailable(mode) ? '' : 'pointer-events-none cursor-not-allowed opacity-55',
    ].filter(Boolean).join(' ');
}

function visitHandoffModeBadge(mode: PatientVisitHandoffMode): string {
    if (mode === 'outpatient' && visitHandoffActiveAppointment.value) {
        return 'Use existing';
    }

    if (mode === 'outpatient') return 'Standard';
    if (mode === 'emergency') return 'Urgent';
    if (mode === 'direct-services') return 'Walk-in';
    if (mode === 'billing') return 'Cashier';
    return 'Chart';
}

function clearTimelineState() {
    detailsTimelineError.value = null;
    detailsTimelineProfileEvents.value = [];
    detailsTimelineAppointmentEvents.value = [];
    detailsTimelineAppointments.value = [];
    detailsTimelineAdmissionEvents.value = [];
    detailsTimelineMedicalRecordEvents.value = [];
}

function emptyTimelineListResponse<T>(): PatientTimelineListResponse<T> {
    return { data: [] };
}

function sortTimelineEvents(events: PatientTimelineEvent[]): PatientTimelineEvent[] {
    return [...events].sort((a, b) => {
        const left = a.occurredAt ? new Date(a.occurredAt).getTime() : Number.NEGATIVE_INFINITY;
        const right = b.occurredAt ? new Date(b.occurredAt).getTime() : Number.NEGATIVE_INFINITY;
        return right - left;
    });
}

function patientAppointmentWorkflowPriority(status: string | null | undefined): number {
    switch (status) {
        case 'in_consultation':
            return 60;
        case 'waiting_provider':
            return 50;
        case 'waiting_triage':
            return 40;
        case 'scheduled':
            return 30;
        case 'completed':
            return 20;
        case 'no_show':
            return 10;
        case 'cancelled':
            return 0;
        default:
            return 5;
    }
}

function patientTimelineTimestamp(value: string | null | undefined): number {
    if (!value) return Number.NEGATIVE_INFINITY;

    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function setTimelineProfileEvents(patient: Patient) {
    const events: PatientTimelineEvent[] = [];

    events.push({
        id: `profile-created-${patient.id}`,
        occurredAt: patient.createdAt,
        title: tW2('timeline.profileRegisteredTitle'),
        description: patient.patientNumber
            ? tW2('timeline.profileRegisteredDescriptionWithNumber', {
                  patientNumber: patient.patientNumber,
              })
            : tW2('timeline.profileRegisteredDescriptionDefault'),
        href: null,
        badge: tW2('timeline.badgeProfile'),
        category: 'profile',
    });

    if (patient.updatedAt && patient.updatedAt !== patient.createdAt) {
        events.push({
            id: `profile-updated-${patient.id}`,
            occurredAt: patient.updatedAt,
            title: tW2('timeline.demographicsUpdatedTitle'),
            description: tW2('timeline.demographicsUpdatedDescription'),
            href: null,
            badge: tW2('timeline.badgeProfile'),
            category: 'profile',
        });
    }

    if (patient.status && patient.status.toLowerCase() !== 'active') {
        events.push({
            id: `profile-status-${patient.id}`,
            occurredAt: patient.updatedAt,
            title: tW2('timeline.statusChangedTitle', {
                status: patient.status,
            }),
            description:
                patient.statusReason || tW2('timeline.statusChangedDescription'),
            href: null,
            badge: tW2('timeline.badgeStatus'),
            category: 'profile',
        });
    }

    detailsTimelineProfileEvents.value = sortTimelineEvents(events);
}

async function loadPatientTimeline(patient: Patient) {
    const requestToken = ++timelineRequestToken;
    detailsTimelineLoading.value = true;
    clearTimelineState();
    setTimelineProfileEvents(patient);

    const [appointmentsResult, admissionsResult, medicalRecordsResult] = await Promise.allSettled([
        canReadAppointments.value
            ? apiRequest<PatientTimelineListResponse<PatientTimelineAppointment>>('GET', '/appointments', {
                  query: {
                      patientId: patient.id,
                      page: 1,
                      perPage: 8,
                      sortBy: 'scheduledAt',
                      sortDir: 'desc',
                  },
              })
            : Promise.resolve(emptyTimelineListResponse<PatientTimelineAppointment>()),
        canReadAdmissions.value
            ? apiRequest<PatientTimelineListResponse<PatientTimelineAdmission>>('GET', '/admissions', {
                  query: {
                      patientId: patient.id,
                      page: 1,
                      perPage: 8,
                      sortBy: 'admittedAt',
                      sortDir: 'desc',
                  },
              })
            : Promise.resolve(emptyTimelineListResponse<PatientTimelineAdmission>()),
        canFetchMedicalRecordsForTimeline.value
            ? apiRequest<PatientTimelineListResponse<PatientTimelineMedicalRecord>>('GET', '/medical-records', {
                  query: {
                      patientId: patient.id,
                      page: 1,
                      perPage: 8,
                      sortBy: 'encounterAt',
                      sortDir: 'desc',
                  },
              })
            : Promise.resolve(emptyTimelineListResponse<PatientTimelineMedicalRecord>()),
    ]);

    if (requestToken !== timelineRequestToken) {
        return;
    }

    const loadFailures: string[] = [];

    if (appointmentsResult.status === 'fulfilled') {
        detailsTimelineAppointments.value = appointmentsResult.value.data ?? [];
        detailsTimelineAppointmentEvents.value = sortTimelineEvents(
            (appointmentsResult.value.data ?? []).map((item) => ({
                id: `appointment-${item.id}`,
                occurredAt: item.scheduledAt,
                title: item.appointmentNumber
                    ? tW2('timeline.eventTitleAppointmentWithNumber', {
                          appointmentNumber: item.appointmentNumber,
                      })
                    : tW2('timeline.eventTitleAppointment'),
                description: `${item.department || tW2('timeline.eventDepartmentFallback')} | ${(
                    item.status || tW2('timeline.eventUnknownStatus')
                ).replace('_', ' ')}`,
                href: patientTimelineHref('/appointments', patient.id, {
                    focusAppointmentId: item.id,
                }, { includePatientId: false }),
                badge: tW2('timeline.badgeAppointment'),
                category: 'appointment',
            })),
        );
    } else {
        detailsTimelineAppointments.value = [];
        loadFailures.push(tW2('timeline.loadFailureAppointments'));
    }

    if (admissionsResult.status === 'fulfilled') {
        detailsTimelineAdmissionEvents.value = sortTimelineEvents(
            (admissionsResult.value.data ?? []).map((item) => ({
                id: `admission-${item.id}`,
                occurredAt: item.admittedAt || item.dischargedAt,
                title: item.admissionNumber
                    ? tW2('timeline.eventTitleAdmissionWithNumber', {
                          admissionNumber: item.admissionNumber,
                      })
                    : tW2('timeline.eventTitleAdmission'),
                description: `${item.ward || tW2('timeline.eventWardFallback')} | ${item.status || tW2('timeline.eventUnknownStatus')}`,
                href: patientTimelineHref('/admissions', patient.id, {
                    appointmentId: item.appointmentId,
                }),
                badge: tW2('timeline.badgeAdmission'),
                category: 'admission',
            })),
        );
    } else {
        loadFailures.push(tW2('timeline.loadFailureAdmissions'));
    }

    if (medicalRecordsResult.status === 'fulfilled') {
        detailsTimelineMedicalRecordEvents.value = sortTimelineEvents(
            (medicalRecordsResult.value.data ?? []).map((item) => ({
                id: `medical-record-${item.id}`,
                occurredAt: item.encounterAt,
                title: item.recordNumber
                    ? tW2('timeline.eventTitleRecordWithNumber', {
                          recordNumber: item.recordNumber,
                      })
                    : tW2('timeline.eventTitleMedicalRecord'),
                description: `${item.recordType || tW2('timeline.eventRecordTypeFallback')} | ${item.status || tW2('timeline.eventUnknownStatus')}`,
                href: patientChartHref(patient.id, {
                    tab: 'records',
                    recordId: item.id,
                    appointmentId: item.appointmentId,
                    admissionId: item.admissionId,
                    from: 'patients',
                }),
                badge: tW2('timeline.badgeMedicalRecord'),
                category: 'medicalRecord',
            })),
        );
    } else {
        loadFailures.push(tW2('timeline.loadFailureMedicalRecords'));
    }

    if (loadFailures.length > 0) {
        detailsTimelineError.value = tW2('timeline.loadFailureSummary', {
            sections: loadFailures.join(', '),
        });
    }

    if (requestToken === timelineRequestToken) {
        detailsTimelineLoading.value = false;
    }
}

function openPatientDetailsSheet(patient: Patient) {
    detailsSheetPatient.value = patient;
    detailsSheetOpen.value = true;
    detailsSheetTab.value = 'overview';
    void loadPatientTimeline(patient);
    void loadPatientInsurance(patient.id);
    void loadPatientInsuranceOptions();
    detailsAuditLogs.value = [];
    detailsAuditMeta.value = null;
    detailsAuditError.value = null;
    detailsAuditFiltersOpen.value = false;
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    resetInsuranceForm();
    detailsInsuranceRecords.value = [];
    detailsInsuranceError.value = null;
}

function closePatientDetailsSheet() {
    timelineRequestToken += 1;
    detailsSheetOpen.value = false;
    detailsSheetPatient.value = null;
    detailsTimelineLoading.value = false;
    clearTimelineState();
    detailsAuditLogs.value = [];
    detailsAuditMeta.value = null;
    detailsAuditError.value = null;
    detailsInsuranceRecords.value = [];
    detailsInsuranceError.value = null;
    insuranceFormOpen.value = false;
}

const activePatientInsuranceRecord = computed(() =>
    detailsInsuranceRecords.value.find((record) => (record.status ?? '').toLowerCase() === 'active') ?? null,
);

function resetInsuranceForm() {
    insuranceForm.billingPayerContractId = '';
    insuranceForm.insuranceType = 'insurance';
    insuranceForm.insuranceProvider = '';
    insuranceForm.providerCode = '';
    insuranceForm.planName = '';
    insuranceForm.policyNumber = '';
    insuranceForm.memberId = '';
    insuranceForm.cardNumber = '';
    insuranceForm.effectiveDate = '';
    insuranceForm.expiryDate = '';
    insuranceForm.coverageLevel = '';
    insuranceForm.copayPercent = '';
    insuranceForm.verificationStatus = 'unverified';
    insuranceForm.verificationReference = '';
    insuranceForm.notes = '';
}

async function loadPatientInsurance(patientId: string) {
    if (!canReadPatientInsurance.value) {
        detailsInsuranceRecords.value = [];
        return;
    }

    detailsInsuranceLoading.value = true;
    detailsInsuranceError.value = null;
    try {
        const response = await apiRequest<PatientInsuranceListResponse>('GET', `/patients/${patientId}/insurance`);
        detailsInsuranceRecords.value = response.data ?? [];
    } catch (error) {
        detailsInsuranceRecords.value = [];
        detailsInsuranceError.value = messageFromUnknown(error, 'Unable to load patient insurance.');
    } finally {
        detailsInsuranceLoading.value = false;
    }
}

async function loadPatientInsuranceOptions() {
    if (!canReadPatientInsurance.value || patientInsuranceProviderPresets.value.length > 0) return;

    detailsInsuranceOptionsLoading.value = true;
    try {
        const response = await apiRequest<PatientInsuranceOptionResponse>('GET', '/patients/insurance-options');
        patientInsuranceProviderPresets.value = response.data?.providerPresets ?? [];
        patientInsurancePayerContracts.value = response.data?.payerContracts ?? [];
    } catch {
        patientInsuranceProviderPresets.value = [];
        patientInsurancePayerContracts.value = [];
    } finally {
        detailsInsuranceOptionsLoading.value = false;
    }
}

function applyInsuranceProviderPreset(code: string | undefined) {
    const normalized = code ?? '';
    insuranceForm.providerCode = normalized;
    const preset = patientInsuranceProviderPresets.value.find((option) => option.code === normalized);
    if (preset) {
        insuranceForm.insuranceProvider = preset.name;
    }
}

function applyInsurancePayerContract(id: string | undefined) {
    const normalized = id ?? '';
    insuranceForm.billingPayerContractId = normalized;
    const contract = patientInsurancePayerContracts.value.find((option) => option.id === normalized);
    if (!contract) return;

    insuranceForm.insuranceProvider = contract.payerName ?? insuranceForm.insuranceProvider;
    insuranceForm.planName = contract.payerPlanName ?? insuranceForm.planName;
}

async function submitPatientInsurance() {
    if (!detailsSheetPatient.value || detailsInsuranceSaving.value) return;

    detailsInsuranceSaving.value = true;
    detailsInsuranceError.value = null;
    try {
        await apiRequest<{ data: PatientInsuranceRecord }>('POST', `/patients/${detailsSheetPatient.value.id}/insurance`, {
            body: {
                billingPayerContractId: insuranceForm.billingPayerContractId || null,
                insuranceType: insuranceForm.insuranceType,
                insuranceProvider: insuranceForm.insuranceProvider,
                providerCode: insuranceForm.providerCode || null,
                planName: insuranceForm.planName || null,
                policyNumber: insuranceForm.policyNumber || null,
                memberId: insuranceForm.memberId,
                cardNumber: insuranceForm.cardNumber || null,
                effectiveDate: insuranceForm.effectiveDate || null,
                expiryDate: insuranceForm.expiryDate || null,
                coverageLevel: insuranceForm.coverageLevel || null,
                copayPercent: insuranceForm.copayPercent || null,
                verificationStatus: insuranceForm.verificationStatus,
                verificationReference: insuranceForm.verificationReference || null,
                notes: insuranceForm.notes || null,
            },
        });
        notifySuccess('Patient insurance saved.');
        resetInsuranceForm();
        insuranceFormOpen.value = false;
        await loadPatientInsurance(detailsSheetPatient.value.id);
    } catch (error) {
        detailsInsuranceError.value = messageFromUnknown(error, 'Unable to save patient insurance.');
        notifyError(detailsInsuranceError.value);
    } finally {
        detailsInsuranceSaving.value = false;
    }
}

async function verifyPatientInsurance(record: PatientInsuranceRecord) {
    if (!detailsSheetPatient.value || detailsInsuranceSaving.value) return;

    detailsInsuranceSaving.value = true;
    detailsInsuranceError.value = null;
    try {
        await apiRequest<{ data: PatientInsuranceRecord }>(
            'PATCH',
            `/patients/${detailsSheetPatient.value.id}/insurance/${record.id}/verify`,
            {
                body: {
                    verificationStatus: 'verified',
                    verificationSource: 'manual',
                    verificationReference: record.verificationReference || null,
                },
            },
        );
        notifySuccess('Insurance verification updated.');
        await loadPatientInsurance(detailsSheetPatient.value.id);
    } catch (error) {
        detailsInsuranceError.value = messageFromUnknown(error, 'Unable to verify insurance.');
        notifyError(detailsInsuranceError.value);
    } finally {
        detailsInsuranceSaving.value = false;
    }
}

function formatDate(value: string | null): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

function statusVariant(status: string | null) {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (['inactive', 'deceased', 'archived', 'suspended'].includes(normalized)) return 'destructive';
    return 'outline';
}

const scopeWarning = computed(() => {
    if (loading.value) return null;
    if (!tenantIsolationEnabled.value) return null;
    if (!scope.value) return 'Platform access scope could not be loaded.';
    if (scope.value.resolvedFrom === 'none') {
        return 'No tenant/facility scope is resolved. Patient create/search may be blocked by tenant isolation controls.';
    }
    return null;
});

const canPrev = computed(() => (pagination.value?.currentPage ?? 1) > 1);
const canNext = computed(() => {
    if (!pagination.value) return false;
    return pagination.value.currentPage < pagination.value.lastPage;
});

const paginationPageNumbers = computed((): (number | '...')[] => {
    const total = pagination.value?.lastPage ?? 1;
    const current = pagination.value?.currentPage ?? 1;
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
        pages.push(p);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
});

const scopeStatusLabel = computed(() => {
    if (!scope.value) return 'Scope Unavailable';
    return scope.value.resolvedFrom === 'none' ? 'Scope Unresolved' : 'Scope Ready';
});

const patientGenderFilterOptions = [
    { value: SELECT_ALL_VALUE, label: 'All genders' },
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
    { value: 'other', label: 'Other' },
    { value: 'unknown', label: 'Unknown' },
];

const patientSortByOptions = [
    { value: 'createdAt', label: 'Registered date' },
    { value: 'updatedAt', label: 'Last updated' },
    { value: 'patientNumber', label: 'Patient number' },
    { value: 'firstName', label: 'First name' },
    { value: 'lastName', label: 'Last name' },
];

const patientSortDirOptions = [
    { value: 'desc', label: 'Descending' },
    { value: 'asc', label: 'Ascending' },
];

function nonEmptySelectValue(value: string | null | undefined): string {
    return value && value.trim() !== '' ? value : SELECT_ALL_VALUE;
}

function filterValueFromSelect(value: string | number | null | undefined): string {
    const normalized = String(value ?? '');
    return normalized === SELECT_ALL_VALUE ? '' : normalized;
}

function optionLabel(options: Array<{ value: string; label: string }>, value: string): string {
    return options.find((option) => option.value === value)?.label ?? formatEnumLabel(value);
}

const detailsAuditActorTypeFilterValue = computed({
    get: () => nonEmptySelectValue(detailsAuditFilters.actorType),
    set: (value: string | number | null | undefined) => {
        detailsAuditFilters.actorType = filterValueFromSelect(value);
    },
});

const editGenderSelectValue = computed({
    get: () => editForm.gender || SELECT_NONE_VALUE,
    set: (value: string | number | null | undefined) => {
        const normalized = String(value ?? '');
        editForm.gender = normalized === SELECT_NONE_VALUE ? '' : normalized;
    },
});

const hasActivePatientFilters = computed(() => {
    return Boolean(
        searchForm.q.trim() ||
            searchForm.status !== 'active' ||
            searchForm.gender ||
            searchForm.region.trim() ||
            searchForm.district.trim() ||
            searchForm.sortBy !== 'createdAt' ||
            searchForm.sortDir !== 'desc' ||
            searchForm.perPage !== 10,
    );
});

function matchesPatientPreset(options: { status?: string }): boolean {
    if (searchForm.q.trim()) return false;
    if (searchForm.gender) return false;
    if (searchForm.region.trim()) return false;
    if (searchForm.district.trim()) return false;
    if (searchForm.sortBy !== 'createdAt') return false;
    if (searchForm.sortDir !== 'desc') return false;
    if (searchForm.perPage !== 10) return false;
    if (searchForm.page !== 1) return false;
    return (options.status ?? '') === searchForm.status;
}

function formatDateTime(value: string | null): string {
    if (!value) return 'N/A';
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

const patientPresetState = computed(() => ({
    active: matchesPatientPreset({ status: 'active' }),
    inactive: matchesPatientPreset({ status: 'inactive' }),
    all: matchesPatientPreset({ status: '' }),
}));

const activePatientPresetLabel = computed(() => {
    if (patientPresetState.value.active) return 'Active';
    if (patientPresetState.value.inactive) return 'Inactive';
    if (patientPresetState.value.all) return 'All';
    return null;
});

const visiblePatientStatusCounts = computed(() => {
    const counts = {
        active: 0,
        inactive: 0,
        other: 0,
    };

    for (const patient of patients.value) {
        const normalizedStatus = (patient.status ?? '').toLowerCase();
        if (normalizedStatus === 'active') {
            counts.active += 1;
            continue;
        }
        if (normalizedStatus === 'inactive') {
            counts.inactive += 1;
            continue;
        }
        counts.other += 1;
    }

    return counts;
});

const summaryPatientStatusCounts = computed<PatientStatusCounts>(() => {
    if (patientStatusCounts.value) return patientStatusCounts.value;

    const fallbackVisibleTotal =
        visiblePatientStatusCounts.value.active +
        visiblePatientStatusCounts.value.inactive +
        visiblePatientStatusCounts.value.other;

    const fallbackTotal = Math.max(fallbackVisibleTotal, pagination.value?.total ?? 0);

    return {
        active: visiblePatientStatusCounts.value.active,
        inactive: visiblePatientStatusCounts.value.inactive,
        other: visiblePatientStatusCounts.value.other,
        total: fallbackTotal,
    };
});

const patientFilterChips = computed(() => {
    const chips: Array<{ key: string; label: string }> = [];

    if (searchForm.q.trim()) {
        chips.push({ key: 'q', label: `Search: ${searchForm.q.trim()}` });
    }

    if (searchForm.status !== 'active') {
        chips.push({
            key: 'status',
            label: `Status: ${searchForm.status ? formatEnumLabel(searchForm.status) : 'All'}`,
        });
    }

    if (searchForm.gender) {
        chips.push({
            key: 'gender',
            label: `Gender: ${optionLabel(patientGenderFilterOptions, searchForm.gender)}`,
        });
    }

    if (searchForm.region.trim()) {
        chips.push({ key: 'region', label: `Region: ${searchForm.region.trim()}` });
    }

    if (searchForm.district.trim()) {
        chips.push({ key: 'district', label: `District: ${searchForm.district.trim()}` });
    }

    if (searchForm.sortBy !== 'createdAt' || searchForm.sortDir !== 'desc') {
        chips.push({
            key: 'sort',
            label: `Sort: ${optionLabel(patientSortByOptions, searchForm.sortBy)}, ${optionLabel(patientSortDirOptions, searchForm.sortDir)}`,
        });
    }

    if (searchForm.perPage !== 10) {
        chips.push({ key: 'perPage', label: `${searchForm.perPage} rows` });
    }

    return chips;
});

const patientFilterStateLabel = computed(() => {
    const count = patientFilterChips.value.length;
    if (count === 0) return null;
    return count === 1 ? '1 filter' : `${count} filters`;
});

async function loadScope() {
    try {
        const response = await apiRequest<{ data: ScopeData }>('GET', '/platform/access-scope');
        scope.value = response.data;
    } catch (error) {
        listErrors.value.push(`Scope: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function loadCountryProfile() {
    try {
        const response = await apiRequest<CountryProfileResponse>('GET', '/platform/country-profile');
        const resolvedCode =
            normalizeCountryCode(response.data?.profile?.code) ||
            normalizeCountryCode(response.data?.activeCode);
        const profiles = Array.isArray(response.data?.availableProfiles)
            ? response.data?.availableProfiles ?? []
            : response.data?.profile
              ? [response.data.profile]
              : [];

        countryProfileCatalog.value = profiles;
        if (resolvedCode) {
            activePlatformCountryCode.value = resolvedCode;
        }
    } catch {
        // Country profile is a UX default source, not a hard blocker.
    }
}

async function loadPatientPermissions() {
    try {
        const response = await apiRequest<AuthPermissionsResponse>('GET', '/auth/me/permissions');
        const names = new Set(
            (response.data ?? [])
                .map((permission) => permission.name?.trim())
                .filter((name): name is string => Boolean(name)),
        );
        patientReadPermissionState.value = names.has('patients.read') ? 'allowed' : 'denied';
        canViewPatientAudit.value = names.has('patients.view-audit-logs');
        canReadAppointments.value = names.has('appointments.read');
        canCreateAppointments.value = names.has('appointments.create');
        canUpdateAppointmentsStatus.value = names.has('appointments.update-status');
        canReadAdmissions.value = names.has('admissions.read');
        canReadMedicalRecords.value = names.has('medical.records.read');
        canCreateBillingInvoices.value = names.has('billing.invoices.create');
        canCreatePatients.value = names.has('patients.create');
        canUpdatePatients.value = names.has('patients.update');
        canUpdatePatientStatus.value = names.has('patients.update-status');
        canReadPatientInsurance.value = names.has('patients.insurance.read');
        canManagePatientInsurance.value = names.has('patients.insurance.manage');
        canVerifyPatientInsurance.value = names.has('patients.insurance.verify');
        canRecordOpdTriage.value =
            names.has('emergency.triage.create') || names.has('emergency.triage.update-status');
        canCreateLaboratoryOrders.value = names.has('laboratory.orders.create');
        canCreatePharmacyOrders.value = names.has('pharmacy.orders.create');
        canCreateRadiologyOrders.value = names.has('radiology.orders.create');
        canCreateTheatreProcedures.value = names.has('theatre.procedures.create');
        canCreateServiceRequests.value = names.has('service.requests.create');
    } catch {
        patientReadPermissionState.value = 'denied';
        canViewPatientAudit.value = false;
        canReadAppointments.value = false;
        canCreateAppointments.value = false;
        canUpdateAppointmentsStatus.value = false;
        canReadAdmissions.value = false;
        canReadMedicalRecords.value = false;
        canCreateBillingInvoices.value = false;
        canCreatePatients.value = false;
        canUpdatePatients.value = false;
        canUpdatePatientStatus.value = false;
        canReadPatientInsurance.value = false;
        canManagePatientInsurance.value = false;
        canVerifyPatientInsurance.value = false;
        canRecordOpdTriage.value = false;
        canCreateLaboratoryOrders.value = false;
        canCreatePharmacyOrders.value = false;
        canCreateRadiologyOrders.value = false;
        canCreateTheatreProcedures.value = false;
        canCreateServiceRequests.value = false;
    }
}

async function loadPatients() {
    if (!canReadPatients.value) {
        patients.value = [];
        pagination.value = null;
        listLoading.value = false;
        loading.value = false;
        return;
    }

    listLoading.value = true;
    listErrors.value = [];

    try {
        const response = await apiRequest<PatientListResponse>('GET', '/patients', {
            query: {
                q: searchForm.q.trim() || null,
                status: searchForm.status || null,
                gender: searchForm.gender || null,
                region: searchForm.region.trim() || null,
                district: searchForm.district.trim() || null,
                sortBy: searchForm.sortBy,
                sortDir: searchForm.sortDir,
                page: searchForm.page,
                perPage: searchForm.perPage,
            },
        });

        patients.value = response.data;
        pagination.value = response.meta;
    } catch (error) {
        patients.value = [];
        pagination.value = null;
        listErrors.value.push(error instanceof Error ? error.message : 'Unable to load patients.');
    } finally {
        listLoading.value = false;
        loading.value = false;
    }
}

async function loadPatientStatusCounts() {
    if (!canReadPatients.value) {
        patientStatusCounts.value = null;
        return;
    }

    try {
        const response = await apiRequest<PatientStatusCountsResponse>('GET', '/patients/status-counts', {
            query: {
                q: searchForm.q.trim() || null,
            },
        });

        patientStatusCounts.value = response.data;
    } catch {
        patientStatusCounts.value = null;
    }
}

function detailsAuditQuery() {
    return {
        q: detailsAuditFilters.q.trim() || null,
        action: detailsAuditFilters.action.trim() || null,
        actorType: detailsAuditFilters.actorType || null,
        actorId: detailsAuditFilters.actorId.trim() || null,
        from: detailsAuditFilters.from || null,
        to: detailsAuditFilters.to || null,
        page: detailsAuditFilters.page,
        perPage: detailsAuditFilters.perPage,
    };
}

function auditActorLabel(log: PatientAuditLog): string {
    const displayName = log.actor?.displayName?.trim();
    if (displayName) return displayName;
    return log.actorId === null || log.actorId === undefined
        ? 'System'
        : `User #${log.actorId}`;
}

function auditFieldLabel(value: string): string {
    return value
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatEnumLabel(value: string): string {
    return auditFieldLabel(value);
}

function auditValuePreview(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return null;
        return trimmed.length > 48 ? `${trimmed.slice(0, 45)}...` : trimmed;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value.length === 0 ? null : `${value.length} items`;
    }

    return null;
}

function auditObjectEntries(
    value: Record<string, unknown> | null,
): Array<[string, unknown]> {
    if (!value) return [];

    return Object.entries(value).filter(([, entryValue]) => {
        if (entryValue === null || entryValue === undefined) return false;
        if (typeof entryValue === 'string' && entryValue.trim() === '') return false;
        if (Array.isArray(entryValue) && entryValue.length === 0) return false;
        return true;
    });
}

function auditLogChangeKeys(log: PatientAuditLog): string[] {
    return auditObjectEntries(log.changes)
        .map(([key]) => auditFieldLabel(key))
        .slice(0, 4);
}

function auditLogMetadataPreview(log: PatientAuditLog): Array<{
    key: string;
    value: string;
}> {
    return auditObjectEntries(log.metadata)
        .map(([key, value]) => ({
            key: auditFieldLabel(key),
            value: auditValuePreview(value),
        }))
        .filter((entry): entry is { key: string; value: string } => entry.value !== null)
        .slice(0, 3);
}

function auditLogActorTypeLabel(log: PatientAuditLog): string {
    if (log.actorType === 'system') return 'System';
    if (log.actorType === 'user') return 'User';
    return log.actorId === null || log.actorId === undefined ? 'System' : 'User';
}

function timelineEventLinkLabel(category: PatientTimelineCategory): string {
    if (category === 'appointment') return tW2('timeline.openAppointments');
    if (category === 'admission') return tW2('timeline.openAdmissions');
    if (category === 'medicalRecord') return tW2('timeline.openMedicalRecords');
    return 'View details';
}

function timelineEventIcon(category: PatientTimelineCategory): string {
    if (category === 'appointment') return 'calendar-clock';
    if (category === 'admission') return 'bed-double';
    if (category === 'medicalRecord') return 'stethoscope';
    return 'user';
}

function auditChangeSummary(log: PatientAuditLog): string | null {
    const changes = log.changes;
    if (changes && typeof changes === 'object') {
        const count = Object.keys(changes).length;
        if (count > 0) {
            return count === 1 ? '1 field changed' : `${count} fields changed`;
        }
    }

    const action = (log.action ?? '').trim();
    return action !== '' ? action : null;
}

async function loadDetailsAuditLogs(patientId: string) {
    if (!canViewPatientAudit.value) {
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
        detailsAuditLoading.value = false;
        detailsAuditError.value = null;
        return;
    }

    detailsAuditLoading.value = true;
    detailsAuditError.value = null;
    try {
        const response = await apiRequest<PatientAuditLogListResponse>(
            'GET',
            `/patients/${patientId}/audit-logs`,
            { query: detailsAuditQuery() },
        );
        detailsAuditLogs.value = response.data ?? [];
        detailsAuditMeta.value = response.meta;
    } catch (error) {
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
        detailsAuditError.value = messageFromUnknown(error, 'Unable to load patient audit logs.');
    } finally {
        detailsAuditLoading.value = false;
    }
}

function applyDetailsAuditFilters() {
    if (!detailsSheetPatient.value) return;
    detailsAuditFilters.page = 1;
    void loadDetailsAuditLogs(detailsSheetPatient.value.id);
}

function resetDetailsAuditFilters() {
    if (!detailsSheetPatient.value) return;
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    void loadDetailsAuditLogs(detailsSheetPatient.value.id);
}

function goToDetailsAuditPage(page: number) {
    if (!detailsSheetPatient.value) return;
    detailsAuditFilters.page = Math.max(page, 1);
    void loadDetailsAuditLogs(detailsSheetPatient.value.id);
}

async function exportDetailsAuditLogsCsv() {
    if (!detailsSheetPatient.value || !canViewPatientAudit.value || detailsAuditExporting.value) {
        return;
    }

    detailsAuditExporting.value = true;
    try {
        const url = new URL(
            `/api/v1/patients/${detailsSheetPatient.value.id}/audit-logs/export`,
            window.location.origin,
        );
        Object.entries(detailsAuditQuery()).forEach(([key, value]) => {
            if (value === null || value === '') return;
            if (key === 'page' || key === 'perPage') return;
            url.searchParams.set(key, String(value));
        });
        window.open(url.toString(), '_blank', 'noopener');
    } finally {
        detailsAuditExporting.value = false;
    }
}

async function refreshPage() {
    clearSearchDebounce();
    await Promise.all([loadScope(), loadCountryProfile(), loadPatientPermissions()]);
    await Promise.all([loadPatients(), loadPatientStatusCounts()]);
}

async function initialPageLoad() {
    clearSearchDebounce();
    if (!scope.value || !isPatientReadPermissionResolved.value) {
        await refreshPage();
        return;
    }

    await Promise.all([loadCountryProfile(), loadPatients(), loadPatientStatusCounts()]);
}

function resetCreateMessages() {
    createMessage.value = null;
    createdWarnings.value = [];
    createErrors.value = {};
}

function resetRegistrationForm() {
    registrationBirthInputMode.value = 'estimated';
    registrationForm.firstName = '';
    registrationForm.middleName = '';
    registrationForm.lastName = '';
    registrationForm.gender = 'female';
    registrationForm.dateOfBirth = '';
    registrationForm.ageYears = '';
    registrationForm.ageMonths = '';
    registrationForm.phone = '';
    registrationForm.email = '';
    registrationForm.nationalId = '';
    registrationForm.countryCode = defaultPatientCountryCode.value;
    registrationForm.region = '';
    registrationForm.district = '';
    registrationForm.addressLine = '';
    registrationForm.nextOfKinName = '';
    registrationForm.nextOfKinPhone = '';
    registerOptionalDetailsOpen.value = false;
}

function openRegistrationDialog() {
    if (!canCreatePatients.value) {
        notifyError('Request patients.create permission to register a patient.');
        return;
    }

    resetCreateMessages();
    clearPreSubmitDuplicateState();
    resetRegistrationForm();
    registerDialogOpen.value = true;
}

function closePostRegistrationDialog() {
    postRegistrationDialogOpen.value = false;
}

function registerAnotherPatient() {
    closePostRegistrationDialog();
    openRegistrationDialog();
}

function clearPreSubmitDuplicateState() {
    preSubmitDuplicateCheckLoading.value = false;
    preSubmitDuplicateCheckError.value = null;
    preSubmitDuplicateMatches.value = [];
    preSubmitDuplicateConfirmed.value = false;
}

async function focusRegistrationErrorSummary() {
    await nextTick();
    registrationErrorSummaryRef.value?.focus();
    registrationErrorSummaryRef.value?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
    });
}

async function focusEditErrorSummary() {
    await nextTick();
    editErrorSummaryRef.value?.focus();
    editErrorSummaryRef.value?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
    });
}

function normalizeNameForDuplicate(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function normalizePhoneForDuplicate(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, '').trim().toLowerCase();
}

function duplicateDisplayValue(value: string | null | undefined, fallback = 'Not recorded'): string {
    const normalized = (value ?? '').trim();
    return normalized || fallback;
}

function duplicateComparableValue(value: string | null | undefined): string {
    return (value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function duplicatePhoneMatches(left: string | null | undefined, right: string | null | undefined): boolean {
    const leftPhone = normalizePhoneForDuplicate(left);
    const rightPhone = normalizePhoneForDuplicate(right);
    return Boolean(leftPhone && rightPhone && leftPhone === rightPhone);
}

function duplicateValueMatches(left: string | null | undefined, right: string | null | undefined): boolean {
    const leftValue = duplicateComparableValue(left);
    const rightValue = duplicateComparableValue(right);
    return Boolean(leftValue && rightValue && leftValue === rightValue);
}

function duplicateDateMatches(left: string | null | undefined, right: string | null | undefined): boolean {
    const leftDate = (left ?? '').slice(0, 10);
    const rightDate = (right ?? '').slice(0, 10);
    return Boolean(leftDate && rightDate && leftDate === rightDate);
}

function duplicateComparisonRows(candidate: Patient) {
    const incomingName = registrationPatientNamePreview.value;
    const incomingDob = registrationDuplicateDateOfBirth.value;
    const incomingLocation = registrationDuplicateLocation.value;

    return [
        {
            key: 'name',
            label: 'Name',
            incoming: duplicateDisplayValue(incomingName, 'Name pending'),
            existing: duplicateDisplayValue(patientName(candidate)),
            matched: duplicateValueMatches(incomingName, patientName(candidate)),
        },
        {
            key: 'phone',
            label: 'Phone',
            incoming: duplicateDisplayValue(registrationForm.phone),
            existing: duplicateDisplayValue(candidate.phone),
            matched: duplicatePhoneMatches(registrationForm.phone, candidate.phone),
        },
        {
            key: 'dob',
            label: 'DOB',
            incoming: incomingDob ? formatDate(incomingDob) : 'Not recorded',
            existing: candidate.dateOfBirth ? formatDate(candidate.dateOfBirth) : 'Not recorded',
            matched: duplicateDateMatches(incomingDob, candidate.dateOfBirth),
        },
        {
            key: 'gender',
            label: 'Gender',
            incoming: duplicateDisplayValue(formatEnumLabel(registrationForm.gender)),
            existing: duplicateDisplayValue(formatEnumLabel(candidate.gender ?? '')),
            matched: duplicateValueMatches(registrationForm.gender, candidate.gender),
        },
        {
            key: 'id',
            label: 'National ID',
            incoming: duplicateDisplayValue(registrationForm.nationalId),
            existing: duplicateDisplayValue(candidate.nationalId),
            matched: duplicateValueMatches(registrationForm.nationalId, candidate.nationalId),
        },
        {
            key: 'location',
            label: 'Location',
            incoming: duplicateDisplayValue(incomingLocation),
            existing: patientLocationLabel(candidate),
            matched: duplicateValueMatches(incomingLocation, patientLocationLabel(candidate)),
        },
    ];
}

function asTrimmedString(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function validateRegistrationForm(): boolean {
    const errors: Record<string, string[]> = {};
    const dateOfBirthInput = asTrimmedString(registrationForm.dateOfBirth);
    const ageYearsInput = asTrimmedString(registrationForm.ageYears);
    const ageMonthsInput = asTrimmedString(registrationForm.ageMonths);
    const ageYears = parseBoundedInteger(ageYearsInput, 0, 130);
    const ageMonths = parseBoundedInteger(ageMonthsInput, 0, 11);
    const ageProvided = ageYearsInput !== '' || ageMonthsInput !== '';

    if (registrationForm.firstName.trim() === '') {
        errors.firstName = [tW2('validation.firstNameRequired')];
    }
    if (registrationForm.lastName.trim() === '') {
        errors.lastName = [tW2('validation.lastNameRequired')];
    }
    if (!registrationForm.gender) {
        errors.gender = [tW2('validation.genderRequired')];
    }
    const countryCode = normalizeCountryCode(registrationForm.countryCode);
    if (countryCode === '') {
        errors.countryCode = [tW2('validation.countryCodeRequired')];
    } else if (countryCode.length !== 2) {
        errors.countryCode = [tW2('validation.countryCodeInvalid')];
    }
    if (ageYearsInput !== '' && ageYears === null) {
        errors.ageYears = [tW2('validation.ageYearsInvalid')];
    }
    if (ageMonthsInput !== '' && ageMonths === null) {
        errors.ageMonths = [tW2('validation.ageMonthsInvalid')];
    }
    if (ageProvided && (ageYears ?? 0) === 0 && (ageMonths ?? 0) === 0) {
        errors.ageMonths = [tW2('validation.ageMonthsInvalid')];
    }

    if (!dateOfBirthInput && !ageProvided) {
        errors.dateOfBirth = [tW2('validation.dateOfBirthOrAgeRequired')];
    } else if (dateOfBirthInput) {
        const dob = new Date(dateOfBirthInput);
        if (Number.isNaN(dob.getTime())) {
            errors.dateOfBirth = [tW2('validation.dateOfBirthInvalid')];
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (dob.getTime() > today.getTime()) {
                errors.dateOfBirth = [tW2('validation.dateOfBirthFuture')];
            }
        }
    }

    if (registrationForm.phone.trim() === '') {
        errors.phone = [tW2('validation.phoneRequired')];
    } else if (registrationForm.phone.trim().length < 7) {
        errors.phone = [tW2('validation.phoneTooShort')];
    }
    if (registrationForm.region.trim() === '') {
        errors.region = [tW2('validation.regionRequired')];
    }
    if (registrationForm.district.trim() === '') {
        errors.district = [tW2('validation.districtRequired')];
    }
    if (registrationForm.addressLine.trim() === '') {
        errors.addressLine = [tW2('validation.addressLineRequired')];
    }

    createErrors.value = errors;
    const isValid = Object.keys(errors).length === 0;
    if (!isValid) {
        void focusRegistrationErrorSummary();
    }

    return isValid;
}

function parseBoundedInteger(
    input: string,
    min: number,
    max: number,
): number | null {
    if (input === '') return null;
    if (!/^\d{1,3}$/.test(input)) return null;
    const value = Number.parseInt(input, 10);
    if (!Number.isFinite(value) || value < min || value > max) return null;
    return value;
}

function deriveDateOfBirthFromAgeParts(
    ageYearsInput: string,
    ageMonthsInput: string,
): string | null {
    if (ageYearsInput === '' && ageMonthsInput === '') return null;
    const ageYears = parseBoundedInteger(ageYearsInput, 0, 130) ?? 0;
    const ageMonths = parseBoundedInteger(ageMonthsInput, 0, 11) ?? 0;
    if (ageYears === 0 && ageMonths === 0) return null;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const derived = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
    );
    derived.setFullYear(derived.getFullYear() - ageYears);
    derived.setMonth(derived.getMonth() - ageMonths);
    const year = String(derived.getFullYear());
    const month = String(derived.getMonth() + 1).padStart(2, '0');
    const day = String(derived.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function deriveAgePartsFromDateOfBirth(
    dateOfBirthInput: string,
): { ageYears: string; ageMonths: string } | null {
    if (dateOfBirthInput === '') return null;

    const dateOfBirth = new Date(dateOfBirthInput);
    if (Number.isNaN(dateOfBirth.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateOfBirth.getTime() > today.getTime()) return null;

    let years = today.getFullYear() - dateOfBirth.getFullYear();
    let months = today.getMonth() - dateOfBirth.getMonth();

    if (today.getDate() < dateOfBirth.getDate()) {
        months -= 1;
    }

    if (months < 0) {
        years -= 1;
        months += 12;
    }

    if (years < 0) return null;

    return {
        ageYears: String(years),
        ageMonths: String(months),
    };
}

function syncDateOfBirthFromAgeInputs(): void {
    const ageYearsInput = asTrimmedString(registrationForm.ageYears);
    const ageMonthsInput = asTrimmedString(registrationForm.ageMonths);
    const derivedDateOfBirth = deriveDateOfBirthFromAgeParts(
        ageYearsInput,
        ageMonthsInput,
    );
    if (!derivedDateOfBirth) {
        registrationForm.dateOfBirth = '';
        return;
    }
    registrationForm.dateOfBirth = derivedDateOfBirth;
}

function clearEstimatedAgeFromManualDobInput(): void {
    if (asTrimmedString(registrationForm.dateOfBirth) === '') return;
    registrationForm.ageYears = '';
    registrationForm.ageMonths = '';
}

function setRegistrationBirthInputMode(mode: RegistrationBirthInputMode): void {
    if (registrationBirthInputMode.value === mode) return;

    registrationBirthInputMode.value = mode;

    if (mode === 'exact') {
        if (
            asTrimmedString(registrationForm.dateOfBirth) === '' &&
            registrationDerivedDateOfBirth.value
        ) {
            registrationForm.dateOfBirth = registrationDerivedDateOfBirth.value;
        }

        registrationForm.ageYears = '';
        registrationForm.ageMonths = '';
    } else {
        const ageParts = deriveAgePartsFromDateOfBirth(
            asTrimmedString(registrationForm.dateOfBirth),
        );

        registrationForm.ageYears = ageParts?.ageYears ?? '';
        registrationForm.ageMonths = ageParts?.ageMonths ?? '';
        syncDateOfBirthFromAgeInputs();
    }

    delete createErrors.value.dateOfBirth;
    delete createErrors.value.ageYears;
    delete createErrors.value.ageMonths;
}

function syncEditDateOfBirthFromAgeInputs(): void {
    const ageYearsInput = asTrimmedString(editForm.ageYears);
    const ageMonthsInput = asTrimmedString(editForm.ageMonths);
    const derivedDateOfBirth = deriveDateOfBirthFromAgeParts(
        ageYearsInput,
        ageMonthsInput,
    );
    if (!derivedDateOfBirth) {
        editForm.dateOfBirth = '';
        return;
    }
    editForm.dateOfBirth = derivedDateOfBirth;
}

function clearEstimatedAgeFromManualEditDobInput(): void {
    if (asTrimmedString(editForm.dateOfBirth) === '') return;
    editForm.ageYears = '';
    editForm.ageMonths = '';
}

function setEditBirthInputMode(mode: RegistrationBirthInputMode): void {
    if (editBirthInputMode.value === mode) return;

    editBirthInputMode.value = mode;

    if (mode === 'exact') {
        if (
            asTrimmedString(editForm.dateOfBirth) === '' &&
            editDerivedDateOfBirth.value
        ) {
            editForm.dateOfBirth = editDerivedDateOfBirth.value;
        }

        editForm.ageYears = '';
        editForm.ageMonths = '';
    } else {
        const ageParts = deriveAgePartsFromDateOfBirth(
            asTrimmedString(editForm.dateOfBirth),
        );

        editForm.ageYears = ageParts?.ageYears ?? '';
        editForm.ageMonths = ageParts?.ageMonths ?? '';
        syncEditDateOfBirthFromAgeInputs();
    }

    delete editErrors.value.dateOfBirth;
    delete editErrors.value.ageYears;
    delete editErrors.value.ageMonths;
}

function payloadFromForm() {
    const dateOfBirth =
        asTrimmedString(registrationForm.dateOfBirth) ||
        deriveDateOfBirthFromAgeParts(
            asTrimmedString(registrationForm.ageYears),
            asTrimmedString(registrationForm.ageMonths),
        ) ||
        '';

    return {
        firstName: registrationForm.firstName.trim(),
        middleName: registrationForm.middleName.trim() || null,
        lastName: registrationForm.lastName.trim(),
        gender: registrationForm.gender,
        dateOfBirth,
        phone: registrationForm.phone.trim(),
        email: registrationForm.email.trim() || null,
        nationalId: registrationForm.nationalId.trim() || null,
        countryCode:
            normalizeCountryCode(registrationForm.countryCode) ||
            defaultPatientCountryCode.value,
        region: registrationForm.region.trim(),
        district: registrationForm.district.trim(),
        addressLine: registrationForm.addressLine.trim(),
        nextOfKinName: registrationForm.nextOfKinName.trim() || null,
        nextOfKinPhone: registrationForm.nextOfKinPhone.trim() || null,
    };
}

async function findPreSubmitDuplicateMatches(payload: ReturnType<typeof payloadFromForm>): Promise<Patient[]> {
    if (!canReadPatients.value) return [];

    const queryTerm = [payload.firstName, payload.lastName, payload.phone]
        .filter((part): part is string => Boolean(part && part.trim() !== ''))
        .join(' ')
        .trim();

    if (queryTerm === '') return [];

    const listResponse = await apiRequest<PatientListResponse>('GET', '/patients', {
        query: {
            q: queryTerm,
            status: 'active',
            page: 1,
            perPage: 15,
            sortBy: 'createdAt',
            sortDir: 'desc',
        },
    });

    const expectedFirstName = normalizeNameForDuplicate(payload.firstName);
    const expectedLastName = normalizeNameForDuplicate(payload.lastName);
    const expectedDateOfBirth = payload.dateOfBirth;
    const expectedPhone = normalizePhoneForDuplicate(payload.phone);

    return (listResponse.data ?? [])
        .filter((candidate) => {
            const firstMatches =
                normalizeNameForDuplicate(candidate.firstName) === expectedFirstName;
            const lastMatches =
                normalizeNameForDuplicate(candidate.lastName) === expectedLastName;
            const dobMatches = (candidate.dateOfBirth ?? '').slice(0, 10) === expectedDateOfBirth;
            const phoneMatches =
                normalizePhoneForDuplicate(candidate.phone) === expectedPhone;

            return firstMatches && lastMatches && dobMatches && phoneMatches;
        })
        .slice(0, 5);
}

async function confirmCreateDespiteDuplicate() {
    preSubmitDuplicateConfirmed.value = true;
    await createPatient();
}

async function createPatient() {
    if (createLoading.value) return;
    if (!canCreatePatients.value) {
        notifyError('Request patients.create permission to register a patient.');
        return;
    }

    resetCreateMessages();
    preSubmitDuplicateCheckError.value = null;

    if (!validateRegistrationForm()) {
        return;
    }

    const payload = payloadFromForm();

    if (!preSubmitDuplicateConfirmed.value) {
        preSubmitDuplicateCheckLoading.value = true;
        try {
            const matches = await findPreSubmitDuplicateMatches(payload);
            preSubmitDuplicateMatches.value = matches;
            if (matches.length > 0) {
                return;
            }
        } catch (error) {
            preSubmitDuplicateCheckError.value = messageFromUnknown(
                error,
                tW2('duplicate.precheckFailedSubmitStillAllowed'),
            );
        } finally {
            preSubmitDuplicateCheckLoading.value = false;
        }
    }

    createLoading.value = true;

    try {
        const response = await apiRequest<PatientStoreResponse>('POST', '/patients', {
            body: payload,
        });

        createMessage.value = response.data.patientNumber
            ? tW2('create.successWithNumber', {
                  patientNumber: response.data.patientNumber,
              })
            : tW2('create.success');
        if (createMessage.value) notifySuccess(createMessage.value);
        createdWarnings.value = response.warnings ?? [];
        postRegistrationPatient.value = response.data;
        postRegistrationDialogOpen.value = true;

        resetRegistrationForm();
        clearPreSubmitDuplicateState();

        registerDialogOpen.value = false;
        searchForm.page = 1;
        await Promise.all([loadPatients(), loadPatientStatusCounts()]);
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };

        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
            void focusRegistrationErrorSummary();
        } else {
            createMessage.value = null;
            notifyError(messageFromUnknown(apiError, 'Unable to create patient.'));
        }
    } finally {
        createLoading.value = false;
    }
}

function submitSearch() {
    clearSearchDebounce();
    searchForm.page = 1;
    void Promise.all([loadPatients(), loadPatientStatusCounts()]);
}

function updatePatientStatusFilter(value: string | number | null | undefined) {
    searchForm.status = filterValueFromSelect(value);
    submitSearch();
}

function updatePatientGenderFilter(value: string | number | null | undefined) {
    searchForm.gender = filterValueFromSelect(value);
    submitSearch();
}

function updatePatientSortByFilter(value: string | number | null | undefined) {
    const nextValue = String(value ?? 'createdAt');
    searchForm.sortBy = patientSortByOptions.some((option) => option.value === nextValue)
        ? nextValue
        : 'createdAt';
    submitSearch();
}

function updatePatientSortDirFilter(value: string | number | null | undefined) {
    const nextValue = String(value ?? 'desc');
    searchForm.sortDir = nextValue === 'asc' ? 'asc' : 'desc';
    submitSearch();
}

function updatePatientPerPageFilter(value: string | number | null | undefined) {
    const nextValue = Number(value);
    searchForm.perPage = [10, 25, 50].includes(nextValue) ? nextValue : 10;
    submitSearch();
}

function patientLocationLabel(patient: Patient): string {
    const parts = [
        patient.district,
        patient.region,
        countryDisplayLabel(patient.countryCode) || normalizeCountryCode(patient.countryCode),
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Location not recorded';
}

function formatAge(dateOfBirth: string | null): string {
    if (!dateOfBirth) return '';
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return '';
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) years--;
    if (years < 1) {
        const months =
            (now.getFullYear() - dob.getFullYear()) * 12 + now.getMonth() - dob.getMonth();
        return `${Math.max(months, 0)}m`;
    }
    return `${years}y`;
}

function resetEditForm() {
    editBirthInputMode.value = 'exact';
    editForm.firstName = '';
    editForm.middleName = '';
    editForm.lastName = '';
    editForm.gender = '';
    editForm.dateOfBirth = '';
    editForm.ageYears = '';
    editForm.ageMonths = '';
    editForm.phone = '';
    editForm.email = '';
    editForm.nationalId = '';
    editForm.countryCode = defaultPatientCountryCode.value;
    editForm.region = '';
    editForm.district = '';
    editForm.addressLine = '';
    editForm.nextOfKinName = '';
    editForm.nextOfKinPhone = '';
    editOptionalDetailsOpen.value = false;
}

function openEditSheet(patient: Patient) {
    editTargetPatient.value = patient;
    editBirthInputMode.value = patient.dateOfBirth ? 'exact' : 'estimated';
    editForm.firstName = patient.firstName ?? '';
    editForm.middleName = patient.middleName ?? '';
    editForm.lastName = patient.lastName ?? '';
    editForm.gender = patient.gender ?? '';
    editForm.dateOfBirth = patient.dateOfBirth ?? '';
    editForm.ageYears = '';
    editForm.ageMonths = '';
    editForm.phone = patient.phone ?? '';
    editForm.email = patient.email ?? '';
    editForm.nationalId = patient.nationalId ?? '';
    editForm.countryCode =
        normalizeCountryCode(patient.countryCode) || defaultPatientCountryCode.value;
    editForm.region = patient.region ?? '';
    editForm.district = patient.district ?? '';
    editForm.addressLine = patient.addressLine ?? '';
    editForm.nextOfKinName = patient.nextOfKinName ?? '';
    editForm.nextOfKinPhone = patient.nextOfKinPhone ?? '';
    editErrors.value = {};
    editOptionalDetailsOpen.value = Boolean(
        patient.email ||
            patient.nationalId ||
            patient.nextOfKinName ||
            patient.nextOfKinPhone,
    );
    editSheetOpen.value = true;
}

function closeEditSheet() {
    editSheetOpen.value = false;
    editTargetPatient.value = null;
    editErrors.value = {};
    resetEditForm();
}

function editFieldError(key: string): string | null {
    return editErrors.value[key]?.[0] ?? null;
}

async function updatePatient() {
    if (!editTargetPatient.value || editLoading.value) return;
    editLoading.value = true;
    editErrors.value = {};
    const dateOfBirth =
        asTrimmedString(editForm.dateOfBirth) ||
        deriveDateOfBirthFromAgeParts(
            asTrimmedString(editForm.ageYears),
            asTrimmedString(editForm.ageMonths),
        ) ||
        '';
    try {
        const response = await apiRequest<{ data: Patient }>('PATCH', `/patients/${editTargetPatient.value.id}`, {
            body: {
                firstName: editForm.firstName.trim(),
                middleName: editForm.middleName.trim() || null,
                lastName: editForm.lastName.trim(),
                gender: editForm.gender || null,
                dateOfBirth: dateOfBirth || null,
                phone: editForm.phone.trim() || null,
                email: editForm.email.trim() || null,
                nationalId: editForm.nationalId.trim() || null,
                countryCode: normalizeCountryCode(editForm.countryCode) || null,
                region: editForm.region.trim() || null,
                district: editForm.district.trim() || null,
                addressLine: editForm.addressLine.trim() || null,
                nextOfKinName: editForm.nextOfKinName.trim() || null,
                nextOfKinPhone: editForm.nextOfKinPhone.trim() || null,
            },
        });
        if (detailsSheetPatient.value?.id === response.data.id) {
            Object.assign(detailsSheetPatient.value, response.data);
        }
        if (editTargetPatient.value?.id === response.data.id) {
            Object.assign(editTargetPatient.value, response.data);
        }
        const idx = patients.value.findIndex((p) => p.id === response.data.id);
        if (idx !== -1) patients.value[idx] = { ...patients.value[idx], ...response.data };
        notifySuccess('Patient record updated.');
        closeEditSheet();
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            editErrors.value = apiError.payload.errors;
            await focusEditErrorSummary();
        } else {
            notifyError(messageFromUnknown(apiError, 'Unable to update patient.'));
        }
    } finally {
        editLoading.value = false;
    }
}

function openStatusDialog(patient: Patient) {
    statusTargetPatient.value = patient;
    statusForm.status = patient.status === 'active' ? 'inactive' : 'active';
    statusForm.reason = '';
    statusErrors.value = [];
    statusDialogOpen.value = true;
}

function closeStatusDialog() {
    statusDialogOpen.value = false;
    statusTargetPatient.value = null;
    statusErrors.value = [];
}

async function changePatientStatus() {
    if (!statusTargetPatient.value || statusLoading.value) return;
    statusLoading.value = true;
    statusErrors.value = [];
    try {
        const response = await apiRequest<{ data: Patient }>('PATCH', `/patients/${statusTargetPatient.value.id}/status`, {
            body: {
                status: statusForm.status,
                reason: statusForm.reason.trim() || null,
            },
        });
        if (detailsSheetPatient.value?.id === response.data.id) {
            Object.assign(detailsSheetPatient.value, response.data);
        }
        if (statusTargetPatient.value?.id === response.data.id) {
            Object.assign(statusTargetPatient.value, response.data);
        }
        const idx = patients.value.findIndex((p) => p.id === response.data.id);
        if (idx !== -1) patients.value[idx] = { ...patients.value[idx], ...response.data };
        notifySuccess(`Patient status changed to ${response.data.status}.`);
        closeStatusDialog();
        void loadPatientStatusCounts();
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            statusErrors.value = Object.values(apiError.payload.errors).flat();
        } else {
            statusErrors.value = [messageFromUnknown(apiError, 'Unable to change patient status.')];
        }
    } finally {
        statusLoading.value = false;
    }
}

function resetPatientFilters() {
    clearSearchDebounce();
    searchForm.q = '';
    searchForm.status = 'active';
    searchForm.gender = '';
    searchForm.region = '';
    searchForm.district = '';
    searchForm.sortBy = 'createdAt';
    searchForm.sortDir = 'desc';
    searchForm.perPage = 10;
    searchForm.page = 1;
    void Promise.all([loadPatients(), loadPatientStatusCounts()]);
}

function resetPatientFiltersFromSheet() {
    resetPatientFilters();
}

function prevPage() {
    if (!canPrev.value) return;
    clearSearchDebounce();
    searchForm.page -= 1;
    void loadPatients();
}

function nextPage() {
    if (!canNext.value) return;
    clearSearchDebounce();
    searchForm.page += 1;
    void loadPatients();
}

function goToPage(page: number) {
    clearSearchDebounce();
    searchForm.page = page;
    void loadPatients();
}

function toggleColumnSort(field: string) {
    if (searchForm.sortBy === field) {
        searchForm.sortDir = searchForm.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        searchForm.sortBy = field;
        searchForm.sortDir = 'desc';
    }
    submitSearch();
}

function removeFilterChip(key: string) {
    clearSearchDebounce();
    switch (key) {
        case 'q': searchForm.q = ''; break;
        case 'status': searchForm.status = 'active'; break;
        case 'gender': searchForm.gender = ''; break;
        case 'region': searchForm.region = ''; break;
        case 'district': searchForm.district = ''; break;
        case 'sort': searchForm.sortBy = 'createdAt'; searchForm.sortDir = 'desc'; break;
        case 'perPage': searchForm.perPage = 10; break;
    }
    searchForm.page = 1;
    void Promise.all([loadPatients(), loadPatientStatusCounts()]);
}

function fieldError(key: string): string | null {
    return createErrors.value[key]?.[0] ?? null;
}

function clearSearchDebounce() {
    if (searchDebounceTimer !== null) {
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
    }
}

watch(
    () => [searchForm.q, searchForm.region, searchForm.district],
    (value, previousValue) => {
        const currentValues = value.map((item) => item.trim());
        const previousValues = (previousValue ?? []).map((item) => item.trim());

        if (currentValues.every((currentValue, index) => currentValue === previousValues[index])) {
            return;
        }

        clearSearchDebounce();
        searchDebounceTimer = window.setTimeout(() => {
            searchForm.page = 1;
            void Promise.all([loadPatients(), loadPatientStatusCounts()]);
            searchDebounceTimer = null;
        }, 350);
    },
);

watch(
    () => normalizeLocationToken(searchForm.region),
    (value, previousValue) => {
        if (value === previousValue) return;
        if (!searchForm.district.trim()) return;

        searchForm.district = '';
    },
);

watch(
    () => [registrationForm.ageYears, registrationForm.ageMonths],
    () => {
        if (registrationBirthInputMode.value !== 'estimated') return;
        syncDateOfBirthFromAgeInputs();
    },
);

watch(
    () => registrationForm.dateOfBirth,
    () => {
        if (registrationBirthInputMode.value !== 'exact') return;
        clearEstimatedAgeFromManualDobInput();
    },
);

watch(
    () => [
        registrationForm.firstName,
        registrationForm.lastName,
        registrationForm.dateOfBirth,
        registrationForm.ageYears,
        registrationForm.ageMonths,
        registrationForm.phone,
        registrationForm.gender,
    ],
    () => {
        clearPreSubmitDuplicateState();
        preSubmitDuplicateCheckError.value = null;
    },
);

watch(
    () => [editForm.ageYears, editForm.ageMonths],
    () => {
        if (editBirthInputMode.value !== 'estimated') return;
        syncEditDateOfBirthFromAgeInputs();
    },
);

watch(
    () => editForm.dateOfBirth,
    () => {
        if (editBirthInputMode.value !== 'exact') return;
        clearEstimatedAgeFromManualEditDobInput();
    },
);

watch(
    () => normalizeCountryCode(registrationForm.countryCode),
    (value, previousValue) => {
        delete createErrors.value.countryCode;

        if (value === previousValue) return;
        if (!previousValue) return;

        registrationForm.region = '';
        registrationForm.district = '';
        delete createErrors.value.region;
        delete createErrors.value.district;
    },
);

watch(
    () => normalizeLocationToken(registrationForm.region),
    (value, previousValue) => {
        delete createErrors.value.region;

        if (value === previousValue) return;
        if (!previousValue) return;

        registrationForm.district = '';
        delete createErrors.value.district;
    },
);

watch(
    () => normalizeCountryCode(editForm.countryCode),
    (value, previousValue) => {
        delete editErrors.value.countryCode;

        if (value === previousValue) return;
        if (!previousValue) return;

        editForm.region = '';
        editForm.district = '';
        delete editErrors.value.region;
        delete editErrors.value.district;
    },
);

watch(
    () => normalizeLocationToken(editForm.region),
    (value, previousValue) => {
        delete editErrors.value.region;

        if (value === previousValue) return;
        if (!previousValue) return;

        editForm.district = '';
        delete editErrors.value.district;
    },
);

watch(
    () => registerDialogOpen.value,
    (open) => {
        if (open) return;
        resetCreateMessages();
        clearPreSubmitDuplicateState();
        registerOptionalDetailsOpen.value = false;
    },
);

watch(
    () => detailsSheetTab.value,
    (tab) => {
        if (
            tab !== 'audit' ||
            !detailsSheetPatient.value ||
            !canViewPatientAudit.value ||
            detailsAuditLoading.value ||
            detailsAuditMeta.value !== null ||
            detailsAuditLogs.value.length > 0
        ) {
            return;
        }

        void loadDetailsAuditLogs(detailsSheetPatient.value.id);
    },
);

watch(
    () => canViewPatientAudit.value,
    (allowed) => {
        if (!allowed && detailsSheetTab.value === 'audit') {
            detailsSheetTab.value = 'overview';
        }
    },
);

onBeforeUnmount(clearSearchDebounce);

onMounted(initialPageLoad);
</script>

<template>
    <Head title="Patients" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-4 md:p-6">

            <!-- ================================================================== -->
            <!-- PAGE HEADER                                                        -->
            <!-- ================================================================== -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="users" class="size-7 text-primary" />
                        Patients
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Look up existing patients or register new ones with duplicate checks.
                    </p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Badge variant="outline" class="hidden sm:inline-flex">Patient Registry</Badge>

                    <Popover>
                        <PopoverTrigger as-child>
                            <Button
                                variant="outline"
                                size="sm"
                                class="h-8 px-2.5"
                            >
                                <Badge :variant="scopeWarning ? 'destructive' : 'secondary'">
                                    {{ scopeStatusLabel }}
                                </Badge>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" class="w-72 space-y-1 text-xs">
                            <p v-if="scope?.tenant">Tenant: {{ scope.tenant.name }} ({{ scope.tenant.code }})</p>
                            <p v-if="scope?.facility">Facility: {{ scope.facility.name }} ({{ scope.facility.code }})</p>
                            <p>Accessible facilities: {{ scope?.userAccess?.accessibleFacilityCount ?? 'N/A' }}</p>
                            <p v-if="!scope" class="text-destructive">Scope could not be loaded.</p>
                        </PopoverContent>
                    </Popover>

                    <Button
                        variant="outline"
                        size="sm"
                        :disabled="listLoading"
                        class="gap-1.5"
                        @click="refreshPage"
                    >
                        <AppIcon name="activity" class="size-3.5" />
                        {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                    </Button>

                    <Button v-if="canCreatePatients" size="sm" class="h-8 gap-1.5" @click="openRegistrationDialog()">
                        <AppIcon name="plus" class="size-3.5" />
                        Register Patient
                    </Button>
                </div>
            </div>

            <!-- ================================================================== -->
            <!-- SCOPE & ERROR ALERTS                                               -->
            <!-- ================================================================== -->
            <Alert v-if="scopeWarning" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="alert-triangle" class="size-4" />
                    Scope warning
                </AlertTitle>
                <AlertDescription>{{ scopeWarning }}</AlertDescription>
            </Alert>

            <Alert v-if="listErrors.length" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="circle-x" class="size-4" />
                    Request error
                </AlertTitle>
                <AlertDescription>
                    <div class="space-y-1">
                        <p v-for="errorMessage in listErrors" :key="errorMessage" class="text-xs">
                            {{ errorMessage }}
                        </p>
                    </div>
                </AlertDescription>
            </Alert>

            <div
                v-if="canReadPatients"
                class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-3"
            >
                <button
                    class="group flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                    :class="{ 'border-primary bg-primary/5': searchForm.status === 'active' }"
                    @click="searchForm.status = 'active'; submitSearch()"
                >
                    <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    <span class="font-medium">{{ summaryPatientStatusCounts.active }}</span>
                    <span class="text-muted-foreground">Active</span>
                </button>
                <button
                    class="group flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                    :class="{ 'border-primary bg-primary/5': searchForm.status === 'inactive' }"
                    @click="searchForm.status = 'inactive'; submitSearch()"
                >
                    <span class="inline-block h-2 w-2 rounded-full bg-rose-500" />
                    <span class="font-medium">{{ summaryPatientStatusCounts.inactive }}</span>
                    <span class="text-muted-foreground">Inactive</span>
                </button>
                <button
                    class="group flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                    :class="{ 'border-primary bg-primary/5': searchForm.status === '' }"
                    @click="searchForm.status = ''; submitSearch()"
                >
                    <span class="inline-block h-2 w-2 rounded-full bg-slate-400" />
                    <span class="font-medium">{{ summaryPatientStatusCounts.total }}</span>
                    <span class="text-muted-foreground">All</span>
                </button>

                <div class="ml-auto flex items-center gap-2">
                    <Badge v-if="patientFilterStateLabel" variant="secondary" class="hidden sm:inline-flex">
                        {{ patientFilterStateLabel }}
                    </Badge>
                    <Button
                        v-if="hasActivePatientFilters"
                        variant="ghost"
                        size="sm"
                        class="h-7 gap-1.5 text-xs"
                        @click="resetPatientFilters"
                    >
                        <AppIcon name="sliders-horizontal" class="size-3" />
                        Reset
                    </Button>
                </div>
            </div>

            <!-- ================================================================== -->
            <!-- PATIENT LIST (FULL WIDTH)                                          -->
            <!-- ================================================================== -->
            <Card v-if="canReadPatients" class="border-sidebar-border/70 flex min-h-0 flex-1 flex-col rounded-lg">
                <CardHeader class="shrink-0 gap-4 pb-3">
                    <div class="flex flex-col gap-4">
                        <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <div class="min-w-0 space-y-3">
                                <div class="min-w-0">
                                    <CardTitle class="flex items-center gap-2">
                                        <AppIcon name="users" class="size-5 text-muted-foreground" />
                                        Patient Registry
                                    </CardTitle>
                                    <CardDescription>
                                        Search, review, and open patient records.
                                    </CardDescription>
                                </div>

                                <div class="flex flex-wrap items-center gap-1.5">
                                    <Badge variant="secondary">
                                        {{ pagination?.total ?? 0 }} patients
                                    </Badge>
                                    <Badge v-if="activePatientPresetLabel" variant="outline">
                                        {{ activePatientPresetLabel }}
                                    </Badge>
                                    <Badge v-if="patientFilterStateLabel" variant="secondary">
                                        {{ patientFilterStateLabel }}
                                    </Badge>
                                </div>
                            </div>

                            <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:max-w-2xl">
                                <div class="relative min-w-0 flex-1 min-w-[12rem]">
                                    <AppIcon
                                        name="search"
                                        class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        id="patient-search-q"
                                        v-model="searchForm.q"
                                        placeholder="Search name, patient number, phone, email, or ID"
                                        class="h-9 pl-9"
                                        @keyup.enter="submitSearch"
                                    />
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="h-9 gap-1.5 rounded-lg"
                                    @click="patientFiltersSheetOpen = true"
                                >
                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                    Filters
                                    <Badge
                                        v-if="patientFilterChips.length > 0"
                                        variant="secondary"
                                        class="ml-1 h-5 px-1.5 text-xs"
                                    >
                                        {{ patientFilterChips.length }}
                                    </Badge>
                                </Button>
                            </div>
                        </div>

                        <div v-if="patientFilterChips.length > 0" class="flex flex-wrap gap-1.5">
                            <button
                                v-for="chip in patientFilterChips"
                                :key="chip.key"
                                type="button"
                                class="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                                @click="removeFilterChip(chip.key)"
                            >
                                {{ chip.label }}
                                <AppIcon name="x" class="size-3 text-muted-foreground" />
                            </button>
                        </div>

                    </div>
                </CardHeader>

                <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden px-0 pb-0">
                    <!-- TABLE HEADER -->
                    <div
                        class="shrink-0 hidden border-b bg-muted/30 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground md:grid md:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,auto)]"
                    >
                        <button
                            type="button"
                            class="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                            @click="toggleColumnSort('lastName')"
                        >
                            Patient
                            <AppIcon
                                :name="searchForm.sortBy === 'lastName' ? (searchForm.sortDir === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down'"
                                class="size-3.5"
                            />
                        </button>
                        <span>Status</span>
                        <button
                            type="button"
                            class="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                            @click="toggleColumnSort('createdAt')"
                        >
                            Date of Birth
                            <AppIcon
                                :name="searchForm.sortBy === 'createdAt' ? (searchForm.sortDir === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down'"
                                class="size-3.5"
                            />
                        </button>
                        <span>Contact</span>
                        <span class="text-right">Actions</span>
                    </div>

                    <!-- Table body: scrollable when rows exceed container -->
                    <ScrollArea class="min-h-0 flex-1">
                        <div>
                    <!-- LOADING -->
                    <div v-if="loading || listLoading" class="space-y-0 divide-y px-4">
                        <div v-for="n in 5" :key="n" class="flex items-center gap-4 py-3">
                            <Skeleton class="h-9 w-9 rounded-full" />
                            <div class="flex-1 space-y-2">
                                <Skeleton class="h-4 w-1/3" />
                                <Skeleton class="h-3 w-1/5" />
                            </div>
                        </div>
                    </div>

                    <!-- EMPTY STATE -->
                    <div
                        v-else-if="patients.length === 0"
                        class="flex flex-col items-center justify-center py-16 text-center"
                    >
                        <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <AppIcon name="users" class="size-6 text-muted-foreground" />
                        </div>
                        <p class="text-sm font-medium">No patients found</p>
                        <p class="mt-1 max-w-sm text-xs text-muted-foreground">
                            Try adjusting your search query or status filter, or register a new patient.
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            class="mt-4 gap-1.5"
                            @click="openRegistrationDialog()"
                        >
                            <AppIcon name="plus" class="size-3.5" />
                            Register Patient
                        </Button>
                    </div>

                    <!-- PATIENT ROWS -->
                    <div v-else class="divide-y">
                        <div
                            v-for="patient in patients"
                            :key="patient.id"
                            class="group grid items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,auto)]"
                        >
                            <!-- Patient name + number -->
                            <div class="flex min-w-0 items-center gap-3">
                                <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                    {{ patientInitials(patient) }}
                                </div>
                                <div class="min-w-0">
                                    <button
                                        class="truncate text-sm font-medium hover:text-primary hover:underline"
                                        @click="openPatientDetailsSheet(patient)"
                                    >
                                        {{ patientName(patient) }}
                                    </button>
                                    <p class="truncate text-xs text-muted-foreground">
                                        {{ patient.patientNumber || 'No MRN assigned' }}
                                    </p>
                                </div>
                            </div>

                            <!-- Status -->
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-muted-foreground md:hidden">Status:</span>
                                <Badge :variant="statusVariant(patient.status)" class="text-xs leading-none">
                                    {{ patient.status || 'unknown' }}
                                </Badge>
                            </div>

                            <!-- DOB & registered -->
                            <div class="text-xs text-muted-foreground">
                                <span class="font-medium text-foreground md:hidden">DOB: </span>
                                <span>{{ formatDate(patient.dateOfBirth) }}</span>
                                <p class="mt-0.5 hidden md:block">Registered: {{ formatDate(patient.createdAt) }}</p>
                            </div>

                            <!-- Contact -->
                            <div class="min-w-0">
                                <p class="truncate text-xs text-muted-foreground">
                                    {{ patient.phone || patient.email || 'No contact details' }}
                                </p>
                            </div>

                            <!-- Actions dropdown -->
                            <div class="flex items-center justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="hidden h-7 gap-1.5 text-xs lg:inline-flex"
                                    @click="openPatientDetailsSheet(patient)"
                                >
                                    <AppIcon name="eye" class="size-3.5" />
                                    View
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger as-child>
                                        <Button variant="ghost" size="sm" class="h-7 w-7 p-0">
                                            <span class="sr-only">Actions</span>
                                            <AppIcon name="ellipsis-vertical" class="size-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" class="w-60">
                                        <DropdownMenuLabel class="text-xs">Patient Actions</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem class="flex items-center gap-2" @click="openPatientDetailsSheet(patient)">
                                            <AppIcon name="eye" class="size-3.5" />
                                            View Details
                                        </DropdownMenuItem>
                                        <DropdownMenuItem v-if="canUpdatePatients" class="flex items-center gap-2" @click="openEditSheet(patient)">
                                            <AppIcon name="pencil" class="size-3.5" />
                                            Update Patient
                                        </DropdownMenuItem>
                                        <DropdownMenuItem v-if="canUpdatePatientStatus" class="flex items-center gap-2" @click="openStatusDialog(patient)">
                                            <AppIcon :name="patientStatusActionIcon(patient)" class="size-3.5" />
                                            {{ patientStatusActionLabel(patient) }}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel class="text-xs text-muted-foreground">Recommended next step</DropdownMenuLabel>
                                        <DropdownMenuItem class="flex items-center gap-2" @click="openPatientVisitHandoff(patient, 'list')">
                                            <AppIcon name="clipboard-list" class="size-3.5" />
                                            Start Visit Handoff
                                        </DropdownMenuItem>
                                        <DropdownMenuLabel class="px-2 pt-1 text-xs font-normal text-muted-foreground">
                                            Checks for an active visit before routing
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel class="text-xs text-muted-foreground">Urgent or direct entry</DropdownMenuLabel>
                                        <DropdownMenuItem as-child>
                                            <Link :href="patientContextHref('/emergency-triage', patient, { includeTabNew: true })" class="flex items-center gap-2">
                                                <AppIcon name="activity" class="size-3.5" />
                                                Start Emergency Triage
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem as-child>
                                            <Link :href="patientChartContextHref(patient, { from: 'patients' })" class="flex items-center gap-2">
                                                <AppIcon name="book-open" class="size-3.5" />
                                                Open Patient Chart
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel class="text-xs text-muted-foreground">Usually after consultation</DropdownMenuLabel>
                                        <DropdownMenuItem v-if="canCreateLaboratoryOrders" as-child>
                                            <Link :href="patientContextHref('/laboratory-orders', patient, { includeTabNew: true })" class="flex items-center gap-2">
                                                <AppIcon name="flask-conical" class="size-3.5" />
                                                New Lab Order
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem v-if="canCreatePharmacyOrders" as-child>
                                            <Link :href="patientContextHref('/pharmacy-orders', patient, { includeTabNew: true })" class="flex items-center gap-2">
                                                <AppIcon name="pill" class="size-3.5" />
                                                New Pharmacy Order
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem v-if="canCreateTheatreProcedures" as-child>
                                            <Link :href="patientContextHref('/theatre-procedures', patient, { includeTabNew: true })" class="flex items-center gap-2">
                                                <AppIcon name="scissors" class="size-3.5" />
                                                Schedule Procedure
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem as-child>
                                            <Link :href="patientContextHref('/billing-invoices', patient)" class="flex items-center gap-2">
                                                <AppIcon name="receipt" class="size-3.5" />
                                                Create Invoice
                                            </Link>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>
                    </div>
                    </ScrollArea>

                    <!-- PAGINATION FOOTER -->
                    <div class="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                        <p class="text-xs text-muted-foreground">
                            <template v-if="pagination">
                                Showing {{ patients.length }} of {{ pagination.total }} &middot;
                                Page {{ pagination.currentPage }} of {{ pagination.lastPage }}
                            </template>
                            <template v-else>No pagination data</template>
                        </p>
                        <div class="flex items-center gap-1">
                            <Button variant="outline" size="icon" class="size-8" :disabled="!canPrev || listLoading" @click="prevPage">
                                <AppIcon name="chevron-left" class="size-4" />
                            </Button>
                            <template v-for="page in paginationPageNumbers" :key="String(page)">
                                <span v-if="page === '...'" class="px-1 text-xs text-muted-foreground">…</span>
                                <Button
                                    v-else
                                    :variant="page === pagination?.currentPage ? 'default' : 'ghost'"
                                    size="icon"
                                    class="size-8 text-xs"
                                    :disabled="listLoading"
                                    @click="goToPage(page as number)"
                                >{{ page }}</Button>
                            </template>
                            <Button variant="outline" size="icon" class="size-8" :disabled="!canNext || listLoading" @click="nextPage">
                                <AppIcon name="chevron-right" class="size-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- NO READ PERMISSION -->
            <Card v-else-if="isPatientReadPermissionResolved" class="border-sidebar-border/70">
                <CardHeader>
                    <CardTitle>Patient Search</CardTitle>
                    <CardDescription>
                        Search and review patient profiles by identity details and workflow status.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertTitle class="flex items-center gap-2">
                            <AppIcon name="shield-check" class="size-4" />
                            Patient read access restricted
                        </AlertTitle>
                        <AlertDescription>
                            Request <code>patients.read</code> permission to view patient list and filters.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
            <Card v-else class="border-sidebar-border/70">
                <CardHeader>
                    <CardTitle>Patient Search</CardTitle>
                    <CardDescription>Loading access context...</CardDescription>
                </CardHeader>
                <CardContent class="space-y-3">
                    <Skeleton class="h-4 w-1/3" />
                    <Skeleton class="h-4 w-2/3" />
                    <Skeleton class="h-16 w-full" />
                </CardContent>
            </Card>

            <!-- ================================================================== -->
            <!-- WORKFLOW SHORTCUTS (COMPACT FOOTER BAR)                            -->
            <!-- ================================================================== -->
            <div class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-2.5">
                <span class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <AppIcon name="activity" class="size-3.5" />
                    Quick actions:
                </span>
                <Button size="sm" variant="outline" as-child class="gap-1.5">
                    <Link href="/appointments">
                        <AppIcon name="calendar-clock" class="size-3.5" />
                        Schedule Appointment
                    </Link>
                </Button>
                <Button size="sm" variant="outline" as-child class="gap-1.5">
                    <Link href="/appointments">
                        <AppIcon name="stethoscope" class="size-3.5" />
                        Start Consultation
                    </Link>
                </Button>
                <Button size="sm" variant="outline" as-child class="gap-1.5">
                    <Link href="/billing-invoices">
                        <AppIcon name="receipt" class="size-3.5" />
                        Create Invoice
                    </Link>
                </Button>
            </div>
        </div>

        <!-- Register Patient Sheet -->
        <Sheet
            :open="registerDialogOpen"
            @update:open="(open) => (registerDialogOpen = open)"
        >
            <SheetContent
                side="right"
                variant="form"
                size="5xl"
            >
                <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                    <SheetTitle class="flex items-center gap-2">
                        <AppIcon name="plus" class="size-5" />
                        {{ tW2('dialog.registerNewPatient') }}
                    </SheetTitle>
                    <SheetDescription>
                        {{ tW2('dialog.registerDescription') }}
                    </SheetDescription>
                </SheetHeader>

                <ScrollArea class="min-h-0 flex-1">
                    <div class="grid gap-4 px-6 py-4 pb-8">
                        <div class="flex flex-col gap-3 rounded-lg border bg-muted/20 px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                            <div class="min-w-0">
                                <p class="truncate text-sm font-medium">{{ registrationPatientNamePreview }}</p>
                                <p class="mt-0.5 text-muted-foreground">
                                    {{ scope?.facility?.name || 'Facility context' }}
                                    <template v-if="scope?.facility?.code"> | {{ scope.facility.code }}</template>
                                </p>
                            </div>
                            <div class="flex flex-wrap gap-1.5">
                                <Badge variant="outline">{{ formatEnumLabel(registrationForm.gender || 'gender pending') }}</Badge>
                                <Badge variant="outline">{{ registrationAgeSummary }}</Badge>
                                <Badge variant="outline">{{ countryDisplayLabel(registrationForm.countryCode) || registrationForm.countryCode || 'Country pending' }}</Badge>
                                <Badge :variant="registrationRequiredReadiness.complete === registrationRequiredReadiness.total ? 'secondary' : 'outline'">
                                    {{ registrationRequiredReadiness.complete }}/{{ registrationRequiredReadiness.total }} required
                                </Badge>
                            </div>
                        </div>
                        <Alert
                            v-if="preSubmitDuplicateMatches.length > 0"
                            class="border-amber-300 bg-amber-50"
                        >
                            <AlertTitle class="flex items-center gap-2 text-amber-900">
                                <AppIcon name="alert-triangle" class="size-4" />
                                {{ tW2('duplicate.title') }}
                            </AlertTitle>
                            <AlertDescription class="space-y-3 text-xs text-amber-900">
                                <p>{{ tW2('duplicate.description') }}</p>
                                <div class="grid gap-3">
                                    <div
                                        v-for="match in preSubmitDuplicateMatches"
                                        :key="`duplicate-${match.id}`"
                                        class="rounded-lg border border-amber-300 bg-white/80 p-3 shadow-sm"
                                    >
                                        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div class="min-w-0">
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <p class="font-semibold text-amber-950">{{ patientName(match) }}</p>
                                                    <Badge variant="outline" class="border-amber-300 bg-amber-100 text-amber-900">
                                                        {{ match.patientNumber || match.id.slice(0, 8) }}
                                                    </Badge>
                                                    <Badge :variant="statusVariant(match.status)" class="capitalize">
                                                        {{ match.status || 'unknown' }}
                                                    </Badge>
                                                </div>
                                                <p class="mt-1 text-xs text-amber-800">
                                                    Registered {{ formatDate(match.createdAt) || 'date not recorded' }}
                                                </p>
                                            </div>
                                            <Button size="sm" variant="outline" as-child class="h-8 shrink-0 gap-1.5 border-amber-300 bg-white">
                                                <Link
                                                    :href="`/patients?q=${encodeURIComponent(match.patientNumber || match.id)}`"
                                                    target="_blank"
                                                >
                                                    <AppIcon name="eye" class="size-3.5" />
                                                    {{ tW2('duplicate.viewExistingPatient') }}
                                                </Link>
                                            </Button>
                                        </div>

                                        <div class="mt-3 overflow-hidden rounded-md border border-amber-200 bg-white">
                                            <div class="grid grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_4rem] border-b border-amber-200 bg-amber-100/70 px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-amber-900">
                                                <span>Field</span>
                                                <span>New entry</span>
                                                <span>Existing</span>
                                                <span class="text-right">Match</span>
                                            </div>
                                            <div
                                                v-for="row in duplicateComparisonRows(match)"
                                                :key="`duplicate-${match.id}-${row.key}`"
                                                class="grid grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_4rem] gap-2 border-b border-amber-100 px-2 py-1.5 last:border-b-0"
                                            >
                                                <span class="font-medium text-amber-950">{{ row.label }}</span>
                                                <span class="min-w-0 truncate">{{ row.incoming }}</span>
                                                <span class="min-w-0 truncate">{{ row.existing }}</span>
                                                <span class="text-right">
                                                    <Badge
                                                        :variant="row.matched ? 'secondary' : 'outline'"
                                                        class="text-xs"
                                                    >
                                                        {{ row.matched ? 'Same' : 'Check' }}
                                                    </Badge>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <p class="text-xs text-amber-800">
                                        Continue only when the new entry is confirmed as a separate patient.
                                    </p>
                                    <div class="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        :disabled="createLoading"
                                        @click="clearPreSubmitDuplicateState"
                                    >
                                        {{ tW2('duplicate.reviewForm') }}
                                    </Button>
                                    <Button
                                        size="sm"
                                        :disabled="createLoading"
                                        @click="confirmCreateDespiteDuplicate"
                                    >
                                        {{ tW2('duplicate.confirmNewPatient') }}
                                    </Button>
                                    </div>
                                </div>
                            </AlertDescription>
                        </Alert>

                        <Alert v-if="preSubmitDuplicateCheckError" variant="default">
                            <AlertTitle>{{ tW2('duplicate.precheckUnavailable') }}</AlertTitle>
                            <AlertDescription>{{ preSubmitDuplicateCheckError }}</AlertDescription>
                        </Alert>

                        <div
                            v-if="registrationErrorSummary.length > 0"
                            ref="registrationErrorSummaryRef"
                            tabindex="-1"
                        >
                            <Alert variant="destructive">
                                <AlertTitle>{{ tW2('validation.summaryTitle') }}</AlertTitle>
                                <AlertDescription class="space-y-2">
                                    <p class="text-xs">{{ tW2('validation.summaryDescription') }}</p>
                                    <ul class="list-disc space-y-1 pl-4 text-xs">
                                        <li
                                            v-for="message in registrationErrorSummary"
                                            :key="`registration-error-${message}`"
                                        >
                                            {{ message }}
                                        </li>
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        </div>
                        <!-- Primary intake -->
                        <fieldset class="grid gap-4 rounded-lg border p-3">
                            <legend class="px-2 text-sm font-medium text-muted-foreground">Patient identity</legend>

                                <!-- Row 1: First name | Last name -->
                                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div class="grid gap-1.5">
                                        <Label for="patient-form-firstName" class="text-xs font-medium">
                                            First name <span class="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="patient-form-firstName"
                                            v-model="registrationForm.firstName"
                                            placeholder="First name"
                                            class="h-10"
                                            autocomplete="given-name"
                                        />
                                        <p v-if="fieldError('firstName')" class="text-xs text-destructive">{{ fieldError('firstName') }}</p>
                                    </div>
                                    <div class="grid gap-1.5">
                                        <Label for="patient-form-lastName" class="text-xs font-medium">
                                            Last name <span class="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="patient-form-lastName"
                                            v-model="registrationForm.lastName"
                                            placeholder="Last name"
                                            class="h-10"
                                            autocomplete="family-name"
                                        />
                                        <p v-if="fieldError('lastName')" class="text-xs text-destructive">{{ fieldError('lastName') }}</p>
                                    </div>
                                </div>

                                <!-- Row 2: Middle name | Gender | Country -->
                                <div class="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_190px_190px]">
                                    <div class="grid gap-1.5">
                                        <Label for="patient-form-middleName" class="text-xs font-medium text-muted-foreground">Middle name</Label>
                                        <Input
                                            id="patient-form-middleName"
                                            v-model="registrationForm.middleName"
                                            placeholder="Middle name if used"
                                            class="h-10"
                                            autocomplete="additional-name"
                                        />
                                    </div>
                                    <div class="grid gap-1.5">
                                        <Label for="patient-form-gender" class="text-xs font-medium">
                                            Gender <span class="text-destructive">*</span>
                                        </Label>
                                        <Select v-model="registrationForm.gender">
                                            <SelectTrigger class="h-10 w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem value="female">Female</SelectItem>
                                            <SelectItem value="male">Male</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                            <SelectItem value="unknown">Unknown</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p v-if="fieldError('gender')" class="text-xs text-destructive">{{ fieldError('gender') }}</p>
                                    </div>
                                    <div class="grid gap-1.5">
                                        <Label for="patient-form-countryCode" class="text-xs font-medium">
                                            Country <span class="text-destructive">*</span>
                                        </Label>
                                        <Select v-model="registrationForm.countryCode">
                                            <SelectTrigger class="h-10 w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem
                                                v-for="option in registrationCountryOptions"
                                                :key="`patient-country-${option.code}`"
                                                :value="option.code"
                                            >
                                                {{ option.name }}
                                            </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p v-if="fieldError('countryCode')" class="text-xs text-destructive">{{ fieldError('countryCode') }}</p>
                                    </div>
                                </div>

                        </fieldset>

                        <fieldset class="grid gap-4 rounded-lg border p-3">
                            <legend class="px-2 text-sm font-medium text-muted-foreground">Age and date of birth</legend>
                                <!-- Age / date of birth -->
                                <div class="grid gap-2">
                                    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <Label class="text-xs font-medium">
                                            Age / Date of birth <span class="text-destructive">*</span>
                                        </Label>
                                        <div class="inline-flex w-full rounded-md border bg-muted/40 p-0.5 sm:w-auto">
                                            <button
                                                type="button"
                                                class="flex-1 rounded px-2.5 py-1 text-xs font-medium transition sm:flex-none"
                                                :class="registrationBirthInputMode === 'estimated' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                                                :aria-pressed="registrationBirthInputMode === 'estimated'"
                                                @click="setRegistrationBirthInputMode('estimated')"
                                            >Estimated age</button>
                                            <button
                                                type="button"
                                                class="flex-1 rounded px-2.5 py-1 text-xs font-medium transition sm:flex-none"
                                                :class="registrationBirthInputMode === 'exact' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                                                :aria-pressed="registrationBirthInputMode === 'exact'"
                                                @click="setRegistrationBirthInputMode('exact')"
                                            >Exact date</button>
                                        </div>
                                    </div>

                                    <!-- Estimated mode: years + months side by side -->
                                    <div v-if="registrationBirthInputMode === 'estimated'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div class="grid gap-1.5">
                                            <Label for="patient-form-ageYears" class="text-xs font-medium">Years</Label>
                                            <Input
                                                id="patient-form-ageYears"
                                                v-model="registrationForm.ageYears"
                                                type="number"
                                                min="0"
                                                max="130"
                                                step="1"
                                                inputmode="numeric"
                                                placeholder="e.g. 45"
                                                class="h-10"
                                            />
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label for="patient-form-ageMonths" class="text-xs font-medium">Months</Label>
                                            <Input
                                                id="patient-form-ageMonths"
                                                v-model="registrationForm.ageMonths"
                                                type="number"
                                                min="0"
                                                max="11"
                                                step="1"
                                                inputmode="numeric"
                                                placeholder="e.g. 6"
                                                class="h-10"
                                            />
                                        </div>
                                    </div>

                                    <!-- Exact mode: date picker -->
                                    <Input
                                        v-else
                                        id="patient-form-dateOfBirth"
                                        v-model="registrationForm.dateOfBirth"
                                        type="date"
                                        class="h-10"
                                        autocomplete="bday"
                                    />

                                    <!-- Silent helper: estimated DOB or age preview -->
                                    <div class="rounded-md bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                                        <p v-if="registrationBirthInputMode === 'estimated' && registrationDerivedDateOfBirth">
                                            Estimated DOB: {{ formatDate(registrationDerivedDateOfBirth) }}
                                        </p>
                                        <p v-else-if="registrationBirthInputMode === 'estimated'">
                                            Enter years, months, or both. For infants, months only is fine.
                                        </p>
                                        <p v-else-if="registrationForm.dateOfBirth">
                                            Age: {{ formatAge(registrationForm.dateOfBirth) }}
                                        </p>
                                        <p v-else>Choose the exact date only when it is confirmed.</p>
                                    </div>
                                    <div class="space-y-0.5">
                                        <p v-if="fieldError('dateOfBirth')" class="text-xs text-destructive">{{ fieldError('dateOfBirth') }}</p>
                                        <p v-if="fieldError('ageYears')" class="text-xs text-destructive">{{ fieldError('ageYears') }}</p>
                                        <p v-if="fieldError('ageMonths')" class="text-xs text-destructive">{{ fieldError('ageMonths') }}</p>
                                    </div>
                                </div>

                        </fieldset>

                        <fieldset class="grid gap-4 rounded-lg border p-3">
                            <legend class="px-2 text-sm font-medium text-muted-foreground">Contact and address</legend>
                                <!-- Phone (primary contact) -->
                                <div class="grid gap-1.5">
                                    <Label for="patient-form-phone" class="text-xs font-medium">
                                        Phone <span class="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="patient-form-phone"
                                        v-model="registrationForm.phone"
                                        placeholder="Use international format when possible"
                                        class="h-10"
                                        autocomplete="tel"
                                    />
                                    <p v-if="fieldError('phone')" class="text-xs text-destructive">{{ fieldError('phone') }}</p>
                                </div>

                                <!-- Row 5: Region | District -->
                                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <SearchableSelectField
                                        input-id="patient-form-region"
                                        v-model="registrationForm.region"
                                        :label="registrationCountryUi.regionLabel"
                                        :options="registrationRegionOptions"
                                        :placeholder="registrationCountryUi.regionPlaceholder"
                                        :search-placeholder="`Search ${registrationCountryUi.regionLabel.toLowerCase()} or use a custom value`"
                                        :empty-text="`No ${registrationCountryUi.regionLabel.toLowerCase()} suggestion found.`"
                                        :error-message="fieldError('region')"
                                        :required="true"
                                        :allow-custom-value="true"
                                    />
                                    <SearchableSelectField
                                        input-id="patient-form-district"
                                        v-model="registrationForm.district"
                                        :label="registrationCountryUi.districtLabel"
                                        :options="registrationDistrictOptions"
                                        :placeholder="registrationDistrictPlaceholder"
                                        :search-placeholder="`Search ${registrationCountryUi.districtLabel.toLowerCase()} or use a custom value`"
                                        :helper-text="registrationDistrictHelperText"
                                        :empty-text="`No ${registrationCountryUi.districtLabel.toLowerCase()} suggestion found.`"
                                        :error-message="fieldError('district')"
                                        :required="true"
                                        :allow-custom-value="true"
                                        :disabled="!registrationForm.region.trim()"
                                    />
                                </div>

                                <!-- Row 6: Address full width -->
                                <div class="grid gap-1.5">
                                    <Label for="patient-form-addressLine" class="text-xs font-medium">
                                        {{ registrationCountryUi.addressLabel }} <span class="text-destructive">*</span>
                                    </Label>
                                    <Textarea
                                        id="patient-form-addressLine"
                                        v-model="registrationForm.addressLine"
                                        rows="2"
                                        :placeholder="registrationCountryUi.addressPlaceholder"
                                        autocomplete="street-address"
                                    />
                                    <p v-if="fieldError('addressLine')" class="text-xs text-destructive">{{ fieldError('addressLine') }}</p>
                                </div>

                        </fieldset>
                        <!-- Additional details (optional) -->
                        <Collapsible v-model:open="registerOptionalDetailsOpen">
                            <fieldset class="rounded-lg border border-dashed p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Additional details</legend>
                                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p class="flex items-center gap-1.5 text-sm font-medium">
                                                <AppIcon name="info" class="size-3.5" />
                                                {{ tW2('registration.additionalDetailsOptional') }}
                                            </p>
                                            <p class="mt-1 text-xs text-muted-foreground">
                                                Open only when those details are available.
                                            </p>
                                        </div>
                                        <CollapsibleTrigger as-child>
                                            <Button size="sm" variant="outline" class="shrink-0">
                                                {{ registerOptionalDetailsOpen ? tW2('common.hide') : tW2('common.show') }}
                                            </Button>
                                        </CollapsibleTrigger>
                                    </div>
                                <CollapsibleContent class="mt-3 border-t pt-3">
                                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div class="grid gap-1.5">
                                            <Label for="patient-form-nationalId" class="text-xs font-medium">National ID</Label>
                                            <Input
                                                id="patient-form-nationalId"
                                                v-model="registrationForm.nationalId"
                                                placeholder="National ID number"
                                            />
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label for="patient-form-email" class="text-xs font-medium">Email</Label>
                                            <Input
                                                id="patient-form-email"
                                                v-model="registrationForm.email"
                                                type="email"
                                                placeholder="patient@email.com"
                                            />
                                            <p v-if="fieldError('email')" class="text-xs text-destructive">
                                                {{ fieldError('email') }}
                                            </p>
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label for="patient-form-nextOfKinName" class="text-xs font-medium">
                                                Emergency contact name
                                            </Label>
                                            <Input
                                                id="patient-form-nextOfKinName"
                                                v-model="registrationForm.nextOfKinName"
                                                placeholder="Next of kin full name"
                                            />
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label for="patient-form-nextOfKinPhone" class="text-xs font-medium">
                                                Emergency contact phone
                                            </Label>
                                            <Input
                                                id="patient-form-nextOfKinPhone"
                                                v-model="registrationForm.nextOfKinPhone"
                                                placeholder="Use international format when possible"
                                            />
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </fieldset>
                        </Collapsible>
                    </div>
                </ScrollArea>

                <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                    <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p class="text-xs text-muted-foreground">
                            {{ registrationPatientNamePreview }} | {{ registrationRequiredReadiness.complete }}/{{ registrationRequiredReadiness.total }} required fields ready
                        </p>
                        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                            <Button
                                size="sm"
                                variant="outline"
                                :disabled="createLoading"
                                class="w-full sm:w-auto"
                                @click="registerDialogOpen = false"
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                :disabled="createLoading || preSubmitDuplicateCheckLoading"
                                class="h-8 w-full gap-1.5 px-3 sm:w-auto"
                                @click="createPatient"
                            >
                                <AppIcon name="plus" class="size-3.5" />
                                {{
                                    createLoading
                                        ? tW2('action.creating')
                                        : preSubmitDuplicateCheckLoading
                                          ? tW2('action.checkingDuplicates')
                                          : tW2('action.registerPatient')
                                }}
                            </Button>
                        </div>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>

            <!-- ================================================================== -->
            <!-- POST REGISTRATION ACTIONS                                          -->
            <!-- ================================================================== -->
            <Dialog
                :open="postRegistrationDialogOpen"
                @update:open="(open) => (open ? (postRegistrationDialogOpen = true) : closePostRegistrationDialog())"
            >
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle class="flex items-center gap-2">
                            <AppIcon name="check-circle" class="size-5 text-primary" />
                            Patient registered
                        </DialogTitle>
                        <DialogDescription v-if="postRegistrationPatient">
                            {{ patientName(postRegistrationPatient) }}
                            <template v-if="postRegistrationPatient.patientNumber">
                                | {{ postRegistrationPatient.patientNumber }}
                            </template>
                            is ready for the next front-desk workflow.
                        </DialogDescription>
                    </DialogHeader>

                    <div v-if="postRegistrationPatient" class="space-y-4">
                        <div class="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-3">
                            <div>
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Patient</p>
                                <p class="mt-1 truncate text-sm font-semibold">{{ patientName(postRegistrationPatient) }}</p>
                            </div>
                            <div>
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contact</p>
                                <p class="mt-1 truncate text-sm font-semibold">{{ postRegistrationPatient.phone || 'Not recorded' }}</p>
                            </div>
                            <div>
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</p>
                                <p class="mt-1 truncate text-sm font-semibold">{{ patientLocationLabel(postRegistrationPatient) }}</p>
                            </div>
                        </div>

                        <Alert v-if="createdWarnings.length > 0" class="border-amber-300 bg-amber-50">
                            <AlertTitle class="text-amber-900">Registration warning</AlertTitle>
                            <AlertDescription class="space-y-1 text-xs text-amber-900">
                                <p
                                    v-for="warning in createdWarnings"
                                    :key="`created-warning-${warning.code}-${warning.message ?? ''}`"
                                >
                                    {{ warning.message || warning.code }}
                                </p>
                            </AlertDescription>
                        </Alert>

                        <div class="rounded-lg border bg-background p-3">
                            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div class="space-y-1">
                                    <p class="text-sm font-semibold text-foreground">Start visit handoff</p>
                                    <p class="text-xs text-muted-foreground">
                                        Route the patient into OPD, emergency triage, walk-in lab or dispensary, billing, or chart review in one flow.
                                    </p>
                                </div>
                                <Button class="gap-1.5 sm:shrink-0" @click="openPatientVisitHandoff(postRegistrationPatient, 'post-registration')">
                                    <AppIcon name="clipboard-list" class="size-3.5" />
                                    Start Handoff
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter class="gap-2 sm:gap-0">
                        <Button variant="outline" @click="closePostRegistrationDialog">
                            Close
                        </Button>
                        <Button variant="secondary" class="gap-1.5" @click="registerAnotherPatient">
                            <AppIcon name="plus" class="size-3.5" />
                            Register Another
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            <!-- ================================================================== -->
            <!-- PATIENT VISIT HANDOFF                                              -->
            <!-- ================================================================== -->
            <Sheet
                :open="visitHandoffSheetOpen"
                @update:open="(open) => (open ? (visitHandoffSheetOpen = true) : closePatientVisitHandoff())"
            >
                <SheetContent side="right" variant="form" size="5xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader v-if="visitHandoffPatient" class="shrink-0 border-b px-6 py-4 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="clipboard-list" class="size-5 text-primary" />
                            Patient Visit Handoff
                        </SheetTitle>
                        <SheetDescription>
                            {{ visitHandoffSourceLabel }} workflow for {{ patientName(visitHandoffPatient) }}
                            <template v-if="visitHandoffPatient.patientNumber">
                                | {{ visitHandoffPatient.patientNumber }}
                            </template>
                        </SheetDescription>
                    </SheetHeader>

                    <div v-if="visitHandoffPatient" class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                        <div class="space-y-5">
                            <section class="rounded-lg border bg-muted/20 p-3">
                                <div class="grid gap-3 sm:grid-cols-3">
                                    <div>
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Patient</p>
                                        <p class="mt-1 truncate text-sm font-semibold text-foreground">{{ patientName(visitHandoffPatient) }}</p>
                                    </div>
                                    <div>
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contact</p>
                                        <p class="mt-1 truncate text-sm font-semibold text-foreground">{{ visitHandoffPatient.phone || 'Not recorded' }}</p>
                                    </div>
                                    <div>
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</p>
                                        <p class="mt-1 truncate text-sm font-semibold text-foreground">{{ patientLocationLabel(visitHandoffPatient) }}</p>
                                    </div>
                                </div>
                            </section>

                            <Alert v-if="visitHandoffPatient.status && visitHandoffPatient.status !== 'active'" variant="destructive">
                                <AlertTitle>Patient is not active</AlertTitle>
                                <AlertDescription>
                                    Reactivate or review this patient before starting a new appointment, triage, or billing workflow.
                                </AlertDescription>
                            </Alert>

                            <Alert v-if="visitHandoffError" variant="destructive">
                                <AlertTitle>Visit check unavailable</AlertTitle>
                                <AlertDescription>{{ visitHandoffError }}</AlertDescription>
                            </Alert>

                            <Alert v-if="visitHandoffActionError" variant="destructive">
                                <AlertTitle>Handoff action failed</AlertTitle>
                                <AlertDescription>{{ visitHandoffActionError }}</AlertDescription>
                            </Alert>

                            <section class="space-y-3">
                                <div class="flex items-center justify-between gap-3">
                                    <div>
                                        <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Current visit check</p>
                                        <p class="mt-1 text-sm text-muted-foreground">
                                            Confirm the patient does not already have an active outpatient visit before creating another one.
                                        </p>
                                    </div>
                                    <Badge variant="outline">{{ visitHandoffLoading ? 'Checking' : 'Ready' }}</Badge>
                                </div>

                                <div v-if="visitHandoffLoading" class="space-y-2">
                                    <Skeleton class="h-16 w-full" />
                                    <Skeleton class="h-16 w-full" />
                                </div>

                                <Alert v-else-if="visitHandoffActiveAppointment" class="border-amber-300 bg-amber-50">
                                    <AlertTitle class="text-amber-900">Active visit already exists</AlertTitle>
                                    <AlertDescription class="space-y-3 text-amber-900">
                                        <div class="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                                            <div>
                                                <p>
                                                    Use
                                                    {{ visitHandoffActiveAppointment.appointmentNumber || 'the current visit' }}
                                                    instead of opening a duplicate workflow.
                                                </p>
                                                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                                    <Badge variant="outline" class="border-amber-300 bg-white/70 text-amber-950">
                                                        {{ formatEnumLabel(visitHandoffActiveAppointment.status || 'active visit') }}
                                                    </Badge>
                                                    <span v-if="visitHandoffActiveAppointment.scheduledAt">
                                                        {{ formatDateTime(visitHandoffActiveAppointment.scheduledAt) }}
                                                    </span>
                                                    <span v-if="visitHandoffActiveAppointment.department">
                                                        {{ visitHandoffActiveAppointment.department }}
                                                    </span>
                                                </div>
                                            </div>
                                            <div class="flex flex-wrap gap-2 sm:justify-end">
                                                <Button
                                                    v-if="visitHandoffCanCheckIn"
                                                    size="sm"
                                                    class="gap-1.5"
                                                    :disabled="visitHandoffSubmitting"
                                                    @click="checkInVisitFromHandoff"
                                                >
                                                    <AppIcon name="calendar-clock" class="size-3.5" />
                                                    {{ visitHandoffSubmitting ? 'Checking in...' : 'Check in now' }}
                                                </Button>
                                                <Button
                                                    v-if="visitHandoffExistingVisitHref"
                                                    size="sm"
                                                    variant="outline"
                                                    as-child
                                                    class="gap-1.5 border-amber-300 bg-white/70 text-amber-950 hover:bg-white"
                                                >
                                                    <Link :href="visitHandoffExistingVisitHref">
                                                        <AppIcon name="arrow-up-right" class="size-3.5" />
                                                        Open visit
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                    </AlertDescription>
                                </Alert>

                                <div v-else class="rounded-lg border border-dashed bg-background px-3 py-3 text-sm text-muted-foreground">
                                    No active outpatient visit was found from the patient context available to this user.
                                </div>
                            </section>

                            <section class="space-y-3 border-t pt-5">
                                <div>
                                    <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Handoff route</p>
                                    <p class="mt-1 text-sm text-muted-foreground">
                                        Choose the operational lane that matches why the patient is at the facility now.
                                    </p>
                                </div>

                                <div class="flex flex-wrap gap-3">
                                    <button type="button" :class="visitHandoffModeButtonClass('outpatient')" @click="visitHandoffMode = 'outpatient'">
                                        <span class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                            <AppIcon name="calendar-clock" class="size-4" />
                                        </span>
                                        <span class="min-w-0 flex-1">
                                            <span class="flex items-center justify-between gap-2">
                                                <span class="text-sm font-semibold text-foreground">Outpatient visit</span>
                                                <Badge variant="secondary" class="text-xs">{{ visitHandoffModeBadge('outpatient') }}</Badge>
                                            </span>
                                            <span class="mt-1 block text-xs leading-5 text-muted-foreground">
                                                Standard OPD flow: appointment, arrival check-in, nurse triage, provider, orders, billing.
                                            </span>
                                        </span>
                                    </button>

                                    <button type="button" :class="visitHandoffModeButtonClass('emergency')" @click="visitHandoffMode = 'emergency'">
                                        <span class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                                            <AppIcon name="activity" class="size-4" />
                                        </span>
                                        <span class="min-w-0 flex-1">
                                            <span class="flex items-center justify-between gap-2">
                                                <span class="text-sm font-semibold text-foreground">Emergency triage</span>
                                                <Badge variant="outline" class="text-xs">{{ visitHandoffModeBadge('emergency') }}</Badge>
                                            </span>
                                            <span class="mt-1 block text-xs leading-5 text-muted-foreground">
                                                Use when the patient needs immediate assessment, stabilization, transfer, or admission routing.
                                            </span>
                                        </span>
                                    </button>

                                    <button type="button" :class="visitHandoffModeButtonClass('direct-services')" @click="visitHandoffMode = 'direct-services'">
                                        <span class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200">
                                            <AppIcon name="flask-conical" class="size-4" />
                                        </span>
                                        <span class="min-w-0 flex-1">
                                            <span class="flex items-center justify-between gap-2">
                                                <span class="text-sm font-semibold text-foreground">Direct services</span>
                                                <Badge variant="outline" class="text-xs">{{ visitHandoffModeBadge('direct-services') }}</Badge>
                                            </span>
                                            <span class="mt-1 block text-xs leading-5 text-muted-foreground">
                                                Walk-in lab, imaging, or pharmacy without booking OPD—queue a ticket or open the department workspace when your login allows it.
                                            </span>
                                        </span>
                                    </button>

                                    <button type="button" :class="visitHandoffModeButtonClass('billing')" @click="visitHandoffMode = 'billing'">
                                        <span class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700">
                                            <AppIcon name="receipt" class="size-4" />
                                        </span>
                                        <span class="min-w-0 flex-1">
                                            <span class="flex items-center justify-between gap-2">
                                                <span class="text-sm font-semibold text-foreground">Billing first</span>
                                                <Badge variant="outline" class="text-xs">{{ visitHandoffModeBadge('billing') }}</Badge>
                                            </span>
                                            <span class="mt-1 block text-xs leading-5 text-muted-foreground">
                                                For registration fees, deposits, cashier instructions, or patient-share collection.
                                            </span>
                                        </span>
                                    </button>

                                    <button type="button" :class="visitHandoffModeButtonClass('chart')" @click="visitHandoffMode = 'chart'">
                                        <span class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                            <AppIcon name="book-open" class="size-4" />
                                        </span>
                                        <span class="min-w-0 flex-1">
                                            <span class="flex items-center justify-between gap-2">
                                                <span class="text-sm font-semibold text-foreground">Chart only</span>
                                                <Badge variant="outline" class="text-xs">{{ visitHandoffModeBadge('chart') }}</Badge>
                                            </span>
                                            <span class="mt-1 block text-xs leading-5 text-muted-foreground">
                                                Review patient context without creating a new visit or financial workflow.
                                            </span>
                                        </span>
                                    </button>
                                </div>
                            </section>

                            <section class="rounded-lg border bg-muted/20 p-4">
                                <Alert
                                    v-if="visitHandoffEmergencyNeedsTriageStaff"
                                    class="mb-4 border-sky-200 bg-sky-50/90 text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-50"
                                >
                                    <AlertTitle class="flex items-center gap-2 text-base text-sky-950 dark:text-sky-50">
                                        <AppIcon name="heart-pulse" class="size-4 shrink-0 text-sky-700 dark:text-sky-300" />
                                        Hand off to emergency triage
                                    </AlertTitle>
                                    <AlertDescription class="space-y-3 text-sm text-sky-900/95 dark:text-sky-100/90">
                                        <p>
                                            Front desk staff register and direct patients.
                                            <span class="font-medium">Starting urgent intake in the system</span>
                                            is usually done by triage or emergency staff. That split of duties is normal for registration roles.
                                        </p>
                                        <p class="text-xs leading-relaxed">
                                            Direct the patient to the emergency or triage area, then send the link below to a colleague who can open Emergency Triage.
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            class="border-sky-300 bg-white/90 text-sky-950 hover:bg-white dark:border-sky-700 dark:bg-sky-900/60 dark:text-sky-50 dark:hover:bg-sky-900"
                                            @click="copyVisitHandoffEmergencyTriageLink"
                                        >
                                            <AppIcon name="arrow-up-right" class="size-3.5" />
                                            Copy link for triage desk
                                        </Button>
                                    </AlertDescription>
                                </Alert>

                                <template v-if="visitHandoffMode === 'direct-services'">
                                    <div class="space-y-4">
                                        <p class="max-w-xl text-sm leading-relaxed text-muted-foreground">
                                            {{ visitHandoffPrimaryDescription }}
                                        </p>

                                        <div
                                            v-if="
                                                visitHandoffCanUseDirectServicesRoute
                                                && !visitHandoffHasAnyDirectServiceRight
                                                && canCreateServiceRequests
                                            "
                                            class="space-y-2"
                                        >
                                            <div class="flex flex-wrap gap-2">
                                                <Button
                                                    v-for="service in [
                                                        { key: 'laboratory', label: 'Lab', icon: 'flask-conical' },
                                                        { key: 'radiology', label: 'Imaging', icon: 'activity' },
                                                        { key: 'pharmacy', label: 'Pharmacy', icon: 'pill' },
                                                        { key: 'theatre_procedure', label: 'Procedure', icon: 'scissors' },
                                                    ] as const"
                                                    :key="service.key"
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    :disabled="
                                                        directServiceSending !== null
                                                        || !!directServiceSentMap[`${visitHandoffPatient?.id}:${service.key}`]
                                                    "
                                                    :class="[
                                                        'border-border bg-background',
                                                        directServiceSentMap[`${visitHandoffPatient?.id}:${service.key}`]
                                                            ? 'opacity-60 cursor-default'
                                                            : '',
                                                    ]"
                                                    @click="createDirectServiceRequest(service.key)"
                                                >
                                                    <AppIcon
                                                        v-if="directServiceSending !== service.key"
                                                        :name="
                                                            directServiceSentMap[`${visitHandoffPatient?.id}:${service.key}`]
                                                                ? 'check-circle'
                                                                : service.icon
                                                        "
                                                        class="size-3.5"
                                                    />
                                                    <AppIcon v-else name="loader-circle" class="size-3.5 animate-spin" />
                                                    {{
                                                        directServiceSentMap[`${visitHandoffPatient?.id}:${service.key}`]
                                                            ? `${service.label} ✓`
                                                            : `Send to ${service.label}`
                                                    }}
                                                </Button>
                                            </div>
                                            <p
                                                v-if="visitHandoffDirectServiceSessionTickets.length > 0"
                                                class="text-xs text-muted-foreground"
                                                role="status"
                                                aria-live="polite"
                                            >
                                                <span class="font-medium text-foreground">Tickets:</span>
                                                {{
                                                    visitHandoffDirectServiceSessionTickets
                                                        .map((row) => `${row.label} ${row.requestNumber}`)
                                                        .join(' · ')
                                                }}
                                            </p>
                                            <div
                                                v-if="visitHandoffDirectServiceSessionTickets.length > 0"
                                                class="flex flex-wrap gap-2"
                                            >
                                                <Button
                                                    v-for="ticket in visitHandoffDirectServiceSessionTickets"
                                                    :key="`copy-${ticket.key}`"
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    class="h-7 gap-1.5 text-xs"
                                                    @click="copyDirectServiceTicket(ticket)"
                                                >
                                                    <AppIcon name="copy" class="size-3.5" />
                                                    Copy {{ ticket.label }} ticket
                                                </Button>
                                                <Button
                                                    v-for="ticket in visitHandoffDirectServiceSessionTickets"
                                                    :key="`queue-${ticket.key}`"
                                                    size="sm"
                                                    variant="outline"
                                                    as-child
                                                    class="h-7 gap-1.5 text-xs"
                                                >
                                                    <Link :href="directServiceQueueHref(ticket.key)">
                                                        <AppIcon name="list-checks" class="size-3.5" />
                                                        Open {{ ticket.label }} queue
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>

                                        <!-- Ordering staff: direct workspace links -->
                                        <div
                                            v-if="visitHandoffHasAnyDirectServiceRight"
                                            class="grid gap-2 sm:grid-cols-2"
                                        >
                                            <Button
                                                v-if="canCreateLaboratoryOrders"
                                                size="sm"
                                                variant="secondary"
                                                as-child
                                                class="justify-start gap-1.5"
                                            >
                                                <Link :href="patientContextHref('/laboratory-orders', visitHandoffPatient, { includeTabNew: true })">
                                                    <AppIcon name="flask-conical" class="size-3.5" />
                                                    Laboratory
                                                </Link>
                                            </Button>
                                            <Button
                                                v-if="canCreateRadiologyOrders"
                                                size="sm"
                                                variant="secondary"
                                                as-child
                                                class="justify-start gap-1.5"
                                            >
                                                <Link :href="patientContextHref('/radiology-orders', visitHandoffPatient, { includeTabNew: true })">
                                                    <AppIcon name="activity" class="size-3.5" />
                                                    Imaging / radiology
                                                </Link>
                                            </Button>
                                            <Button
                                                v-if="canCreatePharmacyOrders"
                                                size="sm"
                                                variant="secondary"
                                                as-child
                                                class="justify-start gap-1.5"
                                            >
                                                <Link :href="patientContextHref('/pharmacy-orders', visitHandoffPatient, { includeTabNew: true })">
                                                    <AppIcon name="pill" class="size-3.5" />
                                                    Pharmacy / dispensary
                                                </Link>
                                            </Button>
                                            <Button
                                                v-if="canCreateTheatreProcedures"
                                                size="sm"
                                                variant="secondary"
                                                as-child
                                                class="justify-start gap-1.5"
                                            >
                                                <Link :href="patientContextHref('/theatre-procedures', visitHandoffPatient, { includeTabNew: true })">
                                                    <AppIcon name="scissors" class="size-3.5" />
                                                    Procedure
                                                </Link>
                                            </Button>
                                            <Button
                                                v-if="canCreateBillingInvoices"
                                                size="sm"
                                                variant="secondary"
                                                as-child
                                                class="justify-start gap-1.5"
                                            >
                                                <Link :href="patientTimelineHref('/billing-invoices', visitHandoffPatient.id, { appointmentId: visitHandoffActiveAppointment?.id ?? null })">
                                                    <AppIcon name="receipt" class="size-3.5" />
                                                    Invoice / billing
                                                </Link>
                                            </Button>
                                        </div>

                                        <div v-if="canReadPatients" class="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                                            <Button size="sm" variant="outline" as-child class="gap-1.5">
                                                <Link :href="patientChartContextHref(visitHandoffPatient, { from: 'patients' })">
                                                    <AppIcon name="book-open" class="size-3.5" />
                                                    Open patient chart
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                </template>

                                <div
                                    v-else
                                    class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                                >
                                    <div class="space-y-1">
                                        <p class="text-sm font-semibold text-foreground">{{ visitHandoffPrimaryLabel }}</p>
                                        <p class="max-w-xl text-xs leading-5 text-muted-foreground">{{ visitHandoffPrimaryDescription }}</p>
                                        <p
                                            v-if="visitHandoffPrimaryDisabledReason"
                                            class="text-xs font-medium leading-relaxed text-muted-foreground"
                                        >
                                            {{ visitHandoffPrimaryDisabledReason }}
                                        </p>
                                    </div>
                                    <Button
                                        v-if="visitHandoffCanCheckIn && !visitHandoffPrimaryDisabledReason"
                                        class="gap-1.5 sm:shrink-0"
                                        :disabled="visitHandoffSubmitting"
                                        @click="checkInVisitFromHandoff"
                                    >
                                        <AppIcon :name="visitHandoffPrimaryIcon" class="size-3.5" />
                                        {{ visitHandoffSubmitting ? 'Checking in...' : visitHandoffPrimaryLabel }}
                                    </Button>
                                    <Button
                                        v-else-if="visitHandoffPrimaryHref && !visitHandoffPrimaryDisabledReason"
                                        as-child
                                        class="gap-1.5 sm:shrink-0"
                                    >
                                        <Link :href="visitHandoffPrimaryHref">
                                            <AppIcon :name="visitHandoffPrimaryIcon" class="size-3.5" />
                                            {{ visitHandoffPrimaryLabel }}
                                        </Link>
                                    </Button>
                                    <Button v-else disabled class="gap-1.5 sm:shrink-0">
                                        <AppIcon :name="visitHandoffPrimaryIcon" class="size-3.5" />
                                        {{ visitHandoffPrimaryLabel }}
                                    </Button>
                                </div>
                            </section>
                        </div>
                    </div>

                    <SheetFooter class="shrink-0 border-t px-6 py-4">
                        <Button variant="outline" @click="closePatientVisitHandoff">Close</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>


            <!-- ================================================================== -->
            <!-- PATIENT DETAILS SHEET                                             -->
            <!-- ================================================================== -->
            <Sheet
                :open="detailsSheetOpen"
                @update:open="(open) => (open ? (detailsSheetOpen = true) : closePatientDetailsSheet())"
            >
                <SheetContent
                    side="right"
                    variant="workspace"
                    size="5xl"
                    class="flex h-full min-h-0 flex-col"
                >
                    <SheetHeader v-if="detailsSheetPatient" class="shrink-0 border-b bg-background px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex min-w-0 flex-wrap items-center gap-2">
                            <AppIcon name="user" class="size-5 text-muted-foreground" />
                            <span class="min-w-0 truncate">{{ patientName(detailsSheetPatient) }}</span>
                            <Badge v-if="detailsSheetPatient.patientNumber" variant="outline" class="shrink-0 font-normal">
                                {{ detailsSheetPatient.patientNumber }}
                            </Badge>
                            <Badge :variant="statusVariant(detailsSheetPatient.status)" class="shrink-0 capitalize">
                                {{ detailsSheetPatient.status || 'unknown' }}
                            </Badge>
                        </SheetTitle>
                        <SheetDescription>
                            {{ detailsSheetPatient.gender ? detailsSheetPatient.gender : 'Gender not recorded' }}
                            |
                            {{ detailsSheetPatient.dateOfBirth ? `Age ${formatAge(detailsSheetPatient.dateOfBirth)}` : 'Age not recorded' }}
                            |
                            {{ patientLocationLabel(detailsSheetPatient) }}
                        </SheetDescription>
                    </SheetHeader>

                    <div v-if="detailsSheetPatient" class="min-h-0 flex flex-1 flex-col overflow-hidden">
                        <Tabs v-model="detailsSheetTab" class="flex h-full min-h-0 flex-col">
                            <div class="shrink-0 border-b bg-muted/5 px-4 py-2.5">
                                <div class="space-y-4">
                                    <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                        <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-2">
                                            <div class="flex items-start gap-3">
                                                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/20">
                                                    {{ patientInitials(detailsSheetPatient) }}
                                                </div>
                                                <div class="min-w-0">
                                                    <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Patient</p>
                                                    <p class="mt-0.5 truncate text-sm font-semibold leading-4">{{ patientName(detailsSheetPatient) }}</p>
                                                    <p class="truncate text-xs leading-4 text-muted-foreground">
                                                        {{ detailsSheetPatient.patientNumber || `ID: ${detailsSheetPatient.id.slice(0, 8)}` }}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-2">
                                            <div class="flex items-center justify-between gap-2">
                                                <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Contact</p>
                                                <Badge variant="outline" class="capitalize">{{ detailsSheetPatient.gender || 'Unknown' }}</Badge>
                                            </div>
                                            <p class="mt-0.5 truncate text-sm font-semibold leading-4">{{ detailsSheetPatient.phone || 'Phone not recorded' }}</p>
                                            <p class="truncate text-xs leading-4 text-muted-foreground">{{ patientLocationLabel(detailsSheetPatient) }}</p>
                                        </div>
                                        <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-2">
                                            <div class="flex items-center justify-between gap-2">
                                                <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Care activity</p>
                                                <Badge variant="secondary">{{ detailsTimelineEvents.length }} events</Badge>
                                            </div>
                                            <p class="mt-0.5 truncate text-sm font-semibold leading-4">
                                                {{ detailsWorkflowRecommendation?.title ?? 'Review patient workflow' }}
                                            </p>
                                            <p class="truncate text-xs leading-4 text-muted-foreground">
                                                {{ detailsSheetPatient.dateOfBirth ? `Age ${formatAge(detailsSheetPatient.dateOfBirth)}` : 'Age not recorded' }}
                                            </p>
                                        </div>
                                    </div>

                                    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <TabsList class="flex h-auto w-full flex-wrap justify-start gap-2 rounded-lg bg-transparent p-0 lg:w-auto">
                                            <TabsTrigger value="overview" class="gap-1.5 rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">
                                                <AppIcon name="layout-grid" class="size-3.5" />
                                                Overview
                                            </TabsTrigger>
                                            <TabsTrigger value="activity" class="gap-1.5 rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">
                                                <AppIcon name="activity" class="size-3.5" />
                                                Activity
                                            </TabsTrigger>
                                            <TabsTrigger v-if="canViewPatientAudit" value="audit" class="gap-1.5 rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">
                                                <AppIcon name="file-text" class="size-3.5" />
                                                Audit
                                                <Badge
                                                    v-if="detailsAuditMeta"
                                                    variant="secondary"
                                                    class="h-4 min-w-4 px-1 text-xs"
                                                >
                                                    {{ detailsAuditMeta.total }}
                                                </Badge>
                                            </TabsTrigger>
                                        </TabsList>

                                        <div class="flex flex-wrap gap-2">
                                            <Button
                                                v-if="canUpdatePatients"
                                                size="sm"
                                                variant="outline"
                                                class="h-8 gap-1.5 text-xs"
                                                @click="openEditSheet(detailsSheetPatient)"
                                            >
                                                <AppIcon name="pencil" class="size-3.5" />
                                                Edit Demographics
                                            </Button>
                                            <Button
                                                v-if="canUpdatePatientStatus"
                                                size="sm"
                                                :variant="detailsSheetPatient.status === 'active' ? 'ghost' : 'secondary'"
                                                class="h-8 gap-1.5 text-xs"
                                                @click="openStatusDialog(detailsSheetPatient)"
                                            >
                                                <AppIcon
                                                    :name="detailsSheetPatient.status === 'active' ? 'user-x' : 'user-check'"
                                                    class="size-3.5"
                                                />
                                                {{ detailsSheetPatient.status === 'active' ? 'Deactivate' : 'Activate' }}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">

                                    <!-- OVERVIEW TAB -->
                                    <TabsContent value="overview" class="m-0 space-y-3 px-6 py-4">
                                        <!-- Status reason banner (shown when inactive/deactivated) -->
                                        <div
                                            v-if="detailsSheetPatient.status && detailsSheetPatient.status !== 'active' && detailsSheetPatient.statusReason"
                                            class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs dark:border-amber-800 dark:bg-amber-950"
                                        >
                                            <AppIcon name="alert-triangle" class="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                            <span class="text-amber-800 dark:text-amber-200">
                                                <span class="font-semibold capitalize">{{ detailsSheetPatient.status }}</span>:
                                                {{ detailsSheetPatient.statusReason }}
                                            </span>
                                        </div>

                                        <!-- Identity & Contact -->
                                        <div class="grid gap-3 sm:grid-cols-2">
                                            <Card class="rounded-lg !gap-0 overflow-hidden">
                                                <CardHeader class="bg-muted/40 px-4 py-2.5">
                                                    <CardTitle class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                        <AppIcon name="user" class="size-3.5" />
                                                        Identity
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent class="divide-y px-4 pb-3 pt-0 text-sm">
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Gender</span>
                                                        <span class="font-medium capitalize">{{ detailsSheetPatient.gender || 'Not recorded' }}</span>
                                                    </div>
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Date of birth</span>
                                                        <span class="font-medium">
                                                            {{ formatDate(detailsSheetPatient.dateOfBirth) || 'Not recorded' }}
                                                            <span v-if="detailsSheetPatient.dateOfBirth" class="ml-1 text-xs text-muted-foreground">
                                                                ({{ formatAge(detailsSheetPatient.dateOfBirth) }})
                                                            </span>
                                                        </span>
                                                    </div>
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">National ID</span>
                                                        <span class="font-mono text-xs font-medium">{{ detailsSheetPatient.nationalId || 'Not recorded' }}</span>
                                                    </div>
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Registered</span>
                                                        <span class="font-medium">{{ formatDate(detailsSheetPatient.createdAt) || 'Not recorded' }}</span>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card class="rounded-lg !gap-0 overflow-hidden">
                                                <CardHeader class="bg-muted/40 px-4 py-2.5">
                                                    <CardTitle class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                        <AppIcon name="phone" class="size-3.5" />
                                                        Contact
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent class="divide-y px-4 pb-3 pt-0 text-sm">
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Phone</span>
                                                        <span class="font-medium">{{ detailsSheetPatient.phone || 'Not recorded' }}</span>
                                                    </div>
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Email</span>
                                                        <span class="max-w-[14rem] truncate text-right font-medium">{{ detailsSheetPatient.email || 'Not recorded' }}</span>
                                                    </div>
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="shrink-0 text-muted-foreground">Address</span>
                                                        <span class="text-right font-medium">{{ detailsSheetPatient.addressLine || 'Not recorded' }}</span>
                                                    </div>
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="shrink-0 text-muted-foreground">Location</span>
                                                        <span class="text-right font-medium">{{ patientLocationLabel(detailsSheetPatient) }}</span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        <!-- Emergency Contact -->
                                        <Card class="rounded-lg !gap-0 overflow-hidden">
                                            <CardHeader class="bg-muted/40 px-4 py-2.5">
                                                <CardTitle class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    <AppIcon name="users" class="size-3.5" />
                                                    Emergency Contact
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="grid gap-0 divide-y px-4 pb-3 pt-0 text-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                                                <div class="flex items-center justify-between gap-4 py-2 sm:pr-4">
                                                    <span class="shrink-0 text-muted-foreground">Name</span>
                                                    <span class="text-right font-medium">{{ detailsSheetPatient.nextOfKinName || 'Not recorded' }}</span>
                                                </div>
                                                <div class="flex items-center justify-between gap-4 py-2 sm:pl-4">
                                                    <span class="shrink-0 text-muted-foreground">Phone</span>
                                                    <span class="font-medium">{{ detailsSheetPatient.nextOfKinPhone || 'Not recorded' }}</span>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card v-if="canReadPatientInsurance" class="rounded-lg !gap-0 overflow-hidden">
                                            <CardHeader class="bg-muted/40 px-4 py-2.5">
                                                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                    <div>
                                                        <CardTitle class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                            <AppIcon name="shield-check" class="size-3.5" />
                                                            Insurance Coverage
                                                        </CardTitle>
                                                        <CardDescription class="mt-1 text-xs">
                                                            Patient policy, member, verification, and payer contract mapping.
                                                        </CardDescription>
                                                    </div>
                                                    <Button
                                                        v-if="canManagePatientInsurance"
                                                        size="sm"
                                                        variant="outline"
                                                        class="h-8 gap-1.5 text-xs"
                                                        @click="insuranceFormOpen = !insuranceFormOpen"
                                                    >
                                                        <AppIcon :name="insuranceFormOpen ? 'x' : 'plus'" class="size-3.5" />
                                                        {{ insuranceFormOpen ? 'Close' : 'Add Insurance' }}
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-3 px-4 py-3">
                                                <Alert v-if="detailsInsuranceError" variant="destructive">
                                                    <AlertTitle>Insurance unavailable</AlertTitle>
                                                    <AlertDescription>{{ detailsInsuranceError }}</AlertDescription>
                                                </Alert>

                                                <div v-if="detailsInsuranceLoading" class="space-y-2">
                                                    <Skeleton class="h-16 w-full" />
                                                    <Skeleton class="h-16 w-full" />
                                                </div>

                                                <div
                                                    v-else-if="detailsInsuranceRecords.length === 0"
                                                    class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
                                                >
                                                    No insurance record is linked to this patient yet.
                                                </div>

                                                <div v-else class="space-y-2">
                                                    <div
                                                        v-for="record in detailsInsuranceRecords"
                                                        :key="record.id"
                                                        class="rounded-lg border bg-background p-3"
                                                    >
                                                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                            <div class="min-w-0">
                                                                <div class="flex flex-wrap items-center gap-2">
                                                                    <p class="font-medium text-sm">
                                                                        {{ record.insuranceProvider || 'Insurance provider' }}
                                                                    </p>
                                                                    <Badge :variant="record.status === 'active' ? 'secondary' : 'outline'" class="capitalize">
                                                                        {{ record.status || 'unknown' }}
                                                                    </Badge>
                                                                    <Badge
                                                                        :variant="record.verificationStatus === 'verified' ? 'secondary' : 'outline'"
                                                                        class="capitalize"
                                                                    >
                                                                        {{ record.verificationStatus || 'unverified' }}
                                                                    </Badge>
                                                                </div>
                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                    {{ record.planName || 'Plan not recorded' }}
                                                                    <span v-if="record.memberId"> · Member {{ record.memberId }}</span>
                                                                    <span v-if="record.cardNumber"> · Card {{ record.cardNumber }}</span>
                                                                </p>
                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                    Policy {{ record.policyNumber || 'not recorded' }}
                                                                    <span v-if="record.expiryDate"> · Expires {{ formatDate(record.expiryDate) }}</span>
                                                                </p>
                                                            </div>
                                                            <Button
                                                                v-if="canVerifyPatientInsurance && record.verificationStatus !== 'verified'"
                                                                size="sm"
                                                                variant="outline"
                                                                class="h-8 gap-1.5 text-xs"
                                                                :disabled="detailsInsuranceSaving"
                                                                @click="verifyPatientInsurance(record)"
                                                            >
                                                                <AppIcon name="badge-check" class="size-3.5" />
                                                                Mark verified
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div v-if="activePatientInsuranceRecord" class="rounded-lg border bg-primary/5 p-3 text-xs text-muted-foreground">
                                                    Active coverage routes billing to
                                                    <span class="font-medium text-foreground">
                                                        {{ activePatientInsuranceRecord.insuranceProvider || 'the mapped payer' }}
                                                    </span>
                                                    when a valid payer contract is configured.
                                                </div>

                                                <div v-if="insuranceFormOpen && canManagePatientInsurance" class="rounded-lg border bg-muted/20 p-3">
                                                    <div class="grid gap-3 md:grid-cols-2">
                                                        <div class="space-y-1.5">
                                                            <Label>Provider preset</Label>
                                                            <Select
                                                                :model-value="insuranceForm.providerCode || undefined"
                                                                :disabled="detailsInsuranceOptionsLoading"
                                                                @update:model-value="applyInsuranceProviderPreset(String($event || ''))"
                                                            >
                                                                <SelectTrigger class="w-full">
                                                                    <SelectValue placeholder="Select provider" />
                                                                </SelectTrigger>
                                                                <SelectContent class="z-[80]">
                                                                    <SelectItem
                                                                        v-for="preset in patientInsuranceProviderPresets"
                                                                        :key="preset.code"
                                                                        :value="preset.code"
                                                                    >
                                                                        {{ preset.name }}
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div class="space-y-1.5">
                                                            <Label>Payer contract</Label>
                                                            <Select
                                                                :model-value="insuranceForm.billingPayerContractId || SELECT_NONE_VALUE"
                                                                :disabled="detailsInsuranceOptionsLoading"
                                                                @update:model-value="applyInsurancePayerContract(String($event) === SELECT_NONE_VALUE ? '' : String($event || ''))"
                                                            >
                                                                <SelectTrigger class="w-full">
                                                                    <SelectValue placeholder="Link payer contract" />
                                                                </SelectTrigger>
                                                                <SelectContent class="z-[80]">
                                                                    <SelectItem :value="SELECT_NONE_VALUE">No contract selected</SelectItem>
                                                                    <SelectItem
                                                                        v-for="contract in patientInsurancePayerContracts"
                                                                        :key="contract.id"
                                                                        :value="contract.id"
                                                                    >
                                                                        {{ contract.payerName || contract.contractName || contract.contractCode }}
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div class="space-y-1.5">
                                                            <Label>Provider name</Label>
                                                            <Input v-model="insuranceForm.insuranceProvider" placeholder="NHIF, UHI, private insurer" />
                                                        </div>
                                                        <div class="space-y-1.5">
                                                            <Label>Plan name</Label>
                                                            <Input v-model="insuranceForm.planName" placeholder="Optional plan name" />
                                                        </div>
                                                        <div class="space-y-1.5">
                                                            <Label>Member ID</Label>
                                                            <Input v-model="insuranceForm.memberId" placeholder="Member or beneficiary ID" />
                                                        </div>
                                                        <div class="space-y-1.5">
                                                            <Label>Card number</Label>
                                                            <Input v-model="insuranceForm.cardNumber" placeholder="Insurance card number" />
                                                        </div>
                                                        <div class="space-y-1.5">
                                                            <Label>Policy number</Label>
                                                            <Input v-model="insuranceForm.policyNumber" placeholder="Policy number" />
                                                        </div>
                                                        <div class="space-y-1.5">
                                                            <Label>Verification reference</Label>
                                                            <Input v-model="insuranceForm.verificationReference" placeholder="Verification or approval reference" />
                                                        </div>
                                                        <div class="space-y-1.5">
                                                            <Label>Effective date</Label>
                                                            <Input v-model="insuranceForm.effectiveDate" type="date" />
                                                        </div>
                                                        <div class="space-y-1.5">
                                                            <Label>Expiry date</Label>
                                                            <Input v-model="insuranceForm.expiryDate" type="date" />
                                                        </div>
                                                    </div>
                                                    <div class="mt-3 flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            :disabled="detailsInsuranceSaving"
                                                            @click="resetInsuranceForm"
                                                        >
                                                            Reset
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            class="gap-1.5"
                                                            :disabled="detailsInsuranceSaving || !insuranceForm.insuranceProvider.trim() || !insuranceForm.memberId.trim()"
                                                            @click="submitPatientInsurance"
                                                        >
                                                            <AppIcon name="save" class="size-3.5" />
                                                            Save insurance
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <!-- ACTIVITY TAB -->
                                    <TabsContent value="activity" class="m-0 space-y-4 px-6 py-4">
                                        <section class="grid gap-3 rounded-lg border p-3">
                                            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                <div class="space-y-1">
                                                    <p class="flex items-center gap-2 text-sm font-medium">
                                                        <AppIcon name="clipboard-list" class="size-4 text-muted-foreground" />
                                                        Continue care workflow
                                                    </p>
                                                    <p class="max-w-2xl text-xs text-muted-foreground">
                                                        Recommended action is calculated from the patient record and current clinical activity.
                                                    </p>
                                                </div>
                                                <div class="flex shrink-0">
                                                    <Button size="sm" class="gap-1.5" @click="openPatientVisitHandoff(detailsSheetPatient, 'details')">
                                                        <AppIcon name="clipboard-list" class="size-3.5" />
                                                        Continue handoff
                                                    </Button>
                                                </div>
                                            </div>

                                            <Alert v-if="detailsSheetPatient.status && detailsSheetPatient.status !== 'active'" variant="destructive">
                                                <AlertTitle>Patient is not active</AlertTitle>
                                                <AlertDescription>
                                                    Reactivate or review status before starting a new appointment, triage, or consultation.
                                                </AlertDescription>
                                            </Alert>

                                            <div class="rounded-lg border bg-muted/20 p-3">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    Recommended next step
                                                </p>
                                                <p class="mt-1 text-sm font-medium text-foreground">
                                                    {{ detailsWorkflowRecommendation?.title ?? 'Review patient workflow' }}
                                                </p>
                                                <p class="mt-1 text-xs text-muted-foreground">
                                                    {{
                                                        detailsWorkflowRecommendation?.description
                                                            ?? 'Review the current visit state before continuing care.'
                                                    }}
                                                </p>
                                            </div>

                                            <div class="grid gap-3 lg:grid-cols-2">
                                                <div class="rounded-lg border p-3">
                                                    <p class="text-sm font-medium text-foreground">Front desk and urgent care</p>
                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                        Use triage for unstable walk-ins. Use the chart for context before opening a new visit workflow.
                                                    </p>
                                                    <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                                        <Button size="sm" variant="secondary" as-child class="justify-start gap-1.5">
                                                            <Link :href="patientContextHref('/emergency-triage', detailsSheetPatient, { includeTabNew: true })">
                                                                <AppIcon name="activity" class="size-3.5" />
                                                                Start Triage
                                                            </Link>
                                                        </Button>
                                                        <Button size="sm" variant="secondary" as-child class="justify-start gap-1.5">
                                                            <Link :href="patientChartContextHref(detailsSheetPatient, { from: 'patients' })">
                                                                <AppIcon name="book-open" class="size-3.5" />
                                                                Open Chart
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div class="rounded-lg border p-3">
                                                    <p class="text-sm font-medium text-foreground">Orders and billing</p>
                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                        Lab, imaging, pharmacy, procedures, or billing with this patient—including walk-ins without a consult when your site allows.
                                                    </p>
                                                    <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                                        <Button v-if="canCreateLaboratoryOrders" size="sm" variant="secondary" as-child class="justify-start gap-1.5">
                                                            <Link :href="patientContextHref('/laboratory-orders', detailsSheetPatient, { includeTabNew: true })">
                                                                <AppIcon name="flask-conical" class="size-3.5" />
                                                                Lab Order
                                                            </Link>
                                                        </Button>
                                                        <Button v-if="canCreateRadiologyOrders" size="sm" variant="secondary" as-child class="justify-start gap-1.5">
                                                            <Link :href="patientContextHref('/radiology-orders', detailsSheetPatient, { includeTabNew: true })">
                                                                <AppIcon name="activity" class="size-3.5" />
                                                                Imaging Order
                                                            </Link>
                                                        </Button>
                                                        <Button v-if="canCreatePharmacyOrders" size="sm" variant="secondary" as-child class="justify-start gap-1.5">
                                                            <Link :href="patientContextHref('/pharmacy-orders', detailsSheetPatient, { includeTabNew: true })">
                                                                <AppIcon name="pill" class="size-3.5" />
                                                                Pharmacy Order
                                                            </Link>
                                                        </Button>
                                                        <Button v-if="canCreateTheatreProcedures" size="sm" variant="secondary" as-child class="justify-start gap-1.5">
                                                            <Link :href="patientContextHref('/theatre-procedures', detailsSheetPatient, { includeTabNew: true })">
                                                                <AppIcon name="scissors" class="size-3.5" />
                                                                Procedure
                                                            </Link>
                                                        </Button>
                                                        <Button size="sm" variant="secondary" as-child class="justify-start gap-1.5">
                                                            <Link :href="patientContextHref('/billing-invoices', detailsSheetPatient)">
                                                                <AppIcon name="receipt" class="size-3.5" />
                                                                Invoice
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                        <Alert v-if="detailsTimelineError" variant="destructive">
                                            <AlertTitle>{{ tW2('timeline.loadIssue') }}</AlertTitle>
                                            <AlertDescription>{{ detailsTimelineError }}</AlertDescription>
                                        </Alert>

                                        <div v-if="detailsTimelineLoading" class="space-y-2">
                                            <Skeleton class="h-16 w-full" />
                                            <Skeleton class="h-16 w-full" />
                                            <Skeleton class="h-16 w-full" />
                                        </div>

                                        <template v-else>
                                            <div
                                                v-if="detailsTimelineEvents.length === 0"
                                                class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
                                            >
                                                {{ tW2('timeline.emptyAll') }}
                                            </div>

                                            <div class="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                                                <div
                                                    v-for="section in detailsTimelineSummary"
                                                    :key="section.key"
                                                    class="rounded-lg border bg-muted/20 px-3 py-3"
                                                >
                                                    <div class="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                                {{ section.label }}
                                                            </p>
                                                            <p class="mt-1 text-lg font-semibold text-foreground">
                                                                {{ section.count }}
                                                            </p>
                                                        </div>
                                                        <div class="flex h-9 w-9 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
                                                            <AppIcon :name="section.icon" class="size-4" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <Card class="rounded-lg !gap-4 !py-4">
                                                <CardHeader class="px-4 pb-1 pt-0">
                                                    <CardTitle class="text-sm font-medium">Patient activity feed</CardTitle>
                                                    <CardDescription class="text-xs">
                                                        Latest profile, appointment, admission, and consultation activity in one stream.
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent class="px-4 pt-0">
                                                    <div class="space-y-0">
                                                        <div
                                                            v-for="(event, index) in detailsTimelineEvents"
                                                            :key="event.id"
                                                            class="relative pb-4 pl-12 last:pb-0"
                                                        >
                                                            <span
                                                                v-if="index !== detailsTimelineEvents.length - 1"
                                                                class="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-border"
                                                            />
                                                            <div class="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm">
                                                                <AppIcon :name="timelineEventIcon(event.category)" class="size-4 text-muted-foreground" />
                                                            </div>
                                                            <div class="rounded-lg border bg-background px-3 py-3">
                                                                <div class="flex flex-wrap items-start justify-between gap-2">
                                                                    <div class="min-w-0 flex-1">
                                                                        <div class="flex flex-wrap items-center gap-2">
                                                                            <Badge variant="outline">{{ event.badge }}</Badge>
                                                                            <span class="text-xs text-muted-foreground">
                                                                                {{ formatDateTime(event.occurredAt) }}
                                                                            </span>
                                                                        </div>
                                                                        <p class="mt-2 font-medium text-foreground">{{ event.title }}</p>
                                                                        <p class="mt-1 text-sm text-muted-foreground">{{ event.description }}</p>
                                                                    </div>
                                                                    <Link
                                                                        v-if="event.href"
                                                                        :href="event.href"
                                                                        class="inline-flex shrink-0 items-center text-xs font-medium text-primary underline underline-offset-2"
                                                                    >
                                                                        {{ timelineEventLinkLabel(event.category) }}
                                                                    </Link>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </template>
                                    </TabsContent>

                                    <!-- AUDIT TAB -->
                                    <TabsContent v-if="canViewPatientAudit" value="audit" class="m-0 space-y-3 px-6 py-4">
                                        <Alert v-if="!canViewPatientAudit" variant="destructive">
                                            <AlertTitle class="flex items-center gap-2">
                                                <AppIcon name="shield-check" class="size-4" />
                                                Audit Access Restricted
                                            </AlertTitle>
                                            <AlertDescription>
                                                Request <code>patients.view-audit-logs</code> permission.
                                            </AlertDescription>
                                        </Alert>

                                        <template v-else>
                                            <fieldset class="grid gap-3 rounded-lg border p-3">
                                                <legend class="px-2 text-sm font-medium text-muted-foreground">Audit trail</legend>
                                                    <div class="flex flex-wrap items-center justify-between gap-2">
                                                        <div>
                                                            <p class="text-sm font-medium">Audit activity</p>
                                                            <p class="mt-0.5 text-xs text-muted-foreground">
                                                                {{ detailsAuditSummary.total }} entries | Search by action, user, or date range
                                                            </p>
                                                        </div>
                                                        <div class="flex flex-wrap items-center gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                :disabled="detailsAuditLoading || detailsAuditExporting"
                                                                @click="exportDetailsAuditLogsCsv"
                                                            >
                                                                {{ detailsAuditExporting ? 'Preparing...' : 'Export CSV' }}
                                                            </Button>
                                                            <Button variant="secondary" size="sm" class="gap-1.5" @click="detailsAuditFiltersOpen = !detailsAuditFiltersOpen">
                                                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                                {{ detailsAuditFiltersOpen ? 'Hide filters' : 'More filters' }}
                                                            </Button>
                                                        </div>
                                                    </div>

                                                <div class="space-y-3">
                                                    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                                                        <div class="space-y-1.5">
                                                            <Label for="patient-audit-q" class="text-xs">Search logs</Label>
                                                            <Input
                                                                id="patient-audit-q"
                                                                v-model="detailsAuditFilters.q"
                                                                placeholder="Search action label, action key, or actor..."
                                                                @keyup.enter="applyDetailsAuditFilters"
                                                            />
                                                        </div>
                                                        <div class="flex flex-col-reverse gap-2 sm:flex-row lg:items-end">
                                                            <Button size="sm" class="gap-1.5" :disabled="detailsAuditLoading" @click="applyDetailsAuditFilters">
                                                                <AppIcon name="search" class="size-3.5" />
                                                                {{ detailsAuditLoading ? 'Searching...' : 'Search' }}
                                                            </Button>
                                                            <Button size="sm" variant="outline" class="gap-1.5" :disabled="detailsAuditLoading" @click="resetDetailsAuditFilters">
                                                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                                Reset
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div class="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entries</p>
                                                            <p class="mt-1 text-sm font-semibold text-foreground">{{ detailsAuditSummary.total }}</p>
                                                        </div>
                                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Changed events</p>
                                                            <p class="mt-1 text-sm font-semibold text-foreground">{{ detailsAuditSummary.changedEntries }}</p>
                                                        </div>
                                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">User actions</p>
                                                            <p class="mt-1 text-sm font-semibold text-foreground">{{ detailsAuditSummary.userEntries }}</p>
                                                        </div>
                                                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">System events</p>
                                                            <p class="mt-1 text-sm font-semibold text-foreground">{{ detailsAuditSummary.systemEntries }}</p>
                                                        </div>
                                                    </div>

                                                    <div v-if="detailsAuditActiveFilters.length > 0" class="flex flex-wrap gap-2">
                                                        <Badge
                                                            v-for="filter in detailsAuditActiveFilters"
                                                            :key="filter.key"
                                                            variant="secondary"
                                                            class="px-2 py-1 text-xs"
                                                        >
                                                            {{ filter.label }}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </fieldset>

                                            <Collapsible v-model:open="detailsAuditFiltersOpen">
                                                <CollapsibleContent>
                                                    <fieldset class="grid gap-3 rounded-lg border p-3">
                                                        <legend class="px-2 text-sm font-medium text-muted-foreground">Advanced filters</legend>
                                                            <div>
                                                            <p class="text-sm font-medium">Narrow audit activity</p>
                                                            <p class="text-xs text-muted-foreground">
                                                                Narrow by action, user, actor type, date range, or page size.
                                                            </p>
                                                            </div>
                                                            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                                <div class="space-y-1.5">
                                                                    <Label for="patient-audit-action" class="text-xs">Exact action key</Label>
                                                                    <Input
                                                                        id="patient-audit-action"
                                                                        v-model="detailsAuditFilters.action"
                                                                        placeholder="Optional system action key"
                                                                    />
                                                                </div>
                                                                <div class="space-y-1.5">
                                                                    <Label for="patient-audit-actor-type" class="text-xs">Actor type</Label>
                                                                    <Select v-model="detailsAuditActorTypeFilterValue">
                                                                        <SelectTrigger class="mt-0">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                        <SelectItem v-for="option in auditActorTypeOptions" :key="`audit-at-${option.value}`" :value="option.value">{{ option.label }}</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div class="space-y-1.5">
                                                                    <Label for="patient-audit-actor-id" class="text-xs">Actor user ID</Label>
                                                                    <Input
                                                                        id="patient-audit-actor-id"
                                                                        v-model="detailsAuditFilters.actorId"
                                                                        inputmode="numeric"
                                                                        placeholder="Optional user ID"
                                                                    />
                                                                </div>
                                                                <div class="space-y-1.5">
                                                                    <Label for="patient-audit-from" class="text-xs">From</Label>
                                                                    <Input
                                                                        id="patient-audit-from"
                                                                        v-model="detailsAuditFilters.from"
                                                                        type="datetime-local"
                                                                        class="mt-0"
                                                                    />
                                                                </div>
                                                                <div class="space-y-1.5">
                                                                    <Label for="patient-audit-to" class="text-xs">To</Label>
                                                                    <Input
                                                                        id="patient-audit-to"
                                                                        v-model="detailsAuditFilters.to"
                                                                        type="datetime-local"
                                                                        class="mt-0"
                                                                    />
                                                                </div>
                                                                <div class="space-y-1.5">
                                                                    <Label for="patient-audit-per-page" class="text-xs">Rows per page</Label>
                                                                    <Select :model-value="String(detailsAuditFilters.perPage)" @update:model-value="detailsAuditFilters.perPage = Number($event)">
                                                                        <SelectTrigger class="mt-0">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                        <SelectItem value="10">10</SelectItem>
                                                                        <SelectItem value="20">20</SelectItem>
                                                                        <SelectItem value="50">50</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>
                                                    </fieldset>
                                                </CollapsibleContent>
                                            </Collapsible>

                                            <Alert v-if="detailsAuditError" variant="destructive">
                                                <AlertTitle class="flex items-center gap-2">
                                                    <AppIcon name="circle-x" class="size-4" />
                                                    Audit load issue
                                                </AlertTitle>
                                                <AlertDescription>{{ detailsAuditError }}</AlertDescription>
                                            </Alert>
                                            <div v-else-if="detailsAuditLoading" class="space-y-2">
                                                <Skeleton class="h-12 w-full" />
                                                <Skeleton class="h-12 w-full" />
                                                <Skeleton class="h-12 w-full" />
                                            </div>
                                            <div v-else-if="detailsAuditLogs.length === 0" class="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
                                                <AppIcon name="file-text" class="size-6 text-muted-foreground/50" />
                                                <p class="text-sm text-muted-foreground">No audit logs found for current filters.</p>
                                            </div>
                                            <div v-else class="space-y-1.5">
                                                <div
                                                    v-for="log in detailsAuditLogs"
                                                    :key="log.id"
                                                    class="rounded-lg border bg-background px-3 py-3 text-sm"
                                                >
                                                    <div class="flex flex-wrap items-start justify-between gap-3">
                                                        <div class="min-w-0 flex-1">
                                                            <div class="flex flex-wrap items-center gap-2">
                                                                <Badge variant="outline">{{ log.actionLabel || log.action || 'event' }}</Badge>
                                                                <Badge variant="secondary">{{ auditLogActorTypeLabel(log) }}</Badge>
                                                                <Badge v-if="auditLogChangeKeys(log).length > 0" variant="secondary">
                                                                    {{ auditLogChangeKeys(log).length }} fields changed
                                                                </Badge>
                                                                <Badge v-if="auditLogMetadataPreview(log).length > 0" variant="secondary">
                                                                    {{ auditLogMetadataPreview(log).length }} metadata items
                                                                </Badge>
                                                                <span class="text-xs text-muted-foreground">
                                                                    {{ formatDateTime(log.createdAt) }}
                                                                </span>
                                                            </div>
                                                            <p class="mt-2 font-medium text-foreground">{{ auditActorLabel(log) }}</p>
                                                            <p v-if="auditChangeSummary(log)" class="mt-1 text-xs text-muted-foreground">
                                                                {{ auditChangeSummary(log) }}
                                                            </p>
                                                            <div v-if="auditLogChangeKeys(log).length > 0" class="mt-3 flex flex-wrap gap-1.5">
                                                                <Badge
                                                                    v-for="field in auditLogChangeKeys(log)"
                                                                    :key="`${log.id}-field-${field}`"
                                                                    variant="outline"
                                                                    class="text-xs"
                                                                >
                                                                    {{ field }}
                                                                </Badge>
                                                            </div>
                                                            <div
                                                                v-if="auditLogMetadataPreview(log).length > 0"
                                                                class="mt-3 grid gap-1 text-xs text-muted-foreground"
                                                            >
                                                                <p
                                                                    v-for="item in auditLogMetadataPreview(log)"
                                                                    :key="`${log.id}-meta-${item.key}`"
                                                                >
                                                                    <span class="font-medium text-foreground">{{ item.key }}:</span>
                                                                    {{ item.value }}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div class="flex h-8 w-8 items-center justify-center rounded-full bg-muted/70">
                                                            <AppIcon name="activity" class="size-4 text-muted-foreground" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div v-if="detailsAuditLogs.length > 0" class="flex flex-col gap-2 border-t pt-2 sm:flex-row sm:items-center sm:justify-between">
                                                <Button variant="outline" size="sm" class="h-8 text-xs" :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage <= 1" @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 2) - 1)">
                                                    Previous
                                                </Button>
                                                <p class="text-xs text-muted-foreground">
                                                    Page {{ detailsAuditMeta?.currentPage ?? 1 }} of {{ detailsAuditMeta?.lastPage ?? 1 }} | {{ detailsAuditTotalEntries }} logs
                                                </p>
                                                <Button variant="outline" size="sm" class="h-8 text-xs" :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage >= detailsAuditMeta.lastPage" @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 0) + 1)">
                                                    Next
                                                </Button>
                                            </div>
                                        </template>
                                    </TabsContent>
                            </ScrollArea>
                        </Tabs>
                    </div>
                    <SheetFooter class="shrink-0 flex-col-reverse gap-2 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <Button variant="outline" class="gap-1.5 sm:shrink-0" @click="closePatientDetailsSheet">
                                <AppIcon name="circle-x" class="size-3.5" />
                                Close
                            </Button>
                            <Button v-if="detailsSheetPatient" as-child class="w-full justify-center gap-1.5 sm:w-auto sm:min-w-[16rem]">
                                <Link :href="patientChartContextHref(detailsSheetPatient, { from: 'patients' })">
                                    <AppIcon name="book-open" class="size-3.5" />
                                    Open Patient Chart
                                </Link>
                            </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- ================================================================== -->
            <!-- EDIT DEMOGRAPHICS SHEET                                            -->
            <!-- ================================================================== -->
            <Sheet
                :open="editSheetOpen"
                @update:open="(open) => (open ? null : closeEditSheet())"
            >
                <SheetContent
                    side="right"
                    variant="form"
                    size="4xl"
                >
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="pencil" class="size-5" />
                            Update Patient
                        </SheetTitle>
                        <SheetDescription>
                            Keep the patient record aligned with the same intake flow used during registration.
                        </SheetDescription>
                    </SheetHeader>

                    <ScrollArea class="min-h-0 flex-1">
                        <div class="mx-auto w-full max-w-4xl space-y-5 p-4 pb-24">
                            <div
                                v-if="editTargetPatient"
                                class="flex flex-col gap-3 rounded-lg border bg-muted/20 px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div class="min-w-0">
                                    <p class="truncate text-sm font-medium">{{ patientName(editTargetPatient) }}</p>
                                    <p class="mt-0.5 text-muted-foreground">
                                        {{ editTargetPatient.patientNumber || editTargetPatient.id.slice(0, 8) }}
                                        <template v-if="scope?.facility?.name"> | {{ scope.facility.name }}</template>
                                    </p>
                                </div>
                                <div class="flex flex-wrap gap-1.5">
                                    <Badge :variant="statusVariant(editTargetPatient.status)" class="capitalize">
                                        {{ editTargetPatient.status || 'unknown' }}
                                    </Badge>
                                    <Badge variant="outline">
                                        {{ editTargetPatient.dateOfBirth ? formatAge(editTargetPatient.dateOfBirth) : 'Age not recorded' }}
                                    </Badge>
                                    <Badge variant="outline">{{ patientLocationLabel(editTargetPatient) }}</Badge>
                                </div>
                            </div>

                            <div
                                v-if="editErrorSummary.length > 0"
                                ref="editErrorSummaryRef"
                                tabindex="-1"
                            >
                                <Alert variant="destructive">
                                    <AlertTitle>{{ tW2('validation.summaryTitle') }}</AlertTitle>
                                    <AlertDescription class="space-y-2">
                                        <p class="text-xs">{{ tW2('validation.summaryDescription') }}</p>
                                        <ul class="list-disc space-y-1 pl-4 text-xs">
                                            <li
                                                v-for="message in editErrorSummary"
                                                :key="`edit-error-${message}`"
                                            >
                                                {{ message }}
                                            </li>
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            </div>

                            <fieldset class="grid gap-4 rounded-lg border p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Patient identity</legend>
                                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div class="grid gap-1.5">
                                            <Label for="patient-edit-firstName" class="text-xs font-medium">
                                                First name
                                            </Label>
                                            <Input
                                                id="patient-edit-firstName"
                                                v-model="editForm.firstName"
                                                placeholder="First name"
                                                class="h-10"
                                                autocomplete="given-name"
                                            />
                                            <p v-if="editFieldError('firstName')" class="text-xs text-destructive">{{ editFieldError('firstName') }}</p>
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label for="patient-edit-lastName" class="text-xs font-medium">
                                                Last name
                                            </Label>
                                            <Input
                                                id="patient-edit-lastName"
                                                v-model="editForm.lastName"
                                                placeholder="Last name"
                                                class="h-10"
                                                autocomplete="family-name"
                                            />
                                            <p v-if="editFieldError('lastName')" class="text-xs text-destructive">{{ editFieldError('lastName') }}</p>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_190px_190px]">
                                        <div class="grid gap-1.5">
                                            <Label for="patient-edit-middleName" class="text-xs font-medium text-muted-foreground">
                                                Middle name
                                            </Label>
                                            <Input
                                                id="patient-edit-middleName"
                                                v-model="editForm.middleName"
                                                placeholder="Middle name if used"
                                                class="h-10"
                                                autocomplete="additional-name"
                                            />
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label for="patient-edit-gender" class="text-xs font-medium">
                                                Gender
                                            </Label>
                                            <Select v-model="editGenderSelectValue">
                                                <SelectTrigger class="h-10 w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                <SelectItem :value="SELECT_NONE_VALUE">Select gender</SelectItem>
                                                <SelectItem value="female">Female</SelectItem>
                                                <SelectItem value="male">Male</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                                <SelectItem value="unknown">Unknown</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p v-if="editFieldError('gender')" class="text-xs text-destructive">{{ editFieldError('gender') }}</p>
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label for="patient-edit-countryCode" class="text-xs font-medium">
                                                Country
                                            </Label>
                                            <Select v-model="editForm.countryCode">
                                                <SelectTrigger class="h-10 w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                <SelectItem
                                                    v-for="option in editCountryOptions"
                                                    :key="`edit-country-${option.code}`"
                                                    :value="option.code"
                                                >
                                                    {{ option.name }}
                                                </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p v-if="editFieldError('countryCode')" class="text-xs text-destructive">{{ editFieldError('countryCode') }}</p>
                                        </div>
                                    </div>

                            </fieldset>

                            <fieldset class="grid gap-4 rounded-lg border p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Age and date of birth</legend>
                                    <div class="grid gap-2">
                                        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <Label class="text-xs font-medium">
                                                Age / Date of birth
                                            </Label>
                                            <div class="inline-flex w-full rounded-md border bg-muted/40 p-0.5 sm:w-auto">
                                                <button
                                                    type="button"
                                                    class="flex-1 rounded px-2.5 py-1 text-xs font-medium transition sm:flex-none"
                                                    :class="editBirthInputMode === 'estimated' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                                                    :aria-pressed="editBirthInputMode === 'estimated'"
                                                    @click="setEditBirthInputMode('estimated')"
                                                >Estimated age</button>
                                                <button
                                                    type="button"
                                                    class="flex-1 rounded px-2.5 py-1 text-xs font-medium transition sm:flex-none"
                                                    :class="editBirthInputMode === 'exact' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                                                    :aria-pressed="editBirthInputMode === 'exact'"
                                                    @click="setEditBirthInputMode('exact')"
                                                >Exact date</button>
                                            </div>
                                        </div>

                                        <div v-if="editBirthInputMode === 'estimated'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div class="grid gap-1.5">
                                                <Label for="patient-edit-ageYears" class="text-xs font-medium">Years</Label>
                                                <Input
                                                    id="patient-edit-ageYears"
                                                    v-model="editForm.ageYears"
                                                    type="number"
                                                    min="0"
                                                    max="130"
                                                    step="1"
                                                    inputmode="numeric"
                                                    placeholder="e.g. 45"
                                                    class="h-10"
                                                />
                                            </div>
                                            <div class="grid gap-1.5">
                                                <Label for="patient-edit-ageMonths" class="text-xs font-medium">Months</Label>
                                                <Input
                                                    id="patient-edit-ageMonths"
                                                    v-model="editForm.ageMonths"
                                                    type="number"
                                                    min="0"
                                                    max="11"
                                                    step="1"
                                                    inputmode="numeric"
                                                    placeholder="e.g. 6"
                                                    class="h-10"
                                                />
                                            </div>
                                        </div>

                                        <Input
                                            v-else
                                            id="patient-edit-dateOfBirth"
                                            v-model="editForm.dateOfBirth"
                                            type="date"
                                            class="h-10"
                                            autocomplete="bday"
                                        />

                                        <div class="rounded-md bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                                            <p v-if="editBirthInputMode === 'estimated' && editDerivedDateOfBirth">
                                                Estimated DOB: {{ formatDate(editDerivedDateOfBirth) }}
                                            </p>
                                            <p v-else-if="editBirthInputMode === 'estimated'">
                                                Enter years, months, or both. For infants, months only is fine.
                                            </p>
                                            <p v-else-if="editForm.dateOfBirth">
                                                Age: {{ formatAge(editForm.dateOfBirth) }}
                                            </p>
                                            <p v-else>Choose the exact date only when it is confirmed.</p>
                                        </div>
                                        <div class="space-y-0.5">
                                            <p v-if="editFieldError('dateOfBirth')" class="text-xs text-destructive">{{ editFieldError('dateOfBirth') }}</p>
                                            <p v-if="editFieldError('ageYears')" class="text-xs text-destructive">{{ editFieldError('ageYears') }}</p>
                                            <p v-if="editFieldError('ageMonths')" class="text-xs text-destructive">{{ editFieldError('ageMonths') }}</p>
                                        </div>
                                    </div>

                            </fieldset>

                            <fieldset class="grid gap-4 rounded-lg border p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Contact and address</legend>
                                    <div class="grid gap-1.5">
                                        <Label for="patient-edit-phone" class="text-xs font-medium">
                                            Phone
                                        </Label>
                                        <Input
                                            id="patient-edit-phone"
                                            v-model="editForm.phone"
                                            placeholder="Use international format when possible"
                                            class="h-10"
                                            autocomplete="tel"
                                        />
                                        <p v-if="editFieldError('phone')" class="text-xs text-destructive">{{ editFieldError('phone') }}</p>
                                    </div>

                                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <SearchableSelectField
                                            input-id="patient-edit-region"
                                            v-model="editForm.region"
                                            :label="editCountryUi.regionLabel"
                                            :options="editRegionOptions"
                                            :placeholder="editCountryUi.regionPlaceholder"
                                            :search-placeholder="`Search ${editCountryUi.regionLabel.toLowerCase()} or use a custom value`"
                                            :empty-text="`No ${editCountryUi.regionLabel.toLowerCase()} suggestion found.`"
                                            :error-message="editFieldError('region')"
                                            :required="true"
                                            :allow-custom-value="true"
                                        />
                                        <SearchableSelectField
                                            input-id="patient-edit-district"
                                            v-model="editForm.district"
                                            :label="editCountryUi.districtLabel"
                                            :options="editDistrictOptions"
                                            :placeholder="editDistrictPlaceholder"
                                            :search-placeholder="`Search ${editCountryUi.districtLabel.toLowerCase()} or use a custom value`"
                                            :helper-text="editDistrictHelperText"
                                            :empty-text="`No ${editCountryUi.districtLabel.toLowerCase()} suggestion found.`"
                                            :error-message="editFieldError('district')"
                                            :required="true"
                                            :allow-custom-value="true"
                                            :disabled="!editForm.region.trim()"
                                        />
                                    </div>

                                    <div class="grid gap-1.5">
                                        <Label for="patient-edit-addressLine" class="text-xs font-medium">
                                            {{ editCountryUi.addressLabel }}
                                        </Label>
                                        <Textarea
                                            id="patient-edit-addressLine"
                                            v-model="editForm.addressLine"
                                            rows="2"
                                            :placeholder="editCountryUi.addressPlaceholder"
                                            autocomplete="street-address"
                                        />
                                        <p v-if="editFieldError('addressLine')" class="text-xs text-destructive">{{ editFieldError('addressLine') }}</p>
                                    </div>
                            </fieldset>

                            <Collapsible v-model:open="editOptionalDetailsOpen">
                                <Card class="rounded-lg border-dashed shadow-sm">
                                    <CardContent class="p-4 sm:p-5">
                                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                                    <AppIcon name="file-text" class="size-3.5" />
                                                    Additional details (optional)
                                                </p>
                                                <p class="mt-1 text-xs text-muted-foreground">
                                                    Open only when those details need to change.
                                                </p>
                                            </div>
                                            <CollapsibleTrigger as-child>
                                                <Button size="sm" variant="outline" class="shrink-0">
                                                    {{ editOptionalDetailsOpen ? tW2('common.hide') : tW2('common.show') }}
                                                </Button>
                                            </CollapsibleTrigger>
                                        </div>
                                    </CardContent>
                                    <CollapsibleContent>
                                        <CardContent class="grid grid-cols-1 gap-4 border-t px-4 pb-4 pt-4 sm:grid-cols-2 sm:px-5 sm:pb-5">
                                            <div class="grid gap-1.5">
                                                <Label for="patient-edit-nationalId" class="text-xs font-medium">National ID</Label>
                                                <Input
                                                    id="patient-edit-nationalId"
                                                    v-model="editForm.nationalId"
                                                    placeholder="National ID number"
                                                />
                                                <p v-if="editFieldError('nationalId')" class="text-xs text-destructive">{{ editFieldError('nationalId') }}</p>
                                            </div>
                                            <div class="grid gap-1.5">
                                                <Label for="patient-edit-email" class="text-xs font-medium">Email</Label>
                                                <Input
                                                    id="patient-edit-email"
                                                    v-model="editForm.email"
                                                    type="email"
                                                    placeholder="patient@email.com"
                                                />
                                                <p v-if="editFieldError('email')" class="text-xs text-destructive">{{ editFieldError('email') }}</p>
                                            </div>
                                            <div class="grid gap-1.5">
                                                <Label for="patient-edit-nextOfKinName" class="text-xs font-medium">
                                                    Emergency contact name
                                                </Label>
                                                <Input
                                                    id="patient-edit-nextOfKinName"
                                                    v-model="editForm.nextOfKinName"
                                                    placeholder="Next of kin full name"
                                                />
                                                <p v-if="editFieldError('nextOfKinName')" class="text-xs text-destructive">{{ editFieldError('nextOfKinName') }}</p>
                                            </div>
                                            <div class="grid gap-1.5">
                                                <Label for="patient-edit-nextOfKinPhone" class="text-xs font-medium">
                                                    Emergency contact phone
                                                </Label>
                                                <Input
                                                    id="patient-edit-nextOfKinPhone"
                                                    v-model="editForm.nextOfKinPhone"
                                                    placeholder="Use international format when possible"
                                                />
                                                <p v-if="editFieldError('nextOfKinPhone')" class="text-xs text-destructive">{{ editFieldError('nextOfKinPhone') }}</p>
                                            </div>
                                        </CardContent>
                                    </CollapsibleContent>
                                </Card>
                            </Collapsible>
                        </div>
                    </ScrollArea>

                    <SheetFooter class="shrink-0 flex-col-reverse gap-2 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
                        <Button
                            size="sm"
                            variant="outline"
                            :disabled="editLoading"
                            class="w-full sm:w-auto"
                            @click="closeEditSheet"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            :disabled="editLoading"
                            class="h-8 w-full gap-1.5 px-3 sm:w-auto"
                            @click="updatePatient"
                        >
                            <AppIcon name="check-circle" class="size-3.5" />
                            {{ editLoading ? 'Saving...' : 'Save Changes' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
            <!-- ================================================================== -->
            <!-- STATUS CHANGE DIALOG                                               -->
            <!-- ================================================================== -->
            <Dialog
                :open="statusDialogOpen"
                @update:open="(open) => (open ? null : closeStatusDialog())"
            >
                <DialogContent size="sm">
                    <DialogHeader>
                        <DialogTitle class="flex items-center gap-2">
                            <AppIcon
                                :name="statusForm.status === 'active' ? 'user-check' : 'user-x'"
                                class="size-5 text-primary"
                            />
                            {{ statusForm.status === 'active' ? 'Activate Patient' : 'Deactivate Patient' }}
                        </DialogTitle>
                        <DialogDescription>
                            {{ statusForm.status === 'active'
                                ? 'This will re-activate the patient record and allow new clinical workflows.'
                                : 'This will deactivate the patient record. Existing records are preserved.' }}
                        </DialogDescription>
                    </DialogHeader>

                    <div class="space-y-3">
                        <div v-if="statusErrors.length" class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            <p v-for="err in statusErrors" :key="err">{{ err }}</p>
                        </div>
                        <div class="grid gap-1.5">
                            <Label for="status-reason" class="text-sm">Reason <span class="text-muted-foreground">(optional)</span></Label>
                            <Textarea
                                id="status-reason"
                                v-model="statusForm.reason"
                                placeholder="Brief reason for status change..."
                                rows="3"
                                class="resize-none"
                            />
                        </div>
                    </div>

                    <DialogFooter class="gap-2 sm:gap-0">
                        <Button variant="outline" size="sm" :disabled="statusLoading" @click="closeStatusDialog">
                            Cancel
                        </Button>
                        <Button
                            :variant="statusForm.status === 'active' ? 'default' : 'destructive'"
                            size="sm"
                            :disabled="statusLoading"
                            class="gap-1.5"
                            @click="changePatientStatus"
                        >
                            <AppIcon
                                :name="statusForm.status === 'active' ? 'user-check' : 'user-x'"
                                class="size-3.5"
                            />
                            {{ statusLoading ? 'Saving...' : (statusForm.status === 'active' ? 'Activate' : 'Deactivate') }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <!-- ================================================================== -->
            <!-- PATIENT FILTERS SHEET                                              -->
            <!-- ================================================================== -->
            <Sheet
                v-if="canReadPatients"
                :open="patientFiltersSheetOpen"
                @update:open="patientFiltersSheetOpen = $event"
            >
                <SheetContent side="right" variant="form" size="md" class="flex h-full min-h-0 flex-col">
                    <SheetHeader>
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            Patient Filters
                        </SheetTitle>
                        <SheetDescription>
                            Registry controls for status, identity, location, sorting, and result size.
                        </SheetDescription>
                    </SheetHeader>

                    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        <div class="rounded-lg border p-3">
                            <div class="mb-3">
                                <p class="text-sm font-medium">Find patient records</p>
                                <p class="text-xs text-muted-foreground">
                                    Search across identity, contact, and facility registration data.
                                </p>
                            </div>
                            <div class="grid gap-3 sm:grid-cols-2">
                                <div class="grid gap-2 sm:col-span-2">
                                    <Label for="patient-search-q-sheet">Search</Label>
                                    <div class="relative">
                                        <AppIcon
                                            name="search"
                                            class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                                        />
                                        <Input
                                            id="patient-search-q-sheet"
                                            v-model="searchForm.q"
                                            placeholder="Name, patient number, phone, email, or ID"
                                            class="pl-9"
                                            :disabled="listLoading"
                                            @keyup.enter="submitSearch"
                                        />
                                    </div>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="patient-search-status-sheet">Status</Label>
                                    <Select
                                        :model-value="nonEmptySelectValue(searchForm.status)"
                                        @update:model-value="updatePatientStatusFilter"
                                    >
                                        <SelectTrigger id="patient-search-status-sheet" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem :value="SELECT_ALL_VALUE">All statuses</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="patient-search-gender-sheet">Gender</Label>
                                    <Select
                                        :model-value="nonEmptySelectValue(searchForm.gender)"
                                        @update:model-value="updatePatientGenderFilter"
                                    >
                                        <SelectTrigger id="patient-search-gender-sheet" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                v-for="option in patientGenderFilterOptions"
                                                :key="`patient-gender-filter-${option.value}`"
                                                :value="option.value"
                                            >
                                                {{ option.label }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-lg border p-3">
                            <div class="mb-3">
                                <p class="text-sm font-medium">Location</p>
                                <p class="text-xs text-muted-foreground">
                                    Narrow registry results by the patient address recorded at registration.
                                </p>
                            </div>
                            <div class="grid gap-3 sm:grid-cols-2">
                                <SearchableSelectField
                                    input-id="patient-search-region-sheet"
                                    v-model="searchForm.region"
                                    :label="patientFilterCountryUi.regionLabel"
                                    :options="patientFilterRegionOptions"
                                    :placeholder="patientFilterCountryUi.regionPlaceholder"
                                    :search-placeholder="`Search ${patientFilterCountryUi.regionLabel.toLowerCase()}`"
                                    :empty-text="`No ${patientFilterCountryUi.regionLabel.toLowerCase()} suggestion found.`"
                                    :disabled="listLoading"
                                />
                                <SearchableSelectField
                                    input-id="patient-search-district-sheet"
                                    v-model="searchForm.district"
                                    :label="patientFilterCountryUi.districtLabel"
                                    :options="patientFilterDistrictOptions"
                                    :placeholder="patientFilterDistrictPlaceholder"
                                    :search-placeholder="`Search ${patientFilterCountryUi.districtLabel.toLowerCase()}`"
                                    :helper-text="patientFilterDistrictHelperText"
                                    :empty-text="`No ${patientFilterCountryUi.districtLabel.toLowerCase()} suggestion found.`"
                                    :disabled="listLoading || !searchForm.region.trim()"
                                />
                            </div>
                        </div>

                        <div class="rounded-lg border p-3">
                            <div class="mb-3">
                                <p class="text-sm font-medium">List view</p>
                                <p class="text-xs text-muted-foreground">
                                    Control result ordering and row density for registry work.
                                </p>
                            </div>
                            <div class="grid gap-3 sm:grid-cols-2">
                                <div class="grid gap-2">
                                    <Label for="patient-search-sort-by-sheet">Sort by</Label>
                                    <Select
                                        :model-value="searchForm.sortBy"
                                        @update:model-value="updatePatientSortByFilter"
                                    >
                                        <SelectTrigger id="patient-search-sort-by-sheet" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                v-for="option in patientSortByOptions"
                                                :key="`patient-sort-${option.value}`"
                                                :value="option.value"
                                            >
                                                {{ option.label }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="patient-search-sort-dir-sheet">Sort direction</Label>
                                    <Select
                                        :model-value="searchForm.sortDir"
                                        @update:model-value="updatePatientSortDirFilter"
                                    >
                                        <SelectTrigger id="patient-search-sort-dir-sheet" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                v-for="option in patientSortDirOptions"
                                                :key="`patient-sort-dir-${option.value}`"
                                                :value="option.value"
                                            >
                                                {{ option.label }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div class="grid gap-2 sm:col-span-2">
                                    <Label for="patient-search-per-page-sheet">Rows per page</Label>
                                    <Select
                                        :model-value="String(searchForm.perPage)"
                                        @update:model-value="updatePatientPerPageFilter"
                                    >
                                        <SelectTrigger id="patient-search-per-page-sheet" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <SheetFooter class="gap-2 border-t px-4 py-3">
                        <Button
                            variant="outline"
                            class="gap-1.5"
                            :disabled="listLoading && !hasActivePatientFilters"
                            @click="resetPatientFiltersFromSheet"
                        >
                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                            Reset Filters
                        </Button>
                        <Button :disabled="listLoading" class="gap-1.5" @click="patientFiltersSheetOpen = false">
                            Done
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
    </AppLayout>
</template>






