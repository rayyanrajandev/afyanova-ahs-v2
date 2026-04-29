<?php

namespace App\Modules\Patient\Application\UseCases;

use App\Modules\Patient\Domain\Repositories\PatientRepositoryInterface;
use App\Modules\Patient\Domain\ValueObjects\PatientStatus;

class ListPatientsUseCase
{
    public function __construct(private readonly PatientRepositoryInterface $patientRepository) {}

    public function execute(array $filters): array
    {
        $page = max((int) ($filters['page'] ?? 1), 1);
        $perPage = min(max((int) ($filters['perPage'] ?? 15), 1), 100);

        $status = $filters['status'] ?? null;
        if (! in_array($status, PatientStatus::values(), true)) {
            $status = null;
        }

        $gender = isset($filters['gender']) ? trim((string) $filters['gender']) : null;
        if (! in_array($gender, ['male', 'female', 'other', 'unknown'], true)) {
            $gender = null;
        }

        $region = isset($filters['region']) ? trim((string) $filters['region']) : null;
        $region = $region === '' ? null : $region;

        $district = isset($filters['district']) ? trim((string) $filters['district']) : null;
        $district = $district === '' ? null : $district;

        $sortMap = [
            'patientNumber' => 'patient_number',
            'firstName' => 'first_name',
            'lastName' => 'last_name',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
        ];

        $sortBy = $filters['sortBy'] ?? 'createdAt';
        $sortBy = $sortMap[$sortBy] ?? 'created_at';

        $sortDirection = strtolower((string) ($filters['sortDir'] ?? 'desc'));
        $sortDirection = $sortDirection === 'asc' ? 'asc' : 'desc';

        $query = isset($filters['q']) ? trim((string) $filters['q']) : null;
        $query = $query === '' ? null : $query;

        return $this->patientRepository->search(
            query: $query,
            status: $status,
            gender: $gender,
            region: $region,
            district: $district,
            page: $page,
            perPage: $perPage,
            sortBy: $sortBy,
            sortDirection: $sortDirection,
        );
    }
}

