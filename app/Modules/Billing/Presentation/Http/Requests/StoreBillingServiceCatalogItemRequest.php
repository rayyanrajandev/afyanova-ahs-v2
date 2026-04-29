<?php

namespace App\Modules\Billing\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreBillingServiceCatalogItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        if ($user === null) {
            return false;
        }

        return $user->hasPermissionTo('billing.service-catalog.manage')
            || $user->hasPermissionTo('billing.service-catalog.manage-pricing');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'clinicalCatalogItemId' => ['nullable', 'uuid', 'exists:platform_clinical_catalog_items,id'],
            'facilityTier' => ['nullable', 'string', 'in:dispensary,health_centre,district_hospital,regional_hospital,zonal_referral'],
            'serviceCode' => ['required', 'string', 'max:100'],
            'serviceName' => ['required', 'string', 'max:255'],
            'serviceType' => ['nullable', 'string', 'max:80'],
            'departmentId' => ['nullable', 'uuid'],
            'department' => ['nullable', 'string', 'max:120'],
            'unit' => ['nullable', 'string', 'max:50'],
            'basePrice' => ['required', 'numeric', 'min:0'],
            'currencyCode' => ['required', 'string', 'size:3'],
            'taxRatePercent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'isTaxable' => ['nullable', 'boolean'],
            'effectiveFrom' => ['nullable', 'date'],
            'effectiveTo' => ['nullable', 'date', 'after_or_equal:effectiveFrom'],
            'description' => ['nullable', 'string', 'max:2000'],
            'metadata' => ['nullable', 'array'],
            'codes' => ['nullable', 'array'],
            'codes.LOCAL' => ['nullable', 'string', 'max:120'],
            'codes.LOINC' => ['nullable', 'string', 'max:120'],
            'codes.SNOMED_CT' => ['nullable', 'string', 'max:120'],
            'codes.NHIF' => ['nullable', 'string', 'max:120'],
            'codes.MSD' => ['nullable', 'string', 'max:120'],
            'codes.CPT' => ['nullable', 'string', 'max:120'],
            'codes.ICD' => ['nullable', 'string', 'max:120'],
        ];
    }
}
