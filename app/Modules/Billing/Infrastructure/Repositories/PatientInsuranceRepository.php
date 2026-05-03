<?php

namespace App\Modules\Billing\Infrastructure\Repositories;

use App\Modules\Billing\Domain\Repositories\PatientInsuranceRepositoryInterface;
use App\Modules\Billing\Infrastructure\Models\PatientInsuranceModel;

class PatientInsuranceRepository implements PatientInsuranceRepositoryInterface
{
    public function findActiveInsurance(string $patientId, string $tenantId): ?array
    {
        $insurance = PatientInsuranceModel::where('patient_id', $patientId)
            ->when($tenantId !== '', fn ($query) => $query->where(function ($nestedQuery) use ($tenantId): void {
                $nestedQuery->whereNull('tenant_id')->orWhere('tenant_id', $tenantId);
            }))
            ->where('status', 'active')
            ->where('effective_date', '<=', now())
            ->where(function ($query) {
                $query->whereNull('expiry_date')
                    ->orWhere('expiry_date', '>=', now());
            })
            ->whereIn('verification_status', ['verified', 'unverified'])
            ->orderByRaw("CASE WHEN verification_status = 'verified' THEN 0 ELSE 1 END")
            ->latest('effective_date')
            ->first();

        return $insurance?->toArray();
    }

    public function findById(string $id): ?array
    {
        return PatientInsuranceModel::find($id)?->toArray();
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

    public function delete(string $id): bool
    {
        $record = PatientInsuranceModel::find($id);

        if (! $record) {
            return false;
        }

        return (bool) $record->delete();
    }

    public function findByPatientId(string $patientId): array
    {
        return PatientInsuranceModel::where('patient_id', $patientId)
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderBy('effective_date', 'desc')
            ->get()
            ->toArray();
    }
}
