export interface ResultTemplateField {
    code: string;
    label: string;
    type:
        | 'select'
        | 'multiselect'
        | 'text'
        | 'number'
        | 'positive-negative'
        | 'not-done'
        | 'textarea';
    options?: string[];
    placeholder?: string;
    unit?: string;
}

/**
 * Always rendered by StructuredLabResultForm.vue, outside any template
 * section — every templated test gets Remarks/Impression with no catalog
 * data changes required.
 */
export const REMARKS_FIELD_CODE = 'remarks';
export const IMPRESSION_FIELD_CODE = 'impression';

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

    const remarks = values[REMARKS_FIELD_CODE];
    const impression = values[IMPRESSION_FIELD_CODE];
    const hasRemarks = typeof remarks === 'string' && remarks.trim() !== '';
    const hasImpression = typeof impression === 'string' && impression.trim() !== '';

    if (hasRemarks || hasImpression) {
        lines.push('');
        lines.push('Remarks & Impression');
        lines.push('-'.repeat('Remarks & Impression'.length));
        if (hasRemarks) lines.push(`Remarks: ${(remarks as string).trim()}`);
        if (hasImpression) lines.push(`Impression: ${(impression as string).trim()}`);
    }

    return lines.join('\n');
}

export interface TemplateResultParameter {
    code: string;
    name: string;
    value: string;
    unit: string | null;
    flag: string | null;
    referenceRange: string | null;
    section: string | null;
}

export const REMARKS_IMPRESSION_SECTION_LABEL = 'Remarks & Impression';

export function buildResultParametersFromTemplate(
    sections: ResultTemplateSection[],
    values: Record<string, string | string[]>,
): TemplateResultParameter[] {
    const params: TemplateResultParameter[] = [];

    for (const section of sections) {
        for (const field of section.fields) {
            const value = values[field.code];
            if (value === undefined || value === null || value === '') continue;

            params.push({
                code: field.code,
                name: field.label,
                value: Array.isArray(value) ? value.join(', ') : String(value),
                unit: field.unit ?? null,
                flag: null,
                referenceRange: null,
                section: section.label,
            });
        }
    }

    const remarks = values[REMARKS_FIELD_CODE];
    if (typeof remarks === 'string' && remarks.trim() !== '') {
        params.push({
            code: REMARKS_FIELD_CODE,
            name: 'Remarks',
            value: remarks.trim(),
            unit: null,
            flag: null,
            referenceRange: null,
            section: REMARKS_IMPRESSION_SECTION_LABEL,
        });
    }

    const impression = values[IMPRESSION_FIELD_CODE];
    if (typeof impression === 'string' && impression.trim() !== '') {
        params.push({
            code: IMPRESSION_FIELD_CODE,
            name: 'Impression',
            value: impression.trim(),
            unit: null,
            flag: null,
            referenceRange: null,
            section: REMARKS_IMPRESSION_SECTION_LABEL,
        });
    }

    return params;
}

function formatFieldValue(field: ResultTemplateField, value: string | string[] | undefined): string {
    if (value === undefined || value === null || value === '') return '—';
    if (Array.isArray(value)) return value.join(', ') || 'None seen';
    if (field.type === 'positive-negative') return value as string;
    return String(value);
}

export interface ParsedResultSummaryField {
    label: string;
    value: string;
}

export interface ParsedResultSummarySection {
    label: string;
    fields: ParsedResultSummaryField[];
}

/**
 * Parses a resultSummary produced by buildResultSummaryFromTemplate back
 * into sections/fields, dropping unset ("—") fields and any section left
 * with nothing filled — for compact display (e.g. a popover) where every
 * blank field is just noise. Detects sections by their dashed-underline
 * format (`lines.push('-'.repeat(section.label.length))`); a summary with
 * no such underlines isn't a templated one, so this returns null rather
 * than risk garbling a format it doesn't recognize — callers should fall
 * back to showing the raw string in that case.
 */
export function parseFilledResultSummarySections(summary: string): ParsedResultSummarySection[] | null {
    const lines = summary.split('\n');
    const sections: ParsedResultSummarySection[] = [];
    let current: ParsedResultSummarySection | null = null;
    let sawAnySection = false;

    function flush(): void {
        if (current !== null && current.fields.length > 0) sections.push(current);
        current = null;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1] ?? '';
        const isSectionHeader =
            line.trim() !== '' &&
            /^-+$/.test(nextLine) &&
            nextLine.length === line.length;

        if (isSectionHeader) {
            flush();
            current = { label: line, fields: [] };
            sawAnySection = true;
            i++; // skip the dashed underline line
            continue;
        }
        if (line.trim() === '' || current === null) continue;

        const match = line.match(/^(.+?): (.*)$/);
        if (match && match[2] !== '—') {
            current.fields.push({ label: match[1], value: match[2] });
        }
    }
    flush();

    return sawAnySection ? sections : null;
}

/**
 * String-output convenience wrapper around parseFilledResultSummarySections
 * for plain-text display contexts. Returns the input unchanged for
 * non-templated summaries (see parseFilledResultSummarySections).
 */
export function filterResultSummaryToFilledFields(summary: string): string {
    const sections = parseFilledResultSummarySections(summary);
    if (sections === null) return summary;

    return sections
        .map((section) =>
            [section.label, ...section.fields.map((field) => `${field.label}: ${field.value}`)].join('\n'),
        )
        .join('\n\n');
}
