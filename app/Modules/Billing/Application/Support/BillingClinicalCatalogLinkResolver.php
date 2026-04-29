<?php

namespace App\Modules\Billing\Application\Support;

use App\Modules\Billing\Application\Exceptions\InvalidBillingServiceCatalogClinicalLinkException;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use Illuminate\Database\Eloquent\Builder;

class BillingClinicalCatalogLinkResolver
{
    public function resolve(
        mixed $requestedClinicalCatalogItemId,
        bool $explicitLinkProvided,
        ?string $serviceCode,
        ?string $tenantId,
        ?string $facilityId,
    ): ?string {
        if ($explicitLinkProvided) {
            $requestedId = $this->normalizeNullableText($requestedClinicalCatalogItemId);
            if ($requestedId === null) {
                return null;
            }

            $linkedItem = $this->findByIdInExactScope($requestedId, $tenantId, $facilityId);
            if ($linkedItem === null) {
                throw new InvalidBillingServiceCatalogClinicalLinkException(
                    'Select a clinical definition that exists in the current scope.',
                );
            }

            return (string) ($linkedItem['id'] ?? null);
        }

        $normalizedServiceCode = $this->normalizeCode($serviceCode);
        if ($normalizedServiceCode === null) {
            return null;
        }

        $linkedItem = $this->findByLinkedBillingServiceCode($normalizedServiceCode, $tenantId, $facilityId);

        return $linkedItem['id'] ?? null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findByIdInExactScope(string $id, ?string $tenantId, ?string $facilityId): ?array
    {
        $query = ClinicalCatalogItemModel::query()->where('id', $id);
        $this->applyExactScope($query, $tenantId, $facilityId);

        return $query->first()?->toArray();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findByLinkedBillingServiceCode(
        string $serviceCode,
        ?string $tenantId,
        ?string $facilityId,
    ): ?array {
        $query = ClinicalCatalogItemModel::query()->where('status', 'active');
        $this->applyExactScope($query, $tenantId, $facilityId);

        /** @var ClinicalCatalogItemModel $item */
        foreach ($query->get() as $item) {
            $metadata = is_array($item->metadata) ? $item->metadata : [];
            $linkedServiceCode = $this->normalizeCode(
                $metadata['billingServiceCode'] ?? $metadata['billing_service_code'] ?? null,
            );

            if ($linkedServiceCode === $serviceCode) {
                return $item->toArray();
            }
        }

        return null;
    }

    private function applyExactScope(Builder $query, ?string $tenantId, ?string $facilityId): void
    {
        if ($tenantId === null) {
            $query->whereNull('tenant_id');
        } else {
            $query->where('tenant_id', $tenantId);
        }

        if ($facilityId === null) {
            $query->whereNull('facility_id');
        } else {
            $query->where('facility_id', $facilityId);
        }
    }

    private function normalizeNullableText(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }

    private function normalizeCode(mixed $value): ?string
    {
        $normalized = $this->normalizeNullableText($value);

        return $normalized === null ? null : strtoupper($normalized);
    }
}
