<?php

namespace App\Modules\PatientFlow\Presentation\Http\Transformers;

class VisitJourneyEntryResponseTransformer
{
    /**
     * @param  array<string, mixed>  $entry
     * @return array<string, mixed>
     */
    public static function transform(array $entry): array
    {
        return [
            'appointmentId' => $entry['appointmentId'] ?? null,
            'patientId' => $entry['patientId'] ?? null,
            'patientName' => $entry['patientName'] ?? null,
            'patientNumber' => $entry['patientNumber'] ?? null,
            'department' => $entry['department'] ?? null,
            'clinicianUserId' => $entry['clinicianUserId'] ?? null,
            'appointmentStatus' => $entry['appointmentStatus'] ?? null,
            'step' => $entry['step'] ?? null,
        ];
    }
}
