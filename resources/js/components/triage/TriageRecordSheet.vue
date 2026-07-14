<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { useAppointmentDepartmentOptions } from '@/composables/appointmentsIndex/useAppointmentDepartmentOptions';
import { useClinicianDirectory } from '@/composables/triage/useClinicianDirectory';
import { useRecordTriage } from '@/composables/triage/useRecordTriage';
import { type ReceptionQueueEntry } from '@/composables/reception/useReceptionQueue';
import { messageFromUnknown } from '@/lib/notify';

/**
 * Phase 3 of reports/appointments-scheduling-workspace-modernization-plan.md
 * — extracted from appointments/Index.vue's Triage sheet (7985-8199), not
 * rewritten from scratch: same structured-vitals-fields-composed-into-one-
 * summary-string approach (RecordAppointmentTriageUseCase only stores one
 * text blob, triageVitalsSummary — the structure lives only in this form,
 * not the backend), same routing choice between a department pool and a
 * named provider.
 *
 * Lives under components/triage/, mounted from pages/triage/Queue.vue, not
 * reception/Queue.vue — triage recording is nurse/clinical work, not
 * front-desk work. An earlier version of this phase put the trigger on
 * ReceptionQueueList.vue directly and was corrected; see this plan's Phase 3
 * correction note. `ReceptionQueueEntry` is still the right type to accept
 * (Reception's read model is the shared queue data both pages read from),
 * this component just isn't Reception's own UI anymore.
 */
type TriageStructuredFieldKey = 'bloodPressure' | 'pulse' | 'temperature' | 'respiratoryRate' | 'oxygenSaturation' | 'weight' | 'height' | 'glucose';

const STRUCTURED_FIELDS: Array<{ key: TriageStructuredFieldKey; label: string; shortLabel: string; placeholder: string; inputMode: 'text' | 'numeric' | 'decimal' }> = [
    { key: 'bloodPressure', label: 'Blood pressure', shortLabel: 'BP', placeholder: '118/74', inputMode: 'text' },
    { key: 'pulse', label: 'Pulse', shortLabel: 'Pulse', placeholder: '82', inputMode: 'numeric' },
    { key: 'temperature', label: 'Temperature', shortLabel: 'Temp', placeholder: '37.1', inputMode: 'decimal' },
    { key: 'respiratoryRate', label: 'Respiratory rate', shortLabel: 'RR', placeholder: '18', inputMode: 'numeric' },
    { key: 'oxygenSaturation', label: 'SpO2', shortLabel: 'SpO2', placeholder: '98', inputMode: 'numeric' },
    { key: 'weight', label: 'Weight', shortLabel: 'Weight', placeholder: '70', inputMode: 'decimal' },
    { key: 'height', label: 'Height', shortLabel: 'Height', placeholder: '170', inputMode: 'decimal' },
    { key: 'glucose', label: 'Blood sugar', shortLabel: 'Glucose', placeholder: '110 mg/dL', inputMode: 'text' },
];

function normalizeText(value: string | null | undefined): string {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function formatStructuredValue(key: TriageStructuredFieldKey, rawValue: string): string {
    const value = normalizeText(rawValue);
    if (!value) return '';
    const numeric = /^\d+(?:\.\d+)?$/.test(value);
    switch (key) {
        case 'pulse':
            return numeric ? `${value} bpm` : value;
        case 'temperature':
            return numeric ? `${value} C` : value;
        case 'respiratoryRate':
            return numeric ? `${value}/min` : value;
        case 'oxygenSaturation':
            return numeric ? `${value}%` : value;
        case 'weight':
            return /\bkg\b/i.test(value) ? value : `${value} kg`;
        case 'height':
            return /\bcm\b/i.test(value) ? value : `${value} cm`;
        default:
            return value;
    }
}

const props = defineProps<{
    entry: ReceptionQueueEntry | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    recorded: [];
}>();

const form = reactive({
    routingMode: 'department_pool' as 'department_pool' | 'specific_provider',
    department: '',
    clinicianUserId: '',
    triageNotes: '',
    triageCategory: '' as '' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5',
    bloodPressure: '',
    pulse: '',
    temperature: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    height: '',
    glucose: '',
    additionalSummary: '',
});
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const departmentOptions = useAppointmentDepartmentOptions();
const clinicianDirectory = useClinicianDirectory();
const triage = useRecordTriage();

watch(open, (isOpen) => {
    if (!isOpen) return;
    form.routingMode = 'department_pool';
    form.department = props.entry?.department ?? '';
    form.clinicianUserId = '';
    form.triageNotes = '';
    form.triageCategory = '';
    form.bloodPressure = '';
    form.pulse = '';
    form.temperature = '';
    form.respiratoryRate = '';
    form.oxygenSaturation = '';
    form.weight = '';
    form.height = '';
    form.glucose = '';
    form.additionalSummary = '';
    submitError.value = null;
    fieldErrors.value = {};
});

const vitalBadges = computed(() =>
    STRUCTURED_FIELDS
        .map((field) => {
            const value = formatStructuredValue(field.key, form[field.key]);
            return value ? `${field.shortLabel} ${value}` : null;
        })
        .filter((text): text is string => text !== null),
);

const composedSummary = computed(() => {
    const parts = [...vitalBadges.value];
    const additional = normalizeText(form.additionalSummary);
    if (additional) parts.push(additional);
    return parts.join(', ');
});

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

const canSubmit = computed(() => !triage.isPending.value);

async function submit(): Promise<void> {
    if (!props.entry) return;
    submitError.value = null;
    fieldErrors.value = {};

    if (!composedSummary.value) {
        fieldErrors.value = { triageVitalsSummary: ['Record at least a brief vitals or intake summary before sending the patient to the provider queue.'] };
        return;
    }

    const department = normalizeText(form.department);
    const clinicianUserId = form.routingMode === 'specific_provider' ? Number(form.clinicianUserId || 0) : 0;

    if (form.routingMode === 'specific_provider' && (!Number.isFinite(clinicianUserId) || clinicianUserId <= 0)) {
        fieldErrors.value = { clinicianUserId: ['Choose the named provider who should receive this patient next.'] };
        return;
    }

    if (form.routingMode === 'department_pool' && department === '') {
        fieldErrors.value = { department: ['Choose the clinic or department that should own this patient before completing triage.'] };
        return;
    }

    try {
        await triage.mutateAsync({
            appointmentId: props.entry.appointmentId,
            triageVitalsSummary: composedSummary.value,
            triageNotes: form.triageNotes.trim() || null,
            triageCategory: form.triageCategory || null,
            department: department || null,
            clinicianUserId: clinicianUserId > 0 ? clinicianUserId : null,
        });
        emit('recorded');
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { errors?: Record<string, string[]>; message?: string } };
        fieldErrors.value = apiError.payload?.errors ?? {};
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to record triage.');
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>Record triage</SheetTitle>
                <SheetDescription>{{ entry?.patientName || 'Vitals, intake notes, and provider routing.' }}</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to record triage</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>

                <div class="space-y-2">
                    <p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">Vitals</p>
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div v-for="field in STRUCTURED_FIELDS" :key="field.key" class="space-y-1">
                            <Label :for="`triage-${field.key}`" class="text-xs">{{ field.label }}</Label>
                            <Input :id="`triage-${field.key}`" v-model="form[field.key]" :placeholder="field.placeholder" class="h-8 text-sm" />
                        </div>
                    </div>
                    <div v-if="vitalBadges.length > 0" class="flex flex-wrap gap-1.5">
                        <Badge v-for="badge in vitalBadges" :key="badge" variant="secondary" class="text-[11px]">{{ badge }}</Badge>
                    </div>
                </div>

                <div class="space-y-1.5">
                    <Label for="triage-additional-summary">Additional intake notes (optional)</Label>
                    <Textarea id="triage-additional-summary" v-model="form.additionalSummary" rows="2" />
                    <p v-if="fieldError('triageVitalsSummary')" class="text-sm text-destructive">{{ fieldError('triageVitalsSummary') }}</p>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                        <Label for="triage-category">Triage category (optional)</Label>
                        <Select v-model="form.triageCategory">
                            <SelectTrigger id="triage-category" class="h-9 w-full">
                                <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="P1">P1 — Resuscitation</SelectItem>
                                <SelectItem value="P2">P2 — Emergent</SelectItem>
                                <SelectItem value="P3">P3 — Urgent</SelectItem>
                                <SelectItem value="P4">P4 — Less urgent</SelectItem>
                                <SelectItem value="P5">P5 — Non-urgent</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="space-y-1.5">
                        <Label for="triage-notes">Triage notes (optional)</Label>
                        <Input id="triage-notes" v-model="form.triageNotes" class="h-9" />
                    </div>
                </div>

                <div class="space-y-2">
                    <p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">Route to provider</p>
                    <Tabs v-model="form.routingMode">
                        <TabsList class="grid w-full grid-cols-2">
                            <TabsTrigger value="department_pool">Department pool</TabsTrigger>
                            <TabsTrigger value="specific_provider">Named provider</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <SearchableSelectField
                        v-if="form.routingMode === 'department_pool'"
                        v-model="form.department"
                        input-id="triage-department"
                        label="Department"
                        :options="departmentOptions.data.value ?? []"
                        placeholder="Select a department"
                        allow-custom-value
                        :error-message="fieldError('department')"
                    />

                    <div v-else class="space-y-1.5">
                        <Label for="triage-clinician">Provider</Label>
                        <Select v-model="form.clinicianUserId">
                            <SelectTrigger id="triage-clinician" class="h-9 w-full">
                                <SelectValue placeholder="Select a provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    v-for="clinician in clinicianDirectory.data.value?.filter((c) => c.userId !== null) ?? []"
                                    :key="clinician.id"
                                    :value="String(clinician.userId)"
                                >
                                    {{ clinician.userName || 'Unnamed provider' }}
                                    <span v-if="clinician.department" class="text-muted-foreground"> — {{ clinician.department }}</span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="fieldError('clinicianUserId')" class="text-sm text-destructive">{{ fieldError('clinicianUserId') }}</p>
                    </div>
                </div>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ triage.isPending.value ? 'Recording…' : 'Complete triage' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
