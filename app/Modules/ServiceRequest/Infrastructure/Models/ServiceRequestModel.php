<?php

namespace App\Modules\ServiceRequest\Infrastructure\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ServiceRequestModel extends Model
{
    use HasUuids;

    protected $table = 'service_requests';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'request_number',
        'tenant_id',
        'facility_id',
        'patient_id',
        'appointment_id',
        'department_id',
        'requested_by_user_id',
        'service_type',
        'priority',
        'status',
        'notes',
        'requested_at',
        'acknowledged_at',
        'acknowledged_by_user_id',
        'completed_at',
        'status_reason',
        'linked_order_type',
        'linked_order_id',
        'linked_order_number',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'requested_at' => 'datetime',
            'acknowledged_at' => 'datetime',
            'completed_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }
}
