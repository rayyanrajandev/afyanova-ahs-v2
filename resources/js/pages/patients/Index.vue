<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
} from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import ProcessingStatePanel from '@/components/workflow/ProcessingStatePanel.vue';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import { clearSensitiveLocalStorageKey } from '@/lib/browserStoragePolicy';
import { createLocaleTranslator } from '@/lib/locale';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import {
    enqueueOfflinePatientRegistration,
    enqueueOfflinePatientUpdate,
    isLikelyPatientOfflineFailure,
    listOfflinePatientRegistrations,
    listOfflinePatientUpdates,
    registerOfflinePatientServiceWorker,
    syncPendingOfflinePatientRegistrations,
    syncPendingOfflinePatientUpdates,
    updateOfflinePatientRegistrationDraft,
    type OfflinePatientRegistrationRecord,
    type OfflinePatientUpdateRecord,
} from '@/lib/offlinePatientRegistration';
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
    duplicateConfidence?: number;
    duplicateConfidenceLabel?: 'strong' | 'possible';
    duplicateMatchType?: 'hard_block' | 'strong_warning' | 'possible_warning';
    matchedFields?: string[];
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

type DirectServiceRequestType =
    | 'laboratory'
    | 'radiology'
    | 'pharmacy'
    | 'theatre_procedure';

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
    actorLabel?: string | null;
    actorType?: string | null;
};

type PatientActivityFeedEvent = {
    id: string;
    patientId: string | null;
    action: string | null;
    actionLabel: string | null;
    actorId: number | null;
    actorType: 'user' | 'system' | string | null;
    actor: {
        id: number | null;
        name: string | null;
        email: string | null;
        displayName: string;
    } | null;
    metadata: Record<string, unknown> | null;
    occurredAt: string | null;
};

type PatientWorkflowRecommendation = {
    title: string;
    description: string;
    primaryLabel: string | null;
    primaryHref: string | null;
    primaryIcon: string;
};

type PatientVisitHandoffMode =
    | 'outpatient'
    | 'emergency'
    | 'direct-services'
    | 'billing'
    | 'chart';

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
        providerPresets: Array<{
            code: string;
            name: string;
            category: string;
            insuranceType?: string | null;
        }>;
        payerContracts: Array<{
            id: string;
            contractCode: string | null;
            contractName: string | null;
            payerType: string | null;
            payerName: string | null;
            payerPlanCode?: string | null;
            payerPlanName: string | null;
        }>;
    };
};

type PatientInsuranceForm = {
    billingPayerContractId: string;
    insuranceType: string;
    insuranceProvider: string;
    providerCode: string;
    memberId: string;
    cardNumber: string;
    verificationStatus: string;
};

type ValidationErrorResponse = {
    message?: string;
    errors?: Record<string, string[]>;
    code?: string;
    duplicates?: Patient[];
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
    'validation.dateOfBirthOrAgeRequired':
        'Provide exact date of birth or estimated age.',
    'validation.dateOfBirthInvalid': 'Enter a valid date of birth.',
    'validation.dateOfBirthFuture': 'Date of birth cannot be in the future.',
    'validation.ageYearsInvalid':
        'Age must be a whole number between 0 and 130.',
    'validation.ageMonthsInvalid':
        'Age months must be a whole number between 0 and 11.',
    'validation.phoneRequired': 'Phone is required.',
    'validation.phoneTooShort': 'Phone must be at least 7 characters.',
    'validation.countryCodeRequired': 'Country is required.',
    'validation.countryCodeInvalid': 'Country selection is invalid.',
    'validation.regionRequired': 'Region is required.',
    'validation.districtRequired': 'District is required.',
    'validation.addressLineRequired': 'Address is required.',
    'validation.summaryTitle': 'Check the highlighted fields.',
    'validation.summaryDescription':
        'Resolve the following issues before continuing.',
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
    'timeline.eventTitleAppointmentWithNumber':
        'Appointment {appointmentNumber}',
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
        'Review possible matches. Shared family phone numbers are allowed; only National ID or patient number conflicts are blocked.',
    'duplicate.confidence': '{score}% confidence',
    'duplicate.continueRegistration': 'Continue registration',
    'duplicate.viewExistingPatient': 'View existing patient',
    'duplicate.reviewForm': 'Review form',
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
        'validation.countryCodeInvalid': 'Chaguo la nchi si sahihi.',
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
        'timeline.eventTitleAppointmentWithNumber': 'Miadi {appointmentNumber}',
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
            'Kagua wagonjwa wanaoweza kufanana. Namba ya simu ya familia inaruhusiwa; NIDA au namba ya mgonjwa pekee ndizo zinazozuia.',
        'duplicate.confidence': 'Uhakika {score}%',
        'duplicate.continueRegistration': 'Endelea kusajili',
        'duplicate.viewExistingPatient': 'Tazama mgonjwa aliyepo',
        'duplicate.reviewForm': 'Kagua fomu',
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
        'timeline.openMedicalRecords': 'Fungua kwenye chati ya mgonjwa',
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
const patientListOfflineUnavailable = ref(false);
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
const scope = ref<ScopeData | null>(
    (sharedScope.value as ScopeData | null) ?? null,
);
const activePlatformCountryCode = ref('TZ');
const countryProfileCatalog = ref<CountryProfileApiProfile[]>([]);
const patients = ref<Patient[]>([]);
const pagination = ref<PatientListResponse['meta'] | null>(null);
const patientStatusCounts = ref<PatientStatusCounts | null>(null);
const patientReadPermissionState = ref<PermissionState>(
    permissionState('patients.read'),
);
const canReadPatients = computed(
    () => patientReadPermissionState.value === 'allowed',
);
const isPatientReadPermissionResolved = computed(
    () => patientReadPermissionState.value !== 'unknown',
);
const canViewPatientAudit = ref(hasPermission('patients.view-audit-logs'));
const canReadAppointments = ref(hasPermission('appointments.read'));
const canCreateAppointments = ref(hasPermission('appointments.create'));
const canUpdateAppointmentsStatus = ref(
    hasPermission('appointments.update-status'),
);
const canReadAdmissions = ref(hasPermission('admissions.read'));
const canReadMedicalRecords = ref(hasPermission('medical.records.read'));
/** With permission only, API still requires plan SKU `medical_records.core` via subscription middleware. */
const canFetchMedicalRecordsForTimeline = computed(
    () =>
        canReadMedicalRecords.value &&
        hasFacilityEntitlement('medical_records.core'),
);
const canCreateBillingInvoices = ref(hasPermission('billing.invoices.create'));
const canCreatePatients = ref(hasPermission('patients.create'));
const canUpdatePatients = ref(hasPermission('patients.update'));
const canUpdatePatientStatus = ref(hasPermission('patients.update-status'));
const canReadPatientInsurance = ref(hasPermission('patients.insurance.read'));
const canManagePatientInsurance = ref(
    hasPermission('patients.insurance.manage'),
);
const canVerifyPatientInsurance = ref(
    hasPermission('patients.insurance.verify'),
);
const canRecordOpdTriage = ref(
    hasPermission('emergency.triage.create') ||
        hasPermission('emergency.triage.update-status'),
);
const canCreateLaboratoryOrders = ref(
    hasPermission('laboratory.orders.create'),
);
const canCreatePharmacyOrders = ref(hasPermission('pharmacy.orders.create'));
const canCreateRadiologyOrders = ref(hasPermission('radiology.orders.create'));
const canCreateTheatreProcedures = ref(
    hasPermission('theatre.procedures.create'),
);
const canCreateServiceRequests = ref(hasPermission('service.requests.create'));
const canManageProviderSession = computed(
    () => canReadAppointments.value && canReadMedicalRecords.value,
);
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
const preSubmitDuplicateWarningAcknowledged = ref(false);
const registrationProcessingVisible = computed(
    () => createLoading.value || preSubmitDuplicateCheckLoading.value,
);
const registrationProcessingTitle = computed(() => {
    if (preSubmitDuplicateCheckLoading.value) {
        return 'Checking possible duplicates';
    }

    return browserOnline.value ? 'Registering patient' : 'Saving offline';
});
const registrationProcessingDescription = computed(() => {
    if (preSubmitDuplicateCheckLoading.value) {
        return 'Comparing patient identifiers before the record is created.';
    }

    if (!browserOnline.value) {
        return 'Saving this registration safely on this browser. It will upload when internet returns.';
    }

    return 'Saving the patient record to the cloud. Do not refresh or close this page.';
});
const browserOnline = ref(
    typeof navigator === 'undefined' ? true : navigator.onLine,
);
const offlinePatientRegistrations = ref<OfflinePatientRegistrationRecord[]>([]);
const offlinePatientUpdates = ref<OfflinePatientUpdateRecord[]>([]);
const offlinePatientSyncLoading = ref(false);
const offlinePatientSyncError = ref<string | null>(null);
const offlineLastSavedPatientNumber = ref<string | null>(null);
const offlineLastSavedUpdateLabel = ref<string | null>(null);
const offlinePatientPendingCount = computed(
    () =>
        offlinePatientRegistrations.value.filter((record) =>
            ['pending', 'syncing', 'failed'].includes(record.status),
        ).length,
);
const offlinePatientUpdatePendingCount = computed(
    () =>
        offlinePatientUpdates.value.filter((record) =>
            ['pending', 'syncing', 'failed'].includes(record.status),
        ).length,
);
const offlinePatientChangePendingCount = computed(
    () =>
        offlinePatientPendingCount.value +
        offlinePatientUpdatePendingCount.value,
);
const offlinePatientFailedCount = computed(
    () =>
        offlinePatientRegistrations.value.filter(
            (record) => record.status === 'failed',
        ).length,
);
const offlinePatientUpdateFailedCount = computed(
    () =>
        offlinePatientUpdates.value.filter(
            (record) => record.status === 'failed',
        ).length,
);
const offlinePatientChangeFailedCount = computed(
    () =>
        offlinePatientFailedCount.value + offlinePatientUpdateFailedCount.value,
);
const offlinePatientFailedRecords = computed(() =>
    offlinePatientRegistrations.value.filter(
        (record) => record.status === 'failed',
    ),
);
const offlinePatientFailedUpdateRecords = computed(() =>
    offlinePatientUpdates.value.filter((record) => record.status === 'failed'),
);

// ── Draft auto-save ────────────────────────────────────────────────────────
const DRAFT_STORAGE_KEY = 'ptReg_draft_v1';
type DraftSaveStatus = 'idle' | 'saving' | 'saved';
const draftSaveStatus = ref<DraftSaveStatus>('idle');
const draftSavedAt = ref<Date | null>(null);
const draftResumeVisible = ref(false);
let draftSaveTimer: number | null = null;

function draftSavedRelative(): string {
    if (!draftSavedAt.value) return '';
    const diffMs = Date.now() - draftSavedAt.value.getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return 'just now';
    if (mins === 1) return '1 min ago';
    return `${mins} min ago`;
}

function saveDraftToStorage(): void {
    clearDraftFromStorage();
}

function loadDraftFromStorage(): {
    form: Partial<PatientRegistrationForm>;
    birthInputMode: RegistrationBirthInputMode;
} | null {
    clearSensitiveLocalStorageKey(DRAFT_STORAGE_KEY);
    return null;
}

function clearDraftFromStorage(): void {
    clearSensitiveLocalStorageKey(DRAFT_STORAGE_KEY);
    draftSaveStatus.value = 'idle';
    draftSavedAt.value = null;
    draftResumeVisible.value = false;
}

function scheduleDraftSave(): void {
    if (draftSaveTimer !== null) window.clearTimeout(draftSaveTimer);
    draftSaveTimer = null;
    saveDraftToStorage();
}

function applyDraftToForm(draft: {
    form: Partial<PatientRegistrationForm>;
    birthInputMode: RegistrationBirthInputMode;
}): void {
    const f = draft.form;
    registrationBirthInputMode.value = draft.birthInputMode;
    if (f.firstName !== undefined) registrationForm.firstName = f.firstName;
    if (f.middleName !== undefined) registrationForm.middleName = f.middleName;
    if (f.lastName !== undefined) registrationForm.lastName = f.lastName;
    if (f.gender !== undefined) registrationForm.gender = f.gender;
    if (f.dateOfBirth !== undefined)
        registrationForm.dateOfBirth = f.dateOfBirth;
    if (f.ageYears !== undefined) registrationForm.ageYears = f.ageYears;
    if (f.ageMonths !== undefined) registrationForm.ageMonths = f.ageMonths;
    if (f.phone !== undefined) registrationForm.phone = f.phone;
    if (f.email !== undefined) registrationForm.email = f.email;
    if (f.countryCode !== undefined)
        registrationForm.countryCode = f.countryCode;
    if (f.region !== undefined) registrationForm.region = f.region;
    if (f.district !== undefined) registrationForm.district = f.district;
    if (f.addressLine !== undefined)
        registrationForm.addressLine = f.addressLine;
    if (f.nextOfKinName !== undefined)
        registrationForm.nextOfKinName = f.nextOfKinName;
    if (f.nextOfKinPhone !== undefined)
        registrationForm.nextOfKinPhone = f.nextOfKinPhone;
}
// ── End draft auto-save ────────────────────────────────────────────────────
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
const directServiceSentMap = ref<
    Record<
        string,
        { serviceType: DirectServiceRequestType; requestNumber: string }
    >
>({});
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
const patientInsuranceProviderPresets = ref<
    PatientInsuranceOptionResponse['data']['providerPresets']
>([]);
const patientInsurancePayerContracts = ref<
    PatientInsuranceOptionResponse['data']['payerContracts']
>([]);
const insuranceFormOpen = ref(false);
const insuranceForm = reactive<PatientInsuranceForm>({
    billingPayerContractId: '',
    insuranceType: 'insurance',
    insuranceProvider: '',
    providerCode: '',
    memberId: '',
    cardNumber: '',
    verificationStatus: 'unverified',
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

function patientCountryOption(
    code: string | null | undefined,
): PatientCountryOption {
    const normalized = normalizeCountryCode(code);
    return (
        availablePatientCountryOptions.value.find(
            (option) => option.code === normalized,
        ) ??
        (normalized
            ? {
                  ...fallbackPatientCountryOption,
                  code: normalized,
                  name: normalized,
              }
            : fallbackPatientCountryOption)
    );
}

function countryProfile(
    code: string | null | undefined,
): CountryProfileApiProfile | null {
    const normalized = normalizeCountryCode(code);
    if (!normalized) return null;

    return (
        countryProfileCatalog.value.find(
            (profile) => normalizeCountryCode(profile.code) === normalized,
        ) ?? null
    );
}

function patientCountryOptionsForSelect(
    currentCode: string | null | undefined,
): PatientCountryOption[] {
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
        if (section.key === 'medical-record')
            return canFetchMedicalRecordsForTimeline.value;
        return true;
    }),
);
const detailsCurrentAppointment = computed<PatientTimelineAppointment | null>(
    () => {
        if (detailsTimelineAppointments.value.length === 0) return null;

        return (
            [...detailsTimelineAppointments.value].sort((left, right) => {
                const priorityDifference =
                    patientAppointmentWorkflowPriority(right.status) -
                    patientAppointmentWorkflowPriority(left.status);

                if (priorityDifference !== 0) {
                    return priorityDifference;
                }

                return (
                    patientTimelineTimestamp(right.scheduledAt) -
                    patientTimelineTimestamp(left.scheduledAt)
                );
            })[0] ?? null
        );
    },
);
const detailsWorkflowRecommendation =
    computed<PatientWorkflowRecommendation | null>(() => {
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
                    primaryHref: patientContextHref('/appointments', patient, {
                        openSchedule: true,
                    }),
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
                primaryHref: patientChartContextHref(patient, {
                    from: 'patients',
                }),
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
                    title: canRecordOpdTriage.value
                        ? 'Record triage'
                        : 'Patient waiting for triage',
                    description: canRecordOpdTriage.value
                        ? 'Arrival is complete. Record vitals and nursing intake, then send the patient to the provider queue.'
                        : 'Arrival is complete and the patient is waiting in the nurse triage queue.',
                    primaryLabel: appointmentHref
                        ? canRecordOpdTriage.value
                            ? 'Open triage workflow'
                            : 'Open appointment'
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
                        ? canManageProviderSession.value
                            ? 'Open provider workflow'
                            : 'Open appointment'
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
                    primaryLabel: appointmentHref
                        ? 'Open completed visit'
                        : null,
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
const visitHandoffActiveAppointment =
    computed<PatientTimelineAppointment | null>(() => {
        const patientId = visitHandoffPatient.value?.id ?? null;
        if (!patientId) return null;

        return (
            [...visitHandoffAppointments.value]
                .filter(
                    (appointment) =>
                        appointment.patientId === patientId &&
                        patientVisitActiveStatuses.has(
                            String(appointment.status ?? '').trim(),
                        ),
                )
                .sort((left, right) => {
                    const priorityDifference =
                        patientAppointmentWorkflowPriority(right.status) -
                        patientAppointmentWorkflowPriority(left.status);

                    if (priorityDifference !== 0) {
                        return priorityDifference;
                    }

                    return (
                        patientTimelineTimestamp(right.scheduledAt) -
                        patientTimelineTimestamp(left.scheduledAt)
                    );
                })[0] ?? null
        );
    });
const visitHandoffExistingVisitHref = computed(() => {
    const patient = visitHandoffPatient.value;
    const appointment = visitHandoffActiveAppointment.value;
    if (!patient || !appointment || !canReadAppointments.value) return null;

    return patientAppointmentWorkflowHref(patient, appointment);
});
const visitHandoffScheduleAppointmentHref = computed(() => {
    const patient = visitHandoffPatient.value;
    if (!patient || !canCreateAppointments.value) return null;

    return patientContextHref('/appointments', patient, {
        openSchedule: true,
    });
});
const visitHandoffCanCheckIn = computed(
    () =>
        visitHandoffMode.value === 'outpatient' &&
        visitHandoffPatient.value?.status === 'active' &&
        visitHandoffActiveAppointment.value?.status === 'scheduled' &&
        canUpdateAppointmentsStatus.value,
);
const visitHandoffPrimaryHref = computed(() => {
    const patient = visitHandoffPatient.value;
    if (!patient) return null;

    if (visitHandoffMode.value === 'outpatient') {
        return (
            visitHandoffExistingVisitHref.value ??
            visitHandoffScheduleAppointmentHref.value
        );
    }

    if (visitHandoffMode.value === 'emergency') {
        if (canRecordOpdTriage.value) {
            return patientContextHref('/emergency-triage', patient, {
                includeTabNew: true,
            });
        }
        // Clerk: navigate to the emergency triage queue (view only, not the entry form).
        return patientContextHref('/emergency-triage', patient);
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
        if (!appointment) return 'Choose OPD arrival type';
        switch (appointment.status) {
            case 'scheduled':
                return canUpdateAppointmentsStatus.value
                    ? 'Check in patient'
                    : 'Open check-in';
            case 'waiting_triage':
                return canRecordOpdTriage.value
                    ? 'Open triage workflow'
                    : 'Open current visit';
            case 'waiting_provider':
                return canManageProviderSession.value
                    ? 'Open provider workflow'
                    : 'Open current visit';
            case 'in_consultation':
                return 'Open consultation';
            default:
                return 'Open current visit';
        }
    }

    if (visitHandoffMode.value === 'emergency') {
        return canRecordOpdTriage.value
            ? 'Start emergency triage'
            : 'Send to emergency queue';
    }
    if (visitHandoffMode.value === 'billing') return 'Create invoice';
    if (visitHandoffMode.value === 'direct-services') return 'Direct services';
    return 'Open patient chart';
});
const visitHandoffPrimaryIcon = computed(() => {
    if (visitHandoffMode.value === 'emergency') return 'activity';
    if (visitHandoffMode.value === 'billing') return 'receipt';
    if (visitHandoffMode.value === 'direct-services') return 'flask-conical';
    if (visitHandoffMode.value === 'chart') return 'book-open';
    return visitHandoffActiveAppointment.value
        ? 'calendar-clock'
        : 'calendar-plus-2';
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
        if (
            !visitHandoffActiveAppointment.value &&
            !canCreateAppointments.value
        ) {
            return 'This account cannot create visits. Ask scheduling to book, or choose another handoff route.';
        }
    }

    if (visitHandoffMode.value === 'emergency' && !canRecordOpdTriage.value) {
        return null;
    }

    if (
        visitHandoffMode.value === 'billing' &&
        !canCreateBillingInvoices.value
    ) {
        return 'This account cannot create invoices. Ask billing or cashier staff, or choose another route.';
    }

    if (visitHandoffMode.value === 'chart' && !canReadPatients.value) {
        return 'This account cannot open the chart. Ask a clinician or supervisor for access.';
    }

    return null;
});
const visitHandoffHasAnyDirectServiceRight = computed(
    () =>
        canCreateLaboratoryOrders.value ||
        canCreatePharmacyOrders.value ||
        canCreateRadiologyOrders.value ||
        canCreateTheatreProcedures.value ||
        canCreateBillingInvoices.value,
);

/** Walk-in handoff when reception can queue or staff can open order workspaces. */
const visitHandoffCanUseDirectServicesRoute = computed(
    () =>
        canReadPatients.value &&
        (canCreateServiceRequests.value ||
            visitHandoffHasAnyDirectServiceRight.value),
);

const visitHandoffPrimaryDescription = computed(() => {
    const appointment = visitHandoffActiveAppointment.value;

    if (visitHandoffMode.value === 'outpatient') {
        if (!appointment) {
            return 'Decide whether the patient is here now as a walk-in or booking a future OPD visit before creating the visit shell.';
        }

        if (
            appointment.status === 'scheduled' &&
            canUpdateAppointmentsStatus.value
        ) {
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
            return 'You need direct service queue permission (service.requests.create) or departmental order access to use this lane. Choose another route or ask a supervisor.';
        }
        if (visitHandoffHasAnyDirectServiceRight.value) {
            return 'Open the department workspace below; the patient is attached so you can enter the order there.';
        }
        if (canCreateServiceRequests.value) {
            return 'Tap a counter to add one direct service ticket to that department queue.';
        }
        return 'Choose an action below.';
    }

    return 'Open chart-only when staff need context without starting a new visit.';
});

const visitHandoffDirectServiceSessionTickets = computed(() => {
    const patient = visitHandoffPatient.value;
    if (!patient) return [];
    const defs: ReadonlyArray<{
        key: DirectServiceRequestType;
        label: string;
    }> = [
        { key: 'laboratory', label: 'Lab' },
        { key: 'radiology', label: 'Imaging' },
        { key: 'pharmacy', label: 'Pharmacy' },
        { key: 'theatre_procedure', label: 'Procedure' },
    ];
    const out: Array<{
        key: DirectServiceRequestType;
        label: string;
        requestNumber: string;
    }> = [];
    for (const row of defs) {
        const rec = directServiceSentMap.value[`${patient.id}:${row.key}`];
        if (rec) {
            out.push({ ...row, requestNumber: rec.requestNumber });
        }
    }
    return out;
});

const visitHandoffEmergencyNeedsTriageStaff = computed(
    () =>
        visitHandoffMode.value === 'emergency' &&
        Boolean(visitHandoffPatient.value) &&
        visitHandoffPatient.value!.status === 'active' &&
        !canRecordOpdTriage.value,
);

const visitHandoffSourceLabel = computed(() => {
    if (visitHandoffSource.value === 'post-registration')
        return 'Post registration';
    if (visitHandoffSource.value === 'details') return 'Patient details';
    return 'Patient list';
});
const detailsAuditTotalEntries = computed(
    () => detailsAuditMeta.value?.total ?? detailsAuditLogs.value.length,
);
const detailsAuditSummary = computed(() => {
    const total =
        detailsAuditMeta.value?.total ?? detailsAuditLogs.value.length;
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
    if (action)
        filters.push({ key: 'action', label: `Exact action: ${action}` });
    if (detailsAuditFilters.actorType) {
        filters.push({
            key: 'actorType',
            label: `Actor type: ${auditFieldLabel(detailsAuditFilters.actorType)}`,
        });
    }
    if (actorId)
        filters.push({ key: 'actorId', label: `Actor user ID: ${actorId}` });
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
    if (typeof options?.min === 'number' && parsed < options.min)
        return fallback;

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

function queryAllowedParam(
    name: string,
    allowed: string[],
    fallback = '',
): string {
    const value = queryParam(name);
    return (
        allowed.find(
            (option) => option.toLowerCase() === value.toLowerCase(),
        ) ?? fallback
    );
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
    patientCountryOption(
        registrationForm.countryCode || defaultPatientCountryCode.value,
    ),
);
const registrationCountryOptions = computed(() =>
    patientCountryOptionsForSelect(
        registrationForm.countryCode || defaultPatientCountryCode.value,
    ),
);
const editCountryUi = computed(() =>
    patientCountryOption(
        editForm.countryCode || defaultPatientCountryCode.value,
    ),
);
const editCountryOptions = computed(() =>
    patientCountryOptionsForSelect(
        editForm.countryCode || defaultPatientCountryCode.value,
    ),
);
const registrationCountryCode = computed(
    () => registrationForm.countryCode || defaultPatientCountryCode.value,
);
const editCountryCode = computed(
    () => editForm.countryCode || defaultPatientCountryCode.value,
);
const patientFilterCountryCode = computed(
    () => defaultPatientCountryCode.value,
);
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

function historicalRegionOptionsForCountry(
    countryCode: string,
): SearchableSelectOption[] {
    const normalizedCountry = normalizeCountryCode(countryCode);
    if (!normalizedCountry) return [];

    return mergeSearchableOptions(
        patients.value
            .filter(
                (patient) =>
                    normalizeCountryCode(patient.countryCode) ===
                    normalizedCountry,
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
                    normalizeCountryCode(patient.countryCode) ===
                        normalizedCountry &&
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
        regionPresetOptions(
            patientLocationPresetsForCountry(registrationCountryCode.value),
        ),
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
        regionPresetOptions(
            patientLocationPresetsForCountry(editCountryCode.value),
        ),
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
        regionPresetOptions(
            patientLocationPresetsForCountry(patientFilterCountryCode.value),
        ),
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

const registrationDuplicateDateOfBirth = computed(
    () =>
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
        {
            key: 'name',
            complete: Boolean(
                registrationForm.firstName.trim() &&
                registrationForm.lastName.trim(),
            ),
        },
        { key: 'gender', complete: Boolean(registrationForm.gender) },
        { key: 'birth', complete: hasAgeOrDob },
        { key: 'phone', complete: Boolean(registrationForm.phone.trim()) },
        {
            key: 'location',
            complete: Boolean(
                registrationForm.region.trim() &&
                registrationForm.district.trim(),
            ),
        },
        {
            key: 'address',
            complete: Boolean(registrationForm.addressLine.trim()),
        },
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
    const element = document.querySelector<HTMLMetaElement>(
        'meta[name="csrf-token"]',
    );
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

    const element = document.querySelector<HTMLMetaElement>(
        'meta[name="csrf-token"]',
    );
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

    const payload = (await response
        .json()
        .catch(() => ({}))) as ValidationErrorResponse;

    if (!response.ok) {
        const error = new Error(
            payload.message ?? `${response.status} ${response.statusText}`,
        ) as Error & {
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
    return (
        [patient.firstName, patient.middleName, patient.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() ||
        patient.patientNumber ||
        'Unnamed patient'
    );
}

function patientInitials(patient: Patient): string {
    const first = (patient.firstName ?? '').charAt(0).toUpperCase();
    const last = (patient.lastName ?? '').charAt(0).toUpperCase();
    return first + last || '?';
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
    options?: {
        includeTabNew?: boolean;
        openSchedule?: boolean;
    },
) {
    const params = new URLSearchParams();
    if (options?.includeTabNew) params.set('tab', 'new');
    if (options?.openSchedule) params.set('open', 'schedule');
    params.set('patientId', patient.id);
    if (options?.openSchedule) {
        params.set('patientName', patientName(patient));
        if (patient.patientNumber)
            params.set('patientNumber', patient.patientNumber);
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
        (appointment.status === 'waiting_provider' ||
            appointment.status === 'in_consultation') &&
        canManageProviderSession.value
    ) {
        extra.view = 'clinical';
    }

    return patientTimelineHref('/appointments', patient.id, extra, {
        includePatientId: false,
    });
}

function visitHandoffDefaultMode(): PatientVisitHandoffMode {
    if (
        (visitHandoffActiveAppointment.value && canReadAppointments.value) ||
        canCreateAppointments.value
    ) {
        return 'outpatient';
    }

    if (canRecordOpdTriage.value) {
        return 'emergency';
    }

    if (
        canCreateLaboratoryOrders.value ||
        canCreatePharmacyOrders.value ||
        canCreateRadiologyOrders.value ||
        canCreateTheatreProcedures.value
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
        code === 'FACILITY_ENTITLEMENT_REQUIRED' ||
        code === 'FACILITY_SUBSCRIPTION_REQUIRED' ||
        code === 'FACILITY_SUBSCRIPTION_EXPIRED' ||
        code === 'FACILITY_SUBSCRIPTION_RESTRICTED'
    );
}

async function createDirectServiceRequest(
    serviceType: DirectServiceRequestType,
): Promise<void> {
    const patient = visitHandoffPatient.value;
    if (!patient || directServiceSending.value !== null) return;

    const ticketKey = `${patient.id}:${serviceType}`;
    if (directServiceSentMap.value[ticketKey]) return;

    directServiceSending.value = serviceType;
    const labelMap = {
        laboratory: 'Lab',
        pharmacy: 'Pharmacy',
        radiology: 'Imaging',
        theatre_procedure: 'Procedure',
    } as const;

    const appointment = visitHandoffActiveAppointment.value;

    type ServiceRequestResponse = {
        data: { requestNumber: string; serviceType: string };
    };

    try {
        let response: ServiceRequestResponse;
        try {
            response = await apiPost<ServiceRequestResponse>(
                '/service-requests',
                {
                    body: {
                        patientId: patient.id,
                        serviceType,
                        priority: 'routine',
                        ...(appointment
                            ? { appointmentId: appointment.id }
                            : {}),
                    },
                    entitlementContext: 'Walk-in service request',
                },
            );
        } catch (firstError: unknown) {
            if (isApiClientError(firstError) && firstError.status === 419) {
                await refreshCsrfToken();
                response = await apiPost<ServiceRequestResponse>(
                    '/service-requests',
                    {
                        body: {
                            patientId: patient.id,
                            serviceType,
                            priority: 'routine',
                            ...(appointment
                                ? { appointmentId: appointment.id }
                                : {}),
                        },
                        entitlementContext: 'Walk-in service request',
                    },
                );
            } else {
                throw firstError;
            }
        }

        const requestNumber = response.data?.requestNumber;
        if (!requestNumber) {
            notifyError(
                'Walk-in ticket was created but the response did not include a ticket number. Refresh and check the department queue.',
            );
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
            `Done - ${labelMap[serviceType]} direct service ticket ${requestNumber} created for ${patient.firstName} ${patient.lastName}. This patient is listed on that department's queue.`,
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

function directServiceQueueHref(serviceType: DirectServiceRequestType): string {
    const params = new URLSearchParams({ serviceType, status: 'pending' });
    return `/walk-in-service-requests?${params.toString()}`;
}

async function copyDirectServiceTicket(ticket: {
    label: string;
    requestNumber: string;
}): Promise<void> {
    try {
        await navigator.clipboard.writeText(
            `${ticket.label} direct service ticket ${ticket.requestNumber}`,
        );
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
        const response = await apiRequest<
            PatientTimelineListResponse<PatientTimelineAppointment>
        >('GET', '/appointments', {
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
        visitHandoffError.value = messageFromUnknown(
            error,
            'Unable to check current visit context.',
        );
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
    const existingIndex = visitHandoffAppointments.value.findIndex(
        (appointment) => appointment.id === updated.id,
    );

    if (existingIndex === -1) {
        visitHandoffAppointments.value = [
            updated,
            ...visitHandoffAppointments.value,
        ];
    } else {
        visitHandoffAppointments.value = visitHandoffAppointments.value.map(
            (appointment, index) =>
                index === existingIndex
                    ? { ...appointment, ...updated }
                    : appointment,
        );
    }

    detailsTimelineAppointments.value = detailsTimelineAppointments.value.map(
        (appointment) =>
            appointment.id === updated.id
                ? { ...appointment, ...updated }
                : appointment,
    );
}

async function checkInVisitFromHandoff() {
    const appointment = visitHandoffActiveAppointment.value;
    if (
        !appointment ||
        appointment.status !== 'scheduled' ||
        !canUpdateAppointmentsStatus.value
    ) {
        return;
    }

    visitHandoffSubmitting.value = true;
    visitHandoffActionError.value = null;

    try {
        const response = await apiRequest<{ data: PatientTimelineAppointment }>(
            'PATCH',
            `/appointments/${appointment.id}/status`,
            {
                body: {
                    status: 'waiting_triage',
                    reason: null,
                },
            },
        );

        replaceVisitHandoffAppointment(response.data);
        visitHandoffMode.value = 'outpatient';
        notifySuccess(
            'Patient checked in. Visit is now waiting for nurse triage.',
        );
    } catch (error) {
        const apiError = error as Error & { payload?: ValidationErrorResponse };
        visitHandoffActionError.value =
            apiError.payload?.message ??
            messageFromUnknown(error, 'Unable to check in patient.');
        notifyError(visitHandoffActionError.value);
    } finally {
        visitHandoffSubmitting.value = false;
    }
}

async function startOutpatientWalkInFromHandoff(): Promise<void> {
    const patient = visitHandoffPatient.value;
    if (
        !patient ||
        patient.status !== 'active' ||
        !canCreateAppointments.value ||
        !canUpdateAppointmentsStatus.value
    ) {
        return;
    }

    visitHandoffSubmitting.value = true;
    visitHandoffActionError.value = null;

    try {
        const created = await apiRequest<{ data: PatientTimelineAppointment }>(
            'POST',
            '/appointments',
            {
                body: {
                    patientId: patient.id,
                    appointmentType: 'walk_in',
                    scheduledAt: new Date(Date.now() + 60_000).toISOString(),
                    reason: 'OPD walk-in - created from patient handoff',
                },
            },
        );

        const updated = await apiRequest<{ data: PatientTimelineAppointment }>(
            'PATCH',
            `/appointments/${created.data.id}/status`,
            {
                body: {
                    status: 'waiting_triage',
                    reason: 'OPD walk-in checked in from patient handoff',
                },
            },
        );

        replaceVisitHandoffAppointment(updated.data);
        visitHandoffMode.value = 'outpatient';
        notifySuccess(
            'OPD walk-in started. Patient is now waiting for nurse triage.',
        );
    } catch (error) {
        const apiError = error as Error & { payload?: ValidationErrorResponse };
        visitHandoffActionError.value =
            apiError.payload?.message ??
            messageFromUnknown(error, 'Unable to start OPD walk-in.');
        notifyError(visitHandoffActionError.value);
    } finally {
        visitHandoffSubmitting.value = false;
    }
}

async function sendToEmergencyQueue(): Promise<void> {
    const patient = visitHandoffPatient.value;
    if (!patient) return;

    visitHandoffSubmitting.value = true;
    visitHandoffActionError.value = null;

    try {
        // Create a walk-in appointment at the current time.
        const created = await apiRequest<{ data: PatientTimelineAppointment }>(
            'POST',
            '/appointments',
            {
                body: {
                    patientId: patient.id,
                    appointmentType: 'walk_in',
                    scheduledAt: new Date(Date.now() + 60_000).toISOString(),
                    reason: 'Emergency — directed to triage by registration',
                },
            },
        );

        // Immediately advance status to waiting_triage so it appears in the triage queue.
        const updated = await apiRequest<{ data: PatientTimelineAppointment }>(
            'PATCH',
            `/appointments/${created.data.id}/status`,
            {
                body: {
                    status: 'waiting_triage',
                    reason: 'Patient directed to emergency triage queue by registration',
                },
            },
        );

        replaceVisitHandoffAppointment(updated.data);
        notifySuccess(
            'Patient is now in the emergency triage queue. Triage staff will take over from there.',
        );
    } catch (error) {
        const apiError = error as Error & { payload?: ValidationErrorResponse };
        visitHandoffActionError.value =
            apiError.payload?.message ??
            messageFromUnknown(
                error,
                'Unable to queue patient for emergency triage.',
            );
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
        visitHandoffModeAvailable(mode)
            ? ''
            : 'pointer-events-none cursor-not-allowed opacity-55',
    ]
        .filter(Boolean)
        .join(' ');
}

function visitHandoffModeBadge(mode: PatientVisitHandoffMode): string {
    if (mode === 'outpatient' && visitHandoffActiveAppointment.value) {
        return 'Use existing';
    }

    if (mode === 'outpatient') return 'Standard';
    if (mode === 'emergency') return 'Urgent';
    if (mode === 'direct-services') return 'Direct';
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

function sortTimelineEvents(
    events: PatientTimelineEvent[],
): PatientTimelineEvent[] {
    return [...events].sort((a, b) => {
        const left = a.occurredAt
            ? new Date(a.occurredAt).getTime()
            : Number.NEGATIVE_INFINITY;
        const right = b.occurredAt
            ? new Date(b.occurredAt).getTime()
            : Number.NEGATIVE_INFINITY;
        return right - left;
    });
}

function patientAppointmentWorkflowPriority(
    status: string | null | undefined,
): number {
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

function activityFeedActorLabel(
    event: PatientActivityFeedEvent,
): string | null {
    const displayName = event.actor?.displayName?.trim();
    if (displayName) return displayName;
    if (
        event.actorType === 'system' ||
        event.actorId === null ||
        event.actorId === undefined
    )
        return 'System';
    return `User #${event.actorId}`;
}

function activityFeedActorTypeLabel(
    event: PatientActivityFeedEvent,
): string | null {
    if (event.actorType === 'system') return 'System';
    if (event.actorType === 'user') return 'User';
    return event.actorId === null || event.actorId === undefined
        ? 'System'
        : 'User';
}

function activityFeedEventTitle(event: PatientActivityFeedEvent): string {
    const label = event.actionLabel?.trim();
    if (label) return label;

    const action = event.action?.trim();
    return action ? auditFieldLabel(action) : 'Patient Activity';
}

function activityFeedEventDescription(
    event: PatientActivityFeedEvent,
    patient: Patient,
): string {
    const action = event.action?.trim() ?? '';

    if (action === 'patient.created') {
        return patient.patientNumber
            ? tW2('timeline.profileRegisteredDescriptionWithNumber', {
                  patientNumber: patient.patientNumber,
              })
            : tW2('timeline.profileRegisteredDescriptionDefault');
    }

    if (action === 'patient.updated') {
        return tW2('timeline.demographicsUpdatedDescription');
    }

    if (action === 'patient.status.updated') {
        return patient.statusReason || tW2('timeline.statusChangedDescription');
    }

    if (action.includes('allergy')) {
        return 'Medication safety information was updated for this patient.';
    }

    if (action.includes('medication-profile')) {
        return 'Medication profile information was updated for this patient.';
    }

    return 'Patient record activity was captured in the audit trail.';
}

function activityFeedEventBadge(event: PatientActivityFeedEvent): string {
    const action = event.action?.trim() ?? '';
    if (action.includes('status')) return tW2('timeline.badgeStatus');
    if (action.includes('allergy') || action.includes('medication-profile'))
        return 'Safety';
    return tW2('timeline.badgeProfile');
}

function activityFeedEventToTimelineEvent(
    event: PatientActivityFeedEvent,
    patient: Patient,
): PatientTimelineEvent {
    return {
        id: `patient-activity-${event.id}`,
        occurredAt: event.occurredAt,
        title: activityFeedEventTitle(event),
        description: activityFeedEventDescription(event, patient),
        href: null,
        badge: activityFeedEventBadge(event),
        category: 'profile',
        actorLabel: activityFeedActorLabel(event),
        actorType: activityFeedActorTypeLabel(event),
    };
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
                patient.statusReason ||
                tW2('timeline.statusChangedDescription'),
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

    const [
        activityFeedResult,
        appointmentsResult,
        admissionsResult,
        medicalRecordsResult,
    ] = await Promise.allSettled([
        apiRequest<PatientTimelineListResponse<PatientActivityFeedEvent>>(
            'GET',
            `/patients/${patient.id}/activity-feed`,
            {
                query: {
                    page: 1,
                    perPage: 12,
                },
            },
        ),
        canReadAppointments.value
            ? apiRequest<
                  PatientTimelineListResponse<PatientTimelineAppointment>
              >('GET', '/appointments', {
                  query: {
                      patientId: patient.id,
                      page: 1,
                      perPage: 8,
                      sortBy: 'scheduledAt',
                      sortDir: 'desc',
                  },
              })
            : Promise.resolve(
                  emptyTimelineListResponse<PatientTimelineAppointment>(),
              ),
        canReadAdmissions.value
            ? apiRequest<PatientTimelineListResponse<PatientTimelineAdmission>>(
                  'GET',
                  '/admissions',
                  {
                      query: {
                          patientId: patient.id,
                          page: 1,
                          perPage: 8,
                          sortBy: 'admittedAt',
                          sortDir: 'desc',
                      },
                  },
              )
            : Promise.resolve(
                  emptyTimelineListResponse<PatientTimelineAdmission>(),
              ),
        canFetchMedicalRecordsForTimeline.value
            ? apiRequest<
                  PatientTimelineListResponse<PatientTimelineMedicalRecord>
              >('GET', '/medical-records', {
                  query: {
                      patientId: patient.id,
                      page: 1,
                      perPage: 8,
                      sortBy: 'encounterAt',
                      sortDir: 'desc',
                  },
              })
            : Promise.resolve(
                  emptyTimelineListResponse<PatientTimelineMedicalRecord>(),
              ),
    ]);

    if (requestToken !== timelineRequestToken) {
        return;
    }

    const loadFailures: string[] = [];

    if (
        activityFeedResult.status === 'fulfilled' &&
        (activityFeedResult.value.data ?? []).length > 0
    ) {
        detailsTimelineProfileEvents.value = sortTimelineEvents(
            (activityFeedResult.value.data ?? []).map((event) =>
                activityFeedEventToTimelineEvent(event, patient),
            ),
        );
    }

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
                href: patientTimelineHref(
                    '/appointments',
                    patient.id,
                    {
                        focusAppointmentId: item.id,
                    },
                    { includePatientId: false },
                ),
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

const activePatientInsuranceRecord = computed(
    () =>
        detailsInsuranceRecords.value.find(
            (record) => (record.status ?? '').toLowerCase() === 'active',
        ) ?? null,
);

function resetInsuranceForm() {
    insuranceForm.billingPayerContractId = '';
    insuranceForm.insuranceType = 'insurance';
    insuranceForm.insuranceProvider = '';
    insuranceForm.providerCode = '';
    insuranceForm.memberId = '';
    insuranceForm.cardNumber = '';
    insuranceForm.verificationStatus = 'unverified';
}

async function loadPatientInsurance(patientId: string) {
    if (!canReadPatientInsurance.value) {
        detailsInsuranceRecords.value = [];
        return;
    }

    detailsInsuranceLoading.value = true;
    detailsInsuranceError.value = null;
    try {
        const response = await apiRequest<PatientInsuranceListResponse>(
            'GET',
            `/patients/${patientId}/insurance`,
        );
        detailsInsuranceRecords.value = response.data ?? [];
    } catch (error) {
        detailsInsuranceRecords.value = [];
        detailsInsuranceError.value = messageFromUnknown(
            error,
            'Unable to load patient insurance.',
        );
    } finally {
        detailsInsuranceLoading.value = false;
    }
}

async function loadPatientInsuranceOptions() {
    if (
        !canReadPatientInsurance.value ||
        patientInsuranceProviderPresets.value.length > 0
    )
        return;

    detailsInsuranceOptionsLoading.value = true;
    try {
        const response = await apiRequest<PatientInsuranceOptionResponse>(
            'GET',
            '/patients/insurance-options',
        );
        patientInsuranceProviderPresets.value =
            response.data?.providerPresets ?? [];
        patientInsurancePayerContracts.value =
            response.data?.payerContracts ?? [];
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
    if (!normalized) {
        insuranceForm.insuranceProvider = '';
        return;
    }

    const preset = patientInsuranceProviderPresets.value.find(
        (option) => option.code === normalized,
    );
    if (preset) {
        insuranceForm.insuranceProvider = preset.name;
        insuranceForm.insuranceType =
            preset.insuranceType || insuranceForm.insuranceType;
    }
}

function applyInsurancePayerContract(id: string | undefined) {
    const normalized = id ?? '';
    insuranceForm.billingPayerContractId = normalized;
    const contract = patientInsurancePayerContracts.value.find(
        (option) => option.id === normalized,
    );
    if (!contract) return;

    insuranceForm.insuranceType =
        contract.payerType || insuranceForm.insuranceType;
    insuranceForm.insuranceProvider =
        contract.payerName ?? insuranceForm.insuranceProvider;
}

function fillInsuranceIdentifierFromNationalId() {
    const nationalId = detailsSheetPatient.value?.nationalId?.trim();
    if (nationalId) {
        insuranceForm.cardNumber = nationalId;
    }
}

async function submitPatientInsurance() {
    if (!detailsSheetPatient.value || detailsInsuranceSaving.value) return;

    detailsInsuranceSaving.value = true;
    detailsInsuranceError.value = null;
    try {
        await apiRequest<{ data: PatientInsuranceRecord }>(
            'POST',
            `/patients/${detailsSheetPatient.value.id}/insurance`,
            {
                body: {
                    billingPayerContractId:
                        insuranceForm.billingPayerContractId || null,
                    insuranceType: insuranceForm.insuranceType || null,
                    insuranceProvider: insuranceForm.insuranceProvider || null,
                    providerCode: insuranceForm.providerCode || null,
                    memberId: insuranceForm.memberId.trim() || null,
                    cardNumber: insuranceForm.cardNumber.trim() || null,
                    verificationStatus: insuranceForm.verificationStatus,
                },
            },
        );
        notifySuccess('Patient insurance saved.');
        resetInsuranceForm();
        insuranceFormOpen.value = false;
        await loadPatientInsurance(detailsSheetPatient.value.id);
    } catch (error) {
        detailsInsuranceError.value = messageFromUnknown(
            error,
            'Unable to save patient insurance.',
        );
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
        detailsInsuranceError.value = messageFromUnknown(
            error,
            'Unable to verify insurance.',
        );
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
    if (['inactive', 'deceased', 'archived', 'suspended'].includes(normalized))
        return 'destructive';
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
    for (
        let p = Math.max(2, current - 1);
        p <= Math.min(total - 1, current + 1);
        p++
    ) {
        pages.push(p);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
});

const scopeStatusLabel = computed(() => {
    if (!scope.value) return 'Scope Unavailable';
    return scope.value.resolvedFrom === 'none'
        ? 'Scope Unresolved'
        : 'Scope Ready';
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

function filterValueFromSelect(
    value: string | number | null | undefined,
): string {
    const normalized = String(value ?? '');
    return normalized === SELECT_ALL_VALUE ? '' : normalized;
}

function optionLabel(
    options: Array<{ value: string; label: string }>,
    value: string,
): string {
    return (
        options.find((option) => option.value === value)?.label ??
        formatEnumLabel(value)
    );
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

    const fallbackTotal = Math.max(
        fallbackVisibleTotal,
        pagination.value?.total ?? 0,
    );

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
        chips.push({
            key: 'region',
            label: `Region: ${searchForm.region.trim()}`,
        });
    }

    if (searchForm.district.trim()) {
        chips.push({
            key: 'district',
            label: `District: ${searchForm.district.trim()}`,
        });
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
        const response = await apiRequest<{ data: ScopeData }>(
            'GET',
            '/platform/access-scope',
        );
        scope.value = response.data;
    } catch (error) {
        listErrors.value.push(
            `Scope: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
    }
}

async function loadCountryProfile() {
    try {
        const response = await apiRequest<CountryProfileResponse>(
            'GET',
            '/platform/country-profile',
        );
        const resolvedCode =
            normalizeCountryCode(response.data?.profile?.code) ||
            normalizeCountryCode(response.data?.activeCode);
        const profiles = Array.isArray(response.data?.availableProfiles)
            ? (response.data?.availableProfiles ?? [])
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
        const response = await apiRequest<AuthPermissionsResponse>(
            'GET',
            '/auth/me/permissions',
        );
        const names = new Set(
            (response.data ?? [])
                .map((permission) => permission.name?.trim())
                .filter((name): name is string => Boolean(name)),
        );
        patientReadPermissionState.value = names.has('patients.read')
            ? 'allowed'
            : 'denied';
        canViewPatientAudit.value = names.has('patients.view-audit-logs');
        canReadAppointments.value = names.has('appointments.read');
        canCreateAppointments.value = names.has('appointments.create');
        canUpdateAppointmentsStatus.value = names.has(
            'appointments.update-status',
        );
        canReadAdmissions.value = names.has('admissions.read');
        canReadMedicalRecords.value = names.has('medical.records.read');
        canCreateBillingInvoices.value = names.has('billing.invoices.create');
        canCreatePatients.value = names.has('patients.create');
        canUpdatePatients.value = names.has('patients.update');
        canUpdatePatientStatus.value = names.has('patients.update-status');
        canReadPatientInsurance.value = names.has('patients.insurance.read');
        canManagePatientInsurance.value = names.has(
            'patients.insurance.manage',
        );
        canVerifyPatientInsurance.value = names.has(
            'patients.insurance.verify',
        );
        canRecordOpdTriage.value =
            names.has('emergency.triage.create') ||
            names.has('emergency.triage.update-status');
        canCreateLaboratoryOrders.value = names.has('laboratory.orders.create');
        canCreatePharmacyOrders.value = names.has('pharmacy.orders.create');
        canCreateRadiologyOrders.value = names.has('radiology.orders.create');
        canCreateTheatreProcedures.value = names.has(
            'theatre.procedures.create',
        );
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
    patientListOfflineUnavailable.value = false;

    try {
        const response = await apiRequest<PatientListResponse>(
            'GET',
            '/patients',
            {
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
            },
        );

        patients.value = response.data;
        pagination.value = response.meta;
        patientListOfflineUnavailable.value = false;
    } catch (error) {
        if (isLikelyPatientOfflineFailure(error)) {
            browserOnline.value = false;
            patientListOfflineUnavailable.value = true;
            pagination.value = null;
            return;
        }

        patients.value = [];
        pagination.value = null;
        listErrors.value.push(
            error instanceof Error ? error.message : 'Unable to load patients.',
        );
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
        const response = await apiRequest<PatientStatusCountsResponse>(
            'GET',
            '/patients/status-counts',
            {
                query: {
                    q: searchForm.q.trim() || null,
                },
            },
        );

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
        if (typeof entryValue === 'string' && entryValue.trim() === '')
            return false;
        if (Array.isArray(entryValue) && entryValue.length === 0) return false;
        return true;
    });
}

function isAuditRecordObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createdPatientSnapshot(
    log: PatientAuditLog,
): Record<string, unknown> | null {
    if (log.action !== 'patient.created' || !log.changes) return null;

    const snapshot = log.changes.after;
    return isAuditRecordObject(snapshot) ? snapshot : null;
}

function auditLogChangeKeys(log: PatientAuditLog): string[] {
    if (createdPatientSnapshot(log)) {
        return [];
    }

    return auditObjectEntries(log.changes)
        .map(([key]) => auditFieldLabel(key))
        .slice(0, 4);
}

function auditLogChangeSummaryLabel(log: PatientAuditLog): string {
    return createdPatientSnapshot(log) ? 'Audit detail:' : 'Fields changed:';
}

function auditLogChangeSummaryBadges(log: PatientAuditLog): string[] {
    if (createdPatientSnapshot(log)) {
        return ['Record created'];
    }

    return auditLogChangeKeys(log);
}

function auditSnapshotString(value: unknown): string | null {
    const preview = auditValuePreview(value);
    return preview === null ? null : preview;
}

function auditCreatedSnapshotPreview(log: PatientAuditLog): Array<{
    key: string;
    value: string;
}> {
    const snapshot = createdPatientSnapshot(log);
    if (!snapshot) return [];

    const name = [snapshot.first_name, snapshot.middle_name, snapshot.last_name]
        .filter(
            (value): value is string =>
                typeof value === 'string' && value.trim() !== '',
        )
        .join(' ')
        .trim();

    return [
        {
            key: 'Patient number',
            value: auditSnapshotString(snapshot.patient_number),
        },
        { key: 'Name', value: name || null },
        {
            key: 'Date of birth',
            value: auditSnapshotString(snapshot.date_of_birth),
        },
        { key: 'Phone', value: auditSnapshotString(snapshot.phone) },
        { key: 'Status', value: auditSnapshotString(snapshot.status) },
    ]
        .filter(
            (entry): entry is { key: string; value: string } =>
                entry.value !== null,
        )
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
        .filter(
            (entry): entry is { key: string; value: string } =>
                entry.value !== null,
        )
        .slice(0, 3);
}

function auditLogActorTypeLabel(log: PatientAuditLog): string {
    if (log.actorType === 'system') return 'System';
    if (log.actorType === 'user') return 'User';
    return log.actorId === null || log.actorId === undefined
        ? 'System'
        : 'User';
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
        detailsAuditError.value = messageFromUnknown(
            error,
            'Unable to load patient audit logs.',
        );
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
    if (
        !detailsSheetPatient.value ||
        !canViewPatientAudit.value ||
        detailsAuditExporting.value
    ) {
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
    await Promise.all([
        loadScope(),
        loadCountryProfile(),
        loadPatientPermissions(),
    ]);
    await Promise.all([loadPatients(), loadPatientStatusCounts()]);
}

async function initialPageLoad() {
    clearSearchDebounce();
    if (!scope.value || !isPatientReadPermissionResolved.value) {
        await refreshPage();
        return;
    }

    await Promise.all([
        loadCountryProfile(),
        loadPatients(),
        loadPatientStatusCounts(),
    ]);
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
        notifyError(
            'Request patients.create permission to register a patient.',
        );
        return;
    }

    resetCreateMessages();
    clearPreSubmitDuplicateState();

    const draft = loadDraftFromStorage();
    if (draft) {
        // Open with blank form first, then show the resume prompt inside the sheet
        resetRegistrationForm();
        draftResumeVisible.value = true;
    } else {
        resetRegistrationForm();
    }

    registerDialogOpen.value = true;
}

function resumeDraft(): void {
    const draft = loadDraftFromStorage();
    if (draft) applyDraftToForm(draft);
    draftResumeVisible.value = false;
}

function discardDraft(): void {
    clearDraftFromStorage();
    draftResumeVisible.value = false;
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
    preSubmitDuplicateWarningAcknowledged.value = false;
}

function continueRegistrationAfterDuplicateReview() {
    preSubmitDuplicateWarningAcknowledged.value = true;
    void createPatient();
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

function normalizePhoneForDuplicate(value: string | null | undefined): string {
    const digits = (value ?? '').replace(/\D+/g, '');

    if (digits.length === 12 && digits.startsWith('255')) return digits;
    if (digits.length === 10 && digits.startsWith('0'))
        return `255${digits.slice(1)}`;
    if (digits.length === 9) return `255${digits}`;

    return digits;
}

function normalizeIdentifierForDuplicate(
    value: string | null | undefined,
): string {
    return (value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

function duplicateDisplayValue(
    value: string | null | undefined,
    fallback = 'Not recorded',
): string {
    const normalized = (value ?? '').trim();
    return normalized || fallback;
}

function duplicateComparableValue(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function duplicatePhoneMatches(
    left: string | null | undefined,
    right: string | null | undefined,
): boolean {
    const leftPhone = normalizePhoneForDuplicate(left);
    const rightPhone = normalizePhoneForDuplicate(right);
    return Boolean(leftPhone && rightPhone && leftPhone === rightPhone);
}

function duplicateIdentifierMatches(
    left: string | null | undefined,
    right: string | null | undefined,
): boolean {
    const leftIdentifier = normalizeIdentifierForDuplicate(left);
    const rightIdentifier = normalizeIdentifierForDuplicate(right);
    return Boolean(
        leftIdentifier && rightIdentifier && leftIdentifier === rightIdentifier,
    );
}

function duplicateValueMatches(
    left: string | null | undefined,
    right: string | null | undefined,
): boolean {
    const leftValue = duplicateComparableValue(left);
    const rightValue = duplicateComparableValue(right);
    return Boolean(leftValue && rightValue && leftValue === rightValue);
}

function duplicateDateMatches(
    left: string | null | undefined,
    right: string | null | undefined,
): boolean {
    const leftDate = (left ?? '').slice(0, 10);
    const rightDate = (right ?? '').slice(0, 10);
    return Boolean(leftDate && rightDate && leftDate === rightDate);
}

function duplicateConfidenceScore(
    payload: ReturnType<typeof payloadFromForm>,
    candidate: Patient,
): number {
    let score = 0;

    if (duplicateValueMatches(payload.firstName, candidate.firstName))
        score += 20;
    if (duplicateValueMatches(payload.lastName, candidate.lastName))
        score += 20;
    if (duplicateDateMatches(payload.dateOfBirth, candidate.dateOfBirth))
        score += 30;
    if (duplicatePhoneMatches(payload.phone, candidate.phone)) score += 15;
    if (duplicateValueMatches(payload.gender, candidate.gender)) score += 10;
    if (duplicateValueMatches(payload.addressLine, candidate.addressLine))
        score += 10;

    return score;
}

function duplicateConfidenceLabel(score: number): 'strong' | 'possible' {
    return score >= 80 ? 'strong' : 'possible';
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
            matched: duplicateValueMatches(
                incomingName,
                patientName(candidate),
            ),
        },
        {
            key: 'phone',
            label: 'Phone',
            incoming: duplicateDisplayValue(registrationForm.phone),
            existing: duplicateDisplayValue(candidate.phone),
            matched: duplicatePhoneMatches(
                registrationForm.phone,
                candidate.phone,
            ),
        },
        {
            key: 'dob',
            label: 'DOB',
            incoming: incomingDob ? formatDate(incomingDob) : 'Not recorded',
            existing: candidate.dateOfBirth
                ? formatDate(candidate.dateOfBirth)
                : 'Not recorded',
            matched: duplicateDateMatches(incomingDob, candidate.dateOfBirth),
        },
        {
            key: 'gender',
            label: 'Gender',
            incoming: duplicateDisplayValue(
                formatEnumLabel(registrationForm.gender),
            ),
            existing: duplicateDisplayValue(
                formatEnumLabel(candidate.gender ?? ''),
            ),
            matched: duplicateValueMatches(
                registrationForm.gender,
                candidate.gender,
            ),
        },
        {
            key: 'id',
            label: 'National ID',
            incoming: duplicateDisplayValue(registrationForm.nationalId),
            existing: duplicateDisplayValue(candidate.nationalId),
            matched: duplicateIdentifierMatches(
                registrationForm.nationalId,
                candidate.nationalId,
            ),
        },
        {
            key: 'location',
            label: 'Location',
            incoming: duplicateDisplayValue(incomingLocation),
            existing: patientLocationLabel(candidate),
            matched: duplicateValueMatches(
                incomingLocation,
                patientLocationLabel(candidate),
            ),
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
    const derived = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

async function refreshOfflinePatientRegistrations(): Promise<void> {
    try {
        const [registrations, updates] = await Promise.all([
            listOfflinePatientRegistrations(),
            listOfflinePatientUpdates(),
        ]);
        offlinePatientRegistrations.value = registrations;
        offlinePatientUpdates.value = updates;
        offlinePatientSyncError.value = null;
    } catch (error) {
        offlinePatientSyncError.value = messageFromUnknown(
            error,
            'Unable to read offline patient changes.',
        );
    }
}

function offlinePatientRecordToListPatient(
    record: OfflinePatientRegistrationRecord,
): Patient {
    return {
        id: record.id,
        patientNumber: record.temporaryPatientNumber,
        firstName: record.payload.firstName,
        middleName: record.payload.middleName,
        lastName: record.payload.lastName,
        gender: record.payload.gender,
        dateOfBirth: record.payload.dateOfBirth,
        phone: record.payload.phone,
        email: record.payload.email,
        nationalId: record.payload.nationalId,
        countryCode: record.payload.countryCode,
        region: record.payload.region,
        district: record.payload.district,
        addressLine: record.payload.addressLine,
        nextOfKinName: record.payload.nextOfKinName,
        nextOfKinPhone: record.payload.nextOfKinPhone,
        status: 'offline_pending',
        statusReason: 'Saved on this device and waiting for cloud sync.',
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}

function addOfflinePatientToCurrentList(
    record: OfflinePatientRegistrationRecord,
): void {
    const patient = offlinePatientRecordToListPatient(record);
    patients.value = [
        patient,
        ...patients.value.filter((existing) => existing.id !== patient.id),
    ];
}

function patientFromOfflineUpdateRecord(
    record: OfflinePatientUpdateRecord,
): Patient {
    return {
        id: record.patientId,
        patientNumber: record.patientNumber,
        firstName: record.payload.firstName,
        middleName: record.payload.middleName,
        lastName: record.payload.lastName,
        gender: record.payload.gender,
        dateOfBirth: record.payload.dateOfBirth,
        phone: record.payload.phone,
        email: record.payload.email,
        nationalId: record.payload.nationalId,
        countryCode: record.payload.countryCode,
        region: record.payload.region,
        district: record.payload.district,
        addressLine: record.payload.addressLine,
        nextOfKinName: record.payload.nextOfKinName,
        nextOfKinPhone: record.payload.nextOfKinPhone,
        status: null,
        statusReason: 'Edited on this device and waiting for cloud sync.',
        createdAt: null,
        updatedAt: record.updatedAt,
    };
}

function applyOfflinePatientUpdate(record: OfflinePatientUpdateRecord): void {
    const patch = patientFromOfflineUpdateRecord(record);
    const idx = patients.value.findIndex(
        (patient) => patient.id === record.patientId,
    );

    if (idx !== -1) {
        patients.value[idx] = {
            ...patients.value[idx],
            ...patch,
            status: patients.value[idx].status,
            createdAt: patients.value[idx].createdAt,
        };
    }

    if (detailsSheetPatient.value?.id === record.patientId) {
        Object.assign(detailsSheetPatient.value, {
            ...patch,
            status: detailsSheetPatient.value.status,
            createdAt: detailsSheetPatient.value.createdAt,
        });
    }

    if (editTargetPatient.value?.id === record.patientId) {
        Object.assign(editTargetPatient.value, {
            ...patch,
            status: editTargetPatient.value.status,
            createdAt: editTargetPatient.value.createdAt,
        });
    }
}

function offlinePatientRecordName(
    record: OfflinePatientRegistrationRecord,
): string {
    return [
        record.payload.firstName,
        record.payload.middleName,
        record.payload.lastName,
    ]
        .filter((part): part is string => Boolean(part && part.trim() !== ''))
        .join(' ');
}

function offlinePatientUpdateRecordName(
    record: OfflinePatientUpdateRecord,
): string {
    return (
        record.patientName ||
        [
            record.payload.firstName,
            record.payload.middleName,
            record.payload.lastName,
        ]
            .filter((part): part is string =>
                Boolean(part && part.trim() !== ''),
            )
            .join(' ') ||
        record.patientNumber ||
        record.patientId.slice(0, 8)
    );
}

async function savePatientRegistrationOffline(
    payload: ReturnType<typeof payloadFromForm>,
): Promise<void> {
    const record = await enqueueOfflinePatientRegistration(payload);
    addOfflinePatientToCurrentList(record);
    offlineLastSavedPatientNumber.value = record.temporaryPatientNumber;
    await refreshOfflinePatientRegistrations();

    notifySuccess(
        `Patient saved offline as ${record.temporaryPatientNumber}. It will upload when internet returns.`,
    );

    resetRegistrationForm();
    clearDraftFromStorage();
    clearPreSubmitDuplicateState();
    registerDialogOpen.value = false;
}

async function syncOfflinePatientRegistrations(options?: {
    silent?: boolean;
}): Promise<void> {
    if (offlinePatientSyncLoading.value) return;
    if (!browserOnline.value) {
        offlinePatientSyncError.value =
            'Device is offline. Sync will retry when internet returns.';
        return;
    }

    offlinePatientSyncLoading.value = true;
    offlinePatientSyncError.value = null;

    try {
        const [registrationResult, updateResult] = await Promise.all([
            syncPendingOfflinePatientRegistrations(),
            syncPendingOfflinePatientUpdates(),
        ]);
        await refreshOfflinePatientRegistrations();

        const synced = registrationResult.synced + updateResult.synced;
        const failed = registrationResult.failed + updateResult.failed;
        const remaining = registrationResult.remaining + updateResult.remaining;

        if (synced > 0) {
            if (!options?.silent) {
                notifySuccess(`${synced} offline patient change(s) uploaded.`);
            }
            if (remaining === 0) {
                offlineLastSavedPatientNumber.value = null;
                offlineLastSavedUpdateLabel.value = null;
            }
            searchForm.page = 1;
            await Promise.all([loadPatients(), loadPatientStatusCounts()]);
        } else if (failed > 0) {
            notifyError(
                'Some offline patient changes need review before they can upload.',
            );
        }
    } catch (error) {
        offlinePatientSyncError.value = messageFromUnknown(
            error,
            'Unable to sync offline patient changes.',
        );
        if (!options?.silent) notifyError(offlinePatientSyncError.value);
    } finally {
        offlinePatientSyncLoading.value = false;
    }
}

function handleBrowserOnline(): void {
    browserOnline.value = true;
    void syncOfflinePatientRegistrations({ silent: true });
}

function handleBrowserOffline(): void {
    browserOnline.value = false;
}

async function findPreSubmitDuplicateMatches(
    payload: ReturnType<typeof payloadFromForm>,
): Promise<Patient[]> {
    if (!canReadPatients.value) return [];

    const queryTerms = [
        payload.nationalId,
        payload.phone,
        [payload.firstName, payload.lastName].filter(Boolean).join(' '),
        payload.lastName,
    ]
        .filter((part): part is string => Boolean(part && part.trim() !== ''))
        .map((part) => part.trim());

    const uniqueQueryTerms = Array.from(new Set(queryTerms));
    if (uniqueQueryTerms.length === 0) return [];

    const responses = await Promise.all(
        uniqueQueryTerms.map((queryTerm) =>
            apiRequest<PatientListResponse>('GET', '/patients', {
                query: {
                    q: queryTerm,
                    status: 'active',
                    page: 1,
                    perPage: 15,
                    sortBy: 'createdAt',
                    sortDir: 'desc',
                },
            }),
        ),
    );

    const expectedNationalId = normalizeIdentifierForDuplicate(
        payload.nationalId,
    );

    const candidates = new Map<string, Patient>();
    for (const response of responses) {
        for (const candidate of response.data ?? []) {
            candidates.set(candidate.id, candidate);
        }
    }

    return Array.from(candidates.values())
        .map((candidate) => {
            const nationalIdMatches = Boolean(
                expectedNationalId &&
                normalizeIdentifierForDuplicate(candidate.nationalId) ===
                    expectedNationalId,
            );
            const score = duplicateConfidenceScore(payload, candidate);

            return {
                ...candidate,
                duplicateConfidence: nationalIdMatches ? 100 : score,
                duplicateConfidenceLabel: duplicateConfidenceLabel(
                    nationalIdMatches ? 100 : score,
                ),
                duplicateMatchType: nationalIdMatches
                    ? 'hard_block'
                    : score >= 80
                      ? 'strong_warning'
                      : 'possible_warning',
            } satisfies Patient;
        })
        .filter((candidate) => {
            const nationalIdMatches = Boolean(
                expectedNationalId &&
                normalizeIdentifierForDuplicate(candidate.nationalId) ===
                    expectedNationalId,
            );

            return (
                nationalIdMatches || (candidate.duplicateConfidence ?? 0) >= 50
            );
        })
        .sort(
            (left, right) =>
                (right.duplicateConfidence ?? 0) -
                (left.duplicateConfidence ?? 0),
        )
        .slice(0, 5);
}

async function createPatient() {
    if (createLoading.value) return;
    if (!canCreatePatients.value) {
        notifyError(
            'Request patients.create permission to register a patient.',
        );
        return;
    }

    resetCreateMessages();
    preSubmitDuplicateCheckError.value = null;

    if (!validateRegistrationForm()) {
        return;
    }

    const payload = payloadFromForm();

    // Fast client-side pre-check (avoids round-trip for obvious duplicates).
    // The backend is the authoritative gate — a 409 will catch anything missed here.
    if (browserOnline.value && !preSubmitDuplicateWarningAcknowledged.value) {
        preSubmitDuplicateCheckLoading.value = true;
        try {
            const matches = await findPreSubmitDuplicateMatches(payload);
            preSubmitDuplicateMatches.value = matches;
            if (matches.length > 0) {
                return;
            }
        } catch {
            // Pre-check failure is non-fatal — let the submit proceed so the
            // backend 409 catches any real duplicate.
        } finally {
            preSubmitDuplicateCheckLoading.value = false;
        }
    }

    if (!browserOnline.value) {
        createLoading.value = true;
        try {
            await savePatientRegistrationOffline(payload);
        } catch (error) {
            notifyError(
                messageFromUnknown(
                    error,
                    'Unable to save patient registration offline.',
                ),
            );
        } finally {
            createLoading.value = false;
        }
        return;
    }

    createLoading.value = true;

    try {
        const response = await apiRequest<PatientStoreResponse>(
            'POST',
            '/patients',
            {
                body: {
                    ...payload,
                },
            },
        );

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
        clearDraftFromStorage();
        clearPreSubmitDuplicateState();

        registerDialogOpen.value = false;
        searchForm.page = 1;
        await Promise.all([loadPatients(), loadPatientStatusCounts()]);
    } catch (error) {
        const apiError = error as Error & {
            status?: number;
            payload?: unknown;
        };

        // Backend duplicate guard — extract matches and show the same confirmation UI
        if (apiError.status === 409) {
            const body = apiError.payload as
                | { duplicates?: Patient[] }
                | undefined;
            const backendDuplicates = body?.duplicates ?? [];
            if (backendDuplicates.length > 0) {
                preSubmitDuplicateMatches.value = backendDuplicates;
                preSubmitDuplicateWarningAcknowledged.value = false;
                createLoading.value = false;
                return;
            }
        }

        const typedError = apiError as Error & {
            payload?: ValidationErrorResponse;
        };
        if (apiError.status === 422 && typedError.payload?.errors) {
            createErrors.value = typedError.payload.errors;
            void focusRegistrationErrorSummary();
        } else if (isLikelyPatientOfflineFailure(apiError)) {
            try {
                await savePatientRegistrationOffline(payload);
            } catch (offlineError) {
                createMessage.value = null;
                notifyError(
                    messageFromUnknown(
                        offlineError,
                        'Unable to save patient registration offline.',
                    ),
                );
            }
        } else {
            createMessage.value = null;
            notifyError(
                messageFromUnknown(apiError, 'Unable to create patient.'),
            );
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
    searchForm.sortBy = patientSortByOptions.some(
        (option) => option.value === nextValue,
    )
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
        countryDisplayLabel(patient.countryCode) ||
            normalizeCountryCode(patient.countryCode),
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
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate()))
        years--;
    if (years < 1) {
        const months =
            (now.getFullYear() - dob.getFullYear()) * 12 +
            now.getMonth() -
            dob.getMonth();
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
        normalizeCountryCode(patient.countryCode) ||
        defaultPatientCountryCode.value;
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

function payloadFromEditForm() {
    const dateOfBirth =
        asTrimmedString(editForm.dateOfBirth) ||
        deriveDateOfBirthFromAgeParts(
            asTrimmedString(editForm.ageYears),
            asTrimmedString(editForm.ageMonths),
        ) ||
        '';

    return {
        firstName: editForm.firstName.trim(),
        middleName: editForm.middleName.trim() || null,
        lastName: editForm.lastName.trim(),
        gender: editForm.gender || null,
        dateOfBirth: dateOfBirth || null,
        phone: editForm.phone.trim(),
        email: editForm.email.trim() || null,
        nationalId: editForm.nationalId.trim() || null,
        countryCode: normalizeCountryCode(editForm.countryCode) || null,
        region: editForm.region.trim() || null,
        district: editForm.district.trim() || null,
        addressLine: editForm.addressLine.trim() || null,
        nextOfKinName: editForm.nextOfKinName.trim() || null,
        nextOfKinPhone: editForm.nextOfKinPhone.trim() || null,
    };
}

function isOfflineRegistrationPatient(patient: Patient): boolean {
    return (
        patient.id.startsWith('offline-patient-') ||
        Boolean(patient.patientNumber?.startsWith('TMP-PAT-'))
    );
}

async function savePatientUpdateOffline(
    patient: Patient,
    payload: ReturnType<typeof payloadFromEditForm>,
): Promise<void> {
    if (isOfflineRegistrationPatient(patient)) {
        const record = await updateOfflinePatientRegistrationDraft(patient.id, {
            ...payload,
            gender: payload.gender || '',
            dateOfBirth: payload.dateOfBirth || '',
            countryCode: payload.countryCode || '',
            region: payload.region || '',
            district: payload.district || '',
            addressLine: payload.addressLine || '',
        });
        addOfflinePatientToCurrentList(record);
        offlineLastSavedPatientNumber.value = record.temporaryPatientNumber;
        await refreshOfflinePatientRegistrations();
        notifySuccess(
            `Offline registration ${record.temporaryPatientNumber} updated on this browser. It will upload when internet returns.`,
        );
        closeEditSheet();
        return;
    }

    const record = await enqueueOfflinePatientUpdate(
        {
            id: patient.id,
            patientNumber: patient.patientNumber,
            patientName: patientName(patient),
        },
        {
            ...payload,
            gender: payload.gender || '',
            dateOfBirth: payload.dateOfBirth || '',
            countryCode: payload.countryCode || '',
            region: payload.region || '',
            district: payload.district || '',
            addressLine: payload.addressLine || '',
        },
    );
    applyOfflinePatientUpdate(record);
    offlineLastSavedUpdateLabel.value =
        record.patientNumber || offlinePatientUpdateRecordName(record);
    await refreshOfflinePatientRegistrations();

    notifySuccess(
        `Patient edit saved offline for ${offlinePatientUpdateRecordName(record)}. It will upload when internet returns.`,
    );

    closeEditSheet();
}

async function updatePatient() {
    if (!editTargetPatient.value || editLoading.value) return;
    const targetPatient = editTargetPatient.value;
    editErrors.value = {};
    const editPhone = editForm.phone.trim();
    if (editPhone === '') {
        editErrors.value.phone = [tW2('validation.phoneRequired')];
        await focusEditErrorSummary();
        return;
    }
    if (editPhone.length < 7) {
        editErrors.value.phone = [tW2('validation.phoneTooShort')];
        await focusEditErrorSummary();
        return;
    }

    editLoading.value = true;
    const payload = payloadFromEditForm();
    if (!browserOnline.value) {
        try {
            await savePatientUpdateOffline(targetPatient, payload);
        } catch (error) {
            notifyError(
                messageFromUnknown(
                    error,
                    'Unable to save patient edit offline.',
                ),
            );
        } finally {
            editLoading.value = false;
        }
        return;
    }

    try {
        const response = await apiRequest<{ data: Patient }>(
            'PATCH',
            `/patients/${targetPatient.id}`,
            { body: payload },
        );
        if (detailsSheetPatient.value?.id === response.data.id) {
            Object.assign(detailsSheetPatient.value, response.data);
        }
        if (editTargetPatient.value?.id === response.data.id) {
            Object.assign(editTargetPatient.value, response.data);
        }
        const idx = patients.value.findIndex((p) => p.id === response.data.id);
        if (idx !== -1)
            patients.value[idx] = { ...patients.value[idx], ...response.data };
        notifySuccess('Patient record updated.');
        closeEditSheet();
    } catch (error) {
        const apiError = error as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        if (isLikelyPatientOfflineFailure(error)) {
            await savePatientUpdateOffline(targetPatient, payload);
        } else if (apiError.status === 409) {
            const message =
                apiError.payload?.message ||
                'Another active patient already uses this National ID or patient number.';
            const duplicateMatches = apiError.payload?.duplicates ?? [];
            const incomingPhone = normalizePhoneForDuplicate(editPhone);
            const incomingNationalId = normalizeIdentifierForDuplicate(
                editForm.nationalId,
            );
            const phoneConflict = duplicateMatches.some(
                (patient) =>
                    normalizePhoneForDuplicate(patient.phone) === incomingPhone,
            );
            const nationalIdConflict = duplicateMatches.some(
                (patient) =>
                    Boolean(incomingNationalId) &&
                    normalizeIdentifierForDuplicate(patient.nationalId) ===
                        incomingNationalId,
            );
            const nextErrors: Record<string, string[]> = {};

            if (phoneConflict || (!phoneConflict && !nationalIdConflict)) {
                nextErrors.phone = [message];
            }

            if (nationalIdConflict) {
                nextErrors.nationalId = [message];
            }

            editErrors.value = nextErrors;
            notifyError(message);
            await focusEditErrorSummary();
        } else if (apiError.status === 422 && apiError.payload?.errors) {
            editErrors.value = apiError.payload.errors;
            await focusEditErrorSummary();
        } else {
            notifyError(
                messageFromUnknown(apiError, 'Unable to update patient.'),
            );
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
        const response = await apiRequest<{ data: Patient }>(
            'PATCH',
            `/patients/${statusTargetPatient.value.id}/status`,
            {
                body: {
                    status: statusForm.status,
                    reason: statusForm.reason.trim() || null,
                },
            },
        );
        if (detailsSheetPatient.value?.id === response.data.id) {
            Object.assign(detailsSheetPatient.value, response.data);
        }
        if (statusTargetPatient.value?.id === response.data.id) {
            Object.assign(statusTargetPatient.value, response.data);
        }
        const idx = patients.value.findIndex((p) => p.id === response.data.id);
        if (idx !== -1)
            patients.value[idx] = { ...patients.value[idx], ...response.data };
        notifySuccess(`Patient status changed to ${response.data.status}.`);
        closeStatusDialog();
        void loadPatientStatusCounts();
    } catch (error) {
        const apiError = error as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        if (apiError.status === 422 && apiError.payload?.errors) {
            statusErrors.value = Object.values(apiError.payload.errors).flat();
        } else {
            statusErrors.value = [
                messageFromUnknown(
                    apiError,
                    'Unable to change patient status.',
                ),
            ];
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
        case 'q':
            searchForm.q = '';
            break;
        case 'status':
            searchForm.status = 'active';
            break;
        case 'gender':
            searchForm.gender = '';
            break;
        case 'region':
            searchForm.region = '';
            break;
        case 'district':
            searchForm.district = '';
            break;
        case 'sort':
            searchForm.sortBy = 'createdAt';
            searchForm.sortDir = 'desc';
            break;
        case 'perPage':
            searchForm.perPage = 10;
            break;
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

        if (
            currentValues.every(
                (currentValue, index) => currentValue === previousValues[index],
            )
        ) {
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

// Draft auto-save: trigger on any registration form change while the sheet is open
watch(
    () => ({ ...registrationForm, _mode: registrationBirthInputMode.value }),
    () => {
        if (!registerDialogOpen.value) return;
        // Only save if at least one meaningful field has content
        const hasContent =
            registrationForm.firstName.trim() !== '' ||
            registrationForm.lastName.trim() !== '' ||
            registrationForm.phone.trim() !== '';
        if (!hasContent) return;
        scheduleDraftSave();
    },
    { deep: true },
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
onBeforeUnmount(() => {
    if (draftSaveTimer !== null) window.clearTimeout(draftSaveTimer);
    window.removeEventListener('online', handleBrowserOnline);
    window.removeEventListener('offline', handleBrowserOffline);
});

onMounted(() => {
    registerOfflinePatientServiceWorker();
    browserOnline.value =
        typeof navigator === 'undefined' ? true : navigator.onLine;
    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);
    clearDraftFromStorage();
    void refreshOfflinePatientRegistrations().then(() => {
        if (browserOnline.value && offlinePatientChangePendingCount.value > 0) {
            void syncOfflinePatientRegistrations({ silent: true });
        }
    });
    initialPageLoad();
});
</script>

<template>
    <Head title="Patients" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            class="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-3 md:p-5 lg:p-6"
        >
            <!-- ================================================================== -->
            <!-- PAGE HEADER                                                        -->
            <!-- ================================================================== -->
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div
                    class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6"
                >
                    <!-- Left: identity -->
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="users" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <h1
                                class="text-base font-semibold tracking-tight md:text-lg"
                            >
                                Patients
                            </h1>
                            <p class="truncate text-xs text-muted-foreground">
                                Look up existing patients or register new ones
                                with duplicate checks.
                            </p>
                            <div
                                class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground"
                            >
                                <span class="inline-flex items-center gap-1">
                                    <AppIcon
                                        name="building-2"
                                        class="size-3 opacity-75"
                                        aria-hidden="true"
                                    />
                                    <span class="font-medium text-foreground">{{
                                        scope?.facility?.name || 'No facility'
                                    }}</span>
                                </span>
                                <span
                                    class="text-border select-none"
                                    aria-hidden="true"
                                    >·</span
                                >
                                <span>{{
                                    scope?.tenant?.name || 'No tenant'
                                }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Right: actions -->
                    <div
                        class="flex flex-shrink-0 flex-wrap items-center gap-2"
                    >
                        <Button
                            variant="outline"
                            size="sm"
                            :disabled="listLoading"
                            class="h-8 gap-1.5"
                            @click="refreshPage"
                        >
                            <AppIcon name="activity" class="size-3.5" />
                            {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                        </Button>
                        <Button
                            v-if="canCreatePatients"
                            size="sm"
                            class="h-8 gap-1.5"
                            @click="openRegistrationDialog()"
                        >
                            <AppIcon name="plus" class="size-3.5" />
                            Register Patient
                        </Button>
                    </div>
                </div>
            </section>

            <Alert
                v-if="
                    offlinePatientChangePendingCount > 0 ||
                    !browserOnline ||
                    offlinePatientSyncError ||
                    offlineLastSavedPatientNumber ||
                    offlineLastSavedUpdateLabel
                "
                :variant="
                    offlinePatientChangeFailedCount > 0
                        ? 'destructive'
                        : 'default'
                "
                class="rounded-lg"
            >
                <AppIcon name="receipt" class="size-4" />
                <AlertTitle>
                    {{
                        offlinePatientChangeFailedCount > 0
                            ? `${offlinePatientChangeFailedCount} offline patient change${offlinePatientChangeFailedCount === 1 ? '' : 's'} need review`
                            : offlineLastSavedPatientNumber
                              ? `Saved offline: ${offlineLastSavedPatientNumber}`
                              : offlineLastSavedUpdateLabel
                                ? `Saved offline edit: ${offlineLastSavedUpdateLabel}`
                                : browserOnline
                                  ? `${offlinePatientChangePendingCount} offline patient change${offlinePatientChangePendingCount === 1 ? '' : 's'} pending upload`
                                  : 'Offline patient changes enabled'
                    }}
                </AlertTitle>
                <AlertDescription>
                    <div class="flex flex-col gap-3">
                        <div
                            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <p>
                                {{
                                    offlinePatientSyncError ||
                                    (offlinePatientChangeFailedCount > 0
                                        ? 'The cloud rejected one or more saved patient changes. This can happen when a duplicate patient already exists or required data needs correction.'
                                        : offlineLastSavedPatientNumber
                                          ? 'The registration is safely stored on this browser. It will upload to the cloud when internet is available.'
                                          : offlineLastSavedUpdateLabel
                                            ? 'The edit is safely stored on this browser. It will upload to the cloud when internet is available.'
                                            : browserOnline
                                              ? 'Saved offline patient changes will sync to the cloud database. The local project database is not used.'
                                              : 'Patient registrations and profile edits are saved on this browser and uploaded to the cloud when internet returns.')
                                }}
                            </p>
                            <Button
                                v-if="
                                    browserOnline &&
                                    offlinePatientChangePendingCount > 0
                                "
                                size="sm"
                                variant="outline"
                                class="h-8 shrink-0"
                                :disabled="offlinePatientSyncLoading"
                                @click="syncOfflinePatientRegistrations()"
                            >
                                {{
                                    offlinePatientSyncLoading
                                        ? 'Uploading...'
                                        : 'Upload now'
                                }}
                            </Button>
                        </div>
                        <div
                            v-if="
                                offlinePatientFailedRecords.length ||
                                offlinePatientFailedUpdateRecords.length
                            "
                            class="space-y-1 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs"
                        >
                            <p
                                v-for="record in offlinePatientFailedRecords.slice(
                                    0,
                                    3,
                                )"
                                :key="record.id"
                            >
                                <span class="font-medium">{{
                                    offlinePatientRecordName(record) ||
                                    record.temporaryPatientNumber
                                }}</span>
                                <span class="text-muted-foreground">
                                    - {{ record.error || 'Upload failed.' }}
                                </span>
                            </p>
                            <p
                                v-for="record in offlinePatientFailedUpdateRecords.slice(
                                    0,
                                    3,
                                )"
                                :key="record.id"
                            >
                                <span class="font-medium">{{
                                    offlinePatientUpdateRecordName(record)
                                }}</span>
                                <span class="text-muted-foreground">
                                    - {{ record.error || 'Upload failed.' }}
                                </span>
                            </p>
                        </div>
                    </div>
                </AlertDescription>
            </Alert>

            <!-- ================================================================== -->
            <!-- PATIENT LIST (FULL WIDTH)                                          -->
            <!-- ================================================================== -->
            <Card
                v-if="canReadPatients"
                class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70"
            >
                <!-- Compact toolbar row: status pills + search + filters -->
                <div class="flex flex-col gap-3 border-b px-4 py-3">
                    <!-- Row 1: status toggles + count badge + right controls -->
                    <div class="flex flex-wrap items-center gap-2">
                        <button
                            class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                            :class="{
                                'border-primary bg-primary/5':
                                    searchForm.status === 'active',
                            }"
                            @click="
                                searchForm.status = 'active';
                                submitSearch();
                            "
                        >
                            <span
                                class="inline-block h-2 w-2 rounded-full bg-emerald-500"
                            />
                            <span class="font-medium">{{
                                summaryPatientStatusCounts.active
                            }}</span>
                            <span class="text-muted-foreground">Active</span>
                        </button>
                        <button
                            class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                            :class="{
                                'border-primary bg-primary/5':
                                    searchForm.status === 'inactive',
                            }"
                            @click="
                                searchForm.status = 'inactive';
                                submitSearch();
                            "
                        >
                            <span
                                class="inline-block h-2 w-2 rounded-full bg-rose-500"
                            />
                            <span class="font-medium">{{
                                summaryPatientStatusCounts.inactive
                            }}</span>
                            <span class="text-muted-foreground">Inactive</span>
                        </button>
                        <button
                            class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                            :class="{
                                'border-primary bg-primary/5':
                                    searchForm.status === '',
                            }"
                            @click="
                                searchForm.status = '';
                                submitSearch();
                            "
                        >
                            <span
                                class="inline-block h-2 w-2 rounded-full bg-slate-400"
                            />
                            <span class="font-medium">{{
                                summaryPatientStatusCounts.total
                            }}</span>
                            <span class="text-muted-foreground">All</span>
                        </button>

                        <div class="ml-auto flex items-center gap-2">
                            <Badge
                                variant="secondary"
                                class="hidden sm:inline-flex"
                            >
                                {{ pagination?.total ?? 0 }} patients
                            </Badge>
                            <Badge
                                v-if="activePatientPresetLabel"
                                variant="outline"
                                class="hidden md:inline-flex"
                                >{{ activePatientPresetLabel }}</Badge
                            >
                            <Button
                                v-if="hasActivePatientFilters"
                                variant="ghost"
                                size="sm"
                                class="h-7 gap-1.5 text-xs"
                                @click="resetPatientFilters"
                            >
                                <AppIcon
                                    name="sliders-horizontal"
                                    class="size-3"
                                />
                                Reset
                            </Button>
                        </div>
                    </div>

                    <!-- Row 2: search + filter button -->
                    <div class="flex flex-wrap items-center gap-2">
                        <div class="relative min-w-0 flex-1">
                            <AppIcon
                                name="search"
                                class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                            />
                            <Input
                                id="patient-search-q"
                                v-model="searchForm.q"
                                placeholder="Search name, MRN, phone, email, or ID…"
                                class="h-8 pl-9 text-sm"
                                @keyup.enter="submitSearch"
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5"
                            @click="patientFiltersSheetOpen = true"
                        >
                            <AppIcon
                                name="sliders-horizontal"
                                class="size-3.5"
                            />
                            Filters
                            <Badge
                                v-if="patientFilterChips.length > 0"
                                variant="secondary"
                                class="ml-1 h-5 px-1.5 text-[10px]"
                            >
                                {{ patientFilterChips.length }}
                            </Badge>
                        </Button>
                    </div>

                    <!-- Row 3: active filter chips (if any) -->
                    <div
                        v-if="patientFilterChips.length > 0"
                        class="flex flex-wrap gap-1.5"
                    >
                        <button
                            v-for="chip in patientFilterChips"
                            :key="chip.key"
                            type="button"
                            class="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                            @click="removeFilterChip(chip.key)"
                        >
                            {{ chip.label }}
                            <AppIcon
                                name="x"
                                class="size-3 text-muted-foreground"
                            />
                        </button>
                    </div>
                </div>

                <CardContent
                    class="flex min-h-0 flex-1 flex-col overflow-hidden px-0 pb-0"
                >
                    <!-- Inline scope/error alerts (inside card, close to data) -->
                    <div
                        v-if="scopeWarning || listErrors.length"
                        class="space-y-2 px-4 pt-3"
                    >
                        <Alert
                            v-if="scopeWarning"
                            variant="destructive"
                            class="py-2"
                        >
                            <AppIcon name="alert-triangle" class="size-4" />
                            <AlertTitle class="text-xs font-medium"
                                >Scope warning</AlertTitle
                            >
                            <AlertDescription class="text-xs">{{
                                scopeWarning
                            }}</AlertDescription>
                        </Alert>
                        <Alert
                            v-if="
                                patientListOfflineUnavailable ||
                                listErrors.length
                            "
                            :variant="
                                patientListOfflineUnavailable
                                    ? 'default'
                                    : 'destructive'
                            "
                            class="py-2"
                        >
                            <AppIcon
                                :name="
                                    patientListOfflineUnavailable
                                        ? 'receipt'
                                        : 'circle-x'
                                "
                                class="size-4"
                            />
                            <AlertTitle class="text-xs font-medium">{{
                                patientListOfflineUnavailable
                                    ? 'Cloud registry unavailable offline'
                                    : 'Request error'
                            }}</AlertTitle>
                            <AlertDescription class="text-xs">
                                <p v-if="patientListOfflineUnavailable">
                                    Patient list data needs the cloud
                                    connection. New registrations can still be
                                    saved on this browser and uploaded when
                                    internet returns.
                                </p>
                                <template v-else>
                                    <p
                                        v-for="errorMessage in listErrors"
                                        :key="errorMessage"
                                    >
                                        {{ errorMessage }}
                                    </p>
                                </template>
                            </AlertDescription>
                        </Alert>
                    </div>

                    <!-- TABLE HEADER -->
                    <div
                        class="hidden shrink-0 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.8fr)_minmax(0,1.5fr)_minmax(0,auto)]"
                    >
                        <button
                            type="button"
                            class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                            @click="toggleColumnSort('lastName')"
                        >
                            Patient
                            <AppIcon
                                :name="
                                    searchForm.sortBy === 'lastName'
                                        ? searchForm.sortDir === 'asc'
                                            ? 'chevron-up'
                                            : 'chevron-down'
                                        : 'chevrons-up-down'
                                "
                                class="size-3.5"
                            />
                        </button>
                        <span>Status</span>
                        <button
                            type="button"
                            class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                            @click="toggleColumnSort('createdAt')"
                        >
                            Date of birth
                            <AppIcon
                                :name="
                                    searchForm.sortBy === 'createdAt'
                                        ? searchForm.sortDir === 'asc'
                                            ? 'chevron-up'
                                            : 'chevron-down'
                                        : 'chevrons-up-down'
                                "
                                class="size-3.5"
                            />
                        </button>
                        <span>Gender</span>
                        <span>Address</span>
                        <span>Contact</span>
                        <span class="text-right">Actions</span>
                    </div>

                    <!-- Table body: scrollable when rows exceed container -->
                    <ScrollArea class="min-h-0 flex-1">
                        <div>
                            <!-- LOADING -->
                            <div
                                v-if="loading || listLoading"
                                class="space-y-0 divide-y px-4"
                            >
                                <div
                                    v-for="n in 5"
                                    :key="n"
                                    class="flex items-center gap-4 py-3"
                                >
                                    <Skeleton class="h-9 w-9 rounded-full" />
                                    <div class="flex-1 space-y-2">
                                        <Skeleton class="h-4 w-1/3" />
                                        <Skeleton class="h-3 w-1/5" />
                                    </div>
                                </div>
                            </div>

                            <!-- EMPTY STATE -->
                            <div
                                v-else-if="
                                    patientListOfflineUnavailable ||
                                    patients.length === 0
                                "
                                class="flex flex-col items-center justify-center py-16 text-center"
                            >
                                <div
                                    class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted"
                                >
                                    <AppIcon
                                        name="users"
                                        class="size-6 text-muted-foreground"
                                    />
                                </div>
                                <p class="text-sm font-medium">
                                    {{
                                        patientListOfflineUnavailable
                                            ? 'Cloud patient list is offline'
                                            : 'No patients found'
                                    }}
                                </p>
                                <p
                                    class="mt-1 max-w-sm text-xs text-muted-foreground"
                                >
                                    {{
                                        patientListOfflineUnavailable
                                            ? 'Existing patient records cannot refresh until internet returns. You can still register a patient offline from this device.'
                                            : 'Try adjusting your search query or status filter, or register a new patient.'
                                    }}
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
                                    class="group grid items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.8fr)_minmax(0,1.5fr)_minmax(0,auto)]"
                                >
                                    <!-- Patient name + number -->
                                    <div
                                        class="flex min-w-0 items-center gap-3"
                                    >
                                        <div
                                            class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                                        >
                                            {{ patientInitials(patient) }}
                                        </div>
                                        <div class="min-w-0">
                                            <button
                                                class="truncate text-sm font-medium hover:text-primary hover:underline"
                                                @click="
                                                    openPatientDetailsSheet(
                                                        patient,
                                                    )
                                                "
                                            >
                                                {{ patientName(patient) }}
                                            </button>
                                            <p
                                                class="truncate text-xs text-muted-foreground"
                                            >
                                                {{
                                                    patient.patientNumber ||
                                                    'No MRN assigned'
                                                }}
                                            </p>
                                        </div>
                                    </div>

                                    <!-- Status -->
                                    <div class="flex items-center gap-2">
                                        <span
                                            class="text-xs text-muted-foreground md:hidden"
                                            >Status:</span
                                        >
                                        <Badge
                                            :variant="
                                                statusVariant(patient.status)
                                            "
                                            class="text-xs leading-none"
                                        >
                                            {{ patient.status || 'unknown' }}
                                        </Badge>
                                    </div>

                                    <!-- DOB & registered -->
                                    <div class="text-xs text-muted-foreground">
                                        <span
                                            class="font-medium text-foreground md:hidden"
                                            >DOB:
                                        </span>
                                        <span>{{
                                            formatDate(patient.dateOfBirth)
                                        }}</span>
                                        <span
                                            v-if="patient.dateOfBirth"
                                            class="ml-1 text-muted-foreground/70"
                                            >({{
                                                formatAge(patient.dateOfBirth)
                                            }})</span
                                        >
                                        <p class="mt-0.5 hidden md:block">
                                            Registered:
                                            {{ formatDate(patient.createdAt) }}
                                        </p>
                                    </div>

                                    <!-- Gender -->
                                    <div class="text-xs text-muted-foreground">
                                        <span
                                            class="font-medium text-foreground md:hidden"
                                            >Gender:
                                        </span>
                                        <span class="capitalize">{{
                                            patient.gender || '—'
                                        }}</span>
                                    </div>

                                    <!-- Address -->
                                    <div
                                        class="min-w-0 text-xs text-muted-foreground"
                                    >
                                        <span
                                            class="font-medium text-foreground md:hidden"
                                            >Address:
                                        </span>
                                        <span class="line-clamp-2">{{
                                            patient.addressLine || '—'
                                        }}</span>
                                    </div>

                                    <!-- Contact -->
                                    <div class="min-w-0">
                                        <p
                                            class="truncate text-xs text-muted-foreground"
                                        >
                                            {{
                                                patient.phone ||
                                                patient.email ||
                                                'No contact details'
                                            }}
                                        </p>
                                    </div>

                                    <!-- Actions dropdown -->
                                    <div
                                        class="flex items-center justify-end gap-2"
                                    >
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            class="hidden h-7 gap-1.5 text-xs lg:inline-flex"
                                            @click="
                                                openPatientDetailsSheet(patient)
                                            "
                                        >
                                            <AppIcon
                                                name="eye"
                                                class="size-3.5"
                                            />
                                            View
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger as-child>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    class="h-7 w-7 p-0"
                                                >
                                                    <span class="sr-only"
                                                        >Actions</span
                                                    >
                                                    <AppIcon
                                                        name="ellipsis-vertical"
                                                        class="size-4"
                                                    />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                class="w-64"
                                            >
                                                <DropdownMenuLabel
                                                    class="text-xs"
                                                    >Patient
                                                    Actions</DropdownMenuLabel
                                                >
                                                <DropdownMenuSeparator />

                                                <!-- Core record actions -->
                                                <DropdownMenuItem
                                                    class="flex items-center gap-2"
                                                    @click="
                                                        openPatientDetailsSheet(
                                                            patient,
                                                        )
                                                    "
                                                >
                                                    <AppIcon
                                                        name="eye"
                                                        class="size-3.5"
                                                    />
                                                    View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    v-if="canUpdatePatients"
                                                    class="flex items-center gap-2"
                                                    @click="
                                                        openEditSheet(patient)
                                                    "
                                                >
                                                    <AppIcon
                                                        name="pencil"
                                                        class="size-3.5"
                                                    />
                                                    Edit Patient
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    v-if="
                                                        canUpdatePatientStatus
                                                    "
                                                    class="flex items-center gap-2"
                                                    @click="
                                                        openStatusDialog(
                                                            patient,
                                                        )
                                                    "
                                                >
                                                    <AppIcon
                                                        :name="
                                                            patientStatusActionIcon(
                                                                patient,
                                                            )
                                                        "
                                                        class="size-3.5"
                                                    />
                                                    {{
                                                        patientStatusActionLabel(
                                                            patient,
                                                        )
                                                    }}
                                                </DropdownMenuItem>

                                                <DropdownMenuSeparator />
                                                <!-- Clinical workflow -->
                                                <DropdownMenuLabel
                                                    class="text-xs text-muted-foreground"
                                                    >Clinical
                                                    workflow</DropdownMenuLabel
                                                >
                                                <DropdownMenuItem
                                                    class="flex items-center gap-2"
                                                    @click="
                                                        openPatientVisitHandoff(
                                                            patient,
                                                            'list',
                                                        )
                                                    "
                                                >
                                                    <AppIcon
                                                        name="clipboard-list"
                                                        class="size-3.5"
                                                    />
                                                    Start Visit Handoff
                                                </DropdownMenuItem>
                                                <DropdownMenuItem as-child>
                                                    <Link
                                                        :href="
                                                            patientContextHref(
                                                                '/appointments',
                                                                patient,
                                                            )
                                                        "
                                                        class="flex items-center gap-2"
                                                    >
                                                        <AppIcon
                                                            name="calendar-clock"
                                                            class="size-3.5"
                                                        />
                                                        Schedule Appointment
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem as-child>
                                                    <Link
                                                        :href="
                                                            patientContextHref(
                                                                '/emergency-triage',
                                                                patient,
                                                                {
                                                                    includeTabNew: true,
                                                                },
                                                            )
                                                        "
                                                        class="flex items-center gap-2"
                                                    >
                                                        <AppIcon
                                                            name="activity"
                                                            class="size-3.5"
                                                        />
                                                        Start Emergency Triage
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem as-child>
                                                    <Link
                                                        :href="
                                                            patientChartContextHref(
                                                                patient,
                                                                {
                                                                    from: 'patients',
                                                                },
                                                            )
                                                        "
                                                        class="flex items-center gap-2"
                                                    >
                                                        <AppIcon
                                                            name="book-open"
                                                            class="size-3.5"
                                                        />
                                                        Open Patient Chart
                                                    </Link>
                                                </DropdownMenuItem>

                                                <DropdownMenuSeparator />
                                                <!-- Orders & billing -->
                                                <DropdownMenuLabel
                                                    class="text-xs text-muted-foreground"
                                                    >Orders &amp;
                                                    billing</DropdownMenuLabel
                                                >
                                                <DropdownMenuItem
                                                    v-if="
                                                        canCreateLaboratoryOrders
                                                    "
                                                    as-child
                                                >
                                                    <Link
                                                        :href="
                                                            patientContextHref(
                                                                '/laboratory-orders',
                                                                patient,
                                                                {
                                                                    includeTabNew: true,
                                                                },
                                                            )
                                                        "
                                                        class="flex items-center gap-2"
                                                    >
                                                        <AppIcon
                                                            name="flask-conical"
                                                            class="size-3.5"
                                                        />
                                                        New Lab Order
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    v-if="
                                                        canCreatePharmacyOrders
                                                    "
                                                    as-child
                                                >
                                                    <Link
                                                        :href="
                                                            patientContextHref(
                                                                '/pharmacy-orders',
                                                                patient,
                                                                {
                                                                    includeTabNew: true,
                                                                },
                                                            )
                                                        "
                                                        class="flex items-center gap-2"
                                                    >
                                                        <AppIcon
                                                            name="pill"
                                                            class="size-3.5"
                                                        />
                                                        New Pharmacy Order
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    v-if="
                                                        canCreateTheatreProcedures
                                                    "
                                                    as-child
                                                >
                                                    <Link
                                                        :href="
                                                            patientContextHref(
                                                                '/theatre-procedures',
                                                                patient,
                                                                {
                                                                    includeTabNew: true,
                                                                },
                                                            )
                                                        "
                                                        class="flex items-center gap-2"
                                                    >
                                                        <AppIcon
                                                            name="scissors"
                                                            class="size-3.5"
                                                        />
                                                        Schedule Procedure
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem as-child>
                                                    <Link
                                                        :href="
                                                            patientContextHref(
                                                                '/billing-invoices',
                                                                patient,
                                                            )
                                                        "
                                                        class="flex items-center gap-2"
                                                    >
                                                        <AppIcon
                                                            name="receipt"
                                                            class="size-3.5"
                                                        />
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
                    <div
                        class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-3"
                    >
                        <p class="text-xs text-muted-foreground">
                            <template v-if="pagination">
                                Showing {{ patients.length }} of
                                {{ pagination.total }} &middot; Page
                                {{ pagination.currentPage }} of
                                {{ pagination.lastPage }}
                            </template>
                            <template v-else>No pagination data</template>
                        </p>
                        <div class="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                class="size-8"
                                :disabled="!canPrev || listLoading"
                                @click="prevPage"
                            >
                                <AppIcon name="chevron-left" class="size-4" />
                            </Button>
                            <template
                                v-for="page in paginationPageNumbers"
                                :key="String(page)"
                            >
                                <span
                                    v-if="page === '...'"
                                    class="px-1 text-xs text-muted-foreground"
                                    >…</span
                                >
                                <Button
                                    v-else
                                    :variant="
                                        page === pagination?.currentPage
                                            ? 'default'
                                            : 'ghost'
                                    "
                                    size="icon"
                                    class="size-8 text-xs"
                                    :disabled="listLoading"
                                    @click="goToPage(page as number)"
                                    >{{ page }}</Button
                                >
                            </template>
                            <Button
                                variant="outline"
                                size="icon"
                                class="size-8"
                                :disabled="!canNext || listLoading"
                                @click="nextPage"
                            >
                                <AppIcon name="chevron-right" class="size-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- NO READ PERMISSION -->
            <Card
                v-else-if="isPatientReadPermissionResolved"
                class="border-sidebar-border/70"
            >
                <CardHeader>
                    <CardTitle>Patient Search</CardTitle>
                    <CardDescription>
                        Search and review patient profiles by identity details
                        and workflow status.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertTitle class="flex items-center gap-2">
                            <AppIcon name="shield-check" class="size-4" />
                            Patient read access restricted
                        </AlertTitle>
                        <AlertDescription>
                            Request <code>patients.read</code> permission to
                            view patient list and filters.
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
        </div>

        <!-- Register Patient Sheet -->
        <Sheet
            :open="registerDialogOpen"
            @update:open="(open) => (registerDialogOpen = open)"
        >
            <SheetContent side="right" variant="form" size="5xl">
                <SheetHeader
                    class="shrink-0 border-b px-4 py-3 pr-12 text-left"
                >
                    <SheetTitle class="flex items-center gap-2">
                        <AppIcon name="plus" class="size-5" />
                        {{ tW2('dialog.registerNewPatient') }}
                    </SheetTitle>
                    <SheetDescription>
                        {{ tW2('dialog.registerDescription') }}
                    </SheetDescription>
                </SheetHeader>

                <!-- Draft resume prompt ────────────────────────────────── -->
                <div
                    v-if="draftResumeVisible"
                    class="-mt-px shrink-0 border-b bg-amber-500/5 px-6 py-3"
                >
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p
                                class="text-sm font-medium text-amber-700 dark:text-amber-400"
                            >
                                Resume previous draft?
                            </p>
                            <p class="mt-0.5 text-xs text-muted-foreground">
                                You have an unsaved registration from earlier.
                                Resume it or start fresh.
                            </p>
                        </div>
                        <div class="flex shrink-0 gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                class="h-7 px-2.5 text-xs"
                                @click="discardDraft"
                                >Discard</Button
                            >
                            <Button
                                size="sm"
                                class="h-7 px-2.5 text-xs"
                                @click="resumeDraft"
                                >Resume</Button
                            >
                        </div>
                    </div>
                </div>
                <!-- End draft resume prompt ─────────────────────────────── -->

                <ScrollArea class="min-h-0 flex-1">
                    <div
                        class="grid gap-4 px-6 py-4 pb-8"
                        :aria-busy="registrationProcessingVisible"
                    >
                        <ProcessingStatePanel
                            v-if="registrationProcessingVisible"
                            :title="registrationProcessingTitle"
                            :description="registrationProcessingDescription"
                        />

                        <div
                            class="flex flex-col gap-3 rounded-lg border bg-muted/20 px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div class="min-w-0">
                                <p class="truncate text-sm font-medium">
                                    {{ registrationPatientNamePreview }}
                                </p>
                                <p class="mt-0.5 text-muted-foreground">
                                    {{
                                        scope?.facility?.name ||
                                        'Facility context'
                                    }}
                                    <template v-if="scope?.facility?.code">
                                        | {{ scope.facility.code }}</template
                                    >
                                </p>
                            </div>
                            <div class="flex flex-wrap gap-1.5">
                                <Badge variant="outline">{{
                                    formatEnumLabel(
                                        registrationForm.gender ||
                                            'gender pending',
                                    )
                                }}</Badge>
                                <Badge variant="outline">{{
                                    registrationAgeSummary
                                }}</Badge>
                                <Badge variant="outline">{{
                                    countryDisplayLabel(
                                        registrationForm.countryCode,
                                    ) ||
                                    registrationForm.countryCode ||
                                    'Country pending'
                                }}</Badge>
                                <Badge
                                    :variant="
                                        registrationRequiredReadiness.complete ===
                                        registrationRequiredReadiness.total
                                            ? 'secondary'
                                            : 'outline'
                                    "
                                >
                                    {{
                                        registrationRequiredReadiness.complete
                                    }}/{{ registrationRequiredReadiness.total }}
                                    required
                                </Badge>
                            </div>
                        </div>
                        <!-- ── Duplicate warning ─────────────────────────────────── -->
                        <div
                            v-if="preSubmitDuplicateMatches.length > 0"
                            class="-mx-6 overflow-hidden border-y border-amber-500/30 bg-amber-500/5"
                        >
                            <!-- Header -->
                            <div
                                class="flex items-start gap-3 border-b border-amber-500/20 px-6 py-3"
                            >
                                <div
                                    class="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                >
                                    <AppIcon
                                        name="alert-triangle"
                                        class="size-4"
                                    />
                                </div>
                                <div class="min-w-0">
                                    <p
                                        class="text-sm font-semibold text-amber-700 dark:text-amber-300"
                                    >
                                        {{ tW2('duplicate.title') }}
                                    </p>
                                    <p
                                        class="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/80"
                                    >
                                        {{ tW2('duplicate.description') }}
                                    </p>
                                </div>
                            </div>

                            <!-- Match cards -->
                            <div class="space-y-3 px-6 py-4">
                                <div
                                    v-for="match in preSubmitDuplicateMatches"
                                    :key="`duplicate-${match.id}`"
                                    class="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
                                >
                                    <!-- Card header: name + badges + view link -->
                                    <div
                                        class="flex flex-col gap-2 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div class="min-w-0">
                                            <div
                                                class="flex flex-wrap items-center gap-2"
                                            >
                                                <span
                                                    class="font-semibold text-foreground"
                                                    >{{
                                                        patientName(match)
                                                    }}</span
                                                >
                                                <Badge variant="secondary">{{
                                                    match.patientNumber ||
                                                    match.id.slice(0, 8)
                                                }}</Badge>
                                                <Badge
                                                    :variant="
                                                        statusVariant(
                                                            match.status,
                                                        )
                                                    "
                                                    class="capitalize"
                                                >
                                                    {{
                                                        match.status ||
                                                        'unknown'
                                                    }}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    class="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                                >
                                                    {{
                                                        tW2(
                                                            'duplicate.confidence',
                                                            {
                                                                score:
                                                                    match.duplicateConfidence ??
                                                                    duplicateConfidenceScore(
                                                                        payloadFromForm(),
                                                                        match,
                                                                    ),
                                                            },
                                                        )
                                                    }}
                                                </Badge>
                                            </div>
                                            <p
                                                class="mt-0.5 text-xs text-muted-foreground"
                                            >
                                                Registered
                                                {{
                                                    formatDate(
                                                        match.createdAt,
                                                    ) || 'date not recorded'
                                                }}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            as-child
                                            class="h-7 shrink-0 gap-1.5 text-xs"
                                        >
                                            <Link
                                                :href="`/patients?q=${encodeURIComponent(match.patientNumber || match.id)}`"
                                                target="_blank"
                                            >
                                                <AppIcon
                                                    name="eye"
                                                    class="size-3"
                                                />
                                                {{
                                                    tW2(
                                                        'duplicate.viewExistingPatient',
                                                    )
                                                }}
                                            </Link>
                                        </Button>
                                    </div>

                                    <!-- Field-by-field comparison table -->
                                    <div class="w-full overflow-x-auto">
                                        <div
                                            class="grid min-w-[28rem] grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem] bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground"
                                        >
                                            <span>Field</span>
                                            <span>New entry</span>
                                            <span>Existing</span>
                                            <span class="text-right"
                                                >Match</span
                                            >
                                        </div>
                                        <div
                                            v-for="row in duplicateComparisonRows(
                                                match,
                                            )"
                                            :key="`duplicate-${match.id}-${row.key}`"
                                            class="grid min-w-[28rem] grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem] border-t border-border px-4 py-2 text-xs"
                                            :class="
                                                !row.matched
                                                    ? 'bg-amber-500/5'
                                                    : ''
                                            "
                                        >
                                            <span
                                                class="font-medium text-muted-foreground"
                                                >{{ row.label }}</span
                                            >
                                            <span
                                                class="min-w-0 truncate text-foreground"
                                                >{{ row.incoming }}</span
                                            >
                                            <span
                                                class="min-w-0 truncate"
                                                :class="
                                                    row.matched
                                                        ? 'text-foreground'
                                                        : 'font-medium text-amber-600 dark:text-amber-400'
                                                "
                                                >{{ row.existing }}</span
                                            >
                                            <span class="text-right">
                                                <Badge
                                                    v-if="row.matched"
                                                    variant="secondary"
                                                    class="text-[10px]"
                                                >
                                                    Same
                                                </Badge>
                                                <Badge
                                                    v-else
                                                    variant="outline"
                                                    class="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
                                                >
                                                    Check
                                                </Badge>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Footer actions -->
                            <div
                                class="flex flex-col gap-3 border-t border-amber-500/20 bg-amber-500/5 px-6 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <p
                                    class="text-xs text-amber-600 dark:text-amber-400"
                                >
                                    Review the existing record before continuing
                                    registration.
                                </p>
                                <div class="flex shrink-0 flex-wrap gap-2">
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
                                        :disabled="
                                            createLoading ||
                                            preSubmitDuplicateCheckLoading
                                        "
                                        @click="
                                            continueRegistrationAfterDuplicateReview
                                        "
                                    >
                                        {{
                                            tW2(
                                                'duplicate.continueRegistration',
                                            )
                                        }}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <Alert
                            v-if="preSubmitDuplicateCheckError"
                            variant="default"
                        >
                            <AlertTitle>{{
                                tW2('duplicate.precheckUnavailable')
                            }}</AlertTitle>
                            <AlertDescription>{{
                                preSubmitDuplicateCheckError
                            }}</AlertDescription>
                        </Alert>

                        <div
                            v-if="registrationErrorSummary.length > 0"
                            ref="registrationErrorSummaryRef"
                            tabindex="-1"
                        >
                            <Alert variant="destructive">
                                <AlertTitle>{{
                                    tW2('validation.summaryTitle')
                                }}</AlertTitle>
                                <AlertDescription class="space-y-2">
                                    <p class="text-xs">
                                        {{
                                            tW2('validation.summaryDescription')
                                        }}
                                    </p>
                                    <ul
                                        class="list-disc space-y-1 pl-4 text-xs"
                                    >
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
                            <legend
                                class="px-2 text-sm font-medium text-muted-foreground"
                            >
                                Patient identity
                            </legend>

                            <!-- Row 1: First name | Last name -->
                            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div class="grid gap-1.5">
                                    <Label
                                        for="patient-form-firstName"
                                        class="text-xs font-medium"
                                    >
                                        First name
                                        <span class="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="patient-form-firstName"
                                        v-model="registrationForm.firstName"
                                        placeholder="First name"
                                        class="h-10"
                                        autocomplete="given-name"
                                    />
                                    <p
                                        v-if="fieldError('firstName')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ fieldError('firstName') }}
                                    </p>
                                </div>
                                <div class="grid gap-1.5">
                                    <Label
                                        for="patient-form-lastName"
                                        class="text-xs font-medium"
                                    >
                                        Last name
                                        <span class="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="patient-form-lastName"
                                        v-model="registrationForm.lastName"
                                        placeholder="Last name"
                                        class="h-10"
                                        autocomplete="family-name"
                                    />
                                    <p
                                        v-if="fieldError('lastName')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ fieldError('lastName') }}
                                    </p>
                                </div>
                            </div>

                            <!-- Row 2: Middle name | Gender | Country -->
                            <div
                                class="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_190px_190px]"
                            >
                                <div class="grid gap-1.5">
                                    <Label
                                        for="patient-form-middleName"
                                        class="text-xs font-medium text-muted-foreground"
                                        >Middle name</Label
                                    >
                                    <Input
                                        id="patient-form-middleName"
                                        v-model="registrationForm.middleName"
                                        placeholder="Middle name if used"
                                        class="h-10"
                                        autocomplete="additional-name"
                                    />
                                </div>
                                <div class="grid gap-1.5">
                                    <Label
                                        for="patient-form-gender"
                                        class="text-xs font-medium"
                                    >
                                        Gender
                                        <span class="text-destructive">*</span>
                                    </Label>
                                    <Select v-model="registrationForm.gender">
                                        <SelectTrigger class="h-10 w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="female"
                                                >Female</SelectItem
                                            >
                                            <SelectItem value="male"
                                                >Male</SelectItem
                                            >
                                            <SelectItem value="other"
                                                >Other</SelectItem
                                            >
                                            <SelectItem value="unknown"
                                                >Unknown</SelectItem
                                            >
                                        </SelectContent>
                                    </Select>
                                    <p
                                        v-if="fieldError('gender')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ fieldError('gender') }}
                                    </p>
                                </div>
                                <div class="grid gap-1.5">
                                    <Label
                                        for="patient-form-countryCode"
                                        class="text-xs font-medium"
                                    >
                                        Country
                                        <span class="text-destructive">*</span>
                                    </Label>
                                    <Select
                                        v-model="registrationForm.countryCode"
                                    >
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
                                    <p
                                        v-if="fieldError('countryCode')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ fieldError('countryCode') }}
                                    </p>
                                </div>
                            </div>
                        </fieldset>

                        <fieldset class="grid gap-4 rounded-lg border p-3">
                            <legend
                                class="px-2 text-sm font-medium text-muted-foreground"
                            >
                                Age and date of birth
                            </legend>
                            <!-- Age / date of birth -->
                            <div class="grid gap-2">
                                <div
                                    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <Label class="text-xs font-medium">
                                        Age / Date of birth
                                        <span class="text-destructive">*</span>
                                    </Label>
                                    <div
                                        class="inline-flex w-full rounded-md border bg-muted/40 p-0.5 sm:w-auto"
                                    >
                                        <button
                                            type="button"
                                            class="flex-1 rounded px-2.5 py-1 text-xs font-medium transition sm:flex-none"
                                            :class="
                                                registrationBirthInputMode ===
                                                'estimated'
                                                    ? 'bg-background text-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            "
                                            :aria-pressed="
                                                registrationBirthInputMode ===
                                                'estimated'
                                            "
                                            @click="
                                                setRegistrationBirthInputMode(
                                                    'estimated',
                                                )
                                            "
                                        >
                                            Estimated age
                                        </button>
                                        <button
                                            type="button"
                                            class="flex-1 rounded px-2.5 py-1 text-xs font-medium transition sm:flex-none"
                                            :class="
                                                registrationBirthInputMode ===
                                                'exact'
                                                    ? 'bg-background text-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            "
                                            :aria-pressed="
                                                registrationBirthInputMode ===
                                                'exact'
                                            "
                                            @click="
                                                setRegistrationBirthInputMode(
                                                    'exact',
                                                )
                                            "
                                        >
                                            Exact date
                                        </button>
                                    </div>
                                </div>

                                <!-- Estimated mode: years + months side by side -->
                                <div
                                    v-if="
                                        registrationBirthInputMode ===
                                        'estimated'
                                    "
                                    class="grid grid-cols-1 gap-3 sm:grid-cols-2"
                                >
                                    <div class="grid gap-1.5">
                                        <Label
                                            for="patient-form-ageYears"
                                            class="text-xs font-medium"
                                            >Years</Label
                                        >
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
                                        <Label
                                            for="patient-form-ageMonths"
                                            class="text-xs font-medium"
                                            >Months</Label
                                        >
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
                                <div
                                    class="rounded-md bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
                                >
                                    <p
                                        v-if="
                                            registrationBirthInputMode ===
                                                'estimated' &&
                                            registrationDerivedDateOfBirth
                                        "
                                    >
                                        Estimated DOB:
                                        {{
                                            formatDate(
                                                registrationDerivedDateOfBirth,
                                            )
                                        }}
                                    </p>
                                    <p
                                        v-else-if="
                                            registrationBirthInputMode ===
                                            'estimated'
                                        "
                                    >
                                        Enter years, months, or both. For
                                        infants, months only is fine.
                                    </p>
                                    <p v-else-if="registrationForm.dateOfBirth">
                                        Age:
                                        {{
                                            formatAge(
                                                registrationForm.dateOfBirth,
                                            )
                                        }}
                                    </p>
                                    <p v-else>
                                        Choose the exact date only when it is
                                        confirmed.
                                    </p>
                                </div>
                                <div class="space-y-0.5">
                                    <p
                                        v-if="fieldError('dateOfBirth')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ fieldError('dateOfBirth') }}
                                    </p>
                                    <p
                                        v-if="fieldError('ageYears')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ fieldError('ageYears') }}
                                    </p>
                                    <p
                                        v-if="fieldError('ageMonths')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ fieldError('ageMonths') }}
                                    </p>
                                </div>
                            </div>
                        </fieldset>

                        <fieldset class="grid gap-4 rounded-lg border p-3">
                            <legend
                                class="px-2 text-sm font-medium text-muted-foreground"
                            >
                                Contact and address
                            </legend>
                            <!-- Phone (primary contact) -->
                            <div class="grid gap-1.5">
                                <Label
                                    for="patient-form-phone"
                                    class="text-xs font-medium"
                                >
                                    Phone
                                    <span class="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="patient-form-phone"
                                    v-model="registrationForm.phone"
                                    placeholder="Use international format when possible"
                                    class="h-10"
                                    autocomplete="tel"
                                />
                                <p
                                    v-if="fieldError('phone')"
                                    class="text-xs text-destructive"
                                >
                                    {{ fieldError('phone') }}
                                </p>
                            </div>

                            <!-- Row 5: Region | District -->
                            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <SearchableSelectField
                                    input-id="patient-form-region"
                                    v-model="registrationForm.region"
                                    :label="registrationCountryUi.regionLabel"
                                    :options="registrationRegionOptions"
                                    :placeholder="
                                        registrationCountryUi.regionPlaceholder
                                    "
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
                                    :placeholder="
                                        registrationDistrictPlaceholder
                                    "
                                    :search-placeholder="`Search ${registrationCountryUi.districtLabel.toLowerCase()} or use a custom value`"
                                    :helper-text="
                                        registrationDistrictHelperText
                                    "
                                    :empty-text="`No ${registrationCountryUi.districtLabel.toLowerCase()} suggestion found.`"
                                    :error-message="fieldError('district')"
                                    :required="true"
                                    :allow-custom-value="true"
                                    :disabled="!registrationForm.region.trim()"
                                />
                            </div>

                            <!-- Row 6: Address full width -->
                            <div class="grid gap-1.5">
                                <Label
                                    for="patient-form-addressLine"
                                    class="text-xs font-medium"
                                >
                                    {{ registrationCountryUi.addressLabel }}
                                    <span class="text-destructive">*</span>
                                </Label>
                                <Textarea
                                    id="patient-form-addressLine"
                                    v-model="registrationForm.addressLine"
                                    rows="2"
                                    :placeholder="
                                        registrationCountryUi.addressPlaceholder
                                    "
                                    autocomplete="street-address"
                                />
                                <p
                                    v-if="fieldError('addressLine')"
                                    class="text-xs text-destructive"
                                >
                                    {{ fieldError('addressLine') }}
                                </p>
                            </div>
                        </fieldset>
                        <!-- Additional details (optional) -->
                        <Collapsible v-model:open="registerOptionalDetailsOpen">
                            <fieldset
                                class="rounded-lg border border-dashed p-3"
                            >
                                <legend
                                    class="px-2 text-sm font-medium text-muted-foreground"
                                >
                                    Additional details
                                </legend>
                                <div
                                    class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                                >
                                    <div>
                                        <p
                                            class="flex items-center gap-1.5 text-sm font-medium"
                                        >
                                            <AppIcon
                                                name="info"
                                                class="size-3.5"
                                            />
                                            {{
                                                tW2(
                                                    'registration.additionalDetailsOptional',
                                                )
                                            }}
                                        </p>
                                        <p
                                            class="mt-1 text-xs text-muted-foreground"
                                        >
                                            Open only when those details are
                                            available.
                                        </p>
                                    </div>
                                    <CollapsibleTrigger as-child>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            class="shrink-0"
                                        >
                                            {{
                                                registerOptionalDetailsOpen
                                                    ? tW2('common.hide')
                                                    : tW2('common.show')
                                            }}
                                        </Button>
                                    </CollapsibleTrigger>
                                </div>
                                <CollapsibleContent class="mt-3 border-t pt-3">
                                    <div
                                        class="grid grid-cols-1 gap-4 sm:grid-cols-2"
                                    >
                                        <div class="grid gap-1.5">
                                            <Label
                                                for="patient-form-nationalId"
                                                class="text-xs font-medium"
                                                >National ID</Label
                                            >
                                            <Input
                                                id="patient-form-nationalId"
                                                v-model="
                                                    registrationForm.nationalId
                                                "
                                                placeholder="National ID number"
                                            />
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label
                                                for="patient-form-email"
                                                class="text-xs font-medium"
                                                >Email</Label
                                            >
                                            <Input
                                                id="patient-form-email"
                                                v-model="registrationForm.email"
                                                type="email"
                                                placeholder="patient@email.com"
                                            />
                                            <p
                                                v-if="fieldError('email')"
                                                class="text-xs text-destructive"
                                            >
                                                {{ fieldError('email') }}
                                            </p>
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label
                                                for="patient-form-nextOfKinName"
                                                class="text-xs font-medium"
                                            >
                                                Emergency contact name
                                            </Label>
                                            <Input
                                                id="patient-form-nextOfKinName"
                                                v-model="
                                                    registrationForm.nextOfKinName
                                                "
                                                placeholder="Next of kin full name"
                                            />
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label
                                                for="patient-form-nextOfKinPhone"
                                                class="text-xs font-medium"
                                            >
                                                Emergency contact phone
                                            </Label>
                                            <Input
                                                id="patient-form-nextOfKinPhone"
                                                v-model="
                                                    registrationForm.nextOfKinPhone
                                                "
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
                    <div
                        class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div class="flex flex-col gap-0.5">
                            <p class="text-xs text-muted-foreground">
                                {{ registrationPatientNamePreview }} |
                                {{ registrationRequiredReadiness.complete }}/{{
                                    registrationRequiredReadiness.total
                                }}
                                required fields ready
                            </p>
                            <p
                                v-if="draftSaveStatus === 'saving'"
                                class="text-xs text-muted-foreground/70"
                            >
                                Saving draft…
                            </p>
                            <p
                                v-else-if="draftSaveStatus === 'saved'"
                                class="text-xs text-muted-foreground/70"
                            >
                                Draft saved {{ draftSavedRelative() }}
                            </p>
                            <p
                                v-if="!browserOnline"
                                class="text-xs text-amber-600 dark:text-amber-400"
                            >
                                Offline mode: this registration will be saved on
                                this browser until cloud sync.
                            </p>
                        </div>
                        <div
                            class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center"
                        >
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
                                :disabled="
                                    createLoading ||
                                    preSubmitDuplicateCheckLoading
                                "
                                class="h-8 w-full gap-1.5 px-3 sm:w-auto"
                                @click="createPatient"
                            >
                                <Spinner
                                    v-if="
                                        createLoading ||
                                        preSubmitDuplicateCheckLoading
                                    "
                                    class="size-3.5"
                                />
                                <AppIcon v-else name="plus" class="size-3.5" />
                                {{
                                    createLoading
                                        ? tW2('action.creating')
                                        : preSubmitDuplicateCheckLoading
                                          ? tW2('action.checkingDuplicates')
                                          : browserOnline
                                            ? tW2('action.registerPatient')
                                            : 'Save offline'
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
            @update:open="
                (open) =>
                    open
                        ? (postRegistrationDialogOpen = true)
                        : closePostRegistrationDialog()
            "
        >
            <DialogContent size="lg">
                <DialogHeader>
                    <DialogTitle class="flex items-center gap-2">
                        <AppIcon
                            name="check-circle"
                            class="size-5 text-primary"
                        />
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
                    <div
                        class="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-3"
                    >
                        <div>
                            <p
                                class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                            >
                                Patient
                            </p>
                            <p class="mt-1 truncate text-sm font-semibold">
                                {{ patientName(postRegistrationPatient) }}
                            </p>
                        </div>
                        <div>
                            <p
                                class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                            >
                                Contact
                            </p>
                            <p class="mt-1 truncate text-sm font-semibold">
                                {{
                                    postRegistrationPatient.phone ||
                                    'Not recorded'
                                }}
                            </p>
                        </div>
                        <div>
                            <p
                                class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                            >
                                Location
                            </p>
                            <p class="mt-1 truncate text-sm font-semibold">
                                {{
                                    patientLocationLabel(
                                        postRegistrationPatient,
                                    )
                                }}
                            </p>
                        </div>
                    </div>

                    <Alert
                        v-if="createdWarnings.length > 0"
                        class="border-amber-300 bg-amber-50"
                    >
                        <AlertTitle class="text-amber-900"
                            >Registration warning</AlertTitle
                        >
                        <AlertDescription
                            class="space-y-1 text-xs text-amber-900"
                        >
                            <p
                                v-for="warning in createdWarnings"
                                :key="`created-warning-${warning.code}-${warning.message ?? ''}`"
                            >
                                {{ warning.message || warning.code }}
                            </p>
                        </AlertDescription>
                    </Alert>

                    <div class="rounded-lg border bg-background p-3">
                        <div
                            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div class="space-y-1">
                                <p
                                    class="text-sm font-semibold text-foreground"
                                >
                                    Start visit handoff
                                </p>
                                <p class="text-xs text-muted-foreground">
                                    Route the patient into OPD, emergency
                                    triage, walk-in lab or dispensary, billing,
                                    or chart review in one flow.
                                </p>
                            </div>
                            <Button
                                class="gap-1.5 sm:shrink-0"
                                @click="
                                    openPatientVisitHandoff(
                                        postRegistrationPatient,
                                        'post-registration',
                                    )
                                "
                            >
                                <AppIcon
                                    name="clipboard-list"
                                    class="size-3.5"
                                />
                                Start Handoff
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter class="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        @click="closePostRegistrationDialog"
                    >
                        Close
                    </Button>
                    <Button
                        variant="secondary"
                        class="gap-1.5"
                        @click="registerAnotherPatient"
                    >
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
            @update:open="
                (open) =>
                    open
                        ? (visitHandoffSheetOpen = true)
                        : closePatientVisitHandoff()
            "
        >
            <SheetContent
                side="right"
                variant="form"
                size="5xl"
                class="flex h-full min-h-0 flex-col"
            >
                <SheetHeader
                    v-if="visitHandoffPatient"
                    class="shrink-0 border-b px-6 py-4 pr-12 text-left"
                >
                    <SheetTitle class="flex items-center gap-2">
                        <AppIcon
                            name="clipboard-list"
                            class="size-5 text-primary"
                        />
                        Patient Visit Handoff
                    </SheetTitle>
                    <SheetDescription>
                        {{ visitHandoffSourceLabel }} workflow for
                        {{ patientName(visitHandoffPatient) }}
                        <template v-if="visitHandoffPatient.patientNumber">
                            | {{ visitHandoffPatient.patientNumber }}
                        </template>
                    </SheetDescription>
                </SheetHeader>

                <div
                    v-if="visitHandoffPatient"
                    class="min-h-0 flex-1 overflow-y-auto px-6 py-5"
                >
                    <div class="space-y-5">
                        <section class="rounded-lg border bg-muted/20 p-3">
                            <div
                                class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                            >
                                <div
                                    class="grid min-w-0 flex-1 gap-3 sm:grid-cols-3"
                                >
                                    <div>
                                        <p
                                            class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                                        >
                                            Patient
                                        </p>
                                        <p
                                            class="mt-1 truncate text-sm font-semibold text-foreground"
                                        >
                                            {{
                                                patientName(visitHandoffPatient)
                                            }}
                                        </p>
                                    </div>
                                    <div>
                                        <p
                                            class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                                        >
                                            Contact
                                        </p>
                                        <p
                                            class="mt-1 truncate text-sm font-semibold text-foreground"
                                        >
                                            {{
                                                visitHandoffPatient.phone ||
                                                'Not recorded'
                                            }}
                                        </p>
                                    </div>
                                    <div>
                                        <p
                                            class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                                        >
                                            Location
                                        </p>
                                        <p
                                            class="mt-1 truncate text-sm font-semibold text-foreground"
                                        >
                                            {{
                                                patientLocationLabel(
                                                    visitHandoffPatient,
                                                )
                                            }}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    v-if="canReadPatients"
                                    size="sm"
                                    variant="outline"
                                    as-child
                                    class="h-8 shrink-0 gap-1.5"
                                >
                                    <Link
                                        :href="
                                            patientChartContextHref(
                                                visitHandoffPatient,
                                                { from: 'patients' },
                                            )
                                        "
                                    >
                                        <AppIcon
                                            name="book-open"
                                            class="size-3.5"
                                        />
                                        Open patient chart
                                    </Link>
                                </Button>
                            </div>
                        </section>

                        <Alert
                            v-if="
                                visitHandoffPatient.status &&
                                visitHandoffPatient.status !== 'active'
                            "
                            variant="destructive"
                        >
                            <AlertTitle>Patient is not active</AlertTitle>
                            <AlertDescription>
                                Reactivate or review this patient before
                                starting a new appointment, triage, or billing
                                workflow.
                            </AlertDescription>
                        </Alert>

                        <Alert v-if="visitHandoffError" variant="destructive">
                            <AlertTitle>Visit check unavailable</AlertTitle>
                            <AlertDescription>{{
                                visitHandoffError
                            }}</AlertDescription>
                        </Alert>

                        <Alert
                            v-if="visitHandoffActionError"
                            variant="destructive"
                        >
                            <AlertTitle>Handoff action failed</AlertTitle>
                            <AlertDescription>{{
                                visitHandoffActionError
                            }}</AlertDescription>
                        </Alert>

                        <section class="space-y-3">
                            <div
                                class="flex items-center justify-between gap-3"
                            >
                                <div>
                                    <p
                                        class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
                                    >
                                        Current visit check
                                    </p>
                                    <p
                                        class="mt-1 text-sm text-muted-foreground"
                                    >
                                        Confirm the patient does not already
                                        have an active outpatient visit before
                                        creating another one.
                                    </p>
                                </div>
                                <Badge variant="outline">{{
                                    visitHandoffLoading ? 'Checking' : 'Ready'
                                }}</Badge>
                            </div>

                            <div v-if="visitHandoffLoading" class="space-y-2">
                                <Skeleton class="h-16 w-full" />
                                <Skeleton class="h-16 w-full" />
                            </div>

                            <div
                                v-else-if="visitHandoffActiveAppointment"
                                class="flex flex-col gap-3 rounded-lg border border-amber-300/60 bg-amber-500/5 px-4 py-3 dark:border-amber-700/50 dark:bg-amber-500/10"
                            >
                                <div class="flex items-start gap-3">
                                    <div
                                        class="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                    >
                                        <AppIcon
                                            name="alert-triangle"
                                            class="size-4"
                                        />
                                    </div>
                                    <div class="min-w-0">
                                        <p
                                            class="text-sm font-semibold text-amber-900 dark:text-amber-200"
                                        >
                                            Active visit already exists
                                        </p>
                                        <p
                                            class="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/80"
                                        >
                                            Use
                                            <span
                                                class="font-mono font-semibold"
                                                >{{
                                                    visitHandoffActiveAppointment.appointmentNumber ||
                                                    'the current visit'
                                                }}</span
                                            >
                                            instead of opening a duplicate
                                            workflow.
                                        </p>
                                        <div
                                            class="mt-2 flex flex-wrap items-center gap-2"
                                        >
                                            <Badge
                                                variant="outline"
                                                class="border-amber-400/60 bg-amber-500/10 text-amber-900 dark:border-amber-600/60 dark:bg-amber-500/20 dark:text-amber-200"
                                            >
                                                {{
                                                    formatEnumLabel(
                                                        visitHandoffActiveAppointment.status ||
                                                            'active visit',
                                                    )
                                                }}
                                            </Badge>
                                            <span
                                                v-if="
                                                    visitHandoffActiveAppointment.scheduledAt
                                                "
                                                class="text-xs text-amber-800/70 dark:text-amber-300/70"
                                            >
                                                {{
                                                    formatDateTime(
                                                        visitHandoffActiveAppointment.scheduledAt,
                                                    )
                                                }}
                                            </span>
                                            <span
                                                v-if="
                                                    visitHandoffActiveAppointment.department
                                                "
                                                class="text-xs text-amber-800/70 dark:text-amber-300/70"
                                            >
                                                {{
                                                    visitHandoffActiveAppointment.department
                                                }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    class="flex flex-wrap gap-2 border-t border-amber-300/40 pt-3 dark:border-amber-700/40"
                                >
                                    <Button
                                        v-if="visitHandoffCanCheckIn"
                                        size="sm"
                                        class="gap-1.5"
                                        :disabled="visitHandoffSubmitting"
                                        @click="checkInVisitFromHandoff"
                                    >
                                        <AppIcon
                                            name="calendar-clock"
                                            class="size-3.5"
                                        />
                                        {{
                                            visitHandoffSubmitting
                                                ? 'Checking in...'
                                                : 'Check in now'
                                        }}
                                    </Button>
                                    <Button
                                        v-if="visitHandoffExistingVisitHref"
                                        size="sm"
                                        variant="outline"
                                        as-child
                                        class="gap-1.5"
                                    >
                                        <Link
                                            :href="
                                                visitHandoffExistingVisitHref
                                            "
                                        >
                                            <AppIcon
                                                name="arrow-up-right"
                                                class="size-3.5"
                                            />
                                            Open visit
                                        </Link>
                                    </Button>
                                </div>
                            </div>

                            <div
                                v-else
                                class="rounded-lg border border-dashed bg-background px-3 py-3 text-sm text-muted-foreground"
                            >
                                No active outpatient visit was found from the
                                patient context available to this user.
                            </div>
                        </section>

                        <section class="space-y-3 border-t pt-5">
                            <div>
                                <p
                                    class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
                                >
                                    Handoff route
                                </p>
                                <p class="mt-1 text-sm text-muted-foreground">
                                    Choose the operational lane that matches why
                                    the patient is at the facility now.
                                </p>
                            </div>

                            <div class="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    :class="
                                        visitHandoffModeButtonClass(
                                            'outpatient',
                                        )
                                    "
                                    @click="visitHandoffMode = 'outpatient'"
                                >
                                    <span
                                        class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                                    >
                                        <AppIcon
                                            name="calendar-clock"
                                            class="size-4"
                                        />
                                    </span>
                                    <span class="min-w-0 flex-1">
                                        <span
                                            class="flex items-center justify-between gap-2"
                                        >
                                            <span
                                                class="text-sm font-semibold text-foreground"
                                                >Outpatient visit</span
                                            >
                                            <Badge
                                                variant="secondary"
                                                class="text-xs"
                                                >{{
                                                    visitHandoffModeBadge(
                                                        'outpatient',
                                                    )
                                                }}</Badge
                                            >
                                        </span>
                                        <span
                                            class="mt-1 block text-xs leading-5 text-muted-foreground"
                                        >
                                            Standard OPD flow: appointment,
                                            arrival check-in, nurse triage,
                                            provider, orders, billing.
                                        </span>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    :class="
                                        visitHandoffModeButtonClass('emergency')
                                    "
                                    @click="visitHandoffMode = 'emergency'"
                                >
                                    <span
                                        class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"
                                    >
                                        <AppIcon
                                            name="activity"
                                            class="size-4"
                                        />
                                    </span>
                                    <span class="min-w-0 flex-1">
                                        <span
                                            class="flex items-center justify-between gap-2"
                                        >
                                            <span
                                                class="text-sm font-semibold text-foreground"
                                                >Emergency triage</span
                                            >
                                            <Badge
                                                variant="outline"
                                                class="text-xs"
                                                >{{
                                                    visitHandoffModeBadge(
                                                        'emergency',
                                                    )
                                                }}</Badge
                                            >
                                        </span>
                                        <span
                                            class="mt-1 block text-xs leading-5 text-muted-foreground"
                                        >
                                            Use when the patient needs immediate
                                            assessment, stabilization, transfer,
                                            or admission routing.
                                        </span>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    :class="
                                        visitHandoffModeButtonClass(
                                            'direct-services',
                                        )
                                    "
                                    @click="
                                        visitHandoffMode = 'direct-services'
                                    "
                                >
                                    <span
                                        class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200"
                                    >
                                        <AppIcon
                                            name="flask-conical"
                                            class="size-4"
                                        />
                                    </span>
                                    <span class="min-w-0 flex-1">
                                        <span
                                            class="flex items-center justify-between gap-2"
                                        >
                                            <span
                                                class="text-sm font-semibold text-foreground"
                                                >Direct services</span
                                            >
                                            <Badge
                                                variant="outline"
                                                class="text-xs"
                                                >{{
                                                    visitHandoffModeBadge(
                                                        'direct-services',
                                                    )
                                                }}</Badge
                                            >
                                        </span>
                                        <span
                                            class="mt-1 block text-xs leading-5 text-muted-foreground"
                                        >
                                            Lab, imaging, or pharmacy without
                                            booking OPD. Queue a direct service
                                            ticket or open the department
                                            workspace when your login allows it.
                                        </span>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    :class="
                                        visitHandoffModeButtonClass('billing')
                                    "
                                    @click="visitHandoffMode = 'billing'"
                                >
                                    <span
                                        class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700"
                                    >
                                        <AppIcon
                                            name="receipt"
                                            class="size-4"
                                        />
                                    </span>
                                    <span class="min-w-0 flex-1">
                                        <span
                                            class="flex items-center justify-between gap-2"
                                        >
                                            <span
                                                class="text-sm font-semibold text-foreground"
                                                >Billing first</span
                                            >
                                            <Badge
                                                variant="outline"
                                                class="text-xs"
                                                >{{
                                                    visitHandoffModeBadge(
                                                        'billing',
                                                    )
                                                }}</Badge
                                            >
                                        </span>
                                        <span
                                            class="mt-1 block text-xs leading-5 text-muted-foreground"
                                        >
                                            For registration fees, deposits,
                                            cashier instructions, or
                                            patient-share collection.
                                        </span>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    :class="
                                        visitHandoffModeButtonClass('chart')
                                    "
                                    @click="visitHandoffMode = 'chart'"
                                >
                                    <span
                                        class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                                    >
                                        <AppIcon
                                            name="book-open"
                                            class="size-4"
                                        />
                                    </span>
                                    <span class="min-w-0 flex-1">
                                        <span
                                            class="flex items-center justify-between gap-2"
                                        >
                                            <span
                                                class="text-sm font-semibold text-foreground"
                                                >Chart only</span
                                            >
                                            <Badge
                                                variant="outline"
                                                class="text-xs"
                                                >{{
                                                    visitHandoffModeBadge(
                                                        'chart',
                                                    )
                                                }}</Badge
                                            >
                                        </span>
                                        <span
                                            class="mt-1 block text-xs leading-5 text-muted-foreground"
                                        >
                                            Review patient context without
                                            creating a new visit or financial
                                            workflow.
                                        </span>
                                    </span>
                                </button>
                            </div>
                        </section>

                        <section class="rounded-lg border bg-muted/20 p-4">
                            <div
                                v-if="visitHandoffEmergencyNeedsTriageStaff"
                                class="mb-4 flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50/90 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/40"
                            >
                                <div
                                    class="flex size-8 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300"
                                >
                                    <AppIcon
                                        name="heart-pulse"
                                        class="size-4"
                                    />
                                </div>
                                <div class="min-w-0 space-y-2">
                                    <p
                                        class="text-sm font-semibold text-sky-950 dark:text-sky-50"
                                    >
                                        Direct patient to emergency triage
                                    </p>
                                    <p
                                        class="text-xs leading-relaxed text-sky-900/80 dark:text-sky-100/75"
                                    >
                                        Your role covers registration and
                                        routing. Triage staff will open the
                                        patient record at their station when the
                                        patient arrives. Direct the patient to
                                        the emergency triage area now.
                                    </p>
                                    <div class="flex items-center gap-2 pt-0.5">
                                        <span
                                            class="text-xs text-sky-800/70 dark:text-sky-300/70"
                                            >Patient number</span
                                        >
                                        <span
                                            class="rounded-md border border-sky-300/60 bg-white/80 px-2 py-0.5 font-mono text-sm font-semibold tracking-wide text-sky-950 dark:border-sky-700/60 dark:bg-sky-900/50 dark:text-sky-50"
                                        >
                                            {{
                                                visitHandoffPatient?.patientNumber ||
                                                visitHandoffPatient?.id?.slice(
                                                    0,
                                                    8,
                                                ) ||
                                                '—'
                                            }}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <template
                                v-if="
                                    visitHandoffMode === 'outpatient' &&
                                    !visitHandoffActiveAppointment
                                "
                            >
                                <div
                                    class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
                                >
                                    <div class="space-y-1">
                                        <p
                                            class="text-sm font-semibold text-foreground"
                                        >
                                            Choose OPD arrival type
                                        </p>
                                        <p
                                            class="max-w-xl text-xs leading-5 text-muted-foreground"
                                        >
                                            Start a same-day walk-in now, or
                                            book a future scheduled OPD visit.
                                        </p>
                                        <p
                                            v-if="
                                                !canCreateAppointments ||
                                                !canUpdateAppointmentsStatus
                                            "
                                            class="text-xs leading-relaxed font-medium text-muted-foreground"
                                        >
                                            Starting a walk-in requires
                                            appointment creation and check-in
                                            permission.
                                        </p>
                                    </div>
                                    <div
                                        class="flex flex-col gap-2 sm:shrink-0 sm:flex-row"
                                    >
                                        <Button
                                            class="gap-1.5"
                                            :disabled="
                                                visitHandoffSubmitting ||
                                                !canCreateAppointments ||
                                                !canUpdateAppointmentsStatus ||
                                                visitHandoffPatient?.status !==
                                                    'active'
                                            "
                                            @click="
                                                startOutpatientWalkInFromHandoff
                                            "
                                        >
                                            <AppIcon
                                                name="log-in"
                                                class="size-3.5"
                                            />
                                            {{
                                                visitHandoffSubmitting
                                                    ? 'Starting...'
                                                    : 'Start OPD walk-in now'
                                            }}
                                        </Button>
                                        <Button
                                            v-if="
                                                visitHandoffScheduleAppointmentHref
                                            "
                                            variant="outline"
                                            as-child
                                            class="gap-1.5"
                                        >
                                            <Link
                                                :href="
                                                    visitHandoffScheduleAppointmentHref
                                                "
                                            >
                                                <AppIcon
                                                    name="calendar-plus-2"
                                                    class="size-3.5"
                                                />
                                                Schedule future visit
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </template>

                            <template
                                v-else-if="
                                    visitHandoffMode === 'direct-services'
                                "
                            >
                                <div class="space-y-4">
                                    <p class="text-sm text-muted-foreground">
                                        {{ visitHandoffPrimaryDescription }}
                                    </p>

                                    <div
                                        v-if="
                                            visitHandoffCanUseDirectServicesRoute &&
                                            !visitHandoffHasAnyDirectServiceRight &&
                                            canCreateServiceRequests
                                        "
                                        class="space-y-2"
                                    >
                                        <div class="flex flex-wrap gap-2">
                                            <Button
                                                v-for="service in [
                                                    {
                                                        key: 'laboratory',
                                                        label: 'Lab',
                                                        icon: 'flask-conical',
                                                    },
                                                    {
                                                        key: 'radiology',
                                                        label: 'Imaging',
                                                        icon: 'activity',
                                                    },
                                                    {
                                                        key: 'pharmacy',
                                                        label: 'Pharmacy',
                                                        icon: 'pill',
                                                    },
                                                    {
                                                        key: 'theatre_procedure',
                                                        label: 'Procedure',
                                                        icon: 'scissors',
                                                    },
                                                ] as const"
                                                :key="service.key"
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                :disabled="
                                                    directServiceSending !==
                                                        null ||
                                                    !!directServiceSentMap[
                                                        `${visitHandoffPatient?.id}:${service.key}`
                                                    ]
                                                "
                                                :class="[
                                                    'border-border bg-background',
                                                    directServiceSentMap[
                                                        `${visitHandoffPatient?.id}:${service.key}`
                                                    ]
                                                        ? 'cursor-default opacity-60'
                                                        : '',
                                                ]"
                                                @click="
                                                    createDirectServiceRequest(
                                                        service.key,
                                                    )
                                                "
                                            >
                                                <AppIcon
                                                    v-if="
                                                        directServiceSending !==
                                                        service.key
                                                    "
                                                    :name="
                                                        directServiceSentMap[
                                                            `${visitHandoffPatient?.id}:${service.key}`
                                                        ]
                                                            ? 'check-circle'
                                                            : service.icon
                                                    "
                                                    class="size-3.5"
                                                />
                                                <AppIcon
                                                    v-else
                                                    name="loader-circle"
                                                    class="size-3.5 animate-spin"
                                                />
                                                {{
                                                    directServiceSentMap[
                                                        `${visitHandoffPatient?.id}:${service.key}`
                                                    ]
                                                        ? `${service.label} ✓`
                                                        : `Send to ${service.label}`
                                                }}
                                            </Button>
                                        </div>
                                        <p
                                            v-if="
                                                visitHandoffDirectServiceSessionTickets.length >
                                                0
                                            "
                                            class="text-xs text-muted-foreground"
                                            role="status"
                                            aria-live="polite"
                                        >
                                            <span
                                                class="font-medium text-foreground"
                                                >Tickets:</span
                                            >
                                            {{
                                                visitHandoffDirectServiceSessionTickets
                                                    .map(
                                                        (row) =>
                                                            `${row.label} ${row.requestNumber}`,
                                                    )
                                                    .join(' · ')
                                            }}
                                        </p>
                                        <div
                                            v-if="
                                                visitHandoffDirectServiceSessionTickets.length >
                                                0
                                            "
                                            class="flex flex-wrap gap-2"
                                        >
                                            <Button
                                                v-for="ticket in visitHandoffDirectServiceSessionTickets"
                                                :key="`copy-${ticket.key}`"
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                class="h-7 gap-1.5 text-xs"
                                                @click="
                                                    copyDirectServiceTicket(
                                                        ticket,
                                                    )
                                                "
                                            >
                                                <AppIcon
                                                    name="copy"
                                                    class="size-3.5"
                                                />
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
                                                <Link
                                                    :href="
                                                        directServiceQueueHref(
                                                            ticket.key,
                                                        )
                                                    "
                                                >
                                                    <AppIcon
                                                        name="list-checks"
                                                        class="size-3.5"
                                                    />
                                                    Open
                                                    {{ ticket.label }} queue
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>

                                    <!-- Ordering staff: direct workspace links -->
                                    <div
                                        v-if="
                                            visitHandoffHasAnyDirectServiceRight
                                        "
                                        class="grid gap-2 sm:grid-cols-2"
                                    >
                                        <Button
                                            v-if="canCreateLaboratoryOrders"
                                            size="sm"
                                            variant="secondary"
                                            as-child
                                            class="justify-start gap-1.5"
                                        >
                                            <Link
                                                :href="
                                                    patientContextHref(
                                                        '/laboratory-orders',
                                                        visitHandoffPatient,
                                                        { includeTabNew: true },
                                                    )
                                                "
                                            >
                                                <AppIcon
                                                    name="flask-conical"
                                                    class="size-3.5"
                                                />
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
                                            <Link
                                                :href="
                                                    patientContextHref(
                                                        '/radiology-orders',
                                                        visitHandoffPatient,
                                                        { includeTabNew: true },
                                                    )
                                                "
                                            >
                                                <AppIcon
                                                    name="activity"
                                                    class="size-3.5"
                                                />
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
                                            <Link
                                                :href="
                                                    patientContextHref(
                                                        '/pharmacy-orders',
                                                        visitHandoffPatient,
                                                        { includeTabNew: true },
                                                    )
                                                "
                                            >
                                                <AppIcon
                                                    name="pill"
                                                    class="size-3.5"
                                                />
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
                                            <Link
                                                :href="
                                                    patientContextHref(
                                                        '/theatre-procedures',
                                                        visitHandoffPatient,
                                                        { includeTabNew: true },
                                                    )
                                                "
                                            >
                                                <AppIcon
                                                    name="scissors"
                                                    class="size-3.5"
                                                />
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
                                            <Link
                                                :href="
                                                    patientTimelineHref(
                                                        '/billing-invoices',
                                                        visitHandoffPatient.id,
                                                        {
                                                            appointmentId:
                                                                visitHandoffActiveAppointment?.id ??
                                                                null,
                                                        },
                                                    )
                                                "
                                            >
                                                <AppIcon
                                                    name="receipt"
                                                    class="size-3.5"
                                                />
                                                Invoice / billing
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </template>

                            <div
                                v-if="visitHandoffEmergencyNeedsTriageStaff"
                                class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div class="space-y-1">
                                    <p
                                        class="text-sm font-semibold text-foreground"
                                    >
                                        Send to emergency triage queue
                                    </p>
                                    <p
                                        class="max-w-xl text-xs leading-5 text-muted-foreground"
                                    >
                                        Creates a walk-in visit and places the
                                        patient in the nurse triage queue.
                                        Triage staff will see the patient at
                                        their station and complete urgent
                                        intake.
                                    </p>
                                </div>
                                <Button
                                    class="shrink-0 gap-1.5"
                                    :disabled="
                                        visitHandoffSubmitting ||
                                        !canCreateAppointments ||
                                        !canUpdateAppointmentsStatus
                                    "
                                    @click="sendToEmergencyQueue"
                                >
                                    <AppIcon
                                        name="heart-pulse"
                                        class="size-3.5"
                                    />
                                    {{
                                        visitHandoffSubmitting
                                            ? 'Queueing...'
                                            : 'Send to emergency queue'
                                    }}
                                </Button>
                            </div>

                            <div
                                v-else-if="
                                    !visitHandoffEmergencyNeedsTriageStaff &&
                                    visitHandoffMode !== 'direct-services' &&
                                    !(
                                        visitHandoffMode === 'outpatient' &&
                                        !visitHandoffActiveAppointment
                                    )
                                "
                                class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                            >
                                <div class="space-y-1">
                                    <p
                                        class="text-sm font-semibold text-foreground"
                                    >
                                        {{ visitHandoffPrimaryLabel }}
                                    </p>
                                    <p
                                        class="max-w-xl text-xs leading-5 text-muted-foreground"
                                    >
                                        {{ visitHandoffPrimaryDescription }}
                                    </p>
                                    <p
                                        v-if="visitHandoffPrimaryDisabledReason"
                                        class="text-xs leading-relaxed font-medium text-muted-foreground"
                                    >
                                        {{ visitHandoffPrimaryDisabledReason }}
                                    </p>
                                </div>
                                <Button
                                    v-if="
                                        visitHandoffCanCheckIn &&
                                        !visitHandoffPrimaryDisabledReason
                                    "
                                    class="gap-1.5 sm:shrink-0"
                                    :disabled="visitHandoffSubmitting"
                                    @click="checkInVisitFromHandoff"
                                >
                                    <AppIcon
                                        :name="visitHandoffPrimaryIcon"
                                        class="size-3.5"
                                    />
                                    {{
                                        visitHandoffSubmitting
                                            ? 'Checking in...'
                                            : visitHandoffPrimaryLabel
                                    }}
                                </Button>
                                <Button
                                    v-else-if="
                                        visitHandoffPrimaryHref &&
                                        !visitHandoffPrimaryDisabledReason
                                    "
                                    as-child
                                    class="gap-1.5 sm:shrink-0"
                                >
                                    <Link :href="visitHandoffPrimaryHref">
                                        <AppIcon
                                            :name="visitHandoffPrimaryIcon"
                                            class="size-3.5"
                                        />
                                        {{ visitHandoffPrimaryLabel }}
                                    </Link>
                                </Button>
                                <Button
                                    v-else
                                    disabled
                                    class="gap-1.5 sm:shrink-0"
                                >
                                    <AppIcon
                                        :name="visitHandoffPrimaryIcon"
                                        class="size-3.5"
                                    />
                                    {{ visitHandoffPrimaryLabel }}
                                </Button>
                            </div>
                        </section>
                    </div>
                </div>

                <SheetFooter class="shrink-0 border-t px-6 py-4">
                    <Button variant="outline" @click="closePatientVisitHandoff"
                        >Close</Button
                    >
                </SheetFooter>
            </SheetContent>
        </Sheet>

        <!-- ================================================================== -->
        <!-- PATIENT DETAILS SHEET                                             -->
        <!-- ================================================================== -->
        <Sheet
            :open="detailsSheetOpen"
            @update:open="
                (open) =>
                    open
                        ? (detailsSheetOpen = true)
                        : closePatientDetailsSheet()
            "
        >
            <SheetContent
                side="right"
                variant="workspace"
                size="5xl"
                class="flex h-full min-h-0 flex-col"
            >
                <SheetHeader
                    v-if="detailsSheetPatient"
                    class="shrink-0 border-b bg-background/95 px-4 py-3 pr-12 text-left sm:px-5"
                >
                    <SheetTitle
                        class="flex min-w-0 flex-wrap items-center gap-2 text-base"
                    >
                        <AppIcon
                            name="user"
                            class="size-5 text-muted-foreground"
                        />
                        <span class="min-w-0 truncate">{{
                            patientName(detailsSheetPatient)
                        }}</span>
                        <Badge
                            v-if="detailsSheetPatient.patientNumber"
                            variant="outline"
                            class="shrink-0 font-normal"
                        >
                            {{ detailsSheetPatient.patientNumber }}
                        </Badge>
                        <Badge
                            :variant="statusVariant(detailsSheetPatient.status)"
                            class="shrink-0 capitalize"
                        >
                            {{ detailsSheetPatient.status || 'unknown' }}
                        </Badge>
                    </SheetTitle>
                    <SheetDescription
                        class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                    >
                        <span class="flex items-center gap-1">
                            <AppIcon name="user" class="size-3 opacity-50" />
                            <span class="capitalize">{{
                                detailsSheetPatient.gender ||
                                'Gender not recorded'
                            }}</span>
                        </span>
                        <span class="text-muted-foreground/40">&middot;</span>
                        <span class="flex items-center gap-1">
                            <AppIcon
                                name="calendar"
                                class="size-3 opacity-50"
                            />
                            <span>{{
                                detailsSheetPatient.dateOfBirth
                                    ? `Age ${formatAge(detailsSheetPatient.dateOfBirth)}`
                                    : 'Age not recorded'
                            }}</span>
                        </span>
                        <span class="text-muted-foreground/40">&middot;</span>
                        <span class="flex items-center gap-1">
                            <AppIcon name="map-pin" class="size-3 opacity-50" />
                            <span>{{
                                patientLocationLabel(detailsSheetPatient)
                            }}</span>
                        </span>
                    </SheetDescription>
                </SheetHeader>

                <div
                    v-if="detailsSheetPatient"
                    class="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                    <Tabs
                        v-model="detailsSheetTab"
                        class="flex h-full min-h-0 flex-col"
                    >
                        <div
                            class="shrink-0 border-b bg-background px-4 py-2 sm:px-5"
                        >
                            <div class="space-y-2.5">
                                <div
                                    class="grid gap-y-2 rounded-md bg-muted/20 px-3 py-2 text-xs sm:grid-cols-3 sm:divide-x sm:divide-border/50"
                                >
                                    <div class="min-w-0 sm:pr-3">
                                        <p
                                            class="font-medium tracking-[0.14em] text-muted-foreground uppercase"
                                        >
                                            Contact
                                        </p>
                                        <p
                                            class="mt-1 truncate text-sm font-medium text-foreground"
                                        >
                                            {{
                                                detailsSheetPatient.phone ||
                                                'Phone not recorded'
                                            }}
                                        </p>
                                        <p
                                            class="truncate text-muted-foreground"
                                        >
                                            {{
                                                patientLocationLabel(
                                                    detailsSheetPatient,
                                                )
                                            }}
                                        </p>
                                    </div>
                                    <div class="min-w-0 sm:px-3">
                                        <p
                                            class="font-medium tracking-[0.14em] text-muted-foreground uppercase"
                                        >
                                            Identity
                                        </p>
                                        <p
                                            class="mt-1 truncate text-sm font-medium text-foreground"
                                        >
                                            {{
                                                detailsSheetPatient.patientNumber ||
                                                `ID: ${detailsSheetPatient.id.slice(0, 8)}`
                                            }}
                                        </p>
                                        <p
                                            class="truncate text-muted-foreground"
                                        >
                                            {{
                                                detailsSheetPatient.dateOfBirth
                                                    ? `Age ${formatAge(detailsSheetPatient.dateOfBirth)}`
                                                    : 'Age not recorded'
                                            }}
                                        </p>
                                    </div>
                                    <div class="min-w-0 sm:pl-3">
                                        <p
                                            class="font-medium tracking-[0.14em] text-muted-foreground uppercase"
                                        >
                                            Care activity
                                        </p>
                                        <p
                                            class="mt-1 truncate text-sm font-medium text-foreground"
                                        >
                                            {{
                                                detailsWorkflowRecommendation?.title ??
                                                'Review patient workflow'
                                            }}
                                        </p>
                                        <p
                                            class="truncate text-muted-foreground"
                                        >
                                            {{ detailsTimelineEvents.length }}
                                            recorded events
                                        </p>
                                    </div>
                                </div>

                                <div class="w-full">
                                    <TabsList
                                        class="grid h-auto w-full gap-1 rounded-md bg-muted p-1"
                                        :class="
                                            canViewPatientAudit
                                                ? 'grid-cols-3'
                                                : 'grid-cols-2'
                                        "
                                    >
                                        <TabsTrigger
                                            value="overview"
                                            class="h-9 min-w-0 gap-1.5 rounded-md px-2 text-xs sm:px-3 sm:text-sm"
                                        >
                                            <AppIcon
                                                name="layout-grid"
                                                class="size-3.5"
                                            />
                                            Overview
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="activity"
                                            class="h-9 min-w-0 gap-1.5 rounded-md px-2 text-xs sm:px-3 sm:text-sm"
                                        >
                                            <AppIcon
                                                name="activity"
                                                class="size-3.5"
                                            />
                                            Activity
                                        </TabsTrigger>
                                        <TabsTrigger
                                            v-if="canViewPatientAudit"
                                            value="audit"
                                            class="h-9 min-w-0 gap-1.5 rounded-md px-2 text-xs sm:px-3 sm:text-sm"
                                        >
                                            <AppIcon
                                                name="file-text"
                                                class="size-3.5"
                                            />
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
                                </div>
                            </div>
                        </div>

                        <ScrollArea
                            class="min-h-0 flex-1"
                            viewport-class="pb-6"
                        >
                            <!-- OVERVIEW TAB -->
                            <TabsContent
                                value="overview"
                                class="m-0 space-y-3 px-4 py-3 sm:px-5"
                            >
                                <!-- Status reason banner (shown when inactive/deactivated) -->
                                <div
                                    v-if="
                                        detailsSheetPatient.status &&
                                        detailsSheetPatient.status !==
                                            'active' &&
                                        detailsSheetPatient.statusReason
                                    "
                                    class="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs"
                                >
                                    <AppIcon
                                        name="alert-triangle"
                                        class="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                                    />
                                    <span
                                        class="text-amber-700 dark:text-amber-300"
                                    >
                                        <span
                                            class="font-semibold capitalize"
                                            >{{
                                                detailsSheetPatient.status
                                            }}</span
                                        >:
                                        {{ detailsSheetPatient.statusReason }}
                                    </span>
                                </div>

                                <!-- Identity & Contact -->
                                <div class="grid gap-3 sm:grid-cols-2">
                                    <Card
                                        class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none"
                                    >
                                        <CardHeader
                                            class="border-b border-border/40 bg-muted/15 px-3 py-2"
                                        >
                                            <CardTitle
                                                class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                                            >
                                                <AppIcon
                                                    name="user"
                                                    class="size-3.5"
                                                />
                                                Identity
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent
                                            class="divide-y divide-border/50 px-3 py-1.5 text-sm"
                                        >
                                            <div
                                                class="flex items-center justify-between gap-4 py-2"
                                            >
                                                <span
                                                    class="text-muted-foreground"
                                                    >Gender</span
                                                >
                                                <span
                                                    class="font-medium capitalize"
                                                    >{{
                                                        detailsSheetPatient.gender ||
                                                        'Not recorded'
                                                    }}</span
                                                >
                                            </div>
                                            <div
                                                class="flex items-center justify-between gap-4 py-2"
                                            >
                                                <span
                                                    class="text-muted-foreground"
                                                    >Date of birth</span
                                                >
                                                <span class="font-medium">
                                                    {{
                                                        formatDate(
                                                            detailsSheetPatient.dateOfBirth,
                                                        ) || 'Not recorded'
                                                    }}
                                                    <span
                                                        v-if="
                                                            detailsSheetPatient.dateOfBirth
                                                        "
                                                        class="ml-1 text-xs text-muted-foreground"
                                                    >
                                                        ({{
                                                            formatAge(
                                                                detailsSheetPatient.dateOfBirth,
                                                            )
                                                        }})
                                                    </span>
                                                </span>
                                            </div>
                                            <div
                                                class="flex items-center justify-between gap-4 py-2"
                                            >
                                                <span
                                                    class="text-muted-foreground"
                                                    >National ID</span
                                                >
                                                <span
                                                    class="font-mono text-xs font-medium"
                                                    >{{
                                                        detailsSheetPatient.nationalId ||
                                                        'Not recorded'
                                                    }}</span
                                                >
                                            </div>
                                            <div
                                                class="flex items-center justify-between gap-4 py-2"
                                            >
                                                <span
                                                    class="text-muted-foreground"
                                                    >Registered</span
                                                >
                                                <span class="font-medium">{{
                                                    formatDate(
                                                        detailsSheetPatient.createdAt,
                                                    ) || 'Not recorded'
                                                }}</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card
                                        class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none"
                                    >
                                        <CardHeader
                                            class="border-b border-border/40 bg-muted/15 px-3 py-2"
                                        >
                                            <CardTitle
                                                class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                                            >
                                                <AppIcon
                                                    name="phone"
                                                    class="size-3.5"
                                                />
                                                Contact
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent
                                            class="divide-y divide-border/50 px-3 py-1.5 text-sm"
                                        >
                                            <div
                                                class="flex items-center justify-between gap-4 py-2"
                                            >
                                                <span
                                                    class="text-muted-foreground"
                                                    >Phone</span
                                                >
                                                <span class="font-medium">{{
                                                    detailsSheetPatient.phone ||
                                                    'Not recorded'
                                                }}</span>
                                            </div>
                                            <div
                                                class="flex items-center justify-between gap-4 py-2"
                                            >
                                                <span
                                                    class="text-muted-foreground"
                                                    >Email</span
                                                >
                                                <span
                                                    class="max-w-[14rem] truncate text-right font-medium"
                                                    >{{
                                                        detailsSheetPatient.email ||
                                                        'Not recorded'
                                                    }}</span
                                                >
                                            </div>
                                            <div
                                                class="flex items-center justify-between gap-4 py-2"
                                            >
                                                <span
                                                    class="shrink-0 text-muted-foreground"
                                                    >Address</span
                                                >
                                                <span
                                                    class="text-right font-medium"
                                                    >{{
                                                        detailsSheetPatient.addressLine ||
                                                        'Not recorded'
                                                    }}</span
                                                >
                                            </div>
                                            <div
                                                class="flex items-center justify-between gap-4 py-2"
                                            >
                                                <span
                                                    class="shrink-0 text-muted-foreground"
                                                    >Location</span
                                                >
                                                <span
                                                    class="text-right font-medium"
                                                    >{{
                                                        patientLocationLabel(
                                                            detailsSheetPatient,
                                                        )
                                                    }}</span
                                                >
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <!-- Emergency Contact -->
                                <Card
                                    class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none"
                                >
                                    <CardHeader
                                        class="border-b border-border/40 bg-muted/15 px-3 py-2"
                                    >
                                        <CardTitle
                                            class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                                        >
                                            <AppIcon
                                                name="users"
                                                class="size-3.5"
                                            />
                                            Emergency Contact
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent
                                        class="grid gap-0 divide-y divide-border/50 px-3 py-1.5 text-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0"
                                    >
                                        <div
                                            class="flex items-center justify-between gap-4 py-2 sm:pr-4"
                                        >
                                            <span
                                                class="shrink-0 text-muted-foreground"
                                                >Name</span
                                            >
                                            <span
                                                class="text-right font-medium"
                                                >{{
                                                    detailsSheetPatient.nextOfKinName ||
                                                    'Not recorded'
                                                }}</span
                                            >
                                        </div>
                                        <div
                                            class="flex items-center justify-between gap-4 py-2 sm:pl-4"
                                        >
                                            <span
                                                class="shrink-0 text-muted-foreground"
                                                >Phone</span
                                            >
                                            <span class="font-medium">{{
                                                detailsSheetPatient.nextOfKinPhone ||
                                                'Not recorded'
                                            }}</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card
                                    v-if="canReadPatientInsurance"
                                    class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none"
                                >
                                    <CardHeader
                                        class="border-b border-border/40 bg-muted/15 px-3 py-2"
                                    >
                                        <div
                                            class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div>
                                                <CardTitle
                                                    class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                                                >
                                                    <AppIcon
                                                        name="shield-check"
                                                        class="size-3.5"
                                                    />
                                                    Insurance Coverage
                                                </CardTitle>
                                                <CardDescription
                                                    class="mt-1 text-xs"
                                                >
                                                    Coverage identifier,
                                                    verification, and payer
                                                    contract mapping.
                                                </CardDescription>
                                            </div>
                                            <Button
                                                v-if="canManagePatientInsurance"
                                                size="sm"
                                                variant="outline"
                                                class="h-8 gap-1.5 text-xs"
                                                @click="
                                                    insuranceFormOpen =
                                                        !insuranceFormOpen
                                                "
                                            >
                                                <AppIcon
                                                    :name="
                                                        insuranceFormOpen
                                                            ? 'x'
                                                            : 'plus'
                                                    "
                                                    class="size-3.5"
                                                />
                                                {{
                                                    insuranceFormOpen
                                                        ? 'Close'
                                                        : 'Add Coverage ID'
                                                }}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent class="space-y-3 px-3 py-2.5">
                                        <Alert
                                            v-if="detailsInsuranceError"
                                            variant="destructive"
                                        >
                                            <AlertTitle
                                                >Insurance
                                                unavailable</AlertTitle
                                            >
                                            <AlertDescription>{{
                                                detailsInsuranceError
                                            }}</AlertDescription>
                                        </Alert>

                                        <div
                                            v-if="detailsInsuranceLoading"
                                            class="space-y-2"
                                        >
                                            <Skeleton class="h-16 w-full" />
                                            <Skeleton class="h-16 w-full" />
                                        </div>

                                        <div
                                            v-else-if="
                                                detailsInsuranceRecords.length ===
                                                0
                                            "
                                            class="rounded-md border border-dashed border-border/60 p-3 text-sm text-muted-foreground"
                                        >
                                            No insurance identifier is linked to
                                            this patient yet.
                                        </div>

                                        <div v-else class="space-y-2">
                                            <div
                                                v-for="record in detailsInsuranceRecords"
                                                :key="record.id"
                                                class="rounded-md border border-border/60 bg-background p-3"
                                            >
                                                <div
                                                    class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                                                >
                                                    <div class="min-w-0">
                                                        <div
                                                            class="flex flex-wrap items-center gap-2"
                                                        >
                                                            <p
                                                                class="text-sm font-medium"
                                                            >
                                                                {{
                                                                    record.insuranceProvider ||
                                                                    'Insurance provider'
                                                                }}
                                                            </p>
                                                            <Badge
                                                                variant="outline"
                                                                class="capitalize"
                                                            >
                                                                {{
                                                                    formatEnumLabel(
                                                                        record.insuranceType ||
                                                                            'coverage',
                                                                    )
                                                                }}
                                                            </Badge>
                                                            <Badge
                                                                :variant="
                                                                    record.status ===
                                                                    'active'
                                                                        ? 'secondary'
                                                                        : 'outline'
                                                                "
                                                                class="capitalize"
                                                            >
                                                                {{
                                                                    record.status ||
                                                                    'unknown'
                                                                }}
                                                            </Badge>
                                                            <Badge
                                                                :variant="
                                                                    record.verificationStatus ===
                                                                    'verified'
                                                                        ? 'secondary'
                                                                        : 'outline'
                                                                "
                                                                class="capitalize"
                                                            >
                                                                {{
                                                                    record.verificationStatus ||
                                                                    'unverified'
                                                                }}
                                                            </Badge>
                                                        </div>
                                                        <div
                                                            class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
                                                        >
                                                            <span
                                                                v-if="
                                                                    record.memberId
                                                                "
                                                                >Insurance no
                                                                {{
                                                                    record.memberId
                                                                }}</span
                                                            >
                                                            <span
                                                                v-if="
                                                                    record.cardNumber
                                                                "
                                                                >NIDA
                                                                {{
                                                                    record.cardNumber
                                                                }}</span
                                                            >
                                                            <span
                                                                v-if="
                                                                    !record.memberId &&
                                                                    !record.cardNumber
                                                                "
                                                                >No identifier
                                                                recorded</span
                                                            >
                                                        </div>
                                                    </div>
                                                    <Button
                                                        v-if="
                                                            canVerifyPatientInsurance &&
                                                            record.verificationStatus !==
                                                                'verified'
                                                        "
                                                        size="sm"
                                                        variant="outline"
                                                        class="h-8 gap-1.5 text-xs"
                                                        :disabled="
                                                            detailsInsuranceSaving
                                                        "
                                                        @click="
                                                            verifyPatientInsurance(
                                                                record,
                                                            )
                                                        "
                                                    >
                                                        <AppIcon
                                                            name="badge-check"
                                                            class="size-3.5"
                                                        />
                                                        Mark Verified
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            v-if="activePatientInsuranceRecord"
                                            class="rounded-md bg-primary/5 p-3 text-xs text-muted-foreground"
                                        >
                                            Active identifiers are available for
                                            eligibility checks. Billing routes
                                            to
                                            <span
                                                class="font-medium text-foreground"
                                            >
                                                {{
                                                    activePatientInsuranceRecord.insuranceProvider ||
                                                    'linked coverage'
                                                }}
                                            </span>
                                            when a valid payer contract is
                                            configured.
                                        </div>

                                        <div
                                            v-if="
                                                insuranceFormOpen &&
                                                canManagePatientInsurance
                                            "
                                            class="rounded-md bg-muted/20 p-3"
                                        >
                                            <div
                                                class="grid gap-3 md:grid-cols-2"
                                            >
                                                <div class="space-y-1.5">
                                                    <Label
                                                        >Insurance number</Label
                                                    >
                                                    <Input
                                                        v-model="
                                                            insuranceForm.memberId
                                                        "
                                                        placeholder="Member, card, or policy ID"
                                                    />
                                                </div>
                                                <div class="space-y-1.5">
                                                    <Label>NIDA number</Label>
                                                    <div
                                                        class="flex flex-col gap-2 sm:flex-row"
                                                    >
                                                        <Input
                                                            v-model="
                                                                insuranceForm.cardNumber
                                                            "
                                                            class="min-w-0 flex-1"
                                                            placeholder="National ID used for verification"
                                                        />
                                                        <Button
                                                            v-if="
                                                                detailsSheetPatient?.nationalId
                                                            "
                                                            type="button"
                                                            variant="outline"
                                                            class="shrink-0"
                                                            :disabled="
                                                                detailsInsuranceSaving
                                                            "
                                                            @click="
                                                                fillInsuranceIdentifierFromNationalId
                                                            "
                                                        >
                                                            Use NIDA
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div class="space-y-1.5">
                                                    <Label
                                                        >Coverage source</Label
                                                    >
                                                    <Select
                                                        :model-value="
                                                            insuranceForm.providerCode ||
                                                            SELECT_NONE_VALUE
                                                        "
                                                        :disabled="
                                                            detailsInsuranceOptionsLoading
                                                        "
                                                        @update:model-value="
                                                            applyInsuranceProviderPreset(
                                                                String(
                                                                    $event,
                                                                ) ===
                                                                    SELECT_NONE_VALUE
                                                                    ? ''
                                                                    : String(
                                                                          $event ||
                                                                              '',
                                                                      ),
                                                            )
                                                        "
                                                    >
                                                        <SelectTrigger
                                                            class="w-full"
                                                        >
                                                            <SelectValue
                                                                placeholder="Select source"
                                                            />
                                                        </SelectTrigger>
                                                        <SelectContent
                                                            class="z-[80]"
                                                        >
                                                            <SelectItem
                                                                :value="
                                                                    SELECT_NONE_VALUE
                                                                "
                                                                >Not
                                                                selected</SelectItem
                                                            >
                                                            <SelectItem
                                                                v-for="preset in patientInsuranceProviderPresets"
                                                                :key="
                                                                    preset.code
                                                                "
                                                                :value="
                                                                    preset.code
                                                                "
                                                            >
                                                                {{
                                                                    preset.name
                                                                }}
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="space-y-1.5">
                                                    <Label
                                                        >Payer contract</Label
                                                    >
                                                    <Select
                                                        :model-value="
                                                            insuranceForm.billingPayerContractId ||
                                                            SELECT_NONE_VALUE
                                                        "
                                                        :disabled="
                                                            detailsInsuranceOptionsLoading
                                                        "
                                                        @update:model-value="
                                                            applyInsurancePayerContract(
                                                                String(
                                                                    $event,
                                                                ) ===
                                                                    SELECT_NONE_VALUE
                                                                    ? ''
                                                                    : String(
                                                                          $event ||
                                                                              '',
                                                                      ),
                                                            )
                                                        "
                                                    >
                                                        <SelectTrigger
                                                            class="w-full"
                                                        >
                                                            <SelectValue
                                                                placeholder="Link payer contract"
                                                            />
                                                        </SelectTrigger>
                                                        <SelectContent
                                                            class="z-[80]"
                                                        >
                                                            <SelectItem
                                                                :value="
                                                                    SELECT_NONE_VALUE
                                                                "
                                                                >No contract
                                                                selected</SelectItem
                                                            >
                                                            <SelectItem
                                                                v-for="contract in patientInsurancePayerContracts"
                                                                :key="
                                                                    contract.id
                                                                "
                                                                :value="
                                                                    contract.id
                                                                "
                                                            >
                                                                {{
                                                                    contract.payerName ||
                                                                    contract.contractName ||
                                                                    contract.contractCode
                                                                }}
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div
                                                class="mt-3 flex justify-end gap-2"
                                            >
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    :disabled="
                                                        detailsInsuranceSaving
                                                    "
                                                    @click="resetInsuranceForm"
                                                >
                                                    Reset
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    class="gap-1.5"
                                                    :disabled="
                                                        detailsInsuranceSaving ||
                                                        (!insuranceForm.memberId.trim() &&
                                                            !insuranceForm.cardNumber.trim())
                                                    "
                                                    @click="
                                                        submitPatientInsurance
                                                    "
                                                >
                                                    <AppIcon
                                                        name="save"
                                                        class="size-3.5"
                                                    />
                                                    Save IDs
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <!-- ACTIVITY TAB -->
                            <TabsContent
                                value="activity"
                                class="m-0 space-y-3 px-4 py-3 sm:px-5"
                            >
                                <Card
                                    class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none"
                                >
                                    <CardHeader
                                        class="border-b border-border/40 bg-muted/15 px-3 py-2"
                                    >
                                        <div
                                            class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div>
                                                <CardTitle
                                                    class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                                                >
                                                    <AppIcon
                                                        name="clipboard-list"
                                                        class="size-3.5"
                                                    />
                                                    Workflow handoff
                                                </CardTitle>
                                                <CardDescription
                                                    class="mt-1 text-xs"
                                                >
                                                    Routes to outpatient,
                                                    emergency triage, direct
                                                    services (lab, imaging,
                                                    pharmacy), billing, or chart
                                                    review.
                                                </CardDescription>
                                            </div>
                                            <Button
                                                size="sm"
                                                class="shrink-0 gap-1.5"
                                                @click="
                                                    openPatientVisitHandoff(
                                                        detailsSheetPatient,
                                                        'details',
                                                    )
                                                "
                                            >
                                                <AppIcon
                                                    name="clipboard-list"
                                                    class="size-3.5"
                                                />
                                                Start handoff
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent class="space-y-3 px-3 py-2.5">
                                        <Alert
                                            v-if="
                                                detailsSheetPatient.status &&
                                                detailsSheetPatient.status !==
                                                    'active'
                                            "
                                            variant="destructive"
                                        >
                                            <AlertTitle
                                                >Patient is not
                                                active</AlertTitle
                                            >
                                            <AlertDescription>
                                                Reactivate or review status
                                                before starting a new
                                                appointment, triage, or
                                                consultation.
                                            </AlertDescription>
                                        </Alert>

                                        <div class="rounded-md bg-muted/20 p-3">
                                            <p
                                                class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                                            >
                                                Recommended next step
                                            </p>
                                            <p
                                                class="mt-1 text-sm font-medium text-foreground"
                                            >
                                                {{
                                                    detailsWorkflowRecommendation?.title ??
                                                    'Review patient workflow'
                                                }}
                                            </p>
                                            <p
                                                class="mt-1 text-xs text-muted-foreground"
                                            >
                                                {{
                                                    detailsWorkflowRecommendation?.description ??
                                                    'Review the current visit state before continuing care.'
                                                }}
                                            </p>
                                            <div
                                                v-if="detailsCurrentAppointment"
                                                class="mt-2.5 flex flex-wrap items-center gap-2"
                                            >
                                                <Badge
                                                    variant="outline"
                                                    class="gap-1 font-mono text-xs font-normal"
                                                >
                                                    <AppIcon
                                                        name="calendar-clock"
                                                        class="size-3 opacity-60"
                                                    />
                                                    {{
                                                        detailsCurrentAppointment.appointmentNumber ??
                                                        'No number'
                                                    }}
                                                </Badge>
                                                <Badge
                                                    variant="secondary"
                                                    class="text-xs capitalize"
                                                >
                                                    {{
                                                        formatEnumLabel(
                                                            detailsCurrentAppointment.status ??
                                                                'unknown',
                                                        )
                                                    }}
                                                </Badge>
                                                <span
                                                    v-if="
                                                        detailsCurrentAppointment.scheduledAt
                                                    "
                                                    class="flex items-center gap-1 text-xs text-muted-foreground"
                                                >
                                                    <AppIcon
                                                        name="calendar"
                                                        class="size-3 opacity-50"
                                                    />
                                                    {{
                                                        formatDateTime(
                                                            detailsCurrentAppointment.scheduledAt,
                                                        )
                                                    }}
                                                </span>
                                                <span
                                                    v-if="
                                                        detailsCurrentAppointment.department
                                                    "
                                                    class="flex items-center gap-1 text-xs text-muted-foreground"
                                                >
                                                    <AppIcon
                                                        name="map-pin"
                                                        class="size-3 opacity-50"
                                                    />
                                                    {{
                                                        detailsCurrentAppointment.department
                                                    }}
                                                </span>
                                                <span
                                                    v-if="
                                                        detailsCurrentAppointment.reason
                                                    "
                                                    class="text-xs text-muted-foreground italic"
                                                >
                                                    "{{
                                                        detailsCurrentAppointment.reason
                                                    }}"
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Alert
                                    v-if="detailsTimelineError"
                                    variant="destructive"
                                >
                                    <AlertTitle>{{
                                        tW2('timeline.loadIssue')
                                    }}</AlertTitle>
                                    <AlertDescription>{{
                                        detailsTimelineError
                                    }}</AlertDescription>
                                </Alert>

                                <div
                                    v-if="detailsTimelineLoading"
                                    class="space-y-2"
                                >
                                    <Skeleton class="h-16 w-full" />
                                    <Skeleton class="h-16 w-full" />
                                    <Skeleton class="h-16 w-full" />
                                </div>

                                <template v-else>
                                    <div
                                        v-if="
                                            detailsTimelineEvents.length === 0
                                        "
                                        class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
                                    >
                                        {{ tW2('timeline.emptyAll') }}
                                    </div>

                                    <div
                                        class="grid [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))] gap-2"
                                    >
                                        <div
                                            v-for="section in detailsTimelineSummary"
                                            :key="section.key"
                                            class="rounded-md bg-muted/20 px-3 py-2.5"
                                        >
                                            <div
                                                class="flex items-center justify-between gap-3"
                                            >
                                                <div>
                                                    <p
                                                        class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                                                    >
                                                        {{ section.label }}
                                                    </p>
                                                    <p
                                                        class="mt-1 text-lg font-semibold text-foreground"
                                                    >
                                                        {{ section.count }}
                                                    </p>
                                                </div>
                                                <div
                                                    class="flex h-9 w-9 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm"
                                                >
                                                    <AppIcon
                                                        :name="section.icon"
                                                        class="size-4"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <Card
                                        class="!gap-3 rounded-md border-border/50 bg-card/70 !py-3 shadow-none"
                                    >
                                        <CardHeader class="px-3 pt-0 pb-1">
                                            <CardTitle
                                                class="text-sm font-medium"
                                                >Patient activity
                                                feed</CardTitle
                                            >
                                            <CardDescription class="text-xs">
                                                Latest profile, appointment,
                                                admission, and consultation
                                                activity in one stream.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent class="px-3 pt-0">
                                            <div class="space-y-0">
                                                <div
                                                    v-for="(
                                                        event, index
                                                    ) in detailsTimelineEvents"
                                                    :key="event.id"
                                                    class="relative pb-4 pl-12 last:pb-0"
                                                >
                                                    <span
                                                        v-if="
                                                            index !==
                                                            detailsTimelineEvents.length -
                                                                1
                                                        "
                                                        class="absolute top-8 left-[15px] h-[calc(100%-1rem)] w-px bg-border"
                                                    />
                                                    <div
                                                        class="absolute top-0 left-0 flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm"
                                                    >
                                                        <AppIcon
                                                            :name="
                                                                timelineEventIcon(
                                                                    event.category,
                                                                )
                                                            "
                                                            class="size-4 text-muted-foreground"
                                                        />
                                                    </div>
                                                    <div
                                                        class="rounded-md border border-border/60 bg-background px-3 py-2.5"
                                                    >
                                                        <div
                                                            class="flex flex-wrap items-start justify-between gap-2"
                                                        >
                                                            <div
                                                                class="min-w-0 flex-1"
                                                            >
                                                                <div
                                                                    class="flex flex-wrap items-center gap-2"
                                                                >
                                                                    <Badge
                                                                        variant="outline"
                                                                        >{{
                                                                            event.badge
                                                                        }}</Badge
                                                                    >
                                                                    <span
                                                                        class="text-xs text-muted-foreground"
                                                                    >
                                                                        {{
                                                                            formatDateTime(
                                                                                event.occurredAt,
                                                                            )
                                                                        }}
                                                                    </span>
                                                                </div>
                                                                <p
                                                                    class="mt-2 font-medium text-foreground"
                                                                >
                                                                    {{
                                                                        event.title
                                                                    }}
                                                                </p>
                                                                <p
                                                                    class="mt-1 text-sm text-muted-foreground"
                                                                >
                                                                    {{
                                                                        event.description
                                                                    }}
                                                                </p>
                                                                <div
                                                                    v-if="
                                                                        event.actorLabel
                                                                    "
                                                                    class="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
                                                                >
                                                                    <AppIcon
                                                                        :name="
                                                                            event.actorType ===
                                                                            'System'
                                                                                ? 'activity'
                                                                                : 'user'
                                                                        "
                                                                        class="size-3.5 opacity-60"
                                                                    />
                                                                    <span
                                                                        >By
                                                                        <span
                                                                            class="font-medium text-foreground"
                                                                            >{{
                                                                                event.actorLabel
                                                                            }}</span
                                                                        ></span
                                                                    >
                                                                    <Badge
                                                                        v-if="
                                                                            event.actorType
                                                                        "
                                                                        variant="secondary"
                                                                        class="px-1.5 py-0 text-[10px]"
                                                                        >{{
                                                                            event.actorType
                                                                        }}</Badge
                                                                    >
                                                                </div>
                                                            </div>
                                                            <Link
                                                                v-if="
                                                                    event.href
                                                                "
                                                                :href="
                                                                    event.href
                                                                "
                                                                class="inline-flex shrink-0 items-center text-xs font-medium text-primary underline underline-offset-2"
                                                            >
                                                                {{
                                                                    timelineEventLinkLabel(
                                                                        event.category,
                                                                    )
                                                                }}
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
                            <TabsContent
                                v-if="canViewPatientAudit"
                                value="audit"
                                class="m-0 space-y-3 px-4 py-3 sm:px-5"
                            >
                                <Card
                                    class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none"
                                >
                                    <CardHeader
                                        class="border-b border-border/40 bg-muted/15 px-3 py-2"
                                    >
                                        <div
                                            class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div>
                                                <CardTitle
                                                    class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                                                >
                                                    <AppIcon
                                                        name="file-text"
                                                        class="size-3.5"
                                                    />
                                                    Audit trail
                                                </CardTitle>
                                                <CardDescription
                                                    class="mt-1 text-xs"
                                                >
                                                    {{
                                                        detailsAuditSummary.total
                                                    }}
                                                    entries — search by action,
                                                    user, or date range
                                                </CardDescription>
                                            </div>
                                            <div
                                                class="flex flex-wrap items-center gap-2"
                                            >
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    class="h-8 text-xs"
                                                    :disabled="
                                                        detailsAuditLoading ||
                                                        detailsAuditExporting
                                                    "
                                                    @click="
                                                        exportDetailsAuditLogsCsv
                                                    "
                                                >
                                                    {{
                                                        detailsAuditExporting
                                                            ? 'Preparing…'
                                                            : 'Export CSV'
                                                    }}
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    class="h-8 gap-1.5 text-xs"
                                                    @click="
                                                        detailsAuditFiltersOpen =
                                                            !detailsAuditFiltersOpen
                                                    "
                                                >
                                                    <AppIcon
                                                        name="sliders-horizontal"
                                                        class="size-3.5"
                                                    />
                                                    {{
                                                        detailsAuditFiltersOpen
                                                            ? 'Hide filters'
                                                            : 'More filters'
                                                    }}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent class="space-y-3 px-3 py-2.5">
                                        <div
                                            class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]"
                                        >
                                            <div class="space-y-1.5">
                                                <Label
                                                    for="patient-audit-q"
                                                    class="text-xs"
                                                    >Search logs</Label
                                                >
                                                <Input
                                                    id="patient-audit-q"
                                                    v-model="
                                                        detailsAuditFilters.q
                                                    "
                                                    placeholder="Search action label, action key, or actor..."
                                                    @keyup.enter="
                                                        applyDetailsAuditFilters
                                                    "
                                                />
                                            </div>
                                            <div
                                                class="flex flex-col-reverse gap-2 sm:flex-row lg:items-end"
                                            >
                                                <Button
                                                    size="sm"
                                                    class="gap-1.5"
                                                    :disabled="
                                                        detailsAuditLoading
                                                    "
                                                    @click="
                                                        applyDetailsAuditFilters
                                                    "
                                                >
                                                    <AppIcon
                                                        name="search"
                                                        class="size-3.5"
                                                    />
                                                    {{
                                                        detailsAuditLoading
                                                            ? 'Searching...'
                                                            : 'Search'
                                                    }}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    class="gap-1.5"
                                                    :disabled="
                                                        detailsAuditLoading
                                                    "
                                                    @click="
                                                        resetDetailsAuditFilters
                                                    "
                                                >
                                                    <AppIcon
                                                        name="sliders-horizontal"
                                                        class="size-3.5"
                                                    />
                                                    Reset
                                                </Button>
                                            </div>
                                        </div>

                                        <div
                                            class="grid [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))] gap-2"
                                        >
                                            <div
                                                class="rounded-md bg-muted/20 px-3 py-2.5"
                                            >
                                                <p
                                                    class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                                                >
                                                    Entries
                                                </p>
                                                <p
                                                    class="mt-1 text-sm font-semibold text-foreground"
                                                >
                                                    {{
                                                        detailsAuditSummary.total
                                                    }}
                                                </p>
                                            </div>
                                            <div
                                                class="rounded-md bg-muted/20 px-3 py-2.5"
                                            >
                                                <p
                                                    class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                                                >
                                                    Changed events
                                                </p>
                                                <p
                                                    class="mt-1 text-sm font-semibold text-foreground"
                                                >
                                                    {{
                                                        detailsAuditSummary.changedEntries
                                                    }}
                                                </p>
                                            </div>
                                            <div
                                                class="rounded-md bg-muted/20 px-3 py-2.5"
                                            >
                                                <p
                                                    class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                                                >
                                                    User actions
                                                </p>
                                                <p
                                                    class="mt-1 text-sm font-semibold text-foreground"
                                                >
                                                    {{
                                                        detailsAuditSummary.userEntries
                                                    }}
                                                </p>
                                            </div>
                                            <div
                                                class="rounded-md bg-muted/20 px-3 py-2.5"
                                            >
                                                <p
                                                    class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                                                >
                                                    System events
                                                </p>
                                                <p
                                                    class="mt-1 text-sm font-semibold text-foreground"
                                                >
                                                    {{
                                                        detailsAuditSummary.systemEntries
                                                    }}
                                                </p>
                                            </div>
                                        </div>

                                        <div
                                            v-if="
                                                detailsAuditActiveFilters.length >
                                                0
                                            "
                                            class="flex flex-wrap gap-2"
                                        >
                                            <Badge
                                                v-for="filter in detailsAuditActiveFilters"
                                                :key="filter.key"
                                                variant="secondary"
                                                class="px-2 py-1 text-xs"
                                            >
                                                {{ filter.label }}
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Collapsible
                                    v-model:open="detailsAuditFiltersOpen"
                                >
                                    <CollapsibleContent>
                                        <Card
                                            class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none"
                                        >
                                            <CardHeader
                                                class="border-b border-border/40 bg-muted/15 px-3 py-2"
                                            >
                                                <CardTitle
                                                    class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                                                >
                                                    <AppIcon
                                                        name="sliders-horizontal"
                                                        class="size-3.5"
                                                    />
                                                    Advanced filters
                                                </CardTitle>
                                                <CardDescription class="text-xs"
                                                    >Narrow by action, user,
                                                    actor type, date range, or
                                                    page size.</CardDescription
                                                >
                                            </CardHeader>
                                            <CardContent class="px-3 py-2.5">
                                                <div
                                                    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                                                >
                                                    <div class="space-y-1.5">
                                                        <Label
                                                            for="patient-audit-action"
                                                            class="text-xs"
                                                            >Exact action
                                                            key</Label
                                                        >
                                                        <Input
                                                            id="patient-audit-action"
                                                            v-model="
                                                                detailsAuditFilters.action
                                                            "
                                                            placeholder="Optional system action key"
                                                        />
                                                    </div>
                                                    <div class="space-y-1.5">
                                                        <Label
                                                            for="patient-audit-actor-type"
                                                            class="text-xs"
                                                            >Actor type</Label
                                                        >
                                                        <Select
                                                            v-model="
                                                                detailsAuditActorTypeFilterValue
                                                            "
                                                        >
                                                            <SelectTrigger
                                                                class="mt-0"
                                                            >
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem
                                                                    v-for="option in auditActorTypeOptions"
                                                                    :key="`audit-at-${option.value}`"
                                                                    :value="
                                                                        option.value
                                                                    "
                                                                    >{{
                                                                        option.label
                                                                    }}</SelectItem
                                                                >
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div class="space-y-1.5">
                                                        <Label
                                                            for="patient-audit-actor-id"
                                                            class="text-xs"
                                                            >Actor user
                                                            ID</Label
                                                        >
                                                        <Input
                                                            id="patient-audit-actor-id"
                                                            v-model="
                                                                detailsAuditFilters.actorId
                                                            "
                                                            inputmode="numeric"
                                                            placeholder="Optional user ID"
                                                        />
                                                    </div>
                                                    <div class="space-y-1.5">
                                                        <Label
                                                            for="patient-audit-from"
                                                            class="text-xs"
                                                            >From</Label
                                                        >
                                                        <Input
                                                            id="patient-audit-from"
                                                            v-model="
                                                                detailsAuditFilters.from
                                                            "
                                                            type="datetime-local"
                                                            class="mt-0"
                                                        />
                                                    </div>
                                                    <div class="space-y-1.5">
                                                        <Label
                                                            for="patient-audit-to"
                                                            class="text-xs"
                                                            >To</Label
                                                        >
                                                        <Input
                                                            id="patient-audit-to"
                                                            v-model="
                                                                detailsAuditFilters.to
                                                            "
                                                            type="datetime-local"
                                                            class="mt-0"
                                                        />
                                                    </div>
                                                    <div class="space-y-1.5">
                                                        <Label
                                                            for="patient-audit-per-page"
                                                            class="text-xs"
                                                            >Rows per
                                                            page</Label
                                                        >
                                                        <Select
                                                            :model-value="
                                                                String(
                                                                    detailsAuditFilters.perPage,
                                                                )
                                                            "
                                                            @update:model-value="
                                                                detailsAuditFilters.perPage =
                                                                    Number(
                                                                        $event,
                                                                    )
                                                            "
                                                        >
                                                            <SelectTrigger
                                                                class="mt-0"
                                                            >
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem
                                                                    value="10"
                                                                    >10</SelectItem
                                                                >
                                                                <SelectItem
                                                                    value="20"
                                                                    >20</SelectItem
                                                                >
                                                                <SelectItem
                                                                    value="50"
                                                                    >50</SelectItem
                                                                >
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </CollapsibleContent>
                                </Collapsible>

                                <Alert
                                    v-if="detailsAuditError"
                                    variant="destructive"
                                >
                                    <AlertTitle class="flex items-center gap-2">
                                        <AppIcon
                                            name="circle-x"
                                            class="size-4"
                                        />
                                        Audit load issue
                                    </AlertTitle>
                                    <AlertDescription>{{
                                        detailsAuditError
                                    }}</AlertDescription>
                                </Alert>
                                <div
                                    v-else-if="detailsAuditLoading"
                                    class="space-y-2"
                                >
                                    <Skeleton class="h-12 w-full" />
                                    <Skeleton class="h-12 w-full" />
                                    <Skeleton class="h-12 w-full" />
                                </div>
                                <div
                                    v-else-if="detailsAuditLogs.length === 0"
                                    class="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center"
                                >
                                    <AppIcon
                                        name="file-text"
                                        class="size-6 text-muted-foreground/50"
                                    />
                                    <p class="text-sm text-muted-foreground">
                                        No audit logs found for current filters.
                                    </p>
                                </div>
                                <div v-else class="space-y-2">
                                    <div
                                        v-for="log in detailsAuditLogs"
                                        :key="log.id"
                                        class="flex gap-3 rounded-md border border-border/60 bg-background px-3 py-2.5 text-sm"
                                    >
                                        <!-- Actor icon: amber for system, muted for user -->
                                        <div
                                            class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full"
                                            :class="
                                                auditLogActorTypeLabel(log) ===
                                                'System'
                                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                    : 'bg-muted/60 text-muted-foreground'
                                            "
                                        >
                                            <AppIcon
                                                :name="
                                                    auditLogActorTypeLabel(
                                                        log,
                                                    ) === 'System'
                                                        ? 'activity'
                                                        : 'user'
                                                "
                                                class="size-4"
                                            />
                                        </div>
                                        <!-- Content -->
                                        <div class="min-w-0 flex-1">
                                            <!-- Action headline + timestamp -->
                                            <div
                                                class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                                            >
                                                <span
                                                    class="font-semibold text-foreground"
                                                >
                                                    {{
                                                        log.actionLabel ||
                                                        auditFieldLabel(
                                                            log.action ||
                                                                'Event',
                                                        )
                                                    }}
                                                </span>
                                                <span
                                                    class="shrink-0 text-xs text-muted-foreground"
                                                    >{{
                                                        formatDateTime(
                                                            log.createdAt,
                                                        )
                                                    }}</span
                                                >
                                            </div>
                                            <!-- Who performed it -->
                                            <p
                                                class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
                                            >
                                                Performed by
                                                <span
                                                    class="font-medium text-foreground"
                                                    >{{
                                                        auditActorLabel(log)
                                                    }}</span
                                                >
                                                <Badge
                                                    variant="secondary"
                                                    class="px-1.5 py-0 text-[10px]"
                                                    >{{
                                                        auditLogActorTypeLabel(
                                                            log,
                                                        )
                                                    }}</Badge
                                                >
                                            </p>
                                            <!-- Changed fields -->
                                            <div
                                                v-if="
                                                    auditLogChangeSummaryBadges(
                                                        log,
                                                    ).length > 0
                                                "
                                                class="mt-2 flex flex-wrap items-center gap-1.5"
                                            >
                                                <span
                                                    class="text-xs text-muted-foreground"
                                                    >{{
                                                        auditLogChangeSummaryLabel(
                                                            log,
                                                        )
                                                    }}</span
                                                >
                                                <Badge
                                                    v-for="field in auditLogChangeSummaryBadges(
                                                        log,
                                                    )"
                                                    :key="`${log.id}-field-${field}`"
                                                    variant="outline"
                                                    class="px-1.5 py-0 text-[11px]"
                                                >
                                                    {{ field }}
                                                </Badge>
                                            </div>
                                            <div
                                                v-if="
                                                    auditCreatedSnapshotPreview(
                                                        log,
                                                    ).length > 0
                                                "
                                                class="mt-2 grid gap-1 text-xs text-muted-foreground"
                                            >
                                                <p
                                                    v-for="item in auditCreatedSnapshotPreview(
                                                        log,
                                                    )"
                                                    :key="`${log.id}-created-${item.key}`"
                                                >
                                                    <span
                                                        class="font-medium text-foreground"
                                                        >{{ item.key }}:</span
                                                    >
                                                    {{ item.value }}
                                                </p>
                                            </div>
                                            <!-- Metadata -->
                                            <div
                                                v-if="
                                                    auditLogMetadataPreview(log)
                                                        .length > 0
                                                "
                                                class="mt-2 grid gap-1 text-xs text-muted-foreground"
                                            >
                                                <p
                                                    v-for="item in auditLogMetadataPreview(
                                                        log,
                                                    )"
                                                    :key="`${log.id}-meta-${item.key}`"
                                                >
                                                    <span
                                                        class="font-medium text-foreground"
                                                        >{{ item.key }}:</span
                                                    >
                                                    {{ item.value }}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    v-if="detailsAuditLogs.length > 0"
                                    class="flex flex-col gap-2 border-t pt-2 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="h-8 text-xs"
                                        :disabled="
                                            detailsAuditLoading ||
                                            !detailsAuditMeta ||
                                            detailsAuditMeta.currentPage <= 1
                                        "
                                        @click="
                                            goToDetailsAuditPage(
                                                (detailsAuditMeta?.currentPage ??
                                                    2) - 1,
                                            )
                                        "
                                    >
                                        Previous
                                    </Button>
                                    <p class="text-xs text-muted-foreground">
                                        Page
                                        {{ detailsAuditMeta?.currentPage ?? 1 }}
                                        of
                                        {{ detailsAuditMeta?.lastPage ?? 1 }} |
                                        {{ detailsAuditTotalEntries }} logs
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="h-8 text-xs"
                                        :disabled="
                                            detailsAuditLoading ||
                                            !detailsAuditMeta ||
                                            detailsAuditMeta.currentPage >=
                                                detailsAuditMeta.lastPage
                                        "
                                        @click="
                                            goToDetailsAuditPage(
                                                (detailsAuditMeta?.currentPage ??
                                                    0) + 1,
                                            )
                                        "
                                    >
                                        Next
                                    </Button>
                                </div>
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                </div>
                <SheetFooter
                    class="shrink-0 flex-col-reverse gap-2 border-t bg-background px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                    <Button
                        variant="outline"
                        size="sm"
                        class="gap-1.5 sm:shrink-0"
                        @click="closePatientDetailsSheet"
                    >
                        <AppIcon name="circle-x" class="size-3.5" />
                        Close
                    </Button>
                    <div
                        class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center"
                    >
                        <Button
                            v-if="canUpdatePatientStatus && detailsSheetPatient"
                            size="sm"
                            :variant="
                                detailsSheetPatient.status === 'active'
                                    ? 'outline'
                                    : 'secondary'
                            "
                            class="gap-1.5"
                            @click="openStatusDialog(detailsSheetPatient)"
                        >
                            <AppIcon
                                :name="
                                    detailsSheetPatient.status === 'active'
                                        ? 'user-x'
                                        : 'user-check'
                                "
                                class="size-3.5"
                            />
                            {{
                                detailsSheetPatient.status === 'active'
                                    ? 'Deactivate'
                                    : 'Activate'
                            }}
                        </Button>
                        <Button
                            v-if="canUpdatePatients && detailsSheetPatient"
                            size="sm"
                            variant="outline"
                            class="gap-1.5"
                            @click="openEditSheet(detailsSheetPatient)"
                        >
                            <AppIcon name="pencil" class="size-3.5" />
                            Edit Demographics
                        </Button>
                        <Button
                            v-if="detailsSheetPatient"
                            size="sm"
                            as-child
                            class="gap-1.5"
                        >
                            <Link
                                :href="
                                    patientChartContextHref(
                                        detailsSheetPatient,
                                        { from: 'patients' },
                                    )
                                "
                            >
                                <AppIcon name="book-open" class="size-3.5" />
                                Open Patient Chart
                            </Link>
                        </Button>
                    </div>
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
            <SheetContent side="right" variant="form" size="5xl">
                <SheetHeader
                    class="shrink-0 border-b px-4 py-3 pr-12 text-left"
                >
                    <SheetTitle class="flex items-center gap-2">
                        <AppIcon name="pencil" class="size-5" />
                        Update Patient
                    </SheetTitle>
                    <SheetDescription>
                        Keep the patient record aligned with the same intake
                        flow used during registration.
                    </SheetDescription>
                </SheetHeader>

                <ScrollArea class="min-h-0 flex-1">
                    <div class="grid gap-4 px-6 py-4 pb-8">
                        <div
                            v-if="editTargetPatient"
                            class="flex flex-col gap-3 rounded-lg border bg-muted/20 px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div class="min-w-0">
                                <p class="truncate text-sm font-medium">
                                    {{ patientName(editTargetPatient) }}
                                </p>
                                <p class="mt-0.5 text-muted-foreground">
                                    {{
                                        editTargetPatient.patientNumber ||
                                        editTargetPatient.id.slice(0, 8)
                                    }}
                                    <template v-if="scope?.facility?.name">
                                        | {{ scope.facility.name }}</template
                                    >
                                </p>
                            </div>
                            <div class="flex flex-wrap gap-1.5">
                                <Badge
                                    :variant="
                                        statusVariant(editTargetPatient.status)
                                    "
                                    class="capitalize"
                                >
                                    {{ editTargetPatient.status || 'unknown' }}
                                </Badge>
                                <Badge variant="outline">
                                    {{
                                        editTargetPatient.dateOfBirth
                                            ? formatAge(
                                                  editTargetPatient.dateOfBirth,
                                              )
                                            : 'Age not recorded'
                                    }}
                                </Badge>
                                <Badge variant="outline">{{
                                    patientLocationLabel(editTargetPatient)
                                }}</Badge>
                            </div>
                        </div>

                        <div
                            v-if="editErrorSummary.length > 0"
                            ref="editErrorSummaryRef"
                            tabindex="-1"
                        >
                            <Alert variant="destructive">
                                <AlertTitle>{{
                                    tW2('validation.summaryTitle')
                                }}</AlertTitle>
                                <AlertDescription class="space-y-2">
                                    <p class="text-xs">
                                        {{
                                            tW2('validation.summaryDescription')
                                        }}
                                    </p>
                                    <ul
                                        class="list-disc space-y-1 pl-4 text-xs"
                                    >
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
                            <legend
                                class="px-2 text-sm font-medium text-muted-foreground"
                            >
                                Patient identity
                            </legend>
                            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div class="grid gap-1.5">
                                    <Label
                                        for="patient-edit-firstName"
                                        class="text-xs font-medium"
                                    >
                                        First name
                                    </Label>
                                    <Input
                                        id="patient-edit-firstName"
                                        v-model="editForm.firstName"
                                        placeholder="First name"
                                        class="h-10"
                                        autocomplete="given-name"
                                    />
                                    <p
                                        v-if="editFieldError('firstName')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ editFieldError('firstName') }}
                                    </p>
                                </div>
                                <div class="grid gap-1.5">
                                    <Label
                                        for="patient-edit-lastName"
                                        class="text-xs font-medium"
                                    >
                                        Last name
                                    </Label>
                                    <Input
                                        id="patient-edit-lastName"
                                        v-model="editForm.lastName"
                                        placeholder="Last name"
                                        class="h-10"
                                        autocomplete="family-name"
                                    />
                                    <p
                                        v-if="editFieldError('lastName')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ editFieldError('lastName') }}
                                    </p>
                                </div>
                            </div>

                            <div
                                class="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_190px_190px]"
                            >
                                <div class="grid gap-1.5">
                                    <Label
                                        for="patient-edit-middleName"
                                        class="text-xs font-medium text-muted-foreground"
                                    >
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
                                    <Label
                                        for="patient-edit-gender"
                                        class="text-xs font-medium"
                                    >
                                        Gender
                                    </Label>
                                    <Select v-model="editGenderSelectValue">
                                        <SelectTrigger class="h-10 w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                :value="SELECT_NONE_VALUE"
                                                >Select gender</SelectItem
                                            >
                                            <SelectItem value="female"
                                                >Female</SelectItem
                                            >
                                            <SelectItem value="male"
                                                >Male</SelectItem
                                            >
                                            <SelectItem value="other"
                                                >Other</SelectItem
                                            >
                                            <SelectItem value="unknown"
                                                >Unknown</SelectItem
                                            >
                                        </SelectContent>
                                    </Select>
                                    <p
                                        v-if="editFieldError('gender')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ editFieldError('gender') }}
                                    </p>
                                </div>
                                <div class="grid gap-1.5">
                                    <Label
                                        for="patient-edit-countryCode"
                                        class="text-xs font-medium"
                                    >
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
                                    <p
                                        v-if="editFieldError('countryCode')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ editFieldError('countryCode') }}
                                    </p>
                                </div>
                            </div>
                        </fieldset>

                        <fieldset class="grid gap-4 rounded-lg border p-3">
                            <legend
                                class="px-2 text-sm font-medium text-muted-foreground"
                            >
                                Age and date of birth
                            </legend>
                            <div class="grid gap-2">
                                <div
                                    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <Label class="text-xs font-medium">
                                        Age / Date of birth
                                    </Label>
                                    <div
                                        class="inline-flex w-full rounded-md border bg-muted/40 p-0.5 sm:w-auto"
                                    >
                                        <button
                                            type="button"
                                            class="flex-1 rounded px-2.5 py-1 text-xs font-medium transition sm:flex-none"
                                            :class="
                                                editBirthInputMode ===
                                                'estimated'
                                                    ? 'bg-background text-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            "
                                            :aria-pressed="
                                                editBirthInputMode ===
                                                'estimated'
                                            "
                                            @click="
                                                setEditBirthInputMode(
                                                    'estimated',
                                                )
                                            "
                                        >
                                            Estimated age
                                        </button>
                                        <button
                                            type="button"
                                            class="flex-1 rounded px-2.5 py-1 text-xs font-medium transition sm:flex-none"
                                            :class="
                                                editBirthInputMode === 'exact'
                                                    ? 'bg-background text-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            "
                                            :aria-pressed="
                                                editBirthInputMode === 'exact'
                                            "
                                            @click="
                                                setEditBirthInputMode('exact')
                                            "
                                        >
                                            Exact date
                                        </button>
                                    </div>
                                </div>

                                <div
                                    v-if="editBirthInputMode === 'estimated'"
                                    class="grid grid-cols-1 gap-3 sm:grid-cols-2"
                                >
                                    <div class="grid gap-1.5">
                                        <Label
                                            for="patient-edit-ageYears"
                                            class="text-xs font-medium"
                                            >Years</Label
                                        >
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
                                        <Label
                                            for="patient-edit-ageMonths"
                                            class="text-xs font-medium"
                                            >Months</Label
                                        >
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

                                <div
                                    class="rounded-md bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
                                >
                                    <p
                                        v-if="
                                            editBirthInputMode ===
                                                'estimated' &&
                                            editDerivedDateOfBirth
                                        "
                                    >
                                        Estimated DOB:
                                        {{ formatDate(editDerivedDateOfBirth) }}
                                    </p>
                                    <p
                                        v-else-if="
                                            editBirthInputMode === 'estimated'
                                        "
                                    >
                                        Enter years, months, or both. For
                                        infants, months only is fine.
                                    </p>
                                    <p v-else-if="editForm.dateOfBirth">
                                        Age:
                                        {{ formatAge(editForm.dateOfBirth) }}
                                    </p>
                                    <p v-else>
                                        Choose the exact date only when it is
                                        confirmed.
                                    </p>
                                </div>
                                <div class="space-y-0.5">
                                    <p
                                        v-if="editFieldError('dateOfBirth')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ editFieldError('dateOfBirth') }}
                                    </p>
                                    <p
                                        v-if="editFieldError('ageYears')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ editFieldError('ageYears') }}
                                    </p>
                                    <p
                                        v-if="editFieldError('ageMonths')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ editFieldError('ageMonths') }}
                                    </p>
                                </div>
                            </div>
                        </fieldset>

                        <fieldset class="grid gap-4 rounded-lg border p-3">
                            <legend
                                class="px-2 text-sm font-medium text-muted-foreground"
                            >
                                Contact and address
                            </legend>
                            <div class="grid gap-1.5">
                                <Label
                                    for="patient-edit-phone"
                                    class="text-xs font-medium"
                                >
                                    Phone
                                    <span class="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="patient-edit-phone"
                                    v-model="editForm.phone"
                                    placeholder="Use international format when possible"
                                    class="h-10"
                                    autocomplete="tel"
                                />
                                <p
                                    v-if="editFieldError('phone')"
                                    class="text-xs text-destructive"
                                >
                                    {{ editFieldError('phone') }}
                                </p>
                            </div>

                            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <SearchableSelectField
                                    input-id="patient-edit-region"
                                    v-model="editForm.region"
                                    :label="editCountryUi.regionLabel"
                                    :options="editRegionOptions"
                                    :placeholder="
                                        editCountryUi.regionPlaceholder
                                    "
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
                                <Label
                                    for="patient-edit-addressLine"
                                    class="text-xs font-medium"
                                >
                                    {{ editCountryUi.addressLabel }}
                                </Label>
                                <Textarea
                                    id="patient-edit-addressLine"
                                    v-model="editForm.addressLine"
                                    rows="2"
                                    :placeholder="
                                        editCountryUi.addressPlaceholder
                                    "
                                    autocomplete="street-address"
                                />
                                <p
                                    v-if="editFieldError('addressLine')"
                                    class="text-xs text-destructive"
                                >
                                    {{ editFieldError('addressLine') }}
                                </p>
                            </div>
                        </fieldset>

                        <Collapsible v-model:open="editOptionalDetailsOpen">
                            <Card class="rounded-lg border-dashed shadow-sm">
                                <CardContent class="p-4 sm:p-5">
                                    <div
                                        class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                                    >
                                        <div>
                                            <p
                                                class="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-muted-foreground uppercase"
                                            >
                                                <AppIcon
                                                    name="file-text"
                                                    class="size-3.5"
                                                />
                                                Additional details (optional)
                                            </p>
                                            <p
                                                class="mt-1 text-xs text-muted-foreground"
                                            >
                                                Open only when those details
                                                need to change.
                                            </p>
                                        </div>
                                        <CollapsibleTrigger as-child>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                class="shrink-0"
                                            >
                                                {{
                                                    editOptionalDetailsOpen
                                                        ? tW2('common.hide')
                                                        : tW2('common.show')
                                                }}
                                            </Button>
                                        </CollapsibleTrigger>
                                    </div>
                                </CardContent>
                                <CollapsibleContent>
                                    <CardContent
                                        class="grid grid-cols-1 gap-4 border-t px-4 pt-4 pb-4 sm:grid-cols-2 sm:px-5 sm:pb-5"
                                    >
                                        <div class="grid gap-1.5">
                                            <Label
                                                for="patient-edit-nationalId"
                                                class="text-xs font-medium"
                                                >National ID</Label
                                            >
                                            <Input
                                                id="patient-edit-nationalId"
                                                v-model="editForm.nationalId"
                                                placeholder="National ID number"
                                            />
                                            <p
                                                v-if="
                                                    editFieldError('nationalId')
                                                "
                                                class="text-xs text-destructive"
                                            >
                                                {{
                                                    editFieldError('nationalId')
                                                }}
                                            </p>
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label
                                                for="patient-edit-email"
                                                class="text-xs font-medium"
                                                >Email</Label
                                            >
                                            <Input
                                                id="patient-edit-email"
                                                v-model="editForm.email"
                                                type="email"
                                                placeholder="patient@email.com"
                                            />
                                            <p
                                                v-if="editFieldError('email')"
                                                class="text-xs text-destructive"
                                            >
                                                {{ editFieldError('email') }}
                                            </p>
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label
                                                for="patient-edit-nextOfKinName"
                                                class="text-xs font-medium"
                                            >
                                                Emergency contact name
                                            </Label>
                                            <Input
                                                id="patient-edit-nextOfKinName"
                                                v-model="editForm.nextOfKinName"
                                                placeholder="Next of kin full name"
                                            />
                                            <p
                                                v-if="
                                                    editFieldError(
                                                        'nextOfKinName',
                                                    )
                                                "
                                                class="text-xs text-destructive"
                                            >
                                                {{
                                                    editFieldError(
                                                        'nextOfKinName',
                                                    )
                                                }}
                                            </p>
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label
                                                for="patient-edit-nextOfKinPhone"
                                                class="text-xs font-medium"
                                            >
                                                Emergency contact phone
                                            </Label>
                                            <Input
                                                id="patient-edit-nextOfKinPhone"
                                                v-model="
                                                    editForm.nextOfKinPhone
                                                "
                                                placeholder="Use international format when possible"
                                            />
                                            <p
                                                v-if="
                                                    editFieldError(
                                                        'nextOfKinPhone',
                                                    )
                                                "
                                                class="text-xs text-destructive"
                                            >
                                                {{
                                                    editFieldError(
                                                        'nextOfKinPhone',
                                                    )
                                                }}
                                            </p>
                                        </div>
                                    </CardContent>
                                </CollapsibleContent>
                            </Card>
                        </Collapsible>
                    </div>
                </ScrollArea>

                <SheetFooter
                    class="shrink-0 flex-col-reverse gap-2 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-end"
                >
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
                            :name="
                                statusForm.status === 'active'
                                    ? 'user-check'
                                    : 'user-x'
                            "
                            class="size-5 text-primary"
                        />
                        {{
                            statusForm.status === 'active'
                                ? 'Activate Patient'
                                : 'Deactivate Patient'
                        }}
                    </DialogTitle>
                    <DialogDescription>
                        {{
                            statusForm.status === 'active'
                                ? 'This will re-activate the patient record and allow new clinical workflows.'
                                : 'This will deactivate the patient record. Existing records are preserved.'
                        }}
                    </DialogDescription>
                </DialogHeader>

                <div class="space-y-3">
                    <div
                        v-if="statusErrors.length"
                        class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                    >
                        <p v-for="err in statusErrors" :key="err">{{ err }}</p>
                    </div>
                    <div class="grid gap-1.5">
                        <Label for="status-reason" class="text-sm"
                            >Reason
                            <span class="text-muted-foreground"
                                >(optional)</span
                            ></Label
                        >
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
                    <Button
                        variant="outline"
                        size="sm"
                        :disabled="statusLoading"
                        @click="closeStatusDialog"
                    >
                        Cancel
                    </Button>
                    <Button
                        :variant="
                            statusForm.status === 'active'
                                ? 'default'
                                : 'destructive'
                        "
                        size="sm"
                        :disabled="statusLoading"
                        class="gap-1.5"
                        @click="changePatientStatus"
                    >
                        <AppIcon
                            :name="
                                statusForm.status === 'active'
                                    ? 'user-check'
                                    : 'user-x'
                            "
                            class="size-3.5"
                        />
                        {{
                            statusLoading
                                ? 'Saving...'
                                : statusForm.status === 'active'
                                  ? 'Activate'
                                  : 'Deactivate'
                        }}
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
            <SheetContent
                side="right"
                variant="form"
                size="md"
                class="flex h-full min-h-0 flex-col"
            >
                <SheetHeader>
                    <SheetTitle class="flex items-center gap-2">
                        <AppIcon
                            name="sliders-horizontal"
                            class="size-4 text-muted-foreground"
                        />
                        Patient Filters
                    </SheetTitle>
                    <SheetDescription>
                        Registry controls for status, identity, location,
                        sorting, and result size.
                    </SheetDescription>
                </SheetHeader>

                <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                    <div class="rounded-lg border p-3">
                        <div class="mb-3">
                            <p class="text-sm font-medium">
                                Find patient records
                            </p>
                            <p class="text-xs text-muted-foreground">
                                Search across identity, contact, and facility
                                registration data.
                            </p>
                        </div>
                        <div class="grid gap-3 sm:grid-cols-2">
                            <div class="grid gap-2 sm:col-span-2">
                                <Label for="patient-search-q-sheet"
                                    >Search</Label
                                >
                                <div class="relative">
                                    <AppIcon
                                        name="search"
                                        class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
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
                                <Label for="patient-search-status-sheet"
                                    >Status</Label
                                >
                                <Select
                                    :model-value="
                                        nonEmptySelectValue(searchForm.status)
                                    "
                                    @update:model-value="
                                        updatePatientStatusFilter
                                    "
                                >
                                    <SelectTrigger
                                        id="patient-search-status-sheet"
                                        class="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem :value="SELECT_ALL_VALUE"
                                            >All statuses</SelectItem
                                        >
                                        <SelectItem value="active"
                                            >Active</SelectItem
                                        >
                                        <SelectItem value="inactive"
                                            >Inactive</SelectItem
                                        >
                                    </SelectContent>
                                </Select>
                            </div>

                            <div class="grid gap-2">
                                <Label for="patient-search-gender-sheet"
                                    >Gender</Label
                                >
                                <Select
                                    :model-value="
                                        nonEmptySelectValue(searchForm.gender)
                                    "
                                    @update:model-value="
                                        updatePatientGenderFilter
                                    "
                                >
                                    <SelectTrigger
                                        id="patient-search-gender-sheet"
                                        class="w-full"
                                    >
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
                                Narrow registry results by the patient address
                                recorded at registration.
                            </p>
                        </div>
                        <div class="grid gap-3 sm:grid-cols-2">
                            <SearchableSelectField
                                input-id="patient-search-region-sheet"
                                v-model="searchForm.region"
                                :label="patientFilterCountryUi.regionLabel"
                                :options="patientFilterRegionOptions"
                                :placeholder="
                                    patientFilterCountryUi.regionPlaceholder
                                "
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
                                :disabled="
                                    listLoading || !searchForm.region.trim()
                                "
                            />
                        </div>
                    </div>

                    <div class="rounded-lg border p-3">
                        <div class="mb-3">
                            <p class="text-sm font-medium">List view</p>
                            <p class="text-xs text-muted-foreground">
                                Control result ordering and row density for
                                registry work.
                            </p>
                        </div>
                        <div class="grid gap-3 sm:grid-cols-2">
                            <div class="grid gap-2">
                                <Label for="patient-search-sort-by-sheet"
                                    >Sort by</Label
                                >
                                <Select
                                    :model-value="searchForm.sortBy"
                                    @update:model-value="
                                        updatePatientSortByFilter
                                    "
                                >
                                    <SelectTrigger
                                        id="patient-search-sort-by-sheet"
                                        class="w-full"
                                    >
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
                                <Label for="patient-search-sort-dir-sheet"
                                    >Sort direction</Label
                                >
                                <Select
                                    :model-value="searchForm.sortDir"
                                    @update:model-value="
                                        updatePatientSortDirFilter
                                    "
                                >
                                    <SelectTrigger
                                        id="patient-search-sort-dir-sheet"
                                        class="w-full"
                                    >
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
                                <Label for="patient-search-per-page-sheet"
                                    >Rows per page</Label
                                >
                                <Select
                                    :model-value="String(searchForm.perPage)"
                                    @update:model-value="
                                        updatePatientPerPageFilter
                                    "
                                >
                                    <SelectTrigger
                                        id="patient-search-per-page-sheet"
                                        class="w-full"
                                    >
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
                    <Button
                        :disabled="listLoading"
                        class="gap-1.5"
                        @click="patientFiltersSheetOpen = false"
                    >
                        Done
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    </AppLayout>
</template>
