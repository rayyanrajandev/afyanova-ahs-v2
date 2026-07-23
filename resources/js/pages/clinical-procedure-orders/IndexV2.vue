<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ClinicalProcedureOrderCreateSheet from '@/components/clinicalProcedureOrders/ClinicalProcedureOrderCreateSheet.vue';
import ClinicalProcedureOrderDetailSheet from '@/components/clinicalProcedureOrders/ClinicalProcedureOrderDetailSheet.vue';
import ClinicalProcedureStatusUpdateDialog from '@/components/clinicalProcedureOrders/ClinicalProcedureStatusUpdateDialog.vue';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import ClinicalLifecycleActionDialog from '@/components/orders/ClinicalLifecycleActionDialog.vue';
import PatientOrderGroupList from '@/components/orders/PatientOrderGroupList.vue';
import PatientQuickSearchField from '@/components/patients/PatientQuickSearchField.vue';
import AuditLogSheet from '@/components/shared/AuditLogSheet.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApplyClinicalProcedureOrderLifecycleAction } from '@/composables/clinicalProcedureOrders/useApplyClinicalProcedureOrderLifecycleAction';
import { useClinicalProcedureOrderAuditLog } from '@/composables/clinicalProcedureOrders/useClinicalProcedureOrderAuditLog';
import { useClinicalProcedureOrderFilters } from '@/composables/clinicalProcedureOrders/useClinicalProcedureOrderFilters';
import {
    useClinicalProcedureOrders,
    type ClinicalProcedureOrder,
    type ClinicalProcedureOrderProcedureSetting,
    type ClinicalProcedureOrderStatus,
} from '@/composables/clinicalProcedureOrders/useClinicalProcedureOrders';
import { useClinicalProcedureOrderStatusCounts } from '@/composables/clinicalProcedureOrders/useClinicalProcedureOrderStatusCounts';
import { useUpdateClinicalProcedureOrderStatus, type UpdateClinicalProcedureOrderStatusPayload } from '@/composables/clinicalProcedureOrders/useUpdateClinicalProcedureOrderStatus';
import { type PatientQuickSearchResult } from '@/composables/patients/usePatientQuickSearch';
import { usePatientOrderGroups } from '@/composables/usePatientOrderGroups';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canRead = computed(() => hasAccess('clinical-procedure.orders.read'));
const canUpdateStatus = computed(() => hasAccess('clinical-procedure.perform'));
const canApplyLifecycleAction = computed(() => hasAccess('clinical-procedure.order'));
const canCreate = computed(() => hasAccess('clinical-procedure.order'));
const canViewAuditLogs = computed(() => hasAccess('clinical-procedure.orders.view-audit-logs'));

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Clinical procedure worklist', href: '/clinical-procedure-orders' },
]);

const filters = useClinicalProcedureOrderFilters();

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

const list = useClinicalProcedureOrders(filters);
const statusCounts = useClinicalProcedureOrderStatusCounts(filters);
const queryClient = useQueryClient();

const createSheetOpen = ref(false);

function onOrderCreated(orderNumber: string): void {
    void queryClient.invalidateQueries({ queryKey: ['clinical-procedure-orders-status-counts'] });
    notifySuccess(`Placed ${orderNumber}.`);
}

const orders = computed<ClinicalProcedureOrder[]>(() => list.data.value?.data ?? []);

const { patientOrderGroups, useGroupedQueueView, isPatientGroupExpanded, setPatientGroupExpanded } = usePatientOrderGroups<ClinicalProcedureOrder>(
    orders,
    'clinical_procedure',
    focusPatientId,
);

const statusOptions: Array<{ value: ClinicalProcedureOrderStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'ordered', label: 'Ordered' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
];

const procedureSettingOptions: Array<{ value: '' | ClinicalProcedureOrderProcedureSetting; label: string }> = [
    { value: '', label: 'All settings' },
    { value: 'outpatient', label: 'Outpatient' },
    { value: 'inpatient', label: 'Inpatient' },
    { value: 'bedside', label: 'Bedside' },
    { value: 'emergency', label: 'Emergency' },
    { value: 'other', label: 'Other' },
];

function statusCount(status: ClinicalProcedureOrderStatus | 'all'): number | null {
    if (!statusCounts.data.value) return null;
    if (status === 'all') return statusCounts.data.value.total;
    return statusCounts.data.value[status] ?? null;
}

function setStatus(value: string | number): void {
    filters.status = value === 'all' ? '' : String(value);
    filters.page = 1;
}

async function invalidateClinicalProcedureQueries(): Promise<void> {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clinical-procedure-orders-index'] }),
        queryClient.invalidateQueries({ queryKey: ['clinical-procedure-orders-status-counts'] }),
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
    filters.procedureSetting = '';
    filters.from = '';
    filters.to = '';
    filters.page = 1;
}

const { scrollContainerHeight } = useStickyScrollContainer();

function statusBadgeVariant(status: ClinicalProcedureOrderStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
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

function orderLabel(order: ClinicalProcedureOrder): string {
    const code = (order.procedureCode ?? '').trim();
    const name = (order.procedureDescription ?? '').trim();
    if (code && name) return `${code} - ${name}`;
    return name || code || 'Clinical procedure order';
}

function statusUpdateIntent(order: ClinicalProcedureOrder): 'schedule' | 'start_procedure' | 'complete' {
    switch (order.status) {
        case 'scheduled':
            return 'start_procedure';
        case 'in_progress':
            return 'complete';
        default:
            return 'schedule';
    }
}

function primaryActionHandler(order: ClinicalProcedureOrder): (() => void) | null {
    switch (order.currentCare?.nextAction?.key) {
        case 'review_order':
            return () => openStatusUpdateDialog(order, statusUpdateIntent(order));
        case 'review_report':
            return () => openDetail(order);
        default:
            return null;
    }
}

function primaryActionButtonVariant(order: ClinicalProcedureOrder): 'default' | 'destructive' | 'outline' {
    switch (order.currentCare?.nextAction?.emphasis) {
        case 'warning':
            return 'destructive';
        case 'secondary':
            return 'outline';
        default:
            return 'default';
    }
}

function primaryActionAllowed(order: ClinicalProcedureOrder): boolean {
    switch (order.currentCare?.nextAction?.key) {
        case 'review_order':
            return canUpdateStatus.value;
        default:
            return true;
    }
}

const actionLoadingId = ref<string | null>(null);

/* Detail sheet */
const detailOrder = ref<ClinicalProcedureOrder | null>(null);
const detailOpen = ref(false);

function openDetail(order: ClinicalProcedureOrder): void {
    detailOrder.value = order;
    detailOpen.value = true;
}

const linkagePatientId = ref<string | null>(null);
const linkage = ref<{ mode: 'reorder' | 'add_on'; sourceOrderId: string; sourceLabel: string } | null>(null);

function sourceLabelFor(order: ClinicalProcedureOrder): string {
    return order.procedureDescription?.trim() || order.procedureCode?.trim() || order.orderNumber?.trim() || 'this clinical procedure order';
}

function openLinkedCreate(order: ClinicalProcedureOrder, mode: 'reorder' | 'add_on'): void {
    detailOpen.value = false;
    linkagePatientId.value = order.patientId;
    linkage.value = { mode, sourceOrderId: order.id, sourceLabel: sourceLabelFor(order) };
    createSheetOpen.value = true;
}

function onReorder(order: ClinicalProcedureOrder): void {
    openLinkedCreate(order, 'reorder');
}

function onAddOn(order: ClinicalProcedureOrder): void {
    openLinkedCreate(order, 'add_on');
}

function openCreateSheet(): void {
    linkagePatientId.value = null;
    linkage.value = null;
    createSheetOpen.value = true;
}

if (focusOrderId) {
    const stopFocusWatch = watch(orders, (list) => {
        const match = list.find((order) => order.id === focusOrderId);
        if (!match) return;
        openDetail(match);
        stopFocusWatch();
    });
}

/* Status update dialog (schedule / start procedure / complete) */
const statusDialogOpen = ref(false);
const statusDialogOrder = ref<ClinicalProcedureOrder | null>(null);
const statusDialogIntent = ref<'schedule' | 'start_procedure' | 'complete' | null>(null);
const statusDialogError = ref<string | null>(null);

function openStatusUpdateDialog(order: ClinicalProcedureOrder, intent: 'schedule' | 'start_procedure' | 'complete'): void {
    statusDialogOrder.value = order;
    statusDialogIntent.value = intent;
    statusDialogError.value = null;
    statusDialogOpen.value = true;
}

const updateStatusMutation = useUpdateClinicalProcedureOrderStatus();

async function submitStatusUpdateDialog(payload: Omit<UpdateClinicalProcedureOrderStatusPayload, 'id'>): Promise<void> {
    const order = statusDialogOrder.value;
    if (!order) return;

    statusDialogError.value = null;
    actionLoadingId.value = order.id;
    try {
        await updateStatusMutation.mutateAsync({ id: order.id, ...payload });
        await invalidateClinicalProcedureQueries();
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
const lifecycleDialogOrder = ref<ClinicalProcedureOrder | null>(null);
const lifecycleDialogAction = ref<'cancel' | 'entered_in_error' | null>(null);
const lifecycleDialogReason = ref('');
const lifecycleDialogError = ref<string | null>(null);

function openLifecycleDialog(order: ClinicalProcedureOrder, action: 'cancel' | 'entered_in_error'): void {
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

const lifecycleActionMutation = useApplyClinicalProcedureOrderLifecycleAction();

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
        await invalidateClinicalProcedureQueries();
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
const auditSheetOrder = ref<ClinicalProcedureOrder | null>(null);
const auditOrderId = computed(() => auditSheetOrder.value?.id ?? null);
const auditLog = useClinicalProcedureOrderAuditLog(auditOrderId);

function openAuditSheet(order: ClinicalProcedureOrder): void {
    auditSheetOrder.value = order;
    auditSheetOpen.value = true;
}
</script>

<template>
    <Head title="Clinical Procedure Worklist" />
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
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Clinical Procedure Worklist</h1>
                            <p class="text-xs text-muted-foreground">Schedule, perform, and report clinical procedures.</p>
                        </div>
                        <div class="flex shrink-0 items-center gap-2">
                            <Badge variant="secondary">{{ statusCount('all') ?? '—' }} orders</Badge>
                            <Button variant="outline" size="sm" class="h-8 gap-1.5" @click="resetFilters">
                                Clear filters
                            </Button>
                            <Button v-if="canCreate" variant="outline" size="sm" class="h-8 gap-1.5" @click="openCreateSheet">
                                <AppIcon name="plus" class="size-3.5" />
                                Create order
                            </Button>
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
                                placeholder="Search by order number, procedure, patient…"
                                class="h-9"
                                @update:model-value="filters.page = 1"
                            />
                        </div>
                        <div class="min-w-64">
                            <PatientQuickSearchField
                                v-model:query="patientSearchQuery"
                                input-id="clinical-procedure-worklist-patient"
                                placeholder="Search patient by name, MRN, or phone…"
                                @selected="onPatientSelected"
                            />
                        </div>
                        <div class="w-40">
                            <Select :model-value="filters.procedureSetting || 'all'" @update:model-value="(value) => { filters.procedureSetting = value === 'all' ? '' : (value as ClinicalProcedureOrderProcedureSetting); filters.page = 1; }">
                                <SelectTrigger class="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="option in procedureSettingOptions" :key="option.value || 'all'" :value="option.value || 'all'">
                                        {{ option.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DateRangeFilterPopover
                            input-base-id="clinical-procedure-worklist-date-range"
                            title="Order date range"
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
                        <AlertDescription>Viewing the clinical procedure worklist requires <code>clinical-procedure.orders.read</code>.</AlertDescription>
                    </Alert>

                    <template v-else>
                        <div v-if="list.isPending.value" class="space-y-2">
                            <Skeleton class="h-16 w-full" />
                            <Skeleton class="h-16 w-full" />
                            <Skeleton class="h-16 w-full" />
                        </div>

                        <Alert v-else-if="list.isError.value" variant="destructive">
                            <AlertTitle>Unable to load the clinical procedure worklist</AlertTitle>
                            <AlertDescription>{{ list.error.value?.message ?? 'Unknown error.' }}</AlertDescription>
                        </Alert>

                        <div
                            v-else-if="orders.length === 0"
                            class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
                        >
                            No clinical procedure orders match these filters.
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
                                                <Badge v-if="order.procedureSetting" variant="outline" class="text-[10px] leading-none">
                                                    {{ formatEnumLabel(order.procedureSetting) }}
                                                </Badge>
                                                <Badge v-if="order.currentCare?.hasCriticalReport" variant="destructive" class="text-[10px] leading-none">
                                                    Critical report
                                                </Badge>
                                                <Badge v-else-if="order.currentCare?.hasAbnormalReport" class="bg-amber-100 text-[10px] leading-none text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                                    Abnormal report
                                                </Badge>
                                            </div>
                                            <p class="text-xs text-muted-foreground">
                                                {{ order.orderNumber || 'Clinical procedure order' }}
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

        <ClinicalProcedureOrderCreateSheet
            v-model:open="createSheetOpen"
            :initial-patient-id="linkagePatientId"
            :linkage="linkage"
            @created="onOrderCreated"
        />

        <ClinicalProcedureOrderDetailSheet
            v-model:open="detailOpen"
            :order="detailOrder"
            :can-create="canCreate"
            @reorder="onReorder"
            @add-on="onAddOn"
        />

        <ClinicalProcedureStatusUpdateDialog
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
            :order-label="lifecycleDialogOrder ? orderLabel(lifecycleDialogOrder) : 'Clinical procedure order'"
            subject-label="clinical procedure order"
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
            title="Clinical procedure order audit log"
            :subtitle="orderLabel(auditSheetOrder)"
            :audit="auditLog"
        />
    </AppLayout>
</template>
