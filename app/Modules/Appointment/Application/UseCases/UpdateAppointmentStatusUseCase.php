<?php

namespace App\Modules\Appointment\Application\UseCases;

use App\Modules\Appointment\Domain\Repositories\AppointmentAuditLogRepositoryInterface;
use App\Modules\Appointment\Domain\Repositories\AppointmentRepositoryInterface;
use App\Modules\Appointment\Domain\ValueObjects\AppointmentStatus;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;

class UpdateAppointmentStatusUseCase
{
    public function __construct(
        private readonly AppointmentRepositoryInterface $appointmentRepository,
        private readonly AppointmentAuditLogRepositoryInterface $auditLogRepository,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    public function execute(
        string $id,
        string $status,
        ?string $reason,
        ?int $actorId = null,
        array $statusAttributes = [],
        array $auditMetadata = [],
    ): ?array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $existing = $this->appointmentRepository->findById($id);
        if (! $existing) {
            return null;
        }

        $updated = $this->appointmentRepository->update($id, array_merge([
            'status' => $status,
            'status_reason' => $reason,
        ], $statusAttributes, (
            $status === \App\Modules\Appointment\Domain\ValueObjects\AppointmentStatus::WAITING_TRIAGE->value
                ? ['checked_in_at' => now()]
                : []
        )));

        if (! $updated) {
            return null;
        }

        $reasonRequired = in_array($status, [
            AppointmentStatus::CANCELLED->value,
            AppointmentStatus::NO_SHOW->value,
        ], true);

        $this->auditLogRepository->write(
            appointmentId: $id,
            action: 'appointment.status.updated',
            actorId: $actorId,
            changes: [
                'status' => [
                    'before' => $existing['status'] ?? null,
                    'after' => $updated['status'] ?? null,
                ],
                'status_reason' => [
                    'before' => $existing['status_reason'] ?? null,
                    'after' => $updated['status_reason'] ?? null,
                ],
            ],
            metadata: array_merge([
                'transition' => [
                    'from' => $existing['status'] ?? null,
                    'to' => $updated['status'] ?? null,
                ],
                'reason_required' => $reasonRequired,
                'reason_provided' => trim((string) ($updated['status_reason'] ?? '')) !== '',
                'triage_handoff' => in_array($status, [
                    AppointmentStatus::WAITING_TRIAGE->value,
                    AppointmentStatus::WAITING_PROVIDER->value,
                ], true),
            ], $auditMetadata),
        );

        return $updated;
    }
}
