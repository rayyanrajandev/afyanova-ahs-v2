<?php

namespace App\Modules\Platform\Application\UseCases;

use App\Modules\Platform\Application\Exceptions\DuplicatePlatformRoleCodeException;
use App\Modules\Platform\Application\Exceptions\UnknownPlatformRbacPermissionException;
use App\Modules\Platform\Domain\Repositories\PlatformRbacRepositoryInterface;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Modules\Platform\Domain\ValueObjects\PlatformRoleStatus;

class CreatePlatformRoleUseCase
{
    public function __construct(
        private readonly PlatformRbacRepositoryInterface $platformRbacRepository,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    public function execute(array $payload, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $tenantId = $this->platformScopeContext->tenantId();
        $facilityId = $this->platformScopeContext->facilityId();
        $code = $this->normalizeCode((string) $payload['code']);

        if ($this->platformRbacRepository->existsRoleCodeInScope($code, $tenantId, $facilityId)) {
            throw new DuplicatePlatformRoleCodeException('Role code already exists for the current scope.');
        }

        $createdRole = $this->platformRbacRepository->createRole([
            'tenant_id' => $tenantId,
            'facility_id' => $facilityId,
            'code' => $code,
            'name' => trim((string) $payload['name']),
            'status' => PlatformRoleStatus::ACTIVE->value,
            'description' => $this->nullableTrimmedValue($payload['description'] ?? null),
            'is_system' => false,
        ]);

        $permissionNames = $this->normalizePermissionNames($payload['permission_names'] ?? []);
        if ($permissionNames !== []) {
            $resolvedPermissionNames = $this->platformRbacRepository->resolveExistingPermissionNames($permissionNames);

            if (count($resolvedPermissionNames) !== count($permissionNames)) {
                throw new UnknownPlatformRbacPermissionException('One or more permission names are invalid.');
            }

            $createdRole = $this->platformRbacRepository->syncRolePermissions($createdRole['id'], $resolvedPermissionNames)
                ?? $createdRole;
        }

        $this->platformRbacRepository->writeAuditLog(
            tenantId: $tenantId,
            facilityId: $facilityId,
            actorId: $actorId,
            action: 'platform-rbac.role.created',
            targetType: 'role',
            targetId: (string) ($createdRole['id'] ?? ''),
            changes: [
                'after' => $this->extractTrackedFields($createdRole),
            ],
        );

        return $createdRole;
    }

    private function normalizeCode(string $value): string
    {
        return strtoupper(trim($value));
    }

    private function nullableTrimmedValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }

    /**
     * @return array<int, string>
     */
    private function normalizePermissionNames(mixed $permissionNames): array
    {
        if (! is_array($permissionNames)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map(
            static fn ($value): string => is_string($value) ? trim($value) : '',
            $permissionNames,
        ))));
    }

    /**
     * @return array<string, mixed>
     */
    private function extractTrackedFields(array $role): array
    {
        $tracked = [
            'tenant_id',
            'facility_id',
            'code',
            'name',
            'status',
            'description',
            'is_system',
            'permission_names',
        ];

        $result = [];
        foreach ($tracked as $field) {
            $result[$field] = $role[$field] ?? null;
        }

        return $result;
    }
}

