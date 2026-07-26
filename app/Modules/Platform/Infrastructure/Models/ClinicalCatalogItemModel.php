<?php

namespace App\Modules\Platform\Infrastructure\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClinicalCatalogItemModel extends Model
{
    use HasUuids;

    protected $table = 'platform_clinical_catalog_items';

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
        'code',
        'name',
        'generic_name',
        'dosage_form',
        'strength',
        'route',
        'storage_conditions',
        'requires_cold_chain',
        'is_controlled_substance',
        'controlled_substance_schedule',
        'generic_group_code',
        'department_id',
        'category',
        'unit',
        'description',
        'metadata',
        'codes',
        'status',
        'status_reason',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'codes' => 'array',
            'requires_cold_chain' => 'boolean',
            'is_controlled_substance' => 'boolean',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function packagingTemplates(): HasMany
    {
        return $this->hasMany(ClinicalCatalogItemPackagingTemplateModel::class, 'clinical_catalog_item_id');
    }
}
