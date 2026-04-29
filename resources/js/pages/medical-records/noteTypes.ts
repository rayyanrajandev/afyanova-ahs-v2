import { formatEnumLabel } from '@/lib/labels';

export const MEDICAL_RECORD_NOTE_TYPE_OPTIONS = [
    {
        value: 'consultation_note',
        label: 'Consultation note',
        helperText: 'Use for the first clinician assessment or provider consultation for this visit.',
    },
    {
        value: 'admission_note',
        label: 'Admission note',
        helperText: 'Use for initial inpatient clerking, admission history, and the opening ward assessment.',
    },
    {
        value: 'progress_note',
        label: 'Progress note',
        helperText: 'Use for follow-up reviews, ward-round updates, and continuing care documentation.',
    },
    {
        value: 'discharge_note',
        label: 'Discharge note',
        helperText: 'Use when summarizing completed care, discharge status, medicines, and follow-up instructions.',
    },
    {
        value: 'referral_note',
        label: 'Referral note',
        helperText: 'Use when handing the patient to another clinician, department, or facility with clear referral context.',
    },
    {
        value: 'nursing_note',
        label: 'Nursing note',
        helperText: 'Use for nursing assessment, bedside care updates, handover context, and nursing observations.',
    },
    {
        value: 'procedure_note',
        label: 'Procedure note',
        helperText: 'Use for operative or procedural documentation linked to a booked theatre or procedure workflow.',
    },
] as const;

export type MedicalRecordNoteTypeOption = (typeof MEDICAL_RECORD_NOTE_TYPE_OPTIONS)[number];
export type MedicalRecordNoteType = MedicalRecordNoteTypeOption['value'];
export type MedicalRecordNarrativeSectionKey =
    | 'subjective'
    | 'objective'
    | 'assessment'
    | 'plan';
type MedicalRecordNarrativeSectionUi = {
    description: string;
    placeholder: string;
    helperText: string;
};
type MedicalRecordNarrativeHeading = {
    title: string;
    subtitle: string;
};
type MedicalRecordNarrativeSectionLabel = string;

const MEDICAL_RECORD_NOTE_TYPE_MAP = new Map<string, MedicalRecordNoteTypeOption>(
    MEDICAL_RECORD_NOTE_TYPE_OPTIONS.map((option) => [option.value, option]),
);

const DEFAULT_SECTION_UI: Record<
    MedicalRecordNarrativeSectionKey,
    MedicalRecordNarrativeSectionUi
> = {
    subjective: {
        description: 'Patient-reported symptoms, history, and complaints.',
        placeholder: 'e.g. Symptoms, duration, severity, relevant history...',
        helperText:
            'Patient-reported symptoms, history, and complaints. Basic formatting is supported.',
    },
    objective: {
        description: 'Examination findings, vitals, and observable clinical notes.',
        placeholder: 'e.g. Vitals, exam findings, labs, observations...',
        helperText: 'Examination findings, vitals, and observable clinical notes.',
    },
    assessment: {
        description: 'Clinical assessment or impression for this encounter.',
        placeholder: 'e.g. Diagnosis, differential, clinical impression...',
        helperText: 'Clinical assessment or impression for this encounter.',
    },
    plan: {
        description:
            'Treatment plan, orders, follow-up instructions, and next steps.',
        placeholder: 'e.g. Treatment, medications, follow-up, referrals...',
        helperText:
            'Treatment plan, orders, follow-up instructions, and next steps.',
    },
};

const DEFAULT_SECTION_LABELS: Record<
    MedicalRecordNarrativeSectionKey,
    MedicalRecordNarrativeSectionLabel
> = {
    subjective: 'Subjective',
    objective: 'Objective',
    assessment: 'Assessment',
    plan: 'Plan',
};

const MEDICAL_RECORD_NOTE_TYPE_NARRATIVE_HEADINGS: Record<
    MedicalRecordNoteType,
    MedicalRecordNarrativeHeading
> = {
    consultation_note: {
        title: 'Consultation narrative',
        subtitle:
            'Capture the current clinical story, examination, impression, and plan for this visit.',
    },
    admission_note: {
        title: 'Admission narrative',
        subtitle:
            'Capture the opening inpatient history, findings, admitting impression, and the initial ward plan.',
    },
    progress_note: {
        title: 'Progress narrative',
        subtitle:
            'Capture interval change, current findings, updated assessment, and the ongoing care plan.',
    },
    discharge_note: {
        title: 'Discharge narrative',
        subtitle:
            'Capture completed care, discharge condition, medicines, and follow-up instructions.',
    },
    referral_note: {
        title: 'Referral handoff',
        subtitle:
            'Capture the transfer reason, current clinical summary, receiving context, and next actions.',
    },
    nursing_note: {
        title: 'Nursing narrative',
        subtitle:
            'Capture bedside observations, nursing assessment, interventions, and handoff context.',
    },
    procedure_note: {
        title: 'Procedure narrative',
        subtitle:
            'Capture the procedure indication, key findings, intra-procedure summary, and the immediate post-procedure plan.',
    },
};

const MEDICAL_RECORD_NOTE_TYPE_SECTION_UI: Partial<
    Record<
        MedicalRecordNoteType,
        Partial<Record<MedicalRecordNarrativeSectionKey, MedicalRecordNarrativeSectionUi>>
    >
> = {
    admission_note: {
        subjective: {
            description:
                'Presenting complaints, admission history, and relevant background.',
            placeholder:
                'e.g. Fever and shortness of breath for three days, worsening overnight...',
            helperText:
                'Document the inpatient presentation, prior care, and the history leading to admission.',
        },
        objective: {
            description:
                'Examination findings, vitals, and admitting observations.',
            placeholder:
                'e.g. Febrile, tachypnoeic, oxygen saturation 90% on room air...',
            helperText:
                'Record the admission examination, bedside findings, and any results available now.',
        },
        assessment: {
            description:
                'Admitting impression, working diagnoses, and immediate risks.',
            placeholder:
                'e.g. Severe community-acquired pneumonia with dehydration risk...',
            helperText:
                'Summarize the admitting impression, differential, and the major inpatient concerns.',
        },
        plan: {
            description:
                'Admission orders, monitoring plan, investigations, and escalation steps.',
            placeholder:
                'e.g. Admit to medical ward, start IV antibiotics, oxygen, CBC, chest X-ray...',
            helperText:
                'Capture the initial inpatient management plan and what the ward team should do next.',
        },
    },
    progress_note: {
        subjective: {
            description:
                'Interval symptoms, patient-reported response, and new concerns.',
            placeholder:
                'e.g. Pain improved overnight, no vomiting, still breathless on exertion...',
            helperText:
                'Record what changed since the last review and what the patient or caregiver is reporting now.',
        },
        objective: {
            description:
                'Current findings, vitals, and observable progress since the last review.',
            placeholder:
                'e.g. Afebrile, BP stable, urine output adequate, wound dry...',
            helperText:
                'Document the current clinical state, observations, and interval results.',
        },
        assessment: {
            description:
                'Updated clinical impression and response to treatment.',
            placeholder:
                'e.g. Improving response to antibiotics, hydration status corrected...',
            helperText:
                'Summarize whether the patient is improving, worsening, or needs a change in direction.',
        },
        plan: {
            description:
                'Ongoing treatment, repeat reviews, and next care steps.',
            placeholder:
                'e.g. Continue current regimen, review in 24 hours, repeat full blood count...',
            helperText:
                'Capture what continues, what changes, and what should happen before the next review.',
        },
    },
    discharge_note: {
        subjective: {
            description:
                'Patient-reported status at discharge and any remaining concerns.',
            placeholder:
                'e.g. Pain controlled, walking independently, no new complaints...',
            helperText:
                'Record how the patient feels at discharge and any issues still needing attention.',
        },
        objective: {
            description:
                'Final observations, discharge condition, and clinically relevant results.',
            placeholder:
                'e.g. Afebrile, tolerating diet, vital signs stable, wound clean...',
            helperText:
                'Document the final inpatient condition and objective readiness for discharge.',
        },
        assessment: {
            description:
                'Discharge assessment, resolved problems, and ongoing concerns.',
            placeholder:
                'e.g. Improved from severe malaria, stable for home follow-up...',
            helperText:
                'Summarize the outcome of care and what remains active at discharge.',
        },
        plan: {
            description:
                'Medicines, follow-up instructions, referrals, and return precautions.',
            placeholder:
                'e.g. Complete oral antibiotics, review in 7 days, return if fever or shortness of breath recurs...',
            helperText:
                'Capture the full discharge plan so follow-up and patient education stay clear.',
        },
    },
    referral_note: {
        subjective: {
            description:
                'Referral reason, interval history, and key concerns from the current team.',
            placeholder:
                'e.g. Persistent severe abdominal pain with concern for surgical review...',
            helperText:
                'Explain why the patient is being referred and the history the receiving team needs first.',
        },
        objective: {
            description:
                'Current findings, key results, and observable clinical status.',
            placeholder:
                'e.g. Guarding in right lower quadrant, pulse 112, ultrasound pending...',
            helperText:
                'Document the current bedside findings and any results that support the referral.',
        },
        assessment: {
            description:
                'Working diagnosis, referral indication, and urgency for receiving review.',
            placeholder:
                'e.g. Suspected appendicitis requiring urgent surgical assessment...',
            helperText:
                'Summarize the clinical impression and why another team or facility is needed now.',
        },
        plan: {
            description:
                'Receiving team request, transfer instructions, and immediate actions while awaiting handoff.',
            placeholder:
                'e.g. Refer to surgical team, keep nil by mouth, continue IV fluids, arrange escorted transfer...',
            helperText:
                'State exactly what is being requested and what should happen before or during transfer.',
        },
    },
    nursing_note: {
        subjective: {
            description:
                'Patient concerns, caregiver reports, comfort issues, and nursing-relevant history.',
            placeholder:
                'e.g. Reports poor sleep, moderate pain at wound site, reduced appetite...',
            helperText:
                'Capture the bedside concerns and history that matter to nursing care right now.',
        },
        objective: {
            description:
                'Nursing observations, vitals, intake/output, wound status, and bedside findings.',
            placeholder:
                'e.g. BP 118/72, urine output adequate, dressing dry, pain score 4/10...',
            helperText:
                'Document the observed nursing status, measurements, and bedside care findings.',
        },
        assessment: {
            description:
                'Current nursing assessment, response to care, and identified risks.',
            placeholder:
                'e.g. Pain improving after analgesia, pressure injury risk remains moderate...',
            helperText:
                'Summarize the nursing interpretation of the current condition and any safety concerns.',
        },
        plan: {
            description:
                'Nursing interventions, monitoring frequency, escalation triggers, and handoff instructions.',
            placeholder:
                'e.g. Continue two-hourly turns, monitor temperature four-hourly, escalate if pain worsens...',
            helperText:
                'Record the nursing actions, surveillance plan, and what the next shift should continue or watch.',
        },
    },
    procedure_note: {
        subjective: {
            description:
                'Procedure indication, pre-procedure history, consent context, and key preparation notes.',
            placeholder:
                'e.g. Referred for bronchoscopy after persistent hemoptysis despite initial treatment...',
            helperText:
                'Record why the procedure is being done now and the pre-procedure clinical context the theatre team should see.',
        },
        objective: {
            description:
                'Procedure details, findings, anaesthesia context, and documented intra-procedure observations.',
            placeholder:
                'e.g. Flexible bronchoscopy completed under monitored sedation, no active endobronchial bleeding seen...',
            helperText:
                'Document what was done, how it was performed, and the key objective findings from the procedure itself.',
        },
        assessment: {
            description:
                'Procedure impression, immediate interpretation, and clinically relevant outcome.',
            placeholder:
                'e.g. Findings support inflammatory airway disease; no obstructing lesion identified...',
            helperText:
                'Summarize the procedural impression and what it means for the patient right now.',
        },
        plan: {
            description:
                'Post-procedure instructions, monitoring, specimen follow-up, and next management steps.',
            placeholder:
                'e.g. Observe in recovery for two hours, monitor oxygen saturation, send lavage sample, review with surgery team...',
            helperText:
                'Capture the recovery plan, follow-up actions, and what the next team needs to continue.',
        },
    },
};

const MEDICAL_RECORD_NOTE_TYPE_SECTION_LABELS: Partial<
    Record<
        MedicalRecordNoteType,
        Partial<Record<MedicalRecordNarrativeSectionKey, MedicalRecordNarrativeSectionLabel>>
    >
> = {
    procedure_note: {
        subjective: 'Indication',
        objective: 'Procedure details',
        assessment: 'Outcome',
        plan: 'Recovery plan',
    },
};

export const DEFAULT_MEDICAL_RECORD_NOTE_TYPE: MedicalRecordNoteType = 'consultation_note';

export function sanitizeMedicalRecordNoteType(value: string | null | undefined): MedicalRecordNoteType {
    const normalized = (value ?? '').trim().toLowerCase();

    if (MEDICAL_RECORD_NOTE_TYPE_MAP.has(normalized)) {
        return normalized as MedicalRecordNoteType;
    }

    return DEFAULT_MEDICAL_RECORD_NOTE_TYPE;
}

export function medicalRecordNoteTypeLabel(value: string | null | undefined): string {
    const normalized = (value ?? '').trim().toLowerCase();

    return MEDICAL_RECORD_NOTE_TYPE_MAP.get(normalized)?.label ?? formatEnumLabel(value);
}

export function medicalRecordNoteTypeHelperText(value: string | null | undefined): string {
    const normalized = (value ?? '').trim().toLowerCase();

    return (
        MEDICAL_RECORD_NOTE_TYPE_MAP.get(normalized)?.helperText
        ?? 'Choose the note structure that matches this encounter.'
    );
}

export function medicalRecordNoteTypeDraftLabel(
    value: string | null | undefined,
): string {
    return `${medicalRecordNoteTypeLabel(value).toLowerCase()} draft`;
}

export function medicalRecordNoteTypeNarrativeHeading(
    value: string | null | undefined,
): MedicalRecordNarrativeHeading {
    const normalized = sanitizeMedicalRecordNoteType(value);

    return MEDICAL_RECORD_NOTE_TYPE_NARRATIVE_HEADINGS[normalized];
}

export function medicalRecordNoteTypeSectionUi(
    value: string | null | undefined,
    section: MedicalRecordNarrativeSectionKey,
): MedicalRecordNarrativeSectionUi {
    const normalized = sanitizeMedicalRecordNoteType(value);

    return (
        MEDICAL_RECORD_NOTE_TYPE_SECTION_UI[normalized]?.[section]
        ?? DEFAULT_SECTION_UI[section]
    );
}

export function medicalRecordNoteTypeSectionLabel(
    value: string | null | undefined,
    section: MedicalRecordNarrativeSectionKey,
): MedicalRecordNarrativeSectionLabel {
    const normalized = sanitizeMedicalRecordNoteType(value);

    return (
        MEDICAL_RECORD_NOTE_TYPE_SECTION_LABELS[normalized]?.[section]
        ?? DEFAULT_SECTION_LABELS[section]
    );
}
