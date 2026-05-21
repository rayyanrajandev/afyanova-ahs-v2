import { apiGet, apiPost } from '@/lib/apiClient';

export type EncounterOrderContext = {
    patientId: string;
    encounterId?: string;
    appointmentId?: string;
    admissionId?: string;
};

export type EncounterInlineOrderType = 'laboratory' | 'pharmacy' | 'radiology';

export type ClinicalCatalogItem = {
    id: string;
    code: string | null;
    name: string | null;
    category: string | null;
    unit: string | null;
    description: string | null;
    metadata: Record<string, unknown> | null;
    status: string | null;
};

type ClinicalCatalogItemListResponse = {
    data: ClinicalCatalogItem[];
};

type DuplicateOrderSummary = {
    id: string;
    orderNumber: string | null;
    status: string | null;
    orderedAt: string | null;
};

export type EncounterDuplicateCheckResult = {
    severity: 'none' | 'warning' | 'critical' | string;
    messages: string[];
    sameEncounterDuplicates: DuplicateOrderSummary[];
    recentPatientDuplicates: DuplicateOrderSummary[];
};

type DuplicateCheckResponse = {
    data: EncounterDuplicateCheckResult;
};

export type MedicationSafetyContinuationDecision = {
    acknowledged: boolean;
    overrideCode: string | null;
    overrideReason: string | null;
};

export type PatientMedicationSafetySummary = {
    blockers: string[];
    warnings: string[];
};

type PatientMedicationSafetySummaryResponse = {
    data: PatientMedicationSafetySummary;
};

export const radiologyModalityOptions = [
    { value: 'xray', label: 'X-Ray' },
    { value: 'ultrasound', label: 'Ultrasound' },
    { value: 'ct', label: 'CT' },
    { value: 'mri', label: 'MRI' },
    { value: 'other', label: 'Other' },
] as const;

export const laboratoryPriorityOptions = [
    { value: 'routine', label: 'Routine' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'stat', label: 'STAT' },
] as const;

function catalogMetadataValue(
    catalogItem: ClinicalCatalogItem | null,
    keys: string[],
): string | null {
    if (!catalogItem?.metadata) return null;

    for (const key of keys) {
        const value = catalogItem.metadata[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return null;
}

export function labTestCatalogSpecimenType(
    catalogItem: ClinicalCatalogItem | null,
): string | null {
    return catalogMetadataValue(catalogItem, [
        'sampleType',
        'specimenType',
        'specimen_type',
    ]);
}

export function catalogItemLabel(item: ClinicalCatalogItem): string {
    const code = item.code?.trim();
    const name = item.name?.trim();

    if (code && name) return `${code} — ${name}`;
    return name || code || 'Unnamed catalog item';
}

export async function fetchLabTestCatalog(): Promise<ClinicalCatalogItem[]> {
    const response = await apiGet<ClinicalCatalogItemListResponse>(
        '/platform/admin/clinical-catalogs/lab-tests',
        {
            status: 'active',
            sortBy: 'name',
            sortDir: 'asc',
            perPage: 100,
            page: 1,
        },
    );

    return response.data ?? [];
}

export async function fetchApprovedMedicinesCatalog(): Promise<
    ClinicalCatalogItem[]
> {
    const response = await apiGet<ClinicalCatalogItemListResponse>(
        '/pharmacy-orders/approved-medicines-catalog',
        {
            status: 'active',
            sortBy: 'name',
            sortDir: 'asc',
            perPage: 100,
            page: 1,
        },
    );

    return response.data ?? [];
}

export async function fetchRadiologyProcedureCatalog(): Promise<
    ClinicalCatalogItem[]
> {
    const response = await apiGet<ClinicalCatalogItemListResponse>(
        '/platform/admin/clinical-catalogs/radiology-procedures',
        {
            status: 'active',
            sortBy: 'name',
            sortDir: 'asc',
            perPage: 100,
            page: 1,
        },
    );

    return response.data ?? [];
}

function generateClinicalOrderSessionId(prefix: string): string {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export type LaboratoryInlineOrderInput = {
    labTestCatalogItemId: string;
    testCode: string;
    testName: string;
    priority: 'routine' | 'urgent' | 'stat';
    specimenType: string;
    clinicalNotes: string;
};

export type PharmacyInlineOrderInput = {
    approvedMedicineCatalogItemId: string;
    medicationCode: string;
    medicationName: string;
    dosageInstruction: string;
    clinicalIndication: string;
    quantityPrescribed: number;
    dispensingNotes: string;
};

export function duplicateCheckDetails(result: EncounterDuplicateCheckResult): string[] {
    const details = [...result.messages];

    for (const order of result.sameEncounterDuplicates) {
        details.push(
            `Same encounter: ${order.orderNumber ?? order.id} (${order.status ?? 'unknown status'})`,
        );
    }

    for (const order of result.recentPatientDuplicates) {
        details.push(
            `Recent patient order: ${order.orderNumber ?? order.id} (${order.status ?? 'unknown status'})`,
        );
    }

    return details;
}

export async function fetchPatientMedicationSafetySummary(input: {
    patientId: string;
    appointmentId?: string | null;
    admissionId?: string | null;
    approvedMedicineCatalogItemId?: string | null;
    medicationCode?: string | null;
    medicationName?: string | null;
    dosageInstruction?: string | null;
    clinicalIndication?: string | null;
    quantityPrescribed?: string | number | null;
}): Promise<PatientMedicationSafetySummary | null> {
    const patientId = input.patientId.trim();
    if (!patientId) {
        return null;
    }

    const response = await apiGet<PatientMedicationSafetySummaryResponse>(
        `/patients/${patientId}/medication-safety-summary`,
        {
            appointmentId: input.appointmentId?.trim() || null,
            admissionId: input.admissionId?.trim() || null,
            approvedMedicineCatalogItemId:
                input.approvedMedicineCatalogItemId?.trim() || null,
            medicationCode: input.medicationCode?.trim() || null,
            medicationName: input.medicationName?.trim() || null,
            dosageInstruction: input.dosageInstruction?.trim() || null,
            clinicalIndication: input.clinicalIndication?.trim() || null,
            quantityPrescribed:
                input.quantityPrescribed === null ||
                input.quantityPrescribed === undefined
                    ? null
                    : Number(input.quantityPrescribed),
        },
    );

    return response.data;
}

export type PharmacyInlineOrderCreateOptions = {
    orderSessionId?: string;
    safetyDecision?: MedicationSafetyContinuationDecision | null;
};

export type RadiologyInlineOrderInput = {
    radiologyProcedureCatalogItemId: string;
    procedureCode: string;
    modality: string;
    studyDescription: string;
    clinicalIndication: string;
};

export async function checkLaboratoryDuplicate(
    context: EncounterOrderContext,
    item: Pick<
        LaboratoryInlineOrderInput,
        'labTestCatalogItemId' | 'testCode' | 'testName'
    >,
): Promise<EncounterDuplicateCheckResult> {
    const response = await apiGet<DuplicateCheckResponse>(
        '/laboratory-orders/duplicate-check',
        {
            patientId: context.patientId.trim(),
            encounterId: context.encounterId?.trim() || null,
            appointmentId: context.appointmentId?.trim() || null,
            admissionId: context.admissionId?.trim() || null,
            labTestCatalogItemId: item.labTestCatalogItemId.trim() || null,
            testCode: item.testCode.trim() || null,
        },
    );

    return response.data;
}

export async function checkPharmacyDuplicate(
    context: EncounterOrderContext,
    item: Pick<
        PharmacyInlineOrderInput,
        'approvedMedicineCatalogItemId' | 'medicationCode' | 'medicationName'
    >,
): Promise<EncounterDuplicateCheckResult> {
    const response = await apiGet<DuplicateCheckResponse>(
        '/pharmacy-orders/duplicate-check',
        {
            patientId: context.patientId.trim(),
            encounterId: context.encounterId?.trim() || null,
            appointmentId: context.appointmentId?.trim() || null,
            admissionId: context.admissionId?.trim() || null,
            approvedMedicineCatalogItemId:
                item.approvedMedicineCatalogItemId.trim() || null,
            medicationCode: item.medicationCode.trim() || null,
        },
    );

    return response.data;
}

export async function checkRadiologyDuplicate(
    context: EncounterOrderContext,
    item: Pick<
        RadiologyInlineOrderInput,
        'radiologyProcedureCatalogItemId' | 'procedureCode' | 'studyDescription'
    >,
): Promise<EncounterDuplicateCheckResult> {
    const response = await apiGet<DuplicateCheckResponse>(
        '/radiology-orders/duplicate-check',
        {
            patientId: context.patientId.trim(),
            encounterId: context.encounterId?.trim() || null,
            appointmentId: context.appointmentId?.trim() || null,
            admissionId: context.admissionId?.trim() || null,
            radiologyProcedureCatalogItemId:
                item.radiologyProcedureCatalogItemId.trim() || null,
            procedureCode: item.procedureCode.trim() || null,
        },
    );

    return response.data;
}

export async function createLaboratoryInlineOrder(
    context: EncounterOrderContext,
    item: LaboratoryInlineOrderInput,
    orderSessionId?: string,
) {
    return apiPost<{ data: Record<string, unknown> }>('/laboratory-orders', {
        body: {
            patientId: context.patientId.trim(),
            encounterId: context.encounterId?.trim() || null,
            appointmentId: context.appointmentId?.trim() || null,
            admissionId: context.admissionId?.trim() || null,
            orderSessionId: orderSessionId ?? generateClinicalOrderSessionId('lab-session'),
            entryMode: 'active',
            labTestCatalogItemId: item.labTestCatalogItemId.trim() || null,
            testCode: item.testCode.trim() || null,
            testName: item.testName.trim() || null,
            priority: item.priority,
            specimenType: item.specimenType.trim() || null,
            clinicalNotes: item.clinicalNotes.trim() || null,
        },
    });
}

export async function createPharmacyInlineOrder(
    context: EncounterOrderContext,
    item: PharmacyInlineOrderInput,
    options?: PharmacyInlineOrderCreateOptions,
) {
    const safetyDecision = options?.safetyDecision;

    return apiPost<{ data: Record<string, unknown> }>('/pharmacy-orders', {
        body: {
            patientId: context.patientId.trim(),
            encounterId: context.encounterId?.trim() || null,
            appointmentId: context.appointmentId?.trim() || null,
            admissionId: context.admissionId?.trim() || null,
            orderSessionId:
                options?.orderSessionId ??
                generateClinicalOrderSessionId('pharm-session'),
            entryMode: 'active',
            approvedMedicineCatalogItemId:
                item.approvedMedicineCatalogItemId.trim() || null,
            medicationCode: item.medicationCode.trim(),
            medicationName: item.medicationName.trim(),
            dosageInstruction: item.dosageInstruction.trim(),
            clinicalIndication: item.clinicalIndication.trim() || null,
            quantityPrescribed: item.quantityPrescribed,
            quantityDispensed: null,
            dispensingNotes: item.dispensingNotes.trim() || null,
            safetyAcknowledged: safetyDecision?.acknowledged === true,
            safetyOverrideCode: safetyDecision?.overrideCode ?? null,
            safetyOverrideReason: safetyDecision?.overrideReason ?? null,
        },
    });
}

export async function createRadiologyInlineOrder(
    context: EncounterOrderContext,
    item: RadiologyInlineOrderInput,
    orderSessionId?: string,
) {
    return apiPost<{ data: Record<string, unknown> }>('/radiology-orders', {
        body: {
            patientId: context.patientId.trim(),
            encounterId: context.encounterId?.trim() || null,
            appointmentId: context.appointmentId?.trim() || null,
            admissionId: context.admissionId?.trim() || null,
            orderSessionId:
                orderSessionId ?? generateClinicalOrderSessionId('rad-session'),
            entryMode: 'active',
            orderedByUserId: null,
            radiologyProcedureCatalogItemId:
                item.radiologyProcedureCatalogItemId.trim() || null,
            procedureCode: item.procedureCode.trim() || null,
            modality: item.modality,
            studyDescription: item.studyDescription.trim() || null,
            clinicalIndication: item.clinicalIndication.trim() || null,
            scheduledFor: null,
        },
    });
}

export function encounterInlineOrderTypeLabel(
    type: EncounterInlineOrderType,
): string {
    switch (type) {
        case 'laboratory':
            return 'Laboratory order';
        case 'pharmacy':
            return 'Pharmacy order';
        case 'radiology':
            return 'Imaging order';
    }
}
