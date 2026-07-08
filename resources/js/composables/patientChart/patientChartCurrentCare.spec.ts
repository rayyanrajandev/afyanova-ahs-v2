import { describe, expect, it } from 'vitest';
import {
    canCreateLaboratoryEncounterFollowOnOrder,
    canCreatePharmacyEncounterFollowOnOrder,
    currentCareNextAction,
    currentCareNextActionHref,
    extractLaboratoryResultFlag,
    hasLaboratoryEncounterMoreActions,
    hasPharmacyEncounterMoreActions,
    isCurrentLaboratoryOrder,
    isCurrentPharmacyOrder,
    laboratoryClinicalSignal,
    laboratoryCurrentPriority,
    pharmacyOrderQuantityLabel,
    radiologyClinicalSignal,
    serviceTimelineActionLabel,
    sortCurrentItems,
} from './patientChartCurrentCare';
import { canApplyLaboratoryEncounterLifecycleAction } from '@/lib/encounterWorkspaceLifecycle';
import type { PatientChartLaboratoryOrder, PatientChartPharmacyOrder } from './patientChartOrderTypes';

function labOrder(overrides: Partial<PatientChartLaboratoryOrder> = {}): PatientChartLaboratoryOrder {
    return {
        id: 'lab-1',
        orderNumber: 'LAB-1',
        patientId: 'pat-1',
        appointmentId: null,
        encounterId: 'enc-1',
        replacesOrderId: null,
        addOnToOrderId: null,
        orderedAt: '2026-01-01T00:00:00Z',
        testName: 'CBC',
        priority: 'routine',
        resultSummary: null,
        resultedAt: null,
        status: 'ordered',
        statusReason: null,
        lifecycleReasonCode: null,
        enteredInErrorAt: null,
        ...overrides,
    };
}

function pharmacyOrder(overrides: Partial<PatientChartPharmacyOrder> = {}): PatientChartPharmacyOrder {
    return {
        id: 'rx-1',
        orderNumber: 'RX-1',
        patientId: 'pat-1',
        appointmentId: null,
        encounterId: 'enc-1',
        replacesOrderId: null,
        addOnToOrderId: null,
        orderedAt: '2026-01-01T00:00:00Z',
        medicationName: 'Amoxicillin',
        dosageInstruction: '500mg twice daily',
        quantityPrescribed: 20,
        quantityDispensed: null,
        dispensedAt: null,
        reconciliationStatus: null,
        reconciledAt: null,
        status: 'pending',
        statusReason: null,
        lifecycleReasonCode: null,
        enteredInErrorAt: null,
        ...overrides,
    };
}

describe('extractLaboratoryResultFlag', () => {
    it('reads the result flag token out of a free-text result summary', () => {
        expect(extractLaboratoryResultFlag('Result flag: critical - notify physician')).toBe('critical');
        expect(extractLaboratoryResultFlag('Result flag: abnormal')).toBe('abnormal');
        expect(extractLaboratoryResultFlag('No flag mentioned here')).toBeNull();
        expect(extractLaboratoryResultFlag(null)).toBeNull();
    });
});

describe('laboratoryClinicalSignal', () => {
    it('flags a completed order with a critical result flag as Critical result', () => {
        const signal = laboratoryClinicalSignal(labOrder({ status: 'completed', resultSummary: 'Result flag: critical' }));
        expect(signal.label).toBe('Critical result');
        expect(signal.variant).toBe('destructive');
    });

    it('labels a pending order as Pending result', () => {
        expect(laboratoryClinicalSignal(labOrder({ status: 'ordered' })).label).toBe('Pending result');
    });
});

describe('radiologyClinicalSignal', () => {
    it('flags a report mentioning "escalate" as critical', () => {
        const signal = radiologyClinicalSignal({
            id: 'rad-1',
            orderNumber: 'RAD-1',
            patientId: 'pat-1',
            appointmentId: null,
            encounterId: 'enc-1',
            replacesOrderId: null,
            addOnToOrderId: null,
            orderedAt: null,
            modality: 'xray',
            studyDescription: 'Chest X-ray',
            reportSummary: 'Findings require escalate to on-call radiologist.',
            completedAt: '2026-01-01T00:00:00Z',
            status: 'completed',
            statusReason: null,
            lifecycleReasonCode: null,
            enteredInErrorAt: null,
        });
        expect(signal.label).toBe('Critical report');
    });
});

describe('isCurrentLaboratoryOrder', () => {
    it('treats in-progress orders as current', () => {
        expect(isCurrentLaboratoryOrder(labOrder({ status: 'in_progress' }))).toBe(true);
    });

    it('treats a completed order with a normal result as not current', () => {
        expect(
            isCurrentLaboratoryOrder(
                labOrder({ status: 'completed', resultSummary: 'Result flag: normal', resultedAt: '2020-01-01T00:00:00Z' }),
            ),
        ).toBe(false);
    });

    it('treats a completed critical result as current regardless of age', () => {
        expect(
            isCurrentLaboratoryOrder(
                labOrder({ status: 'completed', resultSummary: 'Result flag: critical', resultedAt: '2020-01-01T00:00:00Z' }),
            ),
        ).toBe(true);
    });

    it('defers to an explicit currentCare.isCurrent flag from the backend when present', () => {
        expect(isCurrentLaboratoryOrder(labOrder({ status: 'completed', currentCare: { isCurrent: true, requiresReview: false, priorityRank: 0 } }))).toBe(true);
    });
});

describe('isCurrentPharmacyOrder', () => {
    it('treats a dispensed-but-unreconciled order as current', () => {
        expect(isCurrentPharmacyOrder(pharmacyOrder({ status: 'dispensed', reconciliationStatus: 'pending' }))).toBe(true);
    });

    it('treats a dispensed-and-reconciled order older than 30 days as not current', () => {
        expect(
            isCurrentPharmacyOrder(
                pharmacyOrder({ status: 'dispensed', reconciliationStatus: 'reconciled', dispensedAt: '2020-01-01T00:00:00Z' }),
            ),
        ).toBe(false);
    });
});

describe('sortCurrentItems + laboratoryCurrentPriority', () => {
    it('sorts a critical completed result above an in-progress order', () => {
        const critical = labOrder({ id: 'critical', status: 'completed', resultSummary: 'Result flag: critical' });
        const inProgress = labOrder({ id: 'in-progress', status: 'in_progress' });
        const sorted = sortCurrentItems([inProgress, critical], laboratoryCurrentPriority, () => 0);
        expect(sorted[0].id).toBe('critical');
    });
});

describe('currentCareNextAction / serviceTimelineActionLabel', () => {
    it('labels an unresulted laboratory order as "Review order"', () => {
        expect(currentCareNextAction('laboratory', labOrder())?.label).toBe('Review order');
        expect(serviceTimelineActionLabel('laboratory', labOrder())).toBe('Review order');
    });

    it('labels a resulted laboratory order as "Review result"', () => {
        expect(currentCareNextAction('laboratory', labOrder({ resultedAt: '2026-01-01T00:00:00Z' }))?.label).toBe('Review result');
    });

    it('prefers the backend-provided nextAction label when present', () => {
        const order = labOrder({ currentCare: { isCurrent: true, requiresReview: true, priorityRank: 10, nextAction: { key: 'verify', label: 'Verify result' } } });
        expect(currentCareNextAction('laboratory', order)?.label).toBe('Verify result');
    });
});

describe('currentCareNextActionHref', () => {
    it('builds a focusOrderId link into the laboratory-orders module page', () => {
        const href = currentCareNextActionHref('laboratory', labOrder({ id: 'lab-42' }), 'pat-1', 'appt-1');
        expect(href).toContain('/laboratory-orders?');
        expect(href).toContain('focusOrderId=lab-42');
        expect(href).toContain('patientId=pat-1');
    });

    it('appends focusWorkflowActionKey when the backend provides an actionable next-action key', () => {
        const order = labOrder({ id: 'lab-42', currentCare: { isCurrent: true, requiresReview: true, priorityRank: 10, nextAction: { key: 'verify', label: 'Verify' } } });
        const href = currentCareNextActionHref('laboratory', order, 'pat-1', null);
        expect(href).toContain('focusWorkflowActionKey=verify');
    });
});

describe('follow-on order + more-actions gating', () => {
    it('allows a follow-on order only when the user can create and the order is not entered-in-error', () => {
        expect(canCreateLaboratoryEncounterFollowOnOrder(labOrder(), true)).toBe(true);
        expect(canCreateLaboratoryEncounterFollowOnOrder(labOrder(), false)).toBe(false);
        expect(canCreateLaboratoryEncounterFollowOnOrder(labOrder({ enteredInErrorAt: '2026-01-01T00:00:00Z' }), true)).toBe(false);
    });

    it('disallows cancel once a laboratory order is completed, but still allows entered-in-error', () => {
        expect(canApplyLaboratoryEncounterLifecycleAction(labOrder({ status: 'ordered' }), 'cancel', true)).toBe(true);
        expect(canApplyLaboratoryEncounterLifecycleAction(labOrder({ status: 'completed' }), 'cancel', true)).toBe(false);
        expect(canApplyLaboratoryEncounterLifecycleAction(labOrder({ status: 'completed' }), 'entered_in_error', true)).toBe(true);
    });

    it('has no more-actions at all once an order is already entered in error', () => {
        expect(hasLaboratoryEncounterMoreActions(labOrder({ enteredInErrorAt: '2026-01-01T00:00:00Z' }), true)).toBe(false);
    });

    it('offers discontinue for pharmacy orders even mid-dispense, unlike laboratory orders', () => {
        expect(hasPharmacyEncounterMoreActions(pharmacyOrder({ status: 'partially_dispensed' }), true)).toBe(true);
        expect(canCreatePharmacyEncounterFollowOnOrder(pharmacyOrder(), true)).toBe(true);
    });
});

describe('pharmacyOrderQuantityLabel', () => {
    it('formats a numeric quantity with a Qty prefix', () => {
        expect(pharmacyOrderQuantityLabel(20)).toBe('Qty 20');
    });

    it('returns null for an empty quantity', () => {
        expect(pharmacyOrderQuantityLabel(null)).toBeNull();
        expect(pharmacyOrderQuantityLabel(undefined)).toBeNull();
    });
});
