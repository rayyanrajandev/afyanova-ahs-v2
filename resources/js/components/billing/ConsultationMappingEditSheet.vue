<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useConsultationMappingCatalogItemOptions } from '@/composables/consultationMappings/useConsultationMappingCatalogItemOptions';
import { useConsultationMappingDepartmentOptions } from '@/composables/consultationMappings/useConsultationMappingDepartmentOptions';
import { CLINICIAN_TIER_OPTIONS, type ConsultationMapping } from '@/composables/consultationMappings/useConsultationMappings';
import { useUpdateConsultationMapping } from '@/composables/consultationMappings/useUpdateConsultationMapping';
import { messageFromUnknown } from '@/lib/notify';

const props = defineProps<{
    mapping: ConsultationMapping | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    updated: [mapping: ConsultationMapping];
}>();

const clinicianTier = ref('CO');
const department = ref('');
const billingServiceCatalogItemId = ref('');
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const { options: departmentOptions } = useConsultationMappingDepartmentOptions();
const { options: catalogItemOptions } = useConsultationMappingCatalogItemOptions();
const update = useUpdateConsultationMapping();

watch([open, () => props.mapping], ([isOpen, mapping]) => {
    if (!isOpen || !mapping) return;
    clinicianTier.value = mapping.clinicianTier;
    department.value = mapping.department;
    billingServiceCatalogItemId.value = mapping.billingServiceCatalogItemId;
    submitError.value = null;
    fieldErrors.value = {};
});

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

function catalogItemLabel(mapping: ConsultationMapping | null): string {
    const item = mapping?.catalogItem;
    if (!item) return 'Update the tier, department, or priced catalog item.';
    return item.serviceName || item.serviceCode || 'Update the tier, department, or priced catalog item.';
}

const canSubmit = computed(() => department.value.trim() !== '' && billingServiceCatalogItemId.value.trim() !== '' && !update.isPending.value);

async function submit(): Promise<void> {
    if (!props.mapping) return;
    submitError.value = null;
    fieldErrors.value = {};

    try {
        const mapping = await update.mutateAsync({
            id: props.mapping.id,
            clinicianTier: clinicianTier.value,
            department: department.value.trim(),
            billingServiceCatalogItemId: billingServiceCatalogItemId.value.trim(),
        });
        emit('updated', mapping);
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { errors?: Record<string, string[]>; message?: string } };
        fieldErrors.value = apiError.payload?.errors ?? {};
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to update this consultation mapping.');
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>Edit consultation mapping</SheetTitle>
                <SheetDescription>{{ catalogItemLabel(mapping) }}</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to update this consultation mapping</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>

                <div class="space-y-1.5">
                    <Label for="consultation-mapping-edit-tier">Clinician tier</Label>
                    <Select v-model="clinicianTier">
                        <SelectTrigger id="consultation-mapping-edit-tier" class="w-full">
                            <SelectValue placeholder="Select tier" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="option in CLINICIAN_TIER_OPTIONS" :key="option.value" :value="option.value">
                                {{ option.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <p v-if="fieldError('clinician_tier')" class="text-sm text-destructive">{{ fieldError('clinician_tier') }}</p>
                </div>

                <SearchableSelectField
                    v-model="department"
                    input-id="consultation-mapping-edit-department"
                    label="Department"
                    :options="departmentOptions"
                    search-placeholder="Search departments"
                    empty-text="No matching department found."
                    required
                    :error-message="fieldError('department')"
                />

                <SearchableSelectField
                    v-model="billingServiceCatalogItemId"
                    input-id="consultation-mapping-edit-catalog-item"
                    label="Billing service catalog item"
                    :options="catalogItemOptions"
                    search-placeholder="Search service code or name"
                    empty-text="No matching catalog item found."
                    required
                    :error-message="fieldError('billing_service_catalog_item_id')"
                />
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ update.isPending.value ? 'Saving…' : 'Save changes' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
