export const EMPTY_SELECT_VALUE = '__inventory_procurement_empty_select__';

export function toSelectValue(value: string | null | undefined): string {
    return value == null || value === '' ? EMPTY_SELECT_VALUE : value;
}

export function fromSelectValue(value: string): string {
    return value === EMPTY_SELECT_VALUE ? '' : value;
}
