<?php

namespace App\Modules\Encounter\Application\UseCases;

use App\Modules\Encounter\Application\UseCases\GetEncounterCloseReadinessUseCase;
use App\Modules\Encounter\Application\Services\EncounterResolverService;
use App\Modules\Laboratory\Infrastructure\Models\LaboratoryOrderModel;
use App\Modules\MedicalRecord\Domain\Repositories\MedicalRecordRepositoryInterface;
use App\Modules\MedicalRecord\Domain\Services\AppointmentLookupServiceInterface;
use App\Modules\MedicalRecord\Domain\ValueObjects\MedicalRecordNoteType;
use App\Modules\MedicalRecord\Domain\ValueObjects\MedicalRecordStatus;
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
        private readonly MedicalRecordRepositoryInterface $medicalRecordRepository,
        private readonly AppointmentLookupServiceInterface $appointmentLookupService,
        private readonly GetEncounterCloseReadinessUseCase $encounterCloseReadinessUseCase,
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

        return [
            'encounter' => $encounterArray,
            'primaryMedicalRecord' => $this->resolvePrimaryMedicalRecord($encounterId, $patientId),
            'appointment' => $appointment,
            'laboratoryOrders' => $this->loadLaboratoryOrders($encounterId),
            'pharmacyOrders' => $this->loadPharmacyOrders($encounterId),
            'radiologyOrders' => $this->loadRadiologyOrders($encounterId),
            'theatreProcedures' => $this->loadTheatreProcedures($encounterId),
            'closeReadiness' => $this->encounterCloseReadinessUseCase->execute($encounterId),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolvePrimaryMedicalRecord(string $encounterId, string $patientId): ?array
    {
        if ($patientId === '') {
            return null;
        }

        $draftSearch = $this->medicalRecordRepository->search(
            query: null,
            patientId: $patientId,
            encounterId: $encounterId,
            appointmentId: null,
            appointmentReferralId: null,
            admissionId: null,
            theatreProcedureId: null,
            authorUserId: null,
            status: MedicalRecordStatus::DRAFT->value,
            recordType: MedicalRecordNoteType::CONSULTATION_NOTE->value,
            fromDateTime: null,
            toDateTime: null,
            page: 1,
            perPage: 1,
            sortBy: 'updated_at',
            sortDirection: 'desc',
        );

        if ($draftSearch['data'] !== []) {
            return $draftSearch['data'][0];
        }

        foreach ([MedicalRecordStatus::FINALIZED->value, MedicalRecordStatus::AMENDED->value] as $status) {
            $search = $this->medicalRecordRepository->search(
                query: null,
                patientId: $patientId,
                encounterId: $encounterId,
                appointmentId: null,
                appointmentReferralId: null,
                admissionId: null,
                theatreProcedureId: null,
                authorUserId: null,
                status: $status,
                recordType: MedicalRecordNoteType::CONSULTATION_NOTE->value,
                fromDateTime: null,
                toDateTime: null,
                page: 1,
                perPage: 1,
                sortBy: 'updated_at',
                sortDirection: 'desc',
            );

            if ($search['data'] !== []) {
                return $search['data'][0];
            }
        }

        return null;
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
