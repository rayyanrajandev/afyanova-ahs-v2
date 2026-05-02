<?php

namespace App\Modules\ServiceRequest\Application\UseCases;

use App\Modules\ServiceRequest\Domain\Repositories\ServiceRequestRepositoryInterface;
use App\Modules\ServiceRequest\Domain\ValueObjects\ServiceRequestServiceType;
use App\Modules\ServiceRequest\Domain\ValueObjects\ServiceRequestStatus;
use Illuminate\Support\Str;

class ListServiceRequestsUseCase
{
    public function __construct(private readonly ServiceRequestRepositoryInterface $serviceRequestRepository) {}

    public function execute(array $filters): array
    {
        $page = max((int) ($filters['page'] ?? 1), 1);
        $perPage = min(max((int) ($filters['perPage'] ?? 20), 1), 100);

        $patientId = isset($filters['patientId']) ? trim((string) $filters['patientId']) : null;
        $patientId = ($patientId !== null && $patientId !== '' && Str::isUuid($patientId)) ? $patientId : null;

        $serviceType = $filters['serviceType'] ?? null;
        if (! in_array($serviceType, ServiceRequestServiceType::values(), true)) {
            $serviceType = null;
        }

        $status = $filters['status'] ?? null;
        if (! in_array($status, ServiceRequestStatus::values(), true)) {
            $status = null;
        }

        $priority = $filters['priority'] ?? null;
        if (! in_array($priority, ['routine', 'urgent'], true)) {
            $priority = null;
        }

        $fromDateTime = isset($filters['from']) ? trim((string) $filters['from']) : null;
        $fromDateTime = $fromDateTime !== '' ? $fromDateTime : null;

        $toDateTime = isset($filters['to']) ? trim((string) $filters['to']) : null;
        $toDateTime = $toDateTime !== '' ? $toDateTime : null;

        $sortDirection = strtolower((string) ($filters['sortDir'] ?? 'asc'));
        $sortDirection = $sortDirection === 'desc' ? 'desc' : 'asc';

        return $this->serviceRequestRepository->search(
            patientId: $patientId,
            serviceType: $serviceType,
            status: $status,
            priority: $priority,
            fromDateTime: $fromDateTime,
            toDateTime: $toDateTime,
            page: $page,
            perPage: $perPage,
            sortDirection: $sortDirection,
        );
    }
}
