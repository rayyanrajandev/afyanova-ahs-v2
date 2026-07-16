<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import PatientQuickSearchField from '@/components/patients/PatientQuickSearchField.vue';
import { type PatientQuickSearchResult } from '@/composables/patients/usePatientQuickSearch';
import PatientOrderGroupList from '@/components/orders/PatientOrderGroupList.vue';
import ClinicalLifecycleActionDialog from '@/components/orders/ClinicalLifecycleActionDialog.vue';
import AuditLogSheet from '@/components/shared/AuditLogSheet.vue';
import LaboratoryOrderCreateSheet from '@/components/laboratoryOrders/LaboratoryOrderCreateSheet.vue';
import LaboratoryOrderDetailSheet from '@/components/laboratoryOrders/LaboratoryOrderDetailSheet.vue';
import LaboratoryStatusUpdateDialog from '@/components/laboratoryOrders/LaboratoryStatusUpdateDialog.vue';
import LaboratoryVerifyResultDialog from '@/components/laboratoryOrders/LaboratoryVerifyResultDialog.vue';
import { usePatientOrderGroups } from '@/composables/usePatientOrderGroups';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { useLaboratoryOrderFilters } from '@/composables/laboratoryOrders/useLaboratoryOrderFilters';
import {
    useLaboratoryOrders,
    type LaboratoryOrder,
    type LaboratoryOrderPriority,
    type LaboratoryOrderStatus,
} from '@/composables/laboratoryOrders/useLaboratoryOrders';
import { useLaboratoryOrderStatusCounts } from '@/composables/laboratoryOrders/useLaboratoryOrderStatusCounts';
import { useLaboratoryOrderAuditLog } from '@/composables/laboratoryOrders/useLaboratoryOrderAuditLog';
import { useUpdateLaboratoryOrderStatus, type UpdateLaboratoryOrderStatusPayload } from '@/composables/laboratoryOrders/useUpdateLaboratoryOrderStatus';
import { useVerifyLaboratoryOrderResult, type VerifyLaboratoryOrderResultPayload } from '@/composables/laboratoryOrders/useVerifyLaboratoryOrderResult';
import { useApplyLaboratoryOrderLifecycleAction } from '@/composables/laboratoryOrders/useApplyLaboratoryOrderLifecycleAction';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

/**
 * Laboratory worklist V2 — second of four planned order-domain V2 builds
 * (lab/pharmacy/imaging/theatre), mirroring pharmacy-orders/IndexV2.vue's
 * shape. Replaces laboratory-orders/Index.vue for the WORKLIST slice:
 * search/filter, status tabs, KPI tiles, and the collect/process/complete
 * result/verify/lifecycle actions lab staff take on existing orders.
 *
 * Order creation (Phase 4 of reports/order-creation-v2-modernization-plan.md):
 * LaboratoryOrderCreateSheet.vue preserves the legacy page's draft->sign
 * two-step (one user-facing "Place order" action, two backend calls under
 * the hood) rather than collapsing it to one step — a deliberate decision,
 * not an oversight, since that's real existing behavior. No basket mode
 * (multi-test queueing) yet — scoped as a separate fast-follow phase.
 *
 * Unlike pharmacy, ClinicalCurrentCare::laboratory()'s nextAction has no
 * hidden gate to layer on top — it's consumed directly, no effectiveNextAction
 * wrapper needed. Also unlike pharmacy, there's no policy/reconciliation step,
 * so this page has three action dialogs (status update, verify, lifecycle)
 * instead of pharmacy's five.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canRead = computed(() => hasAccess('laboratory.orders.read'));
const canUpdateStatus = computed(() => hasAccess('lab.sample.collect'));
const canVerifyResult = computed(() => hasAccess('lab.result.verify'));
const canApplyLifecycleAction = computed(() => hasAccess('lab.order'));
const canCreate = computed(() => hasAccess('lab.order'));
const canViewAuditLogs = computed(() => hasAccess('laboratory.orders.audit-logs.view'));

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Laboratory worklist', href: '/laboratory-orders' },
]);

const filters = useLaboratoryOrderFilters();

// Deep-link support for cross-page "open the lab worklist filtered/focused
// on X" links, matching pharmacy-orders/IndexV2.vue's convention.
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
const focusPatientId = computed(() => filters.patientId);

const list = useLaboratoryOrders(filters);
const statusCounts = useLaboratoryOrderStatusCounts(filters);
const queryClient = useQueryClient();

const orders = computed<LaboratoryOrder[]>(() => list.data.value?.data ?? []);

const { patientOrderGroups, useGroupedQueueView, isPatientGroupExpanded, setPatientGroupExpanded } = usePatientOrderGroups<LaboratoryOrder>(
    orders,
    'laboratory',
    focusPatientId,
);

const statusOptions: Array<{ value: LaboratoryOrderStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'ordered', label: 'Ordered' },
    { value: 'collected', label: 'Collected' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
];

const priorityOptions: Array<{ value: '' | LaboratoryOrderPriority; label: string }> = [
    { value: '', label: 'All priorities' },
    { value: 'routine', label: 'Routine' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'stat', label: 'STAT' },
];

function statusCount(status: LaboratoryOrderStatus | 'all'): number | null {
    if (!statusCounts.data.value) return null;
    if (status === 'all') return statusCounts.data.value.total;
    return statusCounts.data.value[status] ?? null;
}

// status-counts has no derived buckets (unlike pharmacy's reconciliation
// counts) — Open is summed client-side from the three open statuses.
const openCount = computed<number | null>(() => {
    if (!statusCounts.data.value) return null;
    return statusCounts.data.value.ordered + statusCounts.data.value.collected + statusCounts.data.value.in_progress;
});

function setStatus(value: string | number): void {
    filters.status = value === 'all' ? '' : String(value);
    filters.page = 1;
}

async function invalidateLaboratoryQueries(): Promise<void> {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['laboratory-orders-index'] }),
        queryClient.invalidateQueries({ queryKey: ['laboratory-orders-status-counts'] }),
    ]);
}

const createSheetOpen = ref(false);

function onOrderCreated(orderNumber: string): void {
    void invalidateLaboratoryQueries();
    notifySuccess(`Placed ${orderNumber}.`);
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
    filters.priority = '';
    filters.from = '';
    filters.to = '';
    filters.page = 1;
}

const { scrollContainerHeight } = useStickyScrollContainer();

function statusBadgeVariant(status: LaboratoryOrderStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'completed':
            return 'default';
        case 'cancelled':
            return 'destructive';
        case 'in_progress':
            return 'secondary';
        default:
            return 'outline';
    }
}

function priorityBadgeClass(priority: LaboratoryOrderPriority | null): string {
    switch (priority) {
        case 'stat':
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        case 'urgent':
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
        default:
            return '';
    }
}

function orderLabel(order: LaboratoryOrder): string {
    const code = (order.testCode ?? '').trim();
    const name = (order.testName ?? '').trim();
    if (code && name) return `${code} - ${name}`;
    return name || code || 'Laboratory test';
}

/**
 * The row's primary action, driven directly by the server's own
 * ClinicalCurrentCare::laboratory() computation (order.currentCare.nextAction)
 * — no client-side gate-layering needed here (unlike pharmacy's
 * effectiveNextAction, which had to account for a hidden formulary-review
 * gate not reflected in currentCare).
 *
 * 'review_order' covers three distinct dialog intents (collect/start
 * processing/complete) that all share this one key — the label alone
 * distinguishes them, so the actual intent is derived from order.status.
 * 'review_result' covers both "needs verification" and "already verified,
 * just viewing" — order.verifiedAt distinguishes those.
 */
function statusUpdateIntent(order: LaboratoryOrder): 'collect' | 'start_processing' | 'complete' {
    switch (order.status) {
        case 'collected':
            return 'start_processing';
        case 'in_progress':
            return 'complete';
        default:
            return 'collect';
    }
}

function primaryActionHandler(order: LaboratoryOrder): (() => void) | null {
    switch (order.currentCare?.nextAction?.key) {
        case 'review_order':
            return () => openStatusUpdateDialog(order, statusUpdateIntent(order));
        case 'review_result':
            return order.verifiedAt ? () => openDetail(order) : () => openVerifyDialog(order);
        default:
            return null;
    }
}

function primaryActionButtonVariant(order: LaboratoryOrder): 'default' | 'destructive' | 'outline' {
    switch (order.currentCare?.nextAction?.emphasis) {
        case 'warning':
            return 'destructive';
        case 'secondary':
            return 'outline';
        default:
            return 'default';
    }
}

function primaryActionAllowed(order: LaboratoryOrder): boolean {
    switch (order.currentCare?.nextAction?.key) {
        case 'review_order':
            return canUpdateStatus.value;
        case 'review_result':
            return order.verifiedAt ? true : canVerifyResult.value;
        default:
            return true;
    }
}

const actionLoadingId = ref<string | null>(null);

/* Detail sheet */
const detailOrder = ref<LaboratoryOrder | null>(null);
const detailOpen = ref(false);

function openDetail(order: LaboratoryOrder): void {
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

/* Status update dialog (collect / start processing / complete) */
const statusDialogOpen = ref(false);
const statusDialogOrder = ref<LaboratoryOrder | null>(null);
const statusDialogIntent = ref<'collect' | 'start_processing' | 'complete' | null>(null);
const statusDialogError = ref<string | null>(null);

function openStatusUpdateDialog(order: LaboratoryOrder, intent: 'collect' | 'start_processing' | 'complete'): void {
    statusDialogOrder.value = order;
    statusDialogIntent.value = intent;
    statusDialogError.value = null;
    statusDialogOpen.value = true;
}

const updateStatusMutation = useUpdateLaboratoryOrderStatus();

async function submitStatusUpdateDialog(payload: Omit<UpdateLaboratoryOrderStatusPayload, 'id'>): Promise<void> {
    const order = statusDialogOrder.value;
    if (!order) return;

    statusDialogError.value = null;
    actionLoadingId.value = order.id;
    try {
        await updateStatusMutation.mutateAsync({ id: order.id, ...payload });
        await invalidateLaboratoryQueries();
        notifySuccess(`${orderLabel(order)} updated to ${formatEnumLabel(payload.status)}.`);
        statusDialogOpen.value = false;
        statusDialogOrder.value = null;
        statusDialogIntent.value = null;
    } catch (error) {
        statusDialogError.value = messageFromUnknown(error, 'Unable to update this order.');
        notifyError(statusDialogError.value);
    } finally {
        actionLoadingId.value = null;
    }
}

/* Verify result dialog */
const verifyDialogOpen = ref(false);
const verifyDialogOrder = ref<LaboratoryOrder | null>(null);
const verifyDialogError = ref<string | null>(null);

function openVerifyDialog(order: LaboratoryOrder): void {
    verifyDialogOrder.value = order;
    verifyDialogError.value = null;
    verifyDialogOpen.value = true;
}

const verifyResultMutation = useVerifyLaboratoryOrderResult();

async function submitVerifyDialog(payload: Omit<VerifyLaboratoryOrderResultPayload, 'id'>): Promise<void> {
    const order = verifyDialogOrder.value;
    if (!order) return;

    verifyDialogError.value = null;
    actionLoadingId.value = order.id;
    try {
        await verifyResultMutation.mutateAsync({ id: order.id, ...payload });
        await invalidateLaboratoryQueries();
        notifySuccess(`${orderLabel(order)} verified.`);
        verifyDialogOpen.value = false;
        verifyDialogOrder.value = null;
    } catch (error) {
        verifyDialogError.value = messageFromUnknown(error, 'Unable to verify this result.');
        notifyError(verifyDialogError.value);
    } finally {
        actionLoadingId.value = null;
    }
}

/* Lifecycle (cancel / entered-in-error) dialog */
const lifecycleDialogOpen = ref(false);
const lifecycleDialogOrder = ref<LaboratoryOrder | null>(null);
const lifecycleDialogAction = ref<'cancel' | 'entered_in_error' | null>(null);
const lifecycleDialogReason = ref('');
const lifecycleDialogError = ref<string | null>(null);

function openLifecycleDialog(order: LaboratoryOrder, action: 'cancel' | 'entered_in_error'): void {
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

const lifecycleActionMutation = useApplyLaboratoryOrderLifecycleAction();

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
        await invalidateLaboratoryQueries();
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
const auditSheetOrder = ref<LaboratoryOrder | null>(null);
const auditOrderId = computed(() => auditSheetOrder.value?.id ?? null);
const auditLog = useLaboratoryOrderAuditLog(auditOrderId);

function openAuditSheet(order: LaboratoryOrder): void {
    auditSheetOrder.value = order;
    auditSheetOpen.value = true;
}
</script>

<template>
    <Head title="Laboratory Worklist" />
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
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Laboratory Worklist</h1>
                            <p class="text-xs text-muted-foreground">Collect, process, and verify laboratory orders.</p>
                        </div>
                        <div class="flex shrink-0 items-center gap-2">
                            <Badge variant="secondary">{{ statusCount('all') ?? '—' }} orders</Badge>
                            <Button variant="outline" size="sm" class="h-8 gap-1.5" @click="resetFilters">
                                Clear filters
                            </Button>
                            <Button v-if="canCreate" variant="outline" size="sm" class="h-8 gap-1.5" @click="createSheetOpen = true">
                                <AppIcon name="plus" class="size-3.5" />
                                Create order
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
                </div>

                <div class="space-y-4 px-6 pb-6">
                    <Alert v-if="!canRead" variant="destructive">
                        <AlertTitle>Access required</AlertTitle>
                        <AlertDescription>Viewing the laboratory worklist requires <code>laboratory.orders.read</code>.</AlertDescription>
                    </Alert>

                    <template v-else>
                        <div class="flex flex-wrap items-end gap-2">
                            <div class="relative min-w-64 flex-1">
                                <Input
                                    v-model="filters.q"
                                    placeholder="Search by order number, test, patient…"
                                    class="h-9"
                                    @update:model-value="filters.page = 1"
                                />
                            </div>
                            <div class="min-w-64">
                                <PatientQuickSearchField
                                    v-model:query="patientSearchQuery"
                                    input-id="laboratory-worklist-patient"
                                    placeholder="Search patient by name, MRN, or phone…"
                                    @selected="onPatientSelected"
                                />
                            </div>
                            <div class="w-40">
                                <Select :model-value="filters.priority || 'all'" @update:model-value="(value) => { filters.priority = value === 'all' ? '' : (value as LaboratoryOrderPriority); filters.page = 1; }">
                                    <SelectTrigger class="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="option in priorityOptions" :key="option.value || 'all'" :value="option.value || 'all'">
                                            {{ option.label }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DateRangeFilterPopover
                                input-base-id="laboratory-worklist-date-range"
                                title="Order date range"
                                :from="filters.from"
                                :to="filters.to"
                                @update:from="(value) => { filters.from = value; filters.page = 1; }"
                                @update:to="(value) => { filters.to = value; filters.page = 1; }"
                            />
                        </div>

                        <div v-if="list.isPending.value" class="space-y-2">
                            <Skeleton class="h-16 w-full" />
                            <Skeleton class="h-16 w-full" />
                            <Skeleton class="h-16 w-full" />
                        </div>

                        <Alert v-else-if="list.isError.value" variant="destructive">
                            <AlertTitle>Unable to load the laboratory worklist</AlertTitle>
                            <AlertDescription>{{ list.error.value?.message ?? 'Unknown error.' }}</AlertDescription>
                        </Alert>

                        <div
                            v-else-if="orders.length === 0"
                            class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
                        >
                            No laboratory orders match these filters.
                        </div>

                        <PatientOrderGroupList
                            v-else-if="useGroupedQueueView"
                            :groups="patientOrderGroups"
                            :is-expanded="isPatientGroupExpanded"
                            @update:expanded="setPatientGroupExpanded"
                        >
                            <template #orders="{ group }">
                                <div
                                    v-for="order in group.orders"
                                    :key="order.id"
                                    class="rounded-lg border bg-card px-3.5 py-2.5 shadow-sm transition-colors"
                                >
                                    <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                        <button type="button" class="min-w-0 flex-1 space-y-1 text-left" @click="openDetail(order)">
                                            <div class="flex flex-wrap items-center gap-2">
                                                <p class="truncate text-sm font-medium text-foreground">{{ orderLabel(order) }}</p>
                                                <Badge :variant="statusBadgeVariant(order.status)" class="text-[10px] leading-none">
                                                    {{ formatEnumLabel(order.status) }}
                                                </Badge>
                                                <Badge v-if="order.priority && order.priority !== 'routine'" :class="priorityBadgeClass(order.priority)" class="text-[10px] leading-none">
                                                    {{ formatEnumLabel(order.priority) }}
                                                </Badge>
                                                <Badge v-if="order.currentCare?.hasCriticalResult" variant="destructive" class="text-[10px] leading-none">
                                                    Critical result
                                                </Badge>
                                                <Badge v-else-if="order.currentCare?.hasAbnormalResult" class="bg-amber-100 text-[10px] leading-none text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                                    Abnormal result
                                                </Badge>
                                            </div>
                                            <p class="text-xs text-muted-foreground">
                                                {{ order.orderNumber || 'Laboratory order' }}
                                                <span v-if="order.specimenType"> · {{ order.specimenType }}</span>
                                            </p>
                                        </button>
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
                                            <Button
                                                v-if="canApplyLifecycleAction && order.status !== 'cancelled' && order.status !== 'completed' && !order.enteredInErrorAt"
                                                size="sm"
                                                variant="outline"
                                                class="h-7 px-2 text-xs"
                                                :disabled="actionLoadingId === order.id"
                                                @click="openLifecycleDialog(order, 'cancel')"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                v-if="canViewAuditLogs"
                                                size="sm"
                                                variant="ghost"
                                                class="h-7 px-1.5"
                                                aria-label="View audit log"
                                                @click="openAuditSheet(order)"
                                            >
                                                <AppIcon name="clock" class="size-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </PatientOrderGroupList>
                    </template>
                </div>
            </Tabs>
        </div>

        <LaboratoryOrderCreateSheet v-model:open="createSheetOpen" @created="onOrderCreated" />

        <LaboratoryOrderDetailSheet v-model:open="detailOpen" :order="detailOrder" />

        <LaboratoryStatusUpdateDialog
            :open="statusDialogOpen"
            :order="statusDialogOrder"
            :intent="statusDialogIntent"
            :loading="actionLoadingId === statusDialogOrder?.id"
            :error="statusDialogError"
            @update:open="statusDialogOpen = $event"
            @submit="submitStatusUpdateDialog"
        />

        <LaboratoryVerifyResultDialog
            :open="verifyDialogOpen"
            :order="verifyDialogOrder"
            :loading="actionLoadingId === verifyDialogOrder?.id"
            :error="verifyDialogError"
            @update:open="verifyDialogOpen = $event"
            @submit="submitVerifyDialog"
        />

        <ClinicalLifecycleActionDialog
            :open="lifecycleDialogOpen"
            :action="lifecycleDialogAction"
            :order-label="lifecycleDialogOrder ? orderLabel(lifecycleDialogOrder) : 'Laboratory order'"
            subject-label="laboratory order"
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
            title="Laboratory order audit log"
            :subtitle="orderLabel(auditSheetOrder)"
            :audit="auditLog"
        />
    </AppLayout>
</template>
