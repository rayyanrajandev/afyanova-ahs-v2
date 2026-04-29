import { formatEnumLabel } from '@/lib/labels';

export type AuditActorSummary = {
    id?: number | null;
    name?: string | null;
    email?: string | null;
    displayName?: string | null;
};

export type AuditMetadata =
    | Record<string, unknown>
    | unknown[]
    | null
    | undefined;

export type AuditLogLike = {
    action?: string | null;
    actionLabel?: string | null;
    actorId?: number | null;
    actor?: AuditActorSummary | null;
    metadata?: AuditMetadata;
};

const auditMetadataKeyLabels: Record<string, string> = {
    document_delivery: 'Delivery',
    document_filename: 'Filename',
    document_format: 'Format',
    document_number: 'Document number',
    document_schema_version: 'Schema version',
    document_source: 'Document source',
    generated_at: 'Generated at',
    request_ip: 'Request IP',
    request_path: 'Request path',
    route_name: 'Route',
    user_agent: 'User agent',
};

const pdfAuditMetadataPriority = [
    'document_filename',
    'document_number',
    'document_source',
    'request_ip',
    'route_name',
    'generated_at',
] as const;

function isObjectMetadata(value: AuditMetadata): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeMetadataEntries(
    value: AuditMetadata,
): Array<[string, unknown]> {
    if (!isObjectMetadata(value)) {
        return [];
    }

    return Object.entries(value).filter(([, entryValue]) => {
        if (entryValue === null || entryValue === undefined) {
            return false;
        }

        if (typeof entryValue === 'string' && entryValue.trim() === '') {
            return false;
        }

        if (Array.isArray(entryValue) && entryValue.length === 0) {
            return false;
        }

        return true;
    });
}

function formatMetadataValuePreview(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();

        if (trimmed === '') {
            return null;
        }

        return trimmed.length > 96 ? `${trimmed.slice(0, 93)}...` : trimmed;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    if (Array.isArray(value)) {
        return value.length === 0 ? null : `${value.length} items`;
    }

    try {
        const json = JSON.stringify(value);

        if (!json) {
            return null;
        }

        return json.length > 96 ? `${json.slice(0, 93)}...` : json;
    } catch {
        return String(value);
    }
}

export function auditActionDisplayLabel(log: Pick<AuditLogLike, 'action' | 'actionLabel'>): string {
    const friendlyLabel = typeof log.actionLabel === 'string'
        ? log.actionLabel.trim()
        : '';

    if (friendlyLabel !== '') {
        return friendlyLabel;
    }

    return formatEnumLabel(log.action || 'event');
}

export function auditActorDisplayName(
    log: Pick<AuditLogLike, 'actor' | 'actorId'>,
    fallbackPrefix = 'User',
): string {
    if (log.actorId === null || log.actorId === undefined) {
        return 'System';
    }

    const actor = log.actor;
    const preferred = [
        actor?.displayName,
        actor?.name,
        actor?.email,
    ].find((value) => typeof value === 'string' && value.trim() !== '');

    if (!preferred) {
        return `${fallbackPrefix} #${log.actorId}`;
    }

    return `${preferred} (${fallbackPrefix} #${log.actorId})`;
}

export function isPdfDocumentAuditAction(action: string | null | undefined): boolean {
    return typeof action === 'string' && action.endsWith('.document.pdf.downloaded');
}

export function auditMetadataKeyLabel(key: string): string {
    return auditMetadataKeyLabels[key] ?? formatEnumLabel(key.replace(/\./g, '_'));
}

export function buildAuditMetadataPreview(
    log: Pick<AuditLogLike, 'action' | 'metadata'>,
    limit = 3,
): Array<{ key: string; value: string }> {
    const entries = normalizeMetadataEntries(log.metadata);

    if (entries.length === 0) {
        return [];
    }

    const orderedKeys = isPdfDocumentAuditAction(log.action)
        ? [...pdfAuditMetadataPriority, ...entries.map(([key]) => key)]
        : entries.map(([key]) => key);

    const consumed = new Set<string>();
    const preview: Array<{ key: string; value: string }> = [];

    for (const key of orderedKeys) {
        if (consumed.has(key)) {
            continue;
        }

        const match = entries.find(([entryKey]) => entryKey === key);

        if (!match) {
            continue;
        }

        consumed.add(key);

        const value = formatMetadataValuePreview(match[1]);

        if (value === null) {
            continue;
        }

        preview.push({
            key: auditMetadataKeyLabel(key),
            value,
        });

        if (preview.length >= limit) {
            break;
        }
    }

    return preview;
}
