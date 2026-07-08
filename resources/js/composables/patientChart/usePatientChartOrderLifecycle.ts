import { ref, type Ref } from 'vue';
import { apiPost } from '@/lib/apiClient';
import {
    encounterLifecycleActionPath,
    encounterLifecycleActionSuccessMessage,
    type EncounterLifecycleAction,
    type EncounterLifecycleTargetKind,
} from '@/lib/encounterWorkspaceLifecycle';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type {
    PatientChartLaboratoryOrder,
    PatientChartPharmacyOrder,
    PatientChartRadiologyOrder,
    PatientChartTheatreProcedure,
} from '@/composables/patientChart/patientChartOrderTypes';

type LifecycleTarget = PatientChartLaboratoryOrder | PatientChartPharmacyOrder | PatientChartRadiologyOrder | PatientChartTheatreProcedure;

/**
 * Standalone dialog-state + submit mutation for the Orders tab's
 * cancel/discontinue/entered-in-error actions. Mirrors the lifecycle block
 * inside useEncounterOrdering.ts (see composables/clinical/useEncounterOrdering.ts)
 * rather than refactoring it — that composable already backs the shipped,
 * tested WorkspaceV2.vue, and this workspace's target lists (4 domains, all
 * patient-scoped) are shaped differently enough that sharing state directly
 * isn't a clean fit. The UI itself is fully shared via EncounterLifecycleDialog.vue.
 */
export function usePatientChartOrderLifecycle(options: {
    laboratoryOrders: Ref<PatientChartLaboratoryOrder[]>;
    pharmacyOrders: Ref<PatientChartPharmacyOrder[]>;
    radiologyOrders: Ref<PatientChartRadiologyOrder[]>;
    theatreProcedures: Ref<PatientChartTheatreProcedure[]>;
    onChanged: () => void;
}) {
    const dialogOpen = ref(false);
    const targetKind = ref<EncounterLifecycleTargetKind | null>(null);
    const targetId = ref('');
    const action = ref<EncounterLifecycleAction | null>(null);
    const reason = ref('');
    const error = ref<string | null>(null);
    const submitting = ref(false);

    function openDialog(
        kind: EncounterLifecycleTargetKind,
        id: string,
        nextAction: EncounterLifecycleAction,
        defaultReason?: string | null,
    ): void {
        targetKind.value = kind;
        targetId.value = id;
        action.value = nextAction;
        reason.value = String(defaultReason ?? '').trim();
        error.value = null;
        dialogOpen.value = true;
    }

    function closeDialog(): void {
        dialogOpen.value = false;
        targetKind.value = null;
        targetId.value = '';
        action.value = null;
        reason.value = '';
        error.value = null;
    }

    function findTarget(): LifecycleTarget | null {
        const kind = targetKind.value;
        const id = targetId.value;
        if (!kind || !id) return null;

        if (kind === 'laboratory') return options.laboratoryOrders.value.find((order) => order.id === id) ?? null;
        if (kind === 'pharmacy') return options.pharmacyOrders.value.find((order) => order.id === id) ?? null;
        if (kind === 'radiology') return options.radiologyOrders.value.find((order) => order.id === id) ?? null;
        return options.theatreProcedures.value.find((procedure) => procedure.id === id) ?? null;
    }

    function targetName(): string {
        const target = findTarget();
        const kind = targetKind.value;
        if (!target || !kind) return 'this order';

        if (kind === 'laboratory') {
            const order = target as PatientChartLaboratoryOrder;
            return order.testName?.trim() || order.orderNumber?.trim() || 'this laboratory order';
        }
        if (kind === 'pharmacy') {
            const order = target as PatientChartPharmacyOrder;
            return order.medicationName?.trim() || order.orderNumber?.trim() || 'this medication order';
        }
        if (kind === 'radiology') {
            const order = target as PatientChartRadiologyOrder;
            return order.studyDescription?.trim() || order.orderNumber?.trim() || 'this imaging order';
        }
        const procedure = target as PatientChartTheatreProcedure;
        return procedure.procedureName?.trim() || procedure.procedureType?.trim() || procedure.procedureNumber?.trim() || 'this procedure booking';
    }

    async function submitDialog(): Promise<void> {
        const kind = targetKind.value;
        const id = targetId.value;
        const nextAction = action.value;
        if (!kind || !id || !nextAction) return;

        const trimmedReason = reason.value.trim();
        if (!trimmedReason) {
            error.value = 'Clinical reason is required.';
            return;
        }

        submitting.value = true;
        error.value = null;

        try {
            await apiPost(encounterLifecycleActionPath(kind, id), { body: { action: nextAction, reason: trimmedReason } });
            notifySuccess(encounterLifecycleActionSuccessMessage(nextAction));
            options.onChanged();
            closeDialog();
        } catch (caught) {
            error.value = messageFromUnknown(caught, 'Unable to apply lifecycle action.');
            notifyError(error.value);
        } finally {
            submitting.value = false;
        }
    }

    return {
        dialogOpen,
        action,
        reason,
        error,
        submitting,
        openDialog,
        closeDialog,
        targetName,
        submitDialog,
    };
}
