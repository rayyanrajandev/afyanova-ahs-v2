<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ConfirmationDialog from '@/components/workflow/ConfirmationDialog.vue';
import { useConfirmationDialog } from '@/composables/useConfirmationDialog';
import { ApiClientError } from '@/lib/apiClient';
import {
    catalogItemLabel,
    duplicateCheckDetails,
    type ClinicalCatalogItem,
    type EncounterOrderContext,
} from '@/lib/encounterInlineOrders';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import {
    checkTheatreDuplicate,
    createTheatreInlineOrder,
    defaultTheatreScheduleValue,
    fetchTheatreClinicianDirectory,
    fetchTheatreProcedureCatalog,
    theatreStaffLabel,
    type TheatreStaffProfile,
} from '@/lib/theatreInlineOrder';

const props = defineProps<{
    context: EncounterOrderContext;
}>();

const emit = defineEmits<{
    close: [];
    created: [];
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

async function loadCatalog(): Promise<void> {
    catalogLoading.value = true;
    catalogError.value = null;
    try {
        catalogItems.value = await fetchTheatreProcedureCatalog();
    } catch (error) {
        catalogItems.value = [];
        catalogError.value = messageFromUnknown(
            error,
            'Unable to load the theatre procedure catalog.',
        );
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
        cliniciansError.value = messageFromUnknown(
            error,
            'Unable to load the theatre clinician directory.',
        );
    } finally {
        cliniciansLoading.value = false;
    }
}

void loadCatalog();
void loadClinicians();

function applyValidationErrors(errors: Record<string, string[]>): void {
    fieldErrors.value = errors;
    const firstMessage = Object.values(errors)[0]?.[0];
    formError.value = firstMessage ?? 'Review the procedure details and try again.';
}

async function confirmDuplicateCheck(title: string): Promise<boolean> {
    const item = selectedCatalogItem.value;
    const result = await checkTheatreDuplicate(props.context, {
        theatreProcedureCatalogItemId: form.catalogItemId,
        procedureType: item?.code?.trim() ?? '',
    });
    const details = duplicateCheckDetails(result);
    if (!details.length) return true;

    return requestConfirmation({
        title,
        description:
            result.severity === 'critical'
                ? 'An active procedure for this item already exists for this visit.'
                : 'Similar procedures were found for this patient recently.',
        details,
        cancelLabel: 'Review existing procedures',
        confirmLabel: 'Continue booking',
        confirmVariant: result.severity === 'critical' ? 'destructive' : 'default',
    });
}

async function submit(): Promise<void> {
    if (submitLoading.value) return;

    fieldErrors.value = {};
    formError.value = null;

    const item = selectedCatalogItem.value;
    if (!item) {
        applyValidationErrors({
            theatreProcedureCatalogItemId: ['Select an active procedure before booking.'],
        });
        return;
    }

    const clinicianId = Number(form.operatingClinicianUserId);
    if (!form.operatingClinicianUserId || !Number.isFinite(clinicianId)) {
        applyValidationErrors({
            operatingClinicianUserId: ['Select the operating clinician.'],
        });
        return;
    }

    if (!form.scheduledAt) {
        applyValidationErrors({ scheduledAt: ['Select a scheduled date and time.'] });
        return;
    }

    submitLoading.value = true;

    try {
        const title = item.name?.trim() || item.code?.trim() || 'this theatre procedure';
        if (!(await confirmDuplicateCheck(`Duplicate advisory for ${title}`))) {
            return;
        }

        const response = await createTheatreInlineOrder(props.context, {
            theatreProcedureCatalogItemId: item.id,
            procedureType: item.code?.trim() ?? '',
            procedureName: item.name?.trim() ?? '',
            operatingClinicianUserId: clinicianId,
            anesthetistUserId: form.anesthetistUserId ? Number(form.anesthetistUserId) : null,
            scheduledAt: form.scheduledAt,
            theatreRoomName: form.theatreRoomName,
            notes: form.notes,
        });

        const procedureNumber =
            (response.data.procedureNumber as string | null | undefined)?.trim() ||
            'theatre procedure';
        notifySuccess(`Booked ${procedureNumber}.`);
        emit('created');
    } catch (error) {
        if (error instanceof ApiClientError && error.status === 422 && error.payload?.errors) {
            applyValidationErrors(error.payload.errors as Record<string, string[]>);
            return;
        }

        formError.value = messageFromUnknown(error, 'Unable to book this theatre procedure.');
        notifyError(formError.value);
    } finally {
        submitLoading.value = false;
    }
}
</script>

<template>
    <section class="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div class="mb-4 flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-1">
                <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Quick booking
                </p>
                <p class="text-sm font-medium text-foreground">Theatre procedure</p>
                <p class="text-xs text-muted-foreground">
                    Books a minimal procedure record for this visit. Room and staff
                    resource allocation remain available on the full theatre-procedures page.
                </p>
            </div>
            <Button variant="ghost" size="sm" class="h-8 w-8 shrink-0 p-0" :disabled="submitLoading" @click="emit('close')">
                <AppIcon name="x" class="size-4" />
                <span class="sr-only">Close theatre booking form</span>
            </Button>
        </div>

        <Alert v-if="catalogError || cliniciansError" variant="destructive" class="mb-4">
            <AlertTitle>Unable to load booking data</AlertTitle>
            <AlertDescription>{{ catalogError || cliniciansError }}</AlertDescription>
        </Alert>
        <Alert v-else-if="formError" variant="destructive" class="mb-4">
            <AlertTitle>Booking needs attention</AlertTitle>
            <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <div v-if="catalogLoading || cliniciansLoading" class="py-6 text-sm text-muted-foreground">
            Loading booking data…
        </div>

        <div v-else class="space-y-4">
            <SearchableSelectField
                input-id="theatre-inline-catalog"
                v-model="form.catalogItemId"
                label="Procedure"
                :options="catalogOptions"
                placeholder="Search procedures…"
                search-placeholder="Search by code or name"
                :error-message="fieldError('theatreProcedureCatalogItemId')"
                required
            />

            <SearchableSelectField
                input-id="theatre-inline-clinician"
                v-model="form.operatingClinicianUserId"
                label="Operating clinician"
                :options="clinicianOptions"
                placeholder="Search staff…"
                search-placeholder="Search by name or employee number"
                :error-message="fieldError('operatingClinicianUserId')"
                required
            />

            <SearchableSelectField
                input-id="theatre-inline-anesthetist"
                v-model="form.anesthetistUserId"
                label="Anesthetist (optional)"
                :options="clinicianOptions"
                placeholder="Search staff…"
                search-placeholder="Search by name or employee number"
            />

            <div class="grid gap-2">
                <Label for="theatre-inline-scheduled">Scheduled for</Label>
                <Input id="theatre-inline-scheduled" v-model="form.scheduledAt" type="datetime-local" />
                <p v-if="fieldError('scheduledAt')" class="text-xs text-destructive">
                    {{ fieldError('scheduledAt') }}
                </p>
            </div>

            <div class="grid gap-2">
                <Label for="theatre-inline-room">Theatre room (optional)</Label>
                <Input id="theatre-inline-room" v-model="form.theatreRoomName" placeholder="e.g. Theatre 2" />
            </div>

            <div class="grid gap-2">
                <Label for="theatre-inline-notes">Notes</Label>
                <Textarea id="theatre-inline-notes" v-model="form.notes" class="min-h-20" placeholder="Optional booking notes" />
            </div>

            <div class="flex flex-wrap items-center gap-2 pt-1">
                <Button size="sm" class="gap-1.5" :disabled="submitLoading" @click="void submit()">
                    <AppIcon
                        :name="submitLoading ? 'loader-circle' : 'plus'"
                        class="size-3.5"
                        :class="{ 'animate-spin': submitLoading }"
                    />
                    {{ submitLoading ? 'Booking…' : 'Book procedure' }}
                </Button>
                <Button variant="outline" size="sm" :disabled="submitLoading" @click="emit('close')">
                    Cancel
                </Button>
            </div>
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
    </section>
</template>
