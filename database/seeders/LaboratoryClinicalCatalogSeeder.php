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
     *     description: string
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
        ],
        [
            'code' => 'LAB-LFT-001',
            'name' => 'Liver Function Tests',
            'category' => 'chemistry',
            'unit' => 'panel',
            'sampleType' => 'serum',
            'description' => 'Baseline liver profile for hepatitis, medication review, and inpatient workup.',
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
