<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Application\Support\BillingCatalogDepartmentResolver;
use App\Modules\Billing\Application\Support\BillingClinicalCatalogIdentitySynchronizer;
use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemAuditLogRepositoryInterface;
use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Support\PlatformScopeQueryApplier;
use App\Support\CatalogGovernance\StandardsCodeSupport;

class BulkCreateBillingServiceCatalogItemsFromCatalogUseCase
{
    public function __construct(
        private readonly BillingServiceCatalogItemRepositoryInterface $repository,
        private readonly BillingServiceCatalogItemAuditLogRepositoryInterface $auditLogRepository,
        private readonly BillingClinicalCatalogIdentitySynchronizer $clinicalCatalogIdentitySynchronizer,
        private readonly BillingCatalogDepartmentResolver $departmentResolver,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
        private readonly StandardsCodeSupport $standardsCodeSupport,
        private readonly FeatureFlagResolverInterface $featureFlagResolver,
        private readonly PlatformScopeQueryApplier $platformScopeQueryApplier,
    ) {}

    /**
     * Bulk-create or update billing service catalog items from active clinical catalog definitions.
     *
     * Supports all 4 clinical catalog types: lab_test, radiology_procedure, theatre_procedure, formulary_item.
     *
     * @param  list<string>|null  $catalogItemIds  Optional subset of catalog item UUIDs; null = all eligible
     * @param  string|null  $defaultCurrencyCode  Currency code for new items (defaults to TZS)
     * @param  int|null  $actorId  Staff user performing the sync
     * @param  list<string>|null  $catalogTypes  Optional subset of catalog types to sync; null = all eligible
     * @return array{created: int, updated: int, errors: list<array{catalogItemId: string, code: string, name: string, error: string}>}
     */
    public function execute(
        ?array $catalogItemIds = null,
        ?string $defaultCurrencyCode = null,
        ?int $actorId = null,
        ?array $catalogTypes = null,
    ): array {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $tenantId = $this->platformScopeContext->tenantId();
        $facilityId = $this->platformScopeContext->facilityId();

        $defaultCurrencyCode = strtoupper(trim((string) ($defaultCurrencyCode ?: ''))) ?: 'TZS';

        $eligibleTypes = (is_array($catalogTypes) && $catalogTypes !== [])
            ? $catalogTypes
            : ['lab_test', 'radiology_procedure', 'theatre_procedure', 'formulary_item'];

        $catalogQuery = ClinicalCatalogItemModel::query()
            ->whereIn('catalog_type', $eligibleTypes)
            ->where('status', 'active')
            ->orderBy('name');

        if (is_array($catalogItemIds) && count($catalogItemIds) > 0) {
            $catalogQuery->whereIn('id', $catalogItemIds);
        }

        if ($this->featureFlagResolver->isEnabled('multi_facility_isolation')) {
            $this->platformScopeQueryApplier->apply($catalogQuery);
        }

        $catalogItems = $catalogQuery->get();

        // Bulk preload: existing linked billing items (1 query instead of N)
        $catalogItemIdsAll = $catalogItems->pluck('id')->filter()->values()->all();
        $existingLinkedMap = $this->repository->listLatestByClinicalCatalogItemIds(
            $catalogItemIdsAll,
            $tenantId,
            $facilityId,
        );

        // Bulk preload: existing service codes for uniqueness checks (1 query instead of N×while)
        $existingServiceCodes = array_flip($this->repository->listExistingServiceCodesForScope(
            $tenantId,
            $facilityId,
        ));

        // Bulk preload: catalog items by ID for passing to synchronizer (avoids redundant finds)
        $catalogItemModels = [];
        foreach ($catalogItems as $ci) {
            $catalogItemModels[(string) $ci->id] = $ci;
        }

        $created = 0;
        $updated = 0;
        $errors = [];

        foreach ($catalogItems as $catalogItem) {
            try {
                $catalogItemId = (string) $catalogItem->id;

                if (isset($existingLinkedMap[$catalogItemId])) {
                    $this->syncExistingItem($existingLinkedMap[$catalogItemId], $catalogItem, $actorId);
                    $updated++;
                } else {
                    $this->createNewItem(
                        $catalogItem,
                        $tenantId,
                        $facilityId,
                        $defaultCurrencyCode,
                        $actorId,
                        $existingServiceCodes,
                    );
                    $created++;
                }
            } catch (\Throwable $e) {
                $errors[] = [
                    'catalogItemId' => $catalogItemId ?? '',
                    'code' => (string) ($catalogItem->code ?? ''),
                    'name' => (string) ($catalogItem->name ?? ''),
                    'error' => $e->getMessage() ?: sprintf('[%s] (no message)', get_class($e)),
                ];
            }
        }

        return [
            'created' => $created,
            'updated' => $updated,
            'errors' => $errors,
        ];
    }

    /**
     * Sync an existing billing item with updated catalog identity.
     */
    private function syncExistingItem(
        array $existingItem,
        ClinicalCatalogItemModel $catalogItem,
        ?int $actorId,
    ): void {
        $catalogItemId = (string) $catalogItem->id;

        $payload = $this->clinicalCatalogIdentitySynchronizer->forUpdate(
            payload: [],
            existing: $existingItem,
            tenantId: $existingItem['tenant_id'] ?? null,
            facilityId: $existingItem['facility_id'] ?? null,
        );

        $trackedFields = [
            'clinical_catalog_item_id',
            'service_code',
            'service_name',
            'service_type',
            'department_id',
            'department',
            'unit',
            'facility_tier',
            'description',
            'metadata',
            'codes',
            'price_unit',
        ];

        $before = [];
        $after = [];
        $updateAttributes = [];

        foreach ($trackedFields as $field) {
            $newValue = $payload[$field] ?? $existingItem[$field] ?? null;
            $oldValue = $existingItem[$field] ?? null;

            if (is_array($newValue)) {
                $oldJson = is_array($oldValue) ? json_encode($oldValue, JSON_THROW_ON_ERROR) : (string) $oldValue;
                $newJson = json_encode($newValue, JSON_THROW_ON_ERROR);
                if ($oldJson !== $newJson) {
                    $before[$field] = $oldValue;
                    $after[$field] = $newValue;
                    $updateAttributes[$field] = $newValue;
                }
            } elseif ((string) $newValue !== (string) $oldValue) {
                $before[$field] = $oldValue;
                $after[$field] = $newValue;
                $updateAttributes[$field] = $newValue;
            }
        }

        if (count($updateAttributes) === 0) {
            return;
        }

        $this->repository->update((string) $existingItem['id'], $updateAttributes);

        $this->auditLogRepository->write(
            billingServiceCatalogItemId: (string) $existingItem['id'],
            action: 'billing-service-catalog-item.synced-from-catalog',
            actorId: $actorId,
            changes: $after,
            metadata: [
                'catalog_item_id' => $catalogItemId,
                'sync_direction' => 'clinical_catalog_to_billing',
                'before' => $before,
            ],
        );
    }

    /**
     * Create a new billing service catalog item from a clinical catalog definition.
     *
     * @param  array<string, bool>  $existingServiceCodes  Flipped map of codes already in scope
     */
    private function createNewItem(
        ClinicalCatalogItemModel $catalogItem,
        ?string $tenantId,
        ?string $facilityId,
        string $defaultCurrencyCode,
        ?int $actorId,
        array $existingServiceCodes,
    ): void {
        $catalogItemId = (string) $catalogItem->id;

        $serviceCode = strtoupper(trim((string) ($catalogItem->code ?? '')));
        if ($serviceCode === '') {
            $serviceCode = 'CAT-'.strtoupper(substr(md5($catalogItemId), 0, 8));
        }

        // Resolve unique code using preloaded set (no DB queries)
        $originalCode = $serviceCode;
        $duplicateSuffix = 1;
        while (isset($existingServiceCodes[$serviceCode])) {
            $duplicateSuffix++;
            $serviceCode = $originalCode.'-'.$duplicateSuffix;
        }
        $existingServiceCodes[$serviceCode] = true;

        $payload = $this->clinicalCatalogIdentitySynchronizer->forCreate(
            payload: [
                'clinical_catalog_item_id' => $catalogItemId,
                'service_code' => $serviceCode,
            ],
            tenantId: $tenantId,
            facilityId: $facilityId,
            preloadedCatalogItem: $catalogItem,
        );

        $departmentId = $payload['department_id'] ?? $catalogItem->department_id ?? null;
        $departmentName = null;
        if ($departmentId) {
            $departmentName = $this->departmentResolver->resolveDepartmentName($departmentId);
        }

        $codes = null;
        $rawCodes = $catalogItem->codes ?? $payload['codes'] ?? null;
        if (is_array($rawCodes)) {
            $codes = $this->standardsCodeSupport->normalize($rawCodes);
        }

        $createAttributes = [
            'tenant_id' => $tenantId,
            'facility_id' => $facilityId,
            'clinical_catalog_item_id' => $catalogItemId,
            'service_code' => $payload['service_code'] ?? $serviceCode,
            'service_name' => $payload['service_name'] ?? trim((string) $catalogItem->name),
            'service_type' => $payload['service_type'] ?? null,
            'department_id' => $departmentId,
            'department' => $departmentName,
            'unit' => $payload['unit'] ?? ($catalogItem->unit ?: 'service'),
            'base_price' => 0,
            'currency_code' => $defaultCurrencyCode,
            'tax_rate_percent' => 0,
            'is_taxable' => false,
            'tariff_version' => 1,
            'status' => 'active',
            'facility_tier' => $payload['facility_tier'] ?? $catalogItem->facility_tier ?? null,
            'description' => $payload['description'] ?? $catalogItem->description ?? null,
            'metadata' => $payload['metadata'] ?? (is_array($catalogItem->metadata) ? $catalogItem->metadata : null),
            'codes' => $codes,
            'price_unit' => $payload['price_unit'] ?? null,
        ];

        $createdItem = $this->repository->create($createAttributes);

        $this->auditLogRepository->write(
            billingServiceCatalogItemId: (string) $createdItem['id'],
            action: 'billing-service-catalog-item.bulk-created-from-catalog',
            actorId: $actorId,
            changes: $createAttributes,
            metadata: [
                'catalog_item_id' => $catalogItemId,
                'catalog_type' => $catalogItem->catalog_type,
                'sync_direction' => 'clinical_catalog_to_billing',
            ],
        );
    }
}
