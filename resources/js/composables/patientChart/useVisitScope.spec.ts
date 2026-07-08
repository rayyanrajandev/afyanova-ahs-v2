import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { useVisitScope } from './useVisitScope';
import type { PatientChartAppointment } from './usePatientAppointments';
import type { PatientChartEncounterSummary } from './usePatientEncounters';

function appointment(overrides: Partial<PatientChartAppointment> = {}): PatientChartAppointment {
    return {
        id: 'appt-1',
        appointmentNumber: 'APT-1',
        department: 'OPD',
        scheduledAt: '2026-01-01T00:00:00Z',
        durationMinutes: 30,
        reason: 'Follow-up',
        triageVitalsSummary: null,
        status: 'in_consultation',
        ...overrides,
    };
}

function encounter(overrides: Partial<PatientChartEncounterSummary> = {}): PatientChartEncounterSummary {
    return {
        id: 'enc-1',
        encounterNumber: 'ENC-1',
        appointmentId: 'appt-1',
        admissionId: null,
        status: 'in_progress',
        openedAt: '2026-01-01T00:00:00Z',
        closedAt: null,
        ...overrides,
    };
}

function setup(options: {
    canReadAppointments?: boolean;
    hasOrdersAndResultsAccess?: boolean;
    visit?: PatientChartAppointment | null;
    encounters?: PatientChartEncounterSummary[];
}) {
    const primaryVisit = computed(() => options.visit ?? null);
    return useVisitScope({
        canReadAppointments: ref(options.canReadAppointments ?? true),
        hasOrdersAndResultsAccess: ref(options.hasOrdersAndResultsAccess ?? true),
        primaryVisit,
        appointmentsLoading: ref(false),
        appointmentsCount: ref(1),
        encounters: ref(options.encounters ?? []),
    });
}

describe('focusedEncounterId', () => {
    it('resolves the real encounterId from the focused appointment, not the appointmentId itself', () => {
        const scope = setup({ visit: appointment({ id: 'appt-1' }), encounters: [encounter({ id: 'enc-99', appointmentId: 'appt-1' })] });
        expect(scope.focusedEncounterId.value).toBe('enc-99');
        expect(scope.focusedEncounterId.value).not.toBe('appt-1');
    });

    it('is null when the focused visit has no matching encounter yet', () => {
        const scope = setup({ visit: appointment({ id: 'appt-1' }), encounters: [] });
        expect(scope.focusedEncounterId.value).toBeNull();
    });

    it('is null when there is no focused visit at all', () => {
        const scope = setup({ visit: null, encounters: [encounter()] });
        expect(scope.focusedEncounterId.value).toBeNull();
    });
});

describe('scope availability', () => {
    it('offers focused/current/history when a visit is focused and orders access exists', () => {
        const scope = setup({ visit: appointment() });
        expect(scope.availableOrdersWorkspaceScopes.value).toEqual(['focused', 'current', 'history']);
        expect(scope.defaultOrdersWorkspaceScope.value).toBe('focused');
    });

    it('drops "focused" when there is no visit in chart focus', () => {
        const scope = setup({ visit: null });
        expect(scope.availableOrdersWorkspaceScopes.value).toEqual(['current', 'history']);
        expect(scope.defaultOrdersWorkspaceScope.value).toBe('current');
    });

    it('falls back to history-only when the role has neither appointments nor orders access', () => {
        const scope = setup({ visit: appointment(), canReadAppointments: false, hasOrdersAndResultsAccess: false });
        expect(scope.availableOrdersWorkspaceScopes.value).toEqual(['history']);
        expect(scope.defaultOrdersWorkspaceScope.value).toBe('history');
    });
});

describe('useFocusedVisitOrdersScope / useCurrentOrdersScope', () => {
    it('is only true for the scope currently selected and actually available', () => {
        const scope = setup({ visit: appointment() });
        scope.ordersWorkspaceScope.value = 'focused';
        expect(scope.useFocusedVisitOrdersScope.value).toBe(true);
        expect(scope.useCurrentOrdersScope.value).toBe(false);

        scope.ordersWorkspaceScope.value = 'current';
        expect(scope.useFocusedVisitOrdersScope.value).toBe(false);
        expect(scope.useCurrentOrdersScope.value).toBe(true);
    });
});
