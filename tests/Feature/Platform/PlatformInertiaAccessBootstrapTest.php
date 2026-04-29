<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

it('shares auth permissions and platform bootstrap scope in inertia payload', function (): void {
    $user = User::factory()->create([
        'email_verified_at' => now(),
    ]);
    $user->givePermissionTo('patients.read');

    seedInertiaScopeAssignment(
        userId: $user->id,
        tenantCode: 'TZH',
        tenantName: 'Tanzania Health Network',
        countryCode: 'TZ',
        facilityCode: 'DAR-MAIN',
        facilityName: 'Dar Main Hospital',
    );

    $this->actingAs($user)
        ->get('/patients')
        ->assertInertia(fn (Assert $page) => $page
            ->component('patients/Index')
            ->has('auth.permissions')
            ->where('auth.permissions.0', 'patients.read')
            ->where('platform.scope.resolvedFrom', 'single_assignment')
            ->where('platform.scope.tenant.code', 'TZH')
            ->where('platform.scope.facility.code', 'DAR-MAIN')
            ->where('platform.featureFlags.multiTenantIsolation', false)
            ->where('platform.featureFlags.multiFacilityScoping', false));
});

/**
 * @return array{0:string,1:string}
 */
function seedInertiaScopeAssignment(
    int $userId,
    string $tenantCode,
    string $tenantName,
    string $countryCode,
    string $facilityCode,
    string $facilityName,
): array {
    [$tenantId, $facilityId] = seedInertiaTenantAndFacility(
        tenantCode: $tenantCode,
        tenantName: $tenantName,
        countryCode: $countryCode,
        facilityCode: $facilityCode,
        facilityName: $facilityName,
    );

    DB::table('facility_user')->insert([
        'facility_id' => $facilityId,
        'user_id' => $userId,
        'role' => 'clinician',
        'is_primary' => true,
        'is_active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    return [$tenantId, $facilityId];
}

/**
 * @return array{0:string,1:string}
 */
function seedInertiaTenantAndFacility(
    string $tenantCode,
    string $tenantName,
    string $countryCode,
    string $facilityCode,
    string $facilityName,
): array {
    $tenantId = (string) Str::uuid();
    DB::table('tenants')->insert([
        'id' => $tenantId,
        'code' => $tenantCode,
        'name' => $tenantName,
        'country_code' => $countryCode,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $facilityId = (string) Str::uuid();
    DB::table('facilities')->insert([
        'id' => $facilityId,
        'tenant_id' => $tenantId,
        'code' => $facilityCode,
        'name' => $facilityName,
        'facility_type' => 'hospital',
        'timezone' => 'Africa/Dar_es_Salaam',
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    return [$tenantId, $facilityId];
}
