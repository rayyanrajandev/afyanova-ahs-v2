<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import DocumentShell from '@/components/documents/DocumentShell.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatEnumLabel } from '@/lib/labels';
import type { SharedDocumentBranding } from '@/types';
import {
    medicalRecordNoteTypeLabel,
    medicalRecordNoteTypeNarrativeHeading,
    medicalRecordNoteTypeSectionLabel,
} from './noteTypes';

type MedicalRecordDocument = {
    id: string;
    recordNumber: string | null;
    encounterAt: string | null;
    recordType: string | null;
    theatreProcedureId?: string | null;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    diagnosisCode: string | null;
    status: string | null;
    statusReason: string | null;
    signedAt: string | null;
    updatedAt: string | null;
};

type RecordPatient = {
    patientNumber?: string | null;
    fullName?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    phone?: string | null;
    email?: string | null;
};

type RecordAppointment = {
    appointmentNumber?: string | null;
    department?: string | null;
    scheduledAt?: string | null;
    status?: string | null;
    sourceAdmissionId?: string | null;
    sourceAdmission?: RecordAdmission | null;
};

type RecordAdmission = {
    admissionNumber?: string | null;
    ward?: string | null;
    bed?: string | null;
    admittedAt?: string | null;
    dischargedAt?: string | null;
    status?: string | null;
    dischargeDestination?: string | null;
    followUpPlan?: string | null;
};

type RecordAppointmentReferral = {
    id?: string | null;
    referralNumber?: string | null;
    referralType?: string | null;
    targetDepartment?: string | null;
    targetFacilityName?: string | null;
    referralReason?: string | null;
    clinicalNotes?: string | null;
    handoffNotes?: string | null;
    priority?: string | null;
    status?: string | null;
    requestedAt?: string | null;
    acceptedAt?: string | null;
    handedOffAt?: string | null;
    completedAt?: string | null;
    statusReason?: string | null;
};

type RecordTheatreProcedure = {
    id?: string | null;
    procedureNumber?: string | null;
    procedureType?: string | null;
    procedureName?: string | null;
    theatreRoomName?: string | null;
    status?: string | null;
    scheduledAt?: string | null;
};

type RecordUser = {
    name?: string | null;
    email?: string | null;
};

type DiagnosisSummary = {
    code: string;
    name?: string | null;
    description?: string | null;
};

type RecordAttestation = {
    id: string;
    attestationNote: string | null;
    attestedAt: string | null;
    attestedBy: RecordUser | null;
};

type VersionSummary = {
    count: number;
    latestVersionNumber: number | null;
    latestVersionCreatedAt: string | null;
    latestVersionCreatedBy: RecordUser | null;
    latestChangedFieldCount: number;
};

type EncounterResources = {
    laboratory: Array<{
        id: string;
        orderNumber: string | null;
        testName: string | null;
        priority: string | null;
        status: string | null;
        orderedAt: string | null;
        resultSummary: string | null;
    }>;
    pharmacy: Array<{
        id: string;
        orderNumber: string | null;
        medicationName: string | null;
        dosageInstruction: string | null;
        quantityPrescribed: string | number | null;
        status: string | null;
        orderedAt: string | null;
    }>;
    radiology: Array<{
        id: string;
        orderNumber: string | null;
        modality: string | null;
        studyDescription: string | null;
        status: string | null;
        orderedAt: string | null;
        reportSummary: string | null;
    }>;
    theatre: Array<{
        id: string;
        procedureNumber: string | null;
        procedureType: string | null;
        procedureName: string | null;
        theatreRoomName: string | null;
        status: string | null;
        scheduledAt: string | null;
        notes: string | null;
    }>;
};

type EncounterResourcePermissions = {
    laboratory: boolean;
    pharmacy: boolean;
    radiology: boolean;
    theatre: boolean;
};

const props = defineProps<{
    record: MedicalRecordDocument;
    patient: RecordPatient | null;
    appointment: RecordAppointment | null;
    admission: RecordAdmission | null;
    appointmentReferral: RecordAppointmentReferral | null;
    theatreProcedure: RecordTheatreProcedure | null;
    author: RecordUser | null;
    signer: RecordUser | null;
    diagnosis: DiagnosisSummary | null;
    attestations: RecordAttestation[];
    versionSummary: VersionSummary;
    encounterResources: EncounterResources;
    canViewEncounterOrders: EncounterResourcePermissions;
    documentBranding: SharedDocumentBranding;
    generatedAt: string | null;
}>();

const recordTypeLabel = computed(() =>
    medicalRecordNoteTypeLabel(props.record.recordType || 'clinical_note'),
);

const narrativeHeading = computed(() =>
    medicalRecordNoteTypeNarrativeHeading(props.record.recordType),
);

const pageTitle = computed(() =>
    props.record.recordNumber?.trim()
        ? `${recordTypeLabel.value} ${props.record.recordNumber}`
        : recordTypeLabel.value,
);

const subtitle = computed(
    () =>
        [
            props.patient?.fullName,
            props.patient?.patientNumber
                ? `Patient ${props.patient.patientNumber}`
                : null,
            props.record.encounterAt
                ? `Encounter ${formatDateTime(props.record.encounterAt)}`
                : null,
        ]
            .filter(Boolean)
            .join(' | ')
        || 'Clinical record, signoff, and encounter context',
);

const patientRows = computed(() => [
    ['Patient No.', props.patient?.patientNumber || 'N/A'],
    [
        'Gender',
        props.patient?.gender ? formatEnumLabel(props.patient.gender) : 'N/A',
    ],
    ['Date of Birth', formatDate(props.patient?.dateOfBirth || null)],
    ['Phone', props.patient?.phone || 'N/A'],
    ['Email', props.patient?.email || 'N/A'],
]);

const encounterRows = computed(() => {
    const rows: Array<[string, string]> = [
        ['Encounter At', formatDateTime(props.record.encounterAt)],
        ['Appointment', props.appointment?.appointmentNumber || 'No linked appointment'],
    ];

    if (props.appointment?.sourceAdmission || props.appointment?.sourceAdmissionId) {
        rows.push([
            'Source Admission',
            props.appointment.sourceAdmission?.admissionNumber
                || (
                    props.appointment.sourceAdmissionId
                        ? `Admission ${props.appointment.sourceAdmissionId.slice(0, 8)}`
                        : 'No linked source admission'
                ),
        ]);

        if (props.appointment.sourceAdmission?.status) {
            rows.push([
                'Source Admission Status',
                formatEnumLabel(props.appointment.sourceAdmission.status),
            ]);
        }

        if (props.appointment.sourceAdmission?.dischargedAt) {
            rows.push([
                'Discharged At',
                formatDateTime(props.appointment.sourceAdmission.dischargedAt),
            ]);
        }

        if (props.appointment.sourceAdmission?.dischargeDestination) {
            rows.push([
                'Discharge Destination',
                props.appointment.sourceAdmission.dischargeDestination,
            ]);
        }

        if (props.appointment.sourceAdmission?.followUpPlan) {
            rows.push([
                'Follow-up Plan',
                props.appointment.sourceAdmission.followUpPlan,
            ]);
        }
    }

    rows.push([
        'Referral',
        props.appointmentReferral?.referralNumber || 'No linked referral',
    ]);

    if (props.appointmentReferral?.status) {
        rows.push([
            'Referral Status',
            formatEnumLabel(props.appointmentReferral.status),
        ]);
    }

    if (props.appointmentReferral?.priority) {
        rows.push([
            'Referral Priority',
            formatEnumLabel(props.appointmentReferral.priority),
        ]);
    }

    if (props.appointmentReferral?.referralType) {
        rows.push([
            'Referral Type',
            formatEnumLabel(props.appointmentReferral.referralType),
        ]);
    }

    const referralDestination = joinPrintableParts([
        props.appointmentReferral?.targetDepartment,
        props.appointmentReferral?.targetFacilityName,
    ]);
    if (referralDestination) {
        rows.push(['Receiving Team', referralDestination]);
    }

    if (props.appointmentReferral?.requestedAt) {
        rows.push([
            'Referral Requested',
            formatDateTime(props.appointmentReferral.requestedAt),
        ]);
    }

    if (props.appointmentReferral?.acceptedAt) {
        rows.push([
            'Referral Accepted',
            formatDateTime(props.appointmentReferral.acceptedAt),
        ]);
    }

    if (props.appointmentReferral?.handedOffAt) {
        rows.push([
            'Referral Handed Off',
            formatDateTime(props.appointmentReferral.handedOffAt),
        ]);
    }

    if (props.appointmentReferral?.completedAt) {
        rows.push([
            'Referral Completed',
            formatDateTime(props.appointmentReferral.completedAt),
        ]);
    }

    rows.push(
        [
            'Procedure',
            props.theatreProcedure?.procedureNumber
                || props.theatreProcedure?.procedureName
                || 'No linked procedure',
        ],
    );

    if (props.theatreProcedure?.status) {
        rows.push([
            'Procedure Status',
            formatEnumLabel(props.theatreProcedure.status),
        ]);
    }

    if (props.theatreProcedure?.scheduledAt) {
        rows.push([
            'Procedure Schedule',
            formatDateTime(props.theatreProcedure.scheduledAt),
        ]);
    }

    if (props.theatreProcedure?.theatreRoomName) {
        rows.push([
            'Theatre Room',
            props.theatreProcedure.theatreRoomName,
        ]);
    }

    rows.push(
        ['Department', props.appointment?.department || 'N/A'],
        ['Admission', props.admission?.admissionNumber || 'No linked admission'],
        [
            'Ward / Bed',
            props.admission
                ? `${props.admission.ward || 'N/A'} / ${props.admission.bed || 'N/A'}`
                : 'N/A',
        ],
    );

    return rows;
});

const diagnosisDisplay = computed(() =>
    props.diagnosis
        ? joinPrintableParts([props.diagnosis.code, props.diagnosis.name])
        : props.record.diagnosisCode || 'N/A',
);

const versionSummaryDisplay = computed(() =>
    props.versionSummary.latestVersionNumber !== null
        ? joinPrintableParts([
              `Latest v${props.versionSummary.latestVersionNumber}`,
              `${props.versionSummary.latestChangedFieldCount} changed field${props.versionSummary.latestChangedFieldCount === 1 ? '' : 's'}`,
          ])
        : 'No version summary available yet',
);

const documentRows = computed(() => [
    ['Author', props.author?.name || 'Not recorded'],
    ['Signer', props.signer?.name || 'Not signed'],
    ['Signed At', formatDateTime(props.record.signedAt)],
    ['Diagnosis', diagnosisDisplay.value],
    ['Status Reason', props.record.statusReason || 'None'],
    ['Updated', formatDateTime(props.record.updatedAt)],
]);

const noteSections = computed(() =>
    [
        {
            id: 'subjective',
            title: medicalRecordNoteTypeSectionLabel(
                props.record.recordType,
                'subjective',
            ),
            blocks: textBlocksFromHtml(props.record.subjective),
        },
        {
            id: 'objective',
            title: medicalRecordNoteTypeSectionLabel(
                props.record.recordType,
                'objective',
            ),
            blocks: textBlocksFromHtml(props.record.objective),
        },
        {
            id: 'assessment',
            title: medicalRecordNoteTypeSectionLabel(
                props.record.recordType,
                'assessment',
            ),
            blocks: textBlocksFromHtml(props.record.assessment),
        },
        {
            id: 'plan',
            title: medicalRecordNoteTypeSectionLabel(
                props.record.recordType,
                'plan',
            ),
            blocks: textBlocksFromHtml(props.record.plan),
        },
    ].filter((section) => section.blocks.length > 0),
);

const resourceSections = computed(() =>
    [
        {
            id: 'laboratory',
            title: 'Laboratory',
            visible: props.canViewEncounterOrders.laboratory,
            empty: 'No linked laboratory orders were found for this encounter.',
            items: props.encounterResources.laboratory.map((order) => ({
                id: order.id,
                title: order.testName || 'Laboratory order',
                meta: joinPrintableParts([
                    order.orderNumber || 'Order number pending',
                    formatDateTime(order.orderedAt),
                ]),
                body:
                    order.resultSummary
                    || `Priority ${formatEnumLabel(order.priority || 'routine')}`,
                status: formatEnumLabel(order.status || 'ordered'),
            })),
        },
        {
            id: 'pharmacy',
            title: 'Pharmacy',
            visible: props.canViewEncounterOrders.pharmacy,
            empty: 'No linked medication orders were found for this encounter.',
            items: props.encounterResources.pharmacy.map((order) => ({
                id: order.id,
                title: order.medicationName || 'Medication order',
                meta: joinPrintableParts([
                    order.orderNumber || 'Order number pending',
                    formatDateTime(order.orderedAt),
                ]),
                body:
                    order.dosageInstruction
                    || `Prescribed ${formatQuantity(order.quantityPrescribed)}`,
                status: formatEnumLabel(order.status || 'ordered'),
            })),
        },
        {
            id: 'radiology',
            title: 'Radiology',
            visible: props.canViewEncounterOrders.radiology,
            empty: 'No linked imaging orders were found for this encounter.',
            items: props.encounterResources.radiology.map((order) => ({
                id: order.id,
                title: order.studyDescription || 'Imaging order',
                meta: joinPrintableParts([
                    order.orderNumber || 'Order number pending',
                    formatDateTime(order.orderedAt),
                ]),
                body:
                    order.reportSummary
                    || `${formatEnumLabel(order.modality || 'study')} study`,
                status: formatEnumLabel(order.status || 'ordered'),
            })),
        },
        {
            id: 'theatre',
            title: 'Theatre',
            visible: props.canViewEncounterOrders.theatre,
            empty: 'No linked theatre procedures were found for this encounter.',
            items: props.encounterResources.theatre.map((procedure) => ({
                id: procedure.id,
                title:
                    procedure.procedureName
                    || procedure.procedureType
                    || 'Procedure booking',
                meta: joinPrintableParts([
                    procedure.procedureNumber || 'Procedure number pending',
                    formatDateTime(procedure.scheduledAt),
                ]),
                body:
                    procedure.theatreRoomName
                    || procedure.notes
                    || 'Theatre room or note not recorded.',
                status: formatEnumLabel(procedure.status || 'planned'),
            })),
        },
    ].filter((section) => section.visible),
);

function joinPrintableParts(
    parts: Array<string | null | undefined>,
): string {
    return parts
        .map((part) => (part ?? '').trim())
        .filter(Boolean)
        .join(' - ');
}

function formatDate(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';

    return new Intl.DateTimeFormat('en-TZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date);
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';

    return new Intl.DateTimeFormat('en-TZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

function formatQuantity(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return 'N/A';
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value.toFixed(2) : 'N/A';
    }

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : String(value);
}

function textBlocksFromHtml(value: string | null): string[] {
    if (!value) return [];
    const raw = value.trim();
    if (!raw) return [];

    if (typeof window !== 'undefined') {
        const container = document.createElement('div');
        container.innerHTML = raw;
        const blocks = Array.from(
            container.querySelectorAll(
                'p,li,div,blockquote,h1,h2,h3,h4,h5,h6',
            ),
        )
            .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '')
            .filter(Boolean);

        if (blocks.length > 0) return blocks;

        const text = container.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        return text ? [text] : [];
    }

    return raw
        .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
}

function printDocument() {
    window.print();
}
</script>

<template>
    <Head :title="pageTitle" />

    <DocumentShell
        :document-branding="documentBranding"
        eyebrow="Clinical Record"
        :title="recordTypeLabel"
        :subtitle="subtitle"
        :document-number="record.recordNumber || record.id"
        :status-label="formatEnumLabel(record.status || 'draft')"
        :generated-at-label="generatedAt ? formatDateTime(generatedAt) : null"
        @print="printDocument"
    >
        <template #actions>
            <Button variant="outline" class="gap-2 print:hidden" @click="printDocument">
                Print
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <a :href="`/medical-records/${record.id}/pdf`">Download PDF</a>
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <Link href="/medical-records">Back to Records</Link>
            </Button>
        </template>

        <div class="space-y-6">
            <section class="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div class="grid gap-4 sm:grid-cols-2">
                    <div class="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                            Patient
                        </p>
                        <p class="mt-2 text-lg font-semibold text-slate-950">
                            {{ patient?.fullName || 'Unknown patient' }}
                        </p>
                        <dl class="mt-3 space-y-2 text-sm text-slate-600">
                            <div
                                v-for="[label, value] in patientRows"
                                :key="`patient-row-${label}`"
                                class="flex items-start justify-between gap-3"
                            >
                                <dt>{{ label }}</dt>
                                <dd class="text-right font-medium text-slate-900">
                                    {{ value }}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <div class="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                            Encounter
                        </p>
                        <p class="mt-2 text-lg font-semibold text-slate-950">
                            {{
                                appointment?.appointmentNumber
                                || admission?.admissionNumber
                                || 'Clinical encounter'
                            }}
                        </p>
                        <dl class="mt-3 space-y-2 text-sm text-slate-600">
                            <div
                                v-for="[label, value] in encounterRows"
                                :key="`encounter-row-${label}`"
                                class="flex items-start justify-between gap-3"
                            >
                                <dt>{{ label }}</dt>
                                <dd class="text-right font-medium text-slate-900">
                                    {{ value }}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>

                <div class="rounded-[28px] border border-slate-900 bg-[linear-gradient(145deg,#0f172a_0%,#164e63_100%)] p-5 text-white">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="text-xs font-medium uppercase tracking-[0.28em] text-slate-300">
                                Documentation Snapshot
                            </p>
                            <p class="mt-2 text-lg font-semibold">
                                {{ formatEnumLabel(record.status || 'draft') }}
                            </p>
                            <p class="mt-2 text-sm text-slate-200/80">
                                {{
                                    record.statusReason
                                    || 'No status note recorded for this clinical document.'
                                }}
                            </p>
                        </div>
                        <Badge
                            variant="secondary"
                            class="border-white/20 bg-white/10 text-white"
                        >
                            {{ record.recordNumber || 'Draft note' }}
                        </Badge>
                    </div>

                    <div class="mt-5 grid gap-3 sm:grid-cols-2">
                        <div class="rounded-lg border border-white/10 bg-white/5 p-3">
                            <p class="text-xs uppercase tracking-[0.2em] text-slate-300">
                                Author
                            </p>
                            <p class="mt-2 text-sm font-semibold">
                                {{ author?.name || 'Not recorded' }}
                            </p>
                            <p class="mt-1 text-xs text-slate-300">
                                {{ author?.email || 'No author contact recorded' }}
                            </p>
                        </div>

                        <div class="rounded-lg border border-white/10 bg-white/5 p-3">
                            <p class="text-xs uppercase tracking-[0.2em] text-slate-300">
                                Signer
                            </p>
                            <p class="mt-2 text-sm font-semibold">
                                {{ signer?.name || 'Not signed' }}
                            </p>
                            <p class="mt-1 text-xs text-slate-300">
                                {{
                                    record.signedAt
                                        ? `Signed ${formatDateTime(record.signedAt)}`
                                        : 'Clinical signoff pending'
                                }}
                            </p>
                        </div>
                    </div>

                    <div class="mt-5 grid gap-3 border-t border-white/10 pt-4 text-sm text-slate-200 sm:grid-cols-2">
                        <div>
                            <p class="text-xs uppercase tracking-[0.2em] text-slate-400">
                                Diagnosis
                            </p>
                            <p class="mt-1 font-medium text-white">
                                {{
                                    diagnosisDisplay || 'No diagnosis recorded'
                                }}
                            </p>
                            <p
                                v-if="diagnosis?.description"
                                class="mt-1 text-xs text-slate-300"
                            >
                                {{ diagnosis.description }}
                            </p>
                        </div>

                        <div>
                            <p class="text-xs uppercase tracking-[0.2em] text-slate-400">
                                Versioning
                            </p>
                            <p class="mt-1 font-medium text-white">
                                {{ versionSummary.count }} snapshot{{ versionSummary.count === 1 ? '' : 's' }}
                            </p>
                            <p class="mt-1 text-xs text-slate-300">
                                {{ versionSummaryDisplay }}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section class="rounded-lg border border-slate-200 p-5">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                            Note Content
                        </p>
                        <p class="mt-2 text-base font-semibold text-slate-950">
                            {{ narrativeHeading.title }}
                        </p>
                        <p class="mt-1 text-sm text-slate-500">
                            {{ narrativeHeading.subtitle }}
                        </p>
                    </div>
                    <Badge variant="outline">
                        {{ noteSections.length }} section{{ noteSections.length === 1 ? '' : 's' }}
                    </Badge>
                </div>

                <div v-if="noteSections.length > 0" class="mt-5 grid gap-4 md:grid-cols-2">
                    <div
                        v-for="section in noteSections"
                        :key="section.id"
                        class="rounded-lg border border-slate-200 bg-slate-50/70 p-4"
                    >
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                            {{ section.title }}
                        </p>
                        <div class="mt-3 space-y-3 text-sm leading-6 text-slate-700">
                            <p
                                v-for="(block, index) in section.blocks"
                                :key="`${section.id}-block-${index}`"
                            >
                                {{ block }}
                            </p>
                        </div>
                    </div>
                </div>

                <div
                    v-else
                    class="mt-5 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500"
                >
                    No narrative content has been recorded for this note.
                </div>
            </section>

            <section
                v-if="resourceSections.length > 0"
                class="rounded-lg border border-slate-200 p-5"
            >
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                            Linked Care
                        </p>
                        <p class="mt-2 text-base font-semibold text-slate-950">
                            Encounter-linked orders and procedures
                        </p>
                    </div>
                    <Badge variant="outline">Current encounter context</Badge>
                </div>

                <div class="mt-5 grid gap-4 xl:grid-cols-2">
                    <div
                        v-for="section in resourceSections"
                        :key="section.id"
                        class="rounded-lg border border-slate-200 bg-slate-50/70 p-4"
                    >
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                            {{ section.title }}
                        </p>
                        <div v-if="section.items.length > 0" class="mt-3 space-y-3">
                            <div
                                v-for="item in section.items"
                                :key="item.id"
                                class="rounded-lg border border-slate-200 bg-white p-3"
                            >
                                <div class="flex items-start justify-between gap-3">
                                    <div>
                                        <p class="text-sm font-semibold text-slate-950">
                                            {{ item.title }}
                                        </p>
                                        <p class="mt-1 text-xs text-slate-500">
                                            {{ item.meta }}
                                        </p>
                                    </div>
                                    <Badge variant="outline">{{ item.status }}</Badge>
                                </div>
                                <p class="mt-2 text-xs text-slate-600">
                                    {{ item.body }}
                                </p>
                            </div>
                        </div>
                        <p v-else class="mt-3 text-sm text-slate-500">
                            {{ section.empty }}
                        </p>
                    </div>
                </div>
            </section>

            <section class="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div class="rounded-lg border border-slate-200 p-5">
                    <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                        Document Control
                    </p>
                    <dl class="mt-4 space-y-3 text-sm text-slate-600">
                        <div
                            v-for="[label, value] in documentRows"
                            :key="`document-row-${label}`"
                            class="flex items-start justify-between gap-3"
                        >
                            <dt>{{ label }}</dt>
                            <dd class="text-right font-medium text-slate-900">
                                {{ value }}
                            </dd>
                        </div>
                    </dl>

                    <div class="mt-5 grid gap-3 sm:grid-cols-2">
                        <div class="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                            <p class="text-xs uppercase tracking-[0.2em] text-slate-500">
                                Latest version
                            </p>
                            <p class="mt-2 text-sm font-semibold text-slate-950">
                                {{
                                    versionSummary.latestVersionNumber !== null
                                        ? `v${versionSummary.latestVersionNumber}`
                                        : 'N/A'
                                }}
                            </p>
                            <p class="mt-1 text-xs text-slate-500">
                                {{
                                    versionSummary.latestVersionCreatedAt
                                        ? formatDateTime(versionSummary.latestVersionCreatedAt)
                                        : 'No version timestamp recorded'
                                }}
                            </p>
                        </div>

                        <div class="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                            <p class="text-xs uppercase tracking-[0.2em] text-slate-500">
                                Latest editor
                            </p>
                            <p class="mt-2 text-sm font-semibold text-slate-950">
                                {{ versionSummary.latestVersionCreatedBy?.name || 'N/A' }}
                            </p>
                            <p class="mt-1 text-xs text-slate-500">
                                {{ versionSummary.latestChangedFieldCount }} changed field{{ versionSummary.latestChangedFieldCount === 1 ? '' : 's' }}
                            </p>
                        </div>
                    </div>
                </div>

                <div class="rounded-lg border border-slate-200 p-5">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                                Signer Attestations
                            </p>
                            <p class="mt-2 text-base font-semibold text-slate-950">
                                Clinical signoff trail
                            </p>
                        </div>
                        <Badge variant="outline">
                            {{ attestations.length }} entr{{ attestations.length === 1 ? 'y' : 'ies' }}
                        </Badge>
                    </div>

                    <div v-if="attestations.length > 0" class="mt-4 space-y-3">
                        <div
                            v-for="attestation in attestations"
                            :key="attestation.id"
                            class="rounded-lg border border-slate-200 bg-slate-50/70 p-4"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="text-sm font-semibold text-slate-950">
                                        {{ attestation.attestedBy?.name || 'Clinical user' }}
                                    </p>
                                    <p class="mt-1 text-xs text-slate-500">
                                        {{ formatDateTime(attestation.attestedAt) }}
                                    </p>
                                </div>
                                <Badge variant="secondary">Attested</Badge>
                            </div>
                            <p class="mt-3 text-sm leading-6 text-slate-700">
                                {{ attestation.attestationNote || 'No attestation note recorded.' }}
                            </p>
                        </div>
                    </div>

                    <div
                        v-else
                        class="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500"
                    >
                        No signer attestations have been recorded for this note yet.
                    </div>
                </div>
            </section>
        </div>
    </DocumentShell>
</template>
