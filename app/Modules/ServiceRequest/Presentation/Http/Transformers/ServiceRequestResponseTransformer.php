<?php

namespace App\Modules\ServiceRequest\Presentation\Http\Transformers;

class ServiceRequestResponseTransformer
{
    /**
     * @param  array<string, mixed>  $serviceRequest
     * @return array<string, mixed>
     */
    public static function transform(array $serviceRequest): array
    {
        return [
            'id' => $serviceRequest['id'] ?? null,
            'requestNumber' => $serviceRequest['request_number'] ?? null,
            'patientId' => $serviceRequest['patient_id'] ?? null,
            'appointmentId' => $serviceRequest['appointment_id'] ?? null,
            'requestedByUserId' => $serviceRequest['requested_by_user_id'] ?? null,
            'serviceType' => $serviceRequest['service_type'] ?? null,
            'priority' => $serviceRequest['priority'] ?? null,
            'status' => $serviceRequest['status'] ?? null,
            'notes' => $serviceRequest['notes'] ?? null,
            'requestedAt' => isset($serviceRequest['requested_at'])
                ? (is_string($serviceRequest['requested_at'])
                    ? $serviceRequest['requested_at']
                    : optional($serviceRequest['requested_at'])->toISOString())
                : null,
            'acknowledgedAt' => isset($serviceRequest['acknowledged_at'])
                ? (is_string($serviceRequest['acknowledged_at'])
                    ? $serviceRequest['acknowledged_at']
                    : optional($serviceRequest['acknowledged_at'])->toISOString())
                : null,
            'acknowledgedByUserId' => $serviceRequest['acknowledged_by_user_id'] ?? null,
            'completedAt' => isset($serviceRequest['completed_at'])
                ? (is_string($serviceRequest['completed_at'])
                    ? $serviceRequest['completed_at']
                    : optional($serviceRequest['completed_at'])->toISOString())
                : null,
            'createdAt' => isset($serviceRequest['created_at'])
                ? (is_string($serviceRequest['created_at'])
                    ? $serviceRequest['created_at']
                    : optional($serviceRequest['created_at'])->toISOString())
                : null,
            'updatedAt' => isset($serviceRequest['updated_at'])
                ? (is_string($serviceRequest['updated_at'])
                    ? $serviceRequest['updated_at']
                    : optional($serviceRequest['updated_at'])->toISOString())
                : null,
        ];
    }
}
