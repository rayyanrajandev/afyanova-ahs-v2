<?php

namespace App\Modules\Patient\Infrastructure\Models;

use App\Modules\Encounter\Infrastructure\Models\EncounterModel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class PatientModel extends Model
{
    use HasUuids;

    protected $table = 'patients';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'patient_number',
        'first_name',
        'middle_name',
        'last_name',
        'gender',
        'date_of_birth',
        'phone',
        'phone_normalized',
        'email',
        'national_id',
        'country_code',
        'region',
        'district',
        'address_line',
        'next_of_kin_name',
        'next_of_kin_phone',
        'status',
        'status_reason',
    ];

    /**
     * search_text is a DB-generated column (see the trigram search index
     * migration) backing fast substring search — internal only, never meant
     * to reach an API response.
     *
     * @var array<int, string>
     */
    protected $hidden = ['search_text'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date:Y-m-d',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function encounters(): HasMany
    {
        return $this->hasMany(EncounterModel::class, 'patient_id');
    }

    /**
     * The patient's current encounter, if any — drives the directory's
     * "Care Status" badge (Inpatient/Emergency/Active visit), which is
     * deliberately a separate concept from `status` (the record-management
     * active/inactive field above). No open encounter means no Care Status
     * badge, not "discharged" — this app has no such state on the patient
     * record itself.
     *
     * Deliberately a plain ordered hasOne(), not latestOfMany(): Eloquent's
     * ofMany() always adds a MAX(<primary key>) tiebreaker on top of the
     * requested column, and patients.id is a UUID — Postgres has no
     * MAX(uuid) aggregate, so latestOfMany('opened_at') fails at runtime on
     * this app's pgsql connection. A global ORDER BY opened_at DESC on a
     * plain hasOne() gives the same "latest per parent" result under
     * Eloquent's eager-load grouping (first row encountered per foreign key
     * in query order), without the UUID aggregate.
     */
    public function openEncounter(): HasOne
    {
        return $this->hasOne(EncounterModel::class, 'patient_id')
            ->whereNull('closed_at')
            ->orderByDesc('opened_at');
    }
}
