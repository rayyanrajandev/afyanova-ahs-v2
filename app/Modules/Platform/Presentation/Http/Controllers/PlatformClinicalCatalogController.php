<?php

namespace App\Modules\Platform\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Application\Exceptions\DuplicateClinicalCatalogCodeException;
use App\Modules\Platform\Application\Exceptions\TenantScopeRequiredForIsolationException;
use App\Modules\Platform\Application\Services\ClinicalCatalogConsumptionRecipeService;
use App\Modules\Platform\Application\UseCases\CreateClinicalCatalogItemUseCase;
use App\Modules\Platform\Application\UseCases\GetClinicalCatalogItemUseCase;
use App\Modules\Platform\Application\UseCases\ListClinicalCatalogItemAuditLogsUseCase;
use App\Modules\Platform\Application\UseCases\ListClinicalCatalogItemsUseCase;
use App\Modules\Platform\Application\UseCases\ListClinicalCatalogItemStatusCountsUseCase;
use App\Modules\Platform\Application\UseCases\UpdateClinicalCatalogItemStatusUseCase;
use App\Modules\Platform\Application\UseCases\UpdateClinicalCatalogItemUseCase;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use App\Modules\Platform\Presentation\Http\Requests\StoreClinicalCatalogItemRequest;
use App\Modules\Platform\Presentation\Http\Requests\UpdateClinicalCatalogItemRequest;
use App\Modules\Platform\Presentation\Http\Requests\UpdateClinicalCatalogItemStatusRequest;
use App\Modules\Platform\Presentation\Http\Transformers\ClinicalCatalogItemAuditLogResponseTransformer;
use App\Modules\Platform\Presentation\Http\Transformers\ClinicalCatalogItemResponseTransformer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PlatformClinicalCatalogController extends Controller
{
    private const AUDIT_CSV_SCHEMA_VERSION = 'audit-log-csv.v1';

    private const AUDIT_CSV_COLUMNS = ['createdAt', 'action', 'actorType', 'actorId', 'changes', 'metadata'];

    public function labTests(Request $request, ListClinicalCatalogItemsUseCase $useCase): JsonResponse
    {
        return $this->listCatalogItems(ClinicalCatalogType::LAB_TEST->value, $request, $useCase);
    }

    public function labTestStatusCounts(
        Request $request,
        ListClinicalCatalogItemStatusCountsUseCase $useCase
    ): JsonResponse {
        return $this->catalogStatusCounts(ClinicalCatalogType::LAB_TEST->value, $request, $useCase);
    }

    public function labTestConsumptionInventoryOptions(
        Request $request,
        ClinicalCatalogConsumptionRecipeService $recipeService
    ): JsonResponse {
        return $this->consumptionInventoryOptions(ClinicalCatalogType::LAB_TEST->value, $request, $recipeService);
    }

    public function storeLabTest(StoreClinicalCatalogItemRequest $request, CreateClinicalCatalogItemUseCase $useCase): JsonResponse
    {
        return $this->storeCatalogItem(ClinicalCatalogType::LAB_TEST->value, $request->validated(), $request, $useCase);
    }

    public function labTest(string $id, GetClinicalCatalogItemUseCase $useCase): JsonResponse
    {
        return $this->showCatalogItem(ClinicalCatalogType::LAB_TEST->value, $id, $useCase);
    }

    public function labTestConsumptionRecipe(string $id, ClinicalCatalogConsumptionRecipeService $recipeService): JsonResponse
    {
        return $this->consumptionRecipe(ClinicalCatalogType::LAB_TEST->value, $id, $recipeService);
    }

    public function syncLabTestConsumptionRecipe(
        string $id,
        Request $request,
        ClinicalCatalogConsumptionRecipeService $recipeService
    ): JsonResponse {
        return $this->syncConsumptionRecipe(ClinicalCatalogType::LAB_TEST->value, $id, $request, $recipeService);
    }

    public function updateLabTest(
        string $id,
        UpdateClinicalCatalogItemRequest $request,
        UpdateClinicalCatalogItemUseCase $useCase
    ): JsonResponse {
        return $this->updateCatalogItem(ClinicalCatalogType::LAB_TEST->value, $id, $request->validated(), $request, $useCase);
    }

    public function updateLabTestStatus(
        string $id,
        UpdateClinicalCatalogItemStatusRequest $request,
        UpdateClinicalCatalogItemStatusUseCase $useCase
    ): JsonResponse {
        return $this->updateCatalogItemStatus(ClinicalCatalogType::LAB_TEST->value, $id, $request, $useCase);
    }

    public function labTestAuditLogs(
        string $id,
        Request $request,
        ListClinicalCatalogItemAuditLogsUseCase $useCase
    ): JsonResponse {
        return $this->catalogAuditLogs(ClinicalCatalogType::LAB_TEST->value, $id, $request, $useCase);
    }

    public function exportLabTestAuditLogsCsv(
        string $id,
        Request $request,
        ListClinicalCatalogItemAuditLogsUseCase $useCase
    ): StreamedResponse {
        return $this->exportCatalogAuditLogsCsv(ClinicalCatalogType::LAB_TEST->value, 'lab-test', $id, $request, $useCase);
    }

    public function radiologyProcedures(Request $request, ListClinicalCatalogItemsUseCase $useCase): JsonResponse
    {
        return $this->listCatalogItems(ClinicalCatalogType::RADIOLOGY_PROCEDURE->value, $request, $useCase);
    }

    public function radiologyProcedureStatusCounts(
        Request $request,
        ListClinicalCatalogItemStatusCountsUseCase $useCase
    ): JsonResponse {
        return $this->catalogStatusCounts(ClinicalCatalogType::RADIOLOGY_PROCEDURE->value, $request, $useCase);
    }

    public function radiologyConsumptionInventoryOptions(
        Request $request,
        ClinicalCatalogConsumptionRecipeService $recipeService
    ): JsonResponse {
        return $this->consumptionInventoryOptions(ClinicalCatalogType::RADIOLOGY_PROCEDURE->value, $request, $recipeService);
    }

    public function storeRadiologyProcedure(
        StoreClinicalCatalogItemRequest $request,
        CreateClinicalCatalogItemUseCase $useCase
    ): JsonResponse {
        return $this->storeCatalogItem(ClinicalCatalogType::RADIOLOGY_PROCEDURE->value, $request->validated(), $request, $useCase);
    }

    public function radiologyProcedure(string $id, GetClinicalCatalogItemUseCase $useCase): JsonResponse
    {
        return $this->showCatalogItem(ClinicalCatalogType::RADIOLOGY_PROCEDURE->value, $id, $useCase);
    }

    public function radiologyConsumptionRecipe(string $id, ClinicalCatalogConsumptionRecipeService $recipeService): JsonResponse
    {
        return $this->consumptionRecipe(ClinicalCatalogType::RADIOLOGY_PROCEDURE->value, $id, $recipeService);
    }

    public function syncRadiologyConsumptionRecipe(
        string $id,
        Request $request,
        ClinicalCatalogConsumptionRecipeService $recipeService
    ): JsonResponse {
        return $this->syncConsumptionRecipe(ClinicalCatalogType::RADIOLOGY_PROCEDURE->value, $id, $request, $recipeService);
    }

    public function updateRadiologyProcedure(
        string $id,
        UpdateClinicalCatalogItemRequest $request,
        UpdateClinicalCatalogItemUseCase $useCase
    ): JsonResponse {
        return $this->updateCatalogItem(ClinicalCatalogType::RADIOLOGY_PROCEDURE->value, $id, $request->validated(), $request, $useCase);
    }

    public function updateRadiologyProcedureStatus(
        string $id,
        UpdateClinicalCatalogItemStatusRequest $request,
        UpdateClinicalCatalogItemStatusUseCase $useCase
    ): JsonResponse {
        return $this->updateCatalogItemStatus(ClinicalCatalogType::RADIOLOGY_PROCEDURE->value, $id, $request, $useCase);
    }

    public function radiologyProcedureAuditLogs(
        string $id,
        Request $request,
        ListClinicalCatalogItemAuditLogsUseCase $useCase
    ): JsonResponse {
        return $this->catalogAuditLogs(ClinicalCatalogType::RADIOLOGY_PROCEDURE->value, $id, $request, $useCase);
    }

    public function exportRadiologyProcedureAuditLogsCsv(
        string $id,
        Request $request,
        ListClinicalCatalogItemAuditLogsUseCase $useCase
    ): StreamedResponse {
        return $this->exportCatalogAuditLogsCsv(ClinicalCatalogType::RADIOLOGY_PROCEDURE->value, 'radiology-procedure', $id, $request, $useCase);
    }

    public function theatreProcedures(Request $request, ListClinicalCatalogItemsUseCase $useCase): JsonResponse
    {
        return $this->listCatalogItems(ClinicalCatalogType::THEATRE_PROCEDURE->value, $request, $useCase);
    }

    public function theatreProcedureStatusCounts(
        Request $request,
        ListClinicalCatalogItemStatusCountsUseCase $useCase
    ): JsonResponse {
        return $this->catalogStatusCounts(ClinicalCatalogType::THEATRE_PROCEDURE->value, $request, $useCase);
    }

    public function theatreConsumptionInventoryOptions(
        Request $request,
        ClinicalCatalogConsumptionRecipeService $recipeService
    ): JsonResponse {
        return $this->consumptionInventoryOptions(ClinicalCatalogType::THEATRE_PROCEDURE->value, $request, $recipeService);
    }

    public function storeTheatreProcedure(
        StoreClinicalCatalogItemRequest $request,
        CreateClinicalCatalogItemUseCase $useCase
    ): JsonResponse {
        return $this->storeCatalogItem(ClinicalCatalogType::THEATRE_PROCEDURE->value, $request->validated(), $request, $useCase);
    }

    public function theatreProcedure(string $id, GetClinicalCatalogItemUseCase $useCase): JsonResponse
    {
        return $this->showCatalogItem(ClinicalCatalogType::THEATRE_PROCEDURE->value, $id, $useCase);
    }

    public function theatreConsumptionRecipe(string $id, ClinicalCatalogConsumptionRecipeService $recipeService): JsonResponse
    {
        return $this->consumptionRecipe(ClinicalCatalogType::THEATRE_PROCEDURE->value, $id, $recipeService);
    }

    public function syncTheatreConsumptionRecipe(
        string $id,
        Request $request,
        ClinicalCatalogConsumptionRecipeService $recipeService
    ): JsonResponse {
        return $this->syncConsumptionRecipe(ClinicalCatalogType::THEATRE_PROCEDURE->value, $id, $request, $recipeService);
    }

    public function updateTheatreProcedure(
        string $id,
        UpdateClinicalCatalogItemRequest $request,
        UpdateClinicalCatalogItemUseCase $useCase
    ): JsonResponse {
        return $this->updateCatalogItem(ClinicalCatalogType::THEATRE_PROCEDURE->value, $id, $request->validated(), $request, $useCase);
    }

    public function updateTheatreProcedureStatus(
        string $id,
        UpdateClinicalCatalogItemStatusRequest $request,
        UpdateClinicalCatalogItemStatusUseCase $useCase
    ): JsonResponse {
        return $this->updateCatalogItemStatus(ClinicalCatalogType::THEATRE_PROCEDURE->value, $id, $request, $useCase);
    }

    public function theatreProcedureAuditLogs(
        string $id,
        Request $request,
        ListClinicalCatalogItemAuditLogsUseCase $useCase
    ): JsonResponse {
        return $this->catalogAuditLogs(ClinicalCatalogType::THEATRE_PROCEDURE->value, $id, $request, $useCase);
    }

    public function exportTheatreProcedureAuditLogsCsv(
        string $id,
        Request $request,
        ListClinicalCatalogItemAuditLogsUseCase $useCase
    ): StreamedResponse {
        return $this->exportCatalogAuditLogsCsv(ClinicalCatalogType::THEATRE_PROCEDURE->value, 'theatre-procedure', $id, $request, $useCase);
    }

    public function formularyItems(Request $request, ListClinicalCatalogItemsUseCase $useCase): JsonResponse
    {
        return $this->listCatalogItems(ClinicalCatalogType::FORMULARY_ITEM->value, $request, $useCase);
    }

    public function formularyItemStatusCounts(
        Request $request,
        ListClinicalCatalogItemStatusCountsUseCase $useCase
    ): JsonResponse {
        return $this->catalogStatusCounts(ClinicalCatalogType::FORMULARY_ITEM->value, $request, $useCase);
    }

    public function storeFormularyItem(StoreClinicalCatalogItemRequest $request, CreateClinicalCatalogItemUseCase $useCase): JsonResponse
    {
        return $this->storeCatalogItem(ClinicalCatalogType::FORMULARY_ITEM->value, $request->validated(), $request, $useCase);
    }

    public function formularyItem(string $id, GetClinicalCatalogItemUseCase $useCase): JsonResponse
    {
        return $this->showCatalogItem(ClinicalCatalogType::FORMULARY_ITEM->value, $id, $useCase);
    }

    public function updateFormularyItem(
        string $id,
        UpdateClinicalCatalogItemRequest $request,
        UpdateClinicalCatalogItemUseCase $useCase
    ): JsonResponse {
        return $this->updateCatalogItem(ClinicalCatalogType::FORMULARY_ITEM->value, $id, $request->validated(), $request, $useCase);
    }

    public function updateFormularyItemStatus(
        string $id,
        UpdateClinicalCatalogItemStatusRequest $request,
        UpdateClinicalCatalogItemStatusUseCase $useCase
    ): JsonResponse {
        return $this->updateCatalogItemStatus(ClinicalCatalogType::FORMULARY_ITEM->value, $id, $request, $useCase);
    }

    public function formularyItemAuditLogs(
        string $id,
        Request $request,
        ListClinicalCatalogItemAuditLogsUseCase $useCase
    ): JsonResponse {
        return $this->catalogAuditLogs(ClinicalCatalogType::FORMULARY_ITEM->value, $id, $request, $useCase);
    }

    public function exportFormularyItemAuditLogsCsv(
        string $id,
        Request $request,
        ListClinicalCatalogItemAuditLogsUseCase $useCase
    ): StreamedResponse {
        return $this->exportCatalogAuditLogsCsv(ClinicalCatalogType::FORMULARY_ITEM->value, 'formulary-item', $id, $request, $useCase);
    }

    private function listCatalogItems(
        string $catalogType,
        Request $request,
        ListClinicalCatalogItemsUseCase $useCase
    ): JsonResponse {
        $result = $useCase->execute($catalogType, $request->all());

        return response()->json([
            'data' => array_map([ClinicalCatalogItemResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    private function catalogStatusCounts(
        string $catalogType,
        Request $request,
        ListClinicalCatalogItemStatusCountsUseCase $useCase
    ): JsonResponse {
        $counts = $useCase->execute($catalogType, $request->all());

        return response()->json([
            'data' => $counts,
        ]);
    }

    private function consumptionInventoryOptions(
        string $catalogType,
        Request $request,
        ClinicalCatalogConsumptionRecipeService $recipeService
    ): JsonResponse {
        return response()->json([
            'data' => $recipeService->eligibleInventoryOptions(
                catalogType: $catalogType,
                query: $request->query('q'),
                limit: (int) $request->query('limit', 100),
            ),
        ]);
    }

    private function consumptionRecipe(
        string $catalogType,
        string $id,
        ClinicalCatalogConsumptionRecipeService $recipeService
    ): JsonResponse {
        $recipe = $recipeService->recipe($id, $catalogType);
        abort_if($recipe === null, 404, 'Clinical catalog item not found.');

        return response()->json([
            'data' => $recipe,
        ]);
    }

    private function syncConsumptionRecipe(
        string $catalogType,
        string $id,
        Request $request,
        ClinicalCatalogConsumptionRecipeService $recipeService
    ): JsonResponse {
        $validated = $request->validate([
            'items' => ['present', 'array', 'max:50'],
            'items.*.inventoryItemId' => ['required', 'uuid'],
            'items.*.quantityPerOrder' => ['required', 'numeric', 'gt:0'],
            'items.*.unit' => ['nullable', 'string', 'max:40'],
            'items.*.wasteFactorPercent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.consumptionStage' => ['nullable', 'string', 'max:40'],
            'items.*.notes' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $recipe = $recipeService->syncRecipe(
                clinicalCatalogItemId: $id,
                catalogType: $catalogType,
                items: $validated['items'] ?? [],
                actorId: $request->user()?->id,
            );
        } catch (ValidationException $exception) {
            throw $exception;
        }

        abort_if($recipe === null, 404, 'Clinical catalog item not found.');

        return response()->json([
            'data' => $recipe,
        ]);
    }

    private function storeCatalogItem(
        string $catalogType,
        array $validated,
        Request $request,
        CreateClinicalCatalogItemUseCase $useCase
    ): JsonResponse {
        try {
            $item = $useCase->execute(
                catalogType: $catalogType,
                payload: $this->toPersistencePayload($validated),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (DuplicateClinicalCatalogCodeException $exception) {
            return $this->validationError('code', $exception->getMessage());
        }

        return response()->json([
            'data' => ClinicalCatalogItemResponseTransformer::transform($item),
        ], 201);
    }

    private function showCatalogItem(string $catalogType, string $id, GetClinicalCatalogItemUseCase $useCase): JsonResponse
    {
        $item = $useCase->execute($id, $catalogType);
        abort_if($item === null, 404, 'Clinical catalog item not found.');

        return response()->json([
            'data' => ClinicalCatalogItemResponseTransformer::transform($item),
        ]);
    }

    private function updateCatalogItem(
        string $catalogType,
        string $id,
        array $validated,
        Request $request,
        UpdateClinicalCatalogItemUseCase $useCase
    ): JsonResponse {
        try {
            $item = $useCase->execute(
                id: $id,
                catalogType: $catalogType,
                payload: $this->toPersistencePayload($validated),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        } catch (DuplicateClinicalCatalogCodeException $exception) {
            return $this->validationError('code', $exception->getMessage());
        }

        abort_if($item === null, 404, 'Clinical catalog item not found.');

        return response()->json([
            'data' => ClinicalCatalogItemResponseTransformer::transform($item),
        ]);
    }

    private function updateCatalogItemStatus(
        string $catalogType,
        string $id,
        UpdateClinicalCatalogItemStatusRequest $request,
        UpdateClinicalCatalogItemStatusUseCase $useCase
    ): JsonResponse {
        try {
            $item = $useCase->execute(
                id: $id,
                catalogType: $catalogType,
                status: $request->string('status')->value(),
                reason: $request->input('reason'),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        }

        abort_if($item === null, 404, 'Clinical catalog item not found.');

        return response()->json([
            'data' => ClinicalCatalogItemResponseTransformer::transform($item),
        ]);
    }

    private function catalogAuditLogs(
        string $catalogType,
        string $id,
        Request $request,
        ListClinicalCatalogItemAuditLogsUseCase $useCase
    ): JsonResponse {
        $result = $useCase->execute($id, $catalogType, $request->all());
        abort_if($result === null, 404, 'Clinical catalog item not found.');

        return response()->json([
            'data' => array_map([ClinicalCatalogItemAuditLogResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    private function exportCatalogAuditLogsCsv(
        string $catalogType,
        string $catalogLabel,
        string $id,
        Request $request,
        ListClinicalCatalogItemAuditLogsUseCase $useCase
    ): StreamedResponse {
        $filters = $request->all();
        $filters['page'] = 1;
        $filters['perPage'] = 100;

        $firstPage = $useCase->execute($id, $catalogType, $filters);
        abort_if($firstPage === null, 404, 'Clinical catalog item not found.');

        $safeId = $this->safeExportIdentifier($id, $catalogLabel);

        return $this->streamAuditLogCsvExport(
            baseName: sprintf(
                'platform_clinical_catalog_%s_audit_%s_%s',
                str_replace('-', '_', $catalogLabel),
                $safeId,
                now()->format('Ymd_His'),
            ),
            firstPage: $firstPage,
            fetchPage: function (int $page) use ($useCase, $catalogType, $id, $filters): ?array {
                $pageFilters = $filters;
                $pageFilters['page'] = $page;

                return $useCase->execute($id, $catalogType, $pageFilters);
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
            'code' => 'code',
            'name' => 'name',
            'facilityTier' => 'facility_tier',
            'departmentId' => 'department_id',
            'category' => 'category',
            'unit' => 'unit',
            'billingServiceCode' => 'billing_service_code',
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
