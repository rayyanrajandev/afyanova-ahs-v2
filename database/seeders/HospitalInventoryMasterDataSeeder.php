<?php

namespace Database\Seeders;

use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryItemCategory;
use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryItemStatus;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class HospitalInventoryMasterDataSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->physicalInventoryItems() as $item) {
            $this->upsertInventoryItem($item);
        }

        $this->ensureMedicineInventoryBridge();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function physicalInventoryItems(): array
    {
        return [
            [
                'item_code' => 'LAB-REAG-CBC-KIT',
                'item_name' => 'CBC reagent kit',
                'category' => InventoryItemCategory::LABORATORY->value,
                'subcategory' => 'hematology_reagent',
                'unit' => 'kit',
                'manufacturer' => 'Generic analyzer-compatible supplier',
                'storage_conditions' => '2-8C refrigerated',
                'codes' => ['LOCAL' => 'LAB-REAG-CBC-KIT', 'MSD' => 'MSD-TODO-CBC-REAG'],
            ],
            [
                'item_code' => 'LAB-REAG-URI-STRIP',
                'item_name' => 'Urinalysis reagent strips',
                'category' => InventoryItemCategory::LABORATORY->value,
                'subcategory' => 'urinalysis_reagent',
                'unit' => 'bottle',
                'manufacturer' => 'Generic diagnostics supplier',
                'storage_conditions' => 'Room temperature, dry',
                'codes' => ['LOCAL' => 'LAB-REAG-URI-STRIP', 'MSD' => 'MSD-TODO-URI-STRIP'],
            ],
            [
                'item_code' => 'LAB-REAG-GRAM-STAIN',
                'item_name' => 'Gram stain kit',
                'category' => InventoryItemCategory::LABORATORY->value,
                'subcategory' => 'microbiology_stain',
                'unit' => 'kit',
                'manufacturer' => 'Generic microbiology supplier',
                'storage_conditions' => 'Room temperature, protected from light',
                'codes' => ['LOCAL' => 'LAB-REAG-GRAM-STAIN', 'MSD' => 'MSD-TODO-GRAM-STAIN'],
            ],
            [
                'item_code' => 'LAB-QC-CALIBRATOR-MULTI',
                'item_name' => 'Multi-analyte calibrators',
                'category' => InventoryItemCategory::LABORATORY->value,
                'subcategory' => 'calibrator',
                'unit' => 'set',
                'manufacturer' => 'Generic diagnostics supplier',
                'storage_conditions' => '2-8C refrigerated',
                'codes' => ['LOCAL' => 'LAB-QC-CALIBRATOR-MULTI', 'MSD' => 'MSD-TODO-CALIBRATOR'],
            ],
            [
                'item_code' => 'LAB-QC-CONTROL-MULTI',
                'item_name' => 'Laboratory quality controls',
                'category' => InventoryItemCategory::LABORATORY->value,
                'subcategory' => 'quality_control',
                'unit' => 'set',
                'manufacturer' => 'Generic diagnostics supplier',
                'storage_conditions' => '2-8C refrigerated',
                'codes' => ['LOCAL' => 'LAB-QC-CONTROL-MULTI', 'MSD' => 'MSD-TODO-QC'],
            ],
            [
                'item_code' => 'CON-SAMPLE-TUBE-EDTA',
                'item_name' => 'Sample collection tubes EDTA',
                'category' => InventoryItemCategory::MEDICAL_CONSUMABLE->value,
                'subcategory' => 'sample_collection',
                'unit' => 'box',
                'manufacturer' => 'Generic consumables supplier',
                'storage_conditions' => 'Room temperature',
                'codes' => ['LOCAL' => 'CON-SAMPLE-TUBE-EDTA', 'MSD' => 'MSD-TODO-EDTA-TUBE'],
            ],
            [
                'item_code' => 'RAD-CONTRAST-IOHEXOL',
                'item_name' => 'Iohexol contrast media',
                'category' => InventoryItemCategory::RADIOLOGY->value,
                'subcategory' => 'contrast_media',
                'unit' => 'vial',
                'manufacturer' => 'Generic radiology supplier',
                'storage_conditions' => 'Room temperature',
                'codes' => ['LOCAL' => 'RAD-CONTRAST-IOHEXOL', 'MSD' => 'MSD-TODO-CONTRAST'],
            ],
            [
                'item_code' => 'PPE-GLOVE-EXAM-BOX',
                'item_name' => 'Examination gloves box',
                'category' => InventoryItemCategory::PPE->value,
                'subcategory' => 'gloves',
                'unit' => 'box',
                'manufacturer' => 'Generic PPE supplier',
                'storage_conditions' => 'Room temperature, dry',
                'codes' => ['LOCAL' => 'PPE-GLOVE-EXAM-BOX', 'MSD' => 'MSD-TODO-GLOVES'],
            ],
            [
                'item_code' => 'CON-SYRINGE-10ML',
                'item_name' => 'Syringes 10ml',
                'category' => InventoryItemCategory::MEDICAL_CONSUMABLE->value,
                'subcategory' => 'syringes',
                'unit' => 'box',
                'manufacturer' => 'Generic consumables supplier',
                'storage_conditions' => 'Room temperature, dry',
                'codes' => ['LOCAL' => 'CON-SYRINGE-10ML', 'MSD' => 'MSD-TODO-SYRINGE-10ML'],
            ],
            [
                'item_code' => 'CON-GAUZE-SURGICAL',
                'item_name' => 'Surgical gauze',
                'category' => InventoryItemCategory::MEDICAL_CONSUMABLE->value,
                'subcategory' => 'dressings',
                'unit' => 'pack',
                'manufacturer' => 'Generic consumables supplier',
                'storage_conditions' => 'Room temperature, dry',
                'codes' => ['LOCAL' => 'CON-GAUZE-SURGICAL', 'MSD' => 'MSD-TODO-GAUZE'],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function upsertInventoryItem(array $item): void
    {
        $attributes = [
            'id' => (string) Str::uuid(),
            'item_code' => $item['item_code'],
            'item_name' => $item['item_name'],
            'category' => $item['category'],
            'unit' => $item['unit'],
            'current_stock' => 0,
            'reorder_level' => 0,
            'status' => InventoryItemStatus::ACTIVE->value,
            'updated_at' => now(),
            'created_at' => now(),
        ];

        foreach (['subcategory', 'manufacturer', 'storage_conditions', 'codes'] as $field) {
            if (Schema::hasColumn('inventory_items', $field)) {
                $attributes[$field] = $field === 'codes' ? json_encode($item[$field], JSON_THROW_ON_ERROR) : $item[$field];
            }
        }

        if (Schema::hasColumn('inventory_items', 'clinical_catalog_item_id')) {
            $attributes['clinical_catalog_item_id'] = null;
        }

        $exists = DB::table('inventory_items')->where('item_code', $item['item_code'])->exists();
        if ($exists) {
            unset($attributes['id'], $attributes['created_at']);
        }

        DB::table('inventory_items')->updateOrInsert(['item_code' => $item['item_code']], $attributes);
    }

    private function ensureMedicineInventoryBridge(): void
    {
        if (! Schema::hasColumn('inventory_items', 'clinical_catalog_item_id')) {
            return;
        }

        $medicineCodes = [
            'MED-PARA-500TAB',
            'MED-AMOX-500CAP',
            'MED-IBU-400TAB',
            'MED-METF-500TAB',
            'MED-AMLO-5TAB',
        ];

        foreach ($medicineCodes as $medicineCode) {
            $catalogItemId = DB::table('platform_clinical_catalog_items')
                ->where('catalog_type', ClinicalCatalogType::FORMULARY_ITEM->value)
                ->where('code', $medicineCode)
                ->value('id');

            if (! is_string($catalogItemId) || $catalogItemId === '') {
                continue;
            }

            DB::table('inventory_items')
                ->where('item_code', $medicineCode)
                ->where('category', InventoryItemCategory::PHARMACEUTICAL->value)
                ->update([
                    'clinical_catalog_item_id' => $catalogItemId,
                    'updated_at' => now(),
                ]);
        }
    }
}
