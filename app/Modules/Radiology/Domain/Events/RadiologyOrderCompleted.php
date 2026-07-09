<?php

namespace App\Modules\Radiology\Domain\Events;

/**
 * Phase 0 of reports/queue-based-workflow-modernization-plan.md §3.2:
 * dispatched by UpdateRadiologyOrderStatusUseCase after its transaction
 * commits (DB::afterCommit(), mirroring AppointmentCheckedIn in the
 * Reception module), so a listener never reacts to a report that ultimately
 * rolled back. No listener consumes this yet.
 */
class RadiologyOrderCompleted
{
    public function __construct(
        public readonly string $radiologyOrderId,
        public readonly string $patientId,
        public readonly ?string $appointmentId,
        public readonly ?int $orderedByUserId,
        public readonly ?int $actorId,
    ) {}
}
