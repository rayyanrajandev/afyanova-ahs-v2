<?php

namespace App\Modules\Pharmacy\Infrastructure\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PharmacyOrderModel extends Model
{
    use HasUuids;

    protected $table = 'pharmacy_orders';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'order_number',
        'tenant_id',
        'facility_id',
        'patient_id',
        'admission_id',
        'appointment_id',
        'clinical_order_session_id',
        'replaces_order_id',
        'add_on_to_order_id',
        'ordered_by_user_id',
        'ordered_at',
        'approved_medicine_catalog_item_id',
        'medication_code',
        'medication_name',
        'dosage_instruction',
        'clinical_indication',
        'quantity_prescribed',
        'quantity_dispensed',
        'dispensing_notes',
        'dispensed_at',
        'verified_at',
        'verified_by_user_id',
        'verification_note',
        'formulary_decision_status',
        'formulary_decision_reason',
        'formulary_reviewed_at',
        'formulary_reviewed_by_user_id',
        'substitution_allowed',
        'substitution_made',
        'substituted_medication_code',
        'substituted_medication_name',
        'substitution_reason',
        'substitution_approved_at',
        'substitution_approved_by_user_id',
        'reconciliation_status',
        'reconciliation_decision',
        'reconciliation_note',
        'reconciled_at',
        'reconciled_by_user_id',
        'status',
        'entry_state',
        'signed_at',
        'signed_by_user_id',
        'status_reason',
        'lifecycle_reason_code',
        'entered_in_error_at',
        'entered_in_error_by_user_id',
        'lifecycle_locked_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'ordered_at' => 'datetime',
            'quantity_prescribed' => 'decimal:2',
            'quantity_dispensed' => 'decimal:2',
            'dispensed_at' => 'datetime',
            'verified_at' => 'datetime',
            'formulary_reviewed_at' => 'datetime',
            'substitution_allowed' => 'bool',
            'substitution_made' => 'bool',
            'substitution_approved_at' => 'datetime',
            'reconciled_at' => 'datetime',
            'signed_at' => 'datetime',
            'entered_in_error_at' => 'datetime',
            'lifecycle_locked_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }
}
