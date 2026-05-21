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

    public function hasDraftConsultationNoteForAppointment(string $appointmentId): bool;

    public function hasSignedConsultationNoteForAppointment(string $appointmentId): bool;

    public function update(string $id, array $attributes): ?array;

    /**
     * @return array{outcome: 'updated', record: array<string, mixed>}|array{outcome: 'conflict', record: array<string, mixed>}|array{outcome: 'missing'}
     */
    public function updateWithOptimisticLock(
        string $id,
        array $attributes,
        ?string $expectedUpdatedAt,
        bool $forceDraftSave,
    ): array;

    public function existsByRecordNumber(string $recordNumber): bool;

    public function search(
        ?string $query,
        ?string $patientId,
        ?string $encounterId,
        ?string $appointmentId,
        ?string $appointmentReferralId,
        ?string $admissionId,
        ?string $theatreProcedureId,
        ?int $authorUserId,
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
        ?string $encounterId,
        ?string $appointmentReferralId,
        ?string $admissionId,
        ?string $theatreProcedureId,
        ?string $recordType,
        ?string $fromDateTime,
        ?string $toDateTime
    ): array;
}
