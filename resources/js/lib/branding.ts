import type { SharedBranding, SharedMailBranding } from '@/types/branding';

const DEFAULT_SYSTEM_NAME = 'Afyanova AHS';
const DEFAULT_SHORT_NAME = 'Afyanova';
export const DEFAULT_APP_ICON_URL = '/apple-touch-icon.png';

type BrandingCandidate = Partial<SharedBranding> | null | undefined;
type MailBrandingCandidate = Partial<SharedMailBranding> | null | undefined;

function normalizeString(value: unknown): string | null {
    const normalized = String(value ?? '').trim();

    return normalized !== '' ? normalized : null;
}

export function normalizeBranding(
    candidate: BrandingCandidate,
    fallbackName?: string | null,
): SharedBranding {
    const systemName =
        normalizeString(candidate?.systemName) ??
        normalizeString(fallbackName) ??
        DEFAULT_SYSTEM_NAME;
    const shortName = normalizeString(candidate?.shortName);
    const logoUrl = normalizeString(candidate?.logoUrl);
    const appIconUrl =
        normalizeString(candidate?.appIconUrl) ?? DEFAULT_APP_ICON_URL;

    return {
        systemName,
        shortName,
        displayName: shortName ?? systemName,
        logoUrl,
        hasCustomLogo: Boolean(candidate?.hasCustomLogo) && logoUrl !== null,
        appIconUrl,
        hasCustomAppIcon: Boolean(candidate?.hasCustomAppIcon),
    };
}

export function buildDefaultMailFooterText(systemName: string): string {
    return `Copyright ${new Date().getFullYear()} ${systemName}. All rights reserved.`;
}

export function normalizeMailBranding(
    candidate: MailBrandingCandidate,
    fallbackSystemName?: string | null,
): SharedMailBranding {
    const systemName =
        normalizeString(fallbackSystemName) ?? DEFAULT_SYSTEM_NAME;
    const fromAddress =
        normalizeString(candidate?.fromAddress) ?? 'hello@example.com';
    const defaultFromAddress =
        normalizeString(candidate?.defaults?.fromAddress) ?? fromAddress;

    return {
        fromName: normalizeString(candidate?.fromName) ?? systemName,
        fromAddress,
        replyToAddress: normalizeString(candidate?.replyToAddress),
        footerText:
            normalizeString(candidate?.footerText) ??
            buildDefaultMailFooterText(systemName),
        usesCustomFromName: Boolean(candidate?.usesCustomFromName),
        usesCustomFromAddress: Boolean(candidate?.usesCustomFromAddress),
        usesCustomFooterText: Boolean(candidate?.usesCustomFooterText),
        defaults: {
            fromAddress: defaultFromAddress,
        },
    };
}

export function getClientBranding(): SharedBranding {
    if (typeof window === 'undefined') {
        return normalizeBranding({
            systemName: DEFAULT_SYSTEM_NAME,
            shortName: DEFAULT_SHORT_NAME,
        });
    }

    return normalizeBranding(window.__AFYANOVA_BRANDING__, DEFAULT_SYSTEM_NAME);
}

export function syncClientBranding(
    branding: BrandingCandidate,
): SharedBranding {
    const normalized = normalizeBranding(branding, DEFAULT_SYSTEM_NAME);

    if (typeof window !== 'undefined') {
        window.__AFYANOVA_BRANDING__ = normalized;

        const applicationNameMeta = document.querySelector<HTMLMetaElement>(
            'meta[name="application-name"]',
        );
        if (applicationNameMeta) {
            applicationNameMeta.content = normalized.systemName;
        }

        syncIconLink('app-favicon', normalized.appIconUrl);
        syncIconLink('app-apple-touch-icon', normalized.appIconUrl);
    }

    return normalized;
}

export function buildDocumentTitle(title?: string | null): string {
    const appName = getClientBranding().systemName;

    return title ? `${title} - ${appName}` : appName;
}

export function buildSsrDocumentTitle(
    title: string | null | undefined,
    branding: BrandingCandidate,
): string {
    const appName = normalizeBranding(branding, DEFAULT_SYSTEM_NAME).systemName;

    return title ? `${title} - ${appName}` : appName;
}

function syncIconLink(id: string, href: string): void {
    const element = document.getElementById(id);

    if (!(element instanceof HTMLLinkElement)) {
        return;
    }

    element.href = href;
}
