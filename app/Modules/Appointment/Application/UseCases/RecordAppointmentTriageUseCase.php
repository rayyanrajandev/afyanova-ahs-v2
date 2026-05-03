<?php

namespace App\Modules\Appointment\Application\UseCases;

use App\Modules\Appointment\Domain\Repositories\AppointmentAuditLogRepositoryInterface;
use App\Modules\Appointment\Domain\Repositories\AppointmentRepositoryInterface;
use App\Modules\Appointment\Domain\ValueObjects\AppointmentStatus;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use Illuminate\Validation\ValidationException;

class RecordAppointmentTriageUseCase
{
    public function __construct(
        private readonly AppointmentRepositoryInterface $appointmentRepository,
        private readonly AppointmentAuditLogRepositoryInterface $auditLogRepository,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    public function execute(string $id, string $triageVitalsSummary, ?string $triageNotes, ?string $triageCategory = null, ?int $actorId = null): ?array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $existing = $this->appointmentRepository->findById($id);
        if (! $existing) {
            return null;
        }

        $currentStatus = strtolower((string) ($existing['status'] ?? ''));
        if (! in_array($currentStatus, [
            AppointmentStatus::WAITING_TRIAGE->value,
            AppointmentStatus::WAITING_PROVIDER->value,
        ], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only appointments in the triage flow can be handed off to the provider queue.'],
            ]);
        }

        $validCategories = ['P1', 'P2', 'P3', 'P4', 'P5'];
        $normalizedCategory = $triageCategory !== null ? strtoupper(trim($triageCategory)) : null;
        if ($normalizedCategory !== null && ! in_array($normalizedCategory, $validCategories, true)) {
            $normalizedCategory = null;
        }

        $updated = $this->appointmentRepository->update($id, [
            'triage_vitals_summary' => $triageVitalsSummary,
            'triage_notes' => $triageNotes,
            'triage_category' => $normalizedCategory,
            'triaged_at' => now(),
            'triaged_by_user_id' => $actorId,
            'status' => AppointmentStatus::WAITING_PROVIDER->value,
            'status_reason' => null,
        ]);

        if (! $updated) {
            return null;
        }

        $changes = $this->extractChanges($existing, $updated);
        if ($changes !== []) {
            $this->auditLogRepository->write(
                appointmentId: $id,
                action: 'appointment.triage.recorded',
                actorId: $actorId,
                changes: $changes,
                metadata: [
                    'handoff_to_provider' => true,
                    'previous_status' => $existing['status'] ?? null,
                    'next_status' => $updated['status'] ?? null,
                ],
            );
        }

        return $updated;
    }

    /**
     * @return array<string, mixed>
     */
    private function extractChanges(array $before, array $after): array
    {
        $trackedFields = [
            'triage_vitals_summary',
            'triage_notes',
            'triage_category',
            'triaged_at',
            'triaged_by_user_id',
            'status',
            'status_reason',
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
}
