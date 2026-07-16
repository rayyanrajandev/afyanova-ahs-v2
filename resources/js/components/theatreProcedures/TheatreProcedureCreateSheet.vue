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
import ConfirmationDialog from '@/components/workflow/ConfirmationDialog.vue';
import { useConfirmationDialog } from '@/composables/useConfirmationDialog';
import { ApiClientError } from '@/lib/apiClient';
import { catalogItemLabel, duplicateCheckDetails, type ClinicalCatalogItem } from '@/lib/encounterInlineOrders';
import { messageFromUnknown, notifyError } from '@/lib/notify';
import {
    checkTheatreDuplicate,
    createTheatreInlineOrder,
    defaultTheatreScheduleValue,
    fetchTheatreClinicianDirectory,
    fetchTheatreProcedureCatalog,
    theatreStaffLabel,
    type TheatreStaffProfile,
} from '@/lib/theatreInlineOrder';

/**
 * Phase 3 of reports/order-creation-v2-modernization-plan.md — same shape
 * as Radiology/Pharmacy (Phases 1-2), reusing the exact duplicate-check/
 * create functions TheatreInlineOrderForm.vue already calls from the
 * encounter workflow.
 *
 * Deliberately quick-booking scope only (procedure, operating clinician,
 * schedule, free-text room name, no conflict checking) — matching
 * TheatreInlineOrderForm.vue exactly, not the legacy page's full OR
 * room-registry + resource-conflict-checking sub-system. That's a real,
 * separate, larger scope the legacy page still uniquely covers; per an
 * explicit user decision, theatre-procedures/Index.vue stays reachable for
 * full resource booking even after this ships — unlike radiology/pharmacy,
 * this Sheet alone doesn't unblock deleting theatre's legacy page.
 */
const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    created: [procedureNumber: string];
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
const cliniciansLoading = ref(false);
const cliniciansError = ref<string | null>(null);
const clinicians = ref<TheatreStaffProfile[]>([]);
const submitLoading = ref(false);
const fieldErrors = ref<Record<string, string[]>>({});
const formError = ref<string | null>(null);

const form = reactive({
    catalogItemId: '',
    operatingClinicianUserId: '',
    anesthetistUserId: '',
    scheduledAt: defaultTheatreScheduleValue(),
    theatreRoomName: '',
    notes: '',
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

const clinicianOptions = computed(() =>
    clinicians.value
        .filter((profile) => profile.userId !== null)
        .map((profile) => ({
            value: String(profile.userId),
            label: theatreStaffLabel(profile),
            keywords: [profile.employeeNumber, profile.department].filter((k): k is string => Boolean(k)),
        })),
);

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

function resetForm(): void {
    patientId.value = '';
    form.catalogItemId = '';
    form.operatingClinicianUserId = '';
    form.anesthetistUserId = '';
    form.scheduledAt = defaultTheatreScheduleValue();
    form.theatreRoomName = '';
    form.notes = '';
    fieldErrors.value = {};
    formError.value = null;
    catalogError.value = null;
    cliniciansError.value = null;
}

async function loadCatalog(): Promise<void> {
    catalogLoading.value = true;
    catalogError.value = null;
    try {
        catalogItems.value = await fetchTheatreProcedureCatalog();
    } catch (error) {
        catalogItems.value = [];
        catalogError.value = messageFromUnknown(error, 'Unable to load the theatre procedure catalog.');
    } finally {
        catalogLoading.value = false;
    }
}

async function loadClinicians(): Promise<void> {
    cliniciansLoading.value = true;
    cliniciansError.value = null;
    try {
        clinicians.value = await fetchTheatreClinicianDirectory();
    } catch (error) {
        clinicians.value = [];
        cliniciansError.value = messageFromUnknown(error, 'Unable to load the theatre clinician directory.');
    } finally {
        cliniciansLoading.value = false;
    }
}

watch(open, (isOpen) => {
    if (!isOpen) return;
    resetForm();
    void loadCatalog();
    void loadClinicians();
});

const canSubmit = computed(
    () =>
        patientId.value.trim() !== '' &&
        form.catalogItemId.trim() !== '' &&
        form.operatingClinicianUserId.trim() !== '' &&
        Boolean(form.scheduledAt) &&
        !submitLoading.value,
);

async function submit(): Promise<void> {
    if (submitLoading.value) return;

    fieldErrors.value = {};
    formError.value = null;

    const item = selectedCatalogItem.value;
    if (!item) {
        fieldErrors.value = { theatreProcedureCatalogItemId: ['Select an active procedure before booking.'] };
        return;
    }

    const clinicianId = Number(form.operatingClinicianUserId);
    if (!form.operatingClinicianUserId || !Number.isFinite(clinicianId)) {
        fieldErrors.value = { operatingClinicianUserId: ['Select the operating clinician.'] };
        return;
    }

    if (!form.scheduledAt) {
        fieldErrors.value = { scheduledAt: ['Select a scheduled date and time.'] };
        return;
    }

    submitLoading.value = true;

    try {
        const context = { patientId: patientId.value.trim() };
        const procedureItem = {
            theatreProcedureCatalogItemId: form.catalogItemId,
            procedureType: item.code?.trim() ?? '',
        };

        const duplicateResult = await checkTheatreDuplicate(context, procedureItem);
        const title = item.name?.trim() || item.code?.trim() || 'this theatre procedure';
        const details = duplicateCheckDetails(duplicateResult);

        if (details.length > 0) {
            const confirmed = await requestConfirmation({
                title: `Duplicate advisory for ${title}`,
                description:
                    duplicateResult.severity === 'critical'
                        ? 'An active procedure for this item already exists for this patient.'
                        : 'Similar procedures were found for this patient recently.',
                details,
                cancelLabel: 'Review existing procedures',
                confirmLabel: 'Continue booking',
                confirmVariant: duplicateResult.severity === 'critical' ? 'destructive' : 'default',
            });

            if (!confirmed) {
                return;
            }
        }

        const response = await createTheatreInlineOrder(context, {
            theatreProcedureCatalogItemId: item.id,
            procedureType: item.code?.trim() ?? '',
            procedureName: item.name?.trim() ?? '',
            operatingClinicianUserId: clinicianId,
            anesthetistUserId: form.anesthetistUserId ? Number(form.anesthetistUserId) : null,
            scheduledAt: form.scheduledAt,
            theatreRoomName: form.theatreRoomName,
            notes: form.notes,
        });

        const procedureNumber = (response.data.procedureNumber as string | null | undefined)?.trim() || 'theatre procedure';

        emit('created', procedureNumber);
        open.value = false;
    } catch (error) {
        if (error instanceof ApiClientError && error.status === 422) {
            const payload = error.payload as { errors?: Record<string, string[]> } | null;
            if (payload?.errors) {
                fieldErrors.value = payload.errors;
                formError.value = Object.values(fieldErrors.value)[0]?.[0] ?? 'Review the procedure details and try again.';
                return;
            }
        }

        formError.value = messageFromUnknown(error, 'Unable to book this theatre procedure.');
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
                <SheetTitle>Book theatre procedure</SheetTitle>
                <SheetDescription>
                    Books a minimal procedure record for this patient. Full OR room and staff resource allocation with
                    conflict checking remains available on the legacy scheduling page.
                </SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <Alert v-if="formError" variant="destructive">
                    <AlertTitle>Booking needs attention</AlertTitle>
                    <AlertDescription>{{ formError }}</AlertDescription>
                </Alert>

                <Alert v-else-if="catalogError || cliniciansError" variant="destructive">
                    <AlertTitle>Unable to load booking data</AlertTitle>
                    <AlertDescription>{{ catalogError || cliniciansError }}</AlertDescription>
                </Alert>

                <PatientLookupField
                    v-model="patientId"
                    input-id="theatre-order-create-patient"
                    label="Patient"
                    required
                    :error-message="fieldError('patientId')"
                />

                <div v-if="catalogLoading || cliniciansLoading" class="py-6 text-sm text-muted-foreground">Loading booking data…</div>

                <template v-else>
                    <SearchableSelectField
                        v-model="form.catalogItemId"
                        input-id="theatre-order-create-catalog"
                        label="Procedure"
                        :options="catalogOptions"
                        placeholder="Search procedures…"
                        search-placeholder="Search by code or name"
                        :error-message="fieldError('theatreProcedureCatalogItemId')"
                        required
                    />

                    <SearchableSelectField
                        v-model="form.operatingClinicianUserId"
                        input-id="theatre-order-create-clinician"
                        label="Operating clinician"
                        :options="clinicianOptions"
                        placeholder="Search staff…"
                        search-placeholder="Search by name or employee number"
                        :error-message="fieldError('operatingClinicianUserId')"
                        required
                    />

                    <SearchableSelectField
                        v-model="form.anesthetistUserId"
                        input-id="theatre-order-create-anesthetist"
                        label="Anesthetist (optional)"
                        :options="clinicianOptions"
                        placeholder="Search staff…"
                        search-placeholder="Search by name or employee number"
                    />

                    <div class="space-y-1.5">
                        <Label for="theatre-order-create-scheduled">Scheduled for</Label>
                        <Input id="theatre-order-create-scheduled" v-model="form.scheduledAt" type="datetime-local" />
                        <p v-if="fieldError('scheduledAt')" class="text-sm text-destructive">{{ fieldError('scheduledAt') }}</p>
                    </div>

                    <div class="space-y-1.5">
                        <Label for="theatre-order-create-room">Theatre room (optional)</Label>
                        <Input id="theatre-order-create-room" v-model="form.theatreRoomName" placeholder="e.g. Theatre 2" />
                    </div>

                    <div class="space-y-1.5">
                        <Label for="theatre-order-create-notes">Notes (optional)</Label>
                        <Textarea id="theatre-order-create-notes" v-model="form.notes" rows="3" placeholder="Optional booking notes" />
                    </div>
                </template>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ submitLoading ? 'Booking…' : 'Book procedure' }}
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
