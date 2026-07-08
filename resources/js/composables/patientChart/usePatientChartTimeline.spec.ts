import { computed, ref, type Ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { usePatientChartTimeline, type UsePatientChartTimelineParams } from './usePatientChartTimeline';
import type { PatientChartAppointment } from './usePatientAppointments';
import type { PatientChartMedicalRecord } from './usePatientMedicalRecords';
import type { PatientChartLaboratoryOrder } from './patientChartOrderTypes';

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

function record(overrides: Partial<PatientChartMedicalRecord> = {}): PatientChartMedicalRecord {
    return {
        id: 'rec-1',
        recordNumber: 'MR-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        admissionId: null,
        encounterAt: '2026-01-01T00:00:00Z',
        recordType: 'consultation_note',
        assessment: 'Stable',
        plan: 'Follow up in 2 weeks',
        diagnosisCode: null,
        status: 'finalized',
        ...overrides,
    };
}

function labOrder(overrides: Partial<PatientChartLaboratoryOrder> = {}): PatientChartLaboratoryOrder {
    return {
        id: 'lab-1',
        orderNumber: 'LAB-1',
        patientId: 'pat-1',
        appointmentId: 'appt-1',
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

function boolRef(value = false): Ref<boolean> {
    return ref(value);
}

function buildParams(overrides: Partial<UsePatientChartTimelineParams> = {}): UsePatientChartTimelineParams {
    const primaryVisit = overrides.primaryVisit ?? computed(() => null);

    return {
        patientId: ref('pat-1'),
        primaryVisit,
        focusedEncounterId: ref(null),
        canReadAppointments: boolRef(true),
        canRecordOpdTriage: boolRef(false),
        canStartConsultation: boolRef(false),
        canReadMedicalRecords: boolRef(true),
        canReadLaboratoryOrders: boolRef(true),
        canReadRadiologyOrders: boolRef(true),
        canReadPharmacyOrders: boolRef(true),
        canReadTheatreProcedures: boolRef(true),
        canReadBillingInvoices: boolRef(true),
        appointments: ref([]),
        records: ref([]),
        recordsTotal: ref(0),
        laboratoryOrders: ref([]),
        radiologyOrders: ref([]),
        pharmacyOrders: ref([]),
        theatreProcedures: ref([]),
        billingInvoices: ref([]),
        laboratoryOrderCounts: ref(undefined),
        radiologyOrderCounts: ref(undefined),
        pharmacyOrderCounts: ref(undefined),
        theatreProcedureCounts: ref(undefined),
        billingInvoiceCounts: ref(undefined),
        ...overrides,
    };
}

describe('focusedEncounterEvents (the appointmentId → encounterId bug fix)', () => {
    it('matches non-visit events by the real encounterId, not by appointmentId', () => {
        const visit = appointment({ id: 'appt-1' });
        const params = buildParams({
            primaryVisit: computed(() => visit),
            focusedEncounterId: ref('enc-1'),
            appointments: ref([visit]),
            records: ref([record({ appointmentId: 'appt-1', encounterId: 'enc-1' })]),
            // Same appointmentId, but belongs to a DIFFERENT encounter (e.g. a re-opened visit) —
            // the old appointmentId-based filter would have wrongly included this.
            laboratoryOrders: ref([labOrder({ id: 'lab-other-encounter', appointmentId: 'appt-1', encounterId: 'enc-2' })]),
        });

        const timeline = usePatientChartTimeline(params);
        const ids = timeline.focusedEncounterEvents.value.map((event) => event.id);

        expect(ids).toContain('record-rec-1');
        expect(ids).not.toContain('lab-lab-other-encounter');
    });

    it('still matches the visit event itself by appointmentId, since it carries no encounterId', () => {
        const visit = appointment({ id: 'appt-1' });
        const params = buildParams({
            primaryVisit: computed(() => visit),
            focusedEncounterId: ref('enc-1'),
            appointments: ref([visit]),
        });

        const timeline = usePatientChartTimeline(params);
        expect(timeline.focusedEncounterEvents.value.map((event) => event.id)).toContain('visit-appt-1');
    });

    it('returns no events when no visit is focused', () => {
        const params = buildParams({ primaryVisit: computed(() => null) });
        const timeline = usePatientChartTimeline(params);
        expect(timeline.focusedEncounterEvents.value).toEqual([]);
    });

    it('returns no non-visit events when the focused visit has no resolved encounter yet', () => {
        const visit = appointment({ id: 'appt-1' });
        const params = buildParams({
            primaryVisit: computed(() => visit),
            focusedEncounterId: ref(null),
            appointments: ref([visit]),
            records: ref([record({ appointmentId: 'appt-1', encounterId: 'enc-1' })]),
        });

        const timeline = usePatientChartTimeline(params);
        const ids = timeline.focusedEncounterEvents.value.map((event) => event.id);
        expect(ids).toContain('visit-appt-1');
        expect(ids).not.toContain('record-rec-1');
    });
});

describe('careCounts', () => {
    it('is derived from the server status-counts responses, not the (perPage-truncated) order lists', () => {
        const params = buildParams({
            laboratoryOrders: ref([labOrder()]),
            laboratoryOrderCounts: ref({ ordered: 12, collected: 3, in_progress: 1, completed: 40, cancelled: 0, total: 56 }),
        });

        const timeline = usePatientChartTimeline(params);
        expect(timeline.careCounts.value.labActive).toBe(16);
        expect(timeline.careCounts.value.labCompleted).toBe(40);
    });
});

describe('timelineEvents ordering', () => {
    it('sorts events by occurredAt, most recent first', () => {
        const params = buildParams({
            records: ref([
                record({ id: 'older', encounterAt: '2025-01-01T00:00:00Z' }),
                record({ id: 'newer', encounterAt: '2026-06-01T00:00:00Z' }),
            ]),
        });

        const timeline = usePatientChartTimeline(params);
        expect(timeline.timelineEvents.value.map((event) => event.id)).toEqual(['record-newer', 'record-older']);
    });
});
