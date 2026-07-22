<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { apiPatch } from '@/lib/apiClient';
import { messageFromUnknown } from '@/lib/notify';

type TriageLevel = 'red' | 'yellow' | 'green';

interface EmergencyCase {
    id: string;
    caseNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    chiefComplaint: string | null;
    vitalsSummary: string | null;
    triageLevel: string | null;
    status: string | null;
}

const props = defineProps<{
    emergencyCase: EmergencyCase | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    recorded: [];
}>();

const submitting = ref(false);
const submitError = ref<string | null>(null);

const form = reactive({
    triageLevel: '' as '' | TriageLevel,
    bloodPressure: '',
    pulse: '',
    temperature: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    notes: '',
});

watch(open, (isOpen) => {
    if (!isOpen) return;
    form.triageLevel = (props.emergencyCase?.triageLevel as '' | TriageLevel) || '';
    form.bloodPressure = '';
    form.pulse = '';
    form.temperature = '';
    form.respiratoryRate = '';
    form.oxygenSaturation = '';
    form.weight = '';
    form.notes = '';
    submitError.value = null;
});

const canSubmit = computed(() => !submitting.value && form.triageLevel !== '');

const triageLevelMeta = {
    red: { label: 'Red — Resuscitation', class: 'border-destructive text-destructive' },
    yellow: { label: 'Yellow — Urgent', class: 'border-amber-500 text-amber-600' },
    green: { label: 'Green — Non-urgent', class: 'border-emerald-600 text-emerald-600' },
} as const;

function buildVitalsSummary(): string {
    const parts: string[] = [];
    const bp = form.bloodPressure.trim();
    if (bp) parts.push(`BP ${bp}`);
    const pulse = form.pulse.trim();
    if (pulse) parts.push(`Pulse ${pulse} bpm`);
    const temp = form.temperature.trim();
    if (temp) parts.push(`Temp ${temp} C`);
    const rr = form.respiratoryRate.trim();
    if (rr) parts.push(`RR ${rr}/min`);
    const spo2 = form.oxygenSaturation.trim();
    if (spo2) parts.push(`SpO2 ${spo2}%`);
    const weight = form.weight.trim();
    if (weight) parts.push(`Weight ${weight} kg`);
    const notes = form.notes.trim();
    if (notes) parts.push(notes);
    return parts.join(', ');
}

async function submit(): Promise<void> {
    const emergencyCase = props.emergencyCase;
    if (!emergencyCase || !canSubmit.value) return;

    submitting.value = true;
    submitError.value = null;

    const vitalsSummary = buildVitalsSummary();

    try {
        await apiPatch(`/emergency-triage-cases/${emergencyCase.id}`, {
            body: {
                triageLevel: form.triageLevel,
                vitalsSummary: vitalsSummary || null,
                chiefComplaint: emergencyCase.chiefComplaint,
            },
        });

        await apiPatch(`/emergency-triage-cases/${emergencyCase.id}/status`, {
            body: { status: 'triaged' },
        });

        emit('recorded');
        open.value = false;
    } catch (error) {
        submitError.value = messageFromUnknown(error, 'Unable to record triage.');
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl">
            <form class="contents" @submit.prevent="submit">
                <SheetHeader
                    class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80"
                >
                    <SheetTitle>Emergency triage</SheetTitle>
                    <SheetDescription>
                        {{ emergencyCase?.caseNumber || 'Case' }} — Record vitals, assign acuity, and complete triage.
                    </SheetDescription>
                </SheetHeader>

                <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                    <Alert v-if="submitError" variant="destructive">
                        <AlertTitle>Unable to record triage</AlertTitle>
                        <AlertDescription>{{ submitError }}</AlertDescription>
                    </Alert>

                    <div class="space-y-2">
                        <p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            Triage level
                        </p>
                        <div class="grid grid-cols-3 gap-2">
                            <button
                                v-for="(meta, level) in triageLevelMeta"
                                :key="level"
                                type="button"
                                :class="[
                                    'rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors',
                                    form.triageLevel === level
                                        ? meta.class + ' bg-accent'
                                        : 'border-border text-muted-foreground hover:border-muted-foreground/50',
                                ]"
                                @click="form.triageLevel = level as TriageLevel"
                            >
                                {{ meta.label }}
                            </button>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            Chief complaint
                        </p>
                        <p class="text-sm text-foreground">
                            {{ emergencyCase?.chiefComplaint || 'Not recorded' }}
                        </p>
                    </div>

                    <div class="space-y-2">
                        <p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            Vitals
                        </p>
                        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <div class="space-y-1">
                                <Label for="et-bp" class="text-xs">Blood pressure</Label>
                                <Input id="et-bp" v-model="form.bloodPressure" placeholder="118/74" class="h-8 text-sm" />
                            </div>
                            <div class="space-y-1">
                                <Label for="et-pulse" class="text-xs">Pulse</Label>
                                <Input id="et-pulse" v-model="form.pulse" placeholder="82" class="h-8 text-sm" />
                            </div>
                            <div class="space-y-1">
                                <Label for="et-temp" class="text-xs">Temperature</Label>
                                <Input id="et-temp" v-model="form.temperature" placeholder="37.1" class="h-8 text-sm" />
                            </div>
                            <div class="space-y-1">
                                <Label for="et-rr" class="text-xs">Respiratory rate</Label>
                                <Input id="et-rr" v-model="form.respiratoryRate" placeholder="18" class="h-8 text-sm" />
                            </div>
                            <div class="space-y-1">
                                <Label for="et-spo2" class="text-xs">SpO2</Label>
                                <Input id="et-spo2" v-model="form.oxygenSaturation" placeholder="98" class="h-8 text-sm" />
                            </div>
                            <div class="space-y-1">
                                <Label for="et-weight" class="text-xs">Weight</Label>
                                <Input id="et-weight" v-model="form.weight" placeholder="70" class="h-8 text-sm" />
                            </div>
                        </div>
                    </div>

                    <div class="space-y-1.5">
                        <Label for="et-notes">Additional notes (optional)</Label>
                        <Textarea id="et-notes" v-model="form.notes" rows="3" />
                    </div>
                </div>

                <SheetFooter
                    class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80"
                >
                    <Button type="button" variant="outline" @click="open = false">Cancel</Button>
                    <Button type="submit" :disabled="!canSubmit">
                        {{ submitting ? 'Saving…' : 'Complete triage' }}
                    </Button>
                </SheetFooter>
            </form>
        </SheetContent>
    </Sheet>
</template>
