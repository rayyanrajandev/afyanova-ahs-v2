<?php

namespace Database\Seeders;

use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use Database\Seeders\Support\BaselineDepartmentCatalog;
use Illuminate\Database\Seeder;

class BaselineDepartmentRegistrySeeder extends Seeder
{
    public function run(): void
    {
        $facilities = FacilityModel::query()
            ->orderBy('name')
            ->get(['id', 'tenant_id', 'code', 'name']);

        if ($facilities->isEmpty()) {
            BaselineDepartmentCatalog::seedForScope(
                tenantId: null,
                facilityId: null,
            );

            $this->command?->warn('No facilities found. Seeded global baseline departments.');

            return;
        }

        foreach ($facilities as $facility) {
            BaselineDepartmentCatalog::seedForScope(
                tenantId: $facility->tenant_id ? (string) $facility->tenant_id : null,
                facilityId: (string) $facility->id,
            );

            $facilityLabel = trim((string) ($facility->name ?: $facility->code ?: $facility->id));
            $this->command?->info(sprintf('Seeded baseline departments for %s.', $facilityLabel));
        }
    }
}
