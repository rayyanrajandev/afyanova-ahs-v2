<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import ConfirmationDialog from '@/components/workflow/ConfirmationDialog.vue';
import { useConfirmationDialog } from '@/composables/useConfirmationDialog';
import { ApiClientError } from '@/lib/apiClient';
import {
    catalogItemLabel,
    checkRadiologyDuplicate,
    createRadiologyInlineOrder,
    duplicateCheckDetails,
    encounterInlineOrderModeLabel,
    fetchRadiologyProcedureCatalog,
    radiologyModalityOptions,
    type ClinicalCatalogItem,
    type EncounterInlineOrderLinkageContext,
} from '@/lib/encounterInlineOrders';
import { messageFromUnknown, notifyError } from '@/lib/notify';

/**
 * Phase 1 of reports/order-creation-v2-modernization-plan.md — the first of
 * four order-type creation Sheets (radiology/pharmacy/theatre/laboratory)
 * that close the gap left by radiology-orders/IndexV2.vue's "Create order"
 * button, which today only links out to the legacy page's inline form.
 *
 * Deliberately reuses the exact catalog fetch/duplicate-check/create
 * functions EncounterInlineOrderPanel.vue already calls from
 * @/lib/encounterInlineOrders — same backend endpoint, same payload shape,
 * so this isn't a second implementation of order creation, just a second
 * entry point (standalone list page vs. inside an active encounter).
 *
 * No appointment/admission/service-request context picker in this first
 * pass — StoreRadiologyOrderRequest already treats those as nullable, so a
 * patient-only order (an ad-hoc/referral-style imaging request not tied to
 * a specific visit) is a fully valid, real use case, not a stub. Context
 * linking can be added later without changing this component's shape if a
 * real need for it shows up once this ships.
 *
 * Reorder/add-on: see LaboratoryOrderCreateSheet.vue's docblock — same
 * `linkage` prop shape, RadiologyOrderDetailSheet emits it instead of a
 * separate legacy-style detail-view button set.
 */
const props = defineProps<{
    initialPatientId?: string | null;
    linkage?: EncounterInlineOrderLinkageContext | null;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    created: [orderNumber: string];
}>();

const linkageModeLabel = computed(() => encounterInlineOrderModeLabel(props.linkage?.mode ?? 'new'));
const linkageDescription = computed(() => {
    if (props.linkage?.mode === 'reorder') {
        return `This creates a replacement linked to ${props.linkage.sourceLabel}.`;
    }
    if (props.linkage?.mode === 'add_on') {
        return `This creates an add-on linked to ${props.linkage.sourceLabel}.`;
    }
    return null;
});

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
    modality: 'xray',
    clinicalIndication: '',
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

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

function resetForm(): void {
    patientId.value = '';
    form.catalogItemId = '';
    form.modality = 'xray';
    form.clinicalIndication = '';
    fieldErrors.value = {};
    formError.value = null;
    catalogError.value = null;
}

async function loadCatalog(): Promise<void> {
    catalogLoading.value = true;
    catalogError.value = null;

    try {
        catalogItems.value = await fetchRadiologyProcedureCatalog();
    } catch (error) {
        catalogItems.value = [];
        catalogError.value = messageFromUnknown(error, 'Unable to load the radiology procedure catalog.');
    } finally {
        catalogLoading.value = false;
    }
}

watch(open, (isOpen) => {
    if (!isOpen) return;
    resetForm();
    if (props.initialPatientId) {
        patientId.value = props.initialPatientId;
    }
    void loadCatalog();
});

watch(
    () => form.catalogItemId,
    () => {
        const item = selectedCatalogItem.value;
        if (!item) return;

        const modality = item.category?.trim().toLowerCase() ?? '';
        if (radiologyModalityOptions.some((option) => option.value === modality)) {
            form.modality = modality;
        }
    },
);

const canSubmit = computed(
    () => patientId.value.trim() !== '' && form.catalogItemId.trim() !== '' && !submitLoading.value,
);

async function submit(): Promise<void> {
    if (submitLoading.value) return;

    fieldErrors.value = {};
    formError.value = null;

    const item = selectedCatalogItem.value;
    if (!item) {
        fieldErrors.value = { radiologyProcedureCatalogItemId: ['Select an active imaging procedure before placing this order.'] };
        return;
    }

    if (!form.clinicalIndication.trim()) {
        fieldErrors.value = { clinicalIndication: ['Enter the clinical indication.'] };
        return;
    }

    submitLoading.value = true;

    try {
        const payload = {
            radiologyProcedureCatalogItemId: item.id,
            procedureCode: item.code?.trim() ?? '',
            modality: form.modality,
            studyDescription: item.name?.trim() ?? '',
            clinicalIndication: form.clinicalIndication.trim(),
        };

        const context = { patientId: patientId.value.trim() };

        const duplicateResult = await checkRadiologyDuplicate(context, payload);
        const title = payload.studyDescription || payload.procedureCode || 'this imaging study';
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

        const response = await createRadiologyInlineOrder(context, payload, {
            replacesOrderId: props.linkage?.mode === 'reorder' ? props.linkage.sourceOrderId : null,
            addOnToOrderId: props.linkage?.mode === 'add_on' ? props.linkage.sourceOrderId : null,
        });
        const orderNumber = (response.data.orderNumber as string | null | undefined)?.trim() || 'imaging order';

        emit('created', orderNumber);
        open.value = false;
    } catch (error) {
        if (error instanceof ApiClientError && error.status === 422) {
            const payload = error.payload as { errors?: Record<string, string[]> } | null;
            if (payload?.errors) {
                fieldErrors.value = payload.errors;
                formError.value = Object.values(fieldErrors.value)[0]?.[0] ?? 'Review the order details and try again.';
                return;
            }
        }

        formError.value = messageFromUnknown(error, 'Unable to place this radiology order.');
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
                <SheetTitle>{{ linkage ? linkageModeLabel : 'Create radiology order' }}</SheetTitle>
                <SheetDescription>{{ linkageDescription ?? 'Place an imaging order for a patient.' }}</SheetDescription>
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
                    input-id="radiology-order-create-patient"
                    label="Patient"
                    required
                    :error-message="fieldError('patientId')"
                />

                <div v-if="catalogLoading" class="py-6 text-sm text-muted-foreground">Loading catalog…</div>

                <template v-else>
                    <SearchableSelectField
                        v-model="form.catalogItemId"
                        input-id="radiology-order-create-catalog"
                        label="Imaging procedure"
                        :options="catalogOptions"
                        placeholder="Search catalog…"
                        search-placeholder="Search by code or name"
                        :error-message="fieldError('radiologyProcedureCatalogItemId')"
                        required
                    />

                    <div class="grid gap-2">
                        <Label for="radiology-order-create-modality">Modality</Label>
                        <Select v-model="form.modality">
                            <SelectTrigger id="radiology-order-create-modality" class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="option in radiologyModalityOptions" :key="option.value" :value="option.value">
                                    {{ option.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div class="grid gap-2">
                        <Label for="radiology-order-create-indication">Clinical indication</Label>
                        <Textarea id="radiology-order-create-indication" v-model="form.clinicalIndication" class="min-h-20" placeholder="Reason for imaging…" />
                        <p v-if="fieldError('clinicalIndication')" class="text-xs text-destructive">{{ fieldError('clinicalIndication') }}</p>
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
