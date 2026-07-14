<?php

namespace App\Modules\ServiceRequest\Application\UseCases;

use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Modules\ServiceRequest\Application\Exceptions\ServiceRequestDepartmentScopeException;
use App\Modules\ServiceRequest\Application\Exceptions\ServiceRequestStatusTransitionException;
use App\Modules\ServiceRequest\Application\Services\ServiceRequestDepartmentScope;
use App\Modules\ServiceRequest\Domain\Events\ServiceRequestStatusChanged;
use App\Modules\ServiceRequest\Domain\Repositories\ServiceRequestRepositoryInterface;
use App\Modules\ServiceRequest\Domain\ValueObjects\ServiceRequestStatus;
use Illuminate\Support\Facades\DB;

class UpdateServiceRequestStatusUseCase
{
    public function __construct(
        private readonly ServiceRequestRepositoryInterface $serviceRequestRepository,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
        private readonly AppendServiceRequestAuditEventUseCase $appendServiceRequestAuditEvent,
    ) {}

    public function execute(
        string $id,
        string $newStatus,
        ServiceRequestDepartmentScope $scope,
        ?int $actorId = null,
        ?string $statusReason = null,
    ): ?array {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $existing = $this->serviceRequestRepository->findById($id);
        if (! $existing) {
            return null;
        }

        $this->assertWithinDepartmentScope($existing, $scope);

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
        $normalizedStatusReason = is_string($statusReason) ? trim($statusReason) : null;
        $normalizedStatusReason = $normalizedStatusReason === '' ? null : $normalizedStatusReason;

        if (
            $newStatus === ServiceRequestStatus::COMPLETED->value
            && empty($existing['linked_order_id'])
            && empty($existing['linked_order_number'])
        ) {
            throw new ServiceRequestStatusTransitionException(
                'Create or link the destination work record before closing this direct service ticket.',
            );
        }

        $payload = ['status' => $newStatus];

        if ($newStatus === ServiceRequestStatus::IN_PROGRESS->value) {
            $payload['acknowledged_at'] = now();
            $payload['acknowledged_by_user_id'] = $actorId;
        }

        if (in_array($newStatus, [ServiceRequestStatus::COMPLETED->value, ServiceRequestStatus::CANCELLED->value], true)) {
            $payload['completed_at'] = now();
            $payload['status_reason'] = $normalizedStatusReason;
        }

        $updated = DB::transaction(function () use ($id, $payload, $actorId, $previousStatus, $newStatus, $normalizedStatusReason, $existing): ?array {
            $updated = $this->serviceRequestRepository->update($id, $payload);
            if ($updated === null) {
                return null;
            }

            $metadata = array_filter([
                'statusReason' => $normalizedStatusReason,
                'linkedOrderType' => $existing['linked_order_type'] ?? null,
                'linkedOrderId' => $existing['linked_order_id'] ?? null,
                'linkedOrderNumber' => $existing['linked_order_number'] ?? null,
            ], static fn (mixed $value): bool => $value !== null && $value !== '');

            $this->appendServiceRequestAuditEvent->execute(
                $id,
                'service_request.status_updated',
                $actorId,
                $previousStatus,
                $newStatus,
                $metadata === [] ? null : $metadata,
            );

            return $updated;
        });

        if ($updated !== null) {
            DB::afterCommit(function () use ($updated, $previousStatus, $newStatus, $actorId): void {
                event(new ServiceRequestStatusChanged(
                    serviceRequestId: (string) $updated['id'],
                    patientId: (string) $updated['patient_id'],
                    oldStatus: $previousStatus,
                    newStatus: $newStatus,
                    actorId: $actorId,
                    facilityId: $updated['facility_id'] ?? null,
                ));
            });
        }

        return $updated;
    }

    /**
     * @param array<string, mixed> $existing
     */
    private function assertWithinDepartmentScope(array $existing, ServiceRequestDepartmentScope $scope): void
    {
        if ($scope->canViewAllDepartments) {
            return;
        }

        if ($scope->hasNoAssignedDepartment()) {
            throw new ServiceRequestDepartmentScopeException(
                'Your account has no department assigned — contact an administrator before managing direct service tickets.',
            );
        }

        $ticketDepartmentId = $existing['department_id'] ?? null;
        if ($ticketDepartmentId !== $scope->departmentId) {
            throw new ServiceRequestDepartmentScopeException(
                'This direct service ticket belongs to a different department.',
            );
        }
    }
}
