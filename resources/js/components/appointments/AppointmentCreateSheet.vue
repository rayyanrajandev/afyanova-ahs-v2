<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { useAppointmentCreate } from '@/composables/appointmentsIndex/useAppointmentCreate';
import { useAppointmentDepartmentOptions } from '@/composables/appointmentsIndex/useAppointmentDepartmentOptions';
import { type AppointmentListItem } from '@/composables/appointmentsIndex/useAppointmentList';
import { useClinicianDirectory } from '@/composables/triage/useClinicianDirectory';
import { formatTimeSlotLabel, generateTimeSlotOptions, nextTimeSlotFrom, toIsoDateString } from '@/lib/appointmentTimeSlots';
import { messageFromUnknown } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';

/**
 * Phase 1 of reports/appointments-scheduling-workspace-modernization-plan.md.
 * Deliberately scoped to StoreAppointmentRequest's two required fields
 * (patientId, scheduledAt) plus department/duration/reason/notes — see
 * useAppointmentCreate.ts's docblock for which optional backend fields this
 * form doesn't expose yet (a scoping choice, not a contract limitation).
 *
 * Clinician field added for the patient flow redesign's appointment
 * workflow A2 — reuses useClinicianDirectory() (same roster query as
 * triage/Queue.vue, clinician/Queue.vue, emergency/Queue.vue, and
 * appointments/IndexV2.vue's display-only lookup), not a new fetch.
 * Requests `physicianOnly: true` (unlike those other consumers) so lab/
 * pharmacy/radiology/theatre staff — legitimately part of the broader
 * clinical directory those pages need — don't show up as choices for who
 * holds a scheduled consultation. Further filtered client-side to the
 * selected department once one is chosen; if the department picked here
 * has no matching physician, `clinicianOptions` degrades to empty (not to
 * "show everyone") and SearchableSelectField's own empty-text covers it. A
 * previously-selected clinician who falls outside a newly-changed
 * department is cleared, not silently kept.
 *
 * `initialPatientId` (patient flow redesign, Reception Queue's "Schedule
 * appointment…" action) lets a caller that has already resolved a patient
 * skip re-searching for them here — PatientLookupField.vue already
 * auto-hydrates from a non-empty `modelValue` on mount, so seeding
 * patientId from this prop (instead of always resetting to '') is enough;
 * no change to PatientLookupField itself was needed. IndexV2.vue's own
 * "Schedule appointment" button doesn't pass this — the patient isn't
 * known yet there, unlike Reception Queue where one is already selected.
 *
 * Scheduled date/time is two separate fields (a native date input plus a
 * fixed-interval time-slot Select, @/lib/appointmentTimeSlots) instead of
 * one native `datetime-local` input — that control buries time entry in a
 * browser-native spinner with no visible list of options, which read as
 * "time selection is missing" even though a value was technically there.
 *
 * `@open-auto-focus` is prevented on SheetContent: reka-ui auto-focuses the
 * first focusable descendant as soon as a Sheet/Dialog opens (standard
 * Radix behavior), which here is PatientLookupField's search input — that
 * focus alone was enough to trip its own open-on-focus dropdown, so the
 * sheet appeared to pop open a patient search result list before the user
 * touched anything. A prior fix inside PatientLookupField.vue itself
 * (a one-frame "ready" guard) wasn't reliable — reka-ui's actual auto-focus
 * timing isn't guaranteed to happen within a single frame, especially with
 * this Sheet's animated open transition, so the guard could already be
 * armed by the time focus actually landed. Preventing openAutoFocus is the
 * documented Radix/reka-ui pattern for exactly this case: the dialog's
 * focus trap (Tab-cycling, Escape-to-close) still works, only the
 * automatic "focus the first field" step is skipped.
 */
const props = defineProps<{
    initialPatientId?: string;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    created: [appointment: AppointmentListItem];
}>();

const patientId = ref('');
const scheduledDate = ref('');
const scheduledTime = ref('');
const clinicianUserId = ref('');
const department = ref('');
const durationMinutes = ref('30');
const reason = ref('');
const notes = ref('');
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const timeSlotOptions = generateTimeSlotOptions();
const scheduledAt = computed(() => (scheduledDate.value && scheduledTime.value ? `${scheduledDate.value}T${scheduledTime.value}` : ''));

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

const create = useAppointmentCreate();

watch(open, (isOpen) => {
    if (!isOpen) return;
    patientId.value = props.initialPatientId ?? '';
    const defaultDateTime = new Date();
    defaultDateTime.setHours(defaultDateTime.getHours() + 1);
    scheduledDate.value = toIsoDateString(defaultDateTime);
    scheduledTime.value = nextTimeSlotFrom(defaultDateTime);
    clinicianUserId.value = '';
    department.value = '';
    durationMinutes.value = '30';
    reason.value = '';
    notes.value = '';
    submitError.value = null;
    fieldErrors.value = {};
});

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

const canSubmit = computed(() => patientId.value.trim() !== '' && scheduledAt.value.trim() !== '' && !create.isPending.value);

async function submit(): Promise<void> {
    submitError.value = null;
    fieldErrors.value = {};

    try {
        const appointment = await create.mutateAsync({
            patientId: patientId.value,
            scheduledAt: scheduledAt.value,
            clinicianUserId: clinicianUserId.value ? Number(clinicianUserId.value) : null,
            department: department.value || null,
            durationMinutes: durationMinutes.value ? Number(durationMinutes.value) : null,
            reason: reason.value.trim() || null,
            notes: notes.value.trim() || null,
        });
        emit('created', appointment);
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { errors?: Record<string, string[]>; message?: string } };
        fieldErrors.value = apiError.payload?.errors ?? {};
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to schedule this appointment.');
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
                <SheetTitle>Schedule appointment</SheetTitle>
                <SheetDescription>Book a future visit for an existing patient.</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to schedule this appointment</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>

                <PatientLookupField
                    v-model="patientId"
                    input-id="appointment-create-patient"
                    label="Patient"
                    required
                    :error-message="fieldError('patientId')"
                />

                <div class="grid grid-cols-3 gap-3">
                    <div class="space-y-1.5">
                        <Label for="appointment-create-date">Date</Label>
                        <Input id="appointment-create-date" v-model="scheduledDate" type="date" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="appointment-create-time">Time</Label>
                        <Select v-model="scheduledTime">
                            <SelectTrigger id="appointment-create-time" class="w-full">
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
                        <Label for="appointment-create-duration">Duration, minutes (optional)</Label>
                        <Input id="appointment-create-duration" v-model="durationMinutes" type="number" min="5" max="480" step="5" />
                        <p v-if="fieldError('durationMinutes')" class="text-sm text-destructive">{{ fieldError('durationMinutes') }}</p>
                    </div>
                </div>
                <p v-if="fieldError('scheduledAt')" class="text-sm text-destructive">{{ fieldError('scheduledAt') }}</p>

                <SearchableSelectField
                    v-model="department"
                    input-id="appointment-create-department"
                    label="Department (optional)"
                    :options="departmentOptions.data.value ?? []"
                    placeholder="Select a department"
                    allow-custom-value
                    :error-message="fieldError('department')"
                />

                <SearchableSelectField
                    v-model="clinicianUserId"
                    input-id="appointment-create-clinician"
                    label="Clinician (optional)"
                    :options="clinicianOptions"
                    placeholder="Select a clinician"
                    empty-text="No matching clinician found."
                    :error-message="fieldError('clinicianUserId')"
                />

                <div class="space-y-1.5">
                    <Label for="appointment-create-reason">Reason (optional)</Label>
                    <Input id="appointment-create-reason" v-model="reason" maxlength="255" />
                    <p v-if="fieldError('reason')" class="text-sm text-destructive">{{ fieldError('reason') }}</p>
                </div>

                <div class="space-y-1.5">
                    <Label for="appointment-create-notes">Notes (optional)</Label>
                    <Textarea id="appointment-create-notes" v-model="notes" rows="3" maxlength="2000" />
                    <p v-if="fieldError('notes')" class="text-sm text-destructive">{{ fieldError('notes') }}</p>
                </div>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ create.isPending.value ? 'Scheduling…' : 'Schedule appointment' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
