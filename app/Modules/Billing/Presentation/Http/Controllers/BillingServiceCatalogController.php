<?php

namespace App\Modules\Billing\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Billing\Application\Exceptions\DuplicateBillingServiceCatalogCodeException;
use App\Modules\Billing\Application\Exceptions\InvalidBillingServiceCatalogClinicalLinkException;
use App\Modules\Billing\Application\UseCases\CreateBillingServiceCatalogItemRevisionUseCase;
use App\Modules\Billing\Application\UseCases\CreateBillingServiceCatalogItemUseCase;
use App\Modules\Billing\Application\UseCases\GetBillingServiceCatalogItemPayerImpactUseCase;
use App\Modules\Billing\Application\UseCases\GetBillingServiceCatalogItemUseCase;
use App\Modules\Billing\Application\UseCases\ListBillingServiceCatalogItemAuditLogsUseCase;
use App\Modules\Billing\Application\UseCases\ListBillingServiceCatalogItemsUseCase;
use App\Modules\Billing\Application\UseCases\ListBillingServiceCatalogItemStatusCountsUseCase;
use App\Modules\Billing\Application\UseCases\ListBillingServiceCatalogItemVersionsUseCase;
use App\Modules\Billing\Application\UseCases\UpdateBillingServiceCatalogItemStatusUseCase;
use App\Modules\Billing\Application\UseCases\UpdateBillingServiceCatalogItemUseCase;
use App\Modules\Billing\Presentation\Http\Requests\StoreBillingServiceCatalogItemRequest;
use App\Modules\Billing\Presentation\Http\Requests\StoreBillingServiceCatalogItemRevisionRequest;
use App\Modules\Billing\Presentation\Http\Requests\UpdateBillingServiceCatalogItemRequest;
use App\Modules\Billing\Presentation\Http\Requests\UpdateBillingServiceCatalogItemStatusRequest;
use App\Modules\Billing\Presentation\Http\Transformers\BillingServiceCatalogItemAuditLogResponseTransformer;
use App\Modules\Billing\Presentation\Http\Transformers\BillingServiceCatalogItemResponseTransformer;
use App\Modules\Platform\Application\Exceptions\TenantScopeRequiredForIsolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BillingServiceCatalogController extends Controller
{
    private const AUDIT_CSV_SCHEMA_VERSION = 'audit-log-csv.v1';

    private const AUDIT_CSV_COLUMNS = ['createdAt', 'action', 'actorType', 'actorId', 'changes', 'metadata'];

    public function index(Request $request, ListBillingServiceCatalogItemsUseCase $useCase): JsonResponse
    {
        $result = $useCase->execute($request->all());

        return response()->json([
            'data' => array_map([BillingServiceCatalogItemResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function statusCounts(
        Request $request,
        ListBillingServiceCatalogItemStatusCountsUseCase $useCase
    ): JsonResponse {
        $counts = $useCase->execute($request->all());

        return response()->json([
            'data' => $counts,
        ]);
    }

    public function store(
        StoreBillingServiceCatalogItemRequest $request,
        CreateBillingServiceCatalogItemUseCase $useCase
    ): JsonResponse {
        try {
            $item = $useCase->execute(
                payload: $this->toPersistencePayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (DuplicateBillingServiceCatalogCodeException $exception) {
            return $this->validationError('serviceCode', $exception->getMessage());
        } catch (InvalidBillingServiceCatalogClinicalLinkException $exception) {
            return $this->validationError($exception->field(), $exception->getMessage());
        } catch (\InvalidArgumentException $exception) {
            return $this->validationError('departmentId', $exception->getMessage());
        }

        return response()->json([
            'data' => BillingServiceCatalogItemResponseTransformer::transform($item),
        ], 201);
    }

    public function show(string $id, GetBillingServiceCatalogItemUseCase $useCase): JsonResponse
    {
        $item = $useCase->execute($id);
        abort_if($item === null, 404, 'Billing service catalog item not found.');

        return response()->json([
            'data' => BillingServiceCatalogItemResponseTransformer::transform($item),
        ]);
    }

    public function storeRevision(
        string $id,
        StoreBillingServiceCatalogItemRevisionRequest $request,
        CreateBillingServiceCatalogItemRevisionUseCase $useCase
    ): JsonResponse {
        try {
            $item = $useCase->execute(
                sourceId: $id,
                payload: $this->toPersistencePayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (\InvalidArgumentException $exception) {
            return $this->validationError('effectiveFrom', $exception->getMessage());
        }

        abort_if($item === null, 404, 'Billing service catalog item not found.');

        return response()->json([
            'data' => BillingServiceCatalogItemResponseTransformer::transform($item),
        ], 201);
    }

    public function update(
        string $id,
        UpdateBillingServiceCatalogItemRequest $request,
        UpdateBillingServiceCatalogItemUseCase $useCase
    ): JsonResponse {
        try {
            $item = $useCase->execute(
                id: $id,
                payload: $this->toPersistencePayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (DuplicateBillingServiceCatalogCodeException $exception) {
            return $this->validationError('serviceCode', $exception->getMessage());
        } catch (InvalidBillingServiceCatalogClinicalLinkException $exception) {
            return $this->validationError($exception->field(), $exception->getMessage());
        } catch (\InvalidArgumentException $exception) {
            return $this->validationError('departmentId', $exception->getMessage());
        }

        abort_if($item === null, 404, 'Billing service catalog item not found.');

        return response()->json([
            'data' => BillingServiceCatalogItemResponseTransformer::transform($item),
        ]);
    }

    public function updateStatus(
        string $id,
        UpdateBillingServiceCatalogItemStatusRequest $request,
        UpdateBillingServiceCatalogItemStatusUseCase $useCase
    ): JsonResponse {
        try {
            $item = $useCase->execute(
                id: $id,
                status: $request->string('status')->value(),
                reason: $request->input('reason'),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        }

        abort_if($item === null, 404, 'Billing service catalog item not found.');

        return response()->json([
            'data' => BillingServiceCatalogItemResponseTransformer::transform($item),
        ]);
    }

    public function auditLogs(
        string $id,
        Request $request,
        ListBillingServiceCatalogItemAuditLogsUseCase $useCase
    ): JsonResponse {
        $result = $useCase->execute(billingServiceCatalogItemId: $id, filters: $request->all());
        abort_if($result === null, 404, 'Billing service catalog item not found.');

        return response()->json([
            'data' => array_map([BillingServiceCatalogItemAuditLogResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function versions(
        string $id,
        ListBillingServiceCatalogItemVersionsUseCase $useCase
    ): JsonResponse {
        $result = $useCase->execute($id);
        abort_if($result === null, 404, 'Billing service catalog item not found.');

        return response()->json([
            'data' => array_map([BillingServiceCatalogItemResponseTransformer::class, 'transform'], $result),
        ]);
    }

    public function payerImpact(
        string $id,
        GetBillingServiceCatalogItemPayerImpactUseCase $useCase
    ): JsonResponse {
        $result = $useCase->execute($id);
        abort_if($result === null, 404, 'Billing service catalog item not found.');

        return response()->json([
            'data' => $result,
        ]);
    }

    public function exportAuditLogsCsv(
        string $id,
        Request $request,
        ListBillingServiceCatalogItemAuditLogsUseCase $useCase
    ): StreamedResponse {
        $filters = $request->all();
        $filters['page'] = 1;
        $filters['perPage'] = 100;

        $firstPage = $useCase->execute(
            billingServiceCatalogItemId: $id,
            filters: $filters,
        );
        abort_if($firstPage === null, 404, 'Billing service catalog item not found.');

        $safeId = $this->safeExportIdentifier($id, 'billing-service-catalog-item');

        return $this->streamAuditLogCsvExport(
            baseName: sprintf('billing_service_catalog_audit_%s_%s', $safeId, now()->format('Ymd_His')),
            firstPage: $firstPage,
            fetchPage: function (int $page) use ($useCase, $id, $filters): ?array {
                $pageFilters = $filters;
                $pageFilters['page'] = $page;

                return $useCase->execute(
                    billingServiceCatalogItemId: $id,
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

    private function toPersistencePayload(array $validated): array
    {
        $fieldMap = [
            'serviceCode' => 'service_code',
            'serviceName' => 'service_name',
            'serviceType' => 'service_type',
            'clinicalCatalogItemId' => 'clinical_catalog_item_id',
            'facilityTier' => 'facility_tier',
            'departmentId' => 'department_id',
            'department' => 'department',
            'unit' => 'unit',
            'basePrice' => 'base_price',
            'currencyCode' => 'currency_code',
            'taxRatePercent' => 'tax_rate_percent',
            'isTaxable' => 'is_taxable',
            'effectiveFrom' => 'effective_from',
            'effectiveTo' => 'effective_to',
            'description' => 'description',
            'metadata' => 'metadata',
            'codes' => 'codes',
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
