import { formatEnumLabel } from '@/lib/labels';

export type OperationsQueueRowInput = {
    id?: string | null;
    staffProfileId?: string | null;
    userName?: string | null;
    employeeNumber?: string | null;
    department?: string | null;
    jobTitle?: string | null;
    alertType?: string | null;
    alertState?: string | null;
    summary?: string | null;
    expiresAt?: string | null;
};

export type DashboardQueueRow = {
    id: string;
    title: string;
    subtitle: string;
    meta: string;
    status: string;
    href: string;
    actionLabel: string;
    group?: string;
    searchHaystack?: string;
};

export function mapCredentialingAlertToQueueRow(alert: OperationsQueueRowInput): DashboardQueueRow {
    const staffId = String(alert.staffProfileId ?? '').trim();
    const name = String(alert.userName ?? '').trim() || 'Staff profile';
    const employeeNumber = String(alert.employeeNumber ?? '').trim();
    const department = String(alert.department ?? '').trim();
    const jobTitle = String(alert.jobTitle ?? '').trim();
    const alertType = formatEnumLabel(String(alert.alertType ?? 'alert'));
    const alertState = formatEnumLabel(String(alert.alertState ?? 'open'));
    const summary = String(alert.summary ?? '').trim();

    return {
        id: String(alert.id ?? `credentialing-${staffId || Math.random()}`),
        title: name,
        subtitle: [employeeNumber, department, jobTitle].filter(Boolean).join(' · ') || 'Staff credentialing',
        meta: summary || 'Credentialing follow-up required',
        status: alertState,
        href: staffId ? `/staff-credentialing?staffId=${encodeURIComponent(staffId)}` : '/staff-credentialing',
        actionLabel: 'Open credentialing',
        group: 'Credentialing alerts',
        searchHaystack: [name, employeeNumber, department, jobTitle, alertType, alertState, summary]
            .filter(Boolean)
            .join(' '),
    };
}

const PRIVILEGE_QUEUE_STATUSES = new Set(['requested', 'under_review']);

export function buildOperationsPrivilegeQueueRows(boardPayload: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(boardPayload)) {
        return [];
    }

    const rows: Array<Record<string, unknown>> = [];

    for (const staff of boardPayload) {
        if (!staff || typeof staff !== 'object') {
            continue;
        }

        const staffRecord = staff as Record<string, unknown>;
        const privileges = Array.isArray(staffRecord.privileges) ? staffRecord.privileges : [];

        for (const privilege of privileges) {
            if (!privilege || typeof privilege !== 'object') {
                continue;
            }

            const status = String((privilege as Record<string, unknown>).status ?? '').trim().toLowerCase();
            if (!PRIVILEGE_QUEUE_STATUSES.has(status)) {
                continue;
            }

            rows.push({
                staff: staffRecord,
                privilege: privilege as Record<string, unknown>,
            });

            if (rows.length >= 8) {
                return rows;
            }
        }
    }

    return rows;
}

export function mapPrivilegeGrantToQueueRow(grant: Record<string, unknown>, staff: Record<string, unknown>): DashboardQueueRow {
    const staffId = String(staff.id ?? '').trim();
    const grantId = String(grant.id ?? '').trim();
    const name = String(staff.userName ?? staff.user_name ?? '').trim() || 'Staff profile';
    const privilegeName = String(grant.privilegeName ?? grant.catalogName ?? 'Privilege grant').trim();
    const status = formatEnumLabel(String(grant.status ?? 'pending'));
    const specialty = String(grant.specialtyName ?? grant.specialtyCode ?? '').trim();

    return {
        id: `privilege-${grantId || staffId}`,
        title: name,
        subtitle: [privilegeName, specialty].filter(Boolean).join(' · ') || 'Privileging review',
        meta: String(grant.facilityName ?? grant.facilityId ?? 'Facility scope'),
        status,
        href: staffId ? `/staff-privileges?staffId=${encodeURIComponent(staffId)}` : '/staff-privileges',
        actionLabel: 'Open privileges',
        group: 'Privileging queue',
        searchHaystack: [name, privilegeName, specialty, status].filter(Boolean).join(' '),
    };
}
