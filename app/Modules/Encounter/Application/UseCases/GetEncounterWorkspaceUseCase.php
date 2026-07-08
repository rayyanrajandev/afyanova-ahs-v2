<?php

namespace App\Modules\Encounter\Application\UseCases;

use App\Modules\Admission\Infrastructure\Models\AdmissionModel;
use App\Modules\Encounter\Application\UseCases\GetEncounterCloseReadinessUseCase;
use App\Modules\Encounter\Application\Services\EncounterResolverService;
use App\Modules\Encounter\Application\Services\PrimaryMedicalRecordResolverService;
use App\Modules\Encounter\Infrastructure\Models\EncounterDiagnosisModel;
use App\Modules\Laboratory\Infrastructure\Models\LaboratoryOrderModel;
use App\Modules\MedicalRecord\Domain\Services\AppointmentLookupServiceInterface;
use App\Modules\Patient\Domain\Repositories\PatientRepositoryInterface;
use App\Modules\Pharmacy\Infrastructure\Models\PharmacyOrderModel;
use App\Modules\Radiology\Infrastructure\Models\RadiologyOrderModel;
use App\Modules\TheatreProcedure\Infrastructure\Models\TheatreProcedureModel;
use App\Support\ClinicalOrders\ClinicalOrderEntryState;
use Illuminate\Database\Eloquent\Builder;

class GetEncounterWorkspaceUseCase
{
    private const CARE_ARTIFACT_LIMIT = 6;

    public function __construct(
        private readonly EncounterResolverService $encounterResolverService,
        private readonly PrimaryMedicalRecordResolverService $primaryMedicalRecordResolverService,
        private readonly AppointmentLookupServiceInterface $appointmentLookupService,
        private readonly GetEncounterCloseReadinessUseCase $encounterCloseReadinessUseCase,
        private readonly PatientRepositoryInterface $patientRepository,
    ) {}

    /**
     * @return array<string, mixed>|null
     */
    public function execute(string $encounterId): ?array
    {
        $encounter = $this->encounterResolverService->findById($encounterId);
        if ($encounter === null) {
            return null;
        }

        $encounterArray = $encounter->toArray();
        $patientId = trim((string) ($encounterArray['patient_id'] ?? ''));

        $appointment = null;
        $appointmentId = trim((string) ($encounterArray['appointment_id'] ?? ''));
        if ($appointmentId !== '') {
            $appointment = $this->appointmentLookupService->findById($appointmentId);
        }

        $admission = null;
        $admissionId = trim((string) ($encounterArray['admission_id'] ?? ''));
        if ($admissionId !== '') {
            $admission = AdmissionModel::query()->find($admissionId)?->toArray();
        }

        return [
            'encounter' => $encounterArray,
            'patient' => $patientId !== '' ? $this->patientRepository->findById($patientId) : null,
            'primaryMedicalRecord' => $this->primaryMedicalRecordResolverService->resolve($encounterId, $patientId),
            'appointment' => $appointment,
            'admission' => $admission,
            'diagnoses' => $this->loadDiagnoses($encounterId),
            'laboratoryOrders' => $this->loadLaboratoryOrders($encounterId),
            'pharmacyOrders' => $this->loadPharmacyOrders($encounterId),
            'radiologyOrders' => $this->loadRadiologyOrders($encounterId),
            'theatreProcedures' => $this->loadTheatreProcedures($encounterId),
            'closeReadiness' => $this->encounterCloseReadinessUseCase->execute($encounterId),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadDiagnoses(string $encounterId): array
    {
        return EncounterDiagnosisModel::query()
            ->where('encounter_id', $encounterId)
            ->with('recordedBy:id,name')
            ->orderByRaw("CASE WHEN diagnosis_type = 'primary' THEN 0 ELSE 1 END")
            ->orderByDesc('recorded_at')
            ->get()
            ->map(static fn (EncounterDiagnosisModel $diagnosis): array => $diagnosis->toArray())
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadLaboratoryOrders(string $encounterId): array
    {
        return LaboratoryOrderModel::query()
            ->where('encounter_id', $encounterId)
            ->where('entry_state', ClinicalOrderEntryState::ACTIVE->value)
            ->orderByDesc('ordered_at')
            ->orderByDesc('created_at')
            ->limit(self::CARE_ARTIFACT_LIMIT)
            ->get()
            ->map(static fn (LaboratoryOrderModel $order): array => $order->toArray())
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadPharmacyOrders(string $encounterId): array
    {
        return PharmacyOrderModel::query()
            ->where('encounter_id', $encounterId)
            ->where('entry_state', ClinicalOrderEntryState::ACTIVE->value)
            ->orderByDesc('ordered_at')
            ->orderByDesc('created_at')
            ->limit(self::CARE_ARTIFACT_LIMIT)
            ->get()
            ->map(static fn (PharmacyOrderModel $order): array => $order->toArray())
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadRadiologyOrders(string $encounterId): array
    {
        return RadiologyOrderModel::query()
            ->where('encounter_id', $encounterId)
            ->where('entry_state', ClinicalOrderEntryState::ACTIVE->value)
            ->orderByDesc('ordered_at')
            ->orderByDesc('created_at')
            ->limit(self::CARE_ARTIFACT_LIMIT)
            ->get()
            ->map(static fn (RadiologyOrderModel $order): array => $order->toArray())
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadTheatreProcedures(string $encounterId): array
    {
        return TheatreProcedureModel::query()
            ->where('encounter_id', $encounterId)
            ->whereNull('entered_in_error_at')
            ->orderByDesc('scheduled_at')
            ->orderByDesc('created_at')
            ->limit(self::CARE_ARTIFACT_LIMIT)
            ->get()
            ->map(static fn (TheatreProcedureModel $procedure): array => $procedure->toArray())
            ->all();
    }
}
