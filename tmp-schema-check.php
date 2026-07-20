<?php
require_once __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== patients columns ===\n";
$cols = DB::select("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'patients' ORDER BY ordinal_position");
foreach ($cols as $c) echo "  {$c->column_name} ({$c->data_type}) nullable={$c->is_nullable}\n";

echo "=== encounters columns ===\n";
$cols = DB::select("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'encounters' ORDER BY ordinal_position");
foreach ($cols as $c) echo "  {$c->column_name} ({$c->data_type}) nullable={$c->is_nullable}\n";

echo "=== inventory_warehouses columns ===\n";
$cols = DB::select("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'inventory_warehouses' ORDER BY ordinal_position");
foreach ($cols as $c) echo "  {$c->column_name} ({$c->data_type}) nullable={$c->is_nullable}\n";

echo "=== inventory_items count ===\n";
echo "Total: " . DB::table('inventory_items')->where('facility_id', '019cb41e-0a96-7185-a8d0-b4175000e91e')->count() . "\n";
echo "With stock>0: " . DB::table('inventory_items')->where('facility_id', '019cb41e-0a96-7185-a8d0-b4175000e91e')->where('current_stock', '>', 0)->count() . "\n";

echo "=== platform_clinical_catalog_items count ===\n";
echo "Total: " . DB::table('platform_clinical_catalog_items')->where('facility_id', '019cb41e-0a96-7185-a8d0-b4175000e91e')->count() . "\n";

echo "=== billing_service_catalog_items count ===\n";
echo "Total: " . DB::table('billing_service_catalog_items')->where('facility_id', '019cb41e-0a96-7185-a8d0-b4175000e91e')->count() . "\n";

echo "=== patients count ===\n";
echo "Total: " . DB::table('patients')->count() . "\n";
