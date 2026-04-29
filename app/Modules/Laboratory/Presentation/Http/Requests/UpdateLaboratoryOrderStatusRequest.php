<?php

namespace App\Modules\Laboratory\Presentation\Http\Requests;

use App\Modules\Laboratory\Domain\ValueObjects\LaboratoryOrderStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLaboratoryOrderStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('laboratory.orders.update-status') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(LaboratoryOrderStatus::values())],
            'reason' => ['nullable', 'string', 'max:255', 'required_if:status,cancelled'],
            'resultSummary' => ['nullable', 'string', 'max:5000', 'required_if:status,completed'],
        ];
    }
}
