<?php

namespace App\Modules\Platform\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFacilityConfigurationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'tenantCode' => ['required', 'string', 'max:20', 'regex:/^[A-Za-z0-9][A-Za-z0-9_-]*$/'],
            'tenantName' => ['required', 'string', 'max:150'],
            'tenantCountryCode' => ['required', 'string', 'size:2'],
            'tenantAllowedCountryCodes' => ['nullable', 'array'],
            'tenantAllowedCountryCodes.*' => ['string', 'size:2'],
            'facilityCode' => ['required', 'string', 'max:30', 'regex:/^[A-Za-z0-9][A-Za-z0-9_-]*$/'],
            'facilityName' => ['required', 'string', 'max:150'],
            'facilityType' => ['nullable', 'string', 'max:50'],
            'facilityTier' => ['nullable', 'string', 'max:50'],
            'timezone' => ['nullable', 'string', 'max:100'],
            'facilityAdminUserId' => ['nullable', 'integer', 'min:1', 'exists:users,id'],
        ];
    }
}
