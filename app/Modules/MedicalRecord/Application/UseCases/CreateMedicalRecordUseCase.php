<?php

namespace App\Modules\MedicalRecord\Application\UseCases;

use App\Modules\MedicalRecord\Application\Exceptions\AdmissionNotEligibleForMedicalRecordException;
use App\Modules\MedicalRecord\Application\Exceptions\AppointmentNotEligibleForMedicalRecordException;
use App\Modules\MedicalRecord\Application\Exceptions\AppointmentReferralNotEligibleForMedicalRecordException;
use App\Modules\MedicalRecord\Application\Exceptions\ConsultationOwnerConflictForMedicalRecordException;
use App\Modules\MedicalRecord\Application\Exceptions\DuplicateEncounterDraftMedicalRecordException;
use App\Modules\MedicalRecord\Application\Exceptions\InvalidMedicalRecordDiagnosisCodeException;
use App\Modules\MedicalRecord\Application\Exceptions\InvalidMedicalRecordTypeException;
use App\Modules\MedicalRecord\Application\Exceptions\PatientNotEligibleForMedicalRecordException;
use App\Modules\MedicalRecord\Application\Exceptions\TheatreProcedureNotEligibleForMedicalRecordException;
use App\Modules\MedicalRecord\Domain\Repositories\MedicalRecordAuditLogRepositoryInterface;
use App\Modules\MedicalRecord\Domain\Repositories\MedicalRecordRepositoryInterface;
use App\Modules\MedicalRecord\Domain\Repositories\MedicalRecordVersionRepositoryInterface;
use App\Modules\MedicalRecord\Domain\Services\AdmissionLookupServiceInterface;
use App\Modules\MedicalRecord\Domain\Services\AppointmentLookupServiceInterface;
use App\Modules\MedicalRecord\Domain\Services\AppointmentReferralLookupServiceInterface;
use App\Modules\MedicalRecord\Domain\Services\DiagnosisTerminologyLookupServiceInterface;
use App\Modules\MedicalRecord\Domain\Services\PatientLookupServiceInterface;
use App\Modules\MedicalRecord\Domain\Services\TheatreProcedureLookupServiceInterface;
use App\Modules\MedicalRecord\Domain\ValueObjects\MedicalRecordNoteType;
use App\Modules\MedicalRecord\Domain\ValueObjects\MedicalRecordStatus;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use Illuminate\Support\Str;
use RuntimeException;

class CreateMedicalRecordUseCase
{
    private const ICD10_CODE_PATTERN = '/^[A-Z][0-9]{2}(?:\.[A-Z0-9]{1,4})?$/';

    public function __construct(
        private readonly MedicalRecordAuditLogRepositoryInterface $auditLogRepository,
        private readonly MedicalRecordRepositoryInterface $medicalRecordRepository,
        private readonly MedicalRecordVersionRepositoryInterface $medicalRecordVersionRepository,
        private readonly PatientLookupServiceInterface $patientLookupService,
        private readonly AppointmentLookupServiceInterface $appointmentLookupService,
        private readonly AppointmentReferralLookupServiceInterface $appointmentReferralLookupService,
        private readonly AdmissionLookupServiceInterface $admissionLookupService,
        private readonly TheatreProcedureLookupServiceInterface $theatreProcedureLookupService,
        private readonly DiagnosisTerminologyLookupServiceInterface $diagnosisTerminologyLookupService,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    public function execute(array $payload, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $patientId = (string) $payload['patient_id'];
        if (! $this->patientLookupService->patientExists($patientId)) {
            throw new PatientNotEligibleForMedicalRecordException(
                'Medical record can only be created for an existing patient.',
            );
        }

        $appointmentId = $payload['appointment_id'] ?? null;
        $appointment = null;
        if ($appointmentId !== null) {
            $appointment = $this->appointmentLookupService->findById((string) $appointmentId);
            if ($appointment === null || ($appointment['patient_id'] ?? null) !== $patientId) {
                throw new AppointmentNotEligibleForMedicalRecordException(
                    'Appointment is not valid for the selected patient.',
                );
            }

            $this->assertConsultationOwnershipForEncounterWrite($appointment, $actorId);
        }

        $admissionId = $payload['admission_id'] ?? null;
        if ($admissionId !== null && ! $this->admissionLookupService->isValidForPatient((string) $admissionId, $patientId)) {
            throw new AdmissionNotEligibleForMedicalRecordException(
                'Admission is not valid for the selected patient.',
            );
        }

        $recordType = $this->applyRecordTypeValidationBaseline($payload);
        $this->applyAppointmentReferralValidationBaseline(
            $payload,
            $appointmentId,
            $recordType,
        );
        $this->applyTheatreProcedureValidationBaseline(
            $payload,
            $patientId,
            $appointmentId,
            $admissionId,
            $recordType,
        );
        if ($appointmentId !== null && $recordType === MedicalRecordNoteType::CONSULTATION_NOTE->value) {
            $existingDraft = $this->medicalRecordRepository->findLatestDraftForAppointment(
                $patientId,
                (string) $appointmentId,
                $recordType,
            );

            if ($existingDraft !== null) {
                throw new DuplicateEncounterDraftMedicalRecordException(
                    'A draft consultation note already exists for this visit. Continue the existing draft instead of creating another one.',
                );
            }
        }

        $this->applyDiagnosisCodeValidationBaseline($payload);

        $payload['status'] = MedicalRecordStatus::DRAFT->value;
        $payload['record_number'] = $this->generateRecordNumber();
        $payload['tenant_id'] = $this->platformScopeContext->tenantId();
        $payload['facility_id'] = $this->platformScopeContext->facilityId();

        $createdRecord = $this->medicalRecordRepository->create($payload);

            $this->auditLogRepository->write(
                medicalRecordId: $createdRecord['id'],
                action: 'medical-record.created',
                actorId: $actorId,
                changes: [
                    'after' => $this->extractTrackedFields($createdRecord),
                ],
                metadata: [],
            );

        $snapshot = $this->extractVersionSnapshot($createdRecord);
        $this->medicalRecordVersionRepository->create(
            medicalRecordId: (string) $createdRecord['id'],
            snapshot: $snapshot,
            changedFields: array_keys($snapshot),
            createdByUserId: $actorId,
        );

        return $createdRecord;
    }

    private function applyRecordTypeValidationBaseline(array &$payload): string
    {
        $recordType = MedicalRecordNoteType::normalize($payload['record_type'] ?? null);

        if (! MedicalRecordNoteType::isValid($recordType)) {
            throw new InvalidMedicalRecordTypeException(
                'Record type must be one of the governed clinical note types.',
            );
        }

        $payload['record_type'] = $recordType;

        return $recordType;
    }

    private function applyAppointmentReferralValidationBaseline(
        array &$payload,
        mixed $appointmentId,
        string $recordType,
    ): void {
        if (! array_key_exists('appointment_referral_id', $payload)) {
            return;
        }

        $appointmentReferralId = $payload['appointment_referral_id'];
        if ($appointmentReferralId === null) {
            return;
        }

        if ($recordType !== MedicalRecordNoteType::REFERRAL_NOTE->value) {
            throw new AppointmentReferralNotEligibleForMedicalRecordException(
                'Only referral notes can link to a referral handoff record.',
            );
        }

        if (! is_string($appointmentId) || trim($appointmentId) === '') {
            throw new AppointmentReferralNotEligibleForMedicalRecordException(
                'Referral linkage requires the linked appointment context.',
            );
        }

        $normalizedAppointmentReferralId = trim((string) $appointmentReferralId);
        $referral = $this->appointmentReferralLookupService->findByAppointment(
            trim($appointmentId),
            $normalizedAppointmentReferralId,
        );

        if ($referral === null) {
            throw new AppointmentReferralNotEligibleForMedicalRecordException(
                'Referral is not valid for the selected appointment.',
            );
        }

        $payload['appointment_referral_id'] = $normalizedAppointmentReferralId;
    }

    private function applyTheatreProcedureValidationBaseline(
        array &$payload,
        string $patientId,
        mixed $appointmentId,
        mixed $admissionId,
        string $recordType,
    ): void {
        if (! array_key_exists('theatre_procedure_id', $payload)) {
            return;
        }

        $theatreProcedureId = $payload['theatre_procedure_id'];
        if ($theatreProcedureId === null) {
            return;
        }

        if ($recordType !== MedicalRecordNoteType::PROCEDURE_NOTE->value) {
            throw new TheatreProcedureNotEligibleForMedicalRecordException(
                'Only procedure notes can link to a theatre procedure record.',
            );
        }

        $normalizedTheatreProcedureId = trim((string) $theatreProcedureId);
        $theatreProcedure = $this->theatreProcedureLookupService->findById(
            $normalizedTheatreProcedureId,
        );

        if ($theatreProcedure === null || ($theatreProcedure['patient_id'] ?? null) !== $patientId) {
            throw new TheatreProcedureNotEligibleForMedicalRecordException(
                'Theatre procedure is not valid for the selected patient.',
            );
        }

        if (
            is_string($appointmentId)
            && trim($appointmentId) !== ''
            && ($theatreProcedure['appointment_id'] ?? null) !== trim($appointmentId)
        ) {
            throw new TheatreProcedureNotEligibleForMedicalRecordException(
                'Theatre procedure is not aligned to the selected appointment.',
            );
        }

        if (
            is_string($admissionId)
            && trim($admissionId) !== ''
            && ($theatreProcedure['admission_id'] ?? null) !== trim($admissionId)
        ) {
            throw new TheatreProcedureNotEligibleForMedicalRecordException(
                'Theatre procedure is not aligned to the selected admission.',
            );
        }

        $payload['theatre_procedure_id'] = $normalizedTheatreProcedureId;
    }

    private function generateRecordNumber(): string
    {
        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $candidate = 'MR'.now()->format('Ymd').strtoupper(Str::random(6));

            if (! $this->medicalRecordRepository->existsByRecordNumber($candidate)) {
                return $candidate;
            }
        }

        throw new RuntimeException('Unable to generate unique record number.');
    }

    /**
     * @param  array<string, mixed>  $appointment
     */
    private function assertConsultationOwnershipForEncounterWrite(array $appointment, ?int $actorId): void
    {
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
    private function extractTrackedFields(array $record): array
    {
        $tracked = [
            'record_number',
            'tenant_id',
            'facility_id',
            'patient_id',
            'admission_id',
            'appointment_id',
            'appointment_referral_id',
            'theatre_procedure_id',
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

        $result = [];
        foreach ($tracked as $field) {
            $result[$field] = $record[$field] ?? null;
        }

        return $result;
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
            'appointment_referral_id',
            'theatre_procedure_id',
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

    private function applyDiagnosisCodeValidationBaseline(array &$payload): void
    {
        if (! array_key_exists('diagnosis_code', $payload)) {
            return;
        }

        $diagnosisCode = $payload['diagnosis_code'];
        if ($diagnosisCode === null) {
            return;
        }

        $normalized = strtoupper(trim((string) $diagnosisCode));
        if ($normalized === '') {
            $payload['diagnosis_code'] = null;

            return;
        }

        if (! preg_match(self::ICD10_CODE_PATTERN, $normalized)) {
            throw new InvalidMedicalRecordDiagnosisCodeException(
                'Diagnosis code must use ICD-10 style format (for example: R52 or J11.1).',
            );
        }

        if (
            $this->diagnosisTerminologyLookupService->hasAnyActiveDiagnosisCodes()
            && ! $this->diagnosisTerminologyLookupService->isActiveDiagnosisCode($normalized)
        ) {
            throw new InvalidMedicalRecordDiagnosisCodeException(
                'Diagnosis code must match an active diagnosis terminology catalog entry.',
            );
        }

        $payload['diagnosis_code'] = $normalized;
    }
}
