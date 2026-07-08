<?php

namespace App\Modules\Reception\Application\UseCases;

use App\Modules\Appointment\Domain\ValueObjects\AppointmentStatus;
use App\Modules\Appointment\Infrastructure\Models\AppointmentModel;
use App\Modules\Reception\Domain\ValueObjects\ArrivalMode;
use App\Modules\Reception\Infrastructure\Models\ArrivalEventModel;
use InvalidArgumentException;

/**
 * Phase 4 of reports/patient-arrival-checkin-modernization-plan.md, decided
 * scope (plan §5): a simple operational ordering — emergency arrivals first,
 * then scheduled, then walk-in, oldest-wait-first within each tier — with no
 * formal clinical acuity model required to ship it.
 *
 * Deliberately a live query, not a separately-persisted/synced
 * visit_queue_entries table as the plan's own §3.2 sketch first suggested:
 * a synced projection is exactly the two-writes-for-one-fact shape that
 * caused C-7 (reports/clinical-note-audit/15-critical-system-integrity-review.md)
 * — every appointment/arrival-event write would need to also keep a queue
 * row in sync, or the queue silently drifts from reality. Reading live means
 * there is nothing to drift. A future acuity field slots in as an additional
 * ORDER BY tier ahead of arrival-mode, not an architecture change.
 */
class GetReceptionQueueUseCase
{
    private const STAGES = [
        AppointmentStatus::WAITING_TRIAGE->value,
        AppointmentStatus::WAITING_PROVIDER->value,
    ];

    private const ARRIVAL_MODE_TIERS = [
        ArrivalMode::EMERGENCY->value => 0,
        ArrivalMode::SCHEDULED_CHECKIN->value => 1,
        ArrivalMode::WALK_IN->value => 2,
    ];

    /**
     * Arrival mode is unknown for a visit that reached this stage without
     * going through CheckInUseCase (e.g. sent back to waiting_triage from
     * in_consultation via updateProviderWorkflow, or an appointment checked
     * in before Phase 1 shipped). Defaulting to the SCHEDULED_CHECKIN tier —
     * not last — is deliberate: a queue's entire purpose is to keep every
     * waiting patient visible, so an unrecognized case must not silently
     * sink to the bottom.
     */
    private const UNKNOWN_ARRIVAL_MODE_TIER = 1;

    /**
     * @return array<int, array<string, mixed>>
     */
    public function execute(string $stage): array
    {
        if (! in_array($stage, self::STAGES, true)) {
            throw new InvalidArgumentException(sprintf('Unsupported reception queue stage: %s', $stage));
        }

        $appointments = AppointmentModel::query()
            ->where('status', $stage)
            ->get();

        if ($appointments->isEmpty()) {
            return [];
        }

        $appointmentIds = $appointments->pluck('id')->all();
        $latestArrivalModeByAppointmentId = ArrivalEventModel::query()
            ->whereIn('appointment_id', $appointmentIds)
            ->orderByDesc('arrived_at')
            ->get(['appointment_id', 'arrival_mode'])
            ->unique('appointment_id')
            ->pluck('arrival_mode', 'appointment_id');

        $entries = $appointments->map(function (AppointmentModel $appointment) use ($stage, $latestArrivalModeByAppointmentId): array {
            $arrivalMode = $latestArrivalModeByAppointmentId->get($appointment->id);
            $waitStartedAt = $stage === AppointmentStatus::WAITING_PROVIDER->value
                ? ($appointment->triaged_at ?? $appointment->checked_in_at)
                : $appointment->checked_in_at;

            return [
                'appointmentId' => $appointment->id,
                'patientId' => $appointment->patient_id,
                'department' => $appointment->department,
                'clinicianUserId' => $appointment->clinician_user_id,
                'arrivalMode' => $arrivalMode,
                'tier' => $arrivalMode !== null
                    ? (self::ARRIVAL_MODE_TIERS[$arrivalMode] ?? self::UNKNOWN_ARRIVAL_MODE_TIER)
                    : self::UNKNOWN_ARRIVAL_MODE_TIER,
                'waitStartedAt' => $waitStartedAt,
                'waitMinutes' => $waitStartedAt !== null ? $waitStartedAt->diffInMinutes(now()) : null,
            ];
        })->all();

        // Explicit usort, not Collection::sortBy() with multiple criteria: that
        // method's multi-comparator form expects each element to itself be a
        // two-argument (a, b) comparator, not a single-argument value
        // extractor — easy to get subtly wrong. This comparator's contract is
        // fully explicit: tier ascending (0 = emergency first), then oldest
        // wait first within a tier. An unknown wait-start is sorted to the end
        // of its tier, not treated as "waited longest" — better to be visibly
        // uncertain than to falsely claim priority.
        usort($entries, function (array $a, array $b): int {
            if ($a['tier'] !== $b['tier']) {
                return $a['tier'] <=> $b['tier'];
            }

            $aTimestamp = $a['waitStartedAt']?->timestamp ?? PHP_INT_MAX;
            $bTimestamp = $b['waitStartedAt']?->timestamp ?? PHP_INT_MAX;

            return $aTimestamp <=> $bTimestamp;
        });

        return $entries;
    }
}
