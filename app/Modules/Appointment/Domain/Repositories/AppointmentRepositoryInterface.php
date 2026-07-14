<?php

namespace App\Modules\Appointment\Domain\Repositories;

interface AppointmentRepositoryInterface
{
    public function create(array $attributes): array;

    public function findById(string $id): ?array;

    public function update(string $id, array $attributes): ?array;

    public function existsByAppointmentNumber(string $appointmentNumber): bool;

    public function findActiveForPatientOnDate(
        string $patientId,
        string $scheduledDate,
        ?string $excludeAppointmentId = null,
    ): ?array;

    /**
     * Candidate rows for a clinician-overlap check: same clinician,
     * scheduled_at within [$windowStart, $windowEnd], non-terminal status.
     * Callers do the exact time-range overlap comparison in PHP (not SQL)
     * since "scheduled_at + duration" date arithmetic isn't portable across
     * the sqlite test driver and production's DB engine. $windowStart/
     * $windowEnd should be wide enough (e.g. the reference time +/- the max
     * possible appointment duration) to guarantee no true overlap falls
     * outside the window.
     *
     * @return array<int, array<string, mixed>>
     */
    public function findActiveForClinicianInWindow(
        int $clinicianUserId,
        string $windowStart,
        string $windowEnd,
        ?string $excludeAppointmentId = null,
    ): array;

    public function search(
        ?string $query,
        ?string $patientId,
        ?int $clinicianUserId,
        ?string $department,
        bool $unassignedClinicianOnly,
        ?string $status,
        ?string $triageCategory,
        ?string $fromDateTime,
        ?string $toDateTime,
        int $page,
        int $perPage,
        ?string $sortBy,
        string $sortDirection
    ): array;

    public function statusCounts(
        ?string $query,
        ?string $patientId,
        ?int $clinicianUserId,
        ?string $department,
        bool $unassignedClinicianOnly,
        ?string $status,
        ?string $triageCategory,
        ?string $fromDateTime,
        ?string $toDateTime
    ): array;

    /**
     * Find the most recent completed appointment for the patient at the given
     * facility whose scheduled_at date falls within the $withinDays window
     * before $scheduledAt. Null facilityId means the single-facility/global
     * appointment scope.
     *
     * @return array<string, mixed>|null
     */
    public function findLastCompletedForPatientWithinDays(
        string $patientId,
        ?string $facilityId,
        string $scheduledAt,
        int $withinDays,
    ): ?array;
}
