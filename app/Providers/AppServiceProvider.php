<?php

namespace App\Providers;

use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\DefaultCurrencyResolverInterface;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\MedicalRecord\Domain\ValueObjects\MedicalRecordStatus;
use App\Modules\MedicalRecord\Infrastructure\Models\MedicalRecordModel;
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
            if ($this->isFacilitySuperAdmin($user)) {
                return true;
            }

            return method_exists($user, 'hasPermissionTo')
                && (
                    (bool) $user->hasPermissionTo('emergency.triage.create')
                    || (bool) $user->hasPermissionTo('emergency.triage.update')
                    || (bool) $user->hasPermissionTo('emergency.triage.update-status')
                );
        });

        Gate::define('appointments.read-routing-options', function ($user): bool {
            if ($this->isFacilitySuperAdmin($user)) {
                return true;
            }

            return method_exists($user, 'hasPermissionTo')
                && (
                    (bool) $user->hasPermissionTo('appointments.create')
                    || (bool) $user->hasPermissionTo('appointments.update')
                    || (bool) $user->hasPermissionTo('appointments.update-status')
                    || (bool) $user->hasPermissionTo('emergency.triage.create')
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

        Gate::define('medical-records.update-draft', function ($user, string $recordId): bool {
            if ($this->isFacilitySuperAdmin($user)) {
                return true;
            }

            if (! method_exists($user, 'hasPermissionTo')) {
                return false;
            }

            if ((bool) $user->hasPermissionTo('medical.records.update')) {
                return true;
            }

            if (
                ! (bool) $user->hasPermissionTo('medical.records.read')
                || ! (bool) $user->hasPermissionTo('medical.records.create')
            ) {
                return false;
            }

            $record = MedicalRecordModel::query()
                ->select(['id', 'tenant_id', 'facility_id', 'author_user_id', 'status'])
                ->find($recordId);

            if (
                $record === null
                || $record->status !== MedicalRecordStatus::DRAFT->value
                || (int) $record->author_user_id !== (int) $user->id
            ) {
                return false;
            }

            /** @var CurrentPlatformScopeContextInterface $scopeContext */
            $scopeContext = app(CurrentPlatformScopeContextInterface::class);
            $tenantId = $scopeContext->tenantId();
            $facilityId = $scopeContext->facilityId();

            return ($tenantId === null || (string) $record->tenant_id === $tenantId)
                && ($facilityId === null || (string) $record->facility_id === $facilityId);
        });
    }

    private function allowsAppointmentProviderSession(mixed $user): bool
    {
        if ($user === null) {
            return false;
        }

        if ($this->isFacilitySuperAdmin($user)) {
            return true;
        }

        /** @var ConsultationProviderAuthorization $authorization */
        $authorization = app(ConsultationProviderAuthorization::class);

        return $authorization->allows($user);
    }

    private function isFacilitySuperAdmin(mixed $user): bool
    {
        return $user !== null
            && method_exists($user, 'isFacilitySuperAdminAccess')
            && (bool) $user->isFacilitySuperAdminAccess();
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


