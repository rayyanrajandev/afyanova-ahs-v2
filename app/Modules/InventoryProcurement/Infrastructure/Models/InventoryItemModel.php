<?php

namespace App\Modules\InventoryProcurement\Infrastructure\Models;

use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Support\CatalogGovernance\InventoryClinicalLinkGuard;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;

class InventoryItemModel extends Model
{
    use HasUuids;

    protected $table = 'inventory_items';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'item_code',
        'msd_code',
        'nhif_code',
        'barcode',
        'codes',
        'tenant_id',
        'facility_id',
        'clinical_catalog_item_id',
        'default_warehouse_id',
        'default_supplier_id',
        'item_name',
        'generic_name',
        'dosage_form',
        'strength',
        'category',
        'subcategory',
        'ven_classification',
        'abc_classification',
        'unit',
        'dispensing_unit',
        'conversion_factor',
        'bin_location',
        'manufacturer',
        'storage_conditions',
        'requires_cold_chain',
        'is_controlled_substance',
        'controlled_substance_schedule',
        'current_stock',
        'reorder_level',
        'max_stock_level',
        'status',
        'status_reason',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'current_stock' => 'decimal:3',
            'reorder_level' => 'decimal:3',
            'max_stock_level' => 'decimal:3',
            'conversion_factor' => 'decimal:4',
            'requires_cold_chain' => 'boolean',
            'is_controlled_substance' => 'boolean',
            'codes' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function clinicalCatalogItem(): BelongsTo
    {
        return $this->belongsTo(ClinicalCatalogItemModel::class, 'clinical_catalog_item_id');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(InventoryStockMovementModel::class, 'item_id');
    }

    protected static function booted(): void
    {
        static::saving(function (InventoryItemModel $item): void {
            app(InventoryClinicalLinkGuard::class)->assertModelCanPersist($item);
        });
    }
}
