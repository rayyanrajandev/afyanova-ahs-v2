<?php

namespace App\Modules\Admission\Infrastructure\Repositories;

use App\Modules\Admission\Domain\Repositories\AdmissionRepositoryInterface;
use App\Modules\Admission\Domain\ValueObjects\AdmissionStatus;
use App\Modules\Admission\Infrastructure\Models\AdmissionModel;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\Platform\Infrastructure\Support\PlatformScopeQueryApplier;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class EloquentAdmissionRepository implements AdmissionRepositoryInterface
{
    public function __construct(
        private readonly PlatformScopeQueryApplier $platformScopeQueryApplier,
        private readonly FeatureFlagResolverInterface $featureFlagResolver,
    ) {}

    public function create(array $attributes): array
    {
        $admission = new AdmissionModel();
        $admission->fill($attributes);
        $admission->save();

        return $admission->toArray();
    }

    public function findById(string $id): ?array
    {
        $query = AdmissionModel::query();
        $this->applyPlatformScopeIfEnabled($query);
        $admission = $query->find($id);

        return $admission?->toArray();
    }

    public function update(string $id, array $attributes): ?array
    {
        $query = AdmissionModel::query();
        $this->applyPlatformScopeIfEnabled($query);
        $admission = $query->find($id);
        if (! $admission) {
            return null;
        }

        $admission->fill($attributes);
        $admission->save();

        return $admission->toArray();
    }

    public function existsByAdmissionNumber(string $admissionNumber): bool
    {
        return AdmissionModel::query()
            ->where('admission_number', $admissionNumber)
            ->exists();
    }

    public function hasActivePlacementConflict(
        string $ward,
        string $bed,
        ?string $tenantId,
        ?string $facilityId,
        ?string $excludeAdmissionId = null
    ): bool {
        $normalizedWard = trim($ward);
        $normalizedBed = trim($bed);

        if ($normalizedWard === '' || $normalizedBed === '') {
            return false;
        }

        $query = AdmissionModel::query()
            ->whereIn('status', [
                AdmissionStatus::ADMITTED->value,
                AdmissionStatus::TRANSFERRED->value,
            ])
            ->whereRaw("LOWER(TRIM(COALESCE(ward, ''))) = ?", [strtolower($normalizedWard)])
            ->whereRaw("LOWER(TRIM(COALESCE(bed, ''))) = ?", [strtolower($normalizedBed)]);

        if ($excludeAdmissionId !== null && trim($excludeAdmissionId) !== '') {
            $query->where((new AdmissionModel())->getKeyName(), '!=', $excludeAdmissionId);
        }

        if ($tenantId === null) {
            $query->whereNull('tenant_id');
        } else {
            $query->where('tenant_id', $tenantId);
        }

        if ($facilityId === null) {
            $query->whereNull('facility_id');
        } else {
            $query->where('facility_id', $facilityId);
        }

        return $query->exists();
    }

    public function search(
        ?string $query,
        ?string $patientId,
        ?string $status,
        ?string $ward,
        ?string $fromDateTime,
        ?string $toDateTime,
        int $page,
        int $perPage,
        ?string $sortBy,
        string $sortDirection
    ): array {
        $sortBy = in_array($sortBy, ['admission_number', 'admitted_at', 'status', 'created_at', 'updated_at'], true)
            ? $sortBy
            : 'admitted_at';

        $queryBuilder = AdmissionModel::query();
        $this->applyPlatformScopeIfEnabled($queryBuilder);

        $queryBuilder
            ->when($query, function (Builder $builder, string $searchTerm): void {
                $like = '%'.$searchTerm.'%';

                $builder->where(function (Builder $nestedQuery) use ($like): void {
                    $nestedQuery
                        ->where('admission_number', 'like', $like)
                        ->orWhere('admission_reason', 'like', $like)
                        ->orWhere('ward', 'like', $like)
                        ->orWhere('bed', 'like', $like);
                });
            })
            ->when($patientId, fn (Builder $builder, string $requestedPatientId) => $builder->where('patient_id', $requestedPatientId))
            ->when($status, fn (Builder $builder, string $requestedStatus) => $builder->where('status', $requestedStatus))
            ->when($ward, fn (Builder $builder, string $requestedWard) => $builder->where('ward', $requestedWard))
            ->when($fromDateTime, fn (Builder $builder, string $startDateTime) => $builder->where('admitted_at', '>=', $startDateTime))
            ->when($toDateTime, fn (Builder $builder, string $endDateTime) => $builder->where('admitted_at', '<=', $endDateTime))
            ->orderBy($sortBy, $sortDirection);

        $paginator = $queryBuilder->paginate(
            perPage: $perPage,
            columns: ['*'],
            pageName: 'page',
            page: $page,
        );

        return $this->toSearchResult($paginator);
    }

    public function statusCounts(
        ?string $query,
        ?string $patientId,
        ?string $ward,
        ?string $fromDateTime,
        ?string $toDateTime
    ): array {
        $queryBuilder = AdmissionModel::query();
        $this->applyPlatformScopeIfEnabled($queryBuilder);

        $queryBuilder
            ->when($query, function (Builder $builder, string $searchTerm): void {
                $like = '%'.$searchTerm.'%';

                $builder->where(function (Builder $nestedQuery) use ($like): void {
                    $nestedQuery
                        ->where('admission_number', 'like', $like)
                        ->orWhere('admission_reason', 'like', $like)
                        ->orWhere('ward', 'like', $like)
                        ->orWhere('bed', 'like', $like);
                });
            })
            ->when($patientId, fn (Builder $builder, string $requestedPatientId) => $builder->where('patient_id', $requestedPatientId))
            ->when($ward, fn (Builder $builder, string $requestedWard) => $builder->where('ward', $requestedWard))
            ->when($fromDateTime, fn (Builder $builder, string $startDateTime) => $builder->where('admitted_at', '>=', $startDateTime))
            ->when($toDateTime, fn (Builder $builder, string $endDateTime) => $builder->where('admitted_at', '<=', $endDateTime));

        $rows = $queryBuilder
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->get();

        $counts = [
            'admitted' => 0,
            'discharged' => 0,
            'transferred' => 0,
            'cancelled' => 0,
            'other' => 0,
            'total' => 0,
        ];

        foreach ($rows as $row) {
            $status = strtolower((string) $row->status);
            $aggregate = (int) $row->aggregate;

            if (array_key_exists($status, $counts) && $status !== 'other' && $status !== 'total') {
                $counts[$status] += $aggregate;
            } else {
                $counts['other'] += $aggregate;
            }

            $counts['total'] += $aggregate;
        }

        return $counts;
    }

    private function applyPlatformScopeIfEnabled(Builder $query): void
    {
        if (! $this->isPlatformScopingEnabled()) {
            return;
        }

        $this->platformScopeQueryApplier->apply($query);
    }

    private function isPlatformScopingEnabled(): bool
    {
        return $this->featureFlagResolver->isEnabled('platform.multi_facility_scoping')
            || $this->featureFlagResolver->isEnabled('platform.multi_tenant_isolation');
    }

    private function toSearchResult(LengthAwarePaginator $paginator): array
    {
        return [
            'data' => array_map(
                static fn (AdmissionModel $admission): array => $admission->toArray(),
                $paginator->items(),
            ),
            'meta' => [
                'currentPage' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ],
        ];
    }
}



