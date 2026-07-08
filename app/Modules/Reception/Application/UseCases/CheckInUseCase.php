<?php

namespace App\Modules\Reception\Application\UseCases;

use App\Modules\Appointment\Application\UseCases\UpdateAppointmentStatusUseCase;
use App\Modules\Appointment\Domain\ValueObjects\AppointmentStatus;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Reception\Domain\Repositories\ArrivalEventRepositoryInterface;
use Illuminate\Support\Facades\DB;

/**
 * Phase 1 of reports/patient-arrival-checkin-modernization-plan.md: makes
 * arrival a first-class, auditable event (an ArrivalEvent row recording mode,
 * timestamp, and recording user) alongside the existing appointment-status
 * side effect, instead of only the latter
 * (reports/patient-arrival-checkin-audit.md §3, §6).
 *
 * Wraps UpdateAppointmentStatusUseCase (unmodified, called — not altered, per
 * the plan's framing correction §0) and the ArrivalEvent write in one
 * transaction, following the C-7 lesson from
 * reports/clinical-note-audit/15-critical-system-integrity-review.md: two
 * independently-committed writes for one logical action risk leaving one
 * half committed if the other fails.
 */
class CheckInUseCase
{
    public function __construct(
        private readonly UpdateAppointmentStatusUseCase $updateAppointmentStatusUseCase,
        private readonly ArrivalEventRepositoryInterface $arrivalEventRepository,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
    ) {}

    /**
     * @return array<string, mixed>|null
     */
    public function execute(
        string $appointmentId,
        string $arrivalMode,
        ?string $verificationNotes,
        ?int $actorId,
    ): ?array {
        return DB::transaction(function () use ($appointmentId, $arrivalMode, $verificationNotes, $actorId): ?array {
            $appointment = $this->updateAppointmentStatusUseCase->execute(
                id: $appointmentId,
                status: AppointmentStatus::WAITING_TRIAGE->value,
                reason: null,
                actorId: $actorId,
            );

            if ($appointment === null) {
                return null;
            }

            $this->arrivalEventRepository->create([
                'tenant_id' => $this->platformScopeContext->tenantId(),
                'facility_id' => $this->platformScopeContext->facilityId(),
                'appointment_id' => $appointmentId,
                'arrival_mode' => $arrivalMode,
                'arrived_at' => now(),
                'recorded_by_user_id' => $actorId,
                'verification_notes' => $verificationNotes,
            ]);

            return $appointment;
        });
    }
}
