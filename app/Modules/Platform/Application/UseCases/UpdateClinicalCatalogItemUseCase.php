<?php

namespace App\Modules\Platform\Application\UseCases;

use App\Modules\Platform\Application\Exceptions\DuplicateClinicalCatalogCodeException;
use App\Modules\Platform\Application\Support\ClinicalCatalogBillingLinkEnricher;
use App\Modules\Platform\Domain\Repositories\ClinicalCatalogItemAuditLogRepositoryInterface;
use App\Modules\Platform\Domain\Repositories\ClinicalCatalogItemRepositoryInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Support\CatalogGovernance\FacilityTierSupport;
use App\Support\CatalogGovernance\StandardsCodeSupport;

class UpdateClinicalCatalogItemUseCase
{
    public function __construct(
        private readonly ClinicalCatalogItemRepositoryInterface $repository,
        private readonly ClinicalCatalogItemAuditLogRepositoryInterface $auditLogRepository,
        private readonly ClinicalCatalogBillingLinkEnricher $billingLinkEnricher,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
        private readonly StandardsCodeSupport $standardsCodeSupport,
        private readonly FacilityTierSupport $facilityTierSupport,
    ) {}

    public function execute(string $id, string $catalogType, array $payload, ?int $actorId = null): ?array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $existing = $this->repository->findById($id);
        if (! $existing || ($existing['catalog_type'] ?? null) !== $catalogType) {
            return null;
        }

        $updatePayload = [];

        if (array_key_exists('code', $payload)) {
            $normalizedCode = $this->normalizeCode((string) $payload['code']);
            if ($this->repository->existsByCodeInScope(
                catalogType: $catalogType,
                code: $normalizedCode,
                tenantId: $existing['tenant_id'] ?? null,
                facilityId: $existing['facility_id'] ?? null,
                excludeId: $id,
            )) {
                throw new DuplicateClinicalCatalogCodeException('Catalog code already exists in the current scope.');
            }

            $updatePayload['code'] = $normalizedCode;
        }

        if (array_key_exists('name', $payload)) {
            $updatePayload['name'] = trim((string) $payload['name']);
        }

        if (array_key_exists('facility_tier', $payload)) {
            $updatePayload['facility_tier'] = $this->facilityTierSupport->normalize($payload['facility_tier']);
        }

        if (array_key_exists('department_id', $payload)) {
            $updatePayload['department_id'] = $this->nullableTrimmedValue($payload['department_id']);
        }

        if (array_key_exists('category', $payload)) {
            $updatePayload['category'] = $this->nullableTrimmedValue($payload['category']);
        }

        if (array_key_exists('unit', $payload)) {
            $updatePayload['unit'] = $this->nullableTrimmedValue($payload['unit']);
        }

        if (array_key_exists('description', $payload)) {
            $updatePayload['description'] = $this->nullableTrimmedValue($payload['description']);
        }

        if (array_key_exists('metadata', $payload)) {
            $updatePayload['metadata'] = is_array($payload['metadata']) ? $payload['metadata'] : null;
        }

        if (array_key_exists('codes', $payload)) {
            $updatePayload['codes'] = $this->standardsCodeSupport->normalize(is_array($payload['codes']) ? $payload['codes'] : null);
        }

        if (array_key_exists('billing_service_code', $payload)) {
            $baseMetadata = array_key_exists('metadata', $updatePayload)
                ? $updatePayload['metadata']
                : (is_array($existing['metadata'] ?? null) ? $existing['metadata'] : null);

            $updatePayload['metadata'] = $this->metadataWithBillingServiceCode(
                $baseMetadata,
                $payload['billing_service_code'],
            );
        }

        $updated = $this->repository->update($id, $updatePayload);
        if (! $updated) {
            return null;
        }

        $changes = $this->extractChanges($existing, $updated);
        if ($changes !== []) {
            $this->auditLogRepository->write(
                clinicalCatalogItemId: $id,
                action: 'platform.clinical-catalog-item.updated',
                actorId: $actorId,
                changes: $changes,
                metadata: [
                    'catalogType' => $catalogType,
                ],
            );
        }

        return $this->billingLinkEnricher->enrich($updated);
    }

    private function normalizeCode(string $value): string
    {
        return strtoupper(trim($value));
    }

    private function nullableTrimmedValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }

    /**
     * @param  array<string, mixed>|null  $metadata
     */
    private function metadataWithBillingServiceCode(?array $metadata, mixed $billingServiceCode): ?array
    {
        $normalizedMetadata = is_array($metadata) ? $metadata : [];
        unset($normalizedMetadata['billingServiceCode'], $normalizedMetadata['billing_service_code']);

        $normalizedCode = $this->nullableTrimmedValue($billingServiceCode);
        if ($normalizedCode !== null) {
            $normalizedMetadata['billingServiceCode'] = strtoupper($normalizedCode);
        }

        return $normalizedMetadata === [] ? null : $normalizedMetadata;
    }

    /**
     * @return array<string, mixed>
     */
    private function extractChanges(array $before, array $after): array
    {
        $trackedFields = [
            'code',
            'name',
            'facility_tier',
            'department_id',
            'category',
            'unit',
            'description',
            'metadata',
            'codes',
            'status',
            'status_reason',
        ];

        $changes = [];
        foreach ($trackedFields as $field) {
            $beforeValue = $before[$field] ?? null;
            $afterValue = $after[$field] ?? null;
            if ($beforeValue === $afterValue) {
                continue;
            }

            $changes[$field] = [
                'before' => $beforeValue,
                'after' => $afterValue,
            ];
        }

        return $changes;
    }
}
