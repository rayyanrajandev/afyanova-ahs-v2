<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { formatEnumLabel } from '@/lib/labels';

type Props = {
    source: 'clinical_catalog' | 'local' | 'standalone';
    catalogType?: string | null;
    catalogName?: string | null;
    catalogCode?: string | null;
};

const props = withDefaults(defineProps<Props>(), {
    catalogType: null,
    catalogName: null,
    catalogCode: null,
});

const badgeConfig = {
    clinical_catalog: {
        variant: 'default' as const,
        icon: 'check-circle' as const,
        label: 'Catalog',
        tooltip: 'Identity synced from Clinical Care Catalog',
    },
    local: {
        variant: 'secondary' as const,
        icon: 'pencil' as const,
        label: 'Manual',
        tooltip: 'Manually entered identity',
    },
    standalone: {
        variant: 'outline' as const,
        icon: 'receipt' as const,
        label: 'Standalone',
        tooltip: 'Billing-only item, not linked to clinical catalog',
    },
};

const config = badgeConfig[props.source] ?? badgeConfig.local;

const tooltipText = (() => {
    if (props.source === 'clinical_catalog' && props.catalogName) {
        const parts = [props.catalogName];
        if (props.catalogType) parts.push(formatEnumLabel(props.catalogType));
        if (props.catalogCode) parts.push(props.catalogCode);
        return `From Clinical Catalog: ${parts.join(' - ')}`;
    }
    return config.tooltip;
})();
</script>

<template>
    <Badge
        :variant="config.variant"
        class="inline-flex h-5 items-center gap-1 px-1.5 text-[10px] font-medium"
        :title="tooltipText"
    >
        <AppIcon :name="config.icon" class="size-3" />
        {{ config.label }}
    </Badge>
</template>
