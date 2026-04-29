<?php

namespace App\Modules\Platform\Application\Support;

use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;
use Carbon\CarbonImmutable;

class ClinicalCatalogBillingLinkEnricher
{
    /**
     * @var array<string, array<int, array<string, mixed>>>
     */
    private array $serviceFamilyCache = [];

    public function __construct(
        private readonly BillingServiceCatalogItemRepositoryInterface $billingServiceCatalogRepository,
    ) {}

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    public function enrich(array $item): array
    {
        $billingServiceCode = $this->extractBillingServiceCode($item['metadata'] ?? null);
        $billingItem = $billingServiceCode === null
            ? null
            : $this->resolveBillingServiceItem(
                $billingServiceCode,
                $this->nullableTrimmedValue($item['tenant_id'] ?? null),
                $this->nullableTrimmedValue($item['facility_id'] ?? null),
            );

        $item['billing_link'] = [
            'status' => $this->billingLinkStatus($billingServiceCode, $billingItem),
            'service_code' => $billingServiceCode,
            'item' => $billingItem === null ? null : $this->summarizeBillingItem($billingItem),
        ];

        return $item;
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array<int, array<string, mixed>>
     */
    public function enrichMany(array $items): array
    {
        return array_map(fn (array $item): array => $this->enrich($item), $items);
    }

    /**
     * @param  mixed  $metadata
     */
    private function extractBillingServiceCode(mixed $metadata): ?string
    {
        if (! is_array($metadata)) {
            return null;
        }

        $candidateCodes = [
            $metadata['billingServiceCode'] ?? null,
            $metadata['billing_service_code'] ?? null,
        ];

        foreach ($candidateCodes as $candidateCode) {
            $normalized = $this->nullableTrimmedValue($candidateCode);
            if ($normalized !== null) {
                return strtoupper($normalized);
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveBillingServiceItem(
        string $serviceCode,
        ?string $tenantId,
        ?string $facilityId,
    ): ?array {
        $versions = $this->loadServiceFamilyVersions($serviceCode, $tenantId, $facilityId);
        if ($versions === []) {
            return null;
        }

        $now = CarbonImmutable::now();

        foreach ($versions as $version) {
            if ($this->isCurrentActiveVersion($version, $now)) {
                return $version;
            }
        }

        return $versions[0] ?? null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadServiceFamilyVersions(
        string $serviceCode,
        ?string $tenantId,
        ?string $facilityId,
    ): array {
        $cacheKey = implode('|', [
            strtoupper($serviceCode),
            $tenantId ?? 'null',
            $facilityId ?? 'null',
        ]);

        if (! array_key_exists($cacheKey, $this->serviceFamilyCache)) {
            $this->serviceFamilyCache[$cacheKey] = $this->billingServiceCatalogRepository->listVersionsByServiceCodeFamily(
                serviceCode: $serviceCode,
                tenantId: $tenantId,
                facilityId: $facilityId,
            );
        }

        return $this->serviceFamilyCache[$cacheKey];
    }

    /**
     * @param  array<string, mixed>|null  $billingItem
     */
    private function billingLinkStatus(?string $billingServiceCode, ?array $billingItem): string
    {
        if ($billingServiceCode === null) {
            return 'not_linked';
        }

        if ($billingItem === null) {
            return 'pending_price';
        }

        return $this->isCurrentActiveVersion($billingItem, CarbonImmutable::now())
            ? 'linked'
            : 'review_required';
    }

    /**
     * @param  array<string, mixed>  $billingItem
     * @return array<string, mixed>
     */
    private function summarizeBillingItem(array $billingItem): array
    {
        return [
            'id' => $billingItem['id'] ?? null,
            'clinicalCatalogItemId' => $billingItem['clinical_catalog_item_id'] ?? null,
            'serviceCode' => $billingItem['service_code'] ?? null,
            'serviceName' => $billingItem['service_name'] ?? null,
            'status' => $billingItem['status'] ?? null,
            'versionNumber' => $billingItem['tariff_version'] ?? null,
            'basePrice' => $billingItem['base_price'] ?? null,
            'currencyCode' => $billingItem['currency_code'] ?? null,
            'effectiveFrom' => $billingItem['effective_from'] ?? null,
            'effectiveTo' => $billingItem['effective_to'] ?? null,
        ];
    }

    /**
     * @param  array<string, mixed>  $billingItem
     */
    private function isCurrentActiveVersion(array $billingItem, CarbonImmutable $now): bool
    {
        $status = strtolower(trim((string) ($billingItem['status'] ?? '')));
        if ($status !== 'active') {
            return false;
        }

        $effectiveFrom = $this->normalizeNullableDateTime($billingItem['effective_from'] ?? null);
        if ($effectiveFrom !== null && $effectiveFrom->greaterThan($now)) {
            return false;
        }

        $effectiveTo = $this->normalizeNullableDateTime($billingItem['effective_to'] ?? null);
        if ($effectiveTo !== null && $effectiveTo->lessThan($now)) {
            return false;
        }

        return true;
    }

    private function normalizeNullableDateTime(mixed $value): ?CarbonImmutable
    {
        $normalized = $this->nullableTrimmedValue($value);

        return $normalized === null ? null : CarbonImmutable::parse($normalized);
    }

    private function nullableTrimmedValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }
}
