<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemAuditLogRepositoryInterface;
use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;
use App\Modules\Billing\Domain\ValueObjects\BillingServiceCatalogItemStatus;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;

class BulkUpdateBillingServiceCatalogItemStatusUseCase
{
    public function __construct(
        private readonly BillingServiceCatalogItemRepositoryInterface $repository,
        private readonly BillingServiceCatalogItemAuditLogRepositoryInterface $auditLogRepository,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    /**
     * @param array<int, string> $itemIds
     * @return array{updated: array<int, array<string, mixed>>, notFound: array<int, string>}
     */
    public function execute(array $itemIds, string $status, ?string $reason, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $updatedItems = [];
        $notFound = [];
        $reasonRequired = in_array($status, [
            BillingServiceCatalogItemStatus::INACTIVE->value,
            BillingServiceCatalogItemStatus::RETIRED->value,
        ], true);

        foreach ($itemIds as $id) {
            $normalizedId = trim((string) $id);
            if ($normalizedId === '') {
                continue;
            }

            $existing = $this->repository->findById($normalizedId);
            if (! $existing) {
                $notFound[] = $normalizedId;
                continue;
            }

            $updated = $this->repository->update($normalizedId, [
                'status' => $status,
                'status_reason' => $reason,
            ]);

            if (! $updated) {
                $notFound[] = $normalizedId;
                continue;
            }

            $this->auditLogRepository->write(
                billingServiceCatalogItemId: $normalizedId,
                action: 'billing-service-catalog-item.status.bulk-updated',
                actorId: $actorId,
                changes: [
                    'status' => [
                        'before' => $existing['status'] ?? null,
                        'after' => $updated['status'] ?? null,
                    ],
                    'status_reason' => [
                        'before' => $existing['status_reason'] ?? null,
                        'after' => $updated['status_reason'] ?? null,
                    ],
                ],
                metadata: [
                    'bulk_update' => true,
                    'transition' => [
                        'from' => $existing['status'] ?? null,
                        'to' => $updated['status'] ?? null,
                    ],
                    'reason_required' => $reasonRequired,
                    'reason_provided' => trim((string) ($updated['status_reason'] ?? '')) !== '',
                ],
            );

            $updatedItems[] = $updated;
        }

        return [
            'updated' => $updatedItems,
            'notFound' => $notFound,
        ];
    }
}
