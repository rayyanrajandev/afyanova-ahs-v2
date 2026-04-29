<?php

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind a different classes or traits.
|
*/

pest()->extend(Tests\TestCase::class)
    ->use(Illuminate\Foundation\Testing\RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

function something()
{
    // ..
}

/**
 * @return array<string, mixed>
 */
function clinicalRecipeStockInventoryItem(array $overrides = []): array
{
    $item = array_merge([
        'id' => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => null,
        'facility_id' => null,
        'item_code' => 'STK-'.\Illuminate\Support\Str::upper(\Illuminate\Support\Str::random(8)),
        'item_name' => 'Recipe consumable stock',
        'category' => 'medical_consumable',
        'subcategory' => 'procedure_consumable',
        'unit' => 'unit',
        'current_stock' => 10,
        'reorder_level' => 2,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ], $overrides);

    \Illuminate\Support\Facades\DB::table('inventory_items')->insert($item);

    return $item;
}

/**
 * @return array<string, mixed>
 */
function clinicalRecipeStockRecipeLine(
    string $catalogItemId,
    string $inventoryItemId,
    array $overrides = [],
): array {
    $line = array_merge([
        'id' => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => null,
        'facility_id' => null,
        'clinical_catalog_item_id' => $catalogItemId,
        'inventory_item_id' => $inventoryItemId,
        'quantity_per_order' => 1,
        'unit' => 'unit',
        'waste_factor_percent' => 0,
        'consumption_stage' => 'per_order',
        'is_active' => true,
        'notes' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ], $overrides);

    \Illuminate\Support\Facades\DB::table('clinical_catalog_consumption_recipe_items')->insert($line);

    return $line;
}

/**
 * @return array<string, mixed>
 */
function inventoryBatchRecord(string $itemId, array $overrides = []): array
{
    $batch = array_merge([
        'id' => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => null,
        'facility_id' => null,
        'item_id' => $itemId,
        'batch_number' => 'BATCH-'.\Illuminate\Support\Str::upper(\Illuminate\Support\Str::random(8)),
        'lot_number' => null,
        'manufacture_date' => now()->subMonths(2)->toDateString(),
        'expiry_date' => now()->addMonths(6)->toDateString(),
        'quantity' => 10,
        'warehouse_id' => null,
        'bin_location' => null,
        'supplier_id' => null,
        'unit_cost' => null,
        'status' => 'available',
        'notes' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ], $overrides);

    \Illuminate\Support\Facades\DB::table('inventory_batches')->insert($batch);

    return $batch;
}
