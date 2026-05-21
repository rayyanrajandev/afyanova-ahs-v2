<?php

namespace App\Modules\Encounter\Presentation\Http\Transformers;

use App\Modules\Appointment\Presentation\Http\Transformers\AppointmentResponseTransformer;
use App\Modules\Laboratory\Presentation\Http\Transformers\LaboratoryOrderResponseTransformer;
use App\Modules\MedicalRecord\Presentation\Http\Transformers\MedicalRecordResponseTransformer;
use App\Modules\Pharmacy\Presentation\Http\Transformers\PharmacyOrderResponseTransformer;
use App\Modules\Radiology\Presentation\Http\Transformers\RadiologyOrderResponseTransformer;
use App\Modules\TheatreProcedure\Presentation\Http\Transformers\TheatreProcedureResponseTransformer;

class EncounterWorkspaceResponseTransformer
{
    /**
     * @param  array<string, mixed>  $workspace
     * @return array<string, mixed>
     */
    public static function transform(array $workspace): array
    {
        $encounter = is_array($workspace['encounter'] ?? null) ? $workspace['encounter'] : [];
        $appointment = is_array($workspace['appointment'] ?? null) ? $workspace['appointment'] : null;
        $primaryMedicalRecord = is_array($workspace['primaryMedicalRecord'] ?? null)
            ? $workspace['primaryMedicalRecord']
            : null;

        return [
            'encounter' => EncounterResponseTransformer::transform($encounter),
            'appointment' => $appointment !== null
                ? AppointmentResponseTransformer::transform($appointment)
                : null,
            'primaryMedicalRecord' => $primaryMedicalRecord !== null
                ? MedicalRecordResponseTransformer::transform($primaryMedicalRecord)
                : null,
            'laboratoryOrders' => array_map(
                static fn (array $order): array => LaboratoryOrderResponseTransformer::transform($order),
                is_array($workspace['laboratoryOrders'] ?? null) ? $workspace['laboratoryOrders'] : [],
            ),
            'pharmacyOrders' => array_map(
                static fn (array $order): array => PharmacyOrderResponseTransformer::transform($order),
                is_array($workspace['pharmacyOrders'] ?? null) ? $workspace['pharmacyOrders'] : [],
            ),
            'radiologyOrders' => array_map(
                static fn (array $order): array => RadiologyOrderResponseTransformer::transform($order),
                is_array($workspace['radiologyOrders'] ?? null) ? $workspace['radiologyOrders'] : [],
            ),
            'theatreProcedures' => array_map(
                static fn (array $procedure): array => TheatreProcedureResponseTransformer::transform($procedure),
                is_array($workspace['theatreProcedures'] ?? null) ? $workspace['theatreProcedures'] : [],
            ),
            'closeReadiness' => EncounterCloseReadinessResponseTransformer::transform(
                is_array($workspace['closeReadiness'] ?? null) ? $workspace['closeReadiness'] : null,
            ),
        ];
    }
}
