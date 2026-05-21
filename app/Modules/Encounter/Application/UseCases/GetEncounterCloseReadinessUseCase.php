<?php

namespace App\Modules\Encounter\Application\UseCases;

use App\Modules\Billing\Application\UseCases\ListBillingChargeCaptureCandidatesUseCase;
use App\Modules\Encounter\Application\Services\EncounterResolverService;
use App\Modules\Encounter\Infrastructure\Models\EncounterModel;
use App\Modules\Laboratory\Infrastructure\Models\LaboratoryOrderModel;
use App\Modules\MedicalRecord\Domain\Repositories\MedicalRecordRepositoryInterface;
use App\Modules\MedicalRecord\Domain\ValueObjects\MedicalRecordNoteType;
use App\Modules\MedicalRecord\Domain\ValueObjects\MedicalRecordStatus;
use App\Modules\Pharmacy\Infrastructure\Models\PharmacyOrderModel;
use App\Modules\Radiology\Infrastructure\Models\RadiologyOrderModel;
use App\Modules\TheatreProcedure\Infrastructure\Models\TheatreProcedureModel;
use App\Support\ClinicalOrders\ClinicalOrderEntryState;

class GetEncounterCloseReadinessUseCase
{
    private const LAB_TERMINAL_STATUSES = ['completed', 'cancelled'];

    private const PHARMACY_TERMINAL_STATUSES = [
        'dispensed',
        'cancelled',
        'reconciliation_completed',
        'reconciliation_exception',
    ];

    private const RADIOLOGY_TERMINAL_STATUSES = ['completed', 'cancelled'];

    private const THEATRE_TERMINAL_STATUSES = ['completed', 'cancelled'];

    public function __construct(
        private readonly EncounterResolverService $encounterResolverService,
        private readonly MedicalRecordRepositoryInterface $medicalRecordRepository,
        private readonly ListBillingChargeCaptureCandidatesUseCase $chargeCaptureCandidatesUseCase,
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
        $primaryMedicalRecord = $this->resolvePrimaryMedicalRecord($encounterId, $patientId);
        $noteStatus = strtolower(trim((string) ($primaryMedicalRecord['status'] ?? '')));
        $noteSigned = in_array($noteStatus, [
            MedicalRecordStatus::FINALIZED->value,
            MedicalRecordStatus::AMENDED->value,
        ], true);

        $diagnosisCode = trim((string) ($primaryMedicalRecord['diagnosis_code'] ?? ''));
        $assessment = trim((string) ($primaryMedicalRecord['assessment'] ?? ''));
        $diagnosisDocumented = $diagnosisCode !== '' || $assessment !== '';

        $pendingOrderCount = $this->countPendingOrders($encounterId);
        $billingSummary = $this->resolveBillingSummary($encounter, $patientId);

        $items = [
            $this->buildItem(
                id: 'note_signed',
                label: 'Consultation note signed',
                severity: 'block',
                passed: $noteSigned,
                message: $noteSigned
                    ? 'The consultation note is finalized or amended.'
                    : 'Finalize or amend the consultation note before closing this encounter.',
            ),
            $this->buildItem(
                id: 'diagnosis_documented',
                label: 'Diagnosis documented',
                severity: 'warn',
                passed: $diagnosisDocumented,
                message: $diagnosisDocumented
                    ? 'Assessment narrative or ICD-10 diagnosis code is present.'
                    : 'Add an assessment or ICD-10 diagnosis code before close-out.',
            ),
            $this->buildItem(
                id: 'pending_orders',
                label: 'Pending clinical orders',
                severity: 'warn',
                passed: $pendingOrderCount === 0,
                count: $pendingOrderCount,
                message: $pendingOrderCount === 0
                    ? 'No active pending orders remain on this encounter.'
                    : sprintf(
                        '%d active order%s still need completion or cancellation.',
                        $pendingOrderCount,
                        $pendingOrderCount === 1 ? '' : 's',
                    ),
            ),
            $this->buildItem(
                id: 'unbilled_services',
                label: 'Billable services captured',
                severity: 'warn',
                passed: (int) ($billingSummary['pendingCandidates'] ?? 0) === 0,
                count: (int) ($billingSummary['pendingCandidates'] ?? 0),
                message: (int) ($billingSummary['pendingCandidates'] ?? 0) === 0
                    ? 'No uninvoiced completed services were detected for this encounter.'
                    : sprintf(
                        '%d completed service%s still need billing capture.',
                        (int) $billingSummary['pendingCandidates'],
                        (int) $billingSummary['pendingCandidates'] === 1 ? '' : 's',
                    ),
            ),
        ];

        $blockingCount = count(array_filter(
            $items,
            static fn (array $item): bool => ($item['severity'] ?? '') === 'block' && ($item['status'] ?? '') === 'fail',
        ));
        $warningCount = count(array_filter(
            $items,
            static fn (array $item): bool => ($item['severity'] ?? '') === 'warn' && ($item['status'] ?? '') === 'fail',
        ));

        return [
            'canClose' => $blockingCount === 0,
            'requiresAcknowledgement' => $blockingCount === 0 && $warningCount > 0,
            'blockingCount' => $blockingCount,
            'warningCount' => $warningCount,
            'items' => $items,
            'billingSummary' => $billingSummary,
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

        foreach ([
            MedicalRecordStatus::DRAFT->value,
            MedicalRecordStatus::FINALIZED->value,
            MedicalRecordStatus::AMENDED->value,
        ] as $status) {
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

    private function countPendingOrders(string $encounterId): int
    {
        return $this->countPendingLaboratoryOrders($encounterId)
            + $this->countPendingPharmacyOrders($encounterId)
            + $this->countPendingRadiologyOrders($encounterId)
            + $this->countPendingTheatreProcedures($encounterId);
    }

    private function countPendingLaboratoryOrders(string $encounterId): int
    {
        return LaboratoryOrderModel::query()
            ->where('encounter_id', $encounterId)
            ->where('entry_state', ClinicalOrderEntryState::ACTIVE->value)
            ->whereNull('entered_in_error_at')
            ->whereNotIn('status', self::LAB_TERMINAL_STATUSES)
            ->count();
    }

    private function countPendingPharmacyOrders(string $encounterId): int
    {
        return PharmacyOrderModel::query()
            ->where('encounter_id', $encounterId)
            ->where('entry_state', ClinicalOrderEntryState::ACTIVE->value)
            ->whereNull('entered_in_error_at')
            ->whereNotIn('status', self::PHARMACY_TERMINAL_STATUSES)
            ->count();
    }

    private function countPendingRadiologyOrders(string $encounterId): int
    {
        return RadiologyOrderModel::query()
            ->where('encounter_id', $encounterId)
            ->where('entry_state', ClinicalOrderEntryState::ACTIVE->value)
            ->whereNull('entered_in_error_at')
            ->whereNotIn('status', self::RADIOLOGY_TERMINAL_STATUSES)
            ->count();
    }

    private function countPendingTheatreProcedures(string $encounterId): int
    {
        return TheatreProcedureModel::query()
            ->where('encounter_id', $encounterId)
            ->whereNull('entered_in_error_at')
            ->whereNotIn('status', self::THEATRE_TERMINAL_STATUSES)
            ->count();
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveBillingSummary(EncounterModel $encounter, string $patientId): array
    {
        if ($patientId === '') {
            return [
                'pendingCandidates' => 0,
                'alreadyInvoiced' => 0,
                'totalCandidates' => 0,
                'currencyCode' => null,
            ];
        }

        $result = $this->chargeCaptureCandidatesUseCase->execute([
            'patientId' => $patientId,
            'encounterId' => (string) $encounter->id,
            'appointmentId' => $encounter->appointment_id,
            'admissionId' => $encounter->admission_id,
            'includeInvoiced' => false,
            'limit' => 200,
        ]);

        $meta = is_array($result['meta'] ?? null) ? $result['meta'] : [];

        return [
            'pendingCandidates' => (int) ($meta['pending'] ?? 0),
            'alreadyInvoiced' => (int) ($meta['alreadyInvoiced'] ?? 0),
            'totalCandidates' => (int) ($meta['total'] ?? 0),
            'currencyCode' => $meta['currencyCode'] ?? null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildItem(
        string $id,
        string $label,
        string $severity,
        bool $passed,
        string $message,
        ?int $count = null,
    ): array {
        return [
            'id' => $id,
            'label' => $label,
            'severity' => $severity,
            'status' => $passed ? 'pass' : 'fail',
            'message' => $message,
            'count' => $count,
        ];
    }
}
