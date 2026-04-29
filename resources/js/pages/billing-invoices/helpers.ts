import {
    financialClassLabel,
    isThirdPartyFinancialClass,
    normalizeFinancialClass,
} from '@/lib/financialCoverage';
import { formatEnumLabel } from '@/lib/labels';
import {
    billingClaimReferenceExamplesByPayer,
    billingClaimReferenceFormatExamples,
    billingClaimReferencePlaceholderTokens,
    billingClaimReferenceValidationPolicyDefaults,
    billingPaymentMethodOptions,
    billingPaymentPayerTypeOptions,
} from './constants';
import type {
    AuditExportStatusGroup,
    BillingClaimReferenceValidationFailureReason,
    BillingClaimReferenceValidationPolicyEnvDiagnostic,
    BillingClaimReferenceValidationPolicyField,
    BillingClaimReferenceValidationPolicyNumeric,
    BillingClaimReferenceValidationPolicyOverride,
    BillingClaimReferenceValidationPolicyOverrideResolution,
    BillingClaimReferenceValidationPolicyOverridesParseDiagnostic,
    BillingClaimReferenceValidationPolicyOverridesQualityDiagnostic,
    BillingClaimReferenceValidationPolicyProfileProvenance,
    BillingClaimReferenceValidationPolicySource,
    BillingDraftExecutionPreview,
    BillingInvoice,
    BillingInvoiceAuthorizationSummary,
    BillingInvoiceCoveragePosture,
    BillingInvoiceCoverageSummary,
    BillingInvoiceLineItem,
    BillingInvoicePayment,
    BillingInvoiceStatusAction,
    BillingQueueLaneFilter,
    BillingQueueThirdPartyPhaseFilter,
} from './types';

// ── Claim Reference Policy Parsing ──────────────────────────────────────────

export function parseClaimReferencePolicyPositiveInt(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
): {
    value: number;
    direction: 'below_min' | 'above_max' | null;
    raw: string;
} {
    const raw = String(value ?? '');
    const parsed =
        typeof value === 'number' ? value : Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
        return {
            value: fallback,
            direction: null,
            raw,
        };
    }

    if (parsed < min) {
        return {
            value: min,
            direction: 'below_min',
            raw,
        };
    }

    if (parsed > max) {
        return {
            value: max,
            direction: 'above_max',
            raw,
        };
    }

    return {
        value: parsed,
        direction: null,
        raw,
    };
}

export function resolveClaimReferencePolicyEnvValue(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
    key: string,
): {
    value: number;
    source: BillingClaimReferenceValidationPolicySource;
    diagnostic: BillingClaimReferenceValidationPolicyEnvDiagnostic | null;
} {
    const rawValue = String(value ?? '');
    const raw = rawValue.trim();
    if (!raw) {
        return {
            value: fallback,
            source: 'default',
            diagnostic: null,
        };
    }

    if (!/^-?\d+$/.test(raw)) {
        return {
            value: fallback,
            source: 'default',
            diagnostic: {
                key,
                raw: rawValue,
                fallback,
            },
        };
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
        return {
            value: fallback,
            source: 'default',
            diagnostic: {
                key,
                raw: rawValue,
                fallback,
            },
        };
    }

    return {
        value: Math.min(Math.max(parsed, min), max),
        source: 'env',
        diagnostic: null,
    };
}

export function parseClaimReferencePolicyOverridesEnv(
    raw: string,
): {
    overrides: Record<string, BillingClaimReferenceValidationPolicyOverride>;
    diagnostic: BillingClaimReferenceValidationPolicyOverridesParseDiagnostic | null;
    qualityDiagnostics: BillingClaimReferenceValidationPolicyOverridesQualityDiagnostic[];
} {
    const trimmed = raw.trim();
    if (!trimmed) {
        return {
            overrides: {},
            diagnostic: null,
            qualityDiagnostics: [],
        };
    }

    try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {
                overrides: {},
                diagnostic: {
                    kind: 'invalid_root',
                    raw,
                    detail: 'Expected a JSON object keyed by profile code.',
                },
                qualityDiagnostics: [],
            };
        }

        const normalized: Record<string, BillingClaimReferenceValidationPolicyOverride> = {};
        const qualityDiagnostics: BillingClaimReferenceValidationPolicyOverridesQualityDiagnostic[] =
            [];
        const knownFields = new Set([
            'windowMinutes',
            'inactivityMinutes',
            'maxSessionAgeHours',
            'frequentFailureThreshold',
        ]);
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            const normalizedKey = key.trim().toLowerCase();
            if (!normalizedKey) {
                qualityDiagnostics.push({
                    kind: 'empty_profile_key',
                    rawProfileKey: key,
                });
                continue;
            }

            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                qualityDiagnostics.push({
                    kind: 'invalid_profile_value',
                    profileKey: normalizedKey,
                    detail: 'Expected an object with threshold fields.',
                });
                continue;
            }

            const override = value as Record<string, unknown>;
            for (const field of Object.keys(override)) {
                if (!knownFields.has(field)) {
                    qualityDiagnostics.push({
                        kind: 'unknown_field',
                        profileKey: normalizedKey,
                        field,
                    });
                }
            }
            const parseOverrideNumericField = (
                field: keyof BillingClaimReferenceValidationPolicyNumeric,
                fallback: number,
                min: number,
                max: number,
            ): number | undefined => {
                const fieldValue = override[field];
                if (fieldValue === undefined) return undefined;

                const parsed = parseClaimReferencePolicyPositiveInt(
                    fieldValue,
                    fallback,
                    min,
                    max,
                );
                if (parsed.direction) {
                    qualityDiagnostics.push({
                        kind: 'clamped_field_value',
                        profileKey: normalizedKey,
                        field,
                        raw: parsed.raw,
                        direction: parsed.direction,
                        min,
                        max,
                        applied: parsed.value,
                    });
                }

                return parsed.value;
            };
            normalized[normalizedKey] = {
                windowMinutes: parseOverrideNumericField(
                    'windowMinutes',
                    billingClaimReferenceValidationPolicyDefaults.windowMinutes,
                    5,
                    720,
                ),
                inactivityMinutes: parseOverrideNumericField(
                    'inactivityMinutes',
                    billingClaimReferenceValidationPolicyDefaults.inactivityMinutes,
                    5,
                    1440,
                ),
                maxSessionAgeHours: parseOverrideNumericField(
                    'maxSessionAgeHours',
                    billingClaimReferenceValidationPolicyDefaults.maxSessionAgeHours,
                    1,
                    72,
                ),
                frequentFailureThreshold: parseOverrideNumericField(
                    'frequentFailureThreshold',
                    billingClaimReferenceValidationPolicyDefaults.frequentFailureThreshold,
                    1,
                    20,
                ),
            };
        }

        return {
            overrides: normalized,
            diagnostic: null,
            qualityDiagnostics,
        };
    } catch (error) {
        return {
            overrides: {},
            diagnostic: {
                kind: 'invalid_json',
                raw,
                detail:
                    error instanceof Error && error.message
                        ? error.message
                        : 'Unable to parse JSON.',
            },
            qualityDiagnostics: [],
        };
    }
}

// ── Audit / Parsing ─────────────────────────────────────────────────────────

export function parseAuditExportStatusGroup(value: string): AuditExportStatusGroup {
    const normalized = value.toLowerCase();
    if (
        normalized === 'failed' ||
        normalized === 'backlog' ||
        normalized === 'completed'
    ) {
        return normalized;
    }
    return 'all';
}

export function stringValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    return String(value);
}

export function parseOptionalNumber(
    value: string | number | null | undefined,
): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

// ── Claim Reference Template / Validation ───────────────────────────────────

export function buildClaimReferenceTemplateCandidates(payerType?: string | null): string[] {
    const normalizedPayer = (payerType ?? '').trim().toLowerCase();
    const year = new Date().getFullYear();
    const generic = [
        ...billingClaimReferenceFormatExamples,
        'INS-YYYY-000123',
        'NHIF-YYYY-004112',
        'GOV/YYYY/00412',
        'MOH-YYYY-03100',
        `INS-${year}-000123`,
        `NHIF-${year}-004112`,
        `GOV/${year}/00412`,
        `MOH-${year}-03100`,
    ];

    if (
        normalizedPayer &&
        normalizedPayer in billingClaimReferenceExamplesByPayer
    ) {
        return [
            ...generic,
            ...billingClaimReferenceExamplesByPayer[
                normalizedPayer as keyof typeof billingClaimReferenceExamplesByPayer
            ],
        ];
    }

    return generic;
}

export function isTemplateLikeClaimReference(
    reference: string,
    payerType?: string | null,
): boolean {
    const normalized = reference.trim().toUpperCase();
    if (!normalized) return false;

    const templateCandidates = new Set(
        buildClaimReferenceTemplateCandidates(payerType).map((value) =>
            value.trim().toUpperCase(),
        ),
    );
    if (templateCandidates.has(normalized)) return true;

    if (
        billingClaimReferencePlaceholderTokens.some((token) =>
            normalized.includes(token),
        )
    ) {
        return true;
    }

    return false;
}

// ── Claim Reference Label Functions ─────────────────────────────────────────

export function claimReferenceFailureReasonLabel(
    reason: BillingClaimReferenceValidationFailureReason | null,
): string {
    if (reason === 'missing') return 'Missing reference';
    if (reason === 'template') return 'Template placeholder';
    if (reason === 'format') return 'Invalid format';
    return 'Unknown';
}

export function claimReferencePolicySourceLabel(
    source: BillingClaimReferenceValidationPolicySource,
): string {
    if (source === 'profile_override') return 'Profile override';
    if (source === 'env') return 'Environment';
    return 'Default';
}

export function claimReferencePolicyOverrideResolutionLabel(
    resolution: BillingClaimReferenceValidationPolicyOverrideResolution,
): string {
    if (resolution === 'exact_profile_override') return 'Exact profile override';
    if (resolution === 'default_override_fallback') return 'Default override fallback';
    return 'No override';
}

export function claimReferencePolicyFieldLabel(
    field: BillingClaimReferenceValidationPolicyField,
): string {
    if (field === 'windowMinutes') return 'Window minutes';
    if (field === 'inactivityMinutes') return 'Inactivity minutes';
    if (field === 'maxSessionAgeHours') return 'Max session age hours';
    return 'Frequent failure threshold';
}

export function claimReferencePolicyProfileProvenanceLabel(
    provenance: BillingClaimReferenceValidationPolicyProfileProvenance,
): string {
    if (provenance === 'facility_code_hit') return 'Facility code hit';
    if (provenance === 'tenant_code_hit') return 'Tenant code hit';
    return 'Default scope';
}

export function claimReferencePolicyCodeNormalizationLabel(
    raw: string | null,
    normalized: string | null,
): string {
    const renderedRaw = raw === null ? '(missing)' : `"${raw}"`;
    const renderedNormalized =
        normalized === null ? '(none after trim/lowercase)' : `"${normalized}"`;
    return `${renderedRaw} -> ${renderedNormalized}`;
}

export function claimReferencePolicyEnvDiagnosticMessage(
    diagnostic: BillingClaimReferenceValidationPolicyEnvDiagnostic,
): string {
    const normalizedRaw = diagnostic.raw.trim();
    const renderedRaw = normalizedRaw === '' ? '(empty)' : normalizedRaw;
    return `${diagnostic.key}=\"${renderedRaw}\" is invalid; using default ${diagnostic.fallback}.`;
}

export function claimReferencePolicyOverridesParseDiagnosticMessage(
    diagnostic: BillingClaimReferenceValidationPolicyOverridesParseDiagnostic,
): string {
    const configKey = 'VITE_BILLING_CLAIM_REF_TELEMETRY_POLICY_OVERRIDES';
    const rawPreview = diagnostic.raw.trim().slice(0, 160);
    const renderedRaw = rawPreview === '' ? '(empty)' : rawPreview;
    return `${configKey} could not be applied (${diagnostic.kind}: ${diagnostic.detail}). Raw preview: "${renderedRaw}". Overrides are ignored; policy falls back to environment/default thresholds.`;
}

export function claimReferencePolicyOverridesQualityDiagnosticMessage(
    diagnostic: BillingClaimReferenceValidationPolicyOverridesQualityDiagnostic,
): string {
    if (diagnostic.kind === 'empty_profile_key') {
        const rawKey = diagnostic.rawProfileKey.trim() || '(blank)';
        return `Ignored override entry with empty profile key ("${rawKey}").`;
    }

    if (diagnostic.kind === 'invalid_profile_value') {
        return `Ignored override profile "${diagnostic.profileKey}" because value is invalid (${diagnostic.detail}).`;
    }

    if (diagnostic.kind === 'clamped_field_value') {
        const renderedRaw = diagnostic.raw.trim() || '(empty)';
        const directionLabel =
            diagnostic.direction === 'below_min' ? 'below min' : 'above max';
        return `Clamped override "${diagnostic.profileKey}.${diagnostic.field}" from "${renderedRaw}" (${directionLabel}; allowed ${diagnostic.min}-${diagnostic.max}) to ${diagnostic.applied}.`;
    }

    return `Ignored unknown override field "${diagnostic.field}" under profile "${diagnostic.profileKey}".`;
}

// ── Date / Time Helpers ─────────────────────────────────────────────────────

export function formatDate(value: string | null): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

export function formatDateTime(value: string | null): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export function defaultLocalDateTime(): string {
    const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

export function localDateTimeDatePart(value: string | null | undefined): string {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return '';
    return trimmed.slice(0, 10);
}

export function localDateTimeTimePart(value: string | null | undefined): string {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return '';
    const normalized = trimmed.replace(' ', 'T');
    const timePart = normalized.split('T')[1] ?? '';
    return timePart.slice(0, 5);
}

export function mergeLocalDateAndTimeParts(
    datePart: string,
    timePart: string,
    currentValue: string | null | undefined,
): string {
    const normalizedDate = datePart.trim();
    const normalizedTime = timePart.trim();

    if (!normalizedDate && !normalizedTime) return '';

    const fallback = defaultLocalDateTime();
    const mergedDate = normalizedDate || localDateTimeDatePart(currentValue) || fallback.slice(0, 10);
    const mergedTime = normalizedTime || localDateTimeTimePart(currentValue) || fallback.slice(11, 16);

    return `${mergedDate}T${mergedTime}`;
}

export function normalizeLocalDateTimeForApi(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace('T', ' ');
    return normalized.length === 16 ? `${normalized}:00` : normalized;
}

// ── Number / Money Helpers ──────────────────────────────────────────────────

export function amountToNumber(value: string | number | null): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return '0.00%';
    }
    return `${Number(value).toFixed(2)}%`;
}

// ── Status / Display Helpers ────────────────────────────────────────────────

export function statusVariant(status: string | null) {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'draft') return 'outline';
    if (normalized === 'issued') return 'secondary';
    if (normalized === 'partially_paid' || normalized === 'paid') return 'default';
    if (normalized === 'cancelled' || normalized === 'voided') return 'destructive';
    return 'outline';
}

export function invoiceQueueDetailsLabel(): string {
    return 'Invoice details';
}

// ── Payment Label / Display Functions ───────────────────────────────────────

export function billingPaymentPayerTypeLabel(value: string | null | undefined): string {
    const normalized = (value ?? '').trim().toLowerCase();
    if (!normalized) return 'Self Pay';

    const match = billingPaymentPayerTypeOptions.find(
        (option) => option.value === normalized,
    );

    return match?.label ?? formatEnumLabel(normalized);
}

export function billingPaymentMethodLabel(value: string | null | undefined): string {
    const normalized = (value ?? '').trim().toLowerCase();
    if (!normalized) return 'Unspecified method';

    const match = billingPaymentMethodOptions.find(
        (option) => option.value === normalized,
    );

    return match?.label ?? formatEnumLabel(normalized);
}

export function billingPaymentOperationalProofText(
    payerType: string | null | undefined,
    paymentMethod: string | null | undefined,
): string {
    const normalizedPayerType = (payerType ?? '').trim().toLowerCase();
    const normalizedMethod = (paymentMethod ?? '').trim().toLowerCase();

    if (normalizedMethod === 'cash') {
        return 'Keep the receipt or cashier daybook trail aligned to this invoice posting.';
    }

    if (normalizedMethod === 'mobile_money') {
        return 'Carry the telecom transaction ID and keep it matched to the exact patient or payer posting.';
    }

    if (normalizedMethod === 'card') {
        return 'Carry the POS approval code or card settlement trace for later audit and reconciliation.';
    }

    if (normalizedMethod === 'bank_transfer') {
        return 'Carry the bank transfer, deposit slip, or remittance advice that matches this invoice.';
    }

    if (normalizedMethod === 'insurance_claim') {
        return 'Carry the payer-issued claim, control, or remittance number before handoff or reconciliation.';
    }

    if (normalizedMethod === 'cheque') {
        return 'Carry the cheque number and issuer or bank details that support this posting.';
    }

    if (normalizedMethod === 'waiver') {
        return 'Carry the approved waiver authority or supervisor reference that supports this reduction.';
    }

    if (normalizedPayerType === 'insurance' || normalizedPayerType === 'government') {
        return 'Carry the payer-issued control number, guarantee letter, or remittance reference with this invoice.';
    }

    return 'Carry the exact operator note and supporting reference that explain this posting clearly.';
}

export function billingPaymentEntryType(payment: BillingInvoicePayment): string {
    return (payment.entryType ?? 'payment').toLowerCase();
}

export function billingPaymentIsReversal(payment: BillingInvoicePayment): boolean {
    return billingPaymentEntryType(payment) === 'reversal';
}

export function billingPaymentMetaLabel(payment: BillingInvoicePayment): string | null {
    const parts: string[] = [];

    if (payment.payerType) {
        parts.push(formatEnumLabel(payment.payerType));
    }

    if (payment.paymentMethod) {
        parts.push(formatEnumLabel(payment.paymentMethod));
    }

    if (payment.paymentReference) {
        parts.push(`Ref ${payment.paymentReference}`);
    }

    return parts.length > 0 ? parts.join(' - ') : null;
}

export function billingPaymentOperatorLabel(payment: BillingInvoicePayment): string {
    if (payment.recordedByUserId !== null && payment.recordedByUserId !== undefined) {
        return `User ${payment.recordedByUserId}`;
    }

    return 'System/unspecified';
}

export function billingPaymentRecordedAt(payment: BillingInvoicePayment): string | null {
    return payment.paymentAt || payment.createdAt || null;
}

// ── Invoice Settlement / Coverage Functions ─────────────────────────────────

export function billingInvoiceSettlementFinancialClass(
    invoice: BillingInvoice | null | undefined,
): ReturnType<typeof normalizeFinancialClass> {
    const payerType = (invoice?.payerSummary?.payerType ?? '').trim();
    if (payerType) return normalizeFinancialClass(payerType);

    const visitFinancialClass = (invoice?.visitCoverage?.financialClass ?? '').trim();
    if (visitFinancialClass) return normalizeFinancialClass(visitFinancialClass);

    if (invoice?.claimReadiness?.claimEligible) {
        return 'insurance';
    }

    if ((invoice?.billingPayerContractId ?? '').trim()) {
        return 'other';
    }

    return 'self_pay';
}

export function billingInvoiceSettlementMode(
    invoice: BillingInvoice | null | undefined,
): 'self_pay' | 'third_party' {
    return isThirdPartyFinancialClass(
        billingInvoiceSettlementFinancialClass(invoice),
    )
        ? 'third_party'
        : 'self_pay';
}

export function billingInvoiceSettlementPathLabel(
    invoice: BillingInvoice | null | undefined,
): string {
    const contractName = (invoice?.payerSummary?.contractName ?? '').trim();
    if (contractName) return contractName;

    const payerName = (invoice?.payerSummary?.payerName ?? '').trim();
    if (payerName) return payerName;

    const settlementPath = (invoice?.payerSummary?.settlementPath ?? '').trim();
    if (settlementPath) return settlementPath;

    return financialClassLabel(billingInvoiceSettlementFinancialClass(invoice));
}

export function billingInvoiceAuthorizationSummary(
    invoice: BillingInvoice | null | undefined,
): BillingInvoiceAuthorizationSummary {
    return invoice?.authorizationSummary ?? invoice?.claimReadiness?.authorizationSummary ?? null;
}

export function billingInvoiceCoverageSummary(
    invoice: BillingInvoice | null | undefined,
): BillingInvoiceCoverageSummary {
    return invoice?.coverageSummary ?? invoice?.claimReadiness?.coverageSummary ?? null;
}

export function billingInvoiceCoveragePosture(
    invoice: BillingInvoice | null | undefined,
): BillingInvoiceCoveragePosture | null {
    if (!invoice) return null;

    const usesThirdPartySettlement = billingInvoiceSettlementMode(invoice) === 'third_party';
    const claimEligible = invoice.claimReadiness?.claimEligible === true;
    const claimReady = invoice.claimReadiness?.ready === true;
    const coverageSummary = billingInvoiceCoverageSummary(invoice);
    const authorizationSummary = billingInvoiceAuthorizationSummary(invoice);
    const lineItemsExcluded = Math.max(coverageSummary?.lineItemsExcluded ?? 0, 0);
    const lineItemsManualReview = Math.max(coverageSummary?.lineItemsManualReview ?? 0, 0);
    const lineItemsUsingPolicyRule = Math.max(coverageSummary?.lineItemsUsingPolicyRule ?? 0, 0);
    const lineItemsRequiringAuthorization = Math.max(
        authorizationSummary?.lineItemsRequiringAuthorization ?? 0,
        0,
    );

    if (!usesThirdPartySettlement) {
        return {
            state: 'not_applicable',
            label: 'Self-pay route',
            description: 'No payer contract policy is attached to this invoice.',
            badgeVariant: 'outline',
            toneClass:
                'border-border/70 border-l-4 border-l-border bg-muted/10 dark:border-border dark:border-l-border/70 dark:bg-muted/20',
        };
    }

    if (!(invoice.billingPayerContractId ?? '').trim()) {
        return {
            state: 'contract_link_required',
            label: 'Contract link needed',
            description: 'Link the exact payer contract before claim prep or settlement follow-up continues.',
            badgeVariant: 'destructive',
            toneClass:
                'border-rose-200/80 border-l-4 border-l-rose-400/70 bg-muted/20 dark:border-rose-500/30 dark:border-l-rose-400/50 dark:bg-muted/30',
        };
    }

    if (lineItemsManualReview > 0) {
        return {
            state: 'coverage_review_required',
            label: 'Coverage review',
            description: `${lineItemsManualReview} line item${lineItemsManualReview === 1 ? '' : 's'} require manual payer coverage review before claim submission.`,
            badgeVariant: 'destructive',
            toneClass:
                'border-rose-200/80 border-l-4 border-l-rose-400/70 bg-muted/20 dark:border-rose-500/30 dark:border-l-rose-400/50 dark:bg-muted/30',
        };
    }

    if (lineItemsExcluded > 0) {
        return {
            state: 'coverage_exception',
            label: lineItemsExcluded === 1 ? 'Excluded service' : 'Excluded services',
            description: `${lineItemsExcluded} line item${lineItemsExcluded === 1 ? '' : 's'} must stay patient-share or be split from the claim before submission.`,
            badgeVariant: 'destructive',
            toneClass:
                'border-rose-200/80 border-l-4 border-l-rose-400/70 bg-muted/20 dark:border-rose-500/30 dark:border-l-rose-400/50 dark:bg-muted/30',
        };
    }

    if (invoice.claimReadiness?.requiresPreAuthorization) {
        return {
            state: 'preauthorization_required',
            label: 'Pre-auth required',
            description: 'This contract requires pre-authorization review before a claim can be released.',
            badgeVariant: 'outline',
            toneClass:
                'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30',
        };
    }

    if (invoice.claimReadiness?.requiresManualAuthorization || lineItemsRequiringAuthorization > 0) {
        return {
            state: 'authorization_required',
            label: 'Authorization review',
            description: `${lineItemsRequiringAuthorization || 1} line item${lineItemsRequiringAuthorization === 1 ? '' : 's'} still need payer authorization before claim submission.`,
            badgeVariant: 'outline',
            toneClass:
                'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30',
        };
    }

    if (claimReady && lineItemsUsingPolicyRule > 0) {
        return {
            state: 'rule_based_cover',
            label: 'Rule-based cover',
            description: `${lineItemsUsingPolicyRule} line item${lineItemsUsingPolicyRule === 1 ? '' : 's'} are being governed by active payer policy rules and are ready for claim follow-up.`,
            badgeVariant: 'secondary',
            toneClass:
                'border-sky-200/80 border-l-4 border-l-sky-400/70 bg-muted/20 dark:border-sky-500/30 dark:border-l-sky-400/50 dark:bg-muted/30',
        };
    }

    if (claimReady) {
        return {
            state: 'contract_default',
            label: 'Claim-ready',
            description: 'The invoice can move straight into claim submission and payer follow-up.',
            badgeVariant: 'secondary',
            toneClass:
                'border-sky-200/80 border-l-4 border-l-sky-400/70 bg-muted/20 dark:border-sky-500/30 dark:border-l-sky-400/50 dark:bg-muted/30',
        };
    }

    if (claimEligible) {
        return {
            state: lineItemsUsingPolicyRule > 0 ? 'rule_based_cover' : 'contract_default',
            label: lineItemsUsingPolicyRule > 0 ? 'Rule-based cover' : 'Contract default cover',
            description: lineItemsUsingPolicyRule > 0
                ? 'Active payer policy rules are already shaping this invoice, but claim follow-up still needs review.'
                : 'The invoice follows contract default cover and remains on the third-party settlement path.',
            badgeVariant: 'outline',
            toneClass:
                'border-sky-200/80 border-l-4 border-l-sky-400/70 bg-muted/20 dark:border-sky-500/30 dark:border-l-sky-400/50 dark:bg-muted/30',
        };
    }

    return {
        state: 'no_claim_route',
        label: 'No claim route',
        description: 'No payer-sponsored balance is expected on this invoice after current contract terms are applied.',
        badgeVariant: 'outline',
        toneClass:
            'border-border/70 border-l-4 border-l-border bg-muted/10 dark:border-border dark:border-l-border/70 dark:bg-muted/20',
    };
}

export function billingInvoiceCoverageMetricBadges(
    invoice: BillingInvoice | null | undefined,
): Array<{ key: string; label: string; variant: 'secondary' | 'outline' | 'destructive' }> {
    const coverageSummary = billingInvoiceCoverageSummary(invoice);
    const authorizationSummary = billingInvoiceAuthorizationSummary(invoice);
    const badges: Array<{
        key: string;
        label: string;
        variant: 'secondary' | 'outline' | 'destructive';
    }> = [];

    const excluded = Math.max(coverageSummary?.lineItemsExcluded ?? 0, 0);
    const manualReview = Math.max(coverageSummary?.lineItemsManualReview ?? 0, 0);
    const ruleBased = Math.max(coverageSummary?.lineItemsUsingPolicyRule ?? 0, 0);
    const ruleMatches = Math.max(coverageSummary?.matchedRuleCount ?? 0, 0);
    const authorizationRequired = Math.max(
        authorizationSummary?.lineItemsRequiringAuthorization ?? 0,
        0,
    );

    if (excluded > 0) {
        badges.push({
            key: 'excluded',
            label: `${excluded} excluded`,
            variant: 'destructive',
        });
    }

    if (manualReview > 0) {
        badges.push({
            key: 'manual-review',
            label: `${manualReview} manual review`,
            variant: 'destructive',
        });
    }

    if (authorizationRequired > 0) {
        badges.push({
            key: 'authorization',
            label: `${authorizationRequired} needs auth`,
            variant: 'outline',
        });
    }

    if (ruleBased > 0) {
        badges.push({
            key: 'rule-based',
            label: `${ruleBased} rule-based`,
            variant: 'secondary',
        });
    }

    if (ruleMatches > 0 && ruleBased === 0) {
        badges.push({
            key: 'policy-matches',
            label: `${ruleMatches} policy match${ruleMatches === 1 ? '' : 'es'}`,
            variant: 'outline',
        });
    }

    return badges;
}

export function billingInvoiceFinancePostingBadges(
    invoice: BillingInvoice | null | undefined,
): Array<{ key: string; label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> {
    const summary = invoice?.financePosting;
    if (!summary) return [];

    const badges: Array<{
        key: string;
        label: string;
        variant: 'default' | 'secondary' | 'outline' | 'destructive';
    }> = [];

    if (!summary.infrastructure.revenueRecognitionReady || !summary.infrastructure.glPostingReady) {
        badges.push({
            key: 'finance-setup',
            label: 'Finance setup missing',
            variant: 'destructive',
        });
    }

    badges.push(
        {
            key: 'recognition',
            label:
                summary.recognition.status === 'recognized'
                    ? 'Recognition synced'
                    : 'Recognition pending',
            variant:
                summary.recognition.status === 'recognized' ? 'secondary' : 'outline',
        },
        {
            key: 'payment-ledger',
            label:
                summary.paymentPosting.entryCount > 0
                    ? `Payment GL ${summary.paymentPosting.postedCount}/${summary.paymentPosting.entryCount}`
                    : 'Payment GL quiet',
            variant:
                summary.paymentPosting.draftCount > 0
                    ? 'outline'
                    : summary.paymentPosting.postedCount > 0
                      ? 'secondary'
                      : 'outline',
        },
    );

    if (summary.refundPosting.entryCount > 0) {
        badges.push({
            key: 'refund-ledger',
            label: `Refund GL ${summary.refundPosting.postedCount}/${summary.refundPosting.entryCount}`,
            variant:
                summary.refundPosting.draftCount > 0 ? 'outline' : 'secondary',
        });
    }

    return badges;
}

export function billingInvoiceClaimPostureLabel(
    invoice: BillingInvoice | null | undefined,
): string {
    return billingInvoiceCoveragePosture(invoice)?.label ?? 'Claim posture';
}

export function billingLineItemCoverageDecisionLabel(decision: string | null | undefined): string {
    const normalized = (decision ?? '').trim().toLowerCase();

    if (normalized === 'covered_with_rule') return 'Rule-based cover';
    if (normalized === 'covered') return 'Covered';
    if (normalized === 'excluded') return 'Excluded';
    if (normalized === 'manual_review') return 'Manual review';
    if (normalized === 'inherit') return 'Contract default';

    return 'Coverage';
}

export function billingLineItemCoverageDecisionVariant(
    decision: string | null | undefined,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    const normalized = (decision ?? '').trim().toLowerCase();

    if (normalized === 'excluded' || normalized === 'manual_review') {
        return 'destructive';
    }

    if (normalized === 'covered_with_rule') {
        return 'secondary';
    }

    return 'outline';
}

// ── Invoice Queue Display / Filter Functions ────────────────────────────────

export function billingInvoicePreferredPaymentPayerType(
    invoice: BillingInvoice | null | undefined,
): string {
    const lastPaymentPayerType = (invoice?.lastPaymentPayerType ?? '').trim();
    if (lastPaymentPayerType) return lastPaymentPayerType;

    const payerType = (invoice?.payerSummary?.payerType ?? '').trim();
    if (payerType) return payerType;

    return billingInvoiceSettlementFinancialClass(invoice);
}

export function billingInvoiceQueuePaidLabel(
    invoice: BillingInvoice | null | undefined,
): string {
    return billingInvoiceSettlementMode(invoice) === 'third_party'
        ? 'Settled'
        : 'Collected';
}

export function billingInvoiceQueueLastActivityLabel(
    invoice: BillingInvoice | null | undefined,
): string {
    return billingInvoiceSettlementMode(invoice) === 'third_party'
        ? 'Last settlement'
        : 'Last collection';
}

export function billingInvoiceQueueLaneLabel(
    invoice: BillingInvoice | null | undefined,
): string {
    return billingInvoiceSettlementMode(invoice) === 'third_party'
        ? 'Third-party settlement'
        : 'Cashier collection';
}

export function billingInvoiceMatchesQueueLaneFilter(
    invoice: BillingInvoice,
    laneFilter: BillingQueueLaneFilter,
): boolean {
    if (laneFilter === 'all') return true;

    const lane = billingInvoiceSettlementMode(invoice) === 'third_party'
        ? 'third_party_settlement'
        : 'cashier_collection';

    return lane === laneFilter;
}

export function billingInvoiceThirdPartyPhase(
    invoice: BillingInvoice | null | undefined,
): BillingQueueThirdPartyPhaseFilter | null {
    if (!invoice || billingInvoiceSettlementMode(invoice) !== 'third_party') {
        return null;
    }

    const status = (invoice.status ?? '').trim().toLowerCase();
    const paidAmount = amountToNumber(invoice.paidAmount ?? null) ?? 0;

    if (status === 'paid' || paidAmount > 0 || Boolean(invoice.lastPaymentAt)) {
        return 'remittance_reconciliation';
    }

    return 'claim_submission';
}

export function billingInvoiceThirdPartyPhaseLabel(
    invoice: BillingInvoice | null | undefined,
): string | null {
    const phase = billingInvoiceThirdPartyPhase(invoice);

    if (phase === 'claim_submission') {
        return 'Claim prep & submission';
    }

    if (phase === 'remittance_reconciliation') {
        return 'Remittance & reconciliation';
    }

    return null;
}

export function billingInvoiceMatchesThirdPartyPhaseFilter(
    invoice: BillingInvoice,
    phaseFilter: BillingQueueThirdPartyPhaseFilter,
): boolean {
    if (phaseFilter === 'all') return true;

    return billingInvoiceThirdPartyPhase(invoice) === phaseFilter;
}

export function billingInvoiceStatusActionLabel(
    invoice: BillingInvoice | null | undefined,
    action: BillingInvoiceStatusAction | null | undefined,
): string {
    if (!action) return 'Update Billing Invoice';

    const settlementMode = billingInvoiceSettlementMode(invoice);
    const usesThirdPartySettlement = settlementMode === 'third_party';

    if (action === 'issued') {
        return usesThirdPartySettlement
            ? 'Issue for Settlement'
            : 'Issue for Collection';
    }

    if (action === 'record_payment') {
        return usesThirdPartySettlement
            ? 'Record Settlement'
            : 'Record Collection';
    }

    if (action === 'partially_paid') {
        return usesThirdPartySettlement
            ? 'Update Partial Settlement'
            : 'Update Partial Collection';
    }

    if (action === 'paid') return 'Close as Paid';
    if (action === 'cancelled') return 'Cancel Billing Invoice';
    return 'Void Billing Invoice';
}

export function billingInvoiceQueueNextStep(
    invoice: BillingInvoice | null | undefined,
): {
    title: string;
    helper: string;
    toneClass: string;
} | null {
    if (!invoice) return null;

    const status = (invoice.status ?? '').trim().toLowerCase();
    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(invoice) === 'third_party';
    const coveragePosture = billingInvoiceCoveragePosture(invoice);
    const issueHandoff = billingInvoiceIssueHandoff(invoice);
    const thirdPartyPhase = billingInvoiceThirdPartyPhase(invoice);

    if (status === 'draft') {
        return {
            title: issueHandoff?.afterStepValue
                ? `Issue to ${issueHandoff.afterStepValue}`
                : billingInvoiceStatusActionLabel(invoice, 'issued'),
            helper:
                issueHandoff?.afterStepHelper ??
                (usesThirdPartySettlement
                    ? 'Release this draft so settlement and claim follow-up can begin.'
                    : 'Release this draft so cashier collection can begin.'),
            toneClass:
                'border-sky-200/80 border-l-4 border-l-sky-400/70 bg-muted/20 dark:border-sky-500/30 dark:border-l-sky-400/50 dark:bg-muted/30',
        };
    }

    if (status === 'issued') {
        if (!usesThirdPartySettlement) {
            return {
                title: 'Cashier collection',
                helper:
                    'Patient collection is the active work queue for this issued invoice.',
                toneClass:
                    'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30',
            };
        }

        if (coveragePosture?.state === 'coverage_review_required') {
            return {
                title: 'Coverage review',
                helper:
                    'Manual coverage review is blocking claim submission and needs to close first.',
                toneClass: coveragePosture.toneClass,
            };
        }

        if (
            coveragePosture?.state === 'coverage_exception' ||
            coveragePosture?.state === 'no_claim_route'
        ) {
            return {
                title: 'Coverage exception review',
                helper:
                    'Resolve excluded services or patient-share routing before payer submission continues.',
                toneClass: coveragePosture.toneClass,
            };
        }

        if (
            coveragePosture?.state === 'preauthorization_required' ||
            coveragePosture?.state === 'authorization_required'
        ) {
            return {
                title: 'Authorization follow-up',
                helper:
                    'Close payer authorization requirements before claim release or clean remittance posting continues.',
                toneClass: coveragePosture.toneClass,
            };
        }

        if (thirdPartyPhase === 'remittance_reconciliation') {
            return {
                title: 'Remittance & reconciliation',
                helper:
                    'Settlement activity has started and reconciliation is now the active follow-up lane.',
                toneClass:
                    'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30',
            };
        }

        return {
            title: invoice.claimReadiness?.ready
                ? 'Claim prep & submission'
                : 'Claim follow-up',
            helper: invoice.claimReadiness?.ready
                ? 'This invoice is ready for claim submission or payer-side claim follow-up.'
                : 'Claim prep is active while payer follow-up and final readiness checks continue.',
            toneClass:
                'border-sky-200/80 border-l-4 border-l-sky-400/70 bg-muted/20 dark:border-sky-500/30 dark:border-l-sky-400/50 dark:bg-muted/30',
        };
    }

    if (status === 'partially_paid') {
        if (!usesThirdPartySettlement) {
            return {
                title: 'Cashier balance follow-up',
                helper:
                    'Cashier collection is still active until the remaining patient balance reaches zero.',
                toneClass:
                    'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30',
            };
        }

        if (coveragePosture?.state === 'coverage_review_required') {
            return {
                title: 'Coverage review with open balance',
                helper:
                    'Coverage review still needs to close while the third-party balance remains open.',
                toneClass: coveragePosture.toneClass,
            };
        }

        if (
            coveragePosture?.state === 'coverage_exception' ||
            coveragePosture?.state === 'no_claim_route'
        ) {
            return {
                title: 'Coverage exception with open balance',
                helper:
                    'Keep patient-share routing and excluded-service handling aligned with the remaining open balance.',
                toneClass: coveragePosture.toneClass,
            };
        }

        if (
            coveragePosture?.state === 'preauthorization_required' ||
            coveragePosture?.state === 'authorization_required'
        ) {
            return {
                title: 'Authorization follow-up with open balance',
                helper:
                    'Authorization is still incomplete while settlement remains open on this invoice.',
                toneClass: coveragePosture.toneClass,
            };
        }

        if (thirdPartyPhase === 'remittance_reconciliation') {
            return {
                title: 'Partial remittance reconciliation',
                helper:
                    'Reconciliation stays active until the remaining payer or patient-share balance is closed.',
                toneClass:
                    'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30',
            };
        }

        return {
            title: 'Claim and balance follow-up',
            helper:
                'Claim work and settlement are both active while the third-party balance remains open.',
            toneClass:
                'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30',
        };
    }

    if (status === 'paid') {
        return {
            title: 'Completed',
            helper: 'Use invoice details, payment history, or audit only if follow-up is needed.',
            toneClass:
                'border-emerald-200/80 border-l-4 border-l-emerald-400/70 bg-muted/20 dark:border-emerald-500/30 dark:border-l-emerald-400/50 dark:bg-muted/30',
        };
    }

    return {
        title: 'Closed billing exception',
        helper: 'Review invoice details and audit history for the closure decision.',
        toneClass:
            'border-rose-200/80 border-l-4 border-l-rose-400/70 bg-muted/20 dark:border-rose-500/30 dark:border-l-rose-400/50 dark:bg-muted/30',
    };
}

export function billingInvoiceQueueActionLeadDetails(
    invoice: BillingInvoice | null | undefined,
): Array<{ label: string; value: string }> {
    if (!invoice) return [];

    const status = (invoice.status ?? '').trim().toLowerCase();
    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(invoice) === 'third_party';
    const coveragePosture = billingInvoiceCoveragePosture(invoice);
    const thirdPartyPhase = billingInvoiceThirdPartyPhase(invoice);
    const dueLabel = invoice.payerSummary?.claimSubmissionDueAt
        ? formatDate(invoice.payerSummary.claimSubmissionDueAt)
        : invoice.payerSummary?.claimSubmissionDeadlineDays
          ? `${invoice.payerSummary.claimSubmissionDeadlineDays} day claim window`
          : invoice.paymentDueAt
            ? formatDate(invoice.paymentDueAt)
            : 'Current business follow-up';
    const settlementCycleLabel = invoice.payerSummary?.settlementCycleDays
        ? `${invoice.payerSummary.settlementCycleDays} day settlement cycle`
        : 'Current reconciliation cycle';
    const payerLabel =
        (invoice.payerSummary?.payerName ?? '').trim()
        || billingPaymentPayerTypeLabel(invoice.payerSummary?.payerType);

    if (status === 'draft') {
        return [
            {
                label: 'Route',
                value: usesThirdPartySettlement ? 'Release to payer settlement lane' : 'Release to cashier collection',
            },
            {
                label: 'Timing',
                value: usesThirdPartySettlement ? dueLabel : (invoice.paymentDueAt ? formatDate(invoice.paymentDueAt) : 'Same cashier shift'),
            },
        ];
    }

    if (!usesThirdPartySettlement) {
        return [
            {
                label: 'Proof',
                value: 'Receipt, telecom ID, POS slip, or bank reference',
            },
            {
                label: 'Timing',
                value: invoice.paymentDueAt ? formatDate(invoice.paymentDueAt) : 'Same cashier shift',
            },
        ];
    }

    if (coveragePosture?.state === 'coverage_review_required') {
        return [
            {
                label: 'Proof',
                value: 'Benefit evidence and cover decision basis',
            },
            {
                label: 'Timing',
                value: 'Before claim prep resumes',
            },
        ];
    }

    if (
        coveragePosture?.state === 'coverage_exception'
        || coveragePosture?.state === 'no_claim_route'
    ) {
        return [
            {
                label: 'Proof',
                value: 'Split-bill basis or patient-share guarantee',
            },
            {
                label: 'Timing',
                value: 'Before more payer posting',
            },
        ];
    }

    if (
        coveragePosture?.state === 'preauthorization_required'
        || coveragePosture?.state === 'authorization_required'
    ) {
        return [
            {
                label: 'Proof',
                value: `Authorization number or approval evidence for ${payerLabel}`,
            },
            {
                label: 'Timing',
                value: 'Before claim release',
            },
        ];
    }

    if (thirdPartyPhase === 'remittance_reconciliation') {
        return [
            {
                label: 'Proof',
                value: 'Remittance advice, bank proof, cheque, or payer control ref',
            },
            {
                label: 'Timing',
                value: settlementCycleLabel,
            },
        ];
    }

    return [
        {
            label: 'Proof',
            value: `Claim packet and payer control ref for ${payerLabel}`,
        },
        {
            label: 'Timing',
            value: dueLabel,
        },
    ];
}

// ── Claim Href / Claims Action Functions ────────────────────────────────────

export function invoiceContextHref(
    invoice: BillingInvoice,
    path: string,
    options?: { includeTabNew?: boolean },
) {
    const params = new URLSearchParams();

    if (options?.includeTabNew) {
        params.set('tab', 'new');
    }

    if (invoice.patientId) params.set('patientId', invoice.patientId);
    if (invoice.appointmentId) params.set('appointmentId', invoice.appointmentId);
    if (invoice.admissionId) params.set('admissionId', invoice.admissionId);

    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
}

export function invoiceClaimWorkflowIsAvailable(invoice: BillingInvoice): boolean {
    const status = (invoice.status ?? '').trim().toLowerCase();

    return Boolean(invoice.claimReadiness?.claimEligible)
        && ['issued', 'partially_paid', 'paid'].includes(status);
}

export function invoiceClaimCreateHref(invoice: BillingInvoice): string {
    const params = new URLSearchParams();
    const payerType = billingInvoicePreferredPaymentPayerType(invoice) || 'insurance';
    const payerName =
        (invoice.payerSummary?.payerName ?? '').trim()
        || (invoice.payerSummary?.contractName ?? '').trim();
    const payerReference = (invoice.visitCoverage?.coverageReference ?? '').trim();
    const phase = billingInvoiceThirdPartyPhase(invoice);
    const coveragePosture = billingInvoiceCoveragePosture(invoice);

    params.set('tab', 'new');
    params.set('from', 'billing');
    params.set('invoiceId', invoice.id);
    if (payerType) params.set('payerType', payerType);
    if (payerName) params.set('payerName', payerName);
    if (payerReference) params.set('payerReference', payerReference);
    if (phase === 'remittance_reconciliation') {
        params.set('reconciliationStatus', 'pending');
    } else {
        params.set('reconciliationStatus', 'not_settled');
    }
    if (coveragePosture?.state === 'coverage_review_required') {
        params.set('coverageState', 'review_required');
    } else if (
        coveragePosture?.state === 'coverage_exception'
        || coveragePosture?.state === 'no_claim_route'
    ) {
        params.set('coverageState', 'exception');
    } else if (
        coveragePosture?.state === 'preauthorization_required'
        || coveragePosture?.state === 'authorization_required'
    ) {
        params.set('authorizationState', 'required');
    }

    return `/claims-insurance?${params.toString()}`;
}

export function invoiceClaimsQueueHref(invoice: BillingInvoice): string {
    const params = new URLSearchParams();
    params.set('invoiceId', invoice.id);

    const payerType = (invoice.payerSummary?.payerType ?? '').trim();
    if (payerType) params.set('payerType', payerType);

    const phase = billingInvoiceThirdPartyPhase(invoice);
    const coveragePosture = billingInvoiceCoveragePosture(invoice);
    if (phase === 'remittance_reconciliation') {
        params.set('reconciliationStatus', 'pending');
    } else {
        params.set('status', 'draft');
    }

    if (coveragePosture?.state === 'coverage_review_required') {
        params.set('coverageState', 'review_required');
    } else if (
        coveragePosture?.state === 'coverage_exception'
        || coveragePosture?.state === 'no_claim_route'
    ) {
        params.set('coverageState', 'exception');
    } else if (
        coveragePosture?.state === 'preauthorization_required'
        || coveragePosture?.state === 'authorization_required'
    ) {
        params.set('authorizationState', 'required');
    }

    return `/claims-insurance?${params.toString()}`;
}

export function billingInvoiceQueueClaimsActionCue(
    invoice: BillingInvoice | null | undefined,
): { proof: string; timing: string } | null {
    if (!invoice || billingInvoiceSettlementMode(invoice) !== 'third_party') {
        return null;
    }

    const coveragePosture = billingInvoiceCoveragePosture(invoice);
    const phase = billingInvoiceThirdPartyPhase(invoice);
    const payerLabel =
        (invoice.payerSummary?.payerName ?? '').trim()
        || billingPaymentPayerTypeLabel(invoice.payerSummary?.payerType);
    const dueLabel = invoice.payerSummary?.claimSubmissionDueAt
        ? formatDate(invoice.payerSummary.claimSubmissionDueAt)
        : invoice.payerSummary?.claimSubmissionDeadlineDays
          ? `${invoice.payerSummary.claimSubmissionDeadlineDays} day claim window`
          : 'Current payer follow-up';

    if (coveragePosture?.state === 'coverage_review_required') {
        return {
            proof: 'Benefit evidence and cover decision basis',
            timing: 'Before claim prep resumes',
        };
    }

    if (
        coveragePosture?.state === 'coverage_exception'
        || coveragePosture?.state === 'no_claim_route'
    ) {
        return {
            proof: 'Split-bill basis or patient-share guarantee',
            timing: 'Before more payer posting',
        };
    }

    if (
        coveragePosture?.state === 'preauthorization_required'
        || coveragePosture?.state === 'authorization_required'
    ) {
        return {
            proof: `Authorization evidence for ${payerLabel}`,
            timing: 'Before claim release',
        };
    }

    if (phase === 'remittance_reconciliation') {
        return {
            proof: 'Remittance advice, bank proof, cheque, or payer control ref',
            timing: invoice.payerSummary?.settlementCycleDays
                ? `${invoice.payerSummary.settlementCycleDays} day settlement cycle`
                : 'Current reconciliation cycle',
        };
    }

    return {
        proof: `Claim packet and payer control ref for ${payerLabel}`,
        timing: dueLabel,
    };
}

// ── Issue Handoff / Draft Preview ───────────────────────────────────────────

export function billingInvoiceIssueHandoff(
    invoice: BillingInvoice | null | undefined,
): {
    title: string;
    message: string;
    tone: 'default' | 'secondary';
    afterStepValue: string;
    afterStepHelper: string;
    laneFilter: BillingQueueLaneFilter;
    thirdPartyPhaseFilter: BillingQueueThirdPartyPhaseFilter;
} | null {
    if (!invoice) return null;

    const invoiceLabel = invoice.invoiceNumber ?? 'billing invoice';
    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(invoice) === 'third_party';
    const coveragePosture = billingInvoiceCoveragePosture(invoice);

    if (!usesThirdPartySettlement) {
        return {
            title: 'Cashier collection queue opened',
            message: `Issued ${invoiceLabel}. It moved into active cashier collection so front-desk or cashier follow-up can start immediately.`,
            tone: 'default',
            afterStepValue: 'Cashier collection queue',
            afterStepHelper:
                'Cashier collection becomes the active workflow as soon as the invoice is issued.',
            laneFilter: 'cashier_collection',
            thirdPartyPhaseFilter: 'all',
        };
    }

    if (coveragePosture?.state === 'coverage_review_required') {
        return {
            title: 'Coverage review queue opened',
            message: `Issued ${invoiceLabel}. It moved into third-party claim prep, but manual coverage review must be cleared before claim submission starts.`,
            tone: 'secondary',
            afterStepValue: 'Coverage review queue',
            afterStepHelper:
                'Claim prep opens first, with manual coverage review as the immediate blocker to resolve.',
            laneFilter: 'third_party_settlement',
            thirdPartyPhaseFilter: 'claim_submission',
        };
    }

    if (
        coveragePosture?.state === 'coverage_exception' ||
        coveragePosture?.state === 'no_claim_route'
    ) {
        return {
            title: 'Settlement review queue opened',
            message: `Issued ${invoiceLabel}. It moved into third-party follow-up, but coverage exceptions must be resolved before payer submission continues.`,
            tone: 'secondary',
            afterStepValue: 'Settlement review queue',
            afterStepHelper:
                'Review excluded services or missing claim route posture before continuing payer follow-up.',
            laneFilter: 'third_party_settlement',
            thirdPartyPhaseFilter: 'claim_submission',
        };
    }

    if (
        coveragePosture?.state === 'preauthorization_required' ||
        coveragePosture?.state === 'authorization_required'
    ) {
        return {
            title: 'Authorization follow-up queue opened',
            message: `Issued ${invoiceLabel}. It moved into claim prep with authorization work still required before claim release.`,
            tone: 'secondary',
            afterStepValue: 'Authorization follow-up queue',
            afterStepHelper:
                'Claim prep is now active, but authorization requirements still need to be closed before submission.',
            laneFilter: 'third_party_settlement',
            thirdPartyPhaseFilter: 'claim_submission',
        };
    }

    if (invoice.claimReadiness?.ready) {
        return {
            title: 'Claim prep queue opened',
            message: `Issued ${invoiceLabel}. It moved into claim prep and is ready for claim submission or payer follow-up.`,
            tone: 'default',
            afterStepValue: 'Claim prep queue',
            afterStepHelper:
                'Claim submission is now the primary next step for this issued invoice.',
            laneFilter: 'third_party_settlement',
            thirdPartyPhaseFilter: 'claim_submission',
        };
    }

    return {
        title: 'Claim follow-up queue opened',
        message: `Issued ${invoiceLabel}. It moved into claim prep so payer follow-up can continue before submission or settlement posting.`,
        tone: 'default',
        afterStepValue: 'Claim follow-up queue',
        afterStepHelper:
            'Claim prep is now the active work queue for this issued invoice.',
        laneFilter: 'third_party_settlement',
        thirdPartyPhaseFilter: 'claim_submission',
    };
}

export function buildBillingDraftExecutionPreview(options: {
    invoice: BillingInvoice | null | undefined;
    usesThirdParty: boolean;
    contractPending: boolean;
}): BillingDraftExecutionPreview {
    if (options.contractPending) {
        return {
            title: 'Link payer contract first',
            helper:
                'This draft cannot enter claim prep safely until the exact payer contract is linked.',
            badgeVariant: 'destructive',
            toneClass:
                'border-rose-200/80 border-l-4 border-l-rose-400/70 bg-muted/20 dark:border-rose-500/30 dark:border-l-rose-400/50 dark:bg-muted/30',
            afterIssueLabel: 'Contract link required',
            afterIssueHelper:
                'Link the contract first, then issue the draft into the correct third-party queue.',
        };
    }

    if (options.invoice) {
        const handoff = billingInvoiceIssueHandoff(options.invoice);
        const nextStep = billingInvoiceQueueNextStep(options.invoice);

        if (handoff) {
            return {
                title: handoff.afterStepValue,
                helper: handoff.afterStepHelper,
                badgeVariant: handoff.tone === 'secondary' ? 'outline' : 'secondary',
                toneClass:
                    nextStep?.toneClass ??
                    (handoff.tone === 'secondary'
                        ? 'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30'
                        : 'border-sky-200/80 border-l-4 border-l-sky-400/70 bg-muted/20 dark:border-sky-500/30 dark:border-l-sky-400/50 dark:bg-muted/30'),
                afterIssueLabel: handoff.afterStepValue,
                afterIssueHelper: handoff.afterStepHelper,
            };
        }
    }

    if (options.usesThirdParty) {
        return {
            title: 'Claim prep queue',
            helper:
                'Issuing this draft will move it into third-party claim prep and payer follow-up.',
            badgeVariant: 'secondary',
            toneClass:
                'border-sky-200/80 border-l-4 border-l-sky-400/70 bg-muted/20 dark:border-sky-500/30 dark:border-l-sky-400/50 dark:bg-muted/30',
            afterIssueLabel: 'Claim prep queue',
            afterIssueHelper:
                'Claim prep becomes the active queue as soon as this draft is issued.',
        };
    }

    return {
        title: 'Cashier collection queue',
        helper:
            'Issuing this draft will move it straight into cashier collection and patient-pay follow-up.',
        badgeVariant: 'default',
        toneClass:
            'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30',
        afterIssueLabel: 'Cashier collection queue',
        afterIssueHelper:
            'Cashier collection becomes the active queue as soon as this draft is issued.',
    };
}

// ── Navigation Helpers ──────────────────────────────────────────────────────

export function invoiceBackToAppointmentsHref(invoice: BillingInvoice): string {
    const params = new URLSearchParams();
    if (invoice.appointmentId) {
        params.set('focusAppointmentId', invoice.appointmentId);
    }

    const queryString = params.toString();
    return queryString ? `/appointments?${queryString}` : '/appointments';
}

// ── Line Item Helpers ───────────────────────────────────────────────────────

export function invoiceLineItems(invoice: BillingInvoice): BillingInvoiceLineItem[] {
    return Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
}

export function invoiceLineItemCount(invoice: BillingInvoice): number {
    return invoiceLineItems(invoice).length;
}

// ── Shell Escape Helpers ────────────────────────────────────────────────────

export function escapeForPowerShellSingleQuotedString(value: string): string {
    return value.replace(/'/g, "''");
}

export function escapeForBashSingleQuotedString(value: string): string {
    return value.replace(/'/g, `'"'"'`);
}

// ── Claim Reference Payload / Chunk Helpers ─────────────────────────────────

export const billingClaimReferenceMergePreviewPayloadWarningThresholdBytes = 12000;
export const billingClaimReferenceMergePreviewPayloadHighWarningThresholdBytes = 32000;
export const billingClaimReferenceMergePreviewCopyChunkTargetBytes = 8000;

export function billingClaimReferencePayloadUtf8ByteLength(payload: string): number {
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(payload).length;
    }

    return unescape(encodeURIComponent(payload)).length;
}

export function billingClaimReferenceMergePreviewPayloadDiagnostics(
    payload: string,
    formatLabel: string,
): {
    chars: number;
    bytes: number;
    warning: string | null;
} {
    const chars = payload.length;
    const bytes = billingClaimReferencePayloadUtf8ByteLength(payload);

    if (bytes >= billingClaimReferenceMergePreviewPayloadHighWarningThresholdBytes) {
        return {
            chars,
            bytes,
            warning: `${formatLabel} payload is very large (${bytes} bytes). Clipboard/tool paste limits may truncate output; prefer JSON ingest tooling or staged transfer.`,
        };
    }

    if (bytes >= billingClaimReferenceMergePreviewPayloadWarningThresholdBytes) {
        return {
            chars,
            bytes,
            warning: `${formatLabel} payload is large (${bytes} bytes). Expect slower paste/processing in some tools.`,
        };
    }

    return {
        chars,
        bytes,
        warning: null,
    };
}

export function buildBillingClaimReferenceMergePreviewKeyChunks(keys: string[]): string[] {
    if (keys.length === 0) return [];

    const groups: string[][] = [];
    let currentGroup: string[] = [];
    let currentGroupBytes = 0;

    for (const key of keys) {
        const keyLineBytes = billingClaimReferencePayloadUtf8ByteLength(`${key}\n`);
        if (
            currentGroup.length > 0 &&
            currentGroupBytes + keyLineBytes >
                billingClaimReferenceMergePreviewCopyChunkTargetBytes
        ) {
            groups.push(currentGroup);
            currentGroup = [key];
            currentGroupBytes = keyLineBytes;
            continue;
        }

        currentGroup.push(key);
        currentGroupBytes += keyLineBytes;
    }

    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }

    let keyOffset = 0;
    const totalChunks = groups.length;
    return groups.map((group, index) => {
        const chunkStart = keyOffset + 1;
        const chunkEnd = keyOffset + group.length;
        keyOffset += group.length;

        return [
            `Billing Claim Reference Merge Preview Preserved Profile Keys (Chunk ${index + 1}/${totalChunks})`,
            `Total Keys: ${keys.length}`,
            `Chunk Keys: ${chunkStart}-${chunkEnd}`,
            `Chunk Target Bytes: ${billingClaimReferenceMergePreviewCopyChunkTargetBytes}`,
            ...group,
        ].join('\n');
    });
}
