export type Strength = {
    numeratorValue: number;
    numeratorUnit: string;
    denominatorValue: number;
    denominatorUnit: string | null;
};

export type Dose = {
    value: number;
    unit: string;
};

export function calculateDispenseQuantity(
    desiredDose: Dose,
    strength: Strength,
): { quantity: number; unit: string } {
    const quantity = (desiredDose.value / strength.numeratorValue) * strength.denominatorValue;
    const unit = strength.denominatorUnit ?? strength.numeratorUnit;
    return { quantity, unit };
}

export function generateDosageInstruction(
    dose: Dose,
    route: string,
    frequency: string,
    duration: { value: number; unit: string } | null,
): string {
    let text = `${dose.value} ${dose.unit}`;
    if (route) text += ` ${route}`;
    if (frequency) text += ` ${frequency}`;
    if (duration?.value) text += ` \u00d7 ${duration.value} ${duration.unit}`;
    return text;
}
