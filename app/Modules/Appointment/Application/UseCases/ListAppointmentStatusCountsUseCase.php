<?php

namespace App\Modules\Appointment\Application\UseCases;

use App\Modules\Appointment\Domain\Repositories\AppointmentRepositoryInterface;
use App\Modules\Appointment\Domain\ValueObjects\AppointmentStatus;
use Illuminate\Support\Str;

class ListAppointmentStatusCountsUseCase
{
    public function __construct(private readonly AppointmentRepositoryInterface $appointmentRepository) {}

    public function execute(array $filters): array
    {
        $query = isset($filters['q']) ? trim((string) $filters['q']) : null;
        $query = $query === '' ? null : $query;

        $patientId = isset($filters['patientId']) ? trim((string) $filters['patientId']) : null;
        $patientId = $patientId === '' ? null : $patientId;
        if ($patientId !== null && ! Str::isUuid($patientId)) {
            $patientId = null;
        }

        $clinicianUserId = isset($filters['clinicianUserId']) ? (int) $filters['clinicianUserId'] : null;
        if ($clinicianUserId !== null && $clinicianUserId <= 0) {
            $clinicianUserId = null;
        }

        $status = isset($filters['status']) ? trim((string) $filters['status']) : null;
        if ($status === '') {
            $status = null;
        } elseif ($status !== 'exceptions' && ! in_array($status, AppointmentStatus::values(), true)) {
            $status = null;
        }

        $fromDateTime = isset($filters['from']) ? trim((string) $filters['from']) : null;
        $fromDateTime = $fromDateTime === '' ? null : $fromDateTime;

        $toDateTime = isset($filters['to']) ? trim((string) $filters['to']) : null;
        $toDateTime = $toDateTime === '' ? null : $toDateTime;

        return $this->appointmentRepository->statusCounts(
            query: $query,
            patientId: $patientId,
            clinicianUserId: $clinicianUserId,
            status: $status,
            fromDateTime: $fromDateTime,
            toDateTime: $toDateTime,
        );
    }
}
