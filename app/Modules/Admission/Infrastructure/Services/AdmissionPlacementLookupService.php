<?php

namespace App\Modules\Admission\Infrastructure\Services;

use App\Modules\Admission\Application\Exceptions\InvalidAdmissionPlacementException;
use App\Modules\Admission\Domain\Repositories\AdmissionRepositoryInterface;
use App\Modules\Admission\Domain\Services\AdmissionPlacementLookupServiceInterface;
use App\Modules\Platform\Domain\Repositories\FacilityResourceRepositoryInterface;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;

class AdmissionPlacementLookupService implements AdmissionPlacementLookupServiceInterface
{
    public function __construct(
        private readonly AdmissionRepositoryInterface $admissionRepository,
        private readonly FacilityResourceRepositoryInterface $facilityResourceRepository,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
    ) {}

    public function validatePlacement(
        ?string $ward,
        ?string $bed,
        string $wardField = 'ward',
        string $bedField = 'bed',
        ?string $excludeAdmissionId = null,
    ): array {
        $normalizedWard = $this->normalize($ward);
        $normalizedBed = $this->normalize($bed);

        if ($normalizedWard === null && $normalizedBed === null) {
            return [
                'ward' => null,
                'bed' => null,
            ];
        }

        $errors = [];

        if ($normalizedWard === null) {
            $errors[$wardField] = ['Ward is required when selecting a bed.'];
        }

        if ($normalizedBed === null) {
            $errors[$bedField] = ['Bed is required when selecting a ward.'];
        }

        if ($errors !== []) {
            throw new InvalidAdmissionPlacementException(
                'Ward and bed must be provided together.',
                $errors,
            );
        }

        $isValid = $this->facilityResourceRepository->activeWardBedExistsInScope(
            wardName: $normalizedWard,
            bedNumber: $normalizedBed,
            tenantId: $this->platformScopeContext->tenantId(),
            facilityId: $this->platformScopeContext->facilityId(),
        );

        if (! $isValid) {
            $message = 'Selected ward and bed do not match an active ward-bed in the facility registry.';

            throw new InvalidAdmissionPlacementException($message, [
                $wardField => [$message],
                $bedField => [$message],
            ]);
        }

        $hasConflict = $this->admissionRepository->hasActivePlacementConflict(
            ward: $normalizedWard,
            bed: $normalizedBed,
            tenantId: $this->platformScopeContext->tenantId(),
            facilityId: $this->platformScopeContext->facilityId(),
            excludeAdmissionId: $excludeAdmissionId,
        );

        if ($hasConflict) {
            $message = 'Selected ward and bed are already occupied by another active admission.';

            throw new InvalidAdmissionPlacementException($message, [
                $wardField => [$message],
                $bedField => [$message],
            ]);
        }

        return [
            'ward' => $normalizedWard,
            'bed' => $normalizedBed,
        ];
    }

    private function normalize(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }
}
