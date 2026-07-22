import { computed, reactive, ref, watch, type ComputedRef, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';
import { messageFromUnknown } from '@/lib/notify';
import { usePlatformAccess } from '@/composables/usePlatformAccess';

/**
 * The subset of Admission fields discharge-readiness actually needs —
 * narrower than importing the full Admission type so callers that only
 * have a status-dialog target (id/patientId/admittedAt/createdAt, not a
 * full admission record) can use this composable without fabricating one.
 */
export type DischargeReadinessAdmission = {
    id: string;
    patientId: string | null;
    admittedAt: string | null;
    createdAt: string | null;
};

/**
 * AdmC of the Admission V2 full-parity plan — ported from the legacy
 * admissions/Index.vue's buildDischargeReadinessSections/loadDischargeReadiness
 * (Index.vue:1251-1469, :1471-1594). Per the user's explicit decision, the
 * two required checks (documented discharge summary, no pending labs)
 * block discharge exactly like the legacy page does, with the same
 * fail-open behavior (only when ALL four linked-module fetches fail).
 *
 * Simplified from the legacy port: action links go to each module's
 * patient-filtered list (e.g. `/laboratory-orders?patientId=...`) rather
 * than the legacy's elaborate create/edit/details deep-link branching
 * (which needed 3-tier create/update/read permission checks per record) —
 * that polish wasn't part of the user's gating decision and added
 * significant complexity for a secondary "jump to the record" convenience.
 */
export type DischargeReadinessItemSource = 'live' | 'manual' | 'mixed' | 'unavailable';

export type DischargeReadinessItem = {
    key: string;
    label: string;
    statusText: string;
    required: boolean;
    complete: boolean;
    source: DischargeReadinessItemSource;
    manualKey?: 'medicationCounsellingNoted' | 'paymentPlanConfirmed' | 'transportConfirmed';
    actionLabel?: string;
    actionHref?: string;
};

export type DischargeReadinessSection = {
    key: 'clinical' | 'medication' | 'administrative' | 'logistics';
    label: string;
    description: string;
    items: DischargeReadinessItem[];
};

type MedicalRecordSummary = { admissionId: string | null; patientId: string | null; encounterAt: string | null; status: string | null; recordType: string | null; recordNumber: string | null };
type LaboratoryOrderSummary = { admissionId: string | null; patientId: string | null; orderedAt: string | null; status: string | null };
type PharmacyOrderSummary = { admissionId: string | null; patientId: string | null; orderedAt: string | null; dispensedAt: string | null; status: string | null; orderNumber: string | null };
type BillingInvoiceSummary = { admissionId: string | null; patientId: string | null; invoiceDate: string | null; status: string | null; balanceAmount: number | string | null; invoiceNumber: string | null };

function parseDateTimeValue(value: string | null | undefined): number | null {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function matchesAdmissionContext(admission: DischargeReadinessAdmission, rowAdmissionId: string | null | undefined, rowPatientId: string | null | undefined, rowTimestamp: string | null | undefined): boolean {
    const admissionId = rowAdmissionId?.trim() ?? '';
    if (admissionId) return admissionId === admission.id;

    const patientId = rowPatientId?.trim() ?? '';
    if (!patientId || patientId !== (admission.patientId ?? '').trim()) return false;

    const admissionStartedAt = parseDateTimeValue(admission.admittedAt ?? admission.createdAt ?? null);
    const rowOccurredAt = parseDateTimeValue(rowTimestamp);

    if (admissionStartedAt !== null && rowOccurredAt !== null) {
        return rowOccurredAt >= admissionStartedAt;
    }
    return true;
}

function isDocumentedMedicalRecordSummary(record: MedicalRecordSummary): boolean {
    const status = (record.status ?? '').trim().toLowerCase();
    return status === 'finalized' || status === 'amended';
}

function isDischargeMedicalRecordSummary(record: MedicalRecordSummary): boolean {
    const recordType = (record.recordType ?? '').trim().toLowerCase();
    return recordType === 'discharge_note' || recordType === 'discharge_summary';
}

export function useDischargeReadiness(admission: Ref<DischargeReadinessAdmission | null> | ComputedRef<DischargeReadinessAdmission | null>) {
    const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();
    const canReadMedicalRecords = computed(() => isFacilitySuperAdmin.value || hasPermission('medical.records.read'));
    const canReadLaboratoryOrders = computed(() => isFacilitySuperAdmin.value || hasPermission('laboratory.orders.read'));
    const canReadPharmacyOrders = computed(() => isFacilitySuperAdmin.value || hasPermission('pharmacy.orders.read'));
    const canReadBillingInvoices = computed(() => isFacilitySuperAdmin.value || hasPermission('billing.invoices.read'));

    const manualChecklist = reactive({
        medicationCounsellingNoted: false,
        paymentPlanConfirmed: false,
        transportConfirmed: false,
    });

    const loading = ref(true);
    const allUnavailable = ref(false);
    const medicalRecords = ref<MedicalRecordSummary[]>([]);
    const laboratoryOrders = ref<LaboratoryOrderSummary[]>([]);
    const pharmacyOrders = ref<PharmacyOrderSummary[]>([]);
    const billingInvoices = ref<BillingInvoiceSummary[]>([]);
    const issues = ref<Partial<Record<'medicalRecords' | 'laboratoryOrders' | 'pharmacyOrders' | 'billingInvoices', string>>>({});

    async function load(): Promise<void> {
        const current = admission.value;
        if (!current || !current.patientId) {
            loading.value = false;
            return;
        }

        loading.value = true;
        const patientId = current.patientId;
        const from = (current.admittedAt ?? current.createdAt ?? undefined) as string | undefined;

        const [medicalRecordsResult, laboratoryOrdersResult, pharmacyOrdersResult, billingInvoicesResult] = await Promise.allSettled([
            canReadMedicalRecords.value
                ? apiGet<{ data: MedicalRecordSummary[] }>('/medical-records', { patientId, admissionId: current.id, from, page: 1, perPage: 50, sortBy: 'encounterAt', sortDir: 'desc' })
                : Promise.reject(new Error('Medical Records access is not available.')),
            canReadLaboratoryOrders.value
                ? apiGet<{ data: LaboratoryOrderSummary[] }>('/laboratory-orders', { patientId, from, page: 1, perPage: 50, sortBy: 'orderedAt', sortDir: 'desc' })
                : Promise.reject(new Error('Laboratory Orders access is not available.')),
            canReadPharmacyOrders.value
                ? apiGet<{ data: PharmacyOrderSummary[] }>('/pharmacy-orders', { patientId, from, page: 1, perPage: 50, sortBy: 'orderedAt', sortDir: 'desc' })
                : Promise.reject(new Error('Pharmacy Orders access is not available.')),
            canReadBillingInvoices.value
                ? apiGet<{ data: BillingInvoiceSummary[] }>('/billing', { patientId, from, page: 1, perPage: 50, sortBy: 'invoiceDate', sortDir: 'desc' })
                : Promise.reject(new Error('Billing access is not available.')),
        ]);

        const nextIssues: typeof issues.value = {};
        if (medicalRecordsResult.status === 'rejected') nextIssues.medicalRecords = messageFromUnknown(medicalRecordsResult.reason, 'Unable to load Medical Records.');
        if (laboratoryOrdersResult.status === 'rejected') nextIssues.laboratoryOrders = messageFromUnknown(laboratoryOrdersResult.reason, 'Unable to load Laboratory Orders.');
        if (pharmacyOrdersResult.status === 'rejected') nextIssues.pharmacyOrders = messageFromUnknown(pharmacyOrdersResult.reason, 'Unable to load Pharmacy Orders.');
        if (billingInvoicesResult.status === 'rejected') nextIssues.billingInvoices = messageFromUnknown(billingInvoicesResult.reason, 'Unable to load Billing.');

        medicalRecords.value = medicalRecordsResult.status === 'fulfilled' ? (medicalRecordsResult.value.data ?? []) : [];
        laboratoryOrders.value = laboratoryOrdersResult.status === 'fulfilled' ? (laboratoryOrdersResult.value.data ?? []) : [];
        pharmacyOrders.value = pharmacyOrdersResult.status === 'fulfilled' ? (pharmacyOrdersResult.value.data ?? []) : [];
        billingInvoices.value = billingInvoicesResult.status === 'fulfilled' ? (billingInvoicesResult.value.data ?? []) : [];
        issues.value = nextIssues;
        allUnavailable.value = Object.keys(nextIssues).length === 4;
        loading.value = false;
    }

    watch(() => admission.value?.id, () => void load(), { immediate: true });

    const sections = computed<DischargeReadinessSection[]>(() => {
        const current = admission.value;
        if (!current) return [];

        const relevantMedicalRecords = medicalRecords.value.filter((r) => matchesAdmissionContext(current, r.admissionId, r.patientId, r.encounterAt));
        const dischargeMedicalRecords = relevantMedicalRecords.filter(isDischargeMedicalRecordSummary);
        const documentedDischargeSummary = dischargeMedicalRecords.find(isDocumentedMedicalRecordSummary) ?? null;

        const relevantLabOrders = laboratoryOrders.value.filter((o) => matchesAdmissionContext(current, o.admissionId, o.patientId, o.orderedAt));
        const pendingLabOrders = relevantLabOrders.filter((o) => ['ordered', 'collected', 'in_progress'].includes((o.status ?? '').trim().toLowerCase()));

        const relevantPharmacyOrders = pharmacyOrders.value.filter((o) => matchesAdmissionContext(current, o.admissionId, o.patientId, o.dispensedAt ?? o.orderedAt));
        const dispensedPharmacyOrder = relevantPharmacyOrders.find((o) => (o.status ?? '').trim().toLowerCase() === 'dispensed') ?? null;

        const relevantInvoices = billingInvoices.value.filter((i) => matchesAdmissionContext(current, i.admissionId, i.patientId, i.invoiceDate));
        const issuedInvoices = relevantInvoices.filter((i) => { const s = (i.status ?? '').trim().toLowerCase(); return s !== '' && s !== 'draft'; });
        const settledInvoice = relevantInvoices.find((i) => {
            const status = (i.status ?? '').trim().toLowerCase();
            const balance = typeof i.balanceAmount === 'number' ? i.balanceAmount : Number.parseFloat(String(i.balanceAmount ?? 'NaN'));
            return status === 'paid' || (!Number.isNaN(balance) && balance <= 0);
        }) ?? null;

        return [
            {
                key: 'clinical',
                label: 'Clinical',
                description: 'Required checks before discharge can be confirmed.',
                items: [
                    {
                        key: 'discharge-summary',
                        label: 'Discharge summary written',
                        statusText: issues.value.medicalRecords
                            ? 'Unable to verify from Medical Records.'
                            : documentedDischargeSummary
                              ? `${documentedDischargeSummary.recordNumber || 'Discharge note'} is documented for this admission.`
                              : 'No documented discharge note found for this admission.',
                        required: true,
                        complete: Boolean(documentedDischargeSummary),
                        source: issues.value.medicalRecords ? 'unavailable' : 'live',
                        actionLabel: canReadMedicalRecords.value ? 'Open medical records' : undefined,
                        actionHref: canReadMedicalRecords.value ? `/medical-records?patientId=${current.patientId}` : undefined,
                    },
                    {
                        key: 'pending-lab-results',
                        label: 'Pending lab results reviewed',
                        statusText: issues.value.laboratoryOrders
                            ? 'Unable to verify from Laboratory Orders.'
                            : pendingLabOrders.length === 0
                              ? 'No pending laboratory orders are linked to this admission.'
                              : `${pendingLabOrders.length} pending laboratory ${pendingLabOrders.length === 1 ? 'order remains' : 'orders remain'}.`,
                        required: true,
                        complete: !issues.value.laboratoryOrders && pendingLabOrders.length === 0,
                        source: issues.value.laboratoryOrders ? 'unavailable' : 'live',
                        actionLabel: canReadLaboratoryOrders.value ? 'Open lab orders' : undefined,
                        actionHref: canReadLaboratoryOrders.value ? `/laboratory-orders?patientId=${current.patientId}` : undefined,
                    },
                ],
            },
            {
                key: 'medication',
                label: 'Medication',
                description: 'Optional discharge medication steps and bedside education.',
                items: [
                    {
                        key: 'discharge-prescription',
                        label: 'Discharge prescription issued',
                        statusText: issues.value.pharmacyOrders
                            ? 'Unable to verify from Pharmacy Orders.'
                            : dispensedPharmacyOrder
                              ? `Dispensed order ${dispensedPharmacyOrder.orderNumber || 'available'} found.`
                              : 'No dispensed pharmacy order found for this admission.',
                        required: false,
                        complete: !issues.value.pharmacyOrders && Boolean(dispensedPharmacyOrder),
                        source: issues.value.pharmacyOrders ? 'unavailable' : 'live',
                        actionLabel: canReadPharmacyOrders.value ? 'Open pharmacy' : undefined,
                        actionHref: canReadPharmacyOrders.value ? `/pharmacy-orders?patientId=${current.patientId}` : undefined,
                    },
                    {
                        key: 'medication-counselling',
                        label: 'Medication counselling noted',
                        statusText: manualChecklist.medicationCounsellingNoted ? 'Counselling confirmed for this discharge.' : 'Mark this once counselling is documented.',
                        required: false,
                        complete: manualChecklist.medicationCounsellingNoted,
                        source: 'manual',
                        manualKey: 'medicationCounsellingNoted',
                    },
                ],
            },
            {
                key: 'administrative',
                label: 'Administrative',
                description: 'Optional billing completion and patient payment planning.',
                items: [
                    {
                        key: 'invoice-issued',
                        label: 'Invoice issued',
                        statusText: issues.value.billingInvoices
                            ? 'Unable to verify from Billing.'
                            : issuedInvoices.length > 0
                              ? `${issuedInvoices.length} billing ${issuedInvoices.length === 1 ? 'invoice is' : 'invoices are'} on file.`
                              : 'No non-draft billing invoice found for this admission.',
                        required: false,
                        complete: !issues.value.billingInvoices && issuedInvoices.length > 0,
                        source: issues.value.billingInvoices ? 'unavailable' : 'live',
                        actionLabel: canReadBillingInvoices.value ? 'Open billing' : undefined,
                        actionHref: canReadBillingInvoices.value ? `/billing?patientId=${current.patientId}` : undefined,
                    },
                    {
                        key: 'payment-settled',
                        label: 'Payment settled or plan confirmed',
                        statusText: issues.value.billingInvoices
                            ? 'Unable to verify billing settlement automatically.'
                            : settledInvoice
                              ? `Billing settled on ${settledInvoice.invoiceNumber || 'latest invoice'}.`
                              : manualChecklist.paymentPlanConfirmed
                                ? 'Payment plan confirmed for discharge.'
                                : issuedInvoices.length > 0
                                  ? 'Invoice exists, but payment is still open.'
                                  : 'No payment plan or settled invoice recorded yet.',
                        required: false,
                        complete: !issues.value.billingInvoices && Boolean(settledInvoice || manualChecklist.paymentPlanConfirmed),
                        source: issues.value.billingInvoices ? 'unavailable' : settledInvoice ? 'mixed' : 'manual',
                        manualKey: settledInvoice ? undefined : 'paymentPlanConfirmed',
                        actionLabel: canReadBillingInvoices.value ? 'Open billing' : undefined,
                        actionHref: canReadBillingInvoices.value ? `/billing?patientId=${current.patientId}` : undefined,
                    },
                ],
            },
            {
                key: 'logistics',
                label: 'Logistics',
                description: 'Optional handoff confirmation before the patient leaves the ward.',
                items: [
                    {
                        key: 'transport',
                        label: 'Transport arranged or self-discharge confirmed',
                        statusText: manualChecklist.transportConfirmed ? 'Transport/self-discharge confirmation captured.' : 'Mark this once the patient transport plan is confirmed.',
                        required: false,
                        complete: manualChecklist.transportConfirmed,
                        source: 'manual',
                        manualKey: 'transportConfirmed',
                    },
                ],
            },
        ];
    });

    const requiredItems = computed(() => sections.value.flatMap((s) => s.items).filter((i) => i.required));
    const requiredComplete = computed(() => requiredItems.value.filter((i) => i.complete).length);
    const requiredTotal = computed(() => requiredItems.value.length);

    // Fail-open only when every linked module is unavailable — matches the
    // legacy page's own reasoning: better to let discharge proceed than to
    // permanently block it because Medical Records/Lab/Pharmacy/Billing are
    // all down, but a single module's outage still correctly blocks (each
    // required item's own `complete` already factors in its own `issues`).
    const canConfirmDischarge = computed(() => {
        if (loading.value) return false;
        if (allUnavailable.value) return true;
        return requiredComplete.value === requiredTotal.value;
    });

    const blockReason = computed(() => {
        if (loading.value) return 'Checking required discharge steps first.';
        if (allUnavailable.value) return '';
        const blocking = requiredItems.value.find((i) => !i.complete);
        return blocking ? `Complete required discharge steps first: ${blocking.label}.` : '';
    });

    function setManualChecklistValue(key: DischargeReadinessItem['manualKey'], value: boolean): void {
        if (!key) return;
        manualChecklist[key] = value;
    }

    return {
        loading,
        sections,
        requiredComplete,
        requiredTotal,
        canConfirmDischarge,
        blockReason,
        manualChecklist,
        setManualChecklistValue,
    };
}
