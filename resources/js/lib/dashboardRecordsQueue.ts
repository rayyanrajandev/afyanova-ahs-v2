import type { DashboardQueueRow } from '@/lib/dashboardOperationsQueue';
import { formatEnumLabel } from '@/lib/labels';

function formatRecordTimestamp(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(parsed);
}

export function mapMedicalRecordToQueueRow(record: Record<string, unknown>): DashboardQueueRow {
    const id = String(record.id ?? '').trim();
    const patientName = String(record.patientName ?? record.patient?.name ?? 'Patient').trim();
    const recordType = formatEnumLabel(String(record.recordType ?? record.type ?? 'record'));
    const status = formatEnumLabel(String(record.status ?? 'draft'));
    const updatedAt = record.updatedAt ?? record.createdAt;

    return {
        id: id || `record-${Math.random()}`,
        title: patientName,
        subtitle: [recordType, record.departmentName ?? record.department].filter(Boolean).join(' · ') || 'Medical record',
        meta: updatedAt ? `Updated ${formatRecordTimestamp(String(updatedAt))}` : 'Documentation in progress',
        status,
        href: id ? `/medical-records?focusRecordId=${encodeURIComponent(id)}` : '/medical-records?status=draft',
        actionLabel: 'Open record',
        group: 'Draft records',
        searchHaystack: [patientName, recordType, status, record.mrn, record.patientMrn].filter(Boolean).join(' '),
    };
}
