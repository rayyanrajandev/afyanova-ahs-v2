const labelOverrides: Record<string, string> = {
    no_show: 'No-show',
    stat: 'STAT',
};

export function formatEnumLabel(value: string | null | undefined): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) return 'Unknown';

    const key = normalized.toLowerCase();
    if (labelOverrides[key]) return labelOverrides[key];

    return normalized
        .replace(/[_-]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}
