import type { Ref } from 'vue';
import {
    usePatientChartOrderStream,
    type PatientChartOrderStream,
} from '@/composables/patientChart/usePatientChartOrderStream';

export type PatientChartBillingInvoice = {
    id: string;
    invoiceNumber: string | null;
    appointmentId: string | null;
    encounterId: string | null;
    invoiceDate: string | null;
    currencyCode: string | null;
    totalAmount: string | number | null;
    balanceAmount: string | number | null;
    notes: string | null;
    status: string | null;
};

export type PatientChartBillingInvoiceStatusCounts = {
    draft: number;
    issued: number;
    partially_paid: number;
    paid: number;
    cancelled: number;
    voided: number;
    other: number;
    total: number;
};

export function usePatientBillingInvoices(
    patientId: Ref<string>,
    enabled: Ref<boolean>,
): PatientChartOrderStream<PatientChartBillingInvoice, PatientChartBillingInvoiceStatusCounts> {
    return usePatientChartOrderStream('/billing', {
        patientId,
        enabled,
        sortBy: 'invoiceDate',
        sortDir: 'desc',
        perPage: 5,
    });
}
