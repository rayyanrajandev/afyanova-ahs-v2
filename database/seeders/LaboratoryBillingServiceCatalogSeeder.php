<?php

namespace Database\Seeders;

use App\Modules\Billing\Domain\ValueObjects\BillingServiceCatalogItemStatus;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class LaboratoryBillingServiceCatalogSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->labTariffs() as $tariff) {
            $catalogItem = DB::table('platform_clinical_catalog_items')
                ->where('catalog_type', ClinicalCatalogType::LAB_TEST->value)
                ->where('code', $tariff['catalog_code'])
                ->first();

            if ($catalogItem === null) {
                continue;
            }

            $this->upsertTariff($catalogItem, $tariff);
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function labTariffs(): array
    {
        return [
            ['catalog_code' => 'LAB-CBC-001', 'base_price' => 12000, 'nhif' => 'NHIF-TODO-CBC'],
            ['catalog_code' => 'LAB-UA-001', 'base_price' => 5000, 'nhif' => 'NHIF-TODO-URINALYSIS'],
            ['catalog_code' => 'LAB-MPS-001', 'base_price' => 8000, 'nhif' => 'NHIF-TODO-MALARIA-BS'],
            ['catalog_code' => 'LAB-BG-001', 'base_price' => 4000, 'nhif' => 'NHIF-TODO-RBS'],
            ['catalog_code' => 'LAB-CREA-001', 'base_price' => 10000, 'nhif' => 'NHIF-TODO-CREATININE'],
            ['catalog_code' => 'LAB-LFT-001', 'base_price' => 25000, 'nhif' => 'NHIF-TODO-LFT'],
            ['catalog_code' => 'LAB-HIV-001', 'base_price' => 10000, 'nhif' => 'NHIF-TODO-HIV-RDT'],
            ['catalog_code' => 'LAB-HBSAG-001', 'base_price' => 12000, 'nhif' => 'NHIF-TODO-HBSAG'],
        ];
    }

    /**
     * @param  object  $catalogItem
     * @param  array<string, mixed>  $tariff
     */
    private function upsertTariff(object $catalogItem, array $tariff): void
    {
        // TODO: confirm NHIF code
        $codes = [
            'LOCAL' => $catalogItem->code,
            'NHIF' => $tariff['nhif'],
        ];

        $attributes = [
            'id' => (string) Str::uuid(),
            'tenant_id' => $catalogItem->tenant_id ?? null,
            'facility_id' => $catalogItem->facility_id ?? null,
            'service_code' => $catalogItem->code,
            'service_name' => $catalogItem->name,
            'service_type' => 'laboratory',
            'department_id' => $catalogItem->department_id ?? null,
            'department' => 'Laboratory',
            'unit' => $catalogItem->unit ?: 'test',
            'base_price' => $tariff['base_price'],
            'currency_code' => 'TZS',
            'tax_rate_percent' => 0,
            'is_taxable' => false,
            'metadata' => json_encode(['standardsNote' => 'NHIF placeholder pending facility tariff confirmation'], JSON_THROW_ON_ERROR),
            'status' => BillingServiceCatalogItemStatus::ACTIVE->value,
            'updated_at' => now(),
            'created_at' => now(),
        ];

        if (Schema::hasColumn('billing_service_catalog_items', 'clinical_catalog_item_id')) {
            $attributes['clinical_catalog_item_id'] = $catalogItem->id;
        }

        if (Schema::hasColumn('billing_service_catalog_items', 'codes')) {
            $attributes['codes'] = json_encode($codes, JSON_THROW_ON_ERROR);
        }

        if (Schema::hasColumn('billing_service_catalog_items', 'tariff_version')) {
            $attributes['tariff_version'] = 1;
        }

        $identity = [
            'tenant_id' => $catalogItem->tenant_id ?? null,
            'facility_id' => $catalogItem->facility_id ?? null,
            'service_code' => $catalogItem->code,
        ];

        $exists = DB::table('billing_service_catalog_items')
            ->where('service_code', $catalogItem->code)
            ->where('tenant_id', $catalogItem->tenant_id ?? null)
            ->where('facility_id', $catalogItem->facility_id ?? null)
            ->exists();
        if ($exists) {
            unset($attributes['id'], $attributes['created_at']);
        }

        DB::table('billing_service_catalog_items')->updateOrInsert($identity, $attributes);
    }
}
