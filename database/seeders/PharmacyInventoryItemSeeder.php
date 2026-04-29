<?php

namespace Database\Seeders;

use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryItemCategory;
use App\Modules\InventoryProcurement\Infrastructure\Models\InventoryItemModel;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class PharmacyInventoryItemSeeder extends Seeder
{
    /**
     * @var array<int, array{
     *     code: string,
     *     name: string,
     *     category: string,
     *     unit: string,
     *     currentStock: float,
     *     reorderLevel: float,
     *     maxStockLevel: float
     * }>
     */
    private const INVENTORY_BLUEPRINTS = [
        [
            'code' => 'MED-PARA-500TAB',
            'name' => 'Paracetamol 500mg',
            'category' => 'analgesics',
            'unit' => 'tablet',
            'currentStock' => 480,
            'reorderLevel' => 120,
            'maxStockLevel' => 800,
        ],
        [
            'code' => 'MED-IBU-400TAB',
            'name' => 'Ibuprofen 400mg',
            'category' => 'analgesics',
            'unit' => 'tablet',
            'currentStock' => 36,
            'reorderLevel' => 40,
            'maxStockLevel' => 240,
        ],
        [
            'code' => 'MED-AMOX-500CAP',
            'name' => 'Amoxicillin 500mg',
            'category' => 'antibiotics',
            'unit' => 'capsule',
            'currentStock' => 82,
            'reorderLevel' => 50,
            'maxStockLevel' => 220,
        ],
        [
            'code' => 'MED-COTR-960TAB',
            'name' => 'Co-trimoxazole 960mg',
            'category' => 'antibiotics',
            'unit' => 'tablet',
            'currentStock' => 0,
            'reorderLevel' => 25,
            'maxStockLevel' => 160,
        ],
        [
            'code' => 'MED-METR-400TAB',
            'name' => 'Metronidazole 400mg',
            'category' => 'antibiotics',
            'unit' => 'tablet',
            'currentStock' => 60,
            'reorderLevel' => 30,
            'maxStockLevel' => 180,
        ],
        [
            'code' => 'MED-CEFTR-1GINJ',
            'name' => 'Ceftriaxone 1g',
            'category' => 'antibiotics',
            'unit' => 'vial',
            'currentStock' => 8,
            'reorderLevel' => 15,
            'maxStockLevel' => 80,
        ],
        [
            'code' => 'MED-ALU-20-120TAB',
            'name' => 'Artemether/Lumefantrine 20mg/120mg',
            'category' => 'antimalarials',
            'unit' => 'tablet',
            'currentStock' => 125,
            'reorderLevel' => 60,
            'maxStockLevel' => 240,
        ],
        [
            'code' => 'MED-ORS-SACHET',
            'name' => 'Oral Rehydration Salts',
            'category' => 'fluids_and_electrolytes',
            'unit' => 'sachet',
            'currentStock' => 12,
            'reorderLevel' => 20,
            'maxStockLevel' => 120,
        ],
        [
            'code' => 'MED-ZINC-20TAB',
            'name' => 'Zinc Sulfate 20mg',
            'category' => 'pediatric_support',
            'unit' => 'tablet',
            'currentStock' => 0,
            'reorderLevel' => 20,
            'maxStockLevel' => 140,
        ],
        [
            'code' => 'MED-OMEP-20CAP',
            'name' => 'Omeprazole 20mg',
            'category' => 'gastrointestinal',
            'unit' => 'capsule',
            'currentStock' => 44,
            'reorderLevel' => 20,
            'maxStockLevel' => 160,
        ],
        [
            'code' => 'MED-SALB-100INH',
            'name' => 'Salbutamol Inhaler 100mcg',
            'category' => 'respiratory',
            'unit' => 'inhaler',
            'currentStock' => 18,
            'reorderLevel' => 10,
            'maxStockLevel' => 72,
        ],
        [
            'code' => 'MED-METF-500TAB',
            'name' => 'Metformin 500mg',
            'category' => 'endocrine',
            'unit' => 'tablet',
            'currentStock' => 96,
            'reorderLevel' => 40,
            'maxStockLevel' => 220,
        ],
        [
            'code' => 'MED-AMLO-5TAB',
            'name' => 'Amlodipine 5mg',
            'category' => 'cardiovascular',
            'unit' => 'tablet',
            'currentStock' => 130,
            'reorderLevel' => 60,
            'maxStockLevel' => 260,
        ],
        [
            'code' => 'MED-FURO-40TAB',
            'name' => 'Furosemide 40mg',
            'category' => 'cardiovascular',
            'unit' => 'tablet',
            'currentStock' => 24,
            'reorderLevel' => 30,
            'maxStockLevel' => 140,
        ],
        [
            'code' => 'MED-IRON-FOLTAB',
            'name' => 'Iron + Folic Acid',
            'category' => 'maternal_health',
            'unit' => 'tablet',
            'currentStock' => 240,
            'reorderLevel' => 60,
            'maxStockLevel' => 400,
        ],
        [
            'code' => 'MED-OXYT-10INJ',
            'name' => 'Oxytocin 10 IU',
            'category' => 'maternal_health',
            'unit' => 'ampoule',
            'currentStock' => 6,
            'reorderLevel' => 10,
            'maxStockLevel' => 48,
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
                facilityCode: null,
            );

            $this->command?->warn(
                sprintf(
                    'No facilities found. Seeded %d global pharmacy inventory items.',
                    $seededCount,
                ),
            );

            return;
        }

        foreach ($facilities as $facility) {
            $seededCount = $this->seedScope(
                tenantId: $facility->tenant_id ? (string) $facility->tenant_id : null,
                facilityId: (string) $facility->id,
                facilityCode: $facility->code ? (string) $facility->code : null,
            );

            $facilityLabel = trim((string) ($facility->name ?: $facility->code ?: $facility->id));
            $this->command?->info(
                sprintf(
                    'Seeded %d pharmacy inventory items for %s.',
                    $seededCount,
                    $facilityLabel,
                ),
            );
        }
    }

    private function seedScope(
        ?string $tenantId,
        ?string $facilityId,
        ?string $facilityCode,
    ): int {
        $seededCount = 0;

        foreach (self::INVENTORY_BLUEPRINTS as $blueprint) {
            InventoryItemModel::query()->updateOrCreate(
                [
                    'item_code' => $this->scopedItemCode(
                        $blueprint['code'],
                        $facilityCode,
                    ),
                ],
                [
                    'tenant_id' => $tenantId,
                    'facility_id' => $facilityId,
                    'clinical_catalog_item_id' => $this->clinicalCatalogItemIdForBlueprint(
                        $blueprint['code'],
                        $tenantId,
                        $facilityId,
                    ),
                    'item_name' => $blueprint['name'],
                    'category' => InventoryItemCategory::PHARMACEUTICAL->value,
                    'subcategory' => $blueprint['category'],
                    'unit' => $blueprint['unit'],
                    'current_stock' => $blueprint['currentStock'],
                    'reorder_level' => $blueprint['reorderLevel'],
                    'max_stock_level' => $blueprint['maxStockLevel'],
                    'status' => 'active',
                ],
            );

            $seededCount++;
        }

        return $seededCount;
    }

    private function clinicalCatalogItemIdForBlueprint(
        string $code,
        ?string $tenantId,
        ?string $facilityId,
    ): ?string {
        $item = ClinicalCatalogItemModel::query()
            ->where('tenant_id', $tenantId)
            ->where('facility_id', $facilityId)
            ->where('catalog_type', ClinicalCatalogType::FORMULARY_ITEM->value)
            ->where('code', $code)
            ->first(['id']);

        return $item?->id ? (string) $item->id : null;
    }

    private function scopedItemCode(string $baseCode, ?string $facilityCode): string
    {
        $normalizedFacilityCode = Str::upper(
            preg_replace('/[^A-Za-z0-9]+/', '-', trim((string) $facilityCode)) ?: '',
        );

        if ($normalizedFacilityCode === '') {
            return $baseCode;
        }

        $prefix = Str::limit(trim($normalizedFacilityCode, '-'), 16, '');

        return "{$prefix}-{$baseCode}";
    }
}

