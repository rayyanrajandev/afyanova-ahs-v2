<?php

namespace App\Modules\ServiceRequest\Presentation\Http\Requests;

use App\Modules\ServiceRequest\Domain\ValueObjects\ServiceRequestServiceType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreServiceRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('service.requests.create') ?? false;
    }

    protected function prepareForValidation(): void
    {
        $departmentId = $this->input('departmentId');
        if ($departmentId === '') {
            $this->merge(['departmentId' => null]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'patientId' => ['required', 'uuid'],
            'appointmentId' => ['nullable', 'uuid', Rule::exists('appointments', 'id')->where(
                fn ($query) => $query->where('patient_id', (string) $this->input('patientId')),
            )],
            'departmentId' => ['nullable', 'uuid', Rule::exists('departments', 'id')->where('status', 'active')],
            'serviceType' => ['required', Rule::in(ServiceRequestServiceType::values())],
            'priority' => ['nullable', Rule::in(['routine', 'urgent'])],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
