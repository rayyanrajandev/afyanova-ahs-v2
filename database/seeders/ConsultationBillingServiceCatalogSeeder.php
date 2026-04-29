<?php

namespace Database\Seeders;

use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use Illuminate\Database\Seeder;

class ConsultationBillingServiceCatalogSeeder extends Seeder
{
    /**
     * @var array<int, array{serviceCode:string,serviceName:string,department:string|null,basePrice:float,description:string}>
     */
    private const TARIFF_BLUEPRINTS = [
        [
            'serviceCode' => 'CONSULTATION',
            'serviceName' => 'General Consultation',
            'department' => null,
            'basePrice' => 20000,
            'description' => 'Generic consultation fallback when clinician or department tariff is not available.',
        ],
        [
            'serviceCode' => 'CONSULT-OUTPATIENT',
            'serviceName' => 'Outpatient Consultation',
            'department' => 'Outpatient',
            'basePrice' => 25000,
            'description' => 'Department-level outpatient consultation fallback.',
        ],
        [
            'serviceCode' => 'CONSULT-GENERAL-OPD',
            'serviceName' => 'General OPD Consultation',
            'department' => 'General OPD',
            'basePrice' => 25000,
            'description' => 'Department-level general OPD consultation fallback.',
        ],
        [
            'serviceCode' => 'CONSULT-CO-OUTPATIENT',
            'serviceName' => 'Clinical Officer Outpatient Consultation',
            'department' => 'Outpatient',
            'basePrice' => 15000,
            'description' => 'Clinical Officer outpatient consultation tariff.',
        ],
        [
            'serviceCode' => 'CONSULT-CO-GENERAL-OPD',
            'serviceName' => 'Clinical Officer General OPD Consultation',
            'department' => 'General OPD',
            'basePrice' => 15000,
            'description' => 'Clinical Officer general OPD consultation tariff.',
        ],
        [
            'serviceCode' => 'CONSULT-AMO-OUTPATIENT',
            'serviceName' => 'Assistant Medical Officer Outpatient Consultation',
            'department' => 'Outpatient',
            'basePrice' => 20000,
            'description' => 'Assistant Medical Officer outpatient consultation tariff.',
        ],
        [
            'serviceCode' => 'CONSULT-AMO-GENERAL-OPD',
            'serviceName' => 'Assistant Medical Officer General OPD Consultation',
            'department' => 'General OPD',
            'basePrice' => 20000,
            'description' => 'Assistant Medical Officer general OPD consultation tariff.',
        ],
        [
            'serviceCode' => 'CONSULT-MD-OUTPATIENT',
            'serviceName' => 'Medical Doctor Outpatient Consultation',
            'department' => 'Outpatient',
            'basePrice' => 30000,
            'description' => 'Medical Doctor outpatient consultation tariff.',
        ],
        [
            'serviceCode' => 'CONSULT-MD-GENERAL-OPD',
            'serviceName' => 'Medical Doctor General OPD Consultation',
            'department' => 'General OPD',
            'basePrice' => 30000,
            'description' => 'Medical Doctor general OPD consultation tariff.',
        ],
        [
            'serviceCode' => 'CONSULT-SPECIALIST-OUTPATIENT',
            'serviceName' => 'Specialist Outpatient Consultation',
            'department' => 'Outpatient',
            'basePrice' => 50000,
            'description' => 'Specialist outpatient consultation fallback when specialty-specific pricing is not configured.',
        ],
        [
            'serviceCode' => 'CONSULT-SPECIALIST-GENERAL-OPD',
            'serviceName' => 'Specialist General OPD Consultation',
            'department' => 'General OPD',
            'basePrice' => 50000,
            'description' => 'Specialist general OPD consultation fallback when specialty-specific pricing is not configured.',
        ],
        [
            'serviceCode' => 'CONSULT-SPECIALIST-CARDIOLOGY',
            'serviceName' => 'Cardiology Specialist Consultation',
            'department' => 'Cardiology',
            'basePrice' => 65000,
            'description' => 'Cardiology specialist consultation tariff.',
        ],
        [
            'serviceCode' => 'CONSULT-SPECIALIST-GENERAL-SURGERY',
            'serviceName' => 'General Surgery Specialist Consultation',
            'department' => 'Surgery',
            'basePrice' => 70000,
            'description' => 'General surgery specialist consultation tariff.',
        ],
        [
            'serviceCode' => 'CONSULT-SPECIALIST-TZ-GEN-SURG',
            'serviceName' => 'General Surgery Specialist Consultation',
            'department' => 'Surgery',
            'basePrice' => 70000,
            'description' => 'General surgery specialist tariff matching the Tanzania demo specialty code.',
        ],
        [
            'serviceCode' => 'CONSULT-SPECIALIST-ANAESTHESIA',
            'serviceName' => 'Anaesthesia Specialist Consultation',
            'department' => 'Anaesthesia',
            'basePrice' => 60000,
            'description' => 'Anaesthesia specialist consultation tariff.',
        ],
        [
            'serviceCode' => 'CONSULT-SPECIALIST-TZ-ANESTH',
            'serviceName' => 'Anaesthesia Specialist Consultation',
            'department' => 'Anaesthesia',
            'basePrice' => 60000,
            'description' => 'Anaesthesia specialist tariff matching the Tanzania demo specialty code.',
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
                sprintf('No facilities found. Seeded %d global consultation billing tariffs.', $seededCount),
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
                sprintf('Seeded %d consultation billing tariffs for %s.', $seededCount, $facilityLabel),
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
                    'service_type' => 'consultation',
                    'department' => $blueprint['department'],
                    'unit' => 'visit',
                    'base_price' => $blueprint['basePrice'],
                    'currency_code' => 'TZS',
                    'tax_rate_percent' => 0,
                    'is_taxable' => false,
                    'effective_from' => null,
                    'effective_to' => null,
                    'description' => $blueprint['description'],
                    'metadata' => [
                        'pricingModel' => 'clinician_cadre_specialty_department',
                        'seededFor' => 'consultation_charge_capture_v1',
                    ],
                    'status' => 'active',
                    'status_reason' => null,
                ],
            );
        }

        return count(self::TARIFF_BLUEPRINTS);
    }
}
