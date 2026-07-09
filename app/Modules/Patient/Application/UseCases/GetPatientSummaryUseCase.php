<?php

namespace App\Modules\Patient\Application\UseCases;

use App\Modules\Billing\Domain\Repositories\PatientInsuranceRepositoryInterface;
use App\Modules\Encounter\Application\UseCases\ListEncountersUseCase;
use App\Modules\Laboratory\Domain\ValueObjects\LaboratoryOrderStatus;
use App\Modules\Laboratory\Infrastructure\Models\LaboratoryOrderModel;
use App\Modules\Patient\Domain\Repositories\PatientAllergyRepositoryInterface;
use App\Modules\Patient\Domain\Repositories\PatientRepositoryInterface;
use App\Modules\PatientFlow\Application\UseCases\GetActiveVisitJourneyUseCase;
use App\Modules\Pharmacy\Domain\ValueObjects\PharmacyOrderStatus;
use App\Modules\Pharmacy\Infrastructure\Models\PharmacyOrderModel;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Radiology\Domain\ValueObjects\RadiologyOrderStatus;
use App\Modules\Radiology\Infrastructure\Models\RadiologyOrderModel;
use App\Modules\TheatreProcedure\Domain\ValueObjects\TheatreProcedureStatus;
use App\Modules\TheatreProcedure\Infrastructure\Models\TheatreProcedureModel;

/**
 * Backs GET /patients/{id}/summary (reports/patient-summary-module-plan.md
 * §3) — one aggregated round trip for the reusable Patient Summary module,
 * deliberately not a client-side fan-out of 4-5 requests: the module's
 * primary reuse targets are queue/list pages, where one request beats five
 * every time a summary is opened.
 *
 * Every piece here reuses an existing repository/use case rather than
 * inventing new query logic — GetActiveVisitJourneyUseCase's patientId
 * parameter, PatientInsuranceRepositoryInterface::findActiveInsurance()
 * (the same "active" derivation ClaimsInsurance/Billing already use, not
 * reimplemented client-side the way the legacy patients/Index.vue sheet
 * did), PatientAllergyRepositoryInterface::listActiveByPatientId() (already
 * sorted severity-desc), and ListEncountersUseCase (asked for perPage=1
 * instead of over-fetching and slicing, unlike
 * resources/js/composables/patientChart/usePatientEncounters.ts's current
 * shape).
 *
 * Active-order counts are the plan's deliberately scoped-down stand-in for
 * "recent activity preview" — a real cross-module activity timeline is a
 * distinct, larger feature (arguably Phase 3 deep-history territory), not
 * built here.
 */
class GetPatientSummaryUseCase
{
    private const ACTIVE_THEATRE_PROCEDURE_STATUSES = [
        TheatreProcedureStatus::PLANNED->value,
        TheatreProcedureStatus::IN_PREOP->value,
        TheatreProcedureStatus::IN_PROGRESS->value,
    ];

    public function __construct(
        private readonly PatientRepositoryInterface $patientRepository,
        private readonly PatientAllergyRepositoryInterface $allergyRepository,
        private readonly PatientInsuranceRepositoryInterface $insuranceRepository,
        private readonly ListEncountersUseCase $listEncountersUseCase,
        private readonly GetActiveVisitJourneyUseCase $activeVisitJourneyUseCase,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
    ) {}

    /**
     * @return array<string, mixed>|null
     */
    public function execute(string $id): ?array
    {
        $patient = $this->patientRepository->findById($id);
        if ($patient === null) {
            return null;
        }

        $tenantId = (string) ($this->platformScopeContext->tenantId() ?? '');

        $allergies = array_slice($this->allergyRepository->listActiveByPatientId($id), 0, 5);

        $insurance = $tenantId !== ''
            ? $this->insuranceRepository->findActiveInsurance($id, $tenantId)
            : null;

        $latestEncounterResult = $this->listEncountersUseCase->execute([
            'patientId' => $id,
            'perPage' => 1,
            'sortBy' => 'openedAt',
            'sortDir' => 'desc',
        ]);
        $latestEncounter = $latestEncounterResult['data'][0] ?? null;

        $activeVisitEntries = $this->activeVisitJourneyUseCase->execute($id);
        $workflowStatus = $activeVisitEntries[0] ?? null;

        return [
            'patient' => $patient,
            'allergies' => $allergies,
            'insurance' => $insurance,
            'latestEncounter' => $latestEncounter,
            'workflowStatus' => $workflowStatus,
            'activeOrders' => $this->activeOrderCounts($id),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function activeOrderCounts(string $patientId): array
    {
        return [
            'labActive' => LaboratoryOrderModel::query()
                ->where('patient_id', $patientId)
                ->whereIn('status', LaboratoryOrderStatus::openWorklistValues())
                ->count(),
            'pharmacyActive' => PharmacyOrderModel::query()
                ->where('patient_id', $patientId)
                ->whereIn('status', PharmacyOrderStatus::openWorklistValues())
                ->count(),
            'imagingActive' => RadiologyOrderModel::query()
                ->where('patient_id', $patientId)
                ->whereIn('status', RadiologyOrderStatus::openWorklistValues())
                ->count(),
            'procedureActive' => TheatreProcedureModel::query()
                ->where('patient_id', $patientId)
                ->whereIn('status', self::ACTIVE_THEATRE_PROCEDURE_STATUSES)
                ->count(),
        ];
    }
}
