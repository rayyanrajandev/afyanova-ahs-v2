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
import RadiologyOrderCreateSheet from '@/components/radiologyOrders/RadiologyOrderCreateSheet.vue';
import RadiologyOrderDetailSheet from '@/components/radiologyOrders/RadiologyOrderDetailSheet.vue';
import RadiologyStatusUpdateDialog from '@/components/radiologyOrders/RadiologyStatusUpdateDialog.vue';
import { usePatientOrderGroups } from '@/composables/usePatientOrderGroups';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { useRadiologyOrderFilters } from '@/composables/radiologyOrders/useRadiologyOrderFilters';
import {
    useRadiologyOrders,
    type RadiologyOrder,
    type RadiologyOrderModality,
    type RadiologyOrderStatus,
} from '@/composables/radiologyOrders/useRadiologyOrders';
import { useRadiologyOrderStatusCounts } from '@/composables/radiologyOrders/useRadiologyOrderStatusCounts';
import { useRadiologyOrderAuditLog } from '@/composables/radiologyOrders/useRadiologyOrderAuditLog';
import { useUpdateRadiologyOrderStatus, type UpdateRadiologyOrderStatusPayload } from '@/composables/radiologyOrders/useUpdateRadiologyOrderStatus';
import { useApplyRadiologyOrderLifecycleAction } from '@/composables/radiologyOrders/useApplyRadiologyOrderLifecycleAction';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

/**
 * Radiology/imaging worklist V2 — third of four planned order-domain V2
 * builds (lab/pharmacy shipped+live, imaging, theatre/procedures next),
 * mirroring laboratory-orders/IndexV2.vue's shape. Replaces
 * radiology-orders/Index.vue for the WORKLIST slice: search/filter,
 * status tabs, KPI tiles, and the schedule/start/complete/lifecycle
 * actions imaging staff take on existing orders.
 *
 * Order creation (Phase 1 of reports/order-creation-v2-modernization-plan.md):
 * RadiologyOrderCreateSheet.vue, reusing the same duplicate-check/create
 * endpoints EncounterInlineOrderPanel.vue already calls from an active
 * encounter — this is the standalone-page entry point for the same backend,
 * not a second implementation.
 *
 * Unlike lab, there is no verify step at all for radiology — completing an
 * order with a report IS the release step (UpdateRadiologyOrderStatusUseCase
 * writes report_summary + completed_at in the same PATCH .../status call
 * that transitions to 'completed'). So this page has only two action
 * dialogs (status update, lifecycle) and no verify dialog/composable.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canRead = computed(() => hasAccess('radiology.orders.read'));
const canUpdateStatus = computed(() => hasAccess('imaging.perform'));
const canApplyLifecycleAction = computed(() => hasAccess('imaging.order'));
const canCreate = computed(() => hasAccess('imaging.order'));
const canViewAuditLogs = computed(() => hasAccess('radiology.orders.audit-logs.view'));

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Radiology worklist', href: '/radiology-orders' },
]);

const filters = useRadiologyOrderFilters();

// Deep-link support for cross-page "open the radiology worklist filtered/
// focused on X" links, matching laboratory-orders/IndexV2.vue's convention.
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

const list = useRadiologyOrders(filters);
const statusCounts = useRadiologyOrderStatusCounts(filters);
const queryClient = useQueryClient();

const createSheetOpen = ref(false);

function onOrderCreated(orderNumber: string): void {
    void queryClient.invalidateQueries({ queryKey: ['radiology-orders-index'] });
    void queryClient.invalidateQueries({ queryKey: ['radiology-orders-status-counts'] });
    notifySuccess(`Placed ${orderNumber}.`);
}

const orders = computed<RadiologyOrder[]>(() => list.data.value?.data ?? []);

const { patientOrderGroups, useGroupedQueueView, isPatientGroupExpanded, setPatientGroupExpanded } = usePatientOrderGroups<RadiologyOrder>(
    orders,
    'radiology',
    focusPatientId,
);

const statusOptions: Array<{ value: RadiologyOrderStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'ordered', label: 'Ordered' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
];

const modalityOptions: Array<{ value: '' | RadiologyOrderModality; label: string }> = [
    { value: '', label: 'All modalities' },
    { value: 'xray', label: 'X-ray' },
    { value: 'ultrasound', label: 'Ultrasound' },
    { value: 'ct', label: 'CT' },
    { value: 'mri', label: 'MRI' },
    { value: 'other', label: 'Other' },
];

function statusCount(status: RadiologyOrderStatus | 'all'): number | null {
    if (!statusCounts.data.value) return null;
    if (status === 'all') return statusCounts.data.value.total;
    return statusCounts.data.value[status] ?? null;
}

// status-counts has no derived buckets — Open is summed client-side from
// the three open statuses, same pattern as laboratory-orders/IndexV2.vue.
const openCount = computed<number | null>(() => {
    if (!statusCounts.data.value) return null;
    return statusCounts.data.value.ordered + statusCounts.data.value.scheduled + statusCounts.data.value.in_progress;
});

function setStatus(value: string | number): void {
    filters.status = value === 'all' ? '' : String(value);
    filters.page = 1;
}

async function invalidateRadiologyQueries(): Promise<void> {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['radiology-orders-index'] }),
        queryClient.invalidateQueries({ queryKey: ['radiology-orders-status-counts'] }),
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
    filters.modality = '';
    filters.from = '';
    filters.to = '';
    filters.page = 1;
}

const { scrollContainerHeight } = useStickyScrollContainer();

function statusBadgeVariant(status: RadiologyOrderStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
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

function orderLabel(order: RadiologyOrder): string {
    const code = (order.procedureCode ?? '').trim();
    const name = (order.studyDescription ?? '').trim();
    if (code && name) return `${code} - ${name}`;
    return name || code || 'Radiology order';
}

/**
 * The row's primary action, driven directly by ClinicalCurrentCare::radiology()
 * (order.currentCare.nextAction) — no hidden gate to layer on top, same as
 * lab. 'review_order' covers three dialog intents (schedule/start
 * imaging/complete); the label alone distinguishes them, so the actual
 * intent is derived from order.status. 'review_report' always opens the
 * detail sheet — there's no verify step to branch on (unlike lab, which
 * has to check order.verifiedAt).
 */
function statusUpdateIntent(order: RadiologyOrder): 'schedule' | 'start_imaging' | 'complete' {
    switch (order.status) {
        case 'scheduled':
            return 'start_imaging';
        case 'in_progress':
            return 'complete';
        default:
            return 'schedule';
    }
}

function primaryActionHandler(order: RadiologyOrder): (() => void) | null {
    switch (order.currentCare?.nextAction?.key) {
        case 'review_order':
            return () => openStatusUpdateDialog(order, statusUpdateIntent(order));
        case 'review_report':
            return () => openDetail(order);
        default:
            return null;
    }
}

function primaryActionButtonVariant(order: RadiologyOrder): 'default' | 'destructive' | 'outline' {
    switch (order.currentCare?.nextAction?.emphasis) {
        case 'warning':
            return 'destructive';
        case 'secondary':
            return 'outline';
        default:
            return 'default';
    }
}

function primaryActionAllowed(order: RadiologyOrder): boolean {
    switch (order.currentCare?.nextAction?.key) {
        case 'review_order':
            return canUpdateStatus.value;
        default:
            return true;
    }
}

const actionLoadingId = ref<string | null>(null);

/* Detail sheet */
const detailOrder = ref<RadiologyOrder | null>(null);
const detailOpen = ref(false);

function openDetail(order: RadiologyOrder): void {
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

/* Status update dialog (schedule / start imaging / complete) */
const statusDialogOpen = ref(false);
const statusDialogOrder = ref<RadiologyOrder | null>(null);
const statusDialogIntent = ref<'schedule' | 'start_imaging' | 'complete' | null>(null);
const statusDialogError = ref<string | null>(null);

function openStatusUpdateDialog(order: RadiologyOrder, intent: 'schedule' | 'start_imaging' | 'complete'): void {
    statusDialogOrder.value = order;
    statusDialogIntent.value = intent;
    statusDialogError.value = null;
    statusDialogOpen.value = true;
}

const updateStatusMutation = useUpdateRadiologyOrderStatus();

async function submitStatusUpdateDialog(payload: Omit<UpdateRadiologyOrderStatusPayload, 'id'>): Promise<void> {
    const order = statusDialogOrder.value;
    if (!order) return;

    statusDialogError.value = null;
    actionLoadingId.value = order.id;
    try {
        await updateStatusMutation.mutateAsync({ id: order.id, ...payload });
        await invalidateRadiologyQueries();
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

/* Lifecycle (cancel / entered-in-error) dialog */
const lifecycleDialogOpen = ref(false);
const lifecycleDialogOrder = ref<RadiologyOrder | null>(null);
const lifecycleDialogAction = ref<'cancel' | 'entered_in_error' | null>(null);
const lifecycleDialogReason = ref('');
const lifecycleDialogError = ref<string | null>(null);

function openLifecycleDialog(order: RadiologyOrder, action: 'cancel' | 'entered_in_error'): void {
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

const lifecycleActionMutation = useApplyRadiologyOrderLifecycleAction();

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
        await invalidateRadiologyQueries();
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
const auditSheetOrder = ref<RadiologyOrder | null>(null);
const auditOrderId = computed(() => auditSheetOrder.value?.id ?? null);
const auditLog = useRadiologyOrderAuditLog(auditOrderId);

function openAuditSheet(order: RadiologyOrder): void {
    auditSheetOrder.value = order;
    auditSheetOpen.value = true;
}
</script>

<template>
    <Head title="Radiology Worklist" />
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
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Radiology Worklist</h1>
                            <p class="text-xs text-muted-foreground">Schedule, image, and report radiology orders.</p>
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
                        <AlertDescription>Viewing the radiology worklist requires <code>radiology.orders.read</code>.</AlertDescription>
                    </Alert>

                    <template v-else>
                        <div class="flex flex-wrap items-end gap-2">
                            <div class="relative min-w-64 flex-1">
                                <Input
                                    v-model="filters.q"
                                    placeholder="Search by order number, study, patient…"
                                    class="h-9"
                                    @update:model-value="filters.page = 1"
                                />
                            </div>
                            <div class="min-w-64">
                                <PatientQuickSearchField
                                    v-model:query="patientSearchQuery"
                                    input-id="radiology-worklist-patient"
                                    placeholder="Search patient by name, MRN, or phone…"
                                    @selected="onPatientSelected"
                                />
                            </div>
                            <div class="w-40">
                                <Select :model-value="filters.modality || 'all'" @update:model-value="(value) => { filters.modality = value === 'all' ? '' : (value as RadiologyOrderModality); filters.page = 1; }">
                                    <SelectTrigger class="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="option in modalityOptions" :key="option.value || 'all'" :value="option.value || 'all'">
                                            {{ option.label }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DateRangeFilterPopover
                                input-base-id="radiology-worklist-date-range"
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
                            <AlertTitle>Unable to load the radiology worklist</AlertTitle>
                            <AlertDescription>{{ list.error.value?.message ?? 'Unknown error.' }}</AlertDescription>
                        </Alert>

                        <div
                            v-else-if="orders.length === 0"
                            class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
                        >
                            No radiology orders match these filters.
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
                                                <Badge v-if="order.modality" variant="outline" class="text-[10px] leading-none">
                                                    {{ formatEnumLabel(order.modality) }}
                                                </Badge>
                                                <Badge v-if="order.currentCare?.hasCriticalReport" variant="destructive" class="text-[10px] leading-none">
                                                    Critical report
                                                </Badge>
                                                <Badge v-else-if="order.currentCare?.hasAbnormalReport" class="bg-amber-100 text-[10px] leading-none text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                                    Abnormal report
                                                </Badge>
                                            </div>
                                            <p class="text-xs text-muted-foreground">
                                                {{ order.orderNumber || 'Radiology order' }}
                                                <span v-if="order.scheduledFor"> · scheduled {{ order.scheduledFor }}</span>
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

        <RadiologyOrderCreateSheet v-model:open="createSheetOpen" @created="onOrderCreated" />

        <RadiologyOrderDetailSheet v-model:open="detailOpen" :order="detailOrder" />

        <RadiologyStatusUpdateDialog
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
            :order-label="lifecycleDialogOrder ? orderLabel(lifecycleDialogOrder) : 'Radiology order'"
            subject-label="radiology order"
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
            title="Radiology order audit log"
            :subtitle="orderLabel(auditSheetOrder)"
            :audit="auditLog"
        />
    </AppLayout>
</template>
