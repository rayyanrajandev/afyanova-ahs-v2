<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Application\Exceptions\DuplicateBillingServiceCatalogCodeException;
use App\Modules\Billing\Application\Support\BillingCatalogDepartmentResolver;
use App\Modules\Billing\Application\Support\BillingClinicalCatalogIdentitySynchronizer;
use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemAuditLogRepositoryInterface;
use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;
use App\Modules\Billing\Domain\ValueObjects\BillingServiceCatalogItemStatus;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Support\CatalogGovernance\FacilityTierSupport;
use App\Support\CatalogGovernance\StandardsCodeSupport;

class CreateBillingServiceCatalogItemUseCase
{
    public function __construct(
        private readonly BillingServiceCatalogItemRepositoryInterface $repository,
        private readonly BillingServiceCatalogItemAuditLogRepositoryInterface $auditLogRepository,
        private readonly BillingCatalogDepartmentResolver $departmentResolver,
        private readonly BillingClinicalCatalogIdentitySynchronizer $clinicalCatalogIdentitySynchronizer,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
        private readonly StandardsCodeSupport $standardsCodeSupport,
        private readonly FacilityTierSupport $facilityTierSupport,
    ) {}

    public function execute(array $payload, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $tenantId = $this->platformScopeContext->tenantId();
        $facilityId = $this->platformScopeContext->facilityId();
        $payload = $this->clinicalCatalogIdentitySynchronizer->forCreate($payload, $tenantId, $facilityId);
        $serviceCode = $this->normalizeCode((string) $payload['service_code']);

        if ($this->repository->existsByServiceCode($serviceCode, $tenantId, $facilityId)) {
            throw new DuplicateBillingServiceCatalogCodeException('Service code already exists in the current scope.');
        }

        $departmentData = $this->departmentResolver->resolve($payload);

        $created = $this->repository->create([
            'tenant_id' => $tenantId,
            'facility_id' => $facilityId,
            'facility_tier' => $this->facilityTierSupport->normalize($payload['facility_tier'] ?? null),
            'clinical_catalog_item_id' => $payload['clinical_catalog_item_id'] ?? null,
            'service_code' => $serviceCode,
            'tariff_version' => 1,
            'service_name' => trim((string) $payload['service_name']),
            'service_type' => $this->nullableTrimmedValue($payload['service_type'] ?? null),
            ...$departmentData,
            'unit' => $this->nullableTrimmedValue($payload['unit'] ?? null) ?? 'service',
            'base_price' => round((float) $payload['base_price'], 2),
            'currency_code' => $this->normalizeCurrency((string) $payload['currency_code']),
            'tax_rate_percent' => round((float) ($payload['tax_rate_percent'] ?? 0), 2),
            'is_taxable' => (bool) ($payload['is_taxable'] ?? false),
            'effective_from' => $payload['effective_from'] ?? null,
            'effective_to' => $payload['effective_to'] ?? null,
            'description' => $this->nullableTrimmedValue($payload['description'] ?? null),
            'metadata' => is_array($payload['metadata'] ?? null) ? $payload['metadata'] : null,
            'codes' => $this->standardsCodeSupport->normalize(is_array($payload['codes'] ?? null) ? $payload['codes'] : null),
            'status' => BillingServiceCatalogItemStatus::ACTIVE->value,
            'status_reason' => null,
            'supersedes_billing_service_catalog_item_id' => null,
        ]);

        $this->auditLogRepository->write(
            billingServiceCatalogItemId: $created['id'],
            action: 'billing-service-catalog-item.created',
            actorId: $actorId,
            changes: [
                'after' => $this->extractTrackedFields($created),
            ],
        );

        return $created;
    }

    private function normalizeCode(string $value): string
    {
        return strtoupper(trim($value));
    }

    private function normalizeCurrency(string $value): string
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
     * @return array<string, mixed>
     */
    private function extractTrackedFields(array $item): array
    {
        $tracked = [
            'tenant_id',
            'facility_id',
            'facility_tier',
            'clinical_catalog_item_id',
            'service_code',
            'tariff_version',
            'service_name',
            'service_type',
            'department_id',
            'department',
            'unit',
            'base_price',
            'currency_code',
            'tax_rate_percent',
            'is_taxable',
            'effective_from',
            'effective_to',
            'description',
            'metadata',
            'codes',
            'status',
            'status_reason',
            'supersedes_billing_service_catalog_item_id',
        ];

        $result = [];
        foreach ($tracked as $field) {
            $result[$field] = $item[$field] ?? null;
        }

        return $result;
    }
}
