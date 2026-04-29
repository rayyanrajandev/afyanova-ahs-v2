<?php

namespace App\Modules\Billing\Infrastructure\Repositories;

use App\Modules\Billing\Domain\Repositories\PatientInsuranceRepositoryInterface;
use App\Modules\Billing\Infrastructure\Models\PatientInsuranceModel;

class PatientInsuranceRepository implements PatientInsuranceRepositoryInterface
{
    public function findActiveInsurance(string $patientId, string $tenantId): ?array
    {
        $insurance = PatientInsuranceModel::where('patient_id', $patientId)
            ->where('status', 'active')
            ->where('effective_date', '<=', now())
            ->where(function ($query) {
                $query->whereNull('expiry_date')
                    ->orWhere('expiry_date', '>=', now());
            })
            ->latest('effective_date')
            ->first();

        return $insurance?->toArray();
    }

    public function create(array $data): array
    {
        $record = PatientInsuranceModel::create($data);

        return $record->toArray();
    }

    public function update(string $id, array $data): array
    {
        $record = PatientInsuranceModel::findOrFail($id);
        $record->update($data);

        return $record->toArray();
    }

    public function findByPatientId(string $patientId): array
    {
        return PatientInsuranceModel::where('patient_id', $patientId)
            ->orderBy('effective_date', 'desc')
            ->get()
            ->toArray();
    }
}
