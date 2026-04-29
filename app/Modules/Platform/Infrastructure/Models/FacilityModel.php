<?php

namespace App\Modules\Platform\Infrastructure\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class FacilityModel extends Model
{
    use HasUuids;

    protected $table = 'facilities';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'code',
        'name',
        'facility_type',
        'facility_tier',
        'timezone',
        'status',
        'status_reason',
        'operations_owner_user_id',
        'clinical_owner_user_id',
        'administrative_owner_user_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'operations_owner_user_id' => 'integer',
            'clinical_owner_user_id' => 'integer',
            'administrative_owner_user_id' => 'integer',
        ];
    }
}
