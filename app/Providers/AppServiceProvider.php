<?php

namespace App\Providers;

use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\DefaultCurrencyResolverInterface;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\Platform\Infrastructure\Services\RequestCurrentPlatformScopeContext;
use App\Modules\Platform\Infrastructure\Services\RequestScopedDefaultCurrencyResolver;
use App\Modules\Platform\Infrastructure\Services\RequestScopedFeatureFlagResolver;
use App\Support\Auth\ConsultationProviderAuthorization;
use App\Support\Branding\SystemBrandingManager;
use Illuminate\Contracts\Auth\Access\Gate as GateContract;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->bindModuleContracts();

        $this->app->scoped(
            CurrentPlatformScopeContextInterface::class,
            RequestCurrentPlatformScopeContext::class,
        );

        $this->app->scoped(
            FeatureFlagResolverInterface::class,
            RequestScopedFeatureFlagResolver::class,
        );

        $this->app->scoped(
            DefaultCurrencyResolverInterface::class,
            RequestScopedDefaultCurrencyResolver::class,
        );
    }

    public function boot(): void
    {
        $this->applyRuntimeBrandingConfig();

        Gate::before(function ($user, string $ability): ?bool {
            if (! method_exists($user, 'hasPermissionTo')) {
                return null;
            }

            $gate = app(GateContract::class);
            if (method_exists($gate, 'has') && $gate->has($ability)) {
                return null;
            }

            return $user->hasPermissionTo($ability) ? true : null;
        });

        Gate::define('appointments.record-triage', function ($user): bool {
            return method_exists($user, 'hasPermissionTo')
                && (
                    (bool) $user->hasPermissionTo('emergency.triage.create')
                    || (bool) $user->hasPermissionTo('emergency.triage.update')
                    || (bool) $user->hasPermissionTo('emergency.triage.update-status')
                );
        });

        Gate::define('appointments.start-consultation', function ($user): bool {
            return $this->allowsAppointmentProviderSession($user);
        });

        Gate::define('appointments.manage-provider-session', function ($user): bool {
            return $this->allowsAppointmentProviderSession($user);
        });

        Gate::define('setup-center.access', function ($user): bool {
            return $this->allowsAnyPermission($user, [
                'inventory.procurement.read',
                'inventory.procurement.manage-warehouses',
                'inventory.procurement.manage-suppliers',
                'platform.clinical-catalog.read',
                'billing.service-catalog.read',
                'departments.read',
                'specialties.read',
                'staff.specialties.read',
                'staff.read',
                'patients.read',
                'appointments.read',
                'platform.resources.read',
                'platform.facilities.read',
                'platform.subscription-plans.read',
            ]);
        });
    }

    private function allowsAppointmentProviderSession(mixed $user): bool
    {
        if ($user === null) {
            return false;
        }

        if (
            method_exists($user, 'isFacilitySuperAdminAccess')
            && (bool) $user->isFacilitySuperAdminAccess()
        ) {
            return true;
        }

        /** @var ConsultationProviderAuthorization $authorization */
        $authorization = app(ConsultationProviderAuthorization::class);

        return $authorization->allows($user);
    }

    /**
     * @param  array<int, string>  $permissions
     */
    private function allowsAnyPermission(mixed $user, array $permissions): bool
    {
        if ($user === null) {
            return false;
        }

        if (
            method_exists($user, 'isFacilitySuperAdminAccess')
            && (bool) $user->isFacilitySuperAdminAccess()
        ) {
            return true;
        }

        if (! method_exists($user, 'hasPermissionTo')) {
            return false;
        }

        foreach ($permissions as $permission) {
            if ((bool) $user->hasPermissionTo($permission)) {
                return true;
            }
        }

        return false;
    }

    private function applyRuntimeBrandingConfig(): void
    {
        /** @var SystemBrandingManager $brandingManager */
        $brandingManager = app(SystemBrandingManager::class);

        $replyToAddress = $brandingManager->mailReplyToAddress();

        config([
            'app.name' => $brandingManager->systemName(),
            'mail.from.address' => $brandingManager->mailFromAddress(),
            'mail.from.name' => $brandingManager->mailFromName(),
            'mail.reply_to' => $replyToAddress !== null
                ? [
                    'address' => $replyToAddress,
                    'name' => $brandingManager->mailFromName(),
                ]
                : null,
            'mail.markdown.theme' => SystemBrandingManager::MAIL_MARKDOWN_THEME,
        ]);
    }

    private function bindModuleContracts(): void
    {
        foreach (glob(app_path('Modules/*/Domain/Repositories/*Interface.php')) ?: [] as $file) {
            $this->bindModuleContract($file, [
                'App\\Modules\\%s\\Infrastructure\\Repositories\\Eloquent%s',
                'App\\Modules\\%s\\Infrastructure\\Repositories\\Database%s',
                'App\\Modules\\%s\\Infrastructure\\Repositories\\Config%s',
                'App\\Modules\\%s\\Infrastructure\\Repositories\\%s',
            ]);
        }

        foreach (glob(app_path('Modules/*/Domain/Services/*Interface.php')) ?: [] as $file) {
            $this->bindModuleContract($file, [
                'App\\Modules\\%s\\Infrastructure\\Services\\%s',
            ]);
        }
    }

    /**
     * @param array<int, string> $candidatePatterns
     */
    private function bindModuleContract(string $file, array $candidatePatterns): void
    {
        $normalizedFile = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $file);
        $normalizedAppPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, app_path());
        $relative = str_replace($normalizedAppPath.DIRECTORY_SEPARATOR, '', $normalizedFile);
        $segments = explode(DIRECTORY_SEPARATOR, $relative);

        if (count($segments) < 5 || $segments[0] !== 'Modules') {
            return;
        }

        $module = $segments[1];
        $contractName = pathinfo($file, PATHINFO_FILENAME);
        if (! str_ends_with($contractName, 'Interface')) {
            return;
        }

        $contract = 'App\\'.str_replace(
            [DIRECTORY_SEPARATOR, '.php'],
            ['\\', ''],
            $relative,
        );
        $base = substr($contractName, 0, -strlen('Interface'));

        foreach ($candidatePatterns as $candidatePattern) {
            $concrete = substr_count($candidatePattern, '%s') === 2
                ? sprintf($candidatePattern, $module, $base)
                : sprintf($candidatePattern, $module);
            if (! class_exists($concrete)) {
                continue;
            }

            $this->app->bind($contract, $concrete);
            return;
        }
    }
}


