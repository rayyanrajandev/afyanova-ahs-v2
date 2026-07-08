<?php

namespace App\Modules\Reception\Presentation\Http\Transformers;

class ReceptionQueueEntryResponseTransformer
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
            'arrivalMode' => $entry['arrivalMode'] ?? null,
            'tier' => $entry['tier'] ?? null,
            'waitStartedAt' => $entry['waitStartedAt']?->toIso8601String(),
            'waitMinutes' => $entry['waitMinutes'] ?? null,
        ];
    }
}
