<?php

namespace App\Modules\MedicalRecord\Domain\Repositories;

interface MedicalRecordRepositoryInterface
{
    public function create(array $attributes): array;

    public function findById(string $id): ?array;

    public function findLatestDraftForAppointment(
        string $patientId,
        string $appointmentId,
        string $recordType,
    ): ?array;

    public function update(string $id, array $attributes): ?array;

    public function existsByRecordNumber(string $recordNumber): bool;

    public function search(
        ?string $query,
        ?string $patientId,
        ?string $appointmentReferralId,
        ?string $admissionId,
        ?string $theatreProcedureId,
        ?string $status,
        ?string $recordType,
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
        ?string $appointmentReferralId,
        ?string $admissionId,
        ?string $theatreProcedureId,
        ?string $recordType,
        ?string $fromDateTime,
        ?string $toDateTime
    ): array;
}
