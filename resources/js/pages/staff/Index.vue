<script setup lang="ts">
import { Head, Link, usePage } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import StaffProfileEditDialog from '@/components/staff/StaffProfileEditDialog.vue';
import StaffProfileStatusDialog from '@/components/staff/StaffProfileStatusDialog.vue';
import StaffUserLookupField from '@/components/staff/StaffUserLookupField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input, SearchInput } from '@/components/ui/input';
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
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import AppLayout from '@/layouts/AppLayout.vue';
import { csrfRequestHeaders } from '@/lib/csrf';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { type BreadcrumbItem } from '@/types';
import type { Auth } from '@/types/auth';
import type { SharedPlatformContext, SharedPlatformScope } from '@/types/platform';

type ScopeData = {
    resolvedFrom: string;
    tenant: { code: string; name: string } | null;
    facility: { code: string; name: string } | null;
    userAccess?: { accessibleFacilityCount?: number };
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
    statusReason: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type StaffListResponse = {
    data: StaffProfile[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type StaffProfileResponse = {
    data: StaffProfile;
};

type StaffStatusCounts = {
    active: number;
    suspended: number;
    inactive: number;
    other: number;
    total: number;
};

type StaffStatusCountsResponse = {
    data: StaffStatusCounts;
};

type StaffCredentialingSummary = {
    id?: string | null;
    credentialingState: string | null;
    blockingReasons: string[];
    nextExpiryAt: string | null;
    registrationSummary: {
        total: number;
        verified: number;
        pendingVerification: number;
        expired: number;
    };
};

type StaffCredentialingSummaryBatchResponse = {
    data: StaffCredentialingSummary[];
};

type StaffSpecialtyAssignment = {
    id: string | null;
    staffProfileId: string | null;
    specialtyId: string | null;
    isPrimary: boolean;
    specialty: {
        id: string | null;
        tenantId?: string | null;
        code: string | null;
        name: string | null;
        description?: string | null;
        status?: string | null;
        statusReason?: string | null;
    } | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

type StaffSpecialtyAssignmentListResponse = {
    data: StaffSpecialtyAssignment[];
};

type StaffProfileAuditLog = {
    id: string;
    staffProfileId: string | null;
    actorId: number | null;
    actorType?: 'user' | 'system' | null;
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

type StaffProfileAuditLogListResponse = {
    data: StaffProfileAuditLog[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type StaffDocument = {
    id: string;
    staffProfileId: string | null;
    tenantId: string | null;
    documentType: string | null;
    title: string | null;
    description: string | null;
    originalFilename: string | null;
    mimeType: string | null;
    fileSizeBytes: number | null;
    checksumSha256: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    verificationStatus: string | null;
    verificationReason: string | null;
    status: string | null;
    statusReason: string | null;
    uploadedByUserId: number | null;
    verifiedByUserId: number | null;
    verifiedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type StaffDocumentListResponse = {
    data: StaffDocument[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type StaffDocumentAuditLog = {
    id: string;
    staffDocumentId: string | null;
    actorId: number | null;
    actorType?: 'user' | 'system' | null;
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

type StaffDocumentAuditLogListResponse = {
    data: StaffDocumentAuditLog[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type ValidationErrorResponse = {
    message?: string;
    errors?: Record<string, string[]>;
};


type DepartmentRecord = {
    id: string | null;
    code: string | null;
    name: string | null;
    status: string | null;
    serviceType?: string | null;
};

type DepartmentListResponse = {
    data: Array<DepartmentRecord | DepartmentOption>;
};

type DepartmentOption = SearchableSelectOption;

type SearchForm = {
    q: string;
    status: string;
    department: string;
    employmentType: string;
    perPage: number;
    page: number;
};

type CreateForm = {
    userId: string;
    departmentId?: string;
    department?: string;
    jobTitle: string;
    professionalLicenseNumber: string;
    licenseType: string;
    phoneExtension: string;
    employmentType: 'full_time' | 'part_time' | 'contract' | 'locum';
};

type CreateLinkedUser = {
    id: number | null;
    name: string | null;
    email: string | null;
    displayName: string;
    emailVerifiedAt: string | null;
    roleLabels: string[];
    facilityLabels: string[];
    primaryFacilityLabel: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Staff', href: '/staff' }];
const page = usePage<{ auth: Auth; platform: SharedPlatformContext }>();

function permissionNameSetFromPageProps(): Set<string> {
    const permissionNames = Array.isArray(page.props.auth?.permissions) ? page.props.auth.permissions : [];
    return new Set(permissionNames.map((permission) => permission?.trim()).filter(Boolean));
}

function normalizeSharedScope(scopeValue: SharedPlatformScope): ScopeData | null {
    if (!scopeValue) return null;

    return {
        resolvedFrom: scopeValue.resolvedFrom ?? 'none',
        tenant:
            scopeValue.tenant && (scopeValue.tenant.code || scopeValue.tenant.name)
                ? {
                      code: scopeValue.tenant.code ?? '',
                      name: scopeValue.tenant.name ?? '',
                  }
                : null,
        facility:
            scopeValue.facility && (scopeValue.facility.code || scopeValue.facility.name)
                ? {
                      code: scopeValue.facility.code ?? '',
                      name: scopeValue.facility.name ?? '',
                  }
                : null,
        userAccess: {
            accessibleFacilityCount: scopeValue.userAccess?.accessibleFacilityCount,
        },
    };
}

const initialPermissionNames = permissionNameSetFromPageProps();
const initialScope = normalizeSharedScope(page.props.platform?.scope ?? null);
const documentUploadMaxBytes = computed(() => {
    const candidate = Number(page.props.platform?.uploadLimits?.documentMaxBytes ?? 0);
    return Number.isFinite(candidate) && candidate > 0 ? candidate : 20 * 1024 * 1024;
});
const documentUploadMaxLabel = computed(() => {
    const label = String(page.props.platform?.uploadLimits?.documentMaxLabel ?? '').trim();
    return label !== '' ? label : '20MB';
});

const loading = ref(true);
const listLoading = ref(false);
const createLoading = ref(false);
const createSheetOpen = ref(false);
const actionLoadingId = ref<string | null>(null);
const listErrors = ref<string[]>([]);
const createErrors = ref<Record<string, string[]>>({});
const createMessage = ref<string | null>(null);
const createLinkedUser = ref<CreateLinkedUser | null>(null);
const actionMessage = ref<string | null>(null);
let actionMessageTimer: number | null = null;
const scope = ref<ScopeData | null>(initialScope);
const scopeLoaded = ref(true);
const staffProfiles = ref<StaffProfile[]>([]);
const staffStatusCounts = ref<StaffStatusCounts | null>(null);
const pagination = ref<StaffListResponse['meta'] | null>(null);
const canReadStaff = ref(initialPermissionNames.has('staff.read'));
const canCreateStaff = ref(initialPermissionNames.has('staff.create'));
const canUpdateStaff = ref(initialPermissionNames.has('staff.update'));
const canUpdateStaffStatus = ref(initialPermissionNames.has('staff.update-status'));
const canReadDepartments = ref(initialPermissionNames.has('departments.read'));
const canReadStaffCredentialing = ref(initialPermissionNames.has('staff.credentialing.read'));
const canReadStaffPrivileges = ref(initialPermissionNames.has('staff.privileges.read'));
const canReadPlatformUsers = ref(initialPermissionNames.has('platform.users.read'));
const canReadStaffSpecialties = ref(initialPermissionNames.has('staff.specialties.read'));
const canViewStaffAudit = ref(initialPermissionNames.has('staff.view-audit-logs'));
const canReadStaffDocuments = ref(initialPermissionNames.has('staff.documents.read'));
const canCreateStaffDocuments = ref(initialPermissionNames.has('staff.documents.create'));
const canUpdateStaffDocuments = ref(initialPermissionNames.has('staff.documents.update'));
const canVerifyStaffDocuments = ref(initialPermissionNames.has('staff.documents.verify'));
const canUpdateStaffDocumentStatus = ref(initialPermissionNames.has('staff.documents.update-status'));
const canViewStaffDocumentAudit = ref(initialPermissionNames.has('staff.documents.view-audit-logs'));
const permissionsLoaded = ref(true);
const departmentOptionsLoading = ref(false);
const departmentOptions = ref<DepartmentOption[]>([]);
const auditActorTypeOptions = [
    { value: '', label: 'All actors' },
    { value: 'user', label: 'User only' },
    { value: 'system', label: 'System only' },
];
const staffDocumentTypes = [
    'cv',
    'employment_contract',
    'offer_letter',
    'license_copy',
    'certificate',
    'id_copy',
    'other',
];
const showAdvancedStaffFilters = useLocalStorageBoolean('opd.staff.filters.advanced', false);
const compactQueueRows = useLocalStorageBoolean('opd.staff.queueRows.compact', false);
const mobileFiltersDrawerOpen = ref(false);
const detailsSheetOpen = ref(false);
const detailsSheetStaff = ref<StaffProfile | null>(null);
const editDialogOpen = ref(false);
const editDialogProfile = ref<StaffProfile | null>(null);
const staffCredentialingSummaries = ref<Record<string, StaffCredentialingSummary | null>>({});
const credentialingSummariesLoading = ref(false);
const detailsAuditLoading = ref(false);
const detailsAuditError = ref<string | null>(null);
const detailsAuditLogs = ref<StaffProfileAuditLog[]>([]);
const detailsAuditMeta = ref<StaffProfileAuditLogListResponse['meta'] | null>(null);
const detailsAuditExporting = ref(false);
const detailsSheetTab = ref('overview');
const detailsSpecialtiesLoading = ref(false);
const detailsSpecialtiesError = ref<string | null>(null);
const detailsSpecialties = ref<StaffSpecialtyAssignment[]>([]);
const detailsAuditFiltersOpen = ref(false);
const detailsDocumentFiltersOpen = ref(false);
const detailsDocumentUploadDialogOpen = ref(false);
const detailsDocumentUploadFileInputRef = ref<HTMLInputElement | null>(null);
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
const statusDialogOpen = ref(false);
const statusDialogProfile = ref<StaffProfile | null>(null);
const statusDialogTarget = ref<'active' | 'suspended' | null>(null);
const statusDialogReason = ref('');
const statusDialogError = ref<string | null>(null);
const detailsDocumentsLoading = ref(false);
const detailsDocumentsError = ref<string | null>(null);
const detailsDocuments = ref<StaffDocument[]>([]);
const detailsDocumentMeta = ref<StaffDocumentListResponse['meta'] | null>(null);
const detailsDocumentFilters = reactive({
    q: '',
    documentType: '',
    status: '',
    verificationStatus: '',
    expiresFrom: '',
    expiresTo: '',
    sortBy: 'createdAt',
    sortDir: 'desc',
    page: 1,
    perPage: 10,
});
const detailsDocumentUploadLoading = ref(false);
const detailsDocumentUploadErrors = ref<Record<string, string[]>>({});
const detailsSheetActionMessage = ref<string | null>(null);
const detailsDocumentUploadFile = ref<File | null>(null);
const detailsDocumentUploadInputKey = ref(0);
const detailsDocumentUploadForm = reactive({
    documentType: 'cv',
    title: '',
    description: '',
    issuedAt: '',
    expiresAt: '',
});
const documentMetadataDialogOpen = ref(false);
const documentMetadataDialogDocument = ref<StaffDocument | null>(null);
const documentMetadataDialogLoading = ref(false);
const documentMetadataDialogError = ref<string | null>(null);
const documentMetadataDialogErrors = ref<Record<string, string[]>>({});
const documentMetadataForm = reactive({
    documentType: 'cv',
    title: '',
    description: '',
    issuedAt: '',
    expiresAt: '',
});
const documentVerificationDialogOpen = ref(false);
const documentVerificationDialogDocument = ref<StaffDocument | null>(null);
const documentVerificationDialogLoading = ref(false);
const documentVerificationDialogError = ref<string | null>(null);
const documentVerificationDialogErrors = ref<Record<string, string[]>>({});
const documentVerificationStatus = ref<'pending' | 'verified' | 'rejected'>('pending');
const documentVerificationReason = ref('');
const documentStatusDialogOpen = ref(false);
const documentStatusDialogDocument = ref<StaffDocument | null>(null);
const documentStatusDialogLoading = ref(false);
const documentStatusDialogError = ref<string | null>(null);
const documentStatusDialogErrors = ref<Record<string, string[]>>({});
const documentStatusDialogTarget = ref<'active' | 'archived'>('active');
const documentStatusDialogReason = ref('');
const detailsDocumentAuditDocument = ref<StaffDocument | null>(null);
const detailsDocumentAuditLoading = ref(false);
const detailsDocumentAuditError = ref<string | null>(null);
const detailsDocumentAuditLogs = ref<StaffDocumentAuditLog[]>([]);
const detailsDocumentAuditMeta = ref<StaffDocumentAuditLogListResponse['meta'] | null>(null);
const detailsDocumentAuditFilters = reactive({
    q: '',
    action: '',
    actorType: '',
    actorId: '',
    from: '',
    to: '',
    page: 1,
    perPage: 20,
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

const pendingOpenStaffId = ref(queryParam('staffId'));

const searchForm = reactive<SearchForm>({
    q: queryParam('q'),
    status: queryParam('status') || 'active',
    department: queryParam('department'),
    employmentType: queryParam('employmentType'),
    perPage: queryNumberParam('perPage', 12, { allowed: [12, 24, 48] }),
    page: queryNumberParam('page', 1, { min: 1 }),
});

const createForm = reactive<CreateForm>({
    userId: '',
    departmentId: '',
    department: '',
    jobTitle: '',
    professionalLicenseNumber: '',
    licenseType: '',
    phoneExtension: '',
    employmentType: 'full_time',
});

let searchDebounceTimer: number | null = null;

function uniqueDepartmentOptions(options: DepartmentOption[]): DepartmentOption[] {
    const seen = new Set<string>();

    return options.filter((option) => {
        const key = option.value.trim().toLowerCase();
        if (key === '' || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function departmentOptionLabel(row: DepartmentRecord): string {
    const code = String(row.code ?? '').trim();
    const name = String(row.name ?? '').trim();

    if (code !== '' && name !== '') return `${code} - ${name}`;
    return name || code || 'Unnamed department';
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
            description: 'Existing staff department value not yet linked to the department registry.',
            keywords: ['legacy'],
        },
        ...options,
    ];
}

function normalizeRoleLabel(value: string): string {
    return value.trim().toLowerCase();
}

function suggestedDepartmentCategory(roleLabels: string[]): string | null {
    const normalized = roleLabels.map(normalizeRoleLabel);

    const checks: Array<[string, string[]]> = [
        ['Administrative', ['platform user administrator', 'platform rbac administrator', 'facility administrator', 'staff administrator', 'credentialing officer', 'medical records officer', 'registration clerk']],
        ['Billing', ['billing officer', 'cashier', 'finance controller']],
        ['Laboratory', ['laboratory user']],
        ['Pharmacy', ['pharmacy user']],
        ['Radiology', ['radiology user']],
        ['Theatre', ['theatre user']],
        ['Nursing', ['nursing user']],
        ['Clinical', ['clinical user', 'department head']],
    ];

    for (const [category, fragments] of checks) {
        if (normalized.some((label) => fragments.some((fragment) => label.includes(fragment)))) {
            return category;
        }
    }

    return null;
}

async function apiRequest<T>(
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
    let payload: ValidationErrorResponse | { message?: string } = {};

    try {
        payload = (await response.json()) as ValidationErrorResponse;
    } catch {
        const text = await response.text();
        const trimmed = String(text ?? '').trim();
        payload = { message: trimmed || `${response.status} ${response.statusText}` };
    }

    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as Error & {
            status?: number;
            payload?: ValidationErrorResponse | { message?: string };
        };
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload as T;
}

async function apiRequestFormData<T>(method: 'POST' | 'PATCH', path: string, formData: FormData): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    Object.assign(headers, csrfRequestHeaders());

    const response = await fetch(url.toString(), {
        method,
        credentials: 'same-origin',
        headers,
        body: formData,
    });
    let payload: ValidationErrorResponse | { message?: string } = {};

    try {
        payload = (await response.json()) as ValidationErrorResponse;
    } catch {
        const text = await response.text();
        const trimmed = String(text ?? '').trim();
        payload = { message: trimmed || `${response.status} ${response.statusText}` };
    }

    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as Error & {
            status?: number;
            payload?: ValidationErrorResponse | { message?: string };
        };
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload as T;
}

function statusVariant(status: string | null) {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive' || normalized === 'suspended') return 'destructive';
    return 'outline';
}

function staffStatusDotClass(status: string | null): string {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'bg-emerald-500';
    if (normalized === 'suspended') return 'bg-amber-500';
    if (normalized === 'inactive') return 'bg-rose-500';
    return 'bg-slate-400';
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

function credentialingStateVariant(state: string | null) {
    const normalized = (state ?? '').toLowerCase();
    if (normalized === 'ready') return 'secondary';
    if (normalized === 'blocked') return 'destructive';
    return 'outline';
}

function credentialingStateLabel(state: string | null): string {
    const normalized = String(state ?? '').trim().toLowerCase();
    if (normalized === 'not_required') return 'Not applicable';
    if (normalized === 'pending_verification') return 'Pending verification';
    return humanizeLabel(state);
}

function credentialingNotApplicable(summary: StaffCredentialingSummary | null): boolean {
    return String(summary?.credentialingState ?? '').trim().toLowerCase() === 'not_required';
}

function credentialingApplicabilityNote(summary: StaffCredentialingSummary | null): string | null {
    if (!credentialingNotApplicable(summary)) return null;
    return 'This staff role is non-clinical, so clinical credentialing and privileging are not used for this profile.';
}

function humanizeLabel(value: string | null): string {
    return String(value ?? '')
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (match) => match.toUpperCase()) || 'N/A';
}

function employmentTypeLabel(value: string | null): string {
    if (!value) return 'N/A';
    return value.replace('_', ' ');
}

function documentTypeLabel(value: string | null): string {
    if (!value) return 'other';
    return value.replace(/_/g, ' ');
}

function documentStatusVariant(status: string | null) {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'archived') return 'outline';
    return 'outline';
}

function documentVerificationVariant(status: string | null) {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'verified') return 'secondary';
    if (normalized === 'rejected') return 'destructive';
    return 'outline';
}

function auditActorDisplay(log: {
    actorId: number | null;
    actor?: { displayName?: string | null } | null;
}): string {
    const actorLabel = log.actor?.displayName?.trim();
    if (actorLabel) return actorLabel;
    return log.actorId === null || log.actorId === undefined ? 'System' : `User #${log.actorId}`;
}

function auditActionDisplay(log: { actionLabel?: string | null; action: string | null }): string {
    return log.actionLabel?.trim() || log.action || 'event';
}

function staffDisplayName(profile: StaffProfile | null): string {
    if (!profile) return 'N/A';

    const userName = (profile.userName ?? '').trim();
    if (userName) return userName;

    const employeeNumber = (profile.employeeNumber ?? '').trim();
    if (employeeNumber) return employeeNumber;

    const jobTitle = (profile.jobTitle ?? '').trim();
    return jobTitle || 'N/A';
}

function linkedUserVerificationVariant(profile: StaffProfile | null) {
    if (!profile?.userId) return 'outline';
    return profile.userEmailVerifiedAt ? 'secondary' : 'destructive';
}

function linkedUserVerificationLabel(profile: StaffProfile | null): string {
    if (!profile?.userId) return 'No linked user';
    return profile.userEmailVerifiedAt ? 'Email verified' : 'Email unverified';
}

function linkedUserGovernanceBlockerMessage(profile: StaffProfile | null): string | null {
    if (!profile?.userId) {
        return 'Sensitive credentialing and privileging actions remain blocked until this staff profile is linked to a user account.';
    }

    if (profile.userEmailVerifiedAt) {
        return null;
    }

    const email = String(profile.userEmail ?? '').trim();
    if (email !== '') {
        return `Linked user email ${email} has not completed the invite or reset flow yet. Finish that first before sensitive credentialing or privileging actions.`;
    }

    return 'Linked user email is still unverified. Finish the invite or reset flow before continuing with sensitive credentialing or privileging actions.';
}

function staffInitials(profile: StaffProfile): string {
    const userName = (profile.userName ?? '').trim();
    if (userName) {
        const parts = userName.split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    const title = (profile.jobTitle ?? '').trim();
    if (title) {
        const parts = title.split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    const emp = (profile.employeeNumber ?? '').trim();
    if (emp) return emp.slice(0, 2).toUpperCase();
    return '??';
}

function formatFileSize(bytes: number | null): string {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index += 1;
    }

    const rounded = size >= 10 || index === 0 ? Math.round(size) : Math.round(size * 10) / 10;
    return `${rounded} ${units[index]}`;
}

const canPrev = computed(() => (pagination.value?.currentPage ?? 1) > 1);
const canNext = computed(() => (pagination.value ? pagination.value.currentPage < pagination.value.lastPage : false));

const staffDirectoryReadOnly = computed(
    () => canReadStaff.value && !canCreateStaff.value && !canUpdateStaff.value && !canUpdateStaffStatus.value,
);

const workspaceIntroText = computed(() => {
    const base = `${summaryStatusCounts.value.total} staff profiles in facility scope`;

    return staffDirectoryReadOnly.value
        ? `${base} · browse staff placement, status, and credentialing context`
        : `${base} · manage profiles, titles, and status transitions`;
});

const paginationPageNumbers = computed((): (number | '...')[] => {
    const total = pagination.value?.lastPage ?? 1;
    const current = pagination.value?.currentPage ?? 1;
    if (total <= 7) {
        return Array.from({ length: total }, (_, index) => index + 1);
    }

    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');

    for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) {
        pages.push(page);
    }

    if (current < total - 2) pages.push('...');
    pages.push(total);

    return pages;
});

const staffFilterChips = computed(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    const query = searchForm.q.trim();

    if (query) {
        chips.push({
            key: 'q',
            label: `Search: ${query}`,
            clear: () => {
                searchForm.q = '';
                submitSearch();
            },
        });
    }

    if (searchForm.status && searchForm.status !== 'active') {
        chips.push({
            key: 'status',
            label: `Status: ${humanizeLabel(searchForm.status)}`,
            clear: () => {
                searchForm.status = 'active';
                submitSearch();
            },
        });
    }

    if (searchForm.department.trim()) {
        chips.push({
            key: 'department',
            label: `Department: ${searchForm.department.trim()}`,
            clear: () => {
                searchForm.department = '';
                submitSearch();
            },
        });
    }

    if (searchForm.employmentType) {
        chips.push({
            key: 'employment',
            label: `Employment: ${employmentTypeLabel(searchForm.employmentType)}`,
            clear: () => {
                searchForm.employmentType = '';
                submitSearch();
            },
        });
    }

    if (searchForm.perPage !== 12) {
        chips.push({
            key: 'perPage',
            label: `${searchForm.perPage} per page`,
            clear: () => {
                searchForm.perPage = 12;
                submitSearch();
            },
        });
    }

    return chips;
});

const detailsSheetTabGridClass = computed(() => {
    const tabCount = 1 + (canReadStaffDocuments.value ? 1 : 0) + (canViewStaffAudit.value ? 1 : 0);
    if (tabCount >= 3) return 'grid-cols-3';
    if (tabCount === 2) return 'grid-cols-2';
    return 'grid-cols-1';
});
const filterDepartmentOptions = computed(() => mergeSelectedDepartmentOption(departmentOptions.value, searchForm.department));
const createDepartmentOptions = computed(() => mergeSelectedDepartmentOption(departmentOptions.value, createForm.departmentId));
const scopeWarning = computed(() => {
    if (!scopeLoaded.value) return null;
    if (!scope.value) return 'Staff scope could not be loaded. Refresh the page or confirm facility access.';
    if (scope.value.resolvedFrom === 'none') {
        return 'Staff scope is unresolved. Confirm the user has a tenant and facility context before editing staff records.';
    }
    return null;
});
const createDepartmentCategorySuggestion = computed(() => {
    if (!createLinkedUser.value) return null;
    return suggestedDepartmentCategory(createLinkedUser.value.roleLabels ?? []);
});

function linkedPlatformUserHref(profile: StaffProfile | null): string {
    const userId = Number(profile?.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
        return '/platform/admin/users';
    }

    return `/platform/admin/users?openUserId=${encodeURIComponent(String(userId))}`;
}

function consumeCreateStaffUserPrefillFromQuery() {
    const userId = queryNumberParam('createUserId', 0, { min: 1 });
    if (userId <= 0) return;

    createForm.userId = String(userId);
    createSheetOpen.value = true;

    if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('createUserId');
        url.searchParams.delete('createUserName');
        url.searchParams.delete('createUserEmail');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
}

function handleCreateLinkedUserSelected(user: CreateLinkedUser | null) {
    createLinkedUser.value = user;
}

function clearActionMessage(): void {
    if (actionMessageTimer !== null) {
        window.clearTimeout(actionMessageTimer);
        actionMessageTimer = null;
    }
    actionMessage.value = null;
}

function showActionMessage(message: string): void {
    clearActionMessage();
    actionMessage.value = message;
    actionMessageTimer = window.setTimeout(() => {
        actionMessage.value = null;
        actionMessageTimer = null;
    }, 4000);
}

const hasActiveStaffFilters = computed(() => {
    return Boolean(
        searchForm.q.trim() ||
            searchForm.status !== 'active' ||
            searchForm.department.trim() ||
            searchForm.employmentType ||
            searchForm.perPage !== 12,
    );
});
const staffFilterBadgeCount = computed(() =>
    Number(Boolean(searchForm.q.trim()))
    + Number(Boolean(searchForm.status !== 'active'))
    + Number(Boolean(searchForm.department.trim()))
    + Number(Boolean(searchForm.employmentType))
    + Number(Boolean(searchForm.perPage !== 12)),
);

const queueDensityValue = computed({
    get: () => (compactQueueRows.value ? 'compact' : 'comfortable'),
    set: (value: string) => {
        compactQueueRows.value = value === 'compact';
    },
});

const visibleStaffStatusCounts = computed(() => {
    const counts = {
        active: 0,
        suspended: 0,
        inactive: 0,
        other: 0,
    };

    for (const profile of staffProfiles.value) {
        const status = (profile.status ?? '').toLowerCase();
        if (status === 'active') {
            counts.active += 1;
            continue;
        }
        if (status === 'suspended') {
            counts.suspended += 1;
            continue;
        }
        if (status === 'inactive') {
            counts.inactive += 1;
            continue;
        }
        counts.other += 1;
    }

    return counts;
});

const summaryStatusCounts = computed<StaffStatusCounts>(() => {
    if (staffStatusCounts.value) return staffStatusCounts.value;

    const fallbackVisibleTotal =
        visibleStaffStatusCounts.value.active +
        visibleStaffStatusCounts.value.suspended +
        visibleStaffStatusCounts.value.inactive +
        visibleStaffStatusCounts.value.other;

    const fallbackTotal = Math.max(fallbackVisibleTotal, pagination.value?.total ?? 0);

    return {
        active: visibleStaffStatusCounts.value.active,
        suspended: visibleStaffStatusCounts.value.suspended,
        inactive: visibleStaffStatusCounts.value.inactive,
        other: visibleStaffStatusCounts.value.other,
        total: fallbackTotal,
    };
});

const visibleCredentialingCounts = computed(() => {
    const counts = {
        ready: 0,
        watch: 0,
        pendingVerification: 0,
        blocked: 0,
        unknown: 0,
    };

    for (const profile of staffProfiles.value) {
        const state = (staffCredentialingSummaries.value[profile.id]?.credentialingState ?? '').toLowerCase();
        if (state === 'ready') {
            counts.ready += 1;
            continue;
        }
        if (state === 'watch') {
            counts.watch += 1;
            continue;
        }
        if (state === 'pending_verification') {
            counts.pendingVerification += 1;
            continue;
        }
        if (state === 'blocked') {
            counts.blocked += 1;
            continue;
        }

        counts.unknown += 1;
    }

    return counts;
});
const staffListSummaryText = computed(() => {
    const total = pagination.value?.total ?? staffProfiles.value.length;
    const status = searchForm.status ? humanizeLabel(searchForm.status) : 'All';
    const filterText = staffFilterBadgeCount.value > 0 ? ` · ${staffFilterBadgeCount.value} filters` : '';
    return `${total} staff profiles · ${status} view${filterText}`;
});
const staffCredentialingSummaryText = computed(() => {
    return `Credentialing snapshot · ${visibleCredentialingCounts.value.ready} ready · ${visibleCredentialingCounts.value.watch} watch · ${visibleCredentialingCounts.value.pendingVerification} pending · ${visibleCredentialingCounts.value.blocked} blocked`;
});

function resetCreateForm(options?: { preserveLinkedUser?: boolean }) {
    createMessage.value = null;
    createErrors.value = {};
    if (!options?.preserveLinkedUser) {
        createForm.userId = '';
        createLinkedUser.value = null;
    }
    createForm.departmentId = '';
    createForm.jobTitle = '';
    createForm.professionalLicenseNumber = '';
    createForm.licenseType = '';
    createForm.phoneExtension = '';
    createForm.employmentType = 'full_time';
}

function openCreateStaffSheet(options?: { preserveLinkedUser?: boolean }) {
    resetCreateForm({ preserveLinkedUser: options?.preserveLinkedUser });
    createSheetOpen.value = true;
}

function scrollToCreateStaffProfile() {
    openCreateStaffSheet();
}

const detailsSheetCredentialingSummary = computed<StaffCredentialingSummary | null>(() => {
    if (!detailsSheetStaff.value) return null;
    return staffCredentialingSummaries.value[detailsSheetStaff.value.id] ?? null;
});

function staffCredentialingSummary(profileId: string): StaffCredentialingSummary | null {
    return staffCredentialingSummaries.value[profileId] ?? null;
}

function workspaceStaffHref(path: string, staff: StaffProfile | null): string {
    const staffId = String(staff?.id ?? '').trim();
    if (staffId === '') return path;

    return `${path}?staffId=${encodeURIComponent(staffId)}`;
}

function clearPendingOpenStaffIdQuery(): void {
    pendingOpenStaffId.value = '';
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (!url.searchParams.has('staffId')) return;
    url.searchParams.delete('staffId');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

async function openStaffFromQueryIfPresent(): Promise<void> {
    const staffId = pendingOpenStaffId.value.trim();
    if (!staffId || !canReadStaff.value) return;

    let target = staffProfiles.value.find((profile) => String(profile.id ?? '').trim() === staffId) ?? null;

    if (!target) {
        try {
            const response = await apiRequest<StaffProfileResponse>('GET', `/staff/${encodeURIComponent(staffId)}`);
            target = response.data ?? null;
        } catch {
            clearPendingOpenStaffIdQuery();
            return;
        }
    }

    if (!target) {
        clearPendingOpenStaffIdQuery();
        return;
    }

    if (canReadStaffCredentialing.value && !staffCredentialingSummaries.value[target.id]) {
        try {
            const response = await apiRequest<StaffCredentialingSummaryBatchResponse>('GET', '/staff/credentialing/summaries', {
                query: { ids: target.id },
            });
            const summary = (response.data ?? []).find((item) => String(item.id ?? '').trim() === target?.id);
            if (summary) {
                staffCredentialingSummaries.value = {
                    ...staffCredentialingSummaries.value,
                    [target.id]: summary,
                };
            }
        } catch {
            // Keep the staff details flow usable even if the summary call fails.
        }
    }

    openStaffDetailsSheet(target);
    clearPendingOpenStaffIdQuery();
}

function credentialingBlockingPreview(summary: StaffCredentialingSummary | null): string {
    if (credentialingNotApplicable(summary)) {
        return 'Clinical credentialing is not used for this staff role.';
    }

    const reason = summary?.blockingReasons?.[0]?.trim();
    if (reason) return reason;

    if (summary?.nextExpiryAt) {
        return `Next expiry ${summary.nextExpiryAt}`;
    }

    return 'No blocking reason recorded.';
}

function staffSpecialtyLabel(assignment: StaffSpecialtyAssignment | null): string {
    const code = assignment?.specialty?.code?.trim();
    const name = assignment?.specialty?.name?.trim();

    if (code && name) return `${code} - ${name}`;
    if (name) return name;
    if (code) return code;

    return 'Unnamed specialty';
}

function applyPermissionFlags(permissionNames: Set<string>) {
    canReadStaff.value = permissionNames.has('staff.read');
    canCreateStaff.value = permissionNames.has('staff.create');
    canUpdateStaff.value = permissionNames.has('staff.update');
    canUpdateStaffStatus.value = permissionNames.has('staff.update-status');
    canReadDepartments.value = permissionNames.has('departments.read');
    canReadStaffCredentialing.value = permissionNames.has('staff.credentialing.read');
    canReadStaffPrivileges.value = permissionNames.has('staff.privileges.read');
    canReadPlatformUsers.value = permissionNames.has('platform.users.read');
    canReadStaffSpecialties.value = permissionNames.has('staff.specialties.read');
    canViewStaffAudit.value = permissionNames.has('staff.view-audit-logs');
    canReadStaffDocuments.value = permissionNames.has('staff.documents.read');
    canCreateStaffDocuments.value = permissionNames.has('staff.documents.create');
    canUpdateStaffDocuments.value = permissionNames.has('staff.documents.update');
    canVerifyStaffDocuments.value = permissionNames.has('staff.documents.verify');
    canUpdateStaffDocumentStatus.value = permissionNames.has('staff.documents.update-status');
    canViewStaffDocumentAudit.value = permissionNames.has('staff.documents.view-audit-logs');
}

function hydrateSharedPageContext() {
    scope.value = normalizeSharedScope(page.props.platform?.scope ?? null);
    scopeLoaded.value = true;
    applyPermissionFlags(permissionNameSetFromPageProps());
    permissionsLoaded.value = true;
}


async function loadDepartmentOptions() {
    if (!canReadStaff.value) {
        departmentOptions.value = [];
        departmentOptionsLoading.value = false;
        return;
    }

    departmentOptionsLoading.value = true;
    try {
        const response = await apiRequest<DepartmentListResponse>('GET', '/staff/department-options');

        departmentOptions.value = uniqueDepartmentOptions(
            (response.data ?? [])
                .map((row) => {
                    if ('value' in row && 'label' in row) {
                        const value = String(row.value ?? '').trim();
                        const label = String(row.label ?? '').trim();
                        if (value === '') return null;

                        return {
                            value,
                            label: label || value,
                            group:
                                typeof row.group === 'string' && row.group.trim()
                                    ? row.group.trim()
                                    : null,
                            description:
                                typeof row.description === 'string' && row.description.trim()
                                    ? row.description.trim()
                                    : null,
                            keywords: Array.isArray(row.keywords)
                                ? row.keywords
                                      .map((keyword) => String(keyword).trim())
                                      .filter((keyword) => keyword.length > 0)
                                : undefined,
                        } satisfies DepartmentOption;
                    }

                    const name = String(row.name ?? '').trim();
                    if (name === '') return null;

                    return {
                        value: name,
                        label: departmentOptionLabel(row),
                        group:
                            typeof row.serviceType === 'string' && row.serviceType.trim()
                                ? row.serviceType.trim()
                                : null,
                        description:
                            typeof row.serviceType === 'string' && row.serviceType.trim()
                                ? `Category: ${row.serviceType.trim()}`
                                : null,
                        keywords: Array.isArray([row.code, row.serviceType])
                            ? [row.code, row.serviceType]
                                  .map((value) => String(value ?? '').trim())
                                  .filter((value) => value.length > 0)
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

let credentialingSummaryRequestId = 0;

async function loadStaffCredentialingSummaries(profiles: StaffProfile[]) {
    const ids = Array.from(new Set(profiles.map((profile) => profile.id).filter(Boolean)));

    if (!canReadStaffCredentialing.value || ids.length === 0) {
        credentialingSummaryRequestId += 1;
        staffCredentialingSummaries.value = {};
        credentialingSummariesLoading.value = false;
        return;
    }

    const requestId = ++credentialingSummaryRequestId;
    credentialingSummariesLoading.value = true;

    try {
        const response = await apiRequest<StaffCredentialingSummaryBatchResponse>('GET', '/staff/credentialing/summaries', {
            query: { ids: ids.join(',') },
        });

        if (requestId !== credentialingSummaryRequestId) {
            return;
        }

        const next: Record<string, StaffCredentialingSummary | null> = {};
        ids.forEach((id) => {
            next[id] = null;
        });

        for (const summary of response.data ?? []) {
            const id = String(summary.id ?? '').trim();
            if (!id) continue;
            next[id] = summary;
        }

        staffCredentialingSummaries.value = next;
    } catch {
        if (requestId !== credentialingSummaryRequestId) {
            return;
        }

        staffCredentialingSummaries.value = {};
    } finally {
        if (requestId === credentialingSummaryRequestId) {
            credentialingSummariesLoading.value = false;
        }
    }
}

async function loadStaffProfiles() {
    if (!canReadStaff.value) {
        credentialingSummaryRequestId += 1;
        staffProfiles.value = [];
        pagination.value = null;
        staffCredentialingSummaries.value = {};
        credentialingSummariesLoading.value = false;
        listLoading.value = false;
        loading.value = false;
        return;
    }

    listLoading.value = true;
    listErrors.value = [];
    try {
        const response = await apiRequest<StaffListResponse>('GET', '/staff', {
            query: {
                q: searchForm.q.trim() || null,
                status: searchForm.status || null,
                department: searchForm.department.trim() || null,
                employmentType: searchForm.employmentType || null,
                perPage: searchForm.perPage,
                page: searchForm.page,
            },
        });
        staffProfiles.value = response.data;
        pagination.value = response.meta;
        void loadStaffCredentialingSummaries(response.data);
    } catch (error) {
        credentialingSummaryRequestId += 1;
        staffProfiles.value = [];
        pagination.value = null;
        staffCredentialingSummaries.value = {};
        credentialingSummariesLoading.value = false;
        listErrors.value.push(error instanceof Error ? error.message : 'Unable to load staff profiles.');
    } finally {
        listLoading.value = false;
        loading.value = false;
    }
}

async function loadStaffStatusCounts() {
    if (!canReadStaff.value) {
        staffStatusCounts.value = null;
        return;
    }

    try {
        const response = await apiRequest<StaffStatusCountsResponse>('GET', '/staff/status-counts', {
            query: {
                q: searchForm.q.trim() || null,
                department: searchForm.department.trim() || null,
                employmentType: searchForm.employmentType || null,
            },
        });
        staffStatusCounts.value = response.data;
    } catch {
        staffStatusCounts.value = null;
    }
}

async function refreshPage() {
    consumeCreateStaffUserPrefillFromQuery();
    clearSearchDebounce();
    hydrateSharedPageContext();
    await Promise.all([loadDepartmentOptions(), loadStaffProfiles(), loadStaffStatusCounts()]);
    await openStaffFromQueryIfPresent();
}

async function createStaffProfile() {
    if (createLoading.value || !canCreateStaff.value) return;
    createLoading.value = true;
    createErrors.value = {};

    try {
        const normalizedUserId = Number.parseInt(createForm.userId.trim(), 10);
        const response = await apiRequest<{ data: StaffProfile }>('POST', '/staff', {
            body: {
                userId: Number.isNaN(normalizedUserId) ? null : normalizedUserId,
                departmentId: (createForm.departmentId || '').trim() || null,
                jobTitle: createForm.jobTitle.trim(),
                professionalLicenseNumber: createForm.professionalLicenseNumber.trim() || null,
                licenseType: createForm.licenseType.trim() || null,
                phoneExtension: createForm.phoneExtension.trim() || null,
                employmentType: createForm.employmentType,
            },
        });
        const successMessage = `Staff profile ${staffDisplayName(response.data)} created successfully.`.trim();
        notifySuccess(successMessage);
        showActionMessage(successMessage);
        resetCreateForm();
        createSheetOpen.value = false;
        searchForm.page = 1;
        await Promise.all([loadStaffProfiles(), loadStaffStatusCounts()]);
        openStaffDetailsSheet(response.data);
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
        } else {
            notifyError(messageFromUnknown(apiError, 'Unable to create staff profile.'));
        }
    } finally {
        createLoading.value = false;
    }
}

function openStaffEditDialog(profile: StaffProfile) {
    editDialogProfile.value = profile;
    editDialogOpen.value = true;
}

async function handleStaffProfileSaved(updated: StaffProfile) {
    editDialogProfile.value = updated;
    if (detailsSheetStaff.value?.id === updated.id) {
        detailsSheetStaff.value = updated;
        detailsSheetActionMessage.value = `Updated ${staffDisplayName(updated)}.`;
    }

    showActionMessage(`Updated ${staffDisplayName(updated)}.`);
    await Promise.all([loadStaffProfiles(), loadStaffStatusCounts()]);
}

async function handleStaffStatusSaved(updated: StaffProfile) {
    if (detailsSheetStaff.value?.id === updated.id) {
        detailsSheetStaff.value = updated;
        detailsSheetActionMessage.value = `Updated ${staffDisplayName(updated)} to ${humanizeLabel(updated.status)}.`;
    }

    showActionMessage(`Updated ${staffDisplayName(updated)} to ${humanizeLabel(updated.status)}.`);
    await Promise.all([loadStaffProfiles(), loadStaffStatusCounts()]);
}

function openStaffStatusDialog(profile: StaffProfile) {
    statusDialogProfile.value = profile;
    statusDialogOpen.value = true;
}

function closeStaffStatusDialog() {
    statusDialogOpen.value = false;
    statusDialogError.value = null;
}

const statusDialogTitle = computed(() => {
    if (statusDialogTarget.value === 'suspended') return 'Suspend Staff Profile';
    return 'Activate Staff Profile';
});

const statusDialogDescription = computed(() => {
    const label = statusDialogProfile.value ? staffDisplayName(statusDialogProfile.value) : 'this staff profile';
    if (statusDialogTarget.value === 'suspended') {
        return `Capture suspension reason for ${label}.`;
    }
    return `Confirm re-activation for ${label}.`;
});

async function submitStaffStatusDialog() {
    if (!statusDialogProfile.value || !statusDialogTarget.value || actionLoadingId.value) return;

    const reason =
        statusDialogTarget.value === 'suspended' ? statusDialogReason.value.trim() : null;
    if (statusDialogTarget.value === 'suspended' && !reason) {
        statusDialogError.value = 'Suspension reason is required.';
        return;
    }

    actionLoadingId.value = statusDialogProfile.value.id;
    clearActionMessage();
    statusDialogError.value = null;
    try {
        const response = await apiRequest<{ data: StaffProfile }>(
            'PATCH',
            `/staff/${statusDialogProfile.value.id}/status`,
            {
                body: { status: statusDialogTarget.value, reason },
            },
        );
        showActionMessage(`Updated ${staffDisplayName(response.data)} to ${statusDialogTarget.value}.`);
        if (detailsSheetStaff.value?.id === response.data.id) {
            detailsSheetStaff.value = response.data;
            detailsSheetActionMessage.value = `Updated ${staffDisplayName(response.data)} to ${humanizeLabel(response.data.status)}.`;
        }
        await Promise.all([loadStaffProfiles(), loadStaffStatusCounts()]);
        closeStaffStatusDialog();
    } catch (error) {
        statusDialogError.value = error instanceof Error ? error.message : 'Unable to update staff status.';
    } finally {
        actionLoadingId.value = null;
    }
}

function submitSearch() {
    clearSearchDebounce();
    searchForm.page = 1;
    void Promise.all([loadStaffProfiles(), loadStaffStatusCounts()]);
}

function submitSearchFromMobileDrawer() {
    submitSearch();
    mobileFiltersDrawerOpen.value = false;
}

function resetFilters() {
    clearSearchDebounce();
    searchForm.q = '';
    searchForm.status = 'active';
    searchForm.department = '';
    searchForm.employmentType = '';
    searchForm.perPage = 12;
    searchForm.page = 1;
    showAdvancedStaffFilters.value = false;
    void Promise.all([loadStaffProfiles(), loadStaffStatusCounts()]);
}

function resetFiltersFromMobileDrawer() {
    resetFilters();
    mobileFiltersDrawerOpen.value = false;
}

function prevPage() {
    if (!canPrev.value) return;
    clearSearchDebounce();
    searchForm.page -= 1;
    void loadStaffProfiles();
}

function nextPage() {
    if (!canNext.value) return;
    clearSearchDebounce();
    searchForm.page += 1;
    void loadStaffProfiles();
}

function goToPage(page: number) {
    clearSearchDebounce();
    searchForm.page = page;
    void loadStaffProfiles();
}

function clearSearchDebounce() {
    if (searchDebounceTimer !== null) {
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
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

function auditActorLabel(log: StaffProfileAuditLog): string {
    return auditActorDisplay(log);
}

async function loadDetailsAuditLogs(profileId: string) {
    if (!canViewStaffAudit.value) {
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
        detailsAuditLoading.value = false;
        detailsAuditError.value = null;
        return;
    }

    detailsAuditLoading.value = true;
    detailsAuditError.value = null;
    try {
        const response = await apiRequest<StaffProfileAuditLogListResponse>(
            'GET',
            `/staff/${profileId}/audit-logs`,
            {
                query: detailsAuditQuery(),
            },
        );
        detailsAuditLogs.value = response.data ?? [];
        detailsAuditMeta.value = response.meta;
    } catch (error) {
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
        detailsAuditError.value = messageFromUnknown(error, 'Unable to load staff audit logs.');
    } finally {
        detailsAuditLoading.value = false;
    }
}

async function loadDetailsSpecialties(profileId: string) {
    if (!canReadStaffSpecialties.value) {
        detailsSpecialties.value = [];
        detailsSpecialtiesError.value = null;
        detailsSpecialtiesLoading.value = false;
        return;
    }

    detailsSpecialtiesLoading.value = true;
    detailsSpecialtiesError.value = null;

    try {
        const response = await apiRequest<StaffSpecialtyAssignmentListResponse>('GET', `/staff/${profileId}/specialties`);
        detailsSpecialties.value = response.data ?? [];
    } catch (error) {
        detailsSpecialties.value = [];
        detailsSpecialtiesError.value = messageFromUnknown(error, 'Unable to load staff specialty assignments.');
    } finally {
        detailsSpecialtiesLoading.value = false;
    }
}

function applyDetailsAuditFilters() {
    if (!detailsSheetStaff.value) return;
    detailsAuditFilters.page = 1;
    void loadDetailsAuditLogs(detailsSheetStaff.value.id);
}

function resetDetailsAuditFilters() {
    if (!detailsSheetStaff.value) return;
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    void loadDetailsAuditLogs(detailsSheetStaff.value.id);
}

function goToDetailsAuditPage(page: number) {
    if (!detailsSheetStaff.value) return;
    detailsAuditFilters.page = Math.max(page, 1);
    void loadDetailsAuditLogs(detailsSheetStaff.value.id);
}

async function exportDetailsAuditLogsCsv() {
    if (!detailsSheetStaff.value || !canViewStaffAudit.value || detailsAuditExporting.value) {
        return;
    }

    detailsAuditExporting.value = true;
    try {
        const url = new URL(
            `/api/v1/staff/${detailsSheetStaff.value.id}/audit-logs/export`,
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

function detailsDocumentQuery() {
    return {
        q: detailsDocumentFilters.q.trim() || null,
        documentType: detailsDocumentFilters.documentType || null,
        status: detailsDocumentFilters.status || null,
        verificationStatus: detailsDocumentFilters.verificationStatus || null,
        expiresFrom: detailsDocumentFilters.expiresFrom || null,
        expiresTo: detailsDocumentFilters.expiresTo || null,
        sortBy: detailsDocumentFilters.sortBy,
        sortDir: detailsDocumentFilters.sortDir,
        page: detailsDocumentFilters.page,
        perPage: detailsDocumentFilters.perPage,
    };
}

function filenameWithoutExtension(name: string): string {
    const lastDot = name.lastIndexOf('.');
    return lastDot > 0 ? name.slice(0, lastDot) : name;
}

function resetDetailsDocumentUploadForm() {
    detailsDocumentUploadForm.documentType = 'cv';
    detailsDocumentUploadForm.title = '';
    detailsDocumentUploadForm.description = '';
    detailsDocumentUploadForm.issuedAt = '';
    detailsDocumentUploadForm.expiresAt = '';
    detailsDocumentUploadFile.value = null;
    detailsDocumentUploadInputKey.value += 1;
}

function openDetailsDocumentUploadDialog() {
    resetDetailsDocumentUploadForm();
    detailsDocumentUploadErrors.value = {};
    detailsDocumentUploadDialogOpen.value = true;
}

function closeDetailsDocumentUploadDialog() {
    if (detailsDocumentUploadLoading.value) return;
    detailsDocumentUploadDialogOpen.value = false;
}

function triggerDetailsDocumentFilePicker() {
    detailsDocumentUploadFileInputRef.value?.click();
}

function clearDetailsDocumentUploadFile() {
    detailsDocumentUploadFile.value = null;
    detailsDocumentUploadInputKey.value += 1;
}

function assignDetailsDocumentUploadFile(file: File | null) {
    detailsDocumentUploadFile.value = file;
    if (file && !detailsDocumentUploadForm.title.trim()) {
        detailsDocumentUploadForm.title = filenameWithoutExtension(file.name);
    }
}

const detailsDocumentActiveFilterCount = computed(() => {
    let count = 0;
    if (detailsDocumentFilters.q.trim()) count += 1;
    if (detailsDocumentFilters.documentType) count += 1;
    if (detailsDocumentFilters.status) count += 1;
    if (detailsDocumentFilters.verificationStatus) count += 1;
    if (detailsDocumentFilters.expiresFrom) count += 1;
    if (detailsDocumentFilters.expiresTo) count += 1;
    return count;
});

function resetDetailsDocumentAuditState() {
    detailsDocumentAuditDocument.value = null;
    detailsDocumentAuditLoading.value = false;
    detailsDocumentAuditError.value = null;
    detailsDocumentAuditLogs.value = [];
    detailsDocumentAuditMeta.value = null;
    detailsDocumentAuditFilters.q = '';
    detailsDocumentAuditFilters.action = '';
    detailsDocumentAuditFilters.actorType = '';
    detailsDocumentAuditFilters.actorId = '';
    detailsDocumentAuditFilters.from = '';
    detailsDocumentAuditFilters.to = '';
    detailsDocumentAuditFilters.page = 1;
    detailsDocumentAuditFilters.perPage = 20;
}

async function loadDetailsDocuments(profileId: string) {
    if (!canReadStaffDocuments.value) {
        detailsDocumentsLoading.value = false;
        detailsDocumentsError.value = null;
        detailsDocuments.value = [];
        detailsDocumentMeta.value = null;
        return;
    }

    detailsDocumentsLoading.value = true;
    detailsDocumentsError.value = null;
    try {
        const response = await apiRequest<StaffDocumentListResponse>('GET', `/staff/${profileId}/documents`, {
            query: detailsDocumentQuery(),
        });
        detailsDocuments.value = response.data ?? [];
        detailsDocumentMeta.value = response.meta ?? null;
        if (
            detailsDocumentAuditDocument.value &&
            !detailsDocuments.value.some((document) => document.id === detailsDocumentAuditDocument.value?.id)
        ) {
            resetDetailsDocumentAuditState();
        }
    } catch (error) {
        detailsDocuments.value = [];
        detailsDocumentMeta.value = null;
        detailsDocumentsError.value = messageFromUnknown(error, 'Unable to load staff documents.');
    } finally {
        detailsDocumentsLoading.value = false;
    }
}

function applyDetailsDocumentFilters() {
    if (!detailsSheetStaff.value) return;
    detailsDocumentFilters.page = 1;
    void loadDetailsDocuments(detailsSheetStaff.value.id);
}

function resetDetailsDocumentFilters() {
    if (!detailsSheetStaff.value) return;
    detailsDocumentFilters.q = '';
    detailsDocumentFilters.documentType = '';
    detailsDocumentFilters.status = '';
    detailsDocumentFilters.verificationStatus = '';
    detailsDocumentFilters.expiresFrom = '';
    detailsDocumentFilters.expiresTo = '';
    detailsDocumentFilters.sortBy = 'createdAt';
    detailsDocumentFilters.sortDir = 'desc';
    detailsDocumentFilters.page = 1;
    detailsDocumentFilters.perPage = 10;
    void loadDetailsDocuments(detailsSheetStaff.value.id);
}

function goToDetailsDocumentPage(page: number) {
    if (!detailsSheetStaff.value) return;
    detailsDocumentFilters.page = Math.max(page, 1);
    void loadDetailsDocuments(detailsSheetStaff.value.id);
}

function onDetailsDocumentFileChange(event: Event) {
    const target = event.target as HTMLInputElement | null;
    assignDetailsDocumentUploadFile(target?.files?.[0] ?? null);
}

function onDetailsDocumentFileDrop(event: DragEvent) {
    assignDetailsDocumentUploadFile(event.dataTransfer?.files?.[0] ?? null);
}

async function submitDetailsDocumentUpload() {
    if (!detailsSheetStaff.value || !canCreateStaffDocuments.value || detailsDocumentUploadLoading.value) return;

    const file = detailsDocumentUploadFile.value;
    if (!file) {
        detailsDocumentUploadErrors.value = { file: ['Please choose a file to upload.'] };
        return;
    }

    if (file.size > documentUploadMaxBytes.value) {
        const message = `This environment currently allows files up to ${documentUploadMaxLabel.value}.`;
        detailsDocumentUploadErrors.value = { file: [message] };
        notifyError(message);
        return;
    }

    detailsDocumentUploadLoading.value = true;
    detailsDocumentUploadErrors.value = {};
    detailsSheetActionMessage.value = null;
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', detailsDocumentUploadForm.documentType);
        formData.append('title', detailsDocumentUploadForm.title.trim());
        formData.append('description', detailsDocumentUploadForm.description.trim());
        if (detailsDocumentUploadForm.issuedAt) {
            formData.append('issuedAt', detailsDocumentUploadForm.issuedAt);
        }
        if (detailsDocumentUploadForm.expiresAt) {
            formData.append('expiresAt', detailsDocumentUploadForm.expiresAt);
        }

        const response = await apiRequestFormData<{ data: StaffDocument }>(
            'POST',
            `/staff/${detailsSheetStaff.value.id}/documents`,
            formData,
        );
        detailsSheetActionMessage.value = `Uploaded ${response.data.title || 'document'} successfully.`;
        notifySuccess(detailsSheetActionMessage.value);
        resetDetailsDocumentUploadForm();
        detailsDocumentUploadDialogOpen.value = false;
        await loadDetailsDocuments(detailsSheetStaff.value.id);
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            detailsDocumentUploadErrors.value = apiError.payload.errors;
        } else {
            notifyError(messageFromUnknown(error, 'Unable to upload staff document.'));
        }
    } finally {
        detailsDocumentUploadLoading.value = false;
    }
}

function openDocumentMetadataDialog(document: StaffDocument) {
    documentMetadataDialogDocument.value = document;
    documentMetadataDialogOpen.value = true;
    documentMetadataDialogError.value = null;
    documentMetadataDialogErrors.value = {};
    documentMetadataForm.documentType = document.documentType || 'other';
    documentMetadataForm.title = document.title || '';
    documentMetadataForm.description = document.description || '';
    documentMetadataForm.issuedAt = document.issuedAt ? String(document.issuedAt).slice(0, 10) : '';
    documentMetadataForm.expiresAt = document.expiresAt ? String(document.expiresAt).slice(0, 10) : '';
}

function closeDocumentMetadataDialog() {
    documentMetadataDialogOpen.value = false;
    documentMetadataDialogDocument.value = null;
    documentMetadataDialogError.value = null;
    documentMetadataDialogErrors.value = {};
}

async function submitDocumentMetadataDialog() {
    if (
        !detailsSheetStaff.value ||
        !documentMetadataDialogDocument.value ||
        !canUpdateStaffDocuments.value ||
        documentMetadataDialogLoading.value
    ) {
        return;
    }

    documentMetadataDialogLoading.value = true;
    detailsSheetActionMessage.value = null;
    documentMetadataDialogError.value = null;
    documentMetadataDialogErrors.value = {};
    try {
        await apiRequest<{ data: StaffDocument }>(
            'PATCH',
            `/staff/${detailsSheetStaff.value.id}/documents/${documentMetadataDialogDocument.value.id}`,
            {
                body: {
                    documentType: documentMetadataForm.documentType,
                    title: documentMetadataForm.title.trim(),
                    description: documentMetadataForm.description.trim() || null,
                    issuedAt: documentMetadataForm.issuedAt || null,
                    expiresAt: documentMetadataForm.expiresAt || null,
                },
            },
        );
        detailsSheetActionMessage.value = 'Document metadata updated.';
        notifySuccess(detailsSheetActionMessage.value);
        await loadDetailsDocuments(detailsSheetStaff.value.id);
        if (detailsDocumentAuditDocument.value?.id === documentMetadataDialogDocument.value.id) {
            const current = detailsDocuments.value.find((item) => item.id === documentMetadataDialogDocument.value?.id);
            detailsDocumentAuditDocument.value = current ?? null;
        }
        closeDocumentMetadataDialog();
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            documentMetadataDialogErrors.value = apiError.payload.errors;
        } else {
            documentMetadataDialogError.value = messageFromUnknown(error, 'Unable to update document metadata.');
        }
    } finally {
        documentMetadataDialogLoading.value = false;
    }
}

function openDocumentVerificationDialog(document: StaffDocument) {
    documentVerificationDialogDocument.value = document;
    documentVerificationDialogOpen.value = true;
    documentVerificationDialogError.value = null;
    documentVerificationDialogErrors.value = {};
    const current = (document.verificationStatus || 'pending').toLowerCase();
    if (current === 'verified' || current === 'rejected' || current === 'pending') {
        documentVerificationStatus.value = current;
    } else {
        documentVerificationStatus.value = 'pending';
    }
    documentVerificationReason.value = document.verificationReason || '';
}

function closeDocumentVerificationDialog() {
    documentVerificationDialogOpen.value = false;
    documentVerificationDialogDocument.value = null;
    documentVerificationDialogError.value = null;
    documentVerificationDialogErrors.value = {};
    documentVerificationReason.value = '';
    documentVerificationStatus.value = 'pending';
}

async function submitDocumentVerificationDialog() {
    if (
        !detailsSheetStaff.value ||
        !documentVerificationDialogDocument.value ||
        !canVerifyStaffDocuments.value ||
        documentVerificationDialogLoading.value
    ) {
        return;
    }

    if (documentVerificationStatus.value === 'rejected' && !documentVerificationReason.value.trim()) {
        documentVerificationDialogErrors.value = { reason: ['Reason is required when rejecting a document.'] };
        return;
    }

    documentVerificationDialogLoading.value = true;
    detailsSheetActionMessage.value = null;
    documentVerificationDialogError.value = null;
    documentVerificationDialogErrors.value = {};
    try {
        await apiRequest<{ data: StaffDocument }>(
            'PATCH',
            `/staff/${detailsSheetStaff.value.id}/documents/${documentVerificationDialogDocument.value.id}/verification`,
            {
                body: {
                    verificationStatus: documentVerificationStatus.value,
                    reason: documentVerificationReason.value.trim() || null,
                },
            },
        );
        detailsSheetActionMessage.value = 'Document verification updated.';
        notifySuccess(detailsSheetActionMessage.value);
        await loadDetailsDocuments(detailsSheetStaff.value.id);
        if (detailsDocumentAuditDocument.value?.id === documentVerificationDialogDocument.value.id) {
            const current = detailsDocuments.value.find((item) => item.id === documentVerificationDialogDocument.value?.id);
            detailsDocumentAuditDocument.value = current ?? null;
            if (detailsDocumentAuditDocument.value && canViewStaffDocumentAudit.value) {
                await loadDetailsDocumentAuditLogs(detailsSheetStaff.value.id, detailsDocumentAuditDocument.value.id);
            }
        }
        closeDocumentVerificationDialog();
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            documentVerificationDialogErrors.value = apiError.payload.errors;
        } else {
            documentVerificationDialogError.value = messageFromUnknown(error, 'Unable to update document verification.');
        }
    } finally {
        documentVerificationDialogLoading.value = false;
    }
}

function openDocumentStatusDialog(document: StaffDocument, target: 'active' | 'archived') {
    documentStatusDialogDocument.value = document;
    documentStatusDialogTarget.value = target;
    documentStatusDialogReason.value = target === 'archived' ? (document.statusReason || '') : '';
    documentStatusDialogError.value = null;
    documentStatusDialogErrors.value = {};
    documentStatusDialogOpen.value = true;
}

function closeDocumentStatusDialog() {
    documentStatusDialogOpen.value = false;
    documentStatusDialogDocument.value = null;
    documentStatusDialogError.value = null;
    documentStatusDialogErrors.value = {};
    documentStatusDialogReason.value = '';
}

async function submitDocumentStatusDialog() {
    if (
        !detailsSheetStaff.value ||
        !documentStatusDialogDocument.value ||
        !canUpdateStaffDocumentStatus.value ||
        documentStatusDialogLoading.value
    ) {
        return;
    }

    if (documentStatusDialogTarget.value === 'archived' && !documentStatusDialogReason.value.trim()) {
        documentStatusDialogErrors.value = { reason: ['Reason is required when archiving a document.'] };
        return;
    }

    documentStatusDialogLoading.value = true;
    detailsSheetActionMessage.value = null;
    documentStatusDialogError.value = null;
    documentStatusDialogErrors.value = {};
    try {
        await apiRequest<{ data: StaffDocument }>(
            'PATCH',
            `/staff/${detailsSheetStaff.value.id}/documents/${documentStatusDialogDocument.value.id}/status`,
            {
                body: {
                    status: documentStatusDialogTarget.value,
                    reason: documentStatusDialogReason.value.trim() || null,
                },
            },
        );
        detailsSheetActionMessage.value = 'Document status updated.';
        notifySuccess(detailsSheetActionMessage.value);
        await loadDetailsDocuments(detailsSheetStaff.value.id);
        if (detailsDocumentAuditDocument.value?.id === documentStatusDialogDocument.value.id) {
            const current = detailsDocuments.value.find((item) => item.id === documentStatusDialogDocument.value?.id);
            detailsDocumentAuditDocument.value = current ?? null;
            if (detailsDocumentAuditDocument.value && canViewStaffDocumentAudit.value) {
                await loadDetailsDocumentAuditLogs(detailsSheetStaff.value.id, detailsDocumentAuditDocument.value.id);
            }
        }
        closeDocumentStatusDialog();
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            documentStatusDialogErrors.value = apiError.payload.errors;
        } else {
            documentStatusDialogError.value = messageFromUnknown(error, 'Unable to update document status.');
        }
    } finally {
        documentStatusDialogLoading.value = false;
    }
}

function downloadStaffDocument(document: StaffDocument) {
    if (!detailsSheetStaff.value || !canReadStaffDocuments.value) return;
    const url = new URL(
        `/api/v1/staff/${detailsSheetStaff.value.id}/documents/${document.id}/download`,
        window.location.origin,
    );
    window.open(url.toString(), '_blank', 'noopener');
}

function detailsDocumentAuditQuery() {
    return {
        q: detailsDocumentAuditFilters.q.trim() || null,
        action: detailsDocumentAuditFilters.action.trim() || null,
        actorType: detailsDocumentAuditFilters.actorType || null,
        actorId: detailsDocumentAuditFilters.actorId.trim() || null,
        from: detailsDocumentAuditFilters.from || null,
        to: detailsDocumentAuditFilters.to || null,
        page: detailsDocumentAuditFilters.page,
        perPage: detailsDocumentAuditFilters.perPage,
    };
}

async function loadDetailsDocumentAuditLogs(profileId: string, documentId: string) {
    if (!canViewStaffDocumentAudit.value) {
        detailsDocumentAuditLoading.value = false;
        detailsDocumentAuditError.value = null;
        detailsDocumentAuditLogs.value = [];
        detailsDocumentAuditMeta.value = null;
        return;
    }

    detailsDocumentAuditLoading.value = true;
    detailsDocumentAuditError.value = null;
    try {
        const response = await apiRequest<StaffDocumentAuditLogListResponse>(
            'GET',
            `/staff/${profileId}/documents/${documentId}/audit-logs`,
            {
                query: detailsDocumentAuditQuery(),
            },
        );
        detailsDocumentAuditLogs.value = response.data ?? [];
        detailsDocumentAuditMeta.value = response.meta ?? null;
    } catch (error) {
        detailsDocumentAuditLogs.value = [];
        detailsDocumentAuditMeta.value = null;
        detailsDocumentAuditError.value = messageFromUnknown(error, 'Unable to load document audit logs.');
    } finally {
        detailsDocumentAuditLoading.value = false;
    }
}

function openDetailsDocumentAudit(document: StaffDocument) {
    if (!detailsSheetStaff.value) return;
    detailsDocumentAuditDocument.value = document;
    detailsDocumentAuditError.value = null;
    detailsDocumentAuditLogs.value = [];
    detailsDocumentAuditMeta.value = null;
    detailsDocumentAuditFilters.q = '';
    detailsDocumentAuditFilters.action = '';
    detailsDocumentAuditFilters.actorType = '';
    detailsDocumentAuditFilters.actorId = '';
    detailsDocumentAuditFilters.from = '';
    detailsDocumentAuditFilters.to = '';
    detailsDocumentAuditFilters.page = 1;
    detailsDocumentAuditFilters.perPage = 20;
    if (canViewStaffDocumentAudit.value) {
        void loadDetailsDocumentAuditLogs(detailsSheetStaff.value.id, document.id);
    }
}

function applyDetailsDocumentAuditFilters() {
    if (!detailsSheetStaff.value || !detailsDocumentAuditDocument.value) return;
    detailsDocumentAuditFilters.page = 1;
    void loadDetailsDocumentAuditLogs(detailsSheetStaff.value.id, detailsDocumentAuditDocument.value.id);
}

function resetDetailsDocumentAuditFilters() {
    if (!detailsSheetStaff.value || !detailsDocumentAuditDocument.value) return;
    detailsDocumentAuditFilters.q = '';
    detailsDocumentAuditFilters.action = '';
    detailsDocumentAuditFilters.actorType = '';
    detailsDocumentAuditFilters.actorId = '';
    detailsDocumentAuditFilters.from = '';
    detailsDocumentAuditFilters.to = '';
    detailsDocumentAuditFilters.page = 1;
    detailsDocumentAuditFilters.perPage = 20;
    void loadDetailsDocumentAuditLogs(detailsSheetStaff.value.id, detailsDocumentAuditDocument.value.id);
}

function goToDetailsDocumentAuditPage(page: number) {
    if (!detailsSheetStaff.value || !detailsDocumentAuditDocument.value) return;
    detailsDocumentAuditFilters.page = Math.max(page, 1);
    void loadDetailsDocumentAuditLogs(detailsSheetStaff.value.id, detailsDocumentAuditDocument.value.id);
}

function openStaffDetailsSheet(profile: StaffProfile) {
    detailsSheetStaff.value = profile;
    detailsSheetOpen.value = true;
    detailsSheetTab.value = 'overview';
    detailsSheetActionMessage.value = null;
    detailsSpecialtiesLoading.value = false;
    detailsSpecialtiesError.value = null;
    detailsSpecialties.value = [];
    detailsAuditFiltersOpen.value = false;
    detailsDocumentFiltersOpen.value = false;
    detailsDocumentUploadDialogOpen.value = false;
    detailsAuditLogs.value = [];
    detailsAuditMeta.value = null;
    detailsAuditError.value = null;
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    detailsDocumentsLoading.value = false;
    detailsDocumentsError.value = null;
    detailsDocuments.value = [];
    detailsDocumentMeta.value = null;
    detailsDocumentFilters.q = '';
    detailsDocumentFilters.documentType = '';
    detailsDocumentFilters.status = '';
    detailsDocumentFilters.verificationStatus = '';
    detailsDocumentFilters.expiresFrom = '';
    detailsDocumentFilters.expiresTo = '';
    detailsDocumentFilters.sortBy = 'createdAt';
    detailsDocumentFilters.sortDir = 'desc';
    detailsDocumentFilters.page = 1;
    detailsDocumentFilters.perPage = 10;
    detailsDocumentUploadLoading.value = false;
    detailsDocumentUploadErrors.value = {};
    resetDetailsDocumentUploadForm();
    detailsDocumentUploadDialogOpen.value = false;
    closeDocumentMetadataDialog();
    closeDocumentVerificationDialog();
    closeDocumentStatusDialog();
    resetDetailsDocumentAuditState();
    if (canReadStaffSpecialties.value) {
        void loadDetailsSpecialties(profile.id);
    }
    if (canViewStaffAudit.value) {
        void loadDetailsAuditLogs(profile.id);
    }
    if (canReadStaffDocuments.value) {
        void loadDetailsDocuments(profile.id);
    }
}

function closeStaffDetailsSheet() {
    detailsSheetOpen.value = false;
    detailsSheetStaff.value = null;
    detailsSpecialtiesLoading.value = false;
    detailsSpecialtiesError.value = null;
    detailsSpecialties.value = [];
    detailsAuditLogs.value = [];
    detailsAuditMeta.value = null;
    detailsAuditError.value = null;
    detailsDocumentsLoading.value = false;
    detailsDocumentsError.value = null;
    detailsDocuments.value = [];
    detailsDocumentMeta.value = null;
    detailsDocumentUploadLoading.value = false;
    detailsDocumentUploadErrors.value = {};
    detailsSheetActionMessage.value = null;
    resetDetailsDocumentUploadForm();
    detailsDocumentUploadDialogOpen.value = false;
    detailsDocumentFiltersOpen.value = false;
    closeDocumentMetadataDialog();
    closeDocumentVerificationDialog();
    closeDocumentStatusDialog();
    resetDetailsDocumentAuditState();
}

watch(
    () => searchForm.q,
    (value, previousValue) => {
        const currentQuery = value.trim();
        const previousQuery = (previousValue ?? '').trim();
        if (currentQuery === previousQuery) return;
        clearSearchDebounce();
        searchDebounceTimer = window.setTimeout(() => {
            searchForm.page = 1;
            void Promise.all([loadStaffProfiles(), loadStaffStatusCounts()]);
            searchDebounceTimer = null;
        }, 350);
    },
);

onBeforeUnmount(() => {
    clearSearchDebounce();
    clearActionMessage();
});
watch(
    () => createSheetOpen.value,
    (open) => {
        if (open) return;
        resetCreateForm();
    },
);
watch(
    () => [page.props.auth?.permissions ?? [], page.props.platform?.scope ?? null] as const,
    () => {
        hydrateSharedPageContext();
    },
    { deep: true },
);
onMounted(refreshPage);
</script>

<template>
    <Head title="Staff" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">

            <!-- Page header -->
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="users" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">
                                    Staff Directory
                                </h1>
                                <Badge
                                    v-if="staffDirectoryReadOnly"
                                    variant="outline"
                                    class="h-5 px-1.5 text-[10px] font-medium"
                                >
                                    View only
                                </Badge>
                            </div>
                            <p class="truncate text-xs text-muted-foreground">
                                {{ workspaceIntroText }}
                            </p>
                            <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground">
                                <span class="inline-flex items-center gap-1">
                                    <AppIcon name="building-2" class="size-3 opacity-75" aria-hidden="true" />
                                    <span class="font-medium text-foreground">
                                        {{ scope?.facility?.name || 'No facility' }}
                                    </span>
                                </span>
                                <span class="select-none text-border" aria-hidden="true">·</span>
                                <template v-if="scope?.userAccess?.accessibleFacilityCount">
                                    <span class="select-none text-border" aria-hidden="true">·</span>
                                    <span>{{ scope.userAccess.accessibleFacilityCount }} accessible facilities</span>
                                </template>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5"
                            :disabled="listLoading"
                            @click="refreshPage"
                        >
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                        </Button>
                        <Button
                            v-if="canCreateStaff"
                            size="sm"
                            class="h-8 gap-1.5"
                            @click="openCreateStaffSheet()"
                        >
                            <AppIcon name="plus" class="size-3.5" />
                            Create profile
                        </Button>
                    </div>
                </div>
            </section>

            <!-- Alerts -->
            <Alert v-if="scopeWarning" variant="destructive">
                <AlertTitle>Scope warning</AlertTitle>
                <AlertDescription>{{ scopeWarning }}</AlertDescription>
            </Alert>

            <Alert v-if="actionMessage">
                <AlertTitle>Recent action</AlertTitle>
                <AlertDescription>{{ actionMessage }}</AlertDescription>
            </Alert>

            <Alert v-if="listErrors.length" variant="destructive">
                <AlertTitle>Request error</AlertTitle>
                <AlertDescription>
                    <div class="space-y-1">
                        <p v-for="errorMessage in listErrors" :key="errorMessage" class="text-xs">
                            {{ errorMessage }}
                        </p>
                    </div>
                </AlertDescription>
            </Alert>

            <!-- Single column: list card then create form -->
            <div class="flex min-w-0 flex-col gap-4">
                <div
                    v-if="canReadStaff"
                    class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-3"
                >
                    <Button
                        variant="outline"
                        size="sm"
                        class="gap-2 bg-background"
                        :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': searchForm.status === 'active' }"
                        @click="searchForm.status = 'active'; submitSearch()"
                    >
                        <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                        <span class="font-medium">{{ summaryStatusCounts.active }}</span>
                        <span class="text-muted-foreground">Active</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        class="gap-2 bg-background"
                        :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': searchForm.status === 'suspended' }"
                        @click="searchForm.status = 'suspended'; submitSearch()"
                    >
                        <span class="inline-block h-2 w-2 rounded-full bg-amber-500" />
                        <span class="font-medium">{{ summaryStatusCounts.suspended }}</span>
                        <span class="text-muted-foreground">Suspended</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        class="gap-2 bg-background"
                        :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': searchForm.status === 'inactive' }"
                        @click="searchForm.status = 'inactive'; submitSearch()"
                    >
                        <span class="inline-block h-2 w-2 rounded-full bg-rose-500" />
                        <span class="font-medium">{{ summaryStatusCounts.inactive }}</span>
                        <span class="text-muted-foreground">Inactive</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        class="gap-2 bg-background"
                        :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': searchForm.status === '' }"
                        @click="searchForm.status = ''; submitSearch()"
                    >
                        <span class="inline-block h-2 w-2 rounded-full bg-slate-400" />
                        <span class="font-medium">{{ summaryStatusCounts.total }}</span>
                        <span class="text-muted-foreground">All</span>
                    </Button>
                    <div class="ml-auto flex items-center gap-2">
                        <p class="hidden text-xs text-muted-foreground sm:block">{{ staffListSummaryText }}</p>
                        <Button
                            v-if="hasActiveStaffFilters"
                            variant="ghost"
                            size="sm"
                            class="text-xs"
                            @click="resetFilters"
                        >
                            <AppIcon name="sliders-horizontal" class="size-3" />
                            Reset
                        </Button>
                    </div>
                </div>

                <Card v-if="!permissionsLoaded || canReadStaff" class="flex min-h-0 flex-1 flex-col gap-0 rounded-lg border-sidebar-border/70 py-0">
                    <CardHeader class="shrink-0 gap-3 border-b px-4 py-3 pt-4 pb-3">
                        <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div class="min-w-0 space-y-1">
                                <CardTitle class="text-sm font-semibold">
                                    Staff profiles
                                </CardTitle>
                                <p class="text-xs text-muted-foreground">
                                    {{ staffListSummaryText }}
                                    <template v-if="canReadStaffCredentialing">
                                        · {{ staffCredentialingSummaryText }}
                                    </template>
                                </p>
                            </div>
                            <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:max-w-2xl">
                                <SearchInput
                                    id="staff-search-q-modern"
                                    v-model="searchForm.q"
                                    placeholder="Search name, employee number, title, or department"
                                    class="min-w-0 flex-1 text-xs [&_input]:h-8"
                                    @keyup.enter="submitSearch"
                                />
                                <Popover>
                                    <PopoverTrigger as-child>
                                        <Button variant="outline" size="sm" class="hidden h-8 gap-1.5 rounded-lg text-xs md:inline-flex">
                                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                                            Filters
                                            <Badge v-if="staffFilterBadgeCount > 0" variant="secondary" class="ml-1 h-5 px-1.5 text-[10px]">
                                                {{ staffFilterBadgeCount }}
                                            </Badge>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent class="w-72" align="end">
                                        <div class="grid gap-3">
                                            <p class="flex items-center gap-2 text-sm font-medium">
                                                <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                                Filters & view
                                            </p>
                                            <p class="text-xs text-muted-foreground">
                                                Refine the staff list and adjust density for faster review.
                                            </p>
                                            <div class="grid gap-2">
                                                <Label for="staff-department-popover-modern">Department</Label>
                                                <Select
                                                    v-if="filterDepartmentOptions.length > 0"
                                                    v-model="searchForm.department"
                                                    :disabled="departmentOptionsLoading"
                                                >
                                                    <SelectTrigger id="staff-department-popover-modern" class="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="">All departments</SelectItem>
                                                        <SelectItem
                                                            v-for="option in filterDepartmentOptions"
                                                            :key="`staff-filter-department-modern-${option.value}`"
                                                            :value="option.value"
                                                        >
                                                            {{ option.label }}
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Input
                                                    v-else
                                                    id="staff-department-popover-modern"
                                                    v-model="searchForm.department"
                                                    placeholder="Administration, Laboratory, OPD..."
                                                />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="staff-employment-popover-modern">Employment Type</Label>
                                                <Select v-model="searchForm.employmentType">
                                                    <SelectTrigger class="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                    <SelectItem value="">All employment</SelectItem>
                                                    <SelectItem value="full_time">Full time</SelectItem>
                                                    <SelectItem value="part_time">Part time</SelectItem>
                                                    <SelectItem value="contract">Contract</SelectItem>
                                                    <SelectItem value="locum">Locum</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="staff-per-page-popover-modern">Rows per page</Label>
                                                <Select v-model="searchForm.perPage">
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
                                                <Label for="staff-density-popover-modern">Row density</Label>
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
                                            <Separator />
                                            <div class="flex items-center justify-between gap-2">
                                                <Button variant="outline" size="sm" @click="resetFilters">
                                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                    Reset
                                                </Button>
                                                <Button size="sm" :disabled="listLoading" @click="submitSearch">
                                                    <AppIcon name="eye" class="size-3.5" />
                                                    Apply filters
                                                </Button>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <Button variant="outline" size="sm" class="h-8 rounded-lg text-xs md:hidden" @click="mobileFiltersDrawerOpen = true">
                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                    Filters
                                    <Badge v-if="staffFilterBadgeCount > 0" variant="secondary" class="ml-1 h-5 px-1.5 text-[10px]">
                                        {{ staffFilterBadgeCount }}
                                    </Badge>
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <div v-if="staffFilterChips.length" class="flex flex-wrap items-center gap-1.5 border-b px-4 py-2">
                        <span class="text-[11px] text-muted-foreground">Filters:</span>
                        <button
                            v-for="chip in staffFilterChips"
                            :key="chip.key"
                            type="button"
                            class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80"
                            @click="chip.clear"
                        >
                            {{ chip.label }}
                            <AppIcon name="circle-x" class="size-3" />
                        </button>
                        <button class="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline" @click="resetFilters">
                            Clear all
                        </button>
                    </div>

                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="min-h-[12rem]">
                                <RegistryListSkeleton v-if="loading || listLoading" :count="6" />

                                <div
                                    v-else-if="staffProfiles.length === 0"
                                    class="flex flex-col items-center gap-3 px-4 py-10 text-center"
                                >
                                    <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
                                        <AppIcon name="users" class="size-4 text-muted-foreground" />
                                    </div>
                                    <div class="space-y-1">
                                        <p class="text-sm font-medium">No staff profiles found</p>
                                        <p class="text-xs text-muted-foreground">
                                            Try adjusting your search or filters, or create a new staff profile.
                                        </p>
                                    </div>
                                    <Button
                                        v-if="canCreateStaff"
                                        size="sm"
                                        class="h-8 gap-1.5"
                                        @click="openCreateStaffSheet()"
                                    >
                                        <AppIcon name="plus" class="size-3.5" />
                                        Create staff profile
                                    </Button>
                                </div>

                                <div v-else class="divide-y px-4">
                                    <RegistryListRow
                                        v-for="profile in staffProfiles"
                                        :key="`staff-modern-row-${profile.id}`"
                                        :status-dot-class="staffStatusDotClass(profile.status)"
                                        :status-title="(profile.status ?? 'unknown').toString()"
                                        @select="openStaffDetailsSheet(profile)"
                                    >
                                        <template #title>
                                            <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                                <span class="truncate text-sm font-medium transition-colors hover:text-primary">
                                                    {{ staffDisplayName(profile) }}
                                                </span>
                                                <span class="shrink-0 text-xs text-muted-foreground">
                                                    {{ profile.employeeNumber || 'No employee number' }}
                                                </span>
                                            </div>
                                        </template>
                                        <template #meta>
                                            <p class="truncate text-xs text-muted-foreground">
                                                {{ profile.jobTitle || 'No title' }}
                                                <span class="text-border"> · </span>
                                                {{ profile.department || 'No department' }}
                                            </p>
                                        </template>
                                        <template #badges>
                                            <Badge :variant="statusVariant(profile.status)" class="capitalize">
                                                {{ profile.status || 'unknown' }}
                                            </Badge>
                                            <Badge
                                                v-if="canReadStaffCredentialing && staffCredentialingSummary(profile.id)?.credentialingState"
                                                :variant="credentialingStateVariant(staffCredentialingSummary(profile.id)?.credentialingState ?? null)"
                                            >
                                                {{ credentialingStateLabel(staffCredentialingSummary(profile.id)?.credentialingState ?? null) }}
                                            </Badge>
                                        </template>
                                        <template #actions>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                class="h-8 rounded-lg text-xs"
                                                @click="openStaffDetailsSheet(profile)"
                                            >
                                                Details
                                            </Button>
                                            <DropdownMenu v-if="canUpdateStaff || canUpdateStaffStatus">
                                                <DropdownMenuTrigger as-child>
                                                    <Button variant="outline" size="icon" class="size-8 shrink-0">
                                                        <AppIcon name="ellipsis-vertical" class="size-4" />
                                                        <span class="sr-only">More actions</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" class="w-44 rounded-lg">
                                                    <DropdownMenuItem
                                                        v-if="canUpdateStaff"
                                                        class="gap-2"
                                                        @select="openStaffEditDialog(profile)"
                                                    >
                                                        <AppIcon name="pencil" class="size-4" />
                                                        Edit profile
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        v-if="canUpdateStaffStatus"
                                                        class="gap-2"
                                                        @select="openStaffStatusDialog(profile)"
                                                    >
                                                        <AppIcon name="activity" class="size-4" />
                                                        Change status
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </template>
                                    </RegistryListRow>
                                </div>
                            </div>
                        </ScrollArea>

                        <footer class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                            <p class="text-xs text-muted-foreground">
                                <template v-if="pagination">
                                    Showing {{ staffProfiles.length }} of
                                    {{ pagination.total }} · Page
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
                                    v-for="pageNumber in paginationPageNumbers"
                                    :key="String(pageNumber)"
                                >
                                    <span
                                        v-if="pageNumber === '...'"
                                        class="px-1 text-xs text-muted-foreground"
                                    >…</span>
                                    <Button
                                        v-else
                                        :variant="pageNumber === pagination?.currentPage ? 'default' : 'ghost'"
                                        size="icon"
                                        class="size-8 text-xs"
                                        :disabled="listLoading"
                                        @click="goToPage(pageNumber as number)"
                                    >
                                        {{ pageNumber }}
                                    </Button>
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
                        </footer>
                    </CardContent>
                </Card>

                <Card v-else-if="permissionsLoaded" class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                            Staff Directory
                        </CardTitle>
                        <CardDescription>Search and review staff profiles by identity, department, and status.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle>Staff read access restricted</AlertTitle>
                            <AlertDescription>Request <code>staff.read</code> permission to view staff list.</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

            </div>

            <Sheet :open="createSheetOpen" @update:open="createSheetOpen = $event">
                <SheetContent side="right" variant="form" size="3xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="users" class="size-5 text-muted-foreground" />
                            Create staff profile
                        </SheetTitle>
                        <SheetDescription>
                            Link an existing user account, then assign department placement and job details.
                        </SheetDescription>
                    </SheetHeader>

                    <ScrollArea class="min-h-0 flex-1">
                        <div class="grid gap-4 px-6 py-4">
                            <div v-if="createLinkedUser" class="rounded-lg border bg-muted/20 px-4 py-3">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="text-sm font-semibold text-foreground">{{ createLinkedUser.displayName }}</span>
                                    <Badge :variant="createLinkedUser.emailVerifiedAt ? 'default' : 'secondary'">
                                        {{ createLinkedUser.emailVerifiedAt ? 'Email verified' : 'Invite pending' }}
                                    </Badge>
                                </div>
                                <p v-if="createLinkedUser.email" class="mt-1 text-sm text-muted-foreground">
                                    {{ createLinkedUser.email }}
                                </p>
                                <div class="mt-2 flex flex-wrap items-center gap-1.5">
                                    <Badge v-if="createLinkedUser.primaryFacilityLabel" variant="outline">
                                        {{ createLinkedUser.primaryFacilityLabel }}
                                    </Badge>
                                    <Badge
                                        v-for="roleLabel in createLinkedUser.roleLabels.slice(0, 2)"
                                        :key="`create-linked-user-role-sheet-${createLinkedUser.id}-${roleLabel}`"
                                        variant="outline"
                                    >
                                        {{ roleLabel }}
                                    </Badge>
                                    <Badge v-if="createLinkedUser.roleLabels.length > 2" variant="secondary">
                                        +{{ createLinkedUser.roleLabels.length - 2 }} more roles
                                    </Badge>
                                </div>
                            </div>

                            <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Identity & placement</legend>
                                <div class="grid gap-2 sm:col-span-2">
                                    <StaffUserLookupField
                                        input-id="staff-user-id-sheet"
                                        v-model="createForm.userId"
                                        @selected="handleCreateLinkedUserSelected"
                                        label="Linked user"
                                        placeholder="Search user by name or email"
                                        helper-text="Search active user accounts that do not already have a staff profile."
                                        :error-message="createErrors.userId?.[0] ?? null"
                                        :disabled="createLoading"
                                    />
                                </div>
                                <div class="grid gap-2 sm:col-span-2">
                                                                    <SearchableSelectField
                                                                        input-id="staff-department-sheet"
                                                                        v-model="createForm.departmentId"
                                                                        label="Department"
                                                                        :options="createDepartmentOptions"
                                                                        placeholder="Select department"
                                                                        search-placeholder="Search departments or categories"
                                                                        helper-text="Departments are grouped by category from the registry."
                                                                        :error-message="createErrors.departmentId?.[0] ?? null"
                                                                        :disabled="departmentOptionsLoading || createLoading"
                                                                    />
                                    <div
                                        v-if="createDepartmentCategorySuggestion"
                                        class="rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
                                    >
                                        Suggested category from linked user role:
                                        <span class="font-medium text-foreground">
                                            {{ createDepartmentCategorySuggestion }}
                                        </span>
                                    </div>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="staff-employment-type-sheet">Employment type</Label>
                                    <Select v-model="createForm.employmentType">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="full_time">Full time</SelectItem>
                                            <SelectItem value="part_time">Part time</SelectItem>
                                            <SelectItem value="contract">Contract</SelectItem>
                                            <SelectItem value="locum">Locum</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </fieldset>

                            <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Role & licence details</legend>
                                <div class="grid gap-2 sm:col-span-2">
                                    <Label for="staff-job-title-sheet">Staff position / job title</Label>
                                    <Input id="staff-job-title-sheet" v-model="createForm.jobTitle" placeholder="Registration Officer, Theatre Nurse, Medical Officer" />
                                    <p class="text-xs text-muted-foreground">
                                        Organizational staff post on the staff profile. Facility posting is managed under Platform Users. Professional title is managed in Credentialing.
                                    </p>
                                    <p v-if="createErrors.jobTitle" class="text-xs text-destructive">{{ createErrors.jobTitle[0] }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="staff-license-number-sheet">Professional license number</Label>
                                    <Input id="staff-license-number-sheet" v-model="createForm.professionalLicenseNumber" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="staff-license-type-sheet">License type</Label>
                                    <Input id="staff-license-type-sheet" v-model="createForm.licenseType" />
                                </div>
                                <div class="grid gap-2 sm:col-span-2">
                                    <Label for="staff-phone-extension-sheet">Phone extension</Label>
                                    <Input id="staff-phone-extension-sheet" v-model="createForm.phoneExtension" />
                                </div>
                            </fieldset>
                        </div>
                    </ScrollArea>

                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <Button type="button" variant="outline" :disabled="createLoading" @click="createSheetOpen = false">
                            Cancel
                        </Button>
                        <Button type="button" :disabled="createLoading" class="gap-1.5" @click="createStaffProfile">
                            <AppIcon name="plus" class="size-3.5" />
                            {{ createLoading ? 'Creating...' : 'Create staff profile' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

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

            <Dialog
                :open="detailsDocumentUploadDialogOpen"
                @update:open="(open) => (open ? (detailsDocumentUploadDialogOpen = true) : closeDetailsDocumentUploadDialog())"
            >
                <DialogContent size="lg" class="max-h-[90vh] gap-0 overflow-hidden p-0">
                    <DialogHeader class="border-b px-6 py-4 text-left">
                        <DialogTitle class="flex items-center gap-2">
                            <AppIcon name="upload" class="size-4 text-muted-foreground" />
                            Upload document
                        </DialogTitle>
                        <DialogDescription>
                            Choose a file, then add type and optional validity dates for this staff member.
                        </DialogDescription>
                    </DialogHeader>
                    <div class="space-y-4 overflow-y-auto px-6 py-4">
                        <div
                            role="button"
                            tabindex="0"
                            class="relative cursor-pointer rounded-lg border-2 border-dashed p-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            :class="detailsDocumentUploadFile ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/20'"
                            @click="triggerDetailsDocumentFilePicker"
                            @keydown.enter.prevent="triggerDetailsDocumentFilePicker"
                            @keydown.space.prevent="triggerDetailsDocumentFilePicker"
                            @dragover.prevent
                            @drop.prevent="onDetailsDocumentFileDrop"
                        >
                            <input
                                :key="`staff-doc-upload-input-${detailsDocumentUploadInputKey}`"
                                ref="detailsDocumentUploadFileInputRef"
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt,application/pdf,image/jpeg,image/png"
                                class="sr-only"
                                @change="onDetailsDocumentFileChange"
                            />
                            <div v-if="detailsDocumentUploadFile" class="flex flex-col items-center gap-2">
                                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                    <AppIcon name="file-text" class="size-5 text-primary" />
                                </div>
                                <p class="text-sm font-medium">{{ detailsDocumentUploadFile.name }}</p>
                                <p class="text-xs text-muted-foreground">{{ formatFileSize(detailsDocumentUploadFile.size) }}</p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    class="mt-1 h-7 gap-1.5 text-xs"
                                    @click.stop="clearDetailsDocumentUploadFile"
                                >
                                    <AppIcon name="x" class="size-3" />
                                    Remove file
                                </Button>
                            </div>
                            <div v-else class="flex flex-col items-center gap-2 py-2">
                                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                    <AppIcon name="upload" class="size-5 text-muted-foreground" />
                                </div>
                                <p class="text-sm font-medium">Drop a file here or click to browse</p>
                                <p class="text-xs text-muted-foreground">
                                    PDF, JPG, PNG, DOC, DOCX, or TXT · max {{ documentUploadMaxLabel }}
                                </p>
                            </div>
                            <p v-if="detailsDocumentUploadErrors.file" class="mt-2 text-xs text-destructive">
                                {{ detailsDocumentUploadErrors.file[0] }}
                            </p>
                        </div>

                        <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                            <legend class="px-2 text-sm font-medium text-muted-foreground">Document details</legend>
                            <div class="grid gap-2">
                                <Label for="staff-doc-upload-type">Type</Label>
                                <Select v-model="detailsDocumentUploadForm.documentType">
                                    <SelectTrigger id="staff-doc-upload-type" class="w-full">
                                        <SelectValue placeholder="Choose type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="type in staffDocumentTypes" :key="`staff-doc-type-${type}`" :value="type">
                                            {{ documentTypeLabel(type) }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-2">
                                <Label for="staff-doc-upload-title">Title</Label>
                                <Input id="staff-doc-upload-title" v-model="detailsDocumentUploadForm.title" placeholder="e.g. Medical license copy" />
                                <p v-if="detailsDocumentUploadErrors.title" class="text-xs text-destructive">
                                    {{ detailsDocumentUploadErrors.title[0] }}
                                </p>
                            </div>
                            <div class="grid gap-2 sm:col-span-2">
                                <Label for="staff-doc-upload-description">Description <span class="font-normal text-muted-foreground">(optional)</span></Label>
                                <Textarea
                                    id="staff-doc-upload-description"
                                    v-model="detailsDocumentUploadForm.description"
                                    rows="2"
                                    placeholder="Brief context for reviewers"
                                />
                            </div>
                        </fieldset>

                        <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                            <legend class="px-2 text-sm font-medium text-muted-foreground">Validity dates <span class="font-normal normal-case">(optional)</span></legend>
                            <div class="grid gap-2">
                                <Label for="staff-doc-upload-issued-at">Issued</Label>
                                <Input id="staff-doc-upload-issued-at" v-model="detailsDocumentUploadForm.issuedAt" type="date" />
                            </div>
                            <div class="grid gap-2">
                                <Label for="staff-doc-upload-expires-at">Expires</Label>
                                <Input id="staff-doc-upload-expires-at" v-model="detailsDocumentUploadForm.expiresAt" type="date" />
                            </div>
                        </fieldset>
                    </div>
                    <DialogFooter class="gap-2 border-t px-6 py-4">
                        <Button variant="outline" :disabled="detailsDocumentUploadLoading" @click="closeDetailsDocumentUploadDialog">
                            Cancel
                        </Button>
                        <Button class="gap-1.5" :disabled="detailsDocumentUploadLoading" @click="submitDetailsDocumentUpload">
                            <AppIcon name="upload" class="size-3.5" />
                            {{ detailsDocumentUploadLoading ? 'Uploading…' : 'Upload document' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                :open="documentMetadataDialogOpen"
                @update:open="(open) => (open ? (documentMetadataDialogOpen = true) : closeDocumentMetadataDialog())"
            >
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>Edit Document Metadata</DialogTitle>
                        <DialogDescription>Update staff document metadata and validity dates.</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <div class="grid gap-2">
                            <Label for="staff-doc-meta-type">Document Type</Label>
                            <Select v-model="documentMetadataForm.documentType">
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem v-for="type in staffDocumentTypes" :key="`staff-doc-meta-type-${type}`" :value="type">
                                    {{ documentTypeLabel(type) }}
                                </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="grid gap-2">
                            <Label for="staff-doc-meta-title">Title</Label>
                            <Input id="staff-doc-meta-title" v-model="documentMetadataForm.title" />
                            <p v-if="documentMetadataDialogErrors.title" class="text-xs text-destructive">
                                {{ documentMetadataDialogErrors.title[0] }}
                            </p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="staff-doc-meta-description">Description</Label>
                            <Textarea id="staff-doc-meta-description" v-model="documentMetadataForm.description" class="min-h-24" />
                        </div>
                        <div class="grid gap-3 md:grid-cols-2">
                            <div class="grid gap-2">
                                <Label for="staff-doc-meta-issued-at">Issued At</Label>
                                <Input id="staff-doc-meta-issued-at" v-model="documentMetadataForm.issuedAt" type="date" />
                            </div>
                            <div class="grid gap-2">
                                <Label for="staff-doc-meta-expires-at">Expires At</Label>
                                <Input id="staff-doc-meta-expires-at" v-model="documentMetadataForm.expiresAt" type="date" />
                            </div>
                        </div>
                        <Alert v-if="documentMetadataDialogError" variant="destructive">
                            <AlertTitle>Metadata update failed</AlertTitle>
                            <AlertDescription>{{ documentMetadataDialogError }}</AlertDescription>
                        </Alert>
                    </div>
                    <DialogFooter class="gap-2">
                        <Button variant="outline" :disabled="documentMetadataDialogLoading" @click="closeDocumentMetadataDialog">
                            Cancel
                        </Button>
                        <Button :disabled="documentMetadataDialogLoading" @click="submitDocumentMetadataDialog">
                            {{ documentMetadataDialogLoading ? 'Updating...' : 'Save Changes' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                :open="documentVerificationDialogOpen"
                @update:open="(open) => (open ? (documentVerificationDialogOpen = true) : closeDocumentVerificationDialog())"
            >
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>Update Verification</DialogTitle>
                        <DialogDescription>Set document verification outcome and reason when rejected.</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <div class="grid gap-2">
                            <Label for="staff-doc-verification-status">Verification Status</Label>
                            <Select v-model="documentVerificationStatus">
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="verified">Verified</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="grid gap-2">
                            <Label for="staff-doc-verification-reason">Reason</Label>
                            <Textarea id="staff-doc-verification-reason" v-model="documentVerificationReason" class="min-h-24" placeholder="Required when status is rejected" />
                            <p v-if="documentVerificationDialogErrors.reason" class="text-xs text-destructive">
                                {{ documentVerificationDialogErrors.reason[0] }}
                            </p>
                        </div>
                        <Alert v-if="documentVerificationDialogError" variant="destructive">
                            <AlertTitle>Verification update failed</AlertTitle>
                            <AlertDescription>{{ documentVerificationDialogError }}</AlertDescription>
                        </Alert>
                    </div>
                    <DialogFooter class="gap-2">
                        <Button variant="outline" :disabled="documentVerificationDialogLoading" @click="closeDocumentVerificationDialog">
                            Cancel
                        </Button>
                        <Button :disabled="documentVerificationDialogLoading" @click="submitDocumentVerificationDialog">
                            {{ documentVerificationDialogLoading ? 'Updating...' : 'Save Verification' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                :open="documentStatusDialogOpen"
                @update:open="(open) => (open ? (documentStatusDialogOpen = true) : closeDocumentStatusDialog())"
            >
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>{{ documentStatusDialogTarget === 'archived' ? 'Archive Document' : 'Activate Document' }}</DialogTitle>
                        <DialogDescription>
                            {{ documentStatusDialogTarget === 'archived'
                                ? 'Provide a reason before archiving this document.'
                                : 'Confirm document re-activation.' }}
                        </DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <div class="grid gap-2">
                            <Label for="staff-doc-status-reason">Reason</Label>
                            <Textarea id="staff-doc-status-reason" v-model="documentStatusDialogReason" class="min-h-24" placeholder="Required when archiving" />
                            <p v-if="documentStatusDialogErrors.reason" class="text-xs text-destructive">
                                {{ documentStatusDialogErrors.reason[0] }}
                            </p>
                        </div>
                        <Alert v-if="documentStatusDialogError" variant="destructive">
                            <AlertTitle>Status update failed</AlertTitle>
                            <AlertDescription>{{ documentStatusDialogError }}</AlertDescription>
                        </Alert>
                    </div>
                    <DialogFooter class="gap-2">
                        <Button variant="outline" :disabled="documentStatusDialogLoading" @click="closeDocumentStatusDialog">
                            Cancel
                        </Button>
                        <Button :disabled="documentStatusDialogLoading" @click="submitDocumentStatusDialog">
                            {{ documentStatusDialogLoading ? 'Updating...' : documentStatusDialogTarget === 'archived' ? 'Archive' : 'Activate' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Sheet
                :open="detailsSheetOpen"
                @update:open="(open) => (open ? (detailsSheetOpen = true) : closeStaffDetailsSheet())"
            >
                <SheetContent side="right" variant="workspace" size="5xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader
                        v-if="detailsSheetStaff"
                        class="shrink-0 border-b bg-background/95 px-4 py-3 pr-12 text-left sm:px-5"
                    >
                        <SheetTitle class="flex min-w-0 flex-wrap items-center gap-2 text-base">
                            <AppIcon name="user" class="size-5 text-muted-foreground" />
                            <span class="min-w-0 truncate">{{ staffDisplayName(detailsSheetStaff) }}</span>
                            <Badge
                                v-if="detailsSheetStaff.employeeNumber"
                                variant="outline"
                                class="shrink-0 font-normal"
                            >
                                {{ detailsSheetStaff.employeeNumber }}
                            </Badge>
                            <Badge :variant="statusVariant(detailsSheetStaff.status)" class="shrink-0 capitalize">
                                {{ detailsSheetStaff.status || 'unknown' }}
                            </Badge>
                        </SheetTitle>
                        <SheetDescription class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span class="flex items-center gap-1">
                                <AppIcon name="briefcase" class="size-3 opacity-50" />
                                <span>{{ detailsSheetStaff.jobTitle || 'No title recorded' }}</span>
                            </span>
                            <span class="text-muted-foreground/40">&middot;</span>
                            <span class="flex items-center gap-1">
                                <AppIcon name="building-2" class="size-3 opacity-50" />
                                <span>{{ detailsSheetStaff.department || 'No department' }}</span>
                            </span>
                            <span class="text-muted-foreground/40">&middot;</span>
                            <span class="flex items-center gap-1">
                                <AppIcon name="mail" class="size-3 opacity-50" />
                                <span>{{ detailsSheetStaff.userEmail || 'No linked email' }}</span>
                            </span>
                        </SheetDescription>
                    </SheetHeader>

                    <div v-if="detailsSheetStaff" class="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <Tabs v-model="detailsSheetTab" class="flex h-full min-h-0 flex-col">
                            <div class="shrink-0 border-b bg-background px-4 py-2 sm:px-5">
                                <div class="space-y-2.5">
                                    <div
                                        class="grid gap-y-2 rounded-md bg-muted/20 px-3 py-2 text-xs sm:grid-cols-3 sm:divide-x sm:divide-border/50"
                                    >
                                        <div class="min-w-0 sm:pr-3">
                                            <p class="font-medium tracking-[0.14em] text-muted-foreground uppercase">
                                                Placement
                                            </p>
                                            <p class="mt-1 truncate text-sm font-medium text-foreground">
                                                {{ detailsSheetStaff.department || 'No department' }}
                                            </p>
                                            <p class="truncate text-muted-foreground">
                                                {{ employmentTypeLabel(detailsSheetStaff.employmentType) }}
                                            </p>
                                        </div>
                                        <div class="min-w-0 sm:px-3">
                                            <p class="font-medium tracking-[0.14em] text-muted-foreground uppercase">
                                                Credentialing
                                            </p>
                                            <p class="mt-1 truncate text-sm font-medium text-foreground">
                                                {{
                                                    canReadStaffCredentialing && detailsSheetCredentialingSummary?.credentialingState
                                                        ? credentialingStateLabel(detailsSheetCredentialingSummary.credentialingState)
                                                        : canReadStaffCredentialing && credentialingSummariesLoading
                                                          ? 'Checking...'
                                                          : 'Not available'
                                                }}
                                            </p>
                                            <p class="truncate text-muted-foreground">
                                                {{ linkedUserVerificationLabel(detailsSheetStaff) }}
                                            </p>
                                        </div>
                                        <div class="min-w-0 sm:pl-3">
                                            <p class="font-medium tracking-[0.14em] text-muted-foreground uppercase">
                                                Records
                                            </p>
                                            <p class="mt-1 truncate text-sm font-medium text-foreground">
                                                {{ detailsDocumentMeta?.total ?? detailsDocuments.length }} documents
                                            </p>
                                            <p class="truncate text-muted-foreground">
                                                {{ detailsAuditMeta?.total ?? detailsAuditLogs.length }} audit events
                                            </p>
                                        </div>
                                    </div>

                                    <div class="w-full">
                                        <TabsList
                                            class="grid h-auto w-full gap-1 rounded-md bg-muted p-1"
                                            :class="detailsSheetTabGridClass"
                                        >
                                            <TabsTrigger
                                                value="overview"
                                                class="h-9 min-w-0 gap-1.5 rounded-md px-2 text-xs sm:px-3 sm:text-sm"
                                            >
                                                <AppIcon name="layout-grid" class="size-3.5" />
                                                Overview
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="documents"
                                                class="h-9 min-w-0 gap-1.5 rounded-md px-2 text-xs sm:px-3 sm:text-sm"
                                            >
                                                <AppIcon name="file-text" class="size-3.5" />
                                                Documents
                                                <Badge
                                                    v-if="(detailsDocumentMeta?.total ?? detailsDocuments.length) > 0"
                                                    variant="secondary"
                                                    class="h-4 min-w-4 px-1 text-xs"
                                                >
                                                    {{ detailsDocumentMeta?.total ?? detailsDocuments.length }}
                                                </Badge>
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="audit"
                                                class="h-9 min-w-0 gap-1.5 rounded-md px-2 text-xs sm:px-3 sm:text-sm"
                                            >
                                                <AppIcon name="activity" class="size-3.5" />
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

                            <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                                <Alert v-if="detailsSheetActionMessage" class="mx-4 mt-3 sm:mx-5">
                                    <AlertTitle>Saved</AlertTitle>
                                    <AlertDescription>{{ detailsSheetActionMessage }}</AlertDescription>
                                </Alert>

                                <Alert
                                    v-if="linkedUserGovernanceBlockerMessage(detailsSheetStaff)"
                                    variant="destructive"
                                    class="mx-4 mt-3 sm:mx-5"
                                >
                                    <AlertTitle>Linked user verification required</AlertTitle>
                                    <AlertDescription>{{ linkedUserGovernanceBlockerMessage(detailsSheetStaff) }}</AlertDescription>
                                </Alert>

                                <p
                                    v-if="credentialingApplicabilityNote(detailsSheetCredentialingSummary)"
                                    class="mx-4 mt-3 text-xs text-muted-foreground sm:mx-5"
                                >
                                    {{ credentialingApplicabilityNote(detailsSheetCredentialingSummary) }}
                                </p>

                                <!-- Overview Tab -->
                                <TabsContent value="overview" class="m-0 space-y-3 px-4 py-3 sm:px-5">
                                    <div
                                        v-if="
                                            detailsSheetStaff.status &&
                                            detailsSheetStaff.status.toLowerCase() !== 'active' &&
                                            detailsSheetStaff.statusReason
                                        "
                                        class="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs"
                                    >
                                        <AppIcon
                                            name="alert-triangle"
                                            class="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                                        />
                                        <span class="text-amber-700 dark:text-amber-300">
                                            <span class="font-semibold capitalize">{{ detailsSheetStaff.status }}</span>:
                                            {{ detailsSheetStaff.statusReason }}
                                        </span>
                                    </div>

                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <Card class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none">
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <CardTitle class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                    <AppIcon name="user" class="size-3.5" />
                                                    Identity
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="divide-y divide-border/50 px-3 py-1.5 text-sm">
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Display name</span>
                                                    <span class="max-w-[14rem] truncate text-right font-medium">{{ staffDisplayName(detailsSheetStaff) }}</span>
                                                </div>
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Employee number</span>
                                                    <span class="font-medium">{{ detailsSheetStaff.employeeNumber || 'Not recorded' }}</span>
                                                </div>
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Status</span>
                                                    <Badge :variant="statusVariant(detailsSheetStaff.status)" class="capitalize">
                                                        {{ detailsSheetStaff.status || 'unknown' }}
                                                    </Badge>
                                                </div>
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Email verification</span>
                                                    <Badge :variant="linkedUserVerificationVariant(detailsSheetStaff)">
                                                        {{ linkedUserVerificationLabel(detailsSheetStaff) }}
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none">
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <CardTitle class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                    <AppIcon name="layout-list" class="size-3.5" />
                                                    Role & employment
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="divide-y divide-border/50 px-3 py-1.5 text-sm">
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Department</span>
                                                    <span class="max-w-[14rem] truncate text-right font-medium">{{ detailsSheetStaff.department || 'Not recorded' }}</span>
                                                </div>
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Job title</span>
                                                    <span class="max-w-[14rem] truncate text-right font-medium">{{ detailsSheetStaff.jobTitle || 'Not recorded' }}</span>
                                                </div>
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Employment</span>
                                                    <span class="font-medium capitalize">{{ employmentTypeLabel(detailsSheetStaff.employmentType) }}</span>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none">
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <CardTitle class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                    <AppIcon name="shield-check" class="size-3.5" />
                                                    Credentials
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="divide-y divide-border/50 px-3 py-1.5 text-sm">
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">License number</span>
                                                    <span class="font-medium">{{ detailsSheetStaff.professionalLicenseNumber || 'Not recorded' }}</span>
                                                </div>
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">License type</span>
                                                    <span class="font-medium">{{ detailsSheetStaff.licenseType || 'Not recorded' }}</span>
                                                </div>
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Phone extension</span>
                                                    <span class="font-medium">{{ detailsSheetStaff.phoneExtension || 'Not recorded' }}</span>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none">
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <CardTitle class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                    <AppIcon name="mail" class="size-3.5" />
                                                    Linked account
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="divide-y divide-border/50 px-3 py-1.5 text-sm">
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">User ID</span>
                                                    <span class="font-medium">{{ detailsSheetStaff.userId ?? 'Not linked' }}</span>
                                                </div>
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="shrink-0 text-muted-foreground">Email</span>
                                                    <span class="max-w-[14rem] truncate text-right font-medium">{{ detailsSheetStaff.userEmail || 'Not recorded' }}</span>
                                                </div>
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Platform user</span>
                                                    <Link
                                                        v-if="canReadPlatformUsers && detailsSheetStaff.userId"
                                                        :href="linkedPlatformUserHref(detailsSheetStaff)"
                                                        class="font-medium hover:text-primary hover:underline"
                                                    >
                                                        Open linked user
                                                    </Link>
                                                    <span v-else class="font-medium text-muted-foreground">Unavailable</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <Card class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none">
                                        <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                            <CardTitle class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                <AppIcon name="stethoscope" class="size-3.5" />
                                                Specialties
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent class="px-3 py-3 text-sm">
                                            <template v-if="canReadStaffSpecialties">
                                                <div v-if="detailsSpecialtiesLoading" class="space-y-2">
                                                    <Skeleton class="h-12 w-full" />
                                                    <Skeleton class="h-12 w-full" />
                                                </div>
                                                <div v-else-if="detailsSpecialtiesError" class="text-sm text-destructive">
                                                    {{ detailsSpecialtiesError }}
                                                </div>
                                                <div v-else-if="detailsSpecialties.length" class="divide-y divide-border/50">
                                                    <div
                                                        v-for="assignment in detailsSpecialties"
                                                        :key="assignment.id ?? assignment.specialtyId ?? staffSpecialtyLabel(assignment)"
                                                        class="flex items-start justify-between gap-3 py-2.5"
                                                    >
                                                        <div class="min-w-0">
                                                            <p class="truncate font-medium">{{ staffSpecialtyLabel(assignment) }}</p>
                                                            <p class="text-xs text-muted-foreground">{{ assignment.specialty?.description || 'Assigned clinical specialty' }}</p>
                                                        </div>
                                                        <Badge :variant="assignment.isPrimary ? 'default' : 'outline'">
                                                            {{ assignment.isPrimary ? 'Primary' : 'Assigned' }}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <p v-else class="text-muted-foreground">
                                                    {{
                                                        credentialingNotApplicable(detailsSheetCredentialingSummary)
                                                            ? 'Clinical specialties are not used for this non-clinical staff role.'
                                                            : 'No specialties are assigned to this staff profile yet.'
                                                    }}
                                                </p>
                                            </template>
                                            <p v-else class="text-muted-foreground">
                                                Request `staff.specialties.read` permission to review specialty assignments.
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card v-if="canReadStaffCredentialing" class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none">
                                        <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                            <CardTitle class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                <AppIcon name="shield-check" class="size-3.5" />
                                                Credentialing
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent class="divide-y divide-border/50 px-3 py-1.5 text-sm">
                                            <div class="flex items-center justify-between gap-4 py-2">
                                                <span class="text-muted-foreground">State</span>
                                                <span class="font-medium">
                                                    {{
                                                        detailsSheetCredentialingSummary?.credentialingState
                                                            ? credentialingStateLabel(detailsSheetCredentialingSummary.credentialingState)
                                                            : credentialingSummariesLoading
                                                              ? 'Checking...'
                                                              : 'Not recorded'
                                                    }}
                                                </span>
                                            </div>
                                            <template v-if="!credentialingNotApplicable(detailsSheetCredentialingSummary)">
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Next expiry</span>
                                                    <span class="font-medium">{{ detailsSheetCredentialingSummary?.nextExpiryAt || 'Not recorded' }}</span>
                                                </div>
                                                <div class="flex items-center justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Verified registrations</span>
                                                    <span class="font-medium">{{ detailsSheetCredentialingSummary?.registrationSummary?.verified ?? 0 }}</span>
                                                </div>
                                                <div class="flex items-start justify-between gap-4 py-2">
                                                    <span class="shrink-0 text-muted-foreground">Blocking preview</span>
                                                    <span class="text-right font-medium">
                                                        {{
                                                            credentialingSummariesLoading && !detailsSheetCredentialingSummary
                                                                ? 'Checking...'
                                                                : credentialingBlockingPreview(detailsSheetCredentialingSummary)
                                                        }}
                                                    </span>
                                                </div>
                                            </template>
                                            <p v-else class="py-2 text-muted-foreground">
                                                {{ credentialingApplicabilityNote(detailsSheetCredentialingSummary) }}
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none">
                                        <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                            <CardTitle class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                <AppIcon name="calendar-clock" class="size-3.5" />
                                                Timeline
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent class="divide-y divide-border/50 px-3 py-1.5 text-sm">
                                            <div class="flex items-center justify-between gap-4 py-2">
                                                <span class="text-muted-foreground">Created</span>
                                                <span class="font-medium">{{ formatDateTime(detailsSheetStaff.createdAt) }}</span>
                                            </div>
                                            <div class="flex items-center justify-between gap-4 py-2">
                                                <span class="text-muted-foreground">Updated</span>
                                                <span class="font-medium">{{ formatDateTime(detailsSheetStaff.updatedAt) }}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <!-- Documents Tab -->
                                <TabsContent value="documents" class="m-0 space-y-3 px-4 py-3 sm:px-5">
                                    <Alert v-if="permissionsLoaded && !canReadStaffDocuments" variant="destructive">
                                        <AlertTitle>Document Access Restricted</AlertTitle>
                                        <AlertDescription>Request <code>staff.documents.read</code> permission.</AlertDescription>
                                    </Alert>
                                    <div v-else class="space-y-3">
                                        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                                            <SearchInput
                                                id="staff-doc-filter-q-toolbar"
                                                v-model="detailsDocumentFilters.q"
                                                placeholder="Search title, filename, or type…"
                                                class="sm:flex-1"
                                                @keyup.enter="applyDetailsDocumentFilters"
                                            />
                                            <div class="flex shrink-0 items-center gap-2">
                                                <Button
                                                    v-if="canCreateStaffDocuments"
                                                    size="sm"
                                                    class="h-8 gap-1.5"
                                                    @click="openDetailsDocumentUploadDialog"
                                                >
                                                    <AppIcon name="upload" class="size-3.5" />
                                                    Upload
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    class="h-8 gap-1.5"
                                                    :disabled="detailsDocumentsLoading"
                                                    @click="detailsSheetStaff && loadDetailsDocuments(detailsSheetStaff.id)"
                                                >
                                                    <AppIcon name="refresh-cw" class="size-3.5" />
                                                    Refresh
                                                </Button>
                                            </div>
                                        </div>

                                        <Collapsible v-model:open="detailsDocumentFiltersOpen">
                                            <Card class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none">
                                                <CollapsibleTrigger as-child>
                                                    <CardHeader class="cursor-pointer px-3 py-2.5 hover:bg-muted/30">
                                                        <CardTitle class="flex items-center justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                            <span class="flex items-center gap-2">
                                                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                                Filters
                                                                <Badge v-if="detailsDocumentActiveFilterCount > 0" variant="secondary" class="normal-case tracking-normal">
                                                                    {{ detailsDocumentActiveFilterCount }}
                                                                </Badge>
                                                            </span>
                                                            <AppIcon :name="detailsDocumentFiltersOpen ? 'chevron-up' : 'chevron-down'" class="size-4" />
                                                        </CardTitle>
                                                    </CardHeader>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    <CardContent class="space-y-3 border-t border-border/40 px-3 pb-3 pt-0">
                                                        <div class="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                                                            <div class="grid gap-1.5">
                                                                <Label for="staff-doc-filter-type" class="text-xs">Type</Label>
                                                                <Select v-model="detailsDocumentFilters.documentType">
                                                                    <SelectTrigger id="staff-doc-filter-type" class="h-8 text-xs">
                                                                        <SelectValue placeholder="All types" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="">All types</SelectItem>
                                                                        <SelectItem v-for="type in staffDocumentTypes" :key="`staff-doc-filter-type-${type}`" :value="type">
                                                                            {{ documentTypeLabel(type) }}
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div class="grid gap-1.5">
                                                                <Label for="staff-doc-filter-status" class="text-xs">Status</Label>
                                                                <Select v-model="detailsDocumentFilters.status">
                                                                    <SelectTrigger id="staff-doc-filter-status" class="h-8 text-xs">
                                                                        <SelectValue placeholder="All status" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="">All status</SelectItem>
                                                                        <SelectItem value="active">Active</SelectItem>
                                                                        <SelectItem value="archived">Archived</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div class="grid gap-1.5">
                                                                <Label for="staff-doc-filter-verification" class="text-xs">Verification</Label>
                                                                <Select v-model="detailsDocumentFilters.verificationStatus">
                                                                    <SelectTrigger id="staff-doc-filter-verification" class="h-8 text-xs">
                                                                        <SelectValue placeholder="All verification" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="">All verification</SelectItem>
                                                                        <SelectItem value="pending">Pending</SelectItem>
                                                                        <SelectItem value="verified">Verified</SelectItem>
                                                                        <SelectItem value="rejected">Rejected</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div class="grid gap-1.5">
                                                                <Label for="staff-doc-filter-expires-from" class="text-xs">Expires from</Label>
                                                                <Input id="staff-doc-filter-expires-from" v-model="detailsDocumentFilters.expiresFrom" type="date" class="h-8 text-xs" />
                                                            </div>
                                                            <div class="grid gap-1.5">
                                                                <Label for="staff-doc-filter-expires-to" class="text-xs">Expires to</Label>
                                                                <Input id="staff-doc-filter-expires-to" v-model="detailsDocumentFilters.expiresTo" type="date" class="h-8 text-xs" />
                                                            </div>
                                                            <div class="grid gap-1.5">
                                                                <Label for="staff-doc-filter-per-page" class="text-xs">Per page</Label>
                                                                <Select :model-value="String(detailsDocumentFilters.perPage)" @update:model-value="detailsDocumentFilters.perPage = Number($event)">
                                                                    <SelectTrigger id="staff-doc-filter-per-page" class="h-8 text-xs">
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
                                                        <div class="flex flex-wrap items-center gap-2">
                                                            <Button size="sm" class="h-7 gap-1.5 text-xs" :disabled="detailsDocumentsLoading" @click="applyDetailsDocumentFilters">
                                                                <AppIcon name="search" class="size-3" />
                                                                {{ detailsDocumentsLoading ? 'Applying…' : 'Apply filters' }}
                                                            </Button>
                                                            <Button size="sm" variant="outline" class="h-7 gap-1.5 text-xs" :disabled="detailsDocumentsLoading" @click="resetDetailsDocumentFilters">
                                                                <AppIcon name="rotate-ccw" class="size-3" />
                                                                Reset
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </CollapsibleContent>
                                            </Card>
                                        </Collapsible>

                                        <Card class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none">
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <CardTitle class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                    <AppIcon name="file-text" class="size-3.5" />
                                                    Documents
                                                    <span class="font-normal normal-case tracking-normal">({{ detailsDocumentMeta?.total ?? detailsDocuments.length }})</span>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="px-0 pb-0 pt-0">
                                                <Alert v-if="detailsDocumentsError" class="mx-3 mt-3">
                                                    <AlertTitle>Document load issue</AlertTitle>
                                                    <AlertDescription>{{ detailsDocumentsError }}</AlertDescription>
                                                </Alert>
                                                <div v-else-if="detailsDocumentsLoading" class="space-y-2 px-3 py-3">
                                                    <Skeleton class="h-12 w-full" />
                                                    <Skeleton class="h-12 w-full" />
                                                    <Skeleton class="h-12 w-full" />
                                                </div>
                                                <div v-else-if="detailsDocuments.length === 0" class="flex flex-col items-center gap-2 px-3 py-10 text-center">
                                                    <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                                        <AppIcon name="file-text" class="size-5 text-muted-foreground" />
                                                    </div>
                                                    <p class="text-sm font-medium">No documents found</p>
                                                    <p class="max-w-xs text-xs text-muted-foreground">
                                                        {{
                                                            detailsDocumentActiveFilterCount > 0
                                                                ? 'Try adjusting filters or upload a new document.'
                                                                : canCreateStaffDocuments
                                                                  ? 'Upload the first document for this staff member.'
                                                                  : 'No documents have been uploaded yet.'
                                                        }}
                                                    </p>
                                                    <Button
                                                        v-if="canCreateStaffDocuments && detailsDocumentActiveFilterCount === 0"
                                                        size="sm"
                                                        class="mt-1 h-8 gap-1.5"
                                                        @click="openDetailsDocumentUploadDialog"
                                                    >
                                                        <AppIcon name="upload" class="size-3.5" />
                                                        Upload document
                                                    </Button>
                                                </div>
                                                <div v-else class="divide-y divide-border/50">
                                                    <div
                                                        v-for="document in detailsDocuments"
                                                        :key="document.id"
                                                        class="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/20"
                                                    >
                                                        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                                            <AppIcon name="file-text" class="size-3.5 text-muted-foreground" />
                                                        </div>
                                                        <div class="min-w-0 flex-1">
                                                            <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                                                <p class="truncate text-sm font-medium">
                                                                    {{ document.title || 'Untitled document' }}
                                                                </p>
                                                                <Badge :variant="documentStatusVariant(document.status)" class="h-5 capitalize">
                                                                    {{ document.status || 'unknown' }}
                                                                </Badge>
                                                                <Badge :variant="documentVerificationVariant(document.verificationStatus)" class="h-5 capitalize">
                                                                    {{ document.verificationStatus || 'pending' }}
                                                                </Badge>
                                                            </div>
                                                            <p class="truncate text-xs text-muted-foreground">
                                                                {{ documentTypeLabel(document.documentType) }}
                                                                <span class="text-border"> · </span>
                                                                {{ document.originalFilename || 'N/A' }}
                                                                <span class="text-border"> · </span>
                                                                {{ formatFileSize(document.fileSizeBytes) }}
                                                            </p>
                                                        </div>
                                                        <div class="flex shrink-0 items-center gap-1.5">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                class="h-8 gap-1.5 text-xs"
                                                                @click="downloadStaffDocument(document)"
                                                            >
                                                                <AppIcon name="download" class="size-3.5" />
                                                                <span class="hidden sm:inline">Download</span>
                                                            </Button>
                                                            <DropdownMenu
                                                                v-if="canUpdateStaffDocuments || canVerifyStaffDocuments || canUpdateStaffDocumentStatus || canViewStaffDocumentAudit"
                                                            >
                                                                <DropdownMenuTrigger as-child>
                                                                    <Button variant="outline" size="icon" class="size-8 shrink-0">
                                                                        <AppIcon name="ellipsis-vertical" class="size-4" />
                                                                        <span class="sr-only">Document actions</span>
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" class="w-44 rounded-lg">
                                                                    <DropdownMenuItem
                                                                        v-if="canUpdateStaffDocuments"
                                                                        class="gap-2"
                                                                        @select="openDocumentMetadataDialog(document)"
                                                                    >
                                                                        <AppIcon name="pencil" class="size-4" />
                                                                        Edit metadata
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        v-if="canVerifyStaffDocuments"
                                                                        class="gap-2"
                                                                        @select="openDocumentVerificationDialog(document)"
                                                                    >
                                                                        <AppIcon name="shield-check" class="size-4" />
                                                                        Verify
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        v-if="canUpdateStaffDocumentStatus"
                                                                        class="gap-2"
                                                                        @select="openDocumentStatusDialog(document, document.status === 'archived' ? 'active' : 'archived')"
                                                                    >
                                                                        <AppIcon :name="document.status === 'archived' ? 'circle-check-big' : 'folder'" class="size-4" />
                                                                        {{ document.status === 'archived' ? 'Activate' : 'Archive' }}
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        v-if="canViewStaffDocumentAudit"
                                                                        class="gap-2"
                                                                        @select="openDetailsDocumentAudit(document)"
                                                                    >
                                                                        <AppIcon name="activity" class="size-4" />
                                                                        View audit
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div
                                                    v-if="!detailsDocumentsLoading && detailsDocuments.length > 0"
                                                    class="flex items-center justify-between border-t border-border/40 px-3 py-2"
                                                >
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        class="h-7 gap-1.5 text-xs"
                                                        :disabled="detailsDocumentsLoading || !detailsDocumentMeta || detailsDocumentMeta.currentPage <= 1"
                                                        @click="goToDetailsDocumentPage((detailsDocumentMeta?.currentPage ?? 2) - 1)"
                                                    >
                                                        <AppIcon name="chevron-left" class="size-3" />
                                                        Prev
                                                    </Button>
                                                    <p class="text-xs text-muted-foreground">
                                                        Page {{ detailsDocumentMeta?.currentPage ?? 1 }} of {{ detailsDocumentMeta?.lastPage ?? 1 }}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        class="h-7 gap-1.5 text-xs"
                                                        :disabled="detailsDocumentsLoading || !detailsDocumentMeta || detailsDocumentMeta.currentPage >= detailsDocumentMeta.lastPage"
                                                        @click="goToDetailsDocumentPage((detailsDocumentMeta?.currentPage ?? 0) + 1)"
                                                    >
                                                        Next
                                                        <AppIcon name="chevron-right" class="size-3" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card
                                            v-if="detailsDocumentAuditDocument"
                                            class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none"
                                        >
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <div class="flex items-center justify-between gap-2">
                                                    <CardTitle class="flex min-w-0 items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                        <AppIcon name="activity" class="size-3.5 shrink-0" />
                                                        <span class="truncate normal-case tracking-normal">
                                                            Audit · {{ detailsDocumentAuditDocument.title || detailsDocumentAuditDocument.originalFilename || detailsDocumentAuditDocument.id }}
                                                        </span>
                                                    </CardTitle>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        class="size-7 shrink-0"
                                                        @click="resetDetailsDocumentAuditState()"
                                                    >
                                                        <AppIcon name="x" class="size-3.5" />
                                                        <span class="sr-only">Close audit</span>
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-2 px-3 py-3">
                                                <Alert v-if="detailsDocumentAuditError" variant="destructive">
                                                    <AlertTitle>Audit load issue</AlertTitle>
                                                    <AlertDescription>{{ detailsDocumentAuditError }}</AlertDescription>
                                                </Alert>
                                                <div v-else-if="detailsDocumentAuditLoading" class="space-y-2">
                                                    <Skeleton class="h-10 w-full" />
                                                    <Skeleton class="h-10 w-full" />
                                                </div>
                                                <div v-else-if="detailsDocumentAuditLogs.length === 0" class="flex flex-col items-center gap-2 py-4 text-center">
                                                    <p class="text-xs text-muted-foreground">No audit logs for this document.</p>
                                                </div>
                                                <div v-else class="divide-y divide-border/50">
                                                    <div v-for="log in detailsDocumentAuditLogs" :key="log.id" class="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                                                        <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                                                            <AppIcon name="activity" class="size-3 text-muted-foreground" />
                                                        </div>
                                                        <div class="min-w-0 flex-1">
                                                            <p class="text-xs font-medium">{{ auditActionDisplay(log) }}</p>
                                                            <p class="text-xs text-muted-foreground">{{ log.createdAt || 'N/A' }} · {{ auditActorDisplay(log) }}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>

                                <!-- Audit Tab -->
                                <TabsContent value="audit" class="m-0 space-y-3 px-4 py-3 sm:px-5">
                                    <Alert v-if="permissionsLoaded && !canViewStaffAudit" variant="destructive">
                                        <AlertTitle>Audit Access Restricted</AlertTitle>
                                        <AlertDescription>Request <code>staff.view-audit-logs</code> permission.</AlertDescription>
                                    </Alert>
                                    <div v-else class="space-y-3">
                                        <!-- Collapsible filters -->
                                        <Collapsible v-model:open="detailsAuditFiltersOpen">
                                            <Card class="rounded-lg">
                                                <CollapsibleTrigger as-child>
                                                    <CardHeader class="cursor-pointer px-4 py-3 hover:bg-muted/30">
                                                        <CardTitle class="flex items-center justify-between text-sm">
                                                            <span class="flex items-center gap-2">
                                                                <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                                                Filters
                                                            </span>
                                                            <AppIcon :name="detailsAuditFiltersOpen ? 'chevron-up' : 'chevron-down'" class="size-4 text-muted-foreground" />
                                                        </CardTitle>
                                                    </CardHeader>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    <CardContent class="space-y-3 px-4 pb-4 pt-0">
                                                        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                            <div class="grid gap-1.5">
                                                                <Label for="staff-audit-q" class="text-xs">Action Text</Label>
                                                                <Input id="staff-audit-q" v-model="detailsAuditFilters.q" placeholder="status.updated, created..." class="h-8 text-xs" />
                                                            </div>
                                                            <div class="grid gap-1.5">
                                                                <Label for="staff-audit-action" class="text-xs">Action (exact)</Label>
                                                                <Input id="staff-audit-action" v-model="detailsAuditFilters.action" placeholder="Exact action key" class="h-8 text-xs" />
                                                            </div>
                                                            <div class="grid gap-1.5">
                                                                <Label for="staff-audit-actor-type" class="text-xs">Actor Type</Label>
                                                                <Select v-model="detailsAuditFilters.actorType">
                                                                    <SelectTrigger class="h-8 text-xs">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                    <SelectItem v-for="option in auditActorTypeOptions" :key="`staff-audit-actor-type-${option.value || 'all'}`" :value="option.value">{{ option.label }}</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div class="grid gap-1.5">
                                                                <Label for="staff-audit-actor-id" class="text-xs">Actor ID</Label>
                                                                <Input id="staff-audit-actor-id" v-model="detailsAuditFilters.actorId" inputmode="numeric" placeholder="User ID" class="h-8 text-xs" />
                                                            </div>
                                                            <div class="grid gap-1.5">
                                                                <Label for="staff-audit-from" class="text-xs">From</Label>
                                                                <Input id="staff-audit-from" v-model="detailsAuditFilters.from" type="datetime-local" class="h-8 text-xs" />
                                                            </div>
                                                            <div class="grid gap-1.5">
                                                                <Label for="staff-audit-to" class="text-xs">To</Label>
                                                                <Input id="staff-audit-to" v-model="detailsAuditFilters.to" type="datetime-local" class="h-8 text-xs" />
                                                            </div>
                                                        </div>
                                                        <div class="flex flex-wrap items-center gap-2">
                                                            <Button size="sm" class="h-7 gap-1.5 text-xs" :disabled="detailsAuditLoading" @click="applyDetailsAuditFilters">
                                                                <AppIcon name="search" class="size-3" />
                                                                {{ detailsAuditLoading ? 'Applying...' : 'Apply' }}
                                                            </Button>
                                                            <Button size="sm" variant="outline" class="h-7 gap-1.5 text-xs" :disabled="detailsAuditLoading" @click="resetDetailsAuditFilters">
                                                                <AppIcon name="rotate-ccw" class="size-3" />
                                                                Reset
                                                            </Button>
                                                            <Button size="sm" variant="outline" class="h-7 gap-1.5 text-xs" :disabled="detailsAuditLoading || detailsAuditExporting" @click="exportDetailsAuditLogsCsv">
                                                                <AppIcon name="download" class="size-3" />
                                                                {{ detailsAuditExporting ? 'Preparing...' : 'Export CSV' }}
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </CollapsibleContent>
                                            </Card>
                                        </Collapsible>

                                        <!-- Audit logs -->
                                        <Alert v-if="detailsAuditError" variant="destructive">
                                            <AlertTitle>Audit Load Issue</AlertTitle>
                                            <AlertDescription>{{ detailsAuditError }}</AlertDescription>
                                        </Alert>
                                        <div v-else-if="detailsAuditLoading" class="space-y-2">
                                            <Skeleton class="h-10 w-full" />
                                            <Skeleton class="h-10 w-full" />
                                        </div>
                                        <div v-else-if="detailsAuditLogs.length === 0" class="flex flex-col items-center gap-2 py-8 text-center">
                                            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                                <AppIcon name="activity" class="size-5 text-muted-foreground" />
                                            </div>
                                            <p class="text-sm text-muted-foreground">No audit logs found for current filters.</p>
                                        </div>
                                        <div v-else class="space-y-2">
                                            <div v-for="log in detailsAuditLogs" :key="log.id" class="flex items-start gap-3">
                                                <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                                                    <AppIcon name="activity" class="size-3.5 text-muted-foreground" />
                                                </div>
                                                <div class="min-w-0 flex-1 pt-0.5">
                                                    <p class="text-sm font-medium">{{ auditActionDisplay(log) }}</p>
                                                    <p class="mt-0.5 text-xs text-muted-foreground">{{ log.createdAt || 'N/A' }} · {{ auditActorLabel(log) }}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Audit pagination -->
                                        <div class="flex items-center justify-between pt-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                class="h-7 gap-1.5 text-xs"
                                                :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage <= 1"
                                                @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 2) - 1)"
                                            >
                                                <AppIcon name="chevron-left" class="size-3" />
                                                Prev
                                            </Button>
                                            <p class="text-xs text-muted-foreground">
                                                Page {{ detailsAuditMeta?.currentPage ?? 1 }} of {{ detailsAuditMeta?.lastPage ?? 1 }} · {{ detailsAuditMeta?.total ?? detailsAuditLogs.length }} logs
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                class="h-7 gap-1.5 text-xs"
                                                :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage >= detailsAuditMeta.lastPage"
                                                @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 0) + 1)"
                                            >
                                                Next
                                                <AppIcon name="chevron-right" class="size-3" />
                                            </Button>
                                        </div>
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
                            @click="closeStaffDetailsSheet"
                        >
                            <AppIcon name="circle-x" class="size-3.5" />
                            Close
                        </Button>
                        <div v-if="detailsSheetStaff" class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                            <Button
                                v-if="canUpdateStaffStatus"
                                size="sm"
                                variant="outline"
                                class="gap-1.5"
                                @click="openStaffStatusDialog(detailsSheetStaff)"
                            >
                                <AppIcon name="activity" class="size-3.5" />
                                Change status
                            </Button>
                            <Button
                                v-if="canUpdateStaff"
                                size="sm"
                                variant="outline"
                                class="gap-1.5"
                                @click="openStaffEditDialog(detailsSheetStaff)"
                            >
                                <AppIcon name="pencil" class="size-3.5" />
                                Edit profile
                            </Button>
                            <Button
                                v-if="canReadPlatformUsers && detailsSheetStaff.userId"
                                size="sm"
                                variant="outline"
                                as-child
                                class="gap-1.5"
                            >
                                <Link :href="linkedPlatformUserHref(detailsSheetStaff)">
                                    <AppIcon name="user" class="size-3.5" />
                                    Open linked user
                                </Link>
                            </Button>
                            <Button
                                v-if="canReadStaffCredentialing && detailsSheetCredentialingSummary && !credentialingNotApplicable(detailsSheetCredentialingSummary)"
                                size="sm"
                                as-child
                                class="gap-1.5"
                            >
                                <Link :href="workspaceStaffHref('/staff-credentialing', detailsSheetStaff)">
                                    <AppIcon name="badge-check" class="size-3.5" />
                                    Open credentialing
                                </Link>
                            </Button>
                            <Button
                                v-if="canReadStaffPrivileges && (!canReadStaffCredentialing || (detailsSheetCredentialingSummary && !credentialingNotApplicable(detailsSheetCredentialingSummary)))"
                                size="sm"
                                variant="outline"
                                as-child
                                class="gap-1.5"
                            >
                                <Link :href="workspaceStaffHref('/staff-privileges', detailsSheetStaff)">
                                    <AppIcon name="shield-check" class="size-3.5" />
                                    Open privileging
                                </Link>
                            </Button>
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Drawer
                v-if="canReadStaff"
                :open="mobileFiltersDrawerOpen"
                @update:open="mobileFiltersDrawerOpen = $event"
            >
                    <DrawerContent class="max-h-[90vh]">
                        <DrawerHeader>
                            <DrawerTitle class="flex items-center gap-2">
                                <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            Filters & view
                        </DrawerTitle>
                        <DrawerDescription>Search the staff queue, adjust filters, and change list density on mobile.</DrawerDescription>
                    </DrawerHeader>
                    <div class="space-y-4 overflow-y-auto px-4 pb-2">
                        <div class="rounded-lg border p-3">
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="staff-search-q-mobile">Search</Label>
                                    <Input
                                        id="staff-search-q-mobile"
                                        v-model="searchForm.q"
                                        placeholder="Name, employee number, title, department"
                                        @keyup.enter="submitSearchFromMobileDrawer"
                                    />
                                </div>
                            </div>
                        </div>
                        <div class="rounded-lg border p-3">
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="staff-search-department-mobile">Department</Label>
                                    <Select
                                        v-if="filterDepartmentOptions.length > 0"
                                        v-model="searchForm.department"
                                        :disabled="departmentOptionsLoading"
                                    >
                                        <SelectTrigger id="staff-search-department-mobile" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">All departments</SelectItem>
                                            <SelectItem
                                                v-for="option in filterDepartmentOptions"
                                                :key="`staff-mobile-department-${option.value}`"
                                                :value="option.value"
                                            >
                                                {{ option.label }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        v-else
                                        id="staff-search-department-mobile"
                                        v-model="searchForm.department"
                                        placeholder="Outpatient, Laboratory..."
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="staff-search-employment-mobile">Employment</Label>
                                    <Select v-model="searchForm.employmentType">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">All employment</SelectItem>
                                        <SelectItem value="full_time">Full time</SelectItem>
                                        <SelectItem value="part_time">Part time</SelectItem>
                                        <SelectItem value="contract">Contract</SelectItem>
                                        <SelectItem value="locum">Locum</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="staff-search-per-page-mobile">Results per page</Label>
                                    <Select v-model="searchForm.perPage">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="12">12 / page</SelectItem>
                                        <SelectItem value="24">24 / page</SelectItem>
                                        <SelectItem value="48">48 / page</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="staff-search-density-mobile">Row density</Label>
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
                            </div>
                        </div>
                    </div>
                    <DrawerFooter class="gap-2">
                        <Button :disabled="listLoading" @click="submitSearchFromMobileDrawer">
                            <AppIcon name="search" class="size-3.5" />
                            Search
                        </Button>
                        <Button
                            variant="outline"
                            :disabled="listLoading && !hasActiveStaffFilters"
                            @click="resetFiltersFromMobileDrawer"
                        >
                            Reset Filters
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    </AppLayout>
</template>


























