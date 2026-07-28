<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { formatPatientName } from '@/lib/patientName';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import ServiceRequestItemSelector, { type SelectedCatalogItem } from '@/components/directService/ServiceRequestItemSelector.vue';
import { useDirectServiceRequest, type DirectServiceType } from '@/composables/patientsIndex/useDirectServiceRequest';

export type DirectServiceSheetPatient = {
    id: string;
    firstName: string | null;
    lastName: string | null;
};

const props = defineProps<{
    patient: DirectServiceSheetPatient | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    created: [requestNumber: string | null];
}>();

const departmentId = ref('');
const priority = ref<'routine' | 'urgent'>('routine');
const notes = ref('');
const selectedItems = ref<SelectedCatalogItem[]>([]);
const request = useDirectServiceRequest();

const serviceOptions = ref<SearchableSelectOption[]>([]);
const loadingServices = ref(true);
const serviceError = ref<string | null>(null);

onMounted(async () => {
    try {
        const res = await fetch('/api/v1/service-requests/department-options', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (!res.ok) {
            serviceError.value = `${res.status} ${res.statusText}`;
        } else {
            const json = await res.json();
            serviceOptions.value = json.data ?? [];
        }
    } catch (e) {
        serviceError.value = String(e);
        serviceOptions.value = [];
    } finally {
        loadingServices.value = false;
    }
});

function deriveServiceType(label: string): DirectServiceType {
    const h = label.toLowerCase();
    if (/clinical.?procedur|treatment.?room|dressing|minor.?procedur|clinic/.test(h)) return 'clinical_procedure';
    if (/lab|laboratory|pathology|sample/.test(h)) return 'laboratory';
    if (/pharmacy|dispensary|dispensing|medicine/.test(h)) return 'pharmacy';
    if (/radiology|imaging|x-?ray|ultrasound|scan/.test(h)) return 'radiology';
    if (/theatre|surgery|surgical|operating/i.test(h)) return 'theatre_procedure';
    return 'laboratory';
}

const selectedServiceLabel = computed(() => {
    const opt = serviceOptions.value.find((o) => o.value === departmentId.value);
    return opt?.label ?? null;
});

const derivedServiceType = computed<DirectServiceType>(() =>
    selectedServiceLabel.value
        ? deriveServiceType(selectedServiceLabel.value)
        : 'laboratory',
);

const canSubmit = computed(() => !request.isPending.value);

watch(open, (isOpen) => {
    if (!isOpen) return;
    departmentId.value = '';
    priority.value = 'routine';
    notes.value = '';
    selectedItems.value = [];
});

async function submit(): Promise<void> {
    if (!props.patient) return;
    const result = await request.mutateAsync({
        patientId: props.patient.id,
        serviceType: derivedServiceType.value,
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
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent
            side="right"
            variant="form"
            size="2xl"
            @open-auto-focus="(event: Event) => event.preventDefault()"
        >
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>Direct service request</SheetTitle>
                <SheetDescription>
                    {{ patient ? formatPatientName(patient) : '' }} — order tests, medications, or procedures without a doctor visit.
                </SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <div class="grid gap-2">
                    <Label for="direct-service-select">Service</Label>
                    <Select v-model="departmentId">
                        <SelectTrigger id="direct-service-select" class="w-full">
                            <SelectValue placeholder="Select service…" />
                        </SelectTrigger>
                        <SelectContent>
                            <template v-if="loadingServices">
                                <div class="p-2">
                                    <Skeleton class="h-5 w-full" />
                                </div>
                            </template>
                            <template v-else-if="serviceError">
                                <div class="px-2 py-3 text-center text-xs text-destructive">
                                    Failed to load: {{ serviceError }}
                                </div>
                            </template>
                            <template v-else-if="serviceOptions.length === 0">
                                <div class="px-2 py-3 text-center text-xs text-muted-foreground">
                                    No services available.
                                </div>
                            </template>
                            <SelectItem
                                v-for="opt in serviceOptions"
                                :key="opt.value"
                                :value="opt.value"
                            >
                                {{ opt.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <ServiceRequestItemSelector
                    v-if="departmentId"
                    :department-id="departmentId"
                    :service-type="derivedServiceType"
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

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ request.isPending.value ? 'Submitting…' : 'Create request' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>