export type VitalDisplayRow = {
    label: string;
    value: string | null;
    unit: string;
};

export function vitalsDisplayRows(vitals: {
    temperatureC: number | null;
    heartRateBpm: number | null;
    systolicBpMmhg: number | null;
    diastolicBpMmhg: number | null;
    oxygenSaturationPct: number | null;
    respiratoryRateBpm: number | null;
    weightKg: number | null;
}): VitalDisplayRow[] {
    return [
        { label: 'BP', value: formatBP(vitals.systolicBpMmhg, vitals.diastolicBpMmhg), unit: 'mmHg' },
        { label: 'HR', value: vitals.heartRateBpm != null ? String(vitals.heartRateBpm) : null, unit: 'bpm' },
        { label: 'Temp', value: vitals.temperatureC != null ? vitals.temperatureC.toFixed(1) : null, unit: '°C' },
        { label: 'SpO₂', value: vitals.oxygenSaturationPct != null ? String(Math.round(vitals.oxygenSaturationPct)) : null, unit: '%' },
        { label: 'RR', value: vitals.respiratoryRateBpm != null ? String(vitals.respiratoryRateBpm) : null, unit: '/min' },
        { label: 'Weight', value: vitals.weightKg != null ? vitals.weightKg.toFixed(1) : null, unit: 'kg' },
    ];
}

function formatBP(systolic: number | null, diastolic: number | null): string | null {
    if (systolic == null && diastolic == null) return null;
    return `${systolic ?? '—'}/${diastolic ?? '—'}`;
}

export function vitalsSummaryLine(vitals: {
    temperatureC: number | null;
    heartRateBpm: number | null;
    systolicBpMmhg: number | null;
    diastolicBpMmhg: number | null;
    oxygenSaturationPct: number | null;
    respiratoryRateBpm: number | null;
    weightKg: number | null;
}): string {
    const parts: string[] = [];
    const bp = formatBP(vitals.systolicBpMmhg, vitals.diastolicBpMmhg);
    if (bp) parts.push(`BP ${bp}`);
    if (vitals.heartRateBpm != null) parts.push(`HR ${vitals.heartRateBpm}`);
    if (vitals.temperatureC != null) parts.push(`Temp ${vitals.temperatureC.toFixed(1)}C`);
    if (vitals.oxygenSaturationPct != null) parts.push(`SpO2 ${Math.round(vitals.oxygenSaturationPct)}%`);
    if (vitals.respiratoryRateBpm != null) parts.push(`RR ${vitals.respiratoryRateBpm}`);
    if (vitals.weightKg != null) parts.push(`Wt ${vitals.weightKg.toFixed(1)}kg`);
    return parts.join(', ') || 'No vitals recorded';
}
