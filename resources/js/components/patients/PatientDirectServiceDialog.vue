<script setup lang="ts">
import { computed, ref } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { useDirectServiceDepartmentOptions } from '@/composables/directService/useDirectServiceDepartmentOptions';
import { useDirectServiceRequest, type DirectServiceType } from '@/composables/patientsIndex/useDirectServiceRequest';

/**
 * Phase 5 of reports/patients-index-modernization-plan.md — the
 * "direct-services" mode, the one Visit Handoff action that genuinely
 * needs a form (per reports/reception-checkin-architecture-audit.md's
 * constraint: only the modes that actually require administrative input
 * get a dialog — outpatient/emergency check-in do not, and are one-click
 * actions in PatientVisitActionsMenu.vue instead). A small Dialog, not a
 * Sheet: four fields is a "lightweight dialog," not a workspace.
 *
 * `patient` is deliberately the minimal shape this component actually
 * uses (id + name, for the description text), not the full
 * PatientListItem — that keeps this usable from any caller that has
 * already resolved a patient, including reception/Queue.vue's own
 * PatientSearchResult (a narrower local type), not just IndexV2.vue.
 *
 * Department field added for the patient flow redesign's Direct Service
 * workflow B4: department_id existed on service_requests but was never set
 * here, making Direct Service Queue V2's per-department scoping impossible
 * to populate from intake. Optional (an actor with
 * service.requests.view-all-departments can leave it unset and pick it up
 * from the queue's own department filter later) but expected in normal use
 * so the ticket lands in the right department's queue immediately.
 */
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
    });
    emit('created', result.requestNumber);
    open.value = false;
    serviceType.value = 'laboratory';
    departmentId.value = '';
    priority.value = 'routine';
    notes.value = '';
}
</script>

<template>
    <Dialog :open="open" @update:open="(value) => (open = value)">
        <DialogContent size="md">
            <DialogHeader>
                <DialogTitle>Direct service request</DialogTitle>
                <DialogDescription>
                    {{ patient ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() : '' }} — for a patient who needs only a
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
