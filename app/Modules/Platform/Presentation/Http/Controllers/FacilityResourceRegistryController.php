<?php

namespace App\Modules\Platform\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Application\Exceptions\DuplicateFacilityResourceCodeException;
use App\Modules\Platform\Application\Exceptions\TenantScopeRequiredForIsolationException;
use App\Modules\Platform\Application\UseCases\CreateFacilityResourceUseCase;
use App\Modules\Platform\Application\UseCases\GetFacilityResourceUseCase;
use App\Modules\Platform\Application\UseCases\ListFacilityResourceAuditLogsUseCase;
use App\Modules\Platform\Application\UseCases\ListFacilityResourcesUseCase;
use App\Modules\Platform\Application\UseCases\ListFacilityResourceStatusCountsUseCase;
use App\Modules\Platform\Application\UseCases\UpdateFacilityResourceStatusUseCase;
use App\Modules\Platform\Application\UseCases\UpdateFacilityResourceUseCase;
use App\Modules\Platform\Domain\ValueObjects\FacilityResourceType;
use App\Modules\Platform\Presentation\Http\Requests\StoreServicePointRequest;
use App\Modules\Platform\Presentation\Http\Requests\StoreWardBedRequest;
use App\Modules\Platform\Presentation\Http\Requests\UpdateFacilityResourceStatusRequest;
use App\Modules\Platform\Presentation\Http\Requests\UpdateServicePointRequest;
use App\Modules\Platform\Presentation\Http\Requests\UpdateWardBedRequest;
use App\Modules\Platform\Presentation\Http\Transformers\FacilityResourceAuditLogResponseTransformer;
use App\Modules\Platform\Presentation\Http\Transformers\FacilityResourceResponseTransformer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FacilityResourceRegistryController extends Controller
{
    private const AUDIT_CSV_SCHEMA_VERSION = 'audit-log-csv.v1';

    private const AUDIT_CSV_COLUMNS = ['createdAt', 'action', 'actorType', 'actorId', 'changes', 'metadata'];

    public function servicePoints(Request $request, ListFacilityResourcesUseCase $useCase): JsonResponse
    {
        return $this->listResources(FacilityResourceType::SERVICE_POINT->value, $request, $useCase);
    }

    public function servicePointStatusCounts(
        Request $request,
        ListFacilityResourceStatusCountsUseCase $useCase
    ): JsonResponse {
        return $this->resourceStatusCounts(FacilityResourceType::SERVICE_POINT->value, $request, $useCase);
    }

    public function storeServicePoint(StoreServicePointRequest $request, CreateFacilityResourceUseCase $useCase): JsonResponse
    {
        return $this->storeResource(
            resourceType: FacilityResourceType::SERVICE_POINT->value,
            request: $request,
            useCase: $useCase,
            fieldMap: [
                'code' => 'code',
                'name' => 'name',
                'departmentId' => 'department_id',
                'servicePointType' => 'service_point_type',
                'location' => 'location',
                'notes' => 'notes',
            ],
        );
    }

    public function servicePoint(string $id, GetFacilityResourceUseCase $useCase): JsonResponse
    {
        return $this->showResource(FacilityResourceType::SERVICE_POINT->value, $id, $useCase);
    }

    public function updateServicePoint(
        string $id,
        UpdateServicePointRequest $request,
        UpdateFacilityResourceUseCase $useCase
    ): JsonResponse {
        return $this->updateResource(
            resourceType: FacilityResourceType::SERVICE_POINT->value,
            id: $id,
            request: $request,
            useCase: $useCase,
            fieldMap: [
                'code' => 'code',
                'name' => 'name',
                'departmentId' => 'department_id',
                'servicePointType' => 'service_point_type',
                'location' => 'location',
                'notes' => 'notes',
            ],
        );
    }

    public function updateServicePointStatus(
        string $id,
        UpdateFacilityResourceStatusRequest $request,
        UpdateFacilityResourceStatusUseCase $useCase
    ): JsonResponse {
        return $this->updateResourceStatus(FacilityResourceType::SERVICE_POINT->value, $id, $request, $useCase);
    }

    public function servicePointAuditLogs(
        string $id,
        Request $request,
        ListFacilityResourceAuditLogsUseCase $useCase
    ): JsonResponse {
        return $this->auditLogs(FacilityResourceType::SERVICE_POINT->value, $id, $request, $useCase);
    }

    public function exportServicePointAuditLogsCsv(
        string $id,
        Request $request,
        ListFacilityResourceAuditLogsUseCase $useCase
    ): StreamedResponse {
        return $this->exportAuditLogsCsv(FacilityResourceType::SERVICE_POINT->value, 'service-point', $id, $request, $useCase);
    }

    public function wardBeds(Request $request, ListFacilityResourcesUseCase $useCase): JsonResponse
    {
        return $this->listResources(FacilityResourceType::WARD_BED->value, $request, $useCase);
    }

    public function wardBedStatusCounts(
        Request $request,
        ListFacilityResourceStatusCountsUseCase $useCase
    ): JsonResponse {
        return $this->resourceStatusCounts(FacilityResourceType::WARD_BED->value, $request, $useCase);
    }

    public function storeWardBed(StoreWardBedRequest $request, CreateFacilityResourceUseCase $useCase): JsonResponse
    {
        return $this->storeResource(
            resourceType: FacilityResourceType::WARD_BED->value,
            request: $request,
            useCase: $useCase,
            fieldMap: [
                'code' => 'code',
                'name' => 'name',
                'departmentId' => 'department_id',
                'wardName' => 'ward_name',
                'bedNumber' => 'bed_number',
                'location' => 'location',
                'notes' => 'notes',
            ],
        );
    }

    public function wardBed(string $id, GetFacilityResourceUseCase $useCase): JsonResponse
    {
        return $this->showResource(FacilityResourceType::WARD_BED->value, $id, $useCase);
    }

    public function updateWardBed(
        string $id,
        UpdateWardBedRequest $request,
        UpdateFacilityResourceUseCase $useCase
    ): JsonResponse {
        return $this->updateResource(
            resourceType: FacilityResourceType::WARD_BED->value,
            id: $id,
            request: $request,
            useCase: $useCase,
            fieldMap: [
                'code' => 'code',
                'name' => 'name',
                'departmentId' => 'department_id',
                'wardName' => 'ward_name',
                'bedNumber' => 'bed_number',
                'location' => 'location',
                'notes' => 'notes',
            ],
        );
    }

    public function updateWardBedStatus(
        string $id,
        UpdateFacilityResourceStatusRequest $request,
        UpdateFacilityResourceStatusUseCase $useCase
    ): JsonResponse {
        return $this->updateResourceStatus(FacilityResourceType::WARD_BED->value, $id, $request, $useCase);
    }

    public function wardBedAuditLogs(
        string $id,
        Request $request,
        ListFacilityResourceAuditLogsUseCase $useCase
    ): JsonResponse {
        return $this->auditLogs(FacilityResourceType::WARD_BED->value, $id, $request, $useCase);
    }

    public function exportWardBedAuditLogsCsv(
        string $id,
        Request $request,
        ListFacilityResourceAuditLogsUseCase $useCase
    ): StreamedResponse {
        return $this->exportAuditLogsCsv(FacilityResourceType::WARD_BED->value, 'ward-bed', $id, $request, $useCase);
    }

    private function listResources(string $resourceType, Request $request, ListFacilityResourcesUseCase $useCase): JsonResponse
    {
        $result = $useCase->execute($resourceType, $request->all());

        return response()->json([
            'data' => array_map([FacilityResourceResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    private function resourceStatusCounts(
        string $resourceType,
        Request $request,
        ListFacilityResourceStatusCountsUseCase $useCase
    ): JsonResponse {
        $counts = $useCase->execute($resourceType, $request->all());

        return response()->json([
            'data' => $counts,
        ]);
    }

    private function storeResource(
        string $resourceType,
        Request $request,
        CreateFacilityResourceUseCase $useCase,
        array $fieldMap
    ): JsonResponse {
        try {
            $resource = $useCase->execute(
                resourceType: $resourceType,
                payload: $this->toPersistencePayload($request->validated(), $fieldMap),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (DuplicateFacilityResourceCodeException $exception) {
            return $this->validationError('code', $exception->getMessage());
        }

        return response()->json([
            'data' => FacilityResourceResponseTransformer::transform($resource),
        ], 201);
    }

    private function showResource(string $resourceType, string $id, GetFacilityResourceUseCase $useCase): JsonResponse
    {
        $resource = $useCase->execute($id, $resourceType);
        abort_if($resource === null, 404, 'Resource not found.');

        return response()->json([
            'data' => FacilityResourceResponseTransformer::transform($resource),
        ]);
    }

    private function updateResource(
        string $resourceType,
        string $id,
        Request $request,
        UpdateFacilityResourceUseCase $useCase,
        array $fieldMap
    ): JsonResponse {
        try {
            $resource = $useCase->execute(
                id: $id,
                resourceType: $resourceType,
                payload: $this->toPersistencePayload($request->validated(), $fieldMap),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (DuplicateFacilityResourceCodeException $exception) {
            return $this->validationError('code', $exception->getMessage());
        }

        abort_if($resource === null, 404, 'Resource not found.');

        return response()->json([
            'data' => FacilityResourceResponseTransformer::transform($resource),
        ]);
    }

    private function updateResourceStatus(
        string $resourceType,
        string $id,
        UpdateFacilityResourceStatusRequest $request,
        UpdateFacilityResourceStatusUseCase $useCase
    ): JsonResponse {
        try {
            $resource = $useCase->execute(
                id: $id,
                resourceType: $resourceType,
                status: $request->string('status')->value(),
                reason: $request->input('reason'),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        }

        abort_if($resource === null, 404, 'Resource not found.');

        return response()->json([
            'data' => FacilityResourceResponseTransformer::transform($resource),
        ]);
    }

    private function auditLogs(
        string $resourceType,
        string $id,
        Request $request,
        ListFacilityResourceAuditLogsUseCase $useCase
    ): JsonResponse {
        $result = $useCase->execute(
            resourceId: $id,
            resourceType: $resourceType,
            filters: $request->all(),
        );
        abort_if($result === null, 404, 'Resource not found.');

        return response()->json([
            'data' => array_map([FacilityResourceAuditLogResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    private function exportAuditLogsCsv(
        string $resourceType,
        string $resourceLabel,
        string $id,
        Request $request,
        ListFacilityResourceAuditLogsUseCase $useCase
    ): StreamedResponse {
        $filters = $request->all();
        $filters['page'] = 1;
        $filters['perPage'] = 100;

        $firstPage = $useCase->execute(
            resourceId: $id,
            resourceType: $resourceType,
            filters: $filters,
        );
        abort_if($firstPage === null, 404, 'Resource not found.');

        $safeId = $this->safeExportIdentifier($id, $resourceLabel);

        return $this->streamAuditLogCsvExport(
            baseName: sprintf(
                '%s_audit_%s_%s',
                str_replace('-', '_', $resourceLabel),
                $safeId,
                now()->format('Ymd_His'),
            ),
            firstPage: $firstPage,
            fetchPage: function (int $page) use ($useCase, $resourceType, $id, $filters): ?array {
                $pageFilters = $filters;
                $pageFilters['page'] = $page;

                return $useCase->execute(
                    resourceId: $id,
                    resourceType: $resourceType,
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

    private function toPersistencePayload(array $validated, array $fieldMap): array
    {
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
