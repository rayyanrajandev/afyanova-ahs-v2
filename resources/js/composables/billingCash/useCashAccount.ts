import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiGet } from '@/lib/apiClient';
import { normalizeAccount, type CashAccount, type RawCashAccount } from './useCashAccounts';

export type CashBillingCharge = {
    id: string;
    cashBillingAccountId: string | null;
    serviceId: string | null;
    serviceName: string | null;
    quantity: number | null;
    unitPrice: number;
    chargeAmount: number;
    recordedByUserId: string | null;
    chargeDate: string | null;
    referenceId: string | null;
    referenceType: string | null;
    description: string | null;
    createdAt: string | null;
};

export type CashBillingPayment = {
    id: string;
    cashBillingAccountId: string | null;
    amountPaid: number;
    currencyCode: string | null;
    paymentMethod: string | null;
    paymentReference: string | null;
    paidAt: string | null;
    receiptNumber: string | null;
    notes: string | null;
    refundedAmount: number | null;
    refundedAt: string | null;
    refundReason: string | null;
    remainingBalance: number | null;
    createdAt: string | null;
};

type RawCharge = {
    id: string;
    cash_billing_account_id: string | null;
    service_id: string | null;
    service_name: string | null;
    quantity: number | null;
    unit_price: number | string | null;
    charge_amount: number | string | null;
    recorded_by_user_id: string | null;
    charge_date: string | null;
    reference_id: string | null;
    reference_type: string | null;
    description: string | null;
    created_at: string | null;
};

type RawPayment = {
    id: string;
    cash_billing_account_id: string | null;
    amount_paid: number | string | null;
    currency_code: string | null;
    payment_method: string | null;
    payment_reference: string | null;
    paid_at: string | null;
    receipt_number: string | null;
    notes: string | null;
    refunded_amount: number | string | null;
    refunded_at: string | null;
    refund_reason: string | null;
    remaining_balance: number | string | null;
    created_at: string | null;
};

function normalizeCharge(raw: RawCharge): CashBillingCharge {
    return {
        id: raw.id,
        cashBillingAccountId: raw.cash_billing_account_id,
        serviceId: raw.service_id,
        serviceName: raw.service_name,
        quantity: raw.quantity,
        unitPrice: Number(raw.unit_price) || 0,
        chargeAmount: Number(raw.charge_amount) || 0,
        recordedByUserId: raw.recorded_by_user_id,
        chargeDate: raw.charge_date,
        referenceId: raw.reference_id,
        referenceType: raw.reference_type,
        description: raw.description,
        createdAt: raw.created_at,
    };
}

function normalizePayment(raw: RawPayment): CashBillingPayment {
    return {
        id: raw.id,
        cashBillingAccountId: raw.cash_billing_account_id,
        amountPaid: Number(raw.amount_paid) || 0,
        currencyCode: raw.currency_code,
        paymentMethod: raw.payment_method,
        paymentReference: raw.payment_reference,
        paidAt: raw.paid_at,
        receiptNumber: raw.receipt_number,
        notes: raw.notes,
        refundedAmount: raw.refunded_amount === null ? null : Number(raw.refunded_amount) || 0,
        refundedAt: raw.refunded_at,
        refundReason: raw.refund_reason,
        remainingBalance: raw.remaining_balance === null ? null : Number(raw.remaining_balance) || 0,
        createdAt: raw.created_at,
    };
}

export type CashAccountDetail = {
    account: CashAccount;
    charges: CashBillingCharge[];
    payments: CashBillingPayment[];
};

/**
 * Cached per-account (queryKey includes accountId) so re-selecting an
 * account already viewed this session is instant instead of re-fetching.
 */
export function useCashAccount(accountId: MaybeRefOrGetter<string | null>): UseQueryReturnType<CashAccountDetail, Error> {
    return useQuery({
        queryKey: ['cash-account', computed(() => toValue(accountId))],
        queryFn: async () => {
            const id = toValue(accountId);
            const response = await apiGet<{ data: { account: RawCashAccount; charges: RawCharge[]; payments: RawPayment[] } }>(`/cash-patients/${id}`);
            return {
                account: normalizeAccount(response.data.account),
                charges: response.data.charges.map(normalizeCharge),
                payments: response.data.payments.map(normalizePayment),
            };
        },
        enabled: computed(() => Boolean(toValue(accountId))),
    });
}
