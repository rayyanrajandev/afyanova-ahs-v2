/**
 * Concrete item/status-count types for the 4 domains backed by
 * usePatientChartOrderStream (laboratory/radiology/pharmacy/theatre).
 * Widened in Phase 2 to carry encounterId/patientId/lifecycle fields needed
 * by the Orders tab (current-care sorting, lifecycle actions, follow-on
 * order permission checks) and the appointmentId → encounterId scoping fix.
 */

export type PatientChartCurrentCareNextAction = {
    key: string;
    label: string;
    emphasis?: 'primary' | 'secondary' | 'warning';
};

export type PatientChartCurrentCareFlags = {
    isCurrent: boolean;
    requiresReview: boolean;
    priorityRank: number;
    workflowHint?: string | null;
    nextAction?: PatientChartCurrentCareNextAction | null;
};

export type PatientChartLaboratoryOrder = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    encounterId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    orderedAt: string | null;
    testName: string | null;
    priority: string | null;
    resultSummary: string | null;
    resultedAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    currentCare?: PatientChartCurrentCareFlags | null;
};

export type PatientChartLaboratoryOrderStatusCounts = {
    ordered: number;
    collected: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    total: number;
};

export type PatientChartRadiologyOrder = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    encounterId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    orderedAt: string | null;
    modality: string | null;
    studyDescription: string | null;
    reportSummary: string | null;
    completedAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    currentCare?: PatientChartCurrentCareFlags | null;
};

export type PatientChartRadiologyOrderStatusCounts = {
    ordered: number;
    scheduled: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    other: number;
    total: number;
};

export type PatientChartPharmacyOrder = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    encounterId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    orderedAt: string | null;
    medicationName: string | null;
    dosageInstruction: string | null;
    quantityPrescribed: string | number | null;
    quantityDispensed: string | number | null;
    dispensedAt: string | null;
    reconciliationStatus: string | null;
    reconciledAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    currentCare?: PatientChartCurrentCareFlags | null;
};

export type PatientChartPharmacyOrderStatusCounts = {
    pending: number;
    in_preparation: number;
    partially_dispensed: number;
    dispensed: number;
    cancelled: number;
    total: number;
};

export type PatientChartTheatreProcedure = {
    id: string;
    procedureNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    encounterId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    scheduledAt: string | null;
    procedureType: string | null;
    procedureName: string | null;
    theatreRoomName: string | null;
    completedAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    notes: string | null;
    currentCare?: PatientChartCurrentCareFlags | null;
};

export type PatientChartTheatreProcedureStatusCounts = {
    planned: number;
    in_preop: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    other: number;
    total: number;
};
