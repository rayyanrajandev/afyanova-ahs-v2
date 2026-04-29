export type SearchableSelectOption = {
    value: string;
    label: string;
    description?: string | null;
    keywords?: string[];
    group?: string | null;
};

export type PatientLocationPreset = SearchableSelectOption & {
    districts?: Array<string | SearchableSelectOption>;
};

export function normalizeLocationToken(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function optionFromValue(value: string): SearchableSelectOption {
    return {
        value,
        label: value,
    };
}

export function mergeSearchableOptions(
    ...groups: SearchableSelectOption[][]
): SearchableSelectOption[] {
    const seen = new Set<string>();
    const merged: SearchableSelectOption[] = [];

    groups.flat().forEach((option) => {
        const value = option.value.trim();
        const key = normalizeLocationToken(value);
        if (!value || seen.has(key)) return;
        seen.add(key);
        merged.push({
            ...option,
            value,
            label: option.label.trim() || value,
        });
    });

    return merged;
}

function normalizePresetOption(
    option: string | SearchableSelectOption | null | undefined,
): SearchableSelectOption | null {
    if (typeof option === 'string') {
        const trimmed = option.trim();
        return trimmed ? optionFromValue(trimmed) : null;
    }

    if (!option || typeof option !== 'object') {
        return null;
    }

    const value = option.value.trim();
    if (!value) return null;

    return {
        value,
        label: option.label?.trim() || value,
        description: option.description?.trim() || null,
        keywords: Array.isArray(option.keywords)
            ? option.keywords
                  .map((keyword) => keyword.trim())
                  .filter((keyword) => keyword.length > 0)
            : undefined,
        group:
            typeof option.group === 'string' && option.group.trim()
                ? option.group.trim()
                : null,
    };
}

export function regionPresetOptions(
    presets: PatientLocationPreset[] | null | undefined,
): SearchableSelectOption[] {
    return mergeSearchableOptions(
        (presets ?? [])
            .map((preset) => normalizePresetOption(preset))
            .filter((option): option is SearchableSelectOption => option !== null),
    );
}

export function districtPresetOptionsForRegion(
    presets: PatientLocationPreset[] | null | undefined,
    region: string | null | undefined,
): SearchableSelectOption[] {
    const normalizedRegion = normalizeLocationToken(region);
    if (!normalizedRegion) return [];

    const regionPreset = (presets ?? []).find(
        (option) =>
            normalizeLocationToken(option.value) === normalizedRegion ||
            normalizeLocationToken(option.label) === normalizedRegion,
    );

    return mergeSearchableOptions(
        (regionPreset?.districts ?? [])
            .map((district) => normalizePresetOption(district))
            .filter((option): option is SearchableSelectOption => option !== null),
    );
}

export function freeTextLocationOption(
    value: string | null | undefined,
): SearchableSelectOption | null {
    const trimmed = (value ?? '').trim();
    return trimmed ? optionFromValue(trimmed) : null;
}
