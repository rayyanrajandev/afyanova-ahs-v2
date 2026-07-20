<?php

echo "=== CATALOG ITEMS ===\n";
$items = DB::table('platform_clinical_catalog_items')->select('id', 'code', 'name', 'catalog_type', 'unit')->limit(15)->get();
foreach ($items as $i) {
    echo "  id={$i->id} code={$i->code} name={$i->name} type={$i->catalog_type} unit={$i->unit}\n";
}
echo 'Total: ' . DB::table('platform_clinical_catalog_items')->count() . "\n\n";

echo "=== LAB ORDERS ===\n";
$lab = DB::table('laboratory_orders')->select('id', 'order_number', 'patient_id', 'status', 'test_code', 'lab_test_catalog_item_id')->limit(10)->get();
foreach ($lab as $l) {
    echo "  id={$l->id} order={$l->order_number} patient={$l->patient_id} status={$l->status} test={$l->test_code}\n";
}
echo 'Total: ' . DB::table('laboratory_orders')->count() . "\n\n";

echo "=== PHARMACY ORDERS ===\n";
$pharm = DB::table('pharmacy_orders')->select('id', 'order_number', 'patient_id', 'status', 'medication_code')->limit(10)->get();
foreach ($pharm as $p) {
    echo "  id={$p->id} order={$p->order_number} patient={$p->patient_id} status={$p->status} med={$p->medication_code}\n";
}
echo 'Total: ' . DB::table('pharmacy_orders')->count() . "\n\n";

echo "=== RADIOLOGY ORDERS ===\n";
$rad = DB::table('radiology_orders')->select('id', 'order_number', 'patient_id', 'status', 'procedure_code')->limit(10)->get();
foreach ($rad as $r) {
    echo "  id={$r->id} order={$r->order_number} patient={$r->patient_id} status={$r->status} proc={$r->procedure_code}\n";
}
echo 'Total: ' . DB::table('radiology_orders')->count() . "\n\n";

echo "=== THEATRE PROCEDURES ===\n";
$theatre = DB::table('theatre_procedures')->select('id', 'procedure_number', 'patient_id', 'status', 'procedure_type')->limit(10)->get();
foreach ($theatre as $t) {
    echo "  id={$t->id} proc={$t->procedure_number} patient={$t->patient_id} status={$t->status} type={$t->procedure_type}\n";
}
echo 'Total: ' . DB::table('theatre_procedures')->count() . "\n\n";

echo "=== PATIENTS ===\n";
$patients = DB::table('patients')->select('id', 'patient_number', 'first_name', 'last_name')->limit(5)->get();
foreach ($patients as $p) {
    echo "  id={$p->id} number={$p->patient_number} name={$p->first_name} {$p->last_name}\n";
}
echo 'Total: ' . DB::table('patients')->count() . "\n\n";

echo "=== BILLING INVOICES (with line_items) ===\n";
$invoices = DB::table('billing_invoices')->select('id', 'invoice_number', 'patient_id', 'status')->limit(5)->get();
foreach ($invoices as $inv) {
    echo "  id={$inv->id} invoice={$inv->invoice_number} patient={$inv->patient_id} status={$inv->status}\n";
}
echo 'Total: ' . DB::table('billing_invoices')->count() . "\n\n";

echo "=== TENANTS & FACILITIES ===\n";
$tenants = DB::table('tenants')->select('id', 'code', 'name')->get();
foreach ($tenants as $t) {
    echo "  tenant: id={$t->id} code={$t->code} name={$t->name}\n";
    $facilities = DB::table('facilities')->where('tenant_id', $t->id)->select('id', 'code', 'name')->get();
    foreach ($facilities as $f) {
        echo "    facility: id={$f->id} code={$f->code} name={$f->name}\n";
    }
}

echo "\nDONE\n";
