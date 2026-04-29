<?php

namespace App\Modules\Admission\Infrastructure\Services;

use App\Modules\Admission\Domain\Services\PatientLookupServiceInterface;
use App\Modules\Patient\Domain\Repositories\PatientRepositoryInterface;

class PatientLookupService implements PatientLookupServiceInterface
{
    public function __construct(private readonly PatientRepositoryInterface $patientRepository) {}

    public function isActivePatient(string $patientId): bool
    {
        $patient = $this->patientRepository->findById($patientId);

        return $patient !== null && ($patient['status'] ?? null) === 'active';
    }
}
