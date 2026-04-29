<?php

namespace App\Modules\Platform\Presentation\Http\Transformers;

class ClinicalCatalogItemResponseTransformer
{
    public static function transform(array $item): array
    {
        $metadata = is_array($item['metadata'] ?? null)
            ? $item['metadata']
            : null;

        return [
            'id' => $item['id'] ?? null,
            'tenantId' => $item['tenant_id'] ?? null,
            'facilityId' => $item['facility_id'] ?? null,
            'facilityTier' => $item['facility_tier'] ?? null,
            'catalogType' => $item['catalog_type'] ?? null,
            'code' => $item['code'] ?? null,
            'name' => $item['name'] ?? null,
            'departmentId' => $item['department_id'] ?? null,
            'category' => $item['category'] ?? null,
            'unit' => $item['unit'] ?? null,
            'description' => $item['description'] ?? null,
            'billingServiceCode' => self::billingServiceCode($metadata),
            'billingLinkStatus' => self::billingLinkStatus($item['billing_link'] ?? null),
            'billingLink' => self::transformBillingLink($item['billing_link'] ?? null),
            'metadata' => $metadata,
            'codes' => is_array($item['codes'] ?? null) ? $item['codes'] : null,
            'status' => $item['status'] ?? null,
            'statusReason' => $item['status_reason'] ?? null,
            'createdAt' => $item['created_at'] ?? null,
            'updatedAt' => $item['updated_at'] ?? null,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $metadata
     */
    private static function billingServiceCode(?array $metadata): ?string
    {
        if ($metadata === null) {
            return null;
        }

        $candidateCodes = [
            $metadata['billingServiceCode'] ?? null,
            $metadata['billing_service_code'] ?? null,
        ];

        foreach ($candidateCodes as $candidateCode) {
            $normalized = strtoupper(trim((string) $candidateCode));
            if ($normalized !== '') {
                return $normalized;
            }
        }

        return null;
    }

    /**
     * @param  mixed  $billingLink
     */
    private static function billingLinkStatus(mixed $billingLink): ?string
    {
        return is_array($billingLink)
            ? self::nullableTrimmedValue($billingLink['status'] ?? null)
            : null;
    }

    /**
     * @param  mixed  $billingLink
     * @return array<string, mixed>|null
     */
    private static function transformBillingLink(mixed $billingLink): ?array
    {
        if (! is_array($billingLink)) {
            return null;
        }

        $billingItem = is_array($billingLink['item'] ?? null)
            ? $billingLink['item']
            : null;

        return [
            'status' => self::nullableTrimmedValue($billingLink['status'] ?? null),
            'serviceCode' => self::nullableTrimmedValue($billingLink['service_code'] ?? null),
            'item' => $billingItem === null ? null : [
                'id' => $billingItem['id'] ?? null,
                'clinicalCatalogItemId' => $billingItem['clinicalCatalogItemId'] ?? null,
                'serviceCode' => $billingItem['serviceCode'] ?? null,
                'serviceName' => $billingItem['serviceName'] ?? null,
                'status' => $billingItem['status'] ?? null,
                'versionNumber' => $billingItem['versionNumber'] ?? null,
                'basePrice' => $billingItem['basePrice'] ?? null,
                'currencyCode' => $billingItem['currencyCode'] ?? null,
                'effectiveFrom' => $billingItem['effectiveFrom'] ?? null,
                'effectiveTo' => $billingItem['effectiveTo'] ?? null,
            ],
        ];
    }

    private static function nullableTrimmedValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }
}
