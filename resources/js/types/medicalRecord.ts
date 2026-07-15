import type { MedicalRecordNoteType } from '@/pages/medical-records/noteTypes';

/**
 * Shape returned by MedicalRecordResponseTransformer (see
 * reports/clinical-note-audit/08-api-inventory.md §8.5). Camel-cased, matching
 * the actual JSON the existing endpoints already return — unchanged by the
 * rebuild.
 */
export type MedicalRecordStatus = 'draft' | 'finalized' | 'amended' | 'archived';

export type MedicalRecordHandoffStatus = 'pending' | 'accepted' | 'declined' | null;

export type MedicalRecordResponse = {
    id: string;
    recordNumber: string;
    patientId: string;
    encounterId: string | null;
    admissionId: string | null;
    appointmentId: string | null;
    appointmentReferralId: string | null;
    theatreProcedureId: string | null;
    authorUserId: number | null;
    handedOffToUserId: number | null;
    handoffInitiatedByUserId: number | null;
    handoffStatus: MedicalRecordHandoffStatus;
    handoffNote: string | null;
    handedOffAt: string | null;
    handedOffToUserName: string | null;
    handoffInitiatedByUserName: string | null;
    encounterAt: string;
    recordType: MedicalRecordNoteType | string;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    diagnosisCode: string | null;
    status: MedicalRecordStatus | string;
    statusReason: string | null;
    signedByUserId: number | null;
    signedByUserName: string | null;
    authorUserName: string | null;
    signedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

/** The editable narrative + diagnosis fields of a note. */
export type MedicalRecordDraftContent = {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    diagnosisCode: string;
};

/** Visit-context linkage used when first creating a draft. */
export type MedicalRecordVisitContext = {
    patientId: string;
    encounterId?: string | null;
    appointmentId?: string | null;
    admissionId?: string | null;
    appointmentReferralId?: string | null;
    theatreProcedureId?: string | null;
    encounterAt: string;
    recordType: MedicalRecordNoteType | string;
};

export const EMPTY_DRAFT_CONTENT: MedicalRecordDraftContent = {
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    diagnosisCode: '',
};
