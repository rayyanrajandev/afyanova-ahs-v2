<?php

namespace App\Modules\MedicalRecord\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\MedicalRecord\Application\Exceptions\AdmissionNotEligibleForMedicalRecordException;
use App\Modules\MedicalRecord\Application\Exceptions\AppointmentNotEligibleForMedicalRecordException;
use App\Modules\MedicalRecord\Application\Exceptions\AppointmentReferralNotEligibleForMedicalRecordException;
use App\Modules\MedicalRecord\Application\Exceptions\ConsultationOwnerConflictForMedicalRecordException;
use App\Modules\MedicalRecord\Application\Exceptions\DuplicateEncounterDraftMedicalRecordException;
use App\Modules\MedicalRecord\Application\Exceptions\InvalidMedicalRecordDiagnosisCodeException;
use App\Modules\MedicalRecord\Application\Exceptions\InvalidMedicalRecordTypeException;
use App\Modules\MedicalRecord\Application\Exceptions\MedicalRecordContentLockedException;
use App\Modules\MedicalRecord\Application\Exceptions\InvalidMedicalRecordVersionComparisonException;
use App\Modules\MedicalRecord\Application\Exceptions\MedicalRecordSignerAttestationNotAllowedException;
use App\Modules\MedicalRecord\Application\Exceptions\PatientNotEligibleForMedicalRecordException;
use App\Modules\MedicalRecord\Application\Exceptions\TheatreProcedureNotEligibleForMedicalRecordException;
use App\Modules\MedicalRecord\Application\UseCases\CreateMedicalRecordSignerAttestationUseCase;
use App\Modules\MedicalRecord\Application\UseCases\CreateMedicalRecordUseCase;
use App\Modules\MedicalRecord\Application\UseCases\GetMedicalRecordUseCase;
use App\Modules\MedicalRecord\Application\UseCases\GetMedicalRecordVersionDiffUseCase;
use App\Modules\MedicalRecord\Application\UseCases\ListMedicalRecordAuditLogsUseCase;
use App\Modules\MedicalRecord\Application\UseCases\ListMedicalRecordsUseCase;
use App\Modules\MedicalRecord\Application\UseCases\ListMedicalRecordSignerAttestationsUseCase;
use App\Modules\MedicalRecord\Application\UseCases\ListMedicalRecordStatusCountsUseCase;
use App\Modules\MedicalRecord\Application\UseCases\ListMedicalRecordVersionsUseCase;
use App\Modules\MedicalRecord\Application\UseCases\UpdateMedicalRecordStatusUseCase;
use App\Modules\MedicalRecord\Application\UseCases\UpdateMedicalRecordUseCase;
use App\Modules\MedicalRecord\Presentation\Http\Requests\ShowMedicalRecordVersionDiffRequest;
use App\Modules\MedicalRecord\Presentation\Http\Requests\StoreMedicalRecordSignerAttestationRequest;
use App\Modules\MedicalRecord\Presentation\Http\Requests\StoreMedicalRecordRequest;
use App\Modules\MedicalRecord\Presentation\Http\Requests\UpdateMedicalRecordRequest;
use App\Modules\MedicalRecord\Presentation\Http\Requests\UpdateMedicalRecordStatusRequest;
use App\Modules\MedicalRecord\Presentation\Http\Transformers\MedicalRecordAuditLogResponseTransformer;
use App\Modules\MedicalRecord\Presentation\Http\Transformers\MedicalRecordResponseTransformer;
use App\Modules\MedicalRecord\Presentation\Http\Transformers\MedicalRecordSignerAttestationResponseTransformer;
use App\Modules\MedicalRecord\Presentation\Http\Transformers\MedicalRecordVersionDiffResponseTransformer;
use App\Modules\MedicalRecord\Presentation\Http\Transformers\MedicalRecordVersionResponseTransformer;
use App\Modules\Platform\Application\Exceptions\TenantScopeRequiredForIsolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MedicalRecordController extends Controller
{
    private const AUDIT_CSV_SCHEMA_VERSION = 'audit-log-csv.v1';

    private const AUDIT_CSV_COLUMNS = ['createdAt', 'action', 'actorType', 'actorId', 'changes', 'metadata'];

    public function index(Request $request, ListMedicalRecordsUseCase $useCase): JsonResponse
    {
        $result = $useCase->execute($request->all());

        return response()->json([
            'data' => array_map([MedicalRecordResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function statusCounts(Request $request, ListMedicalRecordStatusCountsUseCase $useCase): JsonResponse
    {
        $counts = $useCase->execute($request->all());

        return response()->json([
            'data' => $counts,
        ]);
    }

    public function store(StoreMedicalRecordRequest $request, CreateMedicalRecordUseCase $useCase): JsonResponse
    {
        try {
            $record = $useCase->execute(
                payload: $this->toPersistencePayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (ConsultationOwnerConflictForMedicalRecordException $exception) {
            return $this->consultationOwnerConflictError($exception->ownerUserId());
        } catch (PatientNotEligibleForMedicalRecordException $exception) {
            return $this->validationError('patientId', $exception->getMessage());
        } catch (AppointmentNotEligibleForMedicalRecordException $exception) {
            return $this->validationError('appointmentId', $exception->getMessage());
        } catch (AdmissionNotEligibleForMedicalRecordException $exception) {
            return $this->validationError('admissionId', $exception->getMessage());
        } catch (AppointmentReferralNotEligibleForMedicalRecordException $exception) {
            return $this->validationError('appointmentReferralId', $exception->getMessage());
        } catch (TheatreProcedureNotEligibleForMedicalRecordException $exception) {
            return $this->validationError('theatreProcedureId', $exception->getMessage());
        } catch (DuplicateEncounterDraftMedicalRecordException $exception) {
            return $this->validationError('appointmentId', $exception->getMessage());
        } catch (InvalidMedicalRecordTypeException $exception) {
            return $this->validationError('recordType', $exception->getMessage());
        } catch (InvalidMedicalRecordDiagnosisCodeException $exception) {
            return $this->validationError('diagnosisCode', $exception->getMessage());
        }

        return response()->json([
            'data' => MedicalRecordResponseTransformer::transform($record),
        ], 201);
    }

    public function show(string $id, GetMedicalRecordUseCase $useCase): JsonResponse
    {
        $record = $useCase->execute($id);
        abort_if($record === null, 404, 'Medical record not found.');

        return response()->json([
            'data' => MedicalRecordResponseTransformer::transform($record),
        ]);
    }

    public function update(string $id, UpdateMedicalRecordRequest $request, UpdateMedicalRecordUseCase $useCase): JsonResponse
    {
        try {
            $record = $useCase->execute(
                id: $id,
                payload: $this->toPersistencePayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (ConsultationOwnerConflictForMedicalRecordException $exception) {
            return $this->consultationOwnerConflictError($exception->ownerUserId());
        } catch (PatientNotEligibleForMedicalRecordException $exception) {
            return $this->validationError('patientId', $exception->getMessage());
        } catch (AppointmentNotEligibleForMedicalRecordException $exception) {
            return $this->validationError('appointmentId', $exception->getMessage());
        } catch (AdmissionNotEligibleForMedicalRecordException $exception) {
            return $this->validationError('admissionId', $exception->getMessage());
        } catch (AppointmentReferralNotEligibleForMedicalRecordException $exception) {
            return $this->validationError('appointmentReferralId', $exception->getMessage());
        } catch (TheatreProcedureNotEligibleForMedicalRecordException $exception) {
            return $this->validationError('theatreProcedureId', $exception->getMessage());
        } catch (MedicalRecordContentLockedException $exception) {
            return $this->validationError('payload', $exception->getMessage());
        } catch (InvalidMedicalRecordTypeException $exception) {
            return $this->validationError('recordType', $exception->getMessage());
        } catch (InvalidMedicalRecordDiagnosisCodeException $exception) {
            return $this->validationError('diagnosisCode', $exception->getMessage());
        }

        abort_if($record === null, 404, 'Medical record not found.');

        return response()->json([
            'data' => MedicalRecordResponseTransformer::transform($record),
        ]);
    }

    public function updateStatus(
        string $id,
        UpdateMedicalRecordStatusRequest $request,
        UpdateMedicalRecordStatusUseCase $useCase
    ): JsonResponse {
        try {
            $record = $useCase->execute(
                id: $id,
                status: $request->string('status')->value(),
                reason: $request->input('reason'),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (ConsultationOwnerConflictForMedicalRecordException $exception) {
            return $this->consultationOwnerConflictError($exception->ownerUserId());
        }

        abort_if($record === null, 404, 'Medical record not found.');

        return response()->json([
            'data' => MedicalRecordResponseTransformer::transform($record),
        ]);
    }

    public function auditLogs(string $id, Request $request, ListMedicalRecordAuditLogsUseCase $useCase): JsonResponse
    {
        $result = $useCase->execute(medicalRecordId: $id, filters: $request->all());
        abort_if($result === null, 404, 'Medical record not found.');

        return response()->json([
            'data' => array_map([MedicalRecordAuditLogResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function versions(string $id, Request $request, ListMedicalRecordVersionsUseCase $useCase): JsonResponse
    {
        $result = $useCase->execute(
            medicalRecordId: $id,
            filters: $request->all(),
        );
        abort_if($result === null, 404, 'Medical record not found.');

        return response()->json([
            'data' => array_map([MedicalRecordVersionResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function versionDiff(
        string $id,
        string $versionId,
        ShowMedicalRecordVersionDiffRequest $request,
        GetMedicalRecordVersionDiffUseCase $useCase
    ): JsonResponse {
        try {
            $result = $useCase->execute(
                medicalRecordId: $id,
                versionId: $versionId,
                againstVersionId: $request->validated('againstVersionId'),
            );
        } catch (InvalidMedicalRecordVersionComparisonException $exception) {
            return $this->validationError('againstVersionId', $exception->getMessage());
        }

        abort_if($result === null, 404, 'Medical record version not found.');

        return response()->json([
            'data' => MedicalRecordVersionDiffResponseTransformer::transform($result),
        ]);
    }

    public function signerAttestations(
        string $id,
        Request $request,
        ListMedicalRecordSignerAttestationsUseCase $useCase
    ): JsonResponse {
        $result = $useCase->execute(
            medicalRecordId: $id,
            filters: $request->all(),
        );
        abort_if($result === null, 404, 'Medical record not found.');

        return response()->json([
            'data' => array_map([MedicalRecordSignerAttestationResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function storeSignerAttestation(
        string $id,
        StoreMedicalRecordSignerAttestationRequest $request,
        CreateMedicalRecordSignerAttestationUseCase $useCase
    ): JsonResponse {
        try {
            $created = $useCase->execute(
                medicalRecordId: $id,
                attestationNote: $request->string('attestationNote')->value(),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (MedicalRecordSignerAttestationNotAllowedException $exception) {
            return $this->validationError('attestationNote', $exception->getMessage());
        }

        abort_if($created === null, 404, 'Medical record not found.');

        return response()->json([
            'data' => MedicalRecordSignerAttestationResponseTransformer::transform($created),
        ], 201);
    }

    public function exportAuditLogsCsv(
        string $id,
        Request $request,
        ListMedicalRecordAuditLogsUseCase $useCase
    ): StreamedResponse {
        $filters = $request->all();
        $filters['page'] = 1;
        $filters['perPage'] = 100;

        $firstPage = $useCase->execute(
            medicalRecordId: $id,
            filters: $filters,
        );
        abort_if($firstPage === null, 404, 'Medical record not found.');

        $safeId = $this->safeExportIdentifier($id, 'medical-record');

        return $this->streamAuditLogCsvExport(
            baseName: sprintf('medical_record_audit_%s_%s', $safeId, now()->format('Ymd_His')),
            firstPage: $firstPage,
            fetchPage: function (int $page) use ($useCase, $id, $filters): ?array {
                $pageFilters = $filters;
                $pageFilters['page'] = $page;

                return $useCase->execute(
                    medicalRecordId: $id,
                    filters: $pageFilters,
                );
            },
        );
    }

    private function validationError(string $field, string $message): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'code' => 'VALIDATION_ERROR',
            'errors' => [
                $field => [$message],
            ],
        ], 422);
    }

    private function tenantScopeRequiredError(string $message): JsonResponse
    {
        return response()->json([
            'code' => 'TENANT_SCOPE_REQUIRED',
            'message' => $message,
        ], 403);
    }

    private function consultationOwnerConflictError(int $ownerUserId): JsonResponse
    {
        return response()->json([
            'message' => 'This consultation is currently owned by another clinician. Confirm takeover to continue.',
            'code' => 'CONSULTATION_OWNER_CONFLICT',
            'errors' => [
                'forceTakeover' => ['Consultation ownership confirmation is required before takeover.'],
            ],
            'context' => [
                'consultationOwnerUserId' => $ownerUserId,
                'takeoverAllowed' => true,
            ],
        ], 409);
    }

    private function toPersistencePayload(array $validated): array
    {
        $fieldMap = [
            'patientId' => 'patient_id',
            'admissionId' => 'admission_id',
            'appointmentId' => 'appointment_id',
            'appointmentReferralId' => 'appointment_referral_id',
            'theatreProcedureId' => 'theatre_procedure_id',
            'authorUserId' => 'author_user_id',
            'encounterAt' => 'encounter_at',
            'recordType' => 'record_type',
            'subjective' => 'subjective',
            'objective' => 'objective',
            'assessment' => 'assessment',
            'plan' => 'plan',
            'diagnosisCode' => 'diagnosis_code',
        ];

        $payload = [];

        foreach ($fieldMap as $requestKey => $storageKey) {
            if (! array_key_exists($requestKey, $validated)) {
                continue;
            }

            $payload[$storageKey] = $validated[$requestKey];
        }

        return $payload;
    }
}
