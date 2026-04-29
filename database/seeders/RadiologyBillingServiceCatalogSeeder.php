<?php

namespace Database\Seeders;

use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use Illuminate\Database\Seeder;

class RadiologyBillingServiceCatalogSeeder extends Seeder
{
    /**
     * @var array<int, array{
     *     serviceCode:string,
     *     serviceName:string,
     *     modality:string,
     *     basePrice:float,
     *     description:string
     * }>
     */
    private const TARIFF_BLUEPRINTS = [
        [
            'serviceCode' => 'RAD-CXR-001',
            'serviceName' => 'Chest X-Ray (PA)',
            'modality' => 'xray',
            'basePrice' => 30000,
            'description' => 'Standard outpatient chest radiograph tariff.',
        ],
        [
            'serviceCode' => 'RAD-CXR-002',
            'serviceName' => 'Chest X-Ray (AP Portable)',
            'modality' => 'xray',
            'basePrice' => 35000,
            'description' => 'Portable chest radiograph tariff.',
        ],
        [
            'serviceCode' => 'RAD-ABD-001',
            'serviceName' => 'Abdomen X-Ray (AP)',
            'modality' => 'xray',
            'basePrice' => 35000,
            'description' => 'Plain abdomen radiograph tariff.',
        ],
        [
            'serviceCode' => 'RAD-PEL-001',
            'serviceName' => 'Pelvis X-Ray (AP)',
            'modality' => 'xray',
            'basePrice' => 35000,
            'description' => 'Pelvic radiograph tariff.',
        ],
        [
            'serviceCode' => 'RAD-LSP-001',
            'serviceName' => 'Lumbar Spine X-Ray',
            'modality' => 'xray',
            'basePrice' => 40000,
            'description' => 'Lumbar spine radiograph tariff.',
        ],
        [
            'serviceCode' => 'RAD-USA-001',
            'serviceName' => 'Abdominal Ultrasound',
            'modality' => 'ultrasound',
            'basePrice' => 60000,
            'description' => 'General abdominal ultrasound tariff.',
        ],
        [
            'serviceCode' => 'RAD-USP-001',
            'serviceName' => 'Pelvic Ultrasound',
            'modality' => 'ultrasound',
            'basePrice' => 65000,
            'description' => 'Pelvic ultrasound tariff.',
        ],
        [
            'serviceCode' => 'RAD-OBS-001',
            'serviceName' => 'Obstetric Ultrasound',
            'modality' => 'ultrasound',
            'basePrice' => 70000,
            'description' => 'Routine obstetric ultrasound tariff.',
        ],
        [
            'serviceCode' => 'RAD-REN-001',
            'serviceName' => 'Renal Ultrasound',
            'modality' => 'ultrasound',
            'basePrice' => 65000,
            'description' => 'Renal ultrasound tariff.',
        ],
        [
            'serviceCode' => 'RAD-BRE-001',
            'serviceName' => 'Breast Ultrasound',
            'modality' => 'ultrasound',
            'basePrice' => 70000,
            'description' => 'Breast ultrasound tariff.',
        ],
        [
            'serviceCode' => 'RAD-CTH-001',
            'serviceName' => 'CT Head (Non-contrast)',
            'modality' => 'ct',
            'basePrice' => 180000,
            'description' => 'CT head non-contrast tariff.',
        ],
        [
            'serviceCode' => 'RAD-CTA-001',
            'serviceName' => 'CT Abdomen/Pelvis',
            'modality' => 'ct',
            'basePrice' => 260000,
            'description' => 'CT abdomen and pelvis tariff.',
        ],
        [
            'serviceCode' => 'RAD-CTC-001',
            'serviceName' => 'CT Chest',
            'modality' => 'ct',
            'basePrice' => 220000,
            'description' => 'CT chest tariff.',
        ],
        [
            'serviceCode' => 'RAD-MRB-001',
            'serviceName' => 'MRI Brain',
            'modality' => 'mri',
            'basePrice' => 400000,
            'description' => 'MRI brain tariff.',
        ],
        [
            'serviceCode' => 'RAD-MRS-001',
            'serviceName' => 'MRI Lumbar Spine',
            'modality' => 'mri',
            'basePrice' => 420000,
            'description' => 'MRI lumbar spine tariff.',
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
                sprintf('No facilities found. Seeded %d global radiology billing tariffs.', $seededCount),
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
                sprintf('Seeded %d radiology billing tariffs for %s.', $seededCount, $facilityLabel),
            );
        }
    }

    private function seedScope(?string $tenantId, ?string $facilityId): int
    {
        foreach (self::TARIFF_BLUEPRINTS as $blueprint) {
            BillingServiceCatalogItemModel::query()->updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'facility_id' => $facilityId,
                    'service_code' => $blueprint['serviceCode'],
                ],
                [
                    'service_name' => $blueprint['serviceName'],
                    'service_type' => 'radiology',
                    'department' => 'Radiology',
                    'unit' => 'study',
                    'base_price' => $blueprint['basePrice'],
                    'currency_code' => 'TZS',
                    'tax_rate_percent' => 0,
                    'is_taxable' => false,
                    'effective_from' => null,
                    'effective_to' => null,
                    'description' => $blueprint['description'],
                    'metadata' => [
                        'modality' => $blueprint['modality'],
                        'pricingModel' => 'radiology_procedure_code',
                        'seededFor' => 'radiology_charge_capture_v1',
                    ],
                    'status' => 'active',
                    'status_reason' => null,
                ],
            );
        }

        return count(self::TARIFF_BLUEPRINTS);
    }
}
