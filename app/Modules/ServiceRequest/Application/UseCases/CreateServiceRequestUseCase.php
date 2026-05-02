<?php

namespace App\Modules\ServiceRequest\Application\UseCases;

use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Modules\ServiceRequest\Application\Exceptions\PatientNotEligibleForServiceRequestException;
use App\Modules\ServiceRequest\Domain\Repositories\ServiceRequestRepositoryInterface;
use App\Modules\ServiceRequest\Domain\Services\PatientLookupServiceInterface;
use App\Modules\ServiceRequest\Domain\ValueObjects\ServiceRequestStatus;
use Illuminate\Support\Str;
use RuntimeException;

class CreateServiceRequestUseCase
{
    public function __construct(
        private readonly ServiceRequestRepositoryInterface $serviceRequestRepository,
        private readonly PatientLookupServiceInterface $patientLookupService,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    public function execute(array $payload, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $patientId = (string) $payload['patient_id'];
        if (! $this->patientLookupService->patientExists($patientId)) {
            throw new PatientNotEligibleForServiceRequestException(
                'Service request can only be created for an existing patient.',
            );
        }

        $payload['status'] = ServiceRequestStatus::PENDING->value;
        $payload['request_number'] = $this->generateRequestNumber();
        $payload['tenant_id'] = $this->platformScopeContext->tenantId();
        $payload['facility_id'] = $this->platformScopeContext->facilityId();
        $payload['requested_by_user_id'] = $actorId;
        $payload['requested_at'] = now();

        if (empty($payload['priority'])) {
            $payload['priority'] = 'routine';
        }

        return $this->serviceRequestRepository->create($payload);
    }

    private function generateRequestNumber(): string
    {
        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $candidate = 'SR'.now()->format('Ymd').strtoupper(Str::random(6));

            if (! $this->serviceRequestRepository->existsByRequestNumber($candidate)) {
                return $candidate;
            }
        }

        throw new RuntimeException('Unable to generate unique service request number.');
    }
}
