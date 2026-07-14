<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { PharmacyOrder } from '@/composables/pharmacyOrders/usePharmacyOrders';

type FormularyDecisionStatus = 'not_reviewed' | 'formulary' | 'non_formulary' | 'restricted';

const props = withDefaults(
    defineProps<{
        open: boolean;
        order: PharmacyOrder | null;
        loading?: boolean;
        error?: string | null;
    }>(),
    {
        loading: false,
        error: null,
    },
);

const emit = defineEmits<{
    'update:open': [value: boolean];
    submit: [
        payload: {
            formularyDecisionStatus: FormularyDecisionStatus;
            formularyDecisionReason?: string | null;
            substitutionAllowed: boolean;
            substitutionMade: boolean;
            substitutedMedicationCode?: string | null;
            substitutedMedicationName?: string | null;
            substitutionReason?: string | null;
        },
    ];
}>();

const formularyDecisionStatus = ref<FormularyDecisionStatus>('formulary');
const formularyDecisionReason = ref('');
const substitutionAllowed = ref(false);
const substitutionMade = ref(false);
const substitutedMedicationCode = ref('');
const substitutedMedicationName = ref('');
const substitutionReason = ref('');

const decisionOptions: Array<{ value: FormularyDecisionStatus; label: string }> = [
    { value: 'not_reviewed', label: 'Not reviewed' },
    { value: 'formulary', label: 'On formulary' },
    { value: 'non_formulary', label: 'Non-formulary' },
    { value: 'restricted', label: 'Restricted' },
];

const reasonRequired = computed(
    () => formularyDecisionStatus.value === 'non_formulary' || formularyDecisionStatus.value === 'restricted',
);

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) return;
        const order = props.order;
        formularyDecisionStatus.value = (order?.formularyDecisionStatus as FormularyDecisionStatus) || 'formulary';
        formularyDecisionReason.value = order?.formularyDecisionReason || '';
        substitutionAllowed.value = order?.substitutionAllowed ?? false;
        substitutionMade.value = order?.substitutionMade ?? false;
        substitutedMedicationCode.value = order?.substitutedMedicationCode || '';
        substitutedMedicationName.value = order?.substitutedMedicationName || '';
        substitutionReason.value = order?.substitutionReason || '';
    },
);

function submit(): void {
    emit('submit', {
        formularyDecisionStatus: formularyDecisionStatus.value,
        formularyDecisionReason: formularyDecisionReason.value.trim() || null,
        substitutionAllowed: substitutionAllowed.value,
        substitutionMade: substitutionMade.value,
        substitutedMedicationCode: substitutionMade.value ? substitutedMedicationCode.value.trim() || null : null,
        substitutedMedicationName: substitutionMade.value ? substitutedMedicationName.value.trim() || null : null,
        substitutionReason: substitutionMade.value ? substitutionReason.value.trim() || null : null,
    });
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent variant="action" size="lg">
            <DialogHeader>
                <DialogTitle>Formulary decision</DialogTitle>
                <DialogDescription>Record the formulary review outcome, and any substitution made.</DialogDescription>
            </DialogHeader>

            <div class="space-y-4">
                <div class="rounded-lg border bg-muted/20 p-3">
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Order</p>
                    <p class="mt-2 text-sm font-medium text-foreground">
                        {{ order?.medicationName || order?.medicationCode || 'Pharmacy order' }}
                    </p>
                </div>

                <div class="grid gap-2">
                    <Label for="pharmacy-policy-status">Formulary decision</Label>
                    <Select v-model="formularyDecisionStatus">
                        <SelectTrigger id="pharmacy-policy-status" class="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="option in decisionOptions" :key="option.value" :value="option.value">
                                {{ option.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div v-if="reasonRequired" class="grid gap-2">
                    <Label for="pharmacy-policy-reason">Reason</Label>
                    <Textarea id="pharmacy-policy-reason" v-model="formularyDecisionReason" rows="3" placeholder="Required for non-formulary/restricted decisions." />
                </div>

                <div class="flex items-center justify-between rounded-lg border p-3">
                    <div>
                        <p class="text-sm font-medium">Substitution allowed</p>
                        <p class="text-xs text-muted-foreground">Pharmacist may substitute an equivalent medication.</p>
                    </div>
                    <Switch v-model="substitutionAllowed" aria-label="Substitution allowed" />
                </div>

                <div class="flex items-center justify-between rounded-lg border p-3">
                    <div>
                        <p class="text-sm font-medium">Substitution made</p>
                        <p class="text-xs text-muted-foreground">A different medication was actually dispensed.</p>
                    </div>
                    <Switch v-model="substitutionMade" aria-label="Substitution made" />
                </div>

                <template v-if="substitutionMade">
                    <div class="grid grid-cols-2 gap-3">
                        <div class="grid gap-2">
                            <Label for="pharmacy-policy-sub-code">Substituted medication code</Label>
                            <Input id="pharmacy-policy-sub-code" v-model="substitutedMedicationCode" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="pharmacy-policy-sub-name">Substituted medication name</Label>
                            <Input id="pharmacy-policy-sub-name" v-model="substitutedMedicationName" />
                        </div>
                    </div>
                    <div class="grid gap-2">
                        <Label for="pharmacy-policy-sub-reason">Substitution reason</Label>
                        <Textarea id="pharmacy-policy-sub-reason" v-model="substitutionReason" rows="2" />
                    </div>
                </template>

                <Alert v-if="error" variant="destructive">
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" :disabled="loading" @click="emit('update:open', false)">Close</Button>
                <Button :disabled="loading" @click="submit">{{ loading ? 'Saving...' : 'Save decision' }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
