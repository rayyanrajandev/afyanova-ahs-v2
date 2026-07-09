<?php

namespace App\Modules\PatientFlow\Application\UseCases;

use App\Modules\Appointment\Domain\ValueObjects\AppointmentStatus;
use App\Modules\Appointment\Infrastructure\Models\AppointmentModel;
use App\Modules\Laboratory\Domain\ValueObjects\LaboratoryOrderStatus;
use App\Modules\Laboratory\Infrastructure\Models\LaboratoryOrderModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\Pharmacy\Domain\ValueObjects\PharmacyOrderStatus;
use App\Modules\Pharmacy\Infrastructure\Models\PharmacyOrderModel;
use App\Modules\Radiology\Domain\ValueObjects\RadiologyOrderStatus;
use App\Modules\Radiology\Infrastructure\Models\RadiologyOrderModel;
use App\Modules\ServiceRequest\Domain\ValueObjects\ServiceRequestStatus;
use App\Modules\ServiceRequest\Infrastructure\Models\ServiceRequestModel;
use Illuminate\Support\Collection;

/**
 * Phase 1 of reports/queue-based-workflow-modernization-plan.md §3.2: a live
 * query, not a persisted table — the same "nothing computed here can drift
 * because nothing here is a second copy" reasoning already validated for
 * GetReceptionQueueUseCase (avoids the C-7 shape). Derives one current-step
 * value per active visit from AppointmentStatus plus open orders across
 * Laboratory/Pharmacy/Radiology, closing the gap
 * reports/queue-based-workflow-audit.md §2-3 documented: those three modules'
 * order statuses exist but are invisible to the visit's own queue position,
 * and nothing connects a completed order back to "the visit can move on."
 *
 * One known limit, intentional for this phase, not an oversight:
 *
 * - "Waiting for Clinician Review" is inferred, not stored: a WAITING_PROVIDER
 *   appointment whose consultation_started_at is already set has been through
 *   at least one consultation before (per
 *   AppointmentController::updateProviderWorkflow()'s in_consultation ->
 *   waiting_provider release path) — this is the only real signal available
 *   to distinguish "returning after being sent for orders" from "waiting for
 *   the first consultation," short of adding a new persisted field, which
 *   this read-only phase deliberately does not do.
 *
 * "In Triage" is distinguished from "Waiting for Triage" using Phase 2's
 * triage_owner_user_id claim (set by ClaimAppointmentTriageUseCase) — a
 * WAITING_TRIAGE appointment with a claim in place is 'in_triage', otherwise
 * 'waiting_triage'.
 *
 * Phase 1b: direct-service walk-ins (patients/Index.vue's "Direct services"
 * handoff mode, POST /service-requests) bypass triage/consultation entirely
 * for a patient who needs only a lab/pharmacy/radiology/theatre service, not
 * a doctor visit — often with no appointment_id at all. Every open
 * (PENDING/IN_PROGRESS), not-yet-linked-to-a-real-order ServiceRequest
 * becomes its own entry here (appointmentId nullable, serviceRequestId set),
 * deriving waiting_direct_service/in_direct_service — new, distinct steps,
 * not folded into waiting_lab/in_lab, since this patient never saw a
 * clinician at all. A request with linked_order_id already set is excluded:
 * once linked, the real order (already covered above) is what matters, and
 * counting both would double the same underlying work on the board.
 */
class GetActiveVisitJourneyUseCase
{
    /**
     * Public so Phase 4's GetOrderCompletionNotificationsForClinicianUseCase
     * can reuse the exact same "what counts as an active visit" definition
     * rather than redefining it — same reasoning as C-8's promotion of the
     * lab/pharmacy/radiology terminal-status consts in
     * GetEncounterCloseReadinessUseCase.
     */
    public const ACTIVE_APPOINTMENT_STATUSES = [
        AppointmentStatus::WAITING_TRIAGE->value,
        AppointmentStatus::WAITING_PROVIDER->value,
        AppointmentStatus::IN_CONSULTATION->value,
    ];

    private const LAB_WAITING_STATUSES = [LaboratoryOrderStatus::ORDERED->value];

    private const LAB_IN_PROGRESS_STATUSES = [
        LaboratoryOrderStatus::COLLECTED->value,
        LaboratoryOrderStatus::IN_PROGRESS->value,
    ];

    private const RADIOLOGY_WAITING_STATUSES = [
        RadiologyOrderStatus::ORDERED->value,
        RadiologyOrderStatus::SCHEDULED->value,
    ];

    private const RADIOLOGY_IN_PROGRESS_STATUSES = [RadiologyOrderStatus::IN_PROGRESS->value];

    private const OPEN_SERVICE_REQUEST_STATUSES = [
        ServiceRequestStatus::PENDING->value,
        ServiceRequestStatus::IN_PROGRESS->value,
    ];

    private const SERVICE_TYPE_LABELS = [
        'laboratory' => 'Laboratory',
        'pharmacy' => 'Pharmacy',
        'radiology' => 'Radiology',
        'theatre_procedure' => 'Theatre procedure',
    ];

    /**
     * @return array<int, array<string, mixed>>
     */
    public function execute(): array
    {
        $appointments = AppointmentModel::query()
            ->whereIn('status', self::ACTIVE_APPOINTMENT_STATUSES)
            ->get();

        $serviceRequests = ServiceRequestModel::query()
            ->whereIn('status', self::OPEN_SERVICE_REQUEST_STATUSES)
            ->whereNull('linked_order_id')
            ->get();

        if ($appointments->isEmpty() && $serviceRequests->isEmpty()) {
            return [];
        }

        $appointmentIds = $appointments->pluck('id')->all();

        $openLabStatusesByAppointmentId = LaboratoryOrderModel::query()
            ->whereIn('appointment_id', $appointmentIds)
            ->whereIn('status', LaboratoryOrderStatus::openWorklistValues())
            ->get(['appointment_id', 'status'])
            ->groupBy('appointment_id')
            ->map(fn ($rows) => $rows->pluck('status')->all());

        $openRadiologyStatusesByAppointmentId = RadiologyOrderModel::query()
            ->whereIn('appointment_id', $appointmentIds)
            ->whereIn('status', RadiologyOrderStatus::openWorklistValues())
            ->get(['appointment_id', 'status'])
            ->groupBy('appointment_id')
            ->map(fn ($rows) => $rows->pluck('status')->all());

        $hasOpenPharmacyByAppointmentId = PharmacyOrderModel::query()
            ->whereIn('appointment_id', $appointmentIds)
            ->whereIn('status', PharmacyOrderStatus::openWorklistValues())
            ->distinct()
            ->pluck('appointment_id')
            ->flip();

        // Batched, not per-row — same reasoning as GetReceptionQueueUseCase:
        // a board showing only patientId is not usable by the staff it's for.
        $patientIds = $appointments->pluck('patient_id')
            ->concat($serviceRequests->pluck('patient_id'))
            ->unique();
        $patientsById = PatientModel::query()
            ->whereIn('id', $patientIds)
            ->get(['id', 'patient_number', 'first_name', 'middle_name', 'last_name'])
            ->keyBy('id');

        $appointmentEntries = $appointments->map(function (AppointmentModel $appointment) use (
            $openLabStatusesByAppointmentId,
            $openRadiologyStatusesByAppointmentId,
            $hasOpenPharmacyByAppointmentId,
            $patientsById,
        ): array {
            return [
                'appointmentId' => $appointment->id,
                'serviceRequestId' => null,
                'patientId' => $appointment->patient_id,
                'patientName' => $this->patientName($patientsById, $appointment->patient_id),
                'patientNumber' => $patientsById->get($appointment->patient_id)?->patient_number,
                'department' => $appointment->department,
                'clinicianUserId' => $appointment->clinician_user_id,
                'appointmentStatus' => $appointment->status,
                'step' => $this->deriveAppointmentStep(
                    $appointment,
                    $openLabStatusesByAppointmentId->get($appointment->id, []),
                    $openRadiologyStatusesByAppointmentId->get($appointment->id, []),
                    $hasOpenPharmacyByAppointmentId->has($appointment->id),
                ),
            ];
        });

        $serviceRequestEntries = $serviceRequests->map(function (ServiceRequestModel $serviceRequest) use ($patientsById): array {
            return [
                'appointmentId' => $serviceRequest->appointment_id,
                'serviceRequestId' => $serviceRequest->id,
                'patientId' => $serviceRequest->patient_id,
                'patientName' => $this->patientName($patientsById, $serviceRequest->patient_id),
                'patientNumber' => $patientsById->get($serviceRequest->patient_id)?->patient_number,
                'department' => self::SERVICE_TYPE_LABELS[$serviceRequest->service_type] ?? $serviceRequest->service_type,
                'clinicianUserId' => null,
                'appointmentStatus' => null,
                'step' => $serviceRequest->status === ServiceRequestStatus::IN_PROGRESS->value
                    ? 'in_direct_service'
                    : 'waiting_direct_service',
            ];
        });

        return $appointmentEntries->concat($serviceRequestEntries)->all();
    }

    /**
     * @param  Collection<string, PatientModel>  $patientsById
     */
    private function patientName(Collection $patientsById, ?string $patientId): ?string
    {
        $patient = $patientId !== null ? $patientsById->get($patientId) : null;
        if ($patient === null) {
            return null;
        }

        $name = implode(' ', array_filter([
            $patient->first_name,
            $patient->middle_name,
            $patient->last_name,
        ], static fn (?string $part): bool => $part !== null && trim($part) !== ''));

        return $name !== '' ? $name : null;
    }

    /**
     * @param  array<int, string>  $openLabStatuses
     * @param  array<int, string>  $openRadiologyStatuses
     */
    private function deriveAppointmentStep(
        AppointmentModel $appointment,
        array $openLabStatuses,
        array $openRadiologyStatuses,
        bool $hasOpenPharmacy,
    ): string {
        if ($appointment->status === AppointmentStatus::WAITING_TRIAGE->value) {
            return $appointment->triage_owner_user_id !== null ? 'in_triage' : 'waiting_triage';
        }

        if ($appointment->status === AppointmentStatus::WAITING_PROVIDER->value) {
            return $appointment->consultation_started_at !== null
                ? 'waiting_clinician_review'
                : 'waiting_clinician';
        }

        // IN_CONSULTATION: earliest-incomplete-step wins — a diagnostic order
        // that hasn't started yet is a more useful signal than one already in
        // progress, since it is the one nobody has acted on at all yet.
        $hasWaitingDiagnostic = array_intersect($openLabStatuses, self::LAB_WAITING_STATUSES) !== []
            || array_intersect($openRadiologyStatuses, self::RADIOLOGY_WAITING_STATUSES) !== [];
        if ($hasWaitingDiagnostic) {
            return 'waiting_lab';
        }

        $hasInProgressDiagnostic = array_intersect($openLabStatuses, self::LAB_IN_PROGRESS_STATUSES) !== []
            || array_intersect($openRadiologyStatuses, self::RADIOLOGY_IN_PROGRESS_STATUSES) !== [];
        if ($hasInProgressDiagnostic) {
            return 'in_lab';
        }

        if ($hasOpenPharmacy) {
            return 'waiting_pharmacy';
        }

        return 'with_clinician';
    }
}
