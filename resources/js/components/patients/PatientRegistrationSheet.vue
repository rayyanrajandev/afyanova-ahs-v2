<script setup lang="ts">
import { refDebounced } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { useOfflinePatientQueue } from '@/composables/patientsIndex/useOfflinePatientQueue';
import { usePatientCountryProfile } from '@/composables/patientsIndex/usePatientCountryProfile';
import { usePatientDuplicateCheck } from '@/composables/patientsIndex/usePatientDuplicateCheck';
import {
    buildPatientRegistrationPayload,
    usePatientRegistration,
    usePatientRegistrationForm,
} from '@/composables/patientsIndex/usePatientRegistration';
import { type PatientListItem } from '@/composables/patientsIndex/usePatientList';
import { isApiClientError } from '@/lib/apiClient';
import { isLikelyPatientOfflineFailure } from '@/lib/offlinePatientRegistration';
import {
    deriveAgeFromDateOfBirth,
    deriveDateOfBirthFromAge,
    formatAgeLabel,
} from '@/lib/patientAge';
import { notifySuccess } from '@/lib/notify';

/**
 * Phase 2 of reports/patients-index-modernization-plan.md. A "thin UI
 * layer" per the decided architecture (reports/patients-index-audit.md
 * §1, §8): every duplicate finding shown here comes from
 * usePatientDuplicateCheck (POST /patients/duplicate-check), and the
 * actual submit is the same server call (POST /patients) that owns the
 * final, authoritative decision — this component holds no scoring logic
 * of its own.
 *
 * Offline resilience (audit §1's "follow-up slice", now closed): when
 * useOfflinePatientQueue's isOnline is false, or the online
 * POST fails with a network-shaped error mid-flight
 * (isLikelyPatientOfflineFailure), the same payload gets queued into
 * @/lib/offlinePatientRegistration's IndexedDB outbox instead of failing —
 * the exact storage the legacy sheet wrote to, so records land in one
 * place regardless of which sheet saved them, and sync the same way. Draft
 * autosave (persisting in-progress, not-yet-submitted form state) is not
 * included — that's a distinct feature from "don't lose a completed
 * submission to a dropped connection," and isn't the gap that made this
 * sheet a functional downgrade.
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
 * suggestedRegions (from IndexV2.vue's own already-loaded patient list, no
 * extra fetch) renders one-tap quick-pick chips above the region field for
 * whatever regions are already common on the current page — cheaper and
 * more honestly-scoped than the legacy sheet's equivalent, which bulk-
 * loaded every patient client-side just to mine the same "recently common"
 * signal.
 *
 * Date of birth has two entry mechanisms (@/lib/patientAge) — many walk-in
 * patients and infant guardians don't know an exact birth date, only an
 * approximate age — switched via the app's shared Tabs primitive rather
 * than a one-off button pair, with a live "≈ N yrs M mos old" preview in
 * both directions. Only dateOfBirth is ever sent to the server
 * (StorePatientRequest has no age fields); years/months are derived
 * client-side scratch state.
 *
 * SheetContent uses variant="form" (not the unset default), matching both
 * EncounterHistorySheet.vue and the legacy Register Patient sheet it
 * replaces — that variant is what makes the sheet a full-height,
 * overflow-hidden flex column in the first place, which the sticky
 * header/footer below (bg-background/95 + backdrop-blur, same treatment
 * ShowV2.vue/WorkspaceV2.vue/Board.vue/reception/Queue.vue already use)
 * depends on to stay pinned while the form body scrolls independently.
 */
const props = withDefaults(defineProps<{ suggestedRegions?: string[] }>(), {
    suggestedRegions: () => [],
});

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    registered: [patient: PatientListItem];
}>();

const form = usePatientRegistrationForm();
const registration = usePatientRegistration();
const { isOnline, saveOfflineRegistration } = useOfflinePatientQueue();

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
const {
    profile: countryProfile,
    regionOptions,
    districtOptionsForRegion,
} = usePatientCountryProfile(countryCode);
const districtOptions = computed(() => districtOptionsForRegion(form.region));
const districtPlaceholder = computed(() =>
    form.region.trim()
        ? countryProfile.value.districtPlaceholder
        : `Select ${countryProfile.value.regionLabel.toLowerCase()} first`,
);

watch(
    () => form.region,
    (value, previousValue) => {
        if (value === previousValue || !previousValue) return;
        form.district = '';
    },
);

/**
 * Two entry mechanisms for date of birth, matching a real registration
 * scenario this form was missing entirely: many walk-in patients (and
 * guardians registering infants) don't know an exact birth date, only an
 * approximate age. "Estimated age" derives dateOfBirth from years/months
 * as you type; "Exact date" is a native date picker. Only dateOfBirth is
 * ever sent to the server (StorePatientRequest has no age fields) — age
 * inputs are pure client-side scratch state.
 */
const dobMode = ref<'estimated' | 'exact'>('estimated');
const todayIsoDate = new Date().toISOString().slice(0, 10);

const derivedAge = computed(() => {
    if (dobMode.value === 'estimated') {
        const ageYears = String(form.ageYears ?? '').trim();
        const ageMonths = String(form.ageMonths ?? '').trim();
        if (ageYears === '' && ageMonths === '') return null;
        return {
            years: Number.parseInt(ageYears, 10) || 0,
            months: Number.parseInt(ageMonths, 10) || 0,
        };
    }
    return deriveAgeFromDateOfBirth(form.dateOfBirth);
});

watch([() => form.ageYears, () => form.ageMonths], () => {
    if (dobMode.value !== 'estimated') return;
    form.dateOfBirth =
        deriveDateOfBirthFromAge(form.ageYears, form.ageMonths) ?? '';
});

function setDobMode(mode: string | number): void {
    const next = mode === 'exact' ? 'exact' : 'estimated';
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

const severityLabel: Record<string, string> = {
    hard_block: 'Blocks registration',
    strong_warning: 'Strong possible match',
    possible_warning: 'Possible match',
};

/**
 * A live warning nobody has to engage with is just noise — the legacy
 * sheet forced an explicit "Continue registration / View existing patient
 * / Review form" choice before a warned submit could proceed at all; this
 * sheet's inline Alert didn't require that, so a possible/strong match
 * could be click-through-ignored. warningAcknowledged closes that gap: an
 * explicit checkbox gates submission, and it resets (via
 * duplicateWarningSignature) whenever the matched duplicate set actually
 * changes, so acknowledging one match never silently carries over to a
 * different one typed a moment later.
 */
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
        form.gender !== '' &&
        form.dateOfBirth !== '' &&
        form.phone.trim() !== '' &&
        form.region.trim() !== '' &&
        form.district.trim() !== '' &&
        form.addressLine.trim() !== '' &&
        // The duplicate check can't have run while offline — its last
        // result may be stale (from before the connection dropped) and
        // must not gate an offline save.
        (!isOnline.value ||
            duplicateCheck.data.value?.severity !== 'hard_block') &&
        (!isOnline.value ||
            !requiresWarningAcknowledgment.value ||
            warningAcknowledged.value) &&
        !registration.isPending.value,
);

const offlineSaveError = ref<string | null>(null);

function submitErrorMessage(): string | null {
    if (offlineSaveError.value) return offlineSaveError.value;
    const error = registration.error.value;
    if (!error) return null;
    if (isApiClientError(error) && error.status === 409) {
        return 'Another active patient already uses this National ID or patient number.';
    }
    return error.message;
}

async function submitOffline(): Promise<void> {
    try {
        const record = await saveOfflineRegistration(
            buildPatientRegistrationPayload(form),
        );
        notifySuccess(
            `Patient saved offline as ${record.temporaryPatientNumber}. It will upload automatically once you're back online.`,
        );
        open.value = false;
        resetForm();
    } catch (error) {
        offlineSaveError.value =
            error instanceof Error
                ? error.message
                : 'Unable to save this patient offline.';
    }
}

async function submit(): Promise<void> {
    offlineSaveError.value = null;

    if (!isOnline.value) {
        await submitOffline();
        return;
    }

    try {
        const result = await registration.mutateAsync(form);
        emit('registered', result.patient);
        open.value = false;
        resetForm();
    } catch (error) {
        if (isLikelyPatientOfflineFailure(error)) {
            await submitOffline();
            return;
        }
        // Non-network failure: registration.error.value already holds it for submitErrorMessage().
    }
}

function resetForm(): void {
    form.firstName = '';
    form.middleName = '';
    form.lastName = '';
    form.gender = '';
    form.dateOfBirth = '';
    form.ageYears = '';
    form.ageMonths = '';
    dobMode.value = 'estimated';
    warningAcknowledged.value = false;
    offlineSaveError.value = null;
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
            <form class="contents" @submit.prevent="submit">
                <SheetHeader
                    class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80"
                >
                    <SheetTitle>Register Patient</SheetTitle>
                    <SheetDescription>
                        {{
                            isOnline
                                ? 'Duplicate checks run against the server as you type.'
                                : "You're offline — this patient will be saved locally and uploaded once you're back online."
                        }}
                    </SheetDescription>
                </SheetHeader>

                <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                    <Alert
                        v-if="!isOnline"
                        class="border-amber-500/40 bg-amber-500/10"
                    >
                        <AlertTitle>Offline</AlertTitle>
                        <AlertDescription
                            >Duplicate checks are unavailable right now.
                            Registering will queue this patient for upload when
                            your connection returns.</AlertDescription
                        >
                    </Alert>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1.5">
                            <Label for="reg-first-name">First name</Label>
                            <Input
                                id="reg-first-name"
                                v-model="form.firstName"
                            />
                        </div>
                        <div class="space-y-1.5">
                            <Label for="reg-last-name">Last name</Label>
                            <Input id="reg-last-name" v-model="form.lastName" />
                        </div>
                        <div class="space-y-1.5">
                            <Label for="reg-middle-name"
                                >Middle name (optional)</Label
                            >
                            <Input
                                id="reg-middle-name"
                                v-model="form.middleName"
                            />
                        </div>
                        <div class="space-y-1.5">
                            <Label for="reg-gender">Gender</Label>
                            <Select v-model="form.gender">
                                <SelectTrigger
                                    id="reg-gender"
                                    class="h-9 w-full bg-background"
                                >
                                    <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="female"
                                        >Female</SelectItem
                                    >
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                    <SelectItem value="unknown"
                                        >Unknown</SelectItem
                                    >
                                </SelectContent>
                            </Select>
                        </div>

                        <div
                            class="col-span-2 space-y-1.5 rounded-lg border bg-muted/20 p-3"
                        >
                            <div
                                class="flex flex-wrap items-center justify-between gap-2"
                            >
                                <Label class="text-sm">
                                    Date of birth
                                    <span
                                        v-if="derivedAge"
                                        class="ml-1.5 font-normal text-muted-foreground"
                                    >
                                        (≈ {{ formatAgeLabel(derivedAge) }} old)
                                    </span>
                                </Label>
                                <Tabs
                                    :model-value="dobMode"
                                    @update:model-value="setDobMode"
                                >
                                    <TabsList class="h-8">
                                        <TabsTrigger
                                            value="estimated"
                                            class="h-6.5 px-2.5 text-xs"
                                            >Estimated age</TabsTrigger
                                        >
                                        <TabsTrigger
                                            value="exact"
                                            class="h-6.5 px-2.5 text-xs"
                                            >Exact date</TabsTrigger
                                        >
                                    </TabsList>
                                </Tabs>
                            </div>

                            <div
                                v-if="dobMode === 'estimated'"
                                class="grid grid-cols-2 gap-3"
                            >
                                <div class="space-y-1.5">
                                    <Label
                                        for="reg-age-years"
                                        class="text-xs text-muted-foreground"
                                        >Years</Label
                                    >
                                    <Input
                                        id="reg-age-years"
                                        v-model="form.ageYears"
                                        type="text"
                                        inputmode="numeric"
                                        pattern="[0-9]*"
                                        placeholder="e.g. 45"
                                    />
                                </div>
                                <div class="space-y-1.5">
                                    <Label
                                        for="reg-age-months"
                                        class="text-xs text-muted-foreground"
                                        >Months</Label
                                    >
                                    <Input
                                        id="reg-age-months"
                                        v-model="form.ageMonths"
                                        type="text"
                                        inputmode="numeric"
                                        pattern="[0-9]*"
                                        placeholder="e.g. 6"
                                    />
                                </div>
                                <p
                                    class="col-span-2 text-xs text-muted-foreground"
                                >
                                    Enter years, months, or both — months only
                                    is fine for infants.
                                </p>
                            </div>
                            <Input
                                v-else
                                id="reg-dob"
                                v-model="form.dateOfBirth"
                                type="date"
                                :max="todayIsoDate"
                            />
                        </div>

                        <div class="space-y-1.5">
                            <Label for="reg-phone">Phone</Label>
                            <Input
                                id="reg-phone"
                                v-model="form.phone"
                                placeholder="+255…"
                            />
                        </div>
                        <div class="space-y-1.5">
                            <Label for="reg-email">Email (optional)</Label>
                            <Input
                                id="reg-email"
                                v-model="form.email"
                                type="email"
                            />
                        </div>
                        <div class="col-span-2 space-y-1.5">
                            <Label for="reg-national-id"
                                >National ID (optional)</Label
                            >
                            <Input
                                id="reg-national-id"
                                v-model="form.nationalId"
                            />
                        </div>
                        <div
                            v-if="props.suggestedRegions.length > 0"
                            class="col-span-2 flex flex-wrap items-center gap-1.5"
                        >
                            <span class="text-xs text-muted-foreground"
                                >Common here:</span
                            >
                            <button
                                v-for="region in props.suggestedRegions"
                                :key="region"
                                type="button"
                                class="rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-accent"
                                :class="
                                    form.region === region
                                        ? 'border-primary bg-primary/5 text-foreground'
                                        : 'text-muted-foreground'
                                "
                                @click="form.region = region"
                            >
                                {{ region }}
                            </button>
                        </div>
                        <SearchableSelectField
                            input-id="reg-region"
                            v-model="form.region"
                            :label="countryProfile.regionLabel"
                            :options="regionOptions"
                            :placeholder="countryProfile.regionPlaceholder"
                            :search-placeholder="`Search ${countryProfile.regionLabel.toLowerCase()} or use a custom value`"
                            :empty-text="`No ${countryProfile.regionLabel.toLowerCase()} suggestion found.`"
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
                            :allow-custom-value="true"
                            :disabled="!form.region.trim()"
                        />
                        <div class="col-span-2 space-y-1.5">
                            <Label for="reg-address">{{
                                countryProfile.addressLabel
                            }}</Label>
                            <Textarea
                                id="reg-address"
                                v-model="form.addressLine"
                                rows="2"
                                :placeholder="countryProfile.addressPlaceholder"
                            />
                        </div>
                        <div class="space-y-1.5">
                            <Label for="reg-nok-name"
                                >Next of kin (optional)</Label
                            >
                            <Input
                                id="reg-nok-name"
                                v-model="form.nextOfKinName"
                            />
                        </div>
                        <div class="space-y-1.5">
                            <Label for="reg-nok-phone"
                                >Next of kin phone (optional)</Label
                            >
                            <Input
                                id="reg-nok-phone"
                                v-model="form.nextOfKinPhone"
                            />
                        </div>
                    </div>

                    <div
                        v-if="
                            isOnline &&
                            duplicateCheck.data.value &&
                            duplicateCheck.data.value.severity !== 'none'
                        "
                        class="space-y-2"
                    >
                        <Alert
                            :variant="
                                duplicateCheck.data.value.severity ===
                                'hard_block'
                                    ? 'destructive'
                                    : 'default'
                            "
                        >
                            <AlertTitle class="flex items-center gap-2">
                                {{
                                    severityLabel[
                                        duplicateCheck.data.value.severity
                                    ]
                                }}
                                <Badge variant="outline"
                                    >{{
                                        duplicateCheck.data.value.duplicates
                                            .length
                                    }}
                                    match(es)</Badge
                                >
                            </AlertTitle>
                            <AlertDescription>
                                <ul class="mt-1 space-y-1">
                                    <li
                                        v-for="match in duplicateCheck.data
                                            .value.duplicates"
                                        :key="match.id"
                                        class="flex items-center gap-1.5 text-xs"
                                    >
                                        <span>
                                            {{
                                                [
                                                    match.firstName,
                                                    match.lastName,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' ') ||
                                                'Unnamed patient'
                                            }}
                                            —
                                            {{
                                                match.patientNumber ?? 'No MRN'
                                            }}
                                            <span
                                                v-if="
                                                    match.matchedFields?.length
                                                "
                                            >
                                                (matched:
                                                {{
                                                    match.matchedFields.join(
                                                        ', ',
                                                    )
                                                }})</span
                                            >
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
                                    for="reg-duplicate-acknowledge"
                                    class="mt-3 flex items-start gap-2 rounded-md border border-dashed px-2.5 py-2 text-xs"
                                >
                                    <Checkbox
                                        id="reg-duplicate-acknowledge"
                                        :checked="warningAcknowledged"
                                        @update:checked="
                                            warningAcknowledged =
                                                $event === true
                                        "
                                    />
                                    <span
                                        >I've reviewed the match(es) above and
                                        confirm this is a different
                                        patient.</span
                                    >
                                </label>
                            </AlertDescription>
                        </Alert>
                    </div>

                    <Alert v-if="submitErrorMessage()" variant="destructive">
                        <AlertTitle>Unable to register patient</AlertTitle>
                        <AlertDescription>{{
                            submitErrorMessage()
                        }}</AlertDescription>
                    </Alert>
                </div>

                <SheetFooter
                    class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80"
                >
                    <Button
                        type="button"
                        variant="outline"
                        @click="open = false"
                        >Cancel</Button
                    >
                    <Button type="submit" :disabled="!canSubmit">
                        {{
                            registration.isPending.value
                                ? 'Registering…'
                                : isOnline
                                  ? 'Register Patient'
                                  : 'Save offline'
                        }}
                    </Button>
                </SheetFooter>
            </form>
        </SheetContent>
    </Sheet>
</template>
