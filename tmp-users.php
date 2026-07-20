<?php
$u = App\Models\User::where('is_platform_admin', true)->first(['id', 'name', 'email', 'tenant_id']);
if ($u) {
    echo 'Admin user: ' . json_encode($u->toArray()) . "\n";
} else {
    echo 'No admin user found' . "\n";
}
echo 'All users: ' . "\n";
$all = App\Models\User::select('id', 'name', 'email', 'is_platform_admin')->limit(5)->get();
foreach ($all as $a) {
    echo '  ' . json_encode($a->toArray()) . "\n";
}
