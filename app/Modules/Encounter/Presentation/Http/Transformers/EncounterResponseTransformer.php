<?php

namespace App\Modules\Encounter\Presentation\Http\Transformers;

class EncounterResponseTransformer
{
    public static function transform(array $encounter): array
    {
        return [
            'id' => $encounter['id'] ?? null,
            'encounterNumber' => $encounter['encounter_number'] ?? null,
            'patientId' => $encounter['patient_id'] ?? null,
            'appointmentId' => $encounter['appointment_id'] ?? null,
            'admissionId' => $encounter['admission_id'] ?? null,
            'primaryClinicianUserId' => $encounter['primary_clinician_user_id'] ?? null,
            'status' => $encounter['status'] ?? null,
            'statusReason' => $encounter['status_reason'] ?? null,
            'openedAt' => $encounter['opened_at'] ?? null,
            'closedAt' => $encounter['closed_at'] ?? null,
            'createdAt' => $encounter['created_at'] ?? null,
            'updatedAt' => $encounter['updated_at'] ?? null,
        ];
    }
}
