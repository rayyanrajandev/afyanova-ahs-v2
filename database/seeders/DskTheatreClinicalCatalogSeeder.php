<?php

namespace Database\Seeders;

use App\Modules\Department\Infrastructure\Models\DepartmentModel;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use Illuminate\Database\Seeder;

class DskTheatreClinicalCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $facility = FacilityModel::where('code', 'DSK')->first();

        if (!$facility) {
            $this->command?->error('DSK facility not found. Run InitialFacilitySeeder first.');
            return;
        }

        $deptId = DepartmentModel::where('facility_id', $facility->id)->where('code', 'OPD')->value('id');

        if (!$deptId) {
            $this->command?->error('OPD department not found for DSK. Run DskDepartmentsSeeder first.');
            return;
        }

        $items = [
            ['code' => 'THR-CIRCUMCISION-001', 'name' => 'Male circumcision', 'category' => 'minor', 'unit' => 'procedure', 'description' => 'Surgical removal of foreskin. Common procedure in Tanzania.'],
            ['code' => 'THR-LIPOMA-REMOVAL-001', 'name' => 'Lipoma / cyst excision', 'category' => 'minor', 'unit' => 'procedure', 'description' => 'Excision of subcutaneous lipoma or sebaceous cyst.'],
            ['code' => 'THR-MANUAL-PLACENTA-001', 'name' => 'Manual removal of retained placenta', 'category' => 'obstetric', 'unit' => 'procedure', 'description' => 'Manual removal of placenta when controlled cord traction fails.'],
            ['code' => 'THR-POSTPARTUM-DNC-001', 'name' => 'Manual vacuum evacuation (postpartum)', 'category' => 'obstetric', 'unit' => 'procedure', 'description' => 'Evacuation of retained products of conception after delivery.'],
            ['code' => 'THR-CHEST-DRAIN-001', 'name' => 'Chest tube insertion (intercostal drain)', 'category' => 'emergency', 'unit' => 'procedure', 'description' => 'Insertion of intercostal chest drain for pneumothorax or haemothorax.'],
            ['code' => 'THR-CRICOTHYROID-001', 'name' => 'Emergency cricothyroidotomy', 'category' => 'emergency', 'unit' => 'procedure', 'description' => 'Emergency surgical airway when intubation fails.'],
        ];

        foreach ($items as $item) {
            ClinicalCatalogItemModel::firstOrCreate(
                [
                    'facility_id' => $facility->id,
                    'catalog_type' => 'theatre_procedure',
                    'code' => $item['code'],
                ],
                [
                    'tenant_id' => $facility->tenant_id,
                    'name' => $item['name'],
                    'department_id' => $deptId,
                    'category' => $item['category'],
                    'unit' => $item['unit'],
                    'description' => $item['description'],
                    'status' => 'active',
                ],
            );
        }

        $this->command?->info('Seeded ' . count($items) . ' theatre procedure catalog items for DSK Dispensary.');
    }
}
