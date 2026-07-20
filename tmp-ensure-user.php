<?php
$u = App\Models\User::where('email', 'verify-agent@local.test')->first();
if (!$u) {
    $u = App\Models\User::updateOrCreate(
        ['email' => 'verify-agent@local.test'],
        ['name' => 'Verify Agent', 'password' => bcrypt('VerifyPass123!'), 'is_platform_admin' => true, 'tenant_id' => '019cb41e-0a8d-70be-a930-160fe876f247']
    );
    echo "Created user: {$u->id}\n";
} else {
    echo "User exists: {$u->id}, is_platform_admin={$u->is_platform_admin}\n";
}
if (!$u->email_verified_at) {
    $u->email_verified_at = now();
    $u->save();
    echo "Verified email\n";
}
echo "Ready to login as verify-agent@local.test / VerifyPass123!\n";
