<?php

namespace App\Modules\Admission\Presentation\Http\Requests;

use App\Modules\Admission\Domain\ValueObjects\AdmissionStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAdmissionStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('admissions.update-status') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(AdmissionStatus::values())],
            'reason' => ['nullable', 'string', 'max:255', 'required_if:status,discharged,transferred,cancelled'],
            'dischargeDestination' => ['nullable', 'string', 'max:120', 'required_if:status,discharged'],
            'followUpPlan' => ['nullable', 'string', 'max:2000'],
            'receivingWard' => ['nullable', 'string', 'max:120', 'required_if:status,transferred'],
            'receivingBed' => ['nullable', 'string', 'max:40', 'required_if:status,transferred'],
        ];
    }
}
