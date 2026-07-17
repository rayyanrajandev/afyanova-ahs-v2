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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { LaboratoryOrder } from '@/composables/laboratoryOrders/useLaboratoryOrders';

const props = withDefaults(
    defineProps<{
        open: boolean;
        order: LaboratoryOrder | null;
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

// Matches VerifyLaboratoryOrderResultUseCase's own critical-result check
// (isCriticalResultSummary: `str_contains(strtolower($resultSummary), 'result flag: critical')`)
// so the UI surfaces the requirement before the server rejects the submission.
const isCritical = computed(() => props.order?.currentCare?.hasCriticalResult ?? false);
const noteMissing = computed(() => isCritical.value && verificationNote.value.trim() === '');

function submit(): void {
    emit('submit', { verificationNote: verificationNote.value.trim() || null });
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent variant="action" size="lg">
            <DialogHeader>
                <DialogTitle>Verify result</DialogTitle>
                <DialogDescription>Confirm the laboratory result was reviewed and release it.</DialogDescription>
            </DialogHeader>

            <div class="grid grid-cols-2 gap-4">
                <div class="rounded-lg border bg-muted/20 p-3">
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Order</p>
                    <p class="mt-2 text-sm font-medium text-foreground">
                        {{ order?.testName || order?.testCode || 'Laboratory order' }}
                    </p>
                    <p v-if="order?.resultSummary" class="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                        {{ order.resultSummary }}
                    </p>
                </div>

                <div class="flex flex-col gap-4">
                    <div class="grid gap-2">
                        <Label for="lab-verify-note">
                            Verification note<span v-if="isCritical"> (required for critical results)</span><span v-else> (optional)</span>
                        </Label>
                        <Textarea id="lab-verify-note" v-model="verificationNote" rows="3" />
                    </div>

                    <Alert v-if="error" variant="destructive">
                        <AlertDescription>{{ error }}</AlertDescription>
                    </Alert>
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" :disabled="loading" @click="emit('update:open', false)">Close</Button>
                <Button :disabled="loading || noteMissing" @click="submit">{{ loading ? 'Saving...' : 'Verify' }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
