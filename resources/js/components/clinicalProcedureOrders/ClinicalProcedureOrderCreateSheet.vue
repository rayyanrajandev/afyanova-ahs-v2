<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import ConfirmationDialog from '@/components/workflow/ConfirmationDialog.vue';
import { useConfirmationDialog } from '@/composables/useConfirmationDialog';
import { ApiClientError } from '@/lib/apiClient';
import {
    catalogItemLabel,
    checkClinicalProcedureDuplicate,
    createClinicalProcedureInlineOrder,
    duplicateCheckDetails,
    encounterInlineOrderModeLabel,
    fetchClinicalProcedureCatalog,
    procedureSettingOptions,
    type ClinicalCatalogItem,
    type EncounterInlineOrderLinkageContext,
} from '@/lib/encounterInlineOrders';
import { messageFromUnknown, notifyError } from '@/lib/notify';

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
    procedureSetting: 'outpatient',
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
    form.procedureSetting = 'outpatient';
    form.clinicalIndication = '';
    fieldErrors.value = {};
    formError.value = null;
    catalogError.value = null;
}

async function loadCatalog(): Promise<void> {
    catalogLoading.value = true;
    catalogError.value = null;

    try {
        catalogItems.value = await fetchClinicalProcedureCatalog();
    } catch (error) {
        catalogItems.value = [];
        catalogError.value = messageFromUnknown(error, 'Unable to load the clinical procedure catalog.');
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

        const setting = item.category?.trim().toLowerCase() ?? '';
        if (procedureSettingOptions.some((option) => option.value === setting)) {
            form.procedureSetting = setting;
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
        fieldErrors.value = { clinicalProcedureCatalogItemId: ['Select an active clinical procedure before placing this order.'] };
        return;
    }

    if (!form.clinicalIndication.trim()) {
        fieldErrors.value = { clinicalIndication: ['Enter the clinical indication.'] };
        return;
    }

    submitLoading.value = true;

    try {
        const payload = {
            clinicalProcedureCatalogItemId: item.id,
            procedureCode: item.code?.trim() ?? '',
            procedureSetting: form.procedureSetting,
            procedureDescription: item.name?.trim() ?? '',
            clinicalIndication: form.clinicalIndication.trim(),
        };

        const context = { patientId: patientId.value.trim() };

        const duplicateResult = await checkClinicalProcedureDuplicate(context, payload);
        const title = payload.procedureDescription || payload.procedureCode || 'this clinical procedure';
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

        const response = await createClinicalProcedureInlineOrder(context, payload, {
            replacesOrderId: props.linkage?.mode === 'reorder' ? props.linkage.sourceOrderId : null,
            addOnToOrderId: props.linkage?.mode === 'add_on' ? props.linkage.sourceOrderId : null,
        });
        const orderNumber = (response.data.orderNumber as string | null | undefined)?.trim() || 'clinical procedure order';

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

        formError.value = messageFromUnknown(error, 'Unable to place this clinical procedure order.');
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
                <SheetTitle>{{ linkage ? linkageModeLabel : 'Create clinical procedure order' }}</SheetTitle>
                <SheetDescription>{{ linkageDescription ?? 'Place a clinical procedure order for a patient.' }}</SheetDescription>
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
                    input-id="clinical-procedure-order-create-patient"
                    label="Patient"
                    required
                    :error-message="fieldError('patientId')"
                />

                <div v-if="catalogLoading" class="py-6 text-sm text-muted-foreground">Loading catalog…</div>

                <template v-else>
                    <SearchableSelectField
                        v-model="form.catalogItemId"
                        input-id="clinical-procedure-order-create-catalog"
                        label="Clinical procedure"
                        :options="catalogOptions"
                        placeholder="Search catalog…"
                        search-placeholder="Search by code or name"
                        :error-message="fieldError('clinicalProcedureCatalogItemId')"
                        required
                    />

                    <div class="grid gap-2">
                        <Label for="clinical-procedure-order-create-setting">Procedure setting</Label>
                        <Select v-model="form.procedureSetting">
                            <SelectTrigger id="clinical-procedure-order-create-setting" class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="option in procedureSettingOptions" :key="option.value" :value="option.value">
                                    {{ option.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div class="grid gap-2">
                        <Label for="clinical-procedure-order-create-indication">Clinical indication</Label>
                        <Textarea id="clinical-procedure-order-create-indication" v-model="form.clinicalIndication" class="min-h-20" placeholder="Reason for procedure…" />
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
