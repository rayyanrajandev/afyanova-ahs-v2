<script setup lang="ts">
import { ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { billingPaymentMethodOptions } from '@/pages/billing/constants';
import { notifyError } from '@/lib/notify';
import type { BillingInvoice } from '@/composables/billingCashierQueue/useBillingPatientInvoices';

const props = defineProps<{
    invoice: BillingInvoice;
    patientId: string;
    recordPayment: (input: { invoiceId: string; amount: number; paymentMethod: string; paymentReference: string }) => Promise<any>;
}>();

const emit = defineEmits<{
    complete: [];
    close: [];
}>();

const open = ref(true);
const amount = ref(props.invoice.balanceAmount);
const method = ref('cash');
const reference = ref('');
const saving = ref(false);
const showSheet = ref(true);

watch(open, (val) => { if (!val) emit('close'); });

function formatMoney(val: number, currency?: string | null): string {
    const formatted = new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    return `${formatted} ${currency || 'TZS'}`;
}

async function recordPayment(): Promise<void> {
    if (amount.value <= 0 || !props.patientId) return;

    saving.value = true;
    showSheet.value = false;

    try {
        await props.recordPayment({
            invoiceId: props.invoice.id,
            amount: amount.value,
            paymentMethod: method.value,
            paymentReference: reference.value,
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
        <SheetContent side="right" variant="form" size="xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 pr-12 text-left">
                <SheetTitle>Record Payment</SheetTitle>
                <SheetDescription>
                    {{ invoice.invoiceNumber || 'Draft invoice' }} — Balance: {{ formatMoney(invoice.balanceAmount, invoice.currencyCode) }}
                </SheetDescription>
            </SheetHeader>

            <div class="flex-1 space-y-4 overflow-y-auto p-4">
                <div>
                    <Label for="paymentAmount">Amount</Label>
                    <Input id="paymentAmount" v-model.number="amount" type="number" min="1" :max="invoice.balanceAmount || 0" class="mt-1" />
                </div>

                <div>
                    <Label for="paymentMethod">Payment Method</Label>
                    <Select v-model="method">
                        <SelectTrigger class="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="opt in billingPaymentMethodOptions" :key="opt.value" :value="opt.value">
                                {{ opt.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label for="paymentReference">Reference (optional)</Label>
                    <Input id="paymentReference" v-model="reference" placeholder="Receipt number, transaction ID..." class="mt-1" />
                </div>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="emit('close')">Cancel</Button>
                <Button :disabled="amount <= 0" @click="recordPayment()">Record Payment</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
