<?php

namespace App\Modules\Billing\Presentation\Http\Controllers;

use App\Modules\Billing\Infrastructure\Models\PriceBookEntryModel;
use App\Modules\Billing\Presentation\Http\Concerns\RespondsWithBillingApi;
use App\Modules\Billing\Presentation\Http\Requests\StoreChargeableItemRequest;
use App\Modules\Billing\Presentation\Http\Requests\StorePriceBookEntryRequest;
use App\Modules\Billing\Presentation\Http\Requests\UpdateChargeableItemRequest;
use App\Modules\Billing\Presentation\Http\Requests\UpdatePriceBookEntryRequest;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Infrastructure\Models\ChargeableItemModel;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChargeableItemController
{
    use RespondsWithBillingApi;

    public function __construct(
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = ChargeableItemModel::query()->with(['priceBookEntries', 'clinicalCatalogItem']);

        if ($request->filled('catalogType')) {
            $query->where('catalog_type', $request->string('catalogType')->value());
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->value());
        }

        $items = $query->orderBy('name')->get();

        return $this->successResponse(
            $items->map(fn (ChargeableItemModel $item) => $this->transform($item))->all(),
        );
    }

    public function store(StoreChargeableItemRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $tenantId = $this->platformScopeContext->tenantId();
        $facilityId = $this->platformScopeContext->facilityId();

        $clinicalCatalogItemId = $validated['clinicalCatalogItemId'] ?? null;
        $clinicalCatalogItem = null;

        if ($clinicalCatalogItemId !== null) {
            $clinicalCatalogItem = ClinicalCatalogItemModel::query()->find($clinicalCatalogItemId);
            if ($clinicalCatalogItem === null) {
                return $this->unprocessableResponse('Clinical catalog item not found.');
            }
        }

        $chargeableItem = $this->findOrCreateChargeableItem($validated, $clinicalCatalogItem, $tenantId, $facilityId);
        $chargeableItem->setRelation('clinicalCatalogItem', $clinicalCatalogItem);

        $priceBookEntry = new PriceBookEntryModel();
        $priceBookEntry->fill([
            'chargeable_item_id' => $chargeableItem->id,
            'tenant_id' => $tenantId,
            'facility_id' => $facilityId,
            'facility_tier' => $chargeableItem->facility_tier,
            'currency_code' => strtoupper($validated['currencyCode']),
            'unit_price' => $validated['unitPrice'],
            'tax_rate_percent' => $validated['taxRatePercent'] ?? 0,
            'is_taxable' => $validated['isTaxable'] ?? false,
            'effective_from' => $validated['effectiveFrom'] ?? null,
            'effective_to' => $validated['effectiveTo'] ?? null,
            'tariff_version' => 1,
            'status' => 'active',
        ]);
        $priceBookEntry->save();

        $chargeableItem->load('priceBookEntries');

        return $this->successResponse(
            data: $this->transform($chargeableItem),
            status: 201,
        );
    }

    public function show(string $chargeableItemId): JsonResponse
    {
        $item = ChargeableItemModel::query()->with(['priceBookEntries', 'clinicalCatalogItem'])->find($chargeableItemId);

        if ($item === null) {
            return $this->notFoundResponse('Chargeable item not found');
        }

        return $this->successResponse($this->transform($item));
    }

    public function update(string $chargeableItemId, UpdateChargeableItemRequest $request): JsonResponse
    {
        $item = ChargeableItemModel::query()->find($chargeableItemId);

        if ($item === null) {
            return $this->notFoundResponse('Chargeable item not found');
        }

        $item->update($request->validated());
        $item->load(['priceBookEntries', 'clinicalCatalogItem']);

        return $this->successResponse($this->transform($item));
    }

    public function updatePrice(string $chargeableItemId, string $priceId, UpdatePriceBookEntryRequest $request): JsonResponse
    {
        $item = ChargeableItemModel::query()->with('clinicalCatalogItem')->find($chargeableItemId);

        if ($item === null) {
            return $this->notFoundResponse('Chargeable item not found');
        }

        $price = PriceBookEntryModel::query()
            ->where('chargeable_item_id', $chargeableItemId)
            ->find($priceId);

        if ($price === null) {
            return $this->notFoundResponse('Price book entry not found');
        }

        $validated = $request->validated();

        $updateData = [];
        if (array_key_exists('currencyCode', $validated)) {
            $updateData['currency_code'] = strtoupper($validated['currencyCode']);
        }
        if (array_key_exists('unitPrice', $validated)) {
            $updateData['unit_price'] = $validated['unitPrice'];
        }
        if (array_key_exists('taxRatePercent', $validated)) {
            $updateData['tax_rate_percent'] = $validated['taxRatePercent'] ?? 0;
        }
        if (array_key_exists('isTaxable', $validated)) {
            $updateData['is_taxable'] = $validated['isTaxable'] ?? false;
        }
        if (array_key_exists('effectiveFrom', $validated)) {
            $updateData['effective_from'] = $validated['effectiveFrom'];
        }
        if (array_key_exists('effectiveTo', $validated)) {
            $updateData['effective_to'] = $validated['effectiveTo'];
        }
        if (array_key_exists('status', $validated)) {
            $updateData['status'] = $validated['status'];
        }
        if (array_key_exists('statusReason', $validated)) {
            $updateData['status_reason'] = $validated['statusReason'];
        }

        $price->update($updateData);
        $item->load('priceBookEntries');

        return $this->successResponse($this->transform($item));
    }

    public function storePrice(string $chargeableItemId, StorePriceBookEntryRequest $request): JsonResponse
    {
        $item = ChargeableItemModel::query()->with('clinicalCatalogItem')->find($chargeableItemId);

        if ($item === null) {
            return $this->notFoundResponse('Chargeable item not found');
        }

        $validated = $request->validated();

        $priceBookEntry = new PriceBookEntryModel();
        $priceBookEntry->fill([
            'chargeable_item_id' => $item->id,
            'tenant_id' => $this->platformScopeContext->tenantId(),
            'facility_id' => $this->platformScopeContext->facilityId(),
            'facility_tier' => $item->facility_tier,
            'payer_contract_id' => $validated['payerContractId'] ?? null,
            'currency_code' => strtoupper($validated['currencyCode']),
            'unit_price' => $validated['unitPrice'],
            'tax_rate_percent' => $validated['taxRatePercent'] ?? 0,
            'is_taxable' => $validated['isTaxable'] ?? false,
            'effective_from' => $validated['effectiveFrom'] ?? null,
            'effective_to' => $validated['effectiveTo'] ?? null,
            'tariff_version' => 1,
            'status' => 'active',
        ]);
        $priceBookEntry->save();

        $item->load('priceBookEntries');

        return $this->successResponse(
            data: $this->transform($item),
            status: 201,
        );
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function findOrCreateChargeableItem(
        array $validated,
        ?ClinicalCatalogItemModel $clinicalCatalogItem,
        ?string $tenantId,
        ?string $facilityId,
    ): ChargeableItemModel {
        if ($clinicalCatalogItem !== null) {
            $existing = ChargeableItemModel::query()->find($clinicalCatalogItem->id);
            if ($existing !== null) {
                if ($existing->clinical_catalog_item_id === null) {
                    $existing->clinical_catalog_item_id = $clinicalCatalogItem->id;
                    $existing->save();
                }

                return $existing;
            }

            $chargeableItem = new ChargeableItemModel();
            $chargeableItem->id = $clinicalCatalogItem->id;
            $chargeableItem->fill([
                'clinical_catalog_item_id' => $clinicalCatalogItem->id,
                'tenant_id' => $clinicalCatalogItem->tenant_id,
                'facility_id' => $clinicalCatalogItem->facility_id,
                'facility_tier' => $clinicalCatalogItem->facility_tier,
                'catalog_type' => $validated['catalogType'],
                'charge_model' => $validated['chargeModel'],
                'code' => $clinicalCatalogItem->code,
                'name' => $clinicalCatalogItem->name,
                'department_id' => $clinicalCatalogItem->department_id,
                'category' => $validated['category'] ?? $clinicalCatalogItem->category,
                'default_unit' => $validated['defaultUnit'] ?? $clinicalCatalogItem->unit,
                'status' => 'active',
            ]);
            $chargeableItem->save();

            return $chargeableItem;
        }

        $chargeableItem = new ChargeableItemModel();
        $chargeableItem->fill([
            'tenant_id' => $tenantId,
            'facility_id' => $facilityId,
            'catalog_type' => $validated['catalogType'],
            'charge_model' => $validated['chargeModel'],
            'code' => $validated['code'],
            'name' => $validated['name'],
            'department_id' => $validated['departmentId'] ?? null,
            'category' => $validated['category'] ?? null,
            'default_unit' => $validated['defaultUnit'] ?? null,
            'status' => 'active',
        ]);
        $chargeableItem->save();

        return $chargeableItem;
    }

    /**
     * @return array<string, mixed>
     */
    private function transform(ChargeableItemModel $item): array
    {
        // When linked to a clinical catalog item, read identity fields live
        // from the catalog so the response always reflects the latest
        // catalog data -- same pattern BillingServiceCatalogItemResponseTransformer
        // and InventoryItemResponseTransformer already use for their own
        // clinical_catalog_item_id links. The stored code/name/category/
        // default_unit columns are a creation-time snapshot, not the
        // authoritative value, for any row that's actually linked.
        $catalog = $item->relationLoaded('clinicalCatalogItem') ? $item->clinicalCatalogItem : null;
        $hasCatalogLink = $item->clinical_catalog_item_id !== null && $catalog !== null;

        return [
            'id' => (string) $item->id,
            'clinicalCatalogItemId' => $item->clinical_catalog_item_id === null ? null : (string) $item->clinical_catalog_item_id,
            'catalogType' => $item->catalog_type,
            'chargeModel' => $item->charge_model,
            'code' => $hasCatalogLink ? $catalog->code : $item->code,
            'name' => $hasCatalogLink ? $catalog->name : $item->name,
            'departmentId' => $hasCatalogLink
                ? ($catalog->department_id === null ? null : (string) $catalog->department_id)
                : ($item->department_id === null ? null : (string) $item->department_id),
            'category' => $hasCatalogLink ? ($catalog->category ?? $item->category) : $item->category,
            'defaultUnit' => $hasCatalogLink ? ($catalog->unit ?? $item->default_unit) : $item->default_unit,
            'status' => $item->status,
            'statusReason' => $item->status_reason,
            'prices' => $item->priceBookEntries
                ->sortByDesc(fn (PriceBookEntryModel $entry): string => (string) ($entry->effective_from ?? '0000-01-01'))
                ->values()
                ->map(fn (PriceBookEntryModel $entry): array => [
                    'id' => (string) $entry->id,
                    'currencyCode' => $entry->currency_code,
                    'unitPrice' => (float) $entry->unit_price,
                    'taxRatePercent' => $entry->tax_rate_percent === null ? null : (float) $entry->tax_rate_percent,
                    'isTaxable' => (bool) $entry->is_taxable,
                    'effectiveFrom' => $entry->effective_from?->toISOString(),
                    'effectiveTo' => $entry->effective_to?->toISOString(),
                    'status' => $entry->status,
                ])
                ->all(),
            'createdAt' => $item->created_at?->toISOString(),
            'updatedAt' => $item->updated_at?->toISOString(),
        ];
    }
}
