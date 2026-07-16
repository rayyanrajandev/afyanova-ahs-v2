<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import ConfirmationDialog from '@/components/workflow/ConfirmationDialog.vue';
import { useConfirmationDialog } from '@/composables/useConfirmationDialog';
import { apiPost, ApiClientError } from '@/lib/apiClient';
import {
    catalogItemLabel,
    checkLaboratoryDuplicate,
    duplicateCheckDetails,
    fetchLabTestCatalog,
    labTestCatalogSpecimenType,
    laboratoryPriorityOptions,
    type ClinicalCatalogItem,
} from '@/lib/encounterInlineOrders';
import { messageFromUnknown, notifyError } from '@/lib/notify';

/**
 * Phase 4 of reports/order-creation-v2-modernization-plan.md — same shape
 * as Radiology/Pharmacy/Theatre (Phases 1-3), reusing the same catalog
 * fetch/duplicate-check functions EncounterInlineOrderPanel.vue already
 * calls, but NOT its create call: EncounterInlineOrderPanel always uses
 * entryMode 'active' (a clinician-in-an-encounter placing an order that
 * takes effect immediately), while the legacy standalone page's own
 * createOrder() does a draft->sign two-step (POST entryMode:'draft', then
 * POST .../sign) presented to the user as a single "Place order" action —
 * preserved here exactly, not simplified to one step, per the plan's Q2.
 * Submits directly via apiPost rather than createLaboratoryInlineOrder()
 * (which hardcodes entryMode:'active') to avoid touching that shared
 * function's behavior for the encounter workflow.
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
    priority: 'routine' as 'routine' | 'urgent' | 'stat',
    specimenType: '',
    clinicalNotes: '',
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
    form.priority = 'routine';
    form.specimenType = '';
    form.clinicalNotes = '';
    fieldErrors.value = {};
    formError.value = null;
    catalogError.value = null;
}

async function loadCatalog(): Promise<void> {
    catalogLoading.value = true;
    catalogError.value = null;

    try {
        catalogItems.value = await fetchLabTestCatalog();
    } catch (error) {
        catalogItems.value = [];
        catalogError.value = messageFromUnknown(error, 'Unable to load the laboratory test catalog.');
    } finally {
        catalogLoading.value = false;
    }
}

watch(open, (isOpen) => {
    if (!isOpen) return;
    resetForm();
    void loadCatalog();
});

watch(
    () => form.catalogItemId,
    () => {
        const item = selectedCatalogItem.value;
        if (!item) {
            form.specimenType = '';
            return;
        }

        const specimen = labTestCatalogSpecimenType(item);
        if (specimen) {
            form.specimenType = specimen;
        }
    },
);

const canSubmit = computed(
    () => patientId.value.trim() !== '' && form.catalogItemId.trim() !== '' && !submitLoading.value,
);

function applyFieldErrors(error: unknown, fallback: string): boolean {
    if (error instanceof ApiClientError && error.status === 422) {
        const payload = error.payload as { errors?: Record<string, string[]> } | null;
        if (payload?.errors) {
            fieldErrors.value = payload.errors;
            formError.value = Object.values(fieldErrors.value)[0]?.[0] ?? fallback;
            return true;
        }
    }

    formError.value = messageFromUnknown(error, fallback);
    notifyError(formError.value);
    return false;
}

async function submit(): Promise<void> {
    if (submitLoading.value) return;

    fieldErrors.value = {};
    formError.value = null;

    const item = selectedCatalogItem.value;
    if (!item) {
        fieldErrors.value = { labTestCatalogItemId: ['Select an active laboratory test before placing this order.'] };
        return;
    }

    submitLoading.value = true;

    try {
        const payload = {
            labTestCatalogItemId: item.id,
            testCode: item.code?.trim() ?? '',
            testName: item.name?.trim() ?? '',
            priority: form.priority,
            specimenType: form.specimenType.trim(),
            clinicalNotes: form.clinicalNotes.trim(),
        };

        const context = { patientId: patientId.value.trim() };

        const duplicateResult = await checkLaboratoryDuplicate(context, payload);
        const title = payload.testName || payload.testCode || 'this laboratory test';
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

        // Draft -> sign, matching the legacy page's createOrder() exactly:
        // one user-facing action, two backend calls under the hood.
        const draftResponse = await apiPost<{ data: Record<string, unknown> }>('/laboratory-orders', {
            body: {
                patientId: context.patientId,
                appointmentId: null,
                admissionId: null,
                serviceRequestId: null,
                entryMode: 'draft',
                labTestCatalogItemId: payload.labTestCatalogItemId,
                testCode: payload.testCode || null,
                testName: payload.testName || null,
                priority: payload.priority,
                specimenType: payload.specimenType || null,
                clinicalNotes: payload.clinicalNotes || null,
            },
        });

        const draftId = draftResponse.data.id as string | undefined;
        if (!draftId) {
            formError.value = 'Draft was saved but no order id was returned. Check the worklist before retrying.';
            notifyError(formError.value);
            return;
        }

        const signResponse = await apiPost<{ data: Record<string, unknown> }>(`/laboratory-orders/${draftId}/sign`);
        const orderNumber = (signResponse.data.orderNumber as string | null | undefined)?.trim() || 'laboratory order';

        emit('created', orderNumber);
        open.value = false;
    } catch (error) {
        applyFieldErrors(error, 'Unable to place this laboratory order.');
    } finally {
        submitLoading.value = false;
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl" @open-auto-focus="(event: Event) => event.preventDefault()">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>Create laboratory order</SheetTitle>
                <SheetDescription>Place a laboratory test order for a patient.</SheetDescription>
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
                    input-id="laboratory-order-create-patient"
                    label="Patient"
                    required
                    :error-message="fieldError('patientId')"
                />

                <div v-if="catalogLoading" class="py-6 text-sm text-muted-foreground">Loading catalog…</div>

                <template v-else>
                    <SearchableSelectField
                        v-model="form.catalogItemId"
                        input-id="laboratory-order-create-catalog"
                        label="Laboratory test"
                        :options="catalogOptions"
                        placeholder="Search catalog…"
                        search-placeholder="Search by code or name"
                        :error-message="fieldError('labTestCatalogItemId')"
                        required
                    />

                    <div class="grid grid-cols-2 gap-3">
                        <div class="grid gap-2">
                            <Label for="laboratory-order-create-priority">Priority</Label>
                            <Select v-model="form.priority">
                                <SelectTrigger id="laboratory-order-create-priority" class="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="option in laboratoryPriorityOptions" :key="option.value" :value="option.value">
                                        {{ option.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div class="grid gap-2">
                            <Label for="laboratory-order-create-specimen">Specimen type</Label>
                            <Input id="laboratory-order-create-specimen" v-model="form.specimenType" placeholder="Blood, urine, swab…" />
                            <p v-if="fieldError('specimenType')" class="text-xs text-destructive">{{ fieldError('specimenType') }}</p>
                        </div>
                    </div>

                    <div class="grid gap-2">
                        <Label for="laboratory-order-create-notes">Clinical indication</Label>
                        <Textarea id="laboratory-order-create-notes" v-model="form.clinicalNotes" class="min-h-20" placeholder="Reason for test or clinical question…" />
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
