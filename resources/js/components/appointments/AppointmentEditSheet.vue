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
import { useAppointmentDepartmentOptions } from '@/composables/appointmentsIndex/useAppointmentDepartmentOptions';
import { useAppointmentEdit } from '@/composables/appointmentsIndex/useAppointmentEdit';
import { type AppointmentListItem } from '@/composables/appointmentsIndex/useAppointmentList';
import { useClinicianDirectory } from '@/composables/triage/useClinicianDirectory';
import { formatTimeSlotLabel, generateTimeSlotOptions, toIsoDateString } from '@/lib/appointmentTimeSlots';
import { messageFromUnknown } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';

/**
 * Phase 2 of reports/appointments-scheduling-workspace-modernization-plan.md.
 * Doubles as "reschedule" — same PATCH /appointments/{id} endpoint the
 * legacy page's separate Reschedule dialog calls
 * (appointments/Index.vue:3693-3703); one sheet covers both here.
 * patientId is intentionally not editable — see useAppointmentEdit.ts's
 * docblock. Clinician field added for the patient flow redesign's
 * appointment workflow A2, physician-only + department-filtered exactly
 * as AppointmentCreateSheet.vue — see that file's docblock. Scheduled
 * date/time split into a date input + time-slot Select the same way too;
 * `timeSlotOptions` here additionally folds in the appointment's own
 * existing time if it falls off the fixed 15-minute grid (older data, or a
 * time outside the 07:00–19:00 range), so editing never silently drops or
 * mismatches an odd existing time.
 */
const props = defineProps<{
    appointment: AppointmentListItem | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    updated: [appointment: AppointmentListItem];
}>();

function toDatePart(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : toIsoDateString(date);
}

function toTimePart(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const scheduledDate = ref('');
const scheduledTime = ref('');
const durationMinutes = ref('');
const clinicianUserId = ref('');
const department = ref('');
const reason = ref('');
const notes = ref('');
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const scheduledAt = computed(() => (scheduledDate.value && scheduledTime.value ? `${scheduledDate.value}T${scheduledTime.value}` : ''));
const timeSlotOptions = computed(() => {
    const base = generateTimeSlotOptions();
    if (scheduledTime.value && !base.includes(scheduledTime.value)) {
        return [...base, scheduledTime.value].sort();
    }
    return base;
});

const departmentOptions = useAppointmentDepartmentOptions();
const clinicianDirectory = useClinicianDirectory({ physicianOnly: true });

function normalizeDepartment(value: string | null): string {
    return value?.trim().toLowerCase() ?? '';
}

const clinicianOptions = computed<SearchableSelectOption[]>(() => {
    const selectedDepartment = normalizeDepartment(department.value);

    return (clinicianDirectory.data.value ?? [])
        .filter((entry) => entry.userId !== null)
        .filter((entry) => selectedDepartment === '' || normalizeDepartment(entry.department) === selectedDepartment)
        .map((entry) => ({
            value: String(entry.userId),
            label: entry.userName ?? `Clinician #${entry.userId}`,
            description: entry.department,
        }));
});

watch(department, () => {
    if (clinicianUserId.value === '') return;
    if (clinicianOptions.value.some((option) => option.value === clinicianUserId.value)) return;
    clinicianUserId.value = '';
});

const edit = useAppointmentEdit();

watch([open, () => props.appointment], ([isOpen, appointment]) => {
    if (!isOpen || !appointment) return;
    scheduledDate.value = toDatePart(appointment.scheduledAt);
    scheduledTime.value = toTimePart(appointment.scheduledAt);
    durationMinutes.value = appointment.durationMinutes ? String(appointment.durationMinutes) : '';
    clinicianUserId.value = appointment.clinicianUserId ? String(appointment.clinicianUserId) : '';
    department.value = appointment.department ?? '';
    reason.value = appointment.reason ?? '';
    notes.value = '';
    submitError.value = null;
    fieldErrors.value = {};
});

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

const canSubmit = computed(() => scheduledAt.value.trim() !== '' && !edit.isPending.value);

async function submit(): Promise<void> {
    if (!props.appointment) return;
    submitError.value = null;
    fieldErrors.value = {};

    try {
        const appointment = await edit.mutateAsync({
            appointmentId: props.appointment.id,
            scheduledAt: scheduledAt.value,
            clinicianUserId: clinicianUserId.value ? Number(clinicianUserId.value) : null,
            durationMinutes: durationMinutes.value ? Number(durationMinutes.value) : null,
            department: department.value || null,
            reason: reason.value.trim() || null,
            notes: notes.value.trim() || null,
        });
        emit('updated', appointment);
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { errors?: Record<string, string[]>; message?: string } };
        fieldErrors.value = apiError.payload?.errors ?? {};
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to update this appointment.');
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>Edit appointment</SheetTitle>
                <SheetDescription>{{ appointment?.appointmentNumber || 'Update the schedule, department, or reason.' }}</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to update this appointment</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>

                <div class="grid grid-cols-3 gap-3">
                    <div class="space-y-1.5">
                        <Label for="appointment-edit-date">Date</Label>
                        <Input id="appointment-edit-date" v-model="scheduledDate" type="date" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="appointment-edit-time">Time</Label>
                        <Select v-model="scheduledTime">
                            <SelectTrigger id="appointment-edit-time" class="w-full">
                                <SelectValue placeholder="Select a time" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="slot in timeSlotOptions" :key="slot" :value="slot">
                                    {{ formatTimeSlotLabel(slot) }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="space-y-1.5">
                        <Label for="appointment-edit-duration">Duration, minutes (optional)</Label>
                        <Input id="appointment-edit-duration" v-model="durationMinutes" type="number" min="5" max="480" step="5" />
                        <p v-if="fieldError('durationMinutes')" class="text-sm text-destructive">{{ fieldError('durationMinutes') }}</p>
                    </div>
                </div>
                <p v-if="fieldError('scheduledAt')" class="text-sm text-destructive">{{ fieldError('scheduledAt') }}</p>

                <SearchableSelectField
                    v-model="department"
                    input-id="appointment-edit-department"
                    label="Department (optional)"
                    :options="departmentOptions.data.value ?? []"
                    placeholder="Select a department"
                    allow-custom-value
                    :error-message="fieldError('department')"
                />

                <SearchableSelectField
                    v-model="clinicianUserId"
                    input-id="appointment-edit-clinician"
                    label="Clinician (optional)"
                    :options="clinicianOptions"
                    placeholder="Select a clinician"
                    empty-text="No matching clinician found."
                    :error-message="fieldError('clinicianUserId')"
                />

                <div class="space-y-1.5">
                    <Label for="appointment-edit-reason">Reason (optional)</Label>
                    <Input id="appointment-edit-reason" v-model="reason" maxlength="255" />
                    <p v-if="fieldError('reason')" class="text-sm text-destructive">{{ fieldError('reason') }}</p>
                </div>

                <div class="space-y-1.5">
                    <Label for="appointment-edit-notes">Notes (optional)</Label>
                    <Textarea id="appointment-edit-notes" v-model="notes" rows="3" maxlength="2000" />
                    <p v-if="fieldError('notes')" class="text-sm text-destructive">{{ fieldError('notes') }}</p>
                </div>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ edit.isPending.value ? 'Saving…' : 'Save changes' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
