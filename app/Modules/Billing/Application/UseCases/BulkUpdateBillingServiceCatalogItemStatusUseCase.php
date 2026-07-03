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

        $normalizedIds = array_values(array_unique(array_filter(
            array_map(static fn (mixed $id): string => trim((string) $id), $itemIds),
            static fn (string $id): bool => $id !== '',
        )));

        $existingMap = $normalizedIds !== []
            ? $this->repository->findByIds($normalizedIds)
            : [];

        $foundIds = [];
        $notFound = [];
        foreach ($normalizedIds as $id) {
            if (isset($existingMap[$id])) {
                $foundIds[] = $id;
            } else {
                $notFound[] = $id;
            }
        }

        $reasonRequired = in_array($status, [
            BillingServiceCatalogItemStatus::INACTIVE->value,
            BillingServiceCatalogItemStatus::RETIRED->value,
        ], true);

        $updatedItems = [];
        if ($foundIds !== []) {
            $batched = $this->repository->bulkUpdate($foundIds, [
                'status' => $status,
                'status_reason' => $reason,
            ]);

            foreach ($batched as $updated) {
                $updatedId = (string) ($updated['id'] ?? '');
                $before = $existingMap[$updatedId] ?? [];

                $this->auditLogRepository->write(
                    billingServiceCatalogItemId: $updatedId,
                    action: 'billing-service-catalog-item.status.bulk-updated',
                    actorId: $actorId,
                    changes: [
                        'status' => [
                            'before' => $before['status'] ?? null,
                            'after' => $updated['status'] ?? null,
                        ],
                        'status_reason' => [
                            'before' => $before['status_reason'] ?? null,
                            'after' => $updated['status_reason'] ?? null,
                        ],
                    ],
                    metadata: [
                        'bulk_update' => true,
                        'transition' => [
                            'from' => $before['status'] ?? null,
                            'to' => $updated['status'] ?? null,
                        ],
                        'reason_required' => $reasonRequired,
                        'reason_provided' => trim((string) ($updated['status_reason'] ?? '')) !== '',
                    ],
                );

                $updatedItems[] = $updated;
            }
        }

        return [
            'updated' => $updatedItems,
            'notFound' => $notFound,
        ];
    }
}
