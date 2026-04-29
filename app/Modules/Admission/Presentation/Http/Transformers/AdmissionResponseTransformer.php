<?php

namespace App\Modules\Admission\Presentation\Http\Transformers;

use App\Support\FinancialCoverage;

class AdmissionResponseTransformer
{
    public static function transform(array $admission): array
    {
        return [
            'id' => $admission['id'] ?? null,
            'admissionNumber' => $admission['admission_number'] ?? null,
            'patientId' => $admission['patient_id'] ?? null,
            'appointmentId' => $admission['appointment_id'] ?? null,
            'attendingClinicianUserId' => $admission['attending_clinician_user_id'] ?? null,
            'ward' => $admission['ward'] ?? null,
            'bed' => $admission['bed'] ?? null,
            'admittedAt' => $admission['admitted_at'] ?? null,
            'dischargedAt' => $admission['discharged_at'] ?? null,
            'admissionReason' => $admission['admission_reason'] ?? null,
            'notes' => $admission['notes'] ?? null,
            'financialClass' => FinancialCoverage::normalize(
                isset($admission['financial_coverage_type']) ? (string) $admission['financial_coverage_type'] : null,
            ),
            'billingPayerContractId' => $admission['billing_payer_contract_id'] ?? null,
            'coverageReference' => $admission['coverage_reference'] ?? null,
            'coverageNotes' => $admission['coverage_notes'] ?? null,
            'status' => $admission['status'] ?? null,
            'statusReason' => $admission['status_reason'] ?? null,
            'dischargeDestination' => $admission['discharge_destination'] ?? null,
            'followUpPlan' => $admission['follow_up_plan'] ?? null,
            'createdAt' => $admission['created_at'] ?? null,
            'updatedAt' => $admission['updated_at'] ?? null,
        ];
    }
}
