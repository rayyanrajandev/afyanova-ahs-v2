<?php

namespace App\Modules\Appointment\Infrastructure\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AppointmentModel extends Model
{
    use HasUuids;

    protected $table = 'appointments';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'appointment_number',
        'tenant_id',
        'facility_id',
        'patient_id',
        'source_admission_id',
        'clinician_user_id',
        'department',
        'scheduled_at',
        'duration_minutes',
        'reason',
        'notes',
        'financial_coverage_type',
        'billing_payer_contract_id',
        'coverage_reference',
        'coverage_notes',
        'status',
        'status_reason',
        'checked_in_at',
        'triage_vitals_summary',
        'triage_notes',
        'triaged_at',
        'triaged_by_user_id',
        'consultation_started_at',
        'consultation_owner_user_id',
        'consultation_owner_assigned_at',
        'consultation_takeover_count',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'checked_in_at' => 'datetime',
            'triaged_at' => 'datetime',
            'consultation_started_at' => 'datetime',
            'consultation_owner_assigned_at' => 'datetime',
            'consultation_takeover_count' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }
}
