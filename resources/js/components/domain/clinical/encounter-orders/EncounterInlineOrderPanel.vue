<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import EncounterMedicationSafetyPanel from '@/components/domain/clinical/EncounterMedicationSafetyPanel.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import ConfirmationDialog from '@/components/workflow/ConfirmationDialog.vue';
import { useConfirmationDialog } from '@/composables/useConfirmationDialog';
import { ApiClientError } from '@/lib/apiClient';
import {
    catalogItemLabel,
    checkLaboratoryDuplicate,
    checkPharmacyDuplicate,
    checkRadiologyDuplicate,
    createLaboratoryInlineOrder,
    createPharmacyInlineOrder,
    createRadiologyInlineOrder,
    duplicateCheckDetails,
    encounterInlineOrderModeLabel,
    encounterInlineOrderTypeLabel,
    fetchApprovedMedicinesCatalog,
    fetchLabTestCatalog,
    fetchPatientMedicationSafetySummary,
    fetchRadiologyProcedureCatalog,
    labTestCatalogSpecimenType,
    laboratoryPriorityOptions,
    radiologyModalityOptions,
    type ClinicalCatalogItem,
    type EncounterDuplicateCheckResult,
    type EncounterInlineOrderLinkageContext,
    type EncounterInlineOrderType,
    type EncounterOrderContext,
    type MedicationSafetyContinuationDecision,
} from '@/lib/encounterInlineOrders';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

const props = defineProps<{
    orderType: EncounterInlineOrderType;
    context: EncounterOrderContext;
    linkage?: EncounterInlineOrderLinkageContext | null;
}>();

const emit = defineEmits<{
    close: [];
    created: [type: EncounterInlineOrderType];
}>();

const {
    confirmationDialogState,
    requestConfirmation,
    updateConfirmationDialogOpen,
    confirmDialogAction,
} = useConfirmationDialog();

const catalogLoading = ref(false);
const catalogError = ref<string | null>(null);
const catalogItems = ref<ClinicalCatalogItem[]>([]);
const submitLoading = ref(false);
const fieldErrors = ref<Record<string, string[]>>({});
const formError = ref<string | null>(null);

const labForm = reactive({
    catalogItemId: '',
    priority: 'routine' as 'routine' | 'urgent' | 'stat',
    specimenType: '',
    clinicalNotes: '',
});

const pharmacyForm = reactive({
    catalogItemId: '',
    dosageInstruction: '',
    clinicalIndication: '',
    quantityPrescribed: '1',
    dispensingNotes: '',
});

const radiologyForm = reactive({
    catalogItemId: '',
    modality: 'xray',
    clinicalIndication: '',
});

const selectedCatalogItem = computed(() =>
    catalogItems.value.find((item) => item.id === activeCatalogItemId.value) ?? null,
);

const activeCatalogItemId = computed(() => {
    switch (props.orderType) {
        case 'laboratory':
            return labForm.catalogItemId;
        case 'pharmacy':
            return pharmacyForm.catalogItemId;
        case 'radiology':
            return radiologyForm.catalogItemId;
    }
});

const catalogOptions = computed(() =>
    catalogItems.value.map((item) => ({
        value: item.id,
        label: catalogItemLabel(item),
        keywords: [item.code, item.name, item.category]
            .filter((k): k is string => Boolean(k)),
    })),
);

const catalogItemModel = computed({
    get() {
        switch (props.orderType) {
            case 'laboratory':
                return labForm.catalogItemId;
            case 'pharmacy':
                return pharmacyForm.catalogItemId;
            case 'radiology':
                return radiologyForm.catalogItemId;
        }
    },
    set(value: string) {
        switch (props.orderType) {
            case 'laboratory':
                labForm.catalogItemId = value;
                break;
            case 'pharmacy':
                pharmacyForm.catalogItemId = value;
                break;
            case 'radiology':
                radiologyForm.catalogItemId = value;
                break;
        }
    },
});

const catalogFieldName = computed(() => {
    switch (props.orderType) {
        case 'laboratory':
            return 'labTestCatalogItemId';
        case 'pharmacy':
            return 'approvedMedicineCatalogItemId';
        case 'radiology':
            return 'radiologyProcedureCatalogItemId';
    }
});

const catalogFieldLabel = computed(() => {
    switch (props.orderType) {
        case 'laboratory':
            return 'Laboratory test';
        case 'pharmacy':
            return 'Approved medicine';
        case 'radiology':
            return 'Imaging procedure';
    }
});

const panelTitle = computed(() => encounterInlineOrderTypeLabel(props.orderType));
const panelModeLabel = computed(() =>
    encounterInlineOrderModeLabel(props.linkage?.mode ?? 'new'),
);
const panelDescription = computed(() => {
    if (props.linkage?.mode === 'reorder') {
        return `Creates a replacement linked to ${props.linkage.sourceLabel}. The encounter note remains open.`;
    }

    if (props.linkage?.mode === 'add_on') {
        return `Creates an add-on linked to ${props.linkage.sourceLabel}. The encounter note remains open.`;
    }

    return 'This order stays in the current visit context. The encounter note remains open.';
});
const submitButtonLabel = computed(() => {
    if (submitLoading.value) return 'Placing order…';
    if (props.linkage?.mode === 'reorder') return 'Place replacement';
    if (props.linkage?.mode === 'add_on') return 'Place linked order';
    return 'Place order';
});
const createLinkageOptions = computed(() => ({
    replacesOrderId:
        props.linkage?.mode === 'reorder' ? props.linkage.sourceOrderId : null,
    addOnToOrderId:
        props.linkage?.mode === 'add_on' ? props.linkage.sourceOrderId : null,
}));

const pharmacySafetyCatalogItemId = computed(() =>
    props.orderType === 'pharmacy' ? pharmacyForm.catalogItemId.trim() : '',
);
const pharmacySafetyMedicationCode = computed(
    () => selectedCatalogItem.value?.code?.trim() ?? '',
);
const pharmacySafetyMedicationName = computed(
    () => selectedCatalogItem.value?.name?.trim() ?? '',
);

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

function resetForms() {
    labForm.catalogItemId = '';
    labForm.priority = 'routine';
    labForm.specimenType = '';
    labForm.clinicalNotes = '';
    pharmacyForm.catalogItemId = '';
    pharmacyForm.dosageInstruction = '';
    pharmacyForm.clinicalIndication = '';
    pharmacyForm.quantityPrescribed = '1';
    pharmacyForm.dispensingNotes = '';
    radiologyForm.catalogItemId = '';
    radiologyForm.modality = 'xray';
    radiologyForm.clinicalIndication = '';
    fieldErrors.value = {};
    formError.value = null;
}

async function loadCatalog() {
    catalogLoading.value = true;
    catalogError.value = null;

    try {
        if (props.orderType === 'laboratory') {
            catalogItems.value = await fetchLabTestCatalog();
        } else if (props.orderType === 'pharmacy') {
            catalogItems.value = await fetchApprovedMedicinesCatalog();
        } else {
            catalogItems.value = await fetchRadiologyProcedureCatalog();
        }
    } catch (error) {
        catalogItems.value = [];
        catalogError.value = messageFromUnknown(
            error,
            'Unable to load the clinical catalog for this order type.',
        );
    } finally {
        catalogLoading.value = false;
    }
}

watch(
    () => props.orderType,
    () => {
        resetForms();
        void loadCatalog();
    },
    { immediate: true },
);

watch(
    () => labForm.catalogItemId,
    () => {
        if (props.orderType !== 'laboratory') return;

        const item = selectedCatalogItem.value;
        if (!item) {
            labForm.specimenType = '';
            return;
        }

        const specimen = labTestCatalogSpecimenType(item);
        if (specimen) {
            labForm.specimenType = specimen;
        }
    },
);

watch(
    () => radiologyForm.catalogItemId,
    () => {
        if (props.orderType !== 'radiology') return;

        const item = selectedCatalogItem.value;
        if (!item) return;

        const modality = item.category?.trim().toLowerCase() ?? '';
        if (radiologyModalityOptions.some((option) => option.value === modality)) {
            radiologyForm.modality = modality;
        }
    },
);

async function confirmDuplicateCheck(
    title: string,
    result: EncounterDuplicateCheckResult,
): Promise<boolean> {
    const details = duplicateCheckDetails(result);
    if (!details.length) {
        return true;
    }

    return requestConfirmation({
        title,
        description:
            result.severity === 'critical'
                ? 'An active order for this item already exists in the current encounter.'
                : 'Similar orders were found for this patient recently.',
        details,
        cancelLabel: 'Review existing orders',
        confirmLabel: 'Continue ordering',
        confirmVariant: result.severity === 'critical' ? 'destructive' : 'default',
    });
}

async function resolvePharmacySafetyDecision(
    payload: {
        approvedMedicineCatalogItemId: string;
        medicationCode: string;
        medicationName: string;
        dosageInstruction: string;
        clinicalIndication: string;
        quantityPrescribed: number;
    },
): Promise<MedicationSafetyContinuationDecision | null> {
    const summary = await fetchPatientMedicationSafetySummary({
        patientId: props.context.patientId,
        appointmentId: props.context.appointmentId,
        admissionId: props.context.admissionId,
        approvedMedicineCatalogItemId: payload.approvedMedicineCatalogItemId,
        medicationCode: payload.medicationCode,
        medicationName: payload.medicationName,
        dosageInstruction: payload.dosageInstruction,
        clinicalIndication: payload.clinicalIndication,
        quantityPrescribed: payload.quantityPrescribed,
    });

    if (!summary) {
        return {
            acknowledged: false,
            overrideCode: null,
            overrideReason: null,
        };
    }

    if (summary.blockers.length > 0) {
        formError.value = `Medication safety blockers detected: ${summary.blockers.join(' ')} Open the pharmacy orders module to apply a clinical override.`;
        notifyError(formError.value);
        return null;
    }

    if (summary.warnings.length === 0) {
        return {
            acknowledged: false,
            overrideCode: null,
            overrideReason: null,
        };
    }

    const confirmed = await requestConfirmation({
        title: 'Medication safety review',
        description: 'Review medication safety warnings before placing this active order.',
        details: summary.warnings,
        cancelLabel: 'Review warnings',
        confirmLabel: 'Acknowledge and place order',
    });

    if (!confirmed) {
        return null;
    }

    return {
        acknowledged: true,
        overrideCode: null,
        overrideReason: null,
    };
}

function applyValidationErrors(errors: Record<string, string[]>) {
    fieldErrors.value = errors;
    const firstMessage = Object.values(errors)[0]?.[0];
    formError.value = firstMessage ?? 'Review the order details and try again.';
}

async function submitOrder() {
    if (submitLoading.value) return;

    fieldErrors.value = {};
    formError.value = null;

    const item = selectedCatalogItem.value;
    if (!item) {
        const field =
            props.orderType === 'laboratory'
                ? 'labTestCatalogItemId'
                : props.orderType === 'pharmacy'
                  ? 'approvedMedicineCatalogItemId'
                  : 'radiologyProcedureCatalogItemId';
        applyValidationErrors({
            [field]: ['Select an active catalog item before placing this order.'],
        });
        return;
    }

    submitLoading.value = true;

    try {
        if (props.orderType === 'laboratory') {
            const payload = {
                labTestCatalogItemId: item.id,
                testCode: item.code?.trim() ?? '',
                testName: item.name?.trim() ?? '',
                priority: labForm.priority,
                specimenType: labForm.specimenType.trim(),
                clinicalNotes: labForm.clinicalNotes.trim(),
            };

            const duplicateResult = await checkLaboratoryDuplicate(
                props.context,
                payload,
            );
            const title =
                payload.testName || payload.testCode || 'this laboratory test';
            if (!(await confirmDuplicateCheck(`Duplicate advisory for ${title}`, duplicateResult))) {
                return;
            }

            const response = await createLaboratoryInlineOrder(
                props.context,
                payload,
                createLinkageOptions.value,
            );
            const orderNumber =
                (response.data.orderNumber as string | null | undefined)?.trim() ||
                'laboratory order';
            notifySuccess(`Placed ${orderNumber}.`);
        } else if (props.orderType === 'pharmacy') {
            if (!pharmacyForm.dosageInstruction.trim()) {
                applyValidationErrors({
                    dosageInstruction: ['Enter the dosage instruction.'],
                });
                return;
            }
            if (!pharmacyForm.clinicalIndication.trim()) {
                applyValidationErrors({
                    clinicalIndication: ['Enter the clinical indication.'],
                });
                return;
            }

            const quantity = Number(pharmacyForm.quantityPrescribed);
            if (!Number.isFinite(quantity) || quantity <= 0) {
                applyValidationErrors({
                    quantityPrescribed: [
                        'Enter a prescribed quantity greater than zero.',
                    ],
                });
                return;
            }

            const payload = {
                approvedMedicineCatalogItemId: item.id,
                medicationCode: item.code?.trim() ?? '',
                medicationName: item.name?.trim() ?? '',
                dosageInstruction: pharmacyForm.dosageInstruction.trim(),
                clinicalIndication: pharmacyForm.clinicalIndication.trim(),
                quantityPrescribed: quantity,
                dispensingNotes: pharmacyForm.dispensingNotes.trim(),
            };

            const duplicateResult = await checkPharmacyDuplicate(
                props.context,
                payload,
            );
            const title =
                payload.medicationName ||
                payload.medicationCode ||
                'this medicine';
            if (!(await confirmDuplicateCheck(`Duplicate advisory for ${title}`, duplicateResult))) {
                return;
            }

            const safetyDecision = await resolvePharmacySafetyDecision(payload);
            if (safetyDecision === null) {
                return;
            }

            const response = await createPharmacyInlineOrder(
                props.context,
                payload,
                { ...createLinkageOptions.value, safetyDecision },
            );
            const orderNumber =
                (response.data.orderNumber as string | null | undefined)?.trim() ||
                'pharmacy order';
            notifySuccess(`Placed ${orderNumber}.`);
        } else {
            if (!radiologyForm.clinicalIndication.trim()) {
                applyValidationErrors({
                    clinicalIndication: ['Enter the clinical indication.'],
                });
                return;
            }

            const payload = {
                radiologyProcedureCatalogItemId: item.id,
                procedureCode: item.code?.trim() ?? '',
                modality: radiologyForm.modality,
                studyDescription: item.name?.trim() ?? '',
                clinicalIndication: radiologyForm.clinicalIndication.trim(),
            };

            const duplicateResult = await checkRadiologyDuplicate(
                props.context,
                payload,
            );
            const title =
                payload.studyDescription ||
                payload.procedureCode ||
                'this imaging study';
            if (!(await confirmDuplicateCheck(`Duplicate advisory for ${title}`, duplicateResult))) {
                return;
            }

            const response = await createRadiologyInlineOrder(
                props.context,
                payload,
                createLinkageOptions.value,
            );
            const orderNumber =
                (response.data.orderNumber as string | null | undefined)?.trim() ||
                'imaging order';
            notifySuccess(`Placed ${orderNumber}.`);
        }

        emit('created', props.orderType);
        resetForms();
    } catch (error) {
        if (error instanceof ApiClientError && error.status === 422 && error.payload?.errors) {
            applyValidationErrors(error.payload.errors as Record<string, string[]>);
            return;
        }

        formError.value = messageFromUnknown(
            error,
            'Unable to place this order from the encounter workspace.',
        );
        notifyError(formError.value);
    } finally {
        submitLoading.value = false;
    }
}

const canSubmit = computed(
    () => !submitLoading.value && !catalogLoading.value && selectedCatalogItem.value !== null,
);

defineExpose({ submitOrder, submitLoading, canSubmit });
</script>

<template>
    <div class="space-y-4">
        <Alert v-if="catalogError" variant="destructive">
            <AlertTitle>Catalog unavailable</AlertTitle>
            <AlertDescription>{{ catalogError }}</AlertDescription>
        </Alert>

        <Alert v-else-if="formError" variant="destructive">
            <AlertTitle>Order needs attention</AlertTitle>
            <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <div v-if="catalogLoading" class="py-6 text-sm text-muted-foreground">
            Loading catalog…
        </div>

        <div v-else class="space-y-4">
            <SearchableSelectField
                :input-id="`encounter-inline-${orderType}-catalog`"
                v-model="catalogItemModel"
                :label="catalogFieldLabel"
                :options="catalogOptions"
                placeholder="Search catalog…"
                search-placeholder="Search by code or name"
                :error-message="fieldError(catalogFieldName)"
                required
            />

            <template v-if="orderType === 'laboratory'">
                <div class="grid gap-2">
                    <Label for="encounter-inline-lab-priority">Priority</Label>
                    <Select v-model="labForm.priority">
                        <SelectTrigger id="encounter-inline-lab-priority" class="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem
                                v-for="option in laboratoryPriorityOptions"
                                :key="option.value"
                                :value="option.value"
                            >
                                {{ option.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="grid gap-2">
                    <Label for="encounter-inline-lab-specimen">Specimen type</Label>
                    <Input
                        id="encounter-inline-lab-specimen"
                        v-model="labForm.specimenType"
                        placeholder="Blood, urine, swab…"
                    />
                    <p v-if="fieldError('specimenType')" class="text-xs text-destructive">
                        {{ fieldError('specimenType') }}
                    </p>
                </div>
                <div class="grid gap-2">
                    <Label for="encounter-inline-lab-notes">Clinical indication</Label>
                    <Textarea
                        id="encounter-inline-lab-notes"
                        v-model="labForm.clinicalNotes"
                        class="min-h-20"
                        placeholder="Reason for test or clinical question"
                    />
                </div>
            </template>

            <template v-else-if="orderType === 'pharmacy'">
                <div class="grid gap-2">
                    <Label for="encounter-inline-pharm-dose">Dosage instruction</Label>
                    <Input
                        id="encounter-inline-pharm-dose"
                        v-model="pharmacyForm.dosageInstruction"
                        placeholder="1 tablet orally twice daily"
                    />
                    <p v-if="fieldError('dosageInstruction')" class="text-xs text-destructive">
                        {{ fieldError('dosageInstruction') }}
                    </p>
                </div>
                <div class="grid gap-2">
                    <Label for="encounter-inline-pharm-qty">Quantity prescribed</Label>
                    <Input
                        id="encounter-inline-pharm-qty"
                        v-model="pharmacyForm.quantityPrescribed"
                        type="number"
                        min="1"
                        step="1"
                    />
                    <p v-if="fieldError('quantityPrescribed')" class="text-xs text-destructive">
                        {{ fieldError('quantityPrescribed') }}
                    </p>
                </div>
                <div class="grid gap-2">
                    <Label for="encounter-inline-pharm-indication">Clinical indication</Label>
                    <Textarea
                        id="encounter-inline-pharm-indication"
                        v-model="pharmacyForm.clinicalIndication"
                        class="min-h-20"
                        placeholder="Diagnosis or treatment reason"
                    />
                    <p v-if="fieldError('clinicalIndication')" class="text-xs text-destructive">
                        {{ fieldError('clinicalIndication') }}
                    </p>
                </div>
                <EncounterMedicationSafetyPanel
                    :patient-id="context.patientId"
                    :appointment-id="context.appointmentId"
                    :admission-id="context.admissionId"
                    :approved-medicine-catalog-item-id="pharmacySafetyCatalogItemId"
                    :medication-code="pharmacySafetyMedicationCode"
                    :medication-name="pharmacySafetyMedicationName"
                    :dosage-instruction="pharmacyForm.dosageInstruction"
                    :clinical-indication="pharmacyForm.clinicalIndication"
                    :quantity-prescribed="pharmacyForm.quantityPrescribed"
                />
                <div class="grid gap-2">
                    <Label for="encounter-inline-pharm-notes">Dispensing notes</Label>
                    <Textarea
                        id="encounter-inline-pharm-notes"
                        v-model="pharmacyForm.dispensingNotes"
                        class="min-h-16"
                        placeholder="Optional pharmacy notes"
                    />
                </div>
            </template>

            <template v-else>
                <div class="grid gap-2">
                    <Label for="encounter-inline-rad-modality">Modality</Label>
                    <Select v-model="radiologyForm.modality">
                        <SelectTrigger id="encounter-inline-rad-modality" class="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem
                                v-for="option in radiologyModalityOptions"
                                :key="option.value"
                                :value="option.value"
                            >
                                {{ option.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="grid gap-2">
                    <Label for="encounter-inline-rad-indication">Clinical indication</Label>
                    <Textarea
                        id="encounter-inline-rad-indication"
                        v-model="radiologyForm.clinicalIndication"
                        class="min-h-20"
                        placeholder="Reason for imaging"
                    />
                    <p v-if="fieldError('clinicalIndication')" class="text-xs text-destructive">
                        {{ fieldError('clinicalIndication') }}
                    </p>
                </div>
            </template>
            </div>

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
    </div>
</template>
