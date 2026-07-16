export interface ResultTemplateField {
    code: string;
    label: string;
    type: 'select' | 'multiselect' | 'text' | 'number' | 'positive-negative' | 'not-done';
    options?: string[];
    placeholder?: string;
    unit?: string;
}

export interface ResultTemplateSection {
    label: string;
    description?: string;
    fields: ResultTemplateField[];
}

export interface ResultTemplate {
    sections: ResultTemplateSection[];
}

export function buildResultSummaryFromTemplate(
    testName: string,
    sections: ResultTemplateSection[],
    values: Record<string, string | string[]>,
): string {
    const lines: string[] = [testName.toUpperCase()];

    for (const section of sections) {
        lines.push('');
        lines.push(section.label);
        lines.push('-'.repeat(section.label.length));

        for (const field of section.fields) {
            const value = values[field.code];
            const display = formatFieldValue(field, value);
            lines.push(`${field.label}: ${display}`);
        }
    }

    return lines.join('\n');
}

export function buildResultParametersFromTemplate(
    sections: ResultTemplateSection[],
    values: Record<string, string | string[]>,
): Array<{ code: string; name: string; value: string; unit?: string }> {
    const params: Array<{ code: string; name: string; value: string; unit?: string }> = [];

    for (const section of sections) {
        for (const field of section.fields) {
            const value = values[field.code];
            if (value === undefined || value === null || value === '') continue;

            params.push({
                code: field.code,
                name: field.label,
                value: Array.isArray(value) ? value.join(', ') : String(value),
                unit: field.unit,
            });
        }
    }

    return params;
}

function formatFieldValue(field: ResultTemplateField, value: string | string[] | undefined): string {
    if (value === undefined || value === null || value === '') return '—';
    if (Array.isArray(value)) return value.join(', ') || 'None seen';
    if (field.type === 'positive-negative') return value as string;
    return String(value);
}
