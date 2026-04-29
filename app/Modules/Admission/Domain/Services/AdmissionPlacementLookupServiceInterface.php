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
}
