<?php

namespace App\Modules\ServiceRequest\Application\UseCases;

use App\Modules\Department\Domain\Repositories\DepartmentRepositoryInterface;

class ListWalkInDepartmentOptionsUseCase
{
    public function __construct(
        private readonly DepartmentRepositoryInterface $departmentRepository,
    ) {}

    /**
     * Active departments in scope, for directing walk-in patients (option {@see value} is department UUID).
     *
     * @return array<int, array{value: string, label: string, code: string|null, serviceType: string|null}>
     */
    public function execute(): array
    {
        $result = $this->departmentRepository->search(
            query: null,
            status: 'active',
            serviceType: null,
            managerUserId: null,
            page: 1,
            perPage: 500,
            sortBy: 'name',
            sortDirection: 'asc',
        );

        $options = [];
        foreach ($result['data'] ?? [] as $row) {
            $id = trim((string) ($row['id'] ?? ''));
            $name = trim((string) ($row['name'] ?? ''));
            if ($id === '' || $name === '') {
                continue;
            }

            $code = trim((string) ($row['code'] ?? ''));
            $serviceType = isset($row['service_type']) ? trim((string) $row['service_type']) : '';

            $options[] = [
                'value' => $id,
                'label' => $code !== '' ? sprintf('%s - %s', $code, $name) : $name,
                'code' => $code !== '' ? $code : null,
                'serviceType' => $serviceType !== '' ? $serviceType : null,
            ];
        }

        return $options;
    }
}
