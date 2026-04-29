<?php

namespace App\Modules\Appointment\Infrastructure\Repositories;

use App\Modules\Appointment\Domain\Repositories\AppointmentRepositoryInterface;
use App\Modules\Appointment\Infrastructure\Models\AppointmentModel;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\Platform\Infrastructure\Support\PlatformScopeQueryApplier;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class EloquentAppointmentRepository implements AppointmentRepositoryInterface
{
    public function __construct(
        private readonly PlatformScopeQueryApplier $platformScopeQueryApplier,
        private readonly FeatureFlagResolverInterface $featureFlagResolver,
    ) {}

    public function create(array $attributes): array
    {
        $appointment = new AppointmentModel();
        $appointment->fill($attributes);
        $appointment->save();

        return $appointment->toArray();
    }

    public function findById(string $id): ?array
    {
        $query = AppointmentModel::query();
        $this->applyPlatformScopeIfEnabled($query);
        $appointment = $query->find($id);

        return $appointment?->toArray();
    }

    public function update(string $id, array $attributes): ?array
    {
        $query = AppointmentModel::query();
        $this->applyPlatformScopeIfEnabled($query);
        $appointment = $query->find($id);
        if (! $appointment) {
            return null;
        }

        $appointment->fill($attributes);
        $appointment->save();

        return $appointment->toArray();
    }

    public function existsByAppointmentNumber(string $appointmentNumber): bool
    {
        return AppointmentModel::query()
            ->where('appointment_number', $appointmentNumber)
            ->exists();
    }

    public function findActiveForPatientOnDate(
        string $patientId,
        string $scheduledDate,
        ?string $excludeAppointmentId = null,
    ): ?array {
        $query = AppointmentModel::query();
        $this->applyPlatformScopeIfEnabled($query);

        $query
            ->where('patient_id', $patientId)
            ->whereDate('scheduled_at', $scheduledDate)
            ->whereIn('status', ['scheduled', 'waiting_triage', 'waiting_provider', 'in_consultation'])
            ->when(
                $excludeAppointmentId,
                fn (Builder $builder, string $appointmentId) => $builder->where('id', '!=', $appointmentId),
            )
            ->orderBy('scheduled_at');

        return $query->first()?->toArray();
    }

    public function search(
        ?string $query,
        ?string $patientId,
        ?int $clinicianUserId,
        ?string $status,
        ?string $fromDateTime,
        ?string $toDateTime,
        int $page,
        int $perPage,
        ?string $sortBy,
        string $sortDirection
    ): array {
        $sortBy = in_array($sortBy, ['appointment_number', 'scheduled_at', 'status', 'created_at', 'updated_at'], true)
            ? $sortBy
            : 'scheduled_at';

        $queryBuilder = AppointmentModel::query();
        $this->applyPlatformScopeIfEnabled($queryBuilder);

        $queryBuilder
            ->when($query, function (Builder $builder, string $searchTerm): void {
                $like = '%'.$searchTerm.'%';
                $builder->where(function (Builder $nestedQuery) use ($like): void {
                    $nestedQuery
                        ->where('appointment_number', 'like', $like)
                        ->orWhere('reason', 'like', $like)
                        ->orWhere('triage_vitals_summary', 'like', $like)
                        ->orWhere('triage_notes', 'like', $like);
                });
            })
            ->when($patientId, fn (Builder $builder, string $requestedPatientId) => $builder->where('patient_id', $requestedPatientId))
            ->when($clinicianUserId, fn (Builder $builder, int $requestedClinicianUserId) => $builder->where('clinician_user_id', $requestedClinicianUserId))
            ->when($status, function (Builder $builder, string $requestedStatus): void {
                if ($requestedStatus === 'exceptions') {
                    $builder->whereIn('status', ['cancelled', 'no_show']);

                    return;
                }

                $builder->where('status', $requestedStatus);
            })
            ->when($fromDateTime, fn (Builder $builder, string $startDateTime) => $builder->where('scheduled_at', '>=', $startDateTime))
            ->when($toDateTime, fn (Builder $builder, string $endDateTime) => $builder->where('scheduled_at', '<=', $endDateTime))
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
        ?int $clinicianUserId,
        ?string $status,
        ?string $fromDateTime,
        ?string $toDateTime
    ): array {
        $queryBuilder = AppointmentModel::query();
        $this->applyPlatformScopeIfEnabled($queryBuilder);

        $queryBuilder
            ->when($query, function (Builder $builder, string $searchTerm): void {
                $like = '%'.$searchTerm.'%';
                $builder->where(function (Builder $nestedQuery) use ($like): void {
                    $nestedQuery
                        ->where('appointment_number', 'like', $like)
                        ->orWhere('reason', 'like', $like)
                        ->orWhere('triage_vitals_summary', 'like', $like)
                        ->orWhere('triage_notes', 'like', $like);
                });
            })
            ->when($patientId, fn (Builder $builder, string $requestedPatientId) => $builder->where('patient_id', $requestedPatientId))
            ->when($clinicianUserId, fn (Builder $builder, int $requestedClinicianUserId) => $builder->where('clinician_user_id', $requestedClinicianUserId))
            ->when($status, function (Builder $builder, string $requestedStatus): void {
                if ($requestedStatus === 'exceptions') {
                    $builder->whereIn('status', ['cancelled', 'no_show']);

                    return;
                }

                $builder->where('status', $requestedStatus);
            })
            ->when($fromDateTime, fn (Builder $builder, string $startDateTime) => $builder->where('scheduled_at', '>=', $startDateTime))
            ->when($toDateTime, fn (Builder $builder, string $endDateTime) => $builder->where('scheduled_at', '<=', $endDateTime));

        $rows = $queryBuilder
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->get();

        $counts = [
            'scheduled' => 0,
            'waiting_triage' => 0,
            'waiting_provider' => 0,
            'in_consultation' => 0,
            'completed' => 0,
            'cancelled' => 0,
            'no_show' => 0,
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
                static fn (AppointmentModel $appointment): array => $appointment->toArray(),
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
