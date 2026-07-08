<?php

use App\Http\Middleware\EnsureFacilitySubscriptionEntitlement;
use App\Http\Middleware\EnsureMappedFacilitySubscriptionEntitlement;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Phase 6 (slice 1) of reports/patient-arrival-checkin-modernization-plan.md:
 * a new, standalone page with no predecessor, matching encounters/List.vue's
 * precedent — no config gate or legacy fallback applies.
 */
it('renders the reception queue page', function (): void {
    $user = makeUserWithRole(['appointments.read']);

    $this->withoutMiddleware([
        EnsureMappedFacilitySubscriptionEntitlement::class,
        EnsureFacilitySubscriptionEntitlement::class,
    ]);

    $this->actingAs($user)
        ->get('/reception/queue')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('reception/Queue'));
});

it('forbids the reception queue route without appointments.read', function (): void {
    $user = makeUserWithRole([]);

    $this->withoutMiddleware([
        EnsureMappedFacilitySubscriptionEntitlement::class,
        EnsureFacilitySubscriptionEntitlement::class,
    ]);

    $this->actingAs($user)
        ->get('/reception/queue')
        ->assertForbidden();
});
