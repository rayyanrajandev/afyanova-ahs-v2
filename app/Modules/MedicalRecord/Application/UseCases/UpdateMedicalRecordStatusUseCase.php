<?php

namespace App\Modules\MedicalRecord\Application\UseCases;

use App\Modules\MedicalRecord\Application\Exceptions\ConsultationOwnerConflictForMedicalRecordException;
use App\Modules\MedicalRecord\Domain\Repositories\MedicalRecordAuditLogRepositoryInterface;
use App\Modules\MedicalRecord\Domain\Repositories\MedicalRecordRepositoryInterface;
use App\Modules\MedicalRecord\Domain\Repositories\MedicalRecordVersionRepositoryInterface;
use App\Modules\MedicalRecord\Domain\Services\AppointmentLookupServiceInterface;
use App\Modules\MedicalRecord\Domain\ValueObjects\MedicalRecordStatus;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;

class UpdateMedicalRecordStatusUseCase
{
    public function __construct(
        private readonly MedicalRecordAuditLogRepositoryInterface $auditLogRepository,
        private readonly MedicalRecordRepositoryInterface $medicalRecordRepository,
        private readonly MedicalRecordVersionRepositoryInterface $medicalRecordVersionRepository,
        private readonly AppointmentLookupServiceInterface $appointmentLookupService,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    public function execute(string $id, string $status, ?string $reason, ?int $actorId = null): ?array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $existing = $this->medicalRecordRepository->findById($id);
        if (! $existing) {
            return null;
        }

        $this->assertConsultationOwnershipForEncounterWrite(
            $existing['appointment_id'] ?? null,
            $actorId,
        );

        $statusUpdatePayload = [
            'status' => $status,
            'status_reason' => $reason,
        ];

        if ($status === MedicalRecordStatus::FINALIZED->value) {
            $statusUpdatePayload['signed_by_user_id'] = $actorId;
            $statusUpdatePayload['signed_at'] = now();
        }

        $updated = $this->medicalRecordRepository->update($id, $statusUpdatePayload);

        if (! $updated) {
            return null;
        }

        $reasonRequired = in_array($status, [
            MedicalRecordStatus::AMENDED->value,
            MedicalRecordStatus::ARCHIVED->value,
        ], true);

        $statusChanges = $this->extractStatusLifecycleChanges($existing, $updated);

        $this->auditLogRepository->write(
            medicalRecordId: $id,
            action: 'medical-record.status.updated',
            actorId: $actorId,
            changes: $statusChanges,
            metadata: array_merge([
                'transition' => [
                    'from' => $existing['status'] ?? null,
                    'to' => $updated['status'] ?? null,
                ],
                'reason_required' => $reasonRequired,
                'reason_provided' => trim((string) ($updated['status_reason'] ?? '')) !== '',
            ]),
        );

        if ($statusChanges !== []) {
            $this->medicalRecordVersionRepository->create(
                medicalRecordId: $id,
                snapshot: $this->extractVersionSnapshot($updated),
                changedFields: array_keys($statusChanges),
                createdByUserId: $actorId,
            );
        }

        return $updated;
    }

    private function assertConsultationOwnershipForEncounterWrite(?string $appointmentId, ?int $actorId): void
    {
        $normalizedAppointmentId = trim((string) $appointmentId);
        if ($normalizedAppointmentId === '') {
            return;
        }

        $appointment = $this->appointmentLookupService->findById($normalizedAppointmentId);
        if ($appointment === null) {
            return;
        }

        $status = strtolower(trim((string) ($appointment['status'] ?? '')));
        if ($status !== 'in_consultation') {
            return;
        }

        $ownerUserId = $this->resolveConsultationOwnerUserId($appointment);
        if ($ownerUserId <= 0) {
            return;
        }

        if ($actorId !== null && $ownerUserId === $actorId) {
            return;
        }

        throw new ConsultationOwnerConflictForMedicalRecordException($ownerUserId);
    }

    /**
     * @param  array<string, mixed>  $appointment
     */
    private function resolveConsultationOwnerUserId(array $appointment): int
    {
        $ownerUserId = (int) ($appointment['consultation_owner_user_id'] ?? 0);
        if ($ownerUserId > 0) {
            return $ownerUserId;
        }

        return (int) ($appointment['clinician_user_id'] ?? 0);
    }

    /**
     * @return array<string, mixed>
     */
    private function extractStatusLifecycleChanges(array $before, array $after): array
    {
        $trackedFields = [
            'status',
            'status_reason',
            'signed_by_user_id',
            'signed_at',
        ];

        $changes = [];
        foreach ($trackedFields as $field) {
            $beforeValue = $before[$field] ?? null;
            $afterValue = $after[$field] ?? null;

            if ($beforeValue === $afterValue) {
                continue;
            }

            $changes[$field] = [
                'before' => $beforeValue,
                'after' => $afterValue,
            ];
        }

        return $changes;
    }

    /**
     * @return array<string, mixed>
     */
    private function extractVersionSnapshot(array $record): array
    {
        $tracked = [
            'patient_id',
            'admission_id',
            'appointment_id',
            'author_user_id',
            'encounter_at',
            'record_type',
            'subjective',
            'objective',
            'assessment',
            'plan',
            'diagnosis_code',
            'status',
            'status_reason',
            'signed_by_user_id',
            'signed_at',
        ];

        $snapshot = [];
        foreach ($tracked as $field) {
            $snapshot[$field] = $record[$field] ?? null;
        }

        return $snapshot;
    }
}
