import type { SearchableSelectOption } from '@/lib/patientLocations';
import { mergeSearchableOptions } from '@/lib/patientLocations';

function pad2(value: number): string {
    return String(value).padStart(2, '0');
}

/** ISO-8601 week number (Monday-based), common for hospital count schedules. */
export function isoWeekParts(date: Date): { isoYear: number; isoWeek: number } {
    const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const isoYear = utc.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const isoWeek = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);

    return { isoYear, isoWeek };
}

function formatDateYmd(date: Date): string {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

function calendarQuarter(date: Date): number {
    return Math.floor(date.getMonth() / 3) + 1;
}

/** Suggested count session IDs — pick one or type a facility-specific reference. */
export function buildCycleCountSessionReferenceOptions(
    referenceDate: Date = new Date(),
): SearchableSelectOption[] {
    const year = referenceDate.getFullYear();
    const { isoYear, isoWeek } = isoWeekParts(referenceDate);
    const week = pad2(isoWeek);
    const month = pad2(referenceDate.getMonth() + 1);
    const quarter = calendarQuarter(referenceDate);
    const today = formatDateYmd(referenceDate);
    const monthName = MONTH_SHORT[referenceDate.getMonth()] ?? month;

    const thisPeriod: SearchableSelectOption[] = [
        {
            value: `COUNT-${isoYear}-W${week}`,
            label: `COUNT-${isoYear}-W${week}`,
            description: 'Scheduled weekly cycle count',
            group: 'This period',
            keywords: ['weekly', 'cycle', 'scheduled'],
        },
        {
            value: `COUNT-${isoYear}-W${week}-A`,
            label: `COUNT-${isoYear}-W${week}-A`,
            description: 'Team or zone A',
            group: 'This period',
        },
        {
            value: `COUNT-${isoYear}-W${week}-B`,
            label: `COUNT-${isoYear}-W${week}-B`,
            description: 'Team or zone B',
            group: 'This period',
        },
        {
            value: `COUNT-${year}-${month}`,
            label: `COUNT-${year}-${month}`,
            description: 'Monthly count',
            group: 'This period',
            keywords: ['monthly'],
        },
        {
            value: `COUNT-${year}-${monthName}`,
            label: `COUNT-${year}-${monthName}`,
            description: 'Monthly count (month name)',
            group: 'This period',
        },
        {
            value: `COUNT-${year}-Q${quarter}`,
            label: `COUNT-${year}-Q${quarter}`,
            description: 'Quarterly count',
            group: 'This period',
        },
        {
            value: `SPOT-${today}`,
            label: `SPOT-${today}`,
            description: 'Ad-hoc spot check today',
            group: 'This period',
            keywords: ['spot', 'adhoc'],
        },
        {
            value: `ABC-A-${isoYear}-W${week}`,
            label: `ABC-A-${isoYear}-W${week}`,
            description: 'High-value (A) SKU round',
            group: 'This period',
            keywords: ['abc', 'high value'],
        },
        {
            value: `ABC-B-${isoYear}-W${week}`,
            label: `ABC-B-${isoYear}-W${week}`,
            description: 'Medium-value (B) SKU round',
            group: 'This period',
        },
        {
            value: `ABC-C-${isoYear}-W${week}`,
            label: `ABC-C-${isoYear}-W${week}`,
            description: 'Low-value (C) SKU round',
            group: 'This period',
        },
    ];

    const programs: SearchableSelectOption[] = [
        {
            value: `STOCKTAKE-${year}`,
            label: `STOCKTAKE-${year}`,
            description: 'Annual physical stocktake',
            group: 'Common programs',
        },
        {
            value: `AUDIT-${year}-Q${quarter}`,
            label: `AUDIT-${year}-Q${quarter}`,
            description: 'Audit or compliance count',
            group: 'Common programs',
        },
        {
            value: 'PAR-LEVEL-REVIEW',
            label: 'PAR-LEVEL-REVIEW',
            description: 'PAR / min–max verification',
            group: 'Common programs',
        },
        {
            value: 'PHARMACY-CYCLE',
            label: 'PHARMACY-CYCLE',
            description: 'Pharmacy scheduled count',
            group: 'Common programs',
        },
        {
            value: 'CENTRAL-STORE',
            label: 'CENTRAL-STORE',
            description: 'Main store count session',
            group: 'Common programs',
        },
        {
            value: 'WARD-FLOAT',
            label: 'WARD-FLOAT',
            description: 'Ward or floor stock check',
            group: 'Common programs',
        },
    ];

    return mergeSearchableOptions(thisPeriod, programs);
}

export const CYCLE_COUNT_REASON_OPTIONS: SearchableSelectOption[] = [
    {
        value: 'Cycle count — scheduled',
        label: 'Cycle count — scheduled',
        group: 'Common reasons',
    },
    {
        value: 'Cycle count — spot check',
        label: 'Cycle count — spot check',
        group: 'Common reasons',
    },
    {
        value: 'Annual stocktake',
        label: 'Annual stocktake',
        group: 'Common reasons',
    },
    {
        value: 'Audit / compliance count',
        label: 'Audit / compliance count',
        group: 'Common reasons',
    },
    {
        value: 'Recount after variance',
        label: 'Recount after variance',
        group: 'Common reasons',
    },
    {
        value: 'ABC class A round',
        label: 'ABC class A round',
        group: 'Common reasons',
    },
    {
        value: 'Expiry or damaged verification',
        label: 'Expiry or damaged verification',
        group: 'Common reasons',
    },
];
