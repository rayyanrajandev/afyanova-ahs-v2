<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Patient Insurance Capture
    |--------------------------------------------------------------------------
    |
    | Keep patient-level coverage intentionally small. Detailed benefits,
    | co-pays, limits, package rules, and claim adjudication belong to payer
    | contracts or the insurer API integration layer.
    */

    'insurance_type_values' => [
        'insurance',
        'government',
        'employer',
        'donor',
        'other',
    ],

    'contract_payer_types' => [
        'insurance',
        'government',
        'employer',
        'donor',
        'other',
    ],

    'provider_presets' => [
        [
            'code' => 'nhif',
            'name' => 'National Health Insurance Fund (NHIF)',
            'category' => 'government',
            'insurance_type' => 'government',
        ],
        [
            'code' => 'private',
            'name' => 'Private insurer',
            'category' => 'insurance',
            'insurance_type' => 'insurance',
        ],
        [
            'code' => 'employer',
            'name' => 'Employer / corporate cover',
            'category' => 'employer',
            'insurance_type' => 'employer',
        ],
        [
            'code' => 'donor',
            'name' => 'Donor / NGO cover',
            'category' => 'donor',
            'insurance_type' => 'donor',
        ],
        [
            'code' => 'other',
            'name' => 'Other payer',
            'category' => 'other',
            'insurance_type' => 'other',
        ],
    ],
];
