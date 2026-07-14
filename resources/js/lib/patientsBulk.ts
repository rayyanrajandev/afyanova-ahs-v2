export const PATIENTS_BULK_MAX_IMPORT_ROWS = 1000;

export const PATIENTS_CSV_COLUMNS = [
    'id',
    'tenant_id',
    'patient_number',
    'first_name',
    'middle_name',
    'last_name',
    'gender',
    'date_of_birth',
    'phone',
    'email',
    'national_id',
    'country_code',
    'region',
    'district',
    'address_line',
    'next_of_kin_name',
    'next_of_kin_phone',
    'status',
    'status_reason',
    'created_at',
    'updated_at',
] as const;

export type ParsedPatientImportRow = {
    rowNumber: number;
    values: Record<string, string>;
};

export type PatientImportPreviewRow = {
    rowNumber: number;
    patientId: string | null;
    name: string;
    outcome: string;
    errors: string[];
};

/**
 * Backup/restore CSV parser for the patient registry — same RFC4180-ish
 * approach as clinicalCatalogBulk.ts's parseCsvRows, kept as its own copy
 * since the two schemas (and their required-column lists) are unrelated.
 */
export function parsePatientsCsv(text: string): ParsedPatientImportRow[] {
    const rows = parseCsvRows(text);
    if (rows.length === 0) {
        return [];
    }

    const header = rows[0].map((cell) => normalizeHeader(cell));
    const required = ['first_name', 'last_name', 'gender', 'date_of_birth', 'phone', 'country_code', 'region', 'district', 'address_line'];
    const missing = required.filter((column) => !header.includes(column));
    if (missing.length > 0) {
        throw new Error(`Missing required columns: ${missing.join(', ')}`);
    }

    const parsed: ParsedPatientImportRow[] = [];

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

    if (parsed.length > PATIENTS_BULK_MAX_IMPORT_ROWS) {
        throw new Error(`Import supports up to ${PATIENTS_BULK_MAX_IMPORT_ROWS} data rows per file.`);
    }

    return parsed;
}

function normalizeHeader(value: string): string {
    return value
        .trim()
        .replace(/^﻿/, '')
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

export type PatientImportPreviewStats = {
    create: number;
    update: number;
    failed: number;
    ready: number;
    total: number;
};

export function patientImportPreviewStats(results: PatientImportPreviewRow[]): PatientImportPreviewStats {
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

export function isPatientImportPreviewFailure(outcome: string): boolean {
    return outcome === 'failed';
}
