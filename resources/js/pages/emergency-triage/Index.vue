<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import LinkedContextLookupField from '@/components/context/LinkedContextLookupField.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { mergeSearchableOptions, type SearchableSelectOption } from '@/lib/patientLocations';
import { type BreadcrumbItem } from '@/types';

type ApiError = Error & { payload?: { errors?: Record<string, string[]>; message?: string } };
type EmergencyWorkspace = 'queue' | 'create';
type QueueRowDensity = 'comfortable' | 'compact';
type EmergencyDetailsTab = 'overview' | 'workflows' | 'audit';
type EmergencyCreateContextEditorTab = 'patient' | 'appointment' | 'admission';
type CreateContextLinkSource = 'none' | 'auto' | 'manual';
type EmergencyTimelineEvent = {
    id: string;
    title: string;
    description: string;
    at: string | null;
    pending: boolean;
    badgeLabel?: string | null;
    icon: string;
    tone: 'critical' | 'warning' | 'success' | 'muted';
};
type ScopeData = {
    resolvedFrom: string;
    tenant: { code: string; name: string } | null;
    facility: { code: string; name: string } | null;
    userAccess?: { accessibleFacilityCount?: number | null } | null;
};

type PatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
};

type PatientResponse = {
    data: PatientSummary;
};
type AppointmentSummary = {
    id: string;
    appointmentNumber: string | null;
    patientId: string | null;
    department: string | null;
    scheduledAt: string | null;
    durationMinutes: number | null;
    reason: string | null;
    status: string | null;
    statusReason: string | null;
};

type AdmissionSummary = {
    id: string;
    admissionNumber: string | null;
    patientId: string | null;
    ward: string | null;
    bed: string | null;
    admittedAt: string | null;
    status: string | null;
    statusReason: string | null;
};

type AppointmentResponse = { data: AppointmentSummary };
type AdmissionResponse = { data: AdmissionSummary };
type LinkedContextListResponse<T> = {
    data: T[];
    meta?: {
        currentPage?: number;
        perPage?: number;
        total?: number;
        lastPage?: number;
    };
};

type ServicePointResource = {
    id: string | null;
    code: string | null;
    name: string | null;
    departmentId: string | null;
    servicePointType: string | null;
    location: string | null;
    status: string | null;
    statusReason: string | null;
    notes: string | null;
};

type WardBedResource = {
    id: string | null;
    code: string | null;
    name: string | null;
    departmentId: string | null;
    wardName: string | null;
    bedNumber: string | null;
    location: string | null;
    status: string | null;
    statusReason: string | null;
    notes: string | null;
};

type StaffProfile = {
    id: string;
    userId: number | null;
    employeeNumber: string | null;
    department: string | null;
    jobTitle: string | null;
    status: string | null;
    statusReason: string | null;
};

type StaffListResponse = {
    data: StaffProfile[];
    meta?: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type ServicePointRegistryListResponse = LinkedContextListResponse<ServicePointResource>;
type WardBedRegistryListResponse = LinkedContextListResponse<WardBedResource>;

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Emergency & Triage', href: '/emergency-triage' }];
const triageLevelOptions = ['red', 'yellow', 'green'] as const;
const statusOptions = ['waiting', 'triaged', 'in_treatment', 'admitted', 'discharged', 'cancelled'];
const transferTypeOptions = ['internal', 'external'];
const transferPriorityOptions = ['routine', 'urgent', 'critical'];
const transferStatusOptions = ['requested', 'accepted', 'in_transit', 'completed', 'cancelled', 'rejected'];
const transferTransportModeOptions = [
    'ambulance',
    'wheelchair',
    'stretcher',
    'walk_in',
    'private_vehicle',
] as const;
const auditActorTypeOptions = [
    { value: '', label: 'All actors' },
    { value: 'user', label: 'User only' },
    { value: 'system', label: 'System only' },
];
const queueSummaryStatuses = ['waiting', 'triaged', 'in_treatment', 'admitted', 'discharged', 'cancelled'] as const;

function queryParam(name: string): string {
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

const canRead = ref(false);
const canCreate = ref(false);
const canUpdateStatus = ref(false);
const canViewAudit = ref(false);
const canManageTransfers = ref(false);
const canViewTransferAudit = ref(false);
const canReadTransferLocationRegistry = ref(false);
const canReadTransferClinicianDirectory = ref(false);
const scope = ref<ScopeData | null>(null);
const patientDirectory = ref<Record<string, PatientSummary>>({});
const pendingPatientLookupIds = new Set<string>();

const pageLoading = ref(true);
const queueLoading = ref(false);
const queueError = ref<string | null>(null);
const cases = ref<any[]>([]);
const counts = ref({ waiting: 0, triaged: 0, in_treatment: 0, admitted: 0, discharged: 0, cancelled: 0, other: 0, total: 0 });
const pagination = ref<{ currentPage: number; lastPage: number } | null>(null);
const actionLoadingId = ref<string | null>(null);
const emergencyWorkspace = ref<EmergencyWorkspace>('queue');
const queueRowDensity = ref<QueueRowDensity>('comfortable');
const queueFiltersSheetOpen = ref(false);

const searchForm = reactive({
    q: queryParam('q'),
    patientId: queryParam('patientId'),
    status: queryParam('status'),
    triageLevel: queryParam('triageLevel'),
    page: 1,
    perPage: 25,
});
const queueDraftPatientId = ref(searchForm.patientId);
const createForm = reactive({
    patientId: queryParam('patientId'),
    appointmentId: queryParam('appointmentId'),
    admissionId: queryParam('admissionId'),
    arrivalAt: defaultDateTimeLocal(),
    triageLevel: 'yellow',
    chiefComplaint: '',
    vitalsSummary: '',
});
const createSubmitting = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const createMessage = ref<string | null>(null);
const createContextEditorTab = ref<EmergencyCreateContextEditorTab>(
    !createForm.patientId.trim()
        ? 'patient'
        : createForm.admissionId.trim()
          ? 'admission'
          : createForm.appointmentId.trim()
            ? 'appointment'
            : 'patient',
);
const createContextDialogOpen = ref(false);
const createAppointmentSummary = ref<AppointmentSummary | null>(null);
const createAppointmentSummaryLoading = ref(false);
const createAppointmentSummaryError = ref<string | null>(null);
const createAdmissionSummary = ref<AdmissionSummary | null>(null);
const createAdmissionSummaryLoading = ref(false);
const createAdmissionSummaryError = ref<string | null>(null);
const createAppointmentSuggestions = ref<AppointmentSummary[]>([]);
const createAdmissionSuggestions = ref<AdmissionSummary[]>([]);
const createAppointmentSuggestionsLoading = ref(false);
const createAdmissionSuggestionsLoading = ref(false);
const createAppointmentSuggestionsError = ref<string | null>(null);
const createAdmissionSuggestionsError = ref<string | null>(null);
const createAppointmentLinkSource = ref<CreateContextLinkSource>(
    createForm.appointmentId.trim() ? 'route' : 'none',
);
const createAdmissionLinkSource = ref<CreateContextLinkSource>(
    createForm.admissionId.trim() ? 'route' : 'none',
);
const createContextAutoLinkSuppressed = reactive({
    appointment: false,
    admission: false,
});
const createContextDialogInitialSelection = reactive({
    patientId: '',
    appointmentId: '',
    admissionId: '',
});
const createSelectedPatient = ref<any | null>(null);
const createActivePatientSummary = computed<PatientSummary | null>(() => {
    const patientId = createForm.patientId.trim();
    if (!patientId) return null;

    const cached = patientDirectory.value[patientId];
    if (cached) return cached;

    if (createSelectedPatient.value?.id === patientId) {
        return {
            id: patientId,
            patientNumber: createSelectedPatient.value?.patientNumber ?? null,
            firstName: createSelectedPatient.value?.firstName ?? null,
            middleName: createSelectedPatient.value?.middleName ?? null,
            lastName: createSelectedPatient.value?.lastName ?? null,
        };
    }

    return null;
});

let createAppointmentSummaryRequestId = 0;
let createAdmissionSummaryRequestId = 0;
let createContextSuggestionsRequestId = 0;
let pendingCreateAppointmentLinkSource: CreateContextLinkSource | null = null;
let pendingCreateAdmissionLinkSource: CreateContextLinkSource | null = null;

if (
    queryParam('tab') === 'new' ||
    createForm.appointmentId.trim() !== '' ||
    createForm.admissionId.trim() !== ''
) {
    emergencyWorkspace.value = 'create';
}

const statusDialogOpen = ref(false);
const statusCase = ref<any | null>(null);
const statusAction = ref<string | null>(null);
const statusReason = ref('');
const statusDispositionNotes = ref('');
const statusError = ref<string | null>(null);

const detailsOpen = ref(false);
const detailsCase = ref<any | null>(null);
const detailsCaseLoading = ref(false);
const detailsCaseError = ref<string | null>(null);
const detailsSheetTab = ref<EmergencyDetailsTab>('overview');
const detailsAuditLoading = ref(false);
const detailsAuditError = ref<string | null>(null);
const detailsAuditLogs = ref<any[]>([]);
const detailsAuditExporting = ref(false);
const detailsAuditExpandedRows = ref<Record<string, boolean>>({});
const detailsAuditMeta = ref<{ currentPage: number; lastPage: number; total: number; perPage: number } | null>(null);
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
const detailsTransferLoading = ref(false);
const detailsTransferError = ref<string | null>(null);
const detailsTransfers = ref<any[]>([]);
const detailsTransferMeta = ref<{ currentPage: number; lastPage: number; total: number; perPage: number } | null>(null);
const detailsTransferCounts = ref({ requested: 0, accepted: 0, in_transit: 0, completed: 0, cancelled: 0, rejected: 0, other: 0, total: 0 });
const detailsTransferFilters = reactive({
    q: '',
    transferType: '',
    priority: '',
    status: '',
    page: 1,
    perPage: 10,
});
const transferCreateForm = reactive({
    transferType: 'internal',
    priority: 'urgent',
    sourceLocation: '',
    destinationLocation: '',
    destinationFacilityName: '',
    acceptingClinicianUserId: '',
    requestedAt: defaultDateTimeLocal(),
    clinicalHandoffNotes: '',
    transportMode: '',
});
const transferCreateErrors = ref<Record<string, string[]>>({});
const transferCreateSubmitting = ref(false);
const transferStatusDialogOpen = ref(false);
const transferStatusTarget = ref<any | null>(null);
const transferStatusAction = ref('accepted');
const transferStatusReason = ref('');
const transferStatusNotes = ref('');
const transferStatusSubmitting = ref(false);
const transferStatusError = ref<string | null>(null);
const transferAuditDialogOpen = ref(false);
const transferAuditTarget = ref<any | null>(null);
const transferAuditLoading = ref(false);
const transferAuditError = ref<string | null>(null);
const transferAuditLogs = ref<any[]>([]);
const transferAuditMeta = ref<{ currentPage: number; lastPage: number; total: number; perPage: number } | null>(null);
const transferAuditExporting = ref(false);
const transferAuditFilters = reactive({
    q: '',
    action: '',
    actorType: '',
    actorId: '',
    from: '',
    to: '',
    page: 1,
    perPage: 20,
});

const transferServicePoints = ref<ServicePointResource[]>([]);
const transferWardBeds = ref<WardBedResource[]>([]);
const transferLocationRegistryLoading = ref(false);
const transferLocationRegistryError = ref<string | null>(null);
const transferClinicians = ref<StaffProfile[]>([]);
const transferCliniciansLoading = ref(false);
const transferCliniciansError = ref<string | null>(null);

const mobileFiltersDrawerOpen = ref(false);
const acuityLaneOrder = ['red', 'yellow', 'green'] as const;

function queueCountLabel(value: number): string {
    return value > 99 ? '99+' : String(value);
}

function shortContextId(value: string | null | undefined): string {
    const normalized = (value ?? '').trim();
    if (!normalized) return 'Not linked';
    return normalized.length <= 12
        ? normalized
        : `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

function patientSummaryById(patientId: string | null | undefined): PatientSummary | null {
    const normalizedId = (patientId ?? '').trim();
    if (!normalizedId) return null;
    return patientDirectory.value[normalizedId] ?? null;
}

function patientName(summary: PatientSummary): string {
    return (
        [summary.firstName, summary.middleName, summary.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() ||
        summary.patientNumber ||
        shortContextId(summary.id)
    );
}

function patientContextLabel(patientId: string | null | undefined): string {
    const normalizedId = (patientId ?? '').trim();
    if (!normalizedId) return 'Patient pending';
    const summary = patientSummaryById(normalizedId);
    return summary ? patientName(summary) : `Patient ${shortContextId(normalizedId)}`;
}

function patientContextMeta(patientId: string | null | undefined): string | null {
    const patientNumber = patientSummaryById(patientId)?.patientNumber?.trim();
    return patientNumber ? `Patient No. ${patientNumber}` : null;
}
function buildContextHref(path: string, params: Record<string, string | null | undefined>): string {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (!value) return;
        search.set(key, value);
    });
    const query = search.toString();
    return query ? `${path}?${query}` : path;
}

function normalizeLookupValue(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function servicePointLocationValue(item: ServicePointResource): string {
    return (item.name ?? '').trim() || (item.location ?? '').trim() || (item.code ?? '').trim();
}

function servicePointLocationLabel(item: ServicePointResource): string {
    const primary = servicePointLocationValue(item) || 'Unknown service point';
    const code = (item.code ?? '').trim();
    if (code && primary.toLowerCase() !== code.toLowerCase()) {
        return `${code} - ${primary}`;
    }
    return primary;
}

function wardTransferLocationValue(item: WardBedResource): string {
    return (item.wardName ?? '').trim() || (item.name ?? '').trim() || (item.code ?? '').trim();
}

function transferTransportModeLabel(value: string | null | undefined): string {
    const normalized = (value ?? '').trim();
    return normalized ? formatEnumLabel(normalized) : 'Transport mode pending';
}

function statusVariant(status: string | null | undefined): 'default' | 'secondary' | 'outline' | 'destructive' {
    const normalized = (status ?? '').trim().toLowerCase();
    if (normalized === 'cancelled') return 'destructive';
    if (normalized === 'in_treatment' || normalized === 'admitted' || normalized === 'discharged') return 'default';
    if (normalized === 'waiting') return 'secondary';
    return 'outline';
}

function triageLevelDisplayLabel(level: string | null | undefined): string {
    const normalized = (level ?? '').trim().toLowerCase();
    if (normalized === 'red') return 'Emergency (Red)';
    if (normalized === 'yellow') return 'Priority (Yellow)';
    if (normalized === 'green') return 'Queue (Green)';
    if (normalized === 'orange') return 'Legacy Orange';
    if (normalized === 'blue') return 'Legacy Blue';
    return formatEnumLabel(level);
}

function triageLevelBucket(level: string | null | undefined): 'red' | 'yellow' | 'green' | 'other' {
    const normalized = (level ?? '').trim().toLowerCase();
    if (normalized === 'red' || normalized === 'orange') return 'red';
    if (normalized === 'yellow') return 'yellow';
    if (normalized === 'green' || normalized === 'blue') return 'green';
    return 'other';
}

function acuityVariant(level: string | null | undefined): 'default' | 'secondary' | 'outline' | 'destructive' {
    const bucket = triageLevelBucket(level);
    if (bucket === 'red') return 'destructive';
    if (bucket === 'yellow') return 'secondary';
    return 'outline';
}

function acuityLaneClasses(level: string, active: boolean): string {
    const bucket = triageLevelBucket(level);
    if (bucket === 'red') {
        return active
            ? 'border-destructive bg-destructive/10'
            : 'border-destructive/40 bg-destructive/5';
    }
    if (bucket === 'yellow') {
        return active
            ? 'border-amber-500 bg-amber-500/10'
            : 'border-amber-500/40 bg-amber-500/5';
    }
    if (bucket === 'green') {
        return active
            ? 'border-emerald-500 bg-emerald-500/10'
            : 'border-emerald-500/40 bg-emerald-500/5';
    }

    return active ? 'border-muted-foreground/40 bg-muted/40' : 'border-muted bg-muted/20';
}

function focusToneClasses(tone: 'critical' | 'warning' | 'success' | 'muted'): string {
    if (tone === 'critical') return 'border-destructive/40 bg-destructive/5';
    if (tone === 'warning') return 'border-amber-500/40 bg-amber-500/5';
    if (tone === 'success') return 'border-emerald-500/40 bg-emerald-500/5';
    return 'border-border bg-muted/20';
}

function timelineToneClasses(tone: EmergencyTimelineEvent['tone']): string {
    if (tone === 'critical') return 'bg-destructive';
    if (tone === 'warning') return 'bg-amber-500';
    if (tone === 'success') return 'bg-emerald-500';
    return 'bg-muted-foreground/40';
}

function toggleDetailsAuditRow(logId: string | number | null | undefined) {
    if (logId === null || logId === undefined) return;
    const key = String(logId);
    detailsAuditExpandedRows.value = {
        ...detailsAuditExpandedRows.value,
        [key]: !detailsAuditExpandedRows.value[key],
    };
}

function isDetailsAuditRowExpanded(logId: string | number | null | undefined): boolean {
    if (logId === null || logId === undefined) return false;
    return Boolean(detailsAuditExpandedRows.value[String(logId)]);
}

function formatAuditPayload(log: any): string {
    return JSON.stringify(
        {
            changes: log?.changes ?? {},
            metadata: log?.metadata ?? {},
        },
        null,
        2,
    );
}

function auditChangeCount(log: any): number {
    const changes = log?.changes;
    if (!changes || typeof changes !== 'object') return 0;
    return Object.keys(changes).length;
}

const statusSelectValue = computed({
    get: () => searchForm.status || 'all',
    set: (v: string) => {
        searchForm.status = v === 'all' ? '' : v;
        searchForm.page = 1;
        loadQueue();
    },
});

const queueFiltersActiveCount = computed(() => {
    let count = 0;
    if (searchForm.q.trim()) count += 1;
    if (searchForm.patientId.trim()) count += 1;
    if (searchForm.status) count += 1;
    if (searchForm.triageLevel) count += 1;
    if (searchForm.perPage !== 25) count += 1;
    if (queueRowDensity.value !== 'comfortable') count += 1;
    return count;
});

const emergencyQueueStateLabel = computed(() => {
    const parts: string[] = [];
    if (searchForm.status) parts.push(formatEnumLabel(searchForm.status));
    if (searchForm.triageLevel) parts.push(triageLevelDisplayLabel(searchForm.triageLevel));
    return parts.length > 0 ? parts.join(' | ') : 'All cases';
});

const scopeWarning = computed(() => {
    if (pageLoading.value) return null;
    if (!scope.value) return 'Platform access scope could not be loaded.';
    if (scope.value.resolvedFrom === 'none') {
        return 'No tenant/facility scope is resolved. Emergency triage actions may be blocked by tenant isolation controls.';
    }
    return null;
});

const scopeStatusLabel = computed(() => {
    if (pageLoading.value) return 'Checking scope';
    if (!scope.value) return 'Scope Unavailable';
    return scope.value.resolvedFrom === 'none' ? 'Scope Unresolved' : 'Scope Ready';
});

const emergencyWorkspaceDescription = computed(() => {
    if (emergencyWorkspace.value === 'create') {
        return 'Emergency intake, acuity capture, and initial care handoff.';
    }

    return 'Queue, intake, and status transitions with audit visibility.';
});

const queueActiveFilterChips = computed(() => {
    const chips: string[] = [];
    if (searchForm.q.trim()) chips.push('Search: ' + searchForm.q.trim());
    if (searchForm.patientId.trim()) chips.push('Patient: ' + patientContextLabel(searchForm.patientId));
    if (searchForm.status) chips.push('Status: ' + formatEnumLabel(searchForm.status));
    if (searchForm.triageLevel) chips.push('Triage: ' + triageLevelDisplayLabel(searchForm.triageLevel));
    if (searchForm.perPage !== 25) chips.push(String(searchForm.perPage) + ' rows');
    if (queueRowDensity.value === 'compact') chips.push('Compact view');
    return chips;
});

const createFeedbackVisible = computed(
    () => Boolean(createMessage.value) || Object.keys(createErrors.value).length > 0,
);

const createContextSummaryLine = computed(() => {
    const parts = [createPatientContextLabel.value];
    if (hasCreateAppointmentContext.value) {
        parts.push(createAppointmentContextLabel.value);
    } else if (hasCreateAdmissionContext.value) {
        parts.push(createAdmissionContextLabel.value);
    } else {
        parts.push('No visit context linked');
    }
    return parts.join(' | ');
});

const hasCreateAppointmentContext = computed(() => createForm.appointmentId.trim().length > 0);
const hasCreateAdmissionContext = computed(() => createForm.admissionId.trim().length > 0);

const createPatientContextLabel = computed(() => {
    if (createActivePatientSummary.value) {
        return patientName(createActivePatientSummary.value);
    }

    return createForm.patientId.trim() ? `Patient ${shortContextId(createForm.patientId)}` : 'Select patient';
});

const createPatientContextMeta = computed(() => {
    const patientId = createForm.patientId.trim();
    if (!patientId) {
        return 'Search and select the patient first, then confirm any appointment or admission handoff.';
    }

    const parts = [patientContextMeta(patientId)].filter(Boolean);
    return parts.length > 0
        ? parts.join(' | ')
        : 'Patient record ' + shortContextId(patientId) + ' is attached to this emergency intake.';
});
const createAppointmentContextLabel = computed(() => {
    const number = createAppointmentSummary.value?.appointmentNumber?.trim();
    if (number) return number;
    if (hasCreateAppointmentContext.value) return 'Linked appointment';
    return 'No appointment linked';
});

const createAppointmentContextMeta = computed(() => {
    if (createAppointmentSummaryLoading.value) {
        return 'Loading appointment summary...';
    }
    if (createAppointmentSummaryError.value) {
        return createAppointmentSummaryError.value;
    }
    if (!createAppointmentSummary.value) {
        if (!hasCreateAppointmentContext.value && createAppointmentSuggestionsLoading.value) {
            return 'Checking for active checked-in appointments...';
        }
        if (!hasCreateAppointmentContext.value && createAppointmentSuggestions.value.length > 1) {
            return `${createAppointmentSuggestions.value.length} active checked-in appointments found. Review the context editor and choose one.`;
        }
        return hasCreateAppointmentContext.value
            ? 'Appointment summary will appear once the link is resolved.'
            : 'Optional. Link the active appointment when the patient is arriving from a booked visit.';
    }

    const parts = [
        createAppointmentSummary.value.scheduledAt
            ? formatDateTime(createAppointmentSummary.value.scheduledAt)
            : null,
        createAppointmentSummary.value.department?.trim() || null,
    ].filter(Boolean);

    if (createAppointmentLinkSource.value === 'auto') {
        parts.push('Auto-linked from active patient context');
    } else if (createAppointmentLinkSource.value === 'manual') {
        parts.push('Chosen in context editor');
    }

    return parts.join(' | ');
});

const createAppointmentContextReason = computed(() => {
    const value = createAppointmentSummary.value?.reason?.trim();
    return value ? `Reason: ${value}` : null;
});

const createAppointmentContextStatusLabel = computed(() => {
    if (createAppointmentSummaryLoading.value) return 'Loading';
    const status = createAppointmentSummary.value?.status?.trim();
    if (!status) {
        return hasCreateAppointmentContext.value ? 'Linked' : null;
    }
    return formatEnumLabel(status);
});

const createAppointmentContextStatusVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    const status = createAppointmentSummary.value?.status?.trim().toLowerCase() ?? '';
    if (status === 'checked_in' || status === 'completed') return 'default';
    if (status === 'scheduled') return 'secondary';
    if (status === 'cancelled' || status === 'no_show') return 'destructive';
    return 'outline';
});

const createAppointmentContextSourceLabel = computed(() => {
    if (!hasCreateAppointmentContext.value) return null;
    if (createAppointmentLinkSource.value === 'auto') return 'Auto-linked';
    if (createAppointmentLinkSource.value === 'manual') return 'Chosen';
    return null;
});

const createAdmissionContextLabel = computed(() => {
    const number = createAdmissionSummary.value?.admissionNumber?.trim();
    if (number) return number;
    if (hasCreateAdmissionContext.value) return 'Linked admission';
    return 'No admission linked';
});

const createAdmissionContextMeta = computed(() => {
    if (createAdmissionSummaryLoading.value) {
        return 'Loading admission summary...';
    }
    if (createAdmissionSummaryError.value) {
        return createAdmissionSummaryError.value;
    }
    if (!createAdmissionSummary.value) {
        if (!hasCreateAdmissionContext.value && createAdmissionSuggestionsLoading.value) {
            return 'Checking for active admissions...';
        }
        if (!hasCreateAdmissionContext.value && createAdmissionSuggestions.value.length > 1) {
            return `${createAdmissionSuggestions.value.length} active admissions found. Review the context editor and choose one.`;
        }
        return hasCreateAdmissionContext.value
            ? 'Admission summary will appear once the link is resolved.'
            : 'Optional. Link the admission when the emergency case belongs to an inpatient stay.';
    }

    const parts = [
        createAdmissionSummary.value.admittedAt
            ? formatDateTime(createAdmissionSummary.value.admittedAt)
            : null,
        createAdmissionSummary.value.ward?.trim() || null,
        createAdmissionSummary.value.bed?.trim() || null,
    ].filter(Boolean);

    if (createAdmissionLinkSource.value === 'auto') {
        parts.push('Auto-linked from active patient context');
    } else if (createAdmissionLinkSource.value === 'manual') {
        parts.push('Chosen in context editor');
    }

    return parts.join(' | ');
});

const createAdmissionContextReason = computed(() => {
    const value = createAdmissionSummary.value?.statusReason?.trim();
    return value ? `Reason: ${value}` : null;
});

const createAdmissionContextStatusLabel = computed(() => {
    if (createAdmissionSummaryLoading.value) return 'Loading';
    const status = createAdmissionSummary.value?.status?.trim();
    if (!status) {
        return hasCreateAdmissionContext.value ? 'Linked' : null;
    }
    return formatEnumLabel(status);
});

const createAdmissionContextStatusVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    const status = createAdmissionSummary.value?.status?.trim().toLowerCase() ?? '';
    if (status === 'admitted') return 'default';
    if (status === 'transferred') return 'secondary';
    if (status === 'cancelled') return 'destructive';
    return 'outline';
});

const createAdmissionContextSourceLabel = computed(() => {
    if (!hasCreateAdmissionContext.value) return null;
    if (createAdmissionLinkSource.value === 'auto') return 'Auto-linked';
    if (createAdmissionLinkSource.value === 'manual') return 'Chosen';
    return null;
});

const createContextEditorDescription = computed(() => {
    if (createContextEditorTab.value === 'patient') {
        return 'Select the patient before attaching appointment or admission context.';
    }
    if (createContextEditorTab.value === 'appointment') {
        return 'Attach the appointment that should remain visible in the emergency handoff.';
    }
    return 'Attach the admission that should remain visible in the emergency handoff.';
});

const transferLocationRegistryOptions = computed<SearchableSelectOption[]>(() => {
    const servicePointOptions = transferServicePoints.value
        .filter((item) => (item.status ?? '').trim().toLowerCase() !== 'inactive')
        .map((item) => ({
            value: servicePointLocationValue(item),
            label: servicePointLocationLabel(item),
            description: [item.servicePointType, item.location].filter(Boolean).join(' | ') || null,
            keywords: [item.code, item.name, item.location, item.servicePointType].filter(
                (value): value is string => Boolean(value?.trim()),
            ),
            group: item.servicePointType
                ? `Service points | ${formatEnumLabel(item.servicePointType)}`
                : 'Service points',
        }));

    const wardOptions = new Map<string, SearchableSelectOption>();
    transferWardBeds.value
        .filter((item) => (item.status ?? '').trim().toLowerCase() !== 'inactive')
        .forEach((item) => {
            const value = wardTransferLocationValue(item);
            const key = normalizeLookupValue(value);
            if (!value || wardOptions.has(key)) return;
            wardOptions.set(key, {
                value,
                label: value,
                description: (item.location ?? '').trim() || null,
                keywords: [item.code, item.name, item.wardName, item.location].filter(
                    (candidate): candidate is string => Boolean(candidate?.trim()),
                ),
                group: 'Wards',
            });
        });

    return mergeSearchableOptions(servicePointOptions, [...wardOptions.values()]);
});

const transferLocationRegistryAvailable = computed(
    () => transferLocationRegistryOptions.value.length > 0,
);

const usesRegistryBackedTransferSource = computed(
    () =>
        canReadTransferLocationRegistry.value &&
        !transferLocationRegistryLoading.value &&
        !transferLocationRegistryError.value &&
        transferLocationRegistryAvailable.value,
);

const usesRegistryBackedInternalDestination = computed(
    () =>
        transferCreateForm.transferType === 'internal' &&
        usesRegistryBackedTransferSource.value,
);

const transferLocationRegistryHelperText = computed(() => {
    if (transferLocationRegistryLoading.value) {
        return 'Loading internal service-point and ward options from the backend registry.';
    }
    if (!canReadTransferLocationRegistry.value) {
        return 'Location registry access is unavailable for this session. Enter locations manually.';
    }
    if (transferLocationRegistryError.value) {
        return transferLocationRegistryError.value;
    }
    if (transferLocationRegistryAvailable.value) {
        return 'Internal handoff locations come from active service-point and ward registries.';
    }
    return 'No active service-point or ward locations are available yet. Enter locations manually.';
});

const transferClinicianOptions = computed<SearchableSelectOption[]>(() => {
    return mergeSearchableOptions(
        transferClinicians.value
            .filter(
                (profile) =>
                    profile.userId !== null &&
                    (profile.status ?? '').trim().toLowerCase() !== 'inactive',
            )
            .map((profile) => {
                const employeeNumber = (profile.employeeNumber ?? '').trim();
                const jobTitle = (profile.jobTitle ?? '').trim();
                const department = (profile.department ?? '').trim();
                const label = [employeeNumber || `User ${profile.userId}`, jobTitle]
                    .filter(Boolean)
                    .join(' - ');

                return {
                    value: String(profile.userId),
                    label: label || `User ${profile.userId}`,
                    description: [department || null, `User ID ${profile.userId}`]
                        .filter(Boolean)
                        .join(' | '),
                    keywords: [
                        employeeNumber,
                        jobTitle,
                        department,
                        String(profile.userId),
                    ].filter(Boolean),
                    group: department || 'Staff',
                };
            }),
    );
});

const transferClinicianDirectoryAvailable = computed(
    () => transferClinicianOptions.value.length > 0,
);

const transferClinicianHelperText = computed(() => {
    if (transferCliniciansLoading.value) {
        return 'Loading active clinician directory for handoff.';
    }
    if (!canReadTransferClinicianDirectory.value) {
        return 'Clinician directory access is unavailable. Enter the accepting clinician user ID manually.';
    }
    if (transferCliniciansError.value) {
        return transferCliniciansError.value;
    }
    if (transferClinicianDirectoryAvailable.value) {
        return 'Select the receiving clinician from active staff profiles.';
    }
    return 'No active staff profiles with linked user IDs are available. Enter the accepting clinician user ID manually.';
});

function setCreateAppointmentLink(value: string, source: CreateContextLinkSource) {
    pendingCreateAppointmentLinkSource = source;
    createForm.appointmentId = value;
}

function setCreateAdmissionLink(value: string, source: CreateContextLinkSource) {
    pendingCreateAdmissionLinkSource = source;
    createForm.admissionId = value;
}

function resetCreateContextSuggestions() {
    createAppointmentSuggestions.value = [];
    createAdmissionSuggestions.value = [];
    createAppointmentSuggestionsLoading.value = false;
    createAdmissionSuggestionsLoading.value = false;
    createAppointmentSuggestionsError.value = null;
    createAdmissionSuggestionsError.value = null;
}

function clearCreateAppointmentLink(options?: { suppressAuto?: boolean; focusEditor?: boolean }) {
    const shouldSuppress = options?.suppressAuto ?? createAppointmentLinkSource.value === 'auto';
    if (shouldSuppress) {
        createContextAutoLinkSuppressed.appointment = true;
    }

    createAppointmentSummary.value = null;
    createAppointmentSummaryError.value = null;
    createAppointmentSummaryLoading.value = false;
    setCreateAppointmentLink('', 'none');

    if (options?.focusEditor ?? true) {
        createContextEditorTab.value = 'appointment';
    }
}

function clearCreateAdmissionLink(options?: { suppressAuto?: boolean; focusEditor?: boolean }) {
    const shouldSuppress = options?.suppressAuto ?? createAdmissionLinkSource.value === 'auto';
    if (shouldSuppress) {
        createContextAutoLinkSuppressed.admission = true;
    }

    createAdmissionSummary.value = null;
    createAdmissionSummaryError.value = null;
    createAdmissionSummaryLoading.value = false;
    setCreateAdmissionLink('', 'none');

    if (options?.focusEditor ?? true) {
        createContextEditorTab.value = 'admission';
    }
}

function selectSuggestedAppointment(
    appointment: AppointmentSummary,
    options?: { source?: Extract<CreateContextLinkSource, 'auto' | 'manual'> },
) {
    createAppointmentSummary.value = appointment;
    createAppointmentSummaryError.value = null;
    createAppointmentSummaryLoading.value = false;
    setCreateAppointmentLink(appointment.id, options?.source ?? 'manual');

    if (options?.source === 'auto') {
        createContextAutoLinkSuppressed.appointment = false;
    }
}

function selectSuggestedAdmission(
    admission: AdmissionSummary,
    options?: { source?: Extract<CreateContextLinkSource, 'auto' | 'manual'> },
) {
    createAdmissionSummary.value = admission;
    createAdmissionSummaryError.value = null;
    createAdmissionSummaryLoading.value = false;
    setCreateAdmissionLink(admission.id, options?.source ?? 'manual');

    if (options?.source === 'auto') {
        createContextAutoLinkSuppressed.admission = false;
    }
}

function maybeAutoLinkCreateContextSuggestions() {
    if (
        !createForm.appointmentId.trim() &&
        !createContextAutoLinkSuppressed.appointment &&
        createAppointmentSuggestions.value.length === 1
    ) {
        selectSuggestedAppointment(createAppointmentSuggestions.value[0], {
            source: 'auto',
        });
    }

    if (
        !createForm.admissionId.trim() &&
        !createContextAutoLinkSuppressed.admission &&
        createAdmissionSuggestions.value.length === 1
    ) {
        selectSuggestedAdmission(createAdmissionSuggestions.value[0], {
            source: 'auto',
        });
    }
}

async function loadCreateAppointmentSummary(appointmentId: string) {
    const normalizedId = appointmentId.trim();
    const requestId = ++createAppointmentSummaryRequestId;

    if (!normalizedId) {
        createAppointmentSummary.value = null;
        createAppointmentSummaryError.value = null;
        createAppointmentSummaryLoading.value = false;
        return;
    }

    if (
        createAppointmentSummary.value?.id === normalizedId &&
        !createAppointmentSummaryError.value
    ) {
        createAppointmentSummaryLoading.value = false;
        return;
    }

    createAppointmentSummaryLoading.value = true;
    createAppointmentSummaryError.value = null;

    try {
        const response = await apiRequest<AppointmentResponse>('GET', `/appointments/${normalizedId}`);
        if (requestId !== createAppointmentSummaryRequestId) return;
        createAppointmentSummary.value = response.data;
    } catch (error) {
        if (requestId !== createAppointmentSummaryRequestId) return;
        createAppointmentSummary.value = null;
        createAppointmentSummaryError.value = messageFromUnknown(
            error,
            'Unable to load appointment context.',
        );
    } finally {
        if (requestId === createAppointmentSummaryRequestId) {
            createAppointmentSummaryLoading.value = false;
        }
    }
}

async function loadCreateAdmissionSummary(admissionId: string) {
    const normalizedId = admissionId.trim();
    const requestId = ++createAdmissionSummaryRequestId;

    if (!normalizedId) {
        createAdmissionSummary.value = null;
        createAdmissionSummaryError.value = null;
        createAdmissionSummaryLoading.value = false;
        return;
    }

    if (
        createAdmissionSummary.value?.id === normalizedId &&
        !createAdmissionSummaryError.value
    ) {
        createAdmissionSummaryLoading.value = false;
        return;
    }

    createAdmissionSummaryLoading.value = true;
    createAdmissionSummaryError.value = null;

    try {
        const response = await apiRequest<AdmissionResponse>('GET', `/admissions/${normalizedId}`);
        if (requestId !== createAdmissionSummaryRequestId) return;
        createAdmissionSummary.value = response.data;
    } catch (error) {
        if (requestId !== createAdmissionSummaryRequestId) return;
        createAdmissionSummary.value = null;
        createAdmissionSummaryError.value = messageFromUnknown(
            error,
            'Unable to load admission context.',
        );
    } finally {
        if (requestId === createAdmissionSummaryRequestId) {
            createAdmissionSummaryLoading.value = false;
        }
    }
}

async function loadCreateContextSuggestions(patientId: string) {
    const normalizedId = patientId.trim();
    const requestId = ++createContextSuggestionsRequestId;

    if (!normalizedId) {
        resetCreateContextSuggestions();
        return;
    }

    createAppointmentSuggestionsLoading.value = true;
    createAdmissionSuggestionsLoading.value = true;
    createAppointmentSuggestionsError.value = null;
    createAdmissionSuggestionsError.value = null;

    const [appointmentsResult, admissionsResult] = await Promise.allSettled([
        apiRequest<LinkedContextListResponse<AppointmentSummary>>('GET', '/appointments', {
            query: {
                patientId: normalizedId,
                status: 'checked_in',
                perPage: 3,
                page: 1,
                sortBy: 'scheduledAt',
                sortDir: 'desc',
            },
        }),
        apiRequest<LinkedContextListResponse<AdmissionSummary>>('GET', '/admissions', {
            query: {
                patientId: normalizedId,
                status: 'admitted',
                perPage: 3,
                page: 1,
                sortBy: 'admittedAt',
                sortDir: 'desc',
            },
        }),
    ]);

    if (requestId !== createContextSuggestionsRequestId) return;

    if (appointmentsResult.status === 'fulfilled') {
        createAppointmentSuggestions.value = appointmentsResult.value.data ?? [];
        createAppointmentSuggestionsError.value = null;
    } else {
        createAppointmentSuggestions.value = [];
        createAppointmentSuggestionsError.value = messageFromUnknown(
            appointmentsResult.reason,
            'Unable to check active appointments.',
        );
    }

    if (admissionsResult.status === 'fulfilled') {
        createAdmissionSuggestions.value = admissionsResult.value.data ?? [];
        createAdmissionSuggestionsError.value = null;
    } else {
        createAdmissionSuggestions.value = [];
        createAdmissionSuggestionsError.value = messageFromUnknown(
            admissionsResult.reason,
            'Unable to check active admissions.',
        );
    }

    createAppointmentSuggestionsLoading.value = false;
    createAdmissionSuggestionsLoading.value = false;
    maybeAutoLinkCreateContextSuggestions();
}

const acuityBoardLanes = computed(() =>
    acuityLaneOrder.map((level) => {
        const laneCases = cases.value.filter((item) => triageLevelBucket(item?.triageLevel) === level);
        const items = laneCases.slice(0, 3);
        const count = laneCases.length;
        const waitingCount = laneCases.filter((item) => (item?.status ?? '').trim().toLowerCase() === 'waiting').length;
        const triagedCount = laneCases.filter((item) => (item?.status ?? '').trim().toLowerCase() === 'triaged').length;
        const inTreatmentCount = laneCases.filter((item) => (item?.status ?? '').trim().toLowerCase() === 'in_treatment').length;

        let focusLabel = 'No active cases';
        let focusDescription = `No ${triageLevelDisplayLabel(level).toLowerCase()} cases are visible on this page.`;
        let focusTone: 'critical' | 'warning' | 'success' | 'muted' = 'muted';

        if (level === 'red') {
            if (waitingCount > 0) {
                focusLabel = `${queueCountLabel(waitingCount)} waiting now`;
                focusDescription = 'Immediate triage or treatment pickup is still pending for critical arrivals.';
                focusTone = 'critical';
            } else if (triagedCount > 0) {
                focusLabel = `${queueCountLabel(triagedCount)} ready for treatment`;
                focusDescription = 'Critical cases are triaged and waiting for active emergency management.';
                focusTone = 'critical';
            } else if (inTreatmentCount > 0) {
                focusLabel = `${queueCountLabel(inTreatmentCount)} in active treatment`;
                focusDescription = 'Critical cases are already in treatment and need continued close monitoring.';
                focusTone = 'warning';
            } else if (count > 0) {
                focusLabel = 'Critical cases already routed';
                focusDescription = 'Red cases on this page have already moved beyond active emergency intake.';
                focusTone = 'success';
            }
        } else if (level === 'yellow') {
            if (waitingCount > 0 || triagedCount > 0) {
                const followUpCount = waitingCount + triagedCount;
                focusLabel = `${queueCountLabel(followUpCount)} need follow-up`;
                focusDescription = 'Priority cases still need triage completion or treatment pickup.';
                focusTone = 'warning';
            } else if (inTreatmentCount > 0) {
                focusLabel = `${queueCountLabel(inTreatmentCount)} in treatment`;
                focusDescription = 'Priority cases are moving through active care.';
                focusTone = 'success';
            } else if (count > 0) {
                focusLabel = 'Priority cases routed';
                focusDescription = 'Yellow-lane cases on this page already moved to downstream disposition.';
                focusTone = 'success';
            }
        } else {
            if (waitingCount > 0) {
                focusLabel = `${queueCountLabel(waitingCount)} queued for triage`;
                focusDescription = 'Lower-acuity arrivals are waiting for intake completion.';
                focusTone = 'warning';
            } else if (triagedCount > 0 || inTreatmentCount > 0) {
                const activeCount = triagedCount + inTreatmentCount;
                focusLabel = `${queueCountLabel(activeCount)} moving through care`;
                focusDescription = 'Green-lane cases are progressing without immediate escalation.';
                focusTone = 'success';
            } else if (count > 0) {
                focusLabel = 'Stable cases routed';
                focusDescription = 'Green-lane cases on this page are already closed or handed off.';
                focusTone = 'success';
            }
        }

        return {
            level,
            label: triageLevelDisplayLabel(level),
            count,
            items,
            active: searchForm.triageLevel === level,
            focusLabel,
            focusDescription,
            focusTone,
        };
    }),
);

watch(createContextDialogOpen, (isOpen) => {
    if (!isOpen) return;
    createContextDialogInitialSelection.patientId = createForm.patientId.trim();
    createContextDialogInitialSelection.appointmentId = createForm.appointmentId.trim();
    createContextDialogInitialSelection.admissionId = createForm.admissionId.trim();
});

watch(
    () => createForm.patientId,
    (nextValue, previousValue) => {
        const nextId = nextValue.trim();
        const previousId = (previousValue ?? '').trim();

        if (!nextId || nextId !== previousId) {
            if (createSelectedPatient.value?.id !== nextId) {
                createSelectedPatient.value = null;
            }
        }

        if (nextId) {
            void hydratePatientSummary(nextId);
        }
    },
);
watch(
    () => createForm.patientId,
    (nextValue, previousValue) => {
        const nextId = nextValue.trim();
        const previousId = (previousValue ?? '').trim();

        if (!nextId) {
            clearCreateAppointmentLink({ suppressAuto: false, focusEditor: false });
            clearCreateAdmissionLink({ suppressAuto: false, focusEditor: false });
            resetCreateContextSuggestions();
            createContextAutoLinkSuppressed.appointment = false;
            createContextAutoLinkSuppressed.admission = false;
            createContextEditorTab.value = 'patient';
            return;
        }

        if (previousId && nextId !== previousId) {
            clearCreateAppointmentLink({ suppressAuto: false, focusEditor: false });
            clearCreateAdmissionLink({ suppressAuto: false, focusEditor: false });
            createContextAutoLinkSuppressed.appointment = false;
            createContextAutoLinkSuppressed.admission = false;
            createContextEditorTab.value = 'patient';
        }

        void loadCreateContextSuggestions(nextId);
    },
    { immediate: true },
);

watch(
    () => createForm.appointmentId,
    (value, previousValue) => {
        const appointmentId = value.trim();
        if (appointmentId === (previousValue ?? '').trim()) return;

        if (pendingCreateAppointmentLinkSource !== null) {
            createAppointmentLinkSource.value = pendingCreateAppointmentLinkSource;
            pendingCreateAppointmentLinkSource = null;
        } else if (!appointmentId) {
            createAppointmentLinkSource.value = 'none';
        } else {
            createAppointmentLinkSource.value = 'manual';
        }

        void loadCreateAppointmentSummary(appointmentId);
    },
    { immediate: true },
);

watch(
    () => createForm.admissionId,
    (value, previousValue) => {
        const admissionId = value.trim();
        if (admissionId === (previousValue ?? '').trim()) return;

        if (pendingCreateAdmissionLinkSource !== null) {
            createAdmissionLinkSource.value = pendingCreateAdmissionLinkSource;
            pendingCreateAdmissionLinkSource = null;
        } else if (!admissionId) {
            createAdmissionLinkSource.value = 'none';
        } else {
            createAdmissionLinkSource.value = 'manual';
        }

        void loadCreateAdmissionSummary(admissionId);
    },
    { immediate: true },
);

watch(
    () => transferCreateForm.transferType,
    (value) => {
        if (value === 'internal') {
            transferCreateForm.destinationFacilityName = '';
            return;
        }

        if (usesRegistryBackedTransferSource.value) {
            transferCreateForm.destinationLocation = '';
        }
    },
);

const canOperateEmergencyWorkflow = computed(() =>
    canUpdateStatus.value || canManageTransfers.value,
);

const detailsPrimaryStatusAction = computed(() => {
    if (!detailsCase.value || !canUpdateStatus.value) return null;
    const status = (detailsCase.value.status ?? '').trim().toLowerCase();
    if (status === 'waiting') {
        return { action: 'triaged', label: 'Mark triaged', icon: 'clipboard-list' };
    }
    if (status === 'triaged') {
        return { action: 'in_treatment', label: 'Start treatment', icon: 'activity' };
    }
    if (status === 'in_treatment' && !detailsCase.value.admissionId) {
        return { action: 'admitted', label: 'Admit patient', icon: 'bed-double' };
    }
    return null;
});

const detailsCurrentFocus = computed(() => {
    const item = detailsCase.value;
    if (!item) {
        return {
            title: 'No case selected',
            description: 'Open an emergency triage case to review the next clinical handoff.',
            tone: 'muted' as const,
        };
    }

    const status = (item.status ?? '').trim().toLowerCase();
    const acuity = triageLevelBucket(item.triageLevel);

    if (!canOperateEmergencyWorkflow.value) {
        return {
            title: 'Emergency summary',
            description: 'Review the case status, acuity, transfers, and downstream handoff without changing the workflow.',
            tone: acuity === 'red' ? ('critical' as const) : ('muted' as const),
        };
    }

    if (acuity === 'red' && status === 'waiting') {
        return {
            title: 'Immediate response required',
            description: 'High-acuity case is still waiting. Move to active treatment or resuscitation review now.',
            tone: 'critical' as const,
        };
    }
    if (status === 'waiting') {
        return {
            title: 'Complete triage handoff',
            description: 'Capture the initial acuity decision and move the case into the active emergency treatment path.',
            tone: 'warning' as const,
        };
    }
    if (status === 'triaged') {
        return {
            title: 'Route into treatment',
            description: 'Start definitive emergency care and keep rapid orders and transfer options within reach.',
            tone: 'warning' as const,
        };
    }
    if (status === 'in_treatment') {
        return {
            title: 'Stabilize and decide disposition',
            description: 'Monitor treatment progress, then admit, discharge, or escalate the transfer handoff.',
            tone: acuity === 'red' ? ('critical' as const) : ('warning' as const),
        };
    }
    if (status === 'admitted' || status === 'discharged') {
        return {
            title: 'Workflow complete',
            description: 'Emergency routing is complete. Keep audit and transfer follow-up visible for the receiving team.',
            tone: 'success' as const,
        };
    }
    return {
        title: 'Review case status',
        description: 'Use the workflow actions and audit trail to confirm the current emergency handoff.',
        tone: 'muted' as const,
    };
});

const detailsFocusCardHeading = computed(() =>
    canOperateEmergencyWorkflow.value ? 'Workflow focus' : 'Case summary',
);

const detailsWorkflowSummaryCards = computed(() => {
    const item = detailsCase.value;
    if (!item) return [] as Array<{ label: string; value: string }>;

    const status = (item.status ?? '').trim().toLowerCase();
    const currentStep = formatEnumLabel(item.status ?? 'waiting');

    let nextAction = 'Review case summary';
    let afterStep = 'Keep the emergency case visible for the receiving team and downstream follow-up.';

    if (!canOperateEmergencyWorkflow.value) {
        nextAction = 'Review access';
        afterStep = 'Status progression remains limited to emergency staff with operational access.';
    } else if (status === 'waiting') {
        nextAction = 'Mark triaged';
        afterStep = 'The case moves into triaged handoff and stays visible for treatment pickup.';
    } else if (status === 'triaged') {
        nextAction = 'Start treatment';
        afterStep = 'The case moves into active emergency treatment and remains ready for rapid orders or transfer.';
    } else if (status === 'in_treatment') {
        nextAction = item.admissionId ? 'Discharge or transfer' : 'Admit, discharge, or transfer';
        afterStep = 'Disposition becomes the primary handoff, with emergency routing no longer leading the workflow.';
    } else if (status === 'admitted') {
        nextAction = 'Review admission handoff';
        afterStep = 'Ongoing inpatient care takes over and the emergency episode stays visible as completed routing.';
    } else if (status === 'discharged') {
        nextAction = 'Review discharge summary';
        afterStep = 'The emergency episode remains closed unless audit or transfer follow-up is needed.';
    } else if (status === 'cancelled') {
        nextAction = 'Review cancellation reason';
        afterStep = 'The case leaves the active queue and remains visible in audit history only.';
    }

    return [
        { label: 'Current step', value: currentStep },
        { label: canOperateEmergencyWorkflow.value ? 'Next action' : 'Access scope', value: nextAction },
        { label: 'After this step', value: afterStep },
    ];
});

const statusDialogMeta = computed(() => {
    const action = (statusAction.value ?? '').trim().toLowerCase();
    const currentStep = statusCase.value?.status ? formatEnumLabel(statusCase.value.status) : 'Emergency case selected';

    switch (action) {
        case 'triaged':
            return {
                title: 'Mark triage complete',
                description: 'Record the initial acuity handoff and move this case into the triaged emergency queue.',
                actionLabel: 'Mark triaged',
                afterStep: 'The case stays visible for treatment pickup and rapid emergency ordering.',
                submitLabel: 'Mark triaged',
                currentStep,
            };
        case 'in_treatment':
            return {
                title: 'Start treatment',
                description: 'Move this case into active emergency treatment so definitive care can begin.',
                actionLabel: 'Start treatment',
                afterStep: 'The case becomes an active treatment case and disposition decisions can follow.',
                submitLabel: 'Start treatment',
                currentStep,
            };
        case 'admitted':
            return {
                title: 'Admit from emergency',
                description: 'Document the admission handoff and move the case out of the emergency treatment queue.',
                actionLabel: 'Admit patient',
                afterStep: 'Admission becomes the active receiving workflow and emergency routing is treated as complete.',
                submitLabel: 'Admit patient',
                currentStep,
            };
        case 'discharged':
            return {
                title: 'Discharge from emergency',
                description: 'Close the emergency episode with a discharge handoff and summary note.',
                actionLabel: 'Discharge patient',
                afterStep: 'The case is closed as discharged and remains available for audit or follow-up review.',
                submitLabel: 'Discharge patient',
                currentStep,
            };
        case 'cancelled':
            return {
                title: 'Cancel emergency case',
                description: 'Remove this case from the active emergency workflow with a documented cancellation reason.',
                actionLabel: 'Cancel case',
                afterStep: 'The case leaves the active queue and remains visible in audit history only.',
                submitLabel: 'Cancel case',
                currentStep,
            };
        default:
            return {
                title: 'Update emergency status',
                description: 'Apply the next workflow step for this emergency case.',
                actionLabel: statusAction.value ? formatEnumLabel(statusAction.value) : 'Apply status',
                afterStep: 'Queue, details, and audit views will reflect the updated emergency status.',
                submitLabel: 'Apply status',
                currentStep,
            };
    }
});

const transferStatusDialogMeta = computed(() => {
    const action = (transferStatusAction.value ?? '').trim().toLowerCase();
    const currentStep = transferStatusTarget.value?.status ? formatEnumLabel(transferStatusTarget.value.status) : 'Transfer selected';

    switch (action) {
        case 'accepted':
            return {
                title: 'Accept transfer handoff',
                description: 'Acknowledge the receiving handoff so transport and destination preparation can continue.',
                actionLabel: 'Accept handoff',
                afterStep: 'The transfer is marked accepted and can move to in-transit once transport begins.',
                submitLabel: 'Accept transfer',
                currentStep,
            };
        case 'in_transit':
            return {
                title: 'Mark transfer in transit',
                description: 'Confirm that transport has started and the patient is on the move to the receiving location.',
                actionLabel: 'Mark in transit',
                afterStep: 'The transfer remains visible as active handoff until the receiving team completes it.',
                submitLabel: 'Mark in transit',
                currentStep,
            };
        case 'completed':
            return {
                title: 'Complete transfer handoff',
                description: 'Confirm that the receiving team has accepted the case and the transfer is fully complete.',
                actionLabel: 'Complete handoff',
                afterStep: 'The transfer is closed as completed and stays available for audit review.',
                submitLabel: 'Complete handoff',
                currentStep,
            };
        case 'cancelled':
            return {
                title: 'Cancel transfer handoff',
                description: 'Stop this transfer request and record why the handoff will not continue.',
                actionLabel: 'Cancel transfer',
                afterStep: 'The transfer leaves the active handoff queue and remains visible in transfer history.',
                submitLabel: 'Cancel transfer',
                currentStep,
            };
        case 'rejected':
            return {
                title: 'Reject transfer handoff',
                description: 'Record why the receiving path cannot accept this transfer so the emergency team can reroute safely.',
                actionLabel: 'Reject transfer',
                afterStep: 'The transfer is marked rejected and needs a new routing decision if escalation continues.',
                submitLabel: 'Reject transfer',
                currentStep,
            };
        default:
            return {
                title: 'Update transfer status',
                description: 'Apply the next handoff status for this transfer.',
                actionLabel: transferStatusAction.value ? formatEnumLabel(transferStatusAction.value) : 'Apply status',
                afterStep: 'The transfer timeline, queue counts, and audit trail will reflect the new status.',
                submitLabel: 'Apply status',
                currentStep,
            };
    }
});

const detailsLatestTransfer = computed(() => {
    const items = [...detailsTransfers.value];
    items.sort((left, right) => {
        const leftTime = new Date(left?.requestedAt ?? left?.createdAt ?? 0).getTime();
        const rightTime = new Date(right?.requestedAt ?? right?.createdAt ?? 0).getTime();
        return rightTime - leftTime;
    });
    return items[0] ?? null;
});

const detailsAmbulanceHandoff = computed(() => {
    const prioritized = [...detailsTransfers.value]
        .filter((transfer) => {
            const mode = (transfer?.transportMode ?? '').trim().toLowerCase();
            return mode.includes('ambulance') || transfer?.priority === 'critical' || transfer?.transferType === 'external';
        })
        .sort((left, right) => {
            const leftTime = new Date(left?.requestedAt ?? left?.createdAt ?? 0).getTime();
            const rightTime = new Date(right?.requestedAt ?? right?.createdAt ?? 0).getTime();
            return rightTime - leftTime;
        });

    return prioritized[0] ?? detailsLatestTransfer.value ?? null;
});

const detailsTransferPrimarySummary = computed(() => {
    const counts = detailsTransferCounts.value;
    const requested = counts.requested ?? 0;
    const accepted = counts.accepted ?? 0;
    const inTransit = counts.in_transit ?? 0;
    const rejected = counts.rejected ?? 0;
    const cancelled = counts.cancelled ?? 0;

    if (rejected > 0) {
        return {
            title: `${queueCountLabel(rejected)} transfer handoff${rejected > 1 ? 's' : ''} need rerouting`,
            description: 'A receiving path has rejected transfer. Review the handoff and choose a safer route next.',
            tone: 'critical' as const,
        };
    }

    if (requested > 0) {
        return {
            title: `${queueCountLabel(requested)} transfer handoff${requested > 1 ? 's' : ''} waiting for acceptance`,
            description: 'Receiving teams still need to acknowledge pending transfer requests.',
            tone: 'warning' as const,
        };
    }

    if (accepted > 0 || inTransit > 0) {
        const activeCount = accepted + inTransit;
        return {
            title: `${queueCountLabel(activeCount)} active transfer handoff${activeCount > 1 ? 's' : ''}`,
            description: inTransit > 0
                ? 'Transport is already in motion for at least one emergency transfer.'
                : 'Accepted transfers are waiting for transport to begin.',
            tone: detailsAmbulanceHandoff.value?.priority === 'critical' ? ('critical' as const) : ('warning' as const),
        };
    }

    if (cancelled > 0) {
        return {
            title: `${queueCountLabel(cancelled)} cancelled handoff${cancelled > 1 ? 's' : ''} logged`,
            description: 'Cancelled transfer requests remain visible for audit review and follow-up clarity.',
            tone: 'muted' as const,
        };
    }

    return {
        title: 'No active transfer blockers',
        description: 'Transfer handoffs are clear for this emergency case right now.',
        tone: detailsTransferCounts.value.total > 0 ? ('success' as const) : ('muted' as const),
    };
});

const detailsTransferWatchCards = computed(() => {
    const counts = detailsTransferCounts.value;
    const awaitingAcceptance = counts.requested ?? 0;
    const activeTransport = (counts.accepted ?? 0) + (counts.in_transit ?? 0);
    const blocked = (counts.rejected ?? 0) + (counts.cancelled ?? 0);

    return [
        {
            label: 'Awaiting acceptance',
            value: awaitingAcceptance,
            description: awaitingAcceptance > 0 ? 'Receiving team still needs to acknowledge these handoffs.' : 'No pending acknowledgements.',
            tone: awaitingAcceptance > 0 ? ('warning' as const) : ('success' as const),
        },
        {
            label: 'Active handoff',
            value: activeTransport,
            description: activeTransport > 0
                ? `${queueCountLabel(counts.in_transit ?? 0)} in transit | ${queueCountLabel(counts.accepted ?? 0)} accepted`
                : 'No transport currently in motion.',
            tone: activeTransport > 0 ? ((detailsAmbulanceHandoff.value?.priority === 'critical' ? 'critical' : 'warning') as const) : ('muted' as const),
        },
        {
            label: 'Blocked or closed',
            value: blocked,
            description: blocked > 0 ? 'Rejected or cancelled handoffs need review before rerouting.' : 'No blocked handoffs logged.',
            tone: (counts.rejected ?? 0) > 0 ? ('critical' as const) : blocked > 0 ? ('warning' as const) : ('success' as const),
        },
    ];
});

const detailsRapidOrderSetActions = computed(() => {
    if (!detailsCase.value) return [];
    const params = {
        patientId: detailsCase.value.patientId ?? null,
        appointmentId: detailsCase.value.appointmentId ?? null,
        admissionId: detailsCase.value.admissionId ?? null,
    };

    const actions = [
        {
            key: 'medical-record',
            label: 'Consultation note',
            description: 'Capture emergency documentation and SOAP handoff.',
            icon: 'stethoscope',
            href: buildContextHref('/medical-records', params),
        },
        {
            key: 'lab-order',
            label: 'Laboratory order',
            description: 'Launch urgent tests from the active emergency context.',
            icon: 'activity',
            href: buildContextHref('/laboratory-orders', params),
        },
        {
            key: 'radiology-order',
            label: 'Radiology order',
            description: 'Route imaging requests without losing triage context.',
            icon: 'scan-line',
            href: buildContextHref('/radiology-orders', params),
        },
        {
            key: 'pharmacy-order',
            label: 'Pharmacy order',
            description: 'Prepare medication release from the same patient handoff.',
            icon: 'file-text',
            href: buildContextHref('/pharmacy-orders', params),
        },
    ];

    if (!detailsCase.value.admissionId) {
        actions.push({
            key: 'admit-patient',
            label: 'Admission handoff',
            description: 'Send the stabilized case into the inpatient admission workflow.',
            icon: 'bed-double',
            href: buildContextHref('/admissions', params),
        });
    }

    return actions;
});

const detailsResuscitationTimeline = computed<EmergencyTimelineEvent[]>(() => {
    const item = detailsCase.value;
    if (!item) return [];

    const status = (item.status ?? '').trim().toLowerCase();
    const acuity = triageLevelBucket(item.triageLevel);
    const hasCriticalAcuity = acuity === 'red';
    const hasDisposition = ['admitted', 'discharged', 'cancelled'].includes(status);
    const triageRecorded = Boolean(item.triagedAt);
    const treatmentStarted = status === 'in_treatment' || hasDisposition;
    const dispositionLabel = formatEnumLabel(item.status ?? 'Disposition');
    const events: EmergencyTimelineEvent[] = [
        {
            id: 'arrival',
            title: 'Arrival logged',
            description: 'Emergency intake opened the case and linked the encounter context.',
            at: item.arrivalAt ?? item.createdAt ?? null,
            pending: !(item.arrivalAt ?? item.createdAt),
            badgeLabel: null,
            icon: 'activity',
            tone: 'success',
        },
        {
            id: 'queue',
            title: 'Emergency queue',
            description: status === 'waiting'
                ? 'Case is still waiting in the emergency queue for triage pickup.'
                : status === 'triaged'
                  ? 'Queue handoff is complete and the case is now waiting for treatment pickup.'
                  : status === 'in_treatment'
                    ? 'Queue handoff is complete and the case has moved into active treatment.'
                    : 'Queue handoff is complete and the case has left active emergency routing.',
            at: null,
            pending: false,
            badgeLabel: status === 'waiting' ? 'Current step' : 'Completed',
            icon: 'layout-list',
            tone: status === 'waiting' ? (hasCriticalAcuity ? 'critical' : 'warning') : 'success',
        },
    ];

    if (triageRecorded || status !== 'waiting') {
        events.push({
            id: 'triage',
            title: 'Triage completed',
            description: triageRecorded
                ? `${triageLevelDisplayLabel(item.triageLevel)} recorded with complaint and vitals handoff.`
                : status === 'triaged'
                  ? 'Triage is the current step and treatment has not started yet.'
                  : 'Treatment or final disposition moved ahead without a separate triage timestamp.',
            at: item.triagedAt ?? null,
            pending: false,
            badgeLabel: triageRecorded
                ? null
                : status === 'triaged'
                  ? 'Current step'
                  : 'Completed without timestamp',
            icon: 'clipboard-list',
            tone: triageRecorded
                ? (hasCriticalAcuity ? 'critical' : 'success')
                : (status === 'triaged'
                    ? (hasCriticalAcuity ? 'critical' : 'warning')
                    : 'muted'),
        });
    }

    if (treatmentStarted) {
        events.push({
            id: 'treatment',
            title: 'Treatment active',
            description: status === 'in_treatment'
                ? 'Case is in active emergency treatment.'
                : status === 'cancelled'
                  ? 'The case left the emergency workflow before treatment could continue.'
                  : `Treatment phase is complete and ${dispositionLabel.toLowerCase()} has been recorded.`,
            at: null,
            pending: false,
            badgeLabel: status === 'in_treatment' ? 'Current step' : 'Completed',
            icon: 'stethoscope',
            tone: status === 'in_treatment'
                ? (hasCriticalAcuity ? 'critical' : 'warning')
                : 'success',
        });
    }

    if (hasDisposition) {
        events.push({
            id: 'disposition',
            title: 'Final disposition',
            description: status === 'admitted'
                ? 'Patient was admitted from emergency and handed into inpatient care.'
                : status === 'discharged'
                  ? 'Patient was discharged from emergency with disposition notes for follow-up.'
                  : 'Case was cancelled and removed from the active emergency workflow.',
            at: item.completedAt ?? item.updatedAt ?? null,
            pending: false,
            badgeLabel: dispositionLabel,
            icon: 'check-circle',
            tone: status === 'cancelled' ? 'warning' : 'success',
        });
    }

    return events;
});
const detailsAuditSummaryCards = computed(() => {
    const statusChanges = detailsAuditLogs.value.filter((log) => String(log?.action ?? '').includes('status')).length;
    const systemEvents = detailsAuditLogs.value.filter((log) => log?.actorId === null || log?.actorId === undefined).length;
    return [
        { label: 'Events', value: detailsAuditMeta.value?.total ?? detailsAuditLogs.value.length },
        { label: 'Status changes', value: statusChanges },
        { label: 'System events', value: systemEvents },
    ];
});

const queueDetailsActionLabel = computed(() =>
    canOperateEmergencyWorkflow.value ? 'Open case' : 'Review',
);

function queueCaseMetaLabel(item: any): string | null {
    const parts = [
        item?.arrivalAt ? `Arrived ${formatDateTime(item.arrivalAt)}` : null,
        item?.triagedAt ? `Triaged ${formatDateTime(item.triagedAt)}` : null,
        item?.completedAt ? `Closed ${formatDateTime(item.completedAt)}` : null,
        item?.appointmentId ? 'Appointment linked' : null,
        item?.admissionId ? 'Admission linked' : null,
    ].filter((value): value is string => Boolean(value));

    return parts.length > 0 ? parts.join(' | ') : null;
}
function queueCasePreviewLabel(item: any): string {
    const status = (item?.status ?? '').trim().toLowerCase();
    const chiefComplaint = (item?.chiefComplaint ?? '').trim();
    const statusReason = (item?.statusReason ?? '').trim();

    if ((status === 'admitted' || status === 'discharged' || status === 'cancelled') && statusReason) {
        return statusReason;
    }

    return chiefComplaint || statusReason || 'No chief complaint recorded.';
}

function queueCaseFocus(item: any): {
    label: string;
    description: string;
    tone: 'critical' | 'warning' | 'success' | 'muted';
} {
    const status = (item?.status ?? '').trim().toLowerCase();
    const acuity = triageLevelBucket(item?.triageLevel);

    if (status === 'cancelled') {
        return {
            label: 'Cancelled',
            description: 'Removed from the active emergency queue.',
            tone: 'muted',
        };
    }

    if (status === 'admitted') {
        return {
            label: 'Admission handoff complete',
            description: 'Receiving inpatient care now leads the workflow.',
            tone: 'success',
        };
    }

    if (status === 'discharged') {
        return {
            label: 'Discharge complete',
            description: 'Emergency routing is closed unless follow-up is needed.',
            tone: 'success',
        };
    }

    if (status === 'in_treatment') {
        return {
            label: acuity === 'red' ? 'Critical treatment in progress' : 'Disposition decision pending',
            description: 'Continue care, then admit, discharge, or transfer when stabilized.',
            tone: acuity === 'red' ? 'critical' : 'warning',
        };
    }

    if (status === 'triaged') {
        return {
            label: 'Ready for treatment pickup',
            description: 'Triage is complete and the case is waiting for active treatment.',
            tone: acuity === 'red' ? 'critical' : 'warning',
        };
    }

    if (acuity === 'red') {
        return {
            label: 'Immediate attention required',
            description: 'High-acuity case is still waiting in the intake queue.',
            tone: 'critical',
        };
    }

    return {
        label: 'Triage handoff pending',
        description: 'Complete triage to move the case into active treatment.',
        tone: 'warning',
    };
}

function queueCaseRowClasses(item: any): string {
    const base =
        queueRowDensity.value === 'compact'
            ? 'rounded-lg border px-3 py-2.5'
            : 'rounded-lg border p-3';
    const tone = queueCaseFocus(item).tone;

    if (tone === 'critical') return `${base} border-destructive/30 bg-destructive/[0.03]`;
    if (tone === 'warning') return `${base} border-amber-500/30 bg-amber-500/[0.04]`;
    if (tone === 'success') return `${base} border-emerald-500/30 bg-emerald-500/[0.04]`;
    return `${base} border-border bg-background`;
}

function queueCaseFocusStripClasses(item: any): string {
    const tone = queueCaseFocus(item).tone;

    if (tone === 'critical') return 'border-destructive/30 bg-destructive/10';
    if (tone === 'warning') return 'border-amber-500/30 bg-amber-500/10';
    if (tone === 'success') return 'border-emerald-500/30 bg-emerald-500/10';
    return 'border-border bg-muted/40';
}

function transferWorkflowFocus(transfer: any): {
    label: string;
    description: string;
    tone: 'critical' | 'warning' | 'success' | 'muted';
} {
    const status = (transfer?.status ?? '').trim().toLowerCase();
    const priority = (transfer?.priority ?? '').trim().toLowerCase();

    if (status === 'rejected') {
        return {
            label: 'Reroute required',
            description: 'The receiving path rejected this transfer and the emergency team needs a new route.',
            tone: 'critical',
        };
    }

    if (status === 'requested') {
        return {
            label: 'Waiting for acceptance',
            description: 'Receiving team still needs to acknowledge this transfer handoff.',
            tone: priority === 'critical' ? 'critical' : 'warning',
        };
    }

    if (status === 'accepted') {
        return {
            label: 'Transport not started',
            description: 'The handoff is accepted and ready to move into transport.',
            tone: priority === 'critical' ? 'critical' : 'warning',
        };
    }

    if (status === 'in_transit') {
        return {
            label: 'Transfer in transit',
            description: 'The patient is on the way to the receiving destination now.',
            tone: priority === 'critical' ? 'critical' : 'warning',
        };
    }

    if (status === 'completed') {
        return {
            label: 'Transfer complete',
            description: 'Receiving team has accepted the handoff and emergency transport is closed.',
            tone: 'success',
        };
    }

    if (status === 'cancelled') {
        return {
            label: 'Transfer cancelled',
            description: 'This handoff was stopped and remains visible for audit follow-up.',
            tone: 'muted',
        };
    }

    return {
        label: 'Transfer review',
        description: 'Review the current handoff state and keep the receiving team aligned.',
        tone: 'muted',
    };
}

function transferRowClasses(transfer: any): string {
    const tone = transferWorkflowFocus(transfer).tone;
    const base = 'rounded-lg border px-4 py-3';

    if (tone === 'critical') return `${base} border-destructive/30 bg-destructive/[0.03]`;
    if (tone === 'warning') return `${base} border-amber-500/30 bg-amber-500/[0.04]`;
    if (tone === 'success') return `${base} border-emerald-500/30 bg-emerald-500/[0.04]`;
    return `${base} border-border bg-background`;
}

function transferFocusStripClasses(transfer: any): string {
    const tone = transferWorkflowFocus(transfer).tone;

    if (tone === 'critical') return 'border-destructive/30 bg-destructive/10';
    if (tone === 'warning') return 'border-amber-500/30 bg-amber-500/10';
    if (tone === 'success') return 'border-emerald-500/30 bg-emerald-500/10';
    return 'border-border bg-muted/40';
}

function openEmergencyWorkspace(workspace: EmergencyWorkspace) {
    emergencyWorkspace.value = workspace;
}

function applyAcuityFilter(level: string) {
    searchForm.triageLevel = searchForm.triageLevel === level ? '' : level;
    searchForm.page = 1;
    void loadQueue();
}

function applyStatusFilter(status: string) {
    searchForm.status = status === 'all' ? '' : status;
    searchForm.page = 1;
    void loadQueue();
}

function isEmergencySummaryFilterActive(status: string): boolean {
    return searchForm.status === status;
}

function isEmergencyAcuityPresetActive(level: string): boolean {
    return (searchForm.triageLevel || 'all') === level;
}

function applyEmergencyAcuityPreset(level: string) {
    searchForm.triageLevel = level === 'all' ? '' : level;
    searchForm.page = 1;
    void loadQueue();
}

function syncQueueAdvancedFilterDraft() {
    queueDraftPatientId.value = searchForm.patientId;
}

function openQueueFiltersSheet() {
    syncQueueAdvancedFilterDraft();
    queueFiltersSheetOpen.value = true;
}

function openQueueFiltersDrawer() {
    syncQueueAdvancedFilterDraft();
    mobileFiltersDrawerOpen.value = true;
}

function applyQueueAdvancedFilters() {
    searchForm.patientId = queueDraftPatientId.value.trim();
    searchForm.page = 1;
    queueFiltersSheetOpen.value = false;
    mobileFiltersDrawerOpen.value = false;
    void loadQueue();
}

function resetQueueAdvancedFilters() {
    queueDraftPatientId.value = '';
    queueFiltersSheetOpen.value = false;
    mobileFiltersDrawerOpen.value = false;
    resetFilters();
}

function submitSearch() {
    searchForm.page = 1;
    void loadQueue();
}

function resetFilters() {
    searchForm.q = '';
    searchForm.patientId = '';
    searchForm.status = '';
    searchForm.triageLevel = '';
    searchForm.page = 1;
    searchForm.perPage = 25;
    queueRowDensity.value = 'comfortable';
    void loadQueue();
}

function prevPage() {
    if ((pagination.value?.currentPage ?? 1) <= 1) return;
    searchForm.page = (pagination.value?.currentPage ?? 2) - 1;
    void loadQueue();
}

function nextPage() {
    if (!pagination.value || pagination.value.currentPage >= pagination.value.lastPage) return;
    searchForm.page = (pagination.value?.currentPage ?? 0) + 1;
    void loadQueue();
}

function scrollToCreateTriage() {
    openEmergencyWorkspace('create');
}

function defaultDateTimeLocal(): string {
    const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

function toSqlDateTime(value: string | null | undefined): string | null {
    if (!value) return null;
    return `${value.replace('T', ' ')}:00`;
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function csrfToken(): string | null {
    const element = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    return element?.content ?? null;
}

async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, opts?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> }): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(opts?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    let body: string | undefined;
    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        const token = csrfToken();
        if (token) headers['X-CSRF-TOKEN'] = token;
        body = JSON.stringify(opts?.body ?? {});
    }

    const response = await fetch(url.toString(), { method, credentials: 'same-origin', headers, body });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as ApiError;
        error.payload = payload;
        throw error;
    }
    return payload as T;
}

async function hydratePatientSummary(patientId: string) {
    const normalizedId = patientId.trim();
    if (!normalizedId || patientDirectory.value[normalizedId] || pendingPatientLookupIds.has(normalizedId)) {
        return;
    }

    pendingPatientLookupIds.add(normalizedId);

    try {
        const response = await apiRequest<PatientResponse>('GET', `/patients/${normalizedId}`);
        patientDirectory.value = {
            ...patientDirectory.value,
            [normalizedId]: response.data,
        };
    } catch {
        // Keep emergency flows usable even if patient hydration is unavailable.
    } finally {
        pendingPatientLookupIds.delete(normalizedId);
    }
}

async function hydrateVisiblePatients(rows: any[]) {
    const ids = [
        ...new Set(
            rows
                .map((row) => String(row?.patientId ?? '').trim())
                .filter(Boolean),
        ),
    ];
    const uncachedIds = ids.filter(
        (id) => !patientDirectory.value[id] && !pendingPatientLookupIds.has(id),
    );

    if (uncachedIds.length === 0) return;

    uncachedIds.forEach((id) => pendingPatientLookupIds.add(id));

    const results = await Promise.allSettled(
        uncachedIds.map((id) => apiRequest<PatientResponse>('GET', `/patients/${id}`)),
    );

    const nextDirectory = { ...patientDirectory.value };
    results.forEach((result, index) => {
        const id = uncachedIds[index];
        pendingPatientLookupIds.delete(id);
        if (result.status !== 'fulfilled') return;
        nextDirectory[id] = result.value.data;
    });
    patientDirectory.value = nextDirectory;
}
async function loadPermissions() {
    try {
        const response = await apiRequest<{ data?: Array<{ name?: string }> }>('GET', '/auth/me/permissions');
        const names = new Set((response.data ?? []).map((item) => (item.name ?? '').trim()));
        canRead.value = names.has('emergency.triage.read');
        canCreate.value = names.has('emergency.triage.create');
        canUpdateStatus.value = names.has('emergency.triage.update-status');
        canViewAudit.value = names.has('emergency.triage.view-audit-logs');
        canManageTransfers.value = names.has('emergency.triage.manage-transfers');
        canViewTransferAudit.value = names.has('emergency.triage.view-transfer-audit-logs');
        canReadTransferLocationRegistry.value = names.has('platform.resources.read');
        canReadTransferClinicianDirectory.value = names.has('staff.clinical-directory.read');
    } catch {
        canRead.value = false;
        canCreate.value = false;
        canUpdateStatus.value = false;
        canViewAudit.value = false;
        canManageTransfers.value = false;
        canViewTransferAudit.value = false;
        canReadTransferLocationRegistry.value = false;
        canReadTransferClinicianDirectory.value = false;
    }
}

async function loadScope() {
    try {
        const response = await apiRequest<{ data: ScopeData }>('GET', '/platform/access-scope');
        scope.value = response.data;
    } catch {
        scope.value = null;
    }
}

async function loadTransferLocationRegistry() {
    if (!canReadTransferLocationRegistry.value) {
        transferServicePoints.value = [];
        transferWardBeds.value = [];
        transferLocationRegistryError.value = null;
        transferLocationRegistryLoading.value = false;
        return;
    }

    transferLocationRegistryLoading.value = true;
    transferLocationRegistryError.value = null;

    try {
        const [servicePointResponse, wardBedResponse] = await Promise.all([
            apiRequest<ServicePointRegistryListResponse>('GET', '/platform/admin/service-points', {
                query: { page: 1, perPage: 200, status: 'active' },
            }),
            apiRequest<WardBedRegistryListResponse>('GET', '/platform/admin/ward-beds', {
                query: { page: 1, perPage: 200, status: 'active' },
            }),
        ]);

        transferServicePoints.value = (servicePointResponse.data ?? []).slice();
        transferWardBeds.value = (wardBedResponse.data ?? []).slice();
    } catch (error) {
        transferServicePoints.value = [];
        transferWardBeds.value = [];
        transferLocationRegistryError.value = messageFromUnknown(
            error,
            'Unable to load internal transfer locations from the registry.',
        );
    } finally {
        transferLocationRegistryLoading.value = false;
    }
}

async function loadTransferClinicians() {
    if (!canReadTransferClinicianDirectory.value) {
        transferClinicians.value = [];
        transferCliniciansError.value = null;
        transferCliniciansLoading.value = false;
        return;
    }

    transferCliniciansLoading.value = true;
    transferCliniciansError.value = null;

    try {
        const response = await apiRequest<StaffListResponse>('GET', '/staff/clinical-directory', {
            query: {
                status: 'active',
                page: 1,
                perPage: 200,
            },
        });

        transferClinicians.value = response.data ?? [];
    } catch (error) {
        transferClinicians.value = [];
        transferCliniciansError.value = messageFromUnknown(
            error,
            'Unable to load active clinician directory for handoff.',
        );
    } finally {
        transferCliniciansLoading.value = false;
    }
}

async function loadQueue() {
    if (!canRead.value) return;
    queueLoading.value = true;
    queueError.value = null;
    try {
        const [listResponse, countsResponse] = await Promise.all([
            apiRequest<{ data: any[]; meta: { currentPage: number; lastPage: number } }>('GET', '/emergency-triage-cases', {
                query: {
                    q: searchForm.q.trim() || null,
                    patientId: searchForm.patientId.trim() || null,
                    status: searchForm.status || null,
                    triageLevel: searchForm.triageLevel || null,
                    page: searchForm.page,
                    perPage: searchForm.perPage,
                },
            }),
            apiRequest<{ data: typeof counts.value }>('GET', '/emergency-triage-cases/status-counts', {
                query: {
                    q: searchForm.q.trim() || null,
                    patientId: searchForm.patientId.trim() || null,
                    triageLevel: searchForm.triageLevel || null,
                },
            }),
        ]);
        cases.value = listResponse.data;
        pagination.value = listResponse.meta;
        counts.value = countsResponse.data;
        void hydrateVisiblePatients(listResponse.data ?? []);
        if (searchForm.patientId.trim()) {
            void hydratePatientSummary(searchForm.patientId);
        }
    } catch (error) {
        queueError.value = messageFromUnknown(error, 'Unable to load emergency queue.');
        cases.value = [];
        pagination.value = null;
    } finally {
        queueLoading.value = false;
    }
}

async function loadDetailsCase(caseId: string) {
    detailsCaseLoading.value = true;
    detailsCaseError.value = null;
    try {
        const response = await apiRequest<{ data: any }>('GET', `/emergency-triage-cases/${caseId}`);
        detailsCase.value = response.data;
        if (String(response.data?.patientId ?? '').trim()) {
            void hydratePatientSummary(String(response.data.patientId));
        }
    } catch (error) {
        detailsCaseError.value = messageFromUnknown(error, 'Unable to refresh emergency case details.');
    } finally {
        detailsCaseLoading.value = false;
    }
}

function createFieldError(name: string): string | null {
    return createErrors.value[name]?.[0] ?? null;
}

function clearCreateFeedback() {
    createErrors.value = {};
    createMessage.value = null;
}

function openCreateContextDialog(
    tab: EmergencyCreateContextEditorTab = 'patient',
) {
    createContextEditorTab.value = tab;
    createContextDialogOpen.value = true;
}

function openCreateContextDialogForValidationErrors(
    errors: Record<string, string[]>,
) {
    if (errors.patientId?.length) {
        openCreateContextDialog('patient');
        return;
    }

    if (errors.appointmentId?.length) {
        openCreateContextDialog('appointment');
        return;
    }

    if (errors.admissionId?.length) {
        openCreateContextDialog('admission');
    }
}

function closeCreateContextDialogAfterSelection(
    kind: 'patientId' | 'appointmentId' | 'admissionId',
    selected:
        | {
              id?: string | null;
              patientNumber?: string | null;
              firstName?: string | null;
              middleName?: string | null;
              lastName?: string | null;
          }
        | null,
) {
    if (!createContextDialogOpen.value || !selected) return;

    const nextId = selected.id?.trim?.() ?? '';
    if (!nextId) return;

    if (kind === 'patientId') {
        patientDirectory.value = {
            ...patientDirectory.value,
            [nextId]: {
                id: nextId,
                patientNumber: selected.patientNumber ?? null,
                firstName: selected.firstName ?? null,
                middleName: selected.middleName ?? null,
                lastName: selected.lastName ?? null,
            },
        };
    }

    if (createContextDialogInitialSelection[kind] === nextId) return;

    createContextDialogOpen.value = false;
}
function handleCreatePatientSelected(patient: any | null) {
    createSelectedPatient.value = patient;
    closeCreateContextDialogAfterSelection('patientId', patient);
}

async function submitCreate() {
    if (!canCreate.value || createSubmitting.value) return;
    createSubmitting.value = true;
    createErrors.value = {};
    createMessage.value = null;
    try {
        const response = await apiRequest<{ data: any }>('POST', '/emergency-triage-cases', {
            body: {
                patientId: createForm.patientId.trim(),
                appointmentId: createForm.appointmentId.trim() || null,
                admissionId: createForm.admissionId.trim() || null,
                arrivalAt: `${createForm.arrivalAt.replace('T', ' ')}:00`,
                triageLevel: createForm.triageLevel,
                chiefComplaint: createForm.chiefComplaint.trim(),
                vitalsSummary: createForm.vitalsSummary.trim() || null,
            },
        });
        createMessage.value = `Created ${response.data.caseNumber ?? 'triage case'}.`;
        notifySuccess('Emergency triage case created.');
        createForm.chiefComplaint = '';
        createForm.vitalsSummary = '';
        searchForm.q = '';
        searchForm.patientId = '';
        searchForm.triageLevel = '';
        searchForm.status = 'waiting';
        searchForm.page = 1;
        emergencyWorkspace.value = 'queue';
        await loadQueue();
    } catch (error) {
        createErrors.value = (error as ApiError).payload?.errors ?? {};
        openCreateContextDialogForValidationErrors(createErrors.value);
        notifyError(messageFromUnknown(error, 'Unable to create emergency triage case.'));
    } finally {
        createSubmitting.value = false;
    }
}

function openStatusDialog(item: any, action: string) {
    statusCase.value = item;
    statusAction.value = action;
    statusReason.value = action === 'cancelled' ? (item.statusReason ?? '') : '';
    statusDispositionNotes.value = action === 'admitted' || action === 'discharged' ? (item.dispositionNotes ?? '') : '';
    statusError.value = null;
    statusDialogOpen.value = true;
}

async function submitStatusDialog() {
    if (!statusCase.value || !statusAction.value) return;
    if (statusAction.value === 'cancelled' && statusReason.value.trim() === '') {
        statusError.value = 'Cancellation reason is required.';
        return;
    }
    if ((statusAction.value === 'admitted' || statusAction.value === 'discharged') && statusDispositionNotes.value.trim() === '') {
        statusError.value = 'Disposition notes are required.';
        return;
    }
    actionLoadingId.value = statusCase.value.id;
    statusError.value = null;
    try {
        await apiRequest('PATCH', `/emergency-triage-cases/${statusCase.value.id}/status`, {
            body: { status: statusAction.value, reason: statusReason.value.trim() || null, dispositionNotes: statusDispositionNotes.value.trim() || null },
        });
        statusDialogOpen.value = false;
        notifySuccess('Emergency triage status updated.');
        await loadQueue();
        if (detailsOpen.value && detailsCase.value?.id === statusCase.value.id) {
            await Promise.all([
                loadDetailsCase(statusCase.value.id),
                loadDetailsTransfers(),
                canViewAudit.value ? loadDetailsAuditLogs() : Promise.resolve(),
            ]);
        }
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update status.');
        notifyError(statusError.value);
    } finally {
        actionLoadingId.value = null;
    }
}

async function openDetails(item: any) {
    detailsCase.value = item;
    detailsOpen.value = true;
    detailsSheetTab.value = 'overview';
    detailsCaseError.value = null;
    detailsAuditLogs.value = [];
    detailsAuditError.value = null;
    detailsAuditMeta.value = null;
    detailsAuditExpandedRows.value = {};
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    detailsTransferLoading.value = false;
    detailsTransferError.value = null;
    detailsTransfers.value = [];
    detailsTransferMeta.value = null;
    detailsTransferCounts.value = { requested: 0, accepted: 0, in_transit: 0, completed: 0, cancelled: 0, rejected: 0, other: 0, total: 0 };
    detailsTransferFilters.q = '';
    detailsTransferFilters.transferType = '';
    detailsTransferFilters.priority = '';
    detailsTransferFilters.status = '';
    detailsTransferFilters.page = 1;
    detailsTransferFilters.perPage = 10;
    transferCreateErrors.value = {};
    transferCreateForm.transferType = 'internal';
    transferCreateForm.priority = 'urgent';
    transferCreateForm.sourceLocation = '';
    transferCreateForm.destinationLocation = '';
    transferCreateForm.destinationFacilityName = '';
    transferCreateForm.acceptingClinicianUserId = '';
    transferCreateForm.requestedAt = defaultDateTimeLocal();
    transferCreateForm.clinicalHandoffNotes = '';
    transferCreateForm.transportMode = '';
    transferAuditTarget.value = null;
    transferAuditLogs.value = [];
    transferAuditMeta.value = null;
    transferAuditError.value = null;
    const loaders: Promise<unknown>[] = [loadDetailsCase(item.id), loadDetailsTransfers()];
    if (canViewAudit.value) {
        loaders.push(loadDetailsAuditLogs());
    }
    await Promise.all(loaders);
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

function auditActorLabel(log: any): string {
    return log?.actorId === null || log?.actorId === undefined
        ? 'System'
        : `User ID ${log.actorId}`;
}

async function loadDetailsAuditLogs() {
    if (!canViewAudit.value || !detailsCase.value) return;
    detailsAuditLoading.value = true;
    detailsAuditError.value = null;
    try {
        const response = await apiRequest<{
            data: any[];
            meta?: { currentPage?: number; lastPage?: number; total?: number; perPage?: number };
        }>('GET', `/emergency-triage-cases/${detailsCase.value.id}/audit-logs`, {
            query: detailsAuditQuery(),
        });
        detailsAuditLogs.value = response.data ?? [];
        detailsAuditMeta.value = {
            currentPage: response.meta?.currentPage ?? detailsAuditFilters.page,
            lastPage: response.meta?.lastPage ?? 1,
            total: response.meta?.total ?? detailsAuditLogs.value.length,
            perPage: response.meta?.perPage ?? detailsAuditFilters.perPage,
        };
    } catch (error) {
        detailsAuditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
    } finally {
        detailsAuditLoading.value = false;
    }
}

function applyDetailsAuditFilters() {
    detailsAuditFilters.page = 1;
    void loadDetailsAuditLogs();
}

function resetDetailsAuditFilters() {
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    void loadDetailsAuditLogs();
}

function goToDetailsAuditPage(page: number) {
    const safePage = Math.max(page, 1);
    detailsAuditFilters.page = safePage;
    void loadDetailsAuditLogs();
}

async function exportDetailsAuditLogsCsv() {
    if (!detailsCase.value || !canViewAudit.value || detailsAuditExporting.value) {
        return;
    }

    detailsAuditExporting.value = true;
    try {
        const url = new URL(
            `/api/v1/emergency-triage-cases/${detailsCase.value.id}/audit-logs/export`,
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

function transferCreateFieldError(name: string): string | null {
    return transferCreateErrors.value[name]?.[0] ?? null;
}

function detailsTransferQuery() {
    return {
        q: detailsTransferFilters.q.trim() || null,
        transferType: detailsTransferFilters.transferType || null,
        priority: detailsTransferFilters.priority || null,
        status: detailsTransferFilters.status || null,
        page: detailsTransferFilters.page,
        perPage: detailsTransferFilters.perPage,
    };
}

async function loadDetailsTransfers() {
    if (!detailsCase.value || !canRead.value) return;
    detailsTransferLoading.value = true;
    detailsTransferError.value = null;
    try {
        const [listResponse, countsResponse] = await Promise.all([
            apiRequest<{
                data: any[];
                meta?: { currentPage?: number; lastPage?: number; total?: number; perPage?: number };
            }>('GET', `/emergency-triage-cases/${detailsCase.value.id}/transfers`, {
                query: detailsTransferQuery(),
            }),
            apiRequest<{ data: typeof detailsTransferCounts.value }>(`GET`, `/emergency-triage-cases/${detailsCase.value.id}/transfer-status-counts`, {
                query: {
                    q: detailsTransferFilters.q.trim() || null,
                    transferType: detailsTransferFilters.transferType || null,
                    priority: detailsTransferFilters.priority || null,
                },
            }),
        ]);
        detailsTransfers.value = listResponse.data ?? [];
        detailsTransferMeta.value = {
            currentPage: listResponse.meta?.currentPage ?? detailsTransferFilters.page,
            lastPage: listResponse.meta?.lastPage ?? 1,
            total: listResponse.meta?.total ?? detailsTransfers.value.length,
            perPage: listResponse.meta?.perPage ?? detailsTransferFilters.perPage,
        };
        detailsTransferCounts.value = countsResponse.data ?? { requested: 0, accepted: 0, in_transit: 0, completed: 0, cancelled: 0, rejected: 0, other: 0, total: 0 };
    } catch (error) {
        detailsTransferError.value = messageFromUnknown(error, 'Unable to load transfer queue.');
        detailsTransfers.value = [];
        detailsTransferMeta.value = null;
        detailsTransferCounts.value = { requested: 0, accepted: 0, in_transit: 0, completed: 0, cancelled: 0, rejected: 0, other: 0, total: 0 };
    } finally {
        detailsTransferLoading.value = false;
    }
}

function applyTransferFilters() {
    detailsTransferFilters.page = 1;
    void loadDetailsTransfers();
}

function resetTransferFilters() {
    detailsTransferFilters.q = '';
    detailsTransferFilters.transferType = '';
    detailsTransferFilters.priority = '';
    detailsTransferFilters.status = '';
    detailsTransferFilters.page = 1;
    detailsTransferFilters.perPage = 10;
    void loadDetailsTransfers();
}

function goToTransferPage(page: number) {
    detailsTransferFilters.page = Math.max(page, 1);
    void loadDetailsTransfers();
}

function setTransferStatusFilter(status: string) {
    detailsTransferFilters.status = detailsTransferFilters.status === status ? '' : status;
    detailsTransferFilters.page = 1;
    void loadDetailsTransfers();
}

async function submitTransferCreate() {
    if (!detailsCase.value || !canManageTransfers.value || transferCreateSubmitting.value) return;
    transferCreateSubmitting.value = true;
    transferCreateErrors.value = {};
    try {
        await apiRequest('POST', `/emergency-triage-cases/${detailsCase.value.id}/transfers`, {
            body: {
                transferType: transferCreateForm.transferType,
                priority: transferCreateForm.priority,
                sourceLocation: transferCreateForm.sourceLocation.trim() || null,
                destinationLocation: transferCreateForm.destinationLocation.trim(),
                destinationFacilityName: transferCreateForm.destinationFacilityName.trim() || null,
                acceptingClinicianUserId:
                    transferCreateForm.acceptingClinicianUserId.trim() === ''
                        ? null
                        : Number(transferCreateForm.acceptingClinicianUserId),
                requestedAt: toSqlDateTime(transferCreateForm.requestedAt),
                clinicalHandoffNotes: transferCreateForm.clinicalHandoffNotes.trim() || null,
                transportMode: transferCreateForm.transportMode.trim() || null,
            },
        });
        notifySuccess('Transfer request created.');
        transferCreateForm.sourceLocation = '';
        transferCreateForm.destinationLocation = '';
        transferCreateForm.destinationFacilityName = '';
        transferCreateForm.acceptingClinicianUserId = '';
        transferCreateForm.requestedAt = defaultDateTimeLocal();
        transferCreateForm.clinicalHandoffNotes = '';
        transferCreateForm.transportMode = '';
        await loadDetailsTransfers();
    } catch (error) {
        transferCreateErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to create transfer request.'));
    } finally {
        transferCreateSubmitting.value = false;
    }
}

function openTransferStatusDialog(item: any, status: string) {
    transferStatusTarget.value = item;
    transferStatusAction.value = status;
    transferStatusReason.value = '';
    transferStatusNotes.value = item?.clinicalHandoffNotes ?? '';
    transferStatusError.value = null;
    transferStatusDialogOpen.value = true;
}

function transferStatusNeedsReason(): boolean {
    return transferStatusAction.value === 'cancelled' || transferStatusAction.value === 'rejected';
}

async function submitTransferStatusDialog() {
    if (!detailsCase.value || !transferStatusTarget.value || !canManageTransfers.value || transferStatusSubmitting.value) return;
    if (transferStatusNeedsReason() && transferStatusReason.value.trim() === '') {
        transferStatusError.value = 'Reason is required for this transfer status.';
        return;
    }
    transferStatusSubmitting.value = true;
    transferStatusError.value = null;
    try {
        await apiRequest('PATCH', `/emergency-triage-cases/${detailsCase.value.id}/transfers/${transferStatusTarget.value.id}/status`, {
            body: {
                status: transferStatusAction.value,
                reason: transferStatusReason.value.trim() || null,
                clinicalHandoffNotes: transferStatusNotes.value.trim() || null,
            },
        });
        notifySuccess('Transfer status updated.');
        transferStatusDialogOpen.value = false;
        await loadDetailsTransfers();
    } catch (error) {
        transferStatusError.value = messageFromUnknown(error, 'Unable to update transfer status.');
        notifyError(transferStatusError.value);
    } finally {
        transferStatusSubmitting.value = false;
    }
}

function transferAuditQuery() {
    return {
        q: transferAuditFilters.q.trim() || null,
        action: transferAuditFilters.action.trim() || null,
        actorType: transferAuditFilters.actorType || null,
        actorId: transferAuditFilters.actorId.trim() || null,
        from: transferAuditFilters.from || null,
        to: transferAuditFilters.to || null,
        page: transferAuditFilters.page,
        perPage: transferAuditFilters.perPage,
    };
}

async function loadTransferAuditLogs() {
    if (!detailsCase.value || !transferAuditTarget.value || !canViewTransferAudit.value) return;
    transferAuditLoading.value = true;
    transferAuditError.value = null;
    try {
        const response = await apiRequest<{
            data: any[];
            meta?: { currentPage?: number; lastPage?: number; total?: number; perPage?: number };
        }>('GET', `/emergency-triage-cases/${detailsCase.value.id}/transfers/${transferAuditTarget.value.id}/audit-logs`, {
            query: transferAuditQuery(),
        });
        transferAuditLogs.value = response.data ?? [];
        transferAuditMeta.value = {
            currentPage: response.meta?.currentPage ?? transferAuditFilters.page,
            lastPage: response.meta?.lastPage ?? 1,
            total: response.meta?.total ?? transferAuditLogs.value.length,
            perPage: response.meta?.perPage ?? transferAuditFilters.perPage,
        };
    } catch (error) {
        transferAuditError.value = messageFromUnknown(error, 'Unable to load transfer audit logs.');
        transferAuditLogs.value = [];
        transferAuditMeta.value = null;
    } finally {
        transferAuditLoading.value = false;
    }
}

async function openTransferAuditDialog(item: any) {
    transferAuditTarget.value = item;
    transferAuditDialogOpen.value = true;
    transferAuditFilters.q = '';
    transferAuditFilters.action = '';
    transferAuditFilters.actorType = '';
    transferAuditFilters.actorId = '';
    transferAuditFilters.from = '';
    transferAuditFilters.to = '';
    transferAuditFilters.page = 1;
    transferAuditFilters.perPage = 20;
    transferAuditError.value = null;
    transferAuditLogs.value = [];
    transferAuditMeta.value = null;
    if (!canViewTransferAudit.value) return;
    await loadTransferAuditLogs();
}

function applyTransferAuditFilters() {
    transferAuditFilters.page = 1;
    void loadTransferAuditLogs();
}

function resetTransferAuditFilters() {
    transferAuditFilters.q = '';
    transferAuditFilters.action = '';
    transferAuditFilters.actorType = '';
    transferAuditFilters.actorId = '';
    transferAuditFilters.from = '';
    transferAuditFilters.to = '';
    transferAuditFilters.page = 1;
    transferAuditFilters.perPage = 20;
    void loadTransferAuditLogs();
}

function goToTransferAuditPage(page: number) {
    transferAuditFilters.page = Math.max(page, 1);
    void loadTransferAuditLogs();
}

async function exportTransferAuditLogsCsv() {
    if (!detailsCase.value || !transferAuditTarget.value || !canViewTransferAudit.value || transferAuditExporting.value) {
        return;
    }
    transferAuditExporting.value = true;
    try {
        const url = new URL(
            `/api/v1/emergency-triage-cases/${detailsCase.value.id}/transfers/${transferAuditTarget.value.id}/audit-logs/export`,
            window.location.origin,
        );
        Object.entries(transferAuditQuery()).forEach(([key, value]) => {
            if (value === null || value === '') return;
            if (key === 'page' || key === 'perPage') return;
            url.searchParams.set(key, String(value));
        });
        window.open(url.toString(), '_blank', 'noopener');
    } finally {
        transferAuditExporting.value = false;
    }
}

onMounted(async () => {
    try {
        await Promise.all([loadPermissions(), loadScope()]);
        await Promise.all([
            loadQueue(),
            loadTransferLocationRegistry(),
            loadTransferClinicians(),
        ]);
        if (createForm.patientId.trim()) {
            void hydratePatientSummary(createForm.patientId);
        }
        if (searchForm.patientId.trim()) {
            void hydratePatientSummary(searchForm.patientId);
        }
    } finally {
        pageLoading.value = false;
    }
});
</script>

<template>
    <Head title="Emergency & Triage" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <!-- Page header -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="stethoscope" class="size-7 text-primary" />
                        Emergency & Triage
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        {{ emergencyWorkspaceDescription }}
                    </p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Popover>
                        <PopoverTrigger as-child>
                            <Button variant="outline" size="sm" class="h-8 px-2.5">
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
                        v-if="emergencyWorkspace === 'queue' && canRead"
                        variant="outline"
                        size="sm"
                        :disabled="queueLoading"
                        class="gap-1.5"
                        @click="loadQueue"
                    >
                        <AppIcon name="activity" class="size-3.5" />
                        {{ queueLoading ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                    <Button
                        v-if="emergencyWorkspace === 'create'"
                        variant="outline"
                        size="sm"
                        class="gap-1.5"
                        @click="openEmergencyWorkspace('queue')"
                    >
                        <AppIcon name="layout-list" class="size-3.5" />
                        Emergency Queue
                    </Button>
                    <Button
                        v-else-if="canCreate"
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="openEmergencyWorkspace('create')"
                    >
                        <AppIcon name="plus" class="size-3.5" />
                        Create triage intake
                    </Button>
                </div>
            </div>

            <Alert v-if="scopeWarning" variant="destructive">
                <AlertTitle>Scope warning</AlertTitle>
                <AlertDescription>{{ scopeWarning }}</AlertDescription>
            </Alert>

            <Alert v-if="emergencyWorkspace === 'queue' && queueError" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="circle-x" class="size-4" />
                    Queue load issue
                </AlertTitle>
                <AlertDescription>{{ queueError }}</AlertDescription>
            </Alert>

            <!-- Single column: queue card then create form -->
            <div class="flex min-w-0 flex-col gap-4">
                <!-- Emergency queue card -->
                <div v-if="emergencyWorkspace === 'queue'" class="min-w-0 space-y-3">
                    <div v-if="canRead" class="rounded-lg border bg-muted/30 px-3 py-2">
                        <div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                            <div class="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                                    :class="isEmergencySummaryFilterActive('waiting') ? 'border-primary bg-primary/10' : ''"
                                    @click="applyStatusFilter('waiting')"
                                >
                                    <span class="font-medium text-foreground">{{ queueCountLabel(counts.waiting) }}</span>
                                    <span class="text-muted-foreground">Waiting</span>
                                </button>
                                <button
                                    type="button"
                                    class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                                    :class="isEmergencySummaryFilterActive('triaged') ? 'border-primary bg-primary/10' : ''"
                                    @click="applyStatusFilter('triaged')"
                                >
                                    <span class="font-medium text-foreground">{{ queueCountLabel(counts.triaged) }}</span>
                                    <span class="text-muted-foreground">Triaged</span>
                                </button>
                                <button
                                    type="button"
                                    class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                                    :class="isEmergencySummaryFilterActive('in_treatment') ? 'border-primary bg-primary/10' : ''"
                                    @click="applyStatusFilter('in_treatment')"
                                >
                                    <span class="font-medium text-foreground">{{ queueCountLabel(counts.in_treatment) }}</span>
                                    <span class="text-muted-foreground">In treatment</span>
                                </button>
                                <button
                                    type="button"
                                    class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                                    :class="isEmergencySummaryFilterActive('admitted') ? 'border-primary bg-primary/10' : ''"
                                    @click="applyStatusFilter('admitted')"
                                >
                                    <span class="font-medium text-foreground">{{ queueCountLabel(counts.admitted) }}</span>
                                    <span class="text-muted-foreground">Admitted</span>
                                </button>
                                <button
                                    type="button"
                                    class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                                    :class="isEmergencySummaryFilterActive('discharged') ? 'border-primary bg-primary/10' : ''"
                                    @click="applyStatusFilter('discharged')"
                                >
                                    <span class="font-medium text-foreground">{{ queueCountLabel(counts.discharged) }}</span>
                                    <span class="text-muted-foreground">Discharged</span>
                                </button>
                                <button
                                    type="button"
                                    class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                                    :class="isEmergencySummaryFilterActive('cancelled') ? 'border-primary bg-primary/10' : ''"
                                    @click="applyStatusFilter('cancelled')"
                                >
                                    <span class="font-medium text-foreground">{{ queueCountLabel(counts.cancelled) }}</span>
                                    <span class="text-muted-foreground">Cancelled</span>
                                </button>
                            </div>

                            <div class="flex flex-wrap items-center gap-2">
                                <Button
                                    size="sm"
                                    class="h-8 gap-1.5"
                                    :variant="isEmergencyAcuityPresetActive('all') ? 'default' : 'outline'"
                                    @click="applyEmergencyAcuityPreset('all')"
                                >
                                    All cases
                                </Button>
                                <Button
                                    size="sm"
                                    class="h-8 gap-1.5"
                                    :variant="isEmergencyAcuityPresetActive('red') ? 'default' : 'outline'"
                                    @click="applyEmergencyAcuityPreset('red')"
                                >
                                    Emergency
                                </Button>
                                <Button
                                    size="sm"
                                    class="h-8 gap-1.5"
                                    :variant="isEmergencyAcuityPresetActive('yellow') ? 'default' : 'outline'"
                                    @click="applyEmergencyAcuityPreset('yellow')"
                                >
                                    Priority
                                </Button>
                                <Button
                                    size="sm"
                                    class="h-8 gap-1.5"
                                    :variant="isEmergencyAcuityPresetActive('green') ? 'default' : 'outline'"
                                    @click="applyEmergencyAcuityPreset('green')"
                                >
                                    Queue
                                </Button>
                            </div>
                        </div>
                    </div>

                    <Card v-if="canRead" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col">
                        <CardHeader class="shrink-0 gap-2 pb-2">
                            <div class="min-w-0 space-y-1">
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                                    Emergency queue
                                </CardTitle>
                                <CardDescription>
                                    {{ cases.length }} cases on this page &middot; Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                                </CardDescription>
                                <div
                                    v-if="searchForm.status || searchForm.triageLevel || queueFiltersActiveCount > 0"
                                    class="mt-2 flex flex-wrap items-center gap-2"
                                >
                                    <Badge v-if="searchForm.status || searchForm.triageLevel" variant="secondary">
                                        {{ emergencyQueueStateLabel }}
                                    </Badge>
                                    <Badge v-if="queueFiltersActiveCount > 0" variant="outline">
                                        {{ queueFiltersActiveCount }} filters
                                    </Badge>
                                </div>
                            </div>
                            <div class="flex w-full flex-col gap-2">
                                <div class="flex w-full flex-col gap-2 xl:flex-row xl:items-center">
                                    <div class="relative min-w-0 flex-1">
                                        <AppIcon
                                            name="search"
                                            class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                                        />
                                        <Input
                                            id="triage-q"
                                            v-model="searchForm.q"
                                            placeholder="Search case number or chief complaint"
                                            class="h-9 pl-9"
                                            @keyup.enter="submitSearch"
                                        />
                                    </div>
                                    <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap">
                                        <Button variant="outline" size="sm" class="hidden h-9 gap-1.5 md:inline-flex" @click="openQueueFiltersSheet">
                                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                                            All filters
                                        </Button>

                                        <Popover>
                                            <PopoverTrigger as-child>
                                                <Button variant="outline" size="sm" class="hidden h-9 gap-1.5 md:inline-flex">
                                                    <AppIcon name="eye" class="size-3.5" />
                                                    View
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent align="end" class="w-64 space-y-4 p-4">
                                                <div class="space-y-1">
                                                    <p class="text-sm font-medium">View</p>
                                                    <p class="text-xs text-muted-foreground">
                                                        Adjust page size and row density for the emergency queue.
                                                    </p>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label for="triage-per-page-popover">Results per page</Label>
                                                    <Select :model-value="String(searchForm.perPage)" @update:model-value="searchForm.perPage = Number($event)">
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
                                                    <div class="flex flex-wrap gap-2">
                                                        <Button size="sm" :variant="queueRowDensity === 'comfortable' ? 'default' : 'outline'" class="h-8" @click="queueRowDensity = 'comfortable'">Comfortable</Button>
                                                        <Button size="sm" :variant="queueRowDensity === 'compact' ? 'default' : 'outline'" class="h-8" @click="queueRowDensity = 'compact'">Compact</Button>
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>

                                        <Button variant="outline" size="sm" class="h-9 gap-1.5 md:hidden" @click="openQueueFiltersDrawer">
                                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                                            All filters
                                        </Button>
                                    </div>
                                </div>
                                <div v-if="queueActiveFilterChips.length > 0" class="flex flex-wrap items-center gap-2 border-t pt-2">
                                    <Badge v-for="chip in queueActiveFilterChips" :key="'emergency-queue-filter-' + chip" variant="outline">
                                        {{ chip }}
                                    </Badge>
                                    <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="resetFilters">
                                        Reset
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                            <div class="border-b bg-muted/10 p-4">
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="space-y-1">
                                        <p class="text-sm font-medium">Acuity-first board</p>
                                        <p class="text-xs text-muted-foreground">
                                            Prioritize Emergency (Red) cases first, then Priority (Yellow). This board reflects the current queue page and filter scope.
                                        </p>
                                    </div>
                                    <Badge variant="outline">
                                        {{ searchForm.triageLevel ? `Filtered to ${triageLevelDisplayLabel(searchForm.triageLevel)}` : 'All triage lanes' }}
                                    </Badge>
                                </div>
                                <div class="mt-3 grid gap-3 md:grid-cols-3">
                                    <button
                                        v-for="lane in acuityBoardLanes"
                                        :key="`acuity-lane-${lane.level}`"
                                        type="button"
                                        :class="['flex h-full min-w-0 flex-col rounded-lg border p-3 text-left transition-colors', acuityLaneClasses(lane.level, lane.active)]"
                                        @click="applyAcuityFilter(lane.level)"
                                    >
                                        <div class="flex items-start justify-between gap-2">
                                            <div>
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    {{ lane.label }}
                                                </p>
                                                <p class="mt-2 text-2xl font-semibold">
                                                    {{ lane.count }}
                                                </p>
                                            </div>
                                            <Badge :variant="acuityVariant(lane.level)">
                                                {{ lane.active ? 'Active' : 'Lane' }}
                                            </Badge>
                                        </div>
                                        <div :class="['mt-3 rounded-md border px-2.5 py-2', focusToneClasses(lane.focusTone)]">
                                            <p class="text-xs font-medium text-foreground">{{ lane.focusLabel }}</p>
                                            <p class="mt-1 text-[11px] text-muted-foreground">{{ lane.focusDescription }}</p>
                                        </div>
                                        <div class="mt-3 flex-1 space-y-2">
                                            <p v-if="lane.items.length === 0" class="text-xs text-muted-foreground">
                                                No cases on this page for {{ lane.label.toLowerCase() }}.
                                            </p>
                                            <div v-for="laneCase in lane.items" :key="laneCase.id" class="rounded-md border bg-background/80 px-2.5 py-2">
                                                <div class="flex items-start justify-between gap-2">
                                                    <p class="text-xs font-medium text-foreground">
                                                        {{ laneCase.caseNumber || 'Emergency Case' }}
                                                    </p>
                                                    <Badge :variant="statusVariant(laneCase.status)" class="shrink-0">
                                                        {{ formatEnumLabel(laneCase.status) }}
                                                    </Badge>
                                                </div>
                                                <p class="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                                    {{ laneCase.chiefComplaint || 'Chief complaint pending' }}
                                                </p>
                                                <p class="mt-1 text-[11px] text-muted-foreground">
                                                    {{ laneCase.arrivalAt ? `Arrived ${formatDateTime(laneCase.arrivalAt)}` : 'Arrival pending' }}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                            <ScrollArea class="min-h-0 flex-1">
                                <div class="min-h-[12rem] space-y-2 p-4">
                                    <div v-if="queueLoading && cases.length === 0" class="space-y-2">
                                        <div class="h-16 animate-pulse rounded-lg bg-muted" />
                                        <div class="h-16 animate-pulse rounded-lg bg-muted" />
                                    </div>
                                    <div v-else-if="cases.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No emergency triage cases found.</div>
                                    <div v-else class="space-y-2">
                                        <div v-for="item in cases" :key="item.id" :class="queueCaseRowClasses(item)">
                                            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                <div class="min-w-0 space-y-2">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <p class="truncate text-sm font-medium">{{ item.caseNumber || 'Emergency Triage Case' }}</p>
                                                        <Badge :variant="statusVariant(item.status)">{{ formatEnumLabel(item.status) }}</Badge>
                                                        <Badge :variant="acuityVariant(item.triageLevel)">{{ triageLevelDisplayLabel(item.triageLevel) }}</Badge>
                                                    </div>
                                                    <p v-if="item.patientId" class="line-clamp-1 text-xs text-muted-foreground">
                                                        {{ patientContextLabel(item.patientId) }}
                                                        <span v-if="patientContextMeta(item.patientId)">| {{ patientContextMeta(item.patientId) }}</span>
                                                    </p>
                                                    <p class="line-clamp-1 text-sm text-foreground">{{ queueCasePreviewLabel(item) }}</p>
                                                    <p v-if="queueCaseMetaLabel(item)" class="text-xs text-muted-foreground">{{ queueCaseMetaLabel(item) }}</p>
                                                    <div :class="['flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-2 text-xs', queueCaseFocusStripClasses(item)]">
                                                        <span class="font-medium text-foreground">{{ queueCaseFocus(item).label }}</span>
                                                        <span class="text-muted-foreground">{{ queueCaseFocus(item).description }}</span>
                                                    </div>
                                                </div>
                                                <div class="flex flex-wrap items-center gap-2 lg:max-w-[19rem] lg:justify-end">
                                                    <Button size="sm" variant="outline" class="gap-1.5" @click="openDetails(item)"><AppIcon name="eye" class="size-3.5" />{{ queueDetailsActionLabel }}</Button>
                                                    <Button v-if="canUpdateStatus && item.status === 'waiting'" size="sm" variant="outline" class="gap-1.5" :disabled="actionLoadingId === item.id" @click="openStatusDialog(item,'triaged')">Mark triaged</Button>
                                                    <Button v-if="canUpdateStatus && (item.status === 'waiting' || item.status === 'triaged')" size="sm" class="gap-1.5" :disabled="actionLoadingId === item.id" @click="openStatusDialog(item,'in_treatment')">Start treatment</Button>
                                                    <Button v-if="canUpdateStatus && item.status === 'in_treatment'" size="sm" class="gap-1.5" :disabled="actionLoadingId === item.id" @click="openStatusDialog(item,'admitted')">Admit</Button>
                                                    <Button v-if="canUpdateStatus && item.status === 'in_treatment'" size="sm" variant="outline" class="gap-1.5" :disabled="actionLoadingId === item.id" @click="openStatusDialog(item,'discharged')">Discharge</Button>
                                                    <Button v-if="canUpdateStatus && item.status !== 'admitted' && item.status !== 'discharged' && item.status !== 'cancelled'" size="sm" variant="destructive" class="gap-1.5" :disabled="actionLoadingId === item.id" @click="openStatusDialog(item,'cancelled')"><AppIcon name="circle-x" class="size-3.5" />Cancel</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
                                <p class="text-xs text-muted-foreground">Showing {{ cases.length }} cases &middot; Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}</p>
                                <div class="flex items-center gap-2">
                                    <Button variant="outline" size="sm" class="gap-1.5" :disabled="!pagination || pagination.currentPage <= 1 || queueLoading" @click="prevPage"><AppIcon name="chevron-left" class="size-3.5" />Previous</Button>
                                    <Button variant="outline" size="sm" class="gap-1.5" :disabled="!pagination || pagination.currentPage >= pagination.lastPage || queueLoading" @click="nextPage"><AppIcon name="chevron-right" class="size-3.5" />Next</Button>
                                </div>
                            </footer>
                        </CardContent>
                    </Card>
                    <Card v-else-if="pageLoading" class="rounded-lg border-sidebar-border/70">
                        <CardHeader>
                            <CardTitle class="flex items-center gap-2"><AppIcon name="shield-check" class="size-4 text-muted-foreground" />Emergency queue</CardTitle>
                            <CardDescription>Checking access and scope.</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-2">
                            <div class="h-16 animate-pulse rounded-lg bg-muted" />
                            <div class="h-16 animate-pulse rounded-lg bg-muted" />
                        </CardContent>
                    </Card>
                    <Card v-else class="rounded-lg border-sidebar-border/70">
                        <CardHeader>
                            <CardTitle class="flex items-center gap-2"><AppIcon name="shield-check" class="size-4 text-muted-foreground" />Emergency queue</CardTitle>
                            <CardDescription>You do not have read permission.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Alert variant="destructive">
                                <AlertTitle class="flex items-center gap-2"><AppIcon name="shield-check" class="size-4" />Read access restricted</AlertTitle>
                                <AlertDescription>Request <code>emergency.triage.read</code> permission.</AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </div>

                <!-- Create triage intake card -->
                <Card v-if="emergencyWorkspace === 'create' && canCreate" id="create-triage-intake" class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2"><AppIcon name="plus" class="size-5 text-muted-foreground" />Create triage intake</CardTitle>
                        <CardDescription>Register a new emergency triage case.</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-6">
                        <Alert v-if="createMessage"><AlertTitle class="flex items-center gap-2"><AppIcon name="check-circle" class="size-4" />Created</AlertTitle><AlertDescription>{{ createMessage }}</AlertDescription></Alert>
                        <div class="rounded-lg border bg-muted/10 p-4">
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Patient & triage context</p>
                                    <p class="text-xs text-muted-foreground">
                                        {{ createContextSummaryLine }}
                                    </p>
                                </div>
                                <Button
                                    id="triage-open-context-dialog"
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    @click="openCreateContextDialog(hasCreateAppointmentContext ? 'appointment' : hasCreateAdmissionContext ? 'admission' : 'patient')"
                                >
                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                    Review or change context
                                </Button>
                            </div>
                            <div class="mt-4 grid gap-2 lg:grid-cols-3">
                                <div
                                    class="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2"
                                    :class="createForm.patientId ? 'border-primary/30 bg-primary/5' : 'bg-background/80'"
                                >
                                    <AppIcon name="user" class="size-3.5 shrink-0 text-muted-foreground" />
                                    <div class="min-w-0 flex-1">
                                        <div class="flex min-w-0 items-center gap-2">
                                            <span class="shrink-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                                Patient
                                            </span>
                                            <span class="truncate text-sm font-medium" :title="createPatientContextMeta">
                                                {{ createPatientContextLabel }}
                                            </span>
                                        </div>
                                        <p class="truncate text-xs text-muted-foreground">
                                            {{ createPatientContextMeta }}
                                        </p>
                                    </div>
                                </div>

                                <div
                                    class="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2"
                                    :class="hasCreateAppointmentContext ? 'border-primary/30 bg-primary/5' : 'bg-background/80'"
                                >
                                    <AppIcon name="calendar-clock" class="size-3.5 shrink-0 text-muted-foreground" />
                                    <div class="min-w-0 flex-1">
                                        <div class="flex min-w-0 items-center gap-2">
                                            <span class="shrink-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                                Appointment
                                            </span>
                                            <span class="truncate text-sm font-medium" :title="createAppointmentContextMeta">
                                                {{ createAppointmentContextLabel }}
                                            </span>
                                        </div>
                                        <p class="truncate text-xs text-muted-foreground">
                                            {{ createAppointmentContextMeta }}
                                        </p>
                                    </div>
                                    <Badge
                                        v-if="createAppointmentContextStatusLabel"
                                        :variant="createAppointmentContextStatusVariant"
                                        class="shrink-0 text-[10px]"
                                    >
                                        {{ createAppointmentContextStatusLabel }}
                                    </Badge>
                                </div>

                                <div
                                    class="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2"
                                    :class="hasCreateAdmissionContext ? 'border-primary/30 bg-primary/5' : 'bg-background/80'"
                                >
                                    <AppIcon name="bed-double" class="size-3.5 shrink-0 text-muted-foreground" />
                                    <div class="min-w-0 flex-1">
                                        <div class="flex min-w-0 items-center gap-2">
                                            <span class="shrink-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                                Admission
                                            </span>
                                            <span class="truncate text-sm font-medium" :title="createAdmissionContextMeta">
                                                {{ createAdmissionContextLabel }}
                                            </span>
                                        </div>
                                        <p class="truncate text-xs text-muted-foreground">
                                            {{ createAdmissionContextMeta }}
                                        </p>
                                    </div>
                                    <Badge
                                        v-if="createAdmissionContextStatusLabel"
                                        :variant="createAdmissionContextStatusVariant"
                                        class="shrink-0 text-[10px]"
                                    >
                                        {{ createAdmissionContextStatusLabel }}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Arrival & triage</p>
                            <div class="grid gap-3 sm:grid-cols-2">
                                <div class="grid gap-2"><Label for="triage-create-arrival">Arrival at</Label><Input id="triage-create-arrival" v-model="createForm.arrivalAt" type="datetime-local" /></div>
                                <div class="grid gap-2"><Label for="triage-create-level">Triage level</Label><Select v-model="createForm.triageLevel"><SelectTrigger class="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="option in triageLevelOptions" :key="option" :value="option">{{ triageLevelDisplayLabel(option) }}</SelectItem></SelectContent></Select></div>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Chief complaint & vitals</p>
                            <div class="grid gap-3">
                                <div class="grid gap-2"><Label for="triage-create-chief-complaint">Chief complaint</Label><Input id="triage-create-chief-complaint" v-model="createForm.chiefComplaint" placeholder="Brief description" /><p v-if="createFieldError('chiefComplaint')" class="text-xs text-destructive">{{ createFieldError('chiefComplaint') }}</p></div>
                                <div class="grid gap-2"><Label for="triage-create-vitals">Vitals summary</Label><Textarea id="triage-create-vitals" v-model="createForm.vitalsSummary" rows="3" class="resize-y rounded-lg" placeholder="Optional" /></div>
                            </div>
                        </div>
                        <Separator />
                        <div class="flex flex-wrap items-center justify-end gap-2">
                            <Button v-if="createFeedbackVisible" variant="outline" class="gap-1.5" @click="clearCreateFeedback">
                                Dismiss alerts
                            </Button>
                            <Button variant="outline" class="gap-1.5" @click="openEmergencyWorkspace('queue')">Back to queue</Button>
                            <Button :disabled="createSubmitting" class="gap-1.5" @click="submitCreate"><AppIcon name="plus" class="size-3.5" />{{ createSubmitting ? 'Creating...' : 'Create triage intake' }}</Button>
                        </div>
                    </CardContent>
                </Card>
                <Card v-else-if="emergencyWorkspace === 'create'" class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2"><AppIcon name="plus" class="size-5 text-muted-foreground" />Create triage intake</CardTitle>
                        <CardDescription>You do not have create permission.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle class="flex items-center gap-2"><AppIcon name="shield-check" class="size-4" />Create access restricted</AlertTitle>
                            <AlertDescription>Request <code>emergency.triage.create</code> permission.</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

            </div>

            <Sheet :open="queueFiltersSheetOpen" @update:open="queueFiltersSheetOpen = $event">
                <SheetContent side="right" variant="action" size="lg">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2"><AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />All filters</SheetTitle>
                        <SheetDescription>
                            Use advanced filters for patient context. Search and queue shortcuts stay in the main toolbar.
                        </SheetDescription>
                    </SheetHeader>
                    <div class="grid gap-4 px-4 py-4">
                            <div class="rounded-lg border bg-muted/20 p-4">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Context filters</p>
                                    <p class="text-xs text-muted-foreground">Narrow the queue to a single patient when needed.</p>
                                </div>
                                <div class="mt-4">
                                    <PatientLookupField
                                        input-id="triage-patient-sheet"
                                        v-model="queueDraftPatientId"
                                        label="Patient filter"
                                        mode="filter"
                                        placeholder="Patient name or number"
                                    />
                                </div>
                            </div>
                            <div class="rounded-lg border bg-background p-4">
                                <p class="text-sm font-medium">Main-row filters</p>
                                <p class="mt-1 text-xs text-muted-foreground">These stay visible on the queue header while you work.</p>
                                <div class="mt-3 flex flex-wrap gap-2">
                                    <Badge variant="outline">{{ searchForm.q.trim() ? `Search: ${searchForm.q.trim()}` : 'No search' }}</Badge>
                                    <Badge variant="outline">{{ searchForm.status ? `Status: ${formatEnumLabel(searchForm.status)}` : 'All statuses' }}</Badge>
                                    <Badge variant="outline">{{ searchForm.triageLevel ? `Triage: ${triageLevelDisplayLabel(searchForm.triageLevel)}` : 'All triage levels' }}</Badge>
                                </div>
                            </div>
                    </div>
                    <SheetFooter class="gap-2">
                        <Button variant="outline" @click="resetQueueAdvancedFilters">Reset</Button>
                        <Button :disabled="queueLoading" @click="applyQueueAdvancedFilters">Apply filters</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Dialog :open="createContextDialogOpen" @update:open="createContextDialogOpen = $event">
                <DialogContent variant="form" size="4xl" class="overflow-visible">
                    <DialogHeader class="sticky top-0 z-10 shrink-0 border-b bg-background px-6 py-4">
                        <DialogTitle class="flex items-center gap-2">
                            <AppIcon name="search" class="size-4 text-muted-foreground" />
                            Review or change context
                        </DialogTitle>
                        <DialogDescription>
                            Select the patient and linked visit context for this emergency intake.
                        </DialogDescription>
                    </DialogHeader>

                    <div class="max-h-[calc(90vh-6rem)] space-y-4 overflow-y-auto px-6 py-4">
                        <div class="flex flex-wrap gap-2">
                            <Button
                                v-if="createForm.appointmentId"
                                type="button"
                                variant="outline"
                                size="sm"
                                class="gap-1.5"
                                @click="clearCreateAppointmentLink()"
                            >
                                Unlink appointment
                            </Button>
                            <Button
                                v-if="createForm.admissionId"
                                type="button"
                                variant="outline"
                                size="sm"
                                class="gap-1.5"
                                @click="clearCreateAdmissionLink()"
                            >
                                Unlink admission
                            </Button>
                        </div>

                        <Tabs v-model="createContextEditorTab" class="w-full">
                            <TabsList class="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
                                <TabsTrigger value="patient" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"><AppIcon name="user" class="size-3.5" />Patient</TabsTrigger>
                                <TabsTrigger value="appointment" :disabled="!createForm.patientId.trim()" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"><AppIcon name="calendar-clock" class="size-3.5" />Appointment</TabsTrigger>
                                <TabsTrigger value="admission" :disabled="!createForm.patientId.trim()" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"><AppIcon name="bed-double" class="size-3.5" />Admission</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div class="rounded-lg border bg-muted/20 p-4">
                            <div v-show="createContextEditorTab === 'patient'" class="grid gap-3">
                                <PatientLookupField
                                    input-id="triage-create-patient-id"
                                    v-model="createForm.patientId"
                                    label="Patient"
                                    placeholder="Search patient by name, patient number, phone, email, or national ID"
                                    helper-text="Select the patient for this emergency intake."
                                    :error-message="createFieldError('patientId')"
                                    patient-status="active"
                                    @selected="handleCreatePatientSelected"
                                />
                            </div>
                            <div v-show="createContextEditorTab === 'appointment'" class="grid gap-3">
                                <Alert v-if="!createForm.patientId" variant="destructive">
                                    <AlertTitle>Select patient first</AlertTitle>
                                    <AlertDescription>Choose the patient before linking appointment context.</AlertDescription>
                                </Alert>
                                <LinkedContextLookupField
                                    v-else
                                    input-id="triage-create-appointment-id"
                                    v-model="createForm.appointmentId"
                                    :patient-id="createForm.patientId"
                                    label="Appointment Link"
                                    resource="appointments"
                                    placeholder="Search linked appointment by number or department"
                                    helper-text="Optional. Link the checked-in appointment that started this emergency intake."
                                    :error-message="createFieldError('appointmentId')"
                                    status="checked_in"
                                    @selected="closeCreateContextDialogAfterSelection('appointmentId', $event)"
                                />
                            </div>
                            <div v-show="createContextEditorTab === 'admission'" class="grid gap-3">
                                <Alert v-if="!createForm.patientId" variant="destructive">
                                    <AlertTitle>Select patient first</AlertTitle>
                                    <AlertDescription>Choose the patient before linking admission context.</AlertDescription>
                                </Alert>
                                <LinkedContextLookupField
                                    v-else
                                    input-id="triage-create-admission-id"
                                    v-model="createForm.admissionId"
                                    :patient-id="createForm.patientId"
                                    label="Admission Link"
                                    resource="admissions"
                                    placeholder="Search linked admission by number or ward"
                                    helper-text="Optional. Link the admission when this emergency case belongs to an inpatient stay."
                                    :error-message="createFieldError('admissionId')"
                                    @selected="closeCreateContextDialogAfterSelection('admissionId', $event)"
                                />
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <!-- Mobile filters drawer -->
            <Drawer :open="mobileFiltersDrawerOpen" @update:open="mobileFiltersDrawerOpen = $event">
                <DrawerContent class="max-h-[90vh]">
                    <DrawerHeader>
                        <DrawerTitle class="flex items-center gap-2"><AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />All filters</DrawerTitle>
                        <DrawerDescription>
                            Use advanced filters for patient context. Search and queue shortcuts stay in the main toolbar.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
                        <div class="rounded-lg border bg-muted/20 p-4">
                            <div class="space-y-1">
                                <p class="text-sm font-medium">Context filters</p>
                                <p class="text-xs text-muted-foreground">Narrow the queue to a single patient when needed.</p>
                            </div>
                            <div class="mt-4">
                                <PatientLookupField
                                    input-id="triage-patient-drawer"
                                    v-model="queueDraftPatientId"
                                    label="Patient filter"
                                    mode="filter"
                                    placeholder="Patient name or number"
                                />
                            </div>
                        </div>
                        <div class="rounded-lg border bg-background p-4">
                            <p class="text-sm font-medium">Main-row filters</p>
                            <p class="mt-1 text-xs text-muted-foreground">These stay visible on the queue header while you work.</p>
                            <div class="mt-3 flex flex-wrap gap-2">
                                <Badge variant="outline">{{ searchForm.q.trim() ? `Search: ${searchForm.q.trim()}` : 'No search' }}</Badge>
                                <Badge variant="outline">{{ searchForm.status ? `Status: ${formatEnumLabel(searchForm.status)}` : 'All statuses' }}</Badge>
                                <Badge variant="outline">{{ searchForm.triageLevel ? `Triage: ${triageLevelDisplayLabel(searchForm.triageLevel)}` : 'All triage levels' }}</Badge>
                            </div>
                        </div>
                    </div>
                    <DrawerFooter class="gap-2">
                        <Button class="gap-1.5" :disabled="queueLoading" @click="applyQueueAdvancedFilters"><AppIcon name="search" class="size-3.5" />Apply filters</Button>
                        <Button variant="outline" @click="resetQueueAdvancedFilters">Reset</Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
            <Sheet :open="detailsOpen" @update:open="(open) => (detailsOpen = open)">
                <SheetContent side="right" variant="workspace">
                    <div class="flex h-full flex-col">
                        <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                            <div class="flex flex-col gap-4">
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="space-y-1">
                                        <SheetTitle class="flex items-center gap-2 text-xl">
                                            <AppIcon name="stethoscope" class="size-5 text-primary" />
                                            {{ detailsCase?.caseNumber || 'Emergency case details' }}
                                        </SheetTitle>
                                        <p v-if="detailsCase?.patientId" class="text-sm font-medium text-foreground">
                                            {{ patientContextLabel(detailsCase.patientId) }}
                                        </p>
                                        <p v-if="patientContextMeta(detailsCase?.patientId)" class="text-xs text-muted-foreground">
                                            {{ patientContextMeta(detailsCase?.patientId) }}
                                        </p>
                                        <SheetDescription>
                                            {{ detailsCase?.chiefComplaint || 'Chief complaint and emergency routing summary.' }}
                                        </SheetDescription>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Badge v-if="detailsCase?.status" :variant="statusVariant(detailsCase.status)">
                                            {{ formatEnumLabel(detailsCase.status) }}
                                        </Badge>
                                        <Badge v-if="detailsCase?.triageLevel" :variant="acuityVariant(detailsCase.triageLevel)">
                                            {{ triageLevelDisplayLabel(detailsCase.triageLevel) }}
                                        </Badge>
                                        <Badge variant="outline">
                                            {{ patientContextMeta(detailsCase?.patientId) || (detailsCase?.patientId ? 'Chart linked' : 'Patient pending') }}
                                        </Badge>
                                    </div>
                                </div>
                                <div class="grid gap-3 sm:grid-cols-3">
                                    <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Arrived</p>
                                        <p class="mt-1 text-sm font-medium">{{ formatDateTime(detailsCase?.arrivalAt || detailsCase?.createdAt) }}</p>
                                    </div>
                                    <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Triaged</p>
                                        <p class="mt-1 text-sm font-medium">{{ formatDateTime(detailsCase?.triagedAt) }}</p>
                                    </div>
                                    <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Latest routing</p>
                                        <p class="mt-1 text-sm font-medium">
                                            {{ detailsLatestTransfer ? `${formatEnumLabel(detailsLatestTransfer.status)} ${formatEnumLabel(detailsLatestTransfer.transferType)}` : 'No transfer recorded' }}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </SheetHeader>

                        <div class="min-h-0 flex-1">
                            <ScrollArea class="h-full">
                                <div class="space-y-6 px-6 py-5">
                                    <div v-if="detailsCaseLoading" class="space-y-4">
                                        <Skeleton class="h-28 rounded-lg" />
                                        <div class="grid gap-4 lg:grid-cols-3">
                                            <Skeleton class="h-64 rounded-lg lg:col-span-2" />
                                            <Skeleton class="h-64 rounded-lg" />
                                        </div>
                                        <Skeleton class="h-56 rounded-lg" />
                                    </div>

                                    <Alert v-else-if="detailsCaseError" variant="destructive">
                                        <AlertTitle>Details unavailable</AlertTitle>
                                        <AlertDescription>{{ detailsCaseError }}</AlertDescription>
                                    </Alert>

                                    <Alert v-else-if="!detailsCase" variant="destructive">
                                        <AlertTitle>No case selected</AlertTitle>
                                        <AlertDescription>Select an emergency case from the queue to review details.</AlertDescription>
                                    </Alert>

                                    <Tabs v-else v-model="detailsSheetTab" class="space-y-6">
                                        <TabsList class="grid w-full grid-cols-3 md:w-auto">
                                            <TabsTrigger value="overview">Overview</TabsTrigger>
                                            <TabsTrigger value="workflows">Workflows</TabsTrigger>
                                            <TabsTrigger value="audit">Audit</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="overview" class="space-y-6">
                                            <div class="grid gap-6 lg:grid-cols-3">
                                                <div class="space-y-6 lg:col-span-2">
                                                    <Card class="rounded-lg border-sidebar-border/70">
                                                        <CardHeader>
                                                            <CardTitle class="flex items-center gap-2">
                                                                <AppIcon name="activity" class="size-4 text-muted-foreground" />
                                                                Emergency handoff
                                                            </CardTitle>
                                                            <CardDescription>Core acuity, status, and routing summary for the receiving care team.</CardDescription>
                                                        </CardHeader>
                                                        <CardContent class="space-y-4">
                                                            <div class="flex flex-wrap items-center gap-2">
                                                                <Badge :variant="statusVariant(detailsCase.status)">{{ formatEnumLabel(detailsCase.status) }}</Badge>
                                                                <Badge :variant="acuityVariant(detailsCase.triageLevel)">{{ triageLevelDisplayLabel(detailsCase.triageLevel) }}</Badge>
                                                                <Badge variant="outline">
                                                                    {{ detailsCase.completedAt ? 'Disposition complete' : 'Disposition active' }}
                                                                </Badge>
                                                            </div>
                                                            <div class="grid gap-3 sm:grid-cols-3">
                                                                <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Arrival</p>
                                                                    <p class="mt-1 text-sm font-medium">{{ formatDateTime(detailsCase.arrivalAt || detailsCase.createdAt) }}</p>
                                                                </div>
                                                                <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Triage recorded</p>
                                                                    <p class="mt-1 text-sm font-medium">{{ formatDateTime(detailsCase.triagedAt) }}</p>
                                                                </div>
                                                                <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Case completed</p>
                                                                    <p class="mt-1 text-sm font-medium">{{ formatDateTime(detailsCase.completedAt) }}</p>
                                                                </div>
                                                            </div>
                                                            <div class="rounded-lg border bg-background px-4 py-3">
                                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Disposition notes</p>
                                                                <p class="mt-2 text-sm text-foreground">
                                                                    {{ detailsCase.dispositionNotes || 'Disposition notes have not been documented yet.' }}
                                                                </p>
                                                            </div>
                                                        </CardContent>
                                                    </Card>

                                                    <Card class="rounded-lg border-sidebar-border/70">
                                                        <CardHeader>
                                                            <CardTitle class="flex items-center gap-2">
                                                                <AppIcon name="users" class="size-4 text-muted-foreground" />
                                                                Patient & encounter context
                                                            </CardTitle>
                                                            <CardDescription>Keep the patient handoff and linked encounter context visible in one place.</CardDescription>
                                                        </CardHeader>
                                                        <CardContent class="grid gap-3 sm:grid-cols-2">
                                                            <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Patient</p>
                                                                <div class="mt-2 flex items-start justify-between gap-2">
                                                                    <div class="min-w-0">
                                                                        <p class="truncate text-sm font-medium">
                                                                            {{ patientContextLabel(detailsCase.patientId) }}
                                                                        </p>
                                                                        <p v-if="patientContextMeta(detailsCase.patientId)" class="mt-1 truncate text-xs text-muted-foreground">
                                                                            {{ patientContextMeta(detailsCase.patientId) }}
                                                                        </p>
                                                                    </div>
                                                                    <Button v-if="detailsCase.patientId" size="sm" variant="ghost" class="h-7 px-2 text-xs" as-child>
                                                                        <Link :href="buildContextHref('/patients', { patientId: detailsCase.patientId })">Open</Link>
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assigned clinician</p>
                                                                <p class="mt-2 text-sm font-medium">
                                                                    {{ detailsCase.assignedClinicianUserId ? 'Clinician assignment recorded' : 'Not assigned' }}
                                                                </p>
                                                            </div>
                                                            <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Appointment link</p>
                                                                <div class="mt-2 flex items-center justify-between gap-2">
                                                                    <p class="text-sm font-medium">
                                                                        {{ detailsCase.appointmentId ? 'Appointment linked' : 'No appointment linked' }}
                                                                    </p>
                                                                    <Button v-if="detailsCase.appointmentId" size="sm" variant="ghost" class="h-7 px-2 text-xs" as-child>
                                                                        <Link :href="buildContextHref('/appointments', { appointmentId: detailsCase.appointmentId, patientId: detailsCase.patientId })">Open</Link>
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admission link</p>
                                                                <div class="mt-2 flex items-center justify-between gap-2">
                                                                    <p class="text-sm font-medium">
                                                                        {{ detailsCase.admissionId ? 'Admission linked' : 'No admission linked' }}
                                                                    </p>
                                                                    <Button v-if="detailsCase.admissionId" size="sm" variant="ghost" class="h-7 px-2 text-xs" as-child>
                                                                        <Link :href="buildContextHref('/admissions', { admissionId: detailsCase.admissionId, patientId: detailsCase.patientId })">Open</Link>
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>

                                                </div>

                                                <div class="space-y-6">
                                                    <Card :class="['rounded-lg border-sidebar-border/70', focusToneClasses(detailsCurrentFocus.tone)]">
                                                        <CardHeader>
                                                            <CardTitle class="flex items-center gap-2">
                                                                <AppIcon name="alert-triangle" class="size-4 text-muted-foreground" />
                                                                {{ detailsFocusCardHeading }}
                                                            </CardTitle>
                                                            <CardDescription>{{ detailsCurrentFocus.title }}</CardDescription>
                                                        </CardHeader>
                                                        <CardContent class="space-y-4">
                                                            <p class="text-sm text-muted-foreground">{{ detailsCurrentFocus.description }}</p>
                                                            <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                                                                <div v-for="card in detailsWorkflowSummaryCards" :key="'details-workflow-summary-' + card.label" class="rounded-lg border bg-background px-3 py-2.5">
                                                                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{{ card.label }}</p>
                                                                    <p class="mt-1 text-sm font-medium leading-5 text-foreground">{{ card.value }}</p>
                                                                </div>
                                                            </div>
                                                            <p v-if="!canUpdateStatus" class="text-xs text-muted-foreground">
                                                                Status progression is limited to emergency staff with update access.
                                                            </p>
                                                            <Button
                                                                v-if="detailsPrimaryStatusAction"
                                                                class="w-full gap-1.5"
                                                                @click="openStatusDialog(detailsCase, detailsPrimaryStatusAction.action)"
                                                            >
                                                                <AppIcon :name="detailsPrimaryStatusAction.icon" class="size-3.5" />
                                                                {{ detailsPrimaryStatusAction.label }}
                                                            </Button>
                                                        </CardContent>
                                                    </Card>

                                                </div>
                                            </div>

                                            <div class="grid gap-3 md:grid-cols-3">
                                                <Card v-for="card in [
                                                    { label: 'Transfers', value: detailsTransferCounts.total },
                                                    { label: 'Critical handoff', value: detailsAmbulanceHandoff ? 'Ready' : 'None' },
                                                    { label: 'Audit events', value: detailsAuditMeta?.total ?? detailsAuditLogs.length },
                                                ]" :key="card.label" class="rounded-lg border-sidebar-border/70">
                                                    <CardContent class="px-4 py-3">
                                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ card.label }}</p>
                                                        <p class="mt-2 text-lg font-semibold">{{ card.value }}</p>
                                                    </CardContent>
                                                </Card>
                                            </div>

                                            <Card class="rounded-lg border-sidebar-border/70">
                                                <CardHeader>
                                                    <CardTitle class="flex items-center gap-2">
                                                        <AppIcon name="file-text" class="size-4 text-muted-foreground" />
                                                        Clinical indication & reporting
                                                    </CardTitle>
                                                    <CardDescription>Chief complaint, triage observation, and reporting handoff for downstream emergency care.</CardDescription>
                                                </CardHeader>
                                                <CardContent class="grid gap-4 lg:grid-cols-2">
                                                    <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chief complaint</p>
                                                        <p class="mt-2 text-sm text-foreground">{{ detailsCase.chiefComplaint || 'Not documented.' }}</p>
                                                    </div>
                                                    <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vitals summary</p>
                                                        <p class="mt-2 whitespace-pre-wrap text-sm text-foreground">{{ detailsCase.vitalsSummary || 'Vitals summary has not been captured yet.' }}</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </TabsContent>

                                        <TabsContent value="workflows" class="space-y-6">
                                            <div class="grid gap-6 lg:grid-cols-3">
                                                <div class="space-y-6 lg:col-span-2">
                                                    <Card class="rounded-lg border-sidebar-border/70">
                                                        <CardHeader>
                                                            <CardTitle class="flex items-center gap-2">
                                                                <AppIcon name="activity" class="size-4 text-muted-foreground" />
                                                                Emergency workflow timeline
                                                            </CardTitle>
                                                            <CardDescription>Shows the completed and current emergency workflow steps for this case, not future stages that have not happened yet.</CardDescription>
                                                        </CardHeader>
                                                        <CardContent>
                                                            <div class="space-y-4">
                                                                <div
                                                                    v-for="(event, index) in detailsResuscitationTimeline"
                                                                    :key="event.id"
                                                                    class="relative pl-8"
                                                                >
                                                                    <span
                                                                        v-if="index < detailsResuscitationTimeline.length - 1"
                                                                        class="absolute left-[11px] top-7 h-[calc(100%+0.75rem)] w-px bg-border"
                                                                    />
                                                                    <span :class="['absolute left-0 top-1 flex size-6 items-center justify-center rounded-full text-white', timelineToneClasses(event.tone)]">
                                                                        <AppIcon :name="event.icon" class="size-3.5" />
                                                                    </span>
                                                                    <div class="rounded-lg border bg-background px-4 py-3">
                                                                        <div class="flex flex-wrap items-center justify-between gap-2">
                                                                            <p class="text-sm font-medium">{{ event.title }}</p>
                                                                            <Badge :variant="event.pending || event.tone === 'muted' ? 'outline' : 'secondary'">
                                                                                {{ event.badgeLabel ?? (event.pending ? 'Pending' : formatDateTime(event.at)) }}
                                                                            </Badge>
                                                                        </div>
                                                                        <p class="mt-2 text-sm text-muted-foreground">{{ event.description }}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>

                                                    <Card class="rounded-lg border-sidebar-border/70">
                                                        <CardHeader>
                                                            <CardTitle class="flex items-center gap-2">
                                                                <AppIcon name="layout-list" class="size-4 text-muted-foreground" />
                                                                Transfer orchestration
                                                            </CardTitle>
                                                            <CardDescription>Manage intra-facility and ambulance handoffs without leaving the emergency case.</CardDescription>
                                                        </CardHeader>
                                                        <CardContent class="space-y-5">
                                                            <div class="flex flex-wrap gap-2">
                                                                <Button
                                                                    v-for="status in transferStatusOptions"
                                                                    :key="`workflow-transfer-status-${status}`"
                                                                    size="sm"
                                                                    :variant="detailsTransferFilters.status === status ? 'default' : 'outline'"
                                                                    class="h-8 gap-1.5"
                                                                    @click="setTransferStatusFilter(status)"
                                                                >
                                                                    <span class="font-medium">{{ detailsTransferCounts[status] ?? 0 }}</span>
                                                                    <span>{{ formatEnumLabel(status) }}</span>
                                                                </Button>
                                                            </div>

                                                            <div :class="['rounded-lg border px-4 py-3', focusToneClasses(detailsTransferPrimarySummary.tone)]">
                                                                <p class="text-sm font-medium text-foreground">{{ detailsTransferPrimarySummary.title }}</p>
                                                                <p class="mt-1 text-sm text-muted-foreground">{{ detailsTransferPrimarySummary.description }}</p>
                                                            </div>

                                                            <div class="grid gap-3 sm:grid-cols-3">
                                                                <div v-for="card in detailsTransferWatchCards" :key="card.label" :class="['rounded-lg border px-4 py-3', focusToneClasses(card.tone)]">
                                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ card.label }}</p>
                                                                    <p class="mt-2 text-lg font-semibold text-foreground">{{ card.value }}</p>
                                                                    <p class="mt-1 text-xs text-muted-foreground">{{ card.description }}</p>
                                                                </div>
                                                            </div>

                                                            <div class="grid gap-3 rounded-lg border bg-muted/20 p-4 lg:grid-cols-4">
                                                                <div class="grid gap-2 lg:col-span-2">
                                                                    <Label for="details-transfer-q">Search transfers</Label>
                                                                    <Input id="details-transfer-q" v-model="detailsTransferFilters.q" placeholder="Transfer number, destination, handoff..." @keyup.enter="applyTransferFilters" />
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <Label for="details-transfer-type">Transfer type</Label>
                                                                    <Select v-model="detailsTransferFilters.transferType">
                                                                        <SelectTrigger class="w-full">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                        <SelectItem value="">All</SelectItem>
                                                                        <SelectItem v-for="option in transferTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <Label for="details-transfer-priority">Priority</Label>
                                                                    <Select v-model="detailsTransferFilters.priority">
                                                                        <SelectTrigger class="w-full">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                        <SelectItem value="">All</SelectItem>
                                                                        <SelectItem v-for="option in transferPriorityOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div class="flex flex-wrap items-end gap-2 lg:col-span-4">
                                                                    <Button size="sm" class="gap-1.5" :disabled="detailsTransferLoading" @click="applyTransferFilters">
                                                                        <AppIcon name="search" class="size-3.5" />
                                                                        Search
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" :disabled="detailsTransferLoading" @click="resetTransferFilters">Reset</Button>
                                                                </div>
                                                            </div>

                                                            <div v-if="canManageTransfers" class="grid gap-3 rounded-lg border bg-background p-4 lg:grid-cols-2">
                                                                <div class="grid gap-2">
                                                                    <Label for="transfer-create-type">Transfer type</Label>
                                                                    <Select v-model="transferCreateForm.transferType">
                                                                        <SelectTrigger class="w-full">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                        <SelectItem v-for="option in transferTypeOptions" :key="`workflow-transfer-type-${option}`" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <Label for="transfer-create-priority">Priority</Label>
                                                                    <Select v-model="transferCreateForm.priority">
                                                                        <SelectTrigger class="w-full">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                        <SelectItem v-for="option in transferPriorityOptions" :key="`workflow-transfer-priority-${option}`" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <template v-if="usesRegistryBackedTransferSource">
                                                                        <SearchableSelectField
                                                                            input-id="transfer-create-source-location"
                                                                            v-model="transferCreateForm.sourceLocation"
                                                                            label="Source location"
                                                                            :options="transferLocationRegistryOptions"
                                                                            placeholder="Select source location"
                                                                            search-placeholder="Search service point or ward"
                                                                            :helper-text="transferLocationRegistryHelperText"
                                                                            :error-message="transferCreateFieldError('sourceLocation')"
                                                                            empty-text="No internal location matched that search."
                                                                        />
                                                                    </template>
                                                                    <template v-else>
                                                                        <Label for="transfer-create-source-location">Source location</Label>
                                                                        <Input
                                                                            id="transfer-create-source-location"
                                                                            v-model="transferCreateForm.sourceLocation"
                                                                            placeholder="ER bay / triage desk"
                                                                        />
                                                                        <p class="text-xs text-muted-foreground">{{ transferLocationRegistryHelperText }}</p>
                                                                        <p v-if="transferCreateFieldError('sourceLocation')" class="text-xs text-destructive">{{ transferCreateFieldError('sourceLocation') }}</p>
                                                                    </template>
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <template v-if="usesRegistryBackedInternalDestination">
                                                                        <SearchableSelectField
                                                                            input-id="transfer-create-destination-location"
                                                                            v-model="transferCreateForm.destinationLocation"
                                                                            label="Destination location"
                                                                            :options="transferLocationRegistryOptions"
                                                                            placeholder="Select destination location"
                                                                            search-placeholder="Search service point or ward"
                                                                            helper-text="Choose the internal receiving location from the active registry."
                                                                            :error-message="transferCreateFieldError('destinationLocation')"
                                                                            empty-text="No internal destination matched that search."
                                                                        />
                                                                    </template>
                                                                    <template v-else>
                                                                        <Label for="transfer-create-destination-location">
                                                                            {{ transferCreateForm.transferType === 'external' ? 'Destination location / desk' : 'Destination location' }}
                                                                        </Label>
                                                                        <Input
                                                                            id="transfer-create-destination-location"
                                                                            v-model="transferCreateForm.destinationLocation"
                                                                            :placeholder="
                                                                                transferCreateForm.transferType === 'external'
                                                                                    ? 'Receiving desk / unit / department'
                                                                                    : 'Ward / theatre / destination point'
                                                                            "
                                                                        />
                                                                        <p class="text-xs text-muted-foreground">
                                                                            {{
                                                                                transferCreateForm.transferType === 'external'
                                                                                    ? 'For external referral, capture the receiving area or desk inside the destination facility.'
                                                                                    : transferLocationRegistryHelperText
                                                                            }}
                                                                        </p>
                                                                        <p v-if="transferCreateFieldError('destinationLocation')" class="text-xs text-destructive">{{ transferCreateFieldError('destinationLocation') }}</p>
                                                                    </template>
                                                                </div>
                                                                <div v-if="transferCreateForm.transferType === 'external'" class="grid gap-2">
                                                                    <Label for="transfer-create-destination-facility">Destination facility</Label>
                                                                    <Input
                                                                        id="transfer-create-destination-facility"
                                                                        v-model="transferCreateForm.destinationFacilityName"
                                                                        placeholder="Referral hospital / receiving facility"
                                                                    />
                                                                    <p class="text-xs text-muted-foreground">
                                                                        Keep this manual for now. A referral-facility directory is still deferred.
                                                                    </p>
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <Label for="transfer-create-transport-mode">Transport mode</Label>
                                                                    <Select v-model="transferCreateForm.transportMode">
                                                                        <SelectTrigger class="w-full">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                        <SelectItem value="">Select transport mode</SelectItem>
                                                                        <SelectItem
                                                                            v-for="option in transferTransportModeOptions"
                                                                            :key="`workflow-transfer-transport-${option}`"
                                                                            :value="option"
                                                                        >
                                                                            {{ transferTransportModeLabel(option) }}
                                                                        </SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <p class="text-xs text-muted-foreground">Use a controlled transport mode so ambulance and critical handoff states remain consistent.</p>
                                                                    <p v-if="transferCreateFieldError('transportMode')" class="text-xs text-destructive">{{ transferCreateFieldError('transportMode') }}</p>
                                                                </div>
                                                                <div class="grid gap-2">
                                                                    <template v-if="canReadTransferClinicianDirectory && transferClinicianDirectoryAvailable">
                                                                        <SearchableSelectField
                                                                            input-id="transfer-create-clinician"
                                                                            v-model="transferCreateForm.acceptingClinicianUserId"
                                                                            label="Accepting clinician"
                                                                            :options="transferClinicianOptions"
                                                                            placeholder="Select receiving clinician"
                                                                            search-placeholder="Search by employee number, role, department, or user ID"
                                                                            :helper-text="transferClinicianHelperText"
                                                                            :error-message="transferCreateFieldError('acceptingClinicianUserId')"
                                                                            empty-text="No active clinician matched that search."
                                                                        />
                                                                    </template>
                                                                    <template v-else>
                                                                        <Label for="transfer-create-clinician">Accepting clinician user ID</Label>
                                                                        <Input id="transfer-create-clinician" v-model="transferCreateForm.acceptingClinicianUserId" inputmode="numeric" placeholder="Optional user ID" />
                                                                        <p class="text-xs text-muted-foreground">{{ transferClinicianHelperText }}</p>
                                                                        <p v-if="transferCreateFieldError('acceptingClinicianUserId')" class="text-xs text-destructive">{{ transferCreateFieldError('acceptingClinicianUserId') }}</p>
                                                                    </template>
                                                                </div>
                                                                <div class="grid gap-2 lg:col-span-2">
                                                                    <Label for="transfer-create-requested-at">Requested at</Label>
                                                                    <Input id="transfer-create-requested-at" v-model="transferCreateForm.requestedAt" type="datetime-local" class="w-full" />
                                                                </div>
                                                                <div class="grid gap-2 lg:col-span-2">
                                                                    <Label for="transfer-create-handoff">Clinical handoff notes</Label>
                                                                    <Textarea id="transfer-create-handoff" v-model="transferCreateForm.clinicalHandoffNotes" rows="3" class="resize-y rounded-lg" placeholder="Receiving team handoff notes" />
                                                                </div>
                                                                <div class="flex justify-end lg:col-span-2">
                                                                    <Button class="gap-1.5" :disabled="transferCreateSubmitting" @click="submitTransferCreate">
                                                                        <AppIcon name="plus" class="size-3.5" />
                                                                        {{ transferCreateSubmitting ? 'Creating...' : 'Create transfer request' }}
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            <Alert v-else variant="destructive">
                                                                <AlertTitle>Transfer management restricted</AlertTitle>
                                                                <AlertDescription>Request <code>emergency.triage.manage-transfers</code> permission to create or advance handoffs.</AlertDescription>
                                                            </Alert>

                                                            <Alert v-if="detailsTransferError" variant="destructive">
                                                                <AlertTitle>Transfer load issue</AlertTitle>
                                                                <AlertDescription>{{ detailsTransferError }}</AlertDescription>
                                                            </Alert>

                                                            <div v-else-if="detailsTransferLoading" class="space-y-2">
                                                                <Skeleton class="h-20 rounded-lg" />
                                                                <Skeleton class="h-20 rounded-lg" />
                                                            </div>

                                                            <div v-else class="space-y-3">
                                                                <div v-if="detailsTransfers.length === 0" class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                                                                    No transfer handoffs match the current filters.
                                                                </div>
                                                                <div v-for="transfer in detailsTransfers" :key="transfer.id" :class="transferRowClasses(transfer)">
                                                                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                                        <div class="min-w-0 space-y-2">
                                                                            <div class="flex flex-wrap items-center gap-2">
                                                                                <p class="text-sm font-medium">{{ transfer.transferNumber || 'Transfer request' }}</p>
                                                                                <Badge :variant="statusVariant(transfer.status)">{{ formatEnumLabel(transfer.status) }}</Badge>
                                                                                <Badge variant="outline">{{ formatEnumLabel(transfer.transferType) }}</Badge>
                                                                                <Badge variant="outline">{{ formatEnumLabel(transfer.priority) }}</Badge>
                                                                            </div>
                                                                            <p class="text-xs text-muted-foreground">
                                                                                {{ transfer.sourceLocation || 'Source pending' }} -> {{ transfer.destinationLocation || transfer.destinationFacilityName || 'Destination pending' }}
                                                                            </p>
                                                                            <p class="text-xs text-muted-foreground">
                                                                                Requested {{ formatDateTime(transfer.requestedAt) }} | {{ transferTransportModeLabel(transfer.transportMode) }}
                                                                            </p>
                                                                            <p class="line-clamp-2 text-sm text-foreground">
                                                                                {{ transfer.clinicalHandoffNotes || 'Clinical handoff notes pending.' }}
                                                                            </p>
                                                                            <div :class="['flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-2 text-xs', transferFocusStripClasses(transfer)]">
                                                                                <span class="font-medium text-foreground">{{ transferWorkflowFocus(transfer).label }}</span>
                                                                                <span class="text-muted-foreground">{{ transferWorkflowFocus(transfer).description }}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div class="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
                                                                            <Button v-if="canManageTransfers && transfer.status === 'requested'" size="sm" variant="outline" @click="openTransferStatusDialog(transfer, 'accepted')">Accept handoff</Button>
                                                                            <Button v-if="canManageTransfers && transfer.status === 'accepted'" size="sm" variant="outline" @click="openTransferStatusDialog(transfer, 'in_transit')">Start transport</Button>
                                                                            <Button v-if="canManageTransfers && transfer.status === 'in_transit'" size="sm" variant="outline" @click="openTransferStatusDialog(transfer, 'completed')">Complete handoff</Button>
                                                                            <Button v-if="canManageTransfers && transfer.status !== 'completed' && transfer.status !== 'cancelled' && transfer.status !== 'rejected'" size="sm" variant="destructive" @click="openTransferStatusDialog(transfer, 'cancelled')">Cancel</Button>
                                                                            <Button v-if="canViewTransferAudit" size="sm" variant="outline" class="gap-1.5" @click="openTransferAuditDialog(transfer)">
                                                                                <AppIcon name="file-text" class="size-3.5" />
                                                                                Audit
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div class="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                                                                <p class="text-xs text-muted-foreground">
                                                                    Page {{ detailsTransferMeta?.currentPage ?? 1 }} of {{ detailsTransferMeta?.lastPage ?? 1 }} | {{ detailsTransferMeta?.total ?? detailsTransfers.length }} transfers
                                                                </p>
                                                                <div class="flex items-center gap-2">
                                                                    <Button variant="outline" size="sm" :disabled="detailsTransferLoading || !detailsTransferMeta || detailsTransferMeta.currentPage <= 1" @click="goToTransferPage((detailsTransferMeta?.currentPage ?? 2) - 1)">Previous</Button>
                                                                    <Button variant="outline" size="sm" :disabled="detailsTransferLoading || !detailsTransferMeta || detailsTransferMeta.currentPage >= detailsTransferMeta.lastPage" @click="goToTransferPage((detailsTransferMeta?.currentPage ?? 0) + 1)">Next</Button>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                                <div class="space-y-6">
                                                    <Card class="rounded-lg border-sidebar-border/70">
                                                        <CardHeader>
                                                            <CardTitle class="flex items-center gap-2">
                                                                <AppIcon name="scan-line" class="size-4 text-muted-foreground" />
                                                                Ambulance handoff
                                                            </CardTitle>
                                                            <CardDescription>Keep the receiving destination, transport mode, and handoff notes visible.</CardDescription>
                                                        </CardHeader>
                                                        <CardContent class="space-y-3">
                                                            <template v-if="detailsAmbulanceHandoff">
                                                                <div class="flex flex-wrap items-center gap-2">
                                                                    <Badge :variant="statusVariant(detailsAmbulanceHandoff.status)">
                                                                        {{ formatEnumLabel(detailsAmbulanceHandoff.status) }}
                                                                    </Badge>
                                                                    <Badge variant="outline">{{ formatEnumLabel(detailsAmbulanceHandoff.priority) }}</Badge>
                                                                    <Badge variant="outline">{{ transferTransportModeLabel(detailsAmbulanceHandoff.transportMode) }}</Badge>
                                                                </div>
                                                                <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Destination</p>
                                                                    <p class="mt-1 text-sm font-medium">
                                                                        {{ detailsAmbulanceHandoff.destinationLocation || detailsAmbulanceHandoff.destinationFacilityName || 'Receiving destination pending' }}
                                                                    </p>
                                                                </div>
                                                                <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requested</p>
                                                                    <p class="mt-1 text-sm font-medium">{{ formatDateTime(detailsAmbulanceHandoff.requestedAt) }}</p>
                                                                </div>
                                                                <div class="rounded-lg border bg-background px-3 py-2.5">
                                                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Handoff notes</p>
                                                                    <p class="mt-2 whitespace-pre-wrap text-sm text-foreground">
                                                                        {{ detailsAmbulanceHandoff.clinicalHandoffNotes || 'Clinical handoff notes have not been captured yet.' }}
                                                                    </p>
                                                                </div>
                                                                <Button v-if="canViewTransferAudit" variant="outline" class="w-full gap-1.5" @click="openTransferAuditDialog(detailsAmbulanceHandoff)">
                                                                    <AppIcon name="file-text" class="size-3.5" />
                                                                    Review transfer audit
                                                                </Button>
                                                            </template>
                                                            <div v-else class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                                                                No ambulance or referral handoff is recorded yet.
                                                            </div>
                                                        </CardContent>
                                                    </Card>

                                                    <Card class="rounded-lg border-sidebar-border/70">
                                                        <CardHeader>
                                                            <CardTitle class="flex items-center gap-2">
                                                                <AppIcon name="clipboard-list" class="size-4 text-muted-foreground" />
                                                                Rapid order-set panel
                                                            </CardTitle>
                                                            <CardDescription>Launch the most common emergency actions without losing patient context.</CardDescription>
                                                        </CardHeader>
                                                        <CardContent class="space-y-2">
                                                            <Button
                                                                v-for="action in detailsRapidOrderSetActions"
                                                                :key="action.key"
                                                                variant="outline"
                                                                class="grid h-auto w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 whitespace-normal rounded-lg px-3 py-3 text-left"
                                                                as-child
                                                            >
                                                                <Link :href="action.href">
                                                                    <span class="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/20">
                                                                        <AppIcon :name="action.icon" class="size-4 text-muted-foreground" />
                                                                    </span>
                                                                    <span class="min-w-0">
                                                                        <span class="block break-words text-sm font-medium leading-5">{{ action.label }}</span>
                                                                        <span class="mt-1 block break-words text-xs leading-5 text-muted-foreground">
                                                                            {{ action.description }}
                                                                        </span>
                                                                    </span>
                                                                    <AppIcon name="arrow-up-right" class="mt-0.5 size-4 shrink-0 self-start text-muted-foreground" />
                                                                </Link>
                                                            </Button>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="audit" class="space-y-6">
                                            <Alert v-if="!canViewAudit" variant="destructive">
                                                <AlertTitle>Audit access restricted</AlertTitle>
                                                <AlertDescription>Request <code>emergency.triage.view-audit-logs</code> permission.</AlertDescription>
                                            </Alert>

                                            <template v-else>
                                                <div class="grid gap-3 sm:grid-cols-3">
                                                    <Card v-for="card in detailsAuditSummaryCards" :key="card.label" class="rounded-lg border-sidebar-border/70">
                                                        <CardContent class="px-4 py-3">
                                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ card.label }}</p>
                                                            <p class="mt-2 text-lg font-semibold">{{ card.value }}</p>
                                                        </CardContent>
                                                    </Card>
                                                </div>

                                                <Card class="rounded-lg border-sidebar-border/70">
                                                    <CardHeader>
                                                        <CardTitle class="flex items-center gap-2">
                                                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                                            Audit filters
                                                        </CardTitle>
                                                        <CardDescription>Filter the case-level audit stream before exporting or expanding event payloads.</CardDescription>
                                                    </CardHeader>
                                                    <CardContent class="space-y-4">
                                                        <div class="grid gap-3 lg:grid-cols-3">
                                                            <div class="grid gap-2">
                                                                <Label for="details-audit-q">Search</Label>
                                                                <Input id="details-audit-q" v-model="detailsAuditFilters.q" placeholder="status.updated, created..." />
                                                            </div>
                                                            <div class="grid gap-2">
                                                                <Label for="details-audit-action">Action</Label>
                                                                <Input id="details-audit-action" v-model="detailsAuditFilters.action" placeholder="Optional action key" />
                                                            </div>
                                                            <div class="grid gap-2">
                                                                <Label for="details-audit-actor-type">Actor type</Label>
                                                                <Select v-model="detailsAuditFilters.actorType">
                                                                    <SelectTrigger class="w-full">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                    <SelectItem v-for="option in auditActorTypeOptions" :key="`details-audit-actor-${option.value || 'all'}`" :value="option.value">{{ option.label }}</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div class="grid gap-2">
                                                                <Label for="details-audit-actor-id">Actor user ID</Label>
                                                                <Input id="details-audit-actor-id" v-model="detailsAuditFilters.actorId" inputmode="numeric" placeholder="Optional user ID" />
                                                            </div>
                                                            <div class="grid gap-2">
                                                                <Label for="details-audit-from">From</Label>
                                                                <Input id="details-audit-from" v-model="detailsAuditFilters.from" type="datetime-local" />
                                                            </div>
                                                            <div class="grid gap-2">
                                                                <Label for="details-audit-to">To</Label>
                                                                <Input id="details-audit-to" v-model="detailsAuditFilters.to" type="datetime-local" />
                                                            </div>
                                                        </div>
                                                        <div class="flex flex-wrap items-center justify-between gap-2">
                                                            <div class="flex flex-wrap gap-2">
                                                                <Badge v-if="detailsAuditFilters.q" variant="outline">{{ detailsAuditFilters.q }}</Badge>
                                                                <Badge v-if="detailsAuditFilters.action" variant="outline">{{ detailsAuditFilters.action }}</Badge>
                                                                <Badge v-if="detailsAuditFilters.actorType" variant="outline">{{ formatEnumLabel(detailsAuditFilters.actorType) }}</Badge>
                                                                <Badge v-if="detailsAuditFilters.from || detailsAuditFilters.to" variant="outline">Date range active</Badge>
                                                            </div>
                                                            <div class="flex flex-wrap gap-2">
                                                                <Button size="sm" class="gap-1.5" :disabled="detailsAuditLoading" @click="applyDetailsAuditFilters">
                                                                    <AppIcon name="search" class="size-3.5" />
                                                                    Apply filters
                                                                </Button>
                                                                <Button size="sm" variant="outline" :disabled="detailsAuditLoading" @click="resetDetailsAuditFilters">Reset</Button>
                                                                <Button size="sm" variant="outline" :disabled="detailsAuditLoading || detailsAuditExporting" @click="exportDetailsAuditLogsCsv">
                                                                    {{ detailsAuditExporting ? 'Preparing...' : 'Export CSV' }}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                                <Alert v-if="detailsAuditError" variant="destructive">
                                                    <AlertTitle>Audit load issue</AlertTitle>
                                                    <AlertDescription>{{ detailsAuditError }}</AlertDescription>
                                                </Alert>

                                                <div v-else-if="detailsAuditLoading" class="space-y-2">
                                                    <Skeleton class="h-20 rounded-lg" />
                                                    <Skeleton class="h-20 rounded-lg" />
                                                </div>

                                                <Card v-else class="rounded-lg border-sidebar-border/70">
                                                    <CardContent class="space-y-3 px-4 py-4">
                                                        <div v-if="detailsAuditLogs.length === 0" class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                                                            No audit events match the current filters.
                                                        </div>
                                                        <div v-for="log in detailsAuditLogs" :key="log.id" class="rounded-lg border bg-background px-4 py-3">
                                                            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                                <div class="space-y-2">
                                                                    <div class="flex flex-wrap items-center gap-2">
                                                                        <p class="text-sm font-medium">{{ log.action || 'event' }}</p>
                                                                        <Badge variant="outline">{{ auditActorLabel(log) }}</Badge>
                                                                        <Badge variant="outline">{{ auditChangeCount(log) }} changed</Badge>
                                                                    </div>
                                                                    <p class="text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }}</p>
                                                                </div>
                                                                <Button size="sm" variant="outline" class="gap-1.5" @click="toggleDetailsAuditRow(log.id)">
                                                                    <AppIcon :name="isDetailsAuditRowExpanded(log.id) ? 'chevron-up' : 'chevron-down'" class="size-3.5" />
                                                                    {{ isDetailsAuditRowExpanded(log.id) ? 'Hide details' : 'Show details' }}
                                                                </Button>
                                                            </div>
                                                            <pre
                                                                v-if="isDetailsAuditRowExpanded(log.id)"
                                                                class="mt-3 overflow-x-auto rounded-lg border bg-muted/20 p-3 text-xs text-foreground"
                                                            ><code>{{ formatAuditPayload(log) }}</code></pre>
                                                        </div>

                                                        <div class="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                                                            <p class="text-xs text-muted-foreground">
                                                                Page {{ detailsAuditMeta?.currentPage ?? 1 }} of {{ detailsAuditMeta?.lastPage ?? 1 }} | {{ detailsAuditMeta?.total ?? detailsAuditLogs.length }} events
                                                            </p>
                                                            <div class="flex items-center gap-2">
                                                                <Button variant="outline" size="sm" :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage <= 1" @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 2) - 1)">Previous</Button>
                                                                <Button variant="outline" size="sm" :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage >= detailsAuditMeta.lastPage" @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 0) + 1)">Next</Button>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </template>
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            </ScrollArea>
                        </div>

                        <SheetFooter class="shrink-0 border-t px-6 py-4">
                            <Button variant="outline" @click="detailsOpen = false">Close</Button>
                        </SheetFooter>
                    </div>
                </SheetContent>
            </Sheet>

            <Dialog :open="transferStatusDialogOpen" @update:open="(open) => (transferStatusDialogOpen = open)">
                <DialogContent variant="form" size="2xl">
                    <DialogHeader class="shrink-0 border-b bg-background px-6 py-4 text-left">
                        <DialogTitle>{{ transferStatusDialogMeta.title }}</DialogTitle>
                        <DialogDescription>
                            {{ transferStatusDialogMeta.description + (transferStatusTarget?.transferNumber ? ' (' + transferStatusTarget.transferNumber + ')' : '') }}
                        </DialogDescription>
                    </DialogHeader>
                    <div class="flex-1 overflow-y-auto px-6 py-4">
                        <div class="space-y-4">
                            <div class="grid gap-3 sm:grid-cols-3">
                                <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current step</p>
                                    <p class="mt-1 text-sm font-medium">{{ transferStatusDialogMeta.currentStep }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">This action</p>
                                    <p class="mt-1 text-sm font-medium">{{ transferStatusDialogMeta.actionLabel }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">After this step</p>
                                    <p class="mt-1 text-sm font-medium leading-5">{{ transferStatusDialogMeta.afterStep }}</p>
                                </div>
                            </div>
                            <div v-if="transferStatusNeedsReason()" class="grid gap-2">
                                <Label for="transfer-status-reason">Reason</Label>
                                <Input id="transfer-status-reason" v-model="transferStatusReason" />
                            </div>
                            <div class="grid gap-2">
                                <Label for="transfer-status-notes">Clinical handoff notes</Label>
                                <Textarea id="transfer-status-notes" v-model="transferStatusNotes" rows="4" class="resize-y rounded-lg" />
                            </div>
                            <Alert v-if="transferStatusError" variant="destructive">
                                <AlertTitle>Action validation</AlertTitle>
                                <AlertDescription>{{ transferStatusError }}</AlertDescription>
                            </Alert>
                        </div>
                    </div>
                    <DialogFooter class="shrink-0 border-t bg-background px-6 py-4">
                        <Button variant="outline" @click="transferStatusDialogOpen = false">Cancel</Button>
                        <Button :disabled="transferStatusSubmitting" @click="submitTransferStatusDialog">{{ transferStatusSubmitting ? 'Saving...' : transferStatusDialogMeta.submitLabel }}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog :open="transferAuditDialogOpen" @update:open="(open) => (transferAuditDialogOpen = open)">
                <DialogContent variant="workspace" size="3xl">
                    <DialogHeader class="shrink-0 border-b bg-background px-6 py-4 text-left">
                        <DialogTitle>{{ transferAuditTarget?.transferNumber || 'Transfer Audit Logs' }}</DialogTitle>
                        <DialogDescription>Transfer-level audit timeline with filters and CSV export.</DialogDescription>
                    </DialogHeader>
                    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                        <Alert v-if="!canViewTransferAudit" variant="destructive">
                            <AlertTitle>Audit access restricted</AlertTitle>
                            <AlertDescription>Request <code>emergency.triage.view-transfer-audit-logs</code> permission.</AlertDescription>
                        </Alert>
                        <div v-else class="space-y-3">
                            <div class="grid gap-3 rounded-md border p-3 md:grid-cols-2">
                                <div class="grid gap-2"><Label for="transfer-audit-q">Action Text Search</Label><Input id="transfer-audit-q" v-model="transferAuditFilters.q" placeholder="status.updated, created..." /></div>
                                <div class="grid gap-2"><Label for="transfer-audit-action">Action (exact)</Label><Input id="transfer-audit-action" v-model="transferAuditFilters.action" placeholder="Optional exact action key" /></div>
                                <div class="grid gap-2"><Label for="transfer-audit-actor-type">Actor Type</Label><Select v-model="transferAuditFilters.actorType"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="option in auditActorTypeOptions" :key="`transfer-audit-actor-type-${option.value || 'all'}`" :value="option.value">{{ option.label }}</SelectItem></SelectContent></Select></div>
                                <div class="grid gap-2"><Label for="transfer-audit-actor-id">Actor user ID</Label><Input id="transfer-audit-actor-id" v-model="transferAuditFilters.actorId" inputmode="numeric" placeholder="Optional user ID" /></div>
                                <div class="grid gap-2"><Label for="transfer-audit-from">From</Label><Input id="transfer-audit-from" v-model="transferAuditFilters.from" type="datetime-local" /></div>
                                <div class="grid gap-2"><Label for="transfer-audit-to">To</Label><Input id="transfer-audit-to" v-model="transferAuditFilters.to" type="datetime-local" /></div>
                                <div class="grid gap-2"><Label for="transfer-audit-per-page">Rows Per Page</Label><Select :model-value="String(transferAuditFilters.perPage)" @update:model-value="transferAuditFilters.perPage = Number($event)"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div>
                                <div class="flex flex-wrap items-end gap-2"><Button size="sm" :disabled="transferAuditLoading" @click="applyTransferAuditFilters">{{ transferAuditLoading ? 'Applying...' : 'Apply Filters' }}</Button><Button size="sm" variant="outline" :disabled="transferAuditLoading" @click="resetTransferAuditFilters">Reset</Button><Button size="sm" variant="outline" :disabled="transferAuditLoading || transferAuditExporting" @click="exportTransferAuditLogsCsv">{{ transferAuditExporting ? 'Preparing...' : 'Export CSV' }}</Button></div>
                            </div>
                            <Alert v-if="transferAuditError" variant="destructive"><AlertTitle>Audit load issue</AlertTitle><AlertDescription>{{ transferAuditError }}</AlertDescription></Alert>
                            <div v-else-if="transferAuditLoading" class="text-sm text-muted-foreground">Loading audit logs...</div>
                            <div v-else class="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2 text-sm">
                                <p v-if="transferAuditLogs.length === 0" class="text-muted-foreground">No transfer audit logs found for current filters.</p>
                                <div v-for="log in transferAuditLogs" :key="log.id" class="rounded border p-2">
                                    <p class="font-medium">{{ log.action || 'event' }}</p>
                                    <p class="text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }} | {{ auditActorLabel(log) }}</p>
                                </div>
                            </div>
                            <div class="flex items-center justify-between border-t pt-2">
                                <Button variant="outline" size="sm" :disabled="transferAuditLoading || !transferAuditMeta || transferAuditMeta.currentPage <= 1" @click="goToTransferAuditPage((transferAuditMeta?.currentPage ?? 2) - 1)">Previous</Button>
                                <p class="text-xs text-muted-foreground">Page {{ transferAuditMeta?.currentPage ?? 1 }} of {{ transferAuditMeta?.lastPage ?? 1 }} | {{ transferAuditMeta?.total ?? transferAuditLogs.length }} logs</p>
                                <Button variant="outline" size="sm" :disabled="transferAuditLoading || !transferAuditMeta || transferAuditMeta.currentPage >= transferAuditMeta.lastPage" @click="goToTransferAuditPage((transferAuditMeta?.currentPage ?? 0) + 1)">Next</Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter class="shrink-0 border-t bg-background px-6 py-4">
                        <Button variant="outline" @click="transferAuditDialogOpen = false">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog :open="statusDialogOpen" @update:open="(open) => (statusDialogOpen = open)">
                <DialogContent variant="form" size="2xl">
                    <DialogHeader class="shrink-0 border-b bg-background px-6 py-4 text-left">
                        <DialogTitle>{{ statusDialogMeta.title }}</DialogTitle>
                        <DialogDescription>
                            {{ statusDialogMeta.description + (statusCase?.caseNumber ? ' (' + statusCase.caseNumber + ')' : '') }}
                        </DialogDescription>
                    </DialogHeader>
                    <div class="flex-1 overflow-y-auto px-6 py-4">
                        <div class="space-y-4">
                            <div class="grid gap-3 sm:grid-cols-3">
                                <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current step</p>
                                    <p class="mt-1 text-sm font-medium">{{ statusDialogMeta.currentStep }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">This action</p>
                                    <p class="mt-1 text-sm font-medium">{{ statusDialogMeta.actionLabel }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">After this step</p>
                                    <p class="mt-1 text-sm font-medium leading-5">{{ statusDialogMeta.afterStep }}</p>
                                </div>
                            </div>
                            <div v-if="statusAction === 'cancelled'" class="grid gap-2">
                                <Label for="triage-status-reason">Cancellation reason</Label>
                                <Input id="triage-status-reason" v-model="statusReason" />
                            </div>
                            <div v-if="statusAction === 'admitted' || statusAction === 'discharged'" class="grid gap-2">
                                <Label for="triage-status-disposition">Disposition notes</Label>
                                <Textarea id="triage-status-disposition" v-model="statusDispositionNotes" rows="4" class="resize-y rounded-lg" />
                            </div>
                            <Alert v-if="statusError" variant="destructive">
                                <AlertTitle>Action validation</AlertTitle>
                                <AlertDescription>{{ statusError }}</AlertDescription>
                            </Alert>
                        </div>
                    </div>
                    <DialogFooter class="shrink-0 border-t bg-background px-6 py-4">
                        <Button variant="outline" @click="statusDialogOpen=false">Cancel</Button>
                        <Button :disabled="actionLoadingId === statusCase?.id" @click="submitStatusDialog">{{ actionLoadingId === statusCase?.id ? 'Saving...' : statusDialogMeta.submitLabel }}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>





















