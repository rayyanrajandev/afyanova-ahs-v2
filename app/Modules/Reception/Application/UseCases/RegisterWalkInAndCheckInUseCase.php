<?php

namespace App\Modules\Reception\Application\UseCases;

use App\Modules\Appointment\Application\UseCases\CreateAppointmentUseCase;
use App\Modules\Reception\Domain\ValueObjects\ArrivalMode;
use Illuminate\Support\Facades\DB;

/**
 * Phase 1 of reports/patient-arrival-checkin-modernization-plan.md: replaces
 * the two-sequential-client-calls walk-in pattern found in
 * reports/patient-arrival-checkin-audit.md §4
 * (patients/Index.vue's startOutpatientWalkInFromHandoff():
 * POST /appointments then PATCH /appointments/{id}/status, with a race
 * window between them) with one backend transaction. Calls
 * CreateAppointmentUseCase and CheckInUseCase exactly as they exist —
 * neither is modified — so the existing POST /appointments and
 * PATCH /appointments/{id}/status endpoints keep working unchanged for any
 * caller that doesn't go through this coordination layer (plan §3.2).
 */
class RegisterWalkInAndCheckInUseCase
{
    public function __construct(
        private readonly CreateAppointmentUseCase $createAppointmentUseCase,
        private readonly CheckInUseCase $checkInUseCase,
    ) {}

    /**
     * @return array<string, mixed>|null
     */
    public function execute(
        string $patientId,
        string $arrivalMode,
        ?string $reason,
        ?int $actorId,
    ): ?array {
        return DB::transaction(function () use ($patientId, $arrivalMode, $reason, $actorId): ?array {
            $appointment = $this->createAppointmentUseCase->execute(
                payload: [
                    'patient_id' => $patientId,
                    'appointment_type' => 'walk_in',
                    'scheduled_at' => now()->addMinute()->toDateTimeString(),
                    'reason' => $reason ?? match ($arrivalMode) {
                        ArrivalMode::EMERGENCY->value => 'Emergency walk-in',
                        default => 'OPD walk-in',
                    },
                ],
                actorId: $actorId,
            );

            return $this->checkInUseCase->execute(
                appointmentId: (string) $appointment['id'],
                arrivalMode: $arrivalMode,
                verificationNotes: null,
                actorId: $actorId,
            );
        });
    }
}
