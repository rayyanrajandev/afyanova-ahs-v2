<?php

namespace App\Modules\Reception\Application\UseCases;

use App\Modules\Appointment\Application\UseCases\UpdateAppointmentStatusUseCase;
use App\Modules\Appointment\Domain\ValueObjects\AppointmentStatus;
use App\Modules\Encounter\Application\Services\EncounterResolverService;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Reception\Domain\Events\AppointmentCheckedIn;
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
 *
 * Phase 3 (plan §5, decided): also opens the visit's Encounter at check-in —
 * a single Encounter spans the whole visit rather than a separate
 * administrative-vs-clinical record split. This does not grant reception any
 * clinical capability: EncounterResolverService::findOrCreateForVisit() has
 * no permission check of its own (this codebase enforces permissions at the
 * route/FormRequest layer, not inside domain services), and this use case is
 * only reachable via appointments.update-status. Reception still lacks
 * medical.records.create, so it remains unable to reach
 * POST /medical-records or any other clinically-gated endpoint — the
 * encounter that's opened here has no note, diagnosis, or order attached
 * until a clinician creates one through those separately-gated paths.
 *
 * Phase 5 Mode B (plan §3.3, decided to start as soon as Phase 4 shipped):
 * dispatches AppointmentCheckedIn via DB::afterCommit(), so a listener never
 * reacts to a check-in that ultimately rolled back. This class does not know
 * or care what, if anything, listens — no side effects beyond the write this
 * class owns are inlined here (plan §3.2).
 */
class CheckInUseCase
{
    public function __construct(
        private readonly UpdateAppointmentStatusUseCase $updateAppointmentStatusUseCase,
        private readonly ArrivalEventRepositoryInterface $arrivalEventRepository,
        private readonly EncounterResolverService $encounterResolverService,
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

            $this->encounterResolverService->findOrCreateForVisit(
                patientId: (string) $appointment['patient_id'],
                appointmentId: $appointmentId,
                admissionId: null,
                actorId: $actorId,
            );

            DB::afterCommit(function () use ($appointmentId, $appointment, $arrivalMode, $actorId): void {
                event(new AppointmentCheckedIn(
                    appointmentId: $appointmentId,
                    patientId: (string) $appointment['patient_id'],
                    arrivalMode: $arrivalMode,
                    actorId: $actorId,
                ));
            });

            return $appointment;
        });
    }
}
