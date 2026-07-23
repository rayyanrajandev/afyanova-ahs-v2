<?php

namespace App\Support\Rbac;

use App\Models\Permission;
use Illuminate\Support\Facades\File;

/**
 * RBAC_Remediation_Plan.md Phase 6: catches the "permission checked in code
 * but never seeded" bug class before merge — this exact class of bug has
 * already shipped at least twice in this codebase (clinical_procedure dot vs
 * hyphen naming drift; the billing insurance and payments-read permissions
 * never seeded at all despite gating live routes; billing service-catalog
 * permissions granted only to a dead legacy role code). See RBAC_Audit_Report.md §6.
 *
 * Does NOT do this by re-parsing migration files (fragile, as the original
 * audit's manual pass proved) — it queries the actual `permissions` table,
 * which reflects ground truth after every migration has run.
 */
class PermissionUsageAuditor
{
    /**
     * @var array<int, string>
     */
    private const ROUTE_FILES = [
        'routes/web.php',
        'routes/api.php',
        'routes/billing-phase1.php',
        'routes/settings.php',
    ];

    /**
     * @var array<int, string>
     */
    private const APP_SCAN_ROOTS = [
        'app',
    ];

    private const PROVIDER_FILE = 'app/Providers/AppServiceProvider.php';

    /**
     * @return array{
     *     checked: array<int, string>,
     *     seeded: array<int, string>,
     *     gateOnlyAllowlist: array<int, string>,
     *     orphanedChecks: array<int, string>,
     *     unusedSeeded: array<int, string>,
     * }
     */
    public function audit(): array
    {
        $checked = $this->scanCheckedPermissions();
        $seeded = Permission::query()->orderBy('name')->pluck('name')->all();
        $gateOnlyAllowlist = $this->scanGateDefineAbilities();

        $seededSet = array_flip($seeded);
        $allowlistSet = array_flip($gateOnlyAllowlist);

        $orphanedChecks = array_values(array_filter(
            $checked,
            static fn (string $name): bool => ! isset($seededSet[$name]) && ! isset($allowlistSet[$name]),
        ));
        sort($orphanedChecks);

        $checkedSet = array_flip($checked);
        $unusedSeeded = array_values(array_filter(
            $seeded,
            static fn (string $name): bool => ! isset($checkedSet[$name]),
        ));
        sort($unusedSeeded);

        return [
            'checked' => $checked,
            'seeded' => $seeded,
            'gateOnlyAllowlist' => $gateOnlyAllowlist,
            'orphanedChecks' => $orphanedChecks,
            'unusedSeeded' => $unusedSeeded,
        ];
    }

    /**
     * @return array<int, string>
     */
    private function scanCheckedPermissions(): array
    {
        $names = [];

        foreach (self::ROUTE_FILES as $relativePath) {
            $path = base_path($relativePath);
            if (! File::exists($path)) {
                continue;
            }

            $contents = File::get($path);
            if (preg_match_all('/can:([a-zA-Z0-9_.\-]+)/', $contents, $matches)) {
                array_push($names, ...$matches[1]);
            }
        }

        foreach (self::APP_SCAN_ROOTS as $root) {
            foreach ($this->phpFilesIn(base_path($root)) as $path) {
                $contents = File::get($path);

                foreach ($this->extractDotNamespacedLiterals($contents, [
                    'hasPermissionTo',
                    'authorize',
                    'allows',
                ]) as $name) {
                    $names[] = $name;
                }

                foreach ($this->extractCanCalls($contents) as $name) {
                    $names[] = $name;
                }
            }
        }

        $names = array_values(array_unique($names));
        sort($names);

        return $names;
    }

    /**
     * @param  array<int, string>  $functionNames
     * @return array<int, string>
     */
    private function extractDotNamespacedLiterals(string $contents, array $functionNames): array
    {
        $names = [];
        $pattern = '/(?:'.implode('|', $functionNames).")\\(\\s*'([a-zA-Z0-9_.\\-]+)'/";

        if (preg_match_all($pattern, $contents, $matches)) {
            foreach ($matches[1] as $candidate) {
                if (str_contains($candidate, '.')) {
                    $names[] = $candidate;
                }
            }
        }

        return $names;
    }

    /**
     * A dot-namespaced can() argument is a permission check; a bare word
     * like "view" passed alongside a model is a policy ability check
     * (never dot-namespaced in this codebase) — the dot filter in
     * extractDotNamespacedLiterals() already separates these,
     * this method exists only for clarity at the call site.
     *
     * @return array<int, string>
     */
    private function extractCanCalls(string $contents): array
    {
        return $this->extractDotNamespacedLiterals($contents, ['can']);
    }

    /**
     * @return array<int, string>
     */
    private function scanGateDefineAbilities(): array
    {
        $path = base_path(self::PROVIDER_FILE);
        if (! File::exists($path)) {
            return [];
        }

        $contents = File::get($path);
        $names = [];

        if (preg_match_all("/Gate::define\\(\\s*'([a-zA-Z0-9_.\\-]+)'/", $contents, $matches)) {
            $names = $matches[1];
        }

        sort($names);

        return $names;
    }

    /**
     * @return array<int, string>
     */
    private function phpFilesIn(string $directory): array
    {
        if (! File::isDirectory($directory)) {
            return [];
        }

        return collect(File::allFiles($directory))
            ->filter(fn ($file): bool => $file->getExtension() === 'php')
            ->map(fn ($file): string => $file->getPathname())
            ->values()
            ->all();
    }
}
