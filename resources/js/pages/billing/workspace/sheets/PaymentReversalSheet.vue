<script setup lang="ts">
import { ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { notifyError, notifySuccess } from '@/lib/notify';
import { amountToNumber, formatDateTime } from '@/pages/billing/invoices/helpers';
import type { PatientPaymentWithInvoice } from '@/composables/billingWorkspace/usePatientPayments';

const props = defineProps<{
    payment: PatientPaymentWithInvoice;
    invoiceId: string;
    patientId: string;
    reversePayment: (input: { invoiceId: string; paymentId: string; amount: number; reason: string }) => Promise<any>;
}>();

const emit = defineEmits<{
    complete: [];
    close: [];
}>();

const open = ref(true);
const amount = ref(String(Math.abs(amountToNumber(props.payment.amount) ?? 0)));
const reason = ref('');
const note = ref('');
const saving = ref(false);
const localError = ref<string | null>(null);

watch(open, (val) => { if (!val) emit('close'); });

const reasonQuickActions = [
    'Duplicate payment posted',
    'Wrong amount posted',
    'Wrong payment method recorded',
    'Patient transfer or cashier correction',
];

function applyQuickAction(action: string): void {
    reason.value = action;
}

function formatMoney(val: string | number | null, currency?: string | null): string {
    const num = amountToNumber(val);
    if (num === null) return 'N/A';
    const formatted = new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
    return `${formatted} ${currency || 'TZS'}`;
}

async function submitReversal(): Promise<void> {
    const parsedAmount = Number(amount.value);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        localError.value = 'Amount must be a valid number greater than zero.';
        return;
    }
    const trimmedReason = reason.value.trim();
    if (!trimmedReason) {
        localError.value = 'Reversal reason is required.';
        return;
    }
    const originalAmount = Math.abs(amountToNumber(props.payment.amount) ?? 0);
    if (parsedAmount > originalAmount) {
        localError.value = 'Amount cannot exceed the original payment amount.';
        return;
    }

    saving.value = true;
    open.value = false;

    try {
        await props.reversePayment({
            invoiceId: props.invoiceId,
            paymentId: props.payment.id,
            amount: parsedAmount,
            reason: trimmedReason,
        });
        notifySuccess('Payment reversed.');
        emit('complete');
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to reverse payment.');
        open.value = true;
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Sheet v-model:open="open">
        <SheetContent side="right" variant="workspace" size="2xl" class="flex h-full min-h-0 flex-col">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>Reverse Payment</SheetTitle>
                <SheetDescription>
                    {{ payment.invoiceNumber || 'Invoice' }} &mdash; {{ formatMoney(payment.amount, payment.currencyCode) }}
                </SheetDescription>
            </SheetHeader>

            <ScrollArea class="min-h-0 flex-1">
                <div class="grid gap-4 px-6 py-4">
                    <div class="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                        <p>Payment of {{ formatMoney(payment.amount, payment.currencyCode) }} on {{ formatDateTime(payment.paymentAt || payment.createdAt) }}</p>
                        <p v-if="payment.paymentReference">Reference: {{ payment.paymentReference }}</p>
                    </div>

                    <fieldset class="grid gap-3 rounded-lg border p-3">
                        <legend class="px-2 text-sm font-medium text-muted-foreground">Reversal details</legend>
                        <div class="flex flex-wrap gap-2">
                            <Button
                                v-for="action in reasonQuickActions"
                                :key="action"
                                type="button"
                                variant="outline"
                                size="sm"
                                class="h-8 text-xs"
                                @click="applyQuickAction(action)"
                            >
                                {{ action }}
                            </Button>
                        </div>

                        <div>
                            <Label for="reversalAmount">Amount to Reverse</Label>
                            <Input id="reversalAmount" v-model.number="amount" type="number" min="0" step="0.01" class="mt-1 w-full" />
                        </div>

                        <div>
                            <Label for="reversalReason">Reason</Label>
                            <Textarea id="reversalReason" v-model="reason" class="mt-1 w-full min-h-20" placeholder="Required reason for audit" />
                        </div>

                        <div>
                            <Label for="reversalNote">Note (optional)</Label>
                            <Input id="reversalNote" v-model="note" class="mt-1 w-full" placeholder="Optional operator note" />
                        </div>

                        <div v-if="localError" class="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                            {{ localError }}
                        </div>
                    </fieldset>
                </div>
            </ScrollArea>

            <SheetFooter class="shrink-0 border-t bg-background px-6 py-4">
                <Button variant="outline" @click="emit('close')">Cancel</Button>
                <Button variant="destructive" :disabled="saving" @click="submitReversal()">
                    {{ saving ? 'Reversing...' : 'Reverse Payment' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
