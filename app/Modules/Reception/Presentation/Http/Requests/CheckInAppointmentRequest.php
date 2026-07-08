<?php

namespace App\Modules\Reception\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CheckInAppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('appointments.update-status') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'verificationNotes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
