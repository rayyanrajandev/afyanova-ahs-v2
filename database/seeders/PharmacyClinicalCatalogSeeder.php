<?php

namespace Database\Seeders;

use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogItemStatus;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use Illuminate\Database\Seeder;

class PharmacyClinicalCatalogSeeder extends Seeder
{
    /**
     * @var array<int, array{
     *     code: string,
     *     name: string,
     *     category: string,
     *     unit: string,
     *     dosageForm: string,
     *     strength: string,
     *     description: string
     * }>
     */
    private const FORMULARY_BLUEPRINTS = [
        [
            'code' => 'MED-PARA-500TAB',
            'name' => 'Paracetamol 500mg',
            'category' => 'analgesics',
            'unit' => 'tablet',
            'dosageForm' => 'tablet',
            'strength' => '500 mg',
            'description' => 'Common first-line analgesic and antipyretic for adult and adolescent care.',
        ],
        [
            'code' => 'MED-IBU-400TAB',
            'name' => 'Ibuprofen 400mg',
            'category' => 'analgesics',
            'unit' => 'tablet',
            'dosageForm' => 'tablet',
            'strength' => '400 mg',
            'description' => 'NSAID commonly used for pain, inflammation, and fever when clinically appropriate.',
        ],
        [
            'code' => 'MED-AMOX-500CAP',
            'name' => 'Amoxicillin 500mg',
            'category' => 'antibiotics',
            'unit' => 'capsule',
            'dosageForm' => 'capsule',
            'strength' => '500 mg',
            'description' => 'Common oral antibiotic for susceptible respiratory, ENT, and dental infections.',
        ],
        [
            'code' => 'MED-COTR-960TAB',
            'name' => 'Co-trimoxazole 960mg',
            'category' => 'antibiotics',
            'unit' => 'tablet',
            'dosageForm' => 'tablet',
            'strength' => '960 mg',
            'description' => 'Sulfonamide combination used in routine outpatient and HIV-related infection pathways.',
        ],
        [
            'code' => 'MED-METR-400TAB',
            'name' => 'Metronidazole 400mg',
            'category' => 'antibiotics',
            'unit' => 'tablet',
            'dosageForm' => 'tablet',
            'strength' => '400 mg',
            'description' => 'Common anti-infective for anaerobic and gastrointestinal infection workflows.',
        ],
        [
            'code' => 'MED-CEFTR-1GINJ',
            'name' => 'Ceftriaxone 1g',
            'category' => 'antibiotics',
            'unit' => 'vial',
            'dosageForm' => 'injection',
            'strength' => '1 g',
            'description' => 'Parenteral cephalosporin widely used in inpatient and emergency care.',
        ],
        [
            'code' => 'MED-ALU-20-120TAB',
            'name' => 'Artemether/Lumefantrine 20mg/120mg',
            'category' => 'antimalarials',
            'unit' => 'tablet',
            'dosageForm' => 'tablet',
            'strength' => '20 mg / 120 mg',
            'description' => 'First-line oral antimalarial used in routine uncomplicated malaria care.',
        ],
        [
            'code' => 'MED-ORS-SACHET',
            'name' => 'Oral Rehydration Salts',
            'category' => 'fluids_and_electrolytes',
            'unit' => 'sachet',
            'dosageForm' => 'powder',
            'strength' => '1 sachet',
            'description' => 'Standard rehydration sachet for diarrheal illness and dehydration support.',
        ],
        [
            'code' => 'MED-ZINC-20TAB',
            'name' => 'Zinc Sulfate 20mg',
            'category' => 'pediatric_support',
            'unit' => 'tablet',
            'dosageForm' => 'dispersible tablet',
            'strength' => '20 mg',
            'description' => 'Common pediatric support medicine paired with ORS in diarrheal illness care.',
        ],
        [
            'code' => 'MED-OMEP-20CAP',
            'name' => 'Omeprazole 20mg',
            'category' => 'gastrointestinal',
            'unit' => 'capsule',
            'dosageForm' => 'capsule',
            'strength' => '20 mg',
            'description' => 'Proton-pump inhibitor used for dyspepsia, ulcer disease, and gastroprotection.',
        ],
        [
            'code' => 'MED-SALB-100INH',
            'name' => 'Salbutamol Inhaler 100mcg',
            'category' => 'respiratory',
            'unit' => 'inhaler',
            'dosageForm' => 'inhaler',
            'strength' => '100 mcg / puff',
            'description' => 'Short-acting bronchodilator used in asthma and wheeze care.',
        ],
        [
            'code' => 'MED-METF-500TAB',
            'name' => 'Metformin 500mg',
            'category' => 'endocrine',
            'unit' => 'tablet',
            'dosageForm' => 'tablet',
            'strength' => '500 mg',
            'description' => 'Common oral antidiabetic medicine for type 2 diabetes management.',
        ],
        [
            'code' => 'MED-AMLO-5TAB',
            'name' => 'Amlodipine 5mg',
            'category' => 'cardiovascular',
            'unit' => 'tablet',
            'dosageForm' => 'tablet',
            'strength' => '5 mg',
            'description' => 'Common antihypertensive used in routine outpatient blood-pressure management.',
        ],
        [
            'code' => 'MED-FURO-40TAB',
            'name' => 'Furosemide 40mg',
            'category' => 'cardiovascular',
            'unit' => 'tablet',
            'dosageForm' => 'tablet',
            'strength' => '40 mg',
            'description' => 'Loop diuretic used in edema, heart failure, and selected hypertension workflows.',
        ],
        [
            'code' => 'MED-IRON-FOLTAB',
            'name' => 'Iron + Folic Acid',
            'category' => 'maternal_health',
            'unit' => 'tablet',
            'dosageForm' => 'tablet',
            'strength' => '60 mg / 400 mcg',
            'description' => 'Routine iron and folate supplementation used in antenatal care and anemia support workflows.',
        ],
        [
            'code' => 'MED-OXYT-10INJ',
            'name' => 'Oxytocin 10 IU',
            'category' => 'maternal_health',
            'unit' => 'ampoule',
            'dosageForm' => 'injection',
            'strength' => '10 IU',
            'description' => 'Essential uterotonic used in maternity and postpartum hemorrhage prevention workflows.',
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
                    'No facilities found. Seeded %d global approved medicines catalog items.',
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
                    'Seeded %d approved medicines catalog items for %s.',
                    $seededCount,
                    $facilityLabel,
                ),
            );
        }
    }

    private function seedScope(?string $tenantId, ?string $facilityId): int
    {
        $seededCount = 0;

        foreach (self::FORMULARY_BLUEPRINTS as $blueprint) {
            ClinicalCatalogItemModel::query()->updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'facility_id' => $facilityId,
                    'catalog_type' => ClinicalCatalogType::FORMULARY_ITEM->value,
                    'code' => $blueprint['code'],
                ],
                [
                    'name' => $blueprint['name'],
                    'department_id' => null,
                    'category' => $blueprint['category'],
                    'unit' => $blueprint['unit'],
                    'description' => $blueprint['description'],
                    'metadata' => $this->metadataForBlueprint($blueprint),
                    'status' => ClinicalCatalogItemStatus::ACTIVE->value,
                    'status_reason' => null,
                ],
            );

            $seededCount++;
        }

        return $seededCount;
    }

    /**
     * @param  array{
     *      code:string,
     *      dosageForm:string,
     *      strength:string
     *  }  $blueprint
     * @return array<string, mixed>
     */
    private function metadataForBlueprint(array $blueprint): array
    {
        $metadata = [
            'dosageForm' => $blueprint['dosageForm'],
            'strength' => $blueprint['strength'],
            'countryContext' => 'TZ',
            'formularyStatus' => 'formulary',
            'reviewMode' => 'auto_formulary',
            'substitutionAllowed' => false,
        ];

        if ($blueprint['code'] === 'MED-CEFTR-1GINJ') {
            $metadata['reviewMode'] = 'policy_review_required';
            $metadata['restrictionReason'] = 'Broad-spectrum injectable antibiotic. Review indication and release path before dispensing.';
            $metadata['allowedIndicationKeywords'] = [
                'severe infection',
                'sepsis',
                'meningitis',
                'pneumonia',
                'pelvic infection',
            ];
        }

        if ($blueprint['code'] === 'MED-OXYT-10INJ') {
            $metadata['reviewMode'] = 'policy_review_required';
            $metadata['restrictionReason'] = 'Restricted to maternity and postpartum hemorrhage workflows with explicit clinical justification.';
            $metadata['allowedIndicationKeywords'] = [
                'postpartum',
                'hemorrhage',
                'haemorrhage',
                'labor',
                'induction',
            ];
        }

        return $metadata;
    }
}

