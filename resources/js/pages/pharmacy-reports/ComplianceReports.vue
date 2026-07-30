<script setup lang="ts">
import { computed } from 'vue';
import ReportTable from '@/components/pharmacyReports/ReportTable.vue';
import { useControlledDrugsRegister, useInsuranceClaims } from '@/composables/pharmacyReports/useComplianceReports';
import type { ColumnDef } from '@/components/pharmacyReports/ReportTable.vue';

const props = defineProps<{
    filters: { from: string; to: string; q: string };
    subTab: string;
}>();

const controlledDrugsQuery = useControlledDrugsRegister(() => props.filters);
const insuranceClaimsQuery = useInsuranceClaims(() => props.filters);

const cdData = computed(() => controlledDrugsQuery?.data?.value?.data ?? null);
const icData = computed(() => insuranceClaimsQuery?.data?.value?.data ?? null);

const cdColumns: ColumnDef<unknown>[] = [
    { key: 'orderNumber', label: 'Order #', format: (v) => v ?? '—' },
    { key: 'dispensedAt', label: 'Dispensed At', format: (v) => v ? new Date(v as string).toLocaleString() : '—' },
    { key: 'patientName', label: 'Patient', format: (v) => v ?? '—' },
    { key: 'medicineName', label: 'Medication', format: (v) => v ?? '—' },
    { key: 'prescriberName', label: 'Prescriber', format: (v) => v ?? '—' },
    { key: 'verifierName', label: 'Verifier', format: (v) => v ?? '—' },
    { key: 'quantityDispensed', label: 'Qty', align: 'right' },
];

const icColumns: ColumnDef<unknown>[] = [
    { key: 'patientName', label: 'Patient', format: (v) => v ?? '—' },
    { key: 'payerName', label: 'Payer', format: (v) => v ?? '—' },
    { key: 'claimStatus', label: 'Status', format: (v) => String(v).replace(/_/g, ' ') },
    { key: 'totalCost', label: 'Total', align: 'right', format: (v) => v != null ? (v as number).toFixed(2) : '—' },
    { key: 'approvedAmount', label: 'Approved', align: 'right', format: (v) => v != null ? (v as number).toFixed(2) : '—' },
    { key: 'submittedAt', label: 'Submitted', format: (v) => v ? new Date(v as string).toLocaleDateString() : '—' },
    { key: 'adjudicatedAt', label: 'Adjudicated', format: (v) => v ? new Date(v as string).toLocaleDateString() : '—' },
];
</script>

<template>
    <div class="space-y-4">
        <div v-if="props.subTab === 'controlled-drugs'">
            <ReportTable
                :columns="cdColumns"
                :data="cdData"
                :loading="controlledDrugsQuery?.isLoading?.value ?? false"
                empty-message="No controlled drug data found."
            />
        </div>
        <div v-else-if="props.subTab === 'insurance-claims'">
            <ReportTable
                :columns="icColumns"
                :data="icData"
                :loading="insuranceClaimsQuery?.isLoading?.value ?? false"
                empty-message="No insurance claims data found."
            />
        </div>
    </div>
</template>
