export type ClinicalCatalogBulkKey =
    | 'lab-tests'
    | 'radiology-procedures'
    | 'theatre-procedures'
    | 'formulary-items';

export const CLINICAL_CATALOG_BULK_MAX_IMPORT_ROWS = 200;

export const CLINICAL_CATALOG_BULK_MAX_STATUS_IDS = 100;

const COMMON_COLUMNS = [
    'code',
    'name',
    'category',
    'unit',
    'facility_tier',
    'department_code',
    'billing_service_code',
    'description',
    'status',
    'status_reason',
    'standard_local',
    'standard_loinc',
    'standard_snomed_ct',
    'standard_nhif',
    'standard_msd',
    'standard_cpt',
    'standard_icd',
] as const;

const DOMAIN_COLUMNS: Record<ClinicalCatalogBulkKey, readonly string[]> = {
    'lab-tests': ['sample_type', 'specimen_container', 'turnaround_hours', 'fasting_required'],
    'radiology-procedures': ['modality', 'body_site', 'contrast_required', 'study_duration_minutes'],
    'theatre-procedures': ['procedure_class', 'anesthesia_type', 'expected_duration_minutes', 'sterile_prep_required'],
    'formulary-items': ['strength', 'dosage_form', 'route', 'pack_size', 'otc_allowed', 'stock_unit', 'conversion_factor'],
};

export function clinicalCatalogBulkColumns(catalogKey: ClinicalCatalogBulkKey): string[] {
    return [...COMMON_COLUMNS, ...DOMAIN_COLUMNS[catalogKey]];
}

export type ParsedClinicalCatalogImportRow = {
    rowNumber: number;
    values: Record<string, string>;
};

export type ClinicalCatalogImportPreviewRow = {
    rowNumber: number;
    code: string;
    name: string;
    status: string;
    outcome: string;
    errors: string[];
};

export function parseClinicalCatalogCsv(text: string, catalogKey: ClinicalCatalogBulkKey): ParsedClinicalCatalogImportRow[] {
    const rows = parseCsvRows(text);
    if (rows.length === 0) {
        return [];
    }

    const header = rows[0].map((cell) => normalizeHeader(cell));
    const expected = clinicalCatalogBulkColumns(catalogKey);
    const missing = expected.filter((column) => !header.includes(column));
    if (missing.length > 0) {
        throw new Error(`Missing required columns: ${missing.join(', ')}`);
    }

    const parsed: ParsedClinicalCatalogImportRow[] = [];

    for (let index = 1; index < rows.length; index += 1) {
        const cells = rows[index];
        if (cells.every((cell) => cell.trim() === '')) {
            continue;
        }

        const values: Record<string, string> = {};
        header.forEach((column, columnIndex) => {
            if (!column) {
                return;
            }
            values[column] = (cells[columnIndex] ?? '').trim();
        });

        parsed.push({
            rowNumber: index + 1,
            values,
        });
    }

    if (parsed.length > CLINICAL_CATALOG_BULK_MAX_IMPORT_ROWS) {
        throw new Error(`Import supports up to ${CLINICAL_CATALOG_BULK_MAX_IMPORT_ROWS} data rows per file.`);
    }

    return parsed;
}

function normalizeHeader(value: string): string {
    return value
        .trim()
        .replace(/^\uFEFF/, '')
        .toLowerCase()
        .replace(/\s+/g, '_');
}

function parseCsvRows(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                cell += '"';
                index += 1;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                cell += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
            continue;
        }

        if (char === ',') {
            row.push(cell);
            cell = '';
            continue;
        }

        if (char === '\n') {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
            continue;
        }

        if (char === '\r') {
            continue;
        }

        cell += char;
    }

    if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }

    return rows;
}

export type ClinicalCatalogImportPreviewStats = {
    create: number;
    update: number;
    failed: number;
    ready: number;
    total: number;
};

export function importPreviewStats(results: ClinicalCatalogImportPreviewRow[]): ClinicalCatalogImportPreviewStats {
    const create = results.filter((row) => row.outcome === 'created' || row.outcome === 'would_create').length;
    const update = results.filter((row) => row.outcome === 'updated' || row.outcome === 'would_update').length;
    const failed = results.filter((row) => row.outcome === 'failed').length;

    return {
        create,
        update,
        failed,
        ready: results.length - failed,
        total: results.length,
    };
}

export function summarizeImportResults(results: ClinicalCatalogImportPreviewRow[]): string {
    const stats = importPreviewStats(results);

    return `${stats.create} create · ${stats.update} update · ${stats.failed} failed`;
}

export function isImportPreviewFailure(outcome: string): boolean {
    return outcome === 'failed';
}
