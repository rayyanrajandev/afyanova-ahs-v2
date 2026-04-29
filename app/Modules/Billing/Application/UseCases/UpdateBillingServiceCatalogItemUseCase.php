<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Application\Exceptions\DuplicateBillingServiceCatalogCodeException;
use App\Modules\Billing\Application\Support\BillingCatalogDepartmentResolver;
use App\Modules\Billing\Application\Support\BillingClinicalCatalogIdentitySynchronizer;
use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemAuditLogRepositoryInterface;
use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Support\CatalogGovernance\FacilityTierSupport;
use App\Support\CatalogGovernance\StandardsCodeSupport;

class UpdateBillingServiceCatalogItemUseCase
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

    public function execute(string $id, array $payload, ?int $actorId = null): ?array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $existing = $this->repository->findById($id);
        if (! $existing) {
            return null;
        }

        $tenantId = $this->platformScopeContext->tenantId();
        $facilityId = $this->platformScopeContext->facilityId();
        $payload = $this->clinicalCatalogIdentitySynchronizer->forUpdate($payload, $existing, $tenantId, $facilityId);

        if (array_key_exists('service_code', $payload)) {
            $serviceCode = $this->normalizeCode((string) $payload['service_code']);
            if (
                $serviceCode !== (string) ($existing['service_code'] ?? '')
                && $this->repository->existsByServiceCode($serviceCode, $tenantId, $facilityId, $id)
            ) {
                throw new DuplicateBillingServiceCatalogCodeException('Service code already exists in the current scope.');
            }
            $payload['service_code'] = $serviceCode;
        }

        if (array_key_exists('currency_code', $payload) && is_string($payload['currency_code'])) {
            $payload['currency_code'] = strtoupper(trim($payload['currency_code']));
        }

        if (array_key_exists('facility_tier', $payload)) {
            $payload['facility_tier'] = $this->facilityTierSupport->normalize($payload['facility_tier']);
        }

        if (array_key_exists('service_name', $payload) && is_string($payload['service_name'])) {
            $payload['service_name'] = trim($payload['service_name']);
        }

        if (array_key_exists('unit', $payload) && is_string($payload['unit'])) {
            $payload['unit'] = trim($payload['unit']);
        }

        if (array_key_exists('service_type', $payload) && is_string($payload['service_type'])) {
            $payload['service_type'] = $this->nullableTrimmedValue($payload['service_type']);
        }

        if (array_key_exists('department_id', $payload) || array_key_exists('department', $payload)) {
            $payload = [
                ...$payload,
                ...$this->departmentResolver->resolve($payload),
            ];
        }

        if (array_key_exists('department', $payload) && is_string($payload['department'])) {
            $payload['department'] = $this->nullableTrimmedValue($payload['department']);
        }

        if (array_key_exists('description', $payload) && is_string($payload['description'])) {
            $payload['description'] = $this->nullableTrimmedValue($payload['description']);
        }

        if (array_key_exists('codes', $payload)) {
            $payload['codes'] = $this->standardsCodeSupport->normalize(is_array($payload['codes']) ? $payload['codes'] : null);
        }

        $updated = $this->repository->update($id, $payload);
        if (! $updated) {
            return null;
        }

        $changes = $this->extractChanges($existing, $updated);
        $this->auditLogRepository->write(
            billingServiceCatalogItemId: $id,
            action: 'billing-service-catalog-item.updated',
            actorId: $actorId,
            changes: $changes === [] ? ['after' => $updated] : $changes,
        );

        return $updated;
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
     * @return array<string, mixed>
     */
    private function extractChanges(array $before, array $after): array
    {
        $trackedFields = [
            'clinical_catalog_item_id',
            'facility_tier',
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
