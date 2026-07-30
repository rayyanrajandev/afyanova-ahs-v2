<script setup lang="ts">
import { computed, ref } from 'vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSubmitNurseAssessment, type NurseQueueEncounter, type AssessPayloadItem } from '@/composables/nurse-queue/useNurseQueue';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

const props = defineProps<{
    open: boolean;
    encounter: NurseQueueEncounter;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    completed: [];
}>();

const clinicalNote = ref('');
const selectedItems = ref<AssessPayloadItem[]>([]);
const newItemName = ref('');
const newItemCode = ref('');
const newItemServiceType = ref('pharmacy');
const newItemQuantity = ref(1);
const error = ref<string | null>(null);

const serviceTypeOptions = [
    { value: 'laboratory', label: 'Laboratory' },
    { value: 'pharmacy', label: 'Pharmacy' },
    { value: 'radiology', label: 'Radiology' },
    { value: 'clinical_procedure', label: 'Clinical Procedure' },
];

const canSubmit = computed(() => {
    return clinicalNote.value.trim().length > 0 && selectedItems.value.length > 0;
});

function addItem(): void {
    const name = newItemName.value.trim();
    if (!name) return;
    selectedItems.value.push({
        itemName: name,
        itemCode: newItemCode.value.trim() || null,
        serviceType: newItemServiceType.value,
        quantity: newItemQuantity.value,
    });
    newItemName.value = '';
    newItemCode.value = '';
    newItemServiceType.value = 'pharmacy';
    newItemQuantity.value = 1;
}

function removeItem(index: number): void {
    selectedItems.value.splice(index, 1);
}

const mutation = useSubmitNurseAssessment();

async function submit(): Promise<void> {
    if (!canSubmit.value) return;
    error.value = null;
    try {
        await mutation.mutateAsync({
            encounterId: props.encounter.id,
            clinicalNote: clinicalNote.value.trim(),
            items: selectedItems.value,
        });
        notifySuccess('Assessment submitted. Orders sent to departments.');
        emit('completed');
        emit('update:open', false);
        clinicalNote.value = '';
        selectedItems.value = [];
    } catch (e) {
        error.value = messageFromUnknown(e, 'Failed to submit assessment.');
        notifyError(error.value);
    }
}

function patientDisplayName(): string {
    const p = props.encounter.patient;
    if (!p) return 'Unknown';
    return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') || 'Unknown';
}

function patientMeta(): string {
    const p = props.encounter.patient;
    if (!p) return '';
    const parts: string[] = [];
    if (p.gender) parts.push(p.gender.toUpperCase());
    if (p.age !== null && p.age !== undefined) parts.push(`${p.age}y`);
    if (p.patientNumber) parts.push(p.patientNumber);
    return parts.join('  |  ');
}

const serviceTypeLabel = computed(() => {
    const map: Record<string, string> = {
        laboratory: 'Lab',
        pharmacy: 'Pharmacy',
        radiology: 'Radiology',
        clinical_procedure: 'Procedure',
    };
    return (v: string) => map[v] || v;
});
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent variant="action" size="lg">
            <DialogHeader>
                <DialogTitle>Quick Assessment</DialogTitle>
                <DialogDescription>
                    Write your clinical note and select required services.
                </DialogDescription>
            </DialogHeader>

            <div class="space-y-4">
                <div class="rounded-lg border bg-muted/20 p-3">
                    <p class="text-sm font-medium">{{ patientDisplayName() }}</p>
                    <p class="text-xs text-muted-foreground">{{ patientMeta() }}</p>
                </div>

                <div class="grid gap-2">
                    <Label for="nurse-clinical-note">
                        Clinical Note <span class="text-destructive">*</span>
                    </Label>
                    <Textarea
                        id="nurse-clinical-note"
                        v-model="clinicalNote"
                        rows="4"
                        placeholder="Patient presents with... Assessment:... Plan:..."
                    />
                </div>

                <div class="space-y-2">
                    <Label>Services Required <span class="text-destructive">*</span></Label>

                    <div v-if="selectedItems.length > 0" class="space-y-1">
                        <div
                            v-for="(item, index) in selectedItems"
                            :key="index"
                            class="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm"
                        >
                            <Badge variant="secondary" class="h-5 text-[10px]">
                                {{ serviceTypeLabel(item.serviceType) }}
                            </Badge>
                            <span class="flex-1 truncate">{{ item.itemName }}</span>
                            <span class="text-xs text-muted-foreground">x{{ item.quantity }}</span>
                            <button
                                type="button"
                                class="text-muted-foreground hover:text-destructive"
                                @click="removeItem(index)"
                            >
                                &times;
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-6 gap-2">
                        <Select v-model="newItemServiceType">
                            <SelectTrigger class="col-span-2 h-9 text-xs">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    v-for="opt in serviceTypeOptions"
                                    :key="opt.value"
                                    :value="opt.value"
                                >
                                    {{ opt.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            v-model="newItemName"
                            placeholder="Item name"
                            class="col-span-2 h-9"
                            @keydown.enter.prevent="addItem"
                        />
                        <Input
                            v-model="newItemCode"
                            placeholder="Code (optional)"
                            class="col-span-1 h-9"
                            @keydown.enter.prevent="addItem"
                        />
                        <Input
                            v-model.number="newItemQuantity"
                            type="number"
                            min="1"
                            placeholder="Qty"
                            class="col-span-1 h-9"
                            @keydown.enter.prevent="addItem"
                        />
                    </div>
                    <Button variant="outline" size="sm" class="h-8 text-xs" :disabled="!newItemName.trim()" @click="addItem">
                        + Add item
                    </Button>
                </div>

                <Alert v-if="error" variant="destructive">
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" :disabled="mutation.isPending.value" @click="emit('update:open', false)">
                    Cancel
                </Button>
                <Button :disabled="!canSubmit || mutation.isPending.value" @click="submit">
                    {{ mutation.isPending.value ? 'Submitting…' : 'Complete Assessment & Send Orders' }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
