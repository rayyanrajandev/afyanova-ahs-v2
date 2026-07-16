<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import EncounterMedicationSafetyPanel from '@/components/domain/clinical/EncounterMedicationSafetyPanel.vue';
import ConfirmationDialog from '@/components/workflow/ConfirmationDialog.vue';
import { useConfirmationDialog } from '@/composables/useConfirmationDialog';
import { ApiClientError } from '@/lib/apiClient';
import {
    catalogItemLabel,
    checkPharmacyDuplicate,
    createPharmacyInlineOrder,
    duplicateCheckDetails,
    fetchApprovedMedicinesCatalog,
    fetchPatientMedicationSafetySummary,
    type ClinicalCatalogItem,
    type MedicationSafetyContinuationDecision,
} from '@/lib/encounterInlineOrders';
import { messageFromUnknown, notifyError } from '@/lib/notify';

/**
 * Phase 2 of reports/order-creation-v2-modernization-plan.md — same shape
 * as RadiologyOrderCreateSheet.vue (Phase 1), reusing the exact
 * duplicate-check/create functions EncounterInlineOrderPanel.vue already
 * calls from an active encounter.
 *
 * Embeds EncounterMedicationSafetyPanel (visual warnings while filling the
 * form) plus replicates its submit-time safety-decision gating exactly —
 * skipping medication safety checks for orders placed outside an encounter
 * would be a real regression, not a simplification (per the plan's Q2).
 *
 * No context (appointment/admission) picker, same reasoning as radiology:
 * both are nullable server-side, so a patient-only order is a valid case.
 * The legacy page's "formulary policy-review-required governance tier" is
 * a separate, post-creation lifecycle step already ported to V2 via
 * PharmacyPolicyDialog.vue on the worklist page — not part of creation
 * itself (confirmed: CreatePharmacyOrderUseCase/StorePharmacyOrderRequest
 * have no policy-review concept at all).
 */
const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    created: [orderNumber: string];
}>();

const {
    confirmationDialogState,
    requestConfirmation,
    updateConfirmationDialogOpen,
    confirmDialogAction,
} = useConfirmationDialog();

const patientId = ref('');
const catalogLoading = ref(false);
const catalogError = ref<string | null>(null);
const catalogItems = ref<ClinicalCatalogItem[]>([]);
const submitLoading = ref(false);
const fieldErrors = ref<Record<string, string[]>>({});
const formError = ref<string | null>(null);

const form = reactive({
    catalogItemId: '',
    dosageInstruction: '',
    clinicalIndication: '',
    quantityPrescribed: '1',
    dispensingNotes: '',
});

const selectedCatalogItem = computed(() =>
    catalogItems.value.find((item) => item.id === form.catalogItemId) ?? null,
);

const catalogOptions = computed(() =>
    catalogItems.value.map((item) => ({
        value: item.id,
        label: catalogItemLabel(item),
        keywords: [item.code, item.name, item.category].filter((k): k is string => Boolean(k)),
    })),
);

const safetyMedicationCode = computed(() => selectedCatalogItem.value?.code?.trim() ?? '');
const safetyMedicationName = computed(() => selectedCatalogItem.value?.name?.trim() ?? '');

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

function resetForm(): void {
    patientId.value = '';
    form.catalogItemId = '';
    form.dosageInstruction = '';
    form.clinicalIndication = '';
    form.quantityPrescribed = '1';
    form.dispensingNotes = '';
    fieldErrors.value = {};
    formError.value = null;
    catalogError.value = null;
}

async function loadCatalog(): Promise<void> {
    catalogLoading.value = true;
    catalogError.value = null;

    try {
        catalogItems.value = await fetchApprovedMedicinesCatalog();
    } catch (error) {
        catalogItems.value = [];
        catalogError.value = messageFromUnknown(error, 'Unable to load the approved medicines catalog.');
    } finally {
        catalogLoading.value = false;
    }
}

watch(open, (isOpen) => {
    if (!isOpen) return;
    resetForm();
    void loadCatalog();
});

const canSubmit = computed(
    () => patientId.value.trim() !== '' && form.catalogItemId.trim() !== '' && !submitLoading.value,
);

async function resolveSafetyDecision(payload: {
    approvedMedicineCatalogItemId: string;
    medicationCode: string;
    medicationName: string;
    dosageInstruction: string;
    clinicalIndication: string;
    quantityPrescribed: number;
}): Promise<MedicationSafetyContinuationDecision | null> {
    const summary = await fetchPatientMedicationSafetySummary({
        patientId: patientId.value.trim(),
        approvedMedicineCatalogItemId: payload.approvedMedicineCatalogItemId,
        medicationCode: payload.medicationCode,
        medicationName: payload.medicationName,
        dosageInstruction: payload.dosageInstruction,
        clinicalIndication: payload.clinicalIndication,
        quantityPrescribed: payload.quantityPrescribed,
    });

    if (!summary) {
        return { acknowledged: false, overrideCode: null, overrideReason: null };
    }

    if (summary.blockers.length > 0) {
        formError.value = `Medication safety blockers detected: ${summary.blockers.join(' ')} Open the pharmacy orders module to apply a clinical override.`;
        notifyError(formError.value);
        return null;
    }

    if (summary.warnings.length === 0) {
        return { acknowledged: false, overrideCode: null, overrideReason: null };
    }

    const confirmed = await requestConfirmation({
        title: 'Medication safety review',
        description: 'Review medication safety warnings before placing this order.',
        details: summary.warnings,
        cancelLabel: 'Review warnings',
        confirmLabel: 'Acknowledge and place order',
    });

    if (!confirmed) {
        return null;
    }

    return { acknowledged: true, overrideCode: null, overrideReason: null };
}

async function submit(): Promise<void> {
    if (submitLoading.value) return;

    fieldErrors.value = {};
    formError.value = null;

    const item = selectedCatalogItem.value;
    if (!item) {
        fieldErrors.value = { approvedMedicineCatalogItemId: ['Select an approved medicine before placing this order.'] };
        return;
    }

    if (!form.dosageInstruction.trim()) {
        fieldErrors.value = { dosageInstruction: ['Enter the dosage instruction.'] };
        return;
    }

    if (!form.clinicalIndication.trim()) {
        fieldErrors.value = { clinicalIndication: ['Enter the clinical indication.'] };
        return;
    }

    const quantity = Number(form.quantityPrescribed);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        fieldErrors.value = { quantityPrescribed: ['Enter a prescribed quantity greater than zero.'] };
        return;
    }

    submitLoading.value = true;

    try {
        const payload = {
            approvedMedicineCatalogItemId: item.id,
            medicationCode: item.code?.trim() ?? '',
            medicationName: item.name?.trim() ?? '',
            dosageInstruction: form.dosageInstruction.trim(),
            clinicalIndication: form.clinicalIndication.trim(),
            quantityPrescribed: quantity,
            dispensingNotes: form.dispensingNotes.trim(),
        };

        const context = { patientId: patientId.value.trim() };

        const duplicateResult = await checkPharmacyDuplicate(context, payload);
        const title = payload.medicationName || payload.medicationCode || 'this medicine';
        const details = duplicateCheckDetails(duplicateResult);

        if (details.length > 0) {
            const confirmed = await requestConfirmation({
                title: `Duplicate advisory for ${title}`,
                description:
                    duplicateResult.severity === 'critical'
                        ? 'An active order for this item already exists for this patient.'
                        : 'Similar orders were found for this patient recently.',
                details,
                cancelLabel: 'Review existing orders',
                confirmLabel: 'Continue ordering',
                confirmVariant: duplicateResult.severity === 'critical' ? 'destructive' : 'default',
            });

            if (!confirmed) {
                return;
            }
        }

        const safetyDecision = await resolveSafetyDecision(payload);
        if (safetyDecision === null) {
            return;
        }

        const response = await createPharmacyInlineOrder(context, payload, { safetyDecision });
        const orderNumber = (response.data.orderNumber as string | null | undefined)?.trim() || 'pharmacy order';

        emit('created', orderNumber);
        open.value = false;
    } catch (error) {
        if (error instanceof ApiClientError && error.status === 422) {
            const responsePayload = error.payload as { errors?: Record<string, string[]> } | null;
            if (responsePayload?.errors) {
                fieldErrors.value = responsePayload.errors;
                formError.value = Object.values(fieldErrors.value)[0]?.[0] ?? 'Review the order details and try again.';
                return;
            }
        }

        formError.value = messageFromUnknown(error, 'Unable to place this pharmacy order.');
        notifyError(formError.value);
    } finally {
        submitLoading.value = false;
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl" @open-auto-focus="(event: Event) => event.preventDefault()">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>Create pharmacy order</SheetTitle>
                <SheetDescription>Place a medication order for a patient.</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <Alert v-if="formError" variant="destructive">
                    <AlertTitle>Order needs attention</AlertTitle>
                    <AlertDescription>{{ formError }}</AlertDescription>
                </Alert>

                <Alert v-else-if="catalogError" variant="destructive">
                    <AlertTitle>Catalog unavailable</AlertTitle>
                    <AlertDescription>{{ catalogError }}</AlertDescription>
                </Alert>

                <PatientLookupField
                    v-model="patientId"
                    input-id="pharmacy-order-create-patient"
                    label="Patient"
                    required
                    :error-message="fieldError('patientId')"
                />

                <div v-if="catalogLoading" class="py-6 text-sm text-muted-foreground">Loading catalog…</div>

                <template v-else>
                    <SearchableSelectField
                        v-model="form.catalogItemId"
                        input-id="pharmacy-order-create-catalog"
                        label="Approved medicine"
                        :options="catalogOptions"
                        placeholder="Search catalog…"
                        search-placeholder="Search by code or name"
                        :error-message="fieldError('approvedMedicineCatalogItemId')"
                        required
                    />

                    <div class="space-y-1.5">
                        <Label for="pharmacy-order-create-dose">Dosage instruction</Label>
                        <Input id="pharmacy-order-create-dose" v-model="form.dosageInstruction" placeholder="1 tablet orally twice daily" />
                        <p v-if="fieldError('dosageInstruction')" class="text-sm text-destructive">{{ fieldError('dosageInstruction') }}</p>
                    </div>

                    <div class="space-y-1.5">
                        <Label for="pharmacy-order-create-qty">Quantity prescribed</Label>
                        <Input id="pharmacy-order-create-qty" v-model="form.quantityPrescribed" type="number" min="1" step="1" />
                        <p v-if="fieldError('quantityPrescribed')" class="text-sm text-destructive">{{ fieldError('quantityPrescribed') }}</p>
                    </div>

                    <div class="space-y-1.5">
                        <Label for="pharmacy-order-create-indication">Clinical indication</Label>
                        <Textarea id="pharmacy-order-create-indication" v-model="form.clinicalIndication" rows="3" placeholder="Diagnosis or treatment reason" />
                        <p v-if="fieldError('clinicalIndication')" class="text-sm text-destructive">{{ fieldError('clinicalIndication') }}</p>
                    </div>

                    <EncounterMedicationSafetyPanel
                        :patient-id="patientId"
                        :approved-medicine-catalog-item-id="form.catalogItemId"
                        :medication-code="safetyMedicationCode"
                        :medication-name="safetyMedicationName"
                        :dosage-instruction="form.dosageInstruction"
                        :clinical-indication="form.clinicalIndication"
                        :quantity-prescribed="form.quantityPrescribed"
                    />

                    <div class="space-y-1.5">
                        <Label for="pharmacy-order-create-notes">Dispensing notes (optional)</Label>
                        <Textarea id="pharmacy-order-create-notes" v-model="form.dispensingNotes" rows="2" placeholder="Optional pharmacy notes" />
                    </div>
                </template>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ submitLoading ? 'Placing order…' : 'Place order' }}
                </Button>
            </SheetFooter>
        </SheetContent>

        <ConfirmationDialog
            :open="confirmationDialogState.open"
            :title="confirmationDialogState.title"
            :description="confirmationDialogState.description"
            :details="confirmationDialogState.details"
            :confirm-label="confirmationDialogState.confirmLabel"
            :cancel-label="confirmationDialogState.cancelLabel"
            :confirm-variant="confirmationDialogState.confirmVariant"
            :content-class="confirmationDialogState.contentClass"
            @update:open="updateConfirmationDialogOpen"
            @confirm="confirmDialogAction()"
        />
    </Sheet>
</template>
