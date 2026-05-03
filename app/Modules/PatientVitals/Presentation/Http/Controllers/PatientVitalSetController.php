<?php

namespace App\Modules\PatientVitals\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\PatientVitals\Infrastructure\Models\PatientVitalSetModel;
use App\Modules\PatientVitals\Presentation\Http\Requests\StorePatientVitalSetRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class PatientVitalSetController extends Controller
{
    private const OVERDUE_THRESHOLD_HOURS = 4;

    /**
     * Record a set of vital signs for a patient.
     * Requires: inpatient.ward.create
     */
    public function store(StorePatientVitalSetRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $vitalSet = PatientVitalSetModel::create([
            'patient_id'            => $validated['patientId'],
            'admission_id'          => $validated['admissionId'] ?? null,
            'appointment_id'        => $validated['appointmentId'] ?? null,
            'recorded_by_user_id'   => $request->user()?->id,
            'recorded_at'           => $validated['recordedAt'] ?? now()->toDateTimeString(),
            'temperature_c'         => $validated['temperatureC'] ?? null,
            'heart_rate_bpm'        => $validated['heartRateBpm'] ?? null,
            'systolic_bp_mmhg'      => $validated['systolicBpMmhg'] ?? null,
            'diastolic_bp_mmhg'     => $validated['diastolicBpMmhg'] ?? null,
            'oxygen_saturation_pct' => $validated['oxygenSaturationPct'] ?? null,
            'respiratory_rate_bpm'  => $validated['respiratoryRateBpm'] ?? null,
            'weight_kg'             => $validated['weightKg'] ?? null,
            'entry_state'           => 'active',
        ]);

        return response()->json(['data' => [
            'id'         => $vitalSet->id,
            'patientId'  => $vitalSet->patient_id,
            'recordedAt' => $vitalSet->recorded_at?->toIso8601String(),
        ]], 201);
    }

    /**
     * Return a count of admitted patients whose last recorded vitals are older than the threshold.
     * Requires: inpatient.ward.read
     */
    public function overdueSummary(): JsonResponse
    {
        $thresholdHours = self::OVERDUE_THRESHOLD_HOURS;
        $cutoff = now()->subHours($thresholdHours);

        $admittedPatientIds = DB::table('admissions')
            ->where('status', 'admitted')
            ->distinct()
            ->pluck('patient_id')
            ->values();

        $totalAdmitted = $admittedPatientIds->count();

        if ($totalAdmitted === 0) {
            return response()->json(['data' => [
                'overdue_count'   => 0,
                'threshold_hours' => $thresholdHours,
                'total_admitted'  => 0,
            ]]);
        }

        $patientsWithRecentVitals = DB::table('patient_vital_sets')
            ->whereIn('patient_id', $admittedPatientIds)
            ->where('recorded_at', '>=', $cutoff)
            ->where('entry_state', 'active')
            ->distinct()
            ->pluck('patient_id')
            ->values()
            ->flip();

        $overdueCount = $admittedPatientIds->filter(
            fn (string $id) => ! $patientsWithRecentVitals->has($id),
        )->count();

        return response()->json(['data' => [
            'overdue_count'   => $overdueCount,
            'threshold_hours' => $thresholdHours,
            'total_admitted'  => $totalAdmitted,
        ]]);
    }
}
