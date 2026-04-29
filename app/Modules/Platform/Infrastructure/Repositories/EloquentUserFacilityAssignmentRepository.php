<?php

namespace App\Modules\Platform\Infrastructure\Repositories;

use App\Modules\Platform\Domain\Repositories\UserFacilityAssignmentRepositoryInterface;
use Illuminate\Support\Facades\DB;

class EloquentUserFacilityAssignmentRepository implements UserFacilityAssignmentRepositoryInterface
{
    public function listActiveFacilityScopesByUserId(int $userId): array
    {
        return DB::table('facility_user')
            ->join('facilities', 'facilities.id', '=', 'facility_user.facility_id')
            ->join('tenants', 'tenants.id', '=', 'facilities.tenant_id')
            ->where('facility_user.user_id', $userId)
            ->where('facility_user.is_active', true)
            ->where('facilities.status', 'active')
            ->where('tenants.status', 'active')
            ->orderByDesc('facility_user.is_primary')
            ->orderBy('tenants.code')
            ->orderBy('facilities.code')
            ->get([
                'facility_user.user_id',
                'facility_user.is_primary',
                'facility_user.role as assignment_role',
                'tenants.id as tenant_id',
                'tenants.code as tenant_code',
                'tenants.name as tenant_name',
                'tenants.country_code as tenant_country_code',
                'facilities.id as facility_id',
                'facilities.code as facility_code',
                'facilities.name as facility_name',
                'facilities.facility_type',
                'facilities.timezone as facility_timezone',
            ])
            ->map(static fn ($row): array => (array) $row)
            ->all();
    }
}
