<?php

namespace App\Modules\Billing\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreBillingServiceCatalogItemRevisionRequest extends FormRequest
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
            'basePrice' => ['required', 'numeric', 'min:0'],
            'effectiveFrom' => ['required', 'date'],
            'effectiveTo' => ['nullable', 'date', 'after_or_equal:effectiveFrom'],
            'description' => ['nullable', 'string', 'max:2000'],
            'taxRatePercent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'isTaxable' => ['nullable', 'boolean'],
            'metadata' => ['nullable', 'array'],
            'serviceCode' => ['prohibited'],
            'serviceName' => ['prohibited'],
            'serviceType' => ['prohibited'],
            'departmentId' => ['prohibited'],
            'department' => ['prohibited'],
            'unit' => ['prohibited'],
            'currencyCode' => ['prohibited'],
            'status' => ['prohibited'],
            'reason' => ['prohibited'],
        ];
    }
}
