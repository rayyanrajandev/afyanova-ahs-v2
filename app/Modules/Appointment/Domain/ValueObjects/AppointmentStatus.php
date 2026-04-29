<?php

namespace App\Modules\Appointment\Domain\ValueObjects;

enum AppointmentStatus: string
{
    case SCHEDULED = 'scheduled';
    case WAITING_TRIAGE = 'waiting_triage';
    case WAITING_PROVIDER = 'waiting_provider';
    case IN_CONSULTATION = 'in_consultation';
    case COMPLETED = 'completed';
    case CANCELLED = 'cancelled';
    case NO_SHOW = 'no_show';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $status): string => $status->value, self::cases());
    }
}
