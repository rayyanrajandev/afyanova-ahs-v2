<?php

namespace App\Modules\Patient\Application\UseCases;

use App\Modules\Patient\Domain\Repositories\PatientAuditLogRepositoryInterface;
use App\Modules\Patient\Domain\Repositories\PatientRepositoryInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;

class UpdatePatientUseCase
{
    public function __construct(
        private readonly PatientRepositoryInterface $patientRepository,
        private readonly PatientAuditLogRepositoryInterface $auditLogRepository,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    public function execute(string $id, array $payload, ?int $actorId = null): ?array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $before = $this->patientRepository->findById($id);
        if (! $before) {
            return null;
        }

        $updated = $this->patientRepository->update($id, $payload);
        if (! $updated) {
            return null;
        }

        $warnings = $this->buildDuplicateWarnings($updated, $id);

        $changes = $this->extractChanges($before, $updated);
        if ($changes !== []) {
            $this->auditLogRepository->write(
                patientId: $id,
                action: 'patient.updated',
                actorId: $actorId,
                changes: $changes,
            );
        }

        return [
            'patient' => $updated,
            'warnings' => $warnings,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function extractIdentity(array $patient): array
    {
        return [
            'first_name' => $patient['first_name'] ?? null,
            'last_name' => $patient['last_name'] ?? null,
            'date_of_birth' => $patient['date_of_birth'] ?? null,
            'phone' => $patient['phone'] ?? null,
            'national_id' => $patient['national_id'] ?? null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function extractChanges(array $before, array $after): array
    {
        $trackedFields = [
            'first_name',
            'middle_name',
            'last_name',
            'gender',
            'date_of_birth',
            'phone',
            'email',
            'national_id',
            'country_code',
            'region',
            'district',
            'address_line',
            'next_of_kin_name',
            'next_of_kin_phone',
            'status',
            'status_reason',
        ];

        $changes = [];

        foreach ($trackedFields as $field) {
            $beforeValue = $before[$field] ?? null;
            $afterValue = $after[$field] ?? null;

            if ($beforeValue === $afterValue) {
                continue;
            }

            $changes[$field] = [
                'before' => $beforeValue,
                'after' => $afterValue,
            ];
        }

        return $changes;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildDuplicateWarnings(array $patient, ?string $excludePatientId): array
    {
        $identity = $this->extractIdentity($patient);

        if ($this->hasNoDuplicateSearchKey($identity)) {
            return [];
        }

        $duplicates = $this->patientRepository->findActiveDuplicates(
            firstName: $this->nullableString($identity['first_name'] ?? null),
            lastName: $this->nullableString($identity['last_name'] ?? null),
            dateOfBirth: $this->nullableString($identity['date_of_birth'] ?? null),
            phone: $this->nullableString($identity['phone'] ?? null),
            nationalId: $this->nullableString($identity['national_id'] ?? null),
            excludePatientId: $excludePatientId,
        );

        if ($duplicates === []) {
            return [];
        }

        return [[
            'code' => 'POTENTIAL_DUPLICATE_PATIENT',
            'message' => 'Potential duplicate active patient records found.',
            'matches' => array_map(
                static fn (array $duplicate): array => [
                    'id' => $duplicate['id'] ?? null,
                    'patientNumber' => $duplicate['patient_number'] ?? null,
                    'firstName' => $duplicate['first_name'] ?? null,
                    'lastName' => $duplicate['last_name'] ?? null,
                    'dateOfBirth' => $duplicate['date_of_birth'] ?? null,
                    'phone' => $duplicate['phone'] ?? null,
                ],
                $duplicates,
            ),
        ]];
    }

    /**
     * @param  array<string, mixed>  $identity
     */
    private function hasNoDuplicateSearchKey(array $identity): bool
    {
        if ($this->nullableString($identity['national_id'] ?? null) !== null) {
            return false;
        }

        return $this->nullableString($identity['first_name'] ?? null) === null
            || $this->nullableString($identity['last_name'] ?? null) === null
            || $this->nullableString($identity['date_of_birth'] ?? null) === null
            || $this->nullableString($identity['phone'] ?? null) === null;
    }

    private function nullableString(mixed $value): ?string
    {
        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }
}
