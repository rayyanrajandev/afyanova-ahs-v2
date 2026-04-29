<?php

namespace App\Modules\Pharmacy\Presentation\Http\Requests;

use App\Modules\Pharmacy\Application\Support\MedicationSafetyRuleCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SignPharmacyOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('pharmacy.orders.create') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'safetyAcknowledged' => ['nullable', 'boolean'],
            'safetyOverrideCode' => ['nullable', 'string', Rule::in(MedicationSafetyRuleCatalog::validOverrideCodes())],
            'safetyOverrideReason' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
