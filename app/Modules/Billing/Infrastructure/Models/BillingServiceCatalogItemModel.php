<?php

namespace App\Modules\Billing\Infrastructure\Models;

use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BillingServiceCatalogItemModel extends Model
{
    use HasUuids;

    protected $table = 'billing_service_catalog_items';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'facility_id',
        'facility_tier',
        'clinical_catalog_item_id',
        'service_code',
        'tariff_version',
        'service_name',
        'service_type',
        'department_id',
        'department',
        'unit',
        'base_price',
        'currency_code',
        'tax_rate_percent',
        'is_taxable',
        'effective_from',
        'effective_to',
        'description',
        'metadata',
        'codes',
        'status',
        'status_reason',
        'supersedes_billing_service_catalog_item_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'base_price' => 'decimal:2',
            'tariff_version' => 'integer',
            'tax_rate_percent' => 'decimal:2',
            'is_taxable' => 'boolean',
            'effective_from' => 'datetime',
            'effective_to' => 'datetime',
            'metadata' => 'array',
            'codes' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function clinicalCatalogItem(): BelongsTo
    {
        return $this->belongsTo(ClinicalCatalogItemModel::class, 'clinical_catalog_item_id');
    }
}
