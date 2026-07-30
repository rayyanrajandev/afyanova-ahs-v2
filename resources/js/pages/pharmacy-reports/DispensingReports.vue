<script setup lang="ts">
import ReportTable from '@/components/pharmacyReports/ReportTable.vue';
import { useDispensedMedicines, useBatchTracking, useMedicinesByClinician } from '@/composables/pharmacyReports/useDispensingReports';
import type { ColumnDef } from '@/components/pharmacyReports/ReportTable.vue';

const props = defineProps<{
    filters: { from: string; to: string; q: string };
    subTab: string;
}>();

const dispensedQuery = useDispensedMedicines(() => props.filters);
const batchQuery = useBatchTracking(() => props.filters);
const clinicianQuery = useMedicinesByClinician(() => props.filters);

function batchLabel(row: Record<string, unknown>): string {
    const internal = row.internalBatchNumber as string | null | undefined;
    const manufacturer = row.batchNumber as string | null | undefined;
    if (internal && manufacturer) return `${internal} / ${manufacturer}`;
    return internal ?? manufacturer ?? '—';
}

const dispensedColumns: ColumnDef<unknown>[] = [
    { key: 'orderNumber', label: 'Order #', format: (v) => v ?? '—' },
    { key: 'patientName', label: 'Patient', format: (v) => v ?? '—' },
    { key: 'medicineCode', label: 'Code', format: (v) => v ?? '—' },
    { key: 'medicineName', label: 'Medication', format: (v) => v ?? '—' },
    { key: 'quantityDispensed', label: 'Qty', align: 'right' },
    { key: 'batchNumber', label: 'Batch', format: (v, row) => batchLabel(row) },
    { key: 'dispensedAt', label: 'Dispensed At', format: (v) => v ? new Date(v as string).toLocaleString() : '—' },
    { key: 'dispensedByName', label: 'Dispensed By', format: (v) => v ?? '—' },
];

const batchColumns: ColumnDef<unknown>[] = [
    { key: 'internalBatchNumber', label: 'Internal Batch', format: (v) => v ?? '—' },
    { key: 'batchNumber', label: 'Mfr Batch', format: (v) => v ?? '—' },
    { key: 'itemCode', label: 'Code', format: (v) => v ?? '—' },
    { key: 'itemName', label: 'Medication', format: (v) => v ?? '—' },
    { key: 'receivedQuantity', label: 'Received', align: 'right' },
    { key: 'dispensedQuantity', label: 'Dispensed', align: 'right' },
    { key: 'currentQuantity', label: 'Remaining', align: 'right' },
    { key: 'expiryDate', label: 'Expiry', format: (v) => v ? new Date(v as string).toLocaleDateString() : '—' },
    { key: 'status', label: 'Status', format: (v) => v ?? '—' },
];

const clinicianColumns: ColumnDef<unknown>[] = [
    { key: 'clinicianName', label: 'Clinician', format: (v) => v ?? '—' },
    { key: 'orderCount', label: 'Orders', align: 'right' },
    { key: 'totalQuantity', label: 'Total Qty', align: 'right' },
    { key: 'patientCount', label: 'Patients', align: 'right' },
];
</script>

<template>
    <div class="space-y-4">
        <div v-if="props.subTab === 'dispensed-medicines'">
            <ReportTable
                :columns="dispensedColumns"
                :data="dispensedQuery?.data?.value?.data ?? null"
                :loading="dispensedQuery?.isLoading?.value ?? false"
                empty-message="No dispensed medicines found for the selected filters."
            />
        </div>
        <div v-else-if="props.subTab === 'batch-tracking'">
            <ReportTable
                :columns="batchColumns"
                :data="batchQuery?.data?.value?.data ?? null"
                :loading="batchQuery?.isLoading?.value ?? false"
                empty-message="No batch data found."
            />
        </div>
        <div v-else-if="props.subTab === 'by-clinician'">
            <ReportTable
                :columns="clinicianColumns"
                :data="clinicianQuery?.data?.value?.data ?? null"
                :loading="clinicianQuery?.isLoading?.value ?? false"
                empty-message="No clinician prescribing data found."
            />
        </div>
    </div>
</template>
