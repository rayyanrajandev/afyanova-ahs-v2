<script setup lang="ts">
import { computed } from 'vue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    billingPaymentMethodOptions,
    billingPaymentPayerTypeOptions,
    billingPaymentNoteRequired,
    billingPaymentReferenceLabel,
    billingPaymentReferencePlaceholder,
} from '@/pages/billing/constants';
import { billingPaymentOperationalProofText, billingRecordPaymentFormIsValid } from '@/pages/billing/helpers';

const amount = defineModel<number>('amount', { required: true });
const payerType = defineModel<string>('payerType', { required: true });
const paymentMethod = defineModel<string>('paymentMethod', { required: true });
const paymentReference = defineModel<string>('paymentReference', { required: true });
const note = defineModel<string>('note', { default: '' });

const props = withDefaults(
    defineProps<{
        idPrefix?: string;
        maxAmount?: number;
        showAmount?: boolean;
        showPayerType?: boolean;
    }>(),
    {
        idPrefix: 'billing-payment',
        showAmount: true,
        showPayerType: true,
    },
);

const referenceLabel = computed(() => billingPaymentReferenceLabel(paymentMethod.value));
const referencePlaceholder = computed(() =>
    billingPaymentReferencePlaceholder(paymentMethod.value, payerType.value),
);
const proofText = computed(() => billingPaymentOperationalProofText(payerType.value, paymentMethod.value));
const noteRequired = computed(() => billingPaymentNoteRequired(paymentMethod.value));

const isValid = computed(() =>
    billingRecordPaymentFormIsValid({
        amount: amount.value,
        payerType: payerType.value,
        paymentMethod: paymentMethod.value,
        paymentReference: paymentReference.value,
        note: note.value,
    }),
);

defineExpose({ isValid });
</script>

<template>
    <div class="space-y-3">
        <div v-if="showAmount">
            <Label :for="`${idPrefix}-amount`">Amount</Label>
            <Input
                :id="`${idPrefix}-amount`"
                v-model.number="amount"
                type="number"
                min="0.01"
                :max="maxAmount"
                step="0.01"
                class="mt-1 w-full"
            />
        </div>

        <div v-if="showPayerType">
            <Label :for="`${idPrefix}-payer-type`">Payer type</Label>
            <Select v-model="payerType">
                <SelectTrigger :id="`${idPrefix}-payer-type`" class="mt-1 w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem v-for="opt in billingPaymentPayerTypeOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                    </SelectItem>
                </SelectContent>
            </Select>
        </div>

        <div>
            <Label :for="`${idPrefix}-method`">Payment method</Label>
            <Select v-model="paymentMethod">
                <SelectTrigger :id="`${idPrefix}-method`" class="mt-1 w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem v-for="opt in billingPaymentMethodOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                    </SelectItem>
                </SelectContent>
            </Select>
        </div>

        <div>
            <Label :for="`${idPrefix}-reference`">{{ referenceLabel }}</Label>
            <Input
                :id="`${idPrefix}-reference`"
                v-model="paymentReference"
                :placeholder="referencePlaceholder"
                class="mt-1 w-full"
            />
            <p class="mt-1.5 text-xs text-muted-foreground">{{ proofText }}</p>
        </div>

        <div>
            <Label :for="`${idPrefix}-note`">
                Note
                <span v-if="noteRequired" class="text-destructive">(required for waiver)</span>
                <span v-else class="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
                :id="`${idPrefix}-note`"
                v-model="note"
                rows="3"
                :placeholder="noteRequired ? 'Explain who approved the waiver and why.' : 'Cashier note or payment context'"
                class="mt-1 w-full"
            />
        </div>
    </div>
</template>
