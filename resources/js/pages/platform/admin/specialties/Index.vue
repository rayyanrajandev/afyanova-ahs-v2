<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type Pagination = {
    currentPage: number;
    perPage: number;
    total: number;
    lastPage: number;
};

type ClinicalSpecialty = {
    id: string | null;
    code: string | null;
    name: string | null;
    description: string | null;
    status: string | null;
    statusReason: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type SpecialtyAuditLog = {
    id: string;
    actorId: number | null;
    actor?: { displayName?: string | null } | null;
    action: string | null;
    actionLabel?: string | null;
    createdAt: string | null;
};

type StaffSpecialtyAssignment = {
    specialtyId: string | null;
    isPrimary: boolean;
    specialty: {
        id: string | null;
        code: string | null;
        name: string | null;
    } | null;
};

type ValidationErrorResponse = {
    message?: string;
    errors?: Record<string, string[]>;
};

type SpecialtyListResponse = { data: ClinicalSpecialty[]; meta: Pagination };
type SpecialtyResponse = { data: ClinicalSpecialty };
type SpecialtyAuditResponse = { data: SpecialtyAuditLog[]; meta: Pagination };
type StaffAssignmentResponse = { data: StaffSpecialtyAssignment[] };
type AssignmentStaffProfile = {
    id: string;
    userName: string | null;
    userEmail?: string | null;
    userEmailVerifiedAt?: string | null;
    employeeNumber: string | null;
    department: string | null;
    jobTitle: string | null;
    status: string | null;
};
type AssignmentStaffListResponse = { data: AssignmentStaffProfile[]; meta: Pagination };
type SpecialtyAssignedStaffProfile = AssignmentStaffProfile & {
    isPrimary: boolean;
    assignedAt?: string | null;
    assignmentUpdatedAt?: string | null;
    employmentType?: string | null;
    statusReason?: string | null;
};
type SpecialtyAssignedStaffResponse = { data: SpecialtyAssignedStaffProfile[]; meta: Pagination };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Platform Admin', href: '/platform/admin/specialties' },
    { title: 'Clinical Specialties', href: '/platform/admin/specialties' },
];

const { permissionState } = usePlatformAccess();
const canRead = computed(() => permissionState('specialties.read') === 'allowed');
const canCreate = computed(() => permissionState('specialties.create') === 'allowed');
const canUpdate = computed(() => permissionState('specialties.update') === 'allowed');
const canUpdateStatus = computed(() => permissionState('specialties.update-status') === 'allowed');
const canViewAudit = computed(() => permissionState('specialties.view-audit-logs') === 'allowed');
const canReadStaffSpecialties = computed(() => permissionState('staff.specialties.read') === 'allowed');
const canManageStaffSpecialties = computed(() => permissionState('staff.specialties.manage') === 'allowed');
const canReadStaffDirectory = computed(() => permissionState('staff.read') === 'allowed');
const specialtyCatalogReadOnly = computed(
    () => canRead.value && !canCreate.value && !canUpdate.value && !canUpdateStatus.value,
);
const staffAssignmentReadOnly = computed(
    () => canReadStaffSpecialties.value && !canManageStaffSpecialties.value,
);

const loading = ref(true);
const listLoading = ref(false);
const queueReady = ref(false);
const errors = ref<string[]>([]);
const specialties = ref<ClinicalSpecialty[]>([]);
const pagination = ref<Pagination | null>(null);
const actionMessage = ref<string | null>(null);
const createDialogOpen = ref(false);
const assignmentDialogOpen = ref(false);
const selectedSpecialtyId = ref<string | null>(null);

const filters = reactive({
    q: '',
    status: '',
    page: 1,
    perPage: 20,
});
const specialtyFilterCount = computed(() => {
    let count = 0;
    if (filters.q.trim()) count += 1;
    if (filters.status) count += 1;
    if (filters.perPage !== 20) count += 1;
    return count;
});

const createLoading = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const createForm = reactive({
    code: '',
    name: '',
    description: '',
});

const editDialogOpen = ref(false);
const editLoading = ref(false);
const editErrors = ref<Record<string, string[]>>({});
const editSpecialty = ref<ClinicalSpecialty | null>(null);
const editForm = reactive({
    code: '',
    name: '',
    description: '',
});

const statusDialogOpen = ref(false);
const statusLoading = ref(false);
const statusError = ref<string | null>(null);
const statusSpecialty = ref<ClinicalSpecialty | null>(null);
const statusTarget = ref<'active' | 'inactive'>('active');
const statusReason = ref('');

const auditSpecialty = ref<ClinicalSpecialty | null>(null);
const auditLoading = ref(false);
const auditError = ref<string | null>(null);
const auditLogs = ref<SpecialtyAuditLog[]>([]);
const assignedStaffLoading = ref(false);
const assignedStaffError = ref<string | null>(null);
const assignedStaff = ref<SpecialtyAssignedStaffProfile[]>([]);
const assignedStaffMeta = ref<Pagination | null>(null);
const assignedStaffPage = ref(1);

const assignmentCatalogLoading = ref(false);
const assignmentCatalog = ref<ClinicalSpecialty[]>([]);
const assignmentCatalogError = ref<string | null>(null);
const assignmentStaffQuery = ref('');
const assignmentStaffLoading = ref(false);
const assignmentStaffReady = ref(false);
const assignmentStaffError = ref<string | null>(null);
const assignmentStaffResults = ref<AssignmentStaffProfile[]>([]);
const assignmentSelectedStaff = ref<AssignmentStaffProfile | null>(null);
const staffProfileId = ref('');
const assignmentLoading = ref(false);
const assignmentError = ref<string | null>(null);
const assignmentRows = ref<StaffSpecialtyAssignment[]>([]);
const assignmentSelectedIds = ref<string[]>([]);
const assignmentPrimaryId = ref('');
const assignmentSaving = ref(false);

const visibleStatusCounts = computed(() => {
    const counts = { active: 0, inactive: 0, other: 0 };
    for (const s of specialties.value) {
        const status = (s.status ?? '').toLowerCase();
        if (status === 'active') counts.active++;
        else if (status === 'inactive') counts.inactive++;
        else counts.other++;
    }
    return counts;
});
const specialtyListSummaryText = computed(() => {
    const segments = [`${visibleStatusCounts.value.active} active`, `${visibleStatusCounts.value.inactive} inactive`];

    if (visibleStatusCounts.value.other > 0) {
        segments.push(`${visibleStatusCounts.value.other} other`);
    }

    if (specialtyFilterCount.value > 0) {
        segments.push(`${specialtyFilterCount.value} filters applied`);
    }

    return segments.join(' | ');
});

function csrfToken(): string | null {
    const element = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    return element?.content ?? null;
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

function specialtyLabel(specialty: ClinicalSpecialty | null): string {
    if (!specialty) return 'Unknown specialty';
    if (specialty.code && specialty.name) return `${specialty.code} - ${specialty.name}`;
    return specialty.name || specialty.code || specialty.id || 'Unknown specialty';
}

function specialtyKey(specialty: ClinicalSpecialty | null): string | null {
    if (!specialty) return null;
    return specialty.id?.trim() || specialty.code?.trim() || specialty.name?.trim() || null;
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive') return 'destructive';
    return 'outline';
}

function staffStatusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive') return 'destructive';
    return 'outline';
}

function staffVerificationVariant(profile: AssignmentStaffProfile | null): 'outline' | 'secondary' {
    return profile?.userEmailVerifiedAt ? 'secondary' : 'outline';
}

function staffProfileLabel(profile: AssignmentStaffProfile | null): string {
    if (!profile) return 'No staff profile selected';

    const userName = (profile.userName ?? '').trim();
    if (userName) return userName;

    const employeeNumber = (profile.employeeNumber ?? '').trim();
    if (employeeNumber) return employeeNumber;

    return `Staff profile ${profile.id}`;
}

function staffProfileMeta(profile: AssignmentStaffProfile | null): string {
    if (!profile) return 'Search by staff name, email, employee number, title, or department.';

    const segments = [(profile.employeeNumber ?? '').trim(), (profile.jobTitle ?? '').trim(), (profile.department ?? '').trim()].filter(Boolean);
    return segments.length > 0 ? segments.join(' | ') : 'No job title or department recorded.';
}

function staffProfileContact(profile: AssignmentStaffProfile | null): string {
    const email = (profile?.userEmail ?? '').trim();
    return email || 'No linked user email recorded';
}

function staffProfileVerificationLabel(profile: AssignmentStaffProfile | null): string {
    return profile?.userEmailVerifiedAt ? 'Email verified' : 'Email unverified';
}

function staffProfileInitials(profile: AssignmentStaffProfile | null): string {
    const name = (profile?.userName ?? '').trim();
    if (name) {
        const parts = name.split(/\s+/).filter(Boolean);
        return parts
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('')
            .slice(0, 2);
    }

    const employeeNumber = (profile?.employeeNumber ?? '').replace(/[^A-Za-z0-9]/g, '');
    if (employeeNumber) {
        return employeeNumber.slice(0, 2).toUpperCase();
    }

    return 'SP';
}

function actorLabel(log: SpecialtyAuditLog): string {
    return log.actor?.displayName?.trim() || (log.actorId === null ? 'System' : `User #${log.actorId}`);
}

function auditLabel(log: SpecialtyAuditLog): string {
    return log.actionLabel?.trim() || log.action || 'event';
}

async function loadSpecialties() {
    if (!canRead.value) {
        specialties.value = [];
        pagination.value = null;
        listLoading.value = false;
        loading.value = false;
        queueReady.value = true;
        return;
    }

    listLoading.value = true;
    errors.value = [];
    try {
        const response = await apiRequest<SpecialtyListResponse>('GET', '/specialties', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status || null,
                page: filters.page,
                perPage: filters.perPage,
                sortBy: 'name',
                sortDir: 'asc',
            },
        });
        specialties.value = response.data ?? [];
        pagination.value = response.meta ?? null;
    } catch (error) {
        specialties.value = [];
        pagination.value = null;
        errors.value.push(messageFromUnknown(error, 'Unable to load specialties.'));
    } finally {
        listLoading.value = false;
        loading.value = false;
        queueReady.value = true;
    }
}

async function loadAssignmentCatalog() {
    if (!canRead.value) return;
    assignmentCatalogLoading.value = true;
    assignmentCatalogError.value = null;
    try {
        const response = await apiRequest<SpecialtyListResponse>('GET', '/specialties', {
            query: { status: 'active', page: 1, perPage: 100, sortBy: 'name', sortDir: 'asc' },
        });
        assignmentCatalog.value = response.data ?? [];
    } catch (error) {
        assignmentCatalog.value = [];
        assignmentCatalogError.value = messageFromUnknown(error, 'Unable to load assignment catalog.');
    } finally {
        assignmentCatalogLoading.value = false;
    }
}

async function loadAssignmentStaffProfiles() {
    if (!canReadStaffDirectory.value) {
        assignmentStaffResults.value = [];
        assignmentStaffError.value = 'staff.read permission is required to search staff profiles.';
        assignmentStaffReady.value = true;
        return;
    }

    assignmentStaffLoading.value = true;
    assignmentStaffError.value = null;
    try {
        const response = await apiRequest<AssignmentStaffListResponse>('GET', '/staff', {
            query: {
                q: assignmentStaffQuery.value.trim() || null,
                page: 1,
                perPage: 12,
            },
        });
        assignmentStaffResults.value = response.data ?? [];

        if (assignmentSelectedStaff.value) {
            const refreshedSelection = assignmentStaffResults.value.find((profile) => profile.id === assignmentSelectedStaff.value?.id);
            if (refreshedSelection) {
                assignmentSelectedStaff.value = refreshedSelection;
            }
        }
    } catch (error) {
        assignmentStaffResults.value = [];
        assignmentStaffError.value = messageFromUnknown(error, 'Unable to load staff profiles for assignment.');
    } finally {
        assignmentStaffLoading.value = false;
        assignmentStaffReady.value = true;
    }
}

async function refreshPage() {
    await Promise.all([loadSpecialties(), loadAssignmentCatalog()]);
}

async function createSpecialty() {
    if (!canCreate.value || createLoading.value) return;
    createLoading.value = true;
    createErrors.value = {};
    try {
        const response = await apiRequest<SpecialtyResponse>('POST', '/specialties', {
            body: {
                code: createForm.code.trim(),
                name: createForm.name.trim(),
                description: createForm.description.trim() || null,
            },
        });
        notifySuccess(`Created ${specialtyLabel(response.data)}.`);
        createForm.code = '';
        createForm.name = '';
        createForm.description = '';
        createDialogOpen.value = false;
        filters.page = 1;
        await refreshPage();
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
        } else {
            notifyError(messageFromUnknown(error, 'Unable to create specialty.'));
        }
    } finally {
        createLoading.value = false;
    }
}

function openEdit(specialty: ClinicalSpecialty) {
    editSpecialty.value = specialty;
    editForm.code = specialty.code || '';
    editForm.name = specialty.name || '';
    editForm.description = specialty.description || '';
    editErrors.value = {};
    editDialogOpen.value = true;
}

function closeEdit() {
    editDialogOpen.value = false;
    editSpecialty.value = null;
    editErrors.value = {};
}

async function saveEdit() {
    const specialtyId = editSpecialty.value?.id?.trim();
    if (!specialtyId || !canUpdate.value || editLoading.value) return;

    editLoading.value = true;
    editErrors.value = {};
    try {
        const response = await apiRequest<SpecialtyResponse>('PATCH', `/specialties/${specialtyId}`, {
            body: {
                code: editForm.code.trim(),
                name: editForm.name.trim(),
                description: editForm.description.trim() || null,
            },
        });
        notifySuccess(`Updated ${specialtyLabel(response.data)}.`);
        closeEdit();
        await refreshPage();
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            editErrors.value = apiError.payload.errors;
        } else {
            notifyError(messageFromUnknown(error, 'Unable to update specialty.'));
        }
    } finally {
        editLoading.value = false;
    }
}

function openStatusDialog(specialty: ClinicalSpecialty, target: 'active' | 'inactive') {
    statusSpecialty.value = specialty;
    statusTarget.value = target;
    statusReason.value = target === 'inactive' ? specialty.statusReason ?? '' : '';
    statusError.value = null;
    statusDialogOpen.value = true;
}

function closeStatusDialog() {
    statusDialogOpen.value = false;
    statusSpecialty.value = null;
    statusError.value = null;
    statusReason.value = '';
}

async function saveStatus() {
    const specialtyId = statusSpecialty.value?.id?.trim();
    if (!specialtyId || !canUpdateStatus.value || statusLoading.value) return;
    if (statusTarget.value === 'inactive' && !statusReason.value.trim()) {
        statusError.value = 'Reason is required for inactivation.';
        return;
    }
    statusLoading.value = true;
    statusError.value = null;
    try {
        const response = await apiRequest<SpecialtyResponse>('PATCH', `/specialties/${specialtyId}/status`, {
            body: {
                status: statusTarget.value,
                reason: statusTarget.value === 'inactive' ? statusReason.value.trim() : null,
            },
        });
        actionMessage.value = `Updated ${specialtyLabel(response.data)} to ${statusTarget.value}.`;
        notifySuccess(actionMessage.value);
        closeStatusDialog();
        await refreshPage();
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update specialty status.');
    } finally {
        statusLoading.value = false;
    }
}

async function loadAudit(specialty: ClinicalSpecialty) {
    const specialtyId = specialty.id?.trim();
    if (!specialtyId || !canViewAudit.value) return;
    auditSpecialty.value = specialty;
    auditLoading.value = true;
    auditError.value = null;
    try {
        const response = await apiRequest<SpecialtyAuditResponse>('GET', `/specialties/${specialtyId}/audit-logs`, {
            query: { page: 1, perPage: 20 },
        });
        auditLogs.value = response.data ?? [];
    } catch (error) {
        auditLogs.value = [];
        auditError.value = messageFromUnknown(error, 'Unable to load specialty audit logs.');
    } finally {
        auditLoading.value = false;
    }
}

function resetAssignedStaffPane() {
    assignedStaffLoading.value = false;
    assignedStaffError.value = null;
    assignedStaff.value = [];
    assignedStaffMeta.value = null;
    assignedStaffPage.value = 1;
}

async function loadAssignedStaff(specialty: ClinicalSpecialty, page = assignedStaffPage.value) {
    const specialtyId = specialty.id?.trim();
    if (!specialtyId) {
        assignedStaff.value = [];
        assignedStaffMeta.value = null;
        assignedStaffError.value = 'Specialty record is missing an identifier.';
        assignedStaffLoading.value = false;
        return;
    }
    if (!canReadStaffSpecialties.value) {
        assignedStaff.value = [];
        assignedStaffMeta.value = null;
        assignedStaffError.value = null;
        assignedStaffLoading.value = false;
        return;
    }

    assignedStaffLoading.value = true;
    assignedStaffError.value = null;
    try {
        const response = await apiRequest<SpecialtyAssignedStaffResponse>('GET', `/specialties/${specialtyId}/assigned-staff`, {
            query: { page, perPage: 10 },
        });
        assignedStaff.value = response.data ?? [];
        assignedStaffMeta.value = response.meta ?? null;
        assignedStaffPage.value = response.meta?.currentPage ?? page;
    } catch (error) {
        assignedStaff.value = [];
        assignedStaffMeta.value = null;
        assignedStaffError.value = messageFromUnknown(error, 'Unable to load assigned staff.');
    } finally {
        assignedStaffLoading.value = false;
    }
}

function prevAssignedStaffPage() {
    if (!selectedSpecialty.value || (assignedStaffMeta.value?.currentPage ?? 1) <= 1) return;
    const targetPage = Math.max((assignedStaffMeta.value?.currentPage ?? 1) - 1, 1);
    assignedStaffPage.value = targetPage;
    void loadAssignedStaff(selectedSpecialty.value, targetPage);
}

function nextAssignedStaffPage() {
    if (!selectedSpecialty.value || !assignedStaffMeta.value || assignedStaffMeta.value.currentPage >= assignedStaffMeta.value.lastPage) return;
    const targetPage = assignedStaffMeta.value.currentPage + 1;
    assignedStaffPage.value = targetPage;
    void loadAssignedStaff(selectedSpecialty.value, targetPage);
}

function selectSpecialty(specialty: ClinicalSpecialty) {
    selectedSpecialtyId.value = specialtyKey(specialty);
    assignedStaffPage.value = 1;
    if (canReadStaffSpecialties.value) {
        void loadAssignedStaff(specialty, 1);
    } else {
        resetAssignedStaffPane();
    }
    if (canViewAudit.value) {
        void loadAudit(specialty);
    } else {
        auditSpecialty.value = specialty;
        auditLogs.value = [];
        auditError.value = null;
    }
}

function syncAssignmentDraft(rows: StaffSpecialtyAssignment[]) {
    assignmentRows.value = rows;
    assignmentSelectedIds.value = rows
        .map((row) => String(row.specialtyId ?? '').trim())
        .filter(Boolean);
    assignmentPrimaryId.value = rows.find((row) => row.isPrimary)?.specialtyId?.toString() ?? '';
}

function clearAssignmentDraft() {
    assignmentRows.value = [];
    assignmentSelectedIds.value = [];
    assignmentPrimaryId.value = '';
}

async function loadStaffAssignments() {
    const profileId = staffProfileId.value.trim();
    assignmentError.value = null;
    if (!profileId) {
        assignmentError.value = 'Select a staff profile first.';
        return;
    }
    if (!canReadStaffSpecialties.value) {
        assignmentError.value = 'staff.specialties.read permission is required.';
        return;
    }

    assignmentLoading.value = true;
    try {
        const response = await apiRequest<StaffAssignmentResponse>('GET', `/staff/${profileId}/specialties`);
        syncAssignmentDraft(response.data ?? []);
    } catch (error) {
        assignmentError.value = messageFromUnknown(error, 'Unable to load staff assignments.');
        assignmentRows.value = [];
        assignmentSelectedIds.value = [];
        assignmentPrimaryId.value = '';
    } finally {
        assignmentLoading.value = false;
    }
}

function selectAssignmentStaff(profile: AssignmentStaffProfile) {
    assignmentSelectedStaff.value = profile;
    staffProfileId.value = profile.id;
    assignmentError.value = null;
    clearAssignmentDraft();
    void loadStaffAssignments();
}

function toggleAssignmentSpecialty(specialtyId: string, checked: boolean) {
    const set = new Set(assignmentSelectedIds.value);
    if (checked) set.add(specialtyId);
    else set.delete(specialtyId);
    assignmentSelectedIds.value = Array.from(set);
    if (!set.has(assignmentPrimaryId.value)) assignmentPrimaryId.value = '';
}

const assignmentPrimaryOptions = computed(() => {
    const selected = new Set(assignmentSelectedIds.value);
    return assignmentCatalog.value.filter((specialty) => selected.has(String(specialty.id ?? '')));
});

async function saveStaffAssignments() {
    const profileId = staffProfileId.value.trim();
    if (!profileId) {
        assignmentError.value = 'Select a staff profile first.';
        return;
    }
    if (!canManageStaffSpecialties.value) {
        assignmentError.value = 'staff.specialties.manage permission is required.';
        return;
    }

    assignmentSaving.value = true;
    assignmentError.value = null;
    try {
        const selectedIds = Array.from(new Set(assignmentSelectedIds.value.map((value) => value.trim()).filter(Boolean)));
        const response = await apiRequest<StaffAssignmentResponse>('PATCH', `/staff/${profileId}/specialties`, {
            body: {
                specialtyAssignments: selectedIds.map((specialtyId) => ({
                    specialtyId,
                    isPrimary: specialtyId === assignmentPrimaryId.value,
                })),
            },
        });
        syncAssignmentDraft(response.data ?? []);
        notifySuccess('Staff specialty assignments saved.');
    } catch (error) {
        assignmentError.value = messageFromUnknown(error, 'Unable to save staff assignments.');
    } finally {
        assignmentSaving.value = false;
    }
}

function search() {
    filters.page = 1;
    void loadSpecialties();
}

function clearSearch() {
    filters.q = '';
    filters.status = '';
    filters.page = 1;
    void loadSpecialties();
}

function prevPage() {
    if ((pagination.value?.currentPage ?? 1) <= 1) return;
    filters.page -= 1;
    void loadSpecialties();
}

function nextPage() {
    if (!pagination.value || pagination.value.currentPage >= pagination.value.lastPage) return;
    filters.page += 1;
    void loadSpecialties();
}

const selectedSpecialty = computed(() => {
    const key = selectedSpecialtyId.value;
    if (!key) return null;
    return specialties.value.find((specialty) => specialtyKey(specialty) === key) ?? null;
});

watch(
    specialties,
    (rows) => {
        if (rows.length === 0) {
            selectedSpecialtyId.value = null;
            auditSpecialty.value = null;
            auditLogs.value = [];
            auditError.value = null;
            resetAssignedStaffPane();
            return;
        }

        if (!selectedSpecialty.value) {
            selectSpecialty(rows[0]);
            return;
        }

        if (canReadStaffSpecialties.value) {
            assignedStaffPage.value = 1;
            void loadAssignedStaff(selectedSpecialty.value, 1);
        } else {
            resetAssignedStaffPane();
        }

        if (canViewAudit.value && specialtyKey(auditSpecialty.value) !== specialtyKey(selectedSpecialty.value)) {
            void loadAudit(selectedSpecialty.value);
        } else if (selectedSpecialty.value) {
            auditSpecialty.value = selectedSpecialty.value;
        }
    },
    { immediate: true },
);

watch(assignmentDialogOpen, (open) => {
    if (open) {
        assignmentError.value = null;
        assignmentStaffError.value = null;

        if (!assignmentCatalog.value.length && !assignmentCatalogLoading.value) {
            void loadAssignmentCatalog();
        }

        if (!assignmentStaffReady.value && !assignmentStaffLoading.value) {
            void loadAssignmentStaffProfiles();
        }
        return;
    }

    assignmentError.value = null;
    assignmentStaffError.value = null;
});

onMounted(refreshPage);
</script>

<template>
    <Head title="Clinical Specialties" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">

            <!-- Page header -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="activity" class="size-7 text-primary" />
                        Clinical Specialty Registry
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">Review specialty catalog records and supporting audit activity.</p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" :disabled="listLoading || assignmentCatalogLoading" class="gap-1.5" @click="refreshPage">
                        <AppIcon name="activity" class="size-3.5" />
                        {{ listLoading || assignmentCatalogLoading ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                    <Button v-if="canReadStaffSpecialties || canManageStaffSpecialties" variant="outline" size="sm" class="gap-1.5" @click="assignmentDialogOpen = true">
                        <AppIcon name="users" class="size-3.5" />
                        Staff assignments
                    </Button>
                    <Button v-if="canCreate" size="sm" class="gap-1.5" @click="createDialogOpen = true">
                        <AppIcon name="plus" class="size-3.5" />
                        Create specialty
                    </Button>
                </div>
            </div>

            <Alert v-if="specialtyCatalogReadOnly || staffAssignmentReadOnly" variant="default">
                <AlertTitle>Read-only access</AlertTitle>
                <AlertDescription>
                    This registry is available in read-only mode for your role. Create, update, status, or assignment changes remain hidden until the matching manage permissions are granted.
                </AlertDescription>
            </Alert>

            <Alert v-if="actionMessage">
                <AlertTitle>Recent action</AlertTitle>
                <AlertDescription>{{ actionMessage }}</AlertDescription>
            </Alert>

            <Alert v-if="errors.length" variant="destructive">
                <AlertTitle>Request error</AlertTitle>
                <AlertDescription>
                    <p v-for="errorMessage in errors" :key="errorMessage" class="text-xs">{{ errorMessage }}</p>
                </AlertDescription>
            </Alert>

            <div class="flex min-w-0 flex-col gap-4">
                <template v-if="canRead">
                    <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm">
                        <div class="flex flex-wrap items-center gap-2">
                            <Button size="sm" :variant="!filters.status ? 'default' : 'outline'" @click="filters.status = ''; search()">All</Button>
                            <Button size="sm" :variant="filters.status === 'active' ? 'default' : 'outline'" @click="filters.status = 'active'; search()">Active</Button>
                            <Button size="sm" :variant="filters.status === 'inactive' ? 'default' : 'outline'" @click="filters.status = 'inactive'; search()">Inactive</Button>
                        </div>
                        <div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>{{ pagination?.total ?? specialties.length }} specialties</span>
                            <span>{{ specialtyListSummaryText }}</span>
                            <Button v-if="specialtyFilterCount > 0" variant="ghost" size="sm" class="gap-1.5" @click="clearSearch">Reset</Button>
                        </div>
                    </div>

                    <div class="grid min-w-0 gap-4 xl:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)] xl:items-stretch">
                        <Card class="flex h-full min-h-0 flex-col rounded-lg border-sidebar-border/70">
                            <CardHeader class="gap-3 border-b pb-3">
                                <div class="flex flex-col gap-3">
                                    <div class="min-w-0 space-y-1">
                                        <CardTitle class="flex items-center gap-2 text-base">
                                            <AppIcon name="layout-list" class="size-4.5 text-muted-foreground" />
                                            Select specialty
                                        </CardTitle>
                                        <CardDescription>
                                            {{ specialties.length }} records on this page | Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                                        </CardDescription>
                                    </div>
                                    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <div class="relative min-w-0 flex-1">
                                            <AppIcon name="search" class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                v-model="filters.q"
                                                placeholder="Search code, name, or description"
                                                class="h-9 pl-9"
                                                @keyup.enter="search"
                                            />
                                        </div>
                                        <Popover>
                                            <PopoverTrigger as-child>
                                                <Button variant="outline" size="sm" class="gap-1.5">
                                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                    Queue options
                                                    <Badge v-if="specialtyFilterCount > 0" variant="secondary" class="ml-1 text-[10px]">{{ specialtyFilterCount }}</Badge>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent align="end" class="w-[16rem] rounded-lg p-0">
                                                <div class="space-y-3 border-b px-4 py-3">
                                                    <p class="flex items-center gap-2 text-sm font-medium">
                                                        <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                                        Queue options
                                                    </p>
                                                    <div class="grid gap-2">
                                                        <Label for="specialty-status-popover">Status</Label>
                                                        <Select v-model="filters.status">
                                                            <SelectTrigger class="w-full">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                            <SelectItem value="">All</SelectItem>
                                                            <SelectItem value="active">Active</SelectItem>
                                                            <SelectItem value="inactive">Inactive</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div class="grid gap-2">
                                                        <Label for="specialty-per-page-popover">Per page</Label>
                                                        <Select :model-value="String(filters.perPage)" @update:model-value="filters.perPage = Number($event)">
                                                            <SelectTrigger class="w-full">
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
                                                <div class="flex flex-wrap items-center justify-between gap-2 bg-muted/30 px-4 py-3">
                                                    <Button variant="outline" size="sm" @click="clearSearch">Reset</Button>
                                                    <Button size="sm" class="gap-1.5" :disabled="listLoading" @click="search">
                                                        <AppIcon name="search" class="size-3.5" />
                                                        Search
                                                    </Button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent class="flex flex-1 flex-col p-0">
                                <div v-if="!queueReady || specialties.length > 0" class="hidden border-b bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,0.85fr)_minmax(0,auto)] md:items-center md:gap-2.5">
                                    <span>Specialty</span>
                                    <span>Status</span>
                                    <span class="text-right">Actions</span>
                                </div>
                                <div v-if="!queueReady" class="divide-y">
                                    <div v-for="index in 6" :key="'specialty-skeleton-' + index" class="grid items-center gap-2.5 px-4 py-2 md:grid-cols-[minmax(0,2.2fr)_minmax(0,0.85fr)_minmax(0,auto)]">
                                        <div class="min-w-0">
                                            <Skeleton class="h-4 w-full max-w-[18rem]" />
                                        </div>
                                        <div class="hidden md:flex items-center gap-2">
                                            <Skeleton class="h-5 w-16 rounded-full" />
                                        </div>
                                        <div class="flex items-center justify-end gap-2">
                                            <Skeleton class="hidden h-8 w-16 rounded-md lg:block" />
                                            <Skeleton class="h-8 w-8 rounded-md lg:hidden" />
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground md:hidden">
                                            <Skeleton class="h-5 w-16 rounded-full" />
                                        </div>
                                    </div>
                                </div>
                                <div v-else-if="specialties.length === 0" class="px-4 py-6">
                                    <div class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                        No specialties found for the current queue options.
                                    </div>
                                </div>
                                <div v-else class="divide-y">
                                    <div
                                        v-for="specialty in specialties"
                                        :key="specialtyKey(specialty)"
                                        class="group grid items-center gap-2.5 border-l-2 px-4 py-2 transition-colors hover:bg-muted/30 md:grid-cols-[minmax(0,2.2fr)_minmax(0,0.85fr)_minmax(0,auto)]"
                                        :class="specialtyKey(selectedSpecialty) === specialtyKey(specialty) ? 'border-primary bg-primary/5' : 'border-transparent'"
                                    >
                                        <div class="min-w-0">
                                            <button class="truncate text-left text-sm font-medium hover:text-primary hover:underline" @click="selectSpecialty(specialty)">
                                                {{ specialtyLabel(specialty) }}
                                            </button>
                                        </div>
                                        <div class="hidden items-center gap-2 md:flex">
                                            <Badge :variant="statusVariant(specialty.status)" class="text-[10px] leading-none">{{ specialty.status || 'unknown' }}</Badge>
                                        </div>
                                        <div class="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="sm" class="hidden lg:inline-flex" @click="selectSpecialty(specialty)">
                                                <AppIcon name="eye" class="size-3.5" />
                                                Open
                                            </Button>
                                            <Button variant="ghost" size="icon-sm" class="lg:hidden" @click="selectSpecialty(specialty)">
                                                <AppIcon name="eye" class="size-4" />
                                                <span class="sr-only">Open specialty details</span>
                                            </Button>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground md:hidden">
                                            <Badge :variant="statusVariant(specialty.status)" class="text-[10px] leading-none">{{ specialty.status || 'unknown' }}</Badge>
                                        </div>
                                    </div>
                                </div>
                                <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3">
                                    <p class="text-xs text-muted-foreground">
                                        Showing {{ specialties.length }} of {{ pagination?.total ?? specialties.length }} results | Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                                    </p>
                                    <div v-if="(pagination?.lastPage ?? 1) > 1" class="flex items-center gap-2">
                                        <Button variant="outline" size="sm" :disabled="listLoading || (pagination?.currentPage ?? 1) <= 1" @click="prevPage">Previous</Button>
                                        <Button variant="outline" size="sm" :disabled="listLoading || !pagination || pagination.currentPage >= pagination.lastPage" @click="nextPage">Next</Button>
                                    </div>
                                </footer>
                            </CardContent>
                        </Card>

                        <Card class="flex h-full min-h-0 flex-col rounded-lg border-sidebar-border/70">
                            <template v-if="!queueReady">
                                <CardHeader class="gap-3 border-b pb-3">
                                    <Skeleton class="h-5 w-40" />
                                    <Skeleton class="h-4 w-60" />
                                </CardHeader>
                                <CardContent class="space-y-4 p-4">
                                    <div class="grid gap-3 sm:grid-cols-3">
                                        <Skeleton class="h-20 rounded-lg" />
                                        <Skeleton class="h-20 rounded-lg" />
                                        <Skeleton class="h-20 rounded-lg" />
                                    </div>
                                    <Skeleton class="h-24 rounded-lg" />
                                    <Skeleton class="h-36 rounded-lg" />
                                </CardContent>
                            </template>
                            <template v-else-if="selectedSpecialty">
                                <CardHeader class="gap-4 border-b pb-4">
                                    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div class="min-w-0 space-y-1">
                                            <CardTitle class="text-base">{{ specialtyLabel(selectedSpecialty) }}</CardTitle>
                                            <CardDescription>{{ selectedSpecialty.description || 'No description recorded for this specialty.' }}</CardDescription>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Button v-if="canViewAudit" variant="outline" size="sm" class="gap-1.5" :disabled="auditLoading" @click="selectedSpecialty && loadAudit(selectedSpecialty)">
                                                <AppIcon name="shield-check" class="size-3.5" />
                                                {{ auditLoading ? 'Refreshing audit...' : 'Refresh audit' }}
                                            </Button>
                                            <Button v-if="canUpdate" variant="outline" size="sm" class="gap-1.5" @click="openEdit(selectedSpecialty)">
                                                <AppIcon name="pencil" class="size-3.5" />
                                                Edit
                                            </Button>
                                            <Button
                                                v-if="canUpdateStatus"
                                                size="sm"
                                                class="gap-1.5"
                                                :variant="(selectedSpecialty.status ?? '').toLowerCase() === 'active' ? 'destructive' : 'secondary'"
                                                @click="openStatusDialog(selectedSpecialty, (selectedSpecialty.status ?? '').toLowerCase() === 'active' ? 'inactive' : 'active')"
                                            >
                                                <AppIcon :name="(selectedSpecialty.status ?? '').toLowerCase() === 'active' ? 'circle-x' : 'check-circle'" class="size-3.5" />
                                                {{ (selectedSpecialty.status ?? '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate' }}
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent class="space-y-4 p-4">
                                    <div class="grid gap-3 sm:grid-cols-3">
                                        <div class="rounded-lg border bg-muted/20 p-3">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Status</p>
                                            <div class="mt-2">
                                                <Badge :variant="statusVariant(selectedSpecialty.status)">{{ selectedSpecialty.status || 'unknown' }}</Badge>
                                            </div>
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 p-3">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Code</p>
                                            <p class="mt-2 text-sm font-medium">{{ selectedSpecialty.code || 'No code' }}</p>
                                        </div>
                                        <div class="rounded-lg border bg-muted/20 p-3">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Updated</p>
                                            <p class="mt-2 text-sm font-medium">{{ selectedSpecialty.updatedAt || selectedSpecialty.createdAt || 'N/A' }}</p>
                                        </div>
                                    </div>

                                    <div class="rounded-lg border p-4">
                                        <h3 class="text-sm font-medium">Description</h3>
                                        <p class="mt-2 text-sm text-muted-foreground">{{ selectedSpecialty.description || 'No description recorded for this specialty.' }}</p>
                                    </div>

                                    <div class="rounded-lg border p-4">
                                        <div class="flex items-center justify-between gap-3">
                                            <div>
                                                <h3 class="text-sm font-medium">Assigned staff</h3>
                                                <p class="text-xs text-muted-foreground">Staff profiles currently mapped to this specialty.</p>
                                            </div>
                                            <div class="flex flex-wrap items-center gap-2">
                                                <Button
                                                    v-if="canReadStaffSpecialties"
                                                    variant="outline"
                                                    size="sm"
                                                    class="gap-1.5"
                                                    :disabled="assignedStaffLoading"
                                                    @click="selectedSpecialty && loadAssignedStaff(selectedSpecialty, assignedStaffPage)"
                                                >
                                                    <AppIcon name="activity" class="size-3.5" />
                                                    {{ assignedStaffLoading ? 'Refreshing...' : 'Refresh' }}
                                                </Button>
                                                <Button
                                                    v-if="canReadStaffSpecialties || canManageStaffSpecialties"
                                                    variant="outline"
                                                    size="sm"
                                                    class="gap-1.5"
                                                    @click="assignmentDialogOpen = true"
                                                >
                                                    <AppIcon name="users" class="size-3.5" />
                                                    Manage assignments
                                                </Button>
                                            </div>
                                        </div>
                                        <div v-if="!canReadStaffSpecialties" class="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                                            Request <code>staff.specialties.read</code> permission to review assigned staff.
                                        </div>
                                        <div v-else-if="assignedStaffLoading" class="mt-4 space-y-2">
                                            <div class="flex items-start gap-3 rounded-lg border bg-muted/10 px-3 py-3">
                                                <Skeleton class="h-8 w-8 rounded-full" />
                                                <div class="min-w-0 flex-1 space-y-2">
                                                    <Skeleton class="h-3.5 w-36" />
                                                    <Skeleton class="h-3 w-48" />
                                                    <Skeleton class="h-3 w-40" />
                                                </div>
                                                <Skeleton class="h-5 w-14 rounded-full" />
                                            </div>
                                            <div class="flex items-start gap-3 rounded-lg border bg-muted/10 px-3 py-3">
                                                <Skeleton class="h-8 w-8 rounded-full" />
                                                <div class="min-w-0 flex-1 space-y-2">
                                                    <Skeleton class="h-3.5 w-32" />
                                                    <Skeleton class="h-3 w-44" />
                                                    <Skeleton class="h-3 w-36" />
                                                </div>
                                                <Skeleton class="h-5 w-16 rounded-full" />
                                            </div>
                                        </div>
                                        <Alert v-else-if="assignedStaffError" variant="destructive" class="mt-4">
                                            <AlertTitle>Assigned staff unavailable</AlertTitle>
                                            <AlertDescription>{{ assignedStaffError }}</AlertDescription>
                                        </Alert>
                                        <div v-else-if="assignedStaff.length === 0" class="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                                            No staff are currently assigned to this specialty.
                                        </div>
                                        <div v-else class="mt-4 space-y-3">
                                            <div v-for="profile in assignedStaff" :key="profile.id" class="flex items-start gap-3 rounded-lg border bg-muted/10 px-3 py-3">
                                                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                                                    {{ staffProfileInitials(profile) }}
                                                </div>
                                                <div class="min-w-0 flex-1">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <p class="truncate text-sm font-medium">{{ staffProfileLabel(profile) }}</p>
                                                        <Badge v-if="profile.isPrimary" variant="default">Primary</Badge>
                                                        <Badge :variant="staffStatusVariant(profile.status)">{{ profile.status || "unknown" }}</Badge>
                                                        <Badge :variant="staffVerificationVariant(profile)">{{ staffProfileVerificationLabel(profile) }}</Badge>
                                                    </div>
                                                    <p class="mt-1 text-xs text-muted-foreground">{{ staffProfileMeta(profile) }}</p>
                                                    <p class="mt-1 text-xs text-muted-foreground">{{ staffProfileContact(profile) }}</p>
                                                </div>
                                            </div>
                                            <div v-if="(assignedStaffMeta?.lastPage ?? 1) > 1" class="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                                                <p class="text-xs text-muted-foreground">
                                                    Showing {{ assignedStaff.length }} of {{ assignedStaffMeta?.total ?? assignedStaff.length }} assigned staff | Page {{ assignedStaffMeta?.currentPage ?? 1 }} of {{ assignedStaffMeta?.lastPage ?? 1 }}
                                                </p>
                                                <div class="flex items-center gap-2">
                                                    <Button variant="outline" size="sm" :disabled="(assignedStaffMeta?.currentPage ?? 1) <= 1 || assignedStaffLoading" @click="prevAssignedStaffPage">
                                                        Previous
                                                    </Button>
                                                    <Button variant="outline" size="sm" :disabled="!assignedStaffMeta || assignedStaffMeta.currentPage >= assignedStaffMeta.lastPage || assignedStaffLoading" @click="nextAssignedStaffPage">
                                                        Next
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="rounded-lg border p-4">
                                        <div class="flex items-center justify-between gap-3">
                                            <div>
                                                <h3 class="text-sm font-medium">Audit activity</h3>
                                                <p class="text-xs text-muted-foreground">Recent changes and actor trail for this specialty.</p>
                                            </div>
                                        </div>
                                        <div v-if="!canViewAudit" class="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                                            Audit history is hidden for your role.
                                        </div>
                                        <div v-else-if="auditLoading && specialtyKey(auditSpecialty) === specialtyKey(selectedSpecialty)" class="mt-4 space-y-2">
                                            <Skeleton class="h-10 w-full" />
                                            <Skeleton class="h-10 w-full" />
                                            <Skeleton class="h-10 w-full" />
                                        </div>
                                        <Alert v-else-if="auditError" variant="destructive" class="mt-4">
                                            <AlertTitle>Audit load issue</AlertTitle>
                                            <AlertDescription>{{ auditError }}</AlertDescription>
                                        </Alert>
                                        <div v-else-if="auditLogs.length === 0" class="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                                            No audit logs found for this specialty.
                                        </div>
                                        <div v-else class="mt-4 space-y-3">
                                            <div v-for="log in auditLogs" :key="log.id" class="flex items-start gap-3 rounded-lg border bg-muted/10 px-3 py-3">
                                                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                                    <AppIcon name="activity" class="size-3.5 text-muted-foreground" />
                                                </div>
                                                <div class="min-w-0 flex-1">
                                                    <p class="text-sm font-medium">{{ auditLabel(log) }}</p>
                                                    <p class="mt-0.5 text-xs text-muted-foreground">{{ log.createdAt || 'N/A' }} | {{ actorLabel(log) }}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </template>
                            <template v-else>
                                <CardContent class="flex min-h-[18rem] items-center justify-center p-6">
                                    <div class="max-w-sm text-center text-sm text-muted-foreground">
                                        Select a specialty from the queue to review catalog details and audit activity.
                                    </div>
                                </CardContent>
                            </template>
                        </Card>
                    </div>
                </template>
                <Card v-else class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                            Specialty Catalog
                        </CardTitle>
                        <CardDescription>Catalog access is permission restricted.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle>Access restricted</AlertTitle>
                            <AlertDescription>Request <code>specialties.read</code> permission.</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                <Dialog :open="createDialogOpen" @update:open="(open) => (createDialogOpen = open)">
                    <DialogContent size="xl">
                        <DialogHeader>
                            <DialogTitle>Create Specialty</DialogTitle>
                            <DialogDescription>Add a new specialty code and display name to the catalog.</DialogDescription>
                        </DialogHeader>
                        <div class="grid gap-4">
                            <div class="grid gap-2 md:grid-cols-2">
                                <div class="grid gap-2">
                                    <Label for="create-code">Code</Label>
                                    <Input id="create-code" v-model="createForm.code" />
                                    <p v-if="createErrors.code" class="text-xs text-destructive">{{ createErrors.code[0] }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="create-name">Name</Label>
                                    <Input id="create-name" v-model="createForm.name" />
                                    <p v-if="createErrors.name" class="text-xs text-destructive">{{ createErrors.name[0] }}</p>
                                </div>
                            </div>
                            <div class="grid gap-2">
                                <Label for="create-description">Description</Label>
                                <Textarea id="create-description" v-model="createForm.description" class="min-h-24" />
                                <p v-if="createErrors.description" class="text-xs text-destructive">{{ createErrors.description[0] }}</p>
                            </div>
                        </div>
                        <DialogFooter class="gap-2">
                            <Button variant="outline" :disabled="createLoading" @click="createDialogOpen = false">Cancel</Button>
                            <Button :disabled="createLoading" class="gap-1.5" @click="createSpecialty">
                                <AppIcon name="plus" class="size-3.5" />
                                {{ createLoading ? 'Creating...' : 'Create Specialty' }}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog :open="assignmentDialogOpen" @update:open="(open) => (assignmentDialogOpen = open)">
                    <DialogContent variant="workspace" size="6xl" class="max-h-[88vh]">
                        <DialogHeader class="border-b px-6 py-4">
                            <DialogTitle>Staff Specialty Assignment</DialogTitle>
                            <DialogDescription>Search staff, review their specialty assignments, and update the primary specialty from one focused workspace.</DialogDescription>
                        </DialogHeader>
                        <div class="grid min-h-0 min-w-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            <div class="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">
                                <div class="space-y-3 border-b px-4 py-4">
                                    <div class="space-y-1">
                                        <h3 class="text-sm font-medium">Select staff</h3>
                                        <p class="text-xs text-muted-foreground">Find the staff profile you want to review or update.</p>
                                    </div>
                                    <div class="flex gap-2">
                                        <div class="relative min-w-0 flex-1">
                                            <AppIcon name="search" class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                v-model="assignmentStaffQuery"
                                                class="h-9 pl-9"
                                                placeholder="Search name, email, title, or department"
                                                @keyup.enter="loadAssignmentStaffProfiles"
                                            />
                                        </div>
                                        <Button size="sm" class="gap-1.5" :disabled="assignmentStaffLoading || !canReadStaffDirectory" @click="loadAssignmentStaffProfiles">
                                            <AppIcon name="search" class="size-3.5" />
                                            {{ assignmentStaffLoading ? 'Searching...' : 'Search' }}
                                        </Button>
                                    </div>
                                </div>
                                <div class="min-h-0 flex-1">
                                    <div v-if="assignmentStaffLoading && !assignmentStaffReady" class="space-y-2 px-4 py-4">
                                        <div v-for="index in 5" :key="'assignment-staff-skeleton-' + index" class="rounded-lg border px-3 py-3">
                                            <Skeleton class="h-4 w-32" />
                                            <Skeleton class="mt-2 h-3 w-full max-w-[12rem]" />
                                            <div class="mt-3 flex items-center gap-2">
                                                <Skeleton class="h-5 w-16 rounded-full" />
                                                <Skeleton class="h-5 w-20 rounded-full" />
                                            </div>
                                        </div>
                                    </div>
                                    <ScrollArea v-else class="h-full">
                                        <div class="space-y-2 px-4 py-4">
                                            <Alert v-if="assignmentStaffError" variant="destructive">
                                                <AlertTitle>Staff lookup issue</AlertTitle>
                                                <AlertDescription>{{ assignmentStaffError }}</AlertDescription>
                                            </Alert>
                                            <div v-else-if="!canReadStaffDirectory" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                                Request <code>staff.read</code> permission to search staff profiles here.
                                            </div>
                                            <div v-else-if="assignmentStaffReady && assignmentStaffResults.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                                No staff profiles matched the current search.
                                            </div>
                                            <button
                                                v-for="profile in assignmentStaffResults"
                                                :key="profile.id"
                                                type="button"
                                                class="w-full rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/40"
                                                :class="assignmentSelectedStaff?.id === profile.id ? 'border-primary bg-primary/5' : 'border-border'"
                                                @click="selectAssignmentStaff(profile)"
                                            >
                                                <div class="flex items-start gap-3">
                                                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                                                        {{ staffProfileInitials(profile) }}
                                                    </div>
                                                    <div class="min-w-0 flex-1">
                                                        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                            <div class="min-w-0">
                                                                <p class="truncate text-sm font-medium">{{ staffProfileLabel(profile) }}</p>
                                                                <p class="truncate text-xs text-muted-foreground">{{ staffProfileMeta(profile) }}</p>
                                                            </div>
                                                            <Badge :variant="staffStatusVariant(profile.status)" class="text-[10px] leading-none">
                                                                {{ profile.status || 'unknown' }}
                                                            </Badge>
                                                        </div>
                                                        <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                            <span class="truncate">{{ staffProfileContact(profile) }}</span>
                                                            <Badge :variant="staffVerificationVariant(profile)" class="text-[10px] leading-none">
                                                                {{ staffProfileVerificationLabel(profile) }}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>

                            <div class="flex min-h-0 min-w-0 flex-col">
                                <div class="space-y-3 border-b px-4 py-4">
                                    <div v-if="assignmentSelectedStaff" class="flex items-start gap-3">
                                        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                            {{ staffProfileInitials(assignmentSelectedStaff) }}
                                        </div>
                                        <div class="min-w-0 flex-1 space-y-1">
                                            <div class="flex flex-wrap items-center gap-2">
                                                <h3 class="truncate text-sm font-medium">{{ staffProfileLabel(assignmentSelectedStaff) }}</h3>
                                                <Badge :variant="staffStatusVariant(assignmentSelectedStaff.status)" class="text-[10px] leading-none">
                                                    {{ assignmentSelectedStaff.status || 'unknown' }}
                                                </Badge>
                                                <Badge :variant="staffVerificationVariant(assignmentSelectedStaff)" class="text-[10px] leading-none">
                                                    {{ staffProfileVerificationLabel(assignmentSelectedStaff) }}
                                                </Badge>
                                            </div>
                                            <p class="text-xs text-muted-foreground">{{ staffProfileMeta(assignmentSelectedStaff) }}</p>
                                            <p class="text-xs text-muted-foreground">{{ staffProfileContact(assignmentSelectedStaff) }}</p>
                                        </div>
                                    </div>
                                    <div v-else class="space-y-1">
                                        <h3 class="text-sm font-medium">Specialty assignments</h3>
                                        <p class="text-xs text-muted-foreground">Choose a staff profile from the left to review and update specialty coverage.</p>
                                    </div>

                                    <Alert v-if="staffAssignmentReadOnly" variant="default">
                                        <AlertTitle>Assignment view only</AlertTitle>
                                        <AlertDescription>
                                            You can review staff specialty assignments here, but editing stays hidden until <code>staff.specialties.manage</code> is granted.
                                        </AlertDescription>
                                    </Alert>
                                    <Alert v-if="assignmentCatalogError" variant="destructive">
                                        <AlertTitle>Catalog issue</AlertTitle>
                                        <AlertDescription>{{ assignmentCatalogError }}</AlertDescription>
                                    </Alert>
                                    <Alert v-if="assignmentError" variant="destructive">
                                        <AlertTitle>Assignment issue</AlertTitle>
                                        <AlertDescription>{{ assignmentError }}</AlertDescription>
                                    </Alert>
                                </div>

                                <template v-if="assignmentSelectedStaff">
                                    <div class="min-h-0 flex-1">
                                        <div v-if="assignmentCatalogLoading || assignmentLoading" class="space-y-3 px-4 py-4">
                                            <Skeleton class="h-5 w-40" />
                                            <div v-for="index in 6" :key="'assignment-specialty-skeleton-' + index" class="rounded-lg border px-3 py-3">
                                                <div class="flex items-center gap-3">
                                                    <Skeleton class="h-4 w-4 rounded" />
                                                    <div class="min-w-0 flex-1 space-y-2">
                                                        <Skeleton class="h-4 w-40" />
                                                        <Skeleton class="h-3 w-full max-w-[18rem]" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <ScrollArea v-else class="h-full">
                                            <div class="space-y-2 px-4 py-4">
                                                <div v-if="assignmentCatalog.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                                    No active specialties are available for assignment right now.
                                                </div>
                                                <label
                                                    v-for="specialty in assignmentCatalog"
                                                    :key="`assign-${specialty.id}`"
                                                    class="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors hover:bg-muted/40"
                                                    :class="assignmentSelectedIds.includes(String(specialty.id ?? '')) ? 'border-primary/60 bg-primary/5' : 'border-border'"
                                                >
                                                    <Checkbox
                                                        :model-value="assignmentSelectedIds.includes(String(specialty.id ?? ''))"
                                                        :disabled="!canManageStaffSpecialties"
                                                        class="mt-0.5"
                                                        @update:model-value="toggleAssignmentSpecialty(String(specialty.id ?? ''), $event === true)"
                                                    />
                                                    <div class="min-w-0 flex-1">
                                                        <p class="text-sm font-medium">{{ specialtyLabel(specialty) }}</p>
                                                        <p class="mt-1 text-xs text-muted-foreground">{{ specialty.description || 'No specialty description recorded.' }}</p>
                                                    </div>
                                                </label>
                                            </div>
                                        </ScrollArea>
                                    </div>

                                    <div class="border-t px-4 py-4">
                                        <div class="grid gap-2">
                                            <Label for="primary-specialty-dialog">Primary Specialty</Label>
                                            <Select v-model="assignmentPrimaryId">
                                                <SelectTrigger :disabled="!canManageStaffSpecialties || assignmentSelectedIds.length === 0">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                <SelectItem value="">No primary</SelectItem>
                                                <SelectItem
                                                    v-for="specialty in assignmentPrimaryOptions"
                                                    :key="`primary-${specialty.id}`"
                                                    :value="String(specialty.id ?? '')"
                                                >
                                                    {{ specialtyLabel(specialty) }}
                                                </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p class="text-xs text-muted-foreground">
                                                {{ assignmentSelectedIds.length }} specialties selected
                                                <span v-if="assignmentPrimaryId"> | Primary set</span>
                                            </p>
                                        </div>
                                    </div>
                                </template>
                                <div v-else class="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
                                    <div class="max-w-sm text-center text-sm text-muted-foreground">
                                        Search and select a staff profile to review specialty assignments and choose a primary specialty.
                                    </div>
                                </div>
                            </div>
                        </div>
                        <DialogFooter class="border-t px-6 py-4">
                            <Button variant="outline" @click="assignmentDialogOpen = false">Close</Button>
                            <Button
                                v-if="canManageStaffSpecialties"
                                class="gap-1.5"
                                :disabled="assignmentSaving || !canManageStaffSpecialties || !assignmentSelectedStaff"
                                @click="saveStaffAssignments"
                            >
                                <AppIcon name="check-circle" class="size-3.5" />
                                {{ assignmentSaving ? 'Saving...' : 'Save Assignments' }}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            <!-- Edit Specialty dialog -->
            <Dialog :open="editDialogOpen" @update:open="(open) => (open ? (editDialogOpen = true) : closeEdit())">
                <DialogContent size="xl">
                    <DialogHeader>
                        <DialogTitle>Edit Specialty</DialogTitle>
                        <DialogDescription>Update code, name, and description.</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <div class="grid gap-2">
                            <Label for="edit-code">Code</Label>
                            <Input id="edit-code" v-model="editForm.code" />
                            <p v-if="editErrors.code" class="text-xs text-destructive">{{ editErrors.code[0] }}</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="edit-name">Name</Label>
                            <Input id="edit-name" v-model="editForm.name" />
                            <p v-if="editErrors.name" class="text-xs text-destructive">{{ editErrors.name[0] }}</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="edit-description">Description</Label>
                            <Textarea id="edit-description" v-model="editForm.description" class="min-h-20" />
                        </div>
                    </div>
                    <DialogFooter class="gap-2">
                        <Button variant="outline" :disabled="editLoading" @click="closeEdit">Cancel</Button>
                        <Button :disabled="editLoading" class="gap-1.5" @click="saveEdit">
                            <AppIcon name="check-circle" class="size-3.5" />
                            {{ editLoading ? 'Saving...' : 'Save Changes' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <!-- Status update dialog -->
            <Dialog :open="statusDialogOpen" @update:open="(open) => (open ? (statusDialogOpen = true) : closeStatusDialog())">
                <DialogContent variant="action" size="lg">
                    <DialogHeader>
                        <DialogTitle>{{ statusTarget === 'inactive' ? 'Deactivate Specialty' : 'Activate Specialty' }}</DialogTitle>
                        <DialogDescription>{{ statusTarget === 'inactive' ? 'Reason is required before deactivating.' : 'Confirm activation of this specialty.' }}</DialogDescription>
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
                        <Button variant="outline" :disabled="statusLoading" @click="closeStatusDialog">Cancel</Button>
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





