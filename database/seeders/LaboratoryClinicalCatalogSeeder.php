<?php

namespace Database\Seeders;

use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogItemStatus;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use Illuminate\Database\Seeder;

class LaboratoryClinicalCatalogSeeder extends Seeder
{
    /**
     * @var array<int, array{
     *     code: string,
     *     name: string,
     *     category: string,
     *     unit: string,
     *     sampleType: string,
     *     description: string,
     *     parameters?: array<int, array{code: string, name: string, unit: string, referenceRangeLow: string, referenceRangeHigh: string}>,
     *     resultTemplate?: array<string, mixed>
     * }>
     */
    private const LAB_TEST_BLUEPRINTS = [
        [
            'code' => 'LAB-CBC-001',
            'name' => 'Complete Blood Count',
            'category' => 'hematology',
            'unit' => 'panel',
            'sampleType' => 'blood',
            'description' => 'Common hematology panel for anemia, infection, and general review.',
            'parameters' => [
                ['code' => 'WBC', 'name' => 'White Blood Cells', 'unit' => 'x10^9/L', 'referenceRangeLow' => '4.0', 'referenceRangeHigh' => '11.0'],
                ['code' => 'RBC', 'name' => 'Red Blood Cells', 'unit' => 'x10^12/L', 'referenceRangeLow' => '3.8', 'referenceRangeHigh' => '5.8'],
                ['code' => 'HGB', 'name' => 'Hemoglobin', 'unit' => 'g/dL', 'referenceRangeLow' => '11.5', 'referenceRangeHigh' => '16.5'],
                ['code' => 'HCT', 'name' => 'Hematocrit', 'unit' => '%', 'referenceRangeLow' => '35', 'referenceRangeHigh' => '48'],
                ['code' => 'MCV', 'name' => 'Mean Corpuscular Volume', 'unit' => 'fL', 'referenceRangeLow' => '80', 'referenceRangeHigh' => '100'],
                ['code' => 'MCH', 'name' => 'Mean Corpuscular Hemoglobin', 'unit' => 'pg', 'referenceRangeLow' => '27', 'referenceRangeHigh' => '32'],
                ['code' => 'MCHC', 'name' => 'Mean Corpuscular Hemoglobin Concentration', 'unit' => 'g/dL', 'referenceRangeLow' => '32', 'referenceRangeHigh' => '36'],
                ['code' => 'PLT', 'name' => 'Platelet Count', 'unit' => 'x10^9/L', 'referenceRangeLow' => '150', 'referenceRangeHigh' => '450'],
            ],
        ],
        [
            'code' => 'LAB-HB-001',
            'name' => 'Hemoglobin',
            'category' => 'hematology',
            'unit' => 'test',
            'sampleType' => 'blood',
            'description' => 'Single hemoglobin measurement for anemia screening and follow-up.',
        ],
        [
            'code' => 'LAB-ESR-001',
            'name' => 'Erythrocyte Sedimentation Rate',
            'category' => 'hematology',
            'unit' => 'test',
            'sampleType' => 'blood',
            'description' => 'Inflammation marker commonly used in follow-up and chronic disease review.',
        ],
        [
            'code' => 'LAB-BGRH-001',
            'name' => 'Blood Group and Rh',
            'category' => 'transfusion',
            'unit' => 'test',
            'sampleType' => 'blood',
            'description' => 'ABO grouping and Rh typing for transfusion and maternity workflows.',
        ],
        [
            'code' => 'LAB-SICKLE-001',
            'name' => 'Sickle Cell Screen',
            'category' => 'hematology',
            'unit' => 'test',
            'sampleType' => 'blood',
            'description' => 'Screening test for sickle cell disease and trait.',
        ],
        [
            'code' => 'LAB-MPS-001',
            'name' => 'Malaria Parasite Smear',
            'category' => 'parasitology',
            'unit' => 'test',
            'sampleType' => 'blood',
            'description' => 'Microscopy-based malaria parasite assessment.',
        ],
        [
            'code' => 'LAB-MRDT-001',
            'name' => 'Malaria Rapid Diagnostic Test',
            'category' => 'parasitology',
            'unit' => 'test',
            'sampleType' => 'blood',
            'description' => 'Rapid malaria screening test commonly used in outpatient and emergency care.',
        ],
        [
            'code' => 'LAB-BG-001',
            'name' => 'Blood Glucose',
            'category' => 'chemistry',
            'unit' => 'test',
            'sampleType' => 'blood',
            'description' => 'Random or fasting blood glucose measurement.',
        ],
        [
            'code' => 'LAB-HBA1C-001',
            'name' => 'HbA1c',
            'category' => 'chemistry',
            'unit' => 'test',
            'sampleType' => 'blood',
            'description' => 'Diabetes monitoring test reflecting average glycemic control.',
        ],
        [
            'code' => 'LAB-CREA-001',
            'name' => 'Serum Creatinine',
            'category' => 'chemistry',
            'unit' => 'test',
            'sampleType' => 'serum',
            'description' => 'Renal function marker used in routine inpatient and outpatient care.',
        ],
        [
            'code' => 'LAB-UEL-001',
            'name' => 'Urea and Electrolytes',
            'category' => 'chemistry',
            'unit' => 'panel',
            'sampleType' => 'serum',
            'description' => 'Renal and electrolyte panel for dehydration, renal disease, and admissions.',
            'parameters' => [
                ['code' => 'UREA', 'name' => 'Urea', 'unit' => 'mmol/L', 'referenceRangeLow' => '2.5', 'referenceRangeHigh' => '7.5'],
                ['code' => 'CREA', 'name' => 'Creatinine', 'unit' => 'umol/L', 'referenceRangeLow' => '45', 'referenceRangeHigh' => '110'],
                ['code' => 'NA', 'name' => 'Sodium', 'unit' => 'mmol/L', 'referenceRangeLow' => '135', 'referenceRangeHigh' => '145'],
                ['code' => 'K', 'name' => 'Potassium', 'unit' => 'mmol/L', 'referenceRangeLow' => '3.5', 'referenceRangeHigh' => '5.0'],
                ['code' => 'CL', 'name' => 'Chloride', 'unit' => 'mmol/L', 'referenceRangeLow' => '95', 'referenceRangeHigh' => '108'],
                ['code' => 'HCO3', 'name' => 'Bicarbonate', 'unit' => 'mmol/L', 'referenceRangeLow' => '22', 'referenceRangeHigh' => '29'],
            ],
        ],
        [
            'code' => 'LAB-LFT-001',
            'name' => 'Liver Function Tests',
            'category' => 'chemistry',
            'unit' => 'panel',
            'sampleType' => 'serum',
            'description' => 'Baseline liver profile for hepatitis, medication review, and inpatient workup.',
            'parameters' => [
                ['code' => 'TBIL', 'name' => 'Total Bilirubin', 'unit' => 'umol/L', 'referenceRangeLow' => '0', 'referenceRangeHigh' => '21'],
                ['code' => 'ALP', 'name' => 'Alkaline Phosphatase', 'unit' => 'U/L', 'referenceRangeLow' => '44', 'referenceRangeHigh' => '147'],
                ['code' => 'ALT', 'name' => 'Alanine Transaminase', 'unit' => 'U/L', 'referenceRangeLow' => '5', 'referenceRangeHigh' => '40'],
                ['code' => 'AST', 'name' => 'Aspartate Transaminase', 'unit' => 'U/L', 'referenceRangeLow' => '8', 'referenceRangeHigh' => '33'],
                ['code' => 'GGT', 'name' => 'Gamma-Glutamyl Transferase', 'unit' => 'U/L', 'referenceRangeLow' => '5', 'referenceRangeHigh' => '40'],
                ['code' => 'ALB', 'name' => 'Albumin', 'unit' => 'g/dL', 'referenceRangeLow' => '3.2', 'referenceRangeHigh' => '5.0'],
                ['code' => 'TPROT', 'name' => 'Total Protein', 'unit' => 'g/dL', 'referenceRangeLow' => '6.0', 'referenceRangeHigh' => '8.3'],
            ],
        ],
        [
            'code' => 'LAB-CRP-001',
            'name' => 'C-Reactive Protein',
            'category' => 'immunology',
            'unit' => 'test',
            'sampleType' => 'serum',
            'description' => 'Inflammatory marker used in infection and treatment response review.',
        ],
        [
            'code' => 'LAB-UA-001',
            'name' => 'Urinalysis',
            'category' => 'urinalysis',
            'unit' => 'panel',
            'sampleType' => 'urine',
            'description' => 'Routine urine analysis for infection, pregnancy follow-up, and renal screening.',
            'parameters' => [
                ['code' => 'COLOR', 'name' => 'Color', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'APPEAR', 'name' => 'Appearance', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'SG', 'name' => 'Specific Gravity', 'unit' => '', 'referenceRangeLow' => '1.005', 'referenceRangeHigh' => '1.030'],
                ['code' => 'PH', 'name' => 'pH', 'unit' => '', 'referenceRangeLow' => '4.5', 'referenceRangeHigh' => '8.0'],
                ['code' => 'PROT', 'name' => 'Protein', 'unit' => 'g/L', 'referenceRangeLow' => '0', 'referenceRangeHigh' => '0.15'],
                ['code' => 'GLU', 'name' => 'Glucose', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'KET', 'name' => 'Ketones', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'BIL', 'name' => 'Bilirubin', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'UBG', 'name' => 'Urobilinogen', 'unit' => 'mg/dL', 'referenceRangeLow' => '0.1', 'referenceRangeHigh' => '1.0'],
                ['code' => 'NIT', 'name' => 'Nitrites', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'BLOOD', 'name' => 'Blood', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'LEUK', 'name' => 'Leukocytes', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'WBC_UA', 'name' => 'White Blood Cells', 'unit' => '/HPF', 'referenceRangeLow' => '0', 'referenceRangeHigh' => '5'],
                ['code' => 'RBC_UA', 'name' => 'Red Blood Cells', 'unit' => '/HPF', 'referenceRangeLow' => '0', 'referenceRangeHigh' => '3'],
                ['code' => 'EPI', 'name' => 'Epithelial Cells', 'unit' => '/HPF', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'BACT', 'name' => 'Bacteria', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
            ],
        ],
        [
            'code' => 'LAB-UPT-001',
            'name' => 'Urine Pregnancy Test',
            'category' => 'immunology',
            'unit' => 'test',
            'sampleType' => 'urine',
            'description' => 'Rapid pregnancy screening test.',
        ],
        [
            'code' => 'LAB-STOOL-001',
            'name' => 'Stool Microscopy',
            'category' => 'parasitology',
            'unit' => 'panel',
            'sampleType' => 'stool',
            'description' => 'Common stool examination for ova, parasites, and gastrointestinal complaints.',
            'parameters' => [
                ['code' => 'CONSIST', 'name' => 'Consistency', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'COLOR_STOOL', 'name' => 'Color', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'MUCUS', 'name' => 'Mucus', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'BLOOD_STOOL', 'name' => 'Blood', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'WBC_STOOL', 'name' => 'White Blood Cells', 'unit' => '/HPF', 'referenceRangeLow' => '0', 'referenceRangeHigh' => '0'],
                ['code' => 'RBC_STOOL', 'name' => 'Red Blood Cells', 'unit' => '/HPF', 'referenceRangeLow' => '0', 'referenceRangeHigh' => '0'],
                ['code' => 'OVA', 'name' => 'Ova', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'PARASITES', 'name' => 'Parasites', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'CYSTS', 'name' => 'Cysts', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
                ['code' => 'FAT', 'name' => 'Fat Globules', 'unit' => '/HPF', 'referenceRangeLow' => '0', 'referenceRangeHigh' => '2'],
                ['code' => 'YEAST', 'name' => 'Yeast Cells', 'unit' => '', 'referenceRangeLow' => '', 'referenceRangeHigh' => ''],
            ],
        ],
        [
            'code' => 'LAB-HIV-001',
            'name' => 'HIV 1/2 Rapid Test',
            'category' => 'serology',
            'unit' => 'test',
            'sampleType' => 'whole blood',
            'description' => 'Rapid HIV screening test used in routine counseling and clinical workflows.',
        ],
        [
            'code' => 'LAB-HBSAG-001',
            'name' => 'HBsAg',
            'category' => 'serology',
            'unit' => 'test',
            'sampleType' => 'serum',
            'description' => 'Hepatitis B surface antigen screening test.',
        ],
        [
            'code' => 'LAB-VDRL-001',
            'name' => 'VDRL/RPR',
            'category' => 'serology',
            'unit' => 'test',
            'sampleType' => 'serum',
            'description' => 'Common syphilis screening test used in ANC and general care.',
        ],
        [
            'code' => 'LAB-STOOL-001',
            'name' => 'Stool Analysis',
            'category' => 'parasitology',
            'unit' => 'test',
            'sampleType' => 'stool',
            'description' => 'Routine stool microscopy for ova, parasites, and macroscopic examination.',
            'resultTemplate' => [
                'sections' => [
                    [
                        'label' => 'Macroscopic Examination',
                        'fields' => [
                            ['code' => 'colour', 'label' => 'Colour', 'type' => 'select', 'options' => ['Brown', 'Yellow', 'Green', 'Black', 'Red', 'Pale', 'Other']],
                            ['code' => 'consistency', 'label' => 'Consistency', 'type' => 'select', 'options' => ['Formed', 'Soft', 'Loose', 'Watery', 'Mucoid']],
                            ['code' => 'mucus', 'label' => 'Mucus', 'type' => 'not-done'],
                            ['code' => 'blood_visible', 'label' => 'Blood (visible)', 'type' => 'not-done'],
                            ['code' => 'pus', 'label' => 'Pus', 'type' => 'not-done'],
                            ['code' => 'worms_segments', 'label' => 'Worms / Segments', 'type' => 'not-done'],
                            ['code' => 'adult_parasites', 'label' => 'Adult Parasites Seen', 'type' => 'text', 'placeholder' => 'e.g. Ascaris worm…'],
                        ],
                    ],
                    [
                        'label' => 'Microscopic Examination',
                        'fields' => [
                            ['code' => 'rbc', 'label' => 'Red Blood Cells (RBC)', 'type' => 'text', 'placeholder' => 'e.g. 0–2/HPF'],
                            ['code' => 'wbc', 'label' => 'White Blood Cells (WBC/Pus cells)', 'type' => 'text', 'placeholder' => 'e.g. 3–5/HPF'],
                            ['code' => 'epithelial_cells', 'label' => 'Epithelial Cells', 'type' => 'text', 'placeholder' => 'e.g. Few, Moderate, Many'],
                            ['code' => 'yeast_cells', 'label' => 'Yeast Cells', 'type' => 'text', 'placeholder' => 'e.g. None, Few, Moderate'],
                            ['code' => 'fat_globules', 'label' => 'Fat Globules', 'type' => 'select', 'options' => ['Absent', 'Few', 'Moderate', 'Many']],
                            ['code' => 'starch_granules', 'label' => 'Starch Granules', 'type' => 'select', 'options' => ['Absent', 'Few', 'Moderate', 'Many']],
                            ['code' => 'muscle_fibres', 'label' => 'Muscle Fibres', 'type' => 'select', 'options' => ['Absent', 'Few', 'Moderate', 'Many']],
                        ],
                    ],
                    [
                        'label' => 'Ova and Parasites',
                        'fields' => [
                            ['code' => 'ova_seen', 'label' => 'Ova Seen', 'type' => 'multiselect', 'options' => ['None Seen', 'Ascaris lumbricoides', 'Hookworm', 'Trichuris trichiura', 'Taenia spp.', 'Schistosoma mansoni', 'Hymenolepis nana', 'Other']],
                            ['code' => 'cysts_seen', 'label' => 'Cysts Seen', 'type' => 'multiselect', 'options' => ['None Seen', 'Giardia lamblia', 'Entamoeba histolytica', 'Entamoeba coli', 'Other']],
                            ['code' => 'trophozoites_seen', 'label' => 'Trophozoites Seen', 'type' => 'multiselect', 'options' => ['None Seen', 'Giardia lamblia', 'Entamoeba histolytica', 'Other']],
                            ['code' => 'larvae_seen', 'label' => 'Larvae Seen', 'type' => 'multiselect', 'options' => ['None Seen', 'Strongyloides stercoralis', 'Other']],
                        ],
                    ],
                    [
                        'label' => 'Occult Blood',
                        'fields' => [
                            ['code' => 'occult_blood', 'label' => 'Occult Blood', 'type' => 'positive-negative'],
                        ],
                    ],
                    [
                        'label' => 'Additional Tests',
                        'fields' => [
                            ['code' => 'ph', 'label' => 'pH', 'type' => 'number', 'placeholder' => 'e.g. 6.5'],
                            ['code' => 'reducing_substance', 'label' => 'Reducing Substance', 'type' => 'positive-negative'],
                        ],
                    ],
                ],
            ],
        ],
    ];

    public function run(): void
    {
        $facilities = FacilityModel::query()
            ->orderBy('name')
            ->get(['id', 'tenant_id', 'code', 'name']);

        if ($facilities->isEmpty()) {
            $seededCount = $this->seedScope(
                tenantId: null,
                facilityId: null,
            );

            $this->command?->warn(
                sprintf(
                    'No facilities found. Seeded %d global laboratory clinical catalog items.',
                    $seededCount,
                ),
            );

            return;
        }

        foreach ($facilities as $facility) {
            $seededCount = $this->seedScope(
                tenantId: $facility->tenant_id ? (string) $facility->tenant_id : null,
                facilityId: (string) $facility->id,
            );

            $facilityLabel = trim((string) ($facility->name ?: $facility->code ?: $facility->id));
            $this->command?->info(
                sprintf(
                    'Seeded %d laboratory clinical catalog items for %s.',
                    $seededCount,
                    $facilityLabel,
                ),
            );
        }
    }

    private function seedScope(?string $tenantId, ?string $facilityId): int
    {
        $seededCount = 0;

        foreach (self::LAB_TEST_BLUEPRINTS as $blueprint) {
            ClinicalCatalogItemModel::query()->updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'facility_id' => $facilityId,
                    'catalog_type' => ClinicalCatalogType::LAB_TEST->value,
                    'code' => $blueprint['code'],
                ],
                [
                    'name' => $blueprint['name'],
                    'department_id' => null,
                    'category' => $blueprint['category'],
                    'unit' => $blueprint['unit'],
                    'description' => $blueprint['description'],
                    'metadata' => [
                        'sampleType' => $blueprint['sampleType'],
                        'countryContext' => 'TZ',
                        'parameters' => $blueprint['parameters'] ?? [],
                        'resultTemplate' => $blueprint['resultTemplate'] ?? null,
                    ],
                    'status' => ClinicalCatalogItemStatus::ACTIVE->value,
                    'status_reason' => null,
                ],
            );

            $seededCount++;
        }

        return $seededCount;
    }
}
