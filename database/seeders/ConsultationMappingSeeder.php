<?php

namespace Database\Seeders;

use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Billing\Infrastructure\Models\ConsultationMappingModel;
use Illuminate\Database\Seeder;

class ConsultationMappingSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Find the catalog item for our OPD consultation
        $catalogItem = BillingServiceCatalogItemModel::where('service_code', 'CONSULT-OPD-001')->first();

        if ($catalogItem) {
            // 2. Create or update the mapping record
            ConsultationMappingModel::updateOrCreate(
                [
                    'clinician_tier' => 'CO',
                    'department' => 'Outpatient Department (OPD)',
                ],
                [
                    'billing_service_catalog_item_id' => $catalogItem->id,
                ]
            );
        }
    }
}
