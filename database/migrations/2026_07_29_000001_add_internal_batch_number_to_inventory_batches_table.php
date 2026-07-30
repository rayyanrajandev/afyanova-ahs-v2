<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_batches', function (Blueprint $table): void {
            $table->string('internal_batch_number', 100)->nullable()->after('id');
        });

        DB::statement('UPDATE inventory_batches SET internal_batch_number = batch_number WHERE internal_batch_number IS NULL');

        Schema::table('inventory_batches', function (Blueprint $table): void {
            $table->string('internal_batch_number', 100)->nullable(false)->change();

            $table->unique('internal_batch_number', 'inv_batches_internal_batch_unique');

            $table->string('batch_number', 100)->nullable()->change();

            $table->dropUnique('inv_batch_item_batch_wh_unique');
        });

        Schema::table('inventory_stock_movements', function (Blueprint $table): void {
            $table->string('internal_batch_number', 100)->nullable()->after('batch_id');
        });

        Schema::table('inventory_stock_reservations', function (Blueprint $table): void {
            $table->string('internal_batch_number', 100)->nullable()->after('batch_id');
        });

        Schema::table('inventory_warehouse_transfer_lines', function (Blueprint $table): void {
            $table->string('internal_batch_number', 100)->nullable()->after('batch_id');
        });

        Schema::table('inventory_dispensing_claim_links', function (Blueprint $table): void {
            $table->string('internal_batch_number', 100)->nullable()->after('batch_id');
        });

        Schema::table('department_stock_movements', function (Blueprint $table): void {
            $table->string('internal_batch_number', 100)->nullable()->after('batch_id');
        });

        Schema::table('department_stock_balances', function (Blueprint $table): void {
            $table->string('internal_batch_number', 100)->nullable()->after('batch_id');
        });
    }

    public function down(): void
    {
        Schema::table('department_stock_balances', function (Blueprint $table): void {
            $table->dropColumn('internal_batch_number');
        });

        Schema::table('department_stock_movements', function (Blueprint $table): void {
            $table->dropColumn('internal_batch_number');
        });

        Schema::table('inventory_dispensing_claim_links', function (Blueprint $table): void {
            $table->dropColumn('internal_batch_number');
        });

        Schema::table('inventory_warehouse_transfer_lines', function (Blueprint $table): void {
            $table->dropColumn('internal_batch_number');
        });

        Schema::table('inventory_stock_reservations', function (Blueprint $table): void {
            $table->dropColumn('internal_batch_number');
        });

        Schema::table('inventory_stock_movements', function (Blueprint $table): void {
            $table->dropColumn('internal_batch_number');
        });

        Schema::table('inventory_batches', function (Blueprint $table): void {
            $table->dropUnique('inv_batches_internal_batch_unique');
            $table->string('batch_number', 100)->nullable(false)->change();
            $table->unique(['item_id', 'batch_number', 'warehouse_id'], 'inv_batch_item_batch_wh_unique');
            $table->dropColumn('internal_batch_number');
        });
    }
};
