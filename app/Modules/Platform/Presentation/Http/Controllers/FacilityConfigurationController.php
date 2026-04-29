<?php

namespace App\Modules\Platform\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Application\Exceptions\DuplicateFacilityCodeException;
use App\Modules\Platform\Application\Exceptions\TenantScopeRequiredForIsolationException;
use App\Modules\Platform\Domain\Repositories\TenantRepositoryInterface;
use App\Modules\Platform\Application\UseCases\CreateFacilityConfigurationUseCase;
use App\Modules\Platform\Application\UseCases\GetFacilityConfigurationUseCase;
use App\Modules\Platform\Application\UseCases\ListFacilityConfigurationAuditLogsUseCase;
use App\Modules\Platform\Application\UseCases\ListFacilityConfigurationsUseCase;
use App\Modules\Platform\Application\UseCases\SyncFacilityConfigurationOwnersUseCase;
use App\Modules\Platform\Application\UseCases\UpdateFacilityConfigurationStatusUseCase;
use App\Modules\Platform\Application\UseCases\UpdateFacilityConfigurationUseCase;
use App\Modules\Platform\Presentation\Http\Requests\StoreFacilityConfigurationRequest;
use App\Modules\Platform\Presentation\Http\Requests\SyncFacilityConfigurationOwnersRequest;
use App\Modules\Platform\Presentation\Http\Requests\UpdateFacilityConfigurationRequest;
use App\Modules\Platform\Presentation\Http\Requests\UpdateFacilityConfigurationStatusRequest;
use App\Modules\Platform\Presentation\Http\Transformers\FacilityConfigurationAuditLogResponseTransformer;
use App\Modules\Platform\Presentation\Http\Transformers\FacilityConfigurationResponseTransformer;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FacilityConfigurationController extends Controller
{
    private const AUDIT_CSV_SCHEMA_VERSION = 'audit-log-csv.v1';

    private const AUDIT_CSV_COLUMNS = ['createdAt', 'action', 'actorType', 'actorId', 'changes', 'metadata'];

    public function index(Request $request, ListFacilityConfigurationsUseCase $useCase): JsonResponse
    {
        $result = $useCase->execute($request->all());

        return response()->json([
            'data' => array_map([FacilityConfigurationResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function store(
        StoreFacilityConfigurationRequest $request,
        CreateFacilityConfigurationUseCase $useCase,
        TenantRepositoryInterface $tenantRepository
    ): JsonResponse {
        try {
            $facility = $useCase->execute(
                payload: $this->toStorePayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (DuplicateFacilityCodeException $exception) {
            return $this->validationError('facilityCode', $exception->getMessage());
        } catch (DomainException $exception) {
            return $this->validationError('facility', $exception->getMessage());
        }

        return response()->json([
            'data' => $this->transformFacility($facility, $tenantRepository),
        ], 201);
    }

    public function show(
        string $id,
        GetFacilityConfigurationUseCase $useCase,
        TenantRepositoryInterface $tenantRepository
    ): JsonResponse
    {
        $facility = $useCase->execute($id);
        abort_if($facility === null, 404, 'Facility not found.');

        return response()->json([
            'data' => $this->transformFacility($facility, $tenantRepository),
        ]);
    }

    public function update(
        string $id,
        UpdateFacilityConfigurationRequest $request,
        UpdateFacilityConfigurationUseCase $useCase,
        TenantRepositoryInterface $tenantRepository
    ): JsonResponse {
        try {
            $facility = $useCase->execute(
                id: $id,
                payload: $this->toConfigurationPayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (DuplicateFacilityCodeException $exception) {
            return $this->validationError('code', $exception->getMessage());
        }

        abort_if($facility === null, 404, 'Facility not found.');

        return response()->json([
            'data' => $this->transformFacility($facility, $tenantRepository),
        ]);
    }

    public function updateStatus(
        string $id,
        UpdateFacilityConfigurationStatusRequest $request,
        UpdateFacilityConfigurationStatusUseCase $useCase,
        TenantRepositoryInterface $tenantRepository
    ): JsonResponse {
        try {
            $facility = $useCase->execute(
                id: $id,
                status: $request->string('status')->value(),
                reason: $request->input('reason'),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (DomainException $exception) {
            return $this->validationError('status', $exception->getMessage());
        }

        abort_if($facility === null, 404, 'Facility not found.');

        return response()->json([
            'data' => $this->transformFacility($facility, $tenantRepository),
        ]);
    }

    public function syncOwners(
        string $id,
        SyncFacilityConfigurationOwnersRequest $request,
        SyncFacilityConfigurationOwnersUseCase $useCase,
        TenantRepositoryInterface $tenantRepository
    ): JsonResponse {
        try {
            $facility = $useCase->execute(
                id: $id,
                payload: $this->toOwnerPayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        }

        abort_if($facility === null, 404, 'Facility not found.');

        return response()->json([
            'data' => $this->transformFacility($facility, $tenantRepository),
        ]);
    }

    public function auditLogs(
        string $id,
        Request $request,
        ListFacilityConfigurationAuditLogsUseCase $useCase
    ): JsonResponse {
        $result = $useCase->execute($id, $request->all());
        abort_if($result === null, 404, 'Facility not found.');

        return response()->json([
            'data' => array_map([FacilityConfigurationAuditLogResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function exportAuditLogsCsv(
        string $id,
        Request $request,
        ListFacilityConfigurationAuditLogsUseCase $useCase
    ): JsonResponse|StreamedResponse {
        $filters = $request->all();
        $filters['page'] = 1;
        $filters['perPage'] = 100;

        $firstPage = $useCase->execute($id, $filters);
        abort_if($firstPage === null, 404, 'Facility not found.');

        $safeId = $this->safeExportIdentifier($id, 'facility');

        return $this->streamAuditLogCsvExport(
            baseName: sprintf('platform_facility_configuration_audit_%s_%s', $safeId, now()->format('Ymd_His')),
            firstPage: $firstPage,
            fetchPage: function (int $page) use ($useCase, $id, $filters): ?array {
                $pageFilters = $filters;
                $pageFilters['page'] = $page;

                return $useCase->execute($id, $pageFilters);
            },
        );
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function toConfigurationPayload(array $validated): array
    {
        $payload = [];

        if (array_key_exists('code', $validated)) {
            $payload['code'] = $validated['code'];
        }

        if (array_key_exists('name', $validated)) {
            $payload['name'] = $validated['name'];
        }

        if (array_key_exists('facilityType', $validated)) {
            $payload['facility_type'] = $validated['facilityType'];
        }

        if (array_key_exists('timezone', $validated)) {
            $payload['timezone'] = $validated['timezone'];
        }

        if (array_key_exists('tenantAllowedCountryCodes', $validated)) {
            $payload['tenant_allowed_country_codes'] = $validated['tenantAllowedCountryCodes'];
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function toStorePayload(array $validated): array
    {
        return [
            'tenant_code' => $validated['tenantCode'] ?? null,
            'tenant_name' => $validated['tenantName'] ?? null,
            'tenant_country_code' => $validated['tenantCountryCode'] ?? null,
            'tenant_allowed_country_codes' => $validated['tenantAllowedCountryCodes'] ?? null,
            'facility_code' => $validated['facilityCode'] ?? null,
            'facility_name' => $validated['facilityName'] ?? null,
            'facility_type' => $validated['facilityType'] ?? null,
            'facility_tier' => $validated['facilityTier'] ?? null,
            'timezone' => $validated['timezone'] ?? null,
            'facility_admin_user_id' => $validated['facilityAdminUserId'] ?? null,
        ];
    }

    private function transformFacility(array $facility, TenantRepositoryInterface $tenantRepository): array
    {
        $tenantId = trim((string) ($facility['tenant_id'] ?? ''));
        $tenant = $tenantId !== '' ? $tenantRepository->findById($tenantId) : null;

        $facility['tenant_code'] = $tenant['code'] ?? null;
        $facility['tenant_name'] = $tenant['name'] ?? null;
        $facility['tenant_country_code'] = $tenant['country_code'] ?? null;
        $facility['tenant_allowed_country_codes'] = $tenant['allowed_country_codes'] ?? null;

        return FacilityConfigurationResponseTransformer::transform($facility);
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function toOwnerPayload(array $validated): array
    {
        $payload = [];

        if (array_key_exists('operationsOwnerUserId', $validated)) {
            $payload['operations_owner_user_id'] = $validated['operationsOwnerUserId'];
        }

        if (array_key_exists('clinicalOwnerUserId', $validated)) {
            $payload['clinical_owner_user_id'] = $validated['clinicalOwnerUserId'];
        }

        if (array_key_exists('administrativeOwnerUserId', $validated)) {
            $payload['administrative_owner_user_id'] = $validated['administrativeOwnerUserId'];
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
