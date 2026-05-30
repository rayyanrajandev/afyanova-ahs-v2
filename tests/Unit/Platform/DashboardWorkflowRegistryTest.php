<?php

use App\Modules\Platform\Application\Services\DashboardWorkflowRegistry;
use App\Modules\Platform\Domain\ValueObjects\DashboardSessionContext;

it('prioritizes operations for credentialing officer role', function (): void {
    $registry = new DashboardWorkflowRegistry;

    $context = new DashboardSessionContext(
        roleCodesUpper: ['HOSPITAL.CREDENTIALING.OFFICER'],
        permissionNames: [
            'staff.read',
            'staff.credentialing.read',
            'specialties.read',
        ],
        isFacilitySuperAdmin: false,
        isPlatformSuperAdmin: false,
    );

    expect($registry->eligibleWorkflowKeys($context))->toContain('operations')
        ->and($registry->defaultWorkflowKey($context))->toBe('operations');
});

it('prioritizes records for medical records officer without clinical roles', function (): void {
    $registry = new DashboardWorkflowRegistry;

    $context = new DashboardSessionContext(
        roleCodesUpper: ['HOSPITAL.MEDICAL.RECORDS.OFFICER'],
        permissionNames: [
            'patients.read',
            'medical.records.read',
            'medical.records.archive',
        ],
        isFacilitySuperAdmin: false,
        isPlatformSuperAdmin: false,
    );

    expect($registry->eligibleWorkflowKeys($context))->toContain('records')
        ->and($registry->defaultWorkflowKey($context))->toBe('records');
});

it('does not add records workflow for nursing role with medical records read', function (): void {
    $registry = new DashboardWorkflowRegistry;

    $context = new DashboardSessionContext(
        roleCodesUpper: ['HOSPITAL.NURSING.USER'],
        permissionNames: [
            'medical.records.read',
            'inpatient.ward.read',
        ],
        isFacilitySuperAdmin: false,
        isPlatformSuperAdmin: false,
    );

    expect($registry->eligibleWorkflowKeys($context))->not->toContain('records')
        ->and($registry->eligibleWorkflowKeys($context))->toContain('nursing');
});

it('adds supply workflow from inventory procurement permission', function (): void {
    $registry = new DashboardWorkflowRegistry;

    $context = new DashboardSessionContext(
        roleCodesUpper: ['HOSPITAL.INVENTORY.STOREKEEPER'],
        permissionNames: ['inventory.procurement.read'],
        isFacilitySuperAdmin: false,
        isPlatformSuperAdmin: false,
    );

    expect($registry->eligibleWorkflowKeys($context))->toContain('supply')
        ->and($registry->defaultWorkflowKey($context))->toBe('supply');
});

it('filters workflows when facility subscription entitlements are missing', function (): void {
    $registry = new DashboardWorkflowRegistry;

    $keys = $registry->filterWorkflowKeysByFacilitySubscription(
        ['operations', 'supply', 'front_desk'],
        ['patients.search', 'appointments.scheduling'],
        false,
    );

    expect($keys)->toBe(['front_desk']);
});

it('includes permission-gated widgets in workflow definitions', function (): void {
    $registry = new DashboardWorkflowRegistry;

    $context = new DashboardSessionContext(
        roleCodesUpper: ['HOSPITAL.CREDENTIALING.OFFICER'],
        permissionNames: ['staff.read', 'staff.credentialing.read'],
        isFacilitySuperAdmin: false,
        isPlatformSuperAdmin: false,
    );

    $operations = collect($registry->eligibleWorkflowDefinitions($context))
        ->firstWhere('key', 'operations');

    expect($operations)->not->toBeNull()
        ->and($operations['widgets'])->not->toBeEmpty()
        ->and(collect($operations['widgets'])->pluck('id')->all())->toContain('credentialing');
});

it('prioritizes laboratory dashboard for lab user and excludes supply chain', function (): void {
    $registry = new DashboardWorkflowRegistry;

    $context = new DashboardSessionContext(
        roleCodesUpper: ['HOSPITAL.LABORATORY.USER'],
        permissionNames: [
            'laboratory.orders.read',
            'laboratory.orders.update-status',
            'inventory.procurement.read',
            'inventory.procurement.create-request',
        ],
        isFacilitySuperAdmin: false,
        isPlatformSuperAdmin: false,
    );

    expect($registry->eligibleWorkflowKeys($context))->toContain('direct_service')
        ->and($registry->eligibleWorkflowKeys($context))->not->toContain('supply')
        ->and($registry->defaultWorkflowKey($context))->toBe('direct_service');

    $directService = collect($registry->eligibleWorkflowDefinitions($context))
        ->firstWhere('key', 'direct_service');

    expect($directService)->not->toBeNull()
        ->and($directService['label'])->toBe('Laboratory');
});
