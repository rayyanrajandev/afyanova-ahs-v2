<?php

namespace Database\Seeders;

use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogItemStatus;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use Illuminate\Database\Seeder;

class RadiologyClinicalCatalogSeeder extends Seeder
{
    /**
     * @var array<int, array{
     *     code: string,
     *     name: string,
     *     category: string,
     *     unit: string,
     *     bodyRegion: string,
     *     contrast: string,
     *     description: string
     * }>
     */
    private const RADIOLOGY_PROCEDURE_BLUEPRINTS = [
        [
            'code' => 'RAD-CXR-001',
            'name' => 'Chest X-Ray (PA)',
            'category' => 'xray',
            'unit' => 'study',
            'bodyRegion' => 'chest',
            'contrast' => 'none',
            'description' => 'Standard chest radiograph commonly used for cough, TB review, pneumonia, and cardiac silhouette assessment.',
        ],
        [
            'code' => 'RAD-CXR-002',
            'name' => 'Chest X-Ray (AP Portable)',
            'category' => 'xray',
            'unit' => 'study',
            'bodyRegion' => 'chest',
            'contrast' => 'none',
            'description' => 'Portable chest imaging often used for inpatient, emergency, and reduced-mobility workflows.',
        ],
        [
            'code' => 'RAD-ABD-001',
            'name' => 'Abdomen X-Ray (AP)',
            'category' => 'xray',
            'unit' => 'study',
            'bodyRegion' => 'abdomen',
            'contrast' => 'none',
            'description' => 'Plain abdominal radiograph used for obstruction, constipation, and acute abdominal assessment.',
        ],
        [
            'code' => 'RAD-PEL-001',
            'name' => 'Pelvis X-Ray (AP)',
            'category' => 'xray',
            'unit' => 'study',
            'bodyRegion' => 'pelvis',
            'contrast' => 'none',
            'description' => 'Pelvic radiograph used in trauma, fracture review, and orthopedic assessment.',
        ],
        [
            'code' => 'RAD-LSP-001',
            'name' => 'Lumbar Spine X-Ray',
            'category' => 'xray',
            'unit' => 'study',
            'bodyRegion' => 'lumbar_spine',
            'contrast' => 'none',
            'description' => 'Lumbar spine radiograph used for chronic back pain, trauma review, and degenerative disease assessment.',
        ],
        [
            'code' => 'RAD-USA-001',
            'name' => 'Abdominal Ultrasound',
            'category' => 'ultrasound',
            'unit' => 'study',
            'bodyRegion' => 'abdomen',
            'contrast' => 'none',
            'description' => 'Common ultrasound for hepatobiliary disease, abdominal pain, renal review, and general ward workup.',
        ],
        [
            'code' => 'RAD-USP-001',
            'name' => 'Pelvic Ultrasound',
            'category' => 'ultrasound',
            'unit' => 'study',
            'bodyRegion' => 'pelvis',
            'contrast' => 'none',
            'description' => 'Pelvic ultrasound used in gynecology, infertility, bleeding, and lower abdominal pain review.',
        ],
        [
            'code' => 'RAD-OBS-001',
            'name' => 'Obstetric Ultrasound',
            'category' => 'ultrasound',
            'unit' => 'study',
            'bodyRegion' => 'pregnancy',
            'contrast' => 'none',
            'description' => 'Routine pregnancy scan used for dating, fetal wellbeing, and ANC follow-up workflows.',
        ],
        [
            'code' => 'RAD-REN-001',
            'name' => 'Renal Ultrasound',
            'category' => 'ultrasound',
            'unit' => 'study',
            'bodyRegion' => 'kidney_urinary',
            'contrast' => 'none',
            'description' => 'Renal and urinary tract ultrasound commonly used for obstruction, stones, and renal disease review.',
        ],
        [
            'code' => 'RAD-BRE-001',
            'name' => 'Breast Ultrasound',
            'category' => 'ultrasound',
            'unit' => 'study',
            'bodyRegion' => 'breast',
            'contrast' => 'none',
            'description' => 'Breast ultrasound used for palpable lumps, pain review, and targeted imaging follow-up.',
        ],
        [
            'code' => 'RAD-CTH-001',
            'name' => 'CT Head (Non-contrast)',
            'category' => 'ct',
            'unit' => 'study',
            'bodyRegion' => 'head',
            'contrast' => 'none',
            'description' => 'Common CT brain study for trauma, stroke screening, reduced consciousness, and headache red flags.',
        ],
        [
            'code' => 'RAD-CTA-001',
            'name' => 'CT Abdomen/Pelvis',
            'category' => 'ct',
            'unit' => 'study',
            'bodyRegion' => 'abdomen_pelvis',
            'contrast' => 'with_or_without',
            'description' => 'Cross-sectional abdominal and pelvic imaging for trauma, oncology staging, and complex abdominal workup.',
        ],
        [
            'code' => 'RAD-CTC-001',
            'name' => 'CT Chest',
            'category' => 'ct',
            'unit' => 'study',
            'bodyRegion' => 'chest',
            'contrast' => 'with_or_without',
            'description' => 'Chest CT used for complex pulmonary disease, mass review, and advanced inpatient respiratory workup.',
        ],
        [
            'code' => 'RAD-MRB-001',
            'name' => 'MRI Brain',
            'category' => 'mri',
            'unit' => 'study',
            'bodyRegion' => 'brain',
            'contrast' => 'with_or_without',
            'description' => 'MRI brain study used for complex neurologic assessment, seizures, tumors, and chronic headache workup.',
        ],
        [
            'code' => 'RAD-MRS-001',
            'name' => 'MRI Lumbar Spine',
            'category' => 'mri',
            'unit' => 'study',
            'bodyRegion' => 'lumbar_spine',
            'contrast' => 'with_or_without',
            'description' => 'MRI lumbar spine study for radiculopathy, disc disease, neurologic deficit, and specialist referral review.',
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
                    'No facilities found. Seeded %d global radiology procedure catalog items.',
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
                    'Seeded %d radiology procedure catalog items for %s.',
                    $seededCount,
                    $facilityLabel,
                ),
            );
        }
    }

    private function seedScope(?string $tenantId, ?string $facilityId): int
    {
        $seededCount = 0;

        foreach (self::RADIOLOGY_PROCEDURE_BLUEPRINTS as $blueprint) {
            ClinicalCatalogItemModel::query()->updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'facility_id' => $facilityId,
                    'catalog_type' => ClinicalCatalogType::RADIOLOGY_PROCEDURE->value,
                    'code' => $blueprint['code'],
                ],
                [
                    'name' => $blueprint['name'],
                    'department_id' => null,
                    'category' => $blueprint['category'],
                    'unit' => $blueprint['unit'],
                    'description' => $blueprint['description'],
                    'metadata' => [
                        'billingServiceCode' => $blueprint['code'],
                        'modality' => $blueprint['category'],
                        'bodyRegion' => $blueprint['bodyRegion'],
                        'contrast' => $blueprint['contrast'],
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
