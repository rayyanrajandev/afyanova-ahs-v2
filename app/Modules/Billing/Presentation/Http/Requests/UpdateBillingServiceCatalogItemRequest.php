<?php

namespace App\Modules\Billing\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateBillingServiceCatalogItemRequest extends FormRequest
{
    /**
     * @var array<int, string>
     */
    private const IDENTITY_FIELDS = [
        'clinicalCatalogItemId',
        'facilityTier',
        'serviceCode',
        'serviceName',
        'serviceType',
        'departmentId',
        'department',
        'unit',
    ];

    /**
     * @var array<int, string>
     */
    private const PRICING_FIELDS = [
        'basePrice',
        'currencyCode',
        'taxRatePercent',
        'isTaxable',
        'effectiveFrom',
        'effectiveTo',
        'description',
        'metadata',
        'codes',
    ];

    /**
     * @var array<int, string>
     */
    private const ALLOWED_FIELDS = [
        ...self::IDENTITY_FIELDS,
        ...self::PRICING_FIELDS,
    ];

    public function authorize(): bool
    {
        $user = $this->user();

        if ($user === null) {
            return false;
        }

        return $this->canManageIdentity() || $this->canManagePricing();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'clinicalCatalogItemId' => ['sometimes', 'nullable', 'uuid', 'exists:platform_clinical_catalog_items,id'],
            'facilityTier' => ['nullable', 'string', 'in:dispensary,health_centre,district_hospital,regional_hospital,zonal_referral'],
            'serviceCode' => ['sometimes', 'string', 'max:100'],
            'serviceName' => ['sometimes', 'string', 'max:255'],
            'serviceType' => ['nullable', 'string', 'max:80'],
            'departmentId' => ['nullable', 'uuid'],
            'department' => ['nullable', 'string', 'max:120'],
            'unit' => ['nullable', 'string', 'max:50'],
            'basePrice' => ['sometimes', 'numeric', 'min:0'],
            'currencyCode' => ['sometimes', 'string', 'size:3'],
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
            'status' => ['prohibited'],
            'statusReason' => ['prohibited'],
            'reason' => ['prohibited'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $requestedKeys = array_keys($this->all());
            $hasAllowedField = count(array_intersect($requestedKeys, self::ALLOWED_FIELDS)) > 0;
            $requestedIdentityFields = array_values(array_intersect($requestedKeys, self::IDENTITY_FIELDS));
            $requestedPricingFields = array_values(array_intersect($requestedKeys, self::PRICING_FIELDS));

            if (! $hasAllowedField) {
                $validator->errors()->add('payload', 'At least one updatable field is required.');
            }

            if ($requestedIdentityFields !== [] && ! $this->canManageIdentity()) {
                foreach ($requestedIdentityFields as $field) {
                    $validator->errors()->add($field, 'You do not have permission to update service details.');
                }
            }

            if ($requestedPricingFields !== [] && ! $this->canManagePricing()) {
                foreach ($requestedPricingFields as $field) {
                    $validator->errors()->add($field, 'You do not have permission to update service pricing.');
                }
            }
        });
    }

    private function canManageIdentity(): bool
    {
        $user = $this->user();

        if ($user === null) {
            return false;
        }

        return $user->hasPermissionTo('billing.service-catalog.manage')
            || $user->hasPermissionTo('billing.service-catalog.manage-identity');
    }

    private function canManagePricing(): bool
    {
        $user = $this->user();

        if ($user === null) {
            return false;
        }

        return $user->hasPermissionTo('billing.service-catalog.manage')
            || $user->hasPermissionTo('billing.service-catalog.manage-pricing');
    }
}
