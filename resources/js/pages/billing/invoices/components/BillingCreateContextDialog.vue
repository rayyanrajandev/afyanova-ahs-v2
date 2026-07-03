<script setup lang="ts">
import { Link } from '@inertiajs/vue3';

import AppIcon from '@/components/AppIcon.vue';
import LinkedContextLookupField from '@/components/context/LinkedContextLookupField.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const props = defineProps({
    state: { type: Object, required: true },
    view: { type: Object, required: true },
    actions: { type: Object, required: true },
});

const state = props.state as Record<string, any>;
const view = props.view as Record<string, any>;
const actions = props.actions as Record<string, any>;

const createForm = state.createForm;

const createPatientContextLocked = view.createPatientContextLocked;
const createPatientContextLabel = view.createPatientContextLabel;
const createPatientContextMeta = view.createPatientContextMeta;
const openedFromPatientChart = view.openedFromPatientChart;
const createPatientChartHref = view.createPatientChartHref;
const activeBillingAppointmentStatuses = view.activeBillingAppointmentStatuses;

const clearCreateClinicalLinks = actions.clearCreateClinicalLinks;
const unlockCreatePatientContext = actions.unlockCreatePatientContext;
const closeCreateContextDialogAfterSelection =
    actions.closeCreateContextDialogAfterSelection;
const createFieldError = actions.createFieldError;
</script>

<template>
    <Dialog
        :open="state.createContextDialogOpen"
        @update:open="state.createContextDialogOpen = $event"
    >
        <DialogContent variant="form" size="4xl" class="overflow-visible">
            <DialogHeader
                class="sticky top-0 z-10 shrink-0 border-b bg-background px-6 py-4"
            >
                <DialogTitle class="flex items-center gap-2">
                    <AppIcon name="search" class="size-4 text-muted-foreground" />
                    Review or change context
                </DialogTitle>
                <DialogDescription>
                    Select the patient and linked visit context for this billing invoice.
                </DialogDescription>
            </DialogHeader>

            <div class="max-h-[calc(90vh-6rem)] space-y-4 overflow-y-auto px-6 py-4">
                <div class="flex flex-wrap gap-2">
                    <Button
                        v-if="
                            !createPatientContextLocked &&
                            (createForm.appointmentId || createForm.admissionId)
                        "
                        type="button"
                        variant="outline"
                        size="sm"
                        class="gap-1.5"
                        @click="clearCreateClinicalLinks"
                    >
                        Unlink billing context
                    </Button>
                </div>

                <Tabs v-model="state.createContextEditorTab" class="w-full">
                    <TabsList
                        class="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3"
                    >
                        <TabsTrigger
                            value="patient"
                            class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"
                        >
                            <AppIcon name="user" class="size-3.5" />
                            Patient
                        </TabsTrigger>
                        <TabsTrigger
                            value="appointment"
                            :disabled="!createForm.patientId.trim()"
                            class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"
                        >
                            <AppIcon name="calendar-clock" class="size-3.5" />
                            Appointment
                        </TabsTrigger>
                        <TabsTrigger
                            value="admission"
                            :disabled="!createForm.patientId.trim()"
                            class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"
                        >
                            <AppIcon name="bed-double" class="size-3.5" />
                            Admission
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div class="rounded-lg border bg-muted/20 p-4">
                    <div
                        v-show="state.createContextEditorTab === 'patient'"
                        class="grid gap-3"
                    >
                        <div
                            v-if="createPatientContextLocked"
                            class="rounded-lg border bg-background px-4 py-3"
                        >
                            <div
                                class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                            >
                                <div class="min-w-0 space-y-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <p class="text-sm font-medium text-foreground">
                                            {{ createPatientContextLabel }}
                                        </p>
                                        <Badge variant="secondary" class="text-[10px]">
                                            Locked
                                        </Badge>
                                    </div>
                                    <p class="text-xs text-muted-foreground">
                                        {{
                                            createPatientContextMeta ||
                                            'Patient context is preserved from the clinical handoff.'
                                        }}
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        Unlock only when you intentionally need to bill a
                                        different patient.
                                    </p>
                                </div>
                                <div class="flex shrink-0 flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        class="gap-1.5"
                                        @click="unlockCreatePatientContext()"
                                    >
                                        <AppIcon name="lock-open" class="size-3.5" />
                                        Unlock patient
                                    </Button>
                                    <Button
                                        v-if="createForm.patientId && openedFromPatientChart"
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        as-child
                                    >
                                        <Link :href="createPatientChartHref">
                                            Open patient chart
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <PatientLookupField
                            v-else
                            input-id="bil-create-patient-id"
                            v-model="createForm.patientId"
                            label="Patient"
                            placeholder="Search active patient by name or patient number"
                            helper-text="Search by patient number, name, phone, email, or national ID."
                            :error-message="createFieldError('patientId')"
                            patient-status="active"
                            @selected="
                                closeCreateContextDialogAfterSelection(
                                    'patientId',
                                    $event,
                                )
                            "
                        />
                    </div>

                    <div
                        v-show="state.createContextEditorTab === 'appointment'"
                        class="grid gap-3"
                    >
                        <LinkedContextLookupField
                            input-id="bil-create-appointment-id"
                            v-model="createForm.appointmentId"
                            :patient-id="createForm.patientId"
                            label="Appointment link"
                            resource="appointments"
                            placeholder="Search linked appointment by number or department"
                            :helper-text="
                                createForm.patientId.trim()
                                    ? 'Search active outpatient visits for the selected patient.'
                                    : 'Select a patient first to search appointments.'
                            "
                            :error-message="createFieldError('appointmentId')"
                            :disabled="!createForm.patientId.trim()"
                            :statuses="activeBillingAppointmentStatuses"
                            @selected="
                                closeCreateContextDialogAfterSelection(
                                    'appointmentId',
                                    $event,
                                )
                            "
                        />
                    </div>

                    <div
                        v-show="state.createContextEditorTab === 'admission'"
                        class="grid gap-3"
                    >
                        <LinkedContextLookupField
                            input-id="bil-create-admission-id"
                            v-model="createForm.admissionId"
                            :patient-id="createForm.patientId"
                            label="Admission link"
                            resource="admissions"
                            placeholder="Search linked admission by number or ward"
                            :helper-text="
                                createForm.patientId.trim()
                                    ? 'Search active admissions for the selected patient.'
                                    : 'Select a patient first to search admissions.'
                            "
                            :error-message="createFieldError('admissionId')"
                            :disabled="!createForm.patientId.trim()"
                            status="admitted"
                            @selected="
                                closeCreateContextDialogAfterSelection(
                                    'admissionId',
                                    $event,
                                )
                            "
                        />
                    </div>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>
