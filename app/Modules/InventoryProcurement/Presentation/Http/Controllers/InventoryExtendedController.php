<?php

namespace App\Modules\InventoryProcurement\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Department\Infrastructure\Models\DepartmentModel;
use App\Modules\InventoryProcurement\Application\Exceptions\InventoryItemNotFoundException;
use App\Modules\InventoryProcurement\Application\Exceptions\InventoryProcurementWorkflowException;
use App\Modules\InventoryProcurement\Application\Exceptions\InventoryStockOperationValidationException;
use App\Modules\InventoryProcurement\Application\UseCases\CreateDispensingClaimLinkUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\CreateInventoryBatchUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\CreateInventoryDepartmentRequisitionUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\CreateMsdOrderUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\CreateWarehouseTransferUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\GetInventoryDepartmentRequisitionUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\GetSupplierPerformanceUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\ListInventoryBatchesUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\GetShortageQueueUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\ListInventoryDepartmentRequisitionsUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\RecordSupplierDeliveryUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\RecordSupplierLeadTimeUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\SyncMsdOrderStatusUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\UpdateDispensingClaimStatusUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\UpdateInventoryDepartmentRequisitionStatusUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\UpdateWarehouseTransferStatusUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\UpdateWarehouseTransferVarianceReviewUseCase;
use App\Modules\InventoryProcurement\Application\Services\DepartmentRequisitionScopeResolver;
use App\Modules\InventoryProcurement\Domain\Repositories\InventoryDispensingClaimLinkRepositoryInterface;
use App\Modules\InventoryProcurement\Domain\Repositories\InventoryMsdOrderRepositoryInterface;
use App\Modules\InventoryProcurement\Domain\Repositories\InventorySupplierLeadTimeRepositoryInterface;
use App\Modules\InventoryProcurement\Domain\Repositories\InventoryWarehouseTransferRepositoryInterface;
use App\Modules\InventoryProcurement\Domain\Services\MsdApiClientInterface;
use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryDispensingClaimStatus;
use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryItemCategory;
use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryMsdOrderStatus;
use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryVenClassification;
use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryWarehouseTransferReceiptVarianceType;
use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryWarehouseTransferStatus;
use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryWarehouseTransferVarianceReviewStatus;
use App\Modules\InventoryProcurement\Infrastructure\Models\InventoryStockMovementModel;
use App\Modules\InventoryProcurement\Infrastructure\Models\InventoryWarehouseModel;
use App\Modules\InventoryProcurement\Presentation\Http\Requests\StoreInventoryBatchRequest;
use App\Modules\InventoryProcurement\Presentation\Http\Requests\StoreInventoryDepartmentRequisitionRequest;
use App\Modules\InventoryProcurement\Presentation\Http\Requests\UpdateInventoryDepartmentRequisitionStatusRequest;
use App\Modules\InventoryProcurement\Presentation\Http\Transformers\InventoryBatchResponseTransformer;
use App\Modules\InventoryProcurement\Presentation\Http\Transformers\InventoryDepartmentRequisitionResponseTransformer;
use App\Modules\InventoryProcurement\Presentation\Http\Transformers\InventoryProcurementRequestResponseTransformer;
use App\Modules\InventoryProcurement\Presentation\Http\Transformers\InventoryWarehouseTransferResponseTransformer;
use App\Modules\Platform\Application\Exceptions\TenantScopeRequiredForIsolationException;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogItemStatus;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Support\PlatformScopeQueryApplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryExtendedController extends Controller
{
    // ─── Batches ──────────────────────────────────────────────

    public function batches(Request $request, ListInventoryBatchesUseCase $useCase): JsonResponse
    {
        $result = $useCase->execute($request->all());

        return response()->json([
            'data' => array_map([InventoryBatchResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function storeBatch(StoreInventoryBatchRequest $request, CreateInventoryBatchUseCase $useCase): JsonResponse
    {
        try {
            $batch = $useCase->execute(
                payload: $this->toBatchPayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return response()->json(['message' => $exception->getMessage()], 403);
        } catch (InventoryItemNotFoundException $exception) {
            return response()->json(['message' => $exception->getMessage()], 404);
        }

        return response()->json([
            'data' => InventoryBatchResponseTransformer::transform($batch),
        ], 201);
    }

    // ─── Department Requisitions ──────────────────────────────

    public function departmentRequisitions(
        Request $request,
        ListInventoryDepartmentRequisitionsUseCase $useCase,
        DepartmentRequisitionScopeResolver $departmentScopeResolver,
    ): JsonResponse
    {
        $filters = $request->all();
        $context = $departmentScopeResolver->contextForUser($request->user());
        if (! (bool) ($context['canSelectAnyDepartment'] ?? false)) {
            $filters['departmentId'] = $context['lockedDepartment']['id'] ?? '__unassigned_department__';
            unset($filters['department']);
        }

        $result = $useCase->execute($filters);

        return response()->json([
            'data' => array_map([InventoryDepartmentRequisitionResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function storeDepartmentRequisition(
        StoreInventoryDepartmentRequisitionRequest $request,
        CreateInventoryDepartmentRequisitionUseCase $useCase,
        DepartmentRequisitionScopeResolver $departmentScopeResolver,
    ): JsonResponse {
        try {
            $payload = $this->toRequisitionPayload($request->validated());
            $resolvedDepartment = $departmentScopeResolver->resolveForStorePayload($payload, $request->user());
            $payload['requesting_department_id'] = $resolvedDepartment['id'];
            $payload['requesting_department'] = $resolvedDepartment['name'];

            $requisition = $useCase->execute(
                payload: $payload,
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return response()->json(['message' => $exception->getMessage()], 403);
        }

        return response()->json([
            'data' => InventoryDepartmentRequisitionResponseTransformer::transform($requisition),
        ], 201);
    }

    public function departmentRequisitionContext(Request $request, DepartmentRequisitionScopeResolver $departmentScopeResolver): JsonResponse
    {
        return response()->json([
            'data' => $departmentScopeResolver->contextForUser($request->user()),
        ]);
    }

    public function departmentRequisition(
        string $id,
        Request $request,
        GetInventoryDepartmentRequisitionUseCase $useCase,
        DepartmentRequisitionScopeResolver $departmentScopeResolver,
    ): JsonResponse {
        $requisition = $useCase->execute($id);
        if (! $requisition) {
            return response()->json(['message' => 'Department requisition was not found.'], 404);
        }

        $context = $departmentScopeResolver->contextForUser($request->user());
        if (! (bool) ($context['canSelectAnyDepartment'] ?? false)) {
            $lockedDepartmentId = $context['lockedDepartment']['id'] ?? null;
            if (! $lockedDepartmentId || ($requisition['requesting_department_id'] ?? null) !== $lockedDepartmentId) {
                return response()->json(['message' => 'Department requisition was not found.'], 404);
            }
        }

        return response()->json([
            'data' => InventoryDepartmentRequisitionResponseTransformer::transform($requisition),
        ]);
    }

    public function shortageQueue(
        Request $request,
        GetShortageQueueUseCase $useCase,
        DepartmentRequisitionScopeResolver $departmentScopeResolver,
    ): JsonResponse {
        $filters = $request->all();
        $context = $departmentScopeResolver->contextForUser($request->user());
        if (! (bool) ($context['canSelectAnyDepartment'] ?? false)) {
            $filters['departmentId'] = $context['lockedDepartment']['id'] ?? '__unassigned_department__';
        }

        $result = $useCase->execute($filters);

        return response()->json([
            'data' => array_map(
                static function (array $requisition): array {
                    $transformed = InventoryDepartmentRequisitionResponseTransformer::transform($requisition);
                    // Preserve enrichment fields added by the use case.
                    $transformed['pendingLines'] = array_map(
                        static function (array $line): array {
                            $procurementRequest = $line['procurementRequest'] ?? null;
                            $transformedLine = InventoryDepartmentRequisitionResponseTransformer::transformLine($line);

                            $transformedLine['pendingQuantity'] = $line['pendingQuantity'] ?? null;
                            $transformedLine['availableQuantity'] = $line['availableQuantity'] ?? null;
                            $transformedLine['stockState'] = $line['stockState'] ?? null;
                            $transformedLine['canIssueNow'] = (bool) ($line['canIssueNow'] ?? false);
                            $transformedLine['procurementRequest'] = is_array($procurementRequest)
                                ? InventoryProcurementRequestResponseTransformer::transform($procurementRequest)
                                : null;

                            return $transformedLine;
                        },
                        $requisition['pendingLines'] ?? [],
                    );
                    $transformed['readyLineCount']   = $requisition['readyLineCount']   ?? 0;
                    $transformed['waitingLineCount'] = $requisition['waitingLineCount'] ?? 0;

                    return $transformed;
                },
                $result['data'],
            ),
            'meta' => $result['meta'],
        ]);
    }

    public function departmentStock(
        Request $request,
        PlatformScopeQueryApplier $platformScopeQueryApplier,
        FeatureFlagResolverInterface $featureFlagResolver,
    ): JsonResponse {
        $page = max((int) $request->query('page', 1), 1);
        $perPage = min(max((int) $request->query('perPage', 20), 1), 100);
        $searchTerm = trim((string) $request->query('q', ''));
        $itemId = trim((string) $request->query('itemId', ''));
        $departmentId = trim((string) $request->query('departmentId', ''));

        $movementQuery = InventoryStockMovementModel::query()
            ->with('item')
            ->where('movement_type', 'issue')
            ->where(function ($query): void {
                $query
                    ->whereNotNull('destination_department_id')
                    ->orWhere('source_type', 'inventory_department_requisition')
                    ->orWhere('metadata->source', 'department_requisition');
            })
            ->when($itemId !== '', fn ($query) => $query->where('item_id', $itemId))
            ->when($departmentId !== '', function ($query) use ($departmentId): void {
                $query->where(function ($nestedQuery) use ($departmentId): void {
                    $nestedQuery
                        ->where('destination_department_id', $departmentId)
                        ->orWhere('metadata->requesting_department_id', $departmentId);
                });
            })
            ->orderByDesc('occurred_at')
            ->limit(5000);

        if ($this->isPlatformScopingEnabled($featureFlagResolver)) {
            $platformScopeQueryApplier->apply($movementQuery);
        }

        $movements = $movementQuery->get();

        $departmentIds = $movements
            ->map(static function (InventoryStockMovementModel $movement): ?string {
                $metadata = is_array($movement->metadata) ? $movement->metadata : [];

                return $movement->destination_department_id ?: ($metadata['requesting_department_id'] ?? null);
            })
            ->filter()
            ->unique()
            ->values();

        $warehouseIds = $movements
            ->pluck('source_warehouse_id')
            ->filter()
            ->unique()
            ->values();

        $departmentQuery = DepartmentModel::query()->whereIn('id', $departmentIds);
        $warehouseQuery = InventoryWarehouseModel::query()->whereIn('id', $warehouseIds);

        if ($this->isPlatformScopingEnabled($featureFlagResolver)) {
            $platformScopeQueryApplier->apply($departmentQuery);
            $platformScopeQueryApplier->apply($warehouseQuery);
        }

        $departments = $departmentQuery->get()->keyBy('id');
        $warehouses = $warehouseQuery->get()->keyBy('id');
        $rows = [];

        foreach ($movements as $movement) {
            $item = $movement->item;
            if ($item === null) {
                continue;
            }

            $metadata = is_array($movement->metadata) ? $movement->metadata : [];
            $resolvedDepartmentId = $movement->destination_department_id ?: ($metadata['requesting_department_id'] ?? null);
            $department = $resolvedDepartmentId ? $departments->get($resolvedDepartmentId) : null;
            $metadataDepartmentName = trim((string) ($metadata['department'] ?? ''));
            $departmentName = $department?->name ?: ($metadataDepartmentName !== '' ? $metadataDepartmentName : 'Unassigned department');
            $departmentCode = $department?->code;
            $key = ($resolvedDepartmentId ?: 'legacy:'.md5($departmentName)).'|'.$movement->item_id;
            $warehouse = $movement->source_warehouse_id ? $warehouses->get($movement->source_warehouse_id) : null;
            $occurredAt = $movement->occurred_at?->toJSON();

            if (! isset($rows[$key])) {
                $rows[$key] = [
                    'id' => $key,
                    'departmentId' => $resolvedDepartmentId,
                    'departmentName' => $departmentName,
                    'departmentCode' => $departmentCode,
                    'itemId' => (string) $movement->item_id,
                    'itemCode' => $item->item_code,
                    'itemName' => $item->item_name,
                    'category' => $item->category,
                    'subcategory' => $item->subcategory,
                    'unit' => $item->unit,
                    'issuedQuantity' => 0.0,
                    'movementCount' => 0,
                    'lastIssuedAt' => $occurredAt,
                    'sourceWarehouseId' => $movement->source_warehouse_id,
                    'sourceWarehouseCode' => $warehouse?->warehouse_code,
                    'sourceWarehouseName' => $warehouse?->warehouse_name,
                ];
            }

            $rows[$key]['issuedQuantity'] += (float) $movement->quantity;
            $rows[$key]['movementCount']++;

            if ($occurredAt !== null && ($rows[$key]['lastIssuedAt'] === null || $occurredAt > $rows[$key]['lastIssuedAt'])) {
                $rows[$key]['lastIssuedAt'] = $occurredAt;
                $rows[$key]['sourceWarehouseId'] = $movement->source_warehouse_id;
                $rows[$key]['sourceWarehouseCode'] = $warehouse?->warehouse_code;
                $rows[$key]['sourceWarehouseName'] = $warehouse?->warehouse_name;
            }
        }

        $filteredRows = collect(array_values($rows))
            ->filter(static function (array $row) use ($searchTerm): bool {
                if ($searchTerm === '') {
                    return true;
                }

                $haystack = strtolower(implode(' ', array_filter([
                    $row['departmentName'] ?? null,
                    $row['departmentCode'] ?? null,
                    $row['itemName'] ?? null,
                    $row['itemCode'] ?? null,
                    $row['category'] ?? null,
                    $row['subcategory'] ?? null,
                    $row['sourceWarehouseName'] ?? null,
                    $row['sourceWarehouseCode'] ?? null,
                ])));

                return str_contains($haystack, strtolower($searchTerm));
            })
            ->sortByDesc('lastIssuedAt')
            ->values();

        $total = $filteredRows->count();
        $pageRows = $filteredRows->forPage($page, $perPage)->values();

        return response()->json([
            'data' => $pageRows->all(),
            'summary' => [
                'totalRows' => $total,
                'departments' => $filteredRows->pluck('departmentId')->filter()->unique()->count(),
                'items' => $filteredRows->pluck('itemId')->filter()->unique()->count(),
                'totalIssuedQuantity' => round((float) $filteredRows->sum('issuedQuantity'), 3),
                'lastIssuedAt' => $filteredRows->pluck('lastIssuedAt')->filter()->max(),
            ],
            'meta' => [
                'currentPage' => $page,
                'perPage' => $perPage,
                'total' => $total,
                'lastPage' => max((int) ceil($total / $perPage), 1),
            ],
        ]);
    }

    public function updateDepartmentRequisitionStatus(
        string $id,
        UpdateInventoryDepartmentRequisitionStatusRequest $request,
        UpdateInventoryDepartmentRequisitionStatusUseCase $useCase
    ): JsonResponse {
        try {
            $requisition = $useCase->execute(
                id: $id,
                newStatus: $request->string('status')->value(),
                payload: $this->toRequisitionStatusPayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return response()->json(['message' => $exception->getMessage()], 403);
        } catch (InventoryProcurementWorkflowException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        abort_if($requisition === null, 404, 'Department requisition not found.');

        return response()->json([
            'data' => InventoryDepartmentRequisitionResponseTransformer::transform($requisition),
        ]);
    }

    // ─── Reference Data ───────────────────────────────────────

    public function referenceData(
        PlatformScopeQueryApplier $platformScopeQueryApplier,
        FeatureFlagResolverInterface $featureFlagResolver,
    ): JsonResponse
    {
        return response()->json([
            'categories' => InventoryItemCategory::labelMap(),
            'categoryOptions' => InventoryItemCategory::optionMetadata(),
            'venClassifications' => array_map(
                static fn ($case) => ['value' => $case->value, 'label' => $case->label()],
                InventoryVenClassification::cases(),
            ),
            'abcClassifications' => [
                ['value' => 'A', 'label' => 'A – High Value'],
                ['value' => 'B', 'label' => 'B – Medium Value'],
                ['value' => 'C', 'label' => 'C – Low Value'],
            ],
            'storageConditions' => [
                'room_temperature',
                'cool_dry_place',
                'refrigerated_2_8c',
                'frozen_minus_20c',
                'frozen_minus_70c',
                'protect_from_light',
            ],
            'storageConditionOptions' => [
                ['value' => 'room_temperature', 'label' => 'Room Temperature'],
                ['value' => 'cool_dry_place', 'label' => 'Cool & Dry Place'],
                ['value' => 'refrigerated_2_8c', 'label' => 'Refrigerated (2–8°C)'],
                ['value' => 'frozen_minus_20c', 'label' => 'Frozen (−20°C)'],
                ['value' => 'frozen_minus_70c', 'label' => 'Frozen (−70°C)'],
                ['value' => 'protect_from_light', 'label' => 'Protect from Light'],
            ],
            'controlledSubstanceSchedules' => [
                'schedule_I',
                'schedule_II',
                'schedule_III',
                'schedule_IV',
            ],
            'controlledSubstanceScheduleOptions' => [
                ['value' => 'schedule_I', 'label' => 'Schedule I'],
                ['value' => 'schedule_II', 'label' => 'Schedule II'],
                ['value' => 'schedule_III', 'label' => 'Schedule III'],
                ['value' => 'schedule_IV', 'label' => 'Schedule IV'],
            ],
            'transferStatuses' => array_map(
                static fn ($case) => ['value' => $case->value, 'label' => $case->label()],
                InventoryWarehouseTransferStatus::cases(),
            ),
            'dispensingClaimStatuses' => array_map(
                static fn ($case) => ['value' => $case->value, 'label' => $case->label()],
                InventoryDispensingClaimStatus::cases(),
            ),
            'msdOrderStatuses' => array_map(
                static fn ($case) => ['value' => $case->value, 'label' => $case->label()],
                InventoryMsdOrderStatus::cases(),
            ),
            'clinicalCatalogItems' => $this->clinicalCatalogItems(
                platformScopeQueryApplier: $platformScopeQueryApplier,
                featureFlagResolver: $featureFlagResolver,
            ),
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function clinicalCatalogItems(
        PlatformScopeQueryApplier $platformScopeQueryApplier,
        FeatureFlagResolverInterface $featureFlagResolver,
    ): array {
        $query = ClinicalCatalogItemModel::query()
            ->select(['id', 'catalog_type', 'code', 'name', 'category', 'unit', 'description', 'metadata', 'codes', 'status'])
            ->where('catalog_type', ClinicalCatalogType::FORMULARY_ITEM->value)
            ->where('status', ClinicalCatalogItemStatus::ACTIVE->value)
            ->orderBy('name');

        if ($this->isPlatformScopingEnabled($featureFlagResolver)) {
            $platformScopeQueryApplier->apply($query);
        }

        return $query
            ->limit(500)
            ->get()
            ->map(static fn (ClinicalCatalogItemModel $item): array => [
                'id' => (string) $item->id,
                'catalogType' => $item->catalog_type,
                'code' => $item->code,
                'name' => $item->name,
                'category' => $item->category,
                'unit' => $item->unit,
                'description' => $item->description,
                'metadata' => is_array($item->metadata) ? $item->metadata : [],
                'codes' => is_array($item->codes) ? $item->codes : [],
                'status' => $item->status,
            ])
            ->values()
            ->all();
    }

    private function isPlatformScopingEnabled(FeatureFlagResolverInterface $featureFlagResolver): bool
    {
        return $featureFlagResolver->isEnabled('platform.multi_facility_scoping')
            || $featureFlagResolver->isEnabled('platform.multi_tenant_isolation');
    }

    // ─── Supplier Lead Times ──────────────────────────────────

    public function supplierLeadTimes(
        Request $request,
        InventorySupplierLeadTimeRepositoryInterface $repository
    ): JsonResponse {
        $supplierId = $request->query('supplierId');
        if (! $supplierId) {
            return response()->json(['message' => 'supplierId is required.'], 422);
        }

        $result = $repository->listBySupplier(
            $supplierId,
            (int) $request->query('page', 1),
            (int) $request->query('perPage', 15),
        );

        return response()->json($result);
    }

    public function storeSupplierLeadTime(
        Request $request,
        RecordSupplierLeadTimeUseCase $useCase
    ): JsonResponse {
        $validated = $request->validate([
            'supplierId' => 'required|uuid',
            'itemId' => 'nullable|uuid',
            'procurementRequestId' => 'nullable|uuid',
            'orderDate' => 'required|date',
            'expectedDeliveryDate' => 'nullable|date|after_or_equal:orderDate',
            'quantityOrdered' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:500',
        ]);

        try {
            $record = $useCase->execute([
                'supplier_id' => $validated['supplierId'],
                'item_id' => $validated['itemId'] ?? null,
                'procurement_request_id' => $validated['procurementRequestId'] ?? null,
                'order_date' => $validated['orderDate'],
                'expected_delivery_date' => $validated['expectedDeliveryDate'] ?? null,
                'quantity_ordered' => $validated['quantityOrdered'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ]);
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return response()->json(['message' => $exception->getMessage()], 403);
        }

        return response()->json(['data' => $record], 201);
    }

    public function recordSupplierDelivery(
        string $id,
        Request $request,
        RecordSupplierDeliveryUseCase $useCase
    ): JsonResponse {
        $validated = $request->validate([
            'actualDeliveryDate' => 'required|date',
            'quantityReceived' => 'nullable|numeric|min:0',
        ]);

        try {
            $record = $useCase->execute($id, [
                'actual_delivery_date' => $validated['actualDeliveryDate'],
                'quantity_received' => $validated['quantityReceived'] ?? null,
            ]);
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 404);
        }

        return response()->json(['data' => $record]);
    }

    public function supplierPerformance(
        string $supplierId,
        Request $request,
        GetSupplierPerformanceUseCase $useCase
    ): JsonResponse {
        $itemId = $request->query('itemId');
        $result = $useCase->execute($supplierId, $itemId);

        return response()->json(['data' => $result]);
    }

    // ─── Warehouse Transfers ──────────────────────────────────

    public function warehouseTransfers(
        Request $request,
        InventoryWarehouseTransferRepositoryInterface $repository
    ): JsonResponse {
        $result = $repository->search(
            query: $request->query('query'),
            status: $request->query('status'),
            varianceReviewStatus: $request->query('varianceReview'),
            sourceWarehouseId: $request->query('sourceWarehouseId'),
            destinationWarehouseId: $request->query('destinationWarehouseId'),
            page: (int) $request->query('page', 1),
            perPage: (int) $request->query('perPage', 15),
        );

        return response()->json([
            'data' => array_map(
                [InventoryWarehouseTransferResponseTransformer::class, 'transform'],
                $result['data'] ?? [],
            ),
            'meta' => $result['meta'] ?? [],
        ]);
    }

    public function showWarehouseTransfer(
        string $id,
        InventoryWarehouseTransferRepositoryInterface $repository
    ): JsonResponse {
        $transfer = $repository->findById($id);
        abort_if($transfer === null, 404, 'Transfer not found.');

        return response()->json([
            'data' => InventoryWarehouseTransferResponseTransformer::transform($transfer),
        ]);
    }

    public function updateWarehouseTransferVarianceReview(
        string $id,
        Request $request,
        UpdateWarehouseTransferVarianceReviewUseCase $useCase
    ): JsonResponse {
        $validated = $request->validate([
            'reviewStatus' => 'required|in:' . implode(',', InventoryWarehouseTransferVarianceReviewStatus::values()),
            'reviewNotes' => 'nullable|string|max:1000',
        ]);

        try {
            $transfer = $useCase->execute(
                transferId: $id,
                reviewStatus: $validated['reviewStatus'],
                userId: (string) ($request->user()?->id ?? ''),
                reviewNotes: $validated['reviewNotes'] ?? null,
            );
        } catch (InventoryStockOperationValidationException $exception) {
            return $this->validationError($exception->field(), $exception->getMessage());
        } catch (\DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 404);
        }

        return response()->json([
            'data' => InventoryWarehouseTransferResponseTransformer::transform($transfer),
        ]);
    }

    public function storeWarehouseTransfer(
        Request $request,
        CreateWarehouseTransferUseCase $useCase
    ): JsonResponse {
        $validated = $request->validate([
            'sourceWarehouseId' => 'required|uuid',
            'destinationWarehouseId' => 'required|uuid|different:sourceWarehouseId',
            'priority' => 'nullable|in:low,normal,high,urgent',
            'reason' => 'nullable|string|max:500',
            'notes' => 'nullable|string|max:1000',
            'lines' => 'required|array|min:1',
            'lines.*.itemId' => 'required|uuid',
            'lines.*.batchId' => 'nullable|uuid',
            'lines.*.requestedQuantity' => 'required|numeric|min:0.001',
            'lines.*.unit' => 'nullable|string|max:50',
            'lines.*.notes' => 'nullable|string|max:300',
        ]);

        try {
            $transfer = $useCase->execute(
                [
                    'source_warehouse_id' => $validated['sourceWarehouseId'],
                    'destination_warehouse_id' => $validated['destinationWarehouseId'],
                    'priority' => $validated['priority'] ?? 'normal',
                    'reason' => $validated['reason'] ?? null,
                    'notes' => $validated['notes'] ?? null,
                    'lines' => array_map(static fn (array $line) => [
                        'item_id' => $line['itemId'],
                        'batch_id' => $line['batchId'] ?? null,
                        'requested_quantity' => $line['requestedQuantity'],
                        'unit' => $line['unit'] ?? null,
                        'notes' => $line['notes'] ?? null,
                    ], $validated['lines']),
                ],
                $request->user()?->id,
            );
        } catch (InventoryStockOperationValidationException $exception) {
            return $this->validationError($exception->field(), $exception->getMessage());
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return response()->json(['message' => $exception->getMessage()], 403);
        }

        return response()->json([
            'data' => InventoryWarehouseTransferResponseTransformer::transform($transfer),
        ], 201);
    }

    public function updateWarehouseTransferStatus(
        string $id,
        Request $request,
        UpdateWarehouseTransferStatusUseCase $useCase
    ): JsonResponse {
        $validated = $request->validate([
            'status' => 'required|in:' . implode(',', InventoryWarehouseTransferStatus::values()),
            'rejectionReason' => 'nullable|required_if:status,rejected|string|max:500',
            'packNotes' => 'nullable|string|max:1000',
            'receivingNotes' => 'nullable|string|max:1000',
            'revalidateReservation' => 'nullable|boolean',
            'packedQuantities' => 'nullable|array',
            'packedQuantities.*' => 'numeric|min:0',
            'dispatchedQuantities' => 'nullable|array',
            'dispatchedQuantities.*' => 'numeric|min:0',
            'receivedQuantities' => 'nullable|array',
            'receivedQuantities.*' => 'numeric|min:0',
            'receiptVarianceTypes' => 'nullable|array',
            'receiptVarianceTypes.*' => 'in:' . implode(',', InventoryWarehouseTransferReceiptVarianceType::values()),
            'receiptVarianceQuantities' => 'nullable|array',
            'receiptVarianceQuantities.*' => 'numeric|min:0',
            'receiptVarianceReasons' => 'nullable|array',
            'receiptVarianceReasons.*' => 'nullable|string|max:500',
        ]);

        try {
            $transfer = $useCase->execute(
                $id,
                $validated['status'],
                $request->user()?->id,
                [
                    'rejection_reason' => $validated['rejectionReason'] ?? null,
                    'pack_notes' => $validated['packNotes'] ?? null,
                    'receiving_notes' => $validated['receivingNotes'] ?? null,
                    'revalidate_reservation' => (bool) ($validated['revalidateReservation'] ?? false),
                    'packed_quantities' => $validated['packedQuantities'] ?? [],
                    'dispatched_quantities' => $validated['dispatchedQuantities'] ?? [],
                    'received_quantities' => $validated['receivedQuantities'] ?? [],
                    'receipt_variance_types' => $validated['receiptVarianceTypes'] ?? [],
                    'receipt_variance_quantities' => $validated['receiptVarianceQuantities'] ?? [],
                    'receipt_variance_reasons' => $validated['receiptVarianceReasons'] ?? [],
                ],
            );
        } catch (InventoryStockOperationValidationException $exception) {
            return $this->validationError($exception->field(), $exception->getMessage());
        } catch (\DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 404);
        }

        return response()->json([
            'data' => InventoryWarehouseTransferResponseTransformer::transform($transfer),
        ]);
    }

    // ─── Dispensing Claim Links ─────────────────────────────

    public function dispensingClaimLinks(
        Request $request,
        InventoryDispensingClaimLinkRepositoryInterface $repository
    ): JsonResponse {
        $result = $repository->search(
            patientId: $request->query('patientId'),
            claimStatus: $request->query('claimStatus'),
            insuranceClaimId: $request->query('insuranceClaimId'),
            query: $request->query('query'),
            page: (int) $request->query('page', 1),
            perPage: (int) $request->query('perPage', 15),
        );

        return response()->json($result);
    }

    public function storeDispensingClaimLink(
        Request $request,
        CreateDispensingClaimLinkUseCase $useCase
    ): JsonResponse {
        $validated = $request->validate([
            'stockMovementId' => 'nullable|uuid',
            'pharmacyOrderId' => 'nullable|uuid',
            'itemId' => 'required|uuid',
            'batchId' => 'nullable|uuid',
            'quantityDispensed' => 'required|numeric|min:0.001',
            'unit' => 'nullable|string|max:50',
            'unitCost' => 'nullable|numeric|min:0',
            'totalCost' => 'nullable|numeric|min:0',
            'patientId' => 'required|uuid',
            'admissionId' => 'nullable|uuid',
            'appointmentId' => 'nullable|uuid',
            'insuranceClaimId' => 'nullable|uuid',
            'billingInvoiceId' => 'nullable|uuid',
            'nhifCode' => 'nullable|string|max:50',
            'payerType' => 'nullable|string|max:50',
            'payerName' => 'nullable|string|max:255',
            'payerReference' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $link = $useCase->execute([
                'stock_movement_id' => $validated['stockMovementId'] ?? null,
                'pharmacy_order_id' => $validated['pharmacyOrderId'] ?? null,
                'item_id' => $validated['itemId'],
                'batch_id' => $validated['batchId'] ?? null,
                'quantity_dispensed' => $validated['quantityDispensed'],
                'unit' => $validated['unit'] ?? null,
                'unit_cost' => $validated['unitCost'] ?? null,
                'total_cost' => $validated['totalCost'] ?? null,
                'patient_id' => $validated['patientId'],
                'admission_id' => $validated['admissionId'] ?? null,
                'appointment_id' => $validated['appointmentId'] ?? null,
                'insurance_claim_id' => $validated['insuranceClaimId'] ?? null,
                'billing_invoice_id' => $validated['billingInvoiceId'] ?? null,
                'nhif_code' => $validated['nhifCode'] ?? null,
                'payer_type' => $validated['payerType'] ?? null,
                'payer_name' => $validated['payerName'] ?? null,
                'payer_reference' => $validated['payerReference'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ], $request->user()?->id);
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return response()->json(['message' => $exception->getMessage()], 403);
        }

        return response()->json(['data' => $link], 201);
    }

    public function updateDispensingClaimStatus(
        string $id,
        Request $request,
        UpdateDispensingClaimStatusUseCase $useCase
    ): JsonResponse {
        $validated = $request->validate([
            'status' => 'required|in:' . implode(',', InventoryDispensingClaimStatus::values()),
            'insuranceClaimId' => 'nullable|uuid',
            'billingInvoiceId' => 'nullable|uuid',
            'approvedAmount' => 'nullable|numeric|min:0',
            'rejectedAmount' => 'nullable|numeric|min:0',
            'rejectionReason' => 'nullable|string|max:500',
        ]);

        try {
            $link = $useCase->execute($id, $validated['status'], [
                'insurance_claim_id' => $validated['insuranceClaimId'] ?? null,
                'billing_invoice_id' => $validated['billingInvoiceId'] ?? null,
                'approved_amount' => $validated['approvedAmount'] ?? null,
                'rejected_amount' => $validated['rejectedAmount'] ?? null,
                'rejection_reason' => $validated['rejectionReason'] ?? null,
            ]);
        } catch (\DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 404);
        }

        return response()->json(['data' => $link]);
    }

    // ─── MSD E-Ordering ──────────────────────────────────────

    public function msdOrders(
        Request $request,
        InventoryMsdOrderRepositoryInterface $repository
    ): JsonResponse {
        $result = $repository->search(
            query: $request->query('query'),
            status: $request->query('status'),
            page: (int) $request->query('page', 1),
            perPage: (int) $request->query('perPage', 15),
        );

        return response()->json($result);
    }

    public function storeMsdOrder(
        Request $request,
        CreateMsdOrderUseCase $useCase
    ): JsonResponse {
        $validated = $request->validate([
            'facilityMsdCode' => 'nullable|string|max:50',
            'procurementRequestId' => 'nullable|uuid',
            'supplierId' => 'nullable|uuid',
            'orderLines' => 'required|array|min:1',
            'orderLines.*.msdCode' => 'required|string|max:50',
            'orderLines.*.itemName' => 'required|string|max:255',
            'orderLines.*.quantity' => 'required|numeric|min:0.001',
            'orderLines.*.unit' => 'required|string|max:50',
            'orderLines.*.unitCost' => 'nullable|numeric|min:0',
            'currencyCode' => 'nullable|string|max:10',
            'totalAmount' => 'nullable|numeric|min:0',
            'orderDate' => 'required|date',
            'expectedDeliveryDate' => 'nullable|date|after_or_equal:orderDate',
            'notes' => 'nullable|string|max:1000',
            'submitImmediately' => 'nullable|boolean',
        ]);

        try {
            $order = $useCase->execute([
                'facility_msd_code' => $validated['facilityMsdCode'] ?? null,
                'procurement_request_id' => $validated['procurementRequestId'] ?? null,
                'supplier_id' => $validated['supplierId'] ?? null,
                'order_lines' => array_map(static fn (array $line) => [
                    'msd_code' => $line['msdCode'],
                    'item_name' => $line['itemName'],
                    'quantity' => $line['quantity'],
                    'unit' => $line['unit'],
                    'unit_cost' => $line['unitCost'] ?? null,
                ], $validated['orderLines']),
                'currency_code' => $validated['currencyCode'] ?? 'TZS',
                'total_amount' => $validated['totalAmount'] ?? null,
                'order_date' => $validated['orderDate'],
                'expected_delivery_date' => $validated['expectedDeliveryDate'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ], $request->user()?->id, $validated['submitImmediately'] ?? false);
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return response()->json(['message' => $exception->getMessage()], 403);
        }

        return response()->json(['data' => $order], 201);
    }

    public function syncMsdOrderStatus(
        string $id,
        SyncMsdOrderStatusUseCase $useCase
    ): JsonResponse {
        try {
            $order = $useCase->execute($id);
        } catch (\DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 404);
        }

        return response()->json(['data' => $order]);
    }

    public function msdHealthCheck(MsdApiClientInterface $msdApiClient): JsonResponse
    {
        $result = $msdApiClient->healthCheck();

        return response()->json($result);
    }

    // ─── Barcode Lookup ──────────────────────────────────────

    public function lookupByBarcode(Request $request): JsonResponse
    {
        $barcode = $request->validate([
            'barcode' => 'required|string|max:100',
        ])['barcode'];

        $query = \App\Modules\InventoryProcurement\Infrastructure\Models\InventoryItemModel::query()
            ->where('barcode', $barcode)
            ->where('status', 'active');

        $item = $query->first();
        if (! $item) {
            return response()->json(['message' => 'No active item found for barcode.', 'data' => null], 404);
        }

        return response()->json(['data' => $item->toArray()]);
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

    // ─── Payload Mappers ──────────────────────────────────────

    private function toBatchPayload(array $validated): array
    {
        return [
            'item_id' => $validated['itemId'],
            'batch_number' => $validated['batchNumber'],
            'lot_number' => $validated['lotNumber'] ?? null,
            'manufacture_date' => $validated['manufactureDate'] ?? null,
            'expiry_date' => $validated['expiryDate'] ?? null,
            'quantity' => $validated['quantity'],
            'warehouse_id' => $validated['warehouseId'] ?? null,
            'bin_location' => $validated['binLocation'] ?? null,
            'supplier_id' => $validated['supplierId'] ?? null,
            'unit_cost' => $validated['unitCost'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ];
    }

    private function toRequisitionPayload(array $validated): array
    {
        $lines = [];
        foreach (($validated['lines'] ?? []) as $line) {
            $lines[] = [
                'item_id' => $line['itemId'],
                'batch_id' => $line['batchId'] ?? null,
                'requested_quantity' => $line['requestedQuantity'],
                'unit' => $line['unit'],
                'notes' => $line['notes'] ?? null,
            ];
        }

        return [
            'requesting_department' => $validated['requestingDepartment'],
            'requesting_department_id' => $validated['requestingDepartmentId'] ?? null,
            'issuing_store' => $validated['issuingStore'] ?? null,
            'issuing_warehouse_id' => $validated['issuingWarehouseId'] ?? null,
            'priority' => $validated['priority'] ?? 'normal',
            'needed_by' => $validated['neededBy'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'lines' => $lines,
        ];
    }

    private function toRequisitionStatusPayload(array $validated): array
    {
        $payload = [
            'rejection_reason' => $validated['rejectionReason'] ?? null,
        ];

        if (isset($validated['lines'])) {
            $payload['lines'] = array_map(static fn (array $line) => [
                'id' => $line['id'],
                'approved_quantity' => $line['approvedQuantity'] ?? null,
                'issued_quantity' => $line['issuedQuantity'] ?? null,
            ], $validated['lines']);
        }

        return $payload;
    }
}
