<?php

namespace App\Modules\Billing;

use App\Modules\Billing\Infrastructure\Integrations\BillingIntegrationServiceProvider;
use Illuminate\Support\ServiceProvider;

class BillingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->register(BillingIntegrationServiceProvider::class);
    }

    public function boot(): void
    {
        $this->loadRoutesFrom(base_path('routes/billing-phase1.php'));
    }
}
