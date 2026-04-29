<?php

namespace App\Modules\Pharmacy\Presentation\Http\Transformers;

class PharmacyMedicationAvailabilityResponseTransformer
{
    public static function transform(?array $item): ?array
    {
        if ($item === null) {
            return null;
        }

        return [
            'id' => $item['id'] ?? null,
            'itemCode' => $item['item_code'] ?? null,
            'itemName' => $item['item_name'] ?? null,
            'unit' => $item['unit'] ?? null,
            'currentStock' => $item['available_stock'] ?? $item['current_stock'] ?? null,
            'onHandStock' => $item['current_stock'] ?? null,
            'status' => $item['status'] ?? null,
            'stockState' => $item['stock_state'] ?? self::stockState($item),
            'batchTrackingMode' => $item['batch_tracking_mode'] ?? 'untracked',
            'blockedBatchQuantity' => $item['blocked_batch_quantity'] ?? 0,
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
