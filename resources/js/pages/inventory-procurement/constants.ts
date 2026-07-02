export const EMPTY_SELECT_VALUE = '__inventory_procurement_empty_select__';

export function toSelectValue(value: string | null | undefined): string {
    return value == null || value === '' ? EMPTY_SELECT_VALUE : value;
}

export function fromSelectValue(value: string): string {
    return value === EMPTY_SELECT_VALUE ? '' : value;
}

export function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export function formatDateOnly(value: string | null | undefined): string {
    if (!value) return '—';
    const normalized = String(value);
    const datePart = normalized.includes('T') ? normalized.split('T')[0] : normalized;
    const date = new Date(`${datePart}T00:00:00`);
    if (Number.isNaN(date.getTime())) return normalized;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

export function formatAmount(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return 'N/A';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return String(value);
    return numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function auditActorLabel(log: any): string {
    return log?.actorId === null || log?.actorId === undefined
        ? 'System'
        : `User #${log.actorId}`;
}
