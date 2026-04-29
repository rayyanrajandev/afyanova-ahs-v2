<?php

use App\Models\User;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use App\Modules\Platform\Infrastructure\Models\FacilityResourceAuditLogModel;
use App\Modules\Platform\Infrastructure\Models\FacilityResourceModel;
use App\Modules\Platform\Infrastructure\Models\TenantModel;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(ValidateCsrfToken::class);
});

function makeFacilityResourceRegistryActor(array $permissions = []): User
{
    $user = User::factory()->create();

    foreach ($permissions as $permission) {
        $user->givePermissionTo($permission);
    }

    return $user;
}

/**
 * @return array{tenant: TenantModel, facility: FacilityModel}
 */
function makeFacilityResourceRegistryContext(string $tenantCode = 'TEN-RES', string $facilityCode = 'FAC-RES'): array
{
    $tenant = TenantModel::query()->create([
        'code' => strtoupper($tenantCode),
        'name' => 'Resource Tenant '.strtoupper($tenantCode),
        'country_code' => 'TZ',
        'status' => 'active',
    ]);

    $facility = FacilityModel::query()->create([
        'tenant_id' => $tenant->id,
        'code' => strtoupper($facilityCode),
        'name' => 'Resource Facility '.strtoupper($facilityCode),
        'facility_type' => 'hospital',
        'timezone' => 'Africa/Dar_es_Salaam',
        'status' => 'active',
    ]);

    return [
        'tenant' => $tenant,
        'facility' => $facility,
    ];
}

function seedFacilityResourceRecord(
    FacilityModel $facility,
    string $resourceType,
    string $code,
    array $overrides = []
): FacilityResourceModel {
    $defaults = [
        'tenant_id' => $facility->tenant_id,
        'facility_id' => $facility->id,
        'resource_type' => $resourceType,
        'code' => strtoupper($code),
        'name' => 'Resource '.strtoupper($code),
        'department_id' => null,
        'service_point_type' => $resourceType === 'service_point' ? 'triage' : null,
        'ward_name' => $resourceType === 'ward_bed' ? 'WARD-A' : null,
        'bed_number' => $resourceType === 'ward_bed' ? 'A-01' : null,
        'location' => 'Block A',
        'status' => 'active',
        'status_reason' => null,
        'notes' => 'Seeded for feature test',
    ];

    return FacilityResourceModel::query()->create(array_merge($defaults, $overrides));
}

it('requires authentication for facility resource registry endpoints', function (): void {
    $this->getJson('/api/v1/platform/admin/service-points')->assertUnauthorized();

    $this->postJson('/api/v1/platform/admin/service-points', [
        'code' => 'SP-AUTH-001',
        'name' => 'Unauthenticated Service Point',
    ])->assertUnauthorized();

    $this->getJson('/api/v1/platform/admin/ward-beds')->assertUnauthorized();
});

it('creates lists and shows service points when authorized', function (): void {
    $actor = makeFacilityResourceRegistryActor([
        'platform.resources.read',
        'platform.resources.manage-service-points',
    ]);

    $response = $this->actingAs($actor)
        ->postJson('/api/v1/platform/admin/service-points', [
            'code' => 'sp-reg-001',
            'name' => 'OPD Counter 1',
            'servicePointType' => 'opd',
            'location' => 'Ground Floor',
            'notes' => 'Primary registration desk',
        ])
        ->assertCreated()
        ->assertJsonPath('data.code', 'SP-REG-001')
        ->assertJsonPath('data.status', 'active');

    $resourceId = $response->json('data.id');

    $this->actingAs($actor)
        ->getJson('/api/v1/platform/admin/service-points?q=SP-REG-001')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.id', $resourceId);

    $this->actingAs($actor)
        ->getJson('/api/v1/platform/admin/service-points/'.$resourceId)
        ->assertOk()
        ->assertJsonPath('data.id', $resourceId)
        ->assertJsonPath('data.servicePointType', 'opd');

    expect(
        FacilityResourceAuditLogModel::query()
            ->where('facility_resource_id', $resourceId)
            ->where('action', 'facility-resource.created')
            ->exists()
    )->toBeTrue();
});

it('enforces service-point status rules and writes transition parity metadata', function (): void {
    $actor = makeFacilityResourceRegistryActor([
        'platform.resources.manage-service-points',
    ]);
    $context = makeFacilityResourceRegistryContext('TEN-SP-STS', 'FAC-SP-STS');
    $servicePoint = seedFacilityResourceRecord($context['facility'], 'service_point', 'SP-STS-001');

    $this->actingAs($actor)
        ->patchJson('/api/v1/platform/admin/service-points/'.$servicePoint->id.'/status', [
            'status' => 'inactive',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['reason']);

    $this->actingAs($actor)
        ->patchJson('/api/v1/platform/admin/service-points/'.$servicePoint->id.'/status', [
            'status' => 'inactive',
            'reason' => 'Scheduled maintenance closure',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'inactive')
        ->assertJsonPath('data.statusReason', 'Scheduled maintenance closure');

    $statusLog = FacilityResourceAuditLogModel::query()
        ->where('facility_resource_id', $servicePoint->id)
        ->where('action', 'facility-resource.status.updated')
        ->latest('created_at')
        ->first();

    expect($statusLog)->not->toBeNull();
    expect($statusLog?->metadata['transition']['from'] ?? null)->toBe('active');
    expect($statusLog?->metadata['transition']['to'] ?? null)->toBe('inactive');
    expect($statusLog?->metadata['reason_required'] ?? null)->toBeTrue();
    expect($statusLog?->metadata['reason_provided'] ?? null)->toBeTrue();
});

it('rejects lifecycle status fields on service-point detail update endpoint', function (): void {
    $actor = makeFacilityResourceRegistryActor([
        'platform.resources.manage-service-points',
    ]);
    $context = makeFacilityResourceRegistryContext('TEN-SP-UPD', 'FAC-SP-UPD');
    $servicePoint = seedFacilityResourceRecord($context['facility'], 'service_point', 'SP-UPD-001', [
        'name' => 'Original Service Point',
        'status' => 'active',
    ]);

    $this->actingAs($actor)
        ->patchJson('/api/v1/platform/admin/service-points/'.$servicePoint->id, [
            'name' => 'Should Not Persist',
            'status' => 'inactive',
            'reason' => 'Must use status endpoint',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['status']);

    $servicePoint->refresh();
    expect($servicePoint->name)->toBe('Original Service Point');
    expect($servicePoint->status)->toBe('active');
});

it('enforces ward-bed status rules and writes transition parity metadata', function (): void {
    $actor = makeFacilityResourceRegistryActor([
        'platform.resources.manage-ward-beds',
    ]);
    $context = makeFacilityResourceRegistryContext('TEN-WB-STS', 'FAC-WB-STS');
    $wardBed = seedFacilityResourceRecord($context['facility'], 'ward_bed', 'WB-STS-001', [
        'name' => 'Ward Bed A-01',
        'ward_name' => 'WARD-A',
        'bed_number' => 'A-01',
    ]);

    $this->actingAs($actor)
        ->patchJson('/api/v1/platform/admin/ward-beds/'.$wardBed->id.'/status', [
            'status' => 'inactive',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['reason']);

    $this->actingAs($actor)
        ->patchJson('/api/v1/platform/admin/ward-beds/'.$wardBed->id.'/status', [
            'status' => 'inactive',
            'reason' => 'Bed blocked for infection control',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'inactive')
        ->assertJsonPath('data.statusReason', 'Bed blocked for infection control');

    $statusLog = FacilityResourceAuditLogModel::query()
        ->where('facility_resource_id', $wardBed->id)
        ->where('action', 'facility-resource.status.updated')
        ->latest('created_at')
        ->first();

    expect($statusLog)->not->toBeNull();
    expect($statusLog?->metadata['transition']['from'] ?? null)->toBe('active');
    expect($statusLog?->metadata['transition']['to'] ?? null)->toBe('inactive');
    expect($statusLog?->metadata['reason_required'] ?? null)->toBeTrue();
    expect($statusLog?->metadata['reason_provided'] ?? null)->toBeTrue();
});

it('rejects lifecycle status fields on ward-bed detail update endpoint', function (): void {
    $actor = makeFacilityResourceRegistryActor([
        'platform.resources.manage-ward-beds',
    ]);
    $context = makeFacilityResourceRegistryContext('TEN-WB-UPD', 'FAC-WB-UPD');
    $wardBed = seedFacilityResourceRecord($context['facility'], 'ward_bed', 'WB-UPD-001', [
        'name' => 'Original Ward Bed',
        'ward_name' => 'WARD-B',
        'bed_number' => 'B-01',
        'status' => 'active',
    ]);

    $this->actingAs($actor)
        ->patchJson('/api/v1/platform/admin/ward-beds/'.$wardBed->id, [
            'name' => 'Should Not Persist',
            'status' => 'inactive',
            'reason' => 'Must use status endpoint',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['status']);

    $wardBed->refresh();
    expect($wardBed->name)->toBe('Original Ward Bed');
    expect($wardBed->status)->toBe('active');
});

it('lists and exports facility resource audit logs when authorized', function (): void {
    $actor = makeFacilityResourceRegistryActor([
        'platform.resources.view-audit-logs',
    ]);
    $context = makeFacilityResourceRegistryContext('TEN-RES-AUD', 'FAC-RES-AUD');
    $servicePoint = seedFacilityResourceRecord($context['facility'], 'service_point', 'SP-AUD-001');

    FacilityResourceAuditLogModel::query()->create([
        'facility_resource_id' => $servicePoint->id,
        'actor_id' => $actor->id,
        'action' => 'facility-resource.updated',
        'changes' => ['name' => ['before' => 'Resource SP-AUD-001', 'after' => 'Updated']],
        'metadata' => ['source' => 'feature-test'],
        'created_at' => now()->subMinute(),
    ]);

    FacilityResourceAuditLogModel::query()->create([
        'facility_resource_id' => $servicePoint->id,
        'actor_id' => $actor->id,
        'action' => 'facility-resource.status.updated',
        'changes' => ['status' => ['before' => 'active', 'after' => 'inactive']],
        'metadata' => ['source' => 'feature-test'],
        'created_at' => now(),
    ]);

    $this->actingAs($actor)
        ->getJson('/api/v1/platform/admin/service-points/'.$servicePoint->id.'/audit-logs?action=facility-resource.status.updated')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.action', 'facility-resource.status.updated');

    $response = $this->actingAs($actor)
        ->get('/api/v1/platform/admin/service-points/'.$servicePoint->id.'/audit-logs/export?action=facility-resource.status.updated')
        ->assertOk()
        ->assertHeader('X-Audit-CSV-Schema-Version', 'audit-log-csv.v1');

    $csv = $response->streamedContent();
    expect($csv)->toContain('facility-resource.status.updated');
    expect($csv)->not->toContain('facility-resource.updated');
});
