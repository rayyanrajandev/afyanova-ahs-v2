<?php

namespace App\Modules\Platform\Presentation\Http\Transformers;

class FacilityResourceResponseTransformer
{
    public static function transform(array $resource): array
    {
        return [
            'id' => $resource['id'] ?? null,
            'tenantId' => $resource['tenant_id'] ?? null,
            'facilityId' => $resource['facility_id'] ?? null,
            'resourceType' => $resource['resource_type'] ?? null,
            'code' => $resource['code'] ?? null,
            'name' => $resource['name'] ?? null,
            'departmentId' => $resource['department_id'] ?? null,
            'servicePointType' => $resource['service_point_type'] ?? null,
            'wardName' => $resource['ward_name'] ?? null,
            'bedNumber' => $resource['bed_number'] ?? null,
            'location' => $resource['location'] ?? null,
            'status' => $resource['status'] ?? null,
            'statusReason' => $resource['status_reason'] ?? null,
            'notes' => $resource['notes'] ?? null,
            'createdAt' => $resource['created_at'] ?? null,
            'updatedAt' => $resource['updated_at'] ?? null,
        ];
    }
}

