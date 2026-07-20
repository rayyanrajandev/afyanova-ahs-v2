<script setup lang="ts">
import { computed, toRef } from 'vue';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePatientInsuranceRecords } from '@/composables/patientChart/usePatientInsuranceRecords';
import {
    billingInvoiceCoveragePosture,
    billingInvoiceSettlementFinancialClass,
    formatDate,
    billingPaymentPayerTypeLabel,
    amountToNumber,
} from '@/pages/billing/invoices/helpers';
import { financialClassLabel } from '@/lib/financialCoverage';
import type { BillingInvoice } from '@/composables/billingCashierQueue/useBillingPatientInvoices';

const props = defineProps<{
    invoices: BillingInvoice[];
    patientId: string;
}>();

const patientIdRef = toRef(props, 'patientId');
const { data: insuranceRecords, isLoading: insuranceLoading } = usePatientInsuranceRecords(patientIdRef);

const thirdPartyInvoices = computed(() =>
    props.invoices.filter((inv) => {
        const fc = billingInvoiceSettlementFinancialClass(inv as any);
        return fc === 'insurance' || fc === 'government' || fc === 'employer' || fc === 'other';
    }),
);

// Matches encounters/WorkspaceV2.vue's Results tab (hasAnyResults): one
// combined empty message when nothing exists at all, otherwise only the
// section(s) that actually have data render — no "No X yet" placeholder for
// a section sitting empty next to a populated one.
const hasAnyInsuranceData = computed(
    () => (insuranceRecords.value?.length ?? 0) > 0 || thirdPartyInvoices.value.length > 0,
);

function formatMoney(amount: string | number | null, currency?: string | null): string {
    const val = amountToNumber(amount);
    if (val === null) return 'N/A';
    const formatted = new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    return `${formatted} ${currency || 'TZS'}`;
}

function statusBadgeVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    const s = (status ?? '').toLowerCase();
    if (s === 'active') return 'default';
    if (s === 'expired') return 'destructive';
    return 'outline';
}

function verificationBadgeVariant(status: string | null): 'secondary' | 'outline' | 'destructive' {
    const s = (status ?? '').toLowerCase();
    if (s === 'verified') return 'secondary';
    if (s === 'pending') return 'outline';
    return 'destructive';
}
</script>

<template>
    <div class="space-y-4">
        <div v-if="insuranceLoading" class="space-y-2">
            <div v-for="i in 2" :key="i" class="h-16 animate-pulse rounded-lg bg-muted" />
        </div>

        <div
            v-else-if="!hasAnyInsuranceData"
            class="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
            No insurance or third-party coverage information found.
        </div>

        <template v-else>
            <Card v-if="insuranceRecords && insuranceRecords.length > 0">
                <CardHeader class="pb-3">
                    <CardTitle class="text-sm font-medium">Insurance Records</CardTitle>
                </CardHeader>
                <CardContent class="space-y-3">
                    <div
                        v-for="record in insuranceRecords"
                        :key="record.id"
                        class="rounded-lg border p-3"
                    >
                        <div class="flex items-start justify-between gap-2">
                            <div>
                                <div class="flex items-center gap-2">
                                    <p class="text-sm font-medium">{{ record.insuranceProvider || 'Unknown provider' }}</p>
                                    <Badge :variant="statusBadgeVariant(record.status)" class="text-[10px]">
                                        {{ record.status || 'Unknown' }}
                                    </Badge>
                                    <Badge :variant="verificationBadgeVariant(record.verificationStatus)" class="text-[10px]">
                                        {{ record.verificationStatus || 'Unverified' }}
                                    </Badge>
                                </div>
                                <div class="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                    <p v-if="record.planName">Plan: {{ record.planName }}</p>
                                    <p v-if="record.policyNumber">Policy: {{ record.policyNumber }}</p>
                                    <p v-if="record.memberId">Member ID: {{ record.memberId }}</p>
                                    <p v-if="record.cardNumber">Card: {{ record.cardNumber }}</p>
                                    <p v-if="record.effectiveDate || record.expiryDate">
                                        {{ formatDate(record.effectiveDate) }} &mdash; {{ formatDate(record.expiryDate) }}
                                    </p>
                                    <p v-if="record.copayPercent !== null">Copay: {{ record.copayPercent }}%</p>
                                    <p v-if="record.principalMemberName">Principal: {{ record.principalMemberName }}</p>
                                    <p v-if="record.lastVerifiedAt">Last verified: {{ formatDate(record.lastVerifiedAt) }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card v-if="thirdPartyInvoices.length > 0">
                <CardHeader class="pb-3">
                    <CardTitle class="text-sm font-medium">Third-Party Invoices ({{ thirdPartyInvoices.length }})</CardTitle>
                </CardHeader>
                <CardContent class="space-y-3">
                    <div
                        v-for="invoice in thirdPartyInvoices"
                        :key="invoice.id"
                        class="rounded-lg border p-3"
                    >
                        <div class="flex items-start justify-between gap-2">
                            <div>
                                <p class="text-sm font-medium">{{ invoice.invoiceNumber || 'Draft' }}</p>
                                <div class="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                    <p v-if="invoice.payerSummary?.payerName">
                                        Payer: {{ invoice.payerSummary.payerName }}
                                        ({{ billingPaymentPayerTypeLabel(invoice.payerSummary.payerType) }})
                                    </p>
                                    <p v-if="invoice.payerSummary?.contractName">
                                        Contract: {{ invoice.payerSummary.contractName }}
                                    </p>
                                    <p v-if="invoice.payerSummary?.coveragePercent !== null">
                                        Coverage: {{ invoice.payerSummary.coveragePercent }}%
                                    </p>
                                    <p v-if="invoice.payerSummary?.expectedPayerAmount">
                                        Expected payer: {{ formatMoney(invoice.payerSummary.expectedPayerAmount, invoice.currencyCode) }}
                                    </p>
                                </div>
                            </div>
                            <Badge
                                :variant="billingInvoiceCoveragePosture(invoice as any)?.badgeVariant ?? 'outline'"
                                class="text-[10px]"
                            >
                                {{ billingInvoiceCoveragePosture(invoice as any)?.label ?? 'Unknown' }}
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </template>
    </div>
</template>
