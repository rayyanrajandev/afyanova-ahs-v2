<?php

use Database\Seeders\LaboratoryClinicalCatalogSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Repairs a data-corruption bug from the original version of
 * 2026_07_16_160000_add_result_templates_to_lab_test_catalog.php
 * (commit 0d46604): its Stool Analysis "Occult Blood" section had
 * 'fields' set to a bare associative array instead of an array
 * containing one field, so it serialized as a JSON object
 * (`"fields": {...}`) instead of an array (`"fields": [...]`) —
 * breaking StructuredLabResultForm.vue's `v-for="field in
 * section.fields"` and rendering that section's fields as nothing.
 *
 * That migration ran (and wrote the corrupted JSON) on any
 * environment deployed before the bug was fixed. Laravel only runs a
 * given migration filename once per environment, so the later fix to
 * that same file (see git history) never re-executed anywhere it had
 * already run — it only helped fresh environments. This migration
 * force-resyncs every code in LaboratoryClinicalCatalogSeeder::
 * resultTemplates() unconditionally (no "only if null" guard) to
 * repair already-corrupted rows regardless of environment history.
 *
 * Any future correction to resultTemplate data must ship as a new
 * migration like this one, not an edit to an already-run migration
 * file — that lesson is why this one exists.
 */
return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::connection()->getDriverName();

        foreach (LaboratoryClinicalCatalogSeeder::resultTemplates() as $code => $template) {
            $templateJson = json_encode(['resultTemplate' => $template], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            $metadataExpr = $driver === 'pgsql'
                ? "COALESCE(metadata::jsonb, '{}'::jsonb) || '{$templateJson}'::jsonb"
                : "JSON_MERGE_PATCH(COALESCE(metadata, '{}'), '{$templateJson}')";

            DB::table('platform_clinical_catalog_items')
                ->where('catalog_type', 'lab_test')
                ->where('code', $code)
                ->update([
                    'metadata' => DB::raw($metadataExpr),
                ]);
        }
    }

    public function down(): void
    {
        // No-op: this is a one-way data repair. There is no well-defined
        // "previous" state to roll back to — the row being fixed was
        // corrupted, not merely absent (see class docblock).
    }
};
