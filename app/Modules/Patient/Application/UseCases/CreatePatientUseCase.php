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

    public function execute(array $payload, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        // Duplicate guard — runs BEFORE any write so no phantom record is created.
        // Client-side confirmation is advisory only; exact active duplicates remain blocked.
        $this->assertNoDuplicates($payload);

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
     * strong identifier or exact demographic identity already exists.
     *
     * @throws DuplicatePatientException
     */
    private function assertNoDuplicates(array $payload): void
    {
        $identity = $this->extractIdentity($payload);

        if ($this->hasNoDuplicateSearchKey($identity)) {
            return;
        }

        $duplicates = $this->patientRepository->findActiveDuplicates(
            firstName: $this->nullableString($identity['first_name'] ?? null),
            lastName: $this->nullableString($identity['last_name'] ?? null),
            dateOfBirth: $this->nullableString($identity['date_of_birth'] ?? null),
            phone: $this->nullableString($identity['phone'] ?? null),
            nationalId: $this->nullableString($identity['national_id'] ?? null),
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
                    'gender' => $d['gender'] ?? null,
                    'nationalId' => $d['national_id'] ?? null,
                    'countryCode' => $d['country_code'] ?? null,
                    'region' => $d['region'] ?? null,
                    'district' => $d['district'] ?? null,
                    'addressLine' => $d['address_line'] ?? null,
                    'status' => $d['status'] ?? null,
                    'createdAt' => $d['created_at'] ?? null,
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
            'national_id' => $patient['national_id'] ?? null,
        ];
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
