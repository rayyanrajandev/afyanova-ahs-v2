<?php

namespace App\Modules\Patient\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Patient\Application\UseCases\CreatePatientUseCase;
use App\Modules\Patient\Application\UseCases\GetPatientUseCase;
use App\Modules\Patient\Application\UseCases\ListPatientAuditLogsUseCase;
use App\Modules\Patient\Application\UseCases\ListPatientStatusCountsUseCase;
use App\Modules\Patient\Application\UseCases\ListPatientsUseCase;
use App\Modules\Patient\Application\UseCases\UpdatePatientStatusUseCase;
use App\Modules\Patient\Application\UseCases\UpdatePatientUseCase;
use App\Modules\Patient\Presentation\Http\Requests\StorePatientRequest;
use App\Modules\Patient\Presentation\Http\Requests\UpdatePatientRequest;
use App\Modules\Patient\Presentation\Http\Requests\UpdatePatientStatusRequest;
use App\Modules\Patient\Presentation\Http\Transformers\PatientAuditLogResponseTransformer;
use App\Modules\Patient\Presentation\Http\Transformers\PatientResponseTransformer;
use App\Modules\Platform\Application\Exceptions\TenantScopeRequiredForIsolationException;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\ServiceRequest\Application\UseCases\ListActiveWalkInsForPatientIdsUseCase;
use App\Modules\ServiceRequest\Application\UseCases\SummarizeActiveWalkInsForPatientIdsUseCase;
use App\Modules\ServiceRequest\Presentation\Http\Transformers\ServiceRequestResponseTransformer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PatientController extends Controller
{
    private const AUDIT_CSV_SCHEMA_VERSION = 'audit-log-csv.v1';

    private const AUDIT_CSV_COLUMNS = ['createdAt', 'action', 'actorType', 'actorId', 'changes', 'metadata'];

    public function index(
        Request $request,
        ListPatientsUseCase $useCase,
        SummarizeActiveWalkInsForPatientIdsUseCase $walkInSummaries,
        ListActiveWalkInsForPatientIdsUseCase $activeWalkIns,
        FeatureFlagResolverInterface $featureFlags,
    ): JsonResponse {
        $result = $useCase->execute($request->all());

        $user = $request->user();
        $summariesByPatientId = [];
        $activeWalkInsByPatientId = [];

        $walkInSummaryViaPatientRead = $featureFlags->isEnabled(
            'clinical.walk_ins.routing_summary_on_patient_list',
            true,
        );

        $canSummarizeWalkIns =
            $user !== null
            && (
                $user->can('service.requests.read')
                || $user->can('service.requests.create')
                || (
                    $user->can('patients.read')
                    && $walkInSummaryViaPatientRead
                )
            );

        if ($canSummarizeWalkIns) {
            /** @var list<array<string, mixed>> $rows */
            $rows = $result['data'];
            $ids = [];

            foreach ($rows as $row) {
                if (isset($row['id']) && is_string($row['id']) && $row['id'] !== '') {
                    $ids[] = $row['id'];
                }
            }

            $summariesByPatientId = $walkInSummaries->execute($ids);
            $activeWalkInsByPatientId = $activeWalkIns->execute($ids);
        }

        $data = array_map(function (array $patient) use ($summariesByPatientId, $activeWalkInsByPatientId): array {
            $transformed = PatientResponseTransformer::transform($patient);

            $id = is_string($transformed['id'] ?? null) ? (string) $transformed['id'] : '';
            $summary = $id !== '' && isset($summariesByPatientId[$id])
                ? $summariesByPatientId[$id]
                : null;

            return array_merge($transformed, [
                /** One-line clerk visibility for active walk-ins */
                'routingHandoffSummary' => $summary,
                'activeRoutingTickets' => array_map(
                    [ServiceRequestResponseTransformer::class, 'transform'],
                    $id !== '' ? ($activeWalkInsByPatientId[$id] ?? []) : [],
                ),
            ]);
        }, $result['data']);

        return response()->json([
            'data' => $data,
            'meta' => $result['meta'],
        ]);
    }

    public function statusCounts(Request $request, ListPatientStatusCountsUseCase $useCase): JsonResponse
    {
        $counts = $useCase->execute($request->all());

        return response()->json([
            'data' => $counts,
        ]);
    }

    public function store(StorePatientRequest $request, CreatePatientUseCase $useCase): JsonResponse
    {
        try {
            $result = $useCase->execute(
                payload: $this->toPersistencePayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        }

        return response()->json([
            'data' => PatientResponseTransformer::transform($result['patient']),
            'warnings' => $result['warnings'],
        ], 201);
    }

    public function show(
        string $id,
        Request $request,
        GetPatientUseCase $useCase,
        SummarizeActiveWalkInsForPatientIdsUseCase $walkInSummaries,
        ListActiveWalkInsForPatientIdsUseCase $activeWalkIns,
        FeatureFlagResolverInterface $featureFlags,
    ): JsonResponse {
        $patient = $useCase->execute($id);
        abort_if($patient === null, 404, 'Patient not found.');

        $routingHandoffSummary = null;
        $activeRoutingTickets = [];

        if ($this->canViewRoutingHandoff($request, $featureFlags)) {
            $routingHandoffSummary = $walkInSummaries->execute([$id])[$id] ?? null;
            $activeRoutingTickets = array_map(
                [ServiceRequestResponseTransformer::class, 'transform'],
                $activeWalkIns->execute([$id])[$id] ?? [],
            );
        }

        return response()->json([
            'data' => array_merge(PatientResponseTransformer::transform($patient), [
                'routingHandoffSummary' => $routingHandoffSummary,
                'activeRoutingTickets' => $activeRoutingTickets,
            ]),
        ]);
    }

    public function update(string $id, UpdatePatientRequest $request, UpdatePatientUseCase $useCase): JsonResponse
    {
        try {
            $result = $useCase->execute(
                id: $id,
                payload: $this->toPersistencePayload($request->validated()),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        }
        abort_if($result === null, 404, 'Patient not found.');

        return response()->json([
            'data' => PatientResponseTransformer::transform($result['patient']),
            'warnings' => $result['warnings'],
        ]);
    }

    public function updateStatus(
        string $id,
        UpdatePatientStatusRequest $request,
        UpdatePatientStatusUseCase $useCase
    ): JsonResponse {
        try {
            $patient = $useCase->execute(
                id: $id,
                status: $request->string('status')->value(),
                reason: $request->input('reason'),
                actorId: $request->user()?->id,
            );
        } catch (TenantScopeRequiredForIsolationException $exception) {
            return $this->tenantScopeRequiredError($exception->getMessage());
        }

        abort_if($patient === null, 404, 'Patient not found.');

        return response()->json([
            'data' => PatientResponseTransformer::transform($patient),
        ]);
    }

    public function auditLogs(string $id, Request $request, ListPatientAuditLogsUseCase $useCase): JsonResponse
    {
        $result = $useCase->execute(patientId: $id, filters: $request->all());
        abort_if($result === null, 404, 'Patient not found.');

        return response()->json([
            'data' => array_map([PatientAuditLogResponseTransformer::class, 'transform'], $result['data']),
            'meta' => $result['meta'],
        ]);
    }

    public function exportAuditLogsCsv(
        string $id,
        Request $request,
        ListPatientAuditLogsUseCase $useCase
    ): StreamedResponse {
        $filters = $request->all();
        $filters['page'] = 1;
        $filters['perPage'] = 100;

        $firstPage = $useCase->execute(
            patientId: $id,
            filters: $filters,
        );
        abort_if($firstPage === null, 404, 'Patient not found.');

        $safeId = $this->safeExportIdentifier($id, 'patient');

        return $this->streamAuditLogCsvExport(
            baseName: sprintf('patient_audit_%s_%s', $safeId, now()->format('Ymd_His')),
            firstPage: $firstPage,
            fetchPage: function (int $page) use ($useCase, $id, $filters): ?array {
                $pageFilters = $filters;
                $pageFilters['page'] = $page;

                return $useCase->execute(
                    patientId: $id,
                    filters: $pageFilters,
                );
            },
        );
    }

    private function tenantScopeRequiredError(string $message): JsonResponse
    {
        return response()->json([
            'code' => 'TENANT_SCOPE_REQUIRED',
            'message' => $message,
        ], 403);
    }

    private function canViewRoutingHandoff(Request $request, FeatureFlagResolverInterface $featureFlags): bool
    {
        $user = $request->user();
        if ($user === null) {
            return false;
        }

        return $user->can('service.requests.read')
            || $user->can('service.requests.create')
            || (
                $user->can('patients.read')
                && $featureFlags->isEnabled('clinical.walk_ins.routing_summary_on_patient_list', true)
            );
    }

    private function toPersistencePayload(array $validated): array
    {
        $fieldMap = [
            'firstName' => 'first_name',
            'middleName' => 'middle_name',
            'lastName' => 'last_name',
            'gender' => 'gender',
            'dateOfBirth' => 'date_of_birth',
            'phone' => 'phone',
            'email' => 'email',
            'nationalId' => 'national_id',
            'countryCode' => 'country_code',
            'region' => 'region',
            'district' => 'district',
            'addressLine' => 'address_line',
            'nextOfKinName' => 'next_of_kin_name',
            'nextOfKinPhone' => 'next_of_kin_phone',
        ];

        $payload = [];

        foreach ($fieldMap as $requestKey => $storageKey) {
            if (! array_key_exists($requestKey, $validated)) {
                continue;
            }

            $payload[$storageKey] = $validated[$requestKey];
        }

        return $payload;
    }
}
