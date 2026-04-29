<?php

namespace App\Support\CatalogGovernance;

use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryItemCategory;
use App\Modules\InventoryProcurement\Infrastructure\Models\InventoryItemModel;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class InventoryClinicalLinkGuard
{
    public function __construct(
        private readonly CatalogPlacementAuditor $placementAuditor,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>|null  $existing
     */
    public function assertPayloadCanPersist(array $payload, ?array $existing = null): void
    {
        $result = $this->validatePayload($payload, $existing);

        if ($result['errors'] !== []) {
            throw ValidationException::withMessages($result['errors']);
        }
    }

    public function assertModelCanPersist(InventoryItemModel $item): void
    {
        if (! Schema::hasTable('inventory_items')) {
            return;
        }

        $payload = [
            'item_code' => $item->item_code,
            'item_name' => $item->item_name,
            'category' => $item->category,
            'clinical_catalog_item_id' => $item->clinical_catalog_item_id,
        ];

        $this->assertPayloadCanPersist($payload);
    }

    /**
     * Offline sync uses this before accepting queued records from facilities.
     *
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>|null  $existing
     * @return array{errors: array<string, array<int, string>>, warnings: array<int, string>}
     */
    public function validateOfflineSyncPayload(array $payload, ?array $existing = null): array
    {
        return $this->validatePayload($payload, $existing);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>|null  $existing
     * @return array{errors: array<string, array<int, string>>, warnings: array<int, string>}
     */
    public function validatePayload(array $payload, ?array $existing = null): array
    {
        $merged = [
            ...(is_array($existing) ? $existing : []),
            ...$payload,
        ];

        $errors = [];
        $warnings = [];
        $category = $this->normalizeNullableText($merged['category'] ?? null);
        $supportsCatalogLink = Schema::hasColumn('inventory_items', 'clinical_catalog_item_id');
        $clinicalCatalogItemId = $this->normalizeNullableText(
            $merged['clinical_catalog_item_id']
                ?? $merged['clinicalCatalogItemId']
                ?? null,
        );

        if ($this->placementAuditor->looksLikeClinicalTest($merged)) {
            $errors['itemName'][] = 'This looks like a clinical test/procedure. Create CBC, urinalysis, blood culture, and similar services in Clinical Care Catalogs, not Inventory Items.';
        }

        if ($category === null) {
            return ['errors' => $errors, 'warnings' => $warnings];
        }

        $inventoryCategory = InventoryItemCategory::tryFrom($category);
        if (! $inventoryCategory instanceof InventoryItemCategory) {
            $errors['category'][] = 'Select a valid physical inventory category.';

            return ['errors' => $errors, 'warnings' => $warnings];
        }

        if ($supportsCatalogLink && $inventoryCategory === InventoryItemCategory::PHARMACEUTICAL && $clinicalCatalogItemId === null) {
            $errors['clinicalCatalogItemId'][] = 'Medicine inventory must link to an active formulary item in Clinical Care Catalogs.';
        }

        if ($supportsCatalogLink && $inventoryCategory !== InventoryItemCategory::PHARMACEUTICAL && $clinicalCatalogItemId !== null) {
            $errors['clinicalCatalogItemId'][] = 'Only pharmaceutical inventory can link to Clinical Care Catalogs. Lab reagents, radiology supplies, PPE, consumables, equipment, linen, food, and cleaning stock must keep this link empty.';
        }

        if ($supportsCatalogLink && $clinicalCatalogItemId !== null) {
            $catalogItem = ClinicalCatalogItemModel::query()->find($clinicalCatalogItemId);
            if ($catalogItem === null) {
                $errors['clinicalCatalogItemId'][] = 'The linked Clinical Care Catalog item does not exist.';
            } elseif ((string) $catalogItem->catalog_type !== ClinicalCatalogType::FORMULARY_ITEM->value) {
                $errors['clinicalCatalogItemId'][] = 'Inventory can only link to pharmaceutical formulary catalog items.';
            }
        }

        if ($inventoryCategory === InventoryItemCategory::PHARMACEUTICAL) {
            $msdCode = $this->normalizeNullableText($merged['msd_code'] ?? $merged['msdCode'] ?? null);
            $nhifCode = $this->normalizeNullableText($merged['nhif_code'] ?? $merged['nhifCode'] ?? null);

            if ($msdCode === null) {
                $warnings[] = 'MSD code is missing. This does not block saving, but procurement matching should be completed before go-live.';
            }

            if ($nhifCode === null) {
                $warnings[] = 'NHIF code is missing. This does not block saving, but billing/claims mapping should be completed before go-live.';
            }
        }

        return ['errors' => $errors, 'warnings' => $warnings];
    }

    private function normalizeNullableText(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }
}
