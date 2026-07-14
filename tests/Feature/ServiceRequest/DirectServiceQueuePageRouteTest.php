<?php

use App\Http\Middleware\EnsureFacilitySubscriptionEntitlement;
use App\Http\Middleware\EnsureMappedFacilitySubscriptionEntitlement;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * B5 of the patient flow redesign: /direct-service/queue is a new,
 * standalone route (not a swap) — /walk-in-service-requests keeps
 * rendering the legacy page, now marked "(Legacy)". Same route-pair shape
 * as AppointmentsIndexV2PageRouteTest.php's /appointments cutover coverage.
 */
it('renders the direct service queue v2 page at /direct-service/queue', function (): void {
    $user = makeUserWithRole(['service.requests.read']);

    $this->withoutMiddleware([
        EnsureMappedFacilitySubscriptionEntitlement::class,
        EnsureFacilitySubscriptionEntitlement::class,
    ]);

    $this->actingAs($user)
        ->get('/direct-service/queue')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('directService/Queue'));
});

it('forbids the direct service queue route without service.requests.read', function (): void {
    $user = makeUserWithRole([]);

    $this->withoutMiddleware([
        EnsureMappedFacilitySubscriptionEntitlement::class,
        EnsureFacilitySubscriptionEntitlement::class,
    ]);

    $this->actingAs($user)
        ->get('/direct-service/queue')
        ->assertForbidden();
});

it('keeps the legacy page reachable at /walk-in-service-requests, now marked legacy', function (): void {
    $user = makeUserWithRole(['service.requests.read']);

    $this->withoutMiddleware([
        EnsureMappedFacilitySubscriptionEntitlement::class,
        EnsureFacilitySubscriptionEntitlement::class,
    ]);

    $this->actingAs($user)
        ->get('/walk-in-service-requests')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('walk-in-service-requests/Index'));
});
