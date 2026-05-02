<?php

namespace App\Modules\ServiceRequest\Domain\ValueObjects;

enum ServiceRequestServiceType: string
{
    case LABORATORY = 'laboratory';
    case PHARMACY = 'pharmacy';
    case RADIOLOGY = 'radiology';

    /**
     * @return string[]
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
