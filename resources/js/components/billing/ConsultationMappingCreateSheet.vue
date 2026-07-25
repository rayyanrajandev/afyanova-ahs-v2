<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useChargeableItemOptions } from '@/composables/chargeableItems/useChargeableItemOptions';
import { useConsultationMappingDepartmentOptions } from '@/composables/consultationMappings/useConsultationMappingDepartmentOptions';
import { CLINICIAN_TIER_OPTIONS, type ConsultationMapping } from '@/composables/consultationMappings/useConsultationMappings';
import { useCreateConsultationMapping } from '@/composables/consultationMappings/useCreateConsultationMapping';
import { messageFromUnknown } from '@/lib/notify';

/**
 * Standalone create Sheet, same shape as AppointmentEditSheet.vue /
 * CreateAdmissionSheet.vue: defineModel for open, watch(open) resets the
 * form, header/footer use the backdrop-blur sticky style, fields are flat
 * (no fieldset grouping — three fields doesn't need it).
 *
 * PricingEngine_Migration_Plan.md Phase 5: the old "Billing service catalog
 * item" picker is gone -- chargeable_item_id is now the only pricing path
 * for a consultation mapping.
 */
const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    created: [mapping: ConsultationMapping];
}>();

const clinicianTier = ref('CO');
const department = ref('');
const chargeableItemId = ref('');
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const { options: departmentOptions } = useConsultationMappingDepartmentOptions();
const { options: pricingItemOptions } = useChargeableItemOptions('consultation');
const create = useCreateConsultationMapping();

watch(open, (isOpen) => {
    if (!isOpen) return;
    clinicianTier.value = 'CO';
    department.value = '';
    chargeableItemId.value = '';
    submitError.value = null;
    fieldErrors.value = {};
});

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

const canSubmit = computed(() => department.value.trim() !== '' && chargeableItemId.value.trim() !== '' && !create.isPending.value);

async function submit(): Promise<void> {
    submitError.value = null;
    fieldErrors.value = {};

    try {
        const mapping = await create.mutateAsync({
            clinicianTier: clinicianTier.value,
            department: department.value.trim(),
            chargeableItemId: chargeableItemId.value.trim(),
        });
        emit('created', mapping);
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { errors?: Record<string, string[]>; message?: string } };
        fieldErrors.value = apiError.payload?.errors ?? {};
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to create this consultation mapping.');
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>New consultation mapping</SheetTitle>
                <SheetDescription>
                    The department must match the appointment department exactly — it's sourced from the same list used when
                    scheduling appointments.
                </SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to create this consultation mapping</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>

                <div class="space-y-1.5">
                    <Label for="consultation-mapping-create-tier">Clinician tier</Label>
                    <Select v-model="clinicianTier">
                        <SelectTrigger id="consultation-mapping-create-tier" class="w-full">
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
                    input-id="consultation-mapping-create-department"
                    label="Department"
                    :options="departmentOptions"
                    placeholder="Select department"
                    search-placeholder="Search departments"
                    empty-text="No matching department found."
                    required
                    :error-message="fieldError('department')"
                />

                <SearchableSelectField
                    v-model="chargeableItemId"
                    input-id="consultation-mapping-create-pricing-item"
                    label="Pricing item"
                    :options="pricingItemOptions"
                    placeholder="Select active pricing item"
                    search-placeholder="Search pricing items"
                    empty-text="No matching pricing item found."
                    required
                    :error-message="fieldError('chargeable_item_id')"
                />
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ create.isPending.value ? 'Creating…' : 'Create mapping' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
