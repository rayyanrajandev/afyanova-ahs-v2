import type { SearchableSelectOption } from '@/lib/patientLocations';

export type FinancialClass = 'self_pay' | 'insurance' | 'employer' | 'government' | 'donor' | 'other';

export type VisitCoverage = {
    financialClass?: string | null;
    billingPayerContractId?: string | null;
    coverageReference?: string | null;
    coverageNotes?: string | null;
};

export const FINANCIAL_CLASS_OPTIONS: SearchableSelectOption[] = [
    {
        value: 'self_pay',
        label: 'Self-pay / cash',
        description: 'Patient or family pays directly at cashier.',
        group: 'Direct payment',
        keywords: ['cash', 'self pay', 'patient pays', 'private'],
    },
    {
        value: 'insurance',
        label: 'Insurance',
        description: 'Covered by an insurance payer contract or claim workflow.',
        group: 'Third-party payer',
        keywords: ['insurance', 'claim', 'member', 'policy'],
    },
    {
        value: 'employer',
        label: 'Employer',
        description: 'Covered by an employer or corporate payer arrangement.',
        group: 'Third-party payer',
        keywords: ['employer', 'corporate', 'company'],
    },
    {
        value: 'government',
        label: 'Government',
        description: 'Covered by a public program, authority, or government payer.',
        group: 'Third-party payer',
        keywords: ['government', 'public', 'scheme'],
    },
    {
        value: 'donor',
        label: 'Donor / sponsor',
        description: 'Covered by a donor, NGO, project, or sponsor program.',
        group: 'Third-party payer',
        keywords: ['donor', 'sponsor', 'ngo', 'project'],
    },
    {
        value: 'other',
        label: 'Other coverage',
        description: 'Use when coverage is known but does not fit the standard classes.',
        group: 'Third-party payer',
        keywords: ['other', 'exception'],
    },
];

export function normalizeFinancialClass(value: string | null | undefined): FinancialClass {
    const normalized = String(value ?? '').trim().toLowerCase();
    return FINANCIAL_CLASS_OPTIONS.some((option) => option.value === normalized)
        ? normalized as FinancialClass
        : 'self_pay';
}

export function financialClassLabel(value: string | null | undefined): string {
    const normalized = normalizeFinancialClass(value);
    return FINANCIAL_CLASS_OPTIONS.find((option) => option.value === normalized)?.label ?? 'Self-pay / cash';
}

export function isThirdPartyFinancialClass(value: string | null | undefined): boolean {
    return normalizeFinancialClass(value) !== 'self_pay';
}

export function compactVisitCoverageSummary(coverage: VisitCoverage | null | undefined): string {
    if (!coverage) return 'Self-pay / cash';

    const parts = [
        financialClassLabel(coverage.financialClass),
        coverage.billingPayerContractId ? 'contract linked' : null,
        coverage.coverageReference ? `ref ${coverage.coverageReference}` : null,
    ].filter(Boolean);

    return parts.join(' | ');
}
