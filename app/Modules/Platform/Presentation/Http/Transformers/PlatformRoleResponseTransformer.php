<?php

namespace App\Modules\Platform\Presentation\Http\Transformers;

class PlatformRoleResponseTransformer
{
    public static function transform(array $role): array
    {
        return [
            'id' => $role['id'] ?? null,
            'tenantId' => $role['tenant_id'] ?? null,
            'facilityId' => $role['facility_id'] ?? null,
            'code' => $role['code'] ?? null,
            'name' => $role['name'] ?? null,
            'status' => $role['status'] ?? null,
            'description' => $role['description'] ?? null,
            'isSystem' => (bool) ($role['is_system'] ?? false),
            'permissionNames' => $role['permission_names'] ?? [],
            'permissionsCount' => (int) ($role['permissions_count'] ?? 0),
            'usersCount' => (int) ($role['users_count'] ?? 0),
            'createdAt' => $role['created_at'] ?? null,
            'updatedAt' => $role['updated_at'] ?? null,
        ];
    }
}

