<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGetBlob, apiGet, isApiClientError } from '@/lib/apiClient';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError } from '@/lib/notify';
import { patientChartHref } from '@/lib/patientChart';
import type { BreadcrumbItem } from '@/types';

type ServiceRequestRow = {
    id: string;
    requestNumber: string | null;
    patientId: string | null;
    appointmentId?: string | null;
    requestedByUserId?: string | number | null;
    serviceType: string | null;
    priority: string | null;
    status: string | null;
    notes: string | null;
    requestedAt?: string | null;
    acknowledgedAt?: string | null;
    acknowledgedByUserId?: string | number | null;
    completedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

type ListMeta = {
    currentPage?: number;
    perPage?: number;
    total?: number;
    lastPage?: number;
};

type AuditEventRow = {
    id: string;
    action?: string | null;
    actorUserId?: string | number | null;
    fromStatus?: string | null;
    toStatus?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt?: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Walk-in queue', href: '/walk-in-service-requests' },
];

const { hasPermission } = usePlatformAccess();

const canExport = () => hasPermission('service.requests.export');
const canViewAudit = () => hasPermission('service.requests.audit-logs.read');

const serviceTypeOptions = [
    { value: '', label: 'All desks' },
    { value: 'laboratory', label: formatEnumLabel('laboratory') },
    { value: 'pharmacy', label: formatEnumLabel('pharmacy') },
    { value: 'radiology', label: formatEnumLabel('radiology') },
];

const statusFilterOptions = [
    { value: '', label: 'All statuses' },
    { value: 'pending', label: formatEnumLabel('pending') },
    { value: 'in_progress', label: formatEnumLabel('in_progress') },
    { value: 'completed', label: formatEnumLabel('completed') },
    { value: 'cancelled', label: formatEnumLabel('cancelled') },
];

const priorityFilterOptions = [
    { value: '', label: 'Any priority' },
    { value: 'routine', label: formatEnumLabel('routine') },
    { value: 'urgent', label: formatEnumLabel('urgent') },
];

const filters = reactive({
    serviceType: '',
    status: '',
    priority: '',
    page: 1,
    perPage: 25,
});

const loading = ref(false);
const exportLoading = ref(false);
const loadError = ref<string | null>(null);
const rows = ref<ServiceRequestRow[]>([]);
const meta = ref<ListMeta | null>(null);

const auditOpen = ref(false);
const auditLoading = ref(false);
const auditError = ref<string | null>(null);
const auditEvents = ref<AuditEventRow[]>([]);
const auditRequest = ref<ServiceRequestRow | null>(null);

async function loadList(): Promise<void> {
    if (loading.value) return;

    loading.value = true;
    loadError.value = null;

    try {
        const query: Record<string, string | number> = {
            page: filters.page,
            perPage: filters.perPage,
            sortDir: 'desc',
        };
        if (filters.serviceType) query.serviceType = filters.serviceType;
        if (filters.status) query.status = filters.status;
        if (filters.priority) query.priority = filters.priority;

        const result = await apiGet<{ data: ServiceRequestRow[]; meta: ListMeta }>('/service-requests', query, {
            entitlementContext: 'Walk-in queue',
        });

        rows.value = result.data ?? [];
        meta.value = result.meta ?? null;
    } catch (error) {
        rows.value = [];
        meta.value = null;
        loadError.value = isApiClientError(error) ? error.message : messageFromUnknown(error);
    } finally {
        loading.value = false;
    }
}

function goToPage(next: number): void {
    const last = meta.value?.lastPage ?? 1;
    const clamped = Math.min(Math.max(next, 1), Math.max(last, 1));
    if (clamped === filters.page) return;
    filters.page = clamped;
    void loadList();
}

function changePerPage(value: string): void {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    filters.perPage = Math.min(parsed, 100);
    filters.page = 1;
    void loadList();
}

function applyFilters(): void {
    filters.page = 1;
    void loadList();
}

async function downloadExport(): Promise<void> {
    if (!canExport() || exportLoading.value) return;

    exportLoading.value = true;

    try {
        const query: Record<string, string> = {};
        if (filters.serviceType) query.serviceType = filters.serviceType;
        if (filters.status) query.status = filters.status;
        if (filters.priority) query.priority = filters.priority;

        const { blob, filename } = await apiGetBlob('/service-requests/export/csv', {
            query,
            entitlementContext: 'Walk-in export',
        });

        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename?.trim() !== '' ? filename : 'service-requests.csv';
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
    } catch (error) {
        notifyError(messageFromUnknown(error));
    } finally {
        exportLoading.value = false;
    }
}

async function openAudit(row: ServiceRequestRow): Promise<void> {
    if (!canViewAudit()) return;

    auditRequest.value = row;
    auditOpen.value = true;
    auditEvents.value = [];
    auditError.value = null;
    auditLoading.value = true;

    try {
        const response = await apiGet<{ data: AuditEventRow[] }>(
            `/service-requests/${encodeURIComponent(row.id)}/audit-events`,
            undefined,
            { entitlementContext: 'Walk-in audit' },
        );
        auditEvents.value = response.data ?? [];
    } catch (error) {
        auditError.value = messageFromUnknown(error);
    } finally {
        auditLoading.value = false;
    }
}

onMounted(() => {
    void loadList();
});
</script>

<template>
    <Head title="Walk-in queue" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex flex-col gap-4 p-4 md:p-6">
            <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="flex min-w-0 flex-col gap-1">
                    <h1 class="text-xl font-semibold tracking-tight text-foreground md:text-2xl">Walk-in service requests</h1>
                    <p class="max-w-prose text-sm text-muted-foreground">
                        Operational view across lab, pharmacy, and radiology handoffs. Departments still acknowledge tickets from their order
                        workspaces; this page supports supervisors reporting and reconciliation.
                    </p>
                </div>
                <Button
                    v-if="canExport()"
                    variant="outline"
                    class="gap-2"
                    :disabled="exportLoading"
                    @click="downloadExport()"
                >
                    <AppIcon
                        v-if="exportLoading"
                        name="refresh-cw"
                        class="size-4 animate-spin"
                    />
                    Export CSV
                </Button>
            </div>

            <Card class="shadow-sm">
                <CardHeader class="pb-3">
                    <CardTitle class="text-base">Filters</CardTitle>
                    <CardDescription>Refine rows before export; pagination matches the supervisor API.</CardDescription>
                </CardHeader>
                <CardContent class="flex flex-wrap items-end gap-3">
                    <div class="flex min-w-[140px] flex-col gap-1">
                        <span class="text-xs font-medium text-muted-foreground">Desk</span>
                        <Select
                            :model-value="filters.serviceType"
                            @update:model-value="
                                (v) => {
                                    filters.serviceType = v;
                                    applyFilters();
                                }
                            "
                        >
                            <SelectTrigger><SelectValue placeholder="Desk" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="opt in serviceTypeOptions" :key="'st-' + (opt.value || 'all')" :value="opt.value">
                                    {{ opt.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="flex min-w-[140px] flex-col gap-1">
                        <span class="text-xs font-medium text-muted-foreground">Status</span>
                        <Select
                            :model-value="filters.status"
                            @update:model-value="
                                (v) => {
                                    filters.status = v;
                                    applyFilters();
                                }
                            "
                        >
                            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="opt in statusFilterOptions" :key="'ss-' + (opt.value || 'all')" :value="opt.value">
                                    {{ opt.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="flex min-w-[140px] flex-col gap-1">
                        <span class="text-xs font-medium text-muted-foreground">Priority</span>
                        <Select
                            :model-value="filters.priority"
                            @update:model-value="
                                (v) => {
                                    filters.priority = v;
                                    applyFilters();
                                }
                            "
                        >
                            <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="opt in priorityFilterOptions" :key="'sp-' + (opt.value || 'all')" :value="opt.value">
                                    {{ opt.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="flex min-w-[120px] flex-col gap-1">
                        <span class="text-xs font-medium text-muted-foreground">Per page</span>
                        <Select :model-value="String(filters.perPage)" @update:model-value="changePerPage($event)">
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="secondary" class="gap-2" :disabled="loading" @click="loadList()">
                        <AppIcon v-if="loading" name="refresh-cw" class="size-4 animate-spin" />
                        Refresh
                    </Button>
                </CardContent>
            </Card>

            <Card class="shadow-sm">
                <CardHeader class="pb-2">
                    <CardTitle class="text-base">Queue</CardTitle>
                    <CardDescription v-if="meta?.total !== undefined"> {{ meta.total }} total matching requests </CardDescription>
                </CardHeader>
                <CardContent class="p-0">
                    <div v-if="loadError" class="px-6 py-4 text-sm text-destructive">{{ loadError }}</div>
                    <div v-else-if="loading" class="px-6 py-8 text-sm text-muted-foreground">Loading walk-in requests…</div>
                    <div v-else-if="rows.length === 0" class="px-6 py-8 text-sm text-muted-foreground">No requests match the current filters.</div>
                    <div v-else class="overflow-x-auto">
                        <table class="w-full min-w-[720px] border-collapse text-sm">
                            <thead>
                                <tr class="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase text-muted-foreground">
                                    <th class="px-4 py-2">Ticket</th>
                                    <th class="px-4 py-2">Patient</th>
                                    <th class="px-4 py-2">Desk</th>
                                    <th class="px-4 py-2">Status</th>
                                    <th class="px-4 py-2">Priority</th>
                                    <th class="px-4 py-2">Requested</th>
                                    <th v-if="canViewAudit()" class="px-4 py-2 text-right">Audit</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="row in rows"
                                    :key="row.id"
                                    class="border-b border-border/80 odd:bg-muted/20 hover:bg-muted/40"
                                >
                                    <td class="max-w-[200px] px-4 py-2 font-medium text-foreground">
                                        {{ row.requestNumber ?? row.id }}
                                    </td>
                                    <td class="px-4 py-2">
                                        <a
                                            v-if="row.patientId"
                                            class="text-primary underline-offset-4 hover:underline"
                                            :href="patientChartHref(row.patientId)"
                                        >
                                            Open chart
                                        </a>
                                        <span v-else class="text-muted-foreground">—</span>
                                    </td>
                                    <td class="px-4 py-2 capitalize text-muted-foreground">
                                        {{ row.serviceType ? formatEnumLabel(row.serviceType) : '—' }}
                                    </td>
                                    <td class="px-4 py-2">
                                        <Badge variant="outline" class="font-normal capitalize">
                                            {{ row.status ? formatEnumLabel(row.status) : '—' }}
                                        </Badge>
                                    </td>
                                    <td class="px-4 py-2">
                                        <span
                                            v-if="row.priority === 'urgent'"
                                            class="inline-flex rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-200"
                                        >
                                            Urgent
                                        </span>
                                        <span v-else class="capitalize text-muted-foreground">
                                            {{ row.priority ? formatEnumLabel(row.priority) : '—' }}
                                        </span>
                                    </td>
                                    <td class="max-w-[200px] px-4 py-2 text-muted-foreground">
                                        <span class="whitespace-nowrap">{{ row.requestedAt ? new Date(row.requestedAt).toLocaleString() : '—' }}</span>
                                    </td>
                                    <td v-if="canViewAudit()" class="px-4 py-2 text-right">
                                        <Button size="sm" variant="ghost" class="gap-1" @click="openAudit(row)"> View </Button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div
                        v-if="!loading && rows.length > 0 && meta && meta.lastPage && meta.lastPage > 1"
                        class="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground"
                    >
                        <span>
                            Page {{ meta.currentPage ?? filters.page }} of {{ meta.lastPage }}
                        </span>
                        <div class="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                :disabled="(meta.currentPage ?? 1) <= 1"
                                @click="goToPage((meta.currentPage ?? 1) - 1)"
                            >
                                Previous
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                :disabled="(meta.currentPage ?? 1) >= (meta.lastPage ?? 1)"
                                @click="goToPage((meta.currentPage ?? 1) + 1)"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <Drawer v-if="canViewAudit()" v-model:open="auditOpen">
            <DrawerContent class="max-h-[90vh]">
                <DrawerHeader>
                    <DrawerTitle>Ticket audit trail</DrawerTitle>
                    <DrawerDescription v-if="auditRequest">
                        {{ auditRequest.requestNumber ?? auditRequest.id }}
                    </DrawerDescription>
                </DrawerHeader>
                <div class="px-4 pb-2">
                    <div v-if="auditLoading" class="text-sm text-muted-foreground">Loading events…</div>
                    <div v-else-if="auditError" class="text-sm text-destructive">{{ auditError }}</div>
                    <ScrollArea v-else class="h-[50vh] pr-2">
                        <ul class="flex flex-col gap-2">
                            <li
                                v-for="ev in auditEvents"
                                :key="ev.id"
                                class="rounded-md border border-border bg-card px-3 py-2 text-sm"
                            >
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <span class="font-medium text-foreground">{{ ev.action ?? 'event' }}</span>
                                    <span class="text-xs text-muted-foreground">
                                        {{ ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '' }}
                                    </span>
                                </div>
                                <div v-if="ev.fromStatus || ev.toStatus" class="mt-1 text-xs text-muted-foreground">
                                    <span v-if="ev.fromStatus">{{ formatEnumLabel(ev.fromStatus) }}</span>
                                    <span v-if="ev.fromStatus && ev.toStatus"> → </span>
                                    <span v-if="ev.toStatus">{{ formatEnumLabel(ev.toStatus) }}</span>
                                </div>
                            </li>
                        </ul>
                    </ScrollArea>
                </div>
                <DrawerFooter>
                    <DrawerClose as-child>
                        <Button variant="outline">Close</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    </AppLayout>
</template>
