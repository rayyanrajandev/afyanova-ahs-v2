<script setup lang="ts">
import { computed, ref } from 'vue';
import { formatPatientName } from '@/lib/patientName';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import ServiceRequestItemSelector, { type SelectedCatalogItem } from '@/components/directService/ServiceRequestItemSelector.vue';
import { useDirectServiceDepartmentOptions } from '@/composables/directService/useDirectServiceDepartmentOptions';
import { useDirectServiceRequest, type DirectServiceType } from '@/composables/patientsIndex/useDirectServiceRequest';

export type DirectServiceDialogPatient = {
    id: string;
    firstName: string | null;
    lastName: string | null;
};

const props = defineProps<{
    patient: DirectServiceDialogPatient | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    created: [requestNumber: string | null];
}>();

const serviceType = ref<DirectServiceType>('laboratory');
const departmentId = ref('');
const priority = ref<'routine' | 'urgent'>('routine');
const notes = ref('');
const selectedItems = ref<SelectedCatalogItem[]>([]);
const request = useDirectServiceRequest();
const departmentOptions = useDirectServiceDepartmentOptions(serviceType);

const canSubmit = computed(() => !request.isPending.value);

async function submit(): Promise<void> {
    if (!props.patient) return;
    const result = await request.mutateAsync({
        patientId: props.patient.id,
        serviceType: serviceType.value,
        departmentId: departmentId.value || null,
        priority: priority.value,
        notes: notes.value,
        items: selectedItems.value.length > 0 ? selectedItems.value.map((item) => ({
            catalogItemId: item.catalogItemId,
            itemName: item.itemName,
            itemCode: item.itemCode,
            quantity: item.quantity,
            clinicalIndication: item.clinicalIndication,
            instructions: item.instructions,
        })) : undefined,
    });
    emit('created', result.requestNumber);
    open.value = false;
    serviceType.value = 'laboratory';
    departmentId.value = '';
    priority.value = 'routine';
    notes.value = '';
    selectedItems.value = [];
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => (open = value)">
        <DialogContent size="md">
            <DialogHeader>
                <DialogTitle>Direct service request</DialogTitle>
                <DialogDescription>
                    {{ patient ? formatPatientName(patient) : '' }} — for a patient who needs only a
                    lab/pharmacy/radiology/theatre service, not a doctor visit.
                </DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-2">
                <div class="grid gap-2">
                    <Label for="direct-service-type">Service</Label>
                    <Select v-model="serviceType">
                        <SelectTrigger id="direct-service-type" class="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="laboratory">Laboratory</SelectItem>
                            <SelectItem value="pharmacy">Pharmacy</SelectItem>
                            <SelectItem value="radiology">Radiology</SelectItem>
                            <SelectItem value="theatre_procedure">Theatre procedure</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <SearchableSelectField
                    v-model="departmentId"
                    input-id="direct-service-department"
                    label="Department (optional)"
                    :options="departmentOptions.data.value ?? []"
                    placeholder="Select a department"
                    empty-text="No matching department found."
                />
                <ServiceRequestItemSelector
                    v-if="departmentId"
                    :department-id="departmentId"
                    v-model="selectedItems"
                />
                <div class="grid gap-2">
                    <Label for="direct-service-priority">Priority</Label>
                    <Select v-model="priority">
                        <SelectTrigger id="direct-service-priority" class="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="routine">Routine</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="grid gap-2">
                    <Label for="direct-service-notes">Notes (optional)</Label>
                    <Textarea id="direct-service-notes" v-model="notes" rows="3" />
                </div>

                <Alert v-if="request.error.value" variant="destructive">
                    <AlertTitle>Unable to create request</AlertTitle>
                    <AlertDescription>{{ request.error.value.message }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ request.isPending.value ? 'Submitting…' : 'Create request' }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
