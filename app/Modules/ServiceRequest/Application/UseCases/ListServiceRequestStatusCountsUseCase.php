<?php

namespace App\Modules\ServiceRequest\Application\UseCases;

use App\Modules\ServiceRequest\Domain\Repositories\ServiceRequestRepositoryInterface;
use App\Modules\ServiceRequest\Domain\ValueObjects\ServiceRequestServiceType;

class ListServiceRequestStatusCountsUseCase
{
    public function __construct(private readonly ServiceRequestRepositoryInterface $serviceRequestRepository) {}

    public function execute(array $filters): array
    {
        $serviceType = $filters['serviceType'] ?? null;
        if (! in_array($serviceType, ServiceRequestServiceType::values(), true)) {
            $serviceType = null;
        }

        $priority = $filters['priority'] ?? null;
        if (! in_array($priority, ['routine', 'urgent'], true)) {
            $priority = null;
        }

        $fromDateTime = isset($filters['from']) ? trim((string) $filters['from']) : null;
        $fromDateTime = $fromDateTime !== '' ? $fromDateTime : null;

        $toDateTime = isset($filters['to']) ? trim((string) $filters['to']) : null;
        $toDateTime = $toDateTime !== '' ? $toDateTime : null;

        return $this->serviceRequestRepository->statusCounts(
            serviceType: $serviceType,
            priority: $priority,
            fromDateTime: $fromDateTime,
            toDateTime: $toDateTime,
        );
    }
}
