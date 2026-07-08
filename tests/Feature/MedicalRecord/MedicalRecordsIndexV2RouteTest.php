<?php

use App\Http\Middleware\EnsureFacilitySubscriptionEntitlement;
use App\Http\Middleware\EnsureMappedFacilitySubscriptionEntitlement;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * The /medical-records/v2 route must be fully inert by default — confirming
 * the config-gate actually works, not just trusting the code reads correctly.
 * Same pattern as WorkspaceV2RouteTest / EncountersListRouteTest.
 */
it('404s on the medical records index v2 route when the flag is disabled (default)', function (): void {
    config(['frontend_rebuild.medical_records_index_v2_enabled' => false]);

    $user = makeUserWithRole(['medical.records.read']);

    $this->withoutMiddleware([
        EnsureMappedFacilitySubscriptionEntitlement::class,
        EnsureFacilitySubscriptionEntitlement::class,
    ]);

    $this->actingAs($user)
        ->get('/medical-records/v2')
        ->assertNotFound();
});

it('renders the medical records index v2 page when the flag is explicitly enabled', function (): void {
    config(['frontend_rebuild.medical_records_index_v2_enabled' => true]);

    $user = makeUserWithRole(['medical.records.read']);

    $this->withoutMiddleware([
        EnsureMappedFacilitySubscriptionEntitlement::class,
        EnsureFacilitySubscriptionEntitlement::class,
    ]);

    $this->actingAs($user)
        ->get('/medical-records/v2')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('medical-records/IndexV2'));
});
