<?php

namespace App\Modules\Encounter\Application\UseCases;

use App\Modules\Encounter\Application\Services\EncounterLifecycleService;
use App\Modules\Encounter\Domain\ValueObjects\EncounterStatus;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;

class UpdateEncounterStatusUseCase
{
    public function __construct(
        private readonly EncounterLifecycleService $encounterLifecycleService,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    public function execute(
        string $id,
        string $status,
        ?string $reason,
        ?int $actorId = null,
        bool $acknowledgeCloseGaps = false,
    ): ?array {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $normalizedStatus = strtolower(trim($status));

        $encounter = match ($normalizedStatus) {
            EncounterStatus::CLOSED->value => $this->encounterLifecycleService->close(
                encounterId: $id,
                reason: $reason,
                actorId: $actorId,
                acknowledgeCloseGaps: $acknowledgeCloseGaps,
            ),
            'reopened', EncounterStatus::IN_PROGRESS->value => $this->encounterLifecycleService->reopen(
                encounterId: $id,
                reason: (string) $reason,
                actorId: $actorId,
            ),
            default => null,
        };

        return $encounter?->toArray();
    }
}
