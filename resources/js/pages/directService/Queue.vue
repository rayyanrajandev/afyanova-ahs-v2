<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DirectServiceStatusDialog, {
    type DirectServiceStatusTargetRequest,
} from '@/components/directService/DirectServiceStatusDialog.vue';
import PatientSummaryPopover from '@/components/patients/summary/PatientSummaryPopover.vue';
import { useDirectServiceDepartmentOptions } from '@/composables/directService/useDirectServiceDepartmentOptions';
import { useDirectServiceFilters } from '@/composables/directService/useDirectServiceFilters';
import { useDirectServicePatientDirectory } from '@/composables/directService/useDirectServicePatientDirectory';
import { useDirectServiceRequests, type DirectServiceRequest } from '@/composables/directService/useDirectServiceRequests';
import { useDirectServiceStatusCounts } from '@/composables/directService/useDirectServiceStatusCounts';
import { useDirectServiceLiveUpdates } from '@/composables/directService/useDirectServiceLiveUpdates';
import { type DirectServiceStatusTarget } from '@/composables/directService/useUpdateDirectServiceStatus';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { type BreadcrumbItem } from '@/types';

/**
 * B3 of the patient flow redesign's Direct Service workflow: a from-scratch
 * queue over ServiceRequestModel, replacing walk-in-service-requests/Index.vue
 * (now marked Legacy and un-nav-linked, same treatment as /patients/legacy,
 * /appointments/legacy, /emergency-triage). Copies emergency/Queue.vue's
 * page shape verbatim (sticky header + KPI cards + Tabs status filter +
 * bounded auto-scroll container) — the reusable part across this codebase's
 * queue pages is the PATTERN, not shared runtime code; every queue page
 * (triage/clinician/emergency/this one) independently re-implements it
 * against its own backend model, by established convention.
 *
 * Department scoping is hard-enforced server-side
 * (ServiceRequestDepartmentScopeResolver) — a department-scoped actor's own
 * department always wins regardless of what this page sends, so the
 * department Select filter only renders for actors holding
 * service.requests.view-all-departments; everyone else sees a fixed
 * "Managing: {department}" badge instead (name derived from the first
 * loaded ticket's department, since there is no dedicated "my department"
 * endpoint — falls back to generic wording when the queue is empty).
 *
 * KPI cards are Pending/In Progress/Completed/Total (ServiceRequestStatus's
 * 4 values), not "completed today" — the backend's status-counts endpoint
 * filters by requested_at, not completed_at, so a true "completed today"
 * count isn't cleanly derivable from the existing filter set without a
 * backend change out of this phase's scope.
 *
 * Status-transition matrix is exactly ServiceRequestStatus::
 * allowedForwardTransitions() (pending -> in_progress/cancelled,
 * in_progress -> completed/cancelled) — unlike Appointment/Emergency, the
 * backend DOES enforce this graph itself (ServiceRequestStatusTransitionException
 * on an invalid attempt), so this UI's gating is a convenience, not the only
 * enforcement.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canRead = computed(() => hasAccess('service.requests.read'));
const canUpdateStatus = computed(() => hasAccess('service.requests.update-status'));
const canViewAllDepartments = computed(() => hasAccess('service.requests.view-all-departments'));

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Direct Service Queue', href: '/direct-service/queue' },
]);

const filters = useDirectServiceFilters();
const list = useDirectServiceRequests(filters);
const statusCounts = useDirectServiceStatusCounts(filters);
const { isLive } = useDirectServiceLiveUpdates();
const departmentOptions = useDirectServiceDepartmentOptions();

const requests = computed(() => list.data.value?.data ?? []);
const meta = computed(() => list.data.value?.meta ?? null);
const departmentScopeMissing = computed(
    () => list.data.value?.meta.departmentScopeMissing ?? statusCounts.data.value?.meta.departmentScopeMissing ?? false,
);
const managedDepartmentLabel = computed(() => requests.value[0]?.departmentLabel ?? 'your department');

const patientIds = computed(() => requests.value.map((item) => item.patientId ?? '').filter(Boolean));
const patientDirectory = useDirectServicePatientDirectory(patientIds);

function setStatus(value: string | number): void {
    filters.status = value === 'all' ? '' : String(value);
    filters.page = 1;
}

const departmentFilterValue = computed({
    get: () => filters.departmentId || 'all',
    set: (value: string) => {
        filters.departmentId = value === 'all' ? '' : value;
        filters.page = 1;
    },
});

function statusVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'pending':
            return 'outline';
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

function priorityClass(priority: string | null): string {
    return priority === 'urgent' ? 'border-transparent bg-destructive text-white' : '';
}

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function goToPage(page: number): void {
    filters.page = page;
}

const serviceWorkspaceRoutes: Record<string, string> = {
    laboratory: '/laboratory-orders',
    pharmacy: '/pharmacy-orders',
    radiology: '/radiology-orders',
    theatre_procedure: '/theatre-procedures',
};

/** Matches ServiceRequestStatus::allowedForwardTransitions() exactly. */
type Transition = { target: DirectServiceStatusTarget; label: string; destructive: boolean };
function availableTransitions(status: string | null): Transition[] {
    switch (status) {
        case 'pending':
            return [
                { target: 'in_progress', label: 'Accept', destructive: false },
                { target: 'cancelled', label: 'Cancel', destructive: true },
            ];
        case 'in_progress':
            return [
                { target: 'completed', label: 'Close', destructive: false },
                { target: 'cancelled', label: 'Cancel', destructive: true },
            ];
        default:
            return [];
    }
}

const queryClient = useQueryClient();

async function invalidateQueueAndCounts(): Promise<void> {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['direct-service-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['direct-service-status-counts'] }),
    ]);
}

const statusDialogOpen = ref(false);
const statusDialogTarget = ref<DirectServiceStatusTargetRequest | null>(null);
const statusDialogAction = ref<DirectServiceStatusTarget | null>(null);

function openStatusDialog(item: DirectServiceRequest, action: DirectServiceStatusTarget): void {
    statusDialogTarget.value = { requestId: item.id, requestNumber: item.requestNumber };
    statusDialogAction.value = action;
    statusDialogOpen.value = true;
}

async function onStatusUpdated(): Promise<void> {
    await invalidateQueueAndCounts();
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Direct Service Queue" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <div class="flex items-center gap-2">
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Direct Service Queue</h1>
                            <span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <span class="size-1.5 rounded-full" :class="isLive ? 'bg-emerald-500' : 'bg-muted-foreground/40'" aria-hidden="true" />
                                {{ isLive ? 'Live' : 'Polling' }}
                            </span>
                        </div>
                        <p class="text-xs text-muted-foreground">
                            Patients registered for lab, pharmacy, radiology, or theatre without a doctor visit.
                        </p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <Badge v-if="meta" variant="secondary">{{ meta.total }} tickets</Badge>
                        <Badge v-if="canRead && !canViewAllDepartments && !departmentScopeMissing" variant="outline">
                            Managing: {{ managedDepartmentLabel }}
                        </Badge>
                    </div>
                </div>

                <div v-if="canRead" class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Pending</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.data.pending ?? '—' }}</p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">In progress</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.data.in_progress ?? '—' }}</p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Completed</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.data.completed ?? '—' }}</p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.data.total ?? '—' }}</p>
                    </div>
                </div>

                <Tabs v-if="canRead && !departmentScopeMissing" :model-value="filters.status || 'all'" class="mt-3" @update:model-value="setStatus">
                    <TabsList class="grid w-full grid-cols-4">
                        <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                            All
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.data.total ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="pending" class="inline-flex items-center gap-1.5">
                            Pending
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.data.pending ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="in_progress" class="inline-flex items-center gap-1.5">
                            In progress
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.data.in_progress ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="completed" class="inline-flex items-center gap-1.5">
                            Completed
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.data.completed ?? '—' }}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canRead" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing the direct service queue requires <code>service.requests.read</code>.</AlertDescription>
                </Alert>

                <Alert v-else-if="departmentScopeMissing">
                    <AlertTitle>No department assigned</AlertTitle>
                    <AlertDescription>
                        Your account has no department assigned, so no tickets can be shown. Contact an administrator to assign one.
                    </AlertDescription>
                </Alert>

                <template v-else>

                    <div v-if="canViewAllDepartments" class="flex flex-wrap items-start gap-2">
                        <Select v-model="departmentFilterValue">
                            <SelectTrigger class="h-9 w-56">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All departments</SelectItem>
                                <SelectItem v-for="option in departmentOptions.data.value ?? []" :key="option.value" :value="option.value">
                                    {{ option.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div v-if="list.isPending.value" class="space-y-2">
                        <Skeleton class="h-16 w-full" />
                        <Skeleton class="h-16 w-full" />
                        <Skeleton class="h-16 w-full" />
                    </div>

                    <Alert v-else-if="list.isError.value" variant="destructive">
                        <AlertTitle>Unable to load the direct service queue</AlertTitle>
                        <AlertDescription>{{ (list.error.value as Error | null)?.message ?? 'Unknown error.' }}</AlertDescription>
                    </Alert>

                    <div
                        v-else-if="requests.length === 0"
                        class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
                    >
                        No direct service tickets found.
                    </div>

                    <ul v-else class="space-y-2">
                        <li
                            v-for="item in requests"
                            :key="item.id"
                            class="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-3 shadow-sm"
                            :class="item.priority === 'urgent' ? 'border-destructive/40 bg-destructive/5' : ''"
                        >
                            <div class="min-w-0 space-y-1.5">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="font-mono text-xs text-muted-foreground">{{ item.requestNumber || 'Ticket' }}</span>
                                    <Badge :variant="statusVariant(item.status)">{{ item.status || 'unknown' }}</Badge>
                                    <Badge v-if="item.priority" :class="priorityClass(item.priority)">{{ item.priority }}</Badge>
                                    <Badge variant="outline">{{ item.departmentLabel || item.serviceType || 'Unassigned' }}</Badge>
                                </div>
                                <div class="min-w-0">
                                    <PatientSummaryPopover v-if="item.patientId" :patient-id="item.patientId">
                                        <template #trigger>
                                            <button type="button" class="truncate text-left font-medium text-foreground hover:underline">
                                                {{ patientDirectory.displayName(item.patientId) }}
                                            </button>
                                        </template>
                                        <template #actions>
                                            <a :href="`/patients/${item.patientId}/chart`" class="text-xs font-medium text-primary hover:underline">
                                                View chart
                                            </a>
                                        </template>
                                    </PatientSummaryPopover>
                                    <p v-else class="font-medium text-foreground">{{ patientDirectory.displayName(item.patientId) }}</p>
                                    <p class="truncate text-xs text-muted-foreground">
                                        {{ patientDirectory.patientNumber(item.patientId) || 'No MRN assigned' }}
                                    </p>
                                </div>
                                <p class="text-xs text-muted-foreground">{{ item.notes || 'No notes recorded' }}</p>
                                <p class="text-[11px] text-muted-foreground">Requested {{ formatDateTime(item.requestedAt) }}</p>
                            </div>

                            <div class="flex shrink-0 flex-wrap items-center justify-end gap-1">
                                <a
                                    v-if="item.status === 'in_progress' && item.serviceType && serviceWorkspaceRoutes[item.serviceType]"
                                    :href="serviceWorkspaceRoutes[item.serviceType]"
                                    class="inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium text-primary hover:bg-muted"
                                >
                                    Open workspace
                                    <AppIcon name="chevron-right" class="ml-0.5 size-3.5" />
                                </a>
                                <template v-if="canUpdateStatus">
                                    <Button
                                        v-for="transition in availableTransitions(item.status)"
                                        :key="transition.target"
                                        size="sm"
                                        :variant="transition.destructive ? 'ghost' : 'outline'"
                                        :class="['h-7 px-2 text-xs', transition.destructive ? 'text-destructive hover:text-destructive' : '']"
                                        @click="openStatusDialog(item, transition.target)"
                                    >
                                        {{ transition.label }}
                                    </Button>
                                </template>
                            </div>
                        </li>
                    </ul>

                    <div v-if="meta && meta.lastPage > 1" class="flex items-center justify-between text-sm text-muted-foreground">
                        <p>Page {{ meta.currentPage }} of {{ meta.lastPage }} ({{ meta.total }} total)</p>
                        <div class="flex gap-2">
                            <Button size="sm" variant="outline" :disabled="meta.currentPage <= 1" @click="goToPage(meta.currentPage - 1)">
                                <AppIcon name="chevron-left" class="size-3.5" />Previous
                            </Button>
                            <Button size="sm" variant="outline" :disabled="meta.currentPage >= meta.lastPage" @click="goToPage(meta.currentPage + 1)">
                                Next<AppIcon name="chevron-right" class="size-3.5" />
                            </Button>
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <DirectServiceStatusDialog
            v-model:open="statusDialogOpen"
            :target="statusDialogTarget"
            :action="statusDialogAction"
            @updated="onStatusUpdated"
        />
    </AppLayout>
</template>
