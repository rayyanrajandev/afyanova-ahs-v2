<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    encounterInlineOrderModeLabel,
    fetchApprovedMedicinesCatalog,
    fetchPatientMedicationSafetySummary,
    fetchPharmacyMedicationAvailability,
    prescribedUnitOptions as getPrescribedUnitOptions,
    type ClinicalCatalogItem,
    type EncounterInlineOrderLinkageContext,
    type MedicationAvailability,
    type MedicationSafetyContinuationDecision,
    type PatientMedicationSafetySummary,
} from '@/lib/encounterInlineOrders';
import { calculateDispenseQuantity, generateDosageInstruction } from '@/lib/dosageCalculator';
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
 *
 * Reorder/add-on: see LaboratoryOrderCreateSheet.vue's docblock — same
 * `linkage` prop shape, PharmacyOrderDetailSheet emits it instead of a
 * separate legacy-style detail-view button set.
 *
 * Safety override (closing a real gap found in the pre-deletion audit):
 * when fetchPatientMedicationSafetySummary reports blockers, this used to
 * just error out and tell the user to "open the pharmacy orders module" —
 * pointing at the exact legacy page this whole plan exists to retire, and
 * with no way to actually proceed. The legacy page's own creation flow
 * lets a clinician pick a documented override category
 * (summary.overrideOptions, e.g. "clinical judgment override") plus a
 * written reason and continue anyway — replicated here via a small Dialog
 * (not the full multi-tab safety-review dashboard the legacy page has;
 * blockers/warnings/override fields only, matching this Sheet's existing
 * scope elsewhere).
 */
const props = defineProps<{
    initialPatientId?: string | null;
    serviceRequestId?: string | null;
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

const overrideDialogOpen = ref(false);
const overrideSummary = ref<PatientMedicationSafetySummary | null>(null);
const overrideCode = ref('');
const overrideReason = ref('');
const overrideError = ref<string | null>(null);
let overrideResolver: ((decision: MedicationSafetyContinuationDecision | null) => void) | null = null;

function requestSafetyOverride(summary: PatientMedicationSafetySummary): Promise<MedicationSafetyContinuationDecision | null> {
    overrideSummary.value = summary;
    overrideCode.value = '';
    overrideReason.value = '';
    overrideError.value = null;
    overrideDialogOpen.value = true;

    return new Promise((resolve) => {
        overrideResolver = resolve;
    });
}

function cancelSafetyOverride(): void {
    overrideDialogOpen.value = false;
    const resolver = overrideResolver;
    overrideResolver = null;
    resolver?.(null);
}

function confirmSafetyOverride(): void {
    const code = overrideCode.value.trim();
    const reason = overrideReason.value.trim();

    if (!code) {
        overrideError.value = 'Select a clinical override category for the active safety blockers.';
        return;
    }

    if (!reason) {
        overrideError.value = 'Enter a clinical override reason for the active safety blockers.';
        return;
    }

    overrideDialogOpen.value = false;
    const resolver = overrideResolver;
    overrideResolver = null;
    resolver?.({ acknowledged: true, overrideCode: code, overrideReason: reason });
}

const patientId = ref('');
const catalogLoading = ref(false);
const catalogError = ref<string | null>(null);
const catalogItems = ref<ClinicalCatalogItem[]>([]);
const submitLoading = ref(false);
const fieldErrors = ref<Record<string, string[]>>({});
const formError = ref<string | null>(null);

const medicationAvailability = ref<MedicationAvailability | null>(null);

const form = reactive({
    catalogItemId: '',
    dosageInstruction: '',
    doseQuantity: '',
    doseUnit: '',
    route: '',
    frequency: '',
    durationValue: '',
    durationUnit: '',
    prescribedUnit: '',
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

const prescribedUnitOptions = computed(() => getPrescribedUnitOptions(selectedCatalogItem.value));

const inferredStrength = computed(() => {
    const item = selectedCatalogItem.value;
    if (!item?.strength) return null;
    const s = item.strength.match(/^([\d.]+)\s*([a-zA-Z°%]+)(?:\s*\/\s*([\d.]+)\s*([a-zA-Z°%]+))?$/);
    if (!s) return null;
    return {
        numeratorValue: Number(s[1]),
        numeratorUnit: s[2],
        denominatorValue: s[3] ? Number(s[3]) : 1,
        denominatorUnit: s[4] ?? null,
    };
});

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

function resetForm(): void {
    patientId.value = '';
    form.catalogItemId = '';
    form.dosageInstruction = '';
    form.doseQuantity = '';
    form.doseUnit = '';
    form.route = '';
    form.frequency = '';
    form.durationValue = '';
    form.durationUnit = '';
    form.prescribedUnit = '';
    form.clinicalIndication = '';
    form.quantityPrescribed = '1';
    form.dispensingNotes = '';
    medicationAvailability.value = null;
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
    if (props.initialPatientId) {
        patientId.value = props.initialPatientId;
    }
    void loadCatalog();
});

watch([() => form.doseQuantity, () => form.doseUnit, () => form.route, () => form.frequency, () => form.durationValue, () => form.durationUnit], () => {
    const strength = inferredStrength.value;
    const doseQty = form.doseQuantity ? Number(form.doseQuantity) : null;
    const doseUnit = form.doseUnit?.trim();
    const route = form.route?.trim();
    const frequency = form.frequency?.trim();
    const durVal = form.durationValue ? Number(form.durationValue) : null;
    const durUnit = form.durationUnit?.trim();

    if (strength && doseQty && doseQty > 0 && doseUnit) {
        const dispense = calculateDispenseQuantity(
            { value: doseQty, unit: doseUnit },
            strength,
        );
        if (dispense.quantity > 0) {
            form.quantityPrescribed = String(dispense.quantity);
        }

        const instruction = generateDosageInstruction(
            { value: doseQty, unit: doseUnit },
            route,
            frequency,
            durVal && durUnit ? { value: durVal, unit: durUnit } : null,
        );
        form.dosageInstruction = instruction;
    }
});

watch(() => form.catalogItemId, async () => {
    const item = selectedCatalogItem.value;
    if (!item) return;

    const route = item.route?.trim();
    if (route && !form.route) form.route = route;

    const doseUnit = inferredStrength.value?.numeratorUnit;
    if (doseUnit && !form.doseUnit) form.doseUnit = doseUnit;

    const catalogUnit = item.unit?.trim();
    if (catalogUnit && !form.prescribedUnit) form.prescribedUnit = catalogUnit;

    medicationAvailability.value = null;
    const availability = await fetchPharmacyMedicationAvailability(item.id);
    if (availability && selectedCatalogItem.value?.id === item.id) {
        medicationAvailability.value = availability;
    }
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
        frequency: form.frequency?.trim() || null,
        doseQuantity: form.doseQuantity ? Number(form.doseQuantity) : null,
    });

    if (!summary) {
        return { acknowledged: false, overrideCode: null, overrideReason: null };
    }

    if (summary.blockers.length > 0) {
        return requestSafetyOverride(summary);
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
            doseQuantity: form.doseQuantity ? Number(form.doseQuantity) : null,
            doseUnit: form.doseUnit.trim() || undefined,
            route: form.route.trim() || undefined,
            frequency: form.frequency.trim() || undefined,
            durationValue: form.durationValue ? Number(form.durationValue) : null,
            durationUnit: form.durationUnit.trim() || undefined,
            prescribedUnit: form.prescribedUnit.trim() || undefined,
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

        const response = await createPharmacyInlineOrder(context, payload, {
            safetyDecision,
            serviceRequestId: props.serviceRequestId?.trim() || null,
            replacesOrderId: props.linkage?.mode === 'reorder' ? props.linkage.sourceOrderId : null,
            addOnToOrderId: props.linkage?.mode === 'add_on' ? props.linkage.sourceOrderId : null,
        });
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
                <SheetTitle>{{ linkage ? linkageModeLabel : 'Create pharmacy order' }}</SheetTitle>
                <SheetDescription>{{ linkageDescription ?? 'Place a medication order for a patient.' }}</SheetDescription>
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

                    <div v-if="selectedCatalogItem" class="space-y-1.5">
                        <div class="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                            <span class="font-medium text-foreground">{{ selectedCatalogItem.name }}</span>
                            <span v-if="selectedCatalogItem.strength"> — {{ selectedCatalogItem.strength }}</span>
                            <br>
                            <span v-if="selectedCatalogItem.dosageForm">Form: {{ selectedCatalogItem.dosageForm }}</span>
                            <span v-if="selectedCatalogItem.route"> | Route: {{ selectedCatalogItem.route }}</span>
                            <span v-if="selectedCatalogItem.unit"> | Unit: {{ selectedCatalogItem.unit }}</span>
                        </div>

                        <div
                            v-if="medicationAvailability"
                            class="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
                            :class="medicationAvailability.stockState === 'out_of_stock' ? 'border-destructive/30 bg-destructive/5 text-destructive' : medicationAvailability.stockState === 'low_stock' ? 'border-warning/30 bg-warning/5 text-warning-foreground' : 'border-primary/20 bg-primary/5 text-primary'"
                        >
                            <AppIcon
                                :name="medicationAvailability.stockState === 'out_of_stock' ? 'circle-alert' : medicationAvailability.stockState === 'low_stock' ? 'alert-triangle' : 'check-circle'"
                                class="size-3.5 shrink-0"
                            />
                            <span>
                                <strong>{{ medicationAvailability.availableStock ?? medicationAvailability.currentStock ?? 0 }}</strong>
                                in stock
                                <span v-if="medicationAvailability.stockState === 'out_of_stock'" class="font-semibold"> — Out of stock</span>
                                <span v-else-if="medicationAvailability.stockState === 'low_stock'" class="font-semibold"> — Low stock</span>
                            </span>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="grid gap-2">
                            <Label for="pharmacy-order-create-dose-qty">Dose quantity</Label>
                            <Input id="pharmacy-order-create-dose-qty" v-model="form.doseQuantity" type="number" min="0" step="0.01" placeholder="e.g. 100" />
                            <p v-if="fieldError('doseQuantity')" class="text-xs text-destructive">{{ fieldError('doseQuantity') }}</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="pharmacy-order-create-dose-unit">Dose unit</Label>
                            <Input id="pharmacy-order-create-dose-unit" v-model="form.doseUnit" placeholder="mg, mcg, ml…" />
                            <p v-if="fieldError('doseUnit')" class="text-xs text-destructive">{{ fieldError('doseUnit') }}</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="grid gap-2">
                            <Label for="pharmacy-order-create-route">Route</Label>
                            <Input id="pharmacy-order-create-route" v-model="form.route" placeholder="Oral, topical, IV…" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="pharmacy-order-create-freq">Frequency</Label>
                            <Input id="pharmacy-order-create-freq" v-model="form.frequency" placeholder="e.g. bid, tid, q8h, prn, twice daily" />
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="grid gap-2">
                            <Label for="pharmacy-order-create-dur-val">Duration value</Label>
                            <Input id="pharmacy-order-create-dur-val" v-model="form.durationValue" type="number" min="0" step="0.01" placeholder="7" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="pharmacy-order-create-dur-unit">Duration unit</Label>
                            <Input id="pharmacy-order-create-dur-unit" v-model="form.durationUnit" placeholder="days, weeks…" />
                        </div>
                    </div>

                    <div class="grid gap-2">
                        <Label for="pharmacy-order-create-dose-instruction">Dosage instruction</Label>
                        <Input id="pharmacy-order-create-dose-instruction" v-model="form.dosageInstruction" placeholder="Auto-filled: e.g. 500 mg Oral q8h × 7 days" />
                        <p class="text-xs text-muted-foreground">Auto-generated from fields above — edit if needed</p>
                        <p v-if="fieldError('dosageInstruction')" class="text-xs text-destructive">{{ fieldError('dosageInstruction') }}</p>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="grid gap-2">
                            <Label for="pharmacy-order-create-unit">Prescribed unit</Label>
                            <Select v-model="form.prescribedUnit">
                                <SelectTrigger id="pharmacy-order-create-unit" class="w-full">
                                    <SelectValue placeholder="Select unit" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="u in prescribedUnitOptions" :key="u" :value="u">{{ u }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="grid gap-2">
                            <Label for="pharmacy-order-create-qty">Quantity prescribed</Label>
                            <Input id="pharmacy-order-create-qty" v-model="form.quantityPrescribed" type="number" min="0.01" step="0.01" />
                            <p v-if="fieldError('quantityPrescribed')" class="text-xs text-destructive">{{ fieldError('quantityPrescribed') }}</p>
                        </div>
                    </div>

                    <div class="grid gap-2">
                        <Label for="pharmacy-order-create-indication">Clinical indication</Label>
                        <Textarea id="pharmacy-order-create-indication" v-model="form.clinicalIndication" class="min-h-20" placeholder="Diagnosis or treatment reason…" />
                        <p v-if="fieldError('clinicalIndication')" class="text-xs text-destructive">{{ fieldError('clinicalIndication') }}</p>
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

                    <div class="grid gap-2">
                        <Label for="pharmacy-order-create-notes">Dispensing notes (optional)</Label>
                        <Textarea id="pharmacy-order-create-notes" v-model="form.dispensingNotes" class="min-h-16" placeholder="Optional pharmacy notes…" />
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

        <Dialog :open="overrideDialogOpen" @update:open="(value) => { if (!value) cancelSafetyOverride(); }">
            <DialogContent size="md">
                <DialogHeader>
                    <DialogTitle>Medication safety blockers detected</DialogTitle>
                    <DialogDescription>
                        This order can't be placed as-is. Select a clinical override category and document why it's
                        appropriate to continue anyway.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-4 py-2">
                    <Alert variant="destructive">
                        <AlertTitle>Safety blockers</AlertTitle>
                        <AlertDescription>
                            <ul class="list-disc space-y-1 pl-4">
                                <li v-for="(blocker, index) in overrideSummary?.blockers ?? []" :key="index">{{ blocker }}</li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <div class="space-y-1.5">
                        <Label for="pharmacy-order-override-code">Override category</Label>
                        <Select v-model="overrideCode">
                            <SelectTrigger id="pharmacy-order-override-code" class="w-full">
                                <SelectValue placeholder="Select an override category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    v-for="option in overrideSummary?.overrideOptions ?? []"
                                    :key="option.code"
                                    :value="option.code"
                                >
                                    {{ option.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div class="space-y-1.5">
                        <Label for="pharmacy-order-override-reason">Override reason</Label>
                        <Textarea id="pharmacy-order-override-reason" v-model="overrideReason" rows="3" placeholder="Clinical justification for overriding this blocker" />
                    </div>

                    <Alert v-if="overrideError" variant="destructive">
                        <AlertDescription>{{ overrideError }}</AlertDescription>
                    </Alert>
                </div>

                <DialogFooter>
                    <Button variant="outline" @click="cancelSafetyOverride">Cancel</Button>
                    <Button variant="destructive" @click="confirmSafetyOverride">Override and place order</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </Sheet>
</template>
