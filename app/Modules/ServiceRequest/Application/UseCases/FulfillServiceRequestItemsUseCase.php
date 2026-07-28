<?php

namespace App\Modules\ServiceRequest\Application\UseCases;

use App\Modules\Laboratory\Application\Jobs\FulfillLaboratoryServiceRequestItemJob;
use App\Modules\Pharmacy\Application\Jobs\FulfillPharmacyServiceRequestItemJob;
use App\Modules\Radiology\Application\Jobs\FulfillRadiologyServiceRequestItemJob;
use App\Modules\ServiceRequest\Domain\Repositories\ServiceRequestItemRepositoryInterface;
use App\Modules\ServiceRequest\Domain\Repositories\ServiceRequestRepositoryInterface;
use App\Modules\ServiceRequest\Domain\ValueObjects\ServiceRequestItemStatus;

class FulfillServiceRequestItemsUseCase
{
    private const SERVICE_TYPE_JOB_MAP = [
        'laboratory' => FulfillLaboratoryServiceRequestItemJob::class,
        'pharmacy' => FulfillPharmacyServiceRequestItemJob::class,
        'radiology' => FulfillRadiologyServiceRequestItemJob::class,
    ];

    public function __construct(
        private readonly ServiceRequestItemRepositoryInterface $itemRepository,
        private readonly ServiceRequestRepositoryInterface $serviceRequestRepository,
        private readonly AppendServiceRequestAuditEventUseCase $appendAuditEvent,
    ) {}

    public function execute(string $serviceRequestId, array $items, int $actorId): void
    {
        $sr = $this->serviceRequestRepository->findById($serviceRequestId);
        $patientId = $sr ? (string) ($sr['patient_id'] ?? '') : '';

        if ($patientId === '') {
            return;
        }

        $priority = (string) ($sr['priority'] ?? 'routine');

        foreach ($items as $item) {
            if (($item['status'] ?? '') !== ServiceRequestItemStatus::PENDING->value) {
                continue;
            }

            $itemId = (string) $item['id'];
            $serviceType = (string) ($item['service_type'] ?? '');
            $jobClass = self::SERVICE_TYPE_JOB_MAP[$serviceType] ?? null;

            if ($jobClass === null) {
                continue;
            }

            if ($item['catalog_item_id'] === null || $item['catalog_item_id'] === '') {
                continue;
            }

            $this->itemRepository->update($itemId, [
                'status' => ServiceRequestItemStatus::PROCESSING->value,
            ]);

            $this->appendAuditEvent->execute(
                $serviceRequestId,
                'service_request_item.fulfillment_started',
                $actorId,
                ServiceRequestItemStatus::PENDING->value,
                ServiceRequestItemStatus::PROCESSING->value,
                ['item_id' => $itemId, 'service_type' => $serviceType],
                $itemId,
            );

            dispatch_sync(new $jobClass(
                serviceRequestItemId: $itemId,
                catalogItemId: (string) $item['catalog_item_id'],
                quantity: (int) ($item['quantity'] ?? 1),
                actorId: $actorId,
                serviceRequestId: $serviceRequestId,
                patientId: $patientId,
                priority: $priority,
            ));
        }
    }
}
