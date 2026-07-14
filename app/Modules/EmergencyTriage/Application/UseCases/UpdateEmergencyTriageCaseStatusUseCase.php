<?php

namespace App\Modules\EmergencyTriage\Application\UseCases;

use App\Modules\Admission\Application\UseCases\CreateAdmissionUseCase;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Modules\EmergencyTriage\Domain\Repositories\EmergencyTriageCaseAuditLogRepositoryInterface;
use App\Modules\EmergencyTriage\Domain\Repositories\EmergencyTriageCaseRepositoryInterface;
use App\Modules\EmergencyTriage\Domain\ValueObjects\EmergencyTriageCaseStatus;
use Illuminate\Support\Facades\DB;

class UpdateEmergencyTriageCaseStatusUseCase
{
    public function __construct(
        private readonly EmergencyTriageCaseRepositoryInterface $emergencyTriageCaseRepository,
        private readonly EmergencyTriageCaseAuditLogRepositoryInterface $auditLogRepository,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
        private readonly CreateAdmissionUseCase $createAdmissionUseCase,
    ) {}

    public function execute(
        string $id,
        string $status,
        ?string $reason,
        ?string $dispositionNotes,
        ?int $actorId = null,
        ?string $bedResourceId = null,
    ): ?array {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $existing = $this->emergencyTriageCaseRepository->findById($id);
        if (! $existing) {
            return null;
        }

        $payload = [
            'status' => $status,
            'status_reason' => $reason,
        ];

        if ($dispositionNotes !== null) {
            $payload['disposition_notes'] = $dispositionNotes;
        }

        if ($status === EmergencyTriageCaseStatus::TRIAGED->value) {
            $payload['triaged_at'] = now();
        }

        if (in_array($status, [
            EmergencyTriageCaseStatus::ADMITTED->value,
            EmergencyTriageCaseStatus::DISCHARGED->value,
            EmergencyTriageCaseStatus::CANCELLED->value,
        ], true)) {
            $payload['completed_at'] = now();
        } else {
            $payload['completed_at'] = null;
        }

        $createsAdmission = $status === EmergencyTriageCaseStatus::ADMITTED->value
            && ($existing['admission_id'] ?? null) === null;

        $updated = $createsAdmission
            ? DB::transaction(function () use ($id, $payload, $existing, $dispositionNotes, $bedResourceId, $actorId): ?array {
                $admission = $this->createAdmissionUseCase->execute(
                    payload: [
                        'patient_id' => $existing['patient_id'],
                        'attending_clinician_user_id' => $existing['assigned_clinician_user_id'] ?? null,
                        'bed_resource_id' => $bedResourceId,
                        'admitted_at' => now(),
                        'admission_reason' => $dispositionNotes ?? $existing['chief_complaint'] ?? null,
                    ],
                    actorId: $actorId,
                );

                $payload['admission_id'] = $admission['id'];

                return $this->emergencyTriageCaseRepository->update($id, $payload);
            })
            : $this->emergencyTriageCaseRepository->update($id, $payload);

        if (! $updated) {
            return null;
        }

        $this->auditLogRepository->write(
            emergencyTriageCaseId: $id,
            action: 'emergency-triage-case.status.updated',
            actorId: $actorId,
            changes: [
                'status' => [
                    'before' => $existing['status'] ?? null,
                    'after' => $updated['status'] ?? null,
                ],
                'status_reason' => [
                    'before' => $existing['status_reason'] ?? null,
                    'after' => $updated['status_reason'] ?? null,
                ],
                'disposition_notes' => [
                    'before' => $existing['disposition_notes'] ?? null,
                    'after' => $updated['disposition_notes'] ?? null,
                ],
                'completed_at' => [
                    'before' => $existing['completed_at'] ?? null,
                    'after' => $updated['completed_at'] ?? null,
                ],
                'triaged_at' => [
                    'before' => $existing['triaged_at'] ?? null,
                    'after' => $updated['triaged_at'] ?? null,
                ],
            ],
            metadata: [
                'transition' => [
                    'from' => $existing['status'] ?? null,
                    'to' => $updated['status'] ?? null,
                ],
                'triage_timestamp_required' => $status === EmergencyTriageCaseStatus::TRIAGED->value,
                'triage_timestamp_provided' => ($updated['triaged_at'] ?? null) !== null,
                'completion_timestamp_required' => in_array($status, [
                    EmergencyTriageCaseStatus::ADMITTED->value,
                    EmergencyTriageCaseStatus::DISCHARGED->value,
                    EmergencyTriageCaseStatus::CANCELLED->value,
                ], true),
                'completion_timestamp_provided' => ($updated['completed_at'] ?? null) !== null,
                'cancellation_reason_required' => $status === EmergencyTriageCaseStatus::CANCELLED->value,
                'cancellation_reason_provided' => trim((string) ($updated['status_reason'] ?? '')) !== '',
                'disposition_notes_required' => in_array($status, [
                    EmergencyTriageCaseStatus::ADMITTED->value,
                    EmergencyTriageCaseStatus::DISCHARGED->value,
                ], true),
                'disposition_notes_provided' => trim((string) ($updated['disposition_notes'] ?? '')) !== '',
            ],
        );

        return $updated;
    }
}
