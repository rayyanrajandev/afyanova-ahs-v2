import { computed, ref } from 'vue';
import { apiPost } from '@/lib/apiClient';
import {
    type EncounterInlineOrderLinkageContext,
    type EncounterInlineOrderType,
} from '@/lib/encounterInlineOrders';
import {
    encounterCareState,
    type CreateEncounterCareSectionId,
    type CreateEncounterCareSummary,
    type EncounterCareLaboratoryOrder,
    type EncounterCarePharmacyOrder,
    type EncounterCareRadiologyOrder,
    type EncounterCareTheatreProcedure,
} from '@/lib/encounterWorkspaceCare';
import {
    encounterLifecycleActionPath,
    encounterLifecycleActionSuccessMessage,
    type EncounterLifecycleAction,
    type EncounterLifecycleTargetKind,
} from '@/lib/encounterWorkspaceLifecycle';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/composables/usePermissions';

type LifecycleTarget =
    | EncounterCareLaboratoryOrder
    | EncounterCarePharmacyOrder
    | EncounterCareRadiologyOrder
    | EncounterCareTheatreProcedure;

/**
 * Reuses the existing, proven order-placement and order-management components
 * (EncounterOrdersCommandCenter, EncounterInlineOrderPanel,
 * EncounterWorkflowCareStreams, EncounterLifecycleDialog — all under
 * components/domain/clinical) rather than rebuilding them. Investigation for
 * Phase 3 (reports/clinical-notes-frontend-rebuild-plan.md §3) found these are
 * already modern, modular, and reasonably sized — the old Workspace.vue's
 * bloat came from bundling everything into one page, not from these pieces
 * themselves. This composable only supplies the glue the old page hand-rolled
 * inline: permission gating, care summaries, inline-order dialog state, the
 * lifecycle (cancel/discontinue/entered-in-error) dialog, and a
 * context-preserving href builder for the workflows that link out
 * (theatre procedures, billing) instead of opening inline.
 */
export function useEncounterOrdering(options: {
    encounterId: () => string;
    patientId: () => string;
    appointmentId: () => string | null;
    admissionId: () => string | null;
    isLoading: () => boolean;
    loadError: () => string | null;
    laboratoryOrders: () => EncounterCareLaboratoryOrder[];
    pharmacyOrders: () => EncounterCarePharmacyOrder[];
    radiologyOrders: () => EncounterCareRadiologyOrder[];
    theatreProcedures: () => EncounterCareTheatreProcedure[];
    onOrderChanged: (
        type?: EncounterInlineOrderType,
        order?: Record<string, unknown>,
    ) => void;
}) {
    const permissions = usePermissions();

    const canReadLaboratoryOrders = computed(() =>
        permissions.has('laboratory.orders.read'),
    );
    const canCreateLaboratoryOrders = computed(() =>
        permissions.has('lab.order'),
    );
    const canReadPharmacyOrders = computed(() =>
        permissions.has('pharmacy.orders.read'),
    );
    const canCreatePharmacyOrders = computed(() =>
        permissions.has('medication.prescribe'),
    );
    const canReadRadiologyOrders = computed(() =>
        permissions.has('radiology.orders.read'),
    );
    const canCreateRadiologyOrders = computed(() =>
        permissions.has('imaging.order'),
    );
    const canReadTheatreProcedures = computed(() =>
        permissions.has('theatre.procedures.read'),
    );
    const canCreateTheatreProcedures = computed(() =>
        permissions.has('theatre.procedures.create'),
    );
    const canReadBillingInvoices = computed(() =>
        permissions.has('billing.invoices.read'),
    );
    const canCreateBillingInvoices = computed(() =>
        permissions.has('billing.invoices.create'),
    );

    const canOpenLaboratoryWorkflow = computed(
        () => canReadLaboratoryOrders.value && canCreateLaboratoryOrders.value,
    );
    const canOpenPharmacyWorkflow = computed(
        () => canReadPharmacyOrders.value && canCreatePharmacyOrders.value,
    );
    const canOpenRadiologyWorkflow = computed(
        () => canReadRadiologyOrders.value && canCreateRadiologyOrders.value,
    );
    const canOpenTheatreWorkflow = computed(
        () =>
            canReadTheatreProcedures.value && canCreateTheatreProcedures.value,
    );
    const canOpenBillingWorkflow = computed(() => canReadBillingInvoices.value);
    const canCreateBillingWorkflow = computed(
        () => canReadBillingInvoices.value && canCreateBillingInvoices.value,
    );

    const hasWorkflowActions = computed(
        () =>
            canOpenLaboratoryWorkflow.value ||
            canOpenPharmacyWorkflow.value ||
            canOpenRadiologyWorkflow.value ||
            canOpenTheatreWorkflow.value ||
            canOpenBillingWorkflow.value,
    );

    function canUseInlineOrders(): boolean {
        return Boolean(
            options.patientId().trim() &&
            (options.encounterId().trim() ||
                (options.appointmentId() ?? '').trim() ||
                (options.admissionId() ?? '').trim()),
        );
    }

    const careSummaries = computed<CreateEncounterCareSummary[]>(() => {
        const summaries: CreateEncounterCareSummary[] = [];
        const loading = options.isLoading();
        const error = options.loadError();

        if (canReadLaboratoryOrders.value) {
            summaries.push({
                id: 'laboratory-orders',
                label: 'Laboratory orders',
                singularLabel: 'order',
                pluralLabel: 'orders',
                description:
                    'Tests, specimen workflow, and result progression.',
                icon: 'flask-conical',
                count: options.laboratoryOrders().length,
                state: encounterCareState(
                    options.laboratoryOrders().length,
                    loading,
                    error,
                ),
            });
        }

        if (canReadPharmacyOrders.value) {
            summaries.push({
                id: 'pharmacy-orders',
                label: 'Pharmacy orders',
                singularLabel: 'order',
                pluralLabel: 'orders',
                description:
                    'Medication requests, dispensing status, and supply follow-up.',
                icon: 'pill',
                count: options.pharmacyOrders().length,
                state: encounterCareState(
                    options.pharmacyOrders().length,
                    loading,
                    error,
                ),
            });
        }

        if (canReadRadiologyOrders.value) {
            summaries.push({
                id: 'radiology-orders',
                label: 'Imaging orders',
                singularLabel: 'order',
                pluralLabel: 'orders',
                description:
                    'Scheduling, study execution, and reporting status.',
                icon: 'activity',
                count: options.radiologyOrders().length,
                state: encounterCareState(
                    options.radiologyOrders().length,
                    loading,
                    error,
                ),
            });
        }

        if (canReadTheatreProcedures.value) {
            summaries.push({
                id: 'theatre-procedures',
                label: 'Theatre procedures',
                singularLabel: 'procedure',
                pluralLabel: 'procedures',
                description:
                    'Bookings, pre-op readiness, and theatre progression.',
                icon: 'scissors',
                count: options.theatreProcedures().length,
                state: encounterCareState(
                    options.theatreProcedures().length,
                    loading,
                    error,
                ),
            });
        }

        return summaries;
    });

    const visibleCareSummaries = computed(() =>
        careSummaries.value.filter((summary) => summary.state !== 'empty'),
    );
    const canShowCare = computed(
        () =>
            Boolean(options.patientId().trim()) &&
            careSummaries.value.length > 0,
    );
    const careCountLabel = computed(() => {
        const total = careSummaries.value.reduce(
            (sum, summary) => sum + summary.count,
            0,
        );
        return `${total} ${total === 1 ? 'linked item' : 'linked items'}`;
    });
    const careActiveCount = computed(
        () =>
            careSummaries.value.filter((summary) => summary.state === 'active')
                .length,
    );

    // Inline order (lab/pharmacy/radiology) dialog state.
    const inlineOrderType = ref<EncounterInlineOrderType | null>(null);
    const inlineOrderLinkage = ref<EncounterInlineOrderLinkageContext | null>(
        null,
    );
    const careTab = ref<CreateEncounterCareSectionId | ''>('');

    const inlineOrderContext = computed(() => ({
        patientId: options.patientId().trim(),
        encounterId: options.encounterId().trim() || undefined,
        appointmentId: (options.appointmentId() ?? '').trim() || undefined,
        admissionId: (options.admissionId() ?? '').trim() || undefined,
    }));

    function careTabFor(
        type: EncounterInlineOrderType,
    ): CreateEncounterCareSectionId {
        if (type === 'laboratory') return 'laboratory-orders';
        if (type === 'pharmacy') return 'pharmacy-orders';
        return 'radiology-orders';
    }

    function openInlineOrder(
        type: EncounterInlineOrderType,
        linkage?: EncounterInlineOrderLinkageContext | null,
    ): void {
        inlineOrderType.value = type;
        inlineOrderLinkage.value = linkage ?? null;
        careTab.value = careTabFor(type);
    }

    function closeInlineOrder(): void {
        inlineOrderType.value = null;
        inlineOrderLinkage.value = null;
    }

    function handleInlineOrderCreated(
        type: EncounterInlineOrderType,
        order?: Record<string, unknown>,
    ): void {
        inlineOrderType.value = null;
        inlineOrderLinkage.value = null;
        careTab.value = careTabFor(type);
        options.onOrderChanged(type, order);
    }

    // Context-preserving href builder for workflows that link out to their
    // own full pages (theatre procedures, billing) rather than opening
    // inline.
    function contextCreateHref(
        path: string,
        linkOptions?: {
            includeTabNew?: boolean;
            reorderOfId?: string | null;
            addOnToOrderId?: string | null;
        },
    ): string {
        const params = new URLSearchParams();
        const patientId = options.patientId().trim();
        const encounterId = options.encounterId().trim();
        const appointmentId = (options.appointmentId() ?? '').trim();
        const admissionId = (options.admissionId() ?? '').trim();

        if (linkOptions?.includeTabNew) params.set('tab', 'new');
        if (patientId) params.set('patientId', patientId);
        if (encounterId) params.set('encounterId', encounterId);
        if (appointmentId) params.set('appointmentId', appointmentId);
        if (admissionId) params.set('admissionId', admissionId);
        if (linkOptions?.reorderOfId?.trim()) {
            params.set('reorderOfId', linkOptions.reorderOfId.trim());
        }
        if (linkOptions?.addOnToOrderId?.trim()) {
            params.set('addOnToOrderId', linkOptions.addOnToOrderId.trim());
        }
        if (encounterId) {
            params.set('returnTo', `/encounters/${encounterId}/v2`);
        }

        const queryString = params.toString();
        return queryString ? `${path}?${queryString}` : path;
    }

    // Lifecycle (cancel / discontinue / entered-in-error) dialog state.
    const lifecycleDialogOpen = ref(false);
    const lifecycleTargetKind = ref<EncounterLifecycleTargetKind | null>(null);
    const lifecycleTargetId = ref('');
    const lifecycleAction = ref<EncounterLifecycleAction | null>(null);
    const lifecycleReason = ref('');
    const lifecycleError = ref<string | null>(null);
    const lifecycleSubmitting = ref(false);

    function openLifecycleDialog(
        kind: EncounterLifecycleTargetKind,
        id: string,
        action: EncounterLifecycleAction,
        defaultReason?: string | null,
    ): void {
        lifecycleTargetKind.value = kind;
        lifecycleTargetId.value = id;
        lifecycleAction.value = action;
        lifecycleReason.value = String(defaultReason ?? '').trim();
        lifecycleError.value = null;
        lifecycleDialogOpen.value = true;
    }

    function closeLifecycleDialog(): void {
        lifecycleDialogOpen.value = false;
        lifecycleTargetKind.value = null;
        lifecycleTargetId.value = '';
        lifecycleAction.value = null;
        lifecycleReason.value = '';
        lifecycleError.value = null;
    }

    function findLifecycleTarget(): LifecycleTarget | null {
        const kind = lifecycleTargetKind.value;
        const id = lifecycleTargetId.value;
        if (!kind || !id) return null;

        if (kind === 'laboratory') {
            return (
                options.laboratoryOrders().find((order) => order.id === id) ??
                null
            );
        }
        if (kind === 'pharmacy') {
            return (
                options.pharmacyOrders().find((order) => order.id === id) ??
                null
            );
        }
        if (kind === 'radiology') {
            return (
                options.radiologyOrders().find((order) => order.id === id) ??
                null
            );
        }
        return (
            options
                .theatreProcedures()
                .find((procedure) => procedure.id === id) ?? null
        );
    }

    function lifecycleTargetName(): string {
        const target = findLifecycleTarget();
        const kind = lifecycleTargetKind.value;
        if (!target || !kind) return 'this order';

        if (kind === 'laboratory') {
            const order = target as EncounterCareLaboratoryOrder;
            return (
                order.testName?.trim() ||
                order.orderNumber?.trim() ||
                'this laboratory order'
            );
        }
        if (kind === 'pharmacy') {
            const order = target as EncounterCarePharmacyOrder;
            return (
                order.medicationName?.trim() ||
                order.orderNumber?.trim() ||
                'this medication order'
            );
        }
        if (kind === 'radiology') {
            const order = target as EncounterCareRadiologyOrder;
            return (
                order.studyDescription?.trim() ||
                order.orderNumber?.trim() ||
                'this imaging order'
            );
        }
        const procedure = target as EncounterCareTheatreProcedure;
        return (
            procedure.procedureName?.trim() ||
            procedure.procedureType?.trim() ||
            procedure.procedureNumber?.trim() ||
            'this procedure booking'
        );
    }

    async function submitLifecycleDialog(): Promise<void> {
        const kind = lifecycleTargetKind.value;
        const id = lifecycleTargetId.value;
        const action = lifecycleAction.value;
        if (!kind || !id || !action) return;

        const reason = lifecycleReason.value.trim();
        if (!reason) {
            lifecycleError.value = 'Clinical reason is required.';
            return;
        }

        lifecycleSubmitting.value = true;
        lifecycleError.value = null;

        try {
            await apiPost(encounterLifecycleActionPath(kind, id), {
                body: { action, reason },
            });
            notifySuccess(encounterLifecycleActionSuccessMessage(action));
            options.onOrderChanged();
            closeLifecycleDialog();
        } catch (error) {
            lifecycleError.value = messageFromUnknown(
                error,
                'Unable to apply lifecycle action.',
            );
            notifyError(lifecycleError.value);
        } finally {
            lifecycleSubmitting.value = false;
        }
    }

    return {
        canOpenLaboratoryWorkflow,
        canOpenPharmacyWorkflow,
        canOpenRadiologyWorkflow,
        canOpenTheatreWorkflow,
        canOpenBillingWorkflow,
        canCreateBillingWorkflow,
        canCreateLaboratoryOrders,
        canCreatePharmacyOrders,
        canCreateRadiologyOrders,
        canCreateTheatreProcedures,
        hasWorkflowActions,
        canUseInlineOrders,
        careSummaries,
        visibleCareSummaries,
        canShowCare,
        careCountLabel,
        careActiveCount,
        careTab,
        inlineOrderType,
        inlineOrderLinkage,
        inlineOrderContext,
        openInlineOrder,
        closeInlineOrder,
        handleInlineOrderCreated,
        contextCreateHref,
        lifecycleDialogOpen,
        lifecycleAction,
        lifecycleReason,
        lifecycleError,
        lifecycleSubmitting,
        openLifecycleDialog,
        closeLifecycleDialog,
        lifecycleTargetName,
        submitLifecycleDialog,
    };
}

export function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}
