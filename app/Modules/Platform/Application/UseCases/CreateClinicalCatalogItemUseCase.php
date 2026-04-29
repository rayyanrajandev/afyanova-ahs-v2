<?php

namespace App\Modules\Platform\Application\UseCases;

use App\Modules\Platform\Application\Exceptions\DuplicateClinicalCatalogCodeException;
use App\Modules\Platform\Application\Support\ClinicalCatalogBillingLinkEnricher;
use App\Modules\Platform\Domain\Repositories\ClinicalCatalogItemAuditLogRepositoryInterface;
use App\Modules\Platform\Domain\Repositories\ClinicalCatalogItemRepositoryInterface;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogItemStatus;
use App\Support\CatalogGovernance\FacilityTierSupport;
use App\Support\CatalogGovernance\StandardsCodeSupport;

class CreateClinicalCatalogItemUseCase
{
    public function __construct(
        private readonly ClinicalCatalogItemRepositoryInterface $repository,
        private readonly ClinicalCatalogItemAuditLogRepositoryInterface $auditLogRepository,
        private readonly ClinicalCatalogBillingLinkEnricher $billingLinkEnricher,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
        private readonly StandardsCodeSupport $standardsCodeSupport,
        private readonly FacilityTierSupport $facilityTierSupport,
    ) {}

    public function execute(string $catalogType, array $payload, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $tenantId = $this->platformScopeContext->tenantId();
        $facilityId = $this->platformScopeContext->facilityId();
        $code = $this->normalizeCode((string) $payload['code']);

        if ($this->repository->existsByCodeInScope($catalogType, $code, $tenantId, $facilityId)) {
            throw new DuplicateClinicalCatalogCodeException('Catalog code already exists in the current scope.');
        }

        $created = $this->repository->create([
            'tenant_id' => $tenantId,
            'facility_id' => $facilityId,
            'facility_tier' => $this->facilityTierSupport->normalize($payload['facility_tier'] ?? null),
            'catalog_type' => $catalogType,
            'code' => $code,
            'name' => trim((string) $payload['name']),
            'department_id' => $this->nullableTrimmedValue($payload['department_id'] ?? null),
            'category' => $this->nullableTrimmedValue($payload['category'] ?? null),
            'unit' => $this->nullableTrimmedValue($payload['unit'] ?? null),
            'description' => $this->nullableTrimmedValue($payload['description'] ?? null),
            'metadata' => $this->metadataWithBillingServiceCode(
                is_array($payload['metadata'] ?? null) ? $payload['metadata'] : null,
                $payload['billing_service_code'] ?? null,
                array_key_exists('billing_service_code', $payload),
            ),
            'codes' => $this->standardsCodeSupport->normalize(is_array($payload['codes'] ?? null) ? $payload['codes'] : null),
            'status' => ClinicalCatalogItemStatus::ACTIVE->value,
            'status_reason' => null,
        ]);

        $this->auditLogRepository->write(
            clinicalCatalogItemId: $created['id'],
            action: 'platform.clinical-catalog-item.created',
            actorId: $actorId,
            changes: [
                'after' => $this->extractTrackedFields($created),
            ],
            metadata: [
                'catalogType' => $catalogType,
            ],
        );

        return $this->billingLinkEnricher->enrich($created);
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
    private function metadataWithBillingServiceCode(?array $metadata, mixed $billingServiceCode, bool $shouldApply): ?array
    {
        $normalizedMetadata = is_array($metadata) ? $metadata : [];

        if ($shouldApply) {
            unset($normalizedMetadata['billingServiceCode'], $normalizedMetadata['billing_service_code']);

            $normalizedCode = $this->nullableTrimmedValue($billingServiceCode);
            if ($normalizedCode !== null) {
                $normalizedMetadata['billingServiceCode'] = strtoupper($normalizedCode);
            }
        }

        return $normalizedMetadata === [] ? null : $normalizedMetadata;
    }

    /**
     * @return array<string, mixed>
     */
    private function extractTrackedFields(array $item): array
    {
        $tracked = [
            'tenant_id',
            'facility_id',
            'facility_tier',
            'catalog_type',
            'code',
            'name',
            'department_id',
            'category',
            'unit',
            'description',
            'metadata',
            'codes',
            'status',
            'status_reason',
        ];

        $result = [];
        foreach ($tracked as $field) {
            $result[$field] = $item[$field] ?? null;
        }

        return $result;
    }
}
