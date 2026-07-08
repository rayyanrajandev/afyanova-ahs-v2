<?php

namespace App\Modules\Encounter\Application\Services;

use App\Modules\Encounter\Domain\Repositories\EncounterAuditLogRepositoryInterface;
use App\Modules\Encounter\Domain\Services\AppointmentLookupServiceInterface;
use App\Modules\Encounter\Domain\ValueObjects\EncounterStatus;
use App\Modules\Encounter\Domain\ValueObjects\EncounterType;
use App\Modules\Encounter\Infrastructure\Models\EncounterModel;
use App\Modules\MedicalRecord\Application\Exceptions\AppointmentNotEligibleForMedicalRecordException;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Str;
use RuntimeException;

class EncounterResolverService
{
    public function __construct(
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly EncounterAuditLogRepositoryInterface $encounterAuditLogRepository,
        private readonly AppointmentLookupServiceInterface $appointmentLookupService,
    ) {}

    public function findById(string $encounterId): ?EncounterModel
    {
        $normalizedId = trim($encounterId);

        return $normalizedId !== ''
            ? EncounterModel::query()->find($normalizedId)
            : null;
    }

    public function findByAppointmentId(string $appointmentId): ?EncounterModel
    {
        $normalizedAppointmentId = trim($appointmentId);
        if ($normalizedAppointmentId === '') {
            return null;
        }

        return EncounterModel::query()
            ->where('appointment_id', $normalizedAppointmentId)
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->first();
    }

    public function findOrCreateForVisit(
        string $patientId,
        ?string $appointmentId,
        ?string $admissionId,
        ?int $actorId,
        ?string $requestedEncounterId = null,
    ): EncounterModel {
        $normalizedPatientId = trim($patientId);
        $normalizedAppointmentId = $appointmentId !== null ? trim($appointmentId) : '';
        $normalizedAdmissionId = $admissionId !== null ? trim($admissionId) : '';
        $normalizedRequestedEncounterId = $requestedEncounterId !== null ? trim($requestedEncounterId) : '';

        if ($normalizedRequestedEncounterId !== '') {
            $encounter = $this->findById($normalizedRequestedEncounterId);
            if (
                $encounter === null ||
                (string) $encounter->patient_id !== $normalizedPatientId ||
                ($normalizedAppointmentId !== '' && (string) ($encounter->appointment_id ?? '') !== $normalizedAppointmentId) ||
                ($normalizedAdmissionId !== '' && (string) ($encounter->admission_id ?? '') !== $normalizedAdmissionId)
            ) {
                throw new AppointmentNotEligibleForMedicalRecordException(
                    'Encounter is not valid for the selected patient visit context.',
                );
            }

            return $encounter;
        }

        if ($normalizedAppointmentId === '' && $normalizedAdmissionId === '') {
            throw new AppointmentNotEligibleForMedicalRecordException(
                'An appointment or admission is required to resolve an encounter.',
            );
        }

        $existingEncounter = $this->findExistingForVisit($normalizedPatientId, $normalizedAppointmentId, $normalizedAdmissionId);
        if ($existingEncounter !== null) {
            return $existingEncounter;
        }

        // C-4 (reports/clinical-note-audit/15-critical-system-integrity-review.md):
        // the lookup above and this create() are not atomic — a second, near-
        // simultaneous request for the same appointment/admission can pass the
        // same lookup before either side has committed a row. The unique
        // indexes added on encounters.appointment_id/admission_id turn that
        // race into a UniqueConstraintViolationException here instead of a
        // silent duplicate encounter; recover by returning whichever row the
        // concurrent writer actually committed.
        try {
            $encounter = EncounterModel::query()->create([
                'encounter_number' => $this->generateEncounterNumber(),
                'tenant_id' => $this->platformScopeContext->tenantId(),
                'facility_id' => $this->platformScopeContext->facilityId(),
                'patient_id' => $normalizedPatientId,
                'appointment_id' => $normalizedAppointmentId !== '' ? $normalizedAppointmentId : null,
                'admission_id' => $normalizedAdmissionId !== '' ? $normalizedAdmissionId : null,
                'primary_clinician_user_id' => $actorId,
                'status' => EncounterStatus::OPENED->value,
                'type' => $this->deriveEncounterType($normalizedAppointmentId, $normalizedAdmissionId),
                'opened_at' => now(),
            ]);
        } catch (UniqueConstraintViolationException $exception) {
            $winningEncounter = $this->findExistingForVisit($normalizedPatientId, $normalizedAppointmentId, $normalizedAdmissionId);

            if ($winningEncounter === null) {
                throw $exception;
            }

            return $winningEncounter;
        }

        $this->encounterAuditLogRepository->write(
            encounterId: (string) $encounter->id,
            action: 'encounter.opened',
            actorId: $actorId,
            changes: [
                'after' => [
                    'status' => EncounterStatus::OPENED->value,
                    'patient_id' => $normalizedPatientId,
                    'appointment_id' => $normalizedAppointmentId !== '' ? $normalizedAppointmentId : null,
                    'admission_id' => $normalizedAdmissionId !== '' ? $normalizedAdmissionId : null,
                ],
            ],
        );

        return $encounter;
    }

    private function findExistingForVisit(string $patientId, string $appointmentId, string $admissionId): ?EncounterModel
    {
        $query = EncounterModel::query()->where('patient_id', $patientId);
        if ($appointmentId !== '') {
            $query->where('appointment_id', $appointmentId);
        } else {
            $query->where('admission_id', $admissionId);
        }

        return $query
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->first();
    }

    /**
     * Best-effort derivation at open time, not a re-verifiable clinical
     * classification — inpatient is certain (admission_id is authoritative),
     * emergency is a heuristic (department string match, since Appointment
     * has no structured department FK or emergency flag today).
     */
    private function deriveEncounterType(string $appointmentId, string $admissionId): string
    {
        if ($admissionId !== '') {
            return EncounterType::INPATIENT->value;
        }

        if ($appointmentId !== '') {
            $appointment = $this->appointmentLookupService->findById($appointmentId);
            $department = strtolower(trim((string) ($appointment['department'] ?? '')));
            if (str_contains($department, 'emergency')) {
                return EncounterType::EMERGENCY->value;
            }
        }

        return EncounterType::OUTPATIENT->value;
    }

    private function generateEncounterNumber(): string
    {
        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $candidate = 'ENC'.now()->format('Ymd').strtoupper(Str::random(6));

            if (! EncounterModel::query()->where('encounter_number', $candidate)->exists()) {
                return $candidate;
            }
        }

        throw new RuntimeException('Unable to generate unique encounter number.');
    }
}
