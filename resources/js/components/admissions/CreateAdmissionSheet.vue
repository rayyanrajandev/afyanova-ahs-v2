<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import WardBedPicker from '@/components/admissions/WardBedPicker.vue';
import { useBillingPayerContractOptions } from '@/composables/admissions/useBillingPayerContractOptions';
import { useCreateAdmission } from '@/composables/admissions/useCreateAdmission';
import { type Admission } from '@/composables/admissions/useAdmissions';
import { useClinicianDirectory } from '@/composables/triage/useClinicianDirectory';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { messageFromUnknown } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';

/**
 * Admission V2, Phase 3 of the bed-assignment plan. Ward/bed selection is
 * WardBedPicker.vue (P3 of the Reception/Emergency/Admission/Bed-Management
 * audit follow-through consolidated the three near-identical copies of this
 * wiring into one component) — the legacy free-text ward/bed pair still
 * works server-side (StoreAdmissionRequest accepts either) but isn't
 * offered here, matching this session's "V2 ships the real thing" pattern.
 * Clinician picker reuses useClinicianDirectory({ physicianOnly: true }) —
 * same composable AppointmentCreateSheet.vue already established.
 *
 * Billing payer contract picking (AdmD of the Admission V2 full-parity
 * plan): if left unselected, coverage still inherits from the linked
 * appointment only (existing backend behavior,
 * CreateAdmissionUseCase::inheritFinancialCoverage()) — this field is an
 * explicit override, gated behind billing.payer-contracts.read matching
 * the legacy page's own permission check.
 *
 * `@open-auto-focus` prevented on SheetContent — same reka-ui
 * auto-focus-trips-PatientLookupField's-dropdown fix as
 * AppointmentCreateSheet.vue/EmergencyCaseCreateSheet.vue.
 */
const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    created: [admission: Admission];
}>();

const patientId = ref('');
const clinicianUserId = ref('');
const bedResourceId = ref('');
const billingPayerContractId = ref('');
const admittedAtDate = ref('');
const admissionReason = ref('');
const notes = ref('');
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const clinicianDirectory = useClinicianDirectory({ physicianOnly: true });
const clinicianOptions = computed<SearchableSelectOption[]>(() =>
    (clinicianDirectory.data.value ?? [])
        .filter((entry) => entry.userId !== null)
        .map((entry) => ({
            value: String(entry.userId),
            label: entry.userName ?? `Clinician #${entry.userId}`,
            description: entry.department,
        })),
);

const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();
const canReadBillingPayerContracts = computed(() => isFacilitySuperAdmin.value || hasPermission('billing.payer-contracts.read'));
const { options: billingPayerContractOptions } = useBillingPayerContractOptions();

const create = useCreateAdmission();

watch(open, (isOpen) => {
    if (!isOpen) return;
    patientId.value = '';
    clinicianUserId.value = '';
    bedResourceId.value = '';
    billingPayerContractId.value = '';
    const now = new Date();
    const pad = (segment: number) => String(segment).padStart(2, '0');
    admittedAtDate.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    admissionReason.value = '';
    notes.value = '';
    submitError.value = null;
    fieldErrors.value = {};
});

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

const canSubmit = computed(() => patientId.value.trim() !== '' && admittedAtDate.value.trim() !== '' && !create.isPending.value);

async function submit(): Promise<void> {
    submitError.value = null;
    fieldErrors.value = {};

    try {
        const admission = await create.mutateAsync({
            patientId: patientId.value,
            attendingClinicianUserId: clinicianUserId.value ? Number(clinicianUserId.value) : null,
            bedResourceId: bedResourceId.value || null,
            billingPayerContractId: billingPayerContractId.value || null,
            admittedAt: admittedAtDate.value,
            admissionReason: admissionReason.value.trim() || null,
            notes: notes.value.trim() || null,
        });
        emit('created', admission);
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { errors?: Record<string, string[]>; message?: string } };
        fieldErrors.value = apiError.payload?.errors ?? {};
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to create this admission.');
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
                <SheetTitle>Admit patient</SheetTitle>
                <SheetDescription>Create an admission and assign a bed.</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to create this admission</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>

                <PatientLookupField
                    v-model="patientId"
                    input-id="admission-create-patient"
                    label="Patient"
                    required
                    :error-message="fieldError('patientId')"
                />

                <div class="space-y-1.5">
                    <Label for="admission-create-admitted-at">Admitted at</Label>
                    <Input id="admission-create-admitted-at" v-model="admittedAtDate" type="datetime-local" />
                    <p v-if="fieldError('admittedAt')" class="text-sm text-destructive">{{ fieldError('admittedAt') }}</p>
                </div>

                <SearchableSelectField
                    v-model="clinicianUserId"
                    input-id="admission-create-clinician"
                    label="Attending clinician (optional)"
                    :options="clinicianOptions"
                    placeholder="Select a clinician"
                    empty-text="No matching clinician found."
                    :error-message="fieldError('attendingClinicianUserId')"
                />

                <WardBedPicker
                    v-model="bedResourceId"
                    id-prefix="admission-create"
                    ward-label="Ward (optional)"
                    bed-label="Bed (optional)"
                />
                <p v-if="fieldError('bedResourceId')" class="text-sm text-destructive">{{ fieldError('bedResourceId') }}</p>

                <SearchableSelectField
                    v-if="canReadBillingPayerContracts"
                    v-model="billingPayerContractId"
                    input-id="admission-create-payer-contract"
                    label="Billing payer contract (optional)"
                    :options="billingPayerContractOptions"
                    placeholder="Select a payer contract"
                    empty-text="No matching payer contract found."
                    :error-message="fieldError('billingPayerContractId')"
                />
                <Alert v-else>
                    <AlertTitle>Payer contract selection unavailable</AlertTitle>
                    <AlertDescription>Coverage will inherit from the linked appointment, if any. Requires <code>billing.payer-contracts.read</code> to select one directly.</AlertDescription>
                </Alert>

                <div class="space-y-1.5">
                    <Label for="admission-create-reason">Admission reason (optional)</Label>
                    <Input id="admission-create-reason" v-model="admissionReason" maxlength="255" />
                    <p v-if="fieldError('admissionReason')" class="text-sm text-destructive">{{ fieldError('admissionReason') }}</p>
                </div>

                <div class="space-y-1.5">
                    <Label for="admission-create-notes">Notes (optional)</Label>
                    <Textarea id="admission-create-notes" v-model="notes" rows="3" maxlength="2000" />
                    <p v-if="fieldError('notes')" class="text-sm text-destructive">{{ fieldError('notes') }}</p>
                </div>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ create.isPending.value ? 'Admitting…' : 'Admit patient' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
