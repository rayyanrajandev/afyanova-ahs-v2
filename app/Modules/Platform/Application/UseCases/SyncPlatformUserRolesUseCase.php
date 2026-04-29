<?php

namespace App\Modules\Platform\Application\UseCases;

use App\Modules\Platform\Application\Exceptions\UnknownPlatformRbacRoleException;
use App\Modules\Platform\Application\Support\PrivilegedPlatformUserChangePolicy;
use App\Modules\Platform\Domain\Repositories\PlatformRbacRepositoryInterface;
use App\Modules\Platform\Domain\Repositories\PlatformUserAdminRepositoryInterface;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;

class SyncPlatformUserRolesUseCase
{
    public function __construct(
        private readonly PlatformRbacRepositoryInterface $platformRbacRepository,
        private readonly PlatformUserAdminRepositoryInterface $platformUserAdminRepository,
        private readonly PrivilegedPlatformUserChangePolicy $privilegedPlatformUserChangePolicy,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    /**
     * @param  array<int, string>  $roleIds
     */
    public function execute(
        int $userId,
        array $roleIds,
        ?string $approvalCaseReference = null,
        ?int $actorId = null
    ): ?array {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $normalizedApprovalCaseReference = $this->privilegedPlatformUserChangePolicy->normalizeApprovalCaseReference(
            $approvalCaseReference,
        );
        $privilegedContext = $this->platformUserAdminRepository->findPrivilegedUserContextInScope($userId);
        $this->privilegedPlatformUserChangePolicy->assertApprovalCaseReferenceForTarget(
            privilegedContext: $privilegedContext,
            approvalCaseReference: $normalizedApprovalCaseReference,
        );

        $normalizedRoleIds = array_values(array_unique(array_filter(array_map(
            static fn ($value): string => is_string($value) ? trim($value) : '',
            $roleIds,
        ))));

        $resolvedRoleIds = $this->platformRbacRepository->resolveExistingRoleIdsInScope($normalizedRoleIds);
        if (count($resolvedRoleIds) !== count($normalizedRoleIds)) {
            throw new UnknownPlatformRbacRoleException('One or more role ids are invalid for the current scope.');
        }

        $result = $this->platformRbacRepository->syncUserRoles($userId, $resolvedRoleIds);
        if (! $result) {
            return null;
        }

        $this->platformRbacRepository->writeAuditLog(
            tenantId: $this->platformScopeContext->tenantId(),
            facilityId: $this->platformScopeContext->facilityId(),
            actorId: $actorId,
            action: 'platform-rbac.user.roles.synced',
            targetType: 'user',
            targetId: (string) $userId,
            changes: [
                'role_ids' => [
                    'after' => $result['role_ids'] ?? [],
                ],
            ],
            metadata: $this->privilegedPlatformUserChangePolicy->buildAuditMetadata(
                privilegedContext: $privilegedContext,
                approvalCaseReference: $normalizedApprovalCaseReference,
            ),
        );

        return $result;
    }
}
