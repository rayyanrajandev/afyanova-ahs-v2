<?php

namespace App\Modules\ServiceRequest\Application\UseCases;

use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Modules\ServiceRequest\Application\Exceptions\ServiceRequestStatusTransitionException;
use App\Modules\ServiceRequest\Domain\Repositories\ServiceRequestRepositoryInterface;
use App\Modules\ServiceRequest\Domain\ValueObjects\ServiceRequestStatus;

class UpdateServiceRequestStatusUseCase
{
    public function __construct(
        private readonly ServiceRequestRepositoryInterface $serviceRequestRepository,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
        private readonly AppendServiceRequestAuditEventUseCase $appendServiceRequestAuditEvent,
    ) {}

    public function execute(string $id, string $newStatus, ?int $actorId = null): ?array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $existing = $this->serviceRequestRepository->findById($id);
        if (! $existing) {
            return null;
        }

        $currentStatus = ServiceRequestStatus::tryFrom((string) ($existing['status'] ?? ''));
        if ($currentStatus === null || ! $currentStatus->canTransitionTo($newStatus)) {
            throw new ServiceRequestStatusTransitionException(
                sprintf(
                    "Cannot transition service request from '%s' to '%s'.",
                    $existing['status'] ?? 'unknown',
                    $newStatus,
                ),
            );
        }

        $previousStatus = (string) ($existing['status'] ?? 'unknown');

        $payload = ['status' => $newStatus];

        if ($newStatus === ServiceRequestStatus::IN_PROGRESS->value) {
            $payload['acknowledged_at'] = now();
            $payload['acknowledged_by_user_id'] = $actorId;
        }

        if (in_array($newStatus, [ServiceRequestStatus::COMPLETED->value, ServiceRequestStatus::CANCELLED->value], true)) {
            $payload['completed_at'] = now();
        }

        $updated = $this->serviceRequestRepository->update($id, $payload);
        if ($updated !== null) {
            $this->appendServiceRequestAuditEvent->execute(
                $id,
                'service_request.status_updated',
                $actorId,
                $previousStatus,
                $newStatus,
                null,
            );
        }

        return $updated;
    }
}
