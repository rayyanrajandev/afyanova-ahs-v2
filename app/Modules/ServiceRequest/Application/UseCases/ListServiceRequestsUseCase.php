<?php

namespace App\Modules\ServiceRequest\Application\UseCases;

use App\Modules\ServiceRequest\Application\Services\ServiceRequestDepartmentScope;
use App\Modules\ServiceRequest\Domain\Repositories\ServiceRequestRepositoryInterface;
use App\Modules\ServiceRequest\Domain\ValueObjects\ServiceRequestServiceType;
use App\Modules\ServiceRequest\Domain\ValueObjects\ServiceRequestStatus;
use Illuminate\Support\Str;

class ListServiceRequestsUseCase
{
    public function __construct(private readonly ServiceRequestRepositoryInterface $serviceRequestRepository) {}

    /**
     * $scope enforces Direct Service Queue V2's hard department scoping
     * (see ServiceRequestDepartmentScopeResolver's docblock): a
     * department-scoped actor's own department always wins over any
     * client-supplied departmentId filter, and an actor with no assigned
     * department gets an empty result set rather than falling back to
     * showing everything.
     */
    public function execute(array $filters, ServiceRequestDepartmentScope $scope): array
    {
        if ($scope->hasNoAssignedDepartment()) {
            return [
                'data' => [],
                'meta' => ['currentPage' => 1, 'perPage' => (int) ($filters['perPage'] ?? 20), 'total' => 0, 'lastPage' => 1],
            ];
        }

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

        $departmentId = $scope->canViewAllDepartments
            ? (isset($filters['departmentId']) && Str::isUuid((string) $filters['departmentId']) ? (string) $filters['departmentId'] : null)
            : $scope->departmentId;

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
            departmentId: $departmentId,
        );
    }
}
