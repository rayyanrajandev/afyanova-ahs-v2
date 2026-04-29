<?php

namespace App\Modules\Billing\Presentation\Http\Transformers;

use App\Support\CatalogGovernance\StandardsCodeSupport;

class BillingServiceCatalogItemResponseTransformer
{
    public static function transform(array $item): array
    {
        return [
            'id' => $item['id'] ?? null,
            'tenantId' => $item['tenant_id'] ?? null,
            'facilityId' => $item['facility_id'] ?? null,
            'facilityTier' => $item['facility_tier'] ?? null,
            'clinicalCatalogItemId' => $item['clinical_catalog_item_id'] ?? null,
            'serviceCode' => $item['service_code'] ?? null,
            'versionNumber' => $item['tariff_version'] ?? 1,
            'serviceName' => $item['service_name'] ?? null,
            'serviceType' => $item['service_type'] ?? null,
            'departmentId' => $item['department_id'] ?? null,
            'department' => $item['department'] ?? null,
            'unit' => $item['unit'] ?? null,
            'basePrice' => $item['base_price'] ?? null,
            'currencyCode' => $item['currency_code'] ?? null,
            'taxRatePercent' => $item['tax_rate_percent'] ?? null,
            'isTaxable' => $item['is_taxable'] ?? null,
            'effectiveFrom' => $item['effective_from'] ?? null,
            'effectiveTo' => $item['effective_to'] ?? null,
            'description' => $item['description'] ?? null,
            'metadata' => $item['metadata'] ?? null,
            'codes' => is_array($item['codes'] ?? null) ? $item['codes'] : null,
            'standardsWarnings' => app(StandardsCodeSupport::class)->warningsForBillingItem($item),
            'status' => $item['status'] ?? null,
            'statusReason' => $item['status_reason'] ?? null,
            'supersedesBillingServiceCatalogItemId' => $item['supersedes_billing_service_catalog_item_id'] ?? null,
            'clinicalCatalogItem' => self::transformClinicalCatalogItem(
                is_array($item['clinical_catalog_item'] ?? null) ? $item['clinical_catalog_item'] : null,
            ),
            'linkWarning' => self::linkWarning($item),
            'createdAt' => $item['created_at'] ?? null,
            'updatedAt' => $item['updated_at'] ?? null,
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private static function linkWarning(array $item): ?string
    {
        $clinicalServiceTypes = ['laboratory', 'radiology', 'theatre', 'pharmacy', 'procedure', 'imaging'];
        $serviceType = strtolower(trim((string) ($item['service_type'] ?? '')));

        if (
            in_array($serviceType, $clinicalServiceTypes, true)
            && (($item['clinical_catalog_item_id'] ?? null) === null || (string) ($item['clinical_catalog_item_id'] ?? '') === '')
        ) {
            return 'This billable item is not linked to Clinical Care Catalogs. Link it so staff do not retype names/codes.';
        }

        return null;
    }

    /**
     * @param  array<string, mixed>|null  $item
     * @return array<string, mixed>|null
     */
    private static function transformClinicalCatalogItem(?array $item): ?array
    {
        if ($item === null) {
            return null;
        }

        return [
            'id' => $item['id'] ?? null,
            'catalogType' => $item['catalog_type'] ?? null,
            'code' => $item['code'] ?? null,
            'name' => $item['name'] ?? null,
            'status' => $item['status'] ?? null,
        ];
    }
}
