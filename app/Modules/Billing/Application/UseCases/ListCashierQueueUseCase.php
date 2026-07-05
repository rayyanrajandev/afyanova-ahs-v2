<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Appointment\Infrastructure\Models\AppointmentModel;
use App\Modules\Billing\Infrastructure\Models\BillingInvoiceModel;
use App\Modules\Laboratory\Infrastructure\Models\LaboratoryOrderModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\Pharmacy\Infrastructure\Models\PharmacyOrderModel;
use App\Modules\Platform\Domain\Services\DefaultCurrencyResolverInterface;
use App\Modules\Platform\Infrastructure\Support\PlatformScopeQueryApplier;
use App\Modules\Radiology\Infrastructure\Models\RadiologyOrderModel;
use App\Modules\TheatreProcedure\Infrastructure\Models\TheatreProcedureModel;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ListCashierQueueUseCase
{
    public function __construct(
        private readonly PlatformScopeQueryApplier $platformScopeQueryApplier,
        private readonly DefaultCurrencyResolverInterface $defaultCurrencyResolver,
    ) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function execute(array $filters): array
    {
        $status = $this->normalizeNullableString($filters['status'] ?? null);
        $page = max((int) ($filters['page'] ?? 1), 1);
        $perPage = max(min((int) ($filters['perPage'] ?? 20), 100), 1);
        $query = $this->normalizeNullableString($filters['q'] ?? null);

        // Determine which patient IDs to include based on status filter
        if ($status === 'in_consultation') {
            $allPatientIds = $this->findPatientsInConsultation();
        } elseif ($status === 'unpaid') {
            $allPatientIds = $this->findPatientsWithUnpaidInvoices('unpaid');
        } elseif ($status === 'paid') {
            $allPatientIds = $this->findPatientsWithAllInvoicesPaid();
        } else {
            // 'all' — merge all sources
            $unpaidPatientIds = $this->findPatientsWithUnpaidInvoices(null);
            $unbilledPatientIds = $this->findPatientsWithUnbilledServices();
            $inConsultationPatientIds = $this->findPatientsInConsultation();
            $allPatientIds = array_unique(array_merge($unpaidPatientIds, $unbilledPatientIds, $inConsultationPatientIds));
        }

        if (empty($allPatientIds)) {
            return [
                'data' => [],
                'meta' => [
                    'currentPage' => $page,
                    'perPage' => $perPage,
                    'total' => 0,
                    'lastPage' => 0,
                ],
            ];
        }

        // Fetch patients with counts
        $patients = $this->buildQueueEntries($allPatientIds, $status, $query);

        // Paginate
        $total = $patients->count();
        $lastPage = (int) ceil($total / $perPage);
        $paginated = $patients->slice(($page - 1) * $perPage, $perPage)->values();

        return [
            'data' => $paginated->toArray(),
            'meta' => [
                'currentPage' => $page,
                'perPage' => $perPage,
                'total' => $total,
                'lastPage' => $lastPage,
            ],
        ];
    }

    /**
     * @return string[]
     */
    private function findPatientsWithUnpaidInvoices(?string $status): array
    {
        $query = BillingInvoiceModel::query()
            ->select('patient_id')
            ->whereNotIn('status', ['cancelled', 'voided']);

        if ($status === 'unpaid') {
            $query->where('balance_amount', '>', 0);
        } elseif ($status === 'paid') {
            $query->where('balance_amount', '<=', 0);
        }

        return $query->pluck('patient_id')
            ->filter(fn ($id) => ! empty($id))
            ->unique()
            ->values()
            ->toArray();
    }

    /**
     * @return string[]
     */
    private function findPatientsWithUnbilledServices(): array
    {
        $labPatients = LaboratoryOrderModel::query()
            ->select('patient_id')
            ->where(function ($q) {
                $q->where('status', 'completed')
                    ->orWhereNotNull('resulted_at');
            })
            ->whereNull('entered_in_error_at')
            ->pluck('patient_id');

        $pharmacyPatients = PharmacyOrderModel::query()
            ->select('patient_id')
            ->where(function ($q) {
                $q->where('status', 'dispensed')
                    ->orWhere('status', 'partially_dispensed')
                    ->orWhere('quantity_dispensed', '>', 0);
            })
            ->whereNull('entered_in_error_at')
            ->pluck('patient_id');

        $radiologyPatients = RadiologyOrderModel::query()
            ->select('patient_id')
            ->where(function ($q) {
                $q->where('status', 'completed')
                    ->orWhereNotNull('completed_at');
            })
            ->whereNull('entered_in_error_at')
            ->pluck('patient_id');

        $theatrePatients = TheatreProcedureModel::query()
            ->select('patient_id')
            ->where(function ($q) {
                $q->where('status', 'completed')
                    ->orWhereNotNull('completed_at');
            })
            ->pluck('patient_id');

        return $labPatients->concat($pharmacyPatients)
            ->concat($radiologyPatients)
            ->concat($theatrePatients)
            ->filter(fn ($id) => ! empty($id))
            ->unique()
            ->values()
            ->toArray();
    }

    /**
     * @return string[]
     */
    private function findPatientsInConsultation(): array
    {
        return AppointmentModel::query()
            ->select('patient_id')
            ->where('status', 'in_consultation')
            ->pluck('patient_id')
            ->filter(fn ($id) => ! empty($id))
            ->unique()
            ->values()
            ->toArray();
    }

    /**
     * @return string[]
     */
    private function findPatientsWithAllInvoicesPaid(): array
    {
        return BillingInvoiceModel::query()
            ->select('patient_id')
            ->whereNotIn('status', ['cancelled', 'voided'])
            ->groupBy('patient_id')
            ->havingRaw('MAX(balance_amount) <= 0')
            ->pluck('patient_id')
            ->filter(fn ($id) => ! empty($id))
            ->values()
            ->toArray();
    }

    /**
     * @param  string[]  $patientIds
     * @return Collection<int, array<string, mixed>>
     */
    private function buildQueueEntries(array $patientIds, ?string $status, ?string $query): Collection
    {
        $patients = PatientModel::query()
            ->whereIn('id', $patientIds)
            ->when($query, fn ($q) => $q->where(function ($w) use ($query) {
                $w->where('first_name', 'ilike', "%{$query}%")
                    ->orWhere('last_name', 'ilike', "%{$query}%")
                    ->orWhere('patient_number', 'ilike', "%{$query}%")
                    ->orWhere('phone', 'ilike', "%{$query}%");
            }))
            ->get();

        $patientIds = $patients->pluck('id')->toArray();

        // Batch fetch unpaid invoices per patient
        $invoicesByPatient = BillingInvoiceModel::query()
            ->whereIn('patient_id', $patientIds)
            ->whereNotIn('status', ['cancelled', 'voided'])
            ->get()
            ->groupBy('patient_id');

        // Batch fetch unbilled service counts per patient
        $unbilledCounts = $this->countUnbilledServices($patientIds);

        // Batch fetch patients currently in consultation
        $inConsultationPatientIds = AppointmentModel::query()
            ->select('patient_id')
            ->whereIn('patient_id', $patientIds)
            ->where('status', 'in_consultation')
            ->pluck('patient_id')
            ->unique()
            ->toArray();
        $inConsultationSet = array_flip($inConsultationPatientIds);

        return $patients->map(function (PatientModel $patient) use ($invoicesByPatient, $unbilledCounts, $status, $inConsultationSet) {
            $invoices = $invoicesByPatient->get($patient->id, collect());
            $unpaidInvoices = $invoices->filter(fn ($inv) => $status !== 'paid' && (float) ($inv->balance_amount ?? 0) > 0);
            $paidInvoices = $invoices->filter(fn ($inv) => $status !== 'unpaid' && (float) ($inv->balance_amount ?? 0) <= 0);

            $totalUnpaid = $unpaidInvoices->sum('balance_amount');
            $totalPaid = $paidInvoices->sum('paid_amount');
            $unbilledCount = $unbilledCounts[$patient->id] ?? 0;
            $isInConsultation = isset($inConsultationSet[$patient->id]);

            return [
                'patientId' => $patient->id,
                'patientNumber' => $patient->patient_number,
                'patientName' => trim($patient->first_name . ' ' . $patient->last_name),
                'phone' => $patient->phone,
                'unpaidInvoiceCount' => $unpaidInvoices->count(),
                'totalUnpaidAmount' => (float) $totalUnpaid,
                'paidInvoiceCount' => $paidInvoices->count(),
                'totalPaidAmount' => (float) $totalPaid,
                'unbilledServiceCount' => $unbilledCount,
                'inConsultation' => $isInConsultation,
                'summaryLabel' => $this->buildSummaryLabel($unpaidInvoices->count(), $totalUnpaid, $unbilledCount, $isInConsultation),
            ];
        });
    }

    /**
     * @param  string[]  $patientIds
     * @return array<string, int>
     */
    private function countUnbilledServices(array $patientIds): array
    {
        if (empty($patientIds)) {
            return [];
        }

        $labCount = LaboratoryOrderModel::query()
            ->select('patient_id', \DB::raw('COUNT(*) as cnt'))
            ->whereIn('patient_id', $patientIds)
            ->where(function ($q) {
                $q->where('status', 'completed')
                    ->orWhereNotNull('resulted_at');
            })
            ->whereNull('entered_in_error_at')
            ->groupBy('patient_id')
            ->pluck('cnt', 'patient_id')
            ->toArray();

        $pharmacyCount = PharmacyOrderModel::query()
            ->select('patient_id', \DB::raw('COUNT(*) as cnt'))
            ->whereIn('patient_id', $patientIds)
            ->where(function ($q) {
                $q->where('status', 'dispensed')
                    ->orWhere('status', 'partially_dispensed')
                    ->orWhere('quantity_dispensed', '>', 0);
            })
            ->whereNull('entered_in_error_at')
            ->groupBy('patient_id')
            ->pluck('cnt', 'patient_id')
            ->toArray();

        $radiologyCount = RadiologyOrderModel::query()
            ->select('patient_id', \DB::raw('COUNT(*) as cnt'))
            ->whereIn('patient_id', $patientIds)
            ->where(function ($q) {
                $q->where('status', 'completed')
                    ->orWhereNotNull('completed_at');
            })
            ->whereNull('entered_in_error_at')
            ->groupBy('patient_id')
            ->pluck('cnt', 'patient_id')
            ->toArray();

        $theatreCount = TheatreProcedureModel::query()
            ->select('patient_id', \DB::raw('COUNT(*) as cnt'))
            ->whereIn('patient_id', $patientIds)
            ->where(function ($q) {
                $q->where('status', 'completed')
                    ->orWhereNotNull('completed_at');
            })
            ->groupBy('patient_id')
            ->pluck('cnt', 'patient_id')
            ->toArray();

        $counts = [];
        foreach ($patientIds as $pid) {
            $counts[$pid] = ($labCount[$pid] ?? 0)
                + ($pharmacyCount[$pid] ?? 0)
                + ($radiologyCount[$pid] ?? 0)
                + ($theatreCount[$pid] ?? 0);
        }

        return $counts;
    }

    private function buildSummaryLabel(int $unpaidCount, float $totalUnpaid, int $unbilledCount, bool $inConsultation): string
    {
        $parts = [];

        if ($inConsultation) {
            $parts[] = 'In consultation';
        }

        if ($unpaidCount > 0) {
            $parts[] = "{$unpaidCount} unpaid invoice" . ($unpaidCount === 1 ? '' : 's') . ' (' . number_format($totalUnpaid, 0) . ')';
        }

        if ($unbilledCount > 0) {
            $parts[] = "{$unbilledCount} unbilled service" . ($unbilledCount === 1 ? '' : 's');
        }

        return implode(' · ', $parts) ?: 'No pending charges';
    }

    private function normalizeNullableString($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }
}
