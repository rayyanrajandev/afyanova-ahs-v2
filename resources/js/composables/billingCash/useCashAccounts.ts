import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { CashAccountsFilters } from './useCashAccountsFilters';

export type CashAccountPatient = {
    id: string | null;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    displayName: string | null;
    phone: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    status: string | null;
};

export type CashAccount = {
    id: string;
    tenantId: string | null;
    facilityId: string | null;
    patientId: string | null;
    currencyCode: string | null;
    accountBalance: number | null;
    totalCharged: number | null;
    totalPaid: number | null;
    status: string | null;
    notes: string | null;
    patient: CashAccountPatient;
    createdAt: string | null;
    updatedAt: string | null;
};

export type RawCashAccount = {
    id: string;
    tenant_id: string | null;
    facility_id: string | null;
    patient_id: string | null;
    currency_code: string | null;
    account_balance: number | null;
    total_charged: number | null;
    total_paid: number | null;
    status: string | null;
    notes: string | null;
    patient: {
        id: string | null;
        patient_number: string | null;
        first_name: string | null;
        middle_name: string | null;
        last_name: string | null;
        display_name: string | null;
        phone: string | null;
        gender: string | null;
        date_of_birth: string | null;
        status: string | null;
    };
    created_at: string | null;
    updated_at: string | null;
};

type CashAccountsResponse = {
    data: RawCashAccount[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

/**
 * CashBillingAccountResponseTransformer returns snake_case fields
 * (app/Modules/Billing/Presentation/Http/Transformers/CashBillingAccountResponseTransformer.php)
 * unlike the invoices endpoints, which are camelCase — normalized here so
 * the rest of the app only ever deals with camelCase.
 */
export function normalizeAccount(raw: RawCashAccount): CashAccount {
    return {
        id: raw.id,
        tenantId: raw.tenant_id,
        facilityId: raw.facility_id,
        patientId: raw.patient_id,
        currencyCode: raw.currency_code,
        accountBalance: raw.account_balance,
        totalCharged: raw.total_charged,
        totalPaid: raw.total_paid,
        status: raw.status,
        notes: raw.notes,
        patient: {
            id: raw.patient?.id ?? null,
            patientNumber: raw.patient?.patient_number ?? null,
            firstName: raw.patient?.first_name ?? null,
            middleName: raw.patient?.middle_name ?? null,
            lastName: raw.patient?.last_name ?? null,
            displayName: raw.patient?.display_name ?? null,
            phone: raw.patient?.phone ?? null,
            gender: raw.patient?.gender ?? null,
            dateOfBirth: raw.patient?.date_of_birth ?? null,
            status: raw.patient?.status ?? null,
        },
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
    };
}

export function useCashAccounts(filters: CashAccountsFilters): UseQueryReturnType<{ data: CashAccount[]; meta: CashAccountsResponse['meta'] }, Error> {
    return useQuery({
        queryKey: ['cash-accounts', computed(() => ({ ...filters }))],
        queryFn: async () => {
            const response = await apiGet<CashAccountsResponse>('/cash-patients', {
                q: filters.q.trim() || null,
                status: filters.status === 'all' ? null : filters.status,
                page: filters.page,
                perPage: filters.perPage,
            });
            return { data: response.data.map(normalizeAccount), meta: response.meta };
        },
        placeholderData: (previousData) => previousData,
    });
}
