<?php

namespace App\Modules\Patient\Application\UseCases;

use App\Modules\Patient\Domain\Repositories\PatientAuditLogRepositoryInterface;
use App\Modules\Patient\Domain\Repositories\PatientRepositoryInterface;
use App\Modules\Patient\Domain\ValueObjects\PatientStatus;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use Illuminate\Support\Str;
use RuntimeException;

class CreatePatientUseCase
{
    public function __construct(
        private readonly PatientRepositoryInterface $patientRepository,
        private readonly PatientAuditLogRepositoryInterface $auditLogRepository,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    public function execute(array $payload, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $payload['status'] = PatientStatus::ACTIVE->value;
        $payload['patient_number'] = $this->generatePatientNumber();
        $payload['tenant_id'] = $this->platformScopeContext->tenantId();

        $createdPatient = $this->patientRepository->create($payload);
        $warnings = $this->buildDuplicateWarnings($createdPatient, (string) $createdPatient['id']);

        $this->auditLogRepository->write(
            patientId: $createdPatient['id'],
            action: 'patient.created',
            actorId: $actorId,
            changes: [
                'after' => $this->extractIdentity($createdPatient),
            ],
        );

        return [
            'patient' => $createdPatient,
            'warnings' => $warnings,
        ];
    }

    private function generatePatientNumber(): string
    {
        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $candidate = 'PT'.now()->format('Ymd').strtoupper(Str::random(6));

            if (! $this->patientRepository->existsByPatientNumber($candidate)) {
                return $candidate;
            }
        }

        throw new RuntimeException('Unable to generate unique patient number.');
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
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildDuplicateWarnings(array $patient, ?string $excludePatientId): array
    {
        $identity = $this->extractIdentity($patient);

        if (
            empty($identity['first_name']) ||
            empty($identity['last_name']) ||
            empty($identity['date_of_birth']) ||
            empty($identity['phone'])
        ) {
            return [];
        }

        $duplicates = $this->patientRepository->findActiveDuplicates(
            firstName: (string) $identity['first_name'],
            lastName: (string) $identity['last_name'],
            dateOfBirth: (string) $identity['date_of_birth'],
            phone: (string) $identity['phone'],
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
}
