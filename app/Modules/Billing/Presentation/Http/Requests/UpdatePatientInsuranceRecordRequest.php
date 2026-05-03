<?php

namespace App\Modules\Billing\Presentation\Http\Requests;

class UpdatePatientInsuranceRecordRequest extends StorePatientInsuranceRecordRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = parent::rules();

        $rules['insuranceType'][0] = 'sometimes';
        $rules['insuranceProvider'][0] = 'sometimes';
        $rules['memberId'][0] = 'sometimes';

        return $rules;
    }
}
