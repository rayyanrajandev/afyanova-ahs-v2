<?php

namespace App\Modules\Platform\Domain\ValueObjects;

enum ClinicalCatalogType: string
{
    case LAB_TEST = 'lab_test';
    case RADIOLOGY_PROCEDURE = 'radiology_procedure';
    case THEATRE_PROCEDURE = 'theatre_procedure';
    case FORMULARY_ITEM = 'formulary_item';
    case DIAGNOSIS_CODE = 'diagnosis_code';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $type): string => $type->value, self::cases());
    }
}
