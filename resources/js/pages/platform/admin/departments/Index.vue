<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
import AuditTimelineList from '@/components/audit/AuditTimelineList.vue';
import AppIcon from '@/components/AppIcon.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Input, SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { activeInactiveStatusDotClass } from '@/lib/listRows';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { type BreadcrumbItem } from '@/types';

type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type StatusCounts = { active: number; inactive: number; other: number; total: number };
type DepartmentManager = {
    userId: number | null;
    displayName: string | null;
    email: string | null;
    staffProfileId: string | null;
    staffStatus: string | null;
};
type Department = {
    id: string | null;
    code: string | null;
    name: string | null;
    serviceType: string | null;
    isPatientFacing: boolean;
    isAppointmentable: boolean;
    managerUserId: number | null;
    manager?: DepartmentManager | null;
    status: string | null;
    statusReason: string | null;
    description: string | null;
};
type AuditLog = {
    id: string;
    actorId: number | null;
    actor?: { displayName?: string | null } | null;
    action: string | null;
    actionLabel?: string | null;
    createdAt: string | null;
};
type ApiError = { message?: string; errors?: Record<string, string[]> };
type ListResponse<T> = { data: T[]; meta: Pagination };
type ItemResponse<T> = { data: T };
type StatusResponse = { data: StatusCounts };
type AuditResponse = { data: AuditLog[]; meta: Pagination };
type ValidationErrors = Record<string, string[]>;
type DepartmentStaffProfile = {
    id: string;
    userId: number | null;
    userName: string | null;
    userEmail?: string | null;
    userEmailVerified?: boolean;
    employeeNumber: string | null;
    department: string | null;
    jobTitle: string | null;
    status: string | null;
    updatedAt: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Platform Admin', href: '/platform/admin/departments' },
    { title: 'Departments', href: '/platform/admin/departments' },
];

const EMPTY_SELECT_VALUE = '__all__';
const serviceTypeOptions: SearchableSelectOption[] = [
    {
        value: 'Clinical Service',
        label: 'Clinical Service',
        description: 'OPD, specialty clinic, emergency, theatre, maternity, or direct patient care unit.',
        group: 'Patient care',
        keywords: ['opd', 'clinic', 'emergency', 'theatre', 'maternity'],
    },
    {
        value: 'Diagnostic Service',
        label: 'Diagnostic Service',
        description: 'Laboratory, imaging, point-of-care diagnostics, or sample collection.',
        group: 'Patient care',
        keywords: ['lab', 'radiology', 'imaging', 'diagnostics'],
    },
    {
        value: 'Pharmacy & Dispensing',
        label: 'Pharmacy & Dispensing',
        description: 'Dispensing, medicine counselling, stock-facing pharmacy service, or OTC counter.',
        group: 'Patient care',
        keywords: ['pharmacy', 'dispensing', 'medicine'],
    },
    {
        value: 'Nursing & Ward Operations',
        label: 'Nursing & Ward Operations',
        description: 'Ward, bed, nursing station, inpatient observation, or procedure room operations.',
        group: 'Care operations',
        keywords: ['ward', 'nursing', 'bed', 'inpatient'],
    },
    {
        value: 'Revenue Cycle',
        label: 'Revenue Cycle',
        description: 'Billing, cashier, claims, payer relations, or patient financial counselling.',
        group: 'Administration',
        keywords: ['billing', 'cashier', 'claims', 'insurance'],
    },
    {
        value: 'Medical Records',
        label: 'Medical Records',
        description: 'Registration, file room, records archive, coding, or documentation desk.',
        group: 'Administration',
        keywords: ['registration', 'records', 'archive'],
    },
    {
        value: 'Supply & Support',
        label: 'Supply & Support',
        description: 'Stores, procurement, maintenance, laundry, sterilization, ICT, or logistics.',
        group: 'Operations',
        keywords: ['stores', 'procurement', 'maintenance', 'ict'],
    },
    {
        value: 'Governance & Administration',
        label: 'Governance & Administration',
        description: 'Management, quality, HR, finance, compliance, or facility administration.',
        group: 'Administration',
        keywords: ['admin', 'quality', 'hr', 'finance', 'compliance'],
    },
];

const { permissionState, scope } = usePlatformAccess();
const canRead = computed(() => permissionState('departments.read') === 'allowed');
const canCreate = computed(() => permissionState('departments.create') === 'allowed');
const canUpdate = computed(() => permissionState('departments.update') === 'allowed');
const canUpdateStatus = computed(() => permissionState('departments.update-status') === 'allowed');
const canAudit = computed(() => permissionState('departments.view-audit-logs') === 'allowed');
const canReadStaff = computed(() => permissionState('staff.read') === 'allowed');
const departmentRegistryReadOnly = computed(
    () => canRead.value && !canCreate.value && !canUpdate.value && !canUpdateStatus.value,
);
const workspaceIntroText = computed(() => {
    const base = `${counts.value.total} departments in facility scope`;

    return departmentRegistryReadOnly.value
        ? `${base} · browse department master data for routing and staff lookup`
        : `${base} · configure routing, appointments, staff teams, and service points`;
});

const loading = ref(true);
const listLoading = ref(false);
const errors = ref<string[]>([]);
const items = ref<Department[]>([]);
const pagination = ref<Pagination | null>(null);
const counts = ref<StatusCounts>({ active: 0, inactive: 0, other: 0, total: 0 });
const filters = reactive({ q: '', status: '', serviceType: '', managerUserId: '', page: 1, perPage: 20 });
const departmentFiltersOpen = ref(false);
const managerOptionsLoading = ref(false);
const managerOptionsError = ref<string | null>(null);
const managerProfiles = ref<DepartmentStaffProfile[]>([]);
const departmentFilterCount = computed(() => {
    let count = 0;
    if (filters.q.trim()) count += 1;
    if (filters.status) count += 1;
    if (filters.serviceType.trim()) count += 1;
    if (filters.managerUserId.trim()) count += 1;
    if (filters.perPage !== 20) count += 1;
    return count;
});
const departmentScopeText = computed(() => `${counts.value.total} departments in scope`);
const departmentListFilterHintText = computed(() =>
    departmentFilterCount.value > 0
        ? `${departmentFilterCount.value} filters applied`
        : 'Use filters for category, manager, or page size',
);
const departmentFilterChips = computed(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];

    if (filters.q.trim()) {
        chips.push({
            key: 'q',
            label: `"${filters.q.trim()}"`,
            clear: () => {
                filters.q = '';
                filters.page = 1;
                void refreshPage();
            },
        });
    }

    if (filters.status) {
        chips.push({
            key: 'status',
            label: filters.status === 'active' ? 'Active' : 'Inactive',
            clear: () => {
                filters.status = '';
                filters.page = 1;
                void refreshPage();
            },
        });
    }

    if (filters.serviceType.trim()) {
        chips.push({
            key: 'serviceType',
            label: filters.serviceType.trim(),
            clear: () => {
                filters.serviceType = '';
                filters.page = 1;
                void refreshPage();
            },
        });
    }

    if (filters.managerUserId.trim()) {
        const manager = departmentManagerOptions.value.find((option) => option.value === filters.managerUserId.trim());
        chips.push({
            key: 'managerUserId',
            label: manager ? `Manager: ${manager.label}` : `Manager #${filters.managerUserId.trim()}`,
            clear: () => {
                filters.managerUserId = '';
                filters.page = 1;
                void refreshPage();
            },
        });
    }

    if (filters.perPage !== 20) {
        chips.push({
            key: 'perPage',
            label: `${filters.perPage} per page`,
            clear: () => {
                filters.perPage = 20;
                filters.page = 1;
                void refreshPage();
            },
        });
    }

    return chips;
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

const createOpen = ref(false);
const createLoading = ref(false);
const createRequestError = ref<string | null>(null);
const createFormErrors = ref<ValidationErrors>({});
const createForm = reactive({
    code: '',
    name: '',
    serviceType: '',
    isPatientFacing: false,
    isAppointmentable: false,
    managerUserId: '',
    description: '',
});
const editOpen = ref(false);
const editLoading = ref(false);
const editTarget = ref<Department | null>(null);
const editRequestError = ref<string | null>(null);
const editFormErrors = ref<ValidationErrors>({});
const editForm = reactive({
    code: '',
    name: '',
    serviceType: '',
    isPatientFacing: false,
    isAppointmentable: false,
    managerUserId: '',
    description: '',
});

const statusOpen = ref(false);
const statusLoading = ref(false);
const statusError = ref<string | null>(null);
const statusTarget = ref<'active' | 'inactive'>('active');
const statusReason = ref('');
const statusDepartment = ref<Department | null>(null);

const auditTarget = ref<Department | null>(null);
const auditLoading = ref(false);
const auditError = ref<string | null>(null);
const auditLogs = ref<AuditLog[]>([]);
const auditMeta = ref<Pagination | null>(null);
const detailsOpen = ref(false);
const detailsDepartment = ref<Department | null>(null);
const detailsSheetTab = ref('overview');
const detailsStaffLoading = ref(false);
const detailsStaffError = ref<string | null>(null);
const detailsStaff = ref<DepartmentStaffProfile[]>([]);
const detailsStaffMeta = ref<Pagination | null>(null);

const departmentManagerOptions = computed<SearchableSelectOption[]>(() => {
    const options = new Map<string, SearchableSelectOption>();

    const addOption = (value: number | string | null | undefined, option: Omit<SearchableSelectOption, 'value'>) => {
        const normalizedValue = String(value ?? '').trim();
        if (!normalizedValue || options.has(normalizedValue)) return;
        options.set(normalizedValue, { value: normalizedValue, ...option });
    };

    managerProfiles.value.forEach((profile) => {
        addOption(profile.userId, {
            label: staffProfileDisplayName(profile),
            description: [profile.employeeNumber, profile.jobTitle, profile.userEmail].filter(Boolean).join(' | '),
            group: profile.department || 'No department',
            keywords: [profile.employeeNumber, profile.userEmail, profile.jobTitle, profile.department].filter(Boolean) as string[],
        });
    });

    items.value.forEach((department) => {
        if (!department.managerUserId) return;
        addOption(department.managerUserId, {
            label: departmentManagerDisplayName(department.manager, department.managerUserId),
            description: department.manager?.email ?? undefined,
            group: department.manager?.staffStatus ? `Staff ${department.manager.staffStatus}` : 'Assigned manager',
        });
    });

    [detailsDepartment.value, editTarget.value].forEach((department) => {
        if (!department?.managerUserId) return;
        addOption(department.managerUserId, {
            label: departmentManagerDisplayName(department.manager, department.managerUserId),
            description: department.manager?.email ?? undefined,
            group: department.manager?.staffStatus ? `Staff ${department.manager.staffStatus}` : 'Assigned manager',
        });
    });

    return [...options.values()].sort((left, right) => {
        const groupCompare = (left.group ?? '').localeCompare(right.group ?? '');
        if (groupCompare !== 0) return groupCompare;

        return left.label.localeCompare(right.label);
    });
});

const createValidationMessages = computed(() => Object.values(createFormErrors.value).flat());
const editValidationMessages = computed(() => Object.values(editFormErrors.value).flat());

const detailsSheetTabGridClass = computed(() => {
    const tabCount = 1 + (canReadStaff.value ? 1 : 0) + (canAudit.value ? 1 : 0);
    if (tabCount >= 3) return 'grid-cols-3';
    if (tabCount === 2) return 'grid-cols-2';
    return 'grid-cols-1';
});

const detailsStaffTotal = computed(() => detailsStaffMeta.value?.total ?? detailsStaff.value.length);

function resetCreateForm() {
    createForm.code = '';
    createForm.name = '';
    createForm.serviceType = '';
    createForm.isPatientFacing = false;
    createForm.isAppointmentable = false;
    createForm.managerUserId = '';
    createForm.description = '';
    createRequestError.value = null;
    createFormErrors.value = {};
}

function setCreatePatientFacing(checked: boolean) {
    createForm.isPatientFacing = checked;
    if (!checked) {
        createForm.isAppointmentable = false;
    }
}

function setCreateAppointmentable(checked: boolean) {
    createForm.isAppointmentable = checked;
    if (checked) {
        createForm.isPatientFacing = true;
    }
}

function setEditPatientFacing(checked: boolean) {
    editForm.isPatientFacing = checked;
    if (!checked) {
        editForm.isAppointmentable = false;
    }
}

function setEditAppointmentable(checked: boolean) {
    editForm.isAppointmentable = checked;
    if (checked) {
        editForm.isPatientFacing = true;
    }
}

function openCreateDialog() {
    resetCreateForm();
    createOpen.value = true;
    if (canReadStaff.value && managerProfiles.value.length === 0 && !managerOptionsLoading.value) {
        void loadManagerOptions();
    }
}

function closeCreateSheet(open: boolean) {
    createOpen.value = open;
    if (!open) {
        resetCreateForm();
    }
}

function closeEditSheet(open: boolean) {
    editOpen.value = open;
    if (!open) {
        editRequestError.value = null;
        editFormErrors.value = {};
    }
}

function csrfToken(): string | null {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
}

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> },
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    let body: string | undefined;
    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        const token = csrfToken();
        if (token) headers['X-CSRF-TOKEN'] = token;
        body = JSON.stringify(options?.body ?? {});
    }

    const response = await fetch(url.toString(), { method, credentials: 'same-origin', headers, body });
    const payload = (await response.json().catch(() => ({}))) as ApiError;
    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as Error & { status?: number; payload?: ApiError };
        error.status = response.status;
        error.payload = payload;
        throw error;
    }
    return payload as T;
}

function labelOf(item: Department | null): string {
    if (!item) return 'Unknown department';
    if (item.code && item.name) return `${item.code} - ${item.name}`;
    return item.name || item.code || item.id || 'Unknown department';
}

function departmentManagerDisplayName(manager: DepartmentManager | null | undefined, managerUserId: number | null): string {
    const label = (manager?.displayName ?? '').trim();
    if (label) return label;

    return managerUserId ? `User #${managerUserId}` : 'Unassigned manager';
}

function departmentManagerInitials(manager: DepartmentManager | null | undefined, managerUserId: number | null): string {
    const label = departmentManagerDisplayName(manager, managerUserId);
    if (!label || label === 'Unassigned manager') return '--';

    const parts = label.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '--';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function departmentManagerStaffHref(item: Department): string | null {
    const staffProfileId = String(item.manager?.staffProfileId ?? '').trim();
    if (!canReadStaff.value || staffProfileId === '') return null;

    return `/staff?staffId=${encodeURIComponent(staffProfileId)}`;
}

function staffProfileDisplayName(profile: DepartmentStaffProfile): string {
    return profile.userName?.trim() || profile.employeeNumber?.trim() || 'Staff profile';
}

function staffProfileInitials(profile: DepartmentStaffProfile): string {
    const label = staffProfileDisplayName(profile);
    const parts = label.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '--';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function staffProfileHref(profile: DepartmentStaffProfile): string | null {
    const id = String(profile.id ?? '').trim();
    if (!canReadStaff.value || id === '') return null;

    return `/staff?staffId=${encodeURIComponent(id)}`;
}

function toSelectValue(value: string | null | undefined): string {
    const normalized = String(value ?? '').trim();
    return normalized === '' ? EMPTY_SELECT_VALUE : normalized;
}

function fromSelectValue(value: string | null | undefined): string {
    const normalized = String(value ?? '').trim();
    return normalized === EMPTY_SELECT_VALUE ? '' : normalized;
}

function fieldError(errors: ValidationErrors, field: string): string | null {
    return errors[field]?.[0] ?? null;
}

function validationErrorsFromUnknown(error: unknown): ValidationErrors {
    return ((error as { payload?: ApiError })?.payload?.errors ?? {}) as ValidationErrors;
}

function departmentExposureLabel(department: Department | null): string {
    if (!department) return 'Internal only';
    const parts = [department.isPatientFacing ? 'Patient-facing' : 'Internal only'];
    if (department.isAppointmentable) {
        parts.push('Appointmentable');
    }
    return parts.join(' · ');
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

function openDepartmentDetails(item: Department) {
    detailsDepartment.value = item;
    detailsSheetTab.value = 'overview';
    detailsOpen.value = true;
    void loadDepartmentStaff(item);
    if (canAudit.value) {
        void loadAudit(item);
    } else {
        auditTarget.value = item;
        auditLogs.value = [];
        auditMeta.value = null;
        auditError.value = null;
        auditLoading.value = false;
    }
}

function closeDepartmentDetails() {
    detailsOpen.value = false;
    detailsDepartment.value = null;
    detailsSheetTab.value = 'overview';
    detailsStaffLoading.value = false;
    detailsStaffError.value = null;
    detailsStaff.value = [];
    detailsStaffMeta.value = null;
    auditTarget.value = null;
    auditLoading.value = false;
    auditError.value = null;
    auditLogs.value = [];
    auditMeta.value = null;
}

async function loadDepartmentStaff(item: Department) {
    if (!canReadStaff.value) {
        detailsStaff.value = [];
        detailsStaffMeta.value = null;
        detailsStaffError.value = null;
        return;
    }

    const department = (item.name ?? item.code ?? '').trim();
    if (!department) {
        detailsStaff.value = [];
        detailsStaffMeta.value = null;
        detailsStaffError.value = null;
        return;
    }

    detailsStaffLoading.value = true;
    detailsStaffError.value = null;

    try {
        const response = await apiRequest<ListResponse<DepartmentStaffProfile>>('GET', '/staff', {
            query: {
                department,
                page: 1,
                perPage: 12,
            },
        });
        detailsStaff.value = response.data ?? [];
        detailsStaffMeta.value = response.meta ?? null;
    } catch (error) {
        detailsStaff.value = [];
        detailsStaffMeta.value = null;
        detailsStaffError.value = messageFromUnknown(error, 'Unable to load staff assigned to this department.');
    } finally {
        detailsStaffLoading.value = false;
    }
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive') return 'destructive';
    return 'outline';
}

function actorLabel(log: AuditLog): string {
    return log.actor?.displayName?.trim() || (log.actorId === null ? 'System' : `User #${log.actorId}`);
}

function parseManager(raw: string): number | null {
    const value = raw.trim();
    if (!value) return null;
    if (!/^\d+$/.test(value)) return NaN;
    return Number(value);
}

async function loadCounts() {
    if (!canRead.value) {
        counts.value = { active: 0, inactive: 0, other: 0, total: 0 };
        return;
    }
    try {
        const response = await apiRequest<StatusResponse>('GET', '/departments/status-counts', {
            query: {
                q: filters.q.trim() || null,
                serviceType: filters.serviceType.trim() || null,
                managerUserId: filters.managerUserId.trim() || null,
            },
        });
        counts.value = response.data ?? { active: 0, inactive: 0, other: 0, total: 0 };
    } catch {
        counts.value = { active: 0, inactive: 0, other: 0, total: 0 };
    }
}

async function loadManagerOptions() {
    if (!canReadStaff.value) {
        managerProfiles.value = [];
        managerOptionsError.value = null;
        return;
    }

    managerOptionsLoading.value = true;
    managerOptionsError.value = null;

    try {
        const response = await apiRequest<ListResponse<DepartmentStaffProfile>>('GET', '/staff', {
            query: {
                status: 'active',
                page: 1,
                perPage: 100,
                sortBy: 'employeeNumber',
                sortDir: 'asc',
            },
        });

        managerProfiles.value = (response.data ?? []).filter((profile) => profile.userId !== null);
    } catch (error) {
        managerProfiles.value = [];
        managerOptionsError.value = messageFromUnknown(error, 'Unable to load active staff managers.');
    } finally {
        managerOptionsLoading.value = false;
    }
}

async function loadItems() {
    if (!canRead.value) {
        items.value = [];
        pagination.value = null;
        loading.value = false;
        listLoading.value = false;
        return;
    }
    listLoading.value = true;
    errors.value = [];
    try {
        const response = await apiRequest<ListResponse<Department>>('GET', '/departments', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status || null,
                serviceType: filters.serviceType.trim() || null,
                managerUserId: filters.managerUserId.trim() || null,
                page: filters.page,
                perPage: filters.perPage,
                sortBy: 'name',
                sortDir: 'asc',
            },
        });
        items.value = response.data ?? [];
        pagination.value = response.meta ?? null;
    } catch (error) {
        items.value = [];
        pagination.value = null;
        errors.value.push(messageFromUnknown(error, 'Unable to load departments.'));
    } finally {
        loading.value = false;
        listLoading.value = false;
    }
}

async function refreshPage() {
    await Promise.all([loadItems(), loadCounts()]);
}

async function createItem() {
    if (!canCreate.value || createLoading.value) return;
    const manager = parseManager(createForm.managerUserId);
    if (Number.isNaN(manager)) return notifyError('Manager user ID must be numeric.');
    createLoading.value = true;
    createRequestError.value = null;
    createFormErrors.value = {};
    try {
        const response = await apiRequest<ItemResponse<Department>>('POST', '/departments', {
            body: {
                code: createForm.code.trim(),
                name: createForm.name.trim(),
                serviceType: createForm.serviceType.trim() || null,
                isPatientFacing: createForm.isPatientFacing,
                isAppointmentable: createForm.isAppointmentable,
                managerUserId: manager,
                description: createForm.description.trim() || null,
            },
        });
        notifySuccess(`Created ${labelOf(response.data)}.`);
        resetCreateForm();
        createOpen.value = false;
        filters.page = 1;
        await refreshPage();
    } catch (error) {
        createFormErrors.value = validationErrorsFromUnknown(error);
        createRequestError.value = messageFromUnknown(error, 'Unable to create department.');
    } finally {
        createLoading.value = false;
    }
}

function openEdit(item: Department) {
    editTarget.value = item;
    editForm.code = item.code || '';
    editForm.name = item.name || '';
    editForm.serviceType = item.serviceType || '';
    editForm.isPatientFacing = item.isPatientFacing === true;
    editForm.isAppointmentable = item.isAppointmentable === true;
    editForm.managerUserId = item.managerUserId === null ? '' : String(item.managerUserId);
    editForm.description = item.description || '';
    editRequestError.value = null;
    editFormErrors.value = {};
    editOpen.value = true;
    if (canReadStaff.value && managerProfiles.value.length === 0 && !managerOptionsLoading.value) {
        void loadManagerOptions();
    }
}

async function saveEdit() {
    const id = editTarget.value?.id?.trim();
    if (!id || !canUpdate.value || editLoading.value) return;
    const manager = parseManager(editForm.managerUserId);
    if (Number.isNaN(manager)) return notifyError('Manager user ID must be numeric.');
    editLoading.value = true;
    editRequestError.value = null;
    editFormErrors.value = {};
    try {
        await apiRequest<ItemResponse<Department>>('PATCH', `/departments/${id}`, {
            body: {
                code: editForm.code.trim(),
                name: editForm.name.trim(),
                serviceType: editForm.serviceType.trim() || null,
                isPatientFacing: editForm.isPatientFacing,
                isAppointmentable: editForm.isAppointmentable,
                managerUserId: manager,
                description: editForm.description.trim() || null,
            },
        });
        notifySuccess('Department updated.');
        editOpen.value = false;
        await refreshPage();
    } catch (error) {
        editFormErrors.value = validationErrorsFromUnknown(error);
        editRequestError.value = messageFromUnknown(error, 'Unable to update department.');
    } finally {
        editLoading.value = false;
    }
}

function openStatus(item: Department, target: 'active' | 'inactive') {
    statusDepartment.value = item;
    statusTarget.value = target;
    statusReason.value = target === 'inactive' ? item.statusReason ?? '' : '';
    statusError.value = null;
    statusOpen.value = true;
}

async function saveStatus() {
    const id = statusDepartment.value?.id?.trim();
    if (!id || !canUpdateStatus.value || statusLoading.value) return;
    if (statusTarget.value === 'inactive' && !statusReason.value.trim()) {
        statusError.value = 'Reason is required for inactivation.';
        return;
    }
    statusLoading.value = true;
    statusError.value = null;
    try {
        await apiRequest<ItemResponse<Department>>('PATCH', `/departments/${id}/status`, {
            body: { status: statusTarget.value, reason: statusTarget.value === 'inactive' ? statusReason.value.trim() : null },
        });
        notifySuccess('Department status updated.');
        statusOpen.value = false;
        await refreshPage();
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update department status.');
    } finally {
        statusLoading.value = false;
    }
}

async function loadAudit(item: Department) {
    const id = item.id?.trim();
    if (!id || !canAudit.value) return;
    auditTarget.value = item;
    auditLoading.value = true;
    auditError.value = null;
    try {
        const response = await apiRequest<AuditResponse>('GET', `/departments/${id}/audit-logs`, { query: { page: 1, perPage: 20 } });
        auditLogs.value = response.data ?? [];
        auditMeta.value = response.meta ?? null;
    } catch (error) {
        auditLogs.value = [];
        auditMeta.value = null;
        auditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
    } finally {
        auditLoading.value = false;
    }
}

function search() { filters.page = 1; void refreshPage(); }
function reset() { filters.q = ''; filters.status = ''; filters.serviceType = ''; filters.managerUserId = ''; filters.perPage = 20; filters.page = 1; void refreshPage(); }
function applyFiltersFromSheet() { departmentFiltersOpen.value = false; search(); }
function resetFiltersFromSheet() { departmentFiltersOpen.value = false; reset(); }
function setStatus(status: '' | 'active' | 'inactive') { filters.status = status; filters.page = 1; void refreshPage(); }
function prevPage() {
    if (!canPrev.value) return;
    filters.page -= 1;
    void loadItems();
}
function nextPage() {
    if (!canNext.value) return;
    filters.page += 1;
    void loadItems();
}
function goToPage(page: number) {
    filters.page = page;
    void loadItems();
}

onMounted(() => {
    void refreshPage();
    void loadManagerOptions();
});
</script>

<template>
    <Head title="Departments" />
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
                            <AppIcon name="building-2" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">
                                    Department Registry
                                </h1>
                                <Badge
                                    v-if="departmentRegistryReadOnly"
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
                            v-if="canCreate"
                            size="sm"
                            class="h-8 gap-1.5"
                            @click="openCreateDialog"
                        >
                            <AppIcon name="plus" class="size-3.5" />
                            Create department
                        </Button>
                    </div>
                </div>
            </section>

            <!-- Alerts -->
            <Alert v-if="errors.length" variant="destructive">
                <AlertTitle>Request error</AlertTitle>
                <AlertDescription>
                    <p v-for="errorMessage in errors" :key="errorMessage" class="text-xs">{{ errorMessage }}</p>
                </AlertDescription>
            </Alert>

            <!-- Single column layout -->
            <div class="flex min-w-0 flex-col gap-4">

                <!-- Departments card -->
                <Card v-if="canRead" class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                    <div class="flex flex-col gap-3 border-b px-4 py-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div class="min-w-0">
                            <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                <AppIcon name="layout-list" class="size-4 text-muted-foreground" />
                                Departments
                            </h3>
                            <p class="mt-1 text-xs text-muted-foreground">
                                {{ departmentScopeText }} · {{ departmentListFilterHintText }}
                            </p>
                        </div>
                        <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-2xl">
                            <SearchInput
                                id="dept-search-q"
                                v-model="filters.q"
                                placeholder="Search code, name, or description"
                                class="min-w-0 flex-1 text-xs [&_input]:h-8"
                                @keyup.enter="search"
                            />
                            <Button variant="outline" size="sm" class="h-8 gap-1.5 rounded-lg text-xs" @click="departmentFiltersOpen = true">
                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                Filters
                                <Badge v-if="departmentFilterCount > 0" variant="secondary" class="ml-1 h-5 px-1.5 text-[10px]">
                                    {{ departmentFilterCount }}
                                </Badge>
                            </Button>
                        </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                                :class="{ 'border-primary bg-primary/5': filters.status === '' }"
                                @click="setStatus('')"
                            >
                                <span class="inline-block h-2 w-2 rounded-full bg-slate-400" />
                                <span class="font-medium tabular-nums">{{ counts.total }}</span>
                                <span class="text-muted-foreground">All</span>
                            </button>
                            <button
                                type="button"
                                class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                                :class="{ 'border-primary bg-primary/5': filters.status === 'active' }"
                                @click="setStatus('active')"
                            >
                                <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                <span class="font-medium tabular-nums">{{ counts.active }}</span>
                                <span class="text-muted-foreground">Active</span>
                            </button>
                            <button
                                type="button"
                                class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                                :class="{ 'border-primary bg-primary/5': filters.status === 'inactive' }"
                                @click="setStatus('inactive')"
                            >
                                <span class="inline-block h-2 w-2 rounded-full bg-rose-500" />
                                <span class="font-medium tabular-nums">{{ counts.inactive }}</span>
                                <span class="text-muted-foreground">Inactive</span>
                            </button>
                            <button
                                v-if="counts.other > 0"
                                type="button"
                                class="flex items-center gap-1.5 rounded-md border border-dashed bg-background px-2.5 py-1 text-xs text-muted-foreground"
                                disabled
                            >
                                <span class="font-medium tabular-nums">{{ counts.other }}</span>
                                <span>Other</span>
                            </button>
                        </div>
                    </div>
                    <div v-if="departmentFilterChips.length" class="flex flex-wrap items-center gap-1.5 border-b px-4 py-2">
                        <span class="text-[11px] text-muted-foreground">Filters:</span>
                        <button
                            v-for="chip in departmentFilterChips"
                            :key="chip.key"
                            type="button"
                            class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80"
                            @click="chip.clear"
                        >
                            {{ chip.label }}
                            <AppIcon name="circle-x" class="size-3" />
                        </button>
                        <button class="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline" @click="reset">
                            Clear all
                        </button>
                    </div>
                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="min-h-[12rem]">
                                <RegistryListSkeleton v-if="loading || listLoading" :count="6" />
                                <div v-else-if="items.length === 0" class="flex flex-col items-center gap-3 px-4 py-10 text-center">
                                    <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
                                        <AppIcon name="building-2" class="size-4 text-muted-foreground" />
                                    </div>
                                    <div class="space-y-1">
                                        <p class="text-sm font-medium">No departments found</p>
                                        <p class="text-xs text-muted-foreground">
                                            {{ departmentFilterCount > 0 ? 'Adjust or clear filters to widen the registry.' : 'Create the first department before configuring service points and staff teams.' }}
                                        </p>
                                    </div>
                                    <div class="flex flex-wrap justify-center gap-2">
                                        <Button v-if="departmentFilterCount > 0" variant="outline" size="sm" class="h-8 gap-1.5" @click="reset">
                                            <AppIcon name="x" class="size-3.5" />
                                            Clear filters
                                        </Button>
                                        <Button v-if="canCreate" size="sm" class="h-8 gap-1.5" @click="openCreateDialog">
                                            <AppIcon name="plus" class="size-3.5" />
                                            Create first department
                                        </Button>
                                    </div>
                                </div>
                                <div v-else class="divide-y px-4">
                                    <RegistryListRow
                                        v-for="item in items"
                                        :key="item.id || item.code || item.name"
                                        :status-dot-class="activeInactiveStatusDotClass(item.status)"
                                        :status-title="item.status"
                                        @select="openDepartmentDetails(item)"
                                    >
                                        <template #title>
                                            <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                                <span class="truncate text-sm font-medium transition-colors hover:text-primary">
                                                    {{ item.name || labelOf(item) }}
                                                </span>
                                                <span class="shrink-0 text-xs text-muted-foreground">
                                                    {{ item.code || 'No code' }}
                                                </span>
                                            </div>
                                        </template>
                                        <template #meta>
                                            <p class="truncate text-xs text-muted-foreground">
                                                {{ item.serviceType || 'Uncategorized' }}
                                                <span class="text-border"> · </span>
                                                <TooltipProvider :delay-duration="100">
                                                    <Tooltip>
                                                        <TooltipTrigger as-child>
                                                            <Link
                                                                v-if="departmentManagerStaffHref(item)"
                                                                :href="departmentManagerStaffHref(item)!"
                                                                class="hover:text-primary hover:underline"
                                                                @click.stop
                                                            >
                                                                {{ departmentManagerDisplayName(item.manager, item.managerUserId) }}
                                                            </Link>
                                                            <span v-else>
                                                                {{ departmentManagerDisplayName(item.manager, item.managerUserId) }}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" class="space-y-0.5">
                                                            <p class="text-sm font-medium">{{ departmentManagerDisplayName(item.manager, item.managerUserId) }}</p>
                                                            <p v-if="item.manager?.email" class="text-xs text-muted-foreground">{{ item.manager.email }}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </p>
                                        </template>
                                        <template #badges>
                                            <Badge :variant="statusVariant(item.status)">
                                                {{ item.status || 'unknown' }}
                                            </Badge>
                                            <Badge v-if="item.isPatientFacing" variant="secondary">
                                                Patient-facing
                                            </Badge>
                                            <Badge v-if="item.isAppointmentable" variant="outline">
                                                Appointmentable
                                            </Badge>
                                        </template>
                                        <template #actions>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                class="h-8 rounded-lg text-xs"
                                                @click="openDepartmentDetails(item)"
                                            >
                                                Details
                                            </Button>
                                            <Button
                                                v-if="canUpdate"
                                                size="sm"
                                                variant="secondary"
                                                class="hidden h-8 rounded-lg text-xs sm:inline-flex"
                                                @click="openEdit(item)"
                                            >
                                                Edit
                                            </Button>
                                        </template>
                                    </RegistryListRow>
                                </div>
                            </div>
                        </ScrollArea>
                        <footer class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                            <p class="text-xs text-muted-foreground">
                                <template v-if="pagination">
                                    Showing {{ items.length }} of
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
                                    v-for="page in paginationPageNumbers"
                                    :key="String(page)"
                                >
                                    <span
                                        v-if="page === '...'"
                                        class="px-1 text-xs text-muted-foreground"
                                    >…</span>
                                    <Button
                                        v-else
                                        :variant="page === pagination?.currentPage ? 'default' : 'ghost'"
                                        size="icon"
                                        class="size-8 text-xs"
                                        :disabled="listLoading"
                                        @click="goToPage(page as number)"
                                    >
                                        {{ page }}
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

                <!-- No read permission card -->
                <Card v-else class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                            Departments
                        </CardTitle>
                        <CardDescription>Department access is permission restricted.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle>Access restricted</AlertTitle>
                            <AlertDescription>Request <code>departments.read</code> permission.</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                <Sheet v-if="canRead" :open="departmentFiltersOpen" @update:open="departmentFiltersOpen = $event">
                    <SheetContent side="right" variant="form" size="md" class="flex h-full min-h-0 flex-col">
                        <SheetHeader>
                            <SheetTitle class="flex items-center gap-2">
                                <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                Department Filters
                            </SheetTitle>
                            <SheetDescription>Filter the department registry without crowding the operational list.</SheetDescription>
                        </SheetHeader>
                        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                            <div class="rounded-lg border p-3">
                                <div class="grid gap-3">
                                    <div class="grid gap-2">
                                        <Label for="dept-filter-q-sheet">Search</Label>
                                        <Input
                                            id="dept-filter-q-sheet"
                                            v-model="filters.q"
                                            placeholder="Department code, name, or note"
                                            @keyup.enter="applyFiltersFromSheet"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="dept-filter-status-sheet">Status</Label>
                                        <Select :model-value="toSelectValue(filters.status)" @update:model-value="filters.status = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                            <SelectTrigger id="dept-filter-status-sheet" class="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem :value="EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="inactive">Inactive</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <SearchableSelectField
                                        input-id="dept-filter-service-type-sheet"
                                        label="Category / service type"
                                        v-model="filters.serviceType"
                                        :options="serviceTypeOptions"
                                        placeholder="All categories"
                                        search-placeholder="Search department categories"
                                        empty-text="No matching category. Type a custom category."
                                        :allow-custom-value="true"
                                    />
                                    <SearchableSelectField
                                        input-id="dept-filter-manager-sheet"
                                        label="Manager"
                                        v-model="filters.managerUserId"
                                        :options="departmentManagerOptions"
                                        :disabled="managerOptionsLoading || !canReadStaff"
                                        :placeholder="managerOptionsLoading ? 'Loading active staff...' : 'Any manager'"
                                        search-placeholder="Search active staff managers"
                                        empty-text="No active staff manager matched."
                                        :helper-text="managerOptionsError || 'Search by staff name, employee number, role, email, or department.'"
                                    />
                                    <Separator />
                                    <div class="grid gap-2">
                                        <Label for="dept-filter-per-page-sheet">Results per page</Label>
                                        <Select :model-value="String(filters.perPage)" @update:model-value="filters.perPage = Number($event)">
                                            <SelectTrigger id="dept-filter-per-page-sheet" class="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="20">20</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                                <SelectItem value="100">100</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <SheetFooter class="gap-2 border-t px-4 py-3">
                            <Button :disabled="listLoading" class="gap-1.5" @click="applyFiltersFromSheet">
                                <AppIcon name="search" class="size-3.5" />
                                Apply Filters
                            </Button>
                            <Button variant="outline" :disabled="listLoading && departmentFilterCount === 0" @click="resetFiltersFromSheet">
                                Reset Filters
                            </Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>

                <Sheet :open="detailsOpen" @update:open="(open) => (open ? (detailsOpen = true) : closeDepartmentDetails())">
                    <SheetContent
                        side="right"
                        variant="workspace"
                        size="5xl"
                        class="flex h-full min-h-0 flex-col"
                    >
                        <SheetHeader
                            v-if="detailsDepartment"
                            class="shrink-0 border-b bg-background/95 px-4 py-3 pr-12 text-left sm:px-5"
                        >
                            <SheetTitle class="flex min-w-0 flex-wrap items-center gap-2 text-base">
                                <AppIcon name="building-2" class="size-5 text-muted-foreground" />
                                <span class="min-w-0 truncate">
                                    {{ detailsDepartment.name || labelOf(detailsDepartment) }}
                                </span>
                                <Badge
                                    v-if="detailsDepartment.code"
                                    variant="outline"
                                    class="shrink-0 font-normal"
                                >
                                    {{ detailsDepartment.code }}
                                </Badge>
                                <Badge
                                    :variant="statusVariant(detailsDepartment.status)"
                                    class="shrink-0 capitalize"
                                >
                                    {{ detailsDepartment.status || 'unknown' }}
                                </Badge>
                            </SheetTitle>
                            <SheetDescription class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                <span class="flex items-center gap-1">
                                    <AppIcon name="layout-list" class="size-3 opacity-50" />
                                    <span>{{ detailsDepartment.serviceType || 'Uncategorized' }}</span>
                                </span>
                                <span class="text-muted-foreground/40">&middot;</span>
                                <span class="flex items-center gap-1">
                                    <AppIcon name="users" class="size-3 opacity-50" />
                                    <span>{{ departmentExposureLabel(detailsDepartment) }}</span>
                                </span>
                                <span class="text-muted-foreground/40">&middot;</span>
                                <span class="flex items-center gap-1">
                                    <AppIcon name="user" class="size-3 opacity-50" />
                                    <span>
                                        {{ departmentManagerDisplayName(detailsDepartment.manager, detailsDepartment.managerUserId) }}
                                    </span>
                                </span>
                            </SheetDescription>
                        </SheetHeader>

                        <div
                            v-if="detailsDepartment"
                            class="flex min-h-0 flex-1 flex-col overflow-hidden"
                        >
                            <Tabs
                                v-model="detailsSheetTab"
                                class="flex h-full min-h-0 flex-col"
                            >
                                <div class="shrink-0 border-b bg-background px-4 py-2 sm:px-5">
                                    <div class="space-y-2.5">
                                        <div
                                            class="grid gap-y-2 rounded-md bg-muted/20 px-3 py-2 text-xs sm:grid-cols-3 sm:divide-x sm:divide-border/50"
                                        >
                                            <div class="min-w-0 sm:pr-3">
                                                <p class="font-medium tracking-[0.14em] text-muted-foreground uppercase">
                                                    Manager
                                                </p>
                                                <p class="mt-1 truncate text-sm font-medium text-foreground">
                                                    {{ departmentManagerDisplayName(detailsDepartment.manager, detailsDepartment.managerUserId) }}
                                                </p>
                                                <p class="truncate text-muted-foreground">
                                                    {{ detailsDepartment.manager?.email || 'No manager email recorded' }}
                                                </p>
                                            </div>
                                            <div class="min-w-0 sm:px-3">
                                                <p class="font-medium tracking-[0.14em] text-muted-foreground uppercase">
                                                    Workflow
                                                </p>
                                                <p class="mt-1 truncate text-sm font-medium text-foreground">
                                                    {{ departmentExposureLabel(detailsDepartment) }}
                                                </p>
                                                <p class="truncate text-muted-foreground">
                                                    {{ detailsDepartment.isAppointmentable ? 'Selectable in Appointments' : 'Hidden from Appointments' }}
                                                </p>
                                            </div>
                                            <div class="min-w-0 sm:pl-3">
                                                <p class="font-medium tracking-[0.14em] text-muted-foreground uppercase">
                                                    Staff coverage
                                                </p>
                                                <p class="mt-1 truncate text-sm font-medium text-foreground">
                                                    {{ canReadStaff ? `${detailsStaffTotal} assigned profiles` : 'Staff access unavailable' }}
                                                </p>
                                                <p class="truncate text-muted-foreground">
                                                    {{ canAudit ? `${auditMeta?.total ?? auditLogs.length} audit events` : 'Audit access unavailable' }}
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
                                                    v-if="canReadStaff"
                                                    value="staff"
                                                    class="h-9 min-w-0 gap-1.5 rounded-md px-2 text-xs sm:px-3 sm:text-sm"
                                                >
                                                    <AppIcon name="users" class="size-3.5" />
                                                    Staff
                                                    <Badge
                                                        v-if="detailsStaffTotal > 0"
                                                        variant="secondary"
                                                        class="h-4 min-w-4 px-1 text-xs"
                                                    >
                                                        {{ detailsStaffTotal }}
                                                    </Badge>
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    v-if="canAudit"
                                                    value="audit"
                                                    class="h-9 min-w-0 gap-1.5 rounded-md px-2 text-xs sm:px-3 sm:text-sm"
                                                >
                                                    <AppIcon name="file-text" class="size-3.5" />
                                                    Audit
                                                    <Badge
                                                        v-if="auditMeta"
                                                        variant="secondary"
                                                        class="h-4 min-w-4 px-1 text-xs"
                                                    >
                                                        {{ auditMeta.total }}
                                                    </Badge>
                                                </TabsTrigger>
                                            </TabsList>
                                        </div>
                                    </div>
                                </div>

                                <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                                    <TabsContent value="overview" class="m-0 space-y-3 px-4 py-3 sm:px-5">
                                        <div
                                            v-if="
                                                detailsDepartment.status &&
                                                detailsDepartment.status.toLowerCase() !== 'active' &&
                                                detailsDepartment.statusReason
                                            "
                                            class="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs"
                                        >
                                            <AppIcon
                                                name="alert-triangle"
                                                class="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                                            />
                                            <span class="text-amber-700 dark:text-amber-300">
                                                <span class="font-semibold capitalize">{{ detailsDepartment.status }}</span>:
                                                {{ detailsDepartment.statusReason }}
                                            </span>
                                        </div>

                                        <div class="grid gap-3 sm:grid-cols-2">
                                            <Card class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none">
                                                <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                    <CardTitle class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                        <AppIcon name="building-2" class="size-3.5" />
                                                        Identity
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent class="divide-y divide-border/50 px-3 py-1.5 text-sm">
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Code</span>
                                                        <span class="font-medium">{{ detailsDepartment.code || 'Not recorded' }}</span>
                                                    </div>
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Name</span>
                                                        <span class="max-w-[14rem] truncate text-right font-medium">{{ detailsDepartment.name || 'Not recorded' }}</span>
                                                    </div>
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Service type</span>
                                                        <span class="max-w-[14rem] truncate text-right font-medium">{{ detailsDepartment.serviceType || 'Uncategorized' }}</span>
                                                    </div>
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Status</span>
                                                        <Badge :variant="statusVariant(detailsDepartment.status)" class="capitalize">
                                                            {{ detailsDepartment.status || 'unknown' }}
                                                        </Badge>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none">
                                                <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                    <CardTitle class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                        <AppIcon name="calendar-plus-2" class="size-3.5" />
                                                        Workflow exposure
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent class="divide-y divide-border/50 px-3 py-1.5 text-sm">
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Patient access</span>
                                                        <span class="font-medium">
                                                            {{ detailsDepartment.isPatientFacing ? 'Patient-facing' : 'Internal only' }}
                                                        </span>
                                                    </div>
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Appointments</span>
                                                        <span class="font-medium">
                                                            {{ detailsDepartment.isAppointmentable ? 'Available in Appointments' : 'Hidden from Appointments' }}
                                                        </span>
                                                    </div>
                                                    <div class="flex items-center justify-between gap-4 py-2">
                                                        <span class="shrink-0 text-muted-foreground">Manager</span>
                                                        <div class="min-w-0 text-right">
                                                            <Link
                                                                v-if="departmentManagerStaffHref(detailsDepartment)"
                                                                :href="departmentManagerStaffHref(detailsDepartment)!"
                                                                class="font-medium hover:text-primary hover:underline"
                                                            >
                                                                {{ departmentManagerDisplayName(detailsDepartment.manager, detailsDepartment.managerUserId) }}
                                                            </Link>
                                                            <span v-else class="font-medium">
                                                                {{ departmentManagerDisplayName(detailsDepartment.manager, detailsDepartment.managerUserId) }}
                                                            </span>
                                                            <p v-if="detailsDepartment.manager?.email" class="truncate text-xs text-muted-foreground">
                                                                {{ detailsDepartment.manager.email }}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        <Card class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none">
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <CardTitle class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                    <AppIcon name="file-text" class="size-3.5" />
                                                    Operating notes
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="px-3 py-3 text-sm">
                                                <p class="text-muted-foreground">
                                                    {{ detailsDepartment.description || 'No description recorded for this department.' }}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent
                                        v-if="canReadStaff"
                                        value="staff"
                                        class="m-0 space-y-3 px-4 py-3 sm:px-5"
                                    >
                                        <Alert v-if="detailsStaffError" variant="destructive">
                                            <AlertTitle>Staff load issue</AlertTitle>
                                            <AlertDescription>{{ detailsStaffError }}</AlertDescription>
                                        </Alert>
                                        <div v-else-if="detailsStaffLoading" class="space-y-2">
                                            <Skeleton class="h-14 w-full" />
                                            <Skeleton class="h-14 w-full" />
                                            <Skeleton class="h-14 w-full" />
                                        </div>
                                        <div
                                            v-else-if="detailsStaff.length === 0"
                                            class="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground"
                                        >
                                            No staff profiles are currently assigned to this department.
                                        </div>
                                        <Card
                                            v-else
                                            class="!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none"
                                        >
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <CardTitle class="text-sm font-medium">Assigned staff</CardTitle>
                                                <CardDescription class="text-xs">
                                                    {{ detailsStaffTotal }} staff profiles mapped to this department.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent class="divide-y divide-border/50 px-0 py-0">
                                                <div
                                                    v-for="profile in detailsStaff"
                                                    :key="profile.id"
                                                    class="flex items-center gap-3 px-3 py-3"
                                                >
                                                    <Avatar class="h-9 w-9 border border-border/70">
                                                        <AvatarFallback class="bg-primary/10 text-xs font-semibold text-primary">
                                                            {{ staffProfileInitials(profile) }}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div class="min-w-0 flex-1">
                                                        <Link
                                                            v-if="staffProfileHref(profile)"
                                                            :href="staffProfileHref(profile)!"
                                                            class="truncate text-sm font-medium hover:text-primary hover:underline"
                                                        >
                                                            {{ staffProfileDisplayName(profile) }}
                                                        </Link>
                                                        <p v-else class="truncate text-sm font-medium">
                                                            {{ staffProfileDisplayName(profile) }}
                                                        </p>
                                                        <p class="truncate text-xs text-muted-foreground">
                                                            {{ profile.employeeNumber || 'No employee number' }}
                                                            <span class="text-border"> · </span>
                                                            {{ profile.jobTitle || 'No job title' }}
                                                        </p>
                                                    </div>
                                                    <Badge :variant="statusVariant(profile.status)" class="capitalize">
                                                        {{ profile.status || 'unknown' }}
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent
                                        v-if="canAudit"
                                        value="audit"
                                        class="m-0 space-y-3 px-4 py-3 sm:px-5"
                                    >
                                        <Alert v-if="auditError" variant="destructive">
                                            <AlertTitle>Audit load issue</AlertTitle>
                                            <AlertDescription>{{ auditError }}</AlertDescription>
                                        </Alert>
                                        <div v-else-if="auditLoading" class="space-y-2">
                                            <Skeleton class="h-14 w-full" />
                                            <Skeleton class="h-14 w-full" />
                                            <Skeleton class="h-14 w-full" />
                                        </div>
                                        <AuditTimelineList
                                            v-else
                                            :logs="auditLogs"
                                            :format-date-time="formatDateTime"
                                            empty-message="No audit logs found for this department."
                                            actor-fallback-label="User"
                                            :metadata-preview-limit="4"
                                        />
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
                                @click="closeDepartmentDetails"
                            >
                                <AppIcon name="circle-x" class="size-3.5" />
                                Close
                            </Button>
                            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                                <Button
                                    v-if="canUpdateStatus && detailsDepartment"
                                    size="sm"
                                    :variant="(detailsDepartment.status ?? '').toLowerCase() === 'active' ? 'outline' : 'secondary'"
                                    class="gap-1.5"
                                    @click="openStatus(detailsDepartment, (detailsDepartment.status ?? '').toLowerCase() === 'active' ? 'inactive' : 'active')"
                                >
                                    <AppIcon
                                        :name="(detailsDepartment.status ?? '').toLowerCase() === 'active' ? 'ban' : 'circle-check'"
                                        class="size-3.5"
                                    />
                                    {{ (detailsDepartment.status ?? '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate' }}
                                </Button>
                                <Button
                                    v-if="canUpdate && detailsDepartment"
                                    size="sm"
                                    variant="outline"
                                    class="gap-1.5"
                                    @click="openEdit(detailsDepartment)"
                                >
                                    <AppIcon name="pencil" class="size-3.5" />
                                    Edit department
                                </Button>
                                <Button
                                    v-if="detailsDepartment && departmentManagerStaffHref(detailsDepartment)"
                                    size="sm"
                                    as-child
                                    class="gap-1.5"
                                >
                                    <Link :href="departmentManagerStaffHref(detailsDepartment)!">
                                        <AppIcon name="user" class="size-3.5" />
                                        Open manager profile
                                    </Link>
                                </Button>
                            </div>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>

            <!-- Create Department sheet -->
            <Sheet :open="createOpen" @update:open="closeCreateSheet">
                <SheetContent side="right" variant="form" size="3xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="building-2" class="size-5 text-muted-foreground" />
                            Create Department
                        </SheetTitle>
                        <SheetDescription>Define the operational unit once, then use it across staff, service points, appointments, billing, and inventory workflows.</SheetDescription>
                    </SheetHeader>
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="grid gap-4 px-6 py-4">
                            <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Department identity</legend>
                                <div class="grid gap-2">
                                    <Label for="create-code">Code</Label>
                                    <Input
                                        id="create-code"
                                        v-model="createForm.code"
                                        :disabled="createLoading"
                                        placeholder="OPD, LAB, PHARM"
                                        :class="{ 'border-destructive': fieldError(createFormErrors, 'code') }"
                                    />
                                    <p v-if="fieldError(createFormErrors, 'code')" class="text-xs text-destructive">{{ fieldError(createFormErrors, 'code') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="create-name">Name</Label>
                                    <Input
                                        id="create-name"
                                        v-model="createForm.name"
                                        :disabled="createLoading"
                                        placeholder="Outpatient Department"
                                        :class="{ 'border-destructive': fieldError(createFormErrors, 'name') }"
                                    />
                                    <p v-if="fieldError(createFormErrors, 'name')" class="text-xs text-destructive">{{ fieldError(createFormErrors, 'name') }}</p>
                                </div>
                                <div class="sm:col-span-2">
                                    <SearchableSelectField
                                        input-id="create-service-type"
                                        label="Category / service type"
                                        v-model="createForm.serviceType"
                                        :options="serviceTypeOptions"
                                        placeholder="Select or type category"
                                        search-placeholder="Clinical, diagnostic, pharmacy, revenue cycle..."
                                        empty-text="No matching category. Type a custom category."
                                        helper-text="This groups the department in setup, reporting, staff, and patient-flow selectors."
                                        :allow-custom-value="true"
                                        :disabled="createLoading"
                                        :error-message="fieldError(createFormErrors, 'serviceType')"
                                    />
                                </div>
                            </fieldset>

                            <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Workflow exposure</legend>
                                <label class="flex h-full items-start gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
                                    <Checkbox :model-value="createForm.isPatientFacing" class="mt-0.5" :disabled="createLoading" @update:model-value="setCreatePatientFacing($event === true)" />
                                    <span class="space-y-1">
                                        <span class="block text-sm font-medium">Patient-facing department</span>
                                        <span class="block text-xs text-muted-foreground">Enable for services patients interact with directly, such as OPD, diagnostics, pharmacy, records, or billing counselling.</span>
                                    </span>
                                </label>
                                <label class="flex h-full items-start gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
                                    <Checkbox :model-value="createForm.isAppointmentable" class="mt-0.5" :disabled="createLoading" @update:model-value="setCreateAppointmentable($event === true)" />
                                    <span class="space-y-1">
                                        <span class="block text-sm font-medium">Available in Appointments</span>
                                        <span class="block text-xs text-muted-foreground">Use only for patient-facing destinations that should be selectable when scheduling a visit.</span>
                                    </span>
                                </label>
                                <Alert class="sm:col-span-2">
                                    <AlertTitle>Operational rule</AlertTitle>
                                    <AlertDescription>Appointmentable departments are automatically kept patient-facing so scheduling, visit flow, and reports stay consistent.</AlertDescription>
                                </Alert>
                            </fieldset>

                            <fieldset class="grid gap-3 rounded-lg border p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Ownership and notes</legend>
                                <SearchableSelectField
                                    input-id="create-manager"
                                    label="Department manager"
                                    v-model="createForm.managerUserId"
                                    :options="departmentManagerOptions"
                                    :disabled="createLoading || managerOptionsLoading || !canReadStaff"
                                    :placeholder="managerOptionsLoading ? 'Loading active staff...' : 'Search active staff'"
                                    search-placeholder="Search staff name, employee number, role, email, or department"
                                    empty-text="No active staff manager matched."
                                    :helper-text="managerOptionsError || 'Optional, but recommended before assigning service points and staff teams.'"
                                    :error-message="fieldError(createFormErrors, 'managerUserId')"
                                />
                                <div class="grid gap-2">
                                    <Label for="create-description">Operating note</Label>
                                    <Textarea
                                        id="create-description"
                                        v-model="createForm.description"
                                        class="min-h-24"
                                        :disabled="createLoading"
                                        placeholder="Purpose, coverage, handoff notes, or scope boundaries for this department."
                                        :class="{ 'border-destructive': fieldError(createFormErrors, 'description') }"
                                    />
                                    <p v-if="fieldError(createFormErrors, 'description')" class="text-xs text-destructive">{{ fieldError(createFormErrors, 'description') }}</p>
                                </div>
                            </fieldset>
                        </div>
                    </ScrollArea>
                    <Alert v-if="createRequestError || createValidationMessages.length" variant="destructive" class="mx-4 mb-3 shrink-0">
                        <AlertTitle>Create department needs attention</AlertTitle>
                        <AlertDescription class="space-y-2">
                            <p v-if="createRequestError">{{ createRequestError }}</p>
                            <ul v-if="createValidationMessages.length" class="list-disc space-y-1 pl-4">
                                <li v-for="message in createValidationMessages" :key="message" class="text-xs leading-5">{{ message }}</li>
                            </ul>
                        </AlertDescription>
                    </Alert>
                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <Button type="button" variant="outline" :disabled="createLoading" @click="closeCreateSheet(false)">Cancel</Button>
                        <Button type="button" :disabled="createLoading" class="gap-1.5" @click="createItem">
                            <AppIcon name="plus" class="size-3.5" />
                            {{ createLoading ? 'Creating...' : 'Create Department' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Edit Department sheet -->
            <Sheet :open="editOpen" @update:open="closeEditSheet">
                <SheetContent side="right" variant="form" size="3xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="pencil" class="size-5 text-muted-foreground" />
                            Edit Department
                        </SheetTitle>
                        <SheetDescription>{{ editTarget ? labelOf(editTarget) : 'Update department metadata and workflow exposure.' }}</SheetDescription>
                    </SheetHeader>
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="grid gap-4 px-6 py-4">
                            <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Department identity</legend>
                                <div class="grid gap-2">
                                    <Label for="edit-code">Code</Label>
                                    <Input
                                        id="edit-code"
                                        v-model="editForm.code"
                                        :disabled="editLoading"
                                        :class="{ 'border-destructive': fieldError(editFormErrors, 'code') }"
                                    />
                                    <p v-if="fieldError(editFormErrors, 'code')" class="text-xs text-destructive">{{ fieldError(editFormErrors, 'code') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="edit-name">Name</Label>
                                    <Input
                                        id="edit-name"
                                        v-model="editForm.name"
                                        :disabled="editLoading"
                                        :class="{ 'border-destructive': fieldError(editFormErrors, 'name') }"
                                    />
                                    <p v-if="fieldError(editFormErrors, 'name')" class="text-xs text-destructive">{{ fieldError(editFormErrors, 'name') }}</p>
                                </div>
                                <div class="sm:col-span-2">
                                    <SearchableSelectField
                                        input-id="edit-service-type"
                                        label="Category / service type"
                                        v-model="editForm.serviceType"
                                        :options="serviceTypeOptions"
                                        placeholder="Select or type category"
                                        search-placeholder="Clinical, diagnostic, pharmacy, revenue cycle..."
                                        empty-text="No matching category. Type a custom category."
                                        helper-text="Changing this affects grouping in setup, reporting, staff, and patient-flow selectors."
                                        :allow-custom-value="true"
                                        :disabled="editLoading"
                                        :error-message="fieldError(editFormErrors, 'serviceType')"
                                    />
                                </div>
                            </fieldset>

                            <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Workflow exposure</legend>
                                <label class="flex h-full items-start gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
                                    <Checkbox :model-value="editForm.isPatientFacing" class="mt-0.5" :disabled="editLoading" @update:model-value="setEditPatientFacing($event === true)" />
                                    <span class="space-y-1">
                                        <span class="block text-sm font-medium">Patient-facing department</span>
                                        <span class="block text-xs text-muted-foreground">Turn this off for internal units such as HR, ICT, stores, maintenance, or finance back office.</span>
                                    </span>
                                </label>
                                <label class="flex h-full items-start gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
                                    <Checkbox :model-value="editForm.isAppointmentable" class="mt-0.5" :disabled="editLoading" @update:model-value="setEditAppointmentable($event === true)" />
                                    <span class="space-y-1">
                                        <span class="block text-sm font-medium">Available in Appointments</span>
                                        <span class="block text-xs text-muted-foreground">Only patient-facing destinations that are scheduled should be visible to appointment clerks.</span>
                                    </span>
                                </label>
                            </fieldset>

                            <fieldset class="grid gap-3 rounded-lg border p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Ownership and notes</legend>
                                <SearchableSelectField
                                    input-id="edit-manager"
                                    label="Department manager"
                                    v-model="editForm.managerUserId"
                                    :options="departmentManagerOptions"
                                    :disabled="editLoading || managerOptionsLoading || !canReadStaff"
                                    :placeholder="managerOptionsLoading ? 'Loading active staff...' : 'Search active staff'"
                                    search-placeholder="Search staff name, employee number, role, email, or department"
                                    empty-text="No active staff manager matched."
                                    :helper-text="managerOptionsError || 'Optional, but recommended for accountability and approval workflows.'"
                                    :error-message="fieldError(editFormErrors, 'managerUserId')"
                                />
                                <div class="grid gap-2">
                                    <Label for="edit-description">Operating note</Label>
                                    <Textarea
                                        id="edit-description"
                                        v-model="editForm.description"
                                        class="min-h-24"
                                        :disabled="editLoading"
                                        placeholder="Purpose, coverage, handoff notes, or scope boundaries for this department."
                                        :class="{ 'border-destructive': fieldError(editFormErrors, 'description') }"
                                    />
                                    <p v-if="fieldError(editFormErrors, 'description')" class="text-xs text-destructive">{{ fieldError(editFormErrors, 'description') }}</p>
                                </div>
                            </fieldset>
                        </div>
                    </ScrollArea>
                    <Alert v-if="editRequestError || editValidationMessages.length" variant="destructive" class="mx-4 mb-3 shrink-0">
                        <AlertTitle>Save department needs attention</AlertTitle>
                        <AlertDescription class="space-y-2">
                            <p v-if="editRequestError">{{ editRequestError }}</p>
                            <ul v-if="editValidationMessages.length" class="list-disc space-y-1 pl-4">
                                <li v-for="message in editValidationMessages" :key="message" class="text-xs leading-5">{{ message }}</li>
                            </ul>
                        </AlertDescription>
                    </Alert>
                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <Button type="button" variant="outline" :disabled="editLoading" @click="closeEditSheet(false)">Cancel</Button>
                        <Button type="button" :disabled="editLoading" class="gap-1.5" @click="saveEdit">
                            <AppIcon name="save" class="size-3.5" />
                            {{ editLoading ? 'Saving...' : 'Save Changes' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Status update dialog -->
            <Dialog :open="statusOpen" @update:open="(open) => (statusOpen = open)">
                <DialogContent variant="action" size="lg">
                    <DialogHeader>
                        <DialogTitle>{{ statusTarget === 'inactive' ? 'Deactivate Department' : 'Activate Department' }}</DialogTitle>
                        <DialogDescription>{{ statusTarget === 'inactive' ? 'Reason is required before deactivating.' : 'Confirm activation of this department.' }}</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <Alert v-if="statusError" variant="destructive">
                            <AlertTitle>Status update failed</AlertTitle>
                            <AlertDescription>{{ statusError }}</AlertDescription>
                        </Alert>
                        <div v-if="statusTarget === 'inactive'" class="grid gap-2">
                            <Label for="status-reason">Reason</Label>
                            <Textarea id="status-reason" v-model="statusReason" class="min-h-20" placeholder="Required reason for deactivation" />
                        </div>
                    </div>
                    <DialogFooter class="gap-2">
                        <Button variant="outline" :disabled="statusLoading" @click="statusOpen = false">Cancel</Button>
                        <Button :disabled="statusLoading" @click="saveStatus">
                            {{ statusLoading ? 'Saving...' : 'Confirm' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        </div>
    </AppLayout>
</template>












