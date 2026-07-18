<?php

namespace App\Modules\Patient\Application\UseCases;

use App\Modules\Patient\Application\Services\PatientDuplicateDetectionService;
use App\Modules\Patient\Domain\Repositories\PatientAuditLogRepositoryInterface;
use App\Modules\Patient\Domain\Repositories\PatientRepositoryInterface;
use App\Modules\Patient\Domain\ValueObjects\PatientPhoneNumber;
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
        private readonly PatientDuplicateDetectionService $duplicateDetectionService,
    ) {}

    public function execute(array $payload, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        // Duplicate check runs before write: hard identifiers block, demographics warn.
        $warnings = $this->duplicateDetectionService->evaluate($payload);

        $payload['status'] = PatientStatus::ACTIVE->value;
        $payload['patient_number'] = $this->generatePatientNumber();
        $payload['tenant_id'] = $this->platformScopeContext->tenantId();
        $payload['phone_normalized'] = PatientPhoneNumber::normalize($payload['phone'] ?? null) ?: null;

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
            'national_id' => $patient['national_id'] ?? null,
        ];
    }

}
