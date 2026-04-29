<?php

namespace App\Modules\Pharmacy\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdatePharmacyOrderRequest extends FormRequest
{
    /**
     * @var array<int, string>
     */
    private const ALLOWED_FIELDS = [
        'orderedAt',
        'approvedMedicineCatalogItemId',
        'medicationCode',
        'dosageInstruction',
        'clinicalIndication',
        'quantityPrescribed',
        'dispensingNotes',
    ];

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
            'patientId' => ['prohibited'],
            'admissionId' => ['prohibited'],
            'appointmentId' => ['prohibited'],
            'orderedByUserId' => ['prohibited'],
            'orderedAt' => ['sometimes', 'date'],
            'approvedMedicineCatalogItemId' => ['sometimes', 'nullable', 'uuid'],
            'medicationCode' => ['sometimes', 'nullable', 'string', 'max:100'],
            'medicationName' => ['prohibited'],
            'dosageInstruction' => ['sometimes', 'string', 'max:1000'],
            'clinicalIndication' => ['sometimes', 'nullable', 'string', 'max:255'],
            'quantityPrescribed' => ['sometimes', 'numeric', 'min:0.01'],
            'quantityDispensed' => ['prohibited'],
            'dispensingNotes' => ['nullable', 'string', 'max:2000'],
            'entryMode' => ['prohibited'],
            'orderSessionId' => ['prohibited'],
            'replacesOrderId' => ['prohibited'],
            'addOnToOrderId' => ['prohibited'],
            'status' => ['prohibited'],
            'statusReason' => ['prohibited'],
            'reason' => ['prohibited'],
            'formularyDecisionStatus' => ['prohibited'],
            'formularyDecisionReason' => ['prohibited'],
            'substitutionAllowed' => ['prohibited'],
            'substitutionMade' => ['prohibited'],
            'substitutedMedicationCode' => ['prohibited'],
            'substitutedMedicationName' => ['prohibited'],
            'substitutionReason' => ['prohibited'],
            'reconciliationStatus' => ['prohibited'],
            'reconciliationNote' => ['prohibited'],
            'verificationNote' => ['prohibited'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $requestKeys = array_keys($this->all());
            $hasAllowedFields = count(array_intersect($requestKeys, self::ALLOWED_FIELDS)) > 0;

            if (! $hasAllowedFields) {
                $validator->errors()->add('payload', 'At least one updatable field is required.');
            }
        });
    }
}
