<?php

namespace App\Modules\Admission\Domain\Services;

interface PatientLookupServiceInterface
{
    public function isActivePatient(string $patientId): bool;
}
