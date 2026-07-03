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
            'What the patient reports \u2014 chief complaint, symptom onset, duration, severity, aggravating/relieving factors, and relevant history.',
    },
    objective: {
        description: 'Examination findings, vitals, and observable clinical notes.',
        placeholder: 'e.g. Vitals, exam findings, labs, observations...',
        helperText:
            'What you observe and measure \u2014 vital signs, physical examination findings, lab results, and imaging.',
    },
    assessment: {
        description: 'Clinical assessment or impression for this encounter.',
        placeholder: 'e.g. Diagnosis, differential, clinical impression...',
        helperText:
            'Your clinical impression \u2014 working or confirmed diagnosis, severity, differential, and response to any prior treatment.',
    },
    plan: {
        description:
            'Treatment plan, orders, follow-up instructions, and next steps.',
        placeholder: 'e.g. Treatment, medications, follow-up, referrals...',
        helperText:
            'What happens next \u2014 medications, investigations, referrals, patient education, and follow-up plan.',
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
                'The presenting complaint that led to admission, symptom timeline, prior treatments, and relevant background.',
        },
        objective: {
            description:
                'Examination findings, vitals, and admitting observations.',
            placeholder:
                'e.g. Febrile, tachypnoeic, oxygen saturation 90% on room air...',
            helperText:
                'Admission vitals, physical exam, bedside findings, and any results available at the time of admission.',
        },
        assessment: {
            description:
                'Admitting impression, working diagnoses, and immediate risks.',
            placeholder:
                'e.g. Severe community-acquired pneumonia with dehydration risk...',
            helperText:
                'Admitting diagnosis, differential diagnoses, severity assessment, and immediate clinical concerns.',
        },
        plan: {
            description:
                'Admission orders, monitoring plan, investigations, and escalation steps.',
            placeholder:
                'e.g. Admit to medical ward, start IV antibiotics, oxygen, CBC, chest X-ray...',
            helperText:
                'Admission orders \u2014 ward placement, medications, IV fluids, investigations, monitoring, and escalation plan.',
        },
    },
    progress_note: {
        subjective: {
            description:
                'Interval symptoms, patient-reported response, and new concerns.',
            placeholder:
                'e.g. Pain improved overnight, no vomiting, still breathless on exertion...',
            helperText:
                'What changed since the last review \u2014 current symptoms, patient-reported response to treatment, new concerns.',
        },
        objective: {
            description:
                'Current findings, vitals, and observable progress since the last review.',
            placeholder:
                'e.g. Afebrile, BP stable, urine output adequate, wound dry...',
            helperText:
                'Current vitals, exam findings, interval results, and objective measures of progress or decline.',
        },
        assessment: {
            description:
                'Updated clinical impression and response to treatment.',
            placeholder:
                'e.g. Improving response to antibiotics, hydration status corrected...',
            helperText:
                'Updated clinical impression \u2014 improving, stable, or worsening. Revised differential if applicable.',
        },
        plan: {
            description:
                'Ongoing treatment, repeat reviews, and next care steps.',
            placeholder:
                'e.g. Continue current regimen, review in 24 hours, repeat full blood count...',
            helperText:
                'Continuation or changes to treatment, next review timing, outstanding investigations, and goals.',
        },
    },
    discharge_note: {
        subjective: {
            description:
                'Patient-reported status at discharge and any remaining concerns.',
            placeholder:
                'e.g. Pain controlled, walking independently, no new complaints...',
            helperText:
                'Patient\'s condition at discharge \u2014 symptom resolution, remaining concerns, and functional status.',
        },
        objective: {
            description:
                'Final observations, discharge condition, and clinically relevant results.',
            placeholder:
                'e.g. Afebrile, tolerating diet, vital signs stable, wound clean...',
            helperText:
                'Discharge vitals, final examination findings, and results confirming readiness for discharge.',
        },
        assessment: {
            description:
                'Discharge assessment, resolved problems, and ongoing concerns.',
            placeholder:
                'e.g. Improved from severe malaria, stable for home follow-up...',
            helperText:
                'Outcome of admission \u2014 resolved diagnoses, ongoing conditions, and discharge fitness.',
        },
        plan: {
            description:
                'Medicines, follow-up instructions, referrals, and return precautions.',
            placeholder:
                'e.g. Complete oral antibiotics, review in 7 days, return if fever or shortness of breath recurs...',
            helperText:
                'Discharge medications, follow-up appointments, activity restrictions, warning signs, and patient instructions.',
        },
    },
    referral_note: {
        subjective: {
            description:
                'Referral reason, interval history, and key concerns from the current team.',
            placeholder:
                'e.g. Persistent severe abdominal pain with concern for surgical review...',
            helperText:
                'Reason for referral, key history, and what the receiving team needs to know first.',
        },
        objective: {
            description:
                'Current findings, key results, and observable clinical status.',
            placeholder:
                'e.g. Guarding in right lower quadrant, pulse 112, ultrasound pending...',
            helperText:
                'Current clinical status, key findings, and results supporting the referral.',
        },
        assessment: {
            description:
                'Working diagnosis, referral indication, and urgency for receiving review.',
            placeholder:
                'e.g. Suspected appendicitis requiring urgent surgical assessment...',
            helperText:
                'Working diagnosis and why this specialty or facility is needed.',
        },
        plan: {
            description:
                'Receiving team request, transfer instructions, and immediate actions while awaiting handoff.',
            placeholder:
                'e.g. Refer to surgical team, keep nil by mouth, continue IV fluids, arrange escorted transfer...',
            helperText:
                'Specific request to the receiving team, interim management, and transfer instructions.',
        },
    },
    nursing_note: {
        subjective: {
            description:
                'Patient concerns, caregiver reports, comfort issues, and nursing-relevant history.',
            placeholder:
                'e.g. Reports poor sleep, moderate pain at wound site, reduced appetite...',
            helperText:
                'Patient-reported concerns, comfort issues, sleep, appetite, pain, and caregiver observations.',
        },
        objective: {
            description:
                'Nursing observations, vitals, intake/output, wound status, and bedside findings.',
            placeholder:
                'e.g. BP 118/72, urine output adequate, dressing dry, pain score 4/10...',
            helperText:
                'Nursing observations \u2014 vital signs, intake/output, wound status, mobility, and skin integrity.',
        },
        assessment: {
            description:
                'Current nursing assessment, response to care, and identified risks.',
            placeholder:
                'e.g. Pain improving after analgesia, pressure injury risk remains moderate...',
            helperText:
                'Nursing assessment \u2014 response to interventions, fall/skin risk, and comfort level.',
        },
        plan: {
            description:
                'Nursing interventions, monitoring frequency, escalation triggers, and handoff instructions.',
            placeholder:
                'e.g. Continue two-hourly turns, monitor temperature four-hourly, escalate if pain worsens...',
            helperText:
                'Nursing interventions, monitoring schedule, escalation triggers, and handoff notes.',
        },
    },
    procedure_note: {
        subjective: {
            description:
                'Procedure indication, pre-procedure history, consent context, and key preparation notes.',
            placeholder:
                'e.g. Referred for bronchoscopy after persistent hemoptysis despite initial treatment...',
            helperText:
                'Procedure indication, consent status, relevant history, and pre-procedure preparation.',
        },
        objective: {
            description:
                'Procedure details, findings, anaesthesia context, and documented intra-procedure observations.',
            placeholder:
                'e.g. Flexible bronchoscopy completed under monitored sedation, no active endobronchial bleeding seen...',
            helperText:
                'Procedure performed, technique, findings, specimens collected, and patient tolerance.',
        },
        assessment: {
            description:
                'Procedure impression, immediate interpretation, and clinically relevant outcome.',
            placeholder:
                'e.g. Findings support inflammatory airway disease; no obstructing lesion identified...',
            helperText:
                'Procedural outcome, immediate interpretation, and clinical significance.',
        },
        plan: {
            description:
                'Post-procedure instructions, monitoring, specimen follow-up, and next management steps.',
            placeholder:
                'e.g. Observe in recovery for two hours, monitor oxygen saturation, send lavage sample, review with surgery team...',
            helperText:
                'Post-procedure care, monitoring, specimens sent, complications to watch for, and follow-up.',
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
