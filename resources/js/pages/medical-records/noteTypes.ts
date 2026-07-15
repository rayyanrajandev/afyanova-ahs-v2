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

const SOAP_SAMPLE_DEFAULT: Record<MedicalRecordNarrativeSectionKey, string> = {
    subjective:
        'A 34-year-old female presents with a 2-day history of lower abdominal pain and burning on urination. Reports increased frequency and urgency. No fever, flank pain, or vaginal discharge. No significant past medical history. No known drug allergies.',
    objective:
        'Temp 37.2\u00b0C, HR 76, BP 118/72, RR 16, SpO\u2082 98%. Abdomen: soft, mild suprapubic tenderness, no rebound. CVS: S1 S2 normal. Respiratory: clear.',
    assessment:
        'Uncomplicated lower urinary tract infection. Differential: cystitis vs urethritis.',
    plan:
        '1. Urinalysis + culture with sensitivity\n2. Nitrofurantoin 100 mg BID \u00d7 5 days\n3. Increase oral fluid intake\n4. Return if fever, flank pain, or vomiting develops\n5. Review in 48 hours',
};

const SOAP_SAMPLES: Partial<Record<MedicalRecordNoteType, Partial<Record<MedicalRecordNarrativeSectionKey, string>>>> = {
    consultation_note: {
        subjective:
            'A 58-year-old male with known hypertension and type 2 diabetes presents with a 1-week history of progressive shortness of breath on exertion and orthopnea. Reports 2-pillow orthopnea, paroxysmal nocturnal dyspnea, and bilateral ankle swelling. No chest pain or palpitations. Adherent to amlodipine 5 mg and metformin 1 g daily.',
        objective:
            'Temp 36.8\u00b0C, HR 92, BP 148/92, RR 22, SpO\u2082 91% on room air. JVP elevated at 6 cm. Bilateral basal crackles on auscultation. Lower limb pitting edema to mid-shin. ECG: sinus tachycardia, no acute ischemic changes.',
        assessment:
            'Acute decompensated heart failure (ADHF) with volume overload. Ejection fraction unknown \u2014 likely heart failure with reduced ejection fraction (HFrEF). Hypertension and diabetes suboptimally controlled. NYHA functional class III.',
        plan:
            '1. Supplemental oxygen to target SpO\u2082 \u226594%\n2. IV furosemide 40 mg stat, then reassess\n3. Chest X-ray, troponin, BNP, renal function, ECG\n4. Echocardiogram to assess LV function\n5. Optimize oral diuretics, start ACE inhibitor if renal function permits\n6. Strict intake-output charting, daily weight\n7. Cardiology referral for ongoing HF management\n8. Review in 24 hours or earlier if deteriorating',
    },
    admission_note: {
        subjective:
            'A 72-year-old male brought in by family with a 5-day history of confusion, fever, and productive cough with greenish sputum. Reported poor oral intake for 2 days. History of COPD, hypertension. No known allergies. Immunizations up to date.',
        objective:
            'Temp 38.9\u00b0C, HR 104, BP 100/65, RR 26, SpO\u2082 87% on room air. GCS 14/15 (E4 V4 M6). Chest: reduced breath sounds right base with bronchial breathing and crackles. Consolidation suspected right lower lobe. Capillary refill 3 seconds, dry mucous membranes.',
        assessment:
            'Severe community-acquired pneumonia (CAP) with sepsis. CURB-65 score: 3 (confusion, urea >7, age \u226565) \u2014 recommend admission for IV antibiotics and close monitoring. Acute kidney injury likely due to dehydration. Background COPD.',
        plan:
            '1. Admit to medical ward under isolation precautions\n2. IV ceftriaxone 2 g daily + azithromycin 500 mg daily\n3. IV fluids 0.9% normal saline 1 L stat, then 100 mL/hr\n4. Sputum culture, blood culture \u00d7 2, full blood count, CRP, renal function, chest X-ray\n5. Oxygen to target SpO\u2082 \u226592%\n6. Monitor GCS, urine output, vitals 4-hourly\n7. Escalate to ICU if SpO\u2082 <90% despite O\u2082 or GCS drops\n8. Review daily at morning ward round',
    },
    progress_note: {
        subjective:
            'Patient reports significant improvement in breathing overnight. No new chest pain or palpitations. Voiding well. Reports mild headache, which resolved after paracetamol.',
        objective:
            'Temp 36.9\u00b0C, HR 80, BP 130/82, RR 18, SpO\u2082 95% on 2 L nasal cannula. JVP now 3 cm. Chest: reduced crackles bilaterally. Urine output 1,200 mL over 12 hours. Weight down 1.5 kg from admission.',
        assessment:
            'Improving. Good diuretic response. Heart failure compensation progressing well. Renal function stable.',
        plan:
            '1. Continue IV furosemide 40 mg BID, review for oral switch\n2. Continue oxygen wean \u2014 trial on room air tomorrow AM\n3. Continue strict I/O chart and daily weight\n4. Start lisinopril 2.5 mg daily if creatinine stable\n5. Repeat electrolytes and creatinine tomorrow\n6. Plan discharge if stable for 24 hours on oral therapy',
    },
    discharge_note: {
        subjective:
            'Patient feels well and ready to go home. No shortness of breath at rest. Can walk to bathroom without assistance. No chest pain, palpitations, or leg swelling.',
        objective:
            'Temp 36.6\u00b0C, HR 74, BP 124/78, RR 16, SpO\u2082 97% on room air. Chest clear. No peripheral edema. Weight stable for 24 hours. ECG: sinus rhythm, no significant change.',
        assessment:
            'ADHF successfully treated. Ejection fraction 40% on echocardiogram. Hypertension controlled. Now NYHA class I. Stable for discharge.',
        plan:
            '1. Furosemide 40 mg PO daily \u00d7 14 days\n2. Lisinopril 5 mg PO daily, titrate as tolerated\n3. Carvedilol 3.125 mg BID (start after 48 hours without decompensation)\n4. Follow-up at medical outpatient clinic in 2 weeks\n5. Daily weight monitoring at home \u2014 return if >2 kg gain in 2 days\n6. Low-sodium diet \u22642 g/day, fluid restriction 1.5 L/day\n7. Return immediately if worsening SOB, chest pain, or confusion',
    },
    referral_note: {
        subjective:
            'Request for surgical evaluation of a 45-year-old female with a 3-day history of right iliac fossa pain, nausea, and anorexia. Pain migrated from periumbilical area to RIF. No vomiting or diarrhea. Last menstrual period 2 weeks ago.',
        objective:
            'Temp 37.8\u00b0C, HR 92, BP 124/76, RR 18. Abdomen: tenderness and guarding in RIF, positive Rovsing and psoas signs. Rebound tenderness present. WBC 14.5 \u00d7 10\u2079/L, neutrophils 85%. Urine dip: negative for infection.',
        assessment:
            'Acute appendicitis (Alvarado score 7/10). Differential: right ovarian pathology \u2014 pelvic ultrasound requested.',
        plan:
            'Refer to surgical team for urgent review. Keep nil by mouth. IV Ringer\u2019s lactate 100 mL/hr. Analgesia: IV paracetamol 1 g PRN. Escort patient with vitals monitoring.',
    },
    nursing_note: {
        subjective:
            'Patient reports pain at surgical wound site rated 5/10. States nausea is improved. Requested assistance to use commode.',
        objective:
            'Temp 37.1\u00b0C, HR 78, BP 126/80, RR 18, SpO\u2082 97%. Wound: clean, dry, intact, no erythema or discharge. Dressing changed per protocol. Urine output 300 mL past 4 hours. IV line patent, site clean.',
        assessment:
            'Recovering post-operatively. Pain controlled with current regimen. Wound healing well. Mobilising with assistance.',
        plan:
            '1. Continue IV paracetamol 1 g Q6H, transition to oral when tolerating diet\n2. Assist with mobilisation TID\n3. Monitor wound site each shift\n4. Encourage oral intake, record I/O\n5. Escalate to medical team if pain >6/10 or wound changes',
    },
    procedure_note: {
        subjective:
            'Indication: Diagnostic laparoscopy for a 32-year-old female with chronic pelvic pain and suspected endometriosis. Failed medical management with NSAIDs and combined oral contraceptive. Informed consent obtained.',
        objective:
            'Procedure: Diagnostic laparoscopy under general anaesthesia. Findings: Stage II endometriosis lesions noted on bilateral uterosacral ligaments and right ovarian fossa. Pelvic washings taken. No adhesions or tubal blockage. Estimated blood loss <20 mL. Duration: 45 minutes.',
        assessment:
            'Endometriosis confirmed (Stage II rASRM classification). Procedure uneventful. Specimens sent for histology.',
        plan:
            '1. Observe in recovery for 2 hours\n2. Paracetamol 1 g IV Q6H PRN for pain\n3. Resume normal diet when tolerating fluids\n4. Wound care: keep incisions dry for 48 hours\n5. Follow-up in surgical outpatient clinic in 2 weeks with histology results\n6. Discuss long-term hormonal suppression options at follow-up\n7. Return if fever, wound redness, or excessive bleeding',
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

export function medicalRecordNoteTypeSectionSample(
    value: string | null | undefined,
    section: MedicalRecordNarrativeSectionKey,
): string {
    const normalized = sanitizeMedicalRecordNoteType(value);

    return (
        SOAP_SAMPLES[normalized]?.[section]
        ?? SOAP_SAMPLE_DEFAULT[section]
    );
}
