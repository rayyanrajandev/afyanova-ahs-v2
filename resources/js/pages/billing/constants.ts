import type { AuditExportStatusGroup } from './types';

export const billingPaymentPayerTypeOptions = [
    { value: 'self_pay', label: 'Self Pay' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'employer', label: 'Employer' },
    { value: 'government', label: 'Government' },
    { value: 'donor', label: 'Donor' },
    { value: 'other', label: 'Other' },
] as const;

export const billingPaymentMethodOptions = [
    { value: 'cash', label: 'Cash' },
    { value: 'mobile_money', label: 'Mobile Money' },
    { value: 'lipa_namba', label: 'Lipa Namba' },
    { value: 'card', label: 'Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'insurance_claim', label: 'Insurance Claim' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'waiver', label: 'Waiver' },
    { value: 'other', label: 'Other' },
] as const;

export const billingPaymentMethodsRequiringReference = new Set([
    'mobile_money',
    'lipa_namba',
    'card',
    'bank_transfer',
    'insurance_claim',
    'cheque',
    'waiver',
]);

export const billingPaymentMethodsRequiringNote = new Set(['waiver']);

export function billingPaymentReferenceRequired(paymentMethod: string): boolean {
    return billingPaymentMethodsRequiringReference.has(paymentMethod.trim().toLowerCase());
}

export function billingPaymentNoteRequired(paymentMethod: string): boolean {
    return billingPaymentMethodsRequiringNote.has(paymentMethod.trim().toLowerCase());
}

export function billingPaymentReferenceLabel(paymentMethod: string): string {
    const method = paymentMethod.trim().toLowerCase();

    if (method === 'cash' || method === 'other') {
        return 'Reference (optional)';
    }
    if (method === 'waiver') {
        return 'Approval reference (required)';
    }
    if (method === 'mobile_money' || method === 'lipa_namba') {
        return 'Transaction ID (required)';
    }
    if (method === 'card') {
        return 'Auth code / receipt # (required)';
    }
    if (method === 'bank_transfer') {
        return 'Bank reference (required)';
    }
    if (method === 'cheque') {
        return 'Cheque number (required)';
    }
    if (method === 'insurance_claim') {
        return 'Claim / control number (required)';
    }

    return billingPaymentReferenceRequired(method) ? 'Reference (required)' : 'Reference (optional)';
}

export function billingPaymentReferencePlaceholder(
    paymentMethod: string,
    payerType?: string | null,
): string {
    const method = paymentMethod.trim().toLowerCase();
    const payer = (payerType ?? '').trim().toLowerCase();

    if (method === 'mobile_money') {
        return 'M-PESA-TXN-001';
    }
    if (method === 'lipa_namba') {
        return 'LIPA-NAMBA-TXN-001';
    }
    if (method === 'card') {
        return 'Auth code or terminal receipt #';
    }
    if (method === 'bank_transfer') {
        return 'Bank ref / remittance advice #';
    }
    if (method === 'cheque') {
        return 'Cheque number';
    }
    if (method === 'insurance_claim') {
        if (payer === 'government') {
            return 'GOV/2026/00412';
        }
        return 'INS-2026-000123';
    }
    if (method === 'waiver') {
        return 'Supervisor approval or waiver authority ref';
    }
    if (method === 'cash') {
        return 'Receipt number (optional)';
    }

    return 'Receipt number, transaction ID...';
}

export function billingDefaultPayerTypeFromInvoice(invoice?: {
    payerSummary?: { payerType?: string | null } | null;
    lastPaymentPayerType?: string | null;
} | null): string {
    const candidates = [
        invoice?.payerSummary?.payerType,
        invoice?.lastPaymentPayerType,
    ];

    for (const candidate of candidates) {
        const normalized = (candidate ?? '').trim().toLowerCase();
        if (billingPaymentPayerTypeOptions.some((option) => option.value === normalized)) {
            return normalized;
        }
    }

    return 'self_pay';
}

export const billingPayerTypesRequiringClaimReference = new Set([
    'insurance',
    'government',
]);

export const billingClaimReferenceFormatPattern = /^[A-Za-z0-9][A-Za-z0-9\-_/.:]{5,119}$/;
export const billingClaimReferenceFormatExamples = ['INS-2026-000123', 'GOV/2026/00412'];
export const billingClaimReferenceExamplesByPayer = {
    insurance: ['INS-2026-000123', 'NHIF-2026-004112'],
    government: ['GOV/2026/00412', 'MOH-2026-03100'],
} as const;
export const billingClaimReferencePlaceholderTokens = [
    'TEMPLATE',
    'PLACEHOLDER',
    'SAMPLE',
    'DUMMY',
    'YYYY',
    'XXXX',
];

export const billingAuditActionOptions = [
    { value: 'billing-invoice.created', label: 'Invoice Created' },
    { value: 'billing-invoice.updated', label: 'Invoice Updated' },
    { value: 'billing-invoice.status.updated', label: 'Status Updated' },
    { value: 'billing-invoice.payment.recorded', label: 'Payment Recorded' },
    { value: 'billing-invoice.payment.reversed', label: 'Payment Reversed' },
    { value: 'billing-invoice.document.pdf.downloaded', label: 'PDF Downloaded' },
] as const;

export const billingAuditActorTypeOptions = [
    { value: '', label: 'All' },
    { value: 'user', label: 'User' },
    { value: 'system', label: 'System' },
] as const;

export const auditExportStatusGroupOptions: Array<{
    value: AuditExportStatusGroup;
    label: string;
}> = [
    { value: 'all', label: 'All Jobs' },
    { value: 'failed', label: 'Failed Only' },
    { value: 'backlog', label: 'Backlog (Queued/Processing)' },
    { value: 'completed', label: 'Completed Only' },
];

export const billingClaimReferenceValidationPolicyDefaults = {
    windowMinutes: 30,
    inactivityMinutes: 90,
    maxSessionAgeHours: 12,
    frequentFailureThreshold: 3,
} as const;

export function billingReferenceSampleDateToken(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
}
