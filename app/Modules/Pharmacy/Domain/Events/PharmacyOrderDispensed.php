<?php

namespace App\Modules\Pharmacy\Domain\Events;

/**
 * Phase 0 of reports/queue-based-workflow-modernization-plan.md §3.2:
 * dispatched by UpdatePharmacyOrderStatusUseCase after its transaction
 * commits (DB::afterCommit(), mirroring AppointmentCheckedIn in the
 * Reception module), so a listener never reacts to a dispense that
 * ultimately rolled back. Fired only on the DISPENSED transition, not
 * PARTIALLY_DISPENSED — whether a partial dispense should also notify is an
 * open question the plan defers (§5), not resolved by this event's shape.
 * No listener consumes this yet.
 */
class PharmacyOrderDispensed
{
    public function __construct(
        public readonly string $pharmacyOrderId,
        public readonly string $patientId,
        public readonly ?string $appointmentId,
        public readonly ?int $orderedByUserId,
        public readonly ?int $actorId,
    ) {}
}
