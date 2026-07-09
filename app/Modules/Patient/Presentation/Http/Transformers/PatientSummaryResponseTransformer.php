<?php

namespace App\Modules\Patient\Presentation\Http\Transformers;

use App\Modules\Billing\Presentation\Http\Transformers\PatientInsuranceRecordResponseTransformer;
use App\Modules\Encounter\Presentation\Http\Transformers\EncounterListItemResponseTransformer;

class PatientSummaryResponseTransformer
{
    /**
     * @param  array<string, mixed>  $summary
     * @return array<string, mixed>
     */
    public static function transform(array $summary): array
    {
        $patient = $summary['patient'] ?? [];
        $insurance = $summary['insurance'] ?? null;
        $latestEncounter = $summary['latestEncounter'] ?? null;
        $workflowStatus = $summary['workflowStatus'] ?? null;
        $activeOrders = $summary['activeOrders'] ?? [];

        return [
            'patient' => [
                'id' => $patient['id'] ?? null,
                'patientNumber' => $patient['patient_number'] ?? null,
                'firstName' => $patient['first_name'] ?? null,
                'middleName' => $patient['middle_name'] ?? null,
                'lastName' => $patient['last_name'] ?? null,
                'gender' => $patient['gender'] ?? null,
                'dateOfBirth' => $patient['date_of_birth'] ?? null,
                'phone' => $patient['phone'] ?? null,
                'status' => $patient['status'] ?? null,
                'region' => $patient['region'] ?? null,
                'district' => $patient['district'] ?? null,
            ],
            'alerts' => array_map(
                [PatientAllergyResponseTransformer::class, 'transform'],
                $summary['allergies'] ?? [],
            ),
            'insurance' => $insurance !== null
                ? PatientInsuranceRecordResponseTransformer::transform($insurance)
                : null,
            'latestEncounter' => $latestEncounter !== null
                ? EncounterListItemResponseTransformer::transform($latestEncounter)
                : null,
            'workflowStatus' => $workflowStatus !== null ? [
                'step' => $workflowStatus['step'] ?? null,
                'department' => $workflowStatus['department'] ?? null,
                'appointmentId' => $workflowStatus['appointmentId'] ?? null,
                'serviceRequestId' => $workflowStatus['serviceRequestId'] ?? null,
            ] : null,
            'activeOrders' => [
                'labActive' => $activeOrders['labActive'] ?? 0,
                'pharmacyActive' => $activeOrders['pharmacyActive'] ?? 0,
                'imagingActive' => $activeOrders['imagingActive'] ?? 0,
                'procedureActive' => $activeOrders['procedureActive'] ?? 0,
            ],
        ];
    }
}
