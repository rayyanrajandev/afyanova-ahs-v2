<script setup lang="ts">
import { Head, usePage } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import Checkbox from '@/components/ui/checkbox/Checkbox.vue';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { csrfRequestHeaders } from '@/lib/csrf';
import { getInitials } from '@/composables/useInitials';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { BreadcrumbItem } from '@/types';
import type { Auth } from '@/types/auth';

type AttendanceLog = {
    id: string;
    uid: number;
    user_id: string;
    device_user_name: string | null;
    state: number;
    type: number | null;
    record_time: string;
    pulled_at: string;
    device: { id: string; name: string; location: string | null } | null;
    staff: {
        id: string;
        user_id: number | null;
        user_name: string | null;
        employee_number: string;
        department: string;
        job_title: string;
    } | null;
};

type AttendanceDevice = {
    id: string;
    name: string;
    ip: string;
    port: number;
    password: string | null;
    serial: string | null;
    model: string | null;
    location: string | null;
    is_active: boolean;
    last_connected_at: string | null;
};

type PaginatedResponse = {
    data: AttendanceLog[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
};

type DeviceListResponse = {
    data: AttendanceDevice[];
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Staff', href: '/staff' },
    { title: 'Attendance', href: '/staff-attendance' },
];

const page = usePage<{ auth: Auth }>();
const permissionNames = new Set(
    (Array.isArray(page.props.auth?.permissions) ? page.props.auth.permissions : []).map((p) => p.trim()).filter(Boolean),
);
const canReadStaff = ref(permissionNames.has('staff.read'));
const canUpdateStaff = ref(permissionNames.has('staff.update'));

const loading = ref(true);
const logs = ref<AttendanceLog[]>([]);
type PaginationMeta = { currentPage: number; perPage: number; total: number; lastPage: number };
const pagination = ref<PaginationMeta | null>(null);
const devices = ref<AttendanceDevice[]>([]);
const pulling = ref(false);
const clearing = ref(false);
const deleting = ref(false);
const printing = ref(false);
const exporting = ref(false);
const selectedIds = reactive(new Set<string>());

const agentStatus = ref<{ mode: string; last_heartbeat_at: string | null; last_device_name: string | null } | null>(null);

async function fetchAgentStatus() {
    try {
        agentStatus.value = await apiGet('/attendance/agent/status');
    } catch {
        agentStatus.value = null;
    }
}

const isCloudMode = computed(() => agentStatus.value?.mode === 'cloud');

const isAllSelected = computed(() => logs.value.length > 0 && selectedIds.size === logs.value.length);

const filters = reactive({
    device_id: 'all',
    type: 'all',
    date_from: '',
    date_to: '',
    page: 1,
    perPage: 50,
});

function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function setDatePreset(preset: string) {
    const today = new Date();
    const todayStr = formatDate(today);
    switch (preset) {
        case 'today':
            filters.date_from = todayStr;
            filters.date_to = todayStr;
            break;
        case 'yesterday': {
            const y = new Date(today);
            y.setDate(y.getDate() - 1);
            filters.date_from = formatDate(y);
            filters.date_to = formatDate(y);
            break;
        }
        case '3days': {
            const d3 = new Date(today);
            d3.setDate(d3.getDate() - 3);
            filters.date_from = formatDate(d3);
            filters.date_to = todayStr;
            break;
        }
        case 'this-week': {
            const monday = new Date(today);
            const dayOfWeek = monday.getDay();
            const diff = monday.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            monday.setDate(diff);
            filters.date_from = formatDate(monday);
            filters.date_to = todayStr;
            break;
        }
        case 'this-month':
            filters.date_from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            filters.date_to = todayStr;
            break;
    }
}

const deviceDialogOpen = ref(false);
const allDevicesLoading = ref(false);
const allDevices = ref<AttendanceDevice[]>([]);
const deviceFormMode = ref<'none' | 'create' | 'edit'>('none');
const editingDeviceId = ref<string | null>(null);
const deviceForm = reactive({
    name: '',
    ip: '',
    port: 4370,
    password: '',
    location: '',
    is_active: true,
});
const deviceSaving = ref(false);
const testingDeviceId = ref<string | null>(null);
const deviceTestResult = reactive<{ message: string; type: 'success' | 'error' | null }>({
    message: '',
    type: null,
});

async function apiGet<T>(path: string, query?: Record<string, string | number | null | undefined>): Promise<T> {
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
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return (await response.json()) as T;
}

async function apiPost<T>(path: string, body?: Record<string, unknown>, method: string = 'POST'): Promise<T> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
    };
    Object.assign(headers, csrfRequestHeaders());
    const response = await fetch(`/api/v1${path}`, {
        method,
        credentials: 'same-origin',
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { message?: string }).message ?? `HTTP ${response.status}`);
    }
    return (await response.json()) as T;
}

async function loadDevices() {
    try {
        const response = await apiGet<DeviceListResponse>('/staff/attendance/devices');
        devices.value = response.data;
    } catch {
        devices.value = [];
    }
}

async function loadLogs() {
    loading.value = true;
    try {
        const response = await apiGet<PaginatedResponse>('/staff/attendance/logs', {
            device_id: filters.device_id !== 'all' ? filters.device_id : null,
            type: filters.type !== 'all' ? filters.type : null,
            date_from: filters.date_from || null,
            date_to: filters.date_to || null,
            page: filters.page,
            per_page: filters.perPage,
        });
        logs.value = response.data;
        pagination.value = {
            currentPage: response.current_page,
            perPage: response.per_page,
            total: response.total,
            lastPage: response.last_page,
        };
    } catch (error) {
        logs.value = [];
        pagination.value = null;
        notifyError(messageFromUnknown(error, 'Unable to load attendance logs.'));
    } finally {
        loading.value = false;
    }
}

async function pullAttendance() {
    pulling.value = true;
    try {
        await apiPost('/attendance/pull');
        notifySuccess('Attendance pull triggered successfully.');
        await loadLogs();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Failed to pull attendance.'));
    } finally {
        pulling.value = false;
    }
}

function toggleSelect(id: string): void {
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
    } else {
        selectedIds.add(id);
    }
}

function toggleSelectAll(): void {
    if (isAllSelected.value) {
        selectedIds.clear();
    } else {
        logs.value.forEach((log) => selectedIds.add(log.id));
    }
}

async function deleteSelected(): Promise<void> {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} attendance record${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    deleting.value = true;
    try {
        await apiPost('/staff/attendance/logs', { ids } as Record<string, unknown>, 'DELETE');
        notifySuccess(`Deleted ${ids.length} record${ids.length > 1 ? 's' : ''}.`);
        selectedIds.clear();
        await loadLogs();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Failed to delete records.'));
    } finally {
        deleting.value = false;
    }
}

async function clearAll(): Promise<void> {
    if (!confirm('Clear ALL attendance logs from the database? Data on the device is not affected.')) return;
    clearing.value = true;
    try {
        await apiPost('/attendance/clear');
        notifySuccess('All attendance logs cleared.');
        selectedIds.clear();
        await loadLogs();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Failed to clear attendance.'));
    } finally {
        clearing.value = false;
    }
}

function stateLabel(type: number | null): string {
    const labels: Record<number, string> = {
        0: 'Check In', 1: 'Check Out', 2: 'Break Out', 3: 'Break In',
        4: 'Overtime In', 5: 'Overtime Out',
    };
    return type !== null ? (labels[type] ?? `Type ${type}`) : 'Unknown';
}

function stateVariant(type: number | null): 'default' | 'destructive' | 'secondary' | 'outline' {
    if (type === 0 || type === 3) return 'secondary';
    if (type === 1 || type === 5) return 'destructive';
    return 'outline';
}

function formatDT(value: string | null | undefined): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(d);
}

function staffName(log: AttendanceLog): string {
    if (log.staff?.user_name) return log.staff.user_name;
    if (log.staff?.employee_number) return `Staff #${log.staff.employee_number}`;
    if (log.device_user_name) return log.device_user_name;
    return `Device UID #${log.user_id}`;
}

function employeeNumberLabel(log: AttendanceLog): string {
    if (log.staff?.user_name && log.staff?.employee_number) return log.staff.employee_number;
    return '';
}

const hasActiveFilters = computed(() => Boolean(filters.device_id !== 'all' || filters.type !== 'all' || filters.date_from || filters.date_to));

const staffListSummaryText = computed(() => {
    if (!pagination.value) return '';
    return `${pagination.value.total} attendance records`;
});

const canPrev = computed(() => (pagination.value?.currentPage ?? 1) > 1);
const canNext = computed(() => pagination.value ? pagination.value.currentPage < pagination.value.lastPage : false);

const paginationPages = computed((): (number | '...')[] => {
    const total = pagination.value?.lastPage ?? 1;
    const current = pagination.value?.currentPage ?? 1;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p += 1) pages.push(p);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
});

async function printLogs(): Promise<void> {
    printing.value = true;
    try {
        const all = await apiGet<PaginatedResponse>('/staff/attendance/logs', {
            device_id: filters.device_id !== 'all' ? filters.device_id : null,
            type: filters.type !== 'all' ? filters.type : null,
            date_from: filters.date_from || null,
            date_to: filters.date_to || null,
            per_page: 10000,
            page: 1,
        });

        const rows = all.data.map((log) => {
            const name = staffNameHTML(log);
            const emp = employeeNumberLabel(log);
            const type = stateLabel(log.type);
            const time = formatDT(log.record_time);
            const device = log.device?.name ?? '';
            return `<tr>
                <td style="padding:6px 10px;border:1px solid #ccc">${emp}</td>
                <td style="padding:6px 10px;border:1px solid #ccc">${name}</td>
                <td style="padding:6px 10px;border:1px solid #ccc">${type}</td>
                <td style="padding:6px 10px;border:1px solid #ccc;white-space:nowrap">${time}</td>
                <td style="padding:6px 10px;border:1px solid #ccc">${device}</td>
            </tr>`;
        }).join('');

        const w = window.open('', '_blank', 'width=1100,height=800');
        if (!w) { notifyError('Unable to open print preview.'); return; }

        const dateLabel = [filters.date_from, filters.date_to].filter(Boolean).join(' — ') || 'All dates';
        const deviceLabel = filters.device_id !== 'all'
            ? (devices.value.find((d) => d.id === filters.device_id)?.name ?? filters.device_id)
            : 'All devices';

        w.document.write(`<!DOCTYPE html><html><head>
            <meta charset="utf-8">
            <title>Attendance Logs</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 24px; font-size: 12px; color: #222; }
                h1 { font-size: 18px; margin: 0 0 4px; }
                .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
                table { width: 100%; border-collapse: collapse; }
                th { padding: 8px 10px; border: 1px solid #999; background: #f5f5f5; text-align: left; font-size: 11px; text-transform: uppercase; }
                td { padding: 6px 10px; border: 1px solid #ccc; font-size: 12px; }
                tr:nth-child(even) { background: #fafafa; }
                @media print { body { margin: 12mm; } }
            </style>
        </head><body>
            <h1>Attendance Logs</h1>
            <div class="meta">${deviceLabel} &middot; ${dateLabel} &middot; ${all.total} records</div>
            <table><thead><tr>
                <th>Employee #</th><th>Name</th><th>Type</th><th>Date/Time</th><th>Device</th>
            </tr></thead><tbody>${rows}</tbody></table>
        </body></html>`);
        w.document.close();
        w.focus();
        w.print();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to print.'));
    } finally {
        printing.value = false;
    }
}

function staffNameHTML(log: AttendanceLog): string {
    if (log.staff?.user_name) return escapeHtml(log.staff.user_name);
    if (log.staff?.employee_number) return `Staff #${escapeHtml(log.staff.employee_number)}`;
    if (log.device_user_name) return escapeHtml(log.device_user_name);
    return `Device UID #${log.user_id}`;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function exportCsv(): Promise<void> {
    exporting.value = true;
    try {
        const params = new URLSearchParams();
        if (filters.device_id !== 'all') params.set('device_id', filters.device_id);
        if (filters.type !== 'all') params.set('type', filters.type);
        if (filters.date_from) params.set('date_from', filters.date_from);
        if (filters.date_to) params.set('date_to', filters.date_to);

        const url = new URL('/api/v1/staff/attendance/logs/export', window.location.origin);
        url.search = params.toString();

        const response = await fetch(url.toString(), {
            credentials: 'same-origin',
            headers: {
                Accept: 'text/csv, */*;q=0.1',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();

        const disposition = response.headers.get('content-disposition') ?? '';
        const match = disposition.match(/filename="?([^"]+)"?/);
        const filename = match?.[1] ?? 'attendance_logs.csv';

        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to export CSV.'));
    } finally {
        exporting.value = false;
    }
}

function applyFilters() {
    filters.page = 1;
    void loadLogs();
}

function resetFilters() {
    filters.device_id = 'all';
    filters.type = 'all';
    filters.date_from = '';
    filters.date_to = '';
    void applyFilters();
}

function goToPage(p: number) {
    filters.page = p;
    void loadLogs();
}

function prevPage() {
    if (canPrev.value) goToPage((pagination.value?.currentPage ?? 1) - 1);
}

function nextPage() {
    if (canNext.value) goToPage((pagination.value?.currentPage ?? 1) + 1);
}

async function loadAllDevices() {
    allDevicesLoading.value = true;
    try {
        const response = await apiGet<DeviceListResponse>('/staff/attendance/devices', { all: 1 });
        allDevices.value = response.data;
    } catch {
        allDevices.value = [];
    } finally {
        allDevicesLoading.value = false;
    }
}

async function openDeviceDialog() {
    deviceDialogOpen.value = true;
    deviceFormMode.value = 'none';
    deviceTestResult.message = '';
    deviceTestResult.type = null;
    await loadAllDevices();
}

function startAddDevice() {
    deviceForm.name = '';
    deviceForm.ip = '';
    deviceForm.port = 4370;
    deviceForm.password = '';
    deviceForm.location = '';
    deviceForm.is_active = true;
    deviceFormMode.value = 'create';
    editingDeviceId.value = null;
}

function startEditDevice(device: AttendanceDevice) {
    deviceForm.name = device.name;
    deviceForm.ip = device.ip;
    deviceForm.port = device.port;
    deviceForm.password = device.password ?? '';
    deviceForm.location = device.location ?? '';
    deviceForm.is_active = device.is_active;
    deviceFormMode.value = 'edit';
    editingDeviceId.value = device.id;
}

function cancelDeviceForm() {
    deviceFormMode.value = 'none';
    editingDeviceId.value = null;
}

async function saveDevice() {
    deviceSaving.value = true;
    try {
        const payload: Record<string, unknown> = {
            name: deviceForm.name,
            ip: deviceForm.ip,
            port: deviceForm.port,
            password: deviceForm.password || null,
            location: deviceForm.location || null,
            is_active: deviceForm.is_active,
        };
        if (deviceFormMode.value === 'create') {
            await apiPost('/staff/attendance/devices', payload);
        } else if (editingDeviceId.value) {
            await apiPost(`/staff/attendance/devices/${editingDeviceId.value}`, payload, 'PUT');
        }
        notifySuccess(deviceFormMode.value === 'create' ? 'Device created.' : 'Device updated.');
        deviceFormMode.value = 'none';
        editingDeviceId.value = null;
        await loadAllDevices();
        await loadDevices();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Failed to save device.'));
    } finally {
        deviceSaving.value = false;
    }
}

async function testDeviceConnection(device: AttendanceDevice) {
    testingDeviceId.value = device.id;
    deviceTestResult.message = '';
    deviceTestResult.type = null;
    try {
        const response = await apiPost<{ message: string; info?: Record<string, unknown> }>(
            `/staff/attendance/devices/${device.id}/test-connection`,
        );
        deviceTestResult.message = response.message;
        deviceTestResult.type = 'success';
        notifySuccess(`${device.name}: ${response.message}`);
        await loadAllDevices();
    } catch (error) {
        const msg = messageFromUnknown(error, 'Connection failed.');
        deviceTestResult.message = msg;
        deviceTestResult.type = 'error';
        notifyError(`${device.name}: ${msg}`);
    } finally {
        testingDeviceId.value = null;
    }
}

async function deleteDevice(device: AttendanceDevice) {
    if (!window.confirm(`Delete "${device.name}"? This cannot be undone.`)) return;
    try {
        await apiPost(`/staff/attendance/devices/${device.id}`, undefined, 'DELETE');
        notifySuccess(`"${device.name}" deleted.`);
        await loadAllDevices();
        await loadDevices();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Failed to delete device.'));
    }
}

function closeDeviceDialog() {
    deviceDialogOpen.value = false;
    deviceFormMode.value = 'none';
    deviceTestResult.message = '';
    deviceTestResult.type = null;
}

onMounted(async () => {
    await Promise.all([loadDevices(), loadLogs(), fetchAgentStatus()]);
});
</script>

<template>
    <Head title="Staff Attendance" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">

            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="clock" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">
                                    Staff Attendance
                                </h1>
                            </div>
                            <p class="truncate text-xs text-muted-foreground">
                                Biometric attendance logs from ZKTeco devices
                            </p>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5"
                            :disabled="loading"
                            @click="loadLogs"
                        >
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            {{ loading ? 'Refreshing...' : 'Refresh' }}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5"
                            :disabled="printing || logs.length === 0"
                            @click="printLogs"
                        >
                            <AppIcon name="printer" class="size-3.5" />
                            {{ printing ? 'Preparing...' : 'Print' }}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5"
                            :disabled="exporting || logs.length === 0"
                            @click="exportCsv"
                        >
                            <AppIcon name="download" class="size-3.5" />
                            {{ exporting ? 'Exporting...' : 'Export CSV' }}
                        </Button>
                        <Button
                            v-if="canUpdateStaff && !isCloudMode"
                            size="sm"
                            class="h-8 gap-1.5"
                            :disabled="pulling"
                            @click="pullAttendance"
                        >
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            {{ pulling ? 'Pulling...' : 'Pull from devices' }}
                        </Button>
                        <span
                            v-else-if="canUpdateStaff && isCloudMode && agentStatus"
                            class="flex items-center gap-1.5 text-xs text-muted-foreground"
                            :title="agentStatus.last_heartbeat_at ? `Last agent heartbeat: ${formatDT(agentStatus.last_heartbeat_at)}` : 'Waiting for first agent heartbeat'"
                        >
                            <AppIcon name="radio" class="size-3 text-emerald-500" />
                            Agent auto-sync
                            <template v-if="agentStatus.last_heartbeat_at">
                                · {{ formatDT(agentStatus.last_heartbeat_at) }}
                            </template>
                        </span>
                        <Button
                            v-if="canUpdateStaff && selectedIds.size > 0"
                            variant="destructive"
                            size="sm"
                            class="h-8 gap-1.5"
                            :disabled="deleting"
                            @click="deleteSelected"
                        >
                            <AppIcon name="trash-2" class="size-3.5" />
                            {{ deleting ? 'Deleting...' : `Delete selected (${selectedIds.size})` }}
                        </Button>
                        <Button
                            v-if="canUpdateStaff"
                            variant="destructive-ghost"
                            size="sm"
                            class="h-8 gap-1.5 text-xs"
                            :disabled="clearing"
                            @click="clearAll"
                        >
                            <AppIcon name="trash-2" class="size-3.5" />
                            Clear all
                        </Button>
                        <Button
                            v-if="canUpdateStaff"
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5"
                            @click="openDeviceDialog"
                        >
                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                            Manage devices
                        </Button>
                    </div>
                </div>
            </section>

            <div class="flex min-w-0 flex-col gap-4">

                <Card v-if="canReadStaff" class="flex min-h-0 flex-1 flex-col gap-0 rounded-lg border-sidebar-border/70 py-0">
                    <CardHeader class="shrink-0 gap-3 border-b px-4 py-3">
                        <div class="flex items-center justify-between">
                            <div class="min-w-0 space-y-1">
                                <CardTitle class="text-sm font-semibold">
                                    Attendance Logs
                                </CardTitle>
                                <p class="text-xs text-muted-foreground">
                                    {{ staffListSummaryText }}
                                </p>
                            </div>
                        </div>
                    </CardHeader>

                    <div class="border-b px-4 py-3">
                        <div class="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                            <div class="flex flex-wrap items-center gap-2">
                                <Select v-model="filters.device_id" class="w-44">
                                    <SelectTrigger class="h-8 text-xs">
                                        <SelectValue placeholder="All devices" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All devices</SelectItem>
                                        <SelectItem v-for="d in devices" :key="d.id" :value="d.id">
                                            {{ d.name }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select v-model="filters.type" class="w-36">
                                    <SelectTrigger class="h-8 text-xs">
                                        <SelectValue placeholder="All states" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All states</SelectItem>
                                        <SelectItem value="0">Check In</SelectItem>
                                        <SelectItem value="1">Check Out</SelectItem>
                                        <SelectItem value="2">Break Out</SelectItem>
                                        <SelectItem value="3">Break In</SelectItem>
                                        <SelectItem value="4">Overtime In</SelectItem>
                                        <SelectItem value="5">Overtime Out</SelectItem>
                                    </SelectContent>
                                </Select>
                                <div class="flex flex-wrap gap-1">
<Button variant="outline" size="sm" class="h-8 text-xs" @click="setDatePreset('today'); applyFilters()">Today</Button>
                                <Button variant="outline" size="sm" class="h-8 text-xs" @click="setDatePreset('yesterday'); applyFilters()">Yesterday</Button>
                                <Button variant="outline" size="sm" class="h-8 text-xs" @click="setDatePreset('3days'); applyFilters()">3 days</Button>
                                <Button variant="outline" size="sm" class="h-8 text-xs" @click="setDatePreset('this-week'); applyFilters()">This week</Button>
                                <Button variant="outline" size="sm" class="h-8 text-xs" @click="setDatePreset('this-month'); applyFilters()">This month</Button>
                                </div>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                <DateRangeFilterPopover input-base-id="attendance-date" hide-label v-model:from="filters.date_from" v-model:to="filters.date_to" />
                                <Button size="sm" class="h-8" :disabled="loading" @click="applyFilters">
                                    <AppIcon name="eye" class="size-3.5" />
                                    Apply
                                </Button>
                                <Button variant="outline" size="sm" class="h-8" @click="resetFilters">
                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                    Reset
                                </Button>
                            </div>
                        </div>
                        <div v-if="hasActiveFilters" class="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2">
                            <span class="text-[11px] text-muted-foreground">Filters:</span>
                            <button
                                v-if="filters.device_id !== 'all'"
                                type="button"
                                class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80"
                                @click="filters.device_id = 'all'; applyFilters()"
                            >
                                {{ devices.find(d => d.id === filters.device_id)?.name ?? filters.device_id }}
                                <AppIcon name="circle-x" class="size-3" />
                            </button>
                            <button
                                v-if="filters.type !== 'all'"
                                type="button"
                                class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80"
                                @click="filters.type = 'all'; applyFilters()"
                            >
                                {{ {0:'Check In',1:'Check Out',2:'Break Out',3:'Break In',4:'Overtime In',5:'Overtime Out'}[Number(filters.type)] ?? `State ${filters.type}` }}
                                <AppIcon name="circle-x" class="size-3" />
                            </button>
                            <button
                                v-if="filters.date_from"
                                type="button"
                                class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80"
                                @click="filters.date_from = ''; applyFilters()"
                            >
                                From: {{ filters.date_from }}
                                <AppIcon name="circle-x" class="size-3" />
                            </button>
                            <button
                                v-if="filters.date_to"
                                type="button"
                                class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80"
                                @click="filters.date_to = ''; applyFilters()"
                            >
                                To: {{ filters.date_to }}
                                <AppIcon name="circle-x" class="size-3" />
                            </button>
                            <button class="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline" @click="resetFilters">
                                Clear all
                            </button>
                        </div>
                    </div>

                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="min-h-[12rem]">
                                <RegistryListSkeleton v-if="loading" :count="5" />

                                <div
                                    v-else-if="logs.length === 0"
                                    class="flex flex-col items-center gap-3 px-4 py-10 text-center"
                                >
                                    <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
                                        <AppIcon name="clock" class="size-4 text-muted-foreground" />
                                    </div>
                                    <div class="space-y-1">
                                        <p class="text-sm font-medium">No attendance records found</p>
                                        <p class="text-xs text-muted-foreground">
                                            Try adjusting your filters or pull from connected devices.
                                        </p>
                                    </div>
                                    <Button
                                        v-if="canUpdateStaff && !isCloudMode"
                                        size="sm"
                                        class="h-8 gap-1.5"
                                        :disabled="pulling"
                                        @click="pullAttendance"
                                    >
                                        <AppIcon name="refresh-cw" class="size-3.5" />
                                        Pull from devices
                                    </Button>
                                </div>

                                <div v-else class="divide-y px-4">
                                    <div
                                        v-if="canUpdateStaff && logs.length > 0"
                                        class="flex items-center gap-2 border-b py-2"
                                    >
                                        <Checkbox
                                            :checked="isAllSelected ? true : (selectedIds.size > 0 ? 'indeterminate' : false)"
                                            @update:checked="toggleSelectAll"
                                        />
                                        <span class="text-xs text-muted-foreground">
                                            {{ selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all' }}
                                        </span>
                                    </div>
                                    <RegistryListRow
                                        v-for="log in logs"
                                        :key="`att-log-${log.id}`"
                                        :selectable="canUpdateStaff"
                                        :selected="selectedIds.has(log.id)"
                                        :status-dot-class="log.type === 0 || log.type === 3 ? 'bg-emerald-500' : log.type === 1 || log.type === 5 ? 'bg-rose-500' : 'bg-slate-400'"
                                        :status-title="stateLabel(log.type)"
                                        @select="toggleSelect(log.id)"
                                    >
                                        <template v-if="canUpdateStaff" #leading>
                                            <div @click.stop>
                                                <Checkbox
                                                    :checked="selectedIds.has(log.id)"
                                                    @update:checked="toggleSelect(log.id)"
                                                />
                                            </div>
                                        </template>
                                        <template #title>
                                            <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                                <Avatar class="size-7 rounded-full">
                                                    <AvatarFallback class="text-[10px]">{{ getInitials(staffName(log)) }}</AvatarFallback>
                                                </Avatar>
                                                <span class="truncate text-sm font-medium transition-colors hover:text-primary">
                                                    {{ staffName(log) }}
                                                </span>
                                                <span class="shrink-0 text-xs text-muted-foreground">
                                                    {{ employeeNumberLabel(log) }}
                                                </span>
                                            </div>
                                        </template>
                                        <template #meta>
                                            <p class="truncate text-xs text-muted-foreground">
                                                {{ log.staff?.job_title || '' }}
                                                <template v-if="log.staff?.job_title && log.staff?.department">
                                                    <span class="text-border"> · </span>
                                                </template>
                                                {{ log.staff?.department || '' }}
                                                <template v-if="log.staff?.job_title || log.staff?.department">
                                                    <span class="text-border"> · </span>
                                                </template>
                                                {{ formatDT(log.record_time) }}
                                            </p>
                                            <p v-if="log.device" class="truncate text-[10px] text-muted-foreground/60">
                                                {{ log.device.name }}{{ log.device.location ? ` (${log.device.location})` : '' }}
                                            </p>
                                        </template>
                                        <template #badges>
                                            <Badge :variant="stateVariant(log.type)">
                                                {{ stateLabel(log.type) }}
                                            </Badge>
                                        </template>
                                    </RegistryListRow>
                                </div>
                            </div>
                        </ScrollArea>

                        <footer v-if="pagination && pagination.lastPage > 1" class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                            <p class="text-xs text-muted-foreground">
                                Showing {{ logs.length }} of
                                {{ pagination.total }} · Page
                                {{ pagination.currentPage }} of
                                {{ pagination.lastPage }}
                            </p>
                            <div class="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    class="size-8"
                                    :disabled="!canPrev || loading"
                                    @click="prevPage"
                                >
                                    <AppIcon name="chevron-left" class="size-4" />
                                </Button>
                                <template v-for="p in paginationPages" :key="String(p)">
                                    <span
                                        v-if="p === '...'"
                                        class="px-1 text-xs text-muted-foreground"
                                    >…</span>
                                    <Button
                                        v-else
                                        :variant="p === pagination?.currentPage ? 'default' : 'ghost'"
                                        size="icon"
                                        class="size-8 text-xs"
                                        :disabled="loading"
                                        @click="goToPage(p as number)"
                                    >
                                        {{ p }}
                                    </Button>
                                </template>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    class="size-8"
                                    :disabled="!canNext || loading"
                                    @click="nextPage"
                                >
                                    <AppIcon name="chevron-right" class="size-4" />
                                </Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>

                <Card v-else class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="clock" class="size-5 text-muted-foreground" />
                            Staff Attendance
                        </CardTitle>
                        <CardDescription>View biometric attendance logs from connected devices.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div class="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
                            Attendance read access restricted. Request <code>staff.read</code> permission to view attendance logs.
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    </AppLayout>

    <!-- Device management dialog -->
    <Dialog :open="deviceDialogOpen" @update:open="deviceDialogOpen = $event">
        <DialogContent variant="form" size="2xl" class="max-h-[90vh] gap-0 overflow-hidden p-0">
            <DialogHeader class="sticky top-0 z-10 shrink-0 border-b px-6 py-4">
                <DialogTitle class="flex items-center gap-2">
                    <AppIcon name="sliders-horizontal" class="size-5 text-muted-foreground" />
                    Attendance Devices
                </DialogTitle>
                <DialogDescription>
                    Configure and test ZKTeco biometric devices.
                </DialogDescription>
            </DialogHeader>

            <ScrollArea class="min-h-0 flex-1 p-6">
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <p class="text-sm font-medium">Connected devices</p>
                        <Button
                            v-if="deviceFormMode === 'none'"
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5"
                            @click="startAddDevice"
                        >
                            <AppIcon name="plus" class="size-3.5" />
                            New Device
                        </Button>
                    </div>

                    <!-- Add/Edit form -->
                    <div
                        v-if="deviceFormMode !== 'none'"
                        class="rounded-lg border border-primary/30 bg-primary/5 p-4"
                    >
                        <p class="mb-3 text-sm font-medium">
                            {{ deviceFormMode === 'create' ? 'New Device' : 'Edit Device' }}
                        </p>
                        <div class="grid gap-3 sm:grid-cols-2">
                            <div class="grid gap-1.5 sm:col-span-2">
                                <Label for="dev-name">Name</Label>
                                <Input id="dev-name" v-model="deviceForm.name" placeholder="e.g. Main Gate" />
                            </div>
                            <div class="grid gap-1.5">
                                <Label for="dev-ip">IP Address</Label>
                                <Input id="dev-ip" v-model="deviceForm.ip" placeholder="192.168.1.100" />
                            </div>
                            <div class="grid gap-1.5">
                                <Label for="dev-port">Port</Label>
                                <Input id="dev-port" v-model.number="deviceForm.port" type="number" min="1" max="65535" />
                            </div>
                            <div class="grid gap-1.5">
                                <Label for="dev-password">Password</Label>
                                <Input id="dev-password" v-model="deviceForm.password" placeholder="Device comm password" />
                            </div>
                            <div class="grid gap-1.5">
                                <Label for="dev-location">Location</Label>
                                <Input id="dev-location" v-model="deviceForm.location" placeholder="e.g. Lobby" />
                            </div>
                            <div class="flex items-center gap-3 sm:col-span-2">
                                <Switch id="dev-active" v-model:checked="deviceForm.is_active" />
                                <Label for="dev-active" class="cursor-pointer">Device active</Label>
                            </div>
                        </div>
                        <div class="mt-4 flex items-center gap-2">
                            <Button size="sm" :disabled="deviceSaving" @click="saveDevice">
                                <AppIcon name="check" class="size-3.5" />
                                {{ deviceSaving ? 'Saving...' : 'Save' }}
                            </Button>
                            <Button variant="outline" size="sm" :disabled="deviceSaving" @click="cancelDeviceForm">
                                Cancel
                            </Button>
                        </div>
                    </div>

                    <!-- Device list -->
                    <div v-if="allDevicesLoading" class="space-y-2">
                        <div v-for="i in 3" :key="i" class="flex items-center gap-3 rounded-lg border p-3">
                            <Skeleton class="size-8 shrink-0 rounded-lg" />
                            <div class="min-w-0 flex-1 space-y-1">
                                <Skeleton class="h-4 w-32" />
                                <Skeleton class="h-3 w-48" />
                            </div>
                        </div>
                    </div>

                    <div v-else-if="allDevices.length === 0" class="flex flex-col items-center gap-2 py-6 text-center">
                        <AppIcon name="sliders-horizontal" class="size-8 text-muted-foreground/40" />
                        <p class="text-sm text-muted-foreground">No devices configured yet.</p>
                    </div>

                    <div v-else class="space-y-2">
                        <div
                            v-for="device in allDevices"
                            :key="device.id"
                            class="flex items-center gap-3 rounded-lg border p-3"
                        >
                            <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                <AppIcon
                                    name="layout-grid"
                                    class="size-4"
                                    :class="device.is_active ? 'text-emerald-600' : 'text-muted-foreground'"
                                />
                            </div>
                            <div class="min-w-0 flex-1">
                                <p class="truncate text-sm font-medium">
                                    {{ device.name }}
                                </p>
                                <p class="truncate text-xs text-muted-foreground">
                                    {{ device.ip }}:{{ device.port }}
                                    <template v-if="device.location"> · {{ device.location }}</template>
                                    <span class="text-border"> · </span>
                                    <span :class="device.is_active ? 'text-emerald-600' : 'text-muted-foreground'">
                                        {{ device.is_active ? 'Active' : 'Inactive' }}
                                    </span>
                                    <template v-if="device.last_connected_at">
                                        <span class="text-border"> · </span>
                                        Last: {{ formatDT(device.last_connected_at) }}
                                    </template>
                                </p>
                            </div>
                            <div class="flex shrink-0 items-center gap-1">
                                <Button
                                    v-if="!isCloudMode"
                                    variant="outline"
                                    size="sm"
                                    class="h-7 gap-1 text-xs"
                                    :disabled="testingDeviceId === device.id"
                                    @click="testDeviceConnection(device)"
                                >
                                    <AppIcon name="rotate-ccw" class="size-3" />
                                    {{ testingDeviceId === device.id ? 'Testing...' : 'Test' }}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    class="size-7"
                                    @click="startEditDevice(device)"
                                >
                                    <AppIcon name="pencil" class="size-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    class="size-7 text-destructive"
                                    @click="deleteDevice(device)"
                                >
                                    <AppIcon name="circle-x" class="size-3.5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </ScrollArea>

            <DialogFooter class="sticky bottom-0 z-10 shrink-0 border-t px-6 py-4">
                <Button variant="outline" @click="closeDeviceDialog">Close</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
