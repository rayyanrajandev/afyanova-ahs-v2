<?php

namespace App\Modules\Appointment\Application\UseCases;

use App\Modules\Appointment\Application\Exceptions\ActiveAppointmentConflictException;
use App\Modules\Appointment\Application\Exceptions\PatientNotEligibleForAppointmentException;
use App\Modules\Appointment\Application\Exceptions\SourceAdmissionNotEligibleForAppointmentException;
use App\Modules\Appointment\Domain\Repositories\AppointmentAuditLogRepositoryInterface;
use App\Modules\Appointment\Domain\Repositories\AppointmentRepositoryInterface;
use App\Modules\Appointment\Domain\Services\PatientLookupServiceInterface;
use App\Modules\Appointment\Domain\ValueObjects\AppointmentStatus;
use App\Modules\Admission\Domain\Repositories\AdmissionRepositoryInterface;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Support\FinancialCoverage;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use RuntimeException;

class CreateAppointmentUseCase
{
    public function __construct(
        private readonly AppointmentRepositoryInterface $appointmentRepository,
        private readonly AppointmentAuditLogRepositoryInterface $auditLogRepository,
        private readonly PatientLookupServiceInterface $patientLookupService,
        private readonly AdmissionRepositoryInterface $admissionRepository,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    public function execute(array $payload, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        if (! $this->patientLookupService->isActivePatient((string) $payload['patient_id'])) {
            throw new PatientNotEligibleForAppointmentException(
                'Appointment can only be created for an active patient.',
            );
        }

        $this->assertSourceAdmissionEligibility(
            sourceAdmissionId: isset($payload['source_admission_id']) ? (string) $payload['source_admission_id'] : null,
            patientId: (string) $payload['patient_id'],
        );

        $this->assertNoActiveSameDayConflict(
            patientId: (string) $payload['patient_id'],
            scheduledAt: (string) $payload['scheduled_at'],
        );

        $payload['status'] = AppointmentStatus::SCHEDULED->value;
        $payload['appointment_number'] = $this->generateAppointmentNumber();
        $payload['tenant_id'] = $this->platformScopeContext->tenantId();
        $payload['facility_id'] = $this->platformScopeContext->facilityId();
        $payload = $this->normalizeFinancialCoverage($payload);

        $createdAppointment = $this->appointmentRepository->create($payload);

        $this->auditLogRepository->write(
            appointmentId: $createdAppointment['id'],
            action: 'appointment.created',
            actorId: $actorId,
            changes: [
                'after' => $this->extractTrackedFields($createdAppointment),
            ],
        );

        return $createdAppointment;
    }

    private function generateAppointmentNumber(): string
    {
        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $candidate = 'APT'.now()->format('Ymd').strtoupper(Str::random(6));

            if (! $this->appointmentRepository->existsByAppointmentNumber($candidate)) {
                return $candidate;
            }
        }

        throw new RuntimeException('Unable to generate unique appointment number.');
    }

    private function assertNoActiveSameDayConflict(string $patientId, string $scheduledAt): void
    {
        $scheduledDate = Carbon::parse($scheduledAt)->toDateString();
        $existing = $this->appointmentRepository->findActiveForPatientOnDate(
            patientId: $patientId,
            scheduledDate: $scheduledDate,
        );

        if ($existing === null) {
            return;
        }

        $appointmentNumber = (string) ($existing['appointment_number'] ?? 'existing appointment');
        $department = trim((string) ($existing['department'] ?? ''));
        $scheduledTime = isset($existing['scheduled_at'])
            ? Carbon::parse((string) $existing['scheduled_at'])->format('d M Y H:i')
            : $scheduledDate;
        $departmentPart = $department !== '' ? sprintf(' in %s', $department) : '';

        throw new ActiveAppointmentConflictException(
            existingAppointment: $existing,
            message: sprintf(
                'Patient already has an active appointment (%s) on %s%s.',
                $appointmentNumber,
                $scheduledTime,
                $departmentPart,
            ),
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function extractTrackedFields(array $appointment): array
    {
        $tracked = [
            'appointment_number',
            'tenant_id',
            'facility_id',
            'patient_id',
            'source_admission_id',
            'clinician_user_id',
            'department',
            'scheduled_at',
            'duration_minutes',
            'reason',
            'notes',
            'financial_coverage_type',
            'billing_payer_contract_id',
            'coverage_reference',
            'coverage_notes',
            'status',
            'status_reason',
        ];

        $result = [];
        foreach ($tracked as $field) {
            $result[$field] = $appointment[$field] ?? null;
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function normalizeFinancialCoverage(array $payload): array
    {
        $payload['source_admission_id'] = $this->normalizeNullableString($payload['source_admission_id'] ?? null);
        $payload['financial_coverage_type'] = FinancialCoverage::normalize(
            isset($payload['financial_coverage_type']) ? (string) $payload['financial_coverage_type'] : null,
        );
        $payload['billing_payer_contract_id'] = $this->normalizeNullableString($payload['billing_payer_contract_id'] ?? null);
        $payload['coverage_reference'] = $this->normalizeNullableString($payload['coverage_reference'] ?? null);
        $payload['coverage_notes'] = $this->normalizeNullableString($payload['coverage_notes'] ?? null);

        return $payload;
    }

    private function assertSourceAdmissionEligibility(?string $sourceAdmissionId, string $patientId): void
    {
        $normalizedSourceAdmissionId = trim((string) $sourceAdmissionId);
        if ($normalizedSourceAdmissionId === '') {
            return;
        }

        $admission = $this->admissionRepository->findById($normalizedSourceAdmissionId);
        if ($admission === null) {
            throw new SourceAdmissionNotEligibleForAppointmentException(
                'Post-discharge follow-up can only start from an existing admission.',
            );
        }

        $linkedPatientId = trim((string) ($admission['patient_id'] ?? ''));
        if ($linkedPatientId === '' || $linkedPatientId !== $patientId) {
            throw new SourceAdmissionNotEligibleForAppointmentException(
                'Source admission must belong to the same patient as the follow-up appointment.',
            );
        }

        $status = strtolower(trim((string) ($admission['status'] ?? '')));
        if ($status !== 'discharged') {
            throw new SourceAdmissionNotEligibleForAppointmentException(
                'Only discharged admissions can seed post-discharge follow-up appointments.',
            );
        }
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }
}
