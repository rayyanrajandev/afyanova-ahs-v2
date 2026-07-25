<?php

namespace Database\Seeders;

use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Billing\Infrastructure\Models\ConsultationMappingModel;
use App\Modules\Billing\Infrastructure\Models\PriceBookEntryModel;
use App\Modules\Platform\Infrastructure\Models\ChargeableItemModel;
use Illuminate\Database\Seeder;

/**
 * PricingEngine_Migration_Plan.md Phase 5: Consultation's legacy pricing
 * path is gone -- a mapping with no chargeable_item_id is unpriced, so
 * this seeder creates one instead of only linking the legacy tariff.
 */
class ConsultationMappingSeeder extends Seeder
{
    public function run(): void
    {
        $catalogItem = BillingServiceCatalogItemModel::where('service_code', 'CONSULT-OPD-001')->first();

        if (! $catalogItem) {
            return;
        }

        $chargeableItem = ChargeableItemModel::query()->firstWhere('code', $catalogItem->service_code);
        if ($chargeableItem === null) {
            $chargeableItem = new ChargeableItemModel();
            $chargeableItem->fill([
                'catalog_type' => 'consultation',
                'charge_model' => 'flat',
                'code' => $catalogItem->service_code,
                'name' => $catalogItem->service_name,
                'status' => 'active',
            ]);
            $chargeableItem->save();
        }

        if (! PriceBookEntryModel::query()->where('chargeable_item_id', $chargeableItem->id)->where('status', 'active')->exists()) {
            PriceBookEntryModel::query()->create([
                'chargeable_item_id' => $chargeableItem->id,
                'currency_code' => $catalogItem->currency_code,
                'unit_price' => $catalogItem->base_price,
                'status' => 'active',
            ]);
        }

        ConsultationMappingModel::updateOrCreate(
            [
                'clinician_tier' => 'CO',
                'department' => 'Outpatient Department (OPD)',
            ],
            [
                'billing_service_catalog_item_id' => $catalogItem->id,
                'chargeable_item_id' => $chargeableItem->id,
            ]
        );
    }
}
