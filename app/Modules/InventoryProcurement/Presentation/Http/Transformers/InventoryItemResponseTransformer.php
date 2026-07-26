<?php

namespace App\Modules\InventoryProcurement\Presentation\Http\Transformers;

use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Support\CatalogGovernance\StandardsCodeSupport;

class InventoryItemResponseTransformer
{
    public static function transform(array $item): array
    {
        // When linked to a clinical catalog, read identity fields from the catalog item
        // to ensure the response always reflects the latest catalog data.
        $catalog = is_array($item['clinical_catalog_item'] ?? null) ? $item['clinical_catalog_item'] : null;
        $catalogMeta = is_array($catalog['metadata'] ?? null) ? $catalog['metadata'] : [];
        $catalogCodes = is_array($catalog['codes'] ?? null) ? $catalog['codes'] : [];
        $hasCatalogLink = ($item['clinical_catalog_item_id'] ?? null) !== null && $catalog !== null;

        // Inventory_MasterData_Alignment_Plan.md Phase 2. Gated behind a feature flag
        // so the cutover to catalog-owned compliance/storage fields can be switched
        // off instantly without a deploy if something regresses. When the flag is off,
        // behavior is byte-for-byte identical to before Phase 2 shipped.
        $catalogFirstReadsEnabled = $hasCatalogLink
            && app(FeatureFlagResolverInterface::class)->isEnabled('inventory.catalog_first_reads');

        return [
            'id' => $item['id'] ?? null,
            'itemCode' => $item['item_code'] ?? null,
            'msdCode' => $item['msd_code'] ?? null,
            'nhifCode' => $item['nhif_code'] ?? null,
            'barcode' => $item['barcode'] ?? null,
            'codes' => $hasCatalogLink && $catalogCodes !== [] ? $catalogCodes : (is_array($item['codes'] ?? null) ? $item['codes'] : null),
            'standardsWarnings' => app(StandardsCodeSupport::class)->warningsForInventoryItem($item),
            'clinicalCatalogItemId' => $item['clinical_catalog_item_id'] ?? null,
            'itemName' => $hasCatalogLink ? trim((string) ($catalog['name'] ?? '')) : ($item['item_name'] ?? null),
            // generic_name/dosage_form/strength dropped from inventory_items in Phase 3:
            // Pharmaceutical-only and always catalog-linked, so there's no item-column
            // fallback left -- catalog or nothing, unconditionally (not flag-gated: once
            // the column is gone there's no "old behavior" left to preserve by keeping
            // this off).
            'genericName' => $hasCatalogLink
                ? ($catalog['generic_name'] ?? $catalogMeta['genericName'] ?? $catalogMeta['generic_name'] ?? null)
                : null,
            'dosageForm' => $hasCatalogLink
                ? ($catalog['dosage_form'] ?? $catalogMeta['dosageForm'] ?? $catalogMeta['dosage_form'] ?? null)
                : null,
            'strength' => $hasCatalogLink
                ? ($catalog['strength'] ?? $catalogMeta['strength'] ?? null)
                : null,
            'category' => $item['category'] ?? null,
            'subcategory' => $hasCatalogLink
                ? ($catalog['category'] ?? $item['subcategory'] ?? null)
                : ($item['subcategory'] ?? null),
            'venClassification' => $item['ven_classification'] ?? null,
            'abcClassification' => $item['abc_classification'] ?? null,
            'unit' => $hasCatalogLink
                ? ($catalogMeta['stockUnit'] ?? $catalogMeta['stock_unit'] ?? $catalog['unit'] ?? $item['unit'] ?? null)
                : ($item['unit'] ?? null),
            'dispensingUnit' => $hasCatalogLink
                ? ($catalogMeta['dispensingUnit'] ?? $catalogMeta['dispensing_unit'] ?? $catalog['unit'] ?? $item['dispensing_unit'] ?? null)
                : ($item['dispensing_unit'] ?? null),
            'conversionFactor' => $hasCatalogLink
                ? ($catalogMeta['conversionFactor'] ?? $catalogMeta['conversion_factor'] ?? $item['conversion_factor'] ?? null)
                : ($item['conversion_factor'] ?? null),
            'binLocation' => $item['bin_location'] ?? null,
            'manufacturer' => $item['manufacturer'] ?? null,
            // Storage/compliance fields are the new part of Phase 2: these never read
            // from the catalog before. Catalog value wins only when populated (Phase 1's
            // backfill left genuine conflicts null on purpose); otherwise fall back to the
            // inventory row so a linked item with a not-yet-backfilled catalog entry
            // doesn't silently lose data it already had.
            'storageConditions' => $catalogFirstReadsEnabled && $catalog['storage_conditions'] !== null
                ? $catalog['storage_conditions']
                : ($item['storage_conditions'] ?? null),
            'requiresColdChain' => $catalogFirstReadsEnabled && $catalog['requires_cold_chain'] !== null
                ? (bool) $catalog['requires_cold_chain']
                : (bool) ($item['requires_cold_chain'] ?? false),
            // is_controlled_substance/controlled_substance_schedule dropped from
            // inventory_items in Phase 3 -- same reasoning as generic_name above.
            'isControlledSubstance' => $hasCatalogLink && (bool) ($catalog['is_controlled_substance'] ?? false),
            'controlledSubstanceSchedule' => $hasCatalogLink ? ($catalog['controlled_substance_schedule'] ?? null) : null,
            'defaultWarehouseId' => $item['default_warehouse_id'] ?? null,
            'defaultSupplierId' => $item['default_supplier_id'] ?? null,
            'currentStock' => $item['current_stock'] ?? null,
            'reorderLevel' => $item['reorder_level'] ?? null,
            'maxStockLevel' => $item['max_stock_level'] ?? null,
            'movementCount' => (int) ($item['stock_movements_count'] ?? 0),
            'openingStockMovementCount' => (int) ($item['opening_stock_movements_count'] ?? 0),
            'status' => $item['status'] ?? null,
            'statusReason' => $item['status_reason'] ?? null,
            'stockState' => self::stockState($item),
            'createdAt' => $item['created_at'] ?? null,
            'updatedAt' => $item['updated_at'] ?? null,
        ];
    }

    private static function stockState(array $item): string
    {
        $current = (float) ($item['current_stock'] ?? 0);
        $reorder = (float) ($item['reorder_level'] ?? 0);

        if ($current <= 0) {
            return 'out_of_stock';
        }

        if ($current <= $reorder) {
            return 'low_stock';
        }

        return 'healthy';
    }
}
