import type { InertiaLinkProps } from '@inertiajs/vue3';
import type { Component } from 'vue';
import type { NavSectionKey } from '@/config/appNavCatalog';
import type { AppIconName } from '@/lib/icons';

export type BreadcrumbItem = {
    title: string;
    href?: string;
};

export type NavItem = {
    id?: string;
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: Component;
    iconName?: AppIconName;
    section?: NavSectionKey;
    subGroup?: string;
    subGroupLabel?: string;
    subGroupIcon?: AppIconName;
    isActive?: boolean;
    badge?: string | number;
    badgeClass?: string;
};
