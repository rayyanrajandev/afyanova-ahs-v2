<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import WardBedPicker from '@/components/admissions/WardBedPicker.vue';
import { useAdmissionDischargeDestinationOptions } from '@/composables/admissions/useAdmissionDischargeDestinationOptions';
import {
    useUpdateAdmissionStatus,
    type AdmissionStatusTarget,
} from '@/composables/admissions/useUpdateAdmissionStatus';
import { useDischargeReadiness } from '@/composables/admissions/useDischargeReadiness';
import { messageFromUnknown } from '@/lib/notify';

/**
 * One dialog for discharge/transfer/cancel — matches
 * EmergencyStatusDialog.vue/DirectServiceStatusDialog.vue's established
 * shape (one dialog, fields gated by target status) rather than three
 * separate ones. Transfer's bed picker is WardBedPicker.vue (P3 of the
 * Reception/Emergency/Admission/Bed-Management audit follow-through) — the
 * legacy free-text receivingWard/receivingBed pair still works server-side
 * but isn't offered here, same "V2 ships the real thing" choice as
 * CreateAdmissionSheet.vue. The admission's own current bed naturally shows
 * as occupied (by itself) and is disabled, which correctly prevents
 * "transferring" to the same bed — preserved via WardBedPicker's
 * `initial-ward` prop.
 *
 * Discharge readiness (AdmC of the Admission V2 full-parity plan): ported
 * from the legacy page's discharge-readiness checklist, gating Confirm on
 * the same two required checks, per the user's explicit decision to keep
 * that safety behavior — see useDischargeReadiness.ts's own docblock.
 */
export type AdmissionStatusTargetRequest = {
    admissionId: string;
    admissionNumber: string | null;
    currentWardName?: string | null;
    patientId: string | null;
    admittedAt: string | null;
    createdAt: string | null;
};

const props = defineProps<{
    target: AdmissionStatusTargetRequest | null;
    action: AdmissionStatusTarget | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    updated: [];
}>();

const reason = ref('');
const dischargeDestination = ref('');
const followUpPlan = ref('');
const receivingBedResourceId = ref('');
const submitError = ref<string | null>(null);

const update = useUpdateAdmissionStatus();
const dischargeDestinationOptions = useAdmissionDischargeDestinationOptions();

// Gated on action === 'discharged' (not just `open`) so the four
// linked-module fetches never fire for transfer/cancel dialogs — only
// discharge needs readiness data.
const readinessAdmission = computed(() =>
    props.target && props.action === 'discharged'
        ? { id: props.target.admissionId, patientId: props.target.patientId, admittedAt: props.target.admittedAt, createdAt: props.target.createdAt }
        : null,
);
const readiness = useDischargeReadiness(readinessAdmission);

watch(open, (isOpen) => {
    if (!isOpen) return;
    reason.value = '';
    dischargeDestination.value = '';
    followUpPlan.value = '';
    receivingBedResourceId.value = '';
    submitError.value = null;
});

const meta = computed(() => {
    switch (props.action) {
        case 'discharged':
            return { title: 'Discharge patient', description: 'Close this admission and record the discharge handoff.' };
        case 'transferred':
            return { title: 'Transfer patient', description: 'Move this admission to a different bed.' };
        case 'cancelled':
            return { title: 'Cancel admission', description: 'Remove this admission with a documented reason.' };
        default:
            return { title: 'Update admission', description: '' };
    }
});

const needsDischargeFields = computed(() => props.action === 'discharged');
const needsBedSelection = computed(() => props.action === 'transferred');

const canSubmit = computed(() => {
    if (update.isPending.value) return false;
    if (reason.value.trim() === '') return false;
    if (needsDischargeFields.value && dischargeDestination.value.trim() === '') return false;
    if (needsBedSelection.value && receivingBedResourceId.value.trim() === '') return false;
    if (needsDischargeFields.value && !readiness.canConfirmDischarge.value) return false;
    return true;
});

async function submit(): Promise<void> {
    if (!props.target || !props.action) return;
    submitError.value = null;

    try {
        await update.mutateAsync({
            admissionId: props.target.admissionId,
            status: props.action,
            reason: reason.value.trim(),
            dischargeDestination: needsDischargeFields.value ? dischargeDestination.value.trim() : null,
            followUpPlan: needsDischargeFields.value ? followUpPlan.value.trim() || null : null,
            receivingBedResourceId: needsBedSelection.value ? receivingBedResourceId.value : null,
        });
        emit('updated');
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { message?: string } };
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to update this admission.');
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => (open = value)">
        <DialogContent size="md">
            <DialogHeader>
                <DialogTitle>{{ meta.title }}</DialogTitle>
                <DialogDescription>
                    {{ target?.admissionNumber || '' }} — {{ meta.description }}
                </DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-2">
                <WardBedPicker
                    v-if="needsBedSelection"
                    v-model="receivingBedResourceId"
                    id-prefix="admission-status-receiving"
                    ward-label="Receiving ward"
                    bed-label="Receiving bed"
                    :initial-ward="target?.currentWardName"
                />

                <div v-if="needsDischargeFields" class="space-y-3 rounded-lg border p-3">
                    <div class="flex items-center justify-between gap-2">
                        <p class="text-xs font-medium text-foreground">Discharge readiness</p>
                        <span class="text-[11px] text-muted-foreground">
                            {{ readiness.requiredComplete.value }}/{{ readiness.requiredTotal.value }} required complete
                        </span>
                    </div>

                    <div v-for="section in readiness.sections.value" :key="section.key" class="space-y-1.5">
                        <p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{{ section.label }}</p>
                        <div v-for="item in section.items" :key="item.key" class="flex items-start gap-2">
                            <Checkbox
                                v-if="item.manualKey"
                                :checked="item.complete"
                                class="mt-0.5"
                                @update:checked="(checked: boolean) => readiness.setManualChecklistValue(item.manualKey, checked)"
                            />
                            <AppIcon
                                v-else
                                :name="item.complete ? 'check-circle' : 'alert-circle'"
                                :class="`mt-0.5 size-3.5 shrink-0 ${item.complete ? 'text-emerald-600' : item.required ? 'text-destructive' : 'text-muted-foreground'}`"
                            />
                            <div class="min-w-0 flex-1">
                                <p class="text-xs font-medium text-foreground">
                                    {{ item.label }}
                                    <span v-if="item.required" class="text-destructive">*</span>
                                </p>
                                <p class="text-[11px] text-muted-foreground">{{ item.statusText }}</p>
                                <a v-if="item.actionHref" :href="item.actionHref" class="text-[11px] font-medium text-primary hover:underline">
                                    {{ item.actionLabel }}
                                </a>
                            </div>
                        </div>
                    </div>

                    <Alert v-if="readiness.blockReason.value" variant="destructive">
                        <AlertDescription>{{ readiness.blockReason.value }}</AlertDescription>
                    </Alert>
                </div>

                <SearchableSelectField
                    v-if="needsDischargeFields"
                    v-model="dischargeDestination"
                    input-id="admission-status-discharge-destination"
                    label="Discharge destination"
                    :options="dischargeDestinationOptions.data.value ?? []"
                    placeholder="Select a destination"
                    allow-custom-value
                />

                <div v-if="needsDischargeFields" class="grid gap-2">
                    <Label for="admission-status-follow-up-plan">Follow-up plan (optional)</Label>
                    <Textarea id="admission-status-follow-up-plan" v-model="followUpPlan" rows="3" maxlength="2000" />
                </div>

                <div class="grid gap-2">
                    <Label for="admission-status-reason">Reason</Label>
                    <Textarea id="admission-status-reason" v-model="reason" rows="3" maxlength="255" />
                </div>

                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to update this admission</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Close</Button>
                <Button :variant="action === 'cancelled' ? 'destructive' : 'default'" :disabled="!canSubmit" @click="submit">
                    {{ update.isPending.value ? 'Saving…' : meta.title }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
