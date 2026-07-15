<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { type PatientVitalSet, useVitalSetCreate, useVitalSetUpdate } from '@/composables/patientChart/usePatientVitals';
import { isApiClientError } from '@/lib/apiClient';
import { notifySuccess } from '@/lib/notify';

const props = defineProps<{
    patientId: string;
    vitals: PatientVitalSet | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    updated: [vitals: PatientVitalSet];
}>();

const patientIdRef = computed(() => props.patientId);
const update = useVitalSetUpdate(patientIdRef);
const create = useVitalSetCreate(patientIdRef);

const isCreating = computed(() => !props.vitals);
const saving = computed(() => update.isPending.value || create.isPending.value);

function resetForm(): void {
    form.value = {
        temperatureC: null,
        heartRateBpm: null,
        systolicBpMmhg: null,
        diastolicBpMmhg: null,
        oxygenSaturationPct: null,
        respiratoryRateBpm: null,
        weightKg: null,
    };
}

const form = ref({
    temperatureC: props.vitals?.temperatureC ?? null as number | null,
    heartRateBpm: props.vitals?.heartRateBpm ?? null as number | null,
    systolicBpMmhg: props.vitals?.systolicBpMmhg ?? null as number | null,
    diastolicBpMmhg: props.vitals?.diastolicBpMmhg ?? null as number | null,
    oxygenSaturationPct: props.vitals?.oxygenSaturationPct ?? null as number | null,
    respiratoryRateBpm: props.vitals?.respiratoryRateBpm ?? null as number | null,
    weightKg: props.vitals?.weightKg ?? null as number | null,
});

watch(open, (isOpen) => {
    if (isOpen) {
        if (props.vitals) {
            form.value = {
                temperatureC: props.vitals.temperatureC,
                heartRateBpm: props.vitals.heartRateBpm,
                systolicBpMmhg: props.vitals.systolicBpMmhg,
                diastolicBpMmhg: props.vitals.diastolicBpMmhg,
                oxygenSaturationPct: props.vitals.oxygenSaturationPct,
                respiratoryRateBpm: props.vitals.respiratoryRateBpm,
                weightKg: props.vitals.weightKg,
            };
        } else {
            resetForm();
        }
    }
});

const canSubmit = computed(() => !saving.value);

function updateField(field: keyof typeof form.value, value: string): void {
    const trimmed = value.trim();
    form.value[field] = trimmed === '' ? null : Number(trimmed);
}

async function submit(): Promise<void> {
    if (isCreating.value) {
        const body: Record<string, unknown> = {
            patientId: props.patientId,
            temperatureC: form.value.temperatureC,
            heartRateBpm: form.value.heartRateBpm,
            systolicBpMmhg: form.value.systolicBpMmhg,
            diastolicBpMmhg: form.value.diastolicBpMmhg,
            oxygenSaturationPct: form.value.oxygenSaturationPct,
            respiratoryRateBpm: form.value.respiratoryRateBpm,
            weightKg: form.value.weightKg,
        };
        try {
            const result = await create.mutateAsync(body);
            emit('updated', result);
            notifySuccess('Vitals recorded');
            open.value = false;
        } catch {
            // error shown inline
        }
        return;
    }
    if (!props.vitals?.id) return;

    const body: Record<string, unknown> = {};
    if (form.value.temperatureC !== props.vitals.temperatureC) body.temperatureC = form.value.temperatureC;
    if (form.value.heartRateBpm !== props.vitals.heartRateBpm) body.heartRateBpm = form.value.heartRateBpm;
    if (form.value.systolicBpMmhg !== props.vitals.systolicBpMmhg) body.systolicBpMmhg = form.value.systolicBpMmhg;
    if (form.value.diastolicBpMmhg !== props.vitals.diastolicBpMmhg) body.diastolicBpMmhg = form.value.diastolicBpMmhg;
    if (form.value.oxygenSaturationPct !== props.vitals.oxygenSaturationPct) body.oxygenSaturationPct = form.value.oxygenSaturationPct;
    if (form.value.respiratoryRateBpm !== props.vitals.respiratoryRateBpm) body.respiratoryRateBpm = form.value.respiratoryRateBpm;
    if (form.value.weightKg !== props.vitals.weightKg) body.weightKg = form.value.weightKg;

    if (Object.keys(body).length === 0) {
        open.value = false;
        return;
    }

    try {
        const result = await update.mutateAsync({ vitalSetId: props.vitals.id, body });
        emit('updated', result);
        notifySuccess('Vitals updated');
        open.value = false;
    } catch {
        // error shown inline
    }
}

const submitError = computed(() => {
    const err = isCreating.value ? create.error.value : update.error.value;
    if (!err) return null;
    if (isApiClientError(err) && err.status === 422 && err.payload?.errors) {
        return Object.values(err.payload.errors).flat().join('. ');
    }
    return err.message;
});
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>{{ isCreating ? 'Record vitals' : 'Edit vitals' }}</SheetTitle>
                <SheetDescription>{{ isCreating ? 'Enter the patient\'s vital sign measurements.' : 'Update or correct the patient\'s vital sign measurements.' }}</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-1.5">
                        <Label for="vitals-bp-systolic">Systolic BP</Label>
                        <Input id="vitals-bp-systolic" :value="form.systolicBpMmhg ?? ''" type="text" inputmode="numeric" placeholder="e.g. 120" @input="updateField('systolicBpMmhg', ($event.target as HTMLInputElement).value)" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="vitals-bp-diastolic">Diastolic BP</Label>
                        <Input id="vitals-bp-diastolic" :value="form.diastolicBpMmhg ?? ''" type="text" inputmode="numeric" placeholder="e.g. 80" @input="updateField('diastolicBpMmhg', ($event.target as HTMLInputElement).value)" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="vitals-hr">Heart rate</Label>
                        <Input id="vitals-hr" :value="form.heartRateBpm ?? ''" type="text" inputmode="numeric" placeholder="bpm" @input="updateField('heartRateBpm', ($event.target as HTMLInputElement).value)" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="vitals-temp">Temperature</Label>
                        <Input id="vitals-temp" :value="form.temperatureC ?? ''" type="text" inputmode="decimal" placeholder="°C" @input="updateField('temperatureC', ($event.target as HTMLInputElement).value)" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="vitals-spo2">SpO₂</Label>
                        <Input id="vitals-spo2" :value="form.oxygenSaturationPct ?? ''" type="text" inputmode="numeric" placeholder="%" @input="updateField('oxygenSaturationPct', ($event.target as HTMLInputElement).value)" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="vitals-rr">Respiratory rate</Label>
                        <Input id="vitals-rr" :value="form.respiratoryRateBpm ?? ''" type="text" inputmode="numeric" placeholder="/min" @input="updateField('respiratoryRateBpm', ($event.target as HTMLInputElement).value)" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="vitals-weight">Weight</Label>
                        <Input id="vitals-weight" :value="form.weightKg ?? ''" type="text" inputmode="decimal" placeholder="kg" @input="updateField('weightKg', ($event.target as HTMLInputElement).value)" />
                    </div>
                </div>

                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to save</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ saving.value ? 'Saving…' : isCreating ? 'Record vitals' : 'Save changes' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
