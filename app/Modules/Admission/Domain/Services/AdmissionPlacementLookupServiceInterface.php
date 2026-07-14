<?php

namespace App\Modules\Admission\Domain\Services;

interface AdmissionPlacementLookupServiceInterface
{
    /**
     * @return array{ward:?string, bed:?string}
     */
    public function validatePlacement(
        ?string $ward,
        ?string $bed,
        string $wardField = 'ward',
        string $bedField = 'bed',
        ?string $excludeAdmissionId = null,
    ): array;

    /**
     * Real-FK counterpart to validatePlacement() — resolves ward/bed FROM
     * the linked facility_resources row rather than trusting client input,
     * so a caller can never persist a ward/bed pair that doesn't match the
     * bed it actually links to.
     *
     * @return array{bed_resource_id: string, ward: ?string, bed: ?string}
     */
    public function validatePlacementByResource(
        string $bedResourceId,
        string $fieldName = 'bedResourceId',
        ?string $excludeAdmissionId = null,
    ): array;
}
