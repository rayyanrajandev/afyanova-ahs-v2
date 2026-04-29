<?php

namespace Database\Seeders;

use App\Modules\Department\Infrastructure\Models\DepartmentModel;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use App\Modules\Platform\Infrastructure\Models\FacilityResourceModel;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;

class WardBedRegistrySeeder extends Seeder
{
    /**
     * @var array<int, array{
     *     wardName: string,
     *     wardCode: string,
     *     bedCount: int,
     *     location: string,
     *     departmentCode: string|null,
     *     notes: string
     * }>
     */
    private const WARD_BLUEPRINTS = [
        [
            'wardName' => 'General Ward A',
            'wardCode' => 'GWA',
            'bedCount' => 6,
            'location' => 'Inpatient Block A, Level 2',
            'departmentCode' => null,
            'notes' => 'Adult inpatient beds',
        ],
        [
            'wardName' => 'General Ward B',
            'wardCode' => 'GWB',
            'bedCount' => 6,
            'location' => 'Inpatient Block B, Level 2',
            'departmentCode' => null,
            'notes' => 'Adult inpatient beds',
        ],
        [
            'wardName' => 'Pediatrics Ward',
            'wardCode' => 'PED',
            'bedCount' => 4,
            'location' => 'Children Wing, Level 1',
            'departmentCode' => 'PED',
            'notes' => 'Pediatric inpatient beds',
        ],
        [
            'wardName' => 'Maternity Ward',
            'wardCode' => 'MAT',
            'bedCount' => 4,
            'location' => 'Maternal Wing, Level 1',
            'departmentCode' => 'ANC',
            'notes' => 'Maternal inpatient beds',
        ],
        [
            'wardName' => 'Observation Unit',
            'wardCode' => 'OBS',
            'bedCount' => 3,
            'location' => 'Acute Care Unit, Ground Floor',
            'departmentCode' => 'OPD',
            'notes' => 'Short-stay observation beds',
        ],
        [
            'wardName' => 'Dental Recovery',
            'wardCode' => 'DEN',
            'bedCount' => 2,
            'location' => 'Dental Clinic Procedure Bay',
            'departmentCode' => 'DENT',
            'notes' => 'Procedure recovery beds',
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
                    'No facilities found. Seeded %d global ward/bed registry rows.',
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
                sprintf('Seeded %d ward/bed registry rows for %s.', $seededCount, $facilityLabel),
            );
        }
    }

    private function seedScope(
        ?string $tenantId,
        ?string $facilityId,
        Collection $departmentIdsByCode,
    ): int {
        $seededCount = 0;

        foreach (self::WARD_BLUEPRINTS as $blueprint) {
            $departmentId = $this->resolveDepartmentId(
                departmentIdsByCode: $departmentIdsByCode,
                departmentCode: $blueprint['departmentCode'],
            );

            for ($bedIndex = 1; $bedIndex <= $blueprint['bedCount']; $bedIndex++) {
                $bedNumber = sprintf('Bed %02d', $bedIndex);

                FacilityResourceModel::query()->updateOrCreate(
                    [
                        'tenant_id' => $tenantId,
                        'facility_id' => $facilityId,
                        'resource_type' => 'ward_bed',
                        'code' => sprintf('WB-%s-%02d', $blueprint['wardCode'], $bedIndex),
                    ],
                    [
                        'name' => sprintf('%s - %s', $blueprint['wardName'], $bedNumber),
                        'department_id' => $departmentId,
                        'service_point_type' => null,
                        'ward_name' => $blueprint['wardName'],
                        'bed_number' => $bedNumber,
                        'location' => $blueprint['location'],
                        'status' => 'active',
                        'status_reason' => null,
                        'notes' => $blueprint['notes'],
                    ],
                );

                $seededCount++;
            }
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
