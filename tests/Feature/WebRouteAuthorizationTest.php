<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

function makeVerifiedWebUser(array $permissions = []): User
{
    $user = User::factory()->create([
        'email_verified_at' => now(),
    ]);

    foreach ($permissions as $permission) {
        $user->givePermissionTo($permission);
    }

    return $user;
}

it('forbids staff credentialing page without staff credentialing read permission', function (): void {
    $user = makeVerifiedWebUser(['staff.read']);

    $this->actingAs($user)
        ->get('/staff-credentialing')
        ->assertForbidden();
});

it('forbids platform rbac page without platform rbac read permission', function (): void {
    $user = makeVerifiedWebUser(['platform.users.read']);

    $this->actingAs($user)
        ->get('/platform/admin/roles')
        ->assertForbidden();
});

it('allows the staff directory when the user has staff read permission', function (): void {
    $user = makeVerifiedWebUser(['staff.read']);

    $this->actingAs($user)
        ->get('/staff')
        ->assertInertia(fn (Assert $page) => $page->component('staff/Index'));
});

it('allows the platform users page when the user has platform users read permission', function (): void {
    $user = makeVerifiedWebUser(['platform.users.read']);

    $this->actingAs($user)
        ->get('/platform/admin/users')
        ->assertInertia(fn (Assert $page) => $page->component('platform/admin/users/Index'));
});
