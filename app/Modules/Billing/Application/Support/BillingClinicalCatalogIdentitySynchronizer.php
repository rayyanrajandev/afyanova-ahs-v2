<?php

namespace App\Modules\Billing\Application\Support;

use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;

class BillingClinicalCatalogIdentitySynchronizer
{
    public function __construct(
        private readonly BillingClinicalCatalogLinkResolver $clinicalCatalogLinkResolver,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function forCreate(array $payload, ?string $tenantId, ?string $facilityId): array
    {
        $serviceCode = $this->normalizeCode($payload['service_code'] ?? null);
        $clinicalCatalogItemId = $this->clinicalCatalogLinkResolver->resolve(
            requestedClinicalCatalogItemId: $payload['clinical_catalog_item_id'] ?? null,
            explicitLinkProvided: array_key_exists('clinical_catalog_item_id', $payload),
            serviceCode: $serviceCode,
            tenantId: $tenantId,
            facilityId: $facilityId,
        );

        if ($clinicalCatalogItemId === null) {
            return [
                ...$payload,
                'service_code' => $serviceCode,
                'clinical_catalog_item_id' => null,
            ];
        }

        return $this->applyCatalogIdentity($payload, $clinicalCatalogItemId);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $existing
     * @return array<string, mixed>
     */
    public function forUpdate(array $payload, array $existing, ?string $tenantId, ?string $facilityId): array
    {
        $explicitLinkProvided = array_key_exists('clinical_catalog_item_id', $payload);

        if ($explicitLinkProvided || array_key_exists('service_code', $payload)) {
            $clinicalCatalogItemId = $this->clinicalCatalogLinkResolver->resolve(
                requestedClinicalCatalogItemId: $payload['clinical_catalog_item_id'] ?? null,
                explicitLinkProvided: $explicitLinkProvided,
                serviceCode: $payload['service_code'] ?? $existing['service_code'] ?? null,
                tenantId: $tenantId,
                facilityId: $facilityId,
            );
        } else {
            $clinicalCatalogItemId = $existing['clinical_catalog_item_id'] ?? null;
        }

        if ($clinicalCatalogItemId === null) {
            if (array_key_exists('service_code', $payload)) {
                $payload['service_code'] = $this->normalizeCode($payload['service_code']);
            }

            return [
                ...$payload,
                'clinical_catalog_item_id' => null,
            ];
        }

        return $this->applyCatalogIdentity($payload, (string) $clinicalCatalogItemId);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function applyCatalogIdentity(array $payload, string $clinicalCatalogItemId): array
    {
        $catalogItem = ClinicalCatalogItemModel::query()->find($clinicalCatalogItemId);
        if ($catalogItem === null) {
            return [
                ...$payload,
                'clinical_catalog_item_id' => $clinicalCatalogItemId,
            ];
        }

        $payload['clinical_catalog_item_id'] = $clinicalCatalogItemId;
        $payload['service_code'] = $this->normalizeCode($catalogItem->code);
        $payload['service_name'] = trim((string) $catalogItem->name);
        $payload['service_type'] = $this->serviceTypeForCatalogType((string) $catalogItem->catalog_type)
            ?? ($payload['service_type'] ?? null);

        if (($payload['unit'] ?? null) === null || trim((string) $payload['unit']) === '') {
            $payload['unit'] = $catalogItem->unit ?: 'service';
        }

        if (($payload['department_id'] ?? null) === null && $catalogItem->department_id !== null) {
            $payload['department_id'] = $catalogItem->department_id;
        }

        if (($payload['facility_tier'] ?? null) === null && $catalogItem->facility_tier !== null) {
            $payload['facility_tier'] = $catalogItem->facility_tier;
        }

        if (($payload['description'] ?? null) === null && $catalogItem->description !== null) {
            $payload['description'] = $catalogItem->description;
        }

        return $payload;
    }

    private function serviceTypeForCatalogType(string $catalogType): ?string
    {
        return match ($catalogType) {
            ClinicalCatalogType::LAB_TEST->value => 'laboratory',
            ClinicalCatalogType::RADIOLOGY_PROCEDURE->value => 'radiology',
            ClinicalCatalogType::THEATRE_PROCEDURE->value => 'theatre',
            ClinicalCatalogType::FORMULARY_ITEM->value => 'pharmacy',
            default => null,
        };
    }

    private function normalizeCode(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = strtoupper(trim((string) $value));

        return $normalized === '' ? null : $normalized;
    }
}
