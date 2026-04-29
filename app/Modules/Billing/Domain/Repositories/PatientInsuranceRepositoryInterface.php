<?php

namespace App\Modules\Billing\Domain\Repositories;

interface PatientInsuranceRepositoryInterface
{
    /**
     * Find active insurance for a patient
     */
    public function findActiveInsurance(string $patientId, string $tenantId): ?array;

    /**
     * Create patient insurance record
     */
    public function create(array $data): array;

    /**
     * Update patient insurance record
     */
    public function update(string $id, array $data): array;

    /**
     * Find all insurance records for a patient
     */
    public function findByPatientId(string $patientId): array;
}
