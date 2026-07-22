<script setup lang="ts">
import { ref, computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePatientPayments, type PatientPaymentWithInvoice } from '@/composables/billingWorkspace/usePatientPayments';
import {
    billingPaymentMethodLabel,
    billingPaymentIsReversal,
    formatDateTime,
} from '@/pages/billing/invoices/helpers';
import { amountToNumber } from '@/pages/billing/invoices/helpers';
import type { BillingInvoice } from '@/composables/billingCashierQueue/useBillingPatientInvoices';
import PaymentReversalSheet from '../sheets/PaymentReversalSheet.vue';

const props = defineProps<{
    invoices: BillingInvoice[];
    patientId: string;
    reversePayment: (input: { invoiceId: string; paymentId: string; amount: number; reason: string }) => Promise<any>;
    invalidate: (patientId: string | null) => void;
}>();

const { data: payments, isLoading } = usePatientPayments(
    computed(() => props.patientId),
    computed(() => props.invoices),
);

const reversalPayment = ref<PatientPaymentWithInvoice | null>(null);
const showReversalSheet = ref(false);

function openReversal(payment: PatientPaymentWithInvoice): void {
    reversalPayment.value = payment;
    showReversalSheet.value = true;
}

function formatMoney(amount: string | number | null, currency?: string | null): string {
    const val = amountToNumber(amount);
    if (val === null) return 'N/A';
    const formatted = new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    return `${formatted} ${currency || 'TZS'}`;
}

function handleReversalComplete(): void {
    showReversalSheet.value = false;
    reversalPayment.value = null;
    props.invalidate(props.patientId);
}
</script>

<template>
    <div class="space-y-3">
        <div v-for="payment in payments" :key="payment.id" class="rounded-lg border p-3 transition-colors">
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <Badge v-if="billingPaymentIsReversal(payment)" variant="destructive" class="text-[10px]">Reversal</Badge>
                        <p class="text-sm font-medium">{{ payment.invoiceNumber || 'Invoice' }}</p>
                        <span class="text-xs text-muted-foreground">{{ formatDateTime(payment.paymentAt || payment.createdAt) }}</span>
                    </div>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                        {{ billingPaymentMethodLabel(payment.paymentMethod) }}
                        <span v-if="payment.paymentReference"> &middot; Ref {{ payment.paymentReference }}</span>
                    </p>
                    <p v-if="billingPaymentIsReversal(payment) && payment.reversalReason" class="mt-0.5 text-xs text-muted-foreground">
                        Reason: {{ payment.reversalReason }}
                    </p>
                </div>
                <div class="text-right">
                    <p class="text-sm font-semibold tabular-nums">{{ formatMoney(payment.amount, payment.currencyCode) }}</p>
                    <div v-if="!billingPaymentIsReversal(payment)" class="mt-1 flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="ghost" class="h-7 gap-1 text-[10px]" as-child>
                            <a
                                :href="`/billing/${payment.billingInvoiceId}/payments/${payment.id}/receipt`"
                                target="_blank"
                                rel="noopener"
                            >
                                <AppIcon name="printer" class="size-3" />
                                Receipt
                            </a>
                        </Button>
                        <Button size="sm" variant="destructive" class="h-7 text-[10px]" @click="openReversal(payment)">
                            Reverse
                        </Button>
                    </div>
                </div>
            </div>
        </div>
        <div
            v-if="!isLoading && (!payments || payments.length === 0)"
            class="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
            No payments found for this patient.
        </div>
        <div v-if="isLoading" class="space-y-3">
            <div v-for="i in 3" :key="i" class="h-20 animate-pulse rounded-lg bg-muted" />
        </div>
    </div>

    <PaymentReversalSheet
        v-if="showReversalSheet && reversalPayment"
        :payment="reversalPayment"
        :invoice-id="reversalPayment.billingInvoiceId || ''"
        :patient-id="patientId"
        :reverse-payment="reversePayment"
        @complete="handleReversalComplete"
        @close="showReversalSheet = false"
    />
</template>
