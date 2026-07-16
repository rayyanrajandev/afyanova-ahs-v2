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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import PatientQuickSearchField from '@/components/patients/PatientQuickSearchField.vue';
import { type PatientQuickSearchResult } from '@/composables/patients/usePatientQuickSearch';
import PatientOrderGroupList from '@/components/orders/PatientOrderGroupList.vue';
import ClinicalLifecycleActionDialog from '@/components/orders/ClinicalLifecycleActionDialog.vue';
import AuditLogSheet from '@/components/shared/AuditLogSheet.vue';
import PharmacyOrderCreateSheet from '@/components/pharmacyOrders/PharmacyOrderCreateSheet.vue';
import PharmacyOrderDetailSheet from '@/components/pharmacyOrders/PharmacyOrderDetailSheet.vue';
import PharmacyDispenseDialog from '@/components/pharmacyOrders/PharmacyDispenseDialog.vue';
import PharmacyVerifyDispenseDialog from '@/components/pharmacyOrders/PharmacyVerifyDispenseDialog.vue';
import PharmacyPolicyDialog from '@/components/pharmacyOrders/PharmacyPolicyDialog.vue';
import PharmacyReconciliationDialog from '@/components/pharmacyOrders/PharmacyReconciliationDialog.vue';
import { usePatientOrderGroups } from '@/composables/usePatientOrderGroups';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { usePharmacyOrderFilters } from '@/composables/pharmacyOrders/usePharmacyOrderFilters';
import { usePharmacyOrders, type PharmacyOrder, type PharmacyOrderStatus } from '@/composables/pharmacyOrders/usePharmacyOrders';
import { usePharmacyOrderStatusCounts } from '@/composables/pharmacyOrders/usePharmacyOrderStatusCounts';
import { usePharmacyOrderAuditLog } from '@/composables/pharmacyOrders/usePharmacyOrderAuditLog';
import { useUpdatePharmacyOrderStatus, type UpdatePharmacyOrderStatusPayload } from '@/composables/pharmacyOrders/useUpdatePharmacyOrderStatus';
import { useVerifyPharmacyOrderDispense, type VerifyPharmacyOrderDispensePayload } from '@/composables/pharmacyOrders/useVerifyPharmacyOrderDispense';
import { useUpdatePharmacyOrderPolicy, type UpdatePharmacyOrderPolicyPayload } from '@/composables/pharmacyOrders/useUpdatePharmacyOrderPolicy';
import { useReconcilePharmacyOrder, type ReconcilePharmacyOrderPayload } from '@/composables/pharmacyOrders/useReconcilePharmacyOrder';
import { useApplyPharmacyOrderLifecycleAction } from '@/composables/pharmacyOrders/useApplyPharmacyOrderLifecycleAction';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

/**
 * Pharmacy worklist V2 — first of four planned order-domain V2 builds
 * (lab/pharmacy/imaging/theatre), replacing pharmacy-orders/Index.vue
 * (16,765 lines) for the WORKLIST slice: search/filter, status tabs,
 * KPI tiles, and the dispense/verify/policy/reconciliation/lifecycle
 * actions pharmacy staff take on existing orders. The legacy page's
 * "formulary policy-review-required governance tier" is a separate,
 * post-creation lifecycle step, already ported to V2 via
 * PharmacyPolicyDialog.vue above — not part of order creation itself.
 *
 * Order creation (Phase 2 of reports/order-creation-v2-modernization-plan.md):
 * PharmacyOrderCreateSheet.vue, reusing the same duplicate-check/
 * medication-safety/create endpoints EncounterInlineOrderPanel.vue already
 * calls from an active encounter — this is the standalone-page entry point
 * for the same backend, not a second implementation.
 *
 * Reuses usePatientOrderGroups + PatientOrderGroupList (both already built
 * for exactly this shape: DirectServiceModuleKey === 'pharmacy') rather
 * than a flat per-row list like other V2 pages — a patient can have
 * several concurrent medication orders, and grouping is genuinely useful
 * here, unlike single-order-per-row domains (admissions, appointments).
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canRead = computed(() => hasAccess('pharmacy.orders.read'));
const canUpdateStatus = computed(() => hasAccess('medication.dispense'));
const canVerifyDispense = computed(() => hasAccess('pharmacy.orders.verify-dispense'));
const canManagePolicy = computed(() => hasAccess('pharmacy.orders.manage-policy'));
const canReconcile = computed(() => hasAccess('pharmacy.orders.reconcile'));
const canApplyLifecycleAction = computed(() => hasAccess('medication.prescribe'));
const canCreate = computed(() => hasAccess('medication.prescribe'));
const canViewAuditLogs = computed(() => hasAccess('pharmacy-orders.view-audit-logs'));

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Pharmacy worklist', href: '/pharmacy-orders' },
]);

const filters = usePharmacyOrderFilters();

// Deep-link support for cross-page "open the pharmacy worklist filtered/
// focused on X" links (Dashboard.vue's KPI cards, patient chart's current
// care panel, etc.) — status/focusOrderId predate this V2 page and still
// point at plain query params rather than a dedicated API.
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

const list = usePharmacyOrders(filters);
const statusCounts = usePharmacyOrderStatusCounts(filters);
const queryClient = useQueryClient();

const createSheetOpen = ref(false);

function onOrderCreated(orderNumber: string): void {
    void queryClient.invalidateQueries({ queryKey: ['pharmacy-orders-index'] });
    void queryClient.invalidateQueries({ queryKey: ['sidebar-pharmacy-order-status-counts'] });
    notifySuccess(`Placed ${orderNumber}.`);
}

const orders = computed<PharmacyOrder[]>(() => list.data.value?.data ?? []);

const { patientOrderGroups, useGroupedQueueView, isPatientGroupExpanded, setPatientGroupExpanded } = usePatientOrderGroups<PharmacyOrder>(
    orders,
    'pharmacy',
    focusPatientId,
);

const statusOptions: Array<{ value: PharmacyOrderStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_preparation', label: 'In preparation' },
    { value: 'partially_dispensed', label: 'Partially dispensed' },
    { value: 'dispensed', label: 'Dispensed' },
    { value: 'cancelled', label: 'Cancelled' },
];

function statusCount(status: PharmacyOrderStatus | 'all'): number | null {
    if (!statusCounts.data.value) return null;
    if (status === 'all') return statusCounts.data.value.total;
    return statusCounts.data.value[status] ?? null;
}

function setStatus(value: string | number): void {
    filters.status = value === 'all' ? '' : String(value);
    filters.page = 1;
}

async function invalidatePharmacyQueries(): Promise<void> {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pharmacy-orders-index'] }),
        queryClient.invalidateQueries({ queryKey: ['pharmacy-orders-status-counts'] }),
    ]);
}

const patientSearchQuery = ref('');

/**
 * PatientQuickSearchField, not PatientLookupField — this is a filter row
 * (narrow the list, transient), not a form field (confirm who a record is
 * for, permanent). PatientLookupField's selected-patient summary card
 * (name/PT number/status/phone/demographics) is right for the latter but
 * pushes the whole filter row down for the former — confirmed as a real
 * layout bug live, matching Reception Queue's own established convention
 * for exactly this kind of dense filter search.
 */
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

function statusBadgeVariant(status: PharmacyOrderStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'dispensed':
            return 'default';
        case 'cancelled':
            return 'destructive';
        case 'partially_dispensed':
            return 'secondary';
        default:
            return 'outline';
    }
}

function orderLabel(order: PharmacyOrder): string {
    const code = (order.medicationCode ?? '').trim();
    const name = (order.medicationName ?? '').trim();
    if (code && name) return `${code} - ${name}`;
    return name || code || 'Medication order';
}

function needsVerification(order: PharmacyOrder): boolean {
    return order.currentCare?.awaitingVerification ?? false;
}

/**
 * The row's primary action, driven by the server's own ClinicalCurrentCare::pharmacy()
 * computation (order.currentCare.nextAction) wherever possible — a first pass here
 * reconstructed this logic client-side and drifted from real server behavior.
 *
 * One gap: currentCare's `hasPolicyIssue` only flags formularyDecisionStatus values
 * of non_formulary/restricted, not the default not_reviewed — reasonably, since
 * "not yet reviewed" isn't itself alarming for currentCare's broader "does this need
 * attention" purpose. But UpdatePharmacyOrderStatusUseCase's actual preparation/dispense
 * gate rejects ALL THREE (not_reviewed included) with "Policy review must be completed
 * before this order can move into preparation or release." (confirmed live). So
 * not_reviewed must be checked here explicitly for orders still pre-dispense —
 * currentCare's own signal already covers non_formulary/restricted.
 */
function effectiveNextAction(order: PharmacyOrder) {
    const isPreDispense = order.status === 'pending' || order.status === 'in_preparation' || order.status === 'partially_dispensed';
    if (isPreDispense && (!order.formularyDecisionStatus || order.formularyDecisionStatus === 'not_reviewed')) {
        return { key: 'review_policy' as const, label: 'Review policy', emphasis: 'warning' as const };
    }
    return order.currentCare?.nextAction ?? null;
}

function primaryActionHandler(order: PharmacyOrder): (() => void) | null {
    switch (effectiveNextAction(order)?.key) {
        case 'review_policy':
            return () => openPolicyDialog(order);
        case 'start_preparation':
            return () => openDispenseDialog(order, 'preparation');
        case 'record_dispense':
        case 'complete_dispense':
            return () => openDispenseDialog(order, 'dispense');
        case 'verify_dispense':
            return () => openVerifyDialog(order);
        case 'resolve_reconciliation':
        case 'review_reconciliation':
            return () => openReconciliationDialog(order);
        case 'open_order':
            return () => openDetail(order);
        default:
            return null;
    }
}

function primaryActionButtonVariant(order: PharmacyOrder): 'default' | 'destructive' | 'outline' {
    switch (effectiveNextAction(order)?.emphasis) {
        case 'warning':
            return 'destructive';
        case 'secondary':
            return 'outline';
        default:
            return 'default';
    }
}

function primaryActionAllowed(order: PharmacyOrder): boolean {
    switch (effectiveNextAction(order)?.key) {
        case 'review_policy':
            return canManagePolicy.value;
        case 'start_preparation':
        case 'record_dispense':
        case 'complete_dispense':
            return canUpdateStatus.value;
        case 'verify_dispense':
            return canVerifyDispense.value;
        case 'resolve_reconciliation':
        case 'review_reconciliation':
            return canReconcile.value;
        default:
            return true;
    }
}

const actionLoadingId = ref<string | null>(null);

/* Detail sheet */
const detailOrder = ref<PharmacyOrder | null>(null);
const detailOpen = ref(false);

function openDetail(order: PharmacyOrder): void {
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

/* Dispense / preparation dialog */
const dispenseDialogOpen = ref(false);
const dispenseDialogOrder = ref<PharmacyOrder | null>(null);
const dispenseDialogIntent = ref<'preparation' | 'dispense' | null>(null);
const dispenseDialogError = ref<string | null>(null);

function openDispenseDialog(order: PharmacyOrder, intent: 'preparation' | 'dispense'): void {
    dispenseDialogOrder.value = order;
    dispenseDialogIntent.value = intent;
    dispenseDialogError.value = null;
    dispenseDialogOpen.value = true;
}

const updateStatusMutation = useUpdatePharmacyOrderStatus();

async function submitDispenseDialog(payload: Omit<UpdatePharmacyOrderStatusPayload, 'id'>): Promise<void> {
    const order = dispenseDialogOrder.value;
    if (!order) return;

    dispenseDialogError.value = null;
    actionLoadingId.value = order.id;
    try {
        await updateStatusMutation.mutateAsync({ id: order.id, ...payload });
        await invalidatePharmacyQueries();
        notifySuccess(`${orderLabel(order)} updated to ${formatEnumLabel(payload.status)}.`);
        dispenseDialogOpen.value = false;
        dispenseDialogOrder.value = null;
        dispenseDialogIntent.value = null;
    } catch (error) {
        dispenseDialogError.value = messageFromUnknown(error, 'Unable to update this order.');
        notifyError(dispenseDialogError.value);
    } finally {
        actionLoadingId.value = null;
    }
}

/* Verify dispense dialog */
const verifyDialogOpen = ref(false);
const verifyDialogOrder = ref<PharmacyOrder | null>(null);
const verifyDialogError = ref<string | null>(null);

function openVerifyDialog(order: PharmacyOrder): void {
    verifyDialogOrder.value = order;
    verifyDialogError.value = null;
    verifyDialogOpen.value = true;
}

const verifyDispenseMutation = useVerifyPharmacyOrderDispense();

async function submitVerifyDialog(payload: Omit<VerifyPharmacyOrderDispensePayload, 'id'>): Promise<void> {
    const order = verifyDialogOrder.value;
    if (!order) return;

    verifyDialogError.value = null;
    actionLoadingId.value = order.id;
    try {
        await verifyDispenseMutation.mutateAsync({ id: order.id, ...payload });
        await invalidatePharmacyQueries();
        notifySuccess(`${orderLabel(order)} verified.`);
        verifyDialogOpen.value = false;
        verifyDialogOrder.value = null;
    } catch (error) {
        verifyDialogError.value = messageFromUnknown(error, 'Unable to verify this order.');
        notifyError(verifyDialogError.value);
    } finally {
        actionLoadingId.value = null;
    }
}

/* Policy dialog */
const policyDialogOpen = ref(false);
const policyDialogOrder = ref<PharmacyOrder | null>(null);
const policyDialogError = ref<string | null>(null);

function openPolicyDialog(order: PharmacyOrder): void {
    policyDialogOrder.value = order;
    policyDialogError.value = null;
    policyDialogOpen.value = true;
}

const updatePolicyMutation = useUpdatePharmacyOrderPolicy();

async function submitPolicyDialog(payload: Omit<UpdatePharmacyOrderPolicyPayload, 'id'>): Promise<void> {
    const order = policyDialogOrder.value;
    if (!order) return;

    policyDialogError.value = null;
    actionLoadingId.value = order.id;
    try {
        await updatePolicyMutation.mutateAsync({ id: order.id, ...payload });
        await invalidatePharmacyQueries();
        notifySuccess(`Formulary decision recorded for ${orderLabel(order)}.`);
        policyDialogOpen.value = false;
        policyDialogOrder.value = null;
    } catch (error) {
        policyDialogError.value = messageFromUnknown(error, 'Unable to record this policy decision.');
        notifyError(policyDialogError.value);
    } finally {
        actionLoadingId.value = null;
    }
}

/* Reconciliation dialog */
const reconciliationDialogOpen = ref(false);
const reconciliationDialogOrder = ref<PharmacyOrder | null>(null);
const reconciliationDialogError = ref<string | null>(null);

function openReconciliationDialog(order: PharmacyOrder): void {
    reconciliationDialogOrder.value = order;
    reconciliationDialogError.value = null;
    reconciliationDialogOpen.value = true;
}

const reconcileMutation = useReconcilePharmacyOrder();

async function submitReconciliationDialog(payload: Omit<ReconcilePharmacyOrderPayload, 'id'>): Promise<void> {
    const order = reconciliationDialogOrder.value;
    if (!order) return;

    reconciliationDialogError.value = null;
    actionLoadingId.value = order.id;
    try {
        await reconcileMutation.mutateAsync({ id: order.id, ...payload });
        await invalidatePharmacyQueries();
        notifySuccess(`${orderLabel(order)} reconciled.`);
        reconciliationDialogOpen.value = false;
        reconciliationDialogOrder.value = null;
    } catch (error) {
        reconciliationDialogError.value = messageFromUnknown(error, 'Unable to record reconciliation.');
        notifyError(reconciliationDialogError.value);
    } finally {
        actionLoadingId.value = null;
    }
}

/* Lifecycle (cancel / discontinue / entered-in-error) dialog */
const lifecycleDialogOpen = ref(false);
const lifecycleDialogOrder = ref<PharmacyOrder | null>(null);
const lifecycleDialogAction = ref<'cancel' | 'discontinue' | 'entered_in_error' | null>(null);
const lifecycleDialogReason = ref('');
const lifecycleDialogError = ref<string | null>(null);

function openLifecycleDialog(order: PharmacyOrder, action: 'cancel' | 'discontinue' | 'entered_in_error'): void {
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

const lifecycleActionMutation = useApplyPharmacyOrderLifecycleAction();

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
        await invalidatePharmacyQueries();
        notifySuccess(
            action === 'cancel'
                ? `${orderLabel(order)} cancelled.`
                : action === 'discontinue'
                    ? `${orderLabel(order)} discontinued.`
                    : `${orderLabel(order)} marked entered in error.`,
        );
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
const auditSheetOrder = ref<PharmacyOrder | null>(null);
const auditOrderId = computed(() => auditSheetOrder.value?.id ?? null);
const auditLog = usePharmacyOrderAuditLog(auditOrderId);

function openAuditSheet(order: PharmacyOrder): void {
    auditSheetOrder.value = order;
    auditSheetOpen.value = true;
}
</script>

<template>
    <Head title="Pharmacy Worklist" />
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
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Pharmacy Worklist</h1>
                            <p class="text-xs text-muted-foreground">Dispense, verify, and reconcile pharmacy orders.</p>
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

                    <div v-if="canRead" class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Pending</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCount('pending') ?? '—' }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">In preparation</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCount('in_preparation') ?? '—' }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Dispensed today</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCount('dispensed') ?? '—' }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Needs verification</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.reconciliation_pending ?? '—' }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Reconciliation exceptions</p>
                            <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.reconciliation_exception ?? '—' }}</p>
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
                        <AlertDescription>Viewing the pharmacy worklist requires <code>pharmacy.orders.read</code>.</AlertDescription>
                    </Alert>

                    <template v-else>
                        <div class="flex flex-wrap items-end gap-2">
                            <div class="relative min-w-64 flex-1">
                                <Input
                                    v-model="filters.q"
                                    placeholder="Search by order number, medication, patient…"
                                    class="h-9"
                                    @update:model-value="filters.page = 1"
                                />
                            </div>
                            <div class="min-w-64">
                                <PatientQuickSearchField
                                    v-model:query="patientSearchQuery"
                                    input-id="pharmacy-worklist-patient"
                                    placeholder="Search patient by name, MRN, or phone…"
                                    @selected="onPatientSelected"
                                />
                            </div>
                            <DateRangeFilterPopover
                                input-base-id="pharmacy-worklist-date-range"
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
                            <AlertTitle>Unable to load the pharmacy worklist</AlertTitle>
                            <AlertDescription>{{ list.error.value?.message ?? 'Unknown error.' }}</AlertDescription>
                        </Alert>

                        <div
                            v-else-if="orders.length === 0"
                            class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
                        >
                            No pharmacy orders match these filters.
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
                                                <Badge v-if="needsVerification(order)" class="bg-amber-100 text-[10px] leading-none text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                                    Needs verification
                                                </Badge>
                                                <Badge v-if="order.reconciliationStatus === 'exception'" variant="destructive" class="text-[10px] leading-none">
                                                    Reconciliation exception
                                                </Badge>
                                            </div>
                                            <p class="text-xs text-muted-foreground">
                                                {{ order.orderNumber || 'Pharmacy order' }}
                                                <span v-if="order.dosageInstruction"> · {{ order.dosageInstruction }}</span>
                                            </p>
                                        </button>
                                        <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                                            <Button
                                                v-if="effectiveNextAction(order) && primaryActionAllowed(order)"
                                                size="sm"
                                                :variant="primaryActionButtonVariant(order)"
                                                class="h-7 px-2 text-xs"
                                                :disabled="actionLoadingId === order.id"
                                                @click="primaryActionHandler(order)?.()"
                                            >
                                                {{ effectiveNextAction(order)?.label }}
                                            </Button>
                                            <Button
                                                v-if="canManagePolicy && effectiveNextAction(order)?.key !== 'review_policy'"
                                                size="sm"
                                                variant="outline"
                                                class="h-7 px-2 text-xs"
                                                :disabled="actionLoadingId === order.id"
                                                @click="openPolicyDialog(order)"
                                            >
                                                Policy
                                            </Button>
                                            <Button
                                                v-if="canApplyLifecycleAction && order.status !== 'cancelled' && !order.enteredInErrorAt"
                                                size="sm"
                                                variant="outline"
                                                class="h-7 px-2 text-xs"
                                                :disabled="actionLoadingId === order.id"
                                                @click="openLifecycleDialog(order, order.quantityDispensed && order.quantityDispensed > 0 ? 'discontinue' : 'cancel')"
                                            >
                                                {{ order.quantityDispensed && order.quantityDispensed > 0 ? 'Discontinue' : 'Cancel' }}
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

        <PharmacyOrderCreateSheet v-model:open="createSheetOpen" @created="onOrderCreated" />

        <PharmacyOrderDetailSheet v-model:open="detailOpen" :order="detailOrder" />

        <PharmacyDispenseDialog
            :open="dispenseDialogOpen"
            :order="dispenseDialogOrder"
            :intent="dispenseDialogIntent"
            :loading="actionLoadingId === dispenseDialogOrder?.id"
            :error="dispenseDialogError"
            @update:open="dispenseDialogOpen = $event"
            @submit="submitDispenseDialog"
        />

        <PharmacyVerifyDispenseDialog
            :open="verifyDialogOpen"
            :order="verifyDialogOrder"
            :loading="actionLoadingId === verifyDialogOrder?.id"
            :error="verifyDialogError"
            @update:open="verifyDialogOpen = $event"
            @submit="submitVerifyDialog"
        />

        <PharmacyPolicyDialog
            :open="policyDialogOpen"
            :order="policyDialogOrder"
            :loading="actionLoadingId === policyDialogOrder?.id"
            :error="policyDialogError"
            @update:open="policyDialogOpen = $event"
            @submit="submitPolicyDialog"
        />

        <PharmacyReconciliationDialog
            :open="reconciliationDialogOpen"
            :order="reconciliationDialogOrder"
            :loading="actionLoadingId === reconciliationDialogOrder?.id"
            :error="reconciliationDialogError"
            @update:open="reconciliationDialogOpen = $event"
            @submit="submitReconciliationDialog"
        />

        <ClinicalLifecycleActionDialog
            :open="lifecycleDialogOpen"
            :action="lifecycleDialogAction"
            :order-label="lifecycleDialogOrder ? orderLabel(lifecycleDialogOrder) : 'Pharmacy order'"
            subject-label="pharmacy order"
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
            title="Pharmacy order audit log"
            :subtitle="orderLabel(auditSheetOrder)"
            :audit="auditLog"
        />
    </AppLayout>
</template>
