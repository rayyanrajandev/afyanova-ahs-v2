<?php

namespace Database\Seeders;

use App\Modules\Department\Infrastructure\Models\DepartmentModel;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use App\Modules\Platform\Infrastructure\Models\FacilityResourceModel;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;

class TheatreServicePointSeeder extends Seeder
{
    /**
     * @var array<int, array{
     *     code: string,
     *     name: string,
     *     servicePointType: string,
     *     location: string,
     *     departmentCode: string|null,
     *     notes: string
     * }>
     */
    private const THEATRE_SERVICE_POINT_BLUEPRINTS = [
        [
            'code' => 'THR-ROOM-01',
            'name' => 'Main Theatre 1',
            'servicePointType' => 'operating_theatre',
            'location' => 'Surgical Block, Level 2',
            'departmentCode' => null,
            'notes' => 'General operating theatre for elective and urgent surgery.',
        ],
        [
            'code' => 'THR-ROOM-02',
            'name' => 'Main Theatre 2',
            'servicePointType' => 'operating_theatre',
            'location' => 'Surgical Block, Level 2',
            'departmentCode' => null,
            'notes' => 'Second general operating theatre for scheduled and overflow cases.',
        ],
        [
            'code' => 'THR-EMR-01',
            'name' => 'Emergency Theatre',
            'servicePointType' => 'emergency_theatre',
            'location' => 'Emergency and Acute Care Wing',
            'departmentCode' => 'OPD',
            'notes' => 'Reserved for trauma, acute abdomen, and other emergency procedures.',
        ],
        [
            'code' => 'THR-OBS-01',
            'name' => 'Maternity Theatre',
            'servicePointType' => 'obstetric_theatre',
            'location' => 'Maternal Wing, Level 1',
            'departmentCode' => 'ANC',
            'notes' => 'Obstetric theatre for caesarean section and emergency maternity procedures.',
        ],
        [
            'code' => 'THR-SEP-01',
            'name' => 'Septic Theatre',
            'servicePointType' => 'operating_theatre',
            'location' => 'Surgical Block, Isolation Corridor',
            'departmentCode' => null,
            'notes' => 'Dedicated theatre room for contaminated and septic cases.',
        ],
        [
            'code' => 'THR-PRC-01',
            'name' => 'Minor Procedure Room 1',
            'servicePointType' => 'procedure_room',
            'location' => 'Procedure Suite, Ground Floor',
            'departmentCode' => 'OPD',
            'notes' => 'Procedure room for dressing, suturing, MVA, drainage, and other minor procedures.',
        ],
        [
            'code' => 'THR-PRC-02',
            'name' => 'Minor Procedure Room 2',
            'servicePointType' => 'procedure_room',
            'location' => 'Procedure Suite, Ground Floor',
            'departmentCode' => 'OPD',
            'notes' => 'Additional procedure room for overflow minor surgery and wound-care cases.',
        ],
        [
            'code' => 'THR-DRS-01',
            'name' => 'Dressing Room',
            'servicePointType' => 'dressing_room',
            'location' => 'Procedure Suite, Ground Floor',
            'departmentCode' => 'OPD',
            'notes' => 'Dedicated room for wound dressing, dressing review, minor wound care, and dispensary-linked procedure support.',
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
                departmentIdsByCode: DepartmentModel::query()
                    ->whereNull('facility_id')
                    ->where('status', 'active')
                    ->get(['id', 'code'])
                    ->mapWithKeys(
                        static fn (DepartmentModel $department): array => [
                            strtoupper(trim((string) $department->code)) => (string) $department->id,
                        ],
                    ),
            );

            $this->command?->warn(
                sprintf(
                    'No facilities found. Seeded %d global theatre service points.',
                    $seededCount,
                ),
            );

            return;
        }

        foreach ($facilities as $facility) {
            $departmentIdsByCode = DepartmentModel::query()
                ->where('facility_id', $facility->id)
                ->where('status', 'active')
                ->get(['id', 'code'])
                ->mapWithKeys(
                    static fn (DepartmentModel $department): array => [
                        strtoupper(trim((string) $department->code)) => (string) $department->id,
                    ],
                );

            $seededCount = $this->seedScope(
                tenantId: $facility->tenant_id ? (string) $facility->tenant_id : null,
                facilityId: (string) $facility->id,
                departmentIdsByCode: $departmentIdsByCode,
            );

            $facilityLabel = trim((string) ($facility->name ?: $facility->code ?: $facility->id));
            $this->command?->info(
                sprintf(
                    'Seeded %d theatre service points for %s.',
                    $seededCount,
                    $facilityLabel,
                ),
            );
        }
    }

    private function seedScope(
        ?string $tenantId,
        ?string $facilityId,
        Collection $departmentIdsByCode,
    ): int {
        $seededCount = 0;

        foreach (self::THEATRE_SERVICE_POINT_BLUEPRINTS as $blueprint) {
            FacilityResourceModel::query()->updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'facility_id' => $facilityId,
                    'resource_type' => 'service_point',
                    'code' => $blueprint['code'],
                ],
                [
                    'name' => $blueprint['name'],
                    'department_id' => $this->resolveDepartmentId(
                        departmentIdsByCode: $departmentIdsByCode,
                        departmentCode: $blueprint['departmentCode'],
                    ),
                    'service_point_type' => $blueprint['servicePointType'],
                    'ward_name' => null,
                    'bed_number' => null,
                    'location' => $blueprint['location'],
                    'status' => 'active',
                    'status_reason' => null,
                    'notes' => $blueprint['notes'],
                ],
            );

            $seededCount++;
        }

        return $seededCount;
    }

    private function resolveDepartmentId(Collection $departmentIdsByCode, ?string $departmentCode): ?string
    {
        $normalizedCode = strtoupper(trim((string) $departmentCode));
        if ($normalizedCode === '') {
            return null;
        }

        $departmentId = $departmentIdsByCode->get($normalizedCode);

        return is_string($departmentId) && $departmentId !== '' ? $departmentId : null;
    }
}
