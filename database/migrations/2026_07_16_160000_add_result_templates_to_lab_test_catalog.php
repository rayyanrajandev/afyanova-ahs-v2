<?php

use Database\Seeders\LaboratoryClinicalCatalogSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Backfills resultTemplate JSON onto lab-test catalog rows that already
 * exist in a database (e.g. staging/production, where deploys only run
 * `migrate`, not `db:seed` — see docker/start.sh). Template data itself
 * lives in one place: LaboratoryClinicalCatalogSeeder::resultTemplates().
 * A fresh database gets the same data via that seeder directly.
 */
return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::connection()->getDriverName();

        foreach (LaboratoryClinicalCatalogSeeder::resultTemplates() as $code => $template) {
            $templateJson = json_encode(['resultTemplate' => $template], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            if ($driver === 'pgsql') {
                $metadataExpr = "COALESCE(metadata::jsonb, '{}'::jsonb) || '{$templateJson}'::jsonb";
                $resultTemplateNullCheck = "metadata::jsonb->'resultTemplate' IS NULL";
            } elseif ($driver === 'sqlite') {
                // SQLite's json1 extension has no JSON_MERGE_PATCH/JSON_LENGTH; json_patch()
                // is the RFC 7396 merge-patch equivalent, sufficient for this additive backfill.
                $metadataExpr = "json_patch(COALESCE(metadata, '{}'), '{$templateJson}')";
                $resultTemplateNullCheck = "json_extract(metadata, '$.resultTemplate') IS NULL";
            } else {
                $metadataExpr = "JSON_MERGE_PATCH(COALESCE(metadata, '{}'), '{$templateJson}')";
                $resultTemplateNullCheck = "(JSON_EXTRACT(metadata, '$.resultTemplate') IS NULL OR JSON_LENGTH(metadata, '$.resultTemplate') = 0)";
            }

            DB::table('platform_clinical_catalog_items')
                ->where('catalog_type', 'lab_test')
                ->where('code', $code)
                ->whereRaw($resultTemplateNullCheck)
                ->update([
                    'metadata' => DB::raw($metadataExpr),
                ]);
        }
    }

    public function down(): void
    {
        $driver = DB::connection()->getDriverName();

        $removeExpr = $driver === 'pgsql'
            ? "metadata::jsonb - 'resultTemplate'"
            : "JSON_REMOVE(metadata, '$.resultTemplate')";

        DB::table('platform_clinical_catalog_items')
            ->where('catalog_type', 'lab_test')
            ->whereIn('code', array_keys(LaboratoryClinicalCatalogSeeder::resultTemplates()))
            ->whereNotNull(DB::raw("metadata->>'resultTemplate'"))
            ->update([
                'metadata' => DB::raw($removeExpr),
            ]);
    }
};
