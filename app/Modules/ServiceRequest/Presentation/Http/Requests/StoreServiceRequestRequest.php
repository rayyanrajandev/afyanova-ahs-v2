<?php

namespace App\Modules\ServiceRequest\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreServiceRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('service.requests.create') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'patientId' => ['required', 'uuid'],
            'serviceType' => ['required', Rule::in(['laboratory', 'pharmacy', 'radiology'])],
            'priority' => ['nullable', Rule::in(['routine', 'urgent'])],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
