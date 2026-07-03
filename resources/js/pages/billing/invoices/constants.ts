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
    { value: 'card', label: 'Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'insurance_claim', label: 'Insurance Claim' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'waiver', label: 'Waiver' },
    { value: 'other', label: 'Other' },
] as const;

export const billingPaymentMethodsRequiringReference = new Set([
    'mobile_money',
    'card',
    'bank_transfer',
    'insurance_claim',
    'cheque',
]);

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
