<?php

namespace App\Modules\InventoryProcurement\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\InventoryProcurement\Application\Exceptions\DuplicateInventoryItemCodeException;
use App\Modules\InventoryProcurement\Application\Exceptions\InsufficientInventoryStockException;
use App\Modules\InventoryProcurement\Application\Exceptions\InventoryItemNotFoundException;
use App\Modules\InventoryProcurement\Application\Exceptions\InventoryProcurementReceiptValidationException;
use App\Modules\InventoryProcurement\Application\Exceptions\InventoryProcurementWorkflowException;
use App\Modules\InventoryProcurement\Application\Exceptions\InventoryStockOperationValidationException;
use App\Modules\InventoryProcurement\Application\Exceptions\InventoryWarehouseNotFoundException;
use App\Modules\InventoryProcurement\Application\UseCases\CreateInventoryItemUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\CreateInventoryProcurementRequestUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\CreateInventoryStockMovementUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\GetInventoryItemUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\GetInventoryStockMovementSummaryUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\GetInventoryStockAlertCountsUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\ListInventoryItemAuditLogsUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\ListInventoryItemsUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\ListInventoryProcurementRequestAuditLogsUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\ListInventoryProcurementRequestsUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\ListInventoryStockMovementsUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\PlaceInventoryProcurementOrderUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\ReceiveInventoryProcurementRequestUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\ReconcileInventoryStockUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\UpdateInventoryItemStatusUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\UpdateInventoryItemUseCase;
use App\Modules\InventoryProcurement\Application\UseCases\UpdateInventoryProcurementRequestStatusUseCase;
use App\Modules\InventoryProcurement\Presentation\Http\Requests\PlaceInventoryProcurementOrderRequest;
use App\Modules\InventoryProcurement\Presentation\Http\Requests\ReconcileInventoryStockRequest;
use App\Modules\InventoryProcurement\Presentation\Http\Requests\ReceiveInventoryProcurementRequestRequest;
use App\Modules\InventoryProcurement\Presentation\Http\Requests\StoreInventoryItemRequest;
use App\Modules\InventoryProcurement\Presentation\Http\Requests\StoreInventoryProcurementRequestRequest;
use App\Modules\InventoryProcurement\Presentation\Http\Requests\StoreInventoryStockMovementRequest;
use App\Modules\InventoryProcurement\Presentation\Http\Requests\UpdateInventoryItemRequest;
use App\Modules\InventoryProcurement\Presentation\Http\Requests\UpdateInventoryItemStatusRequest;
use App\Modules\InventoryProcurement\Presentation\Http\Requests\UpdateInventoryProcurementRequestStatusRequest;
use App\Modules\InventoryProcurement\Presentation\Http\Transformers\InventoryItemAuditLogResponseTransformer;
use App\Modules\InventoryProcurement\Presentation\Http\Transformers\InventoryItemResponseTransformer;
use App\Modules\InventoryProcurement\Presentation\Http\Transformers\InventoryProcurementRequestAuditLogResponseTransformer;
use App\Modules\InventoryProcurement\Presentation\Http\Transformers\InventoryProcurementRequestResponseTransformer;
use App\Modules\InventoryProcurement\Presentation\Http\Transformers\InventoryStockMovementResponseTransformer;
use App\Modules\InventoryProcurement\Presentation\Support\InventoryStockMovementSourcePresenter;
use App\Modules\Platform\Application\Exceptions\TenantScopeRequiredForIsolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class InventoryProcurementController extends Controller
{
    private const AUDIT_CSV_SCHEMA_VERSION = 'audit-log-csv.v1';

    private const AUDIT_CSV_COLUMNS = ['createdAt', 'action', 'actorType', 'actorId', 'changes', 'metadata'];

    private const STOCK_LEDGER_CSV_SCHEMA_VERSION = 'inventory-stock-ledger-csv.v1';

    private const STOCK_LEDGER_CSV_COLUMNS = [
        'occurredAt',
        'movementType',
        'adjustmentDirection',
        'itemId',
        'itemCode',
        'itemName',
        'sourceKey',
        'sourceLabel',
        'sourceReference',
        'sourceDetail',
        'sourceType',
        'sourceId',
        'procurementRequestId',
        'quantity',
        'quantityDelta',
        'stockBefore',
        'stockAfter',
        'actorType',
        'actorId',
        'reason',
        'notes',
        'metadata',
        'reconciliationSessionReference',
        'reconciliationExpectedStock',
        'reconciliationCountedStock',
        'reconciliationVarianceQuantity',
        'createdAt',
    ];

    public function items(Request $request, ListInventoryItemsUseCase $useCase): JsonResponse
    {
        $result = $useCase->execute($request->all());

        return response()->json([
            'data' => array_map([InventoryItemResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function storeItem(StoreInventoryItemRequest $request, CreateInventoryItemUseCase $useCase): JsonResponse
    {
        try {
            $item = $useCase->execute(
                payload: $this->toItemPayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (DuplicateInventoryItemCodeException $exception) {
            return $this->validationError('itemCode', $exception->getMessage());
        }

        return response()->json([
            'data' => InventoryItemResponseTransformer::transform($item),
        ], 201);
    }

    public function showItem(string $id, GetInventoryItemUseCase $useCase): JsonResponse
    {
        $item = $useCase->execute($id);
        abort_if($item === null, 404, 'Inventory item not found.');

        return response()->json([
            'data' => InventoryItemResponseTransformer::transform($item),
        ]);
    }

    public function updateItem(
        string $id,
        UpdateInventoryItemRequest $request,
        UpdateInventoryItemUseCase $useCase
    ): JsonResponse {
        try {
            $item = $useCase->execute(
                id: $id,
                payload: $this->toItemPayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (DuplicateInventoryItemCodeException $exception) {
            return $this->validationError('itemCode', $exception->getMessage());
        }

        abort_if($item === null, 404, 'Inventory item not found.');

        return response()->json([
            'data' => InventoryItemResponseTransformer::transform($item),
        ]);
    }

    public function updateItemStatus(
        string $id,
        UpdateInventoryItemStatusRequest $request,
        UpdateInventoryItemStatusUseCase $useCase
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

        abort_if($item === null, 404, 'Inventory item not found.');

        return response()->json([
            'data' => InventoryItemResponseTransformer::transform($item),
        ]);
    }

    public function itemAuditLogs(
        string $id,
        Request $request,
        ListInventoryItemAuditLogsUseCase $useCase
    ): JsonResponse {
        $result = $useCase->execute(inventoryItemId: $id, filters: $request->all());
        abort_if($result === null, 404, 'Inventory item not found.');

        return response()->json([
            'data' => array_map([InventoryItemAuditLogResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function exportItemAuditLogsCsv(
        string $id,
        Request $request,
        ListInventoryItemAuditLogsUseCase $useCase
    ): StreamedResponse {
        $filters = $request->all();
        $filters['page'] = 1;
        $filters['perPage'] = 100;

        $firstPage = $useCase->execute(
            inventoryItemId: $id,
            filters: $filters,
        );
        abort_if($firstPage === null, 404, 'Inventory item not found.');

        $safeId = $this->safeExportIdentifier($id, 'inventory-item');

        return $this->streamAuditLogCsvExport(
            baseName: sprintf('inventory_item_audit_%s_%s', $safeId, now()->format('Ymd_His')),
            firstPage: $firstPage,
            fetchPage: function (int $page) use ($useCase, $id, $filters): ?array {
                $pageFilters = $filters;
                $pageFilters['page'] = $page;

                return $useCase->execute(
                    inventoryItemId: $id,
                    filters: $pageFilters,
                );
            },
        );
    }

    public function stockAlertCounts(Request $request, GetInventoryStockAlertCountsUseCase $useCase): JsonResponse
    {
        $counts = $useCase->execute($request->all());

        return response()->json([
            'data' => $counts,
        ]);
    }

    public function stockMovements(Request $request, ListInventoryStockMovementsUseCase $useCase): JsonResponse
    {
        $result = $useCase->execute($request->all());

        return response()->json([
            'data' => array_map([InventoryStockMovementResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function stockMovementSummary(Request $request, GetInventoryStockMovementSummaryUseCase $useCase): JsonResponse
    {
        $summary = $useCase->execute($request->all());

        return response()->json([
            'data' => $summary,
        ]);
    }

    public function exportStockMovementsCsv(
        Request $request,
        ListInventoryStockMovementsUseCase $useCase
    ): StreamedResponse {
        $filters = $request->all();
        $filters['page'] = 1;
        $filters['perPage'] = 200;

        $firstPage = $useCase->execute($filters);

        return $this->streamCsvExport(
            baseName: sprintf('inventory_stock_ledger_%s', now()->format('Ymd_His')),
            columns: self::STOCK_LEDGER_CSV_COLUMNS,
            writeRows: function ($output) use ($useCase, $filters, $firstPage): void {
                $writeRows = function (array $rows) use ($output): void {
                    foreach ($rows as $movement) {
                        fputcsv($output, $this->stockLedgerCsvRow($movement));
                    }
                };

                $writeRows($firstPage['data'] ?? []);
                $lastPage = max((int) ($firstPage['meta']['lastPage'] ?? 1), 1);

                for ($page = 2; $page <= $lastPage; $page++) {
                    $pageFilters = $filters;
                    $pageFilters['page'] = $page;
                    $pageResult = $useCase->execute($pageFilters);
                    $writeRows($pageResult['data'] ?? []);
                }
            },
            schemaHeaderName: 'X-Inventory-Stock-Ledger-CSV-Schema-Version',
            schemaVersion: self::STOCK_LEDGER_CSV_SCHEMA_VERSION,
        );
    }

    public function storeStockMovement(StoreInventoryStockMovementRequest $request, CreateInventoryStockMovementUseCase $useCase): JsonResponse
    {
        try {
            $movement = $useCase->execute(
                payload: $this->toStockMovementPayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (InventoryItemNotFoundException $exception) {
            return $this->validationError('itemId', $exception->getMessage());
        } catch (InventoryStockOperationValidationException $exception) {
            return $this->validationError($exception->field(), $exception->getMessage());
        } catch (InsufficientInventoryStockException $exception) {
            return $this->validationError('quantity', $exception->getMessage());
        }

        return response()->json([
            'data' => InventoryStockMovementResponseTransformer::transform($movement),
        ], 201);
    }

    public function reconcileStock(
        ReconcileInventoryStockRequest $request,
        ReconcileInventoryStockUseCase $useCase
    ): JsonResponse {
        try {
            $movement = $useCase->execute(
                payload: $this->toStockReconciliationPayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (InventoryItemNotFoundException $exception) {
            return $this->validationError('itemId', $exception->getMessage());
        } catch (InventoryStockOperationValidationException $exception) {
            return $this->validationError($exception->field(), $exception->getMessage());
        } catch (InventoryProcurementWorkflowException $exception) {
            return $this->validationError('countedStock', $exception->getMessage());
        }

        return response()->json([
            'data' => InventoryStockMovementResponseTransformer::transform($movement),
        ], 201);
    }

    public function procurementRequests(Request $request, ListInventoryProcurementRequestsUseCase $useCase): JsonResponse
    {
        $result = $useCase->execute($request->all());

        return response()->json([
            'data' => array_map([InventoryProcurementRequestResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function storeProcurementRequest(
        StoreInventoryProcurementRequestRequest $request,
        CreateInventoryProcurementRequestUseCase $useCase
    ): JsonResponse {
        try {
            $procurementRequest = $useCase->execute(
                payload: $this->toProcurementRequestPayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (InventoryItemNotFoundException $exception) {
            return $this->validationError('itemId', $exception->getMessage());
        } catch (InventoryProcurementWorkflowException $exception) {
            return $this->validationError('sourceDepartmentRequisitionLineId', $exception->getMessage());
        }

        return response()->json([
            'data' => InventoryProcurementRequestResponseTransformer::transform($procurementRequest),
        ], 201);
    }

    public function updateProcurementRequestStatus(
        string $id,
        UpdateInventoryProcurementRequestStatusRequest $request,
        UpdateInventoryProcurementRequestStatusUseCase $useCase
    ): JsonResponse {
        try {
            $procurementRequest = $useCase->execute(
                id: $id,
                status: $request->string('status')->value(),
                reason: $request->input('reason'),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        }

        abort_if($procurementRequest === null, 404, 'Procurement request not found.');

        return response()->json([
            'data' => InventoryProcurementRequestResponseTransformer::transform($procurementRequest),
        ]);
    }

    public function placeProcurementOrder(
        string $id,
        PlaceInventoryProcurementOrderRequest $request,
        PlaceInventoryProcurementOrderUseCase $useCase
    ): JsonResponse {
        try {
            $procurementRequest = $useCase->execute(
                id: $id,
                payload: $this->toProcurementOrderPayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (InventoryProcurementWorkflowException $exception) {
            return $this->validationError('status', $exception->getMessage());
        }

        abort_if($procurementRequest === null, 404, 'Procurement request not found.');

        return response()->json([
            'data' => InventoryProcurementRequestResponseTransformer::transform($procurementRequest),
        ]);
    }

    public function receiveProcurementRequest(
        string $id,
        ReceiveInventoryProcurementRequestRequest $request,
        ReceiveInventoryProcurementRequestUseCase $useCase
    ): JsonResponse {
        try {
            $procurementRequest = $useCase->execute(
                id: $id,
                payload: $this->toProcurementReceiptPayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (InventoryProcurementReceiptValidationException $exception) {
            return $this->validationError($exception->field(), $exception->getMessage());
        } catch (InventoryStockOperationValidationException $exception) {
            return $this->validationError($exception->field(), $exception->getMessage());
        } catch (InventoryProcurementWorkflowException $exception) {
            return $this->validationError('status', $exception->getMessage());
        } catch (InventoryItemNotFoundException $exception) {
            return $this->validationError('itemId', $exception->getMessage());
        } catch (InventoryWarehouseNotFoundException $exception) {
            return $this->validationError('warehouseId', $exception->getMessage());
        }

        abort_if($procurementRequest === null, 404, 'Procurement request not found.');

        // Count partially-issued requisition lines for this item that still have
        // pending quantity > 0, so the frontend can surface the shortage queue.
        $itemId = $procurementRequest['item_id'] ?? null;
        $pendingLineCount = 0;
        if ($itemId) {
            $pendingLineCount = (int) DB::table('inventory_department_requisition_lines as l')
                ->join('inventory_department_requisitions as r', 'l.requisition_id', '=', 'r.id')
                ->where('r.status', 'partially_issued')
                ->where('l.item_id', $itemId)
                ->whereRaw('(COALESCE(l.approved_quantity, 0) - COALESCE(l.issued_quantity, 0)) > 0')
                ->count();
        }

        return response()->json([
            'data' => InventoryProcurementRequestResponseTransformer::transform($procurementRequest),
            'meta' => [
                'replenishment' => [
                    'itemId'           => $itemId,
                    'pendingLineCount' => $pendingLineCount,
                ],
            ],
        ]);
    }

    public function procurementRequestAuditLogs(
        string $id,
        Request $request,
        ListInventoryProcurementRequestAuditLogsUseCase $useCase
    ): JsonResponse {
        $result = $useCase->execute(inventoryProcurementRequestId: $id, filters: $request->all());
        abort_if($result === null, 404, 'Procurement request not found.');

        return response()->json([
            'data' => array_map([InventoryProcurementRequestAuditLogResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function exportProcurementRequestAuditLogsCsv(
        string $id,
        Request $request,
        ListInventoryProcurementRequestAuditLogsUseCase $useCase
    ): StreamedResponse {
        $filters = $request->all();
        $filters['page'] = 1;
        $filters['perPage'] = 100;

        $firstPage = $useCase->execute(
            inventoryProcurementRequestId: $id,
            filters: $filters,
        );
        abort_if($firstPage === null, 404, 'Procurement request not found.');

        $safeId = $this->safeExportIdentifier($id, 'inventory-procurement-request');

        return $this->streamAuditLogCsvExport(
            baseName: sprintf('inventory_procurement_audit_%s_%s', $safeId, now()->format('Ymd_His')),
            firstPage: $firstPage,
            fetchPage: function (int $page) use ($useCase, $id, $filters): ?array {
                $pageFilters = $filters;
                $pageFilters['page'] = $page;

                return $useCase->execute(
                    inventoryProcurementRequestId: $id,
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

    private function toStockMovementPayload(array $validated): array
    {
        $fieldMap = [
            'itemId' => 'item_id',
            'movementType' => 'movement_type',
            'adjustmentDirection' => 'adjustment_direction',
            'batchId' => 'batch_id',
            'batchNumber' => 'batch_number',
            'lotNumber' => 'lot_number',
            'manufactureDate' => 'manufacture_date',
            'expiryDate' => 'expiry_date',
            'binLocation' => 'bin_location',
            'sourceSupplierId' => 'source_supplier_id',
            'sourceWarehouseId' => 'source_warehouse_id',
            'destinationWarehouseId' => 'destination_warehouse_id',
            'destinationDepartmentId' => 'destination_department_id',
            'quantity' => 'quantity',
            'reason' => 'reason',
            'notes' => 'notes',
            'metadata' => 'metadata',
            'occurredAt' => 'occurred_at',
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

    private function toProcurementRequestPayload(array $validated): array
    {
        $fieldMap = [
            'itemId' => 'item_id',
            'itemName' => 'item_name',
            'category' => 'category',
            'unit' => 'unit',
            'reorderLevel' => 'reorder_level',
            'requestedQuantity' => 'requested_quantity',
            'unitCostEstimate' => 'unit_cost_estimate',
            'neededBy' => 'needed_by',
            'supplierId' => 'supplier_id',
            'supplierName' => 'supplier_name',
            'sourceDepartmentRequisitionId' => 'source_department_requisition_id',
            'sourceDepartmentRequisitionLineId' => 'source_department_requisition_line_id',
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

    private function toStockReconciliationPayload(array $validated): array
    {
        $fieldMap = [
            'itemId' => 'item_id',
            'batchId' => 'batch_id',
            'countedStock' => 'counted_stock',
            'countedBatchQuantity' => 'counted_batch_quantity',
            'reason' => 'reason',
            'notes' => 'notes',
            'occurredAt' => 'occurred_at',
            'sessionReference' => 'session_reference',
            'metadata' => 'metadata',
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

    private function toItemPayload(array $validated): array
    {
        $fieldMap = [
            'itemCode' => 'item_code',
            'msdCode' => 'msd_code',
            'nhifCode' => 'nhif_code',
            'barcode' => 'barcode',
            'codes' => 'codes',
            'clinicalCatalogItemId' => 'clinical_catalog_item_id',
            'itemName' => 'item_name',
            'genericName' => 'generic_name',
            'dosageForm' => 'dosage_form',
            'strength' => 'strength',
            'category' => 'category',
            'subcategory' => 'subcategory',
            'venClassification' => 'ven_classification',
            'abcClassification' => 'abc_classification',
            'unit' => 'unit',
            'dispensingUnit' => 'dispensing_unit',
            'conversionFactor' => 'conversion_factor',
            'binLocation' => 'bin_location',
            'manufacturer' => 'manufacturer',
            'storageConditions' => 'storage_conditions',
            'requiresColdChain' => 'requires_cold_chain',
            'isControlledSubstance' => 'is_controlled_substance',
            'controlledSubstanceSchedule' => 'controlled_substance_schedule',
            'reorderLevel' => 'reorder_level',
            'maxStockLevel' => 'max_stock_level',
            'defaultWarehouseId' => 'default_warehouse_id',
            'defaultSupplierId' => 'default_supplier_id',
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

    private function toProcurementOrderPayload(array $validated): array
    {
        $fieldMap = [
            'purchaseOrderNumber' => 'purchase_order_number',
            'orderedQuantity' => 'ordered_quantity',
            'unitCostEstimate' => 'unit_cost_estimate',
            'neededBy' => 'needed_by',
            'supplierId' => 'supplier_id',
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

    private function toProcurementReceiptPayload(array $validated): array
    {
        $fieldMap = [
            'receivedQuantity' => 'received_quantity',
            'receivedUnitCost' => 'received_unit_cost',
            'warehouseId' => 'receiving_warehouse_id',
            'batchNumber' => 'batch_number',
            'lotNumber' => 'lot_number',
            'manufactureDate' => 'manufacture_date',
            'expiryDate' => 'expiry_date',
            'binLocation' => 'bin_location',
            'reason' => 'reason',
            'notes' => 'notes',
            'occurredAt' => 'occurred_at',
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

    /**
     * @return array<int, string>
     */
    private function stockLedgerCsvRow(array $movement): array
    {
        $actorId = $movement['actor_id'] ?? null;
        $item = is_array($movement['item'] ?? null) ? $movement['item'] : [];
        $metadata = is_array($movement['metadata'] ?? null) ? $movement['metadata'] : [];
        $isReconciliation = ($metadata['source'] ?? null) === 'stock_reconciliation';
        $source = InventoryStockMovementSourcePresenter::describe($movement);

        return [
            (string) ($movement['occurred_at'] ?? ''),
            (string) ($movement['movement_type'] ?? ''),
            (string) ($movement['adjustment_direction'] ?? ''),
            (string) ($movement['item_id'] ?? ''),
            (string) ($item['item_code'] ?? ''),
            (string) ($item['item_name'] ?? ''),
            (string) ($source['key'] ?? ''),
            (string) ($source['label'] ?? ''),
            (string) ($source['reference'] ?? ''),
            (string) ($source['detail'] ?? ''),
            (string) ($movement['source_type'] ?? ''),
            (string) ($movement['source_id'] ?? ''),
            (string) ($movement['procurement_request_id'] ?? ''),
            (string) ($movement['quantity'] ?? ''),
            (string) ($movement['quantity_delta'] ?? ''),
            (string) ($movement['stock_before'] ?? ''),
            (string) ($movement['stock_after'] ?? ''),
            $actorId === null ? 'system' : 'user',
            $actorId === null ? '' : (string) $actorId,
            (string) ($movement['reason'] ?? ''),
            (string) ($movement['notes'] ?? ''),
            $this->jsonForCsv($movement['metadata'] ?? []),
            $isReconciliation ? (string) ($metadata['sessionReference'] ?? '') : '',
            $isReconciliation ? (string) ($metadata['expectedStock'] ?? '') : '',
            $isReconciliation ? (string) ($metadata['countedStock'] ?? '') : '',
            $isReconciliation ? (string) ($metadata['varianceQuantity'] ?? '') : '',
            (string) ($movement['created_at'] ?? ''),
        ];
    }

    private function jsonForCsv(mixed $value): string
    {
        $encoded = json_encode($value ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return $encoded === false ? '{}' : $encoded;
    }
}
