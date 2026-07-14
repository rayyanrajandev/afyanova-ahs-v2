<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { useCreateEmergencyTransfer } from '@/composables/emergency/useCreateEmergencyTransfer';
import { useClinicianDirectory } from '@/composables/triage/useClinicianDirectory';
import { messageFromUnknown } from '@/lib/notify';
import type { EmergencyTransfer } from '@/composables/emergency/useEmergencyTransfers';

/**
 * P0b of the Reception/Emergency/Admission audit follow-through — a
 * facility-to-facility (or internal ward-to-ward) transfer request, opened
 * directly from a case row's expanded panel (EmergencyCaseTransfersPanel.vue)
 * rather than nested inside a tabbed detail hub. Same single-scroll-form
 * shape as EmergencyCaseCreateSheet.vue.
 *
 * source/destination are plain free-text Inputs, not the legacy page's
 * registry-backed searchable picker merging ward-bed + service-point
 * registries — transfers are an occasional workflow, and the backend only
 * requires destinationLocation as a string; the extra registry-fetch/merge
 * machinery isn't worth the complexity for this. See the audit plan's
 * design-direction note.
 */
const props = defineProps<{
    caseId: string;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    created: [transfer: EmergencyTransfer];
}>();

const transferType = ref<'internal' | 'external'>('internal');
const priority = ref<'routine' | 'urgent' | 'critical'>('urgent');
const sourceLocation = ref('');
const destinationLocation = ref('');
const destinationFacilityName = ref('');
const acceptingClinicianUserId = ref('');
const requestedAt = ref('');
const transportMode = ref('');
const clinicalHandoffNotes = ref('');
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const clinicianDirectory = useClinicianDirectory();
const create = useCreateEmergencyTransfer();

const clinicianOptions = computed(() =>
    (clinicianDirectory.data.value ?? [])
        .filter((c) => c.userId !== null)
        .map((c) => ({ value: String(c.userId), label: c.userName ?? `Clinician #${c.userId}` })),
);

watch(open, (isOpen) => {
    if (!isOpen) return;
    transferType.value = 'internal';
    priority.value = 'urgent';
    sourceLocation.value = '';
    destinationLocation.value = '';
    destinationFacilityName.value = '';
    acceptingClinicianUserId.value = '';
    requestedAt.value = defaultRequestedAtInput();
    transportMode.value = '';
    clinicalHandoffNotes.value = '';
    submitError.value = null;
    fieldErrors.value = {};
});

function defaultRequestedAtInput(): string {
    const date = new Date();
    const pad = (segment: number) => String(segment).padStart(2, '0');
    return [
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    ].join('T');
}

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

const canSubmit = computed(() => destinationLocation.value.trim() !== '' && !create.isPending.value);

async function submit(): Promise<void> {
    submitError.value = null;
    fieldErrors.value = {};

    try {
        const transfer = await create.mutateAsync({
            caseId: props.caseId,
            transferType: transferType.value,
            priority: priority.value,
            destinationLocation: destinationLocation.value.trim(),
            sourceLocation: sourceLocation.value.trim() || null,
            destinationFacilityName: transferType.value === 'external' ? destinationFacilityName.value.trim() || null : null,
            acceptingClinicianUserId: acceptingClinicianUserId.value ? Number(acceptingClinicianUserId.value) : null,
            requestedAt: requestedAt.value || null,
            transportMode: transportMode.value || null,
            clinicalHandoffNotes: clinicalHandoffNotes.value.trim() || null,
        });
        emit('created', transfer);
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { errors?: Record<string, string[]>; message?: string } };
        fieldErrors.value = apiError.payload?.errors ?? {};
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to create this transfer.');
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>New transfer</SheetTitle>
                <SheetDescription>Request a facility-to-facility or internal ward transfer for this case.</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to create this transfer</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>

                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                        <Label for="emergency-transfer-type">Transfer type</Label>
                        <Select v-model="transferType">
                            <SelectTrigger id="emergency-transfer-type" class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="internal">Internal (within facility)</SelectItem>
                                <SelectItem value="external">External (another facility)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="space-y-1.5">
                        <Label for="emergency-transfer-priority">Priority</Label>
                        <Select v-model="priority">
                            <SelectTrigger id="emergency-transfer-priority" class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="routine">Routine</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div class="space-y-1.5">
                    <Label for="emergency-transfer-source">Source location (optional)</Label>
                    <Input id="emergency-transfer-source" v-model="sourceLocation" maxlength="180" />
                    <p v-if="fieldError('sourceLocation')" class="text-sm text-destructive">{{ fieldError('sourceLocation') }}</p>
                </div>

                <div class="space-y-1.5">
                    <Label for="emergency-transfer-destination">Destination location</Label>
                    <Input id="emergency-transfer-destination" v-model="destinationLocation" maxlength="180" required />
                    <p v-if="fieldError('destinationLocation')" class="text-sm text-destructive">{{ fieldError('destinationLocation') }}</p>
                </div>

                <div v-if="transferType === 'external'" class="space-y-1.5">
                    <Label for="emergency-transfer-destination-facility">Destination facility name</Label>
                    <Input id="emergency-transfer-destination-facility" v-model="destinationFacilityName" maxlength="180" />
                    <p v-if="fieldError('destinationFacilityName')" class="text-sm text-destructive">{{ fieldError('destinationFacilityName') }}</p>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                        <Label for="emergency-transfer-requested-at">Requested at (optional)</Label>
                        <Input id="emergency-transfer-requested-at" v-model="requestedAt" type="datetime-local" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="emergency-transfer-transport-mode">Transport mode (optional)</Label>
                        <Select v-model="transportMode">
                            <SelectTrigger id="emergency-transfer-transport-mode" class="w-full">
                                <SelectValue placeholder="Select a mode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ambulance">Ambulance</SelectItem>
                                <SelectItem value="wheelchair">Wheelchair</SelectItem>
                                <SelectItem value="stretcher">Stretcher</SelectItem>
                                <SelectItem value="walk_in">Walk-in</SelectItem>
                                <SelectItem value="private_vehicle">Private vehicle</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <SearchableSelectField
                    v-model="acceptingClinicianUserId"
                    input-id="emergency-transfer-clinician"
                    label="Accepting clinician (optional)"
                    :options="clinicianOptions"
                    placeholder="Select the accepting clinician"
                    :error-message="fieldError('acceptingClinicianUserId')"
                />

                <div class="space-y-1.5">
                    <Label for="emergency-transfer-notes">Clinical handoff notes (optional)</Label>
                    <Textarea id="emergency-transfer-notes" v-model="clinicalHandoffNotes" rows="3" maxlength="5000" />
                    <p v-if="fieldError('clinicalHandoffNotes')" class="text-sm text-destructive">{{ fieldError('clinicalHandoffNotes') }}</p>
                </div>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ create.isPending.value ? 'Requesting…' : 'Request transfer' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
