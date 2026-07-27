<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ComboboxField from '@/components/forms/ComboboxField.vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { apiPatch } from '@/lib/apiClient';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';

type CatalogKey = 'lab-tests' | 'radiology-procedures' | 'theatre-procedures' | 'clinical-procedures' | 'formulary-items';

type BillingLinkStatus = 'linked' | 'pending_price' | 'review_required' | 'not_linked';

type ApiError = Error & { status?: number; payload?: { message?: string; errors?: Record<string, string[]> } };

type StandardsCodes = Partial<Record<'LOCAL' | 'LOINC' | 'SNOMED_CT' | 'NHIF' | 'MSD' | 'CPT' | 'ICD', string>>;

type BillingLinkItem = {
    id: string | null;
    clinicalCatalogItemId: string | null;
    serviceCode: string | null;
    serviceName: string | null;
    status: string | null;
    versionNumber: number | null;
    basePrice: string | null;
    currencyCode: string | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
};

type BillingLink = {
    status: BillingLinkStatus | null;
    serviceCode: string | null;
    item: BillingLinkItem | null;
};

export type CatalogItem = {
    id: string | null;
    catalogType: string | null;
    code: string | null;
    name: string | null;
    departmentId: string | null;
    category: string | null;
    unit: string | null;
    billingServiceCode: string | null;
    billingLinkStatus: BillingLinkStatus | null;
    billingLink: BillingLink | null;
    description: string | null;
    metadata: Record<string, unknown> | null;
    codes: StandardsCodes | null;
    facilityTier: string | null;
    genericName: string | null;
    dosageForm: string | null;
    strength: string | null;
    route: string | null;
    storageConditions: string | null;
    requiresColdChain: boolean;
    isControlledSubstance: boolean;
    controlledSubstanceSchedule: string | null;
    genericGroupCode: string | null;
    status: string | null;
    statusReason: string | null;
    updatedAt: string | null;
};

const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{
    item: CatalogItem | null;
    catalogKey: CatalogKey;
    departments: Array<{ id: string | null; code: string | null; name: string | null; serviceType: string | null }>;
    canManageCompliance: boolean;
}>();

const emit = defineEmits<{
    updated: [item: CatalogItem];
}>();

const domains = {
    'lab-tests': {
        label: 'Lab Tests',
        singular: 'Lab test',
        codePlaceholder: 'LAB-CBC-001',
        namePlaceholder: 'Complete Blood Count',
        categoryLabel: 'Discipline',
        categoryPlaceholder: 'hematology',
        unitLabel: 'Reporting unit',
        unitPlaceholder: 'panel',
        domainSectionTitle: 'Lab workflow details',
        domainSectionDescription: 'Capture specimen handling, turnaround expectations, and patient preparation rules used during ordering and results review.',
    },
    'radiology-procedures': {
        label: 'Radiology',
        singular: 'Radiology procedure',
        codePlaceholder: 'RAD-US-ABD-001',
        namePlaceholder: 'Abdominal Ultrasound',
        categoryLabel: 'Imaging family',
        categoryPlaceholder: 'ultrasound',
        unitLabel: 'Reporting unit',
        unitPlaceholder: 'study',
        domainSectionTitle: 'Imaging workflow details',
        domainSectionDescription: 'Capture modality, body site, contrast behavior, and duration signals so ordering and scheduling stay operationally accurate.',
    },
    'theatre-procedures': {
        label: 'Theatre Procedures',
        singular: 'Theatre procedure',
        codePlaceholder: 'THR-APP-001',
        namePlaceholder: 'Appendectomy',
        categoryLabel: 'Procedure family',
        categoryPlaceholder: 'general_surgery',
        unitLabel: 'Booking unit',
        unitPlaceholder: 'procedure',
        domainSectionTitle: 'Theatre workflow details',
        domainSectionDescription: 'Capture operating class, anaesthesia expectation, sterile prep, and estimated duration for theatre planning and controls.',
    },
    'clinical-procedures': {
        label: 'Clinical Procedures',
        singular: 'Clinical procedure',
        codePlaceholder: 'CLN-WOUND-001',
        namePlaceholder: 'Wound dressing change',
        categoryLabel: 'Procedure family',
        categoryPlaceholder: 'nursing_procedure',
        unitLabel: 'Procedure unit',
        unitPlaceholder: 'procedure',
        domainSectionTitle: 'Clinical procedure workflow details',
        domainSectionDescription: 'Capture setting, performer role, consent requirement, and expected duration for nursing and bedside procedures.',
    },
    'formulary-items': {
        label: 'Approved Medicines',
        singular: 'Medicine',
        codePlaceholder: 'MED-AMOX-500CAP',
        namePlaceholder: 'Amoxicillin 500mg',
        categoryLabel: 'Therapeutic class',
        categoryPlaceholder: 'antibiotics',
        unitLabel: 'Dispensing unit',
        unitPlaceholder: 'capsule',
        domainSectionTitle: 'Medicine workflow details',
        domainSectionDescription: 'Define strength, dosage form, route, and prescription type. Configure stock unit, pack size, dispensing conversion, and optional purchase unit for procurement.',
    },
} as const;

const catalog = computed(() => domains[props.catalogKey]);

const SELECT_NOT_SPECIFIED_VALUE = '__not_specified__';

const facilityTierOptions = [
    { value: 'dispensary', label: 'Dispensary' },
    { value: 'health_centre', label: 'Health centre' },
    { value: 'district_hospital', label: 'District hospital' },
    { value: 'regional_hospital', label: 'Regional hospital' },
    { value: 'zonal_referral', label: 'Zonal referral' },
] as const;

const labDisciplineOptions: SearchableSelectOption[] = [
    { value: 'hematology', label: 'Hematology', description: 'CBC, ESR, blood film, coagulation screening' },
    { value: 'clinical_chemistry', label: 'Clinical chemistry', description: 'Glucose, renal, liver, electrolytes, lipids' },
    { value: 'microbiology', label: 'Microbiology', description: 'Culture, sensitivity, Gram stain, AFB workflow' },
    { value: 'serology_immunology', label: 'Serology / immunology', description: 'HIV, hepatitis, pregnancy, rapid immunoassays' },
    { value: 'parasitology', label: 'Parasitology', description: 'Malaria, stool ova and parasites, blood parasites' },
    { value: 'urinalysis', label: 'Urinalysis', description: 'Dipstick, microscopy, urine pregnancy testing' },
    { value: 'blood_bank_transfusion', label: 'Blood bank / transfusion', description: 'Grouping, crossmatch, compatibility tests' },
    { value: 'molecular_diagnostics', label: 'Molecular diagnostics', description: 'PCR and GeneXpert style testing' },
    { value: 'histopathology_cytology', label: 'Histopathology / cytology', description: 'Biopsy, FNAC, Pap smear specimens' },
];

const labReportingUnitOptions: SearchableSelectOption[] = [
    { value: 'test', label: 'Test', description: 'Single reported laboratory test' },
    { value: 'panel', label: 'Panel', description: 'Grouped results reported together' },
    { value: 'profile', label: 'Profile', description: 'Clinical chemistry or wellness profile' },
    { value: 'slide', label: 'Slide', description: 'Microscopy slide review' },
    { value: 'sample', label: 'Sample', description: 'One specimen-based result' },
    { value: 'culture', label: 'Culture', description: 'Culture and sensitivity workflow' },
    { value: 'report', label: 'Report', description: 'Narrative or specialist report' },
];

const therapeuticClassOptions: SearchableSelectOption[] = [
    { value: 'analgesics_antipyretics', label: 'Analgesics / antipyretics', description: 'Paracetamol, ibuprofen, aspirin, morphine' },
    { value: 'antibiotics', label: 'Antibiotics / antimicrobials', description: 'Penicillins, cephalosporins, tetracyclines, macrolides' },
    { value: 'antimalarials', label: 'Antimalarials', description: 'ACTs, chloroquine, amodiaquine, artemether' },
    { value: 'antiretrovirals', label: 'Antiretrovirals', description: 'ARVs for HIV treatment and prevention' },
    { value: 'antifungals', label: 'Antifungals', description: 'Fluconazole, amphotericin B, nystatin' },
    { value: 'antivirals', label: 'Antivirals', description: 'Acyclovir, oseltamivir, tenofovir' },
    { value: 'antihelminthics', label: 'Antihelminthics', description: 'Albendazole, mebendazole, praziquantel' },
    { value: 'anti_inflammatory', label: 'Anti-inflammatory agents', description: 'NSAIDs, corticosteroids' },
    { value: 'anaesthetics_general', label: 'General anaesthetics', description: 'Ketamine, thiopental, halothane' },
    { value: 'anaesthetics_local', label: 'Local anaesthetics', description: 'Lidocaine, bupivacaine' },
    { value: 'cardiovascular', label: 'Cardiovascular agents', description: 'Antihypertensives, diuretics, antiarrhythmics' },
    { value: 'respiratory', label: 'Respiratory agents', description: 'Bronchodilators, mucolytics, cough preparations' },
    { value: 'gastrointestinal', label: 'Gastrointestinal agents', description: 'Antacids, laxatives, antidiarrhoeals, PPIs' },
    { value: 'endocrine_metabolic', label: 'Endocrine / metabolic', description: 'Insulin, metformin, thyroid hormones, steroids' },
    { value: 'dermatological', label: 'Dermatological agents', description: 'Topical preparations, antifungal creams' },
    { value: 'haematological', label: 'Haematological agents', description: 'Iron supplements, folic acid, anticoagulants' },
    { value: 'hormones_contraceptives', label: 'Hormones / contraceptives', description: 'Oral contraceptives, implants, oestrogens' },
    { value: 'immunological_vaccines', label: 'Immunological / vaccines', description: 'BCG, measles, polio, pentavalent, COVID-19' },
    { value: 'mental_health_psychiatric', label: 'Mental health / psychiatric', description: 'Antipsychotics, antidepressants, anxiolytics' },
    { value: 'neurological', label: 'Neurological agents', description: 'Anticonvulsants, antiepileptics' },
    { value: 'nutritional', label: 'Nutritional supplements', description: 'Vitamins, minerals, amino acids' },
    { value: 'oncological', label: 'Oncological agents', description: 'Chemotherapy, supportive oncology' },
    { value: 'ophthalmological', label: 'Ophthalmological agents', description: 'Eye drops, ointments' },
    { value: 'otological', label: 'Otic (ear) agents', description: 'Ear drops, ear preparations' },
    { value: 'urological_genitourinary', label: 'Urological / genitourinary', description: 'Urinary antiseptics, bladder preparations' },
    { value: 'vitamins_minerals', label: 'Vitamins & minerals', description: 'Calcium, iron, zinc, vitamin A, ORS' },
    { value: 'antiprotozoals', label: 'Antiprotozoals', description: 'Metronidazole, tinidazole, iodoquinol' },
    { value: 'traditional_medicines', label: 'Traditional medicines', description: 'Registered herbal and phytotherapy' },
];

const dispensingUnitOptions: SearchableSelectOption[] = [
    { value: 'tablet', label: 'Tablet' },
    { value: 'capsule', label: 'Capsule' },
    { value: 'bottle', label: 'Bottle' },
    { value: 'sachet', label: 'Sachet' },
    { value: 'vial', label: 'Vial' },
    { value: 'ampoule', label: 'Ampoule' },
    { value: 'tube', label: 'Tube' },
    { value: 'blister', label: 'Blister (Strip)' },
    { value: 'box', label: 'Box' },
    { value: 'roll', label: 'Roll' },
    { value: 'pack', label: 'Pack' },
    { value: 'each', label: 'Each (piece)' },
    { value: 'kit', label: 'Kit' },
    { value: 'inhaler', label: 'Inhaler' },
];

const dosageFormOptions: SearchableSelectOption[] = [
    { value: 'tablet', label: 'Tablet', group: 'Oral solid' },
    { value: 'capsule', label: 'Capsule', group: 'Oral solid' },
    { value: 'dispersible tablet', label: 'Dispersible tablet', group: 'Oral solid' },
    { value: 'chewable tablet', label: 'Chewable tablet', group: 'Oral solid' },
    { value: 'effervescent tablet', label: 'Effervescent tablet', group: 'Oral solid' },
    { value: 'powder', label: 'Powder', group: 'Oral solid' },
    { value: 'syrup', label: 'Syrup', group: 'Oral liquid' },
    { value: 'suspension', label: 'Suspension', group: 'Oral liquid' },
    { value: 'solution', label: 'Solution', group: 'Oral liquid' },
    { value: 'elixir', label: 'Elixir', group: 'Oral liquid' },
    { value: 'mixture', label: 'Mixture', group: 'Oral liquid' },
    { value: 'injection', label: 'Injection', group: 'Parenteral' },
    { value: 'cream', label: 'Cream', group: 'Topical' },
    { value: 'ointment', label: 'Ointment', group: 'Topical' },
    { value: 'gel', label: 'Gel', group: 'Topical' },
    { value: 'lotion', label: 'Lotion', group: 'Topical' },
    { value: 'eye drops', label: 'Eye drops', group: 'Ophthalmic' },
    { value: 'ear drops', label: 'Ear drops', group: 'Otological' },
    { value: 'nasal drops', label: 'Nasal drops', group: 'Nasal' },
    { value: 'suppository', label: 'Suppository', group: 'Rectal / vaginal' },
    { value: 'pessary', label: 'Pessary', group: 'Rectal / vaginal' },
    { value: 'inhaler', label: 'Inhaler', group: 'Respiratory' },
    { value: 'spray', label: 'Spray', group: 'Respiratory' },
    { value: 'patch', label: 'Patch', group: 'Transdermal' },
];

const routeOfAdministrationOptions: SearchableSelectOption[] = [
    { value: 'oral', label: 'Oral', group: 'Enteral' },
    { value: 'sublingual', label: 'Sublingual', group: 'Enteral' },
    { value: 'buccal', label: 'Buccal', group: 'Enteral' },
    { value: 'intravenous', label: 'Intravenous (IV)', group: 'Parenteral' },
    { value: 'intramuscular', label: 'Intramuscular (IM)', group: 'Parenteral' },
    { value: 'subcutaneous', label: 'Subcutaneous (SC)', group: 'Parenteral' },
    { value: 'intradermal', label: 'Intradermal', group: 'Parenteral' },
    { value: 'topical', label: 'Topical', group: 'External' },
    { value: 'transdermal', label: 'Transdermal', group: 'External' },
    { value: 'rectal', label: 'Rectal', group: 'Other routes' },
    { value: 'vaginal', label: 'Vaginal', group: 'Other routes' },
    { value: 'inhalation', label: 'Inhalation', group: 'Other routes' },
    { value: 'intranasal', label: 'Intranasal', group: 'Other routes' },
    { value: 'ophthalmic', label: 'Ophthalmic (eye)', group: 'Other routes' },
    { value: 'otical', label: 'Otological (ear)', group: 'Other routes' },
    { value: 'intrathecal', label: 'Intrathecal', group: 'Other routes' },
];

type ClinicalDefinitionForm = ReturnType<typeof createClinicalDefinitionForm>;

function createClinicalDefinitionForm() {
    return {
        code: '',
        name: '',
        departmentId: '',
        category: '',
        unit: '',
        billingServiceCode: '',
        description: '',
        facilityTier: '',
        standardsLocal: '',
        standardsNhif: '',
        standardsMsd: '',
        standardsLoinc: '',
        standardsSnomedCt: '',
        standardsCpt: '',
        standardsIcd: '',
        metadataText: '{}',
        sampleType: '',
        specimenContainer: '',
        turnaroundHours: '',
        fastingRequired: '',
        modality: '',
        bodySite: '',
        contrastRequired: '',
        studyDurationMinutes: '',
        procedureClass: '',
        anesthesiaType: '',
        expectedDurationMinutes: '',
        sterilePrepRequired: '',
        procedureSetting: '',
        performerRole: '',
        estimatedDurationMinutes: '',
        consentRequired: '',
        strength: '',
        dosageForm: '',
        route: '',
        otcAllowed: '',
        packSize: '',
        stockUnit: '',
        conversionFactor: '',
        purchaseUnit: '',
        purchaseUnitQuantity: '',
        genericName: '',
        storageConditions: '',
        requiresColdChain: false,
        isControlledSubstance: false,
        controlledSubstanceSchedule: '',
        genericGroupCode: '',
    };
}

const editForm = reactive(createClinicalDefinitionForm());
const editErrors = ref<Record<string, string[]>>({});
const editBusy = ref(false);

watch(open, (isOpen) => {
    if (isOpen && props.item) {
        hydrateEdit(props.item);
        editErrors.value = {};
        editBusy.value = false;
    }
});

watch(() => props.item, (newItem) => {
    if (open.value && newItem) {
        hydrateEdit(newItem);
    }
});

function itemCatalogKey(item: CatalogItem | null): CatalogKey {
    const catalogType = String(item?.catalogType ?? '').trim().toLowerCase();
    if (catalogType === 'lab_test') return 'lab-tests';
    if (catalogType === 'radiology_procedure') return 'radiology-procedures';
    if (catalogType === 'theatre_procedure') return 'theatre-procedures';
    if (catalogType === 'clinical_procedure') return 'clinical-procedures';
    if (catalogType === 'formulary_item') return 'formulary-items';
    return props.catalogKey;
}

const selectedCatalogKey = computed<CatalogKey>(() => itemCatalogKey(props.item));

function firstError(errors: Record<string, string[]> | null | undefined, key: string): string | null {
    return errors?.[key]?.[0] ?? null;
}

function formatMoney(value: string | null, currencyCode: string | null): string {
    const amount = Number(value ?? '');
    if (!Number.isFinite(amount)) return 'Price not available';
    const currency = (currencyCode ?? '').trim().toUpperCase() || 'TZS';
    return new Intl.NumberFormat('en-TZ', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function billingLinkDetail(item: CatalogItem | null): string {
    const link = item?.billingLink;
    const linkedItem = link?.item;
    if ((item?.billingLinkStatus ?? null) === 'linked' && linkedItem) {
        return `${linkedItem.serviceName || linkedItem.serviceCode || 'Billing price'} | ${formatMoney(linkedItem.basePrice, linkedItem.currencyCode)} | Version ${linkedItem.versionNumber || 1}`;
    }
    if ((item?.billingLinkStatus ?? null) === 'pending_price') {
        return `Billing code ${link?.serviceCode || item?.billingServiceCode || 'not set'} is saved, but no active service price has been registered yet.`;
    }
    if ((item?.billingLinkStatus ?? null) === 'review_required') {
        return `Billing changes need review.`;
    }
    return 'Not linked to billing. Create a price record in Chargeable Items to link.';
}

const editSheetTitle = computed(() => `Edit ${catalog.value.singular.toLowerCase()}`);

const editDepartmentOptions = computed<SearchableSelectOption[]>(() => {
    function preferredDepartmentServiceType(key: CatalogKey): string {
        if (key === 'lab-tests') return 'laboratory';
        if (key === 'radiology-procedures') return 'radiology';
        if (key === 'theatre-procedures') return 'theatre';
        if (key === 'clinical-procedures') return 'clinical';
        return 'pharmacy';
    }
    const normalizedServiceType = preferredDepartmentServiceType(selectedCatalogKey.value).trim().toLowerCase();
    const filteredDepartments = props.departments.filter((department) =>
        String(department.serviceType ?? '').trim().toLowerCase() === normalizedServiceType
    );
    const source = filteredDepartments.length > 0 ? filteredDepartments : props.departments;
    const options = source
        .map((department) => {
            const id = String(department.id ?? '').trim();
            const name = String(department.name ?? '').trim();
            if (!id || !name) return null;
            const code = String(department.code ?? '').trim();
            const serviceType = String(department.serviceType ?? '').trim();
            return {
                value: id,
                label: code ? `${code} - ${name}` : name,
                description: serviceType ? `${formatEnumLabel(serviceType)} department` : 'Hospital department',
                keywords: [name, code, serviceType].filter((entry) => entry.trim().length > 0),
                group: serviceType ? formatEnumLabel(serviceType) : 'Other',
            } satisfies SearchableSelectOption;
        })
        .filter((option): option is SearchableSelectOption => option !== null);
    return [
        { value: SELECT_NOT_SPECIFIED_VALUE, label: 'No department assigned', description: 'Use when this definition is shared across departments.', keywords: ['no department', 'shared', 'unassigned'], group: 'General' },
        ...options,
    ];
});

const editDepartmentFieldValue = computed({
    get: () => editForm.departmentId.trim() || SELECT_NOT_SPECIFIED_VALUE,
    set: (value: string) => {
        editForm.departmentId = value === SELECT_NOT_SPECIFIED_VALUE ? '' : value.trim();
    },
});

const editDepartmentEmptyText = computed(() => {
    if (props.departments.length === 0) return 'No departments are available from the hospital directory.';
    return 'No departments matched this search.';
});

function metadataObject(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function metadataStringValue(metadata: Record<string, unknown>, key: string): string {
    const value = metadata[key];
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        const num = Number(trimmed);
        if (!isNaN(num)) return String(num);
        return trimmed;
    }
    return '';
}

function metadataBooleanSelectValue(metadata: Record<string, unknown>, key: string): '' | 'yes' | 'no' {
    const value = metadata[key];
    if (value === true) return 'yes';
    if (value === false) return 'no';
    return '';
}

function knownMetadataKeysForCatalog(key: CatalogKey): string[] {
    if (key === 'lab-tests') return ['sampleType', 'specimenContainer', 'turnaroundHours', 'fastingRequired'];
    if (key === 'radiology-procedures') return ['modality', 'bodySite', 'contrastRequired', 'studyDurationMinutes'];
    if (key === 'theatre-procedures') return ['procedureClass', 'anesthesiaType', 'expectedDurationMinutes', 'sterilePrepRequired'];
    if (key === 'clinical-procedures') return ['procedureSetting', 'performerRole', 'estimatedDurationMinutes', 'consentRequired'];
    return ['strength', 'dosageForm', 'route', 'otcAllowed', 'packSize', 'stockUnit', 'conversionFactor'];
}

function scrubMetadataForDomain(key: CatalogKey, metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
    const sanitized = metadataObject(metadata);
    for (const field of [...knownMetadataKeysForCatalog(key), 'billingServiceCode', 'billing_service_code']) {
        delete sanitized[field];
    }
    return sanitized;
}

function applyDomainMetadataToForm(form: ClinicalDefinitionForm, key: CatalogKey, metadata: Record<string, unknown> | null | undefined): void {
    const values = metadataObject(metadata);
    form.sampleType = '';
    form.specimenContainer = '';
    form.turnaroundHours = '';
    form.fastingRequired = '';
    form.modality = '';
    form.bodySite = '';
    form.contrastRequired = '';
    form.studyDurationMinutes = '';
    form.procedureClass = '';
    form.anesthesiaType = '';
    form.expectedDurationMinutes = '';
    form.sterilePrepRequired = '';
    form.procedureSetting = '';
    form.performerRole = '';
    form.estimatedDurationMinutes = '';
    form.consentRequired = '';
    form.strength = '';
    form.dosageForm = '';
    form.route = '';
    form.otcAllowed = '';
    form.packSize = '';
    form.stockUnit = '';
    form.conversionFactor = '';
    form.purchaseUnit = '';
    form.purchaseUnitQuantity = '';
    if (key === 'lab-tests') {
        form.sampleType = metadataStringValue(values, 'sampleType');
        form.specimenContainer = metadataStringValue(values, 'specimenContainer');
        form.turnaroundHours = metadataStringValue(values, 'turnaroundHours');
        form.fastingRequired = metadataBooleanSelectValue(values, 'fastingRequired');
        return;
    }
    if (key === 'radiology-procedures') {
        form.modality = metadataStringValue(values, 'modality');
        form.bodySite = metadataStringValue(values, 'bodySite');
        form.contrastRequired = metadataBooleanSelectValue(values, 'contrastRequired');
        form.studyDurationMinutes = metadataStringValue(values, 'studyDurationMinutes');
        return;
    }
    if (key === 'theatre-procedures') {
        form.procedureClass = metadataStringValue(values, 'procedureClass');
        form.anesthesiaType = metadataStringValue(values, 'anesthesiaType');
        form.expectedDurationMinutes = metadataStringValue(values, 'expectedDurationMinutes');
        form.sterilePrepRequired = metadataBooleanSelectValue(values, 'sterilePrepRequired');
        return;
    }
    if (key === 'clinical-procedures') {
        form.procedureSetting = metadataStringValue(values, 'procedureSetting');
        form.performerRole = metadataStringValue(values, 'performerRole');
        form.estimatedDurationMinutes = metadataStringValue(values, 'estimatedDurationMinutes');
        form.consentRequired = metadataBooleanSelectValue(values, 'consentRequired');
        return;
    }
    form.strength = metadataStringValue(values, 'strength');
    form.dosageForm = metadataStringValue(values, 'dosageForm');
    form.route = metadataStringValue(values, 'route');
    form.otcAllowed = metadataBooleanSelectValue(values, 'otcAllowed');
    form.packSize = metadataStringValue(values, 'packSize');
    form.stockUnit = metadataStringValue(values, 'stockUnit');
    form.conversionFactor = metadataStringValue(values, 'conversionFactor');
    form.purchaseUnit = metadataStringValue(values, 'purchaseUnit');
    form.purchaseUnitQuantity = metadataStringValue(values, 'purchaseUnitQuantity');
}

function hydrateEdit(item: CatalogItem): void {
    const key = itemCatalogKey(item);
    const baseMetadata = scrubMetadataForDomain(key, item.metadata ?? {});
    Object.assign(editForm, createClinicalDefinitionForm(), {
        code: item.code ?? '',
        name: item.name ?? '',
        departmentId: item.departmentId ?? '',
        category: item.category ?? '',
        unit: item.unit ?? '',
        billingServiceCode: item.billingServiceCode ?? '',
        description: item.description ?? '',
        facilityTier: item.facilityTier ?? '',
        metadataText: jsonPreview(baseMetadata),
        genericName: item.genericName ?? '',
        storageConditions: item.storageConditions ?? '',
        requiresColdChain: Boolean(item.requiresColdChain),
        isControlledSubstance: Boolean(item.isControlledSubstance),
        controlledSubstanceSchedule: item.controlledSubstanceSchedule ?? '',
        genericGroupCode: item.genericGroupCode ?? '',
    });
    applyStandardsCodesToForm(editForm, item.codes);
    applyDomainMetadataToForm(editForm, key, item.metadata ?? {});
}

function standardsCodesFromForm(form: ClinicalDefinitionForm): StandardsCodes | null {
    const codes: StandardsCodes = {
        LOCAL: form.standardsLocal.trim(),
        NHIF: form.standardsNhif.trim(),
        MSD: form.standardsMsd.trim(),
        LOINC: form.standardsLoinc.trim(),
        SNOMED_CT: form.standardsSnomedCt.trim(),
        CPT: form.standardsCpt.trim(),
        ICD: form.standardsIcd.trim(),
    };
    const compact = Object.fromEntries(Object.entries(codes).filter(([, value]) => String(value ?? '').trim() !== '')) as StandardsCodes;
    return Object.keys(compact).length > 0 ? compact : null;
}

function applyStandardsCodesToForm(form: ClinicalDefinitionForm, codes: StandardsCodes | null | undefined): void {
    form.standardsLocal = String(codes?.LOCAL ?? '');
    form.standardsNhif = String(codes?.NHIF ?? '');
    form.standardsMsd = String(codes?.MSD ?? '');
    form.standardsLoinc = String(codes?.LOINC ?? '');
    form.standardsSnomedCt = String(codes?.SNOMED_CT ?? '');
    form.standardsCpt = String(codes?.CPT ?? '');
    form.standardsIcd = String(codes?.ICD ?? '');
}

function csrfToken(): string | null {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
}

function parseMetadata(text: string): Record<string, unknown> | null | 'invalid' {
    const v = text.trim();
    if (!v) return null;
    try {
        const p = JSON.parse(v) as unknown;
        return p !== null && !Array.isArray(p) && typeof p === 'object' ? (p as Record<string, unknown>) : 'invalid';
    } catch {
        return 'invalid';
    }
}

function jsonPreview(value: unknown): string {
    try {
        return JSON.stringify(value ?? {}, null, 2);
    } catch {
        return '{}';
    }
}

function booleanValueFromSelect(value: string): boolean | null {
    if (value === 'yes') return true;
    if (value === 'no') return false;
    return null;
}

function appendIfPresent(target: Record<string, unknown>, key: string, value: string | number): void {
    if (typeof value === 'number') {
        target[key] = value;
        return;
    }
    const normalized = value.trim();
    if (normalized !== '') target[key] = normalized;
}

function buildKnownDomainMetadata(form: ClinicalDefinitionForm, key: CatalogKey): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    if (key === 'lab-tests') {
        appendIfPresent(metadata, 'sampleType', form.sampleType);
        appendIfPresent(metadata, 'specimenContainer', form.specimenContainer);
        appendIfPresent(metadata, 'turnaroundHours', form.turnaroundHours);
        const fastingRequired = booleanValueFromSelect(form.fastingRequired);
        if (fastingRequired !== null) metadata.fastingRequired = fastingRequired;
        return metadata;
    }
    if (key === 'radiology-procedures') {
        appendIfPresent(metadata, 'modality', form.modality);
        appendIfPresent(metadata, 'bodySite', form.bodySite);
        appendIfPresent(metadata, 'studyDurationMinutes', form.studyDurationMinutes);
        const contrastRequired = booleanValueFromSelect(form.contrastRequired);
        if (contrastRequired !== null) metadata.contrastRequired = contrastRequired;
        return metadata;
    }
    if (key === 'theatre-procedures') {
        appendIfPresent(metadata, 'procedureClass', form.procedureClass);
        appendIfPresent(metadata, 'anesthesiaType', form.anesthesiaType);
        appendIfPresent(metadata, 'expectedDurationMinutes', form.expectedDurationMinutes);
        const sterilePrepRequired = booleanValueFromSelect(form.sterilePrepRequired);
        if (sterilePrepRequired !== null) metadata.sterilePrepRequired = sterilePrepRequired;
        return metadata;
    }
    if (key === 'clinical-procedures') {
        appendIfPresent(metadata, 'procedureSetting', form.procedureSetting);
        appendIfPresent(metadata, 'performerRole', form.performerRole);
        appendIfPresent(metadata, 'estimatedDurationMinutes', form.estimatedDurationMinutes);
        const consentRequired = booleanValueFromSelect(form.consentRequired);
        if (consentRequired !== null) metadata.consentRequired = consentRequired;
        return metadata;
    }
    appendIfPresent(metadata, 'strength', form.strength);
    appendIfPresent(metadata, 'dosageForm', form.dosageForm);
    appendIfPresent(metadata, 'route', form.route);
    appendIfPresent(metadata, 'packSize', form.packSize);
    const otcAllowed = booleanValueFromSelect(form.otcAllowed);
    if (otcAllowed !== null) metadata.otcAllowed = otcAllowed;
    appendIfPresent(metadata, 'stockUnit', form.stockUnit);
    appendIfPresent(metadata, 'conversionFactor', form.conversionFactor);
    appendIfPresent(metadata, 'purchaseUnit', form.purchaseUnit);
    appendIfPresent(metadata, 'purchaseUnitQuantity', form.purchaseUnitQuantity);
    return metadata;
}

function buildMetadataPayload(form: ClinicalDefinitionForm, key: CatalogKey): Record<string, unknown> | null | 'invalid' {
    const extraMetadata = parseMetadata(form.metadataText);
    if (extraMetadata === 'invalid') return 'invalid';
    const metadata = { ...scrubMetadataForDomain(key, extraMetadata), ...buildKnownDomainMetadata(form, key) };
    return Object.keys(metadata).length > 0 ? metadata : null;
}

function positiveWholeNumberError(value: string, label: string): string[] | null {
    const normalized = value.trim();
    if (normalized === '') return null;
    if (!/^\d+$/.test(normalized) || Number(normalized) <= 0) return [`${label} must be a whole number greater than 0.`];
    return null;
}

function applyDomainValidation(errors: Record<string, string[]>, form: ClinicalDefinitionForm, key: CatalogKey): void {
    if (key === 'lab-tests') {
        const turnaroundHoursError = positiveWholeNumberError(form.turnaroundHours, 'Turnaround hours');
        if (turnaroundHoursError) errors.turnaroundHours = turnaroundHoursError;
        return;
    }
    if (key === 'radiology-procedures') {
        const studyDurationMinutesError = positiveWholeNumberError(form.studyDurationMinutes, 'Study duration minutes');
        if (studyDurationMinutesError) errors.studyDurationMinutes = studyDurationMinutesError;
        return;
    }
    if (key === 'theatre-procedures') {
        const expectedDurationMinutesError = positiveWholeNumberError(form.expectedDurationMinutes, 'Expected duration minutes');
        if (expectedDurationMinutesError) errors.expectedDurationMinutes = expectedDurationMinutesError;
        return;
    }
    if (key === 'clinical-procedures') {
        const estimatedDurationMinutesError = positiveWholeNumberError(form.estimatedDurationMinutes, 'Estimated duration minutes');
        if (estimatedDurationMinutesError) errors.estimatedDurationMinutes = estimatedDurationMinutesError;
    }
}

async function saveItem(): Promise<void> {
    const id = String(props.item?.id ?? '').trim();
    if (!id || editBusy.value) return;
    editBusy.value = true;
    editErrors.value = {};
    const metadata = buildMetadataPayload(editForm, itemCatalogKey(props.item));
    const localErrors: Record<string, string[]> = {};
    if (!editForm.code.trim()) localErrors.code = ['Code is required.'];
    if (!editForm.name.trim()) localErrors.name = ['Name is required.'];
    if (metadata === 'invalid') localErrors.metadata = ['Additional metadata must be a valid JSON object.'];
    applyDomainValidation(localErrors, editForm, itemCatalogKey(props.item));
    if (Object.keys(localErrors).length) {
        editErrors.value = localErrors;
        editBusy.value = false;
        return;
    }
    try {
        const baseUrl = `/platform/admin/clinical-catalogs/${props.catalogKey}`;
        const response = await apiPatch<{ data: CatalogItem }>(`${baseUrl}/${id}`, {
            body: {
                code: editForm.code.trim(),
                name: editForm.name.trim(),
                departmentId: editForm.departmentId.trim() || null,
                category: editForm.category.trim() || null,
                unit: editForm.unit.trim() || null,
                billingServiceCode: editForm.billingServiceCode.trim() || null,
                description: editForm.description.trim() || null,
                facilityTier: editForm.facilityTier.trim() || null,
                codes: standardsCodesFromForm(editForm),
                metadata,
                genericName: editForm.genericName.trim() || null,
                storageConditions: editForm.storageConditions.trim() || null,
                requiresColdChain: editForm.requiresColdChain,
                isControlledSubstance: editForm.isControlledSubstance,
                controlledSubstanceSchedule: editForm.controlledSubstanceSchedule.trim() || null,
                genericGroupCode: editForm.genericGroupCode.trim() || null,
            },
        });
        emit('updated', response.data);
        open.value = false;
        notifySuccess('Item updated.');
    } catch (error) {
        const apiError = error as ApiError;
        if (apiError.status === 422 && apiError.payload?.errors) editErrors.value = apiError.payload.errors;
        else notifyError(messageFromUnknown(error, 'Unable to update item.'));
    } finally {
        editBusy.value = false;
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="workspace" size="3xl" class="flex h-full min-h-0 flex-col">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="pencil" class="size-5 text-muted-foreground" />
                    {{ editSheetTitle }}
                </SheetTitle>
                <SheetDescription v-if="item">
                    Update clinical details here. Change hospital prices in Chargeable Items.
                </SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
                <div class="grid gap-4 px-6 py-4">
                    <fieldset class="grid gap-3 rounded-lg border p-3 md:grid-cols-3">
                        <legend class="px-2 text-sm font-medium text-muted-foreground md:col-span-3">Definition identity</legend>
                        <div class="grid gap-1.5">
                            <Label>Code</Label>
                            <Input v-model="editForm.code" :placeholder="catalog.codePlaceholder" />
                            <p v-if="firstError(editErrors, 'code')" class="text-xs text-destructive">{{ firstError(editErrors, 'code') }}</p>
                        </div>
                        <div class="grid gap-1.5 md:col-span-2">
                            <Label>Name</Label>
                            <Input v-model="editForm.name" :placeholder="catalog.namePlaceholder" />
                            <p v-if="firstError(editErrors, 'name')" class="text-xs text-destructive">{{ firstError(editErrors, 'name') }}</p>
                        </div>
                        <ComboboxField
                            input-id="edit-clinical-definition-department"
                            label="Department"
                            v-model="editDepartmentFieldValue"
                            :options="editDepartmentOptions"
                            placeholder="Select department"
                            search-placeholder="Search department code or name"
                            :error-message="firstError(editErrors, 'departmentId')"
                            :empty-text="editDepartmentEmptyText"
                            :reserve-message-space="false"
                        />
                        <div class="grid gap-1.5">
                            <ComboboxField
                                v-if="selectedCatalogKey === 'lab-tests'"
                                input-id="edit-clinical-definition-discipline"
                                :label="catalog.categoryLabel"
                                v-model="editForm.category"
                                :options="labDisciplineOptions"
                                placeholder="Select discipline"
                                search-placeholder="Search lab discipline"
                                empty-text="No matching discipline found."
                                :reserve-message-space="false"
                            />
                            <ComboboxField
                                v-else-if="selectedCatalogKey === 'formulary-items'"
                                input-id="edit-clinical-definition-therapeutic-class"
                                :label="catalog.categoryLabel"
                                v-model="editForm.category"
                                :options="therapeuticClassOptions"
                                placeholder="Select therapeutic class"
                                search-placeholder="Search therapeutic class"
                                empty-text="No matching therapeutic class found."
                                :reserve-message-space="false"
                            />
                            <template v-else>
                                <Label>{{ catalog.categoryLabel }}</Label>
                                <Input v-model="editForm.category" :placeholder="catalog.categoryPlaceholder" />
                            </template>
                        </div>
                        <div class="grid gap-1.5">
                            <ComboboxField
                                v-if="selectedCatalogKey === 'lab-tests'"
                                input-id="edit-clinical-definition-reporting-unit"
                                :label="catalog.unitLabel"
                                v-model="editForm.unit"
                                :options="labReportingUnitOptions"
                                placeholder="Select reporting unit"
                                search-placeholder="Search reporting unit"
                                empty-text="No matching reporting unit found."
                                :reserve-message-space="false"
                            />
                            <ComboboxField
                                v-else-if="selectedCatalogKey === 'formulary-items'"
                                input-id="edit-clinical-definition-dispensing-unit"
                                :label="catalog.unitLabel"
                                v-model="editForm.unit"
                                :options="dispensingUnitOptions"
                                placeholder="Select dispensing unit"
                                search-placeholder="Search dispensing unit"
                                empty-text="No matching dispensing unit found."
                                :reserve-message-space="false"
                            />
                            <template v-else>
                                <Label>{{ catalog.unitLabel }}</Label>
                                <Input v-model="editForm.unit" :placeholder="catalog.unitPlaceholder" />
                            </template>
                        </div>
                        <div v-if="item" class="md:col-span-3 rounded-lg border border-dashed bg-muted/10 p-3">
                            <p class="text-sm font-medium">Hospital pricing</p>
                            <p class="mt-1 text-xs text-muted-foreground">{{ billingLinkDetail(item) }}</p>
                            <Button size="sm" variant="outline" class="mt-2 h-8 gap-1.5" as-child>
                                <Link href="/chargeable-items">
                                    <AppIcon name="receipt" class="size-3.5" />
                                    Open Chargeable Items
                                </Link>
                            </Button>
                        </div>
                        <details class="md:col-span-3 rounded-lg border bg-muted/10 p-3">
                            <summary class="cursor-pointer text-sm font-medium text-muted-foreground">Billing service code (optional)</summary>
                            <p class="mt-2 text-xs text-muted-foreground">
                                Use this when the billing/tariff code should differ from the clinical definition code. Chargeable Items will use it when creating prices from this definition.
                            </p>
                            <div class="mt-3 grid gap-1.5">
                                <Label>Billing service code</Label>
                                <Input v-model="editForm.billingServiceCode" placeholder="e.g. LAB-CBC-001" />
                                <p v-if="firstError(editErrors, 'billingServiceCode')" class="text-xs text-destructive">{{ firstError(editErrors, 'billingServiceCode') }}</p>
                            </div>
                        </details>
                        <div class="grid gap-1.5 md:col-span-3">
                            <Label>Description</Label>
                            <Textarea v-model="editForm.description" class="min-h-20" placeholder="Operational guidance for care teams" />
                        </div>
                    </fieldset>

                    <fieldset class="grid gap-3 rounded-lg border p-3">
                        <legend class="px-2 text-sm font-medium text-muted-foreground">{{ catalog.domainSectionTitle }}</legend>
                        <p class="text-xs text-muted-foreground">{{ catalog.domainSectionDescription }}</p>
                        <div v-if="selectedCatalogKey === 'lab-tests'" class="grid gap-3 md:grid-cols-2">
                            <div class="grid gap-1.5"><Label>Sample type</Label><Input v-model="editForm.sampleType" placeholder="blood" /></div>
                            <div class="grid gap-1.5"><Label>Specimen container</Label><Input v-model="editForm.specimenContainer" placeholder="EDTA tube" /></div>
                            <div class="grid gap-1.5"><Label>Turnaround hours</Label><Input v-model="editForm.turnaroundHours" inputmode="numeric" placeholder="4" /><p v-if="firstError(editErrors, 'turnaroundHours')" class="text-xs text-destructive">{{ firstError(editErrors, 'turnaroundHours') }}</p></div>
                            <div class="grid gap-1.5"><Label>Fasting required</Label><Select v-model="editForm.fastingRequired"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">Required</SelectItem><SelectItem value="no">Not required</SelectItem></SelectContent></Select></div>
                        </div>
                        <div v-else-if="selectedCatalogKey === 'radiology-procedures'" class="grid gap-3 md:grid-cols-2">
                            <div class="grid gap-1.5"><Label>Modality</Label><Input v-model="editForm.modality" placeholder="ultrasound" /></div>
                            <div class="grid gap-1.5"><Label>Body site</Label><Input v-model="editForm.bodySite" placeholder="abdomen" /></div>
                            <div class="grid gap-1.5"><Label>Study duration minutes</Label><Input v-model="editForm.studyDurationMinutes" inputmode="numeric" placeholder="30" /><p v-if="firstError(editErrors, 'studyDurationMinutes')" class="text-xs text-destructive">{{ firstError(editErrors, 'studyDurationMinutes') }}</p></div>
                            <div class="grid gap-1.5"><Label>Contrast required</Label><Select v-model="editForm.contrastRequired"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">Required</SelectItem><SelectItem value="no">Not required</SelectItem></SelectContent></Select></div>
                        </div>
                        <div v-else-if="selectedCatalogKey === 'theatre-procedures'" class="grid gap-3 md:grid-cols-2">
                            <div class="grid gap-1.5"><Label>Procedure class</Label><Input v-model="editForm.procedureClass" placeholder="major" /></div>
                            <div class="grid gap-1.5"><Label>Anaesthesia type</Label><Input v-model="editForm.anesthesiaType" placeholder="general" /></div>
                            <div class="grid gap-1.5"><Label>Expected duration minutes</Label><Input v-model="editForm.expectedDurationMinutes" inputmode="numeric" placeholder="90" /><p v-if="firstError(editErrors, 'expectedDurationMinutes')" class="text-xs text-destructive">{{ firstError(editErrors, 'expectedDurationMinutes') }}</p></div>
                            <div class="grid gap-1.5"><Label>Sterile prep required</Label><Select v-model="editForm.sterilePrepRequired"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">Required</SelectItem><SelectItem value="no">Not required</SelectItem></SelectContent></Select></div>
                        </div>
                        <div v-else-if="selectedCatalogKey === 'clinical-procedures'" class="grid gap-3 md:grid-cols-2">
                            <div class="grid gap-1.5"><Label>Procedure setting</Label><Input v-model="editForm.procedureSetting" placeholder="outpatient" /></div>
                            <div class="grid gap-1.5"><Label>Performer role</Label><Input v-model="editForm.performerRole" placeholder="nurse" /></div>
                            <div class="grid gap-1.5"><Label>Estimated duration minutes</Label><Input v-model="editForm.estimatedDurationMinutes" inputmode="numeric" placeholder="20" /><p v-if="firstError(editErrors, 'estimatedDurationMinutes')" class="text-xs text-destructive">{{ firstError(editErrors, 'estimatedDurationMinutes') }}</p></div>
                            <div class="grid gap-1.5"><Label>Consent required</Label><Select v-model="editForm.consentRequired"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">Required</SelectItem><SelectItem value="no">Not required</SelectItem></SelectContent></Select></div>
                        </div>
                        <div v-else class="grid gap-3 md:grid-cols-2">
                            <div class="grid gap-1.5"><Label>Strength</Label><Input v-model="editForm.strength" placeholder="500 mg" /></div>
                            <ComboboxField
                                input-id="edit-clinical-definition-dosage-form"
                                label="Dosage form"
                                v-model="editForm.dosageForm"
                                :options="dosageFormOptions"
                                placeholder="Select dosage form"
                                search-placeholder="Search tablet, capsule, syrup..."
                                empty-text="No matching dosage form found."
                                :reserve-message-space="false"
                            />
                            <ComboboxField
                                input-id="edit-clinical-definition-route"
                                label="Route"
                                v-model="editForm.route"
                                :options="routeOfAdministrationOptions"
                                placeholder="Select route"
                                search-placeholder="Search oral, IV, IM..."
                                empty-text="No matching route found."
                                :reserve-message-space="false"
                            />
                            <div class="grid gap-1.5"><Label>Prescription type</Label><Select v-model="editForm.otcAllowed"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">OTC</SelectItem><SelectItem value="no">Rx</SelectItem></SelectContent></Select></div>
                            <ComboboxField
                                input-id="edit-clinical-definition-stock-unit"
                                label="Stock unit"
                                v-model="editForm.stockUnit"
                                :options="dispensingUnitOptions"
                                placeholder="Select stock unit"
                                search-placeholder="Search bottle, box, vial..."
                                empty-text="No matching unit found."
                                :reserve-message-space="false"
                            />
                            <div class="grid gap-1.5"><Label>Pack size</Label><Input v-model="editForm.packSize" placeholder="e.g. 28" /><p class="text-xs text-muted-foreground">How many dispensing units per pack</p></div>
                            <div class="grid gap-1.5">
                                <Label>Conversion</Label>
                                <Input v-model="editForm.conversionFactor" type="number" min="0" step="0.001" placeholder="e.g. 4" />
                                <p class="text-xs text-muted-foreground">1 stock unit = N dispensing units. Example: 4 if 1 blister = 4 tablets</p>
                            </div>
                            <ComboboxField
                                input-id="edit-clinical-definition-purchase-unit"
                                label="Purchase unit"
                                v-model="editForm.purchaseUnit"
                                :options="dispensingUnitOptions"
                                placeholder="Select purchase unit"
                                search-placeholder="Search box, carton, pack..."
                                empty-text="No matching unit found."
                                :reserve-message-space="false"
                            />
                            <div class="grid gap-1.5 md:col-span-2">
                                <Label>Stock units per purchase unit</Label>
                                <Input v-model="editForm.purchaseUnitQuantity" type="number" min="0" step="0.001" placeholder="e.g. 10" />
                                <p class="text-xs text-muted-foreground">How many stock units per purchase unit. Example: 10 if 1 box = 10 blisters</p>
                            </div>
                        </div>
                    </fieldset>

                    <fieldset v-if="itemCatalogKey(item) === 'formulary-items'" class="space-y-3 rounded-lg border p-3">
                        <legend class="px-1 text-sm font-medium">Clinical classification &amp; compliance</legend>
                        <div class="grid gap-3 md:grid-cols-2">
                            <div class="grid gap-1.5">
                                <Label>Generic name</Label>
                                <Input v-model="editForm.genericName" placeholder="e.g. Amoxicillin" />
                                <p class="text-xs text-muted-foreground">Defaults to the item name (minus strength) if left blank</p>
                            </div>
                            <div class="grid gap-1.5">
                                <Label>Generic group code</Label>
                                <Input v-model="editForm.genericGroupCode" placeholder="e.g. AMOXICILLIN" />
                                <p class="text-xs text-muted-foreground">Links brand/generic variants of the same drug together</p>
                            </div>
                            <div class="grid gap-1.5 md:col-span-2">
                                <Label>Storage conditions</Label>
                                <Input v-model="editForm.storageConditions" placeholder="e.g. Store below 25°C, protect from light" />
                            </div>
                        </div>
                        <div class="grid gap-3 md:grid-cols-2">
                            <div class="flex items-start gap-2 rounded-md border p-2.5">
                                <Checkbox
                                    :model-value="editForm.requiresColdChain"
                                    :disabled="!canManageCompliance"
                                    @update:model-value="(value) => (editForm.requiresColdChain = value === true)"
                                />
                                <div class="space-y-0.5">
                                    <Label class="text-xs font-medium">Requires cold chain</Label>
                                    <p v-if="!canManageCompliance" class="text-[11px] text-muted-foreground">Requires the compliance permission to change</p>
                                </div>
                            </div>
                            <div class="flex items-start gap-2 rounded-md border p-2.5">
                                <Checkbox
                                    :model-value="editForm.isControlledSubstance"
                                    :disabled="!canManageCompliance"
                                    @update:model-value="(value) => (editForm.isControlledSubstance = value === true)"
                                />
                                <div class="space-y-0.5">
                                    <Label class="text-xs font-medium">Controlled substance</Label>
                                    <p v-if="!canManageCompliance" class="text-[11px] text-muted-foreground">Requires the compliance permission to change</p>
                                </div>
                            </div>
                            <div v-if="editForm.isControlledSubstance" class="grid gap-1.5 md:col-span-2">
                                <Label>Controlled substance schedule</Label>
                                <Input v-model="editForm.controlledSubstanceSchedule" :disabled="!canManageCompliance" placeholder="e.g. Schedule II" />
                                <p v-if="firstError(editErrors, 'controlledSubstanceSchedule')" class="text-xs text-destructive">{{ firstError(editErrors, 'controlledSubstanceSchedule') }}</p>
                            </div>
                        </div>
                    </fieldset>

                    <details class="rounded-lg border bg-muted/10 p-3">
                        <summary class="cursor-pointer text-sm font-medium">Advanced / standards</summary>
                        <div class="mt-3 space-y-3">
                            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div class="grid gap-1.5">
                                    <Label>Minimum facility tier</Label>
                                    <Select
                                        :model-value="editForm.facilityTier || SELECT_NOT_SPECIFIED_VALUE"
                                        @update:model-value="(value) => { editForm.facilityTier = value === SELECT_NOT_SPECIFIED_VALUE ? '' : String(value); }"
                                    >
                                        <SelectTrigger class="w-full"><SelectValue placeholder="All tiers" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">All tiers</SelectItem>
                                            <SelectItem v-for="tier in facilityTierOptions" :key="tier.value" :value="tier.value">{{ tier.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-1.5"><Label>Local code</Label><Input v-model="editForm.standardsLocal" placeholder="Internal code" /></div>
                                <div class="grid gap-1.5"><Label>NHIF code</Label><Input v-model="editForm.standardsNhif" placeholder="NHIF tariff code" /></div>
                                <div class="grid gap-1.5"><Label>MSD code</Label><Input v-model="editForm.standardsMsd" placeholder="MSD reference" /></div>
                                <div class="grid gap-1.5"><Label>LOINC</Label><Input v-model="editForm.standardsLoinc" placeholder="Lab standard" /></div>
                                <div class="grid gap-1.5"><Label>SNOMED CT</Label><Input v-model="editForm.standardsSnomedCt" placeholder="Clinical concept" /></div>
                                <div class="grid gap-1.5"><Label>CPT</Label><Input v-model="editForm.standardsCpt" placeholder="Optional procedure code" /></div>
                                <div class="grid gap-1.5"><Label>ICD</Label><Input v-model="editForm.standardsIcd" placeholder="Optional diagnosis link" /></div>
                            </div>
                            <div class="grid gap-1.5">
                                <Label>Additional metadata JSON</Label>
                                <Textarea v-model="editForm.metadataText" class="min-h-24 font-mono text-xs" />
                                <p v-if="firstError(editErrors, 'metadata')" class="text-xs text-destructive">{{ firstError(editErrors, 'metadata') }}</p>
                            </div>
                        </div>
                    </details>
                </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 flex-row items-center justify-end gap-2 border-t px-4 py-3">
                <Button variant="outline" :disabled="editBusy" @click="open = false">Cancel</Button>
                <Button :disabled="editBusy" @click="saveItem">{{ editBusy ? 'Saving...' : 'Save changes' }}</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
