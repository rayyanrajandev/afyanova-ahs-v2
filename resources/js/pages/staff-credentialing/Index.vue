<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import StaffProfileEditDialog from '@/components/staff/StaffProfileEditDialog.vue';
import StaffProfileStatusDialog from '@/components/staff/StaffProfileStatusDialog.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { csrfRequestHeaders } from '@/lib/csrf';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type ValidationErrorResponse = { message?: string; errors?: Record<string, string[]> };
type StaffQueuePosition = { page: number; position: number };
type WorkspaceTab = 'summary' | 'regulatory' | 'registrations' | 'alerts' | 'audit';
type WorkflowGuidanceAction = 'regulatory' | 'registration' | 'verify' | 'privileging' | null;
type WorkflowGuidance = {
    title: string;
    description: string;
    variant: 'default' | 'destructive';
    action: WorkflowGuidanceAction;
    actionLabel?: string | null;
};

type StaffProfile = {
    id: string;
    userId: number | null;
    userName: string | null;
    userEmail?: string | null;
    userEmailVerifiedAt?: string | null;
    userEmailVerified?: boolean;
    employeeNumber: string | null;
    department: string | null;
    jobTitle: string | null;
    professionalLicenseNumber: string | null;
    licenseType: string | null;
    phoneExtension: string | null;
    employmentType: string | null;
    status: string | null;
    statusReason?: string | null;
};

type RegulatoryProfile = {
    id: string;
    primaryRegulatorCode: string | null;
    cadreCode: string | null;
    professionalTitle: string | null;
    registrationType: string | null;
    practiceAuthorityLevel: string | null;
    supervisionLevel: string | null;
    goodStandingStatus: string | null;
    goodStandingCheckedAt: string | null;
    notes: string | null;
};

type Registration = {
    id: string;
    regulatorCode: string | null;
    registrationCategory: string | null;
    registrationNumber: string | null;
    licenseNumber: string | null;
    registrationStatus: string | null;
    licenseStatus: string | null;
    verificationStatus: string | null;
    verificationReason: string | null;
    verificationNotes: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    renewalDueAt: string | null;
    cpdCycleStartAt: string | null;
    cpdCycleEndAt: string | null;
    cpdPointsRequired: number | null;
    cpdPointsEarned: number | null;
    sourceDocumentId: string | null;
    sourceSystem: string | null;
    notes: string | null;
    updatedAt: string | null;
};

type CredentialingSummary = {
    credentialingState: string | null;
    blockingReasons: string[];
    nextExpiryAt: string | null;
    regulatoryProfile: RegulatoryProfile | null;
    activeRegistration: Pick<
        Registration,
        'id' | 'regulatorCode' | 'registrationNumber' | 'licenseNumber' | 'registrationStatus' | 'licenseStatus' | 'verificationStatus' | 'expiresAt'
    > | null;
    registrationSummary: {
        total: number;
        verified: number;
        pendingVerification: number;
        expired: number;
    };
};

type CredentialingAlert = {
    id: string;
    staffProfileId: string | null;
    userName: string | null;
    employeeNumber: string | null;
    department: string | null;
    jobTitle: string | null;
    regulatorCode: string | null;
    cadreCode: string | null;
    alertType: string | null;
    alertState: string | null;
    summary: string | null;
    expiresAt: string | null;
    createdAt: string | null;
};

type CredentialingAuditLog = {
    id: string;
    action: string | null;
    actionLabel?: string | null;
    actorId: number | null;
    actorType?: string | null;
    actor?: { displayName?: string | null } | null;
    createdAt: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Staff', href: '/staff' },
    { title: 'Staff Credentialing', href: '/staff-credentialing' },
];

const tabOptions: Array<{ value: WorkspaceTab; label: string }> = [
    { value: 'summary', label: 'Summary' },
    { value: 'regulatory', label: 'Regulatory Profile' },
    { value: 'registrations', label: 'Registrations' },
    { value: 'alerts', label: 'Alerts' },
    { value: 'audit', label: 'Audit' },
];

const regulatorOptions = ['mct', 'tnmc', 'hlpc', 'pc', 'other'];
const regulatorLabels: Record<string, string> = {
    mct: 'Medical Council of Tanganyika (MCT)',
    tnmc: 'Tanzania Nursing and Midwifery Council (TNMC)',
    hlpc: 'Health Laboratory Practitioners Council (HLPC)',
    pc: 'Pharmacy Council (PC)',
    other: 'Other / Local Entry (OTHER)',
};
const practiceAuthorityOptions = ['independent', 'supervised', 'training_only', 'not_authorized'];
const supervisionOptions = ['independent', 'indirect_supervision', 'direct_supervision', 'training_only', 'not_authorized'];
const goodStandingOptions = ['unknown', 'in_good_standing', 'restricted', 'withdrawn', 'pending'];
const registrationStatusOptions = ['active', 'expired', 'suspended', 'revoked', 'pending', 'inactive'];
const licenseStatusOptions = ['active', 'expired', 'suspended', 'revoked', 'pending', 'inactive', 'not_required'];
const verificationStatusOptions = ['pending', 'verified', 'rejected'];
const alertTypeOptions = ['missing_regulatory_profile', 'good_standing_risk', 'expired_license', 'expired_registration', 'verification_pending', 'due_soon'];
const alertStateOptions = ['blocked', 'pending_verification', 'watch'];
const clinicalRoleKeywords = [
    'doctor',
    'surgeon',
    'medical officer',
    'clinical officer',
    'anaesthetist',
    'anesthetist',
    'nurse',
    'midwife',
    'laboratory',
    'lab',
    'radiographer',
    'radiology',
    'pharmacist',
    'pharmacy',
    'theatre',
    'recovery',
    'triage',
    'emergency',
    'ward',
    'dispensary',
    'maternity',
    'clinic',
    'outpatient',
    'inpatient',
    'sonographer',
    'physiotherapist',
    'dentist',
];
const supportRoleKeywords = [
    'medical records',
    'records officer',
    'registration',
    'front desk',
    'cashier',
    'billing',
    'finance',
    'account',
    'admin',
    'administrator',
    'secretary',
    'reception',
    'procurement',
    'supply',
    'storekeeper',
    'porter',
    'cleaner',
    'security',
    'driver',
    'ict',
    'it support',
    'human resources',
    'hr',
];

const { permissionState, scope } = usePlatformAccess();
const staffReadPermission = computed(() => permissionState('staff.read'));
const staffUpdatePermission = computed(() => permissionState('staff.update'));
const staffUpdateStatusPermission = computed(() => permissionState('staff.update-status'));
const credentialingReadPermission = computed(() => permissionState('staff.credentialing.read'));
const privilegeReadPermission = computed(() => permissionState('staff.privileges.read'));
const manageProfilePermission = computed(() => permissionState('staff.credentialing.manage-profile'));
const manageRegistrationsPermission = computed(() => permissionState('staff.credentialing.manage-registrations'));
const verifyPermission = computed(() => permissionState('staff.credentialing.verify'));
const auditPermission = computed(() => permissionState('staff.credentialing.view-audit-logs'));
const canReadStaff = computed(() => staffReadPermission.value === 'allowed');
const canUpdateStaff = computed(() => staffUpdatePermission.value === 'allowed');
const canUpdateStaffStatus = computed(() => staffUpdateStatusPermission.value === 'allowed');
const canReadCredentialing = computed(() => credentialingReadPermission.value === 'allowed');
const canReadPrivileging = computed(() => privilegeReadPermission.value === 'allowed');
const canManageProfile = computed(() => manageProfilePermission.value === 'allowed');
const canManageRegistrations = computed(() => manageRegistrationsPermission.value === 'allowed');
const canVerify = computed(() => verifyPermission.value === 'allowed');
const canViewAudit = computed(() => auditPermission.value === 'allowed');
const staffReadDenied = computed(() => staffReadPermission.value === 'denied');
const credentialingReadDenied = computed(() => credentialingReadPermission.value === 'denied');
const auditDenied = computed(() => auditPermission.value === 'denied');
const showWorkspaceBootstrapSkeleton = computed(() => initialPageLoading.value && canReadStaff.value);

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

const requestedTab = queryParam('tab');
const requestedStaffId = queryParam('staffId');
const activeTab = ref<WorkspaceTab>(tabOptions.some((tab) => tab.value === requestedTab) ? (requestedTab as WorkspaceTab) : 'summary');

const staffQueueReady = ref(false);
const staffLoading = ref(true);
const summaryLoading = ref(false);
const profileLoading = ref(false);
const registrationsLoading = ref(false);
const alertsLoading = ref(false);
const auditLoading = ref(false);
const initialPageLoading = ref(true);
const profileSaving = ref(false);
const registrationSaving = ref(false);
const verificationSaving = ref(false);

const staffError = ref<string | null>(null);
const summaryError = ref<string | null>(null);
const profileError = ref<string | null>(null);
const registrationsError = ref<string | null>(null);
const alertsError = ref<string | null>(null);
const auditError = ref<string | null>(null);

const staffRows = ref<StaffProfile[]>([]);
const staffMeta = ref<Pagination | null>(null);
const selectedStaff = ref<StaffProfile | null>(null);
const summary = ref<CredentialingSummary | null>(null);
const regulatoryProfile = ref<RegulatoryProfile | null>(null);
const registrations = ref<Registration[]>([]);
const registrationsMeta = ref<Pagination | null>(null);
const alerts = ref<CredentialingAlert[]>([]);
const alertsMeta = ref<Pagination | null>(null);
const auditRows = ref<CredentialingAuditLog[]>([]);
const auditMeta = ref<Pagination | null>(null);

const staffFilters = reactive({ q: '', status: 'active', clinicalOnly: true, page: 1, perPage: 12 });
const registrationFilters = reactive({ regulatorCode: '', verificationStatus: '', registrationStatus: '', page: 1, perPage: 8 });
const alertFilters = reactive({ q: '', regulatorCode: '', alertType: '', alertState: '', clinicalOnly: true, page: 1, perPage: 8 });
const auditFilters = reactive({ q: '', action: '', actorType: '', page: 1, perPage: 10 });

const profileErrors = ref<Record<string, string[]>>({});
const registrationErrors = ref<Record<string, string[]>>({});
const verificationErrors = ref<Record<string, string[]>>({});
const workspaceActionMessage = ref<string | null>(null);
let workspaceActionMessageTimer: number | null = null;

const registrationDialogOpen = ref(false);
const registrationDialogTitle = ref('Add registration');
const editingRegistrationId = ref<string | null>(null);
const verifyDialogOpen = ref(false);
const verifyRegistrationId = ref<string | null>(null);
const editDialogOpen = ref(false);
const editDialogProfile = ref<StaffProfile | null>(null);
const statusDialogOpen = ref(false);
const statusDialogProfile = ref<StaffProfile | null>(null);
const compactQueueRows = useLocalStorageBoolean('staff.credentialing.queueRows.compact', false);
let staffSearchDebounceTimer: number | null = null;

const profileForm = reactive({
    primaryRegulatorCode: 'mct',
    cadreCode: '',
    professionalTitle: '',
    registrationType: '',
    practiceAuthorityLevel: 'independent',
    supervisionLevel: 'independent',
    goodStandingStatus: 'unknown',
    goodStandingCheckedAt: '',
    notes: '',
});

const registrationForm = reactive({
    regulatorCode: 'mct',
    registrationCategory: '',
    registrationNumber: '',
    licenseNumber: '',
    registrationStatus: 'active',
    licenseStatus: 'active',
    issuedAt: '',
    expiresAt: '',
    renewalDueAt: '',
    cpdCycleStartAt: '',
    cpdCycleEndAt: '',
    cpdPointsRequired: '',
    cpdPointsEarned: '',
    sourceDocumentId: '',
    sourceSystem: '',
    notes: '',
});

const verificationForm = reactive({
    verificationStatus: 'verified',
    reason: '',
    verificationNotes: '',
});

const selectedStaffAlerts = computed(() =>
    alerts.value.filter((row) => row.staffProfileId && row.staffProfileId === selectedStaff.value?.id),
);
const visibleStaffRows = computed(() => filterCredentialingStaffRows(staffRows.value));
const visibleAlerts = computed(() => filterCredentialingAlerts(alerts.value));
const queueStatusCounts = computed(() => ({
    active: visibleStaffRows.value.filter((row) => String(row.status ?? '').toLowerCase() === 'active').length,
    suspended: visibleStaffRows.value.filter((row) => String(row.status ?? '').toLowerCase() === 'suspended').length,
    inactive: visibleStaffRows.value.filter((row) => String(row.status ?? '').toLowerCase() === 'inactive').length,
}));
const staffQueueTotalCount = computed(() => staffMeta.value?.total ?? visibleStaffRows.value.length);
const credentialingQueueSummaryText = computed(() => {
    const status = staffFilters.status ? formatLabel(staffFilters.status).toLowerCase() : 'all';
    const roleScope = staffFilters.clinicalOnly ? 'clinical roles' : 'all roles';
    const filterText = staffFilterBadgeCount.value > 0 ? ` | ${staffFilterBadgeCount.value} active filters` : '';
    return `${staffQueueTotalCount.value} ${status} staff in ${roleScope}${filterText}`;
});
const credentialingQueueSnapshotText = computed(
    () => `${queueStatusCounts.value.active} active | ${queueStatusCounts.value.suspended} suspended | ${queueStatusCounts.value.inactive} inactive`,
);
const staffFilterBadgeCount = computed(
    () =>
        Number(Boolean(staffFilters.q.trim()))
        + Number(Boolean(staffFilters.status && staffFilters.status !== 'active'))
        + Number(Boolean(!staffFilters.clinicalOnly))
        + Number(Boolean(staffFilters.perPage !== 12)),
);
const hasActiveStaffQueueFilters = computed(() => staffFilterBadgeCount.value > 0);
const queueDensityValue = computed({
    get: () => (compactQueueRows.value ? 'compact' : 'comfortable'),
    set: (value: string) => {
        compactQueueRows.value = value === 'compact';
    },
});
const showStaffQueueSkeleton = computed(() => staffLoading.value || !staffQueueReady.value);

const scopeLabel = computed(() => {
    if (!scope.value) return 'Scope Unavailable';
    return scope.value.resolvedFrom === 'none' ? 'Scope Unresolved' : 'Scope Ready';
});

const selectedStaffContextLabel = computed(() => {
    if (!selectedStaff.value) {
        return 'Choose a staff profile from the queue to load credentialing data.';
    }

    return [
        selectedStaff.value.employeeNumber || 'No employee number',
        selectedStaff.value.jobTitle || 'No title',
        selectedStaff.value.department || 'No department',
    ].join(' / ');
});
const selectedStaffCredentialingNotApplicable = computed(() => credentialingStateNotApplicable(summary.value?.credentialingState ?? null));
const workspaceHeaderMetaText = computed(() => {
    const parts = [scopeLabel.value];
    if (selectedStaff.value) {
        parts.push(`Viewing ${staffDisplayName(selectedStaff.value)}`);
    }
    if (summary.value?.credentialingState) {
        parts.push(credentialingStateLabel(summary.value.credentialingState));
    }

    return parts.join(' | ');
});
const selectedStaffStatusLine = computed(() => {
    if (!selectedStaff.value) {
        return 'Select a staff profile to open credentialing details.';
    }

    const parts = [] as string[];
    if (selectedStaff.value.status) {
        parts.push(formatLabel(selectedStaff.value.status));
    }
    if (summary.value?.credentialingState) {
        parts.push(credentialingStateLabel(summary.value.credentialingState));
    }
    parts.push(selectedStaffHasVerifiedLinkedUser.value ? 'Email verified' : 'Email unverified');

    return parts.join(' | ');
});

const activeTabMeta = computed(() => {
    switch (activeTab.value) {
        case 'regulatory':
            return {
                label: 'Regulatory Profile',
                description: 'Primary regulator, authority level, supervision state, and local professional standing.',
            };
        case 'registrations':
            return {
                label: 'Registrations',
                description: 'Practice registration, license cycles, CPD points, and verification evidence.',
            };
        case 'alerts':
            return {
                label: 'Alerts',
                description: 'Cross-staff blockers, watch windows, and pending verification work.',
            };
        case 'audit':
            return {
                label: 'Audit',
                description: 'Who changed regulatory data, registrations, and verification decisions.',
            };
        default:
            return {
                label: 'Summary',
                description: 'Current readiness, blockers, and the best available verified registration.',
            };
    }
});

const selectedStaffHasVerifiedLinkedUser = computed(() => Boolean(selectedStaff.value?.userId) && Boolean(selectedStaff.value?.userEmailVerifiedAt));
const selectedStaffGovernanceBlockerMessage = computed(() => {
    if (!selectedStaff.value) return null;
    if (!selectedStaff.value.userId) {
        return 'Sensitive credentialing actions remain blocked until this staff profile is linked to a user account.';
    }
    if (selectedStaff.value.userEmailVerifiedAt) {
        return null;
    }

    const email = String(selectedStaff.value.userEmail ?? '').trim();
    if (email !== '') {
        return `Linked user email ${email} has not completed the invite or reset flow yet. Finish that first before updating regulatory profiles or registrations.`;
    }

    return 'Linked user email is still unverified. Finish the invite or reset flow before continuing with sensitive credentialing actions.';
});
const canSaveSelectedRegulatoryProfile = computed(() => canManageProfile.value && selectedStaffHasVerifiedLinkedUser.value);
const canManageSelectedRegistrations = computed(() => canManageRegistrations.value && selectedStaffHasVerifiedLinkedUser.value);
const canVerifySelectedRegistration = computed(() => canVerify.value && selectedStaffHasVerifiedLinkedUser.value);
const selectedStaffWorkflowGuidance = computed<WorkflowGuidance | null>(() => {
    if (!selectedStaff.value) return null;

    if (!selectedStaffHasVerifiedLinkedUser.value) {
        return {
            title: 'Resolve linked user verification',
            description:
                selectedStaffGovernanceBlockerMessage.value
                || 'Finish the invite or password setup flow before changing regulatory or registration data.',
            variant: 'destructive',
            action: null,
        };
    }

    const state = String(summary.value?.credentialingState ?? '').trim().toLowerCase();
    if (state === 'not_required') {
        return {
            title: 'Clinical credentialing not applicable',
            description: 'This staff role is non-clinical. Keep the staff profile current, but clinical credentialing and privileging do not apply unless the role becomes clinically governed.',
            variant: 'default',
            action: null,
        };
    }

    if (!regulatoryProfile.value) {
        return {
            title: 'Create regulatory profile',
            description: 'Record the regulator, cadre, practice authority, supervision level, and good standing before adding registration evidence.',
            variant: 'default',
            action: 'regulatory',
            actionLabel: 'Open Regulatory Profile',
        };
    }

    if ((summary.value?.registrationSummary.total ?? registrations.value.length) === 0) {
        return {
            title: 'Add registration evidence',
            description: 'This clinical staff member still needs a professional registration or license record before credentialing can become ready.',
            variant: 'default',
            action: 'registration',
            actionLabel: 'Open Registrations',
        };
    }

    if ((summary.value?.registrationSummary.pendingVerification ?? 0) > 0) {
        return {
            title: 'Verify pending registrations',
            description: 'At least one registration is recorded but still awaiting verification. Finish verification so the staff member can progress to privileging.',
            variant: 'default',
            action: canVerifySelectedRegistration.value ? 'verify' : 'registration',
            actionLabel: canVerifySelectedRegistration.value ? 'Review Verification' : 'Open Registrations',
        };
    }

    if (state === 'blocked') {
        return {
            title: 'Resolve blocking credentialing issues',
            description:
                summary.value?.blockingReasons.find((value) => value?.trim())
                || 'Credentialing is not ready yet. Review the summary and registration state before moving to privileging.',
            variant: 'destructive',
            action: 'registration',
            actionLabel: 'Open Registrations',
        };
    }

    if (state === 'watch') {
        return {
            title: 'Watch expiry pressure',
            description:
                summary.value?.nextExpiryAt
                ? `Credentialing is usable, but the next active registration expires ${summary.value.nextExpiryAt}. Review renewal dates and verification evidence.`
                : 'Credentialing is in a watch state. Review the active registration and upcoming renewal pressure.',
            variant: 'default',
            action: 'registration',
            actionLabel: 'Review Registrations',
        };
    }

    if (state === 'ready') {
        return {
            title: 'Ready for privileging',
            description: canReadPrivileging.value
                ? 'Credentialing is complete. Continue to Staff Privileging when you are ready to request or review clinical privileges.'
                : 'Credentialing is complete. A privileging user can now continue the workflow for this staff member.',
            variant: 'default',
            action: canReadPrivileging.value ? 'privileging' : null,
            actionLabel: canReadPrivileging.value ? 'Open Privileging' : null,
        };
    }

    return null;
});

function syncTabToUrl(): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('tab', activeTab.value);
    if (selectedStaff.value?.id) params.set('staffId', selectedStaff.value.id);
    else params.delete('staffId');
    const next = `${window.location.pathname}?${params.toString()}`;
    if (`${window.location.pathname}${window.location.search}` !== next) {
        window.history.replaceState(window.history.state, '', next);
    }
}

async function setActiveTab(tab: WorkspaceTab): Promise<void> {
    activeTab.value = tab;
    syncTabToUrl();
    if (tab === 'alerts') await loadAlerts();
    if (tab === 'audit') await loadAudit();
}

async function runSelectedStaffWorkflowGuidance(): Promise<void> {
    switch (selectedStaffWorkflowGuidance.value?.action) {
        case 'regulatory':
            await setActiveTab('regulatory');
            break;
        case 'registration':
        case 'verify':
            await setActiveTab('registrations');
            break;
        case 'privileging':
            if (selectedStaff.value) {
                window.location.href = workspaceStaffHref('/staff-privileges', selectedStaff.value);
            }
            break;
        default:
            break;
    }
}

function workspaceStaffHref(path: string, staff: StaffProfile | null): string {
    const staffId = String(staff?.id ?? '').trim();
    if (staffId === '') return path;

    return `${path}?staffId=${encodeURIComponent(staffId)}`;
}

function normalizeStaffQueueStatus(status: string | null | undefined): string {
    const normalized = String(status ?? '').trim().toLowerCase();
    return ['active', 'suspended', 'inactive'].includes(normalized) ? normalized : '';
}

async function api<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: { query?: Record<string, string | number | null | undefined>; body?: Record<string, unknown> },
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    let body: string | undefined;
    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        Object.assign(headers, csrfRequestHeaders());
        body = JSON.stringify(options?.body ?? {});
    }

    const response = await fetch(url.toString(), { method, credentials: 'same-origin', headers, body });
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

function formatLabel(value: string | null): string {
    return String(value ?? '')
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (match) => match.toUpperCase()) || 'N/A';
}

function credentialingStateLabel(value: string | null): string {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'not_required') return 'Not applicable';
    if (normalized === 'pending_verification') return 'Pending verification';
    return formatLabel(value);
}

function credentialingStateNotApplicable(value: string | null): boolean {
    return String(value ?? '').trim().toLowerCase() === 'not_required';
}

function clearWorkspaceActionMessage(): void {
    if (workspaceActionMessageTimer !== null) {
        window.clearTimeout(workspaceActionMessageTimer);
        workspaceActionMessageTimer = null;
    }

    workspaceActionMessage.value = null;
}

function showWorkspaceActionMessage(message: string): void {
    clearWorkspaceActionMessage();
    workspaceActionMessage.value = message;
    workspaceActionMessageTimer = window.setTimeout(() => {
        workspaceActionMessage.value = null;
        workspaceActionMessageTimer = null;
    }, 4000);
}

function formatRegulatorLabel(value: string | null): string {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return 'N/A';

    return regulatorLabels[normalized] ?? `${formatLabel(normalized)} (${normalized.toUpperCase()})`;
}

function staffDisplayName(profile: StaffProfile | null): string {
    if (!profile) return 'No staff selected';

    const userName = (profile.userName ?? '').trim();
    if (userName) return userName;

    const employeeNumber = (profile.employeeNumber ?? '').trim();
    if (employeeNumber) return employeeNumber;

    const jobTitle = (profile.jobTitle ?? '').trim();
    return jobTitle || profile.id;
}

function alertCountForStaff(staffProfileId: string): number {
    const targetId = String(staffProfileId ?? '').trim();
    if (!targetId) return 0;
    return alerts.value.filter((row) => String(row.staffProfileId ?? '').trim() === targetId).length;
}

function alertDisplayName(row: CredentialingAlert): string {
    const userName = (row.userName ?? '').trim();
    if (userName) return userName;

    const employeeNumber = (row.employeeNumber ?? '').trim();
    if (employeeNumber) return employeeNumber;

    const jobTitle = (row.jobTitle ?? '').trim();
    return jobTitle || 'Unknown staff';
}

function normalizeCredentialingScopeText(...values: Array<string | null | undefined>): string {
    return values
        .map((value) => String(value ?? '').trim().toLowerCase())
        .filter(Boolean)
        .join(' ');
}

function matchesCredentialingScopeKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
}

function isCredentialingRelevantRole(jobTitle: string | null | undefined, department: string | null | undefined): boolean {
    const normalized = normalizeCredentialingScopeText(jobTitle, department);
    if (!normalized) return false;
    if (matchesCredentialingScopeKeyword(normalized, supportRoleKeywords)) return false;
    return matchesCredentialingScopeKeyword(normalized, clinicalRoleKeywords);
}

function filterCredentialingStaffRows(rows: StaffProfile[]): StaffProfile[] {
    return staffFilters.clinicalOnly
        ? rows.filter((row) => isCredentialingRelevantRole(row.jobTitle, row.department))
        : rows;
}

function filterCredentialingAlerts(rows: CredentialingAlert[]): CredentialingAlert[] {
    return alertFilters.clinicalOnly
        ? rows.filter((row) => isCredentialingRelevantRole(row.jobTitle, row.department))
        : rows;
}

function formatDate(value: string | null): string {
    return value ? String(value).slice(0, 10) : 'N/A';
}

function toDateValue(value: string | null): string {
    return value ? String(value).slice(0, 10) : '';
}

function statusVariant(value: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = String(value ?? '').toLowerCase();
    if (normalized === 'active' || normalized === 'verified' || normalized === 'ready' || normalized === 'in_good_standing') return 'secondary';
    if (['blocked', 'expired', 'rejected', 'withdrawn', 'restricted', 'revoked', 'suspended'].includes(normalized)) return 'destructive';
    return 'outline';
}

function clearSelectedWorkspace(): void {
    summary.value = null;
    regulatoryProfile.value = null;
    registrations.value = [];
    registrationsMeta.value = null;
    auditRows.value = [];
    auditMeta.value = null;
    fillProfileForm(null);
}

function fillProfileForm(profile: RegulatoryProfile | null): void {
    profileForm.primaryRegulatorCode = profile?.primaryRegulatorCode ?? 'mct';
    profileForm.cadreCode = profile?.cadreCode ?? '';
    profileForm.professionalTitle = profile?.professionalTitle ?? '';
    profileForm.registrationType = profile?.registrationType ?? '';
    profileForm.practiceAuthorityLevel = profile?.practiceAuthorityLevel ?? 'independent';
    profileForm.supervisionLevel = profile?.supervisionLevel ?? 'independent';
    profileForm.goodStandingStatus = profile?.goodStandingStatus ?? 'unknown';
    profileForm.goodStandingCheckedAt = toDateValue(profile?.goodStandingCheckedAt ?? null);
    profileForm.notes = profile?.notes ?? '';
}

function resetRegistrationForm(): void {
    registrationForm.regulatorCode = regulatoryProfile.value?.primaryRegulatorCode ?? 'mct';
    registrationForm.registrationCategory = regulatoryProfile.value?.registrationType?.trim()
        || selectedStaff.value?.licenseType?.trim()
        || '';
    registrationForm.registrationNumber = '';
    registrationForm.licenseNumber = selectedStaff.value?.professionalLicenseNumber?.trim() || '';
    registrationForm.registrationStatus = 'active';
    registrationForm.licenseStatus = 'active';
    registrationForm.issuedAt = '';
    registrationForm.expiresAt = '';
    registrationForm.renewalDueAt = '';
    registrationForm.cpdCycleStartAt = '';
    registrationForm.cpdCycleEndAt = '';
    registrationForm.cpdPointsRequired = '';
    registrationForm.cpdPointsEarned = '';
    registrationForm.sourceDocumentId = '';
    registrationForm.sourceSystem = '';
    registrationForm.notes = '';
}

function fillRegistrationForm(row: Registration): void {
    registrationForm.regulatorCode = row.regulatorCode ?? 'mct';
    registrationForm.registrationCategory = row.registrationCategory ?? '';
    registrationForm.registrationNumber = row.registrationNumber ?? '';
    registrationForm.licenseNumber = row.licenseNumber ?? '';
    registrationForm.registrationStatus = row.registrationStatus ?? 'active';
    registrationForm.licenseStatus = row.licenseStatus ?? 'active';
    registrationForm.issuedAt = toDateValue(row.issuedAt);
    registrationForm.expiresAt = toDateValue(row.expiresAt);
    registrationForm.renewalDueAt = toDateValue(row.renewalDueAt);
    registrationForm.cpdCycleStartAt = toDateValue(row.cpdCycleStartAt);
    registrationForm.cpdCycleEndAt = toDateValue(row.cpdCycleEndAt);
    registrationForm.cpdPointsRequired = row.cpdPointsRequired === null ? '' : String(row.cpdPointsRequired);
    registrationForm.cpdPointsEarned = row.cpdPointsEarned === null ? '' : String(row.cpdPointsEarned);
    registrationForm.sourceDocumentId = row.sourceDocumentId ?? '';
    registrationForm.sourceSystem = row.sourceSystem ?? '';
    registrationForm.notes = row.notes ?? '';
}

function profilePayload(): Record<string, unknown> {
    return {
        primaryRegulatorCode: profileForm.primaryRegulatorCode,
        cadreCode: profileForm.cadreCode.trim(),
        professionalTitle: profileForm.professionalTitle.trim(),
        registrationType: profileForm.registrationType.trim(),
        practiceAuthorityLevel: profileForm.practiceAuthorityLevel,
        supervisionLevel: profileForm.supervisionLevel,
        goodStandingStatus: profileForm.goodStandingStatus,
        goodStandingCheckedAt: profileForm.goodStandingCheckedAt || null,
        notes: profileForm.notes.trim() || null,
    };
}

function registrationPayload(): Record<string, unknown> {
    return {
        regulatorCode: registrationForm.regulatorCode,
        registrationCategory: registrationForm.registrationCategory.trim(),
        registrationNumber: registrationForm.registrationNumber.trim(),
        licenseNumber: registrationForm.licenseNumber.trim() || null,
        registrationStatus: registrationForm.registrationStatus,
        licenseStatus: registrationForm.licenseStatus,
        issuedAt: registrationForm.issuedAt || null,
        expiresAt: registrationForm.expiresAt || null,
        renewalDueAt: registrationForm.renewalDueAt || null,
        cpdCycleStartAt: registrationForm.cpdCycleStartAt || null,
        cpdCycleEndAt: registrationForm.cpdCycleEndAt || null,
        cpdPointsRequired: registrationForm.cpdPointsRequired === '' ? null : Number(registrationForm.cpdPointsRequired),
        cpdPointsEarned: registrationForm.cpdPointsEarned === '' ? null : Number(registrationForm.cpdPointsEarned),
        sourceDocumentId: registrationForm.sourceDocumentId.trim() || null,
        sourceSystem: registrationForm.sourceSystem.trim() || null,
        notes: registrationForm.notes.trim() || null,
    };
}

async function loadStaff(targetId?: string | null): Promise<void> {
    if (!canReadStaff.value) {
        staffLoading.value = false;
        staffQueueReady.value = true;
        return;
    }
    clearStaffSearchDebounce();
    staffLoading.value = true;
    staffError.value = null;
    try {
        const response = await api<{ data: StaffProfile[]; meta: Pagination }>('GET', '/staff', {
            query: {
                q: staffFilters.q.trim() || null,
                status: staffFilters.status || null,
                clinicalOnly: staffFilters.clinicalOnly ? 1 : null,
                page: staffFilters.page,
                perPage: staffFilters.perPage,
                sortBy: 'updatedAt',
                sortDir: 'desc',
            },
        });
        staffRows.value = response.data ?? [];
        staffMeta.value = response.meta ?? null;
        const queueRows = filterCredentialingStaffRows(staffRows.value);
        selectedStaff.value =
            (targetId ? queueRows.find((row) => row.id === targetId) : null)
            ?? (selectedStaff.value ? queueRows.find((row) => row.id === selectedStaff.value?.id) : null)
            ?? queueRows[0]
            ?? null;
        syncTabToUrl();
        if (selectedStaff.value?.id) await refreshSelectedStaffWorkspace();
        else clearSelectedWorkspace();
    } catch (error) {
        staffError.value = messageFromUnknown(error, 'Unable to load staff queue.');
        staffRows.value = [];
        staffMeta.value = null;
        selectedStaff.value = null;
        clearSelectedWorkspace();
    } finally {
        staffLoading.value = false;
        staffQueueReady.value = true;
    }
}

async function fetchStaffProfileById(id: string): Promise<StaffProfile | null> {
    try {
        const response = await api<{ data: StaffProfile }>('GET', `/staff/${id}`);

        return response.data ?? null;
    } catch {
        return null;
    }
}

async function fetchStaffQueuePosition(targetId: string): Promise<StaffQueuePosition | null> {
    try {
        const response = await api<{ data: StaffQueuePosition }>('GET', `/staff/${targetId}/queue-position`, {
            query: {
                q: staffFilters.q.trim() || null,
                status: staffFilters.status || null,
                clinicalOnly: staffFilters.clinicalOnly ? 1 : null,
                perPage: staffFilters.perPage,
                sortBy: 'updatedAt',
                sortDir: 'desc',
            },
        });

        return response.data ?? null;
    } catch {
        return null;
    }
}

async function openStaffInQueue(targetId: string, options?: { preserveSearch?: boolean }): Promise<void> {
    const normalizedId = String(targetId).trim();
    if (!normalizedId) {
        await loadStaff();
        return;
    }

    const targetProfile = staffRows.value.find((row) => row.id === normalizedId) ?? (await fetchStaffProfileById(normalizedId));
    if (!targetProfile) {
        await loadStaff();
        return;
    }

    if (!options?.preserveSearch) {
        staffFilters.q = '';
    }

    staffFilters.status = normalizeStaffQueueStatus(targetProfile.status);
    if (staffFilters.clinicalOnly && !isCredentialingRelevantRole(targetProfile.jobTitle, targetProfile.department)) {
        staffFilters.clinicalOnly = false;
    }

    const queuePosition = await fetchStaffQueuePosition(normalizedId);
    staffFilters.page = queuePosition?.page ?? 1;
    await loadStaff(normalizedId);
}

async function loadSummary(): Promise<void> {
    if (!canReadCredentialing.value || !selectedStaff.value?.id) return;
    summaryLoading.value = true;
    summaryError.value = null;
    try {
        const response = await api<{ data: CredentialingSummary }>('GET', `/staff/${selectedStaff.value.id}/credentialing/summary`);
        summary.value = response.data ?? null;
    } catch (error) {
        summaryError.value = messageFromUnknown(error, 'Unable to load credentialing summary.');
        summary.value = null;
    } finally {
        summaryLoading.value = false;
    }
}

async function loadRegulatoryProfile(): Promise<void> {
    if (!canReadCredentialing.value || !selectedStaff.value?.id) return;
    profileLoading.value = true;
    profileError.value = null;
    try {
        const response = await api<{ data: RegulatoryProfile }>('GET', `/staff/${selectedStaff.value.id}/credentialing/regulatory-profile`);
        regulatoryProfile.value = response.data ?? null;
        fillProfileForm(regulatoryProfile.value);
    } catch (error) {
        const typed = error as Error & { status?: number };
        if (typed.status === 404) {
            regulatoryProfile.value = null;
            fillProfileForm(null);
        } else {
            profileError.value = messageFromUnknown(error, 'Unable to load regulatory profile.');
        }
    } finally {
        profileLoading.value = false;
    }
}

async function loadRegistrations(): Promise<void> {
    if (!canReadCredentialing.value || !selectedStaff.value?.id) return;
    registrationsLoading.value = true;
    registrationsError.value = null;
    try {
        const response = await api<{ data: Registration[]; meta: Pagination }>('GET', `/staff/${selectedStaff.value.id}/credentialing/registrations`, {
            query: {
                regulatorCode: registrationFilters.regulatorCode || null,
                verificationStatus: registrationFilters.verificationStatus || null,
                registrationStatus: registrationFilters.registrationStatus || null,
                page: registrationFilters.page,
                perPage: registrationFilters.perPage,
                sortBy: 'expiresAt',
                sortDir: 'asc',
            },
        });
        registrations.value = response.data ?? [];
        registrationsMeta.value = response.meta ?? null;
    } catch (error) {
        registrationsError.value = messageFromUnknown(error, 'Unable to load professional registrations.');
        registrations.value = [];
        registrationsMeta.value = null;
    } finally {
        registrationsLoading.value = false;
    }
}

async function loadAlerts(): Promise<void> {
    if (!canReadCredentialing.value) return;
    alertsLoading.value = true;
    alertsError.value = null;
    try {
        const response = await api<{ data: CredentialingAlert[]; meta: Pagination }>('GET', '/staff/credentialing-alerts', {
            query: {
                q: alertFilters.q.trim() || null,
                regulatorCode: alertFilters.regulatorCode || null,
                alertType: alertFilters.alertType || null,
                alertState: alertFilters.alertState || null,
                page: alertFilters.page,
                perPage: alertFilters.perPage,
                sortBy: 'expiresAt',
                sortDir: 'asc',
            },
        });
        alerts.value = response.data ?? [];
        alertsMeta.value = response.meta ?? null;
    } catch (error) {
        alertsError.value = messageFromUnknown(error, 'Unable to load credentialing alerts.');
        alerts.value = [];
        alertsMeta.value = null;
    } finally {
        alertsLoading.value = false;
    }
}

async function loadAudit(): Promise<void> {
    if (!canViewAudit.value || !selectedStaff.value?.id) return;
    auditLoading.value = true;
    auditError.value = null;
    try {
        const response = await api<{ data: CredentialingAuditLog[]; meta: Pagination }>('GET', `/staff/${selectedStaff.value.id}/credentialing/audit-logs`, {
            query: {
                q: auditFilters.q.trim() || null,
                action: auditFilters.action.trim() || null,
                actorType: auditFilters.actorType || null,
                page: auditFilters.page,
                perPage: auditFilters.perPage,
            },
        });
        auditRows.value = response.data ?? [];
        auditMeta.value = response.meta ?? null;
    } catch (error) {
        auditError.value = messageFromUnknown(error, 'Unable to load credentialing audit logs.');
        auditRows.value = [];
        auditMeta.value = null;
    } finally {
        auditLoading.value = false;
    }
}

async function refreshSelectedStaffWorkspace(): Promise<void> {
    await Promise.all([loadSummary(), loadRegulatoryProfile(), loadRegistrations()]);
    if (activeTab.value === 'audit') await loadAudit();
}

async function refreshPage(): Promise<void> {
    const targetId = selectedStaff.value?.id ?? requestedStaffId ?? null;
    await Promise.all([
        targetId ? openStaffInQueue(targetId, { preserveSearch: true }) : loadStaff(),
        loadAlerts(),
    ]);
}

async function bootstrapWorkspace(): Promise<void> {
    initialPageLoading.value = true;
    try {
        await Promise.all([
            requestedStaffId ? openStaffInQueue(requestedStaffId) : loadStaff(),
            loadAlerts(),
        ]);
    } finally {
        initialPageLoading.value = false;
    }
}

function resetStaffQueueFilters(): void {
    clearStaffSearchDebounce();
    staffFilters.q = '';
    staffFilters.status = 'active';
    staffFilters.clinicalOnly = true;
    staffFilters.page = 1;
    staffFilters.perPage = 12;
    void loadStaff();
}

function clearStaffSearchDebounce(): void {
    if (staffSearchDebounceTimer !== null) {
        window.clearTimeout(staffSearchDebounceTimer);
        staffSearchDebounceTimer = null;
    }
}

async function selectStaff(row: StaffProfile): Promise<void> {
    selectedStaff.value = row;
    clearWorkspaceActionMessage();
    syncTabToUrl();
    registrationFilters.page = 1;
    auditFilters.page = 1;
    await refreshSelectedStaffWorkspace();
}

function openStaffEditDialog(profile: StaffProfile): void {
    editDialogProfile.value = profile;
    editDialogOpen.value = true;
}

async function handleStaffProfileSaved(updated: StaffProfile): Promise<void> {
    if (selectedStaff.value?.id === updated.id) {
        selectedStaff.value = updated;
    }

    showWorkspaceActionMessage(`Updated ${staffDisplayName(updated)}.`);
    notifySuccess(`Updated ${staffDisplayName(updated)}.`);
    await refreshPage();
}

function openStaffStatusDialog(profile: StaffProfile): void {
    statusDialogProfile.value = profile;
    statusDialogOpen.value = true;
}

async function handleStaffStatusSaved(updated: StaffProfile): Promise<void> {
    if (selectedStaff.value?.id === updated.id) {
        selectedStaff.value = updated;
    }

    showWorkspaceActionMessage(`Updated ${staffDisplayName(updated)} to ${formatLabel(updated.status)}.`);
    notifySuccess(`Updated ${staffDisplayName(updated)} to ${formatLabel(updated.status)}.`);
    await refreshPage();
}

async function saveRegulatoryProfile(): Promise<void> {
    if (!selectedStaff.value?.id || !canSaveSelectedRegulatoryProfile.value || profileSaving.value) return;
    profileSaving.value = true;
    clearWorkspaceActionMessage();
    profileError.value = null;
    profileErrors.value = {};
    try {
        const method = regulatoryProfile.value?.id ? 'PATCH' : 'POST';
        await api(method, `/staff/${selectedStaff.value.id}/credentialing/regulatory-profile`, { body: profilePayload() });
        showWorkspaceActionMessage(regulatoryProfile.value?.id ? 'Regulatory profile updated.' : 'Regulatory profile created.');
        notifySuccess(regulatoryProfile.value?.id ? 'Regulatory profile updated.' : 'Regulatory profile created.');
        await Promise.all([loadSummary(), loadRegulatoryProfile(), loadAlerts()]);
    } catch (error) {
        const typed = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (typed.status === 422) {
            profileErrors.value = typed.payload?.errors ?? {};
            profileError.value = typed.payload?.message ?? 'Unable to save regulatory profile.';
        }
        else notifyError(messageFromUnknown(error, 'Unable to save regulatory profile.'));
    } finally {
        profileSaving.value = false;
    }
}

function openCreateRegistration(): void {
    if (!canManageSelectedRegistrations.value) return;
    editingRegistrationId.value = null;
    registrationDialogTitle.value = 'Add registration';
    registrationErrors.value = {};
    resetRegistrationForm();
    registrationDialogOpen.value = true;
}

function openEditRegistration(row: Registration): void {
    if (!canManageSelectedRegistrations.value) return;
    editingRegistrationId.value = row.id;
    registrationDialogTitle.value = 'Update registration';
    registrationErrors.value = {};
    fillRegistrationForm(row);
    registrationDialogOpen.value = true;
}

async function saveRegistration(): Promise<void> {
    if (!selectedStaff.value?.id || !canManageSelectedRegistrations.value || registrationSaving.value) return;
    registrationSaving.value = true;
    clearWorkspaceActionMessage();
    registrationsError.value = null;
    registrationErrors.value = {};
    try {
        if (editingRegistrationId.value) {
            await api('PATCH', `/staff/${selectedStaff.value.id}/credentialing/registrations/${editingRegistrationId.value}`, { body: registrationPayload() });
        } else {
            await api('POST', `/staff/${selectedStaff.value.id}/credentialing/registrations`, { body: registrationPayload() });
        }
        registrationDialogOpen.value = false;
        showWorkspaceActionMessage(editingRegistrationId.value ? 'Registration updated.' : 'Registration added.');
        notifySuccess(editingRegistrationId.value ? 'Registration updated.' : 'Registration added.');
        await Promise.all([loadSummary(), loadRegistrations(), loadAlerts()]);
        if (activeTab.value === 'audit') await loadAudit();
    } catch (error) {
        const typed = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (typed.status === 422) {
            registrationErrors.value = typed.payload?.errors ?? {};
            registrationsError.value = typed.payload?.message ?? 'Unable to save registration.';
        }
        else notifyError(messageFromUnknown(error, 'Unable to save registration.'));
    } finally {
        registrationSaving.value = false;
    }
}

function openVerifyRegistration(row: Registration): void {
    if (!canVerifySelectedRegistration.value) return;
    verifyRegistrationId.value = row.id;
    verificationForm.verificationStatus = row.verificationStatus === 'rejected' ? 'rejected' : 'verified';
    verificationForm.reason = row.verificationReason ?? '';
    verificationForm.verificationNotes = row.verificationNotes ?? '';
    verificationErrors.value = {};
    verifyDialogOpen.value = true;
}

async function saveVerification(): Promise<void> {
    if (!selectedStaff.value?.id || !verifyRegistrationId.value || !canVerifySelectedRegistration.value || verificationSaving.value) return;
    verificationSaving.value = true;
    clearWorkspaceActionMessage();
    registrationsError.value = null;
    verificationErrors.value = {};
    try {
        await api('PATCH', `/staff/${selectedStaff.value.id}/credentialing/registrations/${verifyRegistrationId.value}/verification`, {
            body: {
                verificationStatus: verificationForm.verificationStatus,
                reason: verificationForm.reason.trim() || null,
                verificationNotes: verificationForm.verificationNotes.trim() || null,
            },
        });
        verifyDialogOpen.value = false;
        showWorkspaceActionMessage('Registration verification updated.');
        notifySuccess('Registration verification updated.');
        await Promise.all([loadSummary(), loadRegistrations(), loadAlerts()]);
        if (activeTab.value === 'audit') await loadAudit();
    } catch (error) {
        const typed = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (typed.status === 422) {
            verificationErrors.value = typed.payload?.errors ?? {};
            registrationsError.value = typed.payload?.message ?? 'Unable to update registration verification.';
        }
        else notifyError(messageFromUnknown(error, 'Unable to update registration verification.'));
    } finally {
        verificationSaving.value = false;
    }
}

async function focusAlert(row: CredentialingAlert): Promise<void> {
    if (!canReadStaff.value) return;
    activeTab.value = 'summary';
    syncTabToUrl();
    if (row.staffProfileId) {
        await openStaffInQueue(row.staffProfileId);
        return;
    }

    staffFilters.q = row.userName ?? row.employeeNumber ?? '';
    staffFilters.page = 1;
    await loadStaff();
}

async function updateQueueClinicalOnly(checked: boolean | 'indeterminate'): Promise<void> {
    staffFilters.clinicalOnly = checked === true;
    staffFilters.page = 1;
    await loadStaff(selectedStaff.value?.id ?? null);
}

function updateAlertClinicalOnly(checked: boolean | 'indeterminate'): void {
    alertFilters.clinicalOnly = checked === true;
}

watch(
    () => staffFilters.q,
    () => {
        if (!canReadStaff.value) return;
        clearStaffSearchDebounce();
        staffSearchDebounceTimer = window.setTimeout(() => {
            staffFilters.page = 1;
            staffSearchDebounceTimer = null;
            void loadStaff();
        }, 250);
    },
);

onMounted(() => {
    void bootstrapWorkspace();
});

onBeforeUnmount(() => {
    clearWorkspaceActionMessage();
});
</script>

<template>
    <Head title="Staff Credentialing" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="shield-check" class="size-7 text-primary" />
                        Staff Credentialing
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Review regulatory profile, registrations, alerts, and audit for clinically governed staff.
                    </p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Badge variant="outline" class="hidden sm:inline-flex">Credentialing Registry</Badge>
                    <Popover>
                        <PopoverTrigger as-child>
                            <Button variant="outline" size="sm" class="px-2.5">
                                <Badge :variant="scope?.resolvedFrom === 'none' ? 'destructive' : 'secondary'">
                                    {{ scopeLabel }}
                                </Badge>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" class="w-72 space-y-1 text-xs">
                            <p v-if="scope?.tenant">Tenant: {{ scope.tenant.name }} ({{ scope.tenant.code }})</p>
                            <p v-if="scope?.facility">Facility: {{ scope.facility.name }} ({{ scope.facility.code }})</p>
                            <p>Accessible facilities: {{ scope?.userAccess?.accessibleFacilityCount ?? 'N/A' }}</p>
                            <p class="text-muted-foreground">{{ workspaceHeaderMetaText }}</p>
                            <p v-if="scope?.resolvedFrom === 'none'" class="text-destructive">Select a valid tenant or facility scope before managing credentialing records.</p>
                        </PopoverContent>
                    </Popover>
                    <Button variant="outline" size="sm" as-child>
                        <Link href="/staff">Open Staff Profiles</Link>
                    </Button>
                    <Button v-if="canReadPrivileging && selectedStaff && summary && !selectedStaffCredentialingNotApplicable" variant="outline" size="sm" as-child>
                        <Link :href="workspaceStaffHref('/staff-privileges', selectedStaff)">Open Privileging</Link>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        :disabled="staffLoading || alertsLoading || summaryLoading || profileLoading || registrationsLoading || auditLoading"
                        @click="refreshPage"
                    >
                        <AppIcon name="activity" class="size-3.5" />
                        Refresh
                    </Button>
                </div>
            </div>

            <Alert v-if="scope?.resolvedFrom === 'none'" variant="destructive">
                <AlertTitle>Scope warning</AlertTitle>
                <AlertDescription>Select a valid tenant or facility scope before managing credentialing records.</AlertDescription>
            </Alert>
            <Alert v-if="credentialingReadDenied" variant="destructive">
                <AlertTitle>Access restricted</AlertTitle>
                <AlertDescription>Request `staff.credentialing.read` permission to use this workspace.</AlertDescription>
            </Alert>

            <div class="min-w-0 space-y-3">
                <div
                    v-if="canReadStaff"
                    class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-3"
                >
                    <Button
                        variant="outline"
                        size="sm"
                        class="gap-2 bg-background"
                        :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': staffFilters.status === 'active' }"
                        @click="staffFilters.status = 'active'; staffFilters.page = 1; loadStaff()"
                    >
                        <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                        <span class="font-medium">{{ queueStatusCounts.active }}</span>
                        <span class="text-muted-foreground">Active</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        class="gap-2 bg-background"
                        :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': staffFilters.status === 'suspended' }"
                        @click="staffFilters.status = 'suspended'; staffFilters.page = 1; loadStaff()"
                    >
                        <span class="inline-block h-2 w-2 rounded-full bg-amber-500" />
                        <span class="font-medium">{{ queueStatusCounts.suspended }}</span>
                        <span class="text-muted-foreground">Suspended</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        class="gap-2 bg-background"
                        :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': staffFilters.status === 'inactive' }"
                        @click="staffFilters.status = 'inactive'; staffFilters.page = 1; loadStaff()"
                    >
                        <span class="inline-block h-2 w-2 rounded-full bg-rose-500" />
                        <span class="font-medium">{{ queueStatusCounts.inactive }}</span>
                        <span class="text-muted-foreground">Inactive</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        class="gap-2 bg-background"
                        :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': !staffFilters.status }"
                        @click="staffFilters.status = ''; staffFilters.page = 1; loadStaff()"
                    >
                        <span class="inline-block h-2 w-2 rounded-full bg-slate-400" />
                        <span class="font-medium">{{ staffQueueTotalCount }}</span>
                        <span class="text-muted-foreground">All</span>
                    </Button>
                    <div class="ml-auto flex items-center gap-2">
                        <p class="hidden text-xs text-muted-foreground sm:block">{{ credentialingQueueSummaryText }} | {{ credentialingQueueSnapshotText }}</p>
                        <Button
                            v-if="hasActiveStaffQueueFilters"
                            variant="ghost"
                            size="sm"
                            class="text-xs"
                            @click="resetStaffQueueFilters"
                        >
                            <AppIcon name="sliders-horizontal" class="size-3" />
                            Reset
                        </Button>
                    </div>
                </div>

                <div class="grid gap-4 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-stretch">
                    <Card class="flex h-full min-h-0 flex-1 flex-col gap-0 rounded-lg border-sidebar-border/70 py-0 lg:self-stretch">
                    <CardHeader class="shrink-0 border-b bg-muted/10 px-4 py-3">
                        <div class="flex flex-col gap-3">
                            <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                <div class="min-w-0 space-y-1">
                                    <CardTitle class="flex items-center gap-2 text-sm">
                                        <AppIcon name="layout-list" class="size-4 text-muted-foreground" />
                                        Select staff
                                    </CardTitle>
                                    <p class="text-xs text-muted-foreground">
                                        {{ credentialingQueueSummaryText }}
                                    </p>
                                </div>
                                <p class="text-xs text-muted-foreground sm:max-w-[12rem] sm:text-right">
                                    {{ credentialingQueueSnapshotText }}
                                </p>
                            </div>

                            <div v-if="canReadStaff" class="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <div class="relative min-w-0 flex-1">
                                    <AppIcon
                                        name="search"
                                        class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        v-model="staffFilters.q"
                                        placeholder="Search staff by name, employee number, title, or department"
                                        class="h-9 pl-9"
                                        @keyup.enter="staffFilters.page = 1; loadStaff()"
                                    />
                                </div>
                                <div class="flex items-center gap-2">
                                    <Popover>
                                        <PopoverTrigger as-child>
                                            <Button variant="outline" size="sm">
                                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                Queue options
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent class="w-72" align="end">
                                            <div class="grid gap-3">
                                                <p class="flex items-center gap-2 text-sm font-medium">
                                                    <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                                    Queue options
                                                </p>
                                                <p class="text-xs text-muted-foreground">
                                                    Filter the credentialing queue and adjust how the list reads during review.
                                                </p>
                                                <div class="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                                                    <Checkbox
                                                        id="credentialing-queue-clinical-only"
                                                        :model-value="staffFilters.clinicalOnly"
                                                        @update:model-value="updateQueueClinicalOnly"
                                                    />
                                                    <Label for="credentialing-queue-clinical-only" class="text-xs text-muted-foreground">Clinical roles only</Label>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label for="credentialing-staff-per-page">Rows per page</Label>
                                                    <Select v-model="staffFilters.perPage">
                                                        <SelectTrigger class="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                        <SelectItem value="12">12</SelectItem>
                                                        <SelectItem value="24">24</SelectItem>
                                                        <SelectItem value="48">48</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label for="credentialing-staff-density">Row density</Label>
                                                    <Select v-model="queueDensityValue">
                                                        <SelectTrigger class="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                        <SelectItem value="comfortable">Comfortable</SelectItem>
                                                        <SelectItem value="compact">Compact</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="flex items-center justify-between gap-2">
                                                    <Button size="sm" variant="outline" @click="resetStaffQueueFilters">Reset</Button>
                                                    <Button size="sm" :disabled="staffLoading || !canReadStaff" @click="staffFilters.page = 1; loadStaff()">Apply</Button>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    <Button
                                        v-if="hasActiveStaffQueueFilters"
                                        variant="ghost"
                                        size="sm"
                                        class="text-xs"
                                        @click="resetStaffQueueFilters"
                                    >
                                        Reset
                                    </Button>
                                </div>
                            </div>

                            <div v-if="canReadStaff && (staffFilters.clinicalOnly || queueDensityValue === 'compact')" class="flex flex-wrap items-center gap-2">
                                <Badge v-if="staffFilters.clinicalOnly" variant="outline" class="text-[10px] leading-none">Clinical roles only</Badge>
                                <Badge v-if="queueDensityValue === 'compact'" variant="outline" class="text-[10px] leading-none">Compact rows</Badge>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent class="flex flex-1 flex-col px-3 pb-0 pt-3">
                        <div v-if="showStaffQueueSkeleton" class="space-y-2 pb-3">
                            <div
                                v-for="index in 6"
                                :key="`credentialing-staff-skeleton-${index}`"
                                class="rounded-lg border border-border/70 bg-background/80"
                                :class="compactQueueRows ? 'p-2.5' : 'p-3'"
                            >
                                <div class="flex items-start gap-3">
                                    <Skeleton class="h-8 w-8 shrink-0 rounded-full" />
                                    <div class="min-w-0 flex-1 space-y-1.5">
                                        <Skeleton class="h-3.5 w-32 max-w-[70%]" />
                                        <Skeleton class="h-3 w-full max-w-[16rem]" />
                                    </div>
                                    <Skeleton class="h-7 w-7 shrink-0 rounded-md" />
                                </div>
                                <div class="mt-3 flex flex-wrap items-center gap-2">
                                    <Skeleton class="h-5 w-16 rounded-full" />
                                    <Skeleton class="h-5 w-16 rounded-full" />
                                    <Skeleton class="h-5 w-24 rounded-full" />
                                </div>
                            </div>
                        </div>

                        <div
                            v-else-if="staffQueueReady && visibleStaffRows.length === 0"
                            class="flex min-h-[12rem] flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center"
                        >
                            <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                <AppIcon name="shield-check" class="size-6 text-muted-foreground" />
                            </div>
                            <p class="text-sm font-medium">No credentialing staff found</p>
                            <p class="mt-1 max-w-sm text-xs text-muted-foreground">
                                {{
                                    staffRows.length === 0
                                        ? 'Try adjusting your search or filters to find a staff profile.'
                                        : 'No clinical staff profiles match the current queue filters. Turn off Clinical roles only to inspect support roles.'
                                }}
                            </p>
                        </div>

                        <div v-else class="space-y-2 pb-3">
                            <button
                                v-for="row in visibleStaffRows"
                                :key="`credentialing-row-${row.id}`"
                                type="button"
                                class="group w-full rounded-lg border text-left transition-colors"
                                :class="[
                                    selectedStaff?.id === row.id
                                        ? 'border-primary bg-primary/5 shadow-sm'
                                        : 'border-border/70 bg-background hover:bg-muted/30',
                                    compactQueueRows ? 'p-2.5' : 'p-3',
                                ]"
                                @click="selectStaff(row)"
                            >
                                <div class="flex items-start gap-3">
                                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                                        {{ (staffDisplayName(row).match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || 'ST' }}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="truncate text-sm font-medium text-foreground group-hover:text-primary">
                                                {{ staffDisplayName(row) }}
                                            </p>
                                            <Badge :variant="statusVariant(row.status)" class="text-[10px] leading-none">
                                                {{ formatLabel(row.status) }}
                                            </Badge>
                                        </div>
                                        <p class="mt-1 truncate text-xs text-muted-foreground">
                                            {{ row.employeeNumber || 'No employee number' }} / {{ row.jobTitle || 'No title' }} / {{ row.department || 'No department' }}
                                        </p>
                                    </div>
                                    <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background/80 text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                                        <AppIcon name="chevron-right" class="size-3.5" />
                                    </span>
                                </div>

                                <div class="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                    <Badge :variant="alertCountForStaff(row.id) > 0 ? 'destructive' : 'outline'" class="text-[10px] leading-none">
                                        Alerts {{ alertCountForStaff(row.id) }}
                                    </Badge>
                                    <Badge variant="outline" class="text-[10px] leading-none">
                                        {{ row.userEmailVerifiedAt ? 'Email verified' : 'Email unverified' }}
                                    </Badge>
                                </div>
                            </button>
                        </div>

                        <footer v-if="staffMeta" class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-3 py-3">
                            <p class="text-xs text-muted-foreground">
                                Showing {{ visibleStaffRows.length }} of {{ staffQueueTotalCount }} results &middot; Page {{ staffMeta.currentPage }} of {{ staffMeta.lastPage }}
                            </p>
                            <div v-if="staffMeta.lastPage > 1" class="flex items-center gap-2">
                                <Button size="sm" variant="outline" :disabled="staffLoading || staffMeta.currentPage <= 1" @click="staffFilters.page -= 1; loadStaff()">Previous</Button>
                                <Button size="sm" variant="outline" :disabled="staffLoading || staffMeta.currentPage >= staffMeta.lastPage" @click="staffFilters.page += 1; loadStaff()">Next</Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>

                <div class="flex min-h-0 flex-col gap-3 lg:h-full">
                    <template v-if="showWorkspaceBootstrapSkeleton">
                        <Card class="overflow-hidden rounded-lg border-sidebar-border/70">
                            <CardHeader class="gap-3 pb-3 pt-4">
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="min-w-0 space-y-2">
                                        <Skeleton class="h-3 w-24" />
                                        <Skeleton class="h-7 w-56 max-w-full" />
                                        <Skeleton class="h-4 w-72 max-w-full" />
                                        <Skeleton class="h-4 w-48 max-w-[80%]" />
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Skeleton class="h-8 w-24 rounded-md" />
                                        <Skeleton class="h-8 w-28 rounded-md" />
                                        <Skeleton class="h-8 w-24 rounded-md" />
                                    </div>
                                </div>
                                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div v-for="index in 4" :key="`credentialing-header-skeleton-${index}`" class="space-y-2 rounded-lg border bg-muted/20 p-3">
                                        <Skeleton class="h-3 w-24" />
                                        <Skeleton class="h-5 w-20" />
                                    </div>
                                </div>
                                <div class="flex flex-wrap items-center gap-2 border-t pt-3">
                                    <Skeleton v-for="index in 5" :key="`credentialing-tab-skeleton-${index}`" class="h-8 w-24 rounded-md" />
                                </div>
                            </CardHeader>
                        </Card>

                        <Card class="rounded-lg border-sidebar-border/70">
                            <CardContent class="space-y-4 p-6">
                                <Skeleton class="h-5 w-40" />
                                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <Skeleton v-for="index in 4" :key="`credentialing-body-card-skeleton-${index}`" class="h-24 w-full rounded-lg" />
                                </div>
                                <Skeleton class="h-28 w-full rounded-lg" />
                                <Skeleton class="h-36 w-full rounded-lg" />
                            </CardContent>
                        </Card>
                    </template>
                    <template v-else>
                    <Card class="overflow-hidden rounded-lg border-sidebar-border/70">
                        <CardHeader class="gap-3 pb-3 pt-4">
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div class="min-w-0 space-y-1">
                                    <p class="text-xs text-muted-foreground">{{ selectedStaffStatusLine }}</p>
                                    <CardTitle class="text-lg">{{ staffDisplayName(selectedStaff) }}</CardTitle>
                                    <CardDescription>{{ selectedStaffContextLabel }}</CardDescription>
                                    <p v-if="selectedStaff" class="text-xs text-muted-foreground">
                                        {{ selectedStaff.userEmail || 'No linked user email recorded' }}
                                    </p>
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
                                    <Button variant="outline" size="sm" as-child>
                                        <Link href="/staff">Open Staff</Link>
                                    </Button>
                                    <Button v-if="canReadPrivileging && selectedStaff && summary && !selectedStaffCredentialingNotApplicable" variant="outline" size="sm" as-child>
                                        <Link :href="workspaceStaffHref('/staff-privileges', selectedStaff)">Open Privileging</Link>
                                    </Button>
                                    <Button v-if="selectedStaff && canUpdateStaff" variant="outline" size="sm" @click="openStaffEditDialog(selectedStaff)">
                                        Edit Staff
                                    </Button>
                                    <Button v-if="selectedStaff && canUpdateStaffStatus" size="sm" @click="openStaffStatusDialog(selectedStaff)">
                                        Change Status
                                    </Button>
                                </div>
                            </div>
                            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div class="rounded-lg border bg-muted/20 p-3">
                                    <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Credentialing state</p>
                                    <p class="mt-2 text-sm font-medium">
                                        {{
                                            summaryLoading
                                                ? 'Loading'
                                                : summary?.credentialingState
                                                  ? credentialingStateLabel(summary.credentialingState)
                                                  : selectedStaff
                                                    ? 'Not recorded'
                                                    : 'No staff'
                                        }}
                                    </p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 p-3">
                                    <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Registrations</p>
                                    <p class="mt-2 text-sm font-medium">{{ summary?.registrationSummary.total ?? 0 }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 p-3">
                                    <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Selected staff alerts</p>
                                    <p class="mt-2 text-sm font-medium">{{ selectedStaffAlerts.length }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 p-3">
                                    <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Next expiry</p>
                                    <p class="mt-2 text-sm font-medium">{{ formatDate(summary?.nextExpiryAt ?? null) }}</p>
                                </div>
                            </div>
                            <div class="flex flex-col gap-3 border-t pt-3 lg:flex-row lg:items-center lg:justify-between">
                                <div class="flex flex-wrap items-center gap-2">
                                    <Button
                                        v-for="tab in tabOptions"
                                        :key="tab.value"
                                        size="sm"
                                       
                                        :variant="activeTab === tab.value ? 'default' : 'outline'"
                                        :disabled="tab.value !== 'alerts' && !selectedStaff"
                                        @click="setActiveTab(tab.value)"
                                    >
                                        {{ tab.label }}
                                    </Button>
                                </div>
                                <p class="text-xs text-muted-foreground">{{ activeTabMeta.description }}</p>
                            </div>
                        </CardHeader>
                    </Card>

                    <Alert v-if="workspaceActionMessage">
                        <AlertTitle>Recent action</AlertTitle>
                        <AlertDescription>{{ workspaceActionMessage }}</AlertDescription>
                    </Alert>

                    <Alert v-if="selectedStaffWorkflowGuidance" :variant="selectedStaffWorkflowGuidance.variant">
                        <AlertTitle>{{ selectedStaffWorkflowGuidance.title }}</AlertTitle>
                        <AlertDescription class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <span>{{ selectedStaffWorkflowGuidance.description }}</span>
                            <Button
                                v-if="selectedStaffWorkflowGuidance.actionLabel"
                                size="sm"
                                variant="outline"
                                class="gap-1.5 self-start lg:self-center"
                                @click="runSelectedStaffWorkflowGuidance"
                            >
                                <AppIcon name="chevron-right" class="size-3.5" />
                                {{ selectedStaffWorkflowGuidance.actionLabel }}
                            </Button>
                        </AlertDescription>
                    </Alert>

                    <Card v-if="activeTab === 'summary'" class="rounded-lg border-sidebar-border/70">
                        <CardHeader>
                            <CardTitle>Credentialing Summary</CardTitle>
                            <CardDescription>Current readiness, blockers, and the best available active registration.</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <div v-if="summaryLoading" class="space-y-2">
                                <Skeleton class="h-20 w-full" />
                                <Skeleton class="h-20 w-full" />
                            </div>
                            <Alert v-else-if="summaryError" variant="destructive">
                                <AlertTitle>Summary issue</AlertTitle>
                                <AlertDescription>{{ summaryError }}</AlertDescription>
                            </Alert>
                            <div v-else-if="!selectedStaff" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                Select a staff profile to load the credentialing summary.
                            </div>
                            <div v-else-if="summary" class="space-y-4">
                                <div class="grid gap-3 md:grid-cols-4">
                                    <div class="rounded-lg border p-3">
                                        <p class="text-xs uppercase text-muted-foreground">State</p>
                                        <p class="mt-2 text-sm font-medium">{{ credentialingStateLabel(summary.credentialingState) }}</p>
                                    </div>
                                    <div class="rounded-lg border p-3">
                                        <p class="text-xs uppercase text-muted-foreground">Verified</p>
                                        <p class="mt-2 text-sm font-medium">{{ summary.registrationSummary.verified }}</p>
                                    </div>
                                    <div class="rounded-lg border p-3">
                                        <p class="text-xs uppercase text-muted-foreground">Pending Verification</p>
                                        <p class="mt-2 text-sm font-medium">{{ summary.registrationSummary.pendingVerification }}</p>
                                    </div>
                                    <div class="rounded-lg border p-3">
                                        <p class="text-xs uppercase text-muted-foreground">Expired</p>
                                        <p class="mt-2 text-sm font-medium">{{ summary.registrationSummary.expired }}</p>
                                    </div>
                                </div>

                                <div class="rounded-lg border p-4">
                                    <p class="text-sm font-medium">{{ summary.credentialingState === 'not_required' ? 'Status Notes' : 'Blocking Reasons' }}</p>
                                    <ul v-if="summary.blockingReasons.length > 0" class="mt-2 space-y-1 text-sm text-muted-foreground">
                                        <li v-for="reason in summary.blockingReasons" :key="reason">- {{ reason }}</li>
                                    </ul>
                                    <p v-else class="mt-2 text-sm text-muted-foreground">No blocking reasons are currently recorded.</p>
                                </div>

                                <div class="rounded-lg border p-4">
                                    <p class="text-sm font-medium">Active Registration</p>
                                    <div v-if="summary.activeRegistration" class="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                                        <p>Regulator: <span class="font-medium text-foreground">{{ formatRegulatorLabel(summary.activeRegistration.regulatorCode) }}</span></p>
                                        <p>Registration #: <span class="font-medium text-foreground">{{ summary.activeRegistration.registrationNumber || 'N/A' }}</span></p>
                                        <p>License #: <span class="font-medium text-foreground">{{ summary.activeRegistration.licenseNumber || 'N/A' }}</span></p>
                                        <p>Expires: <span class="font-medium text-foreground">{{ formatDate(summary.activeRegistration.expiresAt) }}</span></p>
                                    </div>
                                    <p v-else class="mt-2 text-sm text-muted-foreground">No active registration is currently available.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card v-else-if="activeTab === 'regulatory'" class="rounded-lg border-sidebar-border/70">
                        <CardHeader>
                            <CardTitle>Regulatory Profile</CardTitle>
                            <CardDescription>Tanzania regulator, practice authority, supervision level, and good standing state.</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <div v-if="profileLoading" class="space-y-2">
                                <Skeleton class="h-20 w-full" />
                                <Skeleton class="h-40 w-full" />
                            </div>
                            <Alert v-else-if="profileError" variant="destructive">
                                <AlertTitle>Profile issue</AlertTitle>
                                <AlertDescription>{{ profileError }}</AlertDescription>
                            </Alert>
                            <div v-else-if="!selectedStaff" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                Select a staff profile to manage the regulatory profile.
                            </div>
                            <div v-else class="space-y-4">
                                <Alert v-if="!regulatoryProfile">
                                    <AlertTitle>No regulatory profile yet</AlertTitle>
                                    <AlertDescription>Create the Tanzania-facing regulatory profile before relying on privileging or coverage.</AlertDescription>
                                </Alert>

                                <div class="grid gap-4 md:grid-cols-2">
                                    <div class="space-y-2">
                                        <Label for="profile-regulator">Primary regulator</Label>
                                        <Select v-model="profileForm.primaryRegulatorCode">
                                            <SelectTrigger :disabled="!canSaveSelectedRegulatoryProfile">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem v-for="option in regulatorOptions" :key="option" :value="option">{{ formatRegulatorLabel(option) }}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p v-if="profileErrors.primaryRegulatorCode" class="text-xs text-destructive">{{ profileErrors.primaryRegulatorCode[0] }}</p>
                                    </div>
                                    <div class="space-y-2">
                                        <Label for="profile-cadre">Cadre code</Label>
                                        <Input id="profile-cadre" v-model="profileForm.cadreCode" :disabled="!canSaveSelectedRegulatoryProfile" placeholder="medical_officer, rn, lab_scientist" />
                                        <p v-if="profileErrors.cadreCode" class="text-xs text-destructive">{{ profileErrors.cadreCode[0] }}</p>
                                    </div>
                                    <div class="space-y-2">
                                        <Label for="profile-title">Professional title</Label>
                                        <Input id="profile-title" v-model="profileForm.professionalTitle" :disabled="!canSaveSelectedRegulatoryProfile" placeholder="Medical Officer" />
                                        <p v-if="profileErrors.professionalTitle" class="text-xs text-destructive">{{ profileErrors.professionalTitle[0] }}</p>
                                    </div>
                                    <div class="space-y-2">
                                        <Label for="profile-registration-type">Registration type</Label>
                                        <Input id="profile-registration-type" v-model="profileForm.registrationType" :disabled="!canSaveSelectedRegulatoryProfile" placeholder="full, provisional, limited" />
                                        <p v-if="profileErrors.registrationType" class="text-xs text-destructive">{{ profileErrors.registrationType[0] }}</p>
                                    </div>
                                    <div class="space-y-2">
                                        <Label for="profile-authority">Practice authority</Label>
                                        <Select v-model="profileForm.practiceAuthorityLevel">
                                            <SelectTrigger :disabled="!canSaveSelectedRegulatoryProfile">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem v-for="option in practiceAuthorityOptions" :key="option" :value="option">{{ formatLabel(option) }}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p v-if="profileErrors.practiceAuthorityLevel" class="text-xs text-destructive">{{ profileErrors.practiceAuthorityLevel[0] }}</p>
                                    </div>
                                    <div class="space-y-2">
                                        <Label for="profile-supervision">Supervision level</Label>
                                        <Select v-model="profileForm.supervisionLevel">
                                            <SelectTrigger :disabled="!canSaveSelectedRegulatoryProfile">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem v-for="option in supervisionOptions" :key="option" :value="option">{{ formatLabel(option) }}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p v-if="profileErrors.supervisionLevel" class="text-xs text-destructive">{{ profileErrors.supervisionLevel[0] }}</p>
                                    </div>
                                    <div class="space-y-2">
                                        <Label for="profile-good-standing">Good standing</Label>
                                        <Select v-model="profileForm.goodStandingStatus">
                                            <SelectTrigger :disabled="!canSaveSelectedRegulatoryProfile">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem v-for="option in goodStandingOptions" :key="option" :value="option">{{ formatLabel(option) }}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p v-if="profileErrors.goodStandingStatus" class="text-xs text-destructive">{{ profileErrors.goodStandingStatus[0] }}</p>
                                    </div>
                                    <div class="space-y-2">
                                        <Label for="profile-good-standing-date">Good standing checked</Label>
                                        <Input id="profile-good-standing-date" v-model="profileForm.goodStandingCheckedAt" :disabled="!canSaveSelectedRegulatoryProfile" type="date" />
                                        <p v-if="profileErrors.goodStandingCheckedAt" class="text-xs text-destructive">{{ profileErrors.goodStandingCheckedAt[0] }}</p>
                                    </div>
                                </div>

                                <div class="space-y-2">
                                    <Label for="profile-notes">Notes</Label>
                                    <Textarea id="profile-notes" v-model="profileForm.notes" :disabled="!canSaveSelectedRegulatoryProfile" rows="4" placeholder="Council references, supervision restrictions, local remarks" />
                                    <p v-if="profileErrors.notes" class="text-xs text-destructive">{{ profileErrors.notes[0] }}</p>
                                </div>

                                <div class="flex justify-end">
                                    <Button :disabled="!canSaveSelectedRegulatoryProfile || profileSaving" @click="saveRegulatoryProfile">
                                        {{ regulatoryProfile ? 'Update Profile' : 'Create Profile' }}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card v-else-if="activeTab === 'registrations'" class="rounded-lg border-sidebar-border/70">
                        <CardHeader>
                            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <CardTitle>Professional Registrations</CardTitle>
                                    <CardDescription>Track registration, license, CPD cycle, and verification state.</CardDescription>
                                </div>
                                <Button v-if="selectedStaff" class="gap-1.5" :disabled="!canManageSelectedRegistrations" @click="openCreateRegistration">
                                    <AppIcon name="plus" class="size-3.5" />
                                    Add Registration
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <div v-if="!selectedStaff" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                Select a staff profile to manage professional registrations.
                            </div>
                            <template v-else>
                                <div class="grid gap-3 md:grid-cols-4">
                                    <Select v-model="registrationFilters.regulatorCode">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">All regulators</SelectItem>
                                        <SelectItem v-for="option in regulatorOptions" :key="option" :value="option">{{ formatRegulatorLabel(option) }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select v-model="registrationFilters.registrationStatus">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">All registration states</SelectItem>
                                        <SelectItem v-for="option in registrationStatusOptions" :key="option" :value="option">{{ formatLabel(option) }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select v-model="registrationFilters.verificationStatus">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">All verification states</SelectItem>
                                        <SelectItem v-for="option in verificationStatusOptions" :key="option" :value="option">{{ formatLabel(option) }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" :disabled="registrationsLoading" @click="registrationFilters.page = 1; loadRegistrations()">Apply Filters</Button>
                                </div>

                                <Alert v-if="registrationsError" variant="destructive">
                                    <AlertTitle>Registration issue</AlertTitle>
                                    <AlertDescription>{{ registrationsError }}</AlertDescription>
                                </Alert>
                                <div v-else-if="registrationsLoading" class="space-y-2">
                                    <Skeleton class="h-24 w-full" />
                                    <Skeleton class="h-24 w-full" />
                                </div>
                                <div v-else-if="registrations.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                    No registrations match the current filters.
                                </div>
                                <div v-else class="space-y-3">
                                    <div v-for="row in registrations" :key="row.id" class="rounded-lg border p-4">
                                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div class="space-y-1">
                                                <p class="text-sm font-medium">{{ formatRegulatorLabel(row.regulatorCode) }} - {{ row.registrationNumber || 'No registration number' }}</p>
                                                <p class="text-xs text-muted-foreground">
                                                    {{ row.registrationCategory || 'No category' }} - License {{ row.licenseNumber || 'N/A' }} - Expires {{ formatDate(row.expiresAt) }}
                                                </p>
                                            </div>
                                            <div class="flex flex-wrap gap-2">
                                                <Badge :variant="statusVariant(row.registrationStatus)">{{ formatLabel(row.registrationStatus) }}</Badge>
                                                <Badge :variant="statusVariant(row.licenseStatus)">{{ formatLabel(row.licenseStatus) }}</Badge>
                                                <Badge :variant="statusVariant(row.verificationStatus)">{{ formatLabel(row.verificationStatus) }}</Badge>
                                            </div>
                                        </div>
                                        <div class="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                                            <p>Renewal due: <span class="font-medium text-foreground">{{ formatDate(row.renewalDueAt) }}</span></p>
                                            <p>CPD: <span class="font-medium text-foreground">{{ row.cpdPointsEarned ?? 0 }} / {{ row.cpdPointsRequired ?? 0 }}</span></p>
                                        </div>
                                        <div class="mt-3 flex flex-wrap items-center gap-2">
                                            <Button size="sm" variant="outline" :disabled="!canManageSelectedRegistrations" @click="openEditRegistration(row)">Edit</Button>
                                            <Button size="sm" variant="outline" :disabled="!canVerifySelectedRegistration" @click="openVerifyRegistration(row)">Verify</Button>
                                        </div>
                                    </div>
                                </div>

                                <div v-if="registrationsMeta" class="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Page {{ registrationsMeta.currentPage }} of {{ registrationsMeta.lastPage }}</span>
                                    <div v-if="registrationsMeta.lastPage > 1" class="flex items-center gap-2">
                                        <Button size="sm" variant="outline" :disabled="registrationsLoading || registrationsMeta.currentPage <= 1" @click="registrationFilters.page -= 1; loadRegistrations()">Prev</Button>
                                        <Button size="sm" variant="outline" :disabled="registrationsLoading || registrationsMeta.currentPage >= registrationsMeta.lastPage" @click="registrationFilters.page += 1; loadRegistrations()">Next</Button>
                                    </div>
                                </div>
                            </template>
                        </CardContent>
                    </Card>

                    <Card v-else-if="activeTab === 'alerts'" class="rounded-lg border-sidebar-border/70">
                        <CardHeader>
                            <CardTitle>Credentialing Alerts</CardTitle>
                            <CardDescription>Cross-staff blockers, pending verification, and watch-window expiry risk.</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <div class="grid gap-3 md:grid-cols-4">
                                <Input v-model="alertFilters.q" placeholder="Name, employee number, title, department" @keyup.enter="alertFilters.page = 1; loadAlerts()" />
                                <Select v-model="alertFilters.regulatorCode">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="">All regulators</SelectItem>
                                    <SelectItem v-for="option in regulatorOptions" :key="option" :value="option">{{ formatRegulatorLabel(option) }}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select v-model="alertFilters.alertType">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="">All alert types</SelectItem>
                                    <SelectItem v-for="option in alertTypeOptions" :key="option" :value="option">{{ formatLabel(option) }}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select v-model="alertFilters.alertState">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="">All alert states</SelectItem>
                                    <SelectItem v-for="option in alertStateOptions" :key="option" :value="option">{{ formatLabel(option) }}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                                <Checkbox id="credentialing-alert-clinical-only" :model-value="alertFilters.clinicalOnly" @update:model-value="updateAlertClinicalOnly" />
                                <Label for="credentialing-alert-clinical-only" class="text-xs text-muted-foreground">Clinical roles only</Label>
                            </div>
                            <Button variant="outline" :disabled="alertsLoading" @click="alertFilters.page = 1; loadAlerts()">Refresh Alerts</Button>

                            <Alert v-if="alertsError" variant="destructive">
                                <AlertTitle>Alert issue</AlertTitle>
                                <AlertDescription>{{ alertsError }}</AlertDescription>
                            </Alert>
                            <div v-else-if="alertsLoading" class="space-y-2">
                                <Skeleton class="h-24 w-full" />
                                <Skeleton class="h-24 w-full" />
                            </div>
                            <div v-else-if="visibleAlerts.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                {{
                                    alerts.length === 0
                                        ? 'No credentialing alerts match the current filters.'
                                        : 'No clinical credentialing alerts match the current page. Turn off Clinical roles only to inspect support-role alerts.'
                                }}
                            </div>
                            <div v-else class="space-y-3">
                                <div
                                    v-for="row in visibleAlerts"
                                    :key="row.id"
                                    class="rounded-lg border p-4"
                                    :class="selectedStaff?.id === row.staffProfileId ? 'border-primary bg-primary/5' : ''"
                                >
                                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-sm font-medium">{{ alertDisplayName(row) }} | {{ formatDate(row.expiresAt) }}</p>
                                            <p class="text-xs text-muted-foreground">
                                                {{ row.employeeNumber || 'No employee number' }} | {{ formatLabel(row.alertType) }}
                                            </p>
                                            <p class="text-sm text-muted-foreground">{{ row.summary || 'No summary available.' }}</p>
                                        </div>
                                        <div class="flex flex-wrap gap-2">
                                            <Badge :variant="statusVariant(row.alertState)">{{ formatLabel(row.alertState) }}</Badge>
                                            <Badge variant="outline">{{ formatLabel(row.alertType) }}</Badge>
                                        </div>
                                    </div>
                                    <div class="mt-3 flex flex-wrap gap-2">
                                        <Button size="sm" variant="outline" :disabled="!canReadStaff" @click="focusAlert(row)">Open Staff</Button>
                                    </div>
                                </div>
                            </div>

                            <div v-if="alertsMeta" class="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Page {{ alertsMeta.currentPage }} of {{ alertsMeta.lastPage }}</span>
                                <div v-if="alertsMeta.lastPage > 1" class="flex items-center gap-2">
                                    <Button size="sm" variant="outline" :disabled="alertsLoading || alertsMeta.currentPage <= 1" @click="alertFilters.page -= 1; loadAlerts()">Prev</Button>
                                    <Button size="sm" variant="outline" :disabled="alertsLoading || alertsMeta.currentPage >= alertsMeta.lastPage" @click="alertFilters.page += 1; loadAlerts()">Next</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card v-else class="rounded-lg border-sidebar-border/70">
                        <CardHeader>
                            <CardTitle>Credentialing Audit</CardTitle>
                            <CardDescription>Who changed the regulatory profile, registrations, and verification state.</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <div v-if="!selectedStaff" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                Select a staff profile to load credentialing audit logs.
                            </div>
                            <template v-else>
                                <Alert v-if="auditDenied" variant="destructive">
                                    <AlertTitle>Audit access restricted</AlertTitle>
                                    <AlertDescription>Request `staff.credentialing.view-audit-logs` permission to review the timeline.</AlertDescription>
                                </Alert>
                                <template v-else>
                                    <div class="grid gap-3 md:grid-cols-4">
                                        <Input v-model="auditFilters.q" placeholder="Search action or payload" @keyup.enter="auditFilters.page = 1; loadAudit()" />
                                        <Input v-model="auditFilters.action" placeholder="Action code" @keyup.enter="auditFilters.page = 1; loadAudit()" />
                                        <Select v-model="auditFilters.actorType">
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem value="">All actor types</SelectItem>
                                            <SelectItem value="user">User</SelectItem>
                                            <SelectItem value="system">System</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button variant="outline" :disabled="auditLoading" @click="auditFilters.page = 1; loadAudit()">Refresh Audit</Button>
                                    </div>

                                    <Alert v-if="auditError" variant="destructive">
                                        <AlertTitle>Audit issue</AlertTitle>
                                        <AlertDescription>{{ auditError }}</AlertDescription>
                                    </Alert>
                                    <div v-else-if="auditLoading" class="space-y-2">
                                        <Skeleton class="h-20 w-full" />
                                        <Skeleton class="h-20 w-full" />
                                    </div>
                                    <div v-else-if="auditRows.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                        No credentialing audit logs match the current filters.
                                    </div>
                                    <div v-else class="space-y-3">
                                        <div v-for="row in auditRows" :key="row.id" class="rounded-lg border p-4">
                                            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <p class="text-sm font-medium">{{ row.actionLabel || formatLabel(row.action) }}</p>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{ row.actor?.displayName || `Actor ${row.actorId ?? 'system'}` }} - {{ formatDate(row.createdAt) }}
                                                    </p>
                                                </div>
                                                <Badge variant="outline">{{ formatLabel(row.actorType) }}</Badge>
                                            </div>
                                        </div>
                                    </div>

                                    <div v-if="auditMeta" class="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Page {{ auditMeta.currentPage }} of {{ auditMeta.lastPage }}</span>
                                        <div v-if="auditMeta.lastPage > 1" class="flex items-center gap-2">
                                            <Button size="sm" variant="outline" :disabled="auditLoading || auditMeta.currentPage <= 1" @click="auditFilters.page -= 1; loadAudit()">Prev</Button>
                                            <Button size="sm" variant="outline" :disabled="auditLoading || auditMeta.currentPage >= auditMeta.lastPage" @click="auditFilters.page += 1; loadAudit()">Next</Button>
                                        </div>
                                    </div>
                                </template>
                            </template>
                        </CardContent>
                    </Card>
                    </template>
                    </div>
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-2.5">
                <span class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <AppIcon name="activity" class="size-3.5" />
                    Care workflow:
                </span>
                <Button size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="workspaceStaffHref('/staff', selectedStaff)">
                        <AppIcon name="users" class="size-3.5" />
                        Staff Directory
                    </Link>
                </Button>
                <Button size="sm" class="gap-1.5">
                    <AppIcon name="badge-check" class="size-3.5" />
                    Credentialing
                </Button>
                <Button v-if="canReadPrivileging" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="workspaceStaffHref('/staff-privileges', selectedStaff)">
                        <AppIcon name="shield-check" class="size-3.5" />
                        Privileging &amp; Coverage
                    </Link>
                </Button>
                <span v-if="selectedStaff" class="text-xs text-muted-foreground">
                    Viewing {{ staffDisplayName(selectedStaff) }}
                </span>
            </div>
        </div>
        <StaffProfileEditDialog
            :open="editDialogOpen"
            :profile="editDialogProfile"
            @update:open="(open) => (editDialogOpen = open)"
            @saved="handleStaffProfileSaved"
        />

        <StaffProfileStatusDialog
            :open="statusDialogOpen"
            :profile="statusDialogProfile"
            @update:open="(open) => (statusDialogOpen = open)"
            @saved="handleStaffStatusSaved"
        />

        <Dialog v-model:open="registrationDialogOpen">
            <DialogContent size="3xl">
                <DialogHeader>
                    <DialogTitle>{{ registrationDialogTitle }}</DialogTitle>
                    <DialogDescription>Registration, license, CPD, and evidence source for the selected staff member.</DialogDescription>
                </DialogHeader>
                <div class="grid gap-4 py-2 md:grid-cols-2">
                    <div class="space-y-2">
                        <Label for="registration-regulator">Regulator</Label>
                        <Select v-model="registrationForm.regulatorCode">
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem v-for="option in regulatorOptions" :key="option" :value="option">{{ formatRegulatorLabel(option) }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="registrationErrors.regulatorCode" class="text-xs text-destructive">{{ registrationErrors.regulatorCode[0] }}</p>
                    </div>
                    <div class="space-y-2">
                        <Label for="registration-category">Registration category</Label>
                        <Input id="registration-category" v-model="registrationForm.registrationCategory" placeholder="full, provisional, limited" />
                        <p v-if="registrationErrors.registrationCategory" class="text-xs text-destructive">{{ registrationErrors.registrationCategory[0] }}</p>
                    </div>
                    <div class="space-y-2">
                        <Label for="registration-number">Registration number</Label>
                        <Input id="registration-number" v-model="registrationForm.registrationNumber" />
                        <p v-if="registrationErrors.registrationNumber" class="text-xs text-destructive">{{ registrationErrors.registrationNumber[0] }}</p>
                    </div>
                    <div class="space-y-2">
                        <Label for="license-number">License number</Label>
                        <Input id="license-number" v-model="registrationForm.licenseNumber" />
                        <p v-if="registrationErrors.licenseNumber" class="text-xs text-destructive">{{ registrationErrors.licenseNumber[0] }}</p>
                    </div>
                    <div class="space-y-2">
                        <Label for="registration-status">Registration status</Label>
                        <Select v-model="registrationForm.registrationStatus">
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem v-for="option in registrationStatusOptions" :key="option" :value="option">{{ formatLabel(option) }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="space-y-2">
                        <Label for="license-status">License status</Label>
                        <Select v-model="registrationForm.licenseStatus">
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem v-for="option in licenseStatusOptions" :key="option" :value="option">{{ formatLabel(option) }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="space-y-2">
                        <Label for="issued-at">Issued at</Label>
                        <Input id="issued-at" v-model="registrationForm.issuedAt" type="date" />
                    </div>
                    <div class="space-y-2">
                        <Label for="expires-at">Expires at</Label>
                        <Input id="expires-at" v-model="registrationForm.expiresAt" type="date" />
                        <p v-if="registrationErrors.expiresAt" class="text-xs text-destructive">{{ registrationErrors.expiresAt[0] }}</p>
                    </div>
                    <div class="space-y-2">
                        <Label for="renewal-due-at">Renewal due</Label>
                        <Input id="renewal-due-at" v-model="registrationForm.renewalDueAt" type="date" />
                    </div>
                    <div class="space-y-2">
                        <Label for="source-system">Source system</Label>
                        <Input id="source-system" v-model="registrationForm.sourceSystem" placeholder="manual, council portal import" />
                    </div>
                    <div class="space-y-2">
                        <Label for="cpd-cycle-start">CPD cycle start</Label>
                        <Input id="cpd-cycle-start" v-model="registrationForm.cpdCycleStartAt" type="date" />
                    </div>
                    <div class="space-y-2">
                        <Label for="cpd-cycle-end">CPD cycle end</Label>
                        <Input id="cpd-cycle-end" v-model="registrationForm.cpdCycleEndAt" type="date" />
                    </div>
                    <div class="space-y-2">
                        <Label for="cpd-required">CPD points required</Label>
                        <Input id="cpd-required" v-model="registrationForm.cpdPointsRequired" type="number" min="0" />
                    </div>
                    <div class="space-y-2">
                        <Label for="cpd-earned">CPD points earned</Label>
                        <Input id="cpd-earned" v-model="registrationForm.cpdPointsEarned" type="number" min="0" />
                    </div>
                    <div class="space-y-2 md:col-span-2">
                        <Label for="source-document-id">Source document ID</Label>
                        <Input id="source-document-id" v-model="registrationForm.sourceDocumentId" placeholder="Optional staff document UUID" />
                        <p v-if="registrationErrors.sourceDocumentId" class="text-xs text-destructive">{{ registrationErrors.sourceDocumentId[0] }}</p>
                    </div>
                    <div class="space-y-2 md:col-span-2">
                        <Label for="registration-notes">Notes</Label>
                        <Textarea id="registration-notes" v-model="registrationForm.notes" rows="4" placeholder="Renewal notes, council remarks, local exceptions" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="registrationDialogOpen = false">Cancel</Button>
                    <Button :disabled="registrationSaving || !canManageSelectedRegistrations" @click="saveRegistration">Save Registration</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="verifyDialogOpen">
            <DialogContent size="xl">
                <DialogHeader>
                    <DialogTitle>Update Verification</DialogTitle>
                    <DialogDescription>Mark the registration as verified, pending, or rejected.</DialogDescription>
                </DialogHeader>
                <div class="space-y-4 py-2">
                    <div class="space-y-2">
                        <Label for="verification-status">Verification status</Label>
                        <Select v-model="verificationForm.verificationStatus">
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem v-for="option in verificationStatusOptions" :key="option" :value="option">{{ formatLabel(option) }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="verificationErrors.verificationStatus" class="text-xs text-destructive">{{ verificationErrors.verificationStatus[0] }}</p>
                    </div>
                    <div class="space-y-2">
                        <Label for="verification-reason">Reason</Label>
                        <Input id="verification-reason" v-model="verificationForm.reason" placeholder="Required when rejected" />
                        <p v-if="verificationErrors.reason" class="text-xs text-destructive">{{ verificationErrors.reason[0] }}</p>
                    </div>
                    <div class="space-y-2">
                        <Label for="verification-notes">Verification notes</Label>
                        <Textarea id="verification-notes" v-model="verificationForm.verificationNotes" rows="4" />
                        <p v-if="verificationErrors.verificationNotes" class="text-xs text-destructive">{{ verificationErrors.verificationNotes[0] }}</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="verifyDialogOpen = false">Cancel</Button>
                    <Button :disabled="verificationSaving || !canVerifySelectedRegistration" @click="saveVerification">Save Verification</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>

