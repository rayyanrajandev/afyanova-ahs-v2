<?php
require_once __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::where('email', 'verify-agent@local.test')->first();
if ($user) {
    $user->password = bcrypt('VerifyPass123!');
    $user->email_verified_at = now();
    $user->is_platform_admin = true;
    $user->save();
    echo "User {$user->id} ({$user->email}) password reset and verified.\n";
} else {
    $user = App\Models\User::updateOrCreate(
        ['email' => 'verify-agent@local.test'],
        ['name' => 'Verify Agent', 'password' => bcrypt('VerifyPass123!'), 'is_platform_admin' => true, 'tenant_id' => '019cb41e-0a8d-70be-a930-160fe876f247']
    );
    $user->email_verified_at = now();
    $user->save();
    echo "User {$user->id} ({$user->email}) created.\n";
}
