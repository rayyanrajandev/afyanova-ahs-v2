import { toast } from 'vue-sonner';
import { formatEntitlementLabel } from '@/config/facilityPageEntitlements';

export type FacilityEntitlementErrorBody = {
    code?: string;
    message?: string;
    missingEntitlements?: string[];
    requiredEntitlements?: string[];
};

const toastedCodes = new Set<string>();

function dedupeKey(code: string, missing: string[]): string {
    return `${code}:${missing.slice().sort().join(',')}`;
}

/**
 * Shows a single actionable toast when the API reports a missing facility plan entitlement.
 * Returns true when a facility-entitlement toast was shown (caller may suppress generic errors).
 */
export function notifyFacilityEntitlementDenied(
    body: unknown,
    context?: string,
): body is FacilityEntitlementErrorBody {
    if (!body || typeof body !== 'object') return false;
    const record = body as Record<string, unknown>;
    const code = typeof record.code === 'string' ? record.code : '';
    if (
        code !== 'FACILITY_ENTITLEMENT_REQUIRED' &&
        code !== 'FACILITY_SUBSCRIPTION_REQUIRED' &&
        code !== 'FACILITY_SUBSCRIPTION_EXPIRED' &&
        code !== 'FACILITY_SUBSCRIPTION_RESTRICTED'
    ) {
        return false;
    }

    const missing = Array.isArray(record.missingEntitlements)
        ? record.missingEntitlements.filter((e): e is string => typeof e === 'string')
        : [];
    const key = dedupeKey(code || 'unknown', missing);
    if (toastedCodes.has(key)) {
        return true;
    }
    toastedCodes.add(key);
    window.setTimeout(() => toastedCodes.delete(key), 8000);

    const message =
        typeof record.message === 'string' && record.message.trim() !== ''
            ? record.message
            : 'This facility’s service plan does not include that module.';

    const missingLine =
        missing.length > 0
            ? `Missing: ${missing.map((m) => formatEntitlementLabel(m)).join(', ')}.`
            : 'Ask a facility administrator to review the active subscription and entitlements.';

    toast.warning(context ? `${context}: ${message}` : message, {
        description: missingLine,
        duration: 9000,
    });

    return true;
}

export function resetFacilityEntitlementToastDedupeForTests(): void {
    toastedCodes.clear();
}
