<?php

namespace App\Modules\Billing\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BulkSyncFromClinicalCatalogRequest extends FormRequest
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
            'catalogItemIds' => ['nullable', 'array'],
            'catalogItemIds.*' => ['uuid'],
            'catalogTypes' => ['nullable', 'array'],
            'catalogTypes.*' => ['string', 'in:lab_test,radiology_procedure,theatre_procedure,formulary_item'],
            'defaultCurrencyCode' => ['nullable', 'string', 'max:3'],
        ];
    }
}
