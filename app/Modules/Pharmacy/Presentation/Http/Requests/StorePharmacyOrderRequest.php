<?php

namespace App\Modules\Pharmacy\Presentation\Http\Requests;

use App\Modules\Pharmacy\Application\Support\MedicationSafetyRuleCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePharmacyOrderRequest extends FormRequest
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
            'patientId' => ['required', 'uuid'],
            'admissionId' => ['nullable', 'uuid'],
            'appointmentId' => ['nullable', 'uuid'],
            'entryMode' => ['nullable', Rule::in(['draft', 'active'])],
            'orderSessionId' => ['nullable', 'uuid'],
            'replacesOrderId' => ['nullable', 'uuid', 'prohibits:addOnToOrderId'],
            'addOnToOrderId' => ['nullable', 'uuid', 'prohibits:replacesOrderId'],
            'orderedByUserId' => ['nullable', 'integer', 'exists:users,id'],
            'orderedAt' => ['nullable', 'date'],
            'approvedMedicineCatalogItemId' => ['nullable', 'uuid'],
            'medicationCode' => ['nullable', 'string', 'max:100', 'required_without:approvedMedicineCatalogItemId'],
            'medicationName' => ['nullable', 'string', 'max:255'],
            'dosageInstruction' => ['required', 'string', 'max:1000'],
            'clinicalIndication' => ['nullable', 'string', 'max:255'],
            'quantityPrescribed' => ['required', 'numeric', 'min:0.01'],
            'quantityDispensed' => ['nullable', 'numeric', 'min:0'],
            'dispensingNotes' => ['nullable', 'string', 'max:2000'],
            'safetyAcknowledged' => ['nullable', 'boolean'],
            'safetyOverrideCode' => ['nullable', 'string', Rule::in(MedicationSafetyRuleCatalog::validOverrideCodes())],
            'safetyOverrideReason' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
