<?php

namespace App\Modules\Patient\Infrastructure\Repositories;

use App\Modules\Patient\Domain\Repositories\PatientRepositoryInterface;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\Platform\Infrastructure\Support\PlatformScopeQueryApplier;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class EloquentPatientRepository implements PatientRepositoryInterface
{
    public function __construct(
        private readonly PlatformScopeQueryApplier $platformScopeQueryApplier,
        private readonly FeatureFlagResolverInterface $featureFlagResolver,
    ) {}

    public function create(array $attributes): array
    {
        $patient = new PatientModel();
        $patient->fill($attributes);
        $patient->save();

        return $patient->toArray();
    }

    public function findById(string $id): ?array
    {
        $query = PatientModel::query();
        $this->applyTenantScopeIfEnabled($query);
        $patient = $query->find($id);

        return $patient?->toArray();
    }

    public function update(string $id, array $attributes): ?array
    {
        $query = PatientModel::query();
        $this->applyTenantScopeIfEnabled($query);
        $patient = $query->find($id);

        if (! $patient) {
            return null;
        }

        $patient->fill($attributes);
        $patient->save();

        return $patient->toArray();
    }

    public function existsByPatientNumber(string $patientNumber): bool
    {
        return PatientModel::query()
            ->where('patient_number', $patientNumber)
            ->exists();
    }

    public function search(
        ?string $query,
        ?string $status,
        ?string $gender,
        ?string $region,
        ?string $district,
        int $page,
        int $perPage,
        ?string $sortBy,
        string $sortDirection
    ): array {
        $sortBy = in_array($sortBy, ['created_at', 'updated_at', 'first_name', 'last_name', 'patient_number'], true)
            ? $sortBy
            : 'created_at';

        $queryBuilder = PatientModel::query()
            ->when(
                $this->isPlatformScopingEnabled(),
                fn (Builder $builder) => $this->platformScopeQueryApplier->apply(
                    $builder,
                    tenantColumn: 'tenant_id',
                    facilityColumn: null,
                ),
            )
            ->when($query, function (Builder $builder, string $searchTerm): void {
                $normalizedSearchTerm = mb_strtolower(trim($searchTerm));
                $like = '%'.$normalizedSearchTerm.'%';

                $builder->where(function (Builder $nestedQuery) use ($like): void {
                    $nestedQuery
                        ->whereRaw('LOWER(patient_number) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(first_name) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(last_name) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(COALESCE(middle_name, \'\')) LIKE ?', [$like])
                        ->orWhereRaw("LOWER(concat(first_name, ' ', last_name)) LIKE ?", [$like])
                        ->orWhereRaw("LOWER(concat(first_name, ' ', COALESCE(middle_name, ''), ' ', last_name)) LIKE ?", [$like])
                        ->orWhereRaw('LOWER(COALESCE(phone, \'\')) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(COALESCE(email, \'\')) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(COALESCE(national_id, \'\')) LIKE ?', [$like]);
                });
            })
            ->when($status, fn (Builder $builder, string $requestedStatus) => $builder->where('status', $requestedStatus))
            ->when($gender, fn (Builder $builder, string $requestedGender) => $builder->where('gender', $requestedGender))
            ->when($region, function (Builder $builder, string $requestedRegion): void {
                $builder->whereRaw('LOWER(COALESCE(region, \'\')) LIKE ?', ['%'.mb_strtolower($requestedRegion).'%']);
            })
            ->when($district, function (Builder $builder, string $requestedDistrict): void {
                $builder->whereRaw('LOWER(COALESCE(district, \'\')) LIKE ?', ['%'.mb_strtolower($requestedDistrict).'%']);
            })
            ->orderBy($sortBy, $sortDirection);

        $paginator = $queryBuilder->paginate(
            perPage: $perPage,
            columns: ['*'],
            pageName: 'page',
            page: $page,
        );

        return $this->toSearchResult($paginator);
    }

    public function statusCounts(?string $query): array
    {
        $queryBuilder = PatientModel::query()
            ->when(
                $this->isPlatformScopingEnabled(),
                fn (Builder $builder) => $this->platformScopeQueryApplier->apply(
                    $builder,
                    tenantColumn: 'tenant_id',
                    facilityColumn: null,
                ),
            )
            ->when($query, function (Builder $builder, string $searchTerm): void {
                $normalizedSearchTerm = mb_strtolower(trim($searchTerm));
                $like = '%'.$normalizedSearchTerm.'%';

                $builder->where(function (Builder $nestedQuery) use ($like): void {
                    $nestedQuery
                        ->whereRaw('LOWER(patient_number) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(first_name) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(last_name) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(COALESCE(middle_name, \'\')) LIKE ?', [$like])
                        ->orWhereRaw("LOWER(concat(first_name, ' ', last_name)) LIKE ?", [$like])
                        ->orWhereRaw("LOWER(concat(first_name, ' ', COALESCE(middle_name, ''), ' ', last_name)) LIKE ?", [$like])
                        ->orWhereRaw('LOWER(COALESCE(phone, \'\')) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(COALESCE(email, \'\')) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(COALESCE(national_id, \'\')) LIKE ?', [$like]);
                });
            });

        $rows = $queryBuilder
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->get();

        $counts = [
            'active' => 0,
            'inactive' => 0,
            'other' => 0,
            'total' => 0,
        ];

        foreach ($rows as $row) {
            $status = strtolower((string) $row->status);
            $aggregate = (int) $row->aggregate;

            if ($status === 'active' || $status === 'inactive') {
                $counts[$status] += $aggregate;
            } else {
                $counts['other'] += $aggregate;
            }

            $counts['total'] += $aggregate;
        }

        return $counts;
    }

    private function toSearchResult(LengthAwarePaginator $paginator): array
    {
        $data = array_map(
            static fn (PatientModel $patient): array => $patient->toArray(),
            $paginator->items(),
        );

        return [
            'data' => $data,
            'meta' => [
                'currentPage' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ],
        ];
    }

    public function findActiveDuplicates(
        string $firstName,
        string $lastName,
        string $dateOfBirth,
        string $phone,
        ?string $excludePatientId = null
    ): array {
        $query = PatientModel::query();
        $this->applyTenantScopeIfEnabled($query);

        return $query
            ->where('status', 'active')
            ->where('first_name', $firstName)
            ->where('last_name', $lastName)
            ->whereDate('date_of_birth', $dateOfBirth)
            ->where('phone', $phone)
            ->when($excludePatientId, fn (Builder $builder, string $patientId) => $builder->where('id', '!=', $patientId))
            ->limit(5)
            ->get()
            ->map(static fn (PatientModel $patient): array => $patient->toArray())
            ->all();
    }

    private function applyTenantScopeIfEnabled(Builder $query): void
    {
        if (! $this->isPlatformScopingEnabled()) {
            return;
        }

        $this->platformScopeQueryApplier->apply(
            $query,
            tenantColumn: 'tenant_id',
            facilityColumn: null,
        );
    }

    private function isPlatformScopingEnabled(): bool
    {
        return $this->featureFlagResolver->isEnabled('platform.multi_facility_scoping')
            || $this->featureFlagResolver->isEnabled('platform.multi_tenant_isolation');
    }
}

