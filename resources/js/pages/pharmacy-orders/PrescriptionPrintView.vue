<script setup lang="ts">
import AppBrandMark from '@/components/AppBrandMark.vue';
import { usePage } from '@inertiajs/vue3';
import { computed, onMounted } from 'vue';

type OrderContext = {
    order: Record<string, unknown>;
    patient: Record<string, unknown> | null;
    orderedBy: Record<string, unknown> | null;
};

const page = usePage<{
    order?: Record<string, unknown>;
    orders?: OrderContext[];
    patient?: Record<string, unknown> | null;
    orderedBy?: Record<string, unknown> | null;
    documentBranding: { systemName: string; displayName: string; logoUrl: string | null; supportEmail?: string; footerText?: string; issuedByName: string };
    facilityName: string | null;
    generatedAt: string;
    batch: boolean;
}>();

const batch = computed(() => page.props.batch);
const items = computed<OrderContext[]>(() => {
    if (page.props.orders) return page.props.orders;
    return [{
        order: page.props.order ?? {},
        patient: page.props.patient ?? null,
        orderedBy: page.props.orderedBy ?? null,
    }];
});
const branding = computed(() => page.props.documentBranding);
const facilityName = computed(() => page.props.facilityName);
const generatedAt = computed(() => page.props.generatedAt);

function formatDateTime(value: string | null | undefined): string {
    if (!value) return '—';
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

function formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

function patientName(p: Record<string, unknown> | null): string {
    if (!p) return '—';
    const fullName = p.fullName as string | undefined;
    if (fullName) return fullName;
    const names = [p.givenName, p.middleName, p.familyName].filter(Boolean);
    return names.length ? names.join(' ') : (p.patientNumber as string) || '—';
}

function formatQuantity(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
}

function doseSummary(item: OrderContext): string {
    const parts: string[] = [];
    if (item.order.doseQuantity) {
        parts.push(`${formatQuantity(item.order.doseQuantity)}${item.order.doseUnit ? ` ${item.order.doseUnit}` : ''}`);
    }
    if (item.order.route) parts.push(item.order.route as string);
    if (item.order.frequency) parts.push(item.order.frequency as string);
    return parts.join(' ') || '—';
}

onMounted(() => {
    setTimeout(() => window.print(), 500);
});
</script>

<template>
    <div class="min-h-screen bg-white text-slate-950 print:bg-white">
        <div class="fixed right-3 top-3 z-20 print:hidden sm:right-5 sm:top-5">
            <button
                class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur hover:bg-slate-50"
                @click="window.print()"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print {{ batch ? `all ${items.length}` : '' }}
            </button>
        </div>

        <main class="mx-auto max-w-4xl px-4 py-6 sm:py-8">
            <!-- ===== BATCH MODE: combined compact list ===== -->
            <template v-if="batch">
                <section class="overflow-hidden border border-slate-200 bg-white shadow-sm">
                    <header class="border-b border-slate-200 px-6 py-5 sm:px-8">
                        <div class="flex items-start gap-4">
                            <div class="flex size-14 items-center justify-center border border-slate-200 bg-white">
                                <AppBrandMark :branding="branding" class-name="max-h-9 max-w-9 object-contain" :alt="`${branding.systemName} logo`" />
                            </div>
                            <div class="space-y-1">
                                <p class="text-xs font-medium uppercase tracking-[0.3em] text-slate-500">Prescription Summary</p>
                                <h1 class="text-xl font-semibold tracking-tight text-slate-900">{{ branding.systemName }}</h1>
                                <p v-if="facilityName" class="text-sm font-medium text-slate-600">{{ facilityName }}</p>
                                <p class="text-sm text-slate-500">{{ items.length }} {{ items.length === 1 ? 'prescription' : 'prescriptions' }}</p>
                            </div>
                        </div>
                    </header>

                    <div class="px-6 py-5 sm:px-8">
                        <div class="rounded border border-slate-200 bg-slate-50 p-3">
                            <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Patient</p>
                            <p class="mt-1 text-base font-medium text-slate-900">{{ patientName(items[0].patient) }}</p>
                            <div class="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-500">
                                <span v-if="items[0].patient?.patientNumber">MRN: {{ items[0].patient.patientNumber }}</span>
                                <span v-if="items[0].patient?.dateOfBirth">DOB: {{ formatDate(items[0].patient.dateOfBirth as string) }}</span>
                            </div>
                        </div>

                        <table class="mt-4 w-full border-collapse text-sm">
                            <thead>
                                <tr class="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                                    <th class="pb-2 pr-2">#</th>
                                    <th class="pb-2 pr-2">Medication</th>
                                    <th class="pb-2 pr-2">Dosage</th>
                                    <th class="pb-2 pr-2">Dose / Route / Freq</th>
                                    <th class="pb-2 pr-2">Duration</th>
                                    <th class="pb-2 pr-2">Qty</th>
                                    <th class="pb-2">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="(item, index) in items"
                                    :key="item.order.id as string || index"
                                    class="border-b border-slate-100"
                                >
                                    <td class="py-2.5 pr-2 align-top text-slate-400">{{ index + 1 }}.</td>
                                    <td class="py-2.5 pr-2 align-top font-medium text-slate-900">
                                        <div>{{ item.order.medicationName as string || item.order.medicationCode as string || '—' }}</div>
                                        <div v-if="item.order.orderNumber" class="text-xs text-slate-400">{{ item.order.orderNumber }}</div>
                                    </td>
                                    <td class="py-2.5 pr-2 align-top text-slate-700">
                                        {{ item.order.dosageInstruction as string || '—' }}
                                    </td>
                                    <td class="py-2.5 pr-2 align-top text-slate-700">{{ doseSummary(item) }}</td>
                                    <td class="py-2.5 pr-2 align-top text-slate-700">
                                        {{ item.order.durationValue ? `${item.order.durationValue} ${item.order.durationUnit || ''}` : '—' }}
                                    </td>
                                    <td class="py-2.5 pr-2 align-top text-slate-700 whitespace-nowrap">
                                        {{ formatQuantity(item.order.quantityPrescribed) }}
                                        <span v-if="item.order.prescribedUnit" class="text-xs text-slate-400">{{ item.order.prescribedUnit }}</span>
                                    </td>
                                    <td class="py-2.5 align-top">
                                        <span class="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">{{ (item.order.status as string)?.replace(/_/g, ' ') || '—' }}</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <div v-if="items[0].order.clinicalIndication" class="mt-4 border-t border-slate-200 pt-4">
                            <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Clinical Indication</p>
                            <p class="mt-1 text-sm text-slate-900">{{ items[0].order.clinicalIndication as string }}</p>
                        </div>
                    </div>

                    <footer class="border-t border-slate-200 bg-slate-50 px-6 py-3 sm:px-8">
                        <div class="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                            <p class="font-medium text-slate-700">{{ branding.systemName }}</p>
                            <p>{{ branding.footerText }}</p>
                            <p>Generated {{ generatedAt }}</p>
                        </div>
                    </footer>
                </section>
            </template>

            <!-- ===== SINGLE MODE: standalone full-page prescription ===== -->
            <template v-else>
                <template v-for="(item, index) in items" :key="item.order.id as string || index">
                    <section
                        class="overflow-hidden border border-slate-200 bg-white shadow-sm"
                        :class="{ 'page-break': index < items.length - 1 }"
                    >
                        <header class="border-b border-slate-200 px-6 py-5 sm:px-8">
                            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div class="flex items-start gap-4">
                                    <div class="flex size-14 items-center justify-center border border-slate-200 bg-white">
                                        <AppBrandMark :branding="branding" class-name="max-h-9 max-w-9 object-contain" :alt="`${branding.systemName} logo`" />
                                    </div>
                                    <div class="space-y-1">
                                        <p class="text-xs font-medium uppercase tracking-[0.3em] text-slate-500">Prescription</p>
                                        <h1 class="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{{ item.order.medicationName || 'Pharmacy order' }}</h1>
                                        <p v-if="facilityName" class="text-sm font-medium text-slate-600">{{ facilityName }}</p>
                                        <p v-if="item.order.orderNumber" class="text-sm text-slate-500">{{ item.order.orderNumber }}</p>
                                    </div>
                                </div>
                                <div class="grid gap-2 border border-slate-200 bg-slate-50 p-3 sm:min-w-[220px]">
                                    <div>
                                        <p class="text-xs uppercase tracking-[0.24em] text-slate-500">Prescribed by</p>
                                        <p class="mt-1 text-sm font-medium text-slate-900">{{ item.orderedBy?.name as string || '—' }}</p>
                                    </div>
                                    <div>
                                        <p class="text-xs uppercase tracking-[0.24em] text-slate-500">Date</p>
                                        <p class="mt-1 text-sm text-slate-900">{{ formatDateTime(item.order.orderedAt as string) }}</p>
                                    </div>
                                </div>
                            </div>
                        </header>

                        <div class="space-y-6 px-6 py-5 sm:px-8 sm:py-6">
                            <div class="grid gap-4 sm:grid-cols-2">
                                <div class="rounded border border-slate-200 bg-slate-50 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Patient</p>
                                    <p class="mt-1.5 text-base font-semibold text-slate-900">{{ patientName(item.patient) }}</p>
                                    <p v-if="item.patient?.patientNumber" class="text-sm text-slate-500">MRN: {{ item.patient.patientNumber }}</p>
                                    <p v-if="item.patient?.dateOfBirth" class="text-sm text-slate-500">DOB: {{ formatDate(item.patient.dateOfBirth as string) }}</p>
                                </div>
                                <div class="rounded border border-slate-200 bg-slate-50 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
                                    <p class="mt-1.5 text-base font-semibold text-slate-900">{{ (item.order.status as string)?.replace(/_/g, ' ') || '—' }}</p>
                                    <p v-if="item.order.dispensedAt" class="text-sm text-slate-500">Dispensed: {{ formatDateTime(item.order.dispensedAt as string) }}</p>
                                </div>
                            </div>

                            <div class="border-t border-slate-200 pt-4">
                                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Medication &amp; Dosage</p>
                                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <p class="text-xs text-slate-500">Medication</p>
                                        <p class="text-sm font-medium text-slate-900">{{ item.order.medicationName as string || item.order.medicationCode as string || '—' }}</p>
                                        <p v-if="item.order.medicationCode" class="text-xs text-slate-400">Code: {{ item.order.medicationCode }}</p>
                                    </div>
                                    <div>
                                        <p class="text-xs text-slate-500">Dosage instruction</p>
                                        <p class="text-sm font-medium text-slate-900">{{ item.order.dosageInstruction as string || '—' }}</p>
                                    </div>
                                    <div v-if="item.order.doseQuantity">
                                        <p class="text-xs text-slate-500">Dose</p>
                                        <p class="text-sm font-medium text-slate-900">{{ formatQuantity(item.order.doseQuantity) }} {{ item.order.doseUnit as string || '' }}</p>
                                    </div>
                                    <div v-if="item.order.route">
                                        <p class="text-xs text-slate-500">Route</p>
                                        <p class="text-sm font-medium text-slate-900">{{ item.order.route as string }}</p>
                                    </div>
                                    <div v-if="item.order.frequency">
                                        <p class="text-xs text-slate-500">Frequency</p>
                                        <p class="text-sm font-medium text-slate-900">{{ item.order.frequency as string }}</p>
                                    </div>
                                    <div v-if="item.order.durationValue">
                                        <p class="text-xs text-slate-500">Duration</p>
                                        <p class="text-sm font-medium text-slate-900">{{ item.order.durationValue }} {{ item.order.durationUnit as string || '' }}</p>
                                    </div>
                                </div>
                            </div>

                            <div v-if="item.order.clinicalIndication" class="border-t border-slate-200 pt-4">
                                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Clinical Indication</p>
                                <p class="mt-1.5 text-sm text-slate-900">{{ item.order.clinicalIndication as string }}</p>
                            </div>

                            <div class="border-t border-slate-200 pt-4">
                                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Dispensing</p>
                                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <p class="text-xs text-slate-500">Quantity prescribed</p>
                                        <p class="text-sm font-medium text-slate-900">{{ formatQuantity(item.order.quantityPrescribed) }} {{ item.order.prescribedUnit as string || '' }}</p>
                                    </div>
                                    <div>
                                        <p class="text-xs text-slate-500">Quantity dispensed</p>
                                        <p class="text-sm font-medium text-slate-900">{{ formatQuantity(item.order.quantityDispensed) }} {{ item.order.dispensedUnit as string || '' }}</p>
                                    </div>
                                    <div v-if="item.order.dispensingNotes" class="sm:col-span-2">
                                        <p class="text-xs text-slate-500">Dispensing notes</p>
                                        <p class="text-sm text-slate-900">{{ item.order.dispensingNotes as string }}</p>
                                    </div>
                                </div>
                            </div>

                            <div v-if="item.order.substitutionMade" class="border-t border-slate-200 pt-4">
                                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Substitution</p>
                                <p class="mt-1.5 text-sm text-slate-900">
                                    Substituted with <span class="font-medium">{{ item.order.substitutedMedicationName as string || item.order.substitutedMedicationCode as string || '—' }}</span>
                                </p>
                            </div>
                        </div>

                        <footer class="border-t border-slate-200 bg-slate-50 px-6 py-3 sm:px-8">
                            <div class="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                                <p class="font-medium text-slate-700">{{ branding.systemName }}</p>
                                <p>{{ branding.footerText }}</p>
                                <p>Generated {{ generatedAt }}</p>
                            </div>
                        </footer>
                    </section>
                </template>
            </template>
        </main>
    </div>
</template>

<style scoped>
@media print {
    @page {
        margin: 10mm;
    }
}

.page-break {
    page-break-after: always;
    break-after: page;
}
</style>
