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

    public function search(
        ?string $query,
        ?string $patientId,
        ?int $clinicianUserId,
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
        ?string $status,
        ?string $fromDateTime,
        ?string $toDateTime
    ): array;
}
