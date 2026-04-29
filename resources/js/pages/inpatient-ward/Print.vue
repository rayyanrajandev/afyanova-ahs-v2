<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import DocumentShell from '@/components/documents/DocumentShell.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatEnumLabel } from '@/lib/labels';
import type { SharedDocumentBranding } from '@/types';

type Checklist = { id: string; status?: string | null; statusReason?: string | null; clinicalSummaryCompleted: boolean; medicationReconciliationCompleted: boolean; followUpPlanCompleted: boolean; patientEducationCompleted: boolean; transportArranged: boolean; billingCleared: boolean; documentationCompleted: boolean; isReadyForDischarge: boolean; reviewedAt?: string | null; notes?: string | null; updatedAt?: string | null; };
type Patient = { patientNumber?: string | null; fullName?: string | null; gender?: string | null; dateOfBirth?: string | null; phone?: string | null; email?: string | null; };
type Admission = { admissionNumber?: string | null; ward?: string | null; bed?: string | null; admittedAt?: string | null; dischargedAt?: string | null; status?: string | null; admissionReason?: string | null; dischargeDestination?: string | null; followUpPlan?: string | null; notes?: string | null; };
type User = { name?: string | null; email?: string | null; };
type RoundNote = { id: string; roundedAt?: string | null; shiftLabel?: string | null; roundNote?: string | null; carePlan?: string | null; handoffNotes?: string | null; acknowledgedAt?: string | null; author: User | null; acknowledgedBy: User | null; };
type CarePlan = { id: string; carePlanNumber?: string | null; title?: string | null; planText?: string | null; targetDischargeAt?: string | null; reviewDueAt?: string | null; status?: string | null; statusReason?: string | null; author: User | null; updatedAt?: string | null; };
type FollowUpItem = { id: string; number?: string | null; title?: string | null; status?: string | null; timestamp?: string | null; detail?: string | null; };
type FollowUpModule = { followUpCount: number; statusCounts: Record<string, number>; items: FollowUpItem[]; };
type FollowUpRail = { modules: { laboratory: FollowUpModule; pharmacy: FollowUpModule; radiology: FollowUpModule; billing: FollowUpModule; }; };

const props = defineProps<{ checklist: Checklist; patient: Patient | null; admission: Admission | null; reviewer: User | null; roundNotes: RoundNote[]; carePlans: CarePlan[]; followUpRail: FollowUpRail; documentBranding: SharedDocumentBranding; generatedAt: string | null; }>();

const pageTitle = computed(() => props.admission?.admissionNumber?.trim() ? `Discharge Summary ${props.admission.admissionNumber}` : 'Discharge Summary');
const subtitle = computed(() => [props.patient?.fullName || null, props.patient?.patientNumber ? `Patient ${props.patient.patientNumber}` : null, props.admission?.admissionNumber ? `Admission ${props.admission.admissionNumber}` : null].filter(Boolean).join(' | ') || 'Ward discharge readiness, handoff, and follow-up summary');
const readinessItems = computed(() => [
    { key: 'clinical', label: 'Clinical Summary', complete: props.checklist.clinicalSummaryCompleted, detail: 'Discharge narrative and summary note are complete.' },
    { key: 'medication', label: 'Medication Reconciliation', complete: props.checklist.medicationReconciliationCompleted, detail: 'Medication changes and take-home therapy are reconciled.' },
    { key: 'follow-up', label: 'Follow-up Plan', complete: props.checklist.followUpPlanCompleted, detail: 'Aftercare instructions and return pathway are documented.' },
    { key: 'education', label: 'Patient Education', complete: props.checklist.patientEducationCompleted, detail: 'Counseling and discharge teaching were completed.' },
    { key: 'transport', label: 'Transport', complete: props.checklist.transportArranged, detail: 'Transport coordination is confirmed for departure.' },
    { key: 'billing', label: 'Billing Clearance', complete: props.checklist.billingCleared, detail: 'Outstanding billing exceptions have been cleared or handed off.' },
    { key: 'documentation', label: 'Documentation', complete: props.checklist.documentationCompleted, detail: 'Required ward documentation is signed and complete.' },
]);
const completionLabel = computed(() => `${readinessItems.value.filter((item) => item.complete).length}/${readinessItems.value.length} items complete`);
const patientRows = computed(() => [['Patient No.', props.patient?.patientNumber || 'N/A'], ['Gender', props.patient?.gender ? formatEnumLabel(props.patient.gender) : 'N/A'], ['Date of Birth', formatDate(props.patient?.dateOfBirth || null)], ['Phone', props.patient?.phone || 'N/A'], ['Email', props.patient?.email || 'N/A']]);
const admissionRows = computed(() => [['Admission', props.admission?.admissionNumber || 'N/A'], ['Ward / Bed', props.admission ? `${props.admission.ward || 'N/A'} / ${props.admission.bed || 'N/A'}` : 'N/A'], ['Admitted At', formatDateTime(props.admission?.admittedAt || null)], ['Status', props.admission?.status ? formatEnumLabel(props.admission.status) : 'N/A'], ['Discharge Destination', props.admission?.dischargeDestination || 'Not recorded']]);
const workflowRows = computed(() => [['Checklist Status', formatEnumLabel(props.checklist.status || 'draft')], ['Ready for Discharge', props.checklist.isReadyForDischarge ? 'Yes' : 'No'], ['Reviewed At', formatDateTime(props.checklist.reviewedAt || null)], ['Updated At', formatDateTime(props.checklist.updatedAt || null)], ['Reviewed By', props.reviewer?.name || 'Not recorded']]);
const followUpSections = computed(() => [
    { key: 'laboratory', title: 'Laboratory', description: 'Outstanding diagnostics that still affect discharge readiness.', tone: 'border-sky-200 bg-sky-50/70', module: props.followUpRail.modules.laboratory },
    { key: 'pharmacy', title: 'Pharmacy', description: 'Medication dispensing and reconciliation work that should travel with the handoff.', tone: 'border-emerald-200 bg-emerald-50/70', module: props.followUpRail.modules.pharmacy },
    { key: 'radiology', title: 'Radiology', description: 'Imaging bookings or pending studies relevant to the discharge timeline.', tone: 'border-amber-200 bg-amber-50/70', module: props.followUpRail.modules.radiology },
    { key: 'billing', title: 'Billing', description: 'Financial items that still need front-desk, cashier, or payer follow-up.', tone: 'border-rose-200 bg-rose-50/70', module: props.followUpRail.modules.billing },
]);

function badgeVariant(status: string | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' { switch ((status || '').toLowerCase()) { case 'ready': case 'completed': return 'secondary'; case 'blocked': return 'destructive'; default: return 'outline'; } }
function formatDate(value: string | null | undefined): string { if (!value) return 'N/A'; const date = new Date(value); if (Number.isNaN(date.getTime())) return 'N/A'; return new Intl.DateTimeFormat('en-TZ', { year: 'numeric', month: 'short', day: 'numeric' }).format(date); }
function formatDateTime(value: string | null | undefined): string { if (!value) return 'N/A'; const date = new Date(value); if (Number.isNaN(date.getTime())) return 'N/A'; return new Intl.DateTimeFormat('en-TZ', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date); }
function formatStatusCounts(counts: Record<string, number>): string { return Object.entries(counts).filter(([key, value]) => key !== 'total' && key !== 'other' && value > 0).map(([key, value]) => `${formatEnumLabel(key)} ${value}`).join(' | '); }
function printDocument(): void { window.print(); }
</script>

<template>
    <Head :title="pageTitle" />
    <DocumentShell :document-branding="documentBranding" eyebrow="Clinical Discharge" title="Discharge Summary" :subtitle="subtitle" :document-number="admission?.admissionNumber || checklist.id" :status-label="formatEnumLabel(checklist.status || 'draft')" :generated-at-label="generatedAt ? formatDateTime(generatedAt) : null" @print="printDocument">
        <template #actions>
            <Button variant="outline" class="gap-2 print:hidden" @click="printDocument">Print</Button>
            <Button as-child variant="outline" class="print:hidden"><a :href="`/inpatient-ward/discharge-checklists/${checklist.id}/pdf`">Download PDF</a></Button>
            <Button as-child variant="outline" class="print:hidden"><Link href="/inpatient-ward">Back to Inpatient Ward</Link></Button>
        </template>

        <div class="space-y-6">
            <section class="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div class="grid gap-4 sm:grid-cols-2">
                    <div class="rounded-lg border border-slate-200 bg-slate-50/70 p-4"><p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Patient</p><p class="mt-2 text-lg font-semibold text-slate-950">{{ patient?.fullName || 'Unknown patient' }}</p><dl class="mt-3 space-y-2 text-sm text-slate-600"><div v-for="[label, value] in patientRows" :key="`patient-row-${label}`" class="flex items-start justify-between gap-3"><dt>{{ label }}</dt><dd class="text-right font-medium text-slate-900">{{ value }}</dd></div></dl></div>
                    <div class="rounded-lg border border-slate-200 bg-slate-50/70 p-4"><p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Admission Context</p><p class="mt-2 text-lg font-semibold text-slate-950">{{ admission?.admissionNumber || 'Current inpatient admission' }}</p><dl class="mt-3 space-y-2 text-sm text-slate-600"><div v-for="[label, value] in admissionRows" :key="`admission-row-${label}`" class="flex items-start justify-between gap-3"><dt>{{ label }}</dt><dd class="text-right font-medium text-slate-900">{{ value }}</dd></div></dl></div>
                </div>
                <div class="rounded-[28px] border border-slate-900 bg-[linear-gradient(145deg,#0f172a_0%,#164e63_100%)] p-5 text-white">
                    <div class="flex items-start justify-between gap-3">
                        <div><p class="text-xs font-medium uppercase tracking-[0.28em] text-slate-300">Discharge Snapshot</p><p class="mt-2 text-lg font-semibold">{{ checklist.isReadyForDischarge ? 'Ready for discharge' : 'Still in discharge preparation' }}</p><p class="mt-2 text-sm text-slate-200/80">{{ checklist.statusReason || 'No workflow blocker or status note was recorded for this discharge checklist.' }}</p></div>
                        <Badge :variant="badgeVariant(checklist.status)" class="border-white/20 bg-white/10 text-white">{{ formatEnumLabel(checklist.status || 'draft') }}</Badge>
                    </div>
                    <div class="mt-5 grid gap-3 sm:grid-cols-2">
                        <div class="rounded-lg border border-white/10 bg-white/5 p-3"><p class="text-xs uppercase tracking-[0.2em] text-slate-300">Completion</p><p class="mt-2 text-sm font-semibold">{{ completionLabel }}</p><p class="mt-1 text-xs text-slate-300">{{ checklist.isReadyForDischarge ? 'All bedside readiness gates have been met.' : 'One or more readiness gates are still pending.' }}</p></div>
                        <div class="rounded-lg border border-white/10 bg-white/5 p-3"><p class="text-xs uppercase tracking-[0.2em] text-slate-300">Reviewer</p><p class="mt-2 text-sm font-semibold">{{ reviewer?.name || 'Not recorded' }}</p><p class="mt-1 text-xs text-slate-300">{{ checklist.reviewedAt ? `Reviewed ${formatDateTime(checklist.reviewedAt)}` : 'Review timestamp not recorded yet.' }}</p></div>
                    </div>
                    <dl class="mt-5 grid gap-3 border-t border-white/10 pt-4 text-sm text-slate-200 sm:grid-cols-2"><div v-for="[label, value] in workflowRows" :key="`workflow-row-${label}`"><p class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ label }}</p><p class="mt-1 font-medium text-white">{{ value }}</p></div></dl>
                </div>
            </section>

            <section class="rounded-lg border border-slate-200 p-5">
                <div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Readiness Checklist</p><p class="mt-2 text-base font-semibold text-slate-950">Core discharge gates</p></div><Badge variant="outline">{{ completionLabel }}</Badge></div>
                <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div v-for="item in readinessItems" :key="item.key" :class="['rounded-lg border p-4', item.complete ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70']">
                        <div class="flex items-start justify-between gap-3"><div><p class="text-sm font-semibold text-slate-950">{{ item.label }}</p><p class="mt-2 text-xs leading-5 text-slate-600">{{ item.detail }}</p></div><Badge :variant="item.complete ? 'secondary' : 'outline'">{{ item.complete ? 'Complete' : 'Pending' }}</Badge></div>
                    </div>
                </div>
            </section>

            <section class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-lg border border-slate-200 p-5"><p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Notes and Blockers</p><p class="mt-2 text-base font-semibold text-slate-950">Current discharge commentary</p><div class="mt-4 space-y-4 text-sm leading-6 text-slate-700"><div class="rounded-lg border border-slate-200 bg-slate-50/70 p-4"><p class="text-xs uppercase tracking-[0.2em] text-slate-500">Checklist Notes</p><p class="mt-2">{{ checklist.notes || 'No discharge readiness notes were recorded for this admission.' }}</p></div><div class="rounded-lg border border-slate-200 bg-slate-50/70 p-4"><p class="text-xs uppercase tracking-[0.2em] text-slate-500">Workflow Note</p><p class="mt-2">{{ checklist.statusReason || 'No workflow note or blocker comment was recorded.' }}</p></div></div></div>
                <div class="rounded-lg border border-slate-200 p-5"><p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Disposition Plan</p><p class="mt-2 text-base font-semibold text-slate-950">Where the patient goes next</p><div class="mt-4 grid gap-3 sm:grid-cols-2"><div class="rounded-lg border border-slate-200 bg-slate-50/70 p-4"><p class="text-xs uppercase tracking-[0.2em] text-slate-500">Destination</p><p class="mt-2 text-sm font-semibold text-slate-950">{{ admission?.dischargeDestination || 'Not recorded' }}</p><p class="mt-1 text-xs text-slate-500">{{ admission?.dischargedAt ? `Discharged ${formatDateTime(admission.dischargedAt)}` : 'The admission is still active or discharge time is not recorded.' }}</p></div><div class="rounded-lg border border-slate-200 bg-slate-50/70 p-4"><p class="text-xs uppercase tracking-[0.2em] text-slate-500">Admission Reason</p><p class="mt-2 text-sm font-semibold text-slate-950">{{ admission?.admissionReason || 'Not recorded' }}</p><p class="mt-1 text-xs text-slate-500">{{ admission?.notes || 'No additional admission note was recorded.' }}</p></div></div><div class="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4"><p class="text-xs uppercase tracking-[0.2em] text-slate-500">Follow-up Plan</p><p class="mt-2 text-sm leading-6 text-slate-700">{{ admission?.followUpPlan || 'No admission follow-up plan has been documented yet.' }}</p></div></div>
            </section>

            <section class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-lg border border-slate-200 p-5"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Recent Round Notes</p><p class="mt-2 text-base font-semibold text-slate-950">Ward handoff context</p></div><Badge variant="outline">{{ roundNotes.length }} entr{{ roundNotes.length === 1 ? 'y' : 'ies' }}</Badge></div><div v-if="roundNotes.length > 0" class="mt-4 space-y-3"><div v-for="roundNote in roundNotes" :key="roundNote.id" class="rounded-lg border border-slate-200 bg-slate-50/70 p-4"><div class="flex items-start justify-between gap-3"><div><p class="text-sm font-semibold text-slate-950">{{ roundNote.shiftLabel ? `${formatEnumLabel(roundNote.shiftLabel)} shift` : 'Ward round note' }}</p><p class="mt-1 text-xs text-slate-500">{{ roundNote.author?.name || 'Unknown author' }} | {{ formatDateTime(roundNote.roundedAt || null) }}</p></div><Badge variant="outline">{{ roundNote.acknowledgedAt ? 'Acknowledged' : 'Open handoff' }}</Badge></div><p class="mt-3 text-sm leading-6 text-slate-700">{{ roundNote.roundNote || 'No round note narrative was captured.' }}</p><p v-if="roundNote.carePlan" class="mt-2 text-xs leading-5 text-slate-600">Care plan: {{ roundNote.carePlan }}</p><p v-if="roundNote.handoffNotes" class="mt-2 text-xs leading-5 text-slate-600">Handoff: {{ roundNote.handoffNotes }}</p><p v-if="roundNote.acknowledgedBy?.name" class="mt-2 text-xs text-slate-500">Acknowledged by {{ roundNote.acknowledgedBy.name }} on {{ formatDateTime(roundNote.acknowledgedAt || null) }}</p></div></div><div v-else class="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">No ward round notes were recorded for this admission.</div></div>
                <div class="rounded-lg border border-slate-200 p-5"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Care Plans</p><p class="mt-2 text-base font-semibold text-slate-950">Planned discharge pathway</p></div><Badge variant="outline">{{ carePlans.length }} plan{{ carePlans.length === 1 ? '' : 's' }}</Badge></div><div v-if="carePlans.length > 0" class="mt-4 space-y-3"><div v-for="carePlan in carePlans" :key="carePlan.id" class="rounded-lg border border-slate-200 bg-slate-50/70 p-4"><div class="flex items-start justify-between gap-3"><div><p class="text-sm font-semibold text-slate-950">{{ carePlan.title || 'Care plan' }}</p><p class="mt-1 text-xs text-slate-500">{{ carePlan.carePlanNumber || 'Plan number pending' }} | {{ carePlan.author?.name || 'Unknown author' }}</p></div><Badge :variant="badgeVariant(carePlan.status)">{{ formatEnumLabel(carePlan.status || 'active') }}</Badge></div><p class="mt-3 text-sm leading-6 text-slate-700">{{ carePlan.planText || 'No care-plan narrative was recorded.' }}</p><p v-if="carePlan.statusReason" class="mt-2 text-xs leading-5 text-slate-600">Workflow note: {{ carePlan.statusReason }}</p><p v-if="carePlan.targetDischargeAt || carePlan.reviewDueAt" class="mt-2 text-xs text-slate-500">{{ carePlan.targetDischargeAt ? `Target discharge ${formatDateTime(carePlan.targetDischargeAt)}` : 'No target discharge date' }}<span v-if="carePlan.reviewDueAt"> | Review due {{ formatDateTime(carePlan.reviewDueAt) }}</span></p></div></div><div v-else class="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">No inpatient care plans were recorded for this admission.</div></div>
            </section>

            <section class="rounded-lg border border-slate-200 p-5">
                <div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Cross-module Follow-up</p><p class="mt-2 text-base font-semibold text-slate-950">Downstream work that still matters after discharge</p></div><Badge variant="outline">Generated from current admission context</Badge></div>
                <div class="mt-5 grid gap-4 xl:grid-cols-2">
                    <div v-for="section in followUpSections" :key="section.key" :class="['rounded-lg border p-4', section.tone]">
                        <div class="flex items-start justify-between gap-3"><div><p class="text-sm font-semibold text-slate-950">{{ section.title }}</p><p class="mt-1 text-xs leading-5 text-slate-600">{{ section.description }}</p></div><Badge :variant="section.module.followUpCount > 0 ? 'secondary' : 'outline'">{{ section.module.followUpCount }} open</Badge></div>
                        <p class="mt-3 text-xs text-slate-600">{{ formatStatusCounts(section.module.statusCounts) || 'No active status distribution for this module.' }}</p>
                        <div v-if="section.module.items.length > 0" class="mt-4 space-y-3"><div v-for="item in section.module.items" :key="item.id" class="rounded-lg border border-white/60 bg-white/80 p-3"><div class="flex items-start justify-between gap-3"><div><p class="text-sm font-semibold text-slate-950">{{ item.title || `${section.title} item` }}</p><p class="mt-1 text-xs text-slate-500">{{ item.number || 'Reference pending' }} | {{ formatDateTime(item.timestamp || null) }}</p></div><Badge variant="outline">{{ formatEnumLabel(item.status || 'pending') }}</Badge></div><p v-if="item.detail" class="mt-2 text-xs leading-5 text-slate-600">{{ item.detail }}</p></div></div>
                        <div v-else class="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">No open {{ section.title.toLowerCase() }} follow-up items were found for this admission.</div>
                    </div>
                </div>
            </section>
        </div>
    </DocumentShell>
</template>
