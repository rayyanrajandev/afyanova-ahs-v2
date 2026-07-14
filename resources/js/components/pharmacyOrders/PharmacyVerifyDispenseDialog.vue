<script setup lang="ts">
import { ref, watch } from 'vue';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PharmacyOrder } from '@/composables/pharmacyOrders/usePharmacyOrders';

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
    submit: [payload: { verificationNote?: string | null }];
}>();

const verificationNote = ref('');

watch(
    () => props.open,
    (isOpen) => {
        if (isOpen) verificationNote.value = '';
    },
);

function submit(): void {
    emit('submit', { verificationNote: verificationNote.value.trim() || null });
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent variant="action" size="lg">
            <DialogHeader>
                <DialogTitle>Verify dispense</DialogTitle>
                <DialogDescription>Confirm the dispensed medication was verified against the order.</DialogDescription>
            </DialogHeader>

            <div class="space-y-4">
                <div class="rounded-lg border bg-muted/20 p-3">
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Order</p>
                    <p class="mt-2 text-sm font-medium text-foreground">
                        {{ order?.medicationName || order?.medicationCode || 'Pharmacy order' }}
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        Dispensed: {{ order?.quantityDispensed ?? '—' }} {{ order?.dispensedUnit || '' }}
                    </p>
                </div>

                <div class="grid gap-2">
                    <Label for="pharmacy-verify-note">Verification note (optional)</Label>
                    <Textarea id="pharmacy-verify-note" v-model="verificationNote" rows="3" />
                </div>

                <Alert v-if="error" variant="destructive">
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" :disabled="loading" @click="emit('update:open', false)">Close</Button>
                <Button :disabled="loading" @click="submit">{{ loading ? 'Saving...' : 'Verify' }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
