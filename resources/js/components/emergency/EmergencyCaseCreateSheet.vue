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
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import { useCreateEmergencyCase } from '@/composables/emergency/useCreateEmergencyCase';
import { useClinicianDirectory } from '@/composables/triage/useClinicianDirectory';
import { messageFromUnknown } from '@/lib/notify';
import type { EmergencyCase } from '@/composables/emergency/useEmergencyCases';

/**
 * Phase 2 of reports/emergency-queue-modernization-plan.md — case intake.
 * Deliberately NOT the legacy page's 3-tab patient/appointment/admission
 * context editor with lookup+suggestion panels for each
 * (emergency-triage/Index.vue's "Create workspace") — a single patient
 * lookup plus the fields StoreEmergencyTriageCaseRequest actually requires
 * is enough for a fast ED intake; admissionId/appointmentId linking is an
 * edge case the legacy UI over-built for, not something every intake needs.
 * Matches AppointmentCreateSheet.vue's shape (one Sheet, one scroll of
 * fields, no wizard/tabs) rather than the old UX. Also matches its
 * `@open-auto-focus` prevention on SheetContent — same reka-ui
 * auto-focus-trips-PatientLookupField's-own-dropdown issue, since this
 * sheet's PatientLookupField is likewise the first focusable field; see
 * AppointmentCreateSheet.vue's own docblock for the full explanation.
 */
const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    created: [emergencyCase: EmergencyCase];
}>();

const patientId = ref('');
const assignedClinicianUserId = ref('');
const arrivalAt = ref('');
const triageLevel = ref<'red' | 'yellow' | 'green'>('yellow');
const chiefComplaint = ref('');
const vitalsSummary = ref('');
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const clinicianDirectory = useClinicianDirectory();
const create = useCreateEmergencyCase();

const clinicianOptions = computed(() =>
    (clinicianDirectory.data.value ?? [])
        .filter((c) => c.userId !== null)
        .map((c) => ({ value: String(c.userId), label: c.userName ?? `Clinician #${c.userId}` })),
);

watch(open, (isOpen) => {
    if (!isOpen) return;
    patientId.value = '';
    assignedClinicianUserId.value = '';
    arrivalAt.value = defaultArrivalAtInput();
    triageLevel.value = 'yellow';
    chiefComplaint.value = '';
    vitalsSummary.value = '';
    submitError.value = null;
    fieldErrors.value = {};
});

function defaultArrivalAtInput(): string {
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

const canSubmit = computed(
    () => patientId.value.trim() !== '' && arrivalAt.value.trim() !== '' && chiefComplaint.value.trim() !== '' && !create.isPending.value,
);

async function submit(): Promise<void> {
    submitError.value = null;
    fieldErrors.value = {};

    try {
        const emergencyCase = await create.mutateAsync({
            patientId: patientId.value,
            assignedClinicianUserId: assignedClinicianUserId.value ? Number(assignedClinicianUserId.value) : null,
            arrivalAt: arrivalAt.value,
            triageLevel: triageLevel.value,
            chiefComplaint: chiefComplaint.value.trim(),
            vitalsSummary: vitalsSummary.value.trim() || null,
        });
        emit('created', emergencyCase);
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { errors?: Record<string, string[]>; message?: string } };
        fieldErrors.value = apiError.payload?.errors ?? {};
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to create this emergency case.');
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent
            side="right"
            variant="form"
            size="2xl"
            @open-auto-focus="(event: Event) => event.preventDefault()"
        >
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>New emergency case</SheetTitle>
                <SheetDescription>Record an ED arrival and its initial acuity.</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to create this emergency case</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>

                <PatientLookupField
                    v-model="patientId"
                    input-id="emergency-case-create-patient"
                    label="Patient"
                    required
                    :error-message="fieldError('patientId')"
                />

                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                        <Label for="emergency-case-create-arrival">Arrived at</Label>
                        <Input id="emergency-case-create-arrival" v-model="arrivalAt" type="datetime-local" />
                        <p v-if="fieldError('arrivalAt')" class="text-sm text-destructive">{{ fieldError('arrivalAt') }}</p>
                    </div>
                    <div class="space-y-1.5">
                        <Label for="emergency-case-create-triage-level">Triage level</Label>
                        <Select v-model="triageLevel">
                            <SelectTrigger id="emergency-case-create-triage-level" class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="red">Red</SelectItem>
                                <SelectItem value="yellow">Yellow</SelectItem>
                                <SelectItem value="green">Green</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="fieldError('triageLevel')" class="text-sm text-destructive">{{ fieldError('triageLevel') }}</p>
                    </div>
                </div>

                <SearchableSelectField
                    v-model="assignedClinicianUserId"
                    input-id="emergency-case-create-clinician"
                    label="Assigned clinician (optional)"
                    :options="clinicianOptions"
                    placeholder="Select the assigned clinician"
                    :error-message="fieldError('assignedClinicianUserId')"
                />

                <div class="space-y-1.5">
                    <Label for="emergency-case-create-complaint">Chief complaint</Label>
                    <Input id="emergency-case-create-complaint" v-model="chiefComplaint" maxlength="255" placeholder="Reason for the ED visit" />
                    <p v-if="fieldError('chiefComplaint')" class="text-sm text-destructive">{{ fieldError('chiefComplaint') }}</p>
                </div>

                <div class="space-y-1.5">
                    <Label for="emergency-case-create-vitals">Vitals summary (optional)</Label>
                    <Textarea id="emergency-case-create-vitals" v-model="vitalsSummary" rows="3" maxlength="2000" />
                    <p v-if="fieldError('vitalsSummary')" class="text-sm text-destructive">{{ fieldError('vitalsSummary') }}</p>
                </div>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ create.isPending.value ? 'Creating…' : 'Create case' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
