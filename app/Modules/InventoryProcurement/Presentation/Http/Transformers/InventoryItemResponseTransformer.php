<?php

namespace App\Modules\InventoryProcurement\Presentation\Http\Transformers;

use App\Support\CatalogGovernance\StandardsCodeSupport;

class InventoryItemResponseTransformer
{
    public static function transform(array $item): array
    {
        return [
            'id' => $item['id'] ?? null,
            'itemCode' => $item['item_code'] ?? null,
            'msdCode' => $item['msd_code'] ?? null,
            'nhifCode' => $item['nhif_code'] ?? null,
            'barcode' => $item['barcode'] ?? null,
            'codes' => is_array($item['codes'] ?? null) ? $item['codes'] : null,
            'standardsWarnings' => app(StandardsCodeSupport::class)->warningsForInventoryItem($item),
            'clinicalCatalogItemId' => $item['clinical_catalog_item_id'] ?? null,
            'itemName' => $item['item_name'] ?? null,
            'genericName' => $item['generic_name'] ?? null,
            'dosageForm' => $item['dosage_form'] ?? null,
            'strength' => $item['strength'] ?? null,
            'category' => $item['category'] ?? null,
            'subcategory' => $item['subcategory'] ?? null,
            'venClassification' => $item['ven_classification'] ?? null,
            'abcClassification' => $item['abc_classification'] ?? null,
            'unit' => $item['unit'] ?? null,
            'dispensingUnit' => $item['dispensing_unit'] ?? null,
            'conversionFactor' => $item['conversion_factor'] ?? null,
            'binLocation' => $item['bin_location'] ?? null,
            'manufacturer' => $item['manufacturer'] ?? null,
            'storageConditions' => $item['storage_conditions'] ?? null,
            'requiresColdChain' => (bool) ($item['requires_cold_chain'] ?? false),
            'isControlledSubstance' => (bool) ($item['is_controlled_substance'] ?? false),
            'controlledSubstanceSchedule' => $item['controlled_substance_schedule'] ?? null,
            'defaultWarehouseId' => $item['default_warehouse_id'] ?? null,
            'defaultSupplierId' => $item['default_supplier_id'] ?? null,
            'currentStock' => $item['current_stock'] ?? null,
            'reorderLevel' => $item['reorder_level'] ?? null,
            'maxStockLevel' => $item['max_stock_level'] ?? null,
            'movementCount' => (int) ($item['stock_movements_count'] ?? 0),
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
