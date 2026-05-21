<?php

namespace App\Modules\Encounter\Infrastructure\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EncounterModel extends Model
{
    use HasUuids;

    protected $table = 'encounters';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'encounter_number',
        'tenant_id',
        'facility_id',
        'patient_id',
        'appointment_id',
        'admission_id',
        'primary_clinician_user_id',
        'status',
        'opened_at',
        'closed_at',
        'status_reason',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function primaryClinician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'primary_clinician_user_id');
    }
}
