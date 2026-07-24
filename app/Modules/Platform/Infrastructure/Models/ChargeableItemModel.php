<?php

namespace App\Modules\Platform\Infrastructure\Models;

use App\Modules\Billing\Infrastructure\Models\PriceBookEntryModel;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChargeableItemModel extends Model
{
    use HasUuids;

    protected $table = 'chargeable_items';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'facility_id',
        'facility_tier',
        'catalog_type',
        'charge_model',
        'code',
        'name',
        'department_id',
        'category',
        'default_unit',
        'status',
        'status_reason',
        'metadata',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function priceBookEntries(): HasMany
    {
        return $this->hasMany(PriceBookEntryModel::class, 'chargeable_item_id');
    }
}
