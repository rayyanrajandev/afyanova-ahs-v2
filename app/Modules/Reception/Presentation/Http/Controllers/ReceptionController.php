<?php

namespace App\Modules\Reception\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Admission\Presentation\Http\Transformers\AdmissionResponseTransformer;
use App\Modules\Appointment\Application\Exceptions\ActiveAppointmentConflictException;
use App\Modules\Appointment\Application\Exceptions\InvalidAppointmentStatusTransitionException;
use App\Modules\Appointment\Application\Exceptions\PatientActiveEncounterConflictException;
use App\Modules\Appointment\Application\Exceptions\PatientNotEligibleForAppointmentException;
use App\Modules\Appointment\Domain\ValueObjects\AppointmentStatus;
use App\Modules\Appointment\Presentation\Http\Transformers\AppointmentResponseTransformer;
use App\Modules\EmergencyTriage\Presentation\Http\Transformers\EmergencyTriageCaseResponseTransformer;
use App\Modules\Platform\Application\Exceptions\TenantScopeRequiredForIsolationException;
use App\Modules\Reception\Application\UseCases\CheckInUseCase;
use App\Modules\Reception\Application\UseCases\GetClinicianQueueStatusCountsUseCase;
use App\Modules\Reception\Application\UseCases\GetReceptionQueueStatusCountsUseCase;
use App\Modules\Reception\Application\UseCases\GetReceptionQueueUseCase;
use App\Modules\Reception\Application\UseCases\GetTriageCompletedTodayUseCase;
use App\Modules\Reception\Application\UseCases\GetTriageQueueStatusCountsUseCase;
use App\Modules\Reception\Application\UseCases\RegisterWalkInAndCheckInUseCase;
use App\Modules\Reception\Domain\ValueObjects\ArrivalMode;
use App\Modules\Reception\Presentation\Http\Requests\CheckInAppointmentRequest;
use App\Modules\Reception\Presentation\Http\Requests\RegisterWalkInRequest;
use App\Modules\Reception\Presentation\Http\Transformers\ReceptionQueueEntryResponseTransformer;
use App\Modules\Reception\Presentation\Http\Transformers\TriageCompletedEntryResponseTransformer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReceptionController extends Controller
{
    public function checkIn(
        string $id,
        CheckInAppointmentRequest $request,
        CheckInUseCase $useCase,
    ): JsonResponse {
        try {
            $appointment = $useCase->execute(
                appointmentId: $id,
                arrivalMode: ArrivalMode::SCHEDULED_CHECKIN->value,
                verificationNotes: $request->input('verificationNotes'),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredResponse($exception->getMessage());
        } catch (InvalidAppointmentStatusTransitionException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => 'APPOINTMENT_STATUS_TRANSITION_INVALID',
                'errors' => ['status' => [$exception->getMessage()]],
            ], 422);
        }

        abort_if($appointment === null, 404, 'Appointment not found.');

        return response()->json([
            'data' => AppointmentResponseTransformer::transform($appointment),
        ]);
    }

    public function registerWalkIn(
        RegisterWalkInRequest $request,
        RegisterWalkInAndCheckInUseCase $useCase,
    ): JsonResponse {
        try {
            $appointment = $useCase->execute(
                patientId: (string) $request->input('patientId'),
                arrivalMode: (string) $request->input('arrivalMode'),
                reason: $request->input('reason'),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredResponse($exception->getMessage());
        } catch (PatientNotEligibleForAppointmentException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => 'VALIDATION_ERROR',
                'errors' => ['patientId' => [$exception->getMessage()]],
            ], 422);
        } catch (ActiveAppointmentConflictException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => 'VALIDATION_ERROR',
                'errors' => ['patientId' => [$exception->getMessage()]],
                'data' => [
                    'activeAppointmentConflict' => AppointmentResponseTransformer::transform(
                        $exception->existingAppointment(),
                    ),
                ],
            ], 422);
        } catch (PatientActiveEncounterConflictException $exception) {
            $conflictType = $exception->conflictType();

            return response()->json([
                'message' => $exception->getMessage(),
                'code' => 'VALIDATION_ERROR',
                'errors' => ['patientId' => [$exception->getMessage()]],
                'data' => [
                    'activePatientEncounterConflict' => [
                        'conflictType' => $conflictType,
                        'record' => $conflictType === 'emergency_case'
                            ? EmergencyTriageCaseResponseTransformer::transform($exception->existingRecord())
                            : AdmissionResponseTransformer::transform($exception->existingRecord()),
                    ],
                ],
            ], 422);
        }

        abort_if($appointment === null, 404, 'Appointment not found.');

        return response()->json([
            'data' => AppointmentResponseTransformer::transform($appointment),
        ], 201);
    }

    public function queue(Request $request, GetReceptionQueueUseCase $useCase): JsonResponse
    {
        $request->validate([
            'stage' => [
                'required',
                Rule::in([
                    AppointmentStatus::WAITING_TRIAGE->value,
                    AppointmentStatus::WAITING_PROVIDER->value,
                    AppointmentStatus::IN_CONSULTATION->value,
                ]),
            ],
        ]);

        $result = $useCase->execute($request->all());

        return response()->json([
            'data' => array_map([ReceptionQueueEntryResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function queueStatusCounts(Request $request, GetReceptionQueueStatusCountsUseCase $useCase): JsonResponse
    {
        return response()->json([
            'data' => $useCase->execute($request->all()),
        ]);
    }

    public function triageQueueStatusCounts(GetTriageQueueStatusCountsUseCase $useCase): JsonResponse
    {
        return response()->json([
            'data' => $useCase->execute(),
        ]);
    }

    public function triageCompletedToday(Request $request, GetTriageCompletedTodayUseCase $useCase): JsonResponse
    {
        $result = $useCase->execute($request->all());

        return response()->json([
            'data' => array_map([TriageCompletedEntryResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function clinicianQueueStatusCounts(GetClinicianQueueStatusCountsUseCase $useCase): JsonResponse
    {
        return response()->json([
            'data' => $useCase->execute(),
        ]);
    }

    private function tenantScopeRequiredResponse(string $message): JsonResponse
    {
        return response()->json([
            'code' => 'TENANT_SCOPE_REQUIRED',
            'message' => $message,
        ], 403);
    }
}
