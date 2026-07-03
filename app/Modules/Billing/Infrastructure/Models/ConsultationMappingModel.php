<?php

namespace App\Modules\Billing\Infrastructure\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultationMappingModel extends Model
{
    protected $table = 'consultation_mappings';

    protected $fillable = [
        'billing_service_catalog_item_id',
        'clinician_tier',
        'department',
    ];

    public function billingServiceCatalogItem(): BelongsTo
    {
        return $this->belongsTo(BillingServiceCatalogItemModel::class, 'billing_service_catalog_item_id');
    }
}
