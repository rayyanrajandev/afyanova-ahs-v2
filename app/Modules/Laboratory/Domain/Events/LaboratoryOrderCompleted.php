<?php

namespace App\Modules\Laboratory\Domain\Events;

/**
 * Phase 0 of reports/queue-based-workflow-modernization-plan.md §3.2:
 * dispatched by UpdateLaboratoryOrderStatusUseCase after its transaction
 * commits (DB::afterCommit(), mirroring AppointmentCheckedIn in the
 * Reception module), so a listener never reacts to a result that ultimately
 * rolled back. No listener consumes this yet — this event only exists so the
 * visit-journey read-model and later automation (Phases 1-5 of that plan)
 * have something to build on, per the audit finding that zero cross-module
 * events exist outside Reception (reports/queue-based-workflow-audit.md §3).
 */
class LaboratoryOrderCompleted
{
    public function __construct(
        public readonly string $laboratoryOrderId,
        public readonly string $patientId,
        public readonly ?string $appointmentId,
        public readonly ?int $orderedByUserId,
        public readonly ?int $actorId,
    ) {}
}
