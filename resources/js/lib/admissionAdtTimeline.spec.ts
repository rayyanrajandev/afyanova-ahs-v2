import { describe, expect, it } from 'vitest';
import { buildAdtTimeline } from './admissionAdtTimeline';
import type { Admission } from '@/composables/admissions/useAdmissions';
import type { AdmissionAuditLog } from '@/composables/admissions/useAdmissionAuditLog';

function admission(overrides: Partial<Admission> = {}): Admission {
    return {
        id: 'adm-1',
        admissionNumber: 'ADM1',
        patientId: 'pat-1',
        appointmentId: null,
        attendingClinicianUserId: null,
        ward: null,
        bed: null,
        bedResourceId: null,
        bedResource: null,
        admittedAt: '2026-01-01T08:00:00Z',
        dischargedAt: null,
        admissionReason: 'Observation',
        notes: null,
        financialClass: null,
        billingPayerContractId: null,
        coverageReference: null,
        coverageNotes: null,
        status: 'admitted',
        statusReason: null,
        dischargeDestination: null,
        followUpPlan: null,
        createdAt: '2026-01-01T08:00:00Z',
        updatedAt: '2026-01-01T08:00:00Z',
        ...overrides,
    };
}

function auditLog(overrides: Partial<AdmissionAuditLog> = {}): AdmissionAuditLog {
    return {
        id: 'log-1',
        admissionId: 'adm-1',
        actorId: 1,
        actorType: 'user',
        action: 'admission.created',
        changes: {},
        metadata: {},
        createdAt: '2026-01-01T08:00:00Z',
        ...overrides,
    };
}

describe('buildAdtTimeline', () => {
    it('builds an admit event from the creation audit log', () => {
        const events = buildAdtTimeline(admission(), [auditLog({ action: 'admission.created' })]);

        expect(events).toHaveLength(1);
        expect(events[0].kind).toBe('admit');
        expect(events[0].source).toBe('audit');
    });

    it('falls back to a current-state admit event when no audit logs are available', () => {
        const events = buildAdtTimeline(admission(), []);

        expect(events).toHaveLength(1);
        expect(events[0].kind).toBe('admit');
        expect(events[0].source).toBe('current-state');
    });

    it('builds a transfer event from a status.updated audit log with ward/bed diffs', () => {
        const logs = [
            auditLog({ id: 'log-1', action: 'admission.created', createdAt: '2026-01-01T08:00:00Z' }),
            auditLog({
                id: 'log-2',
                action: 'admission.status.updated',
                createdAt: '2026-01-02T08:00:00Z',
                changes: {
                    ward: { before: 'Ward A', after: 'Ward B' },
                    bed: { before: '1', after: '2' },
                },
                metadata: { transition: { from: 'admitted', to: 'transferred' } },
            }),
        ];

        const events = buildAdtTimeline(admission({ status: 'transferred', ward: 'Ward B', bed: '2' }), logs);

        const transferEvent = events.find((e) => e.kind === 'transfer');
        expect(transferEvent).toBeDefined();
        expect(transferEvent?.description).toBe('Transferred from Ward A / 1 to Ward B / 2.');
    });

    it('builds a discharge event with a handoff summary', () => {
        const logs = [
            auditLog({ id: 'log-1', action: 'admission.created', createdAt: '2026-01-01T08:00:00Z' }),
            auditLog({
                id: 'log-2',
                action: 'admission.status.updated',
                createdAt: '2026-01-03T08:00:00Z',
                changes: {
                    discharge_destination: { before: null, after: 'Home' },
                    follow_up_plan: { before: null, after: 'Return in 2 weeks' },
                },
                metadata: { transition: { from: 'admitted', to: 'discharged' } },
            }),
        ];

        const events = buildAdtTimeline(admission({ status: 'discharged', dischargeDestination: 'Home', followUpPlan: 'Return in 2 weeks' }), logs);

        const dischargeEvent = events.find((e) => e.kind === 'discharge');
        expect(dischargeEvent?.description).toBe('Discharged to Home.');
        expect(dischargeEvent?.handoffSummary).toBe('Destination: Home | Follow-up: Return in 2 weeks');
    });

    it('sorts events chronologically', () => {
        const logs = [
            auditLog({ id: 'log-2', action: 'admission.status.updated', createdAt: '2026-01-03T08:00:00Z', metadata: { transition: { from: 'admitted', to: 'discharged' } } }),
            auditLog({ id: 'log-1', action: 'admission.created', createdAt: '2026-01-01T08:00:00Z' }),
        ];

        const events = buildAdtTimeline(admission({ status: 'discharged' }), logs);

        expect(events.map((e) => e.kind)).toEqual(['admit', 'discharge']);
    });
});
