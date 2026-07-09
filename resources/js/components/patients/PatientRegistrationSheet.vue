<script setup lang="ts">
import { refDebounced } from '@vueuse/core';
import { computed, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { usePatientCountryProfile } from '@/composables/patientsIndex/usePatientCountryProfile';
import { usePatientDuplicateCheck } from '@/composables/patientsIndex/usePatientDuplicateCheck';
import { usePatientRegistration, usePatientRegistrationForm } from '@/composables/patientsIndex/usePatientRegistration';
import { type PatientListItem } from '@/composables/patientsIndex/usePatientList';
import { isApiClientError } from '@/lib/apiClient';

/**
 * Phase 2 of reports/patients-index-modernization-plan.md. A "thin UI
 * layer" per the decided architecture (reports/patients-index-audit.md
 * §1, §8): every duplicate finding shown here comes from
 * usePatientDuplicateCheck (POST /patients/duplicate-check), and the
 * actual submit is the same server call (POST /patients) that owns the
 * final, authoritative decision — this component holds no scoring logic
 * of its own.
 *
 * Deliberately excludes the legacy sheet's draft autosave and offline
 * queueing (audit §1) — documented as a follow-up slice, not dropped
 * silently, in reports/patients-index-modernization-plan.md's Phase 2
 * update note.
 *
 * Region/district reuse the legacy sheet's actual working UX rather than
 * plain text inputs: SearchableSelectField (@/components/forms) — a
 * searchable, cascading combobox that still allows a free-text custom
 * value — fed by GET /platform/country-profile's server-sourced region/
 * district presets (usePatientCountryProfile), the same endpoint and
 * @/lib/patientLocations helpers the legacy page already used. District
 * is disabled until a region is chosen and resets whenever region changes,
 * matching patients/Index.vue's own watcher.
 *
 * SheetContent uses variant="form" (not the unset default), matching both
 * EncounterHistorySheet.vue and the legacy Register Patient sheet it
 * replaces — that variant is what makes the sheet a full-height,
 * overflow-hidden flex column in the first place, which the sticky
 * header/footer below (bg-background/95 + backdrop-blur, same treatment
 * ShowV2.vue/WorkspaceV2.vue/Board.vue/reception/Queue.vue already use)
 * depends on to stay pinned while the form body scrolls independently.
 */
const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    registered: [patient: PatientListItem];
}>();

const form = usePatientRegistrationForm();
const registration = usePatientRegistration();

const identitySource = computed(() => ({
    firstName: form.firstName,
    lastName: form.lastName,
    gender: form.gender,
    dateOfBirth: form.dateOfBirth,
    phone: form.phone,
    nationalId: form.nationalId,
    addressLine: form.addressLine,
}));
const debouncedIdentity = refDebounced(identitySource, 400);
const duplicateCheck = usePatientDuplicateCheck(debouncedIdentity);

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

const severityLabel: Record<string, string> = {
    hard_block: 'Blocks registration',
    strong_warning: 'Strong possible match',
    possible_warning: 'Possible match',
};

const canSubmit = computed(
    () =>
        form.firstName.trim() !== '' &&
        form.lastName.trim() !== '' &&
        form.dateOfBirth !== '' &&
        form.phone.trim() !== '' &&
        form.region.trim() !== '' &&
        form.district.trim() !== '' &&
        form.addressLine.trim() !== '' &&
        duplicateCheck.data.value?.severity !== 'hard_block' &&
        !registration.isPending.value,
);

function submitErrorMessage(): string | null {
    const error = registration.error.value;
    if (!error) return null;
    if (isApiClientError(error) && error.status === 409) {
        return 'Another active patient already uses this National ID or patient number.';
    }
    return error.message;
}

async function submit(): Promise<void> {
    const result = await registration.mutateAsync(form);
    emit('registered', result.patient);
    open.value = false;
    resetForm();
}

function resetForm(): void {
    form.firstName = '';
    form.middleName = '';
    form.lastName = '';
    form.gender = 'female';
    form.dateOfBirth = '';
    form.phone = '';
    form.email = '';
    form.nationalId = '';
    form.region = '';
    form.district = '';
    form.addressLine = '';
    form.nextOfKinName = '';
    form.nextOfKinPhone = '';
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl">
            <SheetHeader
                class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80"
            >
                <SheetTitle>Register Patient</SheetTitle>
                <SheetDescription>Duplicate checks run against the server as you type.</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                        <Label for="reg-first-name">First name</Label>
                        <Input id="reg-first-name" v-model="form.firstName" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="reg-last-name">Last name</Label>
                        <Input id="reg-last-name" v-model="form.lastName" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="reg-middle-name">Middle name</Label>
                        <Input id="reg-middle-name" v-model="form.middleName" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="reg-gender">Gender</Label>
                        <select
                            id="reg-gender"
                            v-model="form.gender"
                            class="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none"
                        >
                            <option value="female">Female</option>
                            <option value="male">Male</option>
                            <option value="other">Other</option>
                            <option value="unknown">Unknown</option>
                        </select>
                    </div>
                    <div class="space-y-1.5">
                        <Label for="reg-dob">Date of birth</Label>
                        <Input id="reg-dob" v-model="form.dateOfBirth" type="date" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="reg-phone">Phone</Label>
                        <Input id="reg-phone" v-model="form.phone" placeholder="+255…" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="reg-email">Email (optional)</Label>
                        <Input id="reg-email" v-model="form.email" type="email" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="reg-national-id">National ID (optional)</Label>
                        <Input id="reg-national-id" v-model="form.nationalId" />
                    </div>
                    <SearchableSelectField
                        input-id="reg-region"
                        v-model="form.region"
                        :label="countryProfile.regionLabel"
                        :options="regionOptions"
                        :placeholder="countryProfile.regionPlaceholder"
                        :search-placeholder="`Search ${countryProfile.regionLabel.toLowerCase()} or use a custom value`"
                        :empty-text="`No ${countryProfile.regionLabel.toLowerCase()} suggestion found.`"
                        :required="true"
                        :allow-custom-value="true"
                    />
                    <SearchableSelectField
                        input-id="reg-district"
                        v-model="form.district"
                        :label="countryProfile.districtLabel"
                        :options="districtOptions"
                        :placeholder="districtPlaceholder"
                        :search-placeholder="`Search ${countryProfile.districtLabel.toLowerCase()} or use a custom value`"
                        :empty-text="`No ${countryProfile.districtLabel.toLowerCase()} suggestion found.`"
                        :required="true"
                        :allow-custom-value="true"
                        :disabled="!form.region.trim()"
                    />
                    <div class="col-span-2 space-y-1.5">
                        <Label for="reg-address">{{ countryProfile.addressLabel }}</Label>
                        <Textarea id="reg-address" v-model="form.addressLine" rows="2" :placeholder="countryProfile.addressPlaceholder" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="reg-nok-name">Next of kin (optional)</Label>
                        <Input id="reg-nok-name" v-model="form.nextOfKinName" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="reg-nok-phone">Next of kin phone (optional)</Label>
                        <Input id="reg-nok-phone" v-model="form.nextOfKinPhone" />
                    </div>
                </div>

                <div v-if="duplicateCheck.data.value && duplicateCheck.data.value.severity !== 'none'" class="space-y-2">
                    <Alert :variant="duplicateCheck.data.value.severity === 'hard_block' ? 'destructive' : 'default'">
                        <AlertTitle class="flex items-center gap-2">
                            {{ severityLabel[duplicateCheck.data.value.severity] }}
                            <Badge variant="outline">{{ duplicateCheck.data.value.duplicates.length }} match(es)</Badge>
                        </AlertTitle>
                        <AlertDescription>
                            <ul class="mt-1 space-y-1">
                                <li v-for="match in duplicateCheck.data.value.duplicates" :key="match.id" class="text-xs">
                                    {{ [match.firstName, match.lastName].filter(Boolean).join(' ') || 'Unnamed patient' }}
                                    — {{ match.patientNumber ?? 'No MRN' }}
                                    <span v-if="match.matchedFields?.length"> (matched: {{ match.matchedFields.join(', ') }})</span>
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>
                </div>

                <Alert v-if="submitErrorMessage()" variant="destructive">
                    <AlertTitle>Unable to register patient</AlertTitle>
                    <AlertDescription>{{ submitErrorMessage() }}</AlertDescription>
                </Alert>
            </div>

            <SheetFooter
                class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            >
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ registration.isPending.value ? 'Registering…' : 'Register Patient' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
