<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemAuditLogRepositoryInterface;
use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;
use App\Modules\Billing\Domain\ValueObjects\BillingServiceCatalogItemStatus;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Schema;

class CreateBillingServiceCatalogItemRevisionUseCase
{
    public function __construct(
        private readonly BillingServiceCatalogItemRepositoryInterface $repository,
        private readonly BillingServiceCatalogItemAuditLogRepositoryInterface $auditLogRepository,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    public function execute(string $sourceId, array $payload, ?int $actorId = null): ?array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        if (! $this->supportsTariffVersioning()) {
            throw new \InvalidArgumentException('Tariff versioning requires the latest billing service catalog migration. Run php artisan migrate first.');
        }

        $source = $this->repository->findById($sourceId);
        if (! $source) {
            return null;
        }

        $tenantId = $this->platformScopeContext->tenantId();
        $facilityId = $this->platformScopeContext->facilityId();
        $serviceCode = (string) ($source['service_code'] ?? '');
        $effectiveFrom = $this->normalizeRequiredDateTime($payload['effective_from'] ?? null);
        $effectiveTo = $this->normalizeNullableDateTime($payload['effective_to'] ?? null);

        $sourceEffectiveFrom = $this->normalizeNullableDateTime($source['effective_from'] ?? null);
        if ($sourceEffectiveFrom !== null && $effectiveFrom->lessThanOrEqualTo($sourceEffectiveFrom)) {
            throw new \InvalidArgumentException('Revision effective_from must be later than the source tariff effective_from.');
        }

        $nextVersion = $this->repository->nextTariffVersion($serviceCode, $tenantId, $facilityId);

        $created = $this->repository->create([
            'tenant_id' => $tenantId,
            'facility_id' => $facilityId,
            'clinical_catalog_item_id' => $source['clinical_catalog_item_id'] ?? null,
            'service_code' => $serviceCode,
            'tariff_version' => $nextVersion,
            'service_name' => $source['service_name'] ?? null,
            'service_type' => $source['service_type'] ?? null,
            'department_id' => $source['department_id'] ?? null,
            'department' => $source['department'] ?? null,
            'unit' => $source['unit'] ?? 'service',
            'base_price' => round((float) $payload['base_price'], 2),
            'currency_code' => $source['currency_code'] ?? 'TZS',
            'tax_rate_percent' => array_key_exists('tax_rate_percent', $payload)
                ? round((float) ($payload['tax_rate_percent'] ?? 0), 2)
                : round((float) ($source['tax_rate_percent'] ?? 0), 2),
            'is_taxable' => array_key_exists('is_taxable', $payload)
                ? (bool) ($payload['is_taxable'] ?? false)
                : (bool) ($source['is_taxable'] ?? false),
            'effective_from' => $effectiveFrom->toDateTimeString(),
            'effective_to' => $effectiveTo?->toDateTimeString(),
            'description' => $this->nullableTrimmedValue($payload['description'] ?? null)
                ?? $this->nullableTrimmedValue($source['description'] ?? null),
            'metadata' => is_array($payload['metadata'] ?? null)
                ? $payload['metadata']
                : ($source['metadata'] ?? null),
            'status' => BillingServiceCatalogItemStatus::ACTIVE->value,
            'status_reason' => null,
            'supersedes_billing_service_catalog_item_id' => $sourceId,
        ]);

        $sourceEndDate = $effectiveFrom->subSecond()->toDateTimeString();
        $updatedSource = $this->repository->update($sourceId, [
            'effective_to' => $sourceEndDate,
        ]);

        $this->auditLogRepository->write(
            billingServiceCatalogItemId: (string) $created['id'],
            action: 'billing-service-catalog-item.revision.created',
            actorId: $actorId,
            changes: [
                'after' => $this->extractTrackedFields($created),
            ],
            metadata: [
                'revision' => [
                    'sourceBillingServiceCatalogItemId' => $sourceId,
                    'tariffVersion' => $nextVersion,
                ],
            ],
        );

        if ($updatedSource !== null) {
            $this->auditLogRepository->write(
                billingServiceCatalogItemId: $sourceId,
                action: 'billing-service-catalog-item.revision.superseded',
                actorId: $actorId,
                changes: [
                    'effective_to' => [
                        'before' => $source['effective_to'] ?? null,
                        'after' => $updatedSource['effective_to'] ?? null,
                    ],
                ],
                metadata: [
                    'revision' => [
                        'createdBillingServiceCatalogItemId' => $created['id'] ?? null,
                        'createdTariffVersion' => $nextVersion,
                    ],
                ],
            );
        }

        return $created;
    }

    private function supportsTariffVersioning(): bool
    {
        return Schema::hasColumn('billing_service_catalog_items', 'tariff_version')
            && Schema::hasColumn('billing_service_catalog_items', 'supersedes_billing_service_catalog_item_id');
    }

    private function nullableTrimmedValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }

    private function normalizeRequiredDateTime(mixed $value): CarbonImmutable
    {
        return CarbonImmutable::parse((string) $value);
    }

    private function normalizeNullableDateTime(mixed $value): ?CarbonImmutable
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }

        return CarbonImmutable::parse((string) $value);
    }

    /**
     * @return array<string, mixed>
     */
    private function extractTrackedFields(array $item): array
    {
        $tracked = [
            'tenant_id',
            'facility_id',
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
