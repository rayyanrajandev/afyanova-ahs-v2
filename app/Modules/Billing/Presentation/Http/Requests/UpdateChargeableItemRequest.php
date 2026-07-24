<?php

namespace App\Modules\Billing\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateChargeableItemRequest extends FormRequest
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
            'name' => ['sometimes', 'string', 'max:255'],
            'category' => ['sometimes', 'nullable', 'string', 'max:100'],
            'defaultUnit' => ['sometimes', 'nullable', 'string', 'max:50'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'statusReason' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }
}
