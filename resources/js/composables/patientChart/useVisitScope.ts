import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { PatientChartAppointment } from '@/composables/patientChart/usePatientAppointments';
import type { PatientChartEncounterSummary } from '@/composables/patientChart/usePatientEncounters';

export type OrdersWorkspaceScope = 'focused' | 'current' | 'history';

export type UseVisitScopeParams = {
    canReadAppointments: Ref<boolean>;
    hasOrdersAndResultsAccess: Ref<boolean>;
    primaryVisit: ComputedRef<PatientChartAppointment | null>;
    appointmentsLoading: Ref<boolean>;
    appointmentsCount: ComputedRef<number> | Ref<number>;
    encounters: Ref<PatientChartEncounterSummary[]>;
};

/**
 * The "Focused visit / Current care / All visits" toggle, plus the
 * appointmentId → encounterId resolution (see §4 of
 * reports/patient-chart-rebuild-plan.md). "Focused visit" now correctly
 * scopes by the real EncounterModel instead of the Appointment id — this
 * also makes admission-based encounters (no appointment) resolvable in
 * principle, though Patient Chart has no "focus an admission" UI today, so
 * that case isn't reachable yet; only the appointment-linked path is wired.
 */
export function useVisitScope(params: UseVisitScopeParams) {
    const ordersWorkspaceScope = ref<OrdersWorkspaceScope>('history');

    const hasFocusedVisitInChart = computed(() => Boolean(params.primaryVisit.value?.id));

    const focusedEncounterId = computed<string | null>(() => {
        const appointmentId = params.primaryVisit.value?.id;
        if (!appointmentId) return null;

        return (
            params.encounters.value.find((encounter) => encounter.appointmentId === appointmentId)?.id ?? null
        );
    });

    const canUseFocusedVisitOrdersScope = computed(
        () => params.canReadAppointments.value && hasFocusedVisitInChart.value,
    );

    const useFocusedVisitOrdersScope = computed(
        () => ordersWorkspaceScope.value === 'focused' && canUseFocusedVisitOrdersScope.value,
    );

    const useCurrentOrdersScope = computed(
        () => ordersWorkspaceScope.value === 'current' && params.hasOrdersAndResultsAccess.value,
    );

    const availableOrdersWorkspaceScopes = computed<OrdersWorkspaceScope[]>(() => {
        const scopes: OrdersWorkspaceScope[] = [];
        if (canUseFocusedVisitOrdersScope.value) scopes.push('focused');
        if (params.hasOrdersAndResultsAccess.value) scopes.push('current');
        scopes.push('history');
        return Array.from(new Set(scopes));
    });

    const defaultOrdersWorkspaceScope = computed<OrdersWorkspaceScope>(() => {
        if (canUseFocusedVisitOrdersScope.value) return 'focused';
        if (params.hasOrdersAndResultsAccess.value) return 'current';
        return 'history';
    });

    watch(
        availableOrdersWorkspaceScopes,
        (scopes) => {
            if (!scopes.includes(ordersWorkspaceScope.value)) {
                ordersWorkspaceScope.value = defaultOrdersWorkspaceScope.value;
            }
        },
        { immediate: true },
    );

    const ordersWorkspaceScopeSummary = computed(() => {
        if (params.appointmentsLoading.value && params.canReadAppointments.value && params.appointmentsCount.value === 0) {
            return 'Current view: checking visit context...';
        }
        if (useFocusedVisitOrdersScope.value && params.primaryVisit.value) {
            return `Current view: focused visit (${params.primaryVisit.value.appointmentNumber || 'Visit'})`;
        }
        if (useCurrentOrdersScope.value) {
            return 'Current view: current care';
        }
        return 'Current view: all visits';
    });

    const ordersWorkspaceScopeHint = computed(() => {
        if (params.appointmentsLoading.value && params.canReadAppointments.value && params.appointmentsCount.value === 0) {
            return 'The chart is checking whether there is an active or scheduled visit to focus.';
        }
        if (useFocusedVisitOrdersScope.value) {
            return 'Only orders and results linked to this visit are shown.';
        }
        if (useCurrentOrdersScope.value) {
            return 'Active orders, unreconciled medication work, and recent results are shown first.';
        }
        if (!params.canReadAppointments.value && params.hasOrdersAndResultsAccess.value) {
            return 'This role works from current clinical activity or full patient history, not visit-by-visit encounter focus.';
        }
        if (canUseFocusedVisitOrdersScope.value) {
            return 'Orders and results from all visits are shown. Switch to Focused visit or Current care to narrow the workspace.';
        }
        return 'No active or scheduled visit is available to focus, so the chart is showing the patient history.';
    });

    return {
        ordersWorkspaceScope,
        focusedEncounterId,
        hasFocusedVisitInChart,
        canUseFocusedVisitOrdersScope,
        useFocusedVisitOrdersScope,
        useCurrentOrdersScope,
        availableOrdersWorkspaceScopes,
        defaultOrdersWorkspaceScope,
        ordersWorkspaceScopeSummary,
        ordersWorkspaceScopeHint,
    };
}
