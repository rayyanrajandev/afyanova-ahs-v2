<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AuditLogSheet from '@/components/shared/AuditLogSheet.vue';
import EmergencyCaseCreateSheet from '@/components/emergency/EmergencyCaseCreateSheet.vue';
import EmergencyCaseTransfersPanel from '@/components/emergency/EmergencyCaseTransfersPanel.vue';
import EmergencyStatusDialog, { type EmergencyStatusTarget } from '@/components/emergency/EmergencyStatusDialog.vue';
import PatientSummaryPopover from '@/components/patients/summary/PatientSummaryPopover.vue';
import ElapsedTimeBadge from '@/components/shared/ElapsedTimeBadge.vue';
import { useEmergencyCaseAuditLog } from '@/composables/emergency/useEmergencyCaseAuditLog';
import { useEmergencyCaseFilters } from '@/composables/emergency/useEmergencyCaseFilters';
import { useEmergencyCasePatientDirectory } from '@/composables/emergency/useEmergencyCasePatientDirectory';
import { useEmergencyCaseStatusCounts } from '@/composables/emergency/useEmergencyCaseStatusCounts';
import { useEmergencyCases, type EmergencyCase } from '@/composables/emergency/useEmergencyCases';
import { type EmergencyCaseStatusTarget } from '@/composables/emergency/useUpdateEmergencyCaseStatus';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

/**
 * Phases 1-2 of reports/emergency-queue-modernization-plan.md: queue +
 * status workflow + case intake, over EmergencyTriageCaseModel — a fully
 * independent lifecycle from generic appointment triage (triage/Queue.vue's
 * job). Naming is deliberate: everything here says "Emergency", never
 * "Emergency Triage" — see the plan's §1 naming note for why. This page
 * reuses no appointments/reception composable at all (unlike triage/
 * clinician/reception, which share GetReceptionQueueUseCase) since
 * EmergencyTriageCase has its own repository, its own table, and only an
 * optional, uncoupled link to Appointment.
 *
 * This is the only page for the Emergency domain — /emergency-triage and
 * /emergency/queue both render this file (P0 of the Reception/Emergency/
 * Admission/Bed-Management audit follow-through brought this page to full
 * parity with the old emergency-triage/Index.vue, including transfers and
 * audit logs, and that file was deleted outright rather than kept around
 * as a legacy fallback).
 *
 * EmergencyCaseCreateSheet.vue (Phase 2) is deliberately NOT the legacy
 * page's 3-tab patient/appointment/admission context editor — a single
 * patient lookup plus the fields StoreEmergencyTriageCaseRequest actually
 * requires is enough for a fast ED intake; see that component's own
 * docblock.
 *
 * usePlatformAccess()-based computed() permission checks, <Head>/access-
 * gate/sticky-header-in-bounded-scroll-container conventions matching
 * every other V2 page.
 *
 * Sticky header: 4 KPI cards (Waiting/Triaged/In treatment/Total) backed by
 * useEmergencyCaseStatusCounts.ts. Tabs (All/Waiting/Triaged/In treatment)
 * drive the server-side status filter — admitted/discharged/cancelled are
 * reachable via "All" but have no dedicated tab in this phase; they're
 * closed-case history, not this queue's operational focus.
 *
 * Status-transition matrix (extracted from the legacy page's queue-row
 * button gating, emergency-triage/Index.vue:3400-3405 — the backend itself
 * enforces no transition graph, so this UI is the only place the semantics
 * live):
 * - waiting -> triaged, cancelled
 * - waiting/triaged -> in_treatment
 * - in_treatment -> admitted, discharged, cancelled
 * - any non-terminal -> cancelled
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canRead = computed(() => hasAccess('emergency.triage.read'));
const canCreate = computed(() => hasAccess('emergency.triage.create'));
const canUpdateStatus = computed(() => hasAccess('emergency.triage.update-status'));
const canManageTransfers = computed(() => hasAccess('emergency.triage.manage-transfers'));
const canViewAuditLogs = computed(() => hasAccess('emergency.triage.view-audit-logs'));

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Emergency queue', href: '/emergency/queue' },
]);

const filters = useEmergencyCaseFilters();
const list = useEmergencyCases(filters);
const statusCounts = useEmergencyCaseStatusCounts(filters);

const cases = computed(() => list.data.value?.data ?? []);
const meta = computed(() => list.data.value?.meta ?? null);

const patientIds = computed(() => cases.value.map((item) => item.patientId ?? '').filter(Boolean));
const patientDirectory = useEmergencyCasePatientDirectory(patientIds);

// P0a: rows expand in place instead of opening a detail drawer — see this
// file's own docblock and the plan's design-direction note for why (no
// hub/tabs, everything stays in the scannable queue context).
const expandedCaseIds = ref<Set<string>>(new Set());

function isExpanded(caseId: string): boolean {
    return expandedCaseIds.value.has(caseId);
}

function toggleExpanded(caseId: string, open: boolean): void {
    const next = new Set(expandedCaseIds.value);
    if (open) {
        next.add(caseId);
    } else {
        next.delete(caseId);
    }
    expandedCaseIds.value = next;
}

function setStatus(value: string | number): void {
    filters.status = value === 'all' ? '' : String(value);
    filters.page = 1;
}
function submitSearch(): void {
    filters.page = 1;
}

const triageLevelValue = computed({
    get: () => filters.triageLevel || 'all',
    set: (value: string) => {
        filters.triageLevel = value === 'all' ? '' : value;
        filters.page = 1;
    },
});

function statusVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'waiting':
            return 'outline';
        case 'triaged':
        case 'in_treatment':
            return 'default';
        case 'discharged':
        case 'admitted':
            return 'secondary';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function triageLevelClass(level: string | null): string {
    switch (level) {
        case 'red':
            return 'border-transparent bg-destructive text-white';
        case 'yellow':
            return 'border-transparent bg-amber-500 text-white dark:bg-amber-600';
        case 'green':
            return 'border-transparent bg-emerald-600 text-white dark:bg-emerald-700';
        case 'unassigned':
            // Auto-created by Mode C (CreateSkeletonEmergencyTriageCase) on
            // an emergency check-in — a real, visible-in-the-queue case
            // with no clinical assessment yet, not a real acuity level.
            // Deliberately distinct from every real color so it can't be
            // mistaken for a clinician's own red/yellow/green judgment.
            return 'border-dashed border-muted-foreground/50 bg-transparent text-muted-foreground';
        default:
            return '';
    }
}

function triageLevelLabel(level: string | null): string {
    return level === 'unassigned' ? 'Needs triage' : level || 'unset';
}

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function goToPage(page: number): void {
    filters.page = page;
}

/** Matches the legacy queue row's exact button gating — see this file's own docblock. */
type Transition = { target: EmergencyCaseStatusTarget; label: string; destructive: boolean };
function availableTransitions(status: string | null): Transition[] {
    switch (status) {
        case 'waiting':
            return [
                { target: 'triaged', label: 'Mark triaged', destructive: false },
                { target: 'cancelled', label: 'Cancel', destructive: true },
            ];
        case 'triaged':
            return [
                { target: 'in_treatment', label: 'Start treatment', destructive: false },
                { target: 'cancelled', label: 'Cancel', destructive: true },
            ];
        case 'in_treatment':
            return [
                { target: 'admitted', label: 'Admit', destructive: false },
                { target: 'discharged', label: 'Discharge', destructive: false },
                { target: 'cancelled', label: 'Cancel', destructive: true },
            ];
        default:
            return [];
    }
}

const queryClient = useQueryClient();

/**
 * P6 of the Reception/Emergency/Admission/Bed-Management audit
 * follow-through: an Emergency admit atomically creates a real Admission
 * server-side (UpdateEmergencyTriageCaseStatusUseCase), but this used to
 * only invalidate this page's own two query keys — an already-mounted
 * Admission V2 page or bed picker elsewhere had no push signal that a bed
 * had just been occupied. Mirrors admissions/IndexV2.vue's own
 * invalidateQueueAndCounts(), which already invalidates all three of these.
 */
async function invalidateQueueAndCounts(): Promise<void> {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['emergency-cases'] }),
        queryClient.invalidateQueries({ queryKey: ['emergency-case-status-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['admissions-index'] }),
        queryClient.invalidateQueries({ queryKey: ['admissions-index-status-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['available-beds'] }),
    ]);
}

const statusDialogOpen = ref(false);
const statusDialogTarget = ref<EmergencyStatusTarget | null>(null);
const statusDialogAction = ref<EmergencyCaseStatusTarget | null>(null);

function openStatusDialog(item: EmergencyCase, action: EmergencyCaseStatusTarget): void {
    statusDialogTarget.value = { caseId: item.id, caseNumber: item.caseNumber };
    statusDialogAction.value = action;
    statusDialogOpen.value = true;
}

async function onStatusUpdated(): Promise<void> {
    await invalidateQueueAndCounts();
}

const createSheetOpen = ref(false);

async function onCaseCreated(emergencyCase: EmergencyCase): Promise<void> {
    notifySuccess(`Emergency case ${emergencyCase.caseNumber ?? ''} created.`);
    await invalidateQueueAndCounts();
}

// P0c: one audit sheet reused across every row, same "single overlay,
// re-targeted" pattern as the status dialog above — not a per-row instance.
const auditSheetOpen = ref(false);
const auditSheetCaseId = ref<string | null>(null);
const auditSheetCaseNumber = ref<string | null>(null);
const caseAuditLog = useEmergencyCaseAuditLog(auditSheetCaseId);

function openAuditSheet(item: EmergencyCase): void {
    auditSheetCaseId.value = item.id;
    auditSheetCaseNumber.value = item.caseNumber;
    auditSheetOpen.value = true;
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Emergency Queue" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">Emergency Queue</h1>
                        <p class="text-xs text-muted-foreground">Active emergency department cases, arrival through disposition.</p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <Badge v-if="meta" variant="secondary">{{ meta.total }} cases</Badge>
                        <Button v-if="canCreate" size="sm" class="h-8 gap-1.5" @click="createSheetOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            New case
                        </Button>
                    </div>
                </div>

                <div v-if="canRead" class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Waiting</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.waiting ?? '—' }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Triaged</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.triaged ?? '—' }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">In treatment</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.in_treatment ?? '—' }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.total ?? '—' }}</p>
                    </div>
                </div>

                <Tabs v-if="canRead" :model-value="filters.status || 'all'" class="mt-3" @update:model-value="setStatus">
                    <TabsList class="grid w-full grid-cols-4">
                        <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                            All
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.total ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="waiting" class="inline-flex items-center gap-1.5">
                            Waiting
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.waiting ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="triaged" class="inline-flex items-center gap-1.5">
                            Triaged
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.triaged ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="in_treatment" class="inline-flex items-center gap-1.5">
                            In treatment
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.in_treatment ?? '—' }}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canRead" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing the emergency queue requires <code>emergency.triage.read</code>.</AlertDescription>
                </Alert>

                <template v-else>

                    <div class="flex flex-wrap items-start gap-2">
                        <div class="relative min-w-72 flex-1">
                            <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                v-model="filters.q"
                                placeholder="Search case #, chief complaint, or vitals…"
                                class="h-9 pl-9"
                                @keyup.enter="submitSearch"
                            />
                        </div>
                        <Select v-model="triageLevelValue">
                            <SelectTrigger class="h-9 w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All triage levels</SelectItem>
                                <SelectItem value="red">Red</SelectItem>
                                <SelectItem value="yellow">Yellow</SelectItem>
                                <SelectItem value="green">Green</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div v-if="list.isPending.value" class="space-y-2">
                        <Skeleton class="h-16 w-full" />
                        <Skeleton class="h-16 w-full" />
                        <Skeleton class="h-16 w-full" />
                    </div>

                    <Alert v-else-if="list.isError.value" variant="destructive">
                        <AlertTitle>Unable to load the emergency queue</AlertTitle>
                        <AlertDescription>{{ (list.error.value as Error | null)?.message ?? 'Unknown error.' }}</AlertDescription>
                    </Alert>

                    <div
                        v-else-if="cases.length === 0"
                        class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
                    >
                        No emergency cases found.
                    </div>

                    <ul v-else class="space-y-2">
                        <Collapsible
                            v-for="item in cases"
                            :key="item.id"
                            :open="isExpanded(item.id)"
                            as="li"
                            class="overflow-hidden rounded-lg border bg-card shadow-sm"
                            :class="item.triageLevel === 'red' ? 'border-destructive/40 bg-destructive/5' : ''"
                            @update:open="(open) => toggleExpanded(item.id, open)"
                        >
                            <div class="flex flex-wrap items-start justify-between gap-3 p-3">
                                <CollapsibleTrigger as-child>
                                    <div class="min-w-0 flex-1 cursor-pointer space-y-1.5 [&[data-state=open]_[data-slot=chevron]]:rotate-90">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <AppIcon data-slot="chevron" name="chevron-right" class="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200" />
                                            <span class="font-mono text-xs text-muted-foreground">{{ item.caseNumber || 'Case' }}</span>
                                            <Badge :variant="statusVariant(item.status)">{{ item.status || 'unknown' }}</Badge>
                                            <Badge :class="triageLevelClass(item.triageLevel)">{{ triageLevelLabel(item.triageLevel) }}</Badge>
                                            <ElapsedTimeBadge :since="item.triagedAt ?? item.arrivalAt" :warning-minutes="30" :critical-minutes="60" />
                                        </div>
                                        <div class="min-w-0 pl-5.5">
                                            <p class="truncate font-medium text-foreground">{{ patientDirectory.displayName(item.patientId) }}</p>
                                            <p class="truncate text-xs text-muted-foreground">
                                                {{ patientDirectory.patientNumber(item.patientId) || 'No MRN assigned' }}
                                            </p>
                                            <p class="text-xs text-muted-foreground">{{ item.chiefComplaint || 'No chief complaint recorded' }}</p>
                                            <p class="text-[11px] text-muted-foreground">Arrived {{ formatDateTime(item.arrivalAt) }}</p>
                                        </div>
                                    </div>
                                </CollapsibleTrigger>

                                <div v-if="canUpdateStatus" class="flex shrink-0 flex-wrap items-center justify-end gap-1">
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
                                </div>
                            </div>

                            <CollapsibleContent>
                                <div class="space-y-3 border-t bg-muted/10 px-3 py-3 pl-9">
                                    <div v-if="item.patientId" class="flex items-center gap-2">
                                        <PatientSummaryPopover :patient-id="item.patientId">
                                            <template #trigger>
                                                <button type="button" class="text-xs font-medium text-primary hover:underline">
                                                    Patient summary
                                                </button>
                                            </template>
                                            <template #actions>
                                                <a :href="`/patients/${item.patientId}/chart`" class="text-xs font-medium text-primary hover:underline">
                                                    View chart
                                                </a>
                                            </template>
                                        </PatientSummaryPopover>
                                    </div>
                                    <div class="grid gap-2 sm:grid-cols-2">
                                        <div>
                                            <p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Vitals summary</p>
                                            <p class="text-xs text-foreground">{{ item.vitalsSummary || 'Not recorded' }}</p>
                                        </div>
                                        <div>
                                            <p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Disposition notes</p>
                                            <p class="text-xs text-foreground">{{ item.dispositionNotes || 'None' }}</p>
                                        </div>
                                        <div v-if="item.statusReason">
                                            <p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Status reason</p>
                                            <p class="text-xs text-foreground">{{ item.statusReason }}</p>
                                        </div>
                                        <div v-if="item.triagedAt">
                                            <p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Triaged at</p>
                                            <p class="text-xs text-foreground">{{ formatDateTime(item.triagedAt) }}</p>
                                        </div>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-3">
                                        <a v-if="item.appointmentId" :href="`/appointments/${item.appointmentId}`" class="text-xs font-medium text-primary hover:underline">
                                            View linked appointment
                                        </a>
                                        <a v-if="item.admissionId" :href="`/admissions/${item.admissionId}`" class="text-xs font-medium text-primary hover:underline">
                                            View linked admission
                                        </a>
                                        <button
                                            v-if="canViewAuditLogs"
                                            type="button"
                                            class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                            @click="openAuditSheet(item)"
                                        >
                                            <AppIcon name="clock" class="size-3.5" />
                                            Activity
                                        </button>
                                    </div>

                                    <EmergencyCaseTransfersPanel
                                        v-if="isExpanded(item.id)"
                                        :case-id="item.id"
                                        :can-manage="canManageTransfers"
                                    />
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
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

        <EmergencyStatusDialog
            v-model:open="statusDialogOpen"
            :target="statusDialogTarget"
            :action="statusDialogAction"
            @updated="onStatusUpdated"
        />

        <EmergencyCaseCreateSheet v-model:open="createSheetOpen" @created="onCaseCreated" />

        <AuditLogSheet
            v-model:open="auditSheetOpen"
            title="Case activity"
            :subtitle="auditSheetCaseNumber ?? ''"
            :audit="caseAuditLog"
        />
    </AppLayout>
</template>
