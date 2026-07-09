<script setup lang="ts">
import { refDebounced } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { useOfflinePatientQueue } from '@/composables/patientsIndex/useOfflinePatientQueue';
import { usePatientCountryProfile } from '@/composables/patientsIndex/usePatientCountryProfile';
import { usePatientDuplicateCheck } from '@/composables/patientsIndex/usePatientDuplicateCheck';
import { loadPatientIntoEditForm, usePatientEdit, usePatientEditForm } from '@/composables/patientsIndex/usePatientEdit';
import { type PatientListItem } from '@/composables/patientsIndex/usePatientList';
import { isApiClientError } from '@/lib/apiClient';
import { isLikelyPatientOfflineFailure } from '@/lib/offlinePatientRegistration';
import { deriveAgeFromDateOfBirth, deriveDateOfBirthFromAge, formatAgeLabel } from '@/lib/patientAge';
import { notifySuccess } from '@/lib/notify';

/**
 * Phase 4 of reports/patients-index-modernization-plan.md — row-level
 * "Edit" action for IndexV2.vue's table. Brought to full UX parity with
 * PatientRegistrationSheet.vue (an explicit correction — an initial pass
 * shipped a visibly thinner interaction model, which is exactly the kind
 * of inconsistency this rebuild has repeatedly had to fix elsewhere):
 * same region/district SearchableSelectField + quick-pick chips, same DOB
 * dual-mode entry, same live server-backed duplicate check with the same
 * acknowledgment gate (scoped via excludePatientId so the patient being
 * edited never flags itself), and the same offline-queue resilience —
 * via useOfflinePatientQueue.ts's saveOfflineUpdate(), the update-side
 * counterpart to the registration sheet's saveOfflineRegistration()
 * (@/lib/offlinePatientRegistration.ts already had both outboxes; only
 * the registration sheet had a frontend caller until now).
 *
 * The one deliberate difference: dobMode defaults to 'exact' here, not
 * 'estimated' — an existing patient record normally already has a real
 * date of birth on file, unlike a fresh registration where it's often
 * unknown. Both modes remain fully available either way.
 */
const props = withDefaults(defineProps<{ patient: PatientListItem | null; suggestedRegions?: string[] }>(), {
    suggestedRegions: () => [],
});

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    updated: [patient: PatientListItem];
}>();

const form = usePatientEditForm();
const edit = usePatientEdit();
const { isOnline, saveOfflineUpdate } = useOfflinePatientQueue();

const dobMode = ref<'estimated' | 'exact'>('exact');
const todayIsoDate = new Date().toISOString().slice(0, 10);

function resetDobModeFromForm(): void {
    dobMode.value = 'exact';
}

watch(
    () => props.patient,
    (patient) => {
        if (patient) {
            loadPatientIntoEditForm(form, patient);
            resetDobModeFromForm();
        }
    },
    { immediate: true },
);

watch(open, (isOpen) => {
    if (isOpen && props.patient) {
        loadPatientIntoEditForm(form, props.patient);
        resetDobModeFromForm();
    }
});

const derivedAge = computed(() => {
    if (dobMode.value === 'estimated') {
        const ageYears = String(form.ageYears ?? '').trim();
        const ageMonths = String(form.ageMonths ?? '').trim();
        if (ageYears === '' && ageMonths === '') return null;
        return { years: Number.parseInt(ageYears, 10) || 0, months: Number.parseInt(ageMonths, 10) || 0 };
    }
    return deriveAgeFromDateOfBirth(form.dateOfBirth);
});

watch([() => form.ageYears, () => form.ageMonths], () => {
    if (dobMode.value !== 'estimated') return;
    form.dateOfBirth = deriveDateOfBirthFromAge(form.ageYears, form.ageMonths) ?? '';
});

function setDobMode(mode: string | number): void {
    const next = mode === 'estimated' ? 'estimated' : 'exact';
    if (dobMode.value === next) return;
    dobMode.value = next;

    if (next === 'exact') {
        form.ageYears = '';
        form.ageMonths = '';
        return;
    }

    const age = deriveAgeFromDateOfBirth(form.dateOfBirth);
    form.dateOfBirth = '';
    if (age) {
        form.ageYears = String(age.years);
        form.ageMonths = String(age.months);
    }
}

const identitySource = computed(() => ({
    firstName: form.firstName,
    lastName: form.lastName,
    gender: form.gender,
    dateOfBirth: form.dateOfBirth,
    phone: form.phone,
    nationalId: form.nationalId,
    addressLine: form.addressLine,
    excludePatientId: form.id,
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
    hard_block: 'Blocks save',
    strong_warning: 'Strong possible match',
    possible_warning: 'Possible match',
};

const warningAcknowledged = ref(false);
const duplicateWarningSignature = computed(() => {
    const data = duplicateCheck.data.value;
    if (!data) return '';
    return `${data.severity}:${data.duplicates.map((match) => match.id).join(',')}`;
});
watch(duplicateWarningSignature, () => {
    warningAcknowledged.value = false;
});

const requiresWarningAcknowledgment = computed(
    () =>
        duplicateCheck.data.value?.severity === 'strong_warning' ||
        duplicateCheck.data.value?.severity === 'possible_warning',
);

const canSubmit = computed(
    () =>
        form.firstName.trim() !== '' &&
        form.lastName.trim() !== '' &&
        form.dateOfBirth !== '' &&
        form.phone.trim() !== '' &&
        (!isOnline.value || duplicateCheck.data.value?.severity !== 'hard_block') &&
        (!isOnline.value || !requiresWarningAcknowledgment.value || warningAcknowledged.value) &&
        !edit.isPending.value,
);

const offlineSaveError = ref<string | null>(null);

function submitErrorMessage(): string | null {
    if (offlineSaveError.value) return offlineSaveError.value;
    const error = edit.error.value;
    if (!error) return null;
    if (isApiClientError(error) && error.status === 409) {
        return 'Another active patient already uses this National ID or patient number.';
    }
    return error.message;
}

async function submitOffline(): Promise<void> {
    if (!props.patient) return;
    try {
        await saveOfflineUpdate(
            { id: form.id, patientNumber: props.patient.patientNumber, patientName: `${form.firstName} ${form.lastName}`.trim() },
            {
                firstName: form.firstName.trim(),
                middleName: form.middleName.trim() || null,
                lastName: form.lastName.trim(),
                gender: form.gender,
                dateOfBirth: form.dateOfBirth,
                phone: form.phone.trim(),
                email: form.email.trim() || null,
                nationalId: form.nationalId.trim() || null,
                countryCode: form.countryCode,
                region: form.region.trim(),
                district: form.district.trim(),
                addressLine: form.addressLine.trim(),
                nextOfKinName: form.nextOfKinName.trim() || null,
                nextOfKinPhone: form.nextOfKinPhone.trim() || null,
            },
        );
        notifySuccess('Changes saved offline. They will upload automatically once you’re back online.');
        open.value = false;
    } catch (error) {
        offlineSaveError.value = error instanceof Error ? error.message : 'Unable to save these changes offline.';
    }
}

async function submit(): Promise<void> {
    offlineSaveError.value = null;

    if (!isOnline.value) {
        await submitOffline();
        return;
    }

    try {
        const result = await edit.mutateAsync(form);
        emit('updated', result.patient);
        open.value = false;
    } catch (error) {
        if (isLikelyPatientOfflineFailure(error)) {
            await submitOffline();
            return;
        }
        // Non-network failure: edit.error.value already holds it for submitErrorMessage().
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>Edit patient</SheetTitle>
                <SheetDescription>
                    {{
                        isOnline
                            ? `${patient ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() : ''} — duplicate checks run against the server as you type.`
                            : "You're offline — changes will be saved locally and uploaded once you're back online."
                    }}
                </SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <Alert v-if="!isOnline" class="border-amber-500/40 bg-amber-500/10">
                    <AlertTitle>Offline</AlertTitle>
                    <AlertDescription>Duplicate checks are unavailable right now. Saving will queue these changes for upload when your connection returns.</AlertDescription>
                </Alert>

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

                    <div class="col-span-2 space-y-1.5 rounded-lg border bg-muted/20 p-3">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <Label class="text-sm">
                                Date of birth
                                <span v-if="derivedAge" class="ml-1.5 font-normal text-muted-foreground">
                                    (≈ {{ formatAgeLabel(derivedAge) }} old)
                                </span>
                            </Label>
                            <Tabs :model-value="dobMode" @update:model-value="setDobMode">
                                <TabsList class="h-8">
                                    <TabsTrigger value="estimated" class="h-6.5 px-2.5 text-xs">Estimated age</TabsTrigger>
                                    <TabsTrigger value="exact" class="h-6.5 px-2.5 text-xs">Exact date</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <div v-if="dobMode === 'estimated'" class="grid grid-cols-2 gap-3">
                            <div class="space-y-1.5">
                                <Label for="edit-age-years" class="text-xs text-muted-foreground">Years</Label>
                                <Input id="edit-age-years" v-model="form.ageYears" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="e.g. 45" />
                            </div>
                            <div class="space-y-1.5">
                                <Label for="edit-age-months" class="text-xs text-muted-foreground">Months</Label>
                                <Input id="edit-age-months" v-model="form.ageMonths" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="e.g. 6" />
                            </div>
                            <p class="col-span-2 text-xs text-muted-foreground">Enter years, months, or both — months only is fine for infants.</p>
                        </div>
                        <Input v-else id="edit-dob" v-model="form.dateOfBirth" type="date" :max="todayIsoDate" />
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
                    <div v-if="props.suggestedRegions.length > 0" class="col-span-2 flex flex-wrap items-center gap-1.5">
                        <span class="text-xs text-muted-foreground">Common here:</span>
                        <button
                            v-for="region in props.suggestedRegions"
                            :key="region"
                            type="button"
                            class="rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-accent"
                            :class="form.region === region ? 'border-primary bg-primary/5 text-foreground' : 'text-muted-foreground'"
                            @click="form.region = region"
                        >
                            {{ region }}
                        </button>
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

                <div v-if="isOnline && duplicateCheck.data.value && duplicateCheck.data.value.severity !== 'none'" class="space-y-2">
                    <Alert :variant="duplicateCheck.data.value.severity === 'hard_block' ? 'destructive' : 'default'">
                        <AlertTitle class="flex items-center gap-2">
                            {{ severityLabel[duplicateCheck.data.value.severity] }}
                            <Badge variant="outline">{{ duplicateCheck.data.value.duplicates.length }} match(es)</Badge>
                        </AlertTitle>
                        <AlertDescription>
                            <ul class="mt-1 space-y-1">
                                <li v-for="match in duplicateCheck.data.value.duplicates" :key="match.id" class="flex items-center gap-1.5 text-xs">
                                    <span>
                                        {{ [match.firstName, match.lastName].filter(Boolean).join(' ') || 'Unnamed patient' }}
                                        — {{ match.patientNumber ?? 'No MRN' }}
                                        <span v-if="match.matchedFields?.length"> (matched: {{ match.matchedFields.join(', ') }})</span>
                                    </span>
                                    <a
                                        v-if="match.id"
                                        :href="`/patients/${match.id}/chart`"
                                        target="_blank"
                                        rel="noopener"
                                        class="shrink-0 text-primary underline-offset-2 hover:underline"
                                    >
                                        View chart
                                    </a>
                                </li>
                            </ul>
                            <label
                                v-if="requiresWarningAcknowledgment"
                                for="edit-duplicate-acknowledge"
                                class="mt-3 flex items-start gap-2 rounded-md border border-dashed px-2.5 py-2 text-xs"
                            >
                                <Checkbox
                                    id="edit-duplicate-acknowledge"
                                    :checked="warningAcknowledged"
                                    @update:checked="warningAcknowledged = $event === true"
                                />
                                <span>I've reviewed the match(es) above and confirm this is a different patient.</span>
                            </label>
                        </AlertDescription>
                    </Alert>
                </div>

                <Alert v-if="submitErrorMessage()" variant="destructive">
                    <AlertTitle>Unable to save changes</AlertTitle>
                    <AlertDescription>{{ submitErrorMessage() }}</AlertDescription>
                </Alert>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ edit.isPending.value ? 'Saving…' : isOnline ? 'Save changes' : 'Save offline' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
