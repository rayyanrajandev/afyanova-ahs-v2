<script setup lang="ts">
import { ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import BillingRecordPaymentForm from '@/pages/billing/components/BillingRecordPaymentForm.vue';
import { billingDefaultPayerTypeFromInvoice } from '@/pages/billing/constants';
import { billingRecordPaymentFormIsValid, validateBillingRecordPaymentForm } from '@/pages/billing/helpers';
import { notifyError } from '@/lib/notify';
import type { BillingInvoice } from '@/composables/billingCashierQueue/useBillingPatientInvoices';

const props = defineProps<{
    invoice: BillingInvoice;
    patientId: string;
    recordPayment: (input: {
        invoiceId: string;
        amount: number;
        payerType: string;
        paymentMethod: string;
        paymentReference: string;
        note?: string;
    }) => Promise<any>;
}>();

const emit = defineEmits<{
    complete: [];
    close: [];
}>();

const open = ref(true);
const amount = ref(props.invoice.balanceAmount);
const payerType = ref(billingDefaultPayerTypeFromInvoice(props.invoice));
const method = ref('cash');
const reference = ref('');
const note = ref('');
const saving = ref(false);
const showSheet = ref(true);

watch(open, (val) => { if (!val) emit('close'); });

function formatMoney(val: number, currency?: string | null): string {
    const formatted = new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    return `${formatted} ${currency || 'TZS'}`;
}

const canSubmit = () =>
    billingRecordPaymentFormIsValid({
        amount: amount.value,
        payerType: payerType.value,
        paymentMethod: method.value,
        paymentReference: reference.value,
        note: note.value,
    });

async function recordPayment(): Promise<void> {
    const validation = validateBillingRecordPaymentForm({
        amount: amount.value,
        payerType: payerType.value,
        paymentMethod: method.value,
        paymentReference: reference.value,
        note: note.value,
    });

    if (!validation.valid) {
        notifyError(validation.message);
        return;
    }

    if (!props.patientId) return;

    saving.value = true;
    showSheet.value = false;

    try {
        await props.recordPayment({
            invoiceId: props.invoice.id,
            amount: amount.value,
            payerType: payerType.value,
            paymentMethod: method.value,
            paymentReference: reference.value.trim(),
            note: note.value.trim() || undefined,
        });
        emit('complete');
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to record payment.');
        showSheet.value = true;
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Sheet v-model:open="showSheet">
        <SheetContent side="right" variant="workspace" size="2xl" class="flex h-full min-h-0 flex-col">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>Record Payment</SheetTitle>
                <SheetDescription>
                    {{ invoice.invoiceNumber || 'Draft invoice' }} — Balance: {{ formatMoney(invoice.balanceAmount, invoice.currencyCode) }}
                </SheetDescription>
            </SheetHeader>

            <ScrollArea class="min-h-0 flex-1">
                <div class="grid gap-4 px-6 py-4">
                    <fieldset class="grid gap-3 rounded-lg border p-3">
                        <legend class="px-2 text-sm font-medium text-muted-foreground">Payment details</legend>
                        <BillingRecordPaymentForm
                            v-model:amount="amount"
                            v-model:payer-type="payerType"
                            v-model:payment-method="method"
                            v-model:payment-reference="reference"
                            v-model:note="note"
                            id-prefix="workspace-payment"
                            :max-amount="invoice.balanceAmount || 0"
                        />
                    </fieldset>
                </div>
            </ScrollArea>

            <SheetFooter class="shrink-0 border-t bg-background px-6 py-4">
                <Button variant="outline" @click="emit('close')">Cancel</Button>
                <Button :disabled="!canSubmit() || saving" @click="recordPayment()">
                    {{ saving ? 'Recording…' : 'Record Payment' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
