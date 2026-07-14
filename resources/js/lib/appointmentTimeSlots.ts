/**
 * Fixed 15-minute time-slot list for the appointment scheduling forms —
 * AppointmentCreateSheet.vue/AppointmentEditSheet.vue previously used a
 * single native `datetime-local` input, which buries time selection inside
 * a browser-native spinner control with no visible list of options. This
 * doesn't check real clinician availability (A3's backend conflict guard
 * already rejects a genuine double-booking, surfaced as a form error) —
 * it's just a clearer picker for the time-of-day component of
 * `scheduledAt`, covering a normal clinic day.
 */
const SLOT_INTERVAL_MINUTES = 15;
const DAY_START_MINUTES = 7 * 60;
const DAY_END_MINUTES = 19 * 60;

export function generateTimeSlotOptions(): string[] {
    const slots: string[] = [];
    for (let minutes = DAY_START_MINUTES; minutes <= DAY_END_MINUTES; minutes += SLOT_INTERVAL_MINUTES) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        slots.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
    }
    return slots;
}

export function formatTimeSlotLabel(value: string): string {
    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;

    const reference = new Date();
    reference.setHours(hours, minutes, 0, 0);
    return reference.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Rounds "now" up to the next slot boundary, matching each sheet's own prior default-time behavior. */
export function nextTimeSlotFrom(date: Date): string {
    const rounded = new Date(date);
    rounded.setMinutes(Math.ceil(rounded.getMinutes() / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES, 0, 0);
    return `${String(rounded.getHours()).padStart(2, '0')}:${String(rounded.getMinutes()).padStart(2, '0')}`;
}

export function toIsoDateString(date: Date): string {
    const pad = (segment: number) => String(segment).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
