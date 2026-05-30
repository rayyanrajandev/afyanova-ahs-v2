import { mapMedicalRecordToQueueRow } from '@/lib/dashboardRecordsQueue';
import type { WorkflowSurface, WorkflowSurfaceBuilder } from '@/workflows/surfaceTypes';

export const buildRecordsSurface: WorkflowSurfaceBuilder = ({ counts, lists, helpers, hasWidget }) => {
    const { numberValue, metric } = helpers;
    const draftRecords = numberValue(counts.medicalRecords, 'draft');

    const kpis = [
        hasWidget('draft_records')
            ? metric(
                  'Draft records',
                  'Medical records still open for completion.',
                  'clipboard-list',
                  draftRecords,
              )
            : null,
        hasWidget('draft_records')
            ? metric(
                  'Finalized records',
                  'Records finalized and ready for release workflows.',
                  'check-circle',
                  numberValue(counts.medicalRecords, 'finalized'),
              )
            : null,
        hasWidget('patients')
            ? metric(
                  'Active patients',
                  'Patients active in the shared chart scope.',
                  'users',
                  numberValue(counts.patients, 'active'),
              )
            : null,
        hasWidget('draft_records')
            ? metric(
                  'Amended records',
                  'Records amended after initial finalization.',
                  'pencil',
                  numberValue(counts.medicalRecords, 'amended'),
              )
            : null,
    ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const queueRows = hasWidget('draft_records')
        ? (Array.isArray(lists.draftMedicalRecords) ? lists.draftMedicalRecords : [])
              .slice(0, 8)
              .map((item: Record<string, unknown>) => mapMedicalRecordToQueueRow(item))
        : [];

    return {
        kpis,
        actions: [
            { label: 'Medical records', icon: 'clipboard-list', variant: 'default', href: '/medical-records' },
            { label: 'Patients', icon: 'users', variant: 'outline', href: '/patients' },
        ],
        queueRows,
        handoff: {
            title: 'Medical records handoff',
            note: 'Chart completeness and release readiness',
            blockerTitle:
                Number(draftRecords ?? 0) > 0 ? 'Draft records still open' : 'No critical records blockers',
            blockerNote:
                Number(draftRecords ?? 0) > 0
                    ? 'Documentation still needs completion or finalization before release workflows.'
                    : 'Chart backlog and patient lookup queues look stable for the next HIM shift.',
            nextAction:
                Number(draftRecords ?? 0) > 0
                    ? 'Start with the oldest draft records awaiting finalization.'
                    : 'Spot-check amended charts and patient lookup requests.',
            primaryAction: {
                label: Number(draftRecords ?? 0) > 0 ? 'Open draft records' : 'Open medical records',
                href: '/medical-records?status=draft',
            },
            secondaryAction: { label: 'Patient lookup', href: '/patients' },
            chips: [
                { label: 'Draft records', value: draftRecords },
                { label: 'Finalized', value: numberValue(counts.medicalRecords, 'finalized') },
                { label: 'Active patients', value: numberValue(counts.patients, 'active') },
            ],
        },
        watchItems: [
            {
                label: 'Draft records open',
                note: 'Charts still awaiting completion or finalization.',
                value: draftRecords,
                href: '/medical-records?status=draft',
                actionLabel: 'Open draft records',
                icon: 'clipboard-list',
            },
            {
                label: 'Amended after finalization',
                note: 'Records corrected after initial sign-off — verify audit trail.',
                value: numberValue(counts.medicalRecords, 'amended'),
                href: '/medical-records?status=amended',
                actionLabel: 'Open amended records',
                icon: 'pencil',
            },
            {
                label: 'Active patient charts',
                note: 'Patients with active registration in shared scope.',
                value: numberValue(counts.patients, 'active'),
                href: '/patients',
                actionLabel: 'Open patients',
                icon: 'users',
            },
        ],
        queueTitle: 'Records governance preview',
        queueDescription:
            'Draft medical records sorted by recent activity — open charts for completion and release workflows.',
        searchPlaceholder: 'Patient name, record type, or status',
    };
};
