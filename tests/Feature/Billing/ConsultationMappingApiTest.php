<?php

use App\Models\User;
use App\Http\Middleware\EnsureFacilitySubscriptionEntitlement;
use App\Http\Middleware\EnsureMappedFacilitySubscriptionEntitlement;
use App\Modules\Billing\Infrastructure\Models\BillingServiceCatalogItemModel;
use App\Modules\Billing\Infrastructure\Models\ConsultationMappingModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(EnsureFacilitySubscriptionEntitlement::class);
    $this->withoutMiddleware(EnsureMappedFacilitySubscriptionEntitlement::class);
});

function makeConsultationMappingUser(array $permissions = []): User
{
    $user = User::factory()->create();

    foreach ($permissions as $permission) {
        $user->givePermissionTo($permission);
    }

    return $user;
}

function makeConsultationMappingCatalogItem(string $serviceCode = 'CONSULT-CO-OPD'): BillingServiceCatalogItemModel
{
    return BillingServiceCatalogItemModel::query()->create([
        'service_code' => $serviceCode,
        'service_name' => 'Clinical Officer Consultation - OPD',
        'service_type' => 'consultation',
        'department' => 'Outpatient Department (OPD)',
        'unit' => 'visit',
        'base_price' => 12000,
        'currency_code' => 'TZS',
        'tax_rate_percent' => 0,
        'is_taxable' => false,
        'effective_from' => now()->subDay()->toDateTimeString(),
        'effective_to' => null,
        'description' => 'Consultation mapping test tariff',
        'metadata' => null,
        'status' => 'active',
        'status_reason' => null,
    ]);
}

it('creates lists updates and deletes a consultation mapping through loaded routes', function (): void {
    $user = makeConsultationMappingUser([
        'billing.consultation-mappings.read',
        'billing.consultation-mappings.manage',
    ]);
    $catalogItem = makeConsultationMappingCatalogItem();

    $mapping = $this->actingAs($user)
        ->postJson('/api/v1/consultation-mappings', [
            'billing_service_catalog_item_id' => $catalogItem->id,
            'clinician_tier' => 'CO',
            'department' => 'Outpatient Department (OPD)',
        ])
        ->assertCreated()
        ->assertJsonPath('data.clinician_tier', 'CO')
        ->assertJsonPath('data.department', 'Outpatient Department (OPD)')
        ->assertJsonPath('data.catalog_item.service_code', 'CONSULT-CO-OPD')
        ->json('data');

    $this->actingAs($user)
        ->getJson('/api/v1/consultation-mappings')
        ->assertOk()
        ->assertJsonPath('data.0.id', $mapping['id']);

    $otherCatalogItem = makeConsultationMappingCatalogItem('CONSULT-CO-OPD-2');

    $this->actingAs($user)
        ->patchJson("/api/v1/consultation-mappings/{$mapping['id']}", [
            'billing_service_catalog_item_id' => $otherCatalogItem->id,
        ])
        ->assertOk()
        ->assertJsonPath('data.catalog_item.service_code', 'CONSULT-CO-OPD-2')
        ->assertJsonPath('data.department', 'Outpatient Department (OPD)');

    $this->actingAs($user)
        ->deleteJson("/api/v1/consultation-mappings/{$mapping['id']}")
        ->assertOk();

    expect(ConsultationMappingModel::query()->find($mapping['id']))->toBeNull();
});

it('rejects a duplicate clinician tier and department mapping', function (): void {
    $user = makeConsultationMappingUser([
        'billing.consultation-mappings.read',
        'billing.consultation-mappings.manage',
    ]);
    $catalogItem = makeConsultationMappingCatalogItem();

    ConsultationMappingModel::query()->create([
        'billing_service_catalog_item_id' => $catalogItem->id,
        'clinician_tier' => 'CO',
        'department' => 'Outpatient Department (OPD)',
    ]);

    $this->actingAs($user)
        ->postJson('/api/v1/consultation-mappings', [
            'billing_service_catalog_item_id' => $catalogItem->id,
            'clinician_tier' => 'CO',
            'department' => 'Outpatient Department (OPD)',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['department']);
});

it('rejects an unknown clinician tier', function (): void {
    $user = makeConsultationMappingUser([
        'billing.consultation-mappings.read',
        'billing.consultation-mappings.manage',
    ]);
    $catalogItem = makeConsultationMappingCatalogItem();

    $this->actingAs($user)
        ->postJson('/api/v1/consultation-mappings', [
            'billing_service_catalog_item_id' => $catalogItem->id,
            'clinician_tier' => 'NURSE',
            'department' => 'Outpatient Department (OPD)',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['clinician_tier']);
});

it('denies consultation mapping reads and writes without permission', function (): void {
    $user = makeConsultationMappingUser();
    $catalogItem = makeConsultationMappingCatalogItem();

    $this->actingAs($user)
        ->getJson('/api/v1/consultation-mappings')
        ->assertForbidden();

    $this->actingAs($user)
        ->postJson('/api/v1/consultation-mappings', [
            'billing_service_catalog_item_id' => $catalogItem->id,
            'clinician_tier' => 'CO',
            'department' => 'Outpatient Department (OPD)',
        ])
        ->assertForbidden();
});
