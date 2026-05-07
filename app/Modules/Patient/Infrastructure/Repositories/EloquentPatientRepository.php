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
        ?string $firstName,
        ?string $lastName,
        ?string $dateOfBirth,
        ?string $phone,
        ?string $nationalId = null,
        ?string $excludePatientId = null
    ): array {
        $matches = [];

        $normalizedNationalId = $this->normalizeIdentifier($nationalId);
        if ($normalizedNationalId !== '') {
            $query = $this->activeDuplicateQuery($excludePatientId)
                ->whereRaw($this->normalizedIdentifierSql('national_id').' = ?', [$normalizedNationalId]);

            foreach ($query->limit(5)->get() as $patient) {
                if ($this->normalizeIdentifier($patient->national_id) === $normalizedNationalId) {
                    $matches[$patient->id] = $patient->toArray();
                }
            }
        }

        $normalizedPhone = $this->normalizePhone($phone);
        $normalizedFirstName = mb_strtolower(trim((string) $firstName));
        $normalizedLastName = mb_strtolower(trim((string) $lastName));
        $normalizedDateOfBirth = trim((string) $dateOfBirth);

        if (
            $normalizedFirstName !== ''
            && $normalizedLastName !== ''
            && $normalizedDateOfBirth !== ''
            && $normalizedPhone !== ''
        ) {
            $phoneCandidates = $this->phoneSearchCandidates($normalizedPhone);

            $query = $this->activeDuplicateQuery($excludePatientId)
                ->whereRaw('LOWER(TRIM(first_name)) = ?', [$normalizedFirstName])
                ->whereRaw('LOWER(TRIM(last_name)) = ?', [$normalizedLastName])
                ->whereDate('date_of_birth', $normalizedDateOfBirth)
                ->whereRaw(
                    $this->normalizedPhoneSql('phone').' in ('.implode(',', array_fill(0, count($phoneCandidates), '?')).')',
                    $phoneCandidates,
                );

            foreach ($query->limit(5)->get() as $patient) {
                if ($this->normalizePhone($patient->phone) === $normalizedPhone) {
                    $matches[$patient->id] = $patient->toArray();
                }
            }
        }

        return array_slice(array_values($matches), 0, 5);
    }

    private function activeDuplicateQuery(?string $excludePatientId = null): Builder
    {
        $query = PatientModel::query()->where('status', 'active');
        $this->applyTenantScopeIfEnabled($query);

        if ($excludePatientId !== null && trim($excludePatientId) !== '') {
            $query->where('id', '!=', $excludePatientId);
        }

        return $query;
    }

    private function normalizedIdentifierSql(string $column): string
    {
        return "LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE({$column}, '')), '-', ''), ' ', ''), '/', ''), '.', ''), '_', ''), ':', ''))";
    }

    private function normalizedPhoneSql(string $column): string
    {
        return "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE({$column}, '')), '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '')";
    }

    private function normalizeIdentifier(mixed $value): string
    {
        return preg_replace('/[^a-z0-9]+/i', '', mb_strtolower(trim((string) $value))) ?? '';
    }

    private function normalizePhone(mixed $value): string
    {
        $digits = preg_replace('/\D+/', '', (string) $value) ?? '';

        if (strlen($digits) === 12 && str_starts_with($digits, '255')) {
            return $digits;
        }

        if (strlen($digits) === 10 && str_starts_with($digits, '0')) {
            return '255'.substr($digits, 1);
        }

        if (strlen($digits) === 9) {
            return '255'.$digits;
        }

        return $digits;
    }

    /**
     * @return array<int, string>
     */
    private function phoneSearchCandidates(string $normalizedPhone): array
    {
        $candidates = [$normalizedPhone];

        if (strlen($normalizedPhone) === 12 && str_starts_with($normalizedPhone, '255')) {
            $local = '0'.substr($normalizedPhone, 3);
            $withoutCountryCode = substr($normalizedPhone, 3);

            $candidates[] = $local;
            $candidates[] = $withoutCountryCode;
        }

        return array_values(array_unique(array_filter($candidates)));
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
