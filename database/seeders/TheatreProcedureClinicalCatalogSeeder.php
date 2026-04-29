<?php

namespace Database\Seeders;

use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogItemStatus;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use Illuminate\Database\Seeder;

class TheatreProcedureClinicalCatalogSeeder extends Seeder
{
    /**
     * @var array<int, array{
     *     code: string,
     *     name: string,
     *     category: string,
     *     unit: string,
     *     specialty: string,
     *     anesthesiaType: string,
     *     approach: string,
     *     description: string
     * }>
     */
    private const THEATRE_PROCEDURE_BLUEPRINTS = [
        [
            'code' => 'THR-WDR-001',
            'name' => 'Wound Dressing',
            'category' => 'wound_care',
            'unit' => 'procedure',
            'specialty' => 'general_surgery',
            'anesthesiaType' => 'local_or_none',
            'approach' => 'bedside_or_procedure_room',
            'description' => 'Common wound-care procedure for dressing changes, clean wounds, and postoperative wound review.',
        ],
        [
            'code' => 'THR-SUT-001',
            'name' => 'Wound Suturing / Laceration Repair',
            'category' => 'minor_procedure',
            'unit' => 'procedure',
            'specialty' => 'general_surgery',
            'anesthesiaType' => 'local',
            'approach' => 'procedure_room',
            'description' => 'Minor procedure for traumatic laceration repair, wound closure, and emergency soft-tissue management.',
        ],
        [
            'code' => 'THR-IAD-001',
            'name' => 'Incision and Drainage',
            'category' => 'minor_procedure',
            'unit' => 'procedure',
            'specialty' => 'general_surgery',
            'anesthesiaType' => 'local_or_sedation',
            'approach' => 'open',
            'description' => 'Common minor surgical procedure for abscess drainage and infected collection decompression.',
        ],
        [
            'code' => 'THR-ABS-001',
            'name' => 'Abscess Drainage',
            'category' => 'minor_procedure',
            'unit' => 'procedure',
            'specialty' => 'general_surgery',
            'anesthesiaType' => 'local_or_sedation',
            'approach' => 'open',
            'description' => 'Procedure for localized abscess drainage in soft-tissue infection workflows.',
        ],
        [
            'code' => 'THR-BIO-001',
            'name' => 'Excision Biopsy',
            'category' => 'minor_procedure',
            'unit' => 'procedure',
            'specialty' => 'general_surgery',
            'anesthesiaType' => 'local_or_sedation',
            'approach' => 'open',
            'description' => 'Tissue excision procedure for histology, mass assessment, and suspicious lesion workup.',
        ],
        [
            'code' => 'THR-BRN-001',
            'name' => 'Burn Dressing and Debridement',
            'category' => 'wound_care',
            'unit' => 'procedure',
            'specialty' => 'general_surgery',
            'anesthesiaType' => 'sedation_or_general',
            'approach' => 'open',
            'description' => 'Burn care procedure for dressing, devitalized tissue removal, and wound-bed preparation.',
        ],
        [
            'code' => 'THR-MVA-001',
            'name' => 'Manual Vacuum Aspiration (MVA)',
            'category' => 'gynecology',
            'unit' => 'procedure',
            'specialty' => 'gynecology',
            'anesthesiaType' => 'local_or_sedation',
            'approach' => 'transcervical',
            'description' => 'Common Tanzania obstetric and gynecology procedure for uterine evacuation in incomplete abortion care.',
        ],
        [
            'code' => 'THR-MRP-001',
            'name' => 'Manual Removal of Placenta',
            'category' => 'obstetrics',
            'unit' => 'procedure',
            'specialty' => 'obstetrics',
            'anesthesiaType' => 'sedation_or_spinal',
            'approach' => 'transvaginal',
            'description' => 'Emergency obstetric procedure for retained placenta and postpartum complication management.',
        ],
        [
            'code' => 'THR-CHT-001',
            'name' => 'Chest Tube Insertion',
            'category' => 'emergency_procedure',
            'unit' => 'procedure',
            'specialty' => 'general_surgery',
            'anesthesiaType' => 'local_or_sedation',
            'approach' => 'tube_thoracostomy',
            'description' => 'Emergency procedure for pneumothorax, hemothorax, and pleural drainage support.',
        ],
        [
            'code' => 'THR-CIR-001',
            'name' => 'Circumcision',
            'category' => 'minor_procedure',
            'unit' => 'procedure',
            'specialty' => 'urology',
            'anesthesiaType' => 'local_or_general',
            'approach' => 'open',
            'description' => 'Common minor theatre and procedure-room case for pediatric and adult circumcision care.',
        ],
        [
            'code' => 'THR-FRC-001',
            'name' => 'Fracture Manipulation and Casting',
            'category' => 'orthopedics',
            'unit' => 'procedure',
            'specialty' => 'orthopedics',
            'anesthesiaType' => 'sedation_or_regional',
            'approach' => 'closed',
            'description' => 'Orthopedic reduction and casting procedure for closed fractures requiring immobilization.',
        ],
        [
            'code' => 'THR-TRP-001',
            'name' => 'Traction Pin Insertion',
            'category' => 'orthopedics',
            'unit' => 'procedure',
            'specialty' => 'orthopedics',
            'anesthesiaType' => 'local_or_regional',
            'approach' => 'percutaneous',
            'description' => 'Trauma and orthopedic stabilization procedure for femur and other traction-managed fractures.',
        ],
        [
            'code' => 'THR-HRN-001',
            'name' => 'Hernia Repair',
            'category' => 'general_surgery',
            'unit' => 'procedure',
            'specialty' => 'general_surgery',
            'anesthesiaType' => 'general_or_spinal',
            'approach' => 'open',
            'description' => 'Common hernia repair procedure for elective and urgent theatre scheduling.',
        ],
        [
            'code' => 'THR-APP-010',
            'name' => 'Appendectomy',
            'category' => 'general_surgery',
            'unit' => 'procedure',
            'specialty' => 'general_surgery',
            'anesthesiaType' => 'general',
            'approach' => 'open_or_laparoscopic',
            'description' => 'Appendix removal procedure used in acute abdominal and emergency theatre workflows.',
        ],
        [
            'code' => 'THR-CHL-004',
            'name' => 'Laparoscopic Cholecystectomy',
            'category' => 'general_surgery',
            'unit' => 'procedure',
            'specialty' => 'general_surgery',
            'anesthesiaType' => 'general',
            'approach' => 'laparoscopic',
            'description' => 'Gallbladder removal procedure commonly scheduled for biliary disease.',
        ],
        [
            'code' => 'THR-CES-001',
            'name' => 'Caesarean Section',
            'category' => 'obstetrics',
            'unit' => 'procedure',
            'specialty' => 'obstetrics',
            'anesthesiaType' => 'spinal_or_general',
            'approach' => 'open',
            'description' => 'Obstetric operative delivery procedure for emergency and elective theatre lists.',
        ],
        [
            'code' => 'THR-DNC-001',
            'name' => 'Dilatation and Curettage',
            'category' => 'gynecology',
            'unit' => 'procedure',
            'specialty' => 'gynecology',
            'anesthesiaType' => 'general_or_sedation',
            'approach' => 'transcervical',
            'description' => 'Gynecology procedure used for uterine evacuation and abnormal bleeding workup.',
        ],
        [
            'code' => 'THR-HYS-003',
            'name' => 'Abdominal Hysterectomy',
            'category' => 'gynecology',
            'unit' => 'procedure',
            'specialty' => 'gynecology',
            'anesthesiaType' => 'general_or_spinal',
            'approach' => 'open',
            'description' => 'Major gynecology procedure for fibroids, bleeding, and malignancy management.',
        ],
        [
            'code' => 'THR-MYO-002',
            'name' => 'Myomectomy',
            'category' => 'gynecology',
            'unit' => 'procedure',
            'specialty' => 'gynecology',
            'anesthesiaType' => 'general_or_spinal',
            'approach' => 'open_or_laparoscopic',
            'description' => 'Fibroid removal procedure for fertility-preserving gynecology care.',
        ],
        [
            'code' => 'THR-ORF-001',
            'name' => 'Open Reduction Internal Fixation',
            'category' => 'orthopedics',
            'unit' => 'procedure',
            'specialty' => 'orthopedics',
            'anesthesiaType' => 'general_or_regional',
            'approach' => 'open',
            'description' => 'Orthopedic fracture fixation procedure used in trauma and elective repair.',
        ],
        [
            'code' => 'THR-AMB-001',
            'name' => 'Limb Amputation',
            'category' => 'orthopedics',
            'unit' => 'procedure',
            'specialty' => 'orthopedics',
            'anesthesiaType' => 'general_or_regional',
            'approach' => 'open',
            'description' => 'Major limb amputation procedure for trauma, diabetic foot, and vascular compromise.',
        ],
        [
            'code' => 'THR-TON-001',
            'name' => 'Tonsillectomy',
            'category' => 'ent',
            'unit' => 'procedure',
            'specialty' => 'ent',
            'anesthesiaType' => 'general',
            'approach' => 'transoral',
            'description' => 'ENT theatre procedure for recurrent tonsillitis and airway-related indications.',
        ],
        [
            'code' => 'THR-TUB-001',
            'name' => 'Bilateral Tubal Ligation',
            'category' => 'gynecology',
            'unit' => 'procedure',
            'specialty' => 'gynecology',
            'anesthesiaType' => 'general_or_spinal',
            'approach' => 'open_or_laparoscopic',
            'description' => 'Permanent family-planning procedure for gynecology and postpartum theatre scheduling.',
        ],
        [
            'code' => 'THR-HYD-001',
            'name' => 'Hydrocelectomy',
            'category' => 'urology',
            'unit' => 'procedure',
            'specialty' => 'urology',
            'anesthesiaType' => 'general_or_spinal',
            'approach' => 'open',
            'description' => 'Common urology theatre procedure for hydrocele repair.',
        ],
        [
            'code' => 'THR-MAS-001',
            'name' => 'Mastectomy',
            'category' => 'breast_surgery',
            'unit' => 'procedure',
            'specialty' => 'general_surgery',
            'anesthesiaType' => 'general',
            'approach' => 'open',
            'description' => 'Breast surgery procedure for oncologic and advanced breast disease management.',
        ],
        [
            'code' => 'THR-LAP-002',
            'name' => 'Exploratory Laparotomy',
            'category' => 'general_surgery',
            'unit' => 'procedure',
            'specialty' => 'general_surgery',
            'anesthesiaType' => 'general',
            'approach' => 'open',
            'description' => 'Major exploratory abdominal procedure for trauma and acute surgical abdomen.',
        ],
        [
            'code' => 'THR-DEB-001',
            'name' => 'Surgical Wound Debridement',
            'category' => 'general_surgery',
            'unit' => 'procedure',
            'specialty' => 'general_surgery',
            'anesthesiaType' => 'general_or_sedation',
            'approach' => 'open',
            'description' => 'Debridement procedure for infected wounds, ulcers, and tissue viability management.',
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
                    'No facilities found. Seeded %d global theatre procedure catalog items.',
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
                    'Seeded %d theatre procedure catalog items for %s.',
                    $seededCount,
                    $facilityLabel,
                ),
            );
        }
    }

    private function seedScope(?string $tenantId, ?string $facilityId): int
    {
        $seededCount = 0;

        foreach (self::THEATRE_PROCEDURE_BLUEPRINTS as $blueprint) {
            ClinicalCatalogItemModel::query()->updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'facility_id' => $facilityId,
                    'catalog_type' => ClinicalCatalogType::THEATRE_PROCEDURE->value,
                    'code' => $blueprint['code'],
                ],
                [
                    'name' => $blueprint['name'],
                    'department_id' => null,
                    'category' => $blueprint['category'],
                    'unit' => $blueprint['unit'],
                    'description' => $blueprint['description'],
                    'metadata' => [
                        'specialty' => $blueprint['specialty'],
                        'anesthesiaType' => $blueprint['anesthesiaType'],
                        'approach' => $blueprint['approach'],
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
