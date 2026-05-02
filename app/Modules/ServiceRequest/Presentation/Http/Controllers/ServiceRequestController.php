<?php

namespace App\Modules\ServiceRequest\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Application\Exceptions\TenantScopeRequiredForIsolationException;
use App\Modules\ServiceRequest\Application\Exceptions\PatientNotEligibleForServiceRequestException;
use App\Modules\ServiceRequest\Application\Exceptions\ServiceRequestStatusTransitionException;
use App\Modules\ServiceRequest\Application\UseCases\CreateServiceRequestUseCase;
use App\Modules\ServiceRequest\Application\UseCases\GetServiceRequestUseCase;
use App\Modules\ServiceRequest\Application\UseCases\ListServiceRequestsUseCase;
use App\Modules\ServiceRequest\Application\UseCases\ListServiceRequestStatusCountsUseCase;
use App\Modules\ServiceRequest\Application\UseCases\UpdateServiceRequestStatusUseCase;
use App\Modules\ServiceRequest\Presentation\Http\Requests\StoreServiceRequestRequest;
use App\Modules\ServiceRequest\Presentation\Http\Requests\UpdateServiceRequestStatusRequest;
use App\Modules\ServiceRequest\Presentation\Http\Transformers\ServiceRequestResponseTransformer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceRequestController extends Controller
{
    public function index(Request $request, ListServiceRequestsUseCase $useCase): JsonResponse
    {
        $result = $useCase->execute($request->all());

        return response()->json([
            'data' => array_map([ServiceRequestResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function statusCounts(Request $request, ListServiceRequestStatusCountsUseCase $useCase): JsonResponse
    {
        $counts = $useCase->execute($request->all());

        return response()->json([
            'data' => $counts,
        ]);
    }

    public function store(StoreServiceRequestRequest $request, CreateServiceRequestUseCase $useCase): JsonResponse
    {
        try {
            $serviceRequest = $useCase->execute(
                payload: $this->toPersistencePayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (PatientNotEligibleForServiceRequestException $exception) {
            return $this->validationError('patientId', $exception->getMessage());
        }

        return response()->json([
            'data' => ServiceRequestResponseTransformer::transform($serviceRequest),
        ], 201);
    }

    public function show(string $id, GetServiceRequestUseCase $useCase): JsonResponse
    {
        $serviceRequest = $useCase->execute($id);
        abort_if($serviceRequest === null, 404, 'Service request not found.');

        return response()->json([
            'data' => ServiceRequestResponseTransformer::transform($serviceRequest),
        ]);
    }

    public function updateStatus(
        string $id,
        UpdateServiceRequestStatusRequest $request,
        UpdateServiceRequestStatusUseCase $useCase
    ): JsonResponse {
        try {
            $serviceRequest = $useCase->execute(
                id: $id,
                newStatus: $request->string('status')->value(),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (ServiceRequestStatusTransitionException $exception) {
            return $this->validationError('status', $exception->getMessage());
        }

        abort_if($serviceRequest === null, 404, 'Service request not found.');

        return response()->json([
            'data' => ServiceRequestResponseTransformer::transform($serviceRequest),
        ]);
    }

    /**
     * @param array<string, mixed> $validated
     * @return array<string, mixed>
     */
    private function toPersistencePayload(array $validated): array
    {
        $fieldMap = [
            'patientId' => 'patient_id',
            'serviceType' => 'service_type',
            'priority' => 'priority',
            'notes' => 'notes',
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
}
