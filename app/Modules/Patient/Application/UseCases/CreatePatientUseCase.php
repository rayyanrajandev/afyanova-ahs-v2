<?php

namespace App\Modules\Patient\Application\UseCases;

use App\Modules\Patient\Application\Exceptions\DuplicatePatientException;
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

    public function execute(array $payload, ?int $actorId = null, bool $bypassDuplicateCheck = false): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        // Duplicate guard — runs BEFORE any write so no phantom record is created.
        if (! $bypassDuplicateCheck) {
            $this->assertNoDuplicates($payload);
        }

        $payload['status'] = PatientStatus::ACTIVE->value;
        $payload['patient_number'] = $this->generatePatientNumber();
        $payload['tenant_id'] = $this->platformScopeContext->tenantId();

        $createdPatient = $this->patientRepository->create($payload);

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
            'warnings' => [],
        ];
    }

    /**
     * Throw DuplicatePatientException if an active patient with the same
     * identity (name + DOB + phone) already exists in the current tenant scope.
     *
     * @throws DuplicatePatientException
     */
    private function assertNoDuplicates(array $payload): void
    {
        $identity = $this->extractIdentity($payload);

        if (
            empty($identity['first_name']) ||
            empty($identity['last_name']) ||
            empty($identity['date_of_birth']) ||
            empty($identity['phone'])
        ) {
            return;
        }

        $duplicates = $this->patientRepository->findActiveDuplicates(
            firstName: (string) $identity['first_name'],
            lastName: (string) $identity['last_name'],
            dateOfBirth: (string) $identity['date_of_birth'],
            phone: (string) $identity['phone'],
            excludePatientId: null,
        );

        if ($duplicates !== []) {
            throw new DuplicatePatientException(array_map(
                static fn (array $d): array => [
                    'id' => $d['id'] ?? null,
                    'patientNumber' => $d['patient_number'] ?? null,
                    'firstName' => $d['first_name'] ?? null,
                    'lastName' => $d['last_name'] ?? null,
                    'dateOfBirth' => $d['date_of_birth'] ?? null,
                    'phone' => $d['phone'] ?? null,
                ],
                $duplicates,
            ));
        }
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
}
