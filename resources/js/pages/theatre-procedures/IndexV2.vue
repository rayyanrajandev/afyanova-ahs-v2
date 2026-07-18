<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import PatientQuickSearchField from '@/components/patients/PatientQuickSearchField.vue';
import { type PatientQuickSearchResult } from '@/composables/patients/usePatientQuickSearch';
import ClinicalLifecycleActionDialog from '@/components/orders/ClinicalLifecycleActionDialog.vue';
import AuditLogSheet from '@/components/shared/AuditLogSheet.vue';
import PatientSummaryPopover from '@/components/patients/summary/PatientSummaryPopover.vue';
import TheatreProcedureCreateSheet from '@/components/theatreProcedures/TheatreProcedureCreateSheet.vue';
import TheatreProcedureDetailSheet from '@/components/theatreProcedures/TheatreProcedureDetailSheet.vue';
import TheatreProcedureStatusUpdateDialog from '@/components/theatreProcedures/TheatreProcedureStatusUpdateDialog.vue';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { useTheatreProcedureFilters } from '@/composables/theatreProcedures/useTheatreProcedureFilters';
import { useTheatreProcedures, type TheatreProcedure, type TheatreProcedureStatus } from '@/composables/theatreProcedures/useTheatreProcedures';
import { useTheatreProcedureStatusCounts } from '@/composables/theatreProcedures/useTheatreProcedureStatusCounts';
import { useTheatreProcedureAuditLog } from '@/composables/theatreProcedures/useTheatreProcedureAuditLog';
import { useTheatreClinicianDirectory } from '@/composables/theatreProcedures/useTheatreClinicianDirectory';
import { useUpdateTheatreProcedureStatus, type UpdateTheatreProcedureStatusPayload } from '@/composables/theatreProcedures/useUpdateTheatreProcedureStatus';
import { useApplyTheatreProcedureLifecycleAction } from '@/composables/theatreProcedures/useApplyTheatreProcedureLifecycleAction';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

/**
 * Theatre/procedure worklist V2 — fourth and final of the planned
 * order-domain V2 builds (lab/pharmacy/radiology shipped+live). Replaces
 * theatre-procedures/Index.vue for the WORKLIST slice: search/filter,
 * status tabs, KPI tiles, and the pre-op/start/complete/lifecycle actions
 * theatre staff take on existing procedures.
 *
 * Order creation (Phase 3 of reports/order-creation-v2-modernization-plan.md):
 * TheatreProcedureCreateSheet.vue is deliberately quick-booking scope only
 * (procedure, operating clinician, schedule, free-text room name — no
 * conflict checking), matching TheatreInlineOrderForm.vue's own scope
 * exactly. Full OR room-registry booking with resource-conflict checking is
 * a whole separate sub-system with no analogue in lab/pharmacy/radiology —
 * per an explicit user decision, that stays on the legacy page ("Full
 * scheduling" link) even after this ships; unlike the other three order
 * types, this Sheet alone doesn't unblock deleting theatre's legacy page.
 *
 * Unlike the other three, there is no nested `patient` object on the
 * order (patient info arrives pre-flattened as patientLabel/patientNumber)
 * and no orderedBy clinician summary at all — so this page uses a flat
 * row list (not PatientOrderGroupList/usePatientOrderGroups, which expect
 * a shape this domain's API doesn't produce) and resolves the two named
 * surgical-role ids (operatingClinicianUserId/anesthetistUserId) via a
 * separate clinician-directory lookup, fetched once.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canRead = computed(() => hasAccess('theatre.procedures.read'));
const canUpdateStatus = computed(() => hasAccess('theatre.procedures.update-status'));
const canApplyLifecycleAction = computed(() => hasAccess('theatre.procedures.create'));
const canCreate = computed(() => hasAccess('theatre.procedures.create'));
const canViewAuditLogs = computed(() => hasAccess('theatre.procedures.view-resource-audit-logs'));

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Theatre worklist', href: '/theatre-procedures' },
]);

const filters = useTheatreProcedureFilters();

// Deep-link support for cross-page "open the theatre worklist filtered/
// focused on X" links, matching the other three V2 pages' convention.
const initialSearchParams = new URLSearchParams(window.location.search);
const initialPatientId = initialSearchParams.get('patientId') ?? '';
if (initialPatientId) {
    filters.patientId = initialPatientId;
}
const initialStatus = initialSearchParams.get('status') ?? '';
if (initialStatus) {
    filters.status = initialStatus;
}
const focusOrderId = initialSearchParams.get('focusOrderId') ?? '';

const list = useTheatreProcedures(filters);
const statusCounts = useTheatreProcedureStatusCounts(filters);
const { nameById: clinicianNameById } = useTheatreClinicianDirectory();
const queryClient = useQueryClient();

const createSheetOpen = ref(false);

function onProcedureCreated(procedureNumber: string): void {
    void queryClient.invalidateQueries({ queryKey: ['theatre-procedures-index'] });
    void queryClient.invalidateQueries({ queryKey: ['theatre-procedures-status-counts'] });
    notifySuccess(`Booked ${procedureNumber}.`);
}

const orders = computed<TheatreProcedure[]>(() => list.data.value?.data ?? []);

const statusOptions: Array<{ value: TheatreProcedureStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'planned', label: 'Planned' },
    { value: 'in_preop', label: 'Pre-op' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
];

function statusCount(status: TheatreProcedureStatus | 'all'): number | null {
    if (!statusCounts.data.value) return null;
    if (status === 'all') return statusCounts.data.value.total;
    return statusCounts.data.value[status] ?? null;
}

// status-counts has no derived buckets — Open is summed client-side from
// the three open statuses, same pattern as the other three V2 pages.
const openCount = computed<number | null>(() => {
    if (!statusCounts.data.value) return null;
    return statusCounts.data.value.planned + statusCounts.data.value.in_preop + statusCounts.data.value.in_progress;
});

function setStatus(value: string | number): void {
    filters.status = value === 'all' ? '' : String(value);
    filters.page = 1;
}

async function invalidateTheatreQueries(): Promise<void> {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['theatre-procedures-index'] }),
        queryClient.invalidateQueries({ queryKey: ['theatre-procedures-status-counts'] }),
    ]);
}

const patientSearchQuery = ref('');

function onPatientSelected(patient: PatientQuickSearchResult | null): void {
    filters.patientId = patient?.id ?? '';
    filters.page = 1;
}

function resetFilters(): void {
    filters.q = '';
    filters.patientId = '';
    patientSearchQuery.value = '';
    filters.status = '';
    filters.from = '';
    filters.to = '';
    filters.page = 1;
}

const { scrollContainerHeight } = useStickyScrollContainer();

function statusBadgeVariant(status: TheatreProcedureStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'completed':
            return 'default';
        case 'cancelled':
            return 'destructive';
        case 'in_progress':
        case 'in_preop':
            return 'secondary';
        default:
            return 'outline';
    }
}

function orderLabel(order: TheatreProcedure): string {
    return order.procedureName || order.procedureType || 'Theatre procedure';
}

function clinicianLabel(userId: number | null): string | null {
    if (userId === null) return null;
    return clinicianNameById.value[userId] ?? `Clinician #${userId}`;
}

function formatScheduledAt(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

/**
 * The row's primary action, driven directly by ClinicalCurrentCare::theatre()
 * (order.currentCare.nextAction) — no hidden gate, same as lab/radiology.
 * There's only one key ('review_case') for every stage; the label alone
 * distinguishes them, so the actual dialog intent is derived from
 * order.status. The terminal "Review completed case" state always opens
 * the detail sheet instead — there's nothing to submit there.
 */
function statusUpdateIntent(order: TheatreProcedure): 'move_to_preop' | 'start_procedure' | 'complete' {
    switch (order.status) {
        case 'in_preop':
            return 'start_procedure';
        case 'in_progress':
            return 'complete';
        default:
            return 'move_to_preop';
    }
}

function primaryActionHandler(order: TheatreProcedure): (() => void) | null {
    if (order.currentCare?.nextAction?.key !== 'review_case') return null;
    if (order.status === 'completed') return () => openDetail(order);
    return () => openStatusUpdateDialog(order, statusUpdateIntent(order));
}

function primaryActionButtonVariant(order: TheatreProcedure): 'default' | 'destructive' | 'outline' {
    switch (order.currentCare?.nextAction?.emphasis) {
        case 'warning':
            return 'destructive';
        case 'secondary':
            return 'outline';
        default:
            return 'default';
    }
}

function primaryActionAllowed(order: TheatreProcedure): boolean {
    if (order.currentCare?.nextAction?.key !== 'review_case') return true;
    return order.status === 'completed' ? true : canUpdateStatus.value;
}

const actionLoadingId = ref<string | null>(null);

/* Detail sheet */
const detailOrder = ref<TheatreProcedure | null>(null);
const detailOpen = ref(false);

function openDetail(order: TheatreProcedure): void {
    detailOrder.value = order;
    detailOpen.value = true;
}

if (focusOrderId) {
    const stopFocusWatch = watch(orders, (list) => {
        const match = list.find((order) => order.id === focusOrderId);
        if (!match) return;
        openDetail(match);
        stopFocusWatch();
    });
}

/* Status update dialog (move to pre-op / start / complete) */
const statusDialogOpen = ref(false);
const statusDialogOrder = ref<TheatreProcedure | null>(null);
const statusDialogIntent = ref<'move_to_preop' | 'start_procedure' | 'complete' | null>(null);
const statusDialogError = ref<string | null>(null);

function openStatusUpdateDialog(order: TheatreProcedure, intent: 'move_to_preop' | 'start_procedure' | 'complete'): void {
    statusDialogOrder.value = order;
    statusDialogIntent.value = intent;
    statusDialogError.value = null;
    statusDialogOpen.value = true;
}

const updateStatusMutation = useUpdateTheatreProcedureStatus();

async function submitStatusUpdateDialog(payload: Omit<UpdateTheatreProcedureStatusPayload, 'id'>): Promise<void> {
    const order = statusDialogOrder.value;
    if (!order) return;

    statusDialogError.value = null;
    actionLoadingId.value = order.id;
    try {
        await updateStatusMutation.mutateAsync({ id: order.id, ...payload });
        await invalidateTheatreQueries();
        notifySuccess(`${orderLabel(order)} updated to ${formatEnumLabel(payload.status)}.`);
        statusDialogOpen.value = false;
        statusDialogOrder.value = null;
        statusDialogIntent.value = null;
    } catch (error) {
        statusDialogError.value = messageFromUnknown(error, 'Unable to update this procedure.');
        notifyError(statusDialogError.value);
    } finally {
        actionLoadingId.value = null;
    }
}

/* Lifecycle (cancel / entered-in-error) dialog */
const lifecycleDialogOpen = ref(false);
const lifecycleDialogOrder = ref<TheatreProcedure | null>(null);
const lifecycleDialogAction = ref<'cancel' | 'entered_in_error' | null>(null);
const lifecycleDialogReason = ref('');
const lifecycleDialogError = ref<string | null>(null);

function openLifecycleDialog(order: TheatreProcedure, action: 'cancel' | 'entered_in_error'): void {
    lifecycleDialogOrder.value = order;
    lifecycleDialogAction.value = action;
    lifecycleDialogReason.value = '';
    lifecycleDialogError.value = null;
    lifecycleDialogOpen.value = true;
}

function closeLifecycleDialog(): void {
    lifecycleDialogOpen.value = false;
    lifecycleDialogOrder.value = null;
    lifecycleDialogAction.value = null;
    lifecycleDialogReason.value = '';
    lifecycleDialogError.value = null;
}

const lifecycleActionMutation = useApplyTheatreProcedureLifecycleAction();

async function submitLifecycleDialog(): Promise<void> {
    const order = lifecycleDialogOrder.value;
    const action = lifecycleDialogAction.value;
    if (!order || !action) return;

    const reason = lifecycleDialogReason.value.trim();
    if (!reason) {
        lifecycleDialogError.value = 'Clinical reason is required.';
        return;
    }

    lifecycleDialogError.value = null;
    actionLoadingId.value = order.id;
    try {
        await lifecycleActionMutation.mutateAsync({ id: order.id, action, reason });
        await invalidateTheatreQueries();
        notifySuccess(action === 'cancel' ? `${orderLabel(order)} cancelled.` : `${orderLabel(order)} marked entered in error.`);
        closeLifecycleDialog();
    } catch (error) {
        lifecycleDialogError.value = messageFromUnknown(error, 'Unable to apply this action.');
        notifyError(lifecycleDialogError.value);
    } finally {
        actionLoadingId.value = null;
    }
}

/* Audit log sheet */
const auditSheetOpen = ref(false);
const auditSheetOrder = ref<TheatreProcedure | null>(null);
const auditOrderId = computed(() => auditSheetOrder.value?.id ?? null);
const auditLog = useTheatreProcedureAuditLog(auditOrderId);

function openAuditSheet(order: TheatreProcedure): void {
    auditSheetOrder.value = order;
    auditSheetOpen.value = true;
}
</script>

<template>
    <Head title="Theatre Worklist" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <Tabs :model-value="filters.status || 'all'" class="contents" @update:model-value="setStatus">
                <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0 space-y-0.5">
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Theatre Worklist</h1>
                            <p class="text-xs text-muted-foreground">Move procedures through pre-op, in progress, and completion.</p>
                        </div>
                        <div class="flex shrink-0 items-center gap-2">
                            <Badge variant="secondary">{{ statusCount('all') ?? '—' }} procedures</Badge>
                            <Button variant="outline" size="sm" class="h-8 gap-1.5" @click="resetFilters">
                                Clear filters
                            </Button>
                            <Button v-if="canCreate" as-child variant="ghost" size="sm" class="h-8 gap-1.5 text-muted-foreground">
                                <Link href="/theatre-procedures/legacy">
                                    Full scheduling
                                </Link>
                            </Button>
                            <Button v-if="canCreate" variant="outline" size="sm" class="h-8 gap-1.5" @click="createSheetOpen = true">
                                <AppIcon name="plus" class="size-3.5" />
                                Schedule procedure
                            </Button>
                        </div>
                    </div>

                    <div v-if="canRead" class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCount('all') ?? '—' }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Open</p>
                            <p class="text-sm font-bold tabular-nums">{{ openCount ?? '—' }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Completed</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCount('completed') ?? '—' }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Cancelled</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCount('cancelled') ?? '—' }}</p>
                        </div>
                    </div>

                    <TabsList v-if="canRead" class="mt-3 grid w-full grid-cols-3 sm:grid-cols-6">
                        <TabsTrigger
                            v-for="option in statusOptions"
                            :key="option.value"
                            :value="option.value"
                            class="inline-flex items-center gap-1.5"
                        >
                            {{ option.label }}
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                                {{ statusCount(option.value) ?? '—' }}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>

                    <div v-if="canRead" class="mt-3 flex flex-wrap items-end gap-2">
                        <div class="relative min-w-64 flex-1">
                            <Input
                                v-model="filters.q"
                                placeholder="Search by procedure number, name, patient…"
                                class="h-9"
                                @update:model-value="filters.page = 1"
                            />
                        </div>
                        <div class="min-w-64">
                            <PatientQuickSearchField
                                v-model:query="patientSearchQuery"
                                input-id="theatre-worklist-patient"
                                placeholder="Search patient by name, MRN, or phone…"
                                @selected="onPatientSelected"
                            />
                        </div>
                        <DateRangeFilterPopover
                            input-base-id="theatre-worklist-date-range"
                            title="Scheduled date range"
                            :from="filters.from"
                            :to="filters.to"
                            @update:from="(value) => { filters.from = value; filters.page = 1; }"
                            @update:to="(value) => { filters.to = value; filters.page = 1; }"
                        />
                    </div>
                </div>

                <div class="space-y-4 px-6 pb-6">
                    <Alert v-if="!canRead" variant="destructive">
                        <AlertTitle>Access required</AlertTitle>
                        <AlertDescription>Viewing the theatre worklist requires <code>theatre.procedures.read</code>.</AlertDescription>
                    </Alert>

                    <template v-else>
                        <div v-if="list.isPending.value" class="space-y-2">
                            <Skeleton class="h-16 w-full" />
                            <Skeleton class="h-16 w-full" />
                            <Skeleton class="h-16 w-full" />
                        </div>

                        <Alert v-else-if="list.isError.value" variant="destructive">
                            <AlertTitle>Unable to load the theatre worklist</AlertTitle>
                            <AlertDescription>{{ list.error.value?.message ?? 'Unknown error.' }}</AlertDescription>
                        </Alert>

                        <div
                            v-else-if="orders.length === 0"
                            class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
                        >
                            No theatre procedures match these filters.
                        </div>

                        <div v-else class="space-y-2">
                            <div
                                v-for="order in orders"
                                :key="order.id"
                                class="rounded-lg border bg-card px-3.5 py-2.5 shadow-sm transition-colors"
                            >
                                <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                    <!-- Plain clickable div, not a <button>: the patient-name popover
                                         trigger below needs to be its own independently-focusable
                                         control in this same block, and nesting one interactive
                                         element inside another is invalid/unreliable for AT and
                                         keyboard users (see reports/v2-navigation-actions-ux-audit.md
                                         §8.1/§11.1). The procedure name is its own real sibling
                                         <button> so keyboard users have a direct way to open detail;
                                         the div's own @click is a mouse-only convenience layered on
                                         top. -->
                                    <div class="min-w-0 flex-1 cursor-pointer space-y-1" @click="openDetail(order)">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <button type="button" class="truncate text-left text-sm font-medium text-foreground hover:underline" @click.stop="openDetail(order)">
                                                {{ orderLabel(order) }}
                                            </button>
                                            <Badge :variant="statusBadgeVariant(order.status)" class="text-[10px] leading-none">
                                                {{ formatEnumLabel(order.status) }}
                                            </Badge>
                                            <Badge v-if="order.theatreRoomName" variant="outline" class="text-[10px] leading-none">
                                                {{ order.theatreRoomName }}
                                            </Badge>
                                        </div>
                                        <p class="text-xs text-muted-foreground">
                                            <PatientSummaryPopover v-if="order.patientId" :patient-id="order.patientId">
                                                <template #trigger>
                                                    <button type="button" class="hover:underline" @click.stop>
                                                        {{ order.patientLabel || order.patientNumber || 'Unknown patient' }}
                                                    </button>
                                                </template>
                                                <template #actions>
                                                    <Link :href="`/patients/${order.patientId}/chart`" class="text-xs font-medium text-primary hover:underline">
                                                        View chart
                                                    </Link>
                                                </template>
                                            </PatientSummaryPopover>
                                            <span v-else>{{ order.patientLabel || order.patientNumber || 'Unknown patient' }}</span>
                                            <span v-if="clinicianLabel(order.operatingClinicianUserId)"> · {{ clinicianLabel(order.operatingClinicianUserId) }}</span>
                                            <span> · {{ formatScheduledAt(order.scheduledAt) }}</span>
                                        </p>
                                    </div>
                                    <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                                        <Button
                                            v-if="order.currentCare?.nextAction && primaryActionAllowed(order)"
                                            size="sm"
                                            :variant="primaryActionButtonVariant(order)"
                                            class="h-7 px-2 text-xs"
                                            :disabled="actionLoadingId === order.id"
                                            @click="primaryActionHandler(order)?.()"
                                        >
                                            {{ order.currentCare?.nextAction?.label }}
                                        </Button>
                                        <!-- Cancel + audit log are lower-frequency than the primary
                                             lifecycle action — folded into one overflow menu instead of
                                             three simultaneous row buttons. -->
                                        <DropdownMenu
                                            v-if="
                                                (canApplyLifecycleAction && order.status !== 'cancelled' && order.status !== 'completed' && !order.enteredInErrorAt) ||
                                                canViewAuditLogs
                                            "
                                        >
                                            <DropdownMenuTrigger as-child>
                                                <Button size="sm" variant="outline" class="h-7 px-2 text-xs" :disabled="actionLoadingId === order.id">More</Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" class="w-40">
                                                <DropdownMenuItem
                                                    v-if="canApplyLifecycleAction && order.status !== 'cancelled' && order.status !== 'completed' && !order.enteredInErrorAt"
                                                    class="cursor-pointer text-sm text-destructive"
                                                    @select="openLifecycleDialog(order, 'cancel')"
                                                >
                                                    Cancel
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    v-if="canViewAuditLogs"
                                                    class="cursor-pointer text-sm"
                                                    @select="openAuditSheet(order)"
                                                >
                                                    View audit log
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
            </Tabs>
        </div>

        <TheatreProcedureCreateSheet v-model:open="createSheetOpen" @created="onProcedureCreated" />

        <TheatreProcedureDetailSheet v-model:open="detailOpen" :order="detailOrder" :clinician-name-by-id="clinicianNameById" />

        <TheatreProcedureStatusUpdateDialog
            :open="statusDialogOpen"
            :order="statusDialogOrder"
            :intent="statusDialogIntent"
            :loading="actionLoadingId === statusDialogOrder?.id"
            :error="statusDialogError"
            @update:open="statusDialogOpen = $event"
            @submit="submitStatusUpdateDialog"
        />

        <ClinicalLifecycleActionDialog
            :open="lifecycleDialogOpen"
            :action="lifecycleDialogAction"
            :order-label="lifecycleDialogOrder ? orderLabel(lifecycleDialogOrder) : 'Theatre procedure'"
            subject-label="theatre procedure"
            :reason="lifecycleDialogReason"
            :loading="actionLoadingId === lifecycleDialogOrder?.id"
            :error="lifecycleDialogError"
            @update:open="(open) => (open ? (lifecycleDialogOpen = true) : closeLifecycleDialog())"
            @update:reason="lifecycleDialogReason = $event"
            @submit="submitLifecycleDialog"
        />

        <AuditLogSheet
            v-if="auditSheetOrder"
            v-model:open="auditSheetOpen"
            title="Theatre procedure audit log"
            :subtitle="orderLabel(auditSheetOrder)"
            :audit="auditLog"
        />
    </AppLayout>
</template>
