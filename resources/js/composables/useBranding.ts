import { computed, watch } from 'vue';
import { usePage } from '@inertiajs/vue3';
import { normalizeBranding, syncClientBranding } from '@/lib/branding';
import type { SharedBranding } from '@/types/branding';

type SharedBrandingPageProps = {
    name?: string;
    branding?: Partial<SharedBranding>;
};

export function useBranding() {
    const page = usePage<SharedBrandingPageProps>();

    const branding = computed(() =>
        normalizeBranding(page.props.branding, page.props.name),
    );

    watch(
        branding,
        (value) => {
            syncClientBranding(value);
        },
        { immediate: true, deep: true },
    );

    const systemName = computed(() => branding.value.systemName);
    const displayName = computed(() => branding.value.displayName);
    const shortName = computed(() => branding.value.shortName);
    const logoUrl = computed(() => branding.value.logoUrl);
    const hasCustomLogo = computed(() => branding.value.hasCustomLogo);
    const appIconUrl = computed(() => branding.value.appIconUrl);
    const hasCustomAppIcon = computed(() => branding.value.hasCustomAppIcon);

    return {
        branding,
        systemName,
        displayName,
        shortName,
        logoUrl,
        hasCustomLogo,
        appIconUrl,
        hasCustomAppIcon,
    };
}
