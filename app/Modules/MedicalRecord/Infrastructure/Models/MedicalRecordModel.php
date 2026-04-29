<?php

namespace App\Modules\MedicalRecord\Infrastructure\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicalRecordModel extends Model
{
    use HasUuids;

    protected $table = 'medical_records';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'record_number',
        'tenant_id',
        'facility_id',
        'patient_id',
        'admission_id',
        'appointment_id',
        'appointment_referral_id',
        'theatre_procedure_id',
        'author_user_id',
        'encounter_at',
        'record_type',
        'subjective',
        'objective',
        'assessment',
        'plan',
        'diagnosis_code',
        'status',
        'status_reason',
        'signed_by_user_id',
        'signed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'encounter_at' => 'datetime',
            'signed_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function signedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'signed_by_user_id');
    }

    public function authorUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }
}
