<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

class ConsultationPolicySystemSettingSeeder extends Seeder
{
    /**
     * Insert global (facility-agnostic) default system settings for the
     * consultation classification policy.  Ops staff can edit these values
     * from the system settings admin UI without touching .env or code.
     *
     * Each row uses updateOrCreate so running this seeder multiple times is
     * safe — it will not overwrite values that have already been changed in
     * production.
     */
    public function run(): void
    {
        $defaults = [
            [
                'key'   => 'consultation.follow_up_days',
                'value' => '14',
                'type'  => 'integer',
                'label' => 'Consultation follow-up window (days)',
                'hint'  => 'Visits within this many days of a completed appointment are classified as REVIEW. Set to 0 to disable REVIEW classification entirely.',
            ],
            [
                'key'   => 'consultation.review_fee_percentage',
                'value' => '50',
                'type'  => 'float',
                'label' => 'Review consultation fee percentage',
                'hint'  => 'Percentage of the full consultation fee charged for REVIEW visits (e.g. 50 = half price). Ignored when review_fee_is_free is true.',
            ],
            [
                'key'   => 'consultation.review_fee_is_free',
                'value' => 'false',
                'type'  => 'boolean',
                'label' => 'Review consultations are free',
                'hint'  => 'When true the entire consultation fee is waived for REVIEW visits, overriding review_fee_percentage.',
            ],
            [
                'key'   => 'consultation.same_complaint_required',
                'value' => 'false',
                'type'  => 'boolean',
                'label' => 'Require same complaint for REVIEW classification',
                'hint'  => 'When true a REVIEW classification is only applied when the new visit reason shares keywords with the prior completed visit reason.',
            ],
        ];

        foreach ($defaults as $setting) {
            SystemSetting::query()->updateOrCreate(
                [
                    'facility_id' => null,
                    'key'         => $setting['key'],
                ],
                [
                    'group' => 'consultation',
                    'value' => $setting['value'],
                    'type'  => $setting['type'],
                ],
            );
        }
    }
}
