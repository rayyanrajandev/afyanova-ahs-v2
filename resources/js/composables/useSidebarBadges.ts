import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { LaboratoryOrderStatusCounts } from '@/composables/laboratoryOrders/useLaboratoryOrderStatusCounts';
import type { RadiologyOrderStatusCounts } from '@/composables/radiologyOrders/useRadiologyOrderStatusCounts';
import type { PharmacyOrderStatusCounts } from '@/composables/pharmacyOrders/usePharmacyOrderStatusCounts';
import type { EmergencyCaseStatusCounts } from '@/composables/emergencyTriage/useEmergencyCaseStatusCounts';
import type { BillingInvoiceStatusCounts } from '@/composables/billingInvoices/useBillingInvoiceStatusCounts';

type StatusCountsResponse<T> = { data: T };

type ReceptionQueueStatusCounts = {
    waiting_triage: number;
    waiting_provider: number;
    in_consultation: number;
    total: number;
};

type TriageQueueStatusCounts = {
    waiting: number;
    inProgress: number;
    completed: number;
    cancelled: number;
};

type ClinicianQueueStatusCounts = {
    waiting: number;
    onHold: number;
    inProgress: number;
    completed: number;
};

export type SidebarBadges = Record<string, number>;

function sumFields<T extends Record<string, number>>(data: T | undefined, ...fields: (keyof T)[]): number {
    if (!data) return 0;
    return fields.reduce((acc, field) => acc + (data[field] ?? 0), 0);
}

export function useSidebarBadges() {
    const reception = useQuery({
        queryKey: ['sidebar-reception-queue-status-counts'],
        queryFn: async () => (await apiGet<StatusCountsResponse<ReceptionQueueStatusCounts>>('/reception/queue/status-counts')).data,
        refetchInterval: 30_000,
    });

    const triage = useQuery({
        queryKey: ['sidebar-triage-queue-status-counts'],
        queryFn: async () => (await apiGet<StatusCountsResponse<TriageQueueStatusCounts>>('/reception/triage-queue/status-counts')).data,
        refetchInterval: 30_000,
    });

    const clinician = useQuery({
        queryKey: ['sidebar-clinician-queue-status-counts'],
        queryFn: async () => (await apiGet<StatusCountsResponse<ClinicianQueueStatusCounts>>('/reception/clinician-queue/status-counts')).data,
        refetchInterval: 30_000,
    });

    const lab = useQuery({
        queryKey: ['sidebar-lab-status-counts'],
        queryFn: async () => (await apiGet<StatusCountsResponse<LaboratoryOrderStatusCounts>>('/laboratory-orders/status-counts')).data,
        refetchInterval: 30_000,
    });

    const radiology = useQuery({
        queryKey: ['sidebar-radiology-status-counts'],
        queryFn: async () => (await apiGet<StatusCountsResponse<RadiologyOrderStatusCounts>>('/radiology-orders/status-counts')).data,
        refetchInterval: 30_000,
    });

    const pharmacy = useQuery({
        queryKey: ['sidebar-pharmacy-status-counts'],
        queryFn: async () => (await apiGet<StatusCountsResponse<PharmacyOrderStatusCounts>>('/pharmacy-orders/status-counts')).data,
        refetchInterval: 30_000,
    });

    const emergency = useQuery({
        queryKey: ['sidebar-emergency-status-counts'],
        queryFn: async () => (await apiGet<StatusCountsResponse<EmergencyCaseStatusCounts>>('/emergency-triage-cases/status-counts')).data,
        refetchInterval: 30_000,
    });

    const billing = useQuery({
        queryKey: ['sidebar-billing-status-counts'],
        queryFn: async () => (await apiGet<StatusCountsResponse<BillingInvoiceStatusCounts>>('/billing/status-counts')).data,
        refetchInterval: 30_000,
    });

    const badges = computed<SidebarBadges>(() => ({
        'reception-queue': sumFields(reception.data.value, 'waiting_triage', 'waiting_provider'),
        'triage-queue': triage.data.value?.waiting ?? 0,
        'clinician-queue': clinician.data.value?.waiting ?? 0,
        'emergency-queue': sumFields(emergency.data.value, 'waiting', 'triaged'),
        'laboratory': sumFields(lab.data.value, 'ordered', 'collected', 'in_progress'),
        'radiology': sumFields(radiology.data.value, 'ordered', 'in_progress'),
        'pharmacy': sumFields(pharmacy.data.value, 'pending', 'in_preparation', 'partially_dispensed'),
        'billing': sumFields(billing.data.value, 'issued', 'partially_paid'),
        'pending-approvals': 0,
    }));

    return { badges };
}
