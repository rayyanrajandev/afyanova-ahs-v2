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
        private readonly AppendServiceRequestAuditEventUseCase $appendServiceRequestAuditEvent,
    ) {}

    public function execute(array $payload, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        if (isset($payload['appointment_id'])) {
            $aid = trim((string) $payload['appointment_id']);
            $payload['appointment_id'] = $aid !== '' ? $aid : null;
        }

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

        $created = $this->serviceRequestRepository->create($payload);
        $id = is_string($created['id'] ?? null) ? (string) $created['id'] : '';

        if ($id !== '') {
            $this->appendServiceRequestAuditEvent->execute(
                $id,
                'service_request.created',
                $actorId,
                null,
                ServiceRequestStatus::PENDING->value,
                [
                    'patientId' => $patientId,
                    'appointmentId' => $created['appointment_id'] ?? null,
                    'requestNumber' => $created['request_number'] ?? null,
                    'serviceType' => $created['service_type'] ?? null,
                ],
            );
        }

        return $created;
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
