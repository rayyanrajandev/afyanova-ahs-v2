<?php

use App\Http\Middleware\EnsureFacilitySubscriptionEntitlement;
use App\Http\Middleware\EnsureMappedFacilitySubscriptionEntitlement;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Phase 0 of reports/patients-index-modernization-plan.md: an unlinked
 * route reachable only at /patients/v2 during construction — /patients
 * keeps rendering the legacy page until Phase 6's explicit cutover.
 */
it('renders the patients index v2 page', function (): void {
    $user = makeUserWithRole(['patients.read']);

    $this->withoutMiddleware([
        EnsureMappedFacilitySubscriptionEntitlement::class,
        EnsureFacilitySubscriptionEntitlement::class,
    ]);

    $this->actingAs($user)
        ->get('/patients/v2')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('patients/IndexV2'));
});

it('forbids the patients index v2 route without patients.read', function (): void {
    $user = makeUserWithRole([]);

    $this->withoutMiddleware([
        EnsureMappedFacilitySubscriptionEntitlement::class,
        EnsureFacilitySubscriptionEntitlement::class,
    ]);

    $this->actingAs($user)
        ->get('/patients/v2')
        ->assertForbidden();
});

it('leaves the legacy /patients route rendering the legacy page', function (): void {
    $user = makeUserWithRole(['patients.read']);

    $this->withoutMiddleware([
        EnsureMappedFacilitySubscriptionEntitlement::class,
        EnsureFacilitySubscriptionEntitlement::class,
    ]);

    $this->actingAs($user)
        ->get('/patients')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('patients/Index'));
});
