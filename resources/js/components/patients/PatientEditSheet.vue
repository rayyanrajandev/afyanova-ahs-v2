<script setup lang="ts">
import { computed, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { usePatientCountryProfile } from '@/composables/patientsIndex/usePatientCountryProfile';
import { loadPatientIntoEditForm, usePatientEdit, usePatientEditForm } from '@/composables/patientsIndex/usePatientEdit';
import { type PatientListItem } from '@/composables/patientsIndex/usePatientList';
import { isApiClientError } from '@/lib/apiClient';

/**
 * Phase 4 of reports/patients-index-modernization-plan.md — row-level
 * "Edit" action for IndexV2.vue's table. Reuses the same region/district
 * SearchableSelectField infrastructure PatientRegistrationSheet.vue
 * established (usePatientCountryProfile), but deliberately simpler
 * otherwise: no duplicate-check UI (the server still enforces it via
 * PATCH /patients/{id}'s 409 on a real collision — this sheet surfaces
 * that as a submit error rather than live-checking as you type, since an
 * edit's identity fields change far less often than a fresh
 * registration's), and DOB is a single exact-date field, not the
 * estimated-age/exact-date toggle — by the time a patient is being
 * edited, an exact DOB is normally already on file.
 */
const props = defineProps<{
    patient: PatientListItem | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    updated: [patient: PatientListItem];
}>();

const form = usePatientEditForm();
const edit = usePatientEdit();

watch(
    () => props.patient,
    (patient) => {
        if (patient) loadPatientIntoEditForm(form, patient);
    },
    { immediate: true },
);

watch(open, (isOpen) => {
    if (isOpen && props.patient) loadPatientIntoEditForm(form, props.patient);
});

const countryCode = computed(() => form.countryCode);
const { profile: countryProfile, regionOptions, districtOptionsForRegion } = usePatientCountryProfile(countryCode);
const districtOptions = computed(() => districtOptionsForRegion(form.region));
const districtPlaceholder = computed(() =>
    form.region.trim() ? countryProfile.value.districtPlaceholder : `Select ${countryProfile.value.regionLabel.toLowerCase()} first`,
);

watch(
    () => form.region,
    (value, previousValue) => {
        if (value === previousValue || !previousValue) return;
        form.district = '';
    },
);

const canSubmit = computed(
    () =>
        form.firstName.trim() !== '' &&
        form.lastName.trim() !== '' &&
        form.dateOfBirth !== '' &&
        form.phone.trim() !== '' &&
        !edit.isPending.value,
);

function submitErrorMessage(): string | null {
    const error = edit.error.value;
    if (!error) return null;
    if (isApiClientError(error) && error.status === 409) {
        return 'Another active patient already uses this National ID or patient number.';
    }
    return error.message;
}

async function submit(): Promise<void> {
    const result = await edit.mutateAsync(form);
    emit('updated', result.patient);
    open.value = false;
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>Edit patient</SheetTitle>
                <SheetDescription>{{ patient ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() : '' }}</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                        <Label for="edit-first-name">First name</Label>
                        <Input id="edit-first-name" v-model="form.firstName" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="edit-last-name">Last name</Label>
                        <Input id="edit-last-name" v-model="form.lastName" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="edit-middle-name">Middle name (optional)</Label>
                        <Input id="edit-middle-name" v-model="form.middleName" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="edit-gender">Gender</Label>
                        <Select v-model="form.gender">
                            <SelectTrigger id="edit-gender" class="h-9 w-full bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                                <SelectItem value="unknown">Unknown</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="space-y-1.5">
                        <Label for="edit-dob">Date of birth</Label>
                        <Input id="edit-dob" v-model="form.dateOfBirth" type="date" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="edit-phone">Phone</Label>
                        <Input id="edit-phone" v-model="form.phone" placeholder="+255…" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="edit-email">Email (optional)</Label>
                        <Input id="edit-email" v-model="form.email" type="email" />
                    </div>
                    <div class="col-span-2 space-y-1.5">
                        <Label for="edit-national-id">National ID (optional)</Label>
                        <Input id="edit-national-id" v-model="form.nationalId" />
                    </div>
                    <SearchableSelectField
                        input-id="edit-region"
                        v-model="form.region"
                        :label="countryProfile.regionLabel"
                        :options="regionOptions"
                        :placeholder="countryProfile.regionPlaceholder"
                        :search-placeholder="`Search ${countryProfile.regionLabel.toLowerCase()} or use a custom value`"
                        :empty-text="`No ${countryProfile.regionLabel.toLowerCase()} suggestion found.`"
                        :allow-custom-value="true"
                    />
                    <SearchableSelectField
                        input-id="edit-district"
                        v-model="form.district"
                        :label="countryProfile.districtLabel"
                        :options="districtOptions"
                        :placeholder="districtPlaceholder"
                        :search-placeholder="`Search ${countryProfile.districtLabel.toLowerCase()} or use a custom value`"
                        :empty-text="`No ${countryProfile.districtLabel.toLowerCase()} suggestion found.`"
                        :allow-custom-value="true"
                        :disabled="!form.region.trim()"
                    />
                    <div class="col-span-2 space-y-1.5">
                        <Label for="edit-address">{{ countryProfile.addressLabel }}</Label>
                        <Textarea id="edit-address" v-model="form.addressLine" rows="2" :placeholder="countryProfile.addressPlaceholder" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="edit-nok-name">Next of kin (optional)</Label>
                        <Input id="edit-nok-name" v-model="form.nextOfKinName" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="edit-nok-phone">Next of kin phone (optional)</Label>
                        <Input id="edit-nok-phone" v-model="form.nextOfKinPhone" />
                    </div>
                </div>

                <Alert v-if="submitErrorMessage()" variant="destructive">
                    <AlertTitle>Unable to save changes</AlertTitle>
                    <AlertDescription>{{ submitErrorMessage() }}</AlertDescription>
                </Alert>
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
