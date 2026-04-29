<?php

namespace App\Modules\Billing\Presentation\Http\Transformers;

class BillingServiceCatalogItemAuditLogResponseTransformer
{
    public static function transform(array $log): array
    {
        return [
            'id' => $log['id'] ?? null,
            'billingServiceCatalogItemId' => $log['billing_service_catalog_item_id'] ?? null,
            'actorId' => $log['actor_id'] ?? null,
            'action' => $log['action'] ?? null,
            'changes' => $log['changes'] ?? null,
            'metadata' => $log['metadata'] ?? null,
            'createdAt' => $log['created_at'] ?? null,
        ];
    }
}
