<?php

namespace App\Modules\Billing\Infrastructure\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PatientInsuranceModel extends Model
{
    use HasUuids;

    protected $table = 'patient_insurance_records';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'patient_id',
        'insurance_type',
        'insurance_provider',
        'policy_number',
        'member_id',
        'effective_date',
        'expiry_date',
        'coverage_level',
        'status',
        'verification_date',
        'verified_by_user_id',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'effective_date' => 'datetime',
            'expiry_date' => 'datetime',
            'verification_date' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /**
     * Check if insurance is currently active
     */
    public function isActive(): bool
    {
        $now = now();

        return $this->status === 'active'
            && $this->effective_date <= $now
            && ($this->expiry_date === null || $this->expiry_date >= $now);
    }
}
